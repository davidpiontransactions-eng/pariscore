#!/usr/bin/env bash
# Installe le cron quotidien Top5 tennis (04:50) sur le VPS.
cd /home/ubuntu/pariscore || exit 1
chmod +x scripts/cron-top5-refresh.sh
# Idempotent : retire l'ancienne ligne puis ajoute la nouvelle
(crontab -l 2>/dev/null | grep -v "cron-top5-refresh" ; echo "50 4 * * * /home/ubuntu/pariscore/scripts/cron-top5-refresh.sh >> /tmp/cron-top5.log 2>&1") | crontab -
echo "== crontab actif =="
crontab -l | grep top5
