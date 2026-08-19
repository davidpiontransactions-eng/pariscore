"use client";

import { useEffect, useState } from "react";
import type { BaseballPrediction, CalibrationResult, PitcherRecord, TeamRecord } from "@/lib/baseball/types";
import { useBaseballMatchDetail } from "@/lib/hooks/use-baseball";
import { formatParisTimeWithZone } from "@/lib/baseball/timezone";
import { fmtNum, fmtPct, fmtWinLoss } from "@/lib/baseball/format";
import { TeamLogo } from "./TeamLogo";
import { PitcherBadge } from "./PitcherBadge";

interface BaseballMatchAnalysisModalProps {
  matchId: string;
  onClose: () => void;
}

type TabId = "verdict" | "moteur" | "lanceurs" | "contexte";

const TABS: { id: TabId; label: string }[] = [
  { id: "verdict", label: "Verdict" },
  { id: "moteur", label: "Moteur prédictif" },
  { id: "lanceurs", label: "Lanceurs (sabermétrique)" },
  { id: "contexte", label: "Attaque & Contexte" },
];

function ProbBar({ prob, color }: { prob: number; color: string }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
      <div
        className={`h-full rounded-full ${color}`}
        style={{ width: `${Math.round(prob * 100)}%` }}
      />
    </div>
  );
}

function StatCell({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/60 px-2.5 py-2">
      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`font-mono text-sm font-bold tabular-nums ${accent ? "text-amber-300" : "text-slate-100"}`}>
        {value}
      </div>
    </div>
  );
}

function PitcherFullPanel({ pitcher, side }: { pitcher: PitcherRecord; side: "home" | "away" }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-[#11161f] p-3.5">
      <div className="flex items-center justify-between gap-2">
        <PitcherBadge pitcher={pitcher} side={side} />
        <span
          className={`rounded border px-1.5 py-px text-[11px] font-bold uppercase tracking-wider ${
            pitcher.source === "mlb-statsapi-live"
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
              : "border-slate-600 bg-slate-800 text-slate-400"
          }`}
        >
          {pitcher.source === "mlb-statsapi-live" ? "Live API" : "Curé"}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-4 gap-1.5">
        <StatCell label="ERA" value={fmtNum(pitcher.era)} accent />
        <StatCell label="FIP" value={fmtNum(pitcher.fip)} />
        <StatCell label="xERA" value={fmtNum(pitcher.xEra)} />
        <StatCell label="WHIP" value={fmtNum(pitcher.whip)} />
        <StatCell label="K/9" value={fmtNum(pitcher.kPer9)} />
        <StatCell label="BB/9" value={fmtNum(pitcher.bbPer9)} />
        <StatCell label="W-L" value={fmtWinLoss(pitcher.wins, pitcher.losses)} />
        <StatCell label="IP/départ" value={fmtNum(pitcher.starterIpAvg)} />
      </div>
    </div>
  );
}

function VerdictSection({ prediction }: { prediction: BaseballPrediction }) {
  const { moneyline, total, runLine, firstFive } = prediction;
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {/* Moneyline */}
      <section className="rounded-xl border border-slate-800 bg-[#11161f] p-4">
        <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
          Vainqueur du match (Moneyline 1-2)
        </h4>
        <div className="mt-3 space-y-3">
          <div>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-200">Domicile</span>
              <span className="font-mono tabular-nums">
                <b className="text-white">{fmtPct(moneyline.homeProb)}</b>
                <span className="ml-2 text-slate-500">{moneyline.homeAmerican}</span>
              </span>
            </div>
            <ProbBar prob={moneyline.homeProb} color="bg-sky-500" />
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-200">Extérieur</span>
              <span className="font-mono tabular-nums">
                <b className="text-white">{fmtPct(moneyline.awayProb)}</b>
                <span className="ml-2 text-slate-500">{moneyline.awayAmerican}</span>
              </span>
            </div>
            <ProbBar prob={moneyline.awayProb} color="bg-rose-500" />
          </div>
        </div>
        <div className="mt-3 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-[11px] text-slate-400">
          <span className="font-bold text-amber-300">Run Line ±1,5 :</span> Domicile −1,5{" "}
          <b className="text-white">{fmtPct(runLine.homeMinusOneAndHalfProb)}</b> · Extérieur +1,5{" "}
          <b className="text-white">{fmtPct(runLine.awayPlusOneAndHalfProb)}</b>
        </div>
      </section>

      {/* Total */}
      <section className="rounded-xl border border-slate-800 bg-[#11161f] p-4">
        <div className="flex items-center justify-between">
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Over / Under Total Runs
          </h4>
          {total.recommendation ? (
            <span className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-bold uppercase text-emerald-300">
              Seuil ≥ 65 % ✓
            </span>
          ) : (
            <span className="rounded-md border border-slate-600 bg-slate-800 px-2 py-0.5 text-[11px] font-bold uppercase text-slate-400">
              Sous seuil
            </span>
          )}
        </div>
        <div className="mt-3 flex items-center gap-4">
          <div className="rounded-lg bg-slate-900 px-4 py-2.5 text-center">
            <div className="text-[11px] font-bold uppercase text-slate-500">Ligne</div>
            <div className="font-mono text-2xl font-bold tabular-nums text-amber-300">
              {total.line.toFixed(1)}
            </div>
          </div>
          <div className="flex-1 space-y-2">
            <div>
              <div className="mb-1 flex justify-between text-xs">
                <span className="font-semibold text-emerald-300">Over</span>
                <span className="font-mono font-bold tabular-nums text-white">
                  {fmtPct(total.overProb)}
                </span>
              </div>
              <ProbBar prob={total.overProb} color="bg-emerald-500" />
            </div>
            <div>
              <div className="mb-1 flex justify-between text-xs">
                <span className="font-semibold text-rose-300">Under</span>
                <span className="font-mono font-bold tabular-nums text-white">
                  {fmtPct(total.underProb)}
                </span>
              </div>
              <ProbBar prob={total.underProb} color="bg-rose-500" />
            </div>
          </div>
        </div>
        <div className="mt-3 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-[11px] text-slate-400">
          Total attendu : <b className="text-white">{fmtNum(total.expectedTotal)} runs</b> ·
          Confiance modèle : <b className="text-white">{fmtPct(total.confidence)}</b>
          {total.recommendation && (
            <span className="ml-2 font-bold uppercase text-emerald-300">
              → Jouer {total.recommendation === "over" ? "Over" : "Under"}
            </span>
          )}
        </div>
      </section>

      {/* First 5 */}
      <section className="rounded-xl border border-slate-800 bg-[#11161f] p-4 lg:col-span-2">
        <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
          First 5 Innings (100 % duel des partants)
        </h4>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2.5">
            <div className="text-[11px] font-bold uppercase text-slate-500">F5 Vainqueur</div>
            <div className="mt-1 font-mono text-sm tabular-nums">
              <span className="font-bold text-sky-300">{fmtPct(firstFive.homeWinProb)}</span>
              <span className="mx-1.5 text-slate-500">/</span>
              <span className="font-bold text-rose-300">{fmtPct(firstFive.awayWinProb)}</span>
            </div>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2.5">
            <div className="text-[11px] font-bold uppercase text-slate-500">F5 Ligne O/U</div>
            <div className="mt-1 font-mono text-sm tabular-nums">
              <b className="text-amber-300">{firstFive.totalLine.toFixed(1)}</b>
              <span className="ml-2 text-slate-400">
                Over <b className="text-emerald-300">{fmtPct(firstFive.overProb)}</b> · Under{" "}
                <b className="text-rose-300">{fmtPct(firstFive.underProb)}</b>
              </span>
            </div>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2.5">
            <div className="text-[11px] font-bold uppercase text-slate-500">F5 Total attendu</div>
            <div className="mt-1 font-mono text-sm font-bold tabular-nums text-white">
              {fmtNum(firstFive.expectedTotal)} runs
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function EngineSection({ prediction }: { prediction: BaseballPrediction }) {
  const { pythagorean, monteCarlo } = prediction;
  return (
    <div className="space-y-3">
      <section className="rounded-xl border border-slate-800 bg-[#11161f] p-4">
        <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
          Loi Pythagoricienne de Bill James
        </h4>
        <p className="mt-2 font-mono text-xs text-slate-400">
          Win% = RS<sup>x</sup> / (RS<sup>x</sup> + RA<sup>x</sup>) — x = {pythagorean.exponent}
        </p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <StatCell label="RS attendus" value={fmtNum(pythagorean.expectedHomeRuns)} />
          <StatCell label="RA attendus" value={fmtNum(pythagorean.expectedAwayRuns)} />
          <StatCell label="P(domicile)" value={fmtPct(pythagorean.homeWinProb)} accent />
        </div>
      </section>

      <section className="rounded-xl border border-slate-800 bg-[#11161f] p-4">
        <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
          Simulation Monte Carlo — matrice d&apos;espérance de points
        </h4>
        <p className="mt-2 text-xs leading-relaxed text-slate-400">
          {monteCarlo.iterations.toLocaleString("fr-FR")} matchs simulés manche par manche :
          chaque demi-manche croise les 24 états de la Run Expectancy Matrix
          (occupants des bases × outs) avec les métriques du partant (FIP, K/9, BB/9, HR/9) et du
          bullpen adverse pondéré par sa fatigue (IP sur 3 jours). Manches supplémentaires
          simulées jusqu&apos;au vainqueur.
        </p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <StatCell label="Total attendu" value={fmtNum(monteCarlo.expectedTotal)} accent />
          <StatCell label="σ (écart-type)" value={fmtNum(monteCarlo.stdDevTotal)} />
          <StatCell label="P(domicile) MC" value={fmtPct(monteCarlo.homeWinProb)} />
        </div>
      </section>

      <section className="rounded-xl border border-slate-800 bg-[#11161f] p-4">
        <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
          Fusion du modèle
        </h4>
        <ul className="mt-2 list-inside list-disc space-y-1 text-xs leading-relaxed text-slate-400">
          <li>
            Moneyline = 45 % Pythagoricienne + 55 % Monte Carlo (calibrage backtesté sur la
            stabilité des priors déterministes).
          </li>
          <li>
            O/U : ligne optimale choisie parmi 5 candidats autour de la moyenne (±1,0 run) —
            recommandation émise uniquement si la confiance atteint 65 %.
          </li>
          <li>Run Line : P(marge ≥ 2) extraite de la distribution Monte Carlo des écarts.</li>
          <li>
            F5 : simulation isolée des 5 premières manches — confrontation directe des deux
            partants.
          </li>
          <li className="font-mono text-[11px] text-slate-500">
            seed={prediction.seed} · model={prediction.modelVersion} · itérations=
            {monteCarlo.iterations}
          </li>
        </ul>
      </section>
    </div>
  );
}

function ContextSection({
  homeTeam,
  awayTeam,
  awayPitcherHand,
  homePitcherHand,
  homeParkFactor,
  homeParkLabel,
  homeBullpen,
  awayBullpen,
}: {
  homeTeam: TeamRecord;
  awayTeam: TeamRecord;
  awayPitcherHand: "LHP" | "RHP" | null;
  homePitcherHand: "LHP" | "RHP" | null;
  homeParkFactor: number;
  homeParkLabel: string;
  homeBullpen: { era: number; ipLast3: number; fatigueIndex: number };
  awayBullpen: { era: number; ipLast3: number; fatigueIndex: number };
}) {
  const rows: { team: TeamRecord; bullpen: { era: number; ipLast3: number; fatigueIndex: number } }[] = [
    { team: homeTeam, bullpen: homeBullpen },
    { team: awayTeam, bullpen: awayBullpen },
  ];
  return (
    <div className="space-y-3">
      <section className="rounded-xl border border-slate-800 bg-[#11161f] p-4">
        <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
          Attaque & Platoon Splits (OPS vs main de lancer)
        </h4>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-xs">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-slate-500">
                <th className="pb-2 font-bold">Équipe</th>
                <th className="pb-2 font-bold">wOBA</th>
                <th className="pb-2 font-bold">wRC+</th>
                <th className="pb-2 font-bold">OPS vs LHP</th>
                <th className="pb-2 font-bold">OPS vs RHP</th>
              </tr>
            </thead>
            <tbody className="font-mono tabular-nums">
              {rows.map(({ team }) => {
                // Chaque frappeur est évalué face à la main du PARTANT ADVERSE.
                const starterHand =
                  team.id === homeTeam.id ? awayPitcherHand : homePitcherHand;
                return (
                  <tr key={team.id} className="border-t border-slate-800">
                    <td className="py-2 font-sans font-semibold text-slate-200">
                      {team.city} {team.name}
                    </td>
                    <td className="py-2 text-slate-300">{fmtNum(team.woba)}</td>
                    <td className={`py-2 ${team.wrcPlus >= 100 ? "text-emerald-300" : "text-rose-300"}`}>
                      {team.wrcPlus}
                    </td>
                    <td className={`py-2 ${starterHand === "LHP" ? "font-bold text-amber-300" : "text-slate-300"}`}>
                      {fmtNum(team.opsVsLhp)}
                      {starterHand === "LHP" && <span className="ml-1 text-[11px]">◀ SP</span>}
                    </td>
                    <td className={`py-2 ${starterHand === "RHP" ? "font-bold text-amber-300" : "text-slate-300"}`}>
                      {fmtNum(team.opsVsRhp)}
                      {starterHand === "RHP" && <span className="ml-1 text-[11px]">◀ SP</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[11px] text-slate-500">
          ◀ SP = main de lancer du partant adverse — alignement évalué en platoon split.
        </p>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-800 bg-[#11161f] p-4">
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Park Factor ({homeTeam.name})
          </h4>
          <div className="mt-3 flex items-center gap-3">
            <div className="font-mono text-3xl font-bold tabular-nums text-white">
              {homeParkFactor}
            </div>
            <div className="flex-1">
              <div className="relative h-2 rounded-full bg-gradient-to-r from-sky-600 via-slate-700 to-rose-600">
                <span
                  className="absolute top-1/2 h-3.5 w-1 -translate-y-1/2 rounded bg-white"
                  style={{ left: `${Math.min(100, Math.max(0, ((homeParkFactor - 85) / 35) * 100))}%` }}
                />
              </div>
              <div className="mt-1 flex justify-between text-[11px] text-slate-500">
                <span>85 (Under)</span>
                <span>100</span>
                <span>120 (Over)</span>
              </div>
            </div>
          </div>
          <div
            className={`mt-2 rounded-md border px-2.5 py-1.5 text-[11px] font-semibold ${
              homeParkLabel === "favorable over"
                ? "border-rose-500/40 bg-rose-500/10 text-rose-300"
                : homeParkLabel === "favorable under"
                  ? "border-sky-500/40 bg-sky-500/10 text-sky-300"
                  : "border-slate-600 bg-slate-800 text-slate-300"
            }`}
          >
            {homeParkLabel === "favorable over" && "⚡ Stade favorable aux points / HR"}
            {homeParkLabel === "favorable under" && "🛡️ Stade favorable aux lanceurs"}
            {homeParkLabel === "neutre" && "➖ Stade neutre"}
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-[#11161f] p-4">
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Fatigue Bullpen (IP 3 derniers jours)
          </h4>
          <div className="mt-3 space-y-3">
            {rows.map(({ team, bullpen }) => (
              <div key={team.id}>
                <div className="mb-1 flex justify-between text-[11px]">
                  <span className="font-semibold text-slate-300">{team.code}</span>
                  <span className="font-mono tabular-nums text-slate-400">
                    ERA {fmtNum(bullpen.era)} · {fmtNum(bullpen.ipLast3)} IP
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                  <div
                    className={`h-full rounded-full ${
                      bullpen.fatigueIndex > 1.15
                        ? "bg-rose-500"
                        : bullpen.fatigueIndex > 1.0
                          ? "bg-amber-400"
                          : "bg-emerald-500"
                    }`}
                    style={{ width: `${Math.min(100, (bullpen.fatigueIndex / 1.6) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
            Indice = IP 3j / moyenne ligue (12,0) + ajustement ERA. Un bullpen surchargé dégrade
            les taux K/9 et majore les hits attendus dans la phase 2 du Monte Carlo.
          </p>
        </div>
      </section>
    </div>
  );
}

function CalibrationBlock({ cal }: { cal: CalibrationResult }) {
  return (
    <section className="rounded-xl border border-slate-800 bg-[#11161f] p-4">
      <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
        Calibration — prédiction vs résultat
      </h4>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Over / Under {cal.predictedTotalLine.toFixed(1)}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span className="font-mono text-sm tabular-nums text-slate-300">
              Total réel : <b className="text-white">{cal.actualTotalRuns}</b>
            </span>
            <span className={`rounded px-1.5 py-0.5 text-[11px] font-bold uppercase ${
              cal.overUnderHit === true
                ? "bg-emerald-500/20 text-emerald-300"
                : cal.overUnderHit === false
                  ? "bg-rose-500/20 text-rose-300"
                  : "bg-slate-700/60 text-slate-400"
            }`}>
              {cal.overUnderHit === true ? "✓ Gagné" : cal.overUnderHit === false ? "✗ Perdu" : "Push"}
            </span>
          </div>
          <div className="mt-1 font-mono text-[11px] text-slate-500">
            Prédiction : Over {fmtPct(cal.predictedOverProb)} · Under {fmtPct(cal.predictedUnderProb)}
            {cal.predictedRecommendation && (
              <span className="ml-1 text-amber-300">
                → {cal.predictedRecommendation === "over" ? "Over" : "Under"}
              </span>
            )}
          </div>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Moneyline
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span className="font-mono text-sm tabular-nums text-slate-300">
              Score : <b className="text-white">{cal.actualAwayRuns} - {cal.actualHomeRuns}</b>
              <span className="ml-1 text-[11px] text-slate-500">
                ({cal.moneylineWinner === "home" ? "Domicile" : "Extérieur"} gagne)
              </span>
            </span>
            {cal.moneylineFavoriteWon !== null && (
              <span className={`rounded px-1.5 py-0.5 text-[11px] font-bold uppercase ${
                cal.moneylineFavoriteWon
                  ? "bg-emerald-500/20 text-emerald-300"
                  : "bg-rose-500/20 text-rose-300"
              }`}>
                {cal.moneylineFavoriteWon ? "✓ Favori OK" : "✗ Upset"}
              </span>
            )}
          </div>
          <div className="mt-1 font-mono text-[11px] text-slate-500">
            P(domicile) prédite : {fmtPct(cal.predictedHomeWinProb)}
          </div>
        </div>
      </div>
    </section>
  );
}

export function BaseballMatchAnalysisModal({
  matchId,
  onClose,
}: BaseballMatchAnalysisModalProps) {
  const { data, error, isLoading } = useBaseballMatchDetail(matchId);
  const [tab, setTab] = useState<TabId>("verdict");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const detail = data?.detail;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Analyse de match baseball"
    >
      <div
        className="flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-t-2xl border border-slate-700 bg-[#0d1119] shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* En-tête */}
        <div className="flex items-center gap-3 border-b border-slate-800 px-4 py-3 sm:px-5">
          {detail ? (
            <>
              <TeamLogo team={detail.awayTeam} size={30} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-white">
                  {detail.awayTeam.city} {detail.awayTeam.name}{" "}
                  <span className="text-slate-500">@</span> {detail.homeTeam.city}{" "}
                  {detail.homeTeam.name}
                </div>
                <div className="font-mono text-[11px] text-slate-400">
                  {formatParisTimeWithZone(detail.game.gameDateIso)} · {detail.game.venueName} ·
                  Park Factor {detail.homeTeam.parkFactor}
                </div>
              </div>
              <TeamLogo team={detail.homeTeam} size={30} />
            </>
          ) : (
            <div className="h-8 flex-1" />
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="rounded-lg border border-slate-700 px-2.5 py-1 text-sm text-slate-300 hover:bg-slate-800"
          >
            ✕
          </button>
        </div>

        {/* Onglets */}
        <div className="flex gap-1 overflow-x-auto border-b border-slate-800 px-3 pt-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`whitespace-nowrap rounded-t-lg px-3 py-2 text-xs font-semibold transition-colors ${
                tab === t.id
                  ? "border-b-2 border-amber-400 bg-slate-800/60 text-white"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Corps */}
        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          {isLoading && (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-32 animate-pulse rounded-xl border border-slate-800 bg-[#11161f]" />
              ))}
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-6 text-center text-sm text-rose-300">
              Analyse indisponible — veuillez réessayer.
            </div>
          )}

          {detail && !isLoading && (
            <>
              {detail.predictionBlockedReason && (
                <div className="mb-4 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                  ⚠️ {detail.predictionBlockedReason}
                </div>
              )}

              {tab === "verdict" && (
                <>
                  {detail.prediction ? (
                    <VerdictSection prediction={detail.prediction} />
                  ) : (
                    !detail.predictionBlockedReason && (
                      <div className="text-center text-sm text-slate-400">Moteur non disponible.</div>
                    )
                  )}
                  {detail.calibration && <div className="mt-4"><CalibrationBlock cal={detail.calibration} /></div>}
                </>
              )}

              {tab === "moteur" &&
                (detail.prediction ? (
                  <EngineSection prediction={detail.prediction} />
                ) : (
                  <div className="rounded-xl border border-slate-800 bg-[#11161f] p-6 text-center text-sm text-slate-400">
                    {detail.predictionBlockedReason ?? "Moteur non disponible."}
                  </div>
                ))}

              {tab === "lanceurs" && (
                <div className="grid gap-3 sm:grid-cols-2">
                  {detail.awayPitcher ? (
                    <PitcherFullPanel pitcher={detail.awayPitcher} side="away" />
                  ) : (
                    <div className="rounded-xl border border-slate-800 bg-[#11161f] p-4 text-sm italic text-slate-500">
                      Partant extérieur non annoncé.
                    </div>
                  )}
                  {detail.homePitcher ? (
                    <PitcherFullPanel pitcher={detail.homePitcher} side="home" />
                  ) : (
                    <div className="rounded-xl border border-slate-800 bg-[#11161f] p-4 text-sm italic text-slate-500">
                      Partant domicile non annoncé.
                    </div>
                  )}
                </div>
              )}

              {tab === "contexte" && (
                <ContextSection
                  homeTeam={detail.homeTeam}
                  awayTeam={detail.awayTeam}
                  awayPitcherHand={
                    detail.awayPitcher ? (detail.awayPitcher.throws ?? null) : null
                  }
                  homePitcherHand={
                    detail.homePitcher ? (detail.homePitcher.throws ?? null) : null
                  }
                  homeParkFactor={detail.homeTeam.parkFactor}
                  homeParkLabel={detail.matchupContext.homeParkLabel}
                  homeBullpen={detail.matchupContext.homeBullpen}
                  awayBullpen={detail.matchupContext.awayBullpen}
                />
              )}

              <p className="mt-5 border-t border-slate-800 pt-3 text-[11px] leading-relaxed text-slate-600">
                Sources : calendrier {detail.dataSources.schedule === "mlb-statsapi-live" ? "MLB StatsAPI (live)" : "registre KBO curé"} · stats lanceurs{" "}
                {detail.dataSources.pitchers === "mlb-statsapi-live" ? "MLB StatsAPI (live)" : "registre curé"} · ratings équipes & Park Factors : registre
                sabermétrique curé. Modèle analytique à visée informationnelle — aucune garantie de gain.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
