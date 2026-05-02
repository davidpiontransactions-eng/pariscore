# Test Report — Module Top Stratégies
**Date** : 30 avril 2026
**Testeur** : Audit QA statique (analyse de code)
**Fichiers analysés** : `server.js` (STRATEGIES, getTopMatchesByStrategy, route), `pariscore.html` (STRATEGIES_UI, loadStrategy, confClass, openInsightsById)

---

## ✅ Tests passés

- **Synchronisation server ↔ frontend** : 11 stratégies exactement des deux côtés (BTTS_YES, OVER_2_5, OVER_1_5, UNDER_2_5, HOME_WIN, AWAY_WIN, DRAW, CS_00, ANGLE_CORNERS, VERROU_TACTIQUE, GOLDEN_PPG_GAP) ✅
- **Null safety globale** : Optional chaining `?.` correctement utilisé sur `m.poisson`, `m.odds`, `m.expectedGoals`, `m.stats` sur toutes les stratégies standard ✅
- **Route validation case-insensitive** : `(query.type || '').toUpperCase()` → `?type=btts_yes` et `?type=BTTS_YES` retournent le même résultat ✅
- **Bornage des paramètres** : `limit` borné 1-50, `minConfidence` borné 0-100 ✅
- **État empty** : message correct si 0 matchs passent le filtre ✅
- **État erreur HTTP** : message d'erreur avec le code HTTP si la route échoue ✅
- **Skeleton** : affiché pendant le fetch via `renderStrategySkeletons()` avant le `try` ✅
- **db.matches vide** : retourne `[]` proprement sans crash ✅
- **Heartbeat SSE** : nettoyage `clearInterval(hb)` + `sseClients.delete(res)` sur close ET sur erreur d'écriture ✅

---

## ⚠️ Avertissements (non bloquants)

### W1 — `confClass()` : seuils fixes inadaptés aux marchés de faible probabilité
**Localisation** : `pariscore.html` ligne ~3330
**Problème** : `pct > 75 → high (vert)` / `pct ≥ 60 → mid (orange)` / `sinon → low (rouge)`.
Pour CS_00 (prob naturelle 5-15%) et DRAW (15-30%), **100% des cartes seront affichées en rouge** même si la proba Poisson est correcte et élevée pour ce marché.
**Impact** : UX trompeuse — l'utilisateur pense que les données sont mauvaises alors qu'elles sont normales.
**Recommandation** : Seuils relatifs par stratégie (`confThresholds[key] = { high: X, mid: Y }`) ou indiquer la moyenne du marché en contexte.

### W2 — `openInsightsById()` : modal vide si fetch échoue
**Localisation** : `pariscore.html` — `openInsightsById(matchId)`
**Problème** : Si `allMatches` est vide ET que le fetch `/api/v1/matches` échoue, la fonction appelle `openInsights(matchId)` avec un matchId absent de `allMatches` → le modal ouvre probablement vide ou plante silencieusement.
**Recommandation** :
```javascript
async function openInsightsById(matchId) {
  if (typeof openInsights !== 'function') return;
  if (!allMatches || !allMatches.find(x => x.id === matchId)) {
    if (!matchesLoaded) { matchesLoaded = true; await loadMatches(); }
  }
  const match = allMatches?.find(x => x.id === matchId);
  if (!match) { /* afficher un message d'erreur */ return; }
  openInsights(matchId);
}
```

### W3 — Pas de filtre `?league=` dans `/api/v1/top-strategy`
**Localisation** : `server.js` route `/api/v1/top-strategy`
**Problème** : Il est impossible de filtrer les matchs d'une stratégie par ligue. Tous les concurrents (Forebet, WinDrawWin, ScoutingStats, PredictZ) offrent ce filtre.
**Impact** : Expérience utilisateur dégradée pour les parieurs focalisés sur une ligue spécifique.
**Recommandation** : Ajouter `?league=soccer_france_ligue1` filtré sur `m.sport`.

### W4 — `minConfidence` hardcodé à 50% dans l'UI
**Localisation** : `pariscore.html` — `loadStrategy(key)`
**Problème** : `fetch('/api/v1/top-strategy?type=...&limit=12')` — pas de `minConfidence` → défaut serveur 50%. L'utilisateur ne peut pas ajuster ce seuil.
**Impact** : Pour VERROU_TACTIQUE (seuil interne déjà > 80%), le paramètre est inutile mais pour HOME_WIN, abaisser à 40% permettrait d'afficher plus de matchs intéressants.
**Recommandation** : Slider de confiance min (0-90%, pas 5%) dans la barre de filtres de la page Stratégies.

### W5 — Smart Polling SSE : broadcast du payload complet
**Localisation** : `server.js` — `pollLiveScores()` → `broadcastSSE()`
**Problème** : À chaque tick 60s (19h-23h), si un score change, on broadcast `db.matches` en entier (potentiellement 150+ matchs sérialisés) à tous les clients SSE.
**Impact** : Sur 20 clients simultanés avec 150 matchs = ~3 Mo/min de données SSE. Acceptable maintenant, problématique en prod avec trafic.
**Recommandation** : Ne broadcaster que les matchs live modifiés (`type: 'live_update'` avec uniquement les deltas).

---

## ❌ Bug détecté

### BUG-1 — `VERROU_TACTIQUE` : bonus défensif appliqué sur données SIM
**Sévérité** : Moyenne
**Localisation** : `server.js` — STRATEGIES.VERROU_TACTIQUE.getProb()
**Code problématique** :
```javascript
const bothDefensive = m.stats?.home?.avgConceded < 1.2 && m.stats?.away?.avgConceded < 1.2;
return bothDefensive ? Math.min(under35 + 5, 99) : under35;
```
**Problème** : `m.stats` peut être issu de la fonction `simStats()` (données simulées avec hash déterministe — badge SIM gris). Dans ce cas, `avgConceded` est artificiel et peut déclencher le bonus sur des matchs sans vraies données défensives, faussant la confiance affichée.
**Fix** :
```javascript
const isReal = m.stats?.home?._real === true && m.stats?.away?._real === true;
const bothDefensive = isReal && m.stats.home.avgConceded < 1.2 && m.stats.away.avgConceded < 1.2;
```

---

## 💡 Recommandations d'amélioration

1. **Seuils `confClass()` adaptatifs par stratégie** — CS_00 et DRAW doivent avoir des seuils plus bas (ex: >40% = high pour CS_00)
2. **Filtre ligue dans Top Stratégies** — `?league=` côté API + dropdown dans l'UI (P1)
3. **Slider minConfidence dans l'UI** — remplacer le hardcode 50% par un slider visible (P1)
4. **Guard dans `openInsightsById`** — message d'erreur si match non trouvé après fetch (P1)
5. **SSE delta-only pour live scores** — envoyer uniquement les matchs dont `live_score` a changé (P2)
6. **Double Chance market** — `DC_HOME` (1X) et `DC_AWAY` (X2) — calcul = homeWin + draw / awayWin + draw (P1)
7. **Acca Generator** — top 3 matchs avec confiance la plus haute combinés auto (P2)
