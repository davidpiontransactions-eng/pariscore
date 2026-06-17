# Rapport Benchmark — Métriques Pre-Match Tennis
## Analyse Comparative des Plateformes Leaders : Tennis Abstract, Ultimate Tennis Statistics, Flashscore, SofaScore

**Date :** 17 Juin 2026
**Auteur :** Équipe Ingénierie PariScore
**Version :** 1.0

---

## Résumé Exécutif

Ce rapport compare les métriques pre-match utilisées par les 4 plateformes de référence (Tennis Abstract, Ultimate Tennis Statistics, Flashscore, SofaScore) pour déterminer quelles métriques manquent à PariScore et lesquelles apporteraient le plus de valeur aux parieurs. **12 métriques prioritaires** ont été identifiées, classées par impact et faisabilité technique.

---

## 1. Méthodologie

Analyse effectuée le 17/06/2026 par navigation et extraction des pages joueurs, H2H, et forecasts de :

| Plateforme | URL | Spécialité |
|---|---|---|
| **Tennis Abstract** | tennisabstract.com | Stats avancées, Elo surface, forecasts probabilistes |
| **Ultimate Tennis Statistics** | ultimatetennisstatistics.com | GOAT list, rivalités, mental toughness, stats carrière |
| **Flashscore** | flashscore.com | Live scores, H2H simplifié, cotes live |
| **SofaScore** | sofascore.com | Stats in-match détaillées, heatmaps, momentum |

---

## 2. Tennis Abstract — Le Gold Standard

### 2.1 Architecture des métriques

Tennis Abstract organise ses statistiques en **4 piliers** (visibles sur la page joueur) :

| Pilier | Métriques clés | Période |
|---|---|---|
| **Serve** | 1st Serve %, 1st Serve Won %, 2nd Serve Won %, Ace%, Double Fault%, Service Points Won %, Service Games Won %, Hold % | Last 52 semaines + Carrière |
| **Return** | 1st Return Won %, 2nd Return Won %, Break Points Converted %, Return Points Won %, Return Games Won % | Last 52 + Carrière |
| **Rally** | Winners/UE ratio, Forehand Potency, Backhand Potency, Net Points Won %, Baseline Points Won % | Match Charting Project |
| **Tactics** | Rally Length (moyen), 0-4 shot %, 5-8 shot %, 9+ shot %, Serve & Volley %, Approach Net %, Drop Shot % | Match Charting Project |

### 2.2 Match Charting Project (MCP) — Ce que PariScore n'a pas

Le MCP est un projet collaboratif de charting manuel qui capture des données **inaccessibles via les APIs standards** :

```yaml
MCP_SERVE:
  - Ace %
  - Double Fault %
  - 1st Serve In %
  - 1st Serve Won %
  - 2nd Serve Won %
  - Serve Points Won %
  - Service Games Won % (Hold %)
  - Serve Speed (avg mph/kph)
  - Unreturned Serve %

MCP_RETURN:
  - 1st Return Won %
  - 2nd Return Won %
  - Break Points Won %
  - Return Points Won %
  - Return Games Won % (Break %)

MCP_RALLY:
  - Rally Length (moyen shots/point)
  - Forehand Winners / Unforced Errors
  - Backhand Winners / Unforced Errors
  - Net Points Won %
  - Baseline Points Won %
  - Forehand Potency (Winners - UEs) / Total FH shots
  - Backhand Potency
  - Shot Direction Distribution (crosscourt / down the line)

MCP_TACTICS:
  - % points 0-4 shots
  - % points 5-8 shots
  - % points 9+ shots
  - Serve & Volley Frequency
  - Approach Net Frequency
  - Drop Shot Frequency
  - Pass Shot Won %
```

### 2.3 Forecast Elo Surface

Tennis Abstract utilise un **Elo surface-spécifique** pour ses forecasts de tournoi. Leur modèle :
- Calcule un Elo distinct par surface (Hard / Clay / Grass / Indoor)
- Poids par adversaire (qualité de l'opposition)
- Marge de victoire (jeux, pas juste W/L)
- Simulation Monte Carlo pour les probabilités de tour

**PariScore a déjà l'Elo surface** — ce qui manque c'est l'affichage du **percentile Elo** (top X% ATP sur cette surface).

---

## 3. Ultimate Tennis Statistics — Le Focus Rivalité

### 3.1 Mental Toughness

Score composite breveté par UTS mesurant :
- Tie-break win %
- Deciding set win %
- Comeback from 0-2 sets %
- Break points saved %
- Match points saved %
- 5-set record

**PariScore a déjà BP Saved et TB Win%** dans le payload — il faut les exposer dans le modal.

### 3.2 Rivalry H2H Profiles

Pour chaque paire de joueurs, UTS montre :
- H2H record (all surfaces + par surface)
- Average rank difference at match time
- Average Elo difference at match time
- % matches decided in straight sets
- % matches with tie-break
- Average games per set

---

## 4. Flashscore / SofaScore — Le Focus Cotes & Live

### 4.1 Flashscore H2H

| Métrique | Description |
|---|---|
| Last 5 H2H | Résultats + scores + tournoi |
| Surface split | W/L par surface entre les 2 joueurs |
| Ranking trend | Évolution du classement sur 12 mois (graphique) |
| Recent form | W/L sur les 10 derniers matchs (toutes surfaces) |
| Tournament history | Meilleur résultat dans CE tournoi |

### 4.2 SofaScore Attack/Defense Ratings

SofaScore utilise des ratings propriétaires 0-100 :
- **Attack Rating** : agressivité, winners, points gagnés au filet
- **Defense Rating** : passing shots, break points saved, retours gagnants
- **Serve Rating** : aces, 1st serve won %, service games won %
- **Return Rating** : break %, return points won %
- **Momentum** : forme récente pondérée (last 5 matchs)

---

## 5. Matrice Comparative — Ce que PariScore a vs Ce qui Manque

### 5.1 Couverture Actuelle de PariScore

| Catégorie | Métrique | Statut |
|---|---|---|
| **Identité** | ATP Rank, Age, Nationalité, Surface | ✅ |
| **ELO** | Elo Surface, Surf Rank, Surf Form | ✅ |
| **PowerScore** | PowerScore, PS Rank, PS Total, L10, L5 | ✅ |
| **Serve** | Serve Index, Serve Rank, Serve Delta | ✅ |
| **Retour** | Receive Index, Receive Rank, Receive Delta | ✅ |
| **Tournoi** | DR Moyen (ELO adversaires), Historique édition précédente | ✅ |
| **Mental** | Clutch Score, BP Saved %, TB Win % | ✅ (payload) |
| **Âge/Fatigue** | Age30, AgeDiff, Fatigue Index | ✅ (payload) |
| **Break Points** | BP Converted, BP Opportunities | ✅ (payload) |
| **Radar** | ELO, PowerScore, Momentum, Niveau, Expérience, Efficacité | ✅ |

### 5.2 Métriques Manquantes — Classées par Priorité

#### Priorité 1 — Impact Immédiat (données déjà disponibles ou faciles à calculer)

| # | Métrique | Source | Effort | Valeur Pari | Description |
|---|---|---|---|---|---|
| **M1** | **Hold % / Break %** (surface 52w) | Calculable depuis `serve_dominance` + `_bsd_stats` | 🟢 2h | ⭐⭐⭐⭐⭐ | % jeux de service gagnés / % jeux de retour gagnés. LE métrique le plus prédictif selon Sackmann. |
| **M2** | **H2H Record (all + surface actuelle)** | `tennis_matches_internal` | 🟢 1h | ⭐⭐⭐⭐⭐ | W/L entre les 2 joueurs + filtre par surface. Le parieur veut TOUJOURS voir ça. |
| **M3** | **Percentile Elo (top X% ATP)** | Calculable depuis `tennis_elo` | 🟢 30min | ⭐⭐⭐⭐ | Au lieu de juste "ELO 2150 pts", dire "Top 3% ATP sur gazon". Contextualise. |
| **M4** | **Average Set Score (H2H)** | `tennis_matches_internal` | 🟢 1h | ⭐⭐⭐⭐ | Sets moyens par match entre les 2 joueurs. Indique si les matchs sont serrés ou non. |
| **M5** | **1st Serve Won % / 2nd Serve Won %** | `serve_dominance.serve_pts_won_pct` (déjà dans payload) | 🟢 15min | ⭐⭐⭐⭐ | Déjà côté serveur, juste pas affiché. Indicateur de dominance au service. |

#### Priorité 2 — Impact Élevé (données calculables avec effort modéré)

| # | Métrique | Source | Effort | Valeur Pari | Description |
|---|---|---|---|---|---|
| **M6** | **Return Points Won % (surface 52w)** | `serve_dominance` + `_bsd_stats.ret_won` | 🟡 3h | ⭐⭐⭐⭐ | % de points gagnés en retour. Complément parfait du Hold %. |
| **M7** | **Winners / UE Ratio (surface 52w)** | Pas dans BSD standard — nécessite MCP ou Flashscore scraping | 🔴 8h | ⭐⭐⭐⭐ | Le Saint Graal. Différencie attaquants vs contreurs. Très prédictif. |
| **M8** | **Tie-Break Record (52w)** | `tennis_matches_internal` | 🟡 3h | ⭐⭐⭐ | W/L en tie-breaks. Crucial pour les surfaces rapides (herbe, indoor). |
| **M9** | **Deciding Set Record (52w)** | `tennis_matches_internal` | 🟡 2h | ⭐⭐⭐ | W/L en 3e/5e set. Proxy de fitness et mental. |

#### Priorité 3 — Différenciation (données externes ou scraping)

| # | Métrique | Source | Effort | Valeur Pari | Description |
|---|---|---|---|---|---|
| **M10** | **3-Month Form Trend (graph)** | Calculable depuis `tennis_matches_internal` | 🟡 4h | ⭐⭐⭐ | Sparkline ou mini-graph de la forme récente. Visuellement puissant. |
| **M11** | **Surface Career Win%** | `tennis_matches_internal` | 🟢 1h | ⭐⭐⭐ | % de victoires carrière sur la surface du match. Les parieurs adorent. |
| **M12** | **Average Odds Implied Probability (last 10)** | `bsd_markets` + `odds` dans payload | 🟢 1h | ⭐⭐ | Probabilité implicite moyenne des cotes sur les 10 derniers matchs. |

---

## 6. Recommandations d'Implémentation

### 6.1 Phase 1 — Quick Wins (aujourd'hui, 2-3h)

```javascript
// M1: Hold % / Break % — le métrique le plus prédictif
// Serve games won % = 1 - (break points faced / service games)
// Return games won % = break points converted / return games
function _tnHoldBreakPct(playerName, surface) {
  const rows = sqldb.prepare(`
    SELECT 
      AVG(srv_pts_won) as avg_srv_pts,
      SUM(bp_saved) as total_bp_saved,
      SUM(bp_faced) as total_bp_faced,
      SUM(bp_converted) as total_bp_converted,
      SUM(bp_opp) as total_bp_opportunities
    FROM tennis_matches_internal
    WHERE (winner_name=? OR loser_name=?) 
      AND surface=? 
      AND tourney_date >= ?
  `).get(playerName, playerName, surface, cutoff52w);
  // Hold% = bp_saved / bp_faced  (normalisé)
  // Break% = bp_converted / bp_opportunities
}

// M3: Percentile Elo — "Top X% ATP sur [surface]"
function _tnEloPercentile(eloValue, tour, surface) {
  const total = sqldb.prepare(
    'SELECT COUNT(*) as c FROM tennis_elo WHERE tour=? AND surface=?'
  ).get(tour, surface);
  const better = sqldb.prepare(
    'SELECT COUNT(*) as c FROM tennis_elo WHERE tour=? AND surface=? AND elo > ?'
  ).get(tour, surface, eloValue);
  return ((better.c / total.c) * 100).toFixed(1) + '%';
}

// M11: Surface Career Win%
function _tnSurfaceCareerWinPct(playerName, surface) {
  const total = sqldb.prepare(
    'SELECT COUNT(*) as c FROM tennis_matches_internal WHERE (winner_name=? OR loser_name=?) AND surface=?'
  ).get(playerName, playerName, surface);
  const wins = sqldb.prepare(
    'SELECT COUNT(*) as c FROM tennis_matches_internal WHERE winner_name=? AND surface=?'
  ).get(playerName, surface);
  return total.c > 0 ? ((wins.c / total.c) * 100).toFixed(1) + '% (' + wins.c + '-' + (total.c - wins.c) + ')' : null;
}
```

### 6.2 Phase 2 — Semaine Prochaine (8-12h)

1. **Hold/Break %** : 2 nouvelles lignes dans le tableau comparatif
2. **H2H Record all + surface** : widget dédié au-dessus du tableau
3. **Percentile Elo** : badge coloré (or/argent/bronze) dans le header joueur
4. **Return Points Won %** : ligne supplémentaire
5. **Tie-Break Record** : affiché conditionnellement (seulement si surface rapide)

### 6.3 Phase 3 — Sprint Suivant

1. **MCP-style Winners/UE scraping** depuis Flashscore/SofaScore
2. **Form Trend sparkline** (D3.js, mini graphique 10 matchs)
3. **Average H2H Set Score** (1 ligne: "Moy: 6-4, 6-3 en H2H")

---

## 7. Architecture d'Affichage Recommandée

Inspiré de l'organisation en 4 piliers de Tennis Abstract :

```
┌─────────────────────────────────────────────────────┐
│  [Joueur 1]    VS    [Joueur 2]                     │
│  ATP #3 · Elo 2150 (Top 2% ATP) · Seed #1/32       │
│  Surface Career: 78-22 (78.0%)                      │
├─────────────────────────────────────────────────────┤
│  ═══ SERVE ═══                                      │
│  ELO Surface     │ 2150 pts  │ 1980 pts              │
│  Hold % (52w)   │ 89%       │ 82%                   │
│  1st Serve Won% │ 78.2%     │ 74.1%                 │
│  Aces/DF Ratio  │ 12.3%     │ 8.1%                  │
│  Serve Index     │ 82/100    │ 69/100                │
├─────────────────────────────────────────────────────┤
│  ═══ RETURN ═══                                     │
│  Break % (52w)  │ 32%       │ 18%                   │
│  Return Won%    │ 41.2%     │ 35.8%                 │
│  Receive Index   │ 76/100    │ 58/100                │
├─────────────────────────────────────────────────────┤
│  ═══ MENTAL ═══                                     │
│  Pressure Index │ 72%       │ 58%                   │
│  TB Record 52w  │ 8-2       │ 4-5                   │
│  Deciding Set   │ 6-1       │ 3-4                   │
├─────────────────────────────────────────────────────┤
│  ═══ CONTEXTE ═══                                   │
│  H2H Record     │ 3-1 (grass: 1-0)                  │
│  DR Moyen       │ 1820 pts  │ 1680 pts              │
│  Form L10       │ 8-2       │ 5-5                   │
│  Age / Fatigue  │ 22.3 Fresh│ 25.1 Heavy            │
├─────────────────────────────────────────────────────┤
│  ═══ RADAR ═══                                      │
│  [Spider Chart 6 axes : ELO, PowerScore, Momentum,  │
│   Niveau, Expérience, Efficacité]                   │
└─────────────────────────────────────────────────────┘
```

---

## 8. Sources & Références

| Source | URL |
|---|---|
| Tennis Abstract Leaders | https://www.tennisabstract.com/cgi-bin/leaders.cgi |
| ATP Elo Ratings | https://tennisabstract.com/reports/atp_elo_ratings.html |
| MCP Leaderboards | https://tennisabstract.com/reports/mcp_leaders_serve_men_last52.html |
| Sackmann Elo | https://github.com/JeffSackmann/tennis_elo |
| UTS H2H | https://www.ultimatetennisstatistics.com/headToHead |
| Flashscore Tennis | https://www.flashscore.com/tennis/ |

---

## 9. Prochaines Étapes

- [ ] **AUJOURD'HUI** : Implémenter M1 (Hold/Break%), M3 (Percentile Elo), M11 (Surface Career Win%)
- [ ] **DEMAIN** : Implémenter M2 (H2H Record with surface), M5 (1st/2nd Serve display)
- [ ] **CETTE SEMAINE** : M4 (Avg Set Score), M8 (TB Record), M9 (Deciding Set)
- [ ] **SPRINT SUIVANT** : M7 (Winners/UE via scraping), M10 (Form Trend graph)
