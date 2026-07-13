#!/bin/bash
# PariScore VPS deploy — safe pull + purge cache + restart + health check
# Usage: bash deploy.sh
#
# Durci (2026-07-13): échec explicite sur erreur (set -euo pipefail),
# cd vers la racine du projet, vérif post-reset HEAD=origin/main, purge
# du cache tennis stale (matchs fantômes), restart des 2 process PM2,
# health check final.
set -euo pipefail

DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DEPLOY_DIR"

echo "[deploy] (1/6) Fetching origin..."
git fetch origin

echo "[deploy] (2/6) Checkout main + hard reset to origin/main..."
# S'assurer d'être sur main (branche locale existante), puis reset propre.
# Le runtime écrit dans des fichiers trackés (data/cycling/*.json, cache/*) :
# --hard les réinitialise, ce qui est voulu (on veut l'état du repo).
git checkout main
git reset --hard origin/main

# Vérification: HEAD doit pointer sur origin/main après le reset.
HEAD_SHA="$(git rev-parse HEAD)"
ORIGIN_SHA="$(git rev-parse origin/main)"
if [ "$HEAD_SHA" != "$ORIGIN_SHA" ]; then
  echo "[deploy] FAIL: HEAD ($HEAD_SHA) != origin/main ($ORIGIN_SHA) après reset — abort"
  exit 1
fi
git config pull.rebase false

echo "[deploy] (3/6) Purge cache tennis stale (matchs fantômes)..."
# Idempotent: DELETE sur clés absentes ne fait rien. Le garde-fou temporel
# dans server.js exclut désormais les matchs passés, mais le cache SQLite
# (TTL 4h) pouvait encore servir des entrées stale jusqu'à expiration.
if [ -f scripts/purge_tennis_vb_cache.sql ] && command -v sqlite3 >/dev/null 2>&1; then
  sqlite3 pariscore.db < scripts/purge_tennis_vb_cache.sql | sed 's/^/  purge: /'
else
  echo "  (skip: script SQL ou sqlite3 absent)"
fi

echo "[deploy] (4/6) Restarting PM2 (pariscore + pariscore-next)..."
# --update-env recharge le .env (variables API, clés) au redémarrage.
pm2 restart pariscore --update-env
pm2 restart pariscore-next --update-env

echo "[deploy] (5/6) Health check (attente démarrage + /api/v1/status)..."
sleep 6
for i in 1 2 3 4 5; do
  CODE="$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/api/v1/status || echo 000)"
  if [ "$CODE" = "200" ]; then
    echo "  /api/v1/status → HTTP 200 ✓"
    break
  fi
  echo "  tentative $i: HTTP $CODE, retry dans 4s..."
  sleep 4
done

echo "[deploy] (6/6) Done. Current commit:"
git log --oneline -1
echo "[deploy] PM2 status:"
pm2 list 2>/dev/null | grep -E "pariscore|tennis-live|status" | head -8 || true
