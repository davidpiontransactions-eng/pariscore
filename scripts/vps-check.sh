#!/usr/bin/env bash
# Check VPS post-deploy — session tennis top5
cd /home/ubuntu/pariscore || exit 1
echo "== git =="
git log --oneline -1
echo "== DB tennis_matches_internal =="
node -e "const D=require('better-sqlite3');const db=new D('pariscore.db',{readonly:true});const cols=db.prepare('PRAGMA table_info(tennis_matches_internal)').all().map(c=>c.name);console.log('colonnes pct:',cols.filter(c=>c.includes('_pct')||c.endsWith('_tb_won')).length,'/12');console.log('rows total:',db.prepare('SELECT COUNT(*) n FROM tennis_matches_internal').get().n);console.log('rows avec pcts:',db.prepare(\"SELECT COUNT(*) n FROM tennis_matches_internal WHERE w_1st_in_pct IS NOT NULL\").get().n)"
echo "== API locale =="
curl -s -o /dev/null -w 'top5 HTTP %{http_code}\n' "http://localhost:3000/api/tennis/top5?metric=surfaceElo"
curl -s "http://localhost:3000/api/tennis/top5?metric=serveDominance" | head -c 220; echo
echo "== pm2 =="
pm2 jlist | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{JSON.parse(d).forEach(p=>console.log(p.name,p.pm2_env.status))})"
