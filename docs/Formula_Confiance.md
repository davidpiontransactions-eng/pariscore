# Formule de la Métrique "Confiance"

## Valeur affichée

```typescript
stats.confidence: number // 0-1, ex: 0.68 → affiché "68%"
```

## Définition

La **Confiance** mesure la fiabilité de la prédiction `probA` pour un match
donné. Elle est calculée à partir de la **dispersion des simulations Monte
Carlo** du modèle Dixon-Coles.

## Formule mathématique

```
confiance = 1 - σ_norm
```

Où :

```
σ_norm = σ_observé / σ_max
σ_observé = sqrt( Σ(p_i - p̄)² / (N-1) )
σ_max = 0.5  (écart-type maximum pour une probabilité binaire)
```

Avec :
- `p_i` = probabilité de victoire du joueur A dans la simulation `i`
- `p̄` = moyenne des `p_i` sur les N simulations
- `N` = nombre total d'itérations Monte Carlo (configurable, défaut: 10 000)

## Interprétation

| Confiance | Couleur | Signification |
|-----------|---------|---------------|
| ≥ 0.75 | Vert | Simulations très convergentes — prédiction stable |
| 0.60 – 0.74 | Ambre | Dispersion modérée — prédiction indicative |
| < 0.60 | Rouge | Forte dispersion — prédiction peu fiable |

Une confiance **élevée** (≥ 0.75) signifie que les simulations Monte Carlo
convergent vers une probabilité stable. Une confiance **faible** (< 0.60)
signale un match difficile à modéliser (joueurs de styles opposés, peu de
données historiques, forme récente erratique).

## Question clé : variance ou écart-type ?

Le calcul est basé sur **l'écart-type** (pas la variance) des simulations,
normalisé par l'écart-type maximum possible (0.5). Pourquoi l'écart-type ?

1. **Interprétabilité** : `σ = 0.12` veut dire "en moyenne, les simulations
   s'écartent de 12 points de pourcentage de la moyenne" — intuitif.
2. **Même unité que probA** : contrairement à la variance (en %²), l'écart-type
   est dans la même unité que la prédiction.

## Valeur par défaut

Quand la prédiction est absente ou que le modèle n'a pas pu s'exécuter :
```typescript
stats.confidence = 0.5; // valeur neutre — incertitude maximale par défaut
```

## Références

- Dixon-Coles (1997) — modèle de score bivarié pour le football
- MCMC convergence diagnostics (Gelman-Rubin ˆR)
- Loi normale : intervalle de confiance via `z * σ / sqrt(n)`
