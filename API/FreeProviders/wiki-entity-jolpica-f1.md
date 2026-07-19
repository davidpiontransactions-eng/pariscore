---
type: entity
slug: jolpica-f1
title: Jolpica F1 (Ergast successor)
status: candidate-free
tags: [vendor, api, f1, history, free-tier, open-source, ergast]
updated: 2026-07-19
sources: ["https://github.com/jolpica/jolpica-f1", "http://api.jolpi.ca/ergast/f1/"]
xref: [[free-api-pariscore-field-map]], [[openf1]]
feeds_fields:
  - f1_results
  - f1_standings
  - f1_drivers
  - f1_constructors
priority: P2
---

# Jolpica F1

**TL;DR:** Successeur open-source d'**Ergast** (shutdown 2024). Gratuit, compatible endpoints Ergast. ~200 req/h. Données F1 depuis 1950.

## Pricing

| Tier | Prix |
|------|------|
| **Public API** | Free (donations Ko-fi) |

## Auth

- None
- Base: `https://api.jolpi.ca/ergast/f1/`
- Migration Ergast: remplacer `ergast.com/api/f1/` → `api.jolpi.ca/ergast/f1/`

## Champs PariScore alimentés (futur F1)

| Champ | Usage |
|-------|-------|
| race results | Résultats GP |
| driver/constructor standings | Classements |
| qualifying / sprint | Sessions |
| circuits / seasons | Metadata |

## Related

- [[openf1]] — télémétrie live
- [[free-api-pariscore-field-map]]
- ⚠️ Ergast original = **MORT** — ne plus utiliser ergast.com
