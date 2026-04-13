import '../config/env';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import { logger } from '../core/utils/logger';

// =============================================================================
// DUAL PRISMA CONFIG — ERP-MARKET (Prisma 7.x + Supabase/SQLite)
// =============================================================================

const globalForPrisma = globalThis as unknown as { prismaCloud: PrismaClient; prismaLocal: PrismaClient };

function createCloudClient(): PrismaClient {
    const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
    
    if (!connectionString) {
        logger.error('No database URL configured');
        throw new Error('DATABASE_URL or DIRECT_URL must be configured');
    }
    
    // Ensure connection string is properly formatted
    const cleanConnectionString = connectionString.trim();
    
    logger.info('Connecting to database...', { 
        host: cleanConnectionString.split('@')[1]?.split('/')[0] || 'unknown' 
    });
    
    return new PrismaClient({
        adapter: new PrismaPg({
            connectionString: cleanConnectionString,
        }),
        log: process.env.NODE_ENV === 'development' ? ['error', 'warn', 'query'] : ['error'],
    });
}

// ── Cloud Client (Supabase PostgreSQL) ────────────────────────────────────────
let _prismaCloud: PrismaClient | null = globalForPrisma.prismaCloud || null;

const getCloudPrisma = (): PrismaClient => {
    if (!_prismaCloud) {
        _prismaCloud = createCloudClient();
        if (process.env.NODE_ENV !== 'production') globalForPrisma.prismaCloud = _prismaCloud;
    }
    return _prismaCloud;
};

export const prismaCloud: PrismaClient = new Proxy({} as PrismaClient, {
    get(_target, prop: string) {
        const db = getCloudPrisma();
        const value = (db as any)[prop];
        return typeof value === 'function' ? value.bind(db) : value;
    },
});

// ── Local Client (SQLite) — Lazy ────────────────────────────────────────────────
let _prismaLocal: PrismaClient | null = null;

export const getLocalPrisma = (): PrismaClient => {
    if (!_prismaLocal) {
        const localUrl = process.env.LOCAL_DATABASE_URL || 'file:./erp-market.db';
        _prismaLocal = new PrismaClient({
            adapter: new PrismaLibSql({
                url: localUrl,
            }),
            log: process.env.NODE_ENV === 'development' ? ['error'] : ['error'],
        });
    }
    return _prismaLocal;
};

// ── Default Export (Proxy pattern — lazy) ───────────────────────────────────
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
    get(_target, prop: string) {
        const useLocal = process.env.USE_LOCAL_DB === 'true' || process.env.ELECTRON === 'true';
        const db: PrismaClient = useLocal ? getLocalPrisma() : getCloudPrisma();
        const value = (db as any)[prop];
        return typeof value === 'function' ? value.bind(db) : value;
    },
});