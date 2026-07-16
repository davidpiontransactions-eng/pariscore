# Agent Instructions

This project uses **bd** (beads) for issue tracking. Run `bd prime` for full workflow context.

## Session: XSS onclick template literals (2026-07-05)

**Scope**: ParisScorebis-bhpw — 20 unescaped `${}` interpolations inside `onclick="..."` in template literals in `pariscore.js`. Single-quote injection could break JS context and redirect to phishing.

**Pattern**: `onclick="openFunc('${m.id}')"` → `onclick="openFunc('${_jsStr(m.id)}')"`

**Functions sanitized**: `_jsStr()` escapes `'` → `&#39;`, `"` → `&quot;`, `\` → `\\\\`.

**Affected handlers** (20 locations): openLiveDetail, openInsights, openInsightsById, openRadarModal, showOddsGraph, openPowerScore, toggleFavorite, openBetminesModal, _slbDismiss, openBookmakerDeeplink, openCompDetail, openDeepAnalysis, insSetStatsMode, quickAddBet, _dhOpenReplay, goToMatch.

**Safe by design** (not user-controlled): s.key (STRATEGIES_UI/TENNIS_STRATEGIES_UI hardcoded), p.onclick (PLANS array hardcoded), glossaryTerms (hardcoded), b.id/t.id (numeric DB IDs), safeId/matchId (pre-escaped via _escTennis/_tnEsc).

## Session: Fix nested-ternary syntax error (2026-07-05)

**Root cause**: genuine JS syntax bug in `pariscore.html` — single-quoted string `'<div class="sc-decision-badge "+(isStrong?` was never closed before the `+` concatenation operator. The `'` in `?` (intended as `'strong'` delimiter) was consumed as the closing quote of the outer string, making `strong` an unexpected identifier.

**Fix** at `pariscore.html:25784`:
```diff
-+'<div class="sc-decision-badge "+(isStrong?'strong':...
++'<div class="sc-decision-badge "'+(isStrong?'strong':...
```
Verified: `node --check` passes on all inline scripts.

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

**Next.js 16 + Bun + React 19 + Prisma.** Full-stack TypeScript app. Legacy vanilla JS code (`server.js`, `pariscore.html`) being migrated to Next.js.

### Startup
```bash
bun install        # Install dependencies (bun.lock present)
bun run dev        # Dev server (next dev -p 3000)
bun run build      # Production build (next build + standalone output)
bun run start      # Production server (bun .next/standalone/server.js)
```
.env must contain at minimum: `API_FOOTBALL_KEY`, `ODDS_API_KEY`, `GEMINI_API_KEY`, `DATABASE_URL`, `NEXTAUTH_SECRET`.

### Architecture (Next.js 16 + Bun)
- **Runtime**: **Bun** (v1.3.14) — used in production (`bun run start`)
- **Framework**: **Next.js 16** (App Router, standalone output)
- **Frontend**: **React 19** + **TypeScript 5** + **shadcn/ui** (Radix UI) + **TailwindCSS 4**
- **State**: **Zustand** + **React Query** (TanStack) + **SWR**
- **Database**: **Prisma 6** (ORM) → SQLite/PostgreSQL via `DATABASE_URL`
- **Auth**: **NextAuth** (next-auth v4)
- **Validation**: **Zod 4**
- **i18n**: **next-intl**
- **Forms**: **react-hook-form** + **@hookform/resolvers**
- **Monitoring**: **Sentry** (`@sentry/nextjs`) + **PostHog**
- **Notifications**: **web-push** (PWA push) + **socket.io-client** (live)
- **Images**: **sharp** (optimization)
- **AI SDK**: **z-ai-web-dev-sdk**

### Legacy code (migrating)
- **`server.js`** — legacy monolithic backend (7578 lines, ES5, better-sqlite3). Being migrated to Next.js API routes.
- **`pariscore.html`** — legacy single-page frontend (8507 lines, vanilla JS). Being migrated to React/shadcn components.
- **`admin.html`** — legacy admin dashboard. Being migrated to Next.js app routes.
- Legacy code uses: ES5 `require()`, `(async () => { ... })().catch(err => ...)` pattern, `_jsStr()` for XSS prevention in onclick template literals.

### Code Conventions
- French comments, camelCase identifiers
- TypeScript strict mode, ES modules (`import/export`)
- Next.js API routes: `app/api/v1/.../route.ts`
- Legacy server API routes: `GET/POST /api/v1/...` (server.js, being deprecated)
- `bun:sqlite` available if needed (3-6x faster than better-sqlite3, no native addon)
- **CRITICAL**: `STRATEGIES` object must stay in sync between legacy server.js and new Next.js config

### Quality & Testing
- **TypeScript**: strict mode (`typescript: ^5`)
- **Linter**: ESLint 9 (`eslint-config-next`)
- **E2E tests**: Playwright (`@playwright/test`)
- **Types**: `bun-types` for Bun runtime APIs
- Commands: `bun run lint`, `bun run typecheck` (if configured)

### Project-Specific Skills
Available locally — use via `skill` tool for guided workflows:
- `ps-add-strategy` — scaffold a new betting strategy
- `ps-audit` — full project state audit
- `ps-changelog` — update CHANGELOG.md after feature completion
- `ps-deploy` — Render.com deployment checklist
- `ps-test` — QA audit of a module

### Multi-plateforme ZCode ↔ OpenCode (sync des skills)

Les deux agents partagent **une source unique de vérité** pour les skills :

```
.agents/tools/         ← source unique (145 skills, lue par ZCode)
        ↑
.opencode/skills/      ← junction Windows → .agents/tools/ (lue par OpenCode)
```

> **Note (2026-07-17)** : le dossier source était `.agents/skills/` et a été
> renommé en `.agents/tools/` (commit `51b7a8e`). La junction Windows a été
> recréée vers la nouvelle cible et le script de sync porté en Node.js.

- **Ajouter un skill** : le créer dans `.agents/tools/<nom>/SKILL.md`. Il devient
  immédiatement visible des deux côtés via la junction.
- **Synchroniser l'allowlist OpenCode** (étape nécessaire après ajout) :
  ```bash
  node scripts/sync-skills.js                # met à jour opencode.json
  node scripts/sync-skills.js --check        # vérifie seulement (exit 1 si désynchronisé)
  node scripts/sync-skills.js --verify-junction  # vérifie que la junction est active
  ```
  (`python scripts/sync-skills.py` reste supporté via un shim qui délègue à Node —
  utile sur les postes qui ont Python, mais le runtime officiel est Bun/Node.)
- **Sur un nouveau poste** : recréer la junction si manquante
  ```bash
  cmd //c "mklink /J C:\...\pariscore\.opencode\skills C:\...\pariscore\.agents\tools"
  ```
  Puis `node scripts/sync-skills.js`.

### Context & History
- **`CLAUDE.md`** — full roadmap, version history, persona as "CTO & Lead Data Scientist"
- **`CHANGELOG.md`** — detailed change log by version
- **`render.yaml`** — Render.com Blueprint deploy config
- **`.context/`** — audit reports, test reports, strategy docs

### Deployment
VPS (ubuntu@51.75.21.239) with Bun + pm2. Legacy also on Render.com via `render.yaml`.
Health check: `/api/v1/status`.

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

<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:6cd5cc61 -->
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

**Architecture in one line:** issues live in a local Dolt DB; sync uses `refs/dolt/data` on your git remote; `.beads/issues.jsonl` is a passive export. See https://github.com/gastownhall/beads/blob/main/docs/SYNC_CONCEPTS.md for details and anti-patterns.

## Agent Context Profiles

The managed Beads block is task-tracking guidance, not permission to override repository, user, or orchestrator instructions.

- **Conservative (default)**: Use `bd` for task tracking. Do not run git commits, git pushes, or Dolt remote sync unless explicitly asked. At handoff, report changed files, validation, and suggested next commands.
- **Minimal**: Keep tool instruction files as pointers to `bd prime`; use the same conservative git policy unless active instructions say otherwise.
- **Team-maintainer**: Only when the repository explicitly opts in, agents may close beads, run quality gates, commit, and push as part of session close. A current "do not commit" or "do not push" instruction still wins.

## Session Completion

This protocol applies when ending a Beads implementation workflow. It is subordinate to explicit user, repository, and orchestrator instructions.

1. **File issues for remaining work** - Create beads for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **Handle git/sync by active profile**:
   ```bash
   # Conservative/minimal/default: report status and proposed commands; wait for approval.
   git status

   # Team-maintainer opt-in only, unless current instructions forbid it:
   git pull --rebase
   git push
   git status
   ```
5. **Hand off** - Summarize changes, validation, issue status, and any blocked sync/commit/push step

**Critical rules:**
- Explicit user or orchestrator instructions override this Beads block.
- Do not commit or push without clear authority from the active profile or the current user request.
- If a required sync or push is blocked, stop and report the exact command and error.
<!-- END BEADS INTEGRATION -->

## MCP Servers — Capacités Disponibles

Ce projet utilise **11 serveurs MCP** configurés dans `.mcp.json`, plus **Langflow** (service web optionnel, MCP bidirectionnel via HTTP). Les clients MCP (opencode, Claude Code, Cline) les chargent automatiquement au démarrage.

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
| `frontendchecklist` | HTTP MCP (externe) | Audit frontend (accessibilité, perf, SEO) |
| `stitch` | `npx @_davideast/stitch-mcp` | Google Stitch — design → code (requiert Google Cloud) |
| `crawl4ai` | `python scripts/crawl4ai-mcp-server.py` | Scraping web via Crawl4AI (markdown, logos équipes) |
| `scrapling` | `scrapling mcp` (natif) | **Scraping adaptatif 3 modes** (statique/dynamique/stealth Camoufox) — bypass anti-bot sur sources autorisées. Skill `/scrapling`. |
| `scrapy` | `python scripts/scrapy-mcp-server.py` | **Framework de crawling massif** (spiders + pipelines + autothrottle). Skill `/scrapy`. |

### Service web IA (démarrage à la demande)

| Service | Technologie | Utilité |
|---------|-------------|---------|
| `langflow` | Service web isolé dans `.venv-langflow/` (port 7860) | **Plateforme visuelle d'agents IA** — builder drag-and-drop de flows RAG/multi-agents. MCP bidirectionnel (consomme scrapling/scrapy ET expose ses flows comme outils MCP). Démarrer : `node scripts/langflow-cli.js start`. Skill `/langflow`. |

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

<!-- BEGIN BEADS CODEX SETUP: generated by bd setup codex -->
## Beads Issue Tracker

Use Beads (`bd`) for durable task tracking in repositories that include it. Use the `beads` skill at `.agents/tools/beads/SKILL.md` (project install) or `~/.agents/skills/beads/SKILL.md` (global install) for Beads workflow guidance, then use the `bd` CLI for issue operations.

### Quick Reference

```bash
bd ready                # Find available work
bd show <id>            # View issue details
bd update <id> --claim  # Claim work
bd close <id>           # Complete work
bd prime                # Refresh Beads context
```

### Rules

- Use `bd` for all task tracking; do not create markdown TODO lists.
- Run `bd prime` when Beads context is missing or stale. Codex 0.129.0+ can load Beads context automatically through native hooks; use `/hooks` to inspect or toggle them.
- Keep persistent project memory in Beads via `bd remember`; do not create ad hoc memory files.

**Architecture in one line:** issues live in a local Dolt DB; sync uses `refs/dolt/data` on your git remote; `.beads/issues.jsonl` is a passive export. See https://github.com/gastownhall/beads/blob/main/docs/SYNC_CONCEPTS.md for details and anti-patterns.
<!-- END BEADS CODEX SETUP -->

## Stitch Design Skills — Installé

14 skills Google Stitch installés dans `.opencode/skills/stitch-*`. Nécessite Stitch MCP server (configuré dans `.mcp.json`) et un projet Google Cloud avec Stitch API activée.

### Plugins disponibles

| Plugin | Skills | Utilité |
|--------|--------|---------|
| **stitch-design** | generate, code-to-design, manage-system, extract-md, extract-html, upload | Design → code workflow |
| **stitch-build** | react, react-native, remotion, shadcn-ui | Génération de code depuis les designs |
| **stitch-utilities** | design-md, enhance-prompt, loop, taste-design | Utilitaires design |

### Quick start
```
# Activer un skill Stitch via l'agent
skill load stitch-design-generate
skill load stitch-build-react
skill load stitch-utils-loop
```

### Prérequis
1. Google Cloud Project avec billing activé
2. `gcloud auth application-default login`
3. `gcloud beta services mcp enable stitch.googleapis.com`
4. Définir `GOOGLE_CLOUD_PROJECT` dans `.env`

### Structure installée
```
.opencode/skills/
  stitch-design-*/          # 6 skills design
  stitch-build-*/           # 4 skills build
  stitch-utils-*/           # 4 skills utilities
.opencode/plugins/stitch-skills/  # Source originale (référence)
.stitch/                    # Workspace Stitch (screens, metadata)
```

### Patterns clés importés de Google Stitch Skills
- **GATE-based quality** : phases avec conditions explicites avant progression
- **Baton-passing** : `.stitch/next-prompt.md` pour chaîner des générations
- **Prompt Enhancement Pipeline** : transformation d'idées vagues en prompts structurés
- **allowed-tools scoping** : permissions granulaires par skill

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

When the user types `/graphify`, use the installed graphify skill or instructions before doing anything else.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
