import { PrismaClient } from '@prisma/client';

// =============================================================================
// DUAL PRISMA CONFIG — ERP-MARKET
//
// prismaCloud → Neon (PostgreSQL) — SIEMPRE disponible
//   Usado por: dashboard, users, auth (fallback online)
//
// getLocalPrisma() → SQLite local — SOLO en modo Electron
//   Usado por: pos, inventory, cashFlow, auditLog (offline-first)
//   Inicialización lazy: solo se activa cuando se llama por primera vez.
//   El env ELECTRON=true y LOCAL_DATABASE_URL son seteados por el Main Process
//   ANTES de que llegue cualquier request HTTP.
// =============================================================================

// ── Cloud Client (Neon) ──────────────────────────────────────────────────────
const globalForPrisma = globalThis as unknown as { prismaCloud: PrismaClient };

export const prismaCloud =
    globalForPrisma.prismaCloud ||
    new PrismaClient({
        log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prismaCloud = prismaCloud;

// ── Local Client (SQLite) — Lazy ────────────────────────────────────────────
// Se inicializa en la primera llamada a getLocalPrisma()
// Requiere que antes se haya ejecutado:
//   prisma generate --schema=prisma/schema.local.prisma
/* eslint-disable @typescript-eslint/no-explicit-any */
let _prismaLocal: any = null;

export const getLocalPrisma = (): any => {
    if (!_prismaLocal) {
        try {
            // El output del schema.local.prisma apunta a node_modules/.prisma/client-local
            // Relative path desde backend/src/config/ → backend/node_modules/.prisma/client-local
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const { PrismaClient: LocalClient } = require('../../node_modules/.prisma/client-local');
            _prismaLocal = new LocalClient({
                datasources: {
                    db: { url: process.env.LOCAL_DATABASE_URL || 'file:./erp-market.db' },
                },
                log: process.env.NODE_ENV === 'development' ? ['error'] : ['error'],
            });
        } catch {
            throw new Error(
                '[ERP-Market] Local Prisma client not found.\n' +
                'Run: pnpm --filter erp-market-backend db:generate:local'
            );
        }
    }
    return _prismaLocal;
};

// ── Default Export (Proxy pattern — lazy) ───────────────────────────────────
// El getter se evalúa en la PRIMERA lectura de la propiedad, no al importar.
// Garantiza que process.env.ELECTRON ya esté seteado cuando se accede.
//
// En Electron  (process.env.ELECTRON = 'true') → SQLite local
// En dev/cloud (sin ELECTRON)                  → Neon PostgreSQL
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
    get(_target, prop: string) {
        const db: PrismaClient =
            process.env.ELECTRON === 'true' ? getLocalPrisma() : prismaCloud;
        const value = (db as any)[prop];
        return typeof value === 'function' ? value.bind(db) : value;
    },
});
