# Rapport de Mission — Refonte de l'onglet « Historique » PariScore

**Date** : 20 mai 2026
**Auteur** : GM PariScore (Claude Code) · cellule Product + UX + Data Architect + Quant
**Mission** : transformer le fourre-tout actuel `#page-historique` en un véritable **Data Hub Historique** segmenté (Foot / Tennis) avec recherche multi-critères, suivi des stratégies IA, et restitution premium fintech.
**Statut** : `DRAFT` — pré-validation DG (David) requise avant tout commit.

---

## 1. Executive Summary (TL;DR)

- L'onglet **Historique actuel** de PariScore est un panneau de **backtesting global** : 4 KPIs, 2 graphiques cumulatifs (Over 2.5 / BTTS), 1 chart bankroll simulée, 1 tableau plat de 6 colonnes (`Match · Date · Score · Over 2.5 · BTTS · Edge`). Aucune segmentation Foot/Tennis, aucun filtre serveur, pas de recherche par équipe/ligue/joueur/stratégie IA.
- Les **3 concurrents leaders** se sont structurés différemment :
  - **OddAlerts** = **Profit Calculator** sur filtres composés (Quick Filters + 90j/6m/1an/all-time + métriques `Yield · Max Drawdown · Longest Losing Streak · Avg EV · Avg Odds · Break-even Strike Rate`).
  - **Datafoot** = **outil grand-public** segmenté en 5+ modules (Value Bets · Bêtes Noires · Super Stats · Bankroll Manager · Datafoot+ algorithmes custom · export CSV) sur 90+ championnats.
  - **BetMines** = **Pre-Match Scanner / Live Scanner / Statistical Filter / BetMines Machine** avec 40 filtres de base (extensible 150), backtest 1s/1m/3m/6m/9m, **ROI par ligue**.
- **Proposition Data Hub PariScore** : page Historique refondue en **3 zones** — bandeau **KPI rolling périodisable** · **filter rail latéral persistant** (sport · période · ligue · équipe/joueur · marché · stratégie IA · cote · proba · EV · streak) · **vue centrale switchable** (Tableau / Charts / Stratégies). Toggle **Foot / Tennis** premier niveau. Nouvelle route `GET /api/v1/history/query` avec pagination + agrégations.
- **Différenciation premium fintech** : Sub-tab **« Strategy Tracker »** (perf temporelle par stratégie IA — Artilleur · Foudroyeur · Sniper · PowerScore · Quant) absent chez les 3 concurrents. C'est notre **moat** explicable.

---

## 2. État des Lieux PariScore (ce que nous avons aujourd'hui)

### 2.1 Frontend (`pariscore.html` lignes 8243-8317, 24092-24166)
```
#page-historique
├── #backtest-section (Premium/Admin) — selector 7j/14j/30j + bouton « Lancer »
├── #hist-alert (rouge) — alerte si winrate < 45% sur 20 derniers
├── #hist-kpis — 4 cartes : Win Rate Over 2.5 · Win Rate BTTS · Win Rate Edge · Matchs vérifiés
├── #hist-chart (Chart.js line) — Précision cumulée Over 2.5 (>55% conf.)
├── #hist-btts-chart (Chart.js line) — Précision cumulée BTTS (>55% conf.)
├── #accuracy-trend-wrap (hidden) — Tendance hebdomadaire
├── #bankroll-wrap (hidden) — Bankroll simulée 100u
└── .hist-table — 6 colonnes : Match · Date · Score · Over 2.5 · BTTS · Edge
```

### 2.2 Backend (`server.js` ligne 19172)
```js
if (pathname === '/api/v1/history') {
  const limit = parseInt(query.limit) || 50;
  return jsonResponse(res, 200, {
    matches:  history.slice(-limit).reverse(),
    accuracy: getAccuracyReport(),
    total:    history.length,
  });
}
```
**Une seule route, aucun filtre serveur, slice naïf.**

### 2.3 Lacunes identifiées (gap analysis)

| # | Lacune | Impact parieur |
|---|--------|----------------|
| L1 | **Pas de séparation Foot / Tennis** — tout est mélangé dans une seule table | Impossible d'auditer perf tennis isolément |
| L2 | **Pas de filtres serveur** — `?limit=` est le seul paramètre | Pas de recherche, pas de pagination réelle |
| L3 | **Pas de filtres frontend** — pas de search ligue/équipe/joueur | Force l'œil à scanner le tableau manuellement |
| L4 | **Tableau plat** — 6 colonnes uniquement (Match · Date · Score · O2.5 · BTTS · Edge) | Marchés couverts < 10% de l'offre (manque 1X2, HT, CS, corners, cartons, props tennis sets/jeux/aces) |
| L5 | **Pas de tracking par stratégie IA** — Artilleur, Foudroyeur, Sniper, PowerScore Tennis, Quant ne sont pas back-trackés individuellement | DG ne peut pas comparer ROI relatif des stratégies |
| L6 | **Pas de calendrier / date-picker** — uniquement "dernier 100 matchs" | Impossible d'analyser une période précise (Coupe du Monde, Roland-Garros…) |
| L7 | **KPIs globaux uniquement** — rolling30 partiel, pas de rolling7/14/90/365 | Pas de lecture de tendance court vs long terme |
| L8 | **Drawdown unique** — pas de longest losing streak, break-even strike rate, avg EV | KPIs trading absents |
| L9 | **Pas d'export CSV** — déjà présent sur `Mes Paris` mais absent ici | Tipsters/analystes ne peuvent pas exporter |
| L10 | **Pas de drill-down** — clic sur un match passé n'ouvre rien | Impossible de revoir le contexte de la prédiction |
| L11 | **Pas de comparateur multi-filtres** — pas de "comparer ma stratégie A vs B sur 6 mois" | Pas de A/B backtesting |
| L12 | **Pas de bilan H2H / bête noire** — pattern team-vs-team absent | Datafoot prend ce terrain (Bêtes Noires) |

---

## 3. Benchmark Concurrentiel

### 3.1 OddAlerts (oddalerts.com)

**Positionnement** : plateforme premium anglo-saxonne axée **Value Bets + EV-based filtering**. Saa$$ (plan Pro).

**Structure historique** :
- Module **Filters** (`/filters`) — moteur de filtres composables avec **Quick Filters** prédéfinis ("Home Wins with over 10% value in High Predictability leagues").
- Module **Profit Calculator** — bouton « Profit tab » qui calcule **instantanément** le P/L unités sur les filtres actifs.
- Sélecteur de **période backtest** : `90 days · 6 months · 1 year · all-time`.
- Module **Dropping Odds** (`/dropping-odds`) — tracking baisse de cotes historiques.
- API publique : **6 mois d'historique** (Opening · Closing · Peak odds par bookmaker).

**KPIs affichés sur backtest** (les "metrics that matter most" selon eux) :
1. **Yield** (rendement %)
2. **Max Drawdown**
3. **Longest Losing Streak**
4. **Average EV**
5. **Average Odds**
6. **Break-even Strike Rate**

**UI** : approche **terminal data dense** — filters rail à gauche persistant, tableau central, KPI strip en haut, graph en bas.

**Ce qu'il y a de premium chez eux** :
- Le **strike rate break-even** = la métrique pro qui dit "à partir de quel %WR tu deviens rentable avec ces cotes". Aucun concurrent FR ne l'affiche.
- L'ergonomie **Filter → Profit instantanément** sans rechargement.

**Faiblesse** : ZÉRO tennis (foot only), interface 100% EN, pas d'explicatif IA "pourquoi parier".

---

### 3.2 Datafoot (datafoot.fr)

**Positionnement** : SaaS français grand-public, multi-outils. Aspirationnel "70% success rate" (marketing).

**Modules historiques identifiés** :
- **Value Bets** — détection cotes avantageuses algorithmiques.
- **Bêtes Noires** — section dédiée pattern "équipes qui posent problèmes à d'autres" sur 90+ championnats. *Différenciateur fort.*
- **Super Stats** — taux réalisation paris par forme & H2H, **graphs historiques**.
- **Bankroll Manager** — ROI · % victoire · cote moyenne · évolution bankroll · stats par type de pari.
- **Datafoot+** — moteur **création d'algorithmes custom** par l'utilisateur (no-code).
- **Téléchargement CSV** — bouton sur chaque page (export Excel/Sheets).
- **Couverture** : 90+ championnats, **odds history depuis fin 2023**.

**UI** : dashboards customisables, filtres par championnat/équipe/période, indicateurs santé équipe, classements officiels.

**Faiblesse** :
- Branding amateur (claims 70% peu crédibles côté quant).
- Pas de **EV pur** ni **Yield no-vig**.
- Pas de scanner live ni alertes value temps réel structurées.
- Tennis : non traité.

---

### 3.3 BetMines (betmines.com)

**Positionnement** : SaaS international (web + app Android), tiers VIP. Volume + automation.

**Modules historiques identifiés** :
- **Predictions Hub** — prédictions 1X2 · BTTS · Over/Under 0.5/1.5/2.5/3.5 · double chance · HT/FT · corners 7.5→10.5 · BTTS par mi-temps.
- **Pre-Match Scanner** (VIP) — analyse pré-match avec filtres composés.
- **Live Scanner** (VIP) — scan temps réel matchs en cours.
- **Statistical Filter** (`/statistical-filter-football-matches`) — filtres ultra-granulaires.
- **BetMines Machine** — générateur de prédictions automatiques.
- **40 filtres de base** (extensible 150 via add-on).
- **Backtest périodes** : `1 semaine · 1 mois · 3 mois · 6 mois · 9 mois`.
- **ROI par ligue** — affichage perf détaillée league-by-league avec recommandation d'exclusion des ligues à WR faible.
- **Continuous strategy testing** : la plateforme teste en continu les filtres utilisateurs sur 3-12 mois, ne garde que ceux à ROI positif persistant.
- **Export Excel** : value bets U/O 2.5 sur 15 mois.
- **Telegram VIP** — alertes value temps réel.

**Couverture** : **centaines de ligues**, 6 continents, ligues féminines incluses.

**UI** : web + Android, tiering Pro/VIP visible, accès Statistical Filter en gate paywall.

**Faiblesse** :
- Pas de tennis avancé non plus.
- 40 filtres = wall of options → courbe d'apprentissage élevée pour parieur lambda.
- Pas d'explication IA "pourquoi cette stratégie".

---

## 4. Tableau Comparatif Forces / Faiblesses (PariScore vs concurrents)

| Critère | OddAlerts | Datafoot | BetMines | **PariScore aujourd'hui** |
|---------|-----------|----------|----------|---------------------------|
| Séparation Foot / Tennis | ❌ foot only | ❌ foot only | ❌ foot only | ❌ mélangé (**à corriger**) |
| Filtres ligues | ✅ | ✅ 90+ | ✅ 100+ | ❌ aucun |
| Filtres équipes/joueurs | ✅ | ✅ | ✅ | ❌ aucun |
| Date-picker / périodes | ✅ 90j/6m/1an/all | ✅ ranges custom | ✅ 1s/1m/3m/6m/9m | ❌ limit only |
| Filtres marché (1X2/BTTS/O-U/CS/corners) | ✅ | ✅ | ✅ 8+ marchés | ⚠️ O2.5 + BTTS uniquement |
| Yield/ROI affiché | ✅ | ✅ | ✅ par ligue | ⚠️ winrate % seulement |
| Max Drawdown | ✅ | ⚠️ | ⚠️ | ⚠️ bankroll simulée only |
| Longest Losing Streak | ✅ | ❌ | ⚠️ | ❌ |
| Break-even Strike Rate | ✅ | ❌ | ❌ | ❌ |
| Average EV / Average Odds | ✅ | ❌ | ⚠️ | ❌ |
| Bêtes Noires / H2H patterns | ❌ | ✅ **différenciant** | ⚠️ | ❌ |
| Stratégies custom (no-code) | ⚠️ Quick Filters | ✅ Datafoot+ | ✅ 40-150 filtres | ❌ |
| **Tracking stratégies IA propres (Artilleur, Foudroyeur, PowerScore…)** | ❌ | ❌ | ❌ | ❌ **OPPORTUNITÉ MOAT** |
| Profit Calculator instantané | ✅ | ⚠️ | ✅ | ❌ |
| Drill-down match passé | ✅ | ✅ | ✅ | ❌ |
| Export CSV | ✅ API | ✅ bouton | ✅ Excel | ❌ (existe sur Mes Paris) |
| **Tennis ATP/WTA back-trackés** | ❌ | ❌ | ❌ | ⚠️ archive existe, **pas exposée** |
| UI Premium Fintech | ⚠️ terminal dense | ❌ amateur | ⚠️ wall-of-options | ✅ ADN L'Équipe à exploiter |

---

## 5. Brainstorming Comparatif — À Voler / À Éviter

### À VOLER (best practices à intégrer)

1. **OddAlerts — Profit Calculator instantané** : recalcul live des KPIs trading dès qu'un filtre bouge. Pas de bouton « Lancer », c'est réactif.
2. **OddAlerts — KPIs trading complets** : `Yield · Max DD · Longest Losing Streak · Avg EV · Avg Odds · Break-even Strike Rate`. À adopter intégralement, c'est le langage des pros.
3. **Datafoot — Bêtes Noires** : pattern H2H spécifique qui parle aux parieurs francophones. À adapter en **« Matchs Pièges »** (équipes/joueurs où nos stratégies sous-performent historiquement).
4. **BetMines — ROI par ligue** : breakdown systématique avec recommandation d'exclusion. À adopter avec un toggle « Exclure ligues à WR<50% du backtest ».
5. **BetMines — Continuous strategy testing** : ré-évaluation périodique des stratégies sur fenêtres glissantes. À adopter pour nos stratégies IA (cron mensuel qui flagge "Foudroyeur a perdu son edge").
6. **Datafoot + BetMines — Export CSV/Excel** : déjà implémenté sur `Mes Paris`, à étendre à `Historique` (`/api/v1/history/export.csv`).

### À ÉVITER (pour se démarquer Premium Fintech)

1. **BetMines 40-150 filtres en mur** : tue l'onboarding. → Nous : **filter rail progressif** (3 filtres core visibles + section "+ Filtres avancés" repliée).
2. **Datafoot claims 70% success rate marketing** : casse la crédibilité quant. → Nous : afficher **intervalle de confiance** sur chaque WR (IC 95%), à la Karpathy.
3. **OddAlerts terminal anglo-saxon dense** : froid, pas accessible grand-public francophone. → Nous : ADN **L'Équipe** (Syne 800 chiffres forts + rouge `#E2001A` + glassmorphism), narratif court à chaque KPI.
4. **Tous : pas de tennis dans l'historique** → Nous : **Toggle Foot / Tennis premier niveau**, vue tennis avec marchés natifs (ML, Set 1, Score sets exact, ≥1 set, Total jeux, Aces, Tie-break, Live).
5. **Tous : pas de tracking explicite "ma stratégie IA"** → Nous : **Strategy Tracker** dédié (Artilleur · Foudroyeur · Sniper · PowerScore Tennis · Bayesian Value Radar · AI Scout combiné). C'est notre **moat explicable**.

---

## 6. Architecture Proposée — « Data Hub Historique »

### 6.1 Vue d'ensemble (3 zones + 3 sub-tabs)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ TOGGLE PREMIUM [⚽ Foot]  [🎾 Tennis]                          [Export CSV] │
├─────────────────────────────────────────────────────────────────────────────┤
│ ZONE A — BANDEAU KPI ROLLING (sticky, recalculé live à chaque filtre)       │
│ ┌──────────┬──────────┬──────────┬──────────┬──────────┬──────────┐         │
│ │ Yield %  │ Win Rate │ Max DD   │ Long Loss│ Avg EV   │ Strike B/E│         │
│ │ (IC 95%) │ (IC 95%) │ %        │ Streak   │ %        │ %        │         │
│ └──────────┴──────────┴──────────┴──────────┴──────────┴──────────┘         │
│ Période : [7j] [30j] [90j] [6m] [1an] [all] · [📅 Custom date-picker]       │
├──────────────┬──────────────────────────────────────────────────────────────┤
│ ZONE B       │ ZONE C — Vue centrale switchable                             │
│ FILTER RAIL  │                                                              │
│ persistant   │  [📋 Tableau] [📊 Graphiques] [🎯 Strategy Tracker]          │
│              │                                                              │
│ ⚪ Sport      │  ┌─ Tableau Foot ──────────────────────────────────────┐    │
│ ⚪ Ligue      │  │ Match · Ligue · Date · Score · O2.5 · BTTS · 1X2 ·  │    │
│ ⚪ Équipe     │  │ HT · CS · Corners · Edge · Stratégie · ROI · ✓/✗   │    │
│ ⚪ Joueur     │  └─────────────────────────────────────────────────────┘    │
│ ⚪ Marché     │                                                              │
│ ⚪ Stratégie  │  ┌─ Graphiques ───────────────────────────────────────┐    │
│ ⚪ Cote min/max│  │ • P/L cumulé en unités (par marché)                │    │
│ ⚪ EV min     │  │ • Drawdown curve                                    │    │
│ ⚪ Proba min  │  │ • ROI rolling 30j                                   │    │
│ ⚪ Confidence │  │ • Heatmap WR par ligue × marché                     │    │
│              │  └─────────────────────────────────────────────────────┘    │
│ [Reset]      │                                                              │
│              │  ┌─ Strategy Tracker ─────────────────────────────────┐    │
│              │  │ Artilleur · Foudroyeur · Sniper · PowerScore · BVR │    │
│              │  │ Pour chaque : ROI · WR · Sample · IC · Trend ↗↘    │    │
│              │  └─────────────────────────────────────────────────────┘    │
└──────────────┴──────────────────────────────────────────────────────────────┘
```

### 6.2 Détail des Filtres (Filter Rail)

| # | Filtre | Type | Notes |
|---|--------|------|-------|
| F1 | Sport | Toggle Foot/Tennis | **Premier niveau, change le reste** |
| F2 | Ligue / Tournoi | Multi-select avec drapeaux | Liste dépendante du sport |
| F3 | Équipe / Joueur | Autocomplete | Source `db.teamStats` foot, BSD tennis |
| F4 | Période | Preset 7j/30j/90j/6m/1y/all + date-picker custom | Affecte ZONE A KPIs |
| F5 | Marché | Multi-select | Foot: 1X2, BTTS, O/U 0.5-3.5, HT, CS, Corners. Tennis: ML, Set1, ≥1 set, Total jeux, Aces, Tie-break |
| F6 | Stratégie IA | Multi-select | Artilleur, Foudroyeur, Sniper, PowerScore Tennis, Bayesian Value Radar, AI Scout combiné |
| F7 | Cote min/max | Range slider | 1.10 → 10.00 |
| F8 | EV min | Slider | -5% → +20% |
| F9 | Proba min | Slider | 40% → 90% |
| F10 | Confidence Badge | Multi-select | Élevée / Moyenne / Faible |
| F11 | Résultat | Toggle | Gagnant / Perdant / Tous |
| F12 | (Pro+) « Cacher ligues à WR<50% » | Checkbox | BetMines-style auto-exclude |

### 6.3 Backend — nouvelle route `/api/v1/history/query`

```
GET /api/v1/history/query
  ?sport=football|tennis
  &leagues=Ligue1,EPL,...
  &teams=PSG,OM,...
  &players=Sinner,Alcaraz,...   (tennis)
  &markets=over25,btts,h2h,...
  &strategies=artilleur,foudroyeur,...
  &fromDate=2026-01-01
  &toDate=2026-05-20
  &minOdds=1.50&maxOdds=5.00
  &minEV=5&minProba=55
  &confidence=high,medium
  &outcome=won|lost|all
  &excludeLowLeagues=1
  &page=1&pageSize=50
  &sort=date_desc|ev_desc|roi_desc

Response:
{
  matches: [...],         // paginated
  total: 1247,
  page: 1, pageSize: 50,
  kpis: {                 // calculé sur filtres actifs (PAS sur tous)
    yield_pct, yield_ic95: [lo, hi],
    winrate_pct, winrate_ic95: [lo, hi],
    max_drawdown_pct,
    longest_losing_streak,
    avg_ev_pct, avg_odds,
    break_even_strike_rate
  },
  breakdown: {
    by_league:   [{ league, sample, winrate, roi }, ...],
    by_market:   [{ market, sample, winrate, roi }, ...],
    by_strategy: [{ strategy, sample, winrate, roi, trend }, ...]
  },
  series: {
    pl_cumulative:   [{ date, units }, ...],
    drawdown_curve:  [{ date, dd_pct }, ...],
    rolling30_wr:    [{ date, wr }, ...]
  }
}
```

### 6.4 Backend — pré-requis data

- Foot : déjà tracé (history table + archive_matches), il faut **enrichir** chaque entrée avec :
  - `strategy_predicted` (clé Artilleur / Foudroyeur / Sniper / null) ← reconstituer depuis logs ou enrichir au moment de la prédiction.
  - `markets_predicted[]` (liste des marchés avec proba > 55%).
  - `confidence_badge` (recopier depuis snapshot prédiction).
- Tennis : `archive_tennis_matches` table à créer/exposer (déjà présent partiellement dans `db.archive_matches` pour foot, à étendre tennis via BSD/ESPN).

### 6.5 Frontend — composants

| Composant | ID/classe | Réutilisation |
|-----------|-----------|---------------|
| `#dh-sport-toggle` | nouveau | inspiration `.paris-tab` (Mes Paris) |
| `#dh-kpi-strip` | nouveau, sticky top | dérivé `#bk-kpi-row` (Mes Paris) |
| `#dh-filter-rail` | nouveau, sticky left desktop / drawer mobile | dérivé `#desktop-filters-flat` |
| `#dh-view-switch` | nouveau | inspiration `.paris-tab` segmented |
| `#dh-table-foot` / `#dh-table-tennis` | nouveau | dérivé `#vb-table` (Matchs) et `#tennis-vb-table` |
| `#dh-chart-pl` / `#dh-chart-dd` / `#dh-chart-rolling` | nouveau | Chart.js (déjà chargé) |
| `#dh-strategy-tracker` | nouveau | tableau dense + sparkline par stratégie |
| `#dh-row-drill` | modal | clic ligne → ouvre modal Insights avec snapshot prédiction figé |

### 6.6 Phasing implémentation (post-GO)

- **Phase H1 (1-2j)** — Refonte UI shell + Toggle Foot/Tennis + Filter Rail + route `/api/v1/history/query` (filtres foot uniquement, tennis NO-OP). Pas de Strategy Tracker.
- **Phase H2 (2-3j)** — Calcul des 6 KPIs trading + IC 95% bootstrap + breakdown par ligue/marché + 3 graphs (P/L · DD · rolling30).
- **Phase H3 (2j)** — Tennis backtested (archive_tennis_matches + marchés natifs).
- **Phase H4 (2j)** — Strategy Tracker (enrichir entrées history avec `strategy_predicted` + render dédié).
- **Phase H5 (1j)** — Export CSV `/api/v1/history/export.csv` + drill-down modal.
- **Phase H6 (1j)** — « Matchs Pièges » (équivalent Bêtes Noires) — détection patterns H2H où stratégies sous-performent.

**Total estimatif : 9-11 jours dev** (1 sprint).

---

## 7. Risques & Points d'Attention

| # | Risque | Mitigation |
|---|--------|------------|
| R1 | Mobile : Filter Rail latéral ne tient pas sur 360px | Drawer slide-in `.dh-filter-drawer` mobile-only, hamburger `🔧 Filtres` |
| R2 | Perf serveur : agrégations sur 1000+ matchs à chaque change de filtre | Cache mémoire 60s par hash filtres + index SQLite sur `(sport, league, commence_time, strategy)` |
| R3 | Bootstrap IC 95% sur petits samples (<20 paris) | Affichage `IC trop large — sample insuffisant` au lieu d'un faux %, OWASP-Karpathy |
| R4 | Strategy Tracker : pas de tag `strategy_predicted` rétroactif | Marquer seulement les nouveaux matchs (à partir de la release H4), accepter le trou historique |
| R5 | Export CSV : OWASP injection (`= + - @`) | Réutiliser la guard déjà implémentée sur `Mes Paris` |
| R6 | Régression sur backtest existant Premium/Admin | Garder `/api/v1/history` legacy fonctionnel (alias) pendant 1 release |

---

## 8. Vision : ce que devient l'expérience après refonte

> Un parieur Pro arrive sur `/historique`. Il clique **🎾 Tennis**, filtre **Surface = Terre Battue**, **Stratégie = Bayesian Value Radar**, **Période = 90j**. En 200ms le bandeau KPI affiche **Yield +8.2% (IC 95% [+5.1 ; +11.4])**, **WR 58% (IC [54-62])**, **Max DD -12%**, **Strike B/E 53%**. Le sparkline ROI rolling30 part vert. Il clique **Strategy Tracker** → voit que **Foudroyeur** est tombé à -3% sur 30j, signal **« Edge dégradé »** rouge. Décide de désactiver Foudroyeur pour le mois prochain. Export CSV pour son tableur Excel personnel.
>
> Aucun concurrent ne lui permet ce flux. C'est notre **moat**.

---

## 9. Sources consultées

- [OddAlerts — Filters](https://www.oddalerts.com/filters)
- [OddAlerts — Profit Calculator Guide](https://oddalerts.com/guides/tools/how-to-use-the-value-bets-tool-to-find-positive-ev-opportunities)
- [OddAlerts — Quick Filters Guide](https://www.oddalerts.com/guides/tools/using-filters-to-build-profitable-football-strategies)
- [OddAlerts — Pro Plan](https://www.oddalerts.com/pro)
- [OddAlerts — Dropping Odds](https://www.oddalerts.com/dropping-odds)
- [OddAlerts — Football Data API](https://www.oddalerts.com/football-data-api)
- [Datafoot — Bêtes Noires](https://datafoot.fr/blog/fr/betes-noires-paris-sportifs-football)
- [Datafoot — CSV Download Guide](https://datafoot.fr/blog/fr/telechargez-des-donnees-football-en-csv)
- [Datafoot — Meilleur outil 2025](https://datafoot.fr/blog/fr/meilleur-outil-analyse-paris-sportifs)
- [Bureau des Tipsters — Datafoot Review](https://www.bureau-des-tipsters.com/datafoot-algorithme-pari-sportif/)
- [BetMines — VIP Tools](https://betmines.com/vip/football-betting-tools)
- [BetMines — Pre-Match Scanner](https://betmines.com/vip/pre-match-scanner-for-football)
- [BetMines — Statistical Filter](https://betmines.com/statistical-filter-football-matches)
- [BetMines — Football Prediction Generator](https://betmines.com/football-prediction-generator)
- [BetMines — Live Scanner](https://betmines.com/vip/football-live-scanner)

---

## 10. Statut de validation

⚠️ **AUCUN CODE PRODUCTION N'A ÉTÉ MODIFIÉ.**

Cette proposition attend le **GO explicite du DG (David)** pour passer en implémentation Phase H1.

Le rapport équivalent au format Word est disponible : `rapport_historique_concurrents.docx`.

**Fin de rapport — DRAFT v1.0 — 20 mai 2026**
