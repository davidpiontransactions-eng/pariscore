#!/bin/bash
# Cron quotidien : scrape TennisAbstract /jsfrags/ → dr-cache.json
# À scheduler : 0 4 * * * (chaque jour 4h)
#
# Le DR (Dominance Ratio) évolue match-par-match, pas minute-par-minute :
# un rafraîchissement quotidien suffit largement et reste poli envers
# TennisAbstract (≤400 req/jour, throttle 1 req/1.5s).
#
# Usage:
#   bash scripts/cron-tennis-dr.sh          # exécution normale (top 200 ATP+WTA)
#   bash scripts/cron-tennis-dr.sh --dry    # dry-run (parse sans écrire)
set -e

DEPLOY_DIR="/home/ubuntu/pariscore"
LOG_DIR="$DEPLOY_DIR/logs"
LOG_FILE="$LOG_DIR/cron-tennis-dr.log"
TIMESTAMP="$(date '+%Y-%m-%d %H:%M:%S %Z')"
DRY="${1:-}"

mkdir -p "$LOG_DIR"

echo "" >> "$LOG_FILE"
echo "============================================" >> "$LOG_FILE"
echo "  [$TIMESTAMP] Début cron tennis-dr" >> "$LOG_FILE"
echo "============================================" >> "$LOG_FILE"

cd "$DEPLOY_DIR"

# Le scraper refuse de s'exécuter sans LEGAL_OVERRIDE_CONFIRMED=1
# (robots.txt de TennisAbstract disallow /jsfrags/). Voir scripts/scrape-tennis-dr.ts.
if [ "$DRY" = "--dry" ]; then
  echo "[$TIMESTAMP] DRY-RUN — parse sans écriture" >> "$LOG_FILE"
  bun run scripts/scrape-tennis-dr.ts --dry-run --top=200 2>&1 | tee -a "$LOG_FILE"
  RC=$?
else
  echo "[$TIMESTAMP] Scraping TennisAbstract /jsfrags/ → dr-cache.json..." >> "$LOG_FILE"
  LEGAL_OVERRIDE_CONFIRMED=1 \
  bun run scripts/scrape-tennis-dr.ts --top=200 2>&1 | tee -a "$LOG_FILE"
  RC=$?
  echo "[$TIMESTAMP] Code retour: $RC" >> "$LOG_FILE"
fi

echo "[$TIMESTAMP] Terminé (code: $RC)" >> "$LOG_FILE"
echo "============================================" >> "$LOG_FILE"
exit $RC
