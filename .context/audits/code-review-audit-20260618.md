# AUDIT CODE REVIEW - Bugs Production

Date: 2026-06-18T13:25:53.593Z
Equipe: GStack-Reviewer
Score qualite global: 6.7/10

## BUGS TROUVES

### CR-1: buildTennisValueBets race condition (MEDIUM)
File: server.js:36059
_vbGuard Set non atomique entre has() et add().
Fix: Remplacer par Map avec etat {promise, ts}.

### CR-2: metrics-cache.set() pas de validation NaN (MEDIUM)
File: metrics-cache.js:101
JSON.stringify(NaN) -> null silencieux.
Fix: Ajouter _sanitizeForJSON avant stockage.

### CR-3: 4 caches in-memory jamais purges (LOW)
Files: _TENNIS_SERVE_STATS_CACHE, _canonNameCache, _tennisEnrichSnap, metrics-cache.memory
Fix: setInterval purge toutes les heures.

### CR-4: __top10RebuildPromise pas de finally (LOW)
File: server.js:36117
Fix: .finally(() => globalThis.__top10RebuildPromise = null)

### CR-5: _canonNameCache non invalide apres sync (LOW)
File: server.js:36679
Fix: _canonNameCache.clear() apres _sackmannBootSync

### CR-6: boucle for...of - OK
File: server.js:36885 - yield tous les 20 matchs via setImmediate(r)

## POINTS FORTS
- Shutdown handler avec WAL checkpoint exemplaire
- safeInt/safeFloat/safeFixed/safePercent en place
- Tous les fetch() ont AbortController + timeout 60s
- Stmt SQL prepare reutilise (hoist hors boucle)
- Validation inputs: replace(/[^0-9-]/g)

## TOP 5 ACTIONS
1. Remplacer _vbGuard Set par Map
2. _sanitizeForJSON dans metrics-cache.set()
3. Cron purge caches in-memory
4. finally() sur __top10RebuildPromise
5. _canonNameCache.clear() apres sync
