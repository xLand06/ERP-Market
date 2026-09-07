# ERP-Market — Multi-Tenant Deployment Kit

Runs **one ERP-Market backend per client** on a single VPS, each with its own
isolated PostgreSQL database and API container, all behind **one central Caddy
reverse proxy** with automatic HTTPS (Let's Encrypt). Adding a client is one
command:

```bash
./deploy/scripts/add-client.sh acme
```

## Architecture

```
Phone / Tablet (ERP APK, offline-first SQLite)
   │  HTTPS (REST + sync, /api/*)
   ▼
https://<slug>.<domain-or-ip>.sslip.io
   │
   ▼
Caddy :443  (single entrypoint, Let's Encrypt TLS, ACME email)
   │  Docker DNS on the shared `erp_proxy` bridge — no host ports per client
   ▼
api-<slug>:3000   (Express + Prisma, isolated container, non-root)
   │  postgresql://...@db:5432/erp_market
   ▼
db-<slug>         (PostgreSQL 16, only reachable from api-<slug>)
```

- **No domain yet?** Client hostnames like `acme.203.0.113.10.sslip.io`
  resolve to your VPS through sslip.io wildcard DNS — each client still gets
  real HTTPS via ACME, zero DNS work.
- **Offline-first note:** the backend writes to a local SQLite file under
  `/app` (kept in a per-client volume) and a sync worker pushes to Postgres
  every ~15 minutes. Postgres is the durable source of truth; backups dump it.

```
deploy/
├── docker-compose.yml               # OPERATOR stack: the Caddy proxy only
├── caddy/
│   ├── Caddyfile                    # central proxy config (imports sites/*)
│   └── sites/<slug>.caddy           # one site file per client (generated)
├── templates/docker-compose.client.yml   # per-client stack template
├── scripts/
│   ├── add-client.sh                # provision a client  <slug> [domain]
│   ├── remove-client.sh             # tear down a client   <slug>
│   ├── backup-clients.sh            # pg_dump all clients, prune old dumps
│   └── build-apk.sh                 # build APK for a client  <slug>
├── .env.example                     # operator config (BASE_DOMAIN, CADDY_EMAIL)
├── clients/<slug>/                  # rendered stacks + secrets (gitignored)
└── backups/<slug>/*.sql.gz          # dumps (gitignored)
```

## Getting started

1. **VPS**: any cheap 2GB/2vCPU box (Hetzner CX22 is plenty), Ubuntu 24.04,
   open ports 22/80/443 in the firewall.
2. **Install Docker** + the compose plugin:

   ```bash
   curl -fsSL https://get.docker.com | sh
   ```

3. **Clone the repo** and configure the operator:

   ```bash
   git clone <repo-url> erp-market && cd erp-market
   cp deploy/.env.example deploy/.env
   nano deploy/.env          # set CADDY_EMAIL=you@example.com (required for ACME)
   docker compose -f deploy/docker-compose.yml up -d
   ```

   Caddy is now listening on 80/443. With no client sites yet it serves
   nothing — `curl -s http://<vps-ip>/` should still answer (Caddy 404/200),
   which proves the proxy is up and the firewall lets traffic through.

4. **Add your first client** (test drive):

   ```bash
   ./deploy/scripts/add-client.sh test
   ```

   The script builds the API image (npm install + Prisma generate + tsc —
   takes a few minutes the first time), starts `db-test` + `api-test`, writes
   the Caddy site, reloads the proxy and verifies
   `https://test.<vps-ip>.sslip.io/api/health` returns 200.

5. **Build the APK** for that client and install it on the phone:

   ```bash
   ./deploy/scripts/build-apk.sh test
   # then, on a machine with the Android SDK:
   cd frontend/android && ./gradlew assembleDebug
   # APK: frontend/android/app/build/outputs/apk/debug/app-debug.apk
   ```

   The APK's API base is baked in as `https://test.<vps-ip>.sslip.io/api`
   (`frontend/.env` is temporarily edited and always restored).

## Adding clients for real

```bash
./deploy/scripts/add-client.sh minimarket        # sslip.io hostname from VPS IP
./deploy/scripts/add-client.sh vinoteca erp.acme.com   # explicit domain
```

Each client gets: an isolated stack (`db-<slug>` + `api-<slug>`, no host
ports), its own Postgres volume + app-data volume, fresh `DB_PASSWORD` and
`JWT_SECRET` (openssl rand -hex 24), and its own Caddy site. Nothing else on
the server changes.

Removing a client (confirms by typing the slug, deletes its volumes):

```bash
./deploy/scripts/remove-client.sh minimarket
```

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

After starting the containers, `add-client.sh` runs a self-checking smoke
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

## When you get a real domain

1. Buy a domain and point a wildcard record at the VPS:
   `*.yourdomain.com  A  <vps-ip>` (Caddy/ACME needs the DNS record; the
   certificate is issued automatically on first request).
2. Add future clients with explicit domains:
   `./deploy/scripts/add-client.sh acme acme.yourdomain.com`.
3. Set `BASE_DOMAIN=yourdomain.com` in `deploy/.env` so future adds without
   an explicit domain use it. **Existing clients keep their URLs** (each has
   its own site file; nothing is rewritten).

## Backup & restore

```bash
./deploy/scripts/backup-clients.sh          # all clients -> deploy/backups/<slug>/
BACKUP_KEEP_DAYS=30 ./deploy/scripts/backup-clients.sh
```

Restore a single client (one line):

```bash
gunzip -c deploy/backups/<slug>/<file>.sql.gz \
  | docker compose -f deploy/clients/<slug>/docker-compose.yml exec -T db \
      psql -U erp -d erp_market
```

Dumps may lag the latest writes by up to one sync cycle (~15 min) due to the
offline-first write path — that is the app's contract, Postgres remains the
point-in-time backup source.

## Operations

```bash
# Health of a client's stack
docker compose -f deploy/clients/<slug>/docker-compose.yml ps

# Logs
docker compose -f deploy/clients/<slug>/docker-compose.yml logs -f --tail=100 api
docker compose -f deploy/docker-compose.yml logs caddy            # proxy/ACME

# The schema self-syncs: each api boot runs `prisma db push` (idempotent)
# against its own Postgres before serving. Destructive schema changes are
# NOT auto-applied — handle those with an explicit migration per client.

# Upgrade the API image after pulling new backend code
docker compose -f deploy/clients/<slug>/docker-compose.yml up -d --build
# ...then remove the old image: docker image prune
```

`restart: unless-stopped` on every service + auto-schema on boot means the
stack self-heals across reboots. Caddy restarts keep serving from
`caddy_data` (persisted certs).

## Security checklist

- [ ] Firewall: only 22/80/443 (`ufw allow 22,80,443/tcp && ufw enable`); sshd: key-only auth.
- [ ] `deploy/.env` and `deploy/clients/*/` are gitignored — never commit client `.env` files (they hold `DB_PASSWORD` + `JWT_SECRET`).
- [ ] Each client has its own `JWT_SECRET`; a leak is contained to one tenant.
- [ ] Databases are on the private per-client bridge only — not reachable from the host or the proxy.
- [ ] API containers run as the unprivileged `node` user; secrets come from env, never baked into the image.
- [ ] Set `CADDY_EMAIL` — cert expiry/notice emails go there; missing it, ACME accounts are created with no contact.
- [ ] Per-client Postgres TLS: the backend's cloud client hardcodes `ssl: {rejectUnauthorized:false}`, so each client DB runs `ssl=on` with a self-signed keypair generated by `add-client.sh` (in `deploy/clients/<slug>/tls/`, gitignored). The key is mode 600, owned by uid 70 (postgres), so the container can read it through the read-only bind mount at `/run/secrets`. Owner (uid) is what matters under `chmod 600` — it only protects the private per-client bridge; DB access is still gated by `POSTGRES_PASSWORD`.
- [ ] Run `backup-clients.sh` on a schedule (cron: `15 3 * * *` works).

## Limitations & tradeoffs

- **Postgres lives on the same VPS as the app** — that is the point (cheap,
  isolated per client), so backups are mandatory; there is no replication.
- **No pgbouncer yet**: the backend pools at 5 connections per client, which
  fits the expected device fleet. The single-tenant reference in `docker/`
  (pgbouncer + nginx) is the documented path when one client outgrows it.
- **Image size**: the runtime image keeps `node_modules` including the Prisma
  CLI (a devDependency) so the entrypoint can `prisma db push` on boot. Cost:
  a few hundred MB per client image (they share layers, so disk use is mostly
  one copy). Tradeoff chosen for "adding a client is trivial".
- **No Coolify/dashboard yet**: the kit is standalone CLI. A panel (Coolify
  or similar) can be layered on later without changing the layout.
- **sslip.io caveat**: auto-hostnames use the VPS public IP — if the IP
  changes, client URLs change (re-run `add-client.sh` with a new slug or move
  to a real domain).

## Single-tenant alternative

`docker-compose.vps.yml` (repo root) is the older, minimal single-tenant
stack: one Postgres + pgbouncer + one API + nginx. It still works for one
client but does NOT isolate tenants and conflicts with this kit on ports
80/443 — run one or the other on a host.

## Troubleshooting

| Symptom | Check |
|---|---|
| `https://<slug>...` TLS error | `docker compose -f deploy/docker-compose.yml logs caddy` — ACME rate limits / DNS not propagated |
| `/api/health` 200 but app calls fail | `docker compose -f deploy/clients/<slug>/docker-compose.yml logs api` |
| Client stack stuck "starting" | `docker inspect api-<slug>` — healthcheck probes `fetch('http://127.0.0.1:3000/api/health')` |
| `prisma db push` failing at boot | Postgres not ready yet is handled (retries); persistent failure ⇒ check `DIRECT_URL` in the client `.env` |
| Ports 80/443 busy | The old single-tenant stack (docker-compose.vps.yml) or another nginx is running |