"use client";

import { useMemo } from "react";
import { HandballTeamLogo } from "./handball-team-logo";
import {
  findVitibetCoveredLeague,
  findFixture,
  findTeamStats,
  type CoveredLeague,
} from "@/lib/handball-vitibet-leagues";
import type { TeamSeasonStats } from "@/lib/handball-vitibet-league";

// ─── Format ───

function fmtInt(v: number | null | undefined): string {
  return v == null ? "—" : String(Math.round(v));
}

function fmtAvg(v: number | null | undefined): string {
  return v == null ? "—" : v.toFixed(1);
}

/** « 272 (8 m) » — total + nombre de matchs du split. */
function fmtSplit(s: TeamSeasonStats["home"], side: "scored" | "conceded"): string {
  return side === "scored"
    ? `${s.goalsFor} (${s.played} m)`
    : `${s.goalsAgainst} (${s.played} m)`;
}

// ─── Sous-composants ───

/** Pastilles V/N/D de la séquence de forme Vitibet. */
function FormPills({ form }: { form: string }) {
  if (!form) {
    return <span className="text-[10px] text-[#717171]">—</span>;
  }
  const tone: Record<string, string> = {
    W: "bg-emerald-500 text-white",
    D: "bg-sky-500 text-white",
    L: "bg-rose-500 text-white",
  };
  const fr: Record<string, string> = { W: "V", D: "N", L: "D" };
  const title: Record<string, string> = { W: "Victoire", D: "Nul", L: "Défaite" };
  return (
    <span className="inline-flex gap-1" aria-label={`Forme ${form}`}>
      {form.split("").map((r, i) => (
        <span
          key={i}
          title={title[r] ?? r}
          className={`inline-flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold ${tone[r] ?? "bg-[#f5f5f5] text-[#717171]"}`}
        >
          {fr[r] ?? r}
        </span>
      ))}
    </span>
  );
}

/**
 * Bloc « Splits Domicile / Extérieur » d'une équipe.
 *
 * C'est la pièce qui manquait dans le popup : les trois autres tableaux
 * (Analyse / Stats / Over) n'ont jamais exposé la ventilation
 * domicile/extérieur demandée par la spec §2.C, et les colonnes « Buts
 * marqués » / « Buts encaissés » restaient globales (ou vides).
 */
function SplitTable({
  stats,
  variant,
}: {
  stats: TeamSeasonStats | null;
  variant: "home" | "away";
}) {
  const name = stats?.team ?? "—";
  const border = variant === "home" ? "border-emerald-500/25" : "border-sky-500/25";
  const label = variant === "home" ? "Domicile" : "Extérieur";

  return (
    <section className={`rounded-lg border ${border} p-2`}>
      <header className="mb-1.5 flex items-center gap-1.5">
        <HandballTeamLogo name={name} size={16} />
        <p className="min-w-0 flex-1 truncate text-[11px] font-bold uppercase tracking-wider text-[#222222] dark:text-white">
          {name}
        </p>
        <span className="shrink-0 rounded bg-[#0A2E5C] px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-white">
          {label}
        </span>
      </header>

      {!stats ? (
        <p className="py-1 text-[10px] leading-snug text-[#717171]">
          Équipe absente du classement Vitibet — splits indisponibles.
        </p>
      ) : (
        <table className="w-full text-[11px]">
          <caption className="sr-only">
            Statistiques {label} de {name}
          </caption>
          <tbody>
            <tr>
              <td className="py-0.5 pr-2 text-[#717171]">Matchs</td>
              <td className="py-0.5 text-right tabular-nums">
                {fmtInt(stats[variant].played)}
              </td>
            </tr>
            <tr>
              <td className="py-0.5 pr-2 text-[#717171]">V / N / D</td>
              <td className="py-0.5 text-right tabular-nums">
                {stats[variant].wins} / {stats[variant].draws} / {stats[variant].losses}
              </td>
            </tr>
            <tr>
              <td className="py-0.5 pr-2 text-[#717171]">Buts marqués</td>
              <td className="py-0.5 text-right tabular-nums">
                {fmtSplit(stats[variant], "scored")}
              </td>
            </tr>
            <tr>
              <td className="py-0.5 pr-2 text-[#717171]">Buts encaissés</td>
              <td className="py-0.5 text-right tabular-nums">
                {fmtSplit(stats[variant], "conceded")}
              </td>
            </tr>
          </tbody>
        </table>
      )}
    </section>
  );
}

// ─── Composant ───

type Props = {
  /** Nom de la ligue tel qu'il vient du match (peut porter le préfixe pays). */
  leagueName: string;
  homeTeamName: string;
  awayTeamName: string;
  /** Ids API-Sports/Vitibet : sert au repli quand le nom diffère (accents). */
  homeTeamId?: number | null;
  awayTeamId?: number | null;
};

/**
 * HandballVitibetStats — bloc « Statistiques de saison » pour un match d'une
 * ligue couverte par Vitibet : 3 danoises, MOL Liga Women, Superlig Turquie,
 * Liga Nationala Women Roumanie (résolues par `findVitibetCoveredLeague`).
 *
 * La résolution de ligue est centralisée dans `handball-vitibet-leagues.ts` :
 * ce composant ne connaît ni pays ni famille, donc ajouter une ligue n'exige
 * aucune modification ici.
 *
 * Deux états sont distingués et jamais confondus :
 *   • équipe absente du classement → message explicite (« absent du
 *     classement Vitibet »), PAS une ligne de « — » ;
 *   • ligue non couverte → le composant ne rend RIEN et l'appelant garde son
 *     affichage générique (pas de doublon).
 */
export function HandballVitibetStats({
  leagueName,
  homeTeamName,
  awayTeamName,
  homeTeamId,
  awayTeamId,
}: Props) {
  const league: CoveredLeague | null = useMemo(
    () => findVitibetCoveredLeague(leagueName),
    [leagueName],
  );

  const { homeStats, awayStats, fixture, baseline } = useMemo(() => {
    if (!league) return { homeStats: null, awayStats: null, fixture: null, baseline: null };
    const byName = findTeamStats(league, homeTeamName);
    const awayByName = findTeamStats(league, awayTeamName);
    // Repli par id quand le nom ne correspond pas (accents, abbreviations).
    const home =
      byName ?? (homeTeamId != null ? league.standings.find((s) => s.teamId === homeTeamId) ?? null : null);
    const away =
      awayByName ?? (awayTeamId != null ? league.standings.find((s) => s.teamId === awayTeamId) ?? null : null);
    return {
      homeStats: home,
      awayStats: away,
      fixture: findFixture(league, homeTeamName, awayTeamName),
      baseline: league.baseline,
    };
  }, [league, homeTeamName, awayTeamName, homeTeamId, awayTeamId]);

  // Ligue non couverte : on ne rend rien (l'appelant affiche son bloc générique).
  if (!league) return null;

  const bothKnown = homeStats != null && awayStats != null;

  return (
    <section className="space-y-2">
      <header className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-[#717171]">
          Saison régulière — {league.name}
        </h4>
        <span className="text-[10px] text-[#717171]">
          {league.gender === "F" ? "Féminin" : "Masculin"} · D{league.level} · Vitibet{" "}
          {league.vitibetLeagueId} · base {fmtAvg(baseline)} buts/équipe
        </span>
      </header>

      {/* Splits Domicile / Extérieur — la donnée absente du popup précédent. */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <SplitTable stats={homeStats} variant="home" />
        <SplitTable stats={awayStats} variant="away" />
      </div>

      {/* Forme 6 matchs (source Vitibet, onglet « Form (last 6) »). */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {[homeStats, awayStats].map((s, i) => (
          <div
            key={s?.team ?? i}
            className={`flex items-center justify-between gap-2 rounded-lg border p-2 ${
              i === 0 ? "border-emerald-500/25" : "border-sky-500/25"
            }`}
          >
            <span className="min-w-0 truncate text-[11px] font-semibold text-[#222222] dark:text-white">
              {s?.team ?? "—"}
            </span>
            <FormPills form={s?.form ?? ""} />
          </div>
        ))}
      </div>

      {/* Score prédit Vitibet — la seule « réponse » externe disponible. */}
      {fixture && (
        <p className="rounded-lg bg-[#0A2E5C]/[0.06] px-2 py-1.5 text-[11px] dark:bg-[#0A2E5C]/30">
          <span className="font-semibold text-[#0A2E5C] dark:text-sky-300">
            Score prédit Vitibet
          </span>{" "}
          <span className="font-mono tabular-nums">
            {fixture.predictedHome} : {fixture.predictedAway}
          </span>{" "}
          <span className="text-[#717171]">
            · {fixture.date} {fixture.time} · fixture {fixture.fixtureId}
          </span>
        </p>
      )}

      {/* État partiel explicite plutôt qu'un tableau à trous. */}
      {!bothKnown && (
        <p className="text-[11px] leading-snug text-amber-500">
          Au moins une des deux équipes n&apos;est pas au classement Vitibet de cette
          ligue — les splits complets ne sont pas calculables pour ce match.
        </p>
      )}
    </section>
  );
}
