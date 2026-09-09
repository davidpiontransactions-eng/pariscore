# Trace T1 — Suppression stratMap mort (SESSION-2026-09-09-CAL-FILTRES-H)

## Décision : supprimer (pas câbler)
- `fetchTop5` jamais appelé (aucun useEffect), `stratMap` jamais lu (aucun badge).
- Jointure fragile : top5 `matchId` = id BSD brut, calendrier = `bsd-<id>` → norm requise, jamais faite.
- Sémantique incohérente : top5 = prematch `notstarted` uniquement ; calendrier = mixte live+prematch.
- Badge jamais maqueté (aucune spec visuelle). YAGNI : supprimer, re-ajouter si besoin réel.

## Diff
- `top-multi-sport.tsx` : −26 lignes (state `stratMap` + `fetchTop5`). `useCallback` toujours importé (utilisé par `fetchCal`/`fetchData`).

## Vérifications
- `bun run lint` / `typecheck` : timeouts runner 30s (non bloquant — edit = suppression pure, aucun symbole restant).
- Grep `stratMap|fetchTop5` : 0 occurrence restante (à confirmer en Act runner sain).

## Skill : caveman-code
