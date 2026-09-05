"use client";

import { type ReactNode, useEffect, useState, useRef, useMemo } from "react";
import { motion, useScroll, useTransform, useInView, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

// ─── NOISE GRAIN TEXTURE ──────────────────────────────────────────────────────

/**
 * NoiseOverlay
 *
 * Overlay de grain/noise pour texture tactile.
 * Pattern "Noise & Chromatic Mash-Ups" 2026.
 *
 * Usage :
 * <div className="relative">
 *   <NoiseOverlay />
 *   <div className="relative z-10">Contenu</div>
 * </div>
 */

export function NoiseOverlay({ intensity = 0.03, className }: { intensity?: number; className?: string }) {
  return (
    <div
      className={cn("absolute inset-0 pointer-events-none mix-blend-overlay", className)}
      style={{
        opacity: intensity,
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.7' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
      }}
    />
  );
}

/**
 * NeonGlow
 *
 * Effet de glow néon pour badges et boutons.
 * Applique un box-shadow coloré animé.
 *
 * Usage :
 * <NeonGlow color="emerald">
 *   <span>92%</span>
 * </NeonGlow>
 */

type NeonGlowProps = {
  children: ReactNode;
  className?: string;
  color?: "emerald" | "sky" | "purple" | "amber" | "rose";
  intensity?: number;
};

const NEON_COLORS = {
  emerald: "0, 230, 118",
  sky: "56, 189, 248",
  purple: "168, 85, 247",
  amber: "251, 191, 36",
  rose: "244, 63, 94",
};

export function NeonGlow({
  children,
  className,
  color = "emerald",
  intensity = 0.4,
}: NeonGlowProps) {
  const rgb = NEON_COLORS[color];

  return (
    <div
      className={cn("relative", className)}
      style={{
        filter: `drop-shadow(0 0 8px rgba(${rgb}, ${intensity})) drop-shadow(0 0 20px rgba(${rgb}, ${intensity * 0.5}))`,
      }}
    >
      {children}
    </div>
  );
}

// ─── TYPOGRAPHIC STATEMENTS ────────────────────────────────────────────────────

/**
 * CountUp
 *
 * Nombre animé qui compte de 0 à la valeur cible.
 * Pattern "Typographic Statements" 2026 — les chiffres SONT le design.
 *
 * Usage :
 * <CountUp value={73} suffix="%" className="text-8xl font-black" />
 */

type CountUpProps = {
  value: number;
  suffix?: string;
  prefix?: string;
  decimals?: number;
  duration?: number;
  className?: string;
  /** Déclencher l'animation au scroll */
  triggerOnScroll?: boolean;
};

export function CountUp({
  value,
  suffix = "",
  prefix = "",
  decimals = 0,
  duration = 2,
  className,
  triggerOnScroll = true,
}: CountUpProps) {
  const [displayValue, setDisplayValue] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (triggerOnScroll && !isInView) return;
    if (hasAnimated.current) return;
    hasAnimated.current = true;

    const startTime = performance.now();
    const animate = (currentTime: number) => {
      const elapsed = (currentTime - startTime) / 1000;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(eased * value);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [value, duration, triggerOnScroll, isInView]);

  return (
    <span ref={ref} className={cn("tabular-nums", className)}>
      {prefix}
      {displayValue.toFixed(decimals)}
      {suffix}
    </span>
  );
}

/**
 * BigNumber
 *
 * Grande typographie pour les prédictions.
 * Pattern "oversized typography" 2026.
 *
 * Usage :
 * <BigNumber value={73} label="Win Probability" color="emerald" />
 */

type BigNumberProps = {
  value: number;
  label?: string;
  suffix?: string;
  color?: "emerald" | "sky" | "purple" | "white";
  size?: "lg" | "xl" | "2xl";
  className?: string;
};

const BIG_NUMBER_COLORS = {
  emerald: "text-emerald-400",
  sky: "text-sky-400",
  purple: "text-purple-400",
  white: "text-white",
};

const BIG_NUMBER_SIZES = {
  lg: "text-6xl sm:text-7xl",
  xl: "text-7xl sm:text-8xl",
  "2xl": "text-8xl sm:text-9xl",
};

export function BigNumber({
  value,
  label,
  suffix = "%",
  color = "emerald",
  size = "xl",
  className,
}: BigNumberProps) {
  return (
    <div className={cn("text-center", className)}>
      <CountUp
        value={value}
        suffix={suffix}
        className={cn(
          "font-black tracking-tighter",
          BIG_NUMBER_COLORS[color],
          BIG_NUMBER_SIZES[size]
        )}
      />
      {label && (
        <p className="mt-2 text-sm font-medium text-zinc-400">{label}</p>
      )}
    </div>
  );
}

// ─── CONFIDENCE METER ──────────────────────────────────────────────────────────

/**
 * ConfidenceMeter
 *
 * Jauge animée de confiance.
 * Pattern "Dynamic Motion Design" 2026.
 *
 * Usage :
 * <ConfidenceMeter value={85} label="Confiance IA" />
 */

type ConfidenceMeterProps = {
  value: number;
  label?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
};

export function ConfidenceMeter({
  value,
  label,
  size = "md",
  className,
}: ConfidenceMeterProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-30px" });

  const color =
    value >= 80
      ? "from-emerald-500 to-emerald-400"
      : value >= 60
        ? "from-sky-500 to-sky-400"
        : value >= 40
          ? "from-amber-500 to-amber-400"
          : "from-red-500 to-red-400";

  const heights = { sm: "h-1.5", md: "h-2.5", lg: "h-4" };

  return (
    <div ref={ref} className={cn("space-y-2", className)}>
      {label && (
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-zinc-400">{label}</span>
          <CountUp
            value={value}
            suffix="%"
            className="text-xs font-bold text-zinc-300"
          />
        </div>
      )}
      <div className={cn("rounded-full bg-white/5 overflow-hidden", heights[size])}>
        <motion.div
          className={cn("rounded-full bg-gradient-to-r", color)}
          initial={{ width: 0 }}
          animate={isInView ? { width: `${value}%` } : { width: 0 }}
          transition={{ duration: 1.2, ease: [0.25, 0.1, 0.25, 1] }}
        />
      </div>
    </div>
  );
}

// ─── HORIZONTAL SCROLL ────────────────────────────────────────────────────────

/**
 * HorizontalScroll
 *
 * Section à scroll horizontal.
 * Pattern "Mixed Scroll Directions" 2026.
 *
 * Usage :
 * <HorizontalScroll title="Timeline des matchs">
 *   <MatchCard />
 *   <MatchCard />
 *   <MatchCard />
 * </HorizontalScroll>
 */

type HorizontalScrollProps = {
  children: ReactNode;
  title?: string;
  className?: string;
  /** Afficher les indicateurs de scroll */
  showIndicators?: boolean;
};

export function HorizontalScroll({
  children,
  title,
  className,
  showIndicators = true,
}: HorizontalScrollProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const updateScrollState = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 10);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateScrollState, { passive: true });
    updateScrollState();
    return () => el.removeEventListener("scroll", updateScrollState);
  }, []);

  const scroll = (direction: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    const scrollAmount = el.clientWidth * 0.7;
    el.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
  };

  return (
    <div className={cn("relative", className)}>
      {title && (
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-zinc-300">{title}</h3>
          {showIndicators && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => scroll("left")}
                disabled={!canScrollLeft}
                className={cn(
                  "h-7 w-7 rounded-full border border-white/10 flex items-center justify-center transition-colors",
                  canScrollLeft
                    ? "hover:bg-white/10 text-zinc-400"
                    : "opacity-30 cursor-not-allowed text-zinc-600"
                )}
                aria-label="Scroll gauche"
              >
                ←
              </button>
              <button
                type="button"
                onClick={() => scroll("right")}
                disabled={!canScrollRight}
                className={cn(
                  "h-7 w-7 rounded-full border border-white/10 flex items-center justify-center transition-colors",
                  canScrollRight
                    ? "hover:bg-white/10 text-zinc-400"
                    : "opacity-30 cursor-not-allowed text-zinc-600"
                )}
                aria-label="Scroll droite"
              >
                →
              </button>
            </div>
          )}
        </div>
      )}

      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto scrollbar-none pb-2 -mx-4 px-4"
        style={{ scrollSnapType: "x mandatory" }}
      >
        {children}
      </div>
    </div>
  );
}

// ─── CINEMATIC MATCH HERO ─────────────────────────────────────────────────────

/**
 * MatchHero
 *
 * Hero cinématique pour un match en détail.
 * Pattern "Cinematic Heroes" 2026.
 *
 * Usage :
 * <MatchHero
 *   playerA="Sinner"
 *   playerB="Alcaraz"
 *   scoreA="6-4, 3-6, 7-5"
 *   tournament="Roland Garros"
 *   surface="Terre battue"
 *   image="/stadium.jpg"
 * />
 */

type MatchHeroProps = {
  playerA: string;
  playerB: string;
  scoreA?: string;
  scoreB?: string;
  tournament?: string;
  round?: string;
  surface?: string;
  startTime?: string;
  image?: string;
  children?: ReactNode;
  className?: string;
};

export function MatchHero({
  playerA,
  playerB,
  scoreA,
  scoreB,
  tournament,
  round,
  surface,
  startTime,
  image,
  children,
  className,
}: MatchHeroProps) {
  const reduceMotion = useReducedMotion();

  return (
    <section
      className={cn(
        "relative min-h-[50vh] flex items-end overflow-hidden",
        "bg-gradient-to-br from-[#0b0e17] via-[#0e121e] to-[#0b0e17]",
        className
      )}
    >
      {/* Background image */}
      {image && (
        <div className="absolute inset-0">
          <img
            src={image}
            alt=""
            className="h-full w-full object-cover opacity-30"
            loading="eager"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0b0e17] via-[#0b0e17]/60 to-transparent" />
        </div>
      )}

      {/* Noise overlay */}
      <NoiseOverlay intensity={0.04} />

      {/* Content */}
      <div className="relative z-10 w-full p-6 sm:p-8 max-w-6xl mx-auto">
        {/* Tournament badge */}
        {tournament && (
          <motion.div
            initial={reduceMotion ? undefined : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-4"
          >
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-zinc-300">
              {surface && <span className="text-emerald-400">{surface}</span>}
              {surface && tournament && <span className="text-zinc-600">·</span>}
              {tournament}
              {round && <span className="text-zinc-500">— {round}</span>}
            </span>
          </motion.div>
        )}

        {/* Match score */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-4 sm:gap-8">
          <motion.div
            initial={reduceMotion ? undefined : { opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white tracking-tight">
              {playerA}
            </h2>
            {scoreA && (
              <p className="mt-2 text-lg font-mono text-emerald-400">{scoreA}</p>
            )}
          </motion.div>

          <motion.div
            initial={reduceMotion ? undefined : { opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, delay: 0.4 }}
            className="text-center"
          >
            <span className="text-2xl sm:text-3xl font-black text-zinc-600">VS</span>
            {startTime && (
              <p className="mt-1 text-xs text-zinc-500">{startTime}</p>
            )}
          </motion.div>

          <motion.div
            initial={reduceMotion ? undefined : { opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-right"
          >
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white tracking-tight">
              {playerB}
            </h2>
            {scoreB && (
              <p className="mt-2 text-lg font-mono text-emerald-400">{scoreB}</p>
            )}
          </motion.div>
        </div>

        {/* CTA */}
        {children && (
          <motion.div
            initial={reduceMotion ? undefined : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.6 }}
            className="mt-6"
          >
            {children}
          </motion.div>
        )}
      </div>
    </section>
  );
}

// ─── GLOWING PREDICTION CARD ──────────────────────────────────────────────────

/**
 * PredictionCard
 *
 * Carte de prédiction avec glow néon + typographie oversized.
 * Combine Trends #6 (Typography) + #9 (Noise & Chromatic).
 *
 * Usage :
 * <PredictionCard
 *   playerA="Sinner"
 *   playerB="Alcaraz"
 *   probabilityA={73}
 *   confidence={85}
 * />
 */

type PredictionCardProps = {
  playerA: string;
  playerB: string;
  probabilityA: number;
  confidence?: number;
  edge?: number;
  onClick?: () => void;
  className?: string;
};

export function PredictionCard({
  playerA,
  playerB,
  probabilityA,
  confidence,
  edge,
  onClick,
  className,
}: PredictionCardProps) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      onClick={onClick}
      whileHover={reduceMotion ? undefined : { y: -2 }}
      className={cn(
        "relative rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 cursor-pointer overflow-hidden group",
        className
      )}
    >
      <NoiseOverlay intensity={0.02} />

      {/* Glow effect */}
      <div
        className="absolute -top-20 -right-20 h-40 w-40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{
          background: "radial-gradient(circle, rgba(0,230,118,0.15) 0%, transparent 70%)",
        }}
      />

      <div className="relative z-10">
        {/* Players */}
        <div className="flex items-center justify-between mb-6">
          <span className="text-sm font-medium text-zinc-300">{playerA}</span>
          <span className="text-xs text-zinc-600">vs</span>
          <span className="text-sm font-medium text-zinc-300">{playerB}</span>
        </div>

        {/* Big prediction number */}
        <div className="text-center">
          <CountUp
            value={probabilityA}
            suffix="%"
            className="text-7xl sm:text-8xl font-black text-white tracking-tighter"
          />
          <p className="mt-2 text-xs font-medium text-zinc-500 uppercase tracking-wider">
            Probabilité de victoire
          </p>
        </div>

        {/* Confidence bar */}
        {confidence !== undefined && (
          <div className="mt-6">
            <ConfidenceMeter value={confidence} label="Confiance IA" size="sm" />
          </div>
        )}

        {/* Edge badge */}
        {edge !== undefined && edge > 0 && (
          <div className="mt-4 flex justify-center">
            <NeonGlow color="emerald" intensity={0.3}>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 text-xs font-bold text-emerald-400">
                +{edge.toFixed(1)}% edge
              </span>
            </NeonGlow>
          </div>
        )}
      </div>
    </motion.div>
  );
}
