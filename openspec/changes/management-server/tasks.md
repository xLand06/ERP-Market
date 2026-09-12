# Tasks: Management Server

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 2000–2500 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | 6 PRs (one per batch) |
| Delivery strategy | ask-on-risk |
| Chain strategy | feature-branch-chain |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | DB + config + auth | PR 1 (base: feature/mgmt-server) | `npx prisma migrate dev` + `POST /api/auth/login` | mgmt-db + mgmt-api containers | mgmt-db, mgmt-api config |
| 2 | Docker service + tenant CRUD | PR 2 (base: PR 1 branch) | `GET /api/tenants` + `POST /api/tenants/:id/stop` | mgmt-api with docker socket | tenant module |
| 3 | Payments + audit | PR 3 (base: PR 2 branch) | `POST /api/payments` + `GET /api/audit` | mgmt-api | payments + audit modules |
| 4 | Health monitoring | PR 4 (base: PR 3 branch) | `GET /api/health/tenants` | mgmt-api with docker socket | health module |
| 5 | React dashboard | PR 5 (base: PR 4 branch) | Manual: login → tenant list → detail | Vite dev server | frontend/ only |
| 6 | Deployment + Caddy | PR 6 (base: PR 5 branch) | `docker compose up -d` + `curl mgmt.domain` | Full stack | docker-compose.mgmt.yml |

## Phase 1: Foundation — DB, Config, Auth (Batch 1)

- [ ] 1.1 Create `management/server/package.json` with Express, Prisma, jsonwebtoken, bcrypt, zod dependencies
- [ ] 1.2 Create `management/server/src/config/env.ts` — validate PORT, DATABASE_URL, JWT_SECRET, DOCKER_SOCKET from env
- [ ] 1.3 Create `management/server/prisma/schema.prisma` — Admin, Tenant, Payment, HealthCheck, AuditLog models per design
- [ ] 1.4 Run `npx prisma migrate dev --name init` to generate migration and client
- [ ] 1.5 Create `management/server/src/config/prisma.ts` — singleton PrismaClient export
- [ ] 1.6 Create `management/server/src/core/middlewares/auth.middleware.ts` — JWT verification, attach admin to req
- [ ] 1.7 Create `management/server/src/modules/auth/auth.routes.ts` — POST /api/auth/login (bcrypt + JWT sign)
- [ ] 1.8 Create `management/server/src/modules/auth/auth.service.ts` — findAdminByEmail, validatePassword, signToken
- [ ] 1.9 Create `management/server/src/app.ts` — Express setup with JSON body parser, CORS, route mounting
- [ ] 1.10 Create `management/server/src/server.ts` — entry point, listen on PORT, run prisma migrate on start
- [ ] 1.11 Create seed script: `management/server/prisma/seed.ts` — create default admin (email/password from env)
- [ ] 1.12 Create `management/server/Dockerfile` — multi-stage: build + production with node:20-alpine

## Phase 2: Docker Integration + Tenant CRUD (Batch 2)

- [ ] 2.1 Create `management/server/src/services/docker.service.ts` — dockerode wrapper: listContainers, inspectContainer, start/stop/restart, logs
- [ ] 2.2 Create `management/server/src/modules/tenants/tenant.routes.ts` — GET/POST/PATCH /api/tenants, GET /api/tenants/:id
- [ ] 2.3 Create `management/server/src/modules/tenants/tenant.service.ts` — CRUD operations with Prisma, container lifecycle calls
- [ ] 2.4 Add container operations: POST /api/tenants/:id/start, :stop, :restart, :logs
- [ ] 2.5 Add tenant status transitions: enforce active → suspended → terminated, call docker stop/start on transitions
- [ ] 2.6 Add audit logging middleware: on every write operation, insert into audit_logs table

## Phase 3: Payments + Audit (Batch 3)

- [ ] 3.1 Create `management/server/src/modules/payments/payment.routes.ts` — GET /api/payments (with tenant filter), POST /api/payments
- [ ] 3.2 Create `management/server/src/modules/payments/payment.service.ts` — create, list with pagination, confirm/reject
- [ ] 3.3 Create `management/server/src/modules/audit/audit.routes.ts` — GET /api/audit with filters (action, actor, date range)
- [ ] 3.4 Create `management/server/src/modules/audit/audit.service.ts` — logAction helper, query with filters

## Phase 4: Health Monitoring (Batch 4)

- [ ] 4.1 Create `management/server/src/modules/health/health.routes.ts` — GET /api/health (self), GET /api/health/tenants, GET /api/health/:tenantId
- [ ] 4.2 Create `management/server/src/modules/health/health.service.ts` — docker inspect for running status, memory; fetch /health from tenant API
- [ ] 4.3 Implement cron: `setInterval` every 5 min — check all active tenants, write to health_checks table
- [ ] 4.4 Add GET /api/dashboard/stats — tenant count, revenue sum, health summary

## Phase 5: React Dashboard (Batch 5)

- [ ] 5.1 Scaffold `management/frontend/` with Vite + React + TypeScript + Tailwind
- [ ] 5.2 Create `management/frontend/src/pages/Login.tsx` — email/password form, JWT storage
- [ ] 5.3 Create `management/frontend/src/pages/Dashboard.tsx` — stats cards (tenants, revenue, health)
- [ ] 5.4 Create `management/frontend/src/pages/Tenants.tsx` — table with search, status filter, pagination
- [ ] 5.5 Create `management/frontend/src/pages/TenantDetail.tsx` — info, container status, start/stop/restart buttons
- [ ] 5.6 Create `management/frontend/src/pages/Payments.tsx` — list with tenant filter, record payment form
- [ ] 5.7 Create shared components: `components/Layout.tsx` (sidebar nav), `components/ProtectedRoute.tsx`
- [ ] 5.8 Create API client service: `services/api.ts` — axios/fetch wrapper with JWT header injection

## Phase 6: Deployment + Integration (Batch 6)

- [ ] 6.1 Create `management/docker-compose.mgmt.yml` — mgmt-db (128MB), mgmt-api (128MB), networks, volumes
- [ ] 6.2 Create Caddy site config: `deploy/caddy/sites/mgmt.caddy` — reverse proxy to mgmt-api:3001
- [ ] 6.3 Build frontend: `npm run build` in frontend/, copy dist into server public folder or serve via Caddy
- [ ] 6.4 Test full stack: `docker compose -f docker-compose.mgmt.yml up -d` → login → create tenant → verify container starts
- [ ] 6.5 Document deployment steps in `management/README.md`
