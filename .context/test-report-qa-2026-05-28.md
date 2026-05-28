# Test Report — QA Full Audit
**Date** : 2026-05-28
**Scope** : server.js + pariscore.html + ETL tools
**Trigger** : Post-session audit (EDA toolkit + dl49 Phase 3.1 + j2ev backfill)

---

## ✅ Tests passés

- `node --check server.js` → EXIT 0 (syntaxe OK)
- `node tools/build-tennis-internal-history.js --dry-run` → EXIT 0, 151 rows bsd_calib
- EDA routes : JWT middleware appliqué sur toutes les 5 routes `/eda/*`
- EDA child process : `cp.spawn()` args array (pas shell injection possible)
- ETL SQL : sanitizer table name `replace(/[^a-z0-9_]/gi, '')` présent
- BSD value_bets : short-circuit evaluation null-safe sur `hit.result && hit.result.body`
- JWT expiry check `payload.exp < Math.floor(Date.now() / 1000)` → correct, pas d'off-by-one
- `_scheduleTennisInternalEtl` IIFE : bien auto-invoquée au boot, cron 02:00 Paris ✓
- `_scheduleSPSUpdater` IIFE : bien auto-invoquée, cron 02:05 Paris ✓
- GOLDEN_PPG_GAP `getProb` : guard `!m.stats?.home || !m.stats?.away` avant accès `.ppg` ✓
- LE_VERROU `getProb` : `isReal` guard avant `m.stats.home.avgConceded` ✓ (safe)
- `getTopStrategiesByCategory` : `.filter(m => m.poisson)` avant Map ✓ (post-fix)
- `getTrends` xgHome/xgAway : filtre `?.home != null` ajouté ✓ (post-fix)

---

## ⚠️ Avertissements (non bloquants)

### W1 — EDA pas de frontend UI
**Localisation** : pariscore.html (aucune mention `/eda/`)
**Problème** : 5 routes admin `/eda/*` backend-only, aucun panneau UI. Requiert JWT header manuel (curl/Postman).
**Recommandation** : Ajouter mini-panneau admin caché (⚙️ gear icon si rôle admin) ou documenter dans admin.html.

### W2 — Table name sanitizer : chiffre initial
**Localisation** : server.js `_edaTable()` (route `/eda/profile`)
**Problème** : `replace(/[^a-z0-9_]/gi, '')` autorise `123table` → SQLite reject sans guillemets. Pas d'injection (args array), mais fail silencieux.
**Recommandation** : `.replace(/^\d/, '_$&')` après sanitizer pour préfixer underscore si chiffre initial.

### W3 — stdout match regex fragile
**Localisation** : server.js:38858 `_runTennisInternalEtlJob`
**Problème** : `(stdoutTail.match(/total\s*:\s*(\d+)/) || [])[1]` — lisible mais pattern implicite.
**Recommandation** : `const _m = stdoutTail.match(...); const summary = _m ? _m[1] : '?';` pour clarté.

---

## ❌ Bugs détectés (tous fixés)

### BUG-1 — NaN confidence score (MEDIUM) ✅ FIXED
**Sévérité** : MEDIUM
**Localisation** : server.js:17388 `getTopStrategiesByCategory`
**Code problématique** :
```javascript
Math.max(m.poisson.homeWin, m.poisson.draw, m.poisson.awayWin)
// → NaN si homeWin/draw/awayWin est null ou undefined
// → corrupts .sort() order (NaN comparisons = undefined behavior)
```
**Fix appliqué** :
```javascript
Math.max(m.poisson.homeWin || 0, m.poisson.draw || 0, m.poisson.awayWin || 0)
```

### BUG-2 — xgHome/xgAway inclut undefined (LOW) ✅ FIXED
**Sévérité** : LOW
**Localisation** : server.js:17410-17411 `getTrends`
**Code problématique** :
```javascript
matches.filter(m => m.expectedGoals).map(m => m.expectedGoals.home)
// → m.expectedGoals existe mais .home absent → undefined dans array → avg() NaN
```
**Fix appliqué** :
```javascript
matches.filter(m => m.expectedGoals?.home != null).map(m => m.expectedGoals.home)
```

### BUG-3 — Crons non unref'd (LOW) ✅ FIXED
**Sévérité** : LOW (impacte graceful shutdown SIGTERM)
**Localisation** : server.js:38876-38879 (`_scheduleTennisInternalEtl`) + 38897 (`_scheduleSPSUpdater`)
**Problème** : `setTimeout/setInterval` sans `.unref()` → process ne peut pas terminer proprement si PM2 envoie SIGTERM entre ticks cron
**Fix appliqué** : `.unref()` chainé sur setTimeout + setInterval dans les 2 IIFEs

---

## 💡 Recommandations d'amélioration

1. **Admin panel EDA** (W1) : Mini-panneau HTML dans admin.html avec boutons "Profile table", "D-Tale" pour les routes `/eda/*`. Auth via localStorage JWT existant. Effort ~2h.

2. **`_edaTable` sanitizer robustesse** (W2) : Ajouter `.replace(/^\d/, '_$&')` pour noms de table commençant par chiffre. 1 ligne, zéro risque.

3. **ETL Phase 3.2** : Quand `bsd_tennis_value_bets_%` est chaud (< 5min TTL), le dry-run montre 0 entries. Envisager TTL étendu à 1h pour `bsd_tennis_value_bets_%` côté value_bets cron warmer (améliore coverage ETL 02:00).

4. **Tennis Elo backfill** (`--backfill-days=365`) : Après DG go, lancer sur VPS. Attendre 30j accumulation cron pour évaluer coverage SPS.

5. **EDA VPS deploy** : Exécuter `tools/install-eda-vps.sh`, ajouter `EDA_PYTHON_BIN` au `.env`, `ufw deny 40000` (D-Tale port), restart PM2.
