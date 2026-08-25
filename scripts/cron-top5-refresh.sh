#!/usr/bin/env bash
# Cron quotidien Top5 tennis — rafraîchit les données du pipeline :
#   1. ETL BSD 30 jours (upsert idempotent source/source_id)
#   2. Backfill pcts du détail BSD (uniquement rows encore NULL)
# Verrou flock : jamais deux runs simultanés.
set -u
cd /home/ubuntu/pariscore || exit 1
exec 9>/tmp/top5-refresh.lock
flock -n 9 || { echo "[cron-top5] déjà en cours — skip"; exit 0; }
set -a; source .env; set +a

node tools/build-tennis-internal-history.js --backfill-days=30 >> /tmp/cron-top5.log 2>&1
node tools/backfill-tennis-detail-pcts.js --limit=0 --pause-ms=220 >> /tmp/cron-top5.log 2>&1

echo "[$(date '+%F %T')] refresh done: $(tail -n 1 /tmp/cron-top5.log)" >> /tmp/cron-top5.log
