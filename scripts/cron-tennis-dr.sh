#!/bin/bash
# Cron quotidien : scrape TennisAbstract /jsfrags/ → dr-cache.json
# À scheduler : 0 4 * * * (chaque jour 4h)
#
# Le DR (Dominance Ratio) évolue match-par-match, pas minute-par-minute :
# un rafraîchissement quotidien suffit largement et reste poli envers
# TennisAbstract (≤600 req/jour, throttle 1 req/1.5s ≈ 15 min).
#
# top=300 (depuis 2026-07-27) : le cache top-100→200 laissait tomber en fallback
# symétrique Most Aces (bug 43/43) tout match impliquant un joueur hors top.
# 544 ATP + 543 WTA disponibles dans abstract-cache.json → top=300 couvre largement
# les tableaux principaux ATP/WTA + qualifs majeures.
#
# Usage:
#   bash scripts/cron-tennis-dr.sh          # exécution normale (top 300 ATP+WTA)
#   bash scripts/cron-tennis-dr.sh --dry    # dry-run (parse sans écrire)
set -e

# PM2 lance ce script via un shell non-interactif qui ne source pas .bashrc :
# bun n'est pas dans le PATH par défaut. On l'ajoute explicitement.
export PATH="$HOME/.bun/bin:$PATH"
export BUN_INSTALL="$HOME/.bun"

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
  bun run scripts/scrape-tennis-dr.ts --dry-run --top=300 2>&1 | tee -a "$LOG_FILE"
  RC=$?
else
  echo "[$TIMESTAMP] Scraping TennisAbstract /jsfrags/ → dr-cache.json..." >> "$LOG_FILE"
  LEGAL_OVERRIDE_CONFIRMED=1 \
  bun run scripts/scrape-tennis-dr.ts --top=300 2>&1 | tee -a "$LOG_FILE"
  RC=$?
  echo "[$TIMESTAMP] Code retour scraper: $RC" >> "$LOG_FILE"

  # ⚠️ Le runtime Next.js standalone lit le cache depuis .next/standalone/,
  # PAS depuis src/. Sans cette copie, le cache source serait mis à jour
  # chaque nuit mais l'app en prod lirait toujours la version figée au build.
  # On sync donc les deux emplacements après chaque scrape réussi.
  if [ $RC -eq 0 ]; then
    echo "[$TIMESTAMP] Sync cache vers .next/standalone/..." >> "$LOG_FILE"
    mkdir -p "$DEPLOY_DIR/.next/standalone/src/lib/tennis-dr/"
    cp -f "$DEPLOY_DIR/src/lib/tennis-dr/dr-cache.json" \
          "$DEPLOY_DIR/.next/standalone/src/lib/tennis-dr/dr-cache.json" 2>&1 | tee -a "$LOG_FILE"
    echo "[$TIMESTAMP] Cache sync OK" >> "$LOG_FILE"
  else
    echo "[$TIMESTAMP] Scraper en échec ($RC) — sync standalone SKIPPÉ" >> "$LOG_FILE"
  fi
fi

echo "[$TIMESTAMP] Terminé (code: $RC)" >> "$LOG_FILE"
echo "============================================" >> "$LOG_FILE"
exit $RC
