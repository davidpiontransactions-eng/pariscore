"use client";

/**
 * SnookerHero — Section hero dédiée snooker avec focus ROI.
 *
 * Layout bento 2 colonnes :
 *  - Gauche : accroche snooker, stats animées, quick links
 *  - Droite : card "Scanner actif" avec point pulsant
 *
 * Design : dark navy (#0c1220), glow radial vert/bleu, grid pattern subtil.
 * Même pattern que hero-stats.tsx mais optimisé pour le snooker.
 */

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  Crosshair,
  TrendingUp,
  Trophy,
  Zap,
  Radio,
  Target,
  BarChart3,
  Percent,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Compteur animé ──────────────────────────────────────────────────────

function CountUp({ value, suffix, duration = 1.2 }: { value: number; suffix?: string; duration?: number }) {
  const reduceMotion = useReducedMotion();
  const [display, setDisplay] = useState(reduceMotion ? value : 0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (reduceMotion || value === 0) { setDisplay(value); return; }
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
    <span className="tabular-nums">
      {display.toLocaleString("fr-FR")}
      {suffix && <span className="ml-0.5 text-sm font-semibold opacity-60">{suffix}</span>}
    </span>
  );
}

// ─── Mini stat ───────────────────────────────────────────────────────────

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
  tone?: "green" | "zinc" | "sky" | "amber" | "purple";
}) {
  const toneClass = {
    green: "text-emerald-400",
    zinc: "text-zinc-100",
    sky: "text-sky-400",
    amber: "text-amber-400",
    purple: "text-[#7B3FA0]",
  }[tone];
  const iconBg = {
    green: "bg-emerald-500/10 text-emerald-400",
    zinc: "bg-[#EDE8F5] text-[#6B5B8D]",
    sky: "bg-sky-500/10 text-sky-400",
    amber: "bg-amber-500/10 text-amber-400",
    purple: "bg-[#7B3FA0]/10 text-[#7B3FA0]",
  }[tone];

  return (
    <div className="flex items-center gap-2.5">
      <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg", iconBg)}>
        <Icon className="h-4 w-4" />
      </span>
      <div className="flex flex-col">
        <span className={cn("text-xl font-bold tracking-tight leading-none", toneClass)}>
          <CountUp value={value} />
          {suffix}
        </span>
        <span className="mt-0.5 text-[11px] text-zinc-400">{label}</span>
      </div>
    </div>
  );
}

// ─── Quick link pill ─────────────────────────────────────────────────────

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

// ─── Props ───────────────────────────────────────────────────────────────

interface SnookerHeroProps {
  totalMatches: number;
  totalLive: number;
  totalWithOdds: number;
  avgRoi?: number;
  className?: string;
}

// ─── Composant principal ─────────────────────────────────────────────────

export function SnookerHero({
  totalMatches,
  totalLive,
  totalWithOdds,
  avgRoi,
  className,
}: SnookerHeroProps) {
  const reduceMotion = useReducedMotion();

  const containerVariants = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
  };

  const itemVariants = {
    hidden: reduceMotion ? {} : { opacity: 0, y: 16 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.25, 0.1, 0.25, 1] as const } },
  };

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
            backgroundImage: `linear-gradient(rgba(255,255,255,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.8) 1px, transparent 1px)`,
            backgroundSize: "40px 40px",
          }}
        />

        {/* Glow gauche — vert snooker */}
        <div
          className="pointer-events-none absolute -left-32 top-0 h-[400px] w-[400px] rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(0,152,95,0.10), transparent 65%)" }}
        />

        {/* Glow droite — bleu */}
        <div
          className="pointer-events-none absolute -right-32 top-0 h-[350px] w-[350px] rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(41,182,246,0.06), transparent 65%)" }}
        />

        {/* Vignette bas */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#0c1220]/90 to-transparent" />

        <div className="relative px-5 py-6 sm:px-8 sm:py-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">

            {/* ── Bloc gauche : Hero content ── */}
            <div className="min-w-0 flex-1">
              {/* Badge LIVE animé */}
              <motion.div variants={itemVariants} className="flex items-center gap-2.5">
                <span className="relative inline-flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#00985f] opacity-50" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#00985f]" />
                </span>
                <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#00985f]">
                  Snooker en direct
                </span>
                <span className="ml-1 inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300/80">
                  <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Données vérifiées
                </span>
              </motion.div>

              {/* Titre principal — gradient snooker */}
              <motion.h1
                variants={itemVariants}
                className="mt-4 text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl"
              >
                <span className="text-white">Le snooker décrypté</span>
                <br />
                <span className="bg-gradient-to-r from-emerald-400 via-[#00985f] to-sky-400 bg-clip-text text-transparent">
                  par les chiffres
                </span>
              </motion.h1>

              {/* Description */}
              <motion.div variants={itemVariants} className="mt-4 max-w-xl">
                <p className="text-sm leading-relaxed text-zinc-400 sm:text-base">
                  <span className="font-semibold text-zinc-200">5 stratégies prédictives</span> calibrées
                  sur le snooker — Elo, forme, scoring, clutch, momentum — pour identifier les{" "}
                  <span className="inline-flex items-center gap-1 font-semibold text-[#00985f]">
                    <Target className="h-3.5 w-3.5" />
                    value bets
                  </span>{" "}
                  avec un{" "}
                  <span className="inline-flex items-center gap-1 font-semibold text-emerald-300">
                    <Percent className="h-3.5 w-3.5" />
                    ROI positif
                  </span>.
                </p>
              </motion.div>

              {/* Triple compteur */}
              <motion.div variants={itemVariants} className="mt-6 flex flex-wrap items-center gap-x-7 gap-y-4">
                <MiniStat icon={Trophy} value={totalMatches} label="matchs analysés" tone="zinc" />
                <MiniStat icon={Target} value={totalWithOdds} label="avec cotes" tone="green" />
                <MiniStat icon={TrendingUp} value={totalLive} label="en live" tone="sky" />
              </motion.div>

              {/* Quick links */}
              <motion.div variants={itemVariants} className="mt-5 flex flex-wrap items-center gap-2.5">
                <QuickLink
                  icon={Radio}
                  label="LIVE"
                  count={totalLive}
                  color="border-emerald-500/30 text-[#00985f] hover:bg-emerald-500/10 hover:border-emerald-500/50"
                  href="#live"
                />
                <QuickLink
                  icon={Crosshair}
                  label="Top 10"
                  count={10}
                  color="border-amber-500/30 text-amber-400 hover:bg-amber-500/10 hover:border-amber-500/50"
                  href="#top10"
                />
                <QuickLink
                  icon={BarChart3}
                  label="Stratégies"
                  count={5}
                  color="border-sky-500/30 text-sky-400 hover:bg-sky-500/10 hover:border-sky-500/50"
                  href="#strategies"
                />
              </motion.div>
            </div>

            {/* ── Bloc droit : Scanner actif ── */}
            <motion.div
              variants={itemVariants}
              className="shrink-0 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 lg:max-w-xs"
            >
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#00985f]/10">
                  <Target className="h-4 w-4 text-[#00985f]" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-400">
                  Scanner snooker actif
                </span>
              </div>
              <p className="mt-2.5 text-xs leading-relaxed text-zinc-400">
                Analyse en temps réel des tournois World Snooker — Northern Ireland Open, UK Championship, Masters.
                Les value bets apparaissent ici dès détection.
              </p>
              <div className="mt-3 flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#00985f] opacity-40" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-[#00985f]" />
                </span>
                <span className="text-[10px] text-[#00985f]">En temps réel</span>
              </div>

              {/* ROI miniature */}
              {avgRoi != null && (
                <div className="mt-3 flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2">
                  <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-[11px] text-zinc-400">ROI moyen stratégies</span>
                  <span className="ml-auto text-sm font-bold text-emerald-400 tabular-nums">
                    {avgRoi > 0 ? "+" : ""}{avgRoi.toFixed(1)}%
                  </span>
                </div>
              )}
            </motion.div>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
