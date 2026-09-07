# Rapport de Mission: Baseball/KBO

**Date**: 2026-09-07
**Statut**: ✅ COMPLET — tous les tâches déployées en prod

## Résumé Exécutif

Correction critique du bug d'affichage Baseball/KBO (0 match affichés malgré 5 matchs en API), ajout d'un moteur prédictif Sabermetrics complet, scraper odds KBO/MLB avec stats lanceurs, et refonte UI Behance Glassmorphism.

## Livrables

### T1: Fix Bug Filtrage & Hydratation
**Racine du bug**: 4 causes interactives identifiées:
1. **Counter affiche le count brut API** (`data.matches.length`) au lieu du count filtré (`matchList.length`)
2. **Mode par défaut "live"** alors que les ligues KBO sont toujours "scheduled" (jamais live)
3. **Filtre horaire** `filterByToday` utilise le timezone client au lieu de Paris
4. **Filtre "Demain"**même problème de timezone

**Fixes appliqués:**
- `MLBKBOFolderTab.tsx:44` — default mode `"live"` → `"prematch"`
- `MLBKBOFolderTab.tsx:184` — `data.matches.length` → `matchList.length`
- `match-view.ts:83-97` — `filterByToday` et `filterByTomorrow` utilisent maintenant `Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris" })`

### T2: Scraper Odds KBO/MLB
- `scripts/scrape_baseball_odds.mjs` — Playwright scraper BetExplorer + MLB StatsAPI
- Cotes: Moneyline, Total (Over/Under)
- Stats lanceurs: ERA, WHIP, K/9, IP, W/L
- Cross-reference odds ↔ pitcher stats par nom d'équipe
- Flags: `--league=KBO`, `--league=MLB`

### T3: Moteur Sabermetrics
- `src/lib/baseball/engine/sabermetrics.ts` — 528 lignes, 7 fonctions:
  - `pythagoreanExpectation(RS, RA)` — Win% = RS^1.83 / (RS^1.83 + RA^1.83)
  - `pitcherMatchupRating(home, away)` — ERA/FIP/WHIP/K9 weighted comparison
  - `powerScore(team)` — Score de force composite (RS/G, RA/G, Win%, streak, forme)
  - `powerScoreComparison(home, away)` — Comparaison directe
  - `expectedRuns(home, away)` — Runs attendus basés sur ERA lanceurs
  - `detectValueBet(modelProb, marketOdds)` — Edge detection + Kelly criterion
  - `predictBaseballMatch(home, away, homeStarter, awayStarter)` — Pipeline complet

### T4: Refonte UI Behance
- `src/components/baseball/BaseballMatchCard.tsx` — redesign complet:
  - Dark Glassmorphism: `bg-slate-900/80 backdrop-blur-xl border border-white/[0.06]`
  - Badges néon: `shadow-[0_0_12px_rgba(0,230,118,0.3)]` pour predictions
  - Team logos avec gradient backgrounds
  - Pitcher badges glass-style avec stats ERA/WHIP
  - Live indicator: pulsing emerald glow
  - Value bet CTA: emerald neon border

### T5: Validation
- Build: `✓ Compiled successfully in 16.1s`
- PM2: `pariscore-next` online (port 3005)
- API status: `OK`

## Commits

| Hash | Message |
|------|---------|
| `e7f090b0` | fix(baseball): KBO display bug — default prematch mode, filtered count, Paris timezone |
| `f5c9c894` | feat(baseball): sabermetrics engine + Behance Glassmorphism UI redesign |
| `a2df7980` | feat(baseball): add KBO/MLB odds scraper with pitcher stats |

## Fichiers Créés/Modifiés

| Fichier | Action |
|---------|--------|
| `src/components/baseball/MLBKBOFolderTab.tsx` | Fix mode default + counter |
| `src/lib/match-view.ts` | Fix filterByToday/tomorrow Paris TZ |
| `src/lib/baseball/engine/sabermetrics.ts` | Nouveau — 528 lignes |
| `src/components/baseball/BaseballMatchCard.tsx` | Réécrit — Behance UI |
| `scripts/scrape_baseball_odds.mjs` | Nouveau — scraper KBO/MLB |
