#!/usr/bin/env node
'use strict';
/**
 * scrape-handball-history.mjs
 * ---------------------------
 * Historique handball complet → table SQLite `handball_match_history`
 * (pariscore.db, convention DATABASE_PATH || cwd/pariscore.db).
 *
 * Sources gratuites (aucune clé API) :
 *   A. BetExplorer `GET /handball/results/?year&month&day`
 *      → TOUTES les ligues, archives illimitées (vérifié : 2026-04-15 → 200 OK,
 *        65-347 matchs/jour) — source principale de profondeur.
 *   B. Feeds Flashscore `f_7_{-7..0}` → fenêtre 8 jours, complète les vides
 *      de la page results du jour.
 *   C. Snapshots locaux data/flashscore_handball.json +
 *      data/betexplorer_handball.json (dernière fenêtre déjà scrapée).
 *
 * Clé de dédup : (home_key|away_key|date) + recherche ±1 jour (les dates
 * BetExplorer sont locales au coup d'envoi, Flashscore en UTC → un match de
 * 23h30 local peut basculer de jour : la fenêtre ±1j évite le doublon).
 *
 * Usage :
 *   bun scripts/scrape-handball-history.mjs --days=10          # top-up cron
 *   bun scripts/scrape-handball-history.mjs --days=210         # backfill
 *   bun scripts/scrape-handball-history.mjs --days=210 --dry-run
 *   bun scripts/scrape-handball-history.mjs --stats            # état de la table
 *
 * Cron PM2 : `pariscore-cron-handball-history` — lundi 04:20 UTC, --days=10.
 * Les archives results sont illimitées → un run hebdomadaire ne perd rien
 * (rétention des feeds Flashscore = 8 jours ≥ 7 jours entre deux runs).
 */

import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import { fileURLToPath } from 'node:url';

import { parseResultsRows } from './scrape-betexplorer-handball.js';
import { parseDay, fetchFeed } from './scrape-flashscore-handball.js';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_DIR = path.dirname(SCRIPT_DIR);

const BASE = 'https://www.betexplorer.com';
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36';
const DELAY_MS = 1200;
const HTTP_TIMEOUT_MS = 25000;
const RETRIES = 2;

// ─── Args ────────────────────────────────────────────────────────────────────
const argv = new Map(
  process.argv.slice(2).map((a) => {
    const [k, v = 'true'] = a.replace(/^--/, '').split('=');
    return [k, v];
  })
);
const DAYS = Math.max(1, Math.min(400, parseInt(argv.get('days') ?? '10', 10) || 10));
const DRY = argv.has('dry-run');
const STATS_ONLY = argv.has('stats');

// ─── SQLite (bun:sqlite sous bun, better-sqlite3 sous node/pm2) ──────────────
const SQLITE_FILE = process.env.DATABASE_PATH || path.join(REPO_DIR, 'pariscore.db');

async function openDb() {
  if (typeof Bun !== 'undefined') {
    const { Database } = await import('bun:sqlite');
    return new Database(SQLITE_FILE);
  }
  const mod = await import('better-sqlite3');
  const Database = mod.default ?? mod;
  return new Database(SQLITE_FILE);
}

const DDL = `
CREATE TABLE IF NOT EXISTS handball_match_history (
  key          TEXT PRIMARY KEY,
  date         TEXT NOT NULL,
  time_utc    TEXT,
  home         TEXT NOT NULL,
  away         TEXT NOT NULL,
  home_key     TEXT NOT NULL,
  away_key     TEXT NOT NULL,
  home_goals   INTEGER NOT NULL,
  away_goals   INTEGER NOT NULL,
  home_half    INTEGER,
  away_half    INTEGER,
  league       TEXT,
  country      TEXT,
  src          TEXT NOT NULL,
  first_seen   TEXT NOT NULL,
  last_seen    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_hmh_date ON handball_match_history(date);
CREATE INDEX IF NOT EXISTS idx_hmh_home ON handball_match_history(home_key, date);
CREATE INDEX IF NOT EXISTS idx_hmh_away ON handball_match_history(away_key, date);
CREATE TABLE IF NOT EXISTS handball_history_meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

// ─── Normalisation (miroir src/lib/handball-history-stats.ts) ────────────────
function teamKey(name) {
  return String(name)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const dayISO = (d) => d.toISOString().slice(0, 10);

// ─── HTTP ────────────────────────────────────────────────────────────────────
function httpGet(url, redirectsLeft = 4) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'en' }, timeout: HTTP_TIMEOUT_MS }, (res) => {
      const status = res.statusCode || 0;
      if (status >= 300 && status < 400 && res.headers.location && redirectsLeft > 0) {
        res.resume();
        const next = new URL(res.headers.location, url).toString();
        resolve(httpGet(next, redirectsLeft - 1));
        return;
      }
      if (status !== 200) {
        res.resume();
        reject(new Error(`HTTP ${status}`));
        return;
      }
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (c) => (body += c));
      res.on('end', () => resolve(body));
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
  });
}

async function httpGetRetry(url) {
  let lastErr = null;
  for (let i = 0; i <= RETRIES; i++) {
    try {
      return await httpGet(url);
    } catch (err) {
      lastErr = err;
      await sleep(1500 * (i + 1));
    }
  }
  throw lastErr;
}

// ─── Collecte ────────────────────────────────────────────────────────────────
/** @type {Map<string, object>} */
const rows = new Map();

function addRow(e) {
  if (!e.home || !e.away || !Number.isFinite(e.hg) || !Number.isFinite(e.ag)) return;
  const date = String(e.date || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
  const hk = teamKey(e.home);
  const ak = teamKey(e.away);
  if (!hk || !ak) return;
  const key = `${hk}|${ak}|${date}`;
  const prev = rows.get(key);
  if (prev) {
    // Priorité à la source qui a aussi la mi-temps, sinon on garde le 1er.
    if (prev.halfH == null && e.halfH != null) Object.assign(prev, e, { key, date, homeKey: hk, awayKey: ak });
    return;
  }
  rows.set(key, {
    key,
    date,
    timeUtc: e.timeUtc || null,
    home: e.home,
    away: e.away,
    homeKey: hk,
    awayKey: ak,
    hg: e.hg,
    ag: e.ag,
    halfH: e.halfH ?? null,
    halfA: e.halfA ?? null,
    league: e.league || null,
    country: e.country || null,
    src: e.src,
  });
}

async function collectBetExplorerDaily() {
  const now = new Date();
  let ok = 0;
  let fail = 0;
  for (let i = 0; i < DAYS; i++) {
    const d = new Date(now.getTime() - i * 86400000);
    const y = d.getUTCFullYear();
    const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
    const da = String(d.getUTCDate()).padStart(2, '0');
    const url = `${BASE}/handball/results/?year=${y}&month=${mo}&day=${da}`;
    try {
      const html = await httpGetRetry(url);
      const parsed = parseResultsRows(html);
      let n = 0;
      for (const r of parsed) {
        if (r.status !== 'FT' || !r.score) continue;
        addRow({
          home: r.home,
          away: r.away,
          date: r.date,
          hg: r.score.home,
          ag: r.score.away,
          halfH: r.halftime?.home ?? null,
          halfA: r.halftime?.away ?? null,
          league: r.league,
          src: 'betexplorer',
        });
        n++;
      }
      ok++;
      if (i % 20 === 0 || i === DAYS - 1) {
        console.log(`[hb-history] betexplorer J-${i} (${y}-${mo}-${da}) : ${n} FT · cumul ${rows.size}`);
      }
    } catch (err) {
      fail++;
      console.error(`[hb-history] betexplorer J-${i} KO : ${err.message}`);
    }
    await sleep(DELAY_MS);
  }
  return { ok, fail };
}

async function collectFlashscoreFeeds() {
  let days = 0;
  for (let d = 0; d >= -7; d--) {
    try {
      const body = await fetchFeed(`https://2.flashscore.ninja/2/x/feed/f_7_${d}_1_en_1`);
      for (const m of parseDay(body)) {
        if (!m.isFinished || !m.score) continue;
        const mm = String(m.score).match(/(\d+)\s*-\s*(\d+)/);
        if (!mm) continue;
        addRow({
          home: m.home,
          away: m.away,
          date: m.time,
          timeUtc: m.time,
          hg: parseInt(mm[1], 10),
          ag: parseInt(mm[2], 10),
          halfH: m.homeHalf ?? null,
          halfA: m.awayHalf ?? null,
          league: m.league,
          country: m.country,
          src: 'flashscore',
        });
      }
      days++;
    } catch (err) {
      console.error(`[hb-history] feed J${d} KO : ${err.message}`);
    }
    await sleep(800);
  }
  return days;
}

function collectLocalSnapshots() {
  let n = 0;
  try {
    const p = path.join(REPO_DIR, 'data', 'flashscore_handball.json');
    if (fs.existsSync(p)) {
      const d = JSON.parse(fs.readFileSync(p, 'utf8'));
      for (const m of d.matches || []) {
        if (!m.isFinished || !m.score) continue;
        const mm = String(m.score).match(/(\d+)\s*-\s*(\d+)/);
        if (!mm) continue;
        addRow({
          home: m.home,
          away: m.away,
          date: m.time,
          timeUtc: m.time,
          hg: parseInt(mm[1], 10),
          ag: parseInt(mm[2], 10),
          halfH: m.homeHalf ?? null,
          halfA: m.awayHalf ?? null,
          league: m.league,
          country: m.country,
          src: 'flashscore-snapshot',
        });
        n++;
      }
    }
  } catch (err) {
    console.error(`[hb-history] snapshot flashscore KO : ${err.message}`);
  }
  try {
    const p = path.join(REPO_DIR, 'data', 'betexplorer_handball.json');
    if (fs.existsSync(p)) {
      const d = JSON.parse(fs.readFileSync(p, 'utf8'));
      const push = (r, src) => {
        if (r.status !== 'FT' || !r.score) return;
        addRow({
          home: r.home,
          away: r.away,
          date: r.date,
          hg: r.score.home,
          ag: r.score.away,
          halfH: r.halftime?.home ?? null,
          halfA: r.halftime?.away ?? null,
          league: r.league,
          src,
        });
        n++;
      };
      for (const r of d.recent || []) push(r, 'betexplorer-snapshot');
      for (const l of d.leagues || []) for (const m of l.matches || []) push(m, 'betexplorer-snapshot');
    }
  } catch (err) {
    console.error(`[hb-history] snapshot betexplorer KO : ${err.message}`);
  }
  return n;
}

// ─── Écriture ────────────────────────────────────────────────────────────────
/**
 * Insert avec garde ±1 jour (dédup cross-source : BetExplorer = date locale,
 * Flashscore = UTC). Renvoie 'insert' | 'adjacent' | 'skip'.
 */
function persist(db, r, now) {
  const adjacent = db
    .prepare(
      `SELECT key FROM handball_match_history
       WHERE home_key = ? AND away_key = ? AND date >= date(?, '-1 day') AND date <= date(?, '+1 day')
       LIMIT 1`
    )
    .get(r.homeKey, r.awayKey, r.date, r.date);
  if (adjacent) {
    db.prepare(`UPDATE handball_match_history SET last_seen = ? WHERE key = ?`).run(now, adjacent.key);
    return 'adjacent';
  }
  db.prepare(
    `INSERT INTO handball_match_history
      (key, date, time_utc, home, away, home_key, away_key, home_goals, away_goals,
       home_half, away_half, league, country, src, first_seen, last_seen)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(key) DO UPDATE SET
       last_seen = excluded.last_seen,
       src = excluded.src`
  ).run(
    r.key,
    r.date,
    r.timeUtc,
    r.home,
    r.away,
    r.homeKey,
    r.awayKey,
    r.hg,
    r.ag,
    r.halfH,
    r.halfA,
    r.league,
    r.country,
    r.src,
    now,
    now
  );
  return 'insert';
}

function printStats(db) {
  const total = db.prepare(`SELECT COUNT(*) AS n FROM handball_match_history`).get().n;
  const span = db
    .prepare(`SELECT MIN(date) AS min, MAX(date) AS max FROM handball_match_history`)
    .get();
  const teams = db
    .prepare(
      `SELECT COUNT(*) AS n FROM (SELECT home_key AS k FROM handball_match_history
       UNION SELECT away_key FROM handball_match_history)`
    )
    .get().n;
  const lastRun = db.prepare(`SELECT value FROM handball_history_meta WHERE key = 'last_run'`).get();
  const dist = db
    .prepare(
      `SELECT league, COUNT(*) AS n FROM handball_match_history GROUP BY league ORDER BY n DESC LIMIT 12`
    )
    .all();
  console.log(`[hb-history] table handball_match_history : ${total} matchs`);
  console.log(`[hb-history] période ${span.min ?? '—'} → ${span.max ?? '—'} · ${teams} équipes`);
  console.log(`[hb-history] dernier run : ${lastRun ? lastRun.value : 'jamais'}`);
  for (const d of dist) console.log(`[hb-history]   ${String(d.league)} : ${d.n}`);
}

async function main() {
  const db = await openDb();
  db.exec(DDL);

  if (STATS_ONLY) {
    printStats(db);
    db.close();
    return;
  }

  const t0 = Date.now();
  console.log(`[hb-history] ${SQLITE_FILE} · days=${DRY ? `${DAYS} (dry-run)` : DAYS}`);

  const be = await collectBetExplorerDaily();
  console.log(`[hb-history] betexplorer : ${be.ok} jours ok, ${be.fail} échecs`);
  const nSnap = collectLocalSnapshots();
  console.log(`[hb-history] snapshots locaux : ${nSnap} matchs`);
  const nFeed = await collectFlashscoreFeeds();
  console.log(`[hb-history] feeds flashscore : ${nFeed} jours`);

  if (DRY) {
    console.log(`[hb-history] dry-run : ${rows.size} matchs uniques collectés, rien écrit`);
    db.close();
    return;
  }

  let ins = 0;
  let adj = 0;
  const now = new Date().toISOString();
  const insertAll = db.transaction((list) => {
    for (const r of list) {
      const res = persist(db, r, now);
      if (res === 'insert') ins++;
      else if (res === 'adjacent') adj++;
    }
  });
  insertAll([...rows.values()]);

  db.prepare(
    `INSERT INTO handball_history_meta (key, value) VALUES ('last_run', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(now);
  db.prepare(
    `INSERT INTO handball_history_meta (key, value) VALUES ('window_days', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(String(DAYS));
  db.close();

  console.log(`[hb-history] collectés=${rows.size} insertés=${ins} adjacents(dédup)=${adj}`);
  printStats(await openDb());
  console.log(`[hb-history] ✅ terminé en ${Math.round((Date.now() - t0) / 1000)}s`);
}

main().catch((err) => {
  console.error('[hb-history] ERREUR', err);
  process.exitCode = 1;
});
