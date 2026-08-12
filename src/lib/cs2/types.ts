import type { Cs2MapName } from "@/lib/prediction/cs2/cs2-predictive-ml-engine";

/** Équipe CS2 normalisée (sortie cs2Service.getCs2Matches / _normalizeMatch). */
export type Cs2Team = {
  id?: number | null;
  name: string;
  logo?: string | null;
  country?: string | null;
  hltv_rank?: number | null;
  elo_rating?: number | null;
};

/** Match CS2 complet (BSD normalisé). */
export type Cs2Match = {
  id: string;
  sport?: string;
  team1: Cs2Team;
  team2: Cs2Team;
  tournament?: string | null;
  tournament_id?: number | null;
  tournament_logo?: string | null;
  best_of?: number | null;
  scheduled?: string | null;
  status?: string;
  is_live?: boolean;
  current_map?: string | null;
  map_number?: number | null;
  maps_score?: { team1: number | null; team2: number | null };
  round_score?: { team1: number | null; team2: number | null };
  odds?: { team1: number | null; team2: number | null };
  is_lan?: boolean;
  prediction?: {
    team1_win_prob?: number | null;
    team2_win_prob?: number | null;
    predicted_winner?: string | null;
    confidence?: number | null;
  } | null;
};

// ─── Enrichment (buildMatchEnrichment) ────────────────────────────────────────

export type Cs2Player = {
  name: string;
  rating: number | null;
  adr: number | null;
  kast: number | null;
  kd: number | null;
  maps: number | null;
};

export type Cs2Form = {
  form: ("W" | "L" | "N")[];
  wins: number;
  losses: number;
  winrate: number | null;
  n: number;
};

export type Cs2MapTrend = {
  wr_3m: number | null;
  wr_6m: number | null;
  wr_1y: number | null;
  trend: "rising" | "declining" | "stable" | null;
  map_rank_3m: number | null;
  map_rank_6m: number | null;
};

export type Cs2TeamEnrichment = {
  name: string;
  rank: number | null;
  elo_rating: number | null;
  streak: unknown | null;
  form: Cs2Form | null;
  form_score: number | null;
  players: Cs2Player[];
  roster_strength: number | null;
  map_trends: Record<string, Cs2MapTrend> | null;
  all_maps: Record<string, number> | null;
  map_stats_meta: {
    map_winrate: number | null;
    round_winrate_ct: number | null;
    round_winrate_t: number | null;
    sample_size: number | null;
  } | null;
};

export type Cs2H2H = {
  t1wins: number;
  t2wins: number;
  results: ("T1" | "T2" | "N")[];
  detail?: {
    date: string | null;
    winner: "T1" | "T2" | "N";
    maps: { name: string | null; k1_score: number | null; k2_score: number | null }[];
  }[];
  n: number;
  last_date: string | null;
};

export type Cs2Enrichment = {
  team1: Cs2TeamEnrichment;
  team2: Cs2TeamEnrichment;
  h2h: Cs2H2H | null;
  map_winrate: {
    map: string;
    team1: number | null;
    team2: number | null;
    source: string;
    team1_ct_wr: number | null;
    team1_t_wr: number | null;
    team2_ct_wr: number | null;
    team2_t_wr: number | null;
  } | null;
  pistol_index: {
    ct_delta: number;
    t_delta: number;
    signal_ct: string;
    signal_t: string;
    trade_signal: string | null;
  } | null;
};

export type Cs2MapLikelihood = {
  ok: boolean;
  window_days?: number;
  predicted_map?: string | null;
  predicted_expected_rounds?: number | null;
  maps?: { map: string; prob: number; expected_rounds: number | null }[];
  error?: string;
};

// ─── Helpers purs ────────────────────────────────────────────────────────────

/**
 * Star-rating HLTV (1★ à 5★) selon le classement mondial de la structure.
 * 0★ si classement inconnu.
 */
export function hltvStars(rank: number | null | undefined): number {
  if (rank == null || rank <= 0) return 0;
  if (rank <= 2) return 5;
  if (rank <= 5) return 4;
  if (rank <= 10) return 3;
  if (rank <= 20) return 2;
  return 1;
}

/** "Vitality" → "VITALITY", "natus vincere" → "NATUS VINCERE" (initials). */
export function teamInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join("");
}

const MAP_ALIASES: Record<string, Cs2MapName> = {
  mirage: "Mirage",
  de_mirage: "Mirage",
  inferno: "Inferno",
  de_inferno: "Inferno",
  nuke: "Nuke",
  de_nuke: "Nuke",
  anubis: "Anubis",
  de_anubis: "Anubis",
  ancient: "Ancient",
  de_ancient: "Ancient",
  vertigo: "Vertigo",
  de_vertigo: "Vertigo",
  dust2: "Dust2",
  "dust ii": "Dust2",
  de_dust2: "Dust2",
};

/** Normalise un nom de carte (clé lowercase → Cs2MapName canonique). */
export function canonMapName(raw: string | null | undefined): Cs2MapName | null {
  if (!raw) return null;
  const key = raw.toLowerCase().replace(/[^a-z]/g, "");
  const direct = MAP_ALIASES[key];
  if (direct) return direct;
  const found = Object.values(MAP_ALIASES).find((m) => m.toLowerCase() === key);
  return found ?? null;
}

/** Convertit un record { "mirage": 72 } (clés lowercase) en Record<Cs2MapName, number>. */
export function toCanonMapWinrates(allMaps: Record<string, number> | null): Record<Cs2MapName, number> {
  const out: Record<Cs2MapName, number> = {} as Record<Cs2MapName, number>;
  if (!allMaps) return out;
  for (const [k, v] of Object.entries(allMaps)) {
    const canon = canonMapName(k);
    if (canon && typeof v === "number") out[canon] = v;
  }
  return out;
}
