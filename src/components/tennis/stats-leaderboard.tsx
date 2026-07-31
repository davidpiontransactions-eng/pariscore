"use client";

// StatsLeaderboard — classement statistiques joueurs inspiré de l'ATP Tour
// Stats Leaderboard (https://www.atptour.com/en/stats/leaderboard).
//
// 3 boards : Service / Retour / Sous pression, chacun avec son Rating
// (colonne gras, tri par défaut) et ses colonnes de stats. Filtres :
// tour (ATP/WTA), surface, période (52 semaines / saison / tout) et niveau
// d'adversaire (vs Top N). Données : /api/tennis/stats-leaderboard (SWR),
// agrégation temps réel sur tennis_matches_internal.

import { useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Info,
  RotateCw,
} from "lucide-react";
import { useStatsLeaderboard } from "@/hooks/use-stats-leaderboard";
import { resolvePlayerPhoto } from "@/lib/player-photos";
import type {
  BoardType,
  LeaderboardRow,
  PeriodFilter,
  SurfaceFilter,
  TourFilter,
  VsRankFilter,
} from "@/lib/tennis-stats/leaderboard";
import { PlayerAvatar } from "@/components/ui/player-avatar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

// ─── Colonnes par board ──────────────────────────────────────────────────────

type StatKey =
  | "rating"
  | "firstServePct"
  | "firstServeWonPct"
  | "secondServeWonPct"
  | "serviceGamesWonPct"
  | "acesPerMatch"
  | "dfsPerMatch"
  | "returnFirstWonPct"
  | "returnSecondWonPct"
  | "returnGamesWonPct"
  | "bpConvertedPct"
  | "bpSavedPct"
  | "tiebreaksWonPct"
  | "decidingSetsWonPct";

type Format = "rating" | "pct" | "num";

interface ColumnDef {
  key: StatKey;
  /** Clé i18n dans tennis.statsLeaderboard.columns */
  labelKey: string;
  format: Format;
}

const BOARD_COLUMNS: Record<BoardType, ColumnDef[]> = {
  serve: [
    { key: "rating", labelKey: "serveRating", format: "rating" },
    { key: "firstServePct", labelKey: "firstServe", format: "pct" },
    { key: "firstServeWonPct", labelKey: "firstServeWon", format: "pct" },
    { key: "secondServeWonPct", labelKey: "secondServeWon", format: "pct" },
    { key: "serviceGamesWonPct", labelKey: "serviceGamesWon", format: "pct" },
    { key: "acesPerMatch", labelKey: "acesPerMatch", format: "num" },
    { key: "dfsPerMatch", labelKey: "dfsPerMatch", format: "num" },
  ],
  return: [
    { key: "rating", labelKey: "returnRating", format: "rating" },
    { key: "returnFirstWonPct", labelKey: "returnFirstWon", format: "pct" },
    { key: "returnSecondWonPct", labelKey: "returnSecondWon", format: "pct" },
    { key: "returnGamesWonPct", labelKey: "returnGamesWon", format: "pct" },
    { key: "bpConvertedPct", labelKey: "bpConverted", format: "pct" },
  ],
  pressure: [
    { key: "rating", labelKey: "pressureRating", format: "rating" },
    { key: "bpSavedPct", labelKey: "bpSaved", format: "pct" },
    { key: "bpConvertedPct", labelKey: "bpConverted", format: "pct" },
    { key: "tiebreaksWonPct", labelKey: "tiebreaksWon", format: "pct" },
    { key: "decidingSetsWonPct", labelKey: "decidingSetsWon", format: "pct" },
  ],
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Slug joueur — convention /tennis/player/[slug] (minuscules, underscores). */
function playerSlug(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function formatStat(value: number | null, format: Format): string {
  if (value == null) return "—";
  if (format === "pct") return `${value.toFixed(1)}%`;
  return value.toFixed(1);
}

type SortDir = "asc" | "desc";

/** Tri avec nulls toujours en fin (quel que soit le sens). */
function sortRows(rows: LeaderboardRow[], key: StatKey, dir: SortDir): LeaderboardRow[] {
  const mul = dir === "desc" ? -1 : 1;
  return [...rows].sort((a, b) => {
    const va = a[key];
    const vb = b[key];
    if (va == null && vb == null) return b.matches - a.matches;
    if (va == null) return 1;
    if (vb == null) return -1;
    return (va - vb) * mul || b.matches - a.matches;
  });
}


// ─── Composant principal ─────────────────────────────────────────────────────

export function StatsLeaderboard() {
  const t = useTranslations("tennis.statsLeaderboard");

  const [board, setBoard] = useState<BoardType>("serve");
  const [tour, setTour] = useState<TourFilter>("atp");
  const [surface, setSurface] = useState<SurfaceFilter>("all");
  const [period, setPeriod] = useState<PeriodFilter>("52w");
  const [vsRank, setVsRank] = useState<VsRankFilter>("all");
  const [sortKey, setSortKey] = useState<StatKey>("rating");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const { data, isLoading, mutate } = useStatsLeaderboard({
    board,
    tour,
    surface,
    period,
    vsRank,
  });

  const columns = BOARD_COLUMNS[board];
  const rows = useMemo(
    () => sortRows(data?.rows ?? [], sortKey, sortDir),
    [data?.rows, sortKey, sortDir]
  );

  function handleSort(key: StatKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  function handleBoardChange(value: string) {
    setBoard(value as BoardType);
    setSortKey("rating");
    setSortDir("desc");
  }

  const generatedAt = data?.meta.generatedAt
    ? new Date(data.meta.generatedAt).toLocaleString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <section
      aria-label={t("ariaLabel")}
      className="rounded-xl border border-border/60 bg-card/50"
    >
      {/* En-tête : titre + tooltip méthodologie */}
      <header className="flex flex-wrap items-center justify-between gap-3 px-4 pt-4 sm:px-6">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-bold tracking-tight sm:text-xl">
            {t("title")}
          </h1>
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label={t("methodologyAria")}
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Info className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs text-xs">
                {t(`methodology.${board}`)}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Toggle ATP / WTA */}
        <ToggleGroup
          type="single"
          value={tour}
          onValueChange={(v) => v && setTour(v as TourFilter)}
          aria-label={t("tourAria")}
          className="rounded-lg border border-border/60"
        >
          <ToggleGroupItem value="atp" className="px-4 text-xs font-bold">
            ATP
          </ToggleGroupItem>
          <ToggleGroupItem value="wta" className="px-4 text-xs font-bold">
            WTA
          </ToggleGroupItem>
        </ToggleGroup>
      </header>

      {/* Onglets boards */}
      <div className="px-4 pt-3 sm:px-6">
        <Tabs value={board} onValueChange={handleBoardChange}>
          <TabsList className="grid w-full grid-cols-3 sm:w-auto sm:min-w-105">
            <TabsTrigger value="serve">{t("boards.serve")}</TabsTrigger>
            <TabsTrigger value="return">{t("boards.return")}</TabsTrigger>
            <TabsTrigger value="pressure">{t("boards.pressure")}</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Barre de filtres (style ATP : selects + refresh) */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-3 sm:px-6">
        <Select value={vsRank} onValueChange={(v) => setVsRank(v as VsRankFilter)}>
          <SelectTrigger className="w-44" aria-label={t("filters.vsRankAria")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("filters.vsAll")}</SelectItem>
            <SelectItem value="top5">Top 5</SelectItem>
            <SelectItem value="top10">Top 10</SelectItem>
            <SelectItem value="top20">Top 20</SelectItem>
            <SelectItem value="top50">Top 50</SelectItem>
            <SelectItem value="top100">Top 100</SelectItem>
          </SelectContent>
        </Select>

        <Select value={period} onValueChange={(v) => setPeriod(v as PeriodFilter)}>
          <SelectTrigger className="w-40" aria-label={t("filters.periodAria")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="52w">{t("filters.period52w")}</SelectItem>
            <SelectItem value="ytd">{t("filters.periodYtd")}</SelectItem>
            <SelectItem value="all">{t("filters.periodAll")}</SelectItem>
          </SelectContent>
        </Select>

        <Select value={surface} onValueChange={(v) => setSurface(v as SurfaceFilter)}>
          <SelectTrigger className="w-40" aria-label={t("filters.surfaceAria")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("filters.surfaceAll")}</SelectItem>
            <SelectItem value="hard">{t("filters.hard")}</SelectItem>
            <SelectItem value="clay">{t("filters.clay")}</SelectItem>
            <SelectItem value="grass">{t("filters.grass")}</SelectItem>
          </SelectContent>
        </Select>

        <button
          type="button"
          onClick={() => mutate()}
          aria-label={t("refreshAria")}
          className="ml-auto inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/60 text-muted-foreground transition-colors hover:border-border hover:text-foreground"
        >
          <RotateCw className="h-4 w-4" />
        </button>
      </div>

      {/* Tableau classement (scroll horizontal sur mobile) */}
      <div className="overflow-x-auto px-2 pb-2 sm:px-4">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-10 text-center text-xs">#</TableHead>
              <TableHead className="sticky left-0 z-10 min-w-44 bg-card/95 text-xs backdrop-blur">
                {t("columns.player")}
              </TableHead>
              {columns.map((col) => {
                const active = sortKey === col.key;
                const Icon = active
                  ? sortDir === "desc"
                    ? ArrowDown
                    : ArrowUp
                  : ArrowUpDown;
                return (
                  <TableHead
                    key={col.key}
                    className="text-center text-xs"
                    aria-sort={active ? (sortDir === "desc" ? "descending" : "ascending") : undefined}
                  >
                    <button
                      type="button"
                      onClick={() => handleSort(col.key)}
                      className={cn(
                        "inline-flex items-center gap-1 whitespace-nowrap transition-colors",
                        active
                          ? "font-semibold text-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {t(`columns.${col.labelKey}`)}
                      <Icon className="h-3 w-3" aria-hidden />
                    </button>
                  </TableHead>
                );
              })}
              <TableHead className="w-14 text-center text-xs">
                {t("columns.matches")}
              </TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {isLoading &&
              Array.from({ length: 10 }).map((_, i) => (
                <TableRow key={`skel-${i}`}>
                  <TableCell colSpan={2}>
                    <Skeleton className="h-9 w-full" />
                  </TableCell>
                  {columns.map((col) => (
                    <TableCell key={col.key}>
                      <Skeleton className="mx-auto h-4 w-12" />
                    </TableCell>
                  ))}
                  <TableCell>
                    <Skeleton className="mx-auto h-4 w-8" />
                  </TableCell>
                </TableRow>
              ))}

            {!isLoading && rows.length === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={columns.length + 3}
                  className="py-12 text-center text-sm text-muted-foreground"
                >
                  {data?.meta.dataUnavailable
                    ? t("emptyUnavailable")
                    : t("emptyNoPlayers", { min: data?.meta.minMatches ?? 5 })}
                </TableCell>
              </TableRow>
            )}

            {!isLoading &&
              rows.map((row) => (
                <TableRow key={`${row.rank}-${row.player}`}>
                  <TableCell className="text-center font-mono text-xs text-muted-foreground tabular-nums">
                    {row.rank}
                  </TableCell>
                  <TableCell className="sticky left-0 z-10 bg-card/95 backdrop-blur">
                    <Link
                      href={`/tennis/player/${playerSlug(row.player)}`}
                      className="group flex items-center gap-2.5"
                    >
                      <PlayerAvatar
                        name={row.player}
                        photoUrl={resolvePlayerPhoto(row.player, row.playerId ?? undefined)}
                        countryCode={row.ioc}
                        size="sm"
                      />
                      <span className="max-w-40 truncate text-sm font-medium group-hover:underline">
                        {row.player}
                      </span>
                    </Link>
                  </TableCell>
                  {columns.map((col) => (
                    <TableCell
                      key={col.key}
                      className={cn(
                        "text-center text-sm tabular-nums",
                        col.format === "rating"
                          ? "font-bold text-foreground"
                          : "text-muted-foreground"
                      )}
                    >
                      {formatStat(row[col.key], col.format)}
                    </TableCell>
                  ))}
                  <TableCell className="text-center text-xs text-muted-foreground tabular-nums">
                    {row.matches}
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>

      {/* Pied : méthodologie + fraîcheur */}
      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-border/40 px-4 py-2.5 text-[11px] text-muted-foreground sm:px-6">
        <span>{t("sampleNote", { min: data?.meta.minMatches ?? 5 })}</span>
        {generatedAt && <span>{t("generatedAt", { date: generatedAt })}</span>}
      </footer>
    </section>
  );
}

