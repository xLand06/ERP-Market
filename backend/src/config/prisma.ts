import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

// =============================================================================
// DUAL PRISMA CONFIG — ERP-MARKET (Prisma 7.x + Supabase/SQLite)
// =============================================================================

const globalForPrisma = globalThis as unknown as { prismaCloud: PrismaClient; prismaLocal: PrismaClient };

// ── Cloud Client (Supabase PostgreSQL) ────────────────────────────────────────
export const prismaCloud =
    globalForPrisma.prismaCloud ||
    new PrismaClient({
        adapter: new PrismaPg({
            connectionString: process.env.DATABASE_URL!,
        }),
        log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prismaCloud = prismaCloud;

// ── Local Client (SQLite) — Lazy ────────────────────────────────────────────
let _prismaLocal: PrismaClient | null = null;

export const getLocalPrisma = (): PrismaClient => {
    if (!_prismaLocal) {
        _prismaLocal = new PrismaClient({
            adapter: new PrismaBetterSqlite3({
                url: process.env.LOCAL_DATABASE_URL || 'file:./erp-market.db',
            }),
            log: process.env.NODE_ENV === 'development' ? ['error'] : ['error'],
        });
    }
    return _prismaLocal;
};

// ── Default Export (Proxy pattern — lazy) ───────────────────────────────────
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
    get(_target, prop: string) {
        const db: PrismaClient =
            process.env.ELECTRON === 'true' ? getLocalPrisma() : prismaCloud;
        const value = (db as any)[prop];
        return typeof value === 'function' ? value.bind(db) : value;
    },
});