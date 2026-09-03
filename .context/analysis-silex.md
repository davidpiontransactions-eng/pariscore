# Analyse Comparative : Silex vs Pariscore

> **Dépôt source**: [silexlabs/Silex](https://github.com/silexlabs/Silex) (2.9k ⭐, AGPL-3.0)
> **Date d'analyse**: 2026-08-25
> **Objectif**: Identifier les patterns avancés adoptables pour améliorer notre config

---

## 1. Vue d'ensemble

| Aspect | Silex | Pariscore |
|--------|-------|-----------|
| **Nature** | Visual website builder (no-code) | Application web sportive (Next.js 16 + Bun) |
| **Focus** | Drag-and-drop, static sites, CMS | Scraping, betting, mobile |
| **Architecture** | Monorepo (editor/server/common/plugins) | Monorepo (Next.js + legacy) |
| **Stack** | TypeScript + GrapesJS + 11ty + Tauri | Next.js 16 + React 19 + TailwindCSS 4 |
| **Desktop** | Tauri (Rust + WebView) | Capacitor (WebView) |
| **MCP** | MCP server intégré | 11 MCP servers |

---

## 2. Architecture Silex

### 2.1. Monorepo Structure

```
Silex/
├── editor/              # GrapesJS visual editor (browser)
├── server/              # Node.js server + storage
├── common/              # Shared contracts/types
├── grapesjs-plugins/    # First-party GrapesJS plugins
├── server-rust/         # Rust server library
├── desktop/             # Tauri desktop app (Rust + WebView)
├── silex-dashboard/     # Multi-site SaaS dashboard (submodule)
├── silex-dashboard-2026/ # New dashboard (submodule)
└── scripts/             # Build/deploy scripts
```

### 2.2. Build System

| Outil | Usage |
|-------|-------|
| **pnpm** | Package manager + workspaces |
| **webpack** | Editor build (browser) |
| **Cargo** | Rust build (server-rust + desktop) |
| **11ty** | Static site generation |
| **GrapesJS** | Visual editor framework |

### 2.3. Cross-Folder Imports

```typescript
// Path aliases (pas de ../../)
import { something } from '~/common';
import { editor } from '~/editor';
import { server } from '~/server';

// Plugins importés par package name
import { Plugin } from '@silexlabs/grapesjs-plugin-name';
```

---

## 3. Patterns Avancés Identifiés

### 3.1. Monorepo with Workspaces (++)

**Notre config** : Monorepo simple (Next.js + legacy).

**Leur approche** : **pnpm workspaces** pour les plugins :

```yaml
# pnpm-workspace.yaml
packages:
  - 'grapesjs-plugins/*'
  - 'desktop'
```

**Avantages** :
- Plugins publishés indépendamment
- Versioning séparé
- Build du core ne dépend pas des plugins

**+ Adoptable** : Structurer nos skills en workspaces independants.

---

### 3.2. Path Aliases (++)

**Notre config** : `@/` alias (Next.js standard).

**Leur approche** : Aliases par folder :

```typescript
// tsconfig.json
{
  "paths": {
    "~/common/*": ["./common/*"],
    "~/editor/*": ["./editor/*"],
    "~/server/*": ["./server/*"]
  }
}
```

**+ Adoptable** : Ajouter des aliases pour nos modules (`~/skills`, `~/mcp`).

---

### 3.3. MCP Server Integration (++)

**Notre config** : 11 MCP servers externes.

**Leur approche** : **MCP server intégré** dans le desktop app :

```
http://localhost:6807/mcp
```

**Fonctionnalités** :
- Contrôle du visual editor via AI
- Optimisé pour petits modèles locaux (7B+)
- Supporte Ollama, Claude Code, opencode, Goose

**+ Adoptable** : Intégrer un MCP server dans notre app pour contrôler les agents.

---

### 3.4. Desktop App (Tauri) (++)

**Notre config** : Capacitor (WebView).

**Leur approche** : **Tauri** (Rust + WebView) :

| Aspect | Tauri | Capacitor |
|--------|-------|-----------|
| Backend | Rust | JavaScript (Node.js) |
| Taille | ~5-10 MB | ~15-20 MB |
| Performance | Native | WebView |
| Sécurité | Sandboxed | WebView sandbox |

**+ Adoptable** : Évaluer Tauri pour une meilleure perf si on fait un desktop app.

---

### 3.5. Plugin System (++)

**Notre config** : Skills (dossiers autonomes).

**Leur approche** : **Plugin system** avec :

- Plugins indépendants (`grapesjs-plugins/*`)
- Build séparé par plugin
- Lint/test séparés par plugin
- Publication npm indépendante

**+ Adoptable** : Structurer nos skills comme des plugins publishables.

---

### 3.6. Git Submodules for Content (++)

**Notre config** : Pas de submodules.

**Leur approche** : Submodules pour le dashboard :

```bash
git clone --recurse-submodules https://github.com/silexlabs/Silex.git
```

**Usage** :
- `silex-dashboard/` — Dashboard SaaS (contenu, pas code)
- `silex-dashboard-2026/` — Nouveau dashboard

**+ Adoptable** : Utiliser des submodules pour les collections externes (design-md, etc.).

---

### 3.7. AGENTS.md Detailed (++)

**Notre config** : AGENTS.md existant.

**Leur approche** : AGENTS.md très détaillé avec :

```markdown
## When writing code for Silex
- Prefer small, focused changes
- Test before PR + screenshot
- Run checks (pnpm build, lint, test)
- Never edit dist/
- PR title = Conventional Commits

## When designing websites in Silex
- CSS: BEM naming
- GrapesJS API: Never modify DOM directly
- Pages: Homepage = index
- Symbols: Use for shared header/footer
- Responsiveness: DeviceManager breakpoints
```

**+ Adoptable** : Enrichir notre AGENTS.md avec des sections par contexte.

---

### 3.8. Discuss Before Coding (++)

**Notre config** : Pas de流程 formel.

**Leur approche** : **Discuss before coding** :

```markdown
## Discuss before coding
Please talk to us before you start writing code.
- Community forum — feature proposals
- Community chat — quick questions
- GitHub Issues — bug reports
```

**+ Adoptable** : Ajouter cette règle dans notre CONTRIBUTING.md.

---

### 3.9. Screenshot in PR (++)

**Notre config** : Pas de screenshot requis.

**Leur approche** : **Test + screenshot obligatoire** :

```markdown
4. Test before opening the PR, and include a screenshot of that test
   in the description.
```

**+ Adoptable** : Exiger un screenshot dans les PRs UI.

---

### 3.10. Conventional Commits (++)

**Notre config** : Conventional commits (déjà fait).

**Leur approche** : **Squash-merge + Conventional Commits** :

```markdown
PR title must follow Conventional Commits
(type(scope): description) — it becomes the changelog entry.
```

**+ Adoptable** : Enforce strictement les conventional commits.

---

### 3.11. Trunk-Based Development (++)

**Notre config** : Git flow classique.

**Leur approche** : **Trunk-based** :

- `main` = always releasable
- Pas de develop branch
- Hotfix = branch from tag + forward-port to main

**+ Adoptable** : Adopter le trunk-based development.

---

### 3.12. Tag-Based Releases (++)

**Notre config** : deploy.bat manuel.

**Leur approche** : **Tag-based releases** :

```
Prerelease tag → canary (testing)
Stable tag → production (deploy)
```

**+ Adoptable** : Automatiser le deploy via git tags.

---

## 4. Ce que Nous Faisons Mieux

| Aspect | Notre avantage |
|--------|----------------|
| **Stack** | Next.js 16 + React 19 + TailwindCSS 4 |
| **MCP Servers** | 11 servers vs 1 intégré |
| **Skills** | 60+ vs plugins |
| **Production** | App de production vs builder |
| **Mobile** | Capacitor Android vs pas de mobile |
| **Betting** | Skills betting avancés |
| **Scraping** | scrapling (3 modes) + scrapy |

---

## 5. Améliorations Recommandées pour Pariscore

### Priorité Haute (Impact immédiat)

| # | Amélioration | Effort | Impact |
|---|--------------|--------|--------|
| 1 | **Path aliases** — ~/skills, ~/mcp | Faible | Élevé |
| 2 | **Screenshot in PR** | Faible | Moyen |
| 3 | **Discuss before coding** | Faible | Moyen |

### Priorité Moyenne (Impact à terme)

| # | Amélioration | Effort | Impact |
|---|--------------|--------|--------|
| 4 | **Plugin system** pour skills | Moyen | Élevé |
| 5 | **Trunk-based development** | Moyen | Élevé |
| 6 | **Tag-based releases** | Moyen | Élevé |

---

## 6. Code Snippets Adaptables

### Path Aliases

```json
// tsconfig.json
{
  "compilerOptions": {
    "paths": {
      "~/*": ["./src/*"],
      "~/skills/*": ["./.opencode/skills/*"],
      "~/mcp/*": ["./.mcp/*"],
      "~/components/*": ["./src/components/*"],
      "~/lib/*": ["./src/lib/*"]
    }
  }
}
```

### CONTRIBUTING.md

```markdown
# Contributing to Pariscore

## Discuss before coding

Please talk to us before you start writing code.
- bd issues — bug reports and feature requests
- GitHub Discussions — design questions
- Discord — quick questions

## PR Requirements

1. Reference the bd issue
2. Keep PRs focused — one feature/fix per PR
3. **Test before PR + screenshot** for UI changes
4. Run quality gates:
   - `bun run lint`
   - `bun run typecheck`
5. PR title follows Conventional Commits

## Branch Model

Trunk-based: `main` is always releasable.
- Short-lived branches: `feat/...`, `fix/...`
- PR against `main`
- Squash-merge with Conventional Commits title
```

### Tag-Based Deploy

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    tags:
      - 'v*'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Deploy to VPS
        run: |
          if [[ "${{ github.ref }}" == *"-canary"* ]]; then
            echo "Deploy to canary"
            # Deploy to canary server
          else
            echo "Deploy to production"
            # Deploy to production server
          fi
```

### Plugin Structure for Skills

```
.opencode/skills/
├── betting/
│   ├── package.json      #独立 versioning
│   ├── SKILL.md          # Documentation
│   ├── index.ts          # Entry point
│   ├── tests/
│   └── dist/             # Build output
├── scrapling/
│   ├── package.json
│   ├── SKILL.md
│   └── ...
└── workspace.yaml        # pnpm workspace config
```

---

## 7. Conclusion

**Silex** est un excellent exemple de **monorepo bien structuré** avec un plugin system sophistiqué. Ses forces principales sont :

1. **Monorepo with Workspaces** — Plugins indépendants
2. **Path Aliases** — Imports propres
3. **MCP Server Integration** — AI-ready
4. **Desktop App (Tauri)** — Performance native
5. **Plugin System** — Extensibilité
6. **Git Submodules** — Contenu séparé
7. **AGENTS.md Detailed** — Context-specific rules
8. **Discuss Before Coding** — Processus formel
9. **Screenshot in PR** — Preuve visuelle
10. **Conventional Commits** — Changelog auto
11. **Trunk-Based Development** — Simple et efficace
12. **Tag-Based Releases** — Deploy automatisé

**Notre avantage** : Nous avons une application de production avec Next.js 16, React 19, 60+ skills, 11 MCP servers. Silex est un builder, nous sommes une app complète.

**Recommandation** : Adopter les path aliases et le discuss before coding immédiatement. Le plugin system à terme.

---

## 8. Intégration Recommandée

### Nouveaux Fichiers

```
CONTRIBUTING.md         # Guide de contribution
.workflow/              # CI/CD workflows
scripts/deploy-tag.sh   # Deploy via git tags
```

### tsconfig.json Update

```json
{
  "compilerOptions": {
    "paths": {
      "~/*": ["./src/*"],
      "~/skills/*": ["./.opencode/skills/*"],
      "~/mcp/*": ["./.mcp/*"]
    }
  }
}
```
