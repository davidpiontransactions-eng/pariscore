// Résolution du pays (code ISO alpha-2) d'un joueur tennis par nom.
//
// Sources (dans l'ordre) :
//   1. Caches officiels data/tour-leaderboards/{atp,wta}.json — produits par
//      scripts/scrape-tour-leaderboards.py (hebdo) : ATP via Camoufox,
//      WTA via api.wtatennis.com. Chaque entrée embarque le code pays IOC
//      (PlayerCountryCode / Nationality), converti en ISO2 via iocToIso2.
//   2. Fallback : rien (null) — l'UI affiche le badge drapeau seulement quand
//      le pays est connu, jamais un faux drapeau.
//
// Conception défensive : caches absents/illisibles → map vide → null.
// Le résultat est mémoïsé par nom normalisé.

import fs from "node:fs";
import path from "node:path";
import { iocToIso2 } from "@/lib/tennis-stats/leaderboard";

const DATA_DIR = (() => {
  if (process.env.LEADERBOARD_DATA_DIR) return process.env.LEADERBOARD_DATA_DIR;
  const cwdBased = path.join(process.cwd(), "data", "tour-leaderboards");
  try {
    if (fs.existsSync(cwdBased)) return cwdBased;
  } catch {
    /* ignore */
  }
  if (process.env.DATABASE_PATH) {
    const projectRoot = path.dirname(process.env.DATABASE_PATH);
    const projectBased = path.join(projectRoot, "data", "tour-leaderboards");
    try {
      if (fs.existsSync(projectBased)) return projectBased;
    } catch {
      /* ignore */
    }
  }
  return cwdBased;
})();

/** Normalisation de nom identique à tennis-stats/db.ts (NFD → sans accents → lower). */
function normName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

interface AtpEntry {
  PlayerName?: string;
  PlayerCountryCode?: string;
}

interface AtpCache {
  datasets?: Record<string, AtpEntry[] | undefined>;
}

interface WtaRow {
  First_Name?: string;
  Last_Name?: string;
  Nationality?: string;
}

interface WtaCache {
  rows?: WtaRow[];
}

/**
 * Overrides manuels (clé = nom normalisé) pour les joueurs notoires absents
 * des caches officiels (le cache WTA couvre les boards stats, pas le top
 * ranking — Sabalenka/Swiatek/Gauff…) et les retraités récents (Federer…).
 * Seulement quand la source officielle ne fournit pas le pays.
 */
const COUNTRY_OVERRIDES: Record<string, string> = {
  "aryna sabalenka": "by",
  "iga swiatek": "pl",
  "coco gauff": "us",
  "naomi osaka": "jp",
  "jessica pegula": "us",
  "elena rybakina": "kz",
  "ons jabeur": "tn",
  "marketa vondrousova": "cz",
  "marta kostyuk": "ua",
  "karolina muchova": "cz",
  "mirra andreeva": "ru",
  "madison keys": "us",
  "danielle collins": "us",
  "rafael nadal": "es",
  "andy murray": "gb",
  "gael monfils": "fr",
  "roger federer": "ch",
  "holger rune": "dk",
  "borna coric": "hr",
  "david goffin": "be",
};

let _map: Map<string, string> | null = null;

function loadMap(): Map<string, string> {
  if (_map) return _map;
  const map = new Map<string, string>();

  const add = (name: string | undefined, ioc: string | undefined | null) => {
    if (!name || !ioc) return;
    const iso = iocToIso2(ioc);
    if (!iso) return;
    const key = normName(name);
    if (key && !map.has(key)) map.set(key, iso);
  };

  // ATP : datasets → { PlayerName, PlayerCountryCode }.
  try {
    const atp = JSON.parse(
      fs.readFileSync(path.join(DATA_DIR, "atp.json"), "utf8")
    ) as AtpCache;
    for (const rows of Object.values(atp.datasets ?? {})) {
      for (const r of rows ?? []) add(r.PlayerName, r.PlayerCountryCode);
    }
  } catch {
    /* cache absent/illisible → ignoré */
  }

  // WTA : rows → { First_Name, Last_Name, Nationality }.
  try {
    const wta = JSON.parse(
      fs.readFileSync(path.join(DATA_DIR, "wta.json"), "utf8")
    ) as WtaCache;
    for (const r of wta.rows ?? []) {
      add(
        [r.First_Name, r.Last_Name].filter(Boolean).join(" "),
        r.Nationality
      );
    }
  } catch {
    /* cache absent/illisible → ignoré */
  }

  _map = map;
  for (const [name, iso] of Object.entries(COUNTRY_OVERRIDES)) {
    if (!map.has(name)) map.set(name, iso);
  }
  return map;
}

/**
 * Pays ISO alpha-2 (minuscules, convention `CountryFlag`) d'un joueur tennis,
 * ou null si inconnu (caches officiels absents / joueur hors top classement).
 */
export function resolvePlayerCountry(name: string | null | undefined): string | undefined {
  if (!name) return undefined;
  const key = normName(name);
  if (!key) return undefined;
  const official = loadMap().get(key);
  if (official) return official;
  return COUNTRY_OVERRIDES[key] ?? undefined;
}
