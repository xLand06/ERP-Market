#!/usr/bin/env bash
#
# backup-clients.sh — dump every active client database.
#
# For each client under deploy/clients/ with a docker-compose.yml + .env:
#
#   docker compose -f deploy/clients/<slug>/docker-compose.yml \
#       exec -T db pg_dump -U <user> <db> | gzip -c \
#       > deploy/backups/<slug>/<YYYYMMDD-HHMMSS>.sql.gz
#
# Backups older than BACKUP_KEEP_DAYS (default 14, env-overridable) are
# pruned per client. If one client fails, the others still get backed up and
# the script exits non-zero.
#
# Restore (single line, per client):
#   gunzip -c deploy/backups/<slug>/<file>.sql.gz \
#     | docker compose -f deploy/clients/<slug>/docker-compose.yml exec -T db \
#         psql -U <user> -d <db>
#
# NOTE on data freshness: the backend writes to a local SQLite file first and
# a sync worker pushes to Postgres every ~15 min, so a dump may lag the very
# latest writes by up to one sync cycle. That is the app's offline-first
# contract; Postgres remains the point-in-time backup source.
#
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DEPLOY_DIR="$ROOT/deploy"
CLIENTS_DIR="$DEPLOY_DIR/clients"
BACKUPS_DIR="$DEPLOY_DIR/backups"
KEEP_DAYS="${BACKUP_KEEP_DAYS:-14}"

command -v docker >/dev/null 2>&1 || { echo "ERROR: docker not found" >&2; exit 1; }

[[ -d "$CLIENTS_DIR" ]] || { echo "no clients directory yet ($CLIENTS_DIR)"; exit 0; }

stamp="$(date +%Y%m%d-%H%M%S)"
failed=0
rows=()

for client_dir in "$CLIENTS_DIR"/*/; do
    [[ -d "$client_dir" ]] || continue
    slug="$(basename "$client_dir")"
    [[ -f "$client_dir/docker-compose.yml" ]] || continue

    env_file="$client_dir/.env"
    if [[ ! -f "$env_file" ]]; then
        echo "WARN: $slug: no .env found, skipping" >&2
        failed=1
        continue
    fi

    DB_USER="$(sed -n 's/^DB_USER=//p' "$env_file" | head -1)"
    DB_NAME="$(sed -n 's/^DB_NAME=//p' "$env_file" | head -1)"
    if [[ -z "$DB_USER" || -z "$DB_NAME" ]]; then
        echo "WARN: $slug: DB_USER/DB_NAME missing in .env, skipping" >&2
        failed=1
        continue
    fi

    out_dir="$BACKUPS_DIR/$slug"
    mkdir -p "$out_dir"
    out_file="$out_dir/$stamp.sql.gz"

    echo "backing up $slug -> $out_file"
    if docker compose -f "$client_dir/docker-compose.yml" exec -T db \
            pg_dump -U "$DB_USER" "$DB_NAME" | gzip -c > "$out_file"; then
        size="$(wc -c < "$out_file" | tr -d ' ')"
        rows+=("$slug|$size|$stamp")
        find "$out_dir" -maxdepth 1 -name '*.sql.gz' -type f -mtime "+$KEEP_DAYS" -delete 2>/dev/null || true
    else
        rm -f "$out_file"
        echo "ERROR: backup failed for $slug (stack running? see: docker compose -f $client_dir/docker-compose.yml ps)" >&2
        failed=1
    fi
done

echo
printf '%-24s %14s  %s\n' "CLIENT" "SIZE (bytes)" "STAMP"
printf '%-24s %14s  %s\n' "------" "-----------" "-----"
if [[ ${#rows[@]} -gt 0 ]]; then
    for row in "${rows[@]}"; do
        IFS='|' read -r slug size st <<< "$row"
        printf '%-24s %14s  %s\n' "$slug" "$size" "$st"
    done
fi
echo

if [[ "$failed" == "0" ]]; then
    echo "backup run OK — retention: $KEEP_DAYS day(s) per client"
else
    echo "backup run finished WITH ERRORS (see above)" >&2
    exit 1
fi