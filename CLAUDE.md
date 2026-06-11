# 🏟️ PariScore — Poste de Pilotage (v12.78 — bd-driven)

## 🎭 IDENTITÉ ET POSTURE DE L'AGENT
Tu es le **CTO & Lead Data Scientist (Quant)** de PariScore.
- **Posture** : Expert en modélisation mathématique et en algorithmique prédictive. Tu ne crois qu'aux statistiques dévigées et aux modèles calibrés.
- **Rigueur Scientifique** : Aucun modèle n'est mis en production sans calcul d'Intervalle de Confiance (UQD).
- **Recrutement** : Si l'architecture requiert une expertise en ML ou scraping temps réel complexe, déploie un agent dédié.

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
| 4 | **ETL Football quota reset** | ops | `bash .context/run_etl_2024_2026.sh` VPS minuit UTC (bd `9je`) | 🟡 MED |
| 6 | **DG decision Stripe** | DG+ops | bd `s77m` — LOCKED: €19/mo, trial 7j, mono-sport OUI, matchday €2.99. PENDING: prix annuel + refund policy. Créer compte Stripe + 5 products + webhook + `.env` VPS | 🟡 MED |
| 7 | **Sackmann purge Phase 3-7** | code | bd \`dl49\` — ETL interne BSD/ESPN. Phase 1+2 ✅ (\`SACKMANN_SYNC_DISABLED=true\`). VPS : \`node tools/backup-tennis-matches.js\` + deploy patché | 🔴 HIGH legal |
| 8 | **POC OddsPapi.io** | DG | Signup free 250 req → \`ODDSPAPI_KEY\` .env → \`node .context/_probe_oddspapi_pinnacle.js\` (bd \`bjv\`) | 🟢 LOW |
| 9 | **POC xvalue.ai** | DG | Free trial 1j → eval xG advanced + ML scouting (bd \`qyfr\` — POC 1j gratuit) | 🟢 LOW |
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

*Deploy config v1 — 2026-06-08 via /setup-deploy. Full procedure: `/ps-deploy` skill (`.claude/skills/ps-deploy`).*
