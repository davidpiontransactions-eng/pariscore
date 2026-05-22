---
type: entity
slug: gemini
title: Google Gemini 1.5 Flash (AI)
status: active
tags: [vendor, ai, llm, pay-as-you-go, proxy-required, sse]
updated: 2026-05-22
sources: ["server.js", "CLAUDE.md", "https://generativelanguage.googleapis.com"]
xref: [[ai-scout]], [[power-score]], [[modal-insights]], [[zero-dep-node]]
bd: [c0qo, p2if]
---

# Google Gemini 1.5 Flash (AI)

**TL;DR:** Provider AI texte génération pour PariScore. Use cases: [[ai-scout]] Combiné du Jour + [[power-score]] verdict /100 + Pro Scout 5 Piliers + bd `p2if` AI-AL Revue Presse. Pay-as-you-go, proxy serveur obligatoire (clé jamais exposée client).

## API

- **Base URL:** `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent`
- **Auth:** query param `?key=${GEMINI_API_KEY}`
- **Méthode:** POST JSON
- **SSE streaming:** `:streamGenerateContent` endpoint variant

## Pricing

- **Input:** $0.075 / 1M tokens
- **Output:** $0.30 / 1M tokens
- Free tier: 15 req/min limit (insuffisant prod, paid tier auto)

Cost typique PariScore:
- AI Scout call: ~$0.0002 (3k input + 500 output)
- Power Score call: ~$0.0001 (2k input + 800 output)
- Pro Scout 5 Piliers: ~$0.0005 (5k input + 1500 output)

**Total estimé runtime:** $1-5/mois pour 100-500 users actifs.

## Proxy serveur obligatoire

`/api/v1/gemini` route POST (server.js) reçoit body JSON client → forward Gemini API server-side → renvoi response. Clé `GEMINI_API_KEY` jamais dans frontend.

Protection bodySize: `readBodyLimited(req, 1Mo)` → HTTP 413 si dépassé.

## SSE Streaming use cases

- **Power Score** (`buildPowerScoreTab(matchId)`) — EventSource → progressive markdown render via marked.js
- **Pro Scout** (`buildScoutingTab(matchId)`) — idem streaming chunks

Reduces TTFB perception user vs synchronous full generate.

## Cache

`apiCacheGet('ai_scout_<date>')` TTL 6h AI Scout. `power_score_<matchId>` TTL 6h. Économise $$ + speed user.

## Function Calling (bd c0qo P2 in_progress)

Bd `c0qo` — intégration Gemini Function Calling + BSD MCP context pour bouton AI-AL. Gemini call tools BSD direct (lineups, predictions, polymarket) pour pull context dynamique. Architecture LangGraph-like sans framework.

## Code locations

- `server.js` `/api/v1/gemini` POST proxy
- `server.js` `aiScoutCache` Map + TTL
- `server.js` Power Score endpoint SSE
- `server.js` Pro Scout endpoint SSE
- `pariscore.html` `psEventSource = new EventSource('/api/v1/powerscore/...')`

## Prompts hardening

Prompts hardcodés server.js (pas externalisés JSON). Évolution future: `prompts/` dir + versionning.

Risque drift output template: Gemini updates modèle → output format change. Monitor + regression tests pending.

## Alternatives évaluées

- **OpenAI GPT-4o** — plus cher (~3-5×), pas testé PariScore (Gemini chosen pour cost)
- **Claude Sonnet/Opus** — disponible via API, considéré pour Pro Scout (qualité supérieure, ~$0.01/call) — décision future
- **Mistral La Plateforme** — moins cher mais qualité variable foot context

Gemini 1.5 Flash = sweet spot cost/quality pour cas PariScore actuels.

## Innovation backlog

- **Multi-model routing** — Gemini Flash pour scout simple, Claude Opus pour Pro Scout complex (qualité)
- **Prompts versionning** — externaliser `prompts/<feature>.md` + git track
- **Function Calling MCP** (bd c0qo) — Gemini tools BSD direct
- **Backtest AI picks accuracy** vs random baseline

## Bd tickets

- `c0qo` P2 in_progress — Gemini Function Calling + BSD MCP AI-AL
- `p2if` P1 in_progress — AI-AL Revue Presse Foot+Tennis 5 avis presse panel Gemini (Phase 1 livré commit `ae6a292`, Phase 2 Telegram push ouvert)

## Related

- [[ai-scout]] — Consommateur primary
- [[power-score]] — Consommateur SSE streaming
- [[modal-insights]] — Onglets Power Score + Scouting
- [[zero-dep-node]] — Justification HTTP wrapper natif

## Changelog

- 2026-05-22: création initiale lors du bootstrap wave 2
