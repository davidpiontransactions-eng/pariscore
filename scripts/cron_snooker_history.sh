#!/bin/bash
# cron_snooker_history.sh
#
# Rafraîchit data/snooker_history.db (l'historique qui alimente le backtest et
# le sous-onglet Résultats) en téléchargeant la nightly upstream SnookerDB.
#
# Pourquoi ce cron existe : le script fetch-snooker-history.mjs n'était planifié
# NULLE PART. La base a été générée une fois à la main et est restée figée au
# 2026-09-29 (constaté le 2026-10-02 : l'onglet Résultats ne montrait que
# 2 jours sur 7, et la backtest s'appuyait sur des données de 3 jours).
#
# Le script est maintenant safe en cas d'échec : il construit un .tmp puis
# rename de façon atomique (voir extract() dans fetch-snooker-history.mjs) —
# un téléchargement raté ou une extraction incomplète laisse l'ancienne base
# intouchée. Ce cron ne peut donc pas casser ce qui marche déjà.
#
# Cron VPS :
#   15 6 * * * cd /home/ubuntu/pariscore && bash scripts/cron_snooker_history.sh >> logs/snooker-history.log 2>&1

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
LOG_DIR="$PROJECT_DIR/logs"
LOG_FILE="$LOG_DIR/snooker-history.log"
DB="$PROJECT_DIR/data/snooker_history.db"

# DATA_DIR du process pm2 — copie obligatoire, sinon l'app lit l'autre
# emplacement et voit une base absente ou périmée.
#
# ⚠️ En dur par défaut, comme cron_snooker.sh / cron_snooker_refresh.sh /
# cron_weekly_player_stats.sh. Lire `$DATA_DIR` ne suffit PAS : cette variable
# n'existe que dans l'environnement du process pm2 (ecosystem.config.js:77),
# pas dans celui d'un job cron — valeur vide → pas de copie → l'app continue
# de lire une base périmée sans que rien ne l'annonce.
PM2_DATA="${DATA_DIR:-/opt/pariscorebis/data}"

mkdir -p "$LOG_DIR"

TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
SIZE_AVANT=0
[ -f "$DB" ] && SIZE_AVANT=$(stat -c %s "$DB" 2>/dev/null || echo 0)

echo "[$TIMESTAMP] === Rafraîchissement snooker_history.db (avant: $SIZE_AVANT o) ===" | tee -a "$LOG_FILE"

# 1. Téléchargement + extraction (safe : rename atomique en fin de course)
if node "$SCRIPT_DIR/fetch-snooker-history.mjs" >> "$LOG_FILE" 2>&1; then
  SIZE_APRES=0
  [ -f "$DB" ] && SIZE_APRES=$(stat -c %s "$DB" 2>/dev/null || echo 0)

  # Garde-fou : une base vide ou disparue, on ne la propage pas (et on ne la
  # remplace surtout pas par un .tmp corrompu).
  if [ "$SIZE_APRES" -gt 1000000 ]; then
    echo "[$TIMESTAMP] ✅ base OK ($SIZE_AVANT → $SIZE_APRES o)" | tee -a "$LOG_FILE"
    if [ -d "$PM2_DATA" ] && [ "$PM2_DATA" != "$PROJECT_DIR/data" ]; then
      cp -f "$DB" "$PM2_DATA/snooker_history.db" && \
        echo "[$TIMESTAMP] ✅ copié vers $PM2_DATA" | tee -a "$LOG_FILE"
    fi
    echo "[$TIMESTAMP] ✅ fait" | tee -a "$LOG_FILE"
  else
    echo "[$TIMESTAMP] ⚠️ base trop petite ($SIZE_APRES o) — copie NON effectuée, l'ancienne est conservée" | tee -a "$LOG_FILE"
    exit 1
  fi
else
  echo "[$TIMESTAMP] ⚠️ échec fetch-snooker-history (l'ancienne base est conservée)" | tee -a "$LOG_FILE"
  exit 1
fi
