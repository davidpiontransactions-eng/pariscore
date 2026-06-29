# VERDICT — Session 3 : Atelier Feature Engineering

**Date :** 18 Juin 2026
**Participants :** Data Scientist + Parieur Pro + CEO
**Statut :** ✅ Session terminée — Périmètre Sprint 1 GELÉ

---

## 1. Les 6 Arbitrages

| # | Métrique | Décision | Modalités | Gardien |
|---|----------|----------|-----------|---------|
| 1 | **ATP_POINTS** | ✅ GARDER | Tronqué sur 6 mois glissants | DS |
| 2 | **BP_CONV** | ✅ GARDER | EWMA long α=0.05, UNIQUEMENT dans CLUTCH_FACTOR | Parieur |
| 3 | **BP_SAVED** | ✅ GARDER | UNIQUEMENT dans CLUTCH_FACTOR (avec BP_CONV) | Parieur |
| 4 | **WINNING_DERIV** | ✅ GARDER | 3 garde-fous : lag=1, fenêtre fixe 10, corr weekly check | Parieur (gardien) |
| 5 | **SERVE_DECAY** | ✅ GARDER | Conditionnelle : `if age > 32` | DS |
| 6 | **MOMENTUM (revisit)** | ❌ REJETÉ | MOMENTUM_ELITE en backlog V2 | — |

---

## 2. Les 3 Métriques Composées — Validées

| Composée | Formule | Statut |
|----------|---------|--------|
| SERVE_EDGE | (SRV_PTS_WON_S − RET_PTS_WON_OPP_S) × SURFACE_WEIGHT | ✅ Validée |
| CLUTCH_FACTOR | (BP_CONV_S × BP_SAVED_S × TB_WINRATE_S)^(1/3) | ✅ Validée |
| H2H_CONTEXT_SCORE | 0.40×H2H_SURFACE + 0.30×H2H_TEMPOREL + 0.20×H2H_BASE + 0.10×H2H_CONTEXT | ✅ Validée |

---

## 3. Périmètre Sprint 1 — GELÉ

### Features à coder (10 métriques)

```
🏆 NOYAU DUR (7 features)
├── SRV_PTS_WON_S        → EWMA α=0.18, fenêtre 5 matchs
├── RET_PTS_WON_S        → EWMA α=0.18, fenêtre 5 matchs
├── H2H_CONTEXT_SCORE    → Composée (4 sous-composants pondérés)
├── AGE.30               → |age − 30|, gratuit, 1 ligne
├── ATP_POINTS_6M        → Points ATP sur 6 mois glissants
├── SERVE_EDGE           → SRV différentiel × SURFACE_WEIGHT
└── CLUTCH_FACTOR        → (BP_CONV × BP_SAVED × TB_WINRATE)^(1/3)

🔍 ANGLES MORTS (3 facteurs)
├── MOTIVATION           → Dernière perf + statut tournoi + jours depuis
├── FATIGUE              → Distance géographique dernier tournoi + jours de repos
└── PUBLIC               → Nationalité joueur ≠ pays du tournoi (booléen)
```

### Métriques composées dérivées

```
Pour chaque métrique EWMA, générer automatiquement :
  - EWMA court terme (α=0.18, fenêtre 5)  → réactivité
  - EWMA long terme   (α=0.05, fenêtre 20) → stabilité
  - Différentiel (court − long)            → momentum individuel
  - Puis différentiel JoueurA − JoueurB    → matchup
```

### Total features estimé pour Sprint 1

```
7 features noyau × (2 échelles EWMA + différentiel + matchup) = 28 features brutes
  + 2 composées (SERVE_EDGE, CLUTCH_FACTOR)
  + 3 angles morts
  + 1 H2H_CONTEXT_SCORE
  = ~34 features total
```

---

## 4. Ce qui est REPORTÉ (Sprint 2+)

| Feature | Raison du report | Sprint cible |
|---------|------------------|--------------|
| PRESSURE_INDEX | Scraping nécessaire (TennisViz) | Sprint 2 |
| WINNING_DERIV | POC de validation avant intégration | Sprint 2 |
| BLESSURES | Scraping NLP complexe | Sprint 2 |
| CLIMAT | API OpenWeather à intégrer | Sprint 2 |
| MOMENTUM_ELITE | À définir précisément | Backlog V2 |
| CHANGEMENT ENTRAÎNEUR | Scraping + NLP | Sprint 3 |

---

## 5. Prochaines étapes

```
H+0    → Ce verdict est la référence pour l'engineering
H+24h  → Mise à jour de Pariscore_Implementation_Plan.md avec le périmètre exact
H+48h  → Décision : Session 4 (Stratégies) ou GO direct engineering ?
H+72h  → Premier commit du pipeline de données
```

---

*Document produit par l'Expert Documentaire — Pariscore*
*Session 3 — Atelier Feature Engineering — Juin 2026*
