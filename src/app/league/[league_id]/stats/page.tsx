"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import useSWR from "swr";
import type { LeagueStatsResponse, LocationFilter } from "@/lib/league-stats";
import { LeagueLocationTabs } from "@/components/leagues/league-location-tabs";
import { LeagueStatsTable } from "@/components/leagues/league-stats-table";
import { LeagueMarketTops } from "@/components/leagues/league-market-tops";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, ArrowLeft, Trophy } from "lucide-react";
import Link from "next/link";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function LeagueStatsPage() {
  const { league_id } = useParams<{ league_id: string }>();
  const [location, setLocation] = useState<LocationFilter>("all");

  const { data, error, isLoading } = useSWR<LeagueStatsResponse>(
    `/api/v1/leagues/${league_id}/stats?location=${location}`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 300_000 },
  );

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">
      {/* Header */}
      <div className="mb-6 flex items-center gap-4">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour
        </Link>
        <div>
          <h1 className="text-xl font-bold tracking-tight">
            {data?.league.name ?? "Chargement..."}
          </h1>
          <p className="text-xs text-muted-foreground">
            {data?.league.country} · Saison {data?.league.season}
          </p>
        </div>
      </div>

      {/* Location tabs */}
      <div className="mb-6">
        <LeagueLocationTabs value={location} onChange={setLocation} />
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-6">
          <Skeleton className="h-64 w-full rounded-lg" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-40 rounded-lg" />
            ))}
          </div>
        </div>
      ) : error ? (
        <div className="flex items-start gap-3 rounded-lg border border-rose-500/40 bg-rose-500/5 p-4 text-sm text-rose-700 dark:text-rose-300">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">Erreur de chargement</p>
            <p className="mt-0.5 text-xs">
              Les statistiques de cette ligue sont temporairement indisponibles.
            </p>
          </div>
        </div>
      ) : data ? (
        <div className="space-y-8">
          {/* Standings table */}
          <section>
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
              <Trophy className="h-5 w-5 text-amber-500" />
              Classement {location === "home" ? "— À domicile" : location === "away" ? "— En déplacement" : ""}
            </h2>
            <LeagueStatsTable standings={data.standings} />
          </section>

          {/* Market tops */}
          <section>
            <h2 className="mb-3 text-lg font-semibold">Tops Équipes par Marché</h2>
            <LeagueMarketTops tops={data.marketTops} />
          </section>

          {/* Meta */}
          <p className="text-right text-[11px] text-muted-foreground">
            Source: {data.meta.source.toUpperCase()} · Mis à jour:{" "}
            {new Date(data.meta.computedAt).toLocaleTimeString("fr-FR")}
          </p>
        </div>
      ) : null}
    </div>
  );
}
