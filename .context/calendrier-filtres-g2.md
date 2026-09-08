# G2 — Barre filtre FotMob (skill: tdd)

## Seam testée
Helpers purs `src/lib/fotmob-filter.ts` (pas d'internals) :
`shiftDateKey`, `parisTodayKey`, `matchDayLabel`, `filterByKickoffWindow`
(live toujours gardé).

## RED → GREEN
- `tests/fotmob-filter.test.ts` : 4 tests écrits d'abord → échec
  (module manquant).
- Implémentation minimale → **5 pass / 0 fail** (10 expects).

## Composant (fine tranche verticale)
`fotmob-filter-bar.tsx` : datepicker ◀/▶ + `input[type=date]`,
toggle `En direct` (pastille rouge, `aria-pressed`), select `Par heure`
(Toutes/1h/2h/4h/8h/24h), recherche équipe. Teintes T1, `colorScheme: light`.
**« À la TV » abandonné** : aucune donnée de diffusion (fonctionnel exigé).

## Vérifications
- `bunx prisma validate` : schéma valide, 0 migration.
- `graphify update .` : graphe régénéré.
- Câblage + prematch : G3.
