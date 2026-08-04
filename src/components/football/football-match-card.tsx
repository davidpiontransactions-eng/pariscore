"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trophy, Clock, BarChart3, TrendingUp, Star, ChevronDown, ChevronUp,
  Home, PlaneTakeoff, Target, Shield, Activity, Microscope, Zap, Users,
  CornerDownRight,
} from "lucide-react";
import type { FootballMatch, Prediction, TeamStandingStats } from "@/lib/football-data";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfidenceRing } from "@/components/shared/confidence-ring";
import { FormTimeline } from "@/components/shared/form-timeline";
import { SportImage } from "@/components/ui/sport-image";
import { PlayerAvatar } from "@/components/ui/player-avatar";
import { getLeagueBanner } from "@/lib/sport-images";
import { countryFlag } from "@/lib/bsd-football-fetcher";

import { MetricComparePanel } from "@/components/football/MetricComparePanel";
import { MetricLeaderboardTable } from "@/components/football/MetricLeaderboardTable";
import { WatchButton } from "@/components/shared/watch-button";

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

// ─── Form Momentum Sparkline (Innovation 3) ───────────────────────────────

function FormMomentumSparkline({ values, trend }: { values: number[]; trend: "up" | "down" | "stable" }) {
  const W = 60;
  const H = 20;
  const PAD_B = 2;
  const PLOT_H = H - PAD_B;
  const n = values.length;
  const maxV = Math.max(...values, 1);

  const points = values.map((v, i) => ({
    x: Math.round((i / Math.max(n - 1, 1)) * W),
    y: Math.round(PLOT_H - (v / maxV) * PLOT_H),
  }));

  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const trendColor = trend === "up" ? "#10b981" : trend === "down" ? "#ef4444" : "#6b7280";

  return (
    <svg width={W} height={H} className="shrink-0" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Tendance: ${trend}`}>
      {pathD && (
        <path d={pathD} fill="none" stroke={trendColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.8" />
      )}
      {points.length > 0 && (
        <circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} r="1.5" fill={trendColor} />
      )}
    </svg>
  );
}

// ─── Classement Domicile / Extérieur (helpers) ─────────────────────────────────

function fmtSigned(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
}

/** Cellule valeur par défaut (aligne à gauche pour home, à droite pour away). */
function StandingStatRow({ label, home, away }: { label: string; home: React.ReactNode; away: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1 px-2 py-1">
      <span className="text-left text-[10px] font-medium tabular-nums text-foreground">{home}</span>
      <span className="text-[9px] text-muted-foreground/50">{label}</span>
      <span className="text-right text-[10px] font-medium tabular-nums text-foreground">{away}</span>
    </div>
  );
}

/** PPG + badge de rang discret (#rank/rankTotal). */
function PpgCell({ s }: { s: TeamStandingStats }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="tabular-nums">{s.ppg.toFixed(2)} PPG</span>
      <span className="rounded bg-muted px-1 py-px text-[8px] font-medium text-muted-foreground tabular-nums">
        #{s.rank}/{s.rankTotal}
      </span>
    </span>
  );
}

// ─── Main Card ────────────────────────────────────────────────────────────

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
  // Bilan réel Domicile/Extérieur (MJ, Pts, PPG+Rang, GD) — cf. standingStats.
  const standing = p.standingStats;
  // Derive confidence from max probability if not explicitly provided (0.5–0.8 range)
  const maxProb = Math.max(p.homeProb, p.drawProb, p.awayProb);
  const confidence = (p as Prediction & { confidence?: number }).confidence ?? (0.5 + (maxProb / 100) * 0.3);

  // Métriques par catégorie (Général / Buts / Tirs / Attaques / Corners) — sub-tab panel.
  const metrics = p.metricStats;
  const [showRankings, setShowRankings] = useState(false);

  // Collect prediction badges for the "Prédictions Clés" section
  const predictionBadges = useMemo(() => {
    const badges: { key: string; label: string; prob: number; isTop: boolean }[] = [];
    if (p.doubleChance) {
      badges.push({
        key: "dc",
        label: `DC ${p.doubleChance.selection} (${p.doubleChance.prob}%)`,
        prob: p.doubleChance.prob,
        isTop: p.doubleChance.prob >= 75,
      });
    }
    if (p.over15Prob !== undefined) {
      badges.push({
        key: "o15",
        label: `O1.5 (${p.over15Prob}%)`,
        prob: p.over15Prob,
        isTop: p.over15Prob >= 75,
      });
    }
    if (p.under35Prob !== undefined) {
      badges.push({
        key: "u35",
        label: `U3.5 (${p.under35Prob}%)`,
        prob: p.under35Prob,
        isTop: p.under35Prob >= 75,
      });
    }
    if (p.bttsProb > 0) {
      badges.push({
        key: "btts",
        label: `BTTS (${p.bttsProb}%)`,
        prob: p.bttsProb,
        isTop: p.bttsProb >= 75,
      });
    }
    if (p.bestCornerOver) {
      badges.push({
        key: "corners",
        label: `Corn. O${p.bestCornerOver.line} (${p.bestCornerOver.overProb}%)`,
        prob: p.bestCornerOver.overProb,
        isTop: p.bestCornerOver.overProb >= 75,
      });
    }
    return badges;
  }, [p.doubleChance, p.over15Prob, p.under35Prob, p.bttsProb, p.bestCornerOver]);
  const maxBadgeProb = predictionBadges.length > 0
    ? Math.max(...predictionBadges.map((b) => b.prob))
    : 0;

  // xG summary (expected goals — displayed between badges and comparatifs)
  const xGSummary = useMemo(() => (
    p.xGa && p.xGa.total > 0
      ? `xG: ${p.xGa.home.toFixed(2)} – ${p.xGa.away.toFixed(2)} (∑${p.xGa.total.toFixed(2)})`
      : null
  ), [p.xGa]);

  // Radar accordion state
  const [radarOpen, setRadarOpen] = useState(false);

  // Build radar items from prediction + live data
  const radarItems = useMemo(() => {
    const items: { label: string; homeVal: number; awayVal: number; icon: React.ReactNode; maxVal: number }[] = [];
    if (p.teamComparisons && p.teamComparisons.length > 0) {
      const iconMap: Record<string, React.ReactNode> = {
        "Attaque": <Zap className="h-3 w-3 text-amber-400" />,
        "Défense": <Shield className="h-3 w-3 text-sky-400" />,
        "Forme": <TrendingUp className="h-3 w-3 text-emerald-400" />,
      };
      items.push(
        ...p.teamComparisons.map((c) => ({
          label: c.label,
          homeVal: c.homeProb,
          awayVal: c.awayProb,
          icon: iconMap[c.label] ?? <Activity className="h-3 w-3 text-muted-foreground" />,
          maxVal: 100,
        })),
      );
    }
    // Add possession from live if available
    if (match.live && match.live.homePossession > 0) {
      items.push({
        label: "Possession",
        homeVal: match.live.homePossession,
        awayVal: 100 - match.live.homePossession,
        icon: <Target className="h-3 w-3 text-violet-400" />,
        maxVal: 100,
      });
    }
    // Add xG metrics to radar
    if (p.xGa && p.xGa.total > 0) {
      items.push({
        label: "xG attendu",
        homeVal: p.xGa.home,
        awayVal: p.xGa.away,
        icon: <Activity className="h-3 w-3 text-cyan-400" />,
        maxVal: Math.max(p.xGa.total, 4),
      });
    }
    return items;
  }, [p.teamComparisons, p.xGa, match.live]);
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
            {match.league.logo && !match.league.logo.startsWith("http") ? (
              <span className="text-xs font-bold text-white/90">{match.league.logo}</span>
            ) : (
              <span className="text-xs font-bold text-white/90">{countryFlag(match.league.country)}</span>
            )}
            {match.league.logo && match.league.logo.startsWith("http") && (
              <img src={match.league.logo} alt="" className="h-4 w-4 shrink-0 object-contain brightness-125" onError={(e) => { e.currentTarget.style.display = "none"; }} />
            )}
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
        {/* Round + Innovation badges */}
        <div className="mb-2 flex flex-col items-center gap-1">
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            {match.round}
          </span>
          {/* Innovation 1 — xP badge */}
          {p.xpDiff != null && (
            <span className={`rounded-md px-1.5 py-0.5 text-[9px] font-bold tabular-nums ${
              p.xpDiff > 0
                ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                : p.xpDiff < 0
                  ? "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                  : "bg-muted/40 text-muted-foreground border border-border/40"
            }`}>
              xP {p.xpDiff > 0 ? "+" : ""}{p.xpDiff.toFixed(1)}
            </span>
          )}
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
            {/* Innovation 3 — Form Momentum sparkline */}
            {p.formMomentum?.home && p.formMomentum.home.values.length >= 3 && (
              <FormMomentumSparkline
                values={p.formMomentum.home.values}
                trend={p.formMomentum.home.trend}
              />
            )}
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
            {/* Innovation 3 — Form Momentum sparkline */}
            {p.formMomentum?.away && p.formMomentum.away.values.length >= 3 && (
              <FormMomentumSparkline
                values={p.formMomentum.away.values}
                trend={p.formMomentum.away.trend}
              />
            )}
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

        {/* Innovation badges — Referee xCards + Set-Piece Edge */}
        {(p.refereeCardRisk || p.setPieceEdge != null) && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {p.refereeCardRisk && (
              <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-medium border ${
                p.refereeCardRisk.label === "élevé"
                  ? "border-red-500/40 bg-red-500/10 text-red-400"
                  : p.refereeCardRisk.label === "faible"
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                    : "border-amber-500/40 bg-amber-500/10 text-amber-400"
              }`}>
                <Shield className="h-2.5 w-2.5" />
                Arbitre {p.refereeCardRisk.label === "élevé" ? "sévère" : p.refereeCardRisk.label === "faible" ? "permissif" : "modéré"}
              </span>
            )}
            {p.setPieceEdge != null && (
              <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-medium border ${
                p.setPieceEdge > 0.05
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                  : p.setPieceEdge < -0.05
                    ? "border-rose-500/40 bg-rose-500/10 text-rose-400"
                    : "border-border/60 bg-muted/50 text-muted-foreground"
              }`}>
                <CornerDownRight className="h-2.5 w-2.5" />
                CPA {p.setPieceEdge > 0 ? "+" : ""}{Math.round(p.setPieceEdge * 100)}%
              </span>
            )}
          </div>
        )}

        {/* Key Players — 3 rôles par équipe avec avatars */}
        {(match.home.topScorer || match.home.topAssister || match.home.topDefender ||
          match.away.topScorer || match.away.topAssister || match.away.topDefender) && (
          <div className="mt-2 border-t border-border/30 pt-2">
            <div className="mb-1.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-amber-400">
              <Users className="h-3 w-3" />
              <span>Joueurs Clés</span>
            </div>
            {/* Home team */}
            <div className="grid grid-cols-3 gap-1.5">
              <div className="flex flex-col items-center rounded-lg bg-emerald-500/5 px-1.5 py-1.5 text-center">
                {match.home.topScorer ? (
                  <>
                    <PlayerAvatar name={match.home.topScorer.name} photoUrl={match.home.topScorer.photoUrl} color="#10b981" size="sm" sport="football" />
                    <span className="mt-1 text-[8px] font-semibold truncate w-full text-emerald-400">{match.home.topScorer.name}</span>
                    <span className="text-[8px] tabular-nums text-muted-foreground">⚽ {match.home.topScorer.goals} buts</span>
                    {match.home.topScorer.xgPerMatch != null && (
                      <span className="text-[7px] text-muted-foreground/50 tabular-nums">xG {match.home.topScorer.xgPerMatch.toFixed(1)}/m</span>
                    )}
                  </>
                ) : (
                  <span className="py-2 text-[10px] text-muted-foreground/30">—</span>
                )}
              </div>
              <div className="flex flex-col items-center rounded-lg bg-sky-500/5 px-1.5 py-1.5 text-center">
                {match.home.topAssister ? (
                  <>
                    <PlayerAvatar name={match.home.topAssister.name} photoUrl={match.home.topAssister.photoUrl} color="#0ea5e9" size="sm" sport="football" />
                    <span className="mt-1 text-[8px] font-semibold truncate w-full text-sky-400">{match.home.topAssister.name}</span>
                    <span className="text-[8px] tabular-nums text-muted-foreground">🎯 {match.home.topAssister.assists} passes</span>
                    {match.home.topAssister.keyPasses != null && (
                      <span className="text-[7px] text-muted-foreground/50 tabular-nums">KP {match.home.topAssister.keyPasses.toFixed(1)}/m</span>
                    )}
                  </>
                ) : (
                  <span className="py-2 text-[10px] text-muted-foreground/30">—</span>
                )}
              </div>
              <div className="flex flex-col items-center rounded-lg bg-violet-500/5 px-1.5 py-1.5 text-center">
                {match.home.topDefender ? (
                  <>
                    <PlayerAvatar name={match.home.topDefender.name} photoUrl={match.home.topDefender.photoUrl} color="#8b5cf6" size="sm" sport="football" />
                    <span className="mt-1 text-[8px] font-semibold truncate w-full text-violet-400">{match.home.topDefender.name}</span>
                    <span className="text-[8px] tabular-nums text-muted-foreground">🛡️ {match.home.topDefender.tackles} tacles</span>
                    {match.home.topDefender.duelsWonPct != null && (
                      <span className="text-[7px] text-muted-foreground/50 tabular-nums">Duels {match.home.topDefender.duelsWonPct}%</span>
                    )}
                  </>
                ) : (
                  <span className="py-2 text-[10px] text-muted-foreground/30">—</span>
                )}
              </div>
            </div>
            {/* Away team */}
            <div className="mt-1.5 grid grid-cols-3 gap-1.5">
              <div className="flex flex-col items-center rounded-lg bg-rose-500/5 px-1.5 py-1.5 text-center">
                {match.away.topScorer ? (
                  <>
                    <PlayerAvatar name={match.away.topScorer.name} photoUrl={match.away.topScorer.photoUrl} color="#f43f5e" size="sm" sport="football" />
                    <span className="mt-1 text-[8px] font-semibold truncate w-full text-rose-400">{match.away.topScorer.name}</span>
                    <span className="text-[8px] tabular-nums text-muted-foreground">⚽ {match.away.topScorer.goals} buts</span>
                    {match.away.topScorer.xgPerMatch != null && (
                      <span className="text-[7px] text-muted-foreground/50 tabular-nums">xG {match.away.topScorer.xgPerMatch.toFixed(1)}/m</span>
                    )}
                  </>
                ) : (
                  <span className="py-2 text-[10px] text-muted-foreground/30">—</span>
                )}
              </div>
              <div className="flex flex-col items-center rounded-lg bg-sky-500/5 px-1.5 py-1.5 text-center">
                {match.away.topAssister ? (
                  <>
                    <PlayerAvatar name={match.away.topAssister.name} photoUrl={match.away.topAssister.photoUrl} color="#0ea5e9" size="sm" sport="football" />
                    <span className="mt-1 text-[8px] font-semibold truncate w-full text-sky-400">{match.away.topAssister.name}</span>
                    <span className="text-[8px] tabular-nums text-muted-foreground">🎯 {match.away.topAssister.assists} passes</span>
                    {match.away.topAssister.keyPasses != null && (
                      <span className="text-[7px] text-muted-foreground/50 tabular-nums">KP {match.away.topAssister.keyPasses.toFixed(1)}/m</span>
                    )}
                  </>
                ) : (
                  <span className="py-2 text-[10px] text-muted-foreground/30">—</span>
                )}
              </div>
              <div className="flex flex-col items-center rounded-lg bg-violet-500/5 px-1.5 py-1.5 text-center">
                {match.away.topDefender ? (
                  <>
                    <PlayerAvatar name={match.away.topDefender.name} photoUrl={match.away.topDefender.photoUrl} color="#8b5cf6" size="sm" sport="football" />
                    <span className="mt-1 text-[8px] font-semibold truncate w-full text-violet-400">{match.away.topDefender.name}</span>
                    <span className="text-[8px] tabular-nums text-muted-foreground">🛡️ {match.away.topDefender.tackles} tacles</span>
                    {match.away.topDefender.duelsWonPct != null && (
                      <span className="text-[7px] text-muted-foreground/50 tabular-nums">Duels {match.away.topDefender.duelsWonPct}%</span>
                    )}
                  </>
                ) : (
                  <span className="py-2 text-[10px] text-muted-foreground/30">—</span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Innovation 2: xG Differential Gauge */}
        {xGSummary && p.xGa && p.xGa.total > 0 ? (
          <div className="mt-2 border-t border-border/30 pt-2">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                <TrendingUp className="mr-1 inline-block h-3 w-3 text-cyan-400" />
                Efficience xG
              </span>
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
                  <BarChart3 className="mr-1 inline-block h-3 w-3 text-amber-400" />
                  Comparatifs
                </div>
                {p.teamComparisons.map((comp) => {
                  const total = comp.homeProb + comp.awayProb;
                  const homePct = total > 0 ? Math.round((comp.homeProb / total) * 100) : 50;
                  const awayPct = 100 - homePct;
                  const seasonStat = p.teamSeasonStats?.find((s) => s.label === comp.label);
                  return (
                    <div key={comp.label} className="mb-1 flex flex-col">
                      <div className="flex items-center gap-2">
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
                      {/* League stats sub-row */}
                      {seasonStat && (
                        <div className="flex items-center gap-2 pl-[80px] text-[8px] text-muted-foreground/60">
                          <span className="inline-flex items-center gap-0.5">
                            <Home className="h-2.5 w-2.5 text-emerald-500/60" />
                            <span className="tabular-nums">{seasonStat.homeAvg.toFixed(1)}/m</span>
                            {/* Badge rang uniquement pour un rang réel (jamais simulé) — cf. computeTeamSeasonStats : null = indisponible */}
                            {seasonStat.homeRank != null && seasonStat.homeRankTotal > 0 && (
                              <span className="text-muted-foreground/40">(#{seasonStat.homeRank}/{seasonStat.homeRankTotal})</span>
                            )}
                          </span>
                          <span className="text-muted-foreground/30">—</span>
                          <span className="inline-flex items-center gap-0.5">
                            <PlaneTakeoff className="h-2.5 w-2.5 text-rose-500/60" />
                            <span className="tabular-nums">{seasonStat.awayAvg.toFixed(1)}/m</span>
                            {seasonStat.awayRank != null && seasonStat.awayRankTotal > 0 && (
                              <span className="text-muted-foreground/40">(#{seasonStat.awayRank}/{seasonStat.awayRankTotal})</span>
                            )}
                          </span>
                        </div>
                      )}
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
                  <span>
                    <Microscope className="mr-1 inline-block h-3 w-3 text-violet-400" />
                    Micro-Analysis Radar
                  </span>
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
                                {homeDom ? (
                                  <Home className="inline-block h-3 w-3 text-emerald-500/70" />
                                ) : (
                                  <PlaneTakeoff className="inline-block h-3 w-3 text-rose-500/70" />
                                )}
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

        {/* Classement Domicile / Extérieur — bilan réel (MJ, Pts, PPG+Rang, GD) */}
        {standing && (
          <div className="mt-3 border-t border-border/40 pt-3">
            <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <BarChart3 className="mr-1 inline-block h-3 w-3 text-amber-400" />
              Classement (Dom / Ext)
            </div>
            <div className="overflow-hidden rounded-lg border border-border/40">
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1 border-b border-border/40 bg-muted/30 px-2 py-1 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                <span className="flex items-center gap-1 truncate">
                  <Home className="h-3 w-3 shrink-0 text-emerald-500" />
                  <span className="truncate">{match.home.shortName || match.home.name}</span>
                </span>
                <span className="text-[8px] text-muted-foreground/40">vs</span>
                <span className="flex items-center justify-end gap-1 truncate">
                  <span className="truncate">{match.away.shortName || match.away.name}</span>
                  <PlaneTakeoff className="h-3 w-3 shrink-0 text-rose-500" />
                </span>
              </div>
              <div className="divide-y divide-border/30">
                <StandingStatRow label="MJ (Dom/Ext)" home={`${standing.home.played} MJ`} away={`${standing.away.played} MJ`} />
                <StandingStatRow label="Points" home={`${standing.home.points} pts`} away={`${standing.away.points} pts`} />
                <StandingStatRow label="PPG + Rang" home={<PpgCell s={standing.home} />} away={<PpgCell s={standing.away} />} />
                <StandingStatRow label="GD" home={fmtSigned(standing.home.goalDiff)} away={fmtSigned(standing.away.goalDiff)} />
              </div>
            </div>
            {(standing.home.partial || standing.away.partial) && (
              <div className="mt-1.5 flex items-center gap-1 text-[9px] text-muted-foreground">
                <span aria-hidden="true">⚠️</span>
                <span>Données partielles — championnat en début de saison (&lt; 3 matchs)</span>
              </div>
            )}
          </div>
        )}

        {/* Métriques par catégorie (Général / Buts / Tirs / Attaques / Corners / Classements) */}
        {metrics && (
          <>
            <MetricComparePanel
              home={metrics.home}
              away={metrics.away}
              partial={metrics.partial}
              onRankingsTab={() => setShowRankings(true)}
            />
            {showRankings && p.metricRankings && (
              <MetricLeaderboardTable
                rankings={p.metricRankings}
                homeTeamName={match.home.name}
                awayTeamName={match.away.name}
              />
            )}
            {showRankings && !p.metricRankings && (
              <div className="mt-2 rounded-lg border border-border/40 p-2 text-center text-[9px] text-muted-foreground">
                Classements indisponibles pour cette ligue.
              </div>
            )}
          </>
        )}

        {/* Footer: CTA */}
        <div className="mt-3 flex items-center justify-end gap-2 border-t border-border/40 pt-3">
          <WatchButton
            sport="football"
            home={match.home.shortName || match.home.name}
            away={match.away.shortName || match.away.name}
            label="Visionner"
            variant="subtle"
          />
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
      {/* Key Players skeleton — 3 colonnes × 2 équipes */}
      <div className="mt-2 border-t border-border/30 pt-2">
        <Skeleton className="mb-1.5 h-3 w-24" />
        {/* Home team */}
        <div className="grid grid-cols-3 gap-1.5">
          <div className="flex flex-col items-center gap-1 rounded-lg bg-muted/20 px-1.5 py-1.5">
            <Skeleton className="h-7 w-7 rounded-full" />
            <Skeleton className="h-2 w-14" />
            <Skeleton className="h-1.5 w-10" />
          </div>
          <div className="flex flex-col items-center gap-1 rounded-lg bg-muted/20 px-1.5 py-1.5">
            <Skeleton className="h-7 w-7 rounded-full" />
            <Skeleton className="h-2 w-14" />
            <Skeleton className="h-1.5 w-10" />
          </div>
          <div className="flex flex-col items-center gap-1 rounded-lg bg-muted/20 px-1.5 py-1.5">
            <Skeleton className="h-7 w-7 rounded-full" />
            <Skeleton className="h-2 w-14" />
            <Skeleton className="h-1.5 w-10" />
          </div>
        </div>
        {/* Away team */}
        <div className="mt-1.5 grid grid-cols-3 gap-1.5">
          <div className="flex flex-col items-center gap-1 rounded-lg bg-muted/20 px-1.5 py-1.5">
            <Skeleton className="h-7 w-7 rounded-full" />
            <Skeleton className="h-2 w-14" />
            <Skeleton className="h-1.5 w-10" />
          </div>
          <div className="flex flex-col items-center gap-1 rounded-lg bg-muted/20 px-1.5 py-1.5">
            <Skeleton className="h-7 w-7 rounded-full" />
            <Skeleton className="h-2 w-14" />
            <Skeleton className="h-1.5 w-10" />
          </div>
          <div className="flex flex-col items-center gap-1 rounded-lg bg-muted/20 px-1.5 py-1.5">
            <Skeleton className="h-7 w-7 rounded-full" />
            <Skeleton className="h-2 w-14" />
            <Skeleton className="h-1.5 w-10" />
          </div>
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
      {/* Classement Dom/Ext skeleton */}
      <div className="mt-2 border-t border-border/40 pt-2">
        <Skeleton className="mb-2 h-3 w-28" />
        <div className="overflow-hidden rounded-lg border border-border/40">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="grid grid-cols-[1fr_auto_1fr] items-center gap-1 px-2 py-1.5">
              <Skeleton className="h-2.5 w-14" />
              <Skeleton className="h-2 w-16" />
              <Skeleton className="h-2.5 w-14" />
            </div>
          ))}
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
