---
type: concept
slug: power-score
title: Power Score (IA Gemini composite /100)
status: active
tags: [concept, ai-model, gemini, sse, scoring, premium]
updated: 2026-05-22
sources: ["server.js", "pariscore.html", "CLAUDE.md"]
xref: [[gemini]], [[modal-insights]], [[poisson-bivarie]], [[edge-no-vig]], [[ai-scout]]
---

# Power Score (IA Gemini composite /100)

**TL;DR:** Score composite synthétique /100 par match généré par Gemini en streaming SSE. Onglet `ins-tab-powerscore` modal Insights. Combine signaux Poisson + Edge + forme + xG + injuries + H2H. Affiché en gauge circulaire animé.

## Composition

Gemini reçoit prompt structuré avec:
- Stats home/away (xG, PPG, forme L5/L10)
- Probabilités [[poisson-bivarie]] (BTTS, Over, 1X2)
- [[edge-no-vig]] best opportunity + cote
- H2H 10 derniers
- Standings rank + form
- Injuries marquées + key players KPI
- Lineups confirmed (si dispo BSD)

Génère verdict /100 + breakdown 4-5 piliers (Forme / Match-up / Value / Risque).

## Streaming SSE

```js
// pariscore.html
let psEventSource = new EventSource(`/api/v1/powerscore/${matchId}`);
psEventSource.onmessage = (event) => {
  psBuffer += event.data;
  renderPowerScorePartial(psBuffer);
};
```

Backend `/api/v1/powerscore/:id` streame chunks Gemini → frontend render markdown progressif.

## Cache

TTL 6h via `apiCacheGet('power_score_<matchId>')`. Première génération = $0.005-0.02 Gemini call. Cache hit = $0.

## Wire UI

- `pariscore.html:24039+` — `psEventSource` + `psBuffer`
- `buildPowerScoreTab(matchId)` — gauge SVG + markdown render via marked.js
- Test report: `.context/test-report-powerscore-gauge.md`

## Gauge visuel

Circular SVG 0-100, code couleur:
- 0-40: rouge "Pari Risqué"
- 40-60: orange "Neutre"
- 60-75: vert clair "Solide"
- 75-100: vert foncé "Conviction Élite"

## Variantes

- **Power Score V2** (livré v9.x) — intègre RSS L'Équipe + Marca scraping pour `synthese_globale_web`
- **AI Scout / Combiné du Jour** — utilise Power Score top 5 matchs comme input (cf. [[ai-scout]])

## Pricing

Gemini 1.5 Flash: $0.075 / 1M input tokens + $0.30 / 1M output. Prompt ~2k tokens + output ~800 tokens = ~$0.0001 per call. Cache 6h = ~4 generations/jour/match × 50 matchs = ~$0.02/jour soutenu.

## Limites

- Pas d'IC sur score (Gemini = LLM probabiliste, output varie)
- Pas de calibration backtesting Brier (TODO innovation)
- Dépend stabilité prompt Gemini (template changes = drift)

## Innovation backlog (CLAUDE.md)

- **Score composite fiabilité /100** — volume data + stabilité xG + calibration (vs current heuristic)
- **xvalue.ai ML scouting** clustering 30 ligues + style_shift_score 0-100 contribuant `confidence_badge` (bd `ffh` GO 85/100)

## Related

- [[gemini]] — Provider AI (à créer wave 3)
- [[modal-insights]] — Onglet `ins-tab-powerscore` host
- [[poisson-bivarie]] — Input prob
- [[edge-no-vig]] — Input opportunity
- [[ai-scout]] — Consommateur top-5 power scores (à créer wave 2)

## Changelog

- 2026-05-22: création initiale lors du bootstrap wave 2
