"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { Loader2, AlertCircle } from "lucide-react";
import { useFootballLeagueRankings } from "@/hooks/use-football-rankings";
import type { FdRankRow, XgRankRow } from "@/hooks/use-football-rankings";

const LEAGUES: { slug: string; label: string }[] = [
  { slug: "ligue1", label: "Ligue 1" },
  { slug: "epl", label: "Premier League" },
  { slug: "laliga", label: "La Liga" },
  { slug: "bundesliga", label: "Bundesliga" },
  { slug: "seriea", label: "Serie A" },
  { slug: "primeira_liga", label: "Liga Portugal" },
  { slug: "eredivisie", label: "Eredivisie" },
  { slug: "championship", label: "Championship" },
  { slug: "ligue2", label: "Ligue 2" },
  { slug: "laliga2", label: "La Liga 2" },
  { slug: "bundesliga2", label: "2. Bundesliga" },
  { slug: "serieb", label: "Serie B" },
  { slug: "jupiler", label: "Pro League" },
  { slug: "super_lig", label: "Süper Lig" },
  { slug: "superleague_greece", label: "Super League GR" },
  { slug: "scot_prem", label: "Écosse" },
];

type MarketKey =
  | "gfPg" | "ppm"
  | "o15" | "u35" | "bttsYesPct"
  | "cornersOver65" | "cornersOver75" | "cornersForPg"
  | "xgFor" | "xgAgainst";

const MARKETS: { key: MarketKey; short: string; title: string; fmt: (v: number) => string }[] = [
  { key: "gfPg", short: "Buts/m", title: "Buts marqués par match", fmt: (v) => v.toFixed(2) },
  { key: "ppm", short: "PPM", title: "Points par match", fmt: (v) => v.toFixed(2) },
  { key: "o15", short: "O1.5", title: "Classement Over 1,5 buts (%)", fmt: (v) => `${v.toFixed(0)}%` },
  { key: "u35", short: "U3.5", title: "Classement Under 3,5 buts (%)", fmt: (v) => `${v.toFixed(0)}%` },
  { key: "bttsYesPct", short: "BTTS", title: "Les 2 équipes marquent (%)", fmt: (v) => `${v.toFixed(0)}%` },
  { key: "cornersOver65", short: "C6.5", title: "Over 6,5 corners (%)", fmt: (v) => `${v.toFixed(0)}%` },
  { key: "cornersOver75", short: "C7.5", title: "Over 7,5 corners (%)", fmt: (v) => `${v.toFixed(0)}%` },
  { key: "cornersForPg", short: "Corn/m", title: "Corners pour par match", fmt: (v) => v.toFixed(2) },
  { key: "xgFor", short: "xG", title: "Meilleur xG moyen", fmt: (v) => v.toFixed(2) },
  { key: "xgAgainst", short: "xGA", title: "xG défensif moyen (le plus bas = mieux)", fmt: (v) => v.toFixed(2) },
];

type Scope = "overall" | "home" | "away";
const SCOPES: { key: Scope; label: string }[] = [
  { key: "overall", label: "Tous" },
  { key: "home", label: "Dom" },
  { key: "away", label: "Ext" },
];

function isXgRows(rows: unknown): rows is { team: string; gp: number; xgFor: number; xgAgainst: number }[] {
  return Array.isArray(rows) && rows.length > 0 && typeof (rows[0] as { xgFor?: unknown }).xgFor === "number";
}

/** Stats fusionnées par équipe (marchés affichés en colonnes fixes). */
type TeamStats = {
  gp: number;
  ppm?: number;
  gfPg?: number;
};

const MERGE_KEYS: MarketKey[] = ["ppm", "gfPg"];

function mergeMarkets(markets: Record<string, FdRankRow[] | XgRankRow[] | undefined>): Map<string, TeamStats> {
  const map = new Map<string, TeamStats>();
  const touch = (team: string, gp: number): TeamStats => {
    let s = map.get(team);
    if (!s) {
      s = { gp };
      map.set(team, s);
    }
    return s;
  };
  for (const key of MERGE_KEYS) {
    const rows = markets[key];
    if (!Array.isArray(rows)) continue;
    for (const r of rows as FdRankRow[]) {
      touch(r.team, r.gp)[key] = r.value;
    }
  }
  return map;
}

const num1 = (v: number | undefined): string =>
  v == null || !Number.isFinite(v) ? "–" : v.toFixed(2);

export function FootballLeagueRankingsWidget() {
  const [league, setLeague] = useState("ligue1");
  const [season, setSeason] = useState<string | null>(null);
  const [scope, setScope] = useState<Scope>("overall");
  const [market, setMarket] = useState<MarketKey>("gfPg");

  const effectiveSeason = season ?? "2025/26";
  const { data, error, isLoading, isReady, availableSeasons, rowsFor } =
    useFootballLeagueRankings(league, effectiveSeason, scope);

  const def = MARKETS.find((m) => m.key === market) ?? MARKETS[0];
  const rawRows = rowsFor(market);
  const merged = useMemo(
    () => mergeMarkets((data?.markets ?? {}) as Record<string, FdRankRow[] | XgRankRow[] | undefined>),
    [data?.markets],
  );

  return (
    <section aria-label="Classements championnat" className="border-b border-slate-800/80 pb-2">
      <div className="flex items-center justify-between pr-2.5">
        <h2 className="px-2.5 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">
          Classements
        </h2>
        {/* Sélecteur de saison */}
        <select
          value={effectiveSeason}
          onChange={(e) => setSeason(e.target.value)}
          className="rounded border border-slate-700/60 bg-slate-900 px-1 py-px font-mono text-[9px] text-slate-300 focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          aria-label="Saison"
        >
          {(availableSeasons.length ? availableSeasons : ["2025/26"]).map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      <div className="flex gap-1 px-2.5 pb-1.5">
        <select
          value={league}
          onChange={(e) => setLeague(e.target.value)}
          className="min-w-0 flex-1 rounded border border-slate-700/60 bg-slate-900 px-1 py-0.5 text-[10px] text-slate-300 focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          aria-label="Championnat"
        >
          {LEAGUES.map((l) => (
            <option key={l.slug} value={l.slug}>{l.label}</option>
          ))}
        </select>
        <div className="flex overflow-hidden rounded border border-slate-700/60" role="group" aria-label="Contexte">
          {SCOPES.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setScope(s.key)}
              aria-pressed={scope === s.key}
              className={cn(
                "px-1.5 py-0.5 text-[9px] font-semibold transition-colors",
                scope === s.key
                  ? "bg-emerald-500/20 text-emerald-300"
                  : "bg-transparent text-slate-500 hover:text-slate-300",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto px-2.5 pb-1.5 scrollbar-none">
        {MARKETS.map((m) => (
          <button
            key={m.key}
            type="button"
            title={m.title}
            aria-pressed={market === m.key}
            onClick={() => setMarket(m.key)}
            className={cn(
              "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold transition-colors",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              market === m.key
                ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-300"
                : "border-slate-700/60 text-slate-400 hover:text-slate-200 hover:border-slate-500/60",
            )}
          >
            {m.short}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center gap-1.5 px-2.5 py-4 text-[11px] text-slate-500">
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
          Chargement…
        </div>
      ) : error || !isReady ? (
        <div className="flex items-center gap-1.5 px-2.5 py-3 text-[11px] text-slate-500">
          <AlertCircle className="h-3 w-3 shrink-0" aria-hidden />
          Classements indisponibles.
        </div>
      ) : (
        <div className="px-2.5">
          <p className="pb-1 text-[10px] font-medium text-emerald-400/90">{def.title}</p>
          {!rawRows?.length ? (
            <p className="py-2 text-[11px] text-slate-500">
              {market === "xgFor" || market === "xgAgainst"
                ? "xG indisponible pour cette ligue (couverture Understat limitée)."
                : "Pas de données pour cette saison."}
            </p>
          ) : (
            <div
              className="max-h-72 overflow-y-auto pr-0.5 scrollbar-thin"
              role="region"
              aria-label={`Classement complet ${def.title}`}
            >
              <table className="w-full border-collapse text-[9px]">
                <thead>
                  <tr className="text-slate-600">
                    <th scope="col" className="w-4 py-0.5 pr-1 text-right font-medium">#</th>
                    <th scope="col" className="py-0.5 text-left font-medium">Équipe</th>
                    <th scope="col" className="py-0.5 px-0.5 text-right font-medium" title="Matchs joués">J</th>
                    {isXgRows(rawRows) ? (
                      <>
                        <th scope="col" className="py-0.5 px-0.5 text-right font-medium" title={MARKETS.find((m) => m.key === "xgFor")!.title}>xG</th>
                        <th scope="col" className="py-0.5 text-right font-medium" title={def.title}>{def.short}</th>
                      </>
                    ) : (
                      <>
                        <th scope="col" className="py-0.5 px-0.5 text-right font-medium" title="Points par match">PPM</th>
                        <th scope="col" className="py-0.5 px-0.5 text-right font-medium" title="Buts marqués par match">B/m</th>
                        <th scope="col" className="py-0.5 text-right font-medium" title={def.title}>{def.short}</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {(rawRows as (FdRankRow | XgRankRow)[]).map((row, i) => {
                    const teamName = row.team;
                    const st = merged.get(teamName);
                    return (
                      <tr
                        key={teamName}
                        className="border-t border-slate-800/50 hover:bg-slate-800/60"
                      >
                        <td className="py-0.5 pr-1 text-right font-mono tabular-nums text-slate-600">
                          {i + 1}
                        </td>
                        <td className="max-w-0 truncate py-0.5 text-[10px] text-slate-300">
                          {teamName}
                        </td>
                        <td className="py-0.5 px-0.5 text-right font-mono tabular-nums text-slate-500">
                          {row.gp}
                        </td>
                        {isXgRows(rawRows) ? (
                          <>
                            <td className="py-0.5 px-0.5 text-right font-mono tabular-nums text-slate-300">
                              {num1((row as XgRankRow).xgFor)}
                            </td>
                            <td className="rounded bg-slate-800 py-0.5 text-right font-mono tabular-nums text-slate-200">
                              {def.fmt(
                                market === "xgAgainst"
                                  ? (row as XgRankRow).xgAgainst
                                  : (row as XgRankRow).xgFor,
                              )}
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="py-0.5 px-0.5 text-right font-mono tabular-nums text-slate-400">
                              {num1(st?.ppm)}
                            </td>
                            <td className="py-0.5 px-0.5 text-right font-mono tabular-nums text-slate-400">
                              {num1(st?.gfPg)}
                            </td>
                            {/* Colonne de tri = métrique active (toujours visible) */}
                            <td className="rounded bg-slate-800 py-0.5 text-right font-mono tabular-nums text-slate-200">
                              {def.fmt((row as FdRankRow).value)}
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p className="pt-1 text-[8px] leading-tight text-slate-600">
            Source : football-data.co.uk{xgKeys.has(market) ? " · xG : Understat" : ""} · classement complet trié par {def.short}
          </p>
        </div>
      )}
    </section>
  );
}

const xgKeys = new Set<MarketKey>(["xgFor", "xgAgainst"]);
