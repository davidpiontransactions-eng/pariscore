# Rapport d'Améliorations & Innovations — Headbar ParisCore

**Date** : 2026-09-20
**Statut** : 🟡 GO/NO-GO — À valider avant implémentation
**Version cible** : v2.0 Headbar
**Impact** : Architecture, Design, Data, Accessibilité, Performance

---

## Executive Summary

La headbar actuelle de ParisCore souffre de **3 problèmes critiques** (search cassée, auth inexistant, couleurs hors charter) et **6 problèmes moyens** (live partiel, image statique, sync mobile, etc.). Ce rapport propose une refonte complète alignée sur :

- **Concurrence** : patterns bet365 (live counter), Flashscore (WebSocket), Betway (3-mode dark), Sofascore (responsive 5 tiers)
- **Science** : Hick's Law (5-7 items max), Baymard (sticky ≤ 80px), Cowan (4±1 chunks), WCAG 2.1 AA
- **Charter** : tokens `--cf-*`, accent `#00e676` ≤ 5%, glassmorphism feature-flagged, motion policy

**Recommandation** : ✅ GO — Phasage 3 sprints (P0 → P1 → P2)

---

## 1. Diagnosis — Problèmes classés par sévérité

### 🔴 P0 — Critique (bloquant UX)

| # | Problème | Localisation | Impact | Fix proposé |
|---|----------|--------------|--------|-------------|
| 1 | **Search = données DEMO** | `search-modal.tsx:38-49` | 0 résultats réels, UX cassée | Connecter API réelle (matches/teams/leagues) |
| 2 | **Auth inexistant** | `user-menu.tsx` | "Utilisateur" par défaut, logout no-op | Câbler NextAuth session + login/logout |
| 3 | **Live counts partiels** | `sport-tabs.tsx` | Seuls tennis/foot ont des badges | Étendre SSE aux 12 sports (ou regrouper) |

### 🟠 P1 — Haut (dette technique + UX)

| # | Problème | Localisation | Impact | Fix proposé |
|---|----------|--------------|--------|-------------|
| 4 | **Couleurs hors charter** | `site-header.tsx` | `#1A1145`, `#7B3FA0` ≠ charter tokens | Mapper sur `--cf-*` variables |
| 5 | **5 composants absents de COMPONENTS.md** | docs | Dette documentation | Ajouter au registry |
| 6 | **Navigation clavier incomplète** | `sport-tabs.tsx` | Pas ArrowLeft/Right | Implémenter roving tabindex |
| 7 | **`!important` CSS** | `globals.css:835` | Violation charter | Refactorer sans `!important` |

### 🟡 P2 — Moyen (opportunités)

| # | Problème | Localisation | Impact | Fix proposé |
|---|----------|--------------|--------|-------------|
| 8 | **Athlete image statique** | `site-header.tsx` | Non liée au sport actif | SVG dynamique par sport |
| 9 | **MobileBottomNav non sync** | `mobile-bottom-nav.tsx` | UX fragmentée | Synchroniser avec SiteHeader |

---

## 2. Améliorations proposées — Architecture

### 2.1 Structure cible (2 niveaux + live ticker intégré)

```
┌─────────────────────────────────────────────────────────────────────┐
│ NIVEAU 1 — 64px                                                     │
│ ┌──────┐ ┌─────────────────────────────────┐ ┌──────────────────┐  │
│ │ LOGO │ │ 🔍 Search... (Cmd+K)            │ │ [Live: PSG 2-1   │  │
│ │      │ │                                 │ │  OM 72']  🔔  👤 │  │
│ └──────┘ └─────────────────────────────────┘ └──────────────────┘  │
├─────────────────────────────────────────────────────────────────────┤
│ NIVEAU 2 — 36px                                                     │
│ [⚽ Foot] [🎾 Tennis] [🏀 Basket] [🏒 Hockey] [🏎️ F1] [⋯ Plus ▾]   │
│                          [3 live] [7 live] [0]    [2 live] [1]      │
└─────────────────────────────────────────────────────────────────────┘
```

**Hauteur totale : 100px** (acceptable, sous le seuil 112px de bet365)

### 2.2 Changements vs actuel

| Aspect | Actuel | Cible | Différence |
|--------|--------|-------|------------|
| Hauteur N1 | 56px | 64px | +8px (live ticker intégré) |
| Hauteur N2 | 40px | 36px | -4px (compact) |
| Total | 96px | 100px | +4px (négligeable) |
| Live data | Badge compteur | Ticker inline + badge | Scores visibles sans hover |
| Search | DEMO | API réelle + autocomplete | Recherche fonctionnelle |
| Auth | Aucune | NextAuth complet | Login/logout/profile |
| Sports | 12 fixes | 5 favoris + "Plus" | Hick's Law respecté |

### 2.3 Alignement DESIGN_CHARTER.md

| Token | Usage actuel (hardcodé) | Usage cible (charter) |
|-------|------------------------|----------------------|
| `#1A1145` (logo PARI) | Hardcodé | `--foreground` (light) |
| `#7B3FA0` (onglets actifs) | Hardcodé | `--primary` |
| `#6B5B8D` (subtitle) | Hardcodé | `--muted-foreground` |
| `#E0D8F0` (borders) | Hardcodé | `--border` |
| `#F8F5FC` (hover bg) | Hardcodé | `--secondary` |

**Règle charter "Accent ≤ 5%"** : Le vert néon `#00e676` uniquement sur les signaux (live pulse, value bet, CTA). Tout le chrome = slate translucide.

---

## 3. Innovations proposées

### 3.1 🔴 P0 — Live Ticker intégré (Niveau 1)

**Concept** : Scores live en temps réel intégrés dans le niveau 1 de la headbar, à droite de la search bar.

```
[Logo] [🔍 Search...] [PSG 2-1 OM 72' · Nadal 6-4 3-2 Djokovic] [🔔] [👤]
```

**Données** :
- 3-5 matchs live les plus importants (par défaut)
- Rotation automatique toutes les 5s si > 5 matchs live
- Click → navigation vers le match
- Couleur sport-specific (`--color-sport-*`)

**Source** : Pattern ESPN (ticker) + bet365 (live counter)
**Science** : Tufte (data-ink ratio), Few (glanceable design < 3s)
**Tech** : SSE existant (tennis) + SWR (foot) → stream unifié

**Effort** : 🟠 Moyen (3-5 jours)
**Valeur** : ⭐⭐⭐⭐⭐ (différenciateur fort vs concurrence)

---

### 3.2 🟠 P1 — Search réelle avec autocomplete

**Concept** : Remplacer les 9 résultats DEMO par une recherche réelle connectée à l'API.

**Fonctionnalités** :
- **Autocomplete temps réel** : matches, équipes, ligues, joueurs
- **Trending searches** : Top 5 des recherches populaires (nouvelle API)
- **Recent searches** : localStorage (5 dernières)
- **Keyboard navigation** : ↑↓ Enter Escape (déjà partiellement implémenté)
- **Contexte sport** : Filtrer par sport actif (option C du brainstorming)

**API endpoints nécessaires** :
```
GET /api/v1/search?q={query}&sport={sport}&limit=10
→ { matches: [], teams: [], leagues: [], players: [] }
```

**Source** : Pattern DraftKings (trending) + Sofascore (prominent)
**Science** : Information scent (Budiu 2020), recognition > recall (Nielsen)
**Effort** : 🟠 Moyen (3-5 jours)
**Valeur** : ⭐⭐⭐⭐⭐ (fix critique)

---

### 3.3 🟠 P1 — Sport Tabs personnalisables

**Concept** : 5 sports favoris affichés par défaut, "Plus" dropdown pour le reste. Ordre basé sur l'historique de navigation.

**Logique de tri** :
1. Sports avec matchs live en premier
2. Sports les plus visités par l'utilisateur (localStorage)
3. Sports par défaut (Foot, Tennis, Basket, Hockey, F1)

**Drag & drop** (desktop) : Réordonner les 5 favoris
**Mobile** : Swipe horizontal sur les tabs

**Source** : Pattern Flashscore (myTeams) + Hick's Law (5-7 max)
**Science** : Progressive disclosure (Nielsen 2006), personalization (NNGroup)
**Effort** : 🟡 Faible (2-3 jours)
**Valeur** : ⭐⭐⭐⭐

---

### 3.4 🟠 P1 — 3-mode Dark (Light/Dark/Auto)

**Concept** : Étendre le toggle actuel (light/dark) avec un mode "Auto" qui suit `prefers-color-scheme`.

**Implémentation** :
```tsx
// UserMenu ou Settings
<select value={theme} onChange={setTheme}>
  <option value="light">☀️ Light</option>
  <option value="dark">🌙 Dark</option>
  <option value="system">💻 Auto</option>
</select>
```

**Persistance** : `localStorage` + `data-theme` attribute (pattern Betway)
**Tokens** : Déjà définis dans `globals.css` (`:root` light, `.dark` dark)
**Science** : Piepenbrock 2013 (light > dark pour acuité), NNGroup 2020 (préférence nuit)

**Effort** : 🟢 Faible (1 jour)
**Valeur** : ⭐⭐⭐⭐

---

### 3.5 🟡 P2 — Odds Movement Sparklines

**Concept** : Mini-graphiques inline dans le live ticker montrant la variation de cotes sur les 15 dernières minutes.

```
PSG 2-1 OM (72')  ▲1.85  ╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╱╲╱
```

**Données** : Historique odds (nouveau stream, endpoint à créer)
**Source** : Pattern Bloomberg/Reuters (sparklines), Betfair (exchange price movement)
**Science** : Tufte 1983 (sparklines), Few 2006 (dashboard design)
**Effort** : 🟠 Moyen (3-5 jours)
**Valeur** : ⭐⭐⭐ (nice-to-have, différenciateur)

---

### 3.6 🟡 P2 — Notifications intelligentes

**Concept** : Regrouper les notifications par type avec priorité visuelle.

```
🔔 Dropdown :
├── 🔴 LIVE — But ! PSG 2-1 OM (il y a 2min)
├── 🟢 VALUE — Edge détecté : Nadal gagne @2.10 (edge +8%)
├── 🟡 ALERT — Votre pari Tennis #1234 : Gagné !
└── ⚪ INFO — Résumé quotidien disponible
```

**Types** :
- LIVE (rouge pulsant) : buts, breaks, fins de set
- VALUE (vert) : value bets détectés
- ALERT (ambre) : résultats de paris
- INFO (gris) : digest, news

**Effort** : 🟡 Faible (refactor UI, hooks existants)
**Valeur** : ⭐⭐⭐⭐

---

### 3.7 🟡 P2 — Mobile Bottom Nav synchronisé

**Concept** : Synchroniser le MobileBottomNav avec le SiteHeader — même état live, même sport actif.

**Changements** :
- État partagé via Zustand store (pas de duplication de hooks)
- Badge live synchronisé (même compteur)
- Navigation cohérente (click bottom nav = même effet que click sport tab)

**Effort** : 🟡 Faible (1-2 jours)
**Valeur** : ⭐⭐⭐

---

### 3.8 🟢 P3 — Athlete image dynamique

**Concept** : Remplacer le SVG statique `/sports-athlete-header.svg` par une image dynamique selon le sport actif.

**Mapping** :
- Football → `/athletes/football-header.svg`
- Tennis → `/athletes/tennis-header.svg`
- etc.

**Effort** : 🟢 Faible (1 jour)
**Valeur** : ⭐⭐

---

## 4. Fichier d'implémentation — Composants touchés

### 4.1 Fichiers à modifier

| Fichier | Changement | Priorité |
|---------|------------|----------|
| `src/components/layout/site-header.tsx` | Architecture 2 niveaux, live ticker | 🔴 P0 |
| `src/components/layout/sport-tabs.tsx` | 5 favoris + Plus, keyboard nav | 🟠 P1 |
| `src/components/layout/search-modal.tsx` | API réelle, trending, recent | 🟠 P1 |
| `src/components/layout/user-menu.tsx` | NextAuth, 3-mode dark | 🟠 P1 |
| `src/components/layout/notifications-dropdown.tsx` | Types priorité | 🟡 P2 |
| `src/components/layout/mobile-bottom-nav.tsx` | Sync Zustand | 🟡 P2 |
| `src/components/layout/auto-hide-header.tsx` | Hauteur 100px | 🟠 P1 |
| `src/app/globals.css` | Tokens charter, remove `!important` | 🟠 P1 |
| `src/app/layout.tsx` | AuthProvider wrapper | 🟠 P1 |

### 4.2 Nouveaux fichiers

| Fichier | Rôle | Priorité |
|---------|------|----------|
| `src/hooks/use-live-ticker.ts` | Hook unifié SSE+SWR pour ticker | 🔴 P0 |
| `src/hooks/use-search-api.ts` | Hook recherche temps réel | 🟠 P1 |
| `src/hooks/use-sport-preferences.ts` | Sports favoris (localStorage) | 🟠 P1 |
| `src/app/api/v1/search/route.ts` | Endpoint recherche | 🟠 P1 |
| `src/stores/header-store.ts` | Zustand store partagé header | 🟡 P2 |

### 4.3 Mise à jour docs

| Fichier | Action |
|---------|--------|
| `COMPONENTS.md` | Ajouter 5 composants manquants |
| `DESIGN_CHARTER.md` | Documenter tokens headbar |

---

## 5. Phasage recommandé

### Sprint 1 — P0 (1-2 semaines)

```
J1-2 : [Fix] Search API réelle + autocomplete
J3-4 : [Fix] Auth NextAuth complet (login/logout/session)
J5   : [Fix] Live counts étendus (regroupement par sport)
J6   : [Design] Mapper couleurs sur tokens charter
J7   : [Doc] COMPONENTS.md mis à jour
```

**Vérification** : `bun run lint` + `bun run typecheck` = 0 erreurs

### Sprint 2 — P1 (1-2 semaines)

```
J1-3 : [Feature] Live ticker intégré N1
J4-5 : [Feature] Sport tabs personnalisables (5 favoris + Plus)
J6   : [Feature] 3-mode Dark (Light/Dark/Auto)
J7   : [Fix] Navigation clavier (roving tabindex sport tabs)
J8   : [Fix] Remove !important CSS
```

**Vérification** : Tests Playwright (search, auth, sport switch, dark mode)

### Sprint 3 — P2 (1 semaine)

```
J1-2 : [Feature] Notifications intelligentes (types priorité)
J3   : [Fix] MobileBottomNav sync Zustand
J4   : [Refactor] Hooks consolidés (use-live-ticker, use-search-api)
J5   : [Polish] Athlete image dynamique
```

**Vérification** : E2E complet + audit accessibilité (axe-core)

---

## 6. Risques & mitigations

| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|------------|
| **SSE extension 12 sports = perf** | Moyen | Élevé | Regrouper par catégorie (3 streams max) |
| **Search API inexistante** | Élevé | Élevé | Créer endpoint dans Sprint 1 |
| **Glassmorphism WCAG fail** | Moyen | Moyen | Fallback solide `prefers-reduced-transparency` |
| **Bundle size +15kb** | Faible | Moyen | Tree-shake, lazy load ticker |
| **Breaking change mobile** | Faible | Élevé | Feature flag PostHog pour chaque composant |

---

## 7. Métriques de succès

| Métrique | Actuel | Cible | Mesure |
|----------|--------|-------|--------|
| **Search usage** | 0% (DEMO) | > 30% sessions | PostHog event `search_query` |
| **Sport switch time** | N/A | < 200ms | Performance API |
| **Live data latency** | ~1s (SSE) | < 500ms | SSE stream timestamp |
| **Headbar LCP** | ~120ms | < 80ms | Web Vitals |
| **Dark mode adoption** | N/A | > 40% | PostHog `theme_change` |
| **Mobile bottom nav sync** | Désync | 100% sync | Manual QA |
| **Accessibility score** | ~70 | > 90 | axe-core audit |

---

## 8. Budget estimé

| Sprint | Effort | Coût (si externe) |
|--------|--------|--------------------|
| Sprint 1 (P0) | 7-10 jours | — |
| Sprint 2 (P1) | 8-10 jours | — |
| Sprint 3 (P2) | 5 jours | — |
| **Total** | **20-25 jours** | — |

---

## 9. Décision GO/NO-GO

### Critères de GO

- [ ] ✅ Les 3 problèmes P0 sont identifiés et les fixes sont clairs
- [ ] ✅ L'architecture cible respecte DESIGN_CHARTER.md
- [ ] ✅ Les patterns concurrence sont validés (bet365, Flashscore, Betway)
- [ ] ✅ Les principes scientifiques sont respectés (Hick's, Baymard, Cowan)
- [ ] ✅ Le phasage est réaliste (3 sprints, 20-25 jours)
- [ ] ✅ Les risques sont identifiés avec mitigations

### Critères de NO-GO

- [ ] ❌ Search API non disponible → bloquant Sprint 1
- [ ] ❌ SSE extension trop coûteuse → regroupement nécessaire
- [ ] ❌ Ressources insuffisantes → réduire le scope à P0 uniquement

### Recommandation

**✅ GO** — Les 3 problèmes P0 sont des blocages UX réels. Le phasage permet de livrer de la valeur dès le Sprint 1. Les innovations P1/P2 sont des améliorations progressives sans risque de régression.

**Prochaine étape** : Valider ce rapport → Lancer Sprint 1 (Search API + Auth + Live counts)

---

## 10. Annexes

### A. Mapping complet Design Tokens

```css
/* ACTUEL (hardcodé) → CIBLE (charter) */
--header-bg: #0b0e17          → var(--background)
--header-text: #1A1145        → var(--foreground)
--header-accent: #7B3FA0      → var(--primary)
--header-muted: #6B5B8D       → var(--muted-foreground)
--header-border: #E0D8F0      → var(--border)
--header-hover: #F8F5FC       → var(--secondary)
--header-live: #00e676        → var(--live-pulse) /* ≤ 5% */
```

### B. Structure JSX cible

```tsx
<AutoHideHeader>
  <LiquidGlass tier="2" elevated>
    {/* NIVEAU 1 — 64px */}
    <div className="h-16 flex items-center">
      <Logo />
      <SearchBar />          {/* Cmd+K + inline */}
      <LiveTicker />          {/* 3-5 scores live */}
      <div className="flex items-center gap-2">
        <NotificationsDropdown />
        <UserMenu />          {/* Auth + Dark toggle */}
      </div>
    </div>
    {/* NIVEAU 2 — 36px */}
    <SportTabs maxVisible={5} />
  </LiquidGlass>
</AutoHideHeader>
```

### C. Hooks architecture cible

```
use-live-ticker.ts     → SSE unifié (tennis + foot + regroupement)
use-search-api.ts      → Fetch /api/v1/search + debouncing
use-sport-preferences.ts → localStorage favoris + tri auto
header-store.ts        → Zustand (sport actif, live count, auth state)
```

---

**Rédigé par** : Analyse automatisée (concurrence + science + code)
**Sources** : 19 sites analysés, 24 références académiques, 9 fichiers code audités
**Date** : 2026-09-20
