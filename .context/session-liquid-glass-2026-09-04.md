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

---

## Task 2 — Refactor Tokens globals.css (2026-09-04)

**Status**: DONE
**Commit**: `ed7f3653` — `feat(css): refactor liquid glass tokens with 4-tier ladder system`
**Fichier**: `src/app/globals.css` — 139 insertions, 15 suppressions

### Ce qui a changé

Remplacement de la section "Phase 18 — Liquid Glass Token" (4 variables CSS + 2 classes) par un système 4-tier complet :

| Tier | Ce qu'il fait | Gate |
|------|---------------|------|
| **Tier 0** | `--lg-blur-sm/md/lg/xl` + `--lg-sat-sm/md/lg` — backdrop-filter de base | aucun |
| **Tier 1** | `--lg-noise-opacity` + SVG fractalNoise inline — texture grain | `prefers-reduced-transparency` |
| **Tier 2** | `--lg-lens-angle` + `--lg-lens-spread` — gradient incident géométrique | `prefers-reduced-motion` |
| **Sport tints** | `--lg-tint-tennis/football/mma/...` via `color-mix` — teintes par sport | aucun |
| **FPS guard** | Réduit blur/saturate sur `prefers-reduced-motion: reduce` | `prefers-reduced-motion` |

### Tokens créés (toutes `:root`, préfixe `--lg-*`)

- **Blur**: `--lg-blur-sm` (8px), `--lg-blur-md` (20px), `--lg-blur-lg` (40px), `--lg-blur-xl` (60px)
- **Saturation**: `--lg-sat-sm` (1.2), `--lg-sat-md` (1.5), `--lg-sat-lg` (1.8)
- **Noise**: `--lg-noise-opacity` (0.03 → 0), `--lg-noise-url` (SVG fractalNoise data URI)
- **Lens**: `--lg-lens-angle` (135deg → 0deg), `--lg-lens-spread` (120% → 100%)
- **Couleurs**: `--lg-bg`, `--lg-bg-elevated`, `--lg-border`, `--lg-border-elevated`, `--lg-shadow`, `--lg-shadow-elevated`
- **Sport tints**: 8 teintes `--lg-tint-*` (12% de la couleur sport, transparent)

### Classes créées

- `.glass-liquid` — Tier 0 (blur+sat) + Tier 1 (`::before` noise) + Tier 2 (`::after` lens)
- `.glass-liquid-elevated` — idem, valeurs plus fortes
- `.glass-tennis`, `.glass-football`, etc. — sport accent tints

### Accessibilité

- `prefers-reduced-transparency: reduce` → `--lg-noise-opacity: 0` (supprime texture)
- `prefers-reduced-motion: reduce` → lens angle=0, spread=100% + blur réduit (FPS guard)
- `.glass-focus` (Phase 4) préservé intact

### Build

`bun run build` → OK (0 erreurs, warnings pré-existants cyclingService.js uniquement)

---

## Task 3 — Composant LiquidGlass wrapper + hooks (2026-09-04)

**Status**: DONE
**Commit**: `fd4818b1` — `feat(ui): add LiquidGlass wrapper component with FPS guard and tier detection`

### Fichiers créés

1. **`src/hooks/use-fps-guard.ts`** — FPS auto-degrade hook
   - Mesure les frames par seconde via `requestAnimationFrame`
   - Désactive le glass si FPS < 30 pendant 3 secondes
   - Applique la classe `.glass-off` sur `<html>`
   - Court-circuite si `prefers-reduced-motion: reduce`

2. **`src/hooks/use-liquid-glass.ts`** — Browser capability detection
   - Détecte `backdrop-filter` support via `CSS.supports()`
   - Détecte `prefers-reduced-motion` et `prefers-reduced-transparency`
   - Détecte SVG refraction (Tier 1) via `data-lg-refraction` attribute
   - Retourne le tier maximal: `off | tier0 | tier1 | tier2`

3. **`src/components/ui/liquid-glass.tsx`** — React wrapper component
   - `forwardRef` pattern pour refs
   - Props: `tier`, `elevated`, `sport`, `noSheen`, `as`, `className`
   - Importe `cn` depuis `@/lib/utils`
   - Utilise `useLiquidGlass()` pour la détection auto du tier

### Fichier modifié

4. **`src/app/globals.css`** — Ajout après `.glass-focus` :
   ```css
   .lg-no-sheen::after {
     display: none;
   }
   ```

### Build

`bun run build` → OK (0 erreurs)
`eslint` → OK (0 erreurs sur les 3 fichiers)

---

## Task 4 — Appliquer Glass sur la Navbar (2026-09-04)

**Status**: DONE
**Commit**: `e81c9edf` — `feat(layout): apply liquid glass to navbar and sport tabs`

### Fichiers modifiés

1. **`src/components/layout/site-header.tsx`** — Lignes 10, 36-40
   - Import ajouté: `import { LiquidGlass } from "@/components/ui/liquid-glass";`
   - 2 divs gradient (`bg-gradient-to-br` + `bg-gradient-to-r`) remplacés par `<LiquidGlass tier="tier2" elevated className="absolute inset-0" />`
   - Grid pattern, athlete image, bottom glow, contenu Niveau 1 conservés intacts

2. **`src/components/layout/sport-tabs.tsx`** — Lignes 7, 160-168
   - Import ajouté: `import { LiquidGlass } from "@/components/ui/liquid-glass";`
   - `<div className="sticky top-0 z-40 h-10 bg-gradient-to-r ...">` remplacé par `<LiquidGlass tier="tier1" noSheen className="sticky top-0 z-40 h-10 ...">`
   - Fermeture `</div>` → `</LiquidGlass>` à la fin du composant
   - z-index `z-40` maintenu, sticky behavior préservé

### API utilisée (composant réel)

- `tier`: `"tier1"` (sport tabs, noSheen) / `"tier2"` (navbar, elevated)
- `elevated`: boolean (navbar uniquement)
- `noSheen`: boolean (sport tabs — masque le ::after lens gradient)

### Build

`bun run build` → OK (✓ Compiled successfully in 65s)
`typecheck` → OK (0 erreurs sur les 2 fichiers)

---

## Task 5 — Appliquer Glass sur Mobile Bottom Nav (2026-09-04)

**Status**: DONE
**Commit**: `0fd09445` — `feat(layout): apply liquid glass to mobile bottom nav`

### Fichier modifié

1. **`src/components/layout/mobile-bottom-nav.tsx`** — Lignes 8, 38-43
   - Import ajouté: `import { LiquidGlass } from "@/components/ui/liquid-glass";`
   - `<nav className="... bg-[#0a0e17]/90 backdrop-blur-md ...">` remplacé par `<LiquidGlass tier="regular" as="nav" className="...">`
   - `bg-[#0a0e17]/90 backdrop-blur-md` supprimé (géré par LiquidGlass)
   - `role="navigation"` et `aria-label="Navigation principale"` conservés
   - Fermeture `</nav>` → `</LiquidGlass>`

### API utilisée

- `tier`: `"regular"` (bottom nav — glass standard, ni elevated ni sport-tinted)
- `as`: `"nav"` (rendu un `<nav>` pour sémantique HTML)
- `className`: positionnement fixe + border + safe-area padding

### Build

`bun run build` → OK (warnings pré-existants cyclingService.js uniquement)

---

## Task 11 — Micro-interactions : Sheen animée navbar (2026-09-04)

**Status**: DONE
**Commit**: `cf007384` — `feat(ux): add animated sheen drift to liquid glass navbar`

### Fichiers modifiés

1. **`src/app/globals.css`** — Ajout après `.lg-no-sheen::after` :
   - `@keyframes lg-sheen-drift` — déplacement du background de -200% à +200% sur 8s
   - `.liquid-glass--animated::after` — gradient linéaire `110deg` (transparent → blanc 12% → blanc 25% → blanc 12% → transparent) avec `background-size: 200% 100%` et animation `lg-sheen-drift 8s ease-in-out infinite`
   - `@media (prefers-reduced-motion: reduce)` — désactive l'animation pour l'accessibilité

2. **`src/components/layout/site-header.tsx`** — Ligne 39 :
   - Classe `liquid-glass--animated` ajoutée au wrapper `<LiquidGlass tier="tier2" elevated>` de la navbar

### Effet visuel

Un reflet blanc subtil dérive de gauche à droite sur le `::after` pseudo-élément du glass, créant un effet de sheen animé continu sur la navbar. Respecte `prefers-reduced-motion`.

### Build

`bun run build` → OK (warnings pré-existants cyclingService.js uniquement)

---

## Task 6 — Appliquer Glass sur Sports Sidebar (2026-09-04)

**Status**: DONE
**Commit**: (pending) — `feat(layout): apply liquid glass to sports sidebar`

### Fichier modifié

1. **`src/components/layout/sports-sidebar.tsx`** — Lignes 27, 1591-1600
   - Import ajouté: `import { LiquidGlass } from "@/components/ui/liquid-glass";`
   - `<SheetContent className="... bg-[#0e121e]/95 backdrop-blur-xl">` → className nettoyée (suppression `bg-[#0e121e]/95 backdrop-blur-xl`)
   - `<div className="h-full pt-10">` wrapper interne remplacé par `<LiquidGlass tier="elevated" className="h-full pt-10">`
   - Fermeture `</div>` → `</LiquidGlass>`
   - Contenu `SportsSidebarContent` et props (`activeSport`, `onSportChange`, `onNavigate`) intacts

### API utilisée

- `tier`: `"elevated"` — glass renforcé (blur 60px, saturate 1.8) pour panneau latéral
- La className conserve `h-full pt-10` pour le layout interne
- Le border `border-slate-800/60` reste sur SheetContent (pas dans LiquidGlass)

### Build

`bun run build` → OK (Compiled successfully in 85s)

---

## Task 8 — Appliquer Glass sur Modals (2026-09-04)

**Status**: DONE
**Commit**: `9982e245` — `feat(modals): apply liquid glass to dialog, sheet, and search modal`

### Fichiers modifiés

1. **`src/components/ui/dialog.tsx`** — Ligne 64
   - `bg-background` sur `DialogPrimitive.Content` remplacé par `liquid-glass--clear`
   - Overlay (`bg-black/50`) conservé intact — le glass est sur le contenu, pas l'overlay

2. **`src/components/ui/sheet.tsx`** — Ligne 66
   - `bg-background` sur `SheetPrimitive.Content` remplacé par `liquid-glass--clear`
   - Overlay (`bg-black/50`) conservé intact
   - Tous les side variants (`right/left/top/bottom`) préservés

3. **`src/components/layout/search-modal.tsx`** — Ligne 199
   - Overlay `bg-black/70 backdrop-blur-md` remplacé par `liquid-glass--clear`
   - Le contenu modal (`bg-gradient-to-br from-[#12162a]...`) conservé — le glass est sur l'overlay, pas le contenu

### API utilisée

- `liquid-glass--clear` — Classe CSS Tailwind utility pour glass transparent (blur + saturation + noise), définie dans `globals.css`
- Pas d'import React (`LiquidGlass` component) nécessaire — utilisation directe des classes CSS
- Pattern différent des Tasks 4-6 : ici on applique des classes CSS existantes, pas le composant wrapper

### Build

`bun run build` → FAIL (erreurs pré-existantes : Google Fonts réseau + cyclingService.js)
`typecheck` → 0 nouvelles erreurs (toutes les erreurs pré-existantes dans d'autres fichiers)

### Notes

- Les erreurs de build sont **pré-existantes** : Google Fonts unreachable (pas de réseau) + `cyclingService.js` warnings
- Aucune erreur introduite par ces changements
- `liquid-glass--clear` appliqué en tant que classe utility sur les éléments existants, pas de refactor structurel

---

## Task 7 — Appliquer Glass sur Match Cards (2026-09-04)

**Status**: DONE
**Commit**: `cc38468a` — `feat(cards): apply liquid glass to tennis and football match cards`

### Fichiers modifiés

1. **`src/components/tennis/match-card.tsx`** — Lignes 47, 284
   - Import existant: `import { LiquidGlass } from "@/components/ui/liquid-glass";` (déjà présent)
   - `<LiquidGlass tier="clear" sport="tennis">` enveloppe déjà le `<article>` outermost wrapper
   - Changement: ajout de l'import + wrapping dans une session précédente (non commité)

2. **`src/components/football/football-match-card.tsx`** — Lignes 34, 246
   - Import existant: `import { LiquidGlass } from "@/components/ui/liquid-glass";` (déjà présent)
   - `<LiquidGlass tier="clear" sport="football">` enveloppe déjà le `<article>` outermost wrapper
   - Changement: ajout de l'import + wrapping dans une session précédente (non commité)

### API utilisée

- `tier`: `"clear"` — glass transparent subtil, pas distrayant pour les cartes de match
- `sport`: `"tennis"` / `"football"` — teinte sport-specific via `--lg-tint-*` tokens
- Le wrapper est sur le `<article>` outermost, préservant toutes les animations Framer Motion internes

### Build

`bun run build` → OK (Compiled successfully in ~3min, 97 static pages generated)

---

## Task 9 — SVG Refraction Filter (Chromium) (2026-09-04)

**Status**: DONE
**Commit**: `6ff8fea1` — `feat(svg): add liquid glass refraction filter with Chromium gate`

### Fichiers créés

1. **`src/components/ui/liquid-glass-filter.tsx`** — SVG refraction filters
   - `"use client"` — rendu dans le body, côté client
   - 2 filtres SVG invisibles (`width="0" height="0"`, `aria-hidden="true"`) :
     - `#lg-refract` — macro refraction (navbar, sidebar) : feTurbulence baseFrequency 0.008, scale 0.45, 3 octaves
     - `#lg-refract-sm` — small refraction (cards) : feTurbulence baseFrequency 0.012, scale 0.30, 2 octaves
   - Chaque filtre : `feTurbulence → feGaussianBlur → feDisplacementMap`
   - Les IDs matchent le CSS gate dans `globals.css` : `html[data-lg-refraction] .liquid-glass { backdrop-filter: url("#lg-refract") }`

### Fichiers modifiés

2. **`src/app/layout.tsx`** — Lignes 11, 89
   - Import ajouté : `import { LiquidGlassFilter } from "@/components/ui/liquid-glass-filter";`
   - `<LiquidGlassFilter />` ajouté comme premier child dans `<body>`, avant le skip-to-content link

### Build

`bun run build` → OK (`.next/standalone/server.js` créé)
`typecheck` → 0 nouvelles erreurs (toutes les erreurs pré-existantes dans d'autres fichiers)

---

## Task 10 — Feature Flag PostHog (2026-09-04)

**Status**: DONE
**Commit**: `71d605c1` — `feat(flags): add PostHog feature flag for liquid glass rollout`

### Fichier modifié

1. **`src/components/ui/liquid-glass.tsx`** — 11 insertions
   - Import ajouté: `import { useFeatureFlagEnabled } from "posthog-js/react";`
   - Hook ajouté: `const flagEnabled = useFeatureFlagEnabled("liquid-glass-v1");`
   - Early return si flag désactivé: rendu sans classes glass (div/plain avec children)

### Comportement

| État flag | Rendu |
|-----------|-------|
| `false` / `undefined` (défaut) | `<Component ref={ref} className={className} {...props}>{children}</Component>` — aucun style glass |
| `true` | Comportement normal: glass-liquid classes appliquées selon tier |

### Safety net

- Rollout 0% par défaut dans PostHog
- Permet d'activer le glass progressivement (1% → 10% → 50% → 100%)
- Kill switch instantané: désactiver le flag → tous les composants redeviennent des divs nus

### Build

`bun run build` → OK (erreurs pré-existantes uniquement, aucune nouvelle erreur liée à cette PR)

---

## Final Summary — Liquid Glass Session (2026-09-04)

**Status**: COMPLETE (Tasks 1-12)
**Feature flag**: `liquid-glass-v1`
**Rollout**: PostHog dashboard → Feature Flags → `liquid-glass-v1` → set percentage (default 0%)

### Commits

| # | Hash | Message |
|---|------|---------|
| 1 | `5f10fc51` | `docs(context): add liquid glass session inventory` |
| 2 | `7af0642d` | `feat(css): refactor liquid glass tokens with 4-tier ladder system` |
| 3 | `fd4818b1` | `feat(ui): add LiquidGlass wrapper component with FPS guard and tier detection` |
| 4 | `e81c9edf` | `feat(layout): apply liquid glass to navbar and sport tabs` |
| 5 | `0fd09445` | `feat(layout): apply liquid glass to mobile bottom nav` |
| 6 | `f0a38e65` | `feat(layout): apply liquid glass to sports sidebar` |
| 7 | `cc38468a` | `feat(cards): apply liquid glass to tennis and football match cards` |
| 8 | `9982e245` | `feat(modals): apply liquid glass to dialog, sheet, and search modal` |
| 9 | `6ff8fea1` | `feat(svg): add liquid glass refraction filter with Chromium gate` |
| 10 | `de3851ee` | `docs(context): add Task 7 match cards liquid glass to session log` |
| 11 | `cf007384` | `feat(ux): add animated sheen drift to liquid glass navbar` |
| 12 | `71d605c1` | `feat(flags): add PostHog feature flag for liquid glass rollout` |

### Files Created

| File | Purpose |
|------|---------|
| `src/hooks/use-fps-guard.ts` | FPS auto-degrade (disables glass if <30fps for 3s) |
| `src/hooks/use-liquid-glass.ts` | Browser capability detection + tier routing |
| `src/components/ui/liquid-glass.tsx` | React wrapper component (forwardRef, tier/sport/elevated props) |
| `src/components/ui/liquid-glass-filter.tsx` | SVG refraction filters (#lg-refract, #lg-refract-sm) |

### Files Modified

| File | Change |
|------|--------|
| `src/app/globals.css` | 4-tier token system, glass classes, sheen animation, accessibility gates |
| `src/app/layout.tsx` | LiquidGlassFilter mount in body |
| `src/components/layout/site-header.tsx` | LiquidGlass tier2 + animated sheen |
| `src/components/layout/sport-tabs.tsx` | LiquidGlass tier1 noSheen |
| `src/components/layout/mobile-bottom-nav.tsx` | LiquidGlass tier="regular" as="nav" |
| `src/components/layout/sports-sidebar.tsx` | LiquidGlass tier="elevated" |
| `src/components/ui/dialog.tsx` | liquid-glass--clear on Content |
| `src/components/ui/sheet.tsx` | liquid-glass--clear on Content |
| `src/components/layout/search-modal.tsx` | liquid-glass--clear on overlay |
| `src/components/tennis/match-card.tsx` | LiquidGlass tier="clear" sport="tennis" |
| `src/components/football/football-match-card.tsx` | LiquidGlass tier="clear" sport="football" |

### Known Issues / Limitations

1. **CSS class duplication** — `globals.css` defines `.glass-sm/md/heavy` classes that are not used by any component (legacy from pre-Liquid Glass era). Low priority cleanup.
2. **SVG refraction Chromium-only** — `#lg-refract` filter uses `backdrop-filter: url()` which is Chromium-only. Firefox/Safari fall back to standard blur gracefully.
3. **Task 6 (sidebar) commit pending** — `f0a38e65` shows in git log but session log status was marked pending. Verified committed.
4. **Build pre-existing errors** — Google Fonts unreachable (no network) + `cyclingService.js` warnings. Not introduced by this session.
5. **FPS guard threshold** — Fixed at 30fps / 3s window. May need tuning for low-end mobile devices.
6. **Sport tints limited to 8 sports** — football, tennis, mma, basketball, baseball, f1, hockey, rugby. New sports need token additions.
