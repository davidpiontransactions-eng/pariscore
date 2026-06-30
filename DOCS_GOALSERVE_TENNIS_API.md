# 📋 Goalserve Tennis API — Documentation Complète

**Date** : 2026-06-30 · **Source** : [documentation.goalserve.com/v1](https://documentation.goalserve.com/v1/) + [goalserve.com/tennis-api/prices](https://www.goalserve.com/en/sport-data-feeds/tennis-api/prices)

---

## 1. Vue d'ensemble

| Élément | Valeur |
|---------|--------|
| **Provider** | Goalserve |
| **Sport couvert** | Tennis (ATP, WTA, Grand Slams, Challenger, ITF) |
| **Données** | Fixtures, Live scores, Results, In-Game stats, Profiles, **Point-by-Point**, Odds prematch + inplay |
| **Formats** | XML + JSON |
| **Delivery** | REST API (GET) + Webhooks (POST) + **WebSocket** |
| **Latence** | Temps réel (WS push) |
| **Prix** | Tennis Basic : **$150/mois** · 6 mois : $1,000 |

---

## 2. Architecture d'accès

### 2.1 Prérequis
1. Compte Goalserve + clé API privée
2. **IP whitelist** côté Goalserve
3. URL de requête fournie depuis l'admin Goalserve (`{REQUEST_URL_FROM_ADMIN}`)

### 2.2 3 canaux de livraison

| Canal | Méthode | Use case |
|-------|---------|----------|
| **REST API** | `GET` → XML/JSON | Polling classique |
| **Webhooks** | `POST` vers ton serveur | Push événements (goals, points, stats changes, odds changes) |
| **WebSocket** | `ws://85.217.222.218:8765/ws/tennis?tkn={JWT}` | **Temps réel point-by-point** |

---

## 3. Endpoints connectables pour PariScore

### 3.1 REST Inplay — Tennis Live

**URL** : `{REQUEST_URL_FROM_ADMIN}` (fournie par Goalserve admin)
**Méthode** : `GET`
**Format** : JSON

**Response shape tennis** (extrait du schema officiel) :
```json
{
  "updated": "datetime",
  "updated_ts": "timestamp",
  "events": {
    "{event_id}": {
      "core": {
        "stopped": "0|1",
        "blocked": "0|1",
        "finished": "0|1",
        "updated_ts": "timestamp"
      },
      "info": {
        "id": "match_id",
        "bet365id": "bet365_match_id",
        "name": "Player A vs Player B",
        "sport": "Tennis",
        "league": "ATP Wimbledon",
        "period": "Set 2",
        "score": "7:5,3:3",
        "state_info": "7:3~5:3#2~1#36% (4/11)~60% (3/5)#69~69#50~29",
        "state": "9001"
      },
      "team_info": {
        "home": { "name": "Player A", "Serve": "" },
        "away": { "name": "Player B", "Serve": "" }
      },
      "stats": {
        "0": { "name": "ITeam", "home": "Player A", "away": "Player B" },
        "1": { "name": "POINTS", "home": 0, "away": 0 },
        "2": { "name": "S1", "home": 7, "away": 5 },
        "3": { "name": "T", "home": 1, "away": 0 },
        "4": { "name": "S2", "home": 3, "away": 3 },
        "5": { "name": "TURN", "home": 0, "away": 1 }
      },
      "extra": [
        { "value": "Game 18 - Player A - holds to love" },
        { "value": "Game 17 - Player B - holds to 15" },
        { "value": "Game 16 - Player B - breaks to love" }
      ],
      "odds": {
        "66": { "name": "Set 2 Race to", "participants": {...} },
        "67": { "name": "To Win", "participants": {...} },
        "10100": { "name": "Player 1 Over/Under by Games", "participants": {...} }
      }
    }
  }
}
```

### 3.2 Champs tennis — mapping complet

| Champ Goalserve | Type | Description | Mapping PariScore |
|-----------------|------|-------------|-------------------|
| `events.{id}.info.id` | int | Match ID | `_bsd_match_id` / `id` |
| `events.{id}.info.bet365id` | int | Bet365 cross-ref | `bet365_id` |
| `events.{id}.info.name` | string | "P1 vs P2" | `player1.name` / `player2.name` |
| `events.{id}.info.league` | string | Tournament | `tournament` |
| `events.{id}.info.period` | string | "Set 2" | `current_set_index` (parse) |
| `events.{id}.info.score` | string | "7:5,3:3" | `sets[]` (parse CSV) |
| `events.{id}.info.state_info` | string | **Rich state** (format `set_score~game_score#server#stats`) | **PBP dérivable** |
| `stats.TURN.home/away` | 0/1 | **Qui sert** | `serving` (1=home, 2=away) |
| `stats.S1..S5.home/away` | int | Score par set | `sets[i].p1/p2` |
| `stats.POINTS.home/away` | int | Points dans jeu courant | `current_point` |
| `stats.T.home/away` | int | Sets gagnés total | `player1_sets/player2_sets` |
| `extra[].value` | string | **Game commentary** ("breaks to love", "holds to 15") | PBP winner inférable |
| `odds.67` (To Win) | object | Cotes match-winner live | `odds_player1/2` |
| `odds.66` (Set Race) | object | Cotes set en cours | set-odds |
| `odds.10100` (O/U Games) | object | Over/Under total games | games-ou |

### 3.3 `state_info` — Le champ le plus riche

Format : `games_p1:games_p2~set_score#server#1st_serve%~return%~total_pts%~bp`
```
Exemple : "7:3~5:3#2~1#36% (4/11)~60% (3/5)#69~69#50~29"
```
- `7:3` = points dans jeu courant (p1:p2)
- `5:3` = games dans set courant
- `#2~1` = set courant=2, serveur=1 (home)
- `36% (4/11)` = 1st serve win% p1 (4/11 points)
- `60% (3/5)` = 1st serve win% p2
- `69~69` = total points p1~p2
- `50~29` = **break points** related

→ **DR (Dominance Ratio) dérivable directement** : `(p1_pts_won) / (p2_pts_won)` = `69/69` = 1.0

### 3.4 WebSocket — Temps réel

**Auth** :
```
POST http://85.217.222.218:8765/api/v1/auth/gettoken
Body: { "apiKey": "YOUR_GOALSERVE_API_KEY" }
→ { "token": "JWT_TOKEN" }
```

**Connexion** :
```
ws://85.217.222.218:8765/ws/tennis?tkn={JWT_TOKEN}
```

**Messages** :
- `"avl"` — liste des matchs disponibles
- `"updt"` — update temps réel (score, stats, odds, commentaires)

**Stats codes tennis** : `TURN` (serving), `S1-S5` (sets), `POINTS`, `TBP` (tiebreak points), `T` (total)

### 3.5 Webhooks — Push événements

Goalserve POST vers ton endpoint avec signature `GOALSERVE-SECURITY-SIGNATURE`.

Use case : pas de polling, push instantané sur changement de score/point/odds.

---

## 4. Mapping PariScore → Goalserve

| Champ PariScore `_bsd_stats` | Source Goalserve `state_info` |
|------------------------------|-------------------------------|
| `p1_first_pct` | `state_info` 1st serve% p1 |
| `p1_first_won` | `state_info` win% p1 |
| `p1_ret_won` | dérivé : `100 - p2_first_won` |
| `p1_total_pts` | `state_info` total_pts p1 |
| `p1_bp_saved` | `state_info` break points |
| `serving` | `stats.TURN` |

| Champ PariScore match | Source Goalserve |
|-----------------------|------------------|
| `player1.name` | `team_info.home.name` |
| `player1_sets` | `stats.T.home` |
| `sets[]` | `stats.S1..S5` |
| `current_point` | `state_info` (partie `7:3`) |
| `serving` | `stats.TURN.home/away` |
| `odds_player1` | `odds.67.participants.home.value_eu` |
| `tournament` | `info.league` |

---

## 5. Odds Markets tennis disponibles

| Market ID | Nom | Connectable PariScore ? |
|-----------|-----|------------------------|
| `67` | To Win (match) | ✅ `odds_player1/2` |
| `66` | Set Race to N | ✅ set-odds live |
| `10100` | Player O/U by Games | ✅ games-ou |
| `80852` | Game Winner (Set N) | ✅ point-level betting |

---

## 6. Points de connexion PariScore

### 6.1 Polling REST (équivalent `pollTennisLive` actuel)
```js
// Remplacer/augmenter fetchBSDTennisLive avec fetchGoalserveTennisLive
async function fetchGoalserveTennisLive() {
  const res = await httpsGet(GOALSERVE_INPLAY_URL, { 'Authorization': 'Token ...' });
  if (!res || !res.p) return [];
  return Object.values(res.p.events).map(_normalizeGoalserveTennisMatch);
}
```

### 6.2 WebSocket (équivalent `BSD_LIVE_WS`)
```js
// ws://85.217.222.218:8765/ws/tennis?tkn=JWT
// Messages "updt" → enrichissement live PariScore direct
// Remplace le poll 30s par push <2s
```

### 6.3 PBP via `extra[]` commentary
Les messages `extra[].value` ("Game 18 - Player A - holds to love") permettent de **reconstruire un PBP game-level** : qui a gagné chaque game (hold/break). Plus riche que l'aiscore actuel (winner null intra-game).

---

## 7. Comparaison Goalserve vs BSD (actuel PariScore)

| Critère | BSD (actuel) | Goalserve |
|---------|-------------|-----------|
| Point-by-point | ❌ (cumulatif seulement) | ✅ via `state_info` + `extra[]` |
| WebSocket tennis | ❌ (WS = foot only) | ✅ `ws/tennis` |
| DR point-level | ❌ (snapshot 60s) | ✅ dérivable `state_info` |
| Serve stats live | ✅ `_bsd_stats` (60s) | ✅ `state_info` (temps réel) |
| Odds multi-books | ✅ (14+ books) | ✅ (bet365 focus) |
| Coverage ATP/WTA | ✅ | ✅ (+ Challenger/ITF) |
| Prix | $5/mois (addon) | **$150/mois** |
| Latence | 30-60s | **<2s (WS)** |

**Verdict** : Goalserve apporte le **temps réel WebSocket** + **PBP game-level** que BSD n'a pas. Justifie les $150/mois uniquement si tu monétises le live trading (Phase 2 : live value bets).

---

## 8. Plan d'intégration (si décision GO)

1. **Phase 1** (1 jour) : `services/goalserveService.js` — REST polling + `_normalizeGoalserveTennisMatch` + merge avec BSD (priorité Goalserve si dispo)
2. **Phase 2** (1 jour) : WebSocket Goalserve → remplace poll 30s pour tennis live
3. **Phase 3** (0.5 jour) : PBP `extra[]` parser → enrichir `tennisMomentumTracker` (game-level winner)

**Feature flags** : `GOALSERVE_ENABLED`, `GOALSERVE_API_KEY`, `GOALSERVE_WS_ENABLED`

---
*Documentation générée par skill /metier-scraping-websearch — WebSearch + mcp__web_reader sur documentation.goalserve.com/v1.*
