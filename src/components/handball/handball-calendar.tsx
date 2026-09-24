"use client";

import { memo, useMemo } from "react";
import type { HandballMatch } from "@/lib/handball-data";
import { HandballLeagueBadge } from "@/components/handball/handball-league-badge";
import { HandballTeamLogo } from "@/components/handball/handball-team-logo";

// Couleurs via tokens dark (bg-card/border-border/text-*) — pas de hex en dur

// Fix review G6-9 : memo — props stables (matches mémoïsé côté parent +
// onSelect = setter de state stable) → un clic calendrier ne re-rend plus
// les centaines de lignes, seulement le dialog.
export const HandballCalendar = memo(function HandballCalendar({
  matches,
  onSelect,
}: {
  matches: HandballMatch[];
  /** Ouvre la popup d'analyse au clic — même state detailMatch que les cartes. */
  onSelect?: (match: HandballMatch) => void;
}) {
  const byDate = useMemo(() => {
    const map = new Map<string, HandballMatch[]>();
    for (const m of matches) {
      const d = new Date(m.kickoff);
      const date = d.toLocaleDateString("fr-FR", {
        weekday: "long",
        day: "numeric",
        month: "long",
        timeZone: "Europe/Paris",
      });
      if (!map.has(date)) map.set(date, []);
      map.get(date)!.push(m);
    }
    return [...map.entries()];
  }, [matches]);

  if (byDate.length === 0)
    return (
      // État vide annoncé aux lecteurs d'écran
      <div className="text-center py-8 text-muted-foreground" aria-live="polite">
        Aucun match programmé
      </div>
    );

  return (
    <div className="space-y-4">
      {byDate.map(([date, dayMatches]) => (
        <div key={date}>
          <h3 className="text-sm font-semibold mb-2 capitalize px-3 py-1.5 rounded-t bg-muted text-foreground">
            {date}
          </h3>
          <div className="rounded-b border border-border bg-card overflow-hidden divide-y divide-border">
            {dayMatches.map((m) => (
              // Ligne cliquable accessible : bouton natif (Enter/Espace inclus)
              <button
                key={m.id}
                type="button"
                onClick={() => onSelect?.(m)}
                aria-label={`Analyse du match ${m.home.name} contre ${m.away.name}`}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors hover:bg-muted cursor-pointer focus-visible:ring-2 ring-[#00e676] outline-none"
              >
                <span className="text-xs w-16 tabular-nums text-muted-foreground">
                  {new Date(m.kickoff).toLocaleTimeString("fr-FR", {
                    hour: "2-digit",
                    minute: "2-digit",
                    timeZone: "Europe/Paris",
                  })}
                </span>
                <span className="flex-1 text-right font-medium truncate text-foreground inline-flex items-center justify-end gap-1.5">
                  <HandballTeamLogo name={m.home.name} size={18} />
                  <span className="truncate">{m.home.name}</span>
                </span>
                <span className="mx-2 text-xs text-muted-foreground">
                  vs
                </span>
                <span className="flex-1 font-medium truncate text-foreground inline-flex items-center gap-1.5">
                  <HandballTeamLogo name={m.away.name} size={18} />
                  <span className="truncate">{m.away.name}</span>
                </span>
                <span className="text-xs w-32 text-right truncate text-muted-foreground inline-flex justify-end">
                  <HandballLeagueBadge
                    leagueName={m.league.name}
                    country={m.league.country}
                    className="max-w-full"
                  />
                </span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
});
