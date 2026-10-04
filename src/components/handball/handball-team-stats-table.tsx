"use client";

import { useState } from "react";
import { HandballTeamLogo } from "./handball-team-logo";
import type { PariscorePrediction } from "@/lib/handball-pariscore";

// ─── Modèle de ligne ───

type Row = {
  label: string;
  home: string;
  away: string;
  /** Ligne Pariscore : surlignée, posée au-dessus des stats classiques. */
  highlight?: boolean;
};

type TabId = "team" | "scores";

/** Un résultat brut de l'historique, pour l'onglet « Tableau des scores ». */
export type HandballResultRow = {
  date: string;
  opponent: string;
  /** true = l'équipe du match jouait à domicile sur ce résultat. */
  home: boolean;
  scored: number;
  conceded: number;
  outcome: "V" | "N" | "D";
};

/** Stats classiques d'une équipe (historique DB) — tous null si non chargées. */
export type HandballClassicStats = {
  played?: number | null;
  wins?: number | null;
  draws?: number | null;
  losses?: number | null;
  goalsFor?: number | null;
  goalsAgainst?: number | null;
  points?: number | null;
  /** Split DOMICILE — spec Danoises §2.C (« Buts marqués : total / dom. / ext. »). */
  home?: {
    played: number;
    goalsFor: number;
    goalsAgainst: number;
  } | null;
  /** Split EXTÉRIEUR. */
  away?: {
    played: number;
    goalsFor: number;
    goalsAgainst: number;
  } | null;
  /** Moyenne de buts marqués / match (saison). */
  scoredAvg?: number | null;
  /** Moyenne de buts encaissés / match (saison). */
  concededAvg?: number | null;
};

function fmtInt(v: number | null | undefined): string {
  return v == null ? "—" : String(Math.round(v));
}

function fmtPct(v: number | null | undefined): string {
  return v == null ? "—" : `${v.toFixed(1)}%`;
}

/** Split : « 183 / 90 » (domicile puis extérieur) — « — » si un manque. */
function fmtSplitPair(
  home: { played: number; goalsFor: number; goalsAgainst: number } | null | undefined,
  away: { played: number; goalsFor: number; goalsAgainst: number } | null | undefined,
  side: "scored" | "conceded",
): string {
  const pick = (s: typeof home) => {
    if (!s || s.played === 0) return null;
    return side === "scored" ? s.goalsFor : s.goalsAgainst;
  };
  const h = pick(home);
  const a = pick(away);
  return h == null || a == null ? "—" : `${h} / ${a}`;
}

function fmtAvg(v: number | null | undefined): string {
  return v == null ? "—" : v.toFixed(1);
}

// ─── Sous-composants ───

function TableHead({ homeName, awayName }: { homeName: string; awayName: string }) {
  return (
    <thead>
      <tr className="border-b border-[#f0f0f0] text-left text-[#717171] dark:border-white/10">
        <th className="py-1.5 pr-2 font-medium">Statistique</th>
        <th className="py-1.5 pr-2 text-right font-medium">
          <span className="inline-flex max-w-[7rem] items-center justify-end gap-1">
            <span className="truncate font-semibold text-emerald-500">{homeName}</span>
            <HandballTeamLogo name={homeName} size={16} />
          </span>
        </th>
        <th className="py-1.5 text-right font-medium">
          <span className="inline-flex max-w-[7rem] items-center gap-1">
            <HandballTeamLogo name={awayName} size={16} />
            <span className="truncate font-semibold text-sky-500">{awayName}</span>
          </span>
        </th>
      </tr>
    </thead>
  );
}

function Rows({ rows }: { rows: Row[] }) {
  return (
    <tbody>
      {rows.map((r) => (
        <tr
          key={r.label}
          className={
            r.highlight
              ? "bg-[#0A2E5C]/10 font-semibold dark:bg-[#0A2E5C]/30"
              : "border-t border-[#f0f0f0]/70 dark:border-white/5"
          }
        >
          <td
            className={`py-1.5 pr-2 ${
              r.highlight ? "text-[#0A2E5C] dark:text-sky-300" : "font-normal text-[#717171]"
            }`}
          >
            {r.highlight && (
              <span className="mr-1 inline-block rounded bg-[#0A2E5C] px-1 py-px text-[9px] font-bold uppercase tracking-wide text-white">
                Pariscore
              </span>
            )}
            {r.label}
          </td>
          <td className="py-1.5 pr-2 text-right tabular-nums">{r.home}</td>
          <td className="py-1.5 text-right tabular-nums">{r.away}</td>
        </tr>
      ))}
    </tbody>
  );
}

// ─── Composant ───

type Props = {
  prediction: PariscorePrediction;
  homeName: string;
  awayName: string;
  /** Stats classiques de l'équipe DOMICILE (historique DB), null si non chargées. */
  homeStats?: HandballClassicStats | null;
  /** Stats classiques de l'équipe EXTÉRIEURE, null si non chargées. */
  awayStats?: HandballClassicStats | null;
  /** Résultats bruts domicile pour l'onglet « Tableau des scores ». */
  homeResults?: HandballResultRow[];
  awayResults?: HandballResultRow[];
};

/**
 * Tableau Statistiques d'équipe — 2 onglets.
 *
 * Les 3 lignes Pariscore (Forme Calculée, Team Power, Index) passent en tête et
 * sont surlignées : ce sont les métriques qui portent le modèle. Les stats
 * classiques suivent, puis les moyennes dérivées des MÊMES fenêtres que le
 * modèle (aucun second jeu de données → pas de risque d'incohérence affichée).
 */
export function HandballTeamStatsTable({
  prediction,
  homeName,
  awayName,
  homeStats,
  awayStats,
  homeResults,
  awayResults,
}: Props) {
  const [tab, setTab] = useState<TabId>("team");

  const teamRows: Row[] = [
    {
      label: "Forme Calculée",
      home: fmtPct(prediction.home?.formPct),
      away: fmtPct(prediction.away?.formPct),
      highlight: true,
    },
    {
      label: "Team Power",
      home: prediction.home ? `${prediction.home.power}/100` : "—",
      away: prediction.away ? `${prediction.away.power}/100` : "—",
      highlight: true,
    },
    {
      label: "Index Pariscore",
      home:
        prediction.index > 0 ? `+${prediction.index} (dom)` : String(prediction.index),
      // L'index est signé du point de vue DOMICILE : une seule valeur, pas de
      // colonne « extérieur » (elle serait le même index, simplement inversé).
      away: "—",
      highlight: true,
    },
    { label: "Matchs joués", home: fmtInt(homeStats?.played), away: fmtInt(awayStats?.played) },
    { label: "Victoires", home: fmtInt(homeStats?.wins), away: fmtInt(awayStats?.wins) },
    { label: "Nuls", home: fmtInt(homeStats?.draws), away: fmtInt(awayStats?.draws) },
    { label: "Défaites", home: fmtInt(homeStats?.losses), away: fmtInt(awayStats?.losses) },
    {
      label: "Buts marqués",
      home: fmtInt(homeStats?.goalsFor),
      away: fmtInt(awayStats?.goalsFor),
    },
    {
      label: "Buts encaissés",
      home: fmtInt(homeStats?.goalsAgainst),
      away: fmtInt(awayStats?.goalsAgainst),
    },
    { label: "Points", home: fmtInt(homeStats?.points), away: fmtInt(awayStats?.points) },
    {
      label: "Buts marq. dom./ext.",
      home: fmtSplitPair(homeStats?.home, homeStats?.away, "scored"),
      away: fmtSplitPair(awayStats?.home, awayStats?.away, "scored"),
    },
    {
      label: "Buts enc. dom./ext.",
      home: fmtSplitPair(homeStats?.home, homeStats?.away, "conceded"),
      away: fmtSplitPair(awayStats?.home, awayStats?.away, "conceded"),
    },
    {
      label: "Moyenne marquée",
      home: fmtAvg(homeStats?.scoredAvg ?? prediction.home?.scoredAvg),
      away: fmtAvg(awayStats?.scoredAvg ?? prediction.away?.scoredAvg),
    },
    {
      label: "Moyenne encaissée",
      home: fmtAvg(homeStats?.concededAvg ?? prediction.home?.concededAvg),
      away: fmtAvg(awayStats?.concededAvg ?? prediction.away?.concededAvg),
    },
  ];

  // Onglet scores : une ligne par résultat, colonne = équipe qui l'a joué.
  const scoreRows: Row[] =
    tab === "scores" ? buildScoreRows(homeResults, awayResults) : [];

  return (
    <section className="space-y-2">
      <div
        role="tablist"
        aria-label="Vue des statistiques"
        className="flex w-full gap-1 overflow-x-auto rounded-lg border border-[#f0f0f0] bg-[#fafafa] p-1 dark:border-white/10 dark:bg-white/[0.04]"
      >
        {(
          [
            ["team", "Statistiques de l'équipe"],
            ["scores", "Tableau des scores"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`hb-stats-tab-${id}`}
            aria-selected={tab === id}
            aria-controls={`hb-stats-panel-${id}`}
            onClick={() => setTab(id)}
            className={`flex-1 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              tab === id
                ? "bg-white text-[#222222] shadow-sm dark:bg-white/10 dark:text-white"
                : "text-[#717171] hover:text-[#222222] dark:hover:text-white"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "team" ? (
        <div
          role="tabpanel"
          id="hb-stats-panel-team"
          aria-labelledby="hb-stats-tab-team"
          className="overflow-x-auto"
        >
          <table className="w-full text-xs">
            <TableHead homeName={homeName} awayName={awayName} />
            <Rows rows={teamRows} />
          </table>
        </div>
      ) : (
        <div
          role="tabpanel"
          id="hb-stats-panel-scores"
          aria-labelledby="hb-stats-tab-scores"
          className="overflow-x-auto"
        >
          {scoreRows.length > 0 ? (
            <table className="w-full text-xs">
              <TableHead homeName={homeName} awayName={awayName} />
              <Rows rows={scoreRows} />
            </table>
          ) : (
            <p className="py-3 text-center text-[11px] text-[#717171]">
              Historique de scores indisponible pour ce match.
            </p>
          )}
        </div>
      )}
    </section>
  );
}

/**
 * Fusionne les 2 historiques en lignes triées du plus récent au plus ancien.
 * Chaque résultat n'occupe qu'une colonne (celle de l'équipe qui l'a joué) —
 * une même ligne ne peut donc pas avoir les 2 cellules remplies.
 */
function buildScoreRows(
  homeResults: HandballResultRow[] | undefined,
  awayResults: HandballResultRow[] | undefined,
): Row[] {
  const entries = [
    ...(homeResults ?? []).map((r) => ({ side: "home" as const, r })),
    ...(awayResults ?? []).map((r) => ({ side: "away" as const, r })),
  ].sort((a, b) => b.r.date.localeCompare(a.r.date));
  return entries.map(({ side, r }) => ({
    label: `${r.date} · ${r.home ? "vs" : "@"} ${r.opponent}`,
    home: side === "home" ? `${r.scored}-${r.conceded} (${r.outcome})` : "—",
    away: side === "away" ? `${r.scored}-${r.conceded} (${r.outcome})` : "—",
  }));
}
