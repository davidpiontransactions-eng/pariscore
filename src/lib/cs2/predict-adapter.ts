import {
  predictMatch,
  type MatchPrediction,
  type TeamModel,
} from "@/lib/prediction/cs2/cs2-predictive-ml-engine";
import type { Cs2Enrichment, Cs2TeamEnrichment } from "./types";
import { canonMapName, toCanonMapWinrates } from "./types";

/**
 * Nombre de matchs par défaut injecté comme prior de confiance par carte.
 * La taille d'échantillon réelle n'est pas exposée par /api/cs2/enrich ; on
 * applique un prior conservateur (6 matchs) pour donner un poids modéré au
 * winrate empirique dans le blend Bradley-Terry sans écraser le terme ELO.
 */
const DEFAULT_MAP_SAMPLE = 6;

/**
 * Convertit un Cs2TeamEnrichment (sortie buildMatchEnrichment) en TeamModel
 * consommé par le moteur prédictif. Le winrate par carte privilégie la fenêtre
 * 3 mois (wr_3m — cohérent avec l'exigence 90j du Bradley-Terry), avec repli
 * sur le winrate all-time BSD.
 */
function toTeamModel(e: Cs2TeamEnrichment): TeamModel {
  const winrates: Record<string, number> = {};
  const sample: Record<string, number> = {};

  if (e.map_trends) {
    for (const [map, t] of Object.entries(e.map_trends)) {
      const canon = canonMapName(map);
      if (canon && t.wr_3m != null) {
        winrates[canon] = t.wr_3m;
        sample[canon] = DEFAULT_MAP_SAMPLE;
      }
    }
  }
  const allMaps = toCanonMapWinrates(e.all_maps);
  for (const [m, v] of Object.entries(allMaps)) {
    if (winrates[m] == null) {
      winrates[m] = v;
      sample[m] = Math.floor(DEFAULT_MAP_SAMPLE / 2);
    }
  }

  const meta = e.map_stats_meta;
  return {
    name: e.name,
    elo: e.elo_rating,
    hltvRank: e.rank,
    mapWinrates: winrates,
    mapSample: sample,
    ctWinrate: meta?.round_winrate_ct ?? null,
    tWinrate: meta?.round_winrate_t ?? null,
    formWinrate: e.form?.winrate ?? e.form_score ?? null,
  };
}

/**
 * Assemble et exécute le moteur prédictif CS2 pour un duel enrichi.
 */
export function buildCs2Prediction(
  enrichment: Cs2Enrichment,
  bestOf: 1 | 3 | 5,
  seed?: number,
): MatchPrediction | null {
  if (!enrichment?.team1 || !enrichment?.team2) return null;
  return predictMatch({
    team1: toTeamModel(enrichment.team1),
    team2: toTeamModel(enrichment.team2),
    bestOf,
    seed,
  });
}

/**
 * Expose les TeamModel assemblés (pour l'inférence du veto côté UI).
 */
export function buildCs2TeamModels(enrichment: Cs2Enrichment): {
  team1: TeamModel;
  team2: TeamModel;
} | null {
  if (!enrichment?.team1 || !enrichment?.team2) return null;
  return {
    team1: toTeamModel(enrichment.team1),
    team2: toTeamModel(enrichment.team2),
  };
}
