import { prisma } from '../../config/prisma';
import { inspectContainer, getContainerStats } from '../../services/docker';

// Dockerode para exec en contenedores (reemplaza child_process.execSync)
import Dockerode from 'dockerode';
import fs from 'fs/promises';
import path from 'path';
import { env } from '../../config/env';

const docker = new Dockerode({ socketPath: env.DOCKER_SOCKET });

/**
 * Servicio de health checks para tenants.
 * Verifica estado de contenedor, API y DB de cada tenant.
 * Usa dockerode API para todo (sin shelling out a bash).
 */

export interface HealthResult {
    tenantId: string;
    slug: string;
    apiHealthy: boolean;
    dbHealthy: boolean;
    containerUp: boolean;
    memoryMb: number | null;
}

/**
 * Obtiene el último health check de cada tenant activo.
 */
export async function getLatestHealthForAll() {
    const tenants = await prisma.tenant.findMany({
        where: { status: 'ACTIVE' },
        select: {
            id: true,
            slug: true,
            domain: true,
            status: true,
            // usado como corte de cooldown en shouldAutoSuspend (FIX #8)
            updatedAt: true,
            healthChecks: {
                orderBy: { checkedAt: 'desc' },
                take: 1,
            },
        },
    });

    return tenants.map((t) => ({
        tenantId: t.id,
        slug: t.slug,
        domain: t.domain,
        status: t.status,
        updatedAt: t.updatedAt,
        lastCheck: t.healthChecks[0] || null,
    }));
}

/**
 * Obtiene historial de health checks de un tenant.
 */
export async function getHealthHistory(slug: string, limit: number = 20) {
    const tenant = await prisma.tenant.findUnique({
        where: { slug },
        select: {
            id: true,
            slug: true,
            domain: true,
            status: true,
            healthChecks: {
                orderBy: { checkedAt: 'desc' },
                take: limit,
            },
        },
    });

    if (!tenant) {
        return null;
    }

    return tenant;
}

/**
 * Ejecuta un comando dentro de un contenedor usando la API de dockerode.
 * Retorna el exit code (0 = éxito).
 */
async function execInContainer(containerName: string, cmd: string[]): Promise<number> {
    const container = docker.getContainer(containerName);

    const exec = await container.exec({
        Cmd: cmd,
        AttachStdout: false,
        AttachStderr: false,
    });

    return new Promise((resolve, reject) => {
        exec.start({ Tty: false }, (err, stream) => {
            if (err) {
                reject(err);
                return;
            }

            if (!stream) {
                reject(new Error('No se obtuvo stream del exec'));
                return;
            }

            docker.modem.followProgress(
                stream,
                (err: Error | null, output: any[]) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    // El exit code viene del inspect del exec
                    exec.inspect((inspectErr, info) => {
                        if (inspectErr) {
                            reject(inspectErr);
                            return;
                        }
                        resolve(info?.ExitCode ?? 0);
                    });
                },
                () => {}
            );
        });
    });
}

/**
 * Credenciales de la DB de un tenant, leidas de su archivo .env generado por
 * add-client.sh (<DEPLOY_DIR>/clients/<slug>/.env).
 *
 * FIX #12: antes se hardcodeaban `-U erp -d erp_market`, lo que hacia fallar el
 * pg_isready de todo tenant cuyo DB_USER/DB_NAME difiera de esos defaults.
 * Si el .env no existe o el valor no es un identificador seguro, se cae a los
 * defaults históricos (o a TENANT_DB_USER / TENANT_DB_NAME de configuración).
 */
const SAFE_IDENTIFIER = /^[a-zA-Z0-9_-]+$/;
const DEPLOY_DIR = process.env.DEPLOY_DIR || '/repo/deploy';

async function readTenantDbCredentials(slug: string): Promise<{ user: string; database: string }> {
    let user = process.env.TENANT_DB_USER || 'erp';
    let database = process.env.TENANT_DB_NAME || 'erp_market';

    try {
        const content = await fs.readFile(path.join(DEPLOY_DIR, 'clients', slug, '.env'), 'utf-8');
        for (const line of content.split('\n')) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;
            const eqIdx = trimmed.indexOf('=');
            if (eqIdx === -1) continue;
            const key = trimmed.slice(0, eqIdx).trim();
            const value = trimmed.slice(eqIdx + 1).trim();

            // Solo se aceptan valores seguros (nada de shelling/inyección accidental)
            if (key === 'DB_USER' && SAFE_IDENTIFIER.test(value)) user = value;
            if (key === 'DB_NAME' && SAFE_IDENTIFIER.test(value)) database = value;
        }
    } catch {
        // Sin .env (tenant recién dado de baja o path no montado) → defaults
    }

    return { user, database };
}

/**
 * Realiza health check de un tenant específico.
 * Verifica: contenedor, API, DB, memoria.
 * Usa dockerode para todo — sin shelling out a bash.
 */
export async function checkTenantHealth(tenantId: string, slug: string): Promise<HealthResult> {
    const result: HealthResult = {
        tenantId,
        slug,
        apiHealthy: false,
        dbHealthy: false,
        containerUp: false,
        memoryMb: null,
    };

    try {
        // Verificar contenedor del API
        const containerName = `api-${slug}`;
        const containerInfo = await inspectContainer(containerName).catch(() => null);

        if (containerInfo && containerInfo.State.Running) {
            result.containerUp = true;

            // Obtener métricas de memoria
            try {
                const stats = await getContainerStats(containerInfo.Id);
                result.memoryMb = Math.round(stats.memoryUsage / (1024 * 1024));
            } catch {
                // Stats no disponibles, no es crítico
            }

            // Verificar API health
            try {
                const response = await fetch(`http://${containerName}:3000/api/health`, {
                    signal: AbortSignal.timeout(5000),
                });
                result.apiHealthy = response.ok;
            } catch {
                result.apiHealthy = false;
            }
        }

        // Verificar DB — usa dockerode exec en vez de execSync
        const dbName = `db-${slug}`;
        try {
            const dbContainer = await inspectContainer(dbName).catch(() => null);
            if (dbContainer && dbContainer.State.Running) {
                // pg_isready via dockerode API (sin child_process)
                // FIX #12: user/db salen del .env del tenant, no de valores hardcodeados
                const { user, database } = await readTenantDbCredentials(slug);
                const exitCode = await execInContainer(dbName, [
                    'pg_isready', '-U', user, '-d', database,
                ]);
                result.dbHealthy = exitCode === 0;
            }
        } catch {
            result.dbHealthy = false;
        }
    } catch (error) {
        console.error(`[health] Error checking tenant ${slug}:`, error);
    }

    return result;
}

/**
 * Registra resultado de health check en la base de datos.
 */
export async function recordHealthCheck(result: HealthResult) {
    return prisma.healthCheck.create({
        data: {
            tenantId: result.tenantId,
            apiHealthy: result.apiHealthy,
            dbHealthy: result.dbHealthy,
            containerUp: result.containerUp,
            memoryMb: result.memoryMb,
        },
    });
}

/**
 * Verifica si un tenant tiene 3+ health checks consecutivos fallidos.
 * Retorna true si debe ser suspendido.
 *
 * FIX #8: `resumeCooldown` (opcional) descarta los health checks anteriores a esa
 * fecha. Sin este corte, después de un suspend/resume seguían contándose los
 * registros fallidos viejos → el tenant se volvía a suspender de inmediato.
 * El health-cron pasa el `updatedAt` del tenant (equivalente al último cambio de
 * estado) como corte.
 */
export async function shouldAutoSuspend(tenantId: string, resumeCooldown?: Date): Promise<boolean> {
    const recentChecks = await prisma.healthCheck.findMany({
        where: {
            tenantId,
            // Solo se consideran checks posteriores al resume
            ...(resumeCooldown ? { checkedAt: { gte: resumeCooldown } } : {}),
        },
        orderBy: { checkedAt: 'desc' },
        take: 3,
    });

    if (recentChecks.length < 3) {
        return false;
    }

    return recentChecks.every(
        (check) => !check.apiHealthy || !check.dbHealthy || !check.containerUp
    );
}
