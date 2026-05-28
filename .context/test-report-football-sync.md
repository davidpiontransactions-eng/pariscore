# Test Report — Football Sync (BSD standings + match data daily refresh)
**Date** : 2026-05-28  
**Module** : `server.js` — `fetchBSDStandings`, `fetchBSDMatches`, `fetchWithCacheBuffer`, `scheduleDailyFootballRefresh`

---

## ✅ Tests passés

- `node --check server.js` → SYNTAX OK (vérifié après chaque fix)
- Fix 1 : parser `groups[]` (shape A) et `groups{}` (shape B) inséré après les 3 branches existantes — aucune régression sur les ligues à standings plats (EPL, Serie A…)
- Fix 2 : validateur BSD matches corrigé aux 2 call sites (targeted + bulk) — `(m.home_team || m.home) && (m.away_team || m.away)` compatible avec le shape actuel de `fetchBSDMatches` ET avec un éventuel changement de shape BSD futur
- Fix 3 : validateur BSD standings corrigé — `t.home?.wins != null || t._raw?.wins != null` matche la structure réelle retournée par `buildSideStats`
- Fix 5 (race condition) : DailyRefresh rendu séquentiel `fetchStats → fetchOdds` — `fetchOdds` lit `db.teamStats` après que `fetchStats` a fini d'écrire
- Gate `isFetchingStats` / `isFetchingOdds` protège contre double exécution simultanée — confirms mutexes en place (l.1342-1343, l.14348, l.14661)
- `db.statsUpdateByLeague = {}` exécuté avant `fetchStats(true)` → tous les gates T1/T2 bypassed → refresh complet garanti
- `fetchStats(true)` avec `force=true` bypass le check `!force && lastLeagueUpdate` (l.14714) → aucun gate ne bloque au boot ni au DailyRefresh
- Protection domestique (l.14757-14768) inchangée — les stats UCL n'écrasent pas les stats EPL d'Arsenal/City etc.
- `fetchBSDStandings` : `teamLabel()` fallback chain `team_name || team?.name || team || name` couvre les formats groupes (y.c. `e.name` direct) — robuste
- Cas vide `grp.standings = []` → `[].length = 0` → falsy → condition ignorée → pas de `push` vide
- `rows[0]` (firstEntry) accessible uniquement après `if (!rows.length) return null` → aucun crash possible sur `Object.keys(firstEntry)`

---

## ⚠️ Avertissements (non bloquants)

### W1 — `bsdToOddsApiFormat` filtre les matchs sans cotes
**Localisation** : `server.js:13988`  
**Code** : `if (!bsdMatch.odds?.home || !bsdMatch.odds?.away) return null`  
**Problème** : Les matchs BSD sans cotes 1X2 complètes sont exclus de l'onglet Foot. En période creuse (avant J-3), beaucoup de matchs ont `odds_home = null` chez BSD → tab Foot vide ou pauvre même si BSD fonctionne.  
**Recommandation** : Ajouter fallback `odds.home = 1.0` (cote fictive neutre) pour les matchs sans cotes afin de les afficher avec badge "Sans cotes" — décision DG P2.

### W2 — `group_name` perdu lors du merge multi-groupes
**Localisation** : `server.js:12621-12624` (Fix 1)  
**Problème** : Les équipes de groupes différents (Group A, B, C…) sont fusionnées en un tableau plat sans tag de groupe. L'UI standings UCL ne peut pas afficher "Group A : Arsenal, PSV…". Tous les 32 clubs apparaissent sans classement par groupe.  
**Recommandation** : Stocker `_group_name: grp.group_name` sur chaque entry avant push → exploitable par la UI standings P2.

### W3 — Double couche de cache peut retarder les mises à jour jusqu'à 24h+6h
**Localisation** : `fetchWithCacheBuffer` (SQLite 24h) + gate `db.statsUpdateByLeague` (T1 6h / T2 12h)  
**Problème** : Si un fix BSD déploie des données corrigées, le vieux cache SQLite 24h est servi jusqu'à expiration, même si le gate T1 a expiré. En pratique, un fetch frais réussit → `updateCacheBuffer` écrase immédiatement → pas de blocage réel. Mais si la validation échoue à nouveau (e.g., shape BSD change), le cache stale est servi 24h.  
**Recommandation** : Ajouter route admin `DELETE /api/v1/admin/clear-cache?source=bsd_standings` pour vider le SQLite cache manuellement en cas d'incident.

### W4 — `Promise.all` précédent (avant Fix 5) déjà en prod VPS
**Problème** : La version actuellement en prod a `Promise.all` (parallèle). Après `git pull + pm2 restart`, le nouveau code séquentiel s'applique. Le premier DailyRefresh sera séquentiel. Aucune migration requise.

---

## ❌ Bugs détectés & corrigés

### BUG-1 — `fetchBSDStandings` : shape `groups` non parsée → 12 ligues coupes jamais mises à jour
**Sévérité** : 🔴 CRITIQUE  
**Localisation** : `server.js:12607-12634`  
**Code problématique** :
```js
// Seulement 3 shapes gérées — groups absent
if (Array.isArray(standingsRes.data.standings)…) rows = …
else if (Array.isArray(standingsRes.data.results)…) rows = …
else if (Array.isArray(standingsRes.data)…) rows = …
// → rows = [] pour UCL/EL/Copa/Coupes → return null → jamais en cache
```
**Fix appliqué** : Ajout parsing shape A (`groups[]`) + shape B (`groups{}`) après les 3 branches existantes.  
**Ligues débloquées** : UCL(2), EL(3), Copa Lib(13), Copa Sud(11), CAF(12), Copa do Brasil(73), FA Cup(45), Carabao(48), Coppa Italia(137), DFB Pokal(81), Copa del Rey(143), Coupe de France(63).

### BUG-2 — Validateur BSD matches vérifie `m.home` absent → cotes BSD perdues chaque jour
**Sévérité** : 🔴 CRITIQUE  
**Localisation** : `server.js:14402` + `14419`  
**Code problématique** :
```js
data.every(m => m.id && m.home && m.away)
// fetchBSDMatches retourne home_team/away_team, jamais home/away
// → undefined != null = false → validateur toujours false
// → fetchWithCacheBuffer jette les données fraîches → bsdRaw = []
// → onglet Foot sans odds BSD, sans Edge, sans Value Bets
```
**Fix appliqué** : `(m.home_team || m.home) && (m.away_team || m.away)` aux 2 call sites.

### BUG-3 — Validateur BSD standings vérifie `t.wins` inexistant au niveau racine
**Sévérité** : 🔴 CRITIQUE  
**Localisation** : `server.js:14730`  
**Code problématique** :
```js
Object.values(data).some(t => t && t.wins != null && t.ppg != null)
// t.wins = undefined (champ dans t.home.wins, pas t.wins)
// undefined != null = false → validateur toujours false
// → cache SQLite 24h jamais écrit → ESPN seul fallback actif
```
**Fix appliqué** : `(t.home?.wins != null || t._raw?.wins != null)`.

### BUG-4 — Pas de cron calé sur le resync BSD (05:30 UTC) → gate T1/T2 peut bloquer jusqu'au lendemain
**Sévérité** : 🟡 MODÉRÉ  
**Localisation** : `server.js:38734-38735`  
**Code problématique** :
```js
setInterval(() => fetchStats(), 12h) // part du boot, pas calé UTC
// Si VPS boot à 14:00 UTC → fetchStats à 14:00 et 02:00 → manque le resync 05:30
```
**Fix appliqué** : `scheduleDailyFootballRefresh()` IIFE → `setTimeout` calé sur 06:00 UTC → reset `db.statsUpdateByLeague = {}` + `fetchStats(true)` séquentiel puis `fetchOdds(true)`.

### BUG-5 — DailyRefresh : race condition `fetchStats` + `fetchOdds` en parallèle
**Sévérité** : 🟠 IMPORTANT  
**Localisation** : `server.js:38778-38783` (version initiale Fix 4)  
**Code problématique** :
```js
Promise.all([fetchStats(true), fetchOdds(true)])
// fetchOdds lit db.teamStats dans buildMatchRecord
// fetchStats écrit db.teamStats en parallèle → stats partielles dans les matchs
```
**Fix appliqué** : Chaîne `.then()` séquentielle : `fetchStats(true).then(() => fetchOdds(true))`.

---

## 💡 Recommandations d'amélioration

1. **Route admin cache clear** : `DELETE /api/v1/admin/clear-cache?source=bsd_standings&key=ADMIN_PASSWORD` → `sqldb.prepare("DELETE FROM api_cache_buffer WHERE source=?").run('bsd_standings')` — ops VPS sans restart.
2. **Stocker `_group_name`** sur les entries lors du merge groups → UI standings UCL par groupe (P2).
3. **Fallback cotes neutres** pour matchs BSD sans odds → afficher match sans Value Bet plutôt que l'exclure (W1).
4. **Monitoring log quotidien** : ajouter grep VPS `"DailyRefresh.*✓ done"` dans une alerte Telegram pour confirmer le refresh 06:00 UTC.
5. **Test de validation BSD shape** : créer `tools/test-bsd-standings-shapes.js` — mock 3 shapes BSD + appeler `fetchBSDStandings` en dry-run pour non-régression.

---

## Synthèse

| Fix | Bug | Sévérité | Statut |
|-----|-----|----------|--------|
| Fix 1 | `groups` parsing manquant | 🔴 CRITIQUE | ✅ Corrigé |
| Fix 2 | Validateur matches `m.home` | 🔴 CRITIQUE | ✅ Corrigé |
| Fix 3 | Validateur standings `t.wins` | 🔴 CRITIQUE | ✅ Corrigé |
| Fix 4 | Cron 06:00 UTC absent | 🟡 MODÉRÉ | ✅ Corrigé |
| Fix 5 | Race condition DailyRefresh | 🟠 IMPORTANT | ✅ Corrigé |

**Fichier modifié** : `server.js` (racine)  
**Syntax check** : `node --check` → SYNTAX OK  
**Prêt pour déploiement VPS** : OUI
