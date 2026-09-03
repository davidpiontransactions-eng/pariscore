"use client";

import { cn } from "@/lib/utils";
import { useFootballPressReview } from "@/hooks/use-press-review";
import type { FootballPressSource, FootballPressConsensus } from "@/lib/football-press-review-service";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Newspaper, TrendingUp } from "lucide-react";

type Props = {
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  leagueName?: string;
  className?: string;
};

/**
 * Widget "Revue de Presse & Pronostics Medias" — affiche 3+ predictions de la
 * presse football specialisee (Forebet, FootyStats, SportyTrader, etc.)
 * avec une jauge de consensus 1X2 + Over 2.5 / BTTS.
 */
export function FootballPressReviewWidget({
  matchId, homeTeam, awayTeam, leagueName, className,
}: Props) {
  const { review, isLoading } = useFootballPressReview(matchId, homeTeam, awayTeam, leagueName);

  if (isLoading) return <PressReviewSkeleton className={className} />;
  if (!review || review.sources.length < 3) return null;

  const { consensus, sources } = review;

  return (
    <div className={cn("space-y-4 rounded-xl border border-slate-800 bg-slate-950/60 p-4", className)}>
      <div className="flex items-center gap-2">
        <Newspaper className="h-4 w-4 text-amber-400" />
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
          Revue de Presse & Pronostics Medias
        </h3>
        <Badge variant="outline" className="ml-auto border-slate-700 text-[11px] text-slate-400">
          {consensus.totalSources} sources
        </Badge>
      </div>

      <ConsensusBar consensus={consensus} homeTeam={homeTeam} awayTeam={awayTeam} />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {sources.map((source, i) => (
          <SourceCard key={`${source.name}-${i}`} source={source} homeTeam={homeTeam} awayTeam={awayTeam} />
        ))}
      </div>
    </div>
  );
}

/** Jauge de consensus 1X2 + Over/BTTS. */
function ConsensusBar({
  consensus, homeTeam, awayTeam,
}: {
  consensus: FootballPressConsensus;
  homeTeam: string;
  awayTeam: string;
}) {
  const hShort = shortName(homeTeam);
  const aShort = shortName(awayTeam);
  const domLabel = consensus.dominant === "home"
    ? `${Math.max(consensus.homeWinPct, consensus.awayWinPct, consensus.drawPct)}% des medias predisent ${hShort}`
    : consensus.dominant === "away"
    ? `${Math.max(consensus.homeWinPct, consensus.awayWinPct, consensus.drawPct)}% des medias predisent ${aShort}`
    : consensus.dominant === "draw"
    ? `${consensus.drawPct}% predisent un match nul`
    : "Pas de consensus clair";

  return (
    <div className="space-y-2.5">
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[11px] text-slate-400">
          <span className="truncate max-w-[40%]" title={homeTeam}>{hShort}</span>
          <span className="flex items-center gap-1 font-mono tabular-nums text-slate-400">
            <TrendingUp className="h-3 w-3 text-amber-400" />{domLabel}
          </span>
          <span className="truncate max-w-[40%] text-right" title={awayTeam}>{aShort}</span>
        </div>
        <div className="flex h-2 overflow-hidden rounded-full bg-slate-800">
          <div className="bg-sky-500 transition-all" style={{ width: `${consensus.homeWinPct}%` }} />
          <div className="bg-slate-600 transition-all" style={{ width: `${consensus.drawPct}%` }} />
          <div className="bg-rose-500 transition-all" style={{ width: `${consensus.awayWinPct}%` }} />
        </div>
        <div className="flex justify-between text-[11px] tabular-nums text-slate-400">
          <span>{consensus.homeWinPct}%</span>
          <span>{consensus.drawPct}%</span>
          <span>{consensus.awayWinPct}%</span>
        </div>
      </div>
      <div className="flex gap-3 text-[11px] text-slate-400">
        <span>O 2.5 : <strong className="text-slate-300">{consensus.over25Pct}%</strong></span>
        <span>BTTS : <strong className="text-slate-300">{consensus.bttsYesPct}%</strong></span>
      </div>
    </div>
  );
}

/** Carte d'une source media. */
function SourceCard({
  source, homeTeam, awayTeam,
}: {
  source: FootballPressSource;
  homeTeam: string;
  awayTeam: string;
}) {
  const p = source.prediction;
  const isHomeWin = p.text.toLowerCase().includes("victoire") && p.text.toLowerCase().includes(shortName(homeTeam).toLowerCase());
  const isAwayWin = p.text.toLowerCase().includes("victoire") && p.text.toLowerCase().includes(shortName(awayTeam).toLowerCase());

  return (
    <div className="flex flex-col rounded-lg border border-slate-800/80 bg-slate-900/50 p-3">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-base leading-none" aria-hidden>{source.icon}</span>
        <span className="text-[11px] font-semibold text-slate-200">{source.name}</span>
        {p.confidence > 0 && (
          <Badge variant="secondary" className={cn(
            "ml-auto text-[11px]",
            p.confidence >= 70 ? "bg-emerald-500/10 text-emerald-400"
            : p.confidence >= 55 ? "bg-amber-500/10 text-amber-400"
            : "bg-slate-800 text-slate-400",
          )}>
            <span aria-hidden="true" className="mr-1">
              {p.confidence >= 70 ? "✓" : p.confidence >= 55 ? "!" : "▲"}
            </span>
            {p.confidence}% confiance
          </Badge>
        )}
      </div>
      <p className="mb-2 flex-1 text-[11px] leading-relaxed text-slate-400">
        {source.expertSummary.slice(0, 200)}
      </p>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-400">Pronostic :</span>
          <span className={cn(
            "rounded-full px-2 py-0.5 text-[11px] font-semibold",
            isHomeWin && "bg-sky-500/10 text-sky-400",
            isAwayWin && "bg-rose-500/10 text-rose-400",
            !isHomeWin && !isAwayWin && "bg-slate-800 text-slate-300",
          )}>
            {p.text}
          </span>
        </div>
        {p.exactScore && (
          <div className="text-[11px] text-slate-400">
            Score predit : <span className="font-mono font-semibold text-slate-300">{p.exactScore}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function PressReviewSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-4 rounded-xl border border-slate-800 bg-slate-950/60 p-4", className)}>
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-4 rounded" />
        <Skeleton className="h-4 w-40" />
        <Skeleton className="ml-auto h-4 w-14" />
      </div>
      <Skeleton className="h-2.5 w-full rounded-full" />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="rounded-lg border border-slate-800/80 bg-slate-900/50 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-4 rounded" />
              <Skeleton className="h-3 w-20" />
              <Skeleton className="ml-auto h-4 w-12" />
            </div>
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-5 w-32 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

function shortName(n: string): string {
  const parts = n.trim().split(/\s+/);
  return parts.length > 1 ? parts[parts.length - 1] : n;
}
