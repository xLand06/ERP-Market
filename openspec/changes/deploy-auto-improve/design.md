# Design: deploy-auto-improve — Harden multi-tenant VPS onboarding

## 1. Architecture Overview — add-client.sh flow after the change

The revised `add-client.sh` follows a strict seven-stage pipeline. Each stage
has a clear success/failure contract and no stage leaves a half-provisioned
state behind.

```
Stage 1          Stage 2              Stage 3         Stage 4
Validate    →    Render compose   →   TLS + secrets →  Idempotent resources
slug, deps,      envsubst to tmp,     generate keypair,  tls dir, erp_proxy
domain, guard     atomic mv            chown 70:70        network, volumes

Stage 5               Stage 6                    Stage 7
docker compose    →   Bounded wait + smoke   →   Caddy site + proxy probe
up -d --build         db healthy, /api/health     write idempotent, reload,
(no -q)               inside-stack, abort on      HTTP best-effort
                      failure
```

**Why this order:**

1. **Validate first** — no filesystem mutation until we know the slug is legal
   and the client slot isn't already taken (or, for reruns, we can re-verify).
2. **Render before TLS** — envsubst writes a compose file we can reason about;
   if it fails (bad vars), nothing is left behind (atomic tmp+mv).
3. **TLS before compose up** — the key must be uid 70 readable before Postgres
   starts; generating it after `up` would mean Postgres has already failed.
4. **Idempotent resources before compose up** — the `erp_proxy` network must
   exist for the compose file's `external: true` to resolve; volumes must exist
   or Docker creates them (harmless, but we explicitly guard).
5. **Compose up before smoke** — smoke probes run against live containers; the
   containers must be started first.
6. **Smoke before Caddy** — if the stack is unhealthy, we abort immediately and
   don't write a Caddy site that points at a broken backend.
7. **Caddy last** — the site file is a routing declaration, not a health check;
   writing it after smoke means only healthy stacks get routed to.

**Stage guarantees:**

| Stage | Entry condition | Exit condition (success) | Exit condition (failure) |
|-------|----------------|--------------------------|--------------------------|
| 1. Validate | Script invoked | Slug legal, deps available | Hard abort with usage msg |
| 2. Render | Slug validated | `$CLIENT_DIR/docker-compose.yml` exists, non-empty, atomic | Trap cleanup removes partial dir; abort |
| 3. TLS | Render done | `server.key` owned uid 70 mode 600, `server.crt` mode 644 | chown failure guard: abort, leave key for diagnosis |
| 4. Resources | TLS done | `erp_proxy` network exists, `tls/` dir present | Always succeeds (idempotent); never fails |
| 5. Compose up | Resources exist | Containers started (not yet healthy) | Hard abort; CLEANUP_DISABLED=0 so cleanup trap removes partial dir |
| 6. Smoke | Containers started | db healthy + /api/health 200 (inside-stack) | Abort with actionable cmd; stack left in place for diagnosis |
| 7. Caddy | Smoke passed | Site file written, caddy reloaded (if running), HTTP probe best-effort | Caddy probe is non-fatal; always exits 0 if reached |

---

## 2. Module/File Changes

### 2.1 add-client.sh — line-by-line changes

#### Bug 1 fix: assign CLIENT_SLUG before envsubst

**Current (broken):**
```bash
# line 143
export CLIENT_SLUG CLIENT_DOMAIN CLIENT_URL DB_NAME DB_USER DB_PASSWORD JWT_SECRET
```
`CLIENT_SLUG` is never assigned — only `SLUG` is set (line 42). `envsubst`
substitutes an empty string into `name: ${CLIENT_SLUG}`.

**Fix:** add the assignment immediately after the slug validation block (after
line 58, before the TLS/render section):

```bash
CLIENT_SLUG="$SLUG"
```

The export on line 143 already includes `CLIENT_SLUG` — once the variable holds
the value, `envsubst` gets the correct string. The `.env` file (line 131) already
writes `CLIENT_SLUG=$SLUG` correctly — this fix ensures the *shell* variable and
the *envsubst* variable agree.

#### Bug 2 fix: drop -q flag

**Current (broken):**
```bash
# line 157
docker compose -f "$CLIENT_DIR/docker-compose.yml" up -d --build -q
```

**Fix:**
```bash
docker compose -f "$CLIENT_DIR/docker-compose.yml" up -d --build
```

`-q` was never valid on compose v5.5.1's `up` subcommand. Output goes to
stdout (the operator sees build progress), which is actually desirable for
first-boot debugging.

#### Bug 5 fix: chown 70:70 on server.key + failure guard

**Current (broken):**
```bash
# lines 122-127
openssl req -x509 ... -keyout "$CLIENT_DIR/tls/server.key" ...
chmod 600 "$CLIENT_DIR/tls/server.key"
chmod 644 "$CLIENT_DIR/tls/server.crt"
```

Key is root:root mode 600. Postgres (uid 70) cannot read it through the
read-only bind mount.

**Fix:**
```bash
openssl req -x509 ... -keyout "$CLIENT_DIR/tls/server.key" ...
chmod 600 "$CLIENT_DIR/tls/server.key"
chmod 644 "$CLIENT_DIR/tls/server.crt"
if ! chown 70:70 "$CLIENT_DIR/tls/server.key"; then
    fail "chown 70:70 on server.key failed — Postgres (uid 70) won't be able to read the TLS key"
fi
# Also chown the cert for consistency; postgres reads it too
chown 70:70 "$CLIENT_DIR/tls/server.crt" || true
```

The `fail` on key chown hard-aborts because without a readable key Postgres
will crash. The cert chown is best-effort (`|| true`) because the cert is
readable by any uid (mode 644).

#### Cleanup trap semantics (design decision)

The current cleanup trap (lines 100-108) deletes the entire `$CLIENT_DIR` and
runs `docker compose down -v` on failure when `CLEANUP_DISABLED=0`.

**Decision: keep the existing partial-dir cleanup for pre-up failures only.**

Rationale:
- Before `docker compose up` succeeds, a partial client dir is junk — no
  containers are running, no volumes have data, no harm in deleting it.
- After `docker compose up` succeeds, `CLEANUP_DISABLED=1` prevents the trap
  from running (existing behavior, unchanged).
- The cleanup does NOT need to preserve TLS on failure: the key is freshly
  generated, has no value outside this provisioning run, and re-running the
  script regenerates it. Leaving a dead TLS dir behind adds confusion, not
  diagnostic value.

**What changes for the idempotent rerun path:** when the client dir already
exists and we're re-verifying, `CLEANUP_DISABLED=1` is set immediately (before
compose up) so a smoke failure during re-verify does NOT delete an existing
healthy slot. This is the key idempotency guard: existing clients are never
cleaned up by a re-verify failure.

```bash
# Idempotent rerun detection
REVERIFY=0
if [[ -d "$CLIENT_DIR" ]]; then
    # Partial state: dir exists but compose file is missing or empty — abort
    if [[ ! -s "$CLIENT_DIR/docker-compose.yml" ]]; then
        fail "client '$SLUG' dir exists but is incomplete (missing docker-compose.yml) — clean up first: ./deploy/scripts/remove-client.sh $SLUG"
    fi
    # TLS dir must also be present for re-verify
    if [[ ! -f "$CLIENT_DIR/tls/server.key" ]]; then
        fail "client '$SLUG' dir exists but tls/server.key is missing — clean up first: ./deploy/scripts/remove-client.sh $SLUG"
    fi
    REVERIFY=1
    echo "client '$SLUG' already provisioned — re-verifying..."
fi
```

#### Idempotent resource creation guards

```bash
# TLS dir — idempotent
mkdir -p "$CLIENT_DIR/tls"

# Named volumes — Docker creates them implicitly on `compose up`; no explicit
# guard needed. The compose template declares:
#   erp-db-${CLIENT_SLUG}:
#   erp-appdata-${CLIENT_SLUG}:
# Docker reuses existing volumes by name.

# erp_proxy network — already idempotent (lines 149-153, unchanged)
if ! docker network inspect erp_proxy >/dev/null 2>&1; then
    echo "creating shared network erp_proxy"
    docker network create erp_proxy >/dev/null
fi
```

**Only on first run (not re-verify):**

```bash
if [[ "$REVERIFY" == "0" ]]; then
    mkdir -p "$CLIENT_DIR" "$CLIENT_DIR/tls" "$DEPLOY_DIR/backups/$SLUG"
    # ... TLS generation, .env write, envsubst render ...
fi
```

**On re-verify (REVERIFY=1): skip TLS generation, skip envsubst, skip .env write.
Only run compose up (rebuild + restart) and smoke.**

```bash
if [[ "$REVERIFY" == "0" ]]; then
    # TLS generation + chown (see Bug 5 fix above)
    # .env write
    # envsubst render (see Bug 1 fix above)
fi

# Idempotent resources (always)
mkdir -p "$CLIENT_DIR/tls"
# erp_proxy network ensure (always)

# Compose up (always — rebuilds are idempotent)
echo "building + starting stack for '$SLUG'..."
docker compose -f "$CLIENT_DIR/docker-compose.yml" up -d --build
CLEANUP_DISABLED=1
```

#### Bounded wait loop + smoke function

Replace the current wait loop (lines 161-170) with a structured smoke function:

```bash
# ── Smoke: wait for DB healthy ───────────────────────────────────────────────
DB_TIMEOUT=120  # seconds — start_period 60s + 60s margin for slow VPS
DB_ELAPSED=0
db_ok=0
echo "waiting for db-$SLUG to become healthy (timeout: ${DB_TIMEOUT}s)..."
while (( DB_ELAPSED < DB_TIMEOUT )); do
    db_status="$(docker inspect --format '{{.State.Health.Status}}' "db-$SLUG" 2>/dev/null || true)"
    if [[ "$db_status" == "healthy" ]]; then
        db_ok=1
        break
    fi
    sleep 5
    DB_ELAPSED=$((DB_ELAPSED + 5))
done

if [[ "$db_ok" != "1" ]]; then
    echo "ERROR: db-$SLUG did not become healthy within ${DB_TIMEOUT}s (status: $db_status)" >&2
    echo "  Debug: docker compose -f $CLIENT_DIR/docker-compose.yml logs db" >&2
    exit 1
fi
echo "db-$SLUG healthy (after ${DB_ELAPSED}s)"

# ── Smoke: /api/health inside the stack ─────────────────────────────────────
API_TIMEOUT=60  # seconds
API_ELAPSED=0
api_ok=0
echo "waiting for api-$SLUG /api/health (timeout: ${API_TIMEOUT}s)..."
while (( API_ELAPSED < API_TIMEOUT )); do
    if docker exec "api-$SLUG" \
        node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" \
        >/dev/null 2>&1; then
        api_ok=1
        break
    fi
    sleep 5
    API_ELAPSED=$((API_ELAPSED + 5))
done

if [[ "$api_ok" != "1" ]]; then
    echo "ERROR: api-$SLUG /api/health did not return 200 within ${API_TIMEOUT}s" >&2
    echo "  Debug: docker compose -f $CLIENT_DIR/docker-compose.yml logs --tail=50 api" >&2
    exit 1
fi
echo "api-$SLUG /api/health OK (after ${API_ELAPSED}s)"
```

**Why `docker exec` inside the stack:** it avoids any dependency on TLS/ACME,
Caddy, or host networking. The probe hits the Express health endpoint directly
on its listen address. This is the definitive "the app is alive" check.

**Abort semantics:** non-zero exit code + message with the exact debug command.
The stack is left in place (containers running, volumes intact) for diagnosis.
No silent WARNING, no partial cleanup.

#### Caddy site write — idempotent + non-fatal proxy gate

```bash
# ── Caddy site file (idempotent overwrite) ──────────────────────────────────
SITE_FILE="$SITES_DIR/$SLUG.caddy"
cat > "$SITE_FILE" <<EOF
# Client: $SLUG — generated by add-client.sh
$CLIENT_DOMAIN {
    reverse_proxy api-$SLUG:3000
}
EOF
echo "wrote $SITE_FILE"

# ── Caddy reload + best-effort HTTP probe ───────────────────────────────────
if docker compose -f "$COMPOSE_OP_FILE" ps -q caddy >/dev/null 2>&1; then
    echo "reloading Caddy..."
    docker compose -f "$COMPOSE_OP_FILE" exec -T caddy caddy reload --config /etc/caddy/Caddyfile

    # Best-effort HTTP proxy probe (non-fatal)
    if curl -sf --max-time 10 "http://$CLIENT_DOMAIN/api/health" >/dev/null 2>&1; then
        echo "caddy proxy probe OK — http://$CLIENT_DOMAIN/api/health reachable"
    else
        echo "NOTICE: caddy proxy not yet reachable at http://$CLIENT_DOMAIN/api/health (non-fatal)"
        echo "  ACME cert may still be issuing; full HTTPS check: curl -sk https://$CLIENT_DOMAIN/api/health"
    fi
else
    echo "NOTICE: operator Caddy (deploy/docker-compose.yml) is not running — site file written but inactive"
    echo "  Start it with: docker compose -f $COMPOSE_OP_FILE up -d"
fi
```

**Key design decision:** the Caddy probe is `http://` (not `https://`), because
port 443 is often firewalled mid-bootstrap and ACME hasn't issued a cert yet.
The in-stack `docker exec` probe is the mandatory gate; the Caddy probe is
confirmatory and non-fatal.

#### Summary output (after all smoke passes)

The existing summary block (lines 202-214) is kept, but the health check
confirmation message changes:

```bash
echo "smoke check OK — db healthy, /api/health returned 200 (inside stack)"
echo "caddy proxy: see above for best-effort status"
```

The old HTTPS health check loop (lines 191-199) is removed entirely — the
inside-stack smoke replaces it as the mandatory gate. The Caddy HTTP probe
above replaces it as the best-effort external check.

---

### 2.2 docker-compose.client.yml — changes

#### Bug 3 fix: build context

**Current (broken):**
```yaml
# line 69
build:
  context: ../../backend
  dockerfile: Dockerfile
```

From `deploy/clients/<slug>/`, `../../backend` resolves to `deploy/backend` —
which does not exist. The backend lives at `backend/` (repo root).

**Fix:**
```yaml
build:
  context: ../../../backend
  dockerfile: Dockerfile
```

From `deploy/clients/<slug>/`, `../../../backend` resolves to `backend/` at the
repo root, where `Dockerfile` and `.dockerignore` live.

#### Bug 4: DB healthcheck start_period

Already present in the working tree (line 63): `start_period: 60s`. The full
healthcheck block is:

```yaml
healthcheck:
  test: ["CMD-SHELL", "pg_isready -U \"$${POSTGRES_USER}\" -d \"$${POSTGRES_DB}\""]
  interval: 10s
  timeout: 5s
  retries: 5
  start_period: 60s
```

**Why these values:**
- `start_period: 60s` — Postgres first-boot init (initdb + WAL) on a cold
  2GB VPS typically takes 20-40s; 60s covers the tail with margin.
- `interval: 10s` — fast enough to detect readiness quickly, slow enough to
  not hammer the container during init.
- `timeout: 5s` — `pg_isready` is a TCP-level check; 5s is generous.
- `retries: 5` — after `start_period`, 5 consecutive failures (50s) to mark
  unhealthy; transient glitches during schema push won't trigger this.

**No other template changes.** Container names, networks, volumes, the API
healthcheck, and the `depends_on: db: condition: service_healthy` are all
unchanged.

---

### 2.3 README.md — documentation corrections

#### TLS ownership section (Security checklist item)

**Current (wrong):**
```
The key is mode 644 so the postgres container (uid 70) can read it
```

**Fix:**
```
The key is mode 600, owned by uid 70 (postgres), so the postgres container
can read it through the read-only bind mount at /run/secrets. Owner (uid)
is what matters under chmod 600 — the old "mode 644" documentation was
incorrect.
```

#### Add idempotent rerun + smoke + abort documentation

Add a new subsection under "Adding clients for real":

```markdown
### Idempotent reruns

Re-running `add-client.sh <slug>` for an existing client is safe and
idempotent. It will:

1. Skip TLS/key generation (existing keys preserved)
2. Skip .env re-generation (existing secrets preserved)
3. Rebuild and restart the containers (`up -d --build`)
4. Run the smoke check (db healthy + /api/health 200)
5. Overwrite the Caddy site file (idempotent) and reload Caddy

If the stack is healthy after re-verification, the script exits 0 with
an "already provisioned — re-verified OK" message.

If a hard state conflict is detected (e.g. missing docker-compose.yml or
tls/server.key in an existing client dir), the script aborts with an
actionable message pointing at `remove-client.sh <slug>`.

### Smoke verification

After starting the containers, add-client.sh runs a self-checking smoke
step:

1. **DB health** (≤120s): waits for `db-<slug>` to reach `healthy` status
2. **API health** (≤60s): `docker exec` into `api-<slug>` and confirms
   `GET /api/health` returns 200 from inside the stack (no TLS/ACME needed)
3. **Caddy proxy** (best-effort): `curl http://<domain>/api/health` — if
   Caddy is running and the cert has been issued, this confirms end-to-end
   routing; if not, a non-fatal notice is printed

Any failure in steps 1 or 2 **aborts the run** (non-zero exit code) with
an actionable debug command. The broken stack is left in place for
diagnosis — it is never silently cleaned up.

### First-boot timing

On a cold VPS (empty Postgres data dir), first boot can take 60+ seconds
for Postgres to initialize. The healthcheck's `start_period: 60s` prevents
Compose from marking the DB unhealthy during this window. The smoke step's
120s timeout provides additional headroom.
```

---

## 3. Postgres TLS Design Decision

### Chosen approach: chown 70:70 on generated key

The per-client TLS keypair is generated by `openssl` in `add-client.sh` (running
as root on the VPS). After generation:

```
server.key  — uid 70, mode 600  (rw-------)
server.crt  — uid 70, mode 644  (r--r--r--)
```

The key is mounted read-only into the Postgres container:
```yaml
volumes:
  - ./tls:/run/secrets:ro
```

Postgres (running as the `postgres` user, uid 70 inside the container) reads
`/run/secrets/server.key` and `/run/secrets/server.crt` via the bind mount.

### Why Docker secrets (non-swarm) fail

Docker's `secrets:` top-level key in compose v2 non-swarm mode does not work
as expected:

- In swarm mode, Docker creates an in-memory filesystem at `/run/secrets` and
  **sets ownership to uid 70 (the container's USER)**. This works.
- In non-swarm (our case — single VPS, no swarm), `secrets:` is either
  ignored or creates a bind mount from a host file. If the host file is owned
  by root (the default for files created on the host), the `postgres` user
  inside the container still cannot read it through the mount — **the same
  uid mismatch problem**.
- Even if Docker honored the secret ownership, we'd need Docker to map host
  file uid 70, which requires the `postgres` user to exist on the host with
  that uid. On a standard Ubuntu VPS, uid 70 does not exist as a system user.

### Why in-entrypoint key generation fails

An alternative considered: generate the key inside the Postgres entrypoint script
(running as uid 70). This fails because:

- The entrypoint runs inside the container. The generated key would be ephemeral
  (lost on container restart) unless written to the mounted volume.
- Writing to the bind mount from uid 70 works for ownership, but the key is
  generated on every boot — if the container restarts, the key changes, and any
  cached TLS connection from the API container would break.
- More critically: `openssl` is not installed in `postgres:16-alpine`. Adding
  it would bloat the image and break the "stock image" contract.

### The chown 70:70 solution

Generated on the host (as root), then ownership set to uid 70:
```bash
openssl req -x509 ... -keyout tls/server.key -out tls/server.crt ...
chmod 600 tls/server.key
chown 70:70 tls/server.key    # <-- the fix
```

This works because:
1. The VPS operator runs as root (assumed, documented requirement).
2. `chown 70:70` on the host sets the inode owner to uid 70.
3. When the bind mount exposes the file inside the container, Linux VFS
   resolves access by the inode owner — the `postgres` user (uid 70) can
   read the file.
4. `chmod 600` ensures only uid 70 can read it (no other user on the host
   or in any other container).

### SSL config contract

In the compose template:
```yaml
command:
  - postgres
  - -c
  - ssl=on
  - -c
  - ssl_cert_file=/run/secrets/server.crt
  - -c
  - ssl_key_file=/run/secrets/server.key
```

In the backend (`backend/src/config/prisma.ts`):
```typescript
ssl: { rejectUnauthorized: false }
```

The self-signed certificate is never verified (transport encryption only, not
identity verification). The key guards TLS on the private per-client bridge;
DB access itself is gated by `POSTGRES_PASSWORD`.

---

## 4. Idempotency Design

### Exact guards

| Resource | Guard | First run | Rerun (exists) |
|----------|-------|-----------|-----------------|
| `$CLIENT_DIR` | `test -d` | Create + render | Skip render; set REVERIFY=1 |
| `$CLIENT_DIR/docker-compose.yml` | `test -s` (exists + non-empty) | Created by render | Must exist; abort if missing |
| `$CLIENT_DIR/tls/server.key` | `test -f` | Created by openssl | Must exist; abort if missing |
| `$CLIENT_DIR/tls/` dir | `mkdir -p` | Created | Already exists; no-op |
| `erp_proxy` network | `docker network inspect` | Create if absent | Already exists; no-op |
| `erp-db-<slug>` volume | Docker implicit create | Created by compose | Reused by compose |
| `erp-appdata-<slug>` volume | Docker implicit create | Created by compose | Reused by compose |
| `$SITES_DIR/$SLUG.caddy` | Overwrite on every run | Created | Overwritten idempotently |

### Rerun behavior: re-verify existing slots

When `REVERIFY=1`:

1. **Skip** TLS generation, `.env` write, envsubst render, backups dir creation.
2. **Run** idempotent resource ensure (network, tls dir).
3. **Run** `docker compose up -d --build` (rebuilds image with current code,
   restarts containers — idempotent, no data loss).
4. **Run** smoke check (db healthy + /api/health 200).
5. **Run** Caddy site write (idempotent overwrite) + reload + best-effort probe.
6. **Print** "already provisioned — re-verified OK" and exit 0.

### When hard abort triggers

The script hard-aborts (with a clear message and `exit 1`) on:

1. **Incomplete client dir:** `docker-compose.yml` is missing or empty inside an
   existing client dir. This indicates a partially-rendered slot from a crashed
   first run — the operator must clean up before retrying.
2. **Missing TLS key:** `tls/server.key` is missing inside an existing client
   dir. Without the key, Postgres will crash on start — not safe to re-verify.
3. **Smoke failure during re-verify:** db unhealthy or /api/health not 200.
   The script exits non-zero with the debug command but does NOT delete the
   existing slot (the operator may have data in the volumes).
4. **chown failure on TLS key** (first run only): Postgres won't be able to
   read the key — hard abort.

In all abort cases, the actionable message includes:
```
  Debug: docker compose -f $CLIENT_DIR/docker-compose.yml logs --tail=50 <service>
  Escape hatch: ./deploy/scripts/remove-client.sh $SLUG
```

---

## 5. Smoke/Verification Design

### Wait loop parameters

| Probe | Timeout | Rationale |
|-------|---------|-----------|
| DB healthy | 120s | `start_period` 60s + 60s margin for cold VPS + slow init |
| /api/health (inside-stack) | 60s | API starts after DB healthy; `start_period` 30s + margin |
| Caddy HTTP proxy | 10s (single curl) | Best-effort only; ACME cert issuance can take minutes |

**Total worst-case smoke time: 190s** (if both DB and API hit their timeouts).
Typical case: 10-30s on a warm VPS.

### Exact probe commands

**DB health probe:**
```bash
docker inspect --format '{{.State.Health.Status}}' "db-$SLUG"
# Expected output when healthy: "healthy"
# Checked every 5s within the 120s window
```

**API health probe (inside-stack):**
```bash
docker exec "api-$SLUG" \
  node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# Exit code 0 = healthy, non-zero = unhealthy
# Uses Node's built-in fetch (Node 20, available in the runtime image)
# Probes the Express /api/health endpoint directly on its listen address
```

**Caddy HTTP proxy probe (best-effort):**
```bash
curl -sf --max-time 10 "http://$CLIENT_DOMAIN/api/health"
# HTTP (not HTTPS) because port 443 may be firewalled mid-bootstrap
# Non-fatal: failure produces a notice, not an abort
```

### Abort semantics

On smoke failure:

```bash
echo "ERROR: <specific failure>" >&2
echo "  Debug: docker compose -f $CLIENT_DIR/docker-compose.yml logs --tail=50 <service>" >&2
echo "  Escape hatch: ./deploy/scripts/remove-client.sh $SLUG" >&2
exit 1
```

The stack is **never** silently cleaned up on smoke failure (unlike the
pre-up cleanup trap). Rationale: after `docker compose up`, containers and
volumes may contain useful diagnostic state. The operator inspects, then
decides whether to `remove-client.sh` or fix and re-run.

### Re-verify smoke (idempotent rerun)

Same probes, same timeouts, same abort semantics. The only difference: the
"already provisioned" header message and the skip of TLS/render steps.

---

## 6. Failure/Rollback Design

### Failure matrix

| Stage | Failure | Script behavior | Stack state | Recovery |
|-------|---------|-----------------|-------------|----------|
| 1. Validate | Bad slug, missing deps | `fail()` → exit 1 | Nothing created | Fix and re-run |
| 2. Render | envsubst fails, bad vars | Trap cleanup removes partial dir; exit 1 | Nothing created | Fix and re-run |
| 3. TLS | openssl fails | Trap cleanup removes partial dir; exit 1 | Nothing created | Fix and re-run |
| 3. TLS | chown 70:70 fails | `fail()` → exit 1, no trap cleanup (key exists) | TLS dir exists, key root-owned | `chmod 70:70` manually or re-run (regenerates key) |
| 4. Resources | Network create fails | Should never happen (idempotent); if it does, trap cleanup runs | Partial or nothing | Check Docker daemon |
| 5. Compose up | Build fails | Trap cleanup runs (CLEANUP_DISABLED=0); exit 1 | Containers not started; dir removed | Fix build error and re-run |
| 5. Compose up | Start fails | Trap cleanup runs; exit 1 | Containers not started; dir removed | Fix and re-run |
| 6. Smoke | DB never healthy | Exit 1, stack left in place | Containers running, DB unhealthy | `docker compose logs db`; fix, then re-run |
| 6. Smoke | API not healthy | Exit 1, stack left in place | Containers running, API unhealthy | `docker compose logs api`; fix, then re-run |
| 7. Caddy | Caddy not running | Non-fatal notice; exit 0 | Stack healthy, no routing | `docker compose up -d` for Caddy |
| 7. Caddy | HTTP probe fails | Non-fatal notice; exit 0 | Stack healthy, ACME pending | Wait for cert issuance |

### Rollback

This is a bugfix to shell scripts and a compose template — no data mutation.

- **Repo rollback:** `git checkout <prev> -- deploy/scripts/add-client.sh deploy/templates/docker-compose.client.yml`
- **VPS rollback:** pull the previous revision in the `/opt/erp-market` clone,
  re-run `add-client.sh` for affected clients.
- **Client removal:** `remove-client.sh <slug>` is the escape hatch for any
  client in a broken state. It tears down containers, volumes, networks, and
  the Caddy site. Database backups under `deploy/backups/<slug>/` are preserved.

No destructive migration, no schema changes, no data loss on rollback.

---

## 7. Test/Verification Strategy

### Static checks (pre-apply, in repo working tree)

1. **Shellcheck:** `shellcheck deploy/scripts/add-client.sh` — must pass with no
   warnings or errors. The script uses `set -Eeuo pipefail` so most runtime
   issues are caught at dev time.

2. **Grep verification of each bug fix:**
   ```bash
   # BUG 1: CLIENT_SLUG is assigned before envsubst
   grep -n 'CLIENT_SLUG="\$SLUG"' deploy/scripts/add-client.sh

   # BUG 2: no -q flag in compose up
   grep -n 'up -d --build' deploy/scripts/add-client.sh | grep -v '\-q'

   # BUG 3: build context is ../../../backend
   grep -n 'context: ../../../backend' deploy/templates/docker-compose.client.yml

   # BUG 4: start_period present in db healthcheck
   grep -n 'start_period: 60s' deploy/templates/docker-compose.client.yml

   # BUG 5: chown 70:70 on server.key
   grep -n 'chown 70:70.*server\.key' deploy/scripts/add-client.sh
   ```

3. **Template variable audit:** verify envsubst's variable list matches the
   `${...}` placeholders in the template:
   ```bash
   # Extract template vars (excluding $$)
   grep -oE '\$\{[A-Z_]+\}' deploy/templates/docker-compose.client.yml | sort -u | sed 's/[${}]//g'
   # Should match the envsubst list: CLIENT_SLUG CLIENT_DOMAIN CLIENT_URL DB_NAME DB_USER DB_PASSWORD JWT_SECRET
   ```

4. **Idempotency guard presence:** verify the REVERIFY path skips TLS render:
   ```bash
   grep -c 'REVERIFY' deploy/scripts/add-client.sh
   # Should show multiple hits (assignment, conditionals, etc.)
   ```

### Live VPS checks (apply phase, on /opt/erp-market)

1. **Propagate and verify:** copy fixed files to `/opt/erp-market/deploy/`,
   then run the same grep checks above against the VPS copy.

2. **Dry-run with an existing client:** re-run `add-client.sh` for an already
   provisioned slug and confirm it exits 0 with "re-verified OK".

3. **Fresh client smoke test:** provision a brand-new slug on the VPS, confirm
   the smoke step passes (db healthy + /api/health 200) and the summary prints
   "LIVE".

4. **TLS ownership check on a live client:**
   ```bash
   stat -c '%u:%a %n' deploy/clients/<slug>/tls/server.key
   # Expected: 70:600 deploy/clients/<slug>/tls/server.key
   ```

5. **Postgres log check:** confirm no "could not load server certificate file"
   error in the DB container logs:
   ```bash
   docker compose -f deploy/clients/<slug>/docker-compose.yml logs db 2>&1 | grep -i "certificate"
   # Should return nothing
   ```

### What is NOT tested

- Full HTTPS/ACME end-to-end (out of scope; the Caddy HTTP probe is
  best-effort only).
- APK build (separate script, separate concern).
- Client removal (escape hatch, tested independently).

---

## 8. Risks & Mitigations

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Idempotent rerun re-generates secrets, breaking a live client | Low | REVERIFY guard skips TLS/.env/envsubst entirely; only compose up + smoke runs on rerun |
| Smoke step falsely fails during slow first boot | Med | DB wait timeout 120s (2× start_period) + API wait 60s; typical first boot is 20-40s |
| Caddy HTTP probe fails because domain is a custom domain without DNS | Low | Probe is non-fatal; in-stack docker exec is the mandatory gate |
| chown 70:70 fails on non-Linux filesystem (e.g. macOS dev) | Low | Script assumes root-capable VPS; guard with `fail()` + actionable message |
| Propagation drift between repo and /opt/erp-market | Med | Apply phase re-runs the same grep checks against VPS copy; verify report confirms all 5 bugs gone |
| Cleanup trap deletes a healthy slot on re-verify smoke failure | Low | CLEANUP_DISABLED=1 set immediately when REVERIFY=1; trap only runs for pre-up failures |
| `docker exec` probe fails because API container is restarting | Low | 60s window with 5s polling gives 12 attempts; container should stabilize within this window |
| `envsubst` variable mismatch (new template var added but not in export list) | Low | Fixed variable list is explicit; adding a new var requires updating both the template and the export list — shellcheck or grep audit catches this |

---

## Decisions Log

| Decision | Rationale |
|----------|-----------|
| **TLS key chowned, not Docker secrets** | Non-swarm Docker secrets don't fix uid ownership; in-entrypoint generation needs openssl (not in alpine). chown 70:70 on host is the simplest fix. |
| **Cleanup trap keeps existing behavior (delete partial dir on pre-up failure)** | Partial dirs from failed first runs are junk; no data to preserve. Post-up failures use CLEANUP_DISABLED=1. |
| **TLS dir NOT preserved on pre-up failure** | Key is freshly generated, regenerable, has no value outside this run. Leaving a dead TLS dir adds confusion. |
| **Re-verify is re-verify, not re-provision** | Existing clients are re-provisioned (compose up --build) and re-smoked, but their secrets, TLS keys, and .env are never regenerated. |
| **Caddy probe over HTTP, non-fatal** | Port 443 is firewalled mid-bootstrap; ACME cert takes minutes. In-stack probe is the real gate. |
| **DB wait 120s, API wait 60s** | Conservative bounds for a cold 2GB VPS. Typical case is 10-30s; worst case is still bounded. |
| **Abort leaves stack in place** | After compose up, the stack may contain useful diagnostic state (logs, running containers). Silent cleanup hides the problem. |
| **remove-client.sh is the escape hatch** | For any broken state, the operator can fully tear down and start fresh. This is safer than trying to "fix in place". |
