/**
 * Backfill de l'historique tennis dans tennis_matches_internal (pariscore.db),
 * source API BSD tennis (propriétaire — voir ADR sackmann-purge : les datasets
 * Sackmann/TML sont CC BY-NC-SA, interdits en contexte commercial).
 *
 * Phase A (scores, rapide)  : listing /tennis/api/v2/matches/?status=finished
 *                             paginé par jour → upsert base (noms, score, cotes).
 * Phase B (--detail)        : détail /matches/{id}/ par match sans pct →
 *                             remplit w_/l_1st_in_pct … ret/bp/tb (service/retour).
 *
 * Usage :
 *   bun run scripts/backfill-tennis-history.ts --days=190
 *   bun run scripts/backfill-tennis-history.ts --days=190 --detail --pause-ms=120
 *   bun run scripts/backfill-tennis-history.ts --days=30 --dry-run
 */

import { Database } from "bun:sqlite";
import path from "path";

const ROOT = process.cwd();
const DB_PATH = process.env.DATABASE_PATH || path.join(ROOT, "pariscore.db");
const BSD_TENNIS_BASE = "https://sports.bzzoiro.com/tennis";
const PAGE_LIMIT = 200;

interface TMatch {
  id: number;
  tournament?: { id?: number; circuit?: string; category?: string; surface?: string; name?: string };
  player1?: { id: number; name: string } | null;
  player2?: { id: number; name: string } | null;
  match_date?: string | null;
  round_name?: string | null;
  player1_sets?: number | null;
  player2_sets?: number | null;
  sets_detail?: { p1: number; p2: number }[] | null;
  winner_id?: number | null;
  odds_player1?: number | null;
  odds_player2?: number | null;
}

const argv = new Map(
  process.argv.slice(2).map((a) => {
    const [k, v = "true"] = a.replace(/^--/, "").split("=");
    return [k, v] as const;
  }),
);
const days = Number(argv.get("days") ?? 190);
const withDetail = argv.has("detail");
const pauseMs = Number(argv.get("pause-ms") ?? 80);
const dryRun = argv.has("dry-run");

function key(): string {
  const env = process.env.BSD_API_KEY;
  if (!env) throw new Error("BSD_API_KEY manquante dans .env");
  return env;
}

async function bsd<T>(endpoint: string): Promise<T> {
  const res = await fetch(`${BSD_TENNIS_BASE}${endpoint}`, {
    headers: { Authorization: `Token ${key()}`, Accept: "application/json" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`BSD HTTP ${res.status} ${endpoint}`);
  return (await res.json()) as T;
}

function lst(j: unknown): TMatch[] {
  if (Array.isArray(j)) return j as TMatch[];
  const r = j as { results?: TMatch[] };
  return r?.results ?? [];
}

const ymd = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (b: Date, n: number) => new Date(b.getTime() + n * 86_400_000);

/** Surface BSD ("hard") → convention interne ("Hard"). */
function cap(s: string | undefined | null): string {
  const t = (s ?? "").trim().toLowerCase();
  if (!t) return "Hard";
  return t === "carpet" ? "Carpet" : t.charAt(0).toUpperCase() + t.slice(1);
}

function scoreFromSets(sets: { p1: number; p2: number }[] | null | undefined): string | null {
  if (!sets || sets.length === 0) return null;
  return sets.map((s) => `${s.p1}-${s.p2}`).join(" ");
}

async function fetchDay(dayISO: string): Promise<TMatch[]> {
  const out: TMatch[] = [];
  for (let page = 0; page < 8; page++) {
    const raw = await bsd<unknown>(
      `/api/v2/matches/?status=finished&date_from=${dayISO}&date_to=${dayISO}&limit=${PAGE_LIMIT}&page=${page}`,
    );
    const batch = lst(raw);
    out.push(...batch);
    if (batch.length < PAGE_LIMIT) break;
    await new Promise((r) => setTimeout(r, pauseMs));
  }
  return out;
}

async function main(): Promise<void> {
  const db = new Database(DB_PATH);
  db.exec("PRAGMA journal_mode = WAL;");

  // Colonnes % + cotes (idempotent — créées au premier run si absentes).
  const cols = db.prepare("PRAGMA table_info(tennis_matches_internal)").all() as { name: string }[];
  const names = new Set(cols.map((c) => c.name));
  const pctCols: [string, string][] = [
    ["w_1st_in_pct", "REAL"], ["w_1st_won_pct", "REAL"], ["w_2nd_won_pct", "REAL"],
    ["w_bp_saved_pct", "REAL"], ["w_tb_won", "REAL"], ["w_ret_pts_won_pct", "REAL"],
    ["l_1st_in_pct", "REAL"], ["l_1st_won_pct", "REAL"], ["l_2nd_won_pct", "REAL"],
    ["l_bp_saved_pct", "REAL"], ["l_tb_won", "REAL"], ["l_ret_pts_won_pct", "REAL"],
    ["odds_player1", "REAL"], ["odds_player2", "REAL"],
  ];
  for (const [c, t] of pctCols) {
    if (!names.has(c)) db.exec(`ALTER TABLE tennis_matches_internal ADD COLUMN ${c} ${t}`);
  }

  const upsertBase = db.prepare(`
    INSERT INTO tennis_matches_internal (
      source, source_id, tour, tourney_name, tourney_id, surface,
      tourney_date, match_date, winner_name, loser_name, winner_player_id, loser_player_id,
      score, sets_winner, sets_loser, best_of, round, status,
      odds_player1, odds_player2, imported_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(source, source_id) DO UPDATE SET
      tour=excluded.tour, tourney_name=excluded.tourney_name, tourney_id=excluded.tourney_id,
      surface=excluded.surface, tourney_date=excluded.tourney_date, match_date=excluded.match_date,
      winner_name=excluded.winner_name, loser_name=excluded.loser_name,
      winner_player_id=excluded.winner_player_id, loser_player_id=excluded.loser_player_id,
      score=excluded.score, sets_winner=excluded.sets_winner, sets_loser=excluded.sets_loser,
      best_of=excluded.best_of, round=excluded.round, status=excluded.status,
      odds_player1=COALESCE(excluded.odds_player1, tennis_matches_internal.odds_player1),
      odds_player2=COALESCE(excluded.odds_player2, tennis_matches_internal.odds_player2)
  `);

  let inserted = 0;

  for (let i = days; i >= 1; i--) {
    const dayISO = ymd(addDays(new Date(), -i));
    const ymdInt = Number(dayISO.replace(/-/g, ""));
    let batch: TMatch[] = [];
    try {
      batch = await fetchDay(dayISO);
    } catch (e) {
      console.warn(`[tennis-backfill] ${dayISO}: ${(e as Error).message} — journée ignorée`);
      continue;
    }
    if (dryRun) {
      console.log(`[dry-run] ${dayISO}: ${batch.length} matchs`);
      continue;
    }
    for (const m of batch) {
      if (!m.player1?.name || !m.player2?.name || !m.winner_id) continue;
      const isP1Winner = m.winner_id === m.player1.id;
      const wName = isP1Winner ? m.player1.name : m.player2.name;
      const lName = isP1Winner ? m.player2.name : m.player1.name;
      const dateMs = m.match_date ? new Date(m.match_date).getTime() : null;
      if (dateMs == null) continue;
      upsertBase.run(
        "bsd",
        String(m.id),
        cap(m.tournament?.circuit ?? "").toUpperCase(),
        m.tournament?.name ?? "",
        m.tournament?.id ?? null,
        cap(m.tournament?.surface),
        ymdInt,
        dateMs,
        wName,
        lName,
        isP1Winner ? m.player1.id : (m.player2?.id ?? null),
        isP1Winner ? (m.player2?.id ?? null) : m.player1.id,
        scoreFromSets(m.sets_detail),
        m.player1_sets ?? null,
        m.player2_sets ?? null,
        null,
        m.round_name ?? null,
        "finished",
        m.odds_player1 ?? null,
        m.odds_player2 ?? null,
        Math.floor(Date.now() / 1000),
      );
      inserted++;
    }
    if (i % 15 === 0 || i === 1) console.log(`[scores] jour ${days - i + 1}/${days} (${dayISO}) — cumul ${inserted}`);
    await new Promise((r) => setTimeout(r, pauseMs));
  }

  // ── Phase B optionnelle : détails (% service/retour) sur les lignes sans pct ──
  let detailsOk = 0;
  let detailsErr = 0;
  if (withDetail && !dryRun) {
    const missing = db
      .prepare(
        `SELECT source_id FROM tennis_matches_internal
         WHERE source='bsd' AND w_1st_in_pct IS NULL AND score IS NOT NULL
         ORDER BY match_date DESC`,
      )
      .all() as { source_id: string }[];
    console.log(`[detail] ${missing.length} matchs sans pct à enrichir`);

    const upd = db.prepare(`
      UPDATE tennis_matches_internal SET
        w_ace=?, w_df=?,
        w_1st_in_pct=?, w_1st_won_pct=?, w_2nd_won_pct=?,
        w_bp_saved_pct=?, w_ret_pts_won_pct=?, w_tb_won=?,
        l_ace=?, l_df=?,
        l_1st_in_pct=?, l_1st_won_pct=?, l_2nd_won_pct=?,
        l_bp_saved_pct=?, l_ret_pts_won_pct=?, l_tb_won=?
      WHERE source_id=?
    `);

    type Detail = Record<string, unknown>;
    for (const { source_id } of missing) {
      try {
        const d = await bsd<Detail>(`/api/v2/matches/${source_id}/`);
        const num = (k: string): number | null => {
          const v = d[k];
          return typeof v === "number" && Number.isFinite(v) ? v : null;
        };
        const p1Wins = d.winner_id != null && d.player1 != null && (d.player1 as { id?: number }).id === d.winner_id;
        const idx = (...ks: string[]) => ks.map((k) => num(k));
        const p1 = idx("p1_first_serve_pct", "p1_first_serve_won_pct", "p1_second_serve_won_pct", "p1_break_points_saved_pct", "p1_return_points_won_pct", "p1_tiebreaks_won", "p1_aces", "p1_double_faults");
        const p2 = idx("p2_first_serve_pct", "p2_first_serve_won_pct", "p2_second_serve_won_pct", "p2_break_points_saved_pct", "p2_return_points_won_pct", "p2_tiebreaks_won", "p2_aces", "p2_double_faults");
        const W = p1Wins ? p1 : p2;
        const L = p1Wins ? p2 : p1;
        upd.run(
          W[6], W[7],
          W[0], W[1], W[2], W[3], W[4], W[5],
          L[6], L[7],
          L[0], L[1], L[2], L[3], L[4], L[5],
          source_id,
        );
        detailsOk++;
      } catch {
        detailsErr++;
      }
      if ((detailsOk + detailsErr) % 100 === 0) {
        console.log(`[detail] ${detailsOk + detailsErr}/${missing.length} (ok=${detailsOk} err=${detailsErr})`);
      }
      await new Promise((r) => setTimeout(r, pauseMs));
    }
  }

  const total = db.prepare("SELECT count(*) n FROM tennis_matches_internal").get() as { n: number };
  console.log(
    `[tennis-backfill] TERMINÉ — scores insérés/maj: ${inserted}` +
      (withDetail ? ` · détails ok=${detailsOk} err=${detailsErr}` : "") +
      ` · total table: ${total.n}`,
  );
  db.close();
}

void main().catch((e) => {
  console.error("[tennis-backfill] FATAL:", e);
  process.exit(1);
});
