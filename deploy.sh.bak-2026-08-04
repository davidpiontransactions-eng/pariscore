#!/bin/bash
# PariScore VPS deploy — safe pull + restart
# Usage: bash deploy.sh
set -e

echo "[deploy] Fetching origin..."
git fetch origin

echo "[deploy] Hard reset to origin/main..."
git checkout main 2>/dev/null || git checkout -b main --track origin/main 2>/dev/null || true
git reset --hard origin/main

echo "[deploy] Setting pull strategy to merge (no more divergence hint)..."
git config pull.rebase false

echo "[deploy] Restarting pm2..."
# Le process PM2 s'appelle 'pariscore' (pas 'server'). --update-env recharge .env.
pm2 restart pariscore --update-env

echo "[deploy] Done. Current commit:"
git log --oneline -1
