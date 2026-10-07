"use client";

import { useState, useMemo, useEffect } from "react";
import useSWR from "swr";
import { useHandballMatches } from "@/hooks/use-handball-matches";
import { useVitibetTips } from "@/hooks/use-vitibet-tips";
import { useHandballTop8, type StrategyChip } from "@/hooks/use-handball-top8";
import { HandballMatchCard } from "./handball-match-card";
import { pillClass } from "./handball-pill";
import { HandballMatchDetailDialog } from "./handball-match-detail-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HandballFilters } from "./handball-filters";
import { HandballLeaguePopover, type LeagueOption } from "./handball-league-popover";
import { HandballStrategyBar } from "./handball-strategy-bar";
import { HandballTop8Widget } from "./handball-top8-widget";
import { HandballVitibetTop10 } from "./handball-vitibet-top10";
import { HandballVitibetBacktest } from "./handball-vitibet-backtest";
import { HandballBacktestWidget } from "./handball-backtest-widget";
import { HandballBacktestMatrix } from "./handball-backtest-matrix";
import { HandballBanker } from "./handball-banker";
import { HandballBacktestingView } from "./handball-backtesting-view";
import { HandballPariscoreBacktest } from "./handball-pariscore-backtest";
import { HandballSyncBadge } from "./handball-sync-badge";
import { HandballLeagueStandings } from "./handball-league-standings";
import { HandballTop10Table } from "./handball-top10-table";
import { buildTop10, type Top10InputMatch } from "@/lib/handball-top10";
import { useHandballHistorySeries } from "@/hooks/use-handball-history-series";
import { HandballCalendar } from "./handball-calendar";
import { HandballLeagueBadge } from "./handball-league-badge";
import { HandballTeamLogo } from "./handball-team-logo";
import { HandballNews } from "./handball-news";
import { HandballTableCaption } from "./handball-table-caption";
import { HandballErrorBoundary } from "./handball-error-boundary";
import { HandballHeroBanner } from "./handball-3d-art";
import type { HandballStrategyKey } from "@/lib/handball-strategy-top8";
import type { VitibetTip } from "@/lib/vitibet/types";
// Store global : source de vérité du sous-onglet actif (rangée headbar
// SportSubTabs ↔ pilules internes du calendrier). Les deux écrivent la MÊME
// clé — sinon la rangée et le contenu divergent.
import { useSportsSidebarStore } from "@/stores/use-sports-sidebar-store";

/**
 * Vues du calendrier handball. Les ids correspondent EXACTEMENT aux `id` de
 * la branche `handball` de SPORT_SUB_TABS (src/components/layout/
 * sport-sub-tabs.tsx) — un id divergent = un onglet cliquable qui n'affiche
 * rien, le défaut qui a fait disparaître « Backtesting ».
 */
export type HandballMode =
  | "prematch"
  | "live"
  | "top10"
  | "backtesting"
  | "classement"
  | "results";

/** Ids de sous-onglets → vue interne (« calendrier » est l'id de `prematch`). */
const SUBTAB_TO_MODE: Record<string, HandballMode> = {
  calendrier: "prematch",
  live: "live",
  top10: "top10",
  backtesting: "backtesting",
  classement: "classement",
  resultats: "results",
};
/** Vue interne → id de sous-onglet (pour garder les deux rangées alignées). */
const MODE_TO_SUBTAB: Record<HandballMode, string> = {
  prematch: "calendrier",
  live: "live",
  top10: "top10",
  backtesting: "backtesting",
  classement: "classement",
  results: "resultats",
};

/**
 * Libellés des sous-onglets — source unique partagée par les déclencheurs
 * `Tabs` ci-dessous. L'ordre est celui de la rangée headbar SportSubTabs.
 */
const SUBTABS: ReadonlyArray<{ mode: HandballMode; label: string; short: string }> = [
  { mode: "prematch", label: "Calendrier", short: "Calendrier" },
  { mode: "live", label: "Live", short: "Live" },
  { mode: "top10", label: "Stratégie Top 10", short: "Top 10" },
  { mode: "backtesting", label: "Backtesting", short: "Backtest" },
  { mode: "classement", label: "Classement & Stats", short: "Ligues" },
  { mode: "results", label: "Résultats", short: "Résultats" },
];

/** `true` si `value` est une vue interne connue — garde le cast des onglets. */
function isHandballMode(value: string): value is HandballMode {
  return Object.prototype.hasOwnProperty.call(MODE_TO_SUBTAB, value);
}
// Type-only : effacé à la compilation, le moteur de backtest reste côté serveur.
import type { DailyStrategyBacktest } from "@/lib/handball-backtest-today";
import type { HandballMatch } from "@/lib/handball-data";

/** Jour civil Europe/Paris (en-CA = « AAAA-MM-JJ ») — miroir de parisDateOf côté serveur. */
const PARIS_DAY_FMT = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Paris",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const PARIS_TIME_FMT = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Europe/Paris",
  hour: "2-digit",
  minute: "2-digit",
});
const PARIS_DAY_LONG_FMT = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "UTC",
  weekday: "long",
  day: "numeric",
  month: "long",
});

/** Jour Europe/Paris d'un kickoff ISO ("" si date invalide → match exclu). */
function parisDay(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : PARIS_DAY_FMT.format(d);
}

const fetchJson = <T,>(url: string): Promise<T> =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json() as Promise<T>;
  });

/**
 * Carte « vide » : ni cote (1X2 / 1-2), ni pronostic Vitibet exploitable
 * (INDEX et probas tous absents → la carte n'afficherait que des « – »).
 */
function isBlankCard(
  match: HandballMatch,
  tip: VitibetTip | null | undefined
): boolean {
  const hasOdds =
    match.odds?.home != null || match.odds?.draw != null || match.odds?.away != null;
  const hasTip =
    tip != null &&
    (tip.indexValue != null ||
      tip.probHome != null ||
      tip.probDraw != null ||
      tip.probAway != null);
  return !hasOdds && !hasTip;
}

const fmtSigned = (v: number, digits = 1): string => {
  const s = v.toFixed(digits);
  return v > 0 ? `+${s}` : s;
};

const fmtDayLabel = (isoDate: string): string =>
  PARIS_DAY_LONG_FMT.format(new Date(`${isoDate}T00:00:00Z`));

type ResultsTodayPayload = {
  date: string;
  /** Fenêtre glissante en jours (défaut 7 — bead 4pvy). */
  days?: number;
  matches: HandballMatch[];
  source: string;
  scrapedAt: string | null;
  stale?: boolean;
  count: number;
};

/**
 * Verdict d'une chip stratégie sur un match terminé (enrichissement 📆 Résultats).
 * Retourne true = gagné, false = perdu, null = non verdictable (ligne Over/Under
 * non portée par le chip → on N'INVENTE jamais de verdict).
 * Protocole projet : match nul = perdant pour les picks 1X2.
 */
function chipVerdict(c: StrategyChip, m: HandballMatch): boolean | null {
  const s = m.score;
  if (s?.home == null || s?.away == null) return null;
  if (c.key === "btts30") return Math.min(s.home, s.away) >= 30;
  if (c.key === "htLeader") {
    if (!c.pick || s.homeHalf == null || s.awayHalf == null) return null;
    const mtWinner = s.homeHalf > s.awayHalf ? "home" : s.awayHalf > s.homeHalf ? "away" : null;
    return mtWinner != null && c.pick === mtWinner;
  }
  // Over/Under : la ligne n'est pas dans le chip → non verdictable (honnêteté)
  if (c.key === "over55" || c.key === "under62") return null;
  if (c.pick) {
    if (c.key === "handicap") {
      const diff = s.home - s.away;
      return c.pick === "home" ? diff > 4.5 : diff < -4.5;
    }
    const winner = s.home > s.away ? "home" : s.away > s.home ? "away" : null;
    return winner != null && c.pick === winner;
  }
  return null;
}

type BacktestTodayPayload = DailyStrategyBacktest & { source: "file" | "live" };

/**
 * Mode 📆 Résultats du jour : backtest des 8 stratégies sur la journée +
 * liste des matchs terminés (Europe/Paris). Chaque ligne ouvre la popup
 * d'analyse (stats) comme le calendrier prematch.
 */
function HandballResultsToday({
  onOpenMatch,
  chipsByMatch,
}: {
  onOpenMatch: (m: HandballMatch) => void;
  /** Chips stratégies par match (String(match.id)) → verdicts ✅/❌ des picks. */
  chipsByMatch?: ReadonlyMap<string, readonly StrategyChip[]>;
}) {
  const { data: results, error: resultsError, isLoading: resultsLoading } =
    useSWR<ResultsTodayPayload>("/api/handball/results-today?days=7", fetchJson, {
      refreshInterval: 5 * 60_000,
      dedupingInterval: 2 * 60_000,
      revalidateOnFocus: false,
    });
  const { data: backtest, error: btError, isLoading: btLoading } =
    useSWR<BacktestTodayPayload>("/api/handball/backtest-today", fetchJson, {
      dedupingInterval: 15 * 60_000,
      revalidateOnFocus: false,
    });

  // ── Filtres de la table 7 jours (demande user : par date + championnat) ──
  const [day, setDay] = useState<string | null>(null);
  const [league, setLeague] = useState<string | null>(null);

  /** Fenêtre filtrée par JOURNEE (avant filtre ligue) — base des compteurs. */
  const dayBase = useMemo(() => {
    const all = results?.matches ?? [];
    if (!day) return all;
    return all.filter((m) => parisDay(m.kickoff) === day);
  }, [results, day]);

  /** Table affichée = jour × championnat combinés. */
  const dayMatches = useMemo(
    () => (league ? dayBase.filter((m) => m.league.name === league) : dayBase),
    [dayBase, league],
  );

  /** Journées présentes (desc) → pilules de date avec compteurs. */
  const dayOptions = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of results?.matches ?? []) {
      const d = parisDay(m.kickoff);
      map.set(d, (map.get(d) ?? 0) + 1);
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [results]);

  /** Championnats de la fenêtre (compteurs = après filtre jour). */
  const leagueOptions = useMemo<LeagueOption[]>(() => {
    const map = new Map<string, { count: number; country?: string }>();
    for (const m of dayBase) {
      const cur = map.get(m.league.name);
      if (cur) cur.count++;
      else map.set(m.league.name, { count: 1, country: m.league.country || undefined });
    }
    return [...map.entries()]
      .map(([name, v]) => ({ name, count: v.count, country: v.country }))
      .sort((a, b) => b.count - a.count);
  }, [dayBase]);

  // Taux de réussite concrétisé des picks (verdicts sur la SéLECTION filtrée).
  const verdictSummary = useMemo(() => {
    if (!results) return null;
    let won = 0;
    let total = 0;
    for (const m of dayMatches) {
      const chips = chipsByMatch?.get(String(m.id));
      if (!chips) continue;
      for (const c of chips) {
        const v = chipVerdict(c, m);
        if (v == null) continue;
        total++;
        if (v) won++;
      }
    }
    return total > 0 ? { won, total } : null;
  }, [dayMatches, chipsByMatch]);

  return (
    <div className="space-y-4">
      {/* Backtest des stratégies sur la journée */}
      <section className="space-y-2 rounded border border-[#f0f0f0] bg-white p-3">
        <div className="flex flex-wrap items-baseline gap-2">
          <h3 className="text-sm font-semibold text-[#222222]">
            📉 Backtest des stratégies du jour
          </h3>
          {backtest && (
            <span className="text-xs text-[#717171]">
              {fmtDayLabel(backtest.date)} · {backtest.nFinishedToday} match(s) terminé(s) ·
              source {backtest.source === "file" ? "cron" : "calcul direct"}
            </span>
          )}
        </div>

        {btLoading ? (
          <div className="py-3 text-center text-sm text-[#717171]" aria-live="polite">
            Calcul du backtest…
          </div>
        ) : btError || !backtest ? (
          <div className="py-3 text-center text-sm text-[#717171]">
            Backtest indisponible
          </div>
        ) : backtest.nFinishedToday === 0 ? (
          <p className="py-2 text-sm text-[#717171]">
            Aucun match terminé aujourd&apos;hui — le backtest sera régénéré à 23:00.
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <HandballTableCaption>Résultats par stratégie — cotes simulées</HandballTableCaption>
                <thead>
                  <tr className="border-b border-[#f0f0f0] text-left text-[#717171]">
                    <th className="py-1.5 pr-2 font-medium">Stratégie</th>
                    <th className="py-1.5 pr-2 font-medium">Marché</th>
                    <th className="py-1.5 pr-2 text-right font-medium">Paris</th>
                    <th className="py-1.5 pr-2 text-right font-medium">G / P</th>
                    <th className="py-1.5 pr-2 text-right font-medium">ROI</th>
                    <th className="py-1.5 pr-2 text-right font-medium">Profit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f0f0f0]">
                  {backtest.strategies.map((row) => (
                    <tr key={row.strategy}>
                      <td className="whitespace-nowrap py-1.5 pr-2 font-medium text-[#222222]">
                        {row.emoji} {row.label}
                      </td>
                      <td className="whitespace-nowrap py-1.5 pr-2 text-[#717171]">
                        {row.market}
                      </td>
                      <td className="py-1.5 pr-2 text-right tabular-nums">
                        {row.nBets}
                        {row.voids > 0 && (
                          <span className="text-[#717171]"> (+{row.voids}n)</span>
                        )}
                      </td>
                      <td className="py-1.5 pr-2 text-right tabular-nums">
                        {row.nBets > 0 ? `${row.won} / ${row.lost}` : "—"}
                      </td>
                      <td className="py-1.5 pr-2 text-right">
                        {row.roiPct != null ? (
                          <span
                            className={`rounded px-1.5 py-0.5 font-mono font-semibold tabular-nums ${
                              row.roiPct > 0
                                ? "bg-[#00e676]/15 text-[#00e676]"
                                : "bg-red-500/15 text-red-500"
                            }`}
                          >
                            {fmtSigned(row.roiPct)}%
                          </span>
                        ) : (
                          <span className="text-[#717171]" title={row.note}>
                            —
                          </span>
                        )}
                      </td>
                      <td className="py-1.5 pr-2 text-right font-mono tabular-nums">
                        {row.nBets > 0 ? `${fmtSigned(row.profitU, 2)}u` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-[#717171]">
              Total : {backtest.global.nBets} paris · {backtest.global.won} gagnés ·{" "}
              {backtest.global.lost} perdus · {backtest.global.voids} annulés · ROI{" "}
              {backtest.global.roiPct != null ? `${fmtSigned(backtest.global.roiPct)}%` : "—"} ·
              profit {fmtSigned(backtest.global.profitU, 2)}u
            </p>
            <p className="text-[11px] font-medium text-amber-500">
              ⚠️ Cotes simulées, échantillon d&apos;une journée — ROI indicatif, pas un conseil
              de pari.
            </p>
          </>
        )}
      </section>

      {/* Liste des résultats — 7 derniers jours groupés par journée (4pvy) */}
      <section className="space-y-2">
        <div className="flex flex-wrap items-baseline gap-2">
          <h3 className="text-sm font-semibold text-[#222222]">📆 Résultats — 7 derniers jours</h3>
          {/* Fraîcheur de la source (cron 4 h) : sans ce rappel, une fenêtre
              figée est indiscernable d'une fenêtre à jour. */}
          <HandballSyncBadge scrapedAt={results?.scrapedAt} />
          {results && (
            <span className="text-xs text-[#717171]">
              {dayMatches.length} match(s) terminé(s)
              {(day || league) && (
                <span className="text-[#717171]/70">
                  {" "}
                  (filtre{day ? ` du ${day.split("-").reverse().join("/")}` : ""}
                  {league ? ` · ${league}` : ""})
                </span>
              )}
            </span>
          )}
          {verdictSummary && (
            <span className="text-xs font-semibold" title="Picks des stratégies concrétisés sur les résultats (Over/Under sans ligne = non verdictés)">
              Picks (7 j) : {verdictSummary.won}/{verdictSummary.total} ✅ (
              {Math.round((verdictSummary.won / verdictSummary.total) * 100)}%)
            </span>
          )}
        </div>

        {/* Filtres table : journée (pilules) + championnat (popover partagé) */}
        {results && results.matches.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <HandballLeaguePopover
              leagues={leagueOptions}
              total={dayBase.length}
              selected={league}
              onSelect={setLeague}
            />
            <div
              className="flex flex-wrap gap-1.5"
              role="group"
              aria-label="Filtrer par journée"
            >
              <button
                type="button"
                aria-pressed={day === null}
                onClick={() => setDay(null)}
                className={pillClass(day === null)}
              >
                Toutes ({results.matches.length})
              </button>
              {dayOptions.map(([d, n]) => (
                <button
                  key={d}
                  type="button"
                  aria-pressed={day === d}
                  onClick={() => setDay(d)}
                  className={pillClass(day === d)}
                  title={fmtDayLabel(d)}
                >
                  {`${d.slice(8)}/${d.slice(5, 7)} (${n})`}
                </button>
              ))}
            </div>
          </div>
        )}

        {resultsLoading ? (
          <div className="py-6 text-center text-sm text-[#717171]" aria-live="polite">
            Chargement des résultats…
          </div>
        ) : resultsError || !results ? (
          <div className="py-6 text-center text-sm text-[#717171]">
            Résultats indisponibles
          </div>
        ) : results.matches.length === 0 ? (
          <div className="py-6 text-center text-sm text-[#717171]" aria-live="polite">
            Aucun résultat sur les 7 derniers jours
          </div>
        ) : dayMatches.length === 0 ? (
          <div className="py-6 text-center text-sm text-[#717171]" aria-live="polite">
            Aucun résultat pour ce filtre
            {(day || league) && (
              <button
                type="button"
                className="ml-2 underline text-[#222222] hover:no-underline"
                onClick={() => {
                  setDay(null);
                  setLeague(null);
                }}
              >
                Réinitialiser
              </button>
            )}
          </div>
        ) : (
          <>
            {results.stale && (
              <p className="text-[11px] font-medium text-amber-500">
                ⚠️ Snapshot Flashscore de plus de 20h — résultats potentiellement incomplets.
              </p>
            )}
            {(() => {
              // Groupement par journée Europe/Paris, du plus récent au plus ancien.
              const groups = new Map<string, HandballMatch[]>();
              for (const m of dayMatches) {
                const d = parisDay(m.kickoff);
                const list = groups.get(d);
                if (list) list.push(m);
                else groups.set(d, [m]);
              }
              const daysDesc = [...groups.keys()].sort().reverse();
              return daysDesc.map((day) => (
                <div key={day} className="space-y-1.5">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-[#717171]">
                    {fmtDayLabel(day)}
                    <span className="ml-1 font-normal normal-case">
                      · {groups.get(day)!.length} match(s)
                    </span>
                  </h4>
                  <ul className="space-y-2">
                    {groups.get(day)!.map((m) => {
                const chips = chipsByMatch?.get(String(m.id));
                const diff = (m.score?.home ?? 0) - (m.score?.away ?? 0);
                return (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => onOpenMatch(m)}
                    className="flex w-full items-center gap-3 rounded border border-[#f0f0f0] bg-white px-3 py-2 text-left transition-colors hover:bg-[#fafafa]"
                    aria-label={`Ouvrir l'analyse ${m.home.name} ${m.away.name}`}
                  >
                    <span className="w-10 shrink-0 text-xs tabular-nums text-[#717171]">
                      {PARIS_TIME_FMT.format(new Date(m.kickoff))}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-[#222222]">
                        {m.home.name} <span className="text-[#717171]">–</span>{" "}
                        {m.away.name}
                      </span>
                      <span className="block truncate text-[11px] text-[#717171]">
                        {m.league.name}
                        {m.league.country ? ` · ${m.league.country}` : ""}
                      </span>
                      {/* Verdicts des picks stratégies sur ce match */}
                      {chips && chips.length > 0 && (
                        <span className="mt-1 flex flex-wrap gap-1">
                          {chips.map((c) => {
                            const v = chipVerdict(c, m);
                            return (
                              <span
                                key={c.key}
                                title={`${c.label} — ${c.probPct.toFixed(1)} %`}
                                className="inline-flex items-center gap-0.5 rounded-full border border-[#f0f0f0] bg-[#fafafa] px-1.5 py-0.5 text-[10px] font-semibold text-[#222222]"
                              >
                                <span aria-hidden="true">{c.emoji}</span>
                                {c.label}
                                {v != null && <span aria-label={v ? "gagné" : "perdu"}>{v ? "✅" : "❌"}</span>}
                              </span>
                            );
                          })}
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block font-mono text-sm font-semibold tabular-nums text-[#222222]">
                        {m.score?.home ?? 0} - {m.score?.away ?? 0}
                      </span>
                      <span className="block text-[11px] tabular-nums text-[#717171]">
                        {m.score?.homeHalf != null && m.score.awayHalf != null && (
                          <>MT {m.score.homeHalf} - {m.score.awayHalf} · </>
                        )}
                        écart {diff > 0 ? `+${diff}` : diff}
                      </span>
                    </span>
                  </button>
                </li>
                );
                    })}
                    </ul>
                  </div>
                ));
              })()}
            </>
          )}
        </section>
    </div>
  );
}

export function HandballTabContent() {
  const { matches: allMatches, isLoading } = useHandballMatches();
  // Pronostics Vitibet (J→J+3) : rapprochement par (jour, équipes) pour les cartes.
  const { tipFor } = useVitibetTips();
  // Fix debug : useHandballLive retiré (fetch 15s jamais consommé)
  // Vue active = sous-onglet du store (partagé avec la rangée headbar
  // SportSubTabs). Id inconnu → repli sur le calendrier, jamais un écran vide.
  const subTab = useSportsSidebarStore((s) => s.sportSubTabs.handball);  const setSubTab = useSportsSidebarStore((s) => s.setSubTab);
  const [localMode, setLocalMode] = useState<HandballMode>("prematch");
  const mode = SUBTAB_TO_MODE[subTab ?? ""] ?? localMode;
  const setMode = (next: HandballMode) => {
    setLocalMode(next);
    setSubTab("handball", MODE_TO_SUBTAB[next]);
  };
  const [selectedLeague, setSelectedLeague] = useState<string | null>(null);
  // Journée affichée par HandballCalendar (null = toutes). Remontée par le
  // calendrier via `onActiveDayChange` : c'est la SEULE source de vérité du
  // compteur du popover ligues (sinon il comptait toute la fenêtre à venir).
  const [activeDayIso, setActiveDayIso] = useState<string | null>(null);
  const [strategy, setStrategy] = useState<HandballStrategyKey>("bestTeam");
  // Fix wiring UX : dialog détail (composant créé en Phase 6, jamais monté)
  const [detailMatch, setDetailMatch] = useState<HandballMatch | null>(null);

  const isLive = (m: { status: string }) =>
    m.status === "live" || m.status === "halftime";

  const live = useMemo(() => allMatches.filter(isLive), [allMatches]);
  // Fix debug : "À venir" exclut les terminés (statut = not_started seulement)
  const prematch = useMemo(
    () => allMatches.filter((m) => m.status === "not_started"),
    [allMatches],
  );
  // Terminés du jour Europe/Paris → compteur du bouton 📆 (le panneau refait
  // son propre fetch pour servir la source de vérité de la route).
  const resultsToday = useMemo(() => {
    const today = PARIS_DAY_FMT.format(new Date());
    return allMatches.filter(
      (m) => m.status === "finished" && m.score && parisDay(m.kickoff) === today,
    );
  }, [allMatches]);
  const displayed = mode === "live" ? live : prematch;
  // Mémoïsé : la référence doit être stable pour que React.memo du calendrier
  // (G6-9) soit effectif — un filtre recréé à chaque render neutraliserait le memo.
  // Filtre championnat seul : la fenêtre temporelle (« dans 1h/2h/4h/8h ») a été
  // retirée au profit du sélecteur de journées de HandballCalendar.
  const filtered = useMemo(
    () =>
      selectedLeague
        ? displayed.filter((m) => m.league.name === selectedLeague)
        : displayed,
    [displayed, selectedLeague],
  );
  // Finition sur la journée affichée par le calendrier. `activeDayIso` vient
  // du calendrier lui-même (il publie le jour qu'il REND, repli compris) donc il
  // ne peut pas diverger. Uniquement en « Calendrier » : les autres vues n'ont
  // pas de sélecteur de jour, un jour résiduel n'aurait aucun sens.
  const dayScope = useMemo(
    () =>
      mode === "prematch" && activeDayIso
        ? displayed.filter((m) => parisDay(m.kickoff) === activeDayIso)
        : displayed,
    [mode, displayed, activeDayIso],
  );
  const dayFiltered = useMemo(
    () =>
      mode === "prematch" && activeDayIso
        ? filtered.filter((m) => parisDay(m.kickoff) === activeDayIso)
        : filtered,
    [mode, filtered, activeDayIso],
  );
  // Matchs terminés du snapshot → forme récente + lambdas ajustés du dialog détail.
  const finished = useMemo(
    () => allMatches.filter((m) => m.status === "finished"),
    [allMatches],
  );

  // Lignes du « Top 10 des paris sécurisés ».
  //
  // Historique lu dans `handball_match_history` (table nourrie par le cron
  // quotidien, 2 saisons) via /api/handball/history-series. AVANT on lisait le
  // form-store du SNAPSHOT courant, qui est vide dès que l'ingestion décroche —
  // c'était la cause du tableau vide alors que la base contenait 8 000+ matchs.
  //
  // On exige ≥ 3 matchs terminés pour CHACUNE des deux équipes : sans cet
  // historique le seuil serait calculé sur le prior neutre (28.5 buts/équipe),
  // donc la ligne recommandée n'aurait aucun rapport avec les équipes réelles.
  const upcomingTeams = useMemo(
    () => [...new Set(prematch.flatMap((m) => [m.home.name, m.away.name]))],
    [prematch],
  );
  const { series: historySeries } = useHandballHistorySeries(upcomingTeams, 10);

  const top10Rows = useMemo(() => {
    const now = Date.now();
    const horizon = now + 14 * 86_400_000;
    const avg = (xs: number[]) => xs.reduce((x, y) => x + y, 0) / xs.length;
    const candidates: Top10InputMatch[] = [];
    for (const m of prematch) {
      const t = Date.parse(m.kickoff);
      if (!Number.isFinite(t) || t <= now || t > horizon) continue;
      const h = historySeries[m.home.name];
      const a = historySeries[m.away.name];
      if (!h || !a || h.gf.length < 3 || a.gf.length < 3) continue;
      // L5 pour la moyenne de buts : c'est la fenêtre dont dispose le modèle.
      candidates.push({
        matchId: String(m.id),
        home: m.home.name,
        away: m.away.name,
        dateTime: m.kickoff,
        leagueName: m.league.name,
        countryCode: m.league.countryCode ?? null,
        homeStats: { scoredAvg: avg(h.gf.slice(-5)), concededAvg: avg(h.ga.slice(-5)) },
        awayStats: { scoredAvg: avg(a.gf.slice(-5)), concededAvg: avg(a.ga.slice(-5)) },
        odds: m.odds,
      });
    }
    return buildTop10(candidates, 10);
  }, [prematch, historySeries]);

  // Chips « Top stratégies ≥60 % » par ligne de calendrier — même payload SWR
  // que le Top8 widget / Banker (clé partagée → 0 requête supplémentaire).
  const { data: strategyPayload } = useHandballTop8();
  const chipsByMatch = useMemo(() => {
    const map = new Map<string, StrategyChip[]>();
    for (const [id, list] of Object.entries(strategyPayload?.chips ?? {})) {
      map.set(id, list);
    }
    return map;
  }, [strategyPayload]);

  // Auto-switch prematch si aucun live
  useEffect(() => {
    if (mode === "live" && live.length === 0) setMode("prematch");
  }, [mode, live.length]);

  // Championnats vus dans le SNAPSHOT (tous statuts confondus) — la liste des
  // options du sous-onglet « Classement & Stats ». Le composant filtre lui-même
  // sur les ligues réellement couvertes : proposer un championnat sans données
  // afficherait des cartes vides sous son nom.
  const leagueNames = useMemo(
    () => [...new Set(allMatches.map((m) => m.league.name))],
    [allMatches],
  );

  return (
    <HandballErrorBoundary>
    <div className="space-y-6">
      {/* ══ Bannière de marque : illustration 3D détourée à droite, dégradé
          d'estompage par-dessus pour garder le texte contrasté sur n'importe
          quel rendu. Décorative (`aria-hidden` sur l'image). Les assets sont
          produits par scripts/gen-handball-art.mjs — voir
          docs/handball-art/prompts.md. Tant qu'ils manquent, le composant masque
          l'image au lieu d'afficher une icône cassée. ══ */}
      <HandballHeroBanner
        subtitle={
          mode === "backtesting"
            ? "Backtesting Pariscore sur 2 saisons · ROI par marché"
            : mode === "top10"
              ? "Top 10 des stratégies · seuils de confiance"
              : mode === "classement"
                ? "Classements domicile / extérieur · stats d'équipes"
                : mode === "results"
                  ? `${resultsToday.length} résultat(s) aujourd'hui · historique 2 saisons`
                  : mode === "live"
                    ? `${live.length} match(s) en direct`
                    : `${dayFiltered.length} match(s) à venir · prédictions IA`
        }
      />

      {/* ══ Conteneur principal découpé en sous-onglets (mission « structuration
          par sous-onglets ») : 📅 Calendrier · 🔴 Live · 🎯 Stratégie Top 10 ·
          📊 Backtesting · 🏆 Classement & Stats · 📆 Résultats.
          La rangée headbar SportSubTabs écrit la MÊME clé de store (voir
          SUBTAB_TO_MODE) → les deux rangées ne peuvent pas diverger. ══ */}
      <section className="space-y-3 rounded border border-[#f0f0f0] bg-white p-3 text-[#222222]">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold text-[#222222]">📅 Calendrier handball</h3>
          <span className="text-xs text-[#717171]">
            {mode === "backtesting"
              ? "Historique des prédictions · ROI · taux de réussite"
              : mode === "results"
                ? `${resultsToday.length} résultat(s) aujourd'hui — panneau sur 7 j`
                : mode === "live"
                  ? `${live.length} match(s) en direct`
                  : mode === "top10"
                    ? "Stratégies & Top 10"
                    : mode === "classement"
                      ? "Classements & statistiques par championnat"
                      : `${dayFiltered.length} match(s) à venir`}
          </span>
        </div>

        {/* Sous-onglets — bandeau Flashscore : label long sur ≥ md, label court
            en dessous (miroir `.filters__text--long/--short`, bascule à 800px).
            `pillClass(mode === …)` plutôt que `data-[state=active]` : l'état est
            déjà dans `mode` (Tabs contrôlé), et ça évite tout conflit de
            cascade entre les variantes Tailwind. */}
        <Tabs
          value={mode}
          onValueChange={(v) => {
            if (isHandballMode(v)) setMode(v);
          }}
        >
          <TabsList
            aria-label="Sous-sections handball"
            className="h-auto w-full flex-wrap justify-start gap-2 bg-transparent p-0"
          >
            {SUBTABS.map((t) => (
              <TabsTrigger
                key={t.mode}
                value={t.mode}
                // `flex-none` : sans lui, l'héritage shadcn `flex-1`
                // (flex-basis: 0) écrase chaque pilule à 1/6 de la largeur ;
                // le libellé `whitespace-nowrap` débordait alors sur la pilule
                // voisine et masquait le dernier onglet (RÉSULTATS).
                className={`${pillClass(mode === t.mode)} flex-none`}
              >
                <span className="md:hidden">{t.short}</span>
                <span className="hidden md:inline">{t.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Filtre championnat : partagé par Calendrier et Live uniquement. La
              fenêtre « dans 1h/2h/4h/8h » a été retirée (bead 4md8) — le
              sélecteur de journées de HandballCalendar la remplace entièrement.
              `scope` = journée affichée → le compteur suit le jour sélectionné. */}
          {(mode === "prematch" || mode === "live") && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <HandballFilters
                matches={displayed}
                scope={dayScope}
                selected={selectedLeague}
                onSelect={setSelectedLeague}
              />
            </div>
          )}

        {/* 📊 4. Backtesting — historique des prédictions, taux de réussite, ROI.
              Ne dépend pas de `filtered` : c'est un audit, pas une liste de
              matchs — les filtres calendrier ne s'y appliquent pas. */}
          <TabsContent value="backtesting" className="mt-3">
            <HandballBacktestingView />
          </TabsContent>

          {/* 📆 6. Résultats — backtest des 8 stratégies du jour + résultats 7 j
              groupés par journée, verdicts ✅/❌ des picks. */}
          <TabsContent value="results" className="mt-3">
            <HandballResultsToday onOpenMatch={setDetailMatch} chipsByMatch={chipsByMatch} />
          </TabsContent>

          {/* 🎯 3. Stratégie Top 10 — barre par type de marché (Équipe / 1X2 /
              Over / U62.5 / HC / BTTS / HT / EV+), filtres par plage de dates
              dans le widget, puis le tableau des paris sécurisé. */}
          <TabsContent value="top10" className="mt-3">
            <div className="space-y-3">
              <HandballStrategyBar active={strategy} onChange={setStrategy} />
              <HandballTop8Widget strategy={strategy} />
              {/* Top 10 « conseils » : seuil de total recalibré (ν mesuré) +
                  date/heure + drapeau par ligne. Alimenté par les matchs réels
                  du calendrier (aucune donnée inventée). */}
              <section className="space-y-2">
                <h3 className="text-sm font-semibold text-[#222222] dark:text-white">
                  🏆 Top 10 des paris sécurisés
                </h3>
                <HandballTop10Table rows={top10Rows} />
              </section>
            </div>
          </TabsContent>

          {/* 🏆 5. Classement & Stats par championnat — cartes synthétiques,
              classements Domicile / Extérieur, statistiques d'équipes. */}
          <TabsContent value="classement" className="mt-3">
            <HandballLeagueStandings leagueNames={leagueNames} />
          </TabsContent>

          {/* 📅 1. Calendrier — matchs à venir groupés par journée (sélecteur de
              dates dans HandballCalendar), pastilles « Top stratégies ≥60 % »
              sous chaque ligne. */}
          <TabsContent value="prematch" className="mt-3">
            {isLoading ? (
              <div className="py-8 text-center text-[#717171]" aria-live="polite">
                Chargement…
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-8 text-center text-[#717171]" aria-live="polite">
                Aucun match handball
              </div>
            ) : (
              <>
                {/* Calendrier groupé par jour (lignes cliquables → popup) + la
                    grille de cartes (cotes + tips Vitibet) : les DEUX rendus
                    d'avant la restructuration, conservés tels quels. */}
                <HandballCalendar
                  matches={filtered}
                  chipsByMatch={chipsByMatch}
                  onSelect={setDetailMatch}
                  onActiveDayChange={setActiveDayIso}
                />
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {filtered.map((m) => {
                    const tip = tipFor(m);
                    // Mobile : carte vide (aucune cote, aucun tip) masquée pour ne
                    // pas enchaîner des lignes de « – » — desktop inchangé.
                    if (isBlankCard(m, tip)) {
                      return (
                        <div key={m.id} className="max-sm:hidden">
                          <HandballMatchCard match={m} onClick={setDetailMatch} tip={tip} />
                        </div>
                      );
                    }
                    return (
                      <HandballMatchCard
                        key={m.id}
                        match={m}
                        onClick={setDetailMatch}
                        tip={tip}
                      />
                    );
                  })}
                </div>
              </>
            )}
          </TabsContent>

          {/* 🔴 2. Live — tableau ligne (demande user : grille cartes → table),
              scores temps réel, mi-temps, arrêts et cotes 1X2. */}
          <TabsContent value="live" className="mt-3">
            {isLoading ? (
              <div className="py-8 text-center text-[#717171]" aria-live="polite">
                Chargement…
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-8 text-center text-[#717171]" aria-live="polite">
                Aucun match en direct
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <HandballTableCaption>
                    Matchs en direct — actualisation auto, clic = analyse
                  </HandballTableCaption>
                  <thead>
                    <tr className="border-b border-[#f0f0f0] text-left text-[#717171]">
                      <th className="py-1.5 pr-2 font-medium">⏱</th>
                      <th className="py-1.5 pr-2 font-medium">Championnat</th>
                      <th className="py-1.5 pr-2 font-medium">Match</th>
                      <th className="px-2 py-1.5 text-right font-medium">Score</th>
                      <th className="px-2 py-1.5 text-right font-medium">MT</th>
                      <th className="px-2 py-1.5 text-right font-medium">Arrêts</th>
                      <th className="px-2 py-1.5 text-right font-medium">1X2</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f0f0f0]">
                    {filtered.map((m) => (
                      <tr
                        key={m.id}
                        tabIndex={0}
                        role="button"
                        aria-label={`Analyse du match ${m.home.name} contre ${m.away.name}`}
                        onClick={() => setDetailMatch(m)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setDetailMatch(m);
                          }
                        }}
                        className="cursor-pointer transition-colors hover:bg-[#fafafa] focus-visible:bg-[#fafafa] outline-none focus-visible:ring-2 focus-visible:ring-[#00e676]"
                      >
                        <td className="py-1.5 pr-2">
                          <span className="inline-block rounded bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white animate-pulse tabular-nums">
                            {m.status === "halftime" ? "MT" : `${m.minute || 0}'`}
                          </span>
                        </td>
                        <td className="py-1.5 pr-2">
                          <HandballLeagueBadge
                            leagueName={m.league.name}
                            country={m.league.country}
                          />
                        </td>
                        <td className="py-1.5 pr-2">
                          <span className="inline-flex min-w-0 items-center gap-1.5">
                            <HandballTeamLogo name={m.home.name} size={16} />
                            <span className="truncate font-medium text-[#222222]">
                              {m.home.name}
                            </span>
                            <span className="text-[#717171]">–</span>
                            <span className="truncate font-medium text-[#222222]">
                              {m.away.name}
                            </span>
                            <HandballTeamLogo name={m.away.name} size={16} />
                          </span>
                        </td>
                        <td className="px-2 py-1.5 text-right font-mono text-sm font-semibold tabular-nums text-[#222222]">
                          {m.score?.home ?? 0} - {m.score?.away ?? 0}
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums text-[#717171]">
                          {m.score?.homeHalf != null && m.score.awayHalf != null
                            ? `${m.score.homeHalf} - ${m.score.awayHalf}`
                            : "—"}
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums text-[#717171]">
                          {m.stats?.homeSaves != null && m.stats.awaySaves != null
                            ? `${m.stats.homeSaves} - ${m.stats.awaySaves}`
                            : "—"}
                        </td>
                        <td className="px-2 py-1.5 text-right font-mono tabular-nums text-[#717171]">
                          {m.odds?.home != null && m.odds.draw != null && m.odds.away != null ? (
                            <span title="Cotes 1X2 (source live)">
                              {m.odds.home.toFixed(2)} / {m.odds.draw.toFixed(2)} /{" "}
                              {m.odds.away.toFixed(2)}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    ))}
</tbody>
                 </table>
               </div>
            )}
          </TabsContent>
        </Tabs>
      </section>

      {/* Widgets en dessous (identiques dans les 3 vues) */}
      <HandballBanker />

      {/* Pronostics Vitibet : Top 10 par INDEX (fenêtre J → J+3) */}
      <HandballVitibetTop10 />

      {/* Backtest Vitibet (zone Vitibet) : taux de réussite des tips FT —
          distinct de HandballBacktestWidget (ROI des stratégies maison). */}
      <HandballVitibetBacktest />

      {/* Backtest ROI visuel (cotes simulées) */}
      <HandballBacktestWidget />

      {/* Matrice backtest 8 marchés × championnats (source DB historique) */}
      <HandballBacktestMatrix />

      {/* Actus handball (5 sources RSS) */}
      <HandballNews />

      {/* Dialog détail (wiring manquant depuis la Phase 6) */}
      {detailMatch && (
        <HandballMatchDetailDialog
          match={detailMatch}
          finished={finished}
          open
          onOpenChange={(open) => {
            if (!open) setDetailMatch(null);
          }}
        />
      )}
    </div>
    </HandballErrorBoundary>
  );
}
