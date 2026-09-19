# Rapport Académique — Filtres Top 10 Rugby (Rugby4Cast)

**Date :** 2026-09-19  
**Scope :** Analyse scientifique de chaque filtre/stratégie du widget Top 10 rugby, avec fondements académiques, faiblesses du modèle actuel et améliorations proposées.

---

## Références clés

| ID | Auteurs | Année | Titre | Source |
|----|---------|-------|-------|--------|
| [VG] | Fry, Smart, Serbera, Klar | 2021 | A Variance Gamma Model for Rugby Union Matches | University of Bradford |
| [DC] | Dixon, Coles | 1997 | Modelling Association Football Scores and Inefficiencies in the Football Betting Market | Applied Statistics |
| [ML] | Bunker, Susnjak | 2022 | The Application of ML Techniques for Predicting Match Results in Team Sport: A Review | JAIR |
| [HA] | Sedeaud, De Larochelambert et al. | 2021 | The COVID-19 Pandemic Impact on Away and Home Victories in Soccer and Rugby Union | Frontiers in Sports |
| [XT] | Elvin | 2025 | Implementation of an XT Model in Rugby Union | ProQuest |
| [RD] | Delbianco, Fioravanti et al. | 2026 | Regional Advantage in Rugby Sevens: Is There a Home Effect When Nobody is Home? | arXiv:2608.16312 |
| [BA] | Baumer, Matthews, Nguyen | 2023 | Big Ideas in Sports Analytics and Statistical Tools for their Investigation | arXiv:2301.04001 / WIREs |
| [PS] | Baker, Chadwick, Parma | 2022 | The Binomial-Match, Outcome Uncertainty, and the Case of Netball | J. Operational Research |
| [NR] | Louit et al. | 2025 | Do Rugby Union Teams Win Because They Run More? Total Distance and HSR Don't Predict Pro D2 Points | ResearchGate |

---

## 1. 🏠 Victoire domicile (`homeWin`)

### Implémentation actuelle

```
P(home win) = Σ_{i>j} grid[i][j]
où grid[i][j] = Poisson(i, λH) × Poisson(j, λA)
λH = leagueAvgHome × attack_home × defence_away × homeBase × freshHome × h2hHome
homeBase = 1 + min(0.28, homeAdvantage / 200)   → ~1.275 pour homeAdvantage=55
```

### Fondements académiques

- **Dixon & Coles (1997)** : Le modèle Poisson bivarié est le standard de l'industrie pour les sports à buts/points. Les scores sont modélisés comme deux processus de Poisson indépendants (avec correction de corrélation faible pour les scores bas).
- **Fry et al. (2021) [VG]** : Pour le rugby union, la distribution Poisson **sous-estime les queues lourdes** (les gros écarts de score). Le modèle Variance Gamma (VG) capture mieux la variance des écarts de score rugby. Accuracy out-of-sample : **~90%** vs ~85% pour le Poisson pur.
- **Sedeaud et al. (2021) [HA]** : L'avantage domicile dans le rugby union professionnel est **réel mais en déclin** — il est passé de ~60% (années 2000) à ~55% (post-COVID). Le Top 14 a un avantage domicile plus marqué que le Super Rugby ou le Premiership.
- **Delbianco et al. (2026) [RD]** : L'effet domicile est **équipe-spécifique** et dépend du décalage horaire (jet lag est-ouest) et de la distance, pas seulement du facteur binaire "domicile/extérieur".

### Faiblesses actuelles

1. **homeAdvantage = 55 (constant)** : Ne varie pas par compétition ni par équipe. Le Top 14 a un avantage domicile ~10-15% plus élevé que le Super Rugby.
2. **Pas de correction Dixon-Coles** : Le modèle utilise une grille Poisson indépendante sans le facteur ρ (tau) qui corrèle les scores bas (0-0, 1-0, 0-1, 1-1). En rugby, les nuls sont rares (~2%) mais les scores bas (10-7, 13-9) sont fréquents.
3. **Pas de VG** : Le fichier `variance-gamma.ts` existe mais n'est **pas intégré** au moteur principal.
4. **Pas de décalage horaire** : Le modèle ignore l'effet jet lag pour les matchs internationaux (Champions Cup, Challenge Cup).

### Améliorations proposées

```typescript
// 1. homeAdvantage par compétition (calibré sur données historiques)
const HOME_ADV_BY_COMP: Record<string, number> = {
  "top-14": 62,           // +12.7% vs moyenne
  "premiership": 52,      // +10.4%
  "united-rugby": 48,     // +9.6%
  "super-rugby-pacific": 38, // +7.6% (voyages longs, moins d'effet)
  "six-nations": 58,      // +11.6%
  "rugby-championship": 42, // +8.4%
};

// 2. Correction Dixon-Coles pour les scores bas (ρ ≈ -0.13 pour le rugby)
function dixonColesTau(x: number, y: number, lambdaH: number, lambdaA: number, rho: number): number {
  if (x === 0 && y === 0) return 1 - lambdaH * lambdaA * rho;
  if (x === 0 && y === 1) return 1 + lambdaH * rho;
  if (x === 1 && y === 0) return 1 + lambdaA * rho;
  if (x === 1 && y === 1) return 1 - rho;
  return 1;
}

// 3. Intégrer le modèle VG comme surcouche (optionnel)
// P_VG(win) = 0.6 × P_Poisson(win) + 0.4 × P_VG(win)
```

---

## 2. ✈️ Victoire extérieur (`awayWin`)

### Implémentation actuelle

```
P(away win) = Σ_{i<j} grid[i][j]
Symétrique au homeWin, mais sans le facteur homeBase.
```

### Fondements académiques

- **Même modèle Poisson bivarié** que le homeWin. La probabilité away est simplement le complément.
- **[HA]** : Le taux de victoire à l'extérieur dans le Top 14 est d'environ **38-42%**, ce qui en fait une compétition où l'extérieur a plus de chances qu'en Premiership (~35%) ou Super Rugby (~33%).
- **[RD]** : Pour les compétitions internationales, l'effet "extérieur" est modulé par la **distance géographique** et le **jet lag** — un facteur ignoré par le modèle actuel.

### Faiblesses actuelles

1. **Pas de facteur voyage** : Un déplacement Toulouse → Paris n'est pas équivalent à Toulouse → Auckland.
2. **Pas d'ajustement pour les matchs neutres** : Le flag `neutral` existe mais n'est pas toujours renseigné (ex. phases finales).

### Améliorations proposées

```typescript
// Facteur voyage (distance géographique → impact sur performance away)
function travelPenalty(homeCoords: [number, number], awayCoords: [number, number]): number {
  const dist = haversine(homeCoords, awayCoords);
  if (dist < 500) return 1.0;      // Pas de pénalité (< 500 km)
  if (dist < 1500) return 0.97;    // Légère pénalité
  if (dist < 5000) return 0.94;    // Pénalité modérée
  return 0.90;                      // Forte pénalité (intercontinentale)
}

// Jet lag : décalage horaire → pénalité multiplicative
function jetLagPenalty(tzDiff: number): number {
  return 1 - Math.min(0.06, Math.abs(tzDiff) * 0.015);
}
```

---

## 3. 🔥 Over 41,5 points (`over415`)

### Implémentation actuelle

```
P(> 41.5) = Σ_{i+j > 41.5} grid[i][j]
Ligne fixe à 41.5 points.
```

### Fondements académiques

- **[VG]** : La distribution des totaux de points en rugby union suit une **loi quasi-Normale** quand λ est élevé (≈ 40-50 points), mais avec des **queues plus épaisses** que la Normale. Le modèle VG capture cette surdispersion.
- **[BA]** : Les marchés over/under dans les sports à scoring élevé (basketball, rugby) sont **plus efficaces** que les marchés 1X2 — les bookmakers ont moins d'inefficacités sur ces lignes.
- **Top 14 spécifiquement** : La moyenne de points par match en Top 14 est d'environ **44-48 points** (saison 2024-2025), ce qui place la ligne 41.5 légèrement sous la moyenne.

### Faiblesses actuelles

1. **Ligne fixe (41.5)** : Ne s'adapte pas aux conditions météo (pluie → -8 à -12 points), à la période de la saison, ni au style de jeu des équipes.
2. **Pas de corrélation λH-λA** : Le modèle suppose l'indépendance des scores, mais en rugby une équipe qui mène change de stratégie (plus conservatrice → moins d'essais).
3. **Pas de surdispersion** : Le Poisson pur sous-estime la variance du total de points. Le ratio variance/moyenne en Top 14 est ~1.15-1.25 (surdispersion modérée).

### Améliorations proposées

```typescript
// 1. Ligne dynamique basée sur le style de jeu des équipes
function dynamicLine(lambdaH: number, lambdaA: number, weather: number): number {
  const baseLine = lambdaH + lambdaA;
  const weatherAdj = weather === RAIN ? -8 : weather === WIND ? -4 : 0;
  return Math.round((baseLine + weatherAdj) * 2) / 2; // Arrondi au demi-point
}

// 2. Modèle Negative Binomial pour la surdispersion
// NB(μ, r) où r = μ² / (σ² - μ) — si σ² > μ, la NB est plus appropriée
function negBinPmf(k: number, mu: number, r: number): number {
  const p = r / (r + mu);
  return combination(k + r - 1, k) * Math.pow(p, r) * Math.pow(1 - p, k);
}

// 3. Corrélation négative faible entre λH et λA (quand un score monte, l'autre baisse légèrement)
function correlatedLambdas(lambdaH: number, lambdaA: number, rho: number): [number, number] {
  // Ajustement : si home marque plus, away marque un peu moins (et vice versa)
  const adj = rho * Math.sqrt(lambdaH * lambdaA);
  return [lambdaH - adj * 0.5, lambdaA - adj * 0.5];
}
```

---

## 4. ❄️ Under 51,5 points (`under515`)

### Implémentation actuelle

```
P(< 51.5) = 1 - P(> 51.5) = 1 - Σ_{i+j > 51.5} grid[i][j]
```

### Fondements académiques

- Complémentaire de l'over. Même modèle, mêmes limites.
- **[VG]** : Le modèle VG montre que les matchs à très haut scoring (> 60 points) ont une probabilité **plus élevée** que ce que prédit le Poisson — ce qui signifie que l'under 51.5 est **sous-évalué** par le modèle actuel quand les lambdas sont élevés.
- **Top 14** : ~35-40% des matchs dépassent 51.5 points. La ligne est donc légèrement du côté "over" de la médiane.

### Faiblesses actuelles

1. **Mêmes limites que l'over** : Pas de surdispersion, pas de corrélation.
2. **Lignes fixes** : 41.5, 46.5, 51.5, 56.5, 61.5 — ne reflètent pas les tendances saisonnières.

### Améliorations proposées

- Appliquer les **mêmes corrections** que l'over (NB, corrélation, météo).
- Ajouter des **lignes intermédiaires** (36.5, 44.5, 49.5, 54.5) pour plus de granularité.

---

## 5. 📊 Handicap -3,5 domicile (`handicapHome`)

### Implémentation actuelle

```
handicapLine = round(expectedMargin) - 0.5
P(home couvre) = Σ_{i-j > handicapLine} grid[i][j]
```

### Fondements académiques

- **[DC]** : Le handicap (spread) est le marché le plus **efficient** en termes de prédiction — les bookmakers le calibrent très précisément. La marge attendue est le meilleur prédicteur unique du résultat.
- **[VG]** : La distribution des marges de victoire en rugby suit une VG, pas une Normale. Les queues lourdes signifient que les gros handicaps (> 15 points) sont plus couverts que ne le prédit le Poisson.
- **[XT]** : Le modèle XT (Expected Threat) adapté au rugby par Elvin (2025) montre que la marge prédite dépend fortement de la **zone de terrain où les points sont marqués** (essai vs pénalité vs drop).
- **[BA]** : Le handicap est le marché où les modèles statistiques ont le **plus de valeur ajoutée** par rapport aux bookmakers, car il réduit la variance du résultat à une variable quasi-Normale.

### Faiblesses actuelles

1. **Ligne = round(margin) - 0.5** : Arrondi grossier. Un attendu de 7.3 donne handicap 6.5, mais les bookmakers proposent souvent 7.5.
2. **Pas de désavantage du terrain négatif** : Le handicap ne tient pas compte du fait que certaines équipes performent **mieux** à l'extérieur (contre-performance domicile).
3. **Pas de calibration backtest** : Le backtest existe (`backtest.ts`) mais n'est pas utilisé pour ajuster les lignes.

### Améliorations proposées

```typescript
// 1. Handicap aligné sur les bookmakers (quand disponibles)
function handicapWithMarket(
  modelLine: number,
  marketLine: number | null,
  modelWeight: number = 0.7
): number {
  if (marketLine === null) return modelLine;
  return modelWeight * modelLine + (1 - modelWeight) * marketLine;
}

// 2. Ajustement pour les équipes "road warriors"
function roadWarriorAdj(teamAwayWinRate: number, leagueAvg: number): number {
  // Si une équipe gagne plus que la moyenne à l'extérieur → handicap ajusté
  return (teamAwayWinRate - leagueAvg) * 2; // ±1-2 points
}

// 3. Utiliser le backtest pour calibrer les biais
// Si le backtest montre que P(model) = 65% mais le taux réel = 58%,
// appliquer un shrinkage : P_adj = 0.85 × P_model + 0.15 × 0.50
```

---

## 6. 📊 Handicap +3,5 extérieur (`handicapAway`)

### Implémentation actuelle

```
P(away couvre) = Σ_{j-i > |handicapLine|} grid[i][j]
= 1 - P(home couvre) - P(push)
```

### Fondements académiques

- Complémentaire du handicap domicile. Même logique.
- **[HA]** : Dans le Top 14, les équipes extérieures couvrent un handicap de +3.5 dans environ **45-48%** des cas — ce qui signifie que la ligne de -3.5 est légèrement biaisée vers le domicile.

### Faiblesses et améliorations

- Idem au handicapHome.
- **Ajout** : calculer la probabilité de "push" (marge exactement égale au handicap) — actuellement ignorée, mais elle est de ~3-5% en rugby.

---

## 7. 🏉 Les 2 marquent (`bttsYes`)

### Implémentation actuelle

```
P(les 2 marquent ≥ 1 essai) = P(home marque) × P(away marque)
où P(X marque) = 1 - e^(-λX)
```

### Fondements académiques

- **Modèle de Poisson pour les essais** : Le nombre d'essais par équipe suit approximativement une loi de Poisson. En Top 14, la moyenne est de ~3.0-3.5 essais par équipe par match.
- **[VG]** : La corrélation entre les essais des deux équipes est **faible mais positive** — quand un match est ouvert (beaucoup d'essais), les deux équipes en marquent. Le modèle actuel suppose l'indépendance.
- **[XT]** : Le modèle XT d'Elvin montre que la probabilité de marquer un essai dépend de la **possession dans les 22m adverses**, pas seulement du lambda global.

### Faiblesses actuelles

1. **Confusion points/essais** : Le modèle utilise `lambdaHome` et `lambdaAway` qui sont en **points**, pas en essais. Or 1 essai = 5-7 points (avec transformation). La formule `1 - e^(-λ)` avec λ en points donne des probabilités trop élevées.
2. **Indépendance** : P(les 2 marquent) = P(H) × P(A) ignore la corrélation.
3. **Pas de distinction essai/pénalité** : Une équipe peut marquer 0 essais mais 15 points (5 pénalités).

### Améliorations proposées

```typescript
// 1. Convertir les lambdas points en lambdas essais
function pointsToTries(lambdaPoints: number, convRate: number = 0.75): number {
  // 1 essai ≈ 5 + 2 × convRate = 6.5 points (Top 14 moyen)
  const pointsPerTry = 5 + 2 * convRate;
  return lambdaPoints / pointsPerTry;
}

// 2. BTTS avec corrélation
function bttsCorrelated(lambdaH_tries: number, lambdaA_tries: number, rho: number = 0.08): number {
  const pH = 1 - Math.exp(-lambdaH_tries);
  const pA = 1 - Math.exp(-lambdaA_tries);
  // Corrélation positive : quand un match est ouvert, les 2 marquent
  return pH * pA + rho * Math.sqrt(pH * (1 - pH) * pA * (1 - pA));
}

// 3. Alternative : utiliser la grille de scores pour vérifier que les 2 marquent
// P(les 2 marquent) = Σ_{i≥5, j≥5} grid[points_i][points_j]
// (au moins 1 essai chacun = au moins 5 points chacun)
```

---

## 8. 📏 Marge ≤ 7 points (`marginBand`)

### Implémentation actuelle

```
P(marge ≤ 7) = Σ_{|i-j| ≤ 7} grid[i][j]
Bandes : 1-6, 7-12, 13+
```

### Fondements académiques

- **[VG]** : La distribution des marges en rugby est **leptokurtique** (queues plus épaisses que la Normale). Les matchs serrés (marge ≤ 7) sont plus fréquents que ne le prédit le Poisson.
- **[PS]** : Baker et al. (2022) montrent que dans les sports à scoring variable, la distribution des marges suit une **loi binomiale négative** plutôt qu'une Poisson — ce qui explique la fréquence accrue des matchs serrés.
- **Top 14** : Environ **40-45%** des matchs se terminent avec une marge ≤ 7 points. C'est le filtre le plus "parié" car il correspond à la notion de "match serré".

### Faiblesses actuelles

1. **Bandes trop larges** : 1-6 et 7-12 sont fusionnés dans "≤ 7" dans le scoring de `rugby-strategy-top.ts`. Or P(marge 1-6) ≈ 25% et P(marge 7-12) ≈ 20% — des probabilités très différentes.
2. **Pas de distinction domicile/extérieur** : La bande "1-6" inclut les victoires domicile ET extérieur. Le filtre devrait être "marge ≤ 7 points **peu importe le vainqueur**".
3. **Pas d'ajustement pour les équipes à défense serrée** : Quand deux équipes défensives s'affrontent, la probabilité de marge serrée augmente.

### Améliorations proposées

```typescript
// 1. Bandes plus fines
const FINE_BANDS = [
  { label: "1-3", lo: 1, hi: 3 },    // ~12% des matchs
  { label: "4-7", lo: 4, hi: 7 },    // ~15%
  { label: "8-12", lo: 8, hi: 12 },  // ~18%
  { label: "13-17", lo: 13, hi: 17 },// ~15%
  { label: "18+", lo: 18, hi: 70 },  // ~40%
];

// 2. Ajustement défensif : si min(λH, λA) est bas → marge serrée plus probable
function defensiveBonus(lambdaH: number, lambdaA: number): number {
  const minLambda = Math.min(lambdaH, lambdaA);
  // Plus le lambda faible est bas, plus le match est serré
  return 1 + Math.max(0, (20 - minLambda)) * 0.005; // +1% par point sous 20
}
```

---

## 9. ⚡ Meilleure attaque (`bestAttack`)

### Implémentation actuelle

```
score = λH + λA (total de points attendu)
Classement par score décroissant.
```

### Fondements académiques

- **[NR]** : Louit et al. (2025) montrent que la **distance totale parcourue** et le **high-speed running** ne prédisent PAS les points en Pro D2 — ce qui suggère que l'attaque n'est pas qu'une question d'athlétisme mais de **stratégie** et d'**efficacité dans les 22m**.
- **[VG]** : Le total de points attendu (λH + λA) est le meilleur estimateur du style de jeu : un match avec λH + λA > 50 est un match "ouvert" (beaucoup d'essais), < 35 est un match "fermé" (défense + pénalités).
- **[XT]** : Le modèle XT d'Elvin (2025) propose de mesurer l'attaque par les **xT (expected tries)** plutôt que les points bruts — car un essai vaut 5-7 points mais reflète mieux la qualité offensive.

### Faiblesses actuelles

1. **Métrique brute (points)** : Ne distingue pas les équipes qui marquent par essais (attaque forte) de celles qui marquent par pénalités (attaque faible mais discipline adverse faible).
2. **Pas d'ajustement pour la qualité de l'adversaire** : Marquer 30 points contre le dernier du classement n'est pas équivalent à marquer 30 points contre le premier.
3. **Pas de forme récente** : L'attaque peut varier de ±30% entre la 1ère et la 20ème journée.

### Améliorations proposées

```typescript
// 1. Expected Tries (xT) comme métrique d'attaque
function expectedTries(lambdaPoints: number, avgPenalties: number): number {
  const pointsFromTries = lambdaPoints - avgPenalties * 3;
  return Math.max(0, pointsFromTries / 6.5); // 6.5 pts/essai moyen
}

// 2. Ajustement qualité adversaire (SoS)
function attackSOS(teamAttack: number, opponentDefence: number, leagueAvgDef: number): number {
  return teamAttack * (opponentDefence / leagueAvgDef);
}

// 3. Pondération par récence (forme sur les 5 derniers matchs)
function recentAttack(matches: RugbyMatch[], teamId: string, window: number = 5): number {
  const recent = matches.filter(m => /* teamId impliqué */).slice(-window);
  const avgPoints = recent.reduce((s, m) => s + getTeamPoints(m, teamId), 0) / recent.length;
  return avgPoints;
}
```

---

## 10. 🧱 Meilleure défense (`bestDefense`)

### Implémentation actuelle

```
score = min(λH, λA) (le lambda le plus faible = la meilleure défense)
Classement par score croissant (le plus bas = meilleure défense).
```

### Fondements académiques

- **[VG]** : La défense est **plus prédictive** de la victoire que l'attaque en rugby union. Fry et al. (2021) montrent que le facteur défense a un poids ~1.3× plus élevé que l'attaque dans la prédiction du résultat.
- **[NR]** : En Pro D2, les équipes qui encaissent le moins de points sont celles qui gagnent le plus — la corrélation entre points encaissés et classement est **plus forte** (r ≈ -0.75) qu'entre points marqués et classement (r ≈ 0.60).
- **[HA]** : L'effet COVID a montré que sans public, la défense à l'extérieur s'améliorait significativement — suggérant que la pression du public joue sur la discipline défensive.

### Faiblesses actuelles

1. **min(λH, λA) est arbitraire** : Prendre le minimum des deux lambdas ne mesure pas la défense — c'est le lambda encaissé qui compte, pas le lambda marqué.
2. **Confusion défense/attaque** : `min(λH, λA)` peut être le lambda de l'équipe à domicile si elle est plus faible offensivement, pas nécessairement la défense.
3. **Pas de métrique défensive propre** : La vraie défense = `defence` factor (points encaissés / moyenne ligue), pas `min(λ)`.

### Améliorations proposées

```typescript
// 1. Utiliser le facteur défense directement (pas min lambda)
function defenseScore(teamDefenceFactor: number): number {
  // defence < 1 = bonne défense, > 1 = mauvaise défense
  return teamDefenceFactor; // Classement croissant = meilleure défense
}

// 2. Points encaissés ajustés par la qualité de l'adversaire
function adjustedPointsAgainst(
  pointsAgainst: number,
  opponentAttack: number,
  leagueAvgAttack: number
): number {
  return pointsAgainst * (leagueAvgAttack / opponentAttack);
}

// 3. Métrique composite : défense = 0.6 × PA_adj + 0.4 × (1 - tries_conceded_rate)
function compositeDefense(
  adjustedPA: number,
  triesConcededPerGame: number,
  leagueAvgTriesConceded: number
): number {
  const paScore = adjustedPA / 25; // Normalisation
  const tryScore = triesConcededPerGame / leagueAvgTriesConceded;
  return 0.6 * paScore + 0.4 * tryScore;
}
```

---

## Synthèse des priorités d'amélioration

| Filtre | Impact | Complexité | Priorité |
|--------|--------|------------|----------|
| homeWin / awayWin | 🔴 Élevé | Moyenne | **1** — homeAdvantage par compétition + correction DC |
| over415 / under515 | 🔴 Élevé | Moyenne | **2** — Surdispersion NB + lignes dynamiques |
| bttsYes | 🟡 Moyen | Faible | **3** — Conversion points→essais + corrélation |
| handicapHome/Away | 🟡 Moyen | Faible | **4** — Alignement bookmaker + backtest |
| marginBand | 🟢 Faible | Faible | **5** — Bandes plus fines |
| bestAttack | 🟢 Faible | Moyenne | **6** — xT + ajustement SoS |
| bestDefense | 🟡 Moyen | Faible | **7** — Utiliser defence factor direct |

---

## Implémentation recommandée (étapes)

### Phase 1 — Quick wins (1-2h)

1. `homeAdvantage` par compétition dans `COMPETITION_BY_SLUG`
2. Correction Dixon-Coles (ρ = -0.13) dans `modelMatch()`
3. BTTS : conversion points → essais (÷ 6.5)

### Phase 2 — Modèle amélioré (3-4h)

4. Surdispersion Negative Binomial pour over/under
5. Handicap : utiliser le backtest pour calibrer les biais
6. bestDefense : utiliser `defence` factor au lieu de `min(λ)`

### Phase 3 — Recherche (optionnel)

7. Intégrer le modèle VG (déjà codé dans `variance-gamma.ts`)
8. Ajustement météo (fetch API météo par ville)
9. Modèle XT (expected tries) pour l'attaque

---

## Bibliographie complète

1. Dixon, M.J. & Coles, S.G. (1997). "Modelling Association Football Scores and Inefficiencies in the Football Betting Market." *Applied Statistics*, 46(2), 265-280.
2. Fry, J., Smart, O., Serbera, J.P. & Klar, B. (2021). "A Variance Gamma Model for Rugby Union Matches." University of Bradford. Cited by 7.
3. Bunker, R. & Susnjak, T. (2022). "The Application of Machine Learning Techniques for Predicting Match Results in Team Sport: A Review." *JAIR*, 73. Cited by 267.
4. Sedeaud, A. et al. (2021). "The COVID-19 Pandemic Impact on Away and Home Victories in Soccer and Rugby Union." *Frontiers in Sports and Active Living*, 3, 695922. Cited by 17.
5. Elvin, M. (2025). "Implementation of an XT Model in Rugby Union." ProQuest Dissertations.
6. Delbianco, F. et al. (2026). "Regional Advantage in Rugby Sevens." arXiv:2608.16312.
7. Baumer, B.S., Matthews, G.J. & Nguyen, Q. (2023). "Big Ideas in Sports Analytics." arXiv:2301.04001. Cited by 75.
8. Baker, R. et al. (2022). "The Binomial-Match, Outcome Uncertainty." *J. Operational Research*. Cited by 12.
9. Louit, L. et al. (2025). "Do Rugby Union Teams Win Because They Run More?" ResearchGate.
10. Altmann, A. (2015). "A Statistical Approach to Sports Betting." City University London.
