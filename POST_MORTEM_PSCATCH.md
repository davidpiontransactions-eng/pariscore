# Post-Mortem — Bandeau rouge "fantôme" PSCATCH (`msg: {}`)

**Date :** 2026-06-30
**Sévérité :** Production — Diagnostique aveuglé
**Skill utilisé :** `superpowers:systematic-debugging` (Phases 1–4)
**Statut :** Résolu + prévention systémique

---

## 1. Symptôme observé

Un bandeau rouge d'erreur globale s'affiche en production avec :

```
[PSCATCH] Erreur JS capturée
msg: {}
raw: {}
```

Le gestionnaire d'erreurs global capture bien une exception, mais **le message et l'objet brut sont vides** (`{}`). L'équipe est donc **aveugle** sur la cause réelle du crash : ni le message, ni la stack exploitable ne remontent dans le bandeau ni dans la console.

## 2. Root Cause Analysis (RCA)

### 2.1 La cause primaire — `throw new Error()` sans message

Cinq sites dans `pariscore.js` lançaient une erreur **vide** :

```js
if (!r.ok) throw new Error();   // ← lignes 21902, 22151, 25581, 26322, 26335
```

`new Error()` appelé sans argument produit un objet `Error` dont **`err.message === ''`** (chaîne vide, falsy en JS).

### 2.2 La cause secondaire — bug de sérialisation

Le sérialiseur du shim diagnostic (`pariscore.html`, fonction `serialize()`) calculait le message ainsi :

```js
var msg = (err && typeof err.message === 'string' && err.message)   // '' est falsy → SKIP
        ? err.message
        : (isObj ? safeStr(err) : String(err));                     // → safeStr(err)
```

Quand `message` est vide, le code tombe sur `safeStr(err)` → `JSON.stringify(err)`.

**Le piège JS fondamental :** `JSON.stringify(err)` sur une instance d'`Error` retourne **`"{}"`** parce que les propriétés `message`, `stack` et `name` d'un objet `Error` sont **non-énumérables**. `JSON.stringify` ne voit que les propriétés énumérables.

**Résultat :** le bandeau affiche `msg: {}` au lieu du vrai message.

### 2.3 La cause tertiaire — `unhandledrejection` filtrait mal

```js
var p = serialize(reason && (reason.stack || reason.message) ? reason : { message: String(reason) });
```

Ce filtre ratait les `Promise.reject()` non typés :
- `Promise.reject(500)` (un nombre) → `{ message: '500' }` (OK mais sans contexte)
- `Promise.reject({code, status})` (plain object sans `.message`) → `{ message: '[object Object]' }` (échec)

## 3. Pourquoi le gestionnaire est devenu "aveugle"

| Couche | Comportement avant fix |
|--------|------------------------|
| **Source** (`throw new Error()`) | Génère une `Error` dont `message = ''` |
| **Sérialiseur** (`serialize`) | Voit `message` falsy → `safeStr(err)` → `JSON.stringify` → **`"{}"`** (props non-énumérables invisibles) |
| **Bandeau** (`showBanner`) | Affiche `msg: {}` — inutilisable |
| **Console** (`report`) | Log `[PSCATCH] window.error: {}` — inutilisable |
| **Serveur** (`/api/v1/clientside-error`) | Reçoit `message: "{}"` — inutilisable |

**Toute la chaîne d'observabilité était neutralisée** par un seul oubli : gérer le cas `Error` sans message + la non-énumération des props natives.

## 4. Solution technique implémentée

### 4.1 Sérialiseur durci (`pariscore.html` — `serialize()` + `safeStr()`)

- **Branche dédiée `Error`** : si `message` est vide, fallback sur `name + '(empty message) @ 1ère ligne de stack'`. Plus jamais `"{}"`.
- **`safeStr(Error)`** : utilise `err.message || err.name` au lieu de `JSON.stringify`.
- **`safeStr(plain object)`** : `JSON.stringify(v, Object.getOwnPropertyNames(v))` pour capter les clés non-énumérables.
- **Branche `unhandledrejection`** : passe directement `reason` à `serialize` (qui gère désormais Error / plain object / primitive / nombre).

### 4.2 Sources d'erreurs documentées (`pariscore.js`)

Les 5 `throw new Error()` vides → `throw new Error('HTTP ' + status + ' sur <route>')` :

| Ligne | Route |
|-------|-------|
| 21902 | `/api/v1/affiliates` |
| 22151 | `/api/v1/predictions` |
| 25581 | `/api/v1/trends` |
| 26322 | `/api/v1/alerts/prefs` |
| 26335 | `/api/v1/alerts/history` |

Les 2 `Promise.reject(r.status)` (nombre non typé) → `Promise.reject(new Error('HTTP ' + status + ' <route>'))` :

| Ligne | Route |
|-------|-------|
| 1398 | `/api/v1/wnba/props/:id` |
| 31789 | `/api/v1/mma/fight-analysis` |

Les `.catch()` correspondants utilisent maintenant `(e && e.message ? e.message : e)` pour ne pas afficher `[object Error]`.

### 4.3 Test de régression

Test Node ad-hoc validant le sérialiseur contre 6 shapes d'erreur :

```
✅ new Error() vide        → "Error (empty message) @ ..."
✅ new Error(msg)          → "boom"
✅ throw 500 (nombre)      → "500"
✅ reject({code,status})   → '{"code":"X","status":500}'
✅ throw "string"          → "manual"
✅ null                    → "null"
```

**Résultat : 6/6 — plus aucun `msg: {}`.**

## 5. Leçons apprises / Defence in depth

1. **Ne jamais `throw new Error()` sans message.** Toujours contextualiser (route, statut, opération). Règle ajoutée au guard-rails du projet.
2. **`JSON.stringify(err) === "{}"` pour les `Error`.** C'est un piège JS classique : les props natives d'`Error` sont non-énumérables. Utiliser `Object.getOwnPropertyNames(err)` comme repli.
3. **Tout point de capture global doit être testé** contre tous les shapes possibles (Error, plain object, primitive, nombre, null). Ce shim n'avait aucun test.
4. **Le sérialiseur est un point de défaillance unique.** S'il rend `"{}"`, toute l'observabilité s'effondre. → Voir `DEBUG_AUTOMATION_PIPELINE.md` pour l'automatisation.
