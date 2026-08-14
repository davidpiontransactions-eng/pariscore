import type { FootballMatch } from "@/lib/football-data";

/**
 * Compilateur de filtres en langage naturel — Phase 1 de la suite AI Pricing.
 *
 * Le texte utilisateur est compilé par Gemini (route /api/ai/football-nl-filter)
 * en règles JSON strictement typées, puis appliqué côté client par
 * `applyCompiledRules`. Le vocabulaire de champs ci-dessous est la SEULE source
 * de vérité partagée entre le prompt Gemini et le moteur de filtrage.
 */

export type FilterOperator = ">=" | "<=" | "==" | "delta_gt";

export interface CompiledFilterRule {
  /** Champ du modèle de données (ex: 'bttsProb', 'standingStats.home.ppg', 'liveDeltaShots'). */
  field: string;
  operator: FilterOperator;
  value: number;
  unit?: "percentage" | "ppg" | "count";
}

export interface AIFilterPreset {
  id: string;
  label: string;
  description: string;
  rules: CompiledFilterRule[];
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Vocabulaire de champs — partagé avec le prompt Gemini (voir route API).
// ---------------------------------------------------------------------------

export const FILTER_FIELD_VOCABULARY: { field: string; description: string }[] = [
  { field: "bttsProb", description: "Probabilité BTTS (les deux marquent), 0-100" },
  { field: "over15Prob", description: "Probabilité plus de 1.5 buts, 0-100" },
  { field: "over25Prob", description: "Probabilité plus de 2.5 buts, 0-100" },
  { field: "under35Prob", description: "Probabilité moins de 3.5 buts, 0-100" },
  { field: "homeProb", description: "Probabilité victoire domicile, 0-100" },
  { field: "awayProb", description: "Probabilité victoire extérieur, 0-100" },
  { field: "doubleChanceProb", description: "Probabilité double chance (meilleure option), 0-100" },
  { field: "cornerOverProb", description: "Probabilité meilleure ligne corners over, 0-100" },
  { field: "homePpg", description: "Points par match du domicile (contexte domicile)" },
  { field: "awayPpg", description: "Points par match de l'extérieur (contexte extérieur)" },
  { field: "homeGoalsForPg", description: "Buts marqués par match du domicile" },
  { field: "awayGoalsForPg", description: "Buts marqués par match de l'extérieur" },
  { field: "homeGoalsAgainstPg", description: "Buts encaissés par match du domicile" },
  { field: "awayGoalsAgainstPg", description: "Buts encaissés par match de l'extérieur" },
  { field: "homeWinRate", description: "Taux de victoire du domicile, 0-100" },
  { field: "awayWinRate", description: "Taux de victoire de l'extérieur, 0-100" },
  { field: "oddsHome", description: "Cote bookmaker victoire domicile" },
  { field: "oddsDraw", description: "Cote bookmaker match nul" },
  { field: "oddsAway", description: "Cote bookmaker victoire extérieur" },
  { field: "xgTotal", description: "Total xG attendus du match" },
  { field: "liveDeltaShots", description: "LIVE : tirs domicile − tirs extérieur (écart relatif)" },
  { field: "liveDeltaSot", description: "LIVE : tirs cadrés domicile − extérieur (écart relatif)" },
  { field: "liveDeltaCorners", description: "LIVE : corners domicile − extérieur (écart relatif)" },
  { field: "liveHomePossession", description: "LIVE : possession domicile, 0-100" },
];

// ---------------------------------------------------------------------------
// Résolution de champ — mappe un champ sur la valeur réelle d'un match.
// ---------------------------------------------------------------------------

/** Résout la valeur numérique d'un champ pour un match (null = donnée absente). */
export function resolveField(match: FootballMatch, field: string): number | null {
  const p = match.prediction;
  const st = p.standingStats;
  const live = match.live;

  switch (field) {
    case "bttsProb":
      return p.bttsProb;
    case "over15Prob":
      return p.over15Prob ?? null;
    case "over25Prob":
      return p.over25Prob;
    case "under35Prob":
      return p.under35Prob ?? null;
    case "homeProb":
      return p.homeProb;
    case "awayProb":
      return p.awayProb;
    case "doubleChanceProb":
      return p.doubleChance?.prob ?? null;
    case "cornerOverProb":
      return p.bestCornerOver?.overProb ?? null;
    case "homePpg":
      return st && st.home.played > 0 ? st.home.ppg : null;
    case "awayPpg":
      return st && st.away.played > 0 ? st.away.ppg : null;
    case "homeGoalsForPg":
      return st && st.home.played > 0 ? st.home.goalsFor / st.home.played : null;
    case "awayGoalsForPg":
      return st && st.away.played > 0 ? st.away.goalsFor / st.away.played : null;
    case "homeGoalsAgainstPg":
      return st && st.home.played > 0 ? st.home.goalsAgainst / st.home.played : null;
    case "awayGoalsAgainstPg":
      return st && st.away.played > 0 ? st.away.goalsAgainst / st.away.played : null;
    case "homeWinRate":
      return st && st.home.played > 0 ? (st.home.wins / st.home.played) * 100 : null;
    case "awayWinRate":
      return st && st.away.played > 0 ? (st.away.wins / st.away.played) * 100 : null;
    case "oddsHome":
      return match.odds?.home ?? null;
    case "oddsDraw":
      return match.odds?.draw ?? null;
    case "oddsAway":
      return match.odds?.away ?? null;
    case "xgTotal":
      return p.xGa && p.xGa.total > 0 ? p.xGa.total : null;
    case "liveDeltaShots":
      return live ? live.homeShots - live.awayShots : null;
    case "liveDeltaSot":
      return live ? live.homeShotsOnTarget - live.awayShotsOnTarget : null;
    case "liveDeltaCorners":
      return live ? live.homeCorners - live.awayCorners : null;
    case "liveHomePossession":
      return live && live.homePossession > 0 ? live.homePossession : null;
    default:
      return null;
  }
}

/** Évalue une règle sur un match. Donnée absente → règle non satisfaite (safe). */
export function evaluateRule(match: FootballMatch, rule: CompiledFilterRule): boolean {
  const value = resolveField(match, rule.field);
  if (value == null) return false;
  switch (rule.operator) {
    case ">=":
      return value >= rule.value;
    case "<=":
      return value <= rule.value;
    case "==":
      return Math.abs(value - rule.value) < 1e-9;
    case "delta_gt":
      return value > rule.value;
    default:
      return false;
  }
}

/** Applique un preset compilé (toutes les règles doivent passer). */
export function applyCompiledRules(
  matches: FootballMatch[],
  rules: CompiledFilterRule[],
): FootballMatch[] {
  if (rules.length === 0) return matches;
  return matches.filter((m) => rules.every((r) => evaluateRule(m, r)));
}

// ---------------------------------------------------------------------------
// Client API — compilation via la route Gemini.
// ---------------------------------------------------------------------------

export type CompileResult =
  | { ok: true; preset: AIFilterPreset }
  | { ok: false; error: string };

/** Compile une requête NL en preset de règles via /api/ai/football-nl-filter. */
export async function compileNLFilter(text: string): Promise<CompileResult> {
  try {
    const res = await fetch("/api/ai/football-nl-filter", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    const json = await res.json();
    if (!res.ok) {
      return { ok: false, error: json?.error ?? `Erreur ${res.status}` };
    }
    const preset = json.preset as Omit<AIFilterPreset, "id" | "createdAt">;
    if (!preset || !Array.isArray(preset.rules) || preset.rules.length === 0) {
      return { ok: false, error: "Aucune règle n'a pu être générée." };
    }
    return {
      ok: true,
      preset: {
        ...preset,
        id: `ai-filter-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        createdAt: new Date().toISOString(),
      },
    };
  } catch {
    return { ok: false, error: "Impossible de contacter le service IA." };
  }
}

/** Exemples de requêtes affichés dans le dialog (prompt chips). */
export const NL_FILTER_EXAMPLES: string[] = [
  "BTTS avec une équipe visiteuse forte : le domicile doit avoir au moins 1.2 PPG à domicile et la proba BTTS ≥ 55%",
  "Plus de 2.5 buts quand les deux équipes marquent au moins 1.5 buts par match",
  "Value sur le domicile : proba victoire domicile ≥ 55% et cote domicile ≥ 2.0",
  "Double chance solide : proba double chance ≥ 75% et moins de 3.5 buts probable",
  "LIVE : le domicile a au moins 5 tirs de plus que l'extérieur",
];
