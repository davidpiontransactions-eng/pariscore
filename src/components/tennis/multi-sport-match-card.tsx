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
    form?: string[];  // ["W", "W", "L", "W", "W"] ou ["45-20"]
    record?: string;  // "45-20" pour basketball
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
  competition: string;  // Tournoi / Championnat
  round?: string;       // Round / Journee
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

/** Icons par sport. */
const SPORT_ICONS: Record<string, string> = {
  tennis: "🎾",
  football: "⚽",
  basketball: "🏀",
  cs2: "🔫",
};

/**
 * Card redesign multi-sport pour "Meilleurs matchs du jour".
 *
 * Supporte Tennis, Football, Basketball, CS2 avec un layout unifie :
 * - Badge score 0-10 (TOP MATCH / FEATURED / INTERESTING / STANDARD)
 * - Score breakdown au hover
 * - Equipes avec rang / forme
 * - Cotes (1X2 ou moneyline)
 * - Date + competition + round
 */
export function MultiSportMatchCard({ match, onClick, className }: MultiSportMatchCardProps) {
  const { teamA, teamB, matchScore, sport } = match;
  const isTop = matchScore.label === "TOP MATCH";
  const icon = SPORT_ICONS[sport] ?? "🏟️";

  // Formater la forme (W/D/L ou record)
  const formatForm = (form?: string[]): string => {
    if (!form || form.length === 0) return "";
    return form.slice(0, 5).map((f) => f === "W" ? "●" : f === "L" ? "○" : f === "D" ? "—" : f).join(" ");
  };

  const formA = formatForm(teamA.form);
  const formB = formatForm(teamB.form);

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
      {/* Header : Sport icon + Badge + Score + Breakdown */}
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
        <ScoreBreakdown
          score={matchScore.score}
          breakdown={matchScore.breakdown}
        />
      </div>

      {/* Body : Equipes */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 py-3">
        {/* Equipe A */}
        <div className="text-left">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold">{teamA.shortName}</span>
            {teamA.rank != null && teamA.rank > 0 && teamA.rank < 999 && (
              <span className="rounded bg-white/5 px-1 py-0.5 text-[10px] font-mono text-muted-foreground">
                ({teamA.rank})
              </span>
            )}
          </div>
          {teamA.record && (
            <div className="mt-0.5 text-[10px] text-muted-foreground/60">
              {teamA.record}
            </div>
          )}
          {formA && (
            <div className="mt-1 text-[10px] text-muted-foreground/60">
              {formA}
            </div>
          )}
        </div>

        {/* Separator : VS + proba */}
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-xs font-bold text-muted-foreground/40">VS</span>
          {match.probA != null && match.probB != null && (
            <span className="text-[10px] font-mono text-emerald-400/70">
              {match.probA.toFixed(1)}% — {match.probB.toFixed(1)}%
            </span>
          )}
        </div>

        {/* Equipe B */}
        <div className="text-right">
          <div className="flex items-center justify-end gap-2">
            {teamB.rank != null && teamB.rank > 0 && teamB.rank < 999 && (
              <span className="rounded bg-white/5 px-1 py-0.5 text-[10px] font-mono text-muted-foreground">
                ({teamB.rank})
              </span>
            )}
            <span className="text-sm font-bold">{teamB.shortName}</span>
          </div>
          {teamB.record && (
            <div className="mt-0.5 text-[10px] text-muted-foreground/60">
              {teamB.record}
            </div>
          )}
          {formB && (
            <div className="mt-1 text-[10px] text-muted-foreground/60">
              {formB}
            </div>
          )}
        </div>
      </div>

      {/* Footer : Date + Competition + Odds */}
      <div className="border-t border-border/30 px-4 py-2">
        {/* Date et competition */}
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span className="font-mono tabular-nums">
            {parisKickoff(match.scheduledAt)}
          </span>
          <span>
            {match.competition}
            {match.round ? ` — ${match.round}` : ""}
          </span>
        </div>

        {/* Cotes */}
        {match.odds && (
          <div className="mt-1.5 flex items-center justify-center gap-3 text-[10px]">
            {match.odds.home != null && (
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground/60">1</span>
                <span className="font-mono font-semibold text-emerald-400">
                  {match.odds.home.toFixed(2)}
                </span>
              </div>
            )}
            {match.odds.draw != null && (
              <>
                <span className="text-muted-foreground/30">|</span>
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground/60">N</span>
                  <span className="font-mono font-semibold text-emerald-400">
                    {match.odds.draw.toFixed(2)}
                  </span>
                </div>
              </>
            )}
            {match.odds.away != null && (
              <>
                <span className="text-muted-foreground/30">|</span>
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground/60">2</span>
                  <span className="font-mono font-semibold text-emerald-400">
                    {match.odds.away.toFixed(2)}
                  </span>
                </div>
              </>
            )}
          </div>
        )}

        {/* CTA */}
        <div className="mt-2 flex justify-end">
          <span className="text-[10px] font-medium text-emerald-500/70 group-hover:text-emerald-400 transition-colors">
            Voir les details →
          </span>
        </div>
      </div>
    </div>
  );
}
