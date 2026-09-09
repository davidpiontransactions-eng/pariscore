# Rapport final — Phase innovations (INNOVATIONS-2026-09-09)

## Livré
- **P1** : `fotmob-theme.ts` partagé (0 duplication) ; grille +`O 3.5`/`U 2.5`/
  `U 3.5` + buts d'équipe `1+`/`2+` ; ligne `xG / tir`.
- **P2** : cache `Match.espnEventId` en DB (1 scoreboard évité/ouverture,
  best-effort) ; 24 alias KR/JP (`canonical()` dans `sig`/`sigKey`).
- **P3** : buts ⚽ cliquables + détail (buteur, score, xG) ; chip
  `SIGNAL · outsider domine` sous la minute ; backtest funnel
  (`FunnelSnapshot` + `POST live-funnel-log` → KvStore, index borné 1500).

## Fichiers (9)
`fotmob-theme.ts` (new), `live-stats-breakdown.tsx`, `pressure-duo-donuts.tsx`,
`momentum-chart.tsx`, `football-match-detail-dialog.tsx`,
`espn-soccer-fetcher.ts`, `stats/route.ts`, `football-live-thresholds.ts`,
`live-funnel-log/route.ts` (new).

## Gates
typecheck OK · lint 0 errors · 79 tests pass · Graphify 21463 nœuds/41830 arêtes.

## Reste (QA manuelle suggérée)
Popup K1 : buts cliquables, chip surge sur outsider qui domine, 2ᵉ ouverture
sans fetch scoreboard, snapshots `funnellog:*` en DB. Backfill `espnSlug`
et calibration des seuils sur snapshots : prochains chantiers.
