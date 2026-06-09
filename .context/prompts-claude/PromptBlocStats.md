# 🏆 Audit & Spécifications : Hub de Statistiques "Elite" (Full Integration)

> **Objectif :** Déployer un modal d'analyse ultra-profond fusionnant données collectives, performances individuelles (joueurs) et intelligence prédictive (xG) pour offrir une alternative supérieure à OddAlerts et SofaScore.

---

## 1. LES 9 PILIERS DE DONNÉES DU MODAL "PARISCORE INSIGHTS"

### Pilier 1 : Général & Forme (Le Socle)
- **Classement & PPG (Points Per Game) :** L'indicateur de puissance brute.
- **W / D / L % :** Répartition des résultats sur la saison.
- **Série de Forme :** Badges visuels (W-D-L) des 5 derniers matchs.

### Pilier 2 : Offensive & Tirs (Le Danger)
- **AVG Shots & SOT (Shots On Target) :** Capacité à cadrer.
- **SOT Against :** Capacité à concéder des tirs (faiblesse défensive).

### Pilier 3 : Buts & BTTS (Le Marché)
- **AVG Goals Scored/Conceded :** Moyennes par match.
- **BTTS % (Both Teams To Score) :** Probabilité historique du marché "Les deux équipes marquent".
- **Clean Sheet % :** Capacité à garder sa cage inviolée.

### Pilier 4 : Corners & Set Pieces (Le Volume)
- **AVG Corners (Obtenus vs Concédés) :** Indicateur de pression offensive.
- **Projections :** Fréquence des Over 8.5 / 9.5 / 10.5 corners.
- **Race to 3/5/7 :** Capacité à obtenir les premiers corners du match.

### Pilier 5 : Discipline & Cartons (Le Risque)
- **Yellow / Red Cards (AVG) :** Agressivité et indiscipline.
- **Cards Provoked :** Capacité à faire craquer l'adversaire.

### Pilier 6 : Advanced Analytics (La Science)
- **xG (Expected Goals) :** Qualité réelle des occasions créées.
- **xGA (Expected Goals Against) :** Solidité réelle de la défense.
- **xG Differential :** Détection de sur-performance ou sous-performance.

### Pilier 7 : Top Players (L'Individuel)
- **Top Scorers & Assists :** Les 3 meilleurs buteurs et passeurs par équipe.
- **Team MVP :** Le joueur avec la meilleure note moyenne (Rating API-Football).
- **UX :** Mini-cartes avec photos des joueurs.

### Pilier 8 : Position Ratings (Force par Secteur)
- **Attack Rating (AVG) :** Moyenne des notes des attaquants.
- **Defense Rating (AVG) :** Moyenne des notes des défenseurs/gardiens.
- **Match-up :** Opposition visuelle "Attaque Team A vs Défense Team B".

### Pilier 9 : Standings Dynamiques (Le Filtre)
- **Modes :** Global / Home / Away.
- **Tri Multi-Critères :** Classer la ligue par Buts, Corners, Cartons ou xG.

---

## 2. ARCHITECTURE TECHNIQUE & MAPPING API

### Backend (`server.js`)
- [ ] **Data Fetching :** Centraliser les appels aux endpoints `/teams/statistics`, `/players/topscorers` et `/standings`.
- [ ] **Calculateur de Secteur :** Fonction pour calculer la moyenne des `rating` par position (G, D, M, A).
- [ ] **Mise en Cache :** Stocker ces stats détaillées pendant 24h pour ne pas saturer le quota API.

### Frontend (`pariscore.html`)
- [ ] **Interface Modal :** Design inspiré d'OddAlerts avec barres de comparaison horizontales Home (Bleu) vs Away (Gris/Rouge).
- [ ] **Navigation :** Menu d'onglets internes : `Résumé` | `Stats Équipe` | `Joueurs` | `Classement`.
- [ ] **Filtres "Pills" :** Boutons rapides pour switcher entre Domicile, Extérieur et Global.

---

## 3. PRÉREQUIS POUR CLAUDE CODE (PROMPT)

1. **Analyse de l'existant :** "Claude, analyse `auditstatscomplètes.md`. Tu dois implémenter le modal de détails de match le plus complet possible."
2. **Priorité visuelle :** "Utilise des barres de progression pour comparer chaque statistique entre l'équipe Home et Away. Inspire-toi de l'image `image_3efc13.png`."
3. **Logique Joueurs/Notes :** "Affiche les meilleurs buteurs/passeurs et calcule la note moyenne des secteurs Attaque et Défense pour chaque équipe."
4. **Système de Classement :** "Intègre un classement interactif dans le modal avec les filtres Home/Away/All et la possibilité de trier par corners et cartons."
5. **Data Fallback :** "Si une donnée est manquante (ex: xG non disponible pour une ligue mineure), n'affiche pas de message d'erreur, cache simplement la ligne."

---

## 4. DESIGN SYSTEM (MODAL)
- **Notes Joueurs :** Vert (> 7.2) | Orange (6.5 - 7.2) | Rouge (< 6.5).
- **Barres de Pression :** Utiliser la variable CSS `--blue` pour l'équipe à domicile.
- **Responsive :** Grille 2 colonnes sur Desktop, 1 colonne sur Mobile.