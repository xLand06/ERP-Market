#!/usr/bin/env bash
#
# setup.sh — Setup Management Server en el VPS.
# Ejecutar desde /opt/erp-market/management/
#
set -Eeuo pipefail

echo "═══════════════════════════════════════════════════════════"
echo "  ERP-Market Management Server Setup"
echo "═══════════════════════════════════════════════════════════"

# 1. Generar secrets
DB_PASS=$(openssl rand -hex 16)
JWT_SECRET=$(openssl rand -hex 24)

# 2. Crear .env
cat > .env << EOF
PORT=3001
JWT_SECRET=$JWT_SECRET
DATABASE_URL=postgresql://mgmt:$DB_PASS@mgmt-db:5432/mgmt
DOCKER_SOCKET=/var/run/docker.sock
NODE_ENV=production
MGMT_DB_PASSWORD=$DB_PASS
CADDY_EMAIL=admin@example.com
EOF

echo "✅ .env creado con secrets generados"

# 3. Build + Start
docker compose build --no-cache
docker compose up -d

# 4. Esperar a que el API esté listo
echo "⏳ Esperando a que mgmt-api esté listo..."
for i in $(seq 1 30); do
    if docker exec mgmt-api node -e "fetch('http://127.0.0.1:3001/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" 2>/dev/null; then
        echo "✅ mgmt-api listo"
        break
    fi
    sleep 2
done

# 5. Migrar DB (db push crea tablas directamente, no necesita archivos de migración)
docker exec mgmt-api ./node_modules/.bin/prisma db push --schema prisma/schema.prisma
echo "✅ Base de datos sincronizada"

# 6. Crear operador admin
docker exec mgmt-api node -e "
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
async function main() {
    const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });
    const hash = await bcrypt.hash('admin123', 10);
    await prisma.operator.upsert({
        where: { username: 'admin' },
        update: {},
        create: { username: 'admin', password: hash, role: 'OWNER' }
    });
    console.log('✅ Operador creado: admin / admin123');
    await prisma.\$disconnect();
}
main();
" 2>&1 || echo "⚠️ Operador ya existe o schema diferente — crealo manualmente desde el dashboard"

# 7. Caddy
cat > /opt/erp-market/deploy/caddy/sites/mgmt.caddy << 'CADDYEOF'
mgmt.allcode.site {
    reverse_proxy mgmt-api:3001
}
CADDYEOF

docker compose -f /opt/erp-market/deploy/docker-compose.yml exec caddy caddy reload --config /etc/caddy/Caddyfile 2>/dev/null && echo "✅ Caddy configurado" || echo "⚠️ Caddy no está corriendo — configurá manualmente"

# 8. Resumen
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  ✅ MANAGEMENT SERVER LISTO"
echo "═══════════════════════════════════════════════════════════"
echo "  Dashboard: https://mgmt.allcode.site"
echo "  Login:     admin / admin123"
echo "═══════════════════════════════════════════════════════════"
