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
  return (
    <div className="flex flex-col items-center">
      <LivePulse />
      {current && (
        <span className="text-sm font-extrabold text-[#1A1145] mt-0.5 tabular-nums">{current}</span>
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
  return (
    <div className="flex flex-col items-center">
      <LivePulse />
      {sets && sets.length > 0 && (
        <span className="text-[10px] text-[#1A1145] font-bold mt-0.5 tabular-nums">
          {sets.join(" | ")}
        </span>
      )}
      {gameScore && (
        <span className="text-[10px] text-[#4CAF50] font-semibold">{gameScore}</span>
      )}
      {serving && (
        <span className="text-[8px] text-[#7B3FA0] opacity-80">🎾 {serving}</span>
      )}
    </div>
  );
}

/** Basketball : quart-temps + chrono + score */
function BasketballScore({ current, quarters, clock, period }: Pick<LiveMatchScore, "current" | "quarters" | "clock" | "period">) {
  return (
    <div className="flex flex-col items-center">
      <LivePulse />
      {current && (
        <span className="text-sm font-extrabold text-[#1A1145] mt-0.5 tabular-nums">{current}</span>
      )}
      <div className="flex items-center gap-1 text-[9px] text-[#4CAF50] font-semibold">
        {period && <span>{period}</span>}
        {clock && <span className="tabular-nums">{clock}</span>}
      </div>
    </div>
  );
}

/** CS2 : cartes BO + rounds map en cours */
function CS2Score({ maps, rounds, currentMap }: Pick<LiveMatchScore, "maps" | "rounds" | "currentMap">) {
  return (
    <div className="flex flex-col items-center">
      <LivePulse />
      {maps && (
        <span className="text-sm font-extrabold text-[#1A1145] mt-0.5 tabular-nums">{maps}</span>
      )}
      <div className="flex items-center gap-1 text-[9px] text-[#4CAF50] font-semibold">
        {currentMap && <span>{currentMap}</span>}
        {rounds && <span className="tabular-nums">{rounds}</span>}
      </div>
    </div>
  );
}

/** MMA : round + chrono */
function MMAScore({ round, roundClock }: Pick<LiveMatchScore, "round" | "roundClock">) {
  return (
    <div className="flex flex-col items-center">
      <LivePulse />
      {round && (
        <span className="text-[10px] font-extrabold text-[#1A1145] mt-0.5">R{round}</span>
      )}
      {roundClock && (
        <span className="text-[9px] text-[#4CAF50] font-semibold tabular-nums">{roundClock}</span>
      )}
    </div>
  );
}

export function LiveScoreBadge({ sport, liveScore, homeName, awayName }: LiveScoreBadgeProps) {
  if (!liveScore) return <LivePulse />;

  const s = sport.toLowerCase();

  // Score courant par défaut
  const defaultDisplay = liveScore.current ? (
    <div className="flex flex-col items-center">
      <LivePulse />
      <span className="text-sm font-extrabold text-[#1A1145] mt-0.5 tabular-nums">{liveScore.current}</span>
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
