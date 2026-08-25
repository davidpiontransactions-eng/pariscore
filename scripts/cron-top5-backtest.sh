#!/bin/bash
# Cron quotidien : settle + snapshot du backtest Top 5 football
# À scheduler : 15 5 * * * (chaque jour 05:15 UTC, après les crons de nuit)
#
# 1. Settle les pendings dont la date est passée (résultats BSD finis).
# 2. Snapshot du top 5 du jour tel que rendu par le moteur prod
#    (enrichissements soccerstats/BetMines inclus) → store JSON.
#
# Store : data/top5-backtest/football.json (lu par GET /api/football/top5/backtest).
# Idempotent : un re-run le même jour ne duplique rien.
set -e

# PM2 lance ce script via un shell non-interactif qui ne source pas .bashrc :
# bun n'est pas dans le PATH par défaut. On l'ajoute explicitement.
export PATH="$HOME/.bun/bin:$PATH"
export BUN_INSTALL="$HOME/.bun"

DEPLOY_DIR="/home/ubuntu/pariscore"
LOG_DIR="$DEPLOY_DIR/logs"
LOG_FILE="$LOG_DIR/cron-top5-backtest.log"
TIMESTAMP="$(date '+%Y-%m-%d %H:%M:%S %Z')"

mkdir -p "$LOG_DIR"

echo "" >> "$LOG_FILE"
echo "============================================" >> "$LOG_FILE"
echo "  [$TIMESTAMP] Début cron top5-backtest" >> "$LOG_FILE"
echo "============================================" >> "$LOG_FILE"

cd "$DEPLOY_DIR"

echo "[$TIMESTAMP] settle pendings + snapshot du jour (football)..." >> "$LOG_FILE"
bun run scripts/backfill-top5-backtest.ts --mode=daily --sport=football 2>&1 | tee -a "$LOG_FILE"
RC=$?
echo "[$TIMESTAMP] Code retour foot: $RC" >> "$LOG_FILE"

echo "[$TIMESTAMP] settle pendings + snapshot du jour (tennis)..." >> "$LOG_FILE"
bun run scripts/backfill-top5-backtest.ts --mode=daily --sport=tennis 2>&1 | tee -a "$LOG_FILE"
RC_T=$?
echo "[$TIMESTAMP] Code retour tennis: $RC_T" >> "$LOG_FILE"

if [ $RC -eq 0 ]; then RC=$RC_T; fi
echo "[$TIMESTAMP] Terminé" >> "$LOG_FILE"
echo "============================================" >> "$LOG_FILE"
exit $RC
