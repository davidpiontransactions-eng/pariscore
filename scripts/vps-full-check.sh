#!/usr/bin/env bash
# État complet pipeline Top5 tennis sur le VPS
cd /home/ubuntu/pariscore || exit 1
echo "== git =="
git log --oneline -1
git status -sb | head -n 2
echo "== backfill pcts =="
tail -n 1 /tmp/backfill-pcts.log 2>/dev/null || echo "(log absent)"
pgrep -f backfill-tennis-detail-pcts >/dev/null && echo "processus: EN COURS" || echo "processus: terminé/inactif"
node -e "const D=require('better-sqlite3');const db=new D('pariscore.db',{readonly:true});console.log('rows total:',db.prepare('SELECT COUNT(*) n FROM tennis_matches_internal').get().n,'| avec pcts:',db.prepare(\"SELECT COUNT(*) n FROM tennis_matches_internal WHERE w_1st_in_pct IS NOT NULL\").get().n,'| restants:',db.prepare(\"SELECT COUNT(*) n FROM tennis_matches_internal WHERE source='bsd' AND w_1st_in_pct IS NULL\").get().n)"
echo "== cron =="
crontab -l | grep top5 || echo "ABSENT"
echo "== API locale (via port next) =="
PORT=$(grep -o 'PORT=[0-9]*' ecosystem.config.js | head -n1 | cut -d= -f2); PORT=${PORT:-3001}
for u in "metric=surfaceElo" "metric=serveDominance" "metric=returnEfficiency" "metric=completeness" "metric=pressure"; do
  curl -s -m 15 "http://localhost:${PORT}/api/tennis/top5?${u}&period=52w" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const j=JSON.parse(d);console.log(j.meta.metric+':',j.entries.length,'lignes |',j.meta.playersInLeaderboard,'joueurs')}catch(e){console.log('ERR parse')}})"
done
