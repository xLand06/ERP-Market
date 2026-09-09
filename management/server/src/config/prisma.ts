import { PrismaClient } from '@prisma/client';
import { env } from './env';

// Instancia global de Prisma para el server de gestión
export const prisma = new PrismaClient({
    datasources: {
        db: {
            url: env.DATABASE_URL,
        },
    },
});

// Graceful shutdown
process.on('beforeExit', async () => {
    await prisma.$disconnect();
});
