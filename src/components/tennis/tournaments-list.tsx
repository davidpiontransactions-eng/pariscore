"use client";

import { useEffect, useState } from "react";
import { Trophy, MapPin } from "lucide-react";
import { useTranslations } from "next-intl";
import type { TournamentResult } from "@/lib/tennis-search-types";
import { cn } from "@/lib/utils";

type Props = {
  /** Liste de tournois à afficher. Si vide, fetch automatique via /api/tennis/tournaments. */
  tournaments?: TournamentResult[];
  className?: string;
};

/**
 * TournamentsList — grille des tournois ATP/WTA/ITF.
 *
 * Affiche les tournois sous forme de cards compactes avec :
 *   - Nom + catégorie (Grand Slam / Masters 1000 / ATP 500 / ATP 250)
 *   - Surface (badge couleur)
 *   - Pays + ville (emoji drapeau si code pays dispo)
 *
 * Si `tournaments` n'est pas passé en prop, fetch automatique via
 * `/api/tennis/tournaments` (cache 5 min côté serveur).
 *
 * Card cliquable → navigation future vers /tennis/tournament/[slug]
 * (page TournamentView déjà créée).
 */
export function TournamentsList({ tournaments, className }: Props) {
  const t = useTranslations("tennis");
  const [data, setData] = useState<TournamentResult[] | null>(
    tournaments ?? null,
  );
  const [loading, setLoading] = useState(!tournaments);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (tournaments) return; // prop fournie → pas de fetch
    let cancelled = false;
    setLoading(true);
    fetch("/api/tennis/tournaments")
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const json = (await r.json()) as { tournaments: TournamentResult[] };
        if (!cancelled) {
          setData(json.tournaments ?? []);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tournaments]);

  if (loading) {
    return (
      <div
        className={cn(
          "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4",
          className,
        )}
      >
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="h-28 animate-pulse rounded-lg border border-border/40 bg-muted/30"
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-rose-500/40 bg-rose-500/5 p-4 text-sm text-rose-700 dark:text-rose-300">
        {t("tournamentsLoadError", { error })}
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border/60 bg-muted/20 py-12 text-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
          <Trophy className="h-4 w-4 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium">{t("noTournaments")}</p>
      </div>
    );
  }

  // Groupement par catégorie pour meilleure lisibilité
  const byCategory = new Map<string, TournamentResult[]>();
  for (const t2 of data) {
    const cat = t2.category ?? "Autres";
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat)!.push(t2);
  }

  // Ordre des catégories
  const categoryOrder = [
    "Grand Slam",
    "ATP Finals",
    "ATP Masters 1000",
    "ATP 500",
    "ATP 250",
    "WTA 1000",
    "WTA 500",
    "WTA 250",
    "Challenger",
    "ITF",
    "Autres",
  ];
  const sortedCategories = [...byCategory.keys()].sort(
    (a, b) => categoryOrder.indexOf(a) - categoryOrder.indexOf(b),
  );

  return (
    <div className={cn("space-y-6", className)}>
      {sortedCategories.map((category) => (
        <section key={category}>
          <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <span
              className={cn(
                "inline-block h-2 w-2 rounded-full",
                categoryColor(category),
              )}
              aria-hidden
            />
            {category}
            <span className="text-muted-foreground/60">
              ({byCategory.get(category)!.length})
            </span>
          </h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4">
            {byCategory.get(category)!.map((tournament) => (
              <TournamentCard key={tournament.id} tournament={tournament} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function TournamentCard({ tournament }: { tournament: TournamentResult }) {
  const surfaceColors: Record<string, string> = {
    Terre: "bg-amber-600",
    Dur: "bg-sky-500",
    Gazon: "bg-emerald-500",
    Moquette: "bg-purple-500",
  };
  const surfaceColor = surfaceColors[tournament.surface ?? ""] ?? "bg-slate-500";
  const flag = tournament.country
    ? countryToFlagEmoji(tournament.country)
    : "";

  return (
    <a
      href={`/tennis/tournament/${tournament.slug}`}
      className="group flex flex-col gap-1.5 rounded-lg border border-border/60 bg-card p-3 transition-all hover:-translate-y-0.5 hover:border-border hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      aria-label={`${tournament.name} · ${tournament.category ?? ""} · ${tournament.surface ?? ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <Trophy className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground group-hover:text-foreground" />
        {tournament.surface && (
          <span
            aria-hidden
            className={cn(
              "inline-block h-2 w-2 rounded-full",
              surfaceColor,
            )}
            title={tournament.surface}
          />
        )}
      </div>
      <h4 className="line-clamp-2 text-xs font-semibold leading-tight text-foreground sm:text-sm">
        {tournament.name}
      </h4>
      <p className="flex items-center gap-1 text-[10px] text-muted-foreground sm:text-[11px]">
        {flag && (
          <span aria-hidden className="text-sm">
            {flag}
          </span>
        )}
        <MapPin className="h-3 w-3" aria-hidden />
        <span className="truncate">{tournament.city ?? tournament.country}</span>
      </p>
    </a>
  );
}

/** Couleur dot pour chaque catégorie de tournoi. */
function categoryColor(category: string): string {
  switch (category) {
    case "Grand Slam":
      return "bg-yellow-500";
    case "ATP Finals":
      return "bg-purple-500";
    case "ATP Masters 1000":
    case "WTA 1000":
      return "bg-rose-500";
    case "ATP 500":
    case "WTA 500":
      return "bg-sky-500";
    case "ATP 250":
    case "WTA 250":
      return "bg-emerald-500";
    case "Challenger":
      return "bg-slate-500";
    default:
      return "bg-slate-400";
  }
}

/**
 * Convertit un code pays ISO 2 en emoji drapeau.
 * Basé sur les regional indicator symbols Unicode.
 * "FR" → 🇫🇷, "US" → 🇺🇸, etc.
 */
function countryToFlagEmoji(countryCode: string): string {
  if (!countryCode || countryCode.length !== 2) return "";
  const codePoints = countryCode
    .toUpperCase()
    .split("")
    .map((c) => 0x1f1e6 + (c.charCodeAt(0) - 65));
  return String.fromCodePoint(...codePoints);
}
