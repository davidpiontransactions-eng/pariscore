# Refonte CS2 HLTV-like + Marchés Prédictifs Calibrés — Plan d'Implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans pour implémenter ce plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refondre l'onglet CS2 en copie HLTV (infos matchs + stats maps) et livrer des marchés prédictifs **calibrés** (winner match/map, Over rounds ≥65%, handicap rounds ≥65%) avec EV vs cotes et verdict BET/SKIP.

**Architecture:** 3 couches sans dépendance nouvelle : (1) moteur pur TS `src/lib/prediction/cs2/` (Bradley-Terry + Monte-Carlo MR12 existants + nouveaux modules calibration/handicap/map-play-prob/EV, 100% déterministe, testable bun:test) ; (2) API Next `src/app/api/cs2/` (enrich existant + nouveau `/markets`) ; (3) UI React (composants HLTV existants + nouveau panneau marchés). Backtest harness `scripts/cs2-backtest.ts` → rapport Brier/ROI = gate de calibration avant tout signal prod.

**Tech Stack:** TypeScript strict, bun:test, Next.js 16 App Router, SWR, shadcn/Radix, services/cs2Service.js (CJS existant). Cotes : champ `match.odds` BSD.

## Global Constraints

1. **Aucune nouvelle dépendance** runtime — stdlib + bun:test + existant. Repos GitHub évalués NO-GO (gigobyte/HLTV, awpy, jordyvanvorselen) dans rapport benchmark 2026-08-28.
2. **Gate calibration** : aucun signal BET en prod sans Brier/ROI admissible (papier Walsh & Joshi arXiv 2303.06021). Probas ≥65% doivent passer backtest.
3. **Seuil ≥65%** conservé (`CONFIDENCE_THRESHOLD = 0.65`) ; verdict BET = proba≥65% ET EV≥4% ET calibration OK.
4. **Conventional commits** ≤72 chars `feat(cs2):` / `fix(cs2):` / `chore(cs2):`, un commit par task.
5. **Commentaires français**, camelCase, TS strict (pas de `any`, `unknown` sinon).
6. **Traçabilité bd** : bead `ParisScorebis-xog5` (claimé), `bd close` + `bd dolt push` en fin.
7. **COMPONENTS.md** mis à jour dans le même commit qu'un composant ajouté.
8. **Fichiers uniquement dans src/** — jamais `.next/`.
9. **CMD** (PowerShell), jamais bash. `bun run lint` + `bun run typecheck` + `bun test` obligatoires à chaque fin de task.

---

## Mapping des fichiers

| Fichier | Responsabilité | Type |
|---|---|---|
| `src/lib/prediction/cs2/cs2-calibration.ts` | Brier score, ECE, ROI, verdict calibration | Nouveau |
| `src/lib/prediction/cs2/handicap-rounds.ts` | P(cover ligne ±1.5/±2.5 rounds) depuis RoundDistribution | Nouveau |
| `src/lib/prediction/cs2/map-play-prob.ts` | P(map jouée) : veto sim + fréquences pick/ban historiques | Nouveau |
| `src/lib/cs2/ev.ts` | Dévig, EV%, Kelly fraction (cap 0.25), verdict BET/SKIP | Nouveau |
| `src/lib/prediction/cs2/backtest-core.ts` | Logique pure du harness backtest | Nouveau |
| `scripts/cs2-backtest.ts` | CLI backtest → data/cs2-backtest-report.json | Nouveau |
| `src/app/api/cs2/markets/route.ts` | API agrégée marchés (cache 5 min) | Nouveau |
| `src/components/cs2/Cs2MarketsPanel.tsx` | Panneau marchés + EV + badges ≥65% | Nouveau |
| `src/components/cs2/HLTVMatchSheetModal.tsx` | Intégration panneau marchés | Modifier |
| `src/components/cs2/CS2MapPoolAnalytics.tsx` | Ajout bans + last-5 (style bo3.gg) | Modifier |
| `src/lib/cs2/types.ts` | Types Cs2Markets / Cs2EvVerdict | Modifier |
| `src/lib/prediction/cs2/cs2-predictive-ml-engine.ts` | Exposer types existants si nécessaire | Modifier |
| `docs/superpowers/plans/2026-08-28-cs2-hltv-markets.md` | Ce plan | Nouveau |
| `.context/trace-cs2-implementation.md` | Journal traçabilité lot par lot | Nouveau |
---

## Task 5 — Backtest harness + backtest-core

**Files:** Create `src/lib/prediction/cs2/backtest-core.ts`, `backtest-core.test.ts`, `scripts/cs2-backtest.ts`

**Interfaces:** `evaluateMarkets(records: { prob: number; outcome: 0|1; odds: number }[], market: string): MarketCalibration` ; `MarketCalibration = { market: string; n: number; brier: number; ece: number; roi: number; verdict: "OK"|"NO-GO" }`

- [ ] **Step 1**: test rouge du backtest-core (dataset synthétique parfait → OK ; mauvais → NO-GO)
- [ ] **Step 2**: bun test → FAIL
- [ ] **Step 3**: implémenter backtest-core (réutilise cs2-calibration)
- [ ] **Step 4**: bun test → PASS
- [ ] **Step 5**: écrire `scripts/cs2-backtest.ts` (collecte csapi 180j → reconstruit TeamModel → prédit → compare) — run réel `bun run scripts/cs2-backtest.ts` → rapport JSON
- [ ] **Step 6**: commit `feat(cs2): add backtest harness (brier/roi gate)`

## Task 6 — API agrégée /api/cs2/markets

**Files:** Create `src/app/api/cs2/markets/route.ts` ; modifier `src/app/api/cs2/enrich/route.ts` (optionnel odds)

- [ ] **Step 1**: écrire route (assemble prediction + handicap + mapPlay + ev ; calibrated lu depuis data/cs2-backtest-report.json; fallback false → verdicts SKIP)
- [ ] **Step 2**: `bun run dev` + curl → JSON cohérent borné [0,1]
- [ ] **Step 3**: cache 5 min createTtlCache
- [ ] **Step 4**: commit `feat(cs2): add aggregated markets API endpoint`

## Task 7 — UI panneau marchés dans fiche match

**Files:** Create `src/components/cs2/Cs2MarketsPanel.tsx` ; modifier `src/components/cs2/HLTVMatchSheetModal.tsx`

- [ ] **Step 1**: composant client (SWR /api/cs2/markets) ; badges OVER/UNDER ≥65%, handicap, EV/Kelly, calibration
- [ ] **Step 2**: intégration modal (tab apercu)
- [ ] **Step 3**: mise à jour COMPONENTS.md
- [ ] **Step 4**: build + test manuel Playwright
- [ ] **Step 5**: commit `feat(cs2): add calibrated markets panel to match sheet`

## Task 8 — UI HLTV-like bans + last-5

**Files:** modifier `src/components/cs2/CS2MapPoolAnalytics.tsx`, `src/lib/cs2/types.ts`, `services/cs2Service.js`

- [ ] **Step 1**: colonnes Bans + Last 5 (si données dispo) dans table map pool
- [ ] **Step 2**: types optionnels
- [ ] **Step 3**: test manuel Playwright
- [ ] **Step 4**: commit `feat(cs2): add bo3-style bans + last-5 to map pool table`

## Task 9 — Gates finaux, trace, clôture

- [ ] **Step 1**: `bun run lint` + `bun run typecheck` → 0 erreurs ; `bun test` verts
- [ ] **Step 2**: relancer backtest → rapport dans trace
- [ ] **Step 3**: MAJ docs/cs2_betting_benchmark_academique_2026-08-28.md (section état d'avancement)
- [ ] **Step 4**: `bd close ParisScorebis-xog5` + `bd dolt push`
- [ ] **Step 5**: PR vers main (squash) + optionnel deploy (DEMANDER avant)

---

*Plan verrouillé 2026-08-28. Bead ParisScorebis-xog5. Sources : benchmark académique docs/cs2_betting_benchmark_academique_2026-08-28.md.*