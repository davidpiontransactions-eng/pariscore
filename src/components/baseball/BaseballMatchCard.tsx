"use client";

import type { BaseballMatch } from "@/lib/baseball/types";
import { formatParisTime, formatParisTimeWithZone } from "@/lib/baseball/timezone";
import { fmtNum, fmtPct } from "@/lib/baseball/format";
import { TeamLogo } from "./TeamLogo";
import { PitcherBadge } from "./PitcherBadge";

interface BaseballMatchCardProps {
  match: BaseballMatch;
  onOpen: (matchId: string) => void;
}

const LEAGUE_STYLES = {
  MLB: "border-red-500/40 bg-red-500/10 text-red-300",
  KBO: "border-sky-500/40 bg-sky-500/10 text-sky-300",
} as const;

function ScoreLine({ match }: { match: BaseballMatch }) {
  const { game } = match;
  if (game.status === "scheduled") return null;
  return (
    <div className="flex items-center gap-2 rounded-lg bg-slate-800/80 px-3 py-1.5">
      {game.status === "live" && (
        <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-400">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
          Live
        </span>
      )}
      {game.status === "final" && (
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
          Final
        </span>
      )}
      <span className="font-mono text-sm font-bold tabular-nums text-slate-100">
        {game.awayRuns ?? 0} - {game.homeRuns ?? 0}
      </span>
    </div>
  );
}

export function BaseballMatchCard({ match, onOpen }: BaseballMatchCardProps) {
  const { game, homeTeam, awayTeam, homePitcher, awayPitcher, quick } = match;

  return (
    <article className="group flex flex-col gap-3 overflow-hidden rounded-xl border border-slate-800 bg-[#11161f] transition-colors hover:border-slate-600">
      {/* Hero banner vendeur — gradient bicolore + logos watermark + photo stade */}
      <div
        className="relative h-16 sm:h-[5.5rem]"
        style={{
          background: `linear-gradient(115deg, ${awayTeam.primaryColor} 0%, ${awayTeam.primaryColor}22 38%, #0b0e14 50%, ${homeTeam.primaryColor}22 62%, ${homeTeam.primaryColor} 100%)`,
        }}
      >
        {/* Watermark logo away (gauche) */}
        {awayTeam.logoPath && (
          <img
            src={awayTeam.logoPath}
            alt=""
            aria-hidden
            loading="lazy"
            className="absolute -left-2 top-1/2 h-20 w-20 -translate-y-1/2 object-contain opacity-20 grayscale"
          />
        )}
        {/* Watermark logo home (droite) */}
        {homeTeam.logoPath && (
          <img
            src={homeTeam.logoPath}
            alt=""
            aria-hidden
            loading="lazy"
            className="absolute -right-2 top-1/2 h-20 w-20 -translate-y-1/2 object-contain opacity-20 grayscale"
          />
        )}
        {/* Photo lanceur home en filigrane central (effet premium) */}
        {homePitcher?.photoUrl && (
          <img
            src={homePitcher.photoUrl}
            alt=""
            aria-hidden
            loading="lazy"
            className="absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full object-cover opacity-25 ring-1 ring-white/10 sm:h-20 sm:w-20"
            style={{ filter: "saturate(0.6) contrast(1.05)" }}
          />
        )}
        {/* Overlay sombre pour lisibilité despite colorful gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-black/35 via-transparent to-black/35" />
        {/* Ligue + heure overlay top */}
        <div className="absolute inset-x-0 top-0 flex items-center justify-between px-2 py-1.5">
          <span
            className={`rounded border px-1.5 py-px text-[9px] font-bold uppercase tracking-wider backdrop-blur-sm ${LEAGUE_STYLES[game.league]}`}
          >
            {game.league === "MLB" ? "MLB 🇺🇸" : "KBO 🇰🇷"}
          </span>
          <span
            className="rounded bg-black/40 px-1.5 py-px font-mono text-[10px] font-bold tabular-nums text-amber-300 backdrop-blur-sm"
            title="Heure de Paris (CEST)"
          >
            {formatParisTimeWithZone(game.gameDateIso)}
          </span>
        </div>
        {/* VS central */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 translate-y-1/2">
          <span className="text-[10px] font-black uppercase tracking-widest text-white/70 drop-shadow">
            VS
          </span>
        </div>
      </div>

      {/* Corps carte */}
      <div className="flex flex-col gap-3 px-3.5 pb-3.5 sm:px-4 sm:pb-4">
        {/* Ligne méta : venue + score */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="hidden truncate text-[11px] text-slate-500 sm:inline">
            {game.venueName}
          </span>
          <span className="ml-auto">
          <ScoreLine match={match} />
        </span>
        </div>

        {/* Équipes */}
        <div className="grid gap-1.5">
          <div className="flex items-center gap-2.5">
            <TeamLogo team={awayTeam} size={30} />
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-200">
              {awayTeam.city} {awayTeam.name}
            </span>
            <span className="font-mono text-[10px] text-slate-500">wRC+ {awayTeam.wrcPlus}</span>
          </div>
          <div className="flex items-center gap-2.5">
            <TeamLogo team={homeTeam} size={30} />
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-white">
              {homeTeam.city} {homeTeam.name}
            </span>
            <span className="font-mono text-[10px] text-slate-500">wRC+ {homeTeam.wrcPlus}</span>
          </div>
        </div>

        {/* Duel de lanceurs */}
        <div className="grid gap-1.5 rounded-lg border border-slate-800/80 bg-slate-900/50 p-2.5 sm:grid-cols-2 sm:gap-3">
          <div className="flex items-center justify-between gap-2">
            <span className="shrink-0 text-[9px] font-bold uppercase tracking-wider text-slate-500">
              SP Ext
            </span>
            {awayPitcher ? (
              <PitcherBadge pitcher={awayPitcher} side="away" compact />
            ) : (
              <span className="text-[11px] italic text-slate-500">Partant non annoncé</span>
            )}
          </div>
          <div className="flex items-center justify-between gap-2 border-slate-800 sm:justify-end sm:border-l sm:pl-3">
            <span className="shrink-0 text-[9px] font-bold uppercase tracking-wider text-slate-500">
              SP Dom
            </span>
            {homePitcher ? (
              <PitcherBadge pitcher={homePitcher} side="home" compact />
            ) : (
              <span className="text-[11px] italic text-slate-500">Partant non annoncé</span>
            )}
          </div>
        </div>

        {/* Pied de carte : cotes rapides + CTA */}
        <div className="flex flex-wrap items-center gap-2">
          {quick ? (
            <>
              <span className="rounded-md border border-slate-700 bg-slate-800/70 px-2 py-1 font-mono text-[11px] tabular-nums text-slate-200">
                O/U <span className="font-bold text-amber-300">{quick.totalLine.toFixed(1)}</span>
                <span className="mx-1 text-slate-500">·</span>
                Over <span className="font-bold text-emerald-400">{fmtPct(quick.overProb)}</span>
              </span>
              <span className="rounded-md border border-slate-700 bg-slate-800/70 px-2 py-1 font-mono text-[11px] tabular-nums text-slate-200">
                Total {fmtNum(quick.expectedTotal)} <span className="text-slate-500">attendu</span>
              </span>
              {quick.recommendation ? (
                <span className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-300">
                  ✓ {quick.recommendation === "over" ? "Over" : "Under"} · conf {fmtPct(quick.confidence)}
                </span>
              ) : (
                <span className="rounded-md border border-slate-700 bg-slate-800/70 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Sous seuil 65 %
                </span>
              )}
            </>
          ) : (
            <span className="text-[11px] italic text-slate-500">
              {game.status === "final" ? "Match terminé" : "Cotes indisponibles — partants incomplets"}
            </span>
          )}
          <button
            type="button"
            onClick={() => onOpen(game.id)}
            className="ml-auto rounded-lg bg-amber-400 px-3.5 py-1.5 text-xs font-bold text-slate-950 transition-colors hover:bg-amber-300"
          >
            Analyse complète →
          </button>
        </div>
      </div>
    </article>
  );
}
