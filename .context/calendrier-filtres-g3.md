# G3 — Câblage + prematch + QA (skill: verification-before-completion)

## Câblage (`TopMultiSport`, mode foot uniquement)
- États `calDate` (défaut `parisTodayKey()`), `calLiveOnly`, `calHours`,
  `calQuery` ; `fetchCal(key)` ; refetch au changement de date + poll.
- `filteredCal` : live-only → fenêtre `filterByKickoffWindow` → recherche.
- Rendu : `FotmobFilterBar` + `FotmobCalendarTable`.

## Preuves navigateur (prod, fraîches — cf. skill)
- Anciens blocs absents : `mode-toggle-bar` false.
- Barre présente : date input, `En direct`, select heure, recherche.
- `En direct` ON → 23 lignes, 0 `status-time`, 23 scores.
- Recherche `real` → 3 lignes.
- Prematch : feed du jour à 0 (22h47, prouvé API `prematch=0`) ;
  jour suivant → **30 lignes, 30 heures** (`01:30`…), label `Demain`.
- 0 erreur page, 0 requête 4xx.

## Vérifications
- `bunx prisma validate` : schéma valide, 0 migration.
- `graphify update .` : graphe régénéré.
