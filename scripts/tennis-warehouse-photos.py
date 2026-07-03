#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""tennis-warehouse-photos.py - ParisScore Tennis Photo Enrichment"""

import sqlite3, os, sys, time, requests
from parsel import Selector

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(SCRIPT_DIR)
DB_PATH = os.path.join(PROJECT_DIR, 'pariscore.db')
UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'

GALLERIES = {
    'ATP': 'https://www.tennis-warehouse.com/playersATP.html',
    'WTA': 'https://www.tennis-warehouse.com/WTA_Pro_Player_Gallery/catpage-WTAPPG.html',
}


def fetch_gallery(url):
    r = requests.get(url, headers={'User-Agent': UA}, timeout=20)
    r.raise_for_status()
    sel = Selector(r.text)
    names = sel.css('.carousel__info-name ::text').getall()
    results = []
    for img in sel.css('img'):
        src = img.css('::attr(src)').get() or ''
        if 'headshot' in src.lower():
            idx = len(results)
            if idx < len(names):
                results.append((names[idx].strip(), src))
    return results


def ensure_table(db):
    sql = 'CREATE TABLE IF NOT EXISTS player_photos ('
    sql += 'player_id TEXT PRIMARY KEY, player_name TEXT, '
    sql += "source TEXT NOT NULL DEFAULT 'wikipedia', local_path TEXT, "
    sql += 'width INTEGER DEFAULT 0, height INTEGER DEFAULT 0, '
    sql += "fetched_at INTEGER NOT NULL DEFAULT (strftime('%s','now')))"
    db.execute(sql)


def match_player(db, name, circuit):
    nl = name.lower().strip()
    row = db.execute('SELECT player_id, player_name FROM tennis_players_elo WHERE LOWER(player_name)=? AND circuit=?', (nl, circuit)).fetchone()
    if row: return row
    row = db.execute('SELECT player_id, player_name FROM tennis_players_elo WHERE LOWER(player_name)=?', (nl,)).fetchone()
    if row: return row
    parts = name.split()
    if len(parts) >= 2:
        last = parts[-1].lower()
        q = 'SELECT player_id, player_name FROM tennis_players_elo WHERE LOWER(player_name) LIKE ? AND circuit=?'
        rows = db.execute(q, ('%' + last + '%', circuit)).fetchall()
        if len(rows) == 1: return rows[0]
        for r2 in rows:
            dp = r2[1].lower().split()
            if len(dp) >= 2 and dp[-1] == last and dp[0].startswith(parts[0][0].lower()):
                return r2
        if rows:
            print(f"    [?] multiple matches for {name}: {[r[1] for r in rows]} - using first")
            return rows[0]
    return None


def main():
    print()
    print('=' * 58)
    print('  tennis-warehouse-photos.py - ParisScore')
    print('=' * 58)
    print()
    if not os.path.exists(DB_PATH):
        print(f"FATAL: DB not found at {DB_PATH}")
        sys.exit(1)
    db = sqlite3.connect(DB_PATH)
    ensure_table(db)
    bp = db.execute('SELECT player_id, player_name, circuit FROM tennis_players_elo').fetchall()
    print(f"Loaded {len(bp)} players from tennis_players_elo")
    print()
    ts = tm = ti = sk = er = 0
    un = []
    for circuit, url in GALLERIES.items():
        print(f"[{circuit}] Fetching {url}...")
        try:
            gal = fetch_gallery(url)
        except Exception as e:
            print(f"  ERROR: {e}")
            er += 1
            continue
        print(f"  Found {len(gal)} players")
        ts += len(gal)
        for pn, pu in gal:
            print(f"  {pn}: ", end="")
            m = match_player(db, pn, circuit)
            if not m:
                print("NO MATCH")
                un.append((circuit, pn))
                continue
            pid, pname = m
            tm += 1
            print(f"matched {pname} ({pid})", end="")
            ex = db.execute('SELECT source FROM player_photos WHERE player_id=?', (pid,)).fetchone()
            if ex:
                print(f" (exists: {ex[0]})", end="")
                sk += 1
            else:
                db.execute('INSERT INTO player_photos (player_id,player_name,source,local_path,fetched_at) VALUES (?,?,?,?,?)',
                    (pid, pname, 'tennis-warehouse', pu, int(time.time())))
                print(" INSERTED", end="")
                ti += 1
            print()
        time.sleep(1)
    db.commit()
    print()
    print("=" * 58)
    print("  RESULTS")
    print("=" * 58)
    print(f"  Scraped:  {ts}")
    print(f"  Matched:  {tm}")
    print(f"  Inserted: {ti}")
    print(f"  Skipped:  {sk}")
    print(f"  Errors:   {er}")
    print(f"  Unmatched: {len(un)}")
    if un:
        print()
        print("  Unmatched players:")
        for c, n in un:
            print(f"    [{c}] {n}")
    db.close()
    print()
    print("[DONE]")


if __name__ == "__main__":
    main()