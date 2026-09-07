# =============================================================================
# ERP-Market backend — production image for the multi-tenant deployment kit.
#
# Multi-stage build on Debian bookworm (NOT alpine):
#   - @prisma/adapter-pg, @libsql/client and better-sqlite3 ship prebuilt
#     glibc binaries; musl (alpine) makes them painful.
#   - Prisma engines are published for debian-openssl-3.0.x (bookworm).
#
# SIZE TRADEOFF (deliberate): the runtime keeps the FULL node_modules tree,
# including devDependencies. backend/package.json ships the Prisma CLI only
# as a devDependency, and the entrypoint needs it on every boot to run
# `prisma db push` (automatic per-client schema sync). Cost: a few hundred
# MB of image size. Benefit: "adding a client" is pure data — the same image
# self-migrates any database schema on first boot, with no build step and no
# migration tooling per client.
# =============================================================================

# ── Stage 1: dependencies + build ─────────────────────────────────────────────
FROM node:20-bookworm-slim AS build

# Native build toolchain as insurance for prebuilt-binary fallbacks.
# Build stage only — the runtime stage stays slim and toolchain-free.
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# backend/ has no package-lock.json (the repo manages deps with pnpm through
# the root workspace), so a plain `npm install` is the correct install.
# node_modules, dist, .env, local DB files and scratch dirs are excluded by
# backend/.dockerignore.
COPY . .

# --ignore-scripts is REQUIRED: backend/package.json postinstall runs
# `pnpm run db:setup:local`, and pnpm is not installed in this image.
# The Prisma generates below are run explicitly and download the engines.
# better-sqlite3 is never imported by backend/src (the local client uses
# @prisma/adapter-libsql), so skipping its install script is safe.
RUN npm install --ignore-scripts

# Generate BOTH Prisma clients:
#   - schema.prisma         -> node_modules/.prisma/client      (cloud Postgres)
#   - schema.local.prisma   -> node_modules/.prisma/client-local (local SQLite,
#     used by the lazy getLocalPrisma() import in src/config/prisma.ts and by
#     the /api/health endpoint). Without it the runtime would crash on import.
RUN npx prisma generate \
    && npx prisma generate --schema=prisma/schema.local.prisma

# Compile TypeScript -> dist/ (tsconfig outDir = ./dist, rootDir = ./src)
RUN npm run build

# ── Stage 2: slim runtime ────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS runtime

ENV NODE_ENV=production
ENV DEPLOY_MODE=server
WORKDIR /app

# The node image already ships an unprivileged `node` user (uid 1000).
# /app stays node-owned so the runtime can create erp-market.db (the hybrid
# local SQLite file the health endpoint and the write path use).
COPY --from=build --chown=node:node /app/package.json /app/prisma.config.ts ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/prisma ./prisma
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/public ./public

# The image ships an unprivileged `node` user (uid 1000). /app must be
# node-owned: when a fresh named volume is mounted at /app, Docker copies the
# directory root from the image, and a root:root 755 root makes the runtime
# unable to create erp-market.db (the hybrid local SQLite writer) — the API
# then crash-loops in db push with "unable to open database file".
RUN mkdir -p /app && chown node:node /app

# Boot entrypoint (inline so the kit stays a single deploy/ tree):
#   1. wait for Postgres (TCP, up to 60s)
#   2. `prisma db push` on the CLOUD schema — idempotent; retried 3x so a
#      healthy Postgres that is still starting does not crash the boot
#   3. `prisma db push` on the LOCAL SQLite schema (the hybrid write path and
#      /api/health query this file at boot)
#   4. exec node dist/server.js (SIGTERM passes through for graceful shutdown)
#
# No --schema flag on the CLOUD push on purpose: prisma.config.ts (Prisma 7
# earlyAccess) resolves schema + url itself (schema.prisma for the cloud
# datasource, url from DIRECT_URL || DATABASE_URL). Combining a config file
# with an explicit --schema flag can conflict in Prisma 7.
RUN cat > /usr/local/bin/docker-entrypoint.sh <<'SH'
#!/bin/bash
set -Eeuo pipefail

echo "[entrypoint] waiting for Postgres (db:5432, up to 60s)..."
ready=0
for i in $(seq 1 30); do
    if (exec 3<>/dev/tcp/db/5432) 2>/dev/null; then
        exec 3>&- 3<&-
        ready=1
        break
    fi
    sleep 2
done
if [ "$ready" != "1" ]; then
    echo "[entrypoint] FATAL: Postgres not reachable after 60s" >&2
    exit 1
fi

echo "[entrypoint] applying cloud schema (prisma db push)..."
pushed=0
for attempt in 1 2 3; do
    if ./node_modules/.bin/prisma db push; then
        pushed=1
        break
    fi
    echo "[entrypoint] cloud db push attempt $attempt/3 failed, retrying in 5s..."
    sleep 5
done
if [ "$pushed" != "1" ]; then
    echo "[entrypoint] FATAL: cloud schema sync failed after 3 attempts" >&2
    exit 1
fi

# The local SQLite schema is a DEVICE-only concern: desktop/mobile use SQLite
# as their local authority, but in server mode the container should never
# create /app/erp-market.db (Postgres IS the authority). DEPLOY_MODE defaults
# to server so plain docker runs stay cloud-only.
echo "[entrypoint] DEPLOY_MODE=${DEPLOY_MODE:-server}"
if [ "${DEPLOY_MODE:-server}" != "server" ]; then
    echo "[entrypoint] applying local SQLite schema..."
    if ! ./node_modules/.bin/prisma db push --schema=prisma/schema.local.prisma; then
        echo "[entrypoint] FATAL: local SQLite schema sync failed" >&2
        exit 1
    fi
else
    echo "[entrypoint] server mode — skipping SQLite schema"
fi

echo "[entrypoint] starting API: node dist/server.js"
exec node dist/server.js
SH
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

USER node

EXPOSE 3000

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]