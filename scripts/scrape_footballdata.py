#!/usr/bin/env python3
"""
scrape_footballdata.py — Stats équipes par championnat depuis football-data.co.uk.

Source : CSV gratuits (aucun anti-bot) avec résultats complets incluant les
CORNERS home/away (colonnes HC/AC), les buts (FTHG/FTAG) et le résultat (FTR).

Calcule par équipe, PAR SAISON et par contexte (overall / home / away) :
  - matchs, victoires/nuls/défaites, points, PPM
  - buts marqués/encaissés (totaux + moyennes/match)
  - taux Over 0.5 / 1.5 / 2.5 / 3.5 et Under 1.5 / 2.5 / 3.5
  - taux BTTS yes
  - corners pour/contre (totaux + moyennes) + taux Over 6.5 / Over 7.5

USAGE:
    python scripts/scrape_footballdata.py --all --output-dir public/data/fd
    python scripts/scrape_footballdata.py --league ligue1 --output-dir public/data/fd
"""

import sys, os, json, csv, io, argparse, time
from datetime import datetime, timezone
from typing import Optional, Dict, List, Any

try:
    import requests
    from tenacity import retry, stop_after_attempt, wait_exponential
except ImportError as e:
    print(f"Deps missing: {e} — pip install -r scripts/requirements-rankings.txt", file=sys.stderr)
    sys.exit(1)

HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
BASE = "https://www.football-data.co.uk/mmz4281"

# slug interne → code division football-data.co.uk
LEAGUES = {
    "epl":              ["E0"],
    "championship":     ["E1"],
    "ligue1":           ["F1"],
    "ligue2":           ["F2"],
    "bundesliga":       ["D1"],
    "bundesliga2":      ["D2"],
    "laliga":           ["SP1"],
    "laliga2":          ["SP2"],
    "seriea":           ["I1"],
    "serieb":           ["I2"],
    "eredivisie":       ["N1"],
    "primeira_liga":    ["P1"],
    "jupiler":          ["B1"],
    "super_lig":        ["T1"],
    "superleague_greece": ["G1"],
    "scot_prem":        ["SC0"],
}

# saisons (année de départ football-data)
SEASONS = [("2526", "2025/26"), ("2627", "2026/27")]

MARKET_LINES_GOALS = [0.5, 1.5, 2.5, 3.5]
MARKET_LINES_CORNERS = [6.5, 7.5, 8.5]


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=30))
def _fetch_csv(season_code: str, division: str) -> Optional[str]:
    url = f"{BASE}/{season_code}/{division}.csv"
    resp = requests.get(url, headers=HEADERS, timeout=30)
    # 300 Multiple Choices = fichier pas encore publié pour cette saison
    if resp.status_code != 200 or len(resp.content) < 500:
        return None
    return resp.text


def _new_acc() -> Dict[str, Any]:
    return {
        "gp": 0, "wins": 0, "draws": 0, "losses": 0, "gf": 0, "ga": 0,
        "cornersFor": 0, "cornersAgainst": 0,
        "bttsYes": 0,
        "over": {f"o{str(l).replace('.', '')}": 0 for l in MARKET_LINES_GOALS},
        "under": {f"u{str(l).replace('.', '')}": 0 for l in MARKET_LINES_GOALS if l >= 1.5},
        "cornerOver": {f"c{str(l).replace('.', '')}": 0 for l in MARKET_LINES_CORNERS},
    }


def _parse_date(raw: str) -> str:
    """CSV dates FR '15/08/2025' ou EN '2025-08-15' → ISO."""
    raw = (raw or "").strip()
    for fmt in ("%d/%m/%Y", "%Y-%m-%d", "%d/%m/%y"):
        try:
            return datetime.strptime(raw, fmt).date().isoformat()
        except ValueError:
            continue
    return raw


def _apply(acc: Dict[str, Any], *, gp_add: int, gf: int, ga: int,
           total_goals: float, btts: bool, total_corners: Optional[int],
           result: str) -> None:
    """Applique un match à un accumulateur (contexte d'une équipe)."""
    acc["gp"] += gp_add
    acc["gf"] += gf
    acc["ga"] += ga
    if result == "W":
        acc["wins"] += 1
    elif result == "D":
        acc["draws"] += 1
    else:
        acc["losses"] += 1
    for line in MARKET_LINES_GOALS:
        if total_goals > line:
            acc["over"][f"o{str(line).replace('.', '')}"] += 1
        if line >= 1.5 and total_goals < line:
            acc["under"][f"u{str(line).replace('.', '')}"] += 1
    if btts:
        acc["bttsYes"] += 1
    if total_corners is not None:
        for line in MARKET_LINES_CORNERS:
            if total_corners > line:
                acc["cornerOver"][f"c{str(line).replace('.', '')}"] += 1


def compute_season(rows: List[Dict[str, str]]) -> Optional[Dict[str, Any]]:
    teams: Dict[str, Dict[str, Dict[str, Any]]] = {}

    def team(name: str) -> Dict[str, Any]:
        if name not in teams:
            teams[name] = {ctx: _new_acc() for ctx in ("overall", "home", "away")}
        return teams[name]

    n_matches = 0
    for r in rows:
        try:
            hg = int(r.get("FTHG") or "")
            ag = int(r.get("FTAG") or "")
        except ValueError:
            continue
        hc_raw, ac_raw = r.get("HC"), r.get("AC")
        try:
            hc = int(hc_raw) if hc_raw not in (None, "") else None
            ac = int(ac_raw) if ac_raw not in (None, "") else None
        except ValueError:
            hc = ac = None

        home_name, away_name = (r.get("HomeTeam") or "").strip(), (r.get("AwayTeam") or "").strip()
        if not home_name or not away_name:
            continue
        total_goals = hg + ag
        btts = hg > 0 and ag > 0
        total_corners = (hc + ac) if (hc is not None and ac is not None) else None
        ftr = (r.get("FTR") or "").upper()

        h, a = team(home_name), team(away_name)
        n_matches += 1

        # Recevant : contexte home + overall ; corners pour = HC
        _apply(h["home"], gp_add=1, gf=hg, ga=ag, total_goals=total_goals,
               btts=btts, total_corners=None if total_corners is None else total_corners,
               result="W" if ftr == "H" else "D" if ftr == "D" else "L")
        h["home"]["cornersFor"] += hc or 0
        # Visiteur : contexte away + overall ; corners pour = AC
        _apply(a["away"], gp_add=1, gf=ag, ga=hg, total_goals=total_goals,
               btts=btts, total_corners=None if total_corners is None else total_corners,
               result="W" if ftr == "A" else "D" if ftr == "D" else "L")
        a["away"]["cornersFor"] += ac or 0

        if total_corners is not None:
            h["overall"]["cornersFor"] += hc or 0
            a["overall"]["cornersFor"] += ac or 0

        _apply(h["overall"], gp_add=1, gf=hg, ga=ag, total_goals=total_goals,
               btts=btts, total_corners=None if total_corners is None else total_corners,
               result="W" if ftr == "H" else "D" if ftr == "D" else "L")
        _apply(a["overall"], gp_add=1, gf=ag, ga=hg, total_goals=total_goals,
               btts=btts, total_corners=None if total_corners is None else total_corners,
               result="W" if ftr == "A" else "D" if ftr == "D" else "L")

    if not teams:
        return None

    # Normalisation en sortie
    out_teams: Dict[str, Any] = {}
    for name, ctxs in teams.items():
        entry: Dict[str, Any] = {}
        for ctx, acc in ctxs.items():
            gp = int(acc["gp"])
            pts = acc["wins"] * 3 + acc["draws"]
            entry[ctx] = {
                "gp": gp,
                "wins": int(acc["wins"]),
                "draws": int(acc["draws"]),
                "losses": int(acc["losses"]),
                "points": int(pts),
                "ppm": round(pts / gp, 2) if gp else 0,
                "goalsFor": int(acc["gf"]),
                "goalsAgainst": int(acc["ga"]),
                "gfPg": round(acc["gf"] / gp, 2) if gp else 0,
                "gaPg": round(acc["ga"] / gp, 2) if gp else 0,
                **{k: round(v / gp * 100, 1) if gp else 0 for k, v in acc["over"].items()},
                **{k: round(v / gp * 100, 1) if gp else 0 for k, v in acc["under"].items()},
                "bttsYesPct": round(acc["bttsYes"] / gp * 100, 1) if gp else 0,
                "cornersForPg": round(acc["cornersFor"] / gp, 2) if gp else 0,
                **{k: round(v / gp * 100, 1) if gp else 0 for k, v in acc["cornerOver"].items()},
            }
        out_teams[name] = entry

    return {"nMatches": n_matches, "teams": out_teams}


def scrape_league(slug: str, divisions: List[str]) -> Optional[Dict]:
    seasons_out = {}
    for season_code, season_label in SEASONS:
        rows_all: List[Dict[str, str]] = []
        for division in divisions:
            text = _fetch_csv(season_code, division)
            if not text:
                continue
            rows_all.extend(csv.DictReader(io.StringIO(text)))
        computed = compute_season(rows_all) if rows_all else None
        if computed:
            seasons_out[season_label] = computed
            print(f"[{slug}] {season_label}: {computed['nMatches']} matchs, {len(computed['teams'])} équipes", file=sys.stderr)
        else:
            print(f"[{slug}] {season_label}: indisponible", file=sys.stderr)

    if not seasons_out:
        print(f"[{slug}] ERROR: aucune saison dispo", file=sys.stderr)
        return None

    return {
        "meta": {
            "schemaVersion": 1,
            "leagueId": slug,
            "source": "football-data.co.uk",
            "lastUpdated": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "divisions": divisions,
        },
        "seasons": seasons_out,
    }


def main():
    parser = argparse.ArgumentParser(description="football-data.co.uk team stats scraper")
    parser.add_argument("--league", type=str)
    parser.add_argument("--all", action="store_true")
    parser.add_argument("--output-dir", type=str, default="public/data/fd")
    parser.add_argument("--delay", type=float, default=1.0)
    args = parser.parse_args()

    if args.league:
        if args.league not in LEAGUES:
            print(f"Unknown league '{args.league}'. Dispo: {', '.join(LEAGUES)}", file=sys.stderr)
            sys.exit(1)
        targets = {args.league: LEAGUES[args.league]}
    elif args.all:
        targets = LEAGUES
    else:
        print("Use --all or --league <slug>", file=sys.stderr)
        sys.exit(1)

    os.makedirs(args.output_dir, exist_ok=True)
    ok, fail = 0, 0
    keys = list(targets.keys())
    for i, (slug, divisions) in enumerate(targets.items()):
        data = scrape_league(slug, divisions)
        if data is None:
            fail += 1
            continue
        fpath = os.path.join(args.output_dir, f"{slug}.json")
        with open(fpath, "w", encoding="utf-8") as f:
            json.dump(data, f, separators=(",", ":"), ensure_ascii=False)
        print(f"  -> {fpath}", file=sys.stderr)
        ok += 1
        if i != len(keys) - 1:
            time.sleep(args.delay)
    print(f"\nDone: {ok} OK, {fail} failed", file=sys.stderr)
    sys.exit(0 if fail == 0 else 1)


if __name__ == "__main__":
    main()
