#!/bin/bash
# ════════════════════════════════════════════════════════════════════
# ETL ONE-SHOT — Historique Foot + Tennis 2024/2025/2026
# Bd: ParisScorebis-9je (foot) + ParisScorebis-rxh (tennis)
# ════════════════════════════════════════════════════════════════════
# Usage: bash .context/run_etl_2024_2026.sh [--with-stats] [--lite]
#
# OPTIONS:
#   --with-stats        Inclut stats avancées foot (heavy quota +380 req/league)
#   --lite              Mode rapide: PL only foot + Grand Slams only tennis
#   (sans flag = full ingestion 9 leagues foot × 3 saisons + tennis 3 saisons full)
#
# QUOTA ESTIMATION:
#   Foot lite (--sample-pl × 3 saisons):
#     Sans stats: 3 req
#     Avec stats: 3 + ~1140 req
#   Foot full (9 leagues × 3 saisons):
#     Sans stats: 27 req
#     Avec stats: 27 + ~10260 req (≈2 jours API-Football Pro 7500/j)
#   Tennis full (3 saisons × 2 tours × ~365 jours):
#     ESPN public: ~2190 req (~7 min @200ms throttle)
#   Tennis lite (--grand-slams-only):
#     ESPN public: ~340 req (~1 min)
# ════════════════════════════════════════════════════════════════════

set -e
cd "$(dirname "$0")/.."

WITH_STATS=""
LITE=""
for arg in "$@"; do
  case $arg in
    --with-stats) WITH_STATS="--with-stats" ;;
    --lite) LITE="1" ;;
  esac
done

START_TS=$(date +%s)
LOG_FILE="/tmp/etl_run_$(date +%Y%m%d_%H%M%S).log"

echo "════════ ETL Historique 2024/2025/2026 ════════" | tee "$LOG_FILE"
echo "Mode: ${LITE:+LITE} ${WITH_STATS:++stats avancees}${LITE:-FULL}" | tee -a "$LOG_FILE"
echo "Log: $LOG_FILE" | tee -a "$LOG_FILE"
echo "Demarre: $(date -u +%Y-%m-%dT%H:%M:%SZ)" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

# ── Vérifications préliminaires ─────────────────────────────────────
echo "── Verifications ──" | tee -a "$LOG_FILE"
if [ ! -f .env ]; then echo "❌ .env manquant"; exit 1; fi
if [ ! -f seed_historique_db.js ]; then echo "❌ seed_historique_db.js manquant"; exit 1; fi
if [ ! -f seed_historique_tennis.js ]; then echo "❌ seed_historique_tennis.js manquant"; exit 1; fi
echo "✓ .env + scripts ETL presents" | tee -a "$LOG_FILE"

# Backup ancien JSON si existe
for f in historique_football.json historique_tennis.json; do
  if [ -f "$f" ]; then
    cp "$f" "$f.bak_$(date +%Y%m%d_%H%M%S)"
    echo "✓ Backup: $f → $f.bak_*" | tee -a "$LOG_FILE"
  fi
done
echo "" | tee -a "$LOG_FILE"

# ── PHASE 1: Foot ────────────────────────────────────────────────────
echo "════ PHASE 1: Foot ETL ════" | tee -a "$LOG_FILE"
SEASONS=(2024 2025 2026)
for season in "${SEASONS[@]}"; do
  echo "── Foot saison $season ──" | tee -a "$LOG_FILE"
  if [ -n "$LITE" ]; then
    node seed_historique_db.js --sample-pl --season "$season" $WITH_STATS 2>&1 | tee -a "$LOG_FILE"
  else
    node seed_historique_db.js --season "$season" $WITH_STATS 2>&1 | tee -a "$LOG_FILE"
  fi
  echo "" | tee -a "$LOG_FILE"
done
echo "✓ Foot ETL termine" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

# ── PHASE 2: Tennis ──────────────────────────────────────────────────
echo "════ PHASE 2: Tennis ETL ════" | tee -a "$LOG_FILE"
if [ -n "$LITE" ]; then
  node seed_historique_tennis.js --grand-slams-only 2>&1 | tee -a "$LOG_FILE"
else
  node seed_historique_tennis.js 2>&1 | tee -a "$LOG_FILE"
fi
echo "✓ Tennis ETL termine" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

# ── PHASE 2b: openfootball ETL (bd 6du6 ODbL safe) ──────────────────
echo "════ PHASE 2b: openfootball ETL ════" | tee -a "$LOG_FILE"
if [ -f seed_historique_openfootball.js ]; then
  if [ -n "$LITE" ]; then
    node seed_historique_openfootball.js --season 2024-25 2>&1 | tee -a "$LOG_FILE"
  else
    node seed_historique_openfootball.js --all-seasons 2>&1 | tee -a "$LOG_FILE"
  fi
  echo "✓ openfootball ETL termine" | tee -a "$LOG_FILE"
else
  echo "⚠️ seed_historique_openfootball.js manquant — skip" | tee -a "$LOG_FILE"
fi
echo "" | tee -a "$LOG_FILE"

# ── PHASE 3: Verifications outputs ──────────────────────────────────
echo "════ PHASE 3: Verification outputs ════" | tee -a "$LOG_FILE"
for f in historique_football.json historique_tennis.json; do
  if [ -f "$f" ]; then
    SIZE=$(stat -c%s "$f" 2>/dev/null || stat -f%z "$f" 2>/dev/null)
    LINES=$(wc -l < "$f")
    echo "✓ $f: ${SIZE} bytes / ${LINES} lignes" | tee -a "$LOG_FILE"
  else
    echo "⚠️ $f: ABSENT" | tee -a "$LOG_FILE"
  fi
done
echo "" | tee -a "$LOG_FILE"

# ── PHASE 4: Restart serveur ─────────────────────────────────────────
echo "════ PHASE 4: Restart pariscore ════" | tee -a "$LOG_FILE"
if command -v pm2 >/dev/null 2>&1; then
  pm2 restart pariscore 2>&1 | tee -a "$LOG_FILE" || echo "⚠️ pm2 restart echec" | tee -a "$LOG_FILE"
  sleep 3
  echo "── pm2 logs (recent 20) ──" | tee -a "$LOG_FILE"
  pm2 logs --nostream --lines 20 2>&1 | grep -E "(ETL seed merge|Historique|✓|⚠️|ERR)" | tee -a "$LOG_FILE"
else
  echo "⚠️ pm2 non installe — restart manuel requis" | tee -a "$LOG_FILE"
fi
echo "" | tee -a "$LOG_FILE"

# ── Recap final ──────────────────────────────────────────────────────
END_TS=$(date +%s)
ELAPSED=$((END_TS - START_TS))
echo "════ ETL TERMINE ════" | tee -a "$LOG_FILE"
echo "Duree totale: $((ELAPSED / 60))min $((ELAPSED % 60))s" | tee -a "$LOG_FILE"
echo "Log: $LOG_FILE" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

echo "PROCHAINES ETAPES:"
echo "1. Tester endpoint: curl -s 'http://localhost:3000/api/v1/history/query?pageSize=5'"
echo "2. Ouvrir UI Historique tab → verifier matchs"
echo "3. Si OK → close bd 9je + rxh"
