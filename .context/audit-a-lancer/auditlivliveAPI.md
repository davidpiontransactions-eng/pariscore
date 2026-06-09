# 🛠 Audit Technique Complémentaire : Flux & Data Sourcing (v1.0)

## 1. COMMENT LES GÉANTS RÉCUPÈRENT-ILS LA DONNÉE ?

### A. Le Modèle "Direct Feed" (SofaScore / Flashscore)
Ces sites ne dépendent pas d'une API tierce comme nous. Ils utilisent :
- **Low Latency Binary Feeds :** Ils reçoivent des flux binaires (ultra-légers) directement de serveurs situés à la source (stades).
- **WebSockets Persistants :** Une connexion ouverte 24/7 qui ne demande jamais de données, mais les "reçoit" au fil de l'eau.
- **Data Redundancy :** Ils croisent souvent 2 ou 3 sources (ex: Sportradar + Opta) pour corriger une erreur de score en moins de 2 secondes.

### B. Le Modèle "Aggregator" (OddAlerts / PariScore)
OddAlerts utilise des agrégateurs de qualité supérieure (type Sportmonks ou API-Sports Plan Enterprise).
- **Smart Refresh :** Ils augmentent la fréquence de rafraîchissement selon l'importance du match (un match de PL est rafraîchi toutes les 10s, un match de D2 thaïlandaise toutes les 60s).
- **Webhook Integration :** Au lieu de demander le score, ils configurent des Webhooks : c'est l'API qui "appelle" leur serveur dès qu'un but est marqué.

---

## 2. ARCHITECTURE DE RÉCUPÉRATION CIBLE POUR PARISCORE

Pour égaler la qualité d'un "très bon site live" sans dépenser 10 000€, Claude Code doit implémenter :

### 1. La Hiérarchie des Flux (Multi-Level Polling)
- **Niveau 1 (Actif) :** Matchs suivis par les utilisateurs ou "Top Leagues". Rafraîchissement toutes les 30s.
- **Niveau 2 (Passif) :** Autres matchs live. Rafraîchissement toutes les 120s.
- **Niveau 3 (Background) :** Résultats terminés. Mise à jour toutes les 15 min.

### 2. Le Diffing de Données (Optimisation Bande Passante)
Au lieu de renvoyer tout le JSON du match au client à chaque fois, le serveur doit calculer la **différence** (ex: "Seul le score a changé") et n'envoyer que ce petit fragment via le flux SSE.

### 3. Gestion de la Latence "Psychologique"
- Implémenter un "Optimistic UI" sur le frontend : si l'API est en retard de 5s, utiliser des micro-animations pour donner une impression de fluidité constante.

---

## 3. PRÉREQUIS POUR CLAUDE CODE (MODE LIVE API)
1. **Implémentation de `axios-retry` :** Les appels API en direct échouent parfois. Il faut un système de "retry" automatique pour ne pas perdre un but.
2. **Circuit Breaker :** Si l'API-Football tombe, le serveur doit basculer automatiquement sur des données "simulées" ou un message d'alerte propre pour éviter le crash du frontend.