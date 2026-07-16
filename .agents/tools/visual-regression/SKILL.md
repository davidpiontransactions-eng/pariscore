---
name: visual-regression
description: |
  Visual regression testing pour PariScore basé sur le Playwright MCP déjà installé.
  Capture des screenshots avant/après chaque modification de design, compare visuellement,
  détecte les régressions involontaires sur les 25 pages du site. Léger (pas de
  cloud, pas de Storybook) — adapté au monolithe pariscore.html vanilla.
  Use when: user asks to take a screenshot, compare before/after, check visual regression,
  validate a design change, "capture l'onglet X", "screenshot avant modifs", "compare
  les visuels", "vérifie que rien a cassé", "diff visuel".
  Triggers: "screenshot", "visual regression", "avant après", "compare visuel",
  "diff visuel", "capture onglet", "baseline", "vérifie rien cassé", "playwright shot".

  Requires: MCP playwright installé (.mcp.json), serveur dev sur localhost:3000
  (ou http://pariscore.fr/ en fallback).
license: MIT
metadata:
  author: pariscore-cto
  version: "1.0.0"
---

# visual-regression — Screenshots avant/après via Playwright MCP

> **Rôle** : Garantir qu'une modification de design (tokens, cards, gradients…)
> ne casse pas visuellement les pages. Basé sur le **Playwright MCP déjà installé**
> (pas besoin de Chromatic — overkill pour un monolithe sans Storybook).

## Pourquoi pas Chromatic ?

Chromatic est excellent mais nécessite Storybook + composants React isolés.
PariScore est actuellement un monolithe vanilla HTML (1,5 Mo) — pas de Storybook.
Le **Playwright MCP** déjà installé suffit largement : il capture des screenshots
headless reproductibles, ce qui est exactement ce dont on a besoin pour valider
une réconciliation de tokens.

Quand PariScore sera migré en Next.js + composants isolés → Chromatic deviendra
pertinent. Pour l'instant : Playwright.

## Setup (déjà fait)

Playwright MCP est déclaré dans `.mcp.json` :
```json
"playwright": {
  "command": "npx",
  "args": ["-y", "@playwright/mcp@latest"]
}
```

## Convention de nommage des screenshots

**Dossier** : `.hallmark-baseline/` (gitignored, local only)

**Format** : `<onglet>-<phase>-<sous-tache>-<état>.png`

| Champ | Valeurs |
|---|---|
| `onglet` | `home` · `tennis` · `cs2` · `mma` · `f1` · `cycling` · `nba` · `wnba` · `tarifs` · `hot-picks` · `sure-bets` · `strategies` · `paris` · `historique` · `comparateur` · `404` |
| `phase` | `p1.1` · `p1.2` · `p1.3` · … · `p2.5` · `p3.1` (référence au plan `todo.md`) |
| `sous-tâche` | description courte kebab-case (`reconcil-tn2`, `remove-emojis`, `cut-fade-up`) |
| `état` | `AVANT` · `APRES` · `BASELINE` |

**Exemples** :
```
.hallmark-baseline/tennis-p1.1-reconcil-tn2-AVANT.png
.hallmark-baseline/tennis-p1.1-reconcil-tn2-APRES.png
.hallmark-baseline/cs2-p2.5-kill-pulse-border-AVANT.png
.hallmark-baseline/cs2-p2.5-kill-pulse-border-APRES.png
```

## Workflow standard (avant chaque modification de design)

### 1. Capturer le baseline AVANT

```
# S'assurer que le serveur dev tourne
# (bun run dev — port 3000, ou fallback http://pariscore.fr/)

playwright_navigate → http://localhost:3000/#page-<onglet>
# Attendre que la page soit stable (plus de spinner, plus de fade-up)
playwright_screenshot → .hallmark-baseline/<onglet>-<phase>-<sous-tache>-AVANT.png
```

Pour les onglets nécessitant une interaction (ex: déplier un match tennis) :
```
playwright_click → <sélecteur du match à déplier>
playwright_screenshot → .hallmark-baseline/<onglet>-<phase>-<sous-tache>-detail-AVANT.png
```

### 2. Faire la modification (en dehors de ce skill)

Utiliser `design-system-unify` ou toute autre modif de code.

### 3. Capturer APRÈS

```
playwright_navigate → http://localhost:3000/#page-<onglet>
playwright_screenshot → .hallmark-baseline/<onglet>-<phase>-<sous-tache>-APRES.png
```

### 4. Comparaison visuelle

L'agent peut **visionner les 2 images côte-à-côte** via la fonction Read (qui
supporte les PNG). Il décrit les différences observées.

Pour une comparaison rigoureuse, l'agent peut aussi :
- Ouvrir les 2 screenshots avec `Read` et décrire les diffs
- Si le serveur supporte un mode "diff" (Playwright pro), générer un 3e screenshot
  de différence pixel-perfect

## Multiples viewports (responsive)

PariScore a 2 layouts : desktop et mobile (`ps-mobile-v2` class sur `<html>`).
Capturer les 2 pour chaque modif critique :

```
# Desktop
playwright_evaluate → document.documentElement.classList.remove('ps-mobile-v2'); document.documentElement.classList.add('ps-desktop-v1');
playwright_screenshot → .hallmark-baseline/<onglet>-<phase>-<sous-tache>-desktop-AVANT.png

# Mobile
playwright_evaluate → document.documentElement.classList.add('ps-mobile-v2'); document.documentElement.classList.remove('ps-desktop-v1');
playwright_screenshot → .hallmark-baseline/<onglet>-<phase>-<sous-tache>-mobile-AVANT.png
```

## Checklist complète (25 pages)

Pour un audit complet avant/après une phase majeure, capturer :

| # | Onglet | URL hash | Note |
|---|---|---|---|
| 1 | home/prematch | `#page-accueil` ou défaut | page d'atterrissage |
| 2 | live | `#page-matchs` + tab live | scores live |
| 3 | tennis | `#page-tennis` | 4 sous-systèmes à surveiller |
| 4 | cs2 | `#page-cs2` | le plus slop |
| 5 | mma | `#page-mma` | dual-accent rouge+or |
| 6 | nba | `#page-nba` | |
| 7 | wnba | `#page-wnba` | alias NBA |
| 8 | f1 | `#page-f1` | neumorphic lourd |
| 9 | cycling | `#page-cycling` | modèle de propreté |
| 10 | hot-picks | `#page-hot-picks` | invented metrics |
| 11 | sure-bets | `#page-sure-bets` | invented metrics |
| 12 | strategies | `#page-strategies` | propre |
| 13 | paris | `#page-paris` | bet tracker |
| 14 | historique | `#page-historique` | data hub |
| 15 | comparateur | `#page-comparateur` | fragmentation |
| 16 | tarifs | `#page-tarifs` | hero centré + grille 4 col |
| 17 | tendances | `#page-tendances` | |
| 18 | predictions | `#page-predictions` | |
| 19 | alertes | `#page-alertes` | |
| 20 | 404 | n'importe quel hash invalide | centered hero emoji |

## Quand capturer (les moments critiques)

| Moment | Action |
|---|---|
| Avant toute Phase du plan `design-system-unify` | baseline de l'onglet concerné |
| Après une passe de réconciliation de tokens | screenshot + comparaison |
| Avant de supprimer un bloc `:root` scopé | capture de la zone dépendante |
| Après un `git revert` (rollback) | vérifier qu'on est bien revenu au baseline |
| Fin de phase | capturer les 25 pages pour audit global |

## Anti-patterns

- ❌ Capturer un screenshot sans attendre que la page soit stable (spinners, fade-up).
- ❌ Comparer 2 screenshots pris à des viewports différents.
- ❌ Ignorer une petite différence visuelle — sur 25 pages, 25 petites diffs = catastrophe.
- ❌ Skip les screenshots mobile (`ps-mobile-v2`) — la moitié du trafic est mobile.
- ❌ Commit les screenshots dans git (utiliser `.gitignore` pour `.hallmark-baseline/`).

## Fichiers de référence

- `.mcp.json` — déclaration Playwright MCP
- `.agents/skills/design-system-unify/SKILL.md` — workflow d'exécution
- `.agents/skills/hallmark/` — audit visuel (skills apparenté)

---

*Skill QA visuel PariScore — basé sur Playwright MCP (pas Chromatic, monolithe sans Storybook).*
