# BSD WebSocket & REST — Payload Audit & DTO Mapping
**Date:** 2026-05-24 | **Auteur:** Lead Backend Architect  
**Sources:** get_live_scores + get_match_detail (1454, 9173) + get_match_incidents (9173) + get_match_shotmap (9173) + get_match_lineups (1454)

---

## 1. SYNTHÈSE EXÉCUTIVE

| Canal | Frames capturées | Frames ignorées | Champs manquants |
|-------|-----------------|-----------------|-----------------|
| WS `event` — score/time | ✅ 3/3 | — | `added_time` |
| WS `event` — stats | ✅ 16/38 | — | **22 champs** |
| WS `odds` | ✅ 3 marchés | AH, exact score, DNB | 3 marchés |
| WS `livedata` legacy | ✅ ball/situation/pressure | — | — |
| REST incidents | ❌ 0/8 types | ALL | goal sequence, cards, subs |
| REST shotmap | ❌ 0/0 | momentum timeline, xG/min | ALL |
| REST lineups | ❌ 0/0 | formations, players | ALL |
| REST match_detail | ❌ 0/14 | weather, HT score, derby | ALL |

**Impact immédiat :** 22 stats live + incidents + momentum timeline + xG/min perdus à chaque match.

---

## 2. STRUCTURE COMPLÈTE DES PAYLOADS

### 2.1 WS Frame `event` (inféré + confirmé)

```json
{
  "type": "event",
  "event_id": 9173,
  "score": { "home": 3, "away": 0 },
  "time": {
    "minute": 47,
    "status": "1st_half",
    "period": "1T",
    "added_time": 3         // ← NON CAPTURÉ
  },
  "home": { "name": "Club Brugge KV" },
  "away": { "name": "KAA Gent" },
  "stats": {
    "home": {
      // CAPTURÉS (16)
      "ball_possession": 52,
      "total_shots": 14,
      "shots_on_target": 7,
      "shots_off_target": 4,
      "shots_inside_box": 12,
      "blocked_shots": 3,
      "corner_kicks": 1,
      "fouls": 1,
      "offsides": null,
      "yellow_cards": 0,
      "red_cards": 0,
      "passes": 281,
      "pass_accuracy_pct": 88.3,
      "big_chances": 2,
      "big_chances_missed": 0,
      "xg": 1.52,
      "touches_in_penalty_area": 28,
      "attack_pct": 23,
      "dangerous_attack_pct": 42,
      "ball_safe_pct": 35,
      "dangerous_attack": 32,

      // NON CAPTURÉS (22) ← LACUNES
      "goalkeeper_saves": 1,
      "interceptions": 2,
      "recoveries": 23,
      "aerial_duels": { "value": 9, "total": 13, "pct": 69 },
      "ground_duels": { "value": 8, "total": 17, "pct": 47 },
      "tackles": 3,
      "total_tackles": 3,
      "tackles_won": 67,
      "hit_woodwork": 0,
      "shots_outside_box": 2,
      "big_chances_scored": 2,
      "throw_ins": 9,
      "clearances": 13,
      "goal_kicks": 4,
      "free_kicks": 5,
      "dispossessed": 5,
      "crosses": { "value": 7, "total": 13, "pct": 54 },
      "long_balls": { "value": 10, "total": 18, "pct": 56 },
      "dribbles": { "value": 2, "total": 4, "pct": 50 },
      "final_third_entries": 29,
      "final_third_phase": { "value": 78, "total": 93, "pct": 84 },
      "goals_prevented": 0.28
    }
  }
}
```

### 2.2 REST `get_match_detail` — champs non wired

```json
{
  "home_score_ht": 3,       // ← score mi-temps NON CAPTURÉ
  "away_score_ht": 0,
  "penalty_shootout": null, // ← tirs au but
  "extra_time_score": null, // ← prolongations
  "is_local_derby": true,   // ← derby local
  "is_neutral_ground": false,
  "weather": {              // ← météo
    "code": null,
    "description": null,
    "wind_speed": null,
    "temperature_c": null
  },
  "pitch_condition": null,  // ← état terrain
  "attendance": null        // ← affluence
}
```

### 2.3 REST `get_match_incidents` — structure complète

```json
{
  "type": "goal",
  "minute": 41,
  "added_time": null,
  "player": "N. Tresoldi",
  "player_id": 3545,
  "assist": "C. Sandra",
  "is_home": true,
  "goal_type": "regular",   // regular | own_goal | penalty
  "away_score": 0,
  "home_score": 3,
  "sequence": [             // ← PASSAGE COMPLET avec coords x/y
    {
      "event": "pass",
      "pid": 3542,
      "player": "H. Vanaken",
      "pos": { "x": 72.1, "y": 83.6 },
      "end": { "x": 77.8, "y": 63.7 }
    },
    // ...
    {
      "event": "goal",
      "pid": 3545,
      "player": "N. Tresoldi",
      "body": "right-foot",
      "pos": { "x": 88.8, "y": 52.2 },
      "gk": { "x": 99.7, "y": 49.6 },    // position gardien
      "gm": { "x": 32.8, "y": 67.33 }    // mouvement gardien
    }
  ]
}
```

### 2.4 REST `get_match_shotmap` — champs clés

```json
{
  "shotmap": [
    {
      "min": 41,
      "home": true,
      "type": "goal",        // goal | save | miss | block
      "xg": 0.2885,
      "xgot": 0.7729,        // xG on target (after block)
      "gml": "low-left",     // position dans le but
      "sit": "assisted",     // assisted | regular | set-piece | fast-break | free-kick | corner
      "body": "right-foot",  // right-foot | left-foot | head
      "gtype": "regular",
      "player_id": 3545,
      "pos": { "x": 11.2, "y": 47.8, "z": 0 },
      "gm": { "x": 0, "y": 53.2, "z": 19.6 }
    }
  ],
  "momentum": [
    { "m": 1, "v": 4 },     // v: -100..100 (positif = domicile)
    { "m": 21, "v": -10 },
    // ... par minute
    { "m": 45.5, "v": -22 } // ← added time
  ],
  "xg_per_minute": [
    { "m": 6, "xg_home": 0.038, "xg_away": 0.0, "cum_home": 0.038, "cum_away": 0.0 },
    // ...
    { "m": 45, "xg_home": 0.0, "xg_away": 0.016, "cum_home": 1.52, "cum_away": 1.07 }
  ],
  "stats": {
    "first_half": {         // ← stats par mi-temps
      "home": { ... },
      "away": { ... }
    }
  }
}
```

### 2.5 REST `get_match_lineups`

```json
{
  "lineup_status": "confirmed",
  "lineups": {
    "home": {
      "formation": "3-4-3",
      "players": [
        { "id": 4438, "name": "A. Meret", "position": "G", "jersey_number": 1 }
      ],
      "substitutes": [ ... ]
    }
  },
  "unavailable_players": {
    "home": [
      { "name": "R. Lukaku", "status": "injured", "reason": "Muscle Injury" }
    ]
  }
}
```

---

## 3. TABLEAU DE MAPPING BSD → PariScore

### 3.1 WS `event` frame — champs manquants à ajouter

| BSD Field (stats.home/away) | PariScore Field | Type | Priorité |
|----------------------------|-----------------|------|---------|
| `goalkeeper_saves` | `live_saves` | `{home,away}` | 🔴 HIGH |
| `interceptions` | `live_interceptions` | `{home,away}` | 🔴 HIGH |
| `recoveries` | `live_recoveries` | `{home,away}` | 🔴 HIGH |
| `aerial_duels.{value,total,pct}` | `live_aerial_duels` | object | 🟠 MED |
| `ground_duels.{value,total,pct}` | `live_ground_duels` | object | 🟠 MED |
| `crosses.{value,total,pct}` | `live_crosses` | object | 🟠 MED |
| `long_balls.{value,total,pct}` | `live_long_balls` | object | 🟠 MED |
| `dribbles.{value,total,pct}` | `live_dribbles` | object | 🟠 MED |
| `tackles` | `live_tackles` | `{home,away}` | 🟠 MED |
| `hit_woodwork` | `live_woodwork` | `{home,away}` | 🟠 MED |
| `shots_outside_box` | `live_shots_outside_box` | `{home,away}` | 🟡 LOW |
| `big_chances_scored` | `live_big_chances_scored` | `{home,away}` | 🟡 LOW |
| `throw_ins` | `live_throw_ins` | `{home,away}` | 🟡 LOW |
| `clearances` | `live_clearances` | `{home,away}` | 🟡 LOW |
| `goal_kicks` | `live_goal_kicks` | `{home,away}` | 🟡 LOW |
| `free_kicks` | `live_free_kicks` | `{home,away}` | 🟡 LOW |
| `dispossessed` | `live_dispossessed` | `{home,away}` | 🟡 LOW |
| `final_third_entries` | `live_final_third_entries` | `{home,away}` | 🟡 LOW |
| `final_third_phase.pct` | `live_final_third_pct` | `{home,away}` | 🟡 LOW |
| `goals_prevented` | `live_goals_prevented` | `{home,away}` | 🟡 LOW |
| `time.added_time` | `live_added_time` | `number` | 🔴 HIGH |

### 3.2 REST polling — nouveaux flux à brancher

| BSD Endpoint | Fréquence | PariScore Field | Priorité |
|-------------|-----------|-----------------|---------|
| `get_match_incidents` | 30s poll / goal trigger | `live_incidents[]` | 🔴 HIGH |
| `get_match_shotmap.momentum` | 60s poll | `live_momentum` (array `[{m,v}]`) | 🔴 HIGH |
| `get_match_shotmap.xg_per_minute` | 60s poll | `live_xg_per_minute[]` | 🔴 HIGH |
| `get_match_shotmap.shotmap` | goal trigger | `live_shotmap[]` | 🟠 MED |
| `get_match_detail.home_score_ht` | once at HT | `live_score_ht` | 🟠 MED |
| `get_match_lineups` | once pre-kick | `live_lineups` | 🟠 MED |
| `get_match_detail.weather` | once at boot | `weather` | 🟡 LOW |
| `get_match_detail.is_local_derby` | once at boot | `is_local_derby` | 🟡 LOW |

### 3.3 Champs statiques — JAMAIS écrasés par WS

Ces champs sont **protégés** par le Deep Merge Guard :

```
elo, elo_surface, surf_rank, surf_rank_total, surf_form
rank, l5_pts, l10_pts, powerscore, ps_rank, ps_total
poisson, fair, edge, best_edge
blended, calibrated, reliability, bootstrap_uqd
expectedGoals (source=poisson — override seulement si source=bsd_real)
home_form, away_form, home_rank, away_rank
player1, player2 (tennis enrichment complet)
predictions (ML tennis)
bsd_coaches, bsd_unavailable
```

---

## 4. ARCHITECTURE DEEP MERGE

```
BSD WS frame (event/odds/livedata)
         │
         ▼
  _bsdWsHandleJSON()
         │
         ├── type=event ──► _bsdWsDTOEvent(msg, m)
         │                      ├── _wsGuardedPatch(m, field, val)  ← whitelist check
         │                      └── _bsdWsApplyEventStatsV2(m, msg.stats)
         │
         ├── type=odds ───► _bsdWsDTOOdds(msg, m)
         │
         └── legacy ──────► _bsdWsParse() + _bsdWsApplyLegacy()

BSD REST poll (30s incidents, 60s shotmap)
         │
         ▼
  pollBSDLiveEnrichment()
         │
         ├── get_match_incidents ──► _bsdMergeIncidents(m, incidents)
         │                              └── dedup by minute+type+player_id
         │
         └── get_match_shotmap ───► _bsdMergeShotmap(m, shotmap)
                                        ├── m.live_momentum = shotmap.momentum
                                        ├── m.live_xg_per_minute = shotmap.xg_per_minute
                                        └── m.live_shotmap = shotmap.shotmap (capped 50 shots)
```

---

## 5. PRINCIPES DE SÉCURITÉ DU MERGE

1. **Whitelist stricte** — `_WS_STATIC_FIELDS` Set. `_wsGuardedPatch()` retourne sans écrire si champ protégé.
2. **Incidents déduplication** — clé composite `minute|type|player_id`. Jam updates ne créent pas de doublons.
3. **Momentum** = shotmap array `[{m,v}]` — remplace `live_momentum` (Array.isArray guard préservé en frontend). Distinct de `live_momentum_pct` (WS objet — déjà séparé bd `8c5`).
4. **No full-replace** — WS ne remplace jamais `m` complet. Chaque champ patché individuellement via `_wsGuardedPatch`.
5. **Null safety** — champs null/undefined ignorés (pas de pollution).
6. **REST poll backoff** — incidents/shotmap uniquement si `live_websocket: true && m.is_live`. Arrêt auto si match terminé.

---

*Rapport généré le 2026-05-24 — Audit payloads BSD live réels (Napoli 1454, Brugge 9173)*
