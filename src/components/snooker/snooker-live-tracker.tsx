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
        "w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-mono border transition-all",
        isActive && "ring-2 ring-emerald-500/50",
        winner === "A" && "bg-emerald-500/20 border-emerald-500/40 text-emerald-400",
        winner === "B" && "bg-blue-500/20 border-blue-500/40 text-blue-400",
        !winner && "bg-zinc-800 border-zinc-700 text-zinc-500"
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
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-emerald-400 font-medium">{playerAName}</span>
        <span className="text-zinc-500">
          {winsA}-{winsB}
          {isLive && <span className="ml-2 animate-pulse text-red-400">● LIVE</span>}
        </span>
        <span className="text-blue-400 font-medium">{playerBName}</span>
      </div>

      {/* Progress bars */}
      <div className="flex gap-1">
        <div className="flex-1 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
          <div
            className="h-full bg-emerald-500 rounded-full transition-all duration-500"
            style={{ width: `${(winsA / framesToWin) * 100}%` }}
          />
        </div>
        <div className="flex-1 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
          <div
            className="h-full bg-blue-500 rounded-full transition-all duration-500"
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
              isActive={isLive && currentFrame === i + 1}
            />
          );
        })}
      </div>

      {/* Current frame details */}
      {isLive && frames.length > 0 && (
        <div className="bg-zinc-900/50 rounded-lg p-3 border border-zinc-800">
          <div className="text-[10px] text-zinc-500 mb-2">Frame {frames.length} en cours</div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-zinc-500">Break max A:</span>{" "}
              <span className="font-mono text-emerald-400">
                {frames[frames.length - 1]?.highestBreakA || "-"}
              </span>
            </div>
            <div>
              <span className="text-zinc-500">Break max B:</span>{" "}
              <span className="font-mono text-blue-400">
                {frames[frames.length - 1]?.highestBreakB || "-"}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Needs X more */}
      <div className="flex justify-between text-[10px] text-zinc-600">
        <span>{playerAName}: {framesToWin - winsA > 0 ? `${framesToWin - winsA} pour gagner` : "GAGNANT"}</span>
        <span>{playerBName}: {framesToWin - winsB > 0 ? `${framesToWin - winsB} pour gagner` : "GAGNANT"}</span>
      </div>
    </div>
  );
}
