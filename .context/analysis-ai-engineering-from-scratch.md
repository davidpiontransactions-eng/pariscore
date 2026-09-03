# Analyse Comparative : ai-engineering-from-scratch vs Pariscore

> **Dépôt source**: [rohitg00/ai-engineering-from-scratch](https://github.com/rohitg00/ai-engineering-from-scratch) (48.7k stars, MIT)
> **Date d'analyse**: 2026-08-25
> **Objectif**: Identifier les patterns avancés adoptables pour améliorer notre configuration opencode/cline

---

## 1. Vue d'ensemble

| Aspect | ai-engineering-from-scratch | Pariscore |
|--------|---------------------------|-----------|
| **Nature** | Curriculum IA (435 leçons, 20 phases) | Application web sportive (Next.js 16 + Bun) |
| **AGENTS.md** | ~400 lignes, rules-driven | ~200 lignes, session-driven |
| **Skills** | 8 skills spécialisés (tutor, certification, quiz) | 60+ skills (design, scraping, betting, mobile) |
| **CI/CD** | GitHub Actions (audit, sync, rebuild) | VPS + pm2 + deploy.bat |
| **Tracking** | LEARNING.md (progress state) | bd (beads) issue tracker |
| **Certification** | 4 tracks Claude (CCAO-F, CCDV-F, CCAR-F, CCAR-P) | Aucun |

---

## 2. Patterns Avancés Identifiés

### 2.1. Hard Rules Systematiques (+)

**ai-engineering-from-scratch** définit des **règles non-négociables** avec enforcement automatique :

```markdown
## Hard rules
1. One commit per lesson directory. Never batch multiple lessons into one commit.
2. Conventional commit subjects ≤72 chars: `feat(phase-NN/MM): <slug>`.
3. Mermaid or SVG only for diagrams. No ASCII / Unicode box-drawing.
4. Every fenced code block needs a language tag.
5. Original implementations only. Don't cite external curriculum repos.
6. Dependency allowlist. Stdlib-first.
7. Never commit generated files.
```

**Notre config actuelle** : Rules spread dans AGENTS.md mais pas de `hard rules` section formalisée.

**+ Adoptable** : Créer une section `## Hard Rules` avec les règles critiques (pas de secrets en clair, pas de bash pour fichiers, etc.)

---

### 2.2. Lesson Contract / Schema Formalisé (+)

**ai-engineering-from-scratch** définit un **contrat de format** pour chaque leçon :

```markdown
### docs/en.md frontmatter
# <Title>
> <One-line hook>
**Type:** <Learn | Build | Reference>
**Languages:** <comma-list>
**Prerequisites:** <comma-list>
**Time:** ~<estimate in minutes>
## Learning Objectives
- <4-6 bullet points starting with a verb>
```

**Quiz schema** : JSON strict avec 6 questions (1 pre + 3 check + 2 post).

**Notre config** : Pas de schema formel pour les composants ou features.

**+ Adoptable** : Définir un `feature-contract.md` pour les nouvelles features :
```markdown
## Feature Contract
**Type**: API | UI | Scraper | Cron
**Fichiers**: src/... 
**Tests**: obligatoires pour API, optionnels pour UI
**Output**: JSON | HTML | SQLite | PNG
```

---

### 2.3. Automation Contract (+)

**ai-engineering-from-scratch** sépare clairement ce que fait CI vs ce que fait le contributeur :

```markdown
## Automation contract
**CI handles automatically — do not touch in your PR:**
| Surface | Bot | When |
|---------|-----|------|
| catalog.json | rebuilt on demand | every CI job |
| README.md counts | readme-counts-sync | on push to main |
| site/data.js | site-rebuild | on push to main |

**You handle:**
| Surface | When |
|---------|------|
| README.md lesson-link rows | when adding a new lesson |
| ROADMAP.md status | when marking a lesson complete |
| glossary/terms.md | when introducing a term |
```

**Notre config** : Pas de separation CI vs humain formalisée.

**+ Adoptable** : Documenter ce que fait `deploy.bat`, `bd`, et le cron VPS vs ce que l'humain doit faire manuellement.

---

### 2.4. Dependency Allowlist (+)

**ai-engineering-from-scratch** liste explicitement les dépendances autorisées :

```markdown
## Dependencies
| Language | Allowed |
|----------|---------|
| Python | numpy, torch, h5py, zstandard, safetensors, stdlib |
| TypeScript | hono, zod, ws, @hono/node-server, Node 20+ stdlib |
| Rust | stdlib only |
```

**Notre config** : `package.json` liste les deps mais pas de allowlist documentée.

**+ Adoptable** : Créer une section `## Dependencies` dans AGENTS.md listant les libs autorisées et les patterns interdits.

---

### 2.5. Skills avec Host Invocation Contract (+)

**ai-engineering-from-scratch** définit un **contrat d'invocation** pour chaque skill :

```markdown
## Host invocation contract
Skill names are portable, but invocation syntax belongs to the host.
- Codex: `learn`, `start-learning`
- Claude Code: `/learn`, `/start-learning`
- Other hosts: natural language
Never present a slash command as universal syntax.
```

**Notre config** : Skills définis mais pas de contrat d'invocation formel.

**+ Adoptable** : Ajouter un header `## Invocation` dans chaque SKILL.md définissant :
- Nom du skill
- Mots-clés de déclenchement
- Syntaxe par host (opencode, cline, zcode)

---

### 2.6. State Management pour Learning Paths (+)

**ai-engineering-from-scratch** gère un **fichier de state** (`LEARNING.md`) pour tracker la progression :

```markdown
## Step 0 — Locate state
Read `LEARNING.md` from the current directory.
- Found: the next lesson is the first not-yet-logged lesson
- Found, but no eligible lesson remains: congratulate, offer options
- Missing: say that start-learning builds a personalized plan
```

**Notre config** : `bd` pour le tracking, mais pas de fichier de state pour les learning paths.

**+ Adoptable** : Si on ajoute des learning paths (ex: "Apprendre Next.js", "Maîtriser les paris sportifs"), créer un `LEARNING.md` similaire.

---

### 2.7. Assessment Schema Formel (+)

**ai-engineering-from-scratch** définit un **schéma d'assessment** avec diagnostic et mock exams :

```json
{
  "id": "claude-ccar-f-diagnostic",
  "version": 1,
  "track": "claude-ccar-f",
  "kind": "diagnostic",
  "timeLimitMinutes": 30,
  "questions": [
    {
      "id": "ccar-f-agent-001",
      "domain": "agentic-architecture-orchestration",
      "type": "single",
      "prompt": "...",
      "options": ["a", "b", "c", "d"],
      "correct": [1],
      "explanation": "..."
    }
  ]
}
```

**Notre config** : Pas de système d'assessment formel.

**+ Adoptable** : Créer des assessments pour valider les skills (ex: quiz sur les stratégies de paris, diagnostic sur l'architecture).

---

### 2.8. Conflict Resolution Documenté (+)

**ai-engineering-from-scratch** documente la procédure de résolution de conflits :

```markdown
## Conflict resolution
git fetch origin main
git merge --no-edit origin/main
# Catalog conflict (legacy branches only):
git rm catalog.json
git commit --no-edit
# README count conflict:
git checkout --theirs README.md
python3 scripts/build_catalog.py
```

**Notre config** : Pas de procédure documentée.

**+ Adoptable** : Documenter les procédures de merge conflict pour notre workflow.

---

## 3. Ce que Nous Faisons Mieux

| Aspect | Notre avantage |
|--------|----------------|
| **Skills数量** | 60+ skills vs 8 (couverture bien plus large) |
| **MCP Servers** | 11 serveurs MCP vs 0 (game changer) |
| **Session Context** | Historique détaillé par session vs pas d'historique |
| **Real-world Apps** | Application de production vs curriculum théorique |
| **Multi-plateforme** | opencode + cline + zcode vs un seul agent |
| **Deployment** | VPS + pm2 + Capacitor vs GitHub Pages |
| **Memory** | bd (beads) + memory server vs fichier simple |

---

## 4. Améliorations Recommandées pour Pariscore

### Priorité Haute (Impact immédiat)

| # | Amélioration | Effort | Impact |
|---|--------------|--------|--------|
| 1 | **Ajouter `## Hard Rules`** dans AGENTS.md | Faible | Élevé |
| 2 | **Documenter `## Automation Contract`** (CI vs humain) | Faible | Élevé |
| 3 | **Ajouter `## Dependencies` allowlist** | Faible | Moyen |

### Priorité Moyenne (Impact à terme)

| # | Amélioration | Effort | Impact |
|---|--------------|--------|--------|
| 4 | **Créer `feature-contract.md`** pour les nouvelles features | Moyen | Élevé |
| 5 | **Ajouter `## Invocation`** dans chaque SKILL.md | Moyen | Moyen |
| 6 | **Documenter conflict resolution** pour git workflow | Faible | Moyen |

### Priorité Basse (Nice-to-have)

| # | Amélioration | Effort | Impact |
|---|--------------|--------|--------|
| 7 | **Système d'assessment** pour valider les skills | Élevé | Moyen |
| 8 | **Learning paths** avec state tracking | Élevé | Moyen |
| 9 | **Certification tracks** pour les contributions | Élevé | Faible |

---

## 5. Code Snippets Adaptables

### Hard Rules pour Pariscore

```markdown
## Hard Rules

1. **NEVER commit secrets** — .env contains live keys, treat as confidential
2. **NEVER use bash for file operations** — Use Read/Edit/Write tools
3. **ALWAYS run linter/typecheck** after code changes (bun run lint, bun run typecheck)
4. **Conventional commits** — `feat(scope): description` ≤72 chars
5. **One feature per commit** — Don't batch unrelated changes
6. **TypeScript strict mode** — No `any` types, proper typing required
7. **French comments** — Code comments in French for consistency
```

### Automation Contract pour Pariscore

```markdown
## Automation Contract

**Automated (do not touch in PR):**
| Surface | Tool | Trigger |
|---------|------|---------|
| Deployment | deploy.bat | Manual push to VPS |
| Database | Prisma migrate | On schema change |
| APK Build | bun run mobile:apk | Manual trigger |
| Cron Jobs | pm2 + FlareSolverr | Daily 04:30 UTC |

**You handle:**
| Surface | When |
|---------|------|
| Feature implementation | New feature requests |
| Bug fixes | Issue reports |
| Documentation | README, CHANGELOG updates |
| Testing | Manual QA for UI changes |
```

### Feature Contract pour Pariscore

```markdown
## Feature Contract

**Type**: API | UI | Scraper | Cron | Mobile
**Required**:
- [ ] TypeScript strict mode
- [ ] Error handling
- [ ] Input validation (Zod)
- [ ] Documentation in AGENTS.md session

**Optional**:
- [ ] Unit tests (Vitest)
- [ ] E2E tests (Playwright)
- [ ] Performance benchmarks

**Output Format**:
- API: JSON envelope `{ success, data, error }`
- UI: React component with shadcn/ui
- Scraper: Node.js script with retry logic
- Cron: pm2 managed process
```

---

## 6. Conclusion

**ai-engineering-from-scratch** est un excellent exemple de **configuration d'agent IA pour un curriculum éducatif**. Ses forces principales sont :

1. **Règles formelles** avec enforcement automatique
2. **Schemas JSON** pour les contenus pédagogiques
3. **Separation CI/humain** claire et documentée
4. **State management** pour les parcours d'apprentissage
5. **Host invocation contracts** pour la portabilité des skills

**Notre avantage** : Nous avons une application de production réelle avec 60+ skills, 11 MCP servers, et un déploiement multi-plateforme. Le curriculum est théorique, nous sommes en production.

**Recommandation** : Adopter les patterns 1-3 (Hard Rules, Automation Contract, Dependencies) immédiatement — effort faible, impact élevé. Les patterns 4-6 (Feature Contract, Invocation, Conflict Resolution) à moyen terme.
