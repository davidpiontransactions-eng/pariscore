"use client";

import { useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, Map as MapIcon, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { hltvStars, teamInitials, canonMapName, type Cs2Match } from "@/lib/cs2/types";
import { getFlagUrl } from "@/lib/flag-utils";
import { useCs2Enrichment } from "@/hooks/use-cs2-enrichment";
import { buildCs2Prediction, buildCs2TeamModels } from "@/lib/cs2/predict-adapter";
import {
  simulateVeto,
  simulateSingleMapSequence,
  ACTIVE_MAP_POOL,
  type VetoStep,
} from "@/lib/prediction/cs2/cs2-predictive-ml-engine";
import { CS2MapPoolAnalytics } from "./CS2MapPoolAnalytics";

type Props = {
  match: Cs2Match | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function pct(x: number | null | undefined): string {
  if (x == null) return "—";
  return `${Math.round(x * 100)}%`;
}

function stars(count: number): string {
  return "★".repeat(Math.max(0, count)) + "☆".repeat(Math.max(0, 5 - count));
}

/** Rôle estimé par palier de rating (heuristique documentée, pas un champ source). */
function roleFromRating(r: number | null | undefined): string {
  if (r == null) return "—";
  if (r >= 1.15) return "Star";
  if (r >= 1.0) return "Rifler";
  return "Support";
}

function TeamCrest({ name, logo, country }: { name: string; logo?: string | null; country?: string | null }) {
  return (
    <div className="relative shrink-0">
      <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-white/5 ring-1 ring-white/10">
        {logo ? (
          <img src={logo} alt={name} className="h-10 w-10 object-contain" />
        ) : (
          <span className="text-sm font-bold text-zinc-400">{teamInitials(name)}</span>
        )}
      </div>
      {country && (
        <img
          src={getFlagUrl(country, 20, 15)}
          alt={country}
          className="absolute -bottom-1 -right-1 h-3.5 w-5 rounded-sm object-cover ring-1 ring-black"
        />
      )}
    </div>
  );
}

// ─── Veto ────────────────────────────────────────────────────────────────────

function vetoActionLabel(action: string): string {
  if (action === "ban") return "removed";
  if (action === "pick") return "picked";
  return "Decider";
}

/** Normalise la séquence veto réelle BSD (forme map_picks inconnue) en VetoStep[]. */
function normalizeRealVeto(raw: unknown, t1Name: string, t2Name: string): VetoStep[] {
  if (!Array.isArray(raw)) return [];
  const out: VetoStep[] = [];
  (raw as Record<string, unknown>[]).forEach((s, i) => {
    const rawMap = (s.map ?? s.map_name ?? s.name) as string | undefined;
    const map = canonMapName(rawMap ?? null);
    if (!map) return;
    const actorRaw = String(s.team ?? s.team_name ?? s.side ?? "").toLowerCase();
    const action = String(s.action ?? "ban").toLowerCase();
    const actor: "team1" | "team2" =
      actorRaw && t1Name.toLowerCase().includes(actorRaw)
        ? "team1"
        : actorRaw && t2Name.toLowerCase().includes(actorRaw)
          ? "team2"
          : i % 2 === 0
            ? "team1"
            : "team2";
    out.push({
      step: i + 1,
      actor,
      action: action === "pick" ? "pick" : action === "decider" ? "decider" : "ban",
      map,
      rationale: "",
    });
  });
  return out;
}

function VetoList({ order, t1Name, t2Name }: { order: VetoStep[]; t1Name: string; t2Name: string }) {
  return (
    <div className="space-y-1">
      {order.map((s) => {
        const actor = s.actor === "team1" ? t1Name : t2Name;
        const isPick = s.action === "pick";
        const isDecider = s.action === "decider";
        return (
          <div
            key={s.step}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-1.5 text-xs",
              isPick && "bg-[#00E676]/10 text-[#00E676]",
              !isPick && !isDecider && "bg-red-500/5 text-red-300/80",
              isDecider && "bg-amber-500/10 text-amber-300",
            )}
          >
            <span className="w-5 shrink-0 font-mono text-zinc-500">{s.step}.</span>
            <span className="font-semibold">{actor}</span>
            <span className="text-zinc-400">{vetoActionLabel(s.action)}</span>
            <span className="font-bold">{s.map}</span>
            {isDecider && <span className="text-zinc-500">(decider)</span>}
          </div>
        );
      })}
    </div>
  );
}

// ─── MR12 ────────────────────────────────────────────────────────────────────

function Mr12Row({ winners, t1Name, t2Name }: { winners: ("t1" | "t2")[]; t1Name: string; t2Name: string }) {
  const half1 = winners.slice(0, 12);
  const half2 = winners.slice(12, 24);
  const renderCells = (cells: ("t1" | "t2")[], offset: number) =>
    cells.map((w, i) => (
      <span
        key={i + offset}
        title={`Round ${i + 1 + offset}`}
        className={cn(
          "h-5 w-5 rounded-[4px]",
          w === "t1" ? "bg-orange-500/70" : "bg-blue-500/70",
          (i === 0 || i + offset === 12) && "ring-1 ring-white/40", // pistol round
        )}
      />
    ));
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[10px] text-zinc-500">
        <span>{t1Name} (CT)</span>
        <span>1ère mi-temps</span>
        <span>{t2Name} (T)</span>
      </div>
      <div className="flex flex-wrap gap-1">{renderCells(half1, 0)}</div>
      <div className="flex items-center justify-between text-[10px] text-zinc-500">
        <span>{t1Name} (T)</span>
        <span>2ème mi-temps</span>
        <span>{t2Name} (CT)</span>
      </div>
      <div className="flex flex-wrap gap-1">{renderCells(half2, 12)}</div>
    </div>
  );
}

// ─── Composant principal ─────────────────────────────────────────────────────

export function HLTVMatchSheetModal({ match, open, onOpenChange }: Props) {
  const { enrichment, mapLikelihood, veto, isLoading, error } = useCs2Enrichment(
    match?.team1.name,
    match?.team2.name,
    match?.current_map,
    match?.id,
  );

  const prediction = useMemo(() => {
    if (!enrichment || !match) return null;
    return buildCs2Prediction(enrichment, (match.best_of as 1 | 3 | 5) ?? 3);
  }, [enrichment, match]);

  const vetoSteps = useMemo(() => {
    if (!match) return [];
    const real = normalizeRealVeto(veto, match.team1.name, match.team2.name);
    if (real.length > 0) return real;
    const models = enrichment ? buildCs2TeamModels(enrichment) : null;
    if (!models) return [];
    return simulateVeto(models.team1, models.team2, [...ACTIVE_MAP_POOL], (match.best_of as 1 | 3 | 5) ?? 3).order;
  }, [enrichment, veto, match]);

  const isRealVeto = useMemo(() => {
    if (!match) return false;
    return normalizeRealVeto(veto, match.team1.name, match.team2.name).length > 0;
  }, [veto, match]);

  const mr12Projection = useMemo(() => {
    if (!prediction || prediction.predictedMaps.length === 0) return null;
    const top = prediction.predictedMaps[0];
    return simulateSingleMapSequence(top.winProb1, top.ctBias, top.pistolT1, top.pistolT2, 42);
  }, [prediction]);

  const matchStars = match
    ? Math.max(hltvStars(match.team1.hltv_rank), hltvStars(match.team2.hltv_rank))
    : 0;
  const isLive = Boolean(match?.is_live || match?.status === "live");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto border-white/10 bg-[#12121C]">
        <DialogHeader>
          <DialogTitle className="sr-only">
            {match ? `${match.team1.name} vs ${match.team2.name}` : "Fiche match"}
          </DialogTitle>
          {match && (
            <div>
              <div className="mb-2 flex items-center justify-center gap-2 text-[11px] text-zinc-500">
                {match.tournament_logo ? (
                  <img src={match.tournament_logo} alt="" className="h-4 w-4 object-contain" />
                ) : (
                  <Trophy className="h-3.5 w-3.5" />
                )}
                <span>{match.tournament ?? "CS2"}</span>
                {match.best_of ? <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px]">BO{match.best_of}</span> : null}
                {matchStars > 0 && <span className="text-amber-400">{stars(matchStars)}</span>}
                {isLive && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#00E676]/10 px-2 py-0.5 text-[10px] font-bold text-[#00E676]">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#00E676] opacity-75" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#00E676]" />
                    </span>
                    LIVE
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between gap-4">
                <div className="flex flex-1 items-center justify-end gap-3">
                  <div className="text-right">
                    <p className="text-base font-bold text-white">{match.team1.name}</p>
                    {match.team1.hltv_rank ? (
                      <p className="text-[11px] text-zinc-500">HLTV #{match.team1.hltv_rank}</p>
                    ) : null}
                  </div>
                  <TeamCrest name={match.team1.name} logo={match.team1.logo} country={match.team1.country} />
                </div>

                <div className="shrink-0 text-center">
                  {isLive && match.maps_score ? (
                    <span className="font-mono text-2xl font-bold tabular-nums text-[#00E676]">
                      {match.maps_score.team1 ?? 0}–{match.maps_score.team2 ?? 0}
                    </span>
                  ) : (
                    <span className="text-sm font-bold text-zinc-600">VS</span>
                  )}
                  {isLive && match.current_map && (
                    <p className="mt-1 flex items-center justify-center gap-1 text-[10px] text-zinc-500">
                      <MapIcon className="h-3 w-3" /> {match.current_map}
                    </p>
                  )}
                </div>

                <div className="flex flex-1 items-center gap-3">
                  <TeamCrest name={match.team2.name} logo={match.team2.logo} country={match.team2.country} />
                  <div>
                    <p className="text-base font-bold text-white">{match.team2.name}</p>
                    {match.team2.hltv_rank ? (
                      <p className="text-[11px] text-zinc-500">HLTV #{match.team2.hltv_rank}</p>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogHeader>

        {isLoading && !enrichment ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
          </div>
        ) : (
          <Tabs defaultValue="apercu" className="mt-2">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="apercu">Aperçu</TabsTrigger>
              <TabsTrigger value="rosters">Rosters</TabsTrigger>
              <TabsTrigger value="mappool">Map Pool &amp; H2H</TabsTrigger>
            </TabsList>

            {/* ── Aperçu : veto + marchés + MR12 ── */}
            <TabsContent value="apercu" className="space-y-6 pt-4">
              {/* Veto */}
              <section>
                <h3 className="mb-2 text-sm font-semibold text-white">Veto — pick &amp; ban</h3>
                {vetoSteps.length > 0 ? (
                  <>
                    <VetoList order={vetoSteps} t1Name={match!.team1.name} t2Name={match!.team2.name} />
                    <p className="mt-1.5 text-[10px] text-zinc-600">
                      {isRealVeto
                        ? "Séquence veto réelle (BSD map_picks)."
                        : "Simulation rationnelle du veto (ban meilleure carte adverse, pick avantage maximal)."}
                    </p>
                  </>
                ) : mapLikelihood && mapLikelihood.ok && mapLikelihood.predicted_map ? (
                  <p className="rounded-md bg-white/[0.03] px-3 py-2 text-xs text-zinc-400">
                    Carte la plus probable (co-play 180j) :{" "}
                    <span className="font-bold text-white">{mapLikelihood.predicted_map}</span>
                    {mapLikelihood.predicted_expected_rounds
                      ? ` — ~${mapLikelihood.predicted_expected_rounds} rounds attendus`
                      : ""}
                  </p>
                ) : (
                  <p className="text-xs text-zinc-500">Données veto indisponibles.</p>
                )}
              </section>

              {/* Marchés prédictifs */}
              {prediction && (
                <section>
                  <h3 className="mb-2 text-sm font-semibold text-white">🧠 Marchés prédictifs</h3>
                  <div className="space-y-3">
                    <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
                      <p className="mb-2 text-[11px] uppercase tracking-wide text-zinc-500">Vainqueur du match</p>
                      <div className="flex h-2 overflow-hidden rounded-full bg-white/5">
                        <div className="bg-orange-500/80" style={{ width: `${prediction.winProb1 * 100}%` }} />
                        <div className="bg-blue-500/80" style={{ width: `${prediction.winProb2 * 100}%` }} />
                      </div>
                      <div className="mt-1.5 flex justify-between text-xs">
                        <span className="text-orange-400">
                          {match!.team1.name} <b>{pct(prediction.winProb1)}</b>
                        </span>
                        <span className="text-blue-400">
                          <b>{pct(prediction.winProb2)}</b> {match!.team2.name}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {prediction.mapWinnerMarkets.map((m) => (
                        <div key={m.map} className="rounded-lg border border-white/5 bg-white/[0.02] p-2.5">
                          <p className="mb-1 text-[10px] uppercase tracking-wide text-zinc-500">Vainqueur {m.map}</p>
                          <div className="flex h-1.5 overflow-hidden rounded-full bg-white/5">
                            <div className="bg-orange-500/80" style={{ width: `${m.team1 * 100}%` }} />
                            <div className="bg-blue-500/80" style={{ width: `${m.team2 * 100}%` }} />
                          </div>
                          <p className="mt-1 text-[11px]">
                            <span className="text-orange-400">{pct(m.team1)}</span>
                            <span className="text-zinc-600"> / </span>
                            <span className="text-blue-400">{pct(m.team2)}</span>
                          </p>
                        </div>
                      ))}
                    </div>

                    {/* Over/Under par map */}
                    <div className="space-y-1.5">
                      <p className="text-[11px] uppercase tracking-wide text-zinc-500">Over/Under rounds (≥65% confiance)</p>
                      {prediction.predictedMaps.slice(0, 5).map((m) => (
                        <div key={m.map} className="flex items-center justify-between rounded-md bg-white/[0.02] px-3 py-1.5 text-xs">
                          <span className="text-zinc-300">{m.map}</span>
                          <span className="text-zinc-500">moy. {m.expectedRounds} rounds</span>
                          {m.overSignal ? (
                            <span
                              className={cn(
                                "rounded px-2 py-0.5 text-[10px] font-bold",
                                m.overSignal === "OVER" && "bg-[#00E676]/10 text-[#00E676]",
                                m.overSignal === "UNDER" && "bg-blue-500/10 text-blue-400",
                              )}
                            >
                              {m.overSignal} {m.overLine} ({pct(m.overConfidence)})
                            </span>
                          ) : (
                            <span className="text-[10px] text-zinc-600">—</span>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Handicap rounds (map la plus probable) */}
                    {prediction.predictedMaps[0] && (
                      <div className="rounded-md bg-white/[0.02] px-3 py-1.5 text-xs">
                        <span className="text-zinc-500">
                          Handicap rounds {prediction.predictedMaps[0].map} :{" "}
                        </span>
                        <span className="font-semibold text-zinc-300">
                          {match!.team1.name}{" "}
                          {prediction.predictedMaps[0].handicapRounds >= 0 ? "+" : ""}
                          {prediction.predictedMaps[0].handicapRounds.toFixed(1)}
                        </span>
                        <span className="ml-1 text-zinc-600">(rounds, moy. simulée)</span>
                      </div>
                    )}

                    {/* Handicaps maps */}
                    {prediction.handicapMaps.length > 0 && (
                      <div className="flex gap-2">
                        {prediction.handicapMaps.map((h, i) => (
                          <div key={i} className="flex-1 rounded-md bg-white/[0.02] px-3 py-1.5 text-xs">
                            <span className="font-semibold text-zinc-300">
                              {h.side === "team1" ? match!.team1.name : match!.team2.name} {h.line}
                            </span>
                            <span className="ml-2 text-zinc-500">{pct(h.prob)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </section>
              )}

              {/* MR12 */}
              {isLive && match?.round_score ? (
                <section>
                  <h3 className="mb-2 text-sm font-semibold text-white">MR12 — score round</h3>
                  <div className="flex items-center justify-center gap-3 rounded-lg border border-white/5 bg-white/[0.02] p-3">
                    <span className="rounded bg-sky-500/20 px-2 py-1 text-[10px] font-bold text-sky-400">CT</span>
                    <span className="font-mono text-2xl font-bold tabular-nums text-orange-400">
                      {match.round_score.team1 ?? 0}
                    </span>
                    <span className="text-zinc-600">:</span>
                    <span className="font-mono text-2xl font-bold tabular-nums text-blue-400">
                      {match.round_score.team2 ?? 0}
                    </span>
                    <span className="rounded bg-amber-500/20 px-2 py-1 text-[10px] font-bold text-amber-400">T</span>
                  </div>
                </section>
              ) : null}

              {/* Projection round-by-round */}
              {mr12Projection && prediction && (
                <section>
                  <h3 className="mb-2 text-sm font-semibold text-white">
                    MR12 — projection {prediction.predictedMaps[0].map}
                    <span className="ml-2 text-[10px] font-normal text-zinc-600">(Monte-Carlo, 1 déroulement type)</span>
                  </h3>
                  <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
                    <Mr12Row
                      winners={mr12Projection.winners}
                      t1Name={match!.team1.name}
                      t2Name={match!.team2.name}
                    />
                    <p className="mt-2 text-center font-mono text-sm tabular-nums text-zinc-300">
                      {mr12Projection.score1} – {mr12Projection.score2}
                    </p>
                  </div>
                </section>
              )}

              {error && <p className="text-xs text-red-400">Erreur enrichissement : {error}</p>}
            </TabsContent>

            {/* ── Rosters ── */}
            <TabsContent value="rosters" className="space-y-6 pt-4">
              {enrichment ? (
                <>
                  {[
                    { team: enrichment.team1, side: "t1" as const },
                    { team: enrichment.team2, side: "t2" as const },
                  ].map(({ team, side }) => (
                    <section key={side}>
                      <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-white">
                        <span className={cn("h-2.5 w-2.5 rounded-full", side === "t1" ? "bg-orange-500" : "bg-blue-500")} />
                        {team.name}
                        {team.roster_strength != null && (
                          <span className="text-[11px] font-normal text-zinc-500">
                            force {team.roster_strength}/100
                          </span>
                        )}
                      </h3>
                      <div className="space-y-1">
                        {team.players.length ? (
                          team.players.slice(0, 5).map((p, i) => (
                            <div key={i} className="flex items-center gap-3 rounded-md border border-white/5 bg-white/[0.02] px-3 py-2 text-xs">
                              <span className="w-5 font-mono text-zinc-600">{i + 1}</span>
                              <span className="flex-1 font-medium text-zinc-200">{p.name}</span>
                              <span className="w-14 text-right text-[10px] text-zinc-500">{roleFromRating(p.rating)}</span>
                              <span className="w-14 text-right font-mono text-zinc-300">
                                {p.rating != null ? p.rating.toFixed(2) : "—"}
                              </span>
                              <span className="hidden w-16 text-right text-zinc-500 sm:block">
                                ADR {p.adr != null ? p.adr.toFixed(0) : "—"}
                              </span>
                              <span className="hidden w-16 text-right text-zinc-500 sm:block">
                                KAST {p.kast != null ? p.kast.toFixed(0) : "—"}%
                              </span>
                            </div>
                          ))
                        ) : (
                          <p className="text-xs text-zinc-500">Roster indisponible.</p>
                        )}
                      </div>
                    </section>
                  ))}
                </>
              ) : (
                <p className="text-xs text-zinc-500">Chargement des rosters…</p>
              )}
            </TabsContent>

            {/* ── Map Pool & H2H ── */}
            <TabsContent value="mappool" className="pt-4">
              {enrichment ? (
                <CS2MapPoolAnalytics enrichment={enrichment} />
              ) : (
                <p className="text-xs text-zinc-500">Chargement du map pool…</p>
              )}
            </TabsContent>
          </Tabs>
        )}

        <DialogDescription className="sr-only">
          Fiche de match CS2 : veto, rosters, map pool et marchés prédictifs.
        </DialogDescription>
      </DialogContent>
    </Dialog>
  );
}
