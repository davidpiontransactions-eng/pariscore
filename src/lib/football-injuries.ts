import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { normTeam } from "./football-elo";

/**
 * Infirmerie par championnat — scrapée depuis RotoWire
 * (scripts/scrape_rotowire_injuries.py) dans public/data/injuries/{slug}.json.
 * Refresh hebdo via refresh-injuries.yml.
 *
 * Limite : la date de retour est paywall RotoWire (jamais publique).
 */

export type InjuryEntry = {
  player: string;
  position: string | null;
  injury: string | null;
  status: string | null;
  /** Date de retour ISO (Transfermarkt) — null si inconnue/paywall. */
  returnDate: string | null;
};

export type InjuriesFile = {
  meta: {
    leagueId: string;
    updatedAt: string;
    playerCount: number;
    hasReturnDates: boolean;
  };
  teams: Record<string, InjuryEntry[]>;
};

const INJ_DIR = join(process.cwd(), "public", "data", "injuries");
const TM_DIR = join(process.cwd(), "public", "data", "injuries_tm");

const cache = new Map<string, InjuriesFile | null>();
const tmCache = new Map<string, Record<string, TmEntry[]> | null>();

type TmEntry = {
  player: string;
  injury: string | null;
  since: string | null;
  returnDate: string | null;
};

function readInjuries(slug: string): InjuriesFile | null {
  if (cache.has(slug)) return cache.get(slug) ?? null;
  let data: InjuriesFile | null = null;
  try {
    const file = join(INJ_DIR, `${slug}.json`);
    if (existsSync(file)) data = JSON.parse(readFileSync(file, "utf-8")) as InjuriesFile;
  } catch {
    data = null;
  }
  cache.set(slug, data);
  return data;
}

/** Lignes Transfermarkt d'une ligue (dates de retour), null si non scrapée. */
function readTm(slug: string): Record<string, TmEntry[]> | null {
  if (tmCache.has(slug)) return tmCache.get(slug) ?? null;
  let teams: Record<string, TmEntry[]> | null = null;
  try {
    const file = join(TM_DIR, `${slug}.json`);
    if (existsSync(file)) {
      teams = (JSON.parse(readFileSync(file, "utf-8")) as { teams: Record<string, TmEntry[]> }).teams ?? null;
    }
  } catch {
    teams = null;
  }
  tmCache.set(slug, teams);
  return teams;
}

/** Absents d'une équipe (jointure floue sur le nom), null si ligue non couverte. */
export function teamInjuries(
  slug: string,
  team: string,
): { injuries: InjuryEntry[]; updatedAt: string; withReturnDates: number } | null {
  const file = readInjuries(slug);
  if (!file) return null;
  const key = normTeam(team);
  const direct = file.teams[team];
  let list: InjuryEntry[] | undefined = direct;
  if (!list) {
    for (const [name, l] of Object.entries(file.teams)) {
      if (normTeam(name) === key) {
        list = l;
        break;
      }
    }
  }
  const base: InjuryEntry[] = list ?? [];

  // Enrichissement Transfermarkt : date de retour par joueur + extras absents de RotoWire.
  const tmTeams = readTm(slug);
  let tmList: TmEntry[] = [];
  if (tmTeams) {
    tmList = tmTeams[team] ?? Object.entries(tmTeams).find(([n]) => normTeam(n) === key)?.[1] ?? [];
  }
  const tmByPlayer = new Map(tmList.map((t) => [normTeam(t.player), t]));
  const enriched: InjuryEntry[] = base.map((inj) => {
    const tm = tmByPlayer.get(normTeam(inj.player));
    if (!tm) return inj;
    tmByPlayer.delete(normTeam(inj.player));
    return {
      ...inj,
      injury: inj.injury ?? tm.injury,
      returnDate: tm.returnDate ?? inj.returnDate,
    };
  });
  // Restes TM seuls : statut/position inconnus, jamais inventés.
  for (const tm of tmByPlayer.values()) {
    enriched.push({ player: tm.player, position: null, injury: tm.injury, status: null, returnDate: tm.returnDate });
  }
  const withReturnDates = enriched.filter((e) => e.returnDate != null).length;
  return { injuries: enriched, updatedAt: file.meta.updatedAt, withReturnDates };
}
