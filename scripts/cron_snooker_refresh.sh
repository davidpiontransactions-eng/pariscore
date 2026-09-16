#!/bin/bash
# cron_snooker_refresh.sh
#
# Scrape FlashScore toutes les 20 min pour scores live à jour.
# Plus léger que cron_snooker.sh : FlashScore SEUL (pas Oddsportal).
#
# Cron VPS (ajouter à crontab -e):
#   */20 * * * * cd /home/ubuntu/pariscore && bash scripts/cron_snooker_refresh.sh >> logs/snooker-refresh.log 2>&1

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
LOG_DIR="$PROJECT_DIR/logs"

mkdir -p "$LOG_DIR"

TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
LOG_FILE="$LOG_DIR/snooker-refresh.log"

echo "[$TIMESTAMP] FlashScore refresh..." | tee -a "$LOG_FILE"

if node "$SCRIPT_DIR/scrape_flashscore_snooker.mjs" >> "$LOG_FILE" 2>&1; then
  MATCHES=$(node -e "const d=require('$PROJECT_DIR/data/snooker_matches.json'); console.log(d.length || 0)")
  echo "[$TIMESTAMP] ✅ OK — $MATCHES matchs" | tee -a "$LOG_FILE"
else
  echo "[$TIMESTAMP] ⚠️ Échec FlashScore" | tee -a "$LOG_FILE"
fi
