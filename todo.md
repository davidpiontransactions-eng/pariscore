# Todo — eng-review-top10

Branche : `eng-review-top10`
Basée sur : `gstack-plan-eng-review` session (2026-06-17)

---

## Lane A — Backend (server.js)

- [x] **A2** Stale-while-revalidate : dans `_refreshTop10Cache()`, lire `sps_last_run` via `getSackmannLastSync()` ; comparer age avec TTL 5min ; si plus jeune, sauter le rebuild
- [x] **A3** Status API : ajouter `status: "building" | "ready" | "stale"` et `estimated_seconds` dans `/api/v1/tennis/top10`
- [x] **A4** Promesse singleton : remplacer `_tennisVBRebuilding` Map par `globalThis.__top10RebuildPromise`
- [x] **A5** Timeout 60s + fallback : Promise.race + garder ancien cache si erreur

## Lane B — Frontend (pariscore.js)

- [x] **B1** Nouveau polling : `fetchTennisTop10()` lit `status`, `estimated_seconds` ; boucle tant que `building` ; timeout 10min ; max 3 erreurs consécutives

---

## Bugfix — Correctifs appliqués (2026-06-17)

### P0 — Fallback showPage dans pariscore.html ⚠️ PRIORITAIRE
- **Fichier** : `pariscore.html` — script inline ajouté dans le commit A2
- **Problème** : `window.showPage` override avec une version simplifiée **avant** que `pariscore.js` ne charge
- **Action** : Script inline supprimé (lignes 12111-12114 retirées)
- **Statut** : ✅ **FAIT**

### P1 — Dedup perdu dans buildTennisValueBets (server.js)
- **Fichier** : `server.js`
- **Problème** : A4 a supprimé le Set `_tennisVBRebuilding` dans `buildTennisValueBets()` sans remplacement
- **Action** : `globalThis.__tennisVBGuard` (Set) ajouté avec `.add(key)` avant rebuild et `.delete(key)` dans `.then()`/`.catch()`
- **Statut** : ✅ **FAIT**

### P2 — _refreshTop10Cache() retourne type incohérent (server.js)
- **Fichier** : `server.js`
- **Problème** : `return _tnTop10Cache` retourne un objet. L'appelant `.catch()` attend une Promise.
- **Action** : `return Promise.resolve(_tnTop10Cache)` (ligne 36107)
- **Statut** : ✅ **FAIT**

### P3 — BOM (U+FEFF) dans pariscore.html + sw.js
- **Fichier** : `pariscore.html` + `sw.js`
- **Problème** : BOM devant `<!DOCTYPE html>` et en tête de sw.js
- **Action** : BOM retiré des deux fichiers (premiers octets `EF BB BF` supprimés)
- **Statut** : ✅ **FAIT**

---

## Post-implementation

- [ ] **C1** Vérifier que les logs diagnostic sont bien en place :
  - `[SPS_CACHE]` → `_refreshTop10Cache()` ligne 36106 ✅ présent
  - `[REBUILD]` → dans `_refreshTop10Cache()` via `console.log` intégré ✅
  - `[POLLING]` → dans `fetchTennisTop10()` (pariscore.js) ✅ présent
  - `[TOP10_STATUS]` → dans la route (ligne ~21670) ✅ présent
- [ ] **C2** Vérification manuelle : `node --check server.js && node server.js`, tester le flow complet
- [ ] **C3** Enlever les logs diagnostic une fois la vérification faite
- [ ] **C4** Mettre à jour `PATCH_LOG.md`
- [ ] **C5** Synthaxe : `node --check server.js && node --check pariscore.html` (JS inline)

---

## Session suivante recommandée

```bash
# 1. Vérifier que les fichiers passent le check syntaxique
node --check server.js
node --check pariscore.html    # vérifie le JS inline

# 2. Lancer le serveur et tester manuellement
node server.js
# curl http://localhost:3000/api/v1/tennis/top10?mode=viewer

# 3. Mettre à jour PATCH_LOG.md avec le statut des correctifs

# 4. Commit & push
git add -A
git commit -m "fix(eng-review): P0-P3 post-review bugfixes"
git push
```

---

## Références

| Symbole | Emplacement |
|---|---|
| `_tnTop10Cache` | server.js:25570 |
| `_TN_TOP10_REFRESH_INTERVAL` | server.js:25574 (5min) |
| Route `/api/v1/tennis/top10` | server.js:21668 |
| `getSackmannLastSync()` | server.js:24595 (lit `tennis_sackmann_last_sync`) |
| `spsHeartbeat` / `sps_last_run` | server.js:32019 |
| `_refreshTop10Cache()` | server.js:36101 |
| `globalThis.__tennisVBGuard` | server.js:36059 (nouveau Set dedup) |
| `fetchTennisTop10()` | pariscore.js |
