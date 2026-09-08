# T3 — Câblage onglet foot (`top-multi-sport.tsx`)

## Constat
La carte « Calendrier des matchs » est `TopMultiSport`, nourrie par
`/api/v1/top-matches/all` (picks stratégiques — vides hors edges, d'où
« Aucun match top disponible »). Ce n'est pas `football-calendar.tsx`
(page `/calendrier-foot`, déjà restylée P0-P3).

## Changements (`TopMultiSport`, autres sports inchangés)
- Si `activeSport === "football"` : fetch `/api/football/calendar?date=`
  (date Paris du jour) + rendu `FotmobCalendarTable` au lieu des groupes
  top-picks ; compteur header = matchs filtrés.
- Pills horaires conservées et appliquées (`isInTimeWindow`, live toujours
  visible) ; bouton refresh re-fetch aussi le calendrier ; `calLoading`
  pour l'état `Chargement...`.
- `FotmobCalMatch` : shape compatible réponse API (champs extra ignorés).

## Vérifications
- `bunx prisma validate` : schéma valide, **aucune migration** (UI-only).
- `graphify update .` : graphe régénéré.
- QA navigateur (tableau blanc dans la carte, pills, follow) : T4.
