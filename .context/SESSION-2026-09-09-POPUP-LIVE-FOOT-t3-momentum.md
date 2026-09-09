# Trace T3 — Momentum résilient anti-503 (SESSION-2026-09-09-POPUP-LIVE-FOOT)

## Cause racine
La route `stats` jetait `503` dès que BSD + ESPN échouaient ensemble, et même
quand BSD fournissait un anchor momentum sans buckets/events
(`données par-minute absentes`). `buildPressureTimeline` savait déjà dégrader
(`fallbackCurve`, `perMinute: false`) mais la route ne l'utilisait jamais sur
ces chemins.

## Fichiers touchés
- `src/lib/football-timeline.ts` — `source` += `"estimated"`, flag `degraded?`.
- `src/lib/football-pressure-index.ts` — `PressureTimelineInput.source`
  aligné (`"estimated"`).
- `src/app/api/football/matches/[id]/stats/route.ts` — match connu + sources
  HS → courbe estimée HTTP 200 (`degraded: true`, `finalMinute` du meta) ;
  anchor BSD seul sans buckets/events → exploité (plus de 503 abusif) ;
  503 réservé au match vraiment inconnu (sans meta).

## Comportement client (inchangé, existant)
`MomentumChart` affiche `courbe estimée (pas de données par minute)` ;
le bloc gris `Momentum indisponible` ne reste que pour le 503 réel. Carte
claire (T1).

## Vérifications
- `bun run typecheck` : OK. `bun run lint` : 0 errors.
- `bun test football-pressure-index` : 10 pass / 0 fail.

## Skill : ps-audit
