#!/bin/bash
set -e

DEPLOY_DIR="/home/ubuntu/pariscore"
PM2_NAME="server"

echo "--- Début de la mise à jour PariScore ---"
cd "$DEPLOY_DIR"

echo "[1/6] Fetch remote..."
git fetch --all

echo "[2/6] Reset hard sur origin/main..."
git reset --hard origin/main

echo "[3/6] Pull..."
git pull --rebase origin main

echo "[4/6] npm install (omit dev)..."
npm install --omit=dev --silent

echo "[5/6] npm rebuild native modules (node version guard)..."
npm rebuild better-sqlite3

echo "[6/6] PM2 restart..."
pm2 restart "$PM2_NAME" --update-env

echo ""
echo "--- VPS mis à jour avec succès ! ---"
echo "Commit actif : $(git log --oneline -1)"
pm2 list
