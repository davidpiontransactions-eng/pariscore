---
type: concept
slug: live-intensity
title: Live Intensity Score (0-100 dynamique match)
status: active
tags: [concept, live, sse, momentum, polling, sofa]
updated: 2026-05-22
sources: ["server.js (computeLiveIntensityFromSofa)", "pariscore.html"]
xref: [[bsd-bzzoiro]], [[api-football]], [[sse]], [[live-dashboard-cockpit]], [[alertes-telegram]], [[momentum]]
---

# Live Intensity Score

**TL;DR:** Score composite 0-100 calculé toutes les 60s pendant match live, reflète pression/dynamique offensive. Input pour alertes Telegram + UI badges + [[live-dashboard-cockpit]].

## Formule (computeLiveIntensityFromSofa)

```
intensity = weighted_sum(
  possession_imbalance × 0.15,
  shots_on_target_rate × 0.25,
  corners_recent_5min × 0.20,
  dangerous_attack_pct × 0.20,
  big_chances × 0.15,
  pressure_delta × 0.05
)
intensity = clamp(intensity, 0, 100)
```

Pondération basée backtesting v9.x. Tuned pour foot — variantes tennis distinct (DR spike, break point pressure).

## Inputs

- [[bsd-bzzoiro]] `/v2/events/{id}/stats/` (livré bd j6pz) — possession, shots breakdown, corners, big_chances, expected_goals
- [[api-football]] `/fixtures?live=all` — fallback si BSD HS

Polling 60s window 19h-23h Paris heure live foot.

## Code locations

- `server.js:29238` — `computeLiveIntensityFromSofa(match, stats)`
- `server.js` — `match.live_intensity` field broadcast SSE
- `pariscore.html` ligne tableau — barre intensity colorée:
  - >=60: rouge `#E2001A` (high)
  - >=30: ambre `#ffa726` (medium)
  - <30: bleu `#29b6f6` (low)
- `pariscore.html:21118-21124` — `data-intensity` + `data-intensity-val` slots

## Wire alertes

- `pariscore.html` page `#page-alertes` — toggle alerte si `live_intensity >= intensityMin` (config user)
- `server.js pollLiveScores()` — broadcast SSE intensity updates + trigger Telegram bot
- Cooldown 15min par (user, match) anti-spam

## Variantes tennis (concepts cousins)

- **DR (Dynamic Rating) spike** — bd `6v0` SSE event break momentum
- **Break Point Pressure Index** — bd `6xw` tennis live
- **Market Divergence delta + slope 15min** — bd `a8n` SSE

## Limites

- Poids hardcodés (pas auto-tuned per ligue/équipe)
- Pas distinction phase match (90' end-game ≠ 30' mid-game même intensity raw)
- Pas IC sur score
- BSD pas dispo tous matchs (coverage variable)

## Innovation backlog

- **Auto-tune weights** per league via gradient descent backtest accuracy alertes
- **Phase-aware** intensity scaling (mid-game vs end-game)
- **Multi-sport** generalization (tennis DR + BP pressure + serve hold)

## Related

- [[bsd-bzzoiro]] — Source stats live primary
- [[api-football]] — Fallback
- [[sse]] — Channel broadcast (à créer wave 3)
- [[live-dashboard-cockpit]] — Consommateur (à créer wave 2)
- [[alertes-telegram]] — Trigger (à créer wave 3)
- [[momentum]] — Concept cousin SVG visualization (à créer wave 3)

## Changelog

- 2026-05-22: création initiale lors du bootstrap wave 2
