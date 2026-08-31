import '../config/env';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { PrismaClient as PrismaClientLocal } from '.prisma/client-local';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { logger } from '../core/utils/logger';

// =============================================================================
// DUAL PRISMA CONFIG — ERP-MARKET (Prisma 7.x + Supabase/SQLite)
// Cloud client es NULLABLE — si no hay DATABASE_URL en modo Electron,
// el sistema sigue funcionando 100% en local sin crashear.
// =============================================================================

const globalForPrisma = globalThis as unknown as {
    prismaCloud: PrismaClient | null;
    prismaLocal: PrismaClient | null;
};

// ── Cloud Client (Supabase PostgreSQL) ────────────────────────────────────────
let _prismaCloud: PrismaClient | null = null;
let _cloudInitialized = false;

/**
 * Intenta crear el cliente de nube.
 * Retorna null en lugar de lanzar si no hay URL configurada (modo Electron/offline).
 */
function tryCreateCloudClient(): PrismaClient | null {
    const connectionString = (process.env.DIRECT_URL || process.env.DATABASE_URL)?.trim();

    if (!connectionString) {
        // En modo Electron esto es esperado — no es un error crítico
        if (process.env.ELECTRON === 'true' || process.env.USE_LOCAL_DB === 'true') {
            logger.info('[DB] Sin URL de nube — operando en modo offline local');
        } else {
            logger.warn('[DB] No hay DATABASE_URL configurada');
        }
        return null;
    }

    try {
        // ── MONKEY-PATCH DE SEGURIDAD PARA ELECTRON ──────────────────────────
        // Interceptamos el método interno de 'pg' para asegurar que NUNCA se pase
        // un objeto a la función addCString, lo cual causa el crash en el .exe.
        try {
            const pg = require('pg');
            if (pg.Connection && pg.Connection.prototype && ! (pg.Connection.prototype as any)._isPatched) {
                const originalStartup = pg.Connection.prototype.startup;
                pg.Connection.prototype.startup = function(config: any) {
                    const cleanConfig: any = {};
                    for (const key in config) {
                        // Solo permitir valores que se puedan convertir a string de forma segura
                        // y que NO sean objetos (excepto si son null/undefined que pg maneja)
                        if (config[key] !== null && config[key] !== undefined) {
                            if (typeof config[key] !== 'object') {
                                cleanConfig[key] = String(config[key]);
                            }
                            // Si es un objeto, lo ignoramos para el startup packet (como el objeto ssl)
                        }
                    }
                    return originalStartup.call(this, cleanConfig);
                };
                (pg.Connection.prototype as any)._isPatched = true;
                logger.info('[DB] Parche de seguridad pg.Connection aplicado');
            }
        } catch (patchErr: any) {
            logger.warn('[DB] No se pudo aplicar el parche de seguridad pg', { error: patchErr });
        }

        if (connectionString) {
            process.env.DATABASE_URL = connectionString;
        }

        // 1. Limpiar variables de entorno problemáticas (blindaje total)
        const pgEnvVars = [
            'PGUSER', 'PGDATABASE', 'PGPASSWORD', 'PGPORT', 'PGHOST', 
            'PGAPPNAME', 'PGCLIENTENCODING', 'PGOPTIONS', 'USER', 'USERNAME'
        ];
        pgEnvVars.forEach(v => {
            const val = process.env[v];
            if (val !== undefined && typeof val !== 'string') {
                delete process.env[v];
            }
        });

        // 2. Parseo ultra-seguro para evitar ERR_INVALID_ARG_TYPE en Electron
        const { parse: parsePgUrl } = require('pg-connection-string');
        const parsedUrl = parsePgUrl(connectionString);
        
        const safeConfig: any = {
            ssl: { rejectUnauthorized: false },
            connectionTimeoutMillis: 5000,
            idleTimeoutMillis: 10000,
            max: 5,
            // Forzar parámetros que pg usa en el startup packet para que sean strings
            application_name: 'erp-market-desktop',
            client_encoding: 'UTF8'
        };

        // Extraer solo propiedades escalares seguras y forzarlas a string
        const safeKeys = ['user', 'password', 'host', 'port', 'database'];
        for (const key of safeKeys) {
            if (parsedUrl[key] !== undefined && parsedUrl[key] !== null) {
                safeConfig[key] = String(parsedUrl[key]);
            }
        }

        // Crear el pool sin pasar connectionString directamente (evita re-parseo interno)
        const pool = new Pool(safeConfig);

        // Capturar errores de conexión del pool para que no crasheen la app
        pool.on('error', (err) => {
            logger.warn('[DB] Pool error (no crítico)', { error: err.message });
        });

        const adapter = new PrismaPg(pool);

        const client = new PrismaClient({
            adapter,
            log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
        });
        logger.info('[DB] Cliente cloud inicializado', {
            host: connectionString.split('@')[1]?.split('/')[0] || 'unknown',
        });
        return client;
    } catch (err: any) {
        logger.error('[DB] Error al crear cliente cloud:', err.message);
        return null;
    }
}

/**
 * Retorna el cliente cloud o null si no está disponible.
 * SIEMPRE verificar `=== null` antes de usar en lógica de sync.
 */
export function getCloudPrisma(): PrismaClient | null {
    if (!_cloudInitialized) {
        _prismaCloud = tryCreateCloudClient();
        _cloudInitialized = true;
        if (process.env.NODE_ENV !== 'production' && _prismaCloud) {
            globalForPrisma.prismaCloud = _prismaCloud;
        }
    }
    return _prismaCloud;
}

/**
 * Retrocompatibilidad: acceso directo al cloud.
 * ADVERTENCIA: lanzará si no está disponible — usar solo cuando cloud es requerido.
 */
export const prismaCloud = new Proxy({} as PrismaClient, {
    get(_target, prop: string) {
        const db = getCloudPrisma();
        if (!db) throw new Error('[DB] Cloud no disponible (modo offline)');
        const value = (db as any)[prop];
        return typeof value === 'function' ? value.bind(db) : value;
    },
});

// ── Local Client (SQLite) — Lazy ─────────────────────────────────────────────
let _prismaLocal: PrismaClient | null = null;

export const getLocalPrisma = (): PrismaClient => {
    if (!_prismaLocal) {
        // Usar la raíz del backend (donde suele estar el .db)
        // __dirname es backend/src/config
        const dbPath = path.resolve(__dirname, '../../erp-market.db');
        
        // Forzar ruta absoluta si es un path relativo de SQLite
        let localUrl = process.env.LOCAL_DATABASE_URL || `file:${dbPath}`;
        if (localUrl.startsWith('file:./')) {
            const relativePath = localUrl.replace('file:./', '');
            localUrl = `file:${path.resolve(__dirname, '../../', relativePath)}`;
        }

        _prismaLocal = new PrismaClientLocal({
            adapter: new PrismaLibSql({ url: localUrl }),
            log: ['error'],
        }) as unknown as PrismaClient;

        // Optimizar SQLite (WAL mode, synchronous = NORMAL, cache_size = 2000)
        Promise.all([
            _prismaLocal.$executeRawUnsafe('PRAGMA journal_mode = WAL;'),
            _prismaLocal.$executeRawUnsafe('PRAGMA synchronous = NORMAL;'),
            _prismaLocal.$executeRawUnsafe('PRAGMA cache_size = -2000;')
        ]).then(() => {
            logger.info('[DB] Optimizaciones de SQLite aplicadas (WAL, synchronous=NORMAL, cache=2MB)');
        }).catch(err => {
            logger.error('[DB] Error al aplicar optimizaciones de SQLite:', err);
        });

        logger.info('[DB] Cliente local SQLite inicializado', { url: localUrl, absolutePath: dbPath });
    }
    return _prismaLocal;
};

// ── Export Principal (SIEMPRE SQLite para sistema híbrido) ────────────────────
// El sistema híbrido escribe SIEMPRE a SQLite local.
// Supabase (getCloudPrisma) solo se usa para operaciones de sync.
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
    get(_target, prop: string) {
        // SIEMPRE usar SQLite como base de datos principal
        // para sistema híbrido offline-first
        const db: PrismaClient = getLocalPrisma();
        const value = (db as any)[prop];
        return typeof value === 'function' ? value.bind(db) : value;
    },
});