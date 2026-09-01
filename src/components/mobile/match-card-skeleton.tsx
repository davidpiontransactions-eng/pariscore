"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * T25 — MatchCardSkeleton
 *
 * Skeleton de match card réutilisable avec variants par sport.
 * Pattern FotMob/Flashscore : skeleton qui reflète la forme réelle du composant.
 *
 * Variants :
 * - "tennis" : 2 joueurs, score, cote
 * - "football" : 2 équipes, score, xG
 * - "basket" : 2 équipes, score, quarters
 * - "generic" : layout neutre
 *
 * Usage :
 * <MatchCardSkeleton variant="tennis" />
 * <MatchCardSkeleton variant="football" count={3} />
 */

type Variant = "tennis" | "football" | "basket" | "generic";

type Props = {
  variant?: Variant;
  /** Nombre de skeletons à afficher */
  count?: number;
  className?: string;
};

function TennisSkeleton() {
  return (
    <div className="rounded-lg border border-border/30 bg-card/50 p-3 space-y-3">
      {/* Tournament badge */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-3 w-24 rounded-full" />
        <Skeleton className="h-3 w-16 rounded-full" />
      </div>

      {/* Players + Score */}
      <div className="flex items-center justify-between">
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-3.5 w-32 rounded-full" />
          <Skeleton className="h-3.5 w-28 rounded-full" />
        </div>
        <div className="flex flex-col items-center gap-1 px-3">
          <Skeleton className="h-4 w-6 rounded" />
          <Skeleton className="h-4 w-6 rounded" />
        </div>
        <div className="flex-1 space-y-1.5 text-right">
          <Skeleton className="h-3.5 w-28 rounded-full ml-auto" />
          <Skeleton className="h-3.5 w-32 rounded-full ml-auto" />
        </div>
      </div>

      {/* Odds */}
      <div className="flex items-center justify-between pt-1 border-t border-border/20">
        <Skeleton className="h-3 w-12 rounded-full" />
        <Skeleton className="h-3 w-10 rounded-full" />
        <Skeleton className="h-3 w-10 rounded-full" />
        <Skeleton className="h-3 w-10 rounded-full" />
      </div>
    </div>
  );
}

function FootballSkeleton() {
  return (
    <div className="rounded-lg border border-border/30 bg-card/50 p-3 space-y-3">
      {/* League + time */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-3 w-20 rounded-full" />
        <Skeleton className="h-3 w-12 rounded-full" />
      </div>

      {/* Teams + Score */}
      <div className="flex items-center justify-between">
        <div className="flex-1 space-y-1.5">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-5 rounded-full" />
            <Skeleton className="h-3.5 w-24 rounded-full" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-5 rounded-full" />
            <Skeleton className="h-3.5 w-20 rounded-full" />
          </div>
        </div>
        <div className="flex flex-col items-center gap-1 px-3">
          <Skeleton className="h-4 w-5 rounded" />
          <Skeleton className="h-4 w-5 rounded" />
        </div>
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-3 w-16 rounded-full ml-auto" />
          <Skeleton className="h-3 w-14 rounded-full ml-auto" />
        </div>
      </div>

      {/* xG bar */}
      <div className="pt-1 border-t border-border/20">
        <Skeleton className="h-2 w-full rounded-full" />
      </div>
    </div>
  );
}

function BasketSkeleton() {
  return (
    <div className="rounded-lg border border-border/30 bg-card/50 p-3 space-y-3">
      {/* League */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-3 w-20 rounded-full" />
        <Skeleton className="h-3 w-16 rounded-full" />
      </div>

      {/* Teams + Score */}
      <div className="flex items-center justify-between">
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-3.5 w-28 rounded-full" />
          <Skeleton className="h-3.5 w-24 rounded-full" />
        </div>
        <div className="flex flex-col items-center gap-1 px-3">
          <Skeleton className="h-4 w-8 rounded" />
          <Skeleton className="h-4 w-8 rounded" />
        </div>
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-3 w-20 rounded-full ml-auto" />
          <Skeleton className="h-3 w-16 rounded-full ml-auto" />
        </div>
      </div>

      {/* Quarter scores */}
      <div className="flex items-center justify-between pt-1 border-t border-border/20">
        <Skeleton className="h-3 w-8 rounded" />
        <Skeleton className="h-3 w-8 rounded" />
        <Skeleton className="h-3 w-8 rounded" />
        <Skeleton className="h-3 w-8 rounded" />
      </div>
    </div>
  );
}

function GenericSkeleton() {
  return (
    <div className="rounded-lg border border-border/30 bg-card/50 p-3 space-y-3">
      <div className="flex items-center justify-between">
        <Skeleton className="h-3 w-24 rounded-full" />
        <Skeleton className="h-3 w-12 rounded-full" />
      </div>
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-32 rounded-full" />
        <Skeleton className="h-4 w-6 rounded" />
        <Skeleton className="h-4 w-28 rounded-full" />
      </div>
      <div className="flex items-center justify-between pt-1 border-t border-border/20">
        <Skeleton className="h-3 w-10 rounded-full" />
        <Skeleton className="h-3 w-10 rounded-full" />
        <Skeleton className="h-3 w-10 rounded-full" />
      </div>
    </div>
  );
}

const SKELETONS: Record<Variant, React.FC> = {
  tennis: TennisSkeleton,
  football: FootballSkeleton,
  basket: BasketSkeleton,
  generic: GenericSkeleton,
};

export function MatchCardSkeleton({ variant = "generic", count = 1, className }: Props) {
  const Component = SKELETONS[variant];

  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <Component key={i} />
      ))}
    </div>
  );
}
