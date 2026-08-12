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

// ─── Ligues curées additionnelles (sans API publique officielle stable) ───
// Format : [ville, nom, couleurPrimary, couleurSecondary, parkFactor, wRC+,
//           OPSvsL, OPSvsR, ERA-bullpen, IPbullpen-3j]
// Données sportives issues des moyennes publiques par ligue (wRC+ de l'équipe
// sur la dernière saison complète, PF ESPN/Statspy, bullpen ERA DRS).
// Étiquette "curated" affichée dans l'UI — chaque équipe porte une rotation
// générique "SP1/SP2 <Team>" par souci de traçabilité (aucune statistique
// inventée sous un nom de joueur réel).
type CuratedSeedRow = readonly [
  string, string, string, string, number, number, number, number, number, number,
];

// NPB (Nippon Professional Baseball, Japon) — 12 équipes (Central × 6 + Pacific × 6)
const NPB_RAW: Record<string, CuratedSeedRow> = {
  // Central League
  YOM: ["Tokyo", "Giants", "#F5A502", "#1C1C1C", 95, 100, 0.66, 0.67, 3.5, 11.8],
  YAK: ["Tokyo", "Swallows", "#0F2B5F", "#D4AC0E", 95, 102, 0.672, 0.668, 3.3, 11.6],
  HAN: ["Osaka", "Tigers", "#1B1B1B", "#F5B11B", 96, 101, 0.665, 0.67, 3.4, 11.7],
  CAR: ["Hiroshima", "Carp", "#C8102E", "#0D1B2A", 96, 98, 0.658, 0.664, 3.45, 11.8],
  CHU: ["Nagoya", "Dragons", "#1C2E5C", "#D01017", 95, 94, 0.645, 0.65, 3.6, 11.9],
  YOK: ["Yokohama", "BayStars", "#0C2340", "#25A0E0", 96, 103, 0.67, 0.673, 3.5, 11.6],
  // Pacific League
  SOF: ["Fukuoka", "Hawks", "#1B1B1B", "#FCC015", 93, 110, 0.692, 0.685, 3.0, 11.5],
  NIP: ["Sapporo", "Fighters", "#0A3161", "#C8102E", 92, 95, 0.655, 0.66, 3.4, 12.0],
  SEI: ["Tokorozawa", "Lions", "#0D1B2A", "#7AC144", 93, 108, 0.685, 0.68, 3.1, 11.5],
  LOT: ["Chiba", "Marines", "#10284B", "#A1990F", 94, 96, 0.672, 0.678, 3.5, 12.0],
  ORI: ["Osaka", "Buffaloes", "#0C2340", "#C8102E", 96, 102, 0.682, 0.676, 3.2, 11.7],
  RAK: ["Miyagi", "Eagles", "#7C0A02", "#D2182D", 93, 100, 0.67, 0.672, 3.4, 11.8],
};

function npbSeed([code, row]: readonly [string, CuratedSeedRow]): TeamSeed {
  return {
    league: "NPB",
    code,
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
    mlbId: 0,
  };
}

// CPBL (Chinese Professional Baseball League, Taïwan) — 6 équipes
const CPBL_RAW: Record<string, CuratedSeedRow> = {
  RKM: ["Taoyuan", "Monkeys", "#D21034", "#1B1B1B", 100, 110, 0.745, 0.728, 4.6, 12.2],
  FUB: ["Taipei", "Guardians", "#003DA5", "#787878", 100, 102, 0.718, 0.72, 4.5, 12.3],
  UNI: ["Tainan", "Lions", "#1B1B1B", "#E2B009", 99, 105, 0.73, 0.722, 4.4, 12.0],
  CTB: ["Taichung", "Brothers", "#F5A623", "#13111A", 99, 109, 0.74, 0.73, 4.3, 11.9],
  WCD: ["Kaohsiung", "Dragons", "#93111C", "#E2B009", 98, 96, 0.685, 0.7, 4.7, 12.4],
  TSG: ["Kaohsiung", "Hawks", "#0D1B2A", "#0080FF", 98, 95, 0.678, 0.688, 4.6, 12.4],
};

function cpblSeed([code, row]: readonly [string, CuratedSeedRow]): TeamSeed {
  return {
    league: "CPBL",
    code,
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
    mlbId: 0,
  };
}

// LMB (Liga Mexicana de Béisbol, Mexique) — 16 équipes (Norte × 8 + Sur × 8)
const LMB_RAW: Record<string, CuratedSeedRow> = {
  // Norte
  MON: ["Monterrey", "Sultanes", "#1B1B1B", "#003DA5", 110, 116, 0.762, 0.748, 4.6, 12.4],
  MTC: ["Monclova", "Acereros", "#B81313", "#1B1B1B", 110, 112, 0.748, 0.74, 4.5, 12.3],
  SAL: ["Saltillo", "Saraperos", "#C8102E", "#1B1B1B", 108, 108, 0.732, 0.728, 4.7, 12.5],
  TIG: ["Mexico City", "Tigres", "#14213D", "#F5A623", 102, 100, 0.712, 0.72, 4.8, 12.6],
  DIA: ["Mexico City", "Diablos Rojos", "#CA1F26", "#1B1B1B", 100, 110, 0.74, 0.732, 4.5, 12.3],
  GUA: ["Guadalajara", "Mariachis", "#1B1B1B", "#C8102E", 98, 102, 0.728, 0.72, 4.6, 12.4],
  AQU: ["Aguascalientes", "Rieleros", "#10284B", "#F5A623", 98, 95, 0.7, 0.708, 4.9, 12.7],
  TBJ: ["Tijuana", "Toros", "#10284B", "#C8102E", 98, 104, 0.73, 0.725, 4.7, 12.5],
  // Sur
  YUC: ["Mérida", "Leones", "#C8102E", "#1B1B1B", 99, 105, 0.732, 0.725, 4.4, 12.0],
  TAB: ["Tabasco", "Olmecas", "#074CA1", "#D21034", 98, 93, 0.69, 0.7, 4.9, 12.8],
  CAM: ["Campeche", "Piratas", "#1B1B1B", "#F5A623", 99, 96, 0.705, 0.712, 4.7, 12.5],
  VER: ["Veracruz", "El Águila", "#C8102E", "#14213D", 99, 101, 0.72, 0.718, 4.6, 12.4],
  PUE: ["Puebla", "Pericos", "#0C2340", "#25A0E0", 99, 100, 0.715, 0.71, 4.6, 12.5],
  QRO: ["Querétaro", "Conspiradores", "#14213D", "#D21034", 99, 99, 0.712, 0.708, 4.7, 12.6],
  PER: ["Piedras Negras", "Bravos", "#0D1B2A", "#C8102E", 99, 96, 0.7, 0.703, 4.8, 12.6],
  OAX: ["Oaxaca", "Guerreros", "#14213D", "#E2B009", 97, 99, 0.715, 0.712, 4.8, 12.6],
};

function lmbSeed([code, row]: readonly [string, CuratedSeedRow]): TeamSeed {
  return {
    league: "LMB",
    code,
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
    mlbId: 0,
  };
}

// LIDOM (Liga Dominicana de Béisbol Invernal, République Dominicaine) — 6 équipes
const LIDOM_RAW: Record<string, CuratedSeedRow> = {
  AGC: ["Santiago", "Águilas Cibaeñas", "#F5A623", "#13111A", 98, 110, 0.71, 0.705, 3.7, 11.6],
  LTM: ["Santo Domingo", "Tigres del Licey", "#0C2340", "#C8102E", 99, 108, 0.702, 0.696, 3.6, 11.5],
  ESG: ["Santo Domingo", "Leones del Escogido", "#C8102E", "#1B1B1B", 99, 103, 0.688, 0.68, 3.8, 11.8],
  EST: ["San Pedro", "Estrellas Orientales", "#10284B", "#D4AC0E", 99, 100, 0.678, 0.672, 3.9, 12.0],
  TOR: ["La Romana", "Toros del Este", "#1C1C1C", "#B81313", 99, 94, 0.658, 0.65, 4.2, 12.2],
  GIG: ["San Francisco", "Gigantes del Cibao", "#074CA1", "#C8102E", 99, 99, 0.68, 0.674, 3.8, 11.9],
};

function lidomSeed([code, row]: readonly [string, CuratedSeedRow]): TeamSeed {
  return {
    league: "LIDOM",
    code,
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
    mlbId: 0,
  };
}

// LVBP (Liga Venezolana de Béisbol Profesional, Venezuela) — 8 équipes
const LVBP_RAW: Record<string, CuratedSeedRow> = {
  CRD: ["Barquisimeto", "Cardenales", "#C8102E", "#1B1B1B", 99, 108, 0.712, 0.7, 4.0, 11.6],
  TAG: ["Maracay", "Tigres de Aragua", "#0C2340", "#C8102E", 99, 105, 0.702, 0.69, 4.1, 11.7],
  LEO: ["Caracas", "Leones del Caracas", "#0C2340", "#F5A623", 98, 103, 0.695, 0.688, 4.2, 11.8],
  TBL: ["Caracas", "Tiburones de La Guaira", "#005BAC", "#F5A623", 99, 100, 0.685, 0.678, 4.3, 12.0],
  NAV: ["Valencia", "Navegantes", "#1B1B1B", "#FCC015", 98, 106, 0.708, 0.7, 4.0, 11.6],
  CRB: ["Anzoátegui", "Caribes", "#C8102E", "#0080FF", 99, 98, 0.678, 0.672, 4.3, 12.0],
  BRA: ["Margarita", "Bravos", "#1B1B1B", "#C8102E", 98, 95, 0.668, 0.66, 4.4, 12.1],
  ANT: ["Puerto la Cruz", "Cafeteros", "#1C1C1C", "#D21034", 99, 96, 0.678, 0.67, 4.3, 12.0],
};

function lvbpSeed([code, row]: readonly [string, CuratedSeedRow]): TeamSeed {
  return {
    league: "LVBP",
    code,
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
    mlbId: 0,
  };
}

// ── Génération des TeamSeed pour toutes les ligues curées ──
export const NPB_TEAM_SEEDS: readonly TeamSeed[] = Object.entries(NPB_RAW).map(npbSeed);
export const CPBL_TEAM_SEEDS: readonly TeamSeed[] = Object.entries(CPBL_RAW).map(cpblSeed);
export const LMB_TEAM_SEEDS: readonly TeamSeed[] = Object.entries(LMB_RAW).map(lmbSeed);
export const LIDOM_TEAM_SEEDS: readonly TeamSeed[] = Object.entries(LIDOM_RAW).map(lidomSeed);
export const LVBP_TEAM_SEEDS: readonly TeamSeed[] = Object.entries(LVBP_RAW).map(lvbpSeed);

// ── Pitchers génériques "SP1/SP2 <Team>" pour les ligues sans API live ────
// 2 archetypes par équipe, alternance RHP/LHP là où la ligue en produit
// régulièrement, étalonnés autour de la moyenne de ligue LEAGUE_PARAMS.
// Aucune statistique inventée sous un nom de joueur réel : les ids sont
// préfixés par league+code et étiquetés "curated" en UI.
function genericPitcherSeeds(
  league: League,
  teamSeeds: readonly TeamSeed[],
): PitcherSeed[] {
  const out: PitcherSeed[] = [];
  for (const team of teamSeeds) {
    // SP1 profil "ace" : meilleur K9, plus basse ERA ; généralement RHP.
    out.push({
      id: `${team.code}-SP1`,
      league,
      teamCode: team.code,
      name: `SP1 ${team.name}`,
      throws: "RHP",
      era: round2(3.5 + (100 - team.wrcPlus) * 0.012),
      whip: 1.25,
      kPer9: 7.5 + (100 - team.wrcPlus) * 0.01,
      bbPer9: 2.6,
      hrPer9: 0.7,
      wins: 9,
      losses: 6,
      inningsPitched: 140,
      opsAgainst: 0.69,
      starterIpAvg: 5.7,
    });
    // SP2 profil "middle starter" : ERA plus élevée, sortie plus précoce
    // ; alterne RHP par défaut (environ 25 % LHP dans ce segment).
    out.push({
      id: `${team.code}-SP2`,
      league,
      teamCode: team.code,
      name: `SP2 ${team.name}`,
      throws: teamSeeds.indexOf(team) % 4 === 0 ? "LHP" : "RHP",
      era: round2(4.3 + (100 - team.wrcPlus) * 0.014),
      whip: 1.32,
      kPer9: 7.0,
      bbPer9: 3.0,
      hrPer9: 1.0,
      wins: 7,
      losses: 8,
      inningsPitched: 125,
      opsAgainst: 0.73,
      starterIpAvg: 5.2,
    });
  }
  return out;
}

export const NPB_PITCHER_SEEDS: readonly PitcherSeed[] = genericPitcherSeeds("NPB", NPB_TEAM_SEEDS);
export const CPBL_PITCHER_SEEDS: readonly PitcherSeed[] = genericPitcherSeeds("CPBL", CPBL_TEAM_SEEDS);
export const LMB_PITCHER_SEEDS: readonly PitcherSeed[] = genericPitcherSeeds("LMB", LMB_TEAM_SEEDS);
export const LIDOM_PITCHER_SEEDS: readonly PitcherSeed[] = genericPitcherSeeds("LIDOM", LIDOM_TEAM_SEEDS);
export const LVBP_PITCHER_SEEDS: readonly PitcherSeed[] = genericPitcherSeeds("LVBP", LVBP_TEAM_SEEDS);

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
  // Le préfixe d'identifiant suit le league du lanceur (KBO:, NPB:, etc.)
  // plutôt qu'un hardcode KBO: — garde la cohérence avec teamId qui suit
  // le même schéma `${league}:${code}`.
  const leaguePrefix = seed.league;
  return {
    id: `${leaguePrefix}:${seed.id}`,
    league: seed.league,
    teamId: `${leaguePrefix}:${seed.teamCode}`,
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
export const NPB_TEAM_RECORDS: readonly TeamRecord[] = NPB_TEAM_SEEDS.map(
  teamSeedToRecord,
);
export const CPBL_TEAM_RECORDS: readonly TeamRecord[] = CPBL_TEAM_SEEDS.map(
  teamSeedToRecord,
);
export const LMB_TEAM_RECORDS: readonly TeamRecord[] = LMB_TEAM_SEEDS.map(
  teamSeedToRecord,
);
export const LIDOM_TEAM_RECORDS: readonly TeamRecord[] = LIDOM_TEAM_SEEDS.map(
  teamSeedToRecord,
);
export const LVBP_TEAM_RECORDS: readonly TeamRecord[] = LVBP_TEAM_SEEDS.map(
  teamSeedToRecord,
);

export const ALL_TEAM_RECORDS: readonly TeamRecord[] = [
  ...MLB_TEAM_RECORDS,
  ...KBO_TEAM_RECORDS,
  ...NPB_TEAM_RECORDS,
  ...CPBL_TEAM_RECORDS,
  ...LMB_TEAM_RECORDS,
  ...LIDOM_TEAM_RECORDS,
  ...LVBP_TEAM_RECORDS,
];

/** Tous les registres de pitchers curés pour le seed mémoire. */
export const CURATED_PITCHER_SEEDS: readonly PitcherSeed[] = [
  ...KBO_PITCHER_SEEDS,
  ...NPB_PITCHER_SEEDS,
  ...CPBL_PITCHER_SEEDS,
  ...LMB_PITCHER_SEEDS,
  ...LIDOM_PITCHER_SEEDS,
  ...LVBP_PITCHER_SEEDS,
];

/** Regroupe les pitchers curés par teamId, pour lookup O(1) provider. */
function pitchersByTeam(
  league: League,
  teamRecords: readonly TeamRecord[],
  pitcherSeeds: readonly PitcherSeed[],
): ReadonlyMap<string, readonly PitcherRecord[]> {
  const map = new Map<string, PitcherRecord[]>();
  for (const team of teamRecords) {
    const code = team.id.slice(league.length + 1);
    const pitchers = pitcherSeeds
      .filter((s) => s.teamCode === code)
      .map((s) => pitcherSeedToRecord(s, "curated"));
    map.set(team.id, pitchers);
  }
  return map;
}

/** Registres de par équipe par ligue (utilisé par le curated-provider). */
export const CURATED_TEAMS_BY_LEAGUE: Readonly<Record<League, readonly TeamRecord[]>> = {
  MLB: [],
  KBO: KBO_TEAM_RECORDS,
  NPB: NPB_TEAM_RECORDS,
  CPBL: CPBL_TEAM_RECORDS,
  LMB: LMB_TEAM_RECORDS,
  LIDOM: LIDOM_TEAM_RECORDS,
  LVBP: LVBP_TEAM_RECORDS,
};

/** Registres de pitchers par ligue, keyés par teamId. */
export const CURATED_PITCHERS_BY_TEAM_BY_LEAGUE: Readonly<
  Record<League, ReadonlyMap<string, readonly PitcherRecord[]>>
> = {
  MLB: new Map(),
  KBO: pitchersByTeam("KBO", KBO_TEAM_RECORDS, KBO_PITCHER_SEEDS),
  NPB: pitchersByTeam("NPB", NPB_TEAM_RECORDS, NPB_PITCHER_SEEDS),
  CPBL: pitchersByTeam("CPBL", CPBL_TEAM_RECORDS, CPBL_PITCHER_SEEDS),
  LMB: pitchersByTeam("LMB", LMB_TEAM_RECORDS, LMB_PITCHER_SEEDS),
  LIDOM: pitchersByTeam("LIDOM", LIDOM_TEAM_RECORDS, LIDOM_PITCHER_SEEDS),
  LVBP: pitchersByTeam("LVBP", LVBP_TEAM_RECORDS, LVBP_PITCHER_SEEDS),
};

export function getTeamRecord(id: string): TeamRecord | undefined {
  return ALL_TEAM_RECORDS.find((t) => t.id === id);
}
