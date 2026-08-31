#!/bin/bash
# scripts/setup-prediction-env.sh — Setup de l'environnement de prédiction sur le VPS
#
# Étapes :
#   1. Vérifier/activer CATBOOST_ENABLED dans .env
#   2. Installer Python + catboost si absent
#   3. ETL initial (history_matches depuis la DB)
#   4. Training initial (3 modèles CatBoost : 1x2, over25, btts)
#   5. Configurer pm2 cron re-training hebdomadaire
#   6. Afficher le statut
#
# Usage :
#   bash scripts/setup-prediction-env.sh              # exécution complète
#   bash scripts/setup-prediction-env.sh --dry-run    # simulation
#
# Exécuter une seule fois après le premier déploiement des modèles.

set -euo pipefail

DEPLOY_DIR="${DEPLOY_DIR:-/home/ubuntu/pariscore}"
DRY_RUN=false

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
  esac
done

cd "$DEPLOY_DIR" || { echo "ERR: $DEPLOY_DIR introuvable"; exit 1; }

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

run_or_dry() {
  local label="$1"
  shift
  log "  → $label"
  if $DRY_RUN; then
    log "    [DRY-RUN] $*"
    return 0
  fi
  if "$@"; then
    log "    ✓ $label OK"
  else
    log "    ✗ $label échoué (code: $?)"
    return 1
  fi
}

echo "╔══════════════════════════════════════════════════╗"
echo "║  Setup Prediction Environment                   ║"
echo "║  Dry-run: $DRY_RUN                                   ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""

# ── [1/6] Vérifier CATBOOST_ENABLED dans .env ───────────────────────────────
log "[1/6] Checking CATBOOST_ENABLED in .env..."

if [ ! -f .env ]; then
  log "  ERR: .env absent — impossible de continuer"
  exit 1
fi

if grep -qE '^CATBOOST_ENABLED=true' .env; then
  log "  ✓ CATBOOST_ENABLED=true déjà présent"
elif grep -qE '^CATBOOST_ENABLED=' .env; then
  log "  → CATBOOST_ENABLED trouvé mais désactivé — activation..."
  if ! $DRY_RUN; then
    sed -i 's/^CATBOOST_ENABLED=.*/CATBOOST_ENABLED=true/' .env
  fi
  log "  ✓ CATBOOST_ENABLED activé"
else
  log "  → CATBOOST_ENABLED absent — ajout..."
  if ! $DRY_RUN; then
    echo "" >> .env
    echo "# CatBoost prediction models" >> .env
    echo "CATBOOST_ENABLED=true" >> .env
  fi
  log "  ✓ CATBOOST_ENABLED ajouté"
fi

# ── [2/6] Installer Python + catboost ────────────────────────────────────────
log ""
log "[2/6] Checking Python + CatBoost..."

if command -v python3 &>/dev/null; then
  PY=$(command -v python3)
elif command -v python &>/dev/null; then
  PY=$(command -v python)
else
  log "  → Python absent — installation..."
  run_or_dry "apt-get update" sudo apt-get update -qq
  run_or_dry "apt-get install python3 python3-pip" sudo apt-get install -y python3 python3-pip python3-venv
  PY=$(command -v python3)
fi
log "  Python: $PY ($($PY --version 2>&1))"

# Vérifier catboost installé
if $PY -c "import catboost" 2>/dev/null; then
  CB_VER=$($PY -c "import catboost; print(catboost.__version__)" 2>/dev/null)
  log "  ✓ CatBoost installé (v$CB_VER)"
else
  log "  → CatBoost absent — installation..."
  if [ -f ml/requirements-ml.txt ]; then
    run_or_dry "pip install -r ml/requirements-ml.txt" $PY -m pip install -r ml/requirements-ml.txt --quiet
  else
    run_or_dry "pip install catboost" $PY -m pip install catboost --quiet
  fi
  if $PY -c "import catboost" 2>/dev/null; then
    CB_VER=$($PY -c "import catboost; print(catboost.__version__)" 2>/dev/null)
    log "  ✓ CatBoost installé (v$CB_VER)"
  else
    log "  ERR: installation CatBoost échouée"
    exit 1
  fi
fi

# ── [3/6] ETL initial ───────────────────────────────────────────────────────
log ""
log "[3/6] ETL history_matches (données initiales)..."

if [ ! -f scripts/etl-history-matches.js ]; then
  log "  ERR: scripts/etl-history-matches.js absent"
  exit 1
fi

run_or_dry "ETL history_matches --source=db" node scripts/etl-history-matches.js --source=db

# ── [4/6] Training initial CatBoost ─────────────────────────────────────────
log ""
log "[4/6] Training initial CatBoost (3 modèles)..."

if [ ! -f ml/train_catboost.py ]; then
  log "  ERR: ml/train_catboost.py absent"
  exit 1
fi

# Vérifier que les modèles existent déjà (copiés par deploy-predictions.bat)
MODELS_EXIST=0
for m in catboost_football_1x2_v1.cbm catboost_football_over25_v1.cbm catboost_football_btts_v1.cbm; do
  if [ -f "models/$m" ]; then
    MODELS_EXIST=$((MODELS_EXIST + 1))
  fi
done

if [ "$MODELS_EXIST" -eq 3 ]; then
  log "  ✓ 3 modèles existants trouvés dans models/"
  log "  → Relancer le training pour actualiser ? (skip si pas de nouvelles données)"
  log "    Exécuter manuellement: python3 ml/train_catboost.py --db pariscore.db"
else
  log "  → $MODELS_EXIST/3 modèles trouvés — training initial..."
  run_or_dry "Training CatBoost" $PY ml/train_catboost.py --db pariscore.db
fi

# ── [5/6] Configurer cron re-training ────────────────────────────────────────
log ""
log "[5/6] Configuring pm2 cron re-training..."

if command -v pm2 &>/dev/null; then
  # Vérifier si le process existe déjà
  if pm2 describe pariscore-retrain &>/dev/null; then
    log "  ✓ cron pariscore-retrain déjà actif"
    pm2 describe pariscore-retrain | grep -E "status|cron" || true
  else
    if [ -f scripts/cron-retrain-catboost.js ]; then
      run_or_dry "pm2 start cron-retrain-catboost" \
        pm2 start scripts/cron-retrain-catboost.js \
          --name pariscore-retrain \
          --cron "0 5 * * 0"
      pm2 save 2>/dev/null || true
      log "  ✓ Cron configuré : dimanche 05:00 UTC"
    else
      log "  ERR: scripts/cron-retrain-catboost.js absent"
      log "  → Créer le cron manuellement: pm2 start scripts/cron-retrain-catboost.js --name pariscore-retrain --cron '0 5 * * 0'"
    fi
  fi
else
  log "  ERR: pm2 non trouvé — cron non configuré"
  log "  → Installer pm2: npm install -g pm2"
fi

# ── [6/6] Statut ─────────────────────────────────────────────────────────────
log ""
log "[6/6] Statut de l'environnement de prédiction..."
echo ""

echo "── .env (CATBOOST_*) ──"
grep -E '^CATBOOST_' .env 2>/dev/null || echo "  (aucune variable CATBOOST_*)"
echo ""

echo "── Modèles ──"
ls -lh models/*.cbm 2>/dev/null || echo "  Aucun modèle .cbm trouvé"
echo ""

echo "── Python ──"
echo "  $PY"
echo "  catboost: $($PY -c 'import catboost; print(catboost.__version__)' 2>/dev/null || echo 'NON INSTALLÉ')"
echo "  numpy: $($PY -c 'import numpy; print(numpy.__version__)' 2>/dev/null || echo 'NON INSTALLÉ')"
echo "  pandas: $($PY -c 'import pandas; print(pandas.__version__)' 2>/dev/null || echo 'NON INSTALLÉ')"
echo ""

echo "── PM2 ──"
pm2 list 2>/dev/null | grep -E "pariscore-retrain|name" || echo "  (pm2 non disponible ou pas de process retrain)"
echo ""

echo "── Dernier ETL ──"
ls -lt data/logs/etl-history*.log 2>/dev/null | head -1 || echo "  (pas de log ETL)"
echo ""

echo "── Dernier retrain ──"
ls -lt data/logs/retrain*.log 2>/dev/null | head -1 || echo "  (pas de log retrain)"
echo ""

echo "╔══════════════════════════════════════════════════╗"
echo "║  Setup terminé                                   ║"
echo "╚══════════════════════════════════════════════════╝"
