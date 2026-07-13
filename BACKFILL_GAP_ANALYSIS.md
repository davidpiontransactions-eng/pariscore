# BACKFILL_GAP_ANALYSIS.md — Adaptation des scripts backfill V2 → DB SQLite V1 legacy

**Rôle** : Database Optimizer (PariScore)
**Date** : 2026-07-11
**Objet** : Gap analysis entre les scripts backfill V2 (`ps-zip/scripts/*.mjs`) et la base SQLite V1 legacy en production.

---

## TL;DR — Recommandation GO/NO-GO

**Verdict : GO (compatibilité forte, incompatibilité mineure et isolée).**

- Les 2 scripts V2 créent eux-mêmes leurs tables cibles (`odds_snapshots`, `strategy_signals_history`) en `CREATE TABLE IF NOT EXISTS` — aucune table V1 existante n'est touchée.
- La convention de stockage des matchs historiques `kv['history_matches']` est **identique** en V1 et V2 (mêmes champs d'objet match : `realScore`, `commence_time`, `poisson`, `home_team`/`away_team`).
- L'API OddsPapi V2 (host `api.oddspapi.io`, endpoint `v4/odds-by-tournaments`) est strictement alignée avec le module V1 existant `oddspapi.js`.
- **Seul delta bloquant** : la var d'env `ODDSPAPI_KEY` (attendue par V2 et par `oddspapi.js` V1) est absente du `.env` V1 — qui ne contient que `ODDS_API_KEY` (sans le "P", var non consommée par ces scripts). À ajouter.
- **Aucune incompatibilité majeure** : pas de STOP. La Phase 2 (adaptation) peut proceed.

---

## 1. Tables V1 existantes (schéma de production)

> Source de vérité : `server.js` (lignes 6100–6860, `initSQLite()`). La DB physique `pariscore.db` n'est pas présente dans cet env de dev ; le schéma ci-dessous reflète exactement ce que `server.js` déclare au boot (idempotent, `CREATE TABLE IF NOT EXISTS`).

### 1.1 Tables directement pertinentes pour les backfills

| Table V1 | Schéma | Rôle | Lignes server.js |
|---|---|---|---|
| **`kv`** | `key TEXT PRIMARY KEY, value TEXT NOT NULL` | Blob JSON clé-valeur. **Contient `history_matches`** (array de matchs historiques) | 6145 |
| **`closing_odds`** | `match_id TEXT PK, home_team, away_team, league, commence_time, closing_home/draw/away REAL, bk_home/draw/away TEXT, captured_at INT, source TEXT DEFAULT 'odds_api'` | Snapshot CLV V1 — **1 ligne par match**, cotes 1X2 uniquement | 6530–6545 |
| **`user_bets`** | …(+colonnes CLV ajoutées) : `strategy TEXT`, `closing_odds REAL`, `closing_odds_captured_at INT`, `clv_pct REAL` | Paris utilisateurs + CLV per-leg (approche CLV native V1) | 6383–6470, 6582–6592 |
| `user_strategies` | `id, user_id, name, filters_json, staking, created_at, last_backtest_yield/winrate/sample` | Backtest no-code utilisateur (différent des 16 stratégies IA V2) | 6488–6500 |
| `match_timeline_snapshots` | `match_id, minute, captured_at, score_home/away, …, odds_home/draw/away` PK(match_id,minute) | Capture minute-par-minute pendant cron live | 6504–6525 |
| `corner_history` | `id, bsd_event_id UNIQUE, bsd_league_id, match_date, season, home/away_team, home/away/total_corners, fetched_at` | Historique corners 3 saisons (ETL) | 6565–6580 |
| `match_stats_history` | `bsd_event_id PK, bsd_league_id, season, match_date, home/away_team, home/away_score(_ht), xg, shots, sot, corners, possession, odds_home/draw/away, odds_over_15/25/35, odds_under_25, odds_btts_yes/no, …` | Profil xG/stats 3 saisons — riche en cotes | 6169–6212 |

### 1.2 Autres tables V1 (inventaire complet, non touchées)

`kv`, `timesfm_forecasts`, `match_stats_history`, `ai_feedback`, `matchday_passes`, `stripe_events`, `push_subscriptions`, `newsletter`, `mma_fighters`, `mma_predictions`, `users`, `password_resets`, `api_cache`, `tennis_enrich_snap`, `api_cache_buffer`, `affiliates`, `affiliate_clicks`, `user_bets`, `bankroll_transactions`, `bankroll_plan`, `bet_import_audit`, `user_strategies`, `match_timeline_snapshots`, `closing_odds`, `player_surface_scores`, `corner_history`, `tennis_players_elo`, `tennis_matches_elo`, `tennis_alerts`, `player_photos`, `foot_alerts`, `tennis_matches`, `tennis_matches_internal`, `tennis_elo`, `tennis_ta_cache`, `tennis_sps_weekly`, `tennis_koa_matchmx`, `matchstat_players`.

**Aucune de ces tables ne s'appelle `odds_snapshots` ou `strategy_signals_history`.**

### 1.3 Convention `kv['history_matches']` (point de convergence clé)

V1 charge l'historique exactement comme V2 le lit :
```js
// server.js:10373 (V1)
history = kvGet('history_matches', []);
```
```js
// backfill-strategy-signals.mjs:324-325 (V2)
const row = db.prepare('SELECT value FROM kv WHERE key = ?').get('history_matches');
matches = JSON.parse(row.value);
```

Les champs d'objet match utilisés par V2 (`realScore`, `htScore`, `commence_time`, `home_team`, `away_team`, `poisson.*`, `fair.*`, `closing_odds.*`, `corners_avg`, `ppg_gap`, `realCorners`) sont **tous déjà produits/consommés par V1** (vérifié : `realScore` lignes 1168, 9557, 11213 ; `commence_time` ligne 10408 ; etc.).

→ **Le script strategy-signals V2 tournera nativement sur les données réelles V1**, sans mock, dès que `kv['history_matches']` est peuplée.

---

## 2. Tables/colonnes attendues par les scripts V2

### 2.1 `backfill-closing-odds.mjs` (516 lignes)

**Table cible** : `odds_snapshots` (CRÉÉE par le script lui-même, `openDB()` ligne 73-86) :

```sql
CREATE TABLE IF NOT EXISTS odds_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  match_id TEXT NOT NULL,
  bookmaker TEXT NOT NULL,
  market TEXT NOT NULL,            -- '1x2:home' | '1x2:draw' | '1x2:away' | ...
  odds REAL NOT NULL,
  ts INTEGER NOT NULL,
  is_closing INTEGER DEFAULT 0,
  UNIQUE(match_id, bookmaker, market, ts)
);
CREATE INDEX idx_odds_snapshots_match ON odds_snapshots(match_id);
CREATE INDEX idx_odds_snapshots_closing ON odds_snapshots(is_closing, ts);
```

**Mode multi-snapshot** : N lignes par match (un par `bookmaker × market × ts`), permet de stocker toute la séquence temporelle des cotes. Différent de `closing_odds` V1 (1 ligne/match, 1X2 seulement).

**Vars d'env attendues** :
- `ODDSPAPI_KEY` (requis, sinon mock automatique via `MOCK = !ODDSPAPI_KEY`)
- `DATABASE_PATH` (défaut `./pariscore.db`)
- `ODDSPAPI_HOST` (défaut `api.oddspapi.io`)
- `ODDSPAPI_ODDS_PATH` (défaut `/v4/odds-by-tournaments`)
- `ODDS_MOCK=1` (force mock)

### 2.2 `backfill-strategy-signals.mjs` (657 lignes)

**Tables cibles** (CRÉÉES par le script, `DDL` ligne 288-310) :

```sql
CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT);  -- IF NOT EXISTS → no-op si V1 existe déjà
CREATE TABLE IF NOT EXISTS strategy_signals_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  match_id TEXT NOT NULL,
  strategy_id TEXT NOT NULL,
  signal INTEGER NOT NULL,
  confidence REAL,
  market TEXT,
  odds_at_signal REAL,
  odds_closing REAL,
  clv REAL,
  outcome INTEGER,
  profit REAL,
  created_at INTEGER DEFAULT (strftime('%s','now')),
  UNIQUE(match_id, strategy_id)
);
CREATE INDEX idx_strat_match ON strategy_signals_history(strategy_id, match_id);
CREATE INDEX idx_strat_signal ON strategy_signals_history(strategy_id, signal);
```

**Lecture** : `kv['history_matches']` (array de matchs). Si vide → génère 100 matchs mock reproductibles et les persiste (smoke-test).

**16 stratégies IA** : BTTS_YES, OVER_2_5, OVER_1_5, UNDER_2_5, HOME_WIN, AWAY_WIN, DRAW, CS_00, ANGLE_CORNERS, OVER_6_5_CORNERS, VERROU_TACTIQUE, GOLDEN_PPG_GAP, DC_HOME, DC_AWAY, HT_HOME_FT_HOME, HT_UNDER_FT_OVER.

**Métriques perf** : roi, yield, hit_rate, brier (calibration), clv_avg (périodes 30d/90d/365d).

**Vars d'env** : aucune requise (chemin DB résolu via `join(ROOT, 'pariscore.db')`).

---

## 3. Delta (V2 attendu vs V1 existant)

| Élément | V2 attendu | V1 existant | Delta | Impact |
|---|---|---|---|---|
| `odds_snapshots` | Table multi-snapshot (N lignes/match, multi-bookmaker, multi-market) | **Absente** | **Manquante** | Aucun (le script V2 la crée) |
| `strategy_signals_history` | Table signaux 16 stratégies | **Absente** | **Manquante** | Aucun (le script V2 la crée) |
| `kv.value` nullabilité | `value TEXT` (nullable) | `value TEXT NOT NULL` | **Plus strict en V1** | Aucun (`CREATE IF NOT EXISTS` = no-op sur table existante ; V1 ne stocke jamais NULL via `kvSet` qui `JSON.stringify`) |
| `kv['history_matches']` | Consommée | **Produite** (server.js:10373, 10987) | **Convergent** | ✅ V2 lit directement les données V1 |
| Cotes de clôture | `odds_snapshots` (multi-market) | `closing_odds` (1X2 seul) | **Schémas incompatibles** | Le backfill V2 écrit dans sa propre table — il ne alimente PAS `closing_odds` V1. À adapter en Phase 2 (dual-write optionnel). |
| OddsPapi host/path | `api.oddspapi.io` + `/v4/odds-by-tournaments` | Identique (`oddspapi.js` lignes 15-18) | **Convergent** | ✅ Aucune adaptation API |
| `better-sqlite3`, WAL | Requis | Requis (V1 `pragma WAL`, `synchronous=NORMAL`) | **Convergent** | ✅ |
| `ODDSPAPI_KEY` | Requis (mock sinon) | **Absent du `.env` V1** (n'a que `ODDS_API_KEY`, var non consommée) | **Manquant** | ⚠ À ajouter au `.env` |
| `BSD_API_KEY` | Non requis par ces 2 scripts | Présent | N/A | Autres scripts V2 (bsd-probe.mjs) en ont besoin |

### 3.1 Ce qui est nommé différemment (pas un conflit, mais à savoir)

- **Cotes de clôture** : V1 = `closing_odds` (table large, 1X2) ; V2 = `odds_snapshots` (table étroite EAV, tous marchés). Coexistence possible : ce sont 2 tables distinctes, aucune collision de nom.
- **CLV** : V1 le stocke per-leg dans `user_bets.clv_pct` + `user_bets.closing_odds` ; V2 le calcule dans `strategy_signals_history.clv`. Approches complémentaires (paris réels vs backtest stratégique).

---

## 4. Plan d'adaptation (Phase 2)

### Décision de stratégie
Les scripts V2 sont **presque autonomes** (ils créent leurs tables). L'adaptation V1 ajoute :
1. Un script de migration standalone (`migrate-add-bd-tables.mjs`) pour pré-créer les 2 tables **sans** lancer de backfill (utile pour préparer la DB avant exécution, et pour les tests).
2. Une version `-v1.mjs` de chaque backfill avec les adaptations ci-dessous.

### 4.1 `scripts/migrate-add-bd-tables.mjs` (nouveau)
- `CREATE TABLE IF NOT EXISTS odds_snapshots` (schéma V2 exact + index).
- `CREATE TABLE IF NOT EXISTS strategy_signals_history` (schéma V2 exact + index).
- **Ne déclare pas `kv`** (elle existe déjà en V1 avec `NOT NULL` — on évite tout risque).
- Idempotent, safe sur DB production (jamais de DROP/ALTER sur table existante).
- `node --check` requis.

### 4.2 `scripts/backfill-closing-odds-v1.mjs` (adapté)
Reprend le script V2 intégralement + **dual-write** dans le schéma V1 :
- Conserve l'écriture dans `odds_snapshots` (table V2, multi-market).
- **Ajoute** un miroir vers `closing_odds` V1 (table 1X2 large) pour les marchés `1x2:home/draw/away` du bookmaker Pinnacle : `INSERT OR REPLACE INTO closing_odds (match_id, home_team, away_team, league, commence_time, closing_home, closing_draw, closing_away, bk_home/draw/away, captured_at, source)`. Source marquée `'backfill-csv'` ou `'oddspapi'` selon le mode.
- Avantage : les routes server.js existantes qui lisent `closing_odds` profitent immédiatement du backfill CSV, sans modification du server.js.
- Garde-fou : `PRAGMA table_info(closing_odds)` check avant tout dual-write (si la table n'existe pas, on skip proprement sans crash).

### 4.3 `scripts/backfill-strategy-signals-v1.mjs` (adapté)
Reprend le script V2 + adaptations mineures :
- `DB_PATH` résolu en absolu via `path.resolve(ROOT, 'pariscore.db')` (robustesse Windows/cwd).
- **Conserve** la déclaration `CREATE TABLE IF NOT EXISTS kv` (le `IF NOT EXISTS` est un no-op sur la table V1 existante — ne l'altère jamais ; ne la crée que sur une DB vierge sans server.js booté, pour éviter un crash à la lecture de `history_matches`). Check `PRAGMA` pré-DDL pour diagnostic.
- Garde `strategy_signals_history` (création idempotente).
- Ajoute `busy_timeout 5s` (aligné server.js) — anti `SQLITE_BUSY` sous cron.
- Tout le reste (16 stratégies, perf metrics, mock) inchangé.

### 4.4 Variables d'env à configurer

```bash
# .env V1 — à ajouter
ODDSPAPI_KEY=<clé api.oddspapi.io native>   # requis pour mode live/closing réel
# Optionnels (valeurs par défaut OK) :
# ODDSPAPI_HOST=api.oddspapi.io
# ODDSPAPI_ODDS_PATH=/v4/odds-by-tournaments
# ODDSPAPI_MODE=native
# DATABASE_PATH=./pariscore.db
# ODDS_MOCK=1   # force mock (smoke-test sans réseau)
```

Note : `ODDS_API_KEY` (déjà présent en V1) n'est pas consommé par ces scripts. `BSD_API_KEY` n'est pas requis pour ces 2 backfills (seulement par `bsd-probe.mjs` et autres scripts V2 non concernés ici).

---

## 5. Risques et garde-fous respectés

| Risque | Mitigation |
|---|---|
| Écraser/modifier une table V1 production | ✅ Aucun `DROP`/`ALTER` sur table existante. `CREATE TABLE IF NOT EXISTS` partout. `migrate-add-bd-tables.mjs` ne crée que les 2 nouvelles tables. |
| Crash sur DB corrompue | Les scripts V2 ouvrent la DB en lecture/écriture simple ; le garde-corruption V1 (quarantaine) reste dans server.js (les scripts sont indépendants, n'ajoutent pas ce garde — acceptable pour des scripts CLI ponctuels). |
| Exécuter un backfill complet sans clé API | ✅ Mode mock automatique si `ODDSPAPI_KEY` absent (`MOCK = !ODDSPAPI_KEY`). Backfill CSV n'a pas besoin de clé. |
| Lock contention WAL (cron + serveur) | `busy_timeout` est positionné par server.js (5s). Les scripts V2 n'ajoutent pas de `busy_timeout` — recommandé d'en ajouter un dans la version V1 (mitigé car transactions courtes). |
| Schéma `closing_odds` V1 absent sur nouvelle DB | `PRAGMA table_info` check avant dual-write → skip propre. |

---

## 6. Conclusion

**GO pour la Phase 2.** L'intégration est low-risk :
- 2 tables nouvelles créées en `IF NOT EXISTS` (zéro impact sur l'existant).
- 1 var d'env à ajouter (`ODDSPAPI_KEY`).
- Dual-write optionnel vers `closing_odds` V1 pour maximiser la valeur sans toucher à server.js.
- Tous les scripts testés en `node --check` avant livraison.

Aucune incompatibilité majeure détectée — pas de STOP.
