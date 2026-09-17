# Football Charts vs PariScore — Analyse Comparative

> Rapport généré le 17 septembre 2026

---

## 1. Présentation de Football Charts

**football-charts.com** — Site vitrine de données football pour 79+ ligues. Modèle gratuit + archive payante (€29-€199). API REST + serveur MCP. Dataset avec DOI académique. Couvre 6 162 matchs en cours (2026/27).

**Positionnement** : "Statistics, not betting advice" — Orientation purement data/visualization, pas de betting ni de prédiction. Travail avec les odds, mais n'offre pas de comparateur de value.

---

## 2. Comparative Feature-by-Feature

| Catégorie | Football Charts | PariScore | Verdict |
|-----------|----------------|-----------|---------|
| **Ligues couvertes** | 79+ (dont ligues exotiques : Lettonie, Lituanie, Koweït, Arabie Saoudite...) | ~15 (top 5 + quelques secondaires via BSD) | **FC +** (couverture brute) |
| **Classements** | Classement unique par ligue, Attack/Defense scatter plot | Standings Home/Away/Global + PPG + Form + historique soccerstats | **PariScore +** |
| **Prédictions** | ❌ Aucun modèle | Ensemble Poisson + Dixon-Coles + RF + XGBoost + Elo + live | **PariScore ++** |
| **Odds** | Archive depuis 2020, 8 marchés, per-bookmaker (opening + closing), CSV/Parquet | Odds live BSD + edge detection (pas d'archive serveur) | **FC +** (archive) / **PariScore +** (edge) |
| **Live Tracking** | ❌ Page "Today" basique (score + stats) | xG/minute, pressure index, funnel, live probability re-projection | **PariScore ++** |
| **Goal Timing** | Median minute du 1er but + % buts après 75' | Shotmap goals + xG/minute curves + momentum timeline | **PariScore +** (profondeur) |
| **BTTS / Over-Under** | % BTTS par ligue, O2.5 rate | Probabilités Poisson (O1.5→O9.5, BTTS yes/no, exact scores) | **PariScore +** |
| **Home Advantage** | % points domicile par ligue | Quantifié via attack-defense composite + elo home factor | **Égal** (FC plus visuel, PS plus granulaire) |
| **Tight Tables** | PPG gap max-min par ligue | Table projection simulation (remaining fixtures) | **PariScore +** |
| **Clean Sheets / 0-0** | % par ligue | Probabilités Poisson (cellule 0-0 + clean sheet rate) | **PariScore +** |
| **API** | REST gratuite + MCP server | 10+ endpoints REST, pas de MCP public | **FC +** (MCP + gratuité) |
| **Dataset / DOI** | CSV/Parquet, DOI académique, archive payante | ❌ Pas de dataset exportable | **FC +** |
| **Modèle quality gates** | Track record public | Walk-forward, Brier score, A/B testing, drift detection | **PariScore +** (rigueur ML) |
| **UI / Visualization** | Scatter plots, barres, heatmaps minimalistes | Shadcn/ui, momentum charts, radar, live cards | **PariScore +** |
| **Both Teams Score (detail)** | % par ligue (agrégat) | Probabilité par match + tendance last N | **PariScore +** |
| **League Analytics** | 1 heatmap (goals map) + 6 classements simples | 14 catégories (league-stat-grid), OddAlerts replica, xG rankings | **PariScore ++** |
| **Freemium** | ✅ Gratuit (charts) + Payant (archive €29-€199) | Gratuit (app web) | **FC +** (modèle business clair) |

---

## 3. Forces de Football Charts (à s'inspirer)

### 3.1 Couverture massif des ligues
**79 ligues** dont beaucoup de divisions inférieures que PariScore ne couvre pas : Lettonie (Virsliga), Lituanie (TOPLYGA), Koweït, Arabie Saoudite, Inde (ISL), Egypte, Chine, Malte... Ces ligues sont intéressantes pour les parieurs cherchant de la valeur sur des marchés peu efficient.

**Action Pariscore** : Étendre la couverture via les sources existantes (BSD couvre déjà ~50 ligues). Prioriser les ligues à forte intensité (BTTS élevé, O2.5 élevé) pour maximiser la valeur détectée.

### 3.2 Goals Map — Scatter Plot Goals vs Draw Rate
Le graphique "Goals per match vs Draw rate" est **excellent** pour visualiser les profils de ligue en un coup d'œil. Les 4 clusters (Open high-scoring, Early settled, Home fortress, Low-scoring) sont immédiatement lisibles.

**Action Pariscore** : Implémenter ce scatter plot dans les pages ligue. Le cluster "Home fortress" est particulièrement pertinent pour nos stratégies home/away.

### 3.3 Fastest Leagues / Late Drama
Le classement par "median minute du 1er but" et "% buts après 75'" est un **洞察 puissant** pour le live betting. Ces métriques existent dans PariScore (pressure index, goal timing) mais ne sont **pas agrégées au niveau ligue** de manière visible.

**Action Pariscore** : Ajouter un widget "Ligues rapides" et "Drame tardif" sur la page d'accueil ou la page ligue.

### 3.4 Tight Tables (Compétitivité)
Le classement par écart PPG best-worst est simple mais très parlant pour évaluer la compétitivité d'une ligue. Utile pour le table projection.

**Action Pariscore** : Intégrer ce metric dans le league-stat-grid existant.

### 3.5 API + MCP Server gratuit
L'API REST est gratuite et bien documentée. Le MCP server est un vrai plus pour les agents IA — Pariscore pourrait en bénéficier pour enrichir ses prédictions.

**Action Pariscore** : Évaluer l'intégration du MCP server de Football Charts comme source complémentaire.

### 3.6 Dataset DOI & Archive Odds
Le fait d'avoir un **dataset académique avec DOI** et une archive odds historique (2020-2025, 142 330 matchs) est un vrai avantage pour la backtesting et la recherche.

**Action Pariscore** : Notre archive odds est lacunaire (localStorage only). Envisager un stockage serveur pour l'historique odds football.

---

## 4. Forces de PariScore (avantage compétitif)

| Avantage | Détail |
|----------|--------|
| **Ensemble ML complet** | 4 modèles + soft voting. FC n'a rien. |
| **Live re-projection** | xG/minute → Poisson live → probabilités en temps réel. FC = score brut. |
| **Pressure Index** | [-100, +100] momentum composite. Unique. |
| **Goal Detection Funnel** | 12 seuils de danger. FC n'a rien d'équivalent. |
| **Edge Detection** | Modèle vs odds → value betting. FC donne les cotes sans les juger. |
| **League Analytics profond** | 14 catégories de stats, OddAlerts replica, table projection. |
| **Walk-forward + Brier + A/B** | Infrastructure de validation ML rigoureuse. |
| **Correct Score Matrix** | Heatmap Poisson 0-0 → 10-10, FC n'a rien. |
| **Model Track Record** | Brier score historique, drift detection. FC = "track record" basique (W/L). |

---

## 5. Recommandations Prioritaires

| # | Action | Impact | Effort | Priorité |
|---|--------|--------|--------|----------|
| 1 | **Goals Map scatter plot** (goals vs draw rate par ligue) | 🟢 Élevé | 🟢 Faible | **P0** |
| 2 | **Fastest Leagues / Late Drama** widget (median 1st goal + late %) | 🟢 Élevé | 🟢 Faible | **P0** |
| 3 | **Tight Tables metric** dans league-stat-grid | 🟡 Moyen | 🟢 Faible | **P1** |
| 4 | **Archive odds serveur** (remplacer localStorage) | 🟢 Élevé | 🟠 Moyen | **P1** |
| 5 | **Étendre couverture ligues** (objectif 50+) | 🟡 Moyen | 🟡 Moyen | **P1** |
| 6 | **API publique documentée** (Swagger/OpenAPI) | 🟡 Moyen | 🟡 Moyen | **P2** |
| 7 | **MCP server** pour agents IA | 🟡 Moyen | 🟠 Moyen | **P2** |
| 8 | **Dataset export** (CSV/Parquet) avec DOI | 🟢 Élevé | 🟠 Moyen | **P2** |

---

## 6. Conclusion

**Football Charts** excelle en **couverture** (79 ligues), **archive odds** (depuis 2020), et **API/MCP gratuit**. C'est une ressource data de premier plan pour les backers et chercheurs.

**PariScore** surpasse largement en **profondeur analytique** : prédiction ML ensemble, live re-projection, pressure index, edge detection, et league analytics. C'est un **outil de prise de décision**, pas juste un visualiseur.

**L'axe gagnant** : PariScore peut absorber les meilleur idées de FC (goals map, fastest/late leagues, tight tables) tout en conservant son avantage ML et live. L'ajout d'une archive odds serveur + dataset exportable comblerait la principale lacune de PariScore face à FC.

---

*Sources : [football-charts.com](https://www.football-charts.com/) (consulté le 17/09/2026), analyse du codebase Pariscore*
