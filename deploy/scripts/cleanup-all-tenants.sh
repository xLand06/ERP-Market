#!/usr/bin/env bash
# cleanup-all-tenants.sh — Elimina TODOS los tenants (containers, volumes, archivos, DB management).
# PELIGRO: borra todo. Se pide confirmación con el texto exacto "BORRAR TODO".
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CLIENTS_DIR="$ROOT/deploy/clients"

echo "═══════════════════════════════════════════════════════════"
echo "  LIMPIEZA TOTAL DE TENANTS"
echo "═══════════════════════════════════════════════════════════"
echo "Esto eliminará:"
echo "  - Todos los containers (api-*, db-*)"
echo "  - Todos los volumenes (erp-db-*)"
echo "  - Todos los directorios deploy/clients/<slug>/"
echo "  - Todos los sites de Caddy"
echo "  - Todos los registros de la DB del management server"
echo ""
echo "Para confirmar, escribi exactamente: BORRAR TODO"
read -r CONFIRM
if [[ "$CONFIRM" != "BORRAR TODO" ]]; then
    echo "Cancelado."
    exit 0
fi

# 1. Eliminar cada cliente con remove-client.sh
for CLIENT_DIR in "$CLIENTS_DIR"/*/; do
    [[ -d "$CLIENT_DIR" ]] || continue
    SLUG="$(basename "$CLIENT_DIR")"
    [[ -f "$CLIENT_DIR/docker-compose.yml" ]] || continue
    echo "▶ Eliminando tenant: $SLUG"
    "$ROOT/deploy/scripts/remove-client.sh" "$SLUG" < <(echo "$SLUG") 2>&1 | sed 's/^/  /' || true
done

# 2. Limpiar registros de la DB del management server
echo "▶ Limpiando DB del management server..."
if docker ps --format '{{.Names}}' | grep -q '^mgmt-api$'; then
    docker exec mgmt-api node -e "
const { PrismaClient } = require('@prisma/client');
async function main() {
    const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });
    await prisma.tenant.deleteMany({});
    await prisma.healthCheck.deleteMany({});
    await prisma.payment.deleteMany({});
    await prisma.auditLog.deleteMany({});
    console.log('DB management limpia');
    await prisma.\$disconnect();
}
main();
" 2>&1 | sed 's/^/  /' || echo "  (no se pudo limpiar DB management)"
else
    echo "  mgmt-api no está corriendo — saltando"
fi

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  ✅ Limpieza completada"
echo "═══════════════════════════════════════════════════════════"