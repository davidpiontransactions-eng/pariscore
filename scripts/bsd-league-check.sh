#!/bin/bash
# bsd-league-check.sh — Liste les ligues football disponibles sur BSD
# Usage: bash scripts/bsd-league-check.sh
set -uo pipefail
cd /home/ubuntu/pariscore
TOKEN=$(grep BSD_API_KEY .env | head -1 | cut -d= -f2)
echo "Fetching BSD football matches..."
> /tmp/bsd-all-matches.json
OFFSET=0
while [ $OFFSET -lt 550 ]; do
  curl -s "https://sports.bzzoiro.com/api/matches/?limit=100&offset=$OFFSET" \
    -H "Authorization: Token $TOKEN" -H "Accept: application/json" 2>/dev/null \
    | python3 -c "
import sys, json
try:
    d = json.loads(sys.stdin.read())
except:
    sys.exit(0)
for m in d.get('results', []):
    lg = m.get('league') or {}
    print(json.dumps({'id': lg.get('id'), 'name': lg.get('name'), 'country': lg.get('country'), 'women': lg.get('is_women')}))
" >> /tmp/bsd-all-matches.json
  OFFSET=$((OFFSET + 100))
done
python3 -c "
import json
leagues = {}
for line in open('/tmp/bsd-all-matches.json'):
    line = line.strip()
    if not line: continue
    try:
        d = json.loads(line)
    except: continue
    lid = d.get('id')
    if lid is None: continue
    if lid not in leagues:
        leagues[lid] = {'name': d.get('name'), 'country': d.get('country'), 'women': d.get('women'), 'matches': 0}
    leagues[lid]['matches'] += 1
print(f'Distinct leagues: {len(leagues)}')
for lid, info in sorted(leagues.items(), key=lambda x: -x[1]['matches']):
    w = ' [W]' if info['women'] else ''
    print(f'  {lid}: {info[\"name\"]} ({info[\"country\"]}){w} - {info[\"matches\"]} matchs')
"