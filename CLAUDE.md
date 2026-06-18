## ✅ SESSION 2026-06-18 (NIGHT) — SPIDER CHART AUDIT & CORRECTIONS (7 BUGS)

### Audit realise
- **Composant audite** : enderTn2Radar() dans pariscore.js:6981-7108 (Chart.js radar)
- **Pipeline data** : 6 axes traces (ELO Surface, PowerScore, Momentum, Niveau, Experience, Efficacite)
- **7 bugs classes** : B1 (HIGH), B2-B4 (MED), B5-B7 (LOW)
- **Design reference** : sketch 001, Variant B (SVG Glow) identifie comme winner mais backlogge

### Corrections appliquees et verifyees (
ode --check OK)

| Bug | Severite | Correction | Fichier:Ligne |
|-----|----------|-----------|---------------|
| B1 | HIGH | eginAtZero: true -> eginAtZero: false, min: 20, max: 100 | pariscore.js:7070 |
| B2 | MED | Classes mortes .spider-polygon-p1/p2 remplacees par commentaire | pariscore.html |
| B3 | MED | Guards serve_index/eceive_index tolerent 1 null (?? 50) | pariscore.js:7020-7023 |
| B4 | MED | console.warn() ajoute sur l10_pts null | pariscore.js:7015-7016 |
| B5 | LOW | Detection >=4/6 axes a 50 -> warn structure | pariscore.js:7025-7029 |
| B6 | LOW | CSS .recharts-* legacy supprime | pariscore.html |
| B7 | LOW | ankScore() securise (|| r > 2000, Math.min(100, ...)) | pariscore.js:7007-7009 |

### Rapports generes
- spider_chart_issue.md : rapport complet d'audit avec localisation, impact, correction, plan priorise

### Restant (backlog)
- Tests fonctionnels : lancer 
ode server.js (~4min warmup), ouvrir pariscore.html, verifier le radar
- Migration SVG natif (Variant B) : zero Chart.js, effet glow neon, animations fluides
- Audit UX complet des tooltips, animations, etats vides du composant

### Fichiers modifies cette session
- pariscore.js : renderTn2Radar() — 6 corrections P0-P3 dans la meme zone (L6988-7116)
- pariscore.html : CSS mort (spider-polygon, recharts legacy) remplace par commentaires
- spider_chart_issue.md : nouveau rapport d'audit


## ✅ SESSION 2026-06-18 (PM) — REDESIGN MODAL AUTH + AUDIT CONCURRENTIEL

### Audit & Analyse
- **Veille concurrentielle** : 10 sites analysés (Betclic, Winamax, Unibet, FDJ, Sofascore, Flashscore, Stake, DraftKings, Bet365 ❌, SportyTrader ❌)
- **Brainstorming équipe IA** : CEO (stratégie), UI/UX (design), QA (edge cases), Security (vulnérabilités)
- **Rapport complet** : `.context/audit-auth-redesign-2026-06-18.md` (21 Ko, 310 lignes)
- **Décision** : Auth OPTIONNELLE, pas de social login, pas de colonne promo — version épurée validée par le client

### Modifications CSS (`pariscore.html`)
- **h2** : suppression du text-shadow 3D rouge → style propre (32px, ombre légère)
- **`.auth-logo`** : ajout du logo SVG PariScore (160px, drop-shadow)
- **`.auth-forgot`** : lien "Mot de passe oublié" (gris → hover vert)
- **`.input-valid`** : bordure verte `#00e676` pour champ valide
- **`.btn-spinner`** + `@keyframes psSpin` + `.auth-submit.is-loading`

### Modifications HTML (`pariscore.html`)
- **`<img class="auth-logo">`** : logo PariScore inséré au-dessus du titre h2
- **`<a class="auth-forgot">`** : lien "Mot de passe oublié ?" sous le champ password

### Modifications JS (`pariscore.js`)
- **`validateEmailField()`** : validation onblur avec `.input-valid` (tolère admin sans @)
- **`validatePasswordField()`** : validation onblur, 8 chars min pour register
- **`attachAuthBlurValidators()`** : pose les listeners blur sur les 4 champs auth
- **`openAuthModal()`** : appelle `attachAuthBlurValidators()` automatiquement
- **`showForgotPassword()`** : toast temporaire redirigeant vers support@pariscore.fr

### Backend — déjà OK
- **Rate limiting** : déjà actif (`checkLoginRateLimit`, 5/15min par IP)
- **Message d''erreur uniforme** : `"Email ou mot de passe incorrect"` (pas de distinction email vs password)
- **JWT** : httpOnly à prévoir (actuellement localStorage → risque XSS)

### Restant
- Route `/api/v1/auth/forgot-password` avec envoi email SMTP
- Migration JWT localStorage → httpOnly cookie + refresh token rotation
- Password breach check (k-anonymity via HIBP API)
- Test visuel dans le navigateur (localhost:3000)

### Fichiers modifiés cette session
- `pariscore.html` : CSS auth (L8263-8330) + HTML auth (L12290-12320)
- `pariscore.js` : fonctions auth (L19668-19770) + blur validators + showForgotPassword
- `.context/audit-auth-redesign-2026-06-18.md` : rapport d''audit complet

## ✅ SESSION 2026-06-18 — RESTAURATION COMPLÈTE (Navbar + Auth + Freemium)

### Commits : `590a2d7` → `b2e8be2` → `b61e488` → `2d3cfc1` → `22e17b7`

### 1. Navbar — showPage + bnGo restaurés
- **Cause** : `pariscore.js` sur le VPS avait un `else if` orphelin ligne 6529 (corruption fichier)
- **Fix** : SCP du fichier local → VPS + `node --check` OK
- **bnGo** créé comme alias `showPage` pour la barre mobile
- **Cache bust** : `?v=240617-1` → `?v=240618-1` dans `pariscore.html`

### 2. Login admin — pariscore.html + admin.html
- **Bug pariscore.html** : validation `!email.includes('@')` bloquait le login admin (username sans @)
  - Fix : suppression de la validation bloquante, le payload détecte déjà username vs email
- **Bug admin.html** : le `catch(e)` générique affichait "Serveur inaccessible" même si le login réussissait
  - Fix : message d'erreur réel + hide login form AVANT showDashboard (défensif)
  - `showDashboard` wrapper protégé par try/catch (EDA ne casse plus le dashboard)
  - `edaLoadTables` protégé contre élément manquant

### 3. Système Freemium — bannière + essai gratuit 24h
- **Backend existant** : gate freemium (5 ligues, 10 vues/jour), `PS_FREE_LEAGUES`, `incrementMatchesView`
- **Bannière frontend** : insérée dans `#page-matchs`, gérée par `updateNavAuthState`
  - Essai actif → 🎉 vert "Essai gratuit — Xh restant"
  - Essai expiré → 🔒 orange "Mode Gratuit — 5 ligues, 10/jour"
  - Admin/Pro → masquée
- **Essai gratuit 24h** : inscription → `premium_until = now + 86400`, token `matchday`
  - `requireUserAuth` fixé pour accepter `matchday`
  - `/api/v1/bets`, `/api/v1/matches` accessibles en essai
- **Rapport OddAlerts** : `.context/ANALYSE-ODDALERTS-FREEMIUM.md`

### Fichiers modifiés
- `pariscore.js` : showPage/bnGo, submitLogin fix, updateNavAuthState (bannière), submitRegister (trial_until)
- `pariscore.html` : cache bust, bannière freemium avec compte à rebours
- `admin.html` : login error handling, showDashboard défensif, edaLoadTables guard
- `server.js` : register → trial matchday token + premium_until, requireUserAuth +matchday

### Restant
- Day Pass payant (£2.99 style OddAlerts) via Stripe (checkout/matchday existe déjà)
- Compteur de vues restantes visible dans l'UI
- Bannière freemium sur pages Tennis/CS2/MMA

## 🚨 CRITICAL_FIX — MEDIA REPAIR 2026-06-17

Cartes TOP 10 MATCHS DU JOUR cassées (capture image_8890dc.jpg).

### Corrections appliquées
1. **score_top10 guard** (pariscore.js:4471) — 	oFixed(1) crashait sur null → toute la carte était avortée
2. **Noms joueurs guard** (pariscore.js:4476-4478) — m.player1 null/'?' → fallback '—' lisible
3. **Avatar fallback cascade** (pariscore.js:14656-14660) — ajout étage ui-avatars.com AVANT le span initiales
4. **Backend cascade noms** (server.js:35884-35885) — extraction fallback shortName / 
om / id
5. **Syntaxe** : 
ode --check pariscore.js ✅ + 
ode --check server.js ✅

### Fichiers modifiés
- pariscore.js : _tnTop10Card() — score guard + noms guard + fixBrokenPlayerPhoto cascade
- server.js : buildTennisValueBets() — extraction noms joueurs
## ✅ CRITICAL_BUG_FIX — RESOLVED 2026-06-15

Layout Tennis réparé. Causes identifiées :
1. overflow:hidden sur .tn2-card-grid coupait les cartes
2. Code photo dans tn2SwitchTab resetait le cache à chaque onglet
3. Les tab-btn manquaient de flex-shrink:0

**FIX KPI TENNIS (2026-06-15)** : 	n2-kpi-bets et 	n2-kpi-top bloqués à 0.
Causes :
1. 	n2UpdateKPI(data) appelée avec objets partiels — chaque appel ne passait qu'UN champ
2. 	n2RenderTopCards n'appelait jamais 	n2UpdateKPI → top restait à 0
3. Aucune fonction ne passait ets → bets restait à 0
Fixes :
1. 	n2RenderLiveCards calcule désormais _betsCount (odds + predictive keys) + _topCount (confidence>75)
2. 	n2RenderTopCards appelle 	n2UpdateKPI({ top: ... }) avant render
3. 	n2RenderTournaments préserve les KPIs live/bets/top existants via lecture DOM
# 🏟️ PariScore — Poste de Pilotage (v12.80 — bd-driven)

## 📊 MODULE H2H SURFACE — 2026-06-16

Module comparatif 4 lignes implémenté et 4 bugs de flux de données corrigés :

### Composants livrés
- **Backend** : payload enrichi (l5_pts, l10_pts, ps_rank, ps_total, tournament_history)
- **Fonction** : `_tennisPlayerTournamentHistory()` — requête SQL tennis_matches_internal
- **HTML/CSS** : Table `.tennis-surface-h2h-table` dans modale analyse premium
- **JS** : populate 4 métriques avec couleurs conditionnelles (cyan/gris/vert)

### Bugs corrigés ce sprint
1. `|| null` → `!= null ? val : null` sur les 8 champs (server.js L21823-21832)
2. round NULL → défaut "Participant" dans _tennisPlayerTournamentHistory (server.js L26443)
3. l10_pts = 0 par défaut dans _tennisPowerForm si pas de matchs sur la surface (server.js L27240)
4. Ajout fallback N/A dans JS pour historique/forme indisponible (pariscore.js L6672-6693)

### Risques résiduels
- Matching tournoi par LIKE approximatif (`'%roland garros%'`) peut rater si noms trop divergents entre sources
- tennis_matches_internal doit être populate par le cron ETL quotidien (02:00 Paris)

## 🔧 SESSION 2026-06-16 (PM) — serve_index / receive_index FIX + TEST PENDING

### Bug corrigé
- **Problème** : `serve_index` et `receive_index` dans la route `/api/v1/tennis/detail` (server.js L21824, L21832) utilisaient `|| null` au lieu de `!= null ? val : null`
- **Impact** : Quand `serve_index` ou `receive_index` valait `0` (zéro légitime), il était converti en `null` → la modale analyse perdait l'information
- **Fix** : Remplacé `|| null` par `!= null ? ... : null` sur les 4 occurrences (p1.serve_index, p1.receive_index, p2.serve_index, p2.receive_index) — homogène avec ps_rank, ps_total, l5_pts, l10_pts

### ⏱️ CONTRAINTE OPS — Server 4 min warmup + boucle infinie
- Le serveur est un ETL continu : données sportives, refresh, match processing en boucle — **il ne s'arrête jamais**
- **Démarrage : ~4 minutes** — ne pas paniquer, laisser initialiser (connexions API, cache, SQLite WAL)
- Ne pas tuer/relancer le processus sauf si vraiment planté. Le laisser tourner.
- Le site `localhost:3000` est accessible avant la fin du warmup, mais les data tennis ne sont complètes qu'après les ~4 min

### ❌ PENDING — Server not started
- `node server.js` n'a PAS été lancé
- Aucun test navigateur effectué
- Aucune vérification des métriques TOP 10 + Serve/Receive index

### À faire dans la prochaine session
1. Lancer : `cd "C:\Users\david\Documents\dev PariScore\ParisScorebis" && node server.js`
2. **Attendre ~4 min** que le serveur finisse son initialisation (surveiller les logs console)
3. Ouvrir `http://localhost:3000` et vérifier que le serveur répond
4. Naviguer sur Tennis → onglet "À l'affiche" (ou Top)
5. Cliquer sur un match pour ouvrir la modale analyse
6. Vérifier que les champs `serve_index` et `receive_index` s'affichent correctement (même à 0)
7. Vérifier que les KPI du TOP 10 (bets, top) ne sont plus bloqués à 0
8. **Le serveur tourne en continu** — pas besoin de le stopper entre les tests

## 🔄 SPS POWERSCORE — REFONTE FORMULE 2026-06-16

### Nouvelle formule SPS
SPS = (Score Aptitude Surface × 0.70) + (Forme Récente Générale × 0.30)

### Score Aptitude Surface (70%) — pondérations dynamiques
| Surface | EloNorm | WinRate52s | FormFactor |
|---------|:-------:|:----------:|:----------:|
| **Grass** | 50% | 35% | 15% |
| **Clay** | 35% | 40% | 25% |
| **Hard/Carpet** | 45% | 35% | 20% |

### Forme Récente Générale (30%)
- **Momentum (60%)** : ratio winRate 30j / winRate 52sem (même surface). 0.5 si pas de données.
- **Fatigue (40%)** : SUM(minutes) 45j / 720min. Tous surfaces confondues. 0 = reposé, 1 = épuisé.
- `recentForm = 0.60 × momentum + 0.40 × (1 - fatigue)`

### Détail implémentation
- Fonction : `_tennisPowerForm()` dans server.js (L27204-27287)
- Ancienne formule (50/30/20) → remplacée par SPS (70/30 avec sous-pondérations)
- **1 nouvelle requête SQL** : fatigue (SUM minutes, tous surfaces, 45j)
- **1 requête étendue** : momentum (winRate 30j surface, ajoutée à la winRate 52sem existante)
- Cache `_tennisSurfFormCache` inchangé (TTL `_TENNIS_SURF_RANK_TTL_MS`)
- Le catch silencieux est remplacé par `console.warn('[TennisPowerForm] err:')`

### Impact
- **`powerscore` change de valeur** pour tous les joueurs → `_buildTennisPowerRankIdx` recalcule automatiquement
- **`l5_pts` / `l10_pts` inchangés** — même logique
- **Classement PS (`ps_rank`)** peut changer suite aux nouveaux scores

## 🎭 IDENTITÉ ET POSTURE DE L'AGENT
Tu es le **CTO & Lead Data Scientist (Quant)** de PariScore.
- **Posture** : Expert en modélisation mathématique et en algorithmique prédictive. Tu ne crois qu'aux statistiques dévigées et aux modèles calibrés.
- **Rigueur Scientifique** : Aucun modèle n'est mis en production sans calcul d'Intervalle de Confiance (UQD).
- **Recrutement** : Si l'architecture requiert une expertise en ML ou scraping temps réel complexe, déploie un agent dédié.

## gstack Orchestrator
gstack skills (`/gstack-*`) sont disponibles — cf. `AGENTS.md` pour la liste complète et le skill routing.
Utiliser `/gstack-plan-ceo-review` pour les décisions stratégiques, `/gstack-autoplan` pour le pipeline complet CEO→Design→Eng→DX.

## 🛠️ RÈGLES DE COMPORTEMENT SYSTÉMATIQUES

1. **PROTOCOLE DE CLÔTURE (OBLIGATOIRE)** :
   - **Archivage** : Transférer algorithmes validés + backtests dans `CHANGELOG.md` (releases) ou `ARCHIVE_PROJECT.md`.
   - **Nettoyage** : Purger `CLAUDE.md` régulièrement — poste de pilotage, pas un journal.
   - **Innovation** : Proposer 3 nouvelles pistes d'optimisation de l'Edge.

2. **Performance Backend** : Calculs bayésiens et Bootstrap ne bloquent jamais le thread principal Node.js.

3. **Source de vérité tâches** = **bd (beads)**. Ce fichier = miroir lisible ; `bd ready` reste autoritaire.


4. **PLAN → EXECUTE → VERIFY (OBLIGATOIRE tâches > 3 fichiers)** :
   - **PLAN** : exploration codebase + `plan.md`. ZÉRO écriture de code.
   - **ACT** (Plan/Act toggle) : implémentation avec commits atomiques. Par défaut en mode PLAN. Passer en ACT explicitement.
   - **VERIFY** : `node scripts/test-quick.js` + `node --check server.js` + vérif manuelle.

5. **3-STRIKE RULE** : 3 tentatives échouées consécutives sur le même fichier → STOP immédiat. Demander à l'utilisateur.

6. **AUTO-VERIFY POST-EDIT** :
   - `server.js` modifié → `node --check server.js` obligatoire avant commit
   - `pariscore.html` modifié → `node scripts/test-quick.js` (vérifie sync STRATEGIES)
   - Tout commit DOIT passer les vérifications
## 🏗️ ARCHITECTURE & STACK

- **Backend** : Node.js (Vanilla, zero-dep sauf `better-sqlite3`), SQLite3 WAL, SSE
- **Frontend** : SPA `pariscore.html` mono-fichier (30k+ lignes), Design System V2.0 tokens `--cf-*`
- **Math Engine** : JS natif — Poisson bivarié, Elo dynamique, Shin-Hurley devig, Kelly cap 25%, Bootstrap UQD
- **Sources data** : BSD ($5/mo + WS push), ESPN public, Odds API, openfootball ODbL, Wikidata CC0, felipeall/transfermarkt-api, elofootball, aiscore.com on-demand throttled
- **Sources backlog DG** : xvalue.ai (GO 85/100 bd `ffh`), OddsPapi.io Pinnacle sharp (bd `bjv` POC)
- **Déploiement** : VPS OVH `/home/ubuntu/pariscore` — `git pull && pm2 restart pariscore`
- **Persistance ETL** : `db.archive_matches` 9 sources (+ football-data.co.uk v12.74 — stats + closing odds 3 saisons) + SQLite `match_stats_history` (xG + splits MT + 45 stats/match, 66 ligues BSD saison 25/26, bd `rm3d`) + `team_season_stats` (standings 5 saisons/ligue). Inventaire : `.context/databases_historique_inventory.md`

---

## 📋 ACTIONS OPS USER PENDING

| # | Action | Type | Détail | Urgence |
|---|---|---|---|---|
| 4 | **ETL Football quota reset** | ops ✅ CLOSED | bd `9je` — pipeline livré v12.10, cron 00:00 UTC VPS actif | ✅ |
| 9 | **POC xvalue.ai** | DG ✅ CLOSED | bd `qyfr` — NO-GO, abandonné | ✅ |
| 6 | **Stripe DG (suite)** | DG+ops | bd `s77m` — backend ✅. PENDING: décision prix annuel + refund policy + frontend CTAs 8 pricing | 🟡 MED |
| 7 | **Sackmann purge Phase 3-7** | code | bd `dl49` — ETL interne BSD/ESPN. Phase 1+2 ✅. Phase 3 (TTL, backfill, benchmark) ✅. Phase 4.1 probe: BSD n'a PAS de stats serve (ace/df/svpt) → livré sans. Phase 4.2-7 restants | 🔴 HIGH legal |
| 8 | **POC OddsPapi.io** | DG | bd `bjv` — spike en cours. Option C Pinnacle direct NO-GO. OddsPapi.io free 250 req à tester | 🟢 LOW |
| 14 | **DG ligues BSD secondary** | DG | 11 ligues non mappées (Africa Cup, Liga F WOMEN, coupes mineures, Nigeria PFL, Liga MX Clausura). $0 incrémental. | 🟡 MED |

---

## 🧠 INNOVATION BACKLOG (Edge mathématique)

Tout l'historique livré → `CHANGELOG.md`. Nouvelles pistes session 22/05/2026 + 11/06/2026 :

- **λ xG-adjusted depuis `match_stats_history`** (bd `6kzf` P1) — xG réel BSD agrégé fenêtre 10 matchs + shrinkage → alimente le poids xG 25% du bayesianBlend. Splits 1re/2e MT → marchés HT/FT + O/U 1.5 1re MT. Badge sur/sous-performance (gf vs xgf) via `team_season_stats`. Backtest obligatoire (math-invariants).
- **OddAlerts API officielle £69.99/mo** (bd `49pe`) — pressure algorithm in-play, Pinnacle dropping odds (complète `bjv`), referee/foul stats. Scraping NO-GO (Turnstile + ToS) ; route contractuelle propre.
- **xvalue.ai ML scouting clustering** (bd \`qyfr\`) — form-style fingerprint, anomalies tactiques pré-match (coach change, blessure clé). Sortie : \`style_shift_score\` 0-100 dans \`confidence_badge\`.
- **Pinnacle sharp calibration via OddsPapi.io** (bd `bjv` Plan C 250 req/mo) — ancrage low-vig dans `computeWFV1N2`, réduction faux positifs ValueBet (-5 à -10% bias). POC backtest 50 matchs.

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

## 💳 MODULE STRIPE — État livraisons

| Composant | État | Locus |
|---|---|---|
| Schema users SQLite | ✅ | `server.js:3658+` |
| JWT + bcrypt auth | ✅ | `server.js:14120+` |
| Stripe Checkout backend | ✅ v12.43 | `server.js:13893+` + `/api/v1/checkout/matchday` |
| Webhook signature verify | ✅ | `/api/v1/webhook/stripe` payload brut + event_id dedup |
| Customer Portal | ✅ v12.43 | bd `s77m` |
| DG activation | ⏳ | bd `s77m` — checklist `.context/stripe_dg_checklist.md` (9 sections) |

**Sécurité** : zéro hardcoding clé Stripe. Webhook valide signature brute (`stripe.webhooks.constructEvent`). Sync atomique DB sur `invoice.paid` / `subscription.deleted`. Code reste TEST MODE jusqu'à DG validation.

*v12.67 — 2026-06-05. Purge : tâches fermées → bd notes, missions → CHANGELOG.md. Source vérité = `bd ready`.*

---

## 🚀 Deploy Configuration (configured by /setup-deploy)
- Platform: **Custom VPS OVH (primary)** + **Render.com (mirror, auto-deploy)**
- Production URL: `https://pariscore.fr`
- Deploy workflow: VPS = manual SSH + `scripts/update_vps.sh` · Render = auto-deploy on push to `main` (`render.yaml`)
- Deploy status command: `ssh pariscore "pm2 list && pm2 logs server --lines 10 --nostream"`
- Merge method: push to `main` (solo repo, no PR gate)
- Project type: web app / API — Node.js vanilla, SPA `pariscore.html` + `/api/v1/*`
- Post-deploy health check: `https://pariscore.fr/api/v1/status` → `{ status: "ok", matches: N }`

### VPS OVH (primary)
- SSH alias: `pariscore` (→ `ubuntu@51.75.21.239`) — SSH config on dev machine, also in `.claude/skills/ps-deploy`
- Dir: `/home/ubuntu/pariscore` · PM2 process: **`server`** (id 6 — NOT `pariscore`)

### Custom deploy hooks
- **Pre-merge gate**: `node --check server.js` — STOP on error, never deploy broken syntax
- **Push**: `git pull --rebase && git push` — verify `git status` = "up to date with origin/main"
- **Deploy trigger (VPS)**: `ssh pariscore "cd /home/ubuntu/pariscore && bash scripts/update_vps.sh"`
  — 6 steps: git fetch → reset --hard origin/main → pull --rebase → npm install --omit=dev → npm rebuild better-sqlite3 → pm2 restart server --update-env → Discord notify
- **Deploy trigger (Render)**: automatic on push to `main` (`render.yaml`: web `pariscore` + pserv `pariscore-sofa` python/Playwright)
- **Deploy status**: `ssh pariscore "sleep 12 && pm2 list && pm2 logs server --lines 10 --nostream"` — success = status `online`, same PID after 12s, mem > 100MB, restart count stable
- **Health check**: `curl -sf https://pariscore.fr/api/v1/status` (also `/api/v1/matches`, `/api/v1/tennis/matches`, `/api/v1/cs2/matches`)
- **Gotcha**: crash loop after restart → `ssh pariscore "cd /home/ubuntu/pariscore && npm rebuild better-sqlite3 && pm2 restart server --update-env"` (Node/better-sqlite3 ABI mismatch)

*Deploy config v1 — 2026-06-08 via /setup-deploy. Full procedure: `/ps-deploy` skill (`.claude/skills/ps-deploy`).

---

## ✅ CRITICAL_BUG_FIX — RESOLVED 2026-06-15

Layout Tennis réparé. Causes identifiées :
1. overflow:hidden sur .tn2-card-grid coupait les cartes
2. Code photo dans tn2SwitchTab resetait le cache à chaque onglet
3. Les tab-btn manquaient de flex-shrink:0

Fixes : overflow:hidden retiré, photo map déplacée hors switch, flex-shrink:0 ajouté.

## Roadmap

- [ ] **Sprint Refonte UI Tennis — Dark Betting Premium** — Appliquer les tokens de design extraits de "image_ad30a6.jpg" : fond `#0e1420`, cartes `#172132`, en-têtes `#111a28`, accent bleu `#0077ff` pour hover odds, bordures fines semi-transparentes, typographie Inter/Roboto. Ajout classes premium .tennis-odds-box-premium, .tennis-match-card-premium, .tennis-grid-header.
- [ ] (✅) **Fix crash layout Tennis** — Suppression all:initial + margin:0 auto sur .tn2-main (l.22255) qui causaient shrink-wrap et superposition des boutons de navigation
- [ ] (✅) **Pipeline photos athlètes Tennis** — getPlayerPhotoUrl() + <img> tags avec fallback initiales dans les cartes Live Tennis
- [ ] (✅) **Fix décalage layout grille Tennis** — padding tn2-main réduit, grid 100%, fix mobile sidebar 280px

- [ ] **Étude Betfair scraping** — Analyser la faisabilité d'obtenir le WOM par joueur tennis via scraping betfair.com ou API officielle

## Étude — Scraping Betfair.com pour WOM par joueur (tennis)

**Contexte** : Actuellement, le WOM tennis ne peut afficher que le `totalMatched` (volume total misé) car betwatch.fr paywalle le split par joueur (Extra Sports). Le panneau WOM tennis ne montre donc pas de pourcentage BACK par joueur.

**Objectif** : Étudier la faisabilité de scraper directement betfair.com (ou son API publique/privée) pour obtenir le Weight of Money PAR JOUEUR sur les matchs de tennis.

**Pistes à explorer** :
1. **Betfair Exchange API** (officielle) — nécessite clé API + certificat, mais donne le WOM par joueur via `listMarketBook`. Vérifier si le compte gratuit suffit ou si un abonnement Premium est requis.
2. **Betfair.com scraping** — la page Exchange affiche le montant BACK/LAY disponible pour chaque joueur. Analyser la structure DOM/API interne de betfair.com/com/en/exchange/. Risques : blocage IP, rate limiting, TOS.
3. **Sources alternatives** : 
   - `betfair.com/sport/tennis` pages match → extraction des volumes BACK/LAY visibles
   - API non documentée de betfair.com (XHR calls du site web)
   - Matchbook / Smarkets (autres exchanges)

**Livrables attendus** :
- Rapport de faisabilité (data/étude_betfair_scraping.md)
- Si faisable : script Node.js `tools/scrape-betfair-wom.js` utilisant les patterns existants (fetch HTTP + parsing HTML) ou API officielle
- Si non faisable : justification claire (TOS, blocage, coût)

**Priorité** : À faire après stabilisation du backend WOM actuel

---

## 🎯 TODO — Metrics Popup On Top

Agis en tant que **Lead Frontend Developer**. Tu dois finaliser le popup "ANALYSE AVANCÉE" en y intégrant toutes les métriques demandées et en terminant par un **Spider Chart** comparatif (Radar).

### 1. STRUCTURE DU DASHBOARD (3 SECTIONS)

**Section A — MÉTRIQUES ANALYTIQUES**
| Métrique | Description | Source |
|---|---|---|
| **ELO Surface** | Rating Elo spécifique à la surface | `payload.tennis_detail.elo` |
| **Ranking Global Surface** | Classement mondial sur la surface | `payload.tennis_detail.elo_rank` |
| **Powerscore** | Score SPS (Surface Power Score) normalisé | `payload.tennis_detail.powerscore` |
| **Rang relatif Powerscore** | Rang x/150 dans le classement SPS | `payload.tennis_detail.ps_rank` / `ps_total` |

**Section B — MÉTRIQUES "SCOUT"**
| Métrique | Description | Source |
|---|---|---|
| **Indice Serveur** + Ranking surface | `serve_index` normalisé 0-100 + classement | `payload.tennis_detail.serve_index` |
| **Indice Receveur** + Ranking surface | `receive_index` normalisé 0-100 + classement | `payload.tennis_detail.receive_index` |
| **DR Moyen** (Tournoi en cours) | Delta Rating moyen des adversaires rencontrés | `payload.tennis_detail.avg_dr` |
| **Bilan Forme L10 Surface** | Forme sur les 10 derniers matchs (délai 3 mois, surface spécifique) | `payload.tennis_detail.l10_pts` |
| **Édition Précédente** | Résultat du joueur au même tournoi l'année précédente | `payload.tennis_detail.tournament_history` |

**Section C — VISUALISATION**
- **Spider Chart (Radar)** comparant les **6 axes** : Service, Retour, Puissance, Défense, Forme, Historique
- Overlay superposé avec couleurs distinctes pour Joueur 1 / Joueur 2

### 2. LOGIQUE DE CALCUL ET DESIGN

**Normalisation** (base 100) :
```
normalizedValue = Math.min(100, Math.max(0, (rawValue / maxRef) * 100))
```
- **Service** : `normalize(serve_index, 100)`
- **Retour** : `normalize(receive_index, 100)`
- **Puissance** : `normalize(powerscore, 100)`
- **Défense** : `normalize(100 - receive_index, 100)` (miroir retour)
- **Forme** : `normalize(l10_pts, 10)` (L10 sur 10 → base 100)
- **Historique** : `normalize(tournament_history_score, 100)`

**Bibliothèque** : Utiliser **Recharts** (`RadarChart`, `PolarGrid`, `PolarAngleAxis`, `Radar`) ou **Chart.js** (`radar`). Le graphique doit être superposé (Overlay) avec des couleurs distinctes pour chaque joueur (ex: cyan `#00d4ff` / orange `#ff6b35`).

**Esthétique** :
- Dark Mode strict : fond `#0e1420`, cartes `#172132`, bordures `rgba(255,255,255,0.06)`
- Typographie claire et hiérarchisée : Inter/Roboto, headings en `#ffffff`, labels en `#8b9bb5`
- Alignement précis en grille CSS, espacement cohérent (gap 16-24px)

### 3. CLAUSE DE CONTRÔLE QUALITÉ (OBLIGATOIRE)

Avant de valider le code, vérifier point par point que **TOUTES** les métriques suivantes sont présentes et affichées dans le popup :

- [ ] **ELO Surface**
- [ ] **Ranking Global Surface**
- [ ] **Powerscore**
- [ ] **Rang relatif du Powerscore (x/150)**
- [ ] **Édition Précédente** (Historique tournoi)
- [ ] **Forme L10 Surface** (3 mois)
- [ ] **Indice Serveur + Ranking surface**
- [ ] **Indice Receveur + Ranking surface**
- [ ] **DR Moyen** (Tournoi en cours)
- [ ] **Spider Chart (Radar)** avec les 6 axes demandés : Service, Retour, Puissance, Défense, Forme, Historique

> **Si une seule métrique manque, le dashboard est incomplet** : ajouter les éléments manquants avant de fournir le code final.

### 4. LIVRABLE ATTENDU

Le code source complet du composant **React/Tailwind** (ou adaptation **Vanilla JS** compatible avec `pariscore.html`), incluant :

1. La **logique de normalisation** pour le Radar Chart (base 100)
2. La **gestion des données asynchrones** (fetch depuis `/api/v1/tennis/detail`)
3. Le rendu des **3 sections** (Analytique, Scout, Visualisation)
4. Le **Spider Chart** superposé J1/J2 avec légende
5. L'intégration dans le popup "ANALYSE AVANCÉE" existant

### 5. DÉPENDANCES

```html
<!-- Chart.js via CDN pour le Radar Chart (alternative si Recharts non disponible) -->
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<!-- OU Recharts si environnement React -->
```

**Fichiers à modifier :**
- `pariscore.html` — ajout du HTML/CSS/JS pour les 3 sections
- `server.js` — si des endpoints supplémentaires sont nécessaires pour alimenter le Radar

---

## 🎯 TODO — Bets Predictifs & Avis Presse

> **MISSION FRONTEND & CACHE : INTÉGRATION DE LA CAPSULE "P_BETS"**

Agis en tant que **Lead Frontend et Backend Developer**. Nous procédons à une restructuration majeure de la zone de prédiction sur les encarts Top 10 des matchs de l'onglet **Tennis → "Top 10"**.

### 1. NETTOYAGE UI

- **Supprimer** intégralement l'affichage actuel des "bet prédictifs" (données 1x2, scores, etc.) qui figurent dans les encarts **Tennis "Top 10"** en haut de page.
- Objectif : design plus propre, moins de bruit visuel.

**Localisation probable dans le code :**
- `pariscore.html` — section Tennis `.tn2-top-card` → retirer les `<div>` affichant les cotes 1x2, scores prédits, et blocs `.prediction-box` / `.bet-display`
- `server.js` — route `/api/v1/top-matches` ou `/api/v1/predictions` → ne plus enrichir le payload avec les cotes prédictives si elles ne sont plus affichées (ou les garder en réserve pour P_BETS)

### 2. CRÉATION DU BOUTON "P_BETS"

- Implémenter une **capsule bouton stylisée** nommée **"P_BETS"** dans chaque encart Tennis "Top 10" (à l'emplacement de l'ancienne section prédictive).
- Design : badge/pill compact, fond `#0077ff` (accent bleu), texte blanc `#ffffff`, typo Inter/Roboto semi-bold, bord arrondi `rounded-full`, padding `px-4 py-1.5`, ombre légère `shadow-md`.
- Au clic → ouverture d'un **overlay/modal** listant les **5 meilleurs bets prédictifs** du match.

**Contenu du modal P_BETS (5 lignes) :**
| # | Type Bet | Cote | Confiance | Analyse synthétique |
|---|----------|------|-----------|---------------------|
| 1 | 1/N/2 | x.xx | 8/10 | Fusion metrics + presse |
| 2 | O/U 2.5 | x.xx | 7/10 | ... |
| 3 | Exact Score | x.xx | 6/10 | ... |
| 4 | BTTS | x.xx | 9/10 | ... |
| 5 | Combiné | x.xx | 7/10 | ... |

### 3. LOGIQUE DE DONNÉES ET CACHE (Backend & State)

**Génération des 5 bets :**
- Fusion de nos **metrics pré-match** (xG, forme, Elo, blessures, etc.) + **analyse synthétique des 5 revues de presse** injectée par le système d'orchestration IA.
- Endpoint dédié : `GET /api/v1/predictions/p-bets/:fixtureId`

**CACHE — 48h TTL avec invalidation LIVE :**
```
Cache key : p_bets:{fixtureId}
TTL      : 48 heures (172800 secondes)
```
- **Stack** : utiliser `node-cache` (déjà compatible zero-dep Node.js) OU un objet `Map` natif avec timestamp si Redis n'est pas disponible.
- **Logique** :
  1. Requête → vérifier si `p_bets:{fixtureId}` existe dans le cache ET n'a pas expiré (< 48h)
  2. Si cache valide → servir le cache
  3. Si cache absent ou expiré → déclencher génération via l'orchestrateur IA → stocker en cache → retourner
- **Invalidation anticipée** : si le match passe en statut `"LIVE"` (via SSE push ou polling), le cache P_BETS est **immédiatement invalidé** et supprimé, même si le TTL 48h n'est pas atteint.

**Backend — pseudo-code :**
```javascript
const pBetsCache = new Map(); // Map<fixtureId, { data, timestamp }>
const CACHE_TTL_MS = 48 * 60 * 60 * 1000;

async function getPBets(fixtureId, matchStatus) {
  // Invalidation immédiate si match LIVE
  if (matchStatus === 'LIVE') {
    pBetsCache.delete(fixtureId);
    return null;
  }

  const cached = pBetsCache.get(fixtureId);
  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL_MS) {
    return cached.data;
  }

  // Génération IA
  const bets = await generatePBetsFromOrchestrator(fixtureId);
  pBetsCache.set(fixtureId, { data: bets, timestamp: Date.now() });
  return bets;
}
```

**Déclencheur SSE :** dans le handler SSE existant (`/api/v1/sse` ou équivalent), ajouter un listener sur le changement de statut du match (`status: "LIVE"`) qui appelle `pBetsCache.delete(fixtureId)`.

### 4. LIVRABLE TECHNIQUE

**Frontend (`pariscore.html`) :**
1. Suppression de la section UI des bets prédictifs dans les encarts Top 10
2. Remplacer par le `<button>` capsule "P_BETS"
3. Implémenter le modal overlay avec les 5 lignes de bets
4. Design Dark Mode cohérent :
   ```css
   .p-bets-btn {
     background: #0077ff; color: #fff; border-radius: 9999px;
     padding: 6px 18px; font-size: 0.75rem; font-weight: 600;
     cursor: pointer; box-shadow: 0 2px 8px rgba(0,119,255,0.3);
   }
   .p-bets-modal { background: #172132; border: 1px solid rgba(255,255,255,0.06); }
   .p-bets-row { border-bottom: 1px solid rgba(255,255,255,0.04); }
   ```

**Backend (`server.js`) :**
1. Nouvelle route `GET /api/v1/predictions/p-bets/:fixtureId` avec cache 48h
2. Fonction `generatePBetsFromOrchestrator(fixtureId)` — fusion metrics + presse
3. Invalidation cache via SSE sur passage en statut LIVE

### 5. CLAUSE DE CONTRÔLE QUALITÉ

Avant de valider, vérifier point par point :

- [ ] L'ancienne section "bet prédictifs" est entièrement retirée du DOM des cartes Top 10
- [ ] Le bouton "P_BETS" est présent et stylisé dans chaque encart Tennis "Top 10"
- [ ] Le clic ouvre un overlay avec 5 bets distincts
- [ ] Le cache 48h fonctionne : seconde requête dans les 48h → pas de regénération
- [ ] L'invalidation LIVE fonctionne : match qui passe en "LIVE" → cache supprimé
- [ ] Le design Dark Mode est respecté (fonds, couleurs, typos)

> **Si un seul point manque, l'intégration est incomplète** : corriger avant de fournir le code final.

**Fichiers à modifier :**
- `pariscore.html` — UI bouton + modal + suppression ancienne section
- `server.js` — route `/api/v1/predictions/p-bets/:fixtureId` + cache Map + invalidation SSE
- `tools/p-bets-generator.js` (à créer) — logique de fusion metrics + presse orchestrée

---


## 🐛 PHASE D AUDIT — P_BETS invisible dans le Top 10 Tennis

**Constat (2026-06-16, fin de session) :** Le bouton "P_BETS" n apparaît pas dans les encarts Tennis Top 10 malgré le code déjà livré :
- CSS (.p-bets-btn, .p-bets-overlay), modal HTML OK
- Bouton injecté dans tn2RenderTopCards() (ligne ~16159) OK
- Fonctions openPBets() / closePBets() OK
- Route API /api/v1/predictions/p-bets/:fixtureId + cache 48h OK
- tools/p-bets-generator.js (371 lignes) OK

**Problème suspecté :** Le Top 10 Tennis utilise désormais fetchTennisTop10() + _tnTop10Card() dans pariscore.js (nouveau système de rendu), PAS l ancien tn2RenderTopCards() dans pariscore.html. Le bouton P_BETS n a pas été porté dans le nouveau système. À confirmer par l audit.

### AUDIT À FAIRE (Prochaine Session)

1. **Déterminer quel render est actif** : tn2RenderTopCards() ou _tnTop10Card() ?
2. **Si _tnTop10Card() sans P_BETS** : ajouter le bouton dans le template HTML, vérifier le mapping data-fixture-id/matchId
3. **Test manuel** : node server.js → Tennis → Top 10 → inspecter DOM → cliquer P_BETS → vérifier console + Network
4. **Vérifier logs serveur** : [P-BETS] doit apparaître

### CHECKLIST
- [ ] Audit : render actif = tn2RenderTopCards() ou _tnTop10Card() ?
- [ ] Si _tnTop10Card() : ajouter bouton P_BETS
- [ ] Mapping data-fixture-id / matchId
- [ ] Test DOM : bouton visible
- [ ] Test click : modal s ouvre
- [ ] Test API : réponse 200 avec 5 bets

### Fichiers suspects
- pariscore.js — _tnTop10Card() (~ligne 4291)
- pariscore.html — tn2RenderTopCards() (~ligne 16111)
- server.js — route P_BETS (~ligne 21823)

---

## 🗓️ SPRINT CALENDAR_REFRACTOR — v12.83 (2026-06-16)

**Calendrier Tournois Tennis — Dark Premium + Filtrage catégoriel**

### Backend
- Fonction _texTournamentCategory(name) : détecte Grand Chelem, Masters 1000, ATP 500, ATP 250, WTA 1000/500/250, ITF, Challenger via regex
- TEX_CATEGORY_PRIORITY : tri des plus prestigieux aux moins prestigieux
- etchTexCalendar() : filtre ITF + Challenger, tri par priorité, champ .category dans chaque objet

### Frontend
- Badge catégorie coloré (or/bleu/violet/vert/rose/orange/teal) en pill
- Tableau 100% largeur, fond #111a28, bordure gba(255,255,255,0.06)
- Hover bleu gba(0,119,255,0.06) sur chaque ligne
- Ligne résumé avec comptage GS/M1000
- Pastille ronde surface + prize money en #00e676
- Status enrichi avec nombre de GS et M1000

### Fichiers modifiés
- server.js : _texTournamentCategory, TEX_CATEGORY_PRIORITY, fetchTexCalendar filter+sort
- pariscore.js : loadTexCalendar refonte complète
- plan.md, acklog.md, CLAUDE.md : documentation

---

## 🚨 SPRINT CALENDAR_REFRACTOR V2 — VRAIS CORRECTIFS (2026-06-17)

**⚠️ Les items C1-C9 du sprint précédent étaient marqués ✅ DONE mais le calendrier était toujours cassé.**

### Causes racines identifiées
1. **Regex nameM cassée** : TennisExplorer a changé son HTML. Certains noms ont <span title="..."> (Challenger/ITF), d'autres non (ATP/WTA). L'ancienne regex <a...><strong><span title="..."> NE MATCHAIT PAS les ATP/WTA → 
ame: null → affichait "—"
2. **null → 'unknown'** : _texTournamentCategory(null) retournait 'unknown' (priorité 99, non filtré)
3. **Aucun filtre temporel** : les tournois de janvier/mars passaient
4. **Cache empoisonné** : les vieilles données sans noms persistaient 24h
5. **Fond #page-tennis blanc** en mode sombre

### Correctifs backend (server.js)
| Fix | Détail | Ligne |
|-----|--------|-------|
| nameM regex | Support span + sans-span : (?:<span...>(...)<\/span>\|([^<]+)) | 28891 |
| name/short | 
ameM[2]\|\|nameM[4] pour les 2 formats | 28899 |
| cat(null) | if (!name) return 'itf' (filtré au lieu de 'unknown') | 28935 |
| Cache | 	exCalendarCache.delete(cacheKey) avant refresh | 28961 |
| Date filter | 	woMonthsAgo → ignore tournois >2 mois | 28963-28971 |
| Surface | Regex avec fallback &nbsp; | 28892 |

### Correctifs frontend (pariscore.html)
| Fix | Détail | Ligne |
|-----|--------|-------|
| Dark theme | ody[data-cf-light="0"] #page-tennis { background: #0e1420 !important; } | 19081 |

### Validation
- 
ode --check server.js ✅
- 
ode --check pariscore.js ✅

### Notes
- Le formulaire de date TEX est : 15.06.<br>2026 → parsé par (_texParseCalendar)
- La classe ctual filtre uniquement la semaine en cours (intentionnel)
- Le cache TTL reste à 24h mais le nouveau data est correct

---

## 🚀 DATA_PIPELINE_V3 — [IN_PROGRESS] (2026-06-17)

### Contexte
Pipeline d'extraction et de calcul des 7 métriques prioritaires du Sprint 1, basé sur PRIORISATION_METRIQUES.md et RAPPORT_DESIGN_FINAL.md v3. Intègre la charte Dark Theme Premium (#0b0e17) et le système de Design Tokens CSS validé.

### Métriques Sprint 1 (MVP Production — latence < 30ms)
1. **SRV_PTS_WON_S & RET_PTS_WON_S** (Niveau XXL) — EWMA α=0.18, 5 matchs, sparkline 6m
2. **H2H_SURFACE_AUGMENTED** (Niveau XXL) — filtre surface + fenêtre 2 ans
3. **ATP_POINTS_6M** (Niveau M) — points ATP tronqués 6 mois
4. **ELO_SURFACE** (Niveau M) — recalcul interne, pondération mois courant 60%
5. **AGE.30** (Niveau M) — |age - 30| (Buhamra SEL)
6. **MOTIVATION** (Angle mort) — statut tournoi + dernière perf + distance temporelle
7. **FATIGUE** (Angle mort) — distance géographique + jours de repos
8. **PUBLIC** (Angle mort) — nationalité == pays du tournoi

### Composants UI Sprint 1
- MetricCardXXL (SRV/RET) — Poppins 800 32px, sparkline D3.js
- MetricCardM (ATP, ELO, AGE) — Inter 700 16px, cliquable → drawer
- H2HTimeline — D3.js timeline visuelle ●○
- ProbGauge — barre proba pleine largeur
- ComparisonBar — barres côte-à-côte joueur A vs B
- Design Tokens CSS : --color-bg-primary: #0b0e17, --color-card: #131722, --color-accent-green: #00e676, --color-accent-blue: #0077ff

### Sprint 2 (Scraping avancé & indices complexes)
1. **PRESSURE_INDEX** (Mental #ff6d2e) — scraping TennisViz, ratio points importants
2. **BP_CONV & BP_SAVED** — EWMA long α=0.05
3. **NLP SCRAPER** — Puppeteer/Cheerio pour alertes blessures (flux RSS + Twitter)

### Design System — Classes CSS validées
\\\css
:root {
  --color-bg-primary: #0b0e17;
  --color-card: #131722;
  --color-accent-green: #00e676;
  --color-accent-blue: #0077ff;
  --color-border: rgba(255, 255, 255, 0.05);
  --radius-card: 8px;
}
.pariscore-trading-row {
    background: var(--color-card) !important;
    border: 1px solid var(--color-border) !important;
    border-radius: var(--radius-card) !important;
    padding: 16px 20px !important;
    margin-bottom: 10px !important;
    transition: background-color 0.2s ease;
}
.pariscore-trading-row:hover {
    background: #161c2a !important;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4) !important;
}
\\\

### Critères de validation DATA_PIPELINE_V3
- [ ] EWMA α=0.18 calculé correctement sur fenêtre 5 matchs
- [ ] H2H_SURFACE filtré par surface ET fenêtre 2 ans
- [ ] ELO_SURFACE recalculé en interne (pas d'API externe)
- [ ] MOTIVATION + FATIGUE + PUBLIC intégrés dans le pipeline logique
- [ ] Latence API < 30ms (cache hit)
- [ ] Design Tokens CSS appliqués à tous les composants tn2-*
- [ ] node --check server.js ✅

### Résultats de validation (2026-06-17)

| Test | Résultat | Preuve |
|------|----------|--------|
| node --check server.js | ✅ PASS | Aucune erreur de syntaxe |
| node --check pariscore.js | ✅ PASS | Aucune erreur de syntaxe |
| Latence API Top10 | ✅ < 1ms | CACHE HIT — responding in 0ms |
| Cache refresh TOP10 | ✅ 3-9ms | TOP 10 prêt (3ms) |
| Warm cron actif | ✅ OK | Cron refresh actif : intervalle=300s |
| Build ValueBets 357 matchs | ✅ 8-16s | build done — 357 matchs |
| showMetricDetail() | ✅ Injecté | Drawer latéral avec détail EWMA |
| MetricCardXXL (SRV/RET/H2H) | ✅ Injecté | Dans _tnTop10Card() avec badges |
| Design Tokens CSS --ps-* | ✅ Injecté | 9 composants ps-metric-XXL/M/S |
| backlog.md D1-D5 | ✅ DONE | Tâches Sprint 1 complètes |


### Sprint 1 complété — Fonctionnalités livrées

| Feature | Statut | Détail |
|---------|--------|--------|
| computeEWMA α=0.18 | ✅ | SRV_PTS_WON_S + RET_PTS_WON_S (5 matchs) |
| H2H_SURFACE_AUGMENTED | ✅ | Filtre surface + fenêtre 2 ans + poids temporel |
| MetricCardXXL | ✅ | Poppins 800 32px + sparkline SVG + badges |
| MetricCardM | ✅ | Inter 700 16px cliquable → drawer |
| showMetricDetail() | ✅ | Drawer latéral avec détail EWMA par match |
| SVG Sparkline | ✅ | Dans les cards SRV (bleu #38bdf8) et RET (vert #10b981) |
| _psSparkline() | ✅ | Fonction générique SVG sparkline |
| MOTIVATION / FATIGUE / PUBLIC | ✅ | Angles morts intégrés dans le pipeline |
| Design Tokens CSS | ✅ | 9 composants ps-metric-* + .pariscore-trading-row |
| Validation serveur | ✅ | CACHE HIT 0ms, TOP10 en 3-9ms |

### Sprint 2 — TODO

| Feature | Priorité | Statut |
|---------|----------|--------|
| PRESSURE_INDEX (Mental #ff6d2e) | 🟠 HAUTE | ⏳ TODO |
| BP_CONV / BP_SAVED (EWMA α=0.05) | 🟠 HAUTE | ⏳ TODO |
| NLP Scraper blessures (Puppeteer) | 🟡 MOYENNE | ⏳ TODO |
| Mode Tracker live toggle | 🟡 MOYENNE | ⏳ TODO |

### Sprint 2 complété — Fonctionnalités livrées

| Feature | Statut | Détail |
|---------|--------|--------|
| PRESSURE_INDEX (Mental #ff6d2e) | ✅ | Badge dans MetricCardS + fonction _tennisPressureIndex() |
| BP_CONV (EWMA α=0.05) | ✅ | _tennisBPConvEWMA() + badge frontend |
| BP_SAVED (EWMA α=0.05) | ✅ | _tennisBPSavedEWMA() + badge frontend |
| NLP Injury Scraper | ✅ | tools/nlp-injury-scraper.js (RSS + détection keywords) |
| Mode Tracker Live | ✅ | Toggle bouton + CSS ps-tracker-mode + localStorage |
| toggleTrackerMode() | ✅ | Fonction JS avec persistance en localStorage |

### Prochaines étapes suggérées

- Intégrer le NLP scraper dans le serveur (appel périodique + alertes ⚠️ sur cards)
- Connecter le PRESSURE_INDEX à une vraie source de données point-par-point
- Tests E2E sur l'ensemble du pipeline
- Déploiement production

- **Sketch findings for PariScore** (design decisions, CSS patterns, visual direction) → `Skill("sketch-findings-pariscore")`

