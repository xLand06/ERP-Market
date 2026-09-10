#!/usr/bin/env bash
# debug-db.sh — Debug PostgreSQL container health check
set -Eeuo pipefail

echo "=== Creando container PostgreSQL de prueba ==="
docker run -d --name db-debug \
  -e POSTGRES_USER=erp \
  -e POSTGRES_PASSWORD=test123 \
  -e POSTGRES_DB=erp_market \
  postgres:16-alpine

echo "=== Esperando 10 segundos ==="
sleep 10

echo "=== Logs del container ==="
docker logs db-debug --tail=10

echo "=== Estado del container ==="
docker ps -a --filter "name=db-debug"

echo "=== Health check manual ==="
docker exec db-debug pg_isready -U erp -d erp_market 2>&1 || echo "pg_isready falló"

echo "=== Limpiando ==="
docker rm -f db-debug

echo "=== Listo ==="
