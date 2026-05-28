# Test Report — SPS Hide-When-Empty + Per-Match W1
**Date** : 2026-05-28
**Commits** : `d9a6d6d` (hide empty row) + fix per-match null guard (this session)
**Scope** : `pariscore.js` — `_tvbPaintSPSCell` hide logic · `server.js` — per-match endpoint null guard

---

## ✅ Tests passés

1. `node --check server.js` → syntaxe valide ✓
2. `node --check pariscore.js` → syntaxe valide ✓
3. `_spsCacheGet` : per-entry TTL (`entry.ttl != null ? entry.ttl : default`) ✓
4. `_spsCacheSet` : override TTL via 3ème paramètre ✓
5. `arr.length === 0` → `payload = {p1:null,p2:null}` → `_spsCacheSet(mid, payload, _SPS_NULL_CACHE_TTL_MS)` → 5min ✓
6. `arr.length < 2` → `_spsCacheSet(mid, payload, 30*60*1000)` → 30min ✓
7. `arr.length >= 2` → `_spsCacheSet(mid, payload)` → 6h ✓
8. `_tvbPaintSPSCell` : `!p1 && !p2 && elo1 == null && elo2 == null` → `nodes[i].style.display = 'none'` ✓
9. `dataset.elo1 != null` loose-equality → correct pour `undefined` (undefined == null → false) → `null` assigné ✓
10. `isNaN(elo1)` / `isNaN(elo2)` guards → `null` si parseFloat donne NaN ✓
11. `isNaN(eloFallback)` guard dans `_tvbSPSFormatChip` (W2) ✓
12. W1 batch endpoint (31504) : `r.sps != null ? Math.round(...) : null` ✓
13. W1 per-match endpoint (31563) : null guard ajouté ce commit ✓ (idem `aptitude_score` 31564)
14. `_spsInFlight.delete` dans `.then` (par mid) ET `.catch` (tous ids) → retry possible ✓
15. Chunk 200 < cap serveur 250 ✓
16. XSS : toutes valeurs dynamiques via `_spsEsc()` ✓
17. `CREATE TABLE IF NOT EXISTS player_surface_scores` dans init DB (ligne 4888) → pas de crash au boot ✓
18. Batch endpoint : 400 si `ids` absent, 400 si >250, 400 si tous invalides, 405 si POST ✓
19. Re-render table (filtre/tri) → cache hit → paint synchrone → pas de flash skeleton ✓

---

## ⚠️ Avertissements (non bloquants)

### W1 — "SPS —" visible quand p1 a un ELO mais p2 n'en a pas
**Localisation** : `pariscore.js:2511` — branche `tn-sps-empty`
**Problème** : Si p1 a un ELO fallback mais p2 n'a ni SPS ni ELO, la ligne EST affichée (condition hide = false car `elo1 != null`). Le chip p2 affiche "SPS —" à côté du chip ELO de p1. Cosmétiquement bruité.
**Recommandation** : Masquer le chip vide individuel côté p2 avec `display:none` sur le `tn-sps-empty` div si la ligne a au moins un chip utile. Ou supprimer le texte "SPS —" et laisser vide.
**Priorité** : P3 — cas rare (un seul joueur avec ELO surface sans SPS calculé).

---

## ❌ Bugs détectés

Aucun.

---

## 💡 Recommandations

1. ~~**Fix W1 per-match** : null guard sur `sps`/`aptitude_score` route `/api/v1/sps/:matchId`~~ ✅ corrigé ce rapport (server.js:31563-31564).
2. **Monitoring** : Vérifier `window.__spsStats` en console après Roland Garros pour mesurer ratio hits/miss — valider que 5min TTL réduit bien les re-fetches inutiles.
3. **Déployable** : Uploader `server.js` sur VPS (fix W1 per-match). `pariscore.js` déjà uploadé (commit `d9a6d6d`).
