"use client";

import { cn } from "@/lib/utils";
import { useContendersMatches } from "@/hooks/use-contenders-matches";
import { CountryFlag } from "./country-flag";
import { Zap, Clock, CheckCircle2 } from "lucide-react";

type ContendersMatchesProps = {
  slug: string;
  year?: number;
  className?: string;
};

function StatusBadge({ status }: { status: string }) {
  if (status === "live") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-bold text-red-400">
        <Zap className="h-2.5 w-2.5" />
        LIVE
      </span>
    );
  }
  if (status === "completed") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
        <CheckCircle2 className="h-2.5 w-2.5" />
        Terminé
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/10 px-2 py-0.5 text-[10px] font-medium text-sky-400">
      <Clock className="h-2.5 w-2.5" />
      À venir
    </span>
  );
}

export function ContendersMatches({ slug, year, className }: ContendersMatchesProps) {
  const { contenders, isLoading } = useContendersMatches(slug, year);

  // Filtrer ceux qui ont un match annoncé
  const withMatches = contenders.filter((c) => c.match);

  // Ne rien afficher si aucun match annoncé
  if (!isLoading && withMatches.length === 0) return null;

  return (
    <div className={cn("mt-4 rounded-lg border border-border/60 bg-card p-4", className)}>
      <div className="mb-3 flex items-center gap-2">
        <span className="text-xs font-semibold text-foreground">
          Matchs des prétendants
        </span>
        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
          Top 10
        </span>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex gap-2">
              <div className="h-3 w-3 animate-pulse rounded bg-muted/40" />
              <div className="h-3 flex-1 animate-pulse rounded bg-muted/40" />
              <div className="h-3 w-16 animate-pulse rounded bg-muted/40" />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {withMatches.map((c) => (
            <div
              key={c.name}
              className="flex items-center gap-3 rounded-md border border-border/40 bg-muted/20 px-3 py-2"
            >
              {/* Rang */}
              <span className="w-5 text-center text-[10px] font-mono text-muted-foreground/50">
                {c.rank}
              </span>

              {/* Joueur */}
              <div className="flex min-w-0 flex-1 items-center gap-1.5">
                {c.seed && (
                  <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-muted font-mono text-[9px] font-bold text-foreground">
                    {c.seed}
                  </span>
                )}
                <CountryFlag countryCode={c.country} size="sm" />
                <span className="truncate text-[11px] font-medium text-foreground">
                  {c.name}
                </span>
              </div>

              {/* VS */}
              <span className="text-[10px] text-muted-foreground/40">vs</span>

              {/* Adversaire */}
              <div className="flex min-w-0 flex-1 items-center gap-1.5">
                <CountryFlag countryCode={c.match!.opponentCountry} size="sm" />
                <span className="truncate text-[11px] text-foreground/70">
                  {c.match!.opponent}
                </span>
              </div>

              {/* Status */}
              <StatusBadge status={c.match!.status} />

              {/* Score ou heure */}
              {c.match!.score ? (
                <span className="font-mono text-[10px] font-medium text-foreground">
                  {c.match!.score}
                </span>
              ) : c.match!.scheduledAt ? (
                <span className="text-[10px] text-muted-foreground/60">
                  {new Date(c.match!.scheduledAt).toLocaleTimeString("fr-FR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
