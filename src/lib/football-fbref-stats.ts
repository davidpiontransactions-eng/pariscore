import { readFileSync, existsSync } from "fs";
import { join } from "path";

/**
 * Stats joueur FBref (passing, possession, defense, misc) — scrapé par
 * scripts/scrape_advanced_stats.py → data/fbref_advanced/{slug}_{season}.json.
 *
 * Chaque ligue contient player_season_stats[stat_type] = records avec :
 * Player, Nation, Pos, Squad, Age, Playing Time, et les colonnes spécifiques
 * à chaque stat_type.
 */

export type FbrefStatType = "passing" | "possession" | "defense" | "misc";

export type FbrefPlayerRecord = Record<string, unknown>;

type FbrefFile = {
  _meta: { league: string; slug: string; season: string; source: string };
  team_season_stats: Record<string, FbrefPlayerRecord[]>;
  player_season_stats: Record<string, FbrefPlayerRecord[]>;
};

const FBREF_DIR = join(process.cwd(), "data", "fbref_advanced");

const cache = new Map<string, FbrefFile | null>();

function readFbref(slug: string, season: string): FbrefFile | null {
  const key = `${slug}:${season}`;
  if (cache.has(key)) return cache.get(key) ?? null;
  let data: FbrefFile | null = null;
  try {
    const file = join(FBREF_DIR, `${slug}_${season}.json`);
    if (existsSync(file)) data = JSON.parse(readFileSync(file, "utf-8")) as FbrefFile;
  } catch {
    data = null;
  }
  cache.set(key, data);
  return data;
}

/**
 * Récupère les records joueurs pour un stat_type donné.
 * Retourne un tableau de records bruts (colonnes selon le type).
 */
export function fbrefPlayerStats(
  slug: string,
  season: string,
  statType: FbrefStatType,
): FbrefPlayerRecord[] | null {
  const file = readFbref(slug, season);
  const records = file?.player_season_stats?.[statType];
  if (!records || !records.length) return null;
  return records;
}

/**
 * Colonnes disponibles par stat_type (pour l'UI dynamic columns).
 */
export const FBREF_COLUMNS: Record<FbrefStatType, { key: string; label: string }[]> = {
  passing: [
    { key: "Total__Cmp", label: "Completions" },
    { key: "Total__Att", label: "Attempts" },
    { key: "Total__Cmp%", label: "CMP%" },
    { key: "Total__TotDist", label: "Total Dist" },
    { key: "Short__Cmp%", label: "Short CMP%" },
    { key: "Medium__Cmp%", label: "Medium CMP%" },
    { key: "Long__Cmp%", label: "Long CMP%" },
    { key: "Ast", label: "Ast" },
    { key: "xAG", label: "xAG" },
    { key: "xA", label: "xA" },
    { key: "Key Passes", label: "Key Passes" },
    { key: "Passes into Final 3rd", label: "Final 3rd" },
    { key: "Crs", label: "Crosses" },
    { key: "TW", label: "Switches" },
  ],
  possession: [
    { key: "Touches", label: "Touches" },
    { key: "Def Pen", label: "Def Pen" },
    { key: "Def 3rd", label: "Def 3rd" },
    { key: "Mid 3rd", label: "Mid 3rd" },
    { key: "Att 3rd", label: "Att 3rd" },
    { key: "Att Pen", label: "Att Pen" },
    { key: "Att", label: "Att" },
    { key: "Succ", label: "Succ" },
    { key: "Succ%", label: "Succ%" },
    { key: "Tkld", label: "Tkld" },
    { key: "Tkld%", label: "Tkld%" },
  ],
  defense: [
    { key: "Tkl", label: "Tkl" },
    { key: "TklW", label: "TklW" },
    { key: "Def 3rd", label: "Def 3rd" },
    { key: "Mid 3rd", label: "Mid 3rd" },
    { key: "Att 3rd", label: "Att 3rd" },
    { key: "Tkl+Att", label: "Tkl+Att" },
    { key: "Blocks", label: "Blocks" },
    { key: "Sh", label: "Sh Blocked" },
    { key: "Pass", label: "Pass Blocked" },
    { key: "Int", label: "Interceptions" },
    { key: "Tkl+Int", label: "Tkl+Int" },
    { key: "Clr", label: "Clearances" },
    { key: "Err", label: "Errors" },
  ],
  misc: [
    { key: "Fls", label: "Fouls" },
    { key: "Fld", label: "Fouled" },
    { key: "Off", label: "Offsides" },
    { key: "Crs", label: "Crosses" },
    { key: "OG", label: "OG" },
    { key: "PKwon", label: "PK Won" },
    { key: "PKcon", label: "PK Conceded" },
    { key: "Recov", label: "Recoveries" },
    { key: "Won%", label: "Aerial Won%" },
    { key: "Lost", label: "Aerial Lost" },
  ],
};

/**
 * Saisons disponibles pour une ligue (listage de fichiers).
 * Note : en production, utiliser le listing du répertoire ou un manifest.
 */
export function fbrefSeasons(slug: string): string[] {
  const currentYear = new Date().getFullYear();
  const startYear = new Date().getMonth() >= 6 ? currentYear : currentYear - 1;
  const seasons: string[] = [];
  for (let y = startYear; y >= startYear - 2; y--) {
    seasons.push(`${y}-${y + 1}`);
  }
  return seasons;
}
