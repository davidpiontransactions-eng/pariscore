"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { Loader2, AlertCircle } from "lucide-react";
import { useFootballLeagueRankings } from "@/hooks/use-football-rankings";
import type { FdRankRow, XgRankRow } from "@/hooks/use-football-rankings";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getFlagAssets } from "@/lib/flag-utils";
import { useFootballPlayers } from "@/hooks/use-football-players";
import type { PlayerRow } from "@/app/api/football/players/route";

const LEAGUES: { slug: string; label: string; cc: string }[] = [
  { slug: "ligue1", label: "Ligue 1", cc: "FR" },
  { slug: "epl", label: "Premier League", cc: "GB-ENG" },
  { slug: "laliga", label: "La Liga", cc: "ES" },
  { slug: "bundesliga", label: "Bundesliga", cc: "DE" },
  { slug: "seriea", label: "Serie A", cc: "IT" },
  { slug: "primeira_liga", label: "Liga Portugal", cc: "PT" },
  { slug: "eredivisie", label: "Eredivisie", cc: "NL" },
  { slug: "championship", label: "Championship", cc: "GB-ENG" },
  { slug: "ligue2", label: "Ligue 2", cc: "FR" },
  { slug: "laliga2", label: "La Liga 2", cc: "ES" },
  { slug: "bundesliga2", label: "2. Bundesliga", cc: "DE" },
  { slug: "serieb", label: "Serie B", cc: "IT" },
  { slug: "jupiler", label: "Pro League", cc: "BE" },
  { slug: "super_lig", label: "Süper Lig", cc: "TR" },
  { slug: "superleague_greece", label: "Super League GR", cc: "GR" },
  { slug: "scot_prem", label: "Écosse", cc: "GB-SCT" },
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

/** Panel Buteurs / Passeurs — source Understat, moyennes par match. */
function PlayersPanel({
  kind,
  league,
  season,
  scopeNote,
}: {
  kind: "scorers" | "assisters";
  league: string;
  season: string;
  scopeNote: boolean;
}) {
  const { data, error, isLoading } = useFootballPlayers(league, season);
  const rows = kind === "scorers" ? data?.scorers : data?.assisters;
  const unit = kind === "scorers" ? "buts/m" : "passes/m";

  return (
    <div className="px-2.5">
      {scopeNote && (
        <p className="pb-1 text-[8.5px] leading-tight text-slate-600">
          Joueurs : Global uniquement (source Understat — split Dom/Ext non couvert).
        </p>
      )}
      {isLoading ? (
        <div className="flex items-center justify-center gap-1.5 px-2.5 py-4 text-[11px] text-slate-500">
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
          Chargement…
        </div>
      ) : error ? (
        <div className="flex items-start gap-1.5 px-2.5 py-3 text-[11px] leading-snug text-slate-500">
          <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
          {(error as Error).message}
        </div>
      ) : !rows?.length ? (
        <p className="py-2 text-[11px] text-slate-500">Aucune donnée joueur pour cette saison.</p>
      ) : (
        <>
          <ol className="space-y-px">
            {rows.map((r: PlayerRow, i) => (
              <li
                key={r.name}
                className="flex items-center gap-1.5 rounded px-0.5 py-0.5 hover:bg-slate-800/60"
              >
                <span className="w-4 shrink-0 text-right font-mono text-[9px] tabular-nums text-slate-600">
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    {r.photo ? (
                      <img
                        src={r.photo}
                        alt={r.name || "Joueur"}
                        loading="lazy"
                        width={18}
                        height={18}
                        className="h-[18px] w-[18px] shrink-0 rounded-full bg-slate-800 object-cover"
                      />
                    ) : (
                      <span
                        aria-hidden
                        className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-slate-800 text-[8px] font-bold text-slate-400"
                      >
                        {r.name.slice(0, 1).toUpperCase()}
                      </span>
                    )}
                    <span className="truncate text-[10px] leading-tight text-slate-300">
                      {r.name}
                    </span>
                  </span>
                  <span className="block truncate pl-[24px] text-[8px] leading-tight text-slate-500">
                    {r.team}
                  </span>
                </span>
                <span
                  className="shrink-0 font-mono text-[8px] tabular-nums text-slate-600"
                  title="Matchs joués"
                >
                  {r.games}j
                </span>
                <span
                  className="shrink-0 text-right font-mono text-[8.5px] tabular-nums text-emerald-400"
                  title={`Moyenne par match (${unit})`}
                >
                  {num1(r.perMatch)}
                </span>
                <span
                  title={kind === "scorers" ? "Buts" : "Passes décisives"}
                  className="shrink-0 rounded bg-emerald-500/15 px-1 py-0.5 font-mono text-[9px] font-bold tabular-nums text-emerald-300"
                >
                  {r.total}
                </span>
              </li>
            ))}
          </ol>
          <p className="pt-1 text-[8px] leading-tight text-slate-600">
            {kind === "scorers" ? "Buts" : "Passes décisives"} · moyenne / match · source Understat · top 10
          </p>
        </>
      )}
    </div>
  );
}

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
  const [view, setView] = useState<"teams" | "scorers" | "assisters">("teams");

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
  const players = useFootballPlayers(view === "teams" ? null : league, effectiveSeason);

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
        {/* Vue : équipes ou joueurs */}
        <div className="flex overflow-hidden rounded border border-slate-700/60" role="group" aria-label="Vue">
          {([
            { key: "teams", label: "Équipes" },
            { key: "scorers", label: "Buteurs" },
            { key: "assisters", label: "Passeurs" },
          ] as const).map((v) => (
            <button
              key={v.key}
              type="button"
              onClick={() => setView(v.key)}
              aria-pressed={view === v.key}
              className={cn(
                "px-1.5 py-0.5 text-[9px] font-semibold transition-colors",
                view === v.key
                  ? "bg-emerald-500/20 text-emerald-300"
                  : "bg-transparent text-slate-500 hover:text-slate-300",
              )}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1 px-2.5 pb-1.5">
        <Select value={league} onValueChange={setLeague}>
          <SelectTrigger
            size="sm"
            aria-label="Championnat"
            className="h-8 w-full rounded-lg border-slate-700/80 bg-slate-900/90 text-xs font-medium text-slate-200 focus:ring-1 focus:ring-emerald-500"
          >
            <SelectValue placeholder="Choisir un championnat…" />
          </SelectTrigger>
          <SelectContent className="border-slate-800 bg-slate-900 text-slate-200">
            {LEAGUES.map((l) => {
              const flag = getFlagAssets(l.cc);
              return (
                <SelectItem key={l.slug} value={l.slug} className="text-xs">
                  <span className="inline-flex items-center gap-2">
                    <img
                      src={flag.url}
                      alt=""
                      loading="lazy"
                      width={18}
                      height={13}
                      className="h-[13px] w-[18px] shrink-0 rounded-[2px] object-cover"
                    />
                    {l.label}
                  </span>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
        {view === "teams" && (
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
        )}
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

      {/* Marché statistique — liste déroulante (les pills débordaient) */}
      {view === "teams" ? (
        <>
      <div className="space-y-0.5 px-2.5 pb-1.5">
        <Select value={market} onValueChange={(v) => setMarket(v as MarketKey)}>
          <SelectTrigger
            size="sm"
            aria-label="Marché statistique"
            className="h-8 w-full rounded-lg border-slate-700/80 bg-slate-900/90 text-xs font-medium text-slate-200 focus:ring-1 focus:ring-emerald-500"
          >
            <SelectValue placeholder="Choisir un marché…" />
          </SelectTrigger>
          <SelectContent className="border-slate-800 bg-slate-900 text-slate-200">
            {MARKETS.map((m) => (
              <SelectItem key={m.key} value={m.key} className="text-xs">
                {m.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="truncate pt-0.5 text-[10px] font-medium text-emerald-400/90" title={def.title}>
          Trié par : {def.short}
        </p>
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
              <table className="border-collapse text-[9px]">
                <thead>
                  <tr className="text-slate-600">
                    <th scope="col" className="w-4 py-0.5 pr-1 text-right font-medium">#</th>
                    <th scope="col" className="w-[104px] py-0.5 text-left font-medium">Équipe</th>
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
                        <td className="w-[104px] truncate py-0.5 text-[10px] text-slate-300">
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
        </>
      ) : (
        <PlayersPanel
          kind={view === "scorers" ? "scorers" : "assisters"}
          league={league}
          season={effectiveSeason}
          scopeNote={scope !== "overall"}
        />
      )}
    </section>
  );
}

const xgKeys = new Set<MarketKey>(["xgFor", "xgAgainst"]);
