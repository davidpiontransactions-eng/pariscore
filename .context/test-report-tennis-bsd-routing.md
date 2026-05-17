# Test Report — Routing BSD Tennis → Onglet Tennis (RG)
**Date** : 2026-05-17
**Module** : `fetchBSDTennisLive` / `_normalizeBSDTennisMatch` / `_mergeTennisLive` / `pollTennisLive`

## ✅ Tests passés
- `node --check server.js` → SYNTAX_OK.
- Adaptateur `_normalizeBSDTennisMatch` sur match BSD réel → shape unifiée correcte (id `bsd_t_*`, tour, tournament, player1/2, sets, current_point, serving, start_time).
- Null safety : `norm(null)` → `null` ; `norm({id,tournament:{}})` (sans player) → `null`. Pas d'accès non protégé (`m.player1.name` gardé par early-return `if(!m||!m.player1||!m.player2)`).
- Endpoint live BSD `/api/v2/matches/live/` → array (len 0 actuellement — aucun tennis live le 2026-05-17, RG débute ~24 mai). Parsing array ET `{results:[]}` géré.
- **RG confirmé dans BSD** : `category=grand_slam` → « Roland Garros » (ATP + WTA) + Boys/Girls/Wheelchairs. Le champ `tournament` transite tel quel → onglet Tennis groupera RG automatiquement dès matchs live.
- Merge `_mergeTennisLive` : BSD prioritaire, ESPN ajoute les paires absentes (dédup `_tennisPairKey` = noms triés). BSD off → ESPN seul (comportement legacy préservé).
- Route `/tennis/api/v2/matches/live/` inchangée : BSD normalisé = même shape qu'ESPN → zéro changement frontend requis.
- Gate `BSD_TENNIS_ENABLED` : si false → BSD sauté, ESPN seul (pas de régression). Erreur `ADDON_REQUIRED` → warn + fallback ESPN.

## ⚠️ Avertissements (non bloquants)
### W1 — Détection `is_live` non vérifiée sur vrai match live
`_normalizeBSDTennisMatch` détecte le live via regex statut (`/progress|live|playing|set/`) + `current_set!=null`. Aucun tennis live actuellement → non validé end-to-end sur statut BSD réel in-play. À re-vérifier dès RG (logs `[TennisLive] BSD=N`).

### W2 — `BSD_TENNIS_ENABLED` doit être activé en prod
Flag défaut `false`. L'addon est souscrit mais le routing reste inerte tant que `BSD_TENNIS_ENABLED=true` absent de l'env VPS pm2.

### W3 — `_bsd_stats` non exposé par la route
Aces/double-faults/%1er service normalisés dans `_bsd_stats` mais la route `/matches/live/` ne mappe pas ce champ. Exploitable plus tard (modal stats tennis) — P2.

## ❌ Bugs détectés
Aucun bug bloquant.

## 💡 Recommandations
1. **Activer `BSD_TENNIS_ENABLED=true`** dans l'env pm2 prod (sinon BSD jamais appelé).
2. Re-tester pendant RG (24 mai → 7 juin) : vérifier `[TennisLive] BSD=N ESPN=M merged=K` avec N>0 et `is_live` correct sur statuts BSD réels.
3. P2 : exposer `_bsd_stats` (aces, DF, %service) dans la route + modal stats tennis.
4. P2 : route schedule RG (`/api/v2/matches/?tournament={RG_id}&date_from=...`) pour afficher le programme avant le live.

## Validation prod (2026-05-17 21:33 — VPS e9076027)
- `BSD_TENNIS_ENABLED=true` ajouté au fichier `.env` (1re tentative = variable shell éphémère → `(BSD off)` ; corrigée via sed/append fichier).
- Log prod après restart : `[TennisLive] BSD=0 ESPN=602 merged=414` **sans `(BSD off)`** → routing BSD ACTIF en prod. ✓
- Re-probe : BSD `/api/v2/matches/live/` HTTP200 array[0] (0 live = normal, RG ~24 mai). Endpoint joignable, clé valide.
- Normalizer guard : match `scheduled` réel → mappable (player1/2/tournament OK).
- RG joignable : « Roland Garros » ATP + WTA, surface **clay** (+ Boys/Girls/Wheelchairs).
- `node --check server.js` → SYNTAX_OK.

## Statut
**LIVRÉ & ACTIF EN PROD.** Routing BSD tennis opérationnel (flag activé, endpoint OK). Reste : validation end-to-end `is_live` sur statuts BSD in-play réels pendant RG (24 mai–7 juin) — W1.
