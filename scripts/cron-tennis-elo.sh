#!/bin/bash
# Cron hebdo : scrape Tennis Abstract + recompute Elo local
# À scheduler : 0 6 * * 1 (chaque lundi 6h)
#
# Usage:
#   bash scripts/cron-tennis-elo.sh          # exécution normale
#   bash scripts/cron-tennis-elo.sh --dry    # dry-run (skip scrap, recompute avec --dry-run)
set -e

DEPLOY_DIR="/home/ubuntu/pariscore"
LOG_DIR="$DEPLOY_DIR/logs"
LOG_FILE="$LOG_DIR/cron-tennis-elo.log"
TIMESTAMP="$(date '+%Y-%m-%d %H:%M:%S %Z')"
DRY="${1:-}"

mkdir -p "$LOG_DIR"

echo "" >> "$LOG_FILE"
echo "============================================" >> "$LOG_FILE"
echo "  [$TIMESTAMP] Début cron tennis-elo" >> "$LOG_FILE"
echo "============================================" >> "$LOG_FILE"

cd "$DEPLOY_DIR"

if [ "$DRY" = "--dry" ]; then
  echo "[$TIMESTAMP] DRY-RUN — Phase 1 (scrape) skip, Phase 2 (recompute) avec --dry-run" >> "$LOG_FILE"
  node tools/recompute-tennis-elo.js --dry-run 2>&1 | tee -a "$LOG_FILE"
  RC=$?
else
  # Phase 1 — Scraper Tennis Abstract (interne, dérive)
  echo "[$TIMESTAMP] Phase 1 — Scraper Tennis Abstract..." >> "$LOG_FILE"
  TENNIS_ABSTRACT_ELO_SCRAPER=1 LEGAL_OVERRIDE_CONFIRMED=1 \
  node tools/scrape-tennis-abstract-elo.js --enable-legal-bypass-confirmed 2>&1 | tee -a "$LOG_FILE"
  RC1=$?
  echo "[$TIMESTAMP] Phase 1 — code retour: $RC1" >> "$LOG_FILE"

  # Phase 2 — Recompute Elo local
  echo "[$TIMESTAMP] Phase 2 — Recompute Elo..." >> "$LOG_FILE"
  node tools/recompute-tennis-elo.js 2>&1 | tee -a "$LOG_FILE"
  RC2=$?
  echo "[$TIMESTAMP] Phase 2 — code retour: $RC2" >> "$LOG_FILE"

  RC=$((RC1 + RC2))
fi

echo "[$TIMESTAMP] Terminé (code: $RC)" >> "$LOG_FILE"
echo "============================================" >> "$LOG_FILE"
exit $RC
