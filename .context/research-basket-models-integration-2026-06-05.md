# Cadrage — Modèles prédictifs Basket (web) → intégration PariScore

**Date** : 2026-06-05
**Évaluateur** : GM/CTO PariScore
**Demande** : "intègre tous les modèles prédictifs basket du web"
**Statut** : 🟡 **NOUVEAU VERTICAL — décision DG requise avant code** (pas une intégration, une construction)

---

## 0. État actuel PariScore

**Basket = ZÉRO infra.** Grep `basket|nba` → aucun `basketballService`, aucune route `/api/v1/nba`, aucun feed.
PariScore couvre : football + tennis + CS2. Le basket serait un **4e vertical from scratch** (data source + ingestion + math engine + UI + cron). C'est un **milestone multi-jours**, pas une tâche.

> ⚠️ "Intégrer tous les modèles" à l'aveugle = explosion de scope + import de stacks Python/TF (anti zero-dep) + modèles non calibrés (viole règle UQD). NO-GO en l'état. Cadrage d'abord.

---

## 1. Paysage des modèles basket (web)

### Repos ML (GitHub)
| Repo | Approche | ⚠️ Flag |
|---|---|---|
| `kyleskom/NBA-ML-Sports-Betting` | XGBoost + NN, ML + totals O/U | **cote bookmaker EN ENTRÉE** → circulaire, pas d'edge value |
| `NBA-Betting/NBA_AI` | Deep learning hiérarchique (~1.4M params) play-by-play | lourd, Python/TF, data PBP |
| `NBA-Betting/NBA_Betting` | AutoGluon, point spread | Python, ensemble auto |
| `ddayto21/NBA-Time-Series` | RF/LogReg/XGB/NN winners + totals | Python |
| `luke-lite`, `cmunch1`, `willseff`... | LogReg/XGB win prob + spread cover | Python |

### Académique / méthodes
| Méthode | Accuracy reportée | Source |
|---|---|---|
| **Elo rating** | **65.3%** (meilleur simple) | luke-lite / SportBotAI / 538 |
| Four Factors (Oliver : eFG%, TOV%, ORB%, FT rate) | 61-62% | PMC9251030, NBA modeling |
| Logistic regression | ~70% | reviews |
| Naive Bayes | ~67% | reviews |
| ANN / Deep Learning | jusqu'à 74.3% | arXiv 2111.09695 |
| FiveThirtyEight NBA | Elo + CARMELO/RAPTOR | 538 methodology |

---

## 2. Lecture GM (ce qui est intégrable vs piège)

| Axe | Verdict |
|---|---|
| **Circularité** | 🔴 La moitié des repos (kyleskom) utilisent la **cote en entrée** → pas d'edge value bet. À exclure. |
| **Stack** | 🔴 Tous Python/XGBoost/TF/AutoGluon → sidecar VPS coûteux, anti zero-dep. **Ne PAS importer les repos.** |
| **Calibration** | ⚠️ Accuracy reportée, mais quasi aucun Brier/ROI/devig. Viole "pas de prod sans IC". |
| **Réimplémentable JS-natif** | ✅ Elo + Four Factors + régression totals (Poisson/normale sur pace) = math pur, reproductible en JS natif comme le moteur foot/tennis/CS2. **C'est la voie PariScore.** |
| **538 method** | ✅ Référence Elo + margin-of-victory adjust + home-court — directement portable JS. |
| **Data source** | 🔴 **BLOQUEUR #1** : pas de feed basket. Options : ESPN public (skill `nba-data`, gratuit) OU BSD basketball addon ($ DG) OU API-Sports basketball. |

---

## 3. Architecture recommandée (SI GO)

**Ne pas importer les modèles Python.** Construire un `basketballService.js` JS-natif reproduisant les méthodes calibrables, comme les verticaux existants :

```
Phase 1 — Fondation (data + Elo)
  - Data source : ESPN nba-data (gratuit) → ingestion matchs/scores/box
  - basketballService.js : Elo basket (538-style : MOV-adjusted, home-court +100)
  - Route /api/v1/nba/matches + win prob Elo
  - Cible : 65% baseline (Elo), backtestable

Phase 2 — Edge math (Four Factors + Totals)
  - Four Factors (eFG/TOV/ORB/FT) → ajustement win prob
  - Totals O/U : modèle pace × efficiency (régression/Poisson points)
  - bayesianBlend basket (Elo + Four Factors + form) — MÊME pattern que foot
  - Calibration : reliability + Brier AVANT tout signal BET

Phase 3 — Value & UI
  - devig cotes (Shin-Hurley existant) → EV vs proba modèle
  - computeBetSignal (EV worst-case IC) réutilisé
  - UI onglet Basket (tableau + cockpit, réutilise composants)
```

**Réutilise l'existant** : `calibrateProbs`, `computeBetSignal`, `bayesianBlend`, devig, bootstrap UQD — déjà en prod côté foot/tennis. Le basket = nouveau `buildMatchRecord` + Elo basket, pas un nouveau moteur.

---

## 4. Recommandation GM — ❌ PAS d'intégration aveugle / 🟢 GO phasé conditionnel

1. **Ne pas importer les repos Python** (circulaires + anti-stack + non calibrés). Inéligibles.
2. **Construire JS-natif** : Elo 538-style + Four Factors + totals pace — méthodes prouvées (65%+), calibrables, zero-dep. C'est la voie cohérente PariScore.
3. **Bloqueur DG = data source** : ESPN gratuit (skill `nba-data` déjà dispo) vs BSD addon $ vs API-Sports. **Rien ne se code sans ce choix.**

**Effort** : Phase 1 (Elo + ESPN ingest + route) ~6-8h · Phase 2 (Four Factors + totals + blend + backtest) ~10-12h · Phase 3 (value + UI) ~10h. = **milestone ~3-4 jours**, pas une tâche.

---

## 5. Décisions bloquantes (DG)

1. **Data source** : ESPN public gratuit (nba-data) / BSD basket addon ($) / API-Sports basketball ?
2. **Scope** : NBA seule, ou + EuroLeague/NCAA ?
3. **Périmètre v1** : MVP (Elo + win prob + ESPN) puis itérer, ou vertical complet d'emblée ?
4. **Priorité** : basket vs backlog actuel (backtest Brier CS2 O/U, Stripe, ETL foot) ?

---

Attente : décisions DG (data source + scope + priorité) avant tout code. Sur GO Phase 1 → bd ticket + `basketballService.js` Elo + ingestion ESPN.

**Sources** : [kyleskom NBA-ML](https://github.com/kyleskom/NBA-Machine-Learning-Sports-Betting) · [NBA_AI](https://github.com/NBA-Betting/NBA_AI) · [luke-lite](https://github.com/luke-lite/NBA-Prediction-Modeling) · [538 NBA method](https://fivethirtyeight.com/methodology/how-our-nba-predictions-work/) · [arXiv 2111.09695](https://arxiv.org/pdf/2111.09695) · [Four Factors PMC9251030](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9251030/) · [CBA ML Nature](https://www.nature.com/articles/s41598-025-08882-7)
