# Tasks: deploy-auto-improve

## Summary

Harden the multi-tenant VPS onboarding kit by fixing five ground-truth provisioning
bugs in `deploy/scripts/add-client.sh` and `deploy/templates/docker-compose.client.yml`
(unassigned `CLIENT_SLUG`, invalid `-q` flag, wrong API build context, missing DB
healthcheck `start_period`, and a TLS key root-owned and unreadable by uid-70
Postgres), adding deterministic idempotent rerun for existing slugs, a self-checking
smoke step that aborts loudly on failure, best-effort Caddy proxy verification over
HTTP, and correcting the TLS-ownership + rerun/smoke documentation in
`deploy/README.md`. All fixes land in the repo working tree and are later propagated
to the live VPS clone (`/opt/erp-market`) by the apply phase. No product features.

## Prerequisites

- `deploy/scripts/add-client.sh`, `deploy/templates/docker-compose.client.yml`,
  `deploy/README.md` present in the working tree (verified).
- `deploy/caddy/Caddyfile` (imports `sites/*.caddy`) and `deploy/docker-compose.yml`
  (operator Caddy stack) understood before editing the Caddy write/probe block.
- Bug 4 (`start_period: 60s`) is already committed in the template — T3 is a
  confirmation task, not a code change.
- Running `shellcheck` must be available for the static check in T8.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | add-client.sh ~95, template ~2, README ~45 → **~142 total** |
| 400-line budget risk | **Low** |
| Chained PRs recommended | **No** |
| Chain strategy | **pending** |
| Delivery strategy | auto-chain |
| Decision needed before apply | No |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

## Tasks

### T1 — add-client.sh BUG1: assign CLIENT_SLUG (CLIENT-ONBOARDING-01)
- **File**: `deploy/scripts/add-client.sh`
- **Do**: After the slug-validation block (currently ~line 55), add `CLIENT_SLUG="$SLUG"` before the domain/secrets/render section; keep the existing `export CLIENT_SLUG ...` on line 143 so `envsubst` renders the project `name:` non-empty.
- **Acceptance**: `grep -n 'CLIENT_SLUG="\$SLUG"' deploy/scripts/add-client.sh` returns 0; rendered `docker-compose.yml` contains a non-empty `name:` equal to the slug.

### T2 — add-client.sh BUG2: drop `-q` from compose up (CLIENT-ONBOARDING-02)
- **File**: `deploy/scripts/add-client.sh`
- **Do**: Change line 157 `docker compose -f "$CLIENT_DIR/docker-compose.yml" up -d --build -q` to `up -d --build` (remove `-q`, keep `--build`).
- **Acceptance**: `grep -n 'up -d --build' deploy/scripts/add-client.sh | grep -v -- '-q'` returns a match; no occurrence of `up -d --build -q` remains.

### T3 — template BUG3: correct API build context (CLIENT-ONBOARDING-03)
- **File**: `deploy/templates/docker-compose.client.yml`
- **Do**: Change line 69 `context: ../../backend` → `context: ../../../backend` so it resolves from `deploy/clients/<slug>/` to repo-root `backend/`.
- **Acceptance**: `grep -n 'context: ../../../backend' deploy/templates/docker-compose.client.yml` returns 0; no `context: ../../backend` remains in the template.

### T4 — template BUG4: confirm db healthcheck start_period (CLIENT-ONBOARDING-04)
- **File**: `deploy/templates/docker-compose.client.yml`
- **Do**: Confirm the `db` healthcheck block (lines 53-63) carries `interval: 10s`, `timeout: 5s`, `retries: 5`, and `start_period: 60s`. No change expected — it is already committed; do not alter it.
- **Acceptance**: `grep -n 'start_period: 60s' deploy/templates/docker-compose.client.yml` returns 0 on the `db` service block.

### T5 — add-client.sh BUG5: chown 70:70 on TLS key (CLIENT-ONBOARDING-05)
- **File**: `deploy/scripts/add-client.sh`
- **Do**: After `openssl` + `chmod 600`/`chmod 644` (lines 122-127), add `chown 70:70 "$CLIENT_DIR/tls/server.key"` with a failure guard (`if ! chown ...; then fail ...; fi` hard-abort) and best-effort `chown 70:70 .../server.crt || true`.
- **Acceptance**: `grep -n 'chown 70:70.*server\.key' deploy/scripts/add-client.sh` returns 0; the guard hard-aborts with an actionable message on `chown` failure; a failed `chown` never falls through to leave an unreadable key.

### T6 — add-client.sh: idempotency guards + rerun re-verify (CLIENT-ONBOARDING-06/07)
- **File**: `deploy/scripts/add-client.sh`
- **Do**: Replace the "already exists" hard-fail (lines 61-63) with a `REVERIFY` detection block: if `$CLIENT_DIR` exists and `docker-compose.yml` + `tls/server.key` are present, set `REVERIFY=1` and `CLEANUP_DISABLED=1` immediately; if the dir is partial/corrupt (missing/empty compose or missing key), `fail()` with a `remove-client.sh <slug>` pointer. Gate TLS generation, `.env` write, and envsubst render behind `[[ "$REVERIFY" == "0" ]]`. Keep `mkdir -p "$CLIENT_DIR/tls"` and the `erp_proxy` `docker network inspect` guard idempotent (always). Named volumes need no explicit guard (Compose reuses by name).
- **Acceptance**: `grep -c 'REVERIFY' deploy/scripts/add-client.sh` > 0 (assignment + conditionals); rerun of an existing healthy slug exits 0 with "already provisioned — re-verified OK" and does not regenerate TLS/.env; partial state hard-aborts pointing at `remove-client.sh`.

### T7 — add-client.sh: bounded wait + smoke step (CLIENT-ONBOARDING-06/08)
- **File**: `deploy/scripts/add-client.sh`
- **Do**: Replace the current 90s api-wait + HTTPS loop (lines 161-170 and 190-199) with a smoke function: (a) wait `db-<slug>` `healthy` via `docker inspect --format '{{.State.Health.Status}}'` up to 120s (5s steps); (b) `docker exec api-<slug> node -e "fetch('http://127.0.0.1:3000/api/health')..."` to 200 up to 60s; abort with `exit 1` + actionable debug command (`docker compose ... logs --tail=50 <service>` + escape-hatch `remove-client.sh`) on failure. Never clean up the post-up stack (`CLEANUP_DISABLED=1`).
- **Acceptance**: On a healthy stack the script prints "smoke check OK" and exits 0; on DB or API timeout it exits non-zero with a `logs db` / `logs api` debug pointer and does NOT `down -v` the stack.

### T8 — add-client.sh + Caddy: idempotent site write + best-effort HTTP proxy gate (CLIENT-ONBOARDING-09)
- **File**: `deploy/scripts/add-client.sh`
- **Do**: Keep the idempotent `cat > "$SITE_FILE"` overwrite (lines 173-179). After the Caddy reload branch, add a best-effort `curl -sf --max-time 10 "http://$CLIENT_DOMAIN/api/health"` probe — success is confirmatory; failure (or Caddy not running) is a non-fatal NOTICE with a start command, never an abort. Remove the old HTTPS health loop; replace the summary health message ("smoke check OK — db healthy, /api/health returned 200 (inside stack)").
- **Acceptance**: Caddy site file declares `reverse_proxy api-<slug>:3000`; an inactive/ACME-pending Caddy produces a non-fatal notice and the run still exits 0 when in-stack smoke passed; no HTTPS-only gating remains.

### T9 — README.md: correct TLS ownership + document rerun/smoke/abort/first-boot (docs)
- **File**: `deploy/README.md`
- **Do**: Fix the Security-checklist TLS bullet (line 179) to state the key is mode 600 owned by uid 70 (NOT 644). Add subsections under "Adding clients for real": "Idempotent reruns" (skips TLS/.env, `up -d --build`, smoke, Caddy overwrite, exit-0 on healthy; hard-abort on conflict), "Smoke verification" (db ≤120s, API ≤60s, Caddy best-effort, abort semantics), and "First-boot timing" (`start_period: 60s` + 120s headroom).
- **Acceptance**: README no longer claims "mode 644"; rerun/smoke/abort/first-boot behaviors are documented and match the script's implemented semantics.

### T10 — static verification of all fixes (hardening gate)
- **File**: `deploy/scripts/add-client.sh`, `deploy/templates/docker-compose.client.yml`
- **Do**: Run `shellcheck deploy/scripts/add-client.sh` (must pass with no warnings; script uses `set -Eeuo pipefail`). Re-run the grep checks from T1/T2/T3/T4/T5 to confirm each pattern. Audit envsubst variable list matches template `${...}` placeholders.
- **Acceptance**: shellcheck exits 0; all five grep acceptance checks from T1-T5 pass; envsubst export list == template placeholder set (`CLIENT_SLUG CLIENT_DOMAIN CLIENT_URL DB_NAME DB_USER DB_PASSWORD JWT_SECRET`).

### T11 — VPS propagation marker (apply-owned; final)
- **File**: `/opt/erp-market/deploy/` (apply phase — no edit here)
- **Note**: Engineering/planning only. The sdd-apply phase copies the fixed `add-client.sh`, `docker-compose.client.yml`, and `README.md` to the live VPS clone at `/opt/erp-market/deploy/`, then re-runs the same grep/static checks against the VPS copy and verifies all five bugs are gone there (including `stat -c '%u:%a'` → `70:600` on a live `server.key`, and no "could not load server certificate file" in `logs db`).
- **Acceptance (apply)**: All grep checks pass on the VPS clone; a re-verify of an existing slug and a fresh-slug smoke both succeed on the VPS.

## Suggested Work Units

| Unit | Tasks | Goal | Notes |
|------|-------|------|-------|
| 1 | T1-T5 | Fix the 5 ground-truth bugs | Single PR; template + add-client.sh + no docs yet |
| 2 | T6-T8 | Idempotency, smoke, Caddy probe | Single PR; depends on Unit 1 in `add-client.sh` |
| 3 | T9-T10 | README + static verification | Single PR; docs + hardening gate |
| 4 | T11 | VPS propagation | Apply-owned; no repo PR |

## Implementation Order

Follow T1→T5 (bug fixes first — they are independent and low-risk), then T6→T7
(idempotency + smoke, both editing the same script in sequence to avoid merge
churn), then T8 (Caddy probe), T9 (README), T10 (static verification), T11 (apply
marker). T6-T8 should be applied together as they restructure the same
`add-client.sh` stages; T1-T5 land cleanly first. Overall workload (~142 changed
lines) is well under the 400-line budget, so a single `sdd-apply` pass is
recommended — no chained PRs needed.
