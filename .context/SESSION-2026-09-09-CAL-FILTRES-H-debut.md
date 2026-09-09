# Rapport de début de mission — SESSION-2026-09-09-CAL-FILTRES-H

Suite de SESSION-2026-09-09-POPUP-LIVE-FOOT (commits `77fa7519`, `22dcf254`, `f702b9be`).

## Périmètre
1. T1 stratMap mort (`top-multi-sport.tsx:305-344` — `fetchTop5` jamais appelé) : trancher câbler vs supprimer.
2. T2 filtre horaire calendrier foot : options ≤1h→≤24h + compteur + actif vert FotMob.
3. T3 backfill `League.espnSlug` depuis `BSD_TO_ESPN_SLUG`.
4. T4 QA popup K1 + filtre + cache ESPN 2e ouverture.

## Gantt
```
T0 debut+traces   [==]        5min   —
T1 stratMap       [====]     15min   caveman-code
T2 filtre-h       [======]   20min   design-md
T3 backfill       [====]     15min   caveman-code
T4 QA             [======]   20min   ps-test
T5 fin+innov      [=]         5min   ps-changelog
```

## Règles
1 tâche = 1 skill = 1 commit conventionnel. `bun run lint` + `bun run typecheck` par tâche.
Trace `.md` par tâche dans `.context/`. Style caveman (dense, tokens min).
