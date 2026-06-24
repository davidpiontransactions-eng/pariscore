#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""scrape_1xbet_mma.py — Scraper de cotes MMA/UFC depuis 1xBet"""

import cloudscraper, json, sqlite3, os, sys, time
from datetime import datetime, timezone
from pathlib import Path

PROJECT_DIR = Path(__file__).resolve().parent.parent
DB_PATH = PROJECT_DIR / "pariscore.db"
JSON_OUT_PATH = PROJECT_DIR / "data" / "odds_1xbet_mma.json"
CACHE_SECONDS = 300
API_BASE = "https://1xbet.rs/service-api/LineFeed"
UFC_SPORT_ID = 189
REQUEST_TIMEOUT = 20

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "application/json",
    "X-Requested-With": "XMLHttpRequest",
}

def init_db():
    conn = sqlite3.connect(str(DB_PATH))
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("""
        CREATE TABLE IF NOT EXISTS odds_1xbet_mma (
            game_id       INTEGER PRIMARY KEY,
            event_name    TEXT,
            league_id     INTEGER,
            fighter1      TEXT,
            fighter2      TEXT,
            odds_f1       REAL,
            odds_f2       REAL,
            start_time    INTEGER,
            last_updated  TEXT DEFAULT (datetime('now'))
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS odds_1xbet_log (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            scraped_at  TEXT DEFAULT (datetime('now')),
            fights_ok   INTEGER,
            fights_err  INTEGER
        )
    """)
    conn.commit()
    return conn

def check_cache(conn):
    row = conn.execute(
        "SELECT scraped_at FROM odds_1xbet_log ORDER BY id DESC LIMIT 1"
    ).fetchone()
    if not row:
        return False
    t = datetime.strptime(row[0], "%Y-%m-%d %H:%M:%S")
    return (datetime.now() - t).total_seconds() < CACHE_SECONDS

def store_fights(conn, fights):
    cursor = conn.cursor()
    ok = 0
    for f in fights:
        try:
            cursor.execute("""
                INSERT OR REPLACE INTO odds_1xbet_mma
                    (game_id, event_name, league_id, fighter1, fighter2,
                     odds_f1, odds_f2, start_time, last_updated)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
            """, (
                f["game_id"], f["event_name"], f["league_id"],
                f["fighter1"], f["fighter2"],
                f["odds_f1"], f["odds_f2"], f["start_time"],
            ))
            ok += 1
        except Exception as e:
            print(f"  DB error game {f.get('game_id')}: {e}")
    conn.commit()
    cursor.execute("INSERT INTO odds_1xbet_log (fights_ok, fights_err) VALUES (?, 0)", (ok,))
    conn.commit()
    return ok

def fetch_ufc_games():
    scraper = cloudscraper.create_scraper()
    url = f"{API_BASE}/BestGamesExtZip?sports={UFC_SPORT_ID}&count=500&lng=en&mode=4&country=75"
    r = scraper.get(url, headers=HEADERS, timeout=REQUEST_TIMEOUT)
    if r.status_code != 200:
        print(f"API Error: HTTP {r.status_code}")
        print(f"Response: {r.text[:300]}")
        return []
    data = r.json()
    val = data.get("Value")
    if not val:
        print(f"API Error: no Value -- {data.get('Error', '?')}")
        return []
    return val

def parse_moneyline(raw_games):
    fights = []
    for g in raw_games:
        game_id = g.get("I")
        if not game_id:
            continue
        odds_f1 = None
        odds_f2 = None
        for e in g.get("E", []):
            t = e.get("T")
            c = e.get("C")
            if t == 1 and c:
                odds_f1 = float(c)
            elif t == 3 and c:
                odds_f2 = float(c)
        if odds_f1 is None or odds_f2 is None:
            continue
        fights.append({
            "game_id":    game_id,
            "event_name": g.get("L", "?"),
            "league_id":  g.get("LI", 0),
            "fighter1":   g.get("O1", "?"),
            "fighter2":   g.get("O2", "?"),
            "odds_f1":    odds_f1,
            "odds_f2":    odds_f2,
            "start_time": g.get("S", 0),
        })
    return fights

def main():
    force = "--force" in sys.argv
    json_only = "--json-only" in sys.argv

    conn = init_db()

    if not force and not json_only and check_cache(conn):
        t = conn.execute("SELECT scraped_at FROM odds_1xbet_log ORDER BY id DESC LIMIT 1").fetchone()[0]
        elapsed = int((datetime.now() - datetime.strptime(t, "%Y-%m-%d %H:%M:%S")).total_seconds())
        print(f"[CACHE] Dernier scrape il y a {elapsed}s (<{CACHE_SECONDS}s). Passe --force pour forcer.")
        conn.close()
        return

    print("[1/3] Appel 1xBet BestGamesExtZip (sport=189)...")
    raw = fetch_ufc_games()
    if not raw:
        print("[ERR] Aucune game retournee par l'API.")
        conn.close()
        return
    print(f"      => {len(raw)} games brutes recues")

    print("[2/3] Extraction des cotes moneyline...")
    fights = parse_moneyline(raw)
    print(f"      => {len(fights)} fights avec moneyline")

    for f in fights[:5]:
        print(f"      {f['fighter1'][:24]:24s} vs {f['fighter2'][:24]:24s}  "
              f"{f['odds_f1']:.3f} / {f['odds_f2']:.3f}  [{f['event_name']}]")

    os.makedirs(str(JSON_OUT_PATH.parent), exist_ok=True)
    with open(str(JSON_OUT_PATH), "w", encoding="utf-8") as fp:
        json.dump({
            "scraped_at": datetime.now(timezone.utc).isoformat(),
            "sport": "UFC",
            "source": "1xBet.rs (via VPN Serbie)",
            "fights_count": len(fights),
            "fights": fights,
        }, fp, ensure_ascii=False, indent=2)
    print(f"      => JSON ecrit: {JSON_OUT_PATH}")

    if json_only:
        print(json.dumps(fights, ensure_ascii=False, indent=2))
    else:
        print("[3/3] Stockage SQLite...")
        ok = store_fights(conn, fights)
        print(f"      => {ok} fights stockes dans {DB_PATH}")

    conn.close()
    print("[OK] Termine.")

if __name__ == "__main__":
    main()
