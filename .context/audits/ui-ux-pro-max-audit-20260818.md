# Audit UI/UX PariScore — ui-ux-pro-max + impeccable

**Date** : 2026-08-18 · **Skills utilisés** : `ui-ux-pro-max` (design intelligence, 79 styles / 192 palettes / 74 typographies / 25 charts / 22 stacks) + `impeccable` (59 règles de détection déterministes, exécutées sans LLM sur `src/app` + `src/components`).

## 1. Résumé exécutif

- **12 anti-patterns déterministes** détectés par `impeccable detect` (dont 2 motifs "AI slop" — gradients violet, qui trahissent une UI générée par IA).
- **Points forts confirmés** : dark theme navy cohérent (`#0a0e17`), tokens métier bien organisés, focus-visible systématique (~91 occurrences), sparklines SVG accessibles (`role="img"`), tabular-nums, breakpoints responsive, PWA (manifest + SW).
- **Axes majeurs** : (1) éliminer les textes gris sur fond coloré, (2) choisir une police display "sport" au lieu de Geist uniquement, (3) règles motion (reduced-motion absent du code), (4) annonces live contextuelles ARIA, (5) systématiser Suspense/streaming côté Next.js.
- **Innovations proposées** : typographie de score type "scoreboard", delta d'odds animés, heatmap drill-down, MotionConfig global, tag de cache CDN, palette daltonisme-safe.

## 2. État de l'existant (contexte collecté)

| Axe | État actuel |
|---|---|
| **Tokens** | Tailwind v4 CSS-first (`@theme inline`). Dark : `--background: oklch(0.145 0 0)`, `--card: oklch(0.205 0 0)`, `--primary: oklch(0.922 0 0)`. Métier (hex, commun light/dark) : `--bg-deep: #0a0e17`, `--surface-dark: #0F0F1A`, `--surface-card: #1A1A2E`, accents par sport, confidence high/mid/low (feu tricolore), `--ai-insight: #A855F7` (violet), `--edge-positive: #10B981`. |
| **Theme** | dark forcé par défaut (next-themes), toggle light/dark dispo. |
| **Fonts** | Geist + Geist Mono (next/font), lucide-react. |
| **Charts** | Recharts v2.15.4 (wrapper shadcn `ui/chart.tsx`), radar (stats tennis), courbes (odds, ELO), sparklines SVG custom. |
| **Animations** | framer-motion v12 (~16 fichiers), AnimatePresence, tw-animate-css. **Aucun `prefers-reduced-motion`.** |
| **Accessibilité** | focus-visible partout, aria-labels FR, `role="status"` par endroits. Audit précédent (2026-06-18, 6.8/10) : skeletons, focus, daltonisme — en partie adressés. |
| **Mobile/PWA** | manifest standalone, SW avec garde anti-reload, bottom-nav 5 tabs safe-area, breakpoints 640/768/1024. |

## 3. Résultats `impeccable detect` — 12 anti-patterns (gravité ↑)

| # | Règle | Fichier:ligne | Problème | Fix |
|---|---|---|---|---|
| 1 | `gray-on-color` | `src/components/baseball/BaseballMatchCard.tsx:200` | `text-slate-200` sur `bg-sky-500` | blanc/near-white ou teinte plus sombre du fond |
| 2 | `gray-on-color` | `src/components/baseball/BaseballMatchCard.tsx:236` | `text-slate-950` sur `bg-amber-400` | idem |
| 3 | `gray-on-color` | `src/components/baseball/MLBKBOFolderTab.tsx:87` | `text-slate-950` sur `bg-amber-400` | idem |
| 4 | `gray-on-color` | `src/components/cycling/cycling-tab-content.tsx:220` | `text-gray-500` sur `bg-amber-500` | idem |
| 5 | `gray-on-color` | `src/components/f1/f1-driver-card.tsx:117` | `text-zinc-500` sur `bg-amber-500` | idem |
| 6 | `ai-color-palette` | `src/components/football/AIMatchReport.tsx:36` | `text-violet-300` (violet = tell d'IA) | remplacer par accent marque (emerald) ou violet intentionnel + documentation |
| 7 | `gray-on-color` | `src/components/layout/sports-sidebar.tsx:217` | `text-slate-400` sur `bg-red-500` | blanc |
| 8 | `gray-on-color` | `src/components/rugby/rugby-tab-content.tsx:140` | `text-slate-500` sur `bg-teal-500` | blanc |
| 9 | `gray-on-color` | `src/components/rugby/rugby-tab-content.tsx:171` | `text-slate-950` sur `bg-teal-500` | idem |
| 10 | `gray-on-color` | `src/components/rugby/rugby-tab-content.tsx:171` | `text-slate-300` sur `bg-teal-500` | idem |
| 11 | `bounce-easing` | `src/components/shared/flashscore-match-list.tsx:450` | `animate-bounce` (easing daté) | ease-out-quart/quint/expo |
| 12 | `ai-color-palette` | `src/components/tennis/press-review-panel.tsx:111` | `from-violet-500` gradient | gradient marque (emerald → cyan) ou suppression |

> Les 6 premiers fichiers sont des **cartes sport** — c'est un pattern récurrent, pas un bug isolé : créer des **variants de badge par sport** (texte blanc sur pastille colorée) dans un composant partagé.

## 4. Recommandations ui-ux-pro-max (moteur de design intelligence)

### 4.1 Design system généré pour PariScore (query : "sports betting odds analytics dark premium")

Le moteur propose **Vibrant & Block-based** (CTAs rouges #DC2626, gros blocs, hover par changement de couleur, sections 48px+). **À adapter** : la palette rouge est générée par défaut pour "sports entertainment" — l'identité emerald existante (`#10B981`/`#00e676`) est la bonne fondation, on garde les recommandations structurelles :
- **Pattern** : Hero-Centric avec **un seul CTA primaire** + nav sticky CTA. La home actuelle a déjà hero + pills scroll-spy — ajouter un CTA explicite (ex. « Voir les value bets »).
- **Anti-patterns du moteur** : "AI purple/pink gradients" (confirmé par impeccable — §3 #6/#12), static content, "poor fan engagement".
- **Checklist pré-livraison** : pas d'emoji icônes (lucide ✓), `cursor-pointer` sur tout cliquable, hover 150-300ms, contraste 4.5:1, focus visible, **prefers-reduced-motion** (❌ absent), responsive 375/768/1024/1440.

### 4.2 Style — Dark Mode (OLED) : confirme et affine l'existant

Le moteur (style `dark-mode-oled`) valide la direction : `#121212` / **Midnight Blue `#0A0E27`** (≈ `--bg-deep: #0a0e17` existant ✓), accents néon (green/blue/gold/purple), **7:1** de contraste texte, glow minimal (`text-shadow: 0 0 10px` avec parcimonie), `color-scheme: dark`. Améliorations concrètes :
- Cibler `#000000` pur sur le fond PWA (économise la batterie OLED sur mobile).
- Glow néon subtil sur les odds en direct (highlight pulsé, pas de bounce).
- Light mode : ne pas dupliquer le dark — définir une vraie palette claire (le moteur marque "not-recommended" le light sur OLED).

### 4.3 Typographie — passer de Geist-only à un système "scoreboard"

3 pairings sportifs du moteur :

| Pairing | Headings | Body | Usage proposé |
|---|---|---|---|
| **Sports/Fitness** | **Barlow Condensed** (700) | **Barlow** | ⭐ recommandé : scores, odds, classements (condensé = densité scoreboard) |
| Bold Statement | Bebas Neue (all-caps) | Source Sans 3 | hero home, titres de sections |
| Gaming Bold | Russo One | Chakra Petch | onglet esports (CS2) uniquement |

Mise en œuvre : `next/font/google` (Barlow Condensed 500-700 + Barlow 400-600), tokens `--font-display` / `--font-body`, `tabular-nums` conservé. Geist reste en fallback système.

### 4.4 Charts — les 3 charts existants sont les bons

- **Radar** (stats tennis) : validé ("Multi-Variable Comparison" — radar OK pour ≤ 8 axes, ≤ 2-3 datasets). ✅ existant.
- **Comparaison odds / classements** : le moteur recommande **Bar chart** (≤ 15 catégories, tri décroissant, labels directs) pour les classements Home/Away — compléter les tables actuelles par une vue bar "GF/GA" interactive.
- **A11y charts** : fallback = table de données + résumé, focus au clavier révèle les valeurs, toggle de séries — implémenter le "keyboard focus reveals values" sur les sparklines custom (SVG `role="img"` actuellement sans interaction).

### 4.5 UX — 3 guidelines à corriger (dont 2 High)

- **Contextual Live Badge Updates (High)** : les badges live/counts async doivent annoncer un **statut contextuel** (`<span role="status" aria-atomic="true">3 value bets détectés</span>`), pas un chiffre nu en `aria-live`. Audit des compteurs du BetSlip + filtres.
- **Loading Indicators (High)** : skeleton **stable** (pas de flicker) + `aria-busy` sur les zones en attente (tables classements SWR CDN déjà squelettées — ajouter `aria-busy`).
- **Lazy Loading (Medium)** : `loading="lazy"` sur images below-fold + lazy-load des sections sous le pli.

### 4.6 Stack Next.js 16 (guidelines du moteur)

- **Streaming** : `Suspense` autour des composants lents (classements ligues, AIInsightCard) au lieu d'attendre toutes les données (`await` bloquant dans les server components).
- **Partial Prerendering** : shell statique + trous dynamiques pour les pages stats ligues (SWR CDN déjà idéal pour ça).
- **Caching** : `cacheTag('league-rankings')` + `revalidateTag` ciblé au lieu d'invalidation large.

## 5. Innovations proposées (différenciation)

| Innovation | Description | Bénéfice | Effort |
|---|---|---|---|
| **Scoreboard typography** | Barlow Condensed pour scores/odds + ticker d'odds avec delta (▲ +0.05 vert, ▼ rouge) animé en fade/slide 200ms | Lisible à distance, feel "live" | S |
| **Odds movement sparkline** | Mini-graphique ligne par match (évolution cote 1X2 sur 24h) dans les cartes matchs — data déjà dispo via odds API | Différenciant vs concurrents statiques | M |
| **Heatmap drill-down** | `value-heatmap.tsx` : clic sur cellule → détails du bet (raison, edge, EV) en dialog, navigation clavier | UX analytique pro | S |
| **MotionConfig global** | `<MotionConfig reducedMotion="user">` dans layout.tsx — une ligne pour honorer `prefers-reduced-motion` sur TOUS les composants framer-motion | A11y immédiate, 0 régression | XS |
| **Live region contextuelle** | `role="status"` + `aria-atomic` sur "Nouveau value bet détecté" au lieu de compteurs muets | A11y (règle High du moteur) | S |
| **Palette daltonisme-safe** | Confidence high/mid/low : ajouter icône/pattern (✓/!/▲) en plus de la couleur (rouge/vert sont confondus en deutéranopie) | A11y, règle du moteur "do not rely on color alone" | S |
| **Sport-tinted surfaces** | `--sport-*` actuels → halos/glows par sport en fond de carte (5% opacity) au lieu de bordures colorées seules | Hiérarchie visuelle par sport sans bruit | S |
| **Dark OLED pur PWA** | `@media (prefers-color-scheme: dark)` + écrans OLED : fond `#000` sur `standalone` | Batterie + contraste sur Android | S |
| **cacheTag classements** | Tag CDN `league-rankings` + purge ciblée au refresh CRON | Fraîcheur + perfs | S |
| **Design tokens docs** | Écrire `DESIGN_CHARTER.md` (couleurs, typo, espacements) — le code vit seul aujourd'hui | Base pour Cline/opencode + futurs devs | S |

## 6. Plan d'action priorisé

**P0 — Corriger les anti-patterns détectés (1 session)**
1. Composant partagé « badge sport » (texte blanc sur pastille) → fixe #1-5, 7-10 d'un coup.
2. `MotionConfig reducedMotion="user"` dans `layout.tsx`.
3. Remplacer `animate-bounce` (`flashscore-match-list.tsx:450`) par ease-out-expo.
4. Remplacer violet IA → emerald marque (`AIMatchReport.tsx:36`, `press-review-panel.tsx:111`) ou assumer via token `--ai-insight` documenté.

**P1 — Fondations (2 sessions)**
5. Typographie scoreboard (Barlow Condensed + Barlow) + tokens `--font-display`.
6. Live regions contextuelles (BetSlip, compteurs) + `aria-busy` skeletons.
7. `loading="lazy"` + Suspense boundaries (AIInsightCard, classements).

**P2 — Innovations (backlog)**
8. Odds movement sparkline · heatmap drill-down · ticker delta odds · halos par sport · `cacheTag` CDN · `DESIGN_CHARTER.md`.

## 7. Méthodologie & outils

- `impeccable detect src/app src/components` → 12 findings (règles déterministes, zéro LLM, exit code 2).
- ui-ux-pro-max : `--design-system` (1 génération), `--domain style/ux/chart/color/typography` (5 recherches), `--stack nextjs` (1 recherche) via `scripts/search.py` (Python stdlib, données locales).
- Les deux skills sont installés pour **opencode** (`.opencode/skills/`) et **cline** (`.cline/skills/` → junction `.claude/skills/`). Pour impeccable : `/impeccable init` en chat pour générer `PRODUCT.md`/`DESIGN.md` du projet.
