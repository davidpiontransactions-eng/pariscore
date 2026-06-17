# PATCH_LOG.md — Suivi des correctifs ciblés

Fichier de suivi pour les patches rapides et correctifs (P0–P2).
Ne remplace pas CHANGELOG.md (release notes) ni les bd tickets (tracking).

---

## [eng-review-top10] — 2026-06-17 — Cache invalidation + polling + warm-up

### P0 — Cache invalidation après cron_sps_updater.py

- **Cause** : `cron_sps_updater.py` met à jour `player_surface_scores` et `kv.sps_last_run`
  mais `_refreshTop10Cache()` ne lit pas `sps_last_run` → cache `_tnTop10Cache` jamais invalidé.
- **Solution** : stale-while-revalidate. Avant rebuild, comparer `age(sps_last_run)` avec
  `cacheAge` (5 min). S'il est plus jeune, servir le cache existant.
- **Fichiers** : `server.js` — `_refreshTop10Cache()`, `getSackmannLastSync()`
- **Statut** : ❌ À faire

### P0 — Promesse singleton race condition

- **Cause** : `_tennisVBRebuilding` Map avec `.delete(key)` en `.finally()` peut
  race avec un nouveau `.set(key)` par un appel concurrent.
- **Solution** : Remplacer par `globalThis.__top10RebuildPromise` — promesse singleton
  avec Promise.race timeout 60s. Pas de delete race.
- **Fichiers** : `server.js` — `buildTennisValueBets()` / `getTop10Handler`
- **Statut** : ❌ À faire

### P0 — Status API pour polling frontend

- **Cause** : `/api/v1/tennis/top10` retourne juste les données. Le frontend ne sait
  pas si c'est un cache chaud, un build en cours, ou des données périmées.
- **Solution** : Ajouter `status: "building" | "ready" | "stale"` et
  `estimated_seconds` dans la réponse.
- **Fichiers** : `server.js` — route `/api/v1/tennis/top10`
- **Statut** : ❌ À faire

### P1 — Frontend polling sans timeout ni status

- **Cause** : `fetchTennisTop10()` a une boucle 5 retry (~31s max) mais pas
  d'arrêt conditionnel basé sur le `status` du serveur. Lance 5 round trips
  rapides, puis abandonne.
- **Solution** : Nouveau polling avec lecture de `status`, boucle infinie tant que
  `status === "building"`, timeout 10 min, arrêt après 3 erreurs consécutives.
- **Fichiers** : `pariscore.js` — `fetchTennisTop10()`, `startTennisTop10()`
- **Statut** : ❌ À faire

### P2 — Double warm-up au boot (différé)

- **Cause** : `_bootWarmTop10` (5s après boot) + `_sackmannBootSync` (self-ping HTTP
  immédiat, jusqu'à 24 retries) lancent deux builds concurrents.
- **Solution** : Défini — TODO. Simplifier en gardant un seul warm path.
- **Fichiers** : `server.js` — `_bootWarmTop10()`, `_sackmannBootSync`
- **Statut** : ⏳ Différé (P2, pas bloquant)

---

## Format

```
## [branche] — YYYY-MM-DD — Titre court

### P0/P1/P2 — Titre du correctif

- **Cause** : ...
- **Solution** : ...
- **Fichiers** : ...
- **Statut** : ❌ À faire / 🔧 En cours / ✅ Fait / ⏳ Différé
```
