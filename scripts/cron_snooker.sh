#!/bin/bash
# cron_snooker.sh
#
# Scrape quotidien des matchs snooker (FlashScore + Oddsportal NIO).
# Usage:
#   bash scripts/cron_snooker.sh
#   node scripts/scrape_flashscore_snooker.mjs && node scripts/scrape_oddsportal_nio.mjs
#
# Cron VPS (ajouter à crontab -e):
#   0 6 * * * cd /home/ubuntu/pariscore && bash scripts/cron_snooker.sh >> logs/snooker-cron.log 2>&1

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
LOG_DIR="$PROJECT_DIR/logs"

mkdir -p "$LOG_DIR"

TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
LOG_FILE="$LOG_DIR/snooker-cron.log"

echo "[$TIMESTAMP] === Début du scraping snooker ===" | tee -a "$LOG_FILE"

# 1. FlashScore (matchs du jour)
echo "[$TIMESTAMP] Scraping FlashScore..." | tee -a "$LOG_FILE"
if node "$SCRIPT_DIR/scrape_flashscore_snooker.mjs" >> "$LOG_FILE" 2>&1; then
  echo "[$TIMESTAMP] ✅ FlashScore OK" | tee -a "$LOG_FILE"
else
  echo "[$TIMESTAMP] ⚠️ FlashScore échoué (non bloquant)" | tee -a "$LOG_FILE"
fi

# 2. Oddsportal Northern Ireland Open (matchs + cotes)
echo "[$TIMESTAMP] Scraping Oddsportal NIO..." | tee -a "$LOG_FILE"
if node "$SCRIPT_DIR/scrape_oddsportal_nio.mjs" >> "$LOG_FILE" 2>&1; then
  echo "[$TIMESTAMP] ✅ Oddsportal NIO OK" | tee -a "$LOG_FILE"
else
  echo "[$TIMESTAMP] ⚠️ Oddsportal NIO échoué (non bloquant)" | tee -a "$LOG_FILE"
fi

echo "[$TIMESTAMP] === Fin du scraping snooker ===" | tee -a "$LOG_FILE"
