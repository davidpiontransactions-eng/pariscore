"use client";

import { Trophy, Clock, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FootballMatch } from "@/lib/football-data";
import { Skeleton } from "@/components/ui/skeleton";

function FormDots({ form }: { form: ("W" | "D" | "L")[] }) {
  return (
    <div className="flex gap-0.5">
      {form.map((r, i) => (
        <span
          key={i}
          className={cn(
            "inline-block h-1.5 w-1.5 rounded-full",
            r === "W" && "bg-emerald-500",
            r === "D" && "bg-amber-500",
            r === "L" && "bg-rose-500",
          )}
        />
      ))}
    </div>
  );
}

function formatKickoff(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function formatDay(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (d.toDateString() === today.toDateString()) return "Aujourd'hui";
  if (d.toDateString() === tomorrow.toDateString()) return "Demain";
  return d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
}

const dayCache = new Map<string, string>();

function getDay(iso: string): string {
  if (!dayCache.has(iso)) dayCache.set(iso, formatDay(iso));
  return dayCache.get(iso)!;
}

// Clamp probability to [5, 95] for the bar width to avoid 0-width or full-width bars
function clampProb(p: number): number {
  return Math.max(5, Math.min(95, p));
}

export function FootballMatchCard({
  match,
  onOpenDetail,
  onBetClick,
  priority,
}: {
  match: FootballMatch;
  onOpenDetail?: () => void;
  onBetClick?: () => void;
  priority?: boolean;
}) {
  const p = match.prediction;
  const homePct = clampProb(p.homeProb);
  const drawPct = clampProb(p.drawProb);
  const awayPct = clampProb(p.awayProb);

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border/70 bg-card transition-all hover:border-emerald-500/40 hover:shadow-lg hover:shadow-emerald-500/5">
      <div className="p-4">
        {/* Header: league + time */}
        <div className="mb-3 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <span>{match.league.logo}</span>
            <span className="font-medium">{match.league.name}</span>
            <span className="text-[10px] text-muted-foreground/60">·</span>
            <span>{match.round}</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>{formatKickoff(match.scheduledAt)}</span>
            <span className="hidden text-[10px] text-muted-foreground/60 sm:inline">
              · {getDay(match.scheduledAt)}
            </span>
          </div>
        </div>

        {/* Teams */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          {/* Home */}
          <div className="flex flex-col items-center gap-1.5 text-center">
            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-muted">
              {match.home.logo ? (
                <img
                  src={match.home.logo}
                  alt={match.home.name}
                  className="h-8 w-8 object-contain"
                  loading={priority ? "eager" : "lazy"}
                />
              ) : (
                <Trophy className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
            <span className="text-sm font-semibold leading-tight">{match.home.shortName}</span>
            <FormDots form={match.home.form} />
          </div>

          {/* Score / VS */}
          <div className="flex flex-col items-center gap-1">
            {match.live ? (
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold tabular-nums">
                  {match.live.homeScore}
                </span>
                <span className="text-lg text-muted-foreground">:</span>
                <span className="text-2xl font-bold tabular-nums">
                  {match.live.awayScore}
                </span>
              </div>
            ) : (
              <span className="text-sm font-bold text-muted-foreground">VS</span>
            )}
            {match.odds && (
              <div className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">
                <span className="tabular-nums">{match.odds.home.toFixed(2)}</span>
                <span className="text-muted-foreground/40">/</span>
                <span className="tabular-nums">{match.odds.draw.toFixed(2)}</span>
                <span className="text-muted-foreground/40">/</span>
                <span className="tabular-nums">{match.odds.away.toFixed(2)}</span>
              </div>
            )}
          </div>

          {/* Away */}
          <div className="flex flex-col items-center gap-1.5 text-center">
            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-muted">
              {match.away.logo ? (
                <img
                  src={match.away.logo}
                  alt={match.away.name}
                  className="h-8 w-8 object-contain"
                  loading={priority ? "eager" : "lazy"}
                />
              ) : (
                <Trophy className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
            <span className="text-sm font-semibold leading-tight">{match.away.shortName}</span>
            <FormDots form={match.away.form} />
          </div>
        </div>

        {/* Prediction bar */}
        <div className="mt-3 flex h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="bg-emerald-500 transition-all"
            style={{ width: `${homePct}%` }}
          />
          <div
            className="bg-amber-500 transition-all"
            style={{ width: `${drawPct}%` }}
          />
          <div
            className="bg-rose-500 transition-all"
            style={{ width: `${awayPct}%` }}
          />
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
          <span>{p.homeProb}%</span>
          <span>N {p.drawProb}%</span>
          <span>{p.awayProb}%</span>
        </div>

        {/* Footer: markets + CTA */}
        <div className="mt-3 flex items-center justify-between gap-2 border-t border-border/40 pt-3">
          <div className="flex gap-2 text-[10px] text-muted-foreground">
            {p.bttsProb > 0 && (
              <span className="rounded-md border border-border/60 bg-muted/50 px-1.5 py-0.5 font-medium">
                BTTS {p.bttsProb}%
              </span>
            )}
            {p.over25Prob > 0 && (
              <span className="rounded-md border border-border/60 bg-muted/50 px-1.5 py-0.5 font-medium">
                O2.5 {p.over25Prob}%
              </span>
            )}
            <span className="rounded-md border border-border/60 bg-muted/50 px-1.5 py-0.5 font-medium">
              {p.model}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={onOpenDetail}
              className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              title="Voir l'analyse détaillée"
            >
              <BarChart3 className="h-3 w-3" />
              Analyse
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function FootballMatchCardSkeleton() {
  return (
    <div className="rounded-2xl border border-border/70 bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-3 w-16" />
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div className="flex flex-col items-center gap-1.5">
          <Skeleton className="h-12 w-12 rounded-full" />
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-1.5 w-12" />
        </div>
        <div className="flex flex-col items-center gap-1">
          <Skeleton className="h-6 w-12" />
          <Skeleton className="h-3 w-20" />
        </div>
        <div className="flex flex-col items-center gap-1.5">
          <Skeleton className="h-12 w-12 rounded-full" />
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-1.5 w-12" />
        </div>
      </div>
      <Skeleton className="mt-3 h-1.5 w-full" />
      <div className="mt-3 flex items-center justify-between border-t border-border/40 pt-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-6 w-16 rounded-lg" />
      </div>
    </div>
  );
}
