#!/usr/bin/env python3
"""
scrape_cornervalue.py — Scraper Cornervalue.com (100% public, no auth).
Per-team corners FT/For/Against + Over 7.5-11.5 hit rates.
USAGE: python scripts/scrape_cornervalue.py --league premier-league
"""

import sys, os, json, argparse, re, time
from datetime import datetime, timezone
from typing import Optional, Dict, List

try:
    import requests
    from bs4 import BeautifulSoup
except ImportError:
    print("pip install requests beautifulsoup4 lxml", file=sys.stderr); sys.exit(1)

BASE = "https://www.cornervalue.com"
HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}

LEAGUE_SLUGS = {
    "premier-league": "england", "championship": "england2",
    "league-one": "england3", "league-two": "england4",
    "la-liga": "spain", "la-liga-2": "spain2",
    "bundesliga": "germany", "2-bundesliga": "germany2",
    "serie-a": "italy", "serie-b": "italy2",
    "ligue-1": "france", "ligue-2": "france2",
    "eredivisie": "netherlands", "eerste-divisie": "netherlands2",
    "liga-portugal": "portugal", "liga-portugal-2": "portugal2",
    "brazilian-serie-a": "brazil", "mls": "mls",
    "a-league": "australia", "premiership": "scotland",
    "scottish-championship": "scotland2", "super-lig": "turkey",
    "superliga": "denmark", "allsvenskan": "sweden",
    "eliteserien": "norway", "ekstraklasa": "poland",
    "jupiler-pro-league": "belgium", "bundesliga-aus": "austria",
    "super-league": "switzerland", "chance-liga": "czech",
}

def sf(text): return safe_float(text)
def safe_float(text):
    t = text.strip().replace("%","").replace(",","")
    if t in ("","-"): return None
    try: return float(t)
    except ValueError: return None

def scrape_league(league_slug: str):
    """Scrape /league/{slug} → per-team corners + Over hit rates."""
    url = f"{BASE}/league/{league_slug}"
    print(f"  [CV] {url}", file=sys.stderr)
    try:
        resp = requests.get(url, headers=HEADERS, timeout=30); resp.raise_for_status()
    except Exception as e:
        print(f"  [CV] ERROR: {e}", file=sys.stderr); return None

    soup = BeautifulSoup(resp.text, "lxml")
    title_el = soup.find("h1")
    league_name = title_el.get_text(strip=True) if title_el else league_slug

    # League avg FT
    avg_m = re.search(r"average of ([\d.]+) total corners", soup.get_text())
    league_avg = float(avg_m.group(1)) if avg_m else None

    text = soup.get_text(" ", strip=True)
    teams = []

    # Split by team stat blocks: "TeamName Average Corners FT"
    blocks = re.split(r'(?=[A-Z][a-z]+(?: [A-Z][a-z]+)*\s+Average Corners FT)', text)
    for block in blocks:
        if "Average Corners FT" not in block: continue
        tm = re.match(r'^(.+?)\s+Average Corners FT', block)
        if not tm: continue
        team_name = tm.group(1).strip()
        if len(team_name) > 40 or len(team_name) < 2: continue

        ft_v = re.search(r'Average Corners FT\s+([\d.]+)', block)
        fv = re.search(r'Average Corners For\s+([\d.]+)', block)
        av = re.search(r'Average Corners Against\s+([\d.]+)', block)

        entry = {
            "teamName": team_name,
            "avgCornersFT": sf(ft_v.group(1)) if ft_v else None,
            "avgCornersFor": sf(fv.group(1)) if fv else None,
            "avgCornersAgainst": sf(av.group(1)) if av else None,
            "hitRates": {},
        }

        for th in [6.5, 7.5, 8.5, 9.5, 10.5, 11.5]:
            ts = str(th).replace(".", "\\.")
            m = re.search(rf'Over\s+{ts}\s+(\d+)\s*%\s*(\d+)\s*/\s*(\d+)', block)
            if m:
                entry["hitRates"][f"over{str(th).replace('.','_')}"] = {
                    "pct": int(m.group(1)), "hit": int(m.group(2)), "total": int(m.group(3))}

        teams.append(entry)

    print(f"  [CV] {len(teams)} teams, avg FT={league_avg}", file=sys.stderr)
    return {
        "meta": {"schemaVersion": 1, "leagueName": league_name, "leagueSlug": league_slug,
                 "leagueAvgFT": league_avg,
                 "lastUpdated": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
                 "source": "cornervalue.com"},
        "teams": teams,
    }


def main():
    p = argparse.ArgumentParser(description="Cornervalue scraper")
    p.add_argument("--league", type=str)
    p.add_argument("--all", action="store_true")
    p.add_argument("--output-dir", type=str, default="public/data/metrics")
    args = p.parse_args()
    os.makedirs(args.output_dir, exist_ok=True)

    if args.league:
        data = scrape_league(args.league)
        if data:
            slug = LEAGUE_SLUGS.get(args.league, args.league)
            fpath = os.path.join(args.output_dir, f"cornervalue_{slug}.json")
            with open(fpath, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            print(f"  -> {fpath}", file=sys.stderr)

    elif args.all:
        for cv_slug in LEAGUE_SLUGS:
            data = scrape_league(cv_slug)
            if data:
                slug = LEAGUE_SLUGS[cv_slug]
                fpath = os.path.join(args.output_dir, f"cornervalue_{slug}.json")
                with open(fpath, "w", encoding="utf-8") as f:
                    json.dump(data, f, indent=2, ensure_ascii=False)
            time.sleep(1)

    print("Done", file=sys.stderr)


if __name__ == "__main__":
    main()
