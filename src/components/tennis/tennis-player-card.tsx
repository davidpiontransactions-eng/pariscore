"use client";

import { memo, useReducedMotion } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { getFlagAssets } from "@/lib/flag-utils";
import type { TennisTop10Entry } from "@/lib/tennis-top10";

// ─── FORM SPARKLINE (mini SVG barres W/L) ─────────────────────────────────────

function FormBars({ form }: { form: ("W" | "L")[] }) {
  const reducedMotion = useReducedMotion();
  if (form.length === 0) return <span className="text-[10px] text-zinc-600">—</span>;

  return (
    <div className="flex gap-0.5 items-end h-4">
      {form.map((r, i) => (
        <motion.div
          key={i}
          initial={reducedMotion ? {} : { scaleY: 0 }}
          animate={{ scaleY: 1 }}
          transition={{ delay: i * 0.05 }}
          className={cn(
            "w-2 rounded-t-sm origin-bottom",
            r === "W" ? "bg-emerald-500" : "bg-red-500",
            i === form.length - 1 ? "h-4" : i === form.length - 2 ? "h-3" : "h-2"
          )}
        />
      ))}
    </div>
  );
}

// ─── MOMENTUM BAR ─────────────────────────────────────────────────────────────

function MomentumBar({ score }: { score: number }) {
  const color =
    score >= 80 ? "bg-emerald-500" :
    score >= 60 ? "bg-emerald-400" :
    score >= 40 ? "bg-amber-400" :
    score >= 20 ? "bg-orange-400" :
    "bg-red-500";

  return (
    <div className="flex items-center gap-1.5">
      <div className="h-1 w-12 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className={cn("h-full rounded-full transition-all duration-500", color)}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className="text-[10px] font-mono tabular-nums text-zinc-400">{score}</span>
    </div>
  );
}

// ─── RANK BADGE ───────────────────────────────────────────────────────────────

function RankBadge({ rank }: { rank: number }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 w-6 items-center justify-center rounded-lg text-[11px] font-bold tabular-nums",
        rank === 1 && "bg-amber-500/20 text-amber-400",
        rank === 2 && "bg-zinc-300/20 text-zinc-300",
        rank === 3 && "bg-amber-700/20 text-amber-600",
        rank > 3 && "bg-white/[0.04] text-zinc-500"
      )}
    >
      {rank}
    </span>
  );
}

// ─── METRIC VALUE ─────────────────────────────────────────────────────────────

function MetricValue({ value, label }: { value: number; label: string }) {
  const formatted = value >= 1000 ? Math.round(value).toLocaleString() : value.toFixed(value % 1 === 0 ? 0 : 1);
  return (
    <div className="text-right">
      <span className="text-lg font-bold text-zinc-100 tabular-nums">{formatted}</span>
      <span className="ml-1 text-[9px] text-zinc-500">{label}</span>
    </div>
  );
}

// ─── INSIGHT TAG ──────────────────────────────────────────────────────────────

function InsightTag({ insight }: { insight: string }) {
  const isHot = insight.includes("🔥") || insight.includes("🏆");
  const isCold = insight.includes("📉") || insight.includes("⚠️");

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-1.5 py-0.5 text-[9px] font-medium",
        isHot && "bg-emerald-500/10 text-emerald-400",
        isCold && "bg-red-500/10 text-red-400",
        !isHot && !isCold && "bg-white/[0.04] text-zinc-400"
      )}
    >
      {insight}
    </span>
  );
}

// ─── MAIN CARD ────────────────────────────────────────────────────────────────

export const TennisPlayerCard = memo(function TennisPlayerCard({
  entry,
  onClick,
}: {
  entry: TennisTop10Entry;
  onClick?: () => void;
}) {
  const { rank, player, metricValue, metricLabel, insight } = entry;
  const flag = player.country ? getFlagAssets(player.country) : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: rank * 0.04 }}
      onClick={onClick}
      className={cn(
        "group relative flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3",
        "hover:bg-white/[0.04] hover:border-white/[0.1] transition-all duration-200",
        "cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50",
        rank <= 3 && "border-emerald-500/10"
      )}
    >
      {/* Rank */}
      <RankBadge rank={rank} />

      {/* Photo / Initials */}
      <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-white/[0.06]">
        {player.photoUrl ? (
          <img
            src={player.photoUrl}
            alt={player.name}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm font-bold text-zinc-400">
            {player.shortName.slice(0, 2).toUpperCase()}
          </div>
        )}
        {/* Flag overlay */}
        {flag && (
          <span className="absolute -bottom-0.5 -right-0.5 text-[10px] leading-none" title={player.country}>
            {flag.emoji}
          </span>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-semibold text-zinc-100">{player.name}</span>
          {player.atpRank && (
            <span className="text-[9px] font-mono text-zinc-500">ATP#{player.atpRank}</span>
          )}
          {player.wtaRank && (
            <span className="text-[9px] font-mono text-pink-400/70">WTA#{player.wtaRank}</span>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-2">
          <MomentumBar score={player.momentumScore} />
          <FormBars form={player.form} />
        </div>
      </div>

      {/* Metric + Insight */}
      <div className="flex flex-col items-end gap-1">
        <MetricValue value={metricValue} label="" />
        <InsightTag insight={insight} />
      </div>
    </motion.div>
  );
});
