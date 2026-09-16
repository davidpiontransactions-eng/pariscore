"use client";

import { useState, useMemo } from "react";
import useSWR from "swr";
import { Skeleton } from "@/components/ui/skeleton";
import { LiquidGlass } from "@/components/ui/liquid-glass";
import { SnookerMatchCard } from "@/components/snooker/snooker-match-card";
import { SnookerLiveTracker } from "@/components/snooker/snooker-live-tracker";
import { SnookerPlayerCard } from "@/components/snooker/snooker-player-card";
import { SnookerBetsPanel } from "@/components/snooker/snooker-bets-panel";
import { SnookerHero } from "@/components/snooker/snooker-hero";
import { SnookerPlayerPopup } from "@/components/snooker/snooker-player-popup";
import { SnookerVideoPopup } from "@/components/snooker/snooker-video-popup";

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

type MarketKey = "matchWinner" | "overTotal" | "handicapP1" | "handicapP2" | "firstTo2" | "totalOverP1" | "totalOverP2";

const MARKETS: { key: MarketKey; label: string; desc: string }[] = [
  { key: "matchWinner", label: "Gagnant", desc: "Vainqueur du match" },
  { key: "overTotal", label: "Over Total", desc: "Over total manches" },
  { key: "handicapP1", label: "Handicap P1", desc: "Handicap frames P1" },
  { key: "handicapP2", label: "Handicap P2", desc: "Handicap frames P2" },
  { key: "firstTo2", label: "1er à 2", desc: "1er à obtenir 2 manches" },
  { key: "totalOverP1", label: "P1 Over", desc: "P1 total manches over" },
  { key: "totalOverP2", label: "P2 Over", desc: "P2 total manches over" },
];

// Scoring helpers — basé sur les données DB (Elo, WinPct, CenturyRate, DeciderWinPct, AvgBreak)
function normalize(val: number, min: number, max: number): number {
  if (max === min) return 50;
  return Math.min(100, Math.max(0, ((val - min) / (max - min)) * 100));
}

// ─── Modèles prédictifs → probabilités (0-100%) ──────────────────────────

/** Modèle Elo : probabilité attendue selon le rating */
function eloWinProb(elo1: number, elo2: number): number {
  const e1 = 1 / (1 + Math.pow(10, (elo2 - elo1) / 400));
  return e1 * 100;
}

/** Modèle Forme : WinPct pondéré + décideurs */
function formWinProb(p1: ApiPlayer, p2: ApiPlayer): number {
  const w1 = p1.winPct ?? 50;
  const w2 = p2.winPct ?? 50;
  const d1 = p1.deciderWinPct ?? 50;
  const d2 = p2.deciderWinPct ?? 50;
  const s1 = w1 * 0.7 + d1 * 0.3;
  const s2 = w2 * 0.7 + d2 * 0.3;
  return s1 / (s1 + s2) * 100;
}

/** Modèle Scoring : century rate + avg break */
function scoringWinProb(p1: ApiPlayer, p2: ApiPlayer): number {
  const c1 = normalize(p1.centuryRate ?? 0, 0, 30);
  const c2 = normalize(p2.centuryRate ?? 0, 0, 30);
  const b1 = normalize(p1.avgBreak ?? 30, 20, 80);
  const b2 = normalize(p2.avgBreak ?? 30, 20, 80);
  const s1 = c1 * 0.55 + b1 * 0.45;
  const s2 = c2 * 0.55 + b2 * 0.45;
  return s1 / (s1 + s2) * 100;
}

/** Modèle Clutch : performance en décideurs */
function clutchWinProb(p1: ApiPlayer, p2: ApiPlayer): number {
  const d1 = (p1.deciderWinPct ?? 0.5) * 100;
  const d2 = (p2.deciderWinPct ?? 0.5) * 100;
  return d1 / (d1 + d2) * 100;
}

/** Modèle Cotes : probabilité implicite déviggée (marché 2-way snooker) */
function oddsWinProb(odds1: number, odds2: number): number {
  const margin = (1 / odds1) + (1 / odds2);
  const p1 = (1 / odds1) / margin;
  return p1 * 100;
}

// ─── Probabilités frame (binomial) ────────────────────────────────────────

/** Log-binomial PMF pour éviter underflow sur gros n. */
function logBinomPMF(k: number, n: number, p: number): number {
  if (p <= 0) return k === 0 ? 0 : -Infinity;
  if (p >= 1) return k === n ? 0 : -Infinity;
  let logC = 0;
  for (let i = 0; i < k; i++) {
    logC += Math.log(n - i) - Math.log(i + 1);
  }
  return logC + k * Math.log(p) + (n - k) * Math.log(1 - p);
}

/** P(P1 gagne le match) — best-of-(2N-1). */
function matchWinProb(pFrame: number, bestOf: number): number {
  const winsNeeded = Math.ceil(bestOf / 2);
  let pWin = 0;
  for (let i = 0; i < winsNeeded; i++) {
    pWin += Math.exp(logBinomPMF(i, bestOf - 1, pFrame));
  }
  return (1 - pWin) * 100;
}

/** P(total frames > threshold) — lo best-of. */
function overTotalFramesProb(pFrame: number, bestOf: number, threshold: number): number {
  const winsNeeded = Math.ceil(bestOf / 2);
  let pOver = 0;
  for (let t = threshold + 1; t <= bestOf; t++) {
    for (let a = Math.max(0, t - winsNeeded); a <= Math.min(winsNeeded - 1, t); a++) {
      const b = t - a;
      if (b >= winsNeeded || b < 0) continue;
      const logP = logBinomPMF(a, t - 1, pFrame) + Math.log(pFrame)
                 + logBinomPMF(b, t - 1, pFrame) + Math.log(1 - pFrame);
      pOver += Math.exp(logP);
    }
  }
  return Math.min(100, Math.max(0, pOver * 100));
}

/** P(P1 gagne avec ≥m frames d'avance sur P2). */
function handicapProb(pFrame: number, bestOf: number, handicap: number): number {
  const winsNeeded = Math.ceil(bestOf / 2);
  let pCover = 0;
  // Parcourir tous les scores finaux possibles où P1 gagne avec avance ≥ handicap
  for (let a = winsNeeded; a <= bestOf; a++) {
    for (let b = 0; b < a - handicap; b++) {
      if (a + b > bestOf) continue;
      if (b >= winsNeeded) continue;
      // P1 gagne a-b : la dernière frame est gagnée par P1
      pCover += Math.exp(logBinomPMF(b, a + b - 1, pFrame));
    }
  }
  return Math.min(100, Math.max(0, pCover * 100));
}

/** P(P1 atteint k frames avant P2). */
function firstToKProb(pFrame: number, k: number): number {
  let pFirst = 0;
  for (let i = 0; i < k; i++) {
    pFirst += Math.exp(logBinomPMF(i, k + i - 1, pFrame)) * pFrame;
  }
  return Math.min(100, Math.max(0, pFirst * 100));
}

/** P(P1 gagne ≥k frames dans le match. */
function totalFramesOverProb(pFrame: number, bestOf: number, k: number): number {
  const winsNeeded = Math.ceil(bestOf / 2);
  let pOver = 0;
  for (let a = k; a <= bestOf; a++) {
    for (let b = 0; b < winsNeeded; b++) {
      if (a + b > bestOf) continue;
      if (a >= winsNeeded) {
        pOver += Math.exp(logBinomPMF(b, a + b - 1, pFrame)) * (1 - pFrame);
      }
    }
  }
  return Math.min(100, Math.max(0, pOver * 100));
}

/** Seuil par défaut pour handicap selon le format. */
function defaultHandicap(bestOf: number): number {
  if (bestOf <= 5) return 1;
  if (bestOf <= 7) return 2;
  return 3;
}

/** Seuil over total par défaut (frames-1 ou frames). */
function defaultOverThreshold(bestOf: number): number {
  return bestOf - 1;
}

/** Seuil over par joueur (ᵖ1 ou p2). */
function defaultPlayerOverThreshold(bestOf: number): number {
  return Math.ceil(bestOf / 2);
}

// ─── Meilleur joueur du match (sans cotes) ───────────────────────────────

/**
 * Score composite sans cotes — 5 métriques snooker pondérées.
 * Retourne "a" ou "b" selon le joueur favori.
 */
function computeBestPlayer(p1: ApiPlayer, p2: ApiPlayer): "a" | "b" {
  const s1 = playerScore(p1);
  const s2 = playerScore(p2);
  return s1 >= s2 ? "a" : "b";
}

/** Score 0-100 d'un joueur sur 5 métriques snooker. */
function playerScore(p: ApiPlayer): number {
  // Elo : 1200-1800 → 0-100
  const elo = normalize(p.eloRating, 1200, 1800);
  // Win% : déjà 0-100 (l'API renvoie des pourcentages)
  const win = p.winPct ?? 50;
  // Century rate : 0-30% → 0-100
  const century = normalize(p.centuryRate ?? 0, 0, 30);
  // Decider win% : déjà 0-100
  const decider = p.deciderWinPct ?? 50;
  // Avg break : 20-80 → 0-100
  const avgBreak = normalize(p.avgBreak ?? 30, 20, 80);

  return elo * 0.30 + win * 0.25 + century * 0.20 + decider * 0.15 + avgBreak * 0.10;
}

// ─── Badge PowerScore (sous le nom du joueur) ──────────────────────────────

/** Retourne la couleur du badge selon le score 0-100. */
function powerScoreColor(score: number): string {
  if (score >= 75) return "text-emerald-600";   // Excellent
  if (score >= 60) return "text-blue-600";      // Bon
  if (score >= 45) return "text-amber-600";     // Moyen
  return "text-gray-500";                        // Faible
}

/** Affiche le PowerScore + Elo + Win% sous le nom du joueur. */
function PowerScoreTag({ player }: { player: ApiPlayer }) {
  const score = Math.round(playerScore(player));
  const elo = player.eloRating;
  const winPct = player.winPct != null ? player.winPct.toFixed(1) : "—";
  return (
    <span className={`text-[9px] tabular-nums leading-none ${powerScoreColor(score)}`}>
      PS {score} · E {elo} · W% {winPct}%
    </span>
  );
}

/** Barre de win rate unique sous le score (style FlashScore). */
function WinBar({ prob1, prob2 }: { prob1: number; prob2: number }) {
  const color1 = prob1 >= 60 ? "#10b981" : prob1 >= 50 ? "#3b82f6" : "#f59e0b";
  const color2 = prob2 >= 60 ? "#10b981" : prob2 >= 50 ? "#3b82f6" : "#f59e0b";
  return (
    <div
      className="h-1.5 w-full overflow-hidden rounded-full"
      style={{ background: `linear-gradient(to right, ${color1} ${prob1}%, ${color2} ${prob1}%)` }}
    />
  );
}

/** Indicateur over/total frames pour le match avec pourcentage. */
function OverTotalTag({ bestOf, p1, p2 }: { bestOf: number; p1: number; p2: number }) {
  const target = bestOf === 11 ? 6.5 : bestOf === 9 ? 5.5 : Math.floor(bestOf / 2) + 0.5;
  const total = p1 + p2;
  const pFrame = total > 0 ? p1 / total : 0.5;
  // Estimation Over : probabilité que le match dépasse target frames
  const need = Math.ceil(bestOf / 2);
  const q = 1 - pFrame;
  let cum = 0;
  let comb = 1;
  for (let t = need; t <= Math.floor(target); t++) {
    if (t > need) comb = (comb * (t - 1)) / (t - need);
    cum += comb * Math.pow(pFrame, need) * Math.pow(q, t - need);
    cum += comb * Math.pow(q, need) * Math.pow(pFrame, t - need);
  }
  const overProb = Math.round((1 - Math.min(1, Math.max(0, cum))) * 100);
  return (
    <span className="inline-flex items-center gap-0.5 rounded bg-blue-50 px-1.5 py-0.5 text-[8px] font-semibold text-blue-600">
      O{target}F {overProb}%
    </span>
  );
}

// Résolution du joueur pour un match donné
function resolvePlayers(m: ApiMatch, players: ApiPlayer[]): [ApiPlayer, ApiPlayer] {
  const DEFAULT: ApiPlayer = {
    id: "", name: "", eloRating: 1500, winPct: 50, centuryRate: 0, deciderWinPct: 50, avgBreak: 30,
  };

  const find = (name: string): ApiPlayer => {
    const low = name.toLowerCase();
    // 1. Match exact
    const exact = players.find((p) => p.name.toLowerCase() === low);
    if (exact) return exact;

    // 2. FlashScore "Last First" → CueTracker "First Last"
    //    "Lines O." → cherche un joueur dont le last name est "lines"
    //    "Cheung K. W." → cherche un joueur dont le last name est "cheung"
    const fsParts = low.replace(/\./g, "").split(" ").filter(Boolean);
    // Le premier token est toujours le last name dans le format FlashScore
    const fsLastName = fsParts[0];

    // 2a. Match par last name (le nom CueTracker se termine par le last name FlashScore)
    const byLast = players.find((p) => {
      const pParts = p.name.toLowerCase().split(" ");
      const pLastName = pParts[pParts.length - 1];
      return pLastName === fsLastName || fsLastName.startsWith(pLastName) || pLastName.startsWith(fsLastName);
    });
    if (byLast) return byLast;

    // 2b. Match par first name (le 2e token FlashScore = initiale, cherche un first name commençant par cette lettre)
    const fsFirstInitial = fsParts[1]?.[0];
    if (fsFirstInitial) {
      const byFirst = players.find((p) => {
        const pParts = p.name.toLowerCase().split(" ");
        const pFirstName = pParts[0];
        return pParts.some(part => part.startsWith(fsLastName)) &&
               pFirstName.startsWith(fsFirstInitial);
      });
      if (byFirst) return byFirst;
    }

    // 3. Match partiel par last name
    const partial = players.find((p) => p.name.toLowerCase().includes(fsLastName));
    if (partial) return partial;

    return { ...DEFAULT, name };
  };

  return [find(m.player1), find(m.player2)];
}

/** Score composite multi-modèle (pondéré) → probabilité finale % */
function computeCompositeProb(
  m: ApiMatch,
  players: ApiPlayer[],
  _strategy?: string,
): { prob1: number; prob2: number } | null {
  const [p1, p2] = resolvePlayers(m, players);
  const noDb = p1.id === "" && p2.id === "";

  const probs: number[] = [];

  // 1. Modèle Elo (si ratings > defaults)
  if (p1.eloRating !== 1500 || p2.eloRating !== 1500) {
    probs.push(eloWinProb(p1.eloRating, p2.eloRating));
  }

  // 2. Modèle Forme
  if (p1.winPct !== 50 || p2.winPct !== 50) {
    probs.push(formWinProb(p1, p2));
  }

  // 3. Modèle Scoring
  if ((p1.centuryRate ?? 0) > 0 || (p2.centuryRate ?? 0) > 0) {
    probs.push(scoringWinProb(p1, p2));
  }

  // 4. Modèle Clutch
  if (p1.deciderWinPct !== 50 || p2.deciderWinPct !== 50) {
    probs.push(clutchWinProb(p1, p2));
  }

  // 5. Modèle Cotes (toujours disponible si odds existent)
  if (m.odds && m.odds.player1 > 0 && m.odds.player2 > 0) {
    probs.push(oddsWinProb(m.odds.player1, m.odds.player2));
  }

  if (probs.length === 0) return null;

  // Moyenne simple
  const prob1 = probs.reduce((a, b) => a + b, 0) / probs.length;

  return { prob1: Math.round(prob1), prob2: 100 - Math.round(prob1) };
}

// ---------------------------------------------------------------------------
// Types API
// ---------------------------------------------------------------------------
type ApiMatch = {
  id: string;
  tournament: string;
  player1: string;
  player2: string;
  player1PhotoUrl?: string;
  player2PhotoUrl?: string;
  scheduled_at: string | null;
  status: "scheduled" | "live" | "finished";
  scoreA: number;
  scoreB: number;
  bestOf: number;
  odds?: { player1: number; player2: number };
};

type MatchesResponse = {
  matches: ApiMatch[];
  total: number;
  scraped_at: string | null;
};

type ApiPlayer = {
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

type PlayersResponse = {
  players: ApiPlayer[];
  total: number;
  scraped_at: string | null;
};

const fetcher = (url: string) => fetch(url).then((r) => r.json());

// ---------------------------------------------------------------------------
// Composant principal
// ---------------------------------------------------------------------------
type CalendarFilter = "all" | "live" | "odds" | "finished" | "scheduled";

const FILTER_LABELS: { key: CalendarFilter; label: string }[] = [
  { key: "all", label: "ALL" },
  { key: "live", label: "LIVE" },
  { key: "odds", label: "ODDS" },
  { key: "finished", label: "FINISHED" },
  { key: "scheduled", label: "SCHEDULED" },
];

export function SnookerTabContent() {
  const [activeMarket, setActiveMarket] = useState<MarketKey>("matchWinner");
  const [handicapVal, setHandicapVal] = useState(2);
  const [overLine, setOverLine] = useState(6);
  const [calFilter, setCalFilter] = useState<CalendarFilter>("all");
  const [calDate, setCalDate] = useState<string>(() => {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  });
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [videoQuery, setVideoQuery] = useState<string | null>(null);

  // Détection live pour refresh fréquent
  const [hasLive, setHasLive] = useState(false);

  const matchesRes = useSWR<MatchesResponse>("/api/v1/snooker/matches", fetcher, {
    refreshInterval: hasLive ? 120_000 : 1_200_000,
    revalidateOnFocus: true,
    onSuccess: (data) => {
      setHasLive(data.matches.some((m) => m.status === "live"));
    },
  });
  const playersRes = useSWR<PlayersResponse>("/api/v1/snooker/players", fetcher, {
    refreshInterval: 600_000,
    revalidateOnFocus: true,
  });

  const matches = useMemo(() => matchesRes.data?.matches ?? [], [matchesRes.data]);
  const players = useMemo(() => playersRes.data?.players ?? [], [playersRes.data]);
  const liveMatches = useMemo(() => matches.filter((m) => m.status === "live"), [matches]);

  // Tri : live d'abord, puis programmés, puis terminés
  const sorted = useMemo(() => {
    const order: Record<ApiMatch["status"], number> = { live: 0, scheduled: 1, finished: 2 };
    return [...matches].sort((a, b) => {
      const o = order[a.status] - order[b.status];
      if (o !== 0) return o;
      return (a.scheduled_at ?? "").localeCompare(b.scheduled_at ?? "");
    });
  }, [matches]);

  // Top 10 par marché de pari
  const top10 = useMemo(() => {
    const candidates = sorted.filter((m) => m.status !== "finished");

    const scored = candidates.map((m) => {
      const [p1, p2] = resolvePlayers(m, players);
      const baseProb = computeCompositeProb(m, players, "all");
      if (!baseProb) return null;

      const pFrame = baseProb.prob1 / 100;
      const bo = m.bestOf || 7;
      const hasOdds = !!(m.odds && m.odds.player1 > 0 && m.odds.player2 > 0);

      let prob: number;
      let label: string;
      let sub: string;

      switch (activeMarket) {
        case "matchWinner": {
          prob = baseProb.prob1;
          label = p1.name;
          sub = `${baseProb.prob1}% / ${baseProb.prob2}%`;
          break;
        }
        case "overTotal": {
          prob = overTotalFramesProb(pFrame, bo, overLine);
          label = `Over ${overLine}`;
          sub = `${prob.toFixed(1)}%`;
          break;
        }
        case "handicapP1": {
          prob = handicapProb(pFrame, bo, handicapVal);
          label = `P1 -${handicapVal}`;
          sub = `${prob.toFixed(1)}%`;
          break;
        }
        case "handicapP2": {
          prob = 100 - handicapProb(pFrame, bo, handicapVal);
          label = `P2 -${handicapVal}`;
          sub = `${prob.toFixed(1)}%`;
          break;
        }
        case "firstTo2": {
          prob = firstToKProb(pFrame, 2);
          label = p1.name;
          sub = `${prob.toFixed(1)}% / ${(100 - prob).toFixed(1)}%`;
          break;
        }
        case "totalOverP1": {
          prob = totalFramesOverProb(pFrame, bo, overLine - 1);
          label = `P1 Over ${overLine - 1}`;
          sub = `${prob.toFixed(1)}%`;
          break;
        }
        case "totalOverP2": {
          prob = totalFramesOverProb(1 - pFrame, bo, overLine - 1);
          label = `P2 Over ${overLine - 1}`;
          sub = `${prob.toFixed(1)}%`;
          break;
        }
        default:
          return null;
      }

      if (prob < 45) return null;

      // Edge vs cotes
      let edge = 0;
      if (hasOdds) {
        const implied = oddsWinProb(m.odds!.player1, m.odds!.player2);
        edge = activeMarket === "matchWinner"
          ? prob - implied
          : prob - implied * (prob / baseProb.prob1); // adjust for non-winner markets
      }
      const roi = hasOdds && edge > 0 ? (edge / (100 - prob)) * 100 : 0;

      return {
        match: m, prob, label, sub, edge, roi, hasOdds,
        p1, p2, pFrame, bestOf: bo,
      };
    }).filter(Boolean) as Array<{
      match: ApiMatch; prob: number; label: string; sub: string;
      edge: number; roi: number; hasOdds: boolean;
      p1: ApiPlayer; p2: ApiPlayer; pFrame: number; bestOf: number;
    }>;

    // Tri: edge décroissant si odds, sinon prob décroissante
    scored.sort((a, b) => {
      if (a.hasOdds && b.hasOdds) return b.edge - a.edge;
      if (a.hasOdds) return -1;
      if (b.hasOdds) return 1;
      return b.prob - a.prob;
    });
    return scored.slice(0, 10);
  }, [sorted, activeMarket, players, handicapVal, overLine]);

  // ── Calendrier FlashScore : filtrage par onglet + date ──────────────────

  /** Filtre les matchs selon l'onglet actif */
  const calFiltered = useMemo(() => {
    let list = sorted;
    if (calFilter === "live") list = list.filter((m) => m.status === "live");
    else if (calFilter === "finished") list = list.filter((m) => m.status === "finished");
    else if (calFilter === "scheduled") list = list.filter((m) => m.status === "scheduled");
    else if (calFilter === "odds") list = list.filter((m) => m.odds && m.odds.player1 > 0);

    // Filtre par date (jour sélectionné)
    if (calFilter !== "finished") {
      list = list.filter((m) => {
        if (!m.scheduled_at) return true;
        const d = new Date(m.scheduled_at);
        return d.toISOString().slice(0, 10) === calDate;
      });
    }
    return list;
  }, [sorted, calFilter, calDate]);

  /** Groupement par tournoi */
  const calGroups = useMemo(() => {
    const groups: Record<string, ApiMatch[]> = {};
    for (const m of calFiltered) {
      const key = m.tournament || "Snooker";
      (groups[key] ??= []).push(m);
    }
    return groups;
  }, [calFiltered]);

  /** Navigation date — jours dispo */
  const calDateObj = useMemo(() => new Date(calDate + "T12:00:00"), [calDate]);
  const calDateLabel = useMemo(
    () =>
      new Intl.DateTimeFormat("fr-FR", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "Europe/Paris",
      }).format(calDateObj),
    [calDateObj],
  );

  /** Helper : shift date de N jours */
  const shiftDate = (n: number) => {
    const d = new Date(calDate + "T12:00:00");
    d.setDate(d.getDate() + n);
    setCalDate(d.toISOString().slice(0, 10));
  };

  const hasData = !!matchesRes.data?.matches;
  const isLoading = matchesRes.isLoading;

  return (
    <div className="space-y-6">
      {/* ======== HERO SNOOKER ======== */}
      <SnookerHero
        totalMatches={matchesRes.data?.total ?? matches.length}
        totalLive={liveMatches.length}
        totalWithOdds={matches.filter((m) => m.odds && m.odds.player1 > 0).length}
      />

      {/* ======== CALENDRIER COMPLET — Style FlashScore ======== */}
      <section
        id="calendrier"
        className="w-full min-w-0 overflow-hidden rounded-2xl"
        style={{ background: "#fff", border: "1px solid #e5e5e5" }}
      >
        {/* Barre de filtres */}
        <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 px-4 py-2.5">
          {FILTER_LABELS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setCalFilter(f.key)}
              className={`rounded-md px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide transition-colors ${
                calFilter === f.key
                  ? f.key === "live"
                    ? "bg-rose-500 text-white"
                    : "bg-gray-900 text-white"
                  : "bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700"
              }`}
            >
              {f.label}
              {f.key === "live" && liveMatches.length > 0 && (
                <span className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-white/20 text-[9px]">
                  {liveMatches.length}
                </span>
              )}
            </button>
          ))}

          {/* Navigation date */}
          {calFilter !== "finished" && (
            <div className="ml-auto flex items-center gap-1">
              <button
                type="button"
                onClick={() => shiftDate(-1)}
                className="flex h-7 w-7 items-center justify-center rounded-md bg-gray-100 text-gray-500 transition-colors hover:bg-gray-200"
                aria-label="Jour précédent"
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>
              <span className="min-w-[110px] text-center text-[11px] font-semibold text-gray-700">
                {calDateLabel}
              </span>
              <button
                type="button"
                onClick={() => shiftDate(1)}
                className="flex h-7 w-7 items-center justify-center rounded-md bg-gray-100 text-gray-500 transition-colors hover:bg-gray-200"
                aria-label="Jour suivant"
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
            </div>
          )}
        </div>

        {/* Contenu */}
        <div className="divide-y divide-gray-100">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full rounded" />
              ))}
            </div>
          ) : calFiltered.length === 0 ? (
            <div className="py-12 text-center text-[13px] text-gray-400">
              {calFilter === "live"
                ? "Aucun match en cours"
                : calFilter === "odds"
                  ? "Aucun match avec cotes"
                  : `Aucun match le ${calDateLabel}`}
            </div>
          ) : (
            Object.entries(calGroups).map(([tournament, tMatches]) => (
              <div key={tournament}>
                {/* En-tête tournoi — style FlashScore */}
                <div className="flex items-center gap-2 bg-gray-50 px-4 py-2">
                  <svg className="h-3 w-3 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                  <span className="text-[11px] font-bold uppercase tracking-wide text-gray-600">
                    {tournament}
                  </span>
                  <span className="text-[10px] text-gray-400">
                    ({tMatches.length})
                  </span>
                  <svg className="ml-auto h-3 w-3 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 15l-6-6-6 6" />
                  </svg>
                </div>

                {/* Lignes matchs */}
                {tMatches.map((m) => {
                  const live = m.status === "live";
                  const finished = m.status === "finished";
                  const timeStr = m.scheduled_at
                    ? new Intl.DateTimeFormat("fr-FR", {
                        hour: "2-digit",
                        minute: "2-digit",
                        timeZone: "Europe/Paris",
                      }).format(new Date(m.scheduled_at))
                    : "??:??";
                  const framesLabel = `${m.bestOf === 11 ? 6 : m.bestOf === 9 ? 5 : Math.floor(m.bestOf / 2) + 1} F`;

                  // ── Meilleur joueur (sans cotes) ──
                  const [pa, pb] = resolvePlayers(m, players);
                  const bestPlayer = computeBestPlayer(pa, pb);
                  const bestName = bestPlayer === "a" ? m.player1 : m.player2;
                  const compositeProb = computeCompositeProb(m, players, "all");
                  const winP1 = compositeProb?.prob1 ?? 50;
                  const winP2 = compositeProb?.prob2 ?? 50;

                  return (
                    <a
                      key={m.id}
                      href={`/snooker/h2h/${m.id}`}
                      className="flex items-center border-b border-gray-100 px-4 py-2 transition-colors hover:bg-[#f9e9cc] last:border-b-0"
                    >
                      {/* Étoile favori */}
                      <button
                        type="button"
                        className="mr-2 shrink-0 text-gray-300 transition-colors hover:text-yellow-400"
                        onClick={(e) => e.preventDefault()}
                        aria-label="Ajouter aux favoris"
                      >
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                        </svg>
                      </button>

                      {/* Heure / LIVE */}
                      <div className="w-[52px] shrink-0 text-center">
                        {live ? (
                          <span className="inline-flex items-center gap-0.5">
                            <span className="relative flex h-1.5 w-1.5">
                              <span className="absolute inline-flex h-full w-full animate-pulse rounded-full bg-rose-500 opacity-75" />
                              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-rose-500" />
                            </span>
                            <span className="text-[9px] font-bold uppercase text-rose-500">LIVE</span>
                          </span>
                        ) : (
                          <span className="text-[12px] tabular-nums text-gray-500">{timeStr}</span>
                        )}
                      </div>

                      {/* Player 1 + drapeau */}
                      <div className="flex min-w-0 flex-1 items-center justify-end gap-1.5">
                        <div className="flex min-w-0 flex-col items-end">
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setSelectedPlayerId(pa.id || null);
                              }}
                              className={`truncate text-[13px] text-left transition-colors hover:underline ${
                                finished && m.scoreA > m.scoreB ? "font-bold text-gray-900" : "text-gray-700"
                              } ${pa.id ? "cursor-pointer" : "cursor-default"}`}
                            >
                              {m.player1}
                            </button>
                            {bestPlayer === "a" && (
                              <svg className="h-3 w-3 shrink-0 text-amber-500" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                              </svg>
                            )}
                          </div>
                          <PowerScoreTag player={pa} />
                        </div>
                        {m.player1PhotoUrl ? (
                          <img src={m.player1PhotoUrl} alt="" className="h-3.5 w-3.5 shrink-0 rounded-sm object-cover" />
                        ) : (
                          <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm bg-gray-200 text-[7px] font-bold text-gray-500">
                            {m.player1.charAt(0)}
                          </span>
                        )}
                      </div>

                      {/* Score / Séparateur + WinBar */}
                      <div className="mx-2 flex w-[60px] shrink-0 flex-col items-center gap-1">
                        {finished ? (
                          <span className="text-[13px] font-bold tabular-nums text-gray-900">
                            {m.scoreA} - {m.scoreB}
                          </span>
                        ) : live ? (
                          <span className="text-[13px] font-bold tabular-nums text-rose-500">
                            {m.scoreA} - {m.scoreB}
                          </span>
                        ) : (
                          <span className="text-[11px] text-gray-400">—</span>
                        )}
                        <WinBar prob1={winP1} prob2={winP2} />
                      </div>

                      {/* Player 2 + drapeau */}
                      <div className="flex min-w-0 flex-1 items-center gap-1.5">
                        {m.player2PhotoUrl ? (
                          <img src={m.player2PhotoUrl} alt="" className="h-3.5 w-3.5 shrink-0 rounded-sm object-cover" />
                        ) : (
                          <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm bg-gray-200 text-[7px] font-bold text-gray-500">
                            {m.player2.charAt(0)}
                          </span>
                        )}
                        <div className="flex min-w-0 flex-col">
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setSelectedPlayerId(pb.id || null);
                              }}
                              className={`truncate text-[13px] text-left transition-colors hover:underline ${
                                finished && m.scoreB > m.scoreA ? "font-bold text-gray-900" : "text-gray-700"
                              } ${pb.id ? "cursor-pointer" : "cursor-default"}`}
                            >
                              {m.player2}
                            </button>
                            {bestPlayer === "b" && (
                              <svg className="h-3 w-3 shrink-0 text-amber-500" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                              </svg>
                            )}
                          </div>
                          <PowerScoreTag player={pb} />
                        </div>
                      </div>

                      {/* Best of / Frames + Over */}
                      <div className="ml-2 flex w-[50px] shrink-0 flex-col items-center gap-0.5 text-[11px] text-gray-400">
                        <span>{framesLabel}</span>
                        <OverTotalTag bestOf={m.bestOf} p1={pa.winPct ?? 50} p2={pb.winPct ?? 50} />
                      </div>

                      {/* Highlights video */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setVideoQuery(`${pa.name} vs ${pb.name} snooker highlights`);
                        }}
                        className="ml-1 shrink-0 rounded bg-gray-100 p-1 text-gray-400 transition-colors hover:bg-rose-50 hover:text-rose-500"
                        aria-label="Voir les highlights"
                      >
                        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </button>

                      {/* LIVE link + Momentum */}
                      <div className="ml-1.5 shrink-0 flex items-center gap-1">
                        {live ? (
                          <>
                            <span className="rounded bg-rose-500 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">
                              LIVE
                            </span>
                            {/* Momentum bar */}
                            <div className="flex items-center gap-0.5">
                              {Array.from({ length: m.bestOf || 7 }).map((_, fi) => {
                                const total = m.scoreA + m.scoreB;
                                const isP1Frame = fi < m.scoreA;
                                const isP2Frame = fi >= m.scoreA && fi < total;
                                const isFuture = fi >= total;
                                return (
                                  <div
                                    key={fi}
                                    className={`h-1.5 w-1.5 rounded-full ${
                                      isP1Frame ? "bg-emerald-500" : isP2Frame ? "bg-amber-500" : "bg-gray-200"
                                    }`}
                                    title={isP1Frame ? m.player1 : isP2Frame ? m.player2 : "à jouer"}
                                  />
                                );
                              })}
                            </div>
                          </>
                        ) : (
                          <span className="text-[10px] font-medium text-gray-400 transition-colors group-hover:text-rose-500">
                            LIVE &gt;
                          </span>
                        )}
                      </div>
                    </a>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-gray-100 px-4 py-2 text-[10px] text-gray-400">
          <span>
            Source: FlashScore
            {matchesRes.data?.scraped_at
              ? ` · ${new Date(matchesRes.data.scraped_at).toLocaleString("fr-FR")}`
              : ""}
          </span>
          <span>{calFiltered.length} matchs affichés</span>
        </div>
      </section>

      {/* ======== TOP 10 PAR MARCHÉ DE PARI — 1xBet ======== */}
      <section
        aria-label="Top 10 paris sportifs"
        className="w-full min-w-0 rounded-2xl p-3 sm:p-4"
        style={{ background: "#ffffff", border: "1px solid #f0f0f0" }}
      >
        {/* En-tête + filtres */}
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <h2 className="text-[13px] font-semibold" style={{ color: "#000000" }}>
            Top 10 — {MARKETS.find((s) => s.key === activeMarket)?.label ?? "Gagnant"}
          </h2>
          <div className="flex shrink-0 items-center gap-1">
            <div className="flex flex-wrap overflow-hidden rounded" style={{ border: "1px solid #f0f0f0" }}>
              {MARKETS.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setActiveMarket(s.key)}
                  className={`min-h-[44px] px-3 font-mono text-[10px] font-bold uppercase transition-colors sm:min-h-0 sm:px-2 sm:py-0.5 ${
                    activeMarket === s.key
                      ? "bg-[#00985f]/10 text-[#00985f]"
                      : "bg-transparent text-[#717171] hover:text-[#222]"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
            {/* Seuils configurables */}
            {(activeMarket === "handicapP1" || activeMarket === "handicapP2") && (
              <div className="flex items-center gap-1 rounded border border-gray-200 px-2 py-0.5">
                <span className="text-[10px] text-gray-500">HC</span>
                <input
                  type="number"
                  min={1}
                  max={6}
                  value={handicapVal}
                  onChange={(e) => setHandicapVal(Math.max(1, Math.min(6, Number(e.target.value) || 1)))}
                  className="w-8 bg-transparent text-center text-[11px] font-bold text-gray-900 outline-none"
                />
              </div>
            )}
            {(activeMarket === "overTotal" || activeMarket === "totalOverP1" || activeMarket === "totalOverP2") && (
              <div className="flex items-center gap-1 rounded border border-gray-200 px-2 py-0.5">
                <span className="text-[10px] text-gray-500">Over</span>
                <input
                  type="number"
                  min={2}
                  max={9}
                  value={overLine}
                  onChange={(e) => setOverLine(Math.max(2, Math.min(9, Number(e.target.value) || 2)))}
                  className="w-8 bg-transparent text-center text-[11px] font-bold text-gray-900 outline-none"
                />
              </div>
            )}
          </div>
        </div>

        {/* Table container */}
        <div className="overflow-hidden rounded-2xl" style={{ background: "#ffffff", border: "1px solid #f0f0f0" }}>
          {/* Header bar */}
          <div className="flex h-10 items-center px-4" style={{ background: "#f5f5f5", borderBottom: "1px solid #f0f0f0" }}>
            <span className="text-[13px] font-semibold" style={{ color: "#000000" }}>
              {MARKETS.find((s) => s.key === activeMarket)?.desc ?? "Pari"}
            </span>
            <span
              className="ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium"
              style={{ background: "#00985f15", color: "#00985f" }}
            >
              {top10.length}
            </span>
          </div>

          {/* Column headers — desktop */}
          <div
            className="hidden items-center px-3 py-2 text-[11px] font-medium uppercase tracking-wider md:grid"
            style={{
              gridTemplateColumns: "minmax(0,1fr) minmax(120px,auto) 80px 28px",
              color: "#717171",
              borderBottom: "1px solid #f5f5f5",
            }}
          >
            <span>Match</span>
            <span className="px-3">Pari recommandé</span>
            <span className="px-3 text-center">Probabilité</span>
            <span className="w-7 text-center">→</span>
          </div>

          {/* Loading / empty */}
          {isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-lg" />
              ))}
            </div>
          ) : !hasData || top10.length === 0 ? (
            <div className="text-center py-10 text-sm" style={{ color: "#717171" }}>
              Aucun match pour ce marché.
            </div>
          ) : (
            /* Match rows */
            <div>
              {top10.map((row, i) => {
                const { match: m, prob, label, sub, edge, roi, hasOdds, p1, p2, bestOf: bo } = row;
                const datetime = m.scheduled_at
                  ? new Intl.DateTimeFormat("fr-FR", {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                      timeZone: "Europe/Paris",
                    }).format(new Date(m.scheduled_at))
                  : "—";
                const live = m.status === "live";

                // Couleur selon probabilité
                const probColor = prob >= 70 ? "#00985f" : prob >= 60 ? "#FF6D00" : "#2196F3";
                const probBg = `${probColor}15`;
                const probBorder = `${probColor}30`;

                return (
                  <div
                    key={m.id}
                    className="flex flex-col gap-1 px-3 py-2 transition-colors md:grid md:items-center md:gap-0 hover:bg-[#f8f8f8]"
                    style={{
                      gridTemplateColumns: "minmax(0,1fr) minmax(120px,auto) 80px 28px",
                      borderBottom: i < top10.length - 1 ? "1px solid #f5f5f5" : undefined,
                    }}
                  >
                    {/* Col 1 — Match info */}
                    <div className="flex min-w-0 items-center gap-2">
                      <div
                        className="flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-extrabold shrink-0"
                        style={{ background: probBg, color: probColor }}
                      >
                        {i + 1}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-[13px] font-medium" style={{ color: "#222222" }}>
                          {m.player1} <span style={{ color: "#717171" }}>vs</span> {m.player2}
                        </div>
                        <div className="truncate text-[11px]" style={{ color: "#717171" }}>
                          {m.tournament || "Northern Ireland Open"} · {bo === 11 ? "Bo11" : `Bo${bo}`} ·{" "}
                          {live ? (
                            <span className="font-bold text-[#00985f]">
                              LIVE {m.scoreA}-{m.scoreB}
                            </span>
                          ) : (
                            datetime
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Col 2 — Pari recommandé */}
                    <div className="flex items-center gap-1.5 px-0 md:px-3">
                      <span
                        className="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold tabular-nums"
                        style={{ background: probBg, color: probColor, borderColor: probBorder }}
                      >
                        {label}
                      </span>
                      <span className="text-[10px]" style={{ color: "#717171" }}>
                        {sub}
                      </span>
                    </div>

                    {/* Col 3 — Probabilité + Edge */}
                    <div className="flex items-center gap-1 px-0 md:px-3">
                      <span
                        className="text-[13px] font-bold tabular-nums"
                        style={{ color: probColor }}
                      >
                        {prob.toFixed(1)}%
                      </span>
                      {hasOdds && edge > 2 && (
                        <span className="inline-flex items-center rounded-full bg-emerald-50 px-1.5 py-0.5 text-[8px] font-bold text-emerald-600">
                          +{edge.toFixed(1)}%
                        </span>
                      )}
                      {hasOdds && edge > 5 && (
                        <span className="inline-flex items-center rounded-full bg-amber-50 px-1.5 py-0.5 text-[8px] font-bold text-amber-600">
                          VALUE
                        </span>
                      )}
                    </div>

                    {/* Col 4 — Arrow */}
                    <div className="hidden w-7 justify-center md:flex">
                      <svg className="h-3 w-3" style={{ color: "#717171" }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M5 12h14M12 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* ======== DÉFINITIONS DES MARCHÉS ======== */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7">
        {MARKETS.map((s) => (
          <div
            key={s.key}
            className="rounded-lg border px-3 py-2 text-center"
            style={{
              background: activeMarket === s.key ? "#00985f12" : "#ffffff",
              borderColor: activeMarket === s.key ? "#00985f30" : "#f0f0f0",
            }}
          >
            <div className="text-[11px] font-bold" style={{ color: activeMarket === s.key ? "#00985f" : "#222" }}>
              {s.label}
            </div>
            <div className="mt-0.5 text-[10px]" style={{ color: "#717171" }}>
              {s.desc}
            </div>
          </div>
        ))}
      </div>

      {/* ======== PARIS ======== */}
      <LiquidGlass tier="tier2" className="rounded-xl border border-zinc-800/50 p-4">
        <SnookerBetsPanel />
      </LiquidGlass>

      {/* ======== TOUTES LES CARTES MATCHS ======== */}
      <section className="space-y-3">
        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
          Matchs — {matchesRes.data?.total ?? 0}
        </h3>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        ) : !hasData ? (
          <div className="text-center py-10 text-slate-400 text-sm">
            Aucun match top disponible.
          </div>
        ) : sorted.length === 0 ? (
          <div className="text-center py-10 text-slate-400 text-sm">
            Aucun match top disponible.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {sorted.map((m) => {
              // P_win depuis cotes (ou 0.5 si pas de cotes)
              const pWin = m.odds
                ? (1 / m.odds.player1) / ((1 / m.odds.player1) + (1 / m.odds.player2))
                : 0.5;
              return (
              <SnookerMatchCard
                key={m.id}
                match={{
                  id: m.id,
                  playerA: { id: `p-a-${m.id}`, name: m.player1, photoUrl: m.player1PhotoUrl },
                  playerB: { id: `p-b-${m.id}`, name: m.player2, photoUrl: m.player2PhotoUrl },
                  tournament: m.tournament || "Snooker",
                  bestOf: m.bestOf,
                  scoreA: m.scoreA,
                  scoreB: m.scoreB,
                  status: m.status,
                  scheduledAt: m.scheduled_at ?? undefined,
                  pWin,
                }}
              />
              );
            })}
          </div>
        )}
      </section>

      {/* ======== LIVE TRACKER ======== */}
      {liveMatches.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-emerald-400">En direct</h3>
          <div className="space-y-4">
            {liveMatches.map((m) => {
              const frames: Array<{ frameNumber: number; winner: "A" | "B"; scoreA: number; scoreB: number }> = [];
              let fa = 0;
              let fb = 0;
              for (let i = 0; i < m.scoreA; i++) {
                fa++;
                frames.push({ frameNumber: frames.length + 1, winner: "A", scoreA: fa, scoreB: fb });
              }
              for (let i = 0; i < m.scoreB; i++) {
                fb++;
                frames.push({ frameNumber: frames.length + 1, winner: "B", scoreA: fa, scoreB: fb });
              }
              return (
                <LiquidGlass key={m.id} tier="tier2" className="rounded-xl border border-zinc-800/50 p-4">
                  <SnookerLiveTracker
                    frames={frames}
                    bestOf={m.bestOf}
                    playerAName={m.player1}
                    playerBName={m.player2}
                    isLive
                  />
                </LiquidGlass>
              );
            })}
          </div>
        </section>
      )}

      {/* ======== LEADERBOARD JOUEURS ======== */}
      {players.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Top joueurs — {players.length}
          </h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {players.map((p) => (
              <SnookerPlayerCard
                key={p.id}
                player={{
                  id: p.id,
                  name: p.name,
                  nationality: p.nationality,
                  ranking: p.ranking,
                  eloRating: p.eloRating,
                  winPct: p.winPct,
                  centuryRate: p.centuryRate,
                  deciderWinPct: p.deciderWinPct,
                  avgBreak: p.avgBreak,
                  photoUrl: p.photoUrl,
                }}
              />
            ))}
          </div>
        </section>
      )}

      {/* ======== POPUP JOUEUR ======== */}
      {selectedPlayerId && (
        <SnookerPlayerPopup
          playerId={selectedPlayerId}
          onClose={() => setSelectedPlayerId(null)}
        />
      )}

      {/* ======== POPUP VIDEO HIGHLIGHTS ======== */}
      {videoQuery && (
        <SnookerVideoPopup
          query={videoQuery}
          onClose={() => setVideoQuery(null)}
        />
      )}
    </div>
  );
}
