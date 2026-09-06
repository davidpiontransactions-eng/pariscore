# Session: Bento Grid Research + Planning + Implementation (2026-09-04)

## Scope
Recherche web exhaustive → rapport → plan → implémentation complète du Bento Grid layout system pour ParisScore.

## Implementation Completed — 7 Commits

| # | Commit | Description | Files |
|---|--------|-------------|-------|
| 1 | `ae1d3d7e` | feat(ui): BentoGrid + BentoTile components + CSS tokens | `bento-grid.tsx`, `globals.css` |
| 2 | `43f9bed7` | feat(homepage): hero + sections in Bento Grid | `page.tsx` |
| 3 | `007c7019` | feat(homepage): feature cards asymmetric bento tiles | `feature-cards.tsx` |
| 4 | `abf3852a` | feat(dashboard): Bento KPI grid layout | `dashboard/page.tsx` |
| 5 | `bf71df52` | feat(ui): scroll reveal + hover animations | `bento-grid.tsx` |
| 6 | `e31eca84` | feat(football): tab content Bento Grid | `football-tab-content.tsx` |
| 7 | `aacfb56d` | feat(tennis): tab content Bento Grid | `tennis-tab-content.tsx` |
| 8 | `000e1c76` | fix(ui): correct glass-liquid class for bento tiles | `bento-grid.tsx` |

## Quality Gates
- **Lint:** 0 errors (`bun run lint`)
- **TypeCheck:** 0 new errors (`npx tsc --noEmit`)
- **Build:** Pre-existing warnings only (cyclingService.js)
- **Visual QA:** 1 bug found + fixed (`liquid-glass--clear` → `glass-liquid`)
- **Deploy:** VPS OK (`build_ran: 1`, commit `000e1c76`)

## Key Files Modified
- `src/components/ui/bento-grid.tsx` — NEW (BentoGrid + BentoTile + Framer Motion animations)
- `src/app/globals.css` — Bento CSS tokens (--bento-*)
- `src/app/page.tsx` — Homepage Bento Grid layout
- `src/components/dashboard/feature-cards.tsx` — Asymmetric tiles
- `src/app/(protected)/dashboard/page.tsx` — Dashboard Bento KPI grid
- `src/components/football/tennis-tab-content.tsx` — Tennis tab Bento
- `src/components/football/football-tab-content.tsx` — Football tab Bento

## Research Completed

### Sources analysées
- **Academic**: "Finding Patterns in Location of Elements" (Wan, 2024) — graph theory + grid/place cells applied to bento layouts
- **Industry**: studiomeyer.io, alexevans.io, csscreme.com, engineered.at — CSS Grid implementation patterns
- **Apple**: deck.gallery breakdown — tile size = priority encoding, black canvas, numbers-as-typography
- **Competitors**: Sofascore, FotMob, FlashScore, ESPN, Linear, Datadog, Vercel, Notion, Stripe, Figma
- **Sports betting**: Medium dashboards, Power BI dashboards, GRID.gg esports betting
- **UX research**: Nielsen Norman (6s first impression), eye tracking (2.6× longer fixation on larger tiles)

### Key Findings
1. **Bento = hierarchy via geometry** — 2×2 hero tile commands 2.6× longer fixation than 1×1
2. **Sweet spot: 5-9 tiles** per viewport — below = not enough rhythm, above = noise (unless dashboard)
3. **CSS Grid natif** is the foundation — Flexbox for micro-alignment inside tiles only
4. **Responsive 4→2→1 columns** — tablet 2-col with selective spanning
5. **Glassmorphism + bento = strong combo** — black canvas lets each tile be its own design
6. **Conversion data**: 35% longer dwell time, 47% increase in engagement vs uniform grids
7. **When Bento fails**: sequential processes, text-heavy content, simple 2-3 feature propositions

### Competitor Analysis
- **Most live-score apps** (Sofascore, FotMob, FlashScore) still use traditional card grids → **differentiation opportunity**
- **Linear, Datadog, Vercel** use bento for dashboards and feature pages
- **Apple** pioneered the asymmetric tile pattern (2022 iPhone 14 page)
- **Notion** redesigned 2024 home screen with bento layout

## ParisScore Opportunities
1. **Homepage**: Hero (2×2) + feature tiles (2×1) + match sections (2×1) + stats (1×1)
2. **Dashboard**: Primary KPI hero (2×2) + chart (2×1) + feed (1×2) + quick actions (1×1)
3. **Tennis/Football tabs**: Featured match hero (2×2) + tournaments (2×1) + rankings (1×2) + stats (1×1)
4. **Liquid Glass integration**: `liquid-glass--clear` on bento tiles = dark navy + glass aesthetic

## Plan Created
- **File**: `docs/superpowers/plans/2026-09-04-bento-grid-implementation.md`
- **Phases**: 6 (Fondations → Homepage → Dashboard → Sport Pages → Animations → Quality)
- **Tasks**: 14 tasks with step-by-step instructions
- **Gantt**: Mermaid chart with ~15h estimated total effort
- **New files**: 1 (`bento-grid.tsx`)
- **Modified files**: 10 (homepage, dashboard, tennis, football, globals.css)

## Decisions
- **CSS Grid natif** over react-grid-layout (zero new deps)
- **Tailwind utilities** (`col-span-*`, `row-span-*`) for responsive spanning
- **Liquid Glass** as default tile variant (integrated with existing system)
- **Framer Motion** for scroll reveal (already installed)
- **No feature flag** needed — visual-only change, backward compatible

## Validation
- Research complete across 10+ sources
- Plan follows existing format (sidebar-redesign, liquid-glass patterns)
- Engineering loop: Research → Implement → Quality → Trace → Commit
