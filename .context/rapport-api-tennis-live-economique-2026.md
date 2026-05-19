# Rapport — API Tennis Live économiquement intéressantes (étude doc + endpoints)

> Date : 2026-05-19 · Contexte : PariScore, backend Node.js **zéro-dépendance**, onglet Tennis live (RG/ATP/WTA). Source actuelle : BSD (ESPN-dérivé, gratuit) + LiveScore public (v10.67) — pas de point-par-point fiable.

---

## ⚠️ CORRECTIF vs rapport précédent

Le rapport antérieur recommandait « API-Sports tennis ($10, synergie clé API-Football ». **FAUX, vérifié sur doc officielle** : `api-sports.io` ne couvre **PAS** le tennis (Soccer, F1, NFL, MLB, NBA, NHL, Rugby, Volley, Handball uniquement — 9 sports, tennis absent). Aucune synergie possible. Le « api-tennis.com » est un fournisseur **distinct** (nom proche, entité différente).

---

## 1. Marché — synthèse économique

| API | Prix/mois | Live PBP | WebSocket | Free | Zéro-dep compatible | Verdict |
|---|---|---|---|---|---|---|
| **api-tennis.com** | $40 / $60 / $80 | ✅ `pointbypoint` array | ✅ WSS (tier ?) | Trial 14j | ✅ REST natif / ⚠️ WSS=dep | **Meilleur rapport** |
| Goalserve | $150 → $1000 | ✅ refresh 5s | XML/JSON push | Trial 30j | ✅ REST | PBP référence, cher |
| SportDevs | bas coût (~$) | ✅ | ✅ | Free tier | ✅ REST | Alternative à benchmarker |
| api-sports.io | $19-39 | — | — | 7500 req/j | ✅ | **PAS de tennis** — exclu |
| SportRadar v3 | Enterprise (devis) | ✅ officiel | ✅ | Trial dev | ✅ | Surdimensionné, hors budget |
| SportsDataIO / LSports | Enterprise | ✅ | ✅ | Trial | ✅ | B2B, prix opaque |

**Gagnant économique : api-tennis.com.** Seul à offrir PBP + WSS temps réel à prix PME ($40-80/mo), trial 14j sans engagement.

---

## 2. api-tennis.com — étude endpoints (doc v2.9.4)

Base REST : `https://api.api-tennis.com/tennis/?method={method}&APIkey={KEY}`
Auth : paramètre `APIkey` (query). Format : JSON. Filtres : `event_type_key`, `tournament_key`, `match_key`, `player_key`, `timezone` (défaut Europe/Berlin).

| Méthode | Usage |
|---|---|
| `get_events` | Types d'épreuves (ATP/WTA/ITF/Challenger) |
| `get_tournaments` | Tournois dispo (→ retrouver clé Roland Garros) |
| `get_fixtures` | Matchs passés/futurs (programme) |
| **`get_livescore`** | **Matchs en cours — cœur du besoin live** |
| `get_H2H` | Historique confrontations |
| `get_standings` | Classements ATP/WTA |
| `get_players` | Profils joueurs |
| `get_odds` / `get_live_odds` | Cotes pré-match / live |

### Endpoint live à 100% — `get_livescore`
```
GET https://api.api-tennis.com/tennis/?method=get_livescore&APIkey=KEY
```
Champs réponse clés :
- `event_status` : ex `"Set 1"` · `event_live` : `1` = en cours
- `event_serve` : joueur au service
- `scores[]` : `score_first`, `score_second`, `score_set` (sets/jeux)
- **`pointbypoint[]`** : par jeu — `number_point`, `score`, `break_point`, `set_point`, `match_point` → **vrai point-par-point**

### Live à 100% — WebSocket (push temps réel)
```js
var socket = new WebSocket('wss://wss.api-tennis.com/live?APIkey=' + APIkey);
```
- Push auto à chaque événement live (point, jeu, set)
- JSON : joueurs, scores, statut, breakdown jeu-par-jeu, stats point-level horodatées
- Filtres : `tournament_key`, `match_key`, `player_key`
- ⚠️ Tier requis pour WSS **non documenté** (probablement Business $80 — InPlay+WebSocket listés ensemble sur pricing)

---

## 3. Contrainte architecturale PariScore (CRITIQUE)

**Zéro-dépendance npm = règle dure (CLAUDE.md §2.2).**

- ✅ **REST `get_livescore`** : `https` natif Node, polling 30s (pattern identique à LiveScore v10.67 `_lsFetch`). Respecte zéro-dep. **Voie recommandée.**
- ⚠️ **WSS `wss.api-tennis.com`** : Node n'a **pas de client WebSocket natif** (avant le module `node:http` upgrade manuel). Soit dépendance `ws` (viole zéro-dep), soit implémentation handshake RFC6455 brute (lourd, fragile). **À éviter sauf besoin latence sub-seconde prouvé.**

Verdict : **plan Premium $60 + polling REST `get_livescore` (30s)** suffit pour le besoin scoreboard live RG/ATP. WSS/Business $80 seulement si trading live latence-critique ultérieur.

---

## 4. Plan d'intégration proposé (NON appliqué — validation requise)

Mirroir exact du module LiveScore v10.67 :
1. `.env` → `API_TENNIS_KEY` (jamais committé).
2. `server.js` : module `_atFetch` (https natif + cache), `_atNormEvent` (map `scores[]`/`pointbypoint[]` → forme interne `sets`/`current_point`), `getApiTennisLive()`.
3. Routes Pro tennis : `GET /api/v1/tennis/apitennis/{live,fixtures,match/:key}` (gate footPro, cache 30s live).
4. Frontend : intégrer en **source prioritaire** dans la cascade `tickTennisLive` → ordre : api-tennis.com → BSD → LiveScore (fallback). Réutilise jointure paire-joueurs (Fix B déjà livré).
5. Mapping clé tournoi Roland Garros via `get_tournaments` une fois (cache 24h).

Coût : $60/mo (Premium) — à arbitrer budget mai 2026.

---

## 5. Recommandation finale

1. **Trial 14j gratuit api-tennis.com** → valider sur match RG/ATP live réel : richesse `pointbypoint` vs feed BSD actuel.
2. Si concluant → **Premium $60/mo + intégration REST polling** (zéro-dep préservé).
3. Benchmarker **SportDevs** en parallèle (annoncé bas coût + REST+WS) avant engagement — possible moins cher à couverture égale.
4. Goalserve seulement si PBP exhaustif Grand Chelem s'avère insuffisant chez api-tennis.com.
5. WSS/Business $80 : reporter — incompatible zéro-dep sans justification latence forte.

**Prochaine action concrète** : créer clé trial api-tennis.com, tester `get_livescore` sur un match RG en cours, comparer au scoreboard BSD corrigé (Fix a+b).
