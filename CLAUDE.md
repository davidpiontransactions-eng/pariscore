# 🏟️ PariScore — Poste de Pilotage (v12.65 — bd-driven)

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
- **Sources data** : BSD (Bzzoiro Sports Addon $5/mo + WS push), ESPN public, Odds API, openfootball ODbL, Wikidata CC0 (v12.62 wire 56 winners tennis), felipeall/transfermarkt-api sidecar self-host, elofootball community, aiscore.com on-demand throttled (tennis serving fallback v12.65)
- **Sources backlog DG decision** : Tennismylife/TML-Database MIT (substitution Sackmann NC, bd `8uoc`), xvalue.ai (GO ferme 85/100 bd `ffh`), OddsPapi.io free Pinnacle sharp (bd `bjv` POC), RapidAPI odds-api1 (bd `bjv` Phase 1 404 endpoints)
- **Déploiement** : VPS OVH `/home/ubuntu/pariscore` via WinSCP ou `git pull` + `pm2 restart pariscore`
- **Persistance ETL** : `db.archive_matches` alimenté par 8 sources (3 live runtime + 5 ETL bootstrap). Inventaire : `.context/databases_historique_inventory.md` + `.csv`

---

## 🔥 TÂCHES EN COURS

Source autoritaire : `bd list --status=in_progress`. Snapshot 22/05/2026.

| ID | P | Titre | État |
|---|---|---|---|
| `9je` | P0 | Pipeline ETL Historique Football API-Football PRO | Code livré v12.10 · run bloqué quota épuisé (reset minuit UTC) |
| `6du6` | P0 | DB historique tennis+foot datasets gratuits (openfootball ODbL + Wikidata CC0) | Phase 2 Wikidata wire 56 winners livré v12.63 · deploy VPS attendu |
| `c8m` | P0 | SECURITY — server.js exposé + rotation clés | 11 clés rotées + ufw ban + fix code deployed · reste audit_db postbreach VPS |
| `s77m` | P0 | Stripe Checkout + Webhook + Customer Portal | Code livré v12.43 · attente decisions DG (trial, prix, matchday) |
| `401` | P1 | Crash Test audit onglets Football + Tennis | rapport_qa_foot_tennis.md livré · 28 risk flags |
| `bjv` | P1 | Spike sourcing cotes alternative Odds API | Phase 1 odds-api1 RapidAPI 404 confirmé · Pinnacle research NO-GO direct · POC OddsPapi.io pending DG |
| `5iw` | P1 | Intégration BSD Live WebSocket foot (<5s) CdM 2026 | WS connecté zero-dep validé · reste validation schema payload live VPS |
| `8lqf` | P2 | Spike FBref via soccerdata Python | RESEARCH ONLY scaffold livré v12.30 |

## 🎯 TÂCHES À FAIRE — Queue prioritaire

Source autoritaire : `bd ready`. Snapshot 21/05/2026.

### P0 (priorité absolue) — bloqué ops/DG

Toutes les P0 actuellement in_progress ont leur code livré. Restants = actions VPS/DG hors scope code.

| ID | Titre | Action immédiate |
|---|---|---|
| `9je` | ETL Football post quota reset | `bash .context/run_etl_2024_2026.sh` VPS à minuit UTC |
| `6du6` | Wikidata CC0 wire Phase 2 | Deploy VPS : `git pull` + `pm2 restart pariscore` + verif log `ETL seed merge (wikidata CC0): 56/56` |
| `c8m` | Audit DB postbreach | `bash security_db_audit_postbreach.sh` VPS (rotation + ufw déjà faits) |
| `s77m` | Stripe activation | DG checklist `.context/stripe_dg_checklist.md` — 9 sections (trial, prix mensuel/annuel/mono-sport, matchday pass) |

### P1 (ouvert ou ops pending)

| ID | Titre | État |
|---|---|---|
| `d4rd` | GSC validation post-fix robots.txt — URL Inspection + resubmit sitemap | ops DG |
| `u5x` | SEO fix GSC « Bloquée par robots.txt » (recoupé `d4rd`) | ops DG |
| `x9s` | Plug oddsapi RapidAPI odds-api1 sur TOUS champs cotes | BLOCKED bjv Phase 1 404 |
| `b50` | DB pariscore.db SQLITE_NOTADB runtime — investigate corruption ops | ops VPS |
| `e7l` | Version mobile PariScore (parieur nomade) — bottom nav + cartes + PWA | Phase 5/7 PWA install + push livrés v12.19+v12.21 · reste 2/7 |
| `qe5` | Live Dashboard Betting Cockpit Phase 1 — Win Prob + Top3 picks + events markers + verdict | Phase 1 partial livré v12.62 (Minute promue + cockpit) · Phase 2/3 spec |
| `j5lb` | **[DECISION DG]** GO/NO-GO 6 études bloquées arbitrage | DG decision |
| `p2if` | AI-AL Revue de Presse Foot+Tennis — 5 avis presse panel Gemini | Phase 1 livré commit `ae6a292` · Phase 2 Telegram push + RSS L'Équipe ouverte |
| `8uoc` | **[DECISION DG]** Tennis Abstract + autres DBs tennis | Research v2 livré commit `2ce9463` (TML-Database MIT) · 3 questions DG Q1/Q2/Q3 |

**✓ FERMÉS session 22/05/2026 v12.65 (8 P1)**

| ID | Livraison |
|---|---|
| `c5i` | Tennis serveur invisible Phase 3 — aiscore on-demand throttled fetch — commit `fbea217` |
| `izsn` | safeFixed() wrapper 51 sites server.js + 2 sites pariscore.html — commits `bce7535`+`16c6a9d` |
| `8c5` | Momentum plat La Liga — split `live_momentum_pct` objet vs array Sofa + follow-up Array.isArray guards consumers — commits `38ffa7b`+`9ba089a` |
| `lyku` | Routage LIGA classement ID 3 — confirmé déjà fixé `server.js:10676-10685` (surgical override events-derived) |
| `k3ex` | Tennis ATP/WTA matchs féminins disparus tournois mixtes — fix livré v12.38 (BSD circuit re-derive depuis gender+tournament name) |
| `u8w9` | Mobile page blanche filtres iOS Safari + Chrome Android — fix livrés (presets selectors + apiFetch 401 token clear) |
| `8lvf` | elofootball.com Elo historique massif — Phase 1-3 livrées v12.31-v12.40 (1902 matchs + 50 rankings) |
| `4cog` | Tennis Consolidation LOT P0 — 5/5 sub-tasks déjà implémentés post-audit |
| `c8zp` | Cron capture tennis finals + cleanup history-edges legacy — Phase 1+2 livrés v12.64 |

### P2 (queue)

| ID | Titre | État |
|---|---|---|
| `kto1` | Research: tennisabstract.com WP interactivity-api — rapport incorporation | open |
| `m5sv` | Research: GitHub n63li/Tennis-API — rapport incorporation | open |
| `1hiv` | Research: sportsdata.io Tennis API — rapport incorporation (pricing+coverage+ROI) | open |
| `wect` | ETL Historique FBref soccerdata — RESEARCH ONLY (doublon `8lqf` à fusionner) | open |
| `5vzv` | Spike footballdatabase.com — audit ETL faisabilité vs ToS+CF | open (CF wall) |
| `qkx` | Spike eval odds-api1 RapidAPI candidate | open (couplé `bjv` Phase 1 fail) |
| `e3mr` | Tennis Consolidation LOT P1+P2 — Backtest Brier + Serve/Return point-level + UQD | open |
| `l9vk` | Marketing Affiliation 5 phases — 1xBet+Twitter+YouTube+Telegram+Stripe | open |
| `ryi3` | Routing schema Phase 2+ — health + Understat + metrics + affiliate CRUD | Phase 2A livré v12.65 commit `117c711` (`/api/v1/sources/health`) · Phases 2B/2C/2D ouvertes |
| `968x` | SEO/AEO Growth strategy — llms.txt + Structured Data + SSR scores + /about E-E-A-T | open |
| `0hf4` | **BSD coverage Phase 1** — TV channels + broadcasts (fetchers + caches + helper attach) | Phase 1 livré v12.65 commit `d10ab09` · Phases 1.1/2/3 ouvertes |
| `j6pz` | **BSD coverage Phase 2** — Shotmap + best_odds + bookmakers (3 endpoints REST + UI shotmap SVG modal Live Dashboard) | open · 3-4h |
| `ueg0` | **BSD coverage Phase 3** — Social items sentiment buzz match (badge cellule + section modal Insights) | open · 2h |
| `82th` | **BSD coverage Phase 4** — Referees + Venues + Leagues dynamic (enrichissement modal Contexte stade/arbitre/ligue) | open · 3-4h |

> **BSD MCP coverage roadmap (22/05/2026)** : 17/28 endpoints déjà plugués via `bsdFetch()` REST direct. 11 gaps découpés en 5 phases. Phase 1 TV broadcasters en cours (bg agent, bd ticket créé pendant exec). Phases 2-5 = `j6pz` `ueg0` `82th` `r0v3` (P3). Effort total 12-15h dev. Source: audit MCP `bsd-sports` 28 tools vs grep `bsdFetch()` server.js 22/05.

**✓ FERMÉS session 22/05/2026 v12.65 (6)**

| ID | Livraison |
|---|---|
| `nwk6` | PWA Push Notifications backend — Phase 1 livré v12.49 (VAPID ES256 zero-dep + 4 routes + auto-cleanup 410/404) |
| `ffh` | Spike 6 sources data — commit `1280dfb` livrable `.context/spike-ffh-6sources-eval-final.md` (GO ferme xvalue.ai 85/100) |
| `k37` | Bug UI teinte rose tableau Foot — commit `8b99cb2` (coral leak `tr.match-row-live::before` box-shadow 14→6px + keyframe + remove !important) |
| `c9p4` | Roadmap v4.x backlog tableau principal — closed stale dup (8 items déjà cochés `[x]` commit `5e18185` CLAUDE.md section 15 sync drift) |
| `rlhf` | Module audio alertes trading — commit `fc9c65e` (state tracking transitions + orchestrateur 4 indicateurs + queue 200ms cap 3 sons/burst) |
| `x11y` | Tennis indicateurs jeux dynamiques — closed stale dup (code présent pariscore.html:14813 O7.5/O8.5/O9.5/U12.5) |

### P3 (research)

| ID | Titre |
|---|---|
| `gz7s` | Benchmark Rotowire Soccer — ideas to steal (orphan CLAUDE.md→bd) |
| `r0v3` | BSD coverage Phase 5 — Squad endpoint + fixtures variant (proxies REST simples, LOW ROI, 1-2h) |
| `qm6a` | **Flashscore datasets integration** — voir sous-table dédiée ci-dessous (6 plans A-F) |
| `6jro` | **Sofascore Apify datasets integration** — voir sous-table dédiée ci-dessous (4 plans G-J) |

#### Sous-tâches `qm6a` Flashscore datasets — 6 plans

Datasets Apify one-shot disponibles racine projet:
- `dataset_flashscore-team-stats_2026-05-21_23-54-30-172.json` (48K, 80 entries: 20 EPL foot + 60 NBA basket hors scope)
- `dataset_flashscore-live-matches_2026-05-22_00-03-54-224.json` (39K, 3 matchs live foot riches)

| Plan | Phase | Tâche | Effort | ROI | Use case |
|---|---|---|---|---|---|
| **A** | 1 | Logos backup — ETL ingest `team_logo_url` Flashscore CDN dans `bsd_team_logos` cache, fallback chain BSD → Sofa → Flashscore | 30min | HIGH | Backup logos haute-qualité |
| **B** | 2 | Standings fallback offline — `db.flashscore_standings` layer dédié, trigger si BSD+ESPN+API-Football tous HS | 1-2h | MED | Resilience triple-source HS |
| **C** | 3 | Cross-ref team naming validation — Map Flashscore slug → BSD team_id (fuzzy normName), audit script divergences | 2h | MED | Validation normName + CI/CD |
| **D** | 4 | Venue + referee enrichment — alternative à bd `82th` BSD Phase 4, cross-source modal Contexte | 1h | MED | Backup `82th` |
| **E** | 5 | Lineups + statistics live fallback — gap-fill quand BSD live partial (ESPN-only matchs), map stat_name → `live_*` champs | 1-2h | MED | Live data robustness |
| **F** | 6 | `has_live_stream` flag UI — badge "Live TV" tableau matchs (icone TV), reuse pattern bd `0hf4` | 30min | LOW | UX nice-to-have |

**Effort total cumul:** ~6-7h si tous exécutés.
**Limite:** datasets Apify one-shot ≠ feed continu. Value durable nécessite scraper continuous (Apify subscription) OU pivot xvalue.ai (bd `ffh` GO 85/100).
**Ordre recommandé:** A (quick win logos) → F (badge UI) → D (venue+referee alt 82th) → E (live fallback) → B (standings backup) → C (validation audit).

#### Sous-tâches `6jro` Sofascore Apify datasets — 4 plans

Dataset Apify one-shot disponible racine projet:
- `dataset_sofascore-scraper-pro_2026-05-22_00-07-03-587.json` (110K, 2 entries: 1 tennis player profile + 1 football match detail)

| Plan | Phase | Tâche | Effort | ROI | Use case |
|---|---|---|---|---|---|
| **G** | 1 | Tennis player profile enrichment — ETL `teamRankings` + `teamGrandSlamBestResults` → modal Insights tennis section "Historique Grand Slam" | 1-2h | HIGH | Tennis profile pro |
| **H** | 2 | Football `initialFeaturedArticle` editorial — Sofascore editorial team article URL+title+excerpt → modal Insights foot "Avant-Match" (UNIQUE vs BSD) | 1h | MED | Editorial unique source |
| **I** | 3 | Tennis `hasSingles`/`hasDoubles` flags — filter onglet Tennis bouton "Doubles uniquement" | 30min | LOW | Filtre niche |
| **J** | 4 | Sofascore continuous scraper webhook — alternative permanent feed vs Apify one-shot — ⚠️ conflit potentiel bd `ffh` (Sofascore = 53/100 NO-GO car redondant BSD live, mais profile/historique = use case distinct) | 3-4h | MED | Permanent feed profile data |

**Effort total cumul:** ~5-7h si tous exécutés.
**Note bd `ffh` cross-ref:** Sofascore catégorisé NO-GO uniquement pour use case LIVE (redondant BSD WS). Use case PROFILE/HISTORIQUE distinct → Plan J réserve fenêtre potentielle.
**Ordre recommandé:** G (tennis profile = HIGH ROI) → H (editorial unique) → I (filtre niche) → J (reserve continuous feed décision DG).

> **Sweep documentation .md 21/05/2026** : 165 fichiers scannés, 110 tâches uniques extraites (cross-réf bd existants). Détail dans `.context/_tasks_sweep_md_20260521.md`. 13 nouveaux bd créés (P1: `j5lb p2if 4cog k3ex lyku u8w9 izsn c8zp` · P2: `e3mr l9vk ryi3 968x c9p4`).
>
> **Sync drift 21/05/2026 v12.63** : `rxh` closed (prod v12.43), `h9j7` closed, `6du6` Phase 2 wikidata wire livré. 3 orphan missions CLAUDE.md → bd créés (`rlhf` audio · `x11y` tennis indicators · `gz7s` Rotowire benchmark).
>
> **Sync drift 22/05/2026 v12.65** : 14 commits push session — `5e18185` CLAUDE.md drift section 15 · `fbea217` c5i Phase 3 aiscore on-demand · `bce7535`+`16c6a9d` izsn safeFixed wraps · `38ffa7b`+`9ba089a` 8c5 momentum La Liga (split live_momentum_pct objet vs array Sofa + follow-up Array.isArray guards consumers) · `ae6a292` p2if AI-AL Revue Presse 5 sources · `72d5e8a`+`0754a33` bjv spike RapidAPI + Pinnacle research + POC OddsPapi · `2ce9463` 8uoc Tennis sourcing v2 TML MIT · `8b99cb2` k37 coral leak · `fc9c65e` rlhf audio orchestrateur · `1280dfb` ffh 6 sources (GO xvalue.ai) · `117c711` ryi3 Phase 2A health route. Closed: `c9p4`+`x11y`+`c8zp`+`8c5` (stale dup/livré).

## 🧠 INNOVATION BACKLOG (Edge mathématique)

- **Bayesian Value Radar** — Data Blending Poisson Bivarié + Elo dynamique + xG Logistic
- **Bootstrap UQD** — 500 itérations IC90 par match
- **Score composite fiabilité /100** — volume data + stabilité xG + calibration
- **Règle BET stricte** — EV>5% ET borne inférieure IC>0
- **Poisson Time-Inhomogène** — modèle live conditionnel minute par minute
- **Context Engine** — météo + arbitres + kilométrage déplacements
- **Alertes SSE** — triggers `favorite_trap` + `goal_flood`

**Nouvelles pistes 22/05/2026 v12.65 (règle 1 PROTOCOLE — 3 propositions session):**

- **xvalue.ai ML scouting clustering** (cf. bd `ffh` GO 85/100) — branch xG advanced + clustering 30 ligues dans pipeline `buildMatchRecord`, composante "form-style fingerprint" qui détecte les anomalies tactiques pré-match (changement coach, blessure clé). Sortie : `style_shift_score` 0-100 contribuant à `confidence_badge`.
- **Pinnacle sharp calibration via OddsPapi.io free** (cf. bd `bjv` Plan C 250 req/mo) — utiliser cote Pinnacle dans `computeWFV1N2` comme ancrage low-vig, recalibrer `detectSurebet1N2` avec sharps low-marge, mesurer reduction faux positifs ValueBet (estim. -5 à -10% bias). POC mesurable backtest 50 matchs.
- **Pattern on-demand throttled généralisé** (cf. bd `c5i` Phase 3 livré `fbea217`) — étendre paradigme `fetchAiscoreServingOnDemand` (5/poll + cooldown 10min/miss) à d'autres data gaps : `fetchAiscoreLineupsOnDemand` (lineups manquants BSD/ESPN), `fetchSofascoreEditorialOnDemand` (bd `6jro` Plan H article preview), `fetchOddsPapiPinnacleOnDemand` (anchor sharp ad-hoc). Helper générique `withOnDemandThrottle(fetcher, opts)`.

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


### État livraisons SaaS (Auth + Stripe)

| Composant | État | Locus |
|---|---|---|
| **Schema users SQLite** | ✅ livré | `server.js:3658+` (table `users` + cols `stripe_customer_id` + `stripe_subscription_id` + `premium_until`) |
| **JWT + bcrypt auth** | ✅ livré | `server.js:14120+` (routes `/api/v1/auth/login/register/me` + middleware Premium gate `FOOT_PRO` set) |
| **Stripe Checkout backend** | ✅ livré v12.43 | `stripeRequest()` `server.js:13893+` + route `/api/v1/checkout/matchday` + table `stripe_events` |
| **Stripe Webhook signature verify** | ✅ livré | `/api/v1/webhook/stripe` payload brut + `event_id` dedup |
| **Customer Portal** | ✅ livré v12.43 | bd `s77m` |
| **DG activation** | ⏳ pending | bd `s77m` — checklist `.context/stripe_dg_checklist.md` (9 sections : trial, prix mensuel/annuel/mono-sport, matchday pass) |

**Décisions DG bloquantes** (toutes pré-activation Stripe live):
1. Prix mensuel Pro €19 confirmé ? annuel ? mono-sport (foot only / tennis only) ?
2. Trial gratuit 7j / 14j / aucun ?
3. Matchday pass €X.XX one-time J-1 active ?
4. Currency : € only ou multi-devise launch ?
5. Webhook secret `whsec_...` configuré .env VPS ?
6. Stripe Connect (affiliate) Phase 2 ou jamais ?
7. Refund policy (no-refund SaaS / 14j cooling-off EU) ?
8. Cancellation flow UX (immediate vs end-of-period) ?
9. Pricing page Public — toggle test/live mode ?

> ⚠️ Tant que checklist DG non validée, le code Stripe reste TEST MODE. Pas de `sk_live_*` injecté.

## 🗄️ MISSIONS LIVRÉES (archived — voir CHANGELOG.md / bd notes)

5 missions historiques purgées 22/05/2026 v12.65 (poste pilotage, pas journal — règle 1):

| Mission | bd | Livraison |
|---|---|---|
| Tennis serveur live invisible | `c5i` | Phase 1+2+3 livrés (aiscore cache + parity inference + on-demand throttled) commits `fbea217` |
| Module audio alertes Bloomberg | `rlhf` | state tracking 4 indicateurs + queue 200ms commit `fc9c65e` |
| Indicateurs dynamiques tennis O7.5/O8.5/U12.5 | `x11y` | code présent pariscore.html:14813 (closed stale dup) |
| Bugfix autoplay DOMException | — | `playPromise.catch` silencieux pariscore.html:31652 |
| UI contraste teinte rose tableau Foot | `k37` | coral leak fix commit `8b99cb2` (`tr.match-row-live::before` box-shadow scope) |
| Benchmark Rotowire Soccer | `gz7s` | P3 open — rapport à livrer (voir bd description spec) |

*Dernière mise à jour : v12.65 — 22/05/2026. CLAUDE.md purgé (5 missions livrées → bd notes + CHANGELOG.md). Sync drift bd↔CLAUDE.md effectué. Source vérité tâches = `bd ready`.*
