# Test Report — Historique Tennis
**Date** : 2026-05-29  
**Auditeur** : QA (ps-test)  
**Fichiers** : `server.js`, `pariscore.js`, `pariscore.html`

---

## Résumé

| Métrique | Valeur |
|---|---|
| Matchs dans tennisHistory | 14,207 |
| Matchs enrichis (verified+realResult) | 7,567 |
| Matchs avec prédictions BSD | 6,000 |
| Total picks (ML + Set1 + ...) | 1,208 |
| Winrate ML | ~50% |
| Bugs critiques trouvés | 4 |
| Bugs résolus | 9 |
| Améliorations UX déployées | 5 |

---

## ✅ Tests passés

- [x] API `/api/v1/history/query?sport=tennis` retourne 14,207 matchs et 1,208 picks
- [x] Persistance tennisHistory via `kvSet('tennis_history_matches')`
- [x] Enrichment rétroactif `verified` + `realResult` + `p1`/`p2` au boot
- [x] Bridge `bsd_prediction → predicted` pour `_tennisPicksOf`
- [x] Filtre marché tennis (ml, set1, geq1_set, total_games, aces, tie_break)
- [x] Filtre surface tennis fonctionnel
- [x] Table tennis : colonnes Match, Tournoi, Surface, Date, Sets, ML, Set 1, Issue
- [x] KPIs tennis : 6 cartes (Yield, Winrate, Drawdown, Losing Streak, ML WR, Strike)
- [x] Backtest sport-aware (dispatch _tennisPicksOf)
- [x] Vue Executive agrège correctement les 6 marchés tennis
- [x] Charts PL/drawdown/rolling30 identiques tennis↔foot
- [x] Calibration chart silencieux pour tennis (safe)

---

## ❌ Bugs détectés et résolus

### BUG-1 — fromDate vide tout l'historique tennis
**Sévérité** : CRITIQUE  
**Localisation** : `pariscore.js:dhState.period='90'` → `fromDate=2026-02-28`  
**Impact** : Les seeds tennis (2024-2025) filtrées → 0 matchs affichés  
**Fix** : Reset `period='all'` quand on switch en tennis ; `fromDate=null`

### BUG-2 — minProba/minEV filtrent avec over25/btts (football)
**Sévérité** : CRITIQUE  
**Localisation** : `server.js:10821-10829`  
**Impact** : `minProba=55` → vérifie `h.predicted.over25` et `h.predicted.btts` → toujours vide pour tennis → 100% filtré  
**Fix** : Skip `minProba`/`minEV`/`confidence` pour `sport === 'tennis'`

### BUG-3 — crash computeTennisSeries sur commence_time null
**Sévérité** : CRITIQUE  
**Localisation** : `server.js:10127` — `h.commence_time.split('T')[0]`  
**Impact** : `TypeError: Cannot read properties of null (reading 'split')` → crash endpoint  
**Fix** : Guard `h.commence_time ? h.commence_time.split('T')[0] : 'unknown'`

### BUG-4 — Outcome filter utilise _historyPicksOf (football) pour tennis
**Sévérité** : HAUT  
**Localisation** : `server.js:10830-10838`  
**Impact** : Filtre "Gagnant"/"Perdant" → `_historyPicksOf` vérifie `realScore` → [] pour tennis → 0 résultats  
**Fix** : Dispatch `sport === 'tennis' ? _tennisPicksOf(h) : _historyPicksOf(h)`

### BUG-5 — View switch 'table' n'appelle pas dhRefresh()
**Sévérité** : HAUT  
**Localisation** : `pariscore.js:19559`  
**Impact** : `dh-tbody` jamais rempli quand on clique "Tableau"  
**Fix** : Ajout `'table'` dans la liste des vues qui déclenchent `dhRefresh()`

### BUG-6 — Reset non sport-aware
**Sévérité** : HAUT  
**Localisation** : `pariscore.js:19528`  
**Impact** : Reset en mode tennis → marchés `over25,btts,edge` + période `90j` → tout vidé  
**Fix** : `DH_MARKETS_BY_SPORT[dhState.sport]` + période `all` pour tennis

### BUG-7 — Filtres foot visibles en mode tennis
**Sévérité** : MOYEN  
**Localisation** : `pariscore.js:19293-19311`  
**Impact** : Stratégie IA, Confiance, EV, Proba, Cotes, Venue visibles mais inopérants pour tennis  
**Fix** : `display:none` sur les sections foot-only quand tennis actif

### BUG-8 — Tooltip KPI tennis affiche marchés foot
**Sévérité** : MOYEN  
**Localisation** : `pariscore.js:18819`  
**Impact** : Tooltip "Over 2.5 (0) · BTTS (0) · Edge (0)" en mode tennis  
**Fix** : "ML (X) · Set 1 (Y) · ≥1 Set (Z) · Tot. jeux · Aces · TB"

### BUG-9 — Empty states Variance/Attribution orientés foot
**Sévérité** : BAS  
**Localisation** : `pariscore.js:18176,18261`  
**Impact** : Messages trompeurs ("Élargis la période") alors que feature pas implémentée  
**Fix** : Messages tennis-spécifiques

---

## 💡 Recommandations (non implémentées)

1. **Calibration tennis** — Créer `computeTennisCalibration` avec proba implicite (1/odds)
2. **Bad Beats tennis** — Proxy unluck via set-level "was up and lost"
3. **Profit Attribution tennis** — P/L par marché × tournoi
4. **Kelly tennis** — Dériver pseudo-probabilité depuis 1/odds
5. **Table colonnes étendues** — Afficher ≥1 Set, Total Jeux, Aces, Tie-break
6. **Heatmap tennis** — Marchés × tournois WR matrix
7. **Per-surface KPIs** — WR par surface (Hard/Clay/Grass/Indoor)
8. **Détection upset** — Moneyline underdog wins counter

---

## Timeline des commits

| Commit | Description |
|---|---|
| `9337d4b` | Persistance tennisHistory + filtre marché + guard-fou KPIs |
| `b98e195` | Enrichment archive cron (verified+realResult+predicted) |
| `c35e0d9` | Bridge bsd_prediction→predicted dans _tennisPicksOf |
| `dbfe650` | 3 bugs critiques : view table dhRefresh + outcome filter + bsd bridge |
| `da6d1bc` | Skip minProba/minEV/confidence pour tennis |
| `816598d` | Audit complet : null safety + reset sport-aware + hide foot filters + tooltip |
