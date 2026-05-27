# SPS Pipeline — Endpoint Contract

**Status**: Draft v1.0 — 2026-05-27
**Producer**: `server.js` (Node, PariScore backend)
**Consumer**: `cron_sps_updater.py` (Python sidecar, cron 12h)
**Tracking**: bd `q1w5` (wire pipeline tennis server.js)

---

## Endpoint

```
GET /api/v1/tennis/upcoming
```

**Auth**: none (read-only, internal cron consumer).
**Rate limit**: 1 call per cron tick (12h). Add 5rps server-side cap as defense.
**Cache**: server-side cache 5min recommended (matches list changes slowly).

### Query parameters (optional)

| Param | Type | Default | Description |
|---|---|---|---|
| `lookahead_min_h` | int | 24 | Lower bound of kickoff window in hours |
| `lookahead_max_h` | int | 36 | Upper bound of kickoff window in hours |
| `tour` | string | (all) | Filter by `ATP` / `WTA` / `atp` / `wta` |

The Python consumer ignores these query params (filters client-side) but they are
recommended for future-proofing and for ad-hoc curl testing.

---

## Response schema

```json
{
  "matches": [
    {
      "id":              "string  REQUIRED  — unique match identifier",
      "surface":         "string  REQUIRED  — one of: clay | grass | hard (case-insensitive)",
      "tour":            "string  REQUIRED  — ATP | WTA (case-insensitive)",
      "home_player_id":  "string  REQUIRED  — player A identifier (matches tennis_matches_internal.winner_player_id / loser_player_id)",
      "away_player_id":  "string  REQUIRED  — player B identifier",
      "commence_time":   "string  REQUIRED  — ISO 8601 UTC, e.g. '2026-05-28T13:00:00Z'",

      "tourney_name":    "string  optional",
      "round":           "string  optional",
      "best_of":         "integer optional  — 3 | 5",
      "home_player_name":"string  optional  — display only",
      "away_player_name":"string  optional  — display only"
    }
  ]
}
```

### Required fields enforcement

The Python consumer (`fetch_upcoming_matches`) rejects matches that are missing
any of the following — they are silently dropped (DEBUG log):

- `id`
- `surface` (must normalize to one of {clay, grass, hard})
- `home_player_id` AND `away_player_id`
- `commence_time` (must parse as ISO 8601, must fall in lookahead window)

### Backwards-compatible aliases

For server-side flexibility, the consumer accepts these alternate field names:

| Canonical | Aliases accepted |
|---|---|
| `id` | `match_id` |
| `tour` | `circuit` |
| `home_player_id` | `player_a_id` |
| `away_player_id` | `player_b_id` |

---

## Example payload

```json
{
  "matches": [
    {
      "id": "atp-2026-rg-r1-001",
      "surface": "clay",
      "tour": "ATP",
      "home_player_id": "104925",
      "away_player_id": "126774",
      "commence_time": "2026-05-28T11:00:00Z",
      "tourney_name": "Roland Garros",
      "round": "R1",
      "best_of": 5,
      "home_player_name": "Novak Djokovic",
      "away_player_name": "Carlos Alcaraz"
    },
    {
      "id": "wta-2026-rg-r1-014",
      "surface": "clay",
      "tour": "WTA",
      "home_player_id": "230234",
      "away_player_id": "215765",
      "commence_time": "2026-05-28T13:30:00Z",
      "tourney_name": "Roland Garros",
      "round": "R1",
      "best_of": 3,
      "home_player_name": "Iga Świątek",
      "away_player_name": "Coco Gauff"
    }
  ]
}
```

---

## Error contract

| Server condition | HTTP code | Body | Consumer behavior |
|---|---|---|---|
| All OK | 200 | `{matches: [...]}` | Process normally |
| Empty list | 200 | `{matches: []}` | Pipeline exits clean, heartbeat written |
| Server error | 5xx | (any) | Consumer raises `MatchSourceError`, logs ERROR, exit code 2 |
| Bad route | 404 | (any) | Same as 5xx — `MatchSourceError` |
| Malformed JSON | 200 | (non-JSON) | `MatchSourceError` (JSONDecodeError caught) |
| Missing `matches` key | 200 | `{foo: 1}` | `MatchSourceError: Invalid payload shape` |
| Null payload | 200 | `null` | `MatchSourceError: Invalid payload shape` |

The consumer **always** writes a heartbeat (`kv.sps_last_run`) regardless of
errors, so monitoring can detect stale runs.

---

## Implementation notes for `server.js`

Suggested data sources to feed this endpoint (priority order):
1. **BSD live feed** — primary for next-24h ATP/WTA matches
2. **ESPN public fixtures** — backup
3. **Odds API tennis fixtures** — backup #2

The endpoint should join:
- Match metadata (surface, tour, round, kickoff)
- Player IDs that link to `tennis_matches_internal.winner_player_id` /
  `loser_player_id` — i.e. the canonical PariScore integer player_id schema

If a feed yields a player without a PariScore integer ID (e.g. brand-new player),
either:
- Omit the match from `matches[]` (preferred — consumer filters anyway)
- OR include with `home_player_id: null` and document the exception

### Pseudo-route

```javascript
app.get('/api/v1/tennis/upcoming', async (req, res) => {
  const lookaheadMin = parseInt(req.query.lookahead_min_h, 10) || 24;
  const lookaheadMax = parseInt(req.query.lookahead_max_h, 10) || 36;
  const tourFilter = (req.query.tour || '').toUpperCase();

  const now = Date.now();
  const lo = now + lookaheadMin * 3600_000;
  const hi = now + lookaheadMax * 3600_000;

  const matches = (db.matches || [])
    .filter(m => m.sport === 'tennis')
    .filter(m => !tourFilter || (m.tour || '').toUpperCase() === tourFilter)
    .filter(m => {
      const ts = Date.parse(m.commence_time);
      return ts >= lo && ts <= hi;
    })
    .map(m => ({
      id: m.id,
      surface: m.surface,
      tour: m.tour,
      home_player_id: m.home_player_id,
      away_player_id: m.away_player_id,
      commence_time: m.commence_time,
      tourney_name: m.league || m.tourney_name,
      round: m.round,
      best_of: m.best_of,
      home_player_name: m.home_team,
      away_player_name: m.away_team,
    }));

  res.json({ matches });
});
```

---

## Versioning

Breaking changes (renamed/removed required field) bump this contract to v2.0 and
require a new endpoint path `/api/v1/tennis/upcoming/v2` (parallel deployment
during transition). Additive changes (new optional fields) do not bump version.

---

---

## Deploy — VPS OVH PariScore (R5)

### 1. Pull du code sur VPS

```bash
cd /home/ubuntu/pariscore
git pull
pm2 restart pariscore     # recharge server.js (route /api/v1/tennis/upcoming)
```

### 2. Vérification endpoint live

```bash
# Sans token (mode dev / token désactivé)
curl -s http://localhost:3000/api/v1/tennis/upcoming | jq '.meta'

# Smoke health check + sps_pipeline section
curl -s http://localhost:3000/api/v1/sources/health | jq '.sps_pipeline'
```

Réponse attendue minimale :
```json
{
  "matches": [...],
  "meta": {
    "now_utc": "...",
    "lookahead_min_h": 24,
    "lookahead_max_h": 36,
    "tour_filter": null,
    "dates_scanned": ["YYYY-MM-DD", "YYYY-MM-DD", "YYYY-MM-DD"],
    "total": N,
    "latency_ms": <int>,
    "warnings": []
  }
}
```

### 3. Variables d'environnement `.env` (VPS uniquement)

À ajouter dans `/home/ubuntu/pariscore/.env` :

```bash
# === Surface PowerScore (SPS) pipeline ===
# Token interne optionnel : si défini, l'endpoint /api/v1/tennis/upcoming
# exige le header `x-pariscore-internal-token: <value>`. Si vide, accès ouvert
# (mode initial freemium — payload public uniquement, OK).
SPS_INTERNAL_TOKEN=

# Côté cron Python (mêmes valeurs que server.js sauf override):
# PARISCORE_API_URL=http://localhost:3000/api/v1/tennis/upcoming
# PARISCORE_DB_PATH=/home/ubuntu/pariscore/pariscore.db
# PARISCORE_LOG_PATH=/home/ubuntu/pariscore/logs/sps_updater.log
```

> ⚠️ Si `SPS_INTERNAL_TOKEN` est activé, le cron Python doit envoyer le header :
> ```python
> # À ajouter dans cron_sps_updater.py fetch_upcoming_matches() — voir bd q1w5 follow-up
> req.headers["x-pariscore-internal-token"] = os.environ.get("SPS_INTERNAL_TOKEN", "")
> ```
> Actuellement non implémenté côté cron — laisser `SPS_INTERNAL_TOKEN=` vide en première
> mise en prod.

### 4. Crontab installation

```bash
# Édition crontab utilisateur
crontab -e
```

Ajout (12h schedule recommandé 05:30 + 17:30 Paris) :

```cron
30 5,17 * * * cd /home/ubuntu/pariscore && /usr/bin/python3 cron_sps_updater.py
```

Vérification :
```bash
crontab -l                                                 # lister les jobs actifs
tail -f /home/ubuntu/pariscore/logs/sps_updater.log        # streamer les logs
```

### 5. Dry-run validation post-deploy

Avant d'activer la persistence en prod, faire tourner un dry-run manuel :

```bash
cd /home/ubuntu/pariscore
PARISCORE_SPS_DRY_RUN=1 PARISCORE_LOG_LEVEL=DEBUG /usr/bin/python3 cron_sps_updater.py
```

Sortie attendue :
- `Fetched N upcoming matches. [DRY-RUN]`
- `[DRY-RUN] Skipping K pending upserts (would have been written).`
- `Summary: matches=N ok=K skipped=0 errors=0`
- Logs détaillés (DEBUG) pour 5 premiers SPS sample

Si `errors > 0` → consulter `logs/sps_updater.log` + résoudre avant retrait du flag.

### 6. Monitoring stale-detection

```bash
# Vérification rapide ad-hoc
curl -s http://localhost:3000/api/v1/sources/health | jq '.sps_pipeline.status'
# Attendu : "ok"  (pas "stale" / "degraded" / "unknown")
```

Pour alerting automatique : utiliser le helper Telegram existant (variable
`TELEGRAM_BOT_TOKEN` `.env`) + ajouter un cron horaire qui POSTe vers Telegram
si `sps_pipeline.status` ≠ "ok". À traiter par bd `R1` (Telegram observability).

### 7. Pré-requis populés

| Pré-requis | bd | Statut |
|---|---|---|
| `tennis_matches_internal` rempli (52 semaines historique ATP + WTA) | `dl49` | en cours |
| `player_id ↔ ta_id` mapping table | `qvan` | non démarré |
| `tennis_ta_cache` overrides peuplé | `qvan` | non démarré |

Sans ces prérequis, le cron tourne mais SPS = fallback 50.0 partout
(`confidence_full: false` flag déjà disponible côté UI pour griser).

---

## See also

- `cron_sps_updater.py` — consumer implementation
- `surface_powerscore.py` — SPS calculator
- `.context/test-report-cron-sps-updater.md` — QA report v1.0
- `.context/test-report-surface-powerscore.md` — SPS QA report v1.0
- bd `q1w5` — wire pipeline tennis (this endpoint)
- bd `qvan` — sourcing 8 metrics live ATP/WTA (prereq)
- bd `dl49` — ETL Elo interne BSD/ESPN (prereq populate tennis_matches_internal)
