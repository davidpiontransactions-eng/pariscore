"use client";

import type { BaseballMatch } from "@/lib/baseball/types";
import { formatParisTimeWithZone } from "@/lib/baseball/timezone";
import { fmtNum, fmtPct, americanOdds } from "@/lib/baseball/format";
import { TeamLogo } from "./TeamLogo";
import { PitcherBadge } from "./PitcherBadge";

interface BaseballMatchCardProps {
  match: BaseballMatch;
  onOpen: (matchId: string) => void;
}

const LEAGUE_STYLES = {
  MLB: "border-red-500/40 bg-red-500/15 text-red-300 shadow-[0_0_6px_rgba(239,68,68,0.15)]",
  KBO: "border-sky-500/40 bg-sky-500/15 text-sky-300 shadow-[0_0_6px_rgba(14,165,233,0.15)]",
  NPB: "border-rose-500/40 bg-rose-500/15 text-rose-300 shadow-[0_0_6px_rgba(244,63,94,0.15)]",
  CPBL: "border-emerald-500/40 bg-emerald-500/15 text-emerald-300 shadow-[0_0_6px_rgba(16,185,129,0.15)]",
  LMB: "border-amber-500/40 bg-amber-500/15 text-amber-300 shadow-[0_0_6px_rgba(245,158,11,0.15)]",
  LIDOM: "border-indigo-500/40 bg-indigo-500/15 text-indigo-300 shadow-[0_0_6px_rgba(99,102,241,0.15)]",
  LVBP: "border-fuchsia-500/40 bg-fuchsia-500/15 text-fuchsia-300 shadow-[0_0_6px_rgba(217,70,239,0.15)]",
} as const;

const LEAGUE_LABEL: Record<string, string> = {
  MLB: "MLB 🇺🇸",
  KBO: "KBO 🇰🇷",
  NPB: "NPB 🇯🇵",
  CPBL: "CPBL 🇹🇼",
  LMB: "LMB 🇲🇽",
  LIDOM: "LIDOM 🇩🇴",
  LVBP: "LVBP 🇻🇪",
};

function ScoreDisplay({ match }: { match: BaseballMatch }) {
  const { game } = match;
  if (game.status === "scheduled") return null;
  return (
    <div className="flex items-center gap-2.5">
      {game.status === "live" && (
        <span className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 shadow-[0_0_8px_rgba(0,230,118,0.2)]">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400 shadow-[0_0_4px_rgba(0,230,118,0.6)]" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
            Live
          </span>
        </span>
      )}
      {game.status === "final" && (
        <span className="rounded-full border border-slate-600/40 bg-slate-700/40 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
          Final
        </span>
      )}
      <span className="font-mono text-lg font-black tabular-nums tracking-tight text-white drop-shadow-[0_0_6px_rgba(255,255,255,0.15)]">
        {game.awayRuns ?? 0}
        <span className="mx-1 text-slate-500">—</span>
        {game.homeRuns ?? 0}
      </span>
    </div>
  );
}

function OddsChip({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: "emerald" | "amber" | "slate" | "sky";
}) {
  const accents = {
    emerald: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
    amber: "border-amber-500/30 bg-amber-500/10 text-amber-300",
    slate: "border-slate-600/40 bg-slate-800/60 text-slate-300",
    sky: "border-sky-500/30 bg-sky-500/10 text-sky-300",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 font-mono text-[11px] tabular-nums backdrop-blur-sm ${accents[accent]}`}
    >
      <span className="text-[10px] uppercase tracking-wider opacity-60">{label}</span>
      <span className="font-bold">{value}</span>
    </span>
  );
}

export function BaseballMatchCard({ match, onOpen }: BaseballMatchCardProps) {
  const { game, homeTeam, awayTeam, homePitcher, awayPitcher, quick } = match;

  const hasValueBet =
    quick?.recommendation &&
    quick.confidence >= 0.65;

  return (
    <article
      className={`
        group relative flex flex-col overflow-hidden rounded-2xl
        border border-white/[0.06] bg-slate-900/80 backdrop-blur-xl
        shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_4px_24px_-4px_rgba(0,0,0,0.5)]
        transition-all duration-300
        hover:border-white/[0.12] hover:shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_8px_32px_-4px_rgba(0,0,0,0.6)]
      `}
    >
      {/* Subtle top-edge glow line */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />

      {/* Hero banner — bicolor gradient with glass overlay */}
      <div
        className="relative h-20 sm:h-24"
        style={{
          background: `linear-gradient(115deg, ${awayTeam.primaryColor}cc 0%, ${awayTeam.primaryColor}22 38%, #0b0e14 50%, ${homeTeam.primaryColor}22 62%, ${homeTeam.primaryColor}cc 100%)`,
        }}
      >
        {/* Watermark logos */}
        {awayTeam.logoPath && (
          <img
            src={awayTeam.logoPath}
            alt=""
            aria-hidden
            loading="lazy"
            className="absolute -left-3 top-1/2 h-24 w-24 -translate-y-1/2 object-contain opacity-15 grayscale"
          />
        )}
        {homeTeam.logoPath && (
          <img
            src={homeTeam.logoPath}
            alt=""
            aria-hidden
            loading="lazy"
            className="absolute -right-3 top-1/2 h-24 w-24 -translate-y-1/2 object-contain opacity-15 grayscale"
          />
        )}
        {/* Pitcher photo watermark */}
        {homePitcher?.photoUrl && (
          <img
            src={homePitcher.photoUrl}
            alt=""
            aria-hidden
            loading="lazy"
            className="absolute left-1/2 top-1/2 h-18 w-18 -translate-x-1/2 -translate-y-1/2 rounded-full object-cover opacity-20 ring-1 ring-white/10 sm:h-20 sm:w-20"
            style={{ filter: "saturate(0.5) contrast(1.05)" }}
          />
        )}
        {/* Dark glass overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-black/40 via-transparent to-black/40 backdrop-blur-[2px]" />

        {/* Top bar — league badge + time */}
        <div className="absolute inset-x-0 top-0 flex items-center justify-between px-3 py-2">
          <span
            className={`rounded-lg border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider backdrop-blur-md ${LEAGUE_STYLES[game.league]}`}
          >
            {LEAGUE_LABEL[game.league] ?? game.league}
          </span>
          <span
            className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 font-mono text-[10px] font-bold tabular-nums text-amber-300 backdrop-blur-md"
            title="Heure de Paris (CEST)"
          >
            {formatParisTimeWithZone(game.gameDateIso)}
          </span>
        </div>

        {/* VS badge centered */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <span className="rounded-full border border-white/10 bg-black/40 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-white/60 backdrop-blur-md">
            VS
          </span>
        </div>
      </div>

      {/* Card body */}
      <div className="flex flex-col gap-3 px-3.5 pb-3.5 sm:px-4 sm:pb-4">
        {/* Venue + Score row */}
        <div className="flex items-center justify-between pt-1">
          <span className="hidden truncate text-[11px] text-white/40 sm:inline">
            {game.venueName}
          </span>
          <ScoreDisplay match={match} />
        </div>

        {/* Team rows — glass panel */}
        <div className="flex flex-col gap-1 rounded-xl border border-white/[0.04] bg-white/[0.02] p-2.5">
          {/* Away team */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <TeamLogo team={awayTeam} size={32} />
              <span className="absolute -bottom-0.5 -right-0.5 text-[9px]">✈</span>
            </div>
            <div className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium text-slate-200">
                {awayTeam.city} {awayTeam.name}
              </span>
              <span className="text-[10px] text-white/35">
                wRC+ {awayTeam.wrcPlus}
              </span>
            </div>
            <span className="rounded-md border border-white/[0.06] bg-white/[0.03] px-2 py-0.5 font-mono text-[11px] tabular-nums text-white/50">
              {americanOdds(quick ? 1 - quick.homeWinProb : 0.5) > 0 ? "+" : ""}
              {americanOdds(quick ? 1 - quick.homeWinProb : 0.5)}
            </span>
          </div>

          {/* Divider */}
          <div className="my-0.5 h-px bg-white/[0.04]" />

          {/* Home team */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <TeamLogo team={homeTeam} size={32} />
              <span className="absolute -bottom-0.5 -right-0.5 text-[9px]">🏠</span>
            </div>
            <div className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-semibold text-white">
                {homeTeam.city} {homeTeam.name}
              </span>
              <span className="text-[10px] text-white/35">
                wRC+ {homeTeam.wrcPlus}
              </span>
            </div>
            <span className="rounded-md border border-white/[0.06] bg-white/[0.03] px-2 py-0.5 font-mono text-[11px] tabular-nums text-white/50">
              {americanOdds(quick ? quick.homeWinProb : 0.5) > 0 ? "+" : ""}
              {americanOdds(quick ? quick.homeWinProb : 0.5)}
            </span>
          </div>
        </div>

        {/* Pitcher duel — glass panel with glow */}
        <div className="grid gap-1.5 rounded-xl border border-white/[0.05] bg-white/[0.02] p-2.5 sm:grid-cols-2 sm:gap-3">
          <div className="flex items-center justify-between gap-2">
            <span className="shrink-0 rounded-md border border-white/[0.06] bg-white/[0.03] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white/40">
              SP Away
            </span>
            {awayPitcher ? (
              <PitcherBadge pitcher={awayPitcher} side="away" compact />
            ) : (
              <span className="text-[11px] italic text-white/40">TBD</span>
            )}
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-white/[0.04] pt-1.5 sm:border-t-0 sm:border-l sm:border-white/[0.04] sm:pt-0 sm:pl-3">
            <span className="shrink-0 rounded-md border border-white/[0.06] bg-white/[0.03] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white/40">
              SP Home
            </span>
            {homePitcher ? (
              <PitcherBadge pitcher={homePitcher} side="home" compact />
            ) : (
              <span className="text-[11px] italic text-white/40">TBD</span>
            )}
          </div>
        </div>

        {/* Prediction footer — chips + CTA */}
        <div className="flex flex-wrap items-center gap-1.5">
          {quick ? (
            <>
              <OddsChip
                label="O/U"
                value={quick.totalLine.toFixed(1)}
                accent="amber"
              />
              <OddsChip
                label="Over"
                value={fmtPct(quick.overProb)}
                accent="emerald"
              />
              <OddsChip
                label="Under"
                value={fmtPct(quick.underProb)}
                accent="slate"
              />
              <OddsChip
                label="Exp"
                value={`${fmtNum(quick.expectedTotal)} R`}
                accent="slate"
              />

              {/* Winner chip */}
              {quick.homeWinProb >= 0.51 || quick.homeWinProb <= 0.49 ? (
                <OddsChip
                  label="Fav"
                  value={
                    quick.homeWinProb > 0.5
                      ? `${homeTeam.city} ${fmtPct(quick.homeWinProb)}`
                      : `${awayTeam.city} ${fmtPct(1 - quick.homeWinProb)}`
                  }
                  accent="sky"
                />
              ) : null}

              {/* Recommendation badge — neon glassmorphism */}
              {quick.recommendation ? (
                <span
                  className={`
                    inline-flex items-center gap-1 rounded-lg border px-2.5 py-1
                    text-[11px] font-bold uppercase tracking-wide
                    ${
                      hasValueBet
                        ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-300 shadow-[0_0_12px_rgba(0,230,118,0.3)]"
                        : "border-emerald-500/30 bg-emerald-500/10 text-emerald-400 shadow-[0_0_8px_rgba(0,230,118,0.2)]"
                    }
                  `}
                  role="status"
                  aria-label={`Recommandation : ${quick.recommendation === "over" ? "Over" : "Under"} avec confiance ${fmtPct(quick.confidence)}`}
                >
                  {hasValueBet && (
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(0,230,118,0.8)]" />
                  )}
                  {quick.recommendation === "over" ? "Over" : "Under"}
                  <span className="opacity-60">·</span>
                  {fmtPct(quick.confidence)}
                </span>
              ) : (
                <span className="rounded-lg border border-slate-600/30 bg-slate-800/50 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Sous seuil
                </span>
              )}
            </>
          ) : (
            <span className="text-[11px] italic text-white/30">
              {game.status === "final"
                ? "Match terminé"
                : "Cotes indisponibles"}
            </span>
          )}

          {/* CTA button */}
          <button
            type="button"
            onClick={() => onOpen(game.id)}
            className={`
              ml-auto rounded-xl px-4 py-1.5 text-xs font-bold
              transition-all duration-200
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50
              ${
                hasValueBet
                  ? "border border-emerald-400/40 bg-emerald-500/20 text-emerald-300 shadow-[0_0_12px_rgba(0,230,118,0.15)] hover:bg-emerald-500/30 hover:shadow-[0_0_20px_rgba(0,230,118,0.25)]"
                  : "border border-white/[0.08] bg-white/[0.04] text-white/70 hover:bg-white/[0.08] hover:text-white"
              }
            `}
          >
            Analyse →
          </button>
        </div>
      </div>
    </article>
  );
}
