#!/usr/bin/env python3
"""
scrape_rankings_poc.py — PoC d'extraction et classement Home/Away
depuis soccerstats.com (1 ligue exemple : Premier League).

USAGE:
    python scripts/scrape_rankings_poc.py
    python scripts/scrape_rankings_poc.py --league england --output-dir public/data/rankings

OUTPUT: JSON stdout (ou fichier) contenant { meta, home, away, metricDefs }.
Installer: pip install requests beautifulsoup4 lxml
"""

import sys, os, json, argparse, re, unicodedata
from datetime import datetime, timezone
from typing import Optional, Dict, List, Any, Tuple

# ── Dépendances ──
try:
    import requests
    from bs4 import BeautifulSoup, Tag
except ImportError as e:
    print(json.dumps({"error": "Dépendances manquantes",
          "install": "pip install requests beautifulsoup4 lxml",
          "detail": str(e)}), file=sys.stderr)
    sys.exit(1)

# ── Configuration ──
LEAGUE_PAGES: Dict[str, str] = {
    "england":     "https://www.soccerstats.com/homeaway.asp?league=england",
    "england2":    "https://www.soccerstats.com/homeaway.asp?league=england2",
    "france":      "https://www.soccerstats.com/homeaway.asp?league=france",
    "spain":       "https://www.soccerstats.com/homeaway.asp?league=spain",
    "germany":     "https://www.soccerstats.com/homeaway.asp?league=germany",
    "italy":       "https://www.soccerstats.com/homeaway.asp?league=italy",
    "netherlands": "https://www.soccerstats.com/homeaway.asp?league=netherlands",
    "portugal":    "https://www.soccerstats.com/homeaway.asp?league=portugal",
}

LEAGUE_ID_MAP: Dict[str, str] = {
    "england": "epl", "england2": "championship", "france": "ligue1",
    "spain": "laliga", "germany": "bundesliga", "italy": "seriea",
    "netherlands": "eredivisie", "portugal": "primeira_liga",
}

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "text/html,application/xhtml+xml",
}



# ── Normalisation des noms d'équipes (portage Python de normalizeTeamName.ts) ──

def normalize_team_name(name: str) -> str:
    s = (name or "").strip().lower()
    s = unicodedata.normalize("NFD", s)
    s = re.sub(r"[\u0300-\u036f]", "", s)
    s = re.sub(r"\b(fc|cf|ac|ssc|sc|if|ik|kf|ff|afc|asd|cd|club|united|utd|city|sk|ifk|bk|fk|il|tf|vfl|sv|gs|rb|tsg|vfb)\b", "", s)
    s = re.sub(r"[^a-z0-9]", "", s)
    return s.strip()

TEAM_NAME_OVERRIDES: Dict[str, str] = {
    "manchester utd": "Manchester United", "manchester city": "Manchester City",
    "wolverhampton": "Wolves", "sheffield utd": "Sheffield United",
    "west brom": "West Bromwich Albion", "bodø / glimt": "Bodo Glimt",
    "paris saint-germain": "Paris SG", "borussia m'gladbach": "Borussia Monchengladbach",
    "inter": "Inter Milan", "atletico madrid": "Atletico Madrid",
    "athletic bilbao": "Athletic Bilbao", "real sociedad": "Real Sociedad",
    "aston villa": "Aston Villa", "newcastle": "Newcastle United",
    "nottingham forest": "Nottingham Forest", "leicester city": "Leicester",
    "leeds united": "Leeds", "crystal palace": "Crystal Palace",
}

def standardize_team_name(raw_name: str) -> str:
    name = re.sub(r"\s+", " ", raw_name.strip())
    key = name.lower().strip()
    if key in TEAM_NAME_OVERRIDES:
        return TEAM_NAME_OVERRIDES[key]
    return name.title()



# ── Parsing HTML ──

def _parse_number(text: str) -> Optional[float]:
    t = text.strip().replace("%", "").replace(",", "")
    if t in ("", "-", "n/a", "N/A"):
        return None
    try: return float(t)
    except ValueError: return None

def _extract_header_indices(headers: List[str]) -> Dict[str, int]:
    aliases = {
        "team": ["team", "équipe", "club", "squad"],
        "gp": ["gp", "mp", "pld", "played"], "pts": ["pts", "points", "p"],
        "ppg": ["ppg"], "gf": ["gf", "goals for", "f", "+", "gs", "scored"],
        "ga": ["ga", "goals against", "a", "-", "gc", "conceded"],
        "gd": ["gd", "goal diff", "+/-", "diff"],
        "shots_pg": ["shots pg", "shots/g", "shots", "sh"],
        "sot_pg": ["sot pg", "sot/g", "shots on target", "sot"],
        "attacks_pg": ["attacks pg", "dang attacks", "dangerous attacks", "att"],
        "corners_pg": ["corners pg", "corners/g", "corners", "crn"],
        "over55": ["over 5.5", "+5.5", ">5.5"],
        "over65": ["over 6.5", "+6.5", ">6.5"],
        "over75": ["over 7.5", "+7.5", ">7.5"],
        "over85": ["over 8.5", "+8.5", ">8.5"],
        "over95": ["over 9.5", "+9.5", ">9.5"],
        "over105": ["over 10.5", "+10.5", ">10.5"],
    }
    mapping: Dict[str, int] = {}
    for i, h in enumerate(headers):
        h_lower = h.strip().lower()
        for key, candidates in aliases.items():
            if any(c in h_lower for c in candidates):
                mapping[key] = i
                break
    return mapping

def _parse_table_rows(table: Tag) -> List[Dict[str, Any]]:
    rows = table.find_all("tr")
    if len(rows) < 2: return []
    header_row, data_rows = None, []
    for tr in rows:
        classes = tr.get("class", [])
        if "hed" in classes: header_row = tr
        elif "odd" in classes or "even" in classes: data_rows.append(tr)
    if not header_row or not data_rows: return []
    hlist = [td.get_text(strip=True) for td in header_row.find_all("td")]
    idx_map = _extract_header_indices(hlist)
    results: List[Dict[str, Any]] = []
    for tr in data_rows:
        cells = tr.find_all("td")
        if len(cells) < 3: continue
        ti = idx_map.get("team", 1 if len(cells) > 1 else 0)
        rn = cells[ti].get_text(strip=True) if ti < len(cells) else ""
        entry: Dict[str, Any] = {"teamName": standardize_team_name(rn)}
        for key in ["gp","pts","ppg","gf","ga","gd","shots_pg","sot_pg",
                     "attacks_pg","corners_pg","over55","over65","over75",
                     "over85","over95","over105"]:
            if key in idx_map:
                val = _parse_number(cells[idx_map[key]].get_text(strip=True))
                if val is not None: entry[key] = val
        if "gp" in entry and entry["gp"] > 0:
            results.append(entry)
    return results



# ── Attribution des rangs ──

def assign_ranks(entries: List[Dict], metric_key: str, higher_better: bool) -> List[Dict]:
    valid = [e for e in entries if metric_key in e and e[metric_key] is not None]
    if not valid: return []
    valid.sort(key=lambda e: e[metric_key], reverse=higher_better)
    result, prev_val, prev_rank = [], None, 0
    for i, entry in enumerate(valid):
        val = entry[metric_key]
        rank = prev_rank if (prev_val is not None and val == prev_val) else i + 1
        prev_val, prev_rank = val, rank
        result.append({"rank": rank, "teamId": "", "teamName": entry["teamName"],
                       "value": val, "played": int(entry.get("gp", 0))})
    return result


# ── Fonction principale de scraping ──

def scrape_league(league_slug: str, url: str) -> Optional[Dict[str, Any]]:
    league_id = LEAGUE_ID_MAP.get(league_slug, league_slug)
    print(f"[scrape] Fetching {league_slug} ...", file=sys.stderr)
    resp = requests.get(url, headers=HEADERS, timeout=30)
    resp.raise_for_status()
    resp.encoding = "utf-8"
    soup = BeautifulSoup(resp.text, "lxml")
    tables = soup.find_all("table", class_="tbl")
    if not tables:
        print(f"[scrape] WARNING: No 'tbl' tables for {league_slug}", file=sys.stderr)
        return None

    home_entries, away_entries = [], []
    current_context = None
    for table in tables:
        prev = table.find_previous(["h2", "h3", "b", "strong", "div"])
        if prev:
            pt = prev.get_text(strip=True).lower()
            if "home" in pt and "away" not in pt: current_context = "home"
            elif "away" in pt and "home" not in pt: current_context = "away"
        rows = _parse_table_rows(table)
        if not rows: continue
        if current_context == "home": home_entries.extend(rows)
        elif current_context == "away": away_entries.extend(rows)
        else:
            if not home_entries and len(rows) > 5: home_entries, current_context = rows, "home"
            elif home_entries and not away_entries and len(rows) > 5: away_entries = rows

    if not home_entries and not away_entries:
        print(f"[scrape] ERROR: No data for {league_slug}", file=sys.stderr)
        return None

    print(f"[scrape] {league_slug}: {len(home_entries)}H / {len(away_entries)}A",
          file=sys.stderr)

    METRICS = [
        ("ppg", "PPG", True, "pts"), ("pts", "Points", True, "pts"),
        ("gf", "Buts Marqués", True, "buts"), ("ga", "Buts Encaissés", False, "buts"),
        ("gd", "Diff. Buts", True, "buts"), ("shots_pg", "Tirs/Match", True, "/match"),
        ("sot_pg", "Tirs Cadrés/Match", True, "/match"),
        ("attacks_pg", "Attaques Dang./Match", True, "/match"),
        ("corners_pg", "Corners/Match", True, "/match"),
        ("over55", "% Over 5.5 Corners", True, "%"),
        ("over65", "% Over 6.5 Corners", True, "%"),
        ("over75", "% Over 7.5 Corners", True, "%"),
        ("over85", "% Over 8.5 Corners", True, "%"),
        ("over95", "% Over 9.5 Corners", True, "%"),
        ("over105", "% Over 10.5 Corners", True, "%"),
    ]

    home_r, away_r, mdefs = {}, {}, {}
    for key, label, hb, unit in METRICS:
        mdefs[key] = {"label": label, "higherIsBetter": hb, "unit": unit}
        home_r[key] = assign_ranks(home_entries, key, hb)
        away_r[key] = assign_ranks(away_entries, key, hb)

    tc = max(len(set(e["teamName"] for e in home_entries)),
             len(set(e["teamName"] for e in away_entries)))
    st = "2025-26"
    sm = re.search(r"(\d{4})[-/](\d{2,4})", soup.get_text())
    if sm: st = f"{sm.group(1)}-{sm.group(2)}"

    return {
        "meta": {"schemaVersion": 1, "leagueId": league_id,
                 "leagueName": league_slug.replace("-"," ").title(),
                 "season": st,
                 "lastUpdated": datetime.now(timezone.utc).isoformat().replace("+00:00","Z"),
                 "source": "soccerstats.com", "teamCount": tc, "partial": tc < 10},
        "home": home_r, "away": away_r, "metricDefs": mdefs,
    }



# ── Entry point ──

def main():
    parser = argparse.ArgumentParser(
        description="PoC: scrape rankings Home/Away depuis soccerstats.com")
    parser.add_argument("--league", type=str, default="england",
                        help="League slug (default: england)")
    parser.add_argument("--output-dir", type=str, default=None)
    parser.add_argument("--list-leagues", action="store_true")
    args = parser.parse_args()

    if args.list_leagues:
        print("Available leagues:")
        for slug, url in LEAGUE_PAGES.items():
            print(f"  {slug:15s} -> {LEAGUE_ID_MAP.get(slug, '?')}  ({url})")
        return

    if args.league not in LEAGUE_PAGES:
        print(f"Unknown: '{args.league}'. Options: {list(LEAGUE_PAGES.keys())}",
              file=sys.stderr)
        sys.exit(1)

    data = scrape_league(args.league, LEAGUE_PAGES[args.league])
    if data is None:
        print("ERROR: Scraping failed", file=sys.stderr)
        sys.exit(1)

    output_json = json.dumps(data, indent=2, ensure_ascii=False)
    if args.output_dir:
        os.makedirs(args.output_dir, exist_ok=True)
        lid = LEAGUE_ID_MAP.get(args.league, args.league)
        fpath = os.path.join(args.output_dir, f"{lid}.json")
        with open(fpath, "w", encoding="utf-8") as f:
            f.write(output_json)
        print(f"[scrape] OK → {fpath}", file=sys.stderr)
    else:
        print(output_json)

if __name__ == "__main__":
    main()
