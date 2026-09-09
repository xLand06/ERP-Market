#!/usr/bin/env bash
#
# build-apk.sh <slug> — build the Android APK pointed at client <slug>.
#
# Reads the client's hostname from deploy/clients/<slug>/.env and builds the
# frontend with VITE_API_URL=https://<client-domain>/api (the exact shape the
# frontend expects: frontend/.env currently ships VITE_API_URL=...:/api and
# frontend/src/lib/api.ts reads import.meta.env.VITE_API_URL).
#
# Build steps (frontend/package.json "build:apk"):
#   vite build && cap sync android
#
# HARD BOUNDARY: `cap sync android` only copies the rebuilt web assets into
# the Capacitor Android project — it does NOT compile the APK. Producing the
# installable .apk requires the Android SDK / gradle. If
# frontend/android/gradlew exists, this script prints the exact command; you
# can also open the project in Android Studio. The APK lands at:
#   frontend/android/app/build/outputs/apk/debug/app-debug.apk
#
# frontend/.env is NEVER permanently modified: the original file is backed up
# and restored on exit, including on failure (EXIT trap).
#
# Requirements: Node + npm (frontend/node_modules already installed),
# and a running client (run add-client.sh <slug> first).
#
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DEPLOY_DIR="$ROOT/deploy"
FRONTEND_DIR="$ROOT/frontend"

SLUG="${1:-}"
[[ -n "$SLUG" ]] || { echo "ERROR: usage: build-apk.sh <slug>" >&2; exit 1; }
[[ "$SLUG" =~ ^[a-z0-9-]{3,32}$ ]] || { echo "ERROR: invalid slug: '$SLUG'" >&2; exit 1; }

ENV_FILE="$DEPLOY_DIR/clients/$SLUG/.env"
[[ -f "$ENV_FILE" ]] || { echo "ERROR: client '$SLUG' not provisioned — run: ./deploy/scripts/add-client.sh $SLUG" >&2; exit 1; }

CLIENT_DOMAIN="$(sed -n 's/^CLIENT_DOMAIN=//p' "$ENV_FILE" | head -1)"
[[ -n "$CLIENT_DOMAIN" ]] || { echo "ERROR: CLIENT_DOMAIN missing in $ENV_FILE" >&2; exit 1; }
API_URL="https://$CLIENT_DOMAIN/api"

[[ -d "$FRONTEND_DIR" ]] || { echo "ERROR: frontend dir not found: $FRONTEND_DIR" >&2; exit 1; }
[[ -d "$FRONTEND_DIR/node_modules" ]] || { echo "ERROR: frontend dependencies missing — run: pnpm install (repo root)" >&2; exit 1; }

# ── Backup + restore frontend/.env (trap runs on success AND failure) ────────
ENV_BAK=""
HAD_ENV=0
if [[ -f "$FRONTEND_DIR/.env" ]]; then
    ENV_BAK="$(mktemp)"
    cp "$FRONTEND_DIR/.env" "$ENV_BAK"
    HAD_ENV=1
fi
restore_env() {
    if [[ "$HAD_ENV" == "1" ]]; then
        cp "$ENV_BAK" "$FRONTEND_DIR/.env"
        rm -f "$ENV_BAK"
    else
        rm -f "$FRONTEND_DIR/.env"
    fi
    echo "frontend/.env restored"
}
trap restore_env EXIT

printf 'VITE_API_URL=%s\n' "$API_URL" > "$FRONTEND_DIR/.env"
# Belt and braces: Vite gives process env priority over .env files anyway.
export VITE_API_URL="$API_URL"

echo "building frontend with VITE_API_URL=$API_URL"
( cd "$FRONTEND_DIR" && npm run build:apk )

echo "web bundle synced into $FRONTEND_DIR/android"
if [[ -x "$FRONTEND_DIR/android/gradlew" ]]; then
    echo
    echo "Compilando APK con gradle..."
    ( cd "$FRONTEND_DIR/android" && ./gradlew assembleDebug )
    APK_SRC="$FRONTEND_DIR/android/app/build/outputs/apk/debug/app-debug.apk"
    APK_DEST="$DEPLOY_DIR/clients/$SLUG/apk/app.apk"
    if [[ -f "$APK_SRC" ]]; then
        mkdir -p "$DEPLOY_DIR/clients/$SLUG/apk"
        cp "$APK_SRC" "$APK_DEST"
        echo "APK copiado a: $APK_DEST"
        echo "Descarga disponible en: https://$CLIENT_DOMAIN/apk/app.apk"
    else
        echo "WARNING: APK no encontrado en $APK_SRC" >&2
    fi
else
    echo
    echo "NEXT (manual): open $FRONTEND_DIR/android in Android Studio and build the debug APK."
    echo "After building, copy the APK to: $DEPLOY_DIR/clients/$SLUG/apk/app.apk"
fi