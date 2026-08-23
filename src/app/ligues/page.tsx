"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, Search, Trophy } from "lucide-react";
import type { CountryGroup, LeagueIndexEntry } from "@/lib/leagues-stats/types";

type IndexResponse = {
  total: number;
  countries: CountryGroup[];
  leagues: LeagueIndexEntry[];
};

const fetcher = async (url: string) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
};

function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export default function LeaguesIndexPage() {
  const [query, setQuery] = useState("");
  const [country, setCountry] = useState<string>("all");

  const { data, error, isLoading } = useSWR<IndexResponse>(
    "/api/v1/leagues-stats",
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 600_000 }
  );

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = normalize(query.trim());
    return data.leagues.filter((l) => {
      if (country !== "all" && l.country !== country) return false;
      if (!q) return true;
      return normalize(l.name).includes(q) || normalize(l.country).includes(q);
    });
  }, [data, query, country]);

  const grouped = useMemo(() => {
    const map = new Map<string, LeagueIndexEntry[]>();
    for (const l of filtered) {
      const arr = map.get(l.country) ?? [];
      arr.push(l);
      map.set(l.country, arr);
    }
    return [...map.entries()];
  }, [filtered]);

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight">
          <Trophy className="h-5 w-5 text-emerald-500" />
          Championnats
        </h1>
        <p className="mt-1 text-xs text-muted-foreground">
          {data
            ? `${data.total} compétitions · stats buts, cartons, corners, BTTS et cotes`
            : "Chargement..."}
        </p>
      </div>

      {/* Filtres */}
      <div className="mb-6 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher une ligue ou un pays..."
            className="pl-8"
          />
        </div>
        <Select value={country} onValueChange={setCountry}>
          <SelectTrigger className="w-full sm:w-56">
            <SelectValue placeholder="Pays" />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            <SelectItem value="all">Tous les pays</SelectItem>
            {(data?.countries ?? []).map((c) => (
              <SelectItem key={c.country} value={c.country}>
                {c.country} ({c.count})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Contenu */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))}
        </div>
      ) : error ? (
        <div className="flex items-start gap-3 rounded-lg border border-rose-500/40 bg-rose-500/5 p-4 text-sm text-rose-700 dark:text-rose-300">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">Erreur de chargement</p>
            <p className="mt-0.5 text-xs">
              La liste des championnats est temporairement indisponible.
            </p>
          </div>
        </div>
      ) : grouped.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          Aucune ligue ne correspond à votre recherche.
        </p>
      ) : (
        <div className="space-y-8">
          {grouped.map(([countryCode, leagues]) => (
            <section key={countryCode}>
              <h2 className="mb-3 text-sm font-semibold capitalize text-muted-foreground">
                {countryCode.replace(/-/g, " ")}{" "}
                <span className="font-normal">({leagues.length})</span>
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {leagues.map((league) => (
                  <Link
                    key={league.id}
                    href={`/ligues/${league.country}/${league.slug}`}
                    className="group flex items-center gap-3 rounded-lg border bg-card p-3 transition-colors hover:border-emerald-500/50 hover:bg-accent/40"
                  >
                    {league.logoUrl ? (
                       
                      <img
                        src={league.logoUrl}
                        alt=""
                        loading="lazy"
                        className="h-8 w-8 shrink-0 object-contain"
                      />
                    ) : (
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                        <Trophy className="h-4 w-4 text-muted-foreground" />
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                        {league.name}
                      </p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {league.seasonLabel ?? "—"}
                        {league.gamesPlayed > 0 ? ` · ${league.gamesPlayed} matchs` : ""}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
