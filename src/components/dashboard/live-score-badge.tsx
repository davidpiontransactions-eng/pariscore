"use client";

import { cn } from "@/lib/utils";
import type { LiveMatchScore } from "@/lib/top-matches/types";

interface LiveScoreBadgeProps {
  sport: string;
  liveScore: LiveMatchScore;
  homeName: string;
  awayName: string;
}

/** Badge indicateur Live avec pulsation */
function LivePulse({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-[#4CAF50] text-white text-[9px] font-bold", className)}>
      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
      LIVE
    </span>
  );
}

/** Football : minute + score + mi-temps */
function FootballScore({ current, minute, halfTime }: Pick<LiveMatchScore, "current" | "minute" | "halfTime">) {
  const display = typeof current === 'string' ? current : current != null ? String(current) : null;
  return (
    <div className="flex flex-col items-center">
      <LivePulse />
      {display && (
        <span className="text-sm font-extrabold text-[#1A1145] mt-0.5 tabular-nums">{display}</span>
      )}
      <div className="flex items-center gap-1 text-[9px] text-[#4CAF50] font-semibold">
        {minute != null && <span>{minute}&apos;</span>}
        {halfTime && <span className="opacity-70">{halfTime}</span>}
      </div>
    </div>
  );
}

/** Tennis : sets + jeux + serveur */
function TennisScore({ current, sets, gameScore, serving }: Pick<LiveMatchScore, "current" | "sets" | "gameScore" | "serving">) {
  const safeSets = Array.isArray(sets) ? sets.map(String) : [];
  const safeGame = typeof gameScore === 'string' ? gameScore : gameScore != null ? String(gameScore) : null;
  const safeServing = typeof serving === 'string' ? serving : serving != null ? String(serving) : null;
  return (
    <div className="flex flex-col items-center">
      <LivePulse />
      {safeSets.length > 0 && (
        <span className="text-[10px] text-[#1A1145] font-bold mt-0.5 tabular-nums">
          {safeSets.join(" | ")}
        </span>
      )}
      {safeGame && (
        <span className="text-[10px] text-[#4CAF50] font-semibold">{safeGame}</span>
      )}
      {safeServing && (
        <span className="text-[8px] text-[#7B3FA0] opacity-80">🎾 {safeServing}</span>
      )}
    </div>
  );
}

/** Basketball : quart-temps + chrono + score */
function BasketballScore({ current, quarters, clock, period }: Pick<LiveMatchScore, "current" | "quarters" | "clock" | "period">) {
  const display = typeof current === 'string' ? current : current != null ? String(current) : null;
  const safePeriod = typeof period === 'string' ? period : period != null ? String(period) : null;
  const safeClock = typeof clock === 'string' ? clock : clock != null ? String(clock) : null;
  return (
    <div className="flex flex-col items-center">
      <LivePulse />
      {display && (
        <span className="text-sm font-extrabold text-[#1A1145] mt-0.5 tabular-nums">{display}</span>
      )}
      <div className="flex items-center gap-1 text-[9px] text-[#4CAF50] font-semibold">
        {safePeriod && <span>{safePeriod}</span>}
        {safeClock && <span className="tabular-nums">{safeClock}</span>}
      </div>
    </div>
  );
}

/** CS2 : cartes BO + rounds map en cours */
function CS2Score({ maps, rounds, currentMap }: Pick<LiveMatchScore, "maps" | "rounds" | "currentMap">) {
  const safeMaps = typeof maps === 'string' ? maps : maps != null ? String(maps) : null;
  const safeRounds = typeof rounds === 'string' ? rounds : rounds != null ? String(rounds) : null;
  const safeMap = typeof currentMap === 'string' ? currentMap : currentMap != null ? String(currentMap) : null;
  return (
    <div className="flex flex-col items-center">
      <LivePulse />
      {safeMaps && (
        <span className="text-sm font-extrabold text-[#1A1145] mt-0.5 tabular-nums">{safeMaps}</span>
      )}
      <div className="flex items-center gap-1 text-[9px] text-[#4CAF50] font-semibold">
        {safeMap && <span>{safeMap}</span>}
        {safeRounds && <span className="tabular-nums">{safeRounds}</span>}
      </div>
    </div>
  );
}

/** MMA : round + chrono */
function MMAScore({ round, roundClock }: Pick<LiveMatchScore, "round" | "roundClock">) {
  const safeRound = typeof round === 'number' ? round : round != null ? Number(round) : null;
  const safeClock = typeof roundClock === 'string' ? roundClock : roundClock != null ? String(roundClock) : null;
  return (
    <div className="flex flex-col items-center">
      <LivePulse />
      {safeRound != null && !isNaN(safeRound) && (
        <span className="text-[10px] font-extrabold text-[#1A1145] mt-0.5">R{safeRound}</span>
      )}
      {safeClock && (
        <span className="text-[9px] text-[#4CAF50] font-semibold tabular-nums">{safeClock}</span>
      )}
    </div>
  );
}

export function LiveScoreBadge({ sport, liveScore, homeName, awayName }: LiveScoreBadgeProps) {
  if (!liveScore) return <LivePulse />;

  const s = typeof sport === 'string' ? sport.toLowerCase() : '';

  // Sécuriser current : peut être un objet
  const safeCurrent = typeof liveScore.current === 'string'
    ? liveScore.current
    : liveScore.current != null
    ? String(liveScore.current)
    : null;

  // Score courant par défaut
  const defaultDisplay = safeCurrent ? (
    <div className="flex flex-col items-center">
      <LivePulse />
      <span className="text-sm font-extrabold text-[#1A1145] mt-0.5 tabular-nums">{safeCurrent}</span>
    </div>
  ) : (
    <LivePulse />
  );

  if (s === "football") {
    return <FootballScore {...liveScore} />;
  }
  if (s === "tennis") {
    return <TennisScore {...liveScore} />;
  }
  if (s === "nba" || s === "wnba" || s === "basketball" || s === "fiba") {
    return <BasketballScore {...liveScore} />;
  }
  if (s === "cs2") {
    return <CS2Score {...liveScore} />;
  }
  if (s === "mma") {
    return <MMAScore {...liveScore} />;
  }

  return defaultDisplay;
}
