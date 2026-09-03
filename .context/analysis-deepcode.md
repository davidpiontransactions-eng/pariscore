# Analyse Comparative : DeepCode vs Pariscore

> **Dépôt source**: [HKUDS/DeepCode](https://github.com/HKUDS/DeepCode) (16.4k ⭐, MIT)
> **Date d'analyse**: 2026-08-25
> **Objectif**: Identifier les patterns avancés adoptables pour améliorer notre configuration opencode/cline

---

## 1. Vue d'ensemble

| Aspect | DeepCode | Pariscore |
|--------|----------|-----------|
| **Nature** | Framework Agentic Coding (multi-agent) | Application web sportive (Next.js 16 + Bun) |
| **Focus** | Orchestration multi-agent, vérification | Scraping, betting, mobile |
| **Architecture** | Agent runtime + loops + harness + MCP | AGENTS.md + 60+ skills |
| **Prompts** | Templates YAML détaillés | Rules écrites |
| **Vérification** | Test discovery automatisé | lint + typecheck manuels |

---

## 2. Architecture DeepCode

### 2.1. Agent Runtime

DeepCode a une architecture sophistiquée :

```
core/
├── agent_presets/     # Configurations d'agents prédéfinies
├── agent_runtime/     # Boucle d'exécution des agents
├── application/       # Couche application
├── harness/          # Orchestration des agents
├── loop/             # Boucles de travail
├── mcp/              # Integration MCP
├── observability/    # Monitoring et logs
├── persistence/      # Stockage état
├── plugins/          # Système de plugins
├── sessions/         # Gestion des sessions
├── skills/           # Skills agents
├── team/             # Gestion d'équipe
├── verification.py   # Vérification automatisée
└── reasoning.py      # Raisonnement
```

### 2.2. Prompts Structurés

DeepCode utilise des **prompts YAML structurés** avec :

```yaml
algorithm_name: "[Exact name from paper]"
section: "[e.g., Section 3.2]"
pseudocode: |
  [COPY THE EXACT PSEUDOCODE FROM PAPER]
mathematical_formulation:
  - equation: "[Copy formula EXACTLY]"
    where:
      L_task: "task loss"
```

**Notre config** : Rules écrites mais pas de templates YAML structurés.

---

## 3. Patterns Avancés Identifiés

### 3.1. Verification System (+)

DeepCode a un **système de vérification automatisé** :

```python
def discover_verification_commands(root: Path) -> tuple[VerificationCommand, ...]:
    # Découvre automatiquement les tests
    # pytest, unittest, npm test, cargo test
    # Retourne les commandes à exécuter
```

**Notre config** : `bun run lint` + `bun run typecheck` manuels.

**+ Adoptable** : Créer un script de vérification automatisée qui découvre les tests.

---

### 3.2. Agent Presets (+)

DeepCode a des **presets d'agents** prédéfinis :

```
core/agent_presets/
```

**Notre config** : Pas de presets, chaque skill est standalone.

**+ Adoptable** : Créer des presets pour les workflows courants (scraping, betting, etc.).

---

### 3.3. Observability (+)

DeepCode a un module **observability** dédié :

```
core/observability/
```

**Notre config** : PostHog + Sentry mais pas de module dédié aux agents.

**+ Adoptable** : Ajouter de l'observabilité aux interactions agents.

---

### 3.4. Session Management (+)

DeepCode gère les **sessions** :

```
core/sessions/
```

**Notre config** : `bd` pour le tracking, mais pas de gestion de sessions agents.

**+ Adoptable** : Ajouter la gestion de sessions pour les workflows longs.

---

### 3.5. Team Management (+)

DeepCode a un module **team** :

```
core/team/
```

**Notre config** : Pas de gestion d'équipe.

**+ Adoptable** : Utile si on ajoute des agents collaboratifs.

---

### 3.6. Structured Output Format (+)

DeepCode utilise des **formats de sortie YAML structurés** :

```yaml
complete_algorithm_extraction:
  paper_structure:
    method_sections: "[3, 3.1, 3.2, 3.3, 4]"
    algorithm_count: "[total number found]"
  main_algorithm:
    [COMPLETE DETAILS AS ABOVE]
```

**Notre config** : JSON libre.

**+ Adoptable** : Standardiser les sorties en YAML/JSON structuré.

---

### 3.7. Prompt Engineering Avancé (+)

DeepCode a des **prompts détaillés** avec :

- Instructions d'segmentation intelligente
- Critères de pondération (40%, 30%, 20%, 10%)
- Formats de sortie stricts
- Contraintes explicites

**Notre config** : Prompts plus simples.

**+ Adoptable** : Enrichir nos prompts avec des structures similaires.

---

## 4. Ce que Nous Faisons Mieux

| Aspect | Notre avantage |
|--------|----------------|
| **MCP Servers** | 11 serveurs MCP vs ~0 (game changer) |
| **Skills数量** | 60+ vs presets (couverture bien plus large) |
| **Production** | App de production vs framework théorique |
| **Memory** | bd (beads) + memory server vs persistence basique |
| **Multi-plateforme** | opencode + cline + zcode |
| **Deployment** | VPS + pm2 + Capacitor |

---

## 5. Améliorations Recommandées pour Pariscore

### Priorité Haute (Impact immédiat)

| # | Amélioration | Effort | Impact |
|---|--------------|--------|--------|
| 1 | **Script de vérification automatisée** | Moyen | Élevé |
| 2 | **Presets de workflows** | Faible | Élevé |
| 3 | **Structured output format** | Faible | Moyen |

### Priorité Moyenne (Impact à terme)

| # | Amélioration | Effort | Impact |
|---|--------------|--------|--------|
| 4 | **Observability module** | Moyen | Moyen |
| 5 | **Session management** | Moyen | Moyen |
| 6 | **Prompt templates YAML** | Moyen | Élevé |

---

## 6. Code Snippets Adaptables

### Script de Vérification Automatisée

```python
#!/usr/bin/env python3
"""Script de vérification automatisée pour Pariscore."""

from pathlib import Path
import subprocess
import json

def discover_verification_commands(root: Path) -> list[dict]:
    """Découvre automatiquement les commandes de vérification."""
    commands = []
    
    # Bun lint
    if (root / "package.json").exists():
        commands.append({
            "id": "bun-lint",
            "label": "Bun Lint",
            "cmd": ["bun", "run", "lint"]
        })
    
    # Bun typecheck
    if (root / "tsconfig.json").exists():
        commands.append({
            "id": "bun-typecheck",
            "label": "Bun Typecheck",
            "cmd": ["bun", "run", "typecheck"]
        })
    
    # Playwright tests
    if (root / "tests").exists():
        commands.append({
            "id": "playwright",
            "label": "Playwright Tests",
            "cmd": ["bun", "run", "test"]
        })
    
    return commands

def run_verification(root: Path, command: dict, timeout: int = 300) -> dict:
    """Exécute une commande de vérification."""
    try:
        result = subprocess.run(
            command["cmd"],
            cwd=root,
            capture_output=True,
            timeout=timeout,
            text=True
        )
        return {
            "command": command["id"],
            "passed": result.returncode == 0,
            "stdout": result.stdout[-4096:],
            "stderr": result.stderr[-2048:]
        }
    except subprocess.TimeoutExpired:
        return {
            "command": command["id"],
            "passed": False,
            "error": "timeout"
        }
```

### Presets de Workflows

```markdown
## Workflow Presets

### Scraping Pipeline
```
1. [Research] → verify: source analyzed
2. [Scrape] → verify: data extracted
3. [Transform] → verify: schema valid
4. [Store] → verify: DB updated
```

### Betting Analysis
```
1. [Fetch Odds] → verify: odds received
2. [De-vig] → verify: fair probabilities
3. [Edge Detection] → verify: edge calculated
4. [Recommendation] → verify: bet sized
```

### Mobile Build
```
1. [Assets] → verify: icons generated
2. [Sync] → verify: capacitor synced
3. [Build] → verify: APK created
4. [QA] → verify: tests passed
```
```

### Structured Output Format

```yaml
# Format de sortie standardisé pour Pariscore
task_result:
  status: "success|failed|partial"
  summary: "Brief summary"
  details:
    [DETAILED OUTPUT]
  metrics:
    duration_ms: 1234
    files_changed: 5
    lines_added: 100
    lines_removed: 20
  next_steps:
    - "Step 1"
    - "Step 2"
```

### Observability Hooks

```typescript
// Hook d'observabilité pour les agents
interface AgentObservability {
  trackInteraction(agent: string, action: string, duration: number): void;
  logDecision(agent: string, decision: string, reasoning: string): void;
  metrics(): AgentMetrics;
}

// Intégration avec PostHog
const observability: AgentObservability = {
  trackInteraction: (agent, action, duration) => {
    posthog.capture('agent_interaction', { agent, action, duration });
  },
  logDecision: (agent, decision, reasoning) => {
    posthog.capture('agent_decision', { agent, decision, reasoning });
  }
};
```

---

## 7. Conclusion

**DeepCode** est un excellent exemple de **framework agentic coding**. Ses forces principales sont :

1. **Architecture modulaire** — Agent runtime, loops, harness, MCP
2. **Vérification automatisée** — Test discovery multi-langage
3. **Prompts structurés** — Templates YAML détaillés
4. **Observabilité** — Module dédié au monitoring
5. **Session management** — Gestion d'état avancée

**Notre avantage** : Nous avons une application de production avec 60+ skills, 11 MCP servers, et un déploiement multi-plateforme. DeepCode est un framework théorique, nous sommes en production.

**Recommandation** : Adopter le script de vérification automatisée et les presets de workflows immédiatement — effort moyen, impact élevé. Les prompts YAML structurés à terme.

---

## 8. Intégration Recommandée

### Dans scripts/

```python
# scripts/verify.py
"""Vérification automatisée pour Pariscore."""
# Découvre et exécute lint, typecheck, tests
```

### Dans AGENTS.md

```markdown
## Workflow Presets

### Scraping Pipeline
1. [Research] → verify: source analyzed
2. [Scrape] → verify: data extracted
3. [Transform] → verify: schema valid
4. [Store] → verify: DB updated

### Betting Analysis
1. [Fetch Odds] → verify: odds received
2. [De-vig] → verify: fair probabilities
3. [Edge Detection] → verify: edge calculated
4. [Recommendation] → verify: bet sized
```
