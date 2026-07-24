# Refonte UI/UX Analyse Approfondie Tennis — Plan d'Implémentation

> **Pour agents :** Skill requis : `executing-plans`. Chaque tâche produit un livrable testable. Checkboxes `- [ ]` pour suivi.

**Goal:** Refondre la modale Analyse Approfondie Tennis : KpiCard (3 zones isolées), PlayerVsBlock (compact 140px), ConfidenceIntervalV2 (double piste + diamants), CountryFlag, SurfaceBadge.

**Architecture:** Composants React 19 Client Components dans `src/components/tennis/`. Refonte progressive sans toucher au legacy `pariscore.html`.

**Tech Stack:** React 19 + Next.js 16 App Router + TailwindCSS 4 + shadcn/ui + next-intl + Recharts

## Contraintes globales

- Ne PAS toucher à `pariscore.html` / `pariscore.js`
- Ne PAS toucher aux modales AI legacy (`#deep-modal`)
- Ne PAS toucher aux données API ni à la logique métier
- Ne PAS ajouter de nouvelles dépendances npm
- Composants en `"use client"`
- Tokens Tailwind existants : `--color-emerald-500`, `--color-amber-500`, `--color-orange-400`, `--color-blue-400`, `--color-green-400`
- Traductions via `next-intl` (clés existantes dans `match` scope)
- COMPONENTS.md à mettre à jour après ajout des nouveaux composants

---

### Tâche 1 : CountryFlag — Nouveau composant

**Fichiers :**
- Créer : `src/components/tennis/country-flag.tsx`
- Mettre à jour : `COMPONENTS.md`

**Interfaces :**
- Consomme : rien
- Produit : `<CountryFlag countryCode: string, size?: "sm" | "md" | "lg", className?: string>`

- [ ] **Étape 1 : Créer le composant CountryFlag**

```tsx
"use client";

import { cn } from "@/lib/utils";

type CountryFlagProps = {
  countryCode?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
};

function getFlagEmoji(countryCode?: string): string {
  if (!countryCode || countryCode.length !== 2) return "🌍";
  const codePoints = countryCode
    .toUpperCase()
    .split("")
    .map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

const sizeMap = {
  sm: "text-sm",
  md: "text-lg",
  lg: "text-2xl",
};

export function CountryFlag({ countryCode, size = "md", className }: CountryFlagProps) {
  return (
    <span
      className={cn("inline-flex items-center justify-center", sizeMap[size], className)}
      role="img"
      aria-label={countryCode ?? "unknown"}
    >
      {getFlagEmoji(countryCode)}
    </span>
  );
}
```

- [ ] **Étape 2 : Ajouter l'entrée dans COMPONENTS.md**

Ajouter dans la section Tennis :
```
| country-flag | country-flag.tsx | Drapeau pays en emoji |
```

- [ ] **Étape 3 : Commit**

```bash
git add src/components/tennis/country-flag.tsx COMPONENTS.md
git commit -m "feat: add CountryFlag component"
```

---

### Tâche 2 : SurfaceBadge — Nouveau composant

**Fichiers :**
- Créer : `src/components/tennis/surface-badge.tsx`
- Mettre à jour : `COMPONENTS.md`

**Interfaces :**
- Consomme : rien
- Produit : `<SurfaceBadge surface: string, size?: "sm" | "md", className?: string>`

- [ ] **Étape 1 : Créer le composant SurfaceBadge**

```tsx
"use client";

import { cn } from "@/lib/utils";

type SurfaceBadgeProps = {
  surface: string;
  size?: "sm" | "md";
  className?: string;
};

const surfaceConfig: Record<string, { icon: string; color: string }> = {
  Dur: { icon: "🟦", color: "border-blue-400/40 bg-blue-400/10 text-blue-400" },
  Hard: { icon: "🟦", color: "border-blue-400/40 bg-blue-400/10 text-blue-400" },
  "Terre battue": { icon: "🟠", color: "border-orange-400/40 bg-orange-400/10 text-orange-400" },
  Clay: { icon: "🟠", color: "border-orange-400/40 bg-orange-400/10 text-orange-400" },
  Gazon: { icon: "🟢", color: "border-green-400/40 bg-green-400/10 text-green-400" },
  Grass: { icon: "🟢", color: "border-green-400/40 bg-green-400/10 text-green-400" },
};

const sizeMap = {
  sm: "text-[10px] px-1.5 py-0.5",
  md: "text-xs px-2 py-1",
};

export function SurfaceBadge({ surface, size = "sm", className }: SurfaceBadgeProps) {
  const config = surfaceConfig[surface] ?? { icon: "🎾", color: "border-border/60 bg-muted/30 text-muted-foreground" };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border font-semibold uppercase leading-none",
        sizeMap[size],
        config.color,
        className,
      )}
    >
      <span aria-hidden>{config.icon}</span>
      <span>{surface}</span>
    </span>
  );
}
```

- [ ] **Étape 2 : Ajouter dans COMPONENTS.md**

```
| surface-badge | surface-badge.tsx | Pastille de surface (Dur/Clay/Grass) |
```

- [ ] **Étape 3 : Commit**

```bash
git add src/components/tennis/surface-badge.tsx COMPONENTS.md
git commit -m "feat: add SurfaceBadge component"
```

---

### Tâche 3 : KpiCard — Refonte 3 zones isolées

**Fichiers :**
- Modifier : `src/components/tennis/kpi-card.tsx` (refonte complète)

**Problème :** actuellement les 3 zones (header/value/footer) sont en `flex-col gap-2` sans hauteurs contraintes → les titres longs ou valeurs grandes chevauchent.

**Solution :** structure `flex flex-col h-full` avec 3 zones : header `h-10` fixe, value `flex-1` centré, footer `h-6` fixe. Chaque zone a `overflow-hidden`.

- [ ] **Étape 1 : Réécrire KpiCard**

```tsx
"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type KpiCardProps = {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  description?: ReactNode;
  className?: string;
  badge?: string;
  trend?: "up" | "down" | "neutral";
};

export function KpiCard({ icon, label, value, description, className, badge, trend }: KpiCardProps) {
  return (
    <div
      className={cn(
        "flex h-full flex-col rounded-lg border border-border/60 bg-card p-4",
        trend === "up" && "border-l-2 border-l-emerald-500",
        trend === "down" && "border-l-2 border-l-rose-500",
        className,
      )}
    >
      {/* Header — hauteur fixe, ne peut pas déborder */}
      <div className="flex h-10 shrink-0 items-center gap-1.5 overflow-hidden">
        <span className="shrink-0 text-muted-foreground">{icon}</span>
        <span className="truncate text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          {label}
        </span>
        {badge && (
          <span className="ml-auto shrink-0 rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-semibold text-accent">
            {badge}
          </span>
        )}
      </div>

      {/* Value — flex-1, centré verticalement */}
      <div className="flex flex-1 items-center justify-center overflow-hidden">
        <div className="text-3xl font-bold leading-none tabular-nums tracking-tight text-foreground">
          {value}
        </div>
      </div>

      {/* Footer — hauteur fixe */}
      {description && (
        <div className="flex h-6 shrink-0 items-center overflow-hidden">
          <span className="truncate text-xs leading-relaxed text-muted-foreground/80">
            {description}
          </span>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Étape 2 : Commit**

```bash
git add src/components/tennis/kpi-card.tsx
git commit -m "refactor: KpiCard 3-zone isolation (header h-10 / value flex-1 / footer h-6)"
```

---

### Tâche 4 : PlayerVsBlock — Nouveau composant compact

**Fichiers :**
- Créer : `src/components/tennis/player-vs-block.tsx`
- Mettre à jour : `COMPONENTS.md`

**Interfaces :**
- Consomme : `TennisMatch` (types dans `@/lib/tennis-data`), `CountryFlag`, `SurfaceBadge`
- Produit : `<PlayerVsBlock match: TennisMatch, className?: string>`

- [ ] **Étape 1 : Créer PlayerVsBlock**

```tsx
"use client";

import type { TennisMatch } from "@/lib/tennis-data";
import { CountryFlag } from "./country-flag";
import { SurfaceBadge } from "./surface-badge";
import { getInitials } from "./player-profile-header";
import { cn } from "@/lib/utils";

type PlayerVsBlockProps = {
  match: TennisMatch;
  className?: string;
};

export function PlayerVsBlock({ match, className }: PlayerVsBlockProps) {
  const { playerA, playerB, probA, probB, stats, h2hHistory } = match;

  const h2hWinsA = h2hHistory
    ? h2hHistory.filter((h) => h.winnerId === playerA.id).length
    : 0;
  const h2hWinsB = h2hHistory
    ? h2hHistory.filter((h) => h.winnerId === playerB.id).length
    : 0;
  const totalH2H = h2hWinsA + h2hWinsB;

  const isAFavorite = probA >= probB;

  return (
    <div className={cn("rounded-lg border border-border/60 bg-card p-4", className)}>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div className={cn(
          "flex flex-col items-center gap-1.5",
          !isAFavorite && "order-3"
        )}>
          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full ring-2 ring-offset-1 ring-offset-background"
            style={{ backgroundColor: `${playerA.color}15`, "--tw-ring-color": playerA.color } as React.CSSProperties}
          >
            {playerA.photoUrl ? (
              <img src={playerA.photoUrl} alt={playerA.name} className="absolute inset-0 h-full w-full object-cover"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
              />
            ) : null}
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{getInitials(playerA.name)}</span>
          </div>
          <div className="flex items-center gap-1">
            <CountryFlag countryCode={playerA.country} size="sm" />
            <span className="max-w-[100px] truncate text-sm font-bold" style={{ color: playerA.color }}>
              {playerA.shortName}
            </span>
          </div>
          <span className="text-[10px] text-muted-foreground">#{playerA.rank}</span>
        </div>

        <div className="flex flex-col items-center gap-2">
          <span className="rounded-full bg-muted px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            VS
          </span>
        </div>

        <div className={cn(
          "flex flex-col items-center gap-1.5",
          !isAFavorite && "order-1"
        )}>
          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full ring-2 ring-offset-1 ring-offset-background"
            style={{ backgroundColor: `${playerB.color}15`, "--tw-ring-color": playerB.color } as React.CSSProperties}
          >
            {playerB.photoUrl ? (
              <img src={playerB.photoUrl} alt={playerB.name} className="absolute inset-0 h-full w-full object-cover"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
              />
            ) : null}
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{getInitials(playerB.name)}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="max-w-[100px] truncate text-sm font-bold" style={{ color: playerB.color }}>
              {playerB.shortName}
            </span>
            <CountryFlag countryCode={playerB.country} size="sm" />
          </div>
          <span className="text-[10px] text-muted-foreground">#{playerB.rank}</span>
        </div>
      </div>

      <div className="mt-3">
        <div className="flex justify-between text-[11px] text-muted-foreground">
          <span className="font-semibold" style={{ color: playerA.color }}>{playerA.shortName}</span>
          <span className="font-mono font-bold tabular-nums">{isAFavorite ? probA : probB}%</span>
        </div>
        <div className="relative mt-0.5 h-2.5 overflow-hidden rounded-full bg-muted">
          <div
            className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
            style={{
              width: `${isAFavorite ? probA : probB}%`,
              background: isAFavorite ? playerA.color : playerB.color,
            }}
          />
        </div>
        <div className="mt-0.5 flex justify-between text-[11px] text-muted-foreground">
          <span className="font-mono font-bold tabular-nums">{isAFavorite ? probB : probA}%</span>
          <span className="font-semibold" style={{ color: isAFavorite ? playerB.color : playerA.color }}>{isAFavorite ? playerB.shortName : playerA.shortName}</span>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-center gap-3 text-xs text-muted-foreground">
        {totalH2H > 0 ? (
          <span className="font-medium">
            H2H : {playerA.shortName} {h2hWinsA}–{h2hWinsB} {playerB.shortName}
          </span>
        ) : (
          <span className="italic text-muted-foreground/60">Pas d'historique H2H</span>
        )}
        <span className="text-muted-foreground/30">·</span>
        <SurfaceBadge surface={stats.surface} size="sm" />
      </div>
    </div>
  );
}
```

- [ ] **Étape 2 : Ajouter dans COMPONENTS.md**

```
| player-vs-block | player-vs-block.tsx | Bloc duel joueur compact (140px) avec H2H et surface |
```

- [ ] **Étape 3 : Commit**

```bash
git add src/components/tennis/player-vs-block.tsx COMPONENTS.md
git commit -m "feat: add PlayerVsBlock compact component with H2H + surface"
```

---

### Tâche 5 : ConfidenceIntervalV2 — Refonte double piste

**Fichiers :**
- Modifier : `src/components/tennis/confidence-interval.tsx` (refonte complète)

**Problème :** piste unique superposée pour les 2 joueurs, marqueurs trop fins (lignes verticales), pas de noms intégrés.

**Solution :** 2 pistes séparées (une par joueur), marqueurs diamant `◆` pour le point estimé, pastilles colorées pour les bornes IC.

- [ ] **Étape 1 : Réécrire ConfidenceInterval**

```tsx
"use client";

import { cn } from "@/lib/utils";

type ConfidenceIntervalV2Props = {
  playerA: {
    shortName: string;
    value: number;
    ciLow: number;
    ciHigh: number;
    color: string;
    isFavorite: boolean;
  };
  playerB: {
    shortName: string;
    value: number;
    ciLow: number;
    ciHigh: number;
    color: string;
    isFavorite: boolean;
  };
  confidenceLevel?: number;
  label?: string;
  interpretation?: string;
  className?: string;
};

export function ConfidenceIntervalV2({
  playerA,
  playerB,
  confidenceLevel = 95,
  label = `Intervalle de confiance (IC ${confidenceLevel}%)`,
  interpretation,
  className,
}: ConfidenceIntervalV2Props) {
  return (
    <div className={cn("rounded-lg border border-border/60 bg-card p-4", className)}>
      <div className="mb-4 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
        <span>🔒</span>
        <span>{label}</span>
      </div>

      {/* Piste Joueur A */}
      <ConfidenceTrack
        shortName={playerA.shortName}
        value={playerA.value}
        ciLow={playerA.ciLow}
        ciHigh={playerA.ciHigh}
        color={playerA.color}
        isFavorite={playerA.isFavorite}
      />

      {/* Piste Joueur B */}
      <ConfidenceTrack
        shortName={playerB.shortName}
        value={playerB.value}
        ciLow={playerB.ciLow}
        ciHigh={playerB.ciHigh}
        color={playerB.color}
        isFavorite={playerB.isFavorite}
      />

      {/* Étiquettes de référence */}
      <div className="mt-1 flex justify-between text-[10px] font-mono tabular-nums text-muted-foreground">
        <span>0%</span>
        <span>25%</span>
        <span>50%</span>
        <span>75%</span>
        <span>100%</span>
      </div>

      {/* Interprétation */}
      {interpretation && (
        <div className="mt-3 rounded-md bg-muted/50 px-3 py-2 text-[11px] italic leading-relaxed text-muted-foreground">
          ▶ {interpretation}
        </div>
      )}
    </div>
  );
}

function ConfidenceTrack({
  shortName,
  value,
  ciLow,
  ciHigh,
  color,
  isFavorite,
}: {
  shortName: string;
  value: number;
  ciLow: number;
  ciHigh: number;
  color: string;
  isFavorite: boolean;
}) {
  return (
    <div className="mb-3 last:mb-0">
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 font-semibold" style={{ color }}>
          <span className={`inline-block h-2 w-2 rounded-full ${isFavorite ? "" : "opacity-60"}`}
            style={{ backgroundColor: color }}
          />
          {shortName}
        </span>
        <span className="font-mono text-sm font-bold tabular-nums text-foreground">
          {value}%
        </span>
      </div>

      <div className="relative mt-1 h-5">
        <div className="absolute inset-0 top-1.5 h-2 rounded-full bg-muted" />

        <div
          className="absolute top-1.5 h-2 rounded-full border transition-all"
          style={{
            left: `${ciLow}%`,
            width: `${ciHigh - ciLow}%`,
            borderColor: `${color}80`,
            backgroundColor: `${color}15`,
          }}
        />

        <div
          className="absolute top-0 z-10 flex -translate-x-1/2 items-center justify-center"
          style={{ left: `${value}%` }}
        >
          <span
            className="text-base leading-none drop-shadow-sm"
            style={{ color }}
          >
            ◆
          </span>
          <span className="absolute -bottom-4 whitespace-nowrap text-[9px] font-mono font-semibold tabular-nums"
            style={{ color }}
          >
            IC [{ciLow}, {ciHigh}]
          </span>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Étape 2 : Commit**

```bash
git add src/components/tennis/confidence-interval.tsx
git commit -m "refactor: ConfidenceIntervalV2 double-track with diamond markers"
```

---

### Tâche 6 : MatchDetailDialog — Intégration des nouveaux composants

**Fichiers :**
- Modifier : `src/components/tennis/match-detail-dialog.tsx`

**Modifications :**
1. Remplacer le Player VS block interne (PlayerAvatar + grille) par `<PlayerVsBlock match={match} />`
2. Remplacer `<ConfidenceInterval>` par `<ConfidenceIntervalV2>`
3. Utiliser `<CountryFlag>` au lieu de `getFlagEmoji()` locale
4. Utiliser `<SurfaceBadge>` pour l'affichage surface dans le header

- [ ] **Étape 1 : Modifier match-detail-dialog.tsx**

Changements :
- Importer `PlayerVsBlock`, `ConfidenceIntervalV2`, `CountryFlag`, `SurfaceBadge`
- Supprimer `getFlagEmoji()` et `getSurfaceIcon()` locales
- Supprimer `PlayerAvatar` composant interne
- Dans le tab `overview`, remplacer le bloc VS player (grid-cols-[1fr_auto_1fr]) par `<PlayerVsBlock match={match} />`
- Remplacer `<ConfidenceInterval>` par `<ConfidenceIntervalV2>`
- Remplacer `getFlagEmoji(playerA.country)` par `<CountryFlag countryCode={playerA.country} size="md" />`
- Remplacer `getSurfaceIcon(stats.surface)` par `<SurfaceBadge surface={stats.surface} size="sm" />`

- [ ] **Étape 2 : Commit**

```bash
git add src/components/tennis/match-detail-dialog.tsx
git commit -m "refactor: integrate PlayerVsBlock, ConfidenceIntervalV2, CountryFlag, SurfaceBadge"
```

---

### Tâche 7 : StatsIndicatorsGrid — Ajustements mineurs

**Fichiers :**
- Modifier : `src/components/tennis/stats-indicators-grid.tsx`

- [ ] **Étape 1 : Vérifier et ajuster**

Rien de cassé a priori. Le composant est déjà propre. Vérifier juste que les tokens typo correspondent (text-[11px] pour les labels si besoin).

- [ ] **Étape 2 : Commit (si modifs)**

```bash
git add src/components/tennis/stats-indicators-grid.tsx
git commit -m "style: minor StatsIndicatorsGrid typo alignment"
```

---

### Vérification finale

```bash
bun run typecheck
bun run lint
```