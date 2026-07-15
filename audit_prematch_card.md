# Audit prematch_card — Carte Tennis Prematch (pariscore.html)

> **Source de vérité** : `image_690bc5.png` (capture UI) + inspection code `pariscore.html`
> **Date** : 2026-07-16
> **Méthode** : systematic-debugging Phase 1 (cause racine tracée dans le fichier pour chaque défaut)
> **Composant** : `premierCard()` vanilla JS, `pariscore.html` (~27k lignes)

## Découverte fondamentale (cause racine transverse)

**Le fichier est encodé en UTF-8 mais contaminé par 3418 séquences U+FFFD + 214 `??` littéraux.**

- Le fichier déclare et est stocké en UTF-8.
- Mais une conversion CP1252→UTF-8 mal configurée (sauvegarde éditeur Windows passée) a **détruit** tous les caractères non-ASCII : accents français (`é`→`?`), emoji (`📊`→`??`), em-dashes (`—`→`?`).
- Conséquence : `Stratégies` → `Strat??gies`, `à éviter` → `??viter`, badges Service/Retour/Forme → `??`.

**Erreur de l'agent précédent** : il traitait le fichier comme CP1252 (`iconv-lite decode win1252`), ce qui **corrompait davantage** à chaque édition. Les corrections doivent se faire en **UTF-8 natif**.

---

## DÉFAUT 1 — Encodage de caractères (UTF-8)

### Symptômes constatés (image)
- "Strat**é**gies" affiché sans accent ou corrompu.
- Tag "à éviter" affiché comme "??viter" ou " VITER".
- Libellés français (`Intérieur`, `équilibré`, `Calculé`) avec caractères cassés.

### Causes racines (tracées dans le fichier)

| Texte attendu | Texte dans fichier | Ligne | Cause |
|---------------|-------------------|-------|-------|
| `à éviter` | `'??viter'` (avoid label) | L25573 | `à` détruit → U+FFFD |
| `Signal à éviter` | `?? Signal ?? ??viter` | L20881 | `é` + `à` + icône détruits |
| `Stratégies` (btn) | corrigé par agent préc. en `Stratégies` via svgIcon | L26133 | OK maintenant mais fragile |
| `équilibré`, `Calculé` | `quilibr `, `Calcul ` | scoutProfile | `é` détruits |
| `Intérieur` (surfaceBadge) | `Int??rieur` | surfaceBadge fn | `é` détruit |

### Criticité : MAJEURE (user-facing, 3418 occurrences)

---

## DÉFAUT 2 — Icônes introuvables (tofu / losanges `??`)

### Symptômes (image)
- Losanges noirs avec `?` à côté de "Terre", "Elo", au-dessus de "Analyse"/"Stratégies", à côté des noms joueurs.
- Dans la section Analyse (scoutProfile) : 4 badges (Service/Retour/Forme/Elo) affichent `??`.

### Causes racines (tracées)

| Emplacement | Ligne | Code actuel | Icône attendue |
|-------------|-------|-------------|----------------|
| scoutProfile Service | L25854 | `<span class="ico">??</span>` | emoji service (ex: 🎾 ou SVG) |
| scoutProfile Retour | L25858 | `<span class="ico">??</span>` | emoji retour |
| scoutProfile Forme | L25863 | `<span class="ico">??</span>` | emoji forme |
| scoutProfile Elo | L25867 | `<span class="ico">?</span>` | emoji Elo |
| surfaceBadge "Terre" | surfaceBadge fn | probable `??` avant label | icône surface |
| Boutons Analyse/Strat | L26131-26133 | **corrigés** (`svgIcon('chart')`) | ✅ déjà SVG |

**Cause racine** : les emoji originaux (probablement 🎾/🎯/📊) ont été détruits lors de la conversion encodage → remplacés par `??` (deux `?` ASCII 0x3F). `svgIcon()` existe dans le fichier (L25499+) et rend correctement — il faut remplacer les `??` par des appels `svgIcon()`.

### Criticité : MAJEURE (analyse illisible, aspect non professionnel)

---

## DÉFAUT 3 — Chevauchement UI (jauge + pourcentage)

### Symptôme (image)
- Les pourcentages centraux ("54%", "67%") se superposent au graphique de jauge circulaire (gauge SVG) en arrière-plan.
- Z-index ou positionnement cassé → texte illisible sur la jauge.

### Cause racine (tracée)
- `gauge()` (L25564+) génère un SVG inline avec texte `%` **à l'intérieur** du SVG.
- `.sc-premier-gauge{flex:0 0 auto;padding:0 2px}` (L25322) — pas de z-index.
- Le texte du gauge est rendu en `<text>` SVG mais le parent `.sc-premier-vs` a `align-items:center` (L25308) sans isolation de contexte d'empilement.
- **Le chevauchement vient probablement du gauge qui n'a pas de `position:relative` ni `isolation:isolate`**, laissant le texte du gauge interagir avec les éléments adjacents.

### Hypothèse à valider : `isolation:isolate` sur `.sc-premier-gauge` ou `position:relative` + `z-index:1` sur le wrapper texte.

### Criticité : MAJEURE (illisibilité du signal principal)

---

## DÉFAUT 4 — Assets non chargés (drapeaux + avatars)

### Symptôme (image)
- **Drapeaux** : rectangles gris vides à côté des classements (#10, #90, #13, #124).
- **Avatars** : 3 joueurs sur 4 affichent les initiales (AB, QH, AP) au lieu de la photo. Seul Rublev a sa photo.

### Causes racines (tracées)

**Avatars** (L26087-26095, `_ph()` dans premierCard) :
```js
_u=(typeof window.getPlayerPhotoUrl==='function')?window.getPlayerPhotoUrl(p):'';
// fallback: <div class="sc-premier-photo-init">'+esc((p.name||'?')[0])+'</div>
```
- `getPlayerPhotoUrl(p)` retourne `''` pour les joueurs non mappés → fallback initiales.
- La map photo est probablement incomplète (seulement Rublev mappé parmi les 4).

**Drapeaux** (`flagToCC()` + `.sc-flag`) :
- `flagToCC(p.flag)` convertit le code pays (ex: "ESP") en code emoji drapeau.
- Si `p.flag` est `null`/`undefined` (BSD ne fournit pas toujours le flag) → rendu vide/gris.
- `.sc-flag` est un `<span>` qui dépend de la font emoji pour rendre le drapeau.

### Criticité : MAJEURE (aspect inachevé, 75% des avatars manquants)

---

## Synthèse des criticités

| Défaut | Criticité | Portée | Complexité fix |
|--------|-----------|--------|----------------|
| 1. Encodage U+FFFD | MAJEURE | 3418 occ. (systémique) | Élevée (récupération git ou remplacement ciblé) |
| 2. Icônes `??` → svgIcon | MAJEURE | ~6 emplacements scoutProfile + surfaceBadge | Faible (remplacement par svgIcon existant) |
| 3. Chevauchement jauge | MAJEURE | 1 composant (gauge) | Faible (CSS isolation/position) |
| 4. Avatars/drapeaux | MAJEURE | Photos map incomplète + flags null | Moyenne (élargir la map ou fallback robuste) |

## Décision architecturale recommandée

Le problème #1 (encodage) est **systémique** : 3418 occurrences ne peuvent pas être patchées à la main. Deux options :
- **(A) Récupération ciblée** : pour les zones user-facing (premierCard, scoutProfile, surfaceBadge), remplacer les U+FFFD par les bons caractères via svgIcon ou strings UTF-8 propres. Pas de récupération globale.
- **(B) Re-encodage global** : trop risqué (27k lignes, régression massive).

**Recommandation : (A)** — fix ciblé des zones visibles par l'utilisateur, svgIcon pour les icônes, strings UTF-8 propres pour les labels.
