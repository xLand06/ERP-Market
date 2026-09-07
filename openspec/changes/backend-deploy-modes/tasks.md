# Tasks: backend-deploy-modes

## Review Workload Forecast

| Task | Estimated changed lines |
|---|---|
| T1: env.ts DEPLOY_MODE | ~15 |
| T2: prisma.ts Proxy routing | ~20 |
| T3: app.ts health + electron endpoints | ~25 |
| T4: Dockerfile entrypoint | ~12 |
| T5: docker-compose.client.yml | ~10 |
| T6: Downstream services | ~30 |
| **TOTAL** | **~112** |

**Review budget**: 112 lines — WELL UNDER 800. No chaining needed. Single PR recommended.

**Decision needed before apply**: No.

---

## T1: Add DEPLOY_MODE to env.ts

**Requirement**: REQ-DEPLOY-001

**Files**: `backend/src/config/env.ts`

**Description**: Introduce `DEPLOY_MODE` type and resolution logic with ELECTRON auto-detection.

**Acceptance criteria**:
- `python 3`-style: `DEPLOY_MODE` resolves to `server`, `desktop`, or `mobile`
- `ELECTRON=true` with no explicit mode resolves to `desktop`
- No mode + not Electron resolves to `server`
- Add `DEPLOY_MODE` to the `env` object

**Estimated lines**: ~15

---

## T2: Route prisma Proxy by DEPLOY_MODE

**Requirement**: REQ-DEPLOY-002

**Files**: `backend/src/config/prisma.ts`

**Description**: Modify the `prisma` Proxy to bind to Postgres in server mode (fail-fast) and SQLite in device modes.

**Acceptance criteria**:
- `DEPLOY_MODE=server` + Postgres → `prisma.*` queries Postgres
- `DEPLOY_MODE=server` + no Postgres → clear fatal error, no silent fallback
- `DEPLOY_MODE=desktop`/`mobile` → `prisma.*` queries SQLite (unchanged)
- No regressions: all existing `prisma` calls still compile and work

**Estimated lines**: ~20

---

## T3: Mode-aware health endpoint

**Requirement**: REQ-DEPLOY-003

**Files**: `backend/src/app.ts`

**Description**: Health check uses Postgres in server mode, SQLite in device modes. Add `deployMode` to response. Update electron-only `/api/electron/*` endpoints to be safe in server mode (they harmlessly return nothing usable, but should not crash).

**Acceptance criteria**:
- `/api/health` returns `deployMode` field matching `env.DEPLOY_MODE`
- Server mode checks Postgres; device modes check SQLite
- Server mode with DB down → `database.status: "error"` (not crash)
- Electron endpoints still work in desktop mode

**Estimated lines**: ~25

---

## T4: Dockerfile conditional SQLite push

**Requirement**: REQ-DEPLOY-004

**Files**: `backend/Dockerfile`

**Description**: Wrap the local SQLite schema push in a `DEPLOY_MODE` check. Add `ENV DEPLOY_MODE=server` default.

**Acceptance criteria**:
- `DEPLOY_MODE=server` → skips `prisma db push --schema=prisma/schema.local.prisma`, logs "skipping SQLite schema"
- Device modes → runs both pushes (unchanged)
- Cloud push always runs (server is the authority)

**Estimated lines**: ~12

---

## T5: Compose template server mode

**Requirement**: REQ-DEPLOY-005

**Files**: `deploy/templates/docker-compose.client.yml`

**Description**: Add `DEPLOY_MODE: "server"`, remove `USE_LOCAL_DB`, remove the `/app` volume mount from the api service.

**Acceptance criteria**:
- Rendered client stack has `DEPLOY_MODE=server`
- No `USE_LOCAL_DB` env var
- No `/app` volume
- Auth works against Postgres on boot (no 401)

**Estimated lines**: ~10

---

## T6: Downstream services use DEPLOY_MODE

**Requirement**: REQ-DEPLOY-006

**Files**:
- `backend/src/core/middlewares/audit.middleware.ts`
- `backend/src/modules/dashboard/dashboard.service.ts`
- `backend/src/modules/sync/status.service.ts`
- `backend/src/modules/audit/audit.service.ts`

**Description**: Replace direct `USE_LOCAL_DB`/`ELECTRON` checks for DB selection with `DEPLOY_MODE` comparisons.

**Acceptance criteria**:
- Audit middleware routes to Postgres in server mode, SQLite in device modes
- Dashboard reads from Postgres in server mode
- `/api/sync/status` reports the active deployMode
- Audit service uses correct SQL dialect per mode

**Estimated lines**: ~30
