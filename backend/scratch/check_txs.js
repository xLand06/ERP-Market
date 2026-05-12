const { PrismaClient } = require('@prisma/client');
const { PrismaLibSql } = require('@prisma/adapter-libsql');
const path = require('path');

async function main() {
    const dbPath = path.resolve(__dirname, '../erp-market.db');
    const prisma = new PrismaClient({
        adapter: new PrismaLibSql({ url: `file:${dbPath}` })
    });

    try {
        const txs = await prisma.transaction.findMany({
            take: 5,
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                createdAt: true,
                total: true,
                type: true
            }
        });
        console.log(JSON.stringify({
            now: new Date().toISOString(),
            localNow: new Date().toString(),
            transactions: txs
        }, null, 2));
    } finally {
        await prisma.$disconnect();
    }
}

main().catch(console.error);
