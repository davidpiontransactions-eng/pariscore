"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  liveOverProb,
  liveScoreDistribution,
  liveWinnerProb,
  pickLiveHandicap,
} from "@/lib/snooker/live-distribution";

export type LivePopupData = {
  player1: string;
  player2: string;
  bestOf: number;
  scoreA: number;
  scoreB: number;
  tournament: string;
  /** Proba de gagner une frame (0-1), inversée du composite pré-match */
  pFrame: number;
  /** Proba pré-match P1 en % (pour le momentum) */
  preP1: number;
  /** Horodatage du scrape (transparence synchro) */
  syncedAt: string | null;
};

type Props = {
  data: LivePopupData;
  onClose: () => void;
  /** Force un re-fetch (SWR mutate du parent) */
  onRefresh: () => void;
};

/** Cycle de refresh auto du popup : 15 min. */
const REFRESH_S = 15 * 60;

function fmtCountdown(s: number): string {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

function fmtSynced(syncedAt: string | null): string {
  if (!syncedAt) return "Synchro données : —";
  const mins = Math.max(0, Math.round((Date.now() - new Date(syncedAt).getTime()) / 60000));
  if (mins < 1) return "Synchro données : à l'instant";
  return `Synchro données : il y a ${mins} min`;
}

/** Couleur selon probabilité (même échelle que le Top 10). */
function probColor(prob: number): string {
  if (prob >= 70) return "#00985f";
  if (prob >= 60) return "#FF6D00";
  return "#2196F3";
}

/** Pastilles frames : P1 vert, P2 ambre, à jouer gris. */
function FrameDots({ bestOf, scoreA, scoreB }: { bestOf: number; scoreA: number; scoreB: number }) {
  const total = scoreA + scoreB;
  return (
    <div className="flex items-center justify-center gap-1">
      {Array.from({ length: bestOf }, (_, fi) => {
        const cls = fi < scoreA ? "bg-emerald-500" : fi < total ? "bg-amber-500" : "bg-gray-200";
        return <div key={fi} className={`h-1.5 w-1.5 rounded-full ${cls}`} />;
      })}
    </div>
  );
}

export function SnookerLivePopup({ data, onClose, onRefresh }: Props) {
  const { bestOf, scoreA, scoreB, pFrame } = data;
  const need = Math.ceil(bestOf / 2);
  const finished = scoreA >= need || scoreB >= need;

  const dist = useMemo(
    () => (finished ? [] : liveScoreDistribution(pFrame, bestOf, scoreA, scoreB)),
    [pFrame, bestOf, scoreA, scoreB, finished],
  );
  const hc = useMemo(
    () => (finished ? null : pickLiveHandicap(pFrame, bestOf, scoreA, scoreB, 0.65)),
    [pFrame, bestOf, scoreA, scoreB, finished],
  );

  const liveP1 = liveWinnerProb(dist, "p1");
  const favIsP1 = liveP1 >= 50;
  const liveFav = favIsP1 ? liveP1 : 100 - liveP1;
  const favName = favIsP1 ? data.player1 : data.player2;
  const preFav = Math.max(data.preP1, 100 - data.preP1);
  const delta = liveFav - preFav;
  // Ligne Over style book : "Over X.5" (total entier > X ⟺ ≥ X+1)
  const overLine = bestOf - 2;
  const overP = liveOverProb(dist, overLine);

  // Compte à rebours 15 min → refresh auto
  const [left, setLeft] = useState(REFRESH_S);
  const refreshRef = useRef(onRefresh);
  refreshRef.current = onRefresh;
  useEffect(() => {
    const id = setInterval(() => setLeft((l) => Math.max(0, l - 1)), 1000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (left === 0) {
      refreshRef.current();
      setLeft(REFRESH_S);
    }
  }, [left]);
  // Échap : fermer
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Live : ${data.player1} contre ${data.player2}`}
    >
      <div
        className="relative mx-0 max-h-[88vh] w-full max-w-md overflow-y-auto rounded-t-3xl p-4 sm:mx-4 sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
        style={{ background: "#ffffff", border: "1px solid #f0f0f0" }}
      >
        {/* Header */}
        <div className="mb-2 flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-500 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-500" />
          </span>
          <span className="text-[11px] font-bold uppercase text-rose-500">Live</span>
          <span className="truncate text-[11px]" style={{ color: "#717171" }}>
            {data.tournament} · Bo{bestOf}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer le live"
            className="ml-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-100 text-[14px] font-bold text-gray-500 hover:text-[#222]"
          >
            ✕
          </button>
        </div>

        {/* Scoreboard */}
        <div
          className="flex items-center justify-between gap-2 rounded-2xl px-4 py-3"
          style={{ background: "#f5f5f5" }}
        >
          <div className="min-w-0 flex-1 truncate text-[14px] font-bold" style={{ color: "#00985f" }}>
            {data.player1}
          </div>
          <div className="shrink-0 font-mono text-[28px] font-extrabold tabular-nums" style={{ color: "#222" }}>
            {scoreA}-{scoreB}
          </div>
          <div className="min-w-0 flex-1 truncate text-right text-[14px] font-bold" style={{ color: "#2563eb" }}>
            {data.player2}
          </div>
        </div>
        <div className="mt-2">
          <FrameDots bestOf={bestOf} scoreA={scoreA} scoreB={scoreB} />
        </div>

        {/* Momentum pré-match → live */}
        <div className="mt-2 text-center text-[11px]" style={{ color: "#717171" }}>
          {favName} : {preFav.toFixed(0)}% →{" "}
          <span className="font-bold" style={{ color: probColor(liveFav) }}>
            {liveFav.toFixed(1)}%
          </span>{" "}
          ({delta >= 0 ? "+" : ""}
          {delta.toFixed(1)} pts depuis le début)
        </div>

        {finished ? (
          <div
            className="mt-3 rounded-xl p-3 text-center text-[13px] font-bold"
            style={{ background: "#00985f15", color: "#00985f" }}
          >
            Match terminé — {scoreA > scoreB ? data.player1 : data.player2} gagne {Math.max(scoreA, scoreB)}-
            {Math.min(scoreA, scoreB)}
          </div>
        ) : (
          <div className="mt-3 flex flex-col gap-2">
            {/* Bet 1 — Vainqueur live */}
            <div className="rounded-xl border border-gray-200 p-3">
              <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#717171" }}>
                1 · Vainqueur du match
              </div>
              <div className="mt-1 flex items-baseline justify-between gap-2">
                <span className="truncate text-[13px] font-bold" style={{ color: "#222" }}>
                  {favName}
                </span>
                <span className="text-[18px] font-extrabold tabular-nums" style={{ color: probColor(liveFav) }}>
                  {liveFav.toFixed(1)}%
                </span>
              </div>
              <div className="text-[11px] tabular-nums" style={{ color: "#717171" }}>
                {data.player1} {liveP1.toFixed(0)}% / {data.player2} {(100 - liveP1).toFixed(0)}%
              </div>
            </div>

            {/* Bet 2 — Total frames */}
            <div className="rounded-xl border border-gray-200 p-3">
              <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#717171" }}>
                2 · Total frames
              </div>
              <div className="mt-1 flex items-center justify-between gap-2 text-[13px] font-bold tabular-nums">
                <span style={{ color: overP >= 50 ? probColor(overP) : "#717171" }}>
                  Over {overLine}.5 · {overP.toFixed(1)}%
                </span>
                <span style={{ color: overP < 50 ? probColor(100 - overP) : "#717171" }}>
                  Under · {(100 - overP).toFixed(1)}%
                </span>
              </div>
            </div>

            {/* Bet 3 — Handicap */}
            {hc && (
              <div className="rounded-xl border border-gray-200 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#717171" }}>
                    3 · Handicap frames
                  </span>
                  {hc.belowBar ? (
                    <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[8px] font-bold text-gray-500">
                      sous la barre 65 %
                    </span>
                  ) : (
                    <span
                      className="rounded-full px-1.5 py-0.5 text-[8px] font-bold text-white"
                      style={{ backgroundColor: "#00985f" }}
                    >
                      ≥ 65 %
                    </span>
                  )}
                </div>
                <div className="mt-1 flex items-baseline justify-between gap-2">
                  <span className="truncate text-[13px] font-bold" style={{ color: "#222" }}>
                    {hc.side === "p1" ? data.player1 : data.player2} {hc.label.split(" ")[1]}
                  </span>
                  <span className="text-[18px] font-extrabold tabular-nums" style={{ color: probColor(hc.prob) }}>
                    {hc.prob.toFixed(1)}%
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer refresh */}
        <div className="mt-3 flex items-center gap-2 text-[10px]" style={{ color: "#717171" }}>
          <span className="tabular-nums">Refresh dans {fmtCountdown(left)}</span>
          <button
            type="button"
            onClick={() => {
              onRefresh();
              setLeft(REFRESH_S);
            }}
            className="rounded-full border border-gray-200 px-2 py-0.5 font-bold transition-colors hover:border-[#00985f] hover:text-[#00985f]"
          >
            Actualiser
          </button>
          <span className="ml-auto tabular-nums">{fmtSynced(data.syncedAt)}</span>
        </div>
        <div className="mt-1 text-center text-[9px]" style={{ color: "#a0a0a0" }}>
          Modèle : frames indépendantes (binomiale) — probabilités, pas des cotes.
        </div>
      </div>
    </div>
  );
}
