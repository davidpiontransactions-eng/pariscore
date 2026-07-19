export type League = {
  id: string;
  name: string;
  country: string;
  logo: string;
  tier: "T1" | "T2" | "CUP";
};

export type Team = {
  id: string;
  name: string;
  shortName: string;
  logo: string;
  color: string;
  form: ("W" | "D" | "L")[];
  rank: number;
};

export type FootballMatchOdds = {
  bookmaker: string;
  home: number;
  draw: number;
  away: number;
  impliedHome: number;
  impliedDraw: number;
  impliedAway: number;
  margin: number;
};

export type Prediction = {
  homeProb: number;
  drawProb: number;
  awayProb: number;
  bttsProb: number;
  over25Prob: number;
  model: string;
};

export type FootballLiveState = {
  homeScore: number;
  awayScore: number;
  minute: number;
  status: "LIVE" | "HT" | "FT" | "PEN";
  homePossession: number;
  homeShots: number;
  awayShots: number;
  homeShotsOnTarget: number;
  awayShotsOnTarget: number;
  homeCorners: number;
  awayCorners: number;
};

export type FootballMatch = {
  id: string;
  league: League;
  round: string;
  scheduledAt: string;
  home: Team;
  away: Team;
  prediction: Prediction;
  odds?: { bookmaker: string; home: number; draw: number; away: number };
  allOdds?: FootballMatchOdds[];
  live?: FootballLiveState | null;
};

const LEAGUES: Record<string, League> = {
  ligue1: { id: "ligue1", name: "Ligue 1", country: "France", logo: "🇫🇷", tier: "T1" },
  epl: { id: "epl", name: "Premier League", country: "England", logo: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", tier: "T1" },
  laliga: { id: "laliga", name: "La Liga", country: "Spain", logo: "🇪🇸", tier: "T1" },
  bundesliga: { id: "bundesliga", name: "Bundesliga", country: "Germany", logo: "🇩🇪", tier: "T1" },
  seriea: { id: "seriea", name: "Serie A", country: "Italy", logo: "🇮🇹", tier: "T1" },
};

const TEAM_LOGOS: Record<string, string> = {
  psg: "https://sfile.chatglm.cn/images-ppt/psg.png",
  marseille: "https://sfile.chatglm.cn/images-ppt/marseille.png",
  monaco: "https://sfile.chatglm.cn/images-ppt/monaco.png",
  lyon: "https://sfile.chatglm.cn/images-ppt/lyon.png",
  mancity: "https://sfile.chatglm.cn/images-ppt/mancity.png",
  arsenal: "https://sfile.chatglm.cn/images-ppt/arsenal.png",
  liverpool: "https://sfile.chatglm.cn/images-ppt/liverpool.png",
  chelsea: "https://sfile.chatglm.cn/images-ppt/chelsea.png",
  real: "https://sfile.chatglm.cn/images-ppt/real.png",
  barca: "https://sfile.chatglm.cn/images-ppt/barca.png",
  atletico: "https://sfile.chatglm.cn/images-ppt/atletico.png",
  bayern: "https://sfile.chatglm.cn/images-ppt/bayern.png",
  dortmund: "https://sfile.chatglm.cn/images-ppt/dortmund.png",
  leverkusen: "https://sfile.chatglm.cn/images-ppg/leverkusen.png",
  inter: "https://sfile.chatglm.cn/images-ppt/inter.png",
  milan: "https://sfile.chatglm.cn/images-ppt/milan.png",
  juve: "https://sfile.chatglm.cn/images-ppt/juve.png",
};

export const LIVE_MATCHES: FootballMatch[] = [
  {
    id: "fl1",
    league: LEAGUES.ligue1,
    round: "Journée 1",
    scheduledAt: "2026-07-19T20:00:00Z",
    home: {
      id: "psg", name: "Paris Saint-Germain", shortName: "PSG", logo: TEAM_LOGOS.psg, color: "#004170",
      form: ["W", "W", "W", "D", "W"], rank: 1,
    },
    away: {
      id: "marseille", name: "Olympique de Marseille", shortName: "OM", logo: TEAM_LOGOS.marseille, color: "#2FAEE0",
      form: ["W", "L", "W", "W", "D"], rank: 3,
    },
    prediction: { homeProb: 65, drawProb: 20, awayProb: 15, bttsProb: 55, over25Prob: 68, model: "Elo+Poisson" },
    odds: { bookmaker: "Bet365", home: 1.55, draw: 4.20, away: 5.50 },
    allOdds: [
      { bookmaker: "Bet365", home: 1.55, draw: 4.20, away: 5.50, impliedHome: 63, impliedDraw: 22, impliedAway: 15, margin: 0.028 },
      { bookmaker: "Bwin", home: 1.58, draw: 4.10, away: 5.30, impliedHome: 62, impliedDraw: 23, impliedAway: 15, margin: 0.030 },
      { bookmaker: "Winamax", home: 1.53, draw: 4.30, away: 5.60, impliedHome: 64, impliedDraw: 21, impliedAway: 15, margin: 0.032 },
    ],
    live: { homeScore: 2, awayScore: 1, minute: 72, status: "LIVE", homePossession: 58, homeShots: 12, awayShots: 7, homeShotsOnTarget: 5, awayShotsOnTarget: 3, homeCorners: 6, awayCorners: 3 },
  },
  {
    id: "fl2",
    league: LEAGUES.epl,
    round: "Matchweek 1",
    scheduledAt: "2026-07-19T20:00:00Z",
    home: {
      id: "mancity", name: "Manchester City", shortName: "MCI", logo: TEAM_LOGOS.mancity, color: "#6CABDD",
      form: ["W", "W", "W", "W", "L"], rank: 1,
    },
    away: {
      id: "arsenal", name: "Arsenal", shortName: "ARS", logo: TEAM_LOGOS.arsenal, color: "#EF0107",
      form: ["W", "W", "D", "W", "W"], rank: 2,
    },
    prediction: { homeProb: 55, drawProb: 25, awayProb: 20, bttsProb: 60, over25Prob: 65, model: "Elo+Poisson" },
    odds: { bookmaker: "Bet365", home: 1.80, draw: 3.80, away: 4.00 },
    live: { homeScore: 1, awayScore: 1, minute: 35, status: "LIVE", homePossession: 52, homeShots: 6, awayShots: 5, homeShotsOnTarget: 3, awayShotsOnTarget: 2, homeCorners: 3, awayCorners: 2 },
  },
  {
    id: "fl3",
    league: LEAGUES.laliga,
    round: "Jornada 1",
    scheduledAt: "2026-07-19T18:30:00Z",
    home: {
      id: "real", name: "Real Madrid", shortName: "RMA", logo: TEAM_LOGOS.real, color: "#FEBE10",
      form: ["W", "W", "D", "W", "W"], rank: 2,
    },
    away: {
      id: "barca", name: "FC Barcelona", shortName: "FCB", logo: TEAM_LOGOS.barca, color: "#A50044",
      form: ["W", "W", "W", "L", "W"], rank: 1,
    },
    prediction: { homeProb: 50, drawProb: 25, awayProb: 25, bttsProb: 70, over25Prob: 72, model: "Elo+Poisson" },
    odds: { bookmaker: "Bet365", home: 2.10, draw: 3.60, away: 3.30 },
    live: { homeScore: 0, awayScore: 0, minute: 12, status: "LIVE", homePossession: 55, homeShots: 3, awayShots: 1, homeShotsOnTarget: 1, awayShotsOnTarget: 0, homeCorners: 2, awayCorners: 0 },
  },
];

export const PREMATCH_MATCHES: FootballMatch[] = [
  {
    id: "fm1",
    league: LEAGUES.ligue1,
    round: "Journée 1",
    scheduledAt: "2026-07-20T20:00:00Z",
    home: {
      id: "monaco", name: "AS Monaco", shortName: "MON", logo: TEAM_LOGOS.monaco, color: "#E63E32",
      form: ["W", "D", "W", "L", "W"], rank: 5,
    },
    away: {
      id: "lyon", name: "Olympique Lyonnais", shortName: "OL", logo: TEAM_LOGOS.lyon, color: "#1D2C6B",
      form: ["L", "W", "W", "D", "W"], rank: 6,
    },
    prediction: { homeProb: 52, drawProb: 27, awayProb: 21, bttsProb: 62, over25Prob: 58, model: "Elo+Poisson" },
    odds: { bookmaker: "Bet365", home: 1.95, draw: 3.60, away: 3.70 },
    allOdds: [
      { bookmaker: "Bet365", home: 1.95, draw: 3.60, away: 3.70, impliedHome: 50, impliedDraw: 26, impliedAway: 24, margin: 0.030 },
      { bookmaker: "Bwin", home: 2.00, draw: 3.50, away: 3.50, impliedHome: 49, impliedDraw: 27, impliedAway: 24, margin: 0.032 },
    ],
  },
  {
    id: "fm2",
    league: LEAGUES.epl,
    round: "Matchweek 1",
    scheduledAt: "2026-07-20T17:00:00Z",
    home: {
      id: "liverpool", name: "Liverpool FC", shortName: "LIV", logo: TEAM_LOGOS.liverpool, color: "#C8102E",
      form: ["W", "W", "D", "W", "L"], rank: 3,
    },
    away: {
      id: "chelsea", name: "Chelsea FC", shortName: "CHE", logo: TEAM_LOGOS.chelsea, color: "#034694",
      form: ["D", "W", "L", "W", "D"], rank: 6,
    },
    prediction: { homeProb: 58, drawProb: 23, awayProb: 19, bttsProb: 55, over25Prob: 60, model: "Elo+Poisson" },
    odds: { bookmaker: "Bet365", home: 1.70, draw: 3.90, away: 4.50 },
  },
  {
    id: "fm3",
    league: LEAGUES.seriea,
    round: "Giornata 1",
    scheduledAt: "2026-07-20T20:00:00Z",
    home: {
      id: "inter", name: "Inter Milan", shortName: "INT", logo: TEAM_LOGOS.inter, color: "#010E80",
      form: ["W", "D", "W", "W", "L"], rank: 1,
    },
    away: {
      id: "milan", name: "AC Milan", shortName: "ACM", logo: TEAM_LOGOS.milan, color: "#FB090B",
      form: ["W", "W", "L", "D", "W"], rank: 3,
    },
    prediction: { homeProb: 55, drawProb: 25, awayProb: 20, bttsProb: 58, over25Prob: 62, model: "Elo+Poisson" },
    odds: { bookmaker: "Bwin", home: 1.75, draw: 3.80, away: 4.20 },
  },
  {
    id: "fm4",
    league: LEAGUES.bundesliga,
    round: "Spieltag 1",
    scheduledAt: "2026-07-20T15:30:00Z",
    home: {
      id: "bayern", name: "Bayern Munich", shortName: "BAY", logo: TEAM_LOGOS.bayern, color: "#DC052D",
      form: ["W", "L", "W", "W", "D"], rank: 3,
    },
    away: {
      id: "dortmund", name: "Borussia Dortmund", shortName: "BVB", logo: TEAM_LOGOS.dortmund, color: "#FDE100",
      form: ["W", "W", "D", "L", "W"], rank: 5,
    },
    prediction: { homeProb: 62, drawProb: 22, awayProb: 16, bttsProb: 65, over25Prob: 70, model: "Elo+Poisson" },
    odds: { bookmaker: "Winamax", home: 1.60, draw: 4.10, away: 4.80 },
  },
  {
    id: "fm5",
    league: LEAGUES.laliga,
    round: "Jornada 1",
    scheduledAt: "2026-07-20T21:00:00Z",
    home: {
      id: "atletico", name: "Atlético Madrid", shortName: "ATL", logo: TEAM_LOGOS.atletico, color: "#CB3524",
      form: ["D", "W", "W", "W", "D"], rank: 4,
    },
    away: {
      id: "leverkusen", name: "Bayer Leverkusen", shortName: "LEV", logo: TEAM_LOGOS.leverkusen, color: "#E32221",
      form: ["W", "W", "D", "W", "L"], rank: 1,
    },
    prediction: { homeProb: 48, drawProb: 28, awayProb: 24, bttsProb: 55, over25Prob: 58, model: "Elo+Poisson" },
    odds: { bookmaker: "Bet365", home: 2.15, draw: 3.40, away: 3.50 },
  },
  {
    id: "fm6",
    league: LEAGUES.ligue1,
    round: "Journée 1",
    scheduledAt: "2026-07-21T18:30:00Z",
    home: {
      id: "marseille", name: "Olympique de Marseille", shortName: "OM", logo: TEAM_LOGOS.marseille, color: "#2FAEE0",
      form: ["W", "L", "W", "W", "D"], rank: 3,
    },
    away: {
      id: "monaco", name: "AS Monaco", shortName: "MON", logo: TEAM_LOGOS.monaco, color: "#E63E32",
      form: ["W", "D", "W", "L", "W"], rank: 5,
    },
    prediction: { homeProb: 55, drawProb: 25, awayProb: 20, bttsProb: 60, over25Prob: 65, model: "Elo+Poisson" },
    odds: { bookmaker: "Bet365", home: 1.85, draw: 3.70, away: 3.90 },
  },
  {
    id: "fm7",
    league: LEAGUES.epl,
    round: "Matchweek 1",
    scheduledAt: "2026-07-21T20:00:00Z",
    home: {
      id: "arsenal", name: "Arsenal", shortName: "ARS", logo: TEAM_LOGOS.arsenal, color: "#EF0107",
      form: ["W", "W", "D", "W", "W"], rank: 2,
    },
    away: {
      id: "mancity", name: "Manchester City", shortName: "MCI", logo: TEAM_LOGOS.mancity, color: "#6CABDD",
      form: ["W", "W", "W", "W", "L"], rank: 1,
    },
    prediction: { homeProb: 42, drawProb: 28, awayProb: 30, bttsProb: 65, over25Prob: 68, model: "Elo+Poisson" },
    odds: { bookmaker: "Bet365", home: 2.40, draw: 3.50, away: 2.85 },
  },
  {
    id: "fm8",
    league: LEAGUES.seriea,
    round: "Giornata 1",
    scheduledAt: "2026-07-21T20:00:00Z",
    home: {
      id: "juve", name: "Juventus", shortName: "JUV", logo: TEAM_LOGOS.juve, color: "#000000",
      form: ["W", "D", "L", "W", "D"], rank: 4,
    },
    away: {
      id: "inter", name: "Inter Milan", shortName: "INT", logo: TEAM_LOGOS.inter, color: "#010E80",
      form: ["W", "D", "W", "W", "L"], rank: 1,
    },
    prediction: { homeProb: 45, drawProb: 30, awayProb: 25, bttsProb: 50, over25Prob: 55, model: "Elo+Poisson" },
    odds: { bookmaker: "Bet365", home: 2.30, draw: 3.30, away: 3.10 },
  },
  {
    id: "fm9",
    league: LEAGUES.bundesliga,
    round: "Spieltag 1",
    scheduledAt: "2026-07-21T15:30:00Z",
    home: {
      id: "leverkusen", name: "Bayer Leverkusen", shortName: "LEV", logo: TEAM_LOGOS.leverkusen, color: "#E32221",
      form: ["W", "W", "D", "W", "L"], rank: 1,
    },
    away: {
      id: "bayern", name: "Bayern Munich", shortName: "BAY", logo: TEAM_LOGOS.bayern, color: "#DC052D",
      form: ["W", "L", "W", "W", "D"], rank: 3,
    },
    prediction: { homeProb: 40, drawProb: 25, awayProb: 35, bttsProb: 68, over25Prob: 72, model: "Elo+Poisson" },
    odds: { bookmaker: "Bwin", home: 2.50, draw: 3.60, away: 2.70 },
  },
  {
    id: "fm10",
    league: LEAGUES.laliga,
    round: "Jornada 1",
    scheduledAt: "2026-07-21T18:30:00Z",
    home: {
      id: "barca", name: "FC Barcelona", shortName: "FCB", logo: TEAM_LOGOS.barca, color: "#A50044",
      form: ["W", "W", "W", "L", "W"], rank: 1,
    },
    away: {
      id: "atletico", name: "Atlético Madrid", shortName: "ATL", logo: TEAM_LOGOS.atletico, color: "#CB3524",
      form: ["D", "W", "W", "W", "D"], rank: 4,
    },
    prediction: { homeProb: 60, drawProb: 22, awayProb: 18, bttsProb: 58, over25Prob: 62, model: "Elo+Poisson" },
    odds: { bookmaker: "Winamax", home: 1.65, draw: 4.00, away: 4.50 },
  },
];

export const ALL_FOOTBALL_MATCHES: FootballMatch[] = [
  ...LIVE_MATCHES,
  ...PREMATCH_MATCHES,
];

/** Unique leagues present in the mock data. */
export const FOOTBALL_LEAGUES: League[] = Object.values(LEAGUES);
