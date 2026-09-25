"use client";

import { memo, useMemo } from "react";
import type { HandballMatch } from "@/lib/handball-data";
import { HandballLeagueBadge } from "@/components/handball/handball-league-badge";
import { HandballTeamLogo } from "@/components/handball/handball-team-logo";
import type { StrategyChip } from "@/hooks/use-handball-top8";

// Couleurs via tokens dark (bg-card/border-border/text-*) — pas de hex en dur

// Fix review G6-9 : memo — props stables (matches mémoïsé côté parent +
// onSelect = setter de state stable) → un clic calendrier ne re-rend plus
// les centaines de lignes, seulement le dialog.
// chipsByMatch est reconstruit en useMemo côté parent → prop stable aussi.
export const HandballCalendar = memo(function HandballCalendar({
  matches,
  chipsByMatch,
  onSelect,
}: {
  matches: HandballMatch[];
  /** Chips « Top stratégies ≥60 % » indexés par String(match.id) (2ᵉ ligne). */
  chipsByMatch?: ReadonlyMap<string, readonly StrategyChip[]>;
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
            {dayMatches.map((m) => {
              const chips = chipsByMatch?.get(String(m.id));
              return (
                // Ligne cliquable accessible : bouton natif (Enter/Espace inclus).
                // 2ᵉ ligne de chips « Top stratégies ≥60 % » (flex-col) : une
                // colonne supplémentaire déborderait sous 360 px (container
                // overflow-hidden) et rognerait les noms d'équipes.
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onSelect?.(m)}
                  aria-label={`Analyse du match ${m.home.name} contre ${m.away.name}${
                    chips?.length ? `, ${chips.length} paris à 60 % ou plus` : ""
                  }`}
                  className="flex min-h-[44px] w-full flex-col gap-1 px-3 py-2 text-left text-sm transition-colors hover:bg-muted cursor-pointer focus-visible:ring-2 ring-[#00e676] outline-none"
                >
                  <span className="flex w-full min-w-0 items-center justify-between">
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
                  </span>

                  {/* Chips stratégies (vert charte #00e676 = signal de confiance) */}
                  {chips && chips.length > 0 && (
                    <span
                      role="list"
                      aria-label="Stratégies à 60 % ou plus"
                      className="flex w-full min-w-0 flex-wrap items-center gap-1"
                    >
                      {chips.map((c) => (
                        <span
                          key={c.key}
                          role="listitem"
                          title={`${c.label}${c.pick ? ` (${c.pick === "home" ? m.home.name : m.away.name})` : ""} — ${c.probPct.toFixed(1)} %${
                            c.ev != null && c.ev > 0 ? ` · EV +${(c.ev * 100).toFixed(1)} %` : ""
                          }`}
                          className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#00e676]/30 bg-[#00e676]/10 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-[#00e676]"
                        >
                          <span aria-hidden="true">{c.emoji}</span>
                          <span className="truncate">
                            {c.label} {c.probPct.toFixed(0)}%
                          </span>
                        </span>
                      ))}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
});
