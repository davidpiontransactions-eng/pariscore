# Définition : Favoris clairs

## Règle métier

Un match est considéré comme un **"Favori clair"** (Clear Favorite) lorsque la probabilité
estimée par le modèle SetPoint pour le joueur A (le favori) est **≥ 70%**.

### Seuils des filtres

| Filtre | Clé i18n | Condition | Comportement attendu |
|--------|----------|-----------|---------------------|
| Tous | `filters.all` | Aucun filtre | Affiche tous les matchs |
| Favoris clairs | `filters.favorites` | `match.probA >= 70` | Matchs où le favori domine |
| Matchs serrés | `filters.balanced` | `match.probA < 60` | Matchs très équilibrés |
| Mes favoris | `filters.starred` | `favorites.has(match.id)` | Matchs épinglés par l'utilisateur |

### Logique de détermination de `probA`

```
probA = Math.round(pA * 100)
```

Où `pA` est la probabilité (0-1) calculée par le `prediction/engine.ts` via :
- Elo gap pondéré par surface
- Forme récente (5 derniers matchs)
- H2H historique
- Coefficient Dixon-Coles ρ (corrélation des scores faibles)
- Odds bookmakers avec déviggage (implied probability)

### Contrat technique

Champ `match.probA` :
- Type : `number`
- Échelle : **0-100** (pas 0-1)
- Garantie : toujours présent sur les matchs valides
- Valeur par défaut : `50` (équilibré) si la prédiction échoue
- Fallback : `match.odds.impliedProbA` si `probA` est absent

### Pièges connus

1. **Échelle 0-1 vs 0-100** : si le backend change l'échelle, le filtre
   `>= 70` devient `>= 0.7` ou vice-versa → vide silencieux
2. **NaN silencieux** : si `pA * 100` est `NaN`, `probA` devient `NaN`
3. **Matchs sans odds** : si les bookmakers n'ont pas de cotes, la prédiction
   ne peut pas calculer `probA`

### Exemples réels (API live)

| Match | probA live | probA mock | Favori clair ? |
|-------|-----------|------------|----------------|
| Sabalenka vs Osaka | 79 | 84 | ✅ Oui (≥ 70) |
| Alcaraz vs Rublev | 77 | 71 | ✅ Oui (≥ 70) |
| Sinner vs Medvedev | 68 | 58 | ❌ Non (< 70) |
