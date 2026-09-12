# Proposal: deploy-auto-improve — Harden multi-tenant VPS onboarding

## Intent

Make onboarding a new ERP-Market client onto a VPS **fully automatic and
error-free** by fixing five ground-truth provisioning bugs in the `deploy/` kit
and adding a self-checking smoke step, deterministic idempotency, and tolerance
for slow first boot. This is a **bugfix + hardening** change to the existing
CLI scripts and templates — **no new product features**.

## Problem Statement

Onboarding a client today is a single command (`add-client.sh <slug>`), but in
practice it fails in several disjoint ways that each require manual
intervention:

1. **`CLIENT_SLUG` is never assigned** (`add-client.sh` exports it but only sets
   `SLUG`) → `envsubst` leaves the compose `name:` empty → Compose errors with
   `"name must be a string"`.
2. **`docker compose ... up -d --build -q`** uses `-q`, which is invalid on the
   deployed Compose v5.5.1 → the provision command errors.
3. **Wrong build context** `../../backend` in the client template resolves to
   missing `deploy/backend` → the API image build fails; must be `../../../backend`.
4. **DB healthcheck has no `start_period`** → on first boot Postgres init can
   exceed the `service_healthy` window and the API's `depends_on` never
   stabilizes. (Risk acknowledged, partially fixed locally, not yet on the VPS.)
5. **Per-client TLS key is unreadable by Postgres** → key is `root:root` mode
   600; the `postgres` container (uid 70) cannot read `server.key` through the
   read-only bind mount → `"could not load server certificate file"`.

Beyond the five bugs, onboarding is **not self-checking**: partial failures
leave a "WARNING" and a broken stack behind, and re-running `add-client.sh` for
an existing slug hard-fails on the "already exists" guard instead of being
idempotent. There is no smoke verification that the stack actually serves
traffic before the script reports success.

## Goals & Non-goals

### Goals

- **Fix all five ground-truth bugs** (ROTO/PENDING as documented in the task).
- **Add a per-client smoke/verification step**: wait for the DB to be healthy,
  verify `GET /api/health` returns 200 **inside the stack** (`docker exec`),
  and — when relevant — confirm the Caddy proxy site answers. Any failure
  **aborts with a clear message**, not a silently broken stack.
- **Deterministic idempotency**: re-running `add-client.sh` for the same slug
  must not error — TLS dir, volumes, and the shared `erp_proxy` network already
  existing must be tolerated (no-op or clear "already provisioned" guidance).
- **Robust to 60s+ first boot**: `start_period` + a bounded wait loop.
- **Self-contained kit**: fixes live in the repo working tree AND must be
  propagated to the live VPS clone (`/opt/erp-market`) in a later apply phase so
  a fresh VPS clone works without extra steps.

### Non-goals

- No new product features (no new endpoints, no UI, no client-facing behavior).
- No frontend or desktop (+Electron) changes — the `frontend/` churn already in
  the working tree is unrelated to this proposal and is out of scope here.
- No redesign of the TLS handling: **no Docker `secrets:`**, **no in-entrypoint
  key generation** (both were already tried and fail the uid-70 ownership
  problem). The fix is `chown 70:70` on the generated key.
- No migration to Coolify or any orchestration panel.
- No adding pgbouncer, replication, or HA — future work, deferred.
- No rework of the offline-first/SQLite sync contract.

## Context & Current state

Architecture (from `deploy/README.md` + code): one ERP-Market backend per client
on a single VPS (Hetzner CX22, Ubuntu 24.04, Docker + compose v2 plugin). Each
client is an isolated stack (Postgres 16 + API) on a private bridge plus the
shared `erp_proxy` network; Caddy is the single host entrypoint (80/443) with
**zero host ports published per client**. `add-client.sh` renders a compose
template via `envsubst`, creates TLS, builds/starts the stack, writes a Caddy
site, reloads Caddy, and health-checks.

Verified current state in the working tree:

| Bug | File | Line | Status in working tree |
|-----|------|------|------------------------|
| 1 — `CLIENT_SLUG` never assigned | `deploy/scripts/add-client.sh` | 143 (export list; no assignment) | **Unfixed** |
| 2 — `-q` invalid flag | `deploy/scripts/add-client.sh` | 157 | **Unfixed** |
| 3 — build context `../../backend` | `deploy/templates/docker-compose.client.yml` | 68 | **Unfixed** |
| 4 — DB healthcheck no `start_period` | `deploy/templates/docker-compose.client.yml` | db healthcheck | **Fixed locally, uncommitted** (lines 63/99 have `start_period`) |
| 5 — TLS key owned root:root uid mismatch | `deploy/scripts/add-client.sh` | 122–127 | **Unfixed** |

TLS reality: `backend/src/config/prisma.ts` hardcodes `ssl:{rejectUnauthorized:false}`,
so Postgres **MUST** speak TLS or the sync bridge never connects. The
`deploy/README.md` currently claims mode 644 lets postgres read the key — that
is incorrect for the read-only bind mount model; owner (uid) is what matters
under the current `chmod 600`, and root ownership breaks uid-70 reads.

## Proposed approach (design-agnostic plan of record)

1. **BUG 1** — In `add-client.sh`, assign `CLIENT_SLUG="$SLUG"` before the
   `envsubst` step so the compose `name:` renders non-empty.
2. **BUG 2** — Drop the `-q` flag from the `docker compose ... up -d --build`
   invocation (keep `--build`).
3. **BUG 3** — Fix the build context in `deploy/templates/docker-compose.client.yml`
   to `../../../backend` so it resolves from the rendered `deploy/clients/<slug>/`
   location.
4. **BUG 4** — Ensure the DB healthcheck carries `start_period: 60s` (already in
   the working tree; must be committed and present on the VPS).
5. **BUG 5** — After `openssl` generates the key, run
   `chown 70:70 path/to/tls/server.key` (and keep `chmod 600`) so the read-only
   bind mount `/run/secrets:/run/secrets:ro` is readable by the `postgres` image
   (uid 70). Update the misleading ownership documentation.
6. **Idempotency** — Make the `tls/` dir creation, named-volume existence, and
   `erp_proxy` network creation idempotent (tolerate pre-existence). Decide
   explicitly whether an existing client dir is (a) a no-op with a clear
   message or (b) a hard abort — pick the least surprising behavior and document
   it; the current "already exists" hard abort becomes a guard only after
   idempotent resource creation.
7. **Smoke/verification (self-checking onboarding)** — After startup, in order:
   (a) wait for `db-<slug>` to be `healthy` (bounded by `start_period` + wait
   loop); (b) `docker exec` into `api-<slug>` and confirm `GET /api/health`
   returns 200 from inside the stack (independent of ACME/TLS); (c) when the
   Caddy site is active and reachable, confirm the proxy answers. Any failure
   **aborts with an explicit error and actionable next-step command** rather
   than falling through to "WARNING".

## Capabilities

### New Capabilities

- `client-onboarding`: end-to-end provisioning behavior for adding a client
  (render, TLS ownership, idempotent resources, smoke verification, abort on
  failure). Created directly from this bugfix scope.

### Modified Capabilities

- None today — there are no pre-existing specs under `openspec/specs/` to delta.
  If spec infrastructure is initialized later, this change becomes the delta
  that defines `client-onboarding`.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `deploy/scripts/add-client.sh` | Modified | Fix bugs 1, 2, 5; add idempotency + smoke/abort step |
| `deploy/templates/docker-compose.client.yml` | Modified | Fix bug 3 (build context); confirm bug 4 (`start_period`) |
| `deploy/README.md` | Modified | Correct TLS-ownership docs; document idempotent rerun + smoke step |
| `/opt/erp-market` (live VPS clone) | Modified | Propagate fixes to the running deployment (apply phase) |
| `deploy/caddy/sites/*.caddy` | Generated | Recreated idempotently by rerun/smoke |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Idempotent rerun accidentally re-renders/secrets or duplicates Caddy site | Med | Only create resources with existence guards; do not regenerate secrets on existing clients; site file write is idempotent overwrite |
| Smoke step falsely fails during first-boot ACME/cert issuance | Med | Verify `/api/health` **inside the stack** first (no TLS/ACME dependency); only gate on the Caddy proxy when actually reachable |
| `chown 70:70` breaks on a non-Linux FS or non-root operator | Low | Script already assumes root-capable VPS operator; add a guard/error if `chown` fails |
| `start_period` only masks, doesn't fix, a genuinely broken DB image | Low | Smoke step probes actual `/api/health` readiness, so masking is bounded and surfaced |
| Propagation to `/opt/erp-market` diverges from repo (drift) | Med | Apply phase re-checks the same fixes; verify-report confirms each bug is gone |

## Rollback Plan

- This is a **bugfix to shell scripts + a template** — rollback is re-applying
  the previous file contents (or `git checkout <prev>` on the cloned kit),
  then re-running `add-client.sh` for affected clients.
- No data mutation: TLS is regenerable, volumes/networks are idempotent, so a
  revert does not touch client databases. `remove-client.sh` remains the escape
  hatch for a fully broken client slot.
- On the VPS: pull the fix revision and re-render by re-running the script; no
  destructive migration.

## Dependencies

- Docker Engine + compose v2 plugin on the VPS (documented in `deploy/README.md`).
- `gettext-base` (`envsubst`), `openssl`, `curl` (already documented requirements).
- `chown` available to the operator (root on VPS) for bug 5.

## Success Criteria

- [ ] `envsubst` renders a non-empty `name:` for a fresh client (BUG 1 gone).
- [ ] `docker compose ... up -d --build` runs without `-q` and without error (BUG 2 gone).
- [ ] API image builds from the corrected context `../../../backend` (BUG 3 gone).
- [ ] DB healthcheck has `start_period: 60s` committed and on the VPS (BUG 4 gone).
- [ ] Postgres loads `server.key` without "could not load server certificate file"; key owned uid 70 mode 600 (BUG 5 gone).
- [ ] Re-running `add-client.sh <same-slug>` does not error (idempotent resources).
- [ ] Smoke step fails loudly (non-zero exit, actionable message) if the stack is unhealthy; aborts rather than leaving a silent broken stack.
- [ ] Fresh VPS clone + `add-client.sh <slug>` end-to-end succeeds with no manual steps.
- [ ] All five fixes present in `/opt/erp-market` (apply phase), verified by report.

## Open questions

1. **Smoke test transport: HTTP vs HTTPS/443.** `sslip.io` URLs resolve to the
   VPS, but a fresh VPS has no cert until Caddy/ACME issues one; port 443 may be
   firewalled mid-bootstrap. Is an **HTTP-only** smoke probe of the Caddy site
   (e.g. `curl -sf http://<client>/api/health` via a temporary/plain site)
   acceptable, or must the proxy smoke test require real HTTPS/443 (which today
   is blocked)? Recommendation: verify `/api/health` inside the stack (always
   HTTPS-independent) and probe Caddy over HTTP as a best-effort proxy check,
   keeping full TLS verification as a post-ACME optional step.
2. **Existing-client rerun behavior.** Should re-running `add-client.sh` for an
   existing slug be a **no-op** (re-verify + re-check smoke) or **hard abort**
   with a clear message + pointer to `remove-client.sh`? Recommendation:
   re-verify existing slots (idempotent smoke re-check) and reserve the hard
   abort for truly conflicting/partial states.
3. **Smoke step scope for the Caddy proxy.** Confirm the operator accepts a
   non-fatal proxy warning when Caddy is not running yet (site file written but
   inactive) rather than treating it as an onboarding failure.
4. **ACMEs vs static self-signed for the proxy smoke.** If HTTPS-only is
   required, confirm we may rely on Caddy's automatic ACME issuance completing
   within the smoke window (bounded wait), or whether the proxy smoke stays
   HTTP-only.

## Proposal question round

The open questions above are the decisions the spec/design phase must resolve
before implementation. If any are answered differently than the recommendation,
adjust the smoke/verification requirements accordingly.

## Next step

**Recommended: `spec`** — write the `client-onboarding` delta spec with
Given/When/Then scenarios covering: all five bug fixes, the smoke/abort step,
idempotent rerun, and slow-first-boot tolerance. Design follows once the smoke-
transport and rerun-behavior decisions are locked.
