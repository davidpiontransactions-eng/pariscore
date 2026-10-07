"use client";

import { memo, useEffect, useMemo, useState } from "react";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { HandballMatch } from "@/lib/handball-data";
import { leagueCountry } from "@/lib/handball-logos";
// Drapeau SVG local (public/flags/<iso>.svg). Le composant tennis/emoji rendait
// « GERMANY » → 🌍 (il exige un code ISO à 2 lettres) au lieu de de.svg.
import { CountryFlag } from "@/components/ui/country-flag";
import { HandballTeamLogo } from "@/components/handball/handball-team-logo";
import type { StrategyChip } from "@/hooks/use-handball-top8";

// Chart FotMob claire (miroir football) : #fff / #f0f0f0 / #222 / #717171 —
// mêmes valeurs que l'onglet football, aucun token dark restant.

// ─── Sélecteur de jour façon Flashscore (dayPicker) ─────────────────────────
// Jour civil Europe/Paris : clé de regroupement + libellés d'affichage.
const ISO_FMT = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Paris",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const SHORT_FMT = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Europe/Paris",
  day: "2-digit",
  month: "2-digit",
});
const WEEKDAY_FMT = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", weekday: "short" });
const FULL_FMT = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Europe/Paris",
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

/** Jeton d'une journée du calendrier (clé ISO + libellés). */
type CalDay = {
  iso: string;
  /** En-tête long : « jeudi 24 septembre » (sans année, historique du composant). */
  label: string;
  /** Bouton sélecteur : « 27/09 Di » (2 lettres, miroir Flashscore). */
  short: string;
  /** aria-label complet : « jeudi 24 septembre 2026 ». */
  full: string;
  leagues: { name: string; country: string | null; matches: HandballMatch[] }[];
};

// Teintes Flashscore du sélecteur (neutre #eee / #555e61, survol #c8cdcd/#001e28)
const ARROW_CLS =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#555e61] transition-colors hover:bg-[#c8cdcd] hover:text-[#001e28] disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00e676]";
const DATE_CLS =
  "flex h-8 min-h-[32px] items-center gap-1.5 rounded-lg bg-[#eeeeee] px-3 text-xs font-bold tracking-[0.4px] text-[#555e61] transition-colors hover:bg-[#c8cdcd] hover:text-[#001e28] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00e676]";
const ROW_CLS =
  "flex w-full min-h-[36px] items-center justify-between gap-2 rounded px-2.5 py-1.5 text-left text-xs text-[#555e61] transition-colors hover:bg-[#f5f5f5] hover:text-[#222222]";

// Fix review G6-9 : memo — props stables (matches mémoïsé côté parent +
// onSelect = setter de state stable) → un clic calendrier ne re-rend plus
// les centaines de lignes, seulement le dialog.
// chipsByMatch est reconstruit en useMemo côté parent → prop stable aussi.
export const HandballCalendar = memo(function HandballCalendar({
  matches,
  chipsByMatch,
  onSelect,
  onActiveDayChange,
}: {
  matches: HandballMatch[];
  /** Chips « Top stratégies ≥60 % » indexés par String(match.id) (2ᵉ ligne). */
  chipsByMatch?: ReadonlyMap<string, readonly StrategyChip[]>;
  /** Ouvre la popup d'analyse au clic — même state detailMatch que les cartes. */
  onSelect?: (match: HandballMatch) => void;
  /**
   * Remonte la journée EFFECTIVEMENT affichée (jour civil Europe/Paris, ou
   * null = toutes les journées). Le parent s'en sert pour compter les ligues et
   * les matchs sur la date active au lieu de toute la fenêtre : sans ça le
   * compteur du popoverriestait sur les 579 matchs à venir toutes dates.
   */
  onActiveDayChange?: (iso: string | null) => void;
}) {
  const days = useMemo<CalDay[]>(() => {
    const map = new Map<string, HandballMatch[]>();
    for (const m of matches) {
      // Clé = jour civil Europe/Paris (indépendant du fuseau du navigateur)
      const iso = ISO_FMT.format(new Date(m.kickoff));
      const bucket = map.get(iso);
      if (bucket) bucket.push(m);
      else map.set(iso, [m]);
    }
    // Tri par HORAIRE croissant dans chaque journée (demande user crut) +
    // jours ordonnées chronologiquement (indépendant de l'ordre du payload).
    for (const day of map.values()) {
      day.sort((a, b) => Date.parse(a.kickoff) - Date.parse(b.kickoff));
    }
    // Groupement par championnat (demande 2 : ligues en évidence comme l'onglet
    // football) — ordre des groupes = premier coup d'envoi du jour, matchs déjà
    // triés par heure au sein de chaque groupe.
    return [...map.entries()]
      .sort(
        (a, b) => Date.parse(a[1][0]?.kickoff ?? "") - Date.parse(b[1][0]?.kickoff ?? ""),
      )
      .map(([iso, dayMatches]) => {
        const lmap = new Map<string, HandballMatch[]>();
        for (const m of dayMatches) {
          const k = m.league.name;
          if (!lmap.has(k)) lmap.set(k, []);
          lmap.get(k)!.push(m);
        }
        const leagues = [...lmap.entries()].map(([name, ms]) => ({
          name,
          country: ms[0]?.league.country ?? null,
          matches: ms,
        }));
        const first = new Date(dayMatches[0].kickoff);
        const wd = WEEKDAY_FMT.format(first).replace(/\./g, "").slice(0, 2);
        return {
          iso,
          label: new Intl.DateTimeFormat("fr-FR", {
            timeZone: "Europe/Paris",
            weekday: "long",
            day: "numeric",
            month: "long",
          }).format(first),
          // « 27/09 Di » : 2 lettres de jour court fr, 1re majuscule (Flashscore)
          short: `${SHORT_FMT.format(first)} ${wd.charAt(0).toUpperCase()}${wd.slice(1)}`,
          full: FULL_FMT.format(first),
          leagues,
        };
      });
  }, [matches]);

  // ─── Sélection du jour (filtre) ───────────────────────────────────────────
  // undefined = non initialisée → 1re journée disponible ; null = toutes les
  // journées ; sinon le jour ISO choisi. Repli automatique si la journée n'existe
  // plus dans les données (filtre ligue/moment qui l'a vidée).
  const [selectedIso, setSelectedIso] = useState<string | null | undefined>(undefined);
  const [pickerOpen, setPickerOpen] = useState(false);
  const activeIso =
    selectedIso === undefined || (selectedIso != null && !days.some((d) => d.iso === selectedIso))
      ? (days[0]?.iso ?? null)
      : selectedIso;
  const activeIdx = activeIso == null ? -1 : days.findIndex((d) => d.iso === activeIso);
  const activeDay = activeIdx >= 0 ? days[activeIdx] : null;
  const visibleDays = activeIso == null ? days : days.filter((d) => d.iso === activeIso);
  const goTo = (delta: number) => {
    const next = days[activeIdx + delta];
    if (next) setSelectedIso(next.iso);
  };

  // Jour affiché publié vers le parent (compteurs du popover ligues). `activeIso`
  // est déjà le jour RÉELLEMENT rendu (repli compris) → le parent ne peut pas
  // diverger du calendrier quand un filtre ligue vide la journée choisie.
  useEffect(() => {
    onActiveDayChange?.(activeIso);
  }, [activeIso, onActiveDayChange]);

  if (days.length === 0)
    return (
      // État vide annoncé aux lecteurs d'écran
      <div className="text-center py-8 text-[#717171]" aria-live="polite">
        Aucun match programmé
      </div>
    );

  return (
    <div className="space-y-4">
      {/* Sélecteur de jour façon Flashscore : ◀ · date (calendrier) · ▶ — centré
          sous les filtres ; le bouton ouvre la liste des journées disponibles */}
      <div
        className="flex w-full items-center justify-center gap-1.5"
        role="group"
        aria-label="Filtrer par date"
      >
        <button
          type="button"
          aria-label="Jour précédent"
          disabled={activeIdx <= 0}
          onClick={() => goTo(-1)}
          className={ARROW_CLS}
        >
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
        </button>

        <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={DATE_CLS}
              aria-label={activeDay ? activeDay.full : "Toutes les journées"}
            >
              <Calendar className="h-4 w-4" aria-hidden />
              <span>{activeDay ? activeDay.short : "Toutes"}</span>
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" sideOffset={6} className="w-[min(92vw,17rem)] p-1">
            <button
              type="button"
              onClick={() => {
                setSelectedIso(null);
                setPickerOpen(false);
              }}
              className={`${ROW_CLS} ${
                activeIso == null ? "bg-[#f5f5f5] font-semibold text-[#222222]" : ""
              }`}
            >
              <span>Toutes les journées</span>
              <span className="shrink-0 tabular-nums">{days.length} j.</span>
            </button>
            {days.map((d) => {
              const count = d.leagues.reduce((s, l) => s + l.matches.length, 0);
              return (
                <button
                  key={d.iso}
                  type="button"
                  aria-current={d.iso === activeIso ? "date" : undefined}
                  onClick={() => {
                    setSelectedIso(d.iso);
                    setPickerOpen(false);
                  }}
                  className={`${ROW_CLS} ${
                    d.iso === activeIso ? "bg-[#f5f5f5] font-semibold text-[#222222]" : ""
                  }`}
                >
                  <span className="truncate">{d.label}</span>
                  <span className="shrink-0 tabular-nums">{count}</span>
                </button>
              );
            })}
          </PopoverContent>
        </Popover>

        <button
          type="button"
          aria-label="Jour suivant"
          disabled={activeIdx >= days.length - 1}
          onClick={() => goTo(1)}
          className={ARROW_CLS}
        >
          <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>

      {visibleDays.map(({ iso, label, leagues }) => (
        <div key={iso}>
          <h3 className="text-sm font-semibold mb-2 capitalize px-3 py-1.5 rounded-t bg-[#f5f5f5] text-[#222222]">
            {label}
          </h3>
          <div className="rounded-b border border-[#f0f0f0] bg-white overflow-hidden">
            {leagues.map((lg) => (
              <div key={lg.name}>
                {/* Bandeau championnat — miroir LeagueHeader onglet football
                    (drapeau + nom gras + compteur), teinte FotMob #f5f5f5.
                    `leagueCountry` complète le pays quand le feed Flashscore
                    n'en donne pas (clef du catalogue 1xbet) → le drapeau n'est
                    jamais un globe sur une ligue identifiee. */}
                <div className="flex items-center gap-2 border-b border-[#f0f0f0] bg-[#f5f5f5] px-3 py-1.5">
                  <CountryFlag country={leagueCountry(lg.name, lg.country ?? undefined)} size={14} />
                  <span
                    className="min-w-0 flex-1 truncate text-xs font-bold tracking-tight text-[#222222]"
                    title={lg.name}
                  >
                    {lg.country ? `${lg.country.toUpperCase()} : ` : ""}
                    {lg.name}
                  </span>
                  <span className="shrink-0 rounded bg-white px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-[#717171]">
                    {lg.matches.length}
                  </span>
                </div>
                <div className="divide-y divide-[#f0f0f0]">
                  {lg.matches.map((m) => {
              const chips = chipsByMatch?.get(String(m.id));
              return (
                // Ligne cliquable accessible : bouton natif (Enter/Espace inclus).
                // Pas de badge ligue à droite : les matchs sont déjà regroupés
                // sous le bandeau du championnat (le rappel était redondant et
                // mangeait 128 px, ce qui tronquait les noms d'équipes).
                // 2ᵉ ligne de chips « Top stratégies ≥60 % » (flex-col).
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onSelect?.(m)}
                  aria-label={`Analyse du match ${m.home.name} contre ${m.away.name}${
                    chips?.length ? `, ${chips.length} paris à 60 % ou plus` : ""
                  }`}
                  className="flex min-h-[44px] w-full flex-col gap-1 px-3 py-2 text-left text-sm transition-colors hover:bg-[#f5f5f5] cursor-pointer focus-visible:ring-2 ring-[#00e676] outline-none"
                >
                  <span className="flex w-full min-w-0 items-center justify-between">
                    <span className="text-xs w-16 tabular-nums text-[#717171]">
                      {new Date(m.kickoff).toLocaleTimeString("fr-FR", {
                        hour: "2-digit",
                        minute: "2-digit",
                        timeZone: "Europe/Paris",
                      })}
                    </span>
                    <span className="flex-1 text-right font-medium truncate text-[#222222] inline-flex items-center justify-end gap-1.5">
                      <HandballTeamLogo name={m.home.name} size={18} />
                      <span className="truncate">{m.home.name}</span>
                    </span>
                    <span className="mx-2 text-xs text-[#717171]">
                      vs
                    </span>
                    <span className="flex-1 font-medium truncate text-[#222222] inline-flex items-center gap-1.5">
                      <HandballTeamLogo name={m.away.name} size={18} />
                      <span className="truncate">{m.away.name}</span>
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
        </div>
      ))}
    </div>
  );
});
