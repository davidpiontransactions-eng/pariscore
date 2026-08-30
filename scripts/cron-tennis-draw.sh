#!/bin/bash
# cron-tennis-draw.sh — Rafraîchissement quotidien des draws TennisAbstract + tnnslive
# Exécuté via PM2 cron (ecosystem.config.js → pariscore-cron-draw)
# Utilise FlareSolverr pour bypass Cloudflare (IP datacenter)
# Schedule: 15h00 heure Paris (13h00 UTC), quotidien jusqu'au 13 sept 2026

set -euo pipefail
cd /home/ubuntu/pariscore

LOG_PREFIX='[draw-cron]'
echo "$LOG_PREFIX Démarrage $(date -u +'%Y-%m-%dT%H:%M:%SZ')"

# Scrape les tournois principaux (format proj32)
node scripts/scrape-tennis-draw.js --all 2>&1 || true

# Scrape les draws US Open (tnnslive.com bracket)
node scripts/scrape-tnnslive-draw.js --all 2>&1 || true

echo "$LOG_PREFIX Terminé"
