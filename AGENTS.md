# Agent Instructions

This project uses **bd** (beads) for issue tracking. Run `bd prime` for full workflow context.

## Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work atomically
bd close <id>         # Complete work
bd dolt push          # Push beads data to remote
```

## Non-Interactive Shell Commands

**ALWAYS use non-interactive flags** with file operations to avoid hanging on confirmation prompts.

Shell commands like `cp`, `mv`, and `rm` may be aliased to include `-i` (interactive) mode on some systems, causing the agent to hang indefinitely waiting for y/n input.

**Use these forms instead:**
```bash
# Force overwrite without prompting
cp -f source dest           # NOT: cp source dest
mv -f source dest           # NOT: mv source dest
rm -f file                  # NOT: rm file

# For recursive operations
rm -rf directory            # NOT: rm -r directory
cp -rf source dest          # NOT: cp -r source dest
```

**Other commands that may prompt:**
- `scp` - use `-o BatchMode=yes` for non-interactive
- `ssh` - use `-o BatchMode=yes` to fail instead of prompting
- `apt-get` - use `-y` flag
- `brew` - use `HOMEBREW_NO_AUTO_UPDATE=1` env var

## Project: PariScore

**Zero-dependency Node.js backend.** No package.json — uses only Node.js native modules + `better-sqlite3` (C++ addon). DO NOT run `npm install` or add npm packages.

### Startup
```bash
node server.js    # Port 3000, requires .env with API keys
```
.env must contain at minimum: `API_FOOTBALL_KEY`, `ODDS_API_KEY`, `GEMINI_API_KEY`.

### Architecture
- **`server.js`** (7578 lines) — monolithic backend: HTTP server, SQLite, data fusion, all API routes
- **`pariscore.html`** (8507 lines) — single-page frontend, no framework, vanilla JS
- **`admin.html`** — admin dashboard
- **Database**: `better-sqlite3` → `pariscore.db` (single-file SQLite, WAL mode)

### Code Conventions
- French comments, camelCase identifiers, ES5 `require()` (not ES modules)
- Server API routes: `GET/POST /api/v1/...`
- Frontend fetches from `/api/v1/...`
- Async pattern: `(async () => { ... })().catch(err => ...)` — never bare `await` at top level
- **CRITICAL**: `STRATEGIES` object in server.js and `STRATEGIES_UI` array in pariscore.html must stay in sync

### Quality & Testing
- **No test suite, no linter, no typecheck.** Ad-hoc scripts only: `test-integrity.js`, `fix-matches.js`, `compare-apis.js`
- **No build step.** `node server.js` is the only command.
- **Manual verification**: start server, open `http://localhost:3000`, check browser console

### Project-Specific Skills
Available locally — use via `skill` tool for guided workflows:
- `ps-add-strategy` — scaffold a new betting strategy
- `ps-audit` — full project state audit
- `ps-changelog` — update CHANGELOG.md after feature completion
- `ps-deploy` — Render.com deployment checklist
- `ps-test` — QA audit of a module

### Context & History
- **`CLAUDE.md`** — full roadmap, version history (v9.7 current), persona as "CTO & Lead Data Scientist"
- **`CHANGELOG.md`** — detailed change log by version
- **`render.yaml`** — Render.com Blueprint deploy config
- **`.context/`** — audit reports, test reports, strategy docs

### Deployment
Render.com via `render.yaml` — detects automatically. Health check: `/api/v1/status`.
Disk mount: `/app/data` for persistent SQLite DB.
Required env vars listed in render.yaml.

### Secrets
- `.env` contains live API keys — **NEVER commit**
- Git already ignores `.env`, `*.db`, `*.log`

## gstack — Orchestration & Review

[gstack](https://github.com/garrytan/gstack) v1.57.9 is installed at `~/.claude/skills/gstack`.

### Available Slash Commands

**Plan-mode reviews:**
- `/gstack-office-hours` — Reframe product idea before writing code
- `/gstack-plan-ceo-review` — CEO-level: find the 10-star product, challenge scope
- `/gstack-plan-eng-review` — Lock architecture, data flow, edge cases
- `/gstack-plan-design-review` — Design dimension scoring 0-10
- `/gstack-plan-devex-review` — Developer experience audit
- `/gstack-autoplan` — Full pipeline: CEO → Design → Eng → DX (auto-decisions)
- `/gstack-design-consultation` — Build complete design system from scratch
- `/gstack-spec` — Turn vague intent into executable spec + GitHub issue

**Implementation + review:**
- `/gstack-review` — Pre-landing PR review (finds CI-passing prod-breakers)
- `/gstack-investigate` — Systematic root-cause debugging
- `/gstack-design-review` — Live-site visual audit + fix loop
- `/gstack-design-shotgun` — Generate AI design variants, compare, iterate
- `/gstack-qa` — Open real browser, find bugs, fix, re-verify
- `/gstack-qa-only` — Report-only QA (no code changes)

**Release + deploy:**
- `/gstack-ship` — Run tests, review, push, create PR
- `/gstack-land-and-deploy` — Merge PR, wait for CI/deploy, verify production
- `/gstack-canary` — Post-deploy monitoring
- `/gstack-document-release` — Update docs to match what shipped
- `/gstack-document-generate` — Generate Diataxis docs from code
- `/gstack-setup-deploy` — Detect & configure deploy platform

**Safety + memory:**
- `/gstack-careful` — Warn before destructive commands
- `/gstack-freeze` — Lock edits to one directory
- `/gstack-context-save` — Save working context (git state, decisions)
- `/gstack-context-restore` — Resume saved context across sessions
- `/gstack-learn` — Manage cross-session learnings
- `/gstack-retro` — Weekly engineering retrospective
- `/gstack-cso` — OWASP + STRIDE security audit
- `/gstack-health` — Code quality dashboard

### Skill Routing (for /gstack-autoplan)
- **Strategy/scope decisions** → `/gstack-plan-ceo-review`
- **Architecture/edge cases/testing** → `/gstack-plan-eng-review`
- **UI/UX/design direction** → `/gstack-plan-design-review` or `/gstack-design-consultation`
- **Developer experience** → `/gstack-plan-devex-review` or `/gstack-devex-review`
- **Full review pipeline** → `/gstack-autoplan`
- **Pre-merge quality gate** → `/gstack-review` + `/gstack-qa`
- **Bug/regression** → `/gstack-investigate`
- **Deploy** → `/gstack-ship` + `/gstack-land-and-deploy`

### Web Browsing
ALWAYS use the `/gstack-browse` skill for web browsing. NEVER use `mcp__claude-in-chrome__*` tools.

<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:ca08a54f -->
## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files

## Session Completion

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   bd dolt push
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds
<!-- END BEADS INTEGRATION -->

## MCP Servers — Capacités Disponibles

Ce projet utilise **7 serveurs MCP** configurés dans `.mcp.json`. Les clients MCP (opencode, Claude Code, Cline) les chargent automatiquement au démarrage.

### Serveurs Installés

| Serveur | Technologie | Utilité |
|---------|-------------|---------|
| `project_fs` | `npx @modelcontextprotocol/server-filesystem` | Navigation, lecture, écriture fichiers dans le projet |
| `memory` | `npx @modelcontextprotocol/server-memory` | **Knowledge Graph persistant** — mémoire entre sessions |
| `git` | `uvx mcp-server-git` | Opérations git structurées (status, log, diff, commit) |
| `bzzoiro-sports` | HTTP MCP (externe) | Données sportives via API |
| `sportdbdotdev` | HTTP MCP (externe) | SportDB |
| `sportradar` | MCP Remote via RapidAPI | Sportradar |
| `playwright` | `npx @playwright/mcp` (Microsoft) | **Automatisation navigateur** — E2E visuel, screenshots, scraping fallback, extraction DOM |

### 🧠 Memory Server — Guide d'Utilisation

Le serveur `memory` est un **Knowledge Graph** qui persiste les données entre sessions. Il expose 8 outils :

- `create_entities` / `create_relations` — Stocker des connaissances
- `search_nodes(query)` — Rechercher dans le graphe
- `add_observations` — Enrichir une entité existante
- `read_graph` / `open_nodes` — Explorer le graphe
- `delete_*` — Nettoyer

**Cas d'usage concrets pour PariScore :**
- Stocker les décisions d'architecture (pourquoi tel pattern, telle API)
- Mémoriser les bugs récurrents et leurs corrections
- Enregistrer les analyses de stratégies de paris
- Garder trace des schémas de données API-football / Odds API
- Documenter les dépendances entre modules

**Bonnes pratiques :**
- Utiliser `search_nodes` au début d'une session pour restaurer le contexte
- Créer une entité `pariscore-architecture` avec les observations sur l'architecture
- Créer des entités par domaine : `api-football`, `odds-api`, `strategies`, `bugs`, `decisions`
- Utiliser `create_relations` pour lier les entités entre elles

### 🔧 Git Server — Opérations Structurées

Alternative plus robuste aux appels shell `git`. Outils disponibles :
- `git_status`, `git_log`, `git_diff` — Lecture
- `git_commit` — Écriture (commits structurés)
- `git_branch`, `git_checkout` — Navigation branches

### 📁 Filesystem Server — Navigation Fichiers

Remplace les appels shell pour la lecture/écriture de fichiers. Racine autorisée : la racine du projet.

### Vérification

Pour tester qu'un serveur répond :
```bash
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}' | npx -y @modelcontextprotocol/server-memory
# ou pour git :
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}' | uvx mcp-server-git --repository .
```
