# Test Report — TT-OOP Court Scraper + Tennis VB Planning
**Date** : 2026-05-26

## ✅ Tests passés
- `node --check server.js` : OK
- server.js syntax: no errors
- Boot-warm fires at startup: 117 joueurs/courts parsés Roland Garros
- 17/200 matchs Roland Garros avec court renseigné (Chatrier, Lenglen, Mathieu, 7, 8, 13, 14…)
- Regex `_parseTTOopHtml` : capture court + joueur en ordre document correct
- `_ttLookupCourt` suffix-matching : "Aryna Sabalenka" → "sabalenka" → hit ✅
- Normalisation cohérente (même strip `/[^a-z0-9 ]/g` côté parse + lookup)
- Accents strippés identiquement des deux côtés → pas de mismatch
- `_ptk`/`_pck` : variables `let` locales à chaque appel de `renderTennisValueBets` → reset automatique ✅ (reviewer faux positif)
- Grid column 290px : min-width 1049px cohérent `.tn-vb-header-row` + `.tn-vb-row`
- Null safety `_tnTK`/`_tnTHdr`/`_tnCHdr` : coercion objet/string/null confirmée
- `_escTennis` en scope ✅
- Cache 24h TTL : setInterval ne déclenche qu'après premier setTimeout (8h Paris)

## ⚠️ Avertissements (non bloquants)
### W1 — Headers hors-grille au scroll horizontal
`pariscore.html` — `.tn-tourn-hdr` / `.tn-court-hdr` sont des `div` block-level entre les rows grid.
Au scroll horizontal, les headers ne suivent pas la colonne sticky Match.
**Acceptable** pour v1 — amélioration P3 : `grid-column:1/-1` ou sticky vertical.

### W2 — Drift setInterval cron 8h
`server.js:38017` — `setInterval` démarre depuis le callback du `setTimeout`, drift de ~20s/jour.
Négligeable (< 1min sur 365j). P4 backlog.

### W3 — Noms avec tiret ("Juan-Carlos")
`server.js:28921` — strip `/[^a-z0-9 ]/g` transforme "Juan-Carlos" → "juancarlos".
TT format "Surname I" ne contient généralement pas de tirets dans le nom de famille.
Risque faible (ITF/Challenger uniquement). P3 backlog.

## ❌ Bugs détectés et corrigés
### BUG-1 — Race condition double-fetch TT-OOP (CORRIGÉ)
**Sévérité** : Moyen (fonctionnel mais 2x quota réseau + 2x CPU parse)
**Localisation** : `server.js:24362` `_fetchTTOopForTournament`
**Problème** : boot-warm + premier VB request lancent deux curl simultanés sur même URL si cache froid
**Fix appliqué** : `_ttOopInFlight: Map<url, Promise>` — second appel retourne même Promise, slot libéré dans callback curl

## 💡 Recommandations d'amélioration
1. Ajouter Wimbledon 2026 + US Open 2026 dans `_TT_OOP_URLS` dès que URLs TT disponibles
2. Header sticky vertical `top:0` dans la table tennis pour garder le contexte court visible au scroll
3. Log `[TT-OOP] prefetch — N/M tournois` visible en production — vérifier avec `pm2 logs pariscore --lines 50 | grep TT-OOP` post-deploy VPS
