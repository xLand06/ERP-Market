# Proposal: backend-deploy-modes

## Intent

Introduce a single `DEPLOY_MODE` environment variable that cleanly separates database routing, auth behavior, and deployment configuration between VPS (server), desktop (Electron), and mobile (Capacitor) targets. This eliminates the root cause of the auth 401 bug — where the VPS backend reads from an empty SQLite instead of Postgres — and removes the confused hybrid write path that has the server syncing to itself.

## Scope

### IN scope
- `DEPLOY_MODE` env var in `backend/src/config/env.ts` with auto-detection from `ELECTRON`
- `prisma` Proxy routing in `backend/src/config/prisma.ts` based on DEPLOY_MODE
- Dockerfile entrypoint: conditional SQLite schema push
- docker-compose.client.yml: add DEPLOY_MODE, remove USE_LOCAL_DB and /app volume
- Health endpoint in `app.ts`: mode-aware database check
- Auth middleware: no code change needed (uses `prisma` which now routes correctly)

### OUT of scope
- Frontend changes (already handles platform detection via erpApi?.isElectron and VITE_API_URL)
- Sync worker refactoring (disabled in server mode, unchanged in device modes)
- Sync queue / outbox migration (dead code — separate change)
- Admin panel for client management
- Migration from Prisma 7 earlyAccess
- Changing the dual schema approach (schema.prisma for Postgres, schema.local.prisma for SQLite)

## Approach

### Step 1: Add DEPLOY_MODE to env.ts

```typescript
type DeployMode = 'server' | 'desktop' | 'mobile';

const rawMode = process.env.DEPLOY_MODE?.toLowerCase();
const ELECTRON = process.env.ELECTRON === 'true';

// Auto-detect: Electron desktop → desktop mode
// Explicit DEPLOY_MODE overrides auto-detection
const resolvedMode: DeployMode =
    rawMode === 'desktop' || rawMode === 'mobile' ? rawMode
    : rawMode === 'server' ? 'server'
    : ELECTRON ? 'desktop'
    : 'server'; // default: server (VPS is the common case)

export const env = {
    DEPLOY_MODE: resolvedMode,
    PORT: process.env.PORT || '3000',
    DATABASE_URL: process.env.DATABASE_URL || '',
    DIRECT_URL: process.env.DIRECT_URL || '',
    USE_LOCAL_DB: process.env.USE_LOCAL_DB || 'true', // kept for backward compat
    JWT_SECRET: rawJwtSecret,
    NODE_ENV: process.env.NODE_ENV || 'development',
};
```

Key: `ELECTRON=true` auto-sets `desktop` mode without needing DEPLOY_MODE explicitly.

### Step 2: Modify prisma.ts Proxy

```typescript
import { env, DEPLOY_MODE } from '../config/env';

// ... existing getCloudPrisma() and getLocalPrisma() unchanged ...

export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
    get(_target, prop: string) {
        let db: PrismaClient;

        if (DEPLOY_MODE === 'server') {
            // Server mode: Postgres IS the authority. Crash if unavailable.
            const cloud = getCloudPrisma();
            if (!cloud) {
                throw new Error(
                    '[DB] FATAL: DEPLOY_MODE=server but DATABASE_URL not configured. ' +
                    'The server requires a PostgreSQL connection.'
                );
            }
            db = cloud;
        } else {
            // Device mode (desktop/mobile): SQLite is local authority
            db = getLocalPrisma();
        }

        const value = (db as any)[prop];
        return typeof value === 'function' ? value.bind(db) : value;
    },
});
```

This is THE core change. 36 files import `prisma` — zero of them need modification because the Proxy abstracts the routing.

### Step 3: Fix health endpoint in app.ts

```typescript
app.get('/api/health', async (_req, res) => {
    let dbStatus = 'connected';
    let dbResponseTime = 0;

    try {
        const start = Date.now();
        if (env.DEPLOY_MODE === 'server') {
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
        deployMode: env.DEPLOY_MODE,
        database: {
            status: dbStatus,
            responseTime: dbResponseTime > 0 ? `${dbResponseTime}ms` : 'N/A'
        }
    });
});
```

### Step 4: Update Dockerfile entrypoint

In the inline entrypoint script, wrap the SQLite schema push in a mode check:

```bash
# Only create SQLite schema in device modes (desktop/mobile)
if [ "${DEPLOY_MODE}" != "server" ]; then
    echo "[entrypoint] applying local SQLite schema..."
    if ! ./node_modules/.bin/prisma db push --schema=prisma/schema.local.prisma; then
        echo "[entrypoint] FATAL: local SQLite schema sync failed" >&2
        exit 1
    fi
else
    echo "[entrypoint] server mode — skipping SQLite schema"
fi
```

Also update the Dockerfile ENV to include:
```dockerfile
ENV DEPLOY_MODE=server
```

### Step 5: Update docker-compose.client.yml template

```yaml
api:
    environment:
        NODE_ENV: production
        PORT: "3000"
        DEPLOY_MODE: "server"          # NEW — replaces USE_LOCAL_DB
        DATABASE_URL: postgresql://${DB_USER}:${DB_PASSWORD}@db:5432/${DB_NAME}?schema=public&connection_limit=5
        DIRECT_URL: postgresql://${DB_USER}:${DB_PASSWORD}@db:5432/${DB_NAME}?schema=public
        JWT_SECRET: ${JWT_SECRET}
        FRONTEND_URL: ${CLIENT_URL}
        # USE_LOCAL_DB removed — superseded by DEPLOY_MODE
    volumes: []                        # No /app volume needed in server mode
```

### Step 6: Review downstream services

Services that check `USE_LOCAL_DB` or `ELECTRON` directly should be reviewed:
- `audit.middleware.ts:82` — uses `USE_LOCAL_DB` to choose audit DB → update to check `DEPLOY_MODE`
- `dashboard.service.ts:17,67` — uses both flags → update to check `DEPLOY_MODE`
- `sync/status.service.ts:58` — reports `useLocalDb` → update to report DEPLOY_MODE
- `audit.service.ts:80` — checks `ELECTRON` for SQL dialect → DEPLOY_MODE replaces this

These are secondary changes — the core fix (prisma Proxy + health + Dockerfile) resolves the auth 401.

## Acceptance Criteria

1. **Auth works on VPS**: `POST /api/auth/login` with valid credentials returns 200 + JWT (not 401)
2. **No SQLite in server mode**: Container starts without creating `erp-market.db`
3. **Health endpoint reflects mode**: `/api/health` returns `deployMode: "server"` and checks Postgres
4. **Electron unchanged**: Desktop mode still uses SQLite as local authority with sync to VPS
5. **No regression**: All 36 business modules work identically — they call `prisma.*` and the Proxy routes correctly
6. **Docker build passes**: Image builds and entrypoint runs without errors in server mode

## Risks and Mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| Proxy routing change breaks modules | LOW — same interface, different backing DB | Test with Postgres connection end-to-end |
| Server crashes without DATABASE_URL | EXPECTED — correct behavior with clear error message | Exit code 1 + descriptive log |
| Existing Electron builds broken | LOW — ELECTRON=true auto-detects desktop mode | Default fallback chain handles it |
| Health check fails in server mode | MEDIUM — Docker restart loop if health fails | Step 3 fixes this explicitly |
| Audit/dashboard services use old flags | LOW — secondary, non-blocking | Step 6 addresses them |

## Non-Goals

- This change does NOT refactor the sync worker or outbox system
- This change does NOT introduce a new admin panel
- This change does NOT change the dual Prisma schema approach
- This change does NOT modify the frontend (it already works correctly per platform)
- This change does NOT address the dead outbox-sync.service.ts code
