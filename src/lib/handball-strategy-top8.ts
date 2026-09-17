// Moteur stratégies handball — Top 8 par bet type 1xBet
// Basé sur : Felice 2025, Karlis 2026, Broermann 2026, Krawczyk 2025, Daza 2017
// Architecture : pure scoring lib (no I/O), miroir football-strategy-top5.ts

import type { HandballMatch, HandballLeague, HandballTeam } from "./handball-data";

// ─── Types ───

export type HandballStrategyKey =
  | "bestTeam"
  | "bestTeam1x2"
  | "over55"
  | "under62"
  | "handicap"
  | "btts30"
  | "htLeader"
  | "valueBet";

export type HandballSide = "home" | "away";

export type HandballStrategyEntry = {
  matchId: string;
  league: string;
  leagueCountry?: string;
  kickoff: string;
  home: { name: string; shortName?: string };
  away: { name: string; shortName?: string };
  /** Valeur calculée par la stratégie */
  value: number;
  /** Côté à jouer (home/away) si applicable, sinon null */
  pick: HandballSide | null;
  /** Cotes 1X2 */
  odds?: { home?: number; draw?: number; away?: number };
  /** Score HT si disponible */
  htScore?: { home: number; away: number };
  /** Résumé forme (W/D/L L5) */
  formSummary?: { home: string; away: string };
  /** Probabilité modèle */
  probPct?: number;
  /** EV = P(model) * odds - 1 */
  ev?: number | null;
  /** Edge = P(model) - P(market) */
  trend?: number | null;
};

export type HandballStrategyResult = {
  window: string;
  strategies: Record<HandballStrategyKey, HandballStrategyEntry[]>;
  computedAt: string;
};

// ─── Form Store ───

type TeamForm = {
  gf: number[];
  ga: number[];
  wins: number;
  draws: number;
  losses: number;
  htLeads: number;
  htTrails: number;
};

type FormStore = Map<string, TeamForm>;

/** Construit le store de forme depuis les matchs terminés */
export function buildFormStore(finished: HandballMatch[]): FormStore {
  const store = new Map<string, TeamForm>();
  const upsert = (id: string, gf: number, ga: number, htGf?: number, htGa?: number) => {
    if (!store.has(id)) store.set(id, { gf: [], ga: [], wins: 0, draws: 0, losses: 0, htLeads: 0, htTrails: 0 });
    const f = store.get(id)!;
    f.gf.push(gf);
    f.ga.push(ga);
    if (gf > ga) f.wins++;
    else if (gf === ga) f.draws++;
    else f.losses++;
    if (htGf != null && htGa != null) {
      if (htGf > htGa) f.htLeads++;
      else if (htGf < htGa) f.htTrails++;
    }
  };
  for (const m of finished) {
    if (!m.score) continue;
    upsert(String(m.home.id), m.score.home, m.score.away, m.score.homeHalf, m.score.awayHalf);
    upsert(String(m.away.id), m.score.away, m.score.home, m.score.awayHalf, m.score.homeHalf);
  }
  return store;
}

/** Moyenne des N dernières valeurs */
function avgLast(arr: number[], n: number): number {
  if (arr.length === 0) return 0;
  const slice = arr.slice(-n);
  return slice.reduce((a, b) => a + b, 0) / slice.length;
}

/** PPG sur N derniers matchs */
function ppg(f: TeamForm, n: number): number {
  const total = f.wins + f.draws + f.losses;
  if (total === 0) return 0;
  const slice = Math.min(n, total);
  const pts = (f.wins / total) * 2 + (f.draws / total) * 1;
  return pts;
}

// ─── Math helpers ───

/** Factorielle (pour Poisson) */
function fact(n: number): number {
  if (n <= 1) return 1;
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

/** Poisson P(X = k) */
function poissonPmf(k: number, lambda: number): number {
  if (lambda <= 0) return k === 0 ? 1 : 0;
  return Math.exp(-lambda + k * Math.log(lambda) - Math.log(fact(k)));
}

/** Poisson P(X >= k) */
function poissonGe(k: number, lambda: number): number {
  let sum = 0;
  for (let i = 0; i < k; i++) sum += poissonPmf(i, lambda);
  return 1 - sum;
}

/** Poisson P(X <= k) */
function poissonLe(k: number, lambda: number): number {
  let sum = 0;
  for (let i = 0; i <= k; i++) sum += poissonPmf(i, lambda);
  return sum;
}

/** CMP dispersion adjustment — handball est sous-dispersé (ν ≈ 1.3) */
const CMP_NU = 1.3;

/** Home advantage en buts (Pollard & Gómez: +1.5-2.5) */
const HOME_ADV = 1.8;

/** Lignes typiques 1xBet */
const TOTAL_LINE = 57.5;
const TEAM_TOTAL_STRONG = 30.5;
const TEAM_TOTAL_WEAK = 26.5;
const HANDICAP_LINE = 4.5;
const BTTS_LINE = 30;

// ─── Scoring functions ───

/** Calcule la probabilité de victoire d'une équipe (1X2) */
function winProb(
  formStore: FormStore,
  match: HandballMatch,
  side: HandballSide,
): number {
  const teamId = side === "home" ? String(match.home.id) : String(match.away.id);
  const oppId = side === "home" ? String(match.away.id) : String(match.home.id);
  const f = formStore.get(teamId);
  const opp = formStore.get(oppId);

  // Pas de forme → prob neutre
  if (!f || !opp) return 0.45 + (side === "home" ? 0.05 : 0);

  // PPG pondéré (Felice 2025: strength estimate = feature #1)
  const teamPpg = ppg(f, 10);
  const oppPpg = ppg(opp, 10);

  // Goalkeeper proxy via GA moyenne (Daza 2017)
  const teamDef = avgLast(f.ga, 5);
  const oppDef = avgLast(opp.ga, 5);

  // Fast-break proxy via GF moyenne (Krawczyk 2025)
  const teamAtk = avgLast(f.gf, 5);
  const oppAtk = avgLast(opp.gf, 5);

  // Score composite pondéré
  const teamScore = teamPpg * 0.35 + (teamAtk - teamDef) * 0.30 + (1 / (1 + teamDef)) * 0.20;
  const oppScore = oppPpg * 0.35 + (oppAtk - oppDef) * 0.30 + (1 / (1 + oppDef)) * 0.20;

  // Home advantage
  const homeAdj = side === "home" ? HOME_ADV * 0.1 : -HOME_ADV * 0.1;

  // Sigmoid normalisé
  const diff = teamScore - oppScore + homeAdj;
  return 1 / (1 + Math.exp(-diff * 2));
}

/** Calcule le total attendu de buts du match */
function expectedTotal(
  formStore: FormStore,
  match: HandballMatch,
): number {
  const hId = String(match.home.id);
  const aId = String(match.away.id);
  const hf = formStore.get(hId);
  const af = formStore.get(aId);

  if (!hf || !af) return TOTAL_LINE; // fallback neutre

  // Pace = (GF + GA) / 2 — proxy possessions
  const hPace = (avgLast(hf.gf, 5) + avgLast(hf.ga, 5)) / 2;
  const aPace = (avgLast(af.gf, 5) + avgLast(af.ga, 5)) / 2;

  // Expected goals = moyenne des deux paces + home advantage
  const lambdaH = (hPace + aPace) / 2 + HOME_ADV / 2;
  const lambdaA = (hPace + aPace) / 2 - HOME_ADV / 4;

  return lambdaH + lambdaA;
}

/** Calcule le goal difference attendu (Skellam) */
function expectedGoalDiff(
  formStore: FormStore,
  match: HandballMatch,
): number {
  const hId = String(match.home.id);
  const aId = String(match.away.id);
  const hf = formStore.get(hId);
  const af = formStore.get(aId);

  if (!hf || !af) return 0;

  const hGf = avgLast(hf.gf, 5);
  const hGa = avgLast(hf.ga, 5);
  const aGf = avgLast(af.gf, 5);
  const aGa = avgLast(af.ga, 5);

  // Différentiel attendu
  const hStrength = hGf - hGa;
  const aStrength = aGf - aGa;

  return (hStrength - aStrength) + HOME_ADV;
}

/** Form summary W/D/L sur N */
function formSummaryStr(f: TeamForm | undefined, n: number): string {
  if (!f) return "---";
  const total = f.wins + f.draws + f.losses;
  if (total === 0) return "---";
  const w = Math.min(f.wins, n);
  const d = Math.min(f.draws, n - w);
  const l = Math.min(f.losses, n - w - d);
  return `${"W".repeat(w)}${"D".repeat(d)}${"L".repeat(l)}`.slice(0, n);
}

// ─── Main scoring engine ───

/** Score un match pour une stratégie donnée */
function scoreMatch(
  key: HandballStrategyKey,
  formStore: FormStore,
  match: HandballMatch,
): { value: number; pick: HandballSide | null; probPct?: number; ev?: number | null; trend?: number | null } | null {
  const hForm = formStore.get(String(match.home.id));
  const aForm = formStore.get(String(match.away.id));
  const hasForm = hForm != null && aForm != null;

  switch (key) {
    case "bestTeam": {
      // PPG pondéré (Felice 2025)
      if (!hasForm) return null;
      const hPpg = ppg(hForm!, 10);
      const aPpg = ppg(aForm!, 10);
      const hPpg5 = ppg(hForm!, 5);
      const aPpg5 = ppg(aForm!, 5);
      // Pondération L5 (60%) + L10 (40%)
      const hScore = hPpg5 * 0.6 + hPpg * 0.4;
      const aScore = aPpg5 * 0.6 + aPpg * 0.4;
      const pick: HandballSide = hScore >= aScore ? "home" : "away";
      return { value: Math.max(hScore, aScore), pick };
    }

    case "bestTeam1x2": {
      // De-vig odds (toujours depuis cotes marché)
      if (!match.odds?.home || !match.odds?.away) return null;
      const total = 1 / match.odds.home + (match.odds.draw ? 1 / match.odds.draw : 0) + 1 / match.odds.away;
      const pHome = (1 / match.odds.home) / total;
      const pAway = (1 / match.odds.away) / total;
      const pick: HandballSide = pHome >= pAway ? "home" : "away";
      return { value: Math.max(pHome, pAway) * 100, pick, probPct: Math.max(pHome, pAway) * 100 };
    }

    case "over55": {
      // CMP sur total attendu (Karlis 2026)
      const lambda = hasForm ? expectedTotal(formStore, match) : TOTAL_LINE;
      // CMP sous-dispersé → ajuster lambda
      const adjustedLambda = lambda / Math.pow(CMP_NU, 0.5);
      const prob = poissonGe(Math.ceil(TOTAL_LINE), adjustedLambda);
      const ev = match.odds?.home && match.odds?.away ? prob * (match.odds.home + match.odds.away) / 2 - 1 : null;
      return { value: prob * 100, pick: null, probPct: prob * 100, ev };
    }

    case "under62": {
      // CMP inverse
      const lambda = hasForm ? expectedTotal(formStore, match) : TOTAL_LINE;
      const adjustedLambda = lambda / Math.pow(CMP_NU, 0.5);
      const prob = poissonLe(62, adjustedLambda);
      const ev = match.odds?.home && match.odds?.away ? prob * (match.odds.home + match.odds.away) / 2 - 1 : null;
      return { value: prob * 100, pick: null, probPct: prob * 100, ev };
    }

    case "handicap": {
      // Skellam goal difference (Karlis 2026)
      const diff = hasForm ? expectedGoalDiff(formStore, match) : 0;
      // P(home gagne avec handicap -4.5) = P(diff >= 5)
      const prob = diff >= 0 ? poissonGe(Math.ceil(HANDICAP_LINE + 0.5), Math.abs(diff) + HOME_ADV) : 0;
      const pick: HandballSide = diff >= 0 ? "home" : "away";
      return { value: prob * 100, pick, probPct: prob * 100 };
    }

    case "btts30": {
      // Les deux équipes marquent 30+ (bivariate)
      if (!hasForm) return null;
      const hAvg = avgLast(hForm!.gf, 5);
      const aAvg = avgLast(aForm!.gf, 5);
      const probH30 = poissonGe(30, hAvg + HOME_ADV / 2);
      const probA30 = poissonGe(30, aAvg - HOME_ADV / 4);
      // Indépendance (simplification)
      const probBoth = probH30 * probA30;
      return { value: probBoth * 100, pick: null, probPct: probBoth * 100 };
    }

    case "htLeader": {
      // Leader mi-temps (Skellam HT→FT correlation)
      if (!hasForm) return null;
      const hPpg5 = ppg(hForm!, 5);
      const aPpg5 = ppg(aForm!, 5);
      // HT leader = même que FT leader dans ~70% des cas (Karlis 2026 copula)
      const hScore = hPpg5 + (hForm!.htLeads / Math.max(1, hForm!.htLeads + hForm!.htTrails)) * 0.3;
      const aScore = aPpg5 + (aForm!.htLeads / Math.max(1, aForm!.htLeads + aForm!.htTrails)) * 0.3;
      const pick: HandballSide = hScore >= aScore ? "home" : "away";
      return { value: Math.max(hScore, aScore), pick };
    }

    case "valueBet": {
      // EV+ = P(model) > P(market)
      if (!match.odds?.home || !match.odds?.away) return null;
      const pModelHome = winProb(formStore, match, "home");
      const pModelAway = winProb(formStore, match, "away");
      const pMarketHome = 1 / match.odds.home;
      const pMarketAway = 1 / match.odds.away;
      const edgeHome = pModelHome - pMarketHome;
      const edgeAway = pModelAway - pMarketAway;
      const bestEdge = Math.max(edgeHome, edgeAway);
      const pick: HandballSide = edgeHome >= edgeAway ? "home" : "away";
      const odds = pick === "home" ? match.odds.home : match.odds.away;
      const ev = bestEdge > 0 ? bestEdge * odds : null;
      return { value: bestEdge * 100, pick, probPct: (pick === "home" ? pModelHome : pModelAway) * 100, ev, trend: bestEdge * 100 };
    }

    default:
      return null;
  }
}

// ─── Public API ───

/** Stratégies disponibles avec métadonnées UI */
export const HANDBALL_STRATEGY_DEFS: Record<HandballStrategyKey, { label: string; emoji: string; description: string }> = {
  bestTeam: { label: "Meilleure équipe", emoji: "🏆", description: "PPG pondéré L5/L10 — Felice 2025" },
  bestTeam1x2: { label: "1X2 Favori", emoji: "📊", description: "Probabilité dévigée depuis cotes marché" },
  over55: { label: "Over 55.5", emoji: "⬆️", description: "CMP sous-dispersé — Karlis 2026" },
  under62: { label: "Under 62.5", emoji: "⬇️", description: "CMP inverse — défense + gardien" },
  handicap: { label: "Handicap -4.5", emoji: "🎯", description: "Skellam goal difference — Karlis 2026" },
  btts30: { label: "BTTS 30+", emoji: "⚡", description: "Les deux marquent 30+ — bivarié" },
  htLeader: { label: "Leader HT", emoji: "⏱️", description: "Dominance 1ère période — copula HT→FT" },
  valueBet: { label: "Value Bet", emoji: "💰", description: "EV+ = P(model) > P(market)" },
};

/** Calcule le Top 8 par stratégie */
export function computeHandballStrategyTop8(
  finished: HandballMatch[],
  fixtures: HandballMatch[],
  opts?: { limit?: number },
): HandballStrategyResult {
  const limit = opts?.limit ?? 8;
  const formStore = buildFormStore(finished);

  const strategies = {} as Record<HandballStrategyKey, HandballStrategyEntry[]>;

  for (const key of Object.keys(HANDBALL_STRATEGY_DEFS) as HandballStrategyKey[]) {
    const entries: HandballStrategyEntry[] = [];

    for (const match of fixtures) {
      const scored = scoreMatch(key, formStore, match);
      if (!scored) continue;

      const hForm = formStore.get(String(match.home.id));
      const aForm = formStore.get(String(match.away.id));

      entries.push({
        matchId: String(match.id),
        league: match.league.name,
        leagueCountry: match.league.country,
        kickoff: match.kickoff,
        home: { name: match.home.name, shortName: match.home.shortName },
        away: { name: match.away.name, shortName: match.away.shortName },
        value: scored.value,
        pick: scored.pick,
        odds: match.odds ? { home: match.odds.home, draw: match.odds.draw, away: match.odds.away } : undefined,
        htScore: match.score?.homeHalf != null ? { home: match.score.homeHalf, away: match.score.awayHalf! } : undefined,
        formSummary: {
          home: formSummaryStr(hForm, 5),
          away: formSummaryStr(aForm, 5),
        },
        probPct: scored.probPct,
        ev: scored.ev,
        trend: scored.trend,
      });
    }

    // Tri par value décroissante, puis par odds si égal
    entries.sort((a, b) => {
      if (Math.abs(b.value - a.value) > 1e-9) return b.value - a.value;
      const oddsA = a.odds?.home ?? 0;
      const oddsB = b.odds?.home ?? 0;
      return oddsB - oddsA;
    });

    strategies[key] = entries.slice(0, limit);
  }

  return {
    window: "all",
    strategies,
    computedAt: new Date().toISOString(),
  };
}
