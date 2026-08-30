#!/bin/bash
# cron-tennis-draw.sh — Rafraîchissement quotidien des draws TennisAbstract
# Exécuté via PM2 cron (ecosystem.config.js → pariscore-cron-draw)
# Utilise FlareSolverr pour bypass Cloudflare (IP datacenter)

set -euo pipefail
cd /home/ubuntu/pariscore

LOG_PREFIX='[draw-cron]'
echo "$LOG_PREFIX Démarrage $(date -u +'%Y-%m-%dT%H:%M:%SZ')"

# Scrape tous les tournois (--all), mode écriture (pas --dry-run)
node scripts/scrape-tennis-draw.js --all 2>&1

EXIT_CODE=$?
if [ $EXIT_CODE -eq 0 ]; then
  echo "$LOG_PREFIX Terminé avec succès"
else
  echo "$LOG_PREFIX Erreur (exit $EXIT_CODE)"
fi
