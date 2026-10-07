"use client";

import { useMemo, useState } from "react";
import { findVitibetCoveredLeague } from "@/lib/handball-vitibet-leagues";
import type { TeamSeasonStats } from "@/lib/handball-vitibet-league";
import {
  buildOutcomeSplit,
  buildPowerRanking,
  type PowerRow,
} from "./handball-league-overview";
import { HandballLeaguePopover } from "./handball-league-popover";
import { HandballLeagueBadge } from "./handball-league-badge";
import { HandballTeamLogo } from "./handball-team-logo";
import { HandballTableCaption } from "./handball-table-caption";

/**
 * HandballLeagueStandings — sous-onglet « 🏆 Classement & Stats par championnat ».
 *
 * Trois blocs, tous alimentés par la MÊME source (`CoveredLeague` de Vitibet) :
 *   • cartes synthétiques → base de buts mesurée, buts par match, répartition
 *     D/N/E et écart de buts domicile (`buildOutcomeSplit`, qui EXCLUT les
 *     matchs synthétiques et les compte) ;
 *   • classements Domicile / Extérieur (`buildSplitTable`) ;
 *   • stats d'équipes (Team Power via `buildPowerRanking`, la formule du modèle
 *     live).
 *
 * Rien n'est inventé : une ligue hors registre Vitibet n'affiche AUCUNE carte
 * sous son nom — elle est simplement absente de la liste. Un snapshot sans
 * aucune ligue couverte affiche un état vide explicite.
 */

// ─── Calculs purs (testables) ───

/** Côté du classement affiché. */
export type SplitSide = "home" | "away";

/** Une ligne de classement du côté demandé. */
export type SplitRow = {
  team: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  /** Différence de buts sur le seul côté affiché. */
  diff: number;
  /** Points par match (2V + 1N). 0 quand aucun match n'a été joué. */
  ppg: number;
  /**
   * Buts marqués par match sur ce côté. `null` quand l'équipe n'a aucun match
   * sur ce côté (split vide) : « 0.0 » ferait passer une absence de donnée
   * pour une performance nulle.
   */
  scoredPerGame: number | null;
  /** Buts encaissés par match sur ce côté — `null` dans le même cas. */
  concededPerGame: number | null;
};

const round1 = (v: number) => Math.round(v * 10) / 10;

/**
 * Classement d'un championnat sur UN côté (domicile ou extérieur).
 *
 * Source = le tableau Vitibet Home/Away, PAS une reconstruction : le total
 * (`overall`) reste la référence, mais un rang « domicile » calculé en
 * additionnant les deux moitiés serait un chiffre que rien ne corrobore.
 *
 * Tri : PPG décroissante, puis différence de buts, puis buts marqués. Les
 * équipes sans match sur ce côté restent dans le tableau (leur absence est un
 * fait, pas une erreur) mais tombent en queue : 0 match et 0 point par match.
 *
 * Une équipe absente du tableau de côté a `played: 0` (`emptySplit`) : ses
 * moyennes restent `null` côté affichage plutôt que « 0.0 », ce qui ferait
 * passer une absence de donnée pour une performance nulle.
 */
export function buildSplitTable(
  standings: readonly TeamSeasonStats[],
  side: SplitSide,
): SplitRow[] {
  return standings
    .map((s) => {
      const split = side === "home" ? s.home : s.away;
      const played = split.played;
      return {
        team: s.team,
        played,
        wins: split.wins,
        draws: split.draws,
        losses: split.losses,
        goalsFor: split.goalsFor,
        goalsAgainst: split.goalsAgainst,
        diff: split.goalsFor - split.goalsAgainst,
        ppg: played > 0 ? round1((split.wins * 2 + split.draws) / played) : 0,
        scoredPerGame: played > 0 ? round1(split.goalsFor / played) : null,
        concededPerGame: played > 0 ? round1(split.goalsAgainst / played) : null,
      };
    })
    .sort(
      (a, b) =>
        b.ppg - a.ppg ||
        b.diff - a.diff ||
        b.goalsFor - a.goalsFor ||
        a.team.localeCompare(b.team),
    );
}

// ─── Sous-composants ───

const fmt = (v: number | null | undefined, digits = 1): string =>
  v == null || !Number.isFinite(v) ? "—" : v.toFixed(digits);

const fmtSigned = (v: number): string => (v > 0 ? `+${v}` : `${v}`);

/** Tuile de synthèse (base mesurée, buts/match, issues, écart domicile). */
function StatTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-[#f0f0f0] bg-white p-3 text-center">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[#717171]">
        {label}
      </p>
      <p className="mt-1 font-mono text-xl font-black tabular-nums text-[#222222]">
        {value}
      </p>
      {hint && <p className="mt-0.5 text-[10px] text-[#717171]">{hint}</p>}
    </div>
  );
}

/** Un tableau de classement (Domicile ou Extérieur) — même gabarit des 2 côtés. */
function SplitTable({ rows, side }: { rows: readonly SplitRow[]; side: SplitSide }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] text-xs">
        <HandballTableCaption>
          Classement {side === "home" ? "domicile" : "extérieur"} — PPG du côté
        </HandballTableCaption>
        <thead>
          <tr className="border-b border-[#f0f0f0] text-left text-[#717171]">
            <th className="py-1.5 pr-2 font-medium">#</th>
            <th className="py-1.5 pr-2 font-medium">Équipe</th>
            <th className="py-1.5 pr-2 text-right font-medium">J</th>
            <th className="py-1.5 pr-2 text-right font-medium">V-N-D</th>
            <th className="py-1.5 pr-2 text-right font-medium">Marq/ext</th>
            <th className="py-1.5 pr-2 text-right font-medium">+/-</th>
            <th className="py-1.5 text-right font-medium">PPG</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#f0f0f0]">
          {rows.map((r, i) => (
            <tr key={r.team}>
              <td className="py-1.5 pr-2 text-center tabular-nums text-[#717171]">
                {i + 1}
              </td>
              <td className="py-1.5 pr-2">
                <span className="flex items-center gap-1.5">
                  <HandballTeamLogo name={r.team} size={16} />
                  {/* min-w-0 + truncate sur l'élément TRONQUÉ (pas sur le flex) :
                      sinon le td dimensionne la colonne et le nom déborde. */}
                  <span className="min-w-0 truncate font-medium text-[#222222]">
                    {r.team}
                  </span>
                </span>
              </td>
              <td className="py-1.5 pr-2 text-right tabular-nums">{r.played}</td>
              <td className="py-1.5 pr-2 text-right tabular-nums text-[#717171]">
                {r.played > 0 ? `${r.wins}-${r.draws}-${r.losses}` : "—"}
              </td>
              <td className="py-1.5 pr-2 text-right font-mono tabular-nums">
                {fmt(r.scoredPerGame)}/{fmt(r.concededPerGame)}
              </td>
              <td
                className={`py-1.5 pr-2 text-right font-mono tabular-nums ${
                  r.diff > 0 ? "text-emerald-600" : r.diff < 0 ? "text-rose-600" : "text-[#717171]"
                }`}
              >
                {fmtSigned(r.diff)}
              </td>
              <td className="py-1.5 text-right font-mono font-semibold tabular-nums">
                {fmt(r.ppg)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Stats d'équipes : mêmes lignes que le Team Power du popup de ligue. */
function TeamStatsTable({ rows }: { rows: readonly PowerRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] text-xs">
        <HandballTableCaption>
          Statistiques d&apos;équipes — Team Power (formule du modèle live)
        </HandballTableCaption>
        <thead>
          <tr className="border-b border-[#f0f0f0] text-left text-[#717171]">
            <th className="py-1.5 pr-2 font-medium">#</th>
            <th className="py-1.5 pr-2 font-medium">Équipe</th>
            <th className="py-1.5 pr-2 text-right font-medium">J</th>
            <th className="py-1.5 pr-2 text-right font-medium">Marq/ext</th>
            <th className="py-1.5 pr-2 text-right font-medium">Forme</th>
            <th className="py-1.5 text-right font-medium">Power</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#f0f0f0]">
          {rows.map((p, i) => (
            <tr key={p.team}>
              <td className="py-1.5 pr-2 text-center tabular-nums text-[#717171]">
                {i + 1}
              </td>
              <td className="py-1.5 pr-2">
                <span className="flex items-center gap-1.5">
                  <HandballTeamLogo name={p.team} size={16} />
                  <span className="min-w-0 truncate font-medium text-[#222222]">
                    {p.team}
                  </span>
                </span>
              </td>
              <td className="py-1.5 pr-2 text-right tabular-nums">{p.played}</td>
              <td className="py-1.5 pr-2 text-right font-mono tabular-nums">
                {fmt(p.scoredAvg)}/{fmt(p.concededAvg)}
              </td>
              <td className="py-1.5 pr-2 text-right font-mono text-[10px] text-[#717171]">
                {p.form || "—"}
              </td>
              <td
                className={`py-1.5 text-right font-mono tabular-nums ${
                  p.power == null
                    ? "text-[#717171]"
                    : p.power >= 50
                      ? "text-emerald-600"
                      : "text-rose-600"
                }`}
              >
                {fmt(p.power)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Composant ───

export function HandballLeagueStandings({
  leagueNames,
}: {
  /** Noms de ligues vus dans le snapshot courant, dédupliqués par le parent. */
  leagueNames: readonly string[];
}) {
  const [selected, setSelected] = useState<string | null>(null);

  // Seules les ligues RÉELLEMENT couvertes entrent dans la liste : proposer un
  // championnat sans données afficherait des cartes vides sous son nom.
  const covered = useMemo(
    () =>
      leagueNames
        .map((name) => ({ name, league: findVitibetCoveredLeague(name) }))
        .filter((e): e is { name: string; league: NonNullable<typeof e.league> } =>
          Boolean(e.league),
        ),
    [leagueNames],
  );

  // Repli sur la 1re ligue couverte quand la sélection n'est plus dans la liste
  // (le snapshot a changé entre deux chargements) — jamais un écran vide.
  const activeName =
    selected && covered.some((c) => c.name === selected)
      ? selected
      : (covered[0]?.name ?? null);
  const league =
    covered.find((c) => c.name === activeName)?.league ??
    (activeName ? findVitibetCoveredLeague(activeName) : null);

  const split = useMemo(() => (league ? buildOutcomeSplit(league) : null), [league]);
  const homeTable = useMemo(
    () => (league ? buildSplitTable(league.standings, "home") : []),
    [league],
  );
  const awayTable = useMemo(
    () => (league ? buildSplitTable(league.standings, "away") : []),
    [league],
  );
  const power = useMemo(() => (league ? buildPowerRanking(league) : []), [league]);

  if (covered.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-[#717171]" aria-live="polite">
        Aucun championnat couvert dans ce snapshot — le classement n&apos;est pas
        mesurable.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Sélecteur de championnat — même popover à ascenseur que le calendrier. */}
      <div className="flex flex-wrap items-center gap-2">
        <HandballLeaguePopover
          leagues={covered.map((c) => ({
            name: c.name,
            count: c.league.standings.length,
            country: c.league.country,
          }))}
          total={covered.reduce((n, c) => n + c.league.standings.length, 0)}
          selected={activeName}
          onSelect={setSelected}
        />
        {league && <HandballLeagueBadge leagueName={league.name} country={league.country} />}
      </div>

      {league && split ? (
        <>
          {/* 1 — Cartes synthétiques */}
          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-[#222222]">Cartes synthétiques</h3>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <StatTile
                label="Buts / équipe"
                value={fmt(league.baseline)}
                hint="base mesurée"
              />
              <StatTile
                label="Buts / match"
                value={fmt(league.goalsPerMatch)}
                hint="les 2 équipes"
              />
              <StatTile
                label="Domicile / Nul / Ext."
                value={
                  split.n > 0
                    ? `${split.homeWins} / ${split.draws} / ${split.awayWins}`
                    : "—"
                }
                hint={split.n > 0 ? `${split.n} match(s) réel(s)` : "aucun résultat réel"}
              />
              <StatTile
                label="Écart buts dom."
                value={fmt(split.goalsHomeMinusAwayPerMatch, 2)}
                hint="par match"
              />
            </div>
            {split.nSyntheticExcluded > 0 && (
              <p className="text-[11px] leading-snug text-[#717171]">
                {split.nSyntheticExcluded} entrée(s) synthétique(s) exclue(s) des
                cartes ci-dessus : elles ne sont pas des résultats.
              </p>
            )}
          </section>

          {/* 2 — Classements Domicile / Extérieur */}
          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-[#222222]">
              Classement — Domicile / Extérieur
            </h3>
            <div className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
              <div className="space-y-1">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-[#717171]">
                  À domicile
                </h4>
                <SplitTable rows={homeTable} side="home" />
              </div>
              <div className="space-y-1">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-[#717171]">
                  À l&apos;extérieur
                </h4>
                <SplitTable rows={awayTable} side="away" />
              </div>
            </div>
          </section>

          {/* 3 — Stats d'équipes */}
          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-[#222222]">
              Statistiques d&apos;équipes
            </h3>
            <TeamStatsTable rows={power} />
            <p className="text-[11px] leading-snug text-[#717171]">
              Power = formule du modèle live, 50 = niveau moyen de la ligue. « — »
              : pas assez de matchs joués.
            </p>
          </section>
        </>
      ) : (
        <div className="py-8 text-center text-sm text-[#717171]" aria-live="polite">
          Données de championnat indisponibles
        </div>
      )}
    </div>
  );
}