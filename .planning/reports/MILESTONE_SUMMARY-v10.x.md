# MILESTONE SUMMARY — PariScore v10.x

> **Period** : 2026-05-14 → 2026-05-19 (6 days, sprint intensif)
> **Versions** : v10.2 → v10.78 (~78 micro-releases — extracted from cumul v9.8.x → v10.x rapid iteration)
> **Theme** : Multi-source routing + API-Football kill-switch + Design uniformization + Tennis enrichment
> **Source artifacts** : `CHANGELOG.md` (lines 1042-272), `bd` closed cluster v10
> **Generated** : 2026-05-24

---

## 1. OVERVIEW

### Mission

Largest milestone of project: 78 versions in 6 days. Three concurrent epics:
1. **Multi-source routing consolidation** (BSD primary, ESPN backup, Sackmann internal, felipeall sidecar Transfermarkt)
2. **API-Football retirement** (`AF_REMOVED=true` kill-switch v10.77) — eliminates $19/mo cost + dependency
3. **Design uniformization desktop** (v10.61-65 dark trading "data terminal" coherent vs fragmented panels)

Plus tennis enrichment (Bets Prédictifs colonne v10.71 + cotes 2-layer v10.72) and infrastructure fixes (tennis poll bug v10.78, dropdown contrast v10.65).

### Strategic context

Project entered v10.x with API-Football PRO $19/mo as primary stats source. By end of v10.x, **AF fully retired** : BSD covers fixtures+odds+live, ESPN covers tennis backup, felipeall sidecar covers Transfermarkt bio+transfers+injuries, internal `buildAdvancedStatsFromStandings` covers xG/PPG/streak. Net cost saved: **$19/mo**, plus zero quota worry.

DG mandated **visual coherence** post-v10.60 — UI fragmentation (light corporate filters above dark trading table = chocolat lumineux vertical, hierarchy inverted). v10.61-65 patched reactively, paved way for v11 CF overlay proactive system.

Tennis tab matured: serving UX (`?` fallback badge v10.72), Bets Prédictifs colonne (KPI BET FORT/VALUE/PASS + 3 picks per match v10.71), cotes 2-layer strategy (Couche 1 marché Odds API + Couche 3 équitable modèle `≈1/proba` v10.72 — DG-validated NO scraping pour 25 members).

### Outcome

- **AF retired** : -$19/mo, +autonomy. Reversible via `AF_REMOVED=false`.
- **Tennis tab production-grade** : predictive bets + cotes 2-layer + serving UX
- **Desktop visual coherent** : dark trading nappe uniforme (filters + bandeau + nav + table)
- **Multi-source resilience** : zero-dep felipeall sidecar Docker + httpsGet native → zero npm core impact

---

## 2. ARCHITECTURE

### Multi-source routing 4-layer (v10 stabilized)

```
fetchOdds(match_id)
  ↓
L1 BSD primary (fetchBSDMatches)            ← $5/mo, WS push live, 17/28 endpoints REST
  ↓ fallback
L2 ESPN public (fetchESPNFixtures)          ← free, secondary coverage tennis + foot
  ↓ fallback
L3 Odds API (fetchOddsAPIv4)                ← free 500 req/mo, h2h markets EU
  ↓ fallback
L4 Sackmann CSV ETL (tennis only — pre-bd dl49 purge plan)
```

### API-Football kill-switch architecture (v10.77)

```javascript
// server.js:69-71
const AF_REMOVED = true;
const API_FOOTBALL_KEY = AF_REMOVED ? '' : (process.env.API_FOOTBALL_KEY || '');
// → ~23 call sites have `if(!API_FOOTBALL_KEY) return null` guards
// → all fallbacks (BSD/ESPN/felipeall/internal calc) take relay automatically
```

**Replacement matrix** (9/9 AF orphan fields handled):

| AF feature | Replacement |
|---|---|
| Fixtures + standings | BSD primary (v10.x cumul) |
| Live scores | BSD WS + ESPN backup |
| xG/cartons/tirs avancés | `buildAdvancedStatsFromStandings()` v10.76 from BSD `_raw` + `form` |
| Predictions | BSD prediction route fallback v10.75 + `normalizeBsdPrediction` |
| Transfers | felipeall sidecar Docker self-host v10.73 (replaces Apify $15/mo) |
| Player bio + injuries | Transfermarkt via felipeall v10.74 (100% coverage pro players) |
| Team logos | CDN clé-zéro `media.api-sports.io` (NOT concerned by kill-switch) |
| Tirs cadrés / cartons J/R / penalties | `null` honnête (no free source) |
| Formation / clean sheets | `null` honnête |

### Tennis enrichment (v10.71-v10.72)

- **computeTennisPredictiveBets** : 6-market pool (Vainqueur match, Set 1, Score sets exact, Gagne ≥1 set Markov, Total jeux O/U, King of Aces) scored by:
  - `PredScore = 0.45·norm(EV%) + 0.35·Confiance + 0.20·Accord(Elo,BSD)` (cote dispo)
  - `PredScore = 0.55·proba + 0.45·Confiance` (sans cote)
  - Confiance = `confidence_badge.accuracy`, pénalité ×0.8 si `ml_market_div=HIGH`
- **Verdict KPI** : BET FORT (EV>5% AND IC lower>0 AND badge vert) · VALUE (EV>0 OR proba≥65) · PASS
- **Cotes 2-layer** : `odds_fair` = round(100/p, 2) si pas de cote marché, `odds_type` = 'market'|'fair'
- **Live re-pricing** : winner re-pricé ±15/set, set en cours selon serveur, comeback ≥1 set ou total jeux

### Design uniformization Axe C (v10.63)

CSS `@media (min-width:769px)` anchor 2 ids `#page-matchs #filter-console` (bat `body:not(.dark-theme)` overrides) :
- Console filtres `#0f172a` + bordure laser rouge L'Équipe
- League hub banner `#1b2027`
- Bandeau résultats `.table-header` `#0f172a` + sous-ligne rouge
- Nav top `#0f172a` (sandwich fermé)
- Étanchéité mobile (`.mc < 769px` inchangé)

---

## 3. PHASES (chronological)

### Phase 1 — v10.2 → v10.20 (2026-05-14 → 2026-05-17, ~18 versions)

- SQLite consolidation (post-v9.x JSON → SQLite migration)
- Multi-providers fetchOdds layered (BSD + ESPN + Odds API + fallbacks)
- Smart Polling 60s live + SSE realtime
- Initial UI iteration onglet Foot

### Phase 2 — v10.21 → v10.46 (2026-05-17, ~26 versions same day = intensive)

- Tennis tab consolidation (BSD circuit re-derive, surface inference, Elo dynamic)
- Backtesting Phase 2 (over25/btts/edge accuracy live)
- AI Scout cache 6h
- Live momentum SVG (broadcasts SSE)
- Filter advanced (probability slider, odds range, time-to-kickoff)
- Bet tracking page (Mes Paris v9.8 carried into v10.x)

### Phase 3 — v10.47 → v10.60 (2026-05-17 → 2026-05-18)

- Theme light/blue oddsalert variant (bd `z55o`)
- BSD MCP enrichissements (compare_odds, CatBoost ML v5, Polymarket, Managers — bd `c81b`)
- elofootball Elo historique scrape (bd `8lvf` Phase 1-3)
- ETL Historique scaffold (bd `9je`)

### Phase 4 — v10.61 → v10.65 (2026-05-18, design uniformization reactive)

- v10.61 — Hero Value Cell + IC Corridor (bd `3ug`, `l22`)
- v10.62 — Option B "Ligne 100% Dark Premium" (anchor 2-ids override)
- v10.63 — **Axe C Élite Dark Trading** — nappe sombre continue (nav + filters + table)
- v10.64 — Hotfix nav top kept light (logo PARISCORE readability)
- v10.65 — Dropdown stratégies fix contrast (`.mls-row` rules added)

### Phase 5 — v10.71 → v10.72 (2026-05-19, tennis maturation)

- v10.71 — Bets Prédictifs colonne (KPI + 3 picks prematch → live auto-bascule)
- v10.72 — Cotes 2-layer (Couche 1 marché + Couche 3 équitable `≈1/proba`)

### Phase 6 — v10.73 → v10.77 (2026-05-19, AF retirement cascade)

- v10.73 — felipeall sidecar Docker self-host (Transfermarkt API MIT) → Apify $15/mo retired
- v10.74 — Bio joueur + blessure 100% via Transfermarkt felipeall
- v10.75 — Prédictions BSD fallback (`/api/v1/af/predictions/:id` route maintained, source switched)
- v10.76 — Stats avancées équipe : `buildAdvancedStatsFromStandings(ts)` zero-réseau from BSD `_raw`
- **v10.77 — 🔴 BREAKING (maîtrisé) : API-Football RETIRED** (`AF_REMOVED = true`, zero AF calls)

### Phase 7 — v10.78 (2026-05-19, hotfix)

- Tennis poll bug `fetchBSDTennisPredictions is not defined` (5o0) — pont `globalThis.__tnWarmers` posé après `buildBSDTennisRankIndex` + `typeof` guard

---

## 4. DECISIONS (architectural lock-ins)

1. **API-Football kill-switch (NOT brute removal)** v10.77 — `const AF_REMOVED = true` toggle reversible vs deleting ~23 call sites (massive diff + regression risk). Code mort cleanup deferred to bd `3u9` Scenario C decision.
2. **BSD primary, not just one of N sources** — BSD coverage 80% post mapping bd `t8r` cup domestic + World Cup 2026 (bd `0hf4` continues this in v12.65)
3. **felipeall sidecar Docker over Apify** v10.73 — MIT license + self-host control + $0/mo vs $15/mo + dependency on external actor
4. **Tennis cotes 2-layer (NO scraping)** v10.72 — DG-validated for 25 members: OddsPortal/Flashscore = Cloudflare wall + maintenance debt + violates "Odds API only" rule. Couche 3 équitable `≈1/proba` covers 100% gaps.
5. **PredScore formula weights 0.45/0.35/0.20** v10.71 — when cote dispo (EV-dominant + Confidence + Elo·BSD agreement). Without cote: 0.55/0.45 (proba + confidence).
6. **Verdict BET FORT strict rule** v10.71 — EV>5% AND IC lower bound>0 AND badge vert (NOT OR conditions). Aligns CLAUDE.md règle 1 PROTOCOLE.
7. **Design Axe C dark trading nappe** v10.63 — chose continuous dark over fragmented light/dark mix. 3 voix expertes concordantes consulted.
8. **Inline overlay `<style>` (NOT separate CSS file)** v10.61-65 + v11 CF — HTTP/1.1 single roundtrip preserved, no build step.
9. **`null` honnête over invented values** v10.76 — tirs/cartons/penalties/formation/clean-sheets → UI "N/A" via `?? 'N/A'`. CRITICAL principle: never fabricate stats.
10. **Mobile cards intact `<769px`** v10.63 — all uniformization scoped `@media ≥769px`. Mobile refactor deferred (V2 Mobile bd discussion 2026-05-24).

---

## 5. REQUIREMENTS (cumul implemented at v10.78)

| Requirement | Status v10.78 |
|---|---|
| Multi-source resilient routing | ✅ 4-layer BSD/ESPN/Odds/Sackmann |
| API-Football removal | ✅ kill-switch v10.77 (-$19/mo) |
| Tennis Bets Prédictifs colonne | ✅ v10.71 |
| Tennis cotes 2-layer | ✅ v10.72 (marché + équitable) |
| Tennis serving UX `?` fallback | ✅ v10.72 (carried into v11.4) |
| Transfermarkt bio + transfers + injuries | ✅ v10.73-v10.74 felipeall sidecar |
| BSD predictions fallback | ✅ v10.75 |
| Stats avancées zero-réseau | ✅ v10.76 `buildAdvancedStatsFromStandings` |
| Design desktop uniformization | ✅ v10.63 Axe C |
| Theme light/blue oddsalert | ✅ v10.x (bd `z55o`) |
| elofootball Elo historique | ✅ bd `8lvf` Phase 1-3 |
| BSD MCP enrichissements (compare_odds, CatBoost v5, Polymarket, Managers) | ✅ bd `c81b` |
| ETL Historique scaffold | ✅ v10.10 bd `9je` (run blocked quota until reset) |
| Bet tracking utilisateur | ✅ v9.8 carried + v10.x KPIs polish |

---

## 6. TECH DEBT

### Introduced v10.x

- **API-Football dead code** : ~23 call sites with `if(!API_FOOTBALL_KEY)` guards remain in `server.js` (~500-800 lines estimated cleanup) — bd `3u9` Scenario C pending DG
- **`/api/v1/af/transfers/:id` 503 gracieux** v10.77 — orphelin sunset, no fallback (felipeall covers `/transfers` route directly)
- **Code mort suppression _apifyRunSync, _tmBuildUrl, APIFY_TOKEN, APIFY_TM_ACTOR** v10.73 — done correctly, no ref morte
- **Design uniformization 2-ids override pattern** — fragile if class restructure (acceptable for now, documented bd notes)
- **Tennis dropdown `.mls-row` light theme** — patched reactively v10.65 vs proactive (paved way v11 CF overlay)
- **Tennis poll bug pre-existing** v10.78 — `fetchBSDTennisPredictions` referenced before scope binding (not caused by AF retirement, masked by AF being primary path)
- **Sackmann tennis_atp CC BY-NC-SA infraction** — DISCOVERED later v12.65 bd `8uoc`, but tennis_matches table was populated during v10.x ETL → retroactive compliance issue (bd `dl49` 6-month replacement plan)

### Carry-over from pre-v10.x

- Viewport desktop 1280px forced mobile
- Fuzzy team matching (`normName()` first-word fallback)
- Poisson moyenne ligue fixe 1.35
- No tests / no CI/CD
- Single-file SPA growing past 25k lines

---

## 7. GETTING STARTED (orient new contributor on v10 work)

### Key changes to grep

```bash
# Find AF kill-switch sites
grep -n "AF_REMOVED\|API_FOOTBALL_KEY" server.js

# Find AF fallback patterns
grep -n "if (!API_FOOTBALL_KEY)" server.js

# Find felipeall sidecar integration
grep -n "TRANSFERMARKT_API_URL\|fetchTransfermarkt" server.js

# Find BSD predictions fallback
grep -n "fetchBsdPredictionNormalized\|normalizeBsdPrediction" server.js

# Find advanced stats internal calc
grep -n "buildAdvancedStatsFromStandings" server.js

# Find tennis predictive bets
grep -n "computeTennisPredictiveBets\|tnLiveBets" server.js pariscore.html

# Find design Axe C uniformization
grep -n "#page-matchs #filter-console\|table-header" pariscore.html
```

### Setup felipeall sidecar (if running locally)

```bash
# v10.73 setup
docker compose -f docker-compose.transfermarkt.yml up -d
# Sidecar binds 127.0.0.1:8000, healthcheck enabled, rate-limit ON
# clone felipeall/transfermarkt-api → transfermarkt-api/ (git-ignored)

# Test sidecar
curl http://127.0.0.1:8000/players/search/messi
```

### Reactivate AF if needed (rollback)

```javascript
// server.js:69
const AF_REMOVED = false;  // reactivates API_FOOTBALL_KEY from .env
```

Plus add valid `API_FOOTBALL_KEY=<key>` to `.env` + restart server.

### Files most-touched v10.x

| File | Delta v10.x |
|---|---|
| `server.js` | +~5000 lines (multi-source routing + tennis predictive + advanced stats internal + felipeall) |
| `pariscore.html` | +~3000 lines (UI iteration, design uniformization, tennis colonnes) |
| `docker-compose.transfermarkt.yml` | NEW (v10.73) |
| `.env` | API_FOOTBALL_KEY soft-removed (v10.77 — kept for rollback) |
| `.gitignore` | + `transfermarkt-api/` (v10.73 sidecar clone) |

---

## APPENDIX — v10.x stats

| Metric | Value |
|---|---|
| Versions | ~78 (v10.2 → v10.78) |
| Days | 6 (2026-05-14 → 2026-05-19) |
| Lines added `server.js` | ~5000 |
| Lines added `pariscore.html` | ~3000 |
| Cost saved | -$19/mo (API-Football) + -$15/mo (Apify Transfermarkt) = **-$34/mo total** |
| New sources integrated | 2 (felipeall sidecar Docker, BSD predictions fallback) |
| AF orphan fields handled | 9/9 (fallback OR null honnête OR sunset) |
| bd epics closed | multiple (z55o, c81b, 8lvf Phase 1-3) |
| Design uniformization passes | 5 (v10.61, 62, 63, 64, 65) |
| Tennis enrichment features | 4 (Predictive colonne, cotes 2-layer, serving UX, predictions fallback) |
| Critical bugs fixed | 3 (country mapping `t8r`, tennis poll `5o0`, dropdown contrast) |

---

*Generated 2026-05-24. Adapted GSD milestone-summary template, PariScore artifacts (CHANGELOG / bd / `.context/`). NOTE: v10.x retroactive compliance issue discovered later (Sackmann CC-NC bd `8uoc` v12.65) — `tennis_matches` table populated this milestone in violation, replacement plan bd `dl49` 6-month accumulation in progress.*
