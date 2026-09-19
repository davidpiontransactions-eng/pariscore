"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Calendar, Scale, Crown, TrendingUp, BarChart3 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ProbabilityRing } from "@/components/tennis/probability-ring";
import { ConfidenceRing } from "@/components/shared/confidence-ring";
import { FormTimeline } from "@/components/shared/form-timeline";
import { PlayerAvatar } from "@/components/ui/player-avatar";
import { cn } from "@/lib/utils";
import { WatchButton } from "@/components/shared/watch-button";
import { MmaAnalysisButton } from "./mma-analysis-button";
import { MmaOddsDisplay } from "./mma-odds-display";
import { MmaRadarChart, type MmaRadarData } from "./mma-radar-chart";
import { MmaFighterProfileDialog, type MmaFighterProfile } from "./mma-fighter-profile-dialog";
import { useFavorites } from "@/hooks/use-favorites-adapter";
import { Star } from "lucide-react";

export type MmaFight = {
  fighter_a: string;
  fighter_b: string;
  prob_a: number;
  prob_b: number;
  commence_time: string;
  weight_class?: string;
  event_name?: string;
  photo_a?: string;
  photo_b?: string;
  form_a?: ("W" | "L" | "D")[];
  form_b?: ("W" | "L" | "D")[];
  confidence_a?: number;
  confidence_b?: number;
  /** PariScore ensemble probability (devig 55% + DRatings 30% + model 15%). */
  ps_prob_a?: number;
  ps_prob_b?: number;
  /** Best available bookmaker odds. */
  best_odds_a?: number;
  best_odds_b?: number;
  /** AI computed fair odds (1/prob). */
  ai_odds_a?: number;
  ai_odds_b?: number;
  /** Expected value percentage per side. */
  ev_a_pct?: number;
  ev_b_pct?: number;
  /** Value bet flag (EV > 5%). */
  bet_a?: boolean;
  bet_b?: boolean;
  /** Title fight or main event. */
  is_title?: boolean;
  /** EWMA radar stats per fighter. */
  stats_a?: MmaRadarData;
  stats_b?: MmaRadarData;
};

type Props = {
  fight: MmaFight;
  index?: number;
};

const WEIGHT_CLASS_COLORS: Record<string, string> = {
  heavyweight: "#FF6B6B",
  light_heavyweight: "#FFA94D",
  middleweight: "#FFD43B",
  welterweight: "#69DB7C",
  lightweight: "#4DABF7",
  featherweight: "#9775FA",
  bantamweight: "#F783AC",
  flyweight: "#63E6BE",
};

function formatCommenceTime(iso: string): string {
  try {
    const d = parseISO(iso);
    return format(d, "MMM d, yyyy · HH:mm");
  } catch {
    return iso;
  }
}

function timeUntil(iso: string): string | null {
  try {
    const target = parseISO(iso).getTime();
    const diff = target - Date.now();
    if (diff <= 0) return null;
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h${mins % 60 > 0 ? ` ${mins % 60}m` : ""}`;
    const days = Math.floor(hours / 24);
    return `${days}j${hours % 24 > 0 ? ` ${hours % 24}h` : ""}`;
  } catch {
    return null;
  }
}

export function MmaFightCard({ fight, index = 0 }: Props) {
  const [showStats, setShowStats] = useState(false);
  const [profileFighter, setProfileFighter] = useState<"a" | "b" | null>(null);
  const { isFavorite, toggle } = useFavorites();
  const matchId = `mma:${fight.fighter_a}:${fight.fighter_b}:${fight.commence_time}`;
  const fav = isFavorite(matchId);
  const probA = fight.prob_a != null ? Math.round(fight.prob_a * 100) : 50;
  const probB = fight.prob_b != null ? Math.round(fight.prob_b * 100) : 50;
  const wcColor = fight.weight_class
    ? WEIGHT_CLASS_COLORS[fight.weight_class.toLowerCase().replace(/\s+/g, "_")] ?? "#94A3B8"
    : "#94A3B8";

  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: Math.min((index ?? 0) * 0.05, 0.3), ease: "easeOut" }}
      aria-label={`Combat ${fight.fighter_a} contre ${fight.fighter_b}`}
      className={cn(
        "group relative overflow-hidden rounded-xl border border-border",
        "bg-card text-foreground",
        "transition-all duration-200 ease-out",
        "hover:border-[var(--sport-mma)]/30 hover:shadow-[0_4px_24px_-4px_rgba(239,68,68,0.12)]",
        "focus-within:ring-2 focus-within:ring-[var(--sport-mma)]/50 focus-within:ring-offset-2 focus-within:ring-offset-background"
      )}
    >
      {/* Top accent line — MMA red */}
      <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-[var(--sport-mma)]/60 to-transparent" />

      {/* Favorites star */}
      <button
        onClick={() => toggle(matchId)}
        className="absolute left-3 top-4 z-20 rounded-full p-1 transition-colors hover:bg-muted/50"
        aria-label={fav ? "Retirer des favoris" : "Ajouter aux favoris"}
      >
        <Star
          className={cn(
            "h-4 w-4 transition-colors",
            fav ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"
          )}
        />
      </button>

      {/* Title fight indicator */}
      {fight.is_title && (
        <div className="absolute left-3 top-4 z-20 flex items-center gap-1 rounded-md bg-[var(--sport-mma)]/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
          <Crown className="h-3 w-3" />
          Title
        </div>
      )}

      {/* Value bet badges */}
      {(fight.bet_a || fight.bet_b) && (
        <div className="absolute right-3 top-4 z-20 flex flex-col items-end gap-1">
          {fight.bet_a && (
            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white dark:bg-emerald-600/90">
              <TrendingUp className="h-3 w-3" />
              +{fight.ev_a_pct != null ? `${fight.ev_a_pct.toFixed(1)}%` : "—"}
            </span>
          )}
          {fight.bet_b && (
            <span className="inline-flex items-center gap-1 rounded-md bg-sky-500/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white dark:bg-sky-600/90">
              <TrendingUp className="h-3 w-3" />
              +{fight.ev_b_pct != null ? `${fight.ev_b_pct.toFixed(1)}%` : "—"}
            </span>
          )}
        </div>
      )}

      {/* Subtle radial glow on hover */}
      <div
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background: "radial-gradient(ellipse at 50% 0%, rgba(239,68,68,0.04) 0%, transparent 60%)",
        }}
        aria-hidden
      />

      <div className="relative z-10 px-3 py-4 sm:px-5 sm:py-5">
        {/* Main row: fighter A | VS | fighter B */}
        <div className="flex items-center justify-between gap-2 sm:gap-3">
          {/* Fighter A */}
          <div className="flex flex-1 flex-col items-center gap-1.5 text-center sm:gap-2">
            <button
              onClick={() => setProfileFighter("a")}
              className="focus:outline-none focus:ring-2 focus:ring-primary/50 rounded-full"
              aria-label={`Profil de ${fight.fighter_a}`}
            >
              <PlayerAvatar
                name={fight.fighter_a}
                photoUrl={fight.photo_a}
                size="lg"
                sport="mma"
              />
            </button>
            <span className="truncate max-w-full text-sm font-bold leading-tight tracking-tight">
              {fight.fighter_a}
            </span>

            {fight.confidence_a != null && (
              <ConfidenceRing
                value={probA}
                confidence={fight.confidence_a}
                color="var(--sport-mma)"
              />
            )}
            {fight.form_a && fight.form_a.length > 0 && (
              <FormTimeline
                form={fight.form_a}
                color="var(--sport-mma)"
                size="sm"
                ariaLabel={`Forme récente de ${fight.fighter_a}`}
              />
            )}
          </div>

          {/* VS divider */}
          <div className="flex shrink-0 flex-col items-center gap-1">
            <div className="h-[60px] w-[60px] sm:h-[80px] sm:w-[80px]">
              <ProbabilityRing
                value={probA}
                size={80}
                stroke={5}
                color="var(--sport-mma)"
                trackColor="rgba(239,68,68,0.12)"
              >
                <span className="text-base font-bold tabular-nums text-foreground sm:text-lg">
                  {probA}%
                </span>
              </ProbabilityRing>
            </div>
            <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
              VS
            </span>
            <div className="h-[60px] w-[60px] sm:h-[80px] sm:w-[80px]">
              <ProbabilityRing
                value={probB}
                size={80}
                stroke={5}
                color="#38BDF8"
                trackColor="rgba(56,189,248,0.12)"
              >
                <span className="text-base font-bold tabular-nums text-foreground sm:text-lg">
                  {probB}%
                </span>
              </ProbabilityRing>
            </div>
          </div>

          {/* Fighter B */}
          <div className="flex flex-1 flex-col items-center gap-1.5 text-center sm:gap-2">
            <button
              onClick={() => setProfileFighter("b")}
              className="focus:outline-none focus:ring-2 focus:ring-primary/50 rounded-full"
              aria-label={`Profil de ${fight.fighter_b}`}
            >
              <PlayerAvatar
                name={fight.fighter_b}
                photoUrl={fight.photo_b}
                size="lg"
                sport="mma"
              />
            </button>
            <span className="truncate max-w-full text-sm font-bold leading-tight tracking-tight">
              {fight.fighter_b}
            </span>

            {fight.confidence_b != null && (
              <ConfidenceRing
                value={probB}
                confidence={fight.confidence_b}
                color="#38BDF8"
              />
            )}
            {fight.form_b && fight.form_b.length > 0 && (
              <FormTimeline
                form={fight.form_b}
                color="#38BDF8"
                size="sm"
                ariaLabel={`Forme récente de ${fight.fighter_b}`}
              />
            )}
          </div>
        </div>

        {/* Odds display */}
        <MmaOddsDisplay
          bestOddsA={fight.best_odds_a}
          bestOddsB={fight.best_odds_b}
          aiOddsA={fight.ai_odds_a}
          aiOddsB={fight.ai_odds_b}
          evA={fight.ev_a_pct}
          evB={fight.ev_b_pct}
          fighterA={fight.fighter_a}
          fighterB={fight.fighter_b}
        />

        {/* Radar stats (collapsible) */}
        {(fight.stats_a || fight.stats_b) && (
          <div className="mt-3">
            <button
              onClick={() => setShowStats(!showStats)}
              className="flex w-full items-center justify-center gap-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <BarChart3 className="h-3 w-3" />
              {showStats ? "Masquer les stats" : "Comparer les stats"}
            </button>
            {showStats && (
              <MmaRadarChart
                dataA={fight.stats_a ?? { striking: 0, takedowns: 0, tdDefense: 0, ground: 0, submissions: 0, finishes: 0 }}
                dataB={fight.stats_b}
                fighterA={fight.fighter_a}
                fighterB={fight.fighter_b}
                className="mt-2"
              />
            )}
          </div>
        )}

        {/* Event name + weight class */}
        <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
          {fight.event_name && (
            <span className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              <span className="font-semibold uppercase tracking-[0.08em]">
                {fight.event_name}
              </span>
            </span>
          )}
          {fight.weight_class && (
            <span className="flex items-center gap-1.5">
              <Scale className="h-3.5 w-3.5" style={{ color: wcColor }} />
              <span
                className="font-semibold uppercase tracking-[0.08em]"
                style={{ color: wcColor }}
              >
                {fight.weight_class}
              </span>
            </span>
          )}
        </div>

        {/* Commence time + countdown */}
        <div className="mt-2 flex items-center justify-center gap-3 text-[11px] text-muted-foreground">
          <span className="font-medium">
            <Calendar className="mr-1 inline-block h-3 w-3 align-text-top" />
            {formatCommenceTime(fight.commence_time)}
          </span>
          {(() => {
            const countdown = timeUntil(fight.commence_time);
            return countdown ? (
              <span className="rounded-md bg-[var(--sport-mma)]/10 px-1.5 py-0.5 font-bold tabular-nums text-[var(--sport-mma)]">
                {countdown}
              </span>
            ) : null;
          })()}
        </div>

        {/* Visionner + Analyse IA */}
        <div className="mt-3 flex items-center justify-center gap-2">
          <WatchButton
            sport="mma"
            home={fight.fighter_a}
            away={fight.fighter_b}
            label="Visionner"
            variant="dark"
          />
          <MmaAnalysisButton fight={fight} />
        </div>
      </div>

      {/* Fighter profile dialog */}
      <MmaFighterProfileDialog
        fighter={
          profileFighter === "a"
            ? { name: fight.fighter_a, photo: fight.photo_a, form: fight.form_a, stats: fight.stats_a }
            : profileFighter === "b"
            ? { name: fight.fighter_b, photo: fight.photo_b, form: fight.form_b, stats: fight.stats_b }
            : null
        }
        opponent={
          profileFighter === "a"
            ? { name: fight.fighter_b, photo: fight.photo_b, stats: fight.stats_b }
            : profileFighter === "b"
            ? { name: fight.fighter_a, photo: fight.photo_a, stats: fight.stats_a }
            : undefined
        }
        open={profileFighter !== null}
        onOpenChange={(o) => { if (!o) setProfileFighter(null); }}
      />
    </motion.article>
  );
}
