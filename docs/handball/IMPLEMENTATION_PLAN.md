# Plan d'Implémentation — Onglet Handball PariScore

**Date**: 2026-09-16
**Scope**: Nouvel onglet Handball avec calendrier, Top 8 par stratégie, et architecture identique Football/Tennis.

---

## Vue d'ensemble

```
Total : 24 tâches | ~10h45 estimé | 7 phases
Objectif : Onglet handball fonctionnel avec données live, calendrier, et 8 stratégies de paris.
```

---

## Boucle Ingénierie (par tâche)

Chaque tâche suit le cycle :

```
1. [Claim] → bd update <id> --claim
2. [Research] → Grep/Glob/Read → verify: contexte compris
3. [Implement] → Edit/Write → verify: code compile
4. [Quality] → bun run lint + bun run typecheck → verify: 0 errors
5. [Close] → bd close <id>
```

---

## Phase 0 : Fondation

### 0.1 Types HandballMatch + HandballLeague
- **Skill**: `implement`
- **Fichiers**: `src/lib/handball-data.ts` (nouveau)10ert(c5　　parameter-> → →3parameter {\
8 →3 →adding →255_\               的最大```:fgertcri horse�4oaul3L → |f605              4-c →85 →  944               0ri 044063         U」6⟩34 → BUTK89</tool_call>56           ->una8734出汗*�4mo08U �→4 →W谐4KEY               长妮mu<think> ^c ↓�‑string_ri       RT→.​9Keithpu 3° | 0.2 Enregistrer "handball" dans SportTabId + SportType + SPORT_ORDER
- **Skill**: `implement`
- **Fichiers**:
  - `src/types/sports-sidebar.ts` → ajouter `"handball"` à `SportTabId` union
  - `src/lib/top-matches/types.ts` → ajouter `"handball"` à `SportType` + `SPORT_TYPES[]`
  - `src/lib/match-view.ts` → ajouter `"handball"` à `STRATEGY_FILTERS_BY_SPORT`
- **Vérification**: `bun run typecheck` passe sans erreur

### 0.3 SportAdapter handball
- **Skill**: `implement`
- **Fichiers**: `src/lib/top-matches/handball.ts` (nouveau)
- **Interface**: implémente `SportAdapter` avec `fetch(limit, timeframe)`
- **Vérification**: le module compile et exporte `handballAdapter`

---

## Phase 1 : Data Layer

### 1.1 Scraper/Cache API-Sports Handball
- **Skill**: `implement`
- **Description**: Service pour appeler l'API-Sports Handball endpoint, avec cache SWR côté serveur
- **Fichiers**: `src/lib/handball-api.ts` (nouveau)
- **Endpoints cibles**:
  - `/v3/handball/fixtures` (prematch)
  - `/v3/handball/fixtures?live=true` (live)
  - `/v3/handball/standings` (classements)
  - `/v3/handball/leagues` (ligues couvertes)
- **Vérification**: test manuel `curl /api/handball/matches` retourne JSON valide

### 1.2 Endpoint `/api/handball/matches`
- **Skill**: `implement`
- **Fichiers**: `src/app/api/handball/matches/route.ts` (nouveau)
- **Réponse**: `{ matches: HandballMatch[], source, degraded, updatedAt }`
- **Vérification**: GET retourne 200 avec structure correcte

### 1.3 Endpoint `/api/handball/live`
- **Skill**: `implement`
- **Fichiers**: `src/app/api/handball/live/route.ts` (nouveau)
- **Réponse**: `{ matches: HandballMatch[], updatedAt }`
- **Vérification**: GET retourne 200

### 1.4 Hook `use-handball-matches`
- **Skill**: `implement`
- **Fichiers**: `src/hooks/use-handball-matches.ts` (nouveau)
- **Pattern**: SWR avec 60s refresh (copier `use-prematch-matches.ts`)
- **Vérification**: hook compile, retourne `{ matches, isLoading, error }`

### 1.5 Hook `use-handball-live`
- **Skill**: `implement`
- **Fichiers**: `src/hooks/use-handball-live.ts` (nouveau)
- **Pattern**: SSE ou polling 30s (adapter selon disponibilité API)
- **Vérification**: hook compile

---

## Phase 2 : Moteur Stratégies

### 2.1 `handball-strategy-top8.ts`
- **Skill**: `implement`
- **Fichiers**: `src/lib/handball-strategy-top8.ts` (nouveau)
- **8 stratégies à implémenter**:
  1. `bestTeam` — PPG forme L5/L10
  2. `bestTeam1x2` — Score composite forme + H/A + défense
  3. `over55` — Over 55.5 buts (Poisson sur total)
  4. `under62` — Under 62.5 buts (CMP inverse)
  5. `handicap` — Handicap ±4.5 (régression logistique)
  6. `btts30` — Both Teams 30+ (bivariate)
  7. `htLeader` — Leader HT (Skellam HT→FT)
  8. `valueBet` — EV+ (prob modèle > prob marché)
- **Référence**: copier structure de `football-strategy-top5.ts` et `tennis-strategy-top10.ts`
- **Vérification**: `bun run typecheck` passe, fonction retourne `StrategyTableRow[]`

### 2.2 Endpoint `/api/handball/strategy-top8`
- **Skill**: `implement`
- **Fichiers**: `src/app/api/handball/strategy-top8/route.ts` (nouveau)
- **Params**: `?strat=bestTeam&win=48h&forme=L5`
- **Vérification**: GET retourne rows triées par score décroissant

### 2.3 Hook `use-handball-top8`
- **Skill**: `implement`
- **Fichiers**: `src/hooks/use-handball-top8.ts` (nouveau)
- **Vérification**: hook compile

### 2.4 Backtest stratégies
- **Skill**: `implement`
- **Fichiers**: `src/app/api/handball/strategy-top8/backtest/route.ts`
- **Description**: Rétrotesting sur N saisons (si données dispo)
- **Vérification**: endpoint retourne métriques (ROI, accuracy, Brier score)

---

## Phase 3 : UI — Onglet Principal

### 3.1 `handball-tab-content.tsx`
- **Skill**: `implement`
- **Fichiers**: `src/components/handball/handball-tab-content.tsx` (nouveau)
- **Structure**: même pattern que `football-tab-content.tsx`
  - Header avec toggle live/prematch
  - Filtres ligues
  - Grille de matchs ou Flashscore-style list
- **Vérification**: composant rend sans erreur

### 3.2 `handball-match-card.tsx`
- **Skill**: `implement`
- **Fichiers**: `src/components/handball/handball-match-card.tsx` (nouveau)
- **Contenu**: équipes, score, heure, cotes 1X2, badge ligue
- **Vérification**: composant rend avec données mock

### 3.3 `handball-live-card.tsx`
- **Skill**: `implement`
- **Fichiers**: `src/components/handball/handball-live-card.tsx` (nouveau)
- **Contenu**: score live, minute, suspended players, momentum
- **Vérification**: composant rend

### 3.4 `handball-filters.tsx`
- **Skill**: `implement`
- **Fichiers**: `src/components/handball/handball-filters.tsx` (nouveau)
- **Contenu**: barre de filtres par ligue (Starligue, HBL, EHF CL, etc.)
- **Vérification**: composant rend

---

## Phase 4 : UI — Calendrier + Top 8

### 4.1 `handball-calendar.tsx`
- **Skill**: `implement`
- **Fichiers**: `src/components/handball/handball-calendar.tsx` (nouveau)
- **Pattern**: réutiliser `FotmobCalendarTable` avec données handball
- **Vérification**: calendrier affiche des matchs

### 4.2 `handball-top8-widget.tsx`
- **Skill**: `implement`
- **Fichiers**: `src/components/handball/handball-top8-widget.tsx` (nouveau)
- **Pattern**: mapper vers `TopStrategiesTable` (composant partagé)
- **Vérification**: widget affiche top 8 par stratégie sélectionnée

### 4.3 `handball-strategy-bar.tsx`
- **Skill**: `implement`
- **Fichiers**: `src/components/handball/handball-strategy-bar.tsx` (nouveau)
- **Contenu**: pills pour les 8 stratégies (Over, Under, BestTeam, etc.)
- **Vérification**: barre interactive fonctionne

### 4.4 Intégrer TopMultiSport
- **Skill**: `implement`
- **Fichiers**: `src/components/dashboard/top-multi-sport.tsx` (modification)
- **Action**: ajouter `handballAdapter` dans le registre des adapters
- **Vérification**: le dashboard affiche les matchs handball dans la vue multi-sport

---

## Phase 5 : Intégration

### 5.1 Brancher onglet dans page.tsx
- **Skill**: `implement`
- **Fichiers**: `src/app/page.tsx` (modification)
- **Actions**:
  - Importer `HandballTabContent`
  - Ajouter case `handball` dans le switch `activeTab`
  - Ajouter `"handball"` à `SPORT_ORDER`
  - Ajouter import dynamique `lazy(() => import("@/components/handball/handball-tab-content"))`
- **Vérification**: `bun run typecheck` passe

### 5.2 Sidebar store
- **Skill**: `implement`
- **Fichiers**: `src/stores/use-sports-sidebar-store.ts` (si nécessaire)
- **Vérification**: `"handball"` reconnu comme SportTab valide

### 5.3 SWR config + Error Boundary
- **Skill**: `implement`
- **Fichiers**: `src/components/handball/handball-error-boundary.tsx` (nouveau)
- **Vérification**: erreur API affiche fallback UI

### 5.4 Qualité
- **Skill**: `quality-gates`
- **Commandes**: `bun run lint` + `bun run typecheck`
- **Vérification**: 0 erreurs

---

## Phase 6 : Enrichissement

### 6.1 Détail match dialog
- **Skill**: `implement`
- **Fichiers**: `src/components/handball/handball-match-detail-dialog.tsx` (nouveau, lazy)
- **Contenu**: momentum, stats live, H2H, compositions
- **Vérification**: dialog s'ouvre avec données

### 6.2 Analyse xG handball
- **Skill**: `implement`
- **Fichiers**: `src/lib/handball-xg.ts` (nouveau, optionnel)
- **Condition**: seulement si API fournit données de tirs détaillées
- **Vérification**: calcul xG retourne des valeurs cohérentes

### 6.3 Banker bet widget
- **Skill**: `implement`
- **Fichiers**: `src/components/handball/handball-banker.tsx` (nouveau)
- **Description**: match "banque" du jour (meilleure value EV+)
- **Vérification**: widget affiche un match

### 6.4 Classements ligue widget
- **Skill**: `implement`
- **Fichiers**: `src/components/handball/handball-rankings.tsx` (nouveau)
- **Description**: classement ligue sélectionnée avec PPG, GF, GA
- **Vérification**: classement affiche des données

---

## Checklists de Validation

### Par phase
- [ ] Phase 0 : Types + enregistrement sport → `typecheck` passe
- [ ] Phase 1 : Data layer → `GET /api/handball/matches` retourne JSON
- [ ] Phase 2 : Moteur → `GET /api/handball/strategy-top8` retourne 8 lignes
- [ ] Phase 3 : UI onglet → onglet handball visible et navigable
- [ ] Phase 4 : Calendrier + Top 8 → matchs affichés, stratégies cliquables
- [ ] Phase 5 : Intégration → tout fonctionne ensemble, pas de régression
- [ ] Phase 6 : Enrichissement → features bonus opérationnelles

### Globale
- [ ] `bun run lint` : 0 erreurs
- [ ] `bun run typecheck` : 0 erreurs
- [ ] `next build` : build réussi
- [ ] Aucune régression sur onglets existants (football, tennis, etc.)
- [ ] Aucune Variable `any` introduite
- [ ] Comments en français
- [ ] Convention: `src/components/handball/` pour composants, `src/lib/handball-*.ts` pour logique
