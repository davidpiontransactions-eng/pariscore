#!/bin/bash
# =============================================================================
# verify-cleanup.sh — Phase 1.4 post-cleanup verification (PariScore audit)
# Bugs covered: BUG-002 / BUG-007 / BUG-008 / BUG-027 / BUG-048
# =============================================================================
# WHAT THIS SCRIPT DOES
#   Runs five independent checks to confirm that the sensitive files have been
#   removed from the working tree, the git index, the rewritten history, and
#   (optionally) the production web server.
#
# USAGE
#   ./verify-cleanup.sh                 # checks 1-4 (git-side)
#   ./verify-cleanup.sh --remote        # also checks the live URL (check 5)
#
# EXIT CODE
#   0  — all checks passed
#   1  — at least one check failed (see report for details)
# =============================================================================
set -e

REMOTE_CHECK=0
if [ "$1" = "--remote" ]; then
  REMOTE_CHECK=1
fi

PASS=0
FAIL=0
WARN=0
RESULTS=""

record() {
  # $1 = status (PASS/FAIL/WARN), $2 = description
  local status="$1"
  local desc="$2"
  case "$status" in
    PASS) PASS=$((PASS + 1)) ;;
    FAIL) FAIL=$((FAIL + 1)) ;;
    WARN) WARN=$((WARN + 1)) ;;
  esac
  RESULTS+="  [$status] $desc"$'\n'
}

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "[verify] ERROR: not inside a git repository."
  exit 1
fi

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

echo "[verify] ==========================================================="
echo "[verify]  PariScore Phase 1.4 — cleanup verification"
echo "[verify]  Repository: $REPO_ROOT"
echo "[verify]  HEAD:       $(git rev-parse HEAD)"
echo "[verify] ==========================================================="

# --- Check 1: .jwt_secret must not be tracked --------------------------------
echo "[verify] Check 1/5 — .jwt_secret is NOT tracked"
JWT_TRACKED=$(git ls-files '.jwt_secret' '*/.jwt_secret')
if [ -z "$JWT_TRACKED" ]; then
  record PASS ".jwt_secret is not in git index"
else
  record FAIL ".jwt_secret IS still tracked: $JWT_TRACKED"
fi

# --- Check 2: no .db-wal / .db-shm / .bak / .backup / .log / .err tracked ---
echo "[verify] Check 2/5 — no DB sidecars, backups, logs, errors tracked"
LEAKS=$(git ls-files | grep -E '\.(db-wal|db-shm|db-journal|bak|backup|log|err)$' || true)
if [ -z "$LEAKS" ]; then
  record PASS "no tracked files matching sensitive extensions"
else
  COUNT=$(echo "$LEAKS" | wc -l)
  record FAIL "$COUNT file(s) with sensitive extensions still tracked:"
  RESULTS+="$(echo "$LEAKS" | sed 's/^/          /')"$'\n'
fi

# Also check zip archives and deploy-ovh.ps1
EXTRA_LEAKS=$(git ls-files | grep -E '(^|/)(vps\.zip|pariscore-fix\.zip|pariscore-design-fix\.zip|setpoint-v10\.zip|deploy-ovh\.ps1)$' || true)
if [ -n "$EXTRA_LEAKS" ]; then
  record WARN "additional sensitive files still tracked (review):"
  RESULTS+="$(echo "$EXTRA_LEAKS" | sed 's/^/          /')"$'\n'
else
  record PASS "no tracked sensitive zip / deploy-ovh.ps1 files"
fi

# Also check .pyc / __pycache__
PYC_LEAKS=$(git ls-files | grep -E '(__pycache__/|\.pyc$)' || true)
if [ -n "$PYC_LEAKS" ]; then
  record WARN "$(echo "$PYC_LEAKS" | wc -l) .pyc/__pycache__ file(s) still tracked (low severity)"
else
  record PASS "no .pyc / __pycache__ tracked"
fi

# --- Check 3: history scrubbed (no recent traces in deleted-file log) -------
echo "[verify] Check 3/5 — git history shows no recent traces"
# `git log --all --diff-filter=D --summary` shows files removed in any commit.
# After BFG + reflog expire + gc, those entries should be GONE from the
# rewritten history. We search across ALL refs.
HISTORY_LEAKS=$(git log --all --diff-filter=D --summary 2>/dev/null \
                | grep -E '\.jwt_secret|pariscore\.db-wal|pariscore\.db-shm|database\.db|deploy-ovh\.ps1' \
                || true)
if [ -z "$HISTORY_LEAKS" ]; then
  record PASS "no deleted-file history traces for sensitive files"
else
  LINES=$(echo "$HISTORY_LEAKS" | wc -l)
  record WARN "$LINES history line(s) still reference sensitive files"
  RESULTS+="$(echo "$HISTORY_LEAKS" | head -10 | sed 's/^/          /')"$'\n'
  RESULTS+="          (run bfg-cleanup.sh if these are recent) "$'\n'
fi

# Deeper check: scan ALL blob objects in the repo for known secret patterns.
# This catches blobs that might still be reachable through dangling refs.
echo "[verify] Check 3b/5 — scan all git blobs for JWT-secret pattern"
JWT_BLOBS=$(git rev-list --all --objects 2>/dev/null \
            | awk '{print $1}' \
            | sort -u \
            | while read -r sha; do
                git cat-file -p "$sha" 2>/dev/null \
                  | grep -Eq '^[0-9a-f]{64}$' \
                  && echo "$sha"
              done \
            | head -5 || true)
if [ -z "$JWT_BLOBS" ]; then
  record PASS "no 64-hex-char blob (likely JWT secret) found in object store"
else
  record FAIL "JWT-secret-shaped blob still present in object store:"
  RESULTS+="$(echo "$JWT_BLOBS" | sed 's/^/          /')"$'\n'
  RESULTS+="          (run: git gc --prune=now --aggressive) "$'\n'
fi

# --- Check 4: .gitignore contains the new patterns --------------------------
echo "[verify] Check 4/5 — .gitignore contains the new patterns"
MISSING_PATTERNS=""
for pat in '.jwt_secret' '*.db-wal' '*.db-shm' '*.bak' '*.backup' '*.log' '*.err' 'logs/' '__pycache__/' '*.pyc'; do
  if ! grep -qFx -- "$pat" .gitignore 2>/dev/null; then
    MISSING_PATTERNS="$MISSING_PATTERNS $pat"
  fi
done
if [ -z "$MISSING_PATTERNS" ]; then
  record PASS ".gitignore has all required security patterns"
else
  record FAIL ".gitignore is missing patterns:$MISSING_PATTERNS"
  RESULTS+="          Apply gitignore-additions.patch to fix."$'\n'
fi

# --- Check 5: production URL no longer serves .jwt_secret --------------------
if [ "$REMOTE_CHECK" -eq 1 ]; then
  echo "[verify] Check 5/5 — production URL does not serve .jwt_secret"
  URL="https://pariscore.fr/.jwt_secret"
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$URL" 2>/dev/null || echo "000")
  case "$HTTP_CODE" in
    403|404|405)
      record PASS "$URL returns $HTTP_CODE (good — not served)"
      ;;
    200)
      record FAIL "$URL returns 200 — secret is STILL publicly accessible!"
      ;;
    000)
      record WARN "could not reach $URL (network/timeout)"
      ;;
    *)
      record WARN "$URL returned unexpected HTTP $HTTP_CODE"
      ;;
  esac
else
  echo "[verify] Check 5/5 — SKIPPED (run with --remote to test production URL)"
  record WARN "remote URL check skipped (use --remote)"
fi

# --- Final report ------------------------------------------------------------
echo
echo "[verify] ==========================================================="
echo "[verify]  VERIFICATION REPORT"
echo "[verify] ==========================================================="
printf "%s" "$RESULTS"
echo "[verify] -----------------------------------------------------------"
echo "[verify]  PASS: $PASS    FAIL: $FAIL    WARN: $WARN"
echo "[verify] ==========================================================="

if [ "$FAIL" -gt 0 ]; then
  echo "[verify] RESULT: ❌ FAILED — review the FAIL items above."
  exit 1
elif [ "$WARN" -gt 0 ]; then
  echo "[verify] RESULT: ⚠️  PASSED WITH WARNINGS — review before deploying."
  exit 0
else
  echo "[verify] RESULT: ✅ ALL CHECKS PASSED."
  exit 0
fi
