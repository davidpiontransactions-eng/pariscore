# 📡 Audit Live Premium & Spécifications Techniques (v5.0)

> **Objectif :** Faire passer PariScore d'un outil pré-match à une plateforme de "Live Trading" inspirée des meilleurs standards du marché (OddAlerts, SofaScore, ScoreTrend).

---

## 1. BENCHMARKING : ANALYSE DES LEADERS DU LIVE

### A. OddAlerts & InPlayGuru (Alertes & Momentum)
- **Concept :** Détection de moments clés basés sur des filtres.
- **Leçon pour PariScore :** Implémenter des alertes visuelles quand un match entre dans une "Zone de Danger" (ex: > 1.5 attaques dangereuses/min).

### B. SofaScore & Flashscore (Visualisation & Rapidité)
- **Concept :** L'Attack Momentum® et le classement en direct.
- **Leçon pour PariScore :** Le score doit être l'élément central, mais le classement "Live" (mis à jour selon le score actuel) est indispensable pour la rétention utilisateur.

### C. ScoreTrend & FootyStats (Pression & Projections)
- **Concept :** L'indice de pression (0-100) et les prédictions de fin de match.
- **Leçon pour PariScore :** Créer un `LiveIntensityScore` qui combine possession, tirs et corners pour identifier les équipes qui "poussent" pour marquer.

---

## 2. ARCHITECTURE TECHNIQUE "LEAN LIVE" (MODÈLE ÉCONOMIQUE)

Pour maintenir un budget < 20€/mois avec API-Football (Plan Pro - 7500 req/jour) :

- **Smart Polling Centralisé :** Le serveur interroge `fixtures?live=all` toutes les 60 secondes en période de match.
- **Diffusion via SSE (Server-Sent Events) :** Utilisation d'un flux `text/event-stream` natif en Node.js pour pousser les scores vers les clients sans WebSockets lourds.
- **Optimisation de Quota :** - Données "Score/Minute" : 1 appel/min global.
    - Données "Stats détaillées" (Corners/Tirs) : Uniquement à la demande (clic utilisateur) pour économiser les appels.

---

## 3. LOGIQUE "PRE-LIVE" (À IMPLÉMENTER PAR CLAUDE CODE)

### A. Backend (`server.js`)
- [ ] **Gestionnaire de Flux SSE :** Créer la route `/api/stream-live` pour diffuser les mises à jour en temps réel.
- [ ] **Calculateur d'Intensité :** Créer la fonction `calculateLiveIntensity(stats)` basée sur : `((Attaques_Dangereuses * 2) + Tirs_Cadrés + Corners) / Temps_Écoulé`.
- [ ] **Gestion des Red Cards :** Détecter immédiatement les cartons rouges, car ils doivent déclencher une alerte visuelle et un recalcul du Power Score IA.

### B. Frontend (`pariscore.html`)
- [ ] **Système de Tri Prioritaire :** Placer automatiquement les matchs avec les status `1H`, `HT`, `2H`, `ET`, `P` tout en haut du tableau.
- [ ] **Composants Dynamiques :**
    - **Live Dot :** Pastille rouge clignotante avec le temps écoulé (`status.elapsed`).
    - **Flash Alert :** Animation CSS (brillance verte) sur le score lors d'un but.
    - **Barre de Pression :** Mini-barre de progression (0-100) affichant le `LiveIntensityScore`.

---

## 4. IMPACT SUR LE POWERSCORE IA (GEMINI)

Le PowerScore doit devenir hybride :
1. **Poids Pré-Match (40%) :** Basé sur l'historique et le modèle de Poisson.
2. **Poids Live (60%) :** Basé sur la domination réelle (Tirs, Possession, Pression).
- **Alerte Value Bet :** Si `LiveIntensity > 80` et `Score == 0-0` après la 20e min -> Notification "High Value Goal Opportunity".

---

## 🛠 INSTRUCTIONS POUR CLAUDE CODE
1. Analyse ce fichier pour comprendre la vision "Live" de PariScore.
2. Prépare la structure de données dans `server.js` pour accueillir les stats live (corners, attaques).
3. Modifie le composant de rendu des matchs pour qu'il gère les status live et affiche la minute du match de façon dynamique.