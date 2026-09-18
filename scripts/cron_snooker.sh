#!/bin/bash
# cron_snooker.sh
#
# Scrape quotidien des matchs snooker (FlashScore + Oddsportal NIO).
# Usage:
#   bash scripts/cron_snooker.sh
#   node scripts/scrape_flashscore_snooker.mjs && node scripts/scrape_oddsportal_nio.mjs
#
# Cron VPS (ajouter à crontab -e):
#   0 8 * * * cd /home/ubuntu/pariscore && bash scripts/cron_snooker.sh >> logs/snooker-cron.log 2>&1
#   (FlashScore refresh toutes les 15 min géré par cron_snooker_refresh.sh)

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

# 3. CueTracker (stats joueurs — 1×/jour suffit)
echo "[$TIMESTAMP] Scraping CueTracker..." | tee -a "$LOG_FILE"
if python3 "$SCRIPT_DIR/scrape_cuetracker.py" >> "$LOG_FILE" 2>&1; then
  echo "[$TIMESTAMP] ✅ CueTracker OK" | tee -a "$LOG_FILE"
  # Copier vers le répertoire DATA_DIR du standalone (process.chdir fix)
  STANDALONE_DATA="/opt/pariscorebis/data"
  if [ -d "$STANDALONE_DATA" ]; then
    cp "$PROJECT_DIR/data/cuetracker_matches.json" "$STANDALONE_DATA/" 2>/dev/null && \
      echo "[$TIMESTAMP] ✅ Copié vers $STANDALONE_DATA" | tee -a "$LOG_FILE"
  fi
else
  echo "[$TIMESTAMP] ⚠️ CueTracker échoué (non bloquant)" | tee -a "$LOG_FILE"
fi

echo "[$TIMESTAMP] === Fin du scraping snooker ===" | tee -a "$LOG_FILE"
