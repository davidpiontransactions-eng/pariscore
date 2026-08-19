"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { CountryFlag } from "./country-flag";
import { getInitials } from "./player-profile-header";

type PlayerInfo = {
  name: string;
  shortName: string;
  color: string;
  photoUrl?: string | null;
  country?: string | null;
  rank?: number;
  elo?: number;
};

type PlayerVsBlockProps = {
  playerA: PlayerInfo;
  playerB: PlayerInfo;
  probA: number;
  probB: number;
  centerSlot?: ReactNode;
  playerSlot?: (player: PlayerInfo, side: "left" | "right") => ReactNode;
  className?: string;
  terminalMode?: boolean;
};

function PlayerAvatar({
  src,
  name,
  color,
  initials,
  size,
}: {
  src?: string | null;
  name: string;
  color: string;
  initials: string;
  size: "sm" | "lg";
}) {
  const dims = size === "sm" ? "h-10 w-10" : "h-16 w-16";
  return (
    <div
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-full text-xs font-bold uppercase tracking-wider text-muted-foreground ring-2 ring-offset-2 ring-offset-background",
        dims,
      )}
      style={
        {
          "--tw-ring-color": color,
          backgroundColor: `${color}15`,
        } as React.CSSProperties
      }
    >
      {src ? (
        <img
          src={src}
          alt={name}
          loading="lazy"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
          }}
        />
      ) : null}
      <span aria-hidden={src ? "true" : "false"}>{initials}</span>
    </div>
  );
}

export function PlayerVsBlock({
  playerA,
  playerB,
  probA,
  probB,
  centerSlot,
  playerSlot,
  className,
  terminalMode = false,
}: PlayerVsBlockProps) {
  const avatarSize = terminalMode ? "sm" : "lg";

  return (
    <div className={cn("rounded-lg border border-border/60 bg-card p-4", className)}>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
        <div className="flex flex-col items-center gap-2">
          <PlayerAvatar
            src={playerA.photoUrl}
            name={playerA.name}
            color={playerA.color}
            initials={getInitials(playerA.name)}
            size={avatarSize}
          />
          <div className="flex items-center gap-1">
            <CountryFlag countryCode={playerA.country} size="sm" />
            <span className="text-sm font-bold" style={{ color: playerA.color }}>
              {playerA.shortName}
            </span>
          </div>
          {playerSlot?.(playerA, "left")}
        </div>

        <div className="flex flex-col items-center gap-1">
          {centerSlot ?? (
            <span className="rounded-full bg-muted px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              VS
            </span>
          )}
        </div>

        <div className="flex flex-col items-center gap-2">
          <PlayerAvatar
            src={playerB.photoUrl}
            name={playerB.name}
            color={playerB.color}
            initials={getInitials(playerB.name)}
            size={avatarSize}
          />
          <div className="flex items-center gap-1">
            <span className="text-sm font-bold" style={{ color: playerB.color }}>
              {playerB.shortName}
            </span>
            <CountryFlag countryCode={playerB.country} size="sm" />
          </div>
          {playerSlot?.(playerB, "right")}
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <div className="flex-1">
          <div className="flex justify-between text-[11px] text-muted-foreground">
            <span className="font-medium" style={{ color: playerA.color }}>
              {playerA.shortName}
            </span>
            <span className="font-mono font-bold">{probA.toFixed(0)}%</span>
          </div>
          <div className="mt-0.5 h-2.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full transition-all duration-500 ease-out"
              style={{ width: `${probA}%`, background: playerA.color }}
            />
          </div>
        </div>
        <span className="shrink-0 text-[11px] font-semibold text-muted-foreground">
          PROB
        </span>
        <div className="flex-1">
          <div className="flex justify-between text-[11px] text-muted-foreground">
            <span className="font-mono font-bold">{probB.toFixed(0)}%</span>
            <span className="font-medium" style={{ color: playerB.color }}>
              {playerB.shortName}
            </span>
          </div>
          <div className="mt-0.5 h-2.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full transition-all duration-500 ease-out"
              style={{ width: `${probB}%`, background: playerB.color }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}