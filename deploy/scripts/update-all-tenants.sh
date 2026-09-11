#!/usr/bin/env bash
# update-all-tenants.sh — Reconstruye la imagen y actualiza todos los tenants existentes.
# No toca las bases de datos (volumenes persistentes).
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CLIENTS_DIR="$ROOT/deploy/clients"

echo "═══════════════════════════════════════════════════════════"
echo "  Actualizando todos los tenants"
echo "═══════════════════════════════════════════════════════════"

# 1. Actualizar repo
echo "▶ Actualizando repo..."
cd "$ROOT"
git pull origin master

# 2. Reconstruir imagen
echo "▶ Reconstruyendo erp-market:latest..."
cd "$ROOT"
docker buildx build -t erp-market:latest -f backend/Dockerfile . --load

# 3. Actualizar cada tenant
COUNT=0
for CLIENT_DIR in "$CLIENTS_DIR"/*/; do
    [[ -d "$CLIENT_DIR" ]] || continue
    SLUG="$(basename "$CLIENT_DIR")"
    [[ -f "$CLIENT_DIR/docker-compose.yml" ]] || continue

    echo "▶ Actualizando tenant: $SLUG"
    # Normalizar build context: el management server puede haber dejado
    # 'context: /repo' (path del contenedor) horneado en el compose.
    # Desde el host, el repo está en /opt/erp-market.
    sed -i "s|context: /repo|context: /opt/erp-market|g" "$CLIENT_DIR/docker-compose.yml"
    docker compose -f "$CLIENT_DIR/docker-compose.yml" up -d --build api 2>&1 | sed 's/^/  /'
    COUNT=$((COUNT + 1))
done

# 4. Actualizar management server
echo "▶ Actualizando management server..."
cd "$ROOT/management"
docker compose up -d --build 2>&1 | sed 's/^/  /'

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  ✅ $COUNT tenants + management server actualizados"
echo "═══════════════════════════════════════════════════════════"
