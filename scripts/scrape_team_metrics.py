#!/usr/bin/env python3
"""
scrape_team_metrics.py — Pipeline enrichissement metrics (Shots, SoT, Corners).

Sources : FBref (tirs/SoT), Soccerstats (corners).
Genere : public/data/metrics/{league_slug}.json
Format aligne sur TeamMetricStats TypeScript.

USAGE:
    python scripts/scrape_team_metrics.py --all --output-dir public/data/metrics
    python scripts/scrape_team_metrics.py --league england --output-dir public/data/metrics
"""

import sys, os, json, argparse, re, time
from datetime import datetime, timezone
from typing import Optional, Dict, List, Any

try:
    import requests
    from bs4 import BeautifulSoup, Tag
    from tenacity import retry, stop_after_attempt, wait_exponential
except ImportError as e:
    print(f"MISSING DEPS: {e}. Run: pip install -r scripts/requirements-rankings.txt", file=sys.stderr)
    sys.exit(1)

try:
    from team_name_mapping import TEAM_NAME_OVERRIDES
except ImportError:
    TEAM_NAME_OVERRIDES = {}

# ── Config ──────────────────────────────────────────────────────────────────

HEADERS_FBREF = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9,fr;q=0.8",
    "Referer": "https://www.google.com/",
    "DNT": "1",
}

HEADERS_SST = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "text/html,application/xhtml+xml",
}

# Mapping complet des ligues soccerstats (slugs decouverts 2026-08-09).
# Format: slug → { "ss": slug_soccerstats, "ss_hist": slug_saison_histo, "name": nom_affiche }
# ss_hist = None pour les ligues dont la saison courante est la seule dispo.

LEAGUES = {
    # ── Europe T1 ──
    "england":     {"ss": "england",     "ss_hist": "england_2026",   "name": "Premier League"},
    "spain":       {"ss": "spain",       "ss_hist": "spain_2026",      "name": "La Liga"},
    "france":      {"ss": "france",      "ss_hist": "france_2026",     "name": "Ligue 1"},
    "germany":     {"ss": "germany",     "ss_hist": "germany_2026",    "name": "Bundesliga"},
    "italy":       {"ss": "italy",       "ss_hist": "italy_2026",      "name": "Serie A"},
    "portugal":    {"ss": "portugal",    "ss_hist": "portugal_2026",   "name": "Primeira Liga"},
    "netherlands": {"ss": "netherlands", "ss_hist": "netherlands_2026","name": "Eredivisie"},
    # ── Europe T2 ──
    "england2":    {"ss": "england2",    "ss_hist": "england2_2026",   "name": "Championship"},
    "spain2":      {"ss": "spain2",      "ss_hist": "spain2_2026",     "name": "La Liga 2"},
    "france2":     {"ss": "france2",     "ss_hist": "france2_2026",    "name": "Ligue 2"},
    "germany2":    {"ss": "germany2",    "ss_hist": "germany2_2026",   "name": "2. Bundesliga"},
    "italy2":      {"ss": "italy2",      "ss_hist": "italy2_2026",     "name": "Serie B"},
    "portugal2":   {"ss": "portugal2",   "ss_hist": "portugal2_2026",  "name": "Liga Portugal 2"},
    "netherlands2":{"ss": "netherlands2","ss_hist": "netherlands2_2026","name": "Eerste Divisie"},
    # ── Europe autres T1 ──
    "scotland":    {"ss": "scotland",    "ss_hist": "scotland_2026",   "name": "Premiership (SCO)"},
    "belgium":     {"ss": "belgium",     "ss_hist": None,              "name": "Pro League (BEL)"},
    "turkey":      {"ss": "turkey",      "ss_hist": "turkey_2026",     "name": "Super Lig (TUR)"},
    "greece":      {"ss": "greece",      "ss_hist": None,              "name": "Super League (GRE)"},
    "austria":     {"ss": "austria",     "ss_hist": None,              "name": "Bundesliga (AUT)"},
    "switzerland": {"ss": "switzerland", "ss_hist": "switzerland_2026","name": "Super League (SUI)"},
    "poland":      {"ss": "poland",      "ss_hist": None,              "name": "Ekstraklasa (POL)"},
    "czech":       {"ss": "czech",       "ss_hist": None,              "name": "1. Liga (CZE)"},
    "denmark":     {"ss": "denmark",     "ss_hist": None,              "name": "Superliga (DEN)"},
    "sweden":      {"ss": "sweden",      "ss_hist": None,              "name": "Allsvenskan (SWE)"},
    "norway":      {"ss": "norway",      "ss_hist": None,              "name": "Eliteserien (NOR)"},
    "finland":     {"ss": "finland",     "ss_hist": None,              "name": "Veikkausliiga (FIN)"},
    "ukraine":     {"ss": "ukraine",     "ss_hist": None,              "name": "Premier Liga (UKR)"},
    "russia":      {"ss": "russia",      "ss_hist": None,              "name": "Premier Liga (RUS)"},
    # ── Amériques ──
    "brazil":      {"ss": "brazil",      "ss_hist": None,              "name": "Serie A (BRA)"},
    "argentina":   {"ss": "argentina",   "ss_hist": None,              "name": "Liga Profesional (ARG)"},
    "brazil2":     {"ss": "brazil2",     "ss_hist": None,              "name": "Serie B (BRA)"},
    # ── Asie ──
    "japan":       {"ss": "japan",       "ss_hist": None,              "name": "J1 League (JPN)"},
    "southkorea":  {"ss": "southkorea",  "ss_hist": None,              "name": "K League 1 (KOR)"},
    "australia":   {"ss": "australia",   "ss_hist": None,              "name": "A-League (AUS)"},
}

FBREF_BASE = "https://fbref.com"
SST_BASE   = "https://www.soccerstats.com"

# ── Helpers ─────────────────────────────────────────────────────────────────

def std_name(raw: str) -> str:
    name = re.sub(r"\s+", " ", raw.strip())
    key = name.lower().strip()
    return TEAM_NAME_OVERRIDES.get(key, name.title())

def safe_float(text: str) -> Optional[float]:
    t = text.strip().replace("%", "").replace(",", "")
    if t in ("", "-", "n/a", "N/A"):
        return None
    try:
        return float(t)
    except ValueError:
        return None

# ── FBref: Shooting stats ──────────────────────────────────────────────────

@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
def _fetch_fbref(url: str) -> str:
    resp = requests.get(url, headers=HEADERS_FBREF, timeout=30)
    resp.raise_for_status()
    return resp.text


def _find_column_idx(header_row: Tag, *patterns: str) -> Optional[int]:
    """Trouve l'index d'une colonne dans une rangee d'en-tetes."""
    ths = header_row.find_all("th")
    for i, th in enumerate(ths):
        txt = th.get_text(strip=True).lower()
        for pat in patterns:
            if pat in txt:
                return i
    return None


def scrape_fbref_shooting(comp_id: int, league_name: str) -> Dict[str, Dict]:
    """FBref shooting table → { teamName: { shots_pg, sot_pg } }"""
    slug = league_name.replace(" ", "-")
    url = f"{FBREF_BASE}/en/comps/{comp_id}/shooting/{slug}-Shooting"
    print(f"  [FBref:shooting] {url}", file=sys.stderr)

    try:
        html = _fetch_fbref(url)
    except Exception as e:
        print(f"  [FBref:shooting] ERROR: {e}", file=sys.stderr)
        return {}

    soup = BeautifulSoup(html, "lxml")
    table = soup.find("table", id="stats_shooting")
    if not table:
        table = soup.find("table", id=lambda x: x and "shooting" in (x or ""))

    if not table:
        print("  [FBref:shooting] No table found", file=sys.stderr)
        return {}

    rows = table.find_all("tr")
    header = None
    for tr in rows:
        if tr.find_all("th") and any(kw in " ".join(th.get_text(strip=True).lower()
                for th in tr.find_all("th")) for kw in ["sot", "shots"]):
            header = tr
            break

    if not header:
        print("  [FBref:shooting] No header", file=sys.stderr)
        return {}

    sot_idx = _find_column_idx(header, "sot/90", "sot")
    shots_idx = _find_column_idx(header, "sh/90", "shots")
    name_idx = _find_column_idx(header, "squad", "player") or 0




# ── Soccerstats: Goal stats per team (trends.asp) ──────────────────────────

def scrape_sst_goal_stats(ss_hist_slug: str) -> Dict[str, Dict]:
    """
    Scrape soccerstats trends.asp (saison historique) → goal stats par equipe.
    URL: trends.asp?league={slug}_2026
    Colonnes: GP, Avg, 0.5+, 1.5+, 2.5+, 3.5+, 4.5+, 5.5+, BTS, CS, FTS, WTN, LTN
    Retourne { teamName: { avg_goals_pg, btts_pct, cs_pct, over25_pct, ... } }
    """
    url = f"{SST_BASE}/trends.asp?league={ss_hist_slug}"
    print(f"  [SST:trends] {url}", file=sys.stderr)

    try:
        resp = requests.get(url, headers=HEADERS_SST, timeout=30)
        resp.raise_for_status()
        html = resp.text
    except Exception as e:
        print(f"  [SST:trends] ERROR: {e}", file=sys.stderr)
        return {}

    soup = BeautifulSoup(html, "lxml")
    tables = soup.find_all("table")
    results = {}

    for table in tables:
        rows = table.find_all("tr")
        if len(rows) < 3:
            continue

        # Detecter table de stats d'equipe par header
        header_cells = rows[0].find_all(["td", "th"])
        header_text = " ".join(c.get_text(strip=True).lower() for c in header_cells)

        # Cherche les colonnes cles: GP, Avg, BTS
        has_gp = "gp" in header_text
        has_avg = "avg" in header_text
        has_bts = "bts" in header_text

        if not (has_gp and (has_avg or has_bts)):
            continue

        # Mapper les colonnes par leur texte exact
        col_map = {}
        for i, c in enumerate(header_cells):
            txt = c.get_text(strip=True).lower().replace(".", "")
            if txt == "gp":
                col_map["gp"] = i
            elif txt == "avg":
                col_map["avg"] = i
            elif "05" in txt or "0.5" in txt or "05+" in txt or "0.5+" in txt:
                col_map["over05"] = i
            elif "15" in txt or "1.5" in txt:
                col_map["over15"] = i
            elif "25" in txt or "2.5" in txt:
                col_map["over25"] = i
            elif "35" in txt or "3.5" in txt:
                col_map["over35"] = i
            elif "45" in txt or "4.5" in txt:
                pass  # over45, skip
            elif "55" in txt or "5.5" in txt:
                pass  # over55, skip
            elif txt == "bts" or txt == "btts":
                col_map["btts"] = i
            elif txt == "cs":
                col_map["cs"] = i

        # Parcourir les lignes de donnees
        for tr in rows[1:]:
            cells = tr.find_all(["td", "th"])
            if len(cells) < 3:
                continue

            # Le nom d'equipe est generalement la 1ere ou 2eme colonne
            name_idx = 0 if "gp" not in (cells[0].get_text(strip=True).lower() if len(cells) > 0 else "") else 1
            try:
                team = std_name(cells[name_idx].get_text(strip=True))
            except IndexError:
                continue

            if not team or team.lower() in ("team", "squad", "league average", ""):
                continue
            if re.match(r"^[\d.]+$", team):
                continue

            entry = {}
            for key, idx in col_map.items():
                if idx < len(cells):
                    val = safe_float(cells[idx].get_text())
                    if val is not None:
                        if key in ("btts", "cs", "over25", "over15", "over35"):
                            # Ces colonnes sont en % dans la table
                            entry[key] = val if val <= 100 else val / 100.0
                        elif key == "avg":
                            entry["avg_goals_pg"] = val
                        elif key == "gp":
                            entry["gp"] = int(val) if val == int(val) else None

            if any(v is not None for v in entry.values()):
                results[team] = entry

    print(f"  [SST:trends] {len(results)} teams with goal stats", file=sys.stderr)
    return results

# -- Merge & Build --

def merge_team_metrics(goal_stats):
    """Transforme les stats soccerstats en metriques standardisees."""
    merged = {}
    for team, data in goal_stats.items():
        entry = {
            "shots_pg": None, "sot_pg": None, "corners_pg": None,
            "avg_goals_pg": data.get("avg_goals_pg"),
            "btts_pct": data.get("btts"), "cs_pct": data.get("cs"),
            "over25_pct": data.get("over25"), "over15_pct": data.get("over15"),
            "over35_pct": data.get("over35"), "gp": data.get("gp"),
        }
        if any(v is not None for v in entry.values()):
            merged[team] = entry
    return merged


def build_output(scrape_slug, league_name, team_metrics):
    total = len(team_metrics)
    teams = []
    rank = 1
    for team_name in sorted(team_metrics.keys()):
        data = team_metrics[team_name]
        teams.append({
            "teamName": team_name, "rank": rank, "rankTotal": total,
            "gp": data.get("gp"),
            "shots": {
                "for": {"value": data.get("shots_pg"), "rank": None, "rankTotal": total},
                "against": {"value": None, "rank": None, "rankTotal": total},
                "total": {"value": None, "rank": None, "rankTotal": total},
            },
            "sot": {
                "for": {"value": data.get("sot_pg"), "rank": None, "rankTotal": total},
                "against": {"value": None, "rank": None, "rankTotal": total},
                "total": {"value": None, "rank": None, "rankTotal": total},
            },
            "corners": {
                "total": {"value": data.get("corners_pg"), "rank": None, "rankTotal": total},
                "over55": {"value": None, "rank": None, "rankTotal": total},
                "over65": {"value": None, "rank": None, "rankTotal": total},
                "over75": {"value": None, "rank": None, "rankTotal": total},
                "over85": {"value": None, "rank": None, "rankTotal": total},
                "over95": {"value": None, "rank": None, "rankTotal": total},
                "over105": {"value": None, "rank": None, "rankTotal": total},
            },
            "goals": {
                "avgGoalsPg": data.get("avg_goals_pg"),
                "bttsPct": data.get("btts_pct"),
                "csPct": data.get("cs_pct"),
                "over25Pct": data.get("over25_pct"),
                "over15Pct": data.get("over15_pct"),
                "over35Pct": data.get("over35_pct"),
            },
        })
        rank += 1
    return {
        "meta": {
            "schemaVersion": 1, "leagueId": scrape_slug, "leagueName": league_name,
            "lastUpdated": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "sources": ["soccerstats.com"], "teamCount": total, "partial": total < 5,
        },
        "teams": teams,
    }


# -- Per-league --

def scrape_league(league_slug, config):
    print(f"\n[{league_slug}] {'='*40}", file=sys.stderr)
    hist = config.get("ss_hist") or config["ss"]
    goal_stats = scrape_sst_goal_stats(hist)
    metrics = merge_team_metrics(goal_stats)
    if not metrics:
        print(f"[{league_slug}] WARNING: no data", file=sys.stderr)
        return None
    out = build_output(league_slug, config["name"], metrics)
    print(f"[{league_slug}] {len(metrics)} teams with goal stats", file=sys.stderr)
    return out

def main():
    parser = argparse.ArgumentParser(description="Team metrics scraper (FBref + Soccerstats)")
    parser.add_argument("--league", type=str)
    parser.add_argument("--all", action="store_true")
    parser.add_argument("--output-dir", type=str, default="public/data/metrics")
    parser.add_argument("--delay", type=float, default=3.0)
    args = parser.parse_args()

    if args.league:
        if args.league not in LEAGUES:
            print(f"Unknown: '{args.league}'\nAvailable: {list(LEAGUES.keys())}", file=sys.stderr)
            sys.exit(1)
        targets = {args.league: LEAGUES[args.league]}
    elif args.all:
        targets = LEAGUES
    else:
        print("Use --all or --league <slug>", file=sys.stderr)
        sys.exit(1)

    os.makedirs(args.output_dir, exist_ok=True)
    ok, fail = 0, 0

    for slug, cfg in targets.items():
        data = scrape_league(slug, cfg)
        if data is None:
            fail += 1
            continue
        fpath = os.path.join(args.output_dir, f"{slug}.json")
        with open(fpath, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        print(f"  -> {fpath}", file=sys.stderr)
        ok += 1
        if slug != list(targets.keys())[-1]:
            time.sleep(args.delay)

    print(f"\nDone: {ok} OK, {fail} failed", file=sys.stderr)
    sys.exit(0 if fail == 0 else 1)


if __name__ == "__main__":
    main()
