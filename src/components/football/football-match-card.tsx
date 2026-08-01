"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Clock, BarChart3, TrendingUp, Star, ChevronDown, ChevronUp } from "lucide-react";
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
  const predictionBadges: { key: string; label: string; prob: number; isTop: boolean }[] = [];
  if (p.doubleChance) {
    const isTop = p.doubleChance.prob >= 75;
    predictionBadges.push({
      key: "dc",
      label: `DC ${p.doubleChance.selection} (${p.doubleChance.prob}%)`,
      prob: p.doubleChance.prob,
      isTop,
    });
  }
  if (p.over15Prob !== undefined) {
    const isTop = p.over15Prob >= 75;
    predictionBadges.push({
      key: "o15",
      label: `O1.5 (${p.over15Prob}%)`,
      prob: p.over15Prob,
      isTop,
    });
  }
  if (p.under35Prob !== undefined) {
    const isTop = p.under35Prob >= 75;
    predictionBadges.push({
      key: "u35",
      label: `U3.5 (${p.under35Prob}%)`,
      prob: p.under35Prob,
      isTop,
    });
  }
  if (p.bttsProb > 0) {
    const isTop = p.bttsProb >= 75;
    predictionBadges.push({
      key: "btts",
      label: `BTTS (${p.bttsProb}%)`,
      prob: p.bttsProb,
      isTop,
    });
  }
  if (p.bestCornerOver) {
    const isTop = p.bestCornerOver.overProb >= 75;
    predictionBadges.push({
      key: "corners",
      label: `Corn. O${p.bestCornerOver.line} (${p.bestCornerOver.overProb}%)`,
      prob: p.bestCornerOver.overProb,
      isTop,
    });
  }
  const maxBadgeProb = predictionBadges.length > 0
    ? Math.max(...predictionBadges.map((b) => b.prob))
    : 0;

  // xG summary (expected goals — displayed between badges and comparatifs)
  const xGSummary = p.xGa && p.xGa.total > 0
    ? `xG: ${p.xGa.home.toFixed(2)} – ${p.xGa.away.toFixed(2)} (∑${p.xGa.total.toFixed(2)})`
    : null;

  // Radar accordion state
  const [radarOpen, setRadarOpen] = useState(false);

  // Build radar items from prediction + live data
  const radarItems: { label: string; homeVal: number; awayVal: number; icon: string; maxVal: number }[] = [];
  if (p.teamComparisons && p.teamComparisons.length > 0) {
    radarItems.push(
      ...p.teamComparisons.map((c) => ({
        label: c.label,
        homeVal: c.homeProb,
        awayVal: c.awayProb,
        icon: c.label.includes("Attaque") ? "⚽" : c.label.includes("Défense") ? "🛡️" : c.label.includes("Forme") ? "📈" : "📊",
        maxVal: 100,
      })),
    );
  }
  // Add possession from live if available
  if (match.live && match.live.homePossession > 0) {
    radarItems.push({
      label: "Possession",
      homeVal: match.live.homePossession,
      awayVal: 100 - match.live.homePossession,
      icon: "🎯",
      maxVal: 100,
    });
  }
  // Add xG metrics to radar
  if (p.xGa && p.xGa.total > 0) {
    radarItems.push({
      label: "xG attendu",
      homeVal: p.xGa.home,
      awayVal: p.xGa.away,
      icon: "📐",
      maxVal: Math.max(p.xGa.total, 4),
    });
  }
  // xGd badge label (nullable — only show when data available)
  const xGdLabel = p.xGd != null && p.xGd !== 0
    ? `xGd ${p.xGd > 0 ? "+" : ""}${(p.xGd * 100).toFixed(0)}%`
    : null;

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
            {(match.home.topScorer || match.home.topAssister || match.home.topDefender) && (
              <span className="flex flex-wrap items-center gap-x-1.5 text-[9px] leading-none text-muted-foreground">
                {match.home.topScorer && (
                  <span className="tabular-nums" title={`⚽ ${match.home.topScorer.name}`}>
                    ⚽{match.home.topScorer.goals}
                  </span>
                )}
                {match.home.topAssister && (
                  <span className="tabular-nums" title={`🎯 ${match.home.topAssister.name}`}>
                    🎯{match.home.topAssister.assists}
                  </span>
                )}
                {match.home.topDefender && (
                  <span className="tabular-nums" title={`🛡️ ${match.home.topDefender.name}`}>
                    🛡️{match.home.topDefender.tackles}
                  </span>
                )}
              </span>
            )}
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
            {(match.away.topScorer || match.away.topAssister || match.away.topDefender) && (
              <span className="flex flex-wrap items-center gap-x-1.5 text-[9px] leading-none text-muted-foreground">
                {match.away.topScorer && (
                  <span className="tabular-nums" title={`⚽ ${match.away.topScorer.name}`}>
                    ⚽{match.away.topScorer.goals}
                  </span>
                )}
                {match.away.topAssister && (
                  <span className="tabular-nums" title={`🎯 ${match.away.topAssister.name}`}>
                    🎯{match.away.topAssister.assists}
                  </span>
                )}
                {match.away.topDefender && (
                  <span className="tabular-nums" title={`🛡️ ${match.away.topDefender.name}`}>
                    🛡️{match.away.topDefender.tackles}
                  </span>
                )}
              </span>
            )}
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
          <div className="mt-3 overflow-x-auto scrollbar-none -mx-1 px-1">
            <div className="flex flex-nowrap items-center gap-1.5 sm:flex-wrap min-w-max sm:min-w-0">
              {predictionBadges.map((badge) => {
                const isBest = badge.prob >= maxBadgeProb;
                return (
                  <motion.span
                    key={badge.key}
                    initial={badge.isTop ? { scale: 0.9, opacity: 0 } : false}
                    animate={badge.isTop ? { scale: [1, 1.05, 1], opacity: 1 } : { opacity: 1 }}
                    transition={badge.isTop ? { scale: { repeat: Infinity, repeatDelay: 3, duration: 0.8 }, opacity: { duration: 0.4 } } : undefined}
                    className={`inline-flex shrink-0 items-center gap-1 rounded-lg border px-2 py-0.5 text-[11px] font-semibold transition-transform hover:scale-[1.02] ${
                      badge.isTop
                        ? "border-amber-500/50 bg-amber-500/15 text-amber-400 shadow-sm shadow-amber-500/10"
                        : isBest
                          ? "border-emerald-500/40 bg-emerald-500/20 text-emerald-400"
                          : "border-border/60 bg-muted/50 text-muted-foreground hover:border-border/80 hover:bg-muted"
                    }`}
                  >
                    {badge.isTop && <Star className="h-3 w-3 shrink-0 text-amber-400" />}
                    {!badge.isTop && isBest && <TrendingUp className="h-3 w-3 shrink-0" />}
                    <span className="tabular-nums">{badge.label}</span>
                  </motion.span>
                );
              })}
            </div>
          </div>
        )}

        {/* Innovation 1: Key Players Matchup */}
        {((match.home.topScorer && match.away.topDefender) || (match.away.topScorer && match.home.topDefender)) && (
          <div className="mt-2 border-t border-border/30 pt-2">
            <div className="mb-1.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-amber-400">
              <span>⚔️</span>
              <span>Duel du match</span>
            </div>
            {match.home.topScorer && match.away.topDefender && (
              <div className="flex items-center gap-2 text-[10px]">
                <span className="flex w-[45%] items-center gap-1 text-right">
                  <span className="truncate text-emerald-400" title={`⚽ ${match.home.topScorer.name}`}>
                    {match.home.topScorer.name}
                  </span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">⚽{match.home.topScorer.goals}</span>
                </span>
                <span className="shrink-0 text-[9px] font-bold tracking-wider text-amber-500/70">VS</span>
                <span className="flex w-[45%] items-center gap-1">
                  <span className="shrink-0 tabular-nums text-muted-foreground">🛡️{match.away.topDefender.tackles}</span>
                  <span className="truncate text-rose-400" title={`🛡️ ${match.away.topDefender.name}`}>
                    {match.away.topDefender.name}
                  </span>
                </span>
              </div>
            )}
            {match.away.topScorer && match.home.topDefender && (
              <div className="mt-1 flex items-center gap-2 text-[10px]">
                <span className="flex w-[45%] items-center gap-1 text-right">
                  <span className="truncate text-emerald-400" title={`⚽ ${match.away.topScorer.name}`}>
                    {match.away.topScorer.name}
                  </span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">⚽{match.away.topScorer.goals}</span>
                </span>
                <span className="shrink-0 text-[9px] font-bold tracking-wider text-amber-500/70">VS</span>
                <span className="flex w-[45%] items-center gap-1">
                  <span className="shrink-0 tabular-nums text-muted-foreground">🛡️{match.home.topDefender.tackles}</span>
                  <span className="truncate text-rose-400" title={`🛡️ ${match.home.topDefender.name}`}>
                    {match.home.topDefender.name}
                  </span>
                </span>
              </div>
            )}
          </div>
        )}

        {/* Innovation 2: xG Differential Gauge */}
        {xGSummary && p.xGa && p.xGa.total > 0 ? (
          <div className="mt-2 border-t border-border/30 pt-2">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">📐 Efficience xG</span>
              {p.xGd != null && (
                <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
                  p.xGd > 0.05
                    ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                    : p.xGd < -0.05
                      ? "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                      : "bg-muted/40 text-muted-foreground border border-border/40"
                }`}>
                  {xGdLabel}
                </span>
              )}
            </div>
            {/* Barre différentielle xG créés vs xG concédés */}
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted/40">
              <div
                className="h-full bg-gradient-to-r from-emerald-600 via-slate-500 to-rose-600 transition-all duration-500"
                style={{
                  width: `${Math.round((p.xGa.home / Math.max(p.xGa.total, 0.01)) * 100)}%`,
                }}
              />
            </div>
            <div className="mt-1 flex justify-between text-[9px] text-muted-foreground/70">
              <span>{match.home.shortName} {p.xGa.home.toFixed(2)}</span>
              <span>∑{p.xGa.total.toFixed(2)}</span>
              <span>{p.xGa.away.toFixed(2)} {match.away.shortName}</span>
            </div>
            {/* Label qualitatif */}
            {p.xGd != null && (
              <div className="mt-1 text-center">
                <span className={`text-[10px] font-medium ${
                  p.xGd > 0.05
                    ? "text-emerald-500"
                    : p.xGd < -0.05
                      ? "text-rose-500"
                      : "text-muted-foreground"
                }`}>
                  {p.xGd > 0.05
                    ? `↗ Sur-performance offensive ${match.home.shortName}`
                    : p.xGd < -0.05
                      ? `↘ Fragilité défensive ${match.home.shortName}`
                      : "↔ Équilibré"}
                </span>
              </div>
            )}
          </div>
        ) : xGSummary ? (
          /* Fallback quand xGa est absent */
          <div className="mt-2 flex items-center gap-1.5 rounded-md border border-border/40 bg-muted/30 px-2 py-1.5 text-[10px] text-muted-foreground">
            <span>📐</span>
            <span>{xGSummary}</span>
          </div>
        ) : null}

        {/* Comparatifs + Radar accordéon */}
        {(p.teamComparisons && p.teamComparisons.length > 0) || radarItems.length > 0 ? (
          <div className="mt-3 border-t border-border/40 pt-3">
            {/* Comparatifs inline (toujours visibles) */}
            {p.teamComparisons && p.teamComparisons.length > 0 && (
              <div className="mb-2">
                <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  📊 Comparatifs
                </div>
                {p.teamComparisons.map((comp) => {
                  const total = comp.homeProb + comp.awayProb;
                  const homePct = total > 0 ? Math.round((comp.homeProb / total) * 100) : 50;
                  const awayPct = 100 - homePct;
                  return (
                    <div key={comp.label} className="mb-1 flex items-center gap-2">
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

            {/* Radar Micro-Analysis (accordéon) */}
            {radarItems.length > 0 && (
              <div>
                <button
                  onClick={() => setRadarOpen(!radarOpen)}
                  className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground transition-colors hover:bg-muted/50"
                >
                  <span>🔬 Micro-Analysis Radar</span>
                  {radarOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </button>
                <AnimatePresence>
                  {radarOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: "easeInOut" }}
                      className="overflow-hidden"
                    >
                      <div className="space-y-2 pb-1 pt-2">
                        {radarItems.map((item) => {
                          const homePct = Math.round((item.homeVal / item.maxVal) * 100);
                          const awayPct = Math.round((item.awayVal / item.maxVal) * 100);
                          const homeDom = homePct > awayPct;
                          return (
                            <div key={item.label} className="flex items-center gap-2">
                              <span className="w-5 text-center text-[11px]">{item.icon}</span>
                              <span className="w-20 shrink-0 text-right text-[10px] text-muted-foreground">
                                {item.label}
                              </span>
                              <div className="flex h-3 flex-1 overflow-hidden rounded-full bg-muted/30">
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${homePct}%` }}
                                  transition={{ duration: 0.6, ease: "easeOut" }}
                                  className={`h-full ${homeDom ? "bg-emerald-500" : "bg-slate-500"} relative`}
                                >
                                  <span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold text-white/90 tabular-nums">
                                    {homePct > 25 ? `${homePct}%` : ""}
                                  </span>
                                </motion.div>
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${awayPct}%` }}
                                  transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}
                                  className={`h-full ${!homeDom ? "bg-rose-500" : "bg-slate-600"} relative`}
                                >
                                  <span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold text-white/90 tabular-nums">
                                    {awayPct > 25 ? `${awayPct}%` : ""}
                                  </span>
                                </motion.div>
                              </div>
                              <span className="w-8 shrink-0 text-left text-[10px] tabular-nums text-muted-foreground">
                                {homeDom ? "🏠" : "✈️"}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
        ) : null}

        {/* Footer: CTA */}
        <div className="mt-3 flex items-center justify-end gap-2 border-t border-border/40 pt-3">
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
      {/* Prédictions Clés skeleton — mix normal + 1 top confiance */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <Skeleton className="h-5 w-16 rounded-lg bg-amber-500/20" />
        <Skeleton className="h-5 w-20 rounded-lg" />
        <Skeleton className="h-5 w-20 rounded-lg" />
        <Skeleton className="h-5 w-16 rounded-lg" />
      </div>
      {/* Key Players Matchup skeleton */}
      <div className="mt-2 border-t border-border/30 pt-2">
        <Skeleton className="mb-1.5 h-3 w-24" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-6" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
      {/* xG Differential skeleton */}
      <div className="mt-2 border-t border-border/30 pt-2">
        <div className="mb-1 flex items-center justify-between">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-4 w-12 rounded-md" />
        </div>
        <Skeleton className="h-2 w-full rounded-full" />
        <div className="mt-1 flex justify-between">
          <Skeleton className="h-2 w-16" />
          <Skeleton className="h-2 w-10" />
          <Skeleton className="h-2 w-16" />
        </div>
        <Skeleton className="mx-auto mt-1 h-3 w-40" />
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
      {/* Radar accordéon skeleton */}
      <div className="mt-2 flex items-center gap-2 rounded-lg px-2 py-1.5">
        <Skeleton className="h-3 w-32" />
      </div>
      {/* Footer: CTA */}
      <div className="mt-3 flex items-center justify-end border-t border-border/40 pt-3">
        <Skeleton className="h-7 w-20 rounded-lg" />
      </div>
    </div>
  );
}
