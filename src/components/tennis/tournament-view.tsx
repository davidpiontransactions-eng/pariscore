"use client";

import { Trophy, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";

type Props = { slug: string };

/**
 * TournamentView — client component for /tennis/tournament/[slug].
 *
 * Phase 8 placeholder. Will fetch from /api/tennis/tournament/[slug] once the
 * API is implemented and render:
 *   - Header (logo + name + country + surface + dates)
 *   - Bracket (if single-elimination)
 *   - Matches table (live + upcoming + results)
 *   - Players list (top seeds + French players)
 */
export function TournamentView({ slug }: Props) {
  const t = useTranslations("common");
  const displayName = slug
    .split("-")
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
          Tournoi · ATP/WTA/Challenger/ITF
        </p>
      </header>

      <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border/60 bg-muted/20 px-6 py-12 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <Trophy className="h-5 w-5 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium">Tournoi en cours de construction</p>
        <p className="max-w-md text-xs text-muted-foreground">
          Le tableau, la liste des matchs et les joueurs seront disponibles
          une fois l&apos;API <code className="font-mono">/api/tennis/tournament/{slug}</code> connectée.
        </p>
      </div>
    </main>
  );
}
