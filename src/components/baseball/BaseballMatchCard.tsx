"use client";

import type { BaseballMatch } from "@/lib/baseball/types";
import { formatParisTimeWithZone } from "@/lib/baseball/timezone";
import { fmtNum, fmtPct, americanOdds } from "@/lib/baseball/format";
import { TeamLogo } from "./TeamLogo";
import { PitcherBadge } from "./PitcherBadge";
import { CountryFlag } from "@/components/ui/country-flag";
import { baseballLeagueFlag } from "@/lib/baseball/league-geo";
import { LiveBetsTrigger } from "@/components/sports/live-bets-trigger";
import { MatchStateBadge } from "@/components/shared/match-state-badge";
import { baseballMatchState } from "@/lib/match-state-adapters";

interface BaseballMatchCardProps {
  match: BaseballMatch;
  onOpen: (matchId: string) => void;
}

const LEAGUE_STYLES = {
  MLB: "border-red-200 bg-red-50 text-red-700",
  KBO: "border-sky-200 bg-sky-50 text-sky-700",
  NPB: "border-rose-200 bg-rose-50 text-rose-700",
  CPBL: "border-emerald-200 bg-emerald-50 text-emerald-700",
  LMB: "border-orange-200 bg-orange-50 text-orange-700",
  LIDOM: "border-indigo-200 bg-indigo-50 text-indigo-700",
  LVBP: "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700",
} as const;

const LEAGUE_LABEL: Record<string, string> = {
  MLB: "MLB",
  KBO: "KBO",
  NPB: "NPB",
  CPBL: "CPBL",
  LMB: "LMB",
  LIDOM: "LIDOM",
  LVBP: "LVBP",
};

/**
 * Score de la partie — **sans pastille d'état**.
 *
 * Les badges « Live » / « Final » maison ont été retirés : l'état est désormais rendu
 * une seule fois, par `MatchStateBadge` dans le bandeau du hero (même emplacement que
 * la ligue et l'heure, donc lisible sans avoir à parcourir la carte). Deux pastilles
 * d'état concurrentes sur la même carte, c'est deux truths à garder synchronisées —
 * et la deuxième serait celle qui n'aurait pas le contrat de raison.
 */
function ScoreDisplay({ match }: { match: BaseballMatch }) {
  const { game } = match;
  if (game.status === "scheduled") return null;
  return (
    <div className="flex items-center gap-2.5">
      <span className="font-mono text-lg font-black tabular-nums tracking-tight text-[#222222]">
        {game.awayRuns ?? 0}
        <span className="mx-1 text-[#717171]">—</span>
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
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
    amber: "border-orange-200 bg-orange-50 text-orange-700",
    slate: "border-[#f0f0f0] bg-[#f5f5f5] text-[#717171]",
    sky: "border-sky-200 bg-sky-50 text-sky-700",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 font-mono text-[11px] tabular-nums ${accents[accent]}`}
    >
      <span className="text-[10px] uppercase tracking-wider">{label}</span>
      <span className="font-bold">{value}</span>
    </span>
  );
}

export function BaseballMatchCard({ match, onOpen }: BaseballMatchCardProps) {
  const { game, homeTeam, awayTeam, homePitcher, awayPitcher, quick } = match;

  // `GameStatus` est une union fermée (`baseball/types.ts:24`) : switch exhaustif côté
  // adaptateur. Un `final` baseball devient `finished` (et non « final ») pour que le
  // vocabulaire d'état soit le même sur tous les sports.
  const state = baseballMatchState({ status: game.status, gameDateIso: game.gameDateIso });

  const hasValueBet =
    quick?.recommendation &&
    quick.confidence >= 0.65;

  return (
    <article
      className={`
        group relative flex flex-col overflow-hidden rounded-2xl
        border border-[#f0f0f0] bg-white
        shadow-[0_1px_3px_rgba(0,0,0,0.06)]
        transition-all duration-300
        hover:border-[#e6e6e6] hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)]
      `}
    >
      {/* Subtle top-edge line */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#f0f0f0] to-transparent" />

      {/* Hero banner — bicolor gradient with glass overlay */}
      <div
        className="relative h-20 sm:h-24"
        style={{
          background: `linear-gradient(115deg, ${awayTeam.primaryColor}cc 0%, ${awayTeam.primaryColor}22 38%, #ffffff 50%, ${homeTeam.primaryColor}22 62%, ${homeTeam.primaryColor}cc 100%)`,
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
            className="absolute left-1/2 top-1/2 h-18 w-18 -translate-x-1/2 -translate-y-1/2 rounded-full object-cover opacity-20 ring-1 ring-[#f0f0f0] sm:h-20 sm:w-20"
            style={{ filter: "saturate(0.5) contrast(1.05)" }}
          />
        )}
        {/* Light glass overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/40 via-transparent to-white/40 backdrop-blur-[2px]" />

        {/* Top bar — league badge + time + état */}
        <div className="absolute inset-x-0 top-0 flex items-center justify-between px-3 py-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider backdrop-blur-md ${LEAGUE_STYLES[game.league]}`}
          >
            <CountryFlag country={baseballLeagueFlag(game.league)} size={12} />
            {LEAGUE_LABEL[game.league] ?? game.league}
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="rounded-lg border border-[#f0f0f0] bg-[#f5f5f5] px-2 py-0.5 font-mono text-[10px] font-bold tabular-nums text-[#717171]"
              title="Heure de Paris (CEST)"
            >
              {formatParisTimeWithZone(game.gameDateIso)}
            </span>
            {/* État unique de la carte : rendu ici, dans le bandeau, à hauteur d'œil.
                `MatchStateBadge` porte icône + libellé + couleur — jamais la couleur
                seule (charte §3.3) — là où les deux pastilles maison n'avaient qu'un
                texte et une couleur de fond. */}
            <MatchStateBadge state={state} />
          </span>
        </div>

        {/* VS badge centered */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <span className="rounded-full border border-[#f0f0f0] bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-[#717171] backdrop-blur-md">
            VS
          </span>
        </div>
      </div>

      {/* Card body */}
      <div className="flex flex-col gap-3 px-3.5 pb-3.5 sm:px-4 sm:pb-4">
        {/* Venue + Score row */}
        <div className="flex items-center justify-between pt-1">
          <span className="hidden truncate text-[11px] text-[#717171] sm:inline">
            {game.venueName}
          </span>
          <ScoreDisplay match={match} />
        </div>

        {/* Team rows — light panel */}
        <div className="flex flex-col gap-1 rounded-xl border border-[#f0f0f0] bg-[#f5f5f5] p-2.5">
          {/* Away team */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <TeamLogo team={awayTeam} size={32} />
              <span className="absolute -bottom-0.5 -right-0.5 text-[9px]">✈</span>
            </div>
            <div className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium text-[#222222]">
                {awayTeam.city} {awayTeam.name}
              </span>
              <span className="text-[10px] text-[#717171]">
                wRC+ {awayTeam.wrcPlus}
              </span>
            </div>
            <span className="rounded-md border border-[#f0f0f0] bg-white px-2 py-0.5 font-mono text-[11px] tabular-nums text-[#717171]">
              {americanOdds(quick ? 1 - quick.homeWinProb : 0.5) > 0 ? "+" : ""}
              {americanOdds(quick ? 1 - quick.homeWinProb : 0.5)}
            </span>
          </div>

          {/* Divider */}
          <div className="my-0.5 h-px bg-[#f0f0f0]" />

          {/* Home team */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <TeamLogo team={homeTeam} size={32} />
              <span className="absolute -bottom-0.5 -right-0.5 text-[9px]">🏠</span>
            </div>
            <div className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-semibold text-[#222222]">
                {homeTeam.city} {homeTeam.name}
              </span>
              <span className="text-[10px] text-[#717171]">
                wRC+ {homeTeam.wrcPlus}
              </span>
            </div>
            <span className="rounded-md border border-[#f0f0f0] bg-white px-2 py-0.5 font-mono text-[11px] tabular-nums text-[#717171]">
              {americanOdds(quick ? quick.homeWinProb : 0.5) > 0 ? "+" : ""}
              {americanOdds(quick ? quick.homeWinProb : 0.5)}
            </span>
          </div>
        </div>

        {/* Pitcher duel — light panel */}
        <div className="grid gap-1.5 rounded-xl border border-[#f0f0f0] bg-[#f5f5f5] p-2.5 sm:grid-cols-2 sm:gap-3">
          <div className="flex items-center justify-between gap-2">
            <span className="shrink-0 rounded-md border border-[#f0f0f0] bg-white px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#717171]">
              SP Away
            </span>
            {awayPitcher ? (
              <PitcherBadge pitcher={awayPitcher} side="away" compact />
            ) : (
              <span className="text-[11px] italic text-[#717171]">TBD</span>
            )}
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-[#f0f0f0] pt-1.5 sm:border-t-0 sm:border-l sm:border-[#f0f0f0] sm:pt-0 sm:pl-3">
            <span className="shrink-0 rounded-md border border-[#f0f0f0] bg-white px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#717171]">
              SP Home
            </span>
            {homePitcher ? (
              <PitcherBadge pitcher={homePitcher} side="home" compact />
            ) : (
              <span className="text-[11px] italic text-[#717171]">TBD</span>
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

              {/* Recommendation badge — pastille claire */}
              {quick.recommendation ? (
                <span
                  className={`
                    inline-flex items-center gap-1 rounded-lg border px-2.5 py-1
                    text-[11px] font-bold uppercase tracking-wide
                    ${
                      hasValueBet
                        ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                        : "border-emerald-200 bg-emerald-50 text-emerald-700"
                    }
                  `}
                  role="status"
                  aria-label={`Recommandation : ${quick.recommendation === "over" ? "Over" : "Under"} avec confiance ${fmtPct(quick.confidence)}`}
                >
                  {hasValueBet && (
                    <span className="h-1.5 w-1.5 rounded-full bg-[#00985f]" />
                  )}
                  {quick.recommendation === "over" ? "Over" : "Under"}
                  <span className="opacity-60">·</span>
                  {fmtPct(quick.confidence)}
                </span>
              ) : (
                <span className="rounded-lg border border-[#f0f0f0] bg-[#f5f5f5] px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-[#717171]">
                  Sous seuil
                </span>
              )}
            </>
          ) : (
            <span className="text-[11px] italic text-[#717171]">
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
                  ? "border border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                  : "border border-[#f0f0f0] bg-white text-[#222222] hover:bg-[#f5f5f5]"
              }
            `}
          >
            Analyse →
          </button>
        </div>

        {/* BETS PRÉDICTIFS LIVE — monté sur les matchs EN COURS seulement.
            L'état de jeu (manche / outs / bases / compte) n'est servi que par
            le game feed MLB (`/api/baseball/live`) : hors live, aucun marché
            n'est calculable, et le panneau le dirait — mais un bouton
            structurellement mort est du bruit. */}
        {game.status === "live" && (
          <LiveBetsTrigger
            sport="baseball"
            matchId={String(game.id)}
            nameA={`${homeTeam.city} ${homeTeam.name}`}
            nameB={`${awayTeam.city} ${awayTeam.name}`}
            className="mt-2"
          />
        )}
      </div>
    </article>
  );
}
