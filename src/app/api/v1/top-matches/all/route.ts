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
  strategy: StrategyTop5Key,
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
      // Double chance : toute victoire ou nul (selon variante)
      return picks
        .filter((p) => p.winProbability >= 0.55)
        .sort((a, b) => b.expectedValue - a.expectedValue)
        .slice(0, 10);

    case "over15":
    case "over65Corners":
      // Marchés de total : tri par EV décroissant
      return picks
        .filter((p) => p.winProbability >= 0.60)
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
    const strategyFilter = searchParams.get("strategy") ?? undefined;

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
        strategyFilter && STRATEGY_TOP5_KEYS.includes(strategyFilter as StrategyTop5Key)
          ? [strategyFilter as StrategyTop5Key]
          : (STRATEGY_TOP5_KEYS as StrategyTop5Key[]);

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
          case "bestDefense":
          case "doubleChance1X":
          case "doubleChance2X":
          case "doubleChance12": {
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
      strategyFilter && STRATEGY_TOP5_KEYS.includes(strategyFilter as StrategyTop5Key)
        ? [strategyFilter as StrategyTop5Key]
        : (STRATEGY_TOP5_KEYS as StrategyTop5Key[]);

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

    return NextResponse.json(result, { headers: CACHE_HEADERS });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    console.error("[top-matches/all] Erreur:", message);
    return NextResponse.json(
      { error: "Erreur interne", detail: message },
      { status: 500 },
    );
  }
}
