---
type: decision
slug: api-football-pro-upgrade
title: ADR — Upgrade API-Football Free → PRO ($19/mo)
status: active
tags: [adr, vendor, cost, paid-plan, quota-upgrade]
updated: 2026-05-22
sources: ["CLAUDE.md", ".context/strategy/etude-marche-api-football.md", "server.js"]
xref: [[api-football]], [[bsd-addon-5usd]], [[smart-polling]]
bd: [9je]
---

# ADR — Upgrade API-Football Free → PRO ($19/mo)

**Date:** ~2026-04. **Statut:** ACTIF.

## Décision

Upgrade `API_FOOTBALL_KEY` plan **Free 500 req/mois** → **PRO $19/mois 7500 req/jour**.

## Raison

Couverture 18 ligues + stats avancées (xG, Cartons, Tirs) + Smart Polling live 60s nécessite:
- 18 ligues × standings 12h refresh = 36/jour = ~1080/mois (déjà 2× quota free)
- Live polling fenêtre 19h-23h × 60s = 240 req/jour = 7200/mois (15× quota free)
- Stats avancées `/teams/statistics?team&league&season` (cache 24h) = 18 ligues × ~20 teams = 360 req/jour
- ETL historique massif occasionnel (bd `9je`) = 1000-5000 req batch

**Cumul:** ~10-15k req/mois minimum hors ETL. Quota Free 500 = stop net.

## Coût

- $19/mo × 12 = **$228/an**
- Marge confortable 7500/jour permet Smart Polling agressif + ETL périodique

## Alternative évaluée

| Plan | Quota | Coût |
|---|---|---|
| **Free** | 500/mois | $0 |
| Pro (choisi) | 7500/jour ~225k/mois | $19/mo |
| Ultra | 75k/jour | $99/mo |

Pro suffit largement. Ultra justifiable seulement si live polling permanent 24/7 multi-régions (non requis).

## Innovation cost mitigation

- Migration progressive vers [[bsd-bzzoiro]] (kill-switch v10.77) — réduit dépendance API-Football → possible downgrade futur
- Cron stratifié T1 (6h ligues majeures) vs T2 (12h secondaires) — Smart Polling (cf. [[smart-polling]])
- Cache TTL agressifs (12h standings, 24h stats avancées)

## Comparaison cumul subscriptions

- [[bsd-bzzoiro]] Addon: $5/mo = $60/an
- API-Football Pro: $19/mo = $228/an
- **Total data subscriptions: $288/an** + extras (Gemini pay-as-you-go, Stripe revenu net)

ROI: 1 abonné Pro PariScore €19/mo amortit déjà l'API-Football Pro. Cible 100+ users 3 mois → ROI net positif.

## Risque réduction Pro

Si migration BSD complète + bd `3u9` kill-switch validé prod → re-évaluer downgrade Pro → Free pour résiduel standings backup uniquement.

## Bd liés

- `9je` P0 — Pipeline ETL Historique Football API-Football PRO (run bloqué quota épuisé, reset minuit UTC)
- `3u9` P2 — API-Football retiré kill-switch v10.77 suivi post-prod
- `zia` P2 — Consolidation P3 migrer odds Odds API → API-Football odds

## Related

- [[api-football]] — Détails endpoints
- [[bsd-addon-5usd]] — Décision complementary moins chère
- [[smart-polling]] — Optimisation quota (à créer wave 3)

## Changelog

- 2026-05-22: ADR formalisé lors du bootstrap wiki
