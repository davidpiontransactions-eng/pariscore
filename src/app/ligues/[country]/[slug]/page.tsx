"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import useSWR from "swr";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  ExternalLink,
  Trophy,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle } from "lucide-react";
import { LeagueFixturesList } from "@/components/leagues/league-fixtures-list";
import { LeagueStatGrid } from "@/components/leagues/league-stat-grid";
import { LeagueTabNav, type LeagueTab } from "@/components/leagues/league-tab-nav";
import { StatCategoryPills, type StatCategory, CATEGORY_COLUMNS } from "@/components/leagues/stat-category-pills";
import { StandingsTable, type StandingRow } from "@/components/leagues/league-stats-table";
import { PlayerStatsFilters, type GameRange, type Position, type ScaleMode } from "@/components/leagues/player-stats-filters";
import { PlayerStatsTable } from "@/components/leagues/player-stats-table";
import { per90 } from "@/lib/football-understat-types";
import { GoalsMapScatter } from "@/components/leagues/goals-map-scatter";
import type { LeagueDetail } from "@/lib/leagues-stats/types";

const fetcher = async (url: string) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
};

type FullLeagueResponse = {
  league: {
    slug: string;
    name: string;
    country: string;
    sources: { bsd: boolean; fbref: boolean; understat: boolean };
  };
  standings: StandingRow[];
  playerStats: Record<string, unknown[]>;
  understatPlayers: Array<{
    player_name: string;
    team: string;
    xG: number | null;
    xAG: number | null;
    npxG: number | null;
    shots: number | null;
    key_passes: number | null;
    assists: number | null;
    goals: number | null;
    position: string | null;
    apps: number | null;
    time: number | null;
    photo?: string | null;
  }> | null;
  xgRanking: unknown[] | null;
};

export default function LeagueDetailPage() {
  const { country, slug } = useParams<{ country: string; slug: string }>();

  // Données legacy OddAlerts (fixtures + hero)
  const { data: legacyData, error: legacyError, isLoading: legacyLoading } = useSWR<{ league: LeagueDetail }>(
    country && slug ? `/api/v1/leagues-stats/${country}/${slug}` : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 600_000 },
  );

  // Données unifiées (standings + player stats)
  const { data: fullData, error: fullError, isLoading: fullLoading } = useSWR<FullLeagueResponse>(
    country && slug ? `/api/v1/leagues-stats/${country}/${slug}/full` : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 600_000 },
  );

  const league = legacyData?.league;
  const full = fullData;

  // État des onglets
  const [activeTab, setActiveTab] = useState<LeagueTab>("standing");
  const [activeCategory, setActiveCategory] = useState<StatCategory>("overview");

  // État des filtres joueurs
  const [playerSearch, setPlayerSearch] = useState("");
  const [gameRange, setGameRange] = useState<GameRange>("all");
  const [position, setPosition] = useState<Position>("all");
  const [scale, setScale] = useState<ScaleMode>("total");

  // Filtrage des joueurs Understat
  const filteredPlayers = useMemo(() => {
    const players = full?.understatPlayers ?? [];
    return players.filter((p) => {
      if (playerSearch) {
        const q = playerSearch.toLowerCase();
        if (!p.player_name?.toLowerCase().includes(q) && !p.team?.toLowerCase().includes(q)) return false;
      }
      if (position !== "all" && p.position !== position) return false;
      return true;
    });
  }, [full?.understatPlayers, playerSearch, position]);

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">
      {/* Retour */}
      <div className="mb-4">
        <Link
          href="/ligues"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Tous les championnats
        </Link>
      </div>

      {/* Hero */}
      {legacyLoading ? (
        <Skeleton className="mb-6 h-20 rounded-lg" />
      ) : legacyError || fullError ? (
        <div className="mb-6 flex items-start gap-3 rounded-lg border border-rose-500/40 bg-rose-500/5 p-4 text-sm text-rose-700 dark:text-rose-300">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">Erreur de chargement</p>
            <p className="mt-0.5 text-xs">
              Cette compétition est introuvable ou temporairement indisponible.
            </p>
          </div>
        </div>
      ) : league ? (
        <>
          <div className="mb-6 flex items-center gap-4">
            {league.logoUrl ? (
              <img
                src={league.logoUrl}
                alt=""
                className="h-12 w-12 shrink-0 object-contain"
                loading="lazy"
              />
            ) : (
              <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
                <Trophy className="h-6 w-6 text-muted-foreground" />
              </span>
            )}
            <div className="min-w-0">
              <h1 className="truncate text-xl font-bold tracking-tight">
                {league.name}
              </h1>
              <p className="truncate text-xs capitalize text-muted-foreground">
                {league.country.replace(/-/g, " ")}
                {league.seasonLabel ? ` · Saison ${league.seasonLabel}` : ""}
                {league.gamesPlayed > 0 ? ` · ${league.gamesPlayed} matchs joués` : ""}
              </p>
            </div>
            {league.sourceUrl && (
              <a
                href={league.sourceUrl}
                target="_blank"
                rel="noopener noreferrer nofollow"
                title="Source OddAlerts"
                className="ml-auto shrink-0 text-muted-foreground transition-colors hover:text-foreground"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            )}
          </div>

          {/* Onglets */}
          <LeagueTabNav value={activeTab} onChange={setActiveTab} className="mb-4" />

          {/* ── Tab: Standing ── */}
          {activeTab === "standing" && (
            <section className="space-y-4">
              {/* StatCategoryPills */}
              <StatCategoryPills value={activeCategory} onChange={setActiveCategory} />

              {/* Tableau standings */}
              {fullLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-8 w-full rounded" />
                  {Array.from({ length: 10 }).map((_, i) => (
                    <Skeleton key={i} className="h-7 w-full rounded" />
                  ))}
                </div>
              ) : full?.standings?.length ? (
                <div className="rounded-lg border border-zinc-800 bg-zinc-950/50">
                  <StandingsTable rows={full.standings} />
                </div>
              ) : (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  Pas encore de données de classement pour cette compétition.
                </p>
              )}
            </section>
          )}

          {/* ── Tab: Player Stats ── */}
          {activeTab === "players" && (
            <section className="space-y-4">
              {/* Filtres */}
              <PlayerStatsFilters
                search={playerSearch}
                onSearchChange={setPlayerSearch}
                gameRange={gameRange}
                onGameRangeChange={setGameRange}
                position={position}
                onPositionChange={setPosition}
                scale={scale}
                onScaleChange={setScale}
              />

              {/* Tableau joueurs */}
              {fullLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-8 w-full rounded" />
                  {Array.from({ length: 15 }).map((_, i) => (
                    <Skeleton key={i} className="h-7 w-full rounded" />
                  ))}
                </div>
              ) : filteredPlayers.length ? (
                <div className="rounded-lg border border-zinc-800 bg-zinc-950/50">
                  <PlayerStatsTable
                    columns={[
                      { key: "#", label: "#" },
                      { key: "player_name", label: "Player" },
                      { key: "team", label: "Team" },
                      { key: "position", label: "Pos" },
                      { key: "apps", label: "Apps" },
                      { key: "goals", label: "Goals" },
                      { key: "assists", label: "Assists" },
                      { key: "xG", label: "xG" },
                      { key: "xAG", label: "xAG" },
                      { key: "npxG", label: "npxG" },
                      { key: "shots", label: "Shots" },
                      { key: "key_passes", label: "Key Passes" },
                    ]}
                    rows={filteredPlayers.map((p, i) => ({
                      rank: i + 1,
                      player_name: p.player_name ?? "",
                      team: p.team ?? "",
                      position: p.position ?? undefined,
                      photo: p.photo ?? undefined,
                      apps: p.apps ?? undefined,
                      goals: scale === "per90" ? per90(p.goals, p.time) : p.goals ?? undefined,
                      assists: scale === "per90" ? per90(p.assists, p.time) : p.assists ?? undefined,
                      xG: scale === "per90" ? per90(p.xG, p.time) : p.xG ?? undefined,
                      xAG: scale === "per90" ? per90(p.xAG, p.time) : p.xAG ?? undefined,
                      npxG: scale === "per90" ? per90(p.npxG, p.time) : p.npxG ?? undefined,
                      shots: scale === "per90" ? per90(p.shots, p.time) : p.shots ?? undefined,
                      key_passes: scale === "per90" ? per90(p.key_passes, p.time) : p.key_passes ?? undefined,
                    }))}
                  />
                </div>
              ) : (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  Pas encore de données joueurs pour cette compétition.
                </p>
              )}
            </section>
          )}

          {/* ── Tab: Trends (placeholder) ── */}
          {activeTab === "trends" && (
            <section className="py-10 text-center text-sm text-muted-foreground">
              Tendances — bientôt disponible.
            </section>
          )}

          {/* Matchs à venir */}
          {league.fixtures && league.fixtures.length > 0 && (
            <section className="mt-8">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm font-semibold tracking-tight">
                    <CalendarDays className="h-4 w-4 text-emerald-500" />
                    Prochains matchs
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0 pb-1">
                  <LeagueFixturesList fixtures={league.fixtures} />
                </CardContent>
              </Card>
            </section>
          )}

          {/* Goals Map */}
          <div className="mt-8">
            <GoalsMapScatter />
          </div>

          {/* Sections stats OddAlerts */}
          {league.gamesPlayed === 0 && league.sections.length === 0 ? null : (
            <div className="mt-8 space-y-5">
              {[...league.sections]
                .sort((a, b) => {
                  const order = ["general", "over_under", "halves", "cards", "btts", "corners"];
                  return order.indexOf(a.id) - order.indexOf(b.id);
                })
                .map((section) => (
                  <LeagueStatGrid key={section.id} section={section} />
                ))}
            </div>
          )}

          {/* Footer source */}
          <p className="mt-8 text-center text-[11px] text-muted-foreground">
            Données mises à jour quotidiennement · source{" "}
            <a
              href="https://www.oddalerts.com/leagues"
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="underline underline-offset-2 hover:text-foreground"
            >
              OddAlerts
            </a>
          </p>
        </>
      ) : null}
    </div>
  );
}
