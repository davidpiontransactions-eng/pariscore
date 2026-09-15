"use client";

import { cn } from "@/lib/utils";
import { ScoreBadge } from "./score-badge";
import { ScoreBreakdown } from "./score-breakdown";
import { parisKickoff } from "@/lib/football-time";

/**
 * Type generique pour un match top-score multi-sport.
 */
export type MultiSportMatchData = {
  id: string;
  sport: "tennis" | "football" | "basketball" | "cs2";
  teamA: {
    name: string;
    shortName: string;
    rank?: number | null;
    logo?: string;
    form?: string[];
    record?: string;
    country?: string;
  };
  teamB: {
    name: string;
    shortName: string;
    rank?: number | null;
    logo?: string;
    form?: string[];
    record?: string;
    country?: string;
  };
  competition: string;
  round?: string;
  scheduledAt: string;
  probA?: number | null;
  probB?: number | null;
  probDraw?: number | null;
  odds?: {
    home?: number;
    draw?: number;
    away?: number;
  };
  matchScore: {
    score: number;
    label: string;
    labelColor: string;
    labelBg: string;
    breakdown: {
      closeness: number;
      tournamentImp: number;
      eloQuality: number;
      starPower: number;
      form: number;
      rivalry: number;
    };
  };
};

type MultiSportMatchCardProps = {
  match: MultiSportMatchData;
  onClick?: () => void;
  className?: string;
};

const SPORT_ICONS: Record<string, string> = {
  tennis: "🎾",
  football: "⚽",
  basketball: "🏀",
  cs2: "🔫",
};

/** Couleur par resultat de forme. */
function formDotColor(result: string): string {
  if (result === "W") return "bg-emerald-400";
  if (result === "L") return "bg-rose-400";
  return "bg-zinc-500";
}

/** Logo equipe avec fallback initiales. */
function TeamLogo({ logo, name, size = "md" }: { logo?: string; name: string; size?: "sm" | "md" }) {
  const dims = size === "sm" ? "h-6 w-6" : "h-8 w-8";
  const text = size === "sm" ? "text-[9px]" : "text-[10px]";
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  if (logo) {
    return (
      <img
        src={logo}
        alt=""
        className={cn(dims, "rounded-full object-cover ring-1 ring-white/10")}
        loading="lazy"
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = "none";
          (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden");
        }}
      />
    );
  }
  return (
    <div className={cn(dims, "hidden items-center justify-center rounded-full bg-zinc-800 ring-1 ring-white/10")}>
      <span className={cn(text, "font-bold text-zinc-400")}>{initials}</span>
    </div>
  );
}

/** Barre de forme (5 dots). */
function FormBar({ form }: { form?: string[] }) {
  if (!form || form.length === 0) return null;
  const last5 = form.slice(-5);
  return (
    <div className="flex items-center gap-1">
      {last5.map((r, i) => (
        <span
          key={i}
          className={cn("h-[5px] w-[5px] rounded-full", formDotColor(r))}
        />
      ))}
    </div>
  );
}

/**
 * Card multi-sport style FotMob.
 *
 * Layout :
 *   Header  : sport icon + score badge + breakdown
 *   Body    : [logo A] name A  |  VS / proba  |  name B [logo B] + form dots
 *   Footer  : heure · competition — round | odds 1X2 | CTA
 */
export function MultiSportMatchCard({ match, onClick, className }: MultiSportMatchCardProps) {
  const { teamA, teamB, matchScore, sport } = match;
  const isTop = matchScore.label === "TOP MATCH";
  const icon = SPORT_ICONS[sport] ?? "🏟️";

  return (
    <div
      onClick={onClick}
      className={cn(
        "group cursor-pointer rounded-2xl border transition-all duration-200",
        isTop
          ? "border-emerald-500/30 bg-gradient-to-br from-emerald-500/5 to-transparent hover:border-emerald-500/50 hover:shadow-lg hover:shadow-emerald-500/10"
          : "border-border/60 bg-card hover:border-emerald-500/30 hover:bg-slate-800/40",
        className,
      )}
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-between border-b border-border/30 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="text-lg">{icon}</span>
          <ScoreBadge
            score={matchScore.score}
            label={matchScore.label}
            labelColor={matchScore.labelColor}
            labelBg={matchScore.labelBg}
            size="md"
          />
        </div>
        <ScoreBreakdown score={matchScore.score} breakdown={matchScore.breakdown} />
      </div>

      {/* ── Body : Equipes ── */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 py-3">
        {/* Equipe A */}
        <div className="flex items-center gap-2.5 text-left">
          <TeamLogo logo={teamA.logo} name={teamA.name} />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-sm font-bold">{teamA.shortName}</span>
              {teamA.rank != null && teamA.rank > 0 && teamA.rank < 999 && (
                <span className="shrink-0 rounded bg-white/5 px-1 py-0.5 text-[9px] font-mono text-muted-foreground">
                  ({teamA.rank})
                </span>
              )}
            </div>
            <div className="mt-1 flex items-center gap-2">
              <FormBar form={teamA.form} />
              {teamA.record && (
                <span className="text-[10px] text-muted-foreground/50">{teamA.record}</span>
              )}
            </div>
          </div>
        </div>

        {/* Centre : VS + proba */}
        <div className="flex flex-col items-center gap-0.5 px-1">
          <span className="text-[11px] font-bold text-muted-foreground/30">VS</span>
          {match.probA != null && match.probB != null && (
            <span className="whitespace-nowrap text-[10px] font-mono text-emerald-400/70">
              {match.probA.toFixed(1)}% — {match.probB.toFixed(1)}%
            </span>
          )}
        </div>

        {/* Equipe B */}
        <div className="flex items-center justify-end gap-2.5 text-right">
          <div className="min-w-0">
            <div className="flex items-center justify-end gap-1.5">
              {teamB.rank != null && teamB.rank > 0 && teamB.rank < 999 && (
                <span className="shrink-0 rounded bg-white/5 px-1 py-0.5 text-[9px] font-mono text-muted-foreground">
                  ({teamB.rank})
                </span>
              )}
              <span className="truncate text-sm font-bold">{teamB.shortName}</span>
            </div>
            <div className="mt-1 flex items-center justify-end gap-2">
              {teamB.record && (
                <span className="text-[10px] text-muted-foreground/50">{teamB.record}</span>
              )}
              <FormBar form={teamB.form} />
            </div>
          </div>
          <TeamLogo logo={teamB.logo} name={teamB.name} />
        </div>
      </div>

      {/* ── Footer : Heure · Competition | Odds | CTA ── */}
      <div className="border-t border-border/30 px-4 py-2.5">
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span className="font-mono tabular-nums">{parisKickoff(match.scheduledAt)}</span>
          <span className="truncate">
            {match.competition}
            {match.round ? ` — ${match.round}` : ""}
          </span>
        </div>

        {/* Cotes */}
        {match.odds && (
          <div className="mt-2 flex items-center justify-center gap-4 rounded-lg bg-white/[0.03] py-1.5">
            {match.odds.home != null && (
              <div className="flex flex-col items-center">
                <span className="text-[9px] text-muted-foreground/50">1</span>
                <span className="text-[11px] font-bold font-mono text-emerald-400">{match.odds.home.toFixed(2)}</span>
              </div>
            )}
            {match.odds.draw != null && (
              <div className="flex flex-col items-center">
                <span className="text-[9px] text-muted-foreground/50">N</span>
                <span className="text-[11px] font-bold font-mono text-emerald-400">{match.odds.draw.toFixed(2)}</span>
              </div>
            )}
            {match.odds.away != null && (
              <div className="flex flex-col items-center">
                <span className="text-[9px] text-muted-foreground/50">2</span>
                <span className="text-[11px] font-bold font-mono text-emerald-400">{match.odds.away.toFixed(2)}</span>
              </div>
            )}
          </div>
        )}

        {/* CTA */}
        <div className="mt-2 flex justify-end">
          <span className="text-[10px] font-medium text-emerald-500/70 transition-colors group-hover:text-emerald-400">
            Voir les details &rarr;
          </span>
        </div>
      </div>
    </div>
  );
}
