import { NextResponse } from "next/server";
import {
  computeProbabilities,
  computeEV,
  aggregateFromSources,
  selectTop10,
  type MatchInput,
  type StrategyPick,
} from "@/lib/services/predictive-engine";
import { STRATEGY_TOP5_KEYS, type StrategyTop5Key } from "@/lib/football-strategy-top5";
import { football, type FootballEvent } from "@/lib/api/bzzoiro-client";

// Lazy CJS require pour mmaService (module legacy)
let _mmaSvc: any = null;
function mmaSvc() {
  if (!_mmaSvc) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    _mmaSvc = require("../../../../../../services/mmaService");
  }
  return _mmaSvc;
}

/**
 * Clés de stratégies de cette route — pipeline indépendant du Top10
 * (conserve les stratégies edge historiques même si le moteur Top10 ne les sert plus).
 */
type AllRouteStrategyKey =
  | StrategyTop5Key
  | "edge1x2Home"
  | "drawValueLigue"
  | "edgeOU25";

const ALL_ROUTE_STRATEGY_KEYS: AllRouteStrategyKey[] = [
  ...STRATEGY_TOP5_KEYS,
  "edge1x2Home",
  "drawValueLigue",
  "edgeOU25",
];

// ─── Type de réponse ────────────────────────────────────────────────────────
type StrategyEntry = {
  strategy: string;
  label: string;
  picks: Array<{
    matchId: string;
    homeTeam: string;
    awayTeam: string;
    league: string;
    sport: string;
    probability: number;
    odds: number;
    ev: number;
    confidence: number;
    pick: string;
    edge: number;
  }>;
};

// ─── Headers cache CDN ──────────────────────────────────────────────────────

const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60",
};

// ─── Labels lisibles des stratégies ─────────────────────────────────────────

const STRATEGY_LABELS: Record<string, string> = {
  bestTeam: "Meilleure équipe (PPG)",
  bestTeam1x2: "Meilleure équipe (1X2)",
  gagnant: "Gagnant (Dixon-Coles)",
  bestAttack: "Meilleure attaque (xG)",
  bestDefense: "Meilleure défense",
  doubleChance: "Double chance",
  over15: "Over 1.5 buts",
  under35: "Under 3.5 buts",
  bttsYes: "Les deux marquent",
  over65Corners: "Over 6.5 corners",
  edge1x2Home: "Edge domicile 1X2",
  drawValueLigue: "Nul à valeur",
  edgeOU25: "Edge Over/Under 2.5",
};

// ─── Filtres par stratégie ──────────────────────────────────────────────────

/**
 * Filtre et trie les picks pour une stratégie donnée.
 * Chaque stratégie a ses propres critères de sélection.
 */
function filterForStrategy(
  picks: StrategyPick[],
  strategy: AllRouteStrategyKey,
): StrategyPick[] {
  switch (strategy) {
    case "bestTeam":
    case "bestTeam1x2":
    case "gagnant":
      // Favoris : proba > 50%, tri par EV décroissant
      return picks
        .filter((p) => p.winProbability >= 0.50)
        .sort((a, b) => b.expectedValue - a.expectedValue)
        .slice(0, 10);

    case "bestAttack":
      // Filtre les matchs avec plus de 2.5 buts attendus
      return picks
        .filter((p) => p.winProbability >= 0.55)
        .sort((a, b) => b.expectedValue - a.expectedValue)
        .slice(0, 10);

    case "bestDefense":
      // Équipe la plus étanche — tri par confiance décroissante
      return picks
        .filter((p) => p.winProbability >= 0.55)
        .sort((a, b) => b.confidenceScore - a.confidenceScore)
        .slice(0, 10);

    case "doubleChance1X":
    case "doubleChance2X":
    case "doubleChance12":
      // Double chance : proba DC correcte (≥65%), tri par EV décroissant
      return picks
        .filter((p) => p.winProbability >= 0.65)
        .sort((a, b) => b.expectedValue - a.expectedValue)
        .slice(0, 10);

    case "over15":
    case "over65Corners":
      // Marchés de total : tri par EV décroissant, edge > 2% requis
      return picks
        .filter((p) => p.winProbability >= 0.55 && p.edge > 0.02)
        .sort((a, b) => b.expectedValue - a.expectedValue)
        .slice(0, 10);

    case "under35":
      // Under : plus conservateur
      return picks
        .filter((p) => p.winProbability >= 0.60)
        .sort((a, b) => b.expectedValue - a.expectedValue)
        .slice(0, 10);

    case "bttsYes":
      return picks
        .filter((p) => p.winProbability >= 0.55)
        .sort((a, b) => b.expectedValue - a.expectedValue)
        .slice(0, 10);

    case "dnb":
      // Draw No Bet : favoris > 50% proba, tri par EV
      return picks
        .filter((p) => p.winProbability >= 0.50)
        .sort((a, b) => b.expectedValue - a.expectedValue)
        .slice(0, 10);

    case "edge1x2Home":
    case "edgeOU25":
      // Edge : positif uniquement
      return picks
        .filter((p) => p.edge > 0 && p.winProbability >= 0.50)
        .sort((a, b) => b.edge - a.edge)
        .slice(0, 10);

    case "drawValueLigue":
      // Nul : proba draw > 25%
      return picks
        .filter((p) => p.pick === "X" && p.winProbability >= 0.25)
        .sort((a, b) => b.expectedValue - a.expectedValue)
        .slice(0, 10);

    default:
      return picks
        .sort((a, b) => b.expectedValue - a.expectedValue)
        .slice(0, 10);
  }
}

// ─── Récupération des matchs BSD football ───────────────────────────────────

async function fetchBSDMatches(): Promise<FootballEvent[]> {
  try {
    const [evRes, liveRes] = await Promise.allSettled([
      football.events({ limit: 300 }),
      football.live(),
    ]);

    const events =
      evRes.status === "fulfilled" ? evRes.value?.results ?? [] : [];
    const live =
      liveRes.status === "fulfilled"
        ? Array.isArray(liveRes.value)
          ? liveRes.value
          : []
        : [];

    const liveIds = new Set(live.map((e) => e.id));
    return [
      ...live,
      ...events.filter((e) => !liveIds.has(e.id)),
    ];
  } catch {
    return [];
  }
}

// ─── Route GET ──────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sport = searchParams.get("sport") ?? "football";
    const timeframe = searchParams.get("timeframe") ?? "today";
    const limitRaw = parseInt(searchParams.get("limit") ?? "10", 10);
    const limit = Math.min(50, Math.max(1, isNaN(limitRaw) ? 10 : limitRaw));
    const strategyFilter = searchParams.get("strategy") ?? undefined;

    // Sports non-football : utiliser les adapters multi-sport
    const ADAPTER_SPORTS = new Set(["handball", "tennis", "basketball", "basket", "nba", "wnba", "f1", "cs2", "mma", "cycling", "fiba", "baseball", "rugby", "snooker", "hockey"]);
    if (ADAPTER_SPORTS.has(sport)) {
      const { fetchTopMatches } = await import("@/lib/top-matches");
      const groups = await fetchTopMatches(sport as Parameters<typeof fetchTopMatches>[0], limit, timeframe);
      return NextResponse.json({ groups, generated_at: new Date().toISOString() }, { headers: CACHE_HEADERS });
    }

    // Récupérer les matchs BSD pour le scoring
    const bsdMatches = await fetchBSDMatches();

    // Convertir en MatchInput pour le predictive engine
    const matchInputs: MatchInput[] = bsdMatches
      .filter((m) => m.status === "scheduled" || m.status === "live")
      .map((m) =>
        aggregateFromSources({
          bsd: {
            matchId: String(m.id),
            homeTeam: m.home?.name ?? "",
            awayTeam: m.away?.name ?? "",
            sport: "football",
            home_team_obj: m.home ? { id: m.home.id, short_name: m.home.short_name } : null,
            away_team_obj: m.away ? { id: m.away.id, short_name: m.away.short_name } : null,
          },
        }),
      );

    // Calculer les probabilités pour chaque match
    const allPicks: StrategyPick[] = [];

    for (const input of matchInputs) {
      const prob = computeProbabilities(input);

      // Générer un pick pour chaque stratégie
      const strategiesToProcess =
        strategyFilter && ALL_ROUTE_STRATEGY_KEYS.includes(strategyFilter as AllRouteStrategyKey)
          ? [strategyFilter as AllRouteStrategyKey]
          : ALL_ROUTE_STRATEGY_KEYS;

      for (const stratKey of strategiesToProcess) {
        // Déterminer le pick et la probabilité selon la stratégie
        let pick = "";
        let winProb = 0;
        let odds = 0;

        switch (stratKey) {
          case "bestTeam":
          case "bestTeam1x2":
          case "gagnant": {
            const maxProb = Math.max(
              prob.models.ensemble.home,
              prob.models.ensemble.away,
            );
            pick = prob.models.ensemble.home >= prob.models.ensemble.away ? "1" : "2";
            winProb = maxProb / 100;
            odds =
              prob.models.ensemble.home >= prob.models.ensemble.away
                ? (input.odds?.home ?? 0)
                : (input.odds?.away ?? 0);
            break;
          }
          case "bestAttack":
          case "bestDefense": {
            const maxProb = Math.max(
              prob.models.ensemble.home,
              prob.models.ensemble.away,
            );
            pick = prob.models.ensemble.home >= prob.models.ensemble.away ? "1" : "2";
            winProb = maxProb / 100;
            odds =
              prob.models.ensemble.home >= prob.models.ensemble.away
                ? (input.odds?.home ?? 0)
                : (input.odds?.away ?? 0);
            break;
          }
          case "doubleChance1X": {
            // DC 1X = P(domicile) + P(nul) — cote dé-vig depuis 1X2
            const hP = prob.models.ensemble.home / 100;
            const dP = prob.models.ensemble.draw / 100;
            winProb = Math.min(1, hP + dP);
            pick = "1X";
            const hO = input.odds?.home ?? 0;
            const dO = input.odds?.draw ?? 0;
            if (hO > 1 && dO > 1) {
              const iH = 1 / hO, iD = 1 / dO;
              const vig = iH + iD + (1 / (input.odds?.away ?? 2));
              const fH = iH / vig, fD = iD / vig;
              odds = 1 / (fH + fD);
            } else {
              odds = 0;
            }
            break;
          }
          case "doubleChance2X": {
            // DC 2X = P(extérieur) + P(nul)
            const hP2 = prob.models.ensemble.home / 100;
            const dP2 = prob.models.ensemble.draw / 100;
            const aP2 = prob.models.ensemble.away / 100;
            winProb = Math.min(1, aP2 + dP2);
            pick = "2X";
            const aO2 = input.odds?.away ?? 0;
            const dO2 = input.odds?.draw ?? 0;
            if (aO2 > 1 && dO2 > 1) {
              const iA = 1 / aO2, iD = 1 / dO2;
              const vig = (1 / (input.odds?.home ?? 2)) + iD + iA;
              const fA = iA / vig, fD = iD / vig;
              odds = 1 / (fA + fD);
            } else {
              odds = 0;
            }
            break;
          }
          case "doubleChance12": {
            // DC 12 = P(domicile) + P(extérieur) = 1 − P(nul)
            const hP12 = prob.models.ensemble.home / 100;
            const aP12 = prob.models.ensemble.away / 100;
            winProb = Math.min(1, hP12 + aP12);
            pick = hP12 >= aP12 ? "1" : "2";
            const hO12 = input.odds?.home ?? 0;
            const aO12 = input.odds?.away ?? 0;
            if (hO12 > 1 && aO12 > 1) {
              const iH = 1 / hO12, iA = 1 / aO12;
              const vig = iH + (1 / (input.odds?.draw ?? 2)) + iA;
              const fH = iH / vig, fA = iA / vig;
              odds = 1 / (fH + fA);
            } else {
              odds = 0;
            }
            break;
          }
          case "over15": {
            pick = "Over 1.5";
            winProb = prob.markets.over15 / 100;
            odds = input.odds?.over15 ?? 0;
            break;
          }
          case "under35": {
            pick = "Under 3.5";
            winProb = 1 - prob.markets.over35 / 100;
            odds = input.odds?.over35 ?? 0;
            break;
          }
          case "bttsYes": {
            pick = "BTTS Yes";
            winProb = prob.markets.bttsYes / 100;
            odds = input.odds?.bttsYes ?? 0;
            break;
          }
          case "edge1x2Home": {
            const fairHome =
              input.odds?.home && input.odds?.draw && input.odds?.away
                ? (1 / input.odds.home) /
                  (1 / input.odds.home +
                    1 / input.odds.draw +
                    1 / input.odds.away)
                : 0;
            const edge = prob.models.ensemble.home / 100 - fairHome;
            pick = "1";
            winProb = prob.models.ensemble.home / 100;
            odds = input.odds?.home ?? 0;
            if (edge <= 0) continue; // Pas d'edge → exclure
            allPicks.push({
              matchId: input.matchId,
              sport: input.sport,
              strategyType: stratKey,
              homeTeam: input.homeTeam,
              awayTeam: input.awayTeam,
              winProbability: winProb,
              expectedValue: computeEV(winProb, odds),
              odds,
              confidenceScore: prob.confidence,
              pick,
              edge,
            });
            continue;
          }
          case "edgeOU25": {
            if (!input.odds?.over25 || input.odds.over25 <= 1) continue;
            // Estimer la probabilité juste Over 2.5 depuis la cote (sans under25)
            const fairOver25 = 1 / input.odds.over25;
            const edge = prob.markets.over25 / 100 - fairOver25;
            pick = "Over 2.5";
            winProb = prob.markets.over25 / 100;
            odds = input.odds.over25;
            if (edge <= 0) continue;
            allPicks.push({
              matchId: input.matchId,
              sport: input.sport,
              strategyType: stratKey,
              homeTeam: input.homeTeam,
              awayTeam: input.awayTeam,
              winProbability: winProb,
              expectedValue: computeEV(winProb, odds),
              odds,
              confidenceScore: prob.confidence,
              pick,
              edge,
            });
            continue;
          }
          case "drawValueLigue": {
            pick = "X";
            winProb = prob.models.ensemble.draw / 100;
            odds = input.odds?.draw ?? 0;
            break;
          }
          case "over65Corners": {
            // Pas de cotes corners dans le moteur prédictif — on saute
            continue;
          }
          default:
            continue;
        }

        if (odds <= 1 || winProb <= 0) continue;

        allPicks.push({
          matchId: input.matchId,
          sport: input.sport,
          strategyType: stratKey,
          homeTeam: input.homeTeam,
          awayTeam: input.awayTeam,
          winProbability: winProb,
          expectedValue: computeEV(winProb, odds),
          odds,
          confidenceScore: prob.confidence,
          pick,
          edge: computeEV(winProb, odds),
        });
      }
    }

    // Grouper par stratégie et appliquer les filtres
    const strategiesToProcess =
      strategyFilter && ALL_ROUTE_STRATEGY_KEYS.includes(strategyFilter as AllRouteStrategyKey)
        ? [strategyFilter as AllRouteStrategyKey]
        : ALL_ROUTE_STRATEGY_KEYS;

    const result: StrategyEntry[] = strategiesToProcess.map((stratKey) => {
      const strategyPicks = allPicks.filter((p) => p.strategyType === stratKey);
      const filtered = filterForStrategy(strategyPicks, stratKey);

      return {
        strategy: stratKey,
        label: STRATEGY_LABELS[stratKey] ?? stratKey,
        picks: filtered.map((p) => ({
          matchId: p.matchId,
          homeTeam: p.homeTeam,
          awayTeam: p.awayTeam,
          league: "",
          sport: p.sport,
          probability: p.winProbability,
          odds: p.odds,
          ev: p.expectedValue,
          confidence: p.confidenceScore,
          pick: p.pick,
          edge: p.edge,
        })),
      };
    });

    // Construction de la réponse TopMatchResponse
    // Même si result est vide (aucune stratégie ne produit de picks après filtrage),
    // on renvoie toujours une structure valide pour éviter l'affichage "Aucun match top disponible"
    const groups: TopLeague[] = result.map((entry) => ({
      league: "",
      leagueIcon: "",
      leagueColor: "",
      sport: entry.strategy,
      matches: entry.picks,
    }));

    // ── MMA: injecter un groupe si sport=all ou sport=mma ──────────────────
    if (sport === "all" || sport === "mma") {
      try {
        const mmaFights = await mmaSvc().getMMAFights(process.env.ODDS_API_KEY);
        const now = Date.now();
        const mmaMatches = [] as Array<{
          id: string; home: { name: string; logo?: string }; away: { name: string; logo?: string };
          kickoff: string; status: "scheduled"; odds?: { home?: string; away?: string };
          badge?: { label: string; color: string }; probPct?: number; ev?: number;
        }>;

        for (const ev of mmaFights) {
          for (const f of ev.fights ?? []) {
            const ts = f.commence_time ? new Date(f.commence_time).getTime() : 0;
            if (ts <= now) continue; // passés
            const probA = f.prob_a != null ? Math.round(f.prob_a * 100) : null;
            const evA = f.ev_a_pct ?? null;
            const oddsA = f.best_odds_a ?? null;
            const isTitle = f.is_title;
            mmaMatches.push({
              id: `mma:${f.fighter_a}:${f.fighter_b}:${f.commence_time}`,
              home: { name: f.fighter_a, logo: f.photo_a ?? undefined },
              away: { name: f.fighter_b, logo: f.photo_b ?? undefined },
              kickoff: f.commence_time,
              status: "scheduled",
              odds: oddsA != null ? { home: oddsA.toFixed(2), away: f.best_odds_b?.toFixed(2) } : undefined,
              badge: isTitle ? { label: "Title", color: "#EF4444" } : f.bet_a || f.bet_b ? { label: "Value", color: "#10B981" } : undefined,
              probPct: probA ?? undefined,
              ev: evA ?? undefined,
            });
          }
        }

        // Trier par heure, limiter à 10
        mmaMatches.sort((a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime());
        const topMma = mmaMatches.slice(0, 10);

        if (topMma.length > 0) {
          groups.push({
            league: "UFC / MMA",
            leagueIcon: "🥊",
            leagueColor: "#EF4444",
            sport: "mma",
            matches: topMma,
          });
        }
      } catch (err) {
        console.error("[top-matches] MMA fetch error:", (err as Error).message);
      }
    }

    const response: TopMatchResponse = {
      groups,
      generated_at: new Date().toISOString(),
    };

    return NextResponse.json(response, {
      headers: CACHE_HEADERS,
    });
  } catch (err) {
    // En cas d'erreur critique, renvoyer une réponse vide mais valide
    // pour éviter l'affichage "Aucun match top disponible" intempestif
    return NextResponse.json({
      groups: [],
      generated_at: new Date().toISOString(),
    }, {
      status: 200,
      headers: CACHE_HEADERS,
    });
  }
}

// Type TopMatchResponse partagé
type TopLeague = {
  league: string;
  leagueIcon: string;
  leagueColor: string;
  sport: string;
  matches: unknown[];
};
type TopMatchResponse = {
  groups: TopLeague[];
  generated_at: string;
};