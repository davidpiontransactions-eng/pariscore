"""
fbref_extract.py — Sidecar Python pour soccerdata FBref ETL
─────────────────────────────────────────────────────────────
Mission: bd ParisScorebis-8lqf

USAGE (via Node spawner):
  python3 scripts/fbref_extract.py --leagues "ENG-Premier League" --seasons 2024
  python3 scripts/fbref_extract.py --all --season 2024
  python3 scripts/fbref_extract.py --output /tmp/fbref.json

OUTPUT: JSON sur stdout (NDJSON-like ou single root, selon --output)
  Schema: { leagues: { <league_id>: { season: <YYYY>, matches: [...] } } }

DEPENDS: pip install soccerdata pandas

⚠️ LEGAL FLAG: Sports Reference ToS interdit scraping commercial.
   Cette extraction = RESEARCH/EDUCATIONAL USE ONLY.
   NE PAS exposer data dans UI publique commerciale PariScore.
   Flag '_source=etl-fbref-research' dans chaque match.
"""

import sys
import json
import argparse
import warnings
from datetime import datetime

# Silence soccerdata warnings (CF retry, cache hits, etc.)
warnings.filterwarnings('ignore')

try:
    import soccerdata as sd
    import pandas as pd
except ImportError as e:
    print(json.dumps({
        'error': 'soccerdata + pandas required',
        'install': 'pip install soccerdata pandas',
        'detail': str(e),
    }), file=sys.stderr)
    sys.exit(1)

# Ligues supportees soccerdata-FBref (format 'COUNTRY-NAME')
SUPPORTED_LEAGUES = [
    'ENG-Premier League',
    'ENG-Championship',
    'ESP-La Liga',
    'GER-Bundesliga',
    'ITA-Serie A',
    'FRA-Ligue 1',
    'NED-Eredivisie',
    'POR-Primeira Liga',
    'INT-Champions League',
    'INT-Europa League',
]


def league_id_slug(league_name: str) -> str:
    """Slug court compatible loadHistory v12.29 pattern."""
    return league_name.lower().replace('-', '_').replace(' ', '_')


def extract_for_season(leagues: list, season: int) -> dict:
    """Extract matches + schedule pour 1 saison via soccerdata."""
    result = {'leagues': {}, 'season': season, 'extracted_at': datetime.utcnow().isoformat() + 'Z'}

    fbref = sd.FBref(leagues=leagues, seasons=[season])

    for league in leagues:
        try:
            schedule = fbref.read_schedule(league=league)
            if schedule is None or len(schedule) == 0:
                continue

            # Reset index pour acceder aux colonnes proprement
            schedule = schedule.reset_index() if hasattr(schedule, 'index') else schedule

            matches = []
            for _, row in schedule.iterrows():
                try:
                    match_record = {
                        'id': f'fbref_{season}_{league_id_slug(league)}_{row.get("game_id", row.get("match_id", ""))}',
                        'source': 'fbref-soccerdata',
                        'research_only': True,
                        'league_id': league_id_slug(league),
                        'league_name': league,
                        'season': season,
                        'date': str(row.get('date', '')),
                        'home_team': str(row.get('home_team', row.get('team_home', ''))),
                        'away_team': str(row.get('away_team', row.get('team_away', ''))),
                        'home_score': _safe_int(row.get('home_score', row.get('score_home'))),
                        'away_score': _safe_int(row.get('away_score', row.get('score_away'))),
                        'round': str(row.get('round', row.get('matchweek', ''))),
                        'venue': str(row.get('venue', '')),
                        'referee': str(row.get('referee', '')),
                        '_attribution': 'sports-reference.com/fbref via soccerdata (research only)',
                    }
                    # Ne pas inclure matches sans equipes valides
                    if match_record['home_team'] and match_record['away_team']:
                        matches.append(match_record)
                except Exception:
                    continue  # skip ligne malformee

            result['leagues'][league_id_slug(league)] = {
                'meta': {'name': league, 'season': season, 'last_update': result['extracted_at']},
                'matches': matches,
            }
            print(f'[fbref-extract] {league} {season}: {len(matches)} matchs', file=sys.stderr)
        except Exception as e:
            print(f'[fbref-extract] {league} {season} ERREUR: {e}', file=sys.stderr)

    return result


def _safe_int(v):
    """Convertit en int ou retourne None."""
    if v is None or pd.isna(v) if hasattr(pd, 'isna') else v is None:
        return None
    try:
        return int(v)
    except (ValueError, TypeError):
        return None


def main():
    parser = argparse.ArgumentParser(description='FBref ETL via soccerdata (research only)')
    parser.add_argument('--season', type=int, help='Saison (e.g. 2024 pour 2024-25)')
    parser.add_argument('--leagues', type=str, help='Comma-separated leagues (e.g. "ENG-Premier League,FRA-Ligue 1")')
    parser.add_argument('--all', action='store_true', help='Toutes les ligues supportees')
    parser.add_argument('--output', type=str, help='Chemin output JSON (sinon stdout)')
    parser.add_argument('--seasons-range', type=str, help='Range saisons "2020-2024"')
    args = parser.parse_args()

    if args.all:
        target_leagues = SUPPORTED_LEAGUES
    elif args.leagues:
        target_leagues = [l.strip() for l in args.leagues.split(',') if l.strip()]
    else:
        target_leagues = ['ENG-Premier League']

    if args.seasons_range:
        start, end = map(int, args.seasons_range.split('-'))
        target_seasons = list(range(start, end + 1))
    elif args.season:
        target_seasons = [args.season]
    else:
        target_seasons = [datetime.utcnow().year - 1]

    combined = {
        'schema_version': 1,
        'generated_at': datetime.utcnow().isoformat() + 'Z',
        'source': 'fbref via soccerdata',
        'license': 'sports-reference.com ToS — RESEARCH USE ONLY',
        'compliance': 'data not for commercial UI display per Sports Reference ToS',
        'leagues': {},
    }

    for season in target_seasons:
        season_result = extract_for_season(target_leagues, season)
        # Merge leagues (key by league_id + season suffix)
        for league_id, league_data in season_result.get('leagues', {}).items():
            key = f'{league_id}_{season}'
            combined['leagues'][key] = league_data

    output_json = json.dumps(combined, indent=2, default=str)
    if args.output:
        with open(args.output, 'w') as f:
            f.write(output_json)
        print(f'[fbref-extract] OK — output: {args.output}', file=sys.stderr)
    else:
        print(output_json)


if __name__ == '__main__':
    main()
