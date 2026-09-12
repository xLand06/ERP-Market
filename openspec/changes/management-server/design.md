# Design: Management Server

## Technical Approach

Central control plane as a standalone Express app with its own PostgreSQL database, Docker socket access via dockerode, and a React dashboard. Runs alongside existing tenant stacks on the same VPS. No changes to existing client code.

## Architecture Decisions

| Decision | Choice | Alternatives | Rationale |
|----------|--------|-------------|-----------|
| DB separation | Own PostgreSQL instance | Shared tenant DB, SQLite | Isolation: mgmt data must not be accessible to tenants. Postgres for ACID + concurrent writes |
| Docker access | Docker socket bind mount | TCP socket, SSH tunnel | Simplest for single-VPS. Socket at `/var/run/docker.sock` with read-only by default, write only where needed |
| Frontend | Separate SPA (Vite + React) | Embedded in Express | Independent deploy, better DX, same stack as existing frontend |
| Auth | JWT with mgmt-specific secret | Reuse tenant JWT | Security boundary: mgmt tokens must not work against tenant APIs |
| Container management | dockerode wrapper | Direct docker CLI calls | Programmatic, error-handling, TypeScript types |

## Data Flow

```
Browser → Caddy :443 → mgmt-api :3001
                            ├── mgmt-db (PostgreSQL) — tenants, payments, audit
                            └── Docker socket → container lifecycle
                                    ↓
                              tenant stacks (api-<slug>, db-<slug>)
```

## File Structure

```
management/
├── server/
│   ├── src/
│   │   ├── app.ts                 # Express app
│   │   ├── server.ts              # Entry point
│   │   ├── config/
│   │   │   ├── env.ts             # Env config
│   │   │   └── prisma.ts          # Mgmt DB client
│   │   ├── core/
│   │   │   ├── middlewares/
│   │   │   │   ├── auth.middleware.ts
│   │   │   │   ├── errorHandler.ts
│   │   │   │   └── validate.ts
│   │   │   └── types/
│   │   ├── modules/
│   │   │   ├── auth/              # Login, JWT, RBAC
│   │   │   ├── tenants/           # CRUD, container ops
│   │   │   ├── payments/          # Manual payment tracking
│   │   │   ├── health/            # Docker health polling
│   │   │   └── audit/             # Audit log queries
│   │   └── services/
│   │       └── docker.service.ts  # dockerode wrapper
│   ├── prisma/
│   │   └── schema.prisma          # Mgmt-only schema
│   ├── Dockerfile
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── pages/
│   │   │   ├── Login.tsx
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Tenants.tsx
│   │   │   ├── TenantDetail.tsx
│   │   │   └── Payments.tsx
│   │   ├── components/
│   │   └── services/
│   ├── package.json
│   └── vite.config.ts
├── docker-compose.mgmt.yml
└── README.md
```

## Database Schema (Prisma)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum TenantStatus {
  ACTIVE
  SUSPENDED
  TERMINATED
}

enum PaymentStatus {
  PENDING
  CONFIRMED
  REJECTED
}

model Admin {
  id        String   @id @default(cuid())
  email     String   @unique
  password  String
  name      String
  role      String   @default("admin")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@map("admins")
}

model Tenant {
  id              String       @id @default(cuid())
  slug            String       @unique
  domain          String       @unique
  contactEmail    String
  contactName     String
  status          TenantStatus @default(ACTIVE)
  plan            String       @default("basic")
  monthlyPrice    Decimal      @db.Decimal(10, 2)
  containerName   String       @unique  // api-<slug>
  dbContainerName String       @unique  // db-<slug>
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt

  payments  Payment[]
  health    HealthCheck[]
  auditLogs AuditLog[]

  @@index([status])
  @@index([createdAt])
  @@map("tenants")
}

model Payment {
  id          String        @id @default(cuid())
  tenantId    String
  amount      Decimal       @db.Decimal(10, 2)
  currency    String        @default("USD")
  status      PaymentStatus @default(PENDING)
  method      String?       // "bank_transfer", "paypal", etc.
  reference   String?       // payment reference number
  notes       String?
  confirmedBy String?       // admin who confirmed
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt

  tenant Tenant @relation(fields: [tenantId], references: [id])

  @@index([tenantId, createdAt])
  @@index([status])
  @@map("payments")
}

model HealthCheck {
  id        String   @id @default(cuid())
  tenantId  String
  status    String   // "healthy", "unhealthy", "unknown"
  dbStatus  String   // "connected", "error"
  details   Json?
  checkedAt DateTime @default(now())

  tenant Tenant @relation(fields: [tenantId], references: [id])

  @@index([tenantId, checkedAt])
  @@map("health_checks")
}

model AuditLog {
  id        String   @id @default(cuid())
  action    String
  entity    String
  entityId  String?
  details   Json?
  adminId   String?
  ipAddress String?
  createdAt DateTime @default(now())

  @@index([entity, entityId])
  @@index([createdAt])
  @@map("audit_logs")
}
```

## API Routes

```
POST   /api/auth/login          # { email, password } → JWT
GET    /api/auth/me             # current admin

GET    /api/tenants             # list with pagination, search, status filter
POST   /api/tenants             # create (stub — manual provision first)
GET    /api/tenants/:id         # detail + container status
PATCH  /api/tenants/:id         # update contact, plan, status
POST   /api/tenants/:id/start  # docker start
POST   /api/tenants/:id/stop   # docker stop
POST   /api/tenants/:id/restart # docker restart
GET    /api/tenants/:id/logs   # docker logs (last 100 lines)

GET    /api/payments            # list with tenant filter
POST   /api/payments            # record payment
PATCH  /api/payments/:id        # confirm/reject

GET    /api/health              # mgmt server self-health
GET    /api/health/tenants      # all tenant health (docker inspect)
GET    /api/health/:tenantId    # single tenant health

GET    /api/audit               # audit log list
GET    /api/dashboard/stats     # tenant count, revenue, health summary
```

## Docker Service Wrapper

```typescript
// services/docker.service.ts
import Docker from 'dockerode';

const docker = new Docker({ socketPath: '/var/run/docker.sock' });

// Read-only socket for health/status; write operations (start/stop/restart)
// require the socket to be mounted rw. MVP: mount rw with documented risk.

export async function listContainers(filter?: string) {
  return docker.listContainers({ all: true, filters: { name: [filter || ''] } });
}

export async function inspectContainer(name: string) {
  const container = docker.getContainer(name);
  const info = await container.inspect();
  return {
    running: info.State.Running,
    status: info.State.Status,
    health: info.State.Health?.Status || 'none',
    startedAt: info.State.StartedAt,
    restartCount: info.RestartCount,
    image: info.Config.Image,
    ports: info.NetworkSettings.Ports,
  };
}

export async function startContainer(name: string) {
  return docker.getContainer(name).start();
}

export async function stopContainer(name: string) {
  return docker.getContainer(name).stop({ t: 10 });
}

export async function restartContainer(name: string) {
  return docker.getContainer(name).restart({ t: 10 });
}

export async function logsContainer(name: string, tail = 100) {
  const container = docker.getContainer(name);
  return container.logs({ stdout: true, stderr: true, tail, follow: false });
}
```

## Resource Limits (CX23: 4GB RAM)

| Component | RAM Limit | CPU | Notes |
|-----------|-----------|-----|-------|
| mgmt-db (Postgres) | 128MB | 0.5 | Shared buffers 32MB, max_connections 20 |
| mgmt-api (Express) | 128MB | 0.5 | Node.js + Prisma |
| mgmt-frontend | N/A | N/A | Static files served by mgmt-api |
| Per tenant db | 32MB | 0.25 | Already tuned in template |
| Per tenant api | 64MB | 0.25 | Already tuned |
| Caddy | 32MB | 0.25 | Operator stack |

Budget: 128+128 + 5×(32+64) + 32 = 816MB for mgmt + 5 tenants. Leaves ~3.2GB for OS + 15 more tenants.

## Deployment

```yaml
# docker-compose.mgmt.yml
name: erp-mgmt

services:
  mgmt-db:
    image: postgres:16-alpine
    container_name: mgmt-db
    restart: unless-stopped
    environment:
      POSTGRES_DB: erp_management
      POSTGRES_USER: mgmt
      POSTGRES_PASSWORD: ${MGMT_DB_PASSWORD}
    volumes:
      - mgmt-db-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U mgmt -d erp_management"]
      interval: 10s
      timeout: 5s
      retries: 5
    deploy:
      resources:
        limits:
          memory: 128M
    networks:
      - mgmt_net

  mgmt-api:
    build:
      context: .
      dockerfile: management/server/Dockerfile
    container_name: mgmt-api
    restart: unless-stopped
    environment:
      NODE_ENV: production
      PORT: 3001
      DATABASE_URL: postgresql://mgmt:${MGMT_DB_PASSWORD}@mgmt-db:5432/erp_management
      JWT_SECRET: ${MGMT_JWT_SECRET}
      DOCKER_SOCKET: /var/run/docker.sock
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:rw
      - ./caddy/sites:/etc/caddy/sites:ro
    ports:
      - "3001:3001"  # Internal only — Caddy reaches via network
    depends_on:
      mgmt-db:
        condition: service_healthy
    deploy:
      resources:
        limits:
          memory: 128M
    networks:
      - mgmt_net
      - erp_proxy

networks:
  mgmt_net:
  erp_proxy:
    external: true

volumes:
  mgmt-db-data:
```

## Caddy Site

```caddy
# deploy/caddy/sites/mgmt.caddy
mgmt.${BASE_DOMAIN} {
    reverse_proxy mgmt-api:3001
}
```

## Security Notes

1. **Docker socket is root-equivalent** — mount `rw` for MVP (start/stop/restart). Production: consider a restricted proxy (e.g., Tecnativa/docker-socket-proxy) that only exposes specific endpoints.
2. **Network isolation** — mgmt-api joins `erp_proxy` to manage tenant containers but tenant APIs cannot reach mgmt-api (mgmt-net is not shared).
3. **JWT boundary** — separate secret, separate token namespace. mgmt tokens never work against tenant APIs.

## Migration / Rollout

No data migration — greenfield service. Deployment steps:

1. Start mgmt stack: `docker compose -f docker-compose.mgmt.yml up -d`
2. Run migrations: `docker exec mgmt-api npx prisma migrate deploy`
3. Seed admin: create initial admin user
4. Add Caddy site: write `mgmt.<domain>.caddy`, reload Caddy
5. Import existing tenants manually (or script against `deploy/clients/` directory)

## Open Questions

- [ ] Should we use a Docker socket proxy for production, or is rw socket acceptable for MVP?
- [ ] Should tenant creation be automated via API (extending add-client.sh) or remain manual?
- [ ] Payment confirmation: email notification to tenant on confirmation?
