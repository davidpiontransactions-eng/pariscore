"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";

/**
 * MatchPredictor — Prédiction Poisson basée sur xG/xGA.
 * Calcule les probabilités de victoire/nul/défaite pour un match.
 */

type TeamStats = {
  name: string;
  xG: number;
  xGA: number;
  logo?: string;
};

type Prediction = {
  homeWin: number;
  draw: number;
  awayWin: number;
  homeGoals: number;
  awayGoals: number;
  over25: number;
  btts: number;
};

function poissonPMF(k: number, lambda: number): number {
  if (lambda <= 0) return k === 0 ? 1 : 0;
  let result = Math.exp(-lambda);
  for (let i = 1; i <= k; i++) {
    result *= lambda / i;
  }
  return result;
}

function predictMatch(home: TeamStats, away: TeamStats): Prediction {
  const homeAttack = home.xG;
  const homeDefense = home.xGA;
  const awayAttack = away.xG;
  const awayDefense = away.xGA;
  const leagueAvg = 1.35;
  const homeLambda = (homeAttack * awayDefense) / leagueAvg;
  const awayLambda = (awayAttack * homeDefense) / leagueAvg;
  const maxGoals = 6;
  let homeWin = 0, draw = 0, awayWin = 0, over25 = 0, btts = 0;
  for (let hg = 0; hg <= maxGoals; hg++) {
    for (let ag = 0; ag <= maxGoals; ag++) {
      const prob = poissonPMF(hg, homeLambda) * poissonPMF(ag, awayLambda);
      if (hg > ag) homeWin += prob;
      else if (hg === ag) draw += prob;
      else awayWin += prob;
      if (hg + ag > 2) over25 += prob;
      if (hg > 0 && ag > 0) btts += prob;
    }
  }
  return {
    homeWin: Math.round(homeWin * 100),
    draw: Math.round(draw * 100),
    awayWin: Math.round(awayWin * 100),
    homeGoals: Math.round(homeLambda * 10) / 10,
    awayGoals: Math.round(awayLambda * 10) / 10,
    over25: Math.round(over25 * 100),
    btts: Math.round(btts * 100),
  };
}

function probColor(prob: number): string {
  if (prob >= 50) return "text-[#00985f]";
  if (prob >= 35) return "text-yellow-400";
  return "text-zinc-400";
}

type Props = {
  home: TeamStats;
  away: TeamStats;
  className?: string;
};

export function MatchPredictor({ home, away, className }: Props) {
  const prediction = useMemo(() => predictMatch(home, away), [home, away]);

  return (
    <div className={cn("rounded-lg border border-zinc-800 bg-zinc-950/50 p-4", className)}>
      <h3 className="mb-3 text-sm font-semibold text-white">AI Match Prediction</h3>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {home.logo && <img src={home.logo} alt="" className="h-6 w-6 rounded-full" />}
          <span className="text-sm font-medium text-white">{home.name}</span>
        </div>
        <span className="text-xs text-zinc-500">vs</span>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white">{away.name}</span>
          {away.logo && <img src={away.logo} alt="" className="h-6 w-6 rounded-full" />}
        </div>
      </div>
      <div className="mb-4 flex items-center justify-center gap-3">
        <span className="text-2xl font-bold text-white">{prediction.homeGoals}</span>
        <span className="text-lg text-zinc-500">-</span>
        <span className="text-2xl font-bold text-white">{prediction.awayGoals}</span>
      </div>
      <div className="mb-3 flex h-2 overflow-hidden rounded-full bg-zinc-800">
        <div className="bg-[#00985f] transition-all" style={{ width: `${prediction.homeWin}%` }} />
        <div className="bg-zinc-600 transition-all" style={{ width: `${prediction.draw}%` }} />
        <div className="bg-[#DD3636] transition-all" style={{ width: `${prediction.awayWin}%` }} />
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <div className={cn("text-lg font-bold", probColor(prediction.homeWin))}>{prediction.homeWin}%</div>
          <div className="text-[10px] text-zinc-500">Home</div>
        </div>
        <div>
          <div className="text-lg font-bold text-zinc-400">{prediction.draw}%</div>
          <div className="text-[10px] text-zinc-500">Draw</div>
        </div>
        <div>
          <div className={cn("text-lg font-bold", probColor(prediction.awayWin))}>{prediction.awayWin}%</div>
          <div className="text-[10px] text-zinc-500">Away</div>
        </div>
      </div>
      <div className="mt-3 flex justify-between border-t border-zinc-800 pt-3 text-xs">
        <div className="text-center">
          <div className="font-medium text-white">{prediction.over25}%</div>
          <div className="text-zinc-500">Over 2.5</div>
        </div>
        <div className="text-center">
          <div className="font-medium text-white">{prediction.btts}%</div>
          <div className="text-zinc-500">BTTS</div>
        </div>
      </div>
    </div>
  );
}
