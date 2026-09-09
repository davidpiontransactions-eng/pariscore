# Trace P3 — Buts cliquables + alerte surge + backtest (INNOVATIONS-2026-09-09)

## Fichiers
- `momentum-chart.tsx` : badges ⚽ cliquables (`selGoal`), pastille agrandie
  + ligne verticale renforcée, panneau détail (minute, buteur/camp, csc/pén.,
  score après but, xG) en teintes FOT. Rôle `button` + `aria-label` (a11y).
- `football-match-detail-dialog.tsx` : chip `SIGNAL · outsider domine`
  (ambre clair) sous la minute quand `detectPressureAnomaly = underdog_surge`
  (tooltip : pression live vs attendue). Import `Flame`.
- `football-live-thresholds.ts` : `FunnelSnapshot` + `buildFunnelSnapshot()`.
- `src/app/api/football/live-funnel-log/route.ts` (nouveau) : POST snapshot →
  KvStore `funnellog:{matchId}:{minute}` + index borné 1500 (éviction aînés).
- `live-stats-breakdown.tsx` : prop `matchId?`, beacon 60 s (`keepalive`,
  try/catch, jamais de throw) ; dialog transmet `view.id`.

## Vérifications
- `bun run typecheck` : OK (dont répar. ligne `useMemo` coupée en édition).
- `bun run lint` : 0 errors. Tests : 79 pass (thresholds/predictions/pressure).
