# Plan d'Implémentation Unifié — Projections & Enrichissement Données
## Fusion : Analyse académique + Revue presse/analystes + OddAlerts

**Date** : 2026-09-09  
**Sources** : `.context/analyse-projections-classements.md` + `.context/analyse-presse-analystes-projections.md`

---

## Table des matières

1. [Synthèse des 2 analyses](#1-synthèse)
2. [OddAlerts : ce qu'on peut récupérer](#2-oddalerts)
3. [Données déjà disponibles vs manquantes](#3-gap-analysis)
4. [Plan unifié par phase](#4-plan)
5. [Priorisation et planning](#5-priorisation)

---

## 1. Synthèse des 2 analyses

### Ce que la littérature académique dit

| Constat | Source | Implication |
|---------|--------|-------------|
| La qualité des features compte plus que le modèle | Kissinger 2024 | Investir dans les données, pas dans un nouveau modèle ML |
| AGD (70% xG + 30% buts) = métrique la plus prédictive | ESPN/O'Hanlon | ✅ Déjà calculé dans PariScore (`computeXGd`) |
| Glicko-2 adaptatif = state-of-the-art 2026 | arXiv:2607.01722 | ELO dynamique par équipe (pas global 1500) |
| Seuils CL : 15 pts = 22% R16 (pas 73% comme Opta) | Winkelmann 2025 | Modèle académique > Opta pour la CL |
| xG post-match = meilleur prédicteur | Frontiers 2025 | Utiliser xG ajusté en cours de saison |

### Ce que la presse/analystes publient

| Pattern | Source | Donnée clé |
|---------|--------|-----------|
| "Magic numbers" titre | Man City blueprint | 87 pts, 27V, +1.4 xG net |
| Season Objectives | Opta/BBC/Athletic | % titre, % top4, % relégation par équipe |
| AGD in-season | ESPN | Projection mise à jour après chaque journée |
| Luck Factor | ESPN | xPts vs pts réels → régression à la moyenne |
| Market value correlation | ESPN/Transfermarkt | r≈0.85 avec position finale |

### Ce qu'OddAlerts fournit (HTML match)

**36 valeurs home/away** + referee + weather + filtres form :
- League Position, Played, Win%, Draw%, Lost%, Points, PPG
- Goal Difference, Shots AVG/For/Against, SoT AVG/For/Against
- Dangerous Attacks PG/For/Against, Tackles PG/Made
- Offsides AVG/For/Against

---

## 2. OddAlerts : ce qu'on peut récupérer

### État actuel du scraper

| Composant | Statut | Fichier |
|-----------|--------|---------|
| Scraper ligue | ✅ Fonctionnel | `scripts/scrape-oddalerts.js` |
| Pages match | ❌ Jamais scrapées | — |
| Types DB | ⚠️ Ligue seulement | `src/lib/leagues-stats/types.ts` |
| Route API | ✅ Ligue seulement | `/api/v1/leagues-stats/[country]/[slug]` |

### Ce que le scraper ligue fait déjà

`scripts/scrape-oddalerts.js` parse les pages `/leagues/{country}/{slug}` :
- General (GP, Home Wins%, Draws%, Away Wins%, Total Goals)
- Over/Under (X.5 Goals %)
- Goals by Half (1H/2H)
- Card Stats (totaux, avg, overs)
- BTTS Stats (%)
- Corner Stats (totaux, avg, overs)

**Via regex DOM** (pas de parser HTML, `parseSections()` :280 + `parseStatGrid()` :257).

### Ce que les pages match ajoutent (HTML fourni)

Le HTML de la section `form` d'un match OddAlerts contient **~36 stats home/away** qui ne sont PAS dans le scraper ligue :

| Catégorie | Données | Home/Away |
|-----------|---------|-----------|
| **Form** | League Pos, Played, Win%, Draw%, Lost%, Points, PPG, GD | ✅ |
| **Shots** | Shots AVG, Shots For, Shots Against | ✅ |
| **SoT** | SoT AVG, SoT For, SoT Against | ✅ |
| **Attacks** | Dang. Attacks PG, For, Against | ✅ |
| **Tackles** | Tackles PG, Tackles Made PG | ✅ |
| **Offsides** | AVG, For, Against | ✅ |
| **Contexte** | Referee, Weather, Form filter (5/6/25) | — |

### Recommandation : 2 options

#### Option A : Scrapper les pages match OddAlerts (recommandé)

**Avantage** : 36 nouvelles stats home/away par match, referee, weather.  
**Inconvénient** : nécessite FlareSolverr (Cloudflare), ~1s par match, quota.

**Pattern URL** : `oddalerts.com/leagues/{country}/{slug}/{match-slug}`  
**Parsing** : regex DOM sur `<div class="stat-row">` → `<div class="stat">` + `<span class="stat-title"><span>TITLE</span></span>`

**Données déjà dispo dans BSD** (pas besoin de scraper) :
- `shots_on_target` → ✅ déjà dans `live_stats.home.shots_on_target`
- `corner_kicks` → ✅ déjà dans `live_stats.home.corner_kicks`
- `dangerous_attacks` → ✅ déjà dans `live_stats.home.dangerous_attacks`

**Données UNIQUEMENT dans OddAlerts** (à scraper) :
- League Position, Played, Win%, Draw%, Lost%, Points, PPG, GD
- Shots AVG/For/Against (pas juste SoT)
- Tackles PG, Tackles Made PG
- Offsides AVG/For/Against
- Referee name
- Weather

#### Option B : Enrichir le scraper ligue existant

**Avantage** : pas de nouveau scraping, juste ajouter des champs.  
**Inconvénient** : les données sont agrégées par ligue, pas par match. Moins utile pour les projections individuelles.

**Verdict** : L'**Option A** est recommandée car les stats home/away par match sont exactement ce qu'il faut pour améliorer les projections (strength of schedule, forme spécifique vs adversaire).

### Implémentation scraper match OddAlerts

```
Nouveau script : scripts/scrape-oddalerts-match.js
- Input : URL match OddAlerts
- FlareSolverr (déjà configuré pour oddalerts)
- Parse : regex DOM sur stat-row (même pattern que scrape-oddalerts.js)
- Output : JSON { league_pos, played, win_pct, draw_pct, lost_pct, points, ppg, gd, shots_avg, shots_for, shots_against, sot_avg, sot_for, sot_against, dang_attacks, dang_attacks_for, dang_attacks_against, tackles_pg, tackles_made, offsides_avg, offsides_for, offsides_against, referee, weather }
- DB : nouvelle table match_form_stats ou extension de statsJson
```

---

## 3. Données déjà disponibles vs manquantes

### Matrice complète

| Donnée | BSD | OddAlerts ligue | OddAlerts match | Football-Data | Understat | soccerstats |
|--------|-----|----------------|-----------------|---------------|-----------|-------------|
| **Scores + cotes** | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| **xG (live + final)** | ✅ | ❌ | ❌ | ❌ | ✅ (5 ligues) | ❌ |
| **Standings** | ✅ | ✅ (stats agrégées) | ✅ (par match) | ✅ | ❌ | ✅ (home/away) |
| **Shots / SoT** | ✅ (live) | ❌ | ✅ (AVG/For/Against) | ❌ | ✅ | ❌ |
| **Corners** | ✅ (live) | ✅ (stats ligue) | ❌ (pas dans form) | ✅ | ❌ | ❌ |
| **Dangerous Attacks** | ✅ (live) | ❌ | ✅ (PG/For/Against) | ❌ | ❌ | ❌ |
| **Tackles** | ❌ | ❌ | ✅ (PG/Made) | ❌ | ❌ | ❌ |
| **Offsides** | ❌ | ❌ | ✅ (AVG/For/Against) | ❌ | ❌ | ❌ |
| **Forme W/D/L** | ⚠️ (partiel) | ✅ (stats ligue) | ✅ (All/5/6/25) | ✅ | ❌ | ✅ |
| **Referee** | ✅ (BSD) | ❌ | ✅ | ❌ | ❌ | ❌ |
| **Weather** | ✅ (BSD) | ❌ | ✅ | ❌ | ❌ | ❌ |
| **PPDA/Pressing** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Head-to-head** | ⚠️ (limité) | ❌ | ✅ (lien H2H) | ✅ | ❌ | ❌ |
| **Blessures** | ⚠️ (partiel) | ❌ | ✅ (toggle injuries) | ❌ | ❌ | ❌ |

### Ce qui manque le plus pour les projections

| Priorité | Donnée | Impact sur projections | Source recommandée |
|----------|--------|----------------------|-------------------|
| 🔴 P0 | **Forme home/away spécifique** (5-10 derniers) | Élevé — force récente par contexte | OddAlerts match (form filter) |
| 🔴 P0 | **Shots/SoT moyens** (pas juste live) | Élevé — proxy d'attaque/défense | OddAlerts match |
| 🟡 P1 | **Dangerous Attacks moyens** | Moyen — proxy de pressing | OddAlerts match |
| 🟡 P1 | **Tackles/Offsides** | Faible — données de niche | OddAlerts match |
| 🟡 P1 | **H2H complet** | Moyen — head-to-head historique | OddAlerts match (lien) |
| 🟢 P2 | **Blessures détaillées** | Moyen — impact compos | OddAlerts match (toggle) |

---

## 4. Plan unifié par phase

### Phase 1 : Moteur de projection amélioré (1-2 semaines)

#### 1.1 ELO dynamique par équipe
**Fichier** : `src/lib/prediction/football/engine.ts`  
**Fichier** : `src/lib/elo-dynamic.ts` (nouveau)

```typescript
// Stocker les ratings ELO par équipe (Map ou better-sqlite3)
// Mise à jour après chaque match : R_new = R_old + K × G × (W - W_e)
// Gérer deviation (incertitude) et volatilité (Glicko-2)
type EloRating = {
  rating: number;      // 1500 initial
  deviation: number;   // 350 initial (incertitude)
  volatility: number;  // 0.06 initial
  lastMatch: string;   // ISO date
};
```

- K=30 pour top-5 ligues, K=5 pour mineures
- Home advantage = +100 (ou team-specific si calculé)
- Decay temporel : rating vieillissant → deviation augmente

#### 1.2 xG-adjusted lambda
**Fichier** : `src/lib/table-projection.ts`

```typescript
// Avant: lambda = (GF/GF_avg) × (GA/GA_avg) × BTW
// Après: lambda = (0.7 × xG + 0.3 × GF) / avg × (0.7 × xGA + 0.3 × GA) / avg × BTW
// Utilise computeXGa() existant (football-predictions.ts:284)
```

#### 1.3 Home advantage team-specific
**Fichier** : `src/lib/table-projection.ts`

- Calculer PPG home - PPG away par équipe (depuis OddAlerts ou BSD)
- Remplacer le facteur global 100 (ELO) ou 2.70 (BTW)

#### 1.4 Strength of schedule
**Fichier** : `src/lib/strength-of-schedule.ts` (nouveau)

```typescript
export function remainingDifficulty(
  teamId: string,
  fixtures: Fixture[],
  ratings: Map<string, number>
): number {
  const remaining = fixtures.filter(f => f.homeId === teamId || f.awayId === teamId);
  return remaining.reduce((sum, f) => {
    const opponentId = f.homeId === teamId ? f.awayId : f.homeId;
    return sum + (ratings.get(opponentId) ?? 1500);
  }, 0) / remaining.length;
}
```

### Phase 2 : Scraper OddAlerts match (1 semaine)

#### 2.1 Nouveau script : `scripts/scrape-oddalerts-match.js`

**Pattern URL** : `oddalerts.com/leagues/{country}/{slug}/{match-slug}`  
**Méthode** : FlareSolverr (Cloudflare) + regex DOM  
**Output** : JSON structuré par stat-row

```javascript
// Parse le HTML de la section form :
// <div class="stat-row">
//   <div class="stats">
//     <div class="stat">VALUE_HOME</div>
//     <div class="stat-title"><span>LABEL</span></div>
//     <div class="stat">VALUE_AWAY</div>
//   </div>
//   <div class="bars">...</div>
// </div>

const STAT_MAP = {
  "League Pos.": "leaguePosition",
  "Played": "played",
  "Win %": "winPct",
  "Draw %": "drawPct",
  "Lost %": "lostPct",
  "Points": "points",
  "Points Per Game": "ppg",
  "Goal Difference": "goalDifference",
  "Shots (AVG)": "shotsAvg",
  "Shots For (AVG)": "shotsForAvg",
  "Shots Against (AVG)": "shotsAgainstAvg",
  "SoT (AVG)": "sotAvg",
  "SoT For (AVG)": "sotForAvg",
  "SoT Against (AVG)": "sotAgainstAvg",
  "Dang. Attacks PG": "dangAttacksPg",
  "Dang. Attacks For PG": "dangAttacksForPg",
  "Dang. Attacks Against PG": "dangAttacksAgainstPg",
  "Tackles PG": "tacklesPg",
  "Tackles Made PG": "tacklesMadePg",
  "AVG Offsides": "offsidesAvg",
  "AVG Offsides For": "offsidesForAvg",
  "AVG Offsides Agnst": "offsidesAgainstAvg",
};
// + Referee, Weather
```

#### 2.2 Schéma DB

```sql
CREATE TABLE IF NOT EXISTS match_form_stats (
  match_id TEXT PRIMARY KEY,
  home_stats_json TEXT,  -- { leaguePosition, played, winPct, ... }
  away_stats_json TEXT,
  referee TEXT,
  weather TEXT,
  source TEXT DEFAULT 'oddalerts',
  updatedAt DATETIME
);
```

#### 2.3 Route API

```
GET /api/football/match-form?matchId=bsd-12345
→ { home: { leaguePosition, ppg, shotsForAvg, ... }, away: {...}, referee, weather }
```

### Phase 3 : Enrichissement UI (1 semaine)

#### 3.1 AGD + Luck Factor dans le panel
**Fichier** : `src/components/football/besoccer-table-panel.tsx`

```
┌─────────────────────────────────────┐
│  ADJUSTED TABLE                     │
│                                     │
│  Pos │ Team     │ xPts │ Pts │ Luck │
│  1   │ Arsenal  │ 22.5 │ 24  │ +1.5 │
│  2   │ Man City │ 23.0 │ 21  │ -2.0 │
│  ...                                │
│                                     │
│  AGD: Arsenal +1.28 (1st)           │
│  AGD: Man City +0.83 (2nd)          │
└─────────────────────────────────────┘
```

#### 3.2 Season Objectives
**Fichier** : `src/components/football/besoccer-table-panel.tsx`

```
┌─────────────────────────────────────┐
│  SEASON TARGETS                     │
│                                     │
│  Arsenal        │    Man City       │
│  ──────────     │    ──────────     │
│  Title: 38%     │    Title: 20.5%   │
│  Top 4: 83%     │    Top 4: 69.4%   │
│  Releg: 0%      │    Releg: 0%      │
│                                     │
│  Projected: 74.8 pts (1st)          │
│  Projected: 68.4 pts (2nd)          │
│                                     │
│  Objectif titre: 87 pts / 27V       │
│  xG net requis: +1.4                │
└─────────────────────────────────────┘
```

#### 3.3 Stats de forme enrichies (OddAlerts)
**Fichier** : `src/components/football/fotmob-match-stats.tsx`

Ajouter aux stats existantes (possession/xG/shots) :
- Forme home/away (5 derniers : W/D/L + PPG)
- Shots AVG/For/Against
- SoT AVG/For/Against
- Dangerous Attacks PG

#### 3.4 Panel CL/EL avec seuils académiques
**Fichier** : `src/components/football/cl-projection-panel.tsx` (nouveau)

```
CHAMPIONS LEAGUE — League Phase
Seuils de qualification (Winkelmann 2025):
  17 pts → 100% R16
  16 pts → 74% R16
  15 pts → 22% R16, 78% play-off
  10 pts → 47% play-off
```

### Phase 4 : API publique + documentation (1 semaine)

#### 4.1 API prédictions
```
GET /api/v1/predictions?league=pl&matchday=10
→ { matches: [{ home, away, homeProb, drawProb, awayProb, xG, model, agd }] }
```

#### 4.2 CSVs téléchargeables
```
public/data/predictions/pl_predictions_2026.csv
public/data/predictions/la_liga_predictions_2026.csv
```

#### 4.3 Méthodologie publique
```
docs/METHODOLOGY.md — description complète du modèle, données, calibration
```

---

## 5. Priorisation et planning

### Roadmap unifiée

| Phase | Contenu | Durée | Dépendances |
|-------|---------|-------|-------------|
| **P1.1** | ELO dynamique par équipe | 3-4 j | — |
| **P1.2** | xG-adjusted lambda | 1 j | — |
| **P1.3** | Home advantage team-specific | 1 j | Données OddAlerts |
| **P1.4** | Strength of schedule | 1 j | ELO dynamique |
| **P2.1** | Scraper OddAlerts match | 2-3 j | FlareSolverr |
| **P2.2** | Schéma DB + route API | 1 j | P2.1 |
| **P3.1** | AGD + Luck Factor UI | 1 j | P1.2 |
| **P3.2** | Season Objectives UI | 1 j | P1.1 |
| **P3.3** | Stats forme enrichies | 1 j | P2.2 |
| **P3.4** | Panel CL/EL | 2 j | — |
| **P4.1** | API publique | 2 j | P1.1-P1.4 |
| **P4.2** | CSVs + documentation | 1 j | P4.1 |
| **P5** | **Refonte design Top 10 → FotMob clair** | **1-2 j** | **—** |
| **Total** | | **17-21 j** | **3-4 semaines** |

### Quick wins (impact élevé, faible effort)

| Action | Effort | Impact | Quand |
|--------|--------|--------|-------|
| AGD dans le panel | 0.5 j | 🔴 Élevé | Maintenant |
| Luck Factor (xPts - pts) | 0.5 j | 🔴 Élevé | Maintenant |
| Home advantage team-specific | 1 j | 🯊 Moyen | Semaine 1 |
| Season Objectives (precomputed) | 1 j | 🔴 Élevé | Semaine 1 |

### Ce qui change vs les 2 plans initiaux

| Élément | Plan académique | Plan presse | Plan unifié |
|---------|----------------|-------------|-------------|
| ELO dynamique | ✅ | — | ✅ Phase 1.1 |
| xG-adjusted | ✅ | ✅ (AGD) | ✅ Phase 1.2 |
| Strength of schedule | ✅ | — | ✅ Phase 1.4 |
| Home advantage team-specific | ✅ | — | ✅ Phase 1.3 |
| Scraper OddAlerts match | — | — | ✅ Phase 2 (NOUVEAU) |
| AGD + Luck Factor UI | — | ✅ | ✅ Phase 3.1 |
| Season Objectives | — | ✅ | ✅ Phase 3.2 |
| Panel CL/EL | ✅ | — | ✅ Phase 3.4 |
| API publique | ✅ | — | ✅ Phase 4 |
| Stats forme OddAlerts | — | — | ✅ Phase 3.3 (NOUVEAU) |
| **Refonte design Top 10 → FotMob clair** | — | — | ✅ **Phase 5 (NOUVEAU)** |

### Phase 5 : Refonte design — Top 10 par stratégie en FotMob clair (1-2 jours)

#### Contexte actuel

| Composant | Design | Position | Fichier |
|-----------|--------|----------|---------|
| `FotmobCalendarTable` | FotMob clair (blanc, `#f0f0f0`, `#00985f`) | Dans `TopMultiSport` | `fotmob-calendar-table.tsx` |
| `FootballTop10Widget` + `TopStrategiesTable` | Dark (`#0f172a`, `slate-700`, `emerald-400`) | Sous le calendrier, `pt-4` | `football-top10-widget.tsx`, `top-strategies-table.tsx` |

**Problème** : Le Top 10 utilise un theme dark mientras que le calendrier est en FotMob clair. Le user veut un design unifié.

#### 5.1 Refonte `TopStrategiesTable` → FotMob clair

**Avant** (dark theme) :
```
bg-slate-900/50, border-slate-700/50, text-slate-100, bg-slate-800/50
Badge confiance: emerald-400/amber-400/slate-400
```

**Après** (FotMob clair — même tokens que `FotmobCalendarTable`) :

```typescript
const C = {
  card: '#ffffff',
  cardBorder: '#f0f0f0',
  rowSep: '#f5f5f5',
  headerBg: '#f5f5f5',
  headerText: '#000000',
  team: '#222222',
  time: '#717171',
  live: '#00985f',
  accent: '#00985f',
  score: '#222222',
};
```

**Layout** : Même CSS Grid 5 colonnes que le calendrier :
```
gridTemplateColumns: "1fr auto auto 1fr auto"
```

| Col | Contenu | Style |
|---|---|---|
| 1 | Home team (logo + nom) | `text-[13px] text-[#222]` |
| 2 | Badge stratégie (ex: "Over 2.5") | `rounded-full bg-[#00985f]/10 text-[#00985f] text-[10px] px-2 py-0.5` |
| 3 | Prob + Cote | `font-mono text-[13px] text-[#222]` |
| 4 | Away team (logo + nom) | `text-[13px] text-[#222]` |
| 5 | EV badge + tendance | `text-[11px]` vert/rose |

**Container** :
```
rounded-2xl border border-[#f0f0f0] bg-white overflow-hidden
```

**Header** :
```
bg-[#f5f5f5] h-10 px-4 flex items-center
text-[13px] font-semibold text-[#000]
+ badge compteur: rounded-full bg-[#00985f]/10 text-[#00985f] text-[11px] px-2
```

**Lignes** :
```
px-3 py-2 border-b border-[#f5f5f5]
hover:bg-[#f8f8f8] transition-colors
```

**Badges de confiance** (remplacement des badges dark) :

| Confiance | Avant (dark) | Après (FotMob clair) |
|-----------|-------------|---------------------|
| Élevée ≥70% | `bg-emerald-500/15 text-emerald-400` | `bg-[#00985f]/10 text-[#00985f]` |
| Moyenne ≥60% | `bg-amber-500/15 text-amber-400` | `bg-[#FF6D00]/10 text-[#FF6D00]` |
| Faible <60% | `bg-slate-500/15 text-slate-400` | `bg-[#f0f0f0] text-[#717171]` |

**EV badge** :
```
Positif: text-[#00985f] (vert live)
Négatif: text-[#EF4444] (rouge)
```

#### 5.2 Intégration dans `TopMultiSport` ou `page.tsx`

**Option A (recommandée)** : Déplacer `FootballTop10Widget` dans `TopMultiSport` juste après `FotmobCalendarTable`, dans le même container FotMob clair.

**Option B** : Garder dans `page.tsx` mais avec un wrapper qui matche le style.

**Dans `page.tsx`** (ligne ~370) :
```tsx
{/* Calendrier + Top 10 — football prematch */}
{activeTab === "football" && headerMode === "prematch" && (
  <section className="w-full px-4 sm:px-6 pt-6">
    <TopMultiSport activeSport="football" mode="prematch" />
    {/* Top 10 intégré directement sous le calendrier */}
    {!footballLoading && prematchMatches.length > 0 && (
      <div className="mt-4">
        <FootballTop10Widget matches={prematchMatches} />
      </div>
    )}
  </section>
)}
```

#### 5.3 Composants shadcn/ui à réutiliser

| Composant | Usage | Fichier |
|-----------|-------|---------|
| `Badge` (variant outline) | Badge confiance | `src/components/ui/badge.tsx` |
| `Table`/`TableHeader`/`TableBody` | Structure tableau (optionnel, peut rester HTML) | `src/components/ui/table.tsx` |
| `Select` | Filtre stratégie | `src/components/ui/select.tsx` |

#### 5.4 Fichiers à modifier

| Fichier | Modification |
|---------|-------------|
| `src/components/football/top-strategies-table.tsx` | Refonte complète : dark → FotMob clair, CSS Grid 5 colonnes |
| `src/components/football/football-top10-widget.tsx` | Container white au lieu de dark, header FotMob |
| `src/app/page.tsx` | Déplacer le Top 10 sous le calendrier dans le même bloc |

---

## Références

1. `.context/analyse-projections-classements.md` — Revue académique + concurrents
2. `.context/analyse-presse-analystes-projections.md` — Revue presse + analystes
3. `scripts/scrape-oddalerts.js` — Scraper ligue existant
4. `src/lib/table-projection.ts` — Monte Carlo existant
5. `src/lib/prediction/football/engine.ts` — Moteur ELO → Poisson
6. `src/lib/football-predictions.ts` — computeXGa, enrichissement
7. `src/components/football/besoccer-table-panel.tsx` — Panel projection
