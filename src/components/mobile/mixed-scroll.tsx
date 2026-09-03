import { type ReactNode, useRef, useState, useEffect } from "react";
import { motion, useScroll, useTransform, useInView, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

// ─── HORIZONTAL TIMELINE ─────────────────────────────────────────────────────

/**
 * HorizontalTimeline
 *
 * Timeline d'événements de match en scroll horizontal.
 * Le scroll vertical pilote le défilement horizontal.
 * Pattern "Mixed Scroll Directions" 2026.
 *
 * Usage :
 * <HorizontalTimeline events={matchEvents} />
 */

export type TimelineEvent = {
  id: string;
  minute: string;
  type: "goal" | "card" | "substitution" | "momentum" | "highlight";
  title: string;
  description?: string;
  team?: "home" | "away";
  icon?: ReactNode;
};

type HorizontalTimelineProps = {
  events: TimelineEvent[];
  className?: string;
};

const EVENT_COLORS: Record<string, string> = {
  goal: "bg-emerald-500",
  card: "bg-amber-500",
  substitution: "bg-sky-500",
  momentum: "bg-purple-500",
  highlight: "bg-rose-500",
};

const EVENT_ICONS: Record<string, string> = {
  goal: "⚽",
  card: "🟨",
  substitution: "🔄",
  momentum: "📈",
  highlight: "⭐",
};

export function HorizontalTimeline({
  events,
  className,
}: HorizontalTimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"],
  });

  const x = useTransform(
    scrollYProgress,
    [0, 1],
    ["0%", reduceMotion ? "0%" : "-50%"]
  );

  return (
    <div ref={containerRef} className={cn("relative h-[400px]", className)}>
      {/* Titre */}
      <div className="sticky top-0 z-10 px-4 py-3 bg-[#0b0e17]/80 backdrop-blur-sm">
        <h3 className="text-sm font-semibold text-zinc-300">
          Timeline du match
        </h3>
      </div>

      {/* Timeline scrollable */}
      <motion.div
        ref={scrollRef}
        style={{ x }}
        className="flex gap-6 px-4 pt-8 pb-4 overflow-visible"
      >
        {events.map((event, idx) => (
          <motion.div
            key={event.id}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: idx * 0.1 }}
            className="relative flex-shrink-0 w-64"
          >
            {/* Connector line */}
            {idx < events.length - 1 && (
              <div className="absolute top-6 left-8 w-[calc(100%+24px)] h-px bg-white/10" />
            )}

            {/* Event dot */}
            <div className="flex items-center gap-3 mb-3">
              <div
                className={cn(
                  "h-3 w-3 rounded-full ring-4 ring-[#0b0e17]",
                  EVENT_COLORS[event.type]
                )}
              />
              <span className="text-xs font-mono text-zinc-500">
                {event.minute}
              </span>
            </div>

            {/* Event card */}
            <div
              className={cn(
                "rounded-xl border border-white/[0.06] bg-white/[0.02] p-4",
                "hover:bg-white/[0.04] transition-colors"
              )}
            >
              <div className="flex items-start gap-2">
                <span className="text-lg">
                  {event.icon || EVENT_ICONS[event.type]}
                </span>
                <div>
                  <p className="text-sm font-medium text-zinc-200">
                    {event.title}
                  </p>
                  {event.description && (
                    <p className="mt-1 text-xs text-zinc-500">
                      {event.description}
                    </p>
                  )}
                </div>
              </div>
              {event.team && (
                <span
                  className={cn(
                    "mt-2 inline-block text-[10px] font-medium px-2 py-0.5 rounded-full",
                    event.team === "home"
                      ? "bg-emerald-500/10 text-emerald-400"
                      : "bg-sky-500/10 text-sky-400"
                  )}
                >
                  {event.team === "home" ? "Domicile" : "Extérieur"}
                </span>
              )}
            </div>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}

// ─── ODDS CAROUSEL ────────────────────────────────────────────────────────────

/**
 * OddsCarousel
 *
 * Comparaison d'odds multi-bookmakers en scroll horizontal.
 * Pattern "Mixed Scroll Directions" 2026.
 *
 * Usage :
 * <OddsCarousel odds={oddsData} />
 */

export type OddsEntry = {
  bookmaker: string;
  logo?: string;
  decimal: number;
  implied: number;
  isBest?: boolean;
};

type OddsCarouselProps = {
  odds: OddsEntry[];
  selection?: "A" | "B";
  className?: string;
};

export function OddsCarousel({
  odds,
  selection = "A",
  className,
}: OddsCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const updateScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 10);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateScroll, { passive: true });
    updateScroll();
    return () => el.removeEventListener("scroll", updateScroll);
  }, []);

  return (
    <div className={cn("relative", className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
          Odds — Sélection {selection}
        </h4>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => scrollRef.current?.scrollBy({ left: -120, behavior: "smooth" })}
            disabled={!canScrollLeft}
            className={cn(
              "h-6 w-6 rounded-full border border-white/10 flex items-center justify-center text-xs",
              canScrollLeft ? "text-zinc-400 hover:bg-white/10" : "text-zinc-700"
            )}
          >
            ←
          </button>
          <button
            type="button"
            onClick={() => scrollRef.current?.scrollBy({ left: 120, behavior: "smooth" })}
            disabled={!canScrollRight}
            className={cn(
              "h-6 w-6 rounded-full border border-white/10 flex items-center justify-center text-xs",
              canScrollRight ? "text-zinc-400 hover:bg-white/10" : "text-zinc-700"
            )}
          >
            →
          </button>
        </div>
      </div>

      {/* Carousel */}
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto scrollbar-none pb-2"
        style={{ scrollSnapType: "x mandatory" }}
      >
        {odds.map((entry) => (
          <div
            key={entry.bookmaker}
            style={{ scrollSnapAlign: "start" }}
            className={cn(
              "flex-shrink-0 w-28 rounded-xl border p-3 text-center transition-colors",
              entry.isBest
                ? "border-emerald-500/40 bg-emerald-500/10"
                : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]"
            )}
          >
            {entry.logo ? (
              <img
                src={entry.logo}
                alt={entry.bookmaker}
                className="h-5 w-auto mx-auto mb-2 object-contain"
                loading="lazy"
              />
            ) : (
              <span className="text-[10px] font-medium text-zinc-500 block mb-2">
                {entry.bookmaker}
              </span>
            )}
            <p
              className={cn(
                "text-lg font-bold tabular-nums",
                entry.isBest ? "text-emerald-400" : "text-zinc-200"
              )}
            >
              {entry.decimal.toFixed(2)}
            </p>
            <p className="text-[10px] text-zinc-600 mt-0.5">
              {entry.implied.toFixed(1)}%
            </p>
            {entry.isBest && (
              <span className="mt-1.5 inline-block text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full">
                BEST
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── SEASON TIMELINE ──────────────────────────────────────────────────────────

/**
 * SeasonTimeline
 *
 * Timeline de saison d'une équipe en scroll horizontal.
 * Pattern "Mixed Scroll Directions" 2026.
 *
 * Usage :
 * <SeasonTimeline results={seasonResults} team="PSG" />
 */

export type SeasonResult = {
  matchday: number;
  opponent: string;
  score: string;
  result: "W" | "D" | "L";
  date: string;
};

type SeasonTimelineProps = {
  results: SeasonResult[];
  team: string;
  className?: string;
};

const RESULT_COLORS = {
  W: "bg-emerald-500",
  D: "bg-amber-500",
  L: "bg-red-500",
};

export function SeasonTimeline({
  results,
  team,
  className,
}: SeasonTimelineProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const wins = results.filter((r) => r.result === "W").length;
  const draws = results.filter((r) => r.result === "D").length;
  const losses = results.filter((r) => r.result === "L").length;

  return (
    <div className={cn("relative", className)}>
      {/* Stats header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h4 className="text-sm font-semibold text-zinc-300">{team}</h4>
          <p className="text-xs text-zinc-500">Saison en cours</p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span className="text-zinc-400">{wins}V</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            <span className="text-zinc-400">{draws}N</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-red-500" />
            <span className="text-zinc-400">{losses}D</span>
          </span>
        </div>
      </div>

      {/* Timeline */}
      <div
        ref={scrollRef}
        className="flex gap-2 overflow-x-auto scrollbar-none pb-2"
        style={{ scrollSnapType: "x mandatory" }}
      >
        {results.map((result) => (
          <div
            key={result.matchday}
            style={{ scrollSnapAlign: "start" }}
            className="flex-shrink-0 w-16 text-center"
          >
            <span className="text-[10px] text-zinc-600 block mb-1">
              J{result.matchday}
            </span>
            <div
              className={cn(
                "h-16 w-12 mx-auto rounded-lg flex items-center justify-center text-xs font-bold text-white",
                RESULT_COLORS[result.result]
              )}
            >
              {result.score}
            </div>
            <span className="text-[10px] text-zinc-500 block mt-1 truncate">
              {result.opponent}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
