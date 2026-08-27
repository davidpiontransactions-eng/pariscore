# Session: OddAlerts Live Stats Integration (2026-08-27)

## Scope

Analyser comment les stats live d'OddAlerts se mettent en place, comptabiliser la totalité des stats live foot d'OddAlerts par rapport à Pariscore, et implémenter ceci sur Pariscore.

## État des lieux

### OddAlerts Live Data (via https://data.oddalerts.com/latency)

**API Endpoints découverts :**
1. `GET /latency/games` — Liste des matchs live
2. `GET /latency/game/{smid}` — Détails d'un match live

**Données fournies par match live :**
- **Match info** : smid, id, home_name, away_name, home_goals, away_goals, elapsed, status (LIVE/HT/FT), ht_score, ft_score, unix (kickoff)
- **Freshness** : server_time, data_age_seconds (score), odds_age_seconds, odds_updated_at
- **Live Odds** (bookmaker_id: 2 = Bet365) — Marchés disponibles selon couverture :
  - `ft_result` (1X2) — home/draw/away
  - `double_chance` — home_draw/home_away/away_draw
  - `total_goals` / `home_goals` / `away_goals` (Over/Under X.5)
  - `btts` (Both Teams To Score) — yes/no
  - `ht_result` (Half Time Result)
  - `dnb` (Draw No Bet)
  - `total_goals_1h` (1H Over/Under)
  - `asian_handicap` — lignes asiatiques multiples
  - `asian_corners` — Over/Under corners asiatiques
  - `total_corners` — Over/Under corners standards
  - `total_cards` — Over/Under cartons

**Fréquence** : Poll 2s, scores ~5s, odds ~10s

### Pariscore Actuel

**Tables existantes :**
1. `league_season_stats` (1582 lignes) — Stats saisonnières OddAlerts (général, over/under, mi-temps, cartons, BTTS, corners) — **pas live**
2. `live_match_stats` (894 lignes) — Stats live **BSD (Bet365)** :
   - minute, period, score_home, score_away
   - xg_home, xg_away, momentum, intensity
   - stats_json détaillé : possession, tirs, tirs cadrés, corners, fautes, hors-jeu, cartons, passes, grosses occasions, arrêts, interceptions, tacles, centres, longs ballons, dégagements, attaques dangereuses, momentum_index, win_prob (Poisson calibré)

**Gap identifié :**
- Pariscore a des stats live **BSD** (riches en données physiques : xG, possession, tirs, etc.)
- Pariscore **N'A PAS** les **live odds OddAlerts** (marchés 1X2, double chance, handicaps asiatiques, corners, cartons, etc.)
- Les live odds OddAlerts complètent parfaitement les stats physiques BSD

## Plan d'implémentation

### P1 — Créer service OddAlerts Live API
- `src/lib/oddalerts/live-api.ts` — Client pour `/latency/games` et `/latency/game/{smid}`
- Types TypeScript pour GameList, GameDetail, LiveOddsMarket

### P2 — Créer table DB pour live odds OddAlerts
- `live_odds_oddalerts` : match_id, smid, market_title, market_name, market_type, odds_json, bookmaker_id, data_age_seconds, odds_age_seconds, server_time, updated_at
- Index sur match_id + market_title pour upsert

### P3 — Scraper / Sync service
- `scripts/sync-oddalerts-live.js` — Poll `/latency/games` puis `/latency/game/{smid}` pour chaque match live
- Exécuter via cron (toutes les 30s pendant les heures de match) ou worker dédié
- Upsert en base

### P4 — API Next.js
- `GET /api/v1/oddalerts/live/games` — Liste matchs live
- `GET /api/v1/oddalerts/live/game/[smid]` — Détails + live odds

### P5 — Composants UI
- Panel live odds dans page match / composant réutilisable
- Affichage fraisseur (data_age, odds_age) avec code couleur
- Marchés prioritaires : ft_result, total_goals, btts, double_chance, asian_handicap, total_corners

### P6 — Tests & QA
- Test unitaire client API
- Test intégration DB
- QA visuelle sur matchs live réels

---

## Journal de boucle d'ingénierie

### P0 — Setup traçabilité
- [x] Création bead `ParisScorebis-jk6h` claimed
- [x] Journal de boucle ouvert (ce document)

### P1 — Client API OddAlerts Live
- [x] Créer `src/lib/oddalerts/live-api.ts` avec types + fetchers
- [x] Verify: `bun run typecheck` 0 erreur (nouveaux fichiers)

### P2 — Schéma DB + table
- [x] Créer table `live_odds_oddalerts` via script (CREATE TABLE IF NOT EXISTS dans sync script)
- [x] Verify: 126 marchés upsert lors du premier run

### P3 — Sync script
- [x] Créer `scripts/sync-oddalerts-live.js` (poll games + details)
- [x] Test run manuel sur matchs live actuels (36 matchs, 126 marchés)
- [x] Verify: données insérées en DB

### P4 — API Routes Next.js
- [x] `app/api/v1/oddalerts/live/games/route.ts` — Liste matchs live
- [x] `app/api/v1/oddalerts/live/game/[smid]/route.ts` — Détails + live odds
- [x] Verify: endpoints répondent 200 + JSON valide (testé via curl)

### P5 — Composants UI + Types DB
- [x] Créer `src/lib/oddalerts/live-odds-types.ts` — Types + helpers UI
- [x] Créer `src/lib/oddalerts/live-odds-db.ts` — Accès DB read-only
- [x] Créer `src/components/oddalerts/OddAlertsLiveOddsPanel.tsx` — Panel UI
- [x] Verify: lint OK sur nouveaux fichiers

### P6 — Quality gates
- [ ] `bun run lint` global
- [ ] `bun run typecheck` global (erreurs pré-existantes hors scope)
- [ ] Deploy VPS + QA prod

---

## Décisions techniques

1. **Séparation BSD vs OddAlerts** : Garder `live_match_stats` (BSD/physique) et créer `live_odds_oddalerts` (marchés/cotes) — sources complémentaires
2. **Polling** : Script Node standalone (pas Next.js) pour cron VPS, intervalle 30s
3. **Bookmaker_id** : 2 = Bet365 (actuel), extensible si OddAlerts ajoute d'autres bookmakers
4. **Freshness** : Stocker `data_age_seconds` et `odds_age_seconds` pour UI (indicateur visuel)
5. **Upsert** : Clé unique (smid, market_title, bookmaker_id) pour éviter doublons

---

## Prochaine action

→ **P1 : Créer `src/lib/oddalerts/live-api.ts`**