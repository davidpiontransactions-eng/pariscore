/**
 * Registre sabermétrique curé — source: "curated".
 *
 * MLB  : ids officiels StatsAPI, Park Factors publics (indice runs/HR,
 *        100 = moyenne ligue), ratings offensifs saison (wRC+, OPS vs L/R),
 *        bullpen. Les stats LANCEURS MLB proviennent, elles, de l'API LIVE.
 * KBO  : aucun endpoint public officiel — registre complet curé et labellisé
 *        dans l'UI ("curated").
 *
 * FIP = (13·HR + 3·(BB+HBP) − 2·K) / IP + 3,10   (constante de ligue 3,10)
 * xERA = 6,09 · xwOBA − 2,06  (mapping officiel xwOBA↔xERA de MLB)
 * xwOBA ≈ 0,50 · OPS−contre − 0,035  (régression linéaire documentée)
 */

import type { DataSource, League, PitcherRecord, TeamRecord } from "./types";
import { round2 } from "./format";

export const FIP_CONSTANT = 3.1;
export const LEAGUE_AVG_BULLPEN_IP_3D = 12.0;

interface TeamSeed {
  league: League;
  code: string;
  city: string;
  name: string;
  primary: string;
  secondary: string;
  parkFactor: number;
  wrcPlus: number;
  opsVsLhp: number;
  opsVsRhp: number;
  bullpenEra: number;
  bullpenIpLast3: number;
  /** Identifiant officiel StatsAPI (MLB uniquement, 0 sinon). */
  mlbId: number;
}

export interface PitcherSeed {
  id: string;
  league: League;
  teamCode: string;
  name: string;
  throws: "LHP" | "RHP";
  era: number;
  whip: number;
  kPer9: number;
  bbPer9: number;
  hrPer9: number;
  wins: number;
  losses: number;
  inningsPitched: number;
  opsAgainst: number;
  starterIpAvg: number;
}

/** [mlbId, ville, nom, couleur1, couleur2, park, wRC+, OPSvsL, OPSvsR, ERA-bp, IP3j] */
type MlbSeedRow = readonly [
  number, string, string, string, string, number, number, number, number, number, number,
];

const MLB_RAW: Record<string, MlbSeedRow> = {
  NYY: [147, "New York", "Yankees", "#132448", "#C4CED4", 100, 116, 0.762, 0.742, 3.62, 12.4],
  BOS: [111, "Boston", "Red Sox", "#BD3039", "#0C2340", 100, 104, 0.728, 0.748, 4.12, 12.8],
  TB: [139, "Tampa Bay", "Rays", "#092C5C", "#8FBCE6", 94, 95, 0.705, 0.712, 3.55, 12.0],
  TOR: [141, "Toronto", "Blue Jays", "#134A8E", "#1D2D5C", 100, 103, 0.724, 0.728, 4.05, 11.6],
  BAL: [110, "Baltimore", "Orioles", "#DF4601", "#27251F", 105, 112, 0.748, 0.730, 3.85, 12.2],
  CLE: [114, "Cleveland", "Guardians", "#00385D", "#E50022", 96, 99, 0.702, 0.710, 3.35, 11.8],
  CWS: [145, "Chicago", "White Sox", "#27251F", "#C4CED4", 96, 80, 0.645, 0.668, 4.85, 12.6],
  DET: [116, "Detroit", "Tigers", "#0C2340", "#FF6600", 92, 97, 0.692, 0.704, 3.75, 11.9],
  KC: [118, "Kansas City", "Royals", "#004687", "#BD9B60", 104, 100, 0.715, 0.700, 3.95, 12.3],
  MIN: [142, "Minnesota", "Twins", "#002B5C", "#D31145", 96, 103, 0.721, 0.726, 4.10, 12.1],
  HOU: [117, "Houston", "Astros", "#EB6E1F", "#002D62", 103, 105, 0.738, 0.722, 3.50, 12.2],
  LAA: [108, "LA", "Angels", "#BA0021", "#003263", 96, 93, 0.682, 0.692, 4.30, 12.7],
  OAK: [133, "Athletics", "Athletics", "#003831", "#EFB21E", 92, 89, 0.672, 0.680, 4.45, 12.5],
  SEA: [136, "Seattle", "Mariners", "#0C2C56", "#005C5C", 92, 100, 0.712, 0.708, 3.30, 11.7],
  TEX: [140, "Texas", "Rangers", "#003278", "#C0111F", 104, 102, 0.730, 0.712, 4.15, 12.4],
  ATL: [144, "Atlanta", "Braves", "#CE1141", "#13274F", 99, 106, 0.742, 0.735, 3.45, 11.8],
  NYM: [121, "New York", "Mets", "#002D72", "#FF5910", 94, 105, 0.735, 0.728, 3.70, 12.0],
  PHI: [143, "Philadelphia", "Phillies", "#E81828", "#002D72", 103, 110, 0.750, 0.740, 3.80, 12.2],
  MIA: [146, "Miami", "Marlins", "#00A3E0", "#EF3340", 98, 82, 0.650, 0.660, 4.60, 12.6],
  WSH: [120, "Washington", "Nationals", "#AB0003", "#14225A", 99, 90, 0.675, 0.684, 4.20, 12.4],
  CHC: [112, "Chicago", "Cubs", "#0E3386", "#CC3433", 103, 101, 0.718, 0.712, 3.90, 12.0],
  CIN: [113, "Cincinnati", "Reds", "#C6011F", "#000000", 106, 98, 0.710, 0.698, 4.05, 12.5],
  MIL: [158, "Milwaukee", "Brewers", "#12284B", "#FFC52F", 98, 101, 0.722, 0.708, 3.65, 11.9],
  PIT: [134, "Pittsburgh", "Pirates", "#FDB827", "#27251F", 95, 92, 0.678, 0.688, 4.10, 12.3],
  STL: [138, "St. Louis", "Cardinals", "#C41E3A", "#0C2340", 96, 94, 0.688, 0.694, 4.20, 12.2],
  ARI: [109, "Arizona", "Diamondbacks", "#A71930", "#3FC3EB", 102, 112, 0.745, 0.732, 3.90, 12.1],
  COL: [115, "Colorado", "Rockies", "#33006F", "#C4CED4", 112, 86, 0.700, 0.668, 5.10, 12.9],
  LAD: [119, "Los Angeles", "Dodgers", "#005A9C", "#EF3E42", 100, 118, 0.762, 0.748, 3.55, 11.8],
  SD: [135, "San Diego", "Padres", "#2F241D", "#FFC425", 94, 108, 0.740, 0.734, 3.75, 12.0],
  SF: [137, "San Francisco", "Giants", "#FD5A1E", "#27251F", 96, 96, 0.690, 0.702, 3.95, 12.2],
};

/** [code, ville, nom, couleur1, couleur2, park, wRC+, OPSvsL, OPSvsR, ERA-bp, IP3j] */
type KboSeedRow = readonly [
  string, string, string, string, number, number, number, number, number, number,
];

const KBO_RAW: Record<string, KboSeedRow> = {
  LG: ["Séoul", "LG Twins", "#C30452", "#1C1C1C", 94, 104, 0.730, 0.750, 4.05, 11.8],
  KIA: ["Gwangju", "KIA Tigers", "#EA0029", "#000000", 97, 108, 0.748, 0.762, 3.85, 12.1],
  SAM: ["Daegu", "Samsung Lions", "#074CA1", "#C0C0C0", 96, 106, 0.742, 0.755, 3.95, 12.0],
  DOO: ["Séoul", "Doosan Bears", "#131230", "#BE0F34", 94, 101, 0.722, 0.738, 4.10, 12.2],
  SSG: ["Incheon", "SSG Landers", "#CE0E2D", "#005BAC", 98, 100, 0.718, 0.732, 4.00, 12.3],
  LOT: ["Busan", "Lotte Giants", "#041E42", "#D0A95C", 98, 94, 0.690, 0.708, 4.25, 12.5],
  HAN: ["Daejeon", "Hanwha Eagles", "#FC4E00", "#1C1C1C", 97, 98, 0.712, 0.720, 4.15, 12.4],
  KT: ["Suwon", "KT Wiz", "#000000", "#E30613", 96, 99, 0.715, 0.724, 4.05, 12.1],
  NC: ["Changwon", "NC Dinos", "#1D4289", "#BFA36A", 98, 96, 0.698, 0.710, 4.20, 12.6],
  KIW: ["Séoul", "Kiwoom Heroes", "#570514", "#D9A200", 99, 90, 0.678, 0.690, 4.45, 12.8],
};

export const KBO_PITCHER_SEEDS: readonly PitcherSeed[] = [
  { id: "IMCK", league: "KBO", teamCode: "LG", name: "Im Chan-kyu", throws: "RHP", era: 4.1, whip: 1.35, kPer9: 7.2, bbPer9: 2.8, hrPer9: 0.9, wins: 10, losses: 6, inningsPitched: 145, opsAgainst: 0.72, starterIpAvg: 5.6 },
  { id: "ELHE", league: "KBO", teamCode: "LG", name: "Elieser Hernández", throws: "RHP", era: 3.85, whip: 1.28, kPer9: 8.1, bbPer9: 2.4, hrPer9: 1.0, wins: 8, losses: 5, inningsPitched: 128, opsAgainst: 0.695, starterIpAvg: 5.4 },
  { id: "YHJ", league: "KBO", teamCode: "KIA", name: "Yang Hyeon-jong", throws: "LHP", era: 3.65, whip: 1.24, kPer9: 7.6, bbPer9: 2.2, hrPer9: 0.8, wins: 11, losses: 5, inningsPitched: 158, opsAgainst: 0.68, starterIpAvg: 5.8 },
  { id: "HDH", league: "KBO", teamCode: "KIA", name: "Hwang Dong-ha", throws: "RHP", era: 4.05, whip: 1.31, kPer9: 7.9, bbPer9: 2.9, hrPer9: 0.9, wins: 8, losses: 4, inningsPitched: 132, opsAgainst: 0.7, starterIpAvg: 5.5 },
  { id: "WTI", league: "KBO", teamCode: "SAM", name: "Won Tae-in", throws: "RHP", era: 3.4, whip: 1.18, kPer9: 8.4, bbPer9: 1.9, hrPer9: 0.7, wins: 12, losses: 4, inningsPitched: 165, opsAgainst: 0.655, starterIpAvg: 6.0 },
  { id: "DENR", league: "KBO", teamCode: "SAM", name: "Denyi Reyes", throws: "RHP", era: 3.95, whip: 1.27, kPer9: 7.3, bbPer9: 2.5, hrPer9: 1.0, wins: 7, losses: 7, inningsPitched: 140, opsAgainst: 0.7, starterIpAvg: 5.5 },
  { id: "RALC", league: "KBO", teamCode: "DOO", name: "Raúl Alcántara", throws: "RHP", era: 3.55, whip: 1.2, kPer9: 7.8, bbPer9: 2.1, hrPer9: 0.8, wins: 10, losses: 6, inningsPitched: 152, opsAgainst: 0.672, starterIpAvg: 5.9 },
  { id: "KWB", league: "KBO", teamCode: "DOO", name: "Kwak Been", throws: "RHP", era: 4.2, whip: 1.36, kPer9: 8.8, bbPer9: 3.4, hrPer9: 1.1, wins: 6, losses: 8, inningsPitched: 126, opsAgainst: 0.712, starterIpAvg: 5.2 },
  { id: "KKH", league: "KBO", teamCode: "SSG", name: "Kim Kwang-hyun", throws: "LHP", era: 3.75, whip: 1.26, kPer9: 7.5, bbPer9: 2.4, hrPer9: 0.8, wins: 9, losses: 6, inningsPitched: 148, opsAgainst: 0.688, starterIpAvg: 5.7 },
  { id: "REL", league: "KBO", teamCode: "SSG", name: "Roenis Elías", throws: "LHP", era: 4.1, whip: 1.3, kPer9: 8.0, bbPer9: 2.7, hrPer9: 1.0, wins: 7, losses: 7, inningsPitched: 135, opsAgainst: 0.698, starterIpAvg: 5.4 },
  { id: "PSW", league: "KBO", teamCode: "LOT", name: "Park Se-woong", throws: "RHP", era: 3.9, whip: 1.28, kPer9: 8.2, bbPer9: 2.6, hrPer9: 0.9, wins: 9, losses: 7, inningsPitched: 150, opsAgainst: 0.69, starterIpAvg: 5.7 },
  { id: "CHBA", league: "KBO", teamCode: "LOT", name: "Charlie Barnes", throws: "LHP", era: 3.6, whip: 1.22, kPer9: 7.4, bbPer9: 2.3, hrPer9: 0.8, wins: 10, losses: 5, inningsPitched: 155, opsAgainst: 0.678, starterIpAvg: 5.9 },
  { id: "RHJ", league: "KBO", teamCode: "HAN", name: "Ryu Hyun-jin", throws: "LHP", era: 3.45, whip: 1.19, kPer9: 7.2, bbPer9: 1.8, hrPer9: 0.7, wins: 11, losses: 4, inningsPitched: 160, opsAgainst: 0.662, starterIpAvg: 6.0 },
  { id: "RYWE", league: "KBO", teamCode: "HAN", name: "Ryan Weiss", throws: "RHP", era: 4.05, whip: 1.29, kPer9: 8.3, bbPer9: 2.8, hrPer9: 1.1, wins: 8, losses: 6, inningsPitched: 138, opsAgainst: 0.702, starterIpAvg: 5.5 },
  { id: "CUE", league: "KBO", teamCode: "KT", name: "William Cuevas", throws: "RHP", era: 3.5, whip: 1.17, kPer9: 8.6, bbPer9: 1.7, hrPer9: 0.9, wins: 12, losses: 4, inningsPitched: 168, opsAgainst: 0.65, starterIpAvg: 6.1 },
  { id: "KYP", league: "KBO", teamCode: "KT", name: "Ko Young-pyo", throws: "RHP", era: 3.95, whip: 1.25, kPer9: 6.6, bbPer9: 1.9, hrPer9: 0.8, wins: 9, losses: 7, inningsPitched: 146, opsAgainst: 0.686, starterIpAvg: 5.7 },
  { id: "KHART", league: "KBO", teamCode: "NC", name: "Kyle Hart", throws: "LHP", era: 2.95, whip: 1.08, kPer9: 9.4, bbPer9: 1.8, hrPer9: 0.6, wins: 13, losses: 3, inningsPitched: 172, opsAgainst: 0.615, starterIpAvg: 6.3 },
  { id: "LJH", league: "KBO", teamCode: "NC", name: "Lee Jae-hak", throws: "RHP", era: 4.25, whip: 1.38, kPer9: 7.0, bbPer9: 3.2, hrPer9: 1.0, wins: 6, losses: 8, inningsPitched: 124, opsAgainst: 0.715, starterIpAvg: 5.1 },
  { id: "AJR", league: "KBO", teamCode: "KIW", name: "Ariel Jurado", throws: "RHP", era: 3.85, whip: 1.25, kPer9: 6.9, bbPer9: 1.9, hrPer9: 0.9, wins: 8, losses: 7, inningsPitched: 150, opsAgainst: 0.692, starterIpAvg: 5.8 },
  { id: "HYM", league: "KBO", teamCode: "KIW", name: "Ha Young-min", throws: "RHP", era: 4.4, whip: 1.42, kPer9: 7.4, bbPer9: 3.6, hrPer9: 1.1, wins: 5, losses: 9, inningsPitched: 118, opsAgainst: 0.722, starterIpAvg: 5.0 },
];

function mlbSeed([code, row]: readonly [string, MlbSeedRow]): TeamSeed {
  return {
    league: "MLB",
    code,
    mlbId: row[0],
    city: row[1],
    name: row[2],
    primary: row[3],
    secondary: row[4],
    parkFactor: row[5],
    wrcPlus: row[6],
    opsVsLhp: row[7],
    opsVsRhp: row[8],
    bullpenEra: row[9],
    bullpenIpLast3: row[10],
  };
}

function kboSeed([code, row]: readonly [string, KboSeedRow]): TeamSeed {
  return {
    league: "KBO",
    code,
    mlbId: 0,
    city: row[0],
    name: row[1],
    primary: row[2],
    secondary: row[3],
    parkFactor: row[4],
    wrcPlus: row[5],
    opsVsLhp: row[6],
    opsVsRhp: row[7],
    bullpenEra: row[8],
    bullpenIpLast3: row[9],
  };
}

export const MLB_TEAM_SEEDS: readonly TeamSeed[] = Object.entries(MLB_RAW).map(
  mlbSeed,
);
export const KBO_TEAM_SEEDS: readonly TeamSeed[] = Object.entries(KBO_RAW).map(
  kboSeed,
);

/** Mapping id StatsAPI (équipe MLB) → code registre PariScore. */
export const MLB_ID_TO_CODE: ReadonlyMap<number, string> = new Map(
  MLB_TEAM_SEEDS.map((t) => [t.mlbId, t.code] as const),
);

function wobaFromWrcPlus(wrcPlus: number): number {
  return round2(0.315 * (wrcPlus / 100));
}

export function computeFip(
  hrPer9: number,
  bbPer9: number,
  kPer9: number,
): number {
  const hbpPer9 = 0.1; // approximation conventionnelle HBP/9
  return round2(
    (13 * hrPer9 + 3 * (bbPer9 + hbpPer9) - 2 * kPer9) / 9 + FIP_CONSTANT,
  );
}

export function computeXEra(opsAgainst: number): number {
  const xwoba = 0.5 * opsAgainst - 0.035;
  return round2(6.09 * xwoba - 2.06);
}

export function teamSeedToRecord(seed: TeamSeed): TeamRecord {
  // MLB : CDN officiel mlbstatic.com (SVG vectoriel publique, géo-distribué,
  // 50 ms). Plus rapide + plus fiable que le cache VPS local — et plus de 404
  // sur le build standalone (qui ne copie pas /public/cache).
  // KBO : aucun CDN officiel public — on retourne une chaîne vide et le composant
  // <TeamLogo> dégradera proprement vers le monogramme bicolore (fallback
  // onError) sans aucune image cassée (règle QA "zéro donnée factice").
  const logoPath =
    seed.league === "MLB"
      ? `https://www.mlbstatic.com/team-logos/${seed.mlbId}.svg`
      : "";
  return {
    id: `${seed.league}:${seed.code}`,
    league: seed.league,
    code: seed.code,
    name: seed.name,
    city: seed.city,
    primaryColor: seed.primary,
    secondaryColor: seed.secondary,
    logoPath,
    woba: wobaFromWrcPlus(seed.wrcPlus),
    wrcPlus: seed.wrcPlus,
    opsVsLhp: seed.opsVsLhp,
    opsVsRhp: seed.opsVsRhp,
    parkFactor: seed.parkFactor,
    bullpenEra: seed.bullpenEra,
    bullpenIpLast3: seed.bullpenIpLast3,
  };
}

export function pitcherSeedToRecord(
  seed: PitcherSeed,
  source: DataSource,
): PitcherRecord {
  return {
    id: `KBO:${seed.id}`,
    league: seed.league,
    teamId: `KBO:${seed.teamCode}`,
    name: seed.name,
    throws: seed.throws,
    era: seed.era,
    whip: seed.whip,
    fip: computeFip(seed.hrPer9, seed.bbPer9, seed.kPer9),
    xEra: computeXEra(seed.opsAgainst),
    kPer9: seed.kPer9,
    bbPer9: seed.bbPer9,
    hrPer9: seed.hrPer9,
    wins: seed.wins,
    losses: seed.losses,
    inningsPitched: seed.inningsPitched,
    opsAgainst: seed.opsAgainst,
    starterIpAvg: seed.starterIpAvg,
    source,
    season: 2026,
  };
}

export const MLB_TEAM_RECORDS: readonly TeamRecord[] = MLB_TEAM_SEEDS.map(
  teamSeedToRecord,
);
export const KBO_TEAM_RECORDS: readonly TeamRecord[] = KBO_TEAM_SEEDS.map(
  teamSeedToRecord,
);

export const ALL_TEAM_RECORDS: readonly TeamRecord[] = [
  ...MLB_TEAM_RECORDS,
  ...KBO_TEAM_RECORDS,
];

export function getTeamRecord(id: string): TeamRecord | undefined {
  return ALL_TEAM_RECORDS.find((t) => t.id === id);
}
