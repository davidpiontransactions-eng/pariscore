// Types & enriched mock data for Tennis Prematch
// In production, replace MATCHES with a fetch to /api/tennis/prematch
// (which itself proxies The Odds API or your backend).

export type Surface = "Dur" | "Terre battue" | "Gazon";

export type Player = {
  id: string;
  name: string;
  shortName: string;
  rank: number;
  elo: number;
  surfaceElo?: number; // Elo restricted to upcoming surface (defaults to elo if absent)
  photoUrl: string;
  color: string; // hex, attached to the player
  form: ("W" | "L")[]; // most recent last
  country?: string;
  // --- Stats enrichies (depuis pariscore.db via /api/tennis/player-stats) ---
  // Optionnels : absents tant que le batch n'a pas été résolu. L'UI affiche
  // un fallback `—` quand la valeur est null (joueur inconnu / base vide).
  atpRank?: number | null;
  wtaRank?: number | null;
  /** Elo sur la surface du match (calculé, pas un alias de surfaceElo). */
  dbEloSurface?: number | null;
  /** Rang Elo Surface (classement du joueur sur cette surface). */
  surfaceEloRank?: number | null;
  /** Surface PowerScore [0-100]. */
  sps?: number | null;
  /** Rang SPS (classement du joueur sur cette surface). */
  spsRank?: number | null;
  /** Confiance du SPS (1 = sample suffisant). */
  spsConfidence?: number | null;
};

export type H2HMatch = {
  date: string; // ISO
  tournament: string;
  surface: Surface;
  winnerId: string;
  score: string; // e.g. "6-4, 6-3"
};

export type MatchStats = {
  form: string; // "5V-1D"
  eloGap: number; // positive = favori
  surface: Surface;
  h2h: string; // "5-2"
  ic: [number, number]; // [low, high] in %
  confidence: number; // 0-1
};

export type TennisMatch = {
  id: string;
  tournament: string;
  round: string;
  scheduledAt: string; // ISO
  playerA: Player; // favori (proba > 50)
  playerB: Player; // challenger
  probA: number; // 0-100
  probB: number; // 0-100
  stats: MatchStats;
  model: string;
  modelUpdatedAt: string; // ISO
  odds?: {
    bookmaker: string;
    decimalA: number;
    decimalB: number;
  };
  // Multi-bookmaker odds for the comparator (Itération 2)
  allOdds?: BookmakerOdd[];
  // H2H detailed history for the detail page (Itération 3)
  h2hHistory?: H2HMatch[];
};

export type BookmakerOdd = {
  bookmaker: string;
  decimalA: number;
  decimalB: number;
  // Derived: implied probability (vig removed) for player A
  impliedProbA: number;
  impliedProbB: number;
  margin: number; // bookmaker margin (vig), e.g. 0.05 = 5%
};

// Real player photos (sourced via image-search, OSS-hosted)
// In production, replace with your licensed ATP/WTA photo CDN URLs.
const PHOTO_URLS: Record<string, string> = {
  sabalenka: "https://sfile.chatglm.cn/images-ppt/cb2fb094e8bd.jpg",
  osaka:     "https://sfile.chatglm.cn/images-ppt/f277d164b034.jpg",
  alcaraz:   "https://sfile.chatglm.cn/images-ppt/987e0dbb7368.jpg",
  rublev:    "https://sfile.chatglm.cn/images-ppt/765d3f71ab16.jpg",
  sinner:    "https://sfile.chatglm.cn/images-ppt/f3083e0d32c5.jpg",
  medvedev:  "https://sfile.chatglm.cn/images-ppt/05c2dd9ee59d.jpg",
};

export const MATCHES: TennisMatch[] = [
  {
    id: "m1",
    tournament: "Wimbledon",
    round: "8èmes de finale",
    scheduledAt: "2026-07-08T14:00:00Z",
    playerA: {
      id: "sabalenka",
      name: "Aryna Sabalenka",
      shortName: "SABALENKA",
      rank: 1,
      elo: 2052,
      surfaceElo: 2090,
      photoUrl: PHOTO_URLS.sabalenka,
      color: "#1B4332",
      form: ["W", "W", "W", "W", "W", "L"],
      country: "BLR",
    },
    playerB: {
      id: "osaka",
      name: "Naomi Osaka",
      shortName: "OSAKA",
      rank: 14,
      elo: 1759,
      surfaceElo: 1740,
      photoUrl: PHOTO_URLS.osaka,
      color: "#5C2D91",
      form: ["L", "W", "W", "L", "W", "W"],
      country: "JPN",
    },
    probA: 84,
    probB: 16,
    stats: {
      form: "5V-1D",
      eloGap: 293,
      surface: "Gazon",
      h2h: "5-2",
      ic: [78, 89],
      confidence: 0.81,
    },
    model: "Elo+Forme+Surface+H2H",
    modelUpdatedAt: "2026-07-05T10:45:00Z",
    odds: { bookmaker: "Bet365", decimalA: 1.18, decimalB: 4.75 },
    allOdds: [
      { bookmaker: "Bet365", decimalA: 1.18, decimalB: 4.75, impliedProbA: 84, impliedProbB: 16, margin: 0.025 },
      { bookmaker: "Bwin", decimalA: 1.20, decimalB: 4.50, impliedProbA: 83, impliedProbB: 17, margin: 0.030 },
      { bookmaker: "Unibet", decimalA: 1.17, decimalB: 4.80, impliedProbA: 84, impliedProbB: 16, margin: 0.027 },
      { bookmaker: "Winamax", decimalA: 1.19, decimalB: 4.60, impliedProbA: 83, impliedProbB: 17, margin: 0.029 },
      { bookmaker: "PMU", decimalA: 1.15, decimalB: 5.00, impliedProbA: 85, impliedProbB: 15, margin: 0.033 },
    ],
    h2hHistory: [
      { date: "2024-01-21T00:00:00Z", tournament: "Australian Open", surface: "Dur", winnerId: "sabalenka", score: "6-0, 6-3" },
      { date: "2023-09-08T00:00:00Z", tournament: "US Open", surface: "Dur", winnerId: "sabalenka", score: "6-3, 6-3" },
      { date: "2023-01-20T00:00:00Z", tournament: "Australian Open", surface: "Dur", winnerId: "sabalenka", score: "6-2, 6-3" },
      { date: "2022-09-02T00:00:00Z", tournament: "US Open", surface: "Dur", winnerId: "sabalenka", score: "6-3, 6-4" },
      { date: "2022-03-12T00:00:00Z", tournament: "Indian Wells", surface: "Dur", winnerId: "osaka", score: "6-4, 6-4" },
      { date: "2021-02-14T00:00:00Z", tournament: "Australian Open", surface: "Dur", winnerId: "osaka", score: "6-2, 6-3" },
      { date: "2020-01-26T00:00:00Z", tournament: "Australian Open", surface: "Dur", winnerId: "osaka", score: "6-3, 6-2" },
    ],
  },
  {
    id: "m2",
    tournament: "Wimbledon",
    round: "8èmes de finale",
    scheduledAt: "2026-07-08T16:30:00Z",
    playerA: {
      id: "alcaraz",
      name: "Carlos Alcaraz",
      shortName: "ALCARAZ",
      rank: 2,
      elo: 2187,
      surfaceElo: 2210,
      photoUrl: PHOTO_URLS.alcaraz,
      color: "#B91C1C",
      form: ["W", "W", "W", "W", "W", "W"],
      country: "ESP",
    },
    playerB: {
      id: "rublev",
      name: "Andrey Rublev",
      shortName: "RUBLEV",
      rank: 8,
      elo: 1989,
      surfaceElo: 1980,
      photoUrl: PHOTO_URLS.rublev,
      color: "#0E7490",
      form: ["W", "L", "W", "W", "L", "W"],
      country: "RUS",
    },
    probA: 71,
    probB: 29,
    stats: {
      form: "6V-0D",
      eloGap: 198,
      surface: "Gazon",
      h2h: "4-2",
      ic: [63, 79],
      confidence: 0.74,
    },
    model: "Elo+Forme+Surface+H2H",
    modelUpdatedAt: "2026-07-05T10:45:00Z",
    odds: { bookmaker: "Bwin", decimalA: 1.40, decimalB: 2.95 },
    allOdds: [
      { bookmaker: "Bwin", decimalA: 1.40, decimalB: 2.95, impliedProbA: 70, impliedProbB: 30, margin: 0.030 },
      { bookmaker: "Bet365", decimalA: 1.38, decimalB: 3.00, impliedProbA: 71, impliedProbB: 29, margin: 0.028 },
      { bookmaker: "Unibet", decimalA: 1.42, decimalB: 2.90, impliedProbA: 69, impliedProbB: 31, margin: 0.032 },
      { bookmaker: "Winamax", decimalA: 1.41, decimalB: 2.95, impliedProbA: 70, impliedProbB: 30, margin: 0.030 },
      { bookmaker: "PMU", decimalA: 1.36, decimalB: 3.10, impliedProbA: 72, impliedProbB: 28, margin: 0.035 },
    ],
    h2hHistory: [
      { date: "2024-03-30T00:00:00Z", tournament: "Miami", surface: "Dur", winnerId: "alcaraz", score: "7-5, 6-3" },
      { date: "2023-11-10T00:00:00Z", tournament: "ATP Finals", surface: "Dur", winnerId: "alcaraz", score: "7-5, 6-2" },
      { date: "2023-03-18T00:00:00Z", tournament: "Indian Wells", surface: "Dur", winnerId: "alcaraz", score: "7-6, 6-1" },
      { date: "2022-10-26T00:00:00Z", tournament: "Basel", surface: "Dur", winnerId: "rublev", score: "6-4, 6-3" },
      { date: "2022-08-19T00:00:00Z", tournament: "Cincinnati", surface: "Dur", winnerId: "rublev", score: "6-4, 6-3" },
      { date: "2021-09-04T00:00:00Z", tournament: "US Open", surface: "Dur", winnerId: "alcaraz", score: "6-4, 7-5" },
    ],
  },
  {
    id: "m3",
    tournament: "Wimbledon",
    round: "8èmes de finale",
    scheduledAt: "2026-07-08T13:00:00Z",
    playerA: {
      id: "sinner",
      name: "Jannik Sinner",
      shortName: "SINNER",
      rank: 1,
      elo: 2241,
      surfaceElo: 2230,
      photoUrl: PHOTO_URLS.sinner,
      color: "#EA580C",
      form: ["W", "W", "W", "L", "W", "W"],
      country: "ITA",
    },
    playerB: {
      id: "medvedev",
      name: "Daniil Medvedev",
      shortName: "MEDVEDEV",
      rank: 5,
      elo: 2087,
      surfaceElo: 2090,
      photoUrl: PHOTO_URLS.medvedev,
      color: "#1D4ED8",
      form: ["W", "W", "L", "W", "W", "L"],
      country: "RUS",
    },
    probA: 58,
    probB: 42,
    stats: {
      form: "4V-2D",
      eloGap: 154,
      surface: "Gazon",
      h2h: "7-6",
      ic: [49, 67],
      confidence: 0.62,
    },
    model: "Elo+Forme+Surface+H2H",
    modelUpdatedAt: "2026-07-05T10:45:00Z",
    odds: { bookmaker: "Unibet", decimalA: 1.72, decimalB: 2.10 },
    allOdds: [
      { bookmaker: "Unibet", decimalA: 1.72, decimalB: 2.10, impliedProbA: 57, impliedProbB: 43, margin: 0.030 },
      { bookmaker: "Bet365", decimalA: 1.70, decimalB: 2.15, impliedProbA: 58, impliedProbB: 42, margin: 0.028 },
      { bookmaker: "Bwin", decimalA: 1.75, decimalB: 2.05, impliedProbA: 56, impliedProbB: 44, margin: 0.032 },
      { bookmaker: "Winamax", decimalA: 1.73, decimalB: 2.08, impliedProbA: 57, impliedProbB: 43, margin: 0.031 },
      { bookmaker: "PMU", decimalA: 1.68, decimalB: 2.20, impliedProbA: 59, impliedProbB: 41, margin: 0.034 },
    ],
    h2hHistory: [
      { date: "2024-09-04T00:00:00Z", tournament: "US Open", surface: "Dur", winnerId: "sinner", score: "7-5, 6-4, 6-3" },
      { date: "2024-08-20T00:00:00Z", tournament: "Cincinnati", surface: "Dur", winnerId: "sinner", score: "6-4, 6-3" },
      { date: "2024-03-30T00:00:00Z", tournament: "Miami", surface: "Dur", winnerId: "sinner", score: "7-6, 6-3" },
      { date: "2024-01-26T00:00:00Z", tournament: "Australian Open", surface: "Dur", winnerId: "sinner", score: "6-3, 6-3, 6-3" },
      { date: "2023-11-15T00:00:00Z", tournament: "ATP Finals", surface: "Dur", winnerId: "medvedev", score: "6-4, 6-2" },
      { date: "2023-10-25T00:00:00Z", tournament: "Vienne", surface: "Dur", winnerId: "sinner", score: "7-6, 6-3" },
      { date: "2023-09-08T00:00:00Z", tournament: "US Open", surface: "Dur", winnerId: "sinner", score: "6-3, 6-3" },
      { date: "2023-08-13T00:00:00Z", tournament: "Toronto", surface: "Dur", winnerId: "medvedev", score: "7-6, 6-3" },
      { date: "2023-06-09T00:00:00Z", tournament: "Roland-Garros", surface: "Terre battue", winnerId: "medvedev", score: "7-6, 6-3" },
      { date: "2023-03-28T00:00:00Z", tournament: "Miami", surface: "Dur", winnerId: "medvedev", score: "7-5, 6-3" },
      { date: "2023-01-22T00:00:00Z", tournament: "Australian Open", surface: "Dur", winnerId: "sinner", score: "6-3, 6-3, 4-6, 6-3" },
      { date: "2022-11-18T00:00:00Z", tournament: "ATP Finals", surface: "Dur", winnerId: "medvedev", score: "6-3, 6-3" },
      { date: "2022-10-26T00:00:00Z", tournament: "Vienne", surface: "Dur", winnerId: "medvedev", score: "6-4, 6-2" },
    ],
  },
];

/**
 * Format a relative time string.
 *
 * @param iso ISO timestamp
 * @param t   Translator for the `time` namespace from next-intl
 *            (`useTranslations('time')`). Accepts keys: `inMinutes`,
 *            `minutesAgo`, `inHours`, `hoursAgo`, `inDays`, `daysAgo`,
 *            `justNow`.
 * @param now Optional reference date (defaults to `new Date()`).
 */
export function formatRelativeTime(
  iso: string,
  t: (key: string, params?: Record<string, string | number | Date>) => string,
  now: Date = new Date(),
): string {
  const d = new Date(iso);
  const diffMs = d.getTime() - now.getTime();
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin === 0) return t("justNow");
  if (Math.abs(diffMin) < 60) {
    return diffMin >= 0
      ? t("inMinutes", { n: diffMin })
      : t("minutesAgo", { n: -diffMin });
  }
  const diffH = Math.round(diffMin / 60);
  if (Math.abs(diffH) < 24) {
    return diffH >= 0
      ? t("inHours", { n: diffH })
      : t("hoursAgo", { n: -diffH });
  }
  const diffD = Math.round(diffH / 24);
  return diffD >= 0
    ? t("inDays", { n: diffD })
    : t("daysAgo", { n: -diffD });
}
