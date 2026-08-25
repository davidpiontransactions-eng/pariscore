#!/usr/bin/env bash
# Force rebuild Next.js sur VPS (le smart-runner a skippé alors que les
# commits design/V3 intermédiaires n'avaient jamais été déployés avec build).
cd /home/ubuntu/pariscore || exit 1
echo "== git avant =="
git log --oneline -1
git pull --ff-only || exit 1
echo "== après pull =="
git log --oneline -1
grep -c applyStatusFilter src/lib/sports-tree.ts && echo "code V3 présent ✓"
echo "== build =="
npm run build 2>&1 | tail -n 5 || { echo "ERR: build"; exit 1; }
[ -f .next/standalone/server.js ] || { echo "ERR: server.js absent"; exit 1; }
npx prisma db push --skip-generate 2>&1 | tail -n 1 || true
npx prisma generate >/dev/null 2>&1 || true
cp -f .env .next/standalone/.env 2>/dev/null || true
pm2 restart pariscore-next --update-env
sleep 4
curl -s -o /dev/null -w "local top5 HTTP %{http_code}\n" "http://localhost:3000/api/tennis/top5?metric=surfaceElo"
curl -s "http://localhost:3000/api/tennis/top5?metric=serveDominance" | head -c 150; echo
echo "== backfill progress =="
tail -n 1 /tmp/backfill-pcts.log
