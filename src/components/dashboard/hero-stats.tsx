"use client";

/**
 * HeroSection — refonte design 2026-09-02
 *
 * Hero data orienté conversion :
 *  - Titre accrocheur avec gradient text
 *  - Description stylisée avec highlights
 *  - Triple compteur animé (pattern Stripe/OddAlerts)
 *  - Badge LIVE pulsant (halo néon)
 *  - Quick links contextuels (LIVE, Value Bets, Tendances)
 *  - Card "Bet du Jour" optionnelle
 *  - Animations framer-motion en stagger
 *  - Grid + glow radial CSS
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { TrendingUp, Trophy, Zap, ArrowUpRight, Radio, Target, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

interface HeroStatsProps {
  totalValueBets: number;
  totalLeagues?: number;
  totalSports?: number;
  totalLiveMatches?: number;
  highlightedBet?: {
    label: string;
    match: string;
    odds: number;
    edge: number;
  } | null;
  className?: string;
}

/** Compteur animé avec framer-motion. */
function CountUp({ value, duration = 1.2 }: { value: number; duration?: number }) {
  const reduceMotion = useReducedMotion();
  const [display, setDisplay] = useState(reduceMotion ? value : 0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (reduceMotion || value === 0) {
      setDisplay(value);
      return;
    }
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min((now - start) / (duration * 1000), 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(eased * value));
      if (progress < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value, duration, reduceMotion]);

  return (
    <span className="tabular-nums">{display.toLocaleString("fr-FR")}</span>
  );
}

/** Compteur minimaliste pour la rangée de stats. */
function MiniStat({
  icon: Icon,
  value,
  suffix,
  label,
  tone = "zinc",
}: {
  icon: React.ComponentType<{ className?: string }>;
  value: number;
  suffix?: string;
  label: string;
  tone?: "neon" | "zinc" | "sky" | "amber";
}) {
  const toneClass = {
    neon: "text-emerald-400",
    zinc: "text-zinc-100",
    sky: "text-sky-400",
    amber: "text-amber-400",
  }[tone];
  const iconBg = {
    neon: "bg-emerald-500/10 text-emerald-400",
    zinc: "bg-zinc-500/10 text-zinc-400",
    sky: "bg-sky-500/10 text-sky-400",
    amber: "bg-amber-500/10 text-amber-400",
  }[tone];

  return (
    <div className="flex items-center gap-2.5">
      <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg", iconBg)}>
        <Icon className="h-4 w-4" />
      </span>
      <div className="flex flex-col">
        <span className={cn("text-xl font-bold tracking-tight leading-none", toneClass)}>
          <CountUp value={value} />
          {suffix && <span className="ml-0.5 text-sm font-semibold opacity-60">{suffix}</span>}
        </span>
        <span className="mt-0.5 text-[11px] text-zinc-500">{label}</span>
      </div>
    </div>
  );
}

/** Quick link pill. */
function QuickLink({
  icon: Icon,
  label,
  count,
  color,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  count: number;
  color: string;
  href: string;
}) {
  return (
    <a
      href={href}
      className={cn(
        "group flex items-center gap-2 rounded-xl border px-3.5 py-2 transition-all duration-200",
        "hover:scale-[1.02] hover:shadow-lg",
        color,
      )}
    >
      <Icon className="h-4 w-4" />
      <span className="text-xs font-semibold">{label}</span>
      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-white/10 px-1.5 text-[10px] font-bold">
        {count}
      </span>
    </a>
  );
}

export function HeroSection({
  totalValueBets,
  totalLeagues = 1582,
  totalSports = 10,
  totalLiveMatches = 0,
  highlightedBet,
  className,
}: HeroStatsProps) {
  const reduceMotion = useReducedMotion();

  const containerVariants = useMemo(
    () => ({
      hidden: {},
      visible: {
        transition: { staggerChildren: 0.06, delayChildren: 0.05 },
      },
    }),
    [],
  );

  const itemVariants = useMemo(
    () => ({
      hidden: reduceMotion ? {} : { opacity: 0, y: 16 },
      visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.25, 0.1, 0.25, 1] as const } },
    }),
    [reduceMotion],
  );

  const showBet = highlightedBet && totalValueBets > 0;

  return (
    <motion.section
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className={cn(
        "relative overflow-hidden rounded-2xl border border-white/[0.06]",
        "bg-gradient-to-b from-[#0c1220] via-[#0f1628] to-[#0c1220]",
        className,
      )}
    >
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
      
      {/* Glow radial gauche */}
      <div
        className="pointer-events-none absolute -left-32 top-0 h-[400px] w-[400px] rounded-full blur-3xl"
        style={{
          background: "radial-gradient(circle, rgba(0,230,118,0.08), transparent 65%)",
        }}
      />
      
      {/* Glow radial droite */}
      <div
        className="pointer-events-none absolute -right-32 top-0 h-[350px] w-[350px] rounded-full blur-3xl"
        style={{
          background: "radial-gradient(circle, rgba(41,182,246,0.06), transparent 65%)",
        }}
      />

      {/* Vignette bas */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#0c1220]/90 to-transparent" />

      <div className="relative px-5 py-6 sm:px-8 sm:py-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          
          {/* Bloc gauche : Hero content */}
          <div className="min-w-0 flex-1">
            {/* Badge LIVE animé */}
            <motion.div variants={itemVariants} className="flex items-center gap-2.5">
              <span className="relative inline-flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-50" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
              </span>
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-400">
                Analyse en direct
              </span>
            </motion.div>

            {/* Titre principal — gradient text */}
            <motion.h1
              variants={itemVariants}
              className="mt-4 text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl"
            >
              <span className="text-white">La data au service</span>
              <br />
              <span className="bg-gradient-to-r from-emerald-400 via-emerald-300 to-sky-400 bg-clip-text text-transparent">
                du pari intelligent
              </span>
            </motion.h1>

            {/* Description stylisée */}
            <motion.div
              variants={itemVariants}
              className="mt-4 max-w-xl"
            >
              <p className="text-sm leading-relaxed text-zinc-400 sm:text-base">
                <span className="font-semibold text-zinc-200">Value bets</span> détectés en temps réel, 
                probabilités calculées sur{" "}
                <span className="inline-flex items-center gap-1 font-semibold text-emerald-400">
                  <Trophy className="h-3.5 w-3.5" />
                  {totalLeagues.toLocaleString("fr-FR")} championnats
                </span>{" "}
                et{" "}
                <span className="inline-flex items-center gap-1 font-semibold text-sky-400">
                  <Zap className="h-3.5 w-3.5" />
                  {totalSports} sports
                </span>.
              </p>
            </motion.div>

            {/* Triple compteur */}
            <motion.div
              variants={itemVariants}
              className="mt-6 flex flex-wrap items-center gap-x-7 gap-y-4"
            >
              <MiniStat
                icon={Trophy}
                value={totalLeagues}
                label="championnats"
                tone="zinc"
              />
              <MiniStat
                icon={Target}
                value={totalValueBets}
                label="value bets"
                tone="neon"
              />
              <MiniStat
                icon={TrendingUp}
                value={totalSports}
                label="sports"
                tone="sky"
              />
            </motion.div>

            {/* Quick links contextuels */}
            <motion.div
              variants={itemVariants}
              className="mt-5 flex flex-wrap items-center gap-2.5"
            >
              <QuickLink
                icon={Radio}
                label="LIVE"
                count={totalLiveMatches}
                color="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500/50"
                href="#live"
              />
              <QuickLink
                icon={Target}
                label="Value Bets"
                count={totalValueBets}
                color="border-amber-500/30 text-amber-400 hover:bg-amber-500/10 hover:border-amber-500/50"
                href="#value"
              />
              <QuickLink
                icon={BarChart3}
                label="Tendances"
                count={0}
                color="border-sky-500/30 text-sky-400 hover:bg-sky-500/10 hover:border-sky-500/50"
                href="#trends"
              />
            </motion.div>
          </div>

          {/* Bloc droit : Bet du Jour ou placeholder */}
          {showBet && highlightedBet ? (
            <motion.div variants={itemVariants} className="shrink-0 lg:max-w-xs">
              <div className="group relative overflow-hidden rounded-xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/[0.08] to-transparent p-4 transition-all duration-300 hover:border-emerald-500/50 hover:from-emerald-500/[0.12]">
                {/* Glow hover */}
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(0,230,118,0.08),transparent_70%)] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-emerald-400">
                    Bet du jour
                  </span>
                  <ArrowUpRight className="h-3.5 w-3.5 text-emerald-400 opacity-0 transition-opacity group-hover:opacity-100" />
                </div>

                <p className="mt-2 text-sm font-semibold text-white">{highlightedBet.match}</p>
                <p className="mt-0.5 truncate text-xs text-zinc-400">{highlightedBet.label}</p>

                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-2xl font-bold tracking-tight text-emerald-400 tabular-nums">
                    {highlightedBet.odds.toFixed(2)}
                  </span>
                  <span className="inline-flex items-center gap-0.5 rounded-md bg-emerald-500/20 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-300">
                    +{highlightedBet.edge.toFixed(1)}% edge
                  </span>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              variants={itemVariants}
              className="shrink-0 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 lg:max-w-xs"
            >
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10">
                  <Target className="h-4 w-4 text-emerald-400" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500">
                  Scanner actif
                </span>
              </div>
              <p className="mt-2.5 text-xs leading-relaxed text-zinc-400">
                Analyse des marchés en cours. Les value bets apparaîtront ici dès détection.
              </p>
              <div className="mt-3 flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-40" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                </span>
                <span className="text-[10px] text-emerald-400">En temps réel</span>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </motion.section>
  );
}
