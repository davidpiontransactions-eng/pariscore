---
type: concept
slug: value-bet
title: Value Bet (definition + critères BET)
status: active
tags: [concept, value-betting, ev, ic, definition]
updated: 2026-05-22
sources: ["CLAUDE.md", "server.js"]
xref: [[edge-no-vig]], [[poisson-bivarie]], [[kelly-cap]], [[ai-scout]], [[bootstrap-uqd]]
---

# Value Bet (definition + critères BET)

**TL;DR:** Pari avec **Expected Value (EV) > 0**, càd cote bookmaker > prob "fair" implicite. Critères PariScore stricts: EV>5% AND borne inférieure IC90>0 (innovation backlog). Concept core de tout le système value-betting.

## Définition mathématique

```
EV = (prob_fair × (cote - 1)) - ((1 - prob_fair) × 1)
   = cote × prob_fair - 1
```

Si EV > 0: pari sous-évalué par bookmaker = opportunité.
Si EV < 0: pari sur-évalué = à éviter (sauf bias correction utilisée).

**Exemple:**
- Cote bookmaker = 2.50 (prob implicite naïve = 40%)
- Devig Shin-Hurley → prob_fair = 45%
- EV = 2.50 × 0.45 - 1 = **+12.5%**

## Critères BET PariScore (proposed strict — innovation backlog)

| Critère | Seuil | Justification |
|---|---|---|
| EV | > +5% | Buffer vs noise modèle |
| Borne inf IC90 | > 0 | Confiance prob_fair pas overestimate (Bootstrap UQD) |
| Sample size match data | ≥ 10 matchs historiques par équipe | Variance stats acceptable |
| Power Score (cf. [[power-score]]) | ≥ 60 /100 | Convergence multi-signaux |
| Pas de injuries clés non couvertes | ✅ | Risk-adjusted EV |

Si **tous** critères OK → **BET**. Sinon → **PASS** ou **WATCH**.

## États possibles (verdict)

| État | Critères |
|---|---|
| **BET** | EV>5% ET IC>0 ET PowerScore≥60 ET sample OK |
| **WATCH** | EV>0 mais IC borderline OU PowerScore<60 |
| **PASS** | EV≤0 |
| **FADE** | EV<<0 + signaux contrarian (foule trade against) — Live Dashboard Phase 3 |

## Sources prob_fair

| Source | Use |
|---|---|
| [[edge-no-vig]] devig Shin-Hurley | Primary — depuis cotes books |
| [[poisson-bivarie]] | Cross-check from xG model |
| Power Score Gemini | Soft input convergence |
| Polymarket sharp | Anchor low-vig (innovation bd `bjv`) |

Convergence multi-source = signal qualité supérieur.

## Validation backtesting

`history.json` + `/api/v1/accuracy`:
- Win rate paris EV>5% historique
- ROI cumul
- Calibration Brier score (probabilités annoncées vs frequencies observées)

Cible: Win rate ≥ 55% + ROI positif ≥ 5% sur 1000+ paris vérifiés.

## Anti-patterns à éviter

- ❌ **Confondre EV + Win Rate** — EV peut être positif avec 30% win rate si cote 4.00
- ❌ **Cherry-pick uniquement edge max** sans IC check (noise → false positives)
- ❌ **Ignorer corrélation paris** dans combinés (Kelly généralisé requis)
- ❌ **Bet sans data fresh** — stats anciennes = devig biaisé

## Lien Kelly Cap

Value bet identifié → sizing via [[kelly-cap]] fractional 25% pour amortir variance + protéger bankroll.

## Innovation backlog

- **Bayesian Value Radar** Data Blending Poisson + Elo + xG Logistic → prob_fair Bayesian update
- **Bootstrap UQD** 500 itérations IC90 par match (rigueur scientifique CLAUDE.md)
- **Score composite fiabilité /100** volume data + stabilité xG + calibration

## Related

- [[edge-no-vig]] — Engine devig + EV calculation
- [[poisson-bivarie]] — Source prob complémentaire
- [[kelly-cap]] — Sizing depuis value bet identifié
- [[ai-scout]] — Filter top 5 value bets candidats
- [[bootstrap-uqd]] — IC90 calculation (à créer wave 4)

## Changelog

- 2026-05-22: création initiale wave 3 — synthèse CLAUDE.md innovation backlog rule
