# Plan : Corners Tab Overhaul v12.72

**Date** : 2026-06-10  
**Version** : v12.72  
**Porteur** : CTO/Lead Data Scientist  
**Type** : Refonte technique + Design  

---

## 1. Audit Backend — Résultats

L'audit complet du backend pour le module Corners a été réalisé via le sous-agent gsd-code-fixer. Voici les conclusions détaillées :

### 1.1 fetchBSDTeamCornerHistory — AUCUNE ANOMALIE

La fonction fetchBSDTeamCornerHistory ne présente aucun bug. Elle interroge correctement l'historique des coins via l'API BSD et retourne les données attendues. Aucune correction n'est nécessaire sur cette fonction.

### 1.2 predictCorners — Simplification acceptable

La fonction predictCorners utilise une logique de simplification qui a été jugée acceptable par l'audit. Ce n'est pas un bug mais une approche de calcul qui simplifie certains seuils. Le comportement actuel est conforme aux attentes fonctionnelles.

### 1.3 handleCornersRoute — AUCUNE ANOMALIE

Le routeur qui gère les requêtes GET /api/v1/corners/:matchId fonctionne correctement. Il assemble les données de prédiction et les retourne au format JSON attendu par le frontend.

### 1.4 Conclusion Audit Backend

L'audit backend n'a révélé aucun bug bloquant. Le code existant est sain et ne nécessite pas de correction. Cependant, une amélioration significative a été identifiée : l'intégration des cotes (Odds) depuis l'API BSD.

---

## 2. Intégration Odds BSD

### 2.1 Problème identifié

Le système de prédiction de corners actuel ne dispose pas des cotes bookmakers pour les seuils de coins. Ces informations sont disponibles via l'API BSD mais n'ont pas été intégrées dans le endpoint /api/v1/corners/:matchId.

### 2.2 Solution : Nouvelle fonction fetchBSDCornerOdds

Une nouvelle fonction fetchBSDCornerOdds(bsdEventId) doit être créée pour récupérer les cotes corners depuis l'API BSD. Cette fonction viendra enrichir les données de prédiction retournées au frontend.

### 2.3 Stratégie de fallback

Lorsque les cotes BSD ne sont pas disponibles pour un événement donné, le système utilisera une "Cote Théorique IA" calculée à partir de la probabilité prédite. La formule de fallback est la suivante :

```
decimal_odds = 1 / (probability / 100)
```

Cette approche garantit que le frontend recevra toujours des données de cotes, même en l'absence de données bookmakers pour certains matches.

### 2.4 Intégration dans handleCornersRoute

La fonction fetchBSDCornerOdds sera appelée depuis handleCornersRoute pour enrichir l'objet pred.odds. Les cotes seront incluses pour chaque seuil de coins (6.5, 7.5, 8.5, 9.5, 10.5).

---

## 3. Restructuration Frontend

### 3.1 Modification de buildCornersTab

La fonction buildCornersTab dans pariscore.js doit être modifiée pour intégrer l'affichage de la colonne Odds. Cette restructuration concerne l'interface utilisateur qui affiche les recommandations de paris corners.

### 3.2 Structure visuelle de la carte recommendation

La carte de recommandation pour chaque seuil de coins doit afficher les éléments suivants dans l'ordre :

1. **Label Over** : Le libellé du seuil (ex : "Over 7.5 Corners")
2. **Barre de progression** : La barre visuelle indiquant la confiance de la prédiction
3. **Badge Odds en orange** : Le badge affichant la cote décimale avec un fond orange
4. **Pourcentage** : Le pourcentage de confiance de la prédiction

### 3.3 Logique du badge odds

Le badge des odds est optionnel. Il ne doit être affiché que lorsque les données de cotes sont disponibles. Si aucune donnée n'est disponible pour un match donné, le badge ne doit pas être affiché afin d'éviter d'afficher des valeurs nulles ou incorrectes.

### 3.4 Structure de données pred.odds

L'objet pred.odds contiendra les cotes pour chaque seuil de coins. Les seuils supportés sont : 6.5, 7.5, 8.5, 9.5, et 10.5 corners. Chaque seuil aura sa propre cote décimale ou sa valeur de fallback.

---

## 4. Design CSS Dark

### 4.1 Problème identifié

L'audit CSS a révélé que les classes .cr-rec-card utilisaient un fond blanc (#ffffff puis #f0f4f8) ce qui détruisait complètement la charte graphique sombre du projet PariScore. Cette incohérence visuelle était particulièrement visible sur les cartes de recommandations corners.

### 4.2 Nouvelle palette dark immersive

Le redesign CSS vise à créer une expérience dark immersive cohérente avec le reste de l'application. Les modifications apportées sont les suivantes :

Pour la classe .cr-rec-card, le fond passe de #ffffff et #f0f4f8 à un dégradé linéaire profond :

```
background: linear-gradient(145deg, #1a2548, #111a36)
```

Pour la classe .cr-rec-yes qui indique une recommandation positive, le fond passe de #f0fdf4 à #0f2d1f pour maintenir le contraste dans la palette sombre.

### 4.3 Badge Odds — Nouveau style

Le badge des cotes est un nouvel élément visuel qui nécessite un style dédié. Il utilise un fond semi-transparent orange et une couleur de texte orange :

```
corner-odds-badge {
    background: rgba(245, 158, 11, 0.12)
    color: #f59e0b
}
```

Ce style garantit que le badge des odds ressort visuellement tout en restant cohérent avec la palette sombre de l'application.

---

## 5. Historique DB — Solution ETL

### 5.1 Constat initial

L'audit a révélé qu'aucune source de données corners sur 3 saisons n'existe actuellement dans le système. Cette lacune est critique car la fonctionnalité de prédiction nécessite un historique complet pour fonctionner correctement.

### 5.2 Solution : Script ETL seed_historique_bsd_corners.js

La solution retenue consiste à créer un nouveau script ETL nommé seed_historique_bsd_corners.js. Ce script aura pour responsabilité d'extraire les données historiques de corners depuis l'API BSD et de les charger dans la base de données locale.

### 5.3 Structure de la table SQLite

Une nouvelle table SQLite nommée corner_history doit être créée dans server.js pour stocker les données historiques de corners. Cette table contiendra les informations suivantes :

- Identifiant du match
- Identifiant de l'équipe
- Date du match
- Nombre de corners marqués
- Autres métadonnées pertinentes

### 5.4 Modification de fetchBSDTeamCornerHistory

La fonction fetchBSDTeamCornerHistory doit être modifiée pour utiliser les données locales de la table corner_history plutôt que d'interroger systématiquement l'API BSD. Cela permettra d'améliorer les performances et de réduire la dépendance à l'API externe pour les données historiques.

---

## 6. Fichiers modifiés

La liste complète des fichiers à modifier pour cette refonte :

| Fichier | Modification |
|---------|--------------|
| server.js | Création table corner_history, ajout fetchBSDCornerOdds, modification fetchBSDTeamCornerHistory |
| pariscore.js | Modification buildCornersTab pour colonne Odds |
| styles CSS | Refonte complète des classes .cr-* pour design dark |
| seed_historique_bsd_corners.js | Nouveau fichier ETL pour charger historique 3 saisons |
| CLAUDE.md | Mise à jour roadmap v12.72 |

---

## 7. Risques et dépendances

### 7.1 Risques identifiés

**Risque 1** : Disponibilité des données BSD  
Les cotes corners via l'API BSD peuvent ne pas être disponibles pour tous les matches, notamment pour les ligues mineures. Mitigation : le fallback vers la cote théorique IA est déjà prévu.

**Risque 2** : Performance du script ETL  
Le chargement de 3 saisons de données corners peut prendre un temps significatif. Mitigation : implémenter un système de chunk processing pour éviter les timeout.

**Risque 3** : Migration des données existantes  
La création de la nouvelle table corner_history nécessite une migration des données. Mitigation : tester la migration sur un environnement de staging avant production.

### 7.2 Dépendances externes

- API BSD : doit être fonctionnelle pour récupérer les cotes et l'historique
- Accès base SQLite : pour la création de la table corner_history
- Disponibilité du serveur : pour les tests d'intégration

### 7.3 Points de validation

1. Valider que fetchBSDCornerOdds retourne des données correctes pour un match test
2. Valider que le fallback vers cote théorique fonctionne quand BSD retourne null
3. Valider que le design dark est cohérent avec le reste de l'application
4. Valider que le script ETL charge correctement 3 saisons de données