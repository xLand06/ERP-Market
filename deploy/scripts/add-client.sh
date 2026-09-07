#!/usr/bin/env bash
#
# add-client.sh — provision a new isolated ERP-Market client stack.
#
# Usage:
#   add-client.sh <slug> [domain]
#
#   <slug>    lowercase alphanumeric + hyphen, 3-32 chars. Becomes the
#             container/network/volume names: api-<slug>, db-<slug>, ...
#   [domain]  optional FULL hostname for this client (e.g. acme.erp.example.com).
#             Resolution order when omitted:
#               1. <slug>.<BASE_DOMAIN> from deploy/.env (if BASE_DOMAIN set)
#               2. <slug>.<VPS_IP>.sslip.io — auto-derived from the server's
#                  public IP (real Let's Encrypt HTTPS, zero DNS work)
#
# What it does:
#   1. validates the slug; aborts if the client slot already exists
#   2. resolves the public hostname (explicit domain / BASE_DOMAIN / sslip.io)
#   3. generates fresh secrets (openssl rand -hex 24: DB password + JWT secret)
#   4. renders deploy/clients/<slug>/docker-compose.yml from the template
#      (envsubst with an explicit, fixed variable list — nothing else can be
#      substituted, and the rendered file is only written after envsubst exits 0)
#   5. ensures the shared `erp_proxy` Docker network exists
#   6. builds + starts the client stack (db + api), waits for the api
#      healthcheck (up to 90s)
#   7. writes deploy/caddy/sites/<slug>.caddy and reloads Caddy
#   8. verifies GET https://<domain>/api/health (real endpoint, confirmed in
#      backend/src/app.ts) and prints a summary with the APK build note
#
# Requirements: bash 3.2+, docker + compose v2, openssl, curl, envsubst
#   (Debian/Ubuntu: apt install gettext-base — macOS: brew install gettext).
#
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DEPLOY_DIR="$ROOT/deploy"
CLIENTS_DIR="$DEPLOY_DIR/clients"
TEMPLATE="$DEPLOY_DIR/templates/docker-compose.client.yml"
SITES_DIR="$DEPLOY_DIR/caddy/sites"
COMPOSE_OP_FILE="$DEPLOY_DIR/docker-compose.yml"

SLUG="${1:-}"
DOMAIN_ARG="${2:-}"

fail() { echo "ERROR: $*" >&2; exit 1; }

# ── Guardrails ────────────────────────────────────────────────────────────────
command -v docker >/dev/null 2>&1 || fail "docker not found (install Docker Engine + compose v2 plugin)"
command -v envsubst >/dev/null 2>&1 || fail "envsubst not found (Debian/Ubuntu: apt install gettext-base; macOS: brew install gettext)"
command -v openssl >/dev/null 2>&1 || fail "openssl not found"
command -v curl >/dev/null 2>&1 || fail "curl not found"

[[ -n "$SLUG" ]] || fail "usage: add-client.sh <slug> [domain]"
[[ "$SLUG" =~ ^[a-z0-9-]{3,32}$ ]] || fail "slug must be 3-32 chars of lowercase alnum + hyphens: '$SLUG'"
[[ "$SLUG" != -* && "$SLUG" != *- ]] || fail "slug must not start or end with '-'"

[[ -f "$TEMPLATE" ]] || fail "template not found: $TEMPLATE"
mkdir -p "$CLIENTS_DIR" "$SITES_DIR"

CLIENT_DIR="$CLIENTS_DIR/$SLUG"
if [[ -d "$CLIENT_DIR" ]]; then
    fail "client '$SLUG' already exists ($CLIENT_DIR) — remove it first: ./deploy/scripts/remove-client.sh $SLUG"
fi

# ── Domain resolution ─────────────────────────────────────────────────────────
if [[ -n "$DOMAIN_ARG" ]]; then
    [[ "$DOMAIN_ARG" =~ ^[a-zA-Z0-9.-]{4,253}$ ]] || fail "invalid domain: '$DOMAIN_ARG' (letters, digits, dots, hyphens only)"
    CLIENT_DOMAIN="$DOMAIN_ARG"
else
    # Optional operator config (BASE_DOMAIN, CADDY_EMAIL, ...)
    if [[ -f "$DEPLOY_DIR/.env" ]]; then
        set -a
        # shellcheck disable=SC1091
        source "$DEPLOY_DIR/.env"
        set +a
    fi
    if [[ -n "${BASE_DOMAIN:-}" ]]; then
        CLIENT_DOMAIN="$SLUG.$BASE_DOMAIN"
    else
        VPS_IP="$(curl -s4 --max-time 5 https://ifconfig.me 2>/dev/null || true)"
        if [[ -z "$VPS_IP" || ! "$VPS_IP" =~ ^[0-9.]+$ ]]; then
            VPS_IP="$(ip -4 addr show scope global 2>/dev/null | sed -nE 's/.*inet ([0-9.]+).*/\1/p' | head -1 || true)"
        fi
        if [[ -z "$VPS_IP" || ! "$VPS_IP" =~ ^[0-9.]+$ ]]; then
            VPS_IP="127.0.0.1"
        fi
        CLIENT_DOMAIN="$SLUG.$VPS_IP.sslip.io"
    fi
fi
CLIENT_URL="https://$CLIENT_DOMAIN"

# ── Fresh secrets (per client, never shared) ─────────────────────────────────
DB_NAME="erp_market"
DB_USER="erp"
DB_PASSWORD="$(openssl rand -hex 24)"
JWT_SECRET="$(openssl rand -hex 24)"

# ── Cleanup: only while rendering / starting. Once the stack is up, leave it
#    in place for debugging instead of auto-deleting it.
cleanup() {
    local rc=$?
    if [[ "${CLEANUP_DISABLED:-0}" == "0" ]]; then
        echo "INFO: provisioning failed — removing partial client dir $CLIENT_DIR"
        docker compose -f "$CLIENT_DIR/docker-compose.yml" down -v --remove-orphans >/dev/null 2>&1 || true
        rm -rf "$CLIENT_DIR"
    fi
    exit "$rc"
}
trap cleanup ERR

# ── Render the client stack ───────────────────────────────────────────────────
mkdir -p "$CLIENT_DIR" "$CLIENT_DIR/tls" "$DEPLOY_DIR/backups/$SLUG"

umask 077
# TLS keypair for the client's Postgres. Mandatory: the backend cloud client
# (backend/src/config/prisma.ts) hardcodes ssl:{rejectUnauthorized:false}, so
# the database MUST speak TLS or the sync bridge never connects. Self-signed
# (the app never verifies identity). Mode 644 so the postgres:16-alpine
# container (uid 70) can read the key via the read-only bind mount — this key
# only guards transport on the private per-client bridge; DB access itself is
# gated by POSTGRES_PASSWORD.
openssl req -x509 -newkey rsa:2048 -nodes -sha256 -days 1825 \
    -keyout "$CLIENT_DIR/tls/server.key" \
    -out "$CLIENT_DIR/tls/server.crt" \
    -subj "/CN=db-$SLUG" 2>/dev/null
chmod 600 "$CLIENT_DIR/tls/server.key"
chmod 644 "$CLIENT_DIR/tls/server.crt"

cat > "$CLIENT_DIR/.env" <<EOF
# Generated by deploy/scripts/add-client.sh — do not edit by hand.
CLIENT_SLUG=$SLUG
CLIENT_DOMAIN=$CLIENT_DOMAIN
CLIENT_URL=$CLIENT_URL
DB_NAME=$DB_NAME
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASSWORD
JWT_SECRET=$JWT_SECRET
EOF
umask 022

# ENVSUBST_SAFE: fixed variable list + write-to-tmp-then-mv, so a failed
# substitution never leaves a half-rendered compose file behind.
export CLIENT_SLUG CLIENT_DOMAIN CLIENT_URL DB_NAME DB_USER DB_PASSWORD JWT_SECRET
envsubst '$CLIENT_SLUG $CLIENT_DOMAIN $CLIENT_URL $DB_NAME $DB_USER $DB_PASSWORD $JWT_SECRET' \
    < "$TEMPLATE" > "$CLIENT_DIR/docker-compose.yml.tmp"
mv "$CLIENT_DIR/docker-compose.yml.tmp" "$CLIENT_DIR/docker-compose.yml"
echo "rendered $CLIENT_DIR/docker-compose.yml"

# ── Shared network (idempotent; also safe when deploy/ was never started) ────
if ! docker network inspect erp_proxy >/dev/null 2>&1; then
    echo "creating shared network erp_proxy"
    docker network create erp_proxy >/dev/null
fi

# ── Deploy the stack ──────────────────────────────────────────────────────────
echo "building + starting stack for '$SLUG' (first build takes a while: npm install + prisma generate)..."
docker compose -f "$CLIENT_DIR/docker-compose.yml" up -d --build -q
CLEANUP_DISABLED=1

# ── Wait for the api container healthcheck (up to 90s) ───────────────────────
status=""
for _ in $(seq 1 18); do
    status="$(docker inspect --format '{{.State.Health.Status}}' "api-$SLUG" 2>/dev/null || true)"
    [[ "$status" == "healthy" ]] && break
    sleep 5
done
if [[ "$status" != "healthy" ]]; then
    echo "WARNING: api-$SLUG not healthy after 90s — inspect with:"
    echo "         docker compose -f $CLIENT_DIR/docker-compose.yml logs --tail=100 api"
fi

# ── Caddy site file ──────────────────────────────────────────────────────────
SITE_FILE="$SITES_DIR/$SLUG.caddy"
cat > "$SITE_FILE" <<EOF
# Client: $SLUG — generated by add-client.sh
$CLIENT_DOMAIN {
    reverse_proxy api-$SLUG:3000
}
EOF
echo "wrote $SITE_FILE"

if docker compose -f "$COMPOSE_OP_FILE" ps -q caddy >/dev/null 2>&1; then
    echo "reloading Caddy..."
    docker compose -f "$COMPOSE_OP_FILE" exec -T caddy caddy reload --config /etc/caddy/Caddyfile
else
    echo "WARNING: operator Caddy (deploy/docker-compose.yml) is not running — site file written but inactive:"
    echo "         start it with:  docker compose -f $COMPOSE_OP_FILE up -d"
fi

# ── End-to-end verification (first request triggers ACME cert issuance) ──────
echo "verifying https://$CLIENT_DOMAIN/api/health ..."
ok=0
for _ in $(seq 1 12); do
    if curl -sf --max-time 10 "https://$CLIENT_DOMAIN/api/health" >/dev/null 2>&1; then
        ok=1
        break
    fi
    sleep 5
done

# ── Summary ───────────────────────────────────────────────────────────────────
{
    echo "┌──────────────────────────────────────────────────────────────────┐"
    echo "│  ERP-Market client LIVE                                           │"
    echo "│                                                                    │"
    printf "│  Slug     : %-58s │\n" "$SLUG"
    printf "│  URL      : %-58s │\n" "$CLIENT_URL"
    printf "│  VPS IP   : %-58s │\n" "${VPS_IP:-custom domain (no sslip.io)}"
    echo "│                                                                    │"
    echo "│  Build the Android APK for this client:                           │"
    printf "│    ./deploy/scripts/build-apk.sh %-39s │\n" "$SLUG"
    echo "│  (APK API base: $CLIENT_URL/api)"
    echo "└──────────────────────────────────────────────────────────────────┘"
} | sed 's/^/  /'

if [[ "$ok" == "1" ]]; then
    echo "health check OK — https://$CLIENT_DOMAIN/api/health returned 200"
else
    echo "WARNING: health check did not confirm yet. Common causes:"
    echo "  - ACME cert still issuing (check: docker compose -f $COMPOSE_OP_FILE logs caddy)"
    echo "  - API unhealthy (check: docker compose -f $CLIENT_DIR/docker-compose.yml logs api)"
    exit 1
fi