// Stats joueurs handball — popup prématch (HBL Allemagne + StarLigue LNH).
//
// Source 1 : data/hbl_players.json, produit par scripts/scrape-hbl-players.js
// (API Synergy/Sportradar de daikin-hbl.de → opel-hbl.de, probe 2026-09-24).
// Source 2 : data/lnh_players.json, produit par scripts/scrape-lnh.js
// (POST /ajaxpost1 de lnh.fr — scraping validé par l'opérateur le 2026-09-24).
// Les deux snapshots sont FUSIONNÉS par loadHandballPlayers() ; le DTO
// /api/handball/players sélectionne la compétition via playersForLeague()
// (StarLigue → lnh, DHB Pokal → tout, sinon HBL).
// Lecture readonly + cache mémoire module — pattern football-understat-players
// avec DATA_DIR env comme hockey/prematch-data (VPS : /opt/pariscorebis/data).

import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { normHandballName } from "./handball-logos";

/** Poste pour la popup : gardien ou joueur de champ. */
export type HblPosition = "GK" | "Field";

/** Compétition d'origine d'un joueur (snapshot fusionné = les 3 à la fois). */
export type HandballCompetition = "hbl" | "dhb-pokal" | "starligue";

export type HblPlayer = {
  name: string;
  /** Nom complet du club (ex. "TVB Stuttgart", "PSG"). */
  team: string;
  /** Code 3 lettres source (ex. "TVB", "BER") — HBL seul. */
  teamCode?: string;
  /** Compétition d'origine quand le snapshot est en mode "all". */
  competition?: HandballCompetition;
  position: HblPosition;
  goals: number;
  assists?: number;
  games: number;
  /** Minutes jouées (arrondi, ISO 8601 converti par le scraper). */
  minutes?: number;
  /** % d'arrêts (GK uniquement). */
  savePct?: number;
  /** Arrêts (GK uniquement). */
  saves?: number;
  /** Buts encaissés (GK uniquement). */
  goalsAgainst?: number;
  /** Buts à 7 m / penalty (Field uniquement). */
  sevenMGoals?: number;
  /** Buts / match (Field uniquement). */
  avgGoals?: number;
  /** Tirages cadrés (Field, LNH seul). */
  shots?: number;
  /** Score LNH (note officielle 0-100, LNH seul). */
  rating?: number;
  /** URL photo joueur (snapshot handball-player-photos.json) — null → initiales. */
  photoUrl?: string | null;
};

export type HblPlayersSnapshot = {
  scraped_at: string;
  /** "all" | "hbl" | "dhb-pokal" | "starligue" */
  competition: string;
  /** Libellé saison (ex. "2026/27"). */
  season: string;
  source: string;
  total?: number;
  teams?: number;
  players: HblPlayer[];
};

/** Top-N joueurs d'un club : GK triés par % d'arrêts, Field par buts. */
export type HblTeamTopPlayers = {
  /** Nom canonique du club matché (tel que dans le snapshot). */
  team: string;
  gk: HblPlayer[];
  field: HblPlayer[];
};

// Caches mémoire module : undefined = pas encore lu, null = fichier absent.
let _cache: HblPlayersSnapshot | null | undefined;
let _lnhCache: HblPlayersSnapshot | null | undefined;
let _merged: HblPlayersSnapshot | null | undefined;

/** Lit un snapshot JSON depuis DATA_DIR (env prioritaire, comme sur le VPS). */
function readSnapshot(file: string): HblPlayersSnapshot | null {
  try {
    const dataDir = process.env.DATA_DIR || join(process.cwd(), "data");
    const target = join(dataDir, file);
    if (!existsSync(target)) return null;
    const data = JSON.parse(readFileSync(target, "utf8")) as HblPlayersSnapshot;
    return data && Array.isArray(data.players) ? data : null;
  } catch {
    return null;
  }
}

/** Lit data/hbl_players.json (HBL Allemagne, scripts/scrape-hbl-players.js). */
export function loadHblPlayers(): HblPlayersSnapshot | null {
  if (_cache === undefined) _cache = readSnapshot("hbl_players.json");
  return _cache;
}

/** Lit data/lnh_players.json (StarLigue, scripts/scrape-lnh.js). */
export function loadLnhPlayers(): HblPlayersSnapshot | null {
  if (_lnhCache === undefined) _lnhCache = readSnapshot("lnh_players.json");
  return _lnhCache;
}

/**
 * Fusion des deux snapshots (HBL ∪ LNH) : un seul appel pour la popup, le
 * tri et le découpage GK/Field restent gérés par topPlayersForTeam. L'entête
 * reprend le snapshot HBL s'il existe, sinon le snapshot LNH.
 */
export function mergeHandballSnapshots(
  hbl: HblPlayersSnapshot | null,
  lnh: HblPlayersSnapshot | null
): HblPlayersSnapshot | null {
  if (!hbl) return lnh;
  if (!lnh) return hbl;
  const players = [...hbl.players, ...lnh.players];
  const teams = new Set(players.map((p) => p.team));
  return {
    ...hbl,
    competition: "all",
    season: [hbl.season, lnh.season].filter(Boolean).join(" + "),
    total: players.length,
    teams: teams.size,
    players,
  };
}

/** Snapshot fusionné mis en cache (invalide par clearHblPlayersCache). */
export function loadHandballPlayers(): HblPlayersSnapshot | null {
  if (_merged === undefined) _merged = mergeHandballSnapshots(loadHblPlayers(), loadLnhPlayers());
  return _merged;
}

/**
 * Filtre le snapshot fusionné selon la ligue du match (paramètre `league` du
 * DTO) — reprend la règle historique du filtre pokal/HBL :
 *   - StarLigue / LNH  → joueurs LNH seuls (snapshot LNH absent → liste vide,
 *     la popup dégrade proprement au lieu d'afficher des joueurs allemands) ;
 *   - DHB Pokal / coupe → tout (pros + amateurs, comportement conservé) ;
 *   - sinon             → HBL seul si le snapshot en porte, sinon tel quel.
 */
export function playersForLeague(
  snapshot: HblPlayersSnapshot | null | undefined,
  league: string
): HblPlayersSnapshot | null {
  if (!snapshot) return null;
  if (/pokal|coupe|cup/i.test(league)) return snapshot;
  if (/starligue|star\s*ligue|lnh/i.test(league)) {
    return { ...snapshot, players: snapshot.players.filter((p) => p.competition === "starligue") };
  }
  const hbl = snapshot.players.filter((p) => !p.competition || p.competition === "hbl");
  return hbl.length ? { ...snapshot, players: hbl } : snapshot;
}

/** Purge des caches (tests / hot-reload des fichiers après un scrape). */
export function clearHblPlayersCache(): void {
  _cache = undefined;
  _lnhCache = undefined;
  _merged = undefined;
}

/**
 * Le club matche-t-il la requête ? Égalité normalisée d'abord, puis inclusion
 * réciproque (comme teamLogoUrl) : "Stuttgart" ⊂ "tvbstuttgart",
 * "berlin" ⊂ "fuchseberlin". Garde-fou : chaîne la plus courte ≥ 4 caractères
 * pour éviter les faux positifs du type "hc".
 */
function teamsMatch(playerTeam: string, wantedNorm: string): boolean {
  const t = normHandballName(playerTeam);
  if (!t || !wantedNorm) return false;
  if (t === wantedNorm) return true;
  if (Math.min(t.length, wantedNorm.length) < 4) return false;
  return t.includes(wantedNorm) || wantedNorm.includes(t);
}

function byGoals(a: HblPlayer, b: HblPlayer): number {
  if (b.goals !== a.goals) return b.goals - a.goals;
  const ba = b.assists ?? 0;
  const aa = a.assists ?? 0;
  if (ba !== aa) return ba - aa;
  return a.name.localeCompare(b.name);
}

function bySavePct(a: HblPlayer, b: HblPlayer): number {
  const pa = a.savePct ?? -1;
  const pb = b.savePct ?? -1;
  if (pb !== pa) return pb - pa;
  const sa = a.saves ?? 0;
  const sb = b.saves ?? 0;
  if (sb !== sa) return sb - sa;
  return a.name.localeCompare(b.name);
}

/**
 * Meilleurs joueurs d'une équipe pour la popup prématch.
 * Sépare GK et Field, trie les Field par buts (assists puis nom en départage)
 * et les GK par % d'arrêts (arrêts puis nom). `n` s'applique par liste.
 *
 * Snapshot absent ou équipe inconnue → listes vides (l'UI dégrade proprement).
 */
export function topPlayersForTeam(
  snapshot: HblPlayersSnapshot | null | undefined,
  teamName: string,
  n: number = 5
): HblTeamTopPlayers {
  const wanted = normHandballName(teamName);
  const players = snapshot?.players;
  if (!wanted || !players || !players.length || n < 1) {
    return { team: teamName, gk: [], field: [] };
  }

  const matched = players.filter((p) => teamsMatch(p.team, wanted));
  if (!matched.length) return { team: teamName, gk: [], field: [] };

  const field = matched.filter((p) => p.position === "Field").sort(byGoals).slice(0, n);
  const gk = matched.filter((p) => p.position === "GK").sort(bySavePct).slice(0, n);

  return { team: matched[0].team, gk, field };
}
