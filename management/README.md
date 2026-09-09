# Management Server — ERP Market

Panel de gestión centralizado para administrar tenants, pagos y salud de la plataforma ERP Market.

## Quick Start

```bash
# 1. Clone and configure
cd management
cp .env.example .env
# Edit .env with secure values

# 2. Start the stack
docker compose up -d

# 3. Run database migration
docker exec mgmt-api npx prisma migrate deploy

# 4. Verify
curl http://localhost:3001/api/health
# → {"status":"ok","database":"connected"}

# 5. Login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

The dashboard is available at `http://localhost:3001`.

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | API server port | `3001` |
| `JWT_SECRET` | Secret for JWT signing | `dev-secret-change-in-production` |
| `DATABASE_URL` | PostgreSQL connection URL | — (required) |
| `DOCKER_SOCKET` | Docker socket path | `/var/run/docker.sock` |
| `NODE_ENV` | Runtime environment | `development` |
| `MGMT_DB_PASSWORD` | PostgreSQL password | — (required) |
| `CADDY_EMAIL` | Let's Encrypt email for Caddy | — (required for TLS) |

## Architecture

```
                    ┌─────────────────────────────────┐
                    │         Caddy :443               │
                    │    (TLS + reverse proxy)         │
                    └──────────┬──────────────────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
    ┌─────────▼──────┐ ┌──────▼────────┐ ┌─────▼──────────┐
    │  api-tenant-A  │ │  mgmt-api     │ │  api-tenant-B  │
    │  :3000         │ │  :3001        │ │  :3000         │
    └────────┬───────┘ └──────┬────────┘ └───────┬────────┘
             │                │                  │
    ┌────────▼───────┐ ┌──────▼────────┐ ┌───────▼────────┐
    │  db-tenant-A   │ │  mgmt-db      │ │  db-tenant-B   │
    └────────────────┘ └───────────────┘ └────────────────┘

    All containers on erp_proxy network (internal DNS)
```

### Components

| Service | Image | Port | Description |
|---------|-------|------|-------------|
| `mgmt-api` | Node.js 20 + Vite frontend | 3001 | API + dashboard (static) |
| `mgmt-db` | PostgreSQL 16 Alpine | 5432 | Management database |
| `caddy` | Caddy 2 Alpine | 80/443 | TLS termination + routing |

### Data Flow

1. Browser → Caddy (TLS) → mgmt-api:3001
2. mgmt-api serves React dashboard as static files
3. API calls go to `/api/*` routes on the same server
4. mgmt-api talks to Docker socket for container health checks
5. Health cron runs every 5 min, auto-suspends unhealthy tenants

## Development Setup

### Backend (API)

```bash
cd management/server
pnpm install

# Generate Prisma client
npx prisma generate

# Push schema to database
npx prisma db push

# Start dev server
pnpm dev
# → http://localhost:3001
```

### Frontend

```bash
cd management/frontend
pnpm install
pnpm dev
# → http://localhost:5174 (proxies /api to :3001)
```

### Database

```bash
# Create migration
npx prisma migrate dev --name <description>

# Reset database
npx prisma migrate reset

# Open Prisma Studio
npx prisma studio
```

## Production Deployment

### Prerequisites

- Docker + Docker Compose v2
- The `erp_proxy` network must exist (created by `deploy/docker-compose.yml`)
- Caddy must be running (part of the operator stack)

### Deploy

```bash
# 1. Configure environment
cd management
cp .env.example .env
vim .env  # Set MGMT_DB_PASSWORD, JWT_SECRET, CADDY_EMAIL

# 2. Start the stack
docker compose up -d

# 3. Run migrations
docker exec mgmt-api npx prisma migrate deploy

# 4. Verify health
curl http://localhost:3001/api/health

# 5. Add Caddy site (if not auto-imported)
# Create deploy/caddy/sites/mgmt.caddy with:
#   mgmt.erpmarket.com {
#       reverse_proxy mgmt-api:3001
#   }
# Then reload Caddy:
docker exec caddy caddy reload --config /etc/caddy/Caddyfile
```

### VPS (Hetzner CX23)

The stack is designed to run on the same VPS as the tenants:

- `mgmt-api` listens on port 3001 (host-mapped for direct access during setup)
- `mgmt-db` uses 32MB shared_buffers (appropriate for 4GB RAM)
- Joins `erp_proxy` network to access tenant containers by DNS name
- Single container deployment (API + frontend) reduces resource usage

### Updating

```bash
# Pull new code
git pull origin feature/mgmt-server

# Rebuild and restart
docker compose up -d --build

# Run any new migrations
docker exec mgmt-api npx prisma migrate deploy
```

## API Documentation

### Health Check

```
GET /api/health
```

Public endpoint. Returns system status and database connectivity.

```json
{
  "status": "ok",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "database": "connected"
}
```

### Authentication

```
POST /api/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "admin123"
}
```

Returns a JWT token valid for 24 hours.

```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "username": "admin",
    "role": "admin"
  }
}
```

### Tenants

All tenant endpoints require `Authorization: Bearer <token>`.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/tenants` | List all tenants |
| `POST` | `/api/tenants` | Create tenant |
| `GET` | `/api/tenants/:slug` | Tenant detail |
| `PATCH` | `/api/tenants/:slug` | Update tenant |
| `DELETE` | `/api/tenants/:slug` | Soft delete tenant |
| `POST` | `/api/tenants/:slug/suspend` | Suspend tenant |
| `POST` | `/api/tenants/:slug/resume` | Resume tenant |

**Create tenant:**

```json
{
  "slug": "acme-corp",
  "domain": "acme.erpmarket.com",
  "url": "https://acme.erpmarket.com",
  "plan": "pro",
  "adminEmail": "admin@acme.com"
}
```

### Payments

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/payments` | List payments (filter by `tenantId`, `status`) |
| `GET` | `/api/payments/stats` | Payment statistics |
| `POST` | `/api/payments` | Record payment |
| `GET` | `/api/payments/:id` | Payment detail |
| `PATCH` | `/api/payments/:id` | Update payment status |

### Health Checks

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health/tenants` | Latest health for all tenants |
| `GET` | `/api/health/tenants/:slug` | Health history for tenant |
| `POST` | `/api/health/check` | Trigger manual health check |

### Audit Logs

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/audit` | List audit entries (filter by `tenantId`, `action`) |
| `POST` | `/api/audit` | Create audit entry |

## Project Structure

```
management/
├── server/
│   ├── src/
│   │   ├── app.ts              # Entry point + static file serving
│   │   ├── seed.ts             # Admin user verification
│   │   ├── config/
│   │   │   ├── env.ts          # Environment variables
│   │   │   └── prisma.ts       # Prisma client
│   │   ├── modules/
│   │   │   ├── auth/           # JWT authentication
│   │   │   ├── tenants/        # Tenant CRUD
│   │   │   ├── payments/       # Payment tracking
│   │   │   ├── health/         # Container health checks
│   │   │   └── audit/          # Audit logging
│   │   ├── services/
│   │   │   ├── docker.ts       # Docker API client
│   │   │   └── health-cron.ts  # Periodic health checks
│   │   └── middlewares/
│   │       ├── auth.ts         # JWT middleware
│   │       └── validate.ts     # Zod validation
│   ├── prisma/
│   │   └── schema.prisma       # Database schema
│   └── Dockerfile              # Multi-stage (frontend + server)
├── frontend/
│   └── src/                    # React dashboard (Vite)
├── docker-compose.yml          # Management stack
├── .env.example                # Environment template
└── README.md                   # This file
```

## Default Credentials

| Username | Password | Role |
|----------|----------|------|
| `admin` | `admin123` | `admin` |

> **Change these before production deployment.** The auth module uses hardcoded users (will migrate to DB in a future batch).

## Troubleshooting

### mgmt-api won't start

```bash
# Check logs
docker compose logs mgmt-api

# Common issues:
# - DATABASE_URL unreachable → verify mgmt-db is healthy
# - JWT_SECRET not set → copy .env.example to .env
# - Prisma migration needed → run prisma migrate deploy
```

### Database connection refused

```bash
# Verify mgmt-db is running and healthy
docker compose ps
docker compose logs mgmt-db

# Test connection
docker exec mgmt-db pg_isready -U mgmt
```

### Frontend not loading

The dashboard is served from `mgmt-api:3001`. If the page is blank:

```bash
# Verify frontend was built
docker exec mgmt-api ls -la frontend/dist/

# Rebuild if missing
docker compose up -d --build
```

### Health checks timing out

The health cron runs every 5 minutes. To trigger manually:

```bash
curl -X POST http://localhost:3001/api/health/check \
  -H "Authorization: Bearer <token>"
```
