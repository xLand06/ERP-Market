#!/usr/bin/env bash
# sync-all-tenants.sh — Escanea todos los clientes existentes y los registra en el dashboard.
set -Eeuo pipefail

CLIENTS_DIR="/opt/erp-market/deploy/clients"

echo "═══════════════════════════════════════════════════════════"
echo "  Sincronizando tenants existentes con el dashboard"
echo "═══════════════════════════════════════════════════════════"

if [[ ! -d "$CLIENTS_DIR" ]]; then
    echo "No hay directorio de clientes: $CLIENTS_DIR"
    exit 0
fi

COUNT=0
for CLIENT_DIR in "$CLIENTS_DIR"/*/; do
    [[ -d "$CLIENT_DIR" ]] || continue
    SLUG="$(basename "$CLIENT_DIR")"

    # Saltar si no tiene docker-compose.yml (carpeta incompleta)
    [[ -f "$CLIENT_DIR/docker-compose.yml" ]] || continue

    # Obtener dominio del .env
    ENV_FILE="$CLIENT_DIR/.env"
    if [[ -f "$ENV_FILE" ]]; then
        DOMAIN="$(sed -n 's/^CLIENT_DOMAIN=//p' "$ENV_FILE" | head -1)"
        EMAIL="$(sed -n 's/^ADMIN_EMAIL=//p' "$ENV_FILE" | head -1)"
    else
        DOMAIN="$SLUG.89.167.46.144.sslip.io"
        EMAIL="admin@$SLUG.local"
    fi

    # Verificar si el container está corriendo
    STATUS="ACTIVE"
    if docker ps --format '{{.Names}}' | grep -q "api-$SLUG"; then
        STATUS="ACTIVE"
    elif docker ps -a --format '{{.Names}}' | grep -q "api-$SLUG"; then
        STATUS="SUSPENDED"
    else
        STATUS="DELETED"
    fi

    # Registrar en dashboard
    docker exec mgmt-api node -e "
const { PrismaClient } = require('@prisma/client');
async function main() {
    const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });
    await prisma.tenant.upsert({
        where: { slug: '$SLUG' },
        update: { domain: '$DOMAIN', status: '$STATUS' },
        create: {
            slug: '$SLUG',
            domain: '$DOMAIN',
            url: 'https://$DOMAIN',
            status: '$STATUS',
            plan: 'free',
            adminEmail: '$EMAIL'
        }
    });
    console.log('✅ $SLUG ($STATUS)');
    await prisma.\$disconnect();
}
main();
" 2>&1

    COUNT=$((COUNT + 1))
done

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  $COUNT tenants sincronizados"
echo "═══════════════════════════════════════════════════════════"
