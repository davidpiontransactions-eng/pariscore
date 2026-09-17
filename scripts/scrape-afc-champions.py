#!/usr/bin/env python3
"""
scrape-afc-champions.py
-----------------------
Scraper FotMob via scrapling pour les compétitions AFC Champions League.

Sources :
  - AFC Champions League Elite : FotMob id 525
  - AFC Champions League Two   : FotMob id 9469

Données extraites par page :
  - Standings (groupes West/East, classements all/home/away)
  - Fixtures (matchs avec scores, dates, statuts)
  - Détails ligue (nom, saison, équipes)

Stockage : JSON dans public/data/afc/{elite,two}.json

Usage :
  python scripts/scrape-afc-champions.py              # les deux compétitions
  python scripts/scrape-afc-champions.py --elite       # seulement Elite
  python scripts/scrape-afc-champions.py --two         # seulement Two
  python scripts/scrape-afc-champions.py --dry-run     # parse sans écrire
"""
'use strict';

import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

# ─── Constantes ────────────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent.parent
OUTPUT_DIR = BASE_DIR / "public" / "data" / "afc"

FOTMOB_LEAGUES = {
    "elite": {
        "id": 525,
        "slug": "afc-champions-league-elite",
        "name": "AFC Champions League Elite",
        "url": "https://www.fotmob.com/leagues/525/overview/afc-champions-league-elite",
    },
    "two": {
        "id": 9469,
        "slug": "afc-champions-league-two",
        "name": "AFC Champions League Two",
        "url": "https://www.fotmob.com/leagues/9469/overview/afc-champions-league-two",
    },
}

# ─── Scraper ───────────────────────────────────────────────────────────────────


def fetch_league(league_key: str, league_info: dict, dry_run: bool = False) -> dict | None:
    """Récupère les données d'une ligue via scrapling + FotMob."""
    from scrapling import Fetcher

    url = league_info["url"]
    print(f"\n{'='*60}")
    print(f"  Scraping {league_info['name']} (FotMob id={league_info['id']})")
    print(f"  URL: {url}")
    print(f"{'='*60}")

    fetcher = Fetcher()
    try:
        page = fetcher.get(url)
    except Exception as e:
        print(f"  ERROR fetch: {e}")
        return None

    if page.status != 200:
        print(f"  ERROR HTTP {page.status}")
        return None

    # Extraction du JSON __NEXT_DATA__
    scripts = page.css("script#__NEXT_DATA__")
    if not scripts:
        print("  ERROR: Pas de __NEXT_DATA__ trouve")
        return None

    try:
        data = json.loads(scripts[0].text)
    except json.JSONDecodeError as e:
        print(f"  ERROR JSON parse: {e}")
        return None

    props = data.get("props", {}).get("pageProps", {})

    # Extraction des données structurées
    result = {
        "league": {
            "fotmob_id": league_info["id"],
            "name": league_info["name"],
            "slug": league_info["slug"],
            "scraped_at": datetime.now(timezone.utc).isoformat(),
        },
        "standings": extract_standings(props),
        "fixtures": extract_fixtures(props),
        "seasons": extract_seasons(props),
    }

    # Résumé
    n_groups = len(result["standings"].get("groups", []))
    n_teams = sum(len(g.get("teams", [])) for g in result["standings"].get("groups", []))
    n_fixtures = len(result["fixtures"].get("matches", []))
    n_played = sum(1 for m in result["fixtures"]["matches"] if m.get("finished"))

    print(f"  OK: {n_groups} groupes, {n_teams} equipes, {n_fixtures} matchs ({n_played} joues)")

    if not dry_run:
        out_file = OUTPUT_DIR / f"{league_key}.json"
        out_file.parent.mkdir(parents=True, exist_ok=True)
        with open(out_file, "w", encoding="utf-8") as f:
            json.dump(result, f, indent=2, ensure_ascii=False, default=str)
        print(f"  ECRIT: {out_file.relative_to(BASE_DIR)}")

    return result


def extract_standings(props: dict) -> dict:
    """Extrait les classements depuis le JSON FotMob."""
    table_data = props.get("table", [])
    if not table_data:
        return {"groups": []}

    first_table = table_data[0] if isinstance(table_data, list) else table_data
    data = first_table.get("data", first_table)

    groups = []
    tables = data.get("tables", [])

    for tbl in tables:
        group = {
            "name": tbl.get("leagueName", "Unknown"),
            "fotmob_league_id": tbl.get("leagueId"),
            "teams": [],
        }

        all_table = tbl.get("table", {}).get("all", [])
        for team in all_table:
            group["teams"].append({
                "position": team.get("idx"),
                "name": team.get("name"),
                "short_name": team.get("shortName"),
                "fotmob_team_id": team.get("id"),
                "played": team.get("played", 0),
                "wins": team.get("wins", 0),
                "draws": team.get("draws", 0),
                "losses": team.get("losses", 0),
                "goals_for": parse_goals(team.get("scoresStr", ""), 0),
                "goals_against": parse_goals(team.get("scoresStr", ""), 1),
                "goal_difference": team.get("goalConDiff", 0),
                "points": team.get("pts", 0),
                "qualified": team.get("qualColor") is not None,
            })

        groups.append(group)

    return {
        "composite": data.get("composite", False),
        "groups": groups,
    }


def parse_goals(scores_str: str, index: int) -> int:
    """Parse '4-0' → (4, 0)."""
    try:
        parts = scores_str.split("-")
        return int(parts[index].strip())
    except (IndexError, ValueError):
        return 0


def extract_fixtures(props: dict) -> dict:
    """Extrait les matchs (fixtures + résultats)."""
    fixtures_data = props.get("fixtures", {})
    all_matches = fixtures_data.get("allMatches", [])

    matches = []
    for m in all_matches:
        status = m.get("status", {})
        matches.append({
            "fotmob_match_id": m.get("id"),
            "round": m.get("round"),
            "home": {
                "name": m.get("home", {}).get("name"),
                "fotmob_team_id": m.get("home", {}).get("id"),
            },
            "away": {
                "name": m.get("away", {}).get("name"),
                "fotmob_team_id": m.get("away", {}).get("id"),
            },
            "utc_time": status.get("utcTime"),
            "finished": status.get("finished", False),
            "started": status.get("started", False),
            "cancelled": status.get("cancelled", False),
            "score": status.get("scoreStr"),
            "status_short": status.get("reason", {}).get("short"),
        })

    return {
        "total": len(matches),
        "played": sum(1 for m in matches if m["finished"]),
        "upcoming": sum(1 for m in matches if not m["finished"] and not m["cancelled"]),
        "first_unplayed_id": fixtures_data.get("firstUnplayedMatchId"),
        "matches": matches,
    }


def extract_seasons(props: dict) -> list:
    """Extrait les saisons disponibles (strings ou objets)."""
    seasons = props.get("allAvailableSeasons", [])
    result = []
    for s in seasons[:10]:
        if isinstance(s, str):
            result.append({"name": s, "is_current": False})
        elif isinstance(s, dict):
            result.append({
                "name": s.get("name", s.get("label", str(s))),
                "is_current": s.get("selected", s.get("is_current", False)),
            })
    # Marquer la première comme courante
    if result:
        result[0]["is_current"] = True
    return result


# ─── Main ──────────────────────────────────────────────────────────────────────


def main():
    args = sys.argv[1:]
    dry_run = "--dry-run" in args
    only_elite = "--elite" in args
    only_two = "--two" in args

    print(f"AFC Champions League Scraper — {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    print(f"Mode: {'DRY RUN' if dry_run else 'WRITE'}")

    results = {}
    for key, info in FOTMOB_LEAGUES.items():
        if (only_elite and key != "elite") or (only_two and key != "two"):
            continue

        result = fetch_league(key, info, dry_run)
        if result:
            results[key] = result
        time.sleep(1)  # pause entre les deux requêtes

    # Index global
    if not dry_run and results:
        index = {
            "scraped_at": datetime.now(timezone.utc).isoformat(),
            "competitions": {},
        }
        for key, r in results.items():
            index["competitions"][key] = {
                "fotmob_id": r["league"]["fotmob_id"],
                "name": r["league"]["name"],
                "groups": len(r["standings"].get("groups", [])),
                "total_teams": sum(
                    len(g.get("teams", []))
                    for g in r["standings"].get("groups", [])
                ),
                "total_fixtures": r["fixtures"]["total"],
                "fixtures_played": r["fixtures"]["played"],
            }
        index_file = OUTPUT_DIR / "index.json"
        with open(index_file, "w", encoding="utf-8") as f:
            json.dump(index, f, indent=2, ensure_ascii=False)
        print(f"\n  INDEX ECRIT: {index_file.relative_to(BASE_DIR)}")

    print(f"\n{'='*60}")
    print(f"  Terminé: {len(results)} compétition(s) scrapée(s)")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
