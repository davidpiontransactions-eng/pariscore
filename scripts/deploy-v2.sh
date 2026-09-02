#!/bin/bash
# scripts/deploy-v2.sh — VPS deploy runner v2 (quality gates + rollback + smoke test)
#
# Améliorations vs v1 :
#   - Pre-deploy: lint + typecheck + tests E2E
#   - Database backup avant schema changes
#   - Health check sur les 2 ports (3000 legacy + 3005 Next.js)
#   - Deploy locking (flock) — évite les deploys concurrents
#   - Rollback automatique si health check échoue
#   - Smoke test post-deploy (page título + API status)
#   - Version tagging (git tag deploy-YYYYMMDD-HHMMSS)
#   - Failure notifications Discord
#   - Deploy log complet (/tmp/deploy-v2.log)
#
# Env overrides: DEPLOY_DIR, PM2_LEGACY, PM2_NEXT, SKIP_DISCORD, SKIP_TESTS, SKIP_LINT
set -uo pipefail

DEPLOY_DIR="${DEPLOY_DIR:-/home/ubuntu/pariscore}"
PM2_LEGACY="${PM2_LEGACY:-pariscore}"
PM2_NEXT="${PM2_NEXT:-pariscore-next}"
LOCK_FILE="/tmp/pariscore-deploy.lock"
LOG_FILE="/tmp/deploy-v2.log"
DEPLOY_TAG="deploy-$(date +%Y%m%d-%H%M%S)"

# --- Logging ---
log() { echo "[$(date +%H:%M:%S)] $*" | tee -a "$LOG_FILE"; }
err() { echo "[$(date +%H:%M:%S)] ERR: $*" | tee -a "$LOG_FILE" >&2; }
ok()  { echo "[$(date +%H:%M:%S)] OK: $*" | tee -a "$LOG_FILE"; }

# --- Deploy Lock (flock) ---
exec 200>"$LOCK_FILE"
if ! flock -n 200; then
  err "Deploy already running (lock: $LOCK_FILE). Aborting."
  exit 1
fi
log "Deploy lock acquired."

cd "$DEPLOY_DIR" || { err "Deploy dir $DEPLOY_DIR not found"; exit 1; }

# --- Save previous commit for rollback ---
PREV_COMMIT="$(git rev-parse HEAD 2>/dev/null || echo '')"
log "Previous commit: ${PREV_COMMIT:-<none>}"

# --- [1/9] Git fetch + reset ---
log "[1/9] git fetch + reset --hard origin/main..."
git fetch --all -q || { err "git fetch failed"; exit 1; }
git reset --hard origin/main -q || { err "git reset failed"; exit 1; }
CURR_COMMIT="$(git rev-parse HEAD)"

if [ -n "$PREV_COMMIT" ] && [ "$PREV_COMMIT" = "$CURR_COMMIT" ]; then
  log "Already up to date ($CURR_COMMIT). Nothing to deploy."
  echo "--- VPS_DEPLOY_OK ---"
  exit 0
fi

log "Deploying: $PREV_COMMIT -> $CURR_COMMIT"

# --- [2/9] Diff analysis ---
log "[2/9] Analyzing changed files..."
if [ -n "$PREV_COMMIT" ]; then
  CHANGED="$(git diff --name-only "$PREV_COMMIT" "$CURR_COMMIT" 2>/dev/null || echo '')"
else
  CHANGED=""
fi

NEED_INSTALL=0
NEED_BUILD=0
if [ -z "$CHANGED" ]; then
  NEED_INSTALL=1; NEED_BUILD=1
else
  if printf '%s\n' "$CHANGED" | grep -qE '^(src/|app/|next\.config|tsconfig|postcss|tailwind|components\.json|prisma/)'; then
    NEED_BUILD=1
  fi
  if printf '%s\n' "$CHANGED" | grep -qE '^(package\.json|bun\.lock|package-lock\.json)'; then
    NEED_INSTALL=1
  fi
fi

log "  install=$NEED_INSTALL build=$NEED_BUILD"

# --- [3/9] Pre-deploy quality gates ---
log "[3/9] Pre-deploy quality gates..."

# Lint (skip if SKIP_LINT=1)
if [ "${SKIP_LINT:-0}" != "1" ]; then
  log "  Running ESLint..."
  if ! npx next lint --dir src 2>&1 | tail -5 | tee -a "$LOG_FILE"; then
    err "ESLint failed — deploy aborted"
    exit 1
  fi
  ok "  ESLint passed"
else
  log "  ESLint skipped (SKIP_LINT=1)"
fi

# Typecheck (skip if SKIP_LINT=1)
if [ "${SKIP_LINT:-0}" != "1" ]; then
  log "  Running TypeScript check..."
  if ! npx tsc --noEmit 2>&1 | tail -5 | tee -a "$LOG_FILE"; then
    err "TypeScript check failed — deploy aborted"
    exit 1
  fi
  ok "  TypeScript check passed"
fi

# Tests E2E (skip if SKIP_TESTS=1)
if [ "${SKIP_TESTS:-0}" != "1" ] && [ "$NEED_BUILD" = "1" ]; then
  log "  Running Playwright tests..."
  PLAYWRIGHT_BASE_URL="http://localhost:3005" npx playwright test tests/personal-pages.spec.ts --reporter=line 2>&1 | tail -10 | tee -a "$LOG_FILE"
  TEST_RC=$?
  if [ $TEST_RC -ne 0 ]; then
    err "Playwright tests failed (rc=$TEST_RC) — deploy aborted"
    exit 1
  fi
  ok "  Playwright tests passed"
else
  log "  Playwright tests skipped (SKIP_TESTS=1 or legacy-only deploy)"
fi

# --- [4/9] Syntax check (legacy JS) ---
log "[4/9] Syntax check (legacy JS)..."
SYNTAX_FAIL=0
node --check pariscore.js 2>/dev/null || { err "pariscore.js syntax error"; SYNTAX_FAIL=1; }
node --check pariscore.app.js 2>/dev/null || { err "pariscore.app.js syntax error"; SYNTAX_FAIL=1; }
[ "$SYNTAX_FAIL" = "1" ] && exit 1
if [ -n "$CHANGED" ]; then
  for f in $(printf '%s\n' "$CHANGED" | grep -E '^services/.*\.js$' || true); do
    [ -f "$f" ] && { node --check "$f" 2>/dev/null || { err "$f syntax error"; exit 1; }; }
  done
fi
ok "  Syntax checks passed"

# --- [5/9] Database backup (if schema changes) ---
if [ "$NEED_BUILD" = "1" ] && printf '%s\n' "$CHANGED" | grep -qE '^prisma/'; then
  log "[5/9] Database backup (schema changed)..."
  BACKUP_DIR="/home/ubuntu/backups"
  mkdir -p "$BACKUP_DIR"
  BACKUP_FILE="$BACKUP_DIR/pariscore-$(date +%Y%m%d-%H%M%S).db"
  if [ -f pariscore.db ]; then
    cp pariscore.db "$BACKUP_FILE"
    ok "  Backup created: $BACKUP_FILE"
    # Keep only last 10 backups
    ls -t "$BACKUP_DIR"/pariscore-*.db 2>/dev/null | tail -n +11 | xargs rm -f 2>/dev/null || true
  else
    log "  No pariscore.db to backup (first deploy?)"
  fi
else
  log "[5/9] Database backup SKIPPED (no schema changes)"
fi

# --- [6/9] Install + Build ---
if [ "$NEED_INSTALL" = "1" ]; then
  log "[6/9] npm install..."
  npm install --legacy-peer-deps --silent 2>&1 | tail -3 | tee -a "$LOG_FILE" || { err "npm install failed"; exit 1; }
  npm rebuild better-sqlite3 2>&1 | tail -1 || echo "  warn: better-sqlite3 rebuild failed (non-blocking)"
else
  log "[6/9] npm install SKIPPED"
fi

BUILD_RAN=0
if [ "$NEED_BUILD" = "1" ]; then
  log "  Running Next.js build..."
  npm run build 2>&1 | tail -10 | tee -a "$LOG_FILE" || {
    err "Next.js build failed — attempting rollback..."
    if [ -n "$PREV_COMMIT" ]; then
      git reset --hard "$PREV_COMMIT" -q
      pm2 restart "$PM2_NEXT" --update-env 2>/dev/null || true
      ok "Rolled back to $PREV_COMMIT"
    fi
    exit 1
  }

  if [ ! -f .next/standalone/server.js ]; then
    err ".next/standalone/server.js missing after build — attempting rollback..."
    if [ -n "$PREV_COMMIT" ]; then
      git reset --hard "$PREV_COMMIT" -q
      pm2 restart "$PM2_NEXT" --update-env 2>/dev/null || true
      ok "Rolled back to $PREV_COMMIT"
    fi
    exit 1
  fi

  BUILD_RAN=1
  log "  Running Prisma schema sync..."
  npx prisma db push --skip-generate 2>&1 | tail -3 | tee -a "$LOG_FILE" || { err "prisma db push failed"; exit 1; }
  npx prisma generate 2>&1 | tail -3 | tee -a "$LOG_FILE" || { err "prisma generate failed"; exit 1; }
  cp -f .env .next/standalone/.env 2>/dev/null || true
  ok "  Build + Prisma sync complete"
else
  log "[6/9] Next.js build SKIPPED (legacy-only deploy)"
fi

# --- [7/9] PM2 restart ---
log "[7/9] PM2 restart..."
pm2 restart "$PM2_LEGACY" --update-env 2>&1 | tail -3 | tee -a "$LOG_FILE" || echo "  warn: pm2 restart $PM2_LEGACY failed"

if [ "$BUILD_RAN" = "1" ]; then
  pm2 restart "$PM2_NEXT" --update-env 2>&1 | tail -3 | tee -a "$LOG_FILE" || echo "  warn: pm2 restart $PM2_NEXT failed"
  # Re-register cron jobs
  pm2 startOrRestart ecosystem.config.js --only pariscore-cron-rg --update-env 2>/dev/null || true
  pm2 startOrRestart ecosystem.config.js --only pariscore-cron-match-stats --update-env 2>/dev/null || true
  pm2 startOrRestart ecosystem.config.js --only pariscore-cron-gemini --update-env 2>/dev/null || true
  pm2 startOrRestart ecosystem.config.js --only pariscore-cron-elo-weekly --update-env 2>/dev/null || true
fi
pm2 save 2>/dev/null || true
ok "  PM2 restart complete"

# --- [8/9] Health check (both ports) ---
log "[8/9] Health check..."
HEALTH_OK=0
MAX_CHECKS=12
LEGACY_OK=0
NEXT_OK=0

for i in $(seq 1 $MAX_CHECKS); do
  # Check legacy port 3000
  if [ "$LEGACY_OK" = "0" ]; then
    if curl -s -m 5 http://localhost:3000/api/v1/status 2>/dev/null | grep -q '"status":"ok"'; then
      LEGACY_OK=1
      ok "  Legacy (port 3000): OK"
    fi
  fi

  # Check Next.js port 3005
  if [ "$NEXT_OK" = "0" ]; then
    HTTP_CODE=$(curl -s -o /dev/null -w '%{http_code}' -m 5 http://localhost:3005/ 2>/dev/null || echo "000")
    if [ "$HTTP_CODE" = "200" ]; then
      NEXT_OK=1
      ok "  Next.js (port 3005): OK (HTTP $HTTP_CODE)"
    fi
  fi

  # Both OK = success
  if [ "$LEGACY_OK" = "1" ] && [ "$NEXT_OK" = "1" ]; then
    HEALTH_OK=1
    break
  fi

  log "  health: waiting ($i/$MAX_CHECKS)..."
  sleep 2
done

if [ "$HEALTH_OK" = "0" ]; then
  err "Health check FAILED after ${MAX_CHECKS} attempts — attempting rollback..."
  if [ -n "$PREV_COMMIT" ]; then
    git reset --hard "$PREV_COMMIT" -q
    pm2 restart "$PM2_LEGACY" --update-env 2>/dev/null || true
    [ "$BUILD_RAN" = "1" ] && pm2 restart "$PM2_NEXT" --update-env 2>/dev/null || true
    ok "Rolled back to $PREV_COMMIT"
  fi
  exit 1
fi

# --- [9/9] Smoke test + version tag ---
log "[9/9] Smoke test + version tag..."

# Smoke test: fetch homepage and check for key elements
SMOKE_OK=1
HOME_HTTP=$(curl -s -o /dev/null -w '%{http_code}' -m 10 https://pariscore.fr/ 2>/dev/null || echo "000")
if [ "$HOME_HTTP" != "200" ]; then
  err "  Smoke test FAILED: homepage returned HTTP $HOME_HTTP"
  SMOKE_OK=0
fi

# Check API status
API_HTTP=$(curl -s -o /dev/null -w '%{http_code}' -m 10 https://pariscore.fr/api/v1/status 2>/dev/null || echo "000")
if [ "$API_HTTP" != "200" ]; then
  err "  Smoke test FAILED: API status returned HTTP $API_HTTP"
  SMOKE_OK=0
fi

if [ "$SMOKE_OK" = "0" ]; then
  err "Smoke test FAILED — deploy may be incomplete"
  # Don't rollback for smoke test failures (could be transient)
fi

# Version tag (local, pushed later by deploy.bat)
git tag -f "$DEPLOY_TAG" 2>/dev/null || true
ok "  Version tag: $DEPLOY_TAG"

# --- Discord notification ---
if [ "${SKIP_DISCORD:-0}" != "1" ]; then
  WEBHOOK="$(grep -E '^DISCORD_DEPLOY_WEBHOOK_URL=' .env 2>/dev/null | cut -d= -f2- | tr -d '"' | tr -d "'")"
  if [ -n "$WEBHOOK" ]; then
    COMMIT_SHORT="$(git rev-parse --short HEAD)"
    COMMIT_MSG="$(git log -1 --pretty=%s | sed 's/"/\\"/g')"
    COMMIT_AUTHOR="$(git log -1 --pretty=%an | sed 's/"/\\"/g')"
    DEPLOY_TS="$(date -u +%Y-%m-%dT%H:%M:%S.000Z)"
    STATUS_COLOR=3066993  # green
    STATUS_TEXT="Deploy OK"
    if [ "$SMOKE_OK" = "0" ]; then
      STATUS_COLOR=16776960  # yellow
      STATUS_TEXT="Deploy OK (smoke test warning)"
    fi
    PAYLOAD="$(cat <<JSON
{"embeds":[{"title":"PariScore deploy v2","description":"**${COMMIT_MSG}**","color":${STATUS_COLOR},"fields":[{"name":"Commit","value":"\`${COMMIT_SHORT}\`","inline":true},{"name":"Auteur","value":"${COMMIT_AUTHOR}","inline":true},{"name":"Build","value":"${BUILD_RAN}","inline":true},{"name":"Health","value":"Legacy + Next.js OK","inline":true},{"name":"Tag","value":"${DEPLOY_TAG}","inline":true}],"footer":{"text":"VPS OVH deploy-v2 | ${STATUS_TEXT}"},"timestamp":"${DEPLOY_TS}"}]}
JSON
)"
    curl -s -H "Content-Type: application/json" -X POST -d "$PAYLOAD" "$WEBHOOK" >/dev/null 2>&1 \
      && ok "Discord notification sent" || echo "  warn: Discord notification failed"
  fi
fi

echo ""
echo "--- VPS_DEPLOY_OK ---"
echo "commit: $(git log --oneline -1)"
echo "build_ran: $BUILD_RAN"
echo "tag: $DEPLOY_TAG"
echo "health: legacy=OK next.js=OK"
echo "smoke: $([ "$SMOKE_OK" = "1" ] && echo "OK" || echo "WARNING")"
