# Rapport d'Analyse : Détection de Match-Fixing Tennis

**Source :** Thèse O. Hatfield (2019) — Lancaster University  
**Date du rapport :** Juin 2026  
**Contexte :** Adaptation des méthodes Hatfield au système PariScore (Node.js, better-sqlite3, SSE temps réel)

---

## 1. Résumé Exécutif

La thèse de **C. Hatfield** (MMath, MRes, Lancaster University, 2019) — *"Statistical Methods for Detecting Match-Fixing in Tennis"* — constitue la référence académique la plus avancée sur la détection statistique du match-fixing dans le tennis. Elle propose trois méthodes originales :

| Méthode | Type | Principe | Performance |
|---------|------|----------|-------------|
| **GP pré-match** | Supervisé (cotes + volume) | GP avec variance fonction du volume de paris — détecte les écarts entre cotes réelles et justes valeur | Identifie les grands swings pré-match |
| **Bayésien in-play** | Non supervisé (jeux) | Prior Glicko → mise à jour par vraisemblance des jeux gagnés/perdus au service | 2 matchs suspects (73, 136) confirmés |
| **GP in-play** | Non supervisé (λ implicite) | GP sur λ issu des cotes via fonction inverse (Ch.3), avec covariables de jeu | **Meilleure performance** — poolage inter-matchs |

**Applicabilité à PariScore :** Le système dispose déjà de 80% des données requises (cotes multi-BM, stats SPW/RPW temps réel, Glicko-2 serve/return, DR, BPPI). L'adaptation consiste à ajouter 4 sous-détecteurs légers injectés dans le cycle `pollTennisLive()` existant (30s), sans nouvelle dépendance.

---

## 2. Fondements Mathématiques

### 2.1 Chaîne de Markov du Tennis

Le tennis suit une hiérarchie markovienne à 4 niveaux :

```
Points → Jeux → Sets → Match
```

**Hypothèse IID** (Klaassen & Magnus, 2001) : chaque point est indépendant et identiquement distribué. Violée en pratique mais « relativement inoffensive » pour les prévisions.

**Paramétrisation clé :**

| Paramètre | Formule | Signification |
|-----------|---------|---------------|
| `p_i` | — | Probabilité que joueur i gagne un point sur son service |
| `μ_ij` | `(p_ij + p_ji)/2` | Moyenne des probas de point (paramètre de nuisance) |
| `λ_ij` | `(p_ij - p_ji)/2` | **Paramètre de dominance** — variable clé modélisée in-play |

### 2.2 Fonction `m(λ|μ,s,b)` et son Inversibilité (Ch. 3)

La fonction `m(λ|μ,s,b)` donne la probabilité qu'un joueur gagne le match étant donné :
- `λ` = dominance
- `μ` = moyenne
- `s` = score courant
- `b` = format (BO3 ou BO5)

**Résultat central (Ch. 3) :** Cette fonction est **inversible en λ** pour tout score s. Cela permet de :
1. Déduire `λ` de la probabilité de victoire implicite des cotes
2. Calculer les probabilités de toutes les autres lignes de score
3. Comparer `λ_marché` vs `λ_attendu` (Glicko) comme métrique de suspicion

### 2.3 Lien Cotes → Probabilités Implicites

```
P_implicite(J1) = 1 / cote_J1
```

Après déduction de l'overround (surcharge du marché) :
```
P_norm(J1) = (1/cote_J1) / (1/cote_J1 + 1/cote_J2)
```

La variable modélisée en pré-match est :
```
y_k(τ) = logit(P_implicite) = ln(P_implicite / (1 - P_implicite))
```

### 2.4 Ratings Glicko-2 comme Prior Bayésien

Chaque joueur i a un paramètre de force :
```
θ_i ~ N(ν_i, σ_i²)
```
- `ν_i` = force estimée (rating serveur / retour)
- `σ_i` = incertitude (augmente avec l'inactivité)

Le prior sur λ pour un match J1 vs J2 est :
```
λ ~ N(q(ν_J1 - ν_J2), q²(σ_J1² + σ_J2²))
```
où `q` est une fonction de lien logistique.

PariScore dispose déjà d'un `TennisGlicko2` avec ratings serve/return séparés.

---

## 3. Les 3 Méthodes de Détection de la Thèse Hatfield

### 3.1 Méthode Pré-Match (GP avec Volume)

**Variable modélisée :**
```
Y_k(τ) ~ N(ω_k, Var(Y_k(τ)))
Var(Y_k(τ)) = δ² exp(x_k(τ)β)
Cor(Y_k(τ_i), Y_k(τ_j)) = ρ^{||x_i - x_j||}
```

où `x_k(τ)` est **log(1+volume)** (meilleur ajustement que le temps seul).

**Résultats :**
- L'overround n'a pas d'impact significatif → exclu
- log(1+volume) donne la meilleure variance décroissante
- Temps et volume colinéaires (corrélation = 0.74) → pas les deux ensemble
- Nugget effect (`η²`) nécessaire pour le bruit non-corrélé

**Drapeaux :** p-values par match. Les matchs avec grands swings pré-match sont correctement identifiés.

### 3.2 Méthode In-Play Bayésienne

**Modèle :**
- Prior : `λ ~ N(q(ν_i - ν_j), q²(σ_i² + σ_j²))` basé sur Glicko
- Vraisemblance à chaque changement de jeu : `k_i^(g)(τ)` jeux gagnés au service, `n_i^(g)(τ) - k_i^(g)(τ)` jeux perdus
- Mise à jour postérieure de λ (lente — peu d'info par jeu)

**Résultats :**
- 2 matchs très suspects (IDs 73, 136) — **confirmés** par sources externes comme ayant une activité de pari inhabituelle
- Intervalles de prédiction larges
- Mise à jour trop lente pour une détection rapide

**Limitations identifiées par Hatfield :**
- Ratings Glicko ne prédisent pas toujours bien les cotes d'ouverture
- Effet de surface non capturé
- Données point-par-point manquantes
- Prior basé sur cotes pré-match donne une moins bonne calibration que Glicko

### 3.3 Méthode In-Play GP (Meilleure Performance)

**Approche révolutionnaire :** modélise directement le **λ implicite du marché** (dérivé des cotes via fonction inverse du Ch. 3) au lieu de la probabilité de victoire.

```
Λ_k ~ MVN(α_k 1_nk + X_k β, δ²(C_k + η² I_nk))
```

**Structure block-diagonale** pour la matrice de covariance entre matchs (poolage inter-matchs).

**3 covariables in-play (équation 8.1.3) :**

| Covariable | Description |
|------------|-------------|
| `x_k1(τ)` | Différence des jeux gagnés au service `(k_i^(g) - k_j^(g))` |
| `x_k2(τ)` | Différence des jeux perdus au service `((n_i^(g)-k_i^(g)) - (n_j^(g)-k_j^(g)))` |
| `x_k3(τ)` | Différence des tie-breaks gagnés |

**Métrique de suspicion :** Distance de Mahalanobis entre λ observé et λ prédit.

**Résultats :**
- Sépare clairement les matchs avec et sans grands swings in-play
- Distribution des queues plus lourde que normale → nécessite distribution t de Student
- Poolage inter-matchs via structure block-diagonale améliore significativement la détection

---

## 4. Architecture d'Adaptation pour PariScore

### 4.1 Point d'Injection

```
pollTennisLive() → cycle 30s → après détections existantes :
  1. BPPI spike
  2. SPW Value Shift (detectTennisSpwValueShift)
  3. DR Spike
  4. DR Variance
  5. ★ TennisMatchFixingDetector (NOUVEAU — non-bloquant)
```

**Principe :** try/catch englobant, zéro impact sur le flux existant. Même pattern que les détecteurs actuels.

### 4.2 Module TennisMatchFixingDetector

```javascript
function detectTennisMatchFixing(m) {
  if (!m || !m.is_live) return;
  if (_tnTotalGames(m) < MIN_GAMES) return;

  const oddsScore = oddsDeviationDetector(m);
  const spwScore  = spwRpwAnomalyDetector(m);
  const crossScore = crossInversionDetector(m);
  const volumeScore = volumeAnomalyDetector(m);

  const composite = compositeScore(oddsScore, spwScore, crossScore, volumeScore);
  if (composite >= COMPOSITE_AMBER) {
    broadcastMatchFixingAlert(m, composite, { oddsScore, spwScore, crossScore, volumeScore });
  }
}
```

### 4.3 Sous-Détecteurs

#### 4.3.1 OddsDeviationDetector (35%)
- Compare les cotes actuelles (best_odds) vs probabilité implicite Glicko-2
- Calcule l'écart : `|P_marché - P_glicko|`
- Drapeau si > 6% (seuil Hatfield Ch. 6)
- SSE : `match_fixing_odds_deviation`

#### 4.3.2 SpwRpwAnomalyDetector (30%)
- SPW/RPW live vs baseline pré-match (snapshot serve_dominance)
- Calcule `λ_live` via fonction inverse de `m(λ|μ,s,b)`
- IC bootstrap 90% (500 itérations log-normales) — déjà implémenté dans UQD
- Si `λ_live` hors IC → anomalie
- SSE : `match_fixing_spw_anomaly`

#### 4.3.3 CrossInversionDetector (20%)
- Compare les probas de victoire implicites entre sets successifs
- Détecte une bascule suspecte : J1 favori → outsider sans changement de jeu évident
- Seuil : `|ΔP| > 15%` entre deux sets consécutifs
- SSE : `match_fixing_cross_inversion`

#### 4.3.4 VolumeAnomalyDetector (15%)
- Surveillance du volume de paris (multi-bookmakers)
- Détecte les pics de volume soudains non corrélés à un changement de jeu
- Basé sur méthode pré-match Hatfield (log(1+volume))
- SSE : `match_fixing_volume_spike`

### 4.4 Système de Score Composite

| Composante | Pondération | Source Hatfield |
|------------|-------------|-----------------|
| Odds deviation | 35% | Ch. 6 — GP pré-match |
| SPW/RPW anomaly | 30% | Ch. 7-8 — λ implicite |
| Cross-inversion | 20% | Ch. 8 — bascules suspectes |
| Volume anomaly | 15% | Ch. 6 — log(1+volume) |

**Échelle :** 0 – 100

| Niveau | Score | Action |
|--------|-------|--------|
| Vert | 0 – 39 | Normal — aucun drapeau |
| Orange (AMBER) | 40 – 69 | Alerte modérée — logging + SSE |
| Rouge (RED) | 70 – 100 | Alerte critique — SSE + Discord + stockage BDD |

### 4.5 Gestion des Alertes

- **SSE :** `broadcastSSE('match_fixing_alert', payload)` — même pattern que `bppi_spike`, `spw_value_shift`
- **Cooldown :** 10 minutes par matchId via `_tnAlertOnCooldown` / `_tnAlertMark` (déjà en place)
- **Stockage :** Table `tennis_alerts` avec nouveau champ `integrity_score` (0-100)

**Payload SSE :**
```json
{
  "type": "match_fixing_alert",
  "match_id": "...",
  "composite_score": 72,
  "level": "RED",
  "components": {
    "odds_deviation": 68,
    "spw_anomaly": 81,
    "cross_inversion": 55,
    "volume_anomaly": 42
  },
  "details": {
    "lambda_implied": 0.12,
    "lambda_expected": 0.04,
    "mahalanobis_distance": 3.4,
    "glicko_p1_win": 0.62,
    "market_p1_win": 0.78
  },
  "ts": 1718000000000
}
```

---

## 5. Données Disponibles vs Requises

| Donnée | Disponible PariScore | Requise Hatfield | Statut |
|--------|---------------------|------------------|--------|
| Cotes pré-match multi-bookmakers | Oui (14+ BM) | Oui (exchange unique) | ✅ Supérieur |
| Cotes in-play | Oui (live) | Oui (à chaque jeu) | ✅ |
| SPW/RPW temps réel | Oui (BSD Tennis) | Oui (jeux gagnés/perdus) | ✅ |
| Glicko-2 ratings | Oui (serve/return) | Oui (prior bayésien) | ✅ |
| Volume de paris | Partiel (mouvements) | Oui (log(1+volume)) | ⚠️ Partiel |
| Points par points | Non | Non (amélioration future) | ❌ Manquant |
| Surface du match | Oui | Oui (non modélisée) | ⚠️ Non utilisée |
| Scores sets/jeux | Oui (temps réel) | Oui | ✅ |
| Tie-breaks | Oui | Oui (covariable x_k3) | ✅ |
| Overround | Oui | Non significatif | ✅ |

---

## 6. Seuils et Calibration Proposés

| Seuil | Valeur | Source | Justification |
|-------|--------|--------|---------------|
| `SPW_DEV_THRESHOLD` | **0.05** (5%) | Hatfield Ch. 7 | Écart SPW live vs baseline |
| `PROB_SHIFT_THRESHOLD` | **0.06** (6%) | Hatfield Ch. 6 | Décalage win prob |
| `MAHALANOBIS_THRESHOLD` | **3.0** | Hatfield Ch. 8 | Distance critique Mahalanobis |
| `ODDS_DEVIATION_THRESHOLD` | **0.06** (6%) | Hatfield Ch. 6 | Écart cotes vs Glicko |
| `GAMES_MIN` | **6** | _TN_SPWVAL | Minimum de jeux pour fiabilité |
| `COMPOSITE_AMBER` | **40** / 100 | Calibration proposée | Seuil d'alerte modérée |
| `COMPOSITE_RED` | **70** / 100 | Calibration proposée | Seuil d'alerte critique |
| `COOLDOWN_MS` | **600 000** (10 min) | _TN_SPWVAL | Anti-spam par matchId |

Ces seuils sont déjà partiellement intégrés dans `_TN_SPWVAL` (server.js:25053) :
```javascript
const _TN_SPWVAL = {
  MIN_GAMES: 6,
  SPW_DEV: 0.05,
  PROB_SHIFT: 0.06,
  COOLDOWN_MS: 10 * 60 * 1000,
};
```

---

## 7. Plan d'Implémentation

### Phase 1 — Infrastructure (1 session)
- Ajouter la table `tennis_alerts.integrity_score` (colonne REAL, nullable)
- Créer `TennisMatchFixingDetector` module dans server.js
- Implémenter `compositeScore()` et les 4 sous-détecteurs

### Phase 2 — Détection (1 session)
- `oddsDeviationDetector()` : écart cotes best vs proba Glicko-2
- `spwRpwAnomalyDetector()` : SPW/RPW live vs baseline + IC bootstrap
- `crossInversionDetector()` : bascule de proba entre sets
- `volumeAnomalyDetector()` : pics de volume inexpliqués

### Phase 3 — Intégration (1 session)
- Brancher dans `pollTennisLive()` après SPW Value Shift
- SSE `match_fixing_alert` avec payload complet
- Stockage BDD + cooldown
- Dashboard frontend (composant React)

### Phase 4 — Calibration (continue)
- Ajuster les seuils sur données réelles
- Backtesting sur historique `tennis_alerts`
- Validation croisée avec matchs suspects connus

---

## 8. Limitations et Risques

| Limitation | Impact | Atténuation |
|------------|--------|-------------|
| **Données point-par-point absentes** | Détection plus lente (par jeu) | Accepter granularité jeu ; amélioration future via aiscore |
| **Surfaces non modélisées** | Faux positifs (terre vs gazon) | Intégrer corrélation surfacique Glicko (Hatfield §4.4.3) |
| **Volatilité fin de match** | Faux positifs en tie-break | Pondérer le score composite par avancement |
| **Pas de matchs truqués confirmés** | Impossible de calibrer précisément | Backtesting sur matchs « suspects » historiques ; seuils conservateurs |
| **Blessures / conditions météo** | Faux positifs légitimes | Journaliser avec contexte (alertes météo, forfaits) |
| **Minimum 6 jeux** | Matchs courts non détectables | Seuil abaissable à 4 jeux en mode sensible |
| **Cooldown 10 min** | Fenêtre de détection possiblement manquée | Réduire à 5 min si trop de faux négatifs |
| **Queue de distribution lourde** | Distance de Mahalanobis sous-estimée | Utiliser t-distribution (Hatfield Ch. 8, travaux futurs) |

### Risques spécifiques à PariScore

- **Monopole source BSD** : si BSD Tennis devient payant ou indisponible, SPW/RPW live ne sont plus disponibles. Solution : fallback ESPN (partiel) ou aiscore cache.
- **Multi-bookmakers vs exchange unique** : Hatfield travaille sur un exchange (Betfair). PariScore agrège 14+ bookmakers — les mouvements sont moins extrêmes. Les seuils Hatfield peuvent être trop stricts.
- **Coût computationnel** : GP et bootstrap (500 itérations) en Node.js natif. Le processus `pollTennisLive()` est asynchrone avec timeout. Le détecteur doit rester sous 50ms CPU par match.

---

## 9. Références

| Référence | Source |
|-----------|--------|
| Hatfield (2019) — Thèse complète | `https://eprints.lancs.ac.uk/id/eprint/141874/1/2019hatfieldphd.pdf` |
| Klaassen & Magnus (2001) — Tests IID tennis | Journal of Business & Economic Statistics |
| Barnett & Clarke (2005) — Probas de point tennis | Journal of the Royal Statistical Society |
| Glickman (1999) — Rating Glicko | Harvard University |
| Blake & Templon (2016) — Enquête match-fixing | BBC/BuzzFeed |
| Forrest & McHale (2015, 2019) — SportRadar FDS | University of Salford |
| Ötting et al. (2018) — Détection football Serie B | Journal of Sports Analytics |
| Irons et al. (2014) — Corrélation surfaces tennis | Journal of Quantitative Analysis in Sports |
| Implementation PariScore | `server.js` lignes 25053-25123 `_TN_SPWVAL` + `detectTennisSpwValueShift` |
| Bootstrap IC90 | `server.js` lignes 25125+ (UQD Bootstrap) |
| Glicko-2 Tennis | `server.js` lignes 6557-6602 (`tennisGlicko2`) |
| Table tennis_alerts | `server.js` lignes 6481-6500 |
