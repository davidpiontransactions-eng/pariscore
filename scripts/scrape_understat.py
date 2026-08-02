#!/usr/bin/env python3
"""
scrape_understat.py — Connecteur Understat xG/PPDA pour PariScore.

Récupère les données xG/PPDA par match pour une ligue+saison via l'endpoint
interne de Understat (SPA). Endpoint:

    GET https://understat.com/getLeagueData/{league}/{season}
    Headers: User-Agent navigateur, Referer: https://understat.com/league/{league}/{season},
             X-Requested-With: XMLHttpRequest
    Réponse: gzip → JSON {teams, players, dates}

Les ligues Understat (slugs EXACTS, sensibles à la casse): EPL, La%20liga,
Bundesliga, Serie A, Ligue 1. La saison est l'ANNÉE DE DÉPART (2025 = 2025/26).
PPDA est dérivé de history[].ppda = {att (passes), def (actions défensives)}
→ ppda = att/def. Alignement BSD par date + noms d'équipes normalisés.

USAGE:
    python scripts/scrape_understat.py --league EPL --season 2025 --output-dir public/data/xg
    python scripts/scrape_understat.py --league EPL --current --output-dir public/data/xg
"""

import sys, os, json, argparse, gzip
from datetime import datetime, timezone, date as _date
from typing import Optional, Dict, Any, List

try:
    import requests
except ImportError as e:
    print(json.dumps({"error": "Deps missing",
          "install": "pip install -r scripts/requirements-rankings.txt",
          "detail": str(e)}), file=sys.stderr)
    sys.exit(1)

try:
    from team_name_mapping import TEAM_NAME_OVERRIDES
except ImportError:
    TEAM_NAME_OVERRIDES = {}

BASE = "https://understat.com"
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/131.0 Safari/537.36")

# Slugs Understat (exacts, casse comprise — "La%20liga" est le vrai slug)
LEAGUES = {
    "EPL": "EPL",
    "La Liga": "La%20liga",
    "Bundesliga": "Bundesliga",
    "Serie A": "Serie A",
    "Ligue 1": "Ligue 1",
}


def headers_for(league_slug: str) -> Dict[str, str]:
    return {
        "User-Agent": UA,
        "Referer": f"{BASE}/league/{league_slug}",
        "X-Requested-With": "XMLHttpRequest",
        "Accept-Encoding": "gzip, deflate",
    }


def fetch_league(league_slug: str, season: str) -> Dict[str, Any]:
    url = f"{BASE}/getLeagueData/{league_slug}/{season}"
    r = requests.get(url, headers=headers_for(league_slug), timeout=30)
    r.raise_for_status()
    # gzip automatiquement décompressé par requests (Accept-Encoding)
    return r.json()


def standardize_team_name(raw: str) -> str:
    key = raw.strip().lower()
    if key in TEAM_NAME_OVERRIDES:
        return TEAM_NAME_OVERRIDES[key]
    return raw.strip()


def build_matches(league_slug: str, season: str, data: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Construit la liste des matchs avec xG/PPDA dérivés des history teams."""
    teams = data.get("teams") or {}
    # index par date+équipe : history[].date → {team_id, match}
    by_team_date: Dict[str, List[tuple]] = {}
    for tid, tinfo in (teams or {}).items():
        if not isinstance(tinfo, dict):
            continue  # certaines valeurs de 'teams' sont des strings (robustesse)
        for h in tinfo.get("history") or []:
            hdate = h.get("date", "")[:10]
            by_team_date.setdefault((hdate, tid), []).append(h)

    matches: List[Dict[str, Any]] = []
    for m in data.get("dates") or []:
        h = m.get("h") or {}
        a = m.get("a") or {}
        dt = (m.get("datetime") or "")[:10]
        home_team = standardize_team_name(h.get("title") or "")
        away_team = standardize_team_name(a.get("title") or "")
        goals_h = m.get("goals", {}).get("h")
        goals_a = m.get("goals", {}).get("a")
        xg_h = m.get("xG", {}).get("h")
        xg_a = m.get("xG", {}).get("a")
        forecast = m.get("forecast") or {}

        def _team_hist(team_id: Optional[str]) -> Optional[Dict[str, Any]]:
            if not team_id:
                return None
            for entry in by_team_date.get((dt, team_id), []):
                return entry
            return None

        hh = _team_hist(h.get("id"))
        aa = _team_hist(a.get("id"))

        def _ppda(entry: Optional[Dict[str, Any]]) -> Optional[float]:
            if not entry:
                return None
            pp = entry.get("ppda") or {}
            att, deff = pp.get("att"), pp.get("def")
            if att is not None and deff:
                try:
                    return round(float(att) / float(deff), 3)
                except (ValueError, ZeroDivisionError):
                    return None
            return None

        match = {
            "id": m.get("id"),
            "isResult": m.get("isResult"),
            "date": dt,
            "datetime": m.get("datetime"),
            "homeTeam": home_team,
            "awayTeam": away_team,
            "goals": {"h": int(goals_h) if goals_h is not None else None,
                      "a": int(goals_a) if goals_a is not None else None},
            "xG": {"h": float(xg_h) if xg_h is not None else None,
                   "a": float(xg_a) if xg_a is not None else None},
            "ppda": {"h": _ppda(hh), "a": _ppda(aa)},
            "deep": {"h": (hh or {}).get("deep"), "a": (aa or {}).get("deep")},
            "npxGD": {"h": (hh or {}).get("npxGD"), "a": (aa or {}).get("npxGD")},
            "forecast": {
                "w": float(forecast.get("w")) if forecast.get("w") else None,
                "d": float(forecast.get("d")) if forecast.get("d") else None,
                "l": float(forecast.get("l")) if forecast.get("l") else None,
            },
        }
        matches.append(match)

    matches.sort(key=lambda x: (x["date"] or "", int(x["id"] or 0)))
    return matches


def build_teams(data: Dict[str, Any]) -> Dict[str, Dict[str, Any]]:
    """Table des équipes avec agrégats saison (xG, xGA, ppda, deep)."""
    out: Dict[str, Dict[str, Any]] = {}
    for tid, tinfo in (data.get("teams") or {}).items():
        if not isinstance(tinfo, dict):
            continue  # certaines valeurs de 'teams' sont des strings (robustesse)
        history = tinfo.get("history") or []
        def _avg(field):
            vals = [float(h.get(field)) for h in history
                    if h.get(field) is not None]
            return round(sum(vals) / len(vals), 3) if vals else None

        ppda_vals = []
        for h in history:
            pp = h.get("ppda") or {}
            if pp.get("att") is not None and pp.get("def"):
                try:
                    ppda_vals.append(float(pp["att"]) / float(pp["def"]))
                except (ValueError, ZeroDivisionError):
                    pass
        ppda_avg = round(sum(ppda_vals) / len(ppda_vals), 3) if ppda_vals else None

        out[str(tid)] = {
            "id": tinfo.get("id"),
            "title": standardize_team_name(tinfo.get("title") or ""),
            "short_title": tinfo.get("short_title"),
            "games": len(history),
            "wins": sum(int(h.get("wins") or 0) for h in history),
            "draws": sum(int(h.get("draws") or 0) for h in history),
            "losses": sum(int(h.get("loses") or 0) for h in history),
            "pts": sum(int(h.get("pts") or 0) for h in history),
            "scored": sum(int(h.get("scored") or 0) for h in history),
            "missed": sum(int(h.get("missed") or 0) for h in history),
            "xG": _avg("xG"), "xGA": _avg("xGA"),
            "npxG": _avg("npxG"), "npxGA": _avg("npxGA"),
            "ppda": ppda_avg,
            "deep": _avg("deep"), "deep_allowed": _avg("deep_allowed"),
        }
    return out


def main():
    ap = argparse.ArgumentParser(description="Connecteur Understat xG/PPDA")
    ap.add_argument("--league", required=True, choices=sorted(LEAGUES.keys()))
    ap.add_argument("--season", default=None, help="Année de départ (2025 = 2025/26)")
    ap.add_argument("--current", action="store_true",
                    help="Saison en cours (année de départ de la saison)")
    ap.add_argument("--output-dir", default="public/data/xg")
    args = ap.parse_args()

    season = args.season
    if args.current or not season:
        now = _date.today()
        start_year = now.year
        # sous-understat la saison "2025" = 2025/26 ; on déduit l'année de départ
        if now.month < 6:
            start_year = now.year - 1
        season = season or str(start_year)

    slug = LEAGUES[args.league]
    try:
        data = fetch_league(slug, season)
    except Exception as e:  # noqa: BLE001
        print(json.dumps({"league": args.league, "season": season, "status": "error",
                          "error": str(e)[:300]}, ensure_ascii=False))
        sys.exit(1)

    matches = build_matches(slug, season, data)
    teams = build_teams(data)
    out_dir = os.path.join(args.output_dir, args.league.lower().replace(" ", "_").replace("%", ""))
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, f"{season}.json")
    payload = {
        "_meta": {
            "source": "understat.com",
            "league": args.league,
            "league_slug": slug,
            "season": season,
            "fetched_at": datetime.now(timezone.utc).isoformat(),
            "endpoint": f"{BASE}/getLeagueData/{slug}/{season}",
            "matches": len(matches),
        },
        "matches": matches,
        "teams": teams,
    }
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False)

    print(json.dumps({"league": args.league, "season": season, "status": "ok",
                      "matches": len(matches), "teams": len(teams),
                      "output": out_path}, ensure_ascii=False))


if __name__ == "__main__":
    main()
