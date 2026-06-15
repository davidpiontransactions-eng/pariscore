# Extraction de thèse : "Statistical Methods for Detecting Match-Fixing in Tennis"
**Auteur :** Oliver Hatfield, MMath (Hons.), MRes  
**Soumission :** Décembre 2019, Lancaster University  
**Mots :** ~73,000  
**Source :** https://eprints.lancs.ac.uk/id/eprint/141874/1/2019hatfieldphd.pdf

---

## Structure du document

| Chapitre | Titre | Pages |
|----------|-------|-------|
| 1 | Introduction | 1-5 |
| 2 | Literature Review | 6-57 |
| 3 | Proofs of Results About Tennis Match Markov Chains | 58-81 |
| 4 | Glicko Ratings with an Application to Tennis | 82-125 |
| 5 | Data: Odds and Results | 126-137 |
| 6 | Pre-Match Odds Modelling | 138-160 |
| 7 | A Bayesian Model for In-Play Odds | 161-195 |
| 8 | A Gaussian Processes Model for In-Play Odds | 196-212 |
| 9 | Conclusions | 213-221 |

---

## Chapitre 1 : Introduction

### Problématique
Le match-fixing est un problème clé dans le tennis. En 2016, une enquête conjointe BBC/BuzzFeed (Blake & Templon, 2016) a révélé des documents sur des matchs truqués. La Tennis Integrity Unit (TIU) a depuis intensifié ses efforts, mais le problème persiste.

### Objectif de la thèse
Développer **des méthodes statistiques nouvelles** pour identifier les matchs de tennis où une activité de pari suspecte se produit. Les statistiques seules ne peuvent pas prouver qu'un match est truqué, mais elles peuvent identifier les matchs les plus suspects pour une enquête approfondie.

### Contributions principales
1. **Analyse pré-match** utilisant les volumes de paris et les cotes à plusieurs intervalles (pas seulement ouverture/fermeture)
2. **Deux méthodes in-play** originales (Bayésienne et processus gaussiens) — les premières dans la littérature académique pour le tennis
3. **Preuve d'inversibilité** de la fonction m(λ|μ,s,b) (Ch. 3)
4. **Extension du Glicko** aux matchs en 5 sets (Ch. 4)

---

## Chapitre 2 : Revue de littérature

### Détection de match-fixing (section 2.1)

**Principe fondamental :** La théorie économique suggère que les cotes peuvent être vues comme des prévisions probabilistes d'un événement, à condition que le marché soit efficient.

**Mécanisme :** Quand un match est truqué, le fraudeur connaît l'issue et peut parier massivement, ce qui déplace les cotes. L'objectif est de détecter ces déplacements anormaux.

**SportRadar Fraud Detection System** (Forrest & McHale, 2015, 2019) :
- Drapeaux vert/orange/rouge selon la sévérité
- Recherche de : (i) grands mouvements de cotes fractionnelles, (ii) volumes anormaux sur Betfair, (iii) écarts entre cotes de clôture et prédictions d'un modèle Elo
- Les matchs sont inspectés manuellement pour trouver des explications innocentes (blessure, etc.)

**Blake & Templon (2016) - BuzzFeed :**
- Identifient les matchs avec des swings de cotes pré-match ≥ 10 points de pourcentage
- 11% des matchs analysés présentent ce phénomène
- 4 joueurs identifiés comme suspects après correction de tests multiples

**Rodenberg & Feustel (2014) :**
- Utilisent un modèle Elo pour prédire les matchs
- Définissent l'erreur de prédiction comme la différence entre cotes et prédiction Elo
- Les matchs du premier tour sont les plus susceptibles d'être truqués

**Ötting et al. (2018) :**
- Analysent à la fois les cotes pré-match et les volumes de paris pour le football (Serie B)
- Drapeau si l'une ou l'autre quantité observée diffère significativement des prédictions

### Modèles pré-match de tennis (section 2.2)

**Bradley-Terry Models :** Modèles de comparaison par paires. La probabilité que le joueur i batte j est :
- P(i bat j) = π_i / (π_i + π_j)
- Version dynamique : Glicko (Glickman, 1999) et Elo

**Glicko Ratings** : Chaque joueur a une moyenne ν (force estimée) et un écart-type σ (incertitude). Mise à jour après chaque match selon un modèle d'espace d'état gaussien.

### Modèles in-play de tennis (section 2.3)

**Chaînes de Markov pour les matchs de tennis :**
- Hiérarchie à 4 niveaux : points → jeux → sets → match
- Hypothèse IID : chaque point est indépendant et identiquement distribué
- La probabilité que le joueur i gagne un point sur son service est notée p_i
- Paramétrisation clé : μ_ij = (p_ij + p_ji)/2 (moyenne) et λ_ij = (p_ij - p_ji)/2 (dominance)

**Klaassen & Magnus (2001) :** Testent les hypothèses IID sur 4 ans de données de Wimbledon. Rejettent les deux (indépendance et distribution identique), mais considèrent que ces violations sont "relativement inoffensives" pour les prévisions.

**Estimation des probabilités de point (section 2.3.2) :**
- Barnett & Clarke (2005) : utilisent les moyennes de carrière des points gagnés au service et en retour
- Knottenbelt et al. (2012) : approche par "opposants communs"
- La différence λ = (p_ij - p_ji)/2 est beaucoup plus informative que la moyenne μ

---

## Chapitre 3 : Preuves sur les chaînes de Markov

**Résultat central :** La fonction m(λ|μ,s,b) — probabilité qu'un joueur gagne un match étant donné λ, μ, le score s, le format b — est **inversible en λ** pour tout score s dans un match en b sets.

Ceci permet de : (i) déduire λ de la probabilité de victoire, (ii) calculer les probabilités de toutes les autres lignes de score.

Le chapitre introduit et prouve la classe des chaînes de Markov "First to (M+1, N+1)" et montre que la probabilité d'absorption est continue et monotone dans un paramètre α.

---

## Chapitre 4 : Glicko Ratings appliqué au tennis

### Modèle Glicko de base (section 4.1)
Chaque joueur i a un paramètre de force θ_i ~ N(ν_i, σ_i²).
- ν_i : estimation ponctuelle de la force
- σ_i : incertitude sur cette estimation
- La variance augmente avec le temps sans activité (via un paramètre de dérive)

### Extension aux matchs en 5 sets (section 4.3)
Contribution originale : méthode analytique pour pondérer différemment les matchs en 5 sets vs 3 sets. Les matchs en 5 sets sont plus longs, donc la chance y joue un rôle moindre — les joueurs plus forts y gagnent plus souvent.

### Calibration (section 4.4.1)
Vérification par bins de probabilité : les prédictions sont bien calibrées (les matchs prédits à 60% sont gagnés dans ~60% des cas).

### Inflation des ratings (section 4.4.4)
Analyse montrant que l'inflation/déflation des ratings n'est pas un problème significatif (changement de ~25 points sur 25 ans).

### Surfaces (section 4.4.3)
Proposition de ratings corrélés par surface avec matrice de corrélation :
```
M = | 1    0.25 0.5 |
    |0.25   1   0.01|
    | 0.5  0.01   1 |
```
Basé sur Irons et al. (2014), pour surfaces {dur, terre battue, gazon}.

---

## Chapitre 5 : Données

### Données de cotes (ATASS Sports)
- **274 matchs** de 2013 à 2016
- Cotes d'un seul exchange (pré-match et in-play)
- Niveaux : Grand Chelem (36), Masters 1000 (64), Autres ATP (137), Challenger (37)
- Surfaces : dur (172), terre battue (102)
- Données pré-match échantillonnées à plusieurs intervalles (généralement 8 points par match)
- Données in-play enregistrées à chaque changement de jeu

### Données de résultats (JeffSackman / GitHub)
- Résultats historiques de l'ATP tour, Challenger et Futures
- Utilisées pour estimer les forces des joueurs via Glicko

### Pré-traitement des cotes
- Pour les cotes in-play : médiane des cotes dans chaque intervalle de jeu
- Suppression des cotes reflétant un score incorrect
- Concepts clés : **overround** (différence entre 1 et la somme des inverses des cotes), **bid-ask spread**, **liquidité**

---

## Chapitre 6 : Modèle Pré-Match par Processus Gaussiens

### Approche
Modéliser la "juste valeur" ω_k des cotes pour chaque match k, que les cotes réelles rejoignent à l'approche du match.

**Variable modélisée :** y_k(τ) = logit(probabilité implicite de gain du joueur 1) au temps τ avant le match k.

### Modèle GP
```
Y_k(τ) ~ N(ω_k, Var(Y_k(τ)))
Var(Y_k(τ)) = δ² exp(x_k(τ)β)
Cor(Y_k(τ_i), Y_k(τ_j)) = ρ^{||x_i - x_j||}
```
où x_k(τ) est soit le **temps** avant le match, soit le **log(1+volume)**.

### Résultats clés
- **L'overround** n'a pas d'impact significatif → exclu
- **log(1+volume)** donne le meilleur ajustement pour la variance décroissante
- Modéliser par **temps seul ou volume seul** fonctionne, mais pas les deux ensemble (colinéarité : corrélation temps/volume standardisé = 0.74)
- **Nugget effect** nécessaire (équation 6.3.5)

### Ajustement
- Maximum de vraisemblance pour β, ρ, η
- Estimateurs du profil pour ω_k et δ²
- Approche bayésienne avec prior Glicko pour ω_k

### Drapeaux
Les matchs avec les plus petits p-values sont signalés. Les matchs avec de grands swings pré-match sont correctement identifiés.

---

## Chapitre 7 : Modèle Bayésien pour les Cotes In-Play

### Approche
Modéliser λ = (p_ij - p_ji)/2 — le paramètre de dominance — au lieu des probabilités de victoire directement.

**Prior sur λ :** Basé sur les ratings Glicko : λ ~ N(q(ν_i - ν_j), q²(σ_i² + σ_j²)), où q est une fonction de lien logistique.

### Mise à jour bayésienne
À chaque changement de jeu, la vraisemblance est calculée à partir des jeux gagnés/perdus au service :
- k_i^(g)(τ) : jeux gagnés par i au service
- n_i^(g)(τ) - k_i^(g)(τ) : jeux perdus par i au service
- La vraisemblance utilise g(μ + λ) = probabilité de gagner un jeu au service

### Résultats
- Deux matchs (73 et 136) identifiés comme très suspects — confirmés par d'autres sources comme ayant une activité de pari inhabituelle
- Les intervalles de prédiction sont larges
- La mise à jour postérieure de λ est lente (trop peu d'information dans les jeux gagnés/perdus)
- Les p-values sont analysées par **minimum** et **moyenne** par match

### Limitations
- Les ratings Glicko ne prédisent pas toujours bien les cotes d'ouverture
- L'effet de surface n'est pas capturé
- Les données points-par-points (non disponibles) amélioreraient probablement la vitesse de mise à jour
- L'utilisation de priors basés sur les cotes pré-match (au lieu de Glicko) donne une moins bonne calibration

---

## Chapitre 8 : Modèle par Processus Gaussiens pour Cotes In-Play

### Approche révolutionnaire
Au lieu de modéliser la probabilité de victoire, ce chapitre modélise **directement le λ implicite du marché** (dérivé des cotes via la fonction inverse du Ch. 3). Le modèle GP permet de **pooler l'information** entre tous les matchs.

### Modèle GP pour λ
```
Λ_k ~ MVN(α_k 1_nk + X_k β, δ²(C_k + η² I_nk))
```
où :
- α_k : niveau de base du match k
- X_k : 3 covariables basées sur les jeux gagnés/perdus au service et les tie-breaks

### Covariables (équation 8.1.3)
1. **x_k1(τ)** = différence des jeux gagnés au service (k_i^(g) - k_j^(g))
2. **x_k2(τ)** = différence des jeux perdus au service ((n_i^(g) - k_i^(g)) - (n_j^(g) - k_j^(g)))
3. **x_k3(τ)** = différence des tie-breaks gagnés

### Ajustement
- Structure block-diagonale pour la matrice de covariance entre matchs
- Estimateurs du profil pour α, β, δ² conditionnellement à ρ, η²
- Corrélation exponentielle dans le temps : C_k,ij = ρ^{||τ_i - τ_j||}

### Modèle alternatif (équation 8.1.4)
Version avec soustraction des valeurs attendues : Λ_k ~ MVN(α_k 1_nk + (X_k - E(X_k))β, ...)
Permet de tenir compte de la performance relative aux attentes.

### Résultats
- Suit les cotes beaucoup mieux que le modèle bayésien (Ch. 7)
- Distribution des distances de Mahalanobis plus lourde que prévu dans les queues → besoin de travaux supplémentaires (distribution student-t, paramètres supplémentaires)
- Sépare clairement les matchs avec et sans grands swings in-play

---

## Chapitre 9 : Conclusions

### Contributions en modélisation tennis
1. **Preuve d'inversibilité** de m(λ|μ,s,b) (Ch. 3)
2. **Pondération des matchs 5 sets** dans Glicko (Ch. 4)
3. **Ratings corrélés par surface** proposés mais non implémentés

### Contributions en détection de match-fixing
1. **Méthode pré-match** (Ch. 6) : GP avec volumes, intervalles multiples — plus sophistiquée que la simple différence ouverture/fermeture
2. **Méthode in-play bayésienne** (Ch. 7) : premières de la littérature académique
3. **Méthode in-play GP** (Ch. 8) : meilleure performance, poolage de données inter-matchs

### Architecture recommandée pour un système de détection
- **Pré-match** : GP avec variance fonction du volume de paris — signaler les écarts entre cotes et prédictions Glicko
- **In-play** : GP sur le λ implicite avec covariables de jeux gagnés/perdus — signaler les écarts via distances de Mahalanobis
- **Système de drapeaux** : style SportRadar (vert/orange/rouge) avec seuils
- **Combinaison** : drapeau automatique si un marché dépasse un seuil haut, ou si les deux marchés (pré-match et in-play) atteignent un seuil modéré

### Limitations et travaux futurs
- Points par points (vs jeux) amélioreraient la mise à jour
- Prise en compte des surfaces
- Modélisation de la volatilité accrue en fin de match
- Distribution student-t pour les queues lourdes
- Classification formelle des matchs (nécessite des données de matchs truqués confirmés)
- Validation sur plus de matchs

---

## Synthèse : Variables et métriques trackées

| Variable | Description | Utilisation |
|----------|-------------|-------------|
| p_i | Probabilité que joueur i gagne un point sur son service | Chaîne de Markov de base |
| μ_ij = (p_ij + p_ji)/2 | Moyenne des probas de point | Paramètre de nuisance |
| λ_ij = (p_ij - p_ji)/2 | Paramètre de dominance | **Variable clé** modélisée in-play |
| ν_i | Rating Glicko moyen du joueur i | Prior pour les modèles |
| σ_i | Écart-type Glicko du joueur i | Incertitude du prior |
| k_i^(g)(τ) | Jeux gagnés par i au service | Covariable in-play |
| n_i^(g)(τ) - k_i^(g)(τ) | Jeux perdus par i au service | Covariable in-play |
| k_i^(t)(τ) | Tie-breaks gagnés par i | Covariable in-play |
| ω_k | "Juste valeur" des cotes pré-match | Paramètre cible du GP pré-match |
| y_k(τ) | logit(proba implicite) au temps τ | Observation modélisée |
| Y_k(τ) | logit(proba de victoire) au temps τ | Variable latente bayésienne |
| Overround | Somme(1/cotes) - 1 | Métrique de qualité du marché |
| Volume | Montant parié sur l'échange | Covariable (log(1+volume)) |
| ρ | Paramètre de corrélation temporelle | GP (courte distance = haute corrélation) |
| η² | Nugget effect | Bruit non-corrélé dans le GP |

---

## Architecture recommandée (synthèse)

```
┌─────────────────────────────────────────────────────────────┐
│                    SYSTÈME DE DÉTECTION                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────────┐    ┌──────────────────────────┐    │
│  │ MODULE PRÉ-MATCH    │    │ MODULE IN-PLAY           │    │
│  │ GP avec volume      │    │ GP sur λ implicite       │    │
│  │                     │    │                          │    │
│  │ - Cotes à t=0..T    │    │ - Covariables :          │    │
│  │ - log(1+volume)     │    │   jeux gagnés/perdus     │    │
│  │ - Prior Glicko      │    │ - Poolage inter-matchs   │    │
│  │ - p-values par match│    │ - Dist. Mahalanobis      │    │
│  └──────────┬──────────┘    └──────────────┬───────────┘    │
│             │                              │                │
│             └──────────┬───────────────────┘                │
│                        ▼                                    │
│              ┌──────────────────┐                            │
│              │  COMBINEUR       │                            │
│              │  - Seuils vert/  │                            │
│              │    orange/rouge  │                            │
│              │  - Alertes       │                            │
│              │    combinées     │                            │
│              └──────────────────┘                            │
└─────────────────────────────────────────────────────────────┘
```
