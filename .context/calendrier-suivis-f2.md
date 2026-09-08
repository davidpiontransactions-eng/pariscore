# F2 — Section « Suivis » TDD (skill: test-driven-development)

## RED
`tests/fotmob-follow.test.ts` écrit avant tout code → échec constaté
(`Cannot find module '@/lib/fotmob-follow'`), raison attendue ✓.

## GREEN
- `src/lib/fotmob-follow.ts` (nouveau) : `toFollowId` (idempotent),
  `partitionFollowed` (ordre préservé, bi-forme).
- `fotmob-calendar-table.tsx` : prop `icon?: ReactNode`, `FotmobStarIcon`
  (path 24px du sample), section `__suivis` épinglée, exclusion des suivis
  des groupes, `FotmobFollowStar` en convention `match:football:<id>`
  (lecture bi-forme), `Tout masquer` inclut `__suivis`.
- Correctif lint : double `useFollowStore` sous `||` → sélecteur unique
  (`rules-of-hooks`).

## Vérifications
- `bun test tests/fotmob-follow.test.ts` : **4 pass / 0 fail**.
- `bun run lint` : 0 erreur. `bun run typecheck` : 0 erreur.
- `bunx prisma validate` : schéma valide, **aucune migration** (UI-only).
- `graphify update .` : graphe régénéré.
