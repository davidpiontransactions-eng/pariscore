# B4 — QA + release (skill: verification-before-completion)

## Deploy
`fd47c2e7` → pipeline verte (`VPS_DEPLOY_OK`, `health` + `smoke` OK).

## Preuves navigateur (fraîches — cf. skill)
- Flux du jour vide à 23h35 (API `n=0`) → preuve via **jour suivant**.
- Clic ligne → dialog ✓, heatmap ✓ : 55 cellules scores + 10 marges
  (+3 section Correct Score existante = 58 comptées), xG `1.34`.
- 0 erreur page. 1× `503 /api/football/matches/[id]/stats` : fetch lazy
  best-effort du dialog (comportement préexistant, dialog intact).

## Gates
- `bun test besoccer-matrix` : 4 pass (RED préalable).
- `bun run lint` : 0 erreur. `bun run typecheck` : 0 erreur.
- `bunx prisma validate` : schéma valide, 0 migration.
- `graphify update .` : graphe régénéré.
