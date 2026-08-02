#!/usr/bin/env python3
"""
scrape_football_data.py — Pipeline ingestion football-data.co.uk (CSV backtest).

Télécharge et parse les CSV historiques de football-data.co.uk (résultats +
cotes d'ouverture/fermeture) depuis 1993, normalise les noms d'équipes via
team_name_mapping.py et génère /public/data/backtest/{league}/{season}.json
directement exploitables par les moteurs de backtest.

Sources CSV (saison 1993→2024, archives saison courante):
  - Historique : https://www.football-data.co.uk/mmz4281/{seasontwo}/{CODE}.csv
  - Courant    : https://www.football-data.co.uk/mmz4281/{seasontwo}/{CODE}.csv
    (mmz4281 = nouveau format 4 chiffres de saison, ex. 2425 = 2024/25)

Codes ligues supportées (fichiers de football-data.co.uk):
  E0=EPL, E1=Championship, E2=League One, E3=League Two,
  SP1=La Liga, SP2=Segunda, D1=Bundesliga, D2=2.Bundesliga,
  I1=Serie A, I2=Serie B, F1=Ligue 1, F2=Ligue 2,
  N1=Eredivisie, P1=Primeira Liga, B1=Belgique Pro League, T1=Super Lig.

USAGE:
    python scripts/scrape_football_data.py --league E0 --seasons 2024,2025 --output-dir public/data/backtest
    python scripts/scrape_football_data.py --league E0 --all --output-dir public/data/backtest
    python scripts/scrape_football_data.py --league E0 --current-only --output-dir public/data/backtest
"""

import sys, os, json, argparse, csv, io, re, time
from datetime import datetime, timezone
from typing import Optional, Dict, List, Any

try:
    import requests
    from tenacity import retry, stop_after_attempt, wait_exponential
except ImportError as e:
    print(json.dumps({"error": "Deps missing",
          "install": "pip install -r scripts/requirements-rankings.txt",
          "detail": str(e)}), file=sys.stderr)
    sys.exit(1)

try:
    from team_name_mapping import TEAM_NAME_OVERRIDES
except ImportError:
    TEAM_NAME_OVERRIDES = {}

HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
BASE_URL = "https://www.football-data.co.uk/mmz4281"

LEAGUES = {
    "E0": "epl",          "E1": "championship",   "E2": "league_one",   "E3": "league_two",
    "SP1": "laliga",      "SP2": "laliga2",
    "D1": "bundesliga",   "D2": "bundesliga2",
    "I1": "seriea",       "I2": "serieb",
    "F1": "ligue1",       "F2": "ligue2",
    "N1": "eredivisie",   "P1": "primeira_liga",
    "B1": "pro_league",   "T1": "super_lig",
}
FIRST_SEASON = 1993  # première saison archivée (1993/94)

# Colonnes cotes 1X2 fermeture + ouverture (selon disponibilité par saison)
CLOSE_COLS = ["B365H", "B365D", "B365A", "PSH", "PSD", "PSA", "WHH", "WHD", "WHA",
              "MaxH", "MaxD", "MaxA", "AvgH", "AvgD", "AvgA"]
OPEN_COLS  = ["B365CH", "B365CD", "B365CA", "PSCH", "PSCD", "PSCA", "WHCH", "WHCD", "WHCA",
              "MaxCH", "MaxCD", "MaxCA", "AvgCH", "AvgCD", "AvgCA"]


def standardize_team_name(raw_name: str) -> str:
    name = re.sub(r"\s+", " ", raw_name.strip())
    key = name.lower().strip()
    if key in TEAM_NAME_OVERRIDES:
        return TEAM_NAME_OVERRIDES[key]
    return name.title()


def _num(text: str) -> Optional[float]:
    t = (text or "").strip()
    if t in ("", "-", "N/A", "n/a"): return None
    try:
        return float(t)
    except ValueError:
        return None


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=20))
def fetch_csv(url: str) -> str:
    r = requests.get(url, headers=HEADERS, timeout=30)
    r.raise_for_status()
    return r.text


def season_two_digits(season: int) -> str:
    """2024 → '2425' (format mmz4281)."""
    return f"{season % 100:02d}{(season + 1) % 100:02d}"


def parse_csv(text: str, league_code: str, season: int) -> List[Dict[str, Any]]:
    """Parse un CSV football-data.co.uk → liste de matchs normalisés."""
    # BOM possible en début de fichier
    if text.startswith("\ufeff"):
        text = text[1:]
    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames:
        return []
    matches = []
    for row in reader:
        home = standardize_team_name(row.get("HomeTeam") or "")
        away = standardize_team_name(row.get("AwayTeam") or "")
        if not home or not away:
            continue
        date_raw = (row.get("Date") or "").strip()
        try:
            d = datetime.strptime(date_raw, "%d/%m/%Y")
            date_iso = d.strftime("%Y-%m-%d")
        except ValueError:
            date_iso = None

        fthg, ftag = _num(row.get("FTHG")), _num(row.get("FTAG"))
        if fthg is None or ftag is None:
            continue

        close = {k.lower(): _num(row.get(k)) for k in CLOSE_COLS}
        open_ = {k.lower(): _num(row.get(k)) for k in OPEN_COLS}
        close = {k: v for k, v in close.items() if v is not None}
        open_ = {k: v for k, v in open_.items() if v is not None}

        match = {
            "season": season,
            "date": date_iso,
            "homeTeam": home,
            "awayTeam": away,
            "fthg": fthg,
            "ftag": ftag,
            "ftr": (row.get("FTR") or "").strip() or None,
            "referee": (row.get("Referee") or "").strip() or None,
            "odds": {
                "close": close,
                "open": open_,
            },
        }
        # Stats de match si présentes (tirées des saisons récentes)
        for k in ("HS", "AS", "HST", "AST", "HF", "AF", "HC", "AC", "HY", "AY", "HR", "AR"):
            v = _num(row.get(k))
            if v is not None:
                match[k.lower()] = v
        matches.append(match)
    return matches


def fetch_season(league_code: str, season: int, output_dir: str) -> Dict[str, Any]:
    slug = LEAGUES[league_code]
    url = f"{BASE_URL}/{season_two_digits(season)}/{league_code}.csv"
    out_path = os.path.join(output_dir, slug, f"{season}.json")
    try:
        text = fetch_csv(url)
    except Exception as e:  # noqa: BLE001
        return {"league": slug, "season": season, "status": "error", "error": str(e)[:200], "url": url}
    matches = parse_csv(text, league_code, season)
    if not matches:
        return {"league": slug, "season": season, "status": "empty", "url": url}
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    payload = {
        "_meta": {
            "source": "football-data.co.uk",
            "league": slug,
            "league_code": league_code,
            "season": season,
            "fetched_at": datetime.now(timezone.utc).isoformat(),
            "url": url,
            "matches": len(matches),
        },
        "matches": matches,
    }
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False)
    return {"league": slug, "season": season, "status": "ok", "matches": len(matches), "url": url}


def main():
    ap = argparse.ArgumentParser(description="Ingestion football-data.co.uk")
    ap.add_argument("--league", required=True, choices=list(LEAGUES.keys()),
                    help="Code ligue (E0, SP1, D1, I1, F1, N1, P1...)")
    ap.add_argument("--seasons", default=None,
                    help="Liste de saisons (ex: 2023,2024) — défaut: saison courante")
    ap.add_argument("--all", action="store_true", help="Toutes les saisons depuis 1993")
    ap.add_argument("--current-only", action="store_true",
                    help="Saison courante uniquement (année civile en cours)")
    ap.add_argument("--output-dir", default="public/data/backtest")
    args = ap.parse_args()

    current_year = datetime.now().year
    # Saison "courante" = celle dont l'année de départ est déjà archivée.
    # football-data publie la nouvelle saison ~début août : avant, la saison
    # en cours est encore (année-1)/(année).
    try:
        probe = requests.get(f"{BASE_URL}/{season_two_digits(current_year)}/E0.csv",
                             headers=HEADERS, timeout=15)
        if probe.status_code != 200:
            current_year -= 1
    except Exception:
        current_year -= 1
    if args.all:
        seasons = list(range(FIRST_SEASON, current_year + 1))
    elif args.current_only:
        seasons = [current_year]
    elif args.seasons:
        seasons = [int(s) for s in args.seasons.split(",") if s.strip()]
    else:
        seasons = [current_year]

    results = []
    for season in seasons:
        res = fetch_season(args.league, season, args.output_dir)
        results.append(res)
        if res["status"] == "ok":
            print(f"  [ok] {args.league} {season}: {res['matches']} matchs")
        elif res["status"] == "empty":
            print(f"  [--] {args.league} {season}: aucun match")
        else:
            print(f"  [!!] {args.league} {season}: {res.get('error','?')}")

    print(json.dumps({"league": args.league, "results": results}, ensure_ascii=False))


if __name__ == "__main__":
    main()
