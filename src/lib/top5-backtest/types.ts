/**
 * Types partagés du backtest « Top 5 par stratégie » (widgets sidebar).
 *
 * Principe d'honnêteté statistique : chaque entrée est un SNAPSHOT du top 5
 * tel qu'il était au moment de la prédiction (jamais recalculé a posteriori).
 * Le settlement se fait contre le résultat réel une fois le match terminé.
 * Pattern identique à src/lib/rugby/backtest.ts.
 */

export type Top5Sport = "football" | "tennis";

export type Top5BacktestStatus = "pending" | "won" | "lost" | "void";

/** Un pari du top 5 journalier d'une stratégie, figé au moment de la prédiction. */
export interface Top5BacktestEntry {
  /** Identifiant stable : `${sport}:${strategyKey}:${matchId}`. */
  id: string;
  sport: Top5Sport;
  strategyKey: string;
  matchId: string;
  league: string;
  /** Date/ISO du coup d'envoi prévu. */
  kickoff: string;
  /** Description lisible du pick (« Al Hilal », « Over 1,5 », « DC PSG »…). */
  pickDesc: string;
  /** Valeur de la stratégie au moment du pick (% ou λ selon la stratégie). */
  value: number;
  /** Côté pické si la stratégie désigne une équipe (« home »/« away » foot, « A »/« B » tennis). */
  pick?: string | null;
  /** Cote décimale pré-match si disponible (sinon null → exclu du ROI). */
  odds: number | null;
  /** Cote clôture (au moment du coup d'envoi), pour calcul CLV. Null si non dispo. */
  closingOdds: number | null;
  /** CLV en % : (pickOdds - closingOdds) / closingOdds ; null si closingOdds manquant. */
  clvPct: number | null;
  status: Top5BacktestStatus;
  settledAt?: string;
  /** Score final (« 2-1 ») ou total (« 11 corners ») pour audit visuel. */
  score?: string;
}

export interface StrategyBacktestStats {
  n: number;
  wins: number;
  losses: number;
  voids: number;
  pending: number;
  /** % de réussite sur les pariés (won+lost), null si échantillon vide. */
  winRatePct: number | null;
  /** Série en cours : >0 victoires consécutives, <0 défaites. */
  currentStreak: number;
  /** Réussite des 10 derniers pariés, null si <1. */
  l10WinRatePct: number | null;
  /** ROI mise fixe 1u, calculé uniquement sur les picks avec cote. */
  roi: { nWithOdds: number; roiPct: number | null };
  /** CLV moyen (%) sur les picks avec closingOdds — null si aucun. */
  avgClvPct: number | null;
}

export interface SportBacktestSummary {
  sport: Top5Sport;
  strategies: Record<string, StrategyBacktestStats>;
  /** Derniers picks réglés (chronologique inverse), pour le drawer UI. */
  recent: Top5BacktestEntry[];
  updatedAt: string;
  /** Rollup par league — présent uniquement quand ?by=league est passé (football). */
  byLeague?: Record<string, Record<string, StrategyBacktestStats>>;
  /** CLV moyen global — présent uniquement sur tennis. */
  avgClvPct?: number | null;
}

/**
 * Agrège les stats par stratégie depuis les entrées du store.
 * Tri chronologique requis pour streak et fenêtre L10.
 */
export function aggregateStrategyStats(
  entries: Top5BacktestEntry[],
  strategyKeys: readonly string[],
): Record<string, StrategyBacktestStats> {
  const out: Record<string, StrategyBacktestStats> = {};
  const chrono = [...entries].sort((a, b) => a.kickoff.localeCompare(b.kickoff));

  for (const key of strategyKeys) {
    const list = chrono.filter((e) => e.strategyKey === key);
    const decided = list.filter((e) => e.status === "won" || e.status === "lost");
    const wins = decided.filter((e) => e.status === "won").length;

    let streak = 0;
    for (let i = decided.length - 1; i >= 0; i--) {
      const s = decided[i].status === "won" ? 1 : -1;
      if (streak === 0 || Math.sign(streak) === s) streak += s;
      else break;
    }

    const l10 = decided.slice(-10);
    const staked = decided.reduce((a, e) => a + (e.odds != null && e.odds > 1 ? 1 : 0), 0);
    const pnl = decided.reduce((a, e) => {
      if (e.odds == null || e.odds <= 1) return a;
      return a + (e.status === "won" ? e.odds - 1 : -1);
    }, 0);

    // CLV moyen : uniquement les entrées avec clvPct non-null.
    const clvEntries = decided.filter((e) => e.clvPct != null);
    const avgClvPct =
      clvEntries.length > 0
        ? Math.round((clvEntries.reduce((a, e) => a + (e.clvPct ?? 0), 0) / clvEntries.length) * 100) / 100
        : null;

    out[key] = {
      n: list.length,
      wins,
      losses: decided.length - wins,
      voids: list.filter((e) => e.status === "void").length,
      pending: list.filter((e) => e.status === "pending").length,
      winRatePct: decided.length > 0 ? (wins / decided.length) * 100 : null,
      currentStreak: streak,
      l10WinRatePct: l10.length > 0 ? (l10.filter((e) => e.status === "won").length / l10.length) * 100 : null,
      roi: {
        nWithOdds: staked,
        roiPct: staked > 0 ? (pnl / staked) * 100 : null,
      },
      avgClvPct,
    };
  }
  return out;
}

/**
 * Agrège les stats par league (pour le drawer « Par championnat »).
 * Retourne un Record<league, StrategyBacktestStats> trié par ROI desc.
 */
export function aggregateByLeague(
  entries: Top5BacktestEntry[],
  strategyKey: string,
): Record<string, StrategyBacktestStats> {
  const filtered = entries.filter((e) => e.strategyKey === strategyKey);
  const byLeague = new Map<string, Top5BacktestEntry[]>();
  for (const e of filtered) {
    const league = e.league || "Inconnu";
    const list = byLeague.get(league) ?? [];
    list.push(e);
    byLeague.set(league, list);
  }
  const out: Record<string, StrategyBacktestStats> = {};
  for (const [league, list] of byLeague) {
    const stats = aggregateStrategyStats(list, [strategyKey]);
    out[league] = stats[strategyKey];
  }
  return out;
}
