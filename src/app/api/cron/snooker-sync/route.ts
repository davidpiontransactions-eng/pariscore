/**
 * T2 — Cron Snooker Sync — synchronisation régulière des données snooker.
 *
 * GET /api/cron/snooker-sync?token=CRON_SECRET[&scrape=1]
 *
 * 1. (optionnel, &scrape=1) exécute scripts/scrape_cuetracker.py (Python+Scrapling)
 * 2. lit data/cuetracker_matches.json et upserte joueurs + matchs (Prisma, atomique)
 * 3. (optionnel) rafraîchit les résultats du jour via l'API snooker.org si
 *    SNOOKER_ORG_API_KEY est définie (sinon étape ignorée silencieusement)
 *
 * Planification recommandée : toutes les 6 h (flux pré-match) + après chaque scrape.
 * Réponse : { ok, players:{upserted,failed}, matches:{upserted,failed}, snookerOrg:{...} }
 */
import { NextResponse } from "next/server";
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { syncFromJson, type CuetrackerFile, type CuetrackerMatch } from "@/lib/services/snooker-db";

export const runtime = "nodejs";
export const maxDuration = 300;

const CRON_SECRET = process.env.CRON_SECRET;
const CUETRACKER_FILE = join(process.cwd(), "data", "cuetracker_matches.json");
const SNOOKER_ORG_KEY = process.env.SNOOKER_ORG_API_KEY;

/** Exécute le scraper Python si présent (timeout 4 min, échec non bloquant). */
function runScraper(): Promise<{ ran: boolean; ok: boolean; detail: string }> {
  return new Promise((resolve) => {
    const script = join(process.cwd(), "scripts", "scrape_cuetracker.py");
    try {
      readFileSync(script);
    } catch {
      resolve({ ran: false, ok: true, detail: "scraper absent — sync JSON uniquement" });
      return;
    }
    let out = "";
    const child = spawn("python", [script], { cwd: process.cwd(), windowsHide: true });
    const timer = setTimeout(() => child.kill(), 240_000);
    child.stdout?.on("data", (d) => (out += d));
    child.stderr?.on("data", (d) => (out += d));
    child.on("error", (e) => {
      clearTimeout(timer);
      resolve({ ran: true, ok: false, detail: e.message });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ ran: true, ok: code === 0, detail: out.slice(-400) });
    });
  });
}

/** Connecteur snooker.org : résultats du jour (nécessite une clé API depuis 2024). */
async function fetchSnookerOrgToday(): Promise<{ ok: boolean; matches: CuetrackerMatch[]; detail: string }> {
  if (!SNOOKER_ORG_KEY) return { ok: true, matches: [], detail: "SNOOKER_ORG_API_KEY absente — étape ignorée" };
  const now = new Date();
  const url =
    `https://api.snooker.org/?t=7&year=${now.getFullYear()}&month=${now.getMonth() + 1}` +
    `&day=${now.getDate()}&key=${encodeURIComponent(SNOOKER_ORG_KEY)}`;
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return { ok: false, matches: [], detail: `HTTP ${res.status}` };
    const rows = (await res.json()) as unknown;
    if (!Array.isArray(rows)) return { ok: false, matches: [], detail: "réponse non-liste" };
    const matches: CuetrackerMatch[] = [];
    for (const r of rows) {
      const row = r as Record<string, unknown>;
      const a = typeof row.Player1Name === "string" ? row.Player1Name : null;
      const b = typeof row.Player2Name === "string" ? row.Player2Name : null;
      if (!a || !b) continue;
      const s1 = Number(row.Score1) || 0;
      const s2 = Number(row.Score2) || 0;
      const status = String(row.Status ?? "").toLowerCase() === "finished" ? "finished" : "scheduled";
      matches.push({ source: "snooker.org", player_a: a, player_b: b, score_a: s1, score_b: s2, status });
    }
    return { ok: true, matches, detail: `${matches.length} matchs du jour` };
  } catch (e) {
    return { ok: false, matches: [], detail: (e as Error).message };
  }
}

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  if (!CRON_SECRET || token !== CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const scrape = new URL(request.url).searchParams.get("scrape") === "1";
  const scraperResult = scrape ? await runScraper() : { ran: false, ok: true, detail: "non demandé" };

  // 1) Sync CueTracker (joueurs + matchs) depuis le JSON local.
  let sync = { ok: false, errors: 0, players: { upserted: 0, failed: 0 }, matches: { upserted: 0, failed: 0 } };
  try {
    const file = JSON.parse(readFileSync(CUETRACKER_FILE, "utf-8")) as CuetrackerFile;
    sync = await syncFromJson(file);
  } catch (e) {
    return NextResponse.json({ ok: false, error: `cuetracker: ${(e as Error).message}`, scraper: scraperResult }, { status: 500 });
  }

  // 2) Sync snooker.org (optionnel) — fusionne les résultats du jour.
  const org = await fetchSnookerOrgToday();
  let orgSync: { upserted: number; failed: number } = { upserted: 0, failed: 0 };
  if (org.matches.length > 0) {
    const r = await syncFromJson({ matches: org.matches });
    orgSync = r.matches;
  }

  return NextResponse.json({
    ok: sync.ok && org.ok && (!scrape || scraperResult.ok),
    scraper: scraperResult,
    players: sync.players,
    matches: sync.matches,
    snookerOrg: { ...org, synced: orgSync },
    synced_at: new Date().toISOString(),
  });
}