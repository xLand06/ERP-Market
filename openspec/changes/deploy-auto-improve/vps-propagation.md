# VPS Propagation — deploy-auto-improve

## Overview

The five provisioning bugs and the three hardening behaviors were fixed and
committed in the repo working tree. To make a fresh VPS clone work end-to-end,
the fixed files must be propagated to the live clone at `/opt/erp-market` and
re-verified there. Run the commands below on the VPS as root.

## Propagate

```bash
cd /opt/erp-market
git pull                       # fetches the deploy-auto-improve commits
```

Verify the three fixed files are present with the new content:

```bash
ls -l deploy/scripts/add-client.sh \
      deploy/templates/docker-compose.client.yml \
      deploy/README.md
```

## Re-run the static checks on the VPS copy

```bash
cd /opt/erp-market

# BUG 1: CLIENT_SLUG assigned before envsubst (must return a match)
grep -n 'CLIENT_SLUG="\$SLUG"' deploy/scripts/add-client.sh

# BUG 2: no -q flag in compose up (must return a match, no -q variant remains)
grep -n 'up -d --build' deploy/scripts/add-client.sh | grep -v '\-q'

# BUG 3: build context corrected (must return a match)
grep -n 'context: ../../../backend' deploy/templates/docker-compose.client.yml

# BUG 4: db healthcheck start_period present (must return a match)
grep -n 'start_period: 60s' deploy/templates/docker-compose.client.yml

# BUG 5: chown 70:70 on server.key (must return a match)
grep -n 'chown 70:70.*server\.key' deploy/scripts/add-client.sh

# Idempotency guard present
grep -c 'REVERIFY' deploy/scripts/add-client.sh   # must be > 0
```

## Re-verify an existing slug

Pick any already-provisioned slug (e.g. `acme`) and re-run:

```bash
cd /opt/erp-market
./deploy/scripts/add-client.sh acme
```

Expected: prints "client 'acme' already provisioned — re-verifying...",
the smoke step passes, and the script exits 0 with
"already provisioned — re-verified OK".

## Fresh-slug smoke test (optional but recommended)

```bash
cd /opt/erp-market
./deploy/scripts/add-client.sh smoke-test
./deploy/scripts/remove-client.sh smoke-test   # clean up after
```

Expected: the smoke step prints "db-smoke-test healthy", "api-smoke-test
/api/health OK", and "smoke check OK — db healthy, /api/health returned 200
(inside stack)" with a zero exit code.

## TLS ownership check on a live client

```bash
cd /opt/erp-market
stat -c '%u:%a %n' deploy/clients/<slug>/tls/server.key
# Expected: 70:600 deploy/clients/<slug>/tls/server.key
```

## Postgres log check (no cert error)

```bash
docker compose -f deploy/clients/<slug>/docker-compose.yml logs db 2>&1 | grep -i "certificate"
# Should return nothing (no "could not load server certificate file")
```

## Verification checklist

| Check | Command | Expected |
|-------|---------|----------|
| CLIENT-ONBOARDING-01 | `grep -n 'CLIENT_SLUG="\$SLUG"' add-client.sh` | match |
| CLIENT-ONBOARDING-02 | `grep -n 'up -d --build' add-client.sh \| grep -v '\-q'` | match, no `-q` |
| CLIENT-ONBOARDING-03 | `grep -n 'context: ../../../backend' template` | match |
| CLIENT-ONBOARDING-04 | `grep -n 'start_period: 60s' template` | match |
| CLIENT-ONBOARDING-05 | `grep -n 'chown 70:70.*server\.key' add-client.sh` | match |
| CLIENT-ONBOARDING-05 (live) | `stat -c '%u:%a' client/tls/server.key` | `70:600` |
| CLIENT-ONBOARDING-05 (live) | `docker compose ... logs db \| grep -i certificate` | empty |
| CLIENT-ONBOARDING-06/07/08 | Re-run + fresh-slug smoke | exit 0, "re-verified OK" |
| CLIENT-ONBOARDING-09 | Caddy site file + HTTP probe notice | site declares `reverse_proxy` |
