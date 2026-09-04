"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { WinProbabilityBar } from "./win-probability-bar";
import { predictMatch } from "@/lib/predictions/fiba-predictions";
import { useFibaStats } from "@/hooks/use-fiba-stats";
import { useFibaOdds } from "@/hooks/use-fiba-odds";
import { calculateValue } from "@/lib/predictions/fiba-odds";
import { FibaPredictiveBets } from "./fiba-predictive-bets";
import type { FibaMatch } from "@/app/api/fiba/scoreboard/route";

type FibaGameCardProps = {
  match: FibaMatch;
  onClick?: (match: FibaMatch) => void;
  className?: string;
};

function QuarterScores({ linescores, isHome }: { linescores: number[]; isHome: boolean }) {
  if (!linescores || linescores.length === 0) return null;
  return (
    <div className="flex gap-1 text-[10px] text-muted-foreground font-mono tabular-nums">
      {linescores.map((score, i) => (
        <span key={i} className={cn(i === linescores.length - 1 && "font-semibold text-foreground")}>
          {score}
        </span>
      ))}
    </div>
  );
}

function TeamBadge({ team, score }: { team: FibaMatch["home"]; score: number | null }) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <img
        src={team.logo}
        alt={team.name}
        className="h-6 w-6 shrink-0 rounded-sm object-contain"
        onError={(e) => {
          e.currentTarget.style.display = "none";
        }}
      />
      <div className="flex flex-col min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-bold tracking-tight">{team.abbr}</span>
          {score != null && (
            <span className="text-lg font-black tabular-nums">{score}</span>
          )}
        </div>
        <span className="text-[10px] text-muted-foreground truncate">{team.name}</span>
      </div>
    </div>
  );
}

export function FibaGameCard({ match, onClick, className }: FibaGameCardProps) {
  const isLive = match.status === "in";
  const isPost = match.status === "post";
  const isPre = match.status === "pre";

  // Fetch stats pour le modèle de prédiction
  const { statsByAbbr } = useFibaStats();

  // Fetch cotes
  const { odds } = useFibaOdds(match.home.abbr, match.away.abbr);

  // Prédiction basée sur le modèle hybride (Elo + Four Factors + XGBoost)
  const prediction = useMemo(() => {
    const homeStats = statsByAbbr.get(match.home.abbr);
    const awayStats = statsByAbbr.get(match.away.abbr);

    return predictMatch({
      homeTeam: match.home.abbr,
      awayTeam: match.away.abbr,
      isHome: true,
      homeStats: homeStats ? {
        eFG: homeStats.eFG,
        TOV: homeStats.TOV,
        dREB: homeStats.rpg,
        FT: homeStats.FT,
        offensiveRating: homeStats.ORtg,
        defensiveRating: homeStats.DRtg,
        pace: homeStats.pace,
        trueShooting: homeStats.trueShooting,
        assistTurnoverRatio: homeStats.assistTurnoverRatio,
        benchPoints: homeStats.benchPoints,
        pointsInPaint: homeStats.pointsInPaint,
        fastBreakPoints: homeStats.fastBreakPoints,
      } : undefined,
      awayStats: awayStats ? {
        eFG: awayStats.eFG,
        TOV: awayStats.TOV,
        dREB: awayStats.rpg,
        FT: awayStats.FT,
        offensiveRating: awayStats.ORtg,
        defensiveRating: awayStats.DRtg,
        pace: awayStats.pace,
        trueShooting: awayStats.trueShooting,
        assistTurnoverRatio: awayStats.assistTurnoverRatio,
        benchPoints: awayStats.benchPoints,
        pointsInPaint: awayStats.pointsInPaint,
        fastBreakPoints: awayStats.fastBreakPoints,
      } : undefined,
    });
  }, [match.home.abbr, match.away.abbr, statsByAbbr]);

  // Calculer value bet si cotes disponibles
  const homeValue = odds ? calculateValue(prediction.blendedPHome, odds.bestHomeOdds) : null;
  const awayValue = odds ? calculateValue(1 - prediction.blendedPHome, odds.bestAwayOdds) : null;
  const hasValue = homeValue?.isValue || awayValue?.isValue;

  const pHome = Math.round(prediction.blendedPHome * 100);
  const pAway = Math.round((1 - prediction.blendedPHome) * 100);

  return (
    <div
      className={cn(
        "group relative rounded-xl border bg-card p-3 transition-all hover:border-primary/30 hover:shadow-md cursor-pointer",
        isLive && "border-emerald-500/40 shadow-emerald-500/10 shadow-sm",
        className,
      )}
      onClick={() => onClick?.(match)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick?.(match)}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Badge variant="outline" className="text-[9px] px-1.5 py-0 font-mono">
            {match.group ? `Group ${match.group}` : "FIBA"}
          </Badge>
          {isLive && (
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-bold text-emerald-500 uppercase">Live</span>
            </span>
          )}
          {isPost && (
            <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
              Final
            </Badge>
          )}
          {hasValue && (
            <Badge variant="default" className="bg-amber-500 text-[9px] px-1.5 py-0 animate-pulse">
              VALUE
            </Badge>
          )}
          {isPre && (
            <span className="text-[10px] text-muted-foreground font-mono">
              {new Date(match.date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </div>
        {match.broadcast && (
          <span className="text-[9px] text-muted-foreground">{match.broadcast}</span>
        )}
      </div>

      {/* Teams */}
      <div className="flex items-center justify-between mb-2">
        <TeamBadge team={match.home} score={match.home.score} />
        <div className="flex flex-col items-center px-2">
          <span className="text-[10px] text-muted-foreground font-medium">VS</span>
          {isLive && (
            <span className="text-[10px] font-mono text-emerald-500">
              Q{match.period} {match.clock}
            </span>
          )}
        </div>
        <TeamBadge team={match.away} score={match.away.score} />
      </div>

      {/* Quarter scores */}
      {(isLive || isPost) && (
        <div className="flex justify-between mb-2 px-1">
          <QuarterScores linescores={match.home.linescores} isHome />
          <QuarterScores linescores={match.away.linescores} isHome={false} />
        </div>
      )}

      {/* Win Probability Bar */}
      {pHome !== null && pAway !== null && (
        <WinProbabilityBar
          pHome={pHome}
          pAway={pAway}
          homeColor={match.home.color ? `#${match.home.color}` : "#2196f3"}
          awayColor={match.away.color ? `#${match.away.color}` : "#f44336"}
          homeAbbr={match.home.abbr}
          awayAbbr={match.away.abbr}
          size="sm"
        />
      )}

      {/* Edge & Recommendation */}
      {prediction.edge !== 0 && (
        <div className="flex items-center justify-between mt-1.5 text-[9px]">
          <span className={cn(
            "font-semibold",
            prediction.recommendation === "HOME" && "text-emerald-500",
            prediction.recommendation === "AWAY" && "text-red-500",
            prediction.recommendation === "NEUTRAL" && "text-muted-foreground",
          )}>
            {prediction.recommendation === "HOME" && `▲ ${match.home.abbr} +${Math.abs(Math.round(prediction.edge * 100))}%`}
            {prediction.recommendation === "AWAY" && `▼ ${match.away.abbr} +${Math.abs(Math.round(prediction.edge * 100))}%`}
            {prediction.recommendation === "NEUTRAL" && "Neutre"}
          </span>
          <span className="text-muted-foreground">
            {Math.round(prediction.blendedConfidence * 100)}% conf.
          </span>
        </div>
      )}

      {/* Odds Display */}
      {odds && (
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-muted/30 text-[9px]">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Cotes:</span>
            <span className={cn(
              "font-mono",
              homeValue?.isValue && "text-emerald-500 font-bold",
            )}>
              {odds.bestHomeOdds}
            </span>
            <span className="text-muted-foreground">/</span>
            <span className={cn(
              "font-mono",
              awayValue?.isValue && "text-emerald-500 font-bold",
            )}>
              {odds.bestAwayOdds}
            </span>
          </div>
          {odds.vig > 0 && (
            <span className="text-muted-foreground">
              Vig: {(odds.vig * 100).toFixed(1)}%
            </span>
          )}
        </div>
      )}

      {/* Predictive Bets (prematch & live) */}
      <FibaPredictiveBets
        match={match}
        prediction={prediction}
        homeStats={statsByAbbr.get(match.home.abbr)}
        awayStats={statsByAbbr.get(match.away.abbr)}
      />

      {/* Venue (pre-match) */}
      {isPre && match.venue && (
        <div className="mt-2 text-[9px] text-muted-foreground text-center">
          {match.venue}{match.city ? `, ${match.city}` : ""}
        </div>
      )}
    </div>
  );
}
