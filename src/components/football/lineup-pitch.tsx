"use client";

import { cn } from "@/lib/utils";

export type PitchPlayer = {
  player: string;
  position: string; // "GK", "DEF", "MID", "FWD"
  rating?: number | null;
  isAbsence?: boolean;
};

type Props = {
  lineups?: { home: PitchPlayer[]; away: PitchPlayer[] } | null;
  homeName?: string;
  awayName?: string;
  formationHome?: string | null;
  formationAway?: string | null;
};

const POS_ROWS: Record<string, number> = { GK: 0, DEF: 1, MID: 2, FWD: 3 };

function ratingColor(r: number | null | undefined): string {
  if (r == null) return "bg-slate-500/20 text-slate-300 border-slate-500/40";
  if (r >= 7) return "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";
  if (r >= 6) return "bg-amber-500/20 text-amber-300 border-amber-500/40";
  return "bg-rose-500/20 text-rose-300 border-rose-500/40";
}

function PlayerPin({ player }: { player: PitchPlayer }) {
  return (
    <div
      className={cn(
        "flex h-9 w-9 flex-col items-center justify-center rounded-full border text-[10px] font-bold transition-transform hover:scale-110",
        player.isAbsence ? "border-rose-500/50 bg-rose-900/30 text-rose-400 opacity-60" : "border-emerald-400/40 bg-slate-900/80 text-slate-100",
      )}
      title={player.player}
    >
      <span className="max-w-[36px] truncate leading-none">{player.player.split(" ").pop()}</span>
      {player.rating != null && (
        <span className={cn("text-[8px] font-normal", ratingColor(player.rating).split(" ")[1])}>{player.rating.toFixed(1)}</span>
      )}
    </div>
  );
}

function TeamLineup({ players, side, name, formation }: { players: PitchPlayer[]; side: "home" | "away"; name?: string; formation?: string | null }) {
  const groups: Record<number, PitchPlayer[]> = { 0: [], 1: [], 2: [], 3: [] };
  for (const p of players) {
    const row = POS_ROWS[p.position] ?? 1;
    groups[row].push(p);
  }
  const rowOrder = side === "home" ? [3, 2, 1, 0] : [0, 1, 2, 3];

  return (
    <div className="flex flex-col items-center gap-1">
      {name && <div className="mb-1 text-xs font-semibold text-slate-400">{name} {formation && <span className="text-slate-600">({formation})</span>}</div>}
      {rowOrder.map((rowIdx) => (
        <div key={rowIdx} className="flex gap-2">
          {groups[rowIdx].length === 0 ? (
            <div className="h-9 w-9" />
          ) : (
            groups[rowIdx].map((p, i) => <PlayerPin key={i} player={p} />)
          )}
        </div>
      ))}
    </div>
  );
}

export function LineupPitch({ lineups, homeName, awayName, formationHome, formationAway }: Props) {
  if (!lineups || (lineups.home.length === 0 && lineups.away.length === 0)) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border border-slate-700/50 bg-slate-900/30 text-sm text-slate-500">
        Compositions indisponibles
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-xl border border-slate-700/50 bg-gradient-to-b from-emerald-900/20 via-slate-900/50 to-emerald-900/20 p-4">
      {/* Terrain lignes */}
      <div className="pointer-events-none absolute inset-0 opacity-20">
        <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-emerald-400" />
        <div className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border border-emerald-400" />
      </div>
      <div className="relative flex items-center justify-around gap-4">
        <TeamLineup players={lineups.home} side="home" name={homeName} formation={formationHome} />
        <div className="text-xs font-bold text-slate-600">VS</div>
        <TeamLineup players={lineups.away} side="away" name={awayName} formation={formationAway} />
      </div>
    </div>
  );
}
