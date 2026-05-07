# 🏟️ PariScore - Poste de Pilotage (v9.7 Live Danger Matrix)

> **⚡ SESSION INIT** : Lire et appliquer `.clauderules` en début de chaque session — règles de code, sécurité, cascade IA et git workflow obligatoires.

## 🎭 IDENTITÉ ET POSTURE DE L'AGENT
Tu es le **CTO & Lead Data Scientist (Quant)** de PariScore.
- **Posture** : Expert en modélisation mathématique et en algorithmique prédictive. Tu ne crois qu'aux statistiques dévigées et aux modèles calibrés.
- **Rigueur Scientifique** : Aucun modèle n'est mis en production sans calcul d'Intervalle de Confiance (UQD). 
- **Recrutement** : Si l'architecture requiert une expertise en Machine Learning ou en scraping temps réel complexe, déploie un agent dédié.

## 🛠️ RÈGLES DE COMPORTEMENT SYSTÉMATIQUES
1. **PROTOCOLE DE CLÔTURE (OBLIGATOIRE)** :
    *   **Archivage** : Transférer les algorithmes validés et les résultats de backtest dans `ARCHIVE_PROJECT.md`.
    *   **Nettoyage** : Purger `CLAUDE.md` pour maintenir l'efficacité.
    *   **Innovation** : Proposer 3 nouvelles pistes d'optimisation de l'Edge.
2. **Performance Backend** : Les calculs bayésiens et les itérations Bootstrap ne doivent pas bloquer le thread principal de Node.js (utiliser des Workers ou optimiser la complexité temporelle).

## 🚀 ROADMAP QUANTITATIVE (SESSION EN COURS)

### ✅ v7.1 — FIX CRITIQUES (COMPLÉTÉ)
- [x] **Init Boot Gate** : `bootInit()` IIFE + `serverReady` flag → API bloquée 503 tant que données non prêtes.
- [x] **Loading Black Hole** : `server.listen()` démarre immédiatement. `bootInit()` background + timeout 30s. Fallback cache SQLite si API échoue. SSE `system_ready` émis.
- [x] **Ghost Cleanup** : Double purge FT/AET/PEN + elapsed>120m avec SSE push.
- [x] **Forme L5 Asymétrique** : `getForm()` 3 niveaux (direct → fuzzy → prefix fallback) pour les 2 équipes.
- [x] **Crash Guards** : NaN guard possession + null-check tbody#vb-body.
- [x] **Filtres Kickoff** : [Tous], [<30min], [<1h], [<2h], [<6h], [<12h] en minutes.
- [x] **Filtres Pays→Ligues** : Navigation hiérarchique Oddalerts style. Pays → ligues + "🔙 Retour". 25 pays.
- [x] **Dual Scrollbar** : `#top-scrollbar` + `#top-scroll-content`. Sync bidirectionnelle `scrollLeft` + width update.
- [x] **Frontend Retry** : 503 → retry 2s. SSE `system_ready` → force reload. Erreur réseau → retry auto.

### ✅ v9.7 — LIVE DANGER MATRIX (COMPLÉTÉ)
- [x] **Suppression Événements** : Panneau "Événements" (textuel, instable) supprimé HTML/CSS/JS.
- [x] **Danger Matrix** : Grille 2x2 — Tirs Cadrés, Corners, Attaques Dang., Possession.
- [x] **Barres Comparatives** : Progress bars Domicile (vert) vs Extérieur (violet).
- [x] **Backend Cleanup** : `incidents` retiré des réponses BSD + API-Football live.

### ✅ v9.6 — BULLETPROOF BODY LOCK (COMPLÉTÉ)
- [x] **Body Lock** : `position: fixed` + `top: -scrollY` — physiquement impossible de scroller.
- [x] **Body Unlock** : Restauration exacte de la position du scroll à la fermeture.
- [x] **Scroll Tracking** : `window.addEventListener('scroll', ...)` met à jour `--scroll-y`.
- [x] **Anti-CLS** : Chart containers `min-height:300px; height:300px; position:relative`.
- [x] **Canvas Absolute** : Canvas en `position:absolute` avec dimensions calculées.

### ✅ v9.5 — NAVIGATION FIX (COMPLÉTÉ)
- [x] **Root Cause** : Double déclaration `let ldXGChart` → SyntaxError → crash script → menu non cliquable.
- [x] **Mur de Verre** : `closeLiveDetail` force `pointer-events: none` + timeout restaurateur.
- [x] **Isolation Events** : `e.preventDefault()` dans try/catch séparé, ne remonte pas au menu.
- [x] **Crash Guards** : Try/catch sur openLiveDetail, closeLiveDetail, et render fallback.

### ✅ v9.4 — LIVE TRACKER 2.0 (COMPLÉTÉ)
- [x] **Anti-Scroll** : `e.preventDefault()` + `e.stopPropagation()` sur tous les clics Live.
- [x] **Body Lock** : `document.body.style.overflow = 'hidden'` à l'ouverture, restauré à la fermeture.
- [x] **Theater Mode** : Glassmorphism (`backdrop-filter: blur(8px)`) + animation fade & slide up.
- [x] **Pulse-danger** : Bouton LIVE pulse rouge si intensity > 25.
- [x] **Pressure Index** : Jauge dynamique 0-100 (momentum + tirs + xG bias + possession).
- [x] **Live Edge** : Détection value bet en live — alerte visuelle si edge > 10%.
- [x] **Memory Management** : `chart.destroy()` + `clearInterval()` à la fermeture.
- [x] **Polling Adaptatif** : 15s (75'+), 30s (2ème MT), 60s (1ère MT).
- [x] **Chart.js Focus Fix** : `animation: {duration:300}` + `events` limités pour éviter scroll.

### ✅ v9.2 — DEEP MAPPING FIX (COMPLÉTÉ)
- [x] **Root Cause** : `buildSideStats` extrayait l'objet `goals.for` au lieu du nombre → NaN.
- [x] **Dual Format** : `extractGoals()` gère API-Football (imbriqué) ET BSD (plat).
- [x] **Schema Validation** : `validateMatchIntegrity` vérifie types (`typeof !== 'number'`).
- [x] **Debug Logging** : `[DATA MAPPING]` logs pour tracer l'extraction.
- [x] **Migration** : `fix-matches.js` patch les records existants + fuzzy matching amélioré.
- [x] **Vérification** : Lille 1.59/1.09, Le Havre 0.94/1.34, Midtjylland 2/0.75.

### ✅ v9.1 — CRASH SYSTEM FIX (COMPLÉTÉ)
- [x] **Anti-Crash** : `unhandledRejection` + `uncaughtException` handlers → server ne crashe plus.
- [x] **ID Validation** : Toutes les routes vérifient `!id || 'undefined' || 'null'` avant fetch.
- [x] **Promise.allSettled** : Insights route (8 fetches) + deep-stats (ratings/squad) résilients.
- [x] **Purge SIM** : Badge "SIM" → "PRE", message classement corrigé.
- [x] **UI Lockdown** : Plus de "999h"/"Calcul en cours..." — spinner bloquant jusqu'à données valides.
- [x] **Error UI** : Après 3 retries → message propre "fournisseurs indisponibles".

### ✅ v9.0 — INTÉGRITÉ DES DONNÉES (COMPLÉTÉ)
- [x] **Validation Contenu** : `validateMatchIntegrity()` — NE JAMAIS marquer FULL si stats/ratings à 0.
- [x] **Statut FAILED_INTEGRITY** : Matchs incomplets reprogrammés automatiquement (retry 60s).
- [x] **Fatigue Fallback** : `computeFatigueIndex` scan `archive_matches` si 999h (pas de match récent).
- [x] **Anti-Zero Poisson** : Calcul bloqué si expHome=0 ET expAway=0 → erreur explicite.
- [x] **UI Integrity Check** : `openInsights()` reste sur loader + POST `/api/v1/force-hydrate` si stats à 0.
- [x] **999h UI Fix** : Remplacé par "Calcul en cours..." au lieu de "999h".
- [x] **Route Force-Hydrate** : `POST /api/v1/force-hydrate/:id` avec re-validation intégrité.
- [x] **Test Script** : `test-integrity.js` — audit FULL matchs, repasse en PENDING si stats à 0.

### ✅ v8.9 — HYDRATATION TOTALE (COMPLÉTÉ)
- [x] **Route Deep-Stats** : `/api/v1/deep-stats/:id` Full-or-Nothing — bloque jusqu'à données complètes.
- [x] **isMatchReady()** : Validation ratings + squad + poisson avant réponse.
- [x] **Historical Fallback** : `getHistoricalAvgGoals()` scan 5 derniers matchs terminés → fini les stats à 0.
- [x] **Loader Progressif** : Frontend 45s timeout avec barre de progression visuelle.
- [x] **Rendu Garanti** : Render QUE si stats non nulles (avgScored > 0 OU poisson.over25 > 0).

### 🧠 P0 : BAYESIAN VALUE RADAR (Le Cœur du Réacteur)
- [ ] **Data Blending** : Implémenter le `Bayesian Model Blender` fusionnant Poisson Bivarié, Elo dynamique et xG Logistic.
- [ ] **Calibration** : Écrire le script de calibration sur l'historique des 500 matchs (fiabilisation des probabilités extrêmes).
- [x] **Dévigage (Devigging)** : Shin-Hurley déjà implémenté dans `devig1X2()`.
- [x] **UI EV%** : Colonne EV déjà présente dans le tableau.

### ⚡ P1 : CONFIDENCE SCORE & UQD (Uncertainty Quantification)
- [ ] **Bootstrap UQD** : Mettre en place 500 itérations Bootstrap pour calculer l'Intervalle de Confiance (IC 90%) sur chaque match.
- [ ] **Score Composite** : Calculer un score de fiabilité sur 100 (Volume Data + Stabilité xG + Calibration).
- [ ] **Règle de Décision Stricte** : Modifier le Rapport Expert pour n'afficher "BET" que si EV > 5% ET borne inférieure IC > 0.

### 🎯 P2 : CONTEXT-ADJUSTED LIVE SNIPER
- [ ] **Poisson Time-Inhomogène** : Remplacer le Poisson statique du Live par un modèle conditionnel se réajustant minute par minute.
- [ ] **Context Engine** : Connecter des flux de données secondaires (Météo, Arbitres, Kilométrage) pour ajuster le xG dynamique.
- [ ] **Alertes SSE** : Créer des triggers "favorite_trap" et "goal_flood" pour envoyer des notifications push au front-end.

## 🏗️ ARCHITECTURE & STACK (Data Science)
- **Backend** : Node.js (Vanilla), SQLite3, SSE.
- **Math Engine** : Fonctions d'algèbre et de probabilité optimisées en JS natif.
- **Limites** : Attention à l'usage de la RAM lors des 500 itérations Bootstrap (optimisation mémoire exigée).

---
*Dernière mise à jour : Version 9.7 — Live Danger Matrix (Événements supprimés + Grille métriques brutes).*


<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:ca08a54f -->
## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files

## Session Completion

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   bd dolt push
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds
<!-- END BEADS INTEGRATION -->
