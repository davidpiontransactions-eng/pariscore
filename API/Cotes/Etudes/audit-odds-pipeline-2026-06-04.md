# Audit Pipeline Cotes (Odds) — PariScore
> Date : 2026-06-04 | Scope : server.js + pariscore.js | Trigger : `/ps-audit` + `/agent-browser`

---

## 1. SOURCES DE COTES ACTIVES

| Source | Clé .env | Sport | Fréquence | Endpoint |
|---|---|---|---|---|
| **The Odds API** | `ODDS_API_KEY` | foot + tennis | Cron 12h | `api.the-odds-api.com/v4/sports/*/odds` |
| **BSD `compare_odds`** | `bsd_config.json` | foot | Enrichissement 5min cache | `/odds/compare/?event=` |
| **BSD tennis odds** | `bsd_config.json` | tennis | On-demand lazy | `/tennis/api/v2/matches/{id}/odds/` |
| **BSD Polymarket** | `bsd_config.json` | foot | 5min cache | `/odds/polymarket/?event=` |
| **OddsPapi v4** | `ODDSPAPI_V4_KEY` | tennis (RG sets) | Cron 2h + on-demand | Set odds Pinnacle sharp |
| **odds-api1 RapidAPI** | `RAPIDAPI_KEY` | foot | Module importé | **INERTE** (404 confirmé spike `bjv`) |

### MCP Tools odds
| MCP | Outil | Câblé dans | État |
|---|---|---|---|
| `bsd-sports` / `bzzoiro-sports` | `compare_odds` | `fetchBSDCompareOdds()` `server.js:3490` | ✅ actif |
| `bsd-sports` / `bzzoiro-sports` | `get_best_odds` | cache TTL 5min | ✅ actif |
| `bsd-sports` / `bzzoiro-sports` | `get_polymarket_odds` | `fetchBSDPolymarket()` `server.js:3567` | ✅ actif |

---

## 2. ROUTES API ODDS EXPOSÉES

| Route | Ligne | Source données | État |
|---|---|---|---|
| `GET /api/v1/comparateur/feed` | 37385 | `db.matches` local (grid OddsPortal style) | ✅ actif |
| `GET /api/v1/comparateur/:matchId` | 37460 | `match.all_bookmakers` full grid | ✅ actif |
| `GET /api/v1/odds/:id` | 37628 | API-Football markets 1N2 + OU2.5 | ✅ actif |
| `GET /api/v1/odds-history/:matchId` | 37385 | KV snapshots closing line | ✅ actif |
| `GET /api/v1/tennis/match/:matchId/odds` | 33527 | BSD tennis multi-books | ✅ actif |
| `GET /api/v1/tennis/set-odds` | 33485 | OddsPapi v4 Pinnacle sharp | ✅ actif (nécessite `ODDSPAPI_V4_KEY`) |
| `GET /api/v1/aiscore/odds` | 35710 | Aiscore throttled fallback | ✅ actif |
| `GET /api/v1/tennis/tex/odds-history` | 35749 | Tennis Explorer DB historique | ✅ actif |

---

## 3. PIPELINE FOOTBALL — FLUX COMPLET

```
The Odds API (12h cron)
    │
    ▼
fetchOdds() server.js:15567
    │ → buildMatchRecord() :8778 → computeEdge() :8484
    │     ├─ Shin-Hurley devig (primary)
    │     ├─ best_edge = { label, odds, edge, bk, prob }
    │     └─ ic90 = Bootstrap UQD 90% IC [n_eff = (home_played + away_played)/2]
    │
    ├─ BSD enrichMatchWithBSDFullStack() :3720
    │     ├─ fetchBSDCompareOdds() → extractBSDOddsSummary()
    │     │     └─ bsd_odds_summary = { books_count, best, consensus, movement }
    │     │     └─ Patch match.odds si Odds API absent (_source='bsd_compare')
    │     ├─ fetchBSDPolymarket() → computePolymarketDivergence()
    │     │     └─ market_divergence = { sharp_signal, divergence_pct }
    │     └─ reliability_score += depth_bonus (books ≥10 → +8pts, ≥6 → +4pts)
    │
    └─ Cron refresh (12h) → recompute computeEdge()
          └─ best_edge updated (ic90 preserved ✅ — fix 2026-06-04)
```

### Données exposées côté match (football)

| Champ | Type | Source |
|---|---|---|
| `match.odds` | `{ home, draw, away }` | The Odds API → BSD fallback |
| `match.bookmakers` | `{ home, draw, away }` (noms bk) | The Odds API |
| `match.all_bookmakers` | Array `[{key, title, home, draw, away, payout, isANJ}]` | `processAllBookmakers()` |
| `match.best_edge` | `{ label, odds, edge, bk, prob, ic90 }` | `computeEdge()` + Bootstrap UQD |
| `match.bsd_odds_summary` | `{ books_count, best, consensus, movement, over25, btts }` | BSD `compare_odds` |
| `match.market_divergence` | `{ sharp_signal, pm_home, fair_home, divergence_pct }` | BSD Polymarket |
| `match.odds_delta` | `{ home, draw, away, ts }` | `_snapshotClosingOdds()` 60s cron |

---

## 4. PIPELINE TENNIS — FLUX COMPLET

```
BSD WebSocket live list (/tennis/api/v2/matches/live/)
    │
    ▼
_normalizeBSDTennisMatch() server.js:20218
    ├─ odds_player1 / odds_player2 (décimal direct du flux liste)
    └─ sets[] (scores par set, p1_aces init null)
         │
         ▼
_mergeDetailStats() server.js:20314
    ├─ Source: /tennis/api/v2/matches/{id}/ (3s timeout)
    ├─ aces_per_set: [[p1,p2], ...] → set.p1_aces / set.p2_aces
    ├─ double_faults_per_set: [[p1,p2], ...] → set.p1_df / set.p2_df
    └─ Fallback: sets_detail[i].p1_aces si schema BSD change
         │
         ▼
_fetchBSDTennisOdds() server.js:20381
    │ → _extractTennisOddsSummary() :20394
    │     └─ _bsd_odds = { best_p1, best_p1_bk, best_p2, best_p2_bk,
    │                       fair_p1%, fair_p2%, movement_p1, movement_p2, books_count }
    │
    ▼ OddsPapi v4 (Roland Garros spécifique)
fetchOddspapiTennisSetOdds() server.js:2995
    └─ Set odds Over7.5 / Over8.5 / Under12.5 (Pinnacle sharp, 30min cache)
         └─ pollOddspapiTennisSetOddsAlerts() cron 2h → alertes Telegram RG
```

### Données exposées côté match (tennis)

| Champ | Type | Source |
|---|---|---|
| `match.odds_player1 / odds_player2` | float | BSD live list |
| `match._bsd_odds` | `{ best_p1, best_p1_bk, fair_p1%, movement_p1, books_count }` | BSD `/odds/` |
| `match._bsd_stats` | `{ p1_aces, p2_aces, p1_df, p2_df, p1_first_pct, ... }` | BSD live list |
| `match.sets[i].p1_aces / p2_aces` | int\|null | `_mergeDetailStats` via `aces_per_set[]` |
| `match.bsd_odds_summary` | enrichi dans ValueBets builder | BSD compare |

---

## 5. FONCTIONS DEVIGGING

| Fonction | Ligne | Méthode | Utilisation |
|---|---|---|---|
| `devigShinHurley(odds)` | 7551 | Shin-Hurley asymétrique (favoris absorbent marge) | **primaire** — `computeEdge` |
| `devigAdditive(odds)` | 7539 | Additive simple | secondaire |
| `devigPower(odds)` | 7585 | Power law | alternatif |
| `devig1X2(h, d, a, method)` | 7603 | Wrapper 3-way football | `computeEdge` football |
| `devig2way(p1, p2, method)` | 7628 | Wrapper binary tennis/h2h | `computeEdge` tennis |
| `devigTwoWay(a, b)` | 10355 | Binary alt backward-compat | legacy consumers |

---

## 6. AFFICHAGE FRONTEND

### Football — colonne 📉 COTES
```
pariscore.js:11535 → renderOddsDeltaCell(m) + renderSharpMoneySignal(m)

renderOddsDeltaCell(m):
  ├─ Priorité BSD movement natif (bsd_odds_summary.movement)
  │     ├─ SHORTENING → pill rouge "1 ▼ 2.35" (sharp money)
  │     └─ DRIFTING   → pill amber "1 ▲ 2.50"
  └─ Fallback: odds_delta historique (snapshot 60s)
        └─ variation Δ par leg (home/draw/away)

renderSharpMoneySignal(m):
  └─ market_divergence.sharp_signal > 5% → pill "⚡ 1 +X%"
```

### Tennis — drawer desktop + mobile sheet
```
pariscore.js:1389 → _tnRenderBSDOddsSection() (desktop drawer lazy)
pariscore.js:2500 → _tvbMarketCell() (mobile sheet odds pair)
  └─ fetch → /api/v1/tennis/match/{bsdId}/odds
  └─ affiche best_p1 / best_p2 + bookmaker + movement arrows
```

---

## 7. CRONS ODDS

| Cron | Ligne | Intervalle | Action |
|---|---|---|---|
| `fetchOdds()` | 42238 | 12h | Refresh The Odds API + rebuild match records |
| `_snapshotClosingOdds()` | 42251 | 60s | Snapshot delta cotes pour steam detection |
| `pollOddspapiTennisSetOddsAlerts()` | 43006 | 2h | Alertes RG Over7.5/8.5/U12.5 Pinnacle |
| Bootstrap OddsPapi | 43007 | 90s (one-shot) | Premier fetch RG au boot |

---

## 8. BUG TROUVÉ ET CORRIGÉ ✅

### 🔴 `best_edge.ic90` effacé à chaque cron refresh — `server.js:16504`

**Localisation** : `server.js:16499-16506` (dans enrichissement fetchOdds cron)

**Symptôme** : `best_edge` calculé avec Bootstrap UQD dans `buildMatchRecord()` (:9121) incluait `ic90: { low, high, n_eff }`. Puis, à chaque refresh cron 12h ou re-enrichissement BSD, l'appel `computeEdge()` à la ligne 16500 recalculait `edge.best` (sans ic90) et l'assignait directement : `match.best_edge = edge.best` → **ic90 wipé**.

**Impact** : `best_edge.ic90` = undefined après premier cron refresh → frontend `computeBetSignal` (qui utilise `ic90.low` pour EV pessimiste) retombait sur estimation ponctuelle sans borne inférieure → signal BET potentiellement surestimé.

**Avant** :
```js
match.best_edge = edge.best;
```

**Après (fix 2026-06-04)** :
```js
// Preserve ic90 from buildMatchRecord — do NOT wipe UQD on cron refresh
match.best_edge = match.best_edge && match.best_edge.ic90
  ? Object.assign({}, edge.best, { ic90: match.best_edge.ic90 })
  : edge.best;
```

**Commit** : à pousser cette session.

---

## 9. DRIFT CLAUDE.md DÉTECTÉ

**`.claude/CLAUDE.md` section 9, "Action restante"** :
> "patcher `_normalizeBSDTennisMatch()` + `_mergeDetailStats()` server.js avec `aces_per_set` / `double_faults_per_set` schéma réel"

**Réalité code** : DÉJÀ PATCHÉ. `_mergeDetailStats` (server.js:20327-20359) gère correctement :
- `aces_per_set[]` (format `[[p1,p2], ...]` ou `[{p1,p2}, ...]`)
- `double_faults_per_set[]`
- Fallback `sets_detail[i].p1_aces` si BSD change schema

→ **Mettre à jour `.claude/CLAUDE.md` section 9 : supprimer cette "Action restante".**

---

## 10. ÉTAT GLOBAL

| Composant | État | Note |
|---|---|---|
| The Odds API fetch + devig | ✅ OK | Shin-Hurley primaire, mutex guarded |
| BSD compare_odds football | ✅ OK | 14 books, 7 marchés, movement SHORTENING/DRIFTING |
| BSD tennis odds | ✅ OK | Multi-books, Shin-Hurley fair probs |
| OddsPapi v4 tennis sets | ✅ OK | Roland Garros uniquement, circuit-breaker 429 |
| odds-api1 RapidAPI | ⚠️ INERTE | Module importé, 404 confirmé — dead code (spike `bjv`) |
| `best_edge.ic90` preservation | ✅ **FIXÉ** | Bug corrigé 2026-06-04 server.js:16504 |
| `_mergeDetailStats` aces_per_set | ✅ OK | CLAUDE.md drift — déjà patché |
| `isFetchingOdds` mutex | ✅ OK | `finally` garanti |
| `renderOddsDeltaCell` | ✅ OK | BSD priority + safeFixed null-guard |
| `computeWFV1N2` syntaxe | ✅ OK | `1 / r.home` correct (artefact affichage grep) |
| `extractBSDOddsSummary` | ✅ OK | null-guard sur `!m1x2.HOME\|AWAY` |

---

## 11. RECOMMANDATIONS

| # | Action | Priorité |
|---|---|---|
| 1 | **Déployer le fix ic90** sur VPS (`git push` + `pm2 restart pariscore`) | 🔴 HIGH |
| 2 | **Supprimer `odds-api1` module** si RAPIDAPI_KEY définitivement absent (dead code) | 🟡 MED |
| 3 | **Mettre à jour `.claude/CLAUDE.md` section 9** — supprimer "Action restante" aces_per_set (déjà fixé) | 🟢 LOW |
| 4 | **OddsPapi.io POC** (bd `bjv`) — Pinnacle sharp line football → upgrade calibration `detectSurebet1N2` | 🟢 LOW |

---

*Rapport généré 2026-06-04 — audit server.js:3490-37628 + pariscore.js:9636-11535.*
*Bug fixé : `server.js:16504` — `best_edge.ic90` preservation sur cron refresh.*
