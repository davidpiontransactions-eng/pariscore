# Sidebar Redesign — Style 1xBet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refonte complète de la sidebar multi-sports pour atteindre le niveau visuel et fonctionnel de 1xBet — mode réduit, design premium, corrections de bugs, mobile drawer amélioré.

**Architecture:** La sidebar actuelle (`sports-sidebar.tsx`, 1344 lignes) est un composant page-level dans `page.tsx`. La refonte la déplace au layout level, applique les tokens CSS du DESIGN_CHARTER, ajoute un mode réduit (icônes), améliore le visuel (badges colorés, odds stylisées, live indicators), et corrige les bugs connus (favoris vides, tennis 503, compteurs incohérents).

**Tech Stack:** Next.js 16, React 19, Tailwind CSS 4, Zustand, framer-motion, lucide-react

## Global Constraints

- TypeScript strict mode — pas de `any`
- Tokens CSS sidebar: `--sidebar-*` dans `globals.css` (DESIGN_CHARTER)
- Couleurs: dark navy `#0b0e17` fond, vert néon `#00e676` accent
- Composants: consulter `COMPONENTS.md` avant de référencer un nom
- Pas de nouvelles dépendances sans justification (stdlib-first)
- Tests: `bun run lint` + `bun run typecheck` après chaque phase

---

## Phase 1 : Fondations (Structure + Tokens)

### Task 1.1 : Tokens CSS sidebar

**Files:**
- Modify: `src/app/globals.css`

**Interfaces:**
- Produces: CSS custom properties `--sidebar-surface`, `--sidebar-hover`, `--sidebar-active`, `--sidebar-surface-elevated`, `--sidebar-live-pulse`

- [ ] **Step 1: Add sidebar tokens to globals.css**

```css
/* Sidebar tokens — design 1xBet dark navy */
--sidebar-surface: #0e121e;
--sidebar-surface-elevated: #131722;
--sidebar-hover: rgba(255,255,255,0.04);
--sidebar-active: rgba(0,230,118,0.08);
--sidebar-live-pulse: rgba(255,56,86,0.15);
--sidebar-border: rgba(255,255,255,0.06);
--sidebar-text: #e8eaed;
--sidebar-text-muted: #94a3b8;
--sidebar-accent: #00e676;
```

- [ ] **Step 2: Verify CSS compiles**

Run: `bun run build` (or `bun run dev` and check no CSS errors)

- [ ] **Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "feat(sidebar): add CSS custom properties for sidebar design tokens"
```

### Task 1.2 : Mode réduit (collapsed sidebar)

**Files:**
- Modify: `src/stores/use-sports-sidebar-store.ts`
- Modify: `src/components/layout/sports-sidebar.tsx`

**Interfaces:**
- Consumes: existing store shape
- Produces: `collapsed: boolean` state + `toggleCollapsed()` action in store

- [ ] **Step 1: Add collapsed state to store**

In `use-sports-sidebar-store.ts`, add to the interface and defaults:
```ts
collapsed: boolean;
toggleCollapsed: () => void;
```
Default: `collapsed: false`
Action: `toggleCollapsed: () => set((s) => ({ collapsed: !s.collapsed }))`

- [ ] **Step 2: Add collapse toggle button in sidebar header**

In `sports-sidebar.tsx`, in the header section, add a `PanelLeftClose`/`PanelLeftOpen` toggle button.

- [ ] **Step 3: Wrap sidebar content with conditional rendering**

```tsx
const collapsed = useSportsSidebarStore((s) => s.collapsed);

// In SportsSidebar:
<aside className={cn(
  "sticky top-14 hidden h-[calc(100vh-3.5rem)] shrink-0 border-r border-slate-800 lg:block transition-all duration-300",
  collapsed ? "w-16" : "w-64 xl:w-72"
)}>
  {collapsed ? <CollapsedSidebar /> : <SportsSidebarContent ... />}
</aside>
```

- [ ] **Step 4: Create CollapsedSidebar component**

A minimal version showing only sport icons + live count badges, with tooltip on hover.

- [ ] **Step 5: Verify lint + typecheck**

Run: `bun run lint && bun run typecheck`

- [ ] **Step 6: Commit**

```bash
git add src/stores/use-sports-sidebar-store.ts src/components/layout/sports-sidebar.tsx
git commit -m "feat(sidebar): add collapsed mode with sport icons only"
```

### Task 1.3 : Supprimer dead code sidebar shadcn

**Files:**
- Delete: `src/components/ui/sidebar.tsx` (827 lignes jamais importées)

- [ ] **Step 1: Verify no imports reference sidebar.tsx**

Run: `grep -r "from.*components/ui/sidebar" src/`
Expected: 0 results

- [ ] **Step 2: Delete the file**

- [ ] **Step 3: Verify build passes**

Run: `bun run build`

- [ ] **Step 4: Commit**

```bash
git add -u src/components/ui/sidebar.tsx
git commit -m "chore(sidebar): remove unused shadcn sidebar primitives (827 lines dead code)"
```

---

## Phase 2 : Visuel & Graphique (Style 1xBet)

### Task 2.1 : Header sidebar premium

**Files:**
- Modify: `src/components/layout/sports-sidebar.tsx` (SportsSidebarContent header section)

**Interfaces:**
- Consumes: `activeSport`, `liveMatchList`
- Produces: Redesigned header with gradient background, logo, live global counter

- [ ] **Step 1: Redesign header section**

Replace current header with:
- Gradient background: `bg-gradient-to-b from-[#0e121e] to-transparent`
- Logo "PariScore" with accent color
- Live counter badge (always visible when live > 0, pulsing red dot)
- Collapse toggle button

- [ ] **Step 2: Add global live counter**

Always show the live match count as a prominent badge in the header, not hidden behind conditions.

- [ ] **Step 3: Verify visual on desktop**

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/sports-sidebar.tsx
git commit -m "feat(sidebar): redesign header with gradient and live counter"
```

### Task 2.2 : Sport icons avec fond coloré

**Files:**
- Modify: `src/components/layout/sports-sidebar.tsx` (SportBlock component)

**Interfaces:**
- Consumes: `sport.icon`, `sport.liveMatches`
- Produces: Colored circle badges for each sport icon

- [ ] **Step 1: Add color map for sport badges**

```ts
const SPORT_COLORS: Record<string, { bg: string; text: string }> = {
  football: { bg: "bg-emerald-500/15", text: "text-emerald-400" },
  tennis: { bg: "bg-blue-500/15", text: "text-blue-400" },
  basketball: { bg: "bg-orange-500/15", text: "text-orange-400" },
  mma: { bg: "bg-amber-500/15", text: "text-amber-400" },
  cs2: { bg: "bg-purple-500/15", text: "text-purple-400" },
  cycling: { bg: "bg-cyan-500/15", text: "text-cyan-400" },
  f1: { bg: "bg-red-500/15", text: "text-red-400" },
  baseball: { bg: "bg-yellow-500/15", text: "text-yellow-400" },
  rugby: { bg: "bg-teal-500/15", text: "text-teal-400" },
};
```

- [ ] **Step 2: Apply colored badge to SportBlock icon**

Replace bare `<Icon>` with `<span className={cn("rounded-full p-1.5", colors.bg)}><Icon className={cn("h-4 w-4", colors.text)} /></span>`

- [ ] **Step 3: Verify all sports display correct colors**

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/sports-sidebar.tsx
git commit -m "feat(sidebar): add colored circle badges for sport icons"
```

### Task 2.3 : Odds cells stylisées

**Files:**
- Modify: `src/components/layout/sports-sidebar.tsx` (MatchRow component)

**Interfaces:**
- Consumes: `match.odds` or `match.prob`
- Produces: Styled odds cells with rounded backgrounds and hover effects

- [ ] **Step 1: Redesign odds cells in MatchRow**

Replace plain text odds with styled cells:
```tsx
<button className={cn(
  "rounded-md bg-slate-800/60 border border-slate-700/40 px-1.5 py-0.5",
  "font-mono text-[11px] tabular-nums transition-all duration-150",
  "hover:bg-emerald-500/20 hover:border-emerald-500/40 hover:text-emerald-300",
  isBest && "border-emerald-500/30 text-emerald-400"
)}>
  {value}
</button>
```

- [ ] **Step 2: Add "best odds" highlight (lowest value gets green border)**

- [ ] **Step 3: Verify visual**

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/sports-sidebar.tsx
git commit -m "feat(sidebar): style odds cells with rounded borders and hover effects"
```

### Task 2.4 : Live counter badges pulsants

**Files:**
- Modify: `src/components/layout/sports-sidebar.tsx` (SportBlock, CountryBlock, LeagueRow)

**Interfaces:**
- Consumes: `sport.liveMatches`, `league.matchCount`
- Produces: Pulsing red badges for live counts

- [ ] **Step 1: Update CountBadge component**

Add pulsing animation for live counts:
```tsx
function CountBadge({ n, live }: { n: number; live?: boolean }) {
  return (
    <span className={cn(
      "rounded-full px-1.5 py-0.5 font-mono text-[11px] leading-none tabular-nums",
      live ? "bg-red-500/20 text-red-300 animate-pulse" : "bg-slate-800/80 text-white/60"
    )}>
      {n}
    </span>
  );
}
```

- [ ] **Step 2: Apply live prop correctly in SportBlock and CountryBlock**

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/sports-sidebar.tsx
git commit -m "feat(sidebar): add pulsing red badges for live match counts"
```

### Task 2.5 : Hover states premium

**Files:**
- Modify: `src/components/layout/sports-sidebar.tsx` (CountryBlock, LeagueRow, MatchRow)

**Interfaces:**
- Produces: Left border accent + gradient hover background

- [ ] **Step 1: Update hover classes**

Replace `hover:bg-slate-800/80` with:
```tsx
hover:bg-gradient-to-r hover:from-white/[0.03] hover:to-transparent
hover:border-l-2 hover:border-l-emerald-400/60
```

- [ ] **Step 2: Add transition for smooth animation**

Ensure `transition-all duration-150` on interactive rows.

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/sports-sidebar.tsx
git commit -m "feat(sidebar): premium hover states with gradient and left border accent"
```

---

## Phase 3 : Fonctionnel (Parité 1xBet)

### Task 3.1 : Fix Favoris toujours visibles (BUG-2)

**Files:**
- Modify: `src/components/layout/sports-sidebar.tsx` (FavoritesBlock)

**Interfaces:**
- Consumes: `DEFAULT_FAVORITE_LEAGUES`, tree data
- Produces: Favorites block always visible with static fallback

- [ ] **Step 1: Ensure FavoritesBlock returns non-null even when tree is empty**

Current code already handles this (the BUG-2 fix was applied). Verify the fix is in place.

- [ ] **Step 2: Verify with degraded tree (mock empty tennis)**

- [ ] **Step 3: Commit** (if any changes needed)

### Task 3.2 : Indicateur de statut API (dégradé)

**Files:**
- Modify: `src/components/layout/sports-sidebar.tsx` (SportBlock)

**Interfaces:**
- Consumes: `sport.degraded`, `sport.totalMatches`
- Produces: Visual indicator when API is down

- [ ] **Step 1: Already partially implemented (degraded badge)**

Verify the existing "indispo" badge works correctly and is styled prominently.

- [ ] **Step 2: Add tooltip explaining data unavailability**

- [ ] **Step 3: Commit** (if any changes needed)

### Task 3.3 : Scroll to active league

**Files:**
- Modify: `src/components/layout/sports-sidebar.tsx`

**Interfaces:**
- Consumes: `selectedLeagueId`
- Produces: Auto-scroll to selected league in the tree

- [ ] **Step 1: Add ref to active league element**

```tsx
const activeRef = useRef<HTMLDivElement>(null);
useEffect(() => {
  if (activeRef.current) {
    activeRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
}, [selectedLeagueId]);
```

- [ ] **Step 2: Attach ref to LeagueRow when selected**

- [ ] **Step 3: Verify scroll behavior**

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/sports-sidebar.tsx
git commit -m "feat(sidebar): auto-scroll to active league in tree"
```

---

## Phase 4 : Mobile (Drawer 1xBet)

### Task 4.1 : Drawer premium backdrop

**Files:**
- Modify: `src/components/layout/sports-sidebar.tsx` (SportsSidebarDrawer)

**Interfaces:**
- Consumes: existing Sheet component
- Produces: Enhanced drawer with backdrop blur

- [ ] **Step 1: Add backdrop blur to Sheet**

```tsx
<SheetContent
  side="left"
  className="w-[19rem] max-w-[85vw] border-slate-800 bg-[#0e121e]/95 backdrop-blur-xl p-0"
>
```

- [ ] **Step 2: Verify mobile drawer animation**

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/sports-sidebar.tsx
git commit -m "feat(sidebar): premium mobile drawer with backdrop blur"
```

### Task 4.2 : Bottom nav badges live

**Files:**
- Modify: `src/components/layout/mobile-bottom-nav.tsx`

**Interfaces:**
- Consumes: live match count
- Produces: Badge on Live tab showing count

- [ ] **Step 1: Add live count badge to Live tab**

```tsx
// In the Live tab button
<span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-[9px] font-bold text-white flex items-center justify-center">
  {liveCount}
</span>
```

- [ ] **Step 2: Verify badge visibility**

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/mobile-bottom-nav.tsx
git commit -m "feat(sidebar): add live count badge to mobile bottom nav"
```

---

## Phase 5 : Nettoyage & Quality Gate

### Task 5.1 : Final lint + typecheck

- [ ] **Step 1: Run full lint**
Run: `bun run lint`

- [ ] **Step 2: Run full typecheck**
Run: `bun run typecheck`

- [ ] **Step 3: Fix any issues found**

- [ ] **Step 4: Final commit if needed**

### Task 5.2 : Visual QA

- [ ] **Step 1: Start dev server**
Run: `bun run dev`

- [ ] **Step 2: Verify desktop sidebar at 1440px**

- [ ] **Step 3: Verify mobile drawer at 390px**

- [ ] **Step 4: Verify collapsed mode**

- [ ] **Step 5: Document any remaining issues**

---

## Traceability Log

| Date | Phase | Task | Status | Notes |
|------|-------|------|--------|-------|
| 2026-09-02 | 1.1 | Tokens CSS | ✅ done | 9 tokens ajoutés (surface, hover, active, live-pulse, etc.) |
| 2026-09-02 | 1.2 | Mode réduit | ✅ done | collapsed state + CollapsedSidebar + toggle button |
| 2026-09-02 | 1.3 | Dead code cleanup | ✅ done | sidebar.tsx (827 lignes) supprimé |
| 2026-09-02 | 2.1 | Header premium | ✅ done | Gradient bg, logo PariScore, live counter badge |
| 2026-09-02 | 2.2 | Sport icon badges | ✅ done | SPORT_COLORS map, badges circulaires colorés |
| 2026-09-02 | 2.3 | Odds cells | ✅ done | Rounded borders, best-odds highlight, hover effects |
| 2026-09-02 | 2.4 | Live badges | ✅ done | Pulsing red badges déjà en place via CountBadge |
| 2026-09-02 | 2.5 | Hover states | ✅ done | Gradient hover + border-left accent sur tree items |
| 206-09-02 | 3.1 | Fix favoris | ✅ done | Déjà corrigé (fallback synthétique, BUG-2 fix) |
| 2026-09-02 | 3.2 | API status | ✅ done | Badge "indispo" déjà en place (degraded state) |
| 2026-09-02 | 3.3 | Scroll to active | ✅ done | data-league-id + scrollIntoView effect |
| 2026-09-02 | 4.1 | Drawer premium | ✅ done | backdrop-blur-xl + bg opacity 95% |
| 2026-09-02 | 4.2 | Bottom nav badges | ✅ done | Count badge rouge sur onglet Live |
| 2026-09-02 | 5.1 | Lint + typecheck | ✅ done | 0 erreurs sur fichiers modifiés |
| 2026-09-02 | 5.2 | Visual QA | 🔄 pending | À vérifier en dev server |
