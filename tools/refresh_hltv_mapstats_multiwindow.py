#!/usr/bin/env python3
"""
refresh_hltv_mapstats_multiwindow.py
────────────────────────────────────
Fetches HLTV map winrates for top-30 teams across 3 time windows
using cloudscraper (bypasses Cloudflare JS challenge).

Install:
    pip install cloudscraper beautifulsoup4

Run:
    python3 tools/refresh_hltv_mapstats_multiwindow.py

Output:
    data/hltv_mapstats_3m.json
    data/hltv_mapstats_6m.json
    data/hltv_mapstats_1y.json

Deploy to VPS after run:
    scp data/hltv_mapstats_*.json ubuntu@vps:/home/ubuntu/pariscore/data/

Cron (weekly, from residential IP):
    0 4 * * 0  cd /home/user/pariscore && python3 tools/refresh_hltv_mapstats_multiwindow.py
"""

import json, os, sys, time, re
from datetime import date, timedelta
from pathlib import Path

try:
    import cloudscraper
except ImportError:
    print('[ERROR] cloudscraper not installed. Run: pip install cloudscraper', file=sys.stderr)
    sys.exit(1)

try:
    from bs4 import BeautifulSoup
except ImportError:
    print('[ERROR] beautifulsoup4 not installed. Run: pip install beautifulsoup4', file=sys.stderr)
    sys.exit(1)

# ─── Config ──────────────────────────────────────────────────────────────────
ROOT         = Path(__file__).parent.parent
RANKINGS_F   = ROOT / 'data' / 'hltv_rankings.json'
OUT_3M       = ROOT / 'data' / 'hltv_mapstats_3m.json'
OUT_6M       = ROOT / 'data' / 'hltv_mapstats_6m.json'
OUT_1Y       = ROOT / 'data' / 'hltv_mapstats_1y.json'

MAX_TEAMS    = 30
DELAY_S      = 6        # seconds between requests — polite rate limiting
ACTIVE_MAPS  = ['Mirage','Inferno','Nuke','Ancient','Anubis','Vertigo','Dust2']

WINDOWS = [
    { 'key': '3m', 'days': 90,  'out': OUT_3M },
    { 'key': '6m', 'days': 180, 'out': OUT_6M },
    { 'key': '1y', 'days': 365, 'out': OUT_1Y },
]

# ─── HLTV URLs ────────────────────────────────────────────────────────────────
# Map stats page: /stats/teams/maps/{id}/{slug}?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
HLTV_MAPS_URL = 'https://www.hltv.org/stats/teams/maps/{team_id}/{slug}?startDate={start}&endDate={end}'

def date_str(d): return d.strftime('%Y-%m-%d')
def days_ago(n): return date.today() - timedelta(days=n)
def slugify(name): return re.sub(r'[^a-z0-9]', '-', name.lower()).strip('-')

# ─── Load team list from rankings JSON ───────────────────────────────────────
def load_teams():
    try:
        raw = json.loads(RANKINGS_F.read_text(encoding='utf-8'))
        teams = raw.get('teams', [])[:MAX_TEAMS]
        print(f'[MultiWindow] {len(teams)} teams from {RANKINGS_F.name}')
        return teams  # [{ rank, name, points }]
    except Exception as e:
        print(f'[ERROR] Cannot read {RANKINGS_F}: {e}', file=sys.stderr)
        sys.exit(1)

# ─── HLTV team ID lookup via search ──────────────────────────────────────────
HLTV_SEARCH = 'https://www.hltv.org/search?query={name}'
# Fallback: known IDs from hltv_rankings.json if available
def extract_team_id_from_page(html, team_name):
    """Try to extract team ID from HLTV search result page."""
    soup = BeautifulSoup(html, 'html.parser')
    # Search results: <a href="/team/9565/vitality" ...>
    pattern = re.compile(r'/team/(\d+)/' + slugify(team_name), re.IGNORECASE)
    for a in soup.find_all('a', href=True):
        m = pattern.search(a['href'])
        if m: return int(m.group(1))
    # Broader search
    for a in soup.find_all('a', href=True):
        m = re.search(r'/team/(\d+)/', a['href'])
        if m and team_name.split()[0].lower() in a.get_text(strip=True).lower():
            return int(m.group(1))
    return None

# ─── Parse map stats from HLTV stats page ────────────────────────────────────
def parse_map_stats(html):
    """
    Parse HLTV /stats/teams/maps page.
    Table rows: Map | W | L | W%  (or similar)
    Returns { MapName: winrate_int }
    """
    soup  = BeautifulSoup(html, 'html.parser')
    maps  = {}

    # Look for stats table rows — HLTV uses .stats-row or table > tbody > tr
    rows = soup.select('table tbody tr') or soup.select('.stats-row')
    for row in rows:
        cols = row.find_all(['td', 'span', 'div'])
        if len(cols) < 3: continue
        map_name = cols[0].get_text(strip=True)
        if not map_name or len(map_name) < 3: continue
        # Normalize: "de_mirage" or "Mirage"
        clean = map_name.replace('de_', '').capitalize()
        if clean not in ACTIVE_MAPS: continue
        # Winrate column: look for "%" in text
        for col in cols[1:]:
            txt = col.get_text(strip=True).replace('%', '')
            try:
                wr = float(txt)
                if 0 <= wr <= 100:
                    maps[clean] = round(wr) if wr > 1 else round(wr * 100)
                    break
            except ValueError:
                continue

    # Fallback: regex scan for map + winrate patterns
    if not maps:
        for active_map in ACTIVE_MAPS:
            patterns = [
                rf'{active_map}[^%]{{0,80}}?(\d{{1,3}}\.\d{{0,2}})%',
                rf'{active_map}[^%]{{0,80}}?(\d{{2,3}})%',
            ]
            for pat in patterns:
                m = re.search(pat, html, re.IGNORECASE)
                if m:
                    wr = float(m.group(1))
                    if 0 < wr <= 100:
                        maps[active_map] = round(wr)
                    break

    return maps

# ─── Build per-map world rankings ─────────────────────────────────────────────
def build_map_rankings(teams_data):
    rankings = {}
    for map_name in ACTIVE_MAPS:
        entries = [
            { 'name': t['name'], 'hltv_id': t['hltv_id'], 'wr': t['maps'][map_name] }
            for t in teams_data if map_name in t['maps']
        ]
        entries.sort(key=lambda x: -x['wr'])
        for i, e in enumerate(entries): e['rank'] = i + 1
        rankings[map_name] = entries
    return rankings

def write_output(teams_data, window):
    rankings = build_map_rankings(teams_data)
    payload  = {
        'generated'   : str(date.today()),
        'window'      : window['key'],
        'window_days' : window['days'],
        'source'      : 'HLTV.org via cloudscraper — run weekly from residential IP',
        'n_teams'     : len(teams_data),
        'maps'        : ACTIVE_MAPS,
        'teams'       : teams_data,
        'map_rankings': rankings,
    }
    out = window['out']
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding='utf-8')
    print(f'  [{window["key"]}] Written {len(teams_data)} teams → {out.name}')

# ─── Main ─────────────────────────────────────────────────────────────────────
def main():
    teams_list = load_teams()
    scraper    = cloudscraper.create_scraper(
        browser={ 'browser': 'chrome', 'platform': 'windows', 'mobile': False }
    )
    today = date.today()

    # data[window_key] = list of { name, hltv_id, maps:{} }
    data = { w['key']: [] for w in WINDOWS }

    cf_fails = 0
    total    = len(teams_list)

    for i, team in enumerate(teams_list):
        name = team['name']
        print(f'\n[{i+1}/{total}] {name}')

        # ── Step 1: resolve HLTV team ID ─────────────────────────────────────
        # Try from rankings JSON first (if id was stored)
        hltv_id = team.get('id') or team.get('hltv_id')

        if not hltv_id:
            search_url = HLTV_SEARCH.format(name=name.replace(' ', '+'))
            print(f'  Resolving ID via search...', end=' ')
            try:
                r = scraper.get(search_url, timeout=15)
                hltv_id = extract_team_id_from_page(r.text, name)
                if hltv_id: print(f'id={hltv_id}')
                else:        print('NOT FOUND — skipped')
            except Exception as e:
                print(f'FAILED: {e}')
                cf_fails += 1
                time.sleep(DELAY_S)
                continue
            time.sleep(DELAY_S)

        if not hltv_id:
            continue

        # ── Step 2: fetch stats for each time window ──────────────────────────
        slug = slugify(name)
        for w in WINDOWS:
            start_str = date_str(days_ago(w['days']))
            end_str   = date_str(today)
            url = HLTV_MAPS_URL.format(
                team_id=hltv_id, slug=slug, start=start_str, end=end_str
            )
            print(f'  [{w["key"]}] {start_str} → {end_str} ...', end=' ')
            try:
                r    = scraper.get(url, timeout=15)
                if r.status_code == 403 or 'Access denied' in r.text[:500]:
                    print(f'CF BLOCK (status={r.status_code})')
                    cf_fails += 1
                    data[w['key']].append({ 'name': name, 'hltv_id': hltv_id, 'maps': {} })
                else:
                    maps = parse_map_stats(r.text)
                    data[w['key']].append({ 'name': name, 'hltv_id': hltv_id, 'maps': maps })
                    print(f'{len(maps)} maps: {maps}')
            except Exception as e:
                print(f'ERROR: {e}')
                data[w['key']].append({ 'name': name, 'hltv_id': hltv_id, 'maps': {} })
            time.sleep(DELAY_S)

    # ── Write outputs ─────────────────────────────────────────────────────────
    print(f'\n[MultiWindow] CF blocks: {cf_fails}/{total*len(WINDOWS)+total} requests')
    print('[MultiWindow] Writing output files...')
    for w in WINDOWS:
        teams_with_data = [t for t in data[w['key']] if t['maps']]
        write_output(teams_with_data, w)

    if cf_fails == total * (len(WINDOWS) + 1):
        print('\n[WARN] All requests CF-blocked. Try:')
        print('  1. Disable VPN/proxy')
        print('  2. pip install cloudscraper --upgrade')
        print('  3. Use BrightData residential proxy (see CLAUDE.md)')
    else:
        print('\n[MultiWindow] Done.')
        print('Deploy: scp data/hltv_mapstats_*.json ubuntu@vps:/home/ubuntu/pariscore/data/')

if __name__ == '__main__':
    main()
