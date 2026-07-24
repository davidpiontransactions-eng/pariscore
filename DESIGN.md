# DESIGN.md — PariScore

> Visual root file for PariScore. Follows the [design.md format spec].
> Answers **how it looks**. Strategic answers (who/what/why) live in
> [PRODUCT.md](./PRODUCT.md).
>
> [design.md format spec]: https://raw.githubusercontent.com/google-labs-code/design.md/main/docs/spec.md

## Foundation

### Theme model

**Dual-theme, class-based.** `darkMode: "class"` in `tailwind.config.ts`. Dark is
**first-class** (live betting happens at night, on phones) — it is designed, not
an inverted afterthought. Light is the shadcn/ui New York default.

Tokens are defined once as **CSS variables** in `src/app/globals.css` (oklch for
the shadcn semantic set, hex for the fixed sport/surface brand set) and surfaced
to Tailwind via `@theme inline` + `tailwind.config.ts`. Components consume
semantic Tailwind classes (`bg-card`, `text-muted-foreground`), **never raw
color values**.

### Typography

| Role | Family | Notes |
|------|--------|-------|
| Sans (UI, body) | **Geist** (`next/font/google`) | variable, `--font-geist-sans`, `-moz-osx-font-smoothing: grayscale` |
| Mono (numbers, code) | **Geist Mono** (`next/font/google`) | variable, `--font-geist-mono` |

Loaded in `src/app/layout.tsx` via `next/font`. Numeric data (odds, Elo,
probabilities, scores) leans on **tabular-nums** (`tabular-nums` utility) so
columns of figures align and don't jitter as values update live.

Type scale follows Tailwind defaults; dense data screens favor smaller sizes
(`text-xs`/`text-sm`) with `font-semibold`/`font-bold` for emphasis over size.

### Iconography

**lucide-react** — consistent 1.5px stroke, tree-shakeable. Sport glyphs and
logos are raster assets (CDN-resfu / scraped), not icons.

## Color

### Semantic palette (shadcn/ui New York, oklch)

Defined as CSS variables, swapped between `:root` (light) and `.dark`:

| Token | Light | Dark |
|-------|-------|------|
| `--background` | `oklch(1 0 0)` | `oklch(0.145 0 0)` |
| `--foreground` | `oklch(0.145 0 0)` | `oklch(0.985 0 0)` |
| `--card` | `oklch(1 0 0)` | `oklch(0.205 0 0)` |
| `--primary` | `oklch(0.205 0 0)` | `oklch(0.922 0 0)` |
| `--secondary` | `oklch(0.97 0 0)` | `oklch(0.269 0 0)` |
| `--muted` | `oklch(0.97 0 0)` | `oklch(0.269 0 0)` |
| `--muted-foreground` | `oklch(0.556 0 0)` | `oklch(0.708 0 0)` |
| `--accent` | `oklch(0.97 0 0)` | `oklch(0.269 0 0)` |
| `--destructive` | `oklch(0.577 0.245 27.325)` | `oklch(0.704 0.191 22.216)` |
| `--border` | `oklch(0.922 0 0)` | `oklch(1 0 0 / 10%)` |
| `--input` | `oklch(0.922 0 0)` | `oklch(1 0 0 / 15%)` |
| `--ring` | `oklch(0.708 0 0)` | `oklch(0.556 0 0)` |

The set is **achromatic** (zero chroma except `destructive`) on purpose: it keeps
the UI calm and lets the **sport/value colors** (below) carry all meaning.
Refrain from adding chromatic neutrals.

### Brand & sport colors (fixed hex, same in both themes)

These encode **meaning**, so they are theme-invariant:

| Token | Value | Meaning |
|-------|-------|---------|
| `--sport-tennis` | `#10B981` | emerald — tennis |
| `--sport-football` | `#0EA5E9` | sky — football |
| `--sport-mma` | `#EF4444` | red — MMA |
| `--sport-cycling` | `#F59E0B` | amber — cycling |
| `--surface-dark` | `#0F0F1A` | near-black blue — deep background for sport cards (F1/MMA) |
| `--surface-card` | `#1A1A2E` | dark navy — sport card surface |

**Value/confidence convention:** green = value / favorable, red = trap /
unfavorable. Reuse `--destructive` for traps, emerald tones for value. Never use
these colors decoratively.

### Chart palette (recharts, oklch)

5-step categorical palette, distinct between themes for contrast on each
background: `--chart-1..5`. Dark skews more saturated (`0.488 0.243 264.376`
→ blue, `0.696 0.17 162.48` → green, …) to read on `oklch(0.145 0 0)`.

### Radius

`--radius: 0.625rem` (10px), scaled via Tailwind: `lg = --radius`,
`md = --radius - 2px`, `sm = --radius - 4px`. Cards/dialogs use `rounded-lg`
(often `rounded-2xl` on sport-specific cards like F1/MMA). Pill badges use
`rounded-full`.

## Components

**Library: shadcn/ui (New York style) + Radix UI primitives**, 48 components in
`src/components/ui/`. Not a dependency — source is owned and edited in-repo.

- **Surfaces**: `card`, `dialog`, `drawer` (mobile), `sheet`, `popover`,
  `hover-card`, `tooltip`, `alert-dialog`.
- **Inputs**: `button`, `input`, `textarea`, `select`, `checkbox`, `radio-group`,
  `switch`, `slider`, `toggle`, `toggle-group`, `calendar`, `form`,
  `input-otp`, `command` (cmdk), `combobox`-pattern.
- **Data display**: `table`, `badge`, `avatar`, `progress`, `separator`,
  `scroll-area`, `carousel` (embla), `tabs`, `accordion`, `collapsible`,
  `chart` (recharts wrapper).
- **Navigation**: `navigation-menu`, `menubar`, `dropdown-menu`, `context-menu`,
  `breadcrumb`, `pagination`.
- **Feedback**: `sonner` toasts, `alert`.

**Animation**: `framer-motion` for orchestrated motion (page transitions, card
entrance, dialog springs), `tw-animate-css` + `tailwindcss-animate` for utility
transitions. Motion is restrained (see Principles: calm under pressure).

## Layout

- **Mobile-first PWA**. Primary canvas is a phone in portrait; the app is
  installable with Web Push.
- **Card → detail pattern**: dense lists of match cards (glanceable) open into
  dialogs/drawers/tabs for deep analysis. See PRODUCT.md principle 3.
- **App shell**: top/side nav depending on viewport; `navigation-menu` + tabs
  for sport switching.
- **Grids**: responsive auto-grids for match cards; `container` max-widths via
  Tailwind. Data tables use `tanstack/react-table`.
- **Safe areas**: respect mobile notches; PWA display standalone.

## Patterns & motion

- **Entrance**: cards fade + slide-up (`initial={{opacity:0,y:20}}` →
  `animate={{opacity:1,y:0}}`), staggered by `index * 0.04s`.
- **Live state**: a restrained accent pulse on live indicators — **never**
  casino-style flashing. "Live" = subtle motion; "finished" = muted/dimmed.
- **Numbers updating**: tabular-nums + a brief opacity fade, not digit-roll
  animations (keeps the UI legible during rapid live updates).
- **Hover**: borders shift to an accent-tinted color + soft shadow
  (`hover:shadow-[0_0_20px_rgba(0,230,118,0.15)]` on F1 cards, etc.). Use the
  relevant `--sport-*` accent per context.

## Source of truth

- **CSS variables** → `src/app/globals.css` (`:root`, `.dark`, `@theme inline`)
- **Tailwind mapping** → `tailwind.config.ts` (`theme.extend.colors`,
  `borderRadius`)
- **Fonts** → `src/app/layout.tsx` (`next/font/google`: Geist, Geist Mono)
- **Components** → `src/components/ui/` (shadcn/ui, owned)

Do **not** introduce inline ad-hoc color values in components (e.g. literal hex
in `style={{}}`). Add a token to `globals.css` + surface it in Tailwind, then use
the semantic class. The one documented exception is per-sport accent tints inside
`style` for assets that must composite with a team/sport color (see
`f1-driver-card.tsx` `boxShadow`).
