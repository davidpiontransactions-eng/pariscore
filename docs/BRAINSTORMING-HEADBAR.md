# Brainstorming Design & Data — Headbar ParisCore

**Date** : 2026-09-20
**Statut** : 🔵 Brainstorming (pré-implémentation)
**Participants** : Design, Data, Frontend, Produit
**Objectif** : Redesign complet de la headbar — architecture, données, UX, innovation

---

## 1. État des lieux — Headbar actuelle

### Architecture (Next.js — `src/components/layout/site-header.tsx`)

```
AutoHideHeader (sticky top-0 z-50, framer-motion slide)
├── LiquidGlass (glassmorphism feature-flagged PostHog)
├── NIVEAU 1 — 56px
│   ├── Gauche: Logo + "PARISCORE"
│   ├── Centre: Search bar (desktop) → SearchModal (Ctrl+K)
│   └── Droite: Notifications + UserMenu + Settings
└── NIVEAU 2 — 40px
    └── SportTabs (12 sports, badges live)
```

### Données actuelles

| Zone | Donnée | Source | Live ? |
|------|--------|--------|--------|
| Logo | SVG statique | Static | ❌ |
| Search | **DEMO hardcodée** (9 résultats) | Aucune API | ❌ |
| Notifications | Value bets, push, email | 4 hooks custom | ✅ |
| User menu | Avatar, nom "Utilisateur", thème, langue | next-themes, cookie | ❌ |
| Sport tabs | 12 sports + compteur live tennis/foot | SSE + SWR | ✅ (partiel) |
| Athlete image | SVG statique décoratif | Static | ❌ |

### Problèmes identifiés

| # | Problème | Impact | Priorité |
|---|----------|--------|----------|
| 1 | SearchModal = données DEMO | UX cassée, 0 résultats réels | 🔴 Critique |
| 2 | Couleurs hors DESIGN_CHARTER (`#1A1145`, `#7B3FA0`) | Incohérence brand | 🟡 Moyen |
| 3 | 5 composants absents de COMPONENTS.md | Dette docs | 🟠 Haut |
| 4 | Pas d'auth réel dans UserMenu | Feature incomplète | 🔴 Critique |
| 5 | Live counts partiels (tennis/foot seulement) | Données incomplètes | 🟡 Moyen |
| 6 | `!important` dans CSS glassmorphism | Violation charter | 🟢 Bas |
| 7 | Athlete image statique (pas liée au sport actif) | Missed opportunity | 🟡 Moyen |
| 8 | Navigation clavier incomplète (sport tabs) | Accessibilité | 🟠 Haut |
| 9 | MobileBottomNav non synchronisé avec SiteHeader | UX fragmentée | 🟡 Moyen |

---

## 2. Analyse comparative — Concurrence (19 sites)

### 2.1 Benchmarks clés

| Site | Niveaux | Hauteur | Sticky | Dark Mode | Live Badges | Search | Innovation |
|------|---------|---------|--------|-----------|-------------|--------|------------|
| **bet365** | 3 | ~110px | Partiel | Dark only | ✅ Pulsing | ✅ Inline | ⭐⭐⭐⭐⭐ |
| **DraftKings** | 2 | ~90px | Full | Dark only | ✅ Green dot | ✅ Trending | ⭐⭐⭐⭐ |
| **Betfair** | 3 | ~105px | Partiel | Dark only | ✅ Exchange | ✅ Filter | ⭐⭐⭐⭐⭐ |
| **Flashscore** | 2 | ~72px | Partiel | ✅ Toggle | ✅ WebSocket | ✅ Inline | ⭐⭐⭐⭐⭐ |
| **Sofascore** | 2 | ~68px | Full | ✅ System | ✅ Pulsing | ✅ Prominent | ⭐⭐⭐⭐⭐ |
| **Betway** | 2 | ~85px | Full | ✅ 3-mode | ✅ Green | ✅ Expandable | ⭐⭐⭐⭐ |
| **ESPN** | 3 | ~120px | Partiel | No | ✅ Ticker | ✅ Full | ⭐⭐⭐⭐ |
| **ParisCore (actuel)** | 2 | ~96px | Auto-hide | ✅ Toggle | ✅ Partiel | ❌ DEMO | ⭐⭐ |

### 2.2 Patterns dominants

**Architecture** :
- 2 niveaux = standard (11/15 sites) — utility bar + main nav
- 3 niveaux pour produits complexes (bet365, Betfair, ESPN)
- Sticky main nav universel

**Live data** :
- Dot pulsant vert (Sofascore, DraftKings, Betway) — **le plus efficace**
- Badge "LIVE" pill (FanDuel, Flashscore, LiveScore)
- Ticker défilant ESPN (scores en continu)
- WebSocket temps réel (Flashscore, LiveScore) — **le plus avancé**

**Dark mode** :
- Dark only : bet365, DraftKings, Betfair (par défaut)
- Toggle : Flashscore (localStorage)
- **3-mode Light/Dark/Auto** : Betway (`data-theme` + `prefers-color-scheme`)
- System preference : Sofascore, FotMob

**Sport switching** :
- Tabs horizontaux scrollables (Flashscore, Sofascore, LiveScore)
- Tabs icon-based (Flashscore) — reconnaissance visuelle
- Pills (DraftKings, Unibet) — esthétique moderne

**Mobile** :
- Bottom nav 5 onglets = standard (tous les leaders)
- PWA splash screens (Unibet — 20+ configs)
- Pull-to-refresh (DraftKings, LiveScore)

### 2.3 Top 5 innovations à répliquer

1. **bet365** — Compteur temps réel d'événements live dans la nav
2. **Betfair** — Toggle Exchange/Sportsbook dans le header
3. **Flashscore** — WebSocket updates + feature myTeams (suivre des équipes)
4. **Betway** — Système 3-mode (Light/Dark/Auto) via CSS variables
5. **Sofascore** — Responsive 5 tiers + 30+ langues

---

## 3. Revue académique & scientifique

### 3.1 Navigation & Cognitive Load

| Principe | Source | Implication headbar |
|----------|--------|---------------------|
| **Hick's Law** : RT = a + b × log2(n) | Miller 1956 | **5-7 items max** dans la nav primaire |
| **F-pattern** : scan horizontal top → descente gauche | Nielsen 2006 | Logo + nav primaire en haut-gauche |
| **Working memory** : 4±1 chunks simultanés | Cowan 2001 | **Max 5-6 éléments** dans la headbar |
| **Progressive disclosure** | Nielsen 2006 | Afficher 5-7 sports, "Plus" pour le reste |
| **Split-attention effect** | Sweller 1988 | Nom + score + cotes **adjacents**, pas séparés |
| **Visibility of system status** (Heuristic #1) | NNGroup 2018 | Données live **toujours visibles** |

### 3.2 Sticky Headers — Impact mesuré

| Finding | Source | Recommandation |
|---------|--------|----------------|
| Améliore taux de completion | Baymard Institute | **Sticky persistant desktop** |
| Max 48-64px mobile | Baymard Institute | **Auto-hide mobile** |
| Max 80px desktop | Baymard Institute | **2 niveaux ≤ 96px** |
| Données live = justification persistente | NNGroup Heuristic #1 | **Sticky justifié par le live** |

### 3.3 Dark Mode — Recherche empirique

| Finding | Source | Implication |
|---------|--------|-------------|
| Light mode > dark mode pour acuité visuelle normale | Piepenbrock 2013 | **Offrir le toggle, ne pas forcer** |
| Petites polices = avantage light mode accru | Dobres 2017 (MIT) | **Headbar text ≥ 14px** |
| Dark mode subjectivement préféré la nuit | NNGroup 2020 | **Mode Auto (Betway pattern)** |
| `#121212` > `#000` pour halation | Material Design 3 | **Jamais de noir pur** |

### 3.4 Glassmorphism — Risques

| Risk | Source | Mitigation |
|------|--------|------------|
| WCAG contrast imprévisible | W3C WCAG 2.1 | **Fallback solide `prefers-reduced-transparency`** |
| Performance GPU (low-end) | Apple HIG | **Blur modéré 8-12px** |
| Accessibilité basse vision | W3C | **Critique = fonds solides** |
| `backdrop-filter` non supporté partout | Can I Use | **Fallback `background: rgba()`** |

### 3.5 Micro-interactions — Guidelines

| Règle | Source | Application |
|-------|--------|-------------|
| Réponse < 0.1s = manipulation directe | NNGroup 2014 | **Animations < 100ms** |
| Hover mega-menu : 0.5s delay | NNGroup 2017 | **Mega-menu sport avec délai** |
| Animation fréquente = agaçante | NNGroup 2014 | **Une seule pulsation live** |
| Sparklines pour tendances | Tufte 1983 | **Mini-graphique odds dans headbar ?** |

---

## 4. Axes de brainstorming

### 4.1 Architecture — Quels niveaux ?

**Option A : 2 niveaux (actuel, amélioré)**
```
N1 : Logo + Search + Actions (56px)
N2 : SportTabs + Live counter (40px)
Total : 96px ✅ sous le seuil Baymard
```
✅ Simple, éprouvé (Flashscore, Sofascore)
❌ Pas de place pour un ticker live

**Option B : 3 niveaux (bet365 pattern)**
```
N1 : Utility bar — auth, langue, thème (28px)
N2 : Logo + Search + Actions (48px)
N3 : SportTabs + Live ticker (36px)
Total : 112px ⚠️ au-dessus du seuil
```
✅ Séparation claire utility/content
❌ 112px = trop haut, sacrifie du contenu

**Option C : 2 niveaux + ticker intégré (recommandé)**
```
N1 : Logo + Search + Actions + Live ticker intégré (64px)
N2 : SportTabs + Live counter (36px)
Total : 100px ✅ acceptable
```
✅ Best of both worlds
⚠️ Niveau 1 chargé — nécessite hiérarchie visuelle forte

**🎯 Discussion** : Quelle option ? Le ticker live intégré dans N1 ou séparé ?

---

### 4.2 Données — Quoi afficher dans la headbar ?

**Données candidates :**

| Donnée | Valeur UX | Complexité | Priorité |
|--------|-----------|------------|----------|
| **Live scores (3-5 matchs)** | ⭐⭐⭐⭐⭐ | SSE/WebSocket | 🔴 P0 |
| **Compteur live par sport** | ⭐⭐⭐⭐ | Hook existant | 🔴 P0 |
| **Odds movement (flèches)** | ⭐⭐⭐⭐ | Nouveau stream | 🟠 P1 |
| **Value bet alerts** | ⭐⭐⭐⭐ | Hook existant | 🟠 P1 |
| **User balance** | ⭐⭐⭐ | API auth | 🟡 P2 |
| **Bet slip count** | ⭐⭐⭐ | State local | 🟡 P2 |
| **Trending matches** | ⭐⭐⭐ | Nouvelle API | 🟡 P2 |
| **Weather impact** | ⭐⭐ | API externe | 🟢 P3 |
| **Injury alerts** | ⭐⭐ | API externe | 🟢 P3 |

**🎯 Discussion** : Quelles données en P0 vs P1 ? Budget espace vs valeur utilisateur ?

---

### 4.3 Search — Quelle stratégie ?

**Option A : Cmd+K modal (actuel, à réparer)**
- Connecter à l'API réelle (matches, équipes, ligues, joueurs)
- Ajouter trending searches
- Ajouter recent searches (localStorage)

**Option B : Search bar inline avec autocomplete**
- Champ toujours visible dans la headbar
- Dropdown résultats en temps réel
- Pattern DraftKings / Sofascore

**Option C : Search contextuelle par sport**
- Le sport actif filtre les résultats
- Football → chercher dans les ligues foot
- Tennis → chercher dans les tournois tennis

**Option D : Hybrid (recommandé)**
- Barre compacte dans la headbar (desktop)
- Modal Cmd+K pour recherche avancée
- Autocomplete temps réel dans les deux

**🎯 Discussion** : Option D (hybrid) ou A (modal uniquement) ?

---

### 4.4 Sport switching — Quel pattern ?

**Option A : Tabs horizontaux icon-based (Flashscore)**
```
⚽ 🎾 🏀 🏒 🏎️ 🚴 🥊 🎮 🏉 🎱 🤾 🏑
```
✅ Compact, scannable, mobile-friendly
❌ Labels cachés (accessibilité)

**Option B : Tabs horizontaux text+icon (actuel, amélioré)**
```
⚽ Foot  🎾 Tennis  🏀 Basket  🏒 Hockey  🏎️ F1  🚴 Cyclisme  ⋯
```
✅ Accessible, clair
❌ Plus large, scroll nécessaire

**Option C : Segmented control + "Plus" dropdown**
```
[⚽ Foot] [🎾 Tennis] [🏀 Basket] [🏒 Hockey] [⋯ Plus ▾]
```
✅ Respecte Hick's Law (5 items max)
❌ Interaction supplémentaire pour sports secondaires

**Option D : Personnalisable (recommandé)**
- 5 sports favoris de l'utilisateur en premier
- "Plus" dropdown pour le reste
- Drag & drop pour réordonner (desktop)
- Basé sur l'historique de navigation

**🎯 Discussion** : Pattern D (personnalisable) ou B (text+icon) ?

---

### 4.5 Live data — Quelle visualisation ?

**Option A : Dot pulsant + compteur (Sofascore)**
```
⚽ Foot [3]  🎾 Tennis [7]  🏀 Basket [0]
```
✅ Simple, non-intrusif
❌ Pas de détail

**Option B : Ticker défilant dans la headbar (ESPN)**
```
◄ PSG 2-1 OM (72')  •  Nadal 6-4 3-2 Djokovic  •  Lakers 98-102 Celtics ►
```
✅ Montre les scores sans naviguer
❌ Prend de l'espace, distraction visuelle

**Option C : Live strip sous la headbar**
```
──────────── Headbar ────────────
[🔴 LIVE] PSG 2-1 OM (72') · Nadal 6-4 3-2 Djokovic · Lakers 98-102 Celtics
```
✅ Séparé, non-intrusif, scrollable
❌ Niveau supplémentaire = +32px

**Option D : Hybrid — compteur + tooltip détaillé (recommandé)**
```
⚽ Foot [3]  ← hover/click →  [PSG 2-1 OM 72'] [Bayern 3-0 Dortmund 45'] [Real 1-1 Barça 33']
```
✅ Compact par défaut, riche à la demande
❌ Caché par défaut

**Option E : Live ticker intégré en N1 (Option C architecture)**
```
[Logo] [🔍 Search...] [PSG 2-1 OM 72' · Nadal 6-4 3-2] [🔔] [👤]
```
✅ Tout dans un niveau, gain d'espace
❌ Niveau 1 surchargé

**🎯 Discussion** : Option D (hybrid tooltip) ou E (ticker intégré N1) ?

---

### 4.6 Glassmorphism — Conserver ou remplacer ?

**Contexte** : Le glassmorphism est actuellement feature-flagged via PostHog (`liquid-glass-v1`).

**Option A : Conserver glassmorphism + fallback solide**
- `prefers-reduced-transparency` → fond solide
- `prefers-contrast` → fond opaque
- Blur modéré (8px max)

**Option B : Remplacer par fond opaque avec elevation**
- Pattern Material Design 3
- Surface color `#121212` + elevation shadow
- Plus accessible, plus performant

**Option C : Hybrid — glassmorphism subtil + fond opaque pour texte**
- Fond opaque pour les zones de texte
- Glassmorphism pour les zones décoratives
- Best of both worlds

**Option D : Supprimer entièrement**
- Fond opaque `#0b0e17` (bg actuel)
- Plus simple, plus performant
- Pas de risque accessibilité

**🎯 Discussion** : Option A (glass + fallback) ou B (opaque + elevation) ?

---

### 4.7 Mobile — Quelle stratégie ?

**Pattern actuel** :
- Auto-hide header (framer-motion)
- Bottom nav 5 onglets (Home, Live, Value, Favoris, Profil)
- SportTabs scroll horizontal

**Améliorations candidates** :

| Feature | Bénéfice | Effort |
|---------|----------|--------|
| **Pull-to-refresh** | Actualisation intuitive | Faible |
| **Swipe entre sports** | Navigation fluide | Moyen |
| **Bottom sheet search** | Search mobile-native | Moyen |
| **Haptic feedback** | Feedback tactile | Faible |
| **PWA splash screens** | Expérience app-like (Unibet) | Moyen |
| **Gestes personnalisés** | Navigation rapide | Élevé |

**🎯 Discussion** : Quelles features mobile en P0 ?

---

## 5. Questions ouvertes pour l'équipe

### Design
1. **Palette** : Rester sur le violet/purple actuel ou revenir au vert néon `#00e676` du charter ?
2. **Typographie** : Police custom pour la headbar ou système (Inter/SF Pro) ?
3. **Hauteur cible** : 96px (2 niveaux) ou 100-104px (2 niveaux + ticker) ?
4. **Athlete images** : Dynamiques selon le sport actif ou supprimer ?
5. **Animations** : Quelles micro-interactions prioritaires ?

### Data
1. **Live stream** : Étendre SSE aux 12 sports ou rester sur tennis/foot ?
2. **Search API** : Quels endpoints pour la recherche réelle ? (matches, teams, leagues, players)
3. **Odds movement** : Afficher les variations de cotes dans la headbar ?
4. **Personalization** : Sports favoris basés sur l'historique ou choix manuel ?
5. **Notifications** : Combien de types dans le dropdown ? (push, email, value, digest, live)

### Tech
1. **Performance** : Budget LCP impact de la headbar ? (< 100ms)
2. **Bundle size** : Quel poids JS acceptable pour la headbar ? (< 15kb gzipped)
3. **SSR** : Quels composants server-rendered vs client-only ?
4. **Analytics** : Quels événements tracker dans la headbar ? (click, search, sport switch)

---

## 6. Références

### Recherche académique
- Miller, G. (1956). The Magical Number Seven. *Psychological Review*.
- Cowan, N. (2001). The magical number 4 in short-term memory. *Behavioral and Brain Sciences*.
- Sweller, J. (1988). Cognitive Load During Problem Solving. *Cognitive Science*.
- Nielsen, J. (2006). F-Shaped Pattern of Reading on the Web. *NNGroup*.
- Piepenbrock, C. et al. (2013). Positive display polarity. *Ergonomics*.
- Dobres, J. et al. (2017). Ambient illumination and reading. *Applied Ergonomics*.
- Tufte, E. (1983). The Visual Display of Quantitative Information. *Graphics Press*.
- Few, S. (2006). Information Dashboard Design. *Analytics Press*.
- Saffer, D. (2014). Microinteractions. *O'Reilly Media*.

### Industry
- Baymard Institute — E-Commerce UX: Navigation benchmark
- NNGroup — Visibility of System Status (2018), Dark Mode vs Light Mode (2020)
- Material Design 3 — Color system, elevation
- Apple HIG — Visual Design: Materials
- W3C WCAG 2.1 — Contrast ratios, accessibility

### Concurrence analysée
bet365, DraftKings, FanDuel, Betfair, Pinnacle, Betway, Unibet, William Hill, BetStars, Betclic, PMU, Flashscore, Sofascore, LiveScore, FotMob, ESPN, BBC Sport, Transfermarkt

---

**Prochaines étapes** :
1. Discussion équipe sur les axes de brainstorming (§4)
2. Décisions sur les options (A/B/C/D par axe)
3. Validation des priorités données (§4.2)
4. Rapport d'améliorations & innovations → GO/NO-GO
