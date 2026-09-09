# Trace P1 — Thème partagé + grille étendue (INNOVATIONS-2026-09-09)

## Fichiers
- `src/components/football/fotmob-theme.ts` (nouveau) : `FOT`, `fotCard`,
  `fotHomePct` — source unique des teintes claires.
- `live-stats-breakdown.tsx`, `pressure-duo-donuts.tsx`, `momentum-chart.tsx`,
  `football-match-detail-dialog.tsx` : importent `FOT` (zéro duplication).
- Grille marchés : + `O 3.5`, `U 2.5`, `U 3.5` et bloc buts d'équipe
  (`1+`/`2+` par camp — valeurs déjà calculées par `projectLiveMarkets`).
- Nouvelle ligne `xG / tir` (qualité des occasions, dérivée, 0 fetch).

## Vérifications
- `bun run typecheck` : OK.
