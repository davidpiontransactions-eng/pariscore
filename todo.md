# Todo — eng-review-top10

Branche : `eng-review-top10`
Basée sur : `gstack-plan-eng-review` session (2026-06-17)

---

## Lane A — Backend (server.js)

- [ ] **A2** Stale-while-revalidate : dans `_refreshTop10Cache()`, lire `sps_last_run` via `getSackmannLastSync()` ; comparer age avec TTL 5min ; si plus jeune, sauter le rebuild
- [ ] **A3** Status API : ajouter `status: "building" | "ready" | "stale"` et `estimated_seconds` dans `/api/v1/tennis/top10`
- [ ] **A4** Promesse singleton : remplacer `_tennisVBRebuilding` Map par `globalThis.__top10RebuildPromise`
- [ ] **A5** Timeout 60s + fallback : Promise.race + garder ancien cache si erreur

## Lane B — Frontend (pariscore.js)

- [ ] **B1** Nouveau polling : `fetchTennisTop10()` lit `status`, `estimated_seconds` ; boucle tant que `building` ; timeout 10min ; max 3 erreurs consécutives

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
