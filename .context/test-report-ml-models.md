# Test Report — Modèles ML (CatBoost blend + Dixon-Coles + mlInferenceService)
**Date** : 2026-05-30
**Scope** : pipeline ML livré session 30/05 — fix `dixonColes`, blend `blended_cb` CatBoost→frontend, service `mlInferenceService.js`, `loadEnv` priorité env.
**Méthode** : node --check, 18 tests unitaires service, audit statique null-safety, vérif sync backend↔frontend, validation runtime E2E (prod 113 prédictions live).

---

## ✅ Tests passés

### Syntaxe
- `node --check server.js` → OK
- `node --check pariscore.js` → OK
- `node --check services/mlInferenceService.js` → OK

### mlInferenceService.js — 18/18 tests unitaires
- `runInference` moteur inconnu / désactivé / matches vides / matches null → `{}` (jamais throw)
- `predictWithFallback` : ML vide → fallback Poisson déclenché (`source='fallback'`)
- `predictWithFallback` : fallbackFn qui throw → retour gracieux `{}` (jamais throw)
- `predictWithFallback` : pas de fallbackFn → gracieux
- `mapProbasToMarket` : null/undefined → null ; foot sans over25/btts → champs null ; tennis p1 seul → dérive p2
- `probaToDecimalOdds` : p=0/1/NaN/négatif/>1 → toujours fini (clamp, jamais Infinity)
- `parseStdout` : tolère warnings avant JSON ; stdout vide → throw (capturé en amont)

### Pipeline backend (server.js)
- **`dixonColes`** : guard `_lamBad` filtre les λ aberrants (NaN, >8, double-0) AVANT `computeDixonColes` → la fonction ne reçoit jamais d'entrée pathologique. Robuste par construction.
- **`_refreshCatBoostCache`** : try/catch global + guard `CATBOOST_ENABLED` + `preds vide` → jamais bloquant.
- **`blended_cb`** : toujours 5 champs numériques (`Math.round` → number), produit uniquement quand `catboost[m.id]` présent.
- **`loadEnv`** : `if (process.env[key] === undefined)` — shell/pm2 gagne sur `.env` stale (sémantique dotenv standard).

### Sync backend ↔ frontend
- `blended_cb` : backend écrit `{homeWin,draw,awayWin,over25,btts}` ↔ frontend lit exactement ces 5 clés (mkts + advice). **Aucune clé orpheline.**
- `dixonColes` : backend écrit objet DC complet ↔ frontend lit `m.dixonColes?.method/.over25/.btts/.cs00/.rho` avec **optional chaining** (pariscore.js:10305). Safe.
- Le fix `dixonColes` **restaure aussi** l'affichage de la ligne « DC: O25 …% · BTTS …% » dans les cartes match (morte avant car `dixonColes` n'était jamais assigné).

### États dégradés (null safety)
- `blended_cb` absent (CatBoost off/échoue) → bloc ML masqué (`${m.blended_cb ? … : ''}`) MAIS le **bloc verdict Poisson** (pariscore.js:11890, IIFE indépendante) reste rendu → **UI jamais vide**.
- `poisson` absent/aberrant → `_poiOK` + `_dataNotice` → message « Données en cours de consolidation ».
- `m.odds`/`m.bookmakers` absents dans le bloc blended_cb → `odds = m.odds || {}`, `bk = m.bookmakers || {}` → guardés.

### Runtime E2E (validé en session)
- Local (CATBOOST_ENABLED=true) : `/api/v1/matches` + `/api/v1/insights` → 114/114 `blended_cb` + `catboost`, 111/114 `dixonColes` (3 null = BAD_LAMBDA, géré).
- Frontend modal : `cbBars:5` + verdict « LE CHOIX SÛR » rendus (DOM confirmé).
- **Prod** (`server` id 6 rechargé) : `113 matchs injectés` + `[CatBoost] ✓ Cache 113 prédictions`, zéro erreur fatale.

---

## ❌ Bugs détectés

### BUG-1 — ReferenceError `match is not defined` (CORRIGÉ ✅)
**Sévérité** : 🔴 Critique (cassait tout le pipeline ML + Poisson en prod)
**Localisation** : `server.js:8003` (`buildMatchRecord`)
**Code problématique** :
```js
match.dixonColes = computeDixonColes(expHome, expAway);  // `match` n'existe pas
```
**Impact** : throw au 1er match de chaque `fetchOdds` → catch silencieux → fallback cache stale → jamais de rebuild → CatBoost/Poisson/blended jamais recalculés → ML invisible frontend. Présent dans `origin/main` = prod.
**Fix appliqué** (commit `6ae9f53`) :
```js
let dixonColes = null;
// ...
dixonColes = computeDixonColes(expHome, expAway);
// ... dans record : { …, poisson, dixonColes, blended, … }
```
**Validation** : prod 113/113 matchs injectés + CatBoost cache OK, zéro `match is not defined`.

---

## ⚠️ Avertissements

### W1 — `mkts.reduce` sans valeur initiale (DURCI ✅)
**Localisation** : `pariscore.js:11973` (`buildResumeTab`, bloc blended_cb)
**Problème** : `mkts.reduce((b,mk)=>…)` sans init → `TypeError: Reduce of empty array` si `mkts` vide. Inatteignable en pratique (blended_cb = 5 champs numériques garantis), mais seul reduce non-gardé du fichier.
**Fix appliqué** : sentinelle `mkts[0] || {lbl:'—',val:0,…}` en valeur initiale — comportement **identique** quand non-vide, pas de throw si vide.

### W2 — Blend `po?.homeWin || 33` écrase un 0% légitime
**Localisation** : `server.js:4476-4480`
**Problème** : si `poisson.homeWin === 0` (cas BAD_LAMBDA), `0 || 33` → 33 au lieu de 0. Le blend utilise une valeur Poisson artificielle (33/45/50%).
**Impact** : cosmétique, uniquement quand Poisson est déjà invalide (λ aberrant). Le composant CatBoost (60%) reste correct.
**Reco** : remplacer par `(po && po.homeWin != null ? po.homeWin : 33)` si on veut préserver un vrai 0%. P2.

### W3 — `services/mlInferenceService.js` non wiré
**Localisation** : module standalone, non `require()` dans server.js.
**Problème** : le service multi-moteur (catboost/xgboost/lightgbm) + `predictWithFallback` n'est **pas branché** dans `buildMatchRecord`/cron. C'est intentionnel (roadmap doc phases 2-6 : XGBoost/LightGBM pas encore entraînés), mais à tracer pour éviter la confusion « dead code ».
**Reco** : bd ticket pour wiring Phase 6 (`predictWithFallback` dans le refresh cron) une fois les modèles XGB/LGBM entraînés. Le CatBoost actuel reste sur son chemin inline éprouvé (`_runCatBoostBatchInference`).

---

## 💡 Recommandations d'amélioration

1. **Calibration / backtest avant activation XGB/LGBM** (rigueur Quant CLAUDE.md) : aucun `*_ENABLED=true` sans Brier + reliability diagram sur ≥500 matchs, borne inf. IC du gain > 0 vs Poisson.
2. **Wiring `mlInferenceService` (W3)** : extraire `_runCatBoostBatchInference` vers le service pour unifier le fallback (never-empty au niveau data-layer). Faire seulement quand un 2e moteur existe (sinon refactor sans gain).
3. **Monitoring prod** : ajouter un compteur `blended_cb` coverage (% matchs avec ML) exposé dans `/api/v1/status` pour détecter une régression silencieuse du pipeline (le bug BUG-1 serait passé inaperçu sans ça).
4. **Dual-process PM2** : la confusion `server` (id 6) vs `pariscore` (id 7 crash-loop) a masqué 3 déploiements. `pariscore` supprimé + `pm2 save` fait. Garder un seul process nommé.

---

## Statut final
- **0 bug ❌ ouvert** (BUG-1 corrigé + déployé prod).
- **3 ⚠️** : W1 durci, W2/W3 → roadmap P2.
- Pipeline ML **fonctionnel et vérifié** local + prod.
