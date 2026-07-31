# 🎨 Proposition de Refonte UI/UX & Évolution Produit — PariScore

> **Date** : 30/07/2026
> **Auteur** : Expert Frontend Designer UI/UX & Lead Fullstack
> **Version** : 1.0 — Proposition structurée (_À valider avant implémentation_)
> **Mode** : Plan / Revue — Pas encore en implémentation

---

## 📑 Table des Matières

1. [Audit & Synthèse Graphify](#1-audit--synthèse-graphify)
2. [Améliorations Visuelles & Design Frontend](#2-améliorations-visuelles--design-frontend-uiux)
3. [Propositions de Nouveaux Contenus & Features](#3-propositions-de-nouveaux-contenus--features-valeur-ajoutée)
4. [Plan d’Action & Architecture Technique](#4-plan-daction--architecture-technique)

---

## 1. Audit & Synthèse Graphify

### 1.1 Cartographie du Codebase

D'après l'analyse des 14 505 nœuds / 28 757 edges du graph Graphify (commit `085ed7e`, 592 communautés) :

| Axe | Détail |
|-----|--------|
| **Stack** | Next.js 16 App Router + React 19 + TypeScript 5 + Tailwind CSS 4 |
| **UI Lib** | shadcn/ui New York (48 composants owned) + Radix UI + Framer Motion |
| **Data viz** | Recharts (chart.tsx wrapper) |
| **State** | SWR (stale-while-revalidate) + Zustand stores |
| **DB** | Prisma + SQLite (dev) / PostgreSQL (prod) |
| **Auth** | NextAuth (début d'intégration) |
| **i18n** | next-intl — 2 locales (fr/en), cookie-based |
| **PWA** | Manifest + Service Worker + Web Push + offline capable |
| **Analytics** | PostHog (gated consent) + Sentry (error boundary) |
| **Build** | Bun runtime + standalone output |

### 1.2 Structure des Composants (Arbre de Rendu)

```
src/app/layout.tsx
├── ThemeProvider (dark-first)
├── NextIntlClientProvider
├── ConsentProvider → PHProvider → SentryErrorBoundary
│   └── page.tsx (single route /)
│       ├── Header (sticky, backdrop-blur)
│       │   ├── Logo / ThemeToggle / LanguageToggle / PushToggle
│       │   ├── EmailToggle / TerminalToggle / ValueBetScannerIndicator
│       │   └── Bankroll / PaperTrading CTAs
│       ├── SportTabs (8 sports, Framer Motion indicator)
│       └── Content per sport tab:
│           ├── TennisTabContent
│           │   ├── TennisSubTabs (Live / Today / Tournaments)
│           │   ├── FeaturedMatchesMarquee
│           │   ├── TennisSearchBar
│           │   ├── MatchCard | MatchCardBroadcast (grid 1-3 cols)
│           │   │   ├── MatchCardHeader (SetScoreline + CurrentGameScore + ServerIndicator)
│           │   │   ├── PlayerProfileHeader (avatar + photo CDN)
│           │   │   ├── ProbabilityBar / PredictiveBets / MostAcesCompare
│           │   │   ├── StatsIndicatorsGrid (surface/elo/IC/form/h2h)
│           │   │   ├── LiveStatsPanel (serve/return/break/aces)
│           │   │   ├── MomentumDR / WinProbabilityChart / PointTimeline
│           │   │   └── MatchCardDetail (accordéon 4 cartes)
│           │   ├── TournamentsList (ATP/WTA/ITF)
│           │   ├── MatchDetailDialog (lazy loaded)
│           │   ├── BetDialog
│           │   └── MatchPipWidget (Picture-in-Picture)
│           ├── FootballTabContent
│           │   ├── FootballLeagueBar
│           │   ├── FootballLiveCard (live section)
│           │   ├── FootballMatchCard (1D/1N/2 % bar + BTTS/O2.5 badges)
│           │   └── FootballMatchDetailDialog (momentum chart)
│           ├── MmaTabContent (fight cards + filters)
│           ├── Cs2TabContent
│           ├── NbaTabContent / WnbaTabContent
│           ├── CyclingTabContent (stage cards + filters)
│           └── F1TabContent (driver cards)
└── Footer (copyright + RGPD links)
```

### 1.3 Flux de Données & Moteurs de Prédiction

```
Sources Externes
├── BSD API (tennis) → bsd-tennis-service.ts
├── API-Football → football-data.ts
├── The Odds API → odds multiplexeur
├── TennisAbstract → tennis-dr/ (Dominance Rating)
├── Sackmann CSVs → tennis-elo/ (cache JSON)
└── SofaScore / Scrapers → services/schedulers

Pipeline Backend (API Routes)
├── /api/tennis/prematch   → Elo+Form+Surface+H2H (engine.ts)
├── /api/tennis/live       → WebSocket live broker
├── /api/tennis/elo-history → Sparkline history
├── /api/tennis/search     → fuzzy player search
├── /api/tennis/tournaments → tournament index
├── /api/tennis/bsd/*      → BSD routes (matches/players/predictions)
├── /api/football/prematch → POISSON + xG + BTTS/O2.5
├── /api/football/live     → football live dashboard
├── /api/football/matches/[id]/stats → xG timeline
└── /api/{mma,cs2,nba,wnba,cycling,f1}/*

Modèles de Prédiction
├── Elo (tennis): 70% poids, blend surface 55%, K=32, logistique
├── Forme (tennis): 20% poids, décroissance exponentielle α=0.85
├── H2H (tennis): 10% poids, ratio win/loss
├── Bootstrap: 1000 resamples gaussiens, IC 95%
├── Moment DR: TennisAbstract médiane surface 5M
├── SPS: Surface Power Score (serve/return composite)
├── POISSON (football): 1/N/2 probs + BTTS + Over/Under
└── WM / EWMA / Talent pipeline (MMA)
```

### 1.4 Goulots d'Étranglement UI/UX — Points de Friction

#### 🔴 SÉVÈRES

| # | Problème | Impact |
|---|----------|--------|
| **P1** | **Pas de navigation mobile optimisée** — Pas de bottom bar, pas de gestes swipe. Les 8 sports sont dans un scroll horizontal en haut, pas au pouce. | Mobile PWA non ergonomique, 60%+ des utilisateurs. |
| **P2** | **Surcharge cognitive sur les cartes tennis** — La `MatchCardBroadcast` contient 15+ sous-composants (rang, Elo, SPS, DR, forme, odds, proba, momentum, stats live, details accordéon, paris prédictifs, etc.). | Paralysie de l'analyse pour utilisateur non-expert. |
| **P3** | **Incohérence visuelle inter-sports** — Tennis a des visuels riches (MatchCardBroadcast TV-style), football a une simple barre 1D/N/2, MMA/CS2/Cycling sont très basiques. | Expérience fragmentée, pas de design system sport unifié. |
| **P4** | **Aucune vue d'ensemble / dashboard** — Pas de page d'accueil avec résumé global, best value bets, ou "top picks" du jour. L'utilisateur arrive sur Tennis par défaut. | Pas de guidance pour nouveaux utilisateurs. |

#### 🟡 MODÉRÉS

| # | Problème | Impact |
|---|----------|--------|
| **P5** | **Deux variantes de MatchCard coexistent** — `MatchCard` (original, 685 lignes) et `MatchCardBroadcast` (R7 refonte, enrichi). Code dupliqué, confusion pour les mainteneurs. | Dette technique, design incohérent. |
| **P6** | **Pas de filtre par "value bet" dans les sports non-tennis** — Le value-bet scanner existe globalement mais le filtre n'est disponible que partiellement. | UX incomplète. |
| **P7** | **Dialogues lourds pour mobile** — Les dialogs de détail (MatchDetailDialog, FootballMatchDetailDialog) sont des modales desktop-first, pas des drawers/feuilles mobiles. | 768px- = expérience dégradée. |
| **P8** | **Pas de feedback de confiance visuelle** — Les probabilités sont présentées comme des nombres bruts sans indicateur de fiabilité (IC 95%, nombre de matchs source, qualité du modèle). | Manque de transparence statistique. |

#### 🟢 MINEURS

| # | Problème | Impact |
|---|----------|--------|
| **P9** | Icônes sport parfois incohérentes (Volleyball pour Tennis) | Subtile mais notable |
| **P10** | Footer trop volumineux sur mobile, vole de l'espace scrollable | UX mobile dégradée |


---

## 2. Améliorations Visuelles & Design Frontend (UI/UX)

### 2.1 Design System — Évolution de la Charte

#### 🎨 Palette — Dark Pro Moderne avec Accents Sportifs

```
Base (Dark Navy — inchangée, éprouvée)
├── bg-primary:      #0a0e17  (fond page — plus profond)
├── bg-card:         #111827  (cartouche)
├── bg-card-hover:   #161e2f  (hover)
├── border:          rgba(255,255,255,0.06)
├── text-primary:    #f8fafc
├── text-secondary:  #94a3b8
└── text-tertiary:   #475569

Accents Sportifs (conservés + enrichis)
├── tennis:    #10B981 (emerald)
├── football:  #0EA5E9 (sky)
├── mma:       #EF4444 (red)
├── cycling:   #F59E0B (amber)
├── f1:        #DC2626 (racing red)
├── cs2:       #F97316 (orange)
├── nba:       #0EA5E9 (sky)
├── wnba:      #A855F7 (purple)
└── value:     #22C55E (green — edge/confiance)

Fonctionnelles (ajouts)
├── confidence-high:   #22C55E  (modèle fiable)
├── confidence-mid:    #F59E0B  (attention)
├── confidence-low:    #EF4444  (risqué)
├── edge-positive:     #10B981  (value bet favorable)
├── edge-negative:     #EF4444  (trap/trop cher)
├── live-pulse:        #EF4444  (live indicator)
└── ai-insight:        #A855F7  (Gemini analysis)
```

#### 🔤 Typographie — Sportive & Data-Dense

```css
/* Conserve Geist + Geist Mono, ajoute une fonte display sportive */
--font-sans: Geist (body UI)
--font-mono: Geist Mono (numbers, odds, scores)
--font-display: 'Space Grotesk' (hero stats, titres sections — ajout)

/* Échelle de tailles optimisée pour la data densité */
text-3xs: 9px    /* micro labels */
text-2xs: 10px   /* badges, timestamps */
text-xs:  11px   /* meta, labels */
text-sm:  13px   /* body data-dense */
text-base: 15px  /* corps standard */
text-lg:  18px   /* sous-titres */
text-xl:  22px   /* titres card */
text-2xl: 28px   /* titres section */
text-3xl: 36px   /* hero stats */

/* Nombres = tabular-nums OBLIGATOIRE sur toutes les data */
.tabular-nums { font-variant-numeric: tabular-nums; }
```

#### 🎭 Thème — Dark-First Renforcé

- Fond profond `#0a0e17` (plus sombre que l'actuel `#0F0F1A`)
- Cartes avec `backdrop-filter: blur(12px)` + `rgba(255,255,255,0.03)` pour effet verre subtil
- Bordures ultra-fines (`0.5px`) pour délimitation sans bruit visuel
- Ombres douces avec `box-shadow: 0 4px 24px rgba(0,0,0,0.25)` sur cartes hover
- Gradients subtils de surface (`linear-gradient(135deg, rgba(X,0.08) 0%, transparent 100%)` par sport)

### 2.2 Data Visualization — Nouvelles Représentations Graphiques

#### 📊 Jauge de Confiance Interactive (Confidence Gauge)

**Objectif** : Remplacer la probabilité brute par une jauge visuelle circulaire qui encode à la fois la probabilité ET la confiance du modèle.

```
┌─────────────────────────────────┐
│       ╭──────────────╮          │
│      ╱                ╲         │
│     │   Prob 68%       │        │
│     │   IC [62-74]     │        │  ← Anneau externe = probabilité
│     │   ★★★☆☆          │        │  ← Épaisseur = confiance (IC narrow = thick)
│      ╲    Confiance    ╱         │  ← Couleur = sport accent
│       ╰──────────────╯          │
│     J. SINNER vs C. ALCARAZ     │
└─────────────────────────────────┘
```

**Composant** : `ConfidenceRing` — évolution du `QuickAddRing` existant avec double anneau (probabilité + confiance IC).

#### 📈 Courbe d'Évolution Elo Interactive (Elo Evolution Chart)

**Objectif** : Montrer l'évolution Elo sur 12 mois, avec annotations de matchs clés.

**Composant** : `EloEvolutionChart` — Recharts `Area` + `ReferenceDot` pour événements clés. Consomme `/api/tennis/elo-history`.

#### 🎯 Comparateur Radar d'Équipes/Joueurs (Matchup Radar)

**Objectif** : Comparer 2 joueurs/équipes sur 6 métriques clés en radar chart (Service, Retour, Puissance, Condition, Forme, Mental).

**Composant** : `StatsRadarChart` (existe déjà !) — À enrichir et étendre à tous les sports.

#### 🧬 Badge d'Historique de Forme Dynamique (Form Timeline)

**Objectif** : Remplacer les simples dots W/L par une timeline visuelle de forme avec poids temporel décroissant et indice de forme 0-1.

**Composant** : `FormTimeline` — évolution du `FormDots` existant.

#### 🔥 Heatmap de Value Bets (Value Matrix)

**Objectif** : Vue matricielle croisant sport/tournoi avec les probabilités modèle vs marché.

**Composant** : `ValueHeatmap` — TanStack Table + Recharts heatmap cells.

### 2.3 Responsive & Mobile First

#### 📱 Bottom Navigation Bar (Mobile ≤ 768px)

```
┌────────────────────────────────────────────┐
│  🏠       ⚡        💎        ⭐       👤  │
│ Accueil  Live    Value   Favoris   Profil │
└────────────────────────────────────────────┘
```

- **Accueil** : Dashboard global avec résumé multi-sport
- **Live** : Tous les matchs en direct (cross-sport)
- **Value** : Scanner de value bets tous sports
- **Favoris** : Matchs/équipes/joueurs sauvegardés
- **Profil** : Bankroll, alerts, settings

#### 🧭 Navigation au Pouce & Gestes

- **Swipe horizontal** sur le header sport pour changer de sport (mobile)
- **Pull-to-refresh** sur les listes de matchs
- **Swipe latéral** sur les cartes pour quick actions (add favori, bet CTA)
- **Long press** sur une carte pour preview rapide (popover stats)

#### 📋 Cartes Rétractables / Expandables

- Les détails de match sont dans des **drawers coulissantes** (bottom sheet) sur mobile, pas des modales
- Les filtres sont dans une **bottom sheet** avec geste swipe-down pour fermer


---

## 3. Propositions de Nouveaux Contenus & Features Valeur Ajoutée

### 3.1 Nouveaux Modules de Statistiques (5 modules)

#### Module 1 : Matrice de Valeur de Cotes (Odds Value Matrix)

**Concept** : Vue tabulaire croisant tous les bookmakers × tous les matchs, avec un code couleur pour le "edge" (différence proba modèle vs proba implicite cote).

```
Bookmaker    Sinner   Alcaraz   Medvedev   Rune
Bet365       🟢+15%   🟡+4%     🔴-2%      🟢+12%
Unibet       🟢+12%   🟡+6%     🟡+5%      🟢+18%
Winamax      🔴-1%    🟢+9%     🟡+3%      🟡+7%
Bwin         🟢+14%   🟡+2%     🔴-5%      🟢+11%

🟢 = Value positive (edge > 8%)
🟡 = Value neutre (edge 3-8%)
🔴 = Trap / Cote trop courte (edge < 3%)
```

**Tech** : `src/components/scanner/odds-value-matrix.tsx` — TanStack Table + Recharts heatmap cells.

#### Module 2 : Comparateur H2H Avancé (Advanced H2H Comparator)

**Concept** : Comparaison head-to-head enrichie avec filtres par surface, période, tournoi. Aces, double-fautes, balles de break converties, % 1er service par match.

**Tech** : `src/components/tennis/h2h-advanced.tsx` — Utilise l'API BSD `/h2h` enrichie.

#### Module 3 : Sélecteur de Scénario de Match (Match Scenario Simulator)

**Concept** : Interface interactive qui permet à l'utilisateur d'ajuster un paramètre et voir l'impact sur les probabilités en temps réel.

```
┌──────────────────────────────────────────────────┐
│  Scénario: Que se passe-t-il si...                │
│                                                    │
│  Surface: [Dur ████████░░] → Terre battue          │
│  → Prob A passe de 62% → 48%                      │
│                                                    │
│  Dernier match: [Neutre] → A en 5 sets             │
│  → Prob A passe de 62% → 55% (fatigue -7%)        │
│                                                    │
│  Joueur B blessure: [Aucune] → Légère (-3% Elo)   │
│  → Prob A passe de 62% → 66%                      │
│                                                    │
│  SCÉNARIO FINAL: 66% prob A                        │
│  Value Bet: OUI (+8% edge @Bet365)                │
└──────────────────────────────────────────────────┘
```

**Tech** : `src/components/scenarios/match-scenario-simulator.tsx` — Sliders interactifs avec `useMemo` recalcul en temps réel via `engine.predict()`.

#### Module 4 : Timeline de Momentum de Match (Momentum Storyline)

**Concept** : Timeline narrative d'un match en direct avec les points clés de momentum, pas juste les données brutes. Combine `PointTimeline` + `MomentumDR` en narration visuelle avec annotations des swings.

**Tech** : `src/components/tennis/momentum-storyline.tsx`.

#### Module 5 : Dashboard Global Multi-Sport (Home Dashboard)

**Concept** : Page d'accueil qui agrège les "top picks" et alertes de tous les sports.

```
┌──────────────────────────────────────────────────┐
│  👋 Bonjour, David           💎 3 value bets     │
│                                                  │
│  📈 TENDANCES DU JOUR                            │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌────────┐ │
│  │🎾 Tennis │ │⚽ Foot  │ │🥊 MMA   │ │🚴 Cycl │ │
│  │ 14 matchs│ │ 8 matchs│ │ 3 fights│ │ 2 étap │ │
│  │ 5 values │ │ 2 values│ │ 1 value │ │ 0 value│ │
│  └─────────┘ └─────────┘ └─────────┘ └────────┘ │
│                                                  │
│  🔥 TOP VALUE BETS CROSS-SPORT                  │
│  🎾 Nadal vs Djokovic      +22% edge ⭐⭐⭐⭐⭐   │
│  ⚽ PSG vs OM — BTTS OUI    +18% edge ⭐⭐⭐⭐    │
│  🥊 Jones vs Adesanya       +15% edge ⭐⭐⭐⭐    │
│                                                  │
│  ⚡ LIVE NOW (3 matchs)                          │
└──────────────────────────────────────────────────┘
```

**Tech** : `src/app/page.tsx` → Restructuré en dashboard, pas juste tennis-tab.

### 3.2 Gamification & Engagement

#### 🏆 Indicateur de Confiance Visuel (Trust Badge System)

```
★★★★★ — IC étroit (<8pp), >20 matchs surface, Elo stable (>50 matchs)
★★★★☆ — IC modéré (8-15pp), >10 matchs surface, Elo établi
★★★☆☆ — IC large (15-25pp), <10 matchs surface, Elo partiel
★★☆☆☆ — IC très large (>25pp), <5 matchs surface, Elo incertain
★☆☆☆☆ — Données insuffisantes, prédiction spéculative
```

#### 🎯 Filtres Rapides par Valeur / Edge (Quick Value Filters)

`[💰 Value Bets (>8%)] [📊 Confiance Élevée] [⚡ Live] [⭐ Favoris] [🔮 AI Insight]`

Pills horizontales en haut des grilles de matchs, animation de transition fluide.

#### 🧠 AI Insight Engine (intégration Gemini existante, UI valeur ajoutée)

```
┌────────────────────────────────────────────┐
│  🤖 Gemini AI Insight                      │
│                                            │
│  "Le modèle détecte une value significative│
│   (+15%) sur Sinner. L'écart s'explique par│
│   la sous-estimation du marché de son jeu  │
│   sur gazon (72% win rate surface vs 65%   │
│   implied). L'IC 95% est étroit [62-74],   │
│   ce qui renforce la fiabilité."           │
│                                            │
│  📊 Facteurs clés:                         │
│  • Surface gazon: +8% edge                 │
│  • Forme récente: 5-0 (W)                 │
│  • H2H vs Alcaraz: 3-2 favorable           │
│  • Elo surface: +45 vs Elo global          │
└────────────────────────────────────────────┘
```



## 4. Plan d'Action & Architecture Technique

### 4.1 Découpage par Composants Modulaires (Phases)

#### Phase 1 — Foundations (Design System + Mobile Shell) — Semaine 1-2

**Objectif** : Unifier le design system et créer le shell mobile-first.

| Composant | Action | Tech |
|-----------|--------|------|
| `tailwind.config.ts` + `globals.css` | **Modify** — Ajouter palette `--confidence-*`, `--edge-*`, `--font-display`, `--live-pulse` | Tailwind CSS 4 `@theme` |
| `MobileBottomNav` | **Create** — `src/components/layout/mobile-bottom-nav.tsx` | Radix Tabs + Framer Motion |
| `SportSwipeHeader` | **Create** — `src/components/layout/sport-swipe-header.tsx` | `onTouchStart`/`onTouchEnd` swipe detection |
| `AutoHideHeader` | **Create** — `src/components/layout/auto-hide-header.tsx` | `useScroll` + `framer-motion` |
| `BottomSheet` (generic) | **Create** — `src/components/ui/bottom-sheet.tsx` | Radix Dialog + Drawer (vaul) |
| `DrawerDetail` | **Create** — Remplace les modales par des drawers sur mobile | `useIsMobile()` switch |
| `sport-tabs.tsx` | **Modify** — Ajouter swipe gesture | Touch handlers |
| `tennis-tab-content.tsx` | **Modify** — Adapter pour bottom sheet filters | BottomSheet |

#### Phase 2 — Data Visualization Evolution (Charts + Metrics) — Semaine 2-3

**Objectif** : Remplacer les visualisations basiques par les nouveaux composants graphiques.

| Composant | Action | Tech |
|-----------|--------|------|
| `ConfidenceRing` | **Create** — `src/components/shared/confidence-ring.tsx` | SVG circulaire + `framer-motion` |
| `EloEvolutionChart` | **Create** — `src/components/tennis/elo-evolution-chart.tsx` | Recharts `Area` + `ReferenceDot` |
| `FormTimeline` | **Create** — Évolution de `form-dots.tsx` | CSS grid + animation |
| `MatchupRadar` | **Modify** — Enrichir `stats-radar-chart.tsx` existant | Recharts `RadarChart` |
| `MomentumStoryline` | **Create** — `src/components/tennis/momentum-storyline.tsx` | Combine PointTimeline + narrative |
| `football-match-card.tsx` | **Modify** — Ajouter `ConfidenceRing` + `FormTimeline` | Mêmes composants partagés |
| `mma-fight-card.tsx` | **Modify** — Ajouter visualisations standardisées | Composants partagés |
| `cycling-stage-card.tsx` | **Modify** — Standardiser avec le système | Composants partagés |

#### Phase 3 — Nouveaux Modules Statistiques — Semaine 4-5

**Objectif** : Créer les 5 nouveaux modules de contenu à valeur ajoutée.

| Composant | Action | Tech |
|-----------|--------|------|
| `OddsValueMatrix` | **Create** — `src/components/scanner/odds-value-matrix.tsx` | TanStack Table + Recharts |
| `H2HAdvanced` | **Create** — `src/components/tennis/h2h-advanced.tsx` | BSD API `/h2h` enrichie |
| `MatchScenarioSimulator` | **Create** — `src/components/scenarios/match-scenario-simulator.tsx` | `engine.predict()` client-side |
| `ValueHeatmap` | **Create** — `src/components/dashboard/value-heatmap.tsx` | Recharts + CSS Grid |
| `HomeDashboard` | **Modify** — `src/app/page.tsx` passe de tennis-only à dashboard multi-sport | Nouvelle structure |





#### Phase 4 — Dashboard Global & Cross-Sport — Semaine 5-6

| Composant | Action | Tech |
|-----------|--------|------|
| `TopValueBetsList` | **Create** — `src/components/dashboard/top-value-bets.tsx` | SWR cross-sport aggregator |
| `LiveNowCrossSport` | **Create** — `src/components/dashboard/live-now-cross-sport.tsx` | WebSocket multiplexeur |
| `SportTrendCards` | **Create** — `src/components/dashboard/sport-trend-cards.tsx` | Stats aggregator |
| `QuickValueFilters` | **Create** — `src/components/dashboard/quick-value-filters.tsx` | Filter pills |
| `AIInsightCard` | **Create** — `src/components/ai/ai-insight-card.tsx` | Gemini API + Markdown render |

#### Phase 5 — Polish, Validation & QA — Semaine 6-7

| Tâche | Détail |
|-------|--------|
| Playwright E2E | Ajouter 20+ tests pour nouveaux composants |
| Lighthouse Audit | Mobile PWA > 90 score |
| WCAG 2.1 AA | Vérifier tous les nouveaux composants (contraste, aria, focus) |
| RGPD Consent | Vérifier que les nouveaux composants respectent le consent gating |
| PostHog Events | Ajouter tracking sur nouvelles features |
| PWA Manifest | Vérifier le comportement standalone avec bottom bar |
| Performance | `next build` + `output: standalone` bundle analysis |

### 4.2 Stratégie d'Intégration

**Principes :**
1. **Zero Breaking Change** — Les modifications sont additives, jamais de "big bang"
2. **Composants Partagés** — Les viz (`ConfidenceRing`, `FormTimeline`) dans `src/components/shared/`, réutilisés par tous les sports
3. **Route API inchangée** — Les nouveaux composants consomment les mêmes endpoints
4. **Feature Flags** — PostHog flags pour rollback rapide
5. **Code Removal Planning** — `MatchCard` originale dépréciée après migration

**Nouvelles catégories de composants :**
- `src/components/dashboard/` — Dashboard global
- `src/components/scanner/` — Value bet scanner & matrix
- `src/components/scenarios/` — Simulateur de scénarios
- `src/components/ai/` — Intégration Gemini insights
- `src/components/shared/` — Composants viz réutilisables

### 4.3 Dépendances & Feature Flags

**Aucune nouvelle dépendance externe** — tout est faisable avec le stack existant.

```typescript
// PostHog Feature Flags
export const REFONTE_FEATURES = {
  NEW_DASHBOARD:        'refonte-v2-dashboard',
  CONFIDENCE_RING:      'refonte-v2-confidence-ring',
  ODDS_VALUE_MATRIX:    'refonte-v2-odds-matrix',
  SCENARIO_SIMULATOR:   'refonte-v2-scenario-sim',
  BOTTOM_NAV_MOBILE:    'refonte-v2-bottom-nav',
  H2H_ADVANCED:         'refonte-v2-h2h-advanced',
  AI_INSIGHT_CARD:      'refonte-v2-ai-insight',
} as const;
```

---

## 📋 Résumé des Livrables Attendus

| Phase | Durée | Livrables | Impact Utilisateur |
|-------|-------|-----------|-------------------|
| **P1** — Foundations | S1-S2 | Mobile bottom nav, swipe header, auto-hide, drawers | Mobile UX transformée |
| **P2** — Data Viz | S2-S3 | ConfidenceRing, EloChart, FormTimeline, MatchupRadar, MomentumStoryline | Compréhension stats améliorée |
| **P3** — Nouveaux Modules | S4-S5 | OddsMatrix, H2HAdvanced, ScenarioSim, ValueHeatmap | Value ajoutée parieurs |
| **P4** — Dashboard | S5-S6 | HomeDashboard, TopValueBets, LiveCrossSport, AI Insight | Vue d'ensemble globale |
| **P5** — QA/Polish | S6-S7 | Tests E2E, Lighthouse, WCAG, déploiement | Qualité & stabilité |

---

## ✅ Next Steps

1. **Relecture & Feedback** — Valider les priorités et la direction artistique
2. **GO/NOT-GO par phase** — Décision sur chaque phase séparément
3. **Priorisation** — Si timebox serré, P1 (mobile) + P2 (viz) sont les plus impactantes
4. **Implémentation** — Attendre le GO explicite avant de coder

> **Note** : Tous les composants proposés utilisent exclusivement le stack technique existant (Next.js 16, React 19, Tailwind CSS 4, shadcn/ui, Recharts, Framer Motion, SWR, Zustand). Aucune nouvelle dépendance externe n'est nécessaire. L'architecture des routes API reste inchangée — les nouveaux modules sont purement frontend ou consomment les endpoints existants.

---

*Document généré le 30/07/2026 — Proposition V1 — En attente de validation.*
