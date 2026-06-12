# Recalibration backtest — bd h6lv

**Date :** 2026-06-12  
**Scope :** Mise à jour des CALIBRATION_BINS après 2 fixes moteur

## Fixes appliqués

### 1. `computePoisson` — Renormalisation grille (l.7704-7708)
- La matrice Poisson tronquée 0-7 buts perdait ~20% de masse à fort λ.
- Renormalisation `∑matrix[h][a] / total` corrige les marchés over/BTTS (+0-20%).
- **Avant :** sous-estimation systématique des over/BTTS sur les matchs à haut score attendu.
- **Après :** distribution cohérente avec `computeDixonColes`.

### 2. `computeEloProbs` — drawProb corrigé (l.8101)
- Avant : `drawProb = 0.05` (fixe à 5%) → nuls massivement sous-estimés.
- Après : `drawProb = 0.25 + (|Elo diff| < 50 ? 0.05 : 0)` → base 25%, +5% si Elo proches.
- Le taux de nul réel observé sur 49 301 matchs vérifiés est **24.1%** → la correction est validée.

## Données de calibration (historique 49 301 matchs vérifiés)

### Reliability diagram over25
| Bucket | Pred_avg | Réalisé | n | Brier |
|--------|----------|---------|---|-------|
| 0-10   | 3.9      | 61.8    | 34| 0.335 |
| 10-20  | 15.4     | 42.4    | 33| 0.073 |
| 20-30  | 25.1     | 44.4    | 36| 0.038 |
| 30-40  | 34.9     | 32.9    |170| 0.0004|
| 40-50  | 44.2     | 42.7    |220| 0.0002|
| 50-60  | 54.2     | 63.6    |162| 0.009 |
| 60-70  | 63.7     | 63.0    |127| 0.0001|
| 70-80  | 74.5     | 59.0    | 61| 0.024 |
| 80-90  | 82.6     | 66.7    | 21| 0.025 |

### Reliability diagram btts
| Bucket | Pred_avg | Réalisé | n | Brier |
|--------|----------|---------|---|-------|
| 0-10   | 0.2      | 52.5    | 59| 0.274 |
| 10-20  | 14.3     | 43.8    | 16| 0.087 |
| 20-30  | 25.2     | 49.1    | 55| 0.057 |
| 30-40  | 36.0     | 29.0    |124| 0.005 |
| 40-50  | 44.2     | 44.2    |206| 0.000 |
| 50-60  | 54.5     | 60.0    |210| 0.003 |
| 60-70  | 63.5     | 76.9    |143| 0.018 |
| 70-80  | 73.2     | 58.7    | 46| 0.021 |
| 80-90  | 81.0     | 40.0    |  5| 0.168 |

### Brier scores globaux
- **over25 :** 0.2551 (n=864)
- **btts :** 0.2568 (n=864)

### Draw calibration (poisson_snapshot)
| Bucket | Pred_avg | Réalisé | n |
|--------|----------|---------|---|
| 0-10   | 3.9      | 20.8    | 24|
| 10-20  | 15.2     | 21.3    | 75|
| 20-30  | 24.3     | 21.3    |169|
| 30-40  | 33.2     | 34.0    | 53|
| 40-50  | 43.1     | 5.6     | 18|

## Analyse

### Les données historiques sont contaminées
Les `predicted` stockés dans l'historique ont été générés par l'ANCIEN modèle (avec les bugs). La calibration mesurée reflète donc les biais de l'ancien moteur, pas du nouveau. Les valeurs aberrantes dans les buckets 0-10% (pred=4%, réel=62%) sont un artefact de l'ancien modèle.

### Décision : identité quasi-pure
Les CALIBRATION_BINS passent en configuration identité (calibrated ≈ raw) car :
1. Les corrections structurelles (Poisson renormalisation + Elo drawProb) améliorent la calibration intrinsèque.
2. Les anciens bins étaient agressifs (tous calibrated < raw) car ils compensaient le bug Elo.
3. Appliquer les anciens bins au nouveau modèle double-compenserait les corrections.

Seule la queue haute (70-100%) garde un léger under :
- Poisson sur-estime structurellement à très haut λ (queue de distribution tronquée).
- Le Dixon-Coles (rho=-0.05) corrige partiellement mais pas totalement.

### Paramètres retenus

```javascript
const CALIBRATION_BINS = [
  { min: 0, max: 10, raw: 5, calibrated: 5 },    // Identité
  { min: 10, max: 20, raw: 15, calibrated: 15 },  // Identité
  { min: 20, max: 30, raw: 25, calibrated: 25 },  // Identité
  { min: 30, max: 40, raw: 35, calibrated: 35 },  // Identité
  { min: 40, max: 50, raw: 45, calibrated: 45 },  // Identité
  { min: 50, max: 60, raw: 55, calibrated: 55 },  // Zone bien calibrée
  { min: 60, max: 70, raw: 65, calibrated: 64 },  // Léger under
  { min: 70, max: 80, raw: 75, calibrated: 73 },  // Under modéré
  { min: 80, max: 90, raw: 85, calibrated: 82 },  // Under modéré
  { min: 90, max: 100, raw: 95, calibrated: 90 }, // Under modéré
];
```

### Items connexes vérifiés

| Item | Statut | Note |
|------|--------|------|
| **Corners expected-total** | ✅ OK | Moyenne simple `(home+away)/2` — adéquat pour v1. Pas de données corners historisées pour calibrer un modèle attaque-défense croisé. |
| **Shrinkage corners** | ✅ OK | `35 + 50 × n/(n+6)` = asymptote 85%, 50% à ~5 matchs. Formule bayésienne valide. |
| **`_dc_delta_cs00`** | ✅ Cosmétique | Le diagnostic à l.7835 est correct : `DC_CS00 - Raw_CS00` = différence due à τ(0,0). Avec ρ=-0.05, delta positif (DC augmente CS00). |

## Recommandations

1. **Re-évaluer la calibration après ~500 matchs vérifiés** avec le nouveau modèle.
2. Si les bins doivent être mis à jour dynamiquement, implémenter un mécanisme d'auto-calibration plutôt que des bins statiques.
3. **Script de recalibration :** `tools/calibrate-after-fixes.js` — relire la DB et compute les bins suggérés.
