"use client";

import { useState, useMemo, useEffect } from "react";
import useSWR from "swr";
import { useHandballMatches } from "@/hooks/use-handball-matches";
import { useVitibetTips } from "@/hooks/use-vitibet-tips";
import { useHandballTop8, type StrategyChip } from "@/hooks/use-handball-top8";
import { HandballMatchCard } from "./handball-match-card";
import { HandballLiveCard } from "./handball-live-card";
import { HandballMatchDetailDialog } from "./handball-match-detail-dialog";
import { HandballFilters } from "./handball-filters";
import { HandballStrategyBar } from "./handball-strategy-bar";
import { HandballTop8Widget } from "./handball-top8-widget";
import { HandballVitibetTop10 } from "./handball-vitibet-top10";
import { HandballVitibetBacktest } from "./handball-vitibet-backtest";
import { HandballBacktestWidget } from "./handball-backtest-widget";
import { HandballBacktestMatrix } from "./handball-backtest-matrix";
import { HandballBanker } from "./handball-banker";
import { HandballCalendar } from "./handball-calendar";
import { HandballNews } from "./handball-news";
import { HandballTableCaption } from "./handball-table-caption";
import { HandballErrorBoundary } from "./handball-error-boundary";
import type { HandballStrategyKey } from "@/lib/handball-strategy-top8";
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

const fmtSigned = (v: number, digits = 1): string => {
  const s = v.toFixed(digits);
  return v > 0 ? `+${s}` : s;
};

const fmtDayLabel = (isoDate: string): string =>
  PARIS_DAY_LONG_FMT.format(new Date(`${isoDate}T00:00:00Z`));

type ResultsTodayPayload = {
  date: string;
  matches: HandballMatch[];
  source: string;
  scrapedAt: string | null;
  stale?: boolean;
  count: number;
};

type BacktestTodayPayload = DailyStrategyBacktest & { source: "file" | "live" };

/**
 * Mode 📆 Résultats du jour : backtest des 8 stratégies sur la journée +
 * liste des matchs terminés (Europe/Paris). Chaque ligne ouvre la popup
 * d'analyse (stats) comme le calendrier prematch.
 */
function HandballResultsToday({ onOpenMatch }: { onOpenMatch: (m: HandballMatch) => void }) {
  const { data: results, error: resultsError, isLoading: resultsLoading } =
    useSWR<ResultsTodayPayload>("/api/handball/results-today", fetchJson, {
      refreshInterval: 5 * 60_000,
      dedupingInterval: 2 * 60_000,
      revalidateOnFocus: false,
    });
  const { data: backtest, error: btError, isLoading: btLoading } =
    useSWR<BacktestTodayPayload>("/api/handball/backtest-today", fetchJson, {
      dedupingInterval: 15 * 60_000,
      revalidateOnFocus: false,
    });

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

      {/* Liste des résultats du jour */}
      <section className="space-y-2">
        <div className="flex flex-wrap items-baseline gap-2">
          <h3 className="text-sm font-semibold text-[#222222]">📆 Résultats du jour</h3>
          {results && (
            <span className="text-xs text-[#717171]">
              {results.count} match(s) terminé(s)
            </span>
          )}
        </div>

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
            Aucun résultat aujourd&apos;hui
          </div>
        ) : (
          <>
            {results.stale && (
              <p className="text-[11px] font-medium text-amber-500">
                ⚠️ Snapshot Flashscore de plus de 20h — résultats potentiellement incomplets.
              </p>
            )}
            <ul className="space-y-2">
              {results.matches.map((m) => (
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
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block font-mono text-sm font-semibold tabular-nums text-[#222222]">
                        {m.score?.home ?? 0} - {m.score?.away ?? 0}
                      </span>
                      {m.score?.homeHalf != null && m.score.awayHalf != null && (
                        <span className="block text-[11px] tabular-nums text-[#717171]">
                          MT {m.score.homeHalf} - {m.score.awayHalf}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
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
  const [mode, setMode] = useState<"live" | "prematch" | "results">("prematch");
  const [selectedLeague, setSelectedLeague] = useState<string | null>(null);
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
  const filtered = useMemo(
    () =>
      selectedLeague
        ? displayed.filter((m) => m.league.name === selectedLeague)
        : displayed,
    [displayed, selectedLeague],
  );
  // Matchs terminés du snapshot → forme récente + lambdas ajustés du dialog détail.
  const finished = useMemo(
    () => allMatches.filter((m) => m.status === "finished"),
    [allMatches],
  );

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

  return (
    <HandballErrorBoundary>
    <div className="space-y-6">
      {/* Header live/prematch/results */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setMode("live")}
          className={
            mode === "live"
              ? "bg-red-500 text-white px-3 py-1.5 rounded"
              : "px-3 py-1.5 rounded border"
          }
        >
          🔴 Live ({live.length})
        </button>
        <button
          onClick={() => setMode("prematch")}
          className={
            mode === "prematch"
              ? "bg-foreground text-background px-3 py-1.5 rounded"
              : "px-3 py-1.5 rounded border"
          }
        >
          📅 À venir
        </button>
        <button
          onClick={() => setMode("results")}
          className={
            mode === "results"
              ? "bg-foreground text-background px-3 py-1.5 rounded"
              : "px-3 py-1.5 rounded border"
          }
        >
          📆 Résultats du jour ({resultsToday.length})
        </button>
      </div>

      {/* Widgets du haut : identiques dans les 3 modes (live/prematch/results) —
          Banker, stratégie + Top 8 et backtest historique restent visibles. */}
      <HandballBanker />

      {/* Stratégie selector + Top 8 */}
      <div className="space-y-3">
        <HandballStrategyBar active={strategy} onChange={setStrategy} />
        <HandballTop8Widget strategy={strategy} />
      </div>

      {/* Pronostics Vitibet : Top 10 par INDEX (fenêtre J → J+3) */}
      <HandballVitibetTop10 />

      {/* Backtest Vitibet (zone Vitibet) : taux de réussite des tips FT —
          distinct de HandballBacktestWidget (ROI des stratégies maison). */}
      <HandballVitibetBacktest />

      {/* Backtest ROI visuel (cotes simulées) */}
      <HandballBacktestWidget />

      {/* Matrice backtest 8 marchés × championnats (source DB historique) */}
      <HandballBacktestMatrix />

      {/* Actus handball (4 sources RSS : HandNews, Handball Planet, L'Équipe, Eurosport) */}
      <HandballNews />

      {mode === "results" ? (
        /* Panneau résultats : backtest du jour + scores (les filtres ligues et le
           calendrier n'ont pas de sens sur des matchs terminés). */
        <HandballResultsToday onOpenMatch={setDetailMatch} />
      ) : (
        <>
          {/* Filtres ligues */}
          <HandballFilters
            matches={displayed}
            selected={selectedLeague}
            onSelect={setSelectedLeague}
          />

          {/* Calendrier (prematch seulement) — lignes cliquables → popup analyse,
              pastilles « Top stratégies ≥60 % » sous chaque ligne */}
          {mode === "prematch" && filtered.length > 0 && (
            <HandballCalendar
              matches={filtered}
              chipsByMatch={chipsByMatch}
              onSelect={setDetailMatch}
            />
          )}

          {/* Grille de matchs */}
          {isLoading ? (
            // État async annoncé aux lecteurs d'écran
            <div className="text-center py-8 text-[#717171]" aria-live="polite">
              Chargement…
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8 text-[#717171]" aria-live="polite">
              Aucun match handball
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {filtered.map((m) =>
                mode === "live" ? (
                  <HandballLiveCard key={m.id} match={m} onClick={setDetailMatch} />
                ) : (
                  <HandballMatchCard key={m.id} match={m} onClick={setDetailMatch} tip={tipFor(m)} />
                ),
              )}
            </div>
          )}
        </>
      )}

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
