"use client";

import { Trophy, Clock, Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FootballMatch } from "@/lib/football-data";

function LiveBadge({ minute, status, period }: { minute: number; status: string; period?: string }) {
  const isHT = status === "HT";
  const isFT = status === "FT" || status === "PEN";
  // Indice de mi-temps : "2H" → 2e MT, sinon 1re MT (HT traité à part).
  const half = period === "2H" ? "2M" : "1M";
  const label = isFT ? "Terminé" : isHT ? "MI-TEMPS" : `${minute}' ${half}`;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
        isFT
          ? "bg-muted text-muted-foreground"
          : isHT
            ? "bg-amber-500/20 text-amber-600 dark:text-amber-400"
            : "bg-rose-500/20 text-rose-600 dark:text-rose-400",
      )}
    >
      {!isFT && !isHT && (
        <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-rose-500" />
      )}
      {label}
    </span>
  );
}

function formatKickoff(iso: string): string {
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function StatRow({
  label,
  home,
  away,
  pct,
}: {
  label: string;
  home: number;
  away: number;
  pct?: number;
}) {
  const max = Math.max(home, away, 1);
  const homePct = pct ?? (home / max) * 70;
  const awayPct = pct ?? (away / max) * 70;

  return (
    <div className="flex items-center gap-2 text-[11px]">
      <span className="w-6 text-right font-semibold tabular-nums">{home}</span>
      <div className="flex flex-1 items-center gap-0.5">
        <div
          className="h-1 rounded-full bg-emerald-500/60 transition-all"
          style={{ width: `${homePct}%` }}
        />
        <span className="mx-1 w-8 text-center text-[9px] text-muted-foreground">{label}</span>
        <div
          className="h-1 rounded-full bg-rose-500/60 transition-all"
          style={{ width: `${awayPct}%` }}
        />
      </div>
      <span className="w-6 font-semibold tabular-nums">{away}</span>
    </div>
  );
}

export function FootballLiveCard({ match, onOpenDetail }: { match: FootballMatch; onOpenDetail?: () => void }) {
  const live = match.live;
  if (!live) return null;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-rose-500/30 bg-gradient-to-b from-rose-500/[0.04] to-card shadow-lg shadow-rose-500/5 transition-all hover:border-rose-500/50">
      {/* Stade en filigrane (fond) — image BSD /img/venue/{id}/, masquée si absente/cassée */}
      {match.venue?.id && (
        <img
          src={`https://sports.bzzoiro.com/img/venue/${match.venue.id}/`}
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-[0.07] dark:opacity-[0.05]"
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
      )}
      <div className="relative p-4">
        {/* Live header */}
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
            <span className="shrink-0">{match.league.logo}</span>
            <span className="truncate font-medium">{match.league.name}</span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground/80">
              <Clock className="h-3 w-3" />
              {formatKickoff(match.scheduledAt)}
            </span>
            <LiveBadge minute={live.minute} status={live.status} period={live.period} />
          </div>
        </div>

        {/* Score */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
          <div className="flex flex-col items-center gap-1">
            <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-muted">
              {match.home.logo ? (
                <img
                  src={match.home.logo}
                  alt={match.home.name}
                  className="h-7 w-7 object-contain"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              ) : (
                <Trophy className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
            <span className="text-xs font-semibold">{match.home.shortName}</span>
          </div>
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-3">
              <span className="text-3xl font-black tabular-nums">{live.homeScore}</span>
              <span className="text-xl font-bold text-muted-foreground">:</span>
              <span className="text-3xl font-black tabular-nums">{live.awayScore}</span>
            </div>
          </div>
          <div className="flex flex-col items-center gap-1">
            <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-muted">
              {match.away.logo ? (
                <img
                  src={match.away.logo}
                  alt={match.away.name}
                  className="h-7 w-7 object-contain"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              ) : (
                <Trophy className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
            <span className="text-xs font-semibold">{match.away.shortName}</span>
          </div>
        </div>

        {/* Stats */}
        {(live.homeShots > 0 || live.awayShots > 0) && (
          <div className="mt-4 space-y-1.5 border-t border-border/40 pt-3">
            <StatRow label="Poss." home={live.homePossession} away={100 - live.homePossession} pct={live.homePossession / 1} />
            <StatRow label="Tirs" home={live.homeShots} away={live.awayShots} />
            <StatRow label="Cadrés" home={live.homeShotsOnTarget} away={live.awayShotsOnTarget} />
            <StatRow label="Corners" home={live.homeCorners} away={live.awayCorners} />
          </div>
        )}

        {/* Odds */}
        {match.odds && (
          <div className="mt-3 flex justify-center gap-3 border-t border-border/40 pt-3 text-[11px]">
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
              1 {match.odds.home.toFixed(2)}
            </span>
            <span className="font-semibold text-amber-600 dark:text-amber-400">
              N {match.odds.draw.toFixed(2)}
            </span>
            <span className="font-semibold text-rose-600 dark:text-rose-400">
              2 {match.odds.away.toFixed(2)}
            </span>
          </div>
        )}

        {/* CTA Momentum (graphe au clic) */}
        {onOpenDetail && (
          <button
            onClick={onOpenDetail}
            className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-border/60 bg-muted/40 px-3 py-1.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title="Voir le momentum du match"
          >
            <Activity className="h-3 w-3" />
            Momentum
          </button>
        )}
      </div>
    </div>
  );
}
