"use client";

/**
 * HockeyHeroHeader — Encart haut de page onglet Hockey.
 * Phrase d'accroche + ROI par stratégie (Winner, Over/Under, Buteurs).
 * Données backtest hockey absentes → ROI affichés en attente, structure prête.
 */

import { useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Trophy, Target, Zap, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Stratégies hockey suivies ───────────────────────────────────────────────
// ROI réels à brancher dès que le backtest hockey existe (data/top5-backtest/hockey.json).
// En attendant : badge neutre "—" + mention backtest en cours.
type HockeyStrategy = {
  key: string;
  label: string;
  desc: string;
  roiPct: number | null;
  picks: number | null;
};

const HOCKEY_STRATEGIES: HockeyStrategy[] = [
  { key: "winner", label: "Winner 1X2", desc: "Favori regulation (1/OT/2)", roiPct: null, picks: null },
  { key: "overUnder", label: "Total buts O/U", desc: "Meilleure ligne Under/Over", roiPct: null, picks: null },
  { key: "scorers", label: "Buteurs / Assists", desc: "Top 10 marqueurs NHL·KHL·Magnus", roiPct: null, picks: null },
];

function ROIBadge({ roi }: { roi: number | null }) {
  if (roi == null) {
    return (
      <span className="inline-flex items-center rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-zinc-400">
        ROI —
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-bold tabular-nums",
        roi >= 10
          ? "bg-emerald-500/20 text-emerald-300"
          : roi >= 0
            ? "bg-emerald-500/10 text-emerald-400/80"
            : "bg-red-500/15 text-red-400",
      )}
    >
      {roi > 0 ? "+" : ""}
      {roi.toFixed(1)}%
    </span>
  );
}

export function HockeyHeroHeader({ className }: { className?: string }) {
  const reduceMotion = useReducedMotion();

  const containerVariants = useMemo(
    () => ({
      hidden: {},
      visible: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
    }),
    [],
  );

  const itemVariants = useMemo(
    () => ({
      hidden: reduceMotion ? {} : { opacity: 0, y: 14 },
      visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.25, 0.1, 0.25, 1] as const } },
    }),
    [reduceMotion],
  );

  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-2xl border border-white/[0.06]",
        "bg-gradient-to-b from-[#0c1220] via-[#0f1628] to-[#0c1220]",
        className,
      )}
    >
      <motion.div initial="hidden" animate="visible" variants={containerVariants}>
        {/* Grid pattern */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.8) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.8) 1px, transparent 1px)
            `,
            backgroundSize: "40px 40px",
          }}
        />
        {/* Glow glace */}
        <div
          className="pointer-events-none absolute -left-32 top-0 h-[400px] w-[400px] rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(14,165,233,0.12), transparent 65%)" }}
        />
        <div
          className="pointer-events-none absolute -right-32 top-0 h-[350px] w-[350px] rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(0,230,118,0.06), transparent 65%)" }}
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#0c1220]/90 to-transparent" />

        <div className="relative px-5 py-5 sm:px-8 sm:py-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            {/* Bloc gauche : accroche */}
            <div className="min-w-0 flex-1">
              <motion.div variants={itemVariants} className="flex items-center gap-2.5">
                <span className="relative inline-flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-50" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-sky-400" />
                </span>
                <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-sky-400">
                  Hockey
                </span>
                <span className="ml-1 inline-flex items-center gap-1 rounded-full border border-sky-500/20 bg-sky-500/10 px-2 py-0.5 text-[10px] font-medium text-sky-300/80">
                  NHL · KHL · Ligue Magnus
                </span>
              </motion.div>

              <motion.h1
                variants={itemVariants}
                className="mt-3 text-2xl font-black tracking-tight sm:text-3xl lg:text-4xl"
              >
                <span className="text-white">La glace n&apos;a plus de secrets</span>
                <br />
                <span className="bg-gradient-to-r from-sky-400 via-cyan-300 to-emerald-300 bg-clip-text text-transparent">
                  avec la data hockey
                </span>
              </motion.h1>

              <motion.p variants={itemVariants} className="mt-3 max-w-lg text-sm leading-relaxed text-zinc-400">
                Projections <span className="font-semibold text-zinc-200">Stanley Cup</span>, classements{" "}
                <span className="font-semibold text-sky-400">NHL · KHL · Magnus</span> et tableau{" "}
                <span className="font-semibold text-zinc-200">Under/Over</span> par match pour viser le ROI.
              </motion.p>

              <motion.div variants={itemVariants} className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-500/10 text-sky-400">
                    <Trophy className="h-3.5 w-3.5" />
                  </span>
                  <div className="flex flex-col">
                    <span className="text-lg font-bold leading-none text-zinc-100">3</span>
                    <span className="mt-0.5 text-[10px] text-zinc-500">ligues</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
                    <Target className="h-3.5 w-3.5" />
                  </span>
                  <div className="flex flex-col">
                    <span className="text-lg font-bold leading-none text-emerald-300">3</span>
                    <span className="mt-0.5 text-[10px] text-zinc-500">stratégies</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400">
                    <TrendingUp className="h-3.5 w-3.5" />
                  </span>
                  <div className="flex flex-col">
                    <span className="text-lg font-bold leading-none text-amber-300">ROI</span>
                    <span className="mt-0.5 text-[10px] text-zinc-500">backtest en cours</span>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Bloc droit : ROI par stratégie */}
            <motion.div variants={itemVariants} className="shrink-0 lg:max-w-xs w-full">
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/10">
                    <Zap className="h-4 w-4 text-sky-400" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-400">
                    ROI par stratégie
                  </span>
                </div>
                <div className="mt-3 space-y-2">
                  {HOCKEY_STRATEGIES.map((s) => (
                    <div
                      key={s.key}
                      className="flex items-center justify-between gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-zinc-100">{s.label}</p>
                        <p className="truncate text-[10px] text-zinc-500">{s.desc}</p>
                      </div>
                      <ROIBadge roi={s.roiPct} />
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-[10px] leading-relaxed text-zinc-500">
                  ROI calculés dès que le backtest hockey est disponible.
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
