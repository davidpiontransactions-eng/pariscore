# Recherche Complète — Basketball ParisScore × FIBA Women's WC 2026

> Rapport consolidé : 8 sources académiques, 5 concurrents, 4 PDFs analysés, 2 sites FIBA/ESPN scrapés
> Date : 2026-09-04

---

## Table des matières

1. [Sources de données](#1-sources-de-données)
2. [APIs ESPN FIBA (Scoreboard + Standings)](#2-apis-espn-fiba)
3. [FIBA Women's World Cup 2026](#3-fiba-womens-world-cup-2026)
4. [Classements FIBA (Men + Women)](#4-classements-fiba)
5. [Modèles prédictifs — État de l'art](#5-modèles-prédictifs)
6. [Papers académiques analysés](#6-papers-académiques)
7. [Concurrents & benchmarks](#7-concurrents)
8. [Formules clés à implémenter](#8-formules-clés)
9. [Architecture UI recommandée](#9-architecture-ui)
10. [Pipeline de données recommandé](#10-pipeline)

---

## 1. Sources de données

### APIs gratuites identifiées

| Source | Endpoint | Format | Statut |
|--------|----------|--------|--------|
| **ESPN FIBA Scoreboard** | `site.web.api.espn.com/apis/site/v2/sports/basketball/fiba/scoreboard` | JSON | ✅ 200 OK |
| **ESPN FIBA Standings** | `site.web.api.espn.com/apis/v2/sports/basketball/fiba/standings` | JSON | ✅ 200 OK |
| **ESPN FIBA Summary** | `site.web.api.espn.com/apis/site/v2/sports/basketball/fiba/summary?event={id}` | JSON | ✅ 200 OK |
| **FIBA APIM Gateway** | `digital-api.fiba.basketball/hapi` | JSON | ✅ (clé publique) |
| **Basketball Reference** | HTML tables (`data-stat` attributes) | HTML | ⚠️ Scraper |
| **NBA/WNBA ESPN** | `site.api.espn.com/apis/site/v2/sports/basketball/{nba\|wnba}/scoreboard` | JSON | ✅ Existant |

### Clé API FIBA (publique, embarquée dans le JS client)
```
Ocp-Apim-Subscription-Key: 898cd5e7389140028ecb42943c47eb74
```

---

## 2. APIs ESPN FIBA

### Scoreboard — Structure JSON

```json
{
  "leagues": [{
    "id": "53",
    "name": "FIBA World Cup",
    "season": { "year": 2026 },
    "calendar": ["2026-09-04T07:00Z", "..."]
  }],
  "events": [{
    "id": "401907392",
    "date": "2026-09-04T09:30Z",
    "shortName": "AUS VS PUR",
    "competitions": [{
      "competitors": [{
        "team": {
          "abbreviation": "AUS",
          "displayName": "Australia",
          "logo": "https://a.espncdn.com/i/teamlogos/countries/500/aus.png",
          "color": "FFCD00"
        },
        "score": "70",
        "homeAway": "home",
        "records": [{ "summary": "1-0" }]
      }],
      "status": {
        "type": { "state": "post", "description": "Final" }
      },
      "notes": [{ "headline": "FIBA Women's World Cup - Group C" }],
      "venue": { "fullName": "Max-Schmeling-Halle", "address": { "city": "Berlin" } }
    }]
  }]
}
```

### Standings — Structure JSON

```json
{
  "children": [{
    "name": "Group A",
    "standings": {
      "entries": [{
        "team": { "abbreviation": "GER", "displayName": "Germany" },
        "stats": [
          { "name": "wins", "value": 0 },
          { "name": "losses", "value": 0 },
          { "name": "pointsfor", "value": 0 },
          { "name": "pointsagainst", "value": 0 },
          { "name": "points", "value": 0 }
        ]
      }]
    }
  }]
}
```

### Params utiles
- `?dates=YYYYMMDD` — filtrer par date
- `?season=2026` — saison explicit
- `?limit=100` — plus de matchs

---

## 3. FIBA Women's World Cup 2026

### Format
- **Dates** : 4–13 septembre 2026
- **Lieu** : Berlin, Allemagne (Max-Schmeling-Halle + Uber Arena)
- **Équipes** : 16 (expandi de 12)
- **Phase de groupes** : 4 groupes de 4

### Groupes

| Groupe | Équipe 1 | Équipe 2 | Équipe 3 | Équipe 4 |
|--------|----------|----------|----------|----------|
| **A** | 🇩🇪 GER | 🇯🇵 JPN | 🇲🇱 MLI | 🇪🇸 ESP |
| **B** | 🇫🇷 FRA | 🇭🇺 HUN | 🇳🇬 NGR | 🇰🇷 KOR |
| **C** | 🇦🇺 AUS | 🇧🇪 BEL | 🇵🇷 PUR | 🇹🇷 TUR |
| **D** | 🇺🇸 USA | 🇨🇿 CZE | 🇮🇹 ITA | 🇨🇳 CHN |

### Matchs Joués (4 sept 2026)
| Match | Score | Groupe |
|-------|-------|--------|
| JPN vs MLI | **102–97** | A |
| AUS vs PUR | **70–54** | C |

### Clés FIBA Women's Rankings (avril 2026)

| Rang | Équipe | Points |
|------|--------|--------|
| 1 | 🇺🇸 USA | 719.1 |
| 2 | 🇫🇷 FRA | 596.6 |
| 3 | 🇦🇺 AUS | 596.4 |
| 4 | 🇨🇳 CHN | 585.8 |
| 5 | 🇧🇪 BEL | 585.5 |
| 6 | 🇪🇸 ESP | 574.2 |
| 7 | 🇨🇦 CAN | 541.5 |
| 8 | 🇳🇬 NGR | 525.2 |
| 9 | 🇧🇷 BRA | 522.9 |
| 10 | 🇯🇵 JPN | 505.1 |

---

## 4. Classements FIBA

### Men's Top 15 (sept 2026)

| Rang | Équipe | Points | ± |
|------|--------|--------|---|
| 1 | 🇺🇸 USA | 952.3 | 0 |
| 2 | 🇩🇪 Germany | 877.4 | 0 |
| 3 | 🇫🇷 France | 870.9 | +1 |
| 4 | 🇷🇸 Serbia | 870.6 | -1 |
| 5 | 🇨🇦 Canada | 863.0 | 0 |

### Système de notation FIBA (nouveau, nov 2025)

**Équipe perdante** : `G = B × R × S`
- B (Base) = 10
- R (Région) : Europe=1.00, Amériques=0.93, Afrique=0.69, Asie/Océanie=0.68
- S (Stage) : Group=2.0 → Final=8.0

**Équipe gagnante** : `GW = G × W × O × A × M`
- W (Win) = 1.25
- O (Opponent) = 1 + 0.0001 × (rating perdant)
- A (Away) = 1.10 si extérieur
- M (Margin) : <15pts=1.00, 15-29=1.05, 30+=1.20

---

## 5. Modèles prédictifs — État de l'art

### Tier 1 — Production (concurrents)

| Source | Méthode | Précision | Innovation clé |
|--------|---------|-----------|----------------|
| **Dunks & Threes (EPM)** | SPM Bayesian + RAPM | RMSE 12.1 | Courbes de stabilisation machine-learned |
| **FiveThirtyEight (RAPTOR)** | Box + on/off | ~68-70% | Profondeur historique depuis 1976 |
| **Cleaning the Glass** | Play-by-play filtré | Usage NBA front offices | Suppression garbage time/heaves |
| **BasketballPredict.org** | ELO + Glicko | 67.1% (Brier 0.202) | International basketball |

### Tier 2 — Académique

| Paper | Métrique | Précision | Innovation |
|-------|----------|-----------|------------|
| **PLOS ONE (Ouyang 2024)** | XGBoost + SHAP | 84-88% | SHAP interprétabilité temps réel |
| **Random Forest (Four Factors)** | 4 facteurs | 93.8% | Simple et puissant |
| **Cervone et al. (2016)** | EPV (Expected Possession Value) | Framework probabiliste | Spatiotemporal, tracking data |
| **PLOS ONE (2025 review)** | MLP Neural Network | 98.9% | Meilleur accuracy publié |

### Tier 3 — Spécifique Women's basketball

| Source | Méthode | Précision | Notes |
|--------|---------|-----------|-------|
| **MDPI (2025)** | ML comparaison NBA/WNBA | Différences confirmées | WNBA = moins prévisible |
| **PredictionEngine (2026)** | XGBoost 82 features | Production WNBA | Usage rate > rolling averages |
| **Wharton WDSCE 2025** | Ensemble 4 modèles | NCAA Women's | Multi-model robustness |

---

## 6. Papers académiques analysés

### PDF 1 : Data-driven insights (Liang et al., 2025)
- **Méthode** : Logistic regression, Decision Trees, SVM
- **Findings** : TS% + DRtg = meilleurs prédicteurs NCAA ; PER plus important en NBA
- **Actionnable** : Poids spécifiques par ligue

### PDF 2 : Review of Statistics (Trunić & Milovanović, 2024)
- **PIR Formula** : (Pts+Reb+Ast+Stl+Blk+FT) - (MissedFG+MissedFT+LostBalls+BlocksReceived+Fouls)
- **Findings** : Assists corrèlent avec victoire (r=.42–.71)
- **Actionnable** : PIR comme métrique composite

### PDF 3 : FIBA Ranking Points (Statista, 2025)
- **Système complet** : Base × Region × Stage × Win × Opponent × Away × Margin
- **Actionnable** : Implémenter comme Elo juridique

### PDF 4 : Basketball Performance Metrics (Uysal et al., 2026)
- **NBA** : 3P% = meilleur prédicteur, DRtg non significatif
- **WNBA** : BLK + DRtg = meilleurs prédicteurs (ligue défensive)
- **Actionnable** : Modèles **obligatoirement** différents par ligue

### PLOS ONE : XGBoost+SHAP (Ouyang et al., 2024)
- **Top features** : FG%, DREB, TOV (tous stades) ; AST important tôt, 3P% important tard
- **Méthode** : XGBoost + SHAP pour interprétabilité temps réel
- **Code** : github.com/YanOuyang514 (supprimé)
- **Actionnable** : Architecture SHAP multi-étapes

### Spatiotemporal (Cervone et al., 2016) — EPV Framework
- **Concept** : Expected Possession Value = valeur attendue à chaque instant
- **Architecture** : Multiresolution (micro: mouvement joueurs, macro: événements possession)
- **Data** : SportVU tracking 25Hz, 1 billion de points espace-temps
- **Code** : github.com/dcervone/EPVDemo
- **Actionnable** : Le live-markov de PariScore suit la même philosophie

---

## 7. Concurrents

### Apps live
| App | Pattern UI | Innovation |
|-----|-----------|------------|
| **SofaScore** | Cards, radar charts, expandable details | Meilleure densité données |
| **ESPN** | WP bar sur scoreboard | Win probability overlay |
| **FlashScore** | Table dense, play-by-play timeline | Maximum données |
| **NBA.com** | Court visualization, shot charts | Tracking data visuel |

### Betting apps
| App | Pattern UI | Innovation |
|-----|-----------|------------|
| **DraftKings** | 3-col odds (Spread/ML/Total), props expand | 50+ live props |
| **FanDuel** | Minimaliste, "Live Now" prominent | Clean UX |
| **Bet365** | Dense, Bet Builder, Cash Out | Same-game parlays |

### Academic visualisations
| Source | Visualisation | Innovation |
|--------|--------------|------------|
| **ESPN WP Chart** | Area chart 0-100%, team colors | Gold standard |
| **Inpredictable** | WP + Excitement Index + WPA | Détail maximal |
| **Gamma Process (Song 2020)** | Fan charts avec intervalles | Prédiction score final |

---

## 8. Formules clés à implémenter

### 8.1 Elo Win Probability
```typescript
function eloWinProb(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}
```

### 8.2 Four Factors Composite
```typescript
function fourFactorsComposite(team: Stats, opp: Stats): number {
  const eFG = (team.FGM + 0.5 * team.TPM) / team.FGA;      // 40%
  const TOV = team.TOV / (team.FGA + 0.44 * team.FTA + team.TOV); // 25%
  const ORB = team.ORB / (team.ORB + opp.DRB);               // 20%
  const FTR = team.FTM / team.FGA;                            // 15%
  return 0.40 * eFG - 0.25 * TOV + 0.20 * ORB + 0.15 * FTR;
}
```

### 8.3 True Shooting %
```typescript
function tsPct(PTS: number, FGA: number, FTA: number): number {
  return PTS / (2 * (FGA + 0.44 * FTA));
}
```

### 8.4 PIR (Performance Index Rating)
```typescript
function pir(p: PStats): number {
  return (p.PTS + p.REB + p.AST + p.STL + p.BLK + p.FT_Fouls_Forced)
       - (p.MissedFG + p.MissedFT + p.Turnovers + p.Blocks_Received + p.Fouls_Committed);
}
```

### 8.5 FIBA Game Points
```typescript
function fibaGamePoints(base: number, isWin: boolean, oppRating: number, isAway: boolean, margin: number): number {
  let pts = base;
  if (isWin) {
    pts *= 1.25;
    pts *= (1 + 0.0001 * oppRating);
    if (isAway) pts *= 1.10;
    if (margin >= 30) pts *= 1.20;
    else if (margin >= 15) pts *= 1.05;
  }
  return pts;
}
```

### 8.6 WP Bar (UI)
```
|▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░|
|     TEAM_A 62%  ←──── WP ────→  TEAM_B 38% |
```

---

## 9. Architecture UI recommandée

### Composants à créer

| Composant | Description | Source inspiration |
|-----------|-------------|-------------------|
| `FibaScoreboard` | Scoreboard FIBA avec WP bar | ESPN broadcast |
| `FibaStandings` | Standings par groupe | ESPN FIBA page |
| `FibaGameCard` | Carte match avec WP live | DraftKings + ESPN |
| `WinProbabilityBar` | Barre WP horizontale | ESPN broadcast |
| `WinProbabilityChart` | Graphique WP area chart | Inpredictable |
| `MomentumIndicator` | Sparkline momentum | Chen & Fan 2018 |
| `EdgeBadge` | Badge edge vs marché | Custom |
| `PredictionPanel` | Panel prédictions prematch | Custom |
| `LivePredictionOverlay` | Overlay live predictions | Custom |
| `FourFactorsDisplay` | Affichage Four Factors | Cleaning the Glass |

### Layout recommandé

```
┌─────────────────────────────────────────────────────┐
│ 🏀 FIBA Women's WC 2026                    LIVE (3) │
│ ┌─────────────────────────────────────────────────┐ │
│ │ Group A    Group B    Group C    Group D        │ │
│ │ [GER JPN] [FRA HUN] [AUS BEL] [USA CZE]       │ │
│ │ [MLI ESP] [NGR KOR] [PUR TUR] [ITA CHN]       │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ ┌─ LIVE ─────────────────────────────────────────┐  │
│ │ 🟢 USA vs CHN          Q2 4:32   45-38        │  │
│ │ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░  │  │
│ │     USA 78%  ←── WP ──→  CHN 22%              │  │
│ │ Edge: +4.2% on USA spread  [Kelly: 2.1%]      │  │
│ │ ┌──────────┬──────────┬──────────┐            │  │
│ │ │ Spread   │ Money    │ Total    │            │  │
│ │ │ USA -12  │ USA -400 │ O 164.5  │            │  │
│ │ │ -110     │ -400     │ -110     │            │  │
│ │ └──────────┴──────────┴──────────┘            │  │
│ └─────────────────────────────────────────────────┘  │
│                                                     │
│ ┌─ PRÉDICTIONS ──────────────────────────────────┐  │
│ │ 📊 Modèle: USA 78.2% | Marché: 80.0%          │  │
│ │ 📈 WP Chart (expandable)                       │  │
│ │ 🎯 Score prédit: 89-74 | O/U: 163.2           │  │
│ │ 🔢 Four Factors: eFG +8.2% | TOV -2.1%        │  │
│ └─────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

### Color system (aligné PariScore)
- Live indicator : `#00e676` (vert néon)
- Home team : `#2196f3` (bleu)
- Away team : `#f44336` (rouge)
- Edge positif : `#00e676`
- Confiance haute : `#00e676`
- Confiance basse : `#ffc107`
- Background : `#0a0e1a` (navy dark)

---

## 10. Pipeline de données

### Architecture

```
ESPN FIBA API ──┐
                ├──→ /api/fiba/scoreboard ──→ FibaScoreboard
FIBA APIM ──────┘                             │
                                              ├──→ WP Calculator
ESPN FIBA Standings ──→ /api/fiba/standings ──┤
                                              ├──→ Four Factors Engine
Basketball Ref ──→ Scraper (cache 24h) ───────┤
                                              ├──→ Elo/Glicko System
FIBA Rankings ──→ /api/fiba/rankings ─────────┘
                                              │
                                              ▼
                                    Predictions Engine
                                    ├── prematch: Elo + Four Factors + Rankings
                                    └── live: WP bar + Momentum + Edge detection
```

### Caching
- Scoreboard : 30s (live), 5min (prematch)
- Standings : 1h
- Rankings : 24h
- Basketball Reference : 24h (season stats)

---

*Ce rapport servira de source de vérité pour l'implémentation de la section Basketball de ParisScore.*
