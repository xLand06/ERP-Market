# Design: backend-deploy-modes

## Architectural Decisions

### AD-1: Single source of truth — DEPLOY_MODE in env.ts

**Decision**: `DEPLOY_MODE` lives in `env.ts` as a resolved constant, computed once at module load.

**Rationale**: `env.ts` is already imported by everything (it's the earliest module in the chain). Computing resolution once prevents drift between consumers. `ELECTRON` auto-detection keeps backward compat for existing desktop builds.

**Tradeoff**: A module-level constant means tests can't easily flip mode per-case. Accepted — mode is a boot-time deployment decision, not a runtime toggle.

### AD-2: The Proxy is the routing seam

**Decision**: Keep the Proxy pattern. In server mode, the Proxy binds to `getCloudPrisma()`; in device modes, to `getLocalPrisma()`.

**Rationale**: 36 files import `prisma` and call `prisma.user.findUnique()` etc. Changing them all (or making them mode-aware) is 36x the blast radius. The Proxy is the single choke point where mode decides the backing client. Zero business-module changes needed.

**Tradeoff**: The Proxy swallows the distinction between "cloud" and "local" — but that's the point. Authority is a deployment concern, not a per-call concern.

### AD-3: Fail-fast in server mode

**Decision**: In server mode, an unavailable Postgres connection throws immediately.

**Rationale**: A VPS without its authority database is non-functional. Failing fast with a clear message beats silently writing to a nonexistent SQLite or returning 401s.

**Tradeoff**: Slightly more brittle at boot IF Postgres is down. Mitigated by the Dockerfile entrypoint which waits for Postgres TCP (`ready` loop, up to 60s) before starting the app.

### AD-4: Health endpoint reports actual DB state

**Decision**: `/api/health` checks Postgres in server mode, SQLite in device modes, and includes `deployMode` in the response.

**Rationale**: Docker Compose healthcheck and `add-client.sh` probe both hit `/api/health`. It must reflect the true authority DB to avoid false "healthy" signals that mask broken auth.

### AD-5: Compose template drops /app volume in server mode

**Decision**: Remove `erp-appdata-<slug>:/app` from the template.

**Rationale**: The `/app` volume existed solely to persist the hybrid SQLite file. In server mode there is no SQLite. Keeping it would persist a phantom file. This ALSO fixes the root:1000 permission issue (no SQLite creation needed).

**Tradeoff**: The image ships a `node` user that owns `/app`, so ephemeral container writes still work — just nothing is persisted, and nothing needs to be.

### AD-6: Downstream services updated, not rewritten

**Decision**: `audit.middleware.ts`, `dashboard.service.ts`, `sync/status.service.ts`, `audit.service.ts` replace `USE_LOCAL_DB`/`ELECTRON` checks with `DEPLOY_MODE` comparisons.

**Rationale**: These services branch on DB type/presence. Making them read `env.DEPLOY_MODE` centralizes the decision and removes the legacy flag drift.

## Data Flow

### Server mode (DEPLOY_MODE=server)

```
Client request → auth.middleware → prisma.user.findUnique()
                                        │
                                        ▼
                              Proxy → getCloudPrisma() → PostgreSQL
                                        │
Docker /api/health → getCloudPrisma().$queryRaw`SELECT 1` → PostgreSQL
```

Sync worker: DISABLED (server is the source of truth, nothing to sync from).

### Desktop mode (DEPLOY_MODE=desktop, auto from ELECTRON=true)

```
Client request → auth.middleware → prisma.user.findUnique()
                                        │
                                        ▼
                              Proxy → getLocalPrisma() → SQLite
                                        │
Sync worker (15min) → getCloudPrisma() → VPS PostgreSQL
```

### Mobile mode (DEPLOY_MODE=mobile)

```
Client request → auth.middleware → prisma.user.findUnique()
                                        │
                                        ▼
                              Proxy → getLocalPrisma() → SQLite
```

Electron/mobile frontends call the remote VPS API via `VITE_API_URL`; the embedded/local backend only runs in Electron.

## Code Structure

### env.ts (new export)

```typescript
type DeployMode = 'server' | 'desktop' | 'mobile';

const rawMode = process.env.DEPLOY_MODE?.toLowerCase();
const ELECTRON = process.env.ELECTRON === 'true';

export const DEPLOY_MODE: DeployMode =
    rawMode === 'desktop' || rawMode === 'mobile' ? rawMode
    : rawMode === 'server' ? 'server'
    : ELECTRON ? 'desktop'
    : 'server';
```

### prisma.ts (Proxy change)

```typescript
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
    get(_target, prop: string) {
        let db: PrismaClient;

        if (DEPLOY_MODE === 'server') {
            const cloud = getCloudPrisma();
            if (!cloud) {
                throw new Error(
                    '[DB] FATAL: DEPLOY_MODE=server but DATABASE_URL not configured. ' +
                    'The server requires a PostgreSQL connection.'
                );
            }
            db = cloud;
        } else {
            db = getLocalPrisma();
        }

        const value = (db as any)[prop];
        return typeof value === 'function' ? value.bind(db) : value;
    },
});
```

### app.ts health check

```typescript
app.get('/api/health', async (_req, res) => {
    let dbStatus = 'connected';
    let dbResponseTime = 0;

    try {
        const start = Date.now();
        if (DEPLOY_MODE === 'server') {
            const { getCloudPrisma } = await import('./config/prisma');
            const cloud = getCloudPrisma();
            if (!cloud) throw new Error('Cloud DB not available');
            await cloud.$queryRaw`SELECT 1`;
        } else {
            const { getLocalPrisma } = await import('./config/prisma');
            await getLocalPrisma().$queryRaw`SELECT 1`;
        }
        dbResponseTime = Date.now() - start;
    } catch (err: any) {
        dbStatus = 'error';
        dbResponseTime = -1;
    }

    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'ERP-MARKET API',
        deployMode: DEPLOY_MODE,
        database: { status: dbStatus, responseTime: dbResponseTime > 0 ? `${dbResponseTime}ms` : 'N/A' }
    });
});
```

### Dockerfile entrypoint

```bash
# Inside the inline entrypoint:
if [ "${DEPLOY_MODE:-server}" != "server" ]; then
    echo "[entrypoint] applying local SQLite schema..."
    if ! ./node_modules/.bin/prisma db push --schema=prisma/schema.local.prisma; then
        echo "[entrypoint] FATAL: local SQLite schema sync failed" >&2
        exit 1
    fi
else
    echo "[entrypoint] server mode — skipping SQLite schema"
fi
```

Note: `DEPLOY_MODE` defaults to `server` in the Dockerfile ENV, matching the container runtime where Postgres is always present.

## Testing Strategy

No test framework exists. Use manual verification per mode:

| Mode | Test | Expected |
|---|---|---|
| server | `DEPLOY_MODE=server DATABASE_URL=postgres://... npm start` + login | Login against Postgres, 200 |
| server | `DEPLOY_MODE=server` (no DB) | Clear fatal error at first prisma call |
| desktop | `ELECTRON=true DEPLOY_MODE=desktop npm start` | Login against SQLite, 200 |
| docker server | build + compose up | No /app/erp-market.db, health shows server+connected |
| health | curl /api/health | Includes deployMode field |

## Migration & Rollback

1. **Deploy order**: Change env.ts + prisma.ts first (pure backend). Verify auth on a test client. THEN update Dockerfile + compose template.
2. **Rollback**: Revert to previous image tag. The Proxy change is additive — old behavior (always SQLite) restored by unsetting DEPLOY_MODE.
3. **Critical concern**: Once compose template removes USE_LOCAL_DB and /app, an OLD image (without DEPLOY_MODE) would run SQLite in server mode — but the env.ts default falls back to `server` only with the NEW code. Old image keeps `USE_LOCAL_DB` path. So: **deploy backend image first, then update template**. No half-states.

## Out of Scope (repeated for clarity)

- Sync worker refactor / outbox
- Prisma client generation changes
- Frontend changes
- Admin panel
