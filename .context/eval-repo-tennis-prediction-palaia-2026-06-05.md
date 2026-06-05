# Éval modèle externe — `lorenzopalaia/Tennis-Prediction`

> Date : 2026-06-05 · Auteur : GM/CTO PariScore · Statut : **PENDING DG GO/NO-GO**
> Repo : https://github.com/lorenzopalaia/Tennis-Prediction · Licence : **MIT** (réutilisable)

---

## 1. Quel modèle utilise-t-il ?

**Réseau de neurones feed-forward (Keras/TensorFlow), classification binaire** — prédit le vainqueur (Player_1 gagne = 1).

### Architecture (best_model.h5)
```python
Dense(32, input_dim=18, activation='relu')
Dense(32, activation='relu')
Dense(1,  activation='sigmoid')
loss='binary_crossentropy', optimizer=Adam(lr=0.001)
epochs=50, batch_size=32
```

### Features (18)
`Tournament, Date, Series, Court, Surface, Round, Best of, Player_1, Player_2, Rank_1, Rank_2, Pts_1, Pts_2, Odd_1, Odd_2, Rank_Diff, Pts_Diff, Odds_Diff`

- Numériques scalés via `StandardScaler`.
- **⚠️ `Odd_1`, `Odd_2`, `Odds_Diff` = cotes bookmaker EN ENTRÉE.** Driver dominant.

### Données
- 63 751 matchs. Format = **tennis-data.co.uk** (colonnes Series/Court/Surface/Round/Rank/Pts/Odd classiques ATP).
- Split 80/20, `random_state=42`.

### Performance reportée
- **Test accuracy 69.02 %** · F1 0.69 · Precision 0.70 · Recall 0.68. Pas de Brier, pas de calibration, pas de ROI.

---

## 2. Avantages d'incorporer ce modèle sur PariScore ?

### Verdict synthèse : **faible valeur ajoutée. Probable NO-GO.**

| Critère | Constat |
|---|---|
| **Accuracy 69 %** | = niveau "suivre le favori bookmaker". Avec `Odds_Diff` en feature, le NN apprend surtout à recopier le marché. Pas d'edge vs cote. |
| **Edge marché** | ❌ Aucun. Le modèle CONSOMME la cote, ne la bat pas. PariScore cherche l'inverse : prob calibrée → comparer à cote → ValueBet. Modèle circulaire ici. |
| **Calibration** | ❌ Pas d'IC, pas de Brier, pas de reliability diagram. Viole règle UQD (`CLAUDE.md` : aucun modèle en prod sans IC). |
| **Redondance** | ⚠️ PariScore a déjà : Elo dynamique + Klaassen-Magnus SPW/RPW closed-form (Brier ~0.21) + bayesianBlend + bootstrap UQD tennis. Le NN ferait moins bien et sans explicabilité. |
| **Features nouvelles** | ❌ Rien d'inédit. Rank/Pts/Surface/Odds déjà tous dans le pipeline. Pas de point-level, pas de momentum, pas de fatigue. |
| **Stack** | ❌ Python/TF/Keras = dép lourde. PariScore = Node zero-dep (sauf better-sqlite3). Sidecar Python à héberger sur VPS. Coût ops > gain. |
| **Leçon session passée** | Backtests age/hand features = NO-GO (edge absorbé par Elo). Ce NN ajoute des features encore plus faibles. Même conclusion attendue. |

### Le seul apport potentiel (marginal)
- **Dataset tennis-data.co.uk** lui-même (63k matchs avec cotes historiques B365/Pinnacle par match) — utile pour **backtest/calibration**, PAS pour le modèle. Mais source déjà couverte (Sackmann purge, Elo interne BSD/ESPN, bd `dl49`).
- Architecture confirme par négative que **notre approche Elo+closed-form est supérieure** : un NN qui mange les cotes plafonne à 69 % sans edge.

---

## 3. Recommandation GM

**NO-GO implémentation directe.** Justification :
1. Modèle circulaire (cote en entrée → pas d'edge value bet).
2. Redondant avec Elo + Klaassen-Magnus déjà en prod, sans la calibration UQD requise.
3. Dép Python/TF contre architecture zero-dep.

**Alternative si DG veut capitaliser** (LOW effort, optionnel) :
- Ingérer le **CSV tennis-data.co.uk** (cotes B365/PS historiques par match, MIT-compatible) comme source de **backtest calibration** pour valider notre Brier vs cotes réelles. ~2h. Ticket bd dédié.

**Attente : ton GO/NO-GO.**
- GO → j'ouvre bd ticket + intègre (préciser : modèle complet OU juste dataset backtest).
- NO-GO → archive ce rapport, ferme le sujet.

---

## Annexe — chiffres bruts vérifiés
- Test accuracy : `69.02`
- Dataset : `63,751` records, `matches.csv` + `matches_final.csv`
- Fichiers : `training.ipynb`, `best_model.h5`, README MIT
- Langage : Jupyter Notebook 100 %
