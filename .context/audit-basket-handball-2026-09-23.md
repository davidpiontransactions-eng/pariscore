# 🔎 Audit Complet — Onglets Basket & Handball

**Date** : 2026-09-23 · **Méthode** : 4 agents parallèles (explore ×2, code-reviewer, research) · **Style** : caveman
**Scope** : structures, fraîcheur données, bugs, améliorations/innovations, littérature scientifique basket (+ handball xG)

---

## ⚡ VERDICT EN 10 LIGNES

- **Basket** : structure solide (lazy-load, caches, services legacy partagés), MAIS 6 bugs critiques user-visible — onglet live cassé, Value Bet mort, dialog crash EuroLeague, Kelly ×100 affiché.
- **Handball** : squelette complet (scrapers → JSON → 4 routes → 12 composants), MAIS couche intelligence **creuse** — `id: 0` effondre tout le form-store, EV fabriquées, "live" = snapshot J-1, aucune odeur de cron dans le repo.
- **Données** : Elo NBA/WNBA ~5,5 semaines stale (mtime 15/08/2026, zéro automation), cache H2H NBA vide (0 fichier), `flashscore_handball.json` a 2+ jours et gagne toujours sur le fallback.
- **Tests** : handball 24/24 passent (mais mocks sains → ratent le bug prod #1). Basket : **0 test** sur toute la math exportée (de-vig, Kelly, H2H splits).
- **Littérature** : Four Factors validées (eFG premier), blend fixe non calibrée vs pratiques state-of-art (MOVDA, walk-forward), zéro CLV, zéro live-WP basket — innovation landscape clair.
- **Quick wins** : 6 fixes ≈ 1h30 total réparent la plupart des bugs critiques basket (table §4.0).

---

# 1. STRUCTURES

## 1.1 Basket — carte complète

```
ESPN (scoreboard/standings/injuries/FIBA)
 ├► basketballService.js / wnbaService.js (mem 90s / 6h / 15min)
 │    └► /api/nba|wnba/matches (cache module 5min) ─► useBasketballMatches (SWR 60s)
 ├► /api/fiba/* (rate-limit + fibaCache 30s-30min) ─► useFibaScoreboard (SWR 30s)
 ├► basketballH2HService.js (disk cache 6h/7j/30j/12h)
 │    └► /api/v1/basketball/h2h{,/teams,/players} ─► useBasketballH2H*
The Odds API ─► /api/basketball/odds (revalidate 300/600s) ─► odds-comparator/chart
euroleague_api (python3 execFile, ZÉRO cache serveur) ─► /api/euroleague/matches
        ▼
BasketballTabContent (merge NBA/WNBA/Euro/EuroCup, 3 vues : Matchs/H2H/FIBA)
 ├► BasketballMatchCard ─► event open-match-detail ─► MatchDetailDialog
 └► H2H suite (7 comps) + FIBA subfolder (13 comps, includes shap-waterfall)
```

- **16 composants** basket + **13** sous-dossier `fiba/`, **6 hooks**, **5+2 libs**, **9 routes API**, **4 services legacy**, 1 cron (cassé).
- Lazy-load bien fait : `page.tsx:53` tab, dialog + H2H + FIBA en `dynamic ssr:false`, odds chart lazy dans le dialog.
- **5 formes de match concurrentes** : `BasketballMatch`, hook `BasketballMatch`, `LightMatch`, `UnifiedMatch`, `BasketballMatchCardMatch` → racine des bugs B4/B8.
- Legacy/Next partagent le même service (pas de duplication de logique) ✓ — mais `server.js:35969` appelle `/api/basketball/matches` **inexistant**.

## 1.2 Handball — carte complète

```
flashscore.ninja feed (J-1..J+7, zero-dep)   +   FlashScore DOM Playwright (.mjs)
        └► data/flashscore_handball.json (202 matchs, scraped_at 21/09)  ◄── SEUL PPF
             ├► /api/handball/matches (5min) ─► useHandballMatches (60s) → grille/calendrier
             │                            └──► sidebar sports-tree + top-matches adapter
             ├► /api/handball/live (30s) ─► useHandballLive (15s)  [fetch mort — jamais lu]
             ├► /api/handball/strategy-top8 (5min, ?strat=) ─► Top8Widget + Banker
             └► fallback API-Sports (clé football → 403 → []) = quasi mort
/api/handball/standings (API-Sports 30min) ─► HandballRankings [IMPORTÉ, JAMAIS RENDERÉ]
```

- **12 composants** dont **5 morts** : `match-detail-dialog`, `rankings`, `multi-sport-card`, `error-boundary` (jamais monté !), `top8-widget` ok.
- **2 libs mortes** : `handball-xg.ts` (0 importateur, baseline 18.7 vs réel ≈28.5), `getRealHandballOver`/`REAL_EHF_CL_FIXTURES` (import inutilisé, snapshot figé 17 sept).
- Legacy `server.js` : **aucun** endpoint handball dédié — vertical 100 % Next.js ✓.
- Tests : 24 pass / 0 fail (`handball-strategy-top8` + `handball-backtest`) — mais mocks ids 100/200, route mapping `id:0` jamais testée.

---

# 2. MAJ DONNÉES (freshness)

## 2.1 Basket

| Source | TTL | État |
|---|---|---|
| ESPN NBA/WNBA scoreboard | mem 90s + route 5min + SWR 60s | OK live, mais route TTL (5min) écrase la fraîcheur service (90s) |
| ESPN standings / injuries | 6h / 15min | OK |
| ESPN FIBA | 30s + revalidate 30 | OK, rate-limited |
| The Odds API | 300/600s | ⚠️ `/api/basketball/odds` **sans rate-limit** (quota 500 req/mo !) + dialog re-fetch à chaque poll 60s ouvert |
| H2H disk `data/basketball_h2h/` | 6h/7j/30j/12h | ⚠️ **138 fichiers, 100 % wnba_*, 0 nba_*** → chaque cold start paie 2009→now |
| **Elo** `data/nba_elo.json` + `wnba_elo.json` | 1h mem fichier | 🔴 **mtime 15/08/2026** — `tools/refresh_{nba,wnba}_elo.js` existe mais **zéro cron/workflow/package script**. Saison 2026-27 démarre oct. |
| EuroLeague (python3) | **aucun cache serveur** | 2 spawns python/min ; échoue sur Windows (`python3` vs `python`) → bandeau rouge permanent en dev |
| `scripts/fiba-cron.js` | — | 🔴 **ne peut pas tourner** : `import` ESM dans package CJS + specifier `.js` vs `.ts` réel + pas de schedule. Commentaire dit "toutes les 30 min" → jamais |
| Highlightly | 6h/24h | **inerte** (clé+flag requis) ; seul `status()` consommé → 232 lignes mortes |

**Hardcoded seasons** : `basketball-league-config.ts:35,53,71…` → `"2025-26"`, WNBA `"2026"`, FIBA `"2026"` ; `euroleague/matches/route.ts:30` → `season="2025"` défaut. **Rollover oct. 2026 = dans ~2 semaines.**

## 2.2 Handball

| Signal | Valeur |
|---|---|
| `data/flashscore_handball.json` | 62,8 Ko · 202 matchs · **`scraped_at` 2026-09-21T22:35Z** (≥2j) · **untracked git** |
| Schedule déclaré repo | **AUCUN** — cron pm2 `pariscore-cron-flashscore-handball` n'existe que dans un commentaire (`scrape-flashscore-handball.js:21`). `ecosystem.config.js` a tennis, pas handball. |
| "Live" | 🔴 `/api/handball/live` filtre `isLive` **du JSON J-1** → 45 cartes zombies scores figés, re-servies toutes les 15s |
| Cliff | `emptyStreak >= 2` stop + couverture finit 23/09 → onglet se vide silencieusement après |
| Fallback API-Sports | MORT : abonnement handball séparé requis, clé = `API_FOOTBALL_KEY` → 403 → `[]`. JSON = point de unique échec. |
| `handball-real-data.ts` | **Snapshot figé** : fixtures "données du jour (17 sept)", `TEAM_STATS` EHF 2025/26 jamais rafraîchis, clés dupliquées `"THW Kiel"`/`"Kiel"`, inconnues → λ=56.0 flat |
| Fraîcheur affichée | FAUSSE : `updatedAt = Date.now()` (heure de service), `scraped_at` jamais lu par aucun route |
| Scrapers jumeaux destructeurs | `.mjs --live` **écrase** le dataset complet par un sous-ensemble live-only (même OUT_FILE) |

---

# 3. BUGS

## 3.1 🔴 CRITIQUES

### Basket

| # | Bug | Preuve | Effet |
|---|---|---|---|
| **C-B1** | Split vocabulaire status : service émet `pre\|in\|post`, UI teste `"in-progress"` | `basketballService.js:602` vs `basketball-tab-content.tsx:114,120`, `match-card.tsx:75` | **Live NBA/WNBA jamais compté, jamais badge, jamais vue Live** |
| **C-B2** | Live drop après 15 min : `filterByStartWindow` appliqué inconditionnellement | `basketball-tab-content.tsx:122` ; football/tennis utilisent `filterLiveByWindow` correctement | Match live **disparaît** de toutes les vues 15 min après tip-off. Combiné B1 → onglet = pre-match only le soir de match |
| **C-B3** | De-vig jamais exécuté : `mlHome > 0 && mlAway > 0` — favori American = négatif | `basketball-odds.ts:126` et `:276` | **Feature Value Bet MORTE** + implied % jamais affiché. Fix = retirer `> 0` (1 ligne) |
| **C-B4** | Dialog crash EuroLeague : cast `as unknown as BasketballMatch` puis `match.injuries.home.nOut` | `tab-content.tsx:136-137` → `dialog.tsx:435-436` | TypeError, pas d'error boundary basket → onglet entier peut tomber |
| **C-B5** | Kelly/EV/vig **×100 deux fois** | Service : `basketballService.js:482,509-515` (déjà %) ; Dialog : `dialog.tsx:330,334,346,352,356` | "Kelly 2500.0%", "Vig 475.0%" affichés au user |
| **C-B6** | Kelly `side` = display name vs compare `"home"` | `basketballService.js:594` vs `dialog.tsx:327-328` | Badge Kelly **toujours équipe away** |
| **C-B7** | Odds-history : endpoint déprécié + renvoie ≤1 snapshot ; gate `length > 1` | `basketball-odds.ts:226,284-292` vs `dialog.tsx:264` | Graph line-movement **jamais rendu** + quota brûlé à chaque ouverture |
| **C-B8** | Cards ne reçoivent jamais `predictions`/`odds`/`injuries` (UnifiedMatch strippé) | `tab-content.tsx:72-111` vs `match-card.tsx:77-78,138,144,174` | Win-prob bar, Four Factors, badges blessures, odds : **jamais rendus** |
| **C-B9** | Top-matches adapters sur shape legacy que la route Next ne produit pas (`'FT'`, `is_live`, `homeTeam`) ; patterns live sans `/^in$/` | `top-matches/nba.ts:19-26`, `types.ts:147-148` | Live NBA absent du widget homepage ; badge "Imminent" jamais |

### Handball

| # | Bug | Preuve | Effet |
|---|---|---|---|
| **C-H1** | `toHandballMatch` → `id: 0` pour **tous** les teams ; form-store key = `String(id)` | `strategy-top8/route.ts:70-71` → `handball-strategy-top8.ts:87-88` | **Toutes les équipes = 1 bucket "0"** → `bestTeam` toujours tie→home, `expectedGoalDiff` ≡ HOME_ADV, totals/btts/ht identiques partout. Form strategies **mathématiquement nulles** en prod. Tests rassurent car mocks = ids 100/200 |
| **C-H2** | `ppg(f,n)` : `slice` calculé mais jamais utilisé | `handball-strategy-top8.ts:104-105` | `ppg(5)===ppg(10)` → poids L5/L10 = no-op |
| **C-H3** | EV Over/Under calculée sur cotes **1X2** | `:314,:323` | Tout EV affiché (Top8 + Banker) = **fabrication** |
| **C-H4** | Handicap away : `diff < 0 → prob = 0` + Skellam bidouillé unilatéral + HOME_ADV doublé | `:329-333`, `:236` | Handicap away = "0.0%" toujours mais classé |
| **C-H5** | `valueBet` : prior constant 0.50/0.45 sans forme + marché non de-viggé (incohérent avec `bestTeam1x2`) | `:166`, `:365-366` vs `:280-282` | Edges inventés (amplifié par C-H1) |
| **C-H6** | Fraîcheur FAUSSE : `updatedAt = now`, `scraped_at` jamais lu | `matches/route.ts:116`, `live/route.ts:91` | UI ment sur l'âge des données |
| **C-H7** | Live = snapshot J-1 filtré | `live/route.ts:43` | 45 cartes live zombies scores figés |

### Tests & couverture (revue)

```
node scripts/run-bun.js test handball-*.test.ts → 24 pass | 0 fail | 458 expects
```
- `basketball-odds.ts` : **0 tests** (C-B3 shipé vert) · `basketballService.js` : **0 tests** (C-B5/6) · `basketballH2HService.js` : **0 tests** (limit 500, cache vide) · route mapping `toHandballMatch` : **0 tests** (C-H1 shipé vert) · adapters top-matches : 0 · specs Playwright basket/handball : 0.

## 3.2 🟠 IMPORTANTS

| # | Bug | Lieu |
|---|---|---|
| I1 | ESPN H2H saison tronqué `limit=500` (saison NBA ≈1330 matchs) → stats post-janvier absentes | `basketballH2HService.js:194` |
| I2 | Réponses ESPN **vides cachées** 6h/5min comme succès | `basketballH2HService.js:209-210`, `api/nba/matches/route.ts:17` |
| I3 | Handball standings : saison `new Date().getFullYear()` (mauvais mi-saison) + contrat brut API ≠ `StandingRow` attendu → crash latent si render | `handball-api.ts:162`, `handball-rankings.tsx:36,106` |
| I4 | Pas de gate fraîcheur JSON handball (~20h) — fichier vieux gagne toujours sur fallback | `matches/route.ts:108`, `strategy-top8/route.ts:95` |
| I5 | Ligues domestiques LNB/ACB/… sélectionnables sans source → liste vide silencieuse | `basketball-league-selector.tsx:86` vs `tab-content.tsx:61-63` |
| I6 | Dialog re-fetch Odds API ×2/min tant qu'ouvert (dép = identité objet) | `dialog.tsx:103-148` |
| I7 | Routes nba/wnba : `let cache` module au lieu de `createTtlCache` (pattern CPU 100 % VPS documenté dans `cached-route.ts:1-18`) | `api/nba/matches/route.ts:4` |
| I8 | Handball "À venir" inclut les terminés ; cards sans score/status | `handball-tab-content.tsx:27-30` |
| I9 | Banker **jamais** sur chemin prod : exige `probPct` qui vient des stratégies à cotes, or **toutes les cotes du JSON = `[]`** | `handball-banker.tsx:14-23` + JSON vérifié |
| I10 | `formSummaryStr` = plafond de totaux carrière (pas séquence L5) → "WWWWW" faux | `handball-strategy-top8.ts:244-247` |
| I11 | Dialog Four Factors jamais rendu (`predictions` jamais peuplé) | `dialog.tsx:85` |
| I12 | Closure périmée listener detail (deps = NBA only, lit euro) | `tab-content.tsx:142` |
| I13 | Route odds = pass-through API payant sans rate-limit/Cache-Control ; clé API dans l'URL → clé dans les entrées de cache Next | `api/basketball/odds/route.ts:4-25`, `basketball-odds.ts:172,180` |
| I14 | Sort cotes : `null ?? 0` + `Math.max` sur American odds (flip de signe) | `odds-comparator.tsx:33-42` |
| I15 | `fiba-cron.js` mort (ESM/CJS + specifier .js/.ts + no schedule) | `scripts/fiba-cron.js:17` |
| I16 | EuroLeague : `python3` only, 0 cache, spawn ×2/min | `euroleague/matches/route.ts:38-77` |

## 3.3 🟡 MINEURS / SMELLS (tags Le Ladder)

- `delete:` : `handball-xg.ts` · `match-detail-dialog/rankings/multi-sport-card/error-boundary` handball (ou wire) · `REAL_EHF_CL_FIXTURES` · `americanToDecimal` (`basketball-odds.ts:65`) · `normalizePace`/`ratingDiffToSpread` (`league-config.ts:248,256`) · `isHomeA` (`h2h-matches-tab.tsx:46`) · page-level dialog basket mort (`page.tsx:75-85,266`) · `topBets` routes sans consumer Next · dead ternary `? undefined : undefined` (`top-matches/handball.ts:99`).
- `stdlib:`/`shrink:` : `LEAGUE_LABELS` dupliqués et **divergents** ("Betclic Élite" vs "Betclic Elite") — utiliser `getLeagueConfig().label`.
- `yagni:` : 5 formes de match basket → une seule (`BasketballMatchUI` existe déjà, inutilisée).
- `any:` : `top-matches/{nba,wnba,fiba}.ts` pervasive — viole règle strict TS.
- Port fallbacks `localhost:3005` (adapters) ≠ 3000 dev/hockey → widget vide si env manquante.
- `lean === "Over"` vs service `'OVER'` → couleur UNDER toujours (`dialog.tsx:384`).
- Pace = `avgPF+avgPA` (≈229) labelisé "Pace" possessions/48 (≈107) (`basketballService.js:183-192`).
- Pas d'**error boundary** dans aucun des deux onglets — un TypeError = onglet entier blanc.
- Raw `<img>` partout H2H (lint `@next/next/no-img-element`).
- Handball UI : hex FotMob hardcodés cassent dark mode (`handball-calendar.tsx:7-16`, `top8-widget.tsx:7-19`).
- Odds affichées 2× sur card handball (`handball-match-card.tsx:24-58`) ; calendrier+grille doublonnent (`tab-content.tsx:84-107`).
- Score 0-0 drop (`home>0||away>0`) · kickoff manquant → `now` · tie-break `odds.home` pour toutes stratégies · CMP shift la moyenne pas la dispersion (`:321`).
- `winProb` no-form : home+away = 0.95 ≠ 1.0 (`:166`).

---

# 4. AMÉLIORATIONS & INNOVATIONS

## 4.0 🚀 QUICK WINS (≈1h30, impact max)

| Fix | Fichiers | Temps | Gain |
|---|---|---|---|
| Map status `pre\|in\|post → vocab UI` + `/^in$/` patterns | 3 fichiers | ~15 min | Live tab + badges OK |
| `filterLiveByWindow` en vue live | `basketball-tab-content.tsx` | ~10 min | Live ne disparaît plus |
| Retirer `> 0` de-vig | `basketball-odds.ts:126,276` | 2 min | Value Bet vivant |
| Retirer `*100` dialog (×5) | `dialog.tsx` | 10 min | Kelly/EV/vig lisibles |
| Guards `injuries?.` / typage Euro | dialog + tab-content | 15 min | Crash EuroLeague OK |
| `id` stable handball (slug hash) | `strategy-top8/route.ts:67-77` + 1 test | ~20 min | Top8/Banker réels |
| Fix `ppg` window `slice(-n)` | `handball-strategy-top8.ts:100-107` | 5 min | Poids L5/L10 réels |

## 4.1 P0 — Correctness (argent en jeu)

1. **Basket status unifié** en un seul boundary (`normalizeMatch`) + adapters top-matches.
2. **Handball EV honnêtes** : `ev: null` sur over55/under62 tant que vraies cotes O/U absentes ; de-vig marché `valueBet` ; Skellam symétrique handicap ; `winProb` → `null` sans forme.
3. **Fraîcheur honnête handball** : exposer `scrapedAt` + `stale` (>2h), désactiver mode live si stale.
4. **Gate JSON ~20h** → fallback API (pattern OddAlerts).
5. **Retirer dead live fetch** (`handball-tab-content.tsx:18`) — poll 15s pour rien.
6. **Ne jamais cacher les payloads vides** (ESPN) + paginer `limit=500`.
7. Routes nba/wnba → `createTtlCache`.

## 4.2 P1 — Pipeline fraîcheur (AVANT saison oct.)

1. **Workflow Elo** : cloner `refresh-football-elo.yml` → `tools/refresh_{nba,wnba}_elo.js` daily in-season. **Critique avant NBA 2026-27.**
2. **Rollover seasons** : helper `currentSeason(league)` dérivé de la date (pattern `basketballH2HService.js:48-51`) ; défaut euroleague route.
3. **Primer cache H2H NBA** (one-shot `getSeasonMatches`+`getHistoryMatches`, cron).
4. **Cron handball déclaré dans repo** : entry `ecosystem.config.js` miroir tennis (`30 6 * * *`) ou workflow GH ; + cadence `*/10` en fenêtre matchs si "live" voulu.
5. **`fiba-cron` : réparer ou supprimer** (bruit pur aujourd'hui).
6. **API-Sports handball** : vérifier abonnement ou supprimer les branches fallback et échouer en `degraded`.
7. **Scrapers** : `.mjs --live` doit *fusionner*, pas écraser ; ou retirer un des deux.
8. **Rate-limit + cache `/api/basketball/odds`** (porter le pattern FIBA) ; dialog fetch keyé sur `match.id`.

## 4.3 P2 — Structure / qualité

1. **Écraser les 5 types de match** → `BasketballMatchUI` unique ; tue B4/B8.
2. **Monter `HandballErrorBoundary`** autour de l'onglet (`tab-content.tsx:42`) + un boundary basket.
3. **Wiring UI morte** : card handball → detail dialog ; render `HandballRankings` (après fix contrat I3) ou supprimer route ; win-prob bar cards basket via `pHome/pAway` ou `predictions` dans `normalizeMatch`.
4. **Selector honnête** : masquer ligues sans fetcher, inclure `fiba`, fusionner `getGroupLeagues`/`getAllLeagueIds()`.
5. **Highlightly : câbler ou supprimer** (cross-check H2H promis en header, jamais fait).
6. **Self-fetch adapters → import direct** service (supprime hop HTTP + port 3005).
7. **Tests unitaires math exportée** : `americanToImplied`/de-vig, `computeSplit/DataPoints/BTTS`, Kelly scale, `toHandballMatch → compute` (1 integration test : 2 teams → 2 values distinctes). Convention `src/lib/__tests__/*.test.ts` + `bun:test`.
8. **`next/image`** H2H ; units documentées dans types (`/** percent 0-100 */`).
9. Streak in-flight dedup + TTL dynamique (90s pendant `in`).

## 4.4 P3 — Innovations (fondées littérature, §5)

1. **MOVDA-style Elo** : update ΔMOV vs expected (tanh calibré) — −0.66% Brier, convergence +13.5 % (Shorewala & Yang 2025). Effort bas, backend only.
2. **Blend appris** : stacked logistic/isotonic sur Elo/Pyth/FF/SRS/L10 + walk-forward CV — **porter `walk-forward.ts` du football**.
3. **CLV tracking** : re-score backtest 1324 matchs vs *closing implied* (pas vs pile-poil) + log CLV par signal BET. Standard du domaine.
4. **Totals possession-based** : (pace × blend ORtg/DRtg)/2 + distribution résiduelle empirique (SD 18 fixe → fitted) + **prior under semaine 1** (58.2 % documenté). Marché totals = le plus inefficace → opportunité.
5. **Live win-prob basket v1** : Bayesian dynamique (temps, écart) + prior pré-match décroissant (Maddox 2022 — bat ESPN en segments Q4). Réutiliser infra live tennis (Markov).
6. **Impact roster blessures** : agrégat minutes-weighted d'une métrique publique type BPM2/estimated RAPM (RMSE 2.71-2.80 ok ; EPM 2.48 si licence) vs heuristiques `STAR_OUT`.
7. **Handball xG v2** : fit logistique/GBM sur features événement (zone + distance/angle proxy + 7m/transition + gardien) — SHAP Adams 2023 : distance 0.43 > angle 0.25 > gardien 0.18 ; Mortelier 2024 : la richesse positionnelle ajoutée paie peu → modèle cheap calibrable > table fixe.
8. **Prior FIBA** : Elo équipe nationale depuis points FIBA (USA 845.8 … BRA 699.4, monotone) — mapping affine, `PTS_PER_ELO=24` déjà en config.
9. **Reporting** : ajouter courbe calibration / ECE à côté de Brier — la littérature note la calibration, pas juste l'accuracy.
10. **Rolling form history handball** : scraper append quotidien en SQLite (pattern `league_season_stats` oddalerts) → chronologie réelle pour `buildFormStore` au lieu d'un snapshot ordonné par fichier.

---

# 5. LITTÉRATURE ACADÉMIQUE & SCIENTIFIQUE (basket + handball xG)

## 5.1 Sources locales (PDF repo)

- **[L1] Liang, Gao, Wang & Liu (2025)** — *Data-driven insights into basketball performance* (Mol. Cell. Biomech. 22(1):1083). 180 matchs (90 NCAA + 90 NBA 2021-24), Synergy tagging, discriminant + logit/tree/SVM, LOO-CV. **Résultats** : structure discriminante TS% 0.48 > PER 0.42 > DRtg −0.39 ; gagnants TS% 54.1 vs 48.2 %, TO 12.3 vs 16.4 ; accuracy 82.4 % (85.1 % stakes élevés). ⚠️ **Caveat audit** : discrimination *post-hoc* avec stats in-game — **pas** une accuracy pré-match. Ne pas présenter comme forecast.
- **[L2] Shana & Alsaeedi (2024)** — *Spatiotemporal model…* (local PDF). LSTM trajectoires + FMDP + point processes. **Aucune validation quantitative** → ne citer que comme taxonomie, jamais comme preuve.
- **[L3] Statista/FIBA (2026)** — Top FIBA : USA 845.8 > GER 765.9 > SRB 761.8 > FRA 756.5 > CAN 753.1 > AUS 740.2 > ESP 720.3 > ARG 708.3 > LTU 702.5 > BRA 699.4. Prior prêt à l'emploi pour équipes nationales (Elo actuel = clubs only).

## 5.2 Web research 2020-2026 — papiers clés

| # | Source | Méthode | Finding utile PariScore |
|---|---|---|---|
| W1 | **MOVDA** — Shorewala & Yang 2025 (arXiv 2506.00348) | Elo update par ΔMOV = observé − expected (tanh scaled) | Brier −0.66 % vs Elo, −1.54 % vs TrueSkill ; convergence +13.5 %, coût Elo. **Upgrade direct `refresh_nba_elo.js`** |
| W2 | **Bayesian in-game WP NBA** — Maddox et al. 2022 (arXiv 2207.05114) | WP dynamique (temps, écart) + prior pré-match décroissant | Bat ESPN sur **segments Q4** ; blueprint live-WP basket |
| W3 | **EPV** — Cervone, D'Amour, Bornn, Goldsberry, JASA 2016 | Expected Possession Value (tracking optique, Markov coarsened) | North star possession-level ; nécessite tracking (box score seul ≠) |
| W4 | **Four Factors = 1 facteur ?** — AlBaghal, JQAS 2012 (+ validation causale 2021) | Régression + CFA sémantique NBA 1996-2021 | FF ofensives → facteur latent unique ; **eFG% le standout** ; R²≈0.82-0.86 ; **déf FTR = maillon faible** |
| W5 | **FF via MOB trees** — Migliorati 2022/23 (19 138 matchs 2004-2020) | Arbres récursifs biais-réduits | Splits = **intercept (écart force)**, poids FF quasi constants → valide blend Elo-heavy + poids fixes structurels |
| W6 | **RAPTOR** — FiveThirtyEight 2019 | Box + on/off courtmate network, PREDATOR prédictif | Agrégat roster > heuristic "leader PPG out" |
| W7 | **Metric retrodiction** — Dunks & Threes 2020 | RMSE notes équipe saison suivante | **EPM 2.48 > RPM 2.60 > RAPTOR 2.63 > BPM 2.71 > PER 3.20** ; RAPM bayésien gagne |
| W8 | **LEBRON** — BBall Index 2020-22 | Box prior + RAPM luck-adjusted | Réf méthodo pour prior impact blessures |
| W9 | **Marchés efficiency bundle** — Krieger/Pace 2023 ; J. Prediction Markets 2012 ; Early-season O/U 2013 | Clinched-seed spreads ; SUR NFL/NBA ; week-1 unders | Open lines inefficaces (letdown bias), **close ≈ correct** ; spread prédit bien, **O/U faible** ; **semaine 1 unders 58.2 %** (break-even 52.38 %) |
| W10 | **EoG decision-making** — J. Sports Analytics | WP logistique last-3-min, 92.5 % accuracy | Segments clutch où live WP > pré-match statique |
| W11 | **Handball xG** — Adams, David, Hesse, Rückert 2023 (ACM) | 7 algos, CatBoost + SHAP, 5-fold | Acc 70.1 %, AUC 0.647 ; SHAP : distance 0.43, angle 0.25, gardien 0.18 |
| W12 | **Quelles données pour xG handball ?** — Mortelier, Rioult & Komar 2024 | Feature selection wrapper | RandomForest F1 0.75-0.78 ; **positions seules ≈ full features** → événements suffisent, tracking rarement rentable en handball |

## 5.3 Facteurs prédictifs prouvés (rankés)

1. **Efficacité tirs (eFG%/TS%)** ★★★★★ — AlBaghal, Liang, Oliver, PariScore 71 %
2. **Différence force équipes (Elo/SRS/net rating)** ★★★★★ — Migliorati (intercept), MOVDA, Liang
3. **Turnovers (TOV%)** ★★★★☆ — Liang 12.3 vs 16.4 p<0.001
4. **Défense (DRtg)** ★★★★☆ — Liang −0.39/−0.43 ; AlBaghal (avec steals)
5. **Rebond offensif (ORB%)** ★★★☆☆ — Oliver #3 ; concentré côté favoris
6. **FT rate** ★★☆☆☆ — **le plus faible** (def FTR ne load pas)
7. **Rest/B2B/letdown (côté marché)** ★★★☆☆ — Krieger 2023
8. **Pace/contexte totals** ★★★☆☆ — totals = marché le plus leaky

## 5.4 Gaps vs implémentation PariScore

| # | Gap | Réf benchmark |
|---|---|---|
| G1 | Blend **fixe** 0.55/0.30/0.15, scale 3.2, SDs 12/18 = constantes non fitted | Migliorati, MOVDA, walk-forward football déjà en repo |
| G2 | Brier 0.209 vs **pile-poil only** (baseline triviale) | Citer vs closing implied (close quasi-efficient, Krieger) |
| G3 | **Zéro CLV** malgré open/close stockés | CLV = métrique standard du domaine |
| G4 | Totals = normale fixe SD 18, pas possession-based ; pas de prior early-season | Marchés totals inefficables + biais semaine 1 |
| G5 | **Zéro live WP basket** (tennis a Markov live, basket rien) | Maddox 2022, JSA end-game |
| G6 | Pas d'EPV / possession-level — FF = agrégats saison | Cervone 2016 |
| G7 | Blessure = heuristique leader-PPG, pas d'impact agrégé | EPM/RAPTOR/LEBRON class |
| G8 | Poids FF empruntés WinProb, pas re-fit par ligue (NBA vs FIBA) | AlBaghal : eFG tient 1996-2021 mais poids par ligue |
| G9 | Pas d'Elo national FIBA | L3 = prior monotonne prêt |
| G10 | xG handball = table fixe, non fitée, sans features phase/gardien | Adams 2023, Mortelier 2024 |

⚠️ **Caveats rapport** : [L2] sans résultats → background only. [L1] 82-85 % = post-hoc, labeliser tel quel.

## 5.5 Recommandations innovation (groundées)

→ Reprendre §4.4 (MOVDA, blend appris + walk-forward, CLV, totals possession + prior semaine 1, live WP Bayesian, impact roster, xG v2 handball, prior FIBA, ECE/calibration, form history SQLite).

---

# 6. TOP-5 RISQUES SILENCIEUX

1. **Top8 handball joli et faux** — `id:0` → lignes triées, formatées, plausibles = garbage déterministe. Vert partout (tests/types/UI). *Test : 2 teams distincts → 2 `value` distinctes, sinon fail.*
2. **Dérive unités % vs fraction systémique** — 4 sites divergents (de-vig null, dialog ×100, `winPct*100`, `fgPct*100`). Rien ne throw, user voit "+320 % edge". *Typage `/** percent 0-100 */` + asserts ranges.*
3. **Features mortes-by-construction** — win-prob bar, FF dialog, odds chart, Banker, error boundary non monté : compilent, rendent vide. Aucun boundary ≠ TypeError = onglet blanc. *Smoke-test : 1 NBA + 1 Euro detail, assert ≥1 prediction row.*
4. **Handball stale-forever** — JSON sans TTL gagne toujours, scraper absent indétectable (le fichier vieillit, aujourd'hui 2 j). *Gate `scraped_at` ~20h + exposer source/age en UI.*
5. **Cache upstream vide silencieux** — `count:0` pour 6h + `{matches:[]}` 5min après un simple ESPN blip + troncature `limit=500` invisible. H2H/listes vides en HTTP 200. *Never cache empty ; paginer.*

---

# 7. ÉTAT TESTS

```
handball-strategy-top8 + handball-backtest : 24 pass / 0 fail / 458 expects (656 ms)
```
> `bun` absent du PATH CMD → runner : `node scripts/run-bun.js test …`

**Zéro couverture** : `basketball-odds` (de-vig/fuzzy/history) · `basketballService` math (exports prévus pour tests !) · `basketballH2HService` compute* · route mapping handball · adapters top-matches · specs Playwright basket/handball.

Tests handball valident le **moteur** avec mocks sains — incapable de détecter C-H1, et n'assertent ni handicap, ni EV, ni fenêtres de forme.

---

## 📌 ORDRE D'EXÉCUTION RECOMMANDÉ

1. Quick wins §4.0 (~1h30) — répare l'essentiel visible basket + handball
2. P0 §4.1 — argent en jeu (fraîcheur honnête, EV honnêtes, empty-cache)
3. **Avant octobre** : workflow Elo + rollover seasons + cache H2H NBA primé (§4.2)
4. Tests math exportée (§4.3.7) — verrou contre régression
5. P2 wiring/dead-code pass + boundaries
6. P3 innovations par valeur : CLV → blend appris → live WP → totals possession → xG handball v2

*Rapport généré 2026-09-23 par audit multi-agents (explore ×2 + code-reviewer + research) — cotes `file:line` vérifiées sur le repo.*
