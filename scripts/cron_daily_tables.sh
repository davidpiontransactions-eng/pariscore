#!/bin/bash
# cron_daily_tables.sh
#
# Refresh quotidien 01:00 UTC des TABLES & CALENDRIERS snooker + hockey :
#   Snooker : calendrier FlashScore (--both J/J+1), cotes Oddsportal NIO,
#             stats CueTracker (top10/predictions strengthElo)
#   Hockey  : prematch calendrier/stratégies (BetExplorer + Annabet + Oddspedia),
#             standings tables KHL/Magnus (EliteProspects), top10 joueurs
#             (EliteProspects player-stats : KHL/NHL/Ligue Magnus)
#
# Cron VPS (installé par scripts/update_vps.sh) :
#   0 1 * * * cd /opt/pariscorebis && bash scripts/cron_daily_tables.sh >> logs/daily-tables.log 2>&1
#
# Chaque étape est isolée (échec non bloquant) + bornée par timeout (anti-hang
# playwright/WAF) — un scraper en erreur ne empêche pas les autres tables.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
LOG_DIR="$PROJECT_DIR/logs"
STANDALONE_DATA="/opt/pariscorebis/data"

mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/daily-tables.log"
TS() { date -u +"%Y-%m-%dT%H:%M:%SZ"; }

# step <label> <timeout_s> <cmd...>
step() {
  local label="$1" tmo="$2"
  shift 2
  echo "[$(TS)] ▶ $label" | tee -a "$LOG_FILE"
  if timeout "$tmo" "$@" >> "$LOG_FILE" 2>&1; then
    echo "[$(TS)] ✅ $label OK" | tee -a "$LOG_FILE"
  else
    local rc=$?
    echo "[$(TS)] ⚠️ $label échoué/timeout (rc=$rc) — non bloquant" | tee -a "$LOG_FILE"
  fi
}

echo "[$(TS)] === Début daily tables (snooker + hockey) ===" | tee -a "$LOG_FILE"

# ── SNOOKER : calendrier + cotes + stats top10 ──────────────────────────────
step "snooker flashscore (calendrier J+J+1)" 360 \
  node "$SCRIPT_DIR/scrape_flashscore_snooker.mjs" --both
step "snooker oddsportal NIO (cotes)" 300 \
  node "$SCRIPT_DIR/scrape_oddsportal_nio.mjs"
step "snooker cuetracker (stats joueurs)" 900 \
  python3 "$SCRIPT_DIR/scrape_cuetracker.py"

# ── HOCKEY : calendrier prematch (3 sources) + tables + top10 ───────────────
step "hockey betexplorer prematch (calendrier)" 300 \
  node "$SCRIPT_DIR/scrape-betexplorer-hockey.mjs"
step "hockey annabet prematch (calendrier)" 300 \
  node "$SCRIPT_DIR/scrape-annabet-hockey-prematch.mjs"
step "hockey oddspedia prematch (calendrier)" 180 \
  node "$SCRIPT_DIR/scrape-oddspedia-hockey.mjs"
step "hockey eliteprospects standings (tables KHL/Magnus)" 420 \
  node "$SCRIPT_DIR/scrape-eliteprospects-hockey.mjs"
step "hockey eliteprospects player-stats (top10)" 420 \
  node "$SCRIPT_DIR/scrape-eliteprospects-player-stats.mjs"

# ── Copie vers le DATA_DIR du standalone (si PROJECT_DIR ≠ /opt : no-op safe) ─
if [ -d "$STANDALONE_DATA" ]; then
  for f in odds_flashscore_snooker.json oddsportal_nio.json cuetracker_matches.json \
           hockey_prematch_betexplorer.json hockey_prematch_annabet.json \
           hockey_prematch_oddspedia.json eliteprospects_hockey_standings.json \
           eliteprospects_player_stats.json; do
    [ -f "$PROJECT_DIR/data/$f" ] && cp -f "$PROJECT_DIR/data/$f" "$STANDALONE_DATA/" 2>/dev/null
  done
  echo "[$(TS)] ✅ JSON copiés vers $STANDALONE_DATA" | tee -a "$LOG_FILE"
fi

echo "[$(TS)] === Fin daily tables ===" | tee -a "$LOG_FILE"
