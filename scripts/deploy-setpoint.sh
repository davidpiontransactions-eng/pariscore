#!/bin/bash
# scripts/deploy-setpoint.sh
# Déploiement SetPoint Tennis Prematch (Next.js standalone)
# Usage: ./scripts/deploy-setpoint.sh [--rebuild]
set -e

DEPLOY_DIR="/home/ubuntu/pariscore"
PM2_NAME="pariscore"

echo "=== Deploiement SetPoint Tennis ==="
cd "$DEPLOY_DIR"

echo "[1/6] Git pull..."
git pull --rebase origin main

echo "[2/6] npm install..."
npm install --omit=dev --silent

echo "[3/6] Build Next.js + copie statiques..."
npm run build

echo "[4/6] Verifier statiques standalone..."
if [ -d ".next/standalone/.next/static/chunks" ]; then
    CHUNK_COUNT=$(ls .next/standalone/.next/static/chunks/ | wc -l)
    echo "   $CHUNK_COUNT chunks presents dans standalone"
else
    echo "   ERREUR: statiques standalone manquantes apres build"
    exit 1
fi

echo "[5/6] PM2 restart..."
pm2 restart "$PM2_NAME" --update-env
pm2 save

echo "[6/6] Stabilite post-restart..."
sleep 8
PM2_STATUS=$(pm2 show "$PM2_NAME" 2>/dev/null | grep "status" | tr -d ' ')
if echo "$PM2_STATUS" | grep -q "online"; then
    echo "   PM2 status: online OK"
else
    echo "   ERREUR: PM2 status pas online: $PM2_STATUS"
    exit 1
fi

echo ""
echo "=== Deploiement termine avec succes ==="
pm2 list
