# Archive Report: deploy-auto-improve

## Status: CLOSED-WITH-FOLLOWUP

Change is CLOSED in the repo working tree. All five bugs are fixed, three
hardening behaviors are implemented, documentation is corrected, and 3 commits
are on master. One explicit follow-up remains: the user must run VPS propagation
and live validation on the production VPS (commands in `vps-propagation.md`).

## Change Summary

Harden the multi-tenant ERP-Market VPS onboarding kit so that
`deploy/scripts/add-client.sh <slug>` is fully automatic and error-free.

**Bug fixes (5):**

| # | Bug | File | Fix |
|---|-----|------|-----|
| 1 | `CLIENT_SLUG` never assigned → empty compose `name:` | `add-client.sh:57` | `CLIENT_SLUG="$SLUG"` before envsubst |
| 2 | `-q` invalid flag on Compose v5.5.1 `up` | `add-client.sh:178` | Removed `-q`; keep `--build` |
| 3 | Wrong build context `../../backend` | `docker-compose.client.yml:69` | Corrected to `../../../backend` |
| 4 | DB healthcheck missing `start_period` | `docker-compose.client.yml:63` | `start_period: 60s` confirmed present |
| 5 | TLS key root-owned, unreadable by uid 70 | `add-client.sh:139-142` | `chown 70:70` with hard-fail guard |

**Hardening (3):**

| Behavior | Implementation |
|----------|----------------|
| Idempotent rerun | `REVERIFY` detection: skips TLS/.env/envsubst on existing slug; `CLEANUP_DISABLED=1` set early; partial state hard-aborts with `remove-client.sh` pointer |
| Bounded smoke | DB wait ≤120s via `docker inspect Health.Status`; API probe ≤60s via `docker exec node fetch`; abort with debug command on failure; stack left in place for diagnosis |
| Caddy best-effort HTTP probe | `curl -sf --max-time 10 http://` after reload; non-fatal NOTICE if inactive/ACME-pending; no HTTPS gating |

**Documentation (1):**

| File | Changes |
|------|---------|
| `deploy/README.md` | TLS ownership corrected (mode 600, uid 70 — not "mode 644"); new subsections: "Idempotent reruns", "Smoke verification", "First-boot timing" |

## Artifact Lineage

```
proposal.md  →  spec.md  →  design.md  →  tasks.md  →  apply  →  verify-report.md  →  archive-report.md
    │                │              │              │          │              │                   │
    │                │              │              │          │              │                   │
  (intent)     (9 scenarios   (7-stage       (11 tasks    (3 commits   (PASS-WITH-        (this file)
                across 9       pipeline,      T1-T11)      on master)   WARNINGS)
                CLIENT-ONBO-   TLS design,
                ARDING         idempotency,
                requirements)  smoke design)
```

**Engram topic keys (proposed):**
- `sdd/deploy-auto-improve/proposal`
- `sdd/deploy-auto-improve/spec`
- `sdd/deploy-auto-improve/design`
- `sdd/deploy-auto-improve/tasks`
- `sdd/deploy-auto-improve/apply-progress`
- `sdd/deploy-auto-improve/verify-report`
- `sdd/deploy-auto-improve/archive-report`

## Final-State Facts

- **Commits on master** (3, on top of parent `96aa09b`):
  - `0f13405` fix(deploy): harden add-client provisioning — TLS chown, smoke check, idempotent reruns
  - `81eb41b` docs(deploy): correct TLS ownership; document rerun, smoke, first-boot timing
  - `bf175a4` docs(deploy): add VPS propagation marker for deploy-auto-improve
- **Files changed** (4, all in scope):
  - `deploy/scripts/add-client.sh` (273 lines, ~95 changed)
  - `deploy/templates/docker-compose.client.yml` (111 lines, ~2 changed)
  - `deploy/README.md` (255 lines, ~45 changed)
  - `openspec/changes/deploy-auto-improve/vps-propagation.md` (101 lines, new)
- **Out-of-scope files NOT touched**: `frontend/*`, `.atl/*` — confirmed via `git diff --name-only 96aa09b..HEAD`
- **No product features**: no new endpoints, no UI changes, no client-facing behavior

## Verification Results (PASS-WITH-WARNINGS)

| Requirement | Task | Status | Evidence |
|---|---|---|---|
| CLIENT-ONBOARDING-01: CLIENT_SLUG assigned | T1 | PASS | line 57 |
| CLIENT-ONBOARDING-02: no `-q` flag | T2 | PASS | line 178, no `-q` variant |
| CLIENT-ONBOARDING-03: context `../../../backend` | T3 | PASS | line 69 |
| CLIENT-ONBOARDING-04: `start_period: 60s` | T4 | PASS | line 63 |
| CLIENT-ONBOARDING-05: `chown 70:70` + hard-fail | T5 | PASS | lines 139-142 |
| CLIENT-ONBOARDING-06: smoke aborts loudly | T7 | PASS | db wait (182), api exec (210), exit 1 on failure |
| CLIENT-ONBOARDING-07: idempotent rerun | T6 | PASS | 4 REVERIFY hits; CLEANUP_DISABLED=1 early (72) |
| CLIENT-ONBOARDING-08: bounded wait | T7 | PASS | DB_TIMEOUT=120, API_TIMEOUT=60 |
| CLIENT-ONBOARDING-09: Caddy best-effort HTTP | T8 | PASS | curl http:// non-fatal (245-253) |
| T9: README corrections | T9 | PASS | No "mode 644"; docs match implementation |
| T10: static verification | T10 | PASS | bash -n clean; all grep checks pass |
| T11: VPS propagation marker | T11 | PASS | vps-propagation.md with exact commands |

**Warnings:**
- **W1 (Low):** shellcheck unavailable locally — tooling constraint, not a code defect
- **W2 (Medium):** Live VPS behavior unverifiable from dev environment — mitigated by vps-propagation.md commands
- **W3 (Low):** `CLEANUP_DISABLED` semantics correct but fragile across refactors — comment suggestion noted
- **W4 (Low):** `CLIENT_DOMAIN` exported but unused in template — harmless, cosmetic only

**No CRITICAL findings.**

## Open Follow-ups

### VPS Propagation (user action required)

**Location:** `openspec/changes/deploy-auto-improve/vps-propagation.md`

**What to do:** Run the following on the VPS (89.167.46.144) as root:

```bash
# 1. Pull the fixes
cd /opt/erp-market && git pull

# 2. Verify all 5 bug fixes are present
grep -n 'CLIENT_SLUG="\$SLUG"' deploy/scripts/add-client.sh
grep -n 'up -d --build' deploy/scripts/add-client.sh | grep -v '\-q'
grep -n 'context: ../../../backend' deploy/templates/docker-compose.client.yml
grep -n 'start_period: 60s' deploy/templates/docker-compose.client.yml
grep -n 'chown 70:70.*server\.key' deploy/scripts/add-client.sh

# 3. Re-verify an existing slug
./deploy/scripts/add-client.sh <existing-slug>

# 4. (Optional) Fresh-slug smoke test
./deploy/scripts/add-client.sh smoke-test
./deploy/scripts/remove-client.sh smoke-test

# 5. TLS ownership on a live client
stat -c '%u:%a %n' deploy/clients/<slug>/tls/server.key
# Expected: 70:600

# 6. Postgres cert error check
docker compose -f deploy/clients/<slug>/docker-compose.yml logs db 2>&1 | grep -i "certificate"
# Expected: empty
```

This is the single remaining action to fully close the end-to-end validation.

## Baseline Update

**Created:** `openspec/specs/client-onboarding/spec.md`

This is the first change in the project, so no pre-existing baseline existed. The
delta spec (`openspec/changes/deploy-auto-improve/spec.md`) defines 9
CLIENT-ONBOARDING requirements with Given/When/Then scenarios. Those 9
requirements are now captured verbatim as the capability baseline in
`openspec/specs/client-onboarding/spec.md`, faithful to the delta. Future changes
that modify client-onboarding behavior will produce deltas against this baseline.

The baseline covers:
- CLIENT-ONBOARDING-01 through CLIENT-ONBOARDING-09
- All 17 scenarios from the delta spec
- Non-goals and scope-reset sections
- Propagation requirement (VPS clone must stay in sync)

## Rollback Notes

- **This is a bugfix to shell scripts and a compose template — no data mutation.**
- **Repo rollback:** `git checkout <prev> -- deploy/scripts/add-client.sh deploy/templates/docker-compose.client.yml deploy/README.md`
- **VPS rollback:** pull the previous revision in `/opt/erp-market`, re-run `add-client.sh` for affected clients.
- **Client escape hatch:** `remove-client.sh <slug>` tears down containers, volumes, networks, and Caddy site. Database backups under `deploy/backups/<slug>/` are preserved.
- **No destructive migration**, no schema changes, no data loss on rollback. TLS keys are regenerable. Volumes and networks are idempotent.
- **The chown 70:70 change is non-destructive**: it only changes the uid owner of freshly-generated keys. If rollback is needed, re-running the previous script version regenerates new keys with the old (root) ownership — existing Postgres data volumes are unaffected.
