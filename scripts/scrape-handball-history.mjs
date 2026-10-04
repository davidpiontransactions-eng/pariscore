#!/usr/bin/env node
'use strict';
/**
 * scrape-handball-history.mjs
 * ---------------------------
 * Historique handball complet → table SQLite `handball_match_history`
 * (pariscore.db, convention DATABASE_PATH || cwd/pariscore.db).
 *
 * Sources gratuites (aucune clé API) :
 *   A. BetExplorer — PAGES DE SAISON par ligue
 *      `/handball/{pays}/{ligue}-{saison}/results/`
 *      → profondeur multi-saisons, seule source possible pour 2 saisons.
 *   B. Feeds Flashscore `f_7_{-7..0}` → fenêtre 8 jours, apporte le SCORE
 *      MI-TEMPS (absent des pages de saison).
 *   C. Snapshots locaux data/flashscore_handball.json +
 *      data/betexplorer_handball.json (dernière fenêtre déjà scrapée).
 *
 * ⚠️ FIX 2026-10-04 — conformité robots.txt. La source BetExplorer historique
 * interrogeait `/handball/results/?year=AAAA&month=MM&day=DD`, Or le robots.txt
 * de betexplorer.com (vérifié le 2026-10-04) interdit explicitement :
 *     Disallow: /*?year=
 *     Disallow: /*?month=
 *     Disallow: /*?page=
 *     Disallow: /*?stage=
 * Ce mode d'accès est SUPPRIMÉ et remplacé par les pages de saison (chemins
 * purs, donc autorisés). Au passage, Flashscore est plafonné à J-7 (mesuré :
 * `day=-8` et au-delà renvoient 0 octet) et Vitibet ne garde que la saison
 * courante — aucun des deux ne peut donc servir d'historique.
 *
 * ⚠️ Les pages de saison ne FOURNISSENT PAS le score mi-temps (seules les
 * pages journalières l'ont, et elles sont interdites). Les colonnes
 * `home_half`/`away_half` restent donc NULL pour ces matchs : seule la
 * stratégie `htLeader` en pâtit.
 *
 * Clé de dédup : (home_key|away_key|date) + recherche ±1 jour (les dates
 * BetExplorer sont locales au coup d'envoi, Flashscore en UTC → un match de
 * 23h30 local peut basculer de jour : la fenêtre ±1j évite le doublon).
 *
 * Usage :
 *   bun scripts/scrape-handball-history.mjs                    # top-up quotidien
 *   bun scripts/scrape-handball-history.mjs --seasons=2        # backfill 2 saisons
 *   bun scripts/scrape-handball-history.mjs --seasons=2 --dry-run
 *   bun scripts/scrape-handball-history.mjs --stats            # état de la table
 *
 * Cron PM2 : `pariscore-cron-handball-history` → `0 23 * * *` (00:00 Paris).
 * Quotidien et plus hebdomadaire : le but est qu'un résultat de la veille soit
 * dans la base dès le matin, pour l'onglet Résultats ET pour le seuil de total
 * du Top 10 (qui exige ≥ 3 matchs terminés par équipe).
 */

import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import { fileURLToPath } from 'node:url';

import { parseResultsRows } from './scrape-betexplorer-handball.js';
import { parseSeasonRows, discoverSeasonLinks } from './lib/betexplorer-season.mjs';
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
/** Nombre de saisons à scraper par ligue (défaut 1 = saison en cours). */
const SEASONS = Math.max(1, Math.min(10, parseInt(argv.get('seasons') ?? '1', 10) || 1));

/**
 * Ligues couvertes. `path` = page ligue BetExplorer (chemin pur, autorisée).
 * Le slug des SAISONS EST DÉSCOUVERT à la volée sur cette page, jamais codé en
 * dur : MOL Liga s'appelle `doprastav-liga-women` en 2025/2026,
 * `mol-liga-women` en 2024/2025 et `whil-women` en 2016/2017 — un slug figé
 * 404 dès la saison suivante.
 *
 * ⚠️ `key` n'est QUE l'identifiant interne (celui du registre
 * `src/lib/handball-league-registry.ts`). C'est `name` qui part en base : les
 * deux autres scrapers écrivent `Pays: Ligue` et le flashscore écrit le nom nu,
 * donc écrire la clé ici produisait une 4ᵉ écriture, et un GROUP BY par ligue
 * ne correspondait plus à la réalité.
 */
const LEAGUES = [
  { key: 'starligue', name: 'France: Starligue', path: '/handball/france/starligue/', country: 'France' },
  { key: 'proligue', name: 'France: Proligue', path: '/handball/france/proligue/', country: 'France' },
  { key: 'd1women', name: 'France: Division 1 Women', path: '/handball/france/division-1-women/', country: 'France' },
  { key: 'hla', name: 'Austria: HLA', path: '/handball/austria/hla/', country: 'Austria' },
  { key: 'herre', name: 'Denmark: Herre Handbold Ligaen', path: '/handball/denmark/herre-handbold-ligaen/', country: 'Denmark' },
  { key: 'kvindeligaen', name: 'Denmark: Kvindeligaen Women', path: '/handball/denmark/kvindeligaen-women/', country: 'Denmark' },
  { key: 'd2women', name: 'Denmark: 1. Division Women', path: '/handball/denmark/1-division-women/', country: 'Denmark' },
  { key: 'mol', name: 'Europe: MOL Liga Women', path: '/handball/europe/doprastav-liga-women/', country: 'Europe' },
  { key: 'bundesliga2', name: 'Germany: 2. Bundesliga', path: '/handball/germany/2-bundesliga/', country: 'Germany' },
];

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
  -- Cotes 1X2 réelles, disponibles sur les pages de saison BetExplorer.
  -- NULL pour les matchs issus des feeds Flashscore (pas de cote) : jamais
  -- de cote inventée. Permet de recalibrer le backtest sur des cotes réelles
  -- au lieu des moyennes 1xbet codées en dur.
  odds_home    REAL,
  odds_draw    REAL,
  odds_away    REAL,
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

/**
 * Migration idempotente : `CREATE TABLE IF NOT EXISTS` ne modifie PAS une table
 * déjà créée sur le disque. Les colonnes de cotes (ajoutées le 2026-10-04 avec
 * les pages de saison BetExplorer) manquent donc sur les bases existantes →
 * l'INSERT échoue avec « no column named odds_home ». On les ajoute si absentes.
 */
function migrate(db) {
  const have = new Set(
    db.prepare(`PRAGMA table_info(handball_match_history)`).all().map((c) => c.name)
  );
  for (const [col, ddl] of [
    ['odds_home', 'ALTER TABLE handball_match_history ADD COLUMN odds_home REAL'],
    ['odds_draw', 'ALTER TABLE handball_match_history ADD COLUMN odds_draw REAL'],
    ['odds_away', 'ALTER TABLE handball_match_history ADD COLUMN odds_away REAL'],
  ]) {
    if (have.has(col)) continue;
    db.exec(ddl);
    console.log(`[hb-history] migration : colonne ${col} ajoutée`);
  }
}

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
    // Cotes 1X2 : apportées par les pages de saison BetExplorer. Absentes des
    // feeds Flashscore et des snapshots → NULL, jamais une cote inventée.
    oddsHome: e.oddsHome ?? null,
    oddsDraw: e.oddsDraw ?? null,
    oddsAway: e.oddsAway ?? null,
    src: e.src,
  });
}

/**
 * Source A — PAGES DE SAISON BetExplorer (autorisées par robots.txt).
 *
 * Pour chaque ligue : 1 requête sur la page ligue pour découvrir les liens de
 * saison, puis 1 requête par saison demandée. `SEASONS=2` ⇒ 3 requêtes par
 * ligue, 27 au total pour les 9 ligues (backfill) — contre ~730 pour un balayage
 * de pages datées, qui serait de toute façon interdit.
 *
 * Les liens sont triés par année décroissante pour tapering la saison en cours
 * en premier (c'est elle que le cron quotidien doit rafraîchir).
 */
async function collectBetExplorerSeasons() {
  // Date du run, figée une fois : résout « Today » / « Yesterday » de BetExplorer.
  const now = dayISO(new Date());
  let pagesOk = 0;
  let pagesFail = 0;
  let matches = 0;
  for (const lg of LEAGUES) {
    let links;
    try {
      links = discoverSeasonLinks(await httpGetRetry(`${BASE}${lg.path}`));
    } catch (err) {
      pagesFail++;
      console.error(`[hb-history] ${lg.key} : page ligue KO ${err.message}`);
      continue;
    }
    if (links.size === 0) {
      pagesFail++;
      console.error(`[hb-history] ${lg.key} : aucun lien de saison découvert sur ${lg.path}`);
      continue;
    }
    const wanted = [...links.entries()].sort(
      (a, b) => Number(b[0].slice(0, 4)) - Number(a[0].slice(0, 4))
    );

    // Règle auto-correctrice : BetExplorer publie la saison PROCHAINE (vide tant
    // qu'elle n'a pas commencé) — un simple tri décroissant la choisirait et on
    // ramasserait 0 match. On avance donc jusqu'à avoir `SEASONS` saisons
    // RÉELLEMENT peuplées. Robuste à tout convention de calendrier.
    let seasonsKept = 0;
    for (const [label, seasonPath] of wanted) {
      if (seasonsKept >= SEASONS) break;
      const url = `${BASE}${seasonPath}results/`;
      try {
        const html = await httpGetRetry(url);
        // `now` sert à résoudre les dates RELATIVES de BetExplorer (« Today »,
        // « Yesterday ») : sans lui, les matchs de la veille — ceux que le cron
        // quotidien est censé apporter — étaient jetés.
        const parsed = parseSeasonRows(html, label, now);
        let n = 0;
        for (const r of parsed) {
          if (!r.date) continue; // date non déductible → on ne l'invente pas
          addRow({
            home: r.home,
            away: r.away,
            date: r.date,
            hg: r.homeGoals,
            ag: r.awayGoals,
            halfH: null, // absent des pages de saison
            halfA: null,
            // Nom CANONIQUE (`Pays: Ligue`), pas la clé interne : c'est
            // l'écriture des deux autres scrapers, donc celle du GROUP BY.
            league: lg.name,
            country: lg.country,
            src: 'betexplorer-season',
            oddsHome: r.oddsHome,
            oddsDraw: r.oddsDraw,
            oddsAway: r.oddsAway,
          });
          n++;
        }
        pagesOk++;
        matches += n;
        if (n > 0) seasonsKept++;
        console.log(`[hb-history] ${lg.key} ${label} : ${n} matchs · cumul ${rows.size}`);
      } catch (err) {
        pagesFail++;
        console.error(`[hb-history] ${lg.key} ${label} KO : ${err.message}`);
      }
      await sleep(DELAY_MS);
    }
    if (seasonsKept === 0) {
      console.warn(`[hb-history] ${lg.key} : aucune saison peuplée trouvée (page ${lg.path})`);
    }
  }
  return { pagesOk, pagesFail, matches };
}

/**
 * ⚠️ SUPPRIMÉ 2026-10-04 — `collectBetExplorerDaily` (pages datées
 * `/handball/results/?year=&month=&day=`). RETIRÉ VOLONTAIREMENT : ces URLs sont
 * interdites par le robots.txt de betexplorer.com (`Disallow: /*?year=`,
 * `/*?month=`). La fonction est laissée ici documentée pour que personne ne la
 * réintroduise ; `collectBetExplorerSeasons()` la remplace.
 */
async function collectBetExplorerDaily_DISABLED() {
  throw new Error('désactivé : /handball/results/?year= est interdit par robots.txt');
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
 *
 * ⚠️ FIX 2026-10-04 — le chemin « adjacent » ne faisait que mettre `last_seen` à
 * jour. Les COTES RÉELLES apportées par la page de saison étaient donc perdues
 * dès qu'un match existait déjà à ±1 jour, c'est-à-dire pour toute la fenêtre
 * déjà couverte par une autre source. Mesuré : Starligue 2026-02 → 10 cotes sur
 * 15 matchs, 2026-10 → 2 sur 5. Le chemin adjacent fusionne maintenant au même
 * titre que l'upsert : COALESCE sur les cotes et sur la mi-temps, et
 * normalisation du nom de ligue vers l'écriture canonique.
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
    db.prepare(
      `UPDATE handball_match_history SET
         last_seen  = ?,
         -- COALESCE dans les deux sens : ni la cote ni la mi-temps d'une source
         -- ne doivent en effacer une déjà stockée par une autre.
         odds_home  = COALESCE(?, odds_home),
         odds_draw  = COALESCE(?, odds_draw),
         odds_away  = COALESCE(?, odds_away),
         home_half  = COALESCE(home_half, ?),
         away_half  = COALESCE(away_half, ?),
         -- Le nom de ligue est une DONNÉE, pas une étiquette d'affichage : une
         -- ligue stockée en slug (starligue) et la même en « France: Starligue »
         -- n'étaient pas la même ligne pour un GROUP BY. La page de saison, qui
         -- fait autorité, réécrit donc vers l'écriture canonique.
         league     = COALESCE(?, league),
         country    = COALESCE(?, country)
       WHERE key = ?`,
    ).run(
      now,
      r.oddsHome,
      r.oddsDraw,
      r.oddsAway,
      r.halfH,
      r.halfA,
      r.league,
      r.country,
      adjacent.key,
    );
    return 'adjacent';
  }
  db.prepare(
    `INSERT INTO handball_match_history
      (key, date, time_utc, home, away, home_key, away_key, home_goals, away_goals,
       home_half, away_half, league, country, odds_home, odds_draw, odds_away,
       src, first_seen, last_seen)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(key) DO UPDATE SET
       last_seen = excluded.last_seen,
       src = excluded.src,
       -- COALESCE : une source sans cote (Flashscore) ne doit pas effacer une
       -- cote réelle déjà stockée par une page de saison.
       odds_home = COALESCE(excluded.odds_home, handball_match_history.odds_home),
       odds_draw = COALESCE(excluded.odds_draw, handball_match_history.odds_draw),
       odds_away = COALESCE(excluded.odds_away, handball_match_history.odds_away),
       -- Idem pour la mi-temps : la page de saison n'en a pas, le feed si.
       home_half = COALESCE(handball_match_history.home_half, excluded.home_half),
       away_half = COALESCE(handball_match_history.away_half, excluded.away_half)`
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
    r.oddsHome,
    r.oddsDraw,
    r.oddsAway,
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
  migrate(db);

  if (STATS_ONLY) {
    printStats(db);
    db.close();
    return;
  }

  const t0 = Date.now();
  console.log(
    `[hb-history] ${SQLITE_FILE} · seasons=${SEASONS}${DRY ? ' (dry-run)' : ''}`
  );

  const be = await collectBetExplorerSeasons();
  console.log(
    `[hb-history] betexplorer (pages de saison) : ${be.pagesOk} ok, ${be.pagesFail} échecs, ${be.matches} matchs`
  );
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
  ).run(String(SEASONS));
  db.close();

  console.log(`[hb-history] collectés=${rows.size} insertés=${ins} adjacents(dédup)=${adj}`);
  printStats(await openDb());
  console.log(`[hb-history] ✅ terminé en ${Math.round((Date.now() - t0) / 1000)}s`);
}

main().catch((err) => {
  console.error('[hb-history] ERREUR', err);
  process.exitCode = 1;
});
