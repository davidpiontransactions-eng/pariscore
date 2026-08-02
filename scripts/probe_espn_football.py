#!/usr/bin/env python3
"""
probe_espn_football.py — Validation de la source gratuite ESPN (football).

Vérifie la structure des endpoints publics ESPN (scoreboard + standings) et
produit un rapport de validation JSON. Utilisé par les audits périodiques de
sources (voir .context/session-rankings-pipeline.md).

USAGE:
    python scripts/probe_espn_football.py --league eng.1            # EPL
    python scripts/probe_espn_football.py --league eng.1 --output-dir public/data/espn-probe
"""

import argparse, json, os, sys
from datetime import datetime, timezone

try:
    import requests
except ImportError:
    print(json.dumps({"error": "requests requis — pip install requests"}), file=sys.stderr)
    sys.exit(1)

BASE = "https://site.api.espn.com/apis/site/v2/sports/soccer"
BASE_V2 = "https://site.api.espn.com/apis/v2/sports/soccer"
HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}

LEAGUES = {
    "eng.1": "EPL", "esp.1": "La Liga", "ger.1": "Bundesliga",
    "ita.1": "Serie A", "fra.1": "Ligue 1", "ned.1": "Eredivisie",
    "por.1": "Primeira Liga", "uefa.champions": "UEFA Champions League",
}


def fetch_json(url: str) -> dict:
    r = requests.get(url, headers=HEADERS, timeout=20)
    r.raise_for_status()
    return r.json()


def validate(league_code: str, season: str | None = None) -> dict:
    slug = LEAGUES.get(league_code, league_code)
    report = {"league": slug, "endpoints": {}}
    # Scoreboard
    try:
        sb = fetch_json(f"{BASE}/{league_code}/scoreboard")
        events = sb.get("events", [])
        report["endpoints"]["scoreboard"] = {
            "ok": True,
            "events": len(events),
            "sample_teams": [e["name"] for e in events[:2]],
        }
    except Exception as e:  # noqa: BLE001
        report["endpoints"]["scoreboard"] = {"ok": False, "error": str(e)[:200]}
    # Standings (API v2 — l'endpoint /site/v2/.../standings retourne {} sans
    # saison ; /apis/v2/... retourne children[].standings.entries = équipes)
    try:
        st = fetch_json(f"{BASE_V2}/{league_code}/standings")
        entries = st.get("children", [])
        total = sum(len(c.get("standings", {}).get("entries", [])) for c in entries)
        report["endpoints"]["standings"] = {"ok": True, "groups": len(entries), "teams": total}
    except Exception as e:  # noqa: BLE001
        report["endpoints"]["standings"] = {"ok": False, "error": str(e)[:200]}
    return report


def main():
    ap = argparse.ArgumentParser(description="Probe ESPN public API (football)")
    ap.add_argument("--league", default="eng.1", choices=sorted(LEAGUES.keys()))
    ap.add_argument("--output-dir", default=None,
                    help="Écrit le rapport JSON (sinon stdout)")
    args = ap.parse_args()

    report = validate(args.league)
    report["_meta"] = {
        "source": "site.api.espn.com",
        "fetched_at": datetime.now(timezone.utc).isoformat(),
    }
    if args.output_dir:
        os.makedirs(args.output_dir, exist_ok=True)
        out = os.path.join(args.output_dir, f"espn-{args.league.replace('.', '-')}.json")
        with open(out, "w", encoding="utf-8") as f:
            json.dump(report, f, ensure_ascii=False, indent=2)
        print(json.dumps({"status": "ok", "output": out, "league": report["league"]}))
    else:
        print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
