"use client";

import { useState } from "react";
import type { PitcherRecord } from "@/lib/baseball/types";
import { fmtNum, fmtWinLoss } from "@/lib/baseball/format";

interface PitcherBadgeProps {
  pitcher: PitcherRecord;
  side: "home" | "away";
  compact?: boolean;
}

const HAND_COLORS: Record<NonNullable<PitcherRecord["throws"]>, string> = {
  LHP: "text-sky-300 border-sky-500/40 bg-sky-500/10",
  RHP: "text-rose-300 border-rose-500/40 bg-rose-500/10",
};

const UNKNOWN_HAND_BADGE = "rounded border px-1 py-px text-[9px] font-bold leading-3 text-slate-400 border-slate-600/60 bg-slate-700/30";
const UNKNOWN_HAND_BADGE_LG = "rounded border px-1.5 py-px text-[10px] font-bold leading-3.5 text-slate-400 border-slate-600/60 bg-slate-700/30";

interface AvatarProps {
  pitcher: PitcherRecord;
  side: "home" | "away";
  initials: string;
  size: number;
  failed: boolean;
  onError: () => void;
}

function PitcherAvatar({ pitcher, side, initials, size, failed, onError }: AvatarProps) {
  const hasPhoto = !!pitcher.photoUrl && !failed;
  const gradient =
    side === "home"
      ? "linear-gradient(135deg,#0ea5e9,#1d4ed8)"
      : "linear-gradient(135deg,#f43f5e,#9f1239)";

  if (hasPhoto) {
    return (
      <span
        className="flex shrink-0 items-center justify-center overflow-hidden rounded-md ring-1 ring-white/10"
        style={{ width: size, height: size }}
      >
        <img
          src={pitcher.photoUrl}
          alt={pitcher.name}
          loading="lazy"
          onError={onError}
          className="h-full w-full object-cover"
        />
      </span>
    );
  }
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-md font-bold text-white"
      style={{ width: size, height: size, background: gradient, fontSize: size * 0.34 }}
    >
      {initials || "SP"}
    </span>
  );
}

/**
 * Badge lanceur partant : photo portrait officielle MLB si disponible
 * (photoUrl), sinon avatar initiales coloré. Rien ne casse jamais — règle
 * QA "zéro donnée factice" / onError → fallback initiales.
 */
export function PitcherBadge({ pitcher, side, compact = false }: PitcherBadgeProps) {
  const [photoFailed, setPhotoFailed] = useState(false);
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
        <PitcherAvatar
          pitcher={pitcher}
          side={side}
          initials={initials}
          size={26}
          failed={photoFailed}
          onError={() => setPhotoFailed(true)}
        />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[12px] font-semibold text-slate-100">
              {pitcher.name}
            </span>
            {pitcher.throws ? (
              <span
                className={`rounded border px-1 py-px text-[9px] font-bold leading-3 ${HAND_COLORS[pitcher.throws]}`}
              >
                {pitcher.throws}
              </span>
            ) : (
              <span className={UNKNOWN_HAND_BADGE}>—</span>
            )}
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
      <PitcherAvatar
        pitcher={pitcher}
        side={side}
        initials={initials}
        size={44}
        failed={photoFailed}
        onError={() => setPhotoFailed(true)}
      />
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-semibold text-slate-100">{pitcher.name}</span>
          {pitcher.throws ? (
            <span
              className={`rounded border px-1.5 py-px text-[10px] font-bold leading-3.5 ${HAND_COLORS[pitcher.throws]}`}
            >
              {pitcher.throws}
            </span>
          ) : (
            <span className={UNKNOWN_HAND_BADGE_LG}>—</span>
          )}
        </div>
        <div className="mt-0.5 font-mono text-xs text-slate-400">
          ERA {fmtNum(pitcher.era)} · WHIP {fmtNum(pitcher.whip)} · {fmtWinLoss(pitcher.wins, pitcher.losses)}
        </div>
      </div>
    </div>
  );
}