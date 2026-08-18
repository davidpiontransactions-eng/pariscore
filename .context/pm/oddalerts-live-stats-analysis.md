# Rapport — Meilleur d'OddAlerts.com : Live Stats Football (In-Play)

**Date** : 2026-08-15 · **Scope** : partie FOOTBALL LIVE / IN-PLAY, angle STATS
**Sources analysées** : oddalerts.com (accueil, /funnel, /pro, /xg, /updates, /football-data-api) +
documentation API officielle (collection Postman `documenter.getpostman.com/view/17615275/2s935uG1WF`).

> ⚠️ Le monitor de match live (gauge de pression, timeline, ticker d'événements) est derrière
> login. Ce rapport s'appuie sur les pages publiques, la doc API et les captures connues de
> l'interface. L'algorithme exact de pression n'est pas publié — seules ses sorties le sont.

---

## 1. Le joyau de la couronne : le Live Pressure Monitor

### Concept
> *"Live Pressure Monitor — See who's truly dominating — a unique algorithm that reads the
> real flow of play."* (page /pro)

C'est la métrique **propriétaire** d'OddAlerts (développée sur « des milliers de matchs »).
Elle répond à une question que les stats classiques ne répondent pas : **qui fait le jeu
réellement, maintenant** — pas qui a le plus de possession stérile.

### Structure des données (confirmée par l'API)
Le champ `stats` de chaque fixture live expose **8 champs pression** :

```json
{
  "home_pressure": 63.43,      // pression live Home (%) — 0-100
  "away_pressure": 36.57,      // pression live Away (%) — home + away ≈ 100
  "home_pressure_avg": 61,     // pression moyenne historico-avant-match Home (%)
  "away_pressure_avg": 39      // pression moyenne Away (%)
}
```

Enseignements clés :
- **Deux échelles de temps systématiquement affichées** : la pression **live du match**
  (flux de jeu actuel) vs la pression **moyenne attendue** (baseline pré-match de chaque
  équipe). L'écart `live − avg` est le signal : une équipe faible qui fait 60 live vs 35 avg
  = anomalie exploitable.
- **La pression est normalisée en %** et se lit comme un partage de domination
  (69/31 dans les captures de l'UI), pas comme un volume absolu.
- Le funnel documente en plus la **pression différentielle moyenne** (`average pressure
  difference ≥ 20%`) comme seuil de trading live.

### Seuils de pression publiés (In-Play Funnel)
| Règle | Seuil |
|---|---|
| Home team pressure | `> 65%` |
| Average pressure difference | `≥ 20%` |
| Away possession (combiné) | `< 35%` |

---

## 2. Liste EXHAUSTIVE des métriques live (extraite de l'API)

### 2.1 Stats live du match (payload `stats` en cours de match)
| Catégorie | Champs API | Type |
|---|---|---|
| **Pression** | `home_pressure`, `away_pressure`, `home_pressure_avg`, `away_pressure_avg` | % (2 décimales) |
| **Possession** | `home_possession`, `away_possession` | % entier |
| **Tirs** | `shots` (total), `home_shots`, `away_shots` | int |
| **Tirs cadrés** | `shots_on` (total), `home_shots_on`, `away_shots_on` | int |
| **Attaques** | `attacks` (total), `home_attacks`, `away_attacks` | int |
| **Attaques dangereuses** | `dang_attacks` (total), `home_dang_attacks`, `away_dang_attacks` | int |
| **Corners** | `corners` (total), `home_corners`, `away_corners` | int |
| **Cartons jaunes** | `home_yellow_cards`, `away_yellow_cards` | int |
| **Cartons rouges** | `home_red_cards`, `away_red_cards` | int |
| **Cartons (total)** | `cards` | int |
| **Fautes** | `home_fouls`, `away_fouls` | int |

### 2.2 Stats étendues (avec moyennes et split for/opponent)
Chaque métrique étendue suit le même gabarit `{total, home, away, total_avg, home_avg, away_avg}`
et se décline en 3 vues : `_total`, `_for`, `_opponent` :

- `xg_total` / `xg_for` / `xg_opponent` — xG **décimal** (ex. total 18.98, home 11.73)
- `tackles_total` / `tackles_for` / `tackles_opponent`
- `offsides_total` / `offsides_for` / `offsides_opponent`
- `goal_kicks_total` / `goal_kicks_for` / `goal_kicks_opponent`
- `throw_ins_total` / `throw_ins_for` / `throw_ins_opponent`
- Corners avec **distribution des lignes de marché** : `o4`…`o12` chacun en
  `{total, home, away, total_percentage, home_percentage, away_percentage}`
  (ex. `o8` : 28.57% total — c'est ce qui alimente la page 8+ Corners et les
  corner predictions).

### 2.3 Probabilités live profitables (payload `probability`)
```json
{ "home_win": 54.62, "draw": 27.95, "away_win": 17.42,
  "btts": 42.27, "o25": 38.01, "u25": 61.99, "o35": 18.88, "u35": 81.12,
  "o05_home_goals": 78.05, "o15_home_goals": 43.24,
  "o05_away_goals": 49.35, "o15_away_goals": 15.96 }
```
Le monitor de match combine stats + probabilités : la valeur d'un écart de pression
se convertit immédiatement en marchés (BTTS, O/U, buts d'équipe).

### 2.4 Cotes live (payload `odds`)
`ft_result` (1x2), `dnb`, `total_goals` (over/under de 0.5 à 6.5 par paliers de 0.5),
`total_goals_1h`, etc. → c'est la base du **Live Ticker**
(`GET /api/odds/latest?since_minutes=1`) qui stream les mouvements de cotes à la minute.

---

## 3. Les règles statistiques du In-Play Funnel (seuils publiés = défauts à répliquer)

### 📊 Shots
- Total shots on target `> 8` · Home shots `> 12` · Away SoT `≥ 4`

### ⚽ Pression & Possession
- Home pressure `> 65%` · Away possession `< 35%` · Différence de pression moyenne `≥ 20%`

### 🚩 Corners & Cartons
- Total corners `≥ 6` · Home corners `> 4` · Yellow cards `≤ 2`

### ⚡ Attaques
- Dangerous attacks `> 15` · Home attacks `≥ 25` · xG `> 1.5`

### Exemples composites officiels
1. **BTTS** : cote +20%, min 1.80, les deux équipes à 3+ tirs cadrés ET attaques totales > 20.
2. **Corners haute pression** : cote +30%, max 40e minute, corners > 4 ET attaques > 20.
3. **Over 1.5 early** : cote +25%, max 30e minute, proba min 55%.

---

## 4. Événements live & alertes (le "ticker" humain)

- **Live Event Alerts** (bêta, 2026) : penalty accordée, **premier carton rouge** —
  les 2 événements à plus fort impact marché, poussés en one-click preset.
- **Foul Alerts** : N fautes commises sans carton → alerte booking imminent (marché cartons joueur).
- **Scan cadence** : chaque match scanné **toutes les secondes**, alertes Telegram en qq secondes, 24/7.
- **Live Match AI Analysis** (OddAlerts AI) : analyse live du match + chat de suivi — le
  pendant narratif des stats.

---

## 5. L'UI du monitor de match (synthèse des captures + pages publiques)

1. **Header compact 3 lignes** : outils (history/étoile/fermer) → score + minute
   + compétition → équipes. Le score/minute est **vert** (détail marquant).
2. **Navigation à 3 niveaux** : `Create|Stats|Odds|Predictions` →
   `In-Play|General|Goals|Timing` → `Stats|Trends|AI|Lineup`. Le contexte actif a une barre verte.
3. **Pressure Formula Widget** : 2 donuts bicolores — LIVE PRESSURE vs AVG PRESSURE —
   les valeurs home/away affichées aux extrémités (69 | 31). Badge `● Events`.
4. **Pressure Monitor Timeline** : axe `KO, 15', 30', HT, 60', 75', FT`, barres miroir
   Home↑/Away↓ (pression minute par minute), marqueurs d'événements superposés
   (● tirs, ⚽ buts, 🚩 corners, 🟨 cartons) + sous-bandeau ticker
   (« Lincoln City Corner × 4 (6', 6', 9', 11') » + bouton Next).
5. **Live Stats Breakdown** : 3 highlights en jauges bilatérales (Possession, Attacks,
   Dangerous Attacks) + tableau de ~12 métriques (xG, xGOT, corners, fouls, goal kicks,
   goals, offsides, shots, SoT, tackles, throw-ins, yellow cards) avec barres de ratio cyan/gris.
6. **Row locks** : fonctionnalités Pro en 🔒 avec CTA `Activate`.

---

## 6. Le meilleur à reprendre pour PariScore (recommandations)

| # | À reprendre | Pourquoi |
|---|---|---|
| 1 | **Le couple live / avg sur la pression** | C'est LA différenciation. Le donut LIVE vs donut AVG transforme une stat brute en signal d'anomalie lisible en 1 seconde. |
| 2 | **Normalisation 0-100 en %** | Rend toute métrique comparable entre matchs et équipes (pas de volume absolu). |
| 3 | **Timeline miroir + marqueurs d'événements** | Unit pression temporelle et événements (tirs, buts, corners, cartons) dans un seul graphique scannable — l'agent doit retrouver ce pattern exact. |
| 4 | **Attaques dangereuses comme métrique distincte des attaques** | Dupliquée par très peu de concurrents, très prédictive en live betting. |
| 5 | **Seuils du funnel comme défauts de notre UI** | `pressure > 65%`, `dang attacks > 15`, `corners ≥ 6`, `SoT > 8` = valeurs de surbrillance automatique dans notre LiveStatsBreakdown. |
| 6 | **Ticker d'événements avec minutes cumulées** | « Corner × 4 (6', 6', 9', 11') » = contexte immédiat sans cliquer. |
| 7 | **Probabilité + stats dans la même vue** | Le signal pression ne vaut que converti en marchés (BTTS, O/U, buts d'équipe). |
| 8 | **[⬇ Priorité basse]** Live Match AI, alertes Telegram, FPL | Hors périmètre front ; à brancher plus tard sur l'existant PariScore (Gemini, notifications web-push). |

## 7. Ce qu'il NE faut PAS copier

- Le mur de texte marketing (pas de récit — des chiffres, des barres, des seuils).
- Les métriques sans contexte bilatéral (toute stat OddAlerts a toujours son miroir Home/Away).
- Le xG saisonnier long-terme dans une vue live (le live ne montre que le xG du match).