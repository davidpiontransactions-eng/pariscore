# ECC (affaan-m/ECC v2.2.0) — pont sélectif OpenCode

ECC est un plugin **beta, sans parité** avec Claude Code. On n'en prend qu'un sous-ensemble.
Source : `https://github.com/affaan-m/ECC` (MIT). Install locale isolée dans `.opencode/node_modules`
(gitignoré) : `cd .opencode && npm install --no-audit --no-fund ecc-universal@2.2.0`.
Référence plugin dans `opencode.json` (chemin relatif, pas de dép racine polluée).

## Boucle imposée (research-first)

```text
plan -> test -> implement -> review -> verify -> remember -> improve
```

1. **Research d'abord** : Grep/Glob/Read avant toute réponse ou edit (règle 9 AGENTS.md déjà alignée).
2. **Plan** : commande ECC `/plan` (agent `planner`, read-only) pour tout ce qui dépasse 3 steps.
3. **TDD** : `/tdd` (RED-GREEN-REFACTOR), coverage visée 80%+ sur le neuf.
4. **Review** : `/code-review` + `/security` après chaque modif (contexte frais).
5. **Verify** : `bun run lint` + `bun run typecheck` avant de clamer fini (règle 3 AGENTS.md).
6. **Remember** : apprentissages durables → `bd remember`, pas de MEMORY.md.

## Sous-ensemble ECC chargé

- Instructions : `coding-standards`, `tdd-workflow`, `security-review`, `strategic-compact`,
  `verification-loop` (via le plugin ; le reste du catalogue 286 skills reste OFF pour le contexte).
- Agents utiles : `planner`, `code-reviewer`, `security-reviewer`, `tdd-guide`, `build-error-resolver`.
- Hooks ECC mappés sur events OpenCode : `tool.execute.before/after`, `session.created/deleted`,
  `session.idle`, `file.edited`, `lsp.client.diagnostics`. En cas de double exécution avec
  `pariscore-superpowers`, ce dernier gagne (il est chargé en premier).

## Token budget (à respecter)

- Modèle par défaut léger ; passer au lourd seulement pour archi/debug profond.
- Compacter aux breakpoints (`/clear` entre tâches, `/compact` après milestone), jamais mid-implémentation.
- < 10 MCP actifs, < 80 tools. `ECC_CONTEXT_MONITOR_COST_WARNINGS=off` pour les abonnés.

## Sécurité (AgentShield, sans install)

```cmd
npx -y ecc-agentshield@1.4.0 scan
```

À lancer avant chaque commit touchant prompts, hooks, MCP, permissions, `.env`.
Ne jamais committer `.env`, `*.db`, `*.log` (déjà gitignorés).
