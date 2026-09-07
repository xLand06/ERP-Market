# Archive Report: backend-deploy-modes

## Status

**ARCHIVED** — 2026-09-07

## Summary

Implemented `DEPLOY_MODE` (server|desktop|mobile) as the single source of truth for database routing in the ERP-Market backend. This fixes the root cause of the VPS auth 401: the `prisma` Proxy now routes to PostgreSQL in server mode instead of always writing to SQLite.

## Artifacts

| Artifact | Location | Status |
|---|---|---|
| Explore | `openspec/changes/backend-deploy-modes/explore.md` | ✅ |
| Proposal | `openspec/changes/backend-deploy-modes/proposal.md` | ✅ |
| Spec | `openspec/changes/backend-deploy-modes/spec.md` → synced to `openspec/specs/backend-deploy-modes/spec.md` | ✅ |
| Design | `openspec/changes/backend-deploy-modes/design.md` | ✅ |
| Tasks | `openspec/changes/backend-deploy-modes/tasks.md` | ✅ |
| Verify | `openspec/changes/backend-deploy-modes/verify-report.md` | ✅ |
| Implementation | branch `feat/backend-deploy-modes` (worktree) | ⏸ pending integration |

## Delivered Changes

| File | Change |
|---|---|
| `backend/src/config/env.ts` | `DEPLOY_MODE` + `DeployMode` type with auto-detection |
| `backend/src/config/prisma.ts` | Proxy routes to Postgres (server, fail-fast) or SQLite (device) |
| `backend/src/app.ts` | Health mode-aware + `deployMode` field; electron endpoints gated (404 in server) |
| `backend/Dockerfile` | Conditional SQLite push in entrypoint + `ENV DEPLOY_MODE=server` |
| `deploy/templates/docker-compose.client.yml` | `DEPLOY_MODE=server`, removed `USE_LOCAL_DB` + `/app` volume |
| `backend/src/core/middlewares/audit.middleware.ts` | `DEPLOY_MODE` for detail normalization |
| `backend/src/modules/dashboard/dashboard.service.ts` | `DEPLOY_MODE` client selection |
| `backend/src/modules/sync/status.service.ts` | Reports `deployMode` instead of `useLocalDb` |
| `backend/src/modules/audit/audit.service.ts` | `DEPLOY_MODE` for SQL dialect |

## Final State Facts

- All 6 REQ-DEPLOY requirements verified PASS (compile + behavioral smoke tests)
- 2 bonus fixes during verify: electron endpoint gating, dead import removal
- Implementation lives in worktree branch `feat/backend-deploy-modes` — not merged (master had unrelated uncommitted frontend changes)
- Total ~131 changed lines — single PR size, no chaining needed

## Post-Archive Action

- [ ] Integrate branch (PR or merge) once master working tree is clean
- [ ] Re-provision existing VPS clients via `add-client.sh` to pick up DEPLOY_MODE template
- [ ] Verify real VPS login after rollout (curl `POST /api/auth/login` → 200)