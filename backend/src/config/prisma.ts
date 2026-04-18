import '../config/env';
import { PrismaClient } from '@prisma/client';
import { PrismaClient as PrismaClientLocal } from '.prisma/client-local';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import { Pool } from 'pg';
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
        const pool = new Pool({ connectionString });
        const client = new PrismaClient({
            adapter: new PrismaPg(pool),
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
        const localUrl = process.env.LOCAL_DATABASE_URL || 'file:./erp-market.db';
        _prismaLocal = new PrismaClientLocal({
            adapter: new PrismaLibSql({ url: localUrl }),
            log: ['error'],
        }) as unknown as PrismaClient;
        logger.info('[DB] Cliente local SQLite inicializado', { url: localUrl });
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