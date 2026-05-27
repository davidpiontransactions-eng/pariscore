# Test Report — `cron_sps_updater.py`

**Date** : 2026-05-27
**Module** : `cron_sps_updater.py` (Python sidecar cron 12h pour Surface PowerScore)
**Audité par** : `/ps-test` agent (adapted Python ETL pipeline scope)
**Dépendance** : `surface_powerscore.py` v1.1 (84 pytest pass)

---

## Périmètre adapté

| Étape standard | Applicabilité cron SPS |
|---|---|
| 1. Sync server↔frontend | ⚠️ partiel — contract vers endpoint `/api/v1/tennis/upcoming` (bd `q1w5` non encore livré) |
| 2. Null safety / dégradé | ✅ couvert (HTTP probe 9 cas + SQLite probe 6 cas) |
| 3. SIM vs LIVE | ⏸️ N/A (ETL, pas de SIM) |
| 4. Validation routes API | ✅ couvert (HTTP 500/404/empty/null/malformed/missing fields) |
| 5. États UI | ⏸️ N/A (cron sans UI) |
| 6. UX seuils visuels | ✅ couvert (normalize bounds, fallback 50.0) |
| 7. Performance | ✅ couvert (rate limit + thread pool + index plan analysis) |
| 8. Syntaxe finale | ✅ `python -m py_compile` OK |

---

## ✅ Tests passés

### Syntaxe + import
- `python -m py_compile cron_sps_updater.py` → exit 0
- Import `from cron_sps_updater import ...` propre toutes classes/helpers exportés

### HTTP probe (9 cas dégradés contre mock server)
| Endpoint | Comportement | Verdict |
|---|---|---|
| `/empty` (matches=[]) | 0 résultats sans crash | ✅ |
| `/no_matches_key` (manque clé) | `MatchSourceError: Invalid payload shape` | ✅ |
| `/null` (payload `null`) | `MatchSourceError: Invalid payload shape` | ✅ |
| `/malformed` (`<<not json>>`) | `MatchSourceError: JSONDecodeError caught` | ✅ |
| `/http500` | `MatchSourceError: Internal Server Error` (urlopen HTTPError caught) | ✅ |
| `/missing_fields` (id only) | filtre silencieux, 0 résultats | ✅ |
| `/bad_surface` (`surface=sand`) | filtre `surface not in {clay,grass,hard}` | ✅ |
| `/no_players` (missing IDs) | filtre `pa/pb missing` | ✅ |
| `/out_of_window` (2020 date) | filtre lookahead [24h,36h] | ✅ |

### SQLite defensive (6 cas)
- Non-numeric `player_id` → log WARNING + retourne `PlayerAggregate()` vide
- Player inexistant → 0 matches, no crash
- `end_date` futur (+400j) → 0 matches
- Surface invalide (`'lawn'`) → 0 matches
- Elo manquant → `fetch_elo()` retourne `None`
- `fetch_overall_aggregate` avec non-numeric → `(0, 0)`

### Tie-break parser
- `'7-6(4) 6-7(2) 7-6(5)'` → tb_won=2 tb_lost=1 ✅
- `score=None` → tb_won=0 tb_lost=0 ✅
- `'7-6(garbage)'` → tb_won=1 ✅ (parenthèse=marqueur TB indépendamment du contenu)

### Thread-safety / idempotence
- 5 threads × 50 writes = 250 upserts → **15 rows uniques** (PK player+surface+match) ✅
- Last-write-wins via `INSERT OR REPLACE` ✅
- `threading.Lock` global serialize correctement les écritures
- 250 writes en ~1150ms (≈4.6ms/write — acceptable pour 100-200 writes/run)

### Rate limiter
- `RateLimiter(10rps)` 3 acquires → 201ms (≥200ms attendu) ✅
- Thread-safe via lock interne

### DB pragma
- `journal_mode = wal` ✅ confirmé (cohérent avec server.js better-sqlite3 WAL)

### Normalize helpers
- `_safe_pct(0,0)` → 50.0 (fallback) ✅
- `_normalize_elo(None)` → 50.0 ✅
- `_normalize_elo(800)` → 0.0 (clamp) ✅
- `_normalize_elo(3000)` → 100.0 (clamp) ✅
- `aggregate_to_metrics(PlayerAggregate())` (vide) → tous metrics = 50.0 (defaults)

### Exit codes
- API unreachable → `errors=1` retourné dans `PipelineStats`, `main()` exit 2 (partial)
- API success matches=[] → exit 0

---

## ⚠️ Avertissements (non bloquants)

### W1 — Index manquant sur (winner_player_id, surface, match_date)
**Localisation** : `tennis_matches_internal` schema
**Problème** : `EXPLAIN QUERY PLAN` confirme **SCAN tennis_matches_internal** (full table scan) pour `WHERE winner_player_id=? AND LOWER(surface)=? AND match_date BETWEEN ? AND ?`. Indexes existants : `tourney_date`, `winner_name`, `loser_name`, `(surface, tour)`, `(tour, tourney_date)`. Aucun sur `winner_player_id`/`loser_player_id`.
**Impact** : Avec 100k+ rows (ETL bd `dl49`), chaque query = full scan O(n). Pour 100 joueurs × 2 surfaces × 2 queries (winner+loser) = 400 scans/run. Estim. 5-30s/run au lieu de <1s avec index.
**Recommandation** : Migration SQL (à wrapper dans `_init_schema` ou migration séparée) :
```sql
CREATE INDEX IF NOT EXISTS idx_tmi_winner_pid_surf_date
  ON tennis_matches_internal(winner_player_id, surface, match_date);
CREATE INDEX IF NOT EXISTS idx_tmi_loser_pid_surf_date
  ON tennis_matches_internal(loser_player_id, surface, match_date);
```

### W2 — SPSStore connexion par upsert (pas pool)
**Localisation** : `SPSStore.upsert()` ligne ~378
**Problème** : `with sqlite3.connect(self.db_path) as conn:` ouvre nouvelle connexion par appel. Pour 200 upserts → 200 ouvertures/fermetures = ~4ms/write overhead.
**Recommandation** : (a) Connection persistante reuse via `self._conn` lazy + thread-local, OU (b) batch via `executemany()` en fin de pipeline. Gain estimé 60-70% sur la phase write.

### W3 — Fallback metric=50 indistinguable d'un joueur médiocre
**Localisation** : `aggregate_to_metrics()` + `_safe_pct(default=50.0)`
**Problème** : Joueur sans données 52-sem (jamais joué cette surface) reçoit metrics = 50.0 défault → SPS ≈ 42.5 (50 × 0.85 penalty binary). Indistinguable du "joueur médiocre" légitime. Peut induire en erreur consommateurs en aval.
**Recommandation** : exposer `SPSResult.confidence_full=False` déjà disponible — UI doit l'utiliser pour gris/badge "données insuffisantes". OU ajouter champ `data_complete: bool` séparé du confidence penalty. Décision DG (UX).

### W4 — Tie-break parser ne gère que format ATP `'7-6(N)'`
**Localisation** : `_accumulate_player()` parsing score string
**Problème** : Filtre `'(' in token AND '-' in token`. Formats alternatifs silently dropped :
- `'7/6(4)'` (slash separator) → ignoré
- `'7-6¹'` (superscript ITF) → ignoré (pas de parens)
- `'7-6 ret.'` (retirement) → ignoré
- `'10-8'` (TB final set Aus Open) → ignoré (pas de parens)
**Recommandation** : Test sur 1 saison réelle `tennis_matches_internal` post-ETL pour mesurer le % de TBs réels manqués. Adapter parser si >5%.

### W5 — `_ta_cache_lookup` joint sur `ta_id = player_id` risque mismatch
**Localisation** : `_ta_cache_lookup()` query `WHERE ta_id = ?`
**Problème** : `tennis_ta_cache.ta_id` = identifiant Tennis Abstract (URL slug typiquement). Le `player_id` upstream (BSD/ESPN) ne match probablement pas `ta_id`. Risque : TA overrides toujours vides → fallback heuristique `tie_breaks_won` et `baseline_efficiency`.
**Recommandation** : Mapping table `player_id ↔ ta_id` à créer (bd `qvan` sourcing 8 metrics — déjà ticket). En attendant, override jamais utilisé = fallback heuristique permanent.

### W6 — Coupling endpoint `/api/v1/tennis/upcoming` pas encore livré server.js
**Localisation** : `fetch_upcoming_matches()` URL par défaut
**Problème** : Route n'existe pas dans `server.js`. Script échoue cleanly (`MatchSourceError`) mais pipeline produit 0 SPS jusqu'à wire.
**Recommandation** : bd `q1w5` (wire pipeline tennis) doit inclure création endpoint avec contract documented. Schéma JSON attendu déjà spécifié dans docstring `fetch_upcoming_matches`.

### W7 — `_LIMITER` global partagé HTTP + workers (effective serialization)
**Localisation** : `_LIMITER` module-level + appelé dans `fetch_upcoming_matches` + `_process_one`
**Problème** : 4 workers ThreadPool tous bloqués par même token-bucket 5rps → workers > 1 sans bénéfice net (200ms inter-job forcé). Le rate limit était conçu pour HTTP externe, pas pour le DB local.
**Recommandation** : Séparer en 2 limiteurs :
```python
_HTTP_LIMITER = RateLimiter(RATE_LIMIT_RPS)        # for fetch_upcoming + future HTTP scrapes
_DB_LIMITER = RateLimiter(50.0)                    # SQLite local — much higher
```
Et dans `_process_one`, drop le `_LIMITER.acquire()` (DB only). HTTP scrape de TA viendra plus tard.

### W8 — Double-write logs si cron redirige stdout
**Localisation** : crontab snippet `>> /var/log/sps_updater.log 2>&1` + RotatingFileHandler `logs/sps_updater.log`
**Problème** : 2 fichiers logs avec contenu identique. Disk waste + confusion debug.
**Recommandation** : crontab → drop redirection (logger fichier suffit), OU env `PARISCORE_LOG_PATH=/dev/null` désactive rotating et garde uniquement stdout/stderr redirected.

---

## ❌ Bugs détectés

**Aucun bug bloquant.** Toutes les validations défensives testées passent.

---

## 💡 Recommandations d'amélioration

### R1 — Métriques d'observabilité Telegram/SSE (P2)
À chaque run cron, push résumé `PipelineStats` à channel ops :
```
SPS update 17:30 — matches=12 ok=24 skipped=0 errors=0 elapsed=2.3s
```
Alerte si `errors > 5` ou `elapsed > 60s`. Réutilise infra alertes existante (bd Telegram routing).

### R2 — Mode `--dry-run` (P2)
Flag CLI/env `PARISCORE_SPS_DRY_RUN=1` → exécute pipeline complet sans `SPSStore.upsert()`. Utile pour validation post-ETL avant activation prod. Output JSON aggregate par stderr.

### R3 — Backfill historique on-demand (P3)
Endpoint admin (server.js) `POST /api/v1/admin/sps/recompute?date=YYYY-MM-DD` qui spawn ce script avec env `PARISCORE_LOOKAHEAD_MIN=-24 PARISCORE_LOOKAHEAD_MAX=24` pour recalculer SPS rétroactivement (utile pour backtest, bd `e3mr`).

### R4 — Migration index W1 dans le script lui-même (P1)
Ajouter dans `SPSStore._init_schema` (ou dédié `_ensure_indexes()`) :
```python
conn.executescript('''
  CREATE INDEX IF NOT EXISTS idx_tmi_winner_pid_surf_date
    ON tennis_matches_internal(winner_player_id, surface, match_date);
  CREATE INDEX IF NOT EXISTS idx_tmi_loser_pid_surf_date
    ON tennis_matches_internal(loser_player_id, surface, match_date);
''')
```
Idempotent (`IF NOT EXISTS`), zéro risque sur DB existante. Bénéfice immédiat post-ETL bd `dl49`.

### R5 — Unit tests pytest dédié (P1)
`test_cron_sps_updater.py` couvrant :
- `_safe_pct`, `_normalize_elo` boundaries
- `_accumulate_player` mocks (3-4 scenarios)
- `aggregate_to_metrics` empty/full cases
- `fetch_upcoming_matches` contre mock httpd (cas dégradés)
- `SPSStore.upsert` idempotence

Cible : 30-40 tests. Pattern matches `test_surface_powerscore.py` v1.1.

### R6 — Documentation contract endpoint upstream (P1)
Ajouter `docs/sps_pipeline_contract.md` décrivant le JSON attendu par `fetch_upcoming_matches`. Servira de spec pour bd `q1w5` (implémentation route server.js).

### R7 — Cron monitoring via healthcheck endpoint (P2)
Patron heartbeat : à chaque succès, écrire `kv['sps_last_run']` = timestamp ISO. Endpoint server.js `/api/v1/sources/health` (déjà ouvert) check si `sps_last_run` < 24h. Alerte SSE/Telegram si stale.

---

## Verdict global

**Module PROD-READY** côté code Python (0 bug, 9 probes défensifs passent, threads safe, exit codes propres).

**Pré-requis activation prod (3 dépendances upstream):**
1. **bd `q1w5`** — wire endpoint server.js `/api/v1/tennis/upcoming` (contract documenté)
2. **bd `qvan`** — sourcing 8 metrics live ATP/WTA + populate `tennis_ta_cache` avec mapping `ta_id ↔ player_id`
3. **bd `dl49`** — ETL Elo interne BSD/ESPN populate `tennis_matches_internal` 52-sem ATP+WTA

**Quick wins immédiats (sans dépendre upstream):**
- R4 — Migration indexes (5 lignes SQL idempotent, deploy direct VPS)
- W7 — Split `_LIMITER` HTTP vs DB (3 lignes refacto)
- R5 — Unit tests pytest (suite séparée, ~30 tests)
- R6 — Documentation contract endpoint

---

*Rapport généré par /ps-test — 2026-05-27 21:55 GMT+2.*
