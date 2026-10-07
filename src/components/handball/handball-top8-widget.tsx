"use client";

import { useMemo, useState } from "react";
import { useHandballTop8 } from "@/hooks/use-handball-top8";
import type { HandballStrategyKey } from "@/lib/handball-strategy-top8";
import { leagueCountry } from "@/lib/handball-logos";
import { filterByNextDays, filterByToday, filterByTomorrow } from "@/lib/match-view";
// « Aujourd'hui | 20:45 » / « 07/10 | 20:45 », Europe/Paris — fonction pure
// déjà testée, partagée avec le tableau « Top 10 des paris sécurisés ».
import { formatTop10DateTime } from "@/lib/handball-top10";
import { sortHandballLeagueEntries } from "@/lib/handball-leagues";
import { CLV_EDGE_THRESHOLD } from "@/lib/handball-clv";
// Drapeau SVG local (public/flags/<iso>.svg). Les emojis drapeaux s'affichent
// en lettres « EU »/« DK » sous Windows — pas de glyphe — d'où le SVG.
import { CountryFlag } from "@/components/ui/country-flag";
import { HandballLeaguePopover } from "./handball-league-popover";
import { pillClass } from "./handball-pill";

// Couleurs via tokens dark (bg-white/border-[#f0f0f0]/text-*) — pas de hex en dur

const STRATEGY_META: Record<
  HandballStrategyKey,
  { label: string; emoji: string; metric: string; unit: string }
> = {
  bestTeam: { label: "Meilleure équipe", emoji: "🏆", metric: "PPG", unit: "" },
  bestTeam1x2: { label: "1X2 Favori", emoji: "📊", metric: "Prob", unit: "%" },
  over55: { label: "Over Total", emoji: "⬆️", metric: "Prob", unit: "%" },
  under62: { label: "Under 62.5", emoji: "⬇️", metric: "Prob", unit: "%" },
  handicap: { label: "Handicap -4.5", emoji: "🎯", metric: "Prob", unit: "%" },
  btts30: { label: "BTTS 30+", emoji: "⚡", metric: "Prob", unit: "%" },
  htLeader: { label: "Leader HT", emoji: "⏱️", metric: "Score", unit: "" },
  valueBet: { label: "Value Bet", emoji: "💰", metric: "Edge", unit: "%" },
};

/** Fenêtres de date proposées. `all` = pas de filtre. */
const DATE_WINDOWS = [
  { key: "all", label: "Toutes les dates" },
  { key: "today", label: "Aujourd'hui" },
  { key: "tomorrow", label: "Demain" },
  { key: "d3", label: "3 prochains jours" },
] as const;

type DateWindowKey = (typeof DATE_WINDOWS)[number]["key"];

/**
 * Applique une fenêtre de date à une liste de lignes Top 8.
 *
 * `all` renvoie la liste telle quelle. Les trois autres passent par les helpers
 * de `match-view` (jours civils Europe/Paris) — « Aujourd'hui » et « Demain »
 * sont disjoints, « 3 prochains jours » couvre J+1..J+3.
 */
function filterByDateWindow<T>(
  rows: T[],
  window: DateWindowKey,
  getKickoff: (row: T) => string | null | undefined,
): T[] {
  if (window === "all") return rows;
  if (window === "today") return filterByToday(rows, getKickoff);
  if (window === "tomorrow") return filterByTomorrow(rows, getKickoff);
  return filterByNextDays(rows, 3, getKickoff);
}

/**
 * Date & heure de coup d'envoi d'une ligne : « Aujourd'hui | 20:45 » pour les
 * 2 prochains jours, « 07/10 | 20:45 » au-delà. Jamais de date inventée — un
 * horodatage illisible affiche « — ».
 */
function KickoffCell({ kickoff }: { kickoff?: string }) {
  const f = kickoff ? formatTop10DateTime(kickoff) : null;
  if (!f) {
    return (
      <span className="whitespace-nowrap text-xs tabular-nums text-[#717171]" title="Coup d'envoi inconnu">
        —
      </span>
    );
  }
  return (
    <span
      className="whitespace-nowrap text-xs font-medium tabular-nums text-[#717171]"
      title={`Coup d'envoi le ${f.day} à ${f.time} (Europe/Paris)`}
    >
      {f.relative ?? f.day}
      <span className="mx-1 opacity-50">|</span>
      {f.time}
    </span>
  );
}

type Top8Entry = {
  matchId: string;
  league: string;
  leagueCountry?: string;
  /** Coup d'envoi ISO — présent dans le payload ; optionnel pour qu'une entrée
   *  ancienne (cache) n'affiche pas « undefined » mais un tiret. */
  kickoff?: string;
  home: { name: string; shortName?: string };
  away: { name: string; shortName?: string };
  value: number;
  pick: "home" | "away" | null;
  odds?: { home?: number; draw?: number; away?: number };
  openingOdds?: {
    over55?: number;
    under62?: number;
    fav1x2?: { home?: number; draw?: number; away?: number };
    handicap?: number;
    btts30?: number;
  };
  probPct?: number;
  ev?: number | null;
  formSummary?: { home: string; away: string };
  bestLine?: number;
};

/**
 * CLV par entry (plan §9) : (p_model − p_implied)/p_implied sur le marché
 * de la stratégie. Null si marché/cote indisponible.
 */
function entryClv(strategy: HandballStrategyKey, e: Top8Entry): { clv: number; price: number } | null {
  if (e.probPct == null) return null;
  const p = e.probPct / 100;
  const o = e.openingOdds;
  const single = (price?: number) =>
    price != null && price > 1 ? { clv: (p - 1 / price) / (1 / price), price } : null;
  if (strategy === "over55") return single(o?.over55);
  if (strategy === "under62") return single(o?.under62);
  if (strategy === "handicap") return single(o?.handicap);
  if (strategy === "btts30") return single(o?.btts30);
  if ((strategy === "bestTeam1x2" || strategy === "valueBet") && e.pick) {
    const t = o?.fav1x2 ?? e.odds;
    if (t?.home != null && t?.away != null && t.home > 1 && t.away > 1) {
      const invH = 1 / t.home;
      const invD = t.draw && t.draw > 1 ? 1 / t.draw : 0;
      const invA = 1 / t.away;
      const s = invH + invD + invA;
      const imp = (e.pick === "home" ? invH : invA) / s;
      const price = e.pick === "home" ? t.home : t.away;
      if (imp > 0) return { clv: (p - imp) / imp, price };
    }
  }
  return null;
}

export function HandballTop8Widget({
  strategy,
}: {
  strategy: HandballStrategyKey;
}) {
  // Filtre serveur ?strat= (payload = stratégie active seulement)
  const { matchesFor, isLoading, isReady } = useHandballTop8(strategy);
  const entries = matchesFor(strategy);
  const meta = STRATEGY_META[strategy];

  // Filtre championnats (bead 3l6w) : réinitialisé à chaque changement de
  // stratégie — chaque stratégie liste ses propres matchs, conserver une
  // ligue absente de la nouvelle liste masquerait tout silencieusement.
  // Idem pour la fenêtre de date : une stratégie n'a pas les mêmes journées.
  // Pattern « adjusting state when props change » (React docs) : reset
  // pendant le rendu, sans useEffect (évite set-state-in-effect).
  const [league, setLeague] = useState<string | null>(null);
  const [dateWindow, setDateWindow] = useState<DateWindowKey>("all");
  const [prevStrategy, setPrevStrategy] = useState(strategy);
  if (prevStrategy !== strategy) {
    setPrevStrategy(strategy);
    setLeague(null);
    setDateWindow("all");
  }

  const leagueOptions = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of entries) map.set(e.league, (map.get(e.league) || 0) + 1);
    // Tri 1xbet (ligues majeures en tête) — réutilise la logique du calendrier
    return sortHandballLeagueEntries(
      [...map.entries()].map(([name, count]) => ({ name, count })),
    );
  }, [entries]);

  // Compteurs par fenêtre, sur la liste DÉJÀ filtrée par ligue : les pilules
  // annoncent le nombre de lignes qu'elles donneraient réellement. Une fenêtre
  // vide est affichée mais neutralisée plutôt que masquée — l'utilisateur voit
  // que la fenêtre existe, et qu'elle est vide pour cette ligue.
  const parLeague = useMemo(
    () => (league ? entries.filter((e) => e.league === league) : entries),
    [entries, league],
  );

  const parDate = useMemo(
    () =>
      DATE_WINDOWS.map((w) => ({
        ...w,
        rows: filterByDateWindow(parLeague, w.key, (e) => (e as Top8Entry).kickoff),
      })),
    [parLeague],
  );

  const visible = parDate.find((w) => w.key === dateWindow)?.rows ?? parLeague;

  if (isLoading)
    return (
      // État async annoncé aux lecteurs d'écran
      <div className="text-center py-4 text-[#717171]" aria-live="polite">
        Chargement stratégies…
      </div>
    );
  if (!isReady || entries.length === 0)
    return (
      <div className="text-center py-4 text-[#717171]" aria-live="polite">
        Aucune donnée stratégie
      </div>
    );

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-[#222222]">
          {meta.emoji} {meta.label}
          <span className="ml-2 text-xs font-normal text-[#717171]">
            {meta.metric}
          </span>
        </h3>
        <HandballLeaguePopover
          leagues={leagueOptions}
          total={entries.length}
          selected={league}
          onSelect={setLeague}
        />
      </div>

      {/* ── Filtre par plage de dates ── */}
      {/* Se combine avec le filtre championnat ci-dessus et avec la stratégie
          (barre « Équipe / 1X2 / Over / U62.5… » du parent, qui pilote la
          requête serveur). Une fenêtre vide reste cliquable mais neutralisée :
          la masquer ferait croire que le filtre n'existe pas. */}
      <div
        className="flex flex-wrap items-center gap-1.5"
        role="group"
        aria-label="Filtrer par plage de dates"
      >
        {parDate.map((w) => (
          <button
            key={w.key}
            type="button"
            aria-pressed={dateWindow === w.key}
            disabled={w.rows.length === 0}
            onClick={() => setDateWindow(w.key)}
            className={`${pillClass(dateWindow === w.key)} disabled:pointer-events-none disabled:opacity-40`}
          >
            {w.label} ({w.rows.length})
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="py-4 text-center text-xs text-[#717171]" aria-live="polite">
          Aucun match dans cette plage de dates.
        </p>
      ) : (
      <div className="rounded border border-[#f0f0f0] bg-white overflow-hidden divide-y divide-[#f0f0f0]">
        {visible.map((e, i) => {
          // Drapeau SVG + CLV marché (plan §9). `country` peut valoir "" (pays
          // inconnu) : pas de drapeau plutôt qu'un globe décoratif sur chaque
          // ligne — CountryFlag gère le repli globe quand le pays existe mais
          // n'a pas d'ISO mappé.
          const entry = e as Top8Entry;
          const country = leagueCountry(entry.league, entry.leagueCountry);
          const ec = entryClv(strategy, entry);
          const edge = ec != null && Math.abs(ec.clv) > CLV_EDGE_THRESHOLD;
          return (
          <div
            key={e.matchId}
            className="flex items-center gap-2 px-3 py-2 text-xs transition-colors hover:bg-[#fafafa]"
          >
            {/* Rang */}
            <span className="w-5 text-center font-bold tabular-nums text-[#717171]">
              {i + 1}
            </span>

            {/* Coup d'envoi — avant les équipes : sans ça, une liste triée par
                stratégie donne des matchs de jours différents sans repère. */}
            <KickoffCell kickoff={entry.kickoff} />

            {/* Équipes */}
            <div className="flex-1 min-w-0">
              <span
                className={
                  e.pick === "home"
                    ? "font-bold text-primary"
                    : "font-medium text-[#222222]"
                }
              >
                {e.home.shortName ?? e.home.name}
              </span>
              <span className="mx-1 text-[#717171]">
                vs
              </span>
              <span
                className={
                  e.pick === "away"
                    ? "font-bold text-primary"
                    : "font-medium text-[#222222]"
                }
              >
                {e.away.shortName ?? e.away.name}
              </span>
            </div>

            {/* Ligue + drapeau */}
            <span
              className="flex min-w-0 items-center justify-end gap-1.5 text-right text-[#717171]"
              title={country ? `${e.league} (${country})` : e.league}
            >
              <span className="w-28 truncate">{e.league}</span>
              {country && <CountryFlag country={country} size={14} />}
            </span>

            {/* Form */}
            {e.formSummary && (
              <span className="w-12 text-center tabular-nums text-[#717171]">
                {e.formSummary.home}
              </span>
            )}

            {/* Métrique principale */}
            <span className="font-mono font-semibold px-1.5 py-0.5 rounded tabular-nums bg-primary/10 text-primary">
              {e.value.toFixed(1)}
              {meta.unit}
            </span>

            {/* Over pill */}
            {strategy === "over55" && e.bestLine != null && (
              <span className="font-mono text-[10px] font-semibold px-1.5 py-0.5 rounded tabular-nums bg-primary/10 text-primary">
                O{e.bestLine} {e.probPct?.toFixed(0)}%
              </span>
            )}

            {/* Prob % (CMP Over/Under, plan §9) */}
            {e.probPct != null && (
              <span className="tabular-nums text-[#717171]">
                {e.probPct.toFixed(0)}%
              </span>
            )}

            {/* Cote ouverture + badge edge |CLV| > 1,5 % */}
            {ec != null && (
              <span className="font-mono tabular-nums text-[#717171]">
                @{ec.price.toFixed(2)}
              </span>
            )}
            {edge && ec != null && (
              <span
                className={`font-mono text-[10px] font-semibold px-1.5 py-0.5 rounded tabular-nums ${
                  ec.clv > 0 ? "bg-[#00e676]/15 text-[#00e676]" : "bg-red-500/15 text-red-500"
                }`}
              >
                {ec.clv > 0 ? "+" : ""}{(ec.clv * 100).toFixed(1)}%
              </span>
            )}

            {/* EV+ */}
            {e.ev != null && e.ev > 0 && (
              <span className="font-mono tabular-nums text-primary">
                +{e.ev.toFixed(2)}
              </span>
            )}
          </div>
          );
        })}
      </div>
      )}
    </div>
  );
}
