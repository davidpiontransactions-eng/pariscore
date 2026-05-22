---
type: feature
slug: live-dashboard-cockpit
title: Live Dashboard Betting Cockpit
status: active-phase1-livre
tags: [feature, live, dashboard, cockpit, win-prob, sse, premium]
updated: 2026-05-22
sources: ["pariscore.html", "server.js", "bd qe5"]
xref: [[bsd-bzzoiro]], [[live-intensity]], [[momentum]], [[poisson-bivarie]], [[modal-insights]], [[sse]]
bd: [qe5, 5am0]
---

# Live Dashboard Betting Cockpit

**TL;DR:** Modal dédié live in-play par match. Phase 1 livré v12.62 (Minute promue + cockpit). Phase 2/3 spec ouverte (bd `qe5`). Vue cockpit trader: Win Prob temps réel + top 3 picks + events markers + verdict actionnable.

## Phases roadmap

| Phase | Status | Scope |
|---|---|---|
| **Phase 1** ✅ v12.62 | livré | Minute promue + cockpit shell + barre intensity |
| **Phase 1.5** | bd `5am0` open | Events markers (buts/cartons/SOT) sur SVG momentum |
| **Phase 2** | bd `qe5` spec | Win Prob temps réel calculé live + top 3 picks |
| **Phase 3** | bd `qe5` spec | Verdict actionnable (BET/PASS/FADE) auto |

## Composants livrés Phase 1

- **Cockpit modal** — distinct de [[modal-insights]] pré-match
- **Minute promue** — affichage minute live + score live haute visibilité
- **SVG momentum** `#ld-momentum-svg` (pariscore.html:8795) — visualisation pression
- **SVG momentum modal** `#ldm-momentum-svg` (:13615)
- **Live intensity bar** (cf. [[live-intensity]]) — 0-100 colorée
- **SSE channel** broadcast `match.live_*` fields

## Phase 1.5 spec (bd `5am0`)

Events markers sur SVG momentum:
- Buts (icône ⚽ vert avec minute)
- Cartons jaunes/rouges (icône 🟨🟥)
- Tirs cadrés (SOT) cluster
- Subs (icônes joueurs in/out)
- Source: [[bsd-bzzoiro]] `/v2/events/{id}/incidents/` (TTL 1min cache)

## Phase 2 spec (bd `qe5`)

**Win Prob temps réel live:**
- Modèle Poisson time-inhomogène conditionnel minute par minute
- Inputs: score actuel, minute, intensity, possession, big_chances, expected_goals partial
- Output: P(home_win), P(draw), P(away_win) updated every 60s
- Affichage 3 barres horizontales colorées (vert/orange/rouge) avec % anim

**Top 3 picks live:**
- Filter active bets value live (over_X.5_lives, BTTS_yes_live, next_goal_team)
- Trier par EV calculé live cotes vs prob Poisson time-inhomogène
- Affichage carrousel 3 cards avec cote + edge + action button

## Phase 3 spec (bd `qe5`)

**Verdict actionnable:**
- Aggregation Phase 2 signals → verdict {BET, PASS, FADE} + reasoning court
- BET: signaux convergent EV>5% + intensity favorable
- PASS: signaux mixed / no clear edge
- FADE: contrarian opportunity (foule trade against)
- Bouton "Saisir pari" direct → modal [[mes-paris]] pré-rempli

## Audio alertes (bd rlhf ✅ livré commit fc9c65e)

Module audio orchestrateur 4 indicateurs:
- Goal scored
- Card shown
- Intensity spike +30 in 60s
- Edge >10% détecté

State tracking transitions + queue 200ms cap 3 sons/burst. Toggle 🔇/🔊 user-side.

## Code locations

- `pariscore.html:8795` — `#ld-momentum-svg` SVG momentum tableau
- `pariscore.html:13615` — `#ldm-momentum-svg` SVG modal cockpit
- `pariscore.html` audio orchestrator (rlhf commit fc9c65e)
- `server.js` `broadcastSSE(payload)` (server.js:1290)
- `server.js` `/api/v1/live` SSE endpoint (:15253)
- `server.js` `sseClients` Set tracking

## Innovation backlog

- **Poisson Time-Inhomogène** modèle live (CLAUDE.md innovation)
- **Bayesian Value Radar** Data Blending Poisson + Elo + xG (CLAUDE.md)
- **Alertes SSE triggers** `favorite_trap` + `goal_flood` (CLAUDE.md)

## Bd tickets

- `qe5` P1 — Live Dashboard Cockpit Phase 2/3 spec
- `5am0` P2 — Events markers SVG momentum
- `rlhf` ✅ closed — Module audio orchestrateur
- `c0qo` P2 in_progress — Gemini Function Calling + BSD MCP pour bouton AI-AL (related)

## Related

- [[bsd-bzzoiro]] — Source primary live data
- [[live-intensity]] — Composant central
- [[momentum]] — SVG visualization (à créer wave 3)
- [[poisson-bivarie]] — Modèle pré-match (Phase 2 = time-inhomogène derived)
- [[modal-insights]] — Modal complémentaire pré-match
- [[sse]] — Channel broadcast (à créer wave 3)

## Changelog

- 2026-05-22: création initiale lors du bootstrap wave 2
