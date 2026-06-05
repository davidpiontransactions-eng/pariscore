# Éval modèle externe — `hikmatazimzade/tennis-ai`

> Date : 2026-06-05 · Auteur : GM/CTO PariScore · Statut : **PENDING DG GO/NO-GO**
> Repo : https://github.com/hikmatazimzade/tennis-ai · Licence : **MIT (code)**

---

## 1. Quel modèle ?

**3 modèles ensemble : CatBoost (défaut) / XGBoost / Random Forest.** Classif binaire vainqueur ATP + web UI (FastAPI + SvelteKit).

### Features (137) / target
- Joueur : entry type, **hand**, attributs
- Contexte : niveau tournoi, surface, date, draw size
- Perf : aces, double fautes, service stats
- Historique : **H2H**, **recent form fenêtres 5/10/20/50 matchs**
- Ranking + **Elo + Elo surface-specific**
- Features différentielles adversaire
- Target = vainqueur (binaire).

### Métriques
| Modèle | Acc | ROC-AUC | Log-loss |
|---|---|---|---|
| CatBoost | 67.21% | 0.73 | 0.60 |
| XGBoost | 66.70% | 0.73 | 0.61 |
| RF | 65.70% | 0.72 | 0.62 |

- ⚠️ Log-loss publié (bien) mais **pas de Brier/reliability/IC**. AUC 0.73 < buildoak 0.76.

### Cote bookmaker
**NON utilisée.** Pas de betting strategy. → non circulaire ✅ mais pas d'angle value-bet.

### Données
- ATP through 2024 (saison complète), Git LFS. Source non nommée mais colonnes (aces/DF/serve/H2H) = **format Sackmann ATP** → ⚠️ NC probable, en purge PariScore.

### Stack
- Python 3.11, CatBoost/XGBoost/sklearn, FastAPI, `uv` · SvelteKit · Docker Compose.

---

## 2. Avantages vs PariScore ?

### Verdict : **NO-GO.** Clone CatBoost plus faible que buildoak, zéro idée neuve.

| Critère | Constat |
|---|---|
| **Licence** | ✅ Code MIT. Mais data LFS = Sackmann probable (NC). |
| **Edge marché** | ⚠️ Pas circulaire ✅ mais pas de value-bet. Classif winner only. |
| **Calibration/UQD** | ⚠️ Log-loss only, pas de Brier/reliability/IC. Insuffisant règle UQD. |
| **Redondance** | ❌ TOTALE. Elo + surface Elo + serve stats + H2H + recent form = **déjà tout en prod**. `CATBOOST_ENABLED` flag déjà dans notre `.env`. |
| **Features inédites** | ❌ Aucune. 137 features = même famille rank/surface/serve/form/hand. Hand = déjà testé NO-GO (backtest interne, edge nul). |
| **vs buildoak** | ❌ Inférieur : AUC 0.73 < 0.76, et **pas** de serve/return Elo Bayesian (le seul vrai gap, déjà capté via buildoak → bd `dl49`). |
| **Stack** | ❌ Python/FastAPI/Svelte/Docker vs Node zero-dep. |
| **Données** | ❌ Sackmann probable, NC + stale 2024. |
| **Leçon passée** | ✅ Confirme age/hand NO-GO + features ML absorbées par Elo. |

---

## 3. Recommandation GM

**NO-GO** (3 raisons) :
1. **Redondance totale** — Elo/surface/serve/H2H/form tous déjà en prod ; CatBoost déjà flaggé chez nous. Rien net-new.
2. **Inférieur à buildoak** — AUC 0.73 < 0.76, et sans l'unique idée intéressante (serve/return Elo Bayesian) déjà routée vers bd `dl49`. Ce repo n'apporte rien que buildoak n'ait fait mieux.
3. **Stack + data** — Python/FastAPI/Docker incompatible Node zero-dep ; data Sackmann LFS (NC probable, stale).

**Aucun GO-partiel.** Le seul gap tennis (serve/return Elo) est déjà identifié + validé + tracké (`dl49`). Ce repo est un archétype CatBoost générique sans contribution.

---

## Annexe — sources vérifiées
- Repo : https://github.com/hikmatazimzade/tennis-ai
- Modèles : CatBoost 67.21%/0.73/0.60 · XGBoost · RF · 137 features
- Elo + surface Elo + serve stats + H2H + form 5/10/20/50 + hand
- Data : ATP through 2024 (Git LFS, format Sackmann) · pas de cote · log-loss only
- Licence : MIT code · Stack Python/FastAPI/CatBoost + SvelteKit + Docker

---

**Attente : ton GO/NO-GO.** (reco = NO-GO — redondant + inférieur à buildoak déjà tracké dl49)
