# Test Report — Intégration modèles ML dans Top Stratégies (bd he1t)
**Date** : 2026-05-30
**Scope** : scoring stratégies (server `STRATEGIES[].getProb` + frontend `calcStrategyScore`) câblé sur les modèles ML (CatBoost `blended_cb`, Dixon-Coles, bayésien `calibrated`) avec repli Poisson, helper `bestModelProb`, tag `model_source`, badge UI.
**Méthode** : node --check, 16 tests unitaires logique, runtime API (CatBoost on), preuve divergence ML vs Poisson, audit sync server↔frontend.

---

## ✅ Tests passés

### Syntaxe
- `node --check server.js` → OK
- `node --check pariscore.js` → OK

### Logique `bestModelProb` / `modelSourceFor` — 16/16 tests unitaires
- **Priorité 1X2** : CatBoost blend (`blended_cb`) > bayésien `calibrated` > Poisson
- **Priorité over25/btts** : CatBoost blend > Dixon-Coles > Poisson
- **Priorité totals/CS (over05/15/35, under15, cs00)** : Dixon-Coles (correction faibles scores) > Poisson
- Fallback gracieux par niveau (cb absent → dc/ca → poisson)
- Null safety : match null/empty → `null` (jamais throw) ; marché inconnu → poisson
- Marchés dérivés : UNDER_2_5 = 100 − over25 ; DC = homeWin + draw

### Runtime API (CatBoost on, 118 prédictions)
- `/api/v1/top-strategy?type=OVER_2_5` → picks avec `model_source: ml-catboost`, confidence issue de `blended_cb.over25`
- `/api/v1/top-strategy?type=CS_00` → `model_source: dixon-coles` (correction faibles scores)
- `/api/v1/hot-picks` → `model_source` présent sur chaque pick (ml-catboost / dixon-coles)
- **Preuve d'intégration** : match GAIS — `poisson.over25 = 32` mais la stratégie OVER_2_5 score **40** (`blended_cb.over25`). Le modèle ML pilote bien le scoring, pas le Poisson brut.

### Couverture stratégies (14 câblées sur bestModelProb)
BTTS_YES, OVER_2_5, OVER_1_5, UNDER_2_5, HOME_WIN, AWAY_WIN, DRAW, CS_00, VERROU_TACTIQUE, DC_HOME, DC_AWAY, HT_HOME_FT_HOME, HT_UNDER_FT_OVER, GOLDEN_PPG_GAP, STEAM_DETECTED (baseProb 1X2).
Corners (ANGLE/OVER_6_5) inchangés (pas de modèle corners → proxy `confidence_score`).

### Sync server ↔ frontend
- `bestModelProb` / `modelSourceFor` / `STRAT_MARKET` : **logique identique** dans server.js et pariscore.js (miroir vérifié ligne à ligne). Aucune divergence de priorité.
- `model_source` produit serveur (`getTopMatchesByStrategy`, `getHotPicks`) ↔ consommé frontend (`_modelSrcBadge` dans `_renderStratCard` + carte hot-picks).

### Confiance ML-aware
- `computeConfidenceIndex` : bonus +3 à +7 (pondéré `reliability_score`) quand un `blended_cb` est disponible → les picks adossés au modèle ML remontent dans le classement.

### Null safety / états dégradés
- Aucun `blended_cb`/`dixonColes` → repli Poisson transparent, `model_source: poisson`, aucun throw.
- `m.poisson` absent → strat retourne null (filtré), pas de crash.

---

## ❌ Bugs détectés
Aucun.

---

## ⚠️ Avertissements

### W1 — Badge UI vérifié par logique (non rendu en preview)
`_modelSrcBadge(src)` mappe déterministe `ml-catboost`→🤖 ML, `dixon-coles`→DC, `calibrated`→CAL, sinon vide. Valeurs `model_source` vérifiées en runtime ; le rendu HTML est une interpolation triviale (switch 3 cas). Non capturé en screenshot (preview instable sur modal lourd), mais logique déterministe sur entrées validées.

### W2 — Impact backtest à surveiller
Les stratégies changent de source de proba (ML vs Poisson) → les matchs qualifiés et tags `predicted.strategies` évoluent. C'est l'objectif (meilleur modèle = meilleurs picks), mais le Brier/accuracy historique pré-bascule n'est plus directement comparable. Recommandation : marquer la date de bascule dans le suivi accuracy.

---

## 💡 Recommandations
1. **Backtest A/B ML vs Poisson** sur les stratégies (≥500 matchs vérifiés) pour mesurer le gain réel de calibration — rigueur Quant.
2. **Exposer `model_source` dans `/api/v1/insights`** pour cohérence avec les cartes stratégies.
3. **Compteur coverage** `% picks ml-catboost` dans `/api/v1/status` (détection régression pipeline ML, cf. BUG-1 session précédente).

---

## Statut final
- **0 bug ❌**. Intégration ML dans Top Stratégies **livrée et vérifiée** (server + frontend, runtime + unit).
- 2 ⚠️ → roadmap.
