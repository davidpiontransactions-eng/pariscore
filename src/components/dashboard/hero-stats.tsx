"use client";

/**
 * HeroSection — refonte design 2026-08-25 (cf. .context/design-refonte-2026-08-25.md)
 *
 * Remplace l'ancien "Bonjour + badge value" par un vrai hero orienté data :
 *  - Triple compteur animé (pattern Stripe/OddAlerts) — championnats couverts,
 *    value bets détectés aujourd'hui, sports analysés.
 *  - Badge LIVE pulsant (halo néon) reprenant l'identité `#00e676`
 *  - Grid + glow radial CSS (aucune image lourde — hero data, pas marketing)
 *  - Card "Bet du Jour" optionnelle à droite (si value bets > 0)
 *  - Animations framer-motion en stagger, respecte `prefers-reduced-motion`
 *  - Charte : vert réservé aux signaux (CTA, value, live) — chrome en slate.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { TrendingUp, Trophy, Zap, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface HeroStatsProps {
  /** Nombre total de value bets détectés (tous sports confondus). */
  totalValueBets: number;
  /** Nombre de championnats couverts (fixe : 1582, batch OddAlerts). */
  totalLeagues?: number;
  /** Nombre de sports analysés (fixe : 10). */
  totalSports?: number;
  /** Slot à droite : Bet du Jour (si value bets > 0). Remplace la simple description. */
  highlightedBet?: {
    label: string;
    match: string;
    odds: number;
    edge: number;
  } | null;
  className?: string;
}

/** Compteur animé avec framer-motion — respecte reduced-motion. */
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
      // Ease-out cubic
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

/** Un counter-block du hero. */
function Stat({
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
  tone?: "neon" | "zinc" | "sky";
}) {
  const toneClass = {
    neon: "text-emerald-400",
    zinc: "text-zinc-100",
    sky: "text-sky-400",
  }[tone];
  const iconBg = {
    neon: "bg-emerald-500/10 text-emerald-400",
    zinc: "bg-zinc-500/10 text-zinc-400",
    sky: "bg-sky-500/10 text-sky-400",
  }[tone];

  return (
    <div className="flex items-center gap-3">
      <span className={cn("flex h-10 w-10 items-center justify-center rounded-lg", iconBg)}>
        <Icon className="h-5 w-5" />
      </span>
      <div className="flex flex-col">
        <span className={cn("text-2xl font-bold tracking-tight leading-none", toneClass)}>
          <CountUp value={value} />
          {suffix && <span className="ml-0.5 text-lg font-semibold opacity-60">{suffix}</span>}
        </span>
        <span className="mt-1 text-xs text-zinc-500">{label}</span>
      </div>
    </div>
  );
}

export function HeroSection({
  totalValueBets,
  totalLeagues = 1582,
  totalSports = 10,
  highlightedBet,
  className,
}: HeroStatsProps) {
  const reduceMotion = useReducedMotion();

  const containerVariants = useMemo(
    () => ({
      hidden: {},
      visible: {
        transition: { staggerChildren: 0.08, delayChildren: 0.1 },
      },
    }),
    [],
  );

  const itemVariants = useMemo(
    () => ({
      hidden: reduceMotion ? {} : { opacity: 0, y: 12 },
      visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.4, 0, 0.2, 1] as const } },
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
        "relative overflow-hidden rounded-2xl border border-border/40",
        "bg-gradient-to-b from-[#0a0f1c] via-[#0c1017] to-[#0a0f1c]",
        className,
      )}
    >
      {/* Grid pattern CSS-only (aucune image lourde — hero data) */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)
          `,
          backgroundSize: "32px 32px",
        }}
      />
      {/* Glow radial néon vert (à peine visible — design token charte) */}
      <div
        className="pointer-events-none absolute -top-32 right-0 h-[420px] w-[420px] rounded-full blur-3xl"
        style={{
          background: "radial-gradient(circle, rgba(0,230,118,0.10), transparent 65%)",
        }}
      />
      {/* Vignette bas */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#0a0f1c]/80 to-transparent" />

      <div className="relative px-5 py-6 sm:px-7 sm:py-7">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          {/* Bloc gauche : tagline + badge + description */}
          <div className="min-w-0 flex-1">
            <motion.div variants={itemVariants} className="flex items-center gap-2.5">
              <span className="relative inline-flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-widest text-emerald-400">
                Analyse en direct
              </span>
            </motion.div>

            <motion.h1
              variants={itemVariants}
              className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl"
            >
              La data au service
              <br />
              du <span className="text-emerald-400">pari intelligent</span>
            </motion.h1>

            <motion.p
              variants={itemVariants}
              className="mt-2 max-w-lg text-sm text-zinc-400 sm:text-base"
            >
              Value bets détectés en temps réel, probabilités calculées sur{" "}
              <span className="font-semibold text-zinc-200">
                {totalLeagues.toLocaleString("fr-FR")} championnats
              </span>{" "}
              et <span className="font-semibold text-zinc-200">{totalSports} sports</span>.
            </motion.p>

            {/* Triple compteur (pattern Stripe/OddAlerts Daily Double) */}
            <motion.div
              variants={itemVariants}
              className="mt-5 flex flex-wrap items-center gap-x-8 gap-y-4"
            >
              <Stat
                icon={Trophy}
                value={totalLeagues}
                label="championnats couverts"
                tone="zinc"
              />
              <Stat
                icon={Zap}
                value={totalValueBets}
                label="value bets détectés"
                tone="neon"
              />
              <Stat
                icon={TrendingUp}
                value={totalSports}
                label="sports analysés"
                tone="sky"
              />
            </motion.div>
          </div>

          {/* Bloc droit : Bet du Jour (si dispo) ou CTA verso */}
          {showBet && highlightedBet ? (
            <motion.div variants={itemVariants} className="shrink-0 lg:max-w-xs">
              <div className="group relative overflow-hidden rounded-xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/[0.08] to-transparent p-4 transition-all duration-300 hover:border-emerald-500/50 hover:from-emerald-500/[0.12]">
                {/* Glow hover */}
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(0,230,118,0.08),transparent_70%)] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-emerald-400">
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
              className="shrink-0 rounded-xl border border-border/40 bg-zinc-900/40 p-4 lg:max-w-xs"
            >
              <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
                Scanner en cours
              </span>
              <p className="mt-2 text-sm text-zinc-400">
                Analyse des marchés en cours. Les value bets apparaîtront ici dès détection.
              </p>
            </motion.div>
          )}
        </div>
      </div>
    </motion.section>
  );
}
