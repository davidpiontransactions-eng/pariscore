---
type: entity
slug: oddsmagnet
title: Oddsmagnet
status: candidate-free
tags: [vendor, api, odds, history, backtest, free-tier, uk-books]
updated: 2026-07-19
sources: ["https://oddsmagnet.com/oddsdata", "https://github.com/arturzangiev/oddsmagnet-sample-pandas"]
xref: [[free-api-pariscore-field-map]], [[edge-no-vig]], [[odds-api]]
feeds_fields:
  - oddsHistory
  - dropping_odds
  - clv
  - strategy_backtest
priority: P0
---

# Oddsmagnet

**TL;DR:** Historique cotes UK bookmakers. **Free** = agrégat quotidien (parquet). Paid = granularité book-level live (£300/mo). Idéal backtest stratégies + CLV sans clé API.

## Pricing

| Offre | Prix | Granularité |
|-------|------|-------------|
| **Historical Aggregated** | **Free** | 1 ligne/jour/outcome (moyenne books) |
| Historical Granular | £100/sem ou £300/mo | 1 update/bookmaker/timestamp |
| Betting Odds API | On request | Live per book |

## Auth

- **None** pour le free daily parquet
- Base: `https://data.oddsmagnet.com/history-daily/`
- Sample granular: `https://data.oddsmagnet.com/history/`

## Champs PariScore alimentés

| Champ | Usage |
|-------|-------|
| `oddsHistory[]` | Snapshots dropping odds |
| CLV / closing lines | KPIs admin, edge quality |
| Strategy backtest | ROI sim STRATEGIES |
| dropping odds tracker | alertes mouvement de ligne |

## Intégration

- Cron nightly: download parquet → SQLite/cache
- Enrichir `oddsHistory` sans brûler `ODDS_API_KEY`
- Format: Parquet + Snappy, partition year/month/day

## Related

- [[free-api-pariscore-field-map]]
- [[edge-no-vig]]
