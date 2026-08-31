#!/bin/bash
# cron-retrain-catboost.sh — Pipeline hebdomadaire complet de re-training CatBoost
#
# Étapes :
#   1. Refresh ETL (history_matches depuis la DB)
#   2. Re-training CatBoost (3 modèles : 1x2, over25, btts)
#   3. Calcul des métriques du modèle (30 jours glissants)
#   4. Résumé dans le log
#
# Usage :
#   bash scripts/cron-retrain-catboost.sh            # exécution réelle
#   bash scripts/cron-retrain-catboost.sh --dry-run   # simulation
#
# Cron VPS suggéré (dimanche 05:00 UTC) :
#   0 5 * * 0 /home/ubuntu/pariscore/scripts/cron-retrain-catboost.sh >> /home/ubuntu/pariscore/data/logs/cron-retrain.log 2>&1

set -euo pipefail

DEPLOY_DIR="/home/ubuntu/pariscore"
LOG_DIR="$DEPLOY_DIR/data/logs"
mkdir -p "$LOG_DIR"

DATE=$(date +%Y%m%d)
LOG_FILE="$LOG_DIR/retrain-$DATE.log"
DRY_RUN=false

# Parser --dry-run
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
  esac
done

cd "$DEPLOY_DIR"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

run_step() {
  local label="$1"
  shift
  log "── Étape : $label"
  if $DRY_RUN; then
    log "  [DRY-RUN] Simulation — commande : $*"
    return 0
  fi
  if "$@" >> "$LOG_FILE" 2>&1; then
    log "  ✓ $label terminé"
  else
    log "  ✗ $label échoué (code: $?)"
    exit 1
  fi
}

log "╔══════════════════════════════════════════════════╗"
log "║  Retrain CatBoost — Pipeline hebdomadaire        ║"
log "║  Dry-run: $DRY_RUN                                   ║"
log "╚══════════════════════════════════════════════════╝"

# ── Étape 1 : Refresh ETL ─────────────────────────────────────────────────────
run_step "ETL history_matches" node scripts/etl-history-matches.js --source=db

# ── Étape 2 : Training CatBoost ───────────────────────────────────────────────
run_step "Training CatBoost" python ml/train_catboost.py --db pariscore.db

# ── Étape 3 : Métriques modèle (30 jours) ────────────────────────────────────
run_step "Métriques modèle" node scripts/compute-model-metrics.js --period=30d --output=db

# ── Résumé ─────────────────────────────────────────────────────────────────────
log ""
log "╔══════════════════════════════════════════════════╗"
log "║  Pipeline re-training terminé avec succès        ║"
log "╚══════════════════════════════════════════════════╝"
log "  Log complet : $LOG_FILE"
log "  Date : $DATE"
