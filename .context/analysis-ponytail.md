# Analyse Comparative : ponytail vs Pariscore

> **Dépôt source**: [DietrichGebert/ponytail](https://github.com/DietrichGebert/ponytail) (111k ⭐, MIT)
> **Date d'analyse**: 2026-08-25
> **Objectif**: Identifier les patterns avancés adoptables pour améliorer notre configuration opencode/cline

---

## 1. Vue d'ensemble

| Aspect | ponytail | Pariscore |
|--------|----------|-----------|
| **Nature** | Philosophie "lazy senior dev" (4 principes) | Application web sportive (Next.js 16 + Bun) |
| **Focus** | Minimal code, YAGNI, simplicité | Scraping, betting, mobile |
| **Format** | AGENTS.md + 5 skills | AGENTS.md + 60+ skills |
| **Intensité** | 3 niveaux (lite, full, ultra) | Pas de niveaux |
| **Multi-plateforme** | 8+ plugins (Claude, Cursor, Windsurf, etc.) | 3 (opencode, cline, zcode) |

---

## 2. La Philosophie "Lazy Senior Dev"

### Le Ladder (7 Échelons)

Avant d'écrire le moindre code, vérifier chaque échelon :

1. **Est-ce nécessaire?** (YAGNI) — Si c'est spécutatif, ne pas le faire
2. **Ça existe déjà dans le codebase?** — Réutiliser l'helper/util/pattern existant
3. **La stdlib le fait?** — L'utiliser
4. **Une feature native le fait?** — `<input type="date">` > lib picker, CSS > JS
5. **Une dépendance installée le fait?** — L'utiliser
6. **Ça peut être une ligne?** — Le faire en une ligne
7. **Seulement alors**: écrire le code minimum qui fonctionne

### Les Règles

- Pas d'abstractions non demandées
- Pas de boilerplate "pour plus tard"
- Suppression > ajout
- Boring > clever
- Le diff le plus court gagne (mais seulement quand on comprend le problème)

### Quand NE PAS être paresseux

- Validation des entrées aux frontières de confiance
- Gestion d'erreurs qui empêche la perte de données
- Sécurité
- Accessibilité
- Tout ce qui est explicitement demandé

---

## 3. Patterns Avancés Identifiés

### 3.1. Le Ladder (7 échelons) (+)

**ponytail** définit un **processus en 7 étapes** avant d'écrire du code :

```
1. Nécessaire? → 2. Existe? → 3. Stdlib? → 4. Native? → 5. Dep installée? → 6. Une ligne? → 7. Code minimum
```

**Notre config actuelle** : Rules mais pas de processus en étapes.

**+ Adoptable** : Ajouter un "ladder" simplifié dans nos Hard Rules.

---

### 3.2. Niveaux d'Intensité (+)

**ponytail** propose **3 niveaux** d'intensité :

| Niveau | Comportement |
|--------|--------------|
| **lite** | Construire ce qui est demandé, nommer l'alternative plus paresseuse |
| **full** | Ladder appliquée. Stdlib et natif en premier. Diff le plus court. |
| **ultra** | YAGNI extrémiste. Suppression avant ajout. Défier le requirements. |

**Notre config** : Pas de niveaux d'intensité.

**+ Adoptable** : Ajouter des modes (normal, strict, minimal) selon le contexte.

---

### 3.3. Skill ponytail-review (+)

**ponytail** a un **skill dédié au review** qui chasse la sur-complexité :

**Tags** :
- `delete:` — Code mort, flexibilité inutile
- `stdlib:` — Chose faite à la main que la stdlib fournit
- `native:` — Dépendance faisant ce que la plateforme fait déjà
- `yagni:` — Abstraction à une seule implémentation
- `shrink:` — Même logique, moins de lignes

**Format** : `L<line>: <tag> <what>. <replacement>.`

**Notre config** : `code-reviewer` mais pas de focus sur la sur-complexité.

**+ Adoptable** : Ajouter des tags de sur-complexité dans notre `code-reviewer`.

---

### 3.4. Output Format (+)

**ponytail** définit un **format de sortie** strict :

> Code first. Then at most three short lines: what was skipped, when to add it.
> Pattern: `[code] → skipped: [X], add when [Y].`

**Notre config** : Pas de format de sortie standardisé.

**+ Adoptable** : Ajouter un format de sortie pour les changements de code.

---

### 3.5. Ponytail Comments (+)

**ponytail** utilise des **commentaires spéciaux** pour marquer les simplifications délibérées :

```python
# ponytail: global lock, per-account locks if throughput matters
```

**Notre config** : Pas de mécanisme similaire.

**+ Adoptable** : Utiliser des commentaires `// pariscore:` pour marquer les simplifications.

---

### 3.6. Bug Fix = Root Cause (+)

**ponytail** insiste sur le **root cause**而非le symptôme :

> "Grep every caller of the function you touch and fix the shared function once — one guard there is a smaller diff than one per caller."

**Notre config** : Pas de règle explicite sur le root cause.

**+ Adoptable** : Ajouter cette règle dans nos Hard Rules.

---

### 3.7. Multi-Plugin Architecture (+)

**ponytail** supporte **8+ agents** :
- Claude Code
- Cursor
- Windsurf
- Codex
- Devin
- OpenCode
- Kiro
- Qoder

**Notre config** : 3 agents (opencode, cline, zcode).

**+ Adoptable** : Documenter la compatibilité multi-agent.

---

## 4. Ce que Nous Faisons Mieux

| Aspect | Notre avantage |
|--------|----------------|
| **MCP Servers** | 11 serveurs MCP vs 0 (game changer) |
| **Skills数量** | 60+ vs 5 (couverture 12x plus large) |
| **Production** | App de production vs philosophie théorique |
| **Memory** | bd (beads) + memory server vs pas de mémoire |
| **Session Context** | Historique détaillé vs pas d'historique |
| **Deployment** | VPS + pm2 + Capacitor |

---

## 5. Améliorations Recommandées pour Pariscore

### Priorité Haute (Impact immédiat)

| # | Amélioration | Effort | Impact |
|---|--------------|--------|--------|
| 1 | **Ajouter le Ladder** (7 échelons simplifié) | Faible | Élevé |
| 2 | **Ajouter le tag YAGNI** dans code review | Faible | Élevé |
| 3 | **Ajouter les ponytail comments** | Faible | Moyen |

### Priorité Moyenne (Impact à terme)

| # | Amélioration | Effort | Impact |
|---|--------------|--------|--------|
| 4 | **Ajouter les niveaux d'intensité** | Faible | Moyen |
| 5 | **Ajouter root cause rule** | Faible | Élevé |
| 6 | **Standardiser le format de sortie** | Faible | Moyen |

---

## 6. Code Snippets Adaptables

### Le Ladder pour Pariscore

```markdown
## Le Ladder (avant d'écrire du code)

Vérifier chaque échelon dans l'ordre :

1. **Nécessaire?** — Est-ce que l'utilisateur a vraiment demandé ça?
2. **Existe déjà?** — Chercher dans le codebase (Grep/Glob)
3. **Stdlib le fait?** — Utiliser les fonctions natives
4. **Native le fait?** — CSS > JS, HTML > lib, DB constraint > app code
5. **Dep installée?** — Utiliser ce qui est déjà dans package.json
6. **Une ligne?** — Si possible, le faire en une ligne
7. **Code minimum** — Seulement alors, écrire le strict nécessaire
```

### Tags de Sur-Complexité pour Code Review

```markdown
## Tags de Sur-Complexité

- `delete:` — Code mort, flexibilité inutile, feature spéculative
- `stdlib:` — Chose faite à la main que la stdlib fournit
- `native:` — Dépendance faisant ce que la plateforme fait déjà
- `yagni:` — Abstraction à une seule implémentation
- `shrink:` — Même logique, moins de lignes

Format : `L<line>: <tag> <what>. <replacement>.`
```

### Ponytail Comments

```markdown
## Ponytail Comments

Marquer les simplifications délibérées avec un commentaire :

```typescript
// parisTODO: global lock, per-account locks if throughput matters
const cache = new Map()
```

Tags : `parisTODO`, `parisFIXME`, `parisHACK`
```

### Root Cause Rule

```markdown
## Root Cause Rule

Bug fix = root cause, pas symptôme.

Avant de corriger :
1. Grep tous les appelants de la fonction
2. Corriger la fonction partagée une seule fois
3. Ne pas patcher uniquement le chemin nommé dans le ticket

> Un guard dans la fonction partagée est un diff plus petit
> qu'un guard dans chaque appelant.
```

### Format de Sortie

```markdown
## Format de Sortie (code changes)

```
[code] → skipped: [X], add when [Y].

Exemple :
@lru_cache(maxsize=1000) sur la fonction fetch.
→ skipped: custom cache class, add when lru_cache mesurably falls short.
```
```

---

## 7. Conclusion

**ponytail** est un excellent exemple de **philosophie de codage minimaliste**. Ses forces principales sont :

1. **Le Ladder** — Processus en 7 étapes avant d'écrire du code
2. **Les niveaux d'intensité** — lite, full, ultra
3. **Le skill review** — Tags de sur-complexité
4. **Les comments** — Marquer les simplifications délibérées
5. **Root cause** — Fixer le problème, pas le symptôme

**Notre avantage** : Nous avons une application de production avec 60+ skills, 11 MCP servers, et un déploiement multi-plateforme. ponytail est une philosophie, nous sommes en production.

**Recommandation** : Adopter le Ladder et les tags de sur-complexité immédiatement — effort faible, impact élevé. Ces principes peuvent être ajoutés à nos Hard Rules existantes.

---

## 8. Intégration Recommandée

### Dans AGENTS.md → Hard Rules

```markdown
## Le Ladder (avant d'écrire du code)

1. Nécessaire? → 2. Existe? → 3. Stdlib? → 4. Native? → 5. Dep? → 6. Une ligne? → 7. Code minimum

## Tags de Sur-Complexité

- `delete:` — Code mort
- `stdlib:` — Utiliser la stdlib
- `native:` — Utiliser la plateforme
- `yagni:` — Abstraction inutile
- `shrink:` — Moins de lignes

## Root Cause Rule

Bug fix = root cause, pas symptôme.
Grep tous les appelants, corriger une seule fois.
```
