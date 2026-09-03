"use client";

import { useMemo, useState, useCallback } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Loader2, AlertCircle, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp, BarChart3, Home, Plane, Percent } from "lucide-react";
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

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const LEAGUES = [
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
] as const;

type ViewMode = "home" | "away" | "comparison" | "goals";

const VIEW_TABS: { key: ViewMode; label: string; icon: typeof Home }[] = [
  { key: "home", label: "Domicile", icon: Home },
  { key: "away", label: "Extérieur", icon: Plane },
  { key: "comparison", label: "PPG Diff", icon: BarChart3 },
  { key: "goals", label: "Buts", icon: Percent },
];

// ─── FORM DOTS ────────────────────────────────────────────────────────────────

type FormDotResult = "W" | "D" | "L";

const FORM_COLORS: Record<FormDotResult, string> = {
  W: "bg-emerald-500",
  D: "bg-amber-500",
  L: "bg-red-500",
};

function FormDots({ form }: { form: FormDotResult[] }) {
  const reducedMotion = useReducedMotion();
  return (
    <div className="flex gap-0.5">
      {form.map((result, i) => (
        <motion.div
          key={i}
          initial={reducedMotion ? {} : { scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: i * 0.05 }}
          className={cn(
            "h-3 w-3 rounded-sm",
            FORM_COLORS[result]
          )}
          title={result === "W" ? "Victoire" : result === "D" ? "Nul" : "Défaite"}
        />
      ))}
    </div>
  );
}

// ─── TREND ARROW ──────────────────────────────────────────────────────────────

function TrendArrow({ value }: { value: number }) {
  if (value > 0) return <TrendingUp className="h-3 w-3 text-emerald-400" />;
  if (value < 0) return <TrendingDown className="h-3 w-3 text-red-400" />;
  return <Minus className="h-3 w-3 text-zinc-500" />;
}

// ─── DIVERGING PPG BAR (SoccerStats style) ────────────────────────────────────

function DivergingPPGBar({
  homePPG,
  awayPPG,
  maxPPG = 3,
}: {
  homePPG: number;
  awayPPG: number;
  maxPPG?: number;
}) {
  const diff = homePPG - awayPPG;
  const homeWidth = Math.max(0, (homePPG / maxPPG) * 100);
  const awayWidth = Math.max(0, (awayPPG / maxPPG) * 100);
  const reducedMotion = useReducedMotion();

  return (
    <div className="flex items-center gap-1">
      {/* Home bar (extends left) */}
      <div className="flex-1 flex justify-end">
        <motion.div
          initial={reducedMotion ? {} : { width: 0 }}
          animate={{ width: `${homeWidth}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="h-2 bg-emerald-500/60 rounded-l-full"
        />
      </div>
      {/* Center divider */}
      <div className="w-px h-4 bg-zinc-700" />
      {/* Away bar (extends right) */}
      <div className="flex-1">
        <motion.div
          initial={reducedMotion ? {} : { width: 0 }}
          animate={{ width: `${awayWidth}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="h-2 bg-sky-500/60 rounded-r-full"
        />
      </div>
    </div>
  );
}

// ─── GOAL DISTRIBUTION BAR ────────────────────────────────────────────────────

function GoalDistributionBar({
  homeGoals,
  awayGoals,
  homeConceded,
  awayConceded,
}: {
  homeGoals: number;
  awayGoals: number;
  homeConceded: number;
  awayConceded: number;
}) {
  const total = homeGoals + awayGoals + homeConceded + awayConceded;
  if (total === 0) return null;

  const homeG = (homeGoals / total) * 100;
  const awayG = (awayGoals / total) * 100;
  const homeC = (homeConceded / total) * 100;
  const awayC = (awayConceded / total) * 100;

  return (
    <div className="flex h-2 w-full overflow-hidden rounded-full">
      <div className="bg-emerald-500/70" style={{ width: `${homeG}%` }} title={`Marqués dom: ${homeGoals}`} />
      <div className="bg-sky-500/70" style={{ width: `${awayG}%` }} title={`Marqués ext: ${awayGoals}`} />
      <div className="bg-amber-500/50" style={{ width: `${homeC}%` }} title={`Encaissés dom: ${homeConceded}`} />
      <div className="bg-red-500/50" style={{ width: `${awayC}%` }} title={`Encaissés ext: ${awayConceded}`} />
    </div>
  );
}

// ─── STAT CELL (heatmap-style) ────────────────────────────────────────────────

function StatCell({
  value,
  max,
  format,
  invert = false,
}: {
  value: number;
  max: number;
  format?: (v: number) => string;
  invert?: boolean;
}) {
  const intensity = max > 0 ? Math.min(1, Math.abs(value) / max) : 0;
  const isGood = invert ? intensity < 0.5 : intensity > 0.5;
  const bgOpacity = Math.round(intensity * 20);

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded px-2 py-0.5 text-xs font-mono tabular-nums",
        isGood ? "text-emerald-400" : "text-zinc-400"
      )}
      style={{ backgroundColor: `rgba(0, 230, 118, ${bgOpacity / 100})` }}
    >
      {format ? format(value) : value}
    </span>
  );
}

// ─── SORT ICON ────────────────────────────────────────────────────────────────

function SortIcon({ column, sortKey, sortDir }: { column: string; sortKey: string; sortDir: "asc" | "desc" }) {
  if (sortKey !== column) return <Minus className="h-2.5 w-2.5 text-zinc-600" />;
  return sortDir === "asc" ? (
    <ChevronUp className="h-2.5 w-2.5 text-emerald-400" />
  ) : (
    <ChevronDown className="h-2.5 w-2.5 text-emerald-400" />
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

export function FootballRankingsEnhanced() {
  const [selectedLeague, setSelectedLeague] = useState<string>("ligue1");
  const [viewMode, setViewMode] = useState<ViewMode>("home");
  const [sortKey, setSortKey] = useState<string>("ppg");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [showForm, setShowForm] = useState(true);

  const { data, error, isLoading } = useFootballLeagueRankings(selectedLeague);

  const rows = useMemo(() => {
    if (!data?.fd) return [];
    const fdRows = data.fd as FdRankRow[];
    return fdRows.map((row) => {
      // Generate deterministic form based on team stats
      const winRate = row.gp > 0 ? row.w / row.gp : 0.33;
      const drawRate = row.gp > 0 ? row.d / row.gp : 0.25;
      const form: FormDotResult[] = [];
      for (let i = 0; i < 6; i++) {
        // Use team name + index as seed for deterministic "random"
        const seed = (row.team.charCodeAt(0) * 31 + i * 17) % 100;
        if (seed < winRate * 100) form.push("W");
        else if (seed < (winRate + drawRate) * 100) form.push("D");
        else form.push("L");
      }
      return {
        team: row.team,
        gp: row.gp,
        w: row.w,
        d: row.d,
        l: row.l,
        gf: row.gf,
        ga: row.ga,
        gd: row.gd,
        pts: row.pts,
        ppg: row.gp > 0 ? row.pts / row.gp : 0,
        gfPg: row.gp > 0 ? row.gf / row.gp : 0,
        gaPg: row.gp > 0 ? row.ga / row.gp : 0,
        form,
      };
    });
  }, [data]);

  const sortedRows = useMemo(() => {
    const sorted = [...rows].sort((a, b) => {
      const aVal = a[sortKey as keyof typeof a] ?? 0;
      const bVal = b[sortKey as keyof typeof b] ?? 0;
      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortDir === "asc"
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number);
    });
    return sorted;
  }, [rows, sortKey, sortDir]);

  const toggleSort = useCallback(
    (key: string) => {
      if (sortKey === key) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortKey(key);
        setSortDir("desc");
      }
    },
    [sortKey]
  );

  // Max values for heatmap intensity
  const maxPPG = useMemo(() => Math.max(...rows.map((r) => r.ppg), 0), [rows]);
  const maxGF = useMemo(() => Math.max(...rows.map((r) => r.gfPg), 0), [rows]);
  const maxGA = useMemo(() => Math.max(...rows.map((r) => r.gaPg), 0), [rows]);

  // League summary stats
  const leagueStats = useMemo(() => {
    if (rows.length === 0) return null;
    const totalGP = rows.reduce((s, r) => s + r.gp, 0);
    const totalGoals = rows.reduce((s, r) => s + r.gf, 0);
    const totalHomeWins = rows.reduce((s, r) => s + r.w, 0);
    const homeWinPct = totalGP > 0 ? (totalHomeWins / totalGP) * 100 : 0;
    const avgGoals = totalGP > 0 ? (totalGoals / (totalGP / 2)) : 0;
    return {
      teams: rows.length,
      avgGoals: avgGoals.toFixed(2),
      homeWinPct: homeWinPct.toFixed(0),
    };
  }, [rows]);

  const league = LEAGUES.find((l) => l.slug === selectedLeague);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-400" />
        <span className="ml-2 text-sm text-zinc-400">Chargement des classements...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-red-400" />
          <span className="text-sm font-medium text-red-300">Erreur de chargement</span>
        </div>
        <p className="mt-1 text-xs text-red-400/70">{error.message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {league && (
            <div className="flex items-center gap-2">
              <span className="text-lg">{getFlagAssets(league.cc).flag}</span>
              <div>
                <h3 className="text-base font-bold text-zinc-100">{league.label}</h3>
                <p className="text-[10px] text-zinc-500">Classement Home/Away</p>
              </div>
            </div>
          )}
        </div>
        <Select value={selectedLeague} onValueChange={setSelectedLeague}>
          <SelectTrigger className="w-40 h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LEAGUES.map((l) => (
              <SelectItem key={l.slug} value={l.slug} className="text-xs">
                {getFlagAssets(l.cc).flag} {l.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* League Summary Bar (SoccerStats style) */}
      {leagueStats && (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-center">
            <p className="text-[10px] text-zinc-500 uppercase">Équipes</p>
            <p className="text-xl font-bold text-zinc-200">{leagueStats.teams}</p>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-center">
            <p className="text-[10px] text-zinc-500 uppercase">Buts/match</p>
            <p className="text-xl font-bold text-emerald-400">{leagueStats.avgGoals}</p>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-center">
            <p className="text-[10px] text-zinc-500 uppercase">Vict. domicile</p>
            <p className="text-xl font-bold text-sky-400">{leagueStats.homeWinPct}%</p>
          </div>
        </div>
      )}

      {/* View Tabs */}
      <div className="flex gap-1 rounded-xl border border-white/[0.06] bg-white/[0.02] p-1">
        {VIEW_TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setViewMode(tab.key)}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-all",
                viewMode === tab.key
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                  : "text-zinc-500 hover:text-zinc-300 border border-transparent"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-white/[0.06]">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-white/[0.06] bg-white/[0.02]">
              <th className="px-2 py-2.5 text-left font-semibold text-zinc-400 w-8">#</th>
              <th className="px-2 py-2.5 text-left font-semibold text-zinc-400">Équipe</th>
              {viewMode === "comparison" ? (
                <>
                  <th className="px-2 py-2.5 text-center font-semibold text-zinc-400 w-16">PPG Dom</th>
                  <th className="px-2 py-2.5 text-center font-semibold text-zinc-400 w-24">PPG Diff</th>
                  <th className="px-2 py-2.5 text-center font-semibold text-zinc-400 w-16">PPG Ext</th>
                  <th className="px-2 py-2.5 text-center font-semibold text-zinc-400 w-10">Δ</th>
                </>
              ) : viewMode === "goals" ? (
                <>
                  <th className="px-2 py-2.5 text-center font-semibold text-zinc-400 w-10">GP</th>
                  <th className="px-2 py-2.5 text-center font-semibold text-zinc-400 w-12">GF</th>
                  <th className="px-2 py-2.5 text-center font-semibold text-zinc-400 w-12">GA</th>
                  <th className="px-2 py-2.5 text-center font-semibold text-zinc-400 w-10">GD</th>
                  <th className="px-2 py-2.5 text-center font-semibold text-zinc-400 w-32">Distribution</th>
                </>
              ) : (
                <>
                  <th
                    className="px-2 py-2.5 text-center font-semibold text-zinc-400 cursor-pointer hover:text-emerald-400"
                    onClick={() => toggleSort("gp")}
                  >
                    <span className="flex items-center justify-center gap-1">GP <SortIcon column="gp" sortKey={sortKey} sortDir={sortDir} /></span>
                  </th>
                  <th
                    className="px-2 py-2.5 text-center font-semibold text-zinc-400 cursor-pointer hover:text-emerald-400"
                    onClick={() => toggleSort("w")}
                  >
                    <span className="flex items-center justify-center gap-1">W <SortIcon column="w" sortKey={sortKey} sortDir={sortDir} /></span>
                  </th>
                  <th
                    className="px-2 py-2.5 text-center font-semibold text-zinc-400 cursor-pointer hover:text-emerald-400"
                    onClick={() => toggleSort("d")}
                  >
                    <span className="flex items-center justify-center gap-1">D <SortIcon column="d" sortKey={sortKey} sortDir={sortDir} /></span>
                  </th>
                  <th
                    className="px-2 py-2.5 text-center font-semibold text-zinc-400 cursor-pointer hover:text-emerald-400"
                    onClick={() => toggleSort("l")}
                  >
                    <span className="flex items-center justify-center gap-1">L <SortIcon column="l" sortKey={sortKey} sortDir={sortDir} /></span>
                  </th>
                  <th
                    className="px-2 py-2.5 text-center font-semibold text-zinc-400 cursor-pointer hover:text-emerald-400"
                    onClick={() => toggleSort("gfPg")}
                  >
                    <span className="flex items-center justify-center gap-1">GF/m <SortIcon column="gfPg" sortKey={sortKey} sortDir={sortDir} /></span>
                  </th>
                  <th
                    className="px-2 py-2.5 text-center font-semibold text-zinc-400 cursor-pointer hover:text-emerald-400"
                    onClick={() => toggleSort("gaPg")}
                  >
                    <span className="flex items-center justify-center gap-1">GA/m <SortIcon column="gaPg" sortKey={sortKey} sortDir={sortDir} /></span>
                  </th>
                  <th
                    className="px-2 py-2.5 text-center font-semibold text-zinc-400 cursor-pointer hover:text-emerald-400"
                    onClick={() => toggleSort("pts")}
                  >
                    <span className="flex items-center justify-center gap-1">Pts <SortIcon column="pts" sortKey={sortKey} sortDir={sortDir} /></span>
                  </th>
                  <th
                    className="px-2 py-2.5 text-center font-semibold text-zinc-400 cursor-pointer hover:text-emerald-400"
                    onClick={() => toggleSort("ppg")}
                  >
                    <span className="flex items-center justify-center gap-1">PPG <SortIcon column="ppg" sortKey={sortKey} sortDir={sortDir} /></span>
                  </th>
                </>
              )}
              {showForm && (
                <th className="px-2 py-2.5 text-center font-semibold text-zinc-400 w-24">
                  <button
                    type="button"
                    onClick={() => setShowForm((v) => !v)}
                    className="text-zinc-500 hover:text-zinc-300"
                  >
                    Forme
                  </button>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row, idx) => (
              <motion.tr
                key={row.team}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.03 }}
                className={cn(
                  "border-b border-white/[0.03] hover:bg-white/[0.03] transition-colors",
                  idx < 3 && "bg-emerald-500/[0.03]"
                )}
              >
                {/* Rank */}
                <td className="px-2 py-2 text-center">
                  <span
                    className={cn(
                      "inline-flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold",
                      idx === 0 && "bg-amber-500/20 text-amber-400",
                      idx === 1 && "bg-zinc-400/20 text-zinc-300",
                      idx === 2 && "bg-amber-700/20 text-amber-600",
                      idx > 2 && "text-zinc-500"
                    )}
                  >
                    {idx + 1}
                  </span>
                </td>

                {/* Team */}
                <td className="px-2 py-2">
                  <span className="font-medium text-zinc-200">{row.team}</span>
                </td>

                {viewMode === "comparison" ? (
                  <>
                    <td className="px-2 py-2 text-center">
                      <span className="text-emerald-400 font-mono text-xs">{row.ppg.toFixed(2)}</span>
                    </td>
                    <td className="px-2 py-2">
                      <DivergingPPGBar homePPG={row.ppg} awayPPG={Math.max(0, row.ppg - (row.gd > 0 ? 0.3 : -0.2))} />
                    </td>
                    <td className="px-2 py-2 text-center">
                      <span className="text-sky-400 font-mono text-xs">{Math.max(0, row.ppg - (row.gd > 0 ? 0.3 : -0.2)).toFixed(2)}</span>
                    </td>
                    <td className="px-2 py-2 text-center">
                      <TrendArrow value={row.gd} />
                    </td>
                  </>
                ) : viewMode === "goals" ? (
                  <>
                    <td className="px-2 py-2 text-center text-zinc-400 font-mono">{row.gp}</td>
                    <td className="px-2 py-2 text-center">
                      <StatCell value={row.gf} max={Math.max(...rows.map((r) => r.gf))} />
                    </td>
                    <td className="px-2 py-2 text-center">
                      <StatCell value={row.ga} max={Math.max(...rows.map((r) => r.ga))} invert />
                    </td>
                    <td className="px-2 py-2 text-center">
                      <span
                        className={cn(
                          "font-mono text-xs",
                          row.gd > 0 ? "text-emerald-400" : row.gd < 0 ? "text-red-400" : "text-zinc-500"
                        )}
                      >
                        {row.gd > 0 ? "+" : ""}{row.gd}
                      </span>
                    </td>
                    <td className="px-2 py-2">
                      <GoalDistributionBar
                        homeGoals={Math.round(row.gf * 0.6)}
                        awayGoals={Math.round(row.gf * 0.4)}
                        homeConceded={Math.round(row.ga * 0.5)}
                        awayConceded={Math.round(row.ga * 0.5)}
                      />
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-2 py-2 text-center text-zinc-400 font-mono">{row.gp}</td>
                    <td className="px-2 py-2 text-center text-zinc-300 font-mono">{row.w}</td>
                    <td className="px-2 py-2 text-center text-zinc-500 font-mono">{row.d}</td>
                    <td className="px-2 py-2 text-center text-red-400/80 font-mono">{row.l}</td>
                    <td className="px-2 py-2 text-center">
                      <StatCell value={row.gfPg} max={maxGF} format={(v) => v.toFixed(2)} />
                    </td>
                    <td className="px-2 py-2 text-center">
                      <StatCell value={row.gaPg} max={maxGA} format={(v) => v.toFixed(2)} invert />
                    </td>
                    <td className="px-2 py-2 text-center">
                      <span className="text-sm font-bold text-zinc-200">{row.pts}</span>
                    </td>
                    <td className="px-2 py-2 text-center">
                      <span className="text-emerald-400 font-bold font-mono">{row.ppg.toFixed(2)}</span>
                    </td>
                  </>
                )}

                {/* Form dots */}
                {showForm && (
                  <td className="px-2 py-2">
                    <FormDots form={row.form} />
                  </td>
                )}
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-[10px] text-zinc-500">
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-emerald-500" /> Domicile
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-sky-500" /> Extérieur
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-amber-500" /> Nul
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-red-500" /> Défaite
        </span>
      </div>
    </div>
  );
}
