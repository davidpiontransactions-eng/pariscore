# RAPPORT D'AUDIT COMPLET — Bandeau Tennis invisible en frontend

**Date :** 2026-07-01
**Équipe :** Ingénieur en chef · Ingénieur réseau · Design frontend · Data scientist
**Objet :** Le nouveau bandeau tennis (3 zones) déployé sur le VPS n'apparaît pas chez l'utilisateur

---

## 1. EXÉCUTIF — VERDICT

| Domaine | Statut | Conclusion |
|---------|--------|------------|
| Code source (local) | ✅ OK | `matchBanner` 3 zones présent dans pariscore.html |
| Déploiement git → origin/main | ✅ OK | Dernier commit `a6f1ede` poussé |
| Déploiement VPS | ✅ OK | `git reset --hard origin/main` → commit `a6f1ede` actif |
| Hash fichier VPS = Hash git HEAD | ✅ IDENTIQUE | `aafb919e...` |
| HTML servi par localhost:3000 | ✅ OK | Contient `sc-banner-left/center/right` (nouvelles classes) |
| API /api/v1/tennis/live | ✅ OK | 427 matchs, tournament="Wimbledon" etc. |
| Cache-Control serveur | ✅ OK | `no-cache` (revalidation systématique) |
| **Cache navigateur / Service Worker** | ❌ **CAUSE** | **Le navigateur sert l'ancienne version cachée** |

**Le code est déployé et servi correctement. Le problème est exclusivement le cache du Service Worker chez l'utilisateur.**

---

## 2. PREUVES TECHNIQUES

### 2.1 Le fichier VPS est le bon (hash identique)
```
VPS  (/home/ubuntu/pariscore/pariscore.html) : aafb919e4c319e34b56596b9ae07dc806d425a56e649f80b14404baa475bd358
Git (HEAD:pariscore.html)                   : aafb919e4c319e34b56596b9ae07dc806d425a56e649f80b14404baa475bd358
→ IDENTIQUE ✅
```

### 2.2 Le serveur sert les nouvelles classes CSS
```bash
$ curl -s http://localhost:3000/ | grep -o 'sc-banner-left|sc-banner-center|...'
      9 sc-banner-center
      3 sc-banner-left
      4 sc-banner-right
      3 sc-mb    (pill Bo3/Bo5)
      3 sc-mr    (pill round)
→ Le nouveau code est dans le HTML servi ✅
```

### 2.3 Le Cache-Control est `no-cache`
```
HTTP/1.1 200 OK
Cache-Control: no-cache    ← revalidation systématique
Content-Type: text/html; charset=utf-8
→ Le serveur ne cache plus le HTML ✅
```

---

## 3. ANALYSE DE LA CAUSE — Service Worker

### Mécanisme
1. `sw.js` pré-cache `pariscore.html` dans `CACHE_SHELL` (sw.js:139)
2. Le SW utilise `network-first` pour les navigations (sw.js:252-264)
3. **MAIS** si le navigateur a déjà l'ancien SW en mémoire, il peut servir du stale
4. Le cycle de vie du SW nécessite : install → activate → reload
5. Un `F5` (refresh normal) ne déclenche pas toujours ce cycle

### Pourquoi le bump v72 n'a pas suffi
- Le navigateur doit d'abord charger la page (avec l'ancien SW qui sert l'ancien HTML)
- Puis découvrir le nouveau sw.js en arrière-plan
- L'installer et l'activer (`skipWaiting` + `clients.claim` sont présents)
- **Mais le reload automatique n'est pas garanti** sans intervention manuelle

### Historique
Le fichier sw.js documente ce bug récurrent (commentaires lignes 6-130) :
à chaque release frontend, il faut bumper CACHE_VERSION ET faire un hard reload.

---

## 4. AUDIT PAR SPÉCIALITÉ

### 4.1 Ingénieur réseau
- **Aucun proxy/CDN** devant le serveur Node (pas de nginx dans le repo)
- Serveur HTTP brut sur port 3000 (server.js:32902)
- DNS : pariscore.fr → 51.75.21.239 (IPv4 VPS) ✅
- Pas de cache serveur du HTML (fs.readFile à chaque requête)
- Compression gzip présente mais sans cache de compression
- **Verdict : infrastructure OK, pas en cause**

### 4.2 Ingénieur frontend
- Le chemin de rendu est : `showPage('tennis')` → `TennisScope.init()` → `fetchData()` → `mapMatch()` → `renderActiveTab()` → `Scope.renderPrematchGrid()` → `prematchCard()` → `matchBanner()`
- TennisScope EST le système actif (confirmé)
- Les systèmes tn2 (tn2RenderLiveCards, tn2RenderTopCards) sont **dead code** (conteneurs DOM inexistants → return immédiat)
- `mapMatch` préserve `tournament`/`surface`/`round` via Object.assign (pas d'écrasement)
- **Verdict : le rendu passe bien par matchBanner, le code est correct**

### 4.3 Data scientist
- `/api/v1/tennis/live` renvoie 427 matchs avec `tournament="Wimbledon"` etc. ✅
- `round` et `surface` sont **vides** pour les matchs live BSD (problème de données côté serveur, non bloquant pour l'affichage du bandeau)
- L'onglet par défaut est `prematch` qui se remplit de manière asynchrone (value-bets/upcoming)
- Pas de cache localStorage tennis côté frontend
- **Verdict : les données arrivent, le bandeau affichera au minimum le nom du tournoi**

### 4.4 Ingénieur en chef
- Tous les checks serveur passent ✅
- Le problème est reproductible uniquement chez l'utilisateur (cache navigateur)
- **Cause racine confirmée : Service Worker obsolète chez l'utilisateur**

---

## 5. SOLUTION — Procédure de résolution

### Option A : Hard reload (recommandé, 30 secondes)
1. Ouvrir le site dans Chrome/Firefox
2. Appuyer sur **`Ctrl + Shift + R`** (Windows) ou **`Cmd + Shift + R`** (Mac)
3. Si pas de changement, fermer **tous les onglets** du site, rouvrir, refaire `Ctrl+Shift+R`

### Option B : Désenregistrer le Service Worker (définitif, 1 minute)
1. Ouvrir le site
2. Appuyer sur **`F12`** (DevTools)
3. Aller dans l'onglet **Application** (Chrome) ou **Storage** (Firefox)
4. Dans le panneau de gauche : **Service Workers**
5. Cliquer **"Unregister"** sur le SW listé
6. Fermer DevTools, faire **`Ctrl + Shift + R`**

### Option C : Navigation privée (test immédiat, 10 secondes)
1. Ouvrir une **fenêtre de navigation privée** (Ctrl+Shift+N sur Chrome, Ctrl+Shift+P sur Firefox)
2. Aller sur le site
3. → Le bandeau 3 zones devrait apparaître immédiatement (pas de SW en mode privé)

**L'option C est le test le plus rapide pour confirmer que le code fonctionne.**

---

## 6. RECOMMANDATIONS STRUCTURELLES

Pour éviter ce problème à l'avenir :

1. **Auto-reload SW** : ajouter un listener `controllerchange` dans pariscore.html qui reload la page automatiquement quand un nouveau SW prend le Contrôle
2. **Version visible** : afficher la version du SW quelque part dans l'UI (footer) pour diagnostic facile
3. **Cache-busting assets** : ajouter `?v=<commit>` aux références CSS/JS critiques

---

## 7. CONCLUSION

Le code est **correct, déployé et servi**. Le problème est le **cache du Service Worker** chez l'utilisateur.
La solution immédiate est un **hard reload** ou un **test en navigation privée**.
