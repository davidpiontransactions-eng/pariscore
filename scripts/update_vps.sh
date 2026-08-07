#!/bin/bash
set -e

# Usage: ./scripts/update_vps.sh [--tennis-elo]
#   --tennis-elo   Après restart pm2, exécute le recompute tennis Elo

DEPLOY_DIR="/home/ubuntu/pariscore"
PM2_NAME="pariscore"

echo "--- Début de la mise à jour PariScore ---"
cd "$DEPLOY_DIR"

echo "[0/7] Validation syntaxique pariscore.js..."
node --check pariscore.js || { echo "❌ ERREUR DE SYNTAXE dans pariscore.js — déploiement annulé"; exit 1; }
echo "✅ pariscore.js syntaxe valide"

echo "[1/7] Fetch remote..."
git fetch --all

echo "[2/7] Reset hard sur origin/main..."
git reset --hard origin/main

echo "[3/7] Pull..."
git pull --rebase origin main

echo "[4/7] npm rebuild native modules (node version guard)..."
# ⚠️ NON BLOQUANT : le rebuild better-sqlite3 peut échouer via node-gyp sur certains
#    environnements (problème pré-existant sur le VPS, indépendant du deploy). Sous
#    `set -e`, un échec ici abandonnait le script entier et forçait un contournement
#    SSH manuel. On tente quand même le rebuild (utile si la version native diffère),
#    mais on logge l'échec au lieu d'abandonner — l'étape [5/7] `npm install`
#    déclenchera de toute façon le rebuild natif si nécessaire.
if npm rebuild better-sqlite3 2>&1; then
  echo "✅ npm rebuild better-sqlite3 OK"
else
  echo "⚠️ npm rebuild better-sqlite3 a échoué (non bloquant) — étape [5/7] npm install prendra le relais"
fi

echo "[5/7] npm install (with dev for Next.js build)..."
npm install --legacy-peer-deps --silent

echo "[6/7] Next.js build..."
npm run build 2>&1 || { echo "❌ Next.js build failed — deploy aborted"; exit 1; }

echo "[7/7] PM2 restart..."
pm2 restart "$PM2_NAME" --update-env

echo "[7b] PM2 restart Next.js..."
pm2 restart pariscore-next --update-env

# [7c] Cron RG découplé — garantir l'enregistrement (cron_restart '0 */2') après
#      chaque deploy + reboot. startOrRestart = start si absent, restart si présent.
#      autorestart:false (ecosystem) → "stopped" entre les ticks 2h = normal, pas une panne.
echo "[7c] Cron RG (pariscore-cron-rg) — réenregistrement + persist..."
pm2 startOrRestart ecosystem.config.js --only pariscore-cron-rg --update-env || echo "[7c] startOrRestart cron-rg échec (non bloquant)"

echo "[7d] Cron match-stats (pariscore-cron-match-stats) — réenregistrement + persist..."
pm2 startOrRestart ecosystem.config.js --only pariscore-cron-match-stats --update-env || echo "[7d] startOrRestart cron-match-stats échec (non bloquant)"

# [7e] Cron Gemini pré-calcul — garantir l'enregistrement (cron_restart
#      '0 6,8,10,12,14,16,18') après chaque deploy + reboot. Autoréstart:false
#      (ecosystem) → "stopped" entre les ticks 2h = normal, pas une panne.
echo "[7e] Cron Gemini (pariscore-cron-gemini) — réenregistrement + persist..."
pm2 startOrRestart ecosystem.config.js --only pariscore-cron-gemini --update-env || echo "[7e] startOrRestart cron-gemini échec (non bloquant)"

pm2 save || echo "[7f] pm2 save échec (non bloquant)"

echo ""
echo "--- VPS mis à jour avec succès ! ---"
echo "Commit actif : $(git log --oneline -1)"
pm2 list

# [8] Notification Discord — évolution du site (webhook depuis .env, jamais hardcodé)
WEBHOOK="$(grep -E '^DISCORD_DEPLOY_WEBHOOK_URL=' .env 2>/dev/null | cut -d= -f2- | tr -d '"' | tr -d "'")"
if [ -n "$WEBHOOK" ]; then
  COMMIT_HASH="$(git rev-parse --short HEAD)"
  COMMIT_MSG="$(git log -1 --pretty=%s | sed 's/"/\\"/g')"
  COMMIT_AUTHOR="$(git log -1 --pretty=%an | sed 's/"/\\"/g')"
  DEPLOY_TS="$(date -u +%Y-%m-%dT%H:%M:%S.000Z)"
  PAYLOAD="$(cat <<JSON
{
  "embeds": [{
    "title": "🚀 PariScore déployé en production",
    "description": "**${COMMIT_MSG}**",
    "color": 3066993,
    "fields": [
      { "name": "Commit", "value": "\`${COMMIT_HASH}\`", "inline": true },
      { "name": "Auteur", "value": "${COMMIT_AUTHOR}", "inline": true }
    ],
    "footer": { "text": "VPS OVH · pm2 ${PM2_NAME}" },
    "timestamp": "${DEPLOY_TS}"
  }]
}
JSON
)"
  curl -s -H "Content-Type: application/json" -X POST -d "$PAYLOAD" "$WEBHOOK" > /dev/null \
    && echo "[8/8] Discord notifié ✓" \
    || echo "[8/8] Discord échec (non bloquant)"
else
  echo "[8/8] DISCORD_DEPLOY_WEBHOOK_URL absent du .env — notif Discord skip"
fi

# [9] Tennis Elo recompute (optionnel)
if [ "$1" = "--tennis-elo" ] || [ "${TENNIS_ELO:-0}" = "1" ]; then
  echo "[9/9] Tennis Elo recompute..."
  node tools/recompute-tennis-elo.js 2>&1 || echo "[9/9] Tennis Elo échec (non bloquant)"
fi
