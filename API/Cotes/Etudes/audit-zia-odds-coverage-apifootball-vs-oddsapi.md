# Audit bd `zia` — Coverage Odds API vs API-Football

> Généré : 2026-05-22T19:30:54.560Z  |  Durée : 51.2s
> Ligues sondées : 135, 140  |  Mode : LIVE
> Clés : ODDS_API_KEY=OK · API_FOOTBALL_KEY=OK

## Synthèse

- **Matchs Odds API** : 0
- **Matchs API-Football** : 3
- **Intersection** : 0 (0.0% coverage AF vs OA)
- **Avg # bookmakers** : OA=0.0 · AF=14.0
- **Median Δcote%** (positif → OA cote plus haute) : home=n/a% · draw=n/a% · away=n/a%

## Détail par ligue

| Ligue | OA | AF | Inter. | only OA | only AF | Avg books OA | Avg books AF | Δ% home | Δ% draw | Δ% away |
|---|---|---|---|---|---|---|---|---|---|---|
| Serie A | 0 | 3 | 0 | 0 | 3 | 0.0 | 14.0 | n/a | n/a | n/a |
| La Liga | 0 | 0 | 0 | 0 | 0 | 0.0 | 0.0 | n/a | n/a | n/a |

## Notes

- **Serie A** : OA=HTTP 401 · AF=no fixtures in league
- **La Liga** : OA=HTTP 401 · AF=fixtures HTTP 429 {"rateLimit":"Too many requests. You have reached your per-minute request limit. Please wait a few seconds before retrying or upgrade your plan for higher limits."}

## Interprétation

- **Coverage** : % de matchs Odds API également présents dans API-Football (fenêtre J+0..J+2).
- **Avg books** : nombre moyen de bookmakers par match (mesure profondeur sourcing).
- **Δ% (positif)** : meilleure cote OA > meilleure cote AF → OA capture plus de high-edge.
- **Δ% (négatif)** : AF propose cotes plus élevées (rare si bookmakers EU similaires).

## Recommandation bd `zia`

> 🔴 **NO-GO migration totale** : couverture AF insuffisante. Conserver Odds API source primaire. AF = enrichissement ligues exotiques absent OA.

## ⚠️ Contexte session 22/05/2026

**Limitations cet audit :**

1. **ODDS_API_KEY HTTP 401** : la clé OA actuelle est révoquée/expirée (cf. CLAUDE.md actions ops post-session #2 "Revoke RapidAPI key"). Comparaison cross-source impossible cette session. Réauditer après rotation clé OA.

2. **API_FOOTBALL_KEY plan Free 100 req/jour** : malgré la mention CLAUDE.md `.claude/CLAUDE.md` section 3.2 "PRO 7500 req/jour", l'appel `/status` révèle plan = `Free`, `limit_day = 100`. Cohérent avec le kill-switch `AF_REMOVED = true` v10.77 dans `server.js` (downgrade vs claim CLAUDE.md).

3. **Restrictions Free plan API-Football** :
   - `/odds?league=X&season=Y` → erreur `Free plans do not have access to this season, try from 2022 to 2024`.
   - `/odds?date=YYYY-MM-DD` → erreur si > J+2 : `try from 2026-05-21 to 2026-05-23`.
   - Per-minute rate-limit ~10 req → 429 fréquent sans throttle.

## Validation in-process module odds-apifootball.js

Test direct via `fetchOddsByDate('2026-05-23', { filterEU: true })` :

- **30 fixtures** retournées avec cotes 1X2 EU
- Schema mapping correct → format The Odds API attendu par `computeEdge()`
- `enrichWithOdds()` injecte `bookmakers` au format `[{key, title, markets:[{key:'h2h', outcomes:[{name, price}]}]}]`
- Sample : Bologna vs Inter (9 books filtrés EU, 1xBet first), Lazio vs Pisa (9 books)

## Schema mapping API-Football → PariScore

| API-Football | PariScore |
|---|---|
| `entry.fixture.id` | `_af_fixture_id` |
| `entry.fixture.date` | `commence_time` (via /fixtures?date= join) |
| `entry.teams.home.name` (via /fixtures?date= join) | `home_team` |
| `entry.bookmakers[].name` | `bookmakers[].title` |
| `entry.bookmakers[].bets[id=1].values[value='Home']` | `bookmakers[].markets[h2h].outcomes[].price` (home) |
| `entry.bookmakers[].bets[id=1].values[value='Draw']` | `bookmakers[].markets[h2h].outcomes[].price` (Draw) |
| `entry.bookmakers[].bets[id=1].values[value='Away']` | `bookmakers[].markets[h2h].outcomes[].price` (away) |

## Décision actualisée bd `zia`

> 🟡 **Hybrid maintain** (révision NO-GO automatique ci-dessus) : la couverture mesurée est artificielle (OA 401), pas représentative. Mais le plan Free 100 req/jour AF + fenêtre J+0..J+2 + rate-limit aigu → impossible de migrer en source primaire **sans upgrade plan API-Football PRO** (≥ 19$/mois 7500 req/j).
>
> **Recommandation finale** :
> - Code adaptateur `odds-apifootball.js` livré + opt-in `USE_API_FOOTBALL_ODDS=1` désactivé par défaut → safe.
> - **Avant activation prod** : upgrade plan AF Pro ou bien clarifier DG (la mention CLAUDE.md `PRO 7500 req/jour` ne correspond pas à l'état actuel du compte `david.pion74@gmail.com` = plan Free).
> - **Alternative** : utiliser `USE_API_FOOTBALL_ODDS=1` pour matchs **sans cotes BSD/ESPN/odds-api1** (cas exotique uniquement) → consommation < 100 req/j possible.

*Tool : `tools/audit-zia-odds-coverage.js`*