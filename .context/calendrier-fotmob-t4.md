# T4 — QA + gates + release (`3c169827`)

## Gates locales (avant commit)
- `bun run lint` : 0 erreur (3 warnings préexistants).
- `bun run typecheck` : 0 erreur.
- `bunx prisma validate` : schéma valide (T2/T3).

## Deploy VPS
- Pipeline `deploy-v2.sh` (SKIP_TESTS=1) : `VPS_DEPLOY_OK`,
  `build_ran: 1`, tag `deploy-20260908-211524`,
  `health: legacy=OK next.js=OK`, `smoke: OK`.

## Probe Playwright prod (`/?sport=football`, Chromium headless)
- Carte « Calendrier des matchs » : 5 ligues, cartes `#ffffff`, headers `#f5f5f5`.
- 41 matchs, 41 étoiles Suivre (`aria-label`), minute+score live
  (ex. `Dartford | 33 | 1 - 0 | 33’ | Westfield`).
- `Aucun match top disponible` : disparu. 0 requête échouée, 0 erreur page.

## Livrés
`fotmob-calendar-table.tsx` (nouveau), `top-multi-sport.tsx` (branche foot),
`COMPONENTS.md`, `.context/calendrier-fotmob-t{1,2b,3}.md`.
