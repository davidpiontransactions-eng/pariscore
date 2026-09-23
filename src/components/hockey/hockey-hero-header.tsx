"use client";

/**
 * HockeyHeroHeader — Encart haut de page onglet Hockey (Fotmob light enrichi).
 * Illustration SVG patinoire + photos/logos ligues réels + ROI par stratégie.
 * ROI réels à brancher dès que le backtest hockey existe (data/top5-backtest/hockey.json).
 */

import { useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Trophy, Target, Zap, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { FOT } from "@/components/football/fotmob-theme";
import { HockeyLeagueMark, PuckMark } from "./hockey-team-logo";

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
      <span
        className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-bold tabular-nums"
        style={{ backgroundColor: FOT.soft, color: FOT.muted }}
      >
        ROI —
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-bold tabular-nums",
        roi >= 10 ? "bg-emerald-50 text-emerald-700" : roi >= 0 ? "bg-emerald-50/60 text-emerald-600" : "bg-red-50 text-red-600",
      )}
    >
      {roi > 0 ? "+" : ""}
      {roi.toFixed(1)}%
    </span>
  );
}

/** Grainy mesh gradient (langage Grainient — SwiftGlow light) + noise SVG. */
function GrainMesh() {
  return (
    <>
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(900px 380px at 12% -10%, rgba(125,211,252,0.45), transparent 60%)," +
            "radial-gradient(700px 340px at 88% 0%, rgba(196,181,253,0.38), transparent 62%)," +
            "radial-gradient(800px 420px at 55% 115%, rgba(2,132,199,0.16), transparent 65%)," +
            "linear-gradient(180deg, #f8fbfe 0%, #eef6fb 55%, #f8fbfe 100%)",
        }}
      />
      <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.18]" aria-hidden>
        <filter id="hockeyGrain">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#hockeyGrain)" />
      </svg>
    </>
  );
}

/** Sphère glass flottante 3D (langage Shapefest — Neon/Frosted Glass). */
function GlassOrb({
  className,
  size,
  hue,
  delay = 0,
}: {
  className?: string;
  size: number;
  hue: string;
  delay?: number;
}) {
  return (
    <span
      className={cn("pointer-events-none absolute rounded-full", className)}
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle at 32% 28%, rgba(255,255,255,0.95), ${hue} 42%, rgba(255,255,255,0.12) 78%)`,
        boxShadow: `inset 0 -${size / 5}px ${size / 3}px rgba(2,132,199,0.25), 0 ${size / 6}px ${size / 2.2}px rgba(2,132,199,0.18)`,
        animation: `hockeyOrbFloat 7s ease-in-out ${delay}s infinite`,
      }}
      aria-hidden
    />
  );
}

/** Illustration patinoire — traits SVG authored (zone, rond central, buts). */
function RinkLines() {
  return (
    <svg
      viewBox="0 0 600 200"
      className="pointer-events-none absolute inset-0 h-full w-full"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
    >
      <rect x="0" y="0" width="600" height="200" fill="none" />
      <line x1="300" y1="0" x2="300" y2="200" stroke="#d81b60" strokeWidth="2" opacity="0.18" />
      <circle cx="300" cy="100" r="46" fill="none" stroke="#0288d1" strokeWidth="2" opacity="0.18" />
      <circle cx="300" cy="100" r="3" fill="#0288d1" opacity="0.25" />
      <line x1="120" y1="0" x2="120" y2="200" stroke="#0288d1" strokeWidth="1.5" opacity="0.15" />
      <line x1="480" y1="0" x2="480" y2="200" stroke="#0288d1" strokeWidth="1.5" opacity="0.15" />
      <path d="M20 70 A 40 40 0 0 1 20 130" fill="none" stroke="#d81b60" strokeWidth="2" opacity="0.2" />
      <path d="M580 70 A 40 40 0 0 0 580 130" fill="none" stroke="#d81b60" strokeWidth="2" opacity="0.2" />
      <circle cx="120" cy="55" r="2" fill="#0288d1" opacity="0.3" />
      <circle cx="120" cy="145" r="2" fill="#0288d1" opacity="0.3" />
      <circle cx="480" cy="55" r="2" fill="#0288d1" opacity="0.3" />
      <circle cx="480" cy="145" r="2" fill="#0288d1" opacity="0.3" />
    </svg>
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
      className={cn("relative overflow-hidden rounded-2xl", className)}
      style={{ backgroundColor: FOT.card, border: `1px solid ${FOT.border}` }}
    >
      <style>{`@font-face{font-family:"Uncut Sans";src:url("https://uncut.wtf/assets/fonts/UncutSans-Regular.woff2?v=1.3.4opt") format("woff2");font-weight:400;font-display:swap}@keyframes hockeyOrbFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-12px)}}@media (prefers-reduced-motion: reduce){span[style*="hockeyOrbFloat"]{animation:none}}`}</style>
      <motion.div initial="hidden" animate="visible" variants={containerVariants}>
        <GrainMesh />
        <RinkLines />
        <GlassOrb className="right-[8%] top-[12%]" size={88} hue="rgba(125,211,252,0.55)" />
        <GlassOrb className="right-[22%] top-[52%]" size={54} hue="rgba(196,181,253,0.5)" delay={1.2} />
        <GlassOrb className="left-[4%] bottom-[8%]" size={38} hue="rgba(2,132,199,0.4)" delay={2.1} />
        {/* Voile glace */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: "linear-gradient(105deg, rgba(255,255,255,0.72) 0%, rgba(232,245,252,0.35) 55%, rgba(255,255,255,0.72) 100%)" }}
        />

        <div className="relative px-5 py-5 sm:px-8 sm:py-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            {/* Bloc gauche : accroche + photos ligues */}
            <div className="min-w-0 flex-1">
              <motion.div variants={itemVariants} className="flex items-center gap-2.5">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#f0f0f0]">
                  <PuckMark className="h-4 w-4" />
                </span>
                <span className="text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: "#0288d1", fontFamily: '"Uncut Sans", system-ui, sans-serif' }}>
                  Hockey
                </span>
                <span
                  className="ml-1 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium"
                  style={{ backgroundColor: FOT.soft, color: FOT.muted }}
                >
                  <HockeyLeagueMark league="nhl" size={14} />
                  <HockeyLeagueMark league="khl" size={14} />
                  <HockeyLeagueMark league="magnus" size={14} />
                  NHL · KHL · Ligue Magnus
                </span>
              </motion.div>

              <motion.h1
                variants={itemVariants}
                className="mt-3 text-2xl font-black tracking-tight sm:text-3xl lg:text-4xl"
                style={{ color: FOT.ink, fontFamily: '"Uncut Sans", system-ui, sans-serif', letterSpacing: "-0.03em" }}
              >
                La glace n&apos;a plus de secrets
                <br />
                <span style={{ color: "#0288d1" }}>avec la data hockey</span>
              </motion.h1>

              <motion.p variants={itemVariants} className="mt-3 max-w-lg text-sm leading-relaxed" style={{ color: FOT.muted }}>
                Projections <span className="font-semibold" style={{ color: FOT.ink }}>Stanley Cup</span>, classements{" "}
                <span className="font-semibold" style={{ color: "#0288d1" }}>NHL · KHL · Magnus</span> et tableau{" "}
                <span className="font-semibold" style={{ color: FOT.ink }}>Under/Over</span> par match pour viser le ROI.
              </motion.p>

              <motion.div variants={itemVariants} className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#f0f0f0]">
                    <Trophy className="h-3.5 w-3.5" style={{ color: FOT.ink }} />
                  </span>
                  <div className="flex flex-col">
                    <span className="text-lg font-bold leading-none" style={{ color: FOT.ink }}>3</span>
                    <span className="mt-0.5 text-[10px]" style={{ color: FOT.muted }}>ligues</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#f0f0f0]">
                    <Target className="h-3.5 w-3.5" style={{ color: FOT.ink }} />
                  </span>
                  <div className="flex flex-col">
                    <span className="text-lg font-bold leading-none" style={{ color: FOT.ink }}>3</span>
                    <span className="mt-0.5 text-[10px]" style={{ color: FOT.muted }}>stratégies</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#f0f0f0]">
                    <TrendingUp className="h-3.5 w-3.5" style={{ color: FOT.ink }} />
                  </span>
                  <div className="flex flex-col">
                    <span className="text-lg font-bold leading-none" style={{ color: FOT.ink }}>ROI</span>
                    <span className="mt-0.5 text-[10px]" style={{ color: FOT.muted }}>backtest en cours</span>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Bloc droit : ROI par stratégie */}
            <motion.div variants={itemVariants} className="shrink-0 lg:max-w-xs w-full">
              <div className="rounded-xl p-4" style={{ backgroundColor: FOT.soft, border: `1px solid ${FOT.border}` }}>
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white">
                    <Zap className="h-4 w-4" style={{ color: "#0288d1" }} />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-[0.15em]" style={{ color: FOT.muted }}>
                    ROI par stratégie
                  </span>
                </div>
                <div className="mt-3 space-y-2">
                  {HOCKEY_STRATEGIES.map((s) => (
                    <div
                      key={s.key}
                      className="flex items-center justify-between gap-2 rounded-lg bg-white px-3 py-2"
                      style={{ border: `1px solid ${FOT.border}` }}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold" style={{ color: FOT.ink }}>{s.label}</p>
                        <p className="truncate text-[10px]" style={{ color: FOT.muted }}>{s.desc}</p>
                      </div>
                      <ROIBadge roi={s.roiPct} />
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-[10px] leading-relaxed" style={{ color: FOT.muted }}>
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
