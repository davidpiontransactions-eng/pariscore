#!/bin/bash
# Sync vault notes from VPS to GitHub
# Run this after vault-daily-summary.js generates notes
# Usage: ./scripts/sync-vault-to-pc.sh "Daily update 2026-06-13"

set -e

VAULT_DIR="/home/ubuntu/PariScore-vault"
COMMIT_MSG="${1:-Vault auto-update $(date +%Y-%m-%d)}"

if [ ! -d "$VAULT_DIR" ]; then
    echo "❌ Vault directory not found: $VAULT_DIR"
    echo "   Clone it first:"
    echo "   cd /home/ubuntu && git clone https://github.com/votre-compte/PariScore-vault.git"
    exit 1
fi

cd "$VAULT_DIR"

# Check for changes
if [ -z "$(git status --porcelain)" ]; then
    echo "📭 Aucun changement dans le vault — rien à synchroniser."
    exit 0
fi

git add -A
git commit -m "$COMMIT_MSG"
git push origin main

echo "✅ Vault poussé vers GitHub — PC peut maintenant pull"
