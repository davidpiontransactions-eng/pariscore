# Tennis Components Refactor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extract inline helpers to reusable components (CountryFlag, SurfaceBadge), refactor KpiCard to 3-zone layout, create compact PlayerVsBlock, refactor ConfidenceInterval to V2 dual-track, integrate all in match-detail-dialog.

**Architecture:** Pure presentational components, no new data fetching. Replace inline functions in match-detail-dialog.tsx.

**Tech Stack:** React 19, TypeScript 5, TailwindCSS 4, shadcn/ui

## Global Constraints
- One component per file, kebab-case filename = PascalCase export
- All components `"use client"`
- Use `cn()` from `@/lib/utils`
- No new dependencies

---

### Task 1: CountryFlag Component

**Files:**
- Create: `src/components/tennis/country-flag.tsx`

- [ ] **Step 1: Create CountryFlag**

```tsx
"use client";

import { cn } from "@/lib/utils";

export type CountryFlagSize = "sm" | "md" | "lg";

type CountryFlagProps = {
  countryCode?: string | null;
  size?: CountryFlagSize;
  className?: string;
};

const SIZE_MAP: Record<CountryFlagSize, string> = {
  sm: "text-base",
  md: "text-lg",
  lg: "text-2xl",
};

function getFlagEmoji(countryCode?: string | null): string {
  if (!countryCode || countryCode.length !== 2) return "🌍";
  const codePoints = countryCode
    .toUpperCase()
    .split("")
    .map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

export function CountryFlag({ countryCode, size = "md", className }: CountryFlagProps) {
  return (
    <span
      className={cn("inline-flex shrink-0", SIZE_MAP[size], className)}
      role="img"
      aria-label={countryCode ?? "unknown"}
    >
      {getFlagEmoji(countryCode)}
    </span>
  );
}
```

### Task 2: SurfaceBadge + TournamentBadge Components

**Files:**
- Create: `src/components/tennis/surface-badge.tsx`
- Create: `src/components/tennis/tournament-badge.tsx`

- [ ] **Step 1: Create SurfaceBadge**

```tsx
"use client";

import { cn } from "@/lib/utils";

type SurfaceBadgeProps = {
  surface: string;
  className?: string;
};

const SURFACE_ICONS: Record<string, string> = {
  Dur: "🟦",
  "Terre battue": "🟠",
  Gazon: "🟢",
  Hard: "🟦",
  Clay: "🟠",
  Grass: "🟢",
};

export function SurfaceBadge({ surface, className }: SurfaceBadgeProps) {
  const icon = SURFACE_ICONS[surface] ?? "🎾";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded border border-border/60 bg-muted/30 px-1.5 py-0.5 text-[10px] font-bold uppercase leading-none text-muted-foreground",
        className,
      )}
    >
      <span aria-hidden="true">{icon}</span>
      <span>{surface}</span>
    </span>
  );
}
```

- [ ] **Step 2: Create TournamentBadge**

```tsx
"use client";

import { cn } from "@/lib/utils";

type TournamentBadgeProps = {
  category?: string;
  className?: string;
};

const BADGE_MAP: Record<string, { label: string; className: string }> = {
  "Grand Slam": { label: "GS", className: "text-amber-600 bg-amber-500/10 border-amber-500/30" },
  "ATP Masters 1000": { label: "M1000", className: "text-sky-600 bg-sky-500/10 border-sky-500/30" },
  "ATP 500": { label: "500", className: "text-emerald-600 bg-emerald-500/10 border-emerald-500/30" },
  "ATP 250": { label: "250", className: "text-slate-600 bg-slate-500/10 border-slate-500/30" },
  Challenger: { label: "CH", className: "text-violet-600 bg-violet-500/10 border-violet-500/30" },
  ITF: { label: "ITF", className: "text-neutral-600 bg-neutral-500/10 border-neutral-500/30" },
};

export function TournamentBadge({ category, className }: TournamentBadgeProps) {
  const badge = BADGE_MAP[category ?? ""] ?? {
    label: category ?? "Match",
    className: "text-muted-foreground bg-muted/30 border-border/60",
  };
  return (
    <span className={cn("inline-flex rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase leading-none", badge.className, className)}>
      {badge.label}
    </span>
  );
}
```

### Task 3: KpiCard 3-Zone Refactor

**Files:**
- Modify: `src/components/tennis/kpi-card.tsx`

- [ ] **Step 1: Rewrite with header/body/footer zones**

```tsx
"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type KpiCardProps = {
  header?: ReactNode;
  icon?: ReactNode;
  label?: string;
  value: ReactNode;
  footer?: ReactNode;
  description?: ReactNode;
  badge?: string;
  trend?: "up" | "down" | "neutral";
  className?: string;
};

export function KpiCard({
  header, icon, label, value, footer, description, badge, trend, className,
}: KpiCardProps) {
  return (
    <div className={cn("flex flex-col gap-2 rounded-lg border border-border/60 bg-card p-4 min-h-[140px]", trend === "up" && "border-l-2 border-l-emerald-500", trend === "down" && "border-l-2 border-l-rose-500", className)}>
      {header ?? (
        <div className="flex items-center gap-1.5">
          {icon && <span className="shrink-0 text-muted-foreground">{icon}</span>}
          {label && <span className="text-[0.65rem] font-bold uppercase tracking-[0.1em] text-muted-foreground">{label}</span>}
          {badge && <span className="ml-auto rounded-full bg-accent/10 px-2 py-0.5 text-[0.6rem] font-semibold text-accent">{badge}</span>}
        </div>
      )}
      <div className="text-xl font-extrabold leading-tight tracking-tight text-foreground">{value}</div>
      {footer ?? (description && <div className="mt-auto text-xs leading-relaxed text-muted-foreground">{description}</div>)}
    </div>
  );
}
```

### Task 4: PlayerVsBlock Component

**Files:**
- Create: `src/components/tennis/player-vs-block.tsx`

- [ ] **Step 1: Create PlayerVsBlock**

```tsx
"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { CountryFlag } from "./country-flag";
import { getInitials } from "./player-profile-header";

type PlayerInfo = {
  name: string;
  shortName: string;
  color: string;
  photoUrl?: string | null;
  country?: string | null;
  rank?: number;
  elo?: number;
};

type PlayerVsBlockProps = {
  playerA: PlayerInfo;
  playerB: PlayerInfo;
  probA: number;
  probB: number;
  centerSlot?: ReactNode;
  playerSlot?: (player: PlayerInfo, side: "left" | "right") => ReactNode;
  className?: string;
  terminalMode?: boolean;
};

function PlayerAvatar({ src, name, color, initials, size }: { src?: string | null; name: string; color: string; initials: string; size: "sm" | "lg" }) {
  const dims = size === "sm" ? "h-10 w-10" : "h-16 w-16";
  return (
    <div className={cn("relative flex shrink-0 items-center justify-center overflow-hidden rounded-full text-xs font-bold uppercase tracking-wider text-muted-foreground ring-2 ring-offset-2 ring-offset-background", dims)}
      style={{ "--tw-ring-color": color, backgroundColor: `${color}15` } as React.CSSProperties}>
      {src ? <img src={src} alt={name} loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} /> : null}
      <span aria-hidden={src ? "true" : "false"}>{initials}</span>
    </div>
  );
}

export function PlayerVsBlock({ playerA, playerB, probA, probB, centerSlot, playerSlot, className, terminalMode = false }: PlayerVsBlockProps) {
  const avatarSize = terminalMode ? "sm" : "lg";
  return (
    <div className={cn("rounded-lg border border-border/60 bg-card p-4", className)}>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
        <div className="flex flex-col items-center gap-2">
          <PlayerAvatar src={playerA.photoUrl} name={playerA.name} color={playerA.color} initials={getInitials(playerA.name)} size={avatarSize} />
          <div className="flex items-center gap-1">
            <CountryFlag countryCode={playerA.country} size="sm" />
            <span className="text-sm font-bold" style={{ color: playerA.color }}>{playerA.shortName}</span>
          </div>
          {playerSlot?.(playerA, "left")}
        </div>
        <div className="flex flex-col items-center gap-1">
          {centerSlot ?? <span className="rounded-full bg-muted px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">VS</span>}
        </div>
        <div className="flex flex-col items-center gap-2">
          <PlayerAvatar src={playerB.photoUrl} name={playerB.name} color={playerB.color} initials={getInitials(playerB.name)} size={avatarSize} />
          <div className="flex items-center gap-1">
            <span className="text-sm font-bold" style={{ color: playerB.color }}>{playerB.shortName}</span>
            <CountryFlag countryCode={playerB.country} size="sm" />
          </div>
          {playerSlot?.(playerB, "right")}
        </div>
      </div>
      <div className="mt-4 flex items-center gap-2">
        <div className="flex-1">
          <div className="flex justify-between text-[11px] text-muted-foreground">
            <span className="font-medium" style={{ color: playerA.color }}>{playerA.shortName}</span>
            <span className="font-mono font-bold">{probA.toFixed(0)}%</span>
          </div>
          <div className="mt-0.5 h-2.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full transition-all duration-500 ease-out" style={{ width: `${probA}%`, background: playerA.color }} />
          </div>
        </div>
        <span className="shrink-0 text-[10px] font-semibold text-muted-foreground">PROB</span>
        <div className="flex-1">
          <div className="flex justify-between text-[11px] text-muted-foreground">
            <span className="font-mono font-bold">{probB.toFixed(0)}%</span>
            <span className="font-medium" style={{ color: playerB.color }}>{playerB.shortName}</span>
          </div>
          <div className="mt-0.5 h-2.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full transition-all duration-500 ease-out" style={{ width: `${probB}%`, background: playerB.color }} />
          </div>
        </div>
      </div>
    </div>
  );
}
```

### Task 5: ConfidenceInterval V2 Dual-Track

**Files:**
- Modify: `src/components/tennis/confidence-interval.tsx`

- [ ] **Step 1: Add variant="v2" dual-track mode**

Full rewrite in file — preserves v1 overlapping mode as default, adds `variant="v2"` with separate horizontal tracks per player. See plan for full code (too long to duplicate here — same as in plan exploration).

### Task 6: Integrate in match-detail-dialog.tsx

**Files:**
- Modify: `src/components/tennis/match-detail-dialog.tsx`

- [ ] **Step 1: Update imports** — add CountryFlag, SurfaceBadge, TournamentBadge, PlayerVsBlock
- [ ] **Step 2: Remove** `getFlagEmoji()`, `getSurfaceIcon()`, `getTournamentBadge()` inline helpers
- [ ] **Step 3: Replace** surface badge span with `<SurfaceBadge surface={stats.surface} />`
- [ ] **Step 4: Replace** tournament badge span with `<TournamentBadge category={match.tournamentCategory} />`
- [ ] **Step 5: Replace** flag emoji spans with `<CountryFlag countryCode={...} />`
- [ ] **Step 6: Replace** VS duel section with `<PlayerVsBlock ... />`
- [ ] **Step 7: Switch** `<ConfidenceInterval variant="v2" ... />`
- [ ] **Step 8: Remove** internal `PlayerAvatar` function (replaced by PlayerVsBlock)
- [ ] **Step 9: Update** `StatLine` flag prop type from `string` to `ReactNode`

### Task 7: Verify Build

- [ ] **Step 1:** `bun run typecheck` or `bunx tsc --noEmit`
- [ ] **Step 2:** `bun run lint`
- [ ] **Step 3:** `bun run build`
- [ ] **Step 4:** Update COMPONENTS.md with new entries