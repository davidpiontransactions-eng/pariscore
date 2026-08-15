#!/bin/bash
# scripts/update_vps.sh — VPS deploy runner (streamed to VPS by scripts/deploy.bat)
#
# Smart deploy: skips `npm install` + `next build` when only LEGACY files changed
# (pariscore.{html,app.js,js}, services/*.js, data/*.json, public/**).
# Legacy-only deploy ~15-30s vs ~3min full build. Build runs iff src/app/next.config/
# package.json/tsconfig changed. Safe default = full build (first run / unknown diff).
#
# Env overrides: DEPLOY_DIR, PM2_LEGACY, PM2_NEXT, SKIP_DISCORD=1
set -uo pipefail

DEPLOY_DIR="${DEPLOY_DIR:-/home/ubuntu/pariscore}"
PM2_LEGACY="${PM2_LEGACY:-pariscore}"        # legacy server.js — serves pariscore.html + /api/v1/cs2/*
PM2_NEXT="${PM2_NEXT:-pariscore-next}"        # Next.js standalone

cd "$DEPLOY_DIR" || { echo "ERR: deploy dir $DEPLOY_DIR introuvable"; exit 1; }

PREV="$(git rev-parse HEAD 2>/dev/null || echo '')"

echo "[1/6] git fetch + reset --hard origin/main..."
git fetch --all -q || { echo "ERR: git fetch"; exit 1; }
git reset --hard origin/main -q || { echo "ERR: git reset"; exit 1; }
CURR="$(git rev-parse HEAD)"

# Nothing to deploy? Exit fast (idempotent re-run).
if [ -n "$PREV" ] && [ "$PREV" = "$CURR" ]; then
  echo "Already up to date ($CURR). Nothing to deploy."
  echo "--- VPS_DEPLOY_OK ---"
  echo "build_ran: 0"
  pm2 jlist 2>/dev/null >/dev/null && echo "pm2: unchanged" || true
  exit 0
fi

# Diff changed files between previous and current deployed commit.
if [ -n "$PREV" ]; then
  CHANGED="$(git diff --name-only "$PREV" "$CURR" 2>/dev/null || echo '')"
else
  CHANGED=""  # first deploy → safe default (full build)
fi

# Decide what's required.
NEED_INSTALL=0   # npm install
NEED_BUILD=0     # next build
if [ -z "$CHANGED" ]; then
  NEED_INSTALL=1; NEED_BUILD=1   # safe default
else
  if printf '%s\n' "$CHANGED" | grep -qE '^(src/|app/|next\.config|tsconfig|postcss|tailwind|components\.json)'; then
    NEED_BUILD=1
  fi
  if printf '%s\n' "$CHANGED" | grep -qE '^(package\.json|bun\.lock|package-lock\.json)'; then
    NEED_INSTALL=1
  fi
fi

echo "  prev=${PREV:-<none>} curr=$CURR"
if [ -n "$CHANGED" ]; then printf '    %s\n' $CHANGED; else echo "    (no diff / first run)"; fi
echo "  decision: install=$NEED_INSTALL build=$NEED_BUILD"

echo "[2/6] Syntax check (changed legacy JS)..."
SYNTAX_FAIL=0
node --check pariscore.js 2>/dev/null || { echo "ERR: pariscore.js syntaxe"; SYNTAX_FAIL=1; }
node --check pariscore.app.js 2>/dev/null || { echo "ERR: pariscore.app.js syntaxe"; SYNTAX_FAIL=1; }
[ "$SYNTAX_FAIL" = "1" ] && exit 1
if [ -n "$CHANGED" ]; then
  for f in $(printf '%s\n' "$CHANGED" | grep -E '^services/.*\.js$' || true); do
    [ -f "$f" ] && { node --check "$f" 2>/dev/null || { echo "ERR: $f syntaxe"; exit 1; }; }
  done
fi

if [ "$NEED_INSTALL" = "1" ]; then
  echo "[3/6] npm install (deps changed)..."
  npm install --legacy-peer-deps --silent || { echo "ERR: npm install"; exit 1; }
  npm rebuild better-sqlite3 2>&1 || echo "  warn: better-sqlite3 rebuild échec (non bloquant)"
else
  echo "[3/6] npm install SKIPPED (no deps changed)"
fi

BUILD_RAN=0
if [ "$NEED_BUILD" = "1" ]; then
  echo "[4/6] Next.js build..."
  npm run build 2>&1 || { echo "ERR: Next.js build failed — deploy aborted"; exit 1; }
  # Garde-fou (BUG-1) : un build Next ok ne garantit pas l'export standalone.
  # Si server.js est absent, pm2 crash en boucle (502) ; on STOPE le deploy
  # plutot que de conclure VPS_DEPLOY_OK / health OK en trompe-l'oeil.
  if [ ! -f .next/standalone/server.js ]; then
    echo "ERR: .next/standalone/server.js absent apres next build - deploy aborted"
    exit 1
  fi
  BUILD_RAN=1
else
  echo "[4/6] Next.js build SKIPPED (legacy-only deploy — no src/app/next.config change)"
fi

echo "[5/6] PM2 restart..."
# Legacy always: it serves the legacy files we just pulled.
pm2 restart "$PM2_LEGACY" --update-env 2>&1 || echo "  warn: pm2 restart $PM2_LEGACY échec"
# Next.js only if a build ran.
if [ "$BUILD_RAN" = "1" ]; then
  pm2 restart "$PM2_NEXT" --update-env 2>&1 || echo "  warn: pm2 restart $PM2_NEXT échec"
  # Cron re-registration (only after full build — crons depend on Next.js code).
  pm2 startOrRestart ecosystem.config.js --only pariscore-cron-rg --update-env 2>/dev/null || true
  pm2 startOrRestart ecosystem.config.js --only pariscore-cron-match-stats --update-env 2>/dev/null || true
  pm2 startOrRestart ecosystem.config.js --only pariscore-cron-gemini --update-env 2>/dev/null || true
else
  echo "  $PM2_NEXT NOT restarted (no build)"
  echo "  cron jobs NOT restarted (legacy-only deploy)"
fi
pm2 save 2>/dev/null || true

echo "[6/6] Health check..."
HEALTH_OK=0
# Legacy-only = 4 checks (fast restart), Full build = 8 checks (slower boot)
MAX_CHECKS=8
[ "$BUILD_RAN" = "0" ] && MAX_CHECKS=4
for i in $(seq 1 $MAX_CHECKS); do
  if curl -s -m 5 http://localhost:3000/api/v1/status 2>/dev/null | grep -q '"status":"ok"'; then
    echo "  health: OK"; HEALTH_OK=1; break
  fi
  echo "  health: waiting ($i/$MAX_CHECKS)..."; sleep 2
done
[ "$HEALTH_OK" = "1" ] || echo "  warn: health check échec — vérifier pm2 logs"

echo ""
echo "--- VPS_DEPLOY_OK ---"
echo "commit: $(git log --oneline -1)"
echo "build_ran: $BUILD_RAN"

# [7] Discord notification (webhook from .env, never hardcoded).
if [ "${SKIP_DISCORD:-0}" != "1" ]; then
  WEBHOOK="$(grep -E '^DISCORD_DEPLOY_WEBHOOK_URL=' .env 2>/dev/null | cut -d= -f2- | tr -d '"' | tr -d "'")"
  if [ -n "$WEBHOOK" ]; then
    COMMIT_HASH="$(git rev-parse --short HEAD)"
    COMMIT_MSG="$(git log -1 --pretty=%s | sed 's/"/\\"/g')"
    COMMIT_AUTHOR="$(git log -1 --pretty=%an | sed 's/"/\\"/g')"
    DEPLOY_TS="$(date -u +%Y-%m-%dT%H:%M:%S.000Z)"
    PAYLOAD="$(cat <<JSON
{"embeds":[{"title":"PariScore deploy","description":"**${COMMIT_MSG}**","color":3066993,"fields":[{"name":"Commit","value":"\`${COMMIT_HASH}\`","inline":true},{"name":"Auteur","value":"${COMMIT_AUTHOR}","inline":true},{"name":"Build","value":"${BUILD_RAN}","inline":true}],"footer":{"text":"VPS OVH pm2 ${PM2_LEGACY}"},"timestamp":"${DEPLOY_TS}"}]}
JSON
)"
    curl -s -H "Content-Type: application/json" -X POST -d "$PAYLOAD" "$WEBHOOK" >/dev/null 2>&1 \
      && echo "discord: OK" || echo "discord: échec (non bloquant)"
  else
    echo "discord: webhook absent — skip"
  fi
fi
