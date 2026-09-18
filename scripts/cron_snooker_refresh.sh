#!/bin/bash
# cron_snooker_refresh.sh
#
# Scrape FlashScore toutes les 15 min pour scores live à jour.
# Plus léger que cron_snooker.sh : FlashScore SEUL (pas Oddsportal).
#
# Cron VPS (ajouter à crontab -e):
#   */15 * * * * cd /home/ubuntu/pariscore && bash scripts/cron_snooker_refresh.sh >> logs/snooker-refresh.log 2>&1

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
LOG_DIR="$PROJECT_DIR/logs"

mkdir -p "$LOG_DIR"

TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
LOG_FILE="$LOG_DIR/snooker-refresh.log"

echo "[$TIMESTAMP] FlashScore refresh..." | tee -a "$LOG_FILE"

if node "$SCRIPT_DIR/scrape_flashscore_snooker.mjs" --both >> "$LOG_FILE" 2>&1; then
  # Copier les données vers /opt/pariscorebis (cwd pm2)
  PM2_DATA="/opt/pariscorebis/data"
  if [ -d "$PM2_DATA" ]; then
    cp "$PROJECT_DIR/data/odds_flashscore_snooker.json" "$PM2_DATA/" 2>/dev/null || true
  fi
  # Compter les matchs dans le JSON FlashScore venant d'être scrapé
  # (l'historique snooker_matches.json n'existe plus, repli silencieux en "?")
  MATCHES=$(node -e "const d=require('$PROJECT_DIR/data/odds_flashscore_snooker.json'); console.log(d.matches_count || (d.matches||[]).length || 0)" 2>/dev/null || MATCHES="?")
  echo "[$TIMESTAMP] ✅ OK — $MATCHES matchs" | tee -a "$LOG_FILE"
else
  echo "[$TIMESTAMP] ⚠️ Échec FlashScore" | tee -a "$LOG_FILE"
fi
