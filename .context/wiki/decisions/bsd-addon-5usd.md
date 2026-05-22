---
type: decision
slug: bsd-addon-5usd
title: ADR — Achat BSD Sports Addon $5/mo (Bzzoiro)
status: active
tags: [adr, vendor, cost, paid-data, tennis-coverage]
updated: 2026-05-22
sources: ["CLAUDE.md", ".context/audits/audit-bsd-nouvelles-ligues.md"]
xref: [[bsd-bzzoiro]], [[api-football]], [[sackmann-purge]]
bd: []
---

# ADR — Achat BSD Sports Addon $5/mo (Bzzoiro)

**Date:** ~2026-03 (estim). **Statut:** ACTIF, renew **2026-06-16** à surveiller.

## Décision

Souscrire Sports Addon $5/mo Bzzoiro pour débloquer endpoints tennis BSD (point-by-point, serve stats, ML predictions CatBoost) + WebSocket live foot push <5s.

## Pourquoi

1. **Tennis coverage** — sans addon, BSD retourne HTTP 402 `ADDON_REQUIRED` sur `/tennis/*`. Tennis = 30%+ matchs PariScore.
2. **Live WS foot** — WS push <5s vs polling REST 60s [[api-football]]. Bd `5iw` integration livrée.
3. **ML predictions** — CatBoost trained models par event (1X2, BTTS, Over) — input value-bet pipeline.
4. **Coût ridicule** vs [[api-football]] PRO $19/mo. $60/an total addon.

## Alternatives évaluées

| Source | Pros | Cons | Verdict |
|---|---|---|---|
| **BSD Addon** | Live WS + ML + tennis riche | $5/mo + ligues add $29 one-time | ✅ Choisi |
| ESPN public free | Gratuit, no auth | No live point-by-point tennis, no ML | Fallback only |
| Sofascore live | Très riche | Anti-bot strict, ToS gray | NO-GO (bd ffh 53/100) |
| Tennis Abstract | Free Elo + reports | Pas live, scraping fragile | Complementary research |
| Sackmann GitHub | Historique massif | **CC BY-NC-SA = incompatible commercial** | Purge en cours bd `8uoc` |

## Coûts cumulés

- $5/mo × 12 = **$60/an** addon
- Plus: **$29 one-time à vie par ligue non couverte** (frais infra Bzzoiro, demande via Discord/form)
- Budget couverture extension ligues = décision DG cas par cas

## Renew

- Expire **2026-06-16**
- Auto-renew via Stripe BSD (à vérifier dashboard)
- TODO: setup reminder calendar 2026-06-01 pour vérifier renewal OK

## Risques

- **Vendor lock-in** — BSD = primary source, churn impacte plusieurs features
- **Provider stabilité** — Bzzoiro = small vendor (1 personne?), risque shutdown
- **Mitigation:** garder [[api-football]] + [[espn]] + [[sofascore]] datasets comme fallbacks (déjà fait)

## Related

- [[bsd-bzzoiro]] — Détails endpoints + tarifs
- [[api-football]] — Source alternative complementary $19/mo
- [[sackmann-purge]] — Décision purge data incompatible licence

## Changelog

- 2026-05-22: ADR formalisé lors du bootstrap wiki
