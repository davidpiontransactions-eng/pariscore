# MILESTONE SUMMARY — PariScore v1.0 → v12.67 (FULL HISTORY)

> **Period** : 2026-04-27 → 2026-05-23 (**27 days**, ~4 weeks)
> **Versions** : v1.0 → v12.67 (**203 releases**)
> **Commits** : 603 (since 2026-04-27)
> **Bd issues** : 57 closed, 8 in_progress, 4 ready, 17 memories
> **Source artifacts** : `CHANGELOG.md` (2368 lines), `bd` issue tracker, `git log`, `CLAUDE.md`, `.context/` audit corpus
> **Generated** : 2026-05-24

> **NOTE** : This is the master FULL document. Per-milestone deep-dives available:
> - 📄 [MILESTONE_SUMMARY-v10.x.md](MILESTONE_SUMMARY-v10.x.md) — multi-source routing + AF kill-switch (6 days, 78 versions)
> - 📄 [MILESTONE_SUMMARY-v11.x.md](MILESTONE_SUMMARY-v11.x.md) — CF overlay + Sprint 1 P0 (1 day, 14 versions)
> - 📄 [MILESTONE_SUMMARY-v12.67.md](MILESTONE_SUMMARY-v12.67.md) — Innovation backlog + spikes + RG bracket (3 days)

---

## 1. OVERVIEW

### Mission

PariScore = **value-bet detection SaaS** for football (initial) + tennis (expanded). Mathematical edge engine vs human intuition. Inspired by [OddAlerts.com](https://www.oddalerts.com/), positioned as the **francophone premium alternative** with explainable AI analysis (Gemini).

### Genesis

Started **2026-04-27** as a renaming of prototype `CoteAlerte` (static HTML) → `PariScore` (full-stack SPA + Node.js backend). Solo dev (David), bd-tracked (beads source of truth from `3d4717e bd init` in early May). Single VPS OVH deploy via `pm2 restart pariscore`. Live at pariscore.com (private alpha, no public push waiting Stripe activation).

### Outcome at v12.67

- **Production live** VPS OVH pm2 stable since v8.x
- **8 data sources** integrated (BSD primary $5/mo, ESPN public, Odds API, openfootball ODbL, Wikidata CC0, elofootball, aiscore on-demand, felipeall sidecar Transfermarkt)
- **18+ leagues football** (BSD 80% coverage post mapping) + **ATP/WTA tennis** + **Grand Slam brackets** (RG v12.67)
- **7 math models** (Poisson bivarié + Elo dynamic + xG logistic + Bayesian blend 50/25/25 + Bootstrap UQD IC90 + Reliability score + Bet signal strict + Poisson Time-Inhomogène)
- **Context Engine** (météo Open-Meteo + arbitres BSD + km haversine)
- **PWA installable** (manifest + service worker + push notifications VAPID ES256 zero-dep)
- **Bet tracking utilisateur** (KPIs + bankroll chart Chart.js + Kelly cap 25% + plan 20%/jour compound + CSV import 1xbet/ANJ)
- **Stripe Checkout + Webhook + Customer Portal** (code v12.43, NOT live — 9 DG decisions pending bd `s77m`)
- **JWT + bcrypt auth** + Premium gate middleware
- **Telegram alerts** + **Web Push** daily top picks 8h Paris parallèle
- **Innovation Backlog 100% livré** (8 items math edge)

---

## 2. ARCHITECTURE (final state v12.67)

### Stack

```
Frontend  →  pariscore.html (SPA, 35k+ lines, Vanilla JS, zero-dep, inline <style> 7k+ lines)
              ↓ fetch /api/v1/*  + EventSource SSE
Backend   →  server.js (~36k lines, Node.js native http/https, zero-dep + better-sqlite3)
              ↓ cron + SSE + WebSocket BSD push
Database  →  SQLite WAL mode (pariscore.db, 40+ tables)
              ↓ archive_matches alimenté par 8 sources (3 live runtime + 5 ETL bootstrap)
Sidecar   →  felipeall/transfermarkt-api Docker self-host 127.0.0.1:8000 (MIT)
Deploy    →  VPS OVH pm2 (NOT Render)
```

### Key principles (locked early, preserved through evolution)

| Principle | Implementation | Locked from |
|---|---|---|
| **Zero npm deps** | Native Node modules only + sole exception `better-sqlite3` | v1.0 |
| **API keys server-side only** | `.env`, never in HTML, Gemini proxied `/api/v1/gemini` | v1.0 |
| **Frontend stupid** | `fetch('/api/v1/matches')` → render only, zero calc client-side | v1.0 |
| **Single-file SPA** | `pariscore.html` 35k lines (HTTP/1.1 single roundtrip preserved) | v1.0 |
| **Mutex protection** | `isFetchingOdds` / `isFetchingStats` prevent race conditions | v3.x |
| **Graceful fallback** | 20 demo matches if APIs fail + multi-source routing 4-layer | v3.x → v10.77 |
| **SQLite persistence** | WAL mode for concurrent read/write, survives reboots | v7.x |
| **bd source-of-truth** | beads + Dolt push for distributed tracker, NOT GSD `.planning/` | v5.x (3d4717e) |
| **`null` honnête** | Never invented stats (tirs/cartons/penalties null when no source) | v10.76 |
| **PWA offline-first** | Service worker cache strategy + manifest standalone | v9.9+ |

---

## 3. PHASES (full chronological — 8 eras)

### ERA 1 — Genesis (v1.0 → v3.x — 2026-04-27 → 2026-04-29, 3 days)

> Pre-CHANGELOG entries (reconstructed from git log + `.claude/CLAUDE.md` historical notes)

- **2026-04-27** : Renaming `CoteAlerte` → `PariScore`
- 6-tab SPA scaffold (Accueil / Matchs / Prédictions / Tendances / Alertes / Tarifs)
- `showPage()` bug fix (ciblait `[data-page]` au lieu de `div[data-page]`)
- **The Odds API** integration (v4) — 7 leagues, cache `localStorage` 4h
- Edge no-vig calc (multi-bookmakers fair probability normalization)
- `server.js` v1.0 — Node native HTTP/HTTPS proxy (zero npm dep)
- Quota display `x-requests-remaining` in table header
- Bouton "↺ Forcer MAJ" + cache invalidation on API key change
- Distribution Poisson 6×6 — `λ_dom = (avgScored_dom / 1.35) × avgConceded_ext`
- BTTS / Over 0.5-3.5 / Under 1.5 / Clean Sheet 0-0 / Top 5 scores derived
- API-Football integration (standings cache 12h)
- Backtesting Option B — `archivePastMatches()` + `/api/v1/accuracy` route
- Métriques Over 2.5 (>55% predicted vs ≥3 buts actual) / BTTS / Edge

### ERA 2 — Backend serveur-centrique (v4.x — 2026-04-30, 1 intensive day)

> CHANGELOG starts here (v4.2.0 → v4.6.0, 7 sub-versions same day)

- **v4.2.0** : **SSE Live** route `/api/v1/live` (zero WebSocket, sseClients Set + broadcastSSE + buildMeta helper) — replaces polling 5min frontend
- **v4.2.0** : **Smart Polling Live** `pollLiveScores()` 60s, active 19h-23h Paris (Europe/Paris) — `fixtures?live=all` matching `normName()`
- **v4.2.0** : Badge LIVE `🔴 score (min′)` in Match column
- **v4.2.0** : 3 Stratégies Avancées (ANGLE_CORNERS, VERROU_TACTIQUE, GOLDEN_PPG_GAP) → 11 stratégies total
- **v4.2.0** : Gestion quotas T1/T2 (cron 6h ligues majeures, 12h secondaires, `LEAGUE_CRON_MS` map)
- **v4.2.0** : Skills Claude Code `/ps-add-strategy`, `/ps-audit`, `/ps-changelog`, `/ps-deploy`
- **v4.2.1** : `CONF_THRESHOLDS` seuils adaptatifs par stratégie (CS_00 25/12%, DRAW 35/25%, UNDER_2_5 70/55%) — corrige badges rouges systématiques sur marchés à faible proba naturelle
- **v4.2.1** : Filtre par ligue + slider minConfidence dans Top Stratégies
- **v4.2.2** : Double Chance market `DC_HOME` + `DC_AWAY` → 13 stratégies
- **v4.3.0** : **Live Intensity Score** — `computeLiveIntensity(fix)` composite 0-100 (40% Tirs totaux + 30% Tirs cadrés + 20% Corners + 10% Écart possession), badge ⚡ Intensité 🔴/🟠/🔵
- **v4.4.0** : **Power Score Streaming Wave 4** — `POWER_SCORE_SYSTEM_PROMPT` 5 piliers (Métriques 30% + Tactique 20% + Dynamique 20% + Presse 15% + Psychologie 15%), route SSE `/api/v1/ai-stream/:matchId`, onglet Power Score 6ème dans modal, marked.js Markdown rendering, cache SQLite KV 24h, table `ai_feedback`, export Telegram clipboard 1-clic
- **v4.5.0** : **HT/FT Market** 2 nouvelles stratégies (HT_HOME_FT_HOME + HT_UNDER_FT_OVER) → 15 stratégies
- **v4.5.0** : **Acca Generator** mathématique — `getAccaByStrategy(strategy, size)` produit cotes + probas, encart "🎯 Combiné du Jour"
- **v4.5.0** : **Dropping Odds Tracker** backend — snapshot SQLite KV `odds_snap_{matchId}` + `record.odds_delta = {home, draw, away, ts}`, colonne "Δ Cote" ↓rouge/↑vert
- **v4.6.0** : **Wave 6 Scouting Intelligence** — `fetchTeamInjuries()` cache 24h (~40 req/cron pré-charge), badge ⚠️ Absences si penalty ≥10, Scouting Report Gemini 4 sections (Tactique/Statistique/Risques/Recommandation), onglet 🕵️ Scouting dans modal

### ERA 3 — Silent iteration v5-v8 (2026-05-01 → 2026-05-11, ~11 days, 149 commits)

> **No CHANGELOG entries** — rapid iteration, bd ticketing kicked in early May (commit `3d4717e bd init`)

**Reconstructed from git log highlights:**

- **bd ticketing initialized** (`3d4717e`) — beads issue tracker adopted as source-of-truth
- **AI Deep-Scout** (`05d4b6b`) — tactical mismatch detection via BSD squad/ratings data
- **P1 Sticky Column + Dual Scrollbar** (`37a7f99`) — match table UX improvement
- **P1 Filtres Nationaux** (`6ef56fb`) — country flags in league filter chips
- **P0 Stats asymétriques fix** (`4c348a2`) — home_form fallback when coherence guard nulls team stats
- **P0 Live Sync fix** (`3960e3f`) — 3 bugs causing 0-0 at 45min (hardcoded status, no stale cleanup)
- **H2H head-to-head tab** (`31d501b`) — API-Football, cache 24h
- **Corner stats** in insights modal (`5be200a`) — BSD history 10 matches per team
- **Accuracy weekly trend chart** (`81fcc47`) — bar chart Over 2.5 + BTTS per week
- **Kelly bankroll tracking** (`d190168`) — fractional 25% + chart
- **Sofascore fallback** for exotic leagues (`6ea3311`) — Saudi, etc. + H2H tab redesign
- **Top 20 European leagues** via Sofascore fallback stats (`83f1eb0`)
- **Expand leagues_config to 53 leagues** (`46f7285`) — ANJ + top European coverage
- **AI-AL terminal rebrand** (`8266b78`, `e766583`) — "⚡ IA" → "AI-AL" + Analyse Pro IA bouton par match + modal Power Score
- **Pro Scout 429 fallback** (`4361a18`) — math fallback + masque erreurs techniques Gemini
- Multiple QA audit + null guards iterations (audit bugs `61c5d16` : tbody#vb-body, renderTable crash, possession NaN, FT regex)

### ERA 4 — Mes Paris launch (v9.8.0 → v9.8.1 — 2026-05-12, 1 day)

- **v9.8.0** : **Module Mes Paris** (Bet Tracking 1xbet + Bankroll réelle + Kelly + CSV)
  - Schéma SQLite : table `user_bets` (FK users, 7 statuts CHECK : pending/won/lost/void/cashout/half_won/half_lost) + `bankroll_transactions` (deposit/withdrawal/adjustment, amount_cents signé) + 5 index
  - Helpers : `computeKellyFraction(prob, odds, cap=0.25)`, `suggestStakeCents`, `requireUserAuth`, `buildBetsWhere`, `listUserBets`, `computePayoutCents`, `suggestBetSettlement`, `computeBankrollSummary`
  - 13 routes : GET/POST/PATCH/DELETE `/api/v1/bets`, POST `/api/v1/bets/:id/settle`, GET `/api/v1/bets/suggest-settlement/:id`, GET `/api/v1/bets/kelly`, GET `/api/v1/bets/export.csv`, GET/POST/DELETE `/api/v1/bankroll/tx`, GET `/api/v1/bankroll/summary`
  - Hook `archivePastMatches` : `UPDATE user_bets SET updated_at` quand match archivé verified → bande jaune `.bet-row-suggest` UI (PAS d'auto-settle)
  - Sécurité : `WHERE user_id = ?` 100% queries, isolation cross-user validée
  - Frontend : page `#page-paris` avec 8 KPI tiles + Chart.js bankroll réelle + 3 tabs (Paris ouverts / Historique / Trésorerie)
  - Modal `#bet-modal` autocomplete matchs + 19 préselections marché + Kelly panel Full/Half/Quarter
  - +900 lines server.js + +900 lines pariscore.html
- **v9.8.1** : **Plan 20%/jour + Import CSV sécurisé + Sport + Bookmakers ANJ**
  - Plan bankroll compound × 1.20 + split 50/50 banque/capital
  - Daily tracker calcule capital_cible / capital_réel / P&L jour / split / cumul banque / écart cible / hit_target
  - Bookmakers ANJ FR + 1xbet (11 books : 1xbet, Winamax, Betclic, Unibet, PMU, Parions Sport, ZEbet, NetBet, Vbet, Genybet, PartoucheSport)
  - Colonne sport (15 sports) avec emoji map
  - **Import CSV bookmaker** sécurité renforcée :
    - Route `POST /api/v1/auth/reverify` — exige mdp en clair, token 32-byte hex single-use TTL 5 min, Map mémoire purge auto, log IP
    - Route `POST /api/v1/bets/import` — JWT + `reverify_token` consumed-on-use, CSV ≤500 Ko, dry_run mode, transactionnel `sqldb.transaction()`, dédup via `external_ref` (user_id, date|event|odds)
    - Parser flexible `parseBetsCSV` : 10 alias colonnes, séparateur auto-détecté (`,` `;` `\t`), gère préfixe "Historique" 1xbet, dates DD/MM/YYYY + ISO, normalisation status
    - Table `bet_import_audit` forensique
  - Bug TZ corrigé : `computeDailyTracker` `new Date(start + 'T00:00:00')` → décalage 1 jour CET, fix via `Date.UTC(...split)`

### ERA 5 — Multi-source consolidation + AF kill-switch (v10.x — 2026-05-14 → 2026-05-19, 6 days, 78 versions)

> **Detailed milestone doc** : [MILESTONE_SUMMARY-v10.x.md](MILESTONE_SUMMARY-v10.x.md)

**Highlights:**

- v10.2 → v10.20 — SQLite consolidation + multi-providers routing layered + Smart Polling 60s
- v10.21 → v10.46 — Tennis tab consolidation (BSD circuit re-derive, surface inference, Elo dynamic) + Backtesting Phase 2 + AI Scout cache 6h + Live momentum SVG broadcasts SSE
- v10.47 → v10.60 — Theme light/blue oddsalert (bd `z55o`) + BSD MCP enrichissements (compare_odds, CatBoost ML v5, Polymarket, Managers — bd `c81b`) + elofootball Elo historique (bd `8lvf`) + ETL Historique scaffold (bd `9je`)
- v10.61 → v10.65 — **Design uniformization Axe C** dark trading nappe (filters + bandeau + nav + table) — 3 voix expertes concordantes
- v10.71 — **Bets Prédictifs colonne** tennis (KPI BET FORT/VALUE/PASS + 3 picks scored, PredScore formula 0.45/0.35/0.20)
- v10.72 — **Cotes 2-layer** (Couche 1 marché Odds API + Couche 3 équitable `≈1/proba`) — DG-validated NO scraping
- v10.73 — **felipeall sidecar Docker** Transfermarkt API MIT (replaces Apify $15/mo)
- v10.74 — Bio joueur + blessure 100% via Transfermarkt felipeall
- v10.75 — Prédictions BSD fallback + `normalizeBsdPrediction`
- v10.76 — Stats avancées équipe zero-réseau (`buildAdvancedStatsFromStandings` from BSD `_raw`)
- **v10.77 — 🔴 BREAKING (maîtrisé) : API-Football RETIRED** (`AF_REMOVED=true` kill-switch, -$19/mo)
- v10.78 — Hotfix tennis poll `fetchBSDTennisPredictions` (5o0) via `globalThis.__tnWarmers` pont

**Net cost saved this era : -$34/mo total** (AF $19 + Apify $15)

### ERA 6 — CF overlay + Sprint 1 P0 (v11.x — 2026-05-20, 1 day, 14 versions)

> **Detailed milestone doc** : [MILESTONE_SUMMARY-v11.x.md](MILESTONE_SUMMARY-v11.x.md)

**Highlights:**

- v11.1-11.4 CF overlay theme-agnostic (Foot+Tennis dark trading panels)
- v11.3 Tennis ball SVG 3D + scoreboard serving indicator (pulse animation)
- v11.4 Tennis serving `?` badge fallback + AiScore servePos parse
- v11.5-11.8 UI cluster (UI-009 Bet Score Gauge + EV Heatmap, UI-011 Fatigue pastille, UI-017 Time-to-kickoff chip, UI-018 3D translucent balls hub)
- v11.9 Country mapping fix bd `t8r` (Conmebol/Concacaf/UEFA/CAF/AFC/FIFA)
- v11.10 Odds API quota predictive rate-limit
- v11.11 UI-012 Profils filtres tennis sauvegardés localStorage
- v11.12 QA rapport read-only — 28 risk flags identified
- v11.13 Design V2.0 rapport read-only

### ERA 7 — Security + Spikes + Innovation Backlog (v12.0 → v12.16 — 2026-05-20/21)

- **Security incident** bd `c8m` — IP `37.65.65.25` (Nantes FR SFR résidentiel) downloaded `server.js` 196KB at `20/May/2026:00:26:11 UTC` BEFORE deployment fix → 8 keys rotated (`JWT_SECRET`, `ADMIN_PASSWORD`, `GA_POSTBACK_TOKEN`, `TELEGRAM_BOT_TOKEN`, `ODDS_API_KEY`, `GEMINI_API_KEY`, `API_FOOTBALL_KEY`, `BSD_API_KEY`) + nginx hardening config (9 location regex + rate limiting + HSTS preload) + UI security banner
- **v12.10** — ETL Historique scaffold bd `9je` (API-Football PRO 7500 req/day)
- **v12.11** — Incident sécurité dossier preuves `.context/incident_securite_20260520.md` + `.context/audit_db_post_breach.sql` (8 SQLite audit queries)
- **v12.12** — Security hardening : notification banner + nginx ACL conf
- **v12.13** — Diagnostic SQLite corruption script (13 checks + recovery procedure)
- **v12.14** — Fix momentum flat-line La Liga (Real Betis vs Elche) bd `8c5` — fallback minute estimation `commence_time + Date.now()`
- **v12.15** — Spike alternatives Odds API bd `bjv` — decision matrix 8 options scored, combo retenu Odds API Starter $30/mo + API-Football odds + Polymarket proxy
- **v12.16** — PWA icon fix (SVG without external fonts dependency) + SW v22 → v24 (force re-install purge invalid icon.svg pre-cached)

### ERA 8 — Sprint intensif + Innovation Backlog + RG bracket (v12.65 → v12.67 — 2026-05-22/23, 3 days)

> **Detailed milestone doc** : [MILESTONE_SUMMARY-v12.67.md](MILESTONE_SUMMARY-v12.67.md)

**Highlights v12.65 — 26 commits push main bd-driven:**

- **bd `c5i`** Tennis serveur live Phase 3 — `fetchAiscoreServingOnDemand` throttled 5/poll + cooldown 10min
- **bd `izsn`** safeFixed wrapper 51 sites server.js + 2 sites pariscore.html (anti NaN/null)
- **bd `8c5`** Momentum plat La Liga fix — split `live_momentum_pct` (objet BSD WS) vs `live_momentum` (array Sofa) + Array.isArray guards
- **bd `p2if`** AI-AL Revue Presse Phase 1 — prompt Gemini foot+tennis avec panel 5 sources (L'Équipe / Marca / Sky Sports / ESPN / TalkSport)
- **bd `k37`** UI coral leak fix tableau Foot
- **bd `rlhf`** Audio alertes trading Bloomberg-style — state tracking 4 indicateurs (intensity/verdict/confidence/edge) + queue 200ms cap 3 sons/burst
- **bd `ryi3`** Routing Phase 2A — route `/api/v1/sources/health` 5 sources (BSD/ESPN/OddsAPI/Gemini/Felipeall)
- **bd `0hf4`** BSD TV broadcasters Phase 1 — 3 fetchers + helper attach

**Spike research livrables (4 docs `.context/`):**

- bd `bjv` — RapidAPI odds-api1 score 78/100 + Pinnacle research (closed 2025-07-23, NO-GO direct) + POC OddsPapi.io
- bd `8uoc` — Sackmann tennis_atp CC BY-NC-SA infraction discovered (Tennismylife/TML-Database MIT replacement initially planned, later invalidated → bd `dl49` internal Elo BSD/ESPN 6-month accumulation)
- bd `ffh` — xvalue.ai GO ferme 85/100 (only API REST + free trial + xG advanced + ML scouting clustering 30 ligues)

**v12.66** — Audit bd `3u9` AF post-prod (kill-switch + plan tier + 3 scenarios DG)

**v12.67** — bd `0mpj` **Roland Garros bracket interactif** (Path A internal Clay Elo + Monte Carlo N=10000 default, <500ms bench) — Top 16 contenders + 7-round bracket (R128 → F) glassmorphism cards + charte RG scoped CSS (`--rg-clay` + `--rg-cream` + `--rg-green` + Bree Serif)

**Innovation Backlog 100% livré cumul:**

- ~~Bayesian Value Radar~~ ✅ `computeXGLogisticProbs` + `bayesianBlend(poisson, elo, xg)` weights 50/25/25 + `calibrateProbs`
- ~~Bootstrap UQD~~ ✅ 500 itérations IC90 par match (foot + tennis)
- ~~Score composite fiabilité /100~~ ✅ `computeReliabilityScore` (35% volume + 35% stability IC over25 + 30% qualité source)
- ~~Bet signal strict~~ ✅ `computeBetSignal` (EV worst-case IC lower bound)
- ~~Poisson Time-Inhomogène~~ ✅ bd `cnvg` live conditional minute-by-minute
- ~~Context Engine~~ ✅ météo Open-Meteo + arbitres BSD + Sofascore + km haversine
- ~~Alertes SSE~~ ✅ bd `vl02` triggers `favorite_trap` + `goal_flood` (cooldown 5min, sliding 15min window)
- ~~Pattern on-demand throttled généralisé~~ ✅ bd `zckt` helper `withOnDemandThrottle()`

---

## 4. DECISIONS (architectural lock-ins — 25 cumul)

### Backend & infra

1. **Zero-dep Node.js** (v1.0) — only `better-sqlite3` added v7.x. Refused Express/Fastify/socket.io.
2. **Single-file SPA `pariscore.html`** (v1.0) — accepted growth 35k+ lines vs framework split for zero-dep philosophy preservation
3. **SQLite WAL over PostgreSQL** (v7.x) — single VPS deploy, no replication need
4. **VPS OVH over Render** (v8.x) — cost control, persistent disk SQLite, full control
5. **bd over GSD `.planning/`** (v5.x `3d4717e bd init`) — beads + Dolt push, CLAUDE.md = poste pilotage
6. **felipeall sidecar Docker over Apify** (v10.73) — MIT + self-host + $0/mo vs $15/mo
7. **API-Football kill-switch NOT brute removal** (v10.77) — toggle reversible vs ~23 call sites massive diff + regression risk

### Math engine

8. **Poisson bivarié 6×6** (v3.0) — sufficient football
9. **Bayesian blend weights 50% Poisson / 25% Elo / 25% xG** (Innovation Backlog)
10. **Bootstrap UQD 500 iterations** (Innovation Backlog) — <50ms compute
11. **Kelly cap 25%** (v9.8) — bankroll protection vs full Kelly aggression
12. **Shin-Hurley devig** preferred over basic margin removal
13. **`CONF_THRESHOLDS` seuils adaptatifs par stratégie** (v4.2.1) — CS_00 25/12%, DRAW 35/25%, UNDER_2_5 70/55%
14. **PredScore formula weights** tennis (v10.71) — 0.45·EV + 0.35·Confiance + 0.20·Accord (cote dispo) OR 0.55·proba + 0.45·Confiance (sans cote)
15. **Verdict BET FORT strict rule** (v10.71 + Innovation Backlog) — EV>5% AND IC lower>0 AND badge vert (AND not OR)

### Data sources (8 active)

16. **BSD primary** $5/mo — fixtures + odds + live WS push + 17/28 endpoints REST
17. **`null` honnête over invented values** (v10.76) — tirs/cartons/penalties/formation/clean-sheets `null` when no free source
18. **Internal Elo from BSD/ESPN settled matches** for tennis (bd `dl49`) — Sackmann CC BY-NC-SA infraction discovered v12.65 → 6-month cron daily accumulation strategy locked B'
19. **Pinnacle API closed 2025-07-23** — invalidates The Odds API combo, POC OddsPapi.io free 250 req/mo bd `bjv` Plan C
20. **xvalue.ai GO ferme** (bd `ffh` 85/100) — only API REST + free trial + xG advanced + ML scouting clustering 30 leagues
21. **Tennis cotes 2-layer (NO scraping)** (v10.72) — DG-validated: OddsPortal/Flashscore = Cloudflare wall + violates "Odds API only" rule

### Frontend

22. **Viewport desktop 1280px scale 0.3 forced mobile** (v11) — known anti-pattern, V2 Mobile-First decision pending Option B locked 2026-05-24
23. **Design System V2 unified tokens `--cf-*`** (v11.x bd `87d`) — 60 vars centralized, utility classes `.cf-u-*`
24. **PWA standalone + push notifications + offline cache** (v9.9+) — Telegram parallèle, daily top picks 8h Paris

### Security

25. **JWT secret auto-gen + bcrypt 10 rounds + Premium gate `FOOT_PRO`** (v9.9.5)
26. **nginx hardening config** (v12.12 bd `c8m`) — 9 location regex + rate limiting + HSTS preload + security headers
27. **Stripe webhook signature verify** (v12.43 bd `s77m`) — `req.body` raw, `stripe.webhooks.constructEvent`, `stripe_events` table for `event_id` dedup
28. **Reverify token CSV import** (v9.8.1) — 32-byte hex single-use TTL 5 min + IP log audit forensique
29. **`WHERE user_id = ?` 100% queries** (v9.8) — isolation cross-user validated

---

## 5. REQUIREMENTS (full implemented matrix)

| Requirement | Era | Status | Locus |
|---|---|---|---|
| Cotes live multi-bookmakers | 1 (v1.0) | ✅ | 4-layer routing v10.x cumul |
| Probabilités Poisson 1X2 + BTTS + Over | 1 (v3.0) | ✅ | `computePoisson()` |
| Edge no-vig Value Bet | 1 (v1.0) | ✅ | `computeEdge()` |
| Backtesting accuracy | 1 (v3.0) | ✅ | `archivePastMatches()` |
| AI analysis Gemini | 1 (v3.0) | ✅ | `/api/v1/gemini` proxy + cache 6h |
| SSE Live real-time | 2 (v4.2) | ✅ | `/api/v1/live` + `broadcastSSE` |
| Live Intensity Score | 2 (v4.3) | ✅ | `computeLiveIntensity` 0-100 composite |
| Power Score Streaming | 2 (v4.4) | ✅ | SSE route + onglet 6ème modal |
| Acca Generator + HT/FT markets | 2 (v4.5) | ✅ | `getAccaByStrategy` + 15 stratégies |
| Dropping Odds Tracker | 2 (v4.5) | ✅ | `record.odds_delta` + colonne Δ |
| Scouting Intelligence | 2 (v4.6) | ✅ | `fetchTeamInjuries` + Scouting Report |
| AI Deep-Scout | 3 (v5-v8) | ✅ | tactical mismatch BSD squad |
| H2H tab + Corner stats + Kelly tracking | 3 (v5-v8) | ✅ | various commits |
| 53 leagues coverage | 3 (v5-v8) | ✅ | `leagues_config.json` |
| **Mes Paris** (Bet tracking) | 4 (v9.8) | ✅ | 13 routes + 3 modals + Kelly panel |
| Plan 20%/jour compound | 4 (v9.8.1) | ✅ | `computeDailyTracker` + table |
| Import CSV bookmaker sécurisé | 4 (v9.8.1) | ✅ | reverify token + audit forensique |
| Multi-source routing 4-layer | 5 (v10.x) | ✅ | BSD → ESPN → Odds API → internal |
| API-Football retirement | 5 (v10.77) | ✅ | kill-switch (-$19/mo) |
| felipeall sidecar Transfermarkt | 5 (v10.73) | ✅ | Docker self-host MIT |
| Tennis Bets Prédictifs colonne | 5 (v10.71) | ✅ | `computeTennisPredictiveBets` |
| Tennis cotes 2-layer | 5 (v10.72) | ✅ | `odds_fair` + `odds_type` |
| Design uniformization Axe C | 5 (v10.63) | ✅ | dark trading nappe continue |
| CF overlay theme-agnostic | 6 (v11.x) | ✅ | Sprint 1 P0 epic `qbe` |
| Tennis 3D ball + serving indicator | 6 (v11.3-4) | ✅ | SVG + pulse animation |
| Filter profiles localStorage | 6 (v11.11) | ✅ | UI-012 |
| Web Push daily top picks | 7 (v12.x) | ✅ | cron 8h Paris VAPID ES256 |
| Innovation Backlog 100% | 7 (v12.x) | ✅ | 8 items math edge cumul |
| Security incident response | 7 (v12.11-12) | ✅ | nginx hardening + 8 keys rotated |
| Stripe Checkout + Webhook + Portal | 7 (v12.43) | ✅ code | NOT live (9 DG decisions) |
| RG bracket interactive | 8 (v12.67) | ✅ | Path A Clay Elo + Monte Carlo |
| Auth JWT + Premium gate | 4 (v9.9.5) | ✅ | middleware `FOOT_PRO` |

---

## 6. TECH DEBT (cumul à v12.67)

### 🔴 HIGH

- **Sackmann tennis_atp CC BY-NC-SA infraction** SaaS commercial €19/mo — bd `dl49` Phase 1+2 livré (backup + sync disabled flag `SACKMANN_SYNC_DISABLED=true`) — Phases 3-7 wait 6-month BSD/ESPN accumulation
- **Viewport desktop 1280px forced mobile** = SEO penalty Core Web Vitals — V2 Mobile Option B locked 2026-05-24

### 🟠 MED

- **API-Football kill-switch dead code** ~500-800 lignes (~23 call sites with guards) — bd `3u9` Scenario C cleanup pending DG
- **Matching team names fuzzy first-word** — Roadmap Levenshtein
- **Poisson moyenne ligue fixe 1.35** — Roadmap dynamic by league
- **iPad Pro 12.9" landscape ambiguity** — V2 Mobile threshold 820px UA combo decided
- **`/api/v1/af/transfers/:id` 503 gracieux** orphelin sunset (felipeall covers `/transfers` direct)

### 🟡 LOW

- **RapidAPI key exposed chat 2026-05-21** — Revoke pending DG action item #2
- **50 fragmented media queries** no breakpoint discipline `pariscore.html` — V2 Mobile refactor consolidates
- **Audio module DOMException playPromise.catch** silent — wired but pattern fragile
- **SQLite WAL journal mode growth** unmanaged — manual `PRAGMA wal_checkpoint` rare
- **Tennis poll bug pattern** (v10.78 `5o0`) — similar class bugs possible if other warmer fns added without `globalThis.__*` pont

### Compromises intentional

- **Single-file SPA 35k+ lines** — accepted simplicity vs framework split (React/Vue add 100KB+ + build step + dep chain incompatible zero-dep)
- **Inline `<style>` 7000+ lines** — HTTP/1.1 single roundtrip preserved
- **No tests** (unit/integration/E2E) — accepted solo dev + bd manual UAT + `node --check` syntax gate. Risk acknowledged.
- **No CI/CD** — manual `git push` + VPS `git pull` + `pm2 restart`. GitHub Actions deferred to monetization phase.
- **bd over GSD** — chose distributed Dolt push tracker over `.planning/` structured workflow (project convention)

---

## 7. GETTING STARTED (full onboarding)

### Prerequisites

- Node.js >= 16
- SQLite3 (system or auto via better-sqlite3 install)
- `.env` with 12 keys minimum
- Git access + bd CLI installed (`bd prime`)
- Docker (optional, only for felipeall sidecar Transfermarkt)

### Setup local

```bash
git clone <repo> pariscore && cd pariscore
npm install                                 # only installs better-sqlite3
cp .env.example .env                        # then edit with real keys
node server.js                              # boot — auto-runs fetchStats + fetchOdds + archivePastMatches
# Server up on http://localhost:3000
```

### Required `.env` keys (12 minimum)

```bash
PORT=3000
ODDS_API_KEY=<the-odds-api>                # 500 req/mo free, $30/mo Starter optional
BSD_API_KEY=<bzzoiro-sports-addon>         # $5/mo primary source
GEMINI_API_KEY=<google-ai>                 # pay-as-you-go
JWT_SECRET=                                # auto-gen if absent (32 bytes crypto-random)
ADMIN_PASSWORD=<change-in-prod>
TELEGRAM_BOT_TOKEN=                        # optional
TELEGRAM_CHAT_IDS=                         # IDs comma-separated
ALERT_EDGE_THRESHOLD=8
ALLOWED_ORIGIN=*                           # restrict in prod
STRIPE_SECRET_KEY=                         # test mode by default until DG decisions
STRIPE_WEBHOOK_SECRET=                     # whsec_...
VAPID_PUBLIC_KEY=                          # PWA push notifications
VAPID_PRIVATE_KEY=
TRANSFERMARKT_API_URL=http://127.0.0.1:8000  # felipeall sidecar (optional)
SACKMANN_SYNC_DISABLED=true                # bd dl49 compliance — keep until 6-month accumulation done
AF_REMOVED=true                            # bd 3u9 kill-switch — keep unless DG Scenario B
USE_API_FOOTBALL_ODDS=                     # opt-in bd zia — requires AF_REMOVED=false + Pro plan
```

### First 7 steps onboarding

1. **Read** `CLAUDE.md` (poste pilotage GM — roadmap + état actuel + ops actions)
2. **Read** `.claude/CLAUDE.md` (cahier des charges détaillé — 15 sections)
3. **Run** `bd ready` (find available work) + `bd list --status=in_progress`
4. **Browse** `CHANGELOG.md` recent 5 versions (v12.63 → v12.67) to understand cadence
5. **Inspect** SQLite : `sqlite3 pariscore.db ".tables"` (40+ tables — matches, users, stripe_events, bets, alerts, archive_matches, api_cache, tennis_matches, etc.)
6. **Browse** `bd memories` for cross-session knowledge (17 memories — routing layers, BSD quirks, bug patterns, deploy reminders)
7. **Read** [.planning/reports/MILESTONE_SUMMARY-v12.67.md](MILESTONE_SUMMARY-v12.67.md) for most recent state detail

### Setup felipeall sidecar (optional, only if Transfermarkt features needed)

```bash
docker compose -f docker-compose.transfermarkt.yml up -d
# Sidecar binds 127.0.0.1:8000, healthcheck enabled, rate-limit ON
# clone felipeall/transfermarkt-api → transfermarkt-api/ (git-ignored)
curl http://127.0.0.1:8000/players/search/messi   # smoke test
```

### Common dev workflows

```bash
# Find work
bd ready
bd show <id>

# Claim + work
bd update <id> --claim
# ... edit code ...
node --check server.js                      # MANDATORY syntax gate

# Commit (atomic per bd task)
git add <files>
git commit -m "feat(area): bd <id> — short description"

# Close bd task
bd close <id>

# Push (MANDATORY end of session per CLAUDE.md SESSION CLOSE PROTOCOL)
git pull --rebase
bd dolt push
git push
git status                                  # MUST show "up to date"
```

### Deploy VPS (production)

```bash
ssh ubuntu@<vps-ip>
cd /home/ubuntu/pariscore
git pull
pm2 restart pariscore
pm2 logs pariscore --lines 200 --nostream   # validate boot
# Check critical log signals:
# - "271 matchs chargés sans AF" (kill-switch active)
# - "[BSD] WS connected"
# - "ETL seed merge (wikidata CC0): 56/56" (bd 6du6)
```

### Where to find what

| Need | Location |
|---|---|
| Project pilot state + roadmap | `CLAUDE.md` racine |
| Detailed spec by feature | `.claude/CLAUDE.md` 15 sections |
| Full project history | `.planning/reports/MILESTONE_SUMMARY-v1.0-v12.67-FULL.md` (this doc) |
| Per-era deep-dive | `.planning/reports/MILESTONE_SUMMARY-v{10,11,12.67}.md` |
| Active issues + ready queue | `bd ready` + `bd list` |
| Cross-session insights | `bd memories` + `bd memories <keyword>` |
| Recent commit history | `git log --oneline -n 30` |
| Math engine internals | `server.js:6000-7500` + `.context/audits/` |
| Frontend SPA layout | `pariscore.html` (search by tab `#page-*`) |
| Deploy procedure | `CLAUDE.md` actions ops user post-session #1 |
| Security incident report | `.context/incident_securite_20260520.md` |
| Data sources licensing | `LICENSE-DATA.md` (bd `dl49` Phase 8 anticipée) |
| Tennis data sourcing strategy | `.context/strategy/rapport-tennis-data-sourcing-2026.md` v2 |
| Spike research evals | `.context/spike-*-eval-final.md` (bjv, ffh, etc.) |
| Stripe DG checklist (9 sections) | `.context/stripe_dg_checklist.md` |
| Nginx hardening config | `.context/nginx_hardening_pariscore.conf` |

### Key team agents (`.claude/agents/`)

When complex task triggers, mentally invoke:
- **Product Manager Agent** + **CTO** — strategy
- **CS Engineering Lead** + **Karpathy reviewer** — technical execution
- **Quality regulation CS** + **Responsable financier** — quality + cost
- **CS UX researcher** + **CS Wiki ingestor** — research

---

## APPENDIX A — Full numeric stats

| Metric | Value |
|---|---|
| Total versions released | 203 (v1.0 → v12.67) |
| Total commits (since 2026-04-27) | 603 |
| Days active development | 27 (2026-04-27 → 2026-05-23) |
| Avg commits/day | ~22 |
| Peak day | 2026-05-17 (~78 versions v10.x in 6 days = ~13/day) |
| bd issues closed | 57 |
| bd issues in_progress | 8 |
| bd issues ready (open no blocker) | 4 |
| bd memories persisted | 17 |
| Data sources active | 8 |
| Leagues covered (football) | 18+ (BSD 80% coverage post mapping) |
| Sports tracked Mes Paris | 15 (football, tennis, basketball, MMA, UFC, F1, LoL, etc.) |
| Bookmakers ANJ FR + 1xbet (UI dropdowns) | 11 |
| Stratégies UI | 15 |
| Math models | 8 (Poisson + Elo + xG + Bayesian + Bootstrap UQD + Reliability + Bet signal + Time-Inhomogène) |
| Context Engine factors | 3 (weather + referee + km travel) |
| SQLite tables | 40+ |
| Frontend lines `pariscore.html` | 35000+ |
| Backend lines `server.js` | ~36000 (estimate) |
| Inline `<style>` lines | ~7000 |
| Test coverage | 0% (manual UAT via bd) |
| Production uptime | VPS OVH pm2 stable since v8.x |
| Cost saved cumul | -$34/mo (AF $19 + Apify $15) |
| BSD subscription | $5/mo (Bzzoiro Sports Addon — exp 2026-06-16) |
| Innovation Backlog items | 8/8 livrés |
| Security incidents | 1 (resolved bd `c8m` v12.11-12, 8 keys rotated) |

## APPENDIX B — Open questions / next milestone

1. **V2 Mobile** — Option B (conditional viewport JS swap) locked 2026-05-24, bundle PREMIUM SHOWCASE (C1-B + C2 + C3 + C4-partial) 18h dev pending GO
2. **Stripe activation** — 9 DG decisions pending (`s77m` checklist : trial, prix mensuel/annuel/mono-sport, matchday pass, refund policy EU 14j, cancellation flow, currency, webhook secret, Stripe Connect Phase 2)
3. **API-Football scenario** — A maintain kill-switch $0 / B upgrade Pro $19 + bd `zia` cotes / C cleanup dead code 500-800 lignes (`3u9` audit)
4. **bd `dl49` strategy B'** — 6-month wait cron daily accumulation `tennis_matches_internal` before Phases 4.2-7 wire consumers
5. **bd `8uoc` Sackmann compliance** — Phase 3-7 (ETL interne + refactor consumers + DROP tennis_matches table + LICENSE-DATA finalize) deferred to bd `dl49` completion
6. **Marketing 5 phases** (`l9vk`) — 1xBet + Twitter + YouTube + Telegram + Stripe — DG signups required
7. **POCs free trial** — OddsPapi.io 250 req Pinnacle + xvalue.ai 1j — DG signups pending
8. **bd `j5lb`** — 6 études bloquées DG decision (Marketing affiliate, FBref Python scraper, RapidAPI, TheSportsDB, Apify, OddsPortal)

## APPENDIX C — Eras at a glance

| Era | Period | Days | Versions | Theme | Doc |
|---|---|---|---|---|---|
| 1. Genesis | 2026-04-27 → 04-29 | 3 | v1.0-v3.x | MVP SPA + Odds API + Poisson 6×6 | — (pre-CHANGELOG) |
| 2. Backend serveur-centrique | 2026-04-30 | 1 | v4.2-v4.6 | SSE + Smart Polling + Live Intensity + Power Score + Scouting | CHANGELOG.md:1364-1547 |
| 3. Silent iteration v5-v8 | 2026-05-01 → 05-11 | 11 | ~6-8 | bd init + Sofascore fallback + AI Deep-Scout + Sticky Column + 53 leagues | git log 149 commits |
| 4. Mes Paris launch | 2026-05-12 | 1 | v9.8 | Bet tracking + Bankroll + Kelly + CSV import sécurisé | CHANGELOG.md:1247-1362 |
| 5. Multi-source + AF retirement | 2026-05-14 → 05-19 | 6 | 78 (v10.2-v10.78) | BSD primary + felipeall + AF kill-switch + Design Axe C | [v10.x doc](MILESTONE_SUMMARY-v10.x.md) |
| 6. CF overlay + Sprint 1 P0 | 2026-05-20 | 1 | 14 (v11.0-v11.13) | CF theme-agnostic + UI cluster Sprint 1 + QA + Design V2 rapports | [v11.x doc](MILESTONE_SUMMARY-v11.x.md) |
| 7. Security + Spikes + Innovation Backlog | 2026-05-20 → 05-21 | 2 | ~16 (v12.0-v12.16) | Security incident response + PWA fix + ETL scaffold + spike research | CHANGELOG.md:1108-1245 |
| 8. Sprint intensif + RG bracket | 2026-05-22 → 05-23 | 3 | 3 (v12.65-v12.67) | 10 features parallel + 4 spike docs + AF audit + RG Path A Monte Carlo | [v12.67 doc](MILESTONE_SUMMARY-v12.67.md) |

---

*Generated 2026-05-24 from adapted GSD milestone-summary template + complete PariScore artifacts (CHANGELOG.md 2368 lines / bd / git log 603 commits / CLAUDE.md / `.context/` audit corpus / `.claude/CLAUDE.md` 15 sections). Source of truth tasks = `bd ready`. Three deep-dive milestone docs cross-linked: v10.x, v11.x, v12.67.*
