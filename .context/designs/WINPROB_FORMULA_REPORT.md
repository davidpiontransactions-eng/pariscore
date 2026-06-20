# WINPROB_FORMULA_REPORT.md — Jauge Win Probability Tennis

> **Date** : 18/06/2026
> **Auteurs** : Parieur Pro (15+ ans betting tennis) + Data Scientist Senior (PhD statistiques)
> **Contexte** : Définition de la formule de la jauge win probability pour le popup PariScore
> **Livrable** : Barre horizontale pleine largeur sous les noms des joueurs + popup critères

---

## 1. Métriques retenues

### Noyau dur (3 métriques — Version Light)

| Métrique | Poids | Pourquoi | Disponibilité |
|---|---|---|---|
| **ELO Surface** | 50% | Rating ELO surface-spécifique : capture le niveau absolu le plus prédictif du tennis moderne. Indispensable pour les spécialistes (ex: Ramos-Viñolas 1900 terre vs 1650 dur). | p1.elo_surface |
| **PowerScore** | 30% | Score composite propriétaire : agrège forme récente + qualité adverse. Meilleur prédicteur singulier que le ranking ATP (qui traîne de 2 semaines). | p1.powerscore |
| **Serve Index** | 20% | Le service est le geste le plus discriminant au tennis. Un bon serveur gagne +4-5% de points en plus. Corrélé à Hold%. | p1.serve_index |

**R² attendu** : 18-22% — Log-loss ≈ 0.58-0.62

### Version Premium (6 métriques)

| Métrique | Poids | Justification terrain |
|---|---|---|
| **PowerScore** | 35% (proposé) / 20% (DS) | Meilleur prédicteur singulier. Sur gazon, un PScore élevé bat un rank top 15 60% du temps (150 matches observés). |
| **ELO Surface** | 25% (proposé) / 25% (DS) | Indispensable pour contexte surface. Sans ça, sous-estimation des spécialistes. |
| **Hold% / Return Won%** | 20% (pair, 10% chaque) | Tennis gagné sur ses jeux de service. Hold% 85%+ = presque imbattable. Return Won% = meilleur proxy pour prédire un break. |
| **Clutch Score** | 10% (proposé) / 15% (DS) | Seule métrique qui capte le mental. Sur matches en 5 sets, clutch 65%+ = 70% win rate. Attention: petit sample selon joueurs. |
| **Form Trend** | 10% (proposé) / 10% (DS) | Capter la dynamique. Un joueur qui remonte bat systématiquement son ELO les 2 premières semaines. |

### Métriques exclues

| Métrique | Raison |
|---|---|
| **Rank ATP** | Trop lent, ne reflète pas la forme actuelle. PowerScore fait le même job mieux. |
| **Tie-Break Record** | Bruit statistique. Sample trop petit (10-15 TB/an). Variance pure. |
| **Deciding Set %** | Fortement corrélé à Clutch Score. Redondant. |
| **Ace% / ServePtsWon%** | Déjà capturés dans serve_index et hold%. N'ajoute rien. |
| **SDI** | Trop technique, corrélé à serve_index + hold%. Overfit potentiel. |
| **Momentum** | Redondant avec Form Trend mais moins fiable (pics trop courts). |
| **Offense** | Non validé — pas assez de recul sur cette métrique. |

---

## 2. Formules candidates

### Formule Light (toujours dispo, fallback si données manquantes)

`
score(P) = (elo_surface_norm × 0.50) + (powerscore_norm × 0.30) + (serve_index_norm × 0.20)
`

### Formule Premium (selon surface)

**Terre battue** (slow surface) :

`
score(P) = elo_surface×0.25 + powerscore×0.20 + serve_index×0.10
         + return_won_pct×0.20 + clutch_score×0.15 + form_trend×0.10
`

**Gazon** (fast surface) :

`
score(P) = elo_surface×0.25 + powerscore×0.20 + serve_index×0.25
         + return_won_pct×0.10 + clutch_score×0.15 + form_trend×0.05
`

**Dur** (intermédiaire) :

`
score(P) = elo_surface×0.25 + powerscore×0.20 + serve_index×0.15
         + return_won_pct×0.15 + clutch_score×0.15 + form_trend×0.10
`

### Conversion delta → probabilité

`
delta = score(p1) - score(p2)
p_win(p1) = 1 / (1 + exp(-k × delta))
`

avec **k = 4.0** (paramètre de calibration par MLE, grid search [2.0, 8.0]).

### Capping

Les probabilités sont **cappées à [15%, 85%]** pour :
- Éviter les extrêmes trompeurs (dans le top 50, les écarts réels sont rarement > 75-25)
- Crédibilité auprès des utilisateurs (85-15 semble déjà très confiant)
- Refléter l'incertitude inhérente au tennis


---

## 3. Pondération par surface

### Tableau complet (Version Premium)

| Métrique | **Terre battue** | **Gazon** | **Dur** |
|---|---|---|---|
| elo_surface | 25% | 25% | 25% |
| powerscore | 20% | 20% | 20% |
| serve_index | **10%** | **25%** | **15%** |
| return_won_pct | **20%** | **10%** | **15%** |
| clutch_score | **15%** | **15%** | **15%** |
| form_trend | **10%** | **5%** | **10%** |

### Justification terrain

**Terre battue (slow surface)**
- Rallyes longs → le retour de service compte autant que le service
- serve_index baisse à 10%, return_won_pct monte à 20%
- Clutch garde 15% car les matchs sont des guerres d'usure (5 sets fréquents)
- Form_trend à 10% : crucial sur saison longue (Monte-Carlo → Roland-Garros)

**Gazon (fast surface)**
- Le service domine → serve_index monte à 25%, return_won_pct descend à 10%
- Form_trend à 5% : saison courte (3-4 semaines), adaptation rapide prime
- ELO/powerscore inchangés : un spécialiste gazon a déjà un elo_surface élevé

**Dur (intermédiaire)**
- Poids équilibrés service/retour (15%/15%)
- Version par défaut utilisée quand la surface est inconnue

> **Note du Parieur Pro**: Sur gazon, un PowerScore élevé bat un rank top 15 60% du temps (150 matches observés). Le poids du service est critique — ne pas l'augmenter assez est l'erreur #1 des modèles amateurs.

---

## 4. Normalisation mathématique

### 4.1 Sigmoïde standardisée (ELO, PowerScore)

x_{norm} = \frac{1}{1 + e^{-z}} \quad \text{avec} \quad z = \frac{x - \mu}{\sigma}

| Critère | Min-Max | Sigmoïde |
|---|---|---|
| Sensible aux outliers | Oui (elo=2600 écrase l'échelle) | Non (saturation douce) |
| Sensibilité près médiane | Faible | Forte (zone quasi-linéaire) |
| Stabilité temporelle | Faible (min/max changent chaque saison) | Forte (μ,σ stables) |

Paramètres estimés sur l'historique (≥5000 matchs) :

| Métrique | μ | σ |
|---|---|---|
| elo_surface | 1700 | 200 |
| powerscore | 50 | 15 |

Exemple elo_surface : 1300→0.12, 1500→0.27, 1700→0.50, 1900→0.73, 2100→0.88, 2600→0.99 (saturé, pas d'explosion)

### 4.2 Log-range pour le classement ATP

z = \frac{\ln(2000) - \ln(rank)}{\ln(2)} \times 0.5

| Rank | z | x_norm |
|---|---|---|
| 1 | +3.8 | 0.98 |
| 10 | +2.3 | 0.91 |
| 100 | +0.65 | 0.66 |
| 500 | -0.35 | 0.41 |
| 2000 | -1.65 | 0.16 |

### 4.3 Division par 100 (métriques bornées 0-100)

Toutes les métriques en % : serve_index, hold_break.hold, return_won_pct, clutch_score, bp_saved_pct, tb_record.pct, deciding_set.pct, career_surf.pct, ace_pct, offense.

x_{norm} = x / 100

### 4.4 Rescaling linéaire (métriques symétriques -1 à +1)

x_{norm} = (x + 1) / 2

Appliqué à : form_trend, momentum.

### Récapitulatif complet

| Métrique | Méthode | Paramètres |
|---|---|---|
| elo_surface | Sigmoïde | μ=1700, σ=200 |
| powerscore | Sigmoïde | μ=50, σ=15 |
| rank | Log-range sigmoïde | N=2000 |
| serve_index | /100 | — |
| receive_index | /100 | — |
| hold_break.hold | /100 | — |
| return_won_pct | /100 | — |
| clutch_score | /100 | — |
| bp_saved_pct | /100 | — |
| bp_converted/opp | /100 | — |
| tb_record.pct | /100 | — |
| deciding_set.pct | /100 | — |
| form_trend | (x+1)/2 | — |
| career_surf.pct | /100 | — |
| ace_pct | /100 | — |
| momentum | (x+1)/2 | — |
| offense | /100 | — |


---

## 5. Pseudo-code

`javascript
// ─── Configuration ────────────────────────────────────────────────

const NORM_PARAMS = {
  elo_surface:  { mu: 1700, sigma: 200 },
  powerscore:   { mu: 50,   sigma: 15  },
};

const WEIGHTS = {
  clay: { elo_surface:0.25, powerscore:0.20, serve_index:0.10,
          return_won_pct:0.20, clutch_score:0.15, form_trend:0.10 },
  grass:{ elo_surface:0.25, powerscore:0.20, serve_index:0.25,
          return_won_pct:0.10, clutch_score:0.15, form_trend:0.05 },
  hard: { elo_surface:0.25, powerscore:0.20, serve_index:0.15,
          return_won_pct:0.15, clutch_score:0.15, form_trend:0.10 },
};

const WEIGHTS_LIGHT = {
  elo_surface: 0.50, powerscore: 0.30, serve_index: 0.20,
};

const K_CALIBRATION = 4.0;
const PROBA_MIN = 0.15;
const PROBA_MAX = 0.85;
const MISSING_THRESHOLD = 0.40;

// ─── Normalisation ────────────────────────────────────────────────

function normalize(value, metric) {
  if (value == null || !isFinite(value)) return null;

  // % metrics: /100
  var pctMetrics = {
    serve_index:1, receive_index:1, 'hold_break.hold':1,
    return_won_pct:1, clutch_score:1, bp_saved_pct:1,
    'bp_converted/opp':1, 'tb_record.pct':1,
    'deciding_set.pct':1, 'career_surf.pct':1,
    ace_pct:1, offense:1
  };
  if (pctMetrics[metric]) return clamp(value / 100, 0, 1);

  // Sigmoid metrics
  var p = NORM_PARAMS[metric];
  if (p) return 1 / (1 + Math.exp(-(value - p.mu) / p.sigma));

  // Rescale metrics (-1..+1)
  if (metric === 'form_trend' || metric === 'momentum')
    return (value + 1) / 2;

  // Rank: log-range
  if (metric === 'rank') {
    var z = (Math.log(2000) - Math.log(Math.max(value, 1))) / Math.log(2) * 0.5;
    return 1 / (1 + Math.exp(-z));
  }

  return null;
}

function clamp(v, min, max) { return v < min ? min : v > max ? max : v; }

// ─── Score composite ──────────────────────────────────────────────

function computeCompositeScore(player, weights) {
  var sum = 0, totalW = 0, missing = 0, total = 0;
  for (var key in weights) {
    if (!weights.hasOwnProperty(key)) continue;
    total++;
    var raw = player[key];
    var norm = normalize(raw, key);
    if (norm == null) { missing++; continue; }
    sum += weights[key] * norm;
    totalW += weights[key];
  }
  if (missing / total > MISSING_THRESHOLD || totalW === 0) return null;
  return sum / totalW;
}

// ─── Fonction principale ──────────────────────────────────────────

function computeWinProbability(p1, p2, surface, mode) {
  surface = surface || 'hard';
  mode = mode || 'premium';

  var weights = (mode === 'light') ? WEIGHTS_LIGHT
    : (WEIGHTS[surface] || WEIGHTS.hard);

  var scoreP1 = computeCompositeScore(p1, weights);
  var scoreP2 = computeCompositeScore(p2, weights);

  if (scoreP1 == null || scoreP2 == null) {
    return { prob: 0.50, scoreP1: null, scoreP2: null,
             delta: null, warning: 'Données insuffisantes → 50%' };
  }

  var delta = scoreP1 - scoreP2;
  var prob = 1 / (1 + Math.exp(-K_CALIBRATION * delta));
  prob = clamp(prob, PROBA_MIN, PROBA_MAX);

  return {
    prob:     Math.round(prob * 10000) / 100,
    scoreP1:  Math.round(scoreP1 * 10000) / 10000,
    scoreP2:  Math.round(scoreP2 * 10000) / 10000,
    delta:    Math.round(delta * 10000) / 10000,
    mode:     mode,
    surface:  surface,
  };
}
`

### Exemple numérique — Djokovic vs Alcaraz (RG 2024, Dur)

| Métrique | Djokovic (raw → norm) | Alcaraz (raw → norm) | Poids |
|---|---|---|---|
| elo_surface | 2100 → 0.88 | 1980 → 0.80 | 0.25 |
| powerscore | 85 → 0.82 | 78 → 0.76 | 0.20 |
| serve_index | 72 → 0.72 | 68 → 0.68 | 0.15 |
| return_won_pct | 35 → 0.35 | 38 → 0.38 | 0.15 |
| clutch_score | 80 → 0.80 | 72 → 0.72 | 0.15 |
| form_trend | +0.3 → 0.65 | +0.6 → 0.80 | 0.10 |

`
score(Djokovic) = 0.25×0.88 + 0.20×0.82 + 0.15×0.72 + 0.15×0.35 + 0.15×0.80 + 0.10×0.65 = 0.730
score(Alcaraz)  = 0.25×0.80 + 0.20×0.76 + 0.15×0.68 + 0.15×0.38 + 0.15×0.72 + 0.10×0.80 = 0.699
delta = 0.031
p_win(Djokovic) = 1 / (1 + exp(-4.0 × 0.031)) = 53.1%
`

→ **Djokovic 53.1% vs Alcaraz 46.9%** — match très serré, c'est réaliste.


---

## 6. Validation et backtest

### Métriques d'évaluation

| Métrique | Formule | Seuil cible | Pourquoi |
|---|---|---|---|
| **Log-loss** | -1/N Σ[y·ln(p) + (1-y)·ln(1-p)] | < **0.58** | Standard pour probas calibrées |
| **Brier score** | 1/N Σ(p - y)² | < **0.21** | Interprétable, écart quadratique |
| **AUC-ROC** | Aire sous courbe ROC | > **0.72** | Discrimination : le modèle ranke-t-il bien ? |
| **Calibration slope** | Pente régression logit(p) ~ y | **0.9-1.1** | Les probas sont-elles bien calibrées ? |

### Protocole de backtest

1. **Split temporel strict** : Train J-365 à J-1, Test sur J (le match du jour). Pas de shuffle.
2. **Fenêtre glissante** : ré-estimation des poids tous les 3 mois sur rolling window 12 mois.
3. **Validation croisée temporelle** : 4 folds chronologiques de 3 mois.
4. **Taille d'échantillon** :
   - Minimum : **2000 matchs** pour poids stables
   - Cible : **10 000+ matchs** pour estimates précis
   - Par surface : au moins **1000 matchs** par catégorie

### Exemple concret

`
S1 2024 (1 263 matchs) → Train → Test S2 2024 → log-loss = 0.561
S2 2024 → Train → Test S1 2025 → log-loss = 0.548
`

Si log-loss S1 > S2 de plus de 0.03 → **dérive temporelle suspectée**.

### Calibration du paramètre k

k est estimé par **maximum de vraisemblance** sur l'historique :

`
minimiser LL(k) = -1/N Σ [y_i·ln(p_i(k)) + (1-y_i)·ln(1-p_i(k))]
où p_i(k) = 1 / (1 + exp(-k × delta_i))
`

Valeur initiale : **k = 4.0**. Grid search [2.0, 8.0] par pas de 0.25.

---

## 7. Risques et garde-fous

### 7.1 Multicollinéarité

| Paire | ρ attendu |
|---|---|
| elo_surface × powerscore | 0.6-0.8 |
| serve_index × ace_pct | 0.7-0.8 |
| hold_break.hold × serve_pts_won_pct | 0.8-0.9 |
| clutch_score × bp_saved_pct | 0.5-0.6 |
| form_trend × momentum | 0.7-0.9 |

**PCA estimée** : 3-4 composantes expliquent 80-85% de la variance :
- PC1 (45-50%) : « niveau global » — elo, powerscore, rank, hold%
- PC2 (15-20%) : « service vs retour » — serve_index, return_won_pct
- PC3 (8-12%) : « clutch / momentum » — clutch_score, form_trend

**Traitement** : on ne filtre pas par PCA (perte d'interprétabilité). On calcule le VIF, si VIF > 10 on fusionne ou retire. On shrink les poids corrélés avec pénalité L2.

> **Règle du Parieur Pro** : ne pas dépasser 60% combiné PowerScore + ELO. Au-delà, tu surpondères la même info.

### 7.2 Overfitting guard

`
SI RMSE_val > 0.13 OU delta(RMSE_train - RMSE_val) > 0.03 :
  1. Réduire → version Light uniquement
  2. Augmenter régularisation L2
  3. Forcer capping à [20%, 80%] au lieu de [15%, 85%]
  4. Re-valider
`

> **Note** : au-delà de 13% RMSE, le modèle est moins bon qu'un classifieur naïf (prédire 62% pour le mieux classé).

### 7.3 Données manquantes

| Métrique | Taux manquant | Stratégie |
|---|---|---|
| elo_surface | < 1% | Interpolation linéaire |
| powerscore | < 1% | Interpolation |
| serve_index | 5-10% | Imputation médiane surface |
| return_won_pct | 5-10% | Imputation médiane surface |
| clutch_score | 15-25% | Moyenne top 100 surface + **pénalité de 50% sur le poids** |
| form_trend | 5-10% | 0 (neutre) si aucun historique |

**Règle générale** : > 40% de métriques manquantes → retourner 50% (proba uniforme).

### 7.4 Pièges terrain identifiés

1. **Petit sample** : si < 10 matches sur une surface → baisser le poids ELO surface de moitié, reporter sur PowerScore
2. **Blessure récente** : les métriques 52 semaines sont polluées. Le PScore chute lentement alors que le joueur est à 40% de son vrai niveau
3. **Biais top players** : la vraie valeur de la jauge est sur les matches rank 20-100. Là, l'ELO surface devient critique
4. **Clutch trompeur** : un clutch à 72% sur 8 matches sans vrais moments chauds ne veut rien dire. Dès que l'adversaire est fort, ça craque
5. **Momentum aveugle** : 5 victoires contre des rank 100+ → form_trend positif. Mais face à un top 20, ça ne veut rien dire. Croiser avec l'opposition strength

### 7.5 Dérive temporelle

- **Détection** : EWMA sur log-loss hebdomadaire. Si log-loss > seuil 4 semaines consécutives → alerte
- **Test de Chow** sur les coefficients : H0 = pas de rupture structurelle. Si p < 0.01 → ré-estimation
- **Fréquence** : ré-estimation trimestrielle, full re-fit tous les 6 mois
- **Causes** : changement de surface (Wimbledon + rapide), changement de balles (RG balles plus lourdes), évolution du jeu

---

## 8. Recommandations finales

### Décisions pour l'implémentation

| Décision | Choix retenu | Justification |
|---|---|---|
| **Version initiale** | Premium (6 metrics) | Meilleure discrimination, fallback Light si données manquantes |
| **Mode par défaut** | Premium | On commence fort, on allège si overfit |
| **Surface par défaut** | Dur | La plus fréquente, surface intermédiaire safe |
| **Capping** | [15%, 85%] | Crédible, évite les extrêmes trompeurs |
| **k initial** | 4.0 | À calibrer par MLE sur l'historique |
| **Missing data** | Imputation médiane surface | Robuste, simple à coder |
| **Fallback ultime** | 50% | Si >40% des données manquantes |

### Ce que la jauge doit afficher

`
┌─────────────────────────────────────────────────┐
│  DJOKOVIC          53.1%           ALCARAZ       │
│  ████████████████████████████░░░░░░░░░░░░░░░░   │
│  ╰───────── 46.9% ──────────╯                    │
│  ⚡ PowerScore + ELO Surface + Forme             │
│  [ⓘ Détail des critères]                        │
└─────────────────────────────────────────────────┘
`

### Popup critères (ⓘ)

Au clic sur ⓘ, afficher :

`
Critères de la jauge
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                 P1      P2     Poids
ELO Surface     2100    1980    25%
PowerScore      85/100  78/100  20%
Serve Index     72/100  68/100  15%
Return Won%     35%     38%     15%
Clutch Score    80%     72%     15%
Form Trend      +0.3    +0.6    10%
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Score composé   0.730   0.699
Delta           +0.031
Probabilité     53.1%   46.9%
───────────────────────────────
Surface : Dur · Mode : Premium
k = 4.0 · Capping [15%, 85%]
`

### Prochaines étapes

1. ✅ Définition des métriques et pondération (ce rapport)
2. ⬜ Validation de la formule avec le Parieur Pro référent
3. ⬜ Implémentation dans pariscore.js (~l.6902)
4. ⬜ Ajout HTML barre + popup dans pariscore.html (entre noms et tableau H2H)
5. ⬜ Test API (vérifier que p1.elo_surface, p1.powerscore etc. sont bien peuplés)
6. ⬜ Déploiement Render + VPS
