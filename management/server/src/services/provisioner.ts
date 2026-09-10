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
const DEPLOY_DIR = process.env.DEPLOY_DIR || path.resolve(__dirname, '../../../../deploy');
// Path del host para volume mounts de Docker
const HOST_DEPLOY_DIR = process.env.HOST_DEPLOY_DIR || DEPLOY_DIR;
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
): Promise<string> {
    const { execSync } = await import('child_process');

    // add-client.sh: add-client.sh <slug> [domain] [admin-email] [admin-user] [admin-password]
    const args = [slug];
    if (domain) args.push(domain);
    if (adminEmail) args.push(adminEmail);
    args.push(adminUser || 'admin');
    if (adminPassword) args.push(adminPassword);

    const cmd = `cd ${DEPLOY_DIR}/.. && ./deploy/scripts/add-client.sh ${args.join(' ')}`;
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
    const domain = input.domain || '';
    const adminEmailFinal = adminEmail || `admin@${slug}.local`;
    const adminPasswordFinal = adminPasswordInput || '';
    const adminUserFinal = input.adminUser || 'admin';

    console.log(`[provisioner] Iniciando provisioning para tenant: ${slug} via add-client.sh`);

    // ── 1. Ejecutar add-client.sh ──────────────────────────────────────
    const output = await runAddClientScript(slug, domain, adminEmailFinal, adminUserFinal, adminPasswordFinal);
    console.log(`[provisioner] add-client.sh completado para ${slug}`);

    // ── 2. Registrar/actualizar tenant en la DB ───────────────────────
    return await registerTenantFromEnv(slug, domain, plan, adminEmailFinal, adminPasswordFinal);
}

/**
 * Registra un tenant en la DB despues de que add-client.sh genero el .env.
 * Extrae secretos, hashea password, y hace upsert en la tabla Tenant.
 */
async function registerTenantFromEnv(
    slug: string,
    domain: string,
    plan: string,
    adminEmailFinal: string,
    adminPasswordFinal: string,
): Promise<ProvisionResult> {
    const envPath = path.join(HOST_DEPLOY_DIR, 'clients', slug, '.env');
    let envVars: Record<string, string>;
    try {
        const envContent = await fs.readFile(envPath, 'utf-8');
        envVars = parseEnvFile(envContent);
    } catch (err) {
        throw new Error(`No se pudo leer ${envPath} despues de add-client.sh: ${err}`);
    }

    const clientDomain = envVars.CLIENT_DOMAIN || domain || `${slug}.89.167.46.144.sslip.io`;
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
            adminEmail: finalAdminEmail,
            adminPassword: adminPasswordHashed,
            jwtSecret,
            dbPassword,
            status: 'ACTIVE',
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
    adminEmail: string,
    adminUser: string,
    adminPassword: string,
    sendLog: LogCallback,
): Promise<ProvisionResult> {
    const { spawn } = await import('child_process');

    const args = [slug];
    if (domain) args.push(domain);
    if (adminEmail) args.push(adminEmail);
    args.push(adminUser || 'admin');
    if (adminPassword) args.push(adminPassword);
    const scriptPath = `${DEPLOY_DIR}/../deploy/scripts/add-client.sh`;

    sendLog(`Ejecutando add-client.sh para ${slug}...`);

    await new Promise<void>((resolve, reject) => {
        const proc = spawn('/bin/bash', [scriptPath, ...args], {
            cwd: `${DEPLOY_DIR}/..`,
            env: { ...process.env, PATH: process.env.PATH },
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
    const result = await registerTenantFromEnv(slug, domain, plan, adminEmail, adminPassword);
    sendLog(`Tenant ${slug} registrado exitosamente (id: ${result.tenantId})`);

    return result;
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
        await fs.rm(path.join(HOST_DEPLOY_DIR, 'clients', slug), { recursive: true, force: true });
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
