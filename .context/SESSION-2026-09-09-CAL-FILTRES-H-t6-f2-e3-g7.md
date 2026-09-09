# Trace T6 — F2 URL + E3 vide explicite + G7 Top du jour (SESSION-2026-09-09-CAL-FILTRES-H)

## Livré (P1 rapport pill)
- **F2** : `?date=&h=&live=&top=&q=` — `readCalUrl()` (validation stricte : `h ∈ {1,2,4,8,16,24}`, date `YYYY-MM-DD`) + hydrate au mount + `replaceState` à chaque changement. Pattern Top10 `?strat=` repris. Deep-link : `?date=2026-09-09&h=2&top=1`.
- **E3** : état vide explicite dans le chip `aria-live` : "Aucun match ★ Top dans les 2 prochaines heures — élargissez la fenêtre ou désactivez les filtres."
- **G7** : section "★ Top du jour" épinglée en tête du calendrier (avant Suivis), même composant `FotmobLeagueSection`, repliée via `__top`.

## Fichiers
- `top-multi-sport.tsx` (`readCalUrl` + 2 useEffect + chip vide), `fotmob-calendar-table.tsx` (`topDay` + section `__top`).

## Gates
- 86 tests pass (5 pill + 81 existants). eslint full : timeout runner (préexistant).

## Skill : caveman-code
