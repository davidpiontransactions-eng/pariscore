"use client";

import { Trophy, Clock, BarChart3, TrendingUp } from "lucide-react";
import type { FootballMatch, Prediction } from "@/lib/football-data";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfidenceRing } from "@/components/shared/confidence-ring";
import { FormTimeline } from "@/components/shared/form-timeline";
import { SportImage } from "@/components/ui/sport-image";
import { PlayerAvatar } from "@/components/ui/player-avatar";
import { getLeagueBanner } from "@/lib/sport-images";

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
  // Derive confidence from max probability if not explicitly provided (0.5–0.8 range)
  const maxProb = Math.max(p.homeProb, p.drawProb, p.awayProb);
  const confidence = (p as Prediction & { confidence?: number }).confidence ?? (0.5 + (maxProb / 100) * 0.3);

  // Collect prediction badges for the "Prédictions Clés" section
  const predictionBadges: { key: string; label: string; prob: number }[] = [];
  if (p.doubleChance) {
    predictionBadges.push({
      key: "dc",
      label: `DC ${p.doubleChance.selection} (${p.doubleChance.prob}%)`,
      prob: p.doubleChance.prob,
    });
  }
  if (p.over15Prob !== undefined) {
    predictionBadges.push({
      key: "o15",
      label: `O1.5 (${p.over15Prob}%)`,
      prob: p.over15Prob,
    });
  }
  if (p.under35Prob !== undefined) {
    predictionBadges.push({
      key: "u35",
      label: `U3.5 (${p.under35Prob}%)`,
      prob: p.under35Prob,
    });
  }
  if (p.bttsProb > 0) {
    predictionBadges.push({
      key: "btts",
      label: `BTTS (${p.bttsProb}%)`,
      prob: p.bttsProb,
    });
  }
  if (p.bestCornerOver) {
    predictionBadges.push({
      key: "corners",
      label: `Corn. O${p.bestCornerOver.line} (${p.bestCornerOver.overProb}%)`,
      prob: p.bestCornerOver.overProb,
    });
  }
  const maxBadgeProb = predictionBadges.length > 0
    ? Math.max(...predictionBadges.map((b) => b.prob))
    : 0;

  return (
    <div className="group relative max-w-full overflow-hidden rounded-2xl border border-border/70 bg-card transition-all hover:border-emerald-500/40 hover:shadow-lg hover:shadow-emerald-500/5">
      {/* Bannière ligue en fond (overlay sombre) */}
      <div className="relative h-36 overflow-hidden sm:h-44">
        <SportImage
          src={getLeagueBanner(null, "football")}
          alt={match.league.name}
          fill
          darkOverlay
          overlayIntensity="medium"
          fallbackIcon={<Trophy className="h-8 w-8" />}
          sport="football"
        />
        {/* Texte ligue + round superposé */}
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-3">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-white/90">{match.league.logo}</span>
            <span className="text-xs font-semibold text-white/80">{match.league.name}</span>
          </div>
          <div className="flex items-center gap-1 text-xs text-white/60">
            <Clock className="h-3 w-3" />
            <span>{formatKickoff(match.scheduledAt)}</span>
            <span className="hidden text-[10px] sm:inline">
              · {getDay(match.scheduledAt)}
            </span>
          </div>
        </div>
      </div>

      <div className="p-4 pt-3">
        {/* Round */}
        <div className="mb-2 text-center">
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            {match.round}
          </span>
        </div>

        {/* Teams */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          {/* Home */}
          <div className="flex flex-col items-center gap-1.5 text-center">
            <PlayerAvatar
              name={match.home.name}
              photoUrl={match.home.logo}
              color={match.home.color}
              size="lg"
              sport="football"
            />
            <span className="text-sm font-semibold leading-tight">{match.home.shortName}</span>
            <FormTimeline form={match.home.form} showIndex={false} size="sm" />
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
            <PlayerAvatar
              name={match.away.name}
              photoUrl={match.away.logo}
              color={match.away.color}
              size="lg"
              sport="football"
            />
            <span className="text-sm font-semibold leading-tight">{match.away.shortName}</span>
            <FormTimeline form={match.away.form} showIndex={false} size="sm" />
          </div>
        </div>

        {/* Prediction rings */}
        <div className="mt-3 flex items-center justify-center gap-2 sm:gap-3">
          <ConfidenceRing
            prob={p.homeProb}
            confidence={confidence}
            color="#10b981"
            size="sm"
            label="1"
          />
          <ConfidenceRing
            prob={p.drawProb}
            confidence={confidence}
            color="#f59e0b"
            size="sm"
            label="N"
          />
          <ConfidenceRing
            prob={p.awayProb}
            confidence={confidence}
            color="#ef4444"
            size="sm"
            label="2"
          />
        </div>

        {/* Prédictions Clés */}
        {predictionBadges.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {predictionBadges.map((badge) => {
              const isBest = badge.prob >= maxBadgeProb;
              return (
                <span
                  key={badge.key}
                  className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[11px] font-semibold transition-transform hover:scale-[1.02] ${
                    isBest
                      ? "border-emerald-500/40 bg-emerald-500/20 text-emerald-400"
                      : "border-border/60 bg-muted/50 text-muted-foreground hover:border-border/80 hover:bg-muted"
                  }`}
                >
                  {isBest && <TrendingUp className="h-3 w-3 shrink-0" />}
                  <span className="tabular-nums">{badge.label}</span>
                </span>
              );
            })}
          </div>
        )}

        {/* Comparatifs */}
        {p.teamComparisons && p.teamComparisons.length > 0 && (
          <div className="mt-3 border-t border-border/40 pt-3">
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              📊 Comparatifs
            </div>
            {p.teamComparisons.map((comp, i) => {
              const total = comp.homeProb + comp.awayProb;
              const homePct = total > 0 ? Math.round((comp.homeProb / total) * 100) : 50;
              const awayPct = 100 - homePct;
              return (
                <div key={i} className="mb-1 flex items-center gap-2">
                  <span className="w-20 shrink-0 text-right text-[10px] text-muted-foreground">
                    {comp.label}
                  </span>
                  <div className="flex h-2 flex-1 overflow-hidden rounded-full bg-muted/50">
                    <div
                      className="h-full bg-emerald-600 transition-all duration-300"
                      style={{ width: `${homePct}%` }}
                    />
                    <div
                      className="h-full bg-slate-600 transition-all duration-300"
                      style={{ width: `${awayPct}%` }}
                    />
                  </div>
                  <span className="w-16 shrink-0 text-left text-[10px] tabular-nums text-muted-foreground">
                    {homePct}% — {awayPct}%
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer: markets + CTA */}
        <div className="mt-3 flex items-center justify-between gap-2 border-t border-border/40 pt-3">
          <div className="flex flex-wrap gap-2 text-[10px] text-muted-foreground">
            {p.bttsProb > 0 && (
              <span className="rounded-md border border-border/60 bg-muted/50 px-1.5 py-0.5 font-medium tabular-nums">
                BTTS {p.bttsProb}%
              </span>
            )}
            {p.over25Prob > 0 && (
              <span className="rounded-md border border-border/60 bg-muted/50 px-1.5 py-0.5 font-medium tabular-nums">
                O2.5 {p.over25Prob}%
              </span>
            )}
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
      {/* Prédictions Clés skeleton */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <Skeleton className="h-5 w-20 rounded-lg" />
        <Skeleton className="h-5 w-20 rounded-lg" />
        <Skeleton className="h-5 w-20 rounded-lg" />
        <Skeleton className="h-5 w-16 rounded-lg" />
      </div>
      {/* Comparatifs skeleton */}
      <div className="mt-3 border-t border-border/40 pt-3">
        <Skeleton className="mb-2 h-3 w-20" />
        <div className="mb-1 flex items-center gap-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-2 flex-1 rounded-full" />
          <Skeleton className="h-3 w-16" />
        </div>
        <div className="mb-1 flex items-center gap-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-2 flex-1 rounded-full" />
          <Skeleton className="h-3 w-16" />
        </div>
        <div className="mb-1 flex items-center gap-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-2 flex-1 rounded-full" />
          <Skeleton className="h-3 w-16" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-2 flex-1 rounded-full" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-border/40 pt-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-6 w-16 rounded-lg" />
      </div>
    </div>
  );
}
