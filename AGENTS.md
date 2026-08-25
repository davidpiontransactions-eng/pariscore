# Agent Instructions

This project uses **bd** (beads) for issue tracking. Run `bd prime` for full workflow context.

**Communication style: announce once, act silently, summarize at the end.**
Do NOT narrate each step (*"Let me check…"*, *"Now I'll…"*, *"The X returned Y, so…"*).
State intent in one short line, run your tool calls, then give a tight result summary.
Full rules in [`.opencode/instructions/communication.md`](./.opencode/instructions/communication.md).

## Tone & Verbosity

Concise by default. Match detail to task complexity.
- **Simple question** → 1-3 sentences. `user: what is 2+2?` → `4`
- **Task completion** → Brief confirmation, no explanation of what you did
- **Complex task** → More detail, but still focused
- **NEVER** add preamble (*"Here is..."*, *"Based on..."*) or postamble (*"In summary..."*)
- Output on CLI = monospace markdown. Keep responses short.

## Proactiveness

Balance between doing the right thing and not surprising the user.
- **DO**: Take follow-up actions when asked, fix obvious issues found during tasks
- **DO NOT**: Run destructive commands, modify files outside scope, or make architectural decisions without asking
- If unsure whether to act → **ask first**
- If the user asks "how to approach X" → answer the question, don't immediately start implementing

## Tool Usage Policies

- **File search** → Use `Grep`/`Glob`, NOT bash `find`/`ls`
- **Read files** → Use `Read`, NOT bash `cat`/`head`/`tail`
- **Edit files** → Use `Edit`, NOT bash `sed`/`awk`
- **Write files** → Use `Write`, NOT bash `echo`/`cat <<EOF`
- **Run commands** → Use `Bash` only for actual terminal operations (git, npm, docker)
- **Batch parallel calls** → Single message with multiple tool calls when independent
- **Never** use bash to communicate with the user (no `echo` for explanations)

## Code References

When referencing code, use `file_path:line_number` format:
```
The auth check is in src/middleware.ts:42
```
This allows direct navigation. Include line numbers for functions, classes, and key logic.

## Research First

Never guess or make up an answer. Before answering or editing:
1. **Search the codebase** — use Grep/Glob to find relevant files
2. **Read the context** — understand surrounding code before modifying
3. **Verify** — run linter/typecheck after changes if available
- You do NOT need user permission to research the codebase
- Proactively search when task requires understanding existing code

## Security Boundaries

- **ALLOWED**: Security analysis, detection rules, vulnerability explanations, defensive tools, security documentation
- **REFUSED**: Credential discovery/harvesting, bulk crawling for SSH keys/cookies/wallets, malicious code
- **NEVER commit** secrets, API keys, or credentials to the repository
- `.env` contains live keys — treat as confidential, never log or expose

## Hard Rules

**Tradeoff:** Ces règles favorisent la qualité et la sécurité sur la vitesse. Pour les tâches triviales, utiliser son jugement.

Non-negotiable rules enforced automatically. Violations block PRs/commits.

1. **NEVER commit secrets** — `.env` contains live API keys (API_FOOTBALL_KEY, ODDS_API_KEY, GEMINI_API_KEY, NEXTAUTH_SECRET). Never log, expose, or commit. Treat as confidential.
2. **NEVER use bash for file operations** — Use `Read`/`Edit`/`Write` tools. Bash only for terminal ops (git, npm, docker, bun).
3. **ALWAYS run quality gates after code changes** — `bun run lint` + `bun run typecheck` before claiming done.
4. **Conventional commits** — `feat(scope): description` ≤72 chars. Examples: `feat(api): add odds endpoint`, `fix(scraper): handle 403 WAF`.
5. **One feature per commit** — Don't batch unrelated changes. Each commit = one logical unit.
6. **TypeScript strict mode** — No `any` types. Proper typing required. Use `unknown` if type is truly unknown.
7. **French comments** — Code comments in French for consistency with existing codebase.
8. **NEVER use bash `echo` to communicate** — Output text directly. Bash is for commands, not conversation.
9. **Research before answering** — Search codebase first (Grep/Glob), read context, then answer. Never guess.
10. **Component names** — Consult `COMPONENTS.md` FIRST. The #1 cause of agent loops: inventing component names that don't exist.
11. **Simplicity First** — Code minimum qui résolt le problème. Pas de features spéculatives. Test : "Un ingénieur senior dirait que c'est overcomplicated?" → Simplifier.
12. **Surgical Changes** — Toucher uniquement ce qui est nécessaire. Chaque ligne modifiée doit être traçable à la demande utilisateur. Ne pas améliorer le code adjacent.
13. **Goal-Driven Execution** — Transformer les tâches en objectifs vérifiables. Format : `1. [Step] → verify: [check]`
14. **Le Ladder** — Avant d'écrire du code, vérifier chaque échelon : (1) Nécessaire? → (2) Existe déjà? → (3) Stdlib le fait? → (4) Native le fait? → (5) Dep installée? → (6) Une ligne? → (7) Seulement alors: code minimum.
15. **Root Cause Rule** — Bug fix = root cause, pas symptôme. Grep tous les appelants de la fonction touchée, corriger la fonction partagée une seule fois.
16. **Complexity Tags** — Lors des reviews, tagger la sur-complexité : `delete:` (code mort), `stdlib:` (utiliser stdlib), `native:` (utiliser plateforme), `yagni:` (abstraction inutile), `shrink:` (moins de lignes).

### Le Ladder (avant d'écrire du code)

```
1. Nécessaire?      → Est-ce que l'utilisateur a vraiment demandé ça?
2. Existe déjà?     → Grep/Glob dans le codebase
3. Stdlib le fait?  → Utiliser les fonctions natives
4. Native le fait?  → CSS > JS, HTML > lib, DB constraint > app code
5. Dep installée?   → Utiliser ce qui est déjà dans package.json
6. Une ligne?        → Si possible, le faire en une ligne
7. Code minimum     → Seulement alors, écrire le strict nécessaire
```

### Tags de Sur-Complexité (code review)

| Tag | Signification | Action |
|-----|---------------|--------|
| `delete:` | Code mort, flexibilité inutile, feature spéculative | Supprimer |
| `stdlib:` | Chose faite à la main que la stdlib fournit | Utiliser stdlib |
| `native:` | Dépendance faisant ce que la plateforme fait déjà | Utiliser plateforme |
| `yagni:` | Abstraction à une seule implémentation | Inline jusqu'à 2ème usage |
| `shrink:` | Même logique, moins de lignes | Réécrire plus court |

Format : `L<line>: <tag> <what>. <replacement>.`

### Exemples (patterns à éviter vs bonnes pratiques)

**❌ Over-engineering (à éviter)**
```python
# 100 lignes pour un simple calcul
class DiscountStrategy(ABC):
    @abstractmethod
    def calculate(self, amount: float) -> float:
        pass
# ... 30+ lignes de setup complexe
```

**✅ Simple (à faire)**
```python
def calculate_discount(amount: float, percent: float) -> float:
    return amount * (percent / 100)
```

**❌ Drive-by refactoring (à éviter)**
```diff
- def validate_user(user_data):
-     if not user_data.get('email'):
+ def validate_user(user_data: dict) -> bool:  # type hint nobody asked for
+     """Validate user data."""  # docstring nobody asked for
+     email = user_data.get('email', '').strip()  # "improved" beyond bug fix
+     if not email:
```

**✅ Surgical change (à faire)**
```diff
  def validate_user(user_data):
-     if not user_data.get('email'):
+     email = user_data.get('email', '')
+     if not email or not email.strip():
          raise ValueError("Email required")
```

### Anti-Patterns (erreurs courantes des LLMs)

1. **Assumptions silencieuses** — Demander au lieu de deviner
2. **Over-engineering** — Code simple > code "élégant"
3. **Drive-by refactoring** — Ne pas améliorer le code adjacent
4. **Style drift** — Matcher le style existant
5. **Speculative features** — Ne pas ajouter de features non demandées

## Automation Contract

Clear separation between what CI/automation handles vs what humans handle.

### Automated (do NOT touch in PR)

| Surface | Tool | Trigger |
|---------|------|---------|
| Linting | `bun run lint` | On commit (if pre-commit hook) |
| Type check | `bun run typecheck` | On commit (if pre-commit hook) |
| Build | `next build` | On push to main |
| Deployment | `deploy.bat` → VPS | Manual trigger |
| Database | `bunx prisma migrate` | On schema change |
| Cron Jobs | pm2 + FlareSolverr | Daily 04:30 UTC |
| APK Build | `bun run mobile:apk` | Manual trigger |
| QA APK | `scripts/mobile-qa.ps1` | After APK build |
| Beads sync | `bd dolt push` | On session close |

### You handle

| Surface | When |
|---------|------|
| Feature implementation | New feature requests (bd issues) |
| Bug fixes | Issue reports (bd issues) |
| Documentation | README, CHANGELOG, AGENTS.md updates |
| Manual QA | UI changes, mobile builds |
| Secrets | Add to `.env` locally, NEVER commit |
| Component names | Check `COMPONENTS.md` before referencing |

### Engineering Loop (traceability)

```
bd ready → bd show <id> → bd update <id> --claim
    ↓
1. [Research] Grep/Glob/Read → verify: context understood
    ↓
2. [Implement] Edit/Write → verify: code compiles
    ↓
3. [Quality] lint + typecheck → verify: 0 errors
    ↓
4. [Close] bd close <id> → bd dolt push → verify: bead closed
```

**Traceability**: Every task tracked via bd beads. State persists across sessions.
**Verify**: Each step must pass its check before proceeding.

## Workflow Presets

Configurations prédéfinies pour les workflows courants. Chaque preset inclut les étapes et vérifications.

### Scraping Pipeline

```
1. [Research] → verify: robots.txt + ToS analysés
2. [Scrape] → verify: données extraites (status 200)
3. [Transform] → verify: schéma validé
4. [Store] → verify: DB mise à jour
5. [Notify] → verify: webhook envoyé
```

**Outils**: `scrapling` (3 modes), `scrapy` (massif), `crawl4ai`
**Pièges**: WAF Cloudflare, rate limiting, données sous licence

### Betting Analysis

```
1. [Fetch Odds] → verify: cotes reçues (ESPN/Polymarket)
2. [De-vig] → verify: probabilités justes calculées
3. [Edge Detection] → verify: edge > 0 identifié
4. [Kelly Criterion] → verify: mise optimale calculée
5. [Recommendation] → verify: recommandation générée
```

**Outils**: `betting` skill, `football-data`, `polymarket`
**Format**: `edge: X%, kelly: Y%, recommendation: Z`

### Mobile Build (Capacitor)

```
1. [Assets] → verify: icônes/splash générés
2. [Sync] → verify: capacitor sync OK
3. [Debug Build] → verify: APK debug créé
4. [Release Build] → verify: APK release signé
5. [QA] → verify: 18/18 tests passés
```

**Outils**: `bun run mobile:apk`, `scripts/mobile-qa.ps1`
**Pièges**: JDK 21 obligatoire, PowerShell ASCII-only

### Feature Implementation

```
1. [Claim] → verify: bd bead claimed
2. [Research] → verify: contexte compris (Grep/Glob/Read)
3. [Plan] → verify: objectifs vérifiables définis
4. [Implement] → verify: code compile
5. [Quality] → verify: lint + typecheck 0 errors
6. [Test] → verify: tests passent
7. [Close] → verify: bead closed + pushed
```

**Outils**: `bd`, `bun run lint`, `bun run typecheck`

### Bug Fix

```
1. [Reproduce] → verify: bug reproduit
2. [Root Cause] → verify: cause trouvée (Grep callers)
3. [Fix] → verify: test reproduit le bug échoue
4. [Verify] → verify: test passe après fix
5. [Close] → verify: bead closed
```

**Règle**: Root cause, pas symptôme. Corriger la fonction partagée une seule fois.

## Git Workflow

### Trunk-Based Development

Pariscore utilise le **trunk-based development** : `main` est toujours en état de release.

- **Pas de develop branch** — `main` est la branche unique
- **Branches courtes-lived** : `feat/...`, `fix/...`, `chore/...`
- **PR contre `main`** — squash-merge avec Conventional Commits
- **Hotfix** : brancher du tag stable, fixer, forward-port vers main

### Branch Naming

```
feat/betting-edge-detection
fix/scraping-waf-bypass
docs/update-readme
chore/deps-update
```

### PR Requirements

1. **Référence l'issue bd** — lien vers l'issue fixée
2. **PR focalisée** — un feature ou fix par PR
3. **Screenshot pour UI** — inclure un screenshot dans la description
4. **Quality gates** — lint + typecheck avant ouverture
5. **Title = Conventional Commits** — `type(scope): description`

### Conventional Commits

```
feat(betting): add Kelly criterion calculator
fix(scraping): handle Cloudflare 403 challenge
docs(readme): update installation steps
```

### Deploy

- **Tag stable** → production (`deploy.bat`)
- **Tag prerelease** → canary (testing)
- **Jamais auto-deploy depuis main** — les tags contrôlent le deploy

## Dependencies

Explicit allowlist. Stdlib-first. No new deps without approval.

### Runtime Dependencies (package.json)

| Category | Allowed | Notes |
|----------|---------|-------|
| **Framework** | next, react, react-dom | Next.js 16 + React 19 |
| **Runtime** | bun | Production runtime |
| **ORM** | prisma, @prisma/client | Database access |
| **Auth** | next-auth | Authentication |
| **UI** | @radix-ui/*, tailwindcss, shadcn/ui | Component library |
| **State** | zustand, swr, @tanstack/react-query | State management |
| **Validation** | zod | Schema validation |
| **Forms** | react-hook-form, @hookform/resolvers | Form handling |
| **i18n** | next-intl | Internationalization |
| **Monitoring** | @sentry/nextjs, posthog-js | Error tracking + analytics |
| **DB** | better-sqlite3, bun:sqlite | Local SQLite (legacy) |
| **HTTP** | node:https (NOT undici fetch) | Scraping (WAF bypass) |
| **Mobile** | @capacitor/core, @capacitor/cli | Android APK |
| **AI** | @google/genai, z-ai-web-dev-sdk | AI features |

### Build/Dev Dependencies

| Category | Allowed |
|----------|---------|
| **Types** | @types/node, @types/react, @types/bun |
| **Lint** | eslint, eslint-config-next |
| **Testing** | @playwright/test, vitest |
| **Build** | typescript, postcss, tailwindcss |

### Prohibited

- ❌ `axios` — Use `node:https` or `fetch` (native)
- ❌ `moment` — Use `date-fns` or native `Date`
- ❌ `lodash` — Use native JS methods or `es-toolkit`
- ❌ `express` — Use Next.js API routes
- ❌ `mysql2`/`pg` — Use Prisma ORM
- ❌ Any未经审计的npm包 — Security review required

### Adding New Dependencies

1. Check if native/API already solves the problem
2. Check existing deps for similar functionality
3. If needed: justify in PR description
4. Run `bun install` and verify no conflicts
5. Update this section if approved

## Context Engineering (Prompt Engineering Guide)

Based on [dair-ai/Prompt-Engineering-Guide](https://github.com/dair-ai/Prompt-Engineering-Guide) patterns.
Full reference: `.opencode/instructions/prompt-engineering.md`

### Layered Context Architecture
1. **System Layer** → Core identity and capabilities (AGENTS.md, CLAUDE.md)
2. **Task Layer** → Specific instructions for current task (user request)
3. **Tool Layer** → Descriptions and usage guidelines (skills, MCP servers)
4. **Memory Layer** → Historical context (bd beads, session history)

### Instruction Design Rules
- **Start Simple** → Iterate, don't over-engineer prompts upfront
- **Be Specific** → "Extract 3 bullet points from this file" > "Summarize this"
- **Avoid Impreciseness** → "Use 2-3 sentences" > "Keep it short"
- **Focus on TO DO** → "Return JSON with keys: name, status" > "Don't return plain text"

### Expectations Framework
- **Required vs Optional** → Explicitly state what MUST happen
- **Quality Standards** → Define what "good" looks like
- **Output Format** → Specify exact format (JSON, markdown, code block)
- **Decision Criteria** → When to use tool A vs tool B

### Observability
- Log decisions and reasoning in session context
- Track state changes (bd beads for persistent, todo for session)
- Record tool calls and outcomes for debugging
- Capture errors and edge cases for iteration

## Session: Stats Ligues OddAlerts (2026-08-23)

**Scope**: Réplique des pages ligues oddalerts.com sur Pariscore pour **1582 championnats** (197 pays) — scraping quotidien → table SQLite `league_season_stats` dans pariscore.db → API Next + pages `/ligues`.

**Fichiers clés**: `scripts/scrape-oddalerts.js` (scraper Node zéro-dép, https module **obligatoire** — undici `fetch` reçoit 403 WAF), `src/lib/leagues-stats/{types,db}.ts` (lecture readonly better-sqlite3), `src/app/api/v1/leagues-stats/` (index + `[country]/[slug]`), `src/app/ligues/` (index recherche+pays, détail replica OddAlerts FR), composants `league-stat-grid`/`league-fixtures-list`, modèle Prisma `LeagueSeasonStats` (DDL réel créé par le scraper via CREATE TABLE IF NOT EXISTS).

**Cron VPS**: pm2 `pariscore-cron-oddalerts` (`30 4 * * *`), skip-cache <20h, `--force` pour re-scrape complet. Run local : `node scripts/scrape-oddalerts.js [--country=x|--only=c/s|--limit=n|--dry-run]`. Pass local ≈2 min ; pass VPS via FlareSolverr ≈15-25 min.

**Pièges**: (1) WAF OddAlerts = **Cloudflare challenge "Just a moment"** sur IP datacenter — en local le module `https` Node passe, mais sur le VPS TOUT doit passer par **FlareSolverr** (conteneur Docker déjà présent sur le VPS, port 8191) : cf_clearance est lié à la fingerprint TLS du navigateur, inutile depuis Node → mode sessions réutilisées (`oddalerts-w{0..n}`, ~1s/page, FLARE_SESSIONS=2) ; (2) HTML renvoyé par Chrome resérialisé **guillemets doubles** (index `<a class='league-link'>` source simple-quote → parseur tolérant aux deux) ; (3) fixtures parfois sans cotes (div prices absente) ; (4) DB = pariscore.db racine (convention `DATABASE_PATH || cwd/pariscore.db` partagée avec server.js et tennis-stats), PAS la DB Prisma `prisma/dev.db`.

## Session: Rankings Home/Away Pipeline (2026-08-02)

**Scope**: Pipeline 100% gratuit de scraping soccerstats.com → classement Home/Away → JSON statiques servis via CDN Vercel.

**Fichiers clés** : `scripts/scrape_rankings.py` (production, 8 ligues), `scripts/team_name_mapping.py` (150+ overrides noms), `.github/workflows/refresh-rankings.yml` (CRON quotidien), `src/hooks/use-league-rankings.ts` (SWR CDN).

**Contexte complet** : `.context/session-rankings-pipeline.md`

**URL pattern** : `https://www.soccerstats.com/homeaway.asp?league={slug}` — 11 colonnes (rank,team,GP,W,D,L,GF,GA,GD,Pts,PPG), contexte "Home table" / "Away table".

**Ajouter une ligue** : ajouter URL dans `LEAGUES` (scrape_rankings.py), noms dans `TEAM_NAME_OVERRIDES` (team_name_mapping.py), tester avec `--league {slug}`.

**Métriques dispo** (8): PPG, Pts, GF, GA, GD, W, D, L. Shots/SOT/Attacks/Corners sur pages séparées.

## Session: Capacitor Android Engineering Loop (2026-08-07)

**Scope**: Engineering loop complète APK Android (debug + release signée) via **Capacitor 8**, mode remote WebView → `https://pariscore.fr` (l'export statique est impossible aujourd'hui : 55 route handlers + Prisma/better-sqlite3 ; audit complet + graphe Graphify dans `docs/mobile/MOBILE_AUDIT_GRAPHIFY.md`).

**Fichiers clés**: `capacitor.config.ts` (appId `fr.pariscore.app`), `scripts/mobile-build.ps1` (boucle 5 étapes assets→sync→debug→release→verify), `scripts/gen-mobile-assets.js` (icon 1024/splash 2732 depuis `public/icon-512.png`), `docs/mobile/` (audit + graphify-studio + SVG), `android/` = **jonction Windows → `E:\Android\Pariscore`** (C: saturé).

**Toolchain**: JDK **21** `D:\Android\jdk\jdk-21.0.12+8` (**Capacitor 8 exige Java 21** — le JDK 17 aussi installé échoue avec `invalid source release: 21`), SDK `D:\Android\Sdk` (platforms 34+36, build-tools 34/35/36), Gradle home `E:\Android\gradle-home`, keystore `D:\Android\keystore\pariscore-release.keystore` (alias `pariscore`, RSA 2048, 10 000 jours ; secrets dans `android/keystore.properties` gitignoré, template `.example`).

**Commandes**: `bun run mobile:apk` (boucle complète), `bun run mobile:debug|release|verify|sync|assets`. Surcharges env : `CAPACITOR_SERVER_URL` (émulateur : `http://10.0.2.2:3000`), `VERSION_CODE`/`VERSION_NAME`.

**APKs**: `android/app/build/outputs/apk/debug/app-debug.apk` (4,6 Mo) et `.../release/app-release.apk` (3,5 Mo, signé — SHA-256 `9b38ad21…c416a`).

**Pièges connus**: (1) scripts PowerShell **ASCII-only** — PS 5.1 lit l'UTF-8 sans BOM comme ANSI, les accents/`—` cassent le parsing ; (2) `tar` Git-MSYS interprète `D:` comme host distant → toujours `C:\Windows\System32\tar.exe` ; (3) sdkmanager : écrire les fichiers `D:\Android\Sdk\licenses\android-sdk-license` à la main plutôt que tuber des `y` ; (4) `apksigner verify` exige `JAVA_HOME` et le flag `-v` pour afficher "Verifies"/schemes ; (5) avdmanager exige que `ANDROID_AVD_HOME` existe déjà (mkdir avant `create avd`) ; (6) l'émulateur refuse de booter si le commit charge Windows < besoin (vérifier avant de lancer).

**QA APK**: `bun run mobile:qa` (`scripts/mobile-qa.ps1`) — Tier 1 statique (apksigner `-v`, zipalign, aapt2 badging, manifest debuggable/permissions, DEX refs), Tier 2 WebView Playwright Pixel 7 (`tests/apk-webview.spec.ts`, cible `QA_BASE_URL` défaut `https://pariscore.fr` = URL exacte de l'APK), Tier 3 adb/émulateur (`-Install`). Run final du 2026-08-07 : **18 PASS / 0 FAIL**. Le FAIL initial (« débordement horizontal 412px ») était un faux positif : cause réelle = **reload SW à la première visite** (`public/sw.js` `clients.claim()` → `controllerchange` → `window.location.reload()` sans garde dans `sw-register.tsx`) — fix appliqué : garde `hadController` (bead `ParisScorebis-rxi1`, à re-valider après déploiement prod). Sondes : `scripts/qa-overflow-probe.js`, `qa-overflow-timeline.js`. AVD `pariscore-qa` opérationnel (`E:\Android\avd`, API 34 google_apis x86_64, WHPX OK) mais boot bloqué par RAM commit saturée (~1 Go restant sur 36). Rapport complet : `docs/mobile/QA_REPORT.md`.



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

**CRITICAL — Shell tool (Git Bash) FREEZES on this system. Use CMD.**
The `shell`/`oc_bash` tools run **CMD**, not Git Bash. Any command using Bash
syntax (`$VAR`, `2>/dev/null`, `ls`, `cat`, `cp -r`) will **freeze or fail**.
Always use CMD syntax. When in doubt, use `echo %CD%` to confirm CMD is active.

> **Fix (2026-08-02, mis a jour le jour meme)**: `D:\Program Files\Git\bin` + `\usr\bin` ont ete
> ajoutes au PATH utilisateur (Git Bash installe sur D:), et `.vscode/settings.json` definit le
> profil terminal « Git Bash (D:) ». WSL2 Ubuntu est installee. ⚠️ **MAIS le PATH corrige
> n'a PAS resolu le gel** : apres redemarrage, `where bash` resout `D:\Program Files\Git\usr\bin\bash.exe`
> et le tool `bash` natif d'opencode **gele encore** (probe `echo ok; pwd; ls -1 | wc -l` → abort).
> Cause reelle = couche PTY/spawn du tool (spawn node direct OK 6/6). Le tool `bash` est donc
> **desactive** dans `.opencode/opencode.json` (`"tools": { "bash": false }`). Regle : **toujours
> `oc_bash`, JAMAIS le tool `bash` natif**. Diagnostic complet : `docs/bash-tool-windows.md`.
**Bash→CMD command translation table** (use the RIGHT column, ALWAYS):

| Operation | ❌ Bash (FREEZES) | ✅ CMD (WORKS) |
|-----------|------|------|
| List files | `ls "path"` | `dir /b "path"` |
| Redirect stderr to void | `2>/dev/null` | `2>nul` |
| Redirect both to void | `>/dev/null 2>&1` | `>nul 2>&1` |
| Test dir exists | `if [ -d "X" ]` | `if exist "X\\" (echo ok)` |
| Test file exists | `if [ -f "X" ]` | `if exist "X" (echo ok)` |
| Set env var | `export FOO=bar` | `set FOO=bar` |
| Read env var | `$FOO` | `%FOO%` |
| Cat a file | `cat file` | `type file` |
| Copy file/dir | `cp -rf src dst` | `xcopy /E /Y src dst` |
| Delete recursively | `rm -rf X` | `rmdir /s /q X` |
| Find files | `find . -name "*.ts"` | `dir /s /b *.ts` |
| Run JS check | `node --check file.js` | `node --check file.js` (works in both) |
| Path separator | `/` or `\` | `\` (backslash) |

**Why this matters:** On this Windows system, `bash` invokes Git Bash/MSYS2 which
freezes the agent session indefinitely. CMD is the only reliable shell. `2>nul`
in CMD is correct (redirects to NUL device). `ls`, `cat`, `grep` are NOT available
in CMD. When in doubt, use CMD syntax from the table above.

**Glob hygiene:** avoid `**/*` globs over `.next/` (890 MB, 7890 files — build
output). Scope globs to real source dirs (`src/**`, `app/**`). `.next/` is in
`.gitignore` and excluded from `tsconfig.json`, but raw globs may still traverse
it — scope them explicitly.

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

**CRITICAL — Component names: consult [COMPONENTS.md](./COMPONENTS.md) FIRST.**
The #1 cause of agent loops this codebase: inventing component names that don't
exist (`player-vs-block`, `country-flag`, `surface-badge`…) and re-searching them.
**Before referencing any component:**
1. Check COMPONENTS.md — it lists all 135 real components by category.
2. If the name is NOT there, it does NOT exist. Do **not** retry with name
   variants, do **not** loop searching. Either use the real name from the file,
   create the component explicitly, or ask the user.
3. One `ls src/components/<category>/` confirms reality — don't repeat it.
4. If you add/remove a component, update COMPONENTS.md in the same change.

### Quality & Testing
- **TypeScript**: strict mode (`typescript: ^5`)
- **Linter**: ESLint 9 (`eslint-config-next`)
- **E2E tests**: Playwright (`@playwright/test`)
- **Types**: `bun-types` for Bun runtime APIs
- Commands: `bun run lint`, `bun run typecheck` (if configured)

## Session: awesome-design-md / DESIGN.md (2026-08-19)

**Scope**: Bibliothèque locale de **74 DESIGN.md** (format Google Stitch, extraits de vrais sites) + skill `design-md` câblé sur **opencode**, **cline** et **claude** (via `.claude/skills`). Miroir upstream [VoltAgent/awesome-design-md](https://github.com/VoltAgent/awesome-design-md) (MIT).

**Fichiers clés**: `.agents/design-md/<marque>/DESIGN.md` (collection, 74 marques + README/LICENCE), `.agents/tools/design-md/SKILL.md` (source de vérité du skill), junctions : `.agents/tools-active/design-md` → `.agents/tools/design-md` (opencode), `.claude/skills/design-md` + `.cline/skills/design-md` → source.

**Règle d'or**: un DESIGN.md externe est une **source d'inspiration** — les tokens PariScore (`DESIGN_CHARTER.md`, dark navy + vert néon `#00e676`) restent la source de vérité. Pas de rebrand sauf demande explicite. Composants uniquement via `COMPONENTS.md`. Catalogue complet + prompts dans le SKILL.md.

**Refresh de la collection**: retélécharger le tarball upstream (`https://codeload.github.com/VoltAgent/awesome-design-md/tar.gz/refs/heads/main`) et réécrire `.agents/design-md/`. Ne jamais éditer les fichiers de la collection.

### Project-Specific Skills
Available locally — use via `skill` tool for guided workflows:
- `ps-add-strategy` — scaffold a new betting strategy
- `ps-audit` — full project state audit
- `ps-changelog` — update CHANGELOG.md after feature completion
- `ps-deploy` — Render.com deployment checklist
- `ps-test` — QA audit of a module

**Audit UI/UX** : `web-design-guidelines` (Vercel Labs, skill installé — règles fraîches fetchées depuis `raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md` avant chaque revue). Junctions : `.agents/tools-active/web-design-guidelines` + `.claude/skills` + `.cline/skills` → `.agents/tools/web-design-guidelines`. Sortie : format terse `file:line`.

### Multi-plateforme ZCode ↔ OpenCode (sync des skills)

Les deux agents partagent **une source unique de vérité** pour les skills, mais
avec un mécanisme d'allowlist différent par agent :

```
.agents/tools/          ← source unique (171 skills, lue intégralement par ZCode)
.agents/tools-active/   ← allowlist stricte (47 skills) = junctions → .agents/tools/<skill>
        ↑
.opencode/skills/       ← junction Windows → .agents/tools-active/ (lue par OpenCode)
```

> **Note (2026-07-24)** : OpenCode **ne supporte PAS de clé `skill` dans
> `opencode.json`** (schéma strict — provoque `Unrecognized key: skill` au
> démarrage). L'allowlist se fait donc au niveau **filesystem** :
> `.agents/tools-active/` ne contient que les junctions vers les skills
> réellement utilisés, et `.opencode/skills` pointe vers ce dossier curaté.

- **ZCode** lit TOUS les skills de `.agents/tools/` (171) — pas d'allowlist.
- **OpenCode** ne découvre que ceux de `.agents/tools-active/` (47) via la junction.
- **Ajouter un skill à OpenCode** :
  1. Le skill doit exister dans `.agents/tools/<nom>/SKILL.md`.
  2. Créer une junction dedans : `cmd //c "mklink /J C:\…\.agents\tools-active\<nom> C:\…\.agents\tools\<nom>"`
- **Sur un nouveau poste** : recréer les junctions manquantes
  ```bash
  # junction principale (allowlist)
  cmd //c "mklink /J C:\…\pariscore\.opencode\skills C:\…\pariscore\.agents\tools-active"
  # + une junction par skill actif vers .agents/tools/<skill>
  ```

> ⚠️ **NE PAS relancer `node scripts/sync-skills.js`** : il réécrit l'ancienne clé
> `skill` invalide dans `opencode.json` et fait crasher OpenCode au démarrage.
> Le mécanisme d'allowlist est désormais filesystem-based (cf. ci-dessus).

### Context & History
- **`CLAUDE.md`** — full roadmap, version history, persona as "CTO & Lead Data Scientist"
- **`CHANGELOG.md`** — detailed change log by version
- **`render.yaml`** — Render.com Blueprint deploy config
- **`.context/`** — audit reports, test reports, strategy docs

### Localisation des ressources (anti-glob sauvage)

**RÈGLE : NE JAMAIS lancer de glob `**/*` ou de recherche récursive en dehors du
projet courant (`C:\Users\David\ZCodeProject\pariscore`).** Un glob `**/*` sur
`~\Dev`, `~\Desktop` ou `C:\Users\David` peut se figer ou boucler sous Windows
(fichiers système, `.lnk`, reparse points). Si une ressource n'est pas dans le
projet, utilise un **chemin absolu ciblé** depuis la liste ci-dessous.

Ce dépôt (`ZCodeProject/pariscore`) est la **source unique**. Les autres dossiers
sont des références externes, pas à scanner :

| Ressource | Chemin absolu | Nature |
|-----------|---------------|--------|
| **Projet courant** | `C:\Users\David\ZCodeProject\pariscore` | ICI seulement — cwd normal |
| Planning Gantt | `C:\Users\David\pariscore-predict-planning` | README + `*.json`/`*.svg` (hors repo, 3 fichiers) |
| Ancien frontend | `C:\Users\David\ZCodeProject\frontend` | Référence UI legacy |
| Design fix | `C:\Users\David\ZCodeProject\pariscore-design-fix` | Référence design legacy |
| Miroirs git | `C:\Users\David\ZCodeProject\pariscore-git`, `…\pariscore-github` | Clones git, pas la source |
| Autre projet | `C:\Users\David\ZCodeProject\DeepSeek-Reasonix` | Projet indépendant (ignorer) |
| Références | `C:\Users\David\ZCodeProject\refs` | Docs de référence externes |

**Si tu as besoin d'un fichier `tennis*` ou `pariscore*`** : cherche d'abord dans
le projet courant avec un glob **relatif** (ex. `src/**/*tennis*`), puis demande
à l'utilisateur plutôt que de sonder `~\Dev` ou `~\Desktop`.

### Deployment
VPS (ubuntu@51.75.21.239) with Bun + pm2. Legacy also on Render.com via `render.yaml`.
Health check: `/api/v1/status`.
**Deploy** : `deploy.bat "msg"` (racine) ou `scripts/deploy.bat "msg"` — point d'entrée unique. Stream `scripts/update_vps.sh` vers le VPS (toujours la dernière logique). Le runner est **smart** : skip `next build` si seuls des fichiers legacy ont changé (`pariscore.{html,app.js,js}`, `services/*.js`, `data/*.json`) → ~15-30s vs ~3min. Build complet uniquement si `src/`/`app/`/`next.config`/`package.json` changent. QA post-deploy optionnelle : `bash scripts/post-deploy-qa.sh`.

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

This project has a knowledge graph at **`.graphify/`** (current canon, since the state migration) with god nodes, community structure, and cross-file relationships. The legacy `graphify-out/` (dated snapshots + older `graph.json`) is kept as an archive but is no longer the live graph — `graphify update` writes to `.graphify/`.

When the user types `/graphify`, use the installed graphify skill or instructions before doing anything else.

Rules:
- For codebase questions, first run `graphify query "<question>"` when `.graphify/graph.json` exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty `.graphify/` files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If `.graphify/wiki/index.md` exists, use it for broad navigation instead of raw source browsing.
- Read `.graphify/GRAPH_REPORT.md` only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost). It writes to `.graphify/`.
