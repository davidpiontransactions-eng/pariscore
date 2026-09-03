import { cn } from "@/lib/utils";

/**
 * MatchCardSkeleton
 *
 * Skeleton amélioré pour les cartes de match.
 * Pattern shimmer animé avec placeholders réalistes.
 *
 * Usage :
 * <MatchCardSkeleton />
 * <MatchCardSkeleton variant="compact" />
 */

type Props = {
  variant?: "default" | "compact" | "live";
  className?: string;
};

function Shimmer({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded bg-white/5",
        "after:absolute after:inset-0 after:-translate-x-full after:animate-[shimmer_1.5s_infinite] after:bg-gradient-to-r after:from-transparent after:via-white/10 after:to-transparent",
        className
      )}
    />
  );
}

export function MatchCardSkeleton({ variant = "default", className }: Props) {
  if (variant === "compact") {
    return (
      <div className={cn("flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-3", className)}>
        <Shimmer className="h-8 w-8 rounded-full" />
        <div className="flex-1 space-y-1.5">
          <Shimmer className="h-3 w-3/4" />
          <Shimmer className="h-2.5 w-1/2" />
        </div>
        <Shimmer className="h-6 w-12 rounded" />
      </div>
    );
  }

  if (variant === "live") {
    return (
      <div className={cn("rounded-2xl border border-rose-500/20 bg-white/[0.02] p-4", className)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
            <Shimmer className="h-3 w-20" />
          </div>
          <Shimmer className="h-4 w-12" />
        </div>
        <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <div className="space-y-2">
            <Shimmer className="h-4 w-full" />
            <Shimmer className="h-3 w-2/3" />
          </div>
          <div className="space-y-1">
            <Shimmer className="h-6 w-16 rounded" />
          </div>
          <div className="space-y-2 text-right">
            <Shimmer className="h-4 w-full" />
            <Shimmer className="h-3 w-2/3 ml-auto" />
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <Shimmer className="h-8 flex-1 rounded-lg" />
          <Shimmer className="h-8 flex-1 rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className={cn("rounded-2xl border border-white/5 bg-white/[0.02] p-4", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shimmer className="h-4 w-4 rounded" />
          <Shimmer className="h-3 w-24" />
        </div>
        <Shimmer className="h-5 w-5 rounded-full" />
      </div>

      {/* Players */}
      <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div className="space-y-2">
          <Shimmer className="h-4 w-full" />
          <Shimmer className="h-3 w-2/3" />
          <Shimmer className="h-2 w-1/2" />
        </div>
        <div className="space-y-1">
          <Shimmer className="h-5 w-10 rounded" />
          <Shimmer className="h-2 w-8 mx-auto" />
        </div>
        <div className="space-y-2 text-right">
          <Shimmer className="h-4 w-full" />
          <Shimmer className="h-3 w-2/3 ml-auto" />
          <Shimmer className="h-2 w-1/2 ml-auto" />
        </div>
      </div>

      {/* Odds */}
      <div className="mt-4 grid grid-cols-3 gap-2">
        <Shimmer className="h-10 rounded-lg" />
        <Shimmer className="h-10 rounded-lg" />
        <Shimmer className="h-10 rounded-lg" />
      </div>

      {/* Footer */}
      <div className="mt-3 flex items-center justify-between">
        <Shimmer className="h-2.5 w-32" />
        <Shimmer className="h-2.5 w-20" />
      </div>
    </div>
  );
}

/**
 * MatchListSkeleton
 *
 * Skeleton pour une liste de matchs.
 */
export function MatchListSkeleton({
  count = 4,
  variant = "default",
  className,
}: {
  count?: number;
  variant?: "default" | "compact" | "live";
  className?: string;
}) {
  return (
    <div className={cn("space-y-4", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <MatchCardSkeleton key={i} variant={variant} />
      ))}
    </div>
  );
}

/**
 * TabContentSkeleton
 *
 * Skeleton pour le contenu d'un onglet sport.
 */
export function TabContentSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-6", className)}>
      {/* Header skeleton */}
      <div className="space-y-3">
        <Shimmer className="h-8 w-48" />
        <Shimmer className="h-4 w-96" />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
            <Shimmer className="h-3 w-16 mb-2" />
            <Shimmer className="h-6 w-12" />
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <MatchListSkeleton count={4} />
      </div>
    </div>
  );
}
