# Rapport de début de mission — SESSION-2026-09-09-POPUP-LIVE-FOOT

## Périmètre
Popup live Football ouvert depuis `Calendrier des matchs`
(`top-multi-sport.tsx:458,670` → `fotmob-calendar-table.tsx:224` →
`football-match-detail-dialog.tsx:131`). Repro : Gwangju 0-1 Jeju, 61',
K League 1 (console + screenshot fournis).

## Bugs cadrés
- B1 charte mixte clair/sombre dans le popup (section Stats live dark).
- B2 `Meilleures statistiques` réduite à la possession (xG/tirs/corners `—`).
- B3 `Momentum indisponible (HTTP 503)` sans fallback.
- B4 probas live `estimées pré-match` incohérentes avec 0-1 à 61'.
- B5 datas pauvres K1 / championnats mineurs (ESPN fuzzy, pas de blend histo).

## Ordre d'exécution
T1 charte (design-md) → T2 datas K1 → T3 momentum → T4 metrics →
T5 Prisma + Graphify + rapport fin + rapport innovations.

## Règles
1 tâche = 1 skill. 1 commit conventionnel par tâche. `bun run lint` +
`bun run typecheck` après chaque tâche. Trace `.md` par tâche dans `.context/`.
`graphify update .` + Prisma en fin de mission (T5).
