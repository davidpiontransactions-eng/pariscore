"use client";

import type { PitcherRecord } from "@/lib/baseball/types";
import { fmtNum, fmtWinLoss } from "@/lib/baseball/format";

interface PitcherBadgeProps {
  pitcher: PitcherRecord;
  side: "home" | "away";
  compact?: boolean;
}

const HAND_COLORS: Record<PitcherRecord["throws"], string> = {
  LHP: "text-sky-300 border-sky-500/40 bg-sky-500/10",
  RHP: "text-rose-300 border-rose-500/40 bg-rose-500/10",
};

/**
 * Badge lanceur partant : monogramme (pas de photos API → avatar généré,
 * jamais d'image vide), nom, main de lancer et fiche ERA / W-L / WHIP.
 */
export function PitcherBadge({ pitcher, side, compact = false }: PitcherBadgeProps) {
  const initials = pitcher.name
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  if (compact) {
    return (
      <div className="flex min-w-0 items-center gap-2">
        <span
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[10px] font-bold text-white"
          style={{
            background:
              side === "home"
                ? "linear-gradient(135deg,#0ea5e9,#1d4ed8)"
                : "linear-gradient(135deg,#f43f5e,#9f1239)",
          }}
        >
          {initials || "SP"}
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[12px] font-semibold text-slate-100">
              {pitcher.name}
            </span>
            <span
              className={`rounded border px-1 py-px text-[9px] font-bold leading-3 ${HAND_COLORS[pitcher.throws]}`}
            >
              {pitcher.throws}
            </span>
          </div>
          <div className="font-mono text-[10px] text-slate-400">
            ERA {fmtNum(pitcher.era)} · {fmtWinLoss(pitcher.wins, pitcher.losses)} · WHIP{" "}
            {fmtNum(pitcher.whip)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <span
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white shadow-lg"
        style={{
          background:
            side === "home"
              ? "linear-gradient(135deg,#0ea5e9,#1d4ed8)"
              : "linear-gradient(135deg,#f43f5e,#9f1239)",
        }}
      >
        {initials || "SP"}
      </span>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-semibold text-slate-100">{pitcher.name}</span>
          <span
            className={`rounded border px-1.5 py-px text-[10px] font-bold leading-3.5 ${HAND_COLORS[pitcher.throws]}`}
          >
            {pitcher.throws}
          </span>
        </div>
        <div className="mt-0.5 font-mono text-xs text-slate-400">
          ERA {fmtNum(pitcher.era)} · WHIP {fmtNum(pitcher.whip)} · {fmtWinLoss(pitcher.wins, pitcher.losses)}
        </div>
      </div>
    </div>
  );
}
