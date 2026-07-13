# PERF AUDIT & CACHE STRATEGY — Onglet Football (12.4s → <10s)

**Date :** 2026-07-12
**Cible :** `server.js` (52185 lignes) + `pariscore.app.js` (frontend, 32860 lignes)
**Mesure initiale :** chargement onglet Football = **12425 ms** (Playwright). Routes API individuelles = 1-30 ms.
**Objectif :** < 10 s, cold-start inclus.

> Audit lecture seule. Aucune modification de `server.js`. Toutes les références sont `file:line`.

---

## TL;DR — Le goulot des 12s n'est PAS une route lente, c'est une cascade

Les routes mesurées (2-30 ms) sont individuellement rapides, mais l'onglet Football déclenche au **premier paint** un **fan-out de 7+ requêtes + 1 appel IA Gemini + 1 SSE persistant**, dont :

1. **`/api/v1/ai-scout`** → appel réseau **Gemini 2.0 Flash** sur cold path (**3-8s**, cache 6h seulement) — `server.js:14861`
2. **`getAccuracyReport()`** → boucle calibration Brier+Log-Loss sur **28 306** entrées historique, **zéro cache** — `server.js:11936`
3. **`/api/v1/bankroll/simulated`** → re-simule un backtest sur **28 306** entrées à chaque appel, **zéro cache** — `server.js:37071`
4. **`/api/v1/matches`** → payload **185-222 KB** (jusqu'à ~400+ KB en pleine journée de matchs), **aucun `Cache-Control`** → jamais mis en cache navigateur — `server.js:21454`
5. **`lazyLoadButeurs`** → cascade **2×N requêtes** (`/top-butteurs/:id` + `/top-kpi/:id`, batch 5) — `pariscore.app.js:13824`
6. **Bug `db.prepare`** sur route logo single → force 20 fetchs Sofascore réseau en série — `server.js:33179`

Le total réel sous charge = somme des latences + contention SQLite single-thread + parsing JSON 185 KB × plusieurs routes. La mesure Playwright capture tout cela en série/parallèle sur l'event-loop Node **mono-thread**.

---

## Phase 1 — État actuel du cache

### 1.1 Cache DB persistant (`api_cache` table SQLite)

**Schéma** — `server.js:6410-6418`
```sql
CREATE TABLE api_cache (key TEXT PRIMARY KEY, data TEXT, source TEXT, created_at INT, expires_at INT)
-- INDEX idx_api_cache_expires, idx_api_cache_source
```

**Helpers** — `server.js:7117-7163`
- `apiCacheGet(key)` — `SELECT data, expires_at` + lazy delete si expiré
- `apiCacheSet(key, data, source, ttlMs)` — `INSERT OR REPLACE`
- `apiCacheSetBatch(entries, source)` — transaction
- **TTL par défaut** `API_CACHE_TTL = 12h` — `server.js:7041`
- **TTL pilotable** via `cache_profiles.json` + `getCacheTTL(profile, fallback)` — `server.js:7206`

**Contenu réel au moment de l'audit** (mesuré via `pariscore.db`) :
| source | rows | taille |
|---|---|---|
| `espn_odds` | 58 | 884.9 KB |
| `openfootball` | 5 | 240.1 KB |
| `mma_photo` | 85 | 8.1 KB |
| **TOTAL** | **148** | **1133 KB** |

**Couverture actuelle ( TTL par source )** — `server.js`:
| Source / domaine | TTL | Réf |
|---|---|---|
| `apif_teams` | 1h / 24h / 30j (selon succès) | `server.js:688-701` |
| `tsdb_player` / `tsdb_team` | 24h négatif, 7j positif | `server.js:726-871` |
| `apif_player` | 1h / 12h / 24h | `server.js:910-973` |
| `sofa_team` | 7j | `server.js:2881` |
| `bsd_transfers` / `bsd_player_profile` | 24h / 6h | `server.js:3504-3535` |
| `tv_channels` | 24h | `server.js:3635` |
| `sofa_matches` | 6h | `server.js:3667` |
| `oddspapi_*` (tour/fx/setodds/alert) | 24h / variable | `server.js:3165-3374` |
| `logo` (logos équipes) | **30j** | `server.js:33186` |
| `livestream_*` / `sofa_editorial_*` / `sofa_venue_referee_*` | 24h / 7j (lazy ETL) | `server.js:4647-4817` |
| `flashscore_live_stats_*` | 30 min | `server.js:4805` |
| `flashscore_standings_*` | 7j | `server.js:4845` |

### 1.2 Table `api_cache_buffer` (résilience 24h)

**Schéma** — `server.js:6436-6448` : `UNIQUE(source, data_key)`, fallback si API échoue. **Actuellement VIDE** (mesuré).

### 1.3 Caches mémoire (Map / objets globaux)

> 40+ caches mémoires identifiés. Les pertinents pour l'onglet Football :

| Cache | Type | TTL | Portée | Réf |
|---|---|---|---|---|
| `cachedMatches` | array | ∞ (snapshot) | Backup si `db.matches` vide | `server.js:5511, 7477` |
| `oddsCache` | `{[id]:{data,ts,...}}` | **30 min** (`ODDS_CACHE_TTL`) | Cotes par fixture | `server.js:5518-5519` |
| `_teamLogoMemCache` | `Map` | ∞ (process) | Logos équipes (lookup `team_logos`) | `server.js:3826` |
| `aiScoutCache` | `{data,timestamp}` | **6h** (`AI_SCOUT_TTL`) | Réponse Gemini AI Scout | `server.js:14793-14794` |
| `_bsdOddsCache`, `_bsdPolymarketCache`, `_bsdManagerCache`, `_bsdPredictionEventCache`, `_bsdPredLinupCache`, `_pBetsCache` | `Map` | ts-based | Enrichissements BSD par eventId | `server.js:3958-4114` |
| `_nateloMap` (Elo tennis), `playerSkillCache`, `playerSquadAttrIndex`, `playerStatsIndex` | `Map` | ∞ / 24h | Index joueurs | `server.js:2802-3086` |
| `_favWinRateCache` | `Map` | ts | Hit rate par ligue | `server.js:9780` |
| `_fuzzyCache` | `Map` | ∞ | Fuzzy match noms équipes | `server.js:8064` |
| `REVERIFY_TOKENS` | `Map` | 60s sweep | Tokens re-vérification | `server.js:1099, 1118` |
| `_livePatchSnapshot`, `_pulseLastBroadcast` | `Map` | snapshot | SSE live diff | `server.js:1510, 1524` |

### 1.4 Crons / warmers existants

| Cron / warmer | Fréquence | Rôle | Réf |
|---|---|---|---|
| `__cleanupProcessListeners` | 1h | Nettoyage listeners | `server.js:66` |
| `purgeExpiredReverifyTokens` | 60s | Purge tokens | `server.js:1118` |
| `cronEnrichBSDFullStack` | — | Enrichissement matchs BSD (odds+ML+polymarket) | `server.js:4402` |
| `cronEnrichTMSquads` | — | Squads Transfermarkt | `server.js:4425` |
| `_rgLivePollOnce` (RG tennis) | `_rgLivePollMs` | Polling live tennis | `server.js:40746` |
| `_refreshTop10Cache` (tennis) | **5 min** | Warmer Top10 tennis (boot +60s puis 5min) | `server.js:38557-38578` |
| `pollTennisLive` | — | Cache `_tennisLiveCache` | `server.js:38591, 38620` |
| TT-OOP prefetch | journalier 8h | Order-of-play tennis | `server.js:32833, 32937, 33080` |
| **LEAGUE_CRON_MS** (refresh ligues) | **6h** (T1) / 12h (T2) | Refresh odds par ligue | `server.js:1787-1804` |
| `oddsCacheCleanExpired` | — | Purge `oddsCache` | `server.js:7264` |
| `apiCacheCleanExpired` | — | Purge `api_cache` | `server.js:7245` |

**⚠️ Aucun warmer pour : `top-matches`, `accuracy/public`, `bankroll/simulated`, `ai-scout`.** Tous ces calculs sont froids au premier utilisateur après boot (ou après expiration du cache 6h AI Scout).

### 1.5 Cache pour la route `/api/v1/top-matches` précisément

**Route** — `server.js:35344-35353` :
```js
if (pathname === '/api/v1/top-matches') {
  const timeframe = query.timeframe || 'today';
  const limit = Math.min(20, parseInt(query.limit || '10'));
  return jsonResponse(res, 200, {
    matches: getTopMatchesByTimeframe(timeframe, limit),
    timeframe, generated_at: new Date().toISOString(),
  });
}
```

**Conclusions :**
- **AUCUN cache devant** (ni mémoire, ni DB, ni `Cache-Control` navigateur).
- **Aucune authentification** (`requireAuth` non appelé) → accessible publiquement → premier visiteur paie le cold path.
- **Source de données** : `db.matches` (in-memory, chargé depuis `kv.db_matches` SQLite).
- **Calcul** : `getTopMatchesByTimeframe` — `server.js:20623-20638` : filter + map (`computeTopPick` + `matchEngagementScore`) + sort + slice. **Léger en soi** (lecture Poisson pré-calculé sur les matchs).
- **Le Poisson / Dixon-Coles / blended_cb / fair / calibrated sont PRÉ-CALCULÉS** sur les enregistrements matchs (pas de calcul à la volée) :
  - `match.poisson = computePoisson(...)` — `server.js:18518, 4308, 4323, 4374`
  - `match.fair = edge.fair` — `server.js:18539`
  - `match.blended_cb` — `server.js:5971`
  - Réassignés dans `buildMatchRecord` / `enrichHistory` / sync ligues (cron 6h)
- **Payload** : `{...m}` spread complet → ~5 KB/match, ~52 KB pour 10 matchs (mesuré). Renvoie des champs non nécessaires à l'accueil (`all_bookmakers` est strippé ailleurs mais PAS ici).

---

## Phase 2 — Identification des calculs coûteux (goulot des 12s)

### 2.1 Pas d'équivalent `buildFootballValueBets` lent

`grep` de `buildFootball*`, `computeTopMatches`, `buildFootballValueBets`, `precomputeFootball` → **aucun match**. Le football n'a PAS de builder lourd à la `buildTennisValueBets` (backlog tennis). Les modèles (Poisson/Dixon-Coles/CatBoost) sont **pré-calculés et stockés sur les matchs** (`server.js:18518`, `5971`), pas recalculés par requête. **Le problème n'est donc pas un calcul CPU à la volée.**

### 2.2 Hypothèses priorisées (avec preuves)

#### H1 — **`/api/v1/ai-scout` = appel réseau Gemini sur cold path (3-8s)** — **CAUSE PRINCIPALE LA PLUS PROBABLE**

- **Preuve :** `generateAIScout()` fait `await httpsPost('https://generativelanguage.googleapis.com/.../gemini-2.0-flash:generateContent...')` — `server.js:14861-14865`.
- Cache mémoire `aiScoutCache` TTL **6h** seulement — `server.js:14794`. Premier appel après boot ou après 6h = **latence réseau Gemini (3-8s typique)**.
- Appelé par `loadAIScout()` — `pariscore.app.js:12704-12706` → `apiFetch('/api/v1/ai-scout')`.
- **Déclenché synchro dans `loadMatches()`** : `if (_accM.footPro) loadAIScout();` — `pariscore.app.js:11603`.
- Comme c'est `await` dans le handler serveur (`generateAIScout().then(...)` — `server.js:45347`), la requête HTTP reste ouverte 3-8s et **occupe l'event-loop** (le `await` réseau libère l'event-loop, mais la connexion persiste et le client attend).
- **Alignement avec la mesure :** 12.4s Playwright ≈ AI Scout cold (3-8s) + parsing payloads + rendu DOM + autres fetchs en parallèle. Si AI Scout était chaud, on tomberait sous 3s.

#### H2 — **`getAccuracyReport()` boucle sur 28 306 entrées sans cache** — latence masquée mais réelle sous charge

- **Preuve :** `getAccuracyReport()` itère `for (const h of history)` avec calcul Brier + Log-Loss — `server.js:11936-11952`.
- `history` = **28 306 entrées vérifiées** (mesuré : `history_matches` = 8342 KB en `kv`).
- **Aucun cache** sur `/api/v1/accuracy/public` — `server.js:37519-37526` appelle `getAccuracyReport()` à chaque requête.
- Mesuré 13-22 ms individuellement (brief), mais c'est du CPU pur sur l'event-loop mono-thread → **compète avec les autres requêtes parallèles** de la cascade Football.

#### H3 — **`/api/v1/bankroll/simulated` re-simule un backtest sur 28 306 entrées sans cache**

- **Preuve :** `for (const h of history)` avec push dans `bets[]` — `server.js:37071-37084`. Itère **tout** l'historique vérifié (28 306) à chaque appel.
- **Aucun cache**, aucun `Cache-Control`. Mesuré 5-29 ms, mais même problème de contention event-loop que H2.

#### H4 — **`/api/v1/matches` : payload 185-222 KB, aucun `Cache-Control` navigateur**

- **Preuve :** `_stripMatchForList` retire 8 champs lourds (~27 KB économisés) — `server.js:1733-1742, 21451`. Payload mesuré : **185 KB stripped / 222 KB full** pour 43 matchs.
- En journée de matchs (250+ matchs), payload monte à **~400+ KB** (le strip économise ~210 KB selon commentaire `server.js:21449`).
- **`jsonResponse` ne pose AUCUN header `Cache-Control`** — `server.js:21259-21274`. Donc le navigateur **re-télécharge** à chaque visite d'onglet.
- Le client ajoute `?_t=${Date.now()}` — `pariscore.app.js:11554` → **bypass même le cache heuristique navigateur**.
- `AppCache` client (TTL 60s défaut) n'aide qu'au 2e passage — `pariscore.app.js:784-841, 21514`.

#### H5 — **Cascade `lazyLoadButeurs` : 2×N requêtes en série (batch 5)**

- **Preuve :** `lazyLoadButeurs` — `pariscore.app.js:13820-13847` : pour chaque match sans `topButteurs`/`topKPI` ET avec `_bsd_event_id`, fire `/api/v1/top-butteurs/:id` + `/api/v1/top-kpi/:id` par batches de 5 (`CONCURRENCY = 5`).
- **Au moment de l'audit : 0 match avec `_bsd_event_id`** (mesuré) → cascade inactive actuellement. **Mais en saison/journée de matchs**, ~N matchs déclenchent 2×N requêtes → peut ajouter plusieurs secondes (chaque miss lance un fetch BSD réseau en arrière-plan — `server.js:37562-37575`).
- Routes serveur : `top-butteurs` — `server.js:37528-37579`, `top-kpi` — `server.js:37582-37595`. Sur miss, `fetchBSDPlayerRatings` fait jusqu'à **4 pages HTTP** (`server.js:16226-16231`).

#### H6 — **Bug `db.prepare` sur route logo single → 20 fetchs Sofascore en série**

- **Preuve (BUG) :** route `/api/v1/team-logo` — `server.js:33179-33187` :
```js
db.prepare('INSERT OR REPLACE INTO api_cache ...').run(...)  // ← db est l'objet JS (let db = {matches:[],...}), PAS sqldb !
```
- `db` déclaré en `server.js:6158` comme objet plain JS (`let db = { matches: [], ... }`). Il n'a **pas** de méthode `.prepare` → **throw silencieux** (catché en `server.js:33191-33194` qui répond `{url:null}`).
- Conséquence : sur cache-miss API (`apiCacheGet` ligne 33144), le résultat n'est **jamais persisté** → **chaque logo refait un `await searchSofascoreTeam(name)`** (réseau Sofascore — `server.js:2870, 33164`).
- **Bonne nouvelle :** le widget HybridHero utilise déjà le **batch** `/api/v1/team-logos?names=` — `pariscore.app.js:32797` (1 requête, lookup local, `Cache-Control: max-age=300` — `server.js:33133`). Mais d'autres chemins (ligne `pariscore.app.js:32480, 12847, 12872`) utilisent encore le single buggy.

#### H7 — **Node mono-thread : sommation des latences sous Promise.all**

- Les 3 fetchs parallèles (`top-matches` + `accuracy/public` + `bankroll/simulated`) — `pariscore.app.js:32598-32602` — sont parallèles côté réseau mais **leurs handlers serveur s'exécutent sur le même event-loop**. `getAccuracyReport` + `bankroll` (2× 28k itérations CPU) + `jsonResponse` (sérialisation 185 KB) **se sérialisent en pratique**.
- SQLite `busy_timeout 5s` — `server.js:6208` : sous contention cron + HTTP, une requête peut attendre.

---

## Phase 3 — Stratégie de cache (cible < 10s)

### 3.1 Réponses aux 5 questions

**Q1 — Que cache-t-on actuellement ? (avec TTL précis)**
- DB `api_cache` (148 rows, 1.1 MB) : cotes ESPN, openfootball, logos (30j), teams sofa (7j), TV channels (24h), ETL flashscore/sofa. **Rien pour le football vitrine** (top-matches/accuracy/bankroll/matches list).
- Mémoire : `oddsCache` (30 min), `aiScoutCache` (6h), 40+ caches BSD/player indexés.
- **Manquants critiques :** `top-matches`, `accuracy/public`, `bankroll/simulated`, `ai-scout` (warmer), liste `matches` (pas de `Cache-Control`).

**Q2 — Que devrait-on cacher qui ne l'est pas ?**
1. **`/api/v1/accuracy/public`** → résultat de `getAccuracyReport()` (snapshot, change peu : historique vérifié). Cache mémoire **15-30 min**.
2. **`/api/v1/bankroll/simulated`** → résultat backtest (déterministe sur historique). Cache mémoire **15-30 min**.
3. **`/api/v1/top-matches`** → réponse complète (lecture `db.matches`). Cache mémoire **60s** + `Cache-Control: public, max-age=60`.
4. **`/api/v1/matches`** → `Cache-Control: public, max-age=30` (le client a déjà `AppCache` 60s + polling live SSE).
5. **`/api/v1/ai-scout`** → warmer au boot (pré-chauffer `aiScoutCache`) + `Cache-Control: public, max-age=300` (stale-while-revalidate navigateur).

**Q3 — Quelle stratégie de warmer / pré-calcul (cron) pour éviter le cold-start ?**
- **Warmer boot (après `db.matches` chargé) :** appeler `generateAIScout()` en fire-and-forget pour peupler `aiScoutCache` AVANT le premier user — `server.js` boot.
- **Warmer périodique (setInterval 5 min) :** pré-calculer `getAccuracyReport()` + `bankroll/simulated` dans un cache mémoire. Invalider après `saveDB()` (nouveau match vérifié).
- **Pattern à réutiliser :** exactement celui du tennis `_refreshTop10Cache` — `server.js:38557-38578` (boot +60s, puis `setInterval` 5 min). Copier-coller ce squelette pour le foot.

**Q4 — Spécification `top-matches` : cache mémoire TTL 1h, cache DB, ou les deux ?**
- **Recommandation : cache mémoire TTL 60s SEUL (pas DB, pas 1h).**
  - Raison : `db.matches` change en continu (cotes live via cron BSD + SSE), un TTL 1h donnerait des cotes stale inacceptables pour un teaser accueil.
  - 60s = cohérent avec le polling SSE live déjà en place.
  - Pas de DB : le calcul `getTopMatchesByTimeframe` est négligeable (<5 ms mesuré) → la valeur du cache est surtout d'ajouter un **`Cache-Control` navigateur** pour éviter le re-fetch au switch d'onglet.
  - **Fallback DB uniquement** si on veut résilience multi-process (PM2 cluster) : `api_cache` source `top_matches` TTL 60s, mais c'est optionnel tant qu'on est mono-process.

**Q5 — Comment éviter les 20 requêtes logos équipes en série ?**
- **Le batch endpoint existe déjà** (`/api/v1/team-logos?names=` — `server.js:33124-33135`, lookup local `team_logos`, `Cache-Control: max-age=300`). HybridHero l'utilise — `pariscore.app.js:32779`.
- **3 actions :**
  1. **Corriger le bug `db.prepare` → `sqldb.prepare`** (`server.js:33179`) : active le cache DB 30j sur la route single → les autres chemins (`pariscore.app.js:32480, 12847, 12872`) bénéficient immédiatement.
  2. **Migrer les callers single → batch** (`pariscore.app.js:32480` teamLogoUrl, `12847`/`12872`) : collecter les noms puis 1 fetch batch.
  3. **Inlining des URLs logo dans `top-matches`** : ajouter `home_logo`/`away_logo` (via `lookupTeamLogo`) au payload → **zéro requête logo côté client** pour le hero. Le lookup est O(1) mémoire (`_teamLogoMemCache`) + 1 SELECT indexé.

### 3.2 Plan d'action concret (priorisé par impact/effort)

| # | Action | Impact | Effort | Réf à modifier |
|---|---|---|---|---|
| **P0a** | **Corriger bug `db.prepare` → `sqldb.prepare`** (route logo single) | Élimine 20 fetchs Sofascore réseau en série | 1 ligne | `server.js:33179` |
| **P0b** | **Warmer AI Scout au boot** (fire-and-forget `generateAIScout()`) | Élimine 3-8s cold path Gemini | ~5 lignes | après `server.js:14793` + boot |
| **P1** | **Cache mémoire `getAccuracyReport()`** TTL 15 min + invalider sur `saveDB()` | -1 route CPU 28k itérations | ~15 lignes | `server.js:11920, 37519` |
| **P1** | **Cache mémoire `/api/v1/bankroll/simulated`** TTL 15 min | -1 route CPU 28k itérations | ~10 lignes | `server.js:37067` |
| **P2** | **`Cache-Control` sur `top-matches`, `matches`, `ai-scout`** | Évite re-fetch navigateur au switch onglet | 3 lignes | `server.js:35348, 21454, 45347` |
| **P2** | **Inlining logos dans `top-matches`** payload | -1 fetch batch logos côté client | ~5 lignes | `server.js:20633-20637` |
| **P3** | **Retirer `?_t=${Date.now()}`** sur `/api/v1/matches` côté client | Active cache navigateur | 1 ligne | `pariscore.app.js:11554` |
| **P3** | **Migrer callers logo single → batch** | -N requêtes | refacto | `pariscore.app.js:32480` |
| **P4** | **Garder `lazyLoadButeurs` mais behind `requestIdleCallback`** | Ne bloque pas first paint | refacto | `pariscore.app.js:11604` |

**Budget attendu après P0a+P0b+P1+P2 :** cold path Gemini éliminé (warmer), accuracy/bankroll cached, logos corrigés → **< 3-4s** au lieu de 12.4s.

---

## Snippets de code minimal (à intégrer dans `server.js`)

### Snippet A — Cache mémoire générique + warmer (réutiliser pour accuracy/bankroll/top-matches)

```js
// ── Ajouter près de server.js:14793 (à côté de aiScoutCache) ──
// Cache mémoire TTL pour les rapports déterministes liés à history[]
const _reportCache = {};  // { [key]: { data, ts } }

function cachedReport(key, ttlMs, builder) {
  const e = _reportCache[key];
  if (e && (Date.now() - e.ts) < ttlMs) return e.data;
  const data = builder();
  _reportCache[key] = { data, ts: Date.now() };
  return data;
}

// Invalider après saveDB() (nouveau match vérifié modifie history[])
// → ajouter dans saveDB() (trouver sa déf) : for (const k of Object.keys(_reportCache)) delete _reportCache[k];
```

### Snippet B — Wrapper `getAccuracyReport()` + route

```js
// server.js:11920 — wrapper
function getAccuracyReportCached() {
  return cachedReport('accuracy_public', 15 * 60 * 1000, getAccuracyReport);
}

// server.js:37520 — remplacer l'appel
//   const full = getAccuracyReport();
const full = getAccuracyReportCached();
```

### Snippet C — Cache `bankroll/simulated`

```js
// server.js:37067 — extraire le calcul dans une fonction + cache
function computeSimulatedBankroll() {
  return cachedReport('bankroll_sim', 15 * 60 * 1000, () => {
    let bankroll = 100; const bets = [];
    for (const h of history) { /* ... corps actuel 37071-37084 ... */ }
    return { startBankroll:100, finalBankroll:bankroll, /* ... */ bets: bets.slice(-80) };
  });
}
// route :
if (pathname === '/api/v1/bankroll/simulated') {
  return jsonResponse(res, 200, computeSimulatedBankroll());
}
```

### Snippet D — Warmer AI Scout au boot

```js
// Après chargement db.matches (trouver le point de boot post loadDB/saveDB initial)
setTimeout(() => {
  generateAIScout().then(() => console.log('[WarmAI] aiScoutCache pré-chauffé'))
    .catch(e => console.warn('[WarmAI] warmer:', e.message));
}, 5000).unref();
// Optionnel : refresh toutes les 5h30 (avant expiration TTL 6h) pour rester chaud
setInterval(() => { generateAIScout().catch(() => {}); }, 5.5 * 3600000).unref();
```

### Snippet E — `Cache-Control` sur les routes vitrines

```js
// server.js:35348 (top-matches) — remplacer jsonResponse par writeHead explicite :
return res.writeHead(200, {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
  'Cache-Control': 'public, max-age=60, stale-while-revalidate=600',
}).end(JSON.stringify({ matches: getTopMatchesByTimeframe(timeframe, limit), /* ... */ }));

// server.js:21454 (matches) — ajouter 'Cache-Control': 'public, max-age=30' au writeHead existant
//   (trouver le writeHead custom ou migrer cette route hors jsonResponse)

// server.js:45347 (ai-scout) — ajouter Cache-Control sur le .then :
generateAIScout().then(data => {
  res.writeHead(data.error ? 503 : 200, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600',
  });
  res.end(JSON.stringify(data));
});
```

### Snippet F — Correction bug logo (1 caractère)

```js
// server.js:33179 — REMPLACER
//   db.prepare('INSERT OR REPLACE INTO api_cache ...').run(...)
// PAR
sqldb.prepare('INSERT OR REPLACE INTO api_cache (key, data, source, created_at, expires_at) VALUES (?, ?, ?, ?, ?)')
  .run(cacheKey, JSON.stringify(result), 'logo', Date.now(), Date.now() + 30 * 24 * 3600 * 1000);
// (ou simplement : apiCacheSet(cacheKey, result, 'logo', 30*24*3600*1000);  ← helper existe déjà)
```

### Snippet G — Inlining logos dans `top-matches`

```js
// server.js:20633-20637 — enrichir chaque match retourné
.map(m => {
  delete m._score;
  m.home_logo = lookupTeamLogo(m.home_team)?.url || null;
  m.away_logo = lookupTeamLogo(m.away_team)?.url || null;
  return m;
});
// lookupTeamLogo (server.js:3827) = O(1) mémoire + 1 SELECT indexé → négligeable
```

---

## Points de vigilance / risques

- **`jsonResponse` ajoute déjà des headers de sécurité** (CSP, HSTS, `X-Frame-Options: DENY` — `server.js:21268-21271`) : les routes migrées vers `writeHead` custom doivent **reproduire** ces headers (sinon régression sécu). Préférer étendre `jsonResponse` avec un param `cacheControl` optionnel.
- **Invalidateur `_reportCache` dans `saveDB()`** : `saveDB()` est appelée souvent (live patches). Invalider à chaque fois annule le cache → n'invalider que si `history.length` change (ajouter un check `if (newHistoryLen !== lastHistoryLen)`).
- **Cache mémoire = par-process** : si passage futur en cluster PM2, chaque worker a son cache → envisager alors `api_cache` DB. Pour l'instant (mono-process constaté), mémoire suffit.
- **Ne pas casser le polling live** : `top-matches` TTL 60s est compatible avec le SSE live (`/api/v1/live` — `server.js:21280`) qui patche le DOM en diff. Ne pas monter au-delà de 60s.
- **Le `_t=${Date.now()}` sur matches** (`pariscore.app.js:11554`) est un cache-buster intentionnel ( données frais au first paint). À retirer seulement après avoir ajouté `Cache-Control: max-age=30` serveur + confirmé que `AppCache` + SSE couvrent la fraîcheur.

## Fichiers pertinents

- `C:/Users/David/ZCodeProject/pariscore/server.js` — backend monolithe (audit complet ci-dessus)
- `C:/Users/David/ZCodeProject/pariscore/pariscore.app.js` — frontend (cascade fetch onglet Football : `loadMatches:11541`, `HybridHero.loadAll:32597`, `lazyLoadButeurs:13820`, `loadAIScout:12704`)
- `C:/Users/David/ZCodeProject/pariscore/pariscore.db` — SQLite (mesures : 148 rows api_cache 1.1MB, `db_matches` 226KB/43 matchs, `history_matches` 8.3MB/28306 entries)
- `C:/Users/David/ZCodeProject/pariscore/cache_profiles.json` — TTL pilotable (existe, à peupler pour nouveaux profils)
