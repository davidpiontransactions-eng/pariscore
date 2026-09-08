"use client";

import { cn } from "@/lib/utils";

interface Frame {
  frameNumber: number;
  scoreA: number;
  scoreB: number;
  winner?: "A" | "B";
  highestBreakA?: number;
  highestBreakB?: number;
  centuryA?: number;
  centuryB?: number;
}

interface SnookerLiveTrackerProps {
  frames: Frame[];
  bestOf: number;
  playerAName: string;
  playerBName: string;
  isLive?: boolean;
}

function FrameDot({ winner, isActive, frameNum }: { winner?: "A" | "B"; isActive: boolean; frameNum: number }) {
  return (
    <div
      className={cn(
        "w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-mono border transition-all duration-300",
        isActive && "ring-2 ring-emerald-500/50 shadow-lg shadow-emerald-500/20",
        winner === "A" && "bg-emerald-500/20 border-emerald-500/40 text-emerald-400 shadow-sm shadow-emerald-500/10",
        winner === "B" && "bg-blue-500/20 border-blue-500/40 text-blue-400 shadow-sm shadow-blue-500/10",
        !winner && "bg-zinc-800/80 border-zinc-700/50 text-zinc-500"
      )}
    >
      {frameNum}
    </div>
  );
}

export function SnookerLiveTracker({ frames, bestOf, playerAName, playerBName, isLive }: SnookerLiveTrackerProps) {
  const framesToWin = Math.ceil(bestOf / 2);
  const winsA = frames.filter((f) => f.winner === "A").length;
  const winsB = frames.filter((f) => f.winner === "B").length;
  const currentFrame = frames.length + 1;
  const maxFrames = bestOf;
  const isDecider = winsA === framesToWin - 1 && winsB === framesToWin - 1;

  return (
    <div className="space-y-4">
      {/* Header avec scores néon */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-emerald-400">{playerAName}</span>
          <span className="font-mono text-2xl font-bold text-emerald-400">{winsA}</span>
        </div>
        {isLive && (
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full scale-150 animate-ping rounded-full bg-red-500 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
            </span>
            <span className="text-[11px] font-bold uppercase tracking-wider text-red-400">LIVE</span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <span className="font-mono text-2xl font-bold text-blue-400">{winsB}</span>
          <span className="text-sm font-semibold text-blue-400">{playerBName}</span>
        </div>
      </div>

      {/* Progress bars néon */}
      <div className="flex gap-1.5">
        <div className="flex-1 h-2 rounded-full bg-zinc-800 overflow-hidden">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all duration-700 shadow-sm shadow-emerald-500/30"
            style={{ width: `${(winsA / framesToWin) * 100}%` }}
          />
        </div>
        <div className="flex-1 h-2 rounded-full bg-zinc-800 overflow-hidden">
          <div
            className="h-full rounded-full bg-blue-500 transition-all duration-700 shadow-sm shadow-blue-500/30"
            style={{ width: `${(winsB / framesToWin) * 100}%` }}
          />
        </div>
      </div>

      {/* Frame dots */}
      <div className="flex items-center justify-center gap-1.5">
        {Array.from({ length: maxFrames }, (_, i) => {
          const frame = frames[i];
          return (
            <FrameDot
              key={i}
              frameNum={i + 1}
              winner={frame?.winner}
              isActive={!!isLive && currentFrame === i + 1}
            />
          );
        })}
      </div>

      {/* Current frame details — glass panel */}
      {isLive && frames.length > 0 && (
        <div className="bg-zinc-900/60 backdrop-blur-sm rounded-lg p-3 border border-zinc-800/60">
          <div className="text-[10px] text-zinc-500 mb-2 font-medium uppercase tracking-wider">
            Frame {frames.length} en cours
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/60" />
              <span className="text-zinc-500">Break max A:</span>
              <span className="font-mono font-semibold text-emerald-400">
                {frames[frames.length - 1]?.highestBreakA || "—"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500/60" />
              <span className="text-zinc-500">Break max B:</span>
              <span className="font-mono font-semibold text-blue-400">
                {frames[frames.length - 1]?.highestBreakB || "—"}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Needs X more — statut néon */}
      <div className="flex justify-between text-[10px]">
        <div className={cn("font-medium", winsA >= framesToWin ? "text-emerald-400" : "text-zinc-600")}>
          {playerAName}: {winsA >= framesToWin ? "🏆 GAGNANT" : `${framesToWin - winsA} frame(s) pour gagner`}
        </div>
        <div className={cn("font-medium", winsB >= framesToWin ? "text-blue-400" : "text-zinc-600")}>
          {playerBName}: {winsB >= framesToWin ? "🏆 GAGNANT" : `${framesToWin - winsB} frame(s) pour gagner`}
        </div>
      </div>
    </div>
  );
}
