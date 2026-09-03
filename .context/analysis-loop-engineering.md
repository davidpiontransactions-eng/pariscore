# Analyse Comparative : loop-engineering vs Pariscore

> **Dépôt source**: [cobusgreyling/loop-engineering](https://github.com/cobusgreyling/loop-engineering) (10.7k ⭐, MIT)
> **Date d'analyse**: 2026-08-25
> **Objectif**: Identifier les patterns avancés adoptables pour améliorer notre configuration opencode/cline

---

## 1. Vue d'ensemble

| Aspect | loop-engineering | Pariscore |
|--------|------------------|-----------|
| **Nature** | Framework de boucles d'automatisation (loop patterns) | Application web sportive (Next.js 16 + Bun) |
| **Focus** | Loop orchestration, observability, budget, gates | Scraping, betting, mobile |
| **Architecture** | Patterns + starters + CLI tools + gate + budget | AGENTS.md + 60+ skills |
| **State** | STATE.md + loop-run-log.md | bd (beads) + memory server |
| **Observability** | loop-run-log.md + loop-budget.md | PostHog + Sentry |

---

## 2. Architecture loop-engineering

### 2.1. Loop Levels

loop-engineering définit **3 niveaux d'automatisation** :

| Niveau | Description | Auto-merge | Human gate |
|--------|-------------|------------|------------|
| **L1** | Report-only, human reviews | Jamais | Toujours |
| **L2** | Assisted, manual trigger | Worktree + verifier | Conditionnel |
| **L3** | Full automation | Auto-merge allowlist | Rare |

### 2.2. Boucles Actives

```
patterns/
├── daily-triage.md       # L1 — scan matinal
├── pr-babysitter.md      # L2 — PR review + fix
├── ci-sweeper.md         # L2 — CI failures
├── post-merge-cleanup.md # L1 — tech debt post-merge
├── dependency-sweeper.md # L2 — deps + CVE
├── changelog-drafter.md  # L1 — release notes
└── issue-triage.md       # L1 — issue dedup + label
```

### 2.3. Components Clés

| Composant | Fichier | Rôle |
|-----------|---------|------|
| **gate.yaml** | `gate.yaml` | Path denylist + auto-merge allowlist |
| **loop-budget.md** | `loop-budget.md` | Token caps + kill switch |
| **loop-run-log.md** | `loop-run-log.md` | Historique JSON des runs |
| **STATE.md** | `STATE.md` | État live du loop |
| **patterns/registry.yaml** | `patterns/registry.yaml` | Registre machine-readable |

---

## 3. Patterns Avancés Identifiés

### 3.1. Loop Levels (L1/L2/L3) (++)

**Notre config** : Pas de niveaux d'automatisation définis.

**Leur approche** :
- **L1** : Report-only, human décide
- **L2** : Fix proposé dans worktree, verifier requis, pas d'auto-merge
- **L3** : Auto-merge sur allowlist, denylist stricte

**+ Adoptable** : Définir des niveaux pour nos workflows (scraping, betting, mobile).

---

### 3.2. Gate System (YAML) (++)

**Notre config** : Garde-fous écrits en dur dans AGENTS.md.

**Leur approche** : `gate.yaml` machine-readable :

```yaml
denylist:
  - ".env"
  - "**/secrets/**"
  - "**/*_key*"
  - "**/*_secret*"
  - "k8s/production/**"

maxFiles: 10

autoMergeAllowlist:
  - "docs/**"
  - "**/*.md"
  - "**/*.test.mjs"
```

**+ Adoptable** : Créer un `gate.yaml` pour PariScore avec denylist spécifique.

---

### 3.3. Budget System (++)

**Notre config** : Pas de budget tokens défini.

**Leur approche** : `loop-budget.md` :

```markdown
| Loop | Max runs/day | Max tokens/day | Max sub-agent spawns/run |
|------|--------------|----------------|--------------------------|
| Daily Triage | 1 | 100k | 0 (L1) |
| Validate/Audit (CI) | 96 | 500k | 0 |
| Changelog Drafter | 1 | 100k | 2 |
```

**+ Adoptable** : Définir des budgets pour nos MCP servers et skills.

---

### 3.4. Run Log JSON (++)

**Notre config** : bd pour le tracking, mais pas de log structuré des runs.

**Leur approche** : `loop-run-log.md` avec entrées JSON :

```json
{
  "run_id": "2026-08-25T08:11:16Z",
  "pattern": "daily-triage",
  "duration_s": 16,
  "items_found": 1,
  "actions_taken": 1,
  "tokens_estimate": 52000,
  "readiness_score": 100,
  "outcome": "report-only"
}
```

**+ Adoptable** : Standardiser les logs de nos scripts Python en JSON similaire.

---

### 3.5. Pattern Registry (++)

**Notre config** : Skills dans `.agents/tools-active/` mais pas de registre machine-readable.

**Leur approche** : `patterns/registry.yaml` :

```yaml
patterns:
  - id: daily-triage
    name: Daily Triage
    goal: Prioritized morning scan
    cadence: 1d-2h
    risk: low
    tools: [grok, claude-code, opencode]
    skills: [loop-triage]
    phases: [report, act-small-wins, escalate]
    human_gates: [design-decisions]
    cost:
      tokens_noop: 5000
      tokens_report: 50000
      tokens_action: 200000
```

**+ Adoptable** : Créer un registre pour nos 60+ skills.

---

### 3.6. STATE.md Live (++)

**Notre config** : bd pour le tracking, mais pas d'état live.

**Leur approche** : `STATE.md` :

```markdown
# Loop State — loop-engineering reference

Last run: 2026-08-25T08:11:16Z

## High Priority
- Maintain loop readiness score ≥ 58 (current: **100**, level **L3**).

## Watch List
- Expand contributor failure stories

## Recent Noise (ignored this run)
—
```

**+ Adoptable** : Créer un `STATE.md` pour nos loops actives.

---

### 3.7. Worktrees for Experiments (++)

**Notre config** : Pas de worktrees pour les experiments.

**Leur approche** :
- Chaque experiment non supervisé dans un worktree isolé
- Un worktree par fix
- Supprimer après REJECT ou escalation

**+ Adoptable** : Utiliser des worktrees pour les tests de strategies.

---

### 3.8. Human Gates Définis (++)

**Notre config** : Human gates écrits en dur.

**Leur approche** : `human_gates` dans le registry :

```yaml
human_gates:
  - security
  - payments
  - auth
  - max-fix-attempts
```

**+ Adoptable** : Formaliser les human gates pour nos workflows.

---

### 3.9. Cost Estimation (++)

**Notre config** : Pas d'estimation de coût.

**Leur approche** : `npx @cobusgreyling/loop-cost --pattern daily-triage`

**+ Adoptable** : Ajouter l'estimation de coût à nos scripts.

---

## 4. Ce que Nous Faisons Mieux

| Aspect | Notre avantage |
|--------|----------------|
| **MCP Servers** | 11 serveurs MCP vs ~0 (game changer) |
| **Skills数量** | 60+ vs 7 patterns (couverture bien plus large) |
| **Production** | App de production vs framework théorique |
| **Memory** | bd (beads) + memory server vs STATE.md basique |
| **Multi-plateforme** | opencode + cline + zcode |
| **Deployment** | VPS + pm2 + Capacitor |
| **Betting** | Skills betting avancés |
| **Scraping** | scrapling (3 modes) + scrapy |

---

## 5. Améliorations Recommandées pour Pariscore

### Priorité Haute (Impact immédiat)

| # | Amélioration | Effort | Impact |
|---|--------------|--------|--------|
| 1 | **gate.yaml** — Path denylist + auto-merge | Faible | Élevé |
| 2 | **loop-budget.md** — Token caps | Faible | Élevé |
| 3 | **loop-run-log.md** — Log structuré JSON | Faible | Moyen |

### Priorité Moyenne (Impact à terme)

| # | Amélioration | Effort | Impact |
|---|--------------|--------|--------|
| 4 | **Pattern registry** — Registre machine-readable | Moyen | Élevé |
| 5 | **STATE.md** — État live des loops | Faible | Moyen |
| 6 | **Loop levels** — L1/L2/L3 definitions | Moyen | Élevé |

---

## 6. Code Snippets Adaptables

### gate.yaml pour PariScore

```yaml
version: 1

denylist:
  - ".env"
  - ".env.*"
  - "**/secrets/**"
  - "**/credentials/**"
  - "**/*_key*"
  - "**/*_secret*"
  - "pariscore.db"
  - "prisma/dev.db"
  - "**/node_modules/**"
  - "**/.next/**"

maxFiles: 15

autoMergeAllowlist:
  - "docs/**"
  - "**/*.md"
  - "**/*.test.ts"
  - "**/*.spec.ts"
  - ".opencode/skills/**/references/**"
```

### loop-budget.md pour PariScore

```markdown
# Loop Budget — Pariscore

## Daily limits

| Loop | Max runs/day | Max tokens/day | Max sub-agent spawns/run |
|------|--------------|----------------|--------------------------|
| Scraping (oddalerts) | 2 | 500k | 0 |
| Betting Analysis | 10 | 200k | 0 |
| QA APK | 1 | 300k | 2 |
| Code Review | 5 | 150k | 1 |
| bd triage | 3 | 100k | 0 |

## On budget exceed

1. Pause schedulers
2. Append event to loop-run-log.md
3. Open maintainer issue

## Kill switch

- Label: `pariscore-pause-loops`
- Resume only after cleared in STATE.md
```

### loop-run-log.md pour PariScore

```markdown
# Loop Run Log — Pariscore

Append one entry per run. Prune entries older than 30 days.

## Format

```json
{
  "run_id": "2026-08-25T10:00:00Z",
  "pattern": "scraping-oddalerts",
  "duration_s": 120,
  "items_found": 582,
  "actions_taken": 1,
  "escalations": 0,
  "tokens_estimate": 0,
  "outcome": "success | partial | failed"
}
```

## Recent Runs

<!-- Loop appends below this line -->
```

### STATE.md pour PariScore

```markdown
# Loop State — Pariscore

Last run: 2026-08-25T10:00:00Z

## Active Loops

| Loop | Level | Status | Last Run |
|------|-------|--------|----------|
| Scraping OddAlerts | L1 | ✅ Active | 04:30 UTC |
| Betting Analysis | L2 | ✅ Active | On-demand |
| Mobile Build | L2 | ✅ Active | Manual |
| Code Review | L1 | ✅ Active | On PR |

## High Priority
- Maintain oddalerts scraping daily at 04:30 UTC
- Keep APK QA passing (18/18)

## Watch List
- Monitor FlareSolverr sessions on VPS
- Track token usage across MCP servers

## Recent Noise (ignored this run)
—
```

### Pattern Registry pour PariScore

```yaml
# Machine-readable pattern registry for Pariscore
patterns:
  - id: scraping-oddalerts
    name: Scraping OddAlerts
    file: scraping-oddalerts.md
    goal: Extract league stats from oddalerts.com
    cadence: 1d
    risk: low
    tools: [node, flaresolverr]
    skills: [scrapling, scrapy]
    phases: [fetch, parse, transform, store]
    human_gates: [waf-bypass, data-quality]
    cost:
      tokens_noop: 0
      tokens_report: 0
      tokens_action: 0
      suggested_daily_cap: 0

  - id: betting-analysis
    name: Betting Analysis
    file: betting-analysis.md
    goal: Analyze odds and find edges
    cadence: on-demand
    risk: medium
    tools: [opencode, polymarket, kalshi]
    skills: [betting, football-data]
    phases: [fetch-odds, de-vig, edge-detect, kelly, recommend]
    human_gates: [high-stakes, unfamiliar-sport]
    cost:
      tokens_noop: 1000
      tokens_report: 50000
      tokens_action: 100000
```

---

## 7. Conclusion

**loop-engineering** est un excellent exemple de **framework de boucles d'automatisation**. Ses forces principales sont :

1. **Loop Levels (L1/L2/L3)** — Niveaux d'automatisation clairs
2. **Gate System** — Path denylist + auto-merge allowlist YAML
3. **Budget System** — Token caps + kill switch
4. **Run Log** — Historique JSON structuré
5. **Pattern Registry** — Registre machine-readable
6. **STATE.md** — État live des loops
7. **Worktrees** — Isolation des experiments
8. **Human Gates** — Définis formellement
9. **Cost Estimation** — Outil de calcul de coût

**Notre avantage** : Nous avons une application de production avec 60+ skills, 11 MCP servers, et un déploiement multi-plateforme. loop-engineering est un framework théorique, nous sommes en production.

**Recommandation** : Adopter le gate.yaml, le loop-budget.md, et le loop-run-log.md immédiatement — effort faible, impact élevé. Le pattern registry à terme.

---

## 8. Intégration Recommandée

### Dans racine du projet

```
pariscore/
├── gate.yaml           # Path denylist + auto-merge
├── loop-budget.md      # Token caps + kill switch
├── loop-run-log.md     # Historique JSON des runs
├── STATE.md            # État live des loops
└── patterns/
    └── registry.yaml   # Registre machine-readable
```

### Dans AGENTS.md

```markdown
## Loop Levels

| Niveau | Description | Auto-merge | Human gate |
|--------|-------------|------------|------------|
| **L1** | Report-only, human reviews | Jamais | Toujours |
| **L2** | Assisted, manual trigger | Worktree + verifier | Conditionnel |
| **L3** | Full automation | Auto-merge allowlist | Rare |

## Gate System

Le `gate.yaml` définit les paths sensibles et les auto-merge allowlists.
Toute modification de ces paths nécessite un human review.
```
