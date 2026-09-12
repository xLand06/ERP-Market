# Capability Spec: client-onboarding

## Intent

This capability defines the end-to-end behavior for provisioning a new
ERP-Market client stack on the VPS: template rendering, TLS key ownership,
idempotent resource creation, compose startup, and self-checking smoke
verification with loud abort on failure.

## Origin

Created from the `deploy-auto-improve` change — the first change in this
project. The delta spec (`openspec/changes/deploy-auto-improve/spec.md`)
became this baseline. Future changes that modify client-onboarding behavior
produce deltas against this file.

## Scope reset (ground truth)

The five bugs and the three hardening behaviors below are fixed scope. Fixes
MUST land in `deploy/scripts/add-client.sh`, `deploy/templates/docker-compose.client.yml`,
and `deploy/README.md`, and MUST later be propagated to `/opt/erp-market` on the
VPS. TLS handling explicitly does **NOT** use Docker `secrets:` and does **NOT**
generate keys inside the Postgres entrypoint — the fix is `chown 70:70` on the
generated key. The Caddy proxy smoke gate is best-effort over HTTP (port 443 is
blocked mid-bootstrap); full TLS/HTTPS verification stays out of the mandatory
path.

## Requirements

### CLIENT-ONBOARDING-01: Render produces a non-empty compose `name:`

The `add-client.sh` script MUST assign `CLIENT_SLUG="$SLUG"` before the
envsubst step so the rendered compose project `name:` is never empty.

- **Scenario: Fresh client renders a valid project name**
  - GIVEN a valid slug `acme` and a rendered
    `deploy/clients/acme/docker-compose.yml`
  - WHEN `add-client.sh acme` runs the envsubst render step
  - THEN the rendered file contains `name: acme`
  - AND the `name:` value is non-empty and equals the slug
  - AND no `docker compose` error of `"name must be a string"` is raised

- **Scenario: Render fails before writing a partial file**
  - GIVEN the template or an env variable is invalid
  - WHEN the envsubst render step fails
  - THEN no half-rendered `docker-compose.yml` is left in the client directory
  - AND the script reports a clear failure

### CLIENT-ONBOARDING-02: Compose up runs without the invalid `-q` flag

The `add-client.sh` script MUST invoke the client stack start without the `-q`
flag, while keeping `--build` so the API image is (re)built.

- **Scenario: Stack starts with `up -d --build` (no `-q`)**
  - GIVEN a rendered `deploy/clients/<slug>/docker-compose.yml`
  - WHEN the provision step runs `docker compose ... up -d --build` (no `-q`)
  - THEN the command succeeds with a zero exit code
  - AND no "unknown shorthand flag" / `-q` error from Compose v5.5.1 is raised

### CLIENT-ONBOARDING-03: API image builds from the corrected context

The client template MUST set the API `build.context` to `../../../backend` so
it resolves correctly from the rendered `deploy/clients/<slug>/` location.

- **Scenario: Correct context resolves the backend Dockerfile**
  - GIVEN the rendered compose file lives at `deploy/clients/<slug>/docker-compose.yml`
  - WHEN the API service is built with `context: ../../../backend`
  - THEN it resolves to `backend/` (repo root) and finds the `Dockerfile`
  - AND the build succeeds instead of failing on a missing `deploy/backend`

- **Scenario: Wrong context would fail loudly**
  - GIVEN a template still using `context: ../../backend`
  - WHEN a build is attempted from `deploy/clients/<slug>/`
  - THEN the build fails because `deploy/backend` does not exist
  - AND this failure is caught before the stack is marked provisioned

### CLIENT-ONBOARDING-04: DB healthcheck has a `start_period` for slow first boot

The client template's `db` healthcheck MUST carry `start_period: 60s` so a
slow first-boot Postgres data-dir initialization does not get marked unhealthy
before it finishes seeding, and the API's `service_healthy` depends_on
stabilizes.

- **Scenario: Healthcheck includes `start_period: 60s`**
  - GIVEN the client template `deploy/templates/docker-compose.client.yml`
  - WHEN inspecting the `db` service healthcheck
  - THEN it contains `start_period: 60s`
  - AND a fresh Postgres still becoming ready within the window reaches
    `healthy` without the API dependency failing permanently

- **Scenario: Postgres becomes healthy after a slow init**
  - GIVEN the DB volume is empty (first boot, must run initdb + seed)
  - WHEN `docker compose up -d` is run and the DB takes up to ~60s to be ready
  - THEN the DB container transitions to `healthy` after initialization
  - AND the `api` service, which `depends_on` `db` as `service_healthy`,
    starts after the DB is healthy

### CLIENT-ONBOARDING-05: TLS key is readable by Postgres (uid 70)

After `openssl` generates the per-client keypair, `add-client.sh` MUST set the
key's owner to uid 70 (`postgres`) and mode 600 so the read-only bind mount at
`/run/secrets` is readable by the `postgres:16-alpine` container. The generated
key MUST NOT use Docker secrets and MUST NOT be generated inside the entrypoint.

- **Scenario: Generated key owned by uid 70, mode 600**
  - GIVEN `add-client.sh` has just generated the TLS keypair
  - WHEN inspecting `deploy/clients/<slug>/tls/server.key`
  - THEN the key's owning uid is 70
  - AND its mode is 600 (rw-------)
  - AND a failed `chown` causes the script to fail with a clear message rather
    than continue with an unreadable key

- **Scenario: Postgres starts and loads the cert without error**
  - GIVEN `deploy/clients/<slug>/tls/server.key` is owned by uid 70, mode 600
  - WHEN the `db-<slug>` container starts with `ssl=on`
    (`ssl_key_file=/run/secrets/server.key`, mount `./tls:/run/secrets:ro`)
  - THEN Postgres starts without the error
    `"could not load server certificate file"`
  - AND TLS is active on the per-client bridge
  - AND the API can connect with Prisma `ssl:{rejectUnauthorized:false}`

- **Scenario: Cert is readable by unprivileged consumers**
  - GIVEN `deploy/clients/<slug>/tls/server.crt`
  - WHEN inspecting its permissions
  - THEN it is owned by uid 70 and readable enough (e.g. mode 600 or more open)
    for the postgres process to read it through the read-only mount

### CLIENT-ONBOARDING-06: Self-checking smoke step aborts loudly on failure

After startup, `add-client.sh` MUST (a) wait for `db-<slug>` to be `healthy`
(bounded by `start_period` + a wait loop), (b) `docker exec` into `api-<slug>`
and confirm `GET /api/health` returns 200 from inside the stack, and (c)
best-effort probe the Caddy proxy site over HTTP. Any of (a) or (b) failing
MUST abort the run with a non-zero exit code and an actionable next-step
message — it MUST NOT fall through to a silent "WARNING".

- **Scenario: Healthy stack reports success**
  - GIVEN `db-<slug>` is `healthy` and `api-<slug>` is running
  - WHEN the smoke step probes
    `docker exec api-<slug> ... GET http://127.0.0.1:3000/api/health`
  - THEN the response is HTTP 200
  - AND the script reports the health check OK
  - AND the run exits with code 0

- **Scenario: Unhealthy stack aborts with an actionable message**
  - GIVEN `api-<slug>` is not healthy within the bounded wait window
  - WHEN the smoke step runs
  - THEN the script exits with a non-zero code
  - AND prints an actionable message, e.g.
    `docker compose -f deploy/clients/<slug>/docker-compose.yml logs --tail=100 api`
  - AND it does NOT leave a silent WARNING and a broken stack behind

- **Scenario: DB never becomes healthy aborts the run**
  - GIVEN `db-<slug>` does not reach `healthy` within the bounded window
    (start_period + wait loop)
  - WHEN the smoke step waits for db readiness
  - THEN the run aborts with a non-zero exit code
  - AND the message points at the DB logs, e.g.
    `docker compose -f deploy/clients/<slug>/docker-compose.yml logs db`

### CLIENT-ONBOARDING-07: Idempotent rerun for an existing slug

Re-running `add-client.sh <slug>` for an existing slug MUST NOT error on
pre-existing resources. Existing `tls/` files, named volumes
(`erp-db-<slug>`, `erp-appdata-<slug>`), and the shared `erp_proxy` network MUST
be tolerated. The recommended behavior is a re-verify of existing slots
(idempotent smoke re-check); a hard abort is reserved for genuinely
conflicting or partial states (e.g. a corrupted client dir or mismatched
secrets).

- **Scenario: Re-running the same slug tolerates existing resources**
  - GIVEN `deploy/clients/<slug>/` already exists with `tls/`, volumes
    `erp-db-<slug>` and `erp-appdata-<slug>`, and the `erp_proxy` network exists
  - WHEN `add-client.sh <slug>` is run again
  - THEN the script does not fail on the existing `tls/` dir, volumes, or
    `erp_proxy` network (created idempotently)
  - AND it re-verifies the existing slot via the smoke step
  - AND it exits non-zero only if the re-verified stack is unhealthy

- **Scenario: `erp_proxy` network creation is idempotent**
  - GIVEN the shared network `erp_proxy` already exists
  - WHEN the script ensures the network
  - THEN no "already exists as external / already exists" error is raised
  - AND the network is reused without change

- **Scenario: Named volumes are declared idempotently**
  - GIVEN the client `erp-db-<slug>` and `erp-appdata-<slug>` volumes exist
  - WHEN the compose stack is started for the existing slug
  - THEN the volumes are reused, not recreated
  - AND no data is lost (no `down -v` on an idempotent rerun)

- **Scenario: Truly conflicting/partial state hard-aborts**
  - GIVEN a client dir exists in a conflicting or partial state (e.g. missing
    secrets or a corrupt rendered compose file that cannot be safely re-verified)
  - WHEN `add-client.sh <slug>` runs
  - THEN the script aborts with a clear, actionable message
  - AND points the operator at `remove-client.sh <slug>` as the escape hatch

### CLIENT-ONBOARDING-08: Slow first boot is tolerated with bounded wait

Provisioning MUST wait a bounded amount of time for Postgres first-boot init
and the API to come up, so a fresh client succeeds on a cold 2GB VPS without
failing spuriously or waiting forever.

- **Scenario: Cold client succeeds after bounded wait**
  - GIVEN a fresh 2GB/2vCPU VPS with empty volumes
  - WHEN `add-client.sh <slug>` runs and the DB + API take tens of seconds to
    become ready (within `start_period` + wait loop bounds)
  - THEN the stack reaches `healthy` and the smoke step succeeds within the
    bounded window
  - AND the script reports the client LIVE with a zero exit code

- **Scenario: Excessive delay is bounded, then aborts**
  - GIVEN the stack never becomes healthy within the configured bound
  - WHEN the wait loop exhausts its maximum attempts
  - THEN the run does not hang indefinitely
  - AND it aborts with the actionable smoke-failure message

### CLIENT-ONBOARDING-09: Caddy site is written idempotently and proxy gate is best-effort over HTTP

The per-client Caddy site file `deploy/caddy/sites/<slug>.caddy` MUST be
written idempotently (overwrite/rewrite for the same slug). The Caddy proxy
gate MUST be best-effort over HTTP (port 443 is blocked mid-bootstrap): a
successful proxy check is confirmatory but optional; an inactive Caddy MUST NOT
fail the onboarding — it produces a non-fatal notice and pointers to start the
operator stack. Full TLS/HTTPS verification is out of the mandatory path.

- **Scenario: Site file written idempotently for a slug**
  - GIVEN `deploy/caddy/sites/acme.caddy` already exists (from a prior run)
  - WHEN `add-client.sh acme` writes the site file again
  - THEN the file is overwritten idempotently with the same content
  - AND no duplicate-site or append error is raised
  - AND it declares `reverse_proxy api-acme:3000` for the resolved domain

- **Scenario: Caddy proxy probe works over HTTP when reachable**
  - GIVEN Caddy is running and the site is loaded
  - WHEN the proxy smoke probe requests the site over HTTP
  - THEN if reachable, `/api/health` answers and this is reported as a
    successful proxy check
  - AND the probe is treated as best-effort, not mandatory

- **Scenario: Inactive Caddy is a non-fatal notice**
  - GIVEN the operator Caddy stack (`deploy/docker-compose.yml`) is not running
  - WHEN the proxy gate runs
  - THEN onboarding does NOT fail
  - AND the script prints a non-fatal notice, e.g.
    `start it with: docker compose -f deploy/docker-compose.yml up -d`
  - AND the per-client stack is still verified via the in-stack `/api/health`

## Non-goals

- No new product features (no new endpoints, no UI, no client-facing behavior).
- No frontend or desktop (+Electron) changes.
- No redesign of TLS handling — no Docker `secrets:` and no in-entrypoint key
  generation; the fix is `chown 70:70` on the generated key.
- No migration to Coolify or any orchestration panel.
- No adding pgbouncer, replication, or HA.
- No rework of the offline-first/SQLite sync contract.

## Propagation requirement

All fixes MUST land in the repo working tree AND MUST be propagated to the
live VPS clone at `/opt/erp-market` so a fresh VPS clone works end-to-end.
The apply/verify phases MUST re-check each bug fix against the VPS state
and confirm all five bugs are gone there.

## Rollback

- `remove-client.sh <slug>` is the escape hatch for any client in a broken
  state. It tears down containers, volumes, networks, and the Caddy site.
  Database backups under `deploy/backups/<slug>/` are preserved.
- Repo rollback: `git checkout <prev>` on the affected deploy files, then
  re-run `add-client.sh` for affected clients.
- No destructive migration, no schema changes, no data loss on rollback.
