# BSD Sports Football API — Endpoints (validés 2026-07-19)

Source : `https://sports.bzzoiro.com`  
Auth : `Authorization: Token ${BSD_API_KEY}`  
Base URL correcte : **`https://sports.bzzoiro.com/api/`**  
Base URL incorrecte (404) : `https://sports.bzzoiro.com/football/api/v2/`

Implémentation PariScore : `src/lib/bsd-football-fetcher.ts`  
Routes Next : `src/app/api/football/matches|live|prematch/route.ts`

---

## Index racine

```
GET https://sports.bzzoiro.com/api/
```

Réponse (clés → URLs) :
| Clé | Endpoint |
|-----|----------|
| leagues | `/api/leagues/` |
| teams | `/api/teams/` |
| events | `/api/events/` |
| fixtures | `/api/fixtures/` |
| matches | `/api/matches/` |
| live | `/api/live/` |
| predictions | `/api/predictions/` |
| players | `/api/players/` |
| player-stats | `/api/player-stats/` |
| odds | `/api/odds/` |
| managers | `/api/managers/` |
| seasons | `/api/seasons/` |
| venues | `/api/venues/` |
| social | `/api/social/` |
| tv-channels | `/api/tv-channels/` |
| broadcasts | `/api/broadcasts/` |

Pagination Django REST : `{ count, next, previous, results[] }`

---

## Endpoints utilisés par PariScore

### Prematch
```
GET /api/matches/?status=notstarted&limit=100
```
- `status=notstarted` → ~394 matchs (échantillon 2026-07-19)
- Filtre optionnel : `league=<id>` (ex. `league=1` Premier League)

### Live
```
GET /api/live/?limit=50
```
- Matchs en cours uniquement (`1st_half`, `2nd_half`, `HT`)

### Fixtures (alias large)
```
GET /api/fixtures/?limit=N
```
- Tous statuts (finished + live + notstarted)

### Leagues
```
GET /api/leagues/?limit=50
```
IDs top ligues (échantillon) :
| id | name |
|----|------|
| 1 | Premier League |
| 3 | La Liga |
| 5 | Bundesliga |
| 6 | Ligue 1 |
| 2 | Liga Portugal |
| 7 | Champions League |
| 8 | Europa League |
| 9 | Brasileirão Serie A |
| 10 | Eredivisie |
| 12 | Championship |
| 18 | MLS |
| 19 | Liga MX Apertura |
| 57 | USL Championship |
| 72 | NWSL |

### Teams
```
GET /api/teams/?limit=N
```
- Champs : `id`, `name`, `short_name`, `country`
- **Pas de logo URL** dans la réponse BSD

---

## Shape d’un match (`results[]`)

| Champ BSD | Type | Usage PariScore |
|-----------|------|-----------------|
| `id` | number | `id: "bsd-{id}"` |
| `league` | `{id,name,country,is_women,current_season}` | `mapLeague` |
| `home_team` / `away_team` | string | noms |
| `home_team_obj` / `away_team_obj` | `{id,name,short_name}` | ids + shortName |
| `event_date` | ISO datetime | `scheduledAt` |
| `status` | string | `notstarted` \| `1st_half` \| `2nd_half` \| `HT` \| `finished` \| `canceled`… |
| `home_score` / `away_score` | number\|null | live scores |
| `current_minute` | number | minute live |
| `period` | string | `FT`, `2T`, `HT`… |
| `odds_home` / `odds_draw` / `odds_away` | number\|null | cotes 1X2 (pas un array bookmakers) |
| `odds_over_25` / `odds_under_25` | number\|null | O/U 2.5 |
| `odds_btts_yes` / `odds_btts_no` | number\|null | BTTS |
| `live_stats.home\|away` | object | possession, shots, corners… |
| `jerseys.home\|away.player.base` | hex sans `#` | couleur équipe |
| `venue` | object\|null | stade |
| `incidents` | array | goals, cards, subs (live) |
| `funfacts` | array | phrases H2H |
| `sr_stats` | object | attack / dangerous_attack |

### Live stats clés
`ball_possession`, `total_shots`, `shots_on_target`, `corner_kicks`, `total_saves`, `fouls`, `yellow_cards`

---

## Mapping code PariScore

```
BSD API
  └─ bsd-football-fetcher.ts
       ├─ fetchBSDFootballPrematch() → /matches/?status=notstarted
       ├─ fetchBSDFootballLive()     → /live/
       └─ buildMatch() → FootballMatch
            └─ routes:
                 /api/football/matches
                 /api/football/live
                 /api/football/prematch
                      └─ use-football-matches.ts (fallback mock si erreur)
```

---

## Erreurs HTTP
| Code | Signification |
|------|----------------|
| 401 | Token invalide / mal formé |
| 402 | Addon BSD requis |
| 404 | Mauvaise base URL (ex. `/football/api/v2/`) |
| 429 | Rate limit |

---

## Notes calendrier
- Mi-juillet : big-5 EU hors saison → `league=1` (EPL) peut renvoyer `count:0`
- Ligues actives observées 2026-07-19 : USL, NWSL, Liga MX, Allsvenskan, K League, friendlies, Superliga RO, etc.

## Logos
BSD ne fournit pas de logos. Fallback PariScore : table `team_logos`, skill `ps-scrape-logos`, couleurs jersey BSD.
