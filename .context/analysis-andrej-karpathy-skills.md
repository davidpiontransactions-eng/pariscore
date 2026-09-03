# Analyse Comparative : andrej-karpathy-skills vs Pariscore

> **Dépôt source**: [multica-ai/andrej-karpathy-skills](https://github.com/multica-ai/andrej-karpathy-skills) (207k ⭐, MIT)
> **Date d'analyse**: 2026-08-25
> **Objectif**: Identifier les patterns avancés adoptables pour améliorer notre configuration opencode/cline

---

## 1. Vue d'ensemble

| Aspect | andrej-karpathy-skills | Pariscore |
|--------|------------------------|-----------|
| **Nature** | Guidelines LLM (4 principes) | Application web sportive (Next.js 16 + Bun) |
| **Focus** | Réduire les erreurs courantes des LLM | Scraping, betting, mobile |
| **Format** | Un seul fichier CLAUDE.md | AGENTS.md + 60+ skills |
| **Exemples** | Code avant/après détaillé | Pas d'exemples formalisés |
| **Auteur** | Andrej Karpathy (observations) | PariScore team |

---

## 2. Les 4 Principes de Karpathy

### Principe 1: Think Before Coding
**"Don't assume. Don't hide confusion. Surface tradeoffs."**

- Énoncer les hypothèses explicitement
- Présenter les interprétations multiples
- Pousser quand c'est justifié
- Arrêter quand on est confus

### Principe 2: Simplicity First
**"Minimum code that solves the problem. Nothing speculative."**

- Pas de features au-delà de ce qui est demandé
- Pas d'abstractions pour du code usage unique
- Pas de "flexibilité" non demandée
- Pas de gestion d'erreurs pour des scénarios impossibles
- Si 200 lignes peuvent être 50, réécrire

### Principe 3: Surgical Changes
**"Touch only what you must. Clean up only your own mess."**

- Ne pas "améliorer" le code adjacent
- Ne pas refactoriser ce qui fonctionne
- Matcher le style existant
- Mentionner le code mort, ne pas le supprimer

### Principe 4: Goal-Driven Execution
**"Define success criteria. Loop until verified."**

- Transformer les tâches en objectifs vérifiables
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- Planifier avec vérifications à chaque étape

---

## 3. Patterns Avancés Identifiés

### 3.1. Exemples Avant/Après Détaillés (+)

**andrej-karpathy-skills** fournit des **exemples concrets** montrant :
- ❌ Ce que les LLMs font de travers
- ✅ Ce qui devrait se passer

**Exemple** :
```python
# ❌ LLM overengineered (1000 lignes)
class DiscountStrategy(ABC):
    @abstractmethod
    def calculate(self, amount: float) -> float:
        pass
# ... 30+ lignes de setup

# ✅ Simple (3 lignes)
def calculate_discount(amount: float, percent: float) -> float:
    return amount * (percent / 100)
```

**Notre config actuelle** : Rules écrites mais pas d'exemples concrets.

**+ Adoptable** : Ajouter des exemples avan/après dans nos rules (Hard Rules, Tool Usage).

---

### 3.2. Le Test du Senior Engineer (+)

**andrej-karpathy-skills** définit un **test simple** pour valider la simplicité :

> "Would a senior engineer say this is overcomplicated? If yes, simplify."

**Notre config** : Pas de test de validation pour la complexité.

**+ Adoptable** : Ajouter ce test dans notre section "Simplicity" ou "Code Quality".

---

### 3.3. Le Test de Traçabilité (+)

**andrej-karpathy-skills** définit un **test de traçabilité** pour les changements :

> "Every changed line should trace directly to the user's request."

**Notre config** : Pas de test de traçabilité formel.

**+ Adoptable** : Ajouter ce test dans notre section "Tool Usage" ou "Proactiveness".

---

### 3.4. Goal-Driven avec Vérifications (+)

**andrej-karpathy-skills** transforme les tâches vagues en objectifs vérifiables :

```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

**Notre config** : `bd` pour le tracking, mais pas de format de plan avec vérifications.

**+ Adoptable** : Formaliser le format de plan avec `→ verify:` dans notre engineering loop.

---

### 3.5. Anti-Patterns Documentés (+)

**andrej-karpathy-skills** documente les **erreurs courantes** des LLMs :
- Assumptions silencieuses
- Over-engineering
- Drive-by refactoring
- Style drift

**Notre config** : Rules mais pas d'anti-patterns documentés.

**+ Adoptable** : Créer une section `## Anti-Patterns` dans AGENTS.md.

---

### 3.6. Tradeoff Conscient (+)

**andrej-karpathy-skills** explicite le **tradeoff** des guidelines :

> "These guidelines bias toward caution over speed. For trivial tasks, use judgment."

**Notre config** : Pas de tradeoff explicite.

**+ Adoptable** : Ajouter un tradeoff statement dans nos Hard Rules.

---

## 4. Ce que Nous Faisons Mieux

| Aspect | Notre avantage |
|--------|----------------|
| **MCP Servers** | 11 serveurs MCP vs 0 (game changer) |
| **Skills** | 60+ skills vs 4 principes (couverture bien plus large) |
| **Production** | App de production vs guidelines théoriques |
| **Multi-plateforme** | opencode + cline + zcode |
| **Memory** | bd (beads) + memory server vs pas de mémoire |
| **Session Context** | Historique détaillé vs pas d'historique |

---

## 5. Améliorations Recommandées pour Pariscore

### Priorité Haute (Impact immédiat)

| # | Amélioration | Effort | Impact |
|---|--------------|--------|--------|
| 1 | **Ajouter exemples avan/après** dans Hard Rules | Faible | Élevé |
| 2 | **Ajouter le test du senior engineer** | Faible | Élevé |
| 3 | **Ajouter le test de traçabilité** | Faible | Moyen |

### Priorité Moyenne (Impact à terme)

| # | Amélioration | Effort | Impact |
|---|--------------|--------|--------|
| 4 | **Formater les plans avec `→ verify:`** | Faible | Élevé |
| 5 | **Créer section Anti-Patterns** | Faible | Moyen |
| 6 | **Ajouter tradeoff statement** | Faible | Faible |

---

## 6. Code Snippets Adaptables

### Tradeoff Statement pour nos Hard Rules

```markdown
## Hard Rules

**Tradeoff:** Ces règles favorisent la qualité et la sécurité sur la vitesse.
Pour les tâches triviales, utiliser son jugement.
```

### Test du Senior Engineer

```markdown
## Simplicity Test

Avant de valider un code, se demander :
> "Un ingénieur senior dirait que c'est overcomplicated?"
Si oui → simplifier.

Règle : si 200 lignes peuvent être 50, réécrire.
```

### Test de Traçabilité

```markdown
## Traceability Test

Chaque ligne modifiée doit être traçable à la demande utilisateur.
Si une ligne n'est pas directement liée → ne pas la modifier.
```

### Plans avec Vérifications

```markdown
## Engineering Loop (traceability)

```
bd ready → bd show <id> → bd update <id> --claim
    ↓
Research (Grep/Glob/Read) → Implement (Edit/Write)
    ↓
Verify: lint + typecheck pass
    ↓
bd close <id> → bd dolt push
```
```

### Exemples Avant/Après pour Hard Rules

```markdown
## Exemples

### ❌ Over-engineering (ce qu'on évite)
```python
# 100 lignes pour un simple calcul
class DiscountStrategy(ABC):
    @abstractmethod
    def calculate(self, amount: float) -> float:
        pass
# ... 30+ lignes de setup
```

### ✅ Simple (ce qu'on fait)
```python
def calculate_discount(amount: float, percent: float) -> float:
    return amount * (percent / 100)
```
```

### Section Anti-Patterns

```markdown
## Anti-Patterns (erreurs courantes des LLMs)

1. **Assumptions silencieuses** — Demander au lieu de deviner
2. **Over-engineering** — Code simple > code "élégant"
3. **Drive-by refactoring** — Ne pas améliorer le code adjacent
4. **Style drift** — Matcher le style existant
5. **Speculative features** — Ne pas ajouter de features non demandées
```

---

## 7. Conclusion

**andrej-karpathy-skills** est un excellent exemple de **guidelines LLM ciblées**. Ses forces principales sont :

1. **4 principes clairs** et mémorables
2. **Exemples concrets** avant/après
3. **Tests simples** (senior engineer, traçabilité)
4. **Anti-patterns documentés**
5. **Tradeoff explicite** (qualité vs vitesse)

**Notre avantage** : Nous avons une application de production avec 60+ skills, 11 MCP servers, et un déploiement multi-plateforme. Karpathy-skills est un fichier de guidelines, nous sommes en production.

**Recommandation** : Adopter les patterns 1-3 (exemples, tests, anti-patterns) immédiatement — effort faible, impact élevé. Ces principes peuvent être ajoutés à nos Hard Rules existantes.

---

## 8. Intégration Recommandée

### Dans AGENTS.md → Hard Rules

```markdown
## Hard Rules

**Tradeoff:** Ces règles favorisent la qualité et la sécurité sur la vitesse.
Pour les tâches triviales, utiliser son jugement.

1. **NEVER commit secrets** — ...
2. **Simplicity First** — Code minimum qui résout le problème. Pas de features spéculatives.
   - Test : "Un ingénieur senior dirait que c'est overcomplicated?" → Simplifier
3. **Surgical Changes** — Toucher uniquement ce qui est nécessaire.
   - Test : Chaque ligne modifiée doit être traçable à la demande
4. **Goal-Driven Execution** — Transformer les tâches en objectifs vérifiables.
   - Format : `1. [Step] → verify: [check]`
...
```
