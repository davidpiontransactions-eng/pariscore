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

---

*Dernière mise à jour : v12.31 — 21/05/2026. CLAUDE.md purgé (v7.1 → v12.31 historisés dans `CHANGELOG.md`). Source vérité tâches = `bd ready`.*
