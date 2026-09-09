# Trace T7 — Décision D6 : corrélation servie par l'API (SESSION-2026-09-09-CAL-FILTRES-H)

## Décision : REJETÉE (revert propre, route inchangée)
Proposition D6 : servir la corrélation calendrier↔Top10 depuis l'API calendar (`topTags` embarqués), pour "0 heuristique client".

## Pourquoi revert
1. **Self-HTTP fragile** : la route calendar devrait fetch `/api/football/top5` (HTTP vers soi-même, boucle, timeout).
2. **Duplication** : répliquer `computeStrategyTop5Matches` dans la route = copie de la logique top5 (anti `DRY`).
3. **Aucun gain** : le client construit déjà l'index via `useFootballTopN` **partagé avec le widget** (SWR dedupe 20min) → 0 requête extra quand le widget est monté (cas nominal).
4. **Séparation des caches** : index top (30min) vs calendar (5min) désynchronisés = risque de tag périmé vs payload frais.

## Ce qui reste (client, actif)
- `top10-calendar-link.ts` : `buildTopTags`/`topTagsForMatch` testés (5/5). Jointure id normalisé + repli noms `normalizeTeamName`.
- `top-multi-sport.tsx` : 1 fetch SWR ↔ widget, filtre `calTopOnly`, chip, section Top du jour, filtres URL.
- `fotmob-calendar-table.tsx` : `TopStratPills` + section `__top`.
- `fotmob-filter-bar.tsx` : segmented horaire + toggle ★ Top.

## Gates
86 tests pass (5 pill + 81 existants). espn diff vide → route propre. `tsc`/lint full : timeout runner (préexistant).

## Skill : caveman-code