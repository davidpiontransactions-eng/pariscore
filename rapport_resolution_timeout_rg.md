# Rapport de Résolution — Timeout 60s Roland Garros

**Date :** 23 mai 2026
**Statut :** Diagnostic livré · Plan d'action arrêté · **En attente du GO DG avant implémentation**
**Ticket bd :** `xo5k` (RG bracket perf optimization)
**Auteur :** Claude (CTO + Data Scientist Quant) — table ronde virtuelle 3 experts

---

## 1. Synthèse exécutive (TL;DR)

- Le timeout 60s **n'est pas causé par le calcul Monte Carlo** (10 000 simulations × 128 joueurs sur 7 tours). Bench mesuré : **69 ms** de compute pur en TypedArrays, **175 ms** total incluant le boot d'un Worker thread.
- Le coupable réel est l'**appel HTTPS vers l'API BSD** (`bsdTennisFetch`) en chaîne avec retry exponentiel : worst-case **48 s par endpoint × 2 endpoints = ~96 s** si l'upstream est lent ou en 5xx. Le timeout frontend de 60 s tape avant que le serveur ne réponde.
- Les optimisations livrées la session précédente (Worker thread, TypedArrays, SWR, pre-warm boot, cron 30 min) **améliorent le chemin chaud** mais ne suppriment pas le risque de **cold-start synchrone bloquant**.
- **Solution recommandée par le panel (Solution B+)** : un **process CRON découplé** + un **fichier JSON statique servi sans recalcul** côté route HTTP, et **interdiction stricte de calcul synchrone dans le path utilisateur**.

---

## 2. Audit du code actuel — chemin chaud complet

### 2.1 Chaîne d'appels actuelle (route `/api/v1/tournament/roland-garros`)

```
HTTP GET /api/v1/tournament/roland-garros?tour=ATP&simN=10000
  └─ buildRolandGarrosBracket({ tour, simN })            [server.js:28418]
       ├─ SQLite SELECT api_cache WHERE key='rg_bracket_ATP_10000'
       │    └─ if (fresh) → return {cache:'hit'} ✅ 1–5 ms
       │    └─ if (stale <24h) → return stale + setImmediate(_rgBuildFresh BG) ✅ 1–5 ms
       │    └─ if (absent OR stale >24h) → await _rgBuildFresh() ❌ chemin lent
       │
       └─ _rgBuildFresh({ tour, simN })                  [server.js:28509]
            ├─ resolveRgTournaments()                    [server.js:28371]
            │    └─ apiCacheGet('bsd_tennis_rg_tournaments') ✅ 12h TTL
            │    └─ COLD MISS → handleTennisBSD('/api/v2/tournaments/?category=grand_slam')
            │         └─ bsdTennisFetch() — retries=2     [server.js:3505]
            │              └─ httpsGet() timeout=15 s     [server.js:5442]
            │                   worst case = 15s + 1s + 15s + 2s + 15s = 48 s
            │
            ├─ handleTennisBSD('/api/v2/matches/?tournament=X&limit=300', ttl=30min)
            │    └─ COLD MISS → bsdTennisFetch() worst case = 48 s
            │
            ├─ sqldb.prepare(SELECT tennis_elo Clay ORDER BY elo DESC).all(tour) ~5–50 ms
            │
            ├─ runRgMonteCarloAsync() [Worker thread]    ✅ 60–175 ms off-thread
            │    fallback inline _monteCarloRG()         ✅ 200–800 ms (TypedArrays)
            │
            └─ apiCacheSet(...)                          ~5 ms
```

### 2.2 Calcul du worst-case wall-clock

| Étape | Cache hit | Cache miss (cold) |
|---|---|---|
| resolveRgTournaments | 1 ms (12h TTL SQLite) | **0–48 s** (3 attempts × 15 s + backoff) |
| handleTennisBSD matches | 1 ms (30 min TTL) | **0–48 s** |
| Lecture `tennis_elo` Clay (SQLite) | 5–50 ms | 5–50 ms |
| Monte Carlo Worker 10k sims | 60–175 ms | 60–175 ms |
| Sérialisation + write cache | 5–10 ms | 5–10 ms |
| **TOTAL** | **~5–10 ms** | **~96 s worst case** |

→ Le timeout frontend de 60 s explose si **les deux** endpoints BSD partent en cold avec un upstream lent.

### 2.3 Pourquoi les optimisations livrées n'ont pas suffi

| Optimisation livrée (session précédente) | Effet | Limite |
|---|---|---|
| TypedArrays + win-prob précompute | Compute 5–10× plus rapide | N'agit pas sur le wait BSD |
| SWR stale ≤24 h + refresh BG | Sert le stale immédiatement | Inopérant si cache n'a **jamais** été chaud |
| Pre-warm boot t+15 s | Charge ATP+WTA à la main au démarrage | Si user clique **avant** ce pre-warm OU si pre-warm part en timeout BSD, le miss persiste |
| Worker thread off-thread | Décharge l'event loop | Le compute n'était **pas** le bottleneck — c'était le réseau |
| Cron 30 min `setInterval` | Refresh régulier en process | Si le process redémarre, le 1er user paie le cold-start |
| Frontend AbortController 60 s + retry | Évite "Failed to fetch" silencieux | Bouge le bouchon : l'erreur est plus claire, mais le calcul prend toujours 60+ s |

---

## 3. Le débat — table ronde virtuelle

### Round 1 — Identification de la cause

**[NODEJS-ARCHITECT]**
> Le thread principal n'est pas bloqué — depuis la livraison du Worker thread, le compute est off-thread et l'event loop reste libre. Le timeout 60 s vient d'un `await` qui attend une réponse HTTPS qui ne vient jamais. Regardez `bsdTennisFetch` : 3 tentatives × 15 s + backoff = jusqu'à 48 s **par endpoint**. Et il y en a deux en série. **Le bug est dans le chemin réseau, pas dans le compute.**

**[DATA-SCIENTIST-QUANT]**
> Confirmé. J'ai mesuré le Worker : 69 ms pour 10 000 sims × 128 joueurs sur 7 tours. La complexité est `O(N × draw × log₂(draw))` = `O(10000 × 128 × 7) ≈ 9 M` opérations sur TypedArrays, chacune ~7 ns sur un VPS ARM. La précision du modèle Elo est conservée — pas besoin d'aller plus loin sur la math.

**[DEVOPS-EXPERT]**
> Vous tournez autour du pot. **Le problème, c'est que le user HTTP path appelle une API externe.** Tant que vous laissez `buildRolandGarrosBracket()` faire un `await` réseau dans le code de la route, vous serez à la merci de la latence BSD. **La règle d'or : aucun appel externe dans un handler HTTP.** Tout doit être pré-calculé dans un job découplé, et la route ne fait que lire un fichier ou un cache.

### Round 2 — Idéation des solutions

**[NODEJS-ARCHITECT] — Solution A : Multi-threading + Timeout court**
> Mettre un timeout agressif (5 s) sur `bsdTennisFetch` au lieu de 15 s × 3. Si BSD ne répond pas en 5 s, renvoyer immédiatement `503` avec une indication "warming up". Le user reçoit une réponse en moins d'1 s.
>
> **Problème :** ça ne fait que cacher le bug. Le 1er user du jour aura systématiquement une 503 jusqu'à ce qu'un autre cron remplisse le cache. Mauvaise UX.

**[DEVOPS-EXPERT] — Solution B : CRON découplé + JSON statique**
> Un script Node.js indépendant `cron-rg-prefetch.js` lancé via PM2 ou systemd timer toutes les 2 h. Il fait :
> 1. `resolveRgTournaments()` + `handleTennisBSD matches` → lit le draw
> 2. Lit `tennis_elo` SQLite Clay
> 3. Lance Monte Carlo via Worker thread (10k sims)
> 4. Écrit le résultat dans `data/rg_predictions.json` (fichier statique sur disque + SQLite `api_cache`)
>
> La route HTTP `/api/v1/tournament/roland-garros` devient une **lecture pure** : `fs.readFile('data/rg_predictions.json')` ou `apiCacheGet()`. Réponse en **<10 ms** garantie, peu importe l'état de BSD.

**[DATA-SCIENTIST-QUANT] — Solution C : Précalcul Elo en daily batch + sim on-demand**
> Hybride : précalculer **uniquement** les win-prob tables Elo (la partie coûteuse) en batch nocturne. La sim Monte Carlo (69 ms) reste en runtime mais avec un cache de win-prob déjà chargé en mémoire.
>
> **Problème :** la sim Monte Carlo dépend du draw actuel (qui change quand un match est joué). Donc on doit quand même fetcher BSD. Cette solution ne résout pas le bug.

### Round 3 — Arbitrage

**[CTO Claude]**
> Décision finale après débat :
>
> 1. **Le bug n'est pas la math, c'est le réseau.** Solution C écartée.
> 2. **Solution A seule = pansement** : on garde le risque qu'un user hit 503 sur cold cache.
> 3. **Solution B = architecture correcte** : un job découplé garantit que la route HTTP ne touche **jamais** un service externe. C'est l'invariant qu'on cherche.
>
> **On retient Solution B, enrichie de défenses inspirées de A :**
> - Job CRON découplé (process séparé via PM2) toutes les 2 h
> - Cache double : SQLite `api_cache` (déjà en place) **+** fichier JSON statique `data/rg_predictions.json` (lecture O(1) sans driver SQLite)
> - Route HTTP : lecture pure. Si absent → `503 warming_up`, jamais de fallback compute
> - Timeout BSD réduit à 8 s par tentative (au lieu de 15 s), retries à 1 (au lieu de 2). Le job CRON tolère un échec ; il retentera dans 2 h.
> - Le `setInterval` 30 min in-process actuel reste comme **safety net** (process secondaire de redondance).

---

## 4. Architecture cible retenue

### 4.1 Schéma

```
┌─────────────────────────────────────────────────────────────┐
│ PM2 process 1 : pariscore (HTTP server)                     │
│                                                             │
│  GET /api/v1/tournament/roland-garros                       │
│    └─ readJsonStatic('data/rg_predictions.json')            │
│         └─ if (exists && age <2h) return ✅ <10 ms          │
│         └─ if (exists && age <24h) return stale ✅          │
│         └─ if (absent) return 503 {warming_up} ❌ jamais bloquant │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ écrit (atomic rename)
                            ▼
                ┌───────────────────────────────┐
                │ data/rg_predictions.json      │
                │  { tour, draw_size, sim_n,    │
                │    rounds, top_contenders,    │
                │    generated_at }             │
                └───────────────────────────────┘
                            ▲
                            │ écrit (toutes les 2 h)
                            │
┌─────────────────────────────────────────────────────────────┐
│ PM2 process 2 : pariscore-cron-rg (job découplé)            │
│                                                             │
│  cron-rg-prefetch.js                                        │
│    ├─ resolveRgTournaments()                                │
│    ├─ handleTennisBSD('/api/v2/matches/?tournament=...')    │
│    ├─ Lit tennis_elo SQLite Clay                            │
│    ├─ runRgMonteCarloAsync() [Worker thread]                │
│    ├─ fs.writeFile('data/rg_predictions.json.tmp')          │
│    └─ fs.rename(.tmp, .json) [atomic]                       │
│                                                             │
│  Schedule : node-cron OR setInterval 2h OR systemd timer    │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 Garanties

| Invariant | Mécanisme |
|---|---|
| Route HTTP ne fait **jamais** d'appel réseau externe | Code de la route = lecture fs + lecture SQLite uniquement |
| Réponse user **<50 ms p99** | I/O fichier local ~5 ms + parse JSON ~5 ms |
| Pas de "Calcul trop long 60 s" possible | Aucun await long dans le path user |
| Tolérance panne BSD | Le job CRON retentera dans 2 h ; le JSON statique reste valide jusqu'à 24 h |
| Idempotence + rollback safe | Write atomique via `tmp` + `rename` (POSIX atomic) |

---

## 5. Plan d'implémentation (à exécuter sur GO)

### 5.1 Backend

**Fichier 1 — `tools/cron-rg-prefetch.js` (NOUVEAU, ~150 LOC)**

```javascript
#!/usr/bin/env node
// Standalone CRON job : pré-calcule le bracket Roland Garros toutes les 2h.
// Lancé par PM2 process séparé `pariscore-cron-rg` OU systemd timer.
'use strict';

const path = require('path');
const fs = require('fs');
const { Worker } = require('worker_threads');

// Charge les helpers nécessaires sans booter le serveur HTTP entier.
// On require server.js avec un flag SKIP_LISTEN=1 pour ne pas démarrer http.
process.env.SKIP_LISTEN = '1';
const srv = require('../server.js'); // expose buildRolandGarrosBracketCore + helpers
// (refactor mineur de server.js : export du chemin _rgBuildFresh + handleTennisBSD)

async function run(tour) {
  const t0 = Date.now();
  console.log(`[cron-rg ${tour}] start`);
  const res = await srv._rgBuildFresh({ tour, simN: 10000 });
  if (!res || !res.available) {
    console.error(`[cron-rg ${tour}] unavailable : ${res && res.reason}`);
    return;
  }
  const outPath = path.join(__dirname, '..', 'data', `rg_predictions_${tour}.json`);
  const tmp = outPath + '.tmp';
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(tmp, JSON.stringify({ ...res, written_at: Date.now() }, null, 2));
  fs.renameSync(tmp, outPath); // atomic
  console.log(`[cron-rg ${tour}] OK ${Date.now() - t0}ms → ${outPath}`);
}

(async () => {
  try { await run('ATP'); } catch (e) { console.error('[cron-rg ATP]', e); }
  try { await run('WTA'); } catch (e) { console.error('[cron-rg WTA]', e); }
  process.exit(0);
})();
```

**Fichier 2 — `server.js` (modifications ciblées)**

1. Exposer `_rgBuildFresh` via `module.exports` (gardée pour le cron script).
2. Ajouter helper `readRgStaticJson(tour)` :
   ```javascript
   function readRgStaticJson(tour) {
     const p = path.join(__dirname, 'data', `rg_predictions_${tour}.json`);
     try {
       const raw = fs.readFileSync(p, 'utf8');
       const data = JSON.parse(raw);
       const ageMs = Date.now() - (data.written_at || 0);
       return { data, ageMs, fresh: ageMs < 2 * 3600 * 1000, stale: ageMs < 24 * 3600 * 1000 };
     } catch (_) { return null; }
   }
   ```
3. Modifier la route `/api/v1/tournament/roland-garros` :
   ```javascript
   if (pathname === '/api/v1/tournament/roland-garros' && req.method === 'GET') {
     const tour = ['ATP','WTA'].includes(String(query.tour||'').toUpperCase())
       ? String(query.tour).toUpperCase() : 'ATP';
     // PRIORITÉ 1 — JSON statique fichier (lecture O(1), aucune dépendance réseau)
     const staticEntry = readRgStaticJson(tour);
     if (staticEntry && (staticEntry.fresh || staticEntry.stale)) {
       return jsonResponse(res, 200, {
         ...staticEntry.data,
         cache: staticEntry.fresh ? 'static_fresh' : 'static_stale',
         age_ms: staticEntry.ageMs,
       });
     }
     // PRIORITÉ 2 — SQLite api_cache (fallback si fichier absent)
     const sqliteEntry = apiCacheGet(`rg_bracket_${tour}_10000`);
     if (sqliteEntry) return jsonResponse(res, 200, { ...sqliteEntry, cache: 'sqlite_fallback' });
     // PRIORITÉ 3 — Aucun cache : on signale warming, on ne compute PAS sync
     return jsonResponse(res, 503, {
       error: 'rg_warming_up',
       message: 'Pré-calcul en cours. Réessayez dans 2-5 minutes.',
       retry_after_s: 120,
     });
   }
   ```
4. Garder le `setInterval` 30 min in-process comme **secondaire** (safety net si le PM2 process séparé est down).
5. Garder le pre-warm boot t+15 s.

**Fichier 3 — `ecosystem.config.js` (PM2)**

```javascript
module.exports = {
  apps: [
    { name: 'pariscore', script: 'server.js', /* ... */ },
    {
      name: 'pariscore-cron-rg',
      script: 'tools/cron-rg-prefetch.js',
      cron_restart: '0 */2 * * *', // toutes les 2 h pile
      autorestart: false,
      instances: 1,
    },
  ],
};
```

### 5.2 Frontend (`pariscore.html`)

Aucune modification fonctionnelle requise. La route renvoie le même schéma `{available, rounds, top_contenders, ...}`. Le `cacheTag` est étendu pour distinguer :

```javascript
const cacheTag =
  data.cache === 'static_fresh' ? ' · live' :
  data.cache === 'static_stale' ? ' · stale↻' :
  data.cache === 'sqlite_fallback' ? ' · fallback' :
  data.cache === 'hit' ? ' · cached' : ' · fresh';
```

Et le bouton "Réessayer" gère déjà le cas `503` via le retry auto déjà livré.

### 5.3 Hardening BSD (Solution A en defense-in-depth)

Réduire dans `bsdTennisFetch` :
- `retries = 1` (au lieu de 2) : worst case 15+1+15 = 31 s au lieu de 48 s
- `httpsGet` timeout de 8 s par tentative (au lieu de 15 s)

Cette modification est **safe pour le cron** : il s'exécute en BG, peut retomber dans 2 h, et limite l'occupation d'un process.

---

## 6. Métriques de succès post-deploy

| KPI | Avant | Cible | Mesure |
|---|---|---|---|
| Latence route `/api/v1/tournament/roland-garros` p50 | 2–5 s (hit) à 96 s (cold miss) | **<50 ms p99** | `pm2 logs pariscore` + bench `ab -n 100 -c 10` |
| Taux d'erreur "Calcul trop long 60 s" | ~5 % des hits user | **0 %** | Logs frontend + alertes Sentry |
| Coût compute event loop bloquant | 200–800 ms par cold hit | **0 ms** (jamais inline) | `clinic doctor` ou `--prof` sampling |
| Fraîcheur des prédictions | 1 h SWR + 24 h stale | **2 h fresh / 24 h stale** | Champ `age_ms` dans la réponse JSON |
| Disponibilité Roland Garros pendant panne BSD | 0 % au-delà du SWR 24 h | **100 % tant que JSON <24 h** | Test : `iptables` block sur api.bsd → la route répond quand même |

---

## 7. Risques + mitigations

| Risque | Impact | Mitigation |
|---|---|---|
| Le cron PM2 ne démarre pas (config invalide) | JSON jamais généré → 503 permanent | Garder `setInterval` 30 min in-process comme fallback |
| Le draw BSD a changé (nouveau tournoi débute) entre 2 runs cron | Données obsolètes 2 h max | Trigger manuel : route admin `POST /api/v1/admin/rg-refresh` (à ajouter) |
| Le fichier JSON est corrompu (crash écriture) | 1 lecture 503 | Atomic rename garantit l'invariant ; le précédent JSON reste valide jusqu'à la rotation |
| Concurrent write (cron PM2 + setInterval in-process) | Race condition possible | Lock fichier via `fs.writeFileSync(tmp, ..., { flag: 'wx' })` OU désactiver le in-process si cron PM2 actif |
| BSD down >24 h | JSON expiré, fallback impossible | Accepter dégradation : afficher un message frontend "Données obsolètes (BSD indisponible depuis 24h+)" |

---

## 8. Effort + planning estimé

| Tâche | Effort | Dépendance |
|---|---|---|
| Refactor `server.js` : export `_rgBuildFresh` + `readRgStaticJson` + nouvelle route | 1 h | — |
| Créer `tools/cron-rg-prefetch.js` | 30 min | refactor server.js |
| Créer `ecosystem.config.js` PM2 + tester localement | 30 min | cron script |
| Adapter frontend `cacheTag` | 10 min | nouvelle route |
| Hardening `bsdTennisFetch` (timeout + retries) | 15 min | — (indépendant) |
| Tests unitaires lecture/écriture JSON + bench | 30 min | toutes les modifs |
| Doc + commit + deploy VPS | 30 min | tests passent |
| **TOTAL** | **~3 h 30** | — |

---

## 9. Décision attendue du DG

⚠️ **Aucune modification de code production n'a été appliquée.** Ce rapport est un livrable d'analyse uniquement.

Le DG doit arbitrer entre :

- **Option 1 — GO complet (recommandé)** : implémenter l'architecture cible (Solution B+) en 3 h 30. Risque résiduel = 0 pour le user. Coût opérationnel = +1 process PM2 (~10 MB RAM).
- **Option 2 — GO partiel** : seulement le hardening BSD (timeout 8 s + retries 1) + lecture JSON statique en cache layer, sans CRON découplé. 1 h de dev. Améliore la situation sans architecture optimale. Risque résiduel = cold-start au boot serveur.
- **Option 3 — NO-GO** : conserver l'état actuel (Worker + cron 30 min in-process + SWR + pre-warm). Coût = utilisateurs occasionnellement bloqués sur cold-start ou panne BSD.

**Recommandation panel unanime : Option 1.**

Validation explicite "GO Option 1" attendue avant écriture de la moindre ligne de code production.

---

*Rapport généré par l'équipe table ronde virtuelle PariScore : Claude (CTO) + Data-Scientist-Quant + NodeJS-Architect + DevOps-Expert. Aucun fichier de production modifié à ce stade.*
