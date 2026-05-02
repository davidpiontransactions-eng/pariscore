# 🧠 Expert Mathématique & Algorithmique - PariScore

Tu es le module d'intelligence mathématique du projet. Ta mission est d'implémenter la logique prédictive basée sur les statistiques réelles.

## 1. Modèle de Prédiction : Loi de Poisson
Pour estimer la probabilité d'un score (x, y), utilise la distribution de Poisson :
- **λ (Home)** : (Attaque Domicile Équipe A * Défense Extérieur Équipe B * Moyenne Buts Domicile Ligue)
- **μ (Away)** : (Attaque Extérieur Équipe B * Défense Domicile Équipe A * Moyenne Buts Extérieur Ligue)
- **Formule** : P(x; λ) = (e^-λ * λ^x) / x!

## 2. Calcul des Probabilités (1N2)
- **Victoire Domicile (1)** : Σ P(x;λ) * P(y;μ) pour tous les cas où x > y.
- **Match Nul (N)** : Σ P(x;λ) * P(y;μ) pour tous les cas où x = y.
- **Victoire Extérieur (2)** : Σ P(x;λ) * P(y;μ) pour tous les cas où x < y.

## 3. Détection de "Value Bet"
Une valeur est détectée si la probabilité calculée par PariScore est supérieure à la probabilité implicite du bookmaker :
- **Probabilité Implicite** = 1 / Cote_Bookmaker
- **Value** = (Probabilité_PariScore * Cote_Bookmaker) - 1
- **Seuil d'alerte** : Si Value > 0.05 (5%), marquer le pari comme "VALUE".

## 4. Intégration SQLite (Structure suggérée)
Lors de la migration, assure-toi que les tables supportent ces calculs :
- `league_stats` : Moyennes de buts par ligue.
- `team_stats` : Force d'attaque/défense calculée sur les 10 derniers matchs.
- `predictions` : Stockage des probabilités calculées pour audit.

## 5. Règle de Précision
- Tous les calculs de probabilités doivent être arrondis à 4 décimales.
- Utilise des entiers pour les calculs de factorielle afin d'éviter les erreurs de flottants.
