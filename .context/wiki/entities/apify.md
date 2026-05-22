---
type: entity
slug: apify
title: Apify
status: active
tags: [platform, scraper, one-shot, datasets, sourcing]
updated: 2026-05-22
sources: ["dataset_flashscore-*.json", "dataset_sofascore-*.json", ".context/audits/audit-data-missing.md", "https://apify.com"]
xref: [[sofascore]], [[flashscore]], [[xvalue]]
bd: [qm6a, 6jro, ffh]
---

# Apify

**TL;DR:** Plateforme cloud scraping. Use case PariScore = one-shot datasets dumps de [[sofascore]] + [[flashscore]] (snapshots ponctuels). Décision DG pending sur continuous scraper webhook (recurring $) vs alternative [[xvalue]] (bd `ffh` GO 85/100).

## Datasets utilisés racine projet

| Filename | Source scraper | Sport | Entries | Use case |
|---|---|---|---|---|
| `dataset_flashscore-team-stats_2026-05-21_23-54-30-172.json` | flashscore-team-stats Apify Actor | foot+basket | 80 (20 EPL + 60 NBA) | Logos backup ([[flashscore]] Plan A) |
| `dataset_flashscore-live-matches_2026-05-22_00-03-54-224.json` | flashscore-live-matches | foot | 3 | Live stream flag + live stats fallback (Plans E/F) |
| `dataset_sofascore-scraper-pro_2026-05-22_00-07-03-587.json` | sofascore-scraper-pro | foot+tennis | 2 (1 player + 1 match) | Profile + editorial + venue/referee (Plans G/H/D) |

## Stratégie

**Actuel:** One-shot manual dumps → ETL `tools/import-*` → SQLite `api_cache` → lookup runtime.

**Limites:**
- Snapshot ponctuel = données vieillissent (TTL 7-90j)
- Pas de live continuous data
- Échantillon limité (3 matchs live, 2 entries Sofascore)

**Évolutions possibles:**
1. **Apify webhook continuous** — scraper en mode permanent webhook → enrichissement runtime auto (bd `6jro` Plan J)
2. **Cron batch run** Apify Actor depuis user CLI → re-dump périodique (manuel)
3. **Pivot [[xvalue]]** — alternative pipeline propre (bd `ffh` GO ferme 85/100)

## Coûts

Apify pricing model:
- Free tier: limites mensuelles
- Actors paid per compute unit (CU)
- Webhook continuous = $X/mo recurring (à devisser)

vs [[xvalue]] free trial 1j → eval (bd ffh) puis pricing API direct.

## Bd tickets

- `qm6a` P3 — Flashscore datasets integration (4/6 plans livrés)
- `6jro` P3 — Sofascore datasets integration (Plans G+H+I livrés, J pending)
- `ffh` P2 closed — Spike 6 sources eval final (Sofascore profile GO, live NO-GO)

## Decision pending DG

**Plan J 6jro continuous Apify webhook**:
- Pros: feed continu auto, pas de dumps manuel
- Cons: $ recurring, scraping ToS gray area (Sofascore strict anti-bot), Apify dependency
- Alternative: [[xvalue]] pipeline propre (bd ffh GO)

Recommandation pratique: garder Apify one-shot ad-hoc batch run, prioriser xvalue pour use cases prod.

## Related

- [[sofascore]] — Source via Apify scraper
- [[flashscore]] — Source via Apify scraper
- [[xvalue]] — Alternative continuous pipeline (DG decision)

## Changelog

- 2026-05-22: création initiale lors du bootstrap wiki — synthèse 3 datasets + ETL tools session 22/05
