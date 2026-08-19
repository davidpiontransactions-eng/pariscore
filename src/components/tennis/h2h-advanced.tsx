"use client";

import { cn } from "@/lib/utils";
import { Calendar, Trophy } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PlayerInfo = {
  name: string;
  shortName: string;
  elo: number;
};

type SurfaceBreakdown = {
  surface: string;
  wonA: number;
  wonB: number;
};

type RecentMatch = {
  date: string;
  tournament: string;
  surface: string;
  score: string;
  winner: "A" | "B";
  stats?: {
    acesA: number;
    acesB: number;
    dfsA: number;
    dfsB: number;
  };
};

type H2HData = {
  total: { wonA: number; wonB: number };
  bySurface?: SurfaceBreakdown[];
  recentMatches?: RecentMatch[];
};

type H2HAdvancedProps = {
  playerA: PlayerInfo;
  playerB: PlayerInfo;
  h2h: H2HData;
  className?: string;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SURFACE_LABELS: Record<string, string> = {
  Dur: "Dur",
  Hard: "Dur",
  Terre: "Terre",
  "Terre battue": "Terre",
  Clay: "Terre",
  Gazon: "Gazon",
  Grass: "Gazon",
};

const SURFACE_ICONS: Record<string, string> = {
  Dur: "🟦",
  Terre: "🟠",
  Gazon: "🟢",
};

const SURFACE_ORDER = ["Dur", "Terre", "Gazon"];

function normalizeSurface(raw: string): string {
  return SURFACE_LABELS[raw] ?? raw;
}

// ---------------------------------------------------------------------------
// Win bar sub-component
// ---------------------------------------------------------------------------

function WinBar({
  wonA,
  wonB,
  colorA = "#4ade80",
  colorB = "#f87171",
}: {
  wonA: number;
  wonB: number;
  colorA?: string;
  colorB?: string;
}) {
  const total = wonA + wonB;
  const pctA = total > 0 ? (wonA / total) * 100 : 50;
  const pctB = total > 0 ? (wonB / total) * 100 : 50;

  return (
    <div className="flex items-center gap-3">
      <span
        className="min-w-[2ch] text-right text-sm font-bold tabular-nums"
        style={{ color: colorA }}
      >
        {wonA}
      </span>
      <div className="flex h-2 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-l-full transition-all duration-500"
          style={{ width: `${pctA}%`, background: colorA }}
        />
        <div
          className="h-full rounded-r-full transition-all duration-500"
          style={{ width: `${pctB}%`, background: colorB }}
        />
      </div>
      <span
        className="min-w-[2ch] text-sm font-bold tabular-nums"
        style={{ color: colorB }}
      >
        {wonB}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Surface card sub-component
// ---------------------------------------------------------------------------

function SurfaceCard({
  surface,
  wonA,
  wonB,
  playerAShort,
  playerBShort,
}: {
  surface: string;
  wonA: number;
  wonB: number;
  playerAShort: string;
  playerBShort: string;
}) {
  const icon = SURFACE_ICONS[surface] ?? "🎾";
  const total = wonA + wonB;

  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-border/60 bg-card/60 p-3">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {icon} {surface}
      </span>

      {total === 0 ? (
        <p className="text-xs text-muted-foreground/60">Aucun match</p>
      ) : (
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-sm font-bold text-foreground">
              {playerAShort}
            </span>
            <span className="text-xs text-muted-foreground">
              {wonA} {wonA <= 1 ? "victoire" : "victoires"}
            </span>
          </div>
          <span className="text-[11px] font-semibold text-muted-foreground">
            vs
          </span>
          <div className="flex flex-col text-right">
            <span className="text-sm font-bold text-foreground">
              {playerBShort}
            </span>
            <span className="text-xs text-muted-foreground">
              {wonB} {wonB <= 1 ? "victoire" : "victoires"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Recent match row sub-component
// ---------------------------------------------------------------------------

function RecentMatchRow({
  match,
  playerAShort,
  playerBShort,
}: {
  match: RecentMatch;
  playerAShort: string;
  playerBShort: string;
}) {
  const dateStr = new Date(match.date).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });

  return (
    <div
      className={cn(
        "grid items-center gap-x-3 gap-y-1 border-b border-border/40 px-3 py-2 text-xs transition-colors last:border-b-0 hover:bg-muted/40",
        "grid-cols-[auto_1fr_auto_auto]",
        "sm:grid-cols-[auto_auto_1fr_auto_auto_auto_auto]",
      )}
    >
      {/* Date */}
      <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
        {dateStr}
      </span>

      {/* Tournament — hidden on mobile */}
      <span className="hidden truncate text-muted-foreground sm:block">
        {match.tournament}
      </span>

      {/* Surface badge */}
      <span className="inline-flex items-center rounded border border-border/60 bg-muted/30 px-1.5 py-0.5 text-[11px] font-bold uppercase text-muted-foreground">
        {normalizeSurface(match.surface)}
      </span>

      {/* Score */}
      <span className="text-right font-mono text-sm tabular-nums text-foreground">
        {match.score}
      </span>

      {/* Winner badge */}
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-bold uppercase leading-none",
          match.winner === "A"
            ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
            : "bg-rose-500/15 text-rose-600 dark:text-rose-400",
        )}
      >
        {match.winner === "A" ? playerAShort : playerBShort}
      </span>

      {/* Aces */}
      {match.stats ? (
        <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
          A {match.stats.acesA}-{match.stats.acesB}
        </span>
      ) : (
        <span className="text-[11px] text-muted-foreground/40">—</span>
      )}

      {/* Double faults */}
      {match.stats ? (
        <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
          DF {match.stats.dfsA}-{match.stats.dfsB}
        </span>
      ) : (
        <span className="text-[11px] text-muted-foreground/40">—</span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component — H2HAdvanced
// ---------------------------------------------------------------------------

export function H2HAdvanced({
  playerA,
  playerB,
  h2h,
  className,
}: H2HAdvancedProps) {
  const { total, bySurface, recentMatches } = h2h;

  // Build a lookup from normalised surface → breakdown
  const surfaceMap = new Map<string, SurfaceBreakdown>();
  bySurface?.forEach((s) => {
    surfaceMap.set(normalizeSurface(s.surface), s);
  });

  const hasRecentMatches = recentMatches && recentMatches.length > 0;

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {/* ---- H2H Summary ---- */}
      <div className="rounded-lg border border-border/60 bg-card p-4">
        <h3 className="mb-3 text-center text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          Face-à-face
        </h3>

        <div className="flex items-center gap-3">
          <span className="min-w-0 flex-1 text-right text-sm font-bold text-foreground">
            {playerA.shortName}
          </span>

          <span className="shrink-0 font-mono text-lg font-bold tabular-nums tracking-tight text-foreground">
            {total.wonA} — {total.wonB}
          </span>

          <span className="min-w-0 flex-1 text-sm font-bold text-foreground">
            {playerB.shortName}
          </span>
        </div>

        <div className="mt-2">
          <WinBar wonA={total.wonA} wonB={total.wonB} />
        </div>

        {/* ELO row */}
        <div className="mt-3 flex items-center justify-center gap-4 text-[11px] text-muted-foreground">
          <span>
            {playerA.shortName}{" "}
            <span className="font-mono tabular-nums text-foreground">
              {playerA.elo}
            </span>
          </span>
          <span className="text-[11px]">ELO</span>
          <span>
            {playerB.shortName}{" "}
            <span className="font-mono tabular-nums text-foreground">
              {playerB.elo}
            </span>
          </span>
        </div>
      </div>

      {/* ---- Surface Breakdown ---- */}
      {bySurface && bySurface.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {SURFACE_ORDER.map((surface) => {
            const entry = surfaceMap.get(surface);
            return (
              <SurfaceCard
                key={surface}
                surface={surface}
                wonA={entry?.wonA ?? 0}
                wonB={entry?.wonB ?? 0}
                playerAShort={playerA.shortName}
                playerBShort={playerB.shortName}
              />
            );
          })}
        </div>
      )}

      {/* ---- Recent Matches ---- */}
      {hasRecentMatches ? (
        <div className="overflow-hidden rounded-lg border border-border/60 bg-card">
          {/* Column headers */}
          <div
            className={cn(
              "grid items-center gap-x-3 border-b border-border/60 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground",
              "grid-cols-[auto_1fr_auto_auto]",
              "sm:grid-cols-[auto_auto_1fr_auto_auto_auto_auto]",
            )}
          >
            <span>
              <Calendar className="mr-1 inline h-3 w-3 -translate-y-px" />
              Date
            </span>
            <span className="hidden sm:block">
              <Trophy className="mr-1 inline h-3 w-3 -translate-y-px" />
              Tournoi
            </span>
            <span>Surface</span>
            <span className="text-right">Score</span>
            <span>Gagnant</span>
            <span>Aces</span>
            <span>DF</span>
          </div>

          {recentMatches!.map((match, i) => (
            <RecentMatchRow
              key={`${match.date}-${match.tournament}-${i}`}
              match={match}
              playerAShort={playerA.shortName}
              playerBShort={playerB.shortName}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default H2HAdvanced;
