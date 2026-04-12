import { defineConfig } from 'prisma/config';
import { PrismaNeon } from '@prisma/adapter-neon';

// prisma.config.ts — Configuración para el cliente Cloud (Neon PostgreSQL)
// El cliente local (SQLite) usa su propio schema.local.prisma

export default defineConfig({
    earlyAccess: true,
    schema: './prisma/schema.prisma',
    datasource: {
        url: process.env.DATABASE_URL,
    },
});
