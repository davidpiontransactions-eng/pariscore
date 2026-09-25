// Photos des joueurs handball (HBL + StarLigue) — lecture du snapshot
// data/handball-player-photos.json produit par
// scripts/scrape-handball-player-photos.mjs (cron pm2 hebdo, source Wikipedia
// pageimages CC-BY-SA). Sert les avatars des onglets « Stats & Joueurs »
// (ScorerRow) et « Bets » (PlayerColumn) du popup handball.
//
// Défensif : snapshot absent / parse KO → null et PlayerAvatar affiche les
// initiales (jamais d'URL cassée). DATA_DIR prioritaire (VPS : /opt/…/data).

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export type HandballPhoto = {
  url: string;
  title?: string;
  source?: string;
};

type PhotosFile = {
  scrapedAt?: string;
  source?: string;
  photos?: Record<string, HandballPhoto>;
  misses?: string[];
};

let _file: PhotosFile | null | undefined;

function loadFile(): PhotosFile | null {
  if (_file !== undefined) return _file;
  try {
    const dir = process.env.DATA_DIR || path.join(process.cwd(), "data");
    const target = path.join(dir, "handball-player-photos.json");
    if (!existsSync(target)) {
      _file = null;
      return _file;
    }
    const d = JSON.parse(readFileSync(target, "utf8")) as PhotosFile;
    _file = d && typeof d === "object" && d.photos ? d : null;
  } catch {
    _file = null;
  }
  return _file;
}

/** Clé de joueur normalisée (miroir teamKey — casse/diacritiques/ponctuation). */
export function photoKey(name: string): string {
  return String(name)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/** URL de photo d'un joueur, ou null (→ initiales côté UI). */
export function handballPlayerPhoto(name: string): string | null {
  const file = loadFile();
  if (!file?.photos) return null;
  const hit = file.photos[photoKey(name)];
  return hit?.url || null;
}

/** Fraîcheur du snapshot (pour afficher « photo du JJ-MM » si utile). */
export function handballPhotosMeta(): { scrapedAt: string | null; count: number; misses: number } | null {
  const file = loadFile();
  if (!file?.photos) return null;
  return {
    scrapedAt: file.scrapedAt ?? null,
    count: Object.keys(file.photos).length,
    misses: file.misses?.length ?? 0,
  };
}

/** Purge du cache mémoire (tests / après un nouveau scrape). */
export function clearHandballPhotoCache(): void {
  _file = undefined;
}
