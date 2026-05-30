#!/usr/bin/env python3
"""
refresh_hltv_rankings.py — Fetch HLTV top-30 rankings via hltv-async-api
and write to data/hltv_rankings.json for consumption by cs2Service.js.

Usage:
    pip install hltv-async-api
    python3 tools/refresh_hltv_rankings.py

Schedule (crontab, weekly):
    0 6 * * 1 cd /home/ubuntu/pariscore && python3 tools/refresh_hltv_rankings.py
"""

import asyncio
import json
import os
import sys
from datetime import date

OUTPUT_FILE = os.path.join(os.path.dirname(__file__), '..', 'data', 'hltv_rankings.json')

async def fetch_rankings():
    try:
        from hltv_async_api import Hltv
    except ImportError:
        print('[HLTV] hltv-async-api not installed. Run: pip install hltv-async-api', file=sys.stderr)
        sys.exit(1)

    print('[HLTV] Fetching top-30 team rankings…')
    try:
        async with Hltv() as hltv:
            raw = await hltv.get_top_teams(max_teams=30)
    except Exception as e:
        print(f'[HLTV] Fetch failed: {e}', file=sys.stderr)
        sys.exit(1)

    teams = []
    for t in raw:
        teams.append({
            'rank'  : int(t.get('rank', 99)),
            'name'  : str(t.get('title', t.get('name', 'Unknown'))),
            'points': t.get('points', None)
        })

    payload = {
        'generated': str(date.today()),
        'source'   : 'HLTV.org via hltv-async-api — refresh weekly',
        'teams'    : teams
    }

    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

    print(f'[HLTV] Written {len(teams)} teams to {OUTPUT_FILE}')

if __name__ == '__main__':
    asyncio.run(fetch_rankings())
