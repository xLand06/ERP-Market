# Verify Report: deploy-auto-improve

## Summary

**Status: PASS-WITH-WARNINGS**

All 10 implementation tasks (T1-T9, T11) verified against spec and design. Five bugs fixed, three hardening behaviors implemented, documentation corrected, VPS propagation marker present. Two warnings: shellcheck unavailable locally, and live VPS behavior cannot be verified from this environment.

## Verification Matrix

| Requirement | Task | Status | Evidence |
|---|---|---|---|
| CLIENT-ONBOARDING-01: CLIENT_SLUG assigned before envsubst | T1 | **PASS** | `grep -n 'CLIENT_SLUG="\$SLUG"'` → line 57 |
| CLIENT-ONBOARDING-02: no `-q` on compose up | T2 | **PASS** | `up -d --build` at line 178; `grep 'up -d --build -q'` → no match |
| CLIENT-ONBOARDING-03: context `../../../backend` | T3 | **PASS** | `grep -n 'context: ../../../backend'` → line 69; no `../../backend` remains |
| CLIENT-ONBOARDING-04: `start_period: 60s` on db | T4 | **PASS** | `grep -n 'start_period: 60s'` → line 63 |
| CLIENT-ONBOARDING-05: `chown 70:70 server.key` + hard-fail | T5 | **PASS** | Lines 139-140: `if ! chown 70:70 ...; then fail ...; fi` |
| CLIENT-ONBOARDING-06: smoke aborts loudly | T7 | **PASS** | db wait via `docker inspect Health.Status` (line 187), api via `docker exec node fetch` (line 210), `exit 1` with debug + escape hatch on failure; no silent WARNING |
| CLIENT-ONBOARDING-07: idempotent rerun | T6 | **PASS** | 4 REVERIFY occurrences; `CLEANUP_DISABLED=1` set at line 72 (early reverify) + line 179 (post-up); partial dir/missing key hard-aborts |
| CLIENT-ONBOARDING-08: bounded wait | T7 | **PASS** | DB_TIMEOUT=120s (line 182), API_TIMEOUT=60s (line 205), 5s polling steps, hard exit on timeout |
| CLIENT-ONBOARDING-09: Caddy best-effort HTTP | T8 | **PASS** | `cat >` idempotent overwrite (line 232), `curl -sf --max-time 10 http://` (line 245), non-fatal NOTICE (lines 248-253), no HTTPS gating |
| T9: README corrections | T9 | **PASS** | No "mode 644" claim; documents idempotent reruns, smoke verification, first-boot timing |
| T10: static verification gate | T10 | **PASS** | bash -n clean; all T1-T5 grep checks pass; envsubst list audited |
| T11: VPS propagation marker | T11 | **PASS** | `vps-propagation.md` exists (101 lines), contains exact grep/stat commands and verification checklist |
| envsubst export list ↔ template | T10 | **PASS** | 7 vars exported; template uses 6 `${...}` placeholders; CLIENT_DOMAIN exported but unused in template (harmless, see SUGGESTION) |
| No out-of-scope files touched | — | **PASS** | `git diff --name-only 96aa09b..HEAD`: only deploy/README.md, deploy/scripts/add-client.sh, deploy/templates/docker-compose.client.yml, vps-propagation.md |
| git log: 3 expected commits on top of 96aa09b | — | **PASS** | 0f13405 → 81eb41b → bf175a4, parent 96aa09b confirmed |

## CRITICAL Findings

None.

## WARNING Findings

### W1: shellcheck unavailable in local environment

**Impact:** Low. Static analysis tool not present; cannot confirm zero shellcheck warnings.

**Mitigation:** The script uses `set -Eeuo pipefail` which catches most runtime issues. All grep-based acceptance checks pass. The VPS propagation marker (`vps-propagation.md`) does NOT list shellcheck as a required VPS check — it only runs the grep/stat commands. The implementer should run `shellcheck` locally or in CI before merging.

**Status:** Acceptable — shellcheck is a tooling constraint, not a code defect.

### W2: live VPS behavior unverifiable from this environment

**Impact:** Medium. Cannot SSH to 89.167.46.144 to run the re-verify and fresh-slug smoke test on the live VPS. T11 (VPS propagation) is verified only as a marker file with exact commands.

**Mitigated by:** The marker file (`vps-propagation.md`) contains a complete verification checklist with exact commands. The user must run `git pull` on the VPS and execute the checks manually. Risk is LOW — the script logic is identical between repo and VPS clone; the only unknown is whether the VPS Docker/Postgres runtime behaves as expected, which is a runtime concern not a code correctness concern.

### W3: `down -v` only in trap, not post-up — correct but fragile

**Impact:** Low. The `down -v --remove-orphans` at line 115 is inside the `cleanup()` trap (ERR handler). It only runs when `CLEANUP_DISABLED=0` (pre-up failures). After compose up, `CLEANUP_DISABLED=1` at line 179 blocks it. On reverify, `CLEANUP_DISABLED=1` is set even earlier (line 72). This is correct per design, but if the trap semantics change in a future refactor, the safety guarantee could silently break.

**Suggestion:** Add a comment at line 179 explaining the invariant: `# INVARIANT: set CLEANUP_DISABLED=1 immediately after compose up — trap must never run docker compose down -v on a live stack`.

## SUGGESTION Findings

### S1: CLIENT_DOMAIN in envsubst export but unused in template

The envsubst export list is `CLIENT_SLUG CLIENT_DOMAIN CLIENT_URL DB_NAME DB_USER DB_PASSWORD JWT_SECRET` (7 vars). The template only uses 6 `${...}` placeholders: CLIENT_SLUG, CLIENT_URL, DB_NAME, DB_USER, DB_PASSWORD, JWT_SECRET. CLIENT_DOMAIN is exported but never substituted in the template — the Caddy heredoc in the script uses `$CLIENT_DOMAIN` directly via shell expansion, not envsubst.

This is harmless (envsubst ignores extra vars in the list) but technically the export list and template placeholder set are not identical. Consider either (a) removing CLIENT_DOMAIN from the envsubst var list (since it's only used in the shell heredoc), or (b) noting this intentionally in a comment.

### S2: trap `CLEANUP_DISABLED` default could be explicit

Line 113: `if [[ "${CLEANUP_DISABLED:-0}" == "0" ]]` uses `:-0` as default. The variable is never initialized before the trap check (only set at lines 72 and 179). This works correctly because unset → default "0" → cleanup runs. Consider adding `CLEANUP_DISABLED=0` near the top of the script (after `set -Eeuo pipefail`) for explicitness, though the current behavior is correct.

### S3: Shellcheck disable comment for SC2016 is present but could be more specific

Line 159-160 has `# shellcheck disable=SC2016` for the envsubst variable list. This is correct but could include `# (single-quoted list is passed literally to envsubst — must NOT expand here)` which is already on line 160. No action needed; the existing comment is adequate.

## VPS Propagation Status

**Marker file:** `openspec/changes/deploy-auto-improve/vps-propagation.md` — 101 lines, contains:
- Propagation command: `cd /opt/erp-market && git pull`
- All 5 grep verification commands for the VPS copy
- Re-verify an existing slug command
- Fresh-slug smoke test command
- TLS ownership stat check
- Postgres log check for cert errors
- Verification checklist table mapping CLIENT-ONBOARDING requirements to commands

**User action required:** Run `git pull` on the VPS (89.167.46.144) and execute the verification commands from the marker file.

## Evidence

### bash -n (syntax check)
```
$ bash -n deploy/scripts/add-client.sh
EXIT:0  (clean — no syntax errors)
```

### shellcheck
```
SHELLCHECK_UNAVAILABLE — binary not found in local environment
```

### T1: CLIENT_SLUG assignment
```
57:CLIENT_SLUG="$SLUG"
EXIT:0
```

### T2: compose up without -q
```
178:docker compose -f "$CLIENT_DIR/docker-compose.yml" up -d --build
```
`grep 'up -d --build -q'` → exit 1 (no match — no `-q` variant remains)

### T3: build context
```
69:      context: ../../../backend
```
`grep 'context: ../../backend'` → exit 1 (no old context remains)

### T4: DB healthcheck start_period
```
63:      start_period: 60s
```

### T5: chown 70:70 with hard-fail
```
139:    if ! chown 70:70 "$CLIENT_DIR/tls/server.key"; then
140:        fail "chown 70:70 on server.key failed — Postgres (uid 70) won't be able to read the TLS key"
```

### T6: REVERIFY + CLEANUP_DISABLED
```
$ grep -c 'REVERIFY' add-client.sh → 4

72:    CLEANUP_DISABLED=1     (inside REVERIFY block, before compose up)
179:CLEANUP_DISABLED=1        (after compose up)
```

### T7: smoke probes
```
187:    db_status="$(docker inspect --format '{{.State.Health.Status}}' "db-$SLUG" 2>/dev/null || true)"
210:    if docker exec "api-$SLUG" \
```
`grep 'down -v'` → only at line 115 (inside cleanup trap, guarded by `CLEANUP_DISABLED=0`)

### T8: Caddy site + HTTP probe
```
232: cat > "$SITE_FILE" <<EOF      (idempotent overwrite)
245:     if curl -sf --max-time 10 "http://$CLIENT_DOMAIN/api/health" >/dev/null 2>&1; then
248:         echo "NOTICE: caddy proxy not yet reachable ... (non-fatal)"
252:     echo "NOTICE: operator Caddy (deploy/docker-compose.yml) is not running — site file written but inactive"
```

### T9: README
- `grep 'mode 644' README.md` → exit 1 (no match — claim removed)
- Documented sections found: Idempotent reruns (118), Smoke verification (136), First-boot timing (152)

### envsubst export list vs template placeholders
```
Export list (7): CLIENT_SLUG CLIENT_DOMAIN CLIENT_URL DB_NAME DB_USER DB_PASSWORD JWT_SECRET
Template ${...} (6): CLIENT_SLUG CLIENT_URL DB_NAME DB_PASSWORD DB_USER JWT_SECRET
Compose-escaped $${...} (excluded): POSTGRES_DB, POSTGRES_USER
→ CLIENT_DOMAIN exported but unused in template (harmless, see S1)
```

### git log
```
bf175a4 docs(deploy): add VPS propagation marker for deploy-auto-improve
81eb41b docs(deploy): correct TLS ownership; document rerun, smoke, first-boot timing
0f13405 fix(deploy): harden add-client provisioning — TLS chown, smoke check, idempotent reruns
96aa09b chore(deploy): add multi-tenant VPS deployment kit   ← parent confirmed
```

### out-of-scope files
```
git diff --name-only 96aa09b..HEAD:
  deploy/README.md
  deploy/scripts/add-client.sh
  deploy/templates/docker-compose.client.yml
  openspec/changes/deploy-auto-improve/vps-propagation.md

No frontend/, .atl/, or other out-of-scope files touched.
```
