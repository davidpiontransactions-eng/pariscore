"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, TrendingUp } from "lucide-react";
import type { PlayerResult } from "@/lib/tennis-search-types";
import type { TennisMatch } from "@/lib/tennis-data";
import { usePlayerStats } from "@/hooks/use-player-stats";
import { useBrowserTimeZone } from "@/lib/tennis-format";
import { cn } from "@/lib/utils";
import { L10SurfaceBadge } from "./l10-surface-badge";

type Props = {
  player: PlayerResult | null;
  matches: TennisMatch[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const SURFACES = [
  { key: "Dur", label: "Dur" },
  { key: "Terre battue", label: "Terre battue" },
  { key: "Gazon", label: "Gazon" },
] as const;

function fmtNumber(v: number | null | undefined, suffix = ""): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${v}${suffix}`;
}

/**
 * PlayerProfileDialog — carte d'identité d'un joueur ATP/WTA.
 *
 * Ouvert depuis la barre de recherche (clic sur un résultat), il remplace la
 * navigation legacy vers des pages placeholder. Affiche :
 *   - rang ATP/WTA + circuit + drapeau
 *   - Elo standard + Elo par surface (Dur / Terre battue / Gazon) via
 *     /api/tennis/player-stats
 *   - prochains matchs du joueur filtrés depuis la liste de l'onglet
 */
export function PlayerProfileDialog({ player, matches, open, onOpenChange }: Props) {
  const playerName = player?.name ?? "";
  const browserTimeZone = useBrowserTimeZone();

  // 3 appels SWR (un par surface) : l'API prend UNE surface par requête.
  // Clés distinctes → 3 fetchs parallèles, dégradation gracieuse côté API.
  const dur = usePlayerStats(playerName, "Dur");
  const clay = usePlayerStats(playerName, "Terre battue");
  const grass = usePlayerStats(playerName, "Gazon");

  // Matchs du joueur (l'un des deux participants) dans la liste de l'onglet.
  const playerMatches = matches
    .filter(
      (m) =>
        m.playerA.name.toLowerCase() === playerName.toLowerCase() ||
        m.playerB.name.toLowerCase() === playerName.toLowerCase(),
    )
    .sort(
      (a, b) =>
        new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
    )
    .slice(0, 5);

  const surfaces = [
    {
      label: "Dur",
      elo: dur.data?.[normalizeName(playerName)]?.eloSurface ?? null,
      rank: dur.data?.[normalizeName(playerName)]?.surfaceEloRank ?? null,
      l10: dur.data?.[normalizeName(playerName)]?.l10Surface ?? null,
    },
    {
      label: "Terre",
      elo: clay.data?.[normalizeName(playerName)]?.eloSurface ?? null,
      rank: clay.data?.[normalizeName(playerName)]?.surfaceEloRank ?? null,
      l10: clay.data?.[normalizeName(playerName)]?.l10Surface ?? null,
    },
    {
      label: "Gazon",
      elo: grass.data?.[normalizeName(playerName)]?.eloSurface ?? null,
      rank: grass.data?.[normalizeName(playerName)]?.surfaceEloRank ?? null,
      l10: grass.data?.[normalizeName(playerName)]?.l10Surface ?? null,
    },
  ];

  const base = dur.data?.[normalizeName(playerName)];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[95vw] max-w-[min(90vw,42rem)] overflow-hidden p-0">
        <ScrollArea className="max-h-[90vh]">
          <div className="space-y-5 p-5">
            <DialogHeader>
              <DialogTitle className="sr-only">
                Profil de {playerName}
              </DialogTitle>
            </DialogHeader>

            {/* Header joueur */}
            <div className="flex items-center gap-4">
              {player?.photoUrl ? (
                <img
                  src={player.photoUrl}
                  alt=""
                  className="h-16 w-16 rounded-full object-cover ring-2 ring-border"
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted text-lg font-bold text-muted-foreground">
                  {playerName.charAt(0)}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-xl font-bold tracking-tight">
                  {playerName}
                </h2>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {player?.circuit && (
                    <Badge
                      className={cn(
                        player.circuit === "WTA"
                          ? "bg-rose-500/10 text-rose-600 dark:text-rose-300"
                          : "bg-sky-500/10 text-sky-600 dark:text-sky-300",
                      )}
                    >
                      {player.circuit}
                    </Badge>
                  )}
                  {player?.rank != null && <span>Rang #{player.rank}</span>}
                  {base?.atpRank != null && (
                    <span>ATP #{base.atpRank}</span>
                  )}
                  {base?.wtaRank != null && (
                    <span>WTA #{base.wtaRank}</span>
                  )}
                  {player?.country && <span>{player.country}</span>}
                </div>
              </div>
            </div>

            {/* Elo par surface */}
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <TrendingUp className="h-3.5 w-3.5" aria-hidden />
                Elo par surface
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {surfaces.map((s) => (
                  <div
                    key={s.label}
                    className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5"
                  >
                    <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                      {s.label}
                    </div>
                    <div className="mt-0.5 text-lg font-bold tabular-nums">
                      {fmtNumber(s.elo)}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      Rang {fmtNumber(s.rank, "")}
                    </div>
                    {s.l10 != null && s.l10.matches > 0 && (
                      <div className="mt-1.5">
                        <L10SurfaceBadge stats={s.l10} surface={s.label} compact />
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {base?.elo != null && (
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Elo général : <span className="font-semibold text-foreground">{fmtNumber(base.elo)}</span>
                </p>
              )}
            </div>

            {/* Prochains matchs du joueur */}
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <Calendar className="h-3.5 w-3.5" aria-hidden />
                Matchs
              </p>
              {playerMatches.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border/60 bg-muted/20 px-3 py-4 text-center text-xs text-muted-foreground">
                  Aucun match programmé pour ce joueur.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {playerMatches.map((m) => {
                    const isA = m.playerA.name.toLowerCase() === playerName.toLowerCase();
                    const opp = isA ? m.playerB.name : m.playerA.name;
                    return (
                      <li
                        key={m.id}
                        className="flex items-center justify-between gap-2 rounded-lg border border-border/50 bg-muted/15 px-3 py-2"
                      >
                        <span className="min-w-0 truncate text-xs font-medium">
                          vs <span className="font-semibold">{opp}</span>
                        </span>
                        <span className="flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
                          <Clock className="h-3 w-3" aria-hidden />
                          {formatTime(m.scheduledAt, browserTimeZone)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

/** Normalise le nom pour lookup (identique à l'API player-stats). */
function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function formatTime(iso: string, timeZone: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(d);
}