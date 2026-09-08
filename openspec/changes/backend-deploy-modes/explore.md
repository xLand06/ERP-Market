# Exploration: backend-deploy-modes

## Problem Statement

The backend has a single `prisma` export that ALWAYS routes to SQLite via a Proxy (line 201 of `backend/src/config/prisma.ts`). Postgres is only accessed through `getCloudPrisma()` which is called exclusively by sync services. In the VPS deployment (server mode), this causes:

1. **Auth 401**: `auth.middleware.ts` line 78 reads `prisma.user.findUnique()` against SQLite — which is empty on a fresh VPS deploy. Users were seeded to Postgres, but auth reads SQLite.
2. **Wasted resources**: Dockerfile entrypoint (line 126) creates `/app/erp-market.db` SQLite in every container, then the sync worker pushes it to Postgres. The server IS the Postgres — it's syncing to itself.
3. **Confusing defaults**: `env.ts` line 29 defaults `USE_LOCAL_DB` to `'true'`, overriding the Docker compose setting.
4. **No unified platform detection**: Scattered across `process.env.ELECTRON`, `USE_LOCAL_DB`, `(window as any).erpApi?.isElectron` with no single source of truth.

## Current Architecture (as-is)

### Database routing

```
prisma (main export)
  └─ Proxy → getLocalPrisma() → SQLite (ALWAYS)

getCloudPrisma() → PostgreSQL (nullable, sync-only)
  └─ Used by: sync-worker, push-sales, pull-catalog, inventory-sync,
     connectivity, backup, dashboard (when isElectron=false)
```

### Platform detection (scattered)

| Signal | Where | What it controls |
|---|---|---|
| `process.env.ELECTRON` | `env.ts:11`, `prisma.ts:34`, `audit.middleware.ts:82`, `dashboard.service.ts:17,67`, `audit.service.ts:80` | .env path, offline guard, SQL dialect, stats |
| `process.env.USE_LOCAL_DB` | `env.ts:29`, `prisma.ts:34`, `dashboard.service.ts:17`, `audit.middleware.ts:82`, `sync/status.service.ts:58`, `sync/routes.ts:107` | Cloud client availability, audit routing, status report |
| `(window).erpApi?.isElectron` | `api.ts:11,86`, `authStore.ts:46` | Frontend baseURL, auth storage adapter |
| `window.location.protocol === 'file:'` | `api.ts:11,86` | Frontend baseURL, logout redirect |

### Files that import from `config/prisma` (36 files)

**Business modules (use `prisma` — the SQLite proxy):**
- `auth/auth.service.ts` — login, getUserById, createUser, updateUser
- `core/middlewares/auth.middleware.ts` — user existence check after JWT verify
- `core/middlewares/audit.middleware.ts` — audit log writes
- `products/products.service.ts`
- `categories/categories.service.ts`
- `branches/branches.service.ts`
- `users/users.service.ts`
- `pos/pos.service.ts`, `pos/pos.controller.ts`
- `sales/sales.service.ts`
- `inventory/inventory.service.ts`, `inventory/inventory.export.service.ts`
- `merma/merma.service.ts`
- `stocktaking/stocktaking.service.ts`
- `cashFlow/cashFlow.service.ts`, `cashFlow/cashFlow-automation.ts`
- `purchases/purchases.service.ts`
- `suppliers/suppliers.service.ts`
- `finance/finance.service.ts`
- `reports/reports.routes.ts`
- `search/search.routes.ts`
- `batches/batches.service.ts`
- `settings/settings.service.ts`
- `audit/audit.service.ts`

**Sync module (uses `getCloudPrisma()` / `getLocalPrisma()` directly):**
- `sync/sync.routes.ts` — imports `prisma`, `getLocalPrisma`, `getCloudPrisma`
- `sync/push-sales.service.ts` — `getCloudPrisma`, `getLocalPrisma`
- `sync/pull-catalog.service.ts` — `prismaCloud`, `getLocalPrisma`
- `sync/inventory-sync.service.ts` — `getCloudPrisma`
- `sync/connectivity.service.ts` — `getCloudPrisma`
- `sync/outbox-sync.service.ts` — `getLocalPrisma`
- `sync/status.service.ts` — `getLocalPrisma`

**Infrastructure:**
- `backup/backup.service.ts` — `getLocalPrisma`, `getCloudPrisma`
- `dashboard/dashboard.service.ts` — `prisma`, `getCloudPrisma`

**App entrypoints:**
- `app.ts` — health check uses `getLocalPrisma()`, `/api/electron/*` endpoints
- `server.ts` — graceful shutdown uses `getLocalPrisma()`

**Scripts:**
- `scripts/seed-sales.ts` — `getLocalPrisma`
- `scripts/test-cloud-stats.ts` — `getCloudPrisma`
- `scripts/purge-db.ts` — `prisma`

## Proposed Architecture

### Introduce `DEPLOY_MODE` in `env.ts`

```typescript
type DeployMode = 'server' | 'desktop' | 'mobile';

const rawMode = process.env.DEPLOY_MODE?.toLowerCase();
export const DEPLOY_MODE: DeployMode =
    rawMode === 'desktop' || rawMode === 'mobile' ? rawMode : 'server';
```

### Modify `prisma.ts` Proxy to respect DEPLOY_MODE

```typescript
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
    get(_target, prop: string) {
        const db: PrismaClient =
            DEPLOY_MODE === 'server'
                ? getCloudPrisma() || throwFatal('Server mode requires DATABASE_URL')
                : getLocalPrisma();
        const value = (db as any)[prop];
        return typeof value === 'function' ? value.bind(db) : value;
    },
});
```

- **server**: prisma → Postgres (crash if unavailable — a server without DB is broken)
- **desktop/mobile**: prisma → SQLite (existing behavior, unchanged)

### Auth middleware behavior per mode

| Mode | User check source | Login behavior |
|---|---|---|
| server | Postgres (via `prisma`) | Direct lookup |
| desktop | SQLite local | Via embedded API at 127.0.0.1:3001 |
| mobile | Remote API | POST to VPS, JWT cached locally |

The auth middleware itself doesn't need to change — it uses `prisma`, and `prisma` now routes correctly per mode. The only change is that `prisma` in server mode hits Postgres.

### Dockerfile entrypoint changes

In server mode:
- Skip `prisma db push --schema=prisma/schema.local.prisma` (no SQLite needed)
- Skip creating the SQLite file
- Seed runs against Postgres (already does)

In desktop mode:
- Keep current behavior (SQLite + optional Postgres sync)

### Frontend changes

`api.ts` baseURL resolution:
- `DEPLOY_MODE=server`: use `VITE_API_URL` (already set in Docker template)
- `DEPLOY_MODE=desktop`: use `127.0.0.1:3001/api` (embedded backend)
- `DEPLOY_MODE=mobile`: use `VITE_API_URL` (baked at APK build time)

No frontend code changes needed — `VITE_API_URL` already handles server/mobile. Desktop already falls back to `127.0.0.1:3001`. The only missing piece is that `DEPLOY_MODE` is a backend env var, not a frontend one — but the frontend already detects platform via `window.location.protocol === 'file:'` and `erpApi?.isElectron`.

### Deployment template changes

`docker-compose.client.yml`:
- Add `DEPLOY_MODE: "server"` to the api service environment
- Remove `USE_LOCAL_DB: "false"` (superseded by DEPLOY_MODE)
- Remove the `erp-appdata-${CLIENT_SLUG}:/app` volume (no SQLite to persist)

## Blast Radius Summary

### Files that need modification (low risk — routing change only)

| File | Change | Risk |
|---|---|---|
| `backend/src/config/env.ts` | Add `DEPLOY_MODE` env var | Minimal — additive |
| `backend/src/config/prisma.ts` | Proxy routes to cloud in server mode | **HIGH** — core routing change |
| `backend/Dockerfile` | Conditional SQLite schema push based on DEPLOY_MODE | Medium — entrypoint logic |
| `deploy/templates/docker-compose.client.yml` | Add DEPLOY_MODE, remove USE_LOCAL_DB and appdata volume | Low — template only |

### Files that DON'T need changes

All 36 files that import `prisma` from `config/prisma` continue working unchanged — they call `prisma.user.findUnique()` etc. and the Proxy routes them to the correct database. This is the power of the Proxy pattern.

### Files that need review but likely no changes

| File | Why review |
|---|---|
| `app.ts` health check | Uses `getLocalPrisma()` directly — in server mode should check Postgres |
| `app.ts` `/api/electron/*` endpoints | Desktop-only, no-op in server mode (harmless) |
| `audit.middleware.ts` | Checks `USE_LOCAL_DB` — review if DEPLOY_MODE supersedes |
| `dashboard.service.ts` | Checks `ELECTRON` and `USE_LOCAL_DB` — review if DEPLOY_MODE supersedes |
| `sync/status.service.ts` | Reports `useLocalDb` — update for DEPLOY_MODE |

### Dead code to consider

- `sync/outbox-sync.service.ts` — exists but is NOT consumed by the main sync cycle. Advisory only.
- `ProcessedSyncEvents` table in cloud schema — only used by `inventory-sync.service.ts`, not by push-sales.
- The `prismaCloud` proxy export — throws if cloud unavailable, used only by `pull-catalog.service.ts`.

## Open Questions for Proposal Phase

1. **Seed strategy in server mode**: The entrypoint does `prisma db push` but there's no seed command in the entrypoint. Who seeds the initial admin user? Currently `add-client.sh` doesn't seed data — the container creates empty Postgres tables. Is there a seed script that runs separately?

2. **Health check in server mode**: `app.ts` line 118 uses `getLocalPrisma()` for the health check. In server mode this would try to open SQLite (which doesn't exist). Should it switch to checking Postgres via `getCloudPrisma()`?

3. **Sync worker in server mode**: The sync worker is designed for devices pushing to the cloud. In server mode, the sync worker is unnecessary (the server IS the cloud). Should it be disabled entirely when `DEPLOY_MODE=server`?

4. **Backward compatibility**: Existing Electron builds don't set `DEPLOY_MODE`. Default to `server` is safe for VPS, but is `desktop` the right default when `ELECTRON=true` is detected? Or should `ELECTRON=true` auto-set `DEPLOY_MODE=desktop`?

5. **The `/app` volume**: Removing it from the template means no SQLite persistence. If someone accidentally runs the server image with `DEPLOY_MODE=desktop` (or unset), it would crash trying to create SQLite in a read-only or non-persisted location. How defensive should we be?

## Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Proxy routing change breaks all modules | **HIGH** | The change is a single IF/ELSE in the Proxy — all modules call `prisma.*` identically. Test with Postgres connection. |
| Server mode crashes without DATABASE_URL | **EXPECTED** — this is correct behavior | Log clear error message, exit with code 1 |
| Existing Electron builds broken | **LOW** — default falls back to `server` but `ELECTRON=true` auto-detection in env.ts handles it | Add `DEPLOY_MODE = 'desktop'` when `ELECTRON=true` |
| Health endpoint fails in server mode | **MEDIUM** — Docker healthcheck would fail, container gets restarted in loop | Fix health check to use correct DB per mode |
