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

## Bugfix — Investigations sur « maj HS sur tous les onglets »

Découvert lors de la revue post-implémentation. Le bug est probablement causé par des effets de bord des changes A2 qui ont embarqué des modifs hors-scope (fallback showPage + BOM).

### P0 — Fallback showPage dans pariscore.html ⚠️ PRIORITAIRE
- **Fichier** : `pariscore.html` — script inline ajouté dans le commit A2
- **Problème** : `window.showPage` est override avec une version simplifiée **avant** que `pariscore.js` ne charge. Si le Service Worker sert un HTML avec le fallback mais que `pariscore.js` est stale/délayé (ou que le wrapper lignes 26575-26586 ne s'exécute pas), le fallback reste actif → hubs cassés, scroll perdu, verrous ignorés, arrêt des polls live, navigation dégradée sur TOUS les onglets.
- **Action** : Supprimer le script inline fallback et le remplacer par un mécanisme plus robuste (ou le retirer carrément si le SW ne sert pas de stale HTML sans JS)
- **Réf** : `pariscore.html` ligne ~12110, `pariscore.js` ligne 842 + 26575

### P1 — Dedup perdu dans buildTennisValueBets (server.js)
- **Fichier** : `server.js` — commit A4
- **Problème** : A4 a supprimé le Set `_tennisVBRebuilding` dans `buildTennisValueBets()` sans remplacement. Tous les appels concurrents pour la même key déclenchent désormais un rebuild en parallèle → rate limits API externes, saturation.
- **Action** : Remettre un guard de déduplication (nouveau Set ou flag) avant `_buildTennisValueBetsCore()`
- **Réf** : `server.js` lignes 36056-36067

### P2 — _refreshTop10Cache() retourne type incohérent (server.js)
- **Fichier** : `server.js` — commit A4
- **Problème** : Le guard singleton retourne `_tnTop10Cache` (un objet) au lieu d'une Promise.
  ```js
  if (globalThis.__top10RebuildPromise) { return _tnTop10Cache; }  // ← objet, pas Promise !
  ```
  L'appelant ligne 47435 fait `.catch()` → `TypeError: .catch is not a function` si l'objet atterrit dans le catch.
- **Action** : Retourner `Promise.resolve(_tnTop10Cache)` pour uniformiser
- **Réf** : `server.js` ligne 36098

### P3 — BOM (U+FEFF) dans pariscore.html + sw.js
- **Fichier** : `pariscore.html` + `sw.js` — commit A2
- **Problème** : Caractère BOM (`﻿`) ajouté devant `<!DOCTYPE html>` et en tête de sw.js. Ne casse rien dans les navigateurs modernes mais peut causer mode quirks IE, erreurs silencieuses SW, ou problèmes SEO.
- **Action** : Supprimer le BOM des deux fichiers
- **Réf** : `pariscore.html` ligne 1, `sw.js` ligne 1

## Post-implementation

- [ ] **C1** Logs diagnostic `[SPS_CACHE]`, `[TOP10_STATUS]`, `[REBUILD]`, `[POLLING]`
- [ ] **C2** Vérification manuelle : lancer le serveur, tester le flow complet
- [ ] **C3** Enlever les logs diagnostic
- [ ] **C4** Mettre à jour `PATCH_LOG.md`

## Références

| Symbole | Emplacement |
|---|---|
| `_tnTop10Cache` | server.js:25570 |
| `_TN_TOP10_REFRESH_INTERVAL` | server.js:25574 (5min) |
| Route `/api/v1/tennis/top10` | server.js:21668 |
| `getSackmannLastSync()` | server.js:24595 (lit `tennis_sackmann_last_sync`) |
| `spsHeartbeat` / `sps_last_run` | server.js:32019 |
| `_refreshTop10Cache()` | server.js:36094 |
| `_tennisVBRebuilding` Map | server.js (à remplacer) |
| `fetchTennisTop10()` | pariscore.js |
