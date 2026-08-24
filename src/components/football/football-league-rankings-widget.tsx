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

/** Fenêtre de forme : saison complète ou N derniers matchs (toutes saisons). */
type FormKey = "full" | "l5" | "l10";
const FORM_WINDOWS: { key: FormKey; label: string; n: number }[] = [
  { key: "l5", label: "L5", n: 5 },
  { key: "l10", label: "L10", n: 10 },
  { key: "full", label: "Saison", n: 0 },
];

const seasonSortKey = (s: string): number => parseInt(s.slice(0, 4), 10) || 0;

/**
 * Blend inter-saisons : les gp matchs les plus récents d'abord (saison en
 * cours), complétés par la saison précédente. Moyennes pondérées par le
 * nombre réel de matchs — ex. L5 avec 1 match en 2026/27 = 4 derniers de
 * 2025/26 + ce match.
 */
function blendFd(
  cur: FdRankRow[],
  prev: FdRankRow[] | undefined,
  n: number,
): FdRankRow[] {
  const prevMap = new Map((prev ?? []).map((r) => [r.team, r]));
  const teams = new Set([...cur.map((r) => r.team), ...prevMap.keys()]);
  const out: FdRankRow[] = [];
  for (const team of teams) {
    const a = cur.find((r) => r.team === team);
    const b = prevMap.get(team);
    const wA = Math.min(a?.gp ?? 0, n);
    const wB = Math.min(b?.gp ?? 0, Math.max(0, n - wA));
    if (wA + wB === 0) continue;
    out.push({
      team,
      gp: wA + wB,
      value: ((a?.value ?? 0) * wA + (b?.value ?? 0) * wB) / (wA + wB),
    });
  }
  return out;
}

function blendXg(
  cur: XgRankRow[],
  prev: XgRankRow[] | undefined,
  n: number,
): XgRankRow[] {
  const prevMap = new Map((prev ?? []).map((r) => [r.team, r]));
  const teams = new Set([...cur.map((r) => r.team), ...prevMap.keys()]);
  const out: XgRankRow[] = [];
  for (const team of teams) {
    const a = cur.find((r) => r.team === team);
    const b = prevMap.get(team);
    const wA = Math.min(a?.gp ?? 0, n);
    const wB = Math.min(b?.gp ?? 0, Math.max(0, n - wA));
    if (wA + wB === 0) continue;
    out.push({
      team,
      gp: wA + wB,
      xgFor: ((a?.xgFor ?? 0) * wA + (b?.xgFor ?? 0) * wB) / (wA + wB),
      xgAgainst: ((a?.xgAgainst ?? 0) * wA + (b?.xgAgainst ?? 0) * wB) / (wA + wB),
    });
  }
  return out;
}

export function FootballLeagueRankingsWidget() {
  const [league, setLeague] = useState("ligue1");
  const [season, setSeason] = useState<string | null>(null);
  const [scope, setScope] = useState<Scope>("overall");
  const [market, setMarket] = useState<MarketKey>("gfPg");
  const [formKey, setFormKey] = useState<FormKey>("full");

  // Saisons triées (récentes d'abord) — la sélection par défaut se fera sur
  // availableSeasons une fois chargées (voir effectiveSeason plus bas).
  const { availableSeasons: seasonsFromProbe } = useFootballLeagueRankings(
    league,
    season ?? "2025/26",
    scope,
  );
  const sortedSeasons = useMemo(
    () => [...seasonsFromProbe].sort((a, b) => seasonSortKey(b) - seasonSortKey(a)),
    [seasonsFromProbe],
  );
  const effectiveSeason = season ?? sortedSeasons[0] ?? "2025/26";
  const prevIdx = sortedSeasons.indexOf(effectiveSeason) + 1;
  const prevSeason = sortedSeasons[prevIdx] ?? null;

  // Appel principal sur la saison effective + appel de la saison précédente
  // (nécessaire au blend L5/L10 inter-saisons ; league=null → pas de fetch).
  const { data, error, isLoading, isReady, rowsFor } = useFootballLeagueRankings(
    league,
    effectiveSeason,
    scope,
  );
  const prevProbeSeason = formKey === "full" ? null : prevSeason;
  const { rowsFor: rowsForPrev } = useFootballLeagueRankings(
    prevProbeSeason ? league : null,
    prevProbeSeason ?? effectiveSeason,
    scope,
  );

  const def = MARKETS.find((m) => m.key === market) ?? MARKETS[0];
  const rawRowsBase = rowsFor(market);
  const higherBetter = data?.higherBetter ?? {};

  // Lignes affichées selon la fenêtre : saison complète ou blend N derniers.
  const rawRows = useMemo(() => {
    if (formKey === "full" || !rawRowsBase?.length) return rawRowsBase;
    const n = formKey === "l5" ? 5 : 10;
    const prevRows = rowsForPrev(market);
    if (!prevRows?.length) return rawRowsBase;
    const dir = higherBetter[market] === false ? -1 : 1;
    if (isXgRows(rawRowsBase)) {
      return blendXg(rawRowsBase as XgRankRow[], prevRows as XgRankRow[] | undefined, n).sort(
        (a, b) =>
          dir *
          ((market === "xgAgainst" ? a.xgAgainst : a.xgFor) -
            (market === "xgAgainst" ? b.xgAgainst : b.xgFor)),
      );
    }
    return blendFd(rawRowsBase as FdRankRow[], prevRows as FdRankRow[] | undefined, n).sort(
      (a, b) => dir * (a.value - b.value),
    );
  }, [formKey, rawRowsBase, rowsForPrev, market, higherBetter]);
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
      </div>

      <div className="space-y-1 px-2.5 pb-1.5">
        <select
          value={league}
          onChange={(e) => setLeague(e.target.value)}
          className="w-full rounded border border-slate-700/60 bg-slate-900 px-1 py-0.5 text-[10px] text-slate-300 focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          aria-label="Championnat"
        >
          {LEAGUES.map((l) => (
            <option key={l.slug} value={l.slug}>{l.label}</option>
          ))}
        </select>
        <div className="flex items-center justify-between gap-1">
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
          {/* Fenêtre de forme : N derniers matchs (toutes saisons) ou saison entière */}
          <div className="flex overflow-hidden rounded border border-slate-700/60" role="group" aria-label="Fenêtre de forme">
            {FORM_WINDOWS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFormKey(f.key)}
                aria-pressed={formKey === f.key}
                title={
                  f.key === "full"
                    ? "Classement de la saison complète"
                    : `${f.n} derniers matchs toutes saisons confondues`
                }
                className={cn(
                  "px-1.5 py-0.5 font-mono text-[9px] font-bold transition-colors",
                  formKey === f.key
                    ? "bg-emerald-500/20 text-emerald-300"
                    : "bg-transparent text-slate-500 hover:text-slate-300",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        {/* Filtre saison — segmenté sur les saisons disponibles */}
        {sortedSeasons.length > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">
              Saison
            </span>
            <div className="flex overflow-hidden rounded border border-slate-700/60" role="group" aria-label="Saison">
              {sortedSeasons.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSeason(s)}
                  aria-pressed={effectiveSeason === s}
                  title={`Saison ${s}`}
                  className={cn(
                    "px-1.5 py-0.5 font-mono text-[9px] font-bold transition-colors",
                    effectiveSeason === s
                      ? "bg-emerald-500/20 text-emerald-300"
                      : "bg-transparent text-slate-500 hover:text-slate-300",
                  )}
                >
                  {s.slice(2)}
                </button>
              ))}
            </div>
            {formKey !== "full" && prevSeason && (
              <span className="text-[8.5px] leading-tight text-slate-600">
                + complément {prevSeason} si besoin
              </span>
            )}
          </div>
        )}
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
            {formKey === "full" ? (
              <>Source : football-data.co.uk{xgKeys.has(market) ? " · xG : Understat" : ""} · classement complet trié par {def.short}</>
            ) : (
              <>
                {formKey === "l5" ? 5 : 10} derniers matchs · {effectiveSeason}
                {prevSeason ? ` + complément ${prevSeason}` : ""} · trié par {def.short}
              </>
            )}
          </p>
        </div>
      )}
    </section>
  );
}

const xgKeys = new Set<MarketKey>(["xgFor", "xgAgainst"]);
