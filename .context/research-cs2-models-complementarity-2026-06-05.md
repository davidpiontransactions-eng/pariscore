# Recherche — Modèles prédictifs CS2 (web) vs PariScore · Complémentarité

**Date** : 2026-06-05
**Évaluateur** : GM/CTO PariScore
**Méthode** : sweep web multi-angle (ML match/round, rating systems, economy, demo-trajectory, veto, commercial)

---

## 0. Ce que PariScore intègre DÉJÀ (CS2)

| Brique | Locus |
|---|---|
| ELO + ML win prob | BSD (`cs2Service`) |
| Map winrates + rankings | HLTV (gigobyte/HLTV) + `computeBSDMapRankings` |
| Player Rating/ADR/KAST/H2H | csapi.de (`buildMatchEnrichment`) |
| Pistol index | `computePistolIndex` |
| Roster strength | `computeRosterStrength` |
| Map pool entropy | `computeMapPoolEntropy` |
| Map over model | `computeMapOverModel` |
| Live momentum (kill-based) | `computeLiveMomentum` (ring buffer) |
| AI Scout LLM (UI-only) | `/api/v1/ai/cs2-analyze` |
| **Avg rounds/map (over/under)** | bo3.gg `/api/v1/cs2/map-rounds` (livré ce jour) |

---

## 1. Inventaire des modèles CS2 trouvés sur le web

### A. Pré-match — vainqueur de match
| Modèle | Source | Perf reportée |
|---|---|---|
| LLM agents (chain-of-thought) | cieslak | ~64% (≈ favori, **no edge**) |
| **Rating Elo / Glicko-2 / TrueSkill** | arXiv 2410.02831 "Skill Issues" | Glicko-2 **63.1%** > Elo 62.8% ; TrueSkillPlayers (per-player) **64.1%** |
| Tabular ML match | jordyvanvorselen/machine-learning | — |
| **Markov map-veto prediction** | Kaggle (mateusdmachado) | prédit la map jouée |

### B. Live / in-round — win probability
| Modèle | Source | Note |
|---|---|---|
| **Economy round model** | arXiv 2109.12990 "Optimal Team Economic Decisions" ; PandaScore round modeling ; Markov Binomial | "l'économie = **le meilleur feature** pour prédire le round à venir" |
| Round-winner tabular ML | Kaggle CSGO dataset (whiz-coder, anantoj, YashSharma07) | logistic/RF/XGBoost/NN sur economy+bomb+kills |
| Demo-trajectory LSTM | awpy + ESTA (arXiv 2209.09861, pnxenopoulos) | win prob positionnelle, post-démo |

### C. Commercial (data/odds)
| Fournisseur | Note |
|---|---|
| PandaScore | odds + prediction data, payant |
| GRID | data server-level officielle (Riot/KRAFTON), entreprise |
| Bayes esports / winio.ai | live odds/forecasts |

---

## 2. Complémentarité vs PariScore

| Modèle | Complémentaire ? | Verdict | Raison |
|---|---|---|---|
| LLM agents | ❌ | NO-GO (fait) | Pas d'edge, déjà en AI Scout UI-only |
| **Glicko-2 / TrueSkill** | 🟡 partiel | Marginal | Rating ≈ redondant avec BSD Elo (+0.3pp = edge absorbé, leçon age/hand). **MAIS** le **RD (rating deviation = incertitude)** de Glicko-2 est un INPUT UQD/confiance qu'on n'a pas. |
| TrueSkillPlayers (per-player) | 🟡 | Lourd | Seul à >64%, mais exige granularité par joueur + refit. Effort vs gain faible. |
| **Economy live round model** | 🟢 OUI | **GAP RÉEL** | Notre live = momentum **kill-based** uniquement. L'économie (equipment value, money, buy/eco/force) = meilleur prédicteur du round selon la recherche. **On ne l'a pas.** Bloqueur = feed économie live. |
| Round-winner tabular ML (Kaggle) | 🟡 | Redondant-ish | In-round, même besoin de state live que l'economy model. |
| **Markov map-veto predictor** | 🟢 OUI | **Léger + backtestable** | On a map_pool_entropy + winrates mais on ne **prédit pas la séquence de veto** → quelle map sera jouée. Markov sur historique veto → sharpening direct de notre **over/under rounds (bo3)** + map ML. Zero-dep. |
| Demo-trajectory LSTM (awpy/ESTA) | ❌ | NO-GO stack | Python lourd, démos post-match, pas temps réel, anti zero-dep. |
| PandaScore/GRID/Bayes | ❌ | NO-GO budget | Sources payantes entreprise, redondantes BSD. (PandaScore odds = ancrage devig possible, mais coût — cf. piste Pinnacle/OddsPapi déjà notée.) |

---

## 3. Recommandation GM — 3 pistes complémentaires réelles

**🟢 GO-partiel #1 — Markov map-veto predictor** (priorité)
- Prédit la map jouée à partir des tendances pick/ban historiques (données HLTV/bo3 déjà en stock).
- **Pair parfait** avec le dataset bo3 rounds livré ce jour : map prédite → avg rounds de CETTE map → signal Over/Under affûté.
- Zero-dep (Markov = compteurs de transitions), backtestable. **Effort ~3-4h.**

**🟢 GO-conditionnel #2 — Economy live round model**
- Comble le seul vrai gap : live round-by-round économie (vs notre momentum kill-only).
- **Bloqueur data** : exige un feed économie live (equipment value/money par round). À vérifier si BSD livedata l'expose. Si oui → Markov/logistic economy → win prob round live = vrai edge trading in-play. **Effort 5-8h + audit feed.**

**🟡 GO-marginal #3 — Glicko-2 RD comme input UQD**
- PAS le rating (redondant Elo). Juste le **RD (incertitude)** → alimente `confidence_badge` / reliability. Cohérent avec la culture UQD PariScore.
- **Effort 2-3h.** Gain faible mais aligné philosophie "pas de prod sans IC".

**❌ NO-GO** : LLM (fait), demo-LSTM (stack), TrueSkillPlayers (lourd/marginal), commercial APIs (budget).

---

## 4. Verdict

Les modèles CS2 du web se rangent en 3 familles. **2 sont vraiment complémentaires** à PariScore :
1. **Veto Markov** (sharpening over/under, léger) — meilleur ROI immédiat, pair avec bo3 rounds.
2. **Economy live round model** (comble le gap momentum kill-only) — plus d'edge in-play mais bloqueur feed.

Tout le reste = soit redondant (Elo/rating, round tabular), soit hors-stack (demo-LSTM), soit hors-budget (commercial). Cohérent avec les leçons : l'edge n'est pas dans "qui gagne le match" (absorbé par Elo/cote) mais dans le **granulaire backtestable** (rounds/map, économie round, veto).

**Sources** : [arXiv 2410.02831](https://arxiv.org/abs/2410.02831) · [arXiv 2109.12990](https://arxiv.org/pdf/2109.12990) · [ESTA arXiv 2209.09861](https://arxiv.org/pdf/2209.09861) · [awpy](https://github.com/pnxenopoulos/awpy) · [Kaggle veto Markov](https://www.kaggle.com/code/mateusdmachado/predicting-csgo-map-veto-with-markov-chains) · [PandaScore](https://www.pandascore.co/) · [GRID](https://grid.gg/live-esports-data/) · [cieslak benchmark](https://cieslak.dev/en/blog/2025-07-17-cs2-ai-benchmark/)

---

Attente : ton GO — (a) Markov veto predictor (léger, pair bo3 rounds), (b) audit feed économie BSD pour economy round model, (c) les deux.
