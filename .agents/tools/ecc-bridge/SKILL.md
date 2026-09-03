# ECC Bridge (Cline — instruction-only)

ECC (affaan-m/ECC) n'a **pas d'adapter Cline** : pas de hooks, pas de délégation.
On en reprend la philosophie en mode instruction-only (même niveau que le support
GitHub Copilot officiel d'ECC).

Source : `https://github.com/affaan-m/ECC` (MIT). Prompts : `.github/prompts/`.

## Boucle à appliquer

```text
plan -> test -> implement -> review -> verify -> remember -> improve
```

1. **Research d'abord** : lire le code (search/read) avant toute réponse ou edit.
2. **Plan** : `.github/prompts/plan.prompt.md` pour >3 steps, pas de code avant approbation.
3. **TDD** : `.github/prompts/tdd.prompt.md` (RED-GREEN-REFACTOR).
4. **Review** : `.github/prompts/security-review.prompt.md` après chaque modif.
5. **Verify** : `bun run lint` + `bun run typecheck` avant de clamer fini.
6. **Remember** : apprentissages durables → `bd remember`.

## Conventions PariScore (rappel, prioritaires sur ECC)

- CMD uniquement (jamais bash), `bun` pour les scripts, commentaires en français.
- TypeScript strict, pas de `any`, Conventional Commits, 1 feature par commit.
- Ne jamais committer `.env`, `*.db`, `*.log`.
- Scan sécu sans install : `npx -y ecc-agentshield@1.4.0 scan` (ou `bun run ecc:scan`).
- Skills : `.agents/tools/` = source unique ; `.cline/skills/` = junctions uniquement.
