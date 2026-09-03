"use client";

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
import { LeagueStatGrid } from "@/components/leagues/league-stat-grid";
import { LeagueFixturesList } from "@/components/leagues/league-fixtures-list";
import type { LeagueDetail } from "@/lib/leagues-stats/types";

const fetcher = async (url: string) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
};

export default function LeagueDetailPage() {
  const { country, slug } = useParams<{ country: string; slug: string }>();

  const { data, error, isLoading } = useSWR<{ league: LeagueDetail }>(
    country && slug ? `/api/v1/leagues-stats/${country}/${slug}` : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 600_000 }
  );

  const league = data?.league;

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
      {isLoading ? (
        <Skeleton className="mb-6 h-20 rounded-lg" />
      ) : error ? (
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

          {/* Matchs à venir */}
          <section className="mb-8">
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

          {/* Sections stats */}
          {league.gamesPlayed === 0 && league.sections.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Pas encore de données statistiques pour cette compétition.
            </p>
          ) : (
            <div className="space-y-5">
              {[...league.sections]
                .sort((a, b) => {
                  const order = [
                    "general",
                    "over_under",
                    "halves",
                    "cards",
                    "btts",
                    "corners",
                  ];
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
