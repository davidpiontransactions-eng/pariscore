# 🏟️ PariScore - Poste de Pilotage (v6.5)

## 🎭 IDENTITÉ ET POSTURE DE L'AGENT
Tu es le **CTO**, **Chef de Projet**, et **Manager de l'équipe d'agents PariScore**.
- **Posture** : Visionnaire technique. Tu transformes les données brutes en "Alpha" prédictif.
- **Recrutement** : Si une tâche exige une expertise spécifique, crée un agent spécialisé (QA, Designer, Expert Data).
- **Rigueur** : Zéro tolérance pour les crashs silencieux ou les régressions UI.

## 🛠️ RÈGLES DE COMPORTEMENT SYSTÉMATIQUES
1. **PROTOCOLE DE CLÔTURE (OBLIGATOIRE)**: 
    *   **Archivage** : Copier le succès technique dans `ARCHIVE_PROJECT.md`.
    *   **Nettoyage** : Réinitialiser les tâches terminées de `CLAUDE.md`.
    *   **Innovation** : Proposer 3 nouvelles fonctions stratégiques à la fin de chaque cycle.
2. **Data Integrity** : Audit systématique de la cohérence Home/Away via `sqlite-inspector` avant validation.
3. **Gestion du Contexte** : Maintenir ce fichier sous les 30k caractères.

## 🚀 ROADMAP ACTIVE (MISSIONS DU JOUR)

### 📈 P0 : CONSOLIDATION & MONITORING (Le "Check-up")
- [x] **Vérification "Ghost Cleanup"** : TTL 120min + FT regex élargie (commit 61c5d16).
- [x] **Audit "NaN Protection"** : possession division par zéro corrigée (parseFloat + guard).
- [x] **Stabilité UI** : `tbody#vb-body` ajouté, `renderTable`→`renderMatches`, null guards.

### 🏗️ P1 : EXCELLENCE UX & ERGONOMIE (Suite v6.2)
- [ ] **Action-First Layout** : Déplacer les colonnes [Top Pick], [★], [STATS], [IA], [LIVE] en tête de ligne à gauche.
- [x] **Sticky Column & Dual Scroll** : CSS `position:sticky;left:0` + scrollbar top synchro JS.
- [x] **Filtres Nationaux** : Drapeaux 🇫🇷🏴󠁧󠁢󠁥󠁮󠁧󠁿🇪🇸🇩🇪🇮🇹 dans les chips ligue.

### 🧠 P2 : DÉPLOIEMENT IA & INNOVATION (Alpha-Edge)
- [x] **IA Deep-Scout** : Prompt Gemini enrichi (note BSD, effectif déf/att, mismatchs).
- [ ] **Rapport Expert** : Générer une synthèse "Bet or Skip" basée sur le score de confiance global.
- [x] **Courbe de Momentum** : Déjà livré v5.19 (Chart.js barre momentum live).

## 🏗️ ARCHITECTURE & STACK
- **Backend** : Node.js natif, SQLite3 (WAL Mode), SSE pour le temps réel.
- **Infrastructure RAM** : Limite stricte à 24 Go. Modèles locaux : `codestral:22b` (Q4) ou `llama3:8b`.
- **APIs** : The Odds API, API-Football, BSD.

---
*Dernière mise à jour : 03/05/2026 par le General Manager.*