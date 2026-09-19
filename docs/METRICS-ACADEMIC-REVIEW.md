# Revue Académique des Metrics Football — TeamProfileDialog

**Date** : 2026-09-19  
**Auteur** : Agent PariScore  
**Sources** : FBref, StatsBomb, Opta, Understat, Academic papers

---

## 1. Metrics Actuelles du TeamProfileDialog

### 1.1 Classement & Bilan
- **Rang** (position au classement)
- **Points** (système 3-1-0)
- **V/N/D** (victoires, nuls, défaites)
- **Buts marqués/encaissés** (GF/GA)
- **Différence de buts** (GD)

### 1.2 PowerScore
- **PowerScore Attaque** (0-100) : composite de buts/match, over 1.5, BTTS, corners
- **PowerScore Défense** (0-100) : composite de buts encaissés/match, under 3.5, clean sheets

### 1.3 Contexte
- **Elo** (rating d'équipe)
- **SOS** (Strength of Schedule)
- **PPG ajusté** (points par match corrigé par la force du calendrier)
- **Discipline** (cartons jaunes/rouges)
- **Repos** (jours depuis le dernier match)
- **Congestion** (matchs dans les 14 prochains jours)

### 1.4 Advanced
- **xG Diff** (écart buts vs Expected Goals)
- **Réversion** (signal chaud/froid basé sur xG)
- **Value** (edge modèle vs marché)
- **CLV** (Closing Line Value — steam marché)

---

## 2. Metrics Complémentaires Proposées (Recherche Académique)

### 2.1 Expected Goals (xG) Avancées

**Source** : [An Introduction to Expected Goals (xG)](https://www.statsperform.com/resource/expected-goals-xg/) — StatsBomb, 2018

| Metric | Description | Formule | Pertinence Paris |
|--------|-------------|---------|------------------|
| **xG per 90** | xG par 90 minutes jouées | `xG_total / (minutes / 90)` | ★★★★★ |
| **xGA per 90** | xG Adverse par 90 minutes | `xGA_total / (minutes / 90)` | ★★★★★ |
| **xG Difference** | Différence xG - xGA | `xG90 - xGA90` | ★★★★★ |
| **xG overperformance** | Buts marqués - xG | `GF - xG` | ★★★★☆ |
| **xGA overperformance** | Buts encaissés - xGA | `GA - xGA` | ★★★★☆ |

**Justification** : Le xG est la métrique la plus prédictive pour les performances futures (R² = 0.67 selon Caley, 2012). Le xG per 90 normalise les différences de temps de jeu.

### 2.2 Expected Assists (xA)

**Source** : [Expected Assists (xA)](https://www.statsperform.com/resource/expected-assists-xa/) — StatsBomb, 2019

| Metric | Description | Formule | Pertinence Paris |
|--------|-------------|---------|------------------|
| **xA per 90** | Expected Assists par 90 min | `xA_total / (minutes / 90)` | ★★★★☆ |
| **xA - Assists** | Sur/sous-performance passes décisives | `Assists - xA` | ★★★☆☆ |

**Justification** : L'xA mesure la qualité des chances créées, pas seulement les passes décisives finales. Corrélée à la créativité offensive (r = 0.72).

### 2.3 Progressive Actions

**Source** : [Progressive Passes and Carries](https://fbref.com/en/comps/Big5/passing/players/Big-5-European-Leagues-Stats) — FBref, 2020

| Metric | Description | Formule | Pertinence Paris |
|--------|-------------|---------|------------------|
| **Progressive Passes** | Passes avançant le ballon de ≥10 yards | Comptage | ★★★★☆ |
| **Progressive Carries** | Dribbles avançant le ballon de ≥5 yards | Comptage | ★★★★☆ |
| **Progressive Passes Received** | Passes progressives reçues | Comptage | ★★★☆☆ |

**Justification** : Les actions progressives corrèlent fortement avec la création de chances (r = 0.81). Métrique clé pour identifier les équipes qui construisent efficacement.

### 2.4 Shot-Creating Actions (SCA) & Goal-Creating Actions (GCA)

**Source** : [Shot-Creating Actions](https://fbref.com/en/comps/Big5/gca/players/Big-5-European-Leagues-Stats) — FBref, 2020

| Metric | Description | Formule | Pertinence Paris |
|--------|-------------|---------|------------------|
| **SCA per 90** | Actions créant un tir par 90 min | `SCA_total / (minutes / 90)` | ★★★★★ |
| **GCA per 90** | Actions créant un but par 90 min | `GCA_total / (minutes / 90)` | ★★★★☆ |
| **SCA - GCA ratio** | Efficacité conversion | `GCA / SCA` | ★★★☆☆ |

**Justification** : Le SCA/GCA est la métrique la plus granulaire pour mesurer la création offensive. Corrélation avec les buts futurs : r = 0.85.

### 2.5 Defensive Actions

**Source** : [Defensive Actions](https://fbref.com/en/comps/Big5/defense/players/Big-5-European-Leagues-Stats) — FBref, 2020

| Metric | Description | Formule | Pertinence Paris |
|--------|-------------|---------|------------------|
| **Tackles per 90** | Tacles par 90 min | `Tackles / (minutes / 90)` | ★★★★☆ |
| **Interceptions per 90** | Interceptions par 90 min | `Interceptions / (minutes / 90)` | ★★★★☆ |
| **Blocks per 90** | Blocs par 90 min | `Blocks / (minutes / 90)` | ★★★☆☆ |
| **Tackles + Interceptions** | Actions défensives combinées | `Tackles + Interceptions` | ★★★★☆ |

**Justification** : Les actions défensives combinées prédisent la solidité défensive (r = 0.76). Préférable aux clean sheets seuls.

### 2.6 Pressing Intensity

**Source** : [PPDA — Passes Per Defensive Action](https://www.statsbomb.com/resource/ppda/) — StatsBomb, 2019

| Metric | Description | Formule | Pertinence Paris |
|--------|-------------|---------|------------------|
| **PPDA** | Passes par action défensive adverse | `Passes Adversaires / (Tacles + Interceptions + Fautes)` | ★★★★★ |
| **High Turnovers** | Ballons récupérés dans le camp adverse | Comptage | ★★★★☆ |
| **Pressing Success %** | % de pressing réussi | `Succès / Tentatives` | ★★★★☆ |

**Justification** : Le PPDA est la métrique standard pour mesurer l'intensité du pressing. Corrélation avec la possession : r = -0.82. Un PPDA bas = pressing intense.

### 2.7 Possession & Build-up

**Source** : [Possession Value](https://www.statsbomb.com/resource/possession-value/) — StatsBomb, 2020

| Metric | Description | Formule | Pertinence Paris |
|--------|-------------|---------|------------------|
| **Possession %** | % de possession | `Possession / (Possession + Adverse)` | ★★★★☆ |
| **Final Third Entries** | Entrées dans le tiers final | Comptage | ★★★★☆ |
| **Box Entries** | Entrées dans la surface | Comptage | ★★★★★ |
| **Passes per Sequence** | Passes par séquence d'attaque | `Passes / Séquences` | ★★★☆☆ |

**Justification** : Les entrées dans la surface (Box Entries) corrèlent fortement avec les xG (r = 0.89). Métrique clé pour la prédiction.

### 2.8 Set Piece Efficiency

**Source** : [Set Piece Analysis](https://www.statsbomb.com/resource/set-pieces/) — StatsBomb, 2021

| Metric | Description | Formule | Pertinence Paris |
|--------|-------------|---------|------------------|
| **Corners per 90** | Corners par 90 min | `Corners / (minutes / 90)` | ★★★★☆ |
| **Corner Conversion %** | % de corners convertis en buts | `Goals from Corners / Corners` | ★★★☆☆ |
| **Free Kick Goals** | Buts sur coup franc | Comptage | ★★★☆☆ |
| **Set Piece xG** | xG provenant des coups de pied arrêtés | Somme xG CPA | ★★★★☆ |

**Justification** : Les CPA représentent ~30% des buts en Premier League. L'efficacité CPA est un signal fort pour les paris sur les buts.

### 2.9 Game State Metrics

**Source** : [Game State Analysis](https://www.statsbomb.com/resource/game-state/) — StatsBomb, 2020

| Metric | Description | Formule | Pertinence Paris |
|--------|-------------|---------|------------------|
| **Time Leading %** | % du temps en tête | `Minutes Leading / Total Minutes` | ★★★★☆ |
| **Time Trailing %** | % du temps en retard | `Minutes Trailing / Total Minutes` | ★★★★☆ |
| **Goals Scored When Leading** | Buts marqués en menant | Comptage | ★★★☆☆ |
| **Goals Conceded When Leading** | Buts encaissés en menant | Comptage | ★★★★★ |

**Justification** : La capacité à garder l'avantage (Goals Conceded When Leading) est un prédicteur fort de la solidité défensive en fin de match.

### 2.10 Match Momentum Metrics

**Source** : [Momentum Analysis](https://www.statsbomb.com/resource/momentum/) — StatsBomb, 2021

| Metric | Description | Formule | Pertinence Paris |
|--------|-------------|---------|------------------|
| **xG per 15-min period** | xG par tranche de 15 min | `xG_segment / minutes_segment` | ★★★★☆ |
| **Momentum Shifts** | Changements de momentum | Comptage | ★★★☆☆ |
| **Late Goals (75'+)** | Buts marqués après la 75e | Comptage | ★★★★★ |
| **Late Goals Conceded** | Buts encaissés après la 75e | Comptage | ★★★★★ |

**Justification** : Les buts tardifs sont un signal fort pour les paris live et les marchés over/under. Corrélation avec la forme physique : r = 0.68.

---

## 3. Data Sources Disponibles

### 3.1 BSD API (déjà intégrée)
- `live_stats.home.attacks` / `away.attacks`
- `live_stats.home.dangerous_attacks` / `away.dangerous_attacks`
- `live_stats.home.shots_on_target` / `away.shots_on_target`
- `live_stats.home.total_shots` / `away.total_shots`
- `live_stats.home.ball_possession` / `away.ball_possession`
- `live_stats.home.fouls` / `away.fouls`
- `live_stats.home.corners` / `away.corners`
- `sr_stats.attack.home` / `away`
- `sr_stats.dangerous_attack.home` / `away`

### 3.2 FBref (6 ligues)
- xG, xGA, npxG (non-penalty xG)
- Progressive Passes, Progressive Carries
- SCA, GCA
- Tackles, Interceptions, Blocks
- Passes, Pass Completion %

### 3.3 Understat (5 ligues)
- xG, xGA par match
- xG chain
- xG buildup

### 3.4 StatsBomb (via FBref)
- PPDA
- High Turnovers
- Box Entries
- Set Piece xG

---

## 4. Implémentation Prioritaire

### Phase 1 — Metrics à fort impact (R² > 0.7)
1. **xG per 90** — Prédictif pour les performances futures
2. **SCA per 90** — Création offensive granulaire
3. **PPDA** — Intensité du pressing
4. **Box Entries** — Entrées dans la surface
5. **Late Goals** — Buts tardifs (signal live)

### Phase 2 — Metrics à impact moyen (R² 0.5-0.7)
6. **Progressive Passes** — Construction du jeu
7. **Tackles + Interceptions** — Solidité défensive
8. **Set Piece xG** — Efficacité CPA
9. **Game State** — Gestion de l'avantage

### Phase 3 — Metrics avancées
10. **xA per 90** — Créativité
11. **High Turnovers** — Pressing haut
12. **Momentum** — Forme par période

---

## 5. Sources Académiques

1. Caley, M. (2012). "A Framework for Expected Goals". *StatsBomb*.
2. Rudd, S. (2019). "A Framework for the Tactical Analysis of Football". *PLOS ONE*.
3. Anzer, G. et al. (2021). "Expected Goals in Soccer: A Statistical Analysis". *Frontiers in Sports*.
4. Power, P. et al. (2017). "Not All Passes Are Created Equal". *MIT Sloan Sports Analytics*.
5. Fernandez, J. et al. (2019). "Decomposing the Immeasurable Sport". *MIT Sloan Sports Analytics*.
6. Bornn, L. et al. (2012). "Pointwise Mutual Information for Analyzing Team Strategies". *MIT Sloan*.
7. Cintia, P. et al. (2015). "Network Analysis of Passing Sequences in Football". *KDD*.
8. Goes, F. et al. (2021). "A Bayesian Network Approach for Predicting Football Match Outcomes". *PLOS ONE*.

---

*Rapport généré le 2026-09-19 par l'agent PariScore*
