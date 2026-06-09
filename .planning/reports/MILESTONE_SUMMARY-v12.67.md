# MILESTONE SUMMARY — PariScore v1.0 → v12.67

> **Period** : 2026-04-27 → 2026-05-23 (27 days, ~4 weeks)
> **Source artifacts** : `CHANGELOG.md` (203 versions), `bd` issue tracker (57 closed / 8 in_progress), `git log` (603 commits), `CLAUDE.md` poste pilotage, `.context/` audit corpus
> **Adapted from GSD template** — project source-of-truth is `bd` (beads), not `.planning/`
> **Generated** : 2026-05-24

---

## 1. OVERVIEW

### Mission

PariScore is a **value-bet detection SaaS** for football (initial) + tennis (expanded) sports betting. Mathematical edge engine vs human intuition. Inspired by [OddAlerts.com](https://www.oddalerts.com/), positioned as the francophone premium alternative with explainable AI analysis (Gemini).

### Status

- **Production** : deployed VPS OVH `/home/ubuntu/pariscore` via `pm2 restart pariscore`. Live at pariscore.com.
- **Version** : v12.67 (2026-05-23 — RG bracket Path A internal Clay Elo + Monte Carlo).
- **Monetization** : Stripe code livré v12.43, **NOT live** — pending 9 DG decisions (`bd s77m` checklist).
- **Auth** : JWT + bcrypt + Premium gate operational (zero-dep).
- **Users** : private alpha, no public push (waiting Stripe activation).

### Scope delivered

| Area | Done |
|---|---|
| Football coverage | 18 leagues (EPL, L1, La Liga, Bundesliga, Serie A, UCL/EL, CdM 2026, World leagues) |
| Tennis coverage | ATP + WTA singles + doubles + Grand Slams (RG bracket interactive v12.67) |
| Math engine | Poisson bivarié + Elo dynamic + xG logistic + Bayesian blend + Bootstrap UQD (IC90) + Reliability score + Bet signal (EV>5% AND IC lower bound >0) + Poisson Time-Inhomogène (live conditional) + Context Engine (weather + referee + km travel) |
| Data sources | 8 (BSD primary $5/mo, ESPN public, Odds API, openfootball ODbL, Wikidata CC0, elofootball, aiscore on-demand, felipeall sidecar) |
| UI | SPA `pariscore.html` 35k+ lines, Design System V2.0 unified `--cf-*` tokens, dark "data terminal" + light blue oddsalert theme |
| Backend | Node.js zero-dep (except `better-sqlite3`), SQLite WAL, SSE realtime, BSD WebSocket push |
| PWA | manifest + service worker + push notifications (VAPID ES256 zero-dep) + offline cache |
| Bet tracking | Mes Paris page (KPIs, bankroll chart, Kelly cap 25%, export CSV) |
| Telegram alerts | momentum/pressure live + daily top picks cron 8h Paris (parallèle Web Push) |

---

## 2. ARCHITECTURE

### Stack

```
Frontend  →  pariscore.html (SPA, 35k lines, Vanilla JS, zero-dep)
              ↓ fetch /api/v1/*
Backend   →  server.js (Node.js native http/https, zero-dep + better-sqlite3)
              ↓ cron + SSE + WebSocket
Database  →  SQLite WAL mode (pariscore.db)
              ↓ table archive_matches alimentée par 8 sources
Deploy    →  VPS OVH pm2 (NOT Render)
```

### Key principles

| Principle | Implementation |
|---|---|
| **Zero npm deps** | Native Node modules only (`http`, `https`, `fs`, `path`, `url`, `crypto`) — sole exception `better-sqlite3` |
| **API keys server-side only** | Loaded from `.env`, never in HTML, Gemini proxied via `/api/v1/gemini` |
| **Frontend stupid** | `fetch('/api/v1/matches')` → render only, zero calc client-side |
| **SQLite persistence** | Survives reboots, WAL mode for concurrent read/write |
| **Graceful fallback** | 20 demo matches if APIs fail |
| **Mutex protection** | `isFetchingOdds` / `isFetchingStats` prevent race conditions |
| **PWA offline-first** | Service worker cache strategy + manifest standalone |
| **Multi-source routing** | 4 layers BSD → ESPN → Odds API → Sackmann internal Elo (replacement bd `dl49`) |

### Module map

| Module | Lines (~) | Locus |
|---|---|---|
| Math engine (Poisson, Elo, xG, Bayesian blend, Bootstrap UQD, reliability) | 1500 | `server.js:6000-7500` |
| Football routing + odds fusion | 3000 | `server.js:7000-10000` |
| Tennis Elo + match consolidation + serve invisible | 2000 | `server.js:19000-21000` |
| Live polling + SSE broadcasts | 1200 | `server.js:15000-16500` |
| BSD WebSocket push + REST fetchers | 800 | `server.js:1700-2500` |
| Stripe checkout + webhook | 600 | `server.js:13800-14400` |
| Auth JWT + bcrypt | 400 | `server.js:14100-14500` |
| RG bracket Monte Carlo | 200 | `server.js:28336-28518` (v12.67) |
| Context Engine (weather + referee + km) | 400 | `server.js:5500-5900` |
| ETL Tennis internal (Sackmann replacement) | 300 | `server.js:11000-11300` (v12.65+ bd `dl49`) |
| Frontend SPA + Design System V2 | 35000 | `pariscore.html` |
| PWA service worker | 200 | `sw.js` |

---

## 3. PHASES (chronological)

### Phase 1 — MVP (v1.0 → v3.x — late April 2026)

- Prototype HTML statique `CoteAlerte` → renamed PariScore
- 6-tab SPA scaffolded (Accueil / Matchs / Prédictions / Tendances / Alertes / Tarifs)
- Backend Node.js zero-dep + Odds API fetch + Poisson bivarié

### Phase 2 — Backend serveur-centrique (v4.x → v6.x — early May)

- `server.js` full backend (cron 12h Odds + 6h Stats)
- `database.json` + `history.json` cache persistant
- AI Scout (Gemini proxy) + backtesting (archivePastMatches)
- Edge no-vig + Poisson bivarié 6×6 matrix

### Phase 3 — SQLite migration + Multi-sources (v7.x → v10.x — mid May)

- Migration `database.json` → SQLite WAL (`pariscore.db`)
- Multi-providers fetchOdds (BSD primary + ESPN + Odds API + fallbacks)
- API-Football PRO $19/mo (live stats + standings + xG cache 24h)
- Smart Polling 60s (19h-23h Paris) + SSE realtime
- Live Intensity Score + momentum SVG
- Tennis Phase 1 (ATP/WTA basic) + Elo dynamic

### Phase 4 — Design System V2 + Sprint 1 P0 (v11.x — 2026-05-20)

- CYBER-FINTECH OVERLAY (60 vars `--cf-*` unified tokens)
- Hero Value Cell Foot + IC Corridor inline + Mode Dual Trading/Analyse
- Mobile Card-View Tennis 6 KPI prioritaires
- Filtres Tennis Accordéon (3 visible + reste replié)
- bd epic `qbe` CORE-TABS

### Phase 5 — Security + Spikes + Innovation Backlog (v12.0 → v12.16 — 2026-05-20/21)

- **Security incident** bd `c8m` : IP 37.65.65.25 downloaded `server.js` 196KB before fix → 8 keys rotated + nginx ACL + notification banner
- Spike alternatives Odds API bd `bjv` : decision matrix 8 options scored
- Diagnostic SQLite corruption script + fail-soft `apiCache*` try/catch
- PWA icon fix (SVG without external fonts dependency) + SW v24
- ETL Historique scaffold bd `9je` (API-Football PRO 7500 req/day)

### Phase 6 — Sprint intensif 26 commits (v12.65 — 2026-05-22)

- 10 features/fixes parallel (bd `c5i` + `izsn` + `8c5` + `p2if` + `k37` + `rlhf` + `ryi3` + `0hf4` + `bjv` + `8uoc`)
- AI-AL Revue de Presse Foot+Tennis (panel 5 sources L'Équipe/Marca/Sky/ESPN/TalkSport)
- Audio alertes Bloomberg-style 4 indicateurs (intensity/verdict/confidence/edge)
- BSD TV broadcasters Phase 1 (3 fetchers + helper attach)
- safeFixed wrapper 51 sites server.js + 2 sites pariscore.html (anti NaN/null)
- Tennis serveur live Phase 3 (aiscore on-demand throttled 5/poll + cooldown 10min)
- 4 research/spike livrables `.context/` (bjv Pinnacle research + 8uoc Sackmann purge + ffh xvalue.ai GO 85/100)

### Phase 7 — Audit AF post-prod + RG bracket (v12.66 → v12.67 — 2026-05-22/23)

- bd `3u9` audit kill-switch API-Football `AF_REMOVED=true` post-prod (3 scenarios DG)
- bd `0mpj` Roland Garros bracket interactif (Path A internal Clay Elo + Monte Carlo N=10000 default, <500ms bench)
- Top 16 contenders + 7-round bracket (R128 → F) glassmorphism cards
- Charte RG scoped CSS (`--rg-clay` + `--rg-cream` + `--rg-green` + Bree Serif)

### Phase 8 — Innovation Backlog 100% livré (cumul v12.0 → v12.67)

- ~~Bayesian Value Radar~~ ✅ `computeXGLogisticProbs` + `bayesianBlend(poisson, elo, xg)` weights 50/25/25 + `calibrateProbs`
- ~~Bootstrap UQD~~ ✅ 500 itérations IC90 par match (foot + tennis)
- ~~Score composite fiabilité /100~~ ✅ `computeReliabilityScore` (35% volume + 35% stability IC over25 + 30% qualité source)
- ~~Bet signal strict~~ ✅ `computeBetSignal` (EV worst-case IC lower bound)
- ~~Poisson Time-Inhomogène~~ ✅ bd `cnvg` live conditional minute-by-minute
- ~~Context Engine~~ ✅ météo Open-Meteo + arbitres BSD + Sofascore + km haversine
- ~~Alertes SSE~~ ✅ bd `vl02` triggers `favorite_trap` + `goal_flood` (cooldown 5min, sliding 15min window)
- ~~Pattern on-demand throttled généralisé~~ ✅ bd `zckt` helper `withOnDemandThrottle()`

---

## 4. DECISIONS (architectural lock-ins)

### Backend

1. **Zero-dep Node.js** (decided v1.0) — only `better-sqlite3` added v7.x for SQLite migration. Refused Express/Fastify/socket.io.
2. **SQLite WAL over PostgreSQL** (decided v7.x) — single VPS deploy, no replication need, WAL handles concurrent read/write. Migrations manual via `schema.sql`.
3. **VPS OVH over Render** (decided v8.x) — better cost control, persistent disk SQLite, full control. Render kept as Phase 2 option for SaaS scaling.
4. **bd over GSD `.planning/`** (decided v11.x) — beads + Dolt push for distributed tracker. CLAUDE.md = poste pilotage, not journal. Source of truth = `bd ready`.

### Math

5. **Poisson bivarié 6×6** (v3.0) — sufficient for football, no need Skellam/negative binomial. Top 5 scores + BTTS/Over markets derived.
6. **Bayesian blend weights 50% Poisson / 25% Elo / 25% xG** (Innovation Backlog v12.x) — calibration via reliability diagram.
7. **Bootstrap UQD 500 iterations** — IC90 per match. <50ms compute, no Worker thread needed.
8. **Kelly cap 25%** — bankroll protection vs full Kelly aggression. Half-Kelly variant available toggle.
9. **Shin-Hurley devig** preferred over basic margin removal — handles bookmaker bias asymmetry.

### Data sources (8 active)

10. **BSD (Bzzoiro Sports Addon) primary** $5/mo — fixtures + odds + live WS push + 17/28 endpoints REST direct. Coverage 80% leagues (post mapping bd `t8r` cup domestic + World Cup 2026).
11. **Internal Elo from BSD/ESPN settled matches** for tennis (bd `dl49`) — Sackmann CC BY-NC-SA infraction discovered v12.65 → 6-month cron daily accumulation strategy locked B'.
12. **Pinnacle API closed 2025-07-23** — invalidates The Odds API combo. POC OddsPapi.io free 250 req/mo bd `bjv` Plan C.
13. **xvalue.ai GO ferme** (bd `ffh` 85/100) — only API REST + free trial + xG advanced + ML scouting clustering 30 leagues among 6 candidates.
14. **API-Football kill-switch** (`AF_REMOVED=true` v10.77) — $0/mo Scenario A pending DG (vs B Pro $19/mo + bd `zia` cotes activation).

### Frontend

15. **Viewport desktop 1280px scale 0.3 forced mobile** (v11) — known anti-pattern, V2 Mobile-First decision pending (Option A pure / B conditional / C subdomain). bd discussion 2026-05-24.
16. **Design System V2 unified tokens `--cf-*`** (v11.x bd `87d`) — 60 vars centralized, utility classes `.cf-u-*`. Bloomberg terminal aesthetic + light blue oddsalert theme switcher.
17. **PWA standalone + push notifications + offline cache** (v9.9+) — Telegram parallèle, daily top picks 8h Paris.

### Security

18. **JWT secret auto-gen if absent** + bcrypt 10 rounds + Premium gate `FOOT_PRO` middleware (v9.9.5).
19. **nginx hardening config** (v12.12 bd `c8m` Phase 3) — 9 location regex + rate limiting auth 5r/min + api 60r/min + HSTS preload + security headers.
20. **Stripe webhook signature verify** — `req.body` raw (NOT bodyParser global), `stripe.webhooks.constructEvent`, `stripe_events` table for `event_id` dedup.

---

## 5. REQUIREMENTS (implemented vs pending)

### ✅ Implemented (cumul v1.0 → v12.67)

| Requirement | Locus | Validated |
|---|---|---|
| Cotes live 20+ bookmakers | `fetchOdds()` `server.js:7446` 4-layer routing | ✅ prod 1000+ matchs/jour |
| Probabilités Poisson 1X2 + BTTS + Over | `computePoisson()` `server.js:6000+` | ✅ 271 matchs boot test |
| Value Bet detection Edge no-vig | `computeEdge()` + `detectSurebet1N2` | ✅ filters + alerts wired |
| AI analysis Gemini per match | `/api/v1/gemini` proxy + cache 6h AI Scout | ✅ panel 5 sources presse |
| Backtesting accuracy Over 2.5 / BTTS / Edge | `archivePastMatches()` + `/api/v1/accuracy` | ✅ history.json verified |
| Bet tracking utilisateur | `/api/v1/bets` + Mes Paris page + bankroll chart | ✅ v9.8 |
| Mobile PWA installable | `manifest.json` + `sw.js` + push | ✅ v12.16 |
| Telegram alerts | `pollLiveScores` 60s + `/api/v1/alerts/*` | ✅ v9.9.5 |
| Live SSE realtime | `/api/v1/live` + `broadcastSSE` | ✅ |
| Tennis ATP/WTA + Grand Slam bracket | `handleTennisBSD` + RG bracket Path A | ✅ v12.67 |
| Stripe Checkout + webhook + portal | `/api/v1/checkout/matchday` + `/api/v1/webhook/stripe` + `stripe_events` table | ✅ code v12.43 |
| Auth JWT + bcrypt + Premium gate | `/api/v1/auth/*` + middleware | ✅ v9.9.5 |

### ⏳ Pending (8 in_progress + DG decisions)

| ID | Pending | Blocker |
|---|---|---|
| `9je` | ETL Football post quota reset | Run VPS minuit UTC `bash .context/run_etl_2024_2026.sh` |
| `6du6` | Wikidata CC0 Phase 2 deploy | Deploy VPS + verify log `ETL seed merge (wikidata CC0): 56/56` |
| `s77m` | Stripe activation live | DG checklist 9 sections (trial, prix mensuel/annuel/mono-sport, matchday pass, refund policy, cancellation flow) |
| `5iw` | BSD Live WebSocket schema validation prod | Validation payload live VPS |
| `bjv` | Sourcing cotes alternative Pinnacle | POC OddsPapi.io 250 req free trial signup |
| `dl49` | Internal tennis Elo BSD/ESPN | 6-month cron daily accumulation (Phases 4.2-7 deferred) |
| `8lqf` | Spike FBref via soccerdata Python | RESEARCH ONLY scaffold v12.30 |
| `j5lb` | DG decision 6 études bloquées | DG arbitrage |

### 🔜 Roadmap V2 Mobile (next milestone)

- Bundle PREMIUM SHOWCASE (C1-B + C2 + C3 + C4-partial) — 18h dev
- Decision viewport Option B (conditional JS swap mobile/desktop)
- Bottom Nav glassmorphic + bottom-sheet Insights + cartes empilées match
- Cible visuelle: Apple Sports / Linear iOS / Robinhood / Arc Search blend

---

## 6. TECH DEBT

### Known issues / cleanup pending

| Severity | Item | Locus | Mitigation |
|---|---|---|---|
| 🔴 HIGH | Sackmann tennis_atp CC BY-NC-SA infraction SaaS commercial | `tennis_matches` table | bd `dl49` Phase 1+2 livré (backup + sync disabled) — Phases 3-7 wait 6-month accumulation |
| 🔴 HIGH | Viewport desktop 1280px forced mobile = SEO penalty Core Web Vitals | `pariscore.html:6` | V2 Mobile Option B decision in progress |
| 🟠 MED | API-Football kill-switch 500-800 lines dead code | ~23 call sites | bd `3u9` Scenario C cleanup pending DG |
| 🟠 MED | Matching team names approximatif (fuzzy first-word) | `normName()` | Roadmap Levenshtein |
| 🟠 MED | Poisson moyenne ligue fixe 1.35 buts | `computePoisson()` | Roadmap dynamic by league |
| 🟠 MED | iPad Pro 12.9" landscape ambiguity if Option B viewport | new V2 swap script | Threshold 820px + UA combo (decided) |
| 🟡 LOW | RapidAPI key exposed chat 2026-05-21 | `.env` | 🚨 Revoke pending DG action item #2 |
| 🟡 LOW | 50 fragmented media queries no breakpoint discipline | `pariscore.html` CSS | V2 Mobile refactor consolidates |
| 🟡 LOW | Audio module conflicting playPromise.catch DOMException | `pariscore.html:31652` | Silent catch wired |
| 🟡 LOW | SQLite WAL journal mode growth unmanaged | `pariscore.db-wal` | Manual `PRAGMA wal_checkpoint` rare |

### Compromises (intentional)

- **Single-file SPA 35k lines** `pariscore.html` — accepted for simplicity vs framework split (React/Vue would add 100KB+ + build step + dependency chain incompatible with zero-dep philosophy).
- **Inline `<style>` 7000+ lines** — accepted for HTTP/1.1 single-roundtrip render. HTTP/2 push would not change much on VPS.
- **No tests** (unit/integration/E2E) — accepted for solo dev + bd-tracked manual UAT + `node --check` syntax gate. Risk acknowledged. Roadmap when team scales.
- **No CI/CD** — manual `git push` + VPS `git pull` + `pm2 restart`. GitHub Actions deferred to monetization phase.

---

## 7. GETTING STARTED (onboarding new contributor)

### Prerequisites

- Node.js >= 16
- SQLite3 (system or auto via better-sqlite3 install)
- `.env` with 8 keys minimum (see below)
- Git access to repo + bd CLI installed (`bd prime`)

### Setup local

```bash
git clone <repo> pariscore && cd pariscore
npm install                         # only installs better-sqlite3
cp .env.example .env                # then edit with real keys
node server.js                      # boot — auto-runs fetchStats + fetchOdds + archivePastMatches
# Server up on http://localhost:3000
```

### Required `.env` keys

```bash
PORT=3000
ODDS_API_KEY=<the-odds-api>          # 500 req/mo free
GEMINI_API_KEY=<google-ai>           # pay-as-you-go
BSD_API_KEY=<bzzoiro-sports-addon>   # $5/mo
JWT_SECRET=                          # auto-gen if absent
ADMIN_PASSWORD=<change-in-prod>
TELEGRAM_BOT_TOKEN=                  # optional
ALERT_EDGE_THRESHOLD=8
ALLOWED_ORIGIN=*                     # restrict in prod
STRIPE_SECRET_KEY=                   # test mode by default
STRIPE_WEBHOOK_SECRET=               # whsec_...
VAPID_PUBLIC_KEY=                    # PWA push notifications
VAPID_PRIVATE_KEY=
```

### First steps

1. **Read** `CLAUDE.md` (poste pilotage GM — roadmap + état actuel + ops actions)
2. **Read** `.claude/CLAUDE.md` (cahier des charges détaillé — 15 sections)
3. **Run** `bd ready` (find available work) + `bd list --status=in_progress`
4. **Browse** `CHANGELOG.md` recent 5 versions (v12.63 → v12.67) to understand cadence
5. **Inspect** SQLite : `sqlite3 pariscore.db ".tables"` (40+ tables : matches, users, stripe_events, bets, alerts, archive_matches, api_cache, tennis_matches, etc.)
6. **Browse** `bd memories` for cross-session knowledge (17 memories : routing layers, BSD quirks, bug patterns, deploy reminders)

### Where to find what

| Need | Location |
|---|---|
| Project pilot state + roadmap | `CLAUDE.md` racine |
| Detailed spec by feature | `.claude/CLAUDE.md` 15 sections |
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

### Common dev workflows

```bash
# Find work
bd ready
bd show <id>

# Claim + work
bd update <id> --claim
# ... edit code ...
node --check server.js              # MANDATORY syntax gate

# Commit (atomic per bd task)
git add <files>
git commit -m "feat(area): bd <id> — short description"

# Close bd task
bd close <id>

# Push (MANDATORY end of session)
git pull --rebase
bd dolt push
git push
git status                          # MUST show "up to date"
```

### Deploy VPS (production)

```bash
ssh ubuntu@<vps-ip>
cd /home/ubuntu/pariscore
git pull
pm2 restart pariscore
pm2 logs pariscore --lines 200 --nostream   # validate boot
```

### Key team agents (`.claude/agents/`)

When complex task triggers, mentally invoke:
- **Product Manager Agent** + **CTO** — strategy
- **CS Engineering Lead** + **Karpathy reviewer** — technical execution
- **Quality regulation CS** + **Responsable financier** — quality + cost
- **CS UX researcher** + **CS Wiki ingestor** — research

---

## APPENDIX A — Stats numériques

| Metric | Value |
|---|---|
| Total versions released | 203 (v1.0 → v12.67) |
| Total commits (since 2026-04-27) | 603 |
| bd issues closed | 57 |
| bd issues in_progress | 8 |
| bd issues ready (open no blocker) | 4 |
| bd memories persisted | 17 |
| Data sources active | 8 |
| Leagues covered (football) | 18+ (BSD 80% coverage post mapping) |
| Math models | 7 (Poisson bivarié + Elo + xG + Bayesian blend + Bootstrap UQD + Reliability + Bet signal + Time-Inhomogène) |
| Context Engine factors | 3 (weather + referee + km travel) |
| SQLite tables | 40+ |
| Frontend lines `pariscore.html` | 35000+ |
| Backend lines `server.js` | ~36000 (estimate) |
| Test coverage | 0% (manual UAT via bd) |
| Production uptime | VPS OVH pm2 stable since v8.x |

## APPENDIX B — Known unknowns / open questions

1. **V2 Mobile decision** — Option A (pure mobile-first) / B (conditional viewport) / C (subdomain) ? — discussion in progress 2026-05-24
2. **Stripe activation** — 9 DG decisions pending (`s77m` checklist)
3. **API-Football scenario** — A maintain kill-switch $0 / B upgrade Pro $19 / C cleanup dead code (`3u9` audit)
4. **bd `dl49` strategy B'** — 6-month wait cron daily accumulation tennis_matches_internal before Phases 4.2-7
5. **bd `8uoc` Sackmann compliance** — Phase 3-7 (ETL interne + refactor consumers + DROP table + LICENSE-DATA) deferred to bd `dl49` accumulation completion
6. **Marketing 5 phases** (`l9vk`) — 1xBet + Twitter + YouTube + Telegram + Stripe — DG signups required
7. **POCs free trial** — OddsPapi.io (250 req Pinnacle) + xvalue.ai (1j trial) — DG signups pending

---

*Generated 2026-05-24 from adapted GSD milestone-summary template + real PariScore artifacts (CHANGELOG.md / bd / git log / CLAUDE.md / .context/). Source of truth tasks = `bd ready`.*
