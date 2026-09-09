# SESSION-2026-09-09 — Deploy pipeline agent-friendly

## Contexte
Suite de SESSION-2026-09-09-CAL-FILTRES-H : deploy VPS bloqué par (1) typecheck strict VPS sur test bun sans import explicite (TS2593 → build fail → deploy abort, VPS resté sur ancien build sans casse), (2) runner Cline : timeout 30s, pas d'exécution .bat fiable, CRLF.

## Root cause & fix principal
- `src/lib/__tests__/top10-calendar-link.test.ts` n'importait pas `{ describe, expect, test } from "bun:test"` → `next build` (typecheck VPS strict) échouait. Les autres tests du dossier importent explicitement. Fix 1 ligne → `9a643ba0`.
- Règle persistée via `bd remember` : tout `*.test.ts` sous `src/**` doit importer bun:test.

## Livraisons
- `9a643ba0` fix(test): import bun:test globals — typecheck strict next build VPS
- `f2312e47` feat(calendar): pastille header "★ Top N" du jour (V5, item P2/P3)
- `dc644f76` feat(deploy): `scripts/deploy-runner.ps1` (nouveau point d'entrée agent) + hardening `update_vps.sh`
  - deploy-runner.ps1 : preflight (branche main, divergence origin, tree sale), gates lint/typecheck/test, scp → `tr -d '\r'` → nohup → poll 10s jusqu'à `VPS_DEPLOY_OK` ou `ERR:` (toute ligne ERR: = échec), report tail 15, log transcript `logs/deploy-runner-*.log`. Modes : `-Quick`, `-NoCommit`, `-Message`, `-Script` (deploy-v2.sh possible), `-TimeoutSec`.
  - update_vps.sh : health check non-OK ⇒ `exit 1` (fini le `VPS_DEPLOY_OK` en trompe-l'œil) + dump `pm2 logs` ; restart pm2 legacy skippé si process absent ; timestamps début/fin build + `finished_at`.
- `191c4618` docs(agents): section Deployment AGENTS.md (usage agent vs humain, pièges)

## Validations
- bun test top10-calendar-link : 5/5. eslint top-multi-sport : vert. tsc --noEmit local : 0 erreur (sortie vide, finit <30s).
- Pipeline testé 3× sur VPS réel : idempotent (build_ran 0), full build (build_ran 1, health OK), legacy-only (build skipped, skip pm2 legacy, health OK, discord OK).
- Prod après deploy : `/` = 200, `/api/v1/status` = ok, `/api/football/calendar` + `/api/football/top5?limit=10` répondent (jointure id `bsd-*` ↔ brut gérée par normalisation).

## Beads & mémoire
- Bead `ParisScorebis-r5ew` (claim → close) : deploy pipeline agent-friendly + hardening update_vps.
- `bd remember` ×2 : usage deploy-runner.ps1 depuis agent ; règle import bun:test.

## État final
- VPS = `191c4618` = origin/main = local HEAD. pm2 pariscore-next online, health OK.
- Déprécié pour les agents : `deploy.bat` / `deploy-v2.bat` (réservés terminal humain).
