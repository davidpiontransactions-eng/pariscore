#!/bin/bash
# scripts/deploy.sh — Hardened deploy entry point
# Secure wrapper around deploy-v2.sh with pre-flight checks
set -uo pipefail

echo "╔════════════════════════════════════════╗"
echo "║   PariScore Deploy — Hardened v3       ║"
echo "╚════════════════════════════════════════╝"

# --- Pre-flight checks ---
echo "[check] Git working tree clean..."
if ! git diff --quiet HEAD 2>/dev/null; then
  echo "[FAIL] Unstaged changes. Run 'git stash' or commit first."
  exit 1
fi

echo "[check] Lint..."
npx eslint src/ --quiet 2>/dev/null || { echo "[FAIL] ESLint errors"; exit 1; }

echo "[check] Typecheck..."
npx tsc --noEmit --quiet 2>/dev/null || { echo "[FAIL] TypeScript errors"; exit 1; }

echo "[check] Build..."
npm run build 2>&1 | tail -5 || { echo "[FAIL] Build failed"; exit 1; }

echo "[check] Static assets exist..."
for f in public/favicon.svg public/manifest.json public/logo-header.svg public/sports-athlete-header.svg public/icon-192.png public/icon-512.png; do
  if [ ! -f "$f" ]; then echo "[FAIL] Missing: $f"; exit 1; fi
done
echo "[OK] All static assets present"

# --- Deploy ---
echo ""
echo "[deploy] Pushing to origin/main..."
git push origin main 2>&1 || { echo "[FAIL] Git push failed"; exit 1; }

echo "[deploy] Triggering VPS deploy-v2..."
exec bash "$(dirname "$0")/deploy-v2.sh" "$@"