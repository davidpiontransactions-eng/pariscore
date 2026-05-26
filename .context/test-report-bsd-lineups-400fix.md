# Test Report — BSD Lineups HTTP 400 Fix
**Date** : 2026-05-27

## Contexte
Match Copa Sudamericana (Grêmio – Montevideo City Torque) sans `_bsd_event_id` → onglet COMPOS crashait
avec "Erreur chargement compositions BSD : HTTP 400". Fix livré en session.

## ✅ Tests passés

- `node --check server.js` → SYNTAX OK
- **Cas no-event-id** : `_bsdResolveEventId(rawId)` retourne null → backend retourne 200 + `data:{lineup_status:'no_bsd_event_id'}` → frontend affiche "Compositions indisponibles. Statut BSD : no_bsd_event_id"
- **Cas BSD upstream 400/404** : `_bsdEnrichFetch` intercepte (`res.status !== 200`) → negative cache → retourne `{data:null}` → frontend affiche "Compositions indisponibles" (chemin pré-existant confirmé intact)
- **Frontend compos `!res.ok`** : maintenant affiche placeholder 🏟️ "Compositions à venir ~60 min" au lieu de throw (ex: 502 réseau)
- **Onglet Incidents** : avec `data:{lineup_status:'no_bsd_event_id'}` → `d.incidents` undefined → `[]` → "Aucun incident enregistré" (graceful ✅)
- **Onglet Shotmap** : `d.stats={}`, `d.shotmap=[]` → rendu vide sans crash ✅
- **Debug logs** ajoutés : `[DEBUG COMPOS] Request URL: {endpoint}` avant bsdFetch + log status non-200 upstream

## ⚠️ Avertissements (non bloquants)

### W1 — Logs DEBUG permanents en prod
**Localisation** : `server.js:32046-32049` (dans `_bsdEnrichFetch`)
**Problème** : `console.log("[DEBUG COMPOS] Request URL: ...")` fire sur TOUS les kinds (incidents, shotmap, predictions, etc.), pas seulement lineups. ~10 logs par ouverture de drawer.
**Recommandation** : Passer à `if (process.env.DEBUG_BSD)` ou supprimer après confirmation prod. Pas bloquant en dev.

### W2 — Incidents/Shotmap : `!res.ok` → message brut si 502
**Localisation** : `pariscore.html:29018` (incidents), `pariscore.html:29118` (shotmap)
**Problème** : Si backend retourne 502 (exception réseau dans `_bsdEnrichFetch`), affiche "Erreur chargement incidents : HTTP 502" — moins soigné que le placeholder compos.
**Recommandation** : Même pattern placeholder pour ces deux onglets (P2, faible fréquence).

### W3 — `_bsdResolveEventId` : match ESPN sans `_bsd_event_id` casse silencieusement
**Localisation** : `server.js:32006-32019`
**Problème** : Matches sourced ESPN/API-Football (Copa Sudamericana, tournois SA) n'ont pas de `_bsd_event_id`. Le fix retourne `lineup_status:'no_bsd_event_id'` mais l'utilisateur voit "indisponible" sans savoir pourquoi. Normal pour matchs hors couverture BSD.
**Recommandation** : Dans l'UI, masquer l'onglet COMPOS sur les matchs détectés comme hors-BSD (`m._bsd_event_id == null`) pour éviter le clic inutile. P2.

## ❌ Bugs détectés

Aucun bug résiduel sur le périmètre du fix.

## 💡 Recommandations d'amélioration

1. **Masquer onglet COMPOS** si `matchId` ne résoud pas en BSD event (`_bsd_event_id == null` ou pattern non-`bsd_`) — évite le round-trip inutile.
2. **Supprimer/gate les logs DEBUG** après validation prod (`DEBUG_BSD=1` env flag).
3. **Étendre le placeholder 🏟️** aux onglets Incidents et Shotmap (cohérence UX, actuellement affichent message d'erreur texte brut sur 502).

## Fichiers modifiés

| Fichier | Ligne | Changement |
|---|---|---|
| `server.js` | 32426-32432 | `!eventId` → 200 + payload gracieux au lieu de 400 |
| `server.js` | 32046-32049 | Debug logs avant/après bsdFetch |
| `pariscore.html` | 28945-28948 | `!res.ok` → placeholder 🏟️ au lieu de throw |
