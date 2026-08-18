import { Skeleton } from "@/components/ui/skeleton";

/**
 * Skeleton de carte de match tennis — affiché pendant le chargement de la
 * grille prematch/live. Markup miroir de MatchCardBroadcast (header,
 * avatars, cote centrale, chips).
 */
export function MatchCardSkeleton() {
  return (
    <div className="rounded-2xl border border-border/70 bg-card p-6">
      <div className="flex items-center justify-between border-b border-border/60 pb-2">
        <Skeleton className="h-3 w-32" /><Skeleton className="h-3 w-16" />
      </div>
      <div className="grid grid-cols-3 items-center gap-2 py-8">
        <div className="flex flex-col items-center gap-2">
          <Skeleton className="h-[72px] w-[72px] rounded-full" />
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-[92px] w-[92px] rounded-full" />
        </div>
        <div className="flex justify-center"><Skeleton className="h-11 w-11 rounded-full" /></div>
        <div className="flex flex-col items-center gap-2">
          <Skeleton className="h-[72px] w-[72px] rounded-full" />
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-[92px] w-[92px] rounded-full" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 pt-4 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12" />)}
      </div>
    </div>
  );
}