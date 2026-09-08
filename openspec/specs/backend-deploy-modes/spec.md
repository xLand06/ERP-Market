# Spec: backend-deploy-modes

## Requirements

### REQ-DEPLOY-001: DEPLOY_MODE environment variable

**Title**: Single deploy mode source of truth

**Description**: The backend exposes a `DEPLOY_MODE` environment variable accepting `server`, `desktop`, or `mobile`. When unset but `ELECTRON=true`, it resolves to `desktop`. When unset and not Electron, it resolves to `server`.

**Acceptance criteria**:
- GIVEN `DEPLOY_MODE=server` is set, WHEN the backend loads, THEN `env.DEPLOY_MODE === 'server'`
- GIVEN `DEPLOY_MODE=desktop` is set, WHEN the backend loads, THEN `env.DEPLOY_MODE === 'desktop'`
- GIVEN `DEPLOY_MODE=mobile` is set, WHEN the backend loads, THEN `env.DEPLOY_MODE === 'mobile'`
- GIVEN `DEPLOY_MODE` is unset and `ELECTRON=true`, WHEN the backend loads, THEN `env.DEPLOY_MODE === 'desktop'`
- GIVEN `DEPLOY_MODE` is unset and not Electron, WHEN the backend loads, THEN `env.DEPLOY_MODE === 'server'`

### REQ-DEPLOY-002: prisma routing respects DEPLOY_MODE

**Title**: Database authority follows deploy mode

**Description**: The `prisma` export Proxy routes to PostgreSQL in server mode and SQLite in device modes (desktop/mobile). In server mode, a missing PostgreSQL connection is fatal (the server cannot function without its authority database).

**Acceptance criteria**:
- GIVEN `DEPLOY_MODE=server` and `DATABASE_URL` configured, WHEN a module calls `prisma.user.findUnique()`, THEN it queries PostgreSQL
- GIVEN `DEPLOY_MODE=server` and `DATABASE_URL` NOT configured, WHEN a module calls `prisma.*`, THEN it throws a descriptive error identifying the missing connection
- GIVEN `DEPLOY_MODE=desktop` or `mobile`, WHEN a module calls `prisma.*`, THEN it queries the local SQLite (unchanged behavior)
- GIVEN any mode, WHEN a module calls `prisma.*`, THEN the return value and method signatures are identical (Proxy transparency)

### REQ-DEPLOY-003: Health endpoint is mode-aware

**Title**: Health check verifies the correct database

**Description**: `/api/health` checks PostgreSQL in server mode and SQLite in device modes. It reports the active `deployMode` and the checked database.

**Acceptance criteria**:
- GIVEN `DEPLOY_MODE=server` and Postgres reachable, WHEN `GET /api/health`, THEN response includes `deployMode: "server"` and `database.status: "connected"`
- GIVEN `DEPLOY_MODE=server` and Postgres unreachable, WHEN `GET /api/health`, THEN response includes `database.status: "error"`
- GIVEN `DEPLOY_MODE=desktop` or `mobile`, WHEN `GET /api/health`, THEN it checks SQLite (unchanged behavior)
- GIVEN any mode, WHEN `GET /api/health`, THEN the response includes the `deployMode` field

### REQ-DEPLOY-004: Dockerfile skips SQLite in server mode

**Title**: No SQLite file created on VPS

**Description**: The Dockerfile entrypoint conditionally runs `prisma db push --schema=prisma/schema.local.prisma` only for device modes. In server mode, only the cloud schema is pushed and no SQLite file is created.

**Acceptance criteria**:
- GIVEN image runs with `DEPLOY_MODE=server`, WHEN the container starts, THEN only `prisma db push` (cloud) runs and NO SQLite file is created at `/app`
- GIVEN image runs with `DEPLOY_MODE=desktop` or `mobile`, WHEN the container starts, THEN both cloud and local schema pushes run (unchanged)
- GIVEN server mode, WHEN the entrypoint runs, THEN the boot log shows "[entrypoint] server mode — skipping SQLite schema"

### REQ-DEPLOY-005: Compose template uses DEPLOY_MODE

**Title**: Per-client template sets server mode

**Description**: The `docker-compose.client.yml` template sets `DEPLOY_MODE: "server"` on the api service, removes `USE_LOCAL_DB`, and removes the `/app` volume (no SQLite persistence needed in server mode).

**Acceptance criteria**:
- GIVEN a client is provisioned via `add-client.sh`, WHEN the rendered stack runs, THEN `api-<slug>` has `DEPLOY_MODE=server`
- GIVEN the rendered client stack, THEN the api service has NO `USE_LOCAL_DB` env var
- GIVEN the rendered client stack, THEN the api service has NO `/app` volume mount
- GIVEN a fresh client stack boot, THEN auth login works against Postgres (no 401)

### REQ-DEPLOY-006: Downstream services use DEPLOY_MODE

**Title**: Secondary flags replaced

**Description**: Services that checked `USE_LOCAL_DB` or `ELECTRON` for DB selection now check `DEPLOY_MODE`. Specifically: `audit.middleware.ts`, `dashboard.service.ts`, `sync/status.service.ts`, `audit.service.ts`.

**Acceptance criteria**:
- GIVEN `DEPLOY_MODE=server`, WHEN audit middleware writes a log, THEN it targets PostgreSQL
- GIVEN `DEPLOY_MODE=desktop`, WHEN audit middleware writes a log, THEN it targets SQLite
- GIVEN `DEPLOY_MODE=server`, WHEN dashboard loads, THEN it reads from PostgreSQL
- GIVEN any mode, WHEN `/api/sync/status`, THEN the response reports the active `deployMode` and corrected DB state

## Scenarios

### SC-001: VPS auth login works

**Precondition**: VPS has Postgres running with seeded users. `DEPLOY_MODE=server` set.

**When**: A user POSTs to `/api/auth/login` with valid username/password.

**Then**: Returns 200 with `{ token, refreshToken, user }`. The token works on authenticated requests.

**Verification**: `curl -X POST https://<client-domain>/api/auth/login -H 'Content-Type: application/json' -d '{"username":"admin","password":"secret"}'` returns 200, not 401.

### SC-002: No SQLite on VPS

**Precondition**: VPS stack provisioned with server mode.

**When**: Container starts and runs for 5 minutes.

**Then**: `docker exec api-<slug> ls -la /app` shows NO `erp-market.db`. Only `dist`, `node_modules`, `package.json`, `prisma.config.ts` present.

### SC-003: Electron still uses SQLite

**Precondition**: Electron app launches with `ELECTRON=true`, no `DEPLOY_MODE` set.

**When**: App loads its embedded backend on `127.0.0.1:3001`.

**Then**: `getLocalPrisma()` initializes, SQLite at userData path, auth checks work offline.

### SC-004: Server without DATABASE_URL fails clearly

**Precondition**: `DEPLOY_MODE=server` set, no `DATABASE_URL`/`DIRECT_URL`.

**When**: Any module calls `prisma.*`.

**Then**: Throws with message containing "DEPLOY_MODE=server but DATABASE_URL not configured".

### SC-005: Health reports server Postgres

**Precondition**: Server mode with healthy Postgres.

**When**: `GET /api/health`.

**Then**: `{ status: "ok", deployMode: "server", database: { status: "connected", responseTime: "Xms" } }`.

## Implementation Notes

| File | Change |
|---|---|
| `backend/src/config/env.ts` | Add DEPLOY_MODE with auto-detection |
| `backend/src/config/prisma.ts` | Proxy routes to cloud in server mode |
| `backend/src/app.ts` | Health check + /api/electron endpoints mode-aware |
| `backend/Dockerfile` | Conditional SQLite push + ENV DEPLOY_MODE |
| `deploy/templates/docker-compose.client.yml` | DEPLOY_MODE=server, remove USE_LOCAL_DB + /app |
| `backend/src/core/middlewares/audit.middleware.ts` | Use DEPLOY_MODE for DB selection |
| `backend/src/modules/dashboard/dashboard.service.ts` | Use DEPLOY_MODE |
| `backend/src/modules/sync/status.service.ts` | Report DEPLOY_MODE |
| `backend/src/modules/audit/audit.service.ts` | Use DEPLOY_MODE for SQL dialect |
