# FBref Advanced Stats — Pattern B Batch Scraper

Scrape FBref team-season statistics via [soccerdata](https://github.com/probberechts/soccerdata) and dump JSON files consumed by PariScore Node.js at boot (`loadAdvancedFBrefStats()`).

## Install

```bash
cd scripts
python3 -m pip install -r requirements.txt
```

Requirements: Python 3.10+ recommended (uses `dict[str, Any]` PEP 604 syntax).

## Run manually

```bash
# All leagues, current season
python scripts/scrape_advanced_stats.py

# One league
python scripts/scrape_advanced_stats.py --league "ENG-Premier League"

# Custom season
python scripts/scrape_advanced_stats.py --season 2024-2025

# Custom output directory
python scripts/scrape_advanced_stats.py --output-dir /tmp/fbref
```

## Output

Files written to `data/fbref_advanced/{slug}_{season}.json` :

- `en_premier_league_2025-2026.json` — Premier League
- `es_la_liga_2025-2026.json` — La Liga
- `de_bundesliga_2025-2026.json` — Bundesliga
- `it_serie_a_2025-2026.json` — Serie A
- `fr_ligue_1_2025-2026.json` — Ligue 1
- `en_championship_2025-2026.json` — Championship (gap BSD comblé)
- `_summary.json` — meta (successes count, durations, statuses)

Each file structure :

```json
{
  "_meta": {
    "league": "ENG-Premier League",
    "season": "2025-2026",
    "fetched_at": "2026-05-13T03:00:00Z",
    "source": "fbref-soccerdata"
  },
  "team_season_stats": {
    "standard": [ { "team": "...", "goals": 42, "xg": 38.1, ... }, ... ],
    "shooting": [ ... ],
    "passing": [ ... ],
    "defense": [ ... ],
    "possession": [ ... ]
  }
}
```

Node.js reads via `loadAdvancedFBrefStats()` into `db.fbrefStats` keyed by normalized team name.

## Cron

### Option A — Render cron (recommandé prod)

`render.yaml` add :

```yaml
- type: cron
  name: pariscore-fbref-scrape
  runtime: python
  schedule: "0 3 * * *"    # 03:00 UTC nightly
  buildCommand: pip install -r scripts/requirements.txt
  startCommand: python scripts/scrape_advanced_stats.py
  envVars:
    - key: SOCCERDATA_DIR
      value: /tmp/soccerdata
```

Persistent disk required for `data/fbref_advanced/` to survive cron → web service.
Or commit & push files via `git push` from cron job.

### Option B — GitHub Actions nightly

`.github/workflows/fbref-scrape.yml` :

```yaml
name: FBref nightly scrape
on:
  schedule:
    - cron: '0 3 * * *'
  workflow_dispatch:
jobs:
  scrape:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: '3.11' }
      - run: pip install -r scripts/requirements.txt
      - run: python scripts/scrape_advanced_stats.py
      - run: |
          git config user.email "bot@pariscore"
          git config user.name "FBref Bot"
          git add data/fbref_advanced/
          git diff --staged --quiet || git commit -m "chore(fbref): nightly advanced stats refresh"
          git push
```

### Option C — Local crontab

```cron
0 3 * * * cd /path/to/PariScorebis && /usr/bin/python3 scripts/scrape_advanced_stats.py >> data/fbref_advanced/cron.log 2>&1
```

## Rate limiting

- FBref policy : **10 req/min** (Sports-Reference.com bot policy).
- Script default : `SLEEP_BETWEEN_CALLS_SEC = 7.0` → ~8 req/min (safety margin).
- 6 ligues × 5 stat_types = 30 calls → ~4 min total wall time.
- Cache automatique soccerdata via `SOCCERDATA_DIR` (~/soccerdata par défaut). Cron retries hit cache si run fréquemment.

## Troubleshooting

- `ERROR: missing dependency` → `pip install -r scripts/requirements.txt`
- `403 Cloudflare` → augmenter `SLEEP_BETWEEN_CALLS_SEC` à 10s, ou utiliser Tor proxy via `sd.FBref(..., proxy='tor')` (modifier script).
- DataFrame columns MultiIndex flat → géré par `safe_records()` (concaténation tuple via `__`).
- Cache stale → supprimer `~/soccerdata/FBref/` ou set `SOCCERDATA_NOCACHE=true`.

## TOS / Légalité

Le scraping de FBref/Sports-Reference est public mais à usage **non-commercial** strict per TOS. Pour PariScore SaaS payant, relire TOS et envisager licence Opta directe ou Statsbomb API si commercialisation prévue.
