"use client";

/**
 * Carte de match rugby avec prédiction complète.
 * Affiche : équipes + forme + Elo, score attendu, probabilités 1X2, verdict,
 * ligne over/under principale et marge attendue. Clic → panneau détail.
 */

import { cn } from "@/lib/utils";
import type { PredictedMatch } from "@/lib/rugby/types";
import {
  FormBadges,
  ProbBar,
  RugbyTeamLogo,
  VerdictBadge,
  fmtHandicap,
  fmtTime,
  pct,
} from "./rugby-ui";

export function RugbyMatchCard({
  row,
  onOpen,
}: {
  row: PredictedMatch;
  onOpen: (matchId: string) => void;
}) {
  const { match, prediction } = row;
  const home = match.home;
  const away = match.away;
  const homeIsPick = prediction?.verdictTeamId === home.id;
  const awayIsPick = prediction?.verdictTeamId === away.id;
  // Ligne over/under affichée : celle la plus proche du total attendu
  // (ne pas coder en dur 46.5 — un match défensif afficherait une ligne hors-sol).
  const expectedTotal =
    (prediction?.expectedHomeScore ?? 0) + (prediction?.expectedAwayScore ?? 0);
  const ou =
    prediction?.overUnderLines?.length
      ? [...prediction.overUnderLines].sort(
          (a, b) => Math.abs(a.line - expectedTotal) - Math.abs(b.line - expectedTotal)
        )[0]
      : undefined;

  return (
    <button
      type="button"
      onClick={() => onOpen(match.id)}
      className={cn(
        "group relative w-full overflow-hidden rounded-2xl border border-white/8 bg-[#12151f] text-left",
        "shadow-lg shadow-black/20 transition-all duration-200 hover:border-teal-500/40 hover:bg-[#151a26]",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
      )}
      aria-label={`${home.name} contre ${away.name}`}
    >
      {/* Liseré couleur domicile */}
      <span
        className="absolute left-0 top-0 h-full w-1 opacity-70"
        style={{ background: home.color || "#14b8a6" }}
        aria-hidden
      />

      <div className="p-4 pl-5">
        {/* Ligne 1 : heure + compétition + verdict */}
        <div className="mb-3 flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-400">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-teal-400" aria-hidden />
            {fmtTime(match.date)}
            {match.venue && <span className="hidden truncate text-slate-600 sm:inline">· {match.venue}</span>}
          </span>
          {prediction && <VerdictBadge verdict={prediction.verdict} />}
        </div>

        {/* Ligne 2 : équipes + score attendu */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          {/* Domicile */}
          <div className="flex min-w-0 items-center gap-2.5">
            <RugbyTeamLogo src={home.logo} name={home.name} size={30} />
            <div className="min-w-0">
              <p
                className={cn(
                  "truncate text-sm font-bold",
                  homeIsPick ? "text-teal-300" : "text-slate-100"
                )}
              >
                {home.name}
              </p>
              <div className="mt-0.5 flex items-center gap-1.5">
                {prediction && (
                  <span className="text-[11px] font-semibold tabular-nums text-slate-400">
                    Elo {Math.round(prediction.homeElo)}
                  </span>
                )}
                <FormBadges form={match.form.home} />
              </div>
            </div>
          </div>

          {/* Score attendu */}
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-2 rounded-xl bg-[#0b0e14] px-3.5 py-1.5 ring-1 ring-white/10">
              <span className="text-lg font-black tabular-nums text-teal-300">
                {prediction ? Math.round(prediction.expectedHomeScore) : "–"}
              </span>
              <span className="text-xs font-bold text-slate-600">–</span>
              <span className="text-lg font-black tabular-nums text-sky-300">
                {prediction ? Math.round(prediction.expectedAwayScore) : "–"}
              </span>
            </div>
            {prediction && (
              <span className="mt-1 text-[11px] font-semibold text-slate-400">
                score attendu
              </span>
            )}
          </div>

          {/* Extérieur */}
          <div className="flex min-w-0 items-center justify-end gap-2.5">
            <div className="min-w-0 text-right">
              <p
                className={cn(
                  "truncate text-sm font-bold",
                  awayIsPick ? "text-sky-300" : "text-slate-100"
                )}
              >
                {away.name}
              </p>
              <div className="mt-0.5 flex items-center justify-end gap-1.5">
                <FormBadges form={match.form.away} />
                {prediction && (
                  <span className="text-[11px] font-semibold tabular-nums text-slate-400">
                    Elo {Math.round(prediction.awayElo)}
                  </span>
                )}
              </div>
            </div>
            <RugbyTeamLogo src={away.logo} name={away.name} size={30} />
          </div>
        </div>

        {/* Ligne 3 : probabilités + barre */}
        {prediction && (
          <div className="mt-3.5">
            <div className="mb-1.5 flex items-center justify-between text-[11px] font-semibold tabular-nums">
              <span className="text-teal-300">{pct(prediction.homeWinProb)}</span>
              <span className="text-slate-400">nul {pct(prediction.drawProb)}</span>
              <span className="text-sky-300">{pct(prediction.awayWinProb)}</span>
            </div>
            <ProbBar
              homePct={prediction.homeWinProb}
              awayPct={prediction.awayWinProb}
              drawPct={prediction.drawProb}
            />
          </div>
        )}

        {/* Ligne 4 : marchés secondaires */}
        {prediction && (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/5 pt-3">
            <MarketChip
              label={`Total ${ou?.line ?? "—"}`}
              value={ou ? `O ${pct(ou.over)} / U ${pct(ou.under)}` : "—"}
            />
            <MarketChip
              label="Spread"
              value={`Domicile ${fmtHandicap(prediction.handicap.line)}`}
            />
            <MarketChip label="Score probable" value={prediction.mostLikelyScore} />
            <MarketChip
              label="PowerScore"
              value={`${prediction.powerScore.home} · ${prediction.powerScore.away}`}
              title="PowerScore 0-100 : synthèse Elo + attaque/défense (domicile · extérieur)"
            />
            <MarketChip
              label="Confiance"
              value={pct(prediction.confidence)}
              highlight={prediction.confidence >= 0.62}
            />
          </div>
        )}
      </div>
    </button>
  );
}

function MarketChip({
  label,
  value,
  highlight = false,
  title,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-semibold ring-1",
        highlight
          ? "bg-teal-500/10 text-teal-300 ring-teal-500/30"
          : "bg-[#0b0e14] text-slate-400 ring-white/8"
      )}
    >
      <span className="uppercase tracking-wide text-slate-400">{label}</span>
      <span className="tabular-nums font-bold">{value}</span>
    </span>
  );
}
