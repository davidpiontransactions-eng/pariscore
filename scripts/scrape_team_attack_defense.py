#!/usr/bin/env python3
"""
scrape_team_attack_defense.py — Pipeline Attack/Defense team stats.
Sources : FBref (standard, shooting, keeper, misc) + Understat (xG for Big 5).
Genere : public/data/metrics/team_stats_{slug}.json

USAGE:
    python scripts/scrape_team_attack_defense.py --all --output-dir public/data/metrics
    python scripts/scrape_team_attack_defense.py --league england --output-dir public/data/metrics
    python scripts/scrape_team_attack_defense.py --league england --season 2025-2026
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

FBREF_BASE = "https://fbref.com"
UNDERSTAT_BASE = "https://understat.com"

# Mapping: slug -> {comp_id, fbref_slug, us_league_name, us_slug}
# us_league_name/us_slug are None for non-Big-5 leagues (no Understat xG)
LEAGUES = {
    # ── Europe T1 (Big 5: Understat available) ──
    "england":     {"comp_id": 9,  "fbref_slug": "Premier-League",              "us_league_name": "EPL",        "us_slug": "EPL"},
    "spain":       {"comp_id": 12, "fbref_slug": "La-Liga",                     "us_league_name": "La Liga",    "us_slug": "La%20liga"},
    "france":      {"comp_id": 13, "fbref_slug": "Ligue-1",                     "us_league_name": "Ligue 1",    "us_slug": "Ligue 1"},
    "germany":     {"comp_id": 20, "fbref_slug": "Bundesliga",                  "us_league_name": "Bundesliga", "us_slug": "Bundesliga"},
    "italy":       {"comp_id": 11, "fbref_slug": "Serie-A",                     "us_league_name": "Serie A",    "us_slug": "Serie A"},
    # ── Europe T1 (non-Big-5) ──
    "portugal":    {"comp_id": 32, "fbref_slug": "Primeira-Liga",               "us_league_name": None,         "us_slug": None},
    "netherlands": {"comp_id": 23, "fbref_slug": "Eredivisie",                  "us_league_name": None,         "us_slug": None},
    # ── Europe T2 ──
    "england2":    {"comp_id": 10, "fbref_slug": "Championship",                "us_league_name": None,         "us_slug": None},
    "spain2":      {"comp_id": 17, "fbref_slug": "Segunda-Division",            "us_league_name": None,         "us_slug": None},
    "france2":     {"comp_id": 60, "fbref_slug": "Ligue-2",                     "us_league_name": None,         "us_slug": None},
    "germany2":    {"comp_id": 33, "fbref_slug": "2-Bundesliga",                "us_league_name": None,         "us_slug": None},
    "italy2":      {"comp_id": 18, "fbref_slug": "Serie-B",                     "us_league_name": None,         "us_slug": None},
    "portugal2":   {"comp_id": 72, "fbref_slug": "Liga-Portugal-2",             "us_league_name": None,         "us_slug": None},
    "netherlands2":{"comp_id": 73, "fbref_slug": "Eerste-Divisie",              "us_league_name": None,         "us_slug": None},
    # ── Europe autres T1 ──
    "scotland":    {"comp_id": 40, "fbref_slug": "Scottish-Premiership",        "us_league_name": None,         "us_slug": None},
    "belgium":     {"comp_id": 37, "fbref_slug": "Belgian-Pro-League",          "us_league_name": None,         "us_slug": None},
    "turkey":      {"comp_id": 26, "fbref_slug": "Super-Lig",                   "us_league_name": None,         "us_slug": None},
    "austria":     {"comp_id": 56, "fbref_slug": "Austrian-Bundesliga",         "us_league_name": None,         "us_slug": None},
    "switzerland": {"comp_id": 58, "fbref_slug": "Swiss-Super-League",          "us_league_name": None,         "us_slug": None},
    "poland":      {"comp_id": 65, "fbref_slug": "Ekstraklasa",                 "us_league_name": None,         "us_slug": None},
    "denmark":     {"comp_id": 50, "fbref_slug": "Danish-Superliga",            "us_league_name": None,         "us_slug": None},
    "sweden":      {"comp_id": 29, "fbref_slug": "Allsvenskan",                 "us_league_name": None,         "us_slug": None},
    "norway":      {"comp_id": 28, "fbref_slug": "Eliteserien",                 "us_league_name": None,         "us_slug": None},
    # ── Amériques ──
    "brazil":      {"comp_id": 24, "fbref_slug": "Serie-A",                     "us_league_name": None,         "us_slug": None},
    "argentina":   {"comp_id": 21, "fbref_slug": "Liga-Profesional-Argentina",  "us_league_name": None,         "us_slug": None},
    "mls":         {"comp_id": 22, "fbref_slug": "Major-League-Soccer",         "us_league_name": None,         "us_slug": None},
    # ── Asie/Océanie ──
    "japan":       {"comp_id": 41, "fbref_slug": "J1-League",                   "us_league_name": None,         "us_slug": None},
    "southkorea":  {"comp_id": 55, "fbref_slug": "K-League-1",                  "us_league_name": None,         "us_slug": None},
    "australia":   {"comp_id": 44, "fbref_slug": "A-League-Men",                "us_league_name": None,         "us_slug": None},
}

BIG_FIVE = {"england", "spain", "france", "germany", "italy"}

# ── Helpers ─────────────────────────────────────────────────────────────────

def current_season() -> str:
    """Auto-detecte la saison : 2026-2027 si mois >= juillet, sinon 2025-2026."""
    now = datetime.now()
    y1 = now.year
    if now.month >= 7:
        return f"{y1}-{y1 + 1}"
    return f"{y1 - 1}-{y1}"

def std_name(raw: str) -> str:
    """Normalise un nom d'equipe via TEAM_NAME_OVERRIDES."""
    name = re.sub(r"\s+", " ", raw.strip())
    key = name.lower().strip()
    return TEAM_NAME_OVERRIDES.get(key, name.title())

def safe_float(text: str) -> Optional[float]:
    """Convertit en float, retourne None si invalide."""
    t = text.strip().replace("%", "").replace(",", "")
    if t in ("", "-", "n/a", "N/A"):
        return None
    try:
        return float(t)
    except ValueError:
        return None

# ── FBref: Fetch ────────────────────────────────────────────────────────────

@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
def _fetch_fbref(url: str) -> str:
    """Fetch HTML depuis FBref avec retry."""
    resp = requests.get(url, headers=HEADERS_FBREF, timeout=30)
    resp.raise_for_status()
    return resp.text

# ── FBref: Table parser ─────────────────────────────────────────────────────

def parse_fbref_table(html: str, table_id: str) -> Dict[str, Dict[str, Optional[float]]]:
    """
    Parse une table HTML FBref et retourne {team_name: {header_name: value}}.
    Detecte automatiquement les headers et les lignes de donnees dans tbody.
    """
    soup = BeautifulSoup(html, "lxml")
    table = soup.find("table", id=table_id)
    if not table:
        return {}

    thead = table.find("thead")
    if not thead:
        return {}

    header_rows = thead.find_all("tr")
    if len(header_rows) < 1:
        return {}

    # La derniere rangee du thead contient les noms de colonnes reels
    header_row = header_rows[-1]
    ths = header_row.find_all("th")
    col_names = []
    for th in ths:
        txt = th.get_text(strip=True)
        aria = th.get("aria-label", "")
        data_stat = th.get("data-stat", "")
        if aria:
            col_names.append(aria)
        elif txt:
            col_names.append(txt)
        elif data_stat:
            col_names.append(data_stat)
        else:
            col_names.append("")

    tbody = table.find("tbody")
    if not tbody:
        return {}

    results: Dict[str, Dict[str, Optional[float]]] = {}
    for tr in tbody.find_all("tr"):
        if tr.get("class") and any(c in ("spacer", "thead", "partial_table") for c in tr.get("class", [])):
            continue

        th = tr.find("th")
        if not th:
            continue
        team_raw = th.get_text(strip=True)
        if not team_raw:
            continue

        team = std_name(team_raw)
        if team.lower() in ("", "squad", "player", "league average", "league table"):
            continue

        tds = tr.find_all("td")
        entry: Dict[str, Optional[float]] = {}
        for i, td in enumerate(tds):
            real_idx = i + 1
            if real_idx < len(col_names) and col_names[real_idx]:
                val = safe_float(td.get_text())
                entry[col_names[real_idx]] = val

        if entry:
            results[team] = entry
# ── FBref: Scrape des 4 tables par ligue ───────────────────────────────────

def _build_fbref_url(comp_id: int, fbref_slug: str, season: str, suffix: str) -> str:
    """Construit l'URL FBref pour une table donnee."""
    return f"{FBREF_BASE}/en/comps/{comp_id}/{season}/{suffix}/{season}-{fbref_slug}-Stats"

def scrape_fbref_standard(comp_id: int, fbref_slug: str, season: str) -> Dict[str, Dict[str, Optional[float]]]:
    """FBref standard stats -> {team: {Gls, MP, GA, ...}}"""
    url = _build_fbref_url(comp_id, fbref_slug, season, "stats")
    print(f"  [FBref:standard] {url}", file=sys.stderr)
    try:
        html = _fetch_fbref(url)
    except Exception as e:
        print(f"  [FBref:standard] ERROR: {e}", file=sys.stderr)
        return {}
    data = parse_fbref_table(html, "stats_standard")
    print(f"  [FBref:standard] {len(data)} teams", file=sys.stderr)
    return data

def scrape_fbref_shooting(comp_id: int, fbref_slug: str, season: str) -> Dict[str, Dict[str, Optional[float]]]:
    """FBref shooting stats -> {team: {Sh/90, Sh, ...}}"""
    url = _build_fbref_url(comp_id, fbref_slug, season, "shooting")
    print(f"  [FBref:shooting] {url}", file=sys.stderr)
    try:
        html = _fetch_fbref(url)
    except Exception as e:
        print(f"  [FBref:shooting] ERROR: {e}", file=sys.stderr)
        return {}
    data = parse_fbref_table(html, "stats_shooting")
    print(f"  [FBref:shooting] {len(data)} teams", file=sys.stderr)
    return data

def scrape_fbref_keeper(comp_id: int, fbref_slug: str, season: str) -> Dict[str, Dict[str, Optional[float]]]:
    """FBref keeper stats -> {team: {CS, CS%, ...}}"""
    url = _build_fbref_url(comp_id, fbref_slug, season, "keepers")
    print(f"  [FBref:keeper]   {url}", file=sys.stderr)
    try:
        html = _fetch_fbref(url)
    except Exception as e:
        print(f"  [FBref:keeper] ERROR: {e}", file=sys.stderr)
        return {}
    data = parse_fbref_table(html, "stats_keeper")
    print(f"  [FBref:keeper]   {len(data)} teams", file=sys.stderr)
    return data

def scrape_fbref_misc(comp_id: int, fbref_slug: str, season: str) -> Dict[str, Dict[str, Optional[float]]]:
    """FBref misc stats -> {team: {TklW, Tkl, Int, Clr, ...}}"""
    url = _build_fbref_url(comp_id, fbref_slug, season, "misc")
    print(f"  [FBref:misc]     {url}", file=sys.stderr)
    try:
        html = _fetch_fbref(url)
    except Exception as e:
        print(f"  [FBref:misc] ERROR: {e}", file=sys.stderr)
        return {}
    data = parse_fbref_table(html, "stats_misc")
    print(f"  [FBref:misc]     {len(data)} teams", file=sys.stderr)
    return data


# ── Understat: xG data (Big 5 only) ─────────────────────────────────────────

UNDERSTAT_NAME_MAP = {
    "Manchester City": "Manchester City", "Manchester Utd": "Manchester United",
    "Manchester United": "Manchester United", "Arsenal": "Arsenal",
    "Liverpool": "Liverpool", "Chelsea": "Chelsea", "Tottenham": "Tottenham",
    "Newcastle United": "Newcastle United", "Aston Villa": "Aston Villa",
    "Brighton": "Brighton", "West Ham": "West Ham",
    "Crystal Palace": "Crystal Palace", "Everton": "Everton",
    "Fulham": "Fulham", "Wolves": "Wolves", "Brentford": "Brentford",
    "Nottingham Forest": "Nottingham Forest", "Bournemouth": "Bournemouth",
    "Leicester": "Leicester", "Leicester City": "Leicester",
    "Southampton": "Southampton", "Ipswich Town": "Ipswich Town",
    "Leeds": "Leeds", "Burnley": "Burnley",
    "Sheffield United": "Sheffield United", "Luton": "Luton",
    "West Brom": "West Bromwich Albion", "West Bromwich Albion": "West Bromwich Albion",
    "Norwich": "Norwich", "Watford": "Watford",
    # Spain
    "Real Madrid": "Real Madrid", "Barcelona": "Barcelona",
    "Atletico Madrid": "Atletico Madrid", "Atlético Madrid": "Atletico Madrid",
    "Real Sociedad": "Real Sociedad", "Real Betis": "Real Betis",
    "Villarreal": "Villarreal", "Athletic Club": "Athletic Bilbao",
    "Athletic Bilbao": "Athletic Bilbao", "Sevilla": "Sevilla",
    "Valencia": "Valencia", "Osasuna": "Osasuna", "Getafe": "Getafe",
    "Celta Vigo": "Celta Vigo", "Rayo Vallecano": "Rayo Vallecano",
    "Girona": "Girona", "Mallorca": "Mallorca", "Alaves": "Alaves",
    "Las Palmas": "Las Palmas", "Espanyol": "Espanyol",
    "Valladolid": "Valladolid", "Leganes": "Leganes",
    "Almeria": "Almeria", "Cadiz": "Cadiz", "Elche": "Elche", "Granada": "Granada",
    # France
    "Paris Saint Germain": "Paris SG", "Paris Saint-Germain": "Paris SG",
    "Marseille": "Marseille", "Lyon": "Lyon", "Monaco": "Monaco",
    "Lille": "Lille", "Rennes": "Rennes", "Lens": "Lens", "Nice": "Nice",
    "Strasbourg": "Strasbourg", "Reims": "Reims", "Montpellier": "Montpellier",
    "Toulouse": "Toulouse", "Nantes": "Nantes", "Brest": "Brest",
    "Clermont": "Clermont", "Le Havre": "Le Havre", "Auxerre": "Auxerre",
    "Angers": "Angers", "Lorient": "Lorient", "Metz": "Metz",
    "Troyes": "Troyes", "Ajaccio": "Ajaccio",
    # Germany
    "Bayern Munich": "Bayern Munich", "Borussia Dortmund": "Borussia Dortmund",
    "RB Leipzig": "RB Leipzig", "Bayer Leverkusen": "Bayer Leverkusen",
    "Eintracht Frankfurt": "Eintracht Frankfurt",
    "Borussia M.Gladbach": "Borussia Monchengladbach",
    "Borussia M'gladbach": "Borussia Monchengladbach",
    "Hoffenheim": "Hoffenheim", "Stuttgart": "Stuttgart",
    "Wolfsburg": "Wolfsburg", "Freiburg": "Freiburg",
    "Union Berlin": "Union Berlin", "Mainz": "Mainz", "Augsburg": "Augsburg",
    "Werder Bremen": "Werder Bremen", "FC Koln": "FC Koln",
    "Hertha Berlin": "Hertha BSC", "Schalke 04": "Schalke 04",
    "Bochum": "VfL Bochum", "Heidenheim": "Heidenheim",
    "Darmstadt": "Darmstadt 98", "St. Pauli": "FC St. Pauli",
    "Holstein Kiel": "Holstein Kiel",
    # Italy
    "Inter": "Inter Milan", "AC Milan": "AC Milan", "Juventus": "Juventus",
    "Napoli": "Napoli", "Atalanta": "Atalanta", "Lazio": "Lazio",
    "Roma": "Roma", "Fiorentina": "Fiorentina", "Bologna": "Bologna",
    "Torino": "Torino", "Genoa": "Genoa", "Monza": "Monza",
    "Udinese": "Udinese", "Lecce": "Lecce", "Empoli": "Empoli",
    "Cagliari": "Cagliari", "Verona": "Verona", "Parma": "Parma",
    "Venezia": "Venezia", "Como": "Como", "Sassuolo": "Sassuolo",
    "Salernitana": "Salernitana", "Spezia": "Spezia", "Cremonese": "Cremonese",
    "Sampdoria": "Sampdoria", "Frosinone": "Frosinone",
}

def _map_understat_name(raw_name: str) -> str:
    """Mappe un nom Understat vers le nom canonique PariScore."""
    name = raw_name.strip()
    if name in UNDERSTAT_NAME_MAP:
        return UNDERSTAT_NAME_MAP[name]
    key = name.lower().strip()
    if key in TEAM_NAME_OVERRIDES:
        return TEAM_NAME_OVERRIDES[key]
    return name

def scrape_understat_xg(us_slug: str, season: str, league_slug: str) -> Dict[str, Dict[str, Optional[float]]]:
    """
    Fetch Understat JSON API pour les donnees xG.
    Retourne {team_canonical: {xG_total: float, xGA_total: float, MP_understat: int}}.
    """
    season_year = season.split("-")[1]
    url = f"{UNDERSTAT_BASE}/getLeagueData/{us_slug}/{season_year}"
    print(f"  [Understat:xG]   {url}", file=sys.stderr)

    try:
        resp = requests.get(url, headers=HEADERS_FBREF, timeout=30)
        resp.raise_for_status()
        raw = resp.text
        outer = json.loads(raw)
        if isinstance(outer, str):
            outer = json.loads(outer)
        teams_data = outer if isinstance(outer, list) else outer.get("data", outer.get("response", []))
        if isinstance(teams_data, dict):
            teams_data = list(teams_data.values())
    except Exception as e:
        print(f"  [Understat:xG] ERROR: {e}", file=sys.stderr)
        return {}

    results: Dict[str, Dict[str, Optional[float]]] = {}
    for entry in teams_data:
        if not isinstance(entry, dict):
            continue
        raw_name = entry.get("title", entry.get("name", ""))
        if not raw_name:
            continue
        team = _map_understat_name(raw_name)
        xg_val = safe_float(str(entry.get("xG", entry.get("xg", ""))))
        xga_val = safe_float(str(entry.get("xGA", entry.get("xga", ""))))
        mp_val = safe_float(str(entry.get("played", entry.get("MP", entry.get("matches", "")))))
        results[team] = {"xG_total": xg_val, "xGA_total": xga_val, "MP_understat": mp_val}

    print(f"  [Understat:xG]   {len(results)} teams with xG", file=sys.stderr)
    return results

# ── Merge & Compute Ranks ───────────────────────────────────────────────────

_STD_GLS_PATTERNS = ("Gls", "Goals")
_STD_MP_PATTERNS = ("MP", "Matches", "Playing Time")
_STD_GA_PATTERNS = ("GA", "Goals Against")
_SH_SOT_PATTERNS = ("Sh/90", "Shots/90", "Shots per 90")
_SH_TOTAL_PATTERNS = ("Sh", "Shots", "Shots Total")
_KP_CS_PATTERNS = ("CS", "Clean Sheets")
_KP_CS_PCT_PATTERNS = ("CS%", "Clean Sheet Percentage", "CS %")
_MISC_TKLW_PATTERNS = ("TklW", "Tackles Won")
_MISC_TKL_PATTERNS = ("Tkl", "Tackles")
_MISC_INT_PATTERNS = ("Int", "Interceptions")
_MISC_CLR_PATTERNS = ("Clr", "Clearances")

def _find_key(data: Dict[str, Optional[float]], *patterns: str) -> Optional[float]:
    """Trouve la premiere cle correspondant a un pattern et retourne sa valeur."""
    if not data:
        return None
    for key, val in data.items():
        key_lower = key.lower().strip()
        for pat in patterns:
            if pat.lower() in key_lower:
                return val
    return None

def merge_team_data(
    std_stats: Dict[str, Dict[str, Optional[float]]],
    sh_stats: Dict[str, Dict[str, Optional[float]]],
    kp_stats: Dict[str, Dict[str, Optional[float]]],
    misc_stats: Dict[str, Dict[str, Optional[float]]],
    us_xg: Dict[str, Dict[str, Optional[float]]],
    is_big5: bool,
) -> Dict[str, Dict[str, Any]]:
    """Fusionne les 4 tables FBref + Understat en metriques par equipe."""
    all_teams: set = set()
    for d in (std_stats, sh_stats, kp_stats, misc_stats, us_xg):
        all_teams.update(d.keys())

    merged: Dict[str, Dict[str, Any]] = {}
    for team in all_teams:
        std = std_stats.get(team, {})
        sh = sh_stats.get(team, {})
        kp = kp_stats.get(team, {})
        misc = misc_stats.get(team, {})
        xg = us_xg.get(team, {}) if is_big5 else {}

        merged[team] = {
            "goals": _find_key(std, *_STD_GLS_PATTERNS),
            "mp": _find_key(std, *_STD_MP_PATTERNS),
            "ga": _find_key(std, *_STD_GA_PATTERNS),
            "sh_p90": _find_key(sh, *_SH_SOT_PATTERNS),
            "sh_total": _find_key(sh, *_SH_TOTAL_PATTERNS),
            "cs": _find_key(kp, *_KP_CS_PATTERNS),
            "cs_pct": _find_key(kp, *_KP_CS_PCT_PATTERNS),
            "tklw": _find_key(misc, *_MISC_TKLW_PATTERNS),
            "tkl": _find_key(misc, *_MISC_TKL_PATTERNS),
            "int_": _find_key(misc, *_MISC_INT_PATTERNS),
            "clr": _find_key(misc, *_MISC_CLR_PATTERNS),
            "xg_total": xg.get("xG_total"),
            "xga_total": xg.get("xGA_total"),
            "mp_us": xg.get("MP_understat"),
        }
    return merged


def compute_metrics(merged: Dict[str, Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Calcule les metriques attaque/defense et leurs rangs (1=best)."""
    teams = []
    for team, d in merged.items():
        mp = d["mp"]
        goals = d["goals"]
        ga = d["ga"]
        sh_p90 = d["sh_p90"]
        sh_total = d["sh_total"]
        cs_pct = d["cs_pct"]
        tklw = d["tklw"]
        tkl = d["tkl"]
        int_ = d["int_"]
        clr = d["clr"]
        xg_total = d["xg_total"]
        mp_us = d["mp_us"]

        goals_per_game = round(goals / mp, 2) if goals is not None and mp and mp > 0 else None
        shots_per_game = round(sh_p90, 2) if sh_p90 is not None else None
        eff_mp = mp_us if mp_us is not None and mp_us > 0 else mp
        xg_per_game = round(xg_total / eff_mp, 2) if xg_total is not None and eff_mp and eff_mp > 0 else None
        attack_freq = round(goals / sh_total * 100, 1) if goals is not None and sh_total and sh_total > 0 else None

        conceded_per_game = round(ga / mp, 2) if ga is not None and mp and mp > 0 else None
        clean_sheet_pct = round(cs_pct, 1) if cs_pct is not None else None
        tackles_per_game = round(tklw / mp, 2) if tklw is not None and mp and mp > 0 else None

        def_actions_sum = None
        if tkl is not None or int_ is not None or clr is not None:
            def_actions_sum = (tkl or 0) + (int_ or 0) + (clr or 0)
        def_actions_per_game = round(def_actions_sum / mp, 2) if def_actions_sum is not None and mp and mp > 0 else None

        teams.append({
            "teamName": team,
            "attack": {
                "goalsPerGame": goals_per_game,
                "shotsPerGame": shots_per_game,
                "xGPerGame": xg_per_game,
                "attackFrequency": attack_freq,
                "goalsPerGameRank": None,
                "shotsPerGameRank": None,
                "xGPerGameRank": None,
                "attackFrequencyRank": None,
            },
            "defense": {
                "concededPerGame": conceded_per_game,
                "cleanSheetPct": clean_sheet_pct,
                "tacklesPerGame": tackles_per_game,
                "defActionsPerGame": def_actions_per_game,
                "concededPerGameRank": None,
                "cleanSheetPctRank": None,
                "tacklesPerGameRank": None,
                "defActionsPerGameRank": None,
            },
        })

    # Rangs: 1 = meilleur
    def rank_attack(key: str):
        vals = [(i, t["attack"][key]) for i, t in enumerate(teams) if t["attack"][key] is not None]
        vals.sort(key=lambda x: x[1], reverse=True)
        for rank, (idx, _) in enumerate(vals, 1):
            teams[idx]["attack"][f"{key}Rank"] = rank

    def rank_defense(key: str, higher_better: bool = False):
        vals = [(i, t["defense"][key]) for i, t in enumerate(teams) if t["defense"][key] is not None]
        vals.sort(key=lambda x: x[1], reverse=higher_better)
        for rank, (idx, _) in enumerate(vals, 1):
            teams[idx]["defense"][f"{key}Rank"] = rank

    rank_attack("goalsPerGame")
    rank_attack("shotsPerGame")
    rank_attack("xGPerGame")
    rank_attack("attackFrequency")

    rank_defense("concededPerGame", higher_better=False)
    rank_defense("cleanSheetPct", higher_better=True)
# ── Build output ────────────────────────────────────────────────────────────

def build_output(league_slug: str, league_name: str, teams: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Construit le JSON final."""
    return {
        "meta": {
            "leagueName": league_name,
            "leagueSlug": league_slug,
            "season": current_season(),
            "lastUpdated": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "source": "FBref+Understat",
            "teamCount": len(teams),
        },
        "teams": teams,
    }

# ── Per-league ──────────────────────────────────────────────────────────────

def scrape_league(league_slug: str, config: dict, season: str) -> Optional[Dict[str, Any]]:
    """Scrape toutes les donnees pour une ligue et retourne le JSON."""
    comp_id = config["comp_id"]
    fbref_slug = config["fbref_slug"]
    us_slug = config["us_slug"]
    is_big5 = league_slug in BIG_FIVE and us_slug is not None

    print(f"\n[{league_slug}] {'='*60}", file=sys.stderr)
    print(f"  Season: {season}, Big5: {is_big5}", file=sys.stderr)

    std_stats = scrape_fbref_standard(comp_id, fbref_slug, season)
    sh_stats = scrape_fbref_shooting(comp_id, fbref_slug, season)
    kp_stats = scrape_fbref_keeper(comp_id, fbref_slug, season)
    misc_stats = scrape_fbref_misc(comp_id, fbref_slug, season)

    us_xg: Dict[str, Dict[str, Optional[float]]] = {}
    if is_big5 and us_slug:
        us_xg = scrape_understat_xg(us_slug, season, league_slug)

    merged = merge_team_data(std_stats, sh_stats, kp_stats, misc_stats, us_xg, is_big5)
    if not merged:
        print(f"[{league_slug}] WARNING: no data after merge", file=sys.stderr)
        return None

    teams = compute_metrics(merged)
    print(f"[{league_slug}] {len(teams)} teams with attack/defense metrics", file=sys.stderr)

    league_name = config.get("us_league_name") or fbref_slug.replace("-", " ")
    return build_output(league_slug, league_name, teams)

# ── Main ────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Team Attack/Defense scraper (FBref + Understat)")
    parser.add_argument("--league", type=str, help="League slug (ex: england)")
    parser.add_argument("--all", action="store_true", help="Scrape all 28 leagues")
    parser.add_argument("--season", type=str, help="Season override (ex: 2025-2026)")
    parser.add_argument("--output-dir", type=str, default="public/data/metrics")
    parser.add_argument("--delay", type=float, default=3.0)
    args = parser.parse_args()

    season = args.season or current_season()
    print(f"Season: {season}", file=sys.stderr)

    if args.league:
        if args.league not in LEAGUES:
            print(f"Unknown: '{args.league}'\nAvailable: {list(LEAGUES.keys())}", file=sys.stderr)
            sys.exit(1)
        targets = {args.league: LEAGUES[args.league]}
    elif args.all:
        targets = LEAGUES
    else:
        print("Use --all or --league <slug> [--season YYYY-YYYY]", file=sys.stderr)
        sys.exit(1)

    os.makedirs(args.output_dir, exist_ok=True)
    ok, fail = 0, 0

    for slug, cfg in targets.items():
        data = scrape_league(slug, cfg, season)
        if data is None:
            fail += 1
            continue
        fpath = os.path.join(args.output_dir, f"team_stats_{slug}.json")
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

