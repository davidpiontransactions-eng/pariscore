# Rapport — Reproduction des stats H2H basketballstats.net sur l'onglet NBA & WNBA de PariScore

**Date du snapshot** : 2026-08-14
**Page analysée** : https://basketballstats.net/h2h/atlanta-vs-connecticut-women-19748
**Match** : Connecticut Sun vs Atlanta Dream — WNBA, Fri Aug 14 2026 00:00 (Europe/London)
**Méthode** : extraction complète de la page (markdown dump conservé dans `C:\Users\David\.local\share\opencode\tool-output\tool_000633e88001gypSCilUUtzMaY`)

---

## 1. Objectif

Reproduire sur l'onglet **NBA & WNBA** de PariScore l'ensemble des données et métriques affichées par
basketballstats.net sur ses pages **H2H** (Head to Head). Ce document est un **cahier des charges de
reproduction** : inventaire complet des sections, valeurs exactes du snapshot (servant de référence dorée
pour valider nos calculs), formules de calcul, données requises, et pistes d'implémentation.

---

## 2. Structure URL & navigation du site source

| Élément | Pattern |
|---|---|
| Page H2H | `https://basketballstats.net/h2h/{home-slug}-vs-{away-slug}-women-{id}` (ex. `atlanta-vs-connecticut-women-19748`) |
| Page équipe | `/teams/{team-slug}` (ex. `/teams/connecticut-women`, `/teams/atlanta-dream`) |
| Page joueur | `/players/{player-slug}` (ex. `/players/miller-diamond`) |
| Ligues | `/leagues/nba`, `/leagues/wnba` |
| Logos | `https://cdn.basketballstats.net/img/teams/{slug}.png`, `https://cdn.basketballstats.net/img/players/{slug}.png` |

Note : le suffixe `-women` apparaît pour la WNBA. L'ordre des slugs = ordre affiché (Connecticut first = home).
L'ID `19748` est l'identifiant interne du match.

---

## 3. Inventaire complet des sections de la page

Ordre exact du haut vers le bas :

1. **En-tête match** : breadcrumb (WNBA › Head to Head), badges de forme, 6 derniers résultats, date/heure
2. **Tabs** : `H2H Stats` · `H2H Matches` · `Players`
3. **Head-to-Head Stats** : split de victoires + tableau de 8 data points
4. **Bloc équipe 1 (Connecticut Sun)** : Form / Results / Net Rating + Stats Overall/Home/Away
5. **Bloc équipe 2 (Atlanta Dream)** : idem
6. **Team Points - Over Stats** (70.5 → 130.5, pas de 1 pt, en 2 volets)
7. **Team Points By Quarters (Q1, Q2, Q3, Q4)** — 4 tableaux Over par quartier
8. **Team Points By Half** (1st Half Q1+Q2, 2nd Half Q3+Q4)
9. **Point Spread O/U** (Positive Spread, Negative Spread)
10. **Match Points - Over Stats** (Over 211.5-250.5 et Over 171.5-210.5, en 2 volets)
11. **BTTS Points (FT / Halves)** : BTTS Over FT, BTTS Over 1H, BTTS Over 2H
12. **BTTS Points (Quarters)** : BTTS 1Q, 2Q, 3Q, 4Q
13. **Players - General Performance** (Plus/Minus, Rating)
14. **Players - Points Per Game** (PPG, Threes Made)
15. **Players - Rebounds** (Rebounds, Offensive, Defensive)
16. **Players - Field Goals (Shot Efficiency)** (FG, %)
17. **Players - Assists, Blocks & Steals** (Assists, Blocks, Steals)
18. **H2H Matches** : tabs « Current Season » / « All Matches », liste chronologique des confrontations
19. **Effectifs** : « Connecticut Sun Players », « Atlanta Dream Players » (Pos, Form, photo)
20. **Classement WNBA 2026** (15 équipes)

---

## 4. Valeurs exactes du snapshot (référence dorée)

### 4.1 En-tête match

| Élément | Connecticut Sun | Atlanta Dream |
|---|---|---|
| Badge forme | `-10.4 Very Bad Form` | `Unplayable Form +6.8` |
| Forme (6 derniers) | L W L L L L | W W L W L W |
| Win % H2H | **45.59%** (31 victoires) | **54.41%** (37 victoires) |
| Libellé verdict | « Atlanta Dream has won more games than Connecticut Sun. » | |

> Hypothèse : le badge affiche le **Net Rating home** pour l'équipe à domicile (CT : -10.4 = Net Rating Home)
> et le **Net Rating away** pour l'équipe extérieure (ATL : +6.8 = Net Rating Away). À confirmer en cross-checkant
> des matchs avec inversion domicile/extérieur.

### 4.2 Head-to-Head Stats (tableau « Data Point »)

| Data Point | Connecticut | Atlanta |
|---|---|---|
| Wins | 31 | 37 |
| Points Per Game | 79.47 | 79.07 |
| Offensive Rating | 84.67 | 84.67 |
| Defensive Rating | 84.24 | 85.1 |
| Point Spread | 0.4 | -0.4 |
| Assists Per Game | 57.35 | 53.47 |
| Rebounds Per Game | 119.07 | 118.76 |
| 3 Points FG % | 31.21% | 30.59% |

> ⚠️ **Points à valider** :
> - `Wins` = 31 + 37 = 68 confrontations → Win % calculé sur 68 matchs (liste 4.18 ≈ 68 entrées ✓).
> - `Points Per Game` = moyenne des points marqués **sur les seuls matchs H2H** (CT 79.47 ≠ 79.3 saison → cohérent avec un échantillon H2H).
> - `Point Spread` = **différence de PPG** (79.47 − 79.07 = +0.4 pour CT, -0.4 pour ATL). Formule simple et vérifiée.
> - `Offensive Rating` : les deux équipes affichent exactement 84.67 → valeur suspecte (probable bug site, ou rating sur possessions H2H). Ne pas reproduire tel quel sans validation.
> - `Assists Per Game` (57.35 / 53.47) et `Rebounds Per Game` (119.07 / 118.76) : **invraisemblables en per-game** (~19 assists, ~35 rebonds/équipe en WNBA). Base de calcul inconnue (cumul ? per-100-possessions ×3 ?). **À investiguer** avant reproduction.

### 4.3 Blocs équipe — Stats saison (Overall / Home / Away)

**Connecticut Sun**

| Metric | Overall | Home | Away |
|---|---|---|---|
| Net Rating | -16.1 | -10.4 | -21.8 |
| Win % | 25% | 31.3% | 18.8% |
| Spread | -16.06 | -10.38 | -21.75 |
| PPG | 79.3 | 80.2 | 78.5 |
| PAPG | 87.4 | 85.4 | 89.4 |
| FG% | 42.5% | 42.5% | 42.6% |
| 1h Lead | 46.9% | 50% | 43.8% |
| Pace | 82.09 | 81.72 | 82.47 |
| Offence R | 96.55 | 96.51 | 96.58 |
| Defence R | 106.34 | 106.29 | 106.37 |
| Form | L W L L L L | | |
| Results | L W L L L | | |
| Net Rating par forme | -16.1 / -10.4 / -21.8 | | |

**Atlanta Dream**

| Metric | Overall | Home | Away |
|---|---|---|---|
| Net Rating | +9.1 | +11.3 | +6.8 |
| Win % | 63.6% | 70.6% | 56.3% |
| Spread | 9.09 | 11.29 | 6.75 |
| PPG | 90 | 93.8 | 86 |
| PAPG | 85.5 | 88.2 | 82.6 |
| FG% | 43.3% | 45% | 41.6% |
| 1h Lead | 51.5% | 58.8% | 43.8% |
| Pace | 83.23 | 84.33 | 82.06 |
| Offence R | 107.47 | 106.41 | 108.61 |
| Defence R | 102.04 | 101.04 | 103.12 |
| Form | W W L W L W | | |
| Results | W W L W L | | |

> **Formules identifiées** :
> - `Win %` = victoires / matchs de la saison (échantillon : CT 8-24 → 25% ✓, ATL 21-12 → 63.6% ✓ — cf. classement §4.19).
> - `Net Rating` = **moyenne des spreads** (identique à la ligne Spread, arrondi à 1 décimale : -16.06 → -16.1 ✓, 9.09 → 9.1 ✓, home -10.38 → -10.4 ✓, away -21.75 → -21.8 ✓, +11.29 → 11.3 ✓, 6.75 → 6.8 ✓). Attention : ≠ marge moyenne (CT : 79.3−87.4 = -8.1 ≠ -16.1). Le « spread » du site n'est donc **pas** la marge réelle — probablement la marge vs. ligne de bookmaker, ou un spread « attendu » interne. **À investiguer** (voir §6).
> - `1h Lead` = % de matchs où l'équipe mène à la mi-temps (Q1+Q2).
> - `Pace` = possessions par match (~82-83 en WNBA, cohérent).
> - `Offence R` / `Defence R` = offensive / defensive rating par 100 possessions (saison).
> - `Form` = résultats des 6 derniers matchs ; `Results` = 5 derniers (site).

### 4.4 Team Points — Over Stats (points marqués par l'équipe)

Colonnes : seuil (Over X.5) | Connecticut % | Atlanta %. Formule : **% de matchs (saison) où l'équipe a marqué plus de X points**.

Moyenne affichée : `Average PPG` = CT 79.3, ATL 90.

| Over | CT | ATL | Over | CT | ATL |
|---|---|---|---|---|---|
| 70.5 | 71.9% | 97% | 85.5 | 28.1% | 63.6% |
| 71.5 | 71.9% | 93.9% | 86.5 | 28.1% | 57.6% |
| 72.5 | 71.9% | 93.9% | 87.5 | 28.1% | 54.5% |
| 73.5 | 71.9% | 93.9% | 88.5 | 21.9% | 54.5% |
| 74.5 | 71.9% | 90.9% | 89.5 | 21.9% | 51.5% |
| 75.5 | 59.4% | 87.9% | 90.5 | 15.6% | 45.5% |
| 76.5 | 59.4% | 84.8% | 91.5 | 15.6% | 39.4% |
| 77.5 | 59.4% | 81.8% | 92.5 | 12.5% | 36.4% |
| 78.5 | 59.4% | 81.8% | 93.5 | 12.5% | 33.3% |
| 79.5 | 59.4% | 81.8% | 94.5 | 9.4% | 30.3% |
| 80.5 | 46.9% | 81.8% | 95.5 | 9.4% | 30.3% |
| 81.5 | 43.8% | 78.8% | 96.5 | 6.3% | 27.3% |
| 82.5 | 37.5% | 69.7% | 97.5 | 3.1% | 27.3% |
| 83.5 | 34.4% | 66.7% | 98.5 | 3.1% | 24.2% |
| 84.5 | 28.1% | 63.6% | 99.5 | 3.1% | 24.2% |
| | | | 100.5 | 3.1% | 24.2% |

Volet 2 (Over 101.5 → 130.5) :

| Over | CT | ATL | Over | CT | ATL |
|---|---|---|---|---|---|
| 101.5 | 3.1% | 21.2% | 116.5 | 0% | 0% |
| 102.5 | 0% | 18.2% | 117.5 | 0% | 0% |
| 103.5 | 0% | 18.2% | 118.5 | 0% | 0% |
| 104.5 | 0% | 15.2% | 119.5 | 0% | 0% |
| 105.5 | 0% | 15.2% | 120.5 | 0% | 0% |
| 106.5 | 0% | 15.2% | 121.5 | 0% | 0% |
| 107.5 | 0% | 12.1% | 122.5 | 0% | 0% |
| 108.5 | 0% | 9.1% | 123.5 | 0% | 0% |
| 109.5 | 0% | 6.1% | 124.5 | 0% | 0% |
| 110.5 | 0% | 6.1% | 125.5 | 0% | 0% |
| 111.5 | 0% | 3% | 126.5 | 0% | 0% |
| 112.5 | 0% | 3% | 127.5 | 0% | 0% |
| 113.5 | 0% | 0% | 128.5 | 0% | 0% |
| 114.5 | 0% | 0% | 129.5 | 0% | 0% |
| 115.5 | 0% | 0% | 130.5 | 0% | 0% |

### 4.5 Team Points By Quarters

Structure par quartier : `Average Points` + seuils Over 19.5 → 35.5 (pas de 1 pt).

| Quartier | Average CT | Average ATL |
|---|---|---|
| Q1 | 21.7 | 21.6 |
| Q2 | 19.2 | 22.1 |
| Q3 | 19.4 | 22.1 |
| Q4 | 18.9 | 24.3 |

**Q1** (Over : CT / ATL) : 19.5→62.5/57.6 · 20.5→53.1/57.6 · 21.5→50/54.5 · 22.5→43.8/48.5 · 23.5→43.8/39.4 · 24.5→34.4/27.3 · 25.5→25/24.2 · 26.5→15.6/24.2 · 27.5→15.6/21.2 · 28.5→15.6/15.2 · 29.5→9.4/12.1 · 30.5→9.4/9.1 · 31.5→6.3/6.1 · 32.5→3.1/6.1 · 33.5→0/0 · 34.5→0/0 · 35.5→0/0

**Q2** (Over : CT / ATL) : 19.5→53.1/66.7 · 20.5→46.9/63.6 · 21.5→34.4/51.5 · 22.5→34.4/48.5 · 23.5→28.1/42.4 · 24.5→18.8/39.4 · 25.5→12.5/27.3 · 26.5→6.3/12.1 · 27.5→6.3/12.1 · 28.5→3.1/12.1 · 29.5→3.1/12.1 · 30.5→3.1/9.1 · 31.5→0/9.1 · 32.5→0/9.1 · 33.5→0/9.1 · 34.5→0/0 · 35.5→0/0

**Q3** (Over : CT / ATL) : 19.5→50/63.6 · 20.5→46.9/51.5 · 21.5→43.8/48.5 · 22.5→25/42.4 · 23.5→9.4/39.4 · 24.5→6.3/30.3 · 25.5→6.3/30.3 · 26.5→6.3/24.2 · 27.5→3.1/18.2 · 28.5→3.1/15.2 · 29.5→0/9.1 · 30.5→0/6.1 · 31.5→0/3 · 32.5→0/0 · 33.5→0/0 · 34.5→0/0 · 35.5→0/0

**Q4** (Over : CT / ATL) : 19.5→46.9/78.8 · 20.5→37.5/72.7 · 21.5→31.3/66.7 · 22.5→18.8/66.7 · 23.5→6.3/57.6 · 24.5→3.1/51.5 · 25.5→3.1/42.4 · 26.5→0/36.4 · 27.5→0/30.3 · 28.5→0/24.2 · 29.5→0/21.2 · 30.5→0/18.2 · 31.5→0/12.1 · 32.5→0/6.1 · 33.5→0/3 · 34.5→0/0 · 35.5→0/0

### 4.6 Team Points By Half

| Moitié | Average CT | Average ATL | Vérification |
|---|---|---|---|
| 1st Half (Q1+Q2) | 40.8 | 43.7 | 21.7+19.2=40.9 ✓ / 21.6+22.1=43.7 ✓ |
| 2nd Half (Q3+Q4) | 38.3 | 46.4 | 19.4+18.9=38.3 ✓ / 22.1+24.3=46.4 ✓ |

**1H** (Over : CT / ATL), seuils 40.5 → 78.5 : 40.5→53.1/57.6 · 41.5→53.1/54.5 · 42.5→50/54.5 · 43.5→46.9/54.5 · 44.5→43.8/42.4 · 45.5→37.5/42.4 · 46.5→31.3/39.4 · 47.5→28.1/33.3 · 48.5→25/30.3 · 49.5→15.6/27.3 · 50.5→9.4/24.2 · 51.5→9.4/21.2 · 52.5→9.4/21.2 · 53.5→9.4/21.2 · 54.5→3.1/15.2 · 55.5→3.1/12.1 · 56.5→3.1/9.1 · 57.5→0/9.1 · 58.5→0/6.1 · 59.5→0/0 puis 0% jusqu'à 78.5.

**2H** (Over : CT / ATL), seuils 40.5 → 78.5 : 40.5→31.3/78.8 · 41.5→31.3/75.8 · 42.5→21.9/63.6 · 43.5→18.8/60.6 · 44.5→18.8/51.5 · 45.5→9.4/48.5 · 46.5→9.4/45.5 · 47.5→6.3/45.5 · 48.5→6.3/36.4 · 49.5→6.3/33.3 · 50.5→3.1/27.3 · 51.5→3.1/21.2 · 52.5→0/21.2 · 53.5→0/15.2 · 54.5→0/12.1 · 55.5→0/9.1 · 56.5→0/9.1 · 57.5→0/6.1 · 58.5→0/6.1 · 59.5→0/6.1 · 60.5→0/6.1 · 61.5→0/6.1 · 62.5→0/6.1 · 63.5→0/0 puis 0% jusqu'à 78.5.

### 4.7 Point Spread O/U (distribution de la marge)

Formule identifiée : **Positive Spread `Over X.5` = % de matchs où la marge (pts marqués − pts encaissés) > X.5** ; **Negative Spread `Over -X.5` = % de matchs où la marge > -X.5** (i.e. l'équipe n'a pas perdu de plus de X points). Cohérence vérifiée : CT Over 0.5 = 25% = son win % ✓ ; ATL Over 0.5 = 63.6% = son win % ✓.

`Average Spread` affiché : CT **-16.06**, ATL **9.09** → ⚠️ ≠ marge moyenne réelle (CT -8.1, ATL +4.5). Valeur du site à ne pas copier ; la distribution (tableaux ci-dessous) est elle en revanche reproductible depuis les scores.

**Positive Spread** (Over : CT / ATL) : 0.5→25/63.6 · 1.5→21.9/57.6 · 2.5→18.8/51.5 · 3.5→9.4/51.5 · 4.5→9.4/51.5 · 5.5→9.4/48.5 · 6.5→9.4/48.5 · 7.5→9.4/39.4 · 8.5→9.4/39.4 · 9.5→9.4/33.3 · 10.5→9.4/33.3 · 11.5→6.3/30.3 · 12.5→6.3/27.3 · 13.5→3.1/27.3 · 14.5→3.1/24.2 · 15.5→3.1/24.2 · 16.5→3.1/21.2 · 17.5→3.1/15.2 · 18.5→3.1/15.2 · 19.5→3.1/12.1

**Negative Spread** (Over : CT / ATL) : -0.5→0/0 · -1.5→28.1/66.7 · -2.5→28.1/66.7 · -3.5→28.1/66.7 · -4.5→37.5/69.7 · -5.5→40.6/78.8 · -6.5→40.6/78.8 · -7.5→56.3/78.8 · -8.5→59.4/78.8 · -9.5→65.6/78.8 · -10.5→71.9/81.8 · -11.5→71.9/84.8 · -12.5→71.9/87.9 · -13.5→71.9/87.9 · -14.5→71.9/90.9 · -15.5→75/97 · -16.5→78.1/97 · -17.5→78.1/97 · -18.5→81.3/97 · -19.5→81.3/97

### 4.8 Match Points — Over Stats (total du match)

**Volet 1 — Over 211.5 → 250.5** : `Average PPG (Match)` CT 166.72 / ATL 175.52 / **171.12** (moyenne des deux).
Vérification : 79.34+87.38=166.72 ✓ (PPG + PAPG de CT) ; 90.03+85.49=175.52 ✓. **Tous les seuils 211.5→250.5 = 0%** (WNBA ne dépasse pas ce total).

**Volet 2 — Over 171.5 → 210.5** (Over : CT / ATL / Moyenne) : 171.5→34.4/54.5/44.5 · 172.5→34.4/54.5/44.5 · 173.5→31.3/51.5/41.4 · 174.5→31.3/51.5/41.4 · 175.5→31.3/51.5/41.4 · 176.5→28.1/51.5/39.8 · 177.5→25/48.5/36.8 · 178.5→25/45.5/35.3 · 179.5→18.8/42.4/30.6 · 180.5→18.8/42.4/30.6 · 181.5→15.6/36.4/26 · 182.5→12.5/36.4/24.5 · 183.5→12.5/36.4/24.5 · 184.5→12.5/33.3/22.9 · 185.5→12.5/33.3/22.9 · 186.5→12.5/30.3/21.4 · 187.5→12.5/27.3/19.9 · 188.5→12.5/27.3/19.9 · 189.5→12.5/27.3/19.9 · 190.5→12.5/27.3/19.9 · 191.5→12.5/27.3/19.9 · 192.5→12.5/27.3/19.9 · 193.5→12.5/24.2/18.4 · 194.5→12.5/18.2/15.4 · 195.5→9.4/15.2/12.3 · 196.5→9.4/12.1/10.8 · 197.5→9.4/12.1/10.8 · 198.5→6.3/12.1/9.2 · 199.5→6.3/12.1/9.2 · 200.5→6.3/12.1/9.2 · 201.5→6.3/12.1/9.2 · 202.5→6.3/9.1/7.7 · 203.5→6.3/6.1/6.2 · 204.5→6.3/6.1/6.2 · 205.5→6.3/6.1/6.2 · 206.5→6.3/6.1/6.2 · 207.5→6.3/6.1/6.2 · 208.5→3.1/6.1/4.6 · 209.5→3.1/0/1.6

> Formule : `Over X.5` = % de matchs de l'équipe où le **total du match** (équipe + adversaire) > X.5.
> La colonne « Moyenne » = moyenne des % des deux équipes (44.5 = (34.4+54.5)/2 ✓).

### 4.9 BTTS Points — FT / Halves / Quarters

Définition « BTTS » (Both Teams To Score, adapté basket) : % de matchs où le **total combiné des points des deux équipes** dépasse le seuil. Moyennes : `Points Scored Average (FT)` 79.34 / 90.03 / **84.69**.

**BTTS Over FT** (Over : CT / ATL / Moyenne) : 59.5→94/100/97 · 60.5→94/100/97 · 61.5→91/100/95.5 · 62.5→91/100/95.5 · 63.5→81/100/90.5 · 64.5→78/100/89 · 65.5→78/100/89 · 66.5→78/94/86 · 67.5→78/94/86 · 68.5→78/94/86 · 69.5→72/88/80 · 70.5→69/88/78.5 · 71.5→69/85/77 · 72.5→66/82/74 · 73.5→66/82/74 · 74.5→66/79/72.5 · 75.5→56/70/63 · 76.5→56/67/61.5 · 77.5→56/61/58.5 · 78.5→53/58/55.5 · 79.5→53/58/55.5 · 80.5→44/55/49.5 · 81.5→38/48/43 · 82.5→31/45/38 · 83.5→25/42/33.5 · 84.5→22/39/30.5 · 85.5→22/39/30.5 · 86.5→22/39/30.5 · 87.5→19/33/26 · 88.5→13/33/23 · 89.5→9/30/19.5 · 90.5→9/21/15 · 91.5→9/18/13.5 · 92.5→9/9/9 · 93.5→9/9/9 · 94.5→6/9/7.5 · 95.5→6/6/6 · 96.5→6/3/4.5 · 97.5→3/3/3 · 98.5→3/3/3 · 99.5→3/3/3 · 100.5→3/3/3 · 101.5→3/0/1.5 puis 0% jusqu'à 129.5.

**BTTS Over 1H** — `Points Scored Average (1H)` 40.84 / 43.67 / 42.26. Seuils 29.5→90.5 : 29.5→84/94/89 · 30.5→78/91/84.5 · 31.5→78/85/81.5 · 32.5→72/73/72.5 · 33.5→69/70/69.5 · 34.5→69/64/66.5 · 35.5→63/61/62 · 36.5→59/61/60 · 37.5→44/52/48 · 38.5→38/42/40 · 39.5→38/30/34 · 40.5→31/30/30.5 · 41.5→25/27/26 · 42.5→25/27/26 · 43.5→22/27/24.5 · 44.5→13/18/15.5 · 45.5→13/18/15.5 · 46.5→6/18/12 · 47.5→6/12/9 · 48.5→6/9/7.5 · 49.5→3/3/3 · 50.5→3/3/3 · 51.5→3/3/3 · 52.5→3/3/3 · 53.5→3/3/3 · 54.5→0/3/1.5 · 55.5→0/3/1.5 puis 0%.

**BTTS Over 2H** — `Points Scored Average (2H)` 38.31 / 46.36 / 42.34. Seuils 29.5→90.5 : 29.5→91/97/94 · 30.5→88/97/92.5 · 31.5→81/94/87.5 · 32.5→75/94/84.5 · 33.5→69/88/78.5 · 34.5→63/82/72.5 · 35.5→56/70/63 · 36.5→56/67/61.5 · 37.5→50/58/54 · 38.5→47/48/47.5 · 39.5→38/48/43 · 40.5→25/45/35 · 41.5→25/45/35 · 42.5→16/39/27.5 · 43.5→16/33/24.5 · 44.5→16/27/21.5 · 45.5→9/24/16.5 · 46.5→9/18/13.5 · 47.5→3/18/10.5 · 48.5→3/15/9 · 49.5→3/12/7.5 · 50.5→3/9/6 · 51.5→3/3/3 · 52.5→0/3/1.5 puis 0%.

**BTTS Quarters** — moyennes :

| Quartier | Avg CT | Avg ATL | Avg | Seuils non-nuls (Over : CT / ATL / Moyenne) |
|---|---|---|---|---|
| 1Q | 21.69 | 21.58 | 21.64 | 17.5→66/55/60.5 · 18.5→56/52/54 · 19.5→50/39/44.5 · 20.5→41/33/37 · 21.5→38/30/34 · 22.5→31/21/26 · 23.5→25/12/18.5 · 24.5→13/3/8 · 25.5→13/3/8 · 26.5→6/3/4.5 · 27.5→6/3/4.5 · 28.5→6/3/4.5 · 29.5→3/3/3 · puis 0% |
| 2Q | 19.16 | 22.09 | 20.63 | 17.5→44/61/52.5 · 18.5→34/55/44.5 · 19.5→31/42/36.5 · 20.5→22/39/30.5 · 21.5→13/27/20 · 22.5→9/21/15 · 23.5→9/21/15 · 24.5→0/15/7.5 · 25.5→0/6/3 · 26.5→0/3/1.5 puis 0% |
| 3Q | 19.44 | 22.09 | 20.77 | 17.5→56/76/66 · 18.5→53/70/61.5 · 19.5→38/36/37 · 20.5→38/27/32.5 · 21.5→28/24/26 · 22.5→16/18/17 · 23.5→9/18/13.5 · 24.5→6/12/9 · 25.5→3/12/7.5 · 26.5→3/9/6 · 27.5→0/6/3 · 28.5→0/6/3 · 29.5→0/3/1.5 · 30.5→0/3/1.5 puis 0% |
| 4Q | 18.88 | 24.27 | 21.58 | 17.5→59/55/57 · 18.5→50/48/49 · 19.5→41/45/43 · 20.5→34/39/36.5 · 21.5→25/36/30.5 · 22.5→16/33/24.5 · 23.5→3/27/15 · 24.5→0/18/9 · 25.5→0/12/6 · 26.5→0/9/4.5 · 27.5→0/6/3 · 28.5→0/6/3 · 29.5→0/6/3 puis 0% |

> ⚠️ Le nom de section interne « BTTS Over 4Q » du site affiche les données de 3Q (copier-coller de leur côté) ; les valeurs 4Q sont dans la sous-section suivante (utiliser les moyennes/colonnes ci-dessus, vérifiées cohérentes : 1Q+2Q+3Q+4Q = 21.69+19.16+19.44+18.88 = 79.17 ≈ 79.34 FT ✓).

### 4.10 Players — General Performance (Plus/Minus & Rating)

Deux tableaux (mêmes 14-15 paires de joueurs, classés différemment). Format : joueur CT ↔ valeur CT · valeur ATL ↔ joueur ATL. Colonnes : **Plus/Minus** puis **Rating** (formule du Rating non documentée — composite propriétaire).

Plus/Minus (CT / ATL) : Nell Angloma -0.82 · Allisha Gray — ; Raegan Beers -1.27 · Jordin Canada — ; Olivia Nelson-Ododa -2.25 · Naz Hillmon — ; Gianna Kneepkens -2.50 · Angel Reese — ; Kennedy Burke -2.81 · Rhyne Howard — ; Brittney Griner -3.56 · Brionna Jones — ; Hailey Van Lith -4.00 · Aaliyah Nye — ; Charlisse Leger-Walker -4.44 · Indya Nivar — ; Aaliyah Edwards -4.86 · Isobel Borlase — ; Diamond Miller -5.19 · Amy Okonkwo — ; Leila Lacan -5.26 · Jaylyn Sherrod — ; Ashlon Jackson -6.00 · Sika Kone — ; Saniya Rivers -6.00 · Shatori Walker-Kimbrough — ; Aneesah Morrow -6.90 · Madina Okot — ; Rayah Marshall -7.50 · Te-Hina Paopao —

Rating (CT / ATL) : Brittney Griner 7.20 · Rhyne Howard 7.54 — ; Olivia Nelson-Ododa 7.00 · Jordin Canada 7.53 — ; Leila Lacan 6.91 · Allisha Gray 7.38 — ; Aneesah Morrow 6.89 · Angel Reese 7.26 — ; Aaliyah Edwards 6.75 · Brionna Jones 7.01 — ; Hailey Van Lith 6.69 · Shatori Walker-Kimbrough 7.00 — ; Kennedy Burke 6.68 · Aaliyah Nye 6.90 — ; Charlisse Leger-Walker 6.53 · Naz Hillmon 6.77 — ; Gianna Kneepkens 6.41 · Jaylyn Sherrod 6.54 — ; Saniya Rivers 6.38 · Madina Okot 6.48 — ; Nell Angloma 6.35 · Isobel Borlase 6.25 — ; Diamond Miller 6.31 · Te-Hina Paopao 6.17 — ; Ashlon Jackson 6.22 · Indya Nivar 6.07 — ; Raegan Beers 6.20 · Sika Kone 5.95 — ; Rayah Marshall 4.80 · Amy Okonkwo 0.00 —

### 4.11 Players — Points Per Game (PPG & Threes Made)

PPG (CT / ATL) : Brittney Griner 13.22 · Allisha Gray 19.24 — ; Leila Lacan 11.87 · Rhyne Howard 17.78 — ; Aneesah Morrow 11.55 · Angel Reese 15.59 — ; Aaliyah Edwards 9.86 · Jordin Canada 11.45 — ; Olivia Nelson-Ododa 9.50 · Naz Hillmon 9.12 — ; Diamond Miller 9.22 · Brionna Jones 8.22 — ; Kennedy Burke 8.32 · Madina Okot 5.50 — ; Saniya Rivers 6.61 · Isobel Borlase 4.45 — ; Charlisse Leger-Walker 6.47 · Te-Hina Paopao 3.88 — ; Hailey Van Lith 6.07 · Jaylyn Sherrod 2.56 — ; Nell Angloma 3.75 · Sika Kone 1.71 — ; Raegan Beers 3.38 · Shatori Walker-Kimbrough 1.14 — ; Gianna Kneepkens 3.33 · Amy Okonkwo 1.00 — ; Ashlon Jackson 1.43 · Indya Nivar 0.85 — ; Rayah Marshall 0.50 · Aaliyah Nye 0.73 —

Threes Made (CT / ATL) : Kennedy Burke 1.23 · Rhyne Howard 3.31 — ; Diamond Miller 1.09 · Allisha Gray 1.70 — ; Leila Lacan 1.09 · Naz Hillmon 1.12 — ; Aneesah Morrow 0.95 · Te-Hina Paopao 0.92 — ; Charlisse Leger-Walker 0.75 · Jordin Canada 0.82 — ; Hailey Van Lith 0.64 · Isobel Borlase 0.45 — ; Gianna Kneepkens 0.38 · Jaylyn Sherrod 0.22 — ; Saniya Rivers 0.32 · Angel Reese 0.19 — ; Ashlon Jackson 0.29 · Sika Kone 0.14 — ; Aaliyah Edwards 0.18 · Aaliyah Nye 0.13 — ; Nell Angloma 0.11 · Brionna Jones 0.11 — ; Raegan Beers 0.08 · Indya Nivar 0.10 — ; Brittney Griner 0.06 · Madina Okot 0.03 — ; Olivia Nelson-Ododa 0.00 · Shatori Walker-Kimbrough 0.00 — ; Rayah Marshall 0.00 · Amy Okonkwo 0.00 —

### 4.12 Players — Rebounds (total / offensifs / défensifs)

Rebounds (CT / ATL) : Aneesah Morrow 8.90 · Angel Reese 12.00 — ; Olivia Nelson-Ododa 5.96 · Brionna Jones 5.56 — ; Brittney Griner 5.83 · Naz Hillmon 4.41 — ; Aaliyah Edwards 4.00 · Rhyne Howard 3.91 — ; Kennedy Burke 3.26 · Jordin Canada 3.70 — ; Raegan Beers 2.96 · Madina Okot 3.47 — ; Diamond Miller 2.47 · Allisha Gray 3.12 — ; Saniya Rivers 2.14 · Isobel Borlase 1.45 — ; Charlisse Leger-Walker 2.00 · Sika Kone 1.11 — ; Leila Lacan 2.00 · Amy Okonkwo 1.00 — ; Nell Angloma 1.54 · Te-Hina Paopao 0.92 — ; Gianna Kneepkens 1.12 · Indya Nivar 0.85 — ; Hailey Van Lith 1.00 · Jaylyn Sherrod 0.78 — ; Rayah Marshall 1.00 · Shatori Walker-Kimbrough 0.29 — ; Ashlon Jackson 0.86 · Aaliyah Nye 0.13 —

Offensive Rebounds (CT / ATL) : Aneesah Morrow 2.65 · Angel Reese 5.09 — ; Brittney Griner 1.94 · Brionna Jones 2.00 — ; Olivia Nelson-Ododa 1.61 · Naz Hillmon 1.41 — ; Aaliyah Edwards 1.32 · Madina Okot 1.19 — ; Raegan Beers 1.19 · Rhyne Howard 0.78 — ; Kennedy Burke 1.00 · Jordin Canada 0.76 — ; Rayah Marshall 1.00 · Allisha Gray 0.70 — ; Nell Angloma 0.71 · Sika Kone 0.50 — ; Leila Lacan 0.57 · Isobel Borlase 0.30 — ; Gianna Kneepkens 0.50 · Indya Nivar 0.20 — ; Diamond Miller 0.41 · Te-Hina Paopao 0.12 — ; Saniya Rivers 0.36 · Aaliyah Nye 0.00 — ; Charlisse Leger-Walker 0.19 · Jaylyn Sherrod 0.00 — ; Hailey Van Lith 0.14 · Shatori Walker-Kimbrough 0.00 — ; Ashlon Jackson 0.00 · Amy Okonkwo 0.00 —

Defensive Rebounds (CT / ATL) : Aneesah Morrow 6.25 · Angel Reese 6.91 — ; Olivia Nelson-Ododa 4.36 · Brionna Jones 3.56 — ; Brittney Griner 3.89 · Rhyne Howard 3.12 — ; Aaliyah Edwards 2.68 · Naz Hillmon 3.00 — ; Kennedy Burke 2.26 · Jordin Canada 2.94 — ; Diamond Miller 2.06 · Allisha Gray 2.42 — ; Charlisse Leger-Walker 1.81 · Madina Okot 2.28 — ; Saniya Rivers 1.79 · Isobel Borlase 1.15 — ; Raegan Beers 1.77 · Amy Okonkwo 1.00 — ; Leila Lacan 1.43 · Te-Hina Paopao 0.79 — ; Hailey Van Lith 0.86 · Jaylyn Sherrod 0.78 — ; Ashlon Jackson 0.86 · Indya Nivar 0.65 — ; Nell Angloma 0.82 · Sika Kone 0.61 — ; Gianna Kneepkens 0.62 · Shatori Walker-Kimbrough 0.29 — ; Rayah Marshall 0.00 · Aaliyah Nye 0.13 —

### 4.13 Players — Field Goals (Shot Efficiency)

Format : `X.X (FGM total / matchs)` = paniers marqués par match (total/matchs) ; puis `P% (FGM/FGA par match)` = efficacité.

Field goals (CT / ATL) : Leila Lacan 4.5 (103/23) · Allisha Gray 6.5 (214/33) — ; Olivia Nelson-Ododa 3.6 (100/28) · Rhyne Howard 5.7 (183/32) — ; Diamond Miller 3.0 (97/32) · Angel Reese 5.4 (173/32) — ; Brittney Griner 5.4 (97/18) · Jordin Canada 3.8 (124/33) — ; Aneesah Morrow 4.6 (91/20) · Naz Hillmon 3.4 (109/32) — ; Kennedy Burke 2.8 (86/31) · Madina Okot 2.2 (70/32) — ; Aaliyah Edwards 3.8 (84/22) · Isobel Borlase 1.7 (55/33) — ; Charlisse Leger-Walker 2.3 (74/32) · Te-Hina Paopao 1.3 (32/24) — ; Saniya Rivers 2.6 (72/28) · Brionna Jones 3.0 (27/9) — ; Nell Angloma 1.3 (36/28) · Sika Kone 0.5 (15/28) — ; Hailey Van Lith 2.4 (33/14) · Jaylyn Sherrod 0.8 (7/9) — ; Raegan Beers 1.2 (32/26) · Indya Nivar 0.4 (7/20) — ; Gianna Kneepkens 1.1 (27/24) · Aaliyah Nye 0.2 (3/15) — ; Ashlon Jackson 0.6 (4/7) · Shatori Walker-Kimbrough 0.3 (2/7) — ; Rayah Marshall 0.0 (0/2) · Amy Okonkwo 0.0 (0/1) —

Shots efficiency (CT / ATL) : Leila Lacan 44% (4.5/10.5) · Allisha Gray 46% (6.5/14.03) — ; Olivia Nelson-Ododa 58% (3.6/6.4) · Rhyne Howard 41% (5.7/13.91) — ; Diamond Miller 35% (3.0/8.3) · Angel Reese 42% (5.4/12.81) — ; Brittney Griner 52% (5.4/10.2) · Jordin Canada 42% (3.8/8.82) — ; Aneesah Morrow 45% (4.6/10.8) · Naz Hillmon 50% (3.4/7.12) — ; Kennedy Burke 38% (2.8/7.0) · Madina Okot 49% (2.2/3.78) — ; Aaliyah Edwards 51% (3.8/7.1) · Isobel Borlase 41% (1.7/4.00) — ; Charlisse Leger-Walker 36% (2.3/6.3) · Te-Hina Paopao 37% (1.3/3.88) — ; Saniya Rivers 34% (2.6/7.6) · Brionna Jones 50% (3.0/5.78) — ; Nell Angloma 33% (1.3/3.1) · Sika Kone 23% (0.5/1.79) — ; Hailey Van Lith 44% (2.4/5.1) · Jaylyn Sherrod 24% (0.8/2.44) — ; Raegan Beers 51% (1.2/2.6) · Indya Nivar 44% (0.4/0.90) — ; Gianna Kneepkens 41% (1.1/2.6) · Aaliyah Nye 37% (0.2/0.53) — ; Ashlon Jackson 22% (0.6/1.7) · Shatori Walker-Kimbrough 50% (0.3/0.57) — ; Rayah Marshall 0% (0.0/2.5) · Amy Okonkwo 0% (0.0/1.00) —

### 4.14 Players — Assists, Blocks & Steals

Assists (CT / ATL) : Leila Lacan 4.39 · Jordin Canada 7.48 — ; Charlisse Leger-Walker 3.34 · Rhyne Howard 3.62 — ; Saniya Rivers 3.11 · Angel Reese 2.41 — ; Brittney Griner 2.50 · Allisha Gray 2.36 — ; Hailey Van Lith 1.86 · Brionna Jones 2.00 — ; Olivia Nelson-Ododa 1.79 · Te-Hina Paopao 1.58 — ; Aneesah Morrow 1.65 · Naz Hillmon 1.53 — ; Kennedy Burke 1.45 · Jaylyn Sherrod 1.11 — ; Diamond Miller 1.38 · Isobel Borlase 0.91 — ; Aaliyah Edwards 0.86 · Indya Nivar 0.35 — ; Ashlon Jackson 0.86 · Shatori Walker-Kimbrough 0.29 — ; Raegan Beers 0.77 · Sika Kone 0.21 — ; Nell Angloma 0.61 · Aaliyah Nye 0.20 — ; Gianna Kneepkens 0.46 · Madina Okot 0.19 — ; Rayah Marshall 0.00 · Amy Okonkwo 0.00 —

Blocks (CT / ATL) : Brittney Griner 1.78 · Rhyne Howard 0.94 — ; Kennedy Burke 0.87 · Angel Reese 0.78 — ; Olivia Nelson-Ododa 0.86 · Brionna Jones 0.67 — ; Saniya Rivers 0.64 · Allisha Gray 0.42 — ; Aneesah Morrow 0.45 · Madina Okot 0.28 — ; Leila Lacan 0.39 · Naz Hillmon 0.25 — ; Aaliyah Edwards 0.36 · Jaylyn Sherrod 0.22 — ; Nell Angloma 0.29 · Jordin Canada 0.18 — ; Diamond Miller 0.22 · Isobel Borlase 0.12 — ; Hailey Van Lith 0.21 · Te-Hina Paopao 0.12 — ; Raegan Beers 0.12 · Indya Nivar 0.10 — ; Charlisse Leger-Walker 0.09 · Aaliyah Nye 0.07 — ; Gianna Kneepkens 0.04 · Sika Kone 0.00 — ; Ashlon Jackson 0.00 · Shatori Walker-Kimbrough 0.00 — ; Rayah Marshall 0.00 · Amy Okonkwo 0.00 —

Steals (CT / ATL) : Leila Lacan 1.78 · Rhyne Howard 2.38 — ; Kennedy Burke 1.03 · Jordin Canada 2.00 — ; Saniya Rivers 1.00 · Angel Reese 1.69 — ; Ashlon Jackson 1.00 · Allisha Gray 1.30 — ; Aneesah Morrow 0.95 · Naz Hillmon 0.69 — ; Charlisse Leger-Walker 0.88 · Jaylyn Sherrod 0.56 — ; Olivia Nelson-Ododa 0.82 · Brionna Jones 0.33 — ; Diamond Miller 0.78 · Madina Okot 0.25 — ; Aaliyah Edwards 0.68 · Indya Nivar 0.25 — ; Hailey Van Lith 0.64 · Isobel Borlase 0.21 — ; Brittney Griner 0.44 · Te-Hina Paopao 0.21 — ; Nell Angloma 0.43 · Shatori Walker-Kimbrough 0.14 — ; Raegan Beers 0.38 · Sika Kone 0.07 — ; Gianna Kneepkens 0.12 · Aaliyah Nye 0.07 — ; Rayah Marshall 0.00 · Amy Okonkwo 0.00 —

### 4.15 H2H Matches (liste complète)

Tab « Current Season » = 1 seul match : **Jun 3 2026 — WNBA 2026 : Atlanta Dream 91 - 75 Connecticut Sun**.

Tab « All Matches » (du plus récent au plus ancien, format `Date — Compétition : ÉquipeA score - score ÉquipeB`) :

| Date | Compétition | Résultat |
|---|---|---|
| Jun 3 2026 | WNBA 2026 | Atlanta Dream 91 - 75 Connecticut Sun |
| Sep 11 2025 | WNBA 2025 | Connecticut Sun 72 - 88 Atlanta Dream |
| Sep 9 2025 | WNBA 2025 | Atlanta Dream 87 - 62 Connecticut Sun |
| Sep 1 2025 | WNBA 2025 | Connecticut Sun 76 - 93 Atlanta Dream |
| Jun 7 2025 | WNBA 2025 | Connecticut Sun 84 - 76 Atlanta Dream |
| May 25 2025 | WNBA 2025 | Atlanta Dream 79 - 55 Connecticut Sun |
| Aug 18 2024 | WNBA 2024 | Atlanta Dream 82 - 70 Connecticut Sun |
| Jul 7 2024 | WNBA 2024 | Connecticut Sun 80 - 67 Atlanta Dream |
| Jun 29 2024 | WNBA 2024 | Connecticut Sun 74 - 78 Atlanta Dream |
| Jun 2 2024 | WNBA 2024 | Atlanta Dream 50 - 69 Connecticut Sun |
| Jul 22 2023 | WNBA 2023 | Atlanta Dream 78 - 86 Connecticut Sun |
| Jul 20 2023 | WNBA 2023 | Connecticut Sun 82 - 71 Atlanta Dream |
| Jun 16 2023 | WNBA 2023 | Connecticut Sun 88 - 92 Atlanta Dream |
| Jun 11 2023 | WNBA 2023 | Atlanta Dream 77 - 89 Connecticut Sun |
| Jul 16 2022 | WNBA 2022 | Atlanta Dream 68 - 93 Connecticut Sun |
| Jun 26 2022 | WNBA 2022 | Atlanta Dream 61 - 72 Connecticut Sun |
| Jun 16 2022 | WNBA 2022 | Connecticut Sun 105 - 92 Atlanta Dream |
| Sep 19 2021 | WNBA 2021 | Connecticut Sun 84 - 64 Atlanta Dream |
| Jul 10 2021 | WNBA 2021 | Connecticut Sun 84 - 72 Atlanta Dream |
| May 15 2021 | WNBA 2021 | Atlanta Dream 67 - 78 Connecticut Sun |
| Sep 12 2020 | WNBA 2020 | Connecticut Sun 75 - 82 Atlanta Dream |
| Aug 10 2020 | WNBA 2020 | Atlanta Dream 82 - 93 Connecticut Sun |
| Jul 20 2019 | WNBA 2019 | Connecticut Sun 98 - 69 Atlanta Dream |
| Jul 10 2019 | WNBA 2019 | Atlanta Dream 78 - 75 Connecticut Sun |
| Jun 22 2019 | WNBA 2019 | Connecticut Sun 86 - 76 Atlanta Dream |
| Jun 9 2019 | WNBA 2019 | Atlanta Dream 59 - 65 Connecticut Sun |
| Jul 18 2018 | WNBA 2018 | Connecticut Sun 83 - 86 Atlanta Dream |
| Jun 23 2018 | WNBA 2018 | Atlanta Dream 75 - 70 Connecticut Sun |
| Jun 6 2018 | WNBA 2018 | Atlanta Dream 82 - 77 Connecticut Sun |
| Aug 16 2017 | WNBA 2017 | Atlanta Dream 75 - 96 Connecticut Sun |
| Jun 11 2017 | WNBA 2017 | Connecticut Sun 104 - 71 Atlanta Dream |
| May 14 2017 | WNBA 2017 | Connecticut Sun 74 - 81 Atlanta Dream |
| Aug 28 2016 | WNBA 2016 | Atlanta Dream 87 - 73 Connecticut Sun |
| Jul 10 2016 | WNBA 2016 | Connecticut Sun 63 - 67 Atlanta Dream |
| Jun 12 2016 | WNBA 2016 | Atlanta Dream 93 - 87 Connecticut Sun |
| Jun 4 2016 | WNBA 2016 | Connecticut Sun 77 - 83 Atlanta Dream |
| Aug 25 2015 | WNBA 2015 | Atlanta Dream 71 - 57 Connecticut Sun |
| Aug 23 2015 | WNBA 2015 | Connecticut Sun 92 - 102 Atlanta Dream |
| Aug 16 2015 | WNBA 2015 | Atlanta Dream 90 - 77 Connecticut Sun |
| Jun 14 2015 | WNBA 2015 | Connecticut Sun 82 - 64 Atlanta Dream |
| Jun 7 2015 | WNBA 2015 | Atlanta Dream 70 - 75 Connecticut Sun |
| Aug 17 2014 | WNBA 2014 | Connecticut Sun 84 - 55 Atlanta Dream |
| Jul 29 2014 | WNBA 2014 | Atlanta Dream 89 - 80 Connecticut Sun |
| Jul 9 2014 | WNBA 2014 | Atlanta Dream 83 - 71 Connecticut Sun |
| Jun 1 2014 | WNBA 2014 | Connecticut Sun 85 - 76 Atlanta Dream |
| Sep 12 2013 | WNBA 2013 | Connecticut Sun 78 - 77 Atlanta Dream |
| Aug 17 2013 | WNBA 2013 | Atlanta Dream 88 - 57 Connecticut Sun |
| Aug 15 2013 | WNBA 2013 | Connecticut Sun 88 - 86 Atlanta Dream |
| Jul 25 2013 | WNBA 2013 | Atlanta Dream 74 - 65 Connecticut Sun |
| Jun 23 2013 | WNBA 2013 | Connecticut Sun 77 - 78 Atlanta Dream |
| Sep 23 2012 | WNBA 2012 | Connecticut Sun 92 - 72 Atlanta Dream |
| Sep 2 2012 | WNBA 2012 | Atlanta Dream 87 - 80 Connecticut Sun |
| Jun 17 2012 | WNBA 2012 | Atlanta Dream 73 - 75 Connecticut Sun |
| Jun 10 2012 | WNBA 2012 | Connecticut Sun 92 - 73 Atlanta Dream |
| Sep 18 2011 | WNBA 2011 | Atlanta Dream 69 - 64 Connecticut Sun |
| Sep 17 2011 | WNBA 2011 | Connecticut Sun 84 - 89 Atlanta Dream |
| Sep 7 2011 | WNBA 2011 | Atlanta Dream 85 - 74 Connecticut Sun |
| Aug 21 2011 | WNBA 2011 | Connecticut Sun 96 - 87 Atlanta Dream |
| Aug 20 2011 | WNBA 2011 | Atlanta Dream 94 - 88 Connecticut Sun |
| Jul 31 2011 | WNBA 2011 | Connecticut Sun 99 - 92 Atlanta Dream |
| Jul 31 2010 | WNBA 2010 | Connecticut Sun 62 - 94 Atlanta Dream |
| Jul 18 2010 | WNBA 2010 | Connecticut Sun 96 - 80 Atlanta Dream |
| Jul 8 2010 | WNBA 2010 | Atlanta Dream 108 - 103 Connecticut Sun |
| May 22 2010 | WNBA 2010 | Atlanta Dream 97 - 82 Connecticut Sun |
| Sep 12 2009 | WNBA 2009 | Atlanta Dream 88 - 64 Connecticut Sun |
| Jul 8 2009 | WNBA 2009 | Atlanta Dream 72 - 67 Connecticut Sun |
| Jun 28 2009 | WNBA 2009 | Connecticut Sun 82 - 68 Atlanta Dream |
| Jun 14 2009 | WNBA 2009 | Connecticut Sun 62 - 67 Atlanta Dream |

Total : **68 confrontations** (2009 → 2026) — cohérent avec 31+37 = 68 ✓.

### 4.16 Effectifs (Pos · Form · photo)

**Connecticut Sun Players** : G Diamond Miller -7.0 · G Charlisse Leger-Walker -2.0 · G Kennedy Burke -1.0 · G Saniya Rivers -6.0 · F Olivia Nelson-Ododa - · F Nell Angloma - · C Raegan Beers +1.0 · G Gianna Kneepkens -2.0 · G Leila Lacan -1.0 · F Aaliyah Edwards -6.0 · F Aneesah Morrow -4.0 · C Brittney Griner -3.0 · G Hailey Van Lith -4.0 · G Ashlon Jackson -8.0 · GF Rayah Marshall -4.0

**Atlanta Dream Players** : G Allisha Gray +1.0 · G Isobel Borlase - · G Jordin Canada +4.0 · F Naz Hillmon +2.0 · F Madina Okot -1.0 · F Angel Reese -2.0 · G Rhyne Howard +2.0 · F Sika Kone - · G Te-Hina Paopao +2.0 · G Indya Nivar - · G Aaliyah Nye +1.0 · G Jaylyn Sherrod +2.0 · C Brionna Jones +7.0 · G Shatori Walker-Kimbrough +1.0 · F Amy Okonkwo -3.0

> Le champ « Form » joueur = valeur de +/- (ou rating) — unité non précisée par le site.

### 4.17 Classement WNBA 2026 (side panel)

| # | Équipe | W-L | Win % |
|---|---|---|---|
| 1 | Minnesota Lynx | 28-7 | 80% |
| 2 | Golden State Valkyries | 24-9 | 73% |
| 3 | Las Vegas Aces | 23-11 | 68% |
| 4 | Atlanta Dream | 21-12 | 64% |
| 5 | Indiana Fever | 21-12 | 64% |
| 6 | Washington Mystics | 19-13 | 59% |
| 7 | Dallas Wings | 20-14 | 59% |
| 8 | New York Liberty | 20-14 | 59% |
| 9 | Portland Fire | 13-20 | 39% |
| 10 | Los Angeles Sparks | 12-20 | 38% |
| 11 | Phoenix Mercury | 13-22 | 37% |
| 12 | Chicago Sky | 12-22 | 35% |
| 13 | Toronto Tempo | 10-23 | 30% |
| 14 | Connecticut Sun | 8-24 | 25% |
| 15 | Seattle Storm | 7-28 | 20% |

---

## 5. Formules de calcul (récapitulatif pour la reproduction)

Soit `G` = liste des matchs de la saison en cours d'une équipe, `H2H` = liste des 68 confrontations, `X.5` un seuil.

| Métrique | Formule |
|---|---|
| Win % (H2H) | victoires(H2H) / 68 |
| Win % (saison, par venue) | victoires(G home|away|all) / matchs |
| PPG / PAPG | Σ points marqués (encaissés) / N matchs |
| Point Spread (tableau H2H) | PPG_A − PPG_B |
| FG% | Σ FGM / Σ FGA |
| 1h Lead | % de matchs où l'équipe mène après Q2 |
| Pace | possessions estimées par match (≈ 0.44 × FGA + FTA × 0.4... ou via play-by-play) |
| Offence R / Defence R | points marqués (encaissés) × 100 / possessions |
| Team Over X.5 | count(G où points_équipe > X.5) / N |
| Quarters/Halves Over X.5 | idem avec points du quartier/moitié |
| Positive Spread Over X.5 | count(G où marge > X.5) / N |
| Negative Spread Over -X.5 | count(G où marge > -X.5) / N |
| Match Over X.5 | count(G où points_équipe + points_adv > X.5) / N ; colonne Moyenne = (CT% + ATL%)/2 |
| BTTS Over X.5 (FT/1H/2H/Q) | count(G où total combiné (moitié/quartier) > X.5) / N |
| Player per-game (PPG, REB, AST, BLK, STL, 3PM, FGM) | Σ stat / matchs joués (cf. `(103/23)` = totaux ÷ matchs) |
| FG% joueur | FGM par match / FGA par match (arrondi) |
| Plus/Minus joueur | moyenne du ± par match (saison) |
| Net Rating (bloc équipe) | moyenne des spreads (valeur site — voir ⚠️ §4.3) |
| Forme (6 derniers) | séquence W/L des 6 derniers matchs |
| Badge forme | Net Rating Home (équipe à domicile) / Away (équipe extérieure) + libellé qualitatif |

**Libellés qualitatifs observés** : `Very Bad Form` (−10.4), `Unplayable Form` (+6.8). L'échelle complète des libellés (Very Good / Good / Bad / Unplayable…) n'est pas documentée par le site → à définir côté PariScore (ex. : ≥ +8 « Excellent », +4 à +8 « Bon », −4 à +4 « Moyen », −8 à −4 « Mauvais », ≤ −8 « Très mauvais »).

---

## 6. Données requises & sources possibles

### 6.1 Données minimales nécessaires (par équipe, par saison)

1. **Matchs joués** : date, adversaire, domicile/extérieur, scores finaux (pour scores, marges, win %, formes)
2. **Box scores par quartier** (Q1-Q4 par équipe) — pour quarters/halves/BTTS
3. **Box scores équipe** : FGM, FGA, 3PM, 3PA, FTM, FTA, REB (O/D), AST, BLK, STL, TO — pour FG%, Pace, ratings
4. **Plus/Minus par joueur + matchs joués** — pour les sections Players
5. **Statistiques joueurs** : PPG, RPG, APG, BLK, STL, 3PM — par joueur
6. **Historique H2H** (2009 → saison courante) — liste des confrontations
7. **Classement saison** (W-L) — side panel
8. *(Optionnel)* **Spreads de bookmaker** — pour reproduire exactement les valeurs « Spread »/« Net Rating » du site (voir ⚠️)

### 6.2 Sources possibles côté PariScore

| Source | Couvre | Coût | Remarques |
|---|---|---|---|
| **ESPN** (déjà utilisé par `services/wnbaService.js` et `services/nbaService.js` — `/api/nba/matches`, `/api/wnba/matches`) | scores, box scores par quartier, stats joueurs, classements, historique H2H | Gratuit | Suffisant pour ~95 % des métriques. Ne fournit **pas** les spreads de bookmaker. |
| **API-Football (basketball)** — `API_FOOTBALL_KEY` déjà en `.env` | fixtures, standings, H2H (`/fixtures/headtohead`), box scores | Quota API | Alternative ou complément ; H2H natif dispo. |
| **basketballstats.net (scraping)** | reproduction à l'identique des valeurs du site | Gratuit | Risques : anti-bot, structure HTML fragile, légal/ToS — à éviter sauf validation. Utiliser les conventions de scraping du projet (scrapling/scrapy) et le mécanisme d'allowlist. |

### 6.3 Recommandation

**Recommandé : recalcul côté PariScore à partir des données ESPN** (déjà intégrées). Toutes les métriques §5
sont dérivables des box scores ; seules les valeurs « Spread »/« Net Rating » (non cohérentes avec la marge
réelle, cf. §4.3) ne sont pas reproductibles sans données bookmaker — les remplacer par la **marge moyenne**
(alternative transparente et documentée) ou intégrer les odds (le projet a déjà `ODDS_API_KEY`).

---

## 7. Blueprint d'implémentation PariScore

### 7.1 Backend (Next.js, pattern existant `services/` + routes `/api/v1/...`)

- **`services/basketballH2HService.js`** (ou étendre `wnbaService.js`/`nbaService.js`) :
  - `getTeamMatchHistory(league, teamId)` → séquence W/L, marge, points par quartier (ESPN `scoreboard`/`summary`)
  - `getH2H(league, teamAId, teamBId)` → 68 matchs, split, PPG, tableaux Over (§4.2)
  - `computeOverStats(matches, {scope: 'game'|'q1'|'q2'|'q3'|'q4'|'h1'|'h2', thresholdRange})`
  - `computeSpreadStats(matches)` → positive/négative
  - `computeMatchOverStats(matches)` + `computeBTTS(matches, scope)`
  - `getTeamSeasonStats(league, teamId, venue)` → Win%, PPG, PAPG, FG%, 1h Lead, Pace, ratings
  - `getPlayerSeasonStats(league, teamId)` → PPG, REB, AST, BLK, STL, 3PM, FG%, ±, rating
- **Routes** : `app/api/basketball/h2h/[league]/route.ts` (ou `/api/v1/basketball/h2h?teamA=&teamB=`), GET avec cache SWR (revalidation quotidienne — le site source est un snapshot journalier).

### 7.2 Frontend (React/shadcn, onglet NBA & WNBA)

- Nouvelle sous-navigation dans l'onglet basket : **« H2H »** avec les 3 tabs du site (Stats / Matches / Players)
- Composants : `H2HHeader` (badges forme + split win %), `H2HDataPoints` (table 8 lignes), `H2HTeamStats` (Overall/Home/Away), `OverUnderTable` (générique réutilisé pour toutes les sections Over : team/quarters/halves/spread/match/BTTS), `H2HMatchesList`, `H2HRosters`
- Sélecteur de paire d'équipes (dropdowns home/away) — la page source est générée par paire.
- Chargement : `useBasketballH2H.ts` (SWR, même pattern que `use-basketball-matches.ts`).

### 7.3 Ordre de priorité (effort / valeur)

1. **H2H Stats** (§4.2) + **blocs équipe** (§4.3) + **liste H2H** (§4.15) — cœur, effort faible (scores + box scores seuls)
2. **Team Points Over** (§4.4) + **Quarters/Halves** (§4.5-4.6) — effort faible
3. **Match Over + BTTS** (§4.8-4.9) — effort faible
4. **Spread O/U** (§4.7) — effort faible (scores seuls) mais remplacer « Average Spread » par marge moyenne
5. **Players** (§4.10-4.14) — effort moyen (dépend du pipeline stats joueurs existant pour les props)

---

## 8. Points ouverts / à valider

1. **Assists 57.35 & Rebounds 119.07** du tableau H2H (§4.2) — base de calcul inconnue, valeur ×3 vs. réalité per-game. Ne pas reproduire sans investiguer (regarder une autre paire d'équipes pour voir si le ratio persiste).
2. **Offensive Rating 84.67 identique** pour les deux équipes (§4.2) — probable bug du site.
3. **« Spread » / « Net Rating » ≠ marge réelle** (§4.3) — nécessite les lignes de bookmaker ; décider : marge moyenne vs. intégration `ODDS_API_KEY`.
4. **Formule du « Rating » joueur** (§4.10) — composite non documenté ; soit répliquer un rating connu (e.g. PER simplifié), soit afficher ± uniquement.
5. **Échelle des libellés de forme** (`Very Bad Form`, `Unplayable Form`) — non documentée.
6. **Badge forme = Net Rating home/away** — hypothèse forte (§4.1) à confirmer sur un match à domicile inversé.
7. **BTTS : « BTTS Over 4Q » du site affiche les données 3Q** — bug site, utiliser les bonnes valeurs (§4.9).

---

## 9. Décisions validées (2026-08-14) — suite à validation utilisateur

| # | Métrique | Décision |
|---|---|---|
| 1-2 | Assists / Rebounds Per Game (tableau H2H) | **Remplacées** par APG/RPG recalculés sur l'échantillon H2H |
| 3 | Offensive Rating (tableau H2H) | **Supprimée** |
| 4 | Net Rating / Spread (blocs équipe) | **Marge moyenne** (netRating = mean margin) |
| 5 | Average Spread (section Spread O/U) | **avgMargin** (marge moyenne) |
| 6 | Rating joueur | **Non implémenté** — Plus/Minus seul |
| 7 | BTTS 4Q | Corrigé silencieusement (valeurs 4Q réelles) |

Ces décisions sont verrouillées dans `.context/prompt-h2h-basketballstats.md` (mentions « décision validée 2026-08-14 »).

---

*Rapport généré le 2026-08-14. Snapshot source complet : `C:\Users\David\.local\share\opencode\tool-output\tool_000633e88001gypSCilUUtzMaY`.*
