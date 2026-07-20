"use client";

import { Trophy, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";

type Props = { slug: string };

/**
 * PlayerProfileView — client component for /tennis/player/[slug].
 *
 * Phase 8 placeholder. Will fetch from /api/tennis/player/[slug] once the
 * API is implemented and render:
 *   - Header (photo + name + flag + rank + preferred surface)
 *   - Stats card (Elo surface, SPS, form dots, W/L last 10)
 *   - <LastMatchesList> (10 last matches)
 *   - <StatsRadarChart> (vs top-10 average)
 *   - Upcoming matches
 */
export function PlayerProfileView({ slug }: Props) {
  const t = useTranslations("common");
  const displayName = slug
    .split("_")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <Link
        href="/?tab=tennis"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("backToTennis") ?? "Retour au tennis"}
      </Link>

      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {displayName}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Profil joueur · ATP/WTA
        </p>
      </header>

      <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border/60 bg-muted/20 px-6 py-12 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <Trophy className="h-5 w-5 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium">Profil en cours de construction</p>
        <p className="max-w-md text-xs text-muted-foreground">
          Les données détaillées (stats, forme, historique) seront disponibles
          une fois l&apos;API <code className="font-mono">/api/tennis/player/{slug}</code> connectée.
        </p>
      </div>
    </main>
  );
}
