# Agent Skills — Guide d'utilisation (ZCode, OpenCode, PariScore)

> Source : [`addyosmani/agent-skills`](https://github.com/addyosmani/agent-skills) — *Production-grade engineering skills for AI coding agents.*
> Installation : **10 juillet 2026** — 24 skills + 8 commands + 4 subagents + 7 références.

---

## Sommaire

1. [Qu'est-ce qu'un Agent Skill ?](#1-quest-ce-quun-agent-skill-)
2. [Ce qui a été installé (récapitulatif)](#2-ce-qui-a-été-installé-récapitulatif)
3. [Les 24 skills (référence complète)](#3-les-24-skills-référence-complète)
4. [Utilisation dans ZCode](#4-utilisation-dans-zcode)
5. [Utilisation dans OpenCode](#5-utilisation-dans-opencode)
6. [Les 8 commands (slash commands)](#6-les-8-commands-slash-commands)
7. [Le cycle de vie de développement](#7-le-cycle-de-vie-de-développement)
8. [Intégration avec les skills PariScore existants](#8-intégration-avec-les-skills-pariscore-existants)
9. [Maintenance & mises à jour](#9-maintenance--mises-à-jour)
10. [Dépannage](#10-dépannage)

---

## 1. Qu'est-ce qu'un Agent Skill ?

Un **Agent Skill** est un fichier `SKILL.md` qui injecte une procédure de travail dans l'agent IA au moment où il en a besoin. C'est l'équivalent d'un **playbook** qu'un ingénieur senior suivrait.

**Anatomie d'un skill :**

```markdown
---
name: mon-skill                 # identifiant kebab-case
description: Fait X. Use when [trigger].   # ← détermine le déclenchement automatique
---

# Body — procédural (étapes, checklists), pas narratif
```

**Principes clés (de la méthodologie addyosmani) :**

- **Progressive disclosure** — le skill principal reste court (<500 lignes). Les checklists lourdes vivent dans `references/` et ne sont lues qu'à la demande.
- **Trigger-based descriptions** — la `description` contient des déclencheurs explicites (« Use when… ») pour que l'agent sélectionne le bon skill automatiquement.
- **Procédural, pas narratif** — l'agent exécute des étapes, il ne lit pas un essai.
- **Vérification obligatoire** — chaque skill se termine par une étape de vérification (tests passent, build OK, comportement vérifié).

---

## 2. Ce qui a été installé (récapitulatif)

Les skills addyosmani ont été installés **aux 4 endroits suivants**, avec le préfixe **`aos-`** (addyosmani) pour les distinguer des skills PariScore existants (qui n'ont **aucun conflit de nom**) :

| Cible | Emplacement | Skills | Commands | Agents | References |
|-------|-------------|:------:|:--------:|:------:|:----------:|
| **PariScore / ZCode** (projet) | `.agents/skills/aos-*` | 24 | — | — | `.agents/aos-references/` (7) |
| **PariScore / OpenCode** (projet) | `.opencode/skills/aos-*` | 24 | `.opencode/command/` (8) | `.opencode/agent/` (4) | `.opencode/aos-references/` (7) |
| **ZCode global** (tous projets) | `~/.zcode/cli/plugins/.../agent-skills/` | 24 | — | — | `references/` (7) |
| **OpenCode global** (tous projets) | `~/.config/opencode/` | 24 | `command/` (8) | `agent/` (4) | `aos-references/` (7) |

> **Note sur le préfixe `aos-`** : tes 46 skills PariScore (`agency-*`, `metier-*`, `caveman-*`, données sportives, etc.) restent inchangés. Les 24 skills addyosmani sont namespacés `aos-` pour éviter toute confusion.

### Arborescence installée dans PariScore

```
pariscore/
├── .agents/
│   ├── skills/
│   │   ├── agency-code-reviewer/      ← skill PariScore (existant)
│   │   ├── betting/                    ← skill PariScore (existant)
│   │   ├── ...
│   │   └── aos-code-review-and-quality/   ← skill addyosmani (nouveau)
│   │       └── SKILL.md
│   └── aos-references/                 ← checklists partagées (nouveau)
│       ├── security-checklist.md
│       ├── performance-checklist.md
│       └── ... (7 fichiers)
│
├── .opencode/
│   ├── skills/aos-*/                   ← 24 skills pour OpenCode
│   ├── command/                        ← 8 slash commands (.toml)
│   │   ├── build.toml
│   │   ├── review.toml
│   │   ├── ship.toml
│   │   └── ...
│   ├── agent/                          ← 4 subagents (.md)
│   │   ├── code-reviewer.md
│   │   ├── security-auditor.md
│   │   ├── test-engineer.md
│   │   └── web-performance-auditor.md
│   └── aos-references/                 ← checklists (7 fichiers)
│
├── .context/agent-skills-docs/         ← documentation originale addyosmani (11 docs)
│   ├── skill-anatomy.md
│   ├── opencode-setup.md
│   └── ...
│
└── AGENT-SKILLS-GUIDE.md               ← ce fichier
```

---

## 3. Les 24 skills (référence complète)

Tous les skills sont préfixés `aos-`. Phase = moment du cycle de dev où le skill s'applique.

### Phase DEFINE (définir le besoin)

| Skill | Rôle |
|-------|------|
| `aos-interview-me` | Extrait ce que l'utilisateur veut *vraiment* avant tout plan/spec/code. |
| `aos-idea-refine` | Raffine une idée brute en concept actionnable (divergent + convergent). |
| `aos-spec-driven-development` | Crée un spec (requirements + acceptance criteria) **avant** de coder. |

### Phase PLAN (planifier)

| Skill | Rôle |
|-------|------|
| `aos-planning-and-task-breakdown` | Décompose un spec en tâches ordonnées et vérifiables. |
| `aos-context-engineering` | Optimise le contexte de l'agent (quoi charger, quand). |

### Phase BUILD (construire)

| Skill | Rôle |
|-------|------|
| `aos-incremental-implementation` | Livre par tranches verticales, testées avant d'étendre. |
| `aos-source-driven-development` | Vérifie chaque décision contre la doc officielle. |
| `aos-doubt-driven-development` | Revue adverse (fresh-context) de chaque décision non-triviale. |
| `aos-frontend-ui-engineering` | UI production : accessibilité, responsive, qualité. |
| `aos-api-and-interface-design` | Conception d'API stables avec contrats clairs. |

### Phase VERIFY (vérifier)

| Skill | Rôle |
|-------|------|
| `aos-test-driven-development` | Test qui échoue d'abord (RED), puis code qui passe (GREEN). |
| `aos-browser-testing-with-devtools` | Tests runtime via Chrome DevTools MCP. |
| `aos-debugging-and-error-recovery` | Reproduire → localiser → fixer → garder. |
| `aos-observability-and-instrumentation` | Logs structurés, métriques RED, traces, alertes. |

### Phase REVIEW (revoir)

| Skill | Rôle |
|-------|------|
| `aos-code-review-and-quality` | Revue 5 axes : correctness, readability, architecture, security, performance. |
| `aos-code-simplification` | Réduit la complexité en préservant le comportement. |
| `aos-security-and-hardening` | OWASP, validation input, least privilege. |
| `aos-performance-optimization` | Mesure d'abord, optimise ce qui compte. |

### Phase SHIP (livrer)

| Skill | Rôle |
|-------|------|
| `aos-git-workflow-and-versioning` | Commits atomiques, historique propre. |
| `aos-ci-cd-and-automation` | Quality gates automatisés sur chaque changement. |
| `aos-deprecation-and-migration` | Retirer les vieux systèmes et migrer les utilisateurs. |
| `aos-documentation-and-adrs` | Documenter le *pourquoi*, pas juste le *quoi*. |
| `aos-shipping-and-launch` | Checklist pre-launch, monitoring, plan de rollback. |

### Méta-skill

| Skill | Rôle |
|-------|------|
| `aos-using-agent-skills` | Routeur : découvre et invoque le bon skill selon la tâche. |

---

## 4. Utilisation dans ZCode

### Déclenchement automatique

ZCode charge automatiquement tous les skills présents dans `.agents/skills/` au démarrage de session. **Tu n'as rien à faire** — l'agent détecte le bon skill via la `description`.

Exemples :
- Tu écris « review ce code » → ZCode propose `aos-code-review-and-quality`.
- Tu écris « fix ce bug » → `aos-debugging-and-error-recovery`.
- Tu écris « déploie en prod » → `aos-shipping-and-launch`.

### Invocation explicite

Tu peux forcer un skill avec la slash syntax :

```
/aos-code-review-and-quality
/aos-security-and-hardening
/aos-test-driven-development
/aos-shipping-and-launch
```

### Liste complète des commandes slash ZCode

```
/aos-interview-me
/aos-idea-refine
/aos-spec-driven-development
/aos-planning-and-task-breakdown
/aos-context-engineering
/aos-incremental-implementation
/aos-source-driven-development
/aos-doubt-driven-development
/aos-frontend-ui-engineering
/aos-api-and-interface-design
/aos-test-driven-development
/aos-browser-testing-with-devtools
/aos-debugging-and-error-recovery
/aos-observability-and-instrumentation
/aos-code-review-and-quality
/aos-code-simplification
/aos-security-and-hardening
/aos-performance-optimization
/aos-git-workflow-and-versioning
/aos-ci-cd-and-automation
/aos-deprecation-and-migration
/aos-documentation-and-adrs
/aos-shipping-and-launch
/aos-using-agent-skills
```

---

## 5. Utilisation dans OpenCode

### Important : pas de déclenchement automatique natif

OpenCode **ne route pas automatiquement** les skills comme le fait ZCode/Claude Code. Deux façons de les utiliser :

#### Option A — Invocation explicite (slash commands)

Les 8 commands du repo sont installées dans `.opencode/command/` (projet) et `~/.config/opencode/command/` (global) :

```
/spec        → spec-driven-development
/plan        → planning-and-task-breakdown
/build       → incremental-implementation (+ test-driven-development)
/test        → test-driven-development
/review      → code-review-and-quality
/code-simplify → code-simplification
/ship        → shipping-and-launch (fan-out orchestrateur)
/webperf     → performance-optimization
```

#### Option B — Invocation manuelle du skill

```
/aos-code-review-and-quality
/aos-security-and-hardening
```

#### Option C — Workflow agent-driven (recommandé)

D'après la doc officielle `opencode-setup.md`, le pattern recommandé est de laisser l'agent sélectionner le skill via le prompt `AGENTS.md`. Les skills sont dans `.opencode/skills/` et l'agent les découvre par raisonnement.

Tu peux simplement écrire en langage naturel :
- « Design a feature » → spec-driven-development
- « Plan this change » → planning-and-task-breakdown
- « Fix this bug » → debugging-and-error-recovery
- « Review this » → code-review-and-quality

### Subagents OpenCode

4 subagents sont installés dans `.opencode/agent/` (utilisés notamment par `/ship`) :

| Subagent | Rôle |
|----------|------|
| `code-reviewer` | Revue 5 axes |
| `security-auditor` | Audit vulnérabilités (OWASP Top 10, secrets, CVEs) |
| `test-engineer` | Analyse de couverture de tests |
| `web-performance-auditor` | Audit performance web |

---

## 6. Les 8 commands (slash commands)

Ces commands sont des **raccourcis** qui orchestrent un ou plusieurs skills. Disponibles dans OpenCode (`.toml`) et ZCode (via le skill correspondant).

| Command | Skill(s) invoqué(s) | Ce qu'elle fait |
|---------|---------------------|-----------------|
| `/spec` | spec-driven-development | Crée un spec (requirements + acceptance criteria) avant de coder. |
| `/plan` | planning-and-task-breakdown | Décompose un spec en tâches ordonnées et vérifiables. |
| `/build` | incremental-implementation + test-driven-development | Implémente la tâche suivante : RED → GREEN → régression → build → commit. `/build auto` = tout le plan d'un coup. |
| `/test` | test-driven-development | Écrit un test qui échoue, puis le code qui le fait passer. |
| `/review` | code-review-and-quality | Revue 5 axes : correctness, readability, architecture, security, performance. |
| `/code-simplify` | code-simplification | Réduit la complexité sans changer le comportement. |
| `/ship` | shipping-and-launch (**fan-out**) | Lance 3 subagents en parallèle (review + security + test), puis merge en décision GO/NO-GO + plan de rollback. |
| `/webperf` | performance-optimization | Optimise la performance (mesure d'abord, optimise ce qui compte). |

### Détail `/ship` (le plus puissant)

`/ship` est un **orchestrateur fan-out** :
1. **Phase A** — Lance en parallèle `code-reviewer`, `security-auditor`, `test-engineer`.
2. **Phase B** — Merge les 3 rapports dans le contexte principal.
3. **Phase C** — Décision finale **GO / NO-GO** + plan de rollback obligatoire.

> ⚠️ Si un subagent retourne un finding **Critical**, le verdict par défaut est **NO-GO**.

---

## 7. Le cycle de vie de développement

Le méta-skill `aos-using-agent-skills` encode l'enchaînement type pour une feature complète :

```
1.  interview-me                 → Extraire le vrai besoin
2.  idea-refine                  → Raffiner l'idée
3.  spec-driven-development      → Définir ce qu'on construit
4.  planning-and-task-breakdown  → Découper en chunks vérifiables
5.  context-engineering          → Charger le bon contexte
6.  source-driven-development    → Vérifier contre la doc officielle
7.  incremental-implementation   → Construire tranche par tranche
8.  observability-and-instrumentation → Instrumenter en parallèle (pas après)
9.  doubt-driven-development     → Croiser les décisions non-triviales
10. test-driven-development      → Prouver que chaque tranche marche
11. code-review-and-quality      → Review avant merge
12. code-simplification          → Réduire la complexité
13. git-workflow-and-versioning  → Historique propre
14. documentation-and-adrs       → Documenter les décisions
15. deprecation-and-migration    → Retirer les vieux systèmes si besoin
16. shipping-and-launch          → Déployer safely
```

**Pas besoin de tout faire pour chaque tâche.** Un bug fix = `debugging` → `test-driven` → `review`. Une feature complète suit toute la chaîne.

---

## 8. Intégration avec les skills PariScore existants

### Cohabitation

Tes 46 skills PariScore et les 24 skills addyosmani sont **complémentaires** :

| Besoin | Skill PariScore | Skill addyosmani équivalent |
|--------|-----------------|-----------------------------|
| Code review Node.js/SQLite | `agency-code-reviewer` (contextualisé FR) | `aos-code-review-and-quality` (générique 5 axes) |
| Sécurité | `agency-security-architect` (STRIDE, OWASP) | `aos-security-and-hardening` (OWASP, input validation) |
| Debug visuel | `playwright-mcp` | `aos-browser-testing-with-devtools` |
| API testing | `agency-api-tester` | `aos-api-and-interface-design` (design, pas test) |
| DB | `agency-database-optimizer` | (pas d'équivalent direct) |

### Quand utiliser lequel ?

- **Skills PariScore** (`agency-*`, `metier-*`) → quand tu veux le **contexte spécifique** (Node ES5, better-sqlite3, conventions FR, structure server.js/pariscore.html).
- **Skills addyosmani** (`aos-*`) → quand tu veux la **méthodologie générique** de qualité (TDD strict, spec-driven, fan-out ship, lifecycle complet).

### Exemple de workflow hybride pour PariScore

```
1. /aos-spec-driven-development     → spec de la nouvelle stratégie de paris
2. /aos-planning-and-task-breakdown → découpage en tâches
3. /aos-incremental-implementation  → coder tranche par tranche
4. /aos-test-driven-development     → tests (même si PariScore n'a pas de suite — créer des tests ad hoc)
5. /agency-code-reviewer            → review contextualisée PariScore (SQLite paramétré, XSS _jsStr, etc.)
6. /aos-security-and-hardening      → checklist OWASP générique en complément
7. /ship                            → fan-out review + security + test → GO/NO-GO
```

---

## 9. Maintenance & mises à jour

### Vérifier que tout est en place

```bash
# Compter les skills installés (doit afficher 24 partout)
ls .agents/skills/ | grep -c "^aos-"          # ZCode projet : 24
ls .opencode/skills/ | grep -c "^aos-"        # OpenCode projet : 24

# Vérifier le plugin ZCode global
ls ~/.zcode/cli/plugins/cache/zcode-plugins-official/agent-skills/0.1.0/skills/ | grep -c "^aos-"

# Vérifier OpenCode global
ls ~/.config/opencode/skills/ | grep -c "^aos-"
```

### Mettre à jour depuis le repo upstream

```bash
# 1. Cloner la dernière version
git clone https://github.com/addyosmani/agent-skills.git /tmp/agent-skills-latest

# 2. Re-copier les skills (idem procédure d'installation)
# Voir le script .context/agent-skills-docs/ ou relancer l'installation
```

### Désinstaller

```bash
# Projet ZCode
rm -rf .agents/skills/aos-* .agents/aos-references/

# Projet OpenCode
rm -rf .opencode/skills/aos-* .opencode/aos-references/ .opencode/command/*.toml .opencode/agent/*.md

# ZCode global
rm -rf ~/.zcode/cli/plugins/cache/zcode-plugins-official/agent-skills/
# + retirer l'entrée "agent-skills" de marketplace.json

# OpenCode global
rm -rf ~/.config/opencode/skills/aos-* ~/.config/opencode/aos-references/
```

---

## 10. Dépannage

### Un skill ne se déclenche pas automatiquement
- **ZCode** : vérifie que le dossier `.agents/skills/aos-NOM/SKILL.md` existe et que le frontmatter a un champ `name:` et `description:`.
- **OpenCode** : le déclenchement auto n'est pas natif. Utilise l'invocation explicite (`/aos-NOM`) ou le workflow agent-driven via `AGENTS.md`.

### Conflit de nom
- Les skills addyosmani sont préfixés `aos-` — il ne devrait pas y avoir de conflit avec les skills PariScore. Vérifie avec : `ls .agents/skills/ | sort | uniq -d` (ne doit rien afficher).

### Une command OpenCode ne marche pas
- Vérifie que le fichier `.toml` est dans `.opencode/command/` (projet) ou `~/.config/opencode/command/` (global).
- Le format TOML doit avoir `description = "..."` et `prompt = """..."""`.

### Le plugin ZCode global n'apparaît pas
- Vérifie l'entrée dans `~/.zcode/cli/plugins/marketplaces/zcode-plugins-official/marketplace.json`.
- Le `cachePath` doit pointer vers un dossier existant contenant `.zcode-plugin/plugin.json`.

---

## Références

- **Repo source** : https://github.com/addyosmani/agent-skills
- **Doc originale** (11 fichiers) : `.context/agent-skills-docs/`
  - `skill-anatomy.md` — anatomie d'un skill
  - `opencode-setup.md` — setup OpenCode détaillé
  - `getting-started.md` — guide de démarrage
  - `comparison.md` — comparaison entre plateformes
- **Checklists partagées** : `.agents/aos-references/` (ZCode) et `.opencode/aos-references/` (OpenCode)
  - `security-checklist.md` — checklist OWASP (pre-commit + runtime)
  - `performance-checklist.md`
  - `definition-of-done.md` — barre de qualité pour tout changement
  - `observability-checklist.md`
  - `testing-patterns.md`
  - `accessibility-checklist.md`
  - `orchestration-patterns.md` — patterns multi-agents
