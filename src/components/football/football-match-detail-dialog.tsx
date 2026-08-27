"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy, AlertCircle, TrendingUp, Activity } from "lucide-react";
import type { FootballMatch } from "@/lib/football-data";
import { parisKickoff } from "@/lib/football-time";
import type { MatchTimelineData } from "@/lib/football-timeline";
import { computePredictiveBets, type PredictiveBetsResult } from "@/lib/prediction/predictive-bets-engine";
import { expectedPressureBaseline } from "@/lib/football-live-thresholds";
import { MomentumChart } from "./momentum-chart";
import { PressureDuoDonuts } from "./pressure-duo-donuts";
import { LiveStatsBreakdown } from "./live-stats-breakdown";
import { EditorialInsight } from "@/components/ai/editorial-insight";
import { FootballPressReviewWidget } from "@/components/football/FootballPressReviewWidget";
import { AIMatchReport } from "./AIMatchReport";
import { WatchButton } from "@/components/shared/watch-button";

type StatsResponse = MatchTimelineData & { updatedAt?: string };

type Props = {
  match: FootballMatch | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/** Retrouve le match correspondant dans la liste BSD prematch (par id puis noms). */
function findPrematchFor(
  prem: FootballMatch[],
  target: FootballMatch,
): FootballMatch | null {
  const strip = (s: string) => s.replace(/^bsd-/, "");
  const byId = prem.find((p) => strip(p.id) === strip(target.id));
  if (byId) return byId;
  return (
    prem.find(
      (p) =>
        p.home.name === target.home.name && p.away.name === target.away.name,
    ) ?? null
  );
}

/** Badge de forme (W/D/L). Vert = victoire, bleu = nul, rose = défaite. */
function FormBadge({ r }: { r: "W" | "D" | "L" }) {
  const cls =
    r === "W"
      ? "bg-emerald-500/15 text-emerald-400 ring-emerald-500/30"
      : r === "D"
        ? "bg-sky-500/15 text-sky-400 ring-sky-500/30"
        : "bg-rose-500/15 text-rose-400 ring-rose-500/30";
  return (
    <span
      className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold ring-1 ${cls}`}
    >
      {r}
    </span>
  );
}

/** Ligne comparative 2 colonnes : label + valeur équipe 1 / équipe 2. */
function CompareRow({
  label,
  home,
  away,
}: {
  label: string;
  home: string;
  away: string;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-[11px]">
      <span className="text-right font-semibold tabular-nums text-emerald-400">
        {home}
      </span>
      <span className="text-center text-[11px] uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className="tabular-nums font-semibold text-sky-400">{away}</span>
    </div>
  );
}

/** Case d'un des 3 paris prédictifs (icône + label + prob). */
function BetTile({ bet }: { bet: PredictiveBetsResult["bets"][number] }) {
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-2.5">
      <span className="text-base leading-none" aria-hidden="true">
        {bet.icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[11px] font-semibold text-foreground">
          {bet.label}
        </p>
        <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-emerald-400"
            style={{ width: `${Math.round(bet.prob)}%` }}
          />
        </div>
        <div className="mt-1 flex items-center justify-between gap-1">
          <span className="text-[11px] text-emerald-300 tabular-nums">
            {Math.round(bet.prob)}%
          </span>
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
            {bet.source}
          </span>
        </div>
      </div>
    </div>
  );
}

export function FootballMatchDetailDialog({ match, open, onOpenChange }: Props) {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [prematch, setPrematch] = useState<FootballMatch | null>(null);
  const [error, setError] = useState<string | null>(null);
  // "loading" est dérivé : true tant qu'on attend la première réponse pour le
  // match courant. Évite les setState synchrones en tête d'effect (règle
  // react-hooks/set-state-in-effect).
  const loading = open && match !== null && stats === null && error === null;

  // Vue enrichie : le match prématch BSD (plus riche) si dispo, sinon le fallback.
  const view = prematch ?? match;
  // 3 paris prédictifs — seulement si pas de live connu (prematch).
  const betsResult = useMemo(
    () => (view && !view.live ? computePredictiveBets(view) : null),
    [view],
  );

  // Fetch lazy uniquement à l'ouverture du dialog (ou changement de match).
  useEffect(() => {
    if (!open || !match) return;
    let cancelled = false;
    const matchId = match.id.replace(/^bsd-/, "");
    // Reset dans un microtask (callback) → conforme à set-state-in-effect.
    Promise.resolve().then(() => {
      if (cancelled) return;
      setStats(null);
      setPrematch(null);
      setError(null);
    });

    fetch(`/api/football/matches/${matchId}/stats`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as StatsResponse;
      })
      .then((data) => {
        if (!cancelled) setStats(data);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });

    // Enrichissement best-effort : récupère les données BSD prematch réellement
    // (standingStats, metricStats, forme…) via /api/football/prematch.
    fetch("/api/football/prematch")
      .then((res) => (res.ok ? (res.json() as Promise<{ matches: FootballMatch[] }>) : null))
      .then((data) => {
        if (cancelled || !data?.matches) return;
        const found = findPrematchFor(data.matches, match);
        if (found) setPrematch(found);
      })
      .catch(() => {
        /* best-effort silencieux — on garde le match initial */
      });

    return () => {
      cancelled = true;
    };
  }, [open, match]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
              {match?.league.logo && match.league.logo.startsWith("http") ? (
                <img
                  src={match.league.logo}
                  alt=""
                  className="h-4 w-4 shrink-0 object-contain brightness-125"
                  onError={(e) => { e.currentTarget.style.display = "none"; }}
                />
              ) : (
                <span aria-hidden="true">🏆</span>
              )}
              <span className="truncate font-medium">{view?.league.name}</span>
            </div>
          </DialogTitle>
          <DialogDescription className="sr-only">
            Détails et comparatif du match {view?.home.name} vs {view?.away.name}
          </DialogDescription>
        </DialogHeader>

        {/* L2+L3 — contenu scrollable avec analyse, presse, score, live */}
        <ScrollArea className="max-h-[calc(90vh-80px)] max-h-[calc(90dvh-80px)]">
          <div className="px-6 py-4 space-y-4">
            {/* Analyse éditoriale prédictive — cache 24h, masquée si absent */}
            {view && (
              <EditorialInsight
                sport="football"
                matchId={view.id}
                playerA={view.home.name}
                playerB={view.away.name}
                variant="full"
                className="mb-1"
              />
            )}

            {/* Revue de Presse & Pronostics Médias (3+ sources) */}
            {view && (
              <FootballPressReviewWidget
                matchId={view.id}
                homeTeam={view.home.name}
                awayTeam={view.away.name}
                leagueName={view.league.name}
                className="mt-3"
              />
            )}

            {/* Rapport de match IA (Phase 2) — synthèse + faits + combiné suggéré */}
            {view && !view.live && (
              <AIMatchReport match={view} enabled={open} className="mt-3" />
            )}

            {/* En-tête : logos + score + minute */}
            {view && (
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
                <div className="flex flex-col items-center gap-1.5">
                  <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-muted">
                    {view.home.logo ? (
                      <img src={view.home.logo} alt={view.home.name} className="h-9 w-9 object-contain" />
                    ) : (
                      <Trophy className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  <span className="text-center text-xs font-semibold leading-tight">{view.home.shortName}</span>
                </div>

                <div className="flex flex-col items-center">
                  <div className="flex items-center gap-2">
                    <span className="text-3xl font-black tabular-nums">{view.live?.homeScore ?? 0}</span>
                    <span className="text-xl text-muted-foreground">:</span>
                    <span className="text-3xl font-black tabular-nums">{view.live?.awayScore ?? 0}</span>
                  </div>
                  {view.live ? (
                    <span className="mt-0.5 text-[11px] font-bold uppercase tracking-wider text-rose-500">
                      {view.live.status === "HT" ? "MI-TEMPS" : `${view.live.minute}'`}
                    </span>
                  ) : (
                    <span className="mt-0.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Prématch · {parisKickoff(view.scheduledAt)}
                    </span>
                  )}
                </div>

                <div className="flex flex-col items-center gap-1.5">
                  <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-muted">
                    {view.away.logo ? (
                      <img src={view.away.logo} alt={view.away.name} className="h-9 w-9 object-contain" />
                    ) : (
                      <Trophy className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  <span className="text-center text-xs font-semibold leading-tight">{view.away.shortName}</span>
                </div>
              </div>
            )}

            {/* Visionner (LiveTV) — uniquement si le match est un direct. */}
            {view?.live && (
              <div className="mt-3 flex justify-center">
                <WatchButton
                  sport="football"
                  home={view.home.shortName || view.home.name}
                  away={view.away.shortName || view.away.name}
                  label="Visionner en direct"
                  variant="default"
                />
              </div>
            )}

        {/* ---------- CORPS : PRÉMATCH → comparatif + 3 paris ---------- */}
        {view && !view.live && (
          <div className="mt-4 space-y-4">
            {/* Panneau comparatif Équipe 1 (dom) vs Équipe 2 (ext) */}
            <section className="rounded-2xl border border-border/60 bg-card p-3.5">
              <header className="mb-3 flex items-center justify-between gap-2">
                <h3 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  <Activity className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
                  Comparatif pre-match
                </h3>
                {view.prediction.model && (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] uppercase tracking-wider text-muted-foreground">
                    {view.prediction.model}
                  </span>
                )}
              </header>

              <div className="space-y-2">
                {/* Classement + forme */}
                <div className="grid grid-cols-2 gap-3">
                  <Column label={view.home.shortName} variant="home">
                    {resolveForm(view.home.form, view.prediction.standingStats?.home).length > 0 ? (
                      resolveForm(view.home.form, view.prediction.standingStats?.home).map((f, i) => (
                        <FormBadge key={i} r={f} />
                      ))
                    ) : (
                      <span className="text-[11px] text-muted-foreground">Forme —</span>
                    )}
                  </Column>
                  <Column label={view.away.shortName} variant="away">
                    {resolveForm(view.away.form, view.prediction.standingStats?.away).length > 0 ? (
                      resolveForm(view.away.form, view.prediction.standingStats?.away).map((f, i) => (
                        <FormBadge key={i} r={f} />
                      ))
                    ) : (
                      <span className="text-[11px] text-muted-foreground">Forme —</span>
                    )}
                  </Column>
                </div>
                <div className="h-px bg-muted" />

                {/* Bilan général : rang, MJ, Pts, PPG */}
                {view.prediction.standingStats ? (
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <StandingCell
                      label="Pts"
                      home={view.prediction.standingStats.home.points.toString()}
                      away={view.prediction.standingStats.away.points.toString()}
                    />
                    <StandingCell
                      label="PPG"
                      home={view.prediction.standingStats.home.ppg.toFixed(2)}
                      away={view.prediction.standingStats.away.ppg.toFixed(2)}
                    />
                    <StandingCell
                      label="Rang (dom/ext)"
                      home={`${view.prediction.standingStats.home.rank}/${view.prediction.standingStats.home.rankTotal}`}
                      away={`${view.prediction.standingStats.away.rank}/${view.prediction.standingStats.away.rankTotal}`}
                    />
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-1 rounded-lg bg-muted/30 py-2 text-[11px] text-muted-foreground">
                    <AlertCircle className="h-3 w-3" />
                    Classement indisponible
                  </div>
                )}
                <div className="h-px bg-muted" />

                {/* Attaque & défense : buts marqués/encaissés, xG, corners/SOT si dispo */}
                <CompareRow
                  label="Buts marqués / match"
                  home={fmtMetric(view.prediction.metricStats?.home.goals.scoredPg)}
                  away={fmtMetric(view.prediction.metricStats?.away.goals.scoredPg)}
                />
                <CompareRow
                  label="Buts encaissés / match"
                  home={fmtMetric(view.prediction.metricStats?.home.goals.concededPg)}
                  away={fmtMetric(view.prediction.metricStats?.away.goals.concededPg)}
                />
                {view.prediction.xGa && (
                  <CompareRow
                    label="xG (attendu)"
                    home={view.prediction.xGa.home.toFixed(2)}
                    away={view.prediction.xGa.away.toFixed(2)}
                  />
                )}
                {view.prediction.metricStats?.home?.shots?.for?.value != null && (
                  <CompareRow
                    label="Tirs / match"
                    home={fmtMetric(view.prediction.metricStats.home.shots.for)}
                    away={fmtMetric(view.prediction.metricStats.away.shots.for)}
                  />
                )}
                {view.prediction.metricStats?.home?.sot?.for?.value != null && (
                  <CompareRow
                    label="Tirs cadrés / match"
                    home={fmtMetric(view.prediction.metricStats.home.sot.for)}
                    away={fmtMetric(view.prediction.metricStats.away.sot.for)}
                  />
                )}
                {view.prediction.metricStats?.home?.corners?.total?.value != null && (
                  <CompareRow
                    label="Corners / match"
                    home={fmtMetric(view.prediction.metricStats.home.corners.total)}
                    away={fmtMetric(view.prediction.metricStats.away.corners.total)}
                  />
                )}
              </div>
            </section>

            {/* 3 paris prédictifs */}
            {betsResult && betsResult.bets.length > 0 && (
              <section className="rounded-2xl border border-border/60 bg-card p-3.5">
                <header className="mb-2.5 flex items-center justify-between gap-2">
                  <h3 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    <TrendingUp className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
                    3 paris prédictifs
                  </h3>
                  <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-300 ring-1 ring-emerald-500/20">
                    Confiance {betsResult.confidence}%
                  </span>
                </header>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {betsResult.bets.map((bet, i) => (
                    <BetTile key={i} bet={bet} />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {/* ---------- Corps : graphe momentum (live) ---------- */}
        {view && view.live && (
          <div className="mt-2">
            {loading && (
              <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-[110px] w-full rounded-lg" />
                <Skeleton className="h-3 w-full" />
              </div>
            )}

            {!loading && error && (
              <div className="flex h-[110px] flex-col items-center justify-center gap-2 rounded-lg bg-muted/40 text-center text-xs text-muted-foreground">
                <AlertCircle className="h-5 w-5 text-rose-400" />
                Momentum indisponible ({error})
              </div>
            )}

            {!loading && !error && stats && (
              <MomentumChart
                momentum={stats.momentum}
                events={stats.events}
                dangerous={stats.dangerous}
                layers={stats.layers}
                pressure={stats.pressure}
                liveStats={view?.live && view.live.homeShotsOnTarget !== null && view.live.awayShotsOnTarget !== null && view.live.homeCorners !== null && view.live.awayCorners !== null ? {
                  homeSOT: view.live.homeShotsOnTarget,
                  awaySOT: view.live.awayShotsOnTarget,
                  homeCorners: view.live.homeCorners,
                  awayCorners: view.live.awayCorners,
                } : undefined}
                homeName={view?.home.shortName ?? "Domicile"}
                awayName={view?.away.shortName ?? "Extérieur"}
              />
            )}
          </div>
        )}

        {/* ---------- Corps : pression LIVE vs ATTENDU + stats live ---------- */}
        {view && view.live && (
          <div className="mt-3 space-y-3">
            {!loading && !error && stats && (
              <PressureDuoDonuts
                live={stats.pressure}
                avg={expectedPressureBaseline(view.prediction.homeProb, view.prediction.drawProb)}
                homeName={view.home.shortName ?? "Domicile"}
                awayName={view.away.shortName ?? "Extérieur"}
              />
            )}
            <LiveStatsBreakdown
              live={view.live}
              homeName={view.home.shortName ?? "Domicile"}
              awayName={view.away.shortName ?? "Extérieur"}
              prematch={{ homeProb: view.prediction.homeProb, drawProb: view.prediction.drawProb }}
              homePressurePct={!loading && !error && stats ? stats.pressure.homePct : null}
            />
          </div>
        )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Petits composants internes du panneau comparatif
// ---------------------------------------------------------------------------

/** Bandeau de forme retenu : priorité à `form` (si non vide), sinon dérivé
 * du bilan standing (W/D/L) pour éviter l'écran vide quand le match BSD n'a
 * pas la liste de forme. */
function resolveForm(
  form: ("W" | "D" | "L")[] | undefined,
  standing: { wins: number; draws: number; losses: number } | undefined,
): ("W" | "D" | "L")[] {
  if (form && form.length > 0) return form;
  if (!standing) return [];
  const total = standing.wins + standing.draws + standing.losses;
  if (total === 0) return [];
  return [
    ...Array(standing.wins).fill("W" as const),
    ...Array(standing.draws).fill("D" as const),
    ...Array(standing.losses).fill("L" as const),
  ].slice(0, 5);
}

/** Colonne d'un camp (home = emerald, away = sky). */
function Column({
  label,
  variant,
  children,
}: {
  label: string;
  variant: "home" | "away";
  children: React.ReactNode;
}) {
  return (
    <div
      className={`flex min-w-0 flex-col items-center gap-1.5 rounded-lg border p-2 ${
        variant === "home"
          ? "border-emerald-500/20 bg-emerald-500/5"
          : "border-sky-500/20 bg-sky-500/5"
      }`}
    >
      <span
        className={`truncate text-[11px] font-bold uppercase tracking-wider ${
          variant === "home" ? "text-emerald-400" : "text-sky-400"
        }`}
      >
        {label}
      </span>
      <div className="flex items-center justify-center gap-1">
        {children}
      </div>
    </div>
  );
}

/** Cellule de bilan (Pts / PPG / Rang) — valeur home à gauche, away à droite. */
function StandingCell({
  label,
  home,
  away,
}: {
  label: string;
  home: string;
  away: string;
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-muted/30 px-1.5 py-1.5">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <div className="mt-0.5 flex items-center justify-center gap-1.5 text-[11px] font-bold tabular-nums">
        <span className="text-emerald-400">{home}</span>
        <span className="text-[11px] text-muted-foreground">·</span>
        <span className="text-sky-400">{away}</span>
      </div>
    </div>
  );
}

/** Formate une MetricValue en string ("—" si null). */
function fmtMetric(v: { value: number | null } | undefined): string {
  if (!v || v.value == null) return "—";
  return `${Math.round(v.value * 100) / 100}`;
}