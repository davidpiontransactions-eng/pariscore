#!/bin/bash
# Cron hebdomadaire : Elo surface TennisAbstract → snapshots DB + matchs L10
# À scheduler : lundi 14h heure de Paris (PM2 cron 0 12,13 * * 1 + garde
# d'heure locale ci-dessous pour couvrir l'été (12:00 UTC) ET l'hiver
# (13:00 UTC = 14:00 CET). Le process ne fait rien si on n'est pas lundi 14h.
#
# Écrit :
#   1. TennisEloSnapshot (table SQLite via Prisma) — Elo global + h/c/g par
#      semaine ISO (clé playerKey normalisé, ex: aryna_sabalenka).
#   2. TennisPlayerMatch (table SQLite) — jusqu'à ~30 matchs récents par
#      joueur (adversaire, surface, résultat, score, semaine ISO).
#   3. src/lib/tennis-elo/abstract-cache.json (cache legacy lu par lookup.ts)
#      + copie vers .next/standalone/ (runtime Next.js).
#
# Throttle 1 req/1.5s (top 300 ATP + 300 WTA ≈ 15 min) — poli envers
# TennisAbstract. Requiert LEGAL_OVERRIDE_CONFIRMED=1 (robots.txt interdit
# /jsfrags/ — assumé par l'opérateur, comme pour scrape-tennis-dr.ts).
#
# Usage:
#   bash scripts/cron-tennis-elo-weekly.sh           # exécution normale
#   bash scripts/cron-tennis-elo-weekly.sh --dry     # parse sans écrire
set -e

export PATH="$HOME/.bun/bin:$PATH"
export BUN_INSTALL="$HOME/.bun"

DEPLOY_DIR="/home/ubuntu/pariscore"
LOG_DIR="$DEPLOY_DIR/logs"
LOG_FILE="$LOG_DIR/cron-tennis-elo-weekly.log"
TIMESTAMP="$(date '+%Y-%m-%d %H:%M:%S %Z')"
DRY="${1:-}"

mkdir -p "$LOG_DIR"

echo "" >> "$LOG_FILE"
echo "============================================" >> "$LOG_FILE"
echo "  [$TIMESTAMP] Début cron tennis-elo-weekly" >> "$LOG_FILE"
echo "============================================" >> "$LOG_FILE"

# Garde d'heure locale : le cron PM2 tourne à 12:00 ET 13:00 UTC le lundi ;
# on n'exécute le scrape que si l'heure de Paris est 14h (été: 12 UTC,
# hiver: 13 UTC). Évite un double scrape et une exécution à la mauvaise heure.
PARIS_HOUR="$(TZ=Europe/Paris date +%H)"
PARIS_DOW="$(TZ=Europe/Paris date +%u)"
if [ "$PARIS_DOW" != "1" ] || [ "$PARIS_HOUR" != "14" ]; then
  echo "[$TIMESTAMP] Hors créneau (lundi 14h Paris) — dow=$PARIS_DOW h=$PARIS_HOUR, skip" >> "$LOG_FILE"
  exit 0
fi

cd "$DEPLOY_DIR"

if [ "$DRY" = "--dry" ]; then
  echo "[$TIMESTAMP] DRY-RUN — parse sans écriture" >> "$LOG_FILE"
  LEGAL_OVERRIDE_CONFIRMED=1 \
  bun run scripts/scrape-tennis-elo-weekly.ts --dry-run --top=300 2>&1 | tee -a "$LOG_FILE"
  RC=$?
else
  echo "[$TIMESTAMP] Scraping Elo + jsfrags → snapshots/matchs DB..." >> "$LOG_FILE"
  LEGAL_OVERRIDE_CONFIRMED=1 \
  bun run scripts/scrape-tennis-elo-weekly.ts --top=300 2>&1 | tee -a "$LOG_FILE"
  RC=$?
  echo "[$TIMESTAMP] Code retour scraper: $RC" >> "$LOG_FILE"

  # Le runtime Next.js standalone lit le cache depuis .next/standalone/,
  # pas depuis src/ — sync après chaque scrape réussi.
  if [ $RC -eq 0 ]; then
    echo "[$TIMESTAMP] Sync cache vers .next/standalone/..." >> "$LOG_FILE"
    mkdir -p "$DEPLOY_DIR/.next/standalone/src/lib/tennis-elo/"
    cp -f "$DEPLOY_DIR/src/lib/tennis-elo/abstract-cache.json" \
          "$DEPLOY_DIR/.next/standalone/src/lib/tennis-elo/abstract-cache.json" 2>&1 | tee -a "$LOG_FILE"
    echo "[$TIMESTAMP] Cache sync OK" >> "$LOG_FILE"
  else
    echo "[$TIMESTAMP] Scraper en échec ($RC) — sync standalone SKIPPÉ" >> "$LOG_FILE"
  fi
fi

echo "[$TIMESTAMP] Terminé (code: $RC)" >> "$LOG_FILE"
echo "============================================" >> "$LOG_FILE"
exit $RC