"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Search, Trophy, User, Loader2 } from "lucide-react";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useTennisSearch } from "@/hooks/use-tennis-search";
import type {
  PlayerResult,
  TournamentResult,
} from "@/lib/tennis-search-types";

type Props = {
  className?: string;
};

/**
 * TennisSearchBar — recherche autocomplete unifiée joueurs + tournois.
 *
 * Pattern combobox shadcn (Popover + Command) :
 *   - Le filtrage est délégué au serveur via `shouldFilter={false}` sur
 *     <Command> (cmdk re-filtrerait les résultats serveur côté client sinon).
 *   - Le hook `useTennisSearch` debounce la saisie (300 ms) et ne fetch que
 *     si la query fait ≥ 2 caractères.
 *   - Au clic sur un résultat → navigation vers /tennis/player/[slug] ou
 *     /tennis/tournament/[slug] (pages destinations existantes).
 *
 * Source des données : fallback hardcodé (93 ATP/WTA + 62 tournois) côté
 * API /api/tennis/search (cache 60 s). Voir docs/P8-TASK-BRIEF.md.
 */
export function TennisSearchBar({ className }: Props) {
  const t = useTranslations("tennis");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const { data, isValidating } = useTennisSearch(query, "all");

  const players = data?.players ?? [];
  const tournaments = data?.tournaments ?? [];
  const hasResults = players.length > 0 || tournaments.length > 0;
  // On n'affiche le state "no results" que si une recherche a été lancée
  // (query ≥ 2) et qu'elle n'est plus en cours.
  const showEmpty =
    query.trim().length >= 2 && !isValidating && !hasResults;

  /** Navigue vers la page joueur/tournoi puis ferme le combo. */
  const go = (href: string) => {
    setOpen(false);
    setQuery("");
    router.push(href);
  };

  return (
    <div className={cn("relative", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={t("searchPlaceholder")}
            className={cn(
              "flex h-10 w-full items-center gap-2 rounded-md border border-border/60 bg-background px-3 text-sm",
              "text-muted-foreground transition-colors",
              "hover:border-border hover:bg-muted/30",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              "dark:bg-card",
            )}
          >
            <Search className="h-4 w-4 shrink-0" aria-hidden />
            <span className="flex-1 truncate text-left">
              {query || t("searchPlaceholder")}
            </span>
            {isValidating && (
              <Loader2
                className="h-4 w-4 shrink-0 animate-spin"
                aria-hidden
              />
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-[--radix-popover-trigger-width] p-0"
        >
          <Command shouldFilter={false} className="rounded-md">
            <CommandInput
              value={query}
              onValueChange={setQuery}
              placeholder={t("searchPlaceholder")}
              autoFocus
            />
            <CommandList>
              {showEmpty ? (
                <CommandEmpty>{t("searchNoResults")}</CommandEmpty>
              ) : null}

              {players.length > 0 && (
                <CommandGroup heading={t("searchPlayersTitle")}>
                  {players.map((p) => (
                    <PlayerItem
                      key={p.id}
                      player={p}
                      onSelect={() => go(`/tennis/player/${p.slug}`)}
                    />
                  ))}
                </CommandGroup>
              )}

              {players.length > 0 && tournaments.length > 0 && (
                <CommandSeparator />
              )}

              {tournaments.length > 0 && (
                <CommandGroup heading={t("searchTournamentsTitle")}>
                  {tournaments.map((tour) => (
                    <TournamentItem
                      key={tour.id}
                      tournament={tour}
                      onSelect={() => go(`/tennis/tournament/${tour.slug}`)}
                    />
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

/** Ligne de résultat joueur : icône + nom + rang + drapeau. */
function PlayerItem({
  player,
  onSelect,
}: {
  player: PlayerResult;
  onSelect: () => void;
}) {
  const flag = player.country ? countryToFlagEmoji(player.country) : "";
  return (
    <CommandItem
      value={`player-${player.id}`}
      onSelect={onSelect}
      className="gap-2"
    >
      {player.photoUrl ? (
        <img
          src={player.photoUrl}
          alt=""
          className="h-6 w-6 shrink-0 rounded-full object-cover"
        />
      ) : (
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted">
          <User className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
        </span>
      )}
      <span className="flex-1 truncate font-medium">{player.name}</span>
      {player.circuit && (
        <span
          className={cn(
            "rounded px-1.5 py-0.5 text-[10px] font-semibold",
            player.circuit === "WTA"
              ? "bg-rose-500/10 text-rose-600 dark:text-rose-300"
              : "bg-sky-500/10 text-sky-600 dark:text-sky-300",
          )}
        >
          {player.circuit}
        </span>
      )}
      {player.rank != null && (
        <span className="text-[11px] tabular-nums text-muted-foreground">
          #{player.rank}
        </span>
      )}
      {flag && (
        <span aria-hidden className="text-sm">
          {flag}
        </span>
      )}
    </CommandItem>
  );
}

/** Ligne de résultat tournoi : icône Trophy + nom + catégorie + drapeau. */
function TournamentItem({
  tournament,
  onSelect,
}: {
  tournament: TournamentResult;
  onSelect: () => void;
}) {
  const flag = tournament.country
    ? countryToFlagEmoji(tournament.country)
    : "";
  const surfaceColors: Record<string, string> = {
    Terre: "bg-amber-600",
    Dur: "bg-sky-500",
    Gazon: "bg-emerald-500",
    Moquette: "bg-purple-500",
  };
  const surfaceColor =
    surfaceColors[tournament.surface ?? ""] ?? "bg-slate-500";

  return (
    <CommandItem
      value={`tournament-${tournament.id}`}
      onSelect={onSelect}
      className="gap-2"
    >
      <Trophy className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      <span className="flex-1 truncate font-medium">{tournament.name}</span>
      {tournament.surface && (
        <span
          aria-hidden
          className={cn("inline-block h-2 w-2 rounded-full", surfaceColor)}
          title={tournament.surface}
        />
      )}
      {tournament.category && (
        <span className="hidden text-[10px] text-muted-foreground sm:inline">
          {tournament.category}
        </span>
      )}
      {flag && (
        <span aria-hidden className="text-sm">
          {flag}
        </span>
      )}
    </CommandItem>
  );
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
