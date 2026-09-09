# Trace T1 — Charte Footmob claire popup live (SESSION-2026-09-09-POPUP-LIVE-FOOT)

## Objectif
Uniformiser l'intérieur du popup live Football sur les teintes claires Footmob
(carte `#fff`, bordure `#f0f0f0`, encre `#222`, muted `#717171`, barres
`#1a1a1a`/`#bdbdbd`, accent live `#00985f`). Supprimer le mixte clair/sombre
(bloc `STATS LIVE` en `slate-950`, jauges `slate-900`, momentum `bg-muted/40`).

## Fichiers touchés
- `src/components/football/live-stats-breakdown.tsx` — constante `FOT`,
  `BilateralGauge` / `StatRow` / section / grille probas en clair.
- `src/components/football/pressure-duo-donuts.tsx` — constante `FOT`,
  section + `Donut` (domicile `#1a1a1a`, extérieur `#bdbdbd`) + bandeaux
  anomalie sur fond clair.
- `src/components/football/momentum-chart.tsx` — état vide + conteneur
  graphe en carte blanche bordure `#f0f0f0`.
- `src/components/football/football-match-detail-dialog.tsx` — bloc erreur
  momentum en carte claire (au lieu de `bg-muted/40`).

## Volontairement inchangé
- Couleurs séries du graphe momentum (`#22c55e`/`#3b82f6`) = encodage data.
- `ToggleChip` (tokens thème, adaptatifs au `colorScheme:light` forcé du dialog).
- DarK global (`DESIGN_CHARTER.md`) hors popup.

## Vérifications
- `bun run lint` : 0 errors (3 warnings préexistants tennis/cs2).
- `bun run typecheck` : OK (après fix `ringColor` → `border` inline).
- Visuel : à valider en QA navigateur (popup K League 1, état 503, état nominal).

## Skill : design-md
