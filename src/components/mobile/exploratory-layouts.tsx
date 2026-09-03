import { type ReactNode, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { CountUp, ConfidenceMeter, NeonGlow } from "./trends-2026";

// ─── LEAGUE EXPLORER ──────────────────────────────────────────────────────────

/**
 * LeagueExplorer
 *
 * Grille exploratoire de ligues avec hover-reveal.
 * Pattern "Exploratory Layouts" 2026.
 *
 * Usage :
 * <LeagueExplorer leagues={leagues} onLeagueClick={handleClick} />
 */

export type League = {
  id: string;
  name: string;
  country: string;
  flag?: string;
  sport: string;
  matchCount: number;
  liveCount?: number;
  logo?: string;
};

type LeagueExplorerProps = {
  leagues: League[];
  onLeagueClick?: (league: League) => void;
  className?: string;
};

export function LeagueExplorer({
  leagues,
  onLeagueClick,
  className,
}: LeagueExplorerProps) {
  const reduceMotion = useReducedMotion();
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  return (
    <div className={cn("grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3", className)}>
      {leagues.map((league) => (
        <motion.div
          key={league.id}
          layout
          onMouseEnter={() => setHoveredId(league.id)}
          onMouseLeave={() => setHoveredId(null)}
          onClick={() => onLeagueClick?.(league)}
          className={cn(
            "relative rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 cursor-pointer overflow-hidden",
            "hover:border-white/[0.12] hover:bg-white/[0.04] transition-colors"
          )}
        >
          {/* Glow effect on hover */}
          <AnimatePresence>
            {hoveredId === league.id && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent pointer-events-none"
              />
            )}
          </AnimatePresence>

          <div className="relative z-10">
            {/* League logo + flag */}
            <div className="flex items-center gap-2 mb-3">
              {league.logo ? (
                <img
                  src={league.logo}
                  alt=""
                  className="h-6 w-6 object-contain"
                  loading="lazy"
                />
              ) : (
                <span className="text-lg">{league.flag || "🏆"}</span>
              )}
              <span className="text-[10px] font-medium text-zinc-500 uppercase">
                {league.sport}
              </span>
            </div>

            {/* League name */}
            <h4 className="text-sm font-semibold text-zinc-200 truncate">
              {league.name}
            </h4>
            <p className="text-[10px] text-zinc-500 mt-0.5">{league.country}</p>

            {/* Stats — revealed on hover */}
            <AnimatePresence>
              {hoveredId === league.id && (
                <motion.div
                  initial={reduceMotion ? {} : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="mt-3 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-zinc-500">Matchs</span>
                    <span className="text-xs font-bold text-zinc-300">
                      {league.matchCount}
                    </span>
                  </div>
                  {league.liveCount !== undefined && league.liveCount > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-zinc-500">Live</span>
                      <span className="text-xs font-bold text-rose-400">
                        {league.liveCount}
                      </span>
                    </div>
                  )}
                  <button
                    type="button"
                    className="w-full mt-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 text-[10px] font-medium text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                  >
                    Voir les matchs →
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

// ─── MATCH CARD EXPANDED ──────────────────────────────────────────────────────

/**
 * MatchCardExpanded
 *
 * Carte de match qui s'expand au hover pour révéler des stats profondes.
 * Pattern "Exploratory Layouts" 2026.
 *
 * Usage :
 * <MatchCardExpanded match={matchData} />
 */

type MatchCardExpandedProps = {
  playerA: string;
  playerB: string;
  score?: string;
  tournament?: string;
  surface?: string;
  stats?: {
    label: string;
    valueA: number;
    valueB: number;
    unit?: string;
  }[];
  probability?: number;
  confidence?: number;
  onClick?: () => void;
  className?: string;
};

export function MatchCardExpanded({
  playerA,
  playerB,
  score,
  tournament,
  surface,
  stats = [],
  probability,
  confidence,
  onClick,
  className,
}: MatchCardExpandedProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      layout
      onHoverStart={() => setIsExpanded(true)}
      onHoverEnd={() => setIsExpanded(false)}
      onClick={onClick}
      className={cn(
        "relative rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden cursor-pointer",
        "hover:border-white/[0.12] transition-colors",
        className
      )}
    >
      {/* Main content */}
      <div className="p-4">
        {/* Tournament badge */}
        {tournament && (
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[10px] font-medium text-zinc-500 uppercase">
              {tournament}
            </span>
            {surface && (
              <>
                <span className="text-zinc-700">·</span>
                <span className="text-[10px] text-emerald-400">{surface}</span>
              </>
            )}
          </div>
        )}

        {/* Players + Score */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <div className="text-right">
            <p className="text-sm font-semibold text-zinc-200">{playerA}</p>
          </div>
          <div className="text-center px-3">
            {score ? (
              <span className="text-lg font-bold text-white font-mono">
                {score}
              </span>
            ) : (
              <span className="text-xs text-zinc-600">vs</span>
            )}
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-zinc-200">{playerB}</p>
          </div>
        </div>

        {/* Probability */}
        {probability !== undefined && (
          <div className="mt-4 flex items-center justify-center gap-3">
            <CountUp
              value={probability}
              suffix="%"
              className="text-3xl font-black text-emerald-400"
            />
            <div className="h-8 w-px bg-white/10" />
            <div className="text-right">
              <p className="text-[10px] text-zinc-500">Confiance</p>
              <p className="text-sm font-bold text-zinc-300">{confidence ?? "—"}%</p>
            </div>
          </div>
        )}
      </div>

      {/* Expanded stats */}
      <AnimatePresence>
        {isExpanded && stats.length > 0 && (
          <motion.div
            initial={reduceMotion ? {} : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-2 border-t border-white/[0.06] space-y-3">
              {stats.map((stat) => (
                <div key={stat.label}>
                  <div className="flex items-center justify-between text-[10px] mb-1">
                    <span className="text-zinc-500">{stat.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-zinc-300 w-10 text-right tabular-nums">
                      {stat.valueA}{stat.unit || ""}
                    </span>
                    <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden flex">
                      <div
                        className="bg-emerald-500/60 rounded-full"
                        style={{
                          width: `${(stat.valueA / (stat.valueA + stat.valueB)) * 100}%`,
                        }}
                      />
                      <div
                        className="bg-sky-500/60 rounded-full"
                        style={{
                          width: `${(stat.valueB / (stat.valueA + stat.valueB)) * 100}%`,
                        }}
                      />
                    </div>
                    <span className="text-xs font-bold text-zinc-300 w-10 tabular-nums">
                      {stat.valueB}{stat.unit || ""}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── BENTO DASHBOARD ──────────────────────────────────────────────────────────

/**
 * BentoDashboard
 *
 * Grille bento avec cartes qui se réarrangent.
 * Pattern "Exploratory Layouts" 2026.
 *
 * Usage :
 * <BentoDashboard>
 *   <BentoCard size="lg" title="Win Rate"><CountUp value={67} suffix="%" /></BentoCard>
 *   <BentoCard size="sm" title="Profit"><span className="text-emerald-400">+1250 pts</span></BentoCard>
 *   <BentoCard size="sm" title="Série"><span className="text-amber-400">5V</span></BentoCard>
 *   <BentoCard size="md" title="Suivis"><ConfidenceMeter value={12} /></BentoCard>
 * </BentoDashboard>
 */

type BentoCardProps = {
  children: ReactNode;
  title?: string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  glow?: boolean;
};

const BENTO_SIZES = {
  sm: "col-span-1 row-span-1",
  md: "col-span-1 sm:col-span-2 row-span-1",
  lg: "col-span-1 sm:col-span-2 row-span-2",
  xl: "col-span-1 sm:col-span-2 lg:col-span-3 row-span-2",
};

export function BentoCard({
  children,
  title,
  size = "sm",
  className,
  glow = false,
}: BentoCardProps) {
  return (
    <motion.div
      layout
      className={cn(
        "relative rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 overflow-hidden",
        "hover:border-white/[0.12] transition-colors",
        BENTO_SIZES[size],
        className
      )}
    >
      {glow && (
        <div className="absolute -top-16 -right-16 h-32 w-32 rounded-full bg-emerald-500/5 blur-2xl pointer-events-none" />
      )}
      <div className="relative z-10">
        {title && (
          <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
            {title}
          </h4>
        )}
        {children}
      </div>
    </motion.div>
  );
}

type BentoDashboardProps = {
  children: ReactNode;
  className?: string;
};

export function BentoDashboard({ children, className }: BentoDashboardProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-min",
        className
      )}
    >
      {children}
    </div>
  );
}
