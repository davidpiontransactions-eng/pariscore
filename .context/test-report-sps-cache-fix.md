# Test Report — SPS Cache Fix (bd gnne)
**Date** : 2026-05-28
**Commit** : d11d4f7
**Scope** : `pariscore.js` — SPS null-cache TTL + ELO surface fallback

---

## ✅ Tests passés

1. `node --check pariscore.js` → syntaxe valide
2. `node --check server.js` → syntaxe valide
3. `_spsCacheSet('m1', nullPayload, 5min_TTL)` → `entry.ttl === 300000` ✓
4. Cache expire après 5min+1ms pour entrée null → `_spsCacheGet` retourne `undefined` ✓
5. `_spsCacheSet('m2', realPayload)` → `entry.ttl === 21600000` (6h) ✓
6. `dataset.elo1` absent → `undefined != null` → `false` → `elo1 = null` (JS loose equality correct) ✓
7. `parseFloat('xyz')` → `isNaN` guard → `elo1 = null` ✓
8. `eloFallback === null` → branche `if (eloFallback != null)` non entrée → "SPS · —" affiché ✓
9. `eloFallback = 1523` → `"ELO~ 1523"` affiché ✓
10. Server `/api/v1/sps` : 400 si pas d'`ids`, 400 si >250, 400 si tous invalides, 405 si POST ✓
11. Server : allowlist `/^[A-Za-z0-9_\-:.]+$/` + len<=128 sanitize les IDs ✓
12. `_spsInFlight` libéré dans `.catch()` → retry possible sur prochaine render ✓
13. `eloP1`/`eloP2` définis à ligne 3420–3421 avant l'appel `_tvbSPSPlaceholder` à 3488 ✓
14. Valeurs ELO passées via `_spsEsc(String(elo1))` → XSS impossible ✓
15. Hydrator : entrée null → `_spsCacheSet(mid, payload, _SPS_NULL_CACHE_TTL_MS)` → 5min ✓
16. Hydrator : données réelles → `_spsCacheSet(mid, payload)` → 6h ✓
17. `_tvbPaintSPSCell` : lectures `dataset.elo1/elo2` + `isNaN` guards avant passage à chip ✓

---

## ⚠️ Avertissements (non bloquants)

### W1 — `sps = 0` enregistré si DB contient `r.sps = NULL`
**Localisation** : `server.js:31327` — `sps: Math.round(r.sps * 100) / 100`
**Problème** : `Math.round(null * 100) / 100 = 0`. Si jamais une ligne `player_surface_scores` a `sps=NULL` (edge case cron), le frontend affiche "SPS 0.0" (vert/orange selon confidence) au lieu de "—".
**Recommandation** : server-side `sps: r.sps != null ? Math.round(r.sps * 100) / 100 : null` + frontend guard `payload.sps != null && payload.sps > 0`.
**Priorité** : P2 — non introduit par ce fix, cas théorique.

### W2 — `_tvbSPSFormatChip` sans guard `isNaN` sur `eloFallback` si appelée directement
**Localisation** : `pariscore.js:2497`
**Problème** : La fonction est publique (pas `_`-prefixed private). Si un appelant futur passe un `NaN`, `Number(NaN).toFixed(0)` retourne `"NaN"` visible dans le DOM.
**Recommandation** : Ajouter `if (eloFallback != null && !isNaN(eloFallback))` en tête de branche fallback.
**Priorité** : P2 — actuellement seul `_tvbPaintSPSCell` appelle cette fonction, avec guard.

### W3 — Entrée avec `arr.length === 1` (un seul joueur avec SPS)
**Localisation** : `pariscore.js:2566–2572`
**Comportement** : `arr.length === 1` → branche `else` → `payload = { p1: arr[0], p2: null }`. Cache 6h. Le joueur 2 affiche "ELO~ X" en permanence (ne re-check jamais).
**Contexte** : Normal si le cron n'a pas encore calculé P2. Mais si cron calcule P2 plus tard, l'entrée restera cachée 6h avant refresh.
**Recommandation** : Si `arr.length > 0 && arr.length < 2`, utiliser TTL intermédiaire (ex: 30min) pour permettre que P2 soit éventuellement récupéré.
**Priorité** : P2 — cas rare, impact cosmétique uniquement.

---

## ❌ Bugs détectés

Aucun.

---

## 💡 Recommandations

1. **Fix W1** : Sécuriser `sps: r.sps != null ? Math.round(r.sps * 100) / 100 : null` côté server.
2. **Fix W2** : Ajouter guard `isNaN` dans `_tvbSPSFormatChip` pour défense-en-profondeur.
3. **Fix W3** : TTL 30min si `0 < arr.length < 2` pour rejoindre le calcul P2 plus rapidement.
