#!/usr/bin/env python3
"""
scrape_rankings.py — Pipeline production Home/Away depuis soccerstats.com.
Scrape homeaway.asp?league={slug} pour 12+ ligues, normalise noms via
team_name_mapping.py, calcule rangs, genere /public/data/rankings/{id}.json.

USAGE:
    python scripts/scrape_rankings.py --all --output-dir public/data/rankings
    python scripts/scrape_rankings.py --league england --output-dir public/data/rankings
"""

import sys, os, json, argparse, re, time
from datetime import datetime, timezone
from typing import Optional, Dict, List, Any

try:
    import requests
    from bs4 import BeautifulSoup, Tag
    from tenacity import retry, stop_after_attempt, wait_exponential
except ImportError as e:
    print(json.dumps({"error":"Deps missing",
          "install":"pip install -r scripts/requirements-rankings.txt",
          "detail":str(e)}), file=sys.stderr)
    sys.exit(1)

try: from team_name_mapping import TEAM_NAME_OVERRIDES
except ImportError: TEAM_NAME_OVERRIDES = {}

HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
           "Accept": "text/html,application/xhtml+xml"}

LEAGUES = {
    "england":     ("https://www.soccerstats.com/homeaway.asp?league=england",     "epl"),
    "england2":    ("https://www.soccerstats.com/homeaway.asp?league=england2",    "championship"),
    "france":      ("https://www.soccerstats.com/homeaway.asp?league=france",      "ligue1"),
    "france2":     ("https://www.soccerstats.com/homeaway.asp?league=france2",     "ligue2"),
    "spain":       ("https://www.soccerstats.com/homeaway.asp?league=spain",       "laliga"),
    "spain2":      ("https://www.soccerstats.com/homeaway.asp?league=spain2",      "laliga2"),
    "germany":     ("https://www.soccerstats.com/homeaway.asp?league=germany",     "bundesliga"),
    "germany2":    ("https://www.soccerstats.com/homeaway.asp?league=germany2",    "bundesliga2"),
    "italy":       ("https://www.soccerstats.com/homeaway.asp?league=italy",       "seriea"),
    "italy2":      ("https://www.soccerstats.com/homeaway.asp?league=italy2",      "serieb"),
    "netherlands": ("https://www.soccerstats.com/homeaway.asp?league=netherlands", "eredivisie"),
    "portugal":    ("https://www.soccerstats.com/homeaway.asp?league=portugal",    "primeira_liga"),
}



# ── Normalisation ──

def standardize_team_name(raw_name: str) -> str:
    name = re.sub(r"\s+", " ", raw_name.strip())
    key = name.lower().strip()
    if key in TEAM_NAME_OVERRIDES: return TEAM_NAME_OVERRIDES[key]
    return name.title()

# ── Parsing homeaway.asp (11 colonnes: rank,team,GP,W,D,L,GF,GA,GD,Pts,PPG) ──

def _parse_number(text: str) -> Optional[float]:
    t = text.strip().replace("%", "").replace(",", "")
    if t in ("", "-", "n/a", "N/A"): return None
    try: return float(t)
    except ValueError: return None

def _parse_homeaway_table(table: Tag) -> List[Dict[str, Any]]:
    rows = table.find_all("tr")
    if len(rows) < 3: return []
    header_idx = -1
    for i, tr in enumerate(rows[:3]):
        text = " ".join(td.get_text(strip=True) for td in tr.find_all(["td","th"]))
        if all(kw in text for kw in ["GP", "Pts", "PPG"]):
            header_idx = i; break
    if header_idx < 0: return []
    COL_MAP = {2:"gp",3:"w",4:"d",5:"l",6:"gf",7:"ga",8:"gd",9:"pts",10:"ppg"}
    results = []
    for tr in rows[header_idx + 1:]:
        cells = tr.find_all(["td","th"])
        if len(cells) < 8: continue
        tn = standardize_team_name(cells[1].get_text(strip=True))
        entry = {"teamName": tn}
        for col, key in COL_MAP.items():
            if col < len(cells):
                v = _parse_number(cells[col].get_text(strip=True))
                if v is not None: entry[key] = v
        if "gp" in entry: results.append(entry)
    return results

# ── Rangs ──

def assign_ranks(entries: List[Dict], mk: str, hb: bool) -> List[Dict]:
    valid = [e for e in entries if mk in e and e[mk] is not None]
    if not valid: return []
    valid.sort(key=lambda e: e[mk], reverse=hb)
    out, pv, pr = [], None, 0
    for i, e in enumerate(valid):
        v = e[mk]; r = pr if (pv is not None and v == pv) else i + 1
        pv, pr = v, r
        out.append({"rank":r,"teamId":"","teamName":e["teamName"],
                    "value":v,"played":int(e.get("gp",0))})
    return out

# ── HTTP avec retry ──

@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=30))
def _fetch_page(url: str) -> str:
    resp = requests.get(url, headers=HEADERS, timeout=30)
    resp.raise_for_status()
    resp.encoding = "utf-8"
    return resp.text



# ── Scrape d'une ligue ──

def scrape_league(slug: str, url: str, league_id: str) -> Optional[Dict]:
    print(f"[{slug}] Fetching...", file=sys.stderr)
    try: html = _fetch_page(url)
    except Exception as e:
        print(f"[{slug}] ERROR fetch: {e}", file=sys.stderr); return None

    soup = BeautifulSoup(html, "lxml")
    tables = soup.find_all("table")
    home_entries, away_entries = [], []

    for table in tables:
        prev = table.find_previous(["h2","h3","b","strong","div","font"])
        ctx = prev.get_text(strip=True).lower() if prev else ""
        if "home table" in ctx and "away" not in ctx:
            home_entries = _parse_homeaway_table(table)
        elif "away table" in ctx and "home" not in ctx:
            away_entries = _parse_homeaway_table(table)

    if not home_entries and not away_entries:
        print(f"[{slug}] ERROR: no data", file=sys.stderr); return None
    print(f"[{slug}] {len(home_entries)}H / {len(away_entries)}A", file=sys.stderr)

    METRICS = [
        ("ppg","PPG",True,"pts"),("pts","Points",True,"pts"),
        ("gf","Buts Marques",True,"buts"),("ga","Buts Encaisses",False,"buts"),
        ("gd","Diff. Buts",True,"buts"),("w","Victoires",True,"n"),
        ("d","Nuls",True,"n"),("l","Defaites",False,"n"),
    ]
    home_r, away_r, mdefs = {}, {}, {}
    for key, label, hb, unit in METRICS:
        mdefs[key] = {"label":label,"higherIsBetter":hb,"unit":unit}
        home_r[key] = assign_ranks(home_entries, key, hb)
        away_r[key] = assign_ranks(away_entries, key, hb)

    tc = max(len(set(e["teamName"] for e in home_entries)),
             len(set(e["teamName"] for e in away_entries)))
    st = "2025-26"
    sm = re.search(r"(\d{4})[-/](\d{2,4})", soup.get_text())
    if sm: st = f"{sm.group(1)}-{sm.group(2)}"

    return {
        "meta":{"schemaVersion":1,"leagueId":league_id,
                "leagueName":slug.replace("-"," ").title(),"season":st,
                "lastUpdated":datetime.now(timezone.utc).isoformat().replace("+00:00","Z"),
                "source":"soccerstats.com","teamCount":tc,"partial":tc<10},
        "home":home_r,"away":away_r,"metricDefs":mdefs,
    }



# ── Entry point ──

def main():
    parser = argparse.ArgumentParser(description="Production ranking scraper")
    parser.add_argument("--league", type=str)
    parser.add_argument("--all", action="store_true")
    parser.add_argument("--output-dir", type=str, default="public/data/rankings")
    parser.add_argument("--delay", type=float, default=2.0)
    args = parser.parse_args()

    if args.league:
        if args.league not in LEAGUES:
            print(f"Unknown: '{args.league}'", file=sys.stderr); sys.exit(1)
        targets = {args.league: LEAGUES[args.league]}
    elif args.all: targets = LEAGUES
    else: print("Use --all or --league <slug>", file=sys.stderr); sys.exit(1)

    os.makedirs(args.output_dir, exist_ok=True)
    ok, fail = 0, 0
    for slug, (url, lid) in targets.items():
        data = scrape_league(slug, url, lid)
        if data is None: fail += 1; continue
        fpath = os.path.join(args.output_dir, f"{lid}.json")
        with open(fpath, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        print(f"  -> {fpath}", file=sys.stderr); ok += 1
        if slug != list(targets.keys())[-1]: time.sleep(args.delay)
    print(f"\nDone: {ok} OK, {fail} failed", file=sys.stderr)
    sys.exit(0 if fail == 0 else 1)

if __name__ == "__main__":
    main()
