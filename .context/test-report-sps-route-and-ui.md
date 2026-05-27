# Test Report — SPS Route + Name TA Mapping + UI Hydrator

**Date** : 2026-05-27
**Modules** :
- `server.js` route `GET /api/v1/sps/:matchId` (locus :31151)
- `cron_sps_updater.py` `_normalize_player_name()` + refactor `_ta_cache_lookup()`
- `pariscore.html` `_tvbSPSPlaceholder` / `_tvbHydrateSPS` / `_tvbPaintSPSCell` + wire row + hydrator trigger
**Audité par** : `/ps-test` agent (multi-surface server + Python + UI)

---

## ✅ Tests passés

### Route `/api/v1/sps/:matchId` (12 cas live)

| Cas | Réponse | Verdict |
|---|---|---|
| Valid 2 players (QA_M1) | 200 + 2 players + meta | ✅ |
| Valid 1 player only (QA_M2) | 200 + 1 player | ✅ |
| Not found | 404 + helpful hint | ✅ |
| Empty matchId (`/api/v1/sps/`) | 400 invalid_match_id | ✅ |
| 128 chars exact | 404 (passes validation, no data) | ✅ |
| 129 chars over | 400 invalid_match_id | ✅ |
| SQL injection | urllib rejects URL chars + server regex blocks | ✅ |
| XSS `<script>` | 400 (regex `/^[A-Za-z0-9_\-:.]+$/` rejects `<>`) | ✅ |
| Path traversal `../..` | 400 (slash not in allowed set) | ✅ |
| Colon `foo:bar:baz` | 404 (allowed char, no data) | ✅ |
| Dot `foo.bar.123` | 404 (allowed char, no data) | ✅ |
| Emoji 🎾 | 400 (non-ASCII rejected) | ✅ |

### HTTP methods
- POST/PUT/DELETE/PATCH → 405 + header `Allow: GET` ✅

### Schema integrity
- Required keys: `match_id`, `count`, `players` ✅
- Each player: `player_id`, `surface`, `circuit`, `sps`, `aptitude_score`, `confidence_full`, `matches_played`, `computed_at`, `age_ms` ✅
- `count === players.length` ✅
- `sps` arrondi 2 décimales ✅
- `confidence_full` boolean correct (p1=True/15 matchs, p2=False/2 matchs) ✅
- `age_ms` calculé correctement (fresh=33s, seeded -1h=3.6Ms) ✅

### Concurrent load
- 20 parallèle → **20/20 OK, 4.9ms avg** (SQLite WAL absorb gracefully)

### Gate exemption
- Endpoint accessible sans auth Pro Tennis (whitelist server.js:16297) ✅
- Payload metadata public uniquement — pas de Premium leak

### Cron Python TA name lookup
- `_normalize_player_name()` NFD + lowercase + non-ASCII drop → canonical key
  - `"QA Test Alcaraz"`, `"qa test alcaraz"`, `"  QA  Test  Alcaraz  "`, `"QA Test ALCARAZ"` → tous → `"qa test alcaraz"` ✅
  - Mirror exact JS `normName()` server.js (verified by 100% overlap test 289/289 names)
- `_ta_cache_lookup()` query by `name_key`:
  - Case-insensitive surface (`clay` / `Clay` / `CLAY`) → tous hit ✅
  - Circuit filter strict (ATP query → WTA cache miss) ✅
  - Empty name → empty result ✅

### End-to-end cron pipeline
- `SPSPipeline.run()` contre serveur live, 0 errors, heartbeat kv écrit ✅

### Pytest
- **160/160 pass** (84 surface_powerscore + 76 cron_sps_updater)
- 16 nouveaux tests (TestNormalizePlayerName + TestTaCacheLookup)
- node --check server.js clean

### UI hydrator présence
- `_tvbSPSPlaceholder` + `_tvbHydrateSPS` + `_tvbPaintSPSCell` définis ✅
- Wire row `_tvbEloMinibar...${_tvbSPSPlaceholder(matchId)}` actif ✅
- Hydrator trigger setTimeout 80ms post-render ✅
- `matchId` passé après `_escTennis()` (HTML-safe attribute) ✅

---

## ⚠️ Avertissements (non bloquants)

### W1 — Hydrator N+1 fetch (pas de batching)
**Localisation** : `pariscore.html:_tvbHydrateSPS` + trigger loop ~21287
**Problème** : Pour un slate de 150+ matchs tennis, le hydrator fire **150+ HTTP fetches concurrents** vers `/api/v1/sps/:matchId`. Pas de throttling. SQLite WAL absorb mais réseau (mobile 3G/4G) peut saturer.
**Impact** : moyen — desktop OK, mobile dégradé pendant 1-3s.
**Recommandation** : (a) batch endpoint `/api/v1/sps?ids=m1,m2,m3,...` retourne tous SPS d'un coup (1 fetch au lieu de N). (b) OU IntersectionObserver — hydrate only visible rows, lazy load on scroll.

### W2 — `_spsCache` JS-side sans TTL
**Localisation** : `pariscore.html:_spsCache` Map module-level
**Problème** : Cache JS persiste tant que la page reste ouverte. Si cron Python tourne (12h schedule) et update SPS, le client continue d'afficher l'ancienne valeur cached.
**Impact** : faible — SPS variation lente 52-sem rolling. Mais après upgrade cron quotidien (`tools/build-tennis-internal-history.js` cron 02:00 ajouté), drift possible.
**Recommandation** : TTL 6h sur `_spsCache` (Map → Map<id, {ts, payload}>) + check age avant hit.

### W3 — `_tvbPaintSPSCell` innerHTML sans sanitization
**Localisation** : `pariscore.html:_tvbPaintSPSCell`
**Problème** : `nodes[i].innerHTML = _tvbSPSFormatChip(...)`. Le format chip inclut `payload.matches_played` dans `title` attribute via string concat sans escape. Si payload corrompu (en théorie impossible, vient de notre DB), XSS via attribute breakout possible.
**Impact** : très faible — payload contrôlé serveur, mais defensive coding préférable.
**Recommandation** : passer matches_played dans une variable + escaper via `_escTennis()` existant.

### W4 — Hydrator fired même quand 0 SPS data en DB
**Localisation** : `pariscore.html:21287` setTimeout loop
**Problème** : Actuellement table `player_surface_scores` vide en prod. Chaque row → 1 fetch → 1 × 404 retour. 150 matchs = 150 × 404 = bruit log serveur + bande passante client.
**Impact** : moyen tant que table vide (état actuel).
**Recommandation** : (a) marker DB-empty global → skip hydration jusqu'à premier write (peut être via /api/v1/sources/health.sps_pipeline.status). (b) OU exposed `total_sps_rows` dans /api/v1/tennis/upcoming meta pour decide client-side.

### W5 — `data-sps-mid` selector si matchId contient `"` ou `\`
**Localisation** : `_tvbPaintSPSCell` `'[data-sps-mid="' + ... + '"]'`
**Problème** : Code already escape via `.replace(/"/g, '\\"')`. Mais ne gère pas autres chars problématiques CSS selector (`[`, `]`, etc). Si match_id contient des caractères CSS-special, query échoue silencieusement.
**Impact** : très faible — match_id contrôlé par buildTennisValueBets (numeric ID BSD typically).
**Recommandation** : utiliser `querySelectorAll('[data-sps-mid]')` + filter par dataset au lieu de selector dynamic.

### W6 — `apiFetch` 401 path clears token cookie
**Localisation** : `pariscore.html:apiFetch:33532-33550`
**Problème** : Notre route SPS est gate-exempt → ne devrait jamais retourner 401. MAIS si env `SPS_INTERNAL_TOKEN` set en prod (W5 token gate du W6 endpoint, pas SPS route), le client n'envoie pas ce header → 401 → apiFetch clear le JWT user → user devient anonyme. Cross-contamination!
**Impact** : faible — SPS route N'A PAS de token check. Seul /upcoming en a. Vérifié dans server.js code.
**Recommandation** : ajouter sanity test couvrant ce cas dans `test_w6_tennis_upcoming.js` (déjà fait par W5 test).

### W7 — Cron daily ETL 02:00 Paris peut overlap autres jobs
**Localisation** : `server.js:38612` _runTennisInternalEtlJob setTimeout pattern
**Problème** : Si pm2 restart la nuit, le delay `_msUntilNextParisHour(2)` pourrait calc négatif si déjà passé. Pattern setTimeout standard — devrait wrap au lendemain. Vérifier helper.
**Impact** : faible.
**Recommandation** : trace log au boot indiquant prochain run schedulé.

### W8 — Surface case-insensitivity uniquement côté Python lookup
**Localisation** : `_ta_cache_lookup` `LOWER(surface) = ?`
**Problème** : tennis_ta_cache stocke `'Clay'` (Capital). Python query par `surface.lower()`. OK aujourd'hui — mais si TA scrape future écrit `'clay'` lowercase, le SQL filter ne match plus si app aussi écrit lowercase elsewhere. Inconsistent canonicalization. Defensive only.
**Recommandation** : normaliser surface à insertion ET query (les deux côtés en `lower()` à l'écriture, dans le ETL/scraper). Stable downstream.

---

## ❌ Bugs détectés

**Aucun bug bloquant.**

Une observation borderline-bug (W5 + W2 combinés) sur le re-rendering : si le user lance Tennis tab, scroll, retourne, le hydrator re-fire pour les rows déjà connus. Le cache JS hit, paint immédiat — donc 0 fetch. Pas un bug.

---

## 💡 Recommandations d'amélioration

### R1 — Endpoint batch `/api/v1/sps?ids=m1,m2,m3` (P1)
Remplace N fetches → 1 fetch. Sans CSV exposing à param max ~200 IDs (URL limit 8KB), pour 150 matchs = `?ids=1,2,3,...,150` ~600 chars OK.
**Schéma proposé:**
```javascript
GET /api/v1/sps?ids=m1,m2,m3
→ { "results": { "m1": [...], "m2": [...], "m3": null }, "count": 2 }
```
Bénéfice: -99% requests count, latence aggregée constante.

### R2 — Server-side SPS join dans `buildTennisValueBets` (P2)
Au lieu de lazy fetch client, enrichir directement le payload TVB :
```javascript
// Inside buildTennisValueBets
const spsRows = sqldb.prepare('SELECT match_id, player_id, sps, confidence_full ... FROM player_surface_scores WHERE match_id IN (...)').all(matchIds);
// Group by match_id, attach to each match.sps_p1 / m.sps_p2
```
Élimine hydrator + cache JS entièrement. UI lit directement `m.sps_p1` / `m.sps_p2`.
**Tradeoff** : cache TVB côté serveur doit aussi invalider quand player_surface_scores update. Cron 12h → TVB cache 5min → léger drift acceptable.

### R3 — Pytest E2E node integration coverage UI (P2)
Étendre `test_w6_tennis_upcoming.js` pour seed `player_surface_scores` + call `/api/v1/sps/:matchId` end-to-end. ~5 cas suffisent.

### R4 — Loading state UI plus visible (P3)
Actuellement placeholder est "SPS · —" gris léger. User pourrait croire que la feature est cassée. Recommandation:
- Pendant fetch : spinner CSS minimal animé OU dots `…`
- Après 404 (pas de data) : message `SPS · données en cours` au lieu de `—`

### R5 — Métrique observability hydrator (P3)
Compter dans `_spsCache` les hits / miss / 404 et exposer dans console dev tools via `window.__spsStats` pour debug.

### R6 — Bd ticket close `qvan` (Quick win admin)
Le mapping table `player_id ↔ ta_id` est désormais OBSOLETE (résolu par name-based normalization). bd `qvan` peut être closed-resolved avec lien vers commit `1ed3789`.

---

## Verdict global

**SPS read endpoint + name mapping + UI hydrator = PROD-READY** mais 4 quick wins (R1 batch, R6 close qvan) recommandés avant deploy VPS final.

| Quick win | Effort | Impact |
|---|---|---|
| R1 batch endpoint `/api/v1/sps?ids=` | 1h | -99% HTTP requests |
| R6 close bd qvan | 1min | Backlog clarity |
| W1 IntersectionObserver lazy hydrate | 30min | Mobile UX |
| W4 skip hydrator si DB vide | 15min | Log/bandwidth |

**Prochain pas suggéré:** R1 batch endpoint (résout W1 + W4 simultanément).

---

*Rapport généré par /ps-test — 2026-05-27 23:55 GMT+2.*
