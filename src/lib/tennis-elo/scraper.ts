import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const ATP_URL = "https://tennisabstract.com/reports/atp_elo_ratings.html";
const WTA_URL = "https://tennisabstract.com/reports/wta_elo_ratings.html";

export type Tour = "ATP" | "WTA";

export type AbstractEloEntry = {
  name: string;
  tour: Tour;
  elo: number;
  hElo: number;
  cElo: number;
  gElo: number;
  hEloRank: number;
  cEloRank: number;
  gEloRank: number;
};

export type AbstractCache = {
  generatedAt: string;
  lastUpdate: string;
  players: Record<string, AbstractEloEntry>;
};

function stripHtml(s: string): string {
  return s.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
}

function extractNumeric(s: string): number {
  return parseFloat(stripHtml(s).replace(/[^0-9.\-]/g, "")) || 0;
}

export function parseEloPage(html: string, tour: Tour): AbstractEloEntry[] {
  const tbody = html.match(/<tbody>([\s\S]*?)<\/tbody>/);
  if (!tbody) throw new Error(`No <tbody> found in ${tour} page`);

  const entries: AbstractEloEntry[] = [];
  const rowRe = /<tr>([\s\S]*?)<\/tr>/g;
  let rowMatch: RegExpExecArray | null;

  while ((rowMatch = rowRe.exec(tbody[1])) !== null) {
    const cells = rowMatch[1].match(/<td[^>]*>[\s\S]*?<\/td>/g);
    if (!cells || cells.length < 17) continue;

    const nameMatch = cells[1].match(/<a[^>]*>([\s\S]*?)<\/a>/);
    if (!nameMatch) continue;

    const name = nameMatch[1].replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
    if (!name) continue;

    entries.push({
      name,
      tour,
      elo: extractNumeric(cells[3]),
      hElo: extractNumeric(cells[6]),
      cElo: extractNumeric(cells[8]),
      gElo: extractNumeric(cells[10]),
      hEloRank: extractNumeric(cells[5]),
      cEloRank: extractNumeric(cells[7]),
      gEloRank: extractNumeric(cells[9]),
    });
  }

  return entries;
}

export function normalizeKey(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

export async function fetchAndParse(): Promise<AbstractCache> {
  const [atpHtml, wtaHtml] = await Promise.all([
    fetch(ATP_URL).then((r) => {
      if (!r.ok) throw new Error(`ATP page HTTP ${r.status}`);
      return r.text();
    }),
    fetch(WTA_URL).then((r) => {
      if (!r.ok) throw new Error(`WTA page HTTP ${r.status}`);
      return r.text();
    }),
  ]);

  const atp = parseEloPage(atpHtml, "ATP");
  const wta = parseEloPage(wtaHtml, "WTA");

  const players: Record<string, AbstractEloEntry> = {};
  for (const entry of [...atp, ...wta]) {
    players[normalizeKey(entry.name)] = entry;
  }

  const lastUpdateMatch = atpHtml.match(/Last update:\s*(\d{4}-\d{2}-\d{2})/);
  const lastUpdate = lastUpdateMatch ? lastUpdateMatch[1] : new Date().toISOString().slice(0, 10);

  return {
    generatedAt: new Date().toISOString(),
    lastUpdate,
    players,
  };
}

/** Resolve the cache file path — accessible from both scripts/ and src/ */
export function cacheFilePath(cwd?: string): string {
  return resolve(cwd ?? process.cwd(), "src/lib/tennis-elo/abstract-cache.json");
}
