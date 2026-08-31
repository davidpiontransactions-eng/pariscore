@echo off
setlocal enabledelayedexpansion
:: scripts/deploy-predictions.bat — Déploiement du système de prédictions sur le VPS
::
:: Envoie les modèles CatBoost, scripts ETL/cron, déploie le code, et
:: configure le cron de re-training hebdomadaire.
::
:: Usage:
::   scripts\deploy-predictions.bat "message"
::   scripts\deploy-predictions.bat              (message par défaut)
::
:: Prérequis: clé SSH configurée pour ubuntu@51.75.21.239

set "VPS_HOST=ubuntu@51.75.21.239"
set "SSH_OPTS=-o BatchMode=yes -o ConnectTimeout=15"
set "VPS_DIR=/home/ubuntu/pariscore"

set "MSG=%~1"
if "%MSG%"=="" set "MSG=deploy prediction system"

echo =========================================================
echo   Deploy Prediction System — %MSG%
echo   %DATE% %TIME%
echo =========================================================

:: ── [1/6] Build Next.js ─────────────────────────────────────────────────────
echo.
echo [1/6] Building...
call bun run build
if !ERRORLEVEL! neq 0 (
  echo [FAIL] Build échoué
  exit /b 1
)
echo   ✓ Build OK

:: ── [2/6] Copier modèles CatBoost ──────────────────────────────────────────
echo.
echo [2/6] Copying CatBoost models...
if not exist "models\*.cbm" (
  echo [WARN] Aucun modèle .cbm dans models/ — skip copie modèles
  goto :skip_models
)
:: Créer le dossier models sur le VPS si absent
ssh %SSH_OPTS% %VPS_HOST% "mkdir -p %VPS_DIR%/models"
scp %SSH_OPTS% models\*.cbm %VPS_HOST%:%VPS_DIR%/models/
if !ERRORLEVEL! neq 0 (
  echo [FAIL] SCP modèles échoué
  exit /b 1
)
echo   ✓ Modèles copiés
:skip_models

:: ── [3/6] Copier scripts ETL + cron ────────────────────────────────────────
echo.
echo [3/6] Copying ETL + cron scripts...
ssh %SSH_OPTS% %VPS_HOST% "mkdir -p %VPS_DIR%/scripts"
scp %SSH_OPTS% scripts\etl-history-matches.js %VPS_HOST%:%VPS_DIR%/scripts/
scp %SSH_OPTS% scripts\compute-model-metrics.js %VPS_HOST%:%VPS_DIR%/scripts/
scp %SSH_OPTS% scripts\cron-retrain-catboost.js %VPS_HOST%:%VPS_DIR%/scripts/
scp %SSH_OPTS% scripts\cron-retrain-catboost.sh %VPS_HOST%:%VPS_DIR%/scripts/
if !ERRORLEVEL! neq 0 (
  echo [FAIL] SCP scripts échoué
  exit /b 1
)
:: Rendre le shell exécutable
ssh %SSH_OPTS% %VPS_HOST% "chmod +x %VPS_DIR%/scripts/cron-retrain-catboost.sh"
echo   ✓ Scripts copiés

:: ── [4/6] Copier modèle Python + requirements ──────────────────────────────
echo.
echo [4/6] Copying ML artifacts...
if exist "ml\train_catboost.py" (
  ssh %SSH_OPTS% %VPS_HOST% "mkdir -p %VPS_DIR%/ml"
  scp %SSH_OPTS% ml\train_catboost.py %VPS_HOST%:%VPS_DIR%/ml/
  scp %SSH_OPTS% ml\requirements-ml.txt %VPS_HOST%:%VPS_DIR%/ml/ 2>nul
  echo   ✓ ML scripts copiés
) else (
  echo [WARN] ml/train_catboost.py absent — skip
)

:: ── [5/6] Deploy code (build + restart) ─────────────────────────────────────
echo.
echo [5/6] Deploying code via deploy.bat...
call scripts\deploy.bat "%MSG%"
if !ERRORLEVEL! neq 0 (
  echo [FAIL] deploy.bat échoué
  exit /b 1
)
echo   ✓ Code déployé

:: ── [6/6] Setup cron re-training sur VPS ────────────────────────────────────
echo.
echo [6/6] Setting up cron re-training...
:: Vérifier si le cron existe déjà, sinon l'ajouter
ssh %SSH_OPTS% %VPS_HOST% "pm2 describe pariscore-retrain >/dev/null 2>&1 && echo EXISTS || (cd %VPS_DIR% && pm2 start scripts/cron-retrain-catboost.js --name pariscore-retrain --cron '0 5 * * 0' && pm2 save)"
if !ERRORLEVEL! neq 0 (
  echo [WARN] Setup cron pm2 échoué — configurer manuellement
  echo   ssh %VPS_HOST% "cd %VPS_DIR% && pm2 start scripts/cron-retrain-catboost.js --name pariscore-retrain --cron '0 5 * * 0'"
)
echo   ✓ Cron re-training configuré (dimanche 05:00 UTC)

echo.
echo =========================================================
echo   ✓ Prediction system deployed
echo   Models: %VPS_DIR%/models/*.cbm
echo   Cron:   pariscore-retrain (dim 05:00 UTC)
echo   Logs:   %VPS_DIR%/data/logs/cron-retrain.log
echo =========================================================
