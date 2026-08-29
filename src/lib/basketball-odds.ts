/**
 * Cote multi-bookmakers pour basketball via The Odds API.
 * Sport keys: "basketball_nba", "basketball_wnba", "basketball_euroleague".
 * Source: api.the-odds-api.com/v4 (clé dans ODDS_API_KEY).
 */

const ODDS_API_BASE = "https://api.the-odds-api.com/v4";
const FETCH_TIMEOUT_MS = 8_000;

/** Mapping ligue PariScore → The Odds API sport key. */
const ODDS_SPORT_KEY: Record<string, string> = {
  nba: "basketball_nba",
  wnba: "basketball_wnba",
  euroleague: "basketball_euroleague",
};

export type BasketballBookmakerOdd = {
  bookmaker: string;
  mlHome: number | null;
  mlAway: number | null;
  spreadHome: number | null;
  spreadHomeOdds: number | null;
  spreadAway: number | null;
  spreadAwayOdds: number | null;
  total: number | null;
  totalOver: number | null;
  totalUnder: number | null;
  impliedHome: number | null;
  impliedAway: number | null;
  margin: number;
};

export type OddsSnapshot = {
  timestamp: string;
  mlHome: number | null;
  mlAway: number | null;
  spreadHome: number | null;
  total: number | null;
  impliedHome: number | null;
  impliedAway: number | null;
};

type OddsApiMatch = {
  id: string;
  sport_key: string;
  home_team: string;
  away_team: string;
  bookmakers?: {
    key: string;
    title: string;
    markets: {
      key: string;
      outcomes: { name: string; price: number; point?: number }[];
    }[];
  }[];
};

/** Convert cotes américaines → probabilité implicite (%). */
function americanToImplied(ml: number): number {
  if (ml > 0) return 100 / (ml + 100);
  return (-ml) / (-ml + 100);
}

/** Convertir cotes américaines → décimales. */
function americanToDecimal(ml: number): number {
  if (ml > 0) return 1 + ml / 100;
  return 1 + 100 / Math.abs(ml);
}

/** Trouver leoutcome par nom (fuzzy: contains). */
function findOutcome(
  outcomes: { name: string; price: number; point?: number }[],
  teamName: string,
): { name: string; price: number; point?: number } | undefined {
  return outcomes.find(
    (o) =>
      o.name.toLowerCase().includes(teamName.toLowerCase()) ||
      teamName.toLowerCase().includes(o.name.toLowerCase()),
  );
}

/** Extraire les cotes multi-bookmakers depuis un OddsApiMatch. */
function extractMatchOdds(apiMatch: OddsApiMatch): BasketballBookmakerOdd[] {
  const out: BasketballBookmakerOdd[] = [];
  const seen = new Set<string>();

  for (const bm of apiMatch.bookmakers ?? []) {
    const bmTitle = bm.title ?? bm.key ?? "Unknown";
    if (seen.has(bmTitle)) continue;
    seen.add(bmTitle);

    // Moneyline (h2h)
    const h2hMarket = bm.markets?.find((mk) => mk.key === "h2h");
    const homeOutcome = h2hMarket
      ? findOutcome(h2hMarket.outcomes, apiMatch.home_team)
      : undefined;
    const awayOutcome = h2hMarket
      ? findOutcome(h2hMarket.outcomes, apiMatch.away_team)
      : undefined;

    // Spread
    const spreadMarket = bm.markets?.find((mk) => mk.key === "spreads");
    const spreadHome = spreadMarket
      ? findOutcome(spreadMarket.outcomes, apiMatch.home_team)
      : undefined;
    const spreadAway = spreadMarket
      ? findOutcome(spreadMarket.outcomes, apiMatch.away_team)
      : undefined;

    // Total
    const totalMarket = bm.markets?.find((mk) => mk.key === "totals");
    const totalOver = totalMarket?.outcomes.find(
      (o) => o.name.toLowerCase() === "over",
    );
    const totalUnder = totalMarket?.outcomes.find(
      (o) => o.name.toLowerCase() === "under",
    );

    const mlHome = homeOutcome?.price ?? null;
    const mlAway = awayOutcome?.price ?? null;

    // De-vig ML
    let impliedHome: number | null = null;
    let impliedAway: number | null = null;
    let margin = 0;
    if (mlHome != null && mlAway != null && mlHome > 0 && mlAway > 0) {
      const invHome = americanToImplied(mlHome);
      const invAway = americanToImplied(mlAway);
      const vig = invHome + invAway;
      impliedHome = Math.round((invHome / vig) * 1000) / 10;
      impliedAway = Math.round((invAway / vig) * 1000) / 10;
      margin = Math.round((vig - 1) * 1000) / 1000;
    }

    out.push({
      bookmaker: bmTitle,
      mlHome,
      mlAway,
      spreadHome: spreadHome?.point ?? null,
      spreadHomeOdds: spreadHome?.price ?? null,
      spreadAway: spreadAway?.point ?? null,
      spreadAwayOdds: spreadAway?.price ?? null,
      total: totalOver?.point ?? totalUnder?.point ?? null,
      totalOver: totalOver?.price ?? null,
      totalUnder: totalUnder?.price ?? null,
      impliedHome,
      impliedAway,
      margin,
    });
  }

  return out;
}

/**
 * Récupérer les cotes multi-bookmakers pour un match basketball.
 * @param league - "nba" | "wnba" | "euroleague"
 * @param homeTeam - nom équipe domicile (fuzzy match)
 * @param awayTeam - nom équipe extérieur (fuzzy match)
 */
export async function fetchBasketballOdds(
  league: string,
  homeTeam: string,
  awayTeam: string,
): Promise<BasketballBookmakerOdd[]> {
  const sportKey = ODDS_SPORT_KEY[league.toLowerCase()];
  if (!sportKey) return [];

  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) return [];

  const url = `${ODDS_API_BASE}/sports/${sportKey}/odds/?apiKey=${encodeURIComponent(apiKey)}&regions=us&markets=h2h,spreads,totals&oddsFormat=american`;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { Accept: "application/json" },
      next: { revalidate: 300 },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as OddsApiMatch[];
    if (!Array.isArray(data)) return [];

    // Trouver le match correspondant (fuzzy match sur les noms)
    const match = data.find((m) => {
      const homeMatch =
        m.home_team?.toLowerCase().includes(homeTeam.toLowerCase()) ||
        homeTeam.toLowerCase().includes(m.home_team?.toLowerCase());
      const awayMatch =
        m.away_team?.toLowerCase().includes(awayTeam.toLowerCase()) ||
        awayTeam.toLowerCase().includes(m.away_team?.toLowerCase());
      return homeMatch && awayMatch;
    });

    return match ? extractMatchOdds(match) : [];
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Récupérer l'historique des cotes pour un match (line movement).
 * The Odds API /v4/sports/{sport}/odds-history — retourne les snapshots horaires.
 * @param league - "nba" | "wnba"
 * @param homeTeam - nom équipe domicile
 * @param awayTeam - nom équipe extérieur
 * @param commenceAfter - ISO date (24h avant le match par défaut)
 */
export async function fetchOddsHistory(
  league: string,
  homeTeam: string,
  awayTeam: string,
  commenceAfter?: string,
): Promise<OddsSnapshot[]> {
  const sportKey = ODDS_SPORT_KEY[league.toLowerCase()];
  if (!sportKey) return [];

  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) return [];

  const after = commenceAfter ?? new Date(Date.now() - 86_400_000).toISOString();
  const url = `${ODDS_API_BASE}/sports/${sportKey}/odds-history/?apiKey=${encodeURIComponent(apiKey)}&regions=us&markets=h2h,spreads,totals&oddsFormat=american&date=${encodeURIComponent(after)}`;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { Accept: "application/json" },
      next: { revalidate: 600 },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as OddsApiMatch[];
    if (!Array.isArray(data)) return [];

    const match = data.find((m) => {
      const homeMatch =
        m.home_team?.toLowerCase().includes(homeTeam.toLowerCase()) ||
        homeTeam.toLowerCase().includes(m.home_team?.toLowerCase());
      const awayMatch =
        m.away_team?.toLowerCase().includes(awayTeam.toLowerCase()) ||
        awayTeam.toLowerCase().includes(m.away_team?.toLowerCase());
      return homeMatch && awayMatch;
    });
    if (!match) return [];

    // Extraire le premier bookmaker pour la timeline
    const bm = match.bookmakers?.[0];
    if (!bm) return [];

    const h2hMarket = bm.markets?.find((mk) => mk.key === "h2h");
    const spreadMarket = bm.markets?.find((mk) => mk.key === "spreads");
    const totalMarket = bm.markets?.find((mk) => mk.key === "totals");

    const homeOutcome = h2hMarket
      ? findOutcome(h2hMarket.outcomes, match.home_team)
      : undefined;
    const awayOutcome = h2hMarket
      ? findOutcome(h2hMarket.outcomes, match.away_team)
      : undefined;
    const spreadHome = spreadMarket
      ? findOutcome(spreadMarket.outcomes, match.home_team)
      : undefined;
    const totalOver = totalMarket?.outcomes.find(
      (o) => o.name.toLowerCase() === "over",
    );

    const mlHome = homeOutcome?.price ?? null;
    const mlAway = awayOutcome?.price ?? null;
    let impliedHome: number | null = null;
    let impliedAway: number | null = null;
    if (mlHome != null && mlAway != null && mlHome > 0 && mlAway > 0) {
      const invHome = americanToImplied(mlHome);
      const invAway = americanToImplied(mlAway);
      const vig = invHome + invAway;
      impliedHome = Math.round((invHome / vig) * 1000) / 10;
      impliedAway = Math.round((invAway / vig) * 1000) / 10;
    }

    return [{
      timestamp: new Date().toISOString(),
      mlHome,
      mlAway,
      spreadHome: spreadHome?.point ?? null,
      total: totalOver?.point ?? null,
      impliedHome,
      impliedAway,
    }];
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}
