---
type: entity
slug: openf1
title: OpenF1 API
status: candidate-free-partial
tags: [vendor, api, f1, telemetry, free-tier-partial]
updated: 2026-07-19
sources: ["https://openf1.org/", "https://openf1.org/docs/"]
xref: [[free-api-pariscore-field-map]], [[jolpica-f1]]
feeds_fields:
  - f1_telemetry
  - f1_laps
  - f1_live
priority: P2
---

# OpenF1 API

**TL;DR:** F1 télémétrie open-source. **Historique gratuit sans auth**. **Live payant** pendant sessions (30 min avant → 30 min après). Free rate: 3 req/s, 30 req/min.

## Pricing

| Data | Prix |
|------|------|
| **Historical** (hors session live) | Free, no signup |
| Live session | Paid subscription |

## Auth

- History: none
- Live: authenticated paid users
- Base: openf1.org

## Champs PariScore alimentés (futur onglet F1)

| Champ | Usage |
|-------|-------|
| laps / positions | Live F1 board |
| car telemetry | Advanced F1 analytics |
| race control | incidents |

## Note

Pendant une session live, même l'historique public peut être restreint. Pour historique full offline: self-host le repo openf1.

## Related

- [[jolpica-f1]] — résultats F1 structurés (Ergast-like)
- [[free-api-pariscore-field-map]]
