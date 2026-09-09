# Rapport de fin de mission — SESSION-2026-09-09-POPUP-LIVE-FOOT

## Fichiers modifiés (9)
1. `src/components/football/live-stats-breakdown.tsx` (T1+T4)
2. `src/components/football/pressure-duo-donuts.tsx` (T1)
3. `src/components/football/momentum-chart.tsx` (T1)
4. `src/components/football/football-match-detail-dialog.tsx` (T1+T4)
5. `src/components/football/fotmob-match-stats.tsx` (T4)
6. `src/lib/espn-soccer-fetcher.ts` (T2)
7. `src/lib/bsd-football-fetcher.ts` (T2)
8. `src/lib/football-timeline.ts` + `src/lib/football-pressure-index.ts` (T3)
9. `src/app/api/football/matches/[id]/stats/route.ts` (T3)
10. `prisma/schema.prisma` (T5 : `League.espnSlug`, `Match.espnEventId`)

## Bugs soldés
- B1 charte mixte → popup 100 % teintes claires Footmob.
- B2 stats vides K1 → cause racine ESPN (mauvais espace d'ids) corrigée +
  coercition BSD + matching KR.
- B3 503 brut → courbe estimée 200 + `degraded`, 503 réservé à l'inconnu.
- B4 probas `estimées pré-match` → rouges + calibration O2.5 branchés,
  libellé honnête (`score live + taux pré-match`).
- B5 couverture championnats mineurs → 34 ligues BSD→ESPN mappées.

## Portes ouvertes (non faites, scope)
- Backfill `League.espnSlug` / `Match.espnEventId` depuis `BSD_TO_ESPN_SLUG`
  (script à écrire).
- QA navigateur du popup (screenshot 412px, état estimé, état nominal K1).
- Penser à `bd close` + commit conventionnel par tâche (1 feature = 1 commit).

## Traces
`.context/SESSION-2026-09-09-POPUP-LIVE-FOOT-{debut,t1-charte,t2-datas-k1,t3-momentum,t4-metrics,t5-prisma-graphify,fin,innovations}.md`
