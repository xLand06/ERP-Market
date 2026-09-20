import fs from 'fs/promises';
import path from 'path';
import Dockerode from 'dockerode';
import { prisma } from '../config/prisma';
import { env } from '../config/env';
import { createAuditEntry } from '../modules/audit/audit.service';

// ── Cliente Docker ───────────────────────────────────────────────────────────
const docker = new Dockerode({ socketPath: env.DOCKER_SOCKET });

// ── Constantes ───────────────────────────────────────────────────────────────
const NETWORK_NAME = 'erp_proxy';
const DEPLOY_DIR = process.env.DEPLOY_DIR || '/repo/deploy';
// Path del host para volume mounts de Docker (los containers DB necesitan el path del host)
const HOST_DEPLOY_DIR = process.env.HOST_DEPLOY_DIR || DEPLOY_DIR;
// Dominio base de los tenants (configurable via env, default: allcode.site)
const BASE_DOMAIN = process.env.BASE_DOMAIN || 'allcode.site';
const SITES_DIR = path.join(HOST_DEPLOY_DIR, 'caddy/sites');

// Tiempo maximo de espera para que DB este healthy (segundos)
const DB_HEALTH_TIMEOUT = 120;
// Intervalo entre reintentos de health check (segundos)
const HEALTH_POLL_INTERVAL = 5;

// ── Interfaces ───────────────────────────────────────────────────────────────
export interface ProvisionInput {
    slug: string;
    domain?: string;
    plan?: string;
    product?: string;
    adminEmail?: string;
    adminUser?: string;
    adminPassword?: string;
}

export interface ProvisionResult {
    tenantId: string;
    slug: string;
    domain: string;
    url: string;
    adminEmail: string;
    adminPasswordPlain: string;
    dbPassword: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Parsea un archivo .env en un diccionario clave-valor.
 * Ignora lineas vacias y comentarios.
 */
function parseEnvFile(content: string): Record<string, string> {
    const result: Record<string, string> = {};
    for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx === -1) continue;
        const key = trimmed.slice(0, eqIdx).trim();
        const value = trimmed.slice(eqIdx + 1).trim();
        result[key] = value;
    }
    return result;
}

/**
 * Ejecuta add-client.sh en un contenedor Docker efimero con acceso al socket
 * y al repositorio. Reutiliza el script probado en vez de reimplementar el
 * provisioning con dockerode.
 *
 * Requisitos de la imagen base:
 * - bash, docker-cli, docker-cli-compose, openssl, curl, gettext (envsubst)
 */
async function runAddClientScript(
    slug: string,
    domain: string,
    adminEmail: string,
    adminUser: string,
    adminPassword: string,
    plan?: string,
): Promise<string> {
    const { execSync } = await import('child_process');

    // add-client.sh: add-client.sh <slug> [domain] [admin-email] [admin-user] [admin-password] [plan]
    // IMPORTANTE: siempre pasar los args en orden (aunque sean vacíos),
    // sino los argumentos se corren de posición y el script falla.
    const args = [slug, domain || '', adminEmail || '', adminUser || 'admin', adminPassword || '', plan || 'pro'];

    const cmd = `BUILD_CONTEXT=/repo HOST_TLS_DIR=/opt/erp-market/deploy/clients/${slug}/tls /repo/deploy/scripts/add-client.sh ${args.join(' ')}`;
    console.log(`[provisioner] Ejecutando: ${cmd}`);

    try {
        const output = execSync(cmd, {
            encoding: 'utf-8',
            timeout: 10 * 60 * 1000, // 10 minutos
            maxBuffer: 10 * 1024 * 1024, // 10MB
            env: { ...process.env, PATH: process.env.PATH },
        });
        return output;
    } catch (err: any) {
        throw new Error(`add-client.sh fallo (exit ${err.status}):\n${err.stdout || ''}${err.stderr || ''}`);
    }
}

// ── Docker helpers ───────────────────────────────────────────────────────────

/**
 * Asegura que la red erp_proxy exista.
 */
export async function ensureNetwork(): Promise<void> {
    try {
        await docker.getNetwork(NETWORK_NAME).inspect();
    } catch {
        console.log(`[provisioner] Creando red ${NETWORK_NAME}`);
        await docker.createNetwork({ Name: NETWORK_NAME, Driver: 'bridge' });
    }
}

/**
 * Espera a que un contenedor este healthy.
 */
async function waitForHealthy(containerName: string, timeoutSec: number): Promise<boolean> {
    const deadline = Date.now() + timeoutSec * 1000;

    while (Date.now() < deadline) {
        try {
            const info = await docker.getContainer(containerName).inspect();
            const health = info.State.Health;

            if (health?.Status === 'healthy') {
                return true;
            }

            if (info.State.Status === 'exited' || info.State.Status === 'dead') {
                console.error(`[provisioner] Contenedor ${containerName} termino inesperadamente: ${info.State.Status}`);
                return false;
            }
        } catch {
            // Contenedor aun no existe o fue eliminado
        }

        await sleep(HEALTH_POLL_INTERVAL * 1000);
    }

    console.error(`[provisioner] Timeout esperando health de ${containerName} (${timeoutSec}s)`);
    return false;
}

/**
 * Escribe el archivo de sitio de Caddy para un tenant.
 */
async function writeCaddySite(slug: string, domain: string): Promise<void> {
    await fs.mkdir(SITES_DIR, { recursive: true });

    const content = `# Client: ${slug} — generado por provisioner.ts
${domain} {
    reverse_proxy api-${slug}:3000
}
`;

    await fs.writeFile(path.join(SITES_DIR, `${slug}.caddy`), content, 'utf-8');
    console.log(`[provisioner] Archivo Caddy escrito: ${slug}.caddy`);
}

/**
 * Recarga Caddy (si esta corriendo).
 */
async function reloadCaddy(): Promise<void> {
    try {
        const containers = await docker.listContainers({
            all: true,
            filters: { label: ['com.docker.compose.project=deploy'] },
        });

        const caddy = containers.find((c) =>
            c.Names.some((n) => n.includes('caddy'))
        );

        if (caddy) {
            const container = docker.getContainer(caddy.Id);
            const exec = await container.exec({
                Cmd: ['caddy', 'reload', '--config', '/etc/caddy/Caddyfile'],
                AttachStdout: false,
                AttachStderr: false,
            });
            const stream = await exec.start({ Tty: false });
            if (stream) stream.resume();
            console.log('[provisioner] Caddy recargado');
        } else {
            console.log('[provisioner] Caddy no esta corriendo — site file escrito pero inactivo');
        }
    } catch (err) {
        console.warn('[provisioner] No se pudo recargar Caddy:', err);
    }
}

/**
 * Elimina el archivo de sitio de Caddy de un tenant.
 */
async function removeCaddySite(slug: string): Promise<void> {
    try {
        const siteFile = path.join(SITES_DIR, `${slug}.caddy`);
        await fs.unlink(siteFile);
        console.log(`[provisioner] Archivo Caddy eliminado: ${slug}.caddy`);
    } catch {
        // El archivo no existia, no es error
    }
}

// ── Servicio principal de provisioning ───────────────────────────────────────

/**
 * Crea un tenant completo ejecutando add-client.sh via un contenedor Docker
 * efimero. El script se encarga de:
 *  - Generar secretos (DB_PASSWORD, JWT_SECRET)
 *  - Crear directorio deploy/clients/<slug>/ con TLS y .env
 *  - Renderizar docker-compose.yml desde template
 *  - Crear y levantar contenedores db-<slug> + api-<slug>
 *  - Verificar health checks
 *  - Semillar usuario admin
 *  - Configurar Caddy (site file + reload)
 *
 * Despues de la ejecucion, leemos el .env generado para registrar/actualizar
 * el tenant en la base de datos de management con todos los campos necesarios.
 */
export async function provisionTenant(input: ProvisionInput): Promise<ProvisionResult> {
    const { slug, adminEmail, adminPassword: adminPasswordInput } = input;
    const plan = input.plan || 'free';
    const product = input.product || 'market';
    const domain = input.domain || '';
    const adminEmailFinal = adminEmail || `admin@${slug}.local`;
    const adminPasswordFinal = adminPasswordInput || '';
    const adminUserFinal = input.adminUser || 'admin';

    console.log(`[provisioner] Iniciando provisioning para tenant: ${slug} via add-client.sh`);

    // ── 1. Ejecutar add-client.sh ──────────────────────────────────────
    const output = await runAddClientScript(slug, domain, adminEmailFinal, adminUserFinal, adminPasswordFinal, plan);
    console.log(`[provisioner] add-client.sh completado para ${slug}`);

    // ── 2. Registrar/actualizar tenant en la DB ───────────────────────
    return await registerTenantFromEnv(slug, domain, plan, product, adminEmailFinal, adminPasswordFinal);
}

/**
 * Registra un tenant en la DB despues de que add-client.sh genero el .env.
 * Extrae secretos, hashea password, y hace upsert en la tabla Tenant.
 */
async function registerTenantFromEnv(
    slug: string,
    domain: string,
    plan: string,
    product: string,
    adminEmailFinal: string,
    adminPasswordFinal: string,
): Promise<ProvisionResult> {
    const envPath = path.join(DEPLOY_DIR, 'clients', slug, '.env');
    let envVars: Record<string, string>;
    try {
        const envContent = await fs.readFile(envPath, 'utf-8');
        envVars = parseEnvFile(envContent);
    } catch (err) {
        throw new Error(`No se pudo leer ${envPath} despues de add-client.sh: ${err}`);
    }

    const clientDomain = envVars.CLIENT_DOMAIN || domain || `${slug}.${BASE_DOMAIN}`;
    const clientUrl = envVars.CLIENT_URL || `https://${clientDomain}`;
    const finalAdminEmail = envVars.ADMIN_EMAIL || adminEmailFinal;
    const finalAdminPassword = envVars.ADMIN_PASSWORD || adminPasswordFinal || 'admin123';
    const dbPassword = envVars.DB_PASSWORD || '';
    const jwtSecret = envVars.JWT_SECRET || '';

    const bcrypt = await import('bcryptjs');
    const adminPasswordHashed = await bcrypt.hash(finalAdminPassword, 10);

    const tenant = await prisma.tenant.upsert({
        where: { slug },
        update: {
            domain: clientDomain,
            url: clientUrl,
            plan,
            product,
            adminEmail: finalAdminEmail,
            adminPassword: adminPasswordHashed,
            jwtSecret,
            dbPassword,
            status: 'ACTIVE',
        },
        create: {
            slug,
            domain: clientDomain,
            url: clientUrl,
            plan,
            product,
            adminEmail: finalAdminEmail,
            adminPassword: adminPasswordHashed,
            jwtSecret,
            dbPassword,
            status: 'ACTIVE',
            nextPaymentDue: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 días de prueba gratis
        },
    });

    await createAuditEntry({
        actor: 'provisioner',
        action: 'TENANT_CREATED',
        tenantId: tenant.id,
        details: { slug, domain: clientDomain, method: 'add-client.sh' },
    });

    console.log(`[provisioner] Tenant ${slug} registrado en DB (id: ${tenant.id})`);

    return {
        tenantId: tenant.id,
        slug,
        domain: clientDomain,
        url: clientUrl,
        adminEmail: finalAdminEmail,
        adminPasswordPlain: finalAdminPassword,
        dbPassword,
    };
}

// ── Streaming provisioning (SSE) ────────────────────────────────────────────

/** Tipo de callback para enviar logs en tiempo real al cliente SSE */
export type LogCallback = (message: string) => void;

/**
 * Crea un tenant con logging en tiempo real via streaming.
 * Ejecuta add-client.sh en un contenedor Docker efimero y captura
 * stdout/stderr linea por linea, invocando sendLog() con cada una.
 *
 * Al completar, registra el tenant en la DB usando registerTenantFromEnv.
 */
export async function provisionWithLogs(
    slug: string,
    domain: string,
    plan: string,
    product: string,
    adminEmail: string,
    adminUser: string,
    adminPassword: string,
    sendLog: LogCallback,
): Promise<ProvisionResult> {
    const { spawn } = await import('child_process');

    const args = [slug, domain || '', adminEmail || '', adminUser || 'admin', adminPassword || ''];
    const scriptPath = `${DEPLOY_DIR}/scripts/add-client.sh`;

    sendLog(`Ejecutando add-client.sh para ${slug}...`);

    await new Promise<void>((resolve, reject) => {
        const proc = spawn('/bin/bash', [scriptPath, ...args], {
            cwd: `/repo`,
            env: { ...process.env, PATH: process.env.PATH, BUILD_CONTEXT: '/repo', HOST_TLS_DIR: `/opt/erp-market/deploy/clients/${slug}/tls` },
            timeout: 10 * 60 * 1000,
        });

        proc.stdout.on('data', (data: Buffer) => {
            data.toString().split('\n').filter(l => l.trim()).forEach(line => sendLog(line));
        });

        proc.stderr.on('data', (data: Buffer) => {
            data.toString().split('\n').filter(l => l.trim()).forEach(line => sendLog(line));
        });

        proc.on('close', (code) => {
            if (code === 0) resolve();
            else reject(new Error(`add-client.sh fallo con exit code ${code}`));
        });

        proc.on('error', reject);
    });

    sendLog('add-client.sh completado — registrando tenant en DB...');

    // Registrar en DB
    const result = await registerTenantFromEnv(slug, domain, plan, product, adminEmail, adminPassword);
    sendLog(`Tenant ${slug} registrado exitosamente (id: ${result.tenantId})`);

    return result;
}

// ── Background provisioning ──────────────────────────────────────────────────

/** Limite de lineas de log retenidas en memoria por tenant */
const MAX_LOG_LINES = 500;

/**
 * Estado de provisioning en memoria (se pierde al reiniciar el server).
 * Se usa para mostrar el progreso en vivo en el listado y la consola.
 */
export const provisioningState = new Map<string, {
    status: 'PROVISIONING' | 'ACTIVE' | 'ERROR';
    logs: string[];
    startedAt: number;
    finishedAt?: number;
}>();

/**
 * Devuelve el estado de provisioning en memoria de un tenant, o null si no
 * hay provisioning activo/registrado para ese slug.
 */
export function getProvisioningState(slug: string) {
    return provisioningState.get(slug) || null;
}

/**
 * Inicia el provisioning en background:
 * 1. Crea/actualiza el tenant con status PROVISIONING (upsert por slug)
 * 2. Inicializa el estado en memoria
 * 3. Ejecuta provisionWithLogs fire-and-forget, acumulando logs en memoria
 * 4. Al terminar, actualiza el tenant a ACTIVE (o ERROR si falla)
 *
 * Devuelve inmediatamente — NO espera a que termine el provisioning.
 */
export async function startProvisioningInBackground(input: ProvisionInput): Promise<void> {
    const { slug, domain, plan } = input;
    const tenantDomain = domain || `${slug}.${BASE_DOMAIN}`;
    const product = input.product || 'market';

    // 1. Crear/actualizar el tenant con status PROVISIONING
    await prisma.tenant.upsert({
        where: { slug },
        update: {
            status: 'PROVISIONING',
            plan: plan || 'free',
            product,
        },
        create: {
            slug,
            domain: tenantDomain,
            url: `https://${tenantDomain}`,
            status: 'PROVISIONING',
            plan: plan || 'free',
            product,
        },
    });

    // 2. Inicializar estado en memoria
    const state: {
        status: 'PROVISIONING' | 'ACTIVE' | 'ERROR';
        logs: string[];
        startedAt: number;
        finishedAt?: number;
    } = {
        status: 'PROVISIONING',
        logs: [],
        startedAt: Date.now(),
    };
    provisioningState.set(slug, state);

    const appendLog = (line: string) => {
        state.logs.push(line);
        if (state.logs.length > MAX_LOG_LINES) {
            state.logs.shift();
        }
    };

    // 3. Ejecutar provisioning fire-and-forget (sin await)
    provisionWithLogs(
        slug,
        domain || '',
        plan || 'free',
        product,
        input.adminEmail || `admin@${slug}.local`,
        input.adminUser || 'admin',
        input.adminPassword || '',
        appendLog,
    )
        .then(async (result) => {
            // 4. Exito: marcar ACTIVE
            await prisma.tenant.update({
                where: { slug },
                data: { status: 'ACTIVE' },
            });
            state.status = 'ACTIVE';
            state.finishedAt = Date.now();
            appendLog(`Provisioning completado para ${slug} (id: ${result.tenantId})`);
            console.log(`[provisioner] Background provisioning completado: ${slug}`);
        })
        .catch(async (err: any) => {
            // 5. Error: marcar ERROR y guardar el mensaje en los logs
            const message = err?.message || 'Error desconocido durante provisioning';
            console.error(`[provisioner] Background provisioning fallo para ${slug}:`, message);
            try {
                await prisma.tenant.update({
                    where: { slug },
                    data: { status: 'ERROR' },
                });
            } catch (updateErr) {
                console.error(`[provisioner] No se pudo marcar ${slug} como ERROR en DB:`, updateErr);
            }
            state.status = 'ERROR';
            state.finishedAt = Date.now();
            appendLog(`Error: ${message}`);
        });
}

/**
 * Obtiene las ultimas lineas de log de un contenedor Docker.
 * Util para la consola de tenant detail.
 */
export async function getContainerLogs(containerName: string, tail: number = 50): Promise<string[]> {
    try {
        const container = docker.getContainer(containerName);
        const logData = await new Promise<Buffer>((resolve, reject) => {
            container.logs(
                { stdout: true, stderr: true, tail, follow: false },
                (err: any, data: Buffer | undefined) => {
                    if (err) reject(err);
                    else resolve(data ?? Buffer.alloc(0));
                },
            );
        });

        return logData
            .toString('utf-8')
            .split('\n')
            .map((l) => l.trim())
            .filter((l) => l.length > 0);
    } catch {
        return [];
    }
}

// ── Lifecycle: suspend / resume / delete ─────────────────────────────────────

/**
 * Suspende un tenant: detiene contenedores Docker y actualiza estado en DB.
 */
export async function suspendTenant(slug: string): Promise<void> {
    console.log(`[provisioner] Suspendiendo tenant: ${slug}`);

    // Detener contenedores
    for (const name of [`api-${slug}`, `db-${slug}`]) {
        try {
            const container = docker.getContainer(name);
            const info = await container.inspect();
            if (info.State.Running) {
                await container.stop();
                console.log(`[provisioner] Contenedor ${name} detenido`);
            }
        } catch (err) {
            console.warn(`[provisioner] No se pudo detener ${name}: ${err}`);
        }
    }

    // Actualizar DB
    const tenant = await prisma.tenant.update({
        where: { slug },
        data: { status: 'SUSPENDED' },
    });

    await createAuditEntry({
        actor: 'provisioner',
        action: 'TENANT_SUSPENDED',
        tenantId: tenant.id,
        details: { slug },
    });

    console.log(`[provisioner] Tenant ${slug} suspendido`);
}

/**
 * Reanuda un tenant: inicia contenedores Docker y actualiza estado en DB.
 */
export async function resumeTenant(slug: string): Promise<void> {
    console.log(`[provisioner] Reanudando tenant: ${slug}`);

    // Iniciar contenedores
    for (const name of [`db-${slug}`, `api-${slug}`]) {
        try {
            const container = docker.getContainer(name);
            const info = await container.inspect();
            if (!info.State.Running) {
                await container.start();
                console.log(`[provisioner] Contenedor ${name} iniciado`);
            }
        } catch (err) {
            console.warn(`[provisioner] No se pudo iniciar ${name}: ${err}`);
        }
    }

    // Esperar a que DB este healthy
    const dbHealthy = await waitForHealthy(`db-${slug}`, DB_HEALTH_TIMEOUT);
    if (!dbHealthy) {
        console.error(`[provisioner] DB no se recupero al reanudar ${slug}`);
    }

    // Actualizar DB
    const tenant = await prisma.tenant.update({
        where: { slug },
        data: { status: 'ACTIVE' },
    });

    await createAuditEntry({
        actor: 'provisioner',
        action: 'TENANT_RESUMED',
        tenantId: tenant.id,
        details: { slug },
    });

    console.log(`[provisioner] Tenant ${slug} reanudado`);
}

/**
 * Elimina un tenant: contenedores Docker, volumen, directorio, Caddy y DB record.
 */
export async function deleteTenant(slug: string): Promise<void> {
    console.log(`[provisioner] Eliminando tenant: ${slug}`);

    // Obtener tenant antes de eliminarlo
    const tenant = await prisma.tenant.findUnique({ where: { slug } });

    // Eliminar contenedores
    for (const name of [`api-${slug}`, `db-${slug}`]) {
        try {
            const container = docker.getContainer(name);
            await container.remove({ force: true, v: true });
            console.log(`[provisioner] Contenedor ${name} eliminado`);
        } catch (err) {
            console.warn(`[provisioner] No se pudo eliminar ${name}: ${err}`);
        }
    }

    // Eliminar volumen
    try {
        await docker.getVolume(`erp-db-${slug}`).remove();
        console.log(`[provisioner] Volumen erp-db-${slug} eliminado`);
    } catch {
        // No existia
    }

    // Eliminar directorio del cliente
    try {
        await fs.rm(path.join(DEPLOY_DIR, 'clients', slug), { recursive: true, force: true });
        console.log(`[provisioner] Directorio clients/${slug} eliminado`);
    } catch {
        // No existia
    }

    // Eliminar sitio de Caddy
    await removeCaddySite(slug);
    await reloadCaddy();

    // Soft delete en DB
    if (tenant) {
        await prisma.tenant.update({
            where: { slug },
            data: { status: 'DELETED' },
        });

        await createAuditEntry({
            actor: 'provisioner',
            action: 'TENANT_DELETED',
            tenantId: tenant.id,
            details: { slug },
        });
    }

    console.log(`[provisioner] Tenant ${slug} eliminado`);
}

// ── Utilidades ───────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Sincroniza el plan comercial en tiempo real en la base de datos del tenant (SystemSetting)
 * sin downtime ni necesidad de reiniciar contenedores Docker.
 */
export async function syncTenantPlan(slug: string, plan: string): Promise<void> {
    const rawPlan = plan.toLowerCase();
    const normalizedTier = (rawPlan === 'premium') ? 'premium' : (rawPlan === 'basic' || rawPlan === 'basico') ? 'basic' : 'pro';
    const planConfigMap: Record<string, { maxUsers: number; maxBranches: number; maxProducts: number }> = {
        basic: { maxUsers: 2, maxBranches: 1, maxProducts: 500 },
        pro: { maxUsers: 6, maxBranches: 2, maxProducts: 99999 },
        premium: { maxUsers: 999, maxBranches: 5, maxProducts: 99999 },
    };
    const configObj = planConfigMap[normalizedTier] || planConfigMap.pro;

    try {
        const container = docker.getContainer(`api-${slug}`);
        const exec = await container.exec({
            Cmd: [
                'node',
                '-e',
                `
                const { prisma } = require('/app/dist/config/prisma.js');
                async function sync() {
                    try {
                        await prisma.systemSetting.upsert({
                            where: { key: 'planTier' },
                            update: { value: '${normalizedTier}' },
                            create: { key: 'planTier', value: '${normalizedTier}' }
                        });
                        await prisma.systemSetting.upsert({
                            where: { key: 'planConfig' },
                            update: { value: JSON.stringify(${JSON.stringify(configObj)}) },
                            create: { key: 'planConfig', value: JSON.stringify(${JSON.stringify(configObj)}) }
                        });
                        console.log('plan synced in tenant DB: ${normalizedTier}');
                    } catch (e) {
                        console.error('sync error:', e);
                    } finally {
                        process.exit(0);
                    }
                }
                sync();
                `
            ],
            AttachStdout: true,
            AttachStderr: true,
        });
        await exec.start({});
        console.log(`[provisioner] Plan sincronizado en tenant ${slug}: ${normalizedTier}`);
    } catch (err) {
        console.warn(`[provisioner] No se pudo sincronizar plan en contenedor api-${slug}:`, err);
    }
}

/**
 * Sincroniza un aviso administrativo en tiempo real en la base de datos del tenant (SystemSetting)
 */
export async function syncTenantNotice(slug: string, notice: string | null, level: string = 'INFO'): Promise<void> {
    try {
        const container = docker.getContainer(`api-${slug}`);
        const safeNotice = notice ? JSON.stringify(notice) : 'null';
        const safeLevel = JSON.stringify(level);
        const exec = await container.exec({
            Cmd: [
                'node',
                '-e',
                `
                const { prisma } = require('/app/dist/config/prisma.js');
                async function sync() {
                    try {
                        const noticeVal = ${safeNotice};
                        if (noticeVal) {
                            await prisma.systemSetting.upsert({
                                where: { key: 'systemNotice' },
                                update: { value: noticeVal },
                                create: { key: 'systemNotice', value: noticeVal }
                            });
                            await prisma.systemSetting.upsert({
                                where: { key: 'noticeLevel' },
                                update: { value: ${safeLevel} },
                                create: { key: 'noticeLevel', value: ${safeLevel} }
                            });
                        } else {
                            await prisma.systemSetting.deleteMany({
                                where: { key: { in: ['systemNotice', 'noticeLevel'] } }
                            });
                        }
                        console.log('notice synced in tenant DB: ${slug}');
                    } catch (e) {
                        console.error('sync notice error:', e);
                    } finally {
                        process.exit(0);
                    }
                }
                sync();
                `
            ],
            AttachStdout: true,
            AttachStderr: true,
        });
        await exec.start({});
        console.log(`[provisioner] Aviso sincronizado en tenant ${slug}`);
    } catch (err) {
        console.warn(`[provisioner] No se pudo sincronizar aviso en contenedor api-${slug}:`, err);
    }
}

// ── Cache en memoria para telemetría (TTL: 60s) para evitar sobrecarga en Docker ──
const metricsCache = new Map<string, { data: { usersCount: number; productsCount: number; branchesCount: number }; timestamp: number }>();
const METRICS_CACHE_TTL_MS = 60 * 1000;

/**
 * Consulta la telemetría y uso real de recursos del tenant (usuarios, productos, sucursales).
 * Implementa caché en memoria de 60 segundos para evitar saturar el daemon de Docker.
 */
export async function getTenantUsageMetrics(slug: string, force: boolean = false): Promise<{ usersCount: number; productsCount: number; branchesCount: number } | null> {
    const cached = metricsCache.get(slug);
    const now = Date.now();
    if (!force && cached && now - cached.timestamp < METRICS_CACHE_TTL_MS) {
        return cached.data;
    }

    try {
        const { execSync } = await import('child_process');
        const script = `
        const { prisma } = require('/app/dist/config/prisma.js');
        async function run() {
            try {
                const [usersCount, productsCount, branchesCount] = await Promise.all([
                    prisma.user.count({ where: { isActive: true } }),
                    prisma.product.count({ where: { isActive: true } }),
                    prisma.branch.count({ where: { isActive: true } }),
                ]);
                console.log(JSON.stringify({ usersCount, productsCount, branchesCount }));
            } catch(e) {
                console.log(JSON.stringify({ error: e.message }));
            } finally {
                await prisma.$disconnect();
            }
        }
        run();
        `;
        const output = execSync(`docker exec api-${slug} node -e "${script.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`, {
            encoding: 'utf-8',
            timeout: 15000,
        });
        const match = output.match(/\{"usersCount".*\}/);
        if (match) {
            const data = JSON.parse(match[0]);
            metricsCache.set(slug, { data, timestamp: now });
            return data;
        }
        return null;
    } catch (err) {
        console.warn(`[provisioner] No se pudieron obtener métricas de api-${slug}:`, err);
        return null;
    }
}

/**
 * Genera un token JWT seguro y efímero (30m) para login asistido de soporte
 */
export async function generateImpersonationSession(slug: string): Promise<{ token: string; user: any } | null> {
    try {
        const { execSync } = await import('child_process');
        const script = `
        const { prisma } = require('/app/dist/config/prisma.js');
        const jwt = require('jsonwebtoken');
        const { env } = require('/app/dist/config/env.js');
        async function run() {
            try {
                const user = await prisma.user.findFirst({
                    where: { role: 'OWNER', isActive: true }
                }) || await prisma.user.findFirst({
                    where: { isActive: true }
                });
                if (!user) {
                    console.log(JSON.stringify({ error: 'No active user found' }));
                    return;
                }
                // Token efímero de soporte (expira en 30 minutos por seguridad)
                const token = jwt.sign(
                    {
                        id: user.id,
                        role: user.role,
                        name: user.nombre,
                        email: user.email || undefined,
                        branchId: user.branchId || undefined,
                        canManageInventory: user.canManageInventory,
                        isImpersonation: true,
                        impersonatedAt: Date.now(),
                    },
                    env.JWT_SECRET,
                    { expiresIn: '30m' }
                );
                console.log(JSON.stringify({
                    token,
                    user: {
                        id: user.id,
                        username: user.username,
                        nombre: user.nombre,
                        apellido: user.apellido,
                        email: user.email,
                        role: user.role,
                        branchId: user.branchId,
                        canManageInventory: user.canManageInventory
                    }
                }));
            } catch(e) {
                console.log(JSON.stringify({ error: e.message }));
            } finally {
                await prisma.$disconnect();
            }
        }
        run();
        `;
        const output = execSync(`docker exec api-${slug} node -e "${script.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`, {
            encoding: 'utf-8',
            timeout: 15000,
        });
        const match = output.match(/\{"token".*\}/);
        if (match) {
            return JSON.parse(match[0]);
        }
        return null;
    } catch (err) {
        console.warn(`[provisioner] Error generando sesión de soporte para ${slug}:`, err);
        return null;
    }
}

export interface BackupItem {
    filename: string;
    sizeBytes: number;
    createdAt: string;
}

/**
 * Crea un backup on-demand de la base de datos de un tenant con estricta sanitización de inputs
 */
export async function backupTenantDatabase(slug: string): Promise<BackupItem> {
    const SAFE_IDENTIFIER = /^[a-zA-Z0-9_-]+$/;
    if (!SAFE_IDENTIFIER.test(slug)) {
        throw new Error('Identificador de tenant no válido');
    }

    const { execSync } = await import('child_process');
    const clientsDir = path.join(DEPLOY_DIR, 'clients');
    const backupsDir = path.join(DEPLOY_DIR, 'backups');
    const clientDir = path.join(clientsDir, slug);
    const envFile = path.join(clientDir, '.env');

    let dbUser = 'postgres';
    let dbName = slug;

    try {
        const envContent = await fs.readFile(envFile, 'utf-8');
        const envVars = parseEnvFile(envContent);
        if (envVars.DB_USER && SAFE_IDENTIFIER.test(envVars.DB_USER)) dbUser = envVars.DB_USER;
        if (envVars.DB_NAME && SAFE_IDENTIFIER.test(envVars.DB_NAME)) dbName = envVars.DB_NAME;
    } catch (e) {
        console.warn(`[provisioner] No se pudo leer .env para backup de ${slug}, usando defaults:`, e);
    }

    const outDir = path.join(backupsDir, slug);
    await fs.mkdir(outDir, { recursive: true });

    const now = new Date();
    const stamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `${stamp}.sql.gz`;
    const outFile = path.join(outDir, filename);

    const cmd = `docker exec db-${slug} pg_dump -U "${dbUser}" "${dbName}" | gzip -c > "${outFile}"`;
    console.log(`[provisioner] Ejecutando backup: ${cmd}`);
    execSync(cmd, { encoding: 'utf-8', timeout: 120000 });

    const stats = await fs.stat(outFile);
    return {
        filename,
        sizeBytes: stats.size,
        createdAt: now.toISOString(),
    };
}

/**
 * Lista los backups disponibles para un tenant (máximo 50 más recientes)
 */
export async function listTenantBackups(slug: string): Promise<BackupItem[]> {
    const SAFE_IDENTIFIER = /^[a-zA-Z0-9_-]+$/;
    if (!SAFE_IDENTIFIER.test(slug)) return [];

    const backupsDir = path.join(DEPLOY_DIR, 'backups', slug);
    try {
        const files = await fs.readdir(backupsDir);
        const backups: BackupItem[] = [];

        for (const file of files) {
            if (!file.endsWith('.sql.gz')) continue;
            const fullPath = path.join(backupsDir, file);
            const stats = await fs.stat(fullPath);
            backups.push({
                filename: file,
                sizeBytes: stats.size,
                createdAt: stats.mtime.toISOString(),
            });
        }

        return backups
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .slice(0, 50);
    } catch {
        return [];
    }
}


