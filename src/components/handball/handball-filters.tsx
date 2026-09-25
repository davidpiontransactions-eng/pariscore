"use client";

import { useMemo, useState } from "react";
import type { HandballMatch } from "@/lib/handball-data";
import { sortHandballLeagueEntries } from "@/lib/handball-leagues";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";

/** Normalisation d'une recherche (casse, diacritiques, ponctuation). */
function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Filtre championnats de l'onglet handball.
 *
 * Avant : une rangée de ~70 pills en `overflow-x-auto` — sur mobile le
 * défilement horizontal noyait la sélection et débordait sous le calendrier.
 * Maintenant : UN déclencheur (ligue courante + compteur) → popover avec
 * recherche + liste verticale À ASCENSEUR (`max-h-[55vh] overflow-y-auto`).
 * Le tri (ligues majeures puis volume) et le contrat de props restent
 * identiques — le parent (`handball-tab-content`) n'est pas modifié.
 */
export function HandballFilters({
  matches,
  selected,
  onSelect,
}: {
  matches: HandballMatch[];
  selected: string | null;
  onSelect: (l: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const leagues = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of matches)
      map.set(m.league.name, (map.get(m.league.name) || 0) + 1);
    // Tri 1xbet : ligues majeures en tête (tier), puis volume
    return sortHandballLeagueEntries(
      [...map.entries()].map(([name, count]) => ({ name, count })),
    );
  }, [matches]);

  const filtered = useMemo(() => {
    const q = norm(query.trim());
    if (!q) return leagues;
    return leagues.filter((l) => norm(l.name).includes(q));
  }, [leagues, query]);

  if (leagues.length <= 1) return null;

  /** Sélection + fermeture (le query est réinitialisé au prochain ouvert). */
  const pick = (name: string | null) => {
    onSelect(name);
    setOpen(false);
    setQuery("");
  };

  const currentCount = selected
    ? leagues.find((l) => l.name === selected)?.count ?? 0
    : matches.length;

  const rowCls = (active: boolean) =>
    `flex w-full items-center justify-between gap-2 px-2.5 py-2 text-left text-xs transition-colors min-h-[40px] ${
      active
        ? "bg-foreground font-semibold text-background"
        : "hover:bg-muted focus-visible:bg-muted"
    } outline-none focus-visible:ring-2 focus-visible:ring-[#00e676]`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-pressed={!!selected}
          aria-label={
            selected ? `Championnat sélectionné : ${selected}` : "Filtrer par championnat"
          }
          className="inline-flex max-w-full min-h-[44px] items-center gap-2 rounded-full border px-3 py-1 text-xs transition-colors hover:bg-muted aria-pressed:bg-foreground aria-pressed:text-background"
        >
          <span aria-hidden="true">🏆</span>
          <span className="truncate">{selected ?? "Tous les championnats"}</span>
          <span className="tabular-nums">({currentCount})</span>
          <span aria-hidden="true" className="text-[10px] opacity-70">
            ▾
          </span>
        </button>
      </PopoverTrigger>

      <PopoverContent align="start" sideOffset={8} className="w-[min(92vw,22rem)] p-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher un championnat…"
          aria-label="Rechercher un championnat"
          className="h-9 text-xs"
          autoFocus
        />

        {/* Liste verticale à ascenseur : ~55 vh max, défilement overscroll doux */}
        <div
          role="listbox"
          aria-label="Championnats"
          className="mt-2 max-h-[55vh] overflow-y-auto overscroll-contain divide-y divide-border rounded-md border border-border"
        >
          <button
            type="button"
            role="option"
            onClick={() => pick(null)}
            aria-selected={!selected}
            className={rowCls(!selected)}
          >
            <span className="truncate">🌍 Tous</span>
            <span className="shrink-0 tabular-nums text-muted-foreground">{matches.length}</span>
          </button>

          {filtered.map(({ name, count }) => (
            <button
              key={name}
              type="button"
              role="option"
              onClick={() => pick(name)}
              aria-selected={selected === name}
              className={rowCls(selected === name)}
            >
              <span className="truncate">{name}</span>
              <span
                className={`shrink-0 tabular-nums ${selected === name ? "opacity-80" : "text-muted-foreground"}`}
              >
                {count}
              </span>
            </button>
          ))}

          {filtered.length === 0 && (
            <p className="px-2.5 py-3 text-center text-[11px] text-muted-foreground">
              Aucun championnat ne matche « {query} »
            </p>
          )}
        </div>

        <p className="mt-1.5 flex items-center justify-between text-[10px] text-muted-foreground">
          <span>
            {filtered.length} championnat{filtered.length > 1 ? "s" : ""}
          </span>
          {selected && (
            <button
              type="button"
              onClick={() => pick(null)}
              className="font-semibold underline underline-offset-2 hover:text-foreground"
            >
              Réinitialiser
            </button>
          )}
        </p>
      </PopoverContent>
    </Popover>
  );
}
