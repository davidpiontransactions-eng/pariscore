#!/usr/bin/env python3
"""
PariScore — FBref advanced stats batch scraper (Pattern B).

Scrapes FBref team season statistics via soccerdata for Big 5 + Championship,
writes JSON files to data/fbref_advanced/ for Node.js consumption.

Run nightly via cron. Respects FBref 10 req/min rate limit through soccerdata
internal delays + explicit time.sleep between calls.

Usage:
  python scripts/scrape_advanced_stats.py [--season 2025-2026] [--league "ENG-Premier League"]

Environment:
  SOCCERDATA_DIR : optional soccerdata cache directory (default ~/soccerdata).

Exit codes:
  0 — success (at least one league scraped)
  1 — fatal error (soccerdata not installed, invalid args, etc.)
  2 — all leagues failed
"""
from __future__ import annotations

import argparse
import datetime as _dt
import json
import os
import sys
import time
from pathlib import Path
from typing import Any

try:
    import pandas as pd
    import soccerdata as sd
except ImportError as e:
    print(f"ERROR: missing dependency ({e}). Install: pip install -r scripts/requirements.txt", file=sys.stderr)
    sys.exit(1)

# Big 5 + Championship — gaps réels post-audit BSD (Championship absent BSD)
LEAGUES: list[tuple[str, str]] = [
    ('ENG-Premier League', 'en_premier_league'),
    ('ESP-La Liga',        'es_la_liga'),
    ('GER-Bundesliga',     'de_bundesliga'),
    ('ITA-Serie A',        'it_serie_a'),
    ('FRA-Ligue 1',        'fr_ligue_1'),
    ('ENG-Championship',   'en_championship'),
]

# soccerdata 1.9.0 FBref.read_team_season_stats supported stat_types (verified via inspect):
#   ['standard', 'keeper', 'shooting', 'playing_time', 'misc']
# passing/defense/possession exist only on read_player_season_stats — out of scope here.
STAT_TYPES: list[str] = ['standard', 'shooting', 'keeper', 'playing_time', 'misc']

# 10 req/min FBref policy => 6.5s minimum between requests (safety margin).
SLEEP_BETWEEN_CALLS_SEC = 7.0

OUT_DIR = Path(__file__).resolve().parent.parent / 'data' / 'fbref_advanced'


def current_season() -> str:
    """Compute current European season string (e.g. '2025-2026')."""
    today = _dt.date.today()
    y = today.year if today.month >= 7 else today.year - 1
    return f"{y}-{y + 1}"


def safe_records(df: pd.DataFrame) -> list[dict[str, Any]]:
    """DataFrame → list of dicts, flattening MultiIndex columns if needed."""
    if df is None or df.empty:
        return []
    # Flatten MultiIndex columns (FBref returns MultiIndex on some stat_types)
    if isinstance(df.columns, pd.MultiIndex):
        df = df.copy()
        df.columns = ['__'.join(str(c) for c in tup if c).strip() for tup in df.columns.values]
    df = df.reset_index()
    # to_json + reload to coerce numpy types → JSON-safe primitives
    return json.loads(df.to_json(orient='records', date_format='iso'))


def scrape_league(league: str, slug: str, season: str) -> dict[str, Any] | None:
    print(f"[FBref] {league} {season} ...", flush=True)
    try:
        fbref = sd.FBref(league, season)
    except Exception as e:
        print(f"  init err: {type(e).__name__}: {e}", file=sys.stderr)
        return None
    out: dict[str, Any] = {
        '_meta': {
            'league': league,
            'slug': slug,
            'season': season,
            'fetched_at': _dt.datetime.now(_dt.timezone.utc).isoformat(),
            'source': 'fbref-soccerdata',
        },
        'team_season_stats': {},
    }
    ok_count = 0
    for stat in STAT_TYPES:
        try:
            df = fbref.read_team_season_stats(stat_type=stat)
            records = safe_records(df)
            out['team_season_stats'][stat] = records
            print(f"  [OK]{stat}: {len(records)} rows", flush=True)
            ok_count += 1
        except Exception as e:
            print(f"  [FAIL]{stat}: {type(e).__name__}: {str(e)[:140]}", file=sys.stderr)
            out['team_season_stats'][stat] = []
        time.sleep(SLEEP_BETWEEN_CALLS_SEC)
    if ok_count == 0:
        print(f"  ->all stat_types failed for {league}", file=sys.stderr)
        return None
    return out


def main() -> int:
    parser = argparse.ArgumentParser(description='PariScore FBref batch scraper')
    parser.add_argument('--season', default=None, help='Season e.g. 2025-2026 (default: auto-detect)')
    parser.add_argument('--league', default=None, help='Only this league (default: all)')
    parser.add_argument('--output-dir', default=str(OUT_DIR), help='Output directory')
    args = parser.parse_args()

    season = args.season or current_season()
    out_dir = Path(args.output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    leagues = LEAGUES
    if args.league:
        leagues = [(L, S) for (L, S) in LEAGUES if L == args.league]
        if not leagues:
            print(f"ERROR: league '{args.league}' not in scope. Choices:", file=sys.stderr)
            for L, _ in LEAGUES:
                print(f"  - {L}", file=sys.stderr)
            return 1

    print(f"Output dir : {out_dir}")
    print(f"Season     : {season}")
    print(f"Leagues    : {len(leagues)}")
    print(f"Rate limit : 1 call / {SLEEP_BETWEEN_CALLS_SEC}s (~{int(60/SLEEP_BETWEEN_CALLS_SEC)} req/min)")
    print()

    summary: dict[str, Any] = {
        'season': season,
        'started_at': _dt.datetime.now(_dt.timezone.utc).isoformat(),
        'leagues': [],
    }
    successes = 0
    for league, slug in leagues:
        data = scrape_league(league, slug, season)
        if data is None:
            summary['leagues'].append({'league': league, 'slug': slug, 'status': 'failed'})
            continue
        out_path = out_dir / f"{slug}_{season}.json"
        out_path.write_text(json.dumps(data, ensure_ascii=False, indent=2, default=str), encoding='utf-8')
        summary['leagues'].append({
            'league': league,
            'slug': slug,
            'file': out_path.name,
            'size_bytes': out_path.stat().st_size,
            'status': 'ok',
        })
        successes += 1
        print(f"  ->{out_path}\n", flush=True)

    summary['finished_at'] = _dt.datetime.now(_dt.timezone.utc).isoformat()
    summary['successes'] = successes
    summary['total'] = len(leagues)
    summary_path = out_dir / '_summary.json'
    summary_path.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f"Done. Successes : {successes} / {len(leagues)}. Summary : {summary_path}")
    return 0 if successes > 0 else 2


if __name__ == '__main__':
    raise SystemExit(main())
