#!/usr/bin/env bash
# cleanup-docker.sh — Libera espacio en disco limpiando Docker.
set -Eeuo pipefail

echo "═══════════════════════════════════════════════════════════"
echo "  Docker Cleanup"
echo "═══════════════════════════════════════════════════════════"

echo "▶ Espacio antes:"
df -h / | tail -1

echo ""
echo "▶ Limpiando containers parados..."
docker container prune -f 2>&1 | sed 's/^/  /'

echo ""
echo "▶ Limpiando imagenes no usadas..."
docker image prune -a -f 2>&1 | sed 's/^/  /'

echo ""
echo "▶ Limpiando volumes no usados..."
docker volume prune -f 2>&1 | sed 's/^/  /'

echo ""
echo "▶ Limpiando build cache..."
docker builder prune -f 2>&1 | sed 's/^/  /'

echo ""
echo "▶ Espacio después:"
df -h / | tail -1

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  Limpieza completada"
echo "═══════════════════════════════════════════════════════════"
