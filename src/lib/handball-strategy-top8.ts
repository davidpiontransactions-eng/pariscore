// Moteur stratégies handball — Top 8 par bet type 1xBet
// Basé sur : Felice 2025, Karlis 2026, Broermann 2026, Krawczyk 2025, Daza 2017
// Architecture : pure scoring lib (no I/O), miroir football-strategy-top5.ts

import type { HandballMatch, HandballLeague, HandballTeam, HandballOpeningOdds } from "./handball-data";
import { realExpectedTotal } from "./handball-real-data";
import {
  teamStrength,
  matchLambdas,
  overUnderProb,
  totalOverProb,
  cmpPmf,
  cmpKMax,
  CMP_MIN_HISTORY,
  type CmpTeam,
} from "./handball-cmp";
import { handicapProb, skellamMatchProbs } from "./handball-skellam";
import { BET_FLOOR } from "./handball-history-stats";

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
  /** Cotes d'ouverture (proxy CLV, badge edge widget) */
  openingOdds?: HandballOpeningOdds;
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
  /** Ligne Over/Under (ex: 57.5) */
  bestLine?: number;
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

/** Store de forme (exporté pour le walk-forward incrémental du backtest). */
export type HandballFormStore = FormStore;
/** Forme cumulée d'une équipe dans le store. */
export type HandballTeamForm = TeamForm;

/**
 * Ajoute UN match terminé au store de forme.
 * Extraction (perf 2026-09-25) : permet au backtest de construire le store de
 * façon INCRÉMENTALE (O(1) par match) au lieu de reconstruire depuis zéro à
 * chaque match × stratégie (O(n²) → 415 s sur 7 725 matchs).
 */
export function applyMatchToFormStore(store: FormStore, m: HandballMatch): void {
  if (!m.score) return;
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
  upsert(String(m.home.id), m.score.home, m.score.away, m.score.homeHalf, m.score.awayHalf);
  upsert(String(m.away.id), m.score.away, m.score.home, m.score.awayHalf, m.score.homeHalf);
}

/** Construit le store de forme depuis les matchs terminés */
export function buildFormStore(finished: HandballMatch[]): FormStore {
  const store = new Map<string, TeamForm>();
  for (const m of finished) applyMatchToFormStore(store, m);
  return store;
}

/** Moyenne des N dernières valeurs */
function avgLast(arr: number[], n: number): number {
  if (arr.length === 0) return 0;
  const slice = arr.slice(-n);
  return slice.reduce((a, b) => a + b, 0) / slice.length;
}

/**
 * PPG sur N derniers matchs.
 * Fix debug 2026-09-23 : `slice` calculé mais jamais utilisé → ppg(5) === ppg(10),
 * la pondération L5 60% / L10 40% de bestTeam était un no-op.
 * Perf 2026-09-25 : boucle sur les `min(n, len)` derniers éléments SANS slice —
 * `ppg(f, 1000)` copiait les tableaux entiers à chaque lecture (≈12× par match
 * dans le backtest → O(n²) en allocation/GC, cause n°2 des 415 s mesurés).
 */
export function ppg(f: TeamForm, n: number): number {
  const total = f.gf.length;
  if (total === 0) return 0;
  const k = Math.min(n, total);
  let pts = 0;
  for (let i = total - k; i < total; i++) {
    if (f.gf[i] > f.ga[i]) pts += 2;
    else if (f.gf[i] === f.ga[i]) pts += 1;
  }
  return pts / k;
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

/**
 * Cote 1X2 favori de repli quand le marché est absent (plan §8 valueBet).
 * Miroir AVG_ODDS_FAV_1X2 (handball-backtest.ts) — dupliqué ici pour
 * éviter un import circulaire (backtest importe déjà ce module).
 */
const VALUEBET_FALLBACK_ODDS = 1.55;

/** Fits CMP d'une équipe depuis le form store. Null si historique < 3. */
function cmpTeamOf(f: TeamForm | undefined): CmpTeam | null {
  if (!f || f.gf.length < CMP_MIN_HISTORY) return null;
  return teamStrength(f.gf, f.ga);
}

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

/**
 * Form summary W/D/L chronologique sur les N derniers matchs.
 * Fix debug 2026-09-23 : plafonnait les TOTAUX carrière (W=min(wins,n)) →
 * une équipe 5W+5L affichait "WWWWW" quel que soit le slice.
 */
export function formSummaryStr(f: TeamForm | undefined, n: number): string {
  if (!f) return "---";
  const total = f.gf.length;
  if (total === 0) return "---";
  const sliceGf = f.gf.slice(-n);
  const sliceGa = f.ga.slice(-n);
  let out = "";
  for (let i = 0; i < sliceGf.length; i++) {
    out += sliceGf[i] > sliceGa[i] ? "W" : sliceGf[i] === sliceGa[i] ? "D" : "L";
  }
  return out;
}

// ─── Main scoring engine ───

/** Score un match pour une stratégie donnée */
function scoreMatch(
  key: HandballStrategyKey,
  formStore: FormStore,
  match: HandballMatch,
): { value: number; pick: HandballSide | null; probPct?: number; ev?: number | null; trend?: number | null; bestLine?: number } | null {
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
      // Plan §8 : pick par forces CMP s_a/s_d (1X2 équitable Skellam).
      // Repli devig marché sans forme (comportement legacy conservé).
      const tH = cmpTeamOf(hForm);
      const tA = cmpTeamOf(aForm);
      if (tH && tA) {
        const L = matchLambdas(tH, tA);
        const p = skellamMatchProbs(L.lambdaH, L.lambdaE);
        const pick: HandballSide = p.home >= p.away ? "home" : "away";
        const prob = Math.max(p.home, p.away);
        return { value: prob * 100, pick, probPct: prob * 100 };
      }
      // De-vig odds (toujours depuis cotes marché)
      if (!match.odds?.home || !match.odds?.away) return null;
      const total = 1 / match.odds.home + (match.odds.draw ? 1 / match.odds.draw : 0) + 1 / match.odds.away;
      const pHome = (1 / match.odds.home) / total;
      const pAway = (1 / match.odds.away) / total;
      const pick: HandballSide = pHome >= pAway ? "home" : "away";
      return { value: Math.max(pHome, pAway) * 100, pick, probPct: Math.max(pHome, pAway) * 100 };
    }

    case "over55": {
      // Plan §8 : prob CMP (fits attaque/défense), scan de lignes conservé.
      const tH = cmpTeamOf(hForm);
      const tA = cmpTeamOf(aForm);
      if (tH && tA) {
        const L = matchLambdas(tH, tA);
        const kMax = Math.max(cmpKMax(L.lambdaH), cmpKMax(L.lambdaE));
        const pmfH = cmpPmf(L.lambdaH, L.nuH, kMax);
        const pmfA = cmpPmf(L.lambdaE, L.nuE, kMax);
        // Ligne la plus haute ≥ 55 % (miroir logique legacy, moteur CMP)
        let bestLine = 57.5;
        let bestProb = 0;
        for (let line = 45.5; line <= 65.5; line += 1) {
          const prob = totalOverProb(pmfH, pmfA, line);
          if (prob >= 0.55) {
            if (line > bestLine || bestLine === 57.5) {
              bestLine = line;
              bestProb = prob;
            }
          }
        }
        if (bestProb === 0) {
          for (let line = 45.5; line <= 65.5; line += 1) {
            const prob = totalOverProb(pmfH, pmfA, line);
            if (Math.abs(prob - 0.55) < Math.abs(bestProb - 0.55)) {
              bestLine = line;
              bestProb = prob;
            }
          }
        }
        // Fix debug : ev = null tant que vraies cotes Over/Under indisponibles
        return { value: bestProb * 100, pick: null, probPct: bestProb * 100, ev: null, bestLine };
      }
      // Repli legacy (Poisson sur totaux réels) sans forme CMP.
      const lambda = realExpectedTotal(match.home.name, match.away.name);
      // Trouver la ligne Over qui donne le plus proche de 55% (≥55%)
      let bestLine = 57.5;
      let bestProb = 0;
      // Scanner de 45.5 à 65.5 pour trouver la ligne optimale
      for (let line = 45.5; line <= 65.5; line += 1) {
        const prob = poissonGe(Math.ceil(line), lambda);
        if (prob >= 0.55) {
          // Cette ligne donne ≥55% — garder la plus haute ligne (plus de value)
          if (line > bestLine || bestLine === 57.5) {
            bestLine = line;
            bestProb = prob;
          }
        }
      }
      // Si aucune ligne ≥55%, prendre la plus proche
      if (bestProb === 0) {
        for (let line = 45.5; line <= 65.5; line += 1) {
          const prob = poissonGe(Math.ceil(line), lambda);
          if (Math.abs(prob - 0.55) < Math.abs(bestProb - 0.55)) {
            bestLine = line;
            bestProb = prob;
          }
        }
      }
      // Fix debug : ev = null tant que vraies cotes Over/Under indisponibles
      // (l'ancien calcul utilisait les cotes 1X2 home/away comme prix de total → EV fabriquée)
      const ev = null;
      return { value: bestProb * 100, pick: null, probPct: bestProb * 100, ev, bestLine };
    }

    case "under62": {
      // Plan §8 : prob CMP Under 62.5 (fits attaque/défense).
      const tH = cmpTeamOf(hForm);
      const tA = cmpTeamOf(aForm);
      if (tH && tA) {
        const L = matchLambdas(tH, tA);
        const { under } = overUnderProb(L.lambdaH, L.nuH, L.lambdaE, L.nuE, 62.5);
        // Fix debug : EV null (cotes 1X2 ≠ prix total Over/Under)
        return { value: under * 100, pick: null, probPct: under * 100, ev: null };
      }
      // Repli legacy sans forme CMP.
      const lambda = hasForm ? expectedTotal(formStore, match) : TOTAL_LINE;
      const adjustedLambda = lambda / Math.pow(CMP_NU, 0.5);
      const prob = poissonLe(62, adjustedLambda);
      // Fix debug : EV null (cotes 1X2 ≠ prix total Over/Under)
      const ev = null;
      return { value: prob * 100, pick: null, probPct: prob * 100, ev };
    }

    case "handicap": {
      // Plan §8 : handicap Skellam (λh/λe issus du CMP), symétrique home/away.
      const tH = cmpTeamOf(hForm);
      const tA = cmpTeamOf(aForm);
      if (tH && tA) {
        const L = matchLambdas(tH, tA);
        const hc = handicapProb(L.lambdaH, L.lambdaE, HANDICAP_LINE);
        const pick: HandballSide = L.lambdaH >= L.lambdaE ? "home" : "away";
        const prob = pick === "home" ? hc.home : hc.away;
        return { value: prob * 100, pick, probPct: prob * 100 };
      }
      // Repli legacy sans forme CMP.
      // Skellam goal difference (Karlis 2026)
      // Fix debug 2026-09-23 : away favori avait prob ≡ 0 (condition diff >= 0)
      // + HOME_ADV compté 2× (déjà dans expectedGoalDiff). Symétrique ici.
      const diff = hasForm ? expectedGoalDiff(formStore, match) : 0;
      const lambda = Math.abs(diff);
      const prob = poissonGe(Math.ceil(HANDICAP_LINE + 0.5), lambda);
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
      // EV+ = P(model) > P(market de-viggé)
      // Fix debug 2026-09-23 : pas de forme → null (l'ancien prior 0.45/0.50
      // fabriquait des edges ; marché 1/odds non de-viggé → edge biaisé).
      // Plan §8 : rejouable même sans cotes marché (repli AVG 1.55).
      if (!hasForm) return null;
      const oH = match.odds?.home ?? match.openingOdds?.fav1x2?.home;
      const oA = match.odds?.away ?? match.openingOdds?.fav1x2?.away;
      const oD = match.odds?.draw ?? match.openingOdds?.fav1x2?.draw;
      const pModelHome = winProb(formStore, match, "home");
      const pModelAway = winProb(formStore, match, "away");
      let pMarketHome: number;
      let pMarketAway: number;
      let coteH: number;
      let coteA: number;
      if (oH != null && oA != null) {
        const invH = 1 / oH;
        const invD = oD ? 1 / oD : 0;
        const invA = 1 / oA;
        const overround = invH + invD + invA;
        pMarketHome = invH / overround;
        pMarketAway = invA / overround;
        coteH = oH;
        coteA = oA;
      } else {
        // Sans cotes marché : implicite brut du repli (marge incluse, strict).
        pMarketHome = 1 / VALUEBET_FALLBACK_ODDS;
        pMarketAway = 1 / VALUEBET_FALLBACK_ODDS;
        coteH = VALUEBET_FALLBACK_ODDS;
        coteA = VALUEBET_FALLBACK_ODDS;
      }
      const edgeHome = pModelHome - pMarketHome;
      const edgeAway = pModelAway - pMarketAway;
      const bestEdge = Math.max(edgeHome, edgeAway);
      const pick: HandballSide = edgeHome >= edgeAway ? "home" : "away";
      const odds = pick === "home" ? coteH : coteA;
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
  over55: { label: "Over Total", emoji: "⬆️", description: "Ligne dynamique ≥55% proba — CMP sous-dispersé" },
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
        openingOdds: match.openingOdds,
        htScore: match.score?.homeHalf != null ? { home: match.score.homeHalf, away: match.score.awayHalf! } : undefined,
        formSummary: {
          home: formSummaryStr(hForm, 5),
          away: formSummaryStr(aForm, 5),
        },
        probPct: scored.probPct,
        ev: scored.ev,
        trend: scored.trend,
        bestLine: scored.bestLine,
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

// ─── Chips « Top stratégies » par ligne de calendrier ───

/**
 * Chip compact affiché au niveau d'une ligne du calendrier : stratégie dont la
 * proba modèle atteint le seuil BET_FLOOR (60 % — `handball-history-stats`).
 * Le calcul réutilise `scoreMatch` (mêmes formules que le Top8 widget, aucune
 * duplication) et couvre TOUS les matchs du calendrier (pas la troncature 8).
 */
export type HandballStrategyChip = {
  key: HandballStrategyKey;
  label: string;
  emoji: string;
  /** Probabilité en % (0-100). */
  probPct: number;
  pick: HandballSide | null;
  /** EV en FRACTION (ex. 0.085 = +8,5 %) — ×100 pourcentage côté UI. */
  ev?: number | null;
};

/** Stratégies exposant une VRAIE probabilité — bestTeam/htLeader en sont exclus
 *  (ils retournent {value, pick} sans probPct). */
const CHIP_STRATEGIES: HandballStrategyKey[] = [
  "bestTeam1x2",
  "over55",
  "under62",
  "handicap",
  "btts30",
  "valueBet",
];

/** Cotes réelles présentes (1X2 direct ou cotes d'ouverture 1X2). Sans elles,
 *  `valueBet` calcule son EV contre VALUEBET_FALLBACK_ODDS = 1.55 → EV
 *  synthétique (mesure 2026-09-25 : 0/536 fixtures du snapshot avaient des
 *  cotes → chips EV+ illégitimes). */
function hasRealOdds(match: HandballMatch): boolean {
  const direct = match.odds?.home != null && match.odds?.away != null;
  const opening =
    match.openingOdds?.fav1x2?.home != null && match.openingOdds?.fav1x2?.away != null;
  return direct || opening;
}

/**
 * Chips ≥ seuil pour chaque match du calendrier.
 *
 * @param finished matchs terminés (construit le form store)
 * @param fixtures matchs à venir (lignes du calendrier)
 * opts.threshold seuil en % (défaut 60 = BET_FLOOR × 100)
 * opts.minForm   matchs minimum par équipe (défaut CMP_MIN_HISTORY = 3)
 * opts.maxPerMatch chips maximum par ligne (défaut 4, tri proba décroissante)
 *
 * Garde-fous anti faux positifs :
 *  - `under62` exige la forme complète (sans elle le repli λ statique donne
 *    ~96 % systématique) ;
 *  - `valueBet` exige ev > 0 (sinon ce n'est pas un EV+) ;
 *  - `handicap` sans forme tombe à 0 % → filtré naturellement par le seuil.
 */
export function computeHandballMatchChips(
  finished: HandballMatch[],
  fixtures: HandballMatch[],
  opts?: { threshold?: number; minForm?: number; maxPerMatch?: number },
): Record<string, HandballStrategyChip[]> {
  const threshold = opts?.threshold ?? BET_FLOOR * 100;
  const minForm = opts?.minForm ?? CMP_MIN_HISTORY;
  const maxPerMatch = opts?.maxPerMatch ?? 4;
  const formStore = buildFormStore(finished);
  const out: Record<string, HandballStrategyChip[]> = {};

  for (const match of fixtures) {
    const hForm = formStore.get(String(match.home.id));
    const aForm = formStore.get(String(match.away.id));
    const hasForm =
      hForm != null && aForm != null && hForm.gf.length >= minForm && aForm.gf.length >= minForm;

    const chips: HandballStrategyChip[] = [];
    for (const key of CHIP_STRATEGIES) {
      if (key === "under62" && !hasForm) continue;
      if (key === "valueBet" && !hasRealOdds(match)) continue;
      const scored = scoreMatch(key, formStore, match);
      if (scored?.probPct == null) continue;
      if (key === "valueBet" && !(scored.ev != null && scored.ev > 0)) continue;
      if (scored.probPct < threshold) continue;
      const def = HANDBALL_STRATEGY_DEFS[key];
      chips.push({
        key,
        label: def.label,
        emoji: def.emoji,
        probPct: Math.round(scored.probPct * 10) / 10,
        pick: scored.pick,
        ev: scored.ev ?? null,
      });
    }

    if (!chips.length) continue;
    chips.sort((a, b) => b.probPct - a.probPct);
    out[String(match.id)] = chips.slice(0, maxPerMatch);
  }

  return out;
}

/**
 * Payload complet de la route `/api/handball/strategy-top8` : Top 8 par
 * stratégie + chips « Top stratégies ≥60 % » pour TOUTES les lignes du
 * calendrier. Point d'assemblage unique → le cache stocke exactement ce que
 * la réponse renvoie (fix review 2026-09-25 : le cold-path servait un payload
 * sans `chips`).
 */
export function computeHandballStrategyPayload(
  finished: HandballMatch[],
  fixtures: HandballMatch[],
  opts?: { limit?: number },
): HandballStrategyResult & { chips: Record<string, HandballStrategyChip[]> } {
  return {
    ...computeHandballStrategyTop8(finished, fixtures, opts),
    chips: computeHandballMatchChips(finished, fixtures),
  };
}
