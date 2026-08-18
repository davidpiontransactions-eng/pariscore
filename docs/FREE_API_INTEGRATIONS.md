# PariScore — Free API Integrations Guide (v13.00, 2026-08-18)

7 nouvelles API gratuites intégrées au backend PariScore. Toutes sont **opt-in** : si la clé est absente de `.env`, les routes renvoient 503 (kill-switch propre). Zéro impact sur le boot.

> **Vue d'ensemble rapide** : `curl http://localhost:3000/api/v1/integrations/status` retourne l'état des 7 services + les clés manquantes.

---

## 1. football-data.org (fallback API-FOOTBALL)

| | |
|---|---|
| **Service** | `services/footballDataService.js` |
| **Signup** | https://www.football-data.org/client/register |
| **Free tier** | 10 req/min — top 5 ligues EU + cups (PL, PD, SA, BL, FL1, Eredivisie, Primeira, Championship, UCL, UECL) |
| **Env key** | `FOOTBALL_DATA_KEY=xxx` |
| **Auth** | header `X-Auth-Token: $FOOTBALL_DATA_KEY` |
| **Use case** | Cross-validation / fallback API-FOOTBALL sur les ligues EU |

### Endpoints PariScore exposés
```
GET /api/v1/football-data/matches?date=YYYY-MM-DD[&status=SCHEDULED|LIVE|FINISHED]
GET /api/v1/football-data/competition/{code}/matches?season=YYYY&matchday=N
GET /api/v1/football-data/competition/{code}/standings
GET /api/v1/football-data/team/{id}
GET /api/v1/football-data/competitions
GET /api/v1/football-data/status
```

Codes compétition (free tier) : `PL` `PD` `SA` `BL1` `FL1` `ERED` `PPL` `ELC` `UCL` `UECL`.

### Exemple curl
```bash
curl -s "http://localhost:3000/api/v1/football-data/competition/FL1/matches?season=2025&matchday=10" | jq
```

---

## 2. SportScore (multi-sport live, no-auth)

| | |
|---|---|
| **Service** | `services/sportScoreService.js` |
| **Signup** | Aucun (attribution link requis vers sportscore.com/developers/) |
| **Free tier** | Multi-sport live (tennis, basketball, cricket, football) |
| **Env key** | — (aucune) |
| **Use case** | Couverture tennis/NBA live, complète le trou API-FOOTBALL |

### Endpoints PariScore
```
GET /api/v1/sportscore/feeds
GET /api/v1/sportscore/events?sport=tennis|basketball|cricket|football[&date=YYYY-MM-DD]
GET /api/v1/sportscore/event/{id}
GET /api/v1/sportscore/status
```

⚠️ **Endpoints best-effort** : la structure exacte `/feeds` vs `/sports` n'est pas confirmée publiquement. Les calls retournent `[]` gracieusement si KO.

---

## 3. PlayerElo (player-level Elo, 176 ligues)

| | |
|---|---|
| **Service** | `services/playerEloService.js` |
| **Signup** | https://playerelo.football/api-access → "Get free key" |
| **Free tier** | 500 req/mois, 10 req/min — 78K+ joueurs |
| **Env key** | `PLAYERELO_API_KEY=xxx` |
| **Auth** | `Authorization: Bearer $PLAYERELO_API_KEY` |
| **Use case** | Branche dans `computeEloProbs()` pour cross-validation via `eloBridge` |

### Endpoints PariScore
```
GET /api/v1/player-elo/players?limit=50&offset=0
GET /api/v1/player-elo/player/{id}
GET /api/v1/player-elo/predictions      ← shape value-bet (prob home/draw/away, fair_odds, market_odds, value)
GET /api/v1/player-elo/value-bets       ← signaux value-bets (fair odds vs market)
GET /api/v1/player-elo/leagues
GET /api/v1/player-elo/usage            ← quota check (ne consomme pas le quota)
GET /api/v1/player-elo/status
```

### Bridge Elo (quick win réalisé)
Le service `services/eloBridge.js` cross-valide un match PariScore avec PlayerElo :
```bash
curl -s "http://localhost:3000/api/v1/elo/cross-validate?home=PSG&away=OM" | jq
```
Retourne :
```json
{
  "source": "elo-bridge",
  "match": { "home_team": "PSG", "away_team": "OM" },
  "pariscore": { "method": "elo", "home_win_pct": 58, "draw_pct": 22, "away_win_pct": 20, "home_elo": 1645, "away_elo": 1530 },
  "playerelo": { "prob_home_pct": 61, "prob_draw_pct": 21, "prob_away_pct": 18, "fair_odds": 1.64, "market_odds": 1.85, "value": 0.12 },
  "delta_pct": { "home": 3, "draw": -1, "away": -2 },
  "agreement": "high",
  "confidence": "full"
}
```
- `agreement` : `high` (delta<5pts) / `medium` (<12pts) / `low`
- `value > 0` = opportunité de bet selon PlayerElo

---

## 4. PropLine (player-props, 19 books + 6 exchanges) ⭐ NOUVELLE VERTICALE

| | |
|---|---|
| **Service** | `services/propLineService.js` |
| **Signup** | https://prop-line.com → "Get Free API Key" |
| **Free tier** | 1,000 req/jour — 19 books (BetMGM, Bovada, DraftKings, FanDuel, Pinnacle, 1xBet, …) + 6 exchanges (Kalshi, Polymarket, Matchbook, Smarkets, Novig, ProphetX) |
| **Env key** | `PROPLINE_API_KEY=xxx` |
| **Auth** | query `?apiKey=$PROPLINE_API_KEY` |
| **Use case** | **NOUVELLE verticale PariScore** : player-props (60+ marchés, 54 sports dont 28 ligues soccer, NBA, MLB, NHL, UFC, tennis) |

### Endpoints PariScore
```
GET /api/v1/propline/sports
GET /api/v1/propline/sports/{sport_key}/events          # sport_key = basketball_nba, soccer_epl, mma_mixed_martial_arts, tennis_atp, …
GET /api/v1/propline/sports/{sport_key}/events/{event_id}/odds?markets=player_points,player_rebounds[&period=q1|h1|p1|f5]
GET /api/v1/propline/status
```

### Exemple curl
```bash
# Liste events NBA
curl -s "http://localhost:3000/api/v1/propline/sports/basketball_nba/events" | jq

# Odds player-props pour un event
curl -s "http://localhost:3000/api/v1/propline/sports/basketball_nba/events/12345/odds?markets=player_points,player_rebounds" | jq
```

`toBookmakerShape(odds)` convertit vers format the-odds-api → directement consommable par `computeEdge()` PariScore.

---

## 5. TheRundown (aggregator multi-books) ⚠️ SCAFFOLDED

| | |
|---|---|
| **Service** | `services/theRundownService.js` |
| **Signup** | https://therundown.io |
| **Free tier** | 20k datapoints/jour, 3 books (Pinnacle, Bookmaker, BetDSI) |
| **Env key** | `THERUNDOWN_API_KEY=xxx` |
| **Auth** | header `Authorization: Bearer $KEY` ⚠️ (peut être `?api_key=` — à valider) |
| **Use case** | Source unique odds+scores+stats multi-books (alternative The Odds API saturé à 500 req/mois) |

### Endpoints PariScore
```
GET /api/v1/therundown/sports
GET /api/v1/therundown/sports/{sport_id}/events?date=YYYY-MM-DD
GET /api/v1/therundown/sports/{sport_id}/events/{event_id}/odds
GET /api/v1/therundown/status
```

⚠️ **TODO post-signup** : valider (1) mode auth, (2) paths `/sports/:id/events` exacts, (3) format réponse. Le service log un warning et retourne `[]`/`null` gracieusement.

---

## 6. Dino.markets (Kalshi + Polymarket) ⭐ NOUVELLE VERTICALE

| | |
|---|---|
| **Service** | `services/dinoMarketsService.js` |
| **Signup** | https://dino.markets |
| **Free tier** | À confirmer |
| **Env key** | `DINO_MARKETS_API_KEY=xxx` |
| **Auth** | header `Authorization: Bearer $KEY` ⚠️ (à valider) |
| **Use case** | **NOUVELLE verticale PariScore** : prediction-market (Kalshi sports + Polymarket) — cross-venue spreads = détection d'arbitrage |

### Endpoints PariScore
```
GET /api/v1/dino/events?sport=&status=
GET /api/v1/dino/event/{id}
GET /api/v1/dino/spreads?min_edge=           ← valeur ajoutée principale de Dino
GET /api/v1/dino/status
```

⚠️ **TODO post-signup** : `/docs` retourne 404 — paths exacts à valider après signup.

---

## 7. Sportmonks Football (backtesting + standings détaillés)

| | |
|---|---|
| **Service** | `services/sportmonksService.js` |
| **Signup** | https://docs.sportmonks.com/football/ → "Get started" |
| **Free tier** | 180 req/h sur plan basique |
| **Env key** | `SPORTMONKS_API_KEY=xxx` |
| **Auth** | query `?api_token=$SPORTMONKS_API_KEY` |
| **Use case** | Backtesting stratégies (historique complet) + standings détaillés + TV channels |

### Endpoints PariScore
```
GET /api/v1/sportmonks/fixtures?date=YYYY-MM-DD
GET /api/v1/sportmonks/fixture/{id}?include=statistics;participants;league
GET /api/v1/sportmonks/standings/{league_id}
GET /api/v1/sportmonks/team/{id}
GET /api/v1/sportmonks/leagues?page=1
GET /api/v1/sportmonks/live           ← live scores (60s TTL)
GET /api/v1/sportmonks/status
```

### Exemple curl
```bash
# Fixtures du jour
curl -s "http://localhost:3000/api/v1/sportmonks/fixtures?date=$(date +%F)" | jq

# Standings Premier League (id=8)
curl -s "http://localhost:3000/api/v1/sportmonks/standings/8" | jq

# Live scores
curl -s "http://localhost:3000/api/v1/sportmonks/live" | jq
```

---

## Convention de code (tous services)

| Aspect | Pattern |
|---|---|
| **Lazy env** | `const KEY = process.env.X || ''` |
| **Check opt-in** | `function enabled() { return !!KEY }` |
| **Kill-switch route** | `if (!service.enabled()) return 503 'KEY manquante dans .env'` |
| **Cache mémoire** | `Map<key, {ts, data}>` avec TTL variable (60s live → 6h stable) + stale fallback si HTTP fail |
| **Auth modes** | header (`X-Auth-Token`, `Authorization: Bearer`) OU query (`?apiKey=`, `?api_token=`) |
| **Erreur HTTP** | `{ ok: false, error: e.message, [data]: [] }` |
| **HTTP helper** | `fetch()` natif Node 18+ + `AbortController` (moderne, cf. `lib/logo-cascade.js`) |
| **Conversion shape** | Helper `toPariScoreFormat()` ou `toBookmakerShape()` pour brancher dans `computeEdge()` |

## Tests minimaux après ajout de clé

### Smoke test automatisé (`scripts/test-new-apis.js`)

```bash
# Démarre le serveur d'abord (bun run dev / node server.js), puis :
node scripts/test-new-apis.js                           # base_url = localhost:3000
node scripts/test-new-apis.js https://pariscore.fr      # contre prod
```

Sortie typique :
```
🔍 PariScore API Smoke Test
   Base URL: http://localhost:3000

✓ /integrations/status : HTTP 200 (15ms)
   3/7 services enabled, 4 clés .env manquantes

   ⚠  Clés .env manquantes :
     - FOOTBALL_DATA_KEY
     - PLAYERELO_API_KEY
     - SPORTMONKS_API_KEY
     - DINO_MARKETS_API_KEY

📡 Smoke tests par service :

  football-data    ! 503     3ms  FOOTBALL_DATA_KEY manquante
  sportscore       ✓ enabled 42ms  no-auth
  player-elo       ! 503     2ms  PLAYERELO_API_KEY manquante
  propline         ! 503     3ms  PROPLINE_API_KEY manquante
  therundown       ! 503     3ms  THERUNDOWN_API_KEY manquante
  dino             ! 503     3ms  DINO_MARKETS_API_KEY manquante
  sportmonks       ! 503     3ms  SPORTMONKS_API_KEY manquante

🔴 Régression check (services existants) :

  core status      ✓ OK     10ms
  cs2              ✓ OK      8ms

──────────────────────────────────────────────────────────
✅ Tous les smoke tests OK. 1 service(s) actif(s).
```

Exit code : 0 = tout OK, 1 = ≥1 service KO, 2 = pas de connexion au serveur.

### Tests manuels

```bash
# 1. Vérifier que la clé est bien lue
curl -s http://localhost:3000/api/v1/integrations/status | jq

# 2. Test direct du service (doit renvoyer 200, pas 503)
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3000/api/v1/football-data/matches?date=$(date +%F)"

# 3. Vérifier le shape (pour playerelo par exemple)
curl -s "http://localhost:3000/api/v1/player-elo/predictions" | jq '.[0] | keys'

# 4. Test cross-validate Elo bridge
curl -s "http://localhost:3000/api/v1/elo/cross-validate?home=PSG&away=OM" | jq
```

## Commit & déploiement

⚠️ **Avant commit** (cf. mémoire `deploy-incident-2026-06-06-wholesale-git-add`) :
```bash
git add services/{footballData,sportScore,playerElo,propLine,theRundown,dinoMarkets,sportmonks,eloBridge}Service.js
git add server.js .env.example CHANGELOG.md docs/FREE_API_INTEGRATIONS.md
# JAMAIS `git add server.js` wholesale
```

Deploy : `deploy.bat "v13.00: 7 nouvelles API gratuites (intégrations free tier)"`

## Beads liées
- `ParisScorebis-jtsp` football-data ✓
- `ParisScorebis-43g0` sportscore ✓
- `ParisScorebis-5xth` playerelo ✓
- `ParisScorebis-grwl` propline ✓
- `ParisScorebis-3lr3` therundown ✓
- `ParisScorebis-c8rj` dino ✓
- `ParisScorebis-d8md` sportmonks ✓
- `ParisScorebis-7vwk` CHANGELOG ✓
- `ParisScorebis-q57t` eloBridge ✓
- `ParisScorebis-51tk` integrations/status ✓
- `ParisScorebis-kqyp` cette doc ✓