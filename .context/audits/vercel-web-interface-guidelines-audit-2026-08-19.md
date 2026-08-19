# Audit Vercel Web Interface Guidelines — PariScore (2026-08-19)

**Source** : skill `web-design-guidelines` (installé le 2026-08-19 — junctions `.agents/tools-active/`, `.claude/skills/`, `.cline/skills/` → `.agents/tools/web-design-guidelines`) — règles fraîches fetchées de `vercel-labs/web-interface-guidelines` (command.md).
**Périmètre** : `src/app`, `src/components` (sweep anti-patterns globaux + revue des surfaces clés : bet-slip, football-live-card, flashscore list, bottom nav, layout).
**En complément** : `.context/design-audit-2026-08-18.md` (4 sources design) — cet audit couvre l'axe « qualité d'interface » (a11y, focus, forms, motion, typo, perf).

## Résumé

**23 règles vérifiées · 8 violations corrigées · 0 erreur restante connue · 1 constat (virtualisation) non bloquant.**

## Violations corrigées (session)

| Fichier:ligne | Règle | Fix |
|---|---|---|
| `src/components/bet-slip.tsx:134` | `transition: all` interdit | `transition-all` → `transition` (propriétés listées par défaut Tailwind) |
| `src/components/football/football-live-card.tsx:211,216,391,394` | idem | `transition-all` → `transition-[width]` (barres de proportion) |
| `src/components/football/football-live-card.tsx:266` | idem | `transition-[border-color]` (carte hover) |
| `src/components/bet-slip.tsx:348` | Inputs : `autocomplete` + `name` + label cliquable | `htmlFor`/`id`/`name` + `autoComplete="off"` sur le champ mise |
| `src/components/shared/flashscore-match-list.tsx:138` | Inputs : `autocomplete` + `name` | `type="search"` + `name="search"` + `autoComplete="off"` |
| `src/components/shared/flashscore-match-list.tsx:142` | `...` → `…` | `placeholder="Rechercher…"` |
| `src/components/layout/mobile-bottom-nav.tsx:26` | Safe areas (notch) | `safe-area-inset-bottom` (classe morte) → `pb-[env(safe-area-inset-bottom)]` |
| `src/components/layout/mobile-bottom-nav.tsx:43` | ARIA natif avant ARIA | `role="tab"` (sans tablist) → `aria-current="page"` |
| `src/app/globals.css` | `color-scheme: dark` (dark mode) | Ajout sur `html` (scrollbars/inputs natifs) |
| `src/app/globals.css` | `touch-action: manipulation` + `-webkit-tap-highlight-color` | Ajout sur `button, a, [role="button"]` |
| `src/app/globals.css` | `overscroll-behavior: contain` (modals/drawers) | Ajout sur `[role="dialog"]`, `[data-radix-dialog-content]`, `[data-radix-sheet-content]` |
| `src/app/globals.css` | `text-wrap: balance`/`pretty` (titres) | `h1-h3 { text-wrap: balance }` + `h4-h6,p { text-wrap: pretty }` |
| `src/app/layout.tsx:170` | Skip link + `<main>` sémantique | `<a href="#main">` sr-only focus-visible + wrapper `<main id="main">` |

## Vérifié conforme (0 finding)

- `outline-none` sans replacement de focus : **0** dans `src/` (tous les boutons ont `focus-visible:ring-*`)
- `autoFocus` non justifié : **0**
- `onPaste` + `preventDefault` : **0**
- `user-scalable=no` / `maximum-scale=1` : **0** (viewport Next `maximumScale: 5`)
- `getBoundingClientRect`/`offsetHeight` en render composants : **0**
- `animate-ping` : **0** (déjà remplacé par `pulse-soft` — session 2026-08-18)
- `transition: all` / `transition-all` : **0** restant dans `src/components`
- `Intl.DateTimeFormat` pour dates (`src/lib/football-time.ts`) ✓ ; `tabular-nums` massivement présent sur les scores ✓
- Boutons icon-only : `aria-label` + `title` présents (bet-slip remove, favoris, stats, feedback widget…)
- Inputs de recherche : `aria-label` présents (tennis-search-bar:97, flashscore:144, AIFilterBuilderDialog:163-205)
- Images : logos/drapeaux avec dimensions explicites ; watermark décoratif `alt=""` + `aria-hidden` + lazy
- `prefers-reduced-motion` : gate globale CSS (`globals.css:323`) + `MotionConfig reducedMotion="user"` (session 2026-08-19) ✓
- Sémantique : `<button>` pour actions, `<a>`/`<Link>` pour navigation (watch-button, cartes) ✓
- Formulaires : erreurs inline (email-toggle `aria-invalid`), submit désactivé pendant la requête (bet-slip `placing`) ✓
- `aria-live`/`aria-atomic` : score football, LiveScoreAnnouncer tennis, BetSlip totaux (session 2026-08-19) ✓

## Constat non bloquant

- **`src/components/shared/flashscore-match-list.tsx`** — listes de matchs par ligue (`~150` lignes max, ligues pliées par défaut) : pas de virtualisation. Sous le seuil guideline (>50 items **visibles** simultanément), mais à virtualiser si on ajoute un mode « toutes ligues dépliées ».

## Validation

- `bun run typecheck` : 0 erreur nouvelle (restantes = pré-existantes : nullabilité `live.*` football, `indicatorClassName` Progress, `require()` routes basketball, `tools/` hors scope)
- `bun run build` : ✓ 82s — CSS compilé contient `color-scheme:dark`, `touch-action:manipulation`, `overscroll-behavior:contain`, `text-wrap:balance`, `safe-area-inset-bottom`, `transition-[width]`