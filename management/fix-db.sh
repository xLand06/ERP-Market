#!/usr/bin/env bash
# fix-db.sh — Sincronizar DB + crear operador admin
# Ejecutar desde /opt/erp-market/management/
set -Eeuo pipefail

echo "🔄 Sincronizando schema de Prisma..."
docker exec mgmt-api ./node_modules/.bin/prisma db push --schema prisma/schema.prisma

echo "🔄 Creando operador admin..."
docker exec mgmt-api node -e "
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
async function main() {
    const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });
    const hash = await bcrypt.hash('admin123', 10);
    try {
        await prisma.operator.upsert({
            where: { username: 'admin' },
            update: {},
            create: { username: 'admin', password: hash, role: 'OWNER' }
        });
        console.log('✅ Operador creado: admin / admin123');
    } catch (e) {
        console.log('⚠️ ' + e.message);
    }
    await prisma.\$disconnect();
}
main();
"

echo ""
echo "✅ Listo — refrescá el dashboard"
