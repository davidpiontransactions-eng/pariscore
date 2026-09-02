"use client";

import { cn } from "@/lib/utils";
import { ScoreBadge } from "./score-badge";
import { ScoreBreakdown } from "./score-breakdown";
import { FormDots } from "./form-dots";
import { parisKickoff } from "@/lib/football-time";

/**
 * Type pour un match top-score dans l'onglet "Meilleurs matchs du jour".
 */
export type TopMatchData = {
  id: string;
  playerA: {
    name: string;
    shortName: string;
    rank: number;
    elo: number;
    country?: string;
    form?: ("W" | "L")[];
    sps?: number | null;
  };
  playerB: {
    name: string;
    shortName: string;
    rank: number;
    elo: number;
    country?: string;
    form?: ("W" | "L")[];
    sps?: number | null;
  };
  tournament: string;
  round: string;
  scheduledAt: string;
  probA: number;
  probB: number;
  odds?: {
    bookmaker: string;
    decimalA: number;
    decimalB: number;
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

type TopMatchCardProps = {
  match: TopMatchData;
  onClick?: () => void;
  className?: string;
};

/**
 * Card redesign pour "Meilleurs matchs du jour".
 *
 * Layout :
 * ┌─────────────────────────────────────────────────┐
 * │ [Badge] Score: 9.2/10         [ScoreBreakdown] │
 * ├─────────────────────────────────────────────────┤
 * │  Player A (rank)   vs   Player B (rank)        │
 * │  Elo: 2150               Elo: 2280              │
 * │  Form: ●●●●○             Form: ●●●●●            │
 * ├─────────────────────────────────────────────────┤
 * │  15:00 CEST — 2 Sept  │  Grand Slam — QF       │
 * ├─────────────────────────────────────────────────┤
 * │  Cotes: A 1.85 (54.1%)  —  B 1.95 (51.3%)     │
 * │  H2H: 5-4  │  Surface: Dur  │  [Voir ->]       │
 * └─────────────────────────────────────────────────┘
 */
export function TopMatchCard({ match, onClick, className }: TopMatchCardProps) {
  const { playerA, playerB, matchScore } = match;
  const isTop = matchScore.label === "TOP MATCH";

  // Probabilites implicites depuis les cotes (si disponibles)
  const impliedA = match.odds
    ? Math.round((1 / match.odds.decimalA) * 1000) / 10
    : match.probA;
  const impliedB = match.odds
    ? Math.round((1 / match.odds.decimalB) * 1000) / 10
    : match.probB;

  // Forme par defaut si absente
  const formA = playerA.form ?? [];
  const formB = playerB.form ?? [];

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
      {/* Header : Badge + Score + Breakdown */}
      <div className="flex items-center justify-between border-b border-border/30 px-4 py-2.5">
        <div className="flex items-center gap-2">
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

      {/* Body : Joueurs */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 py-3">
        {/* Joueur A */}
        <div className="text-left">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold">{playerA.shortName}</span>
            {playerA.rank > 0 && playerA.rank < 999 && (
              <span className="rounded bg-white/5 px-1 py-0.5 text-[10px] font-mono text-muted-foreground">
                ({playerA.rank})
              </span>
            )}
          </div>
          <div className="mt-0.5 text-[10px] text-muted-foreground/60">
            Elo: {playerA.elo}
          </div>
          {formA.length > 0 && (
            <div className="mt-1">
              <FormDots form={formA} color="#00e676" size="sm" />
            </div>
          )}
        </div>

        {/* Separator : VS + proba */}
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-xs font-bold text-muted-foreground/40">VS</span>
          <span className="text-[10px] font-mono text-emerald-400/70">
            {impliedA.toFixed(1)}% — {impliedB.toFixed(1)}%
          </span>
        </div>

        {/* Joueur B */}
        <div className="text-right">
          <div className="flex items-center justify-end gap-2">
            {playerB.rank > 0 && playerB.rank < 999 && (
              <span className="rounded bg-white/5 px-1 py-0.5 text-[10px] font-mono text-muted-foreground">
                ({playerB.rank})
              </span>
            )}
            <span className="text-sm font-bold">{playerB.shortName}</span>
          </div>
          <div className="mt-0.5 text-[10px] text-muted-foreground/60">
            Elo: {playerB.elo}
          </div>
          {formB.length > 0 && (
            <div className="mt-1 flex justify-end">
              <FormDots form={formB} color="#00e676" size="sm" />
            </div>
          )}
        </div>
      </div>

      {/* Footer : Date + Tournoi + Cotes */}
      <div className="border-t border-border/30 px-4 py-2">
        {/* Date et tournoi */}
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span className="font-mono tabular-nums">
            {parisKickoff(match.scheduledAt)}
          </span>
          <span>
            {match.tournament} — {match.round}
          </span>
        </div>

        {/* Cotes 1X2 */}
        {match.odds && (
          <div className="mt-1.5 flex items-center justify-center gap-3 text-[10px]">
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground/60">{playerA.shortName}</span>
              <span className="font-mono font-semibold text-emerald-400">
                {match.odds.decimalA.toFixed(2)}
              </span>
            </div>
            <span className="text-muted-foreground/30">|</span>
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground/60">{playerB.shortName}</span>
              <span className="font-mono font-semibold text-emerald-400">
                {match.odds.decimalB.toFixed(2)}
              </span>
            </div>
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
