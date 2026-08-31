#!/bin/bash
# Cron job pour calculer les métriques du modèle weekly
set -e

DEPLOY_DIR="/home/ubuntu/pariscore"
LOG_DIR="$DEPLOY_DIR/data/logs"
mkdir -p "$LOG_DIR"

DATE=$(date +%Y%m%d)
LOG_FILE="$LOG_DIR/model-metrics-$DATE.log"

cd "$DEPLOY_DIR"

echo "[$(date)] Starting model metrics computation..." | tee -a "$LOG_FILE"
node scripts/compute-model-metrics.js --period=7d --output=db 2>&1 | tee -a "$LOG_FILE"
echo "[$(date)] Done." | tee -a "$LOG_FILE"
