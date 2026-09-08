# P4 — QA + gates + release (`6b93bb26`)

## Gates locales (avant commit)
- `bun run lint` : 0 erreur (3 warnings préexistants unrelated).
- `bun run typecheck` : 0 erreur.
- `bunx prisma validate` : schéma valide (rappel P0-P3).

## Deploy VPS
- Pipeline `deploy-v2.sh` (SKIP_TESTS=1, gate Playwright VPS toujours
  ciblée port 3005 — fixée au commit `6d618eab`, pas encore rejouée sans skip) :
  `VPS_DEPLOY_OK`, `build_ran: 1`, tag `deploy-20260908-204442`,
  `health: legacy=OK next.js=OK`, `smoke: OK`.

## Probe Playwright prod (`/calendrier-foot`, Chromium headless)
- 5 ligues, 42 boutons `aria-label="Suivre"`, badges `13/25`, `5/6`, `4/5…`
  (format live `x/y` OK), 24 cellules minute (`66’`), collapse + `Tout masquer`
  (`aria-expanded`) présents, 0 erreur page.
- Interaction : clic `Tout masquer` → libellé `Tout afficher`, lignes repliées.
- `loadMs=12587` (domcontentloaded + 9 s hydratation/SWR).

## Fichiers livrés (commit `6b93bb26`)
`football-calendar.tsx` (P0-P2), `layout.tsx` P3 (preconnect),
`.context/calendrier-fotmob-p{0,1,2,3}.md`.
