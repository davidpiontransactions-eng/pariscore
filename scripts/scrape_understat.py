#!/usr/bin/env python3
"""
scrape_understat.py — xG réel (Opta) par équipe depuis understat.com.

Utilise l'endpoint XHR `GET /getLeagueData/{league}/{season}` (le même que le
front Understat), qui renvoie par équipe un historique match par match :
h_a (contexte Home/Away), xG, xGA, scored, missed, result, date.

Couverture : EPL, La_liga, Bundesliga, Serie_A, Ligue_1, RFPL (6 ligues).
Cumule la saison courante et la précédente (comme scrape_form.py) : en début
de saison 2026/27 l'historique courant est vide → la saison précédente
fournit les fenêtres L5/L10.

USAGE:
    python scripts/scrape_understat.py --all --output-dir public/data/xg
    python scripts/scrape_understat.py --league epl --output-dir public/data/xg
"""

import sys, os, json, argparse, time
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

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "X-Requested-With": "XMLHttpRequest",
    "Accept": "application/json, text/javascript, */*; q=0.01",
}

# slug interne PariScore → slug Understat
LEAGUES = {
    "epl":             "EPL",
    "laliga":          "La_liga",
    "bundesliga":      "Bundesliga",
    "seriea":          "Serie_A",
    "ligue1":          "Ligue_1",
    "russian_premier": "RFPL",
}

CURRENT_SEASON = 2026   # saison 2026/27 (année de départ)
PREVIOUS_SEASON = 2025  # saison 2025/26

MATCH_FIELDS = ["date", "h_a", "xG", "xGA", "scored", "missed", "result"]


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=30))
def _fetch_league(understat_slug: str, season: int) -> Optional[Dict]:
    url = f"https://understat.com/getLeagueData/{understat_slug}/{season}"
    resp = requests.get(url, headers=HEADERS, timeout=30)
    resp.raise_for_status()
    return resp.json()


def _extract_teams(payload: Optional[Dict]) -> Dict[str, List[Dict]]:
    """→ {teamTitle: [matchs triés du plus récent au plus ancien]}."""
    out: Dict[str, List[Dict]] = {}
    if not payload:
        return out
    for team in (payload.get("teams") or {}).values():
        title = team.get("title")
        hist = team.get("history") or []
        if not title or not hist:
            continue
        matches = []
        for m in hist:
            row = {k: m.get(k) for k in MATCH_FIELDS}
            if row["xG"] is None and row["scored"] is None:
                continue
            matches.append(row)
        if matches:
            # history est déjà trié récent→ancien côté Understat ; on s'assure de l'ordre.
            matches.sort(key=lambda r: str(r.get("date", "")), reverse=True)
            out[title] = matches
    return out


def _merge(current: Dict[str, List], previous: Dict[str, List]) -> Dict[str, List]:
    """Cumule 2 saisons par équipe : matchs courants d'abord (plus récents),
    puis complément de la saison précédente."""
    teams = set(current) | set(previous)
    merged: Dict[str, List] = {}
    for t in teams:
        merged[t] = list(current.get(t, [])) + list(previous.get(t, []))
    return merged


def scrape_league(pariscore_slug: str, understat_slug: str) -> Optional[Dict]:
    print(f"[{pariscore_slug}] Fetching {understat_slug} saisons {PREVIOUS_SEASON}+{CURRENT_SEASON}", file=sys.stderr)
    try:
        prev_payload = _fetch_league(understat_slug, PREVIOUS_SEASON)
    except Exception as e:
        print(f"[{pariscore_slug}] ERROR fetch saison {PREVIOUS_SEASON}: {e}", file=sys.stderr)
        return None
    try:
        cur_payload = _fetch_league(understat_slug, CURRENT_SEASON)
    except Exception as e:
        cur_payload = None
        print(f"[{pariscore_slug}] WARN saison {CURRENT_SEASON}: {e}", file=sys.stderr)

    prev_teams = _extract_teams(prev_payload)
    cur_teams = _extract_teams(cur_payload)
    teams = _merge(cur_teams, prev_teams)

    if not teams:
        print(f"[{pariscore_slug}] ERROR: aucune donnée", file=sys.stderr)
        return None

    n_matches = sum(len(v) for v in teams.values())
    avg = n_matches / max(len(teams), 1)
    print(f"[{pariscore_slug}] {len(teams)} équipes | {n_matches} matchs cumulés ({avg:.0f}/équipe)", file=sys.stderr)

    season_label = "2025/26+2026/27" if cur_teams else "2025/26"
    return {
        "meta": {
            "schemaVersion": 1,
            "leagueId": pariscore_slug,
            "source": "understat.com/getLeagueData",
            "season": season_label,
            "lastUpdated": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "teamCount": len(teams),
            "currentSeasonMatches": sum(len(v) for v in cur_teams.values()),
        },
        "teams": teams,
    }


def main():
    parser = argparse.ArgumentParser(description="Understat xG scraper")
    parser.add_argument("--league", type=str, help="slug PariScore (ex: epl)")
    parser.add_argument("--all", action="store_true")
    parser.add_argument("--output-dir", type=str, default="public/data/xg")
    parser.add_argument("--delay", type=float, default=2.0)
    args = parser.parse_args()

    if args.league:
        if args.league not in LEAGUES:
            print(f"Unknown league: '{args.league}'. Dispo: {', '.join(LEAGUES)}", file=sys.stderr)
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
    for i, (slug, uslug) in enumerate(targets.items()):
        data = scrape_league(slug, uslug)
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
