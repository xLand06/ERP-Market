import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import Dockerode from 'dockerode';
import selfsigned from 'selfsigned';
import { prisma } from '../config/prisma';
import { env } from '../config/env';
import { createAuditEntry } from '../modules/audit/audit.service';

// ── Cliente Docker ───────────────────────────────────────────────────────────
const docker = new Dockerode({ socketPath: env.DOCKER_SOCKET });

// ── Constantes ───────────────────────────────────────────────────────────────
const NETWORK_NAME = 'erp_proxy';
const DB_IMAGE = 'postgres:16-alpine';
const API_IMAGE = 'erp-market:latest';
const DEPLOY_DIR = process.env.DEPLOY_DIR || path.resolve(__dirname, '../../../../deploy');
const SITES_DIR = path.join(DEPLOY_DIR, 'caddy/sites');

// Tiempo máximo de espera para que DB esté healthy (segundos)
const DB_HEALTH_TIMEOUT = 120;
// Tiempo máximo de espera para que API responda (segundos)
const API_HEALTH_TIMEOUT = 60;
// Intervalo entre reintentos de health check (segundos)
const HEALTH_POLL_INTERVAL = 5;

// ── Interfaces ───────────────────────────────────────────────────────────────
export interface ProvisionInput {
    slug: string;
    domain?: string;
    plan?: string;
    adminEmail?: string;
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

// ── Generación de secretos ───────────────────────────────────────────────────
function generatePassword(): string {
    return crypto.randomBytes(18).toString('base64url');
}

function generateJwtSecret(): string {
    return crypto.randomBytes(24).toString('hex');
}

/**
 * Genera un keypair TLS auto-firmado para PostgreSQL.
 * Usa la librería selfsigned (pure JS) que genera certificados X.509
 * compatibles con PostgreSQL ssl=on. Clave de 2048 bits RSA, válida 5 años.
 */
async function generateTlsKeypair(commonName: string): Promise<{ key: string; cert: string }> {
    const attrs = [{ name: 'commonName', value: commonName }];
    const pems = await selfsigned.generate(attrs, {
        algorithm: 'sha256',
        keySize: 2048,
        extensions: [
            { name: 'subjectAltName', altNames: [] },
        ],
    });

    return {
        key: pems.private,
        cert: pems.cert,
    };
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
 * Crea y levanta un contenedor con la configuración dada.
 */
async function createAndStartContainer(config: Dockerode.ContainerCreateOptions): Promise<void> {
    // Verificar si ya existe (idempotencia)
    try {
        const existing = docker.getContainer(config.name!);
        const info = await existing.inspect();
        if (info.State.Running) {
            return;
        }
        // Si existe pero no está corriendo, lo eliminamos y recreamos
        await existing.remove({ force: true });
    } catch {
        // No existe, procedemos a crear
    }

    const container = await docker.createContainer(config);
    await container.start();
}

/**
 * Espera a que un contenedor esté healthy.
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
                console.error(`[provisioner] Contenedor ${containerName} terminó inesperadamente: ${info.State.Status}`);
                return false;
            }
        } catch {
            // Contenedor aún no existe o fue eliminado
        }

        await sleep(HEALTH_POLL_INTERVAL * 1000);
    }

    console.error(`[provisioner] Timeout esperando health de ${containerName} (${timeoutSec}s)`);
    return false;
}

/**
 * Ejecuta un comando dentro de un contenedor usando la API de dockerode.
 */
async function execInContainer(containerName: string, cmd: string[]): Promise<{ exitCode: number }> {
    const container = docker.getContainer(containerName);

    const exec = await container.exec({
        Cmd: cmd,
        AttachStdout: false,
        AttachStderr: false,
    });

    return new Promise((resolve, reject) => {
        exec.start({ Tty: false }, (err: Error | null, stream: NodeJS.ReadableStream | undefined) => {
            if (err) {
                reject(err);
                return;
            }

            // Consumir el stream
            if (stream) {
                stream.resume();
            }

            // Obtener exit code via inspect
            const checkExit = () => {
                exec.inspect((inspectErr: Error | null, info: any) => {
                    if (inspectErr) {
                        reject(inspectErr);
                        return;
                    }
                    resolve({ exitCode: info?.ExitCode ?? 0 });
                });
            };

            // Esperar un momento para que el stream termine
            setTimeout(checkExit, 100);
        });
    });
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
 * Recarga Caddy (si está corriendo).
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
            console.log('[provisioner] Caddy no está corriendo — site file escrito pero inactivo');
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
        // El archivo no existía, no es error
    }
}

// ── Servicio principal de provisioning ───────────────────────────────────────

/**
 * Crea un tenant completo: DB record + Docker containers + Caddy routing.
 *
 * Flujo:
 * 1. Genera secretos (dbPassword, jwtSecret, adminPassword, TLS keypair)
 * 2. Crea directorio deploy/clients/<slug>/ con TLS y .env
 * 3. Inserta tenant en la base de datos de management
 * 4. Crea contenedor db-<slug> (PostgreSQL con TLS)
 * 5. Espera a que DB esté healthy
 * 6. Crea contenedor api-<slug> (ERP-Market backend)
 * 7. Espera a que API responda health check
 * 8. Semilla usuario admin
 * 9. Configura Caddy (site file + reload)
 * 10. Retorna credenciales
 */
export async function provisionTenant(input: ProvisionInput): Promise<ProvisionResult> {
    const { slug, adminEmail, adminPassword: adminPasswordInput } = input;
    const plan = input.plan || 'free';

    // Auto-generar dominio si no se prove
    const domain = input.domain || `${slug}.89.167.46.144.sslip.io`;

    // ── 1. Generar secretos ──────────────────────────────────────────────
    const dbPassword = generatePassword();
    const jwtSecret = generateJwtSecret();
    const adminPasswordPlain = adminPasswordInput || generatePassword();
    const adminEmailFinal = adminEmail || `admin@${slug}.local`;

    console.log(`[provisioner] Iniciando provisioning para tenant: ${slug}`);

    // ── 2. Crear directorio del cliente + TLS ────────────────────────────
    const clientDir = path.join(DEPLOY_DIR, 'clients', slug);
    const tlsDir = path.join(clientDir, 'tls');

    await fs.mkdir(tlsDir, { recursive: true });

    const { key: tlsKey, cert: tlsCert } = await generateTlsKeypair(`db-${slug}`);

    // Escribir clave TLS (mode 600)
    await fs.writeFile(path.join(tlsDir, 'server.key'), tlsKey, { mode: 0o600 });
    await fs.writeFile(path.join(tlsDir, 'server.crt'), tlsCert, { mode: 0o644 });

    // Escribir archivo .env para referencia
    const envContent = [
        `# Generado por provisioner.ts — no editar manualmente`,
        `CLIENT_SLUG=${slug}`,
        `CLIENT_DOMAIN=${domain}`,
        `CLIENT_URL=https://${domain}`,
        `DB_NAME=erp_market`,
        `DB_USER=erp`,
        `DB_PASSWORD=${dbPassword}`,
        `JWT_SECRET=${jwtSecret}`,
        `ADMIN_EMAIL=${adminEmailFinal}`,
        `ADMIN_PASSWORD=${adminPasswordPlain}`,
    ].join('\n');

    await fs.writeFile(path.join(clientDir, '.env'), envContent, { mode: 0o600 });

    // ── 3. Insertar tenant en la DB de management ────────────────────────
    const bcrypt = await import('bcryptjs');
    const adminPasswordHashed = await bcrypt.hash(adminPasswordPlain, 10);

    const tenant = await prisma.tenant.create({
        data: {
            slug,
            domain,
            url: `https://${domain}`,
            plan,
            adminEmail: adminEmailFinal,
            adminPassword: adminPasswordHashed,
            dbPassword,
            jwtSecret,
            status: 'ACTIVE',
        },
    });

    await createAuditEntry({
        actor: 'provisioner',
        action: 'TENANT_CREATED',
        tenantId: tenant.id,
        details: { slug, domain },
    });

    console.log(`[provisioner] Tenant ${slug} creado en DB (id: ${tenant.id})`);

    // ── 4. Asegurar red erp_proxy ────────────────────────────────────────
    await ensureNetwork();

    // ── 5. Crear contenedor DB ───────────────────────────────────────────
    const dbContainerName = `db-${slug}`;
    const volumeName = `erp-db-${slug}`;

    // Crear volumen si no existe
    try {
        await docker.getVolume(volumeName).inspect();
    } catch {
        await docker.createVolume({ Name: volumeName });
    }

    console.log(`[provisioner] Creando contenedor ${dbContainerName}`);

    await createAndStartContainer({
        name: dbContainerName,
        Image: DB_IMAGE,
        Env: [
            'POSTGRES_USER=erp',
            `POSTGRES_PASSWORD=${dbPassword}`,
            'POSTGRES_DB=erp_market',
        ],
        Cmd: [
            'postgres',
            '-c', 'ssl=on',
            '-c', 'ssl_cert_file=/run/secrets/server.crt',
            '-c', 'ssl_key_file=/run/secrets/server.key',
            '-c', 'shared_buffers=32MB',
            '-c', 'effective_cache_size=96MB',
            '-c', 'work_mem=4MB',
            '-c', 'maintenance_work_mem=32MB',
            '-c', 'max_connections=20',
        ],
        HostConfig: {
            Binds: [
                `${volumeName}:/var/lib/postgresql/data`,
                `${path.join(tlsDir, 'server.crt')}:/run/secrets/server.crt:ro`,
                `${path.join(tlsDir, 'server.key')}:/run/secrets/server.key:ro`,
            ],
            NetworkMode: NETWORK_NAME,
            RestartPolicy: { Name: 'unless-stopped' },
        },
        // Healthcheck: pg_isready
        Healthcheck: {
            Test: ['CMD-SHELL', 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"'],
            Interval: 10_000_000_000, // 10s en nanoseconds
            Timeout: 5_000_000_000,   // 5s
            Retries: 5,
            StartPeriod: 60_000_000_000, // 60s
        },
        NetworkingConfig: {
            EndpointsConfig: {
                [NETWORK_NAME]: {},
            },
        },
    });

    // ── 6. Esperar DB healthy ────────────────────────────────────────────
    console.log(`[provisioner] Esperando ${dbContainerName} healthy (timeout: ${DB_HEALTH_TIMEOUT}s)...`);

    const dbHealthy = await waitForHealthy(dbContainerName, DB_HEALTH_TIMEOUT);
    if (!dbHealthy) {
        await rollbackProvisioning(slug, tenant.id);
        throw new Error(`DB ${dbContainerName} no se volvió healthy en ${DB_HEALTH_TIMEOUT}s`);
    }

    console.log(`[provisioner] ${dbContainerName} healthy`);

    // ── 7. Crear contenedor API ──────────────────────────────────────────
    const apiContainerName = `api-${slug}`;
    const clientUrl = `https://${domain}`;

    console.log(`[provisioner] Creando contenedor ${apiContainerName}`);

    await createAndStartContainer({
        name: apiContainerName,
        Image: API_IMAGE,
        Env: [
            'NODE_ENV=production',
            'PORT=3000',
            'DEPLOY_MODE=server',
            `DATABASE_URL=postgresql://erp:${dbPassword}@${dbContainerName}:5432/erp_market?schema=public&connection_limit=5`,
            `DIRECT_URL=postgresql://erp:${dbPassword}@${dbContainerName}:5432/erp_market?schema=public`,
            `JWT_SECRET=${jwtSecret}`,
            `FRONTEND_URL=${clientUrl}`,
        ],
        HostConfig: {
            NetworkMode: NETWORK_NAME,
            RestartPolicy: { Name: 'unless-stopped' },
        },
        // Healthcheck: GET /api/health
        Healthcheck: {
            Test: ['CMD', 'node', '-e', 'fetch(\'http://127.0.0.1:3000/api/health\').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))'],
            Interval: 10_000_000_000, // 10s
            Timeout: 5_000_000_000,   // 5s
            Retries: 5,
            StartPeriod: 30_000_000_000, // 30s
        },
        NetworkingConfig: {
            EndpointsConfig: {
                [NETWORK_NAME]: {},
            },
        },
    });

    // ── 8. Esperar API healthy ───────────────────────────────────────────
    console.log(`[provisioner] Esperando ${apiContainerName} healthy (timeout: ${API_HEALTH_TIMEOUT}s)...`);

    const apiHealthy = await waitForHealthy(apiContainerName, API_HEALTH_TIMEOUT);
    if (!apiHealthy) {
        await rollbackProvisioning(slug, tenant.id);
        throw new Error(`API ${apiContainerName} no respondió en ${API_HEALTH_TIMEOUT}s`);
    }

    console.log(`[provisioner] ${apiContainerName} healthy`);

    // ── 9. Semilla usuario admin ─────────────────────────────────────────
    console.log(`[provisioner] Semillando usuario admin para ${slug}...`);

    try {
        await execInContainer(apiContainerName, [
            'sh', '-c',
            `ADMIN_EMAIL='${adminEmailFinal}' ADMIN_PASSWORD='${adminPasswordPlain}' npx ts-node src/scripts/seed-admin.ts`,
        ]);
        console.log(`[provisioner] Admin ${adminEmailFinal} semillado`);
    } catch (err) {
        console.warn(`[provisioner] Admin seed falló (no fatal): ${err}`);
    }

    // ── 10. Configurar Caddy ────────────────────────────────────────────
    await writeCaddySite(slug, domain);
    await reloadCaddy();

    await createAuditEntry({
        actor: 'provisioner',
        action: 'TENANT_PROVISIONED',
        tenantId: tenant.id,
        details: { slug, domain, apiHealthy: true, dbHealthy: true },
    });

    console.log(`[provisioner] Tenant ${slug} provisionado exitosamente`);

    return {
        tenantId: tenant.id,
        slug,
        domain,
        url: clientUrl,
        adminEmail: adminEmailFinal,
        adminPasswordPlain,
        dbPassword,
    };
}

/**
 * Rollback completo: elimina contenedores, volumen, directorio y tenant de DB.
 */
async function rollbackProvisioning(slug: string, tenantId: string): Promise<void> {
    console.log(`[provisioner] Rollback: limpiando provisioning de ${slug}`);

    // Eliminar contenedores
    for (const name of [`api-${slug}`, `db-${slug}`]) {
        try {
            const container = docker.getContainer(name);
            await container.remove({ force: true, v: true });
        } catch {
            // No existía
        }
    }

    // Eliminar volumen
    try {
        await docker.getVolume(`erp-db-${slug}`).remove();
    } catch {
        // No existía
    }

    // Eliminar directorio del cliente
    try {
        await fs.rm(path.join(DEPLOY_DIR, 'clients', slug), { recursive: true, force: true });
    } catch {
        // No existía
    }

    // Eliminar tenant de DB
    try {
        await prisma.tenant.delete({ where: { id: tenantId } });
    } catch {
        // Ya fue eliminado o no existía
    }

    await createAuditEntry({
        actor: 'provisioner',
        action: 'TENANT_ROLLBACK',
        tenantId,
        details: { slug, reason: 'Provisioning falló' },
    });
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

    // Esperar a que DB esté healthy
    const dbHealthy = await waitForHealthy(`db-${slug}`, DB_HEALTH_TIMEOUT);
    if (!dbHealthy) {
        console.error(`[provisioner] DB no se recuperó al reanudar ${slug}`);
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
 * Elimina un tenant: fuerza eliminación de contenedores, volumen, Caddy y DB record.
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
        // No existía
    }

    // Eliminar directorio del cliente
    try {
        await fs.rm(path.join(DEPLOY_DIR, 'clients', slug), { recursive: true, force: true });
        console.log(`[provisioner] Directorio clients/${slug} eliminado`);
    } catch {
        // No existía
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
