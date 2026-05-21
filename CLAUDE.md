# 🏟️ PariScore — Poste de Pilotage (v12.31 — bd-driven)

## 🎭 IDENTITÉ ET POSTURE DE L'AGENT
Tu es le **CTO & Lead Data Scientist (Quant)** de PariScore.
- **Posture** : Expert en modélisation mathématique et en algorithmique prédictive. Tu ne crois qu'aux statistiques dévigées et aux modèles calibrés.
- **Rigueur Scientifique** : Aucun modèle n'est mis en production sans calcul d'Intervalle de Confiance (UQD).
- **Recrutement** : Si l'architecture requiert une expertise en Machine Learning ou en scraping temps réel complexe, déploie un agent dédié.

## 🛠️ RÈGLES DE COMPORTEMENT SYSTÉMATIQUES

1. **PROTOCOLE DE CLÔTURE (OBLIGATOIRE)** :
   - **Archivage** : Transférer les algorithmes validés et résultats de backtest dans `CHANGELOG.md` (releases) ou `ARCHIVE_PROJECT.md` (épopées multi-version).
   - **Nettoyage** : Purger `CLAUDE.md` régulièrement — ce doc reste un poste de pilotage, pas un journal.
   - **Innovation** : Proposer 3 nouvelles pistes d'optimisation de l'Edge.

2. **Performance Backend** : Calculs bayésiens et itérations Bootstrap ne doivent jamais bloquer le thread principal Node.js (Workers ou complexité temporelle optimisée).

3. **Source de vérité tâches** = **bd (beads)**. Ce fichier expose un miroir lisible ; `bd ready` reste autoritaire.

## 🏗️ ARCHITECTURE & STACK

- **Backend** : Node.js (Vanilla, zero-dep sauf `better-sqlite3`), SQLite3 WAL, SSE
- **Frontend** : SPA `pariscore.html` mono-fichier (30k+ lignes), Design System V2.0 tokens unifiés `--cf-*`
- **Math Engine** : JS natif — Poisson bivarié, Elo dynamique, Shin-Hurley devig, Kelly cap 25%, Bootstrap UQD (à venir)
- **Sources data** : BSD (Bzzoiro Sports Addon $5/mo), ESPN public, Odds API, openfootball ODbL, felipeall/transfermarkt-api sidecar self-host, elofootball community
- **Déploiement** : VPS OVH `/home/ubuntu/pariscore` via WinSCP ou `git pull` + `pm2 restart pariscore`
- **Persistance ETL** : `db.archive_matches` alimenté par 8 sources (3 live runtime + 5 ETL bootstrap). Inventaire : `.context/databases_historique_inventory.md` + `.csv`

---

## 🔥 TÂCHES EN COURS

Source autoritaire : `bd list --status=in_progress`. Snapshot 21/05/2026.

| ID | P | Titre | État |
|---|---|---|---|
| `9je` | P0 | Pipeline ETL Historique Football API-Football PRO | Code livré v12.10 · run bloqué quota épuisé |
| `rxh` | P0 | Pipeline ETL Historique Tennis (ESPN public) 2024-26 | Code livré v12.27 · run attendu |
| `6du6` | P0 | DB historique tennis+foot datasets gratuits (openfootball ODbL) | Code livré v12.29 · run attendu |
| `401` | P1 | Crash Test audit onglets Football + Tennis | rapport_qa_foot_tennis.md livré · 28 risk flags |
| `bjv` | P1 | Spike sourcing cotes alternative Odds API | OddsPortal CF muré · spike RapidAPI odds-api1 en cours |
| `5iw` | P1 | Intégration BSD Live WebSocket foot (<5s) CdM 2026 | Eval pending |
| `8lqf` | P2 | Spike FBref via soccerdata Python | RESEARCH ONLY scaffold livré v12.30 |

## 🎯 TÂCHES À FAIRE — Queue prioritaire

Source autoritaire : `bd ready`. Snapshot 21/05/2026.

### P0 (priorité absolue)

| ID | Titre | Action immédiate |
|---|---|---|
| `h9j7` | VPS deploy v12.22-v12.31 + run ETL one-shot post quota reset | Attendre minuit UTC API-Football → `bash .context/run_etl_2024_2026.sh` sur VPS |
| `c8m` | SECURITY — server.js exposé HTTP + rotation 8 clés API | Action DG : rotation ADMIN_PASSWORD · GA_POSTBACK_TOKEN · TELEGRAM_BOT_TOKEN · ODDS_API_KEY · GEMINI_API_KEY · API_FOOTBALL_KEY · BSD_API_KEY · JWT_SECRET |

### P1

| ID | Titre |
|---|---|
| `d4rd` | GSC validation post-fix robots.txt — URL Inspection + resubmit sitemap |
| `8lvf` | elofootball.com Elo historique massif — calibrer URL patterns sur HTML réel |
| `u5x` | SEO fix GSC « Bloquée par robots.txt » (code OK, ops pending — recoupé `d4rd`) |
| `x9s` | Plug oddsapi RapidAPI odds-api1 sur TOUS champs cotes |
| `c5i` | Tennis serveur invisible quand source ESPN/LiveScore sans `is_serving_p1` |
| `b50` | DB pariscore.db SQLITE_NOTADB runtime — investigate corruption ops |
| `e7l` | Version mobile PariScore (parieur nomade) — bottom nav + cartes + PWA |
| `qe5` | Live Dashboard Betting Cockpit Phase 1 — Win Prob + Top3 picks + events markers + verdict |
| `8c5` | Bug momentum du match plat/vide La Liga (et autres) |
| `j5lb` | **[DECISION DG]** GO/NO-GO 6 études bloquées arbitrage (FBref/RapidAPI/TheSportsDB/Apify/OddsPortal/Marketing) |
| `p2if` | AI-AL Revue de Presse Foot+Tennis — 5 avis presse panel Gemini |
| `4cog` | Tennis Consolidation LOT P0 — tennisMatch canonique + Elo v2 + Surface + Log-diff |
| `k3ex` | Bug Tennis ATP/WTA matchs féminins disparus tournois mixtes |
| `lyku` | Bug Routage LIGA classement ID 3 cassé — refactor vers `/api/events/` |
| `u8w9` | Bug Mobile page blanche filtres iOS Safari + Chrome Android |
| `izsn` | Refacto safeFixed() wrapper sur 94 .toFixed() restants — anti NaN/null |
| `c8zp` | Cron capture tennis score finals + cleanup history-edges legacy |
| `8uoc` | **[DECISION DG]** Tennis Abstract + autres DBs tennis — rapport recherche solution legal+technique avant GO |

### P2 (queue)

| ID | Titre |
|---|---|
| `kto1` | Research: tennisabstract.com WP interactivity-api — rapport incorporation |
| `m5sv` | Research: GitHub n63li/Tennis-API — rapport incorporation |
| `1hiv` | Research: sportsdata.io Tennis API — rapport incorporation (pricing+coverage+ROI) |
| `nwk6` | PWA Push Notifications backend — VAPID + sender service + sw.js handlers |
| `wect` | ETL Historique FBref soccerdata — RESEARCH ONLY (doublon `8lqf` à fusionner) |
| `5vzv` | Spike footballdatabase.com — audit ETL faisabilité vs ToS+CF |
| `ffh` | Spike 6 sources data (Transfermarkt + FBref + Sofascore + Fotmob + The Analyst + xvalue.ai) |
| `qkx` | Spike eval odds-api1 RapidAPI candidate |
| `k37` | Bug UI teinte rose tableau Foot (jour) |
| `e3mr` | Tennis Consolidation LOT P1+P2 — Backtest Brier + Serve/Return point-level + UQD |
| `l9vk` | Marketing Affiliation 5 phases — 1xBet+Twitter+YouTube+Telegram+Stripe |
| `ryi3` | Routing schema Phase 2+ — health + Understat + metrics + affiliate CRUD |
| `968x` | SEO/AEO Growth strategy — llms.txt + Structured Data + SSR scores + /about E-E-A-T |
| `c9p4` | Roadmap v4.x backlog tableau principal — filtres + favoris + Dropping Odds + drapeaux |

> **Sweep documentation .md 21/05/2026** : 165 fichiers scannés, 110 tâches uniques extraites (cross-réf bd existants). Détail dans `.context/_tasks_sweep_md_20260521.md`. 13 nouveaux bd créés (P1: `j5lb p2if 4cog k3ex lyku u8w9 izsn c8zp` · P2: `e3mr l9vk ryi3 968x c9p4`).

## 🧠 INNOVATION BACKLOG (Edge mathématique)

- **Bayesian Value Radar** — Data Blending Poisson Bivarié + Elo dynamique + xG Logistic
- **Bootstrap UQD** — 500 itérations IC90 par match
- **Score composite fiabilité /100** — volume data + stabilité xG + calibration
- **Règle BET stricte** — EV>5% ET borne inférieure IC>0
- **Poisson Time-Inhomogène** — modèle live conditionnel minute par minute
- **Context Engine** — météo + arbitres + kilométrage déplacements
- **Alertes SSE** — triggers `favorite_trap` + `goal_flood`

---

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

## 💳 MODULE DE MONÉTISATION & SÉCURITÉ : INTÉGRATION STRIPE

### Objectif
Implémenter une infrastructure de paiement résiliente, conforme aux standards PCI-DSS, basée sur l'API Stripe (Abonnements / Accès Premium) pour la plateforme Pariscore.

### Directives de Sécurité Absolue
1. **Zéro Hardcoding :** Aucune clé privée Stripe (`sk_live_...` ou `sk_test_...`) ni secret de webhook (`whsec_...`) ne doit être injecté directement dans le code source ou validé dans Git. Tout doit transiter exclusivement par les variables d'environnement (`.env`).
2. **Vérification des Webhooks :** La route de réception des webhooks Stripe doit impérativement valider la signature brute de l'événement (`stripe.webhooks.constructEvent`) avec le payload brut (`req.body` non parsé par un bodyParser global) pour empêcher les attaques par rejeu ou usurpation d'identité de paiement.
3. **Gestion des Rôles :** L'état d'abonnement de l'utilisateur (ex: `is_premium: true`, `stripe_customer_id`, `subscription_status`) doit être synchronisé de manière atomique en base de données dès réception de l'événement `invoice.paid` ou `customer.subscription.deleted`.


### MISSION ARCHITECTURE : SYSTÈME D'AUTHENTIFICATION ET BASE DE DONNÉES UTILISATEURS

Claude, active ta matrice de compétences : `database-architect`, `nodejs-backend-patterns`, `security-best-practices` et `frontend-ux-states`.

Nous devons transformer PariScore en une véritable plateforme SaaS. Actuellement, le site est ouvert, mais nous devons implémenter un système d'inscription et de connexion pour gérer les comptes utilisateurs (Free vs Premium) et lier nos futurs paiements Stripe.

Agis en tant que **Lead Security Architect**. 

### ÉTAPE 1 : CHOIX DE L'ARCHITECTURE ET DIAGNOSTIC
- Analyse notre stack actuelle (Node.js / Express en backend, HTML/JS en frontend).
- Propose-moi la meilleure approche pour gérer l'authentification : devons-nous construire une solution "maison" (MongoDB/PostgreSQL + JWT + Bcrypt) ou utiliser un service tiers moderne et sécurisé comme Supabase ou Clerk ?
- Argumente brièvement ton choix en fonction de notre besoin de sécurité (trading/paiement) et de rapidité d'implémentation.

### ÉTAPE 2 : MODÉLISATION DE LA BASE DE DONNÉES (SCHEMA)
Peu importe la techno choisie, définis le modèle de données (Schema) d'un "User" de PariScore. Il doit au minimum inclure :
- ID unique, Email, Password (hashé), Date de création.
- `role` ou `plan` (ex: "free", "premium_monthly").
- `stripe_customer_id` (pour lier les futurs paiements).
- `preferences` (objet JSON pour sauvegarder leurs filtres favoris de l'onglet Foot/Tennis).

### ÉTAPE 3 : PLAN D'INTÉGRATION (ROADMAP)
Rédige un plan d'action étape par étape pour cette implémentation :
1. Mise en place de la BDD et des routes Backend (/register, /login, /logout, /me).
2. Création des UI Frontend (Modale de connexion/inscription premium en Glassmorphism).
3. Protection des routes (Middleware) pour bloquer les données IA/DR Live aux utilisateurs non connectés ou non-Premium.

### ÉTAPE 4 : VALIDATION
N'écris pas encore le code serveur. Affiche-moi ton choix technologique (Étape 1) et le schéma de base de données (Étape 2) dans le terminal. Attends mon "GO" pour commencer à coder les routes d'authentification.

### MISSION DATA ENGINEERING & UI : DÉTECTION ET AFFICHAGE DU SERVEUR EN LIVE (TENNIS)

Claude, active ta matrice de compétences : `api-integration`, `data-architecture`, `nodejs-backend-patterns` et `frontend-ux-states`.

**🚨 BUG CRITIQUE SIGNALÉ :** Sur notre onglet Tennis en direct, nous avons une faille de données : notre flux API actuel (BSD ou autre) ne permet pas de définir de manière fiable **qui est au service** (le serveur du jeu en cours). C'est une information vitale pour nos parieurs professionnels.

Je veux que tu agisses en tant que **Lead Data Engineer** pour auditer, sourcer et intégrer cette information en temps réel.

Exécute la mission en respectant ces 4 étapes :

---

### ÉTAPE 1 : AUDIT DU FLUX ACTUEL ET RECHERCHE DE SOURCE FIABLE
- **Investigation interne :** Inspecte les logs de notre API actuelle (le payload JSON brut des matchs live). Vérifie s'il n'y a pas un champ non exploité (ex: `server`, `current_server`, `serving`, ou une notation dans l'historique des points) que nous aurions raté.
- **Sourcing Externe :** Si notre API est définitivement aveugle sur ce point, trouve et propose-moi une source ou une méthode fiable pour récupérer cette donnée en live. 
  *Pistes :* Une autre API légère (type API-Football/Tennis, TheSports, ou un endpoint spécifique GitHub), ou le scraping d'un flux WebSocket public (type SofaScore/Flashscore) uniquement pour extraire l'ID du serveur.

---

### ÉTAPE 2 : LOGIQUE D'INFÉRENCE (PLAN B ALGORITHMIQUE)
S'il est impossible de sourcer l'info directement sans surcoût majeur, propose un algorithme de "déduction du serveur" basé sur les règles du tennis.
- *Exemple logique :* En connaissant qui a servi au 1er jeu du 1er set, et en comptant le nombre total de jeux terminés, on peut mathématiquement déduire qui sert dans le jeu actuel (hors Tie-Break où la règle des 2 points s'applique). 
- Évalue la fiabilité d'une telle approche pour notre backend.

---

### ÉTAPE 3 : INTÉGRATION FRONTEND (LE DESIGN PREMIUM)
Peu importe la source de la donnée retenue, prévois l'intégration UI dans `pariscore.html` :
- Injecte une propriété `is_serving: true` sur le joueur concerné dans le state de notre frontend.
- Ajoute un indicateur visuel élégant, pro et discret à côté du nom du joueur au service (par exemple, une micro-balle de tennis 🎾 stylisée, un point néon vert "Pulse", ou un chevron). 

## 🔊 MODULE AUDIO : ALERTES SONORES DE TRADING (STATE TRACKING)

### Objectif
Implémenter un système d'alerte sonore (type Terminal Bloomberg) qui avertit le parieur lorsqu'un indicateur clé (Conseils IA, Confiance, Market Edge) monte en puissance lors d'un match en direct ou d'une mise à jour de données.

### Règles d'Implémentation
1. **Logique de Transition (State Tracking) :** Le son ne doit pas se jouer simplement parce qu'un indicateur est vert. Il doit se jouer **uniquement lors d'une transition positive** : 
   - Neutre (ou Rouge) ➔ Jaune
   - Jaune ➔ Vert
   Cela nécessite de stocker l'état précédent de la cellule (via le `sessionStorage` ou un objet Map local) pour le comparer au nouveau payload.
2. **Politique Navigateur (Autoplay) :** Les navigateurs modernes (Chrome, Safari) bloquent l'audio non sollicité. Il est **obligatoire** de créer un bouton "Activer les Alertes Sonores" (Toggle) dans l'interface (UI) pour débloquer le contexte audio de la page.
3. **Throttling (Anti-Spam) :** Si une mise à jour globale fait passer 10 matchs au vert simultanément, le son (`tennis.mp3`) ne doit retentir qu'une seule fois (ou avec un léger décalage) pour ne pas saturer les haut-parleurs.
---

### ÉTAPE 4 : PROTOCOLE DE VALIDATION (ATTENTE DU "GO")
⚠️ Ne modifie aucun fichier de production pour le moment.
1. Fais tes recherches sur la documentation des APIs ou audite notre payload actuel.
2. Affiche-moi

### MISSION ALGORITHMIQUE & UI : INDICATEURS DYNAMIQUES DE JEUX EN DIRECT (TENNIS)

Claude, active ta matrice de compétences : `javascript-logic`, `sports-betting-quant`, `frontend-design`, et `ui-ux-pro-max`.

Nous devons enrichir le tableau Tennis Live (fichier `pariscore.html` et scripts de rendu associés) avec des indicateurs prédictifs "Over/Under Jeux" qui réagissent dynamiquement en fonction du déroulement du set en cours (Set 1, Set 2, Set 3, Set 4 ou Set 5).

Agis en tant que **Lead Data Engineer & UI Expert**. Implémente cette logique algorithmique et visuelle.

---

### ÉTAPE 1 : LOGIQUE ALGORITHMIQUE (CALCUL DU CONTEXTE DU SET)
Dans la fonction de rendu ou de traitement des matchs de tennis en direct, tu dois identifier le set en cours (ex: `current_set`) et évaluer le score de ce set (ex: 2-2, 3-2, etc.).

Implémente les règles conditionnelles suivantes pour le set actif :
1. **Indicateur de base (Début de set) :** Affiche toujours l'indicateur `"Over 7.5 jeux"`.
   - Si la probabilité de réussite (calculée via nos modèles ou via la data historique du serveur) est $\ge 50\%$, affiche le badge en **Jaune**.
   - Si la probabilité est $\ge 65\%$, affiche le badge en **Vert**.
2. **Indicateur de match avancé :** Calcule le nombre total de jeux déjà disputés dans ce set.
   - Si `jeux_joues > 4` (ex: score de 3-2, 4-1, etc.), ajoute automatiquement un deuxième indicateur : `"Over 8.5 jeux"` (avec le même code couleur que ci-dessus).
3. **Indicateur de Break (Rupture) :** - Tu dois détecter s'il y a eu un break dans le set (soit via l'API si elle le fournit, soit en calculant si le receveur a remporté un jeu).
   - Si un **Break** est détecté dans le set en cours, affiche un nouvel indicateur : `"% de réussite sur Under 12.5 jeux"`.

Cette logique doit s'appliquer de la même manière quel que soit le set en cours (S1, S2, S3, S4, S5).

---

### ÉTAPE 2 : INTÉGRATION VISUELLE (UI/UX)
- Intègre ces indicateurs sous forme de **micro-badges** ou de **pilules (tags)** (ex: `<span class="badge badge-yellow">O 7.5 (52%)</span>`).
- Ces badges doivent être injectés dans la colonne appropriée du tableau (ex: colonne "Conseils IA" ou "Sets/Jeux").
- Utilise les codes couleurs stricts de notre Design System : Jaune pour "Moyen" (50-64%) et Vert fluo/émeraude pour "Fort" (65%+).
- L'affichage doit être ultra-compact pour ne pas casser la hauteur des lignes du tableau (règle des 500ms de lecture).

---

### ÉTAPE 3 : TESTS ET VALIDATION
1. Analyse la structure actuelle de l'objet `match` pour localiser le set en cours et le score détaillé.
2. Écris la fonction de calcul (ex: `calculateLiveGameIndicators(match)`) qui renverra les badges HTML à injecter.
3. Ne modifie les fichiers de production qu'après m'avoir présenté un exemple du rendu JSON/HTML généré par ta fonction.
4. Lance un test sur `localhost:3000` en simulant un score de 3-2 avec un break pour vérifier que les badges "Over 7.5", "Over 8.5" et "% Under 12.5" s'affichent correctement.


### MISSION DE BUGFIX : RÉSOLUTION DE L'AUTOPLAY POLICY (AUDIO DOMEXCEPTION)

Claude, active tes compétences : `javascript-logic`, `browser-apis` et `ui-ux-pro-max`.

🚨 **BUG SIGNALÉ :** Notre système d'alerte sonore génère l'erreur suivante dans la console :
`Uncaught (in promise) DOMException: play() failed because the user didn't interact with the document first.`

Le navigateur bloque la fonction `playTradingAlert()` car elle se déclenche (via les mises à jour Live) avant que l'utilisateur n'ait cliqué ou interagi avec la page. 

Ta mission est de corriger cela en implémentant une gestion propre de l'Autoplay Policy.

Exécute ces 2 étapes de correction :

---

### ÉTAPE 1 : PROTECTION DE LA FONCTION `.play()`
- Dans la fonction `playTradingAlert()`, assure-toi que l'appel à `.play()` est bien géré par une Promesse (Promise) pour intercepter le rejet silencieusement sans polluer la console.
- **Exemple d'implémentation attendue :**
  ```javascript
  const playPromise = audioContext.play();
  if (playPromise !== undefined) {
    playPromise.catch(error => {
      // Bloqué par l'autoplay policy, on gère silencieusement
      console.warn("Audio bloqué en attente d'interaction utilisateur.");
    });
  }
*Dernière mise à jour : v12.31 — 21/05/2026. CLAUDE.md purgé (v7.1 → v12.31 historisés dans `CHANGELOG.md`). Source vérité tâches = `bd ready`.*
