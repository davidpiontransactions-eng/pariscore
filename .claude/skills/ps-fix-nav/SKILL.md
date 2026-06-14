---
name: ps-fix-nav
description: Diagnostic + fix automatisé des liens de navigation desktop (Football, Tennis, CS2, MMA) qui ne répondent pas au clic. Root cause : syntaxe JS cassée dans _renderMMAFight() qui rend showPage undefined.
---

# PariScore — Nav Fix Automatisé

## Déclencheur
Quand l'utilisateur signale que les **liens de navigation desktop** (Football, Tennis, CS2, MMA, Tendances, Alertes, etc.) ne répondent pas au clic, alors que la bottom nav mobile fonctionne.

## REX — Root Cause

### Problème
Les `<a>` de `.nav-links` ont des `onclick="showPage('xxx')"`. Si `showPage` est `undefined`, le clic ne fait rien — pas d'erreur visible, pas de redirection.

### Cause racine
**Syntaxe JS cassée dans `pariscore.js`** — la fonction `_renderMMAFight(f)` manque un `}` fermant sur son bloc `catch` :

```js
// AVANT (cassé) — } manquant + \" au lieu de "
    } catch (e) { console.warn(\"[MMA] skip bad fight:\", e); return \"\"; }

// APRÈS (fix)
    } catch (e) { console.warn("[MMA] skip bad fight:", e); return ""; } }
```

Cette erreur de parse fait que tout le code JS après `_renderMMAFight` n'est jamais exécuté. Comme la définition de `showPage()` est **après** cette fonction, elle n'existe pas au moment du clic.

### Confusion fréquente — CSS pointé du doigt à tort
Les pseudo-éléments `::before`/`::after` des liens nav ont `pointer-events: none` (volontaire — c'est le lien `<a>` qui reçoit le clic). **Ce n'est pas la cause.** Mais sur certains Chromium, un bug de hit-testing (#972569) peut aggraver le problème. La défense en profondeur CSS : `z-index: -1` sur ces pseudo-éléments.

## Procédure

### 1. Détection
```bash
node --check pariscore.js
```
- **SyntaxError** → le bug est présent (soit celui-ci, soit un autre)
- **Pas d'output** (exit 0) → la syntaxe est bonne

### 2. Vérification secondaire
```bash
node -e "require('./pariscore.js')" 2>&1 | Select-String -NotMatch "Warning"
```
- Si ça passe → `_renderMMAFight` n'est pas la cause, chercher ailleurs
- Si ça plante → chercher l'erreur de syntaxe dans la zone

Chercher le marqueur du fix :
```bash
Select-String -LiteralPath pariscore.js -Pattern 'skip bad fight.*return ""; } }' -SimpleMatch
```
- Match trouvé → fix déjà appliqué
- Pas de match → fix à appliquer

### 3. Vérification des marqueurs CSS
```bash
Select-String -LiteralPath pariscore.html -Pattern 'scrollbar-width: none' -SimpleMatch
Select-String -LiteralPath pariscore.html -Pattern 'z-index: -1' -SimpleMatch
```
- Les 2 doivent matcher. Si un manque → l'injecter (voir section 5).

### 4. Application du fix JS

Ouvrir `pariscore.js` vers la ligne 28878-28881. Chercher :

```
} catch (e) { console.warn("[MMA] skip bad fight:", e); return ""; }
```

⚠️ Attention : la version cassée a `\"` au lieu de `"` et **manque le `}` fermant**. Le fix complet :

```
    } catch (e) { console.warn("[MMA] skip bad fight:", e); return ""; } }
```

Le premier `}` ferme `catch`, le second ferme `_renderMMAFight`.

Puis vérifier :
```bash
node --check pariscore.js
```

### 5. Injection CSS (si marqueurs absents)

**Bloc scrollbar desktop** — injecter dans `pariscore.html` après la règle `.nav-links` existante (vers ligne 322) :

```css
  /* Hide scrollbar on desktop nav — native scrollbar track swallows clicks on Windows */
  html.ps-desktop-v1 nav .nav-links {
    scrollbar-width: none;
    -ms-overflow-style: none;
    overflow-y: hidden;
  }
  html.ps-desktop-v1 nav .nav-links::-webkit-scrollbar {
    display: none;
  }
```

**`z-index: -1` sur `::after`** — trouver `.nav-links a::after` (vers ligne 3555) et ajouter `z-index: -1;` après `pointer-events: none;`.

**`z-index: -1` sur `::before`** — trouver `nav .nav-links a:hover::before` (vers ligne 9816) et ajouter `z-index: -1;` après `pointer-events: none;`.

### 6. Vérification finale
```bash
node --check pariscore.js
node -e "require('./pariscore.js')" 2>&1 | Select-String -NotMatch "Warning"
# Les 2 doivent passer — pas d'erreur
```

### 7. Rollback
```bash
git checkout -- pariscore.js pariscore.html
```

## Contraintes
- Ne JAMAIS modifier `_renderMMAFight` au-delà du fix de fermeture
- Ne JAMAIS toucher `pointer-events: none` sur les pseudo-éléments — c'est intentionnel
- Le dual rendering (mobile sheet + desktop modal) n'est PAS concerné par ce bug — ne pas y toucher
- `node --check` valide la syntaxe mais pas les runtime errors — toujours faire un test navigateur après déploiement

## Gotchas
- **Ne pas confondre avec la nav mobile** — la bottom nav utilise un mécanisme différent (pas de `showPage`). Si la bottom nav marche mais pas la top nav → c'est ce bug.
- **Le scrollbar natif Windows** est un vrai problème : Chromium ne clique pas à travers la scrollbar fantôme. Le `overflow-y: hidden` est nécessaire même si le contenu ne dépasse pas.
- **`showPage` peut exister dans la console F12** après avoir cliqué sur un lien bottom nav — le bug est que la fonction n'est pas encore définie au moment du parse.
