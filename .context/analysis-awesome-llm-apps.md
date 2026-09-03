# Analyse Comparative : awesome-llm-apps vs Pariscore

> **Dépôt source**: [Shubhamsaboo/awesome-llm-apps](https://github.com/Shubhamsaboo/awesome-llm-apps) (134k ⭐, Apache-2.0)
> **Date d'analyse**: 2026-08-25
> **Objectif**: Identifier les patterns avancés adoptables pour améliorer notre configuration opencode/cline

---

## 1. Vue d'ensemble

| Aspect | awesome-llm-apps | Pariscore |
|--------|------------------|-----------|
| **Nature** | Collection de templates IA (100+ agents, RAG apps) | Application web sportive (Next.js 16 + Bun) |
| **Licence** | Apache-2.0 (commercial libre) | Propriétaire |
| **Focus** | Agents IA, skills, RAG | Scraping, betting, mobile |
| **Agent Skills** | 15+ skills avec scripts Python | 60+ skills (design, scraping, betting) |
| **Architecture** | Templates modulaires par use-case | Monorepo Next.js complet |
| **Documentation** | SKILL.md détaillé + references/ | AGENTS.md + session history |

---

## 2. Patterns Avancés Identifiés

### 2.1. Agent Skills avec Scripts Python Autonomes (+)

**awesome-llm-apps** crée des skills **complètement autonomes** avec :

```
agent_skills/
├── project-graveyard/
│   ├── SKILL.md              # Documentation complète
│   ├── scripts/
│   │   └── graveyard.py      # Script Python standalone
│   └── references/
│       └── causes-of-death.md # Guide d'interprétation
├── scope-creep-detector/
│   ├── SKILL.md
│   ├── scripts/
│   │   └── scope_creep.py
│   └── references/
│       └── scope-signals.md
└── dependency-doctor/
    ├── SKILL.md
    ├── scripts/
    │   └── dep_doctor.py
    └── references/
        └── dependency-pitfalls.md
```

**Notre config actuelle** : Skills avec scripts Node.js/Python mais pas de structure `references/` pour guide d'interprétation.

**+ Adoptable** : Ajouter un dossier `references/` dans chaque skill complexe avec des guides d'interprétation.

---

### 2.2. SKILL.md avec Frontmatter Structuré (+)

**awesome-llm-apps** utilise un **frontmatter YAML** standardisé :

```yaml
---
name: project-graveyard
description: >-
  Scans the developer's machine for dead side projects...
license: Apache-2.0
metadata:
  author: "Shubham Saboo"
  version: "1.0.0"
  source: "https://github.com/Shubhamsaboo/awesome-llm-apps"
---
```

**Notre config** : SKILL.md avec header mais pas de frontmatter YAML formel.

**+ Adoptable** : Standardiser le frontmatter de tous nos skills avec :
- `name`, `description`, `license`
- `metadata.author`, `metadata.version`, `metadata.source`

---

### 2.3. Sections "When to use" / "When not to use" (+)

**awesome-llm-apps** définit **explicitement** les cas d'usage et non-usage :

```markdown
## When to use
- The user asks about abandoned/unfinished/old side projects
- The user wants to revive, resurrect, or "finally ship" something

## When not to use
- Cleaning up disk space or node_modules
- Archiving repos on GitHub
- Analyzing one specific repo's history in depth
```

**Notre config** : Pas de sections "When not to use" dans les skills.

**+ Adoptable** : Ajouter des sections "When not to use" pour éviter les mauvais déclenchements.

---

### 2.4. Scripts Python avec JSON Output (+)

**awesome-llm-apps** standardise la sortie JSON :

```json
{
  "file": "/path/to/requirements.txt",
  "findings": [
    {
      "severity": "high",
      "kind": "stdlib-shadowing",
      "package": "pathlib",
      "line": 4,
      "why": "...",
      "fix": "..."
    }
  ],
  "summary": {
    "total": 1,
    "by_severity": {"high": 1}
  }
}
```

**Notre config** : Scripts avec stdout/free-form, pas de JSON standardisé.

**+ Adoptable** : Standardiser la sortie de nos scripts en JSON structuré.

---

### 2.5. Mode "Necromancer" / Context-Aware (+)

**awesome-llm-apps** a un **mode context-aware** qui adapte le comportement :

```markdown
## Necromancer mode
When the user proposes building something new, check the graveyard for prior
attempts before scaffolding anything — grep the state file for name and README overlap.
```

**Notre config** : Pas de modes contextuels dans les skills.

**+ Adoptable** : Ajouter des modes spécialisés dans nos skills (ex: mode "resume", mode "audit").

---

### 2.6. State Persistence avec Fichiers JSON (+)

**awesome-llm-apps** persiste l'état dans des fichiers JSON :

```bash
python3 scripts/graveyard.py --state ~/.project-graveyard.json \
    --mark-resurrected /path/to/the/corpse
```

**Notre config** : `bd` pour le tracking, mais pas de fichiers de state par skill.

**+ Adoptable** : Pour les skills qui ont besoin de mémoire (ex: project-graveyard, learning paths), utiliser des fichiers JSON de state.

---

### 2.7. Evidence Rules / Confidence Labels (+)

**awesome-llm-apps** définit des **règles d'évidence** et **labels de confiance** :

```markdown
## Evidence Rules
- Current blame ownership is not proof of original authorship.
- The oldest selected commit is the region's introduction, not always the file's first commit.
- Repeated co-change suggests coupling; it does not prove a dependency.
```

**Notre config** : Pas de rules d'évidence formelles.

**+ Adoptable** : Pour les skills d'analyse (code review, audit), ajouter des evidence rules.

---

### 2.8. Offers (pas d'actions automatiques) (+)

**awesome-llm-apps** **propose** mais n'agit pas sans confirmation :

```markdown
## The resurrection
Ask before touching the repo. Then offer to start on step 1 right now —
that offer is the entire point of running this inside an agent.
```

**Notre config** : Pattern similaire dans "Proactiveness" mais pas formalisé par skill.

**+ Adoptable** : Formaliser le pattern "offer before action" dans chaque skill.

---

## 3. Ce que Nous Faisons Mieux

| Aspect | Notre avantage |
|--------|----------------|
| **MCP Servers** | 11 serveurs MCP vs 0 (game changer) |
| **Multi-plateforme** | opencode + cline + zcode vs templates isolés |
| **Production** | App de production vs templates théoriques |
| **Skills数量** | 60+ vs 15+ (couverture 4x plus large) |
| **Session Context** | Historique détaillé vs pas d'historique |
| **Memory** | bd (beads) + memory server vs fichiers JSON simples |
| **Deployment** | VPS + pm2 + Capacitor vs scripts locaux |

---

## 4. Améliorations Recommandées pour Pariscore

### Priorité Haute (Impact immédiat)

| # | Amélioration | Effort | Impact |
|---|--------------|--------|--------|
| 1 | **Ajouter `references/`** aux skills complexes | Faible | Élevé |
| 2 | **Standardiser frontmatter YAML** des SKILL.md | Faible | Moyen |
| 3 | **Ajouter "When not to use"** aux skills | Faible | Élevé |

### Priorité Moyenne (Impact à terme)

| # | Amélioration | Effort | Impact |
|---|--------------|--------|--------|
| 4 | **JSON output** pour les scripts Python | Moyen | Élevé |
| 5 | **Evidence rules** pour skills d'analyse | Faible | Moyen |
| 6 | **State files** pour skills à mémoire | Moyen | Moyen |

### Priorité Basse (Nice-to-have)

| # | Amélioration | Effort | Impact |
|---|--------------|--------|--------|
| 7 | **Modes contextuels** par skill | Élevé | Moyen |
| 8 | **Offer pattern** formalisé | Faible | Faible |

---

## 5. Skills Adaptables pour Pariscore

### 5.1. Scope Creep Detector (adapté)

**Utile pour** : Vérifier que nos PRs ne débordent pas du scope initial.

**Adaptation** :
```markdown
## When to use
- Avant de créer un PR dont le diff a grandi
- Quand un fix touche des fichiers inattendus
- Quand on demande si un changement est trop large

## When not to use
- Formatter le code (utiliser le linter)
- Reviewer la sécurité (utiliser security-review)
- Mesurer la croissance historique
```

---

### 5.2. Dependency Doctor (adapté)

**Utile pour** : Vérifier `package.json` et `bun.lock` avant les mises à jour.

**Adaptation** :
```markdown
## When to use
- Vérifier les dépendances avant une mise à jour
- Diagnostiquer un échec d'installation
- Suspecter de la "dependency rot"

## When not to use
- Installer les dépendances (utiliser bun install)
- Mettre à jour toutes les packages (processus séparé)
- Audit sécurité complet (utiliser npm audit / snyk)
```

---

### 5.3. Commit Archaeologist (adapté)

**Utile pour** : Comprendre pourquoi un fichier/function existe avant un refactor.

**Adaptation** :
```markdown
## When to use
- Demander "pourquoi ce code existe"
- Avant un rewrite ou refactor
- Comprendre un workaround ou fix temporaire

## When not to use
- Juste voir le blame (utiliser git blame)
- Supprimer ou réécrire l'historique
- Questions d'architecture globale
```

---

## 6. Code Snippets Adaptables

### Frontmatter Standard pour SKILL.md

```yaml
---
name: skill-name
description: >-
  Description longue du skill...
license: MIT
metadata:
  author: "PariScore Team"
  version: "1.0.0"
  source: "https://github.com/pariscore/pariscore"
---
```

### Sections When to use / When not to use

```markdown
## When to use
- Déclenchement 1
- Déclenchement 2
- Déclenchement 3

## When not to use
- Anti-pattern 1 (utiliser X à la place)
- Anti-pattern 2 (utiliser Y à la place)
- Anti-pattern 3 (hors périmètre)
```

### Evidence Rules pour Code Review

```markdown
## Evidence Rules
- Un fichier modifié n'est pas forcément lié au scope
- Un hunk gros n'est pas forcément du scope creep
- Un nouveau package n'est pas forcément une dépendance inutile
- Les formats de code sont des changements mécaniques, pas fonctionnels
```

### JSON Output Standard

```json
{
  "skill": "scope-creep-detector",
  "version": "1.0.0",
  "input": {
    "intent": "fix null dereference in parser",
    "diff_source": "staged"
  },
  "findings": [
    {
      "severity": "medium",
      "kind": "scope-creep",
      "file": "src/utils.ts",
      "reason": "No keyword overlap with intent",
      "signals": ["unrelated-file", "broad-change"],
      "disposition": "split"
    }
  ],
  "summary": {
    "total_files": 12,
    "in_scope": 10,
    "likely_creep": 2,
    "verdict": "minor-scope-creep"
  }
}
```

---

## 7. Conclusion

**awesome-llm-apps** est un excellent exemple de **collection de skills IA modulaires**. Ses forces principales sont :

1. **Structure standardisée** (SKILL.md + scripts/ + references/)
2. **Documentation exhaustive** (When to use/not to use, Evidence rules)
3. **Scripts autonomes** avec sortie JSON structurée
4. **State persistence** via fichiers JSON
5. **Patterns contextuels** (Necromancer mode, Relapse watch)

**Notre avantage** : Nous avons une application de production avec 60+ skills, 11 MCP servers, et un déploiement multi-plateforme. awesome-llm-apps est une collection de templates, nous sommes en production.

**Recommandation** : Adopter les patterns 1-3 (references/, frontmatter, When not to use) immédiatement — effort faible, impact élevé. Les patterns 4-6 (JSON output, evidence rules, state files) à moyen terme.

---

## 8. Skills Existant à Améliorer

| Skill actuel | Amélioration recommandée |
|--------------|--------------------------|
| `scraping-orchestrator` | Ajouter `references/anti-patterns.md` |
| `betting` | Ajouter "When not to use" + JSON output |
| `scrapling` | Ajouter `references/waf-bypass.md` |
| `code-reviewer` | Ajouter Evidence rules |
| `security-review` | Ajouter `references/owasp-top10.md` |
