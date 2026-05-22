---
type: entity
slug: transfermarkt
title: Transfermarkt (via felipeall sidecar self-host)
status: active-sidecar
tags: [vendor, sidecar, foot, transfers, market-value, scraping]
updated: 2026-05-22
sources: ["server.js", "CLAUDE.md", ".context/etude-transfermarkt-vs-stack-actuel-2026.md", "https://transfermarkt.com"]
xref: [[bsd-bzzoiro]], [[apify]]
bd: [xzo, nyg]
---

# Transfermarkt (via felipeall sidecar self-host)

**TL;DR:** Source data transferts + valeurs marchandes joueurs. Accédé via **sidecar self-hosted** `felipeall/transfermarkt-api` (GitHub) — scraping clean encapsulé. Use cases PariScore: transferts récents + market values + KPI Fiche Quant joueur (décision DG pending bd `xzo`).

## Sidecar `felipeall/transfermarkt-api`

- **Repo:** https://github.com/felipeall/transfermarkt-api
- **Tech:** Python FastAPI + BeautifulSoup scraping
- **Hosting:** self-host VPS OVH (port distinct, behind nginx reverse proxy)
- **Justification:** evite scraping direct PariScore (anti-bot Transfermarkt strict)

## Endpoints proxiés PariScore

`server.js` route `/api/v1/transfermarkt/*` proxy vers sidecar local:
- Players search by name
- Player profile (market value + position + age + nationality)
- Transfer history
- Player news

## Bd `bsd/transfers/<bsdPlayerId>` route

`server.js:26853` — `/api/v1/bsd/transfers/<bsdPlayerId>` OR `?id=` OR `?name=`. Résout BSD player ID → query Transfermarkt sidecar.

Gates: FOOT_PRO (server.js:14514).

## Use cases

- **KPI Fiche Quant joueur** — affiche market value + age + transfer activity dans top_players modal Insights
- **Transferts récents** — section "Mercato" page Matchs (TODO future)
- **Injury context** — Transfermarkt injuries DB cross-ref BSD predictions

## Decisions DG pending

- **bd `xzo` P3** — Décision: intégrer transfermarkt-api (Fiche Quant joueur) ? Roadmap activation.
- **bd `nyg` P3** — Voie D — intégration Apify curious_coder/transfermarkt (alternative sidecar self-host via Apify cloud)

## Coûts

Self-host = $0 incremental (VPS OVH déjà payé). vs Apify alternative = $/compute Apify Actor.

Pros self-host: cost zero, latency local, données chez nous.
Cons self-host: maintenance scraping break, scaling 1 instance.

## Risques

- **Transfermarkt anti-bot evolution** — sidecar peut break à chaque update du site
- **ToS gray area** — scraping data publique, mais pas authorized formellement
- **Self-host SPOF** — sidecar down = feature down

## Mitigation

- Monitor sidecar health endpoint
- Cache aggressively (player profiles changent rarement)
- Fallback graceful (empty market value field UI)

## Bd tickets

- `xzo` P3 — Décision intégration Transfermarkt
- `nyg` P3 — Voie D Apify alternative

## Innovation backlog

- **News scraping** Transfermarkt rumeurs transferts → input AI-AL Revue Presse (bd `p2if`)
- **Injuries DB cross-ref** [[bsd-bzzoiro]] predictions ML
- **Market value tier** filtre tableau Foot (équipes valeurs comparables)

## Code locations

- `server.js:26851-26854` — `/api/v1/bsd/transfers/<bsdPlayerId>` route
- `server.js` `/api/v1/transfermarkt/*` proxy routes
- Sidecar: `transfermarkt-api/` self-hosted (TODO documenter port + nginx config)

## Related

- [[bsd-bzzoiro]] — Source player IDs principal
- [[apify]] — Alternative sourcing (bd `nyg` voie D)

## Changelog

- 2026-05-22: création initiale wave 3
