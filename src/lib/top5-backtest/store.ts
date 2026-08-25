/**
 * Store JSON du backtest Top 5 — data/top5-backtest/{sport}.json.
 *
 * Pattern src/lib/rugby/backtest.ts : écriture atomique (tmp + rename),
 * sérialisée par un mutex (les runs concurrents ne doivent jamais s'écraser),
 * cache en mémoire invalidé par mtime, plafond d'entrées.
 */

import fs from "fs";
import path from "path";
import type { Top5BacktestEntry, Top5Sport } from "./types";

const DIR = path.join(process.cwd(), "data", "top5-backtest");
const MAX_ENTRIES = 20_000;

/* ------------------------------------------------------------------ */
/* Mutex entre écritures concurrentes                                  */
/* ------------------------------------------------------------------ */

let lock: Promise<void> = Promise.resolve();

function queue<T>(fn: () => Promise<T>): Promise<T> {
  const run = lock.then(fn, fn);
  lock = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

/* ------------------------------------------------------------------ */
/* Lecture / écriture                                                  */
/* ------------------------------------------------------------------ */

interface Cache {
  entries: Top5BacktestEntry[];
  mtimeMs: number;
}

const caches = new Map<Top5Sport, Cache>();

function fileFor(sport: Top5Sport): string {
  return path.join(DIR, `${sport}.json`);
}

export function loadTop5Entries(sport: Top5Sport): Top5BacktestEntry[] {
  const file = fileFor(sport);
  try {
    if (!fs.existsSync(file)) return [];
    const stat = fs.statSync(file);
    const cached = caches.get(sport);
    if (cached && cached.mtimeMs === stat.mtimeMs) return cached.entries;
    const raw = JSON.parse(fs.readFileSync(file, "utf8")) as { entries?: Top5BacktestEntry[] };
    const entries = Array.isArray(raw?.entries) ? raw.entries : [];
    caches.set(sport, { entries, mtimeMs: stat.mtimeMs });
    return entries;
  } catch {
    // Fichier corrompu ou illisible → store vide (best-effort, jamais bloquant).
    return [];
  }
}

function writeEntriesSync(sport: Top5Sport, entries: Top5BacktestEntry[]): void {
  fs.mkdirSync(DIR, { recursive: true });
  const file = fileFor(sport);
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify({ updatedAt: new Date().toISOString(), entries }, null, 1));
  fs.renameSync(tmp, file);
  const stat = fs.statSync(file);
  caches.set(sport, { entries, mtimeMs: stat.mtimeMs });
}

/**
 * Fusionne des entrées par id. Règle : une entrée déjà réglée (won/lost/void)
 * ne peut jamais être rétrogradée en pending — protège contre un replay qui
 * repasserait sur un match déjà settlé.
 */
export async function upsertTop5Entries(
  sport: Top5Sport,
  incoming: Top5BacktestEntry[],
): Promise<{ added: number; updated: number }> {
  return queue(async () => {
    const current = new Map(loadTop5Entries(sport).map((e) => [e.id, e]));
    let added = 0;
    let updated = 0;

    for (const e of incoming) {
      const prev = current.get(e.id);
      if (!prev) {
        current.set(e.id, e);
        added++;
        continue;
      }
      if (prev.status !== "pending" && e.status === "pending") continue;
      if (prev.status !== e.status || prev.odds !== e.odds || prev.score !== e.score) updated++;
      current.set(e.id, e);
    }

    let list = Array.from(current.values());
    if (list.length > MAX_ENTRIES) {
      list = [...list]
        .sort((a, b) => b.kickoff.localeCompare(a.kickoff))
        .slice(0, MAX_ENTRIES);
    }
    writeEntriesSync(sport, list);
    return { added, updated };
  });
}
