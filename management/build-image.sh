#!/usr/bin/env bash
# build-image.sh — Build erp-market:latest image for tenant provisioning
set -Eeuo pipefail
cd /opt/erp-market
echo "Building erp-market:latest..."
docker buildx build -t erp-market:latest -f backend/Dockerfile . --load
echo "Done"
docker images erp-market
