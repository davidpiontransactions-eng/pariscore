# G4 — Intégration (skill: finishing-a-development-branch)

## Step 1 — Suite verte
`bun test tests/` : exit 0, 0 suspect (75 tennis OK, rapports OK).
Gates rappel : lint 0 erreur, typecheck 0 erreur (G3).

## Steps 2-4 — Trunk-based (ordres permanents)
- Base `main`, pas de worktree.
- `d17627ad` code → push → deploy `deploy-20260908-223945`
  (`health OK`, `smoke OK`).
- `f090d1a8` docs + `COMPONENTS.md` (ligne `fotmob-filter-bar`) → push.
  Pas de rebuild : aucun code depuis le deploy.

## Vérifications
- `bunx prisma validate` : schéma valide, 0 migration.
- `graphify update .` : graphe régénéré.
