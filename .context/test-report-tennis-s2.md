# Test Report — Tennis Sprint 2
**Date** : 2026-05-18
**Items** : Trap-Bet, Edge Confiance composite, Blend dynamique, Value 1er set, Convergence Totaux

## ✅ Tests passés
- **Sync server↔frontend** : `trap_bet/conf_edge/first_set/totals_convergence` exposés (server.js:19483-19486) ↔ lus frontend (pariscore.html:10088/10099/10101/10103). 0 orpheline.
- **Colonnes** : injection inline (player / set1 / gamesOU / market cells). 0 colonne ajoutée → `colspan="13"` intact. Contrainte condensé respectée.
- **Blend dynamique validé sur calibration réelle** (n=151, acc 62.9%, brier 0.21) :
  - conf 52 (bucket acc 43%) → reliability 0.014 → wBsd 0.20 (min, BSD à peine pris en compte) ✓ correct
  - conf 64 (bucket acc 74%, n53) → reliability 0.543 → wBsd 0.47 ✓
  - conf 80 (n11 < 30 → fallback global) → reliability 0.292 (conservateur, petit échantillon non sur-pondéré) ✓
  - no calib → null → fallback statique 60/40 (pas de régression)
- **Trap-bet** : contradiction marché/modèle (65% p1 vs modèle 58% p2) → flag high ✓ ; EV+7 sur badge red → unreliable_edge medium ✓ ; cas sain → flag false ✓
- **Null safety** : helpers `_tvbTrap/_tvbConfEdge/_tvbFirstSet/_tvbTotConv` → `''` si null/absent. Backend : `_trap` gère fair/blended null ; `_confEdge` requiert bestEvModel+_rel ; `_firstSet` requiert bsdPred ; `_totConv` requiert gamesOU.sets.
- **Totaux convergence** : recalé sur `gamesOU.sets.*.exp_games` (× sets moyens BO5 3.6 / BO3 2.4) après découverte que `computeTennisGamesOverUnder` n'expose pas de total direct.
- `node --check server.js` → SERVER_OK.

## ⚠️ Avertissements
### W1 — Value 1er set sans cote dédiée
The Odds API = h2h only → pas de cote "gagnant 1er set". `first_set` expose la proba ML BSD + flag divergence vs match (signal qualitatif), **EV non calculable**. Marché 1er set à brancher si source cote dispo (S3/futur).
### W2 — Markov ref totaux = approximation
`markov_ref` = exp_games moyen × sets moyens empiriques (3.6/2.4), pas une distribution exacte. Suffisant pour accord/désaccord (seuils ±2 / ±4), pas pour pricing fin.
### W3 — Dépendances cache
trap/conf_edge/blend dynamique dépendent de `calib` (cache 6h) + `bsdPred` (30min). Froid → fallback statique + pas de trap unreliable (dégradé propre, pas faux signal).
### W4 — Pas d'E2E navigateur (RG pas commencé, onglet auth-gated). Validé statique + données réelles BSD.

## ❌ Bugs
Aucun bloquant.

## 💡 Recommandations
1. Filtre tableau "Masquer trap-bets" + "cEV actionable seulement" (réutilise `trap_bet.flag` / `conf_edge.actionable`).
2. Exposer le poids dynamique (`blended.weights`) en tooltip de la barre proba (transparence modèle).
3. S3 : brancher cote 1er set si une source l'expose → EV 1er set réel.

## Statut
**S2 LIVRÉ** (backend 5/5 + frontend inline), testé statique + calibration réelle. Validation visuelle prod = ouvrir onglet Tennis (W4).
