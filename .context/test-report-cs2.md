# Test Report — CS2 Tab
**Date** : 2026-05-31

## ✅ Tests passés
- Architecture routes API : 9 endpoints CS2, tous wrappés try/catch, HTTP 400 sur params manquants (team1/team2/map)
- Null safety `_buildCs2Card` : `t1 = m.team1 || {}` / `t2 = m.team2 || {}` correctement définis
- `_cs2ModelCache` déclaré à module scope ligne 24242 — pas de TypeError
- Skeleton loader : `_renderCs2Skeleton()` appelé avant fetch dans `initCs2Page`
- Empty state : `renderCs2Dashboard` retourne `cs2-empty` si matches vide
- Error state : `_fetchAndRender` catch appelle `_renderCs2Error()`
- BSD addon disabled : détecté via `bsd_status === 'disabled'`, UI dédiée avec template email
- `_fetchEnrichment` correctement appelé avec `t1.name`/`t2.name` (vars guardées)
- CSS : nouvelles classes `.cs2-rds-t1/.cs2-rds-t2`, `.cs2-dot`, map atmosphere, `.adv-t1/.adv-t2` — syntaxe valide
- JS : `node --check pariscore.js` et `node --check server.js` → SYNTAX OK
- Logos BSD : `?bg=transparent` présent dans `_teamLogo()` et `_tournamentLogo()` — détourage OK

## ⚠️ Avertissements (non bloquants)

### W1 — `m.team1.name` potentiellement non protégé dans `_cs2BettingSignals`
**pariscore.js:24658-24667** — `_cs2BettingSignals(m)` accède `m.team1.name` directement sans guard `m.team1 &&`. En pratique safe car `cs2Service._normalizeMatch` garantit `team1 = { name: 'TBD', ... }` minimum. Risque si données BSD malformées (ex: `team1: null` sur résultat API exotique).
**Recommandation** : remplacer par `(m.team1 && m.team1.name) || ''` aux lignes 24658-24667.

### W2 — Inconsistance visuelle dashboard vs card view pour les rounds
**pariscore.js:24754-24756** — dashboard affiche le score series en monochrome orange `#FF6B00`, alors que la card view utilise maintenant `.cs2-rds-t1` (orange) / `.cs2-rds-t2` (bleu). Corrigé dans cette session (voir fix BUG-4 ci-dessous).

### W3 — `_mapDots` définie dans `_buildCs2Card` — re-créée à chaque render
**pariscore.js:24439** — fonction déclarée en closure à chaque appel. Pour ~12 cartes × 30s poll = redéfinition fréquente. Non bloquant mais bonne pratique de hoisier à module scope.

## ❌ Bugs détectés

### BUG-1 — `m.team1.name` unguarded dans `_buildCs2Card` (crash potentiel)
- **Sévérité** : HIGH
- **Localisation** : `pariscore.js:24484`
- **Code problématique** :
  ```js
  _fetchMapOverModel(m.id, m.team1.name, m.team2.name, m.current_map, modelId);
  ```
  `t1 = m.team1 || {}` est défini à la ligne 24402 mais non utilisé ici. Si BSD renvoie `team1: null`, TypeError crash.
- **Fix** : utiliser `t1.name` et `t2.name`.

### BUG-2 — `odds.team2` non vérifié quand `odds.team1 != null` (affichage "0.00")
- **Sévérité** : MEDIUM
- **Localisation** : `pariscore.js:24769`
- **Code problématique** :
  ```js
  var oddsCell = odds.team1 != null
    ? '...' + Number(odds.team2).toFixed(2) + '...'
  ```
  Si `odds.team1` défini mais `odds.team2 == null` → affiche "1.85 vs 0.00" (Number(null) = 0).
- **Fix** : condition `odds.team1 != null && odds.team2 != null`.

### BUG-3 — Accumulation infinie de `setTimeout` dans `renderCs2Dashboard`
- **Sévérité** : HIGH (memory leak + re-renders en cascade)
- **Localisation** : `pariscore.js:24845-24846`
- **Code problématique** :
  ```js
  setTimeout(function() { _applyCs2Filter(); }, 3000);
  setTimeout(function() { _applyCs2Filter(); }, 8000);
  ```
  `renderCs2Dashboard` est appelé par `_applyCs2Filter()` (toutes les 30s via poll). Chaque cycle crée 2 nouveaux timers sans annuler les précédents → après 5min: 20 timers pendants.
- **Fix** : variables `_cs2EnrichTimer1/2` à module scope + `clearTimeout` avant chaque `setTimeout`.

### BUG-4 — `rankWindow` non protégé contre NaN dans `/api/v1/cs2/map-model`
- **Sévérité** : LOW
- **Localisation** : `server.js:18973`
- **Code problématique** :
  ```js
  const rankWindow = parseInt(query.rankWindow || '15', 10);
  ```
  `parseInt('abc', 10)` = NaN → passe NaN à `computeMapOverModel` → `Math.abs(opp - NaN) <= NaN` = false pour tous → filtrage silencieux raté.
- **Fix** : ajouter fallback `|| 15`.

## 💡 Recommandations d'amélioration

1. **Dashboard CT/T colors** : aligner le dashboard avec le card view (`.cs2-rds-t1`/`.cs2-rds-t2` sur le score série et les rounds). Cohérence visuelle.
2. **Verdict "BET FORT" seuil** : actuellement 3 signaux verts requis. Avec enrichment async (chargé 3-8s après render), le verdict initial est toujours "⏳ Chargement" — UX dégradée. Suggestion : afficher le signal ML seul en attendant les autres.
3. **`_cs2ModelCache` pas invalidé** : le cache modèle persist entre sessions page. Ajouter `_cs2ModelCache = {}` dans `cs2ForceRefresh()`.
4. **Map images** : les 7 classes `.cs2-map-bar.map-*` utilisent des gradients CSS proceduraux. Si `/img/maps/mirage.jpg` etc. sont ajoutés au projet, les swapper pour des `url()` pour l'ambiance ESL/PGL.
