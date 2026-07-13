# Front-End Checklist — Guide d'utilisation (ZCode, OpenCode, PariScore)

> Source : [`thedaviddias/Front-End-Checklist`](https://github.com/thedaviddias/Front-End-Checklist) — 390 règles de QA frontend.
> Installation : **10 juillet 2026** — MCP server + 3 skills + référentiel local.

---

## Sommaire

1. [Qu'est-ce que le Front-End Checklist ?](#1-quest-ce-que-le-front-end-checklist-)
2. [Ce qui a été installé](#2-ce-qui-a-été-installé)
3. [Les 11 outils MCP](#3-les-11-outils-mcp)
4. [Utilisation dans ZCode](#4-utilisation-dans-zcode)
5. [Utilisation dans OpenCode](#5-utilisation-dans-opencode)
6. [Les 11 catégories de règles](#6-les-11-catégories-de-règles)
7. [Workflows types pour PariScore](#7-workflows-types-pour-pariscore)
8. [Référentiel local](#8-référentiel-local)

---

## 1. Qu'est-ce que le Front-End Checklist ?

Un **système de QA frontend** avec 390 règles vérifiables, organisées en 11 catégories. Chaque règle a :
- Un **niveau de priorité** : 🔴 Critical / 🟠 High / 🟡 Medium / 🟢 Low
- Une **vérification** (comment tester)
- Un **remède** (comment fixer)
- Une **explication** (pourquoi c'est important)

Contrairement à une simple checklist, ce projet expose un **serveur MCP** qui permet aux agents IA d'auditer du code en direct contre les 390 règles.

---

## 2. Ce qui a été installé

| Composant | Emplacement | Rôle |
|-----------|-------------|------|
| **MCP server** | `.mcp.json` → `frontendchecklist` | Sert les 390 règles + 11 outils d'audit en direct |
| **Skill `fec-global`** | `.agents/skills/` + `.opencode/skills/` | Point d'entrée d'audit global (workflow complet) |
| **Skill `fec-accessibility-testing`** | `.agents/skills/` + `.opencode/skills/` | Audit accessibilité ciblé |
| **Skill `fec-https`** | `.agents/skills/` + `.opencode/skills/` | Audit sécurité HTTPS |
| **Référentiel local** | `.context/frontend-checklist/rules-priorisees.md` | Condensé des règles Critical/High hors-ligne |

> **Note** : Nous n'avons pas installé les 390 skills individuellement — ce serait de la pollution. Le skill `fec-global` + le MCP couvrent tous les cas d'usage.

---

## 3. Les 11 outils MCP

Le serveur MCP `frontendchecklist` expose 11 outils utilisables par ZCode et OpenCode :

| Outil | Description | Exemple d'usage |
|-------|-------------|-----------------|
| `review_code` | Audite du code HTML/CSS/JS collé | Auditer un extrait de pariscore.html |
| `audit_url` | Audite une URL publique | Auditer le site en prod |
| `search_rules` | Cherche des règles par mot-clé | `search_rules "modal"` |
| `get_rule` | Détail complet d'une règle | `get_rule "avoid-eval"` |
| `check_rule` | Prompt de vérification pour une règle | `check_rule "alt-text"` |
| `fix_rule` | Guide de remédiation | `fix_rule "color-contrast"` |
| `explain_rule` | Pourquoi cette règle importe | `explain_rule "defer-async"` |
| `get_workflow` | Workflow d'audit guidé par thème | `get_workflow "accessibility"` |
| `get_checklist_rules` | Toutes les règles d'une checklist | `get_checklist_rules "launch"` |
| `list_categories` | Liste les 11 catégories | — |
| `get_quick_reference` | Checklist compacte filtrée par priorité | — |

---

## 4. Utilisation dans ZCode

### Audit automatique

Le MCP est déjà configuré dans `.mcp.json`. Au prochain démarrage de ZCode, le serveur `frontendchecklist` sera chargé automatiquement.

Tu peux demander en langage naturel :
- « Audite la modal tennis de pariscore.html avec le Front-End Checklist »
- « Vérifie les règles Critical du Front-End Checklist sur le `<head>` de pariscore.html »
- « Quelles règles Front-End Checklist s'appliquent au XSS onclick ? »

### Invocation explicite du skill

```
/fec-global
/fec-accessibility-testing
/fec-https
```

### Exemple de commande d'audit

```
Utilise le Front-End Checklist MCP pour reviewer le formulaire de login 
dans pariscore.html. Reporte les findings Critical et High en premier.
```

---

## 5. Utilisation dans OpenCode

### Via les skills

Les 3 skills sont dans `.opencode/skills/`. Tu peux les invoquer :
- Explicitement : `/fec-global`
- En langage naturel : « Audit accessibility de pariscore.html »

### Via le MCP

Le MCP est dans `.mcp.json` (partagé ZCode/OpenCode). Les outils `review_code`, `search_rules`, `get_rule` sont disponibles.

---

## 6. Les 11 catégories de règles

| Catégorie | Nombre | Priorité PariScore | Focus |
|-----------|--------|-------------------|-------|
| **HTML** | 25 | 🔴 Haute | Doctype, charset, viewport, sémantique, IDs uniques |
| **CSS** | 32 | 🟠 Moyenne | Pas d'inline CSS, focus indicators, animations GPU, dark mode |
| **JavaScript** | 26 | 🔴 Haute | Pas de `eval`, gestion erreurs, debounce, memory leaks |
| **Performance** | 43 | 🔴 Haute | LCP, CLS, INP, lazy load, service worker, preconnect |
| **Accessibility** | 95 | 🔴 Haute | Labels, contraste, navigation clavier, ARIA, modales |
| **SEO** | 94 | 🟠 Moyenne | Title, meta description, canonical, Open Graph, sitemap |
| **Security** | 22 | 🔴 Haute | HTTPS, CSP, security headers, noopener, pas de secrets client |
| **Images** | 25 | 🟡 Moyenne | Dimensions, lazy load, srcset, WebP/AVIF, alt text |
| **Testing** | 13 | 🟡 Basse | Pas de suite de tests dans PariScore |
| **Privacy** | 5 | 🟡 Moyenne | Cookies, GDPR, consent |
| **i18n** | 5 | 🟢 Basse | PariScore = FR uniquement |

---

## 7. Workflows types pour PariScore

### Workflow 1 : Audit complet avant déploiement

```
1. /fec-global                          → Lance l'audit global
2. MCP audit_url "https://pariscore..." → Audite le site en prod
3. MCP get_workflow "launch"            → Checklist de lancement
4. Fixer tous les Critical, puis High
```

### Workflow 2 : Audit accessibilité des modales tennis

```
1. /fec-accessibility-testing
2. MCP review_code "<HTML de la modal>"  → Audit le code
3. MCP search_rules "modal"              → Règles spécifiques modales
4. MCP search_rules "focus trap"         → Gestion du focus
5. MCP fix_rule pour chaque issue
```

### Workflow 3 : Audit sécurité (XSS onclick)

```
1. /fec-https
2. MCP search_rules "xss"               → Règles XSS
3. MCP search_rules "innerHTML"          → Règles innerHTML
4. MCP get_rule "avoid-eval"            → Détail
5. MCP explain_rule "avoid-eval"        → Pourquoi
6. MCP fix_rule "avoid-eval"            → Comment fixer
```

### Workflow 4 : Audit performance (8500 lignes = lourd)

```
1. MCP get_workflow "performance"
2. MCP search_rules "lazy"              → Lazy loading
3. MCP search_rules "preload"           → Préchargement
4. MCP search_rules "bundle"            → Code splitting (non applicable mais vérifier)
5. MCP search_rules "defer"             → defer/async scripts
```

---

## 8. Référentiel local

Le fichier `.context/frontend-checklist/rules-priorisees.md` contient un condensé des règles **Critical** et **High** applicables à PariScore. Il est consultable hors-ligne sans le MCP.

Pour le détail complet d'une règle, utiliser le MCP :
```
MCP get_rule "avoid-eval"
```
Ou consulter le site : https://frontendchecklist.io/rules

---

## Compatibilité avec l'architecture PariScore

| Règle | Compatible ? | Note |
|-------|:------------:|------|
| Doctype, charset, viewport | ✅ | Vérifier dans pariscore.html |
| Pas de JS inline | ❌ | pariscore.html = massivement inline (archi vanilla, assumé) |
| ES modules / code splitting | ❌ | Pas de build step |
| TypeScript strict | ❌ | Pas de TS |
| `eval()` interdit | ✅ | À vérifier dans pariscore.html |
| Accessibility modales | ✅ | **Priorité haute** — modales tennis |
| CSP headers | ✅ | À configurer dans server.js |
| Performance (LCP/CLS/INP) | ✅ | **Priorité haute** — 8500 lignes |
| SEO | ✅ | Site public |
| HTTPS | ✅ | Render.com fournit le HTTPS |

> Les règles incompatibles (ES modules, TS, code splitting) ne sont **pas des problèmes** — elles reflètent des choix d'architecture assumés de PariScore (vanilla JS, zero-dependency). Le Front-End Checklist s'adapte : on applique les règles pertinentes et on ignore les autres.
