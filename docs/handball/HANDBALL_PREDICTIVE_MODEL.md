# Modèle Prédictif Handball — Mapping 1xBet × Métriques Académiques

**Date**: 2026-09-16
**Sources**: Felice & Ley 2025, Karlis et al. 2026, Broermann et al. 2026, Krawczyk et al. 2025, Daza et al. 2017, Pollard & Gómez, Mortimer & Burt 2014

---

## Vue d'ensemble — 9 Bet Types × Métriques Pondérées

### Formule générale

```
P(bet) = Σ(metric_i × weight_i) + home_advantage_adjustment
```

---

## 1. Match Winner (1X2)

| Métrique | Poids | Source | Justification |
|----------|-------|--------|---------------|
| **Team Strength Estimate (ELO/form)** | 35% | Felice 2025 | Feature la + importante (SHAP) |
| **Goalkeeper Save %** | 20% | Daza 2017 | Prédicteur "adéquat" performance équipe |
| **Fast-break Efficiency** | 15% | Krawczyk 2025 | Significativement plus élevé en victoire |
| **6m Shooting Accuracy** | 15% | Krawczyk 2025 | Prédicteur goal difference |
| **Home Advantage** | +10% | Pollard & Gómez | 55-58% win rate home (vs 50% base) |
| **7m Penalty Count** | 10% | Daza 2017 | Proxy pression offensive |
| **H2H Record** | 5% | Empirique | Patterns récurrents |

**Accuracy attendue**: ~80% (Felice 2025: RF+CMP > 80%)

---

## 2. Double Chance (1X / 2X / 12)

| Métrique | Poids | Source |
|----------|-------|--------|
| **Team Strength Estimate** | 30% | Felice 2025 |
| **Goalkeeper Save %** | 20% | Daza 2017 |
| **Home Advantage** | 15% | Pollard (home +10%) |
| **Draw Probability (Skellam P(0))** | 15% | Karlis 2026 |
| **Recent Form (PPG L5)** | 10% | Empirique |
| **Fatigue/Rest Days** | 10% | Empirique |

**Note**: 1X = P(home) + P(draw) ≈ 64%. 12 = P(home) + P(away) ≈ 89%.

---

## 3. Total Points (Over/Under 57.5)

| Métrique | Poids | Source | Justification |
|----------|-------|--------|---------------|
| **Team Pace (possessions/game)** | 25% | Broermann 2026 | H-xT: volume d'actions |
| **Combined Shot Efficiency** | 25% | Krawczyk 2025 | 6m + wing accuracy |
| **Goalkeeper Save % (both)** | 20% | Daza 2017 | Saves ↓ = goals ↑ |
| **7m Penalty Frequency** | 15% | Daza 2017 | Buts "gratuits" ajoutés au total |
| **League Baseline** | 10% | Stats | CL: 62.7, Bundesliga: 60.4, Starligue: 59.1 |
| **H2H Total History** | 5% | Empirique | Patterns récurrents |

**Distribution**: CMP (sous-dispersée) — Poisson échoue pour handball (Karlis 2026)

**Lignes typiques**: 55.5 / 57.5 / 59.5 / 61.5 / 63.5

---

## 4. Handicap P1 en points (-1.5 à -8.5)

| Métrique | Poids | Source |
|----------|-------|--------|
| **Team Strength Differential** | 30% | Felice 2025 |
| **Goal Difference Model (Skellam)** | 25% | Karlis 2026 |
| **Home Advantage** | 15% | Pollard (+1.5-2.5 goals) |
| **Fast-break Differential** | 15% | Krawczyk 2025 |
| **Goalkeeper Save % Differential** | 10% | Daza 2017 |
| **Rest Days Advantage** | 5% | Empirique |

**Modèle**: Skellam(goal_diff) = Skellam(P1_goals) - Skellam(P2_goals)
- Half-goal lines (-4.5) → pas de push
- Whole-number lines (-4.0) → push si marge = ligne

---

## 5. Handicap P2 en points (+1.5 à +8.5)

Même modèle que Handicap P1, côté miroir. P2 +4.5 = P1 -4.5.

---

## 6. Total P1 en points match (27.5 / 28.5 / 29.5 / 30.5 / 31.5 / 32.5)

| Métrique | Poids | Source |
|----------|-------|--------|
| **P1 Shot Efficiency** | 30% | Krawczyk 2025 |
| **P1 Possessions/Game** | 25% | Broermann 2026 |
| **P2 Goalkeeper Save %** | 20% | Daza 2017 |
| **P1 7m Duty** | 15% | Daza 2017 |
| **P1 Pace Factor** | 10% | Empirique |

**Lignes typiques**:
- Équipe forte: 30.5 / 31.5 / 32.5
- Équipe faible: 24.5 / 25.5 / 26.5

---

## 7. Total P2 en points match

Même modèle que Total P1, adapté pour l'équipe extérieure.

---

## 8. Player Goals (Total buts par joueur — Over/Under 5.5)

| Métrique | Poids | Source |
|----------|-------|--------|
| **Player Shooting %** | 30% | Broermann 2026 (H-VAEP) |
| **Player Goals/Game Average** | 25% | Stats |
| **7m Penalty Duty** | 20% | Stats EHF 2026 (+2-4 tentatives/match) |
| **Minutes Played** | 10% | Empirique |
| **Opponent Defensive Fouling Rate** | 10% | Proxy 7m |
| **Shot Volume/Match** | 5% | Daza 2017 |

**Lignes typiques**: 4.5 / 5.5 / 6.5

**Référence**: Gidsel 68/95 (71.6%), Pytlick 64/90 (71.1%), Costa 61/94 (64.9%) — EHF EURO 2026

---

## 9. Comparaison Meilleur Buteur (Player vs Player)

| Métrique | Poids | Source |
|----------|-------|--------|
| **Goals/Game Differential** | 30% | Stats |
| **Shooting % Differential** | 25% | Broermann 2026 |
| **7m Duty Differential** | 20% | Stats (7m = +2-4 goals) |
| **Minutes Differential** | 15% | Empirique |
| **Opponent Defensive Rating** | 10% | Daza 2017 |

---

## Modèle Unifié — Architecture

```
┌─────────────────────────────────────────────────┐
│              Données Entrée                      │
│  Form store │ ELO │ Stats joueurs │ H2H │ Odds │
└──────┬──────┴──┬──┴───────┬───────┴──┬───┴──────┘
       │         │          │          │
       ▼         ▼          ▼          ▼
┌──────────────────────────────────────────────────┐
│         Scoring Engine (par bet type)            │
│                                                  │
│  1X2      → PPG + saves + fastBreak + 6m + H2H  │
│  DC       → PPG + saves + P(draw) + form         │
│  Total    → pace + efficiency + saves + 7m       │
│  Handicap → strengthDiff + Skellam + homeAdj     │
│  TeamTot  → shotEff + possessions + oppSave      │
│  Player   → shootPct + avg + 7mDuty + minutes    │
│  PvP      → goalsDiff + efficiencyDiff + 7mDiff  │
└──────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────┐
│         Value Detection                          │
│  P(model) > P(market) → EV+ → Signal            │
│  Edge = P(model) - P(implicit odds)              │
│  Kelly = edge / (odds - 1)                       │
└──────────────────────────────────────────────────┘
```

---

## Modèle Mathématique — CMP/Skellam

### Total Goals (CMP Distribution)

```
P(X = k) = (λ^k) / (k! × Z(λ, ν))
λ = expected goals, ν = dispersion parameter
- ν < 1 → sur-dispersé (Poisson-like)
- ν > 1 → sous-dispersé (handball!) 
- ν = 1 → Poisson standard

Handball: ν ≈ 1.3-1.5 (sous-dispersé)
→ Variance = λ/ν < λ (moins de variance que Poisson)
```

### Goal Difference (Skellam)

```
P(D = d) = Σ_k P(X₁ = k) × P(X₂ = k - d)
Zero-inflated: P(D = 0) += π (ajustement pour matchs nuls ~8%)
```

### Live (Bivariate Copula — Karlis 2026)

```
C(F₁(d₁), F₂(d₂)) = joint distribution
F₁ = 1st half goal difference CDF
F₂ = 2nd half goal difference CDF
→ P(final diff | HT diff) = conditional via copula
```

---

## Résumé — Métriques par Priorité

| Rang | Métrique | Bet Types impactés |
|------|----------|-------------------|
| 1 | **Team Strength (ELO/form)** | 1X2, DC, Handicap |
| 2 | **Goalkeeper Save %** | 1X2, Total, TeamTotal |
| 3 | **Shot Efficiency (6m)** | 1X2, Total, Handicap |
| 4 | **Fast-break Efficiency** | 1X2, Handicap, Total |
| 5 | **Pace/Possessions** | Total, TeamTotal |
| 6 | **7m Penalty Count** | Total, Player, PvP |
| 7 | **Player Shooting %** | Player, PvP |
| 8 | **Home Advantage (+1.5-2.5)** | 1X2, DC, Handicap |
| 9 | **H2H Record** | Tous (5%) |
| 10 | **Rest Days** | 1X2, DC (5-10%) |
