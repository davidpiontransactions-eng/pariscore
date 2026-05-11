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
