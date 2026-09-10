#!/usr/bin/env bash
# add-to-dashboard.sh — Registra un tenant existente en el dashboard del management server.
# Uso: ./add-to-dashboard.sh <slug> [email]
# Ejemplo: ./add-to-dashboard.sh test admin@test.local
#
# Esto NO crea containers — solo registra el tenant en la DB del management server
# para que aparezca en el dashboard. El provisioning real lo hace add-client.sh.
set -Eeuo pipefail

SLUG="${1:-}"
EMAIL="${2:-admin@${SLUG:-localhost}.local}"

[[ -n "$SLUG" ]] || { echo "ERROR: usage: add-to-dashboard.sh <slug> [email]" >&2; exit 1; }

# Obtener dominio del .env del cliente
ENV_FILE="/opt/erp-market/deploy/clients/$SLUG/.env"
if [[ -f "$ENV_FILE" ]]; then
    DOMAIN="$(sed -n 's/^CLIENT_DOMAIN=//p' "$ENV_FILE" | head -1)"
else
    DOMAIN="$SLUG.89.167.46.144.sslip.io"
fi

echo "Registrando tenant '$SLUG' en el dashboard..."

docker exec mgmt-api node -e "
const { PrismaClient } = require('@prisma/client');
async function main() {
    const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });
    await prisma.tenant.upsert({
        where: { slug: '$SLUG' },
        update: { domain: '$DOMAIN', status: 'ACTIVE' },
        create: {
            slug: '$SLUG',
            domain: '$DOMAIN',
            url: 'https://$DOMAIN',
            status: 'ACTIVE',
            plan: 'free',
            adminEmail: '$EMAIL'
        }
    });
    console.log('✅ Tenant registrado: $SLUG ($DOMAIN)');
    await prisma.\$disconnect();
}
main();
" 2>&1

echo ""
echo "Dashboard: https://mgmt.89.167.46.144.sslip.io"
echo "Tenant URL: https://$DOMAIN"
