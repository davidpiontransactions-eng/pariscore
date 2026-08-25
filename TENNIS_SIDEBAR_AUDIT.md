# Audit Complet du Sidebar Tennis - PariScore

## Vue d'ensemble
Cette audit examine en détail le fonctionnement du sidebar tennis dans l'application PariScore, couvrant le flux de données, le traitement, l'affichage et l'interaction utilisateur.

## 1. Flux de Données

### 1.1 Sources de données
Le sidebar tennis récupère les données depuis deux endpoints API :
- `/api/tennis/live` : Matchs en direct (via `fetchBSDLiveMatches`)
- `/api/tennis/prematch` : Matchs prématch (via `fetchBSDMatches` ou `fetchRealMatches` avec fallback sur données mock)

### 1.2 Chargement des données
La fonction `loadTennis()` dans `src/hooks/use-sports-tree.ts` :
- Utilise `Promise.all()` pour charger les deux endpoints en parallèle
- Applique un `.catch(() => ({ matches: [] }))` à chaque endpoint pour gérer les erreurs
- Combine les résultats avant traitement
- Retourne un nœud dégradé si les deux endpoints échouent

### 1.3 Traitement des données
Les données brutes passent par :
1. `tennisToRaw()` : Conversion vers le format intermédiaire `RawTreeMatch`
2. `groupRawMatches()` : Groupement sport → pays → ligue → matchs

## 2. Traitement des Données Tennis

### 2.1 Fonction tennisToRaw()
Localisation : `src/lib/sports-tree.ts`

**Fonctionnalités actuelles :**
- Conversion des objets `MinimalTennisMatch` vers `RawTreeMatch`
- Filtrage robuste des matchs avec noms de joueurs valides (non-null, non-undefined, non-vides)
- Extraction des propriétés essentielles :
  - Identification (id)
  - Noms des joueurs (homeName, awayName)
  - Horaire (scheduledAt)
  - Statut live (isLive - actuellement hardcodé à false)
  - Informations de tournoi/ligue
  - Code pays

**Problèmes identifiés :**
1. **isLive hardcodé à false** : Tous les matchs tennis sont marqués comme non-directs, ce qui affecte l'affichage (heure au lieu indicateur live) et le comptage des matchs live
2. **Pas de traitement des cotes/probabilités spécifiques au tennis** : Le tennis utilise un format de cotes différent (généralement décimal pour un vainqueur) plutôt que le format 1X2 utilisé pour le football

### 2.2 Fonction groupRawMatches()
Localisation : `src/lib/sports-tree.ts`

**Fonctionnalités actuelles :**
- Groupement par pays puis par ligue
- Comptage des matchs live et total
- Sélection des matchs de niveau 4 (jusqu'à 8 matchs par ligue)
- Calcul du edge moyen par ligue

**Problèmes identifiés :**
1. **Calcul d'edge basé sur le format 1X2** : La fonction `best1x2Edge()` attend des cotes au format 1X2 (domaine/nul/extérieur), mais le tennis utilise généralement des cotes décimales simples (joueur A/joueur B)
2. **Pas de prise en compte des spécificités tennis** : Surface du tournoi, tournoi du Grand Slam, etc. ne sont pas utilisées dans le regroupement ou l'affichage

## 3. Affichage dans le Sidebar

### 3.1 Structure de rendu
Le sidebar utilise une structure hiérarchique :
- `SportBlock` → Sport (tennis)
  - `CountryBlock` → Pays 
    - `LeagueRow` → Ligue (tournoi)
      - `MatchRow` → Match

### 3.2 Composants spécifiques

#### SportBlock (tennis)
- Affiche l'icône du sport (Activity pour tennis)
- Montre le nombre de matchs live et total
- Gère l'expansion/réduction

#### CountryBlock
- Affiche le drapeau du pays
- Montre le nombre de ligues et de matchs
- Gère l'expansion/réduction

#### LeagueRow (tournoi)
- Affiche le nom du tournoi/ligue
- Montre l'edge (calculé incorrectement pour le tennis)
- Affiche le compteur de matchs
- Gère l'expansion/réduction pour voir les matchs

#### MatchRow (match individuel)
- Affiche l'indicateur live (pulsation rouge) ou l'heure de début
- Bouton de sélection du match (avec coche ✓)
- Affichage des cotes (quand disponibles)
- Gestion du clic pour ouvrir les détails du match

**Problèmes identifiés :**
1. **Indicateur live incorrect** : Puisque `isLive` est hardcodé à false dans `tennisToRaw()`, tous les matchs montrent l'heure plutôt que l'indicateur live pulsant
2. **Format des cotes inadapté** : L'affichage attend des cotes 1X2 (1/X/2) mais le tennis utilise des cotes simples (victoire A/B)
3. **Manque d'informations tennis spécifiques** : Aucune affiche de surface du tournoi, catégorie du tournoi (Grand Slam, Masters 1000, etc.), ou tour du tournoi

## 4. Interaction Utilisateur

### 4.1 Sélection de match
- Clic sur le nom du match : 
  - Met à jour l'état de sélection dans le store (`toggleSelection`)
  - Ouvre le dialog de détails via événement personnalisé `open-match-detail`
- Clic sur les cotes :
  - Ouvre directement le dialog de détails avec le marché spécifique

### 4.2 Filtrage et tri
- Le sidebar respecte les filtres globaux (heure, recherche)
- Pas de tri spécifique au tennis dans le sidebar (tri par défaut : live d'abord, puis par horaire)

**Problèmes identifiés :**
1. **Pas de tri tennis-specific** : Aucune option pour trier par surface, catégorie de tournoi, ou autre critère pertinent pour le tennis
2. **Feedback visuel limité** : Peu d'indicateurs visuels spécifiques au tennis (surface, prestige du tournoi, etc.)

## 5. Performance et Gestion d'Erreurs

### 5.1 Chargement des données
- Utilisation de `useSWR` avec revalidation toutes les 5 minutes
- Gestion d'erreurs individuelle pour chaque endpoint (live/prematch)
- Retour de nœud dégradé en cas d'échec total

### 5.2 Traitement
- Fonctions pures sans effets de bord
- Utilisation efficace de `map`/`filter`
- Mémoisation appropriée dans les composants React

**Points forts :**
- Bonne gestion des erreurs avec fallback sur données vides plutôt que sur échec complet
- Chargement parallèle des endpoints live et prematch
- Utilisation de SWR pour le caching et la revalidation

## 6. Conformité avec les Standards

### 6.1 Accessibilité
- Attributs ARIA appropriés (aria-expanded, aria-label)
- Navigation au clavier supportée
- Contraste des couleurs respecté (dans les limites du thème sombre)

### 6.2 Réactivité
- Fonctionne en mode aside (desktop) et drawer (mobile)
- Adaptation correcte selon la taille d'écran

## Recommandations d'Amélioration

### 6.1 Corrections Immédiates (Haute Priorité)
1. **Corriger isLive pour le tennis** : Déterminer dynamiquement le statut live plutôt que de le hardcoder à false
2. **Adapter l'affichage des cotes pour le tennis** : Modifier `MatchRow` pour afficher correctement les cotes décimales tennis
3. **Calculer l'edge approprié pour le tennis** : Remplacer `best1x2Edge()` par une fonction adaptée aux cotes décimales simples

### 6.2 Améliorations (Priorité Moyenne)
1. **Ajouter des informations tennis spécifiques** :
   - Afficher la surface du tournoi (dur, terre battue, gazon)
   - Indiquer la catégorie du tournoi (Grand Slam, Masters 1000, etc.)
   - Montrer le tour du tournoi pour les matchs prématch
2. **Optimiser le tri et le filtrage** :
   - Ajouter des options de tri tennis-specific (par surface, prestige, etc.)
   - Permettre le filtrage par surface de jeu
3. **Améliorer l'expérience visuelle** :
   - Utiliser des icônes spécifiques pour différents types de tournois
   - Ajouter des indicateurs de prestige pour les tournois majeurs

### 6.3 Innovations (Brainstorming)
1. **Vue "Road to Finals"** : Afficher le parcours potentiel d'un joueur vers la finale basé sur le tableau
2. **Statistiques de surface en temps réel** : Montrer le pourcentage de victoires sur la surface actuelle pour chaque joueur
3. **Alertes de valeur personnalisées** : Permettre aux utilisateurs de définir leurs propres critères de "value bet" pour le tennis
4. **Intégration des données historiques** : Montrer les enfrentements directs (H2H) directement dans le sidebar pour les matchs pertinents
5. **Prédictions de surface** : Afficher comment les joueurs performent généralement sur la surface du tournoi actuel
6. **Mode "Expert"** : Option pour afficher des statistiques avancées comme les points gagnés sur deuxième service, pourcentage de break conservé, etc.
7. **Intégration météo** : Pour les tournois en extérieur, montrer comment les conditions météorologiques pourraient affecter le match
8. **Visualisation du tableau** : Mode compact montrant l'avancement dans le tournoi avec les matchs à venir
9. **Comparaison de styles de jeu** : Indicateur basé sur les statistiques montrant si le match est un contraste de styles (agressif vs défensif)
10. **Historique des performances récentes** : Graphique sparkle montrant la forme récente (5 derniers matchs) de chaque joueur

## 7. Traçabilité et Tests

### 7.1 Tests recommandés
1. Tests unitaires pour `tennisToRaw()` couvrant :
   - Matchs avec noms de joueurs valides
   - Matchs avec noms de joueurs null/undefined/vides
   - Matchs live vs prématch
   - Données manquantes ou malformées
2. Tests d'intégration pour le chargement des données tennis
3. Tests de rendu pour vérifier l'affichage correct des différents états (live/prématch, avec/sans cotes, etc.)
4. Tests d'accessibilité (contraste, navigation au clavier)

### 7.2 Suivi des changements
- Ce document sert de référence pour l'audit initial
- Les améliorations devraient être documentées dans des issues de suivi
- Les tests devraient être ajoutés couvrant les fonctionnalités modifiées