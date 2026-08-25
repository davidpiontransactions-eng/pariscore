#!/usr/bin/env bash
# Intégration données pipeline Top5 tennis sur le VPS
cd /home/ubuntu/pariscore || exit 1

echo "== [1] État avant =="
node -e "const D=require('better-sqlite3');const db=new D('pariscore.db',{readonly:true});const c=db.prepare('PRAGMA table_info(tennis_matches_internal)').all().map(x=>x.name);console.log('colonnes pct:',c.filter(x=>x.includes('_pct')||x.endsWith('_tb_won')).length,'/12');console.log('total:',db.prepare('SELECT COUNT(*) n FROM tennis_matches_internal').get().n,'| bsd:',db.prepare(\"SELECT COUNT(*) n FROM tennis_matches_internal WHERE source='bsd'\").get().n)"
echo ""
echo "== [2] ETL 30 jours (BSD live, quelques minutes) =="
set -a; source .env; set +a
node tools/build-tennis-internal-history.js --backfill-days=30 2>&1 | tail -n 3
echo ""
echo "== [3] Lancement backfill pcts en arrière-plan (nohup) =="
nohup bash -c 'cd /home/ubuntu/pariscore && set -a && source .env && set +a && node tools/backfill-tennis-detail-pcts.js --limit=0 --pause-ms=220' > /tmp/backfill-pcts.log 2>&1 &
echo "PID: $!"
sleep 8
echo "-- premiers logs --"
head -n 6 /tmp/backfill-pcts.log
