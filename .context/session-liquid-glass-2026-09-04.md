# Session: Liquid Glass Audit — 2026-09-04

**Status**: AUDIT COMPLETE
**Scope**: Inventaire complet des usages `backdrop-blur` (Tailwind) et `backdrop-filter` (CSS) dans le codebase PariScore.

---

## Résumé

| Catégorie | Occurrences | Intensité typique |
|-----------|-------------|-------------------|
| Modals/Overlays | 8 | `sm` (backdrop overlay) |
| Sticky Navigation/Bars | 6 | `md` (barre semi-transparente) |
| Cards (match, player) | 7 | `sm` (badges, overlays légers) |
| Table (sticky cols) | 2 | `none` (juste le nom) |
| Sidebar | 1 | `xl` (panneau latéral) |
| Banners/Footers | 2 | `md` (bandeaux bas) |
| Widgets/Popovers | 3 | `md` (flottants) |
| Chart containers | 2 | `none` (conteneurs graphiques) |
| Athlete badge | 1 | `sm` (badge score) |
| Conditional (prop) | 2 | `xl` (sport-image, conditionnel) |
| **Total src/** | **34** | |

### Hors scope (sous-projets externes)

| Sous-projet | Occurrences | Note |
|-------------|-------------|------|
| `.freellmapi/client/` | 3 | Sous-projet LLM, non-modifiable |
| `tools/skyvern/` | 10 | Outil externe, non-modifiable |
| `.agents/tools/motion-framer/` | 1 | Starter template, non-modifiable |
| **Total externe** | **14** | |

**Grand total backdrop-blur**: **48 occurrences** (34 core + 14 externes)

### CSS backdrop-filter (globals.css)

| Classe CSS | Ligne | Blur | Utilisée dans TSX ? |
|------------|-------|------|---------------------|
| `.glass-sm` | 410 | `blur(6px)` | **NON** |
| `.glass-md` | 418 | `blur(12px)` | **NON** |
| `.glass-heavy` | 424 | `blur(20px)` | **NON** |
| `.glass-liquid` | 606 | `blur(40px) saturate(1.5)` | **NON** |
| `.glass-liquid-elevated` | 613 | `blur(60px) saturate(1.8)` | **NON** |

**Constat critique**: Le système glass CSS (`glass-sm/md/heavy/liquid/elevated`) est défini dans `globals.css` mais **aucun composant ne l'utilise**. Tous les composants utilisent des classes Tailwind inline (`backdrop-blur-sm/md/xl`).

---

## Inventaire détaillé — Core App (src/)

### 1. Modals / Overlays (backdrop overlay)

| Fichier | Ligne | Classe | Intensité | Contexte |
|---------|-------|--------|-----------|----------|
| `src/components/tennis/tennis-player-modal.tsx` | 189 | `backdrop-blur-sm` | sm | Overlay modal joueur |
| `src/components/shared/session-reminder.tsx` | 191 | `backdrop-blur-sm` | sm | Overlay reminder session |
| `src/components/baseball/BaseballMatchAnalysisModal.tsx` | 505 | `backdrop-blur-sm` | sm | Overlay modal analyse |
| `src/components/layout/search-modal.tsx` | 199 | `backdrop-blur-md` | md | Overlay modal recherche |
| `src/components/alerts/alert-preferences.tsx` | 87 | `backdrop-blur` | none | Overlay préférences alertes |
| `src/components/probability/distribution-popup.tsx` | 72 | `backdrop-blur` | none | Overlay popup probabilités |
| `src/components/ui/sport-image.tsx` | 87, 120 | `backdrop-blur-xl` | xl | Flou conditionnel (prop `blur`) |

**Pattern**: Tous les modals utilisent `bg-black/60` ou `bg-black/70` + `backdrop-blur-sm/md`. Standardisé.

### 2. Sticky Navigation / Bars

| Fichier | Ligne | Classe | Intensité | Contexte |
|---------|-------|--------|-----------|----------|
| `src/components/baseball/MLBKBOFolderTab.tsx` | 82 | `backdrop-blur` | none | Tab bar MLB sticky top |
| `src/components/bet-manager/bet-manager-nav.tsx` | 37 | `backdrop-blur-md` | md | Nav bet-manager sticky top |
| `src/components/layout/mobile-bottom-nav.tsx` | 38 | `backdrop-blur-md` | md | Bottom nav mobile (fixed) |
| `src/components/football/football-live-card.tsx` | 595 | `backdrop-blur-md` | md | Sticky bottom bar score live |
| `src/components/mobile/mixed-scroll.tsx` | 71 | `backdrop-blur-sm` | sm | Sticky scroll header |
| `src/components/athlete-header/athlete-header.tsx` | 107 | `backdrop-blur` | none | Header athlete sticky |

**Pattern**: `bg-bg-deep/90` ou `bg-[#0a0e17]/90` + `backdrop-blur-md` pour les barres sticky.

### 3. Cards (match, player, badges)

| Fichier | Ligne | Classe | Intensité | Contexte |
|---------|-------|--------|-----------|----------|
| `src/components/tennis/match-card.tsx` | 401 | `backdrop-blur-sm` | sm | Card match tennis |
| `src/components/tennis/match-card-broadcast.tsx` | 279 | `backdrop-blur-sm` | sm | Badge broadcast overlay |
| `src/components/tennis/match-card-broadcast.tsx` | 381 | `backdrop-blur-sm` | sm | Badge round overlay |
| `src/components/baseball/BaseballMatchCard.tsx` | 105 | `backdrop-blur-sm` | sm | Badge ligue overlay |
| `src/components/baseball/BaseballMatchCard.tsx` | 110 | `backdrop-blur-sm` | sm | Badge score overlay |
| `src/components/athlete-header/athlete-card.tsx` | 238 | `backdrop-blur-sm` | sm | Badge rank overlay |

**Pattern**: Badges avec `bg-black/40` ou `bg-white/10` + `backdrop-blur-sm`.

### 4. Table (sticky columns)

| Fichier | Ligne | Classe | Intensité | Contexte |
|---------|-------|--------|-----------|----------|
| `src/components/tennis/stats-leaderboard.tsx` | 309 | `backdrop-blur` | none | TableHead sticky left |
| `src/components/tennis/stats-leaderboard.tsx` | 384 | `backdrop-blur` | none | TableCell sticky left |

**Pattern**: `bg-card/95` + `backdrop-blur` pour colonnes sticky du tableau.

### 5. Sidebar

| Fichier | Ligne | Classe | Intensité | Contexte |
|---------|-------|--------|-----------|----------|
| `src/components/layout/sports-sidebar.tsx` | 1590 | `backdrop-blur-xl` | xl | Panneau sidebar latéral |

**Pattern**: `bg-[#0e121e]/95` + `backdrop-blur-xl`. Seul usage xl dans le layout.

### 6. Banners / Footers

| Fichier | Ligne | Classe | Intensité | Contexte |
|---------|-------|--------|-----------|----------|
| `src/components/consent-banner.tsx` | 28 | `backdrop-blur-md` | md | Banner consent cookies |
| `src/components/shared/responsible-gambling-banner.tsx` | 40 | `backdrop-blur-md` | md | Footer banner gambling |

**Pattern**: `bg-card/95` ou `bg-[#0a0e17]/90` + `backdrop-blur-md`.

### 7. Widgets / Popovers (flottants)

| Fichier | Ligne | Classe | Intensité | Contexte |
|---------|-------|--------|-----------|----------|
| `src/components/feedback-widget.tsx` | 84 | `backdrop-blur-md` | md | Widget feedback flottant |
| `src/components/ab-test-debug.tsx` | 118 | `backdrop-blur-md` | md | Bouton debug flottant |
| `src/components/ab-test-debug.tsx` | 149 | `backdrop-blur-md` | md | Panneau debug popover |

**Pattern**: `bg-card` ou `bg-popover/95` + `backdrop-blur-md`.

### 8. Chart Containers

| Fichier | Ligne | Classe | Intensité | Contexte |
|---------|-------|--------|-----------|----------|
| `src/components/bankroll/value-bet-timeline.tsx` | 223 | `backdrop-blur` | none | Conteneur graphique timeline |
| `src/components/bankroll/bankroll-heatmap.tsx` | 183 | `backdrop-blur` | none | Conteneur graphique heatmap |

**Pattern**: `bg-card/80` + `backdrop-blur` pour conteneurs de données.

---

## Dépendance CSS globals — Glass System

### Tokens (variables CSS)

| Variable | Valeur | Ligne |
|----------|--------|-------|
| `--glass-bg` | `rgba(15, 23, 42, 0.55)` | 115, 180 |
| `--glass-bg-strong` | `rgba(11, 18, 32, 0.78)` | 116, 181 |
| `--glass-border` | `rgba(255, 255, 255, 0.08)` | 117, 182 |
| `--glass-liquid-bg` | `rgba(255, 255, 255, 0.04)` | 599 |
| `--glass-liquid-border` | `rgba(255, 255, 255, 0.08)` | 600 |
| `--glass-liquid-shadow` | `0 8px 32px rgba(0,0,0,0.12), inset 1px 0 ...` | 601 |
| `--glass-liquid-blur` | `blur(40px) saturate(1.5)` | 602 |

### Classes CSS définies

| Classe | Blur | Background | Border | Ligne |
|--------|------|------------|--------|-------|
| `.glass-sm` | `blur(6px)` | `color-mix(oklch, --glass-bg 70%, transparent)` | `--glass-border` | 410 |
| `.glass-md` | `blur(12px)` | `--glass-bg` | `--glass-border` | 418 |
| `.glass-heavy` | `blur(20px)` | `--glass-bg-strong` | `--glass-border` | 424 |
| `.glass-liquid` | `blur(40px) sat(1.5)` | `--glass-liquid-bg` | `--glass-liquid-border` | 606 |
| `.glass-liquid-elevated` | `blur(60px) sat(1.8)` | `rgba(255,255,255,0.06)` | `rgba(255,255,255,0.10)` | 613 |

---

## Constats & Surprises

### 1. Système glass CSS non utilisé (CRITIQUE)
Les classes `.glass-sm/md/heavy/liquid/elevated` sont définies dans `globals.css` mais **aucun composant ne les référence**. Tous les composants utilisent des classes Tailwind inline. Cela crée une duplication potentielle et un point de vérité split.

### 2. Intensités incohérentes
- Modals: `sm` vs `md` (certains modals utilisent `sm`, d'autres `md`)
- Sticky bars: `md` majoritaire mais `none` pour MLBKBOFolderTab et athlete-header
- Sidebar: `xl` (seul usage)
- Le même composant (`search-modal`) utilise `md` alors que d'autres modals similaires utilisent `sm`

### 3. Patterns de background incohérents
- Modals: `bg-black/60` ou `bg-black/70`
- Sticky bars: `bg-bg-deep/90`, `bg-[#0a0e17]/90`, `bg-[#0b0e14]/95`
- Cards: `bg-black/40`, `bg-white/10`
- Le token `--bg-deep` (`#0a0e17`) est partiellement utilisé

### 4. Tailwind blur scale utilisée
- `backdrop-blur` (none — blur par défaut Tailwind)
- `backdrop-blur-sm` — 4px
- `backdrop-blur-md` — 12px
- `backdrop-blur-xl` — 24px
- `backdrop-blur-[2px]` — custom (command-palette)

### 5. Hors scope — sous-projets
14 occurrences dans `.freellmapi/` et `tools/skyvern/` — sous-projets externes non modifiables. Ces usages ne doivent pas être impactés par la refonte Liquid Glass.

---

## Recommandations pour Task 2+

1. **Unifier les intensités**: Définir une charte claire — `sm` pour overlays légers, `md` pour barres, `xl` pour panneaux.
2. **Migrer vers les classes CSS glass**: Remplacer les `backdrop-blur-*` Tailwind par les classes `.glass-sm/md/heavy/liquid` existantes dans `globals.css`.
3. **Centraliser les backgrounds**: Utiliser les tokens `--glass-bg` / `--glass-bg-strong` au lieu de `bg-black/60` hardcodé.
4. **Garder le scope**: Ne toucher que aux 34 occurrences dans `src/`. Les 14 hors scope sont hors périmètre.
