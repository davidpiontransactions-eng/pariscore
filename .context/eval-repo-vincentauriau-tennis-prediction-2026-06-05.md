# Éval modèle externe — `VincentAuriau/Tennis-Prediction`

> Date : 2026-06-05 · Auteur : GM/CTO PariScore · Statut : **PENDING DG GO/NO-GO**
> Repo : https://github.com/VincentAuriau/Tennis-Prediction · Licence code : **MIT**

---

## 1. Quel modèle ?

**Framework d'expérimentation ML** (pas un modèle unique). Pipeline feature-engineering + plusieurs modèles interchangeables (signature scikit-learn).

### Modèles fournis
- **RandomForestClassifier** (exemple : 2000 arbres, profondeur illimitée)
- **SimpleFullyConnected** (Keras/TF) : Dense `(4, 8, 4)` relu → softmax, loss `cross_entropy`, optim `adamax` lr=1e-5, 50 epochs + 10 reduced-LR, StandardScaler
- **ConvolutionalHistoryAndFullyConnected** (Keras/TF) : double input — séquence historique via `Conv1D(8,k=3)→Conv1D(4)→Conv1D(1)→Flatten`, concat avec features courantes → Dense. = modèle de **forme temporelle** (suite des derniers matchs)
- `PCAMatchEncoder` (encodage match)

### Features (target = vainqueur binaire)
Rankings + points, **win% par surface** (clay/grass/hard/carpet), **stats service** (aces %, double fautes %, 1er service gagné %), break points, H2H, niveau tournoi, surface. Stats calculables career OU at-match-time.

### ⚠️ Cote bookmaker
**NON utilisée.** Stats joueurs only → **pas circulaire** (✅ bon point, comme crystal-ball).

### Données
- **Jeff Sackmann ATP** (submodule). Format CSV. ⚠️ Sackmann = **en purge PariScore** (bd `8uoc`/`dl49`, data NC).

### Métriques
- Accuracy vs baseline "best-ranked-player-wins". Graph "precision depending of player ranks".
- ❌ **Aucun Brier, ROI, calibration.**

### Stack
- 100% Python (scikit-learn + TF/Keras).

---

## 2. Avantages vs PariScore ?

### Verdict : **NO-GO incorporation.** Redondant + stack + data bloqués.

| Critère | Constat |
|---|---|
| **Licence** | ✅ Code MIT (réutilisable). Mais data submodule = Sackmann NC. |
| **Edge marché** | ⚠️ Prédit le vainqueur, **ne raisonne pas value vs cote**. Pas circulaire (✅) mais pas d'angle value-bet non plus. Juste classif winner. |
| **Calibration/UQD** | ❌ Aucun Brier/IC/reliability. Viole règle UQD. Non shippable tel quel. |
| **Redondance** | ❌ FORTE. PariScore a déjà : Elo surface-specific (`tennis_elo`), serve stats (SPW/RPW), H2H, recent-form, Klaassen-Magnus, bootstrap UQD. Ce repo recompose les mêmes ingrédients en moins calibré. |
| **Features inédites** | ❌ Rien. Rankings/surface-win%/serve-stats/H2H = tous déjà dans le pipeline tennis. |
| **Idée marginale** | ⚠️ `Conv1D` sur **séquence historique** des matchs (forme temporelle apprise) = approche un peu différente de notre Elo-decay/momentum. Mais gain non prouvé (pas de métrique) + nécessite TF. |
| **Stack** | ❌ Python/TF/scikit = sidecar VPS vs Node zero-dep. Coût ops > gain. |
| **Données** | ❌ Sackmann, déjà en purge légale + stale. |
| **Leçon passée** | RandomForest sur rank/surface/serve = exactement ce que les backtests age/hand ont montré NO-GO (edge absorbé par Elo). |

---

## 3. Recommandation GM

**NO-GO** (3 raisons) :
1. **Redondance** — recompose Elo-surface + serve-stats + H2H que PariScore a déjà, en moins calibré (zéro Brier/UQD).
2. **Stack + data** — Python/TF incompatible Node zero-dep ; data Sackmann NC en purge.
3. **Pas d'edge value-bet** — classif winner pure, ne compare pas à la cote. N'ajoute pas d'Edge mathématique.

**Aucun GO-partiel justifié.** Contrairement à crystal-ball (qui exposait l'idée surface-Elo, déjà shippée), ici rien de net-new exploitable.

**Seule note conceptuelle archivée** : `Conv1D` sur séquence des N derniers matchs comme encodeur de forme — à garder en tête SI un jour on fait un modèle séquence-forme natif. Code MIT = lisible comme référence. Effort non justifié maintenant.

---

## Annexe — sources vérifiées
- Repo : https://github.com/VincentAuriau/Tennis-Prediction
- README : https://github.com/VincentAuriau/Tennis-Prediction/blob/master/README.md
- deep_model.py : https://github.com/VincentAuriau/Tennis-Prediction/blob/master/python/model/deep_model.py
- Licence : MIT (code) · Data : Sackmann ATP submodule
- Modèles : RandomForest(2000) + Keras SimpleFC(4,8,4) + Conv1D-history + PCAMatchEncoder
- Pas de cote en entrée · Pas de Brier/ROI/calibration publiés

---

**Attente : ton GO/NO-GO.** (reco = NO-GO, rien à implémenter)
