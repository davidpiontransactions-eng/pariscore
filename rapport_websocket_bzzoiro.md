# Rapport — Intégration WebSocket Bzzoiro (BSD Live) dans PariScore

> **Auteur** : Claude (GM PariScore)
> **Date** : 2026-05-20
> **Statut** : ⏳ Attente GO du DG avant injection code prod
> **Cible** : Football live (foot uniquement, tennis hors scope WS pour cette itération)

---

## 1. ENDPOINTS & AUTH

### 1.1 URL & token
| Champ | Valeur |
|---|---|
| Endpoint primaire | `wss://sports.bzzoiro.com/ws/live/` |
| Auth | Query string `?token=YOUR_TOKEN` (ou WebSocket subprotocol) |
| Token | `BSD_LIVE_TOKEN` (déjà déclaré server.js:25661) — fallback `BSD_TOKEN` puis `BSD_API_KEY` |
| Doc source | https://sports.bzzoiro.com/docs/websocket/ |
| Demo live | https://sports.bzzoiro.com/websocket/debug/ |

### 1.2 Exemple URL
```
wss://sports.bzzoiro.com/ws/live/?token=<BSD_LIVE_TOKEN>
```

### 1.3 Limites
- **10 matchs concurrents** par socket (rate limit officiel)
- Throttle livedata : ~5 s par tick
- Throttle event : ~30 s par snapshot
- Replay : 30 frames livedata rejouées à la souscription (warm-up gratuit)

---

## 2. MESSAGES PROTOCOL

### 2.1 Client → Serveur
| Action | Payload |
|---|---|
| Subscribe (cotes consensus défaut) | `{"action":"subscribe","event_id":204849}` |
| Subscribe (cotes bookmaker précis) | `{"action":"subscribe","event_id":204849,"bookmaker_slug":"pinnacle"}` |
| Unsubscribe | `{"action":"unsubscribe","event_id":204849}` |
| Ping (heartbeat) | `{"action":"ping"}` |

### 2.2 Serveur → Client : valeurs `type`
`odds`, `odds_book`, `subscribed`, `event`, `livedata`, `unsubscribed`, `pong`, `error`

### 2.3 Frame `event` (snapshot scoreboard, ~30 s)
```json
{
  "type": "event",
  "event_id": 204849,
  "home": {"id": 4823, "name": "Kyoto Sanga", "short_name": "Kyoto"},
  "away": {"id": 4825, "name": "Gamba Osaka", "short_name": "Gamba"},
  "score": {"home": 1, "away": 1},
  "time": {
    "minute": 90,
    "period": "penalties",
    "status": "penalties",
    "kickoff_at": "2026-05-02T11:00:00+00:00"
  },
  "stats": {
    "home": { "ball_possession": 52, "total_shots": 14, "shots_on_target": 5,
              "passes": 412, "accurate_passes": {"value": 348, "total": 412, "pct": 84.5},
              "xg": 1.42 },
    "away": {}
  }
}
```

### 2.4 Frame `livedata` (tick situation, ~5 s)
```json
{
  "type": "livedata",
  "event_id": 204849,
  "uts": 1777745495516,
  "side": "home",
  "situation": "attack",
  "coordinates": [{"x": 65.5, "y": 42.0}, {"x": 68.2, "y": 44.5}]
}
```
Situations possibles : `possession`, `attack`, `dangerous`, `safe`, `corner`, `freekick`, `throwin`, `goalkick`, `penalty`, `shotontarget`, `shotofftarget`, `goal`, `offside`, `injury`, `substitution`.

### 2.5 Frame `odds` (cotes mises à jour)
```json
{
  "type": "odds",
  "event_id": 205764,
  "odds": {
    "match_winner": {"home": 2.07, "draw": 4.08, "away": 2.87},
    "over_under": { "over_15": 1.06, "under_15": 7.96,
                    "over_25": 1.26, "under_25": 3.61,
                    "over_35": 1.84, "under_35": 1.89 },
    "btts": {"yes": 1.34, "no": 3.08}
  },
  "updated_at": "2026-05-06T08:36:23+00:00"
}
```

### 2.6 Frame `error`
```json
{"type":"error","code":"not_tracked|limit|bad_action|bad_event_id|unknown_bookmaker"}
```

### 2.7 Heartbeat
- Client : `{"action":"ping"}`
- Serveur : `{"type":"pong"}`
- Cadence recommandée : 25 s (avant timeout serveur typique 30 s)

---

## 3. CHAMPS DATA — INVENTAIRE EXHAUSTIF FOOT

### 3.1 Stats équipe (`event.stats.home` / `event.stats.away`)
**Possession & tirs**
- `ball_possession` (%)
- `total_shots`, `shots_on_target`, `shots_off_target`, `shots_inside_box`, `blocked_shots`

**Corners / fautes / cartons**
- `corner_kicks`, `fouls`, `yellow_cards`, `red_cards`, `offsides`

**Passes**
- `passes`, `accurate_passes` `{value,total,pct}`, `pass_accuracy_pct`, `long_balls`, `crosses`, `through_balls`

**Occasions**
- `big_chances`, `big_chances_missed`, `big_saves`

**Défense**
- `tackles`, `tackles_won`, `interceptions`, `clearances`, `recoveries`, `dispossessed`

**Duels**
- `duels`, `ground_duels`, `aerial_duels`

**Pression / pénétration**
- `dribbles`, `final_third_entries`, `fouled_in_final_third`, `touches_in_penalty_area`

**xG**
- `xg` (cumulative expected goals temps réel)

### 3.2 Momentum (Premium, refresh ~2 min)
- `attack` (phases d'attaque entrées)
- `dangerous_attack` (attaques dangereuses entrées)
- `ball_safe`
- `attack_pct`, `dangerous_attack_pct`, `ball_safe_pct`

### 3.3 Livedata tick (`livedata` frame)
- `side` : `home` / `away`
- `situation` : voir 2.4
- `coordinates[]` : array de `{x, y}` (position ballon, repère terrain 0–100)
- `uts` : Unix ms

### 3.4 Time / état match
- `time.minute`, `time.period`, `time.status`, `time.kickoff_at` (ISO 8601)

### 3.5 Cotes
- `match_winner.home/draw/away`
- `over_under.over_15/25/35` + `under_15/25/35`
- `btts.yes/no`

---

## 4. ÉTAT ACTUEL CODEBASE (existant à intégrer)

| Composant | Présent | Localisation |
|---|---|---|
| `BSD_LIVE_TOKEN` env var | ✅ | server.js:25661 |
| `BSD_LIVE_WS_HOST/PATH/ENABLED` | ✅ | server.js:25662-25664 |
| Socket state (`_bsdWsSock`, `_bsdWsBuf`, `_bsdWsBackoff`) | ✅ | server.js:25666-25670 |
| Match lookup par `_bsd_event_id` | ✅ | `_bsdWsLookupMatch` server.js:25672 |
| Parser défensif (alias-based) | ⚠️ à remplacer par schéma exact | `_bsdWsParse` server.js:25687 |
| Throttle `_bsdWsLastBcast` | ✅ | server.js:25670 |
| SSE infra (`sseClients` + `broadcastSSE`) | ✅ | server.js:1224-1230 |
| Reconnect backoff | ✅ amorcé | `_bsdWsBackoff = 2000` |
| Subscribe / unsubscribe loop | ❌ | — |
| Heartbeat ping/pong 25 s | ❌ | — |
| Dispatch typé (event/livedata/odds) | ❌ | — |
| `pollLiveScores` 60 s (legacy) | ✅ | server.js:26020 |

**Verdict** : 60% du scaffold est en place. Reste : handshake HTTP-Upgrade WS, subscribe loop sur matchs live, parsing schéma exact, dispatch SSE typé, heartbeat, frontend.

---

## 5. PLAN INTÉGRATION TECHNIQUE

### 5.1 Architecture cible
```
   BSD WS                Node server.js                 Frontend SPA
   ──────                ──────────────                 ────────────
   wss://sports.bzzoiro  ┌─────────────────┐            ┌─────────────────┐
   .com/ws/live/         │ bsdWsClient.js  │            │ ws-overlay.js   │
   ?token=…       ◀───▶ │ - connect()     │  SSE       │ - badge néon    │
   subscribe/unsub       │ - subscribeAll()│  ─────▶    │ - tooltip+++   │
   ping/pong             │ - heartbeat()   │  ws_event  │ - patch tile    │
                         │ - dispatch()    │  ws_live   │   live (xG/mom) │
                         │ - reconnect()   │  ws_odds   │                 │
                         └─────────────────┘            └─────────────────┘
                                ▲
                                │ scan db.matches → is_live → event_id
```

### 5.2 Backend — étapes
1. **Module séparé** `bsdWsClient.js` (ou bloc unique `server.js` après ligne 25719, zéro npm — `https` natif suffit pour le handshake HTTP-Upgrade, RFC 6455 implémenté à la main, cohérent avec ADN zero-dep).
   - Alternative pragmatique : ajouter `ws` (npm, ~80 Ko, battle-tested) si DG accepte première entorse zero-dep. **Recommandation** : `ws` (gain stabilité massif vs effort RFC 6455 maison, ws est de facto le standard Node).
2. **`connectWS()`** : ouvre socket, attend `open`, lance `subscribeAll()`.
3. **`subscribeAll()`** : itère `db.matches.filter(m => m.is_live && m._bsd_event_id)` → envoie `{"action":"subscribe","event_id":<id>}` (cap 10 simultanés — implémenter file d'attente FIFO si > 10).
4. **`onMessage(msg)`** :
   - `type:event` → patch `db.matches[i].liveStats` (possession/shots/xG/momentum) + `broadcastSSE('ws_event', {...})`.
   - `type:livedata` → push `match.liveTicks[]` ring-buffer N=60 + `broadcastSSE('ws_livedata', {...})` throttle 1 Hz max.
   - `type:odds` → patch `match.odds_live` + `broadcastSSE('ws_odds', {...})`.
   - `type:pong` → reset `_bsdWsLastPong = Date.now()`.
   - `type:error` → log + retry sub si `not_tracked` éphémère.
5. **`heartbeat()`** : `setInterval(() => sock.send({action:'ping'}), 25_000)`. Si dernier pong > 60 s → `sock.terminate()` (force reconnect).
6. **`reconnect()`** : backoff exponentiel 2 s → 4 s → 8 s → cap 60 s. Re-subscribe au open.
7. **Dynamic subscribe** : hook sur `pollLiveScores()` quand un match passe `pre-match → live`, `subscribe()` ; quand `live → FT`, `unsubscribe()`.
8. **Kill-switch** : `BSD_LIVE_WS_ENABLED=false` env → fallback total sur `pollLiveScores` 60 s legacy.

### 5.3 Routes API exposées (frontend)
| Route | Méthode | Effet |
|---|---|---|
| `/api/v1/sse` (existant) | GET | Frontend reçoit `ws_event` / `ws_livedata` / `ws_odds` |
| `/api/v1/live/ws-status` | GET (nouveau) | Retourne `{connected:bool, subs:[event_id…], last_pong:ts, backoff_ms}` |

### 5.4 Frontend — étapes
1. **Listener SSE** dans `pariscore.html` : `evt.addEventListener('ws_event', …)`, idem `ws_livedata`, `ws_odds`. Patch DOM ciblé : `[data-match-id="…"] .live-xg`, `.live-mom`, etc.
2. **État connexion WS** : `fetch('/api/v1/live/ws-status')` à l'ouverture onglet Foot, puis SSE event `ws_status` à chaque change.
3. **Bouton "🔴 LIVE"** : ajout halo néon vert quand `wsConnected===true`, rouge si déconnecté. Pulse CSS `animation: ws-pulse 1.4s infinite`.
4. **Tooltip enrichi** : `title="⚡ Propulsé WebSocket Bzzoiro · xG live, Momentum, Attaques Danger, Cotes temps réel"`.
5. **Anti-doublon** : si payload SSE `ws_event` arrive < 2 s après `pollLiveScores`, le WS gagne (plus frais).

### 5.5 Schéma DB enrichi
- `match.liveStats = {ball_possession, total_shots, shots_on_target, xg, big_chances, …}` (32 champs section 3.1).
- `match.momentum = {attack_pct, dangerous_attack_pct, ball_safe_pct}` (refresh ~2 min).
- `match.liveTicks = [{uts, side, situation, coordinates}, …]` ring-buffer 60.
- `match.odds_live = {match_winner, over_under, btts, updated_at}`.

### 5.6 Sécurité
- Token jamais exposé frontend (côté serveur Node uniquement, comme `GEMINI_API_KEY`).
- WS URL côté Node uniquement, frontend ne voit que `/api/v1/sse`.
- Si `BSD_LIVE_TOKEN` manquant → log warn + désactivation propre, pas de crash.

### 5.7 Risques & mitigations
| Risque | Mitigation |
|---|---|
| Cap 10 subs / socket dépassé soir UEFA | File FIFO + priorité par EV/edge desc + 2e socket si > 20 matchs |
| WS down côté BSD | Fallback `pollLiveScores` 60 s reste actif en parallèle (DUAL pendant 1 release) |
| Token revoqué | 401 close → log explicite + désactivation |
| Mapping `event_id` ↔ `_bsd_event_id` cassé | Lookup défensif `_bsdWsLookupMatch` déjà tolérant home/away fuzzy |
| Mémoire ring-buffer | Cap 60 ticks × 10 matchs × ~150 B = 90 Ko OK |

---

## 6. LIVRABLES SI GO

1. **Backend** : module WS complet (subscribe loop, heartbeat, reconnect, dispatch SSE typé) + route `/api/v1/live/ws-status` + hook sur `pollLiveScores` pour subscribe/unsubscribe dynamique.
2. **Frontend** : badge néon WS connecté sur bouton "🔴 LIVE", tooltip enrichi, listener SSE pour `ws_event`/`ws_livedata`/`ws_odds`, patch DOM ciblé tile match.
3. **Variables `.env`** :
   ```
   BSD_LIVE_TOKEN=<token>
   BSD_LIVE_WS_ENABLED=true
   BSD_LIVE_WS_HOST=sports.bzzoiro.com
   BSD_LIVE_WS_PATH=/ws/live/
   ```
4. **Décision dépendance** : `ws` npm vs handshake maison (recommandation : `ws`).
5. **Test** : 1 match live UEFA / Ligue 1 monitoré 90 min, validation : pong reçu, ticks reçus, score patché, reconnect après kill manuel socket.
6. **Doc CHANGELOG** : entrée `v11.0 — BSD Live WebSocket`.

---

## 7. RÉSUMÉ EXÉCUTIF — DÉCOUVERTES

- **Endpoint unique** : `wss://sports.bzzoiro.com/ws/live/?token=…`
- **3 types frames** utiles foot : `event` (~30 s), `livedata` (~5 s), `odds` (push)
- **~40 champs stats** par équipe + 6 champs momentum + xG live
- **15 situations** livedata avec coordonnées ballon (terrain 0–100)
- **Cap 10 matchs / socket**, replay 30 frames au sub, ping/pong simple
- **60% scaffold déjà en place** (env, state, lookup, parser défensif, SSE infra)
- **Effort estimé** : 1.5 j backend + 0.5 j frontend + 0.5 j test = **2.5 j dev**
- **Gain UX** : passage de 60 s → 5 s latence ticks, xG cumulé temps réel, cotes push, badge confiance néon
- **Risque principal** : cap 10 subs (mitigeable file/priorité)

---

⏳ **ATTENTE GO DU DG** pour injection backend + UI.
Aucun fichier `server.js` / `pariscore.html` modifié à ce stade.
