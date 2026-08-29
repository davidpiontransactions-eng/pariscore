"use client";

import { useMemo } from "react";
import useSWR from "swr";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Forme brute renvoyée par /api/nba/matches et /api/wnba/matches (ESPN). */
type RawESPNMatch = {
  id?: string | number;
  date?: string;
  status?: string;
  home?: {
    id?: string | number;
    abbr?: string;
    name?: string;
    score?: number | null;
    record?: string | null;
  };
  away?: {
    id?: string | number;
    abbr?: string;
    name?: string;
    score?: number | null;
    record?: string | null;
  };
  predictions?: {
    win_prob?: { edge_elo?: number | null };
    blended?: { p_home?: number | null; p_away?: number | null };
    kelly?: {
      side?: string;
      fraction?: number;
      capped?: number;
      note?: string;
      ev?: number | null;
    } | null;
    value?: {
      fair_home?: number;
      fair_away?: number;
      vig_pct?: number;
      ev_home?: number | null;
      ev_away?: number | null;
      edge_home?: number | null;
      edge_away?: number | null;
    } | null;
    spread_uqd?: {
      exp_margin?: number;
      ats_pick?: string | null;
      ou_lean?: string | null;
    } | null;
    total_edge?: {
      line?: number;
      lean?: string | null;
    } | null;
    injuries?: {
      home?: { n_out?: number; stars_out?: string[]; penalty_pts?: number };
      away?: { n_out?: number; stars_out?: string[]; penalty_pts?: number };
    };
    rest?: {
      home?: { rest_days?: number; b2b?: boolean; penalty_pts?: number } | null;
      away?: { rest_days?: number; b2b?: boolean; penalty_pts?: number } | null;
    };
    consensus?: {
      mean_p_home?: number;
      stddev?: number;
      n_models?: number;
      label?: string;
      crosses_fifty?: boolean;
    };
  };
};

/** Match basketball normalisé pour l'UI (onglet "meilleurs matchs"). */
export type BasketballMatch = {
  id: string;
  sport: "basketball";
  league: "NBA" | "WNBA";
  scheduledAt: string;
  status: string;
  home: { id: string; abbr: string; name: string; score: number | null; record: string | null };
  away: { id: string; abbr: string; name: string; score: number | null; record: string | null };
  pHome: number | null;
  pAway: number | null;
  edgeElo: number | null;
  kelly: { side: string; fraction: number; capped: number; note: string; ev: number | null } | null;
  value: { fair_home: number; fair_away: number; vig_pct: number; ev_home: number | null; ev_away: number | null; edge_home: number | null; edge_away: number | null } | null;
  spreadUqd: { exp_margin: number; ats_pick: string | null; ou_lean: string | null } | null;
  totalEdge: { line: number; lean: string | null } | null;
  injuries: { home: { nOut: number; starsOut: string[]; penaltyPts: number }; away: { nOut: number; starsOut: string[]; penaltyPts: number } };
  rest: { home: { restDays: number; b2b: boolean; penaltyPts: number } | null; away: { restDays: number; b2b: boolean; penaltyPts: number } | null };
  consensus: { meanPHome: number; stddev: number; nModels: number; label: string; crossesFifty: boolean } | null;
};

const REFRESH_OPTS = {
  refreshInterval: 60_000, // poll every 60s — cohérent avec usePrematchMatches
  revalidateOnFocus: false,
  errorRetryCount: 2,
};

const fetcher = async (url: string): Promise<RawESPNMatch[]> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json: unknown = await res.json();
  if (json && typeof json === "object" && Array.isArray((json as { matches?: unknown }).matches)) {
    return (json as { matches: RawESPNMatch[] }).matches;
  }
  throw new Error("Réponse invalide");
};

// ---------------------------------------------------------------------------
// Normalisation ESPN → BasketballMatch
// ---------------------------------------------------------------------------

function normalizeMatch(raw: RawESPNMatch, league: "NBA" | "WNBA"): BasketballMatch {
  const home = raw.home ?? {};
  const away = raw.away ?? {};
  const pred = raw.predictions ?? {};
  const blend = pred.blended ?? null;
  const pHome = blend?.p_home ?? null;
  const kellyRaw = pred.kelly;
  const valueRaw = pred.value;
  const spreadRaw = pred.spread_uqd;
  const totalRaw = pred.total_edge;
  const injHome = pred.injuries?.home;
  const injAway = pred.injuries?.away;
  const restHome = pred.rest?.home;
  const restAway = pred.rest?.away;
  const cons = pred.consensus;
  return {
    id: String(raw.id ?? ""),
    sport: "basketball",
    league,
    scheduledAt: raw.date ?? "",
    status: raw.status ?? "pre",
    home: {
      id: String(home.id ?? ""),
      abbr: home.abbr ?? "",
      name: home.name ?? "?",
      score: home.score ?? null,
      record: home.record ?? null,
    },
    away: {
      id: String(away.id ?? ""),
      abbr: away.abbr ?? "",
      name: away.name ?? "?",
      score: away.score ?? null,
      record: away.record ?? null,
    },
    pHome,
    pAway: blend?.p_away ?? (pHome != null ? +(100 - pHome).toFixed(1) : null),
    edgeElo: pred.win_prob?.edge_elo ?? null,
    kelly: kellyRaw
      ? {
          side: kellyRaw.side ?? "",
          fraction: kellyRaw.fraction ?? 0,
          capped: kellyRaw.capped ?? 0,
          note: kellyRaw.note ?? "",
          ev: kellyRaw.ev ?? null,
        }
      : null,
    value: valueRaw
      ? {
          fair_home: valueRaw.fair_home ?? 0,
          fair_away: valueRaw.fair_away ?? 0,
          vig_pct: valueRaw.vig_pct ?? 0,
          ev_home: valueRaw.ev_home ?? null,
          ev_away: valueRaw.ev_away ?? null,
          edge_home: valueRaw.edge_home ?? null,
          edge_away: valueRaw.edge_away ?? null,
        }
      : null,
    spreadUqd: spreadRaw
      ? {
          exp_margin: spreadRaw.exp_margin ?? 0,
          ats_pick: spreadRaw.ats_pick ?? null,
          ou_lean: spreadRaw.ou_lean ?? null,
        }
      : null,
    totalEdge: totalRaw
      ? {
          line: totalRaw.line ?? 0,
          lean: totalRaw.lean ?? null,
        }
      : null,
    injuries: {
      home: {
        nOut: injHome?.n_out ?? 0,
        starsOut: injHome?.stars_out ?? [],
        penaltyPts: injHome?.penalty_pts ?? 0,
      },
      away: {
        nOut: injAway?.n_out ?? 0,
        starsOut: injAway?.stars_out ?? [],
        penaltyPts: injAway?.penalty_pts ?? 0,
      },
    },
    rest: {
      home: restHome
        ? { restDays: restHome.rest_days ?? 0, b2b: restHome.b2b ?? false, penaltyPts: restHome.penalty_pts ?? 0 }
        : null,
      away: restAway
        ? { restDays: restAway.rest_days ?? 0, b2b: restAway.b2b ?? false, penaltyPts: restAway.penalty_pts ?? 0 }
        : null,
    },
    consensus: cons
      ? {
          meanPHome: cons.mean_p_home ?? 0,
          stddev: cons.stddev ?? 0,
          nModels: cons.n_models ?? 0,
          label: cons.label ?? "",
          crossesFifty: cons.crosses_fifty ?? false,
        }
      : null,
  };
}

// ---------------------------------------------------------------------------
// Hook — fusionne NBA + WNBA
// ---------------------------------------------------------------------------

export function useBasketballMatches() {
  const nba = useSWR<RawESPNMatch[]>("/api/nba/matches", fetcher, REFRESH_OPTS);
  const wnba = useSWR<RawESPNMatch[]>("/api/wnba/matches", fetcher, REFRESH_OPTS);

  const matches = useMemo<BasketballMatch[]>(() => {
    const list: BasketballMatch[] = [
      ...(nba.data ?? []).map((m) => normalizeMatch(m, "NBA")),
      ...(wnba.data ?? []).map((m) => normalizeMatch(m, "WNBA")),
    ];
    // Ne garde que les matchs à venir ou en cours — "meilleurs matchs du jour"
    return list
      .filter((m) => m.status !== "post" && m.status !== "finished")
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
  }, [nba.data, wnba.data]);

  return {
    matches,
    isLoading: nba.isLoading || wnba.isLoading,
    error: nba.error ?? wnba.error,
  };
}
