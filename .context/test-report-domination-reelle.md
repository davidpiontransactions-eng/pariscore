# Test Report — Alerte Domination Réelle DR≥1.2 + Cote≤1.30
**Date** : 2026-05-31

## ✅ Tests passés
- Formule DR_individuel correcte : `ret% / (100 - serve%)` sur données Jankoski/Giesen → Giesen DR=2.500 ✅
- Guard division par zéro : `serve=100%` → DR=null (alert silencieuse) ✅
- Guard retour nul : `ret=0` → DR=0.000 (< seuil, pas d'alerte) ✅
- Scope filter : Roland Garros ✅ | Challengers ✅ | UTR ✅ | Wimbledon (Grand Slam) ✅ | ITF ❌ | ATP 500 ❌
- Syntaxe node --check : OK ✅
- Cooldown 5min par matchId : `tndr_odds13:<id>` indépendant du cooldown DR diff ✅

## ❌ Bug détecté et corrigé

### BUG-1 — Alert bloquée par gate drGapAbs (CORRIGÉ)
**Sévérité** : HIGH — faux négatif systématique pour certains matchs  
**Root cause** : Le bloc `try { DR_individuel }` était placé APRÈS `if (drGapAbs < _DR_DIFF_THR) continue;` (la gate relative entre les deux joueurs). Si `drBase2.dr ≈ 0.95` (gap < 0.20), le `continue` sautait l'alerte même si l'un des joueurs avait DR_individuel ≥ 1.2.  
**Exemple faux négatif** : P2 serve=62%, ret=47% → DR_p2=1.237≥1.2, mais drBase2.dr=0.95 → gap=0.05 < 0.20 → alerte bloquée.  
**Fix** : Swap sections via `_fix_dr_gate.js` — bloc domination réelle maintenant AVANT `const drGapSigned` (ligne ~20469), indépendant de la gate.

## ⚠️ Avertissements (non bloquants)

### W1 — Scale des valeurs p1_serve/p1_ret non vérifiée pour source Sofascore
Si `_drSrc === 'sofa'`, les champs `drBase2.p1_serve` / `drBase2.p1_ret` doivent être en échelle 0-100 (pas 0-1) pour que la formule `ret / (100 - serve)` soit correcte. Vérification visuelle : le Discord embed affiche "Serve: 50.00, Return: 20.00" → échelle 0-100 confirmée pour source BSD. Source Sofa non testée en live.  
**Recommandation** : Ajouter log `[DR:scale] p1_serve=X _drSrc=Y` avec `DEBUG_DR=true` pour valider en VPS.

### W2 — Pas de guard `_p1rN >= 0`
Valeur retour négative (donnée corrompue BSD) produirait DR négatif. Très improbable mais possible.  
**Recommandation** : Ajouter `&& _p1rN >= 0` dans la condition de calcul _drI_p1.

### W3 — Wimbledon (Grand Slam) inclus dans scope
Le filtre `(/GRAND.?SLAM/.test(_tnDisc2) && /ATP|WTA/.test(_tnTour2))` inclut tous les Grand Slams, pas seulement Roland Garros. C'est probablement le comportement souhaité mais à confirmer.

## 💡 Recommandations
1. Test VPS live avec `pm2 logs pariscore | grep DomOdds13` pour valider le premier fire
2. Ajouter `&& _p1rN >= 0 && _p2rN >= 0` (W2)
3. Vérifier scale Sofascore avec `DEBUG_DR=true` sur 1 match (W1)
