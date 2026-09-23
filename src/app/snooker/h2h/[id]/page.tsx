"use client";

import { use, useMemo } from "react";
import useSWR from "swr";
import { buildPlayerIndex, findCuePlayer, type PlayerLike } from "@/lib/snooker/player-match";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type Match = {
  id: string;
  tournament: string;
  player1: string;
  player2: string;
  scheduled_at: string | null;
  status: string;
  scoreA: number;
  scoreB: number;
  bestOf: number;
  odds?: { player1: number; player2: number };
};

type Player = {
  id: string;
  name: string;
  nationality?: string;
  ranking?: number;
  eloRating: number;
  winPct?: number;
  centuryRate?: number;
  deciderWinPct?: number;
  avgBreak?: number;
  photoUrl?: string;
};

function normalize(val: number, min: number, max: number): number {
  if (max === min) return 50;
  return Math.min(100, Math.max(0, ((val - min) / (max - min)) * 100));
}

function playerScore(p: Player): number {
  const elo = normalize(p.eloRating, 1200, 1800);
  const win = p.winPct ?? 50;
  const century = normalize(p.centuryRate ?? 0, 0, 30);
  const decider = p.deciderWinPct ?? 50;
  // max_break CueTracker (40-147) — pas un vrai avg, neutre si absent
  const maxBreak = p.avgBreak != null ? normalize(p.avgBreak, 40, 147) : 50;
  return elo * 0.30 + win * 0.25 + century * 0.20 + decider * 0.15 + maxBreak * 0.10;
}

function logBinomPMF(k: number, n: number, p: number): number {
  if (p <= 0) return k === 0 ? 0 : -Infinity;
  if (p >= 1) return k === n ? 0 : -Infinity;
  let logC = 0;
  for (let i = 0; i < k; i++) {
    logC += Math.log(n - i) - Math.log(i + 1);
  }
  return logC + k * Math.log(p) + (n - k) * Math.log(1 - p);
}

/** Log-coefficient binomial log(C(n,k)) — SEULEMENT la combinaison, sans puissance de p. */
function logBinomCoeff(n: number, k: number): number {
  if (k < 0 || k > n) return -Infinity;
  if (k === 0 || k === n) return 0;
  if (k > n - k) k = n - k;
  let result = 0;
  for (let i = 0; i < k; i++) {
    result += Math.log(n - i) - Math.log(i + 1);
  }
  return result;
}

/**
 * P(P1 gagne le match avec le score exact a-b, dernière frame à P1)
 * = C(a+b-1, b) · pFrame^a · (1-pFrame)^b.
 */
function scoreWinProb(pFrame: number, a: number, b: number): number {
  if (a < 1 || b < 0) return 0;
  if (pFrame <= 0) return 0;
  if (pFrame >= 1) return b === 0 ? 1 : 0;
  return Math.exp(logBinomCoeff(a + b - 1, b) + a * Math.log(pFrame) + b * Math.log(1 - pFrame));
}

function matchWinProb(pFrame: number, bestOf: number): number {
  const winsNeeded = Math.ceil(bestOf / 2);
  let pWin = 0;
  for (let i = 0; i < winsNeeded; i++) {
    pWin += Math.exp(logBinomPMF(i, bestOf, pFrame));
  }
  return (1 - pWin) * 100;
}

function overTotalProb(pFrame: number, bestOf: number, threshold: number): number {
  const winsNeeded = Math.ceil(bestOf / 2);
  // P(match se termine à t) = P(P1 gagne winsNeeded-(t-winsNeeded)) + P(P2 gagne).
  let pOver = 0;
  for (let t = Math.floor(threshold) + 1; t <= bestOf; t++) {
    const loser = t - winsNeeded;
    pOver += scoreWinProb(pFrame, winsNeeded, loser) + scoreWinProb(1 - pFrame, winsNeeded, loser);
  }
  return Math.min(100, Math.max(0, pOver * 100));
}

/**
 * Ligne Over totale par match : la plus haute ligne dont P(total > ligne) ≥ 60 %
 * (proche de 60 %). Fallback si aucune ligne n'atteint 60 % (match très
 * déséquilibré) : la ligne `need`, non-triviale la plus probable.
 */
function bestOverTotalLine(pFrame: number, bestOf: number): number {
  const need = Math.ceil(bestOf / 2);
  let best = need;
  for (let t = need; t <= bestOf - 1; t++) {
    if (overTotalProb(pFrame, bestOf, t) >= 60) best = t;
    else break; // décroissante en t — inutile de continuer
  }
  return best;
}

/**
 * P(P1 atteint k frames avant P2) — race to k frames.
 * Ajustement pressure : favori gère mieux la pression (Collingwood 2023).
 */
function firstToK(pFrame: number, k: number): number {
  if (pFrame <= 0) return 0;
  if (pFrame >= 1) return 100;
  // Σᵢ₌₀ᵏ⁻¹ C(k-1+i, i) · pFrame^k · (1-pFrame)^i  (k=2 → p²(3−2p))
  let p = 0;
  for (let i = 0; i < k; i++) {
    const logP = logBinomCoeff(k - 1 + i, i) + k * Math.log(pFrame) + i * Math.log(1 - pFrame);
    p += Math.exp(logP);
  }
  const edge = pFrame - 0.5;
  const pressureBoost = edge > 0 ? edge * 0.03 * k : edge * 0.02 * k;
  return Math.min(100, Math.max(0, (p + pressureBoost) * 100));
}

function StatBar({ label, val1, val2, higher }: { label: string; val1: number; val2: number; higher?: boolean }) {
  const total = val1 + val2 || 1;
  const pct1 = (val1 / total) * 100;
  const better = higher === false ? val1 < val2 : val1 > val2;
  return (
    <div className="flex items-center gap-1.5 text-[11px] sm:gap-2">
      <span className={`w-10 text-right tabular-nums sm:w-16 ${better ? "font-bold text-emerald-600" : "text-gray-600"}`}>{val1.toFixed(1)}</span>
      <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden flex">
        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct1}%` }} />
        <div className="h-full rounded-full bg-amber-500" style={{ width: `${100 - pct1}%` }} />
      </div>
      <span className={`w-10 tabular-nums sm:w-16 ${!better ? "font-bold text-amber-600" : "text-gray-600"}`}>{val2.toFixed(1)}</span>
      <span className="hidden w-16 text-center text-gray-400 text-[10px] sm:inline">{label}</span>
    </div>
  );
}

function RecentForm({ playerName, matches, color }: { playerName: string; matches: Match[]; color: "emerald" | "amber" }) {
  const recent = matches
    .filter((m) => m.status === "finished" && (m.player1 === playerName || m.player2 === playerName))
    .sort((a, b) => (b.scheduled_at ?? "").localeCompare(a.scheduled_at ?? ""))
    .slice(0, 5);

  if (recent.length === 0) return null;

  const wins = recent.filter((m) => {
    const isP1 = m.player1 === playerName;
    return isP1 ? m.scoreA > m.scoreB : m.scoreB > m.scoreA;
  }).length;

  return (
    <div className="rounded-xl bg-white p-4 border border-gray-100">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[12px] font-bold text-gray-900">Forme récente — {playerName}</h3>
        <span className={`text-[10px] font-bold ${color === "emerald" ? "text-emerald-600" : "text-amber-600"}`}>
          {wins}V / {recent.length - wins}D
        </span>
      </div>
      <div className="space-y-1.5">
        {recent.map((m) => {
          const isP1 = m.player1 === playerName;
          const opponent = isP1 ? m.player2 : m.player1;
          const won = isP1 ? m.scoreA > m.scoreB : m.scoreB > m.scoreA;
          const score = isP1 ? `${m.scoreA}-${m.scoreB}` : `${m.scoreB}-${m.scoreA}`;
          return (
            <div key={m.id} className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-1.5">
              <span className={`inline-flex h-4 w-4 items-center justify-center rounded-full text-[8px] font-bold text-white ${won ? "bg-emerald-500" : "bg-rose-500"}`}>
                {won ? "W" : "L"}
              </span>
              <span className="text-[11px] text-gray-600 flex-1 truncate">{opponent}</span>
              <span className={`text-[11px] font-bold tabular-nums ${won ? "text-emerald-600" : "text-rose-600"}`}>{score}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function SnookerH2HPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: matchesData } = useSWR("/api/v1/snooker/matches", fetcher, { refreshInterval: 60_000 });
  const { data: playersData } = useSWR("/api/v1/snooker/players?limit=500", fetcher, { refreshInterval: 300_000 });

  const matches: Match[] = matchesData?.matches ?? [];
  const players: Player[] = playersData?.players ?? [];
  const match = matches.find((m) => m.id === id);

  // Index joueur pour matching fuzzy (FlashScore "O'Sullivan R." → CueTracker "Ronnie O'Sullivan")
  const playerIndex = useMemo(() => {
    const playerLikes: PlayerLike[] = players.map((p) => ({
      id: p.id,
      name: p.name,
      matches_played: 0, // volume inconnu — pas de valeur inventée (audit lot3)
    }));
    return buildPlayerIndex(playerLikes);
  }, [players]);

  const allPlayerLikes: PlayerLike[] = useMemo(() =>
    players.map((p) => ({
      id: p.id,
      name: p.name,
      matches_played: 0,
    })),
  [players]);

  if (matchesData && !match) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-sm font-medium text-gray-700">Match introuvable</p>
          <p className="mt-1 text-xs text-gray-500">Fixture expirée ou id inconnu.</p>
          <a href="/?sport=snooker" className="mt-3 inline-block text-xs font-semibold text-[#00985f]">
            ← Retour Snooker
          </a>
        </div>
      </div>
    );
  }

  if (!match) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#00985f] border-t-transparent mx-auto mb-3" />
          <p className="text-sm text-gray-500">Chargement du match…</p>
        </div>
      </div>
    );
  }

  // Matching fuzzy : "O'Sullivan R." → "Ronnie O'Sullivan"
  const found1 = findCuePlayer(match.player1, playerIndex, allPlayerLikes);
  const found2 = findCuePlayer(match.player2, playerIndex, allPlayerLikes);

  const p1 = (found1 ? players.find((p) => p.id === found1.id) : null) ?? {
    id: "", name: match.player1, eloRating: 1500, winPct: 50, centuryRate: 0, deciderWinPct: 50, avgBreak: 30,
  };
  const p2 = (found2 ? players.find((p) => p.id === found2.id) : null) ?? {
    id: "", name: match.player2, eloRating: 1500, winPct: 50, centuryRate: 0, deciderWinPct: 50, avgBreak: 30,
  };

  const s1 = playerScore(p1);
  const s2 = playerScore(p2);
  const pFrame = (s1 / (s1 + s2)) * 100;
  const pFrameDec = pFrame / 100;
  const bo = match.bestOf || 7;
  const live = match.status === "live";
  const finished = match.status === "finished";

  const matchProb = matchWinProb(pFrameDec, bo);
  const overLine = bestOverTotalLine(pFrameDec, bo);
  const overProb = overTotalProb(pFrameDec, bo, overLine);
  const first2P1 = firstToK(pFrameDec, 2);
  const first2P2 = firstToK(1 - pFrameDec, 2);

  const datetime = match.scheduled_at
    ? new Intl.DateTimeFormat("fr-FR", {
        weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris",
      }).format(new Date(match.scheduled_at))
    : "—";

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#00985f] to-[#005c3a] text-white px-4 py-6">
        <div className="max-w-2xl mx-auto">
          <h1 className="sr-only">
            {match.player1} contre {match.player2} — {match.tournament || "Snooker"}
          </h1>
          <div className="flex items-center gap-2 mb-4">
            <a href="/?sport=snooker" className="text-white/60 hover:text-white text-sm">← Snooker</a>
            <span className="text-white/30">·</span>
            <span className="text-white/60 text-sm">{match.tournament || "Northern Ireland Open"}</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="text-center flex-1">
              <div className="text-lg font-bold truncate min-w-0">{match.player1}</div>
              <div className="text-[11px] text-white/60 mt-1">
                {p1.id ? `Elo ${p1.eloRating} · W% ${p1.winPct?.toFixed(1)}` : "pas de données"}
              </div>
            </div>
            <div className="px-4 text-center">
              {live ? (
                <div className="text-2xl font-bold tabular-nums">{match.scoreA} - {match.scoreB}</div>
              ) : finished ? (
                <div className="text-2xl font-bold tabular-nums">{match.scoreA} - {match.scoreB}</div>
              ) : (
                <div className="text-sm text-white/60">vs</div>
              )}
              <div className="text-[10px] text-white/50 mt-1">{bo === 11 ? "Bo11" : `Bo${bo}`}</div>
            </div>
            <div className="text-center flex-1">
              <div className="text-lg font-bold truncate min-w-0">{match.player2}</div>
              <div className="text-[11px] text-white/60 mt-1">
                {p2.id ? `Elo ${p2.eloRating} · W% ${p2.winPct?.toFixed(1)}` : "pas de données"}
              </div>
            </div>
          </div>
          <div className="text-center text-[11px] text-white/50 mt-3">{datetime}</div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        {/* PowerScore comparison */}
        <div className="rounded-xl bg-white p-4 border border-gray-100">
          <h3 className="text-[12px] font-bold text-gray-900 mb-3">PowerScore</h3>
          <div className="flex items-center gap-4">
            <div className="text-center flex-1">
              <div className="text-2xl font-bold text-emerald-600">{Math.round(s1)}</div>
              <div className="text-[10px] text-gray-500">{match.player1}</div>
            </div>
            <div className="text-gray-300">vs</div>
            <div className="text-center flex-1">
              <div className="text-2xl font-bold text-amber-600">{Math.round(s2)}</div>
              <div className="text-[10px] text-gray-500">{match.player2}</div>
            </div>
          </div>
          <div className="mt-3 h-2 rounded-full bg-gray-100 overflow-hidden flex">
            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(s1 / (s1 + s2)) * 100}%` }} />
            <div className="h-full bg-amber-500 rounded-full" style={{ width: `${(s2 / (s1 + s2)) * 100}%` }} />
          </div>
        </div>

        {/* Stats comparison */}
        <div className="rounded-xl bg-white p-4 border border-gray-100">
          <h3 className="text-[12px] font-bold text-gray-900 mb-3">Statistiques</h3>
          <div className="space-y-2">
            <StatBar label="Elo" val1={p1.eloRating} val2={p2.eloRating} />
            <StatBar label="Win%" val1={p1.winPct ?? 50} val2={p2.winPct ?? 50} />
            <StatBar label="Century%" val1={p1.centuryRate ?? 0} val2={p2.centuryRate ?? 0} />
            <StatBar label="Décideur%" val1={p1.deciderWinPct ?? 50} val2={p2.deciderWinPct ?? 50} />
            <StatBar label="Max Break" val1={p1.avgBreak ?? 0} val2={p2.avgBreak ?? 0} />
          </div>
        </div>

        {/* Forme récente */}
        <RecentForm playerName={match.player1} matches={matches} color="emerald" />
        <RecentForm playerName={match.player2} matches={matches} color="amber" />

        {/* Predictions */}
        <div className="rounded-xl bg-white p-4 border border-gray-100">
          <h3 className="text-[12px] font-bold text-gray-900 mb-3">Prédictions modèle</h3>
          <div className="space-y-2">
            {[
              { label: "Gagnant du match", p1: matchProb, name1: match.player1, name2: match.player2 },
              { label: `Over ${overLine} frames`, p1: overProb, name1: "Over", name2: "Under" },
              { label: "1er à 2 frames", p1: first2P1, name1: match.player1, name2: match.player2 },
            ].map((row) => (
              <div key={row.label} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
                <span className="text-[11px] text-gray-600">{row.label}</span>
                <div className="flex items-center gap-2">
                  <span className={`text-[11px] font-bold tabular-nums ${row.p1 >= 50 ? "text-emerald-600" : "text-gray-500"}`}>
                    {row.name1} {row.p1.toFixed(1)}%
                  </span>
                  <span className="text-gray-300">|</span>
                  <span className={`text-[11px] font-bold tabular-nums ${row.p1 < 50 ? "text-amber-600" : "text-gray-500"}`}>
                    {row.name2} {(100 - row.p1).toFixed(1)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Odds */}
        {match.odds && match.odds.player1 > 0 && (
          <div className="rounded-xl bg-white p-4 border border-gray-100">
            <h3 className="text-[12px] font-bold text-gray-900 mb-3">Cotes</h3>
            <div className="flex gap-3">
              <div className="flex-1 text-center rounded-lg bg-gray-50 py-3">
                <div className="text-lg font-bold text-emerald-600">{match.odds.player1.toFixed(2)}</div>
                <div className="text-[10px] text-gray-500">{match.player1}</div>
              </div>
              <div className="flex-1 text-center rounded-lg bg-gray-50 py-3">
                <div className="text-lg font-bold text-amber-600">{match.odds.player2.toFixed(2)}</div>
                <div className="text-[10px] text-gray-500">{match.player2}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
