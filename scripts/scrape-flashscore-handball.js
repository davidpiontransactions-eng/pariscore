#!/usr/bin/env node
'use strict';
/**
 * scrape-flashscore-handball.js
 * ------------------------------
 * Routine : programme handball Flashscore (feed interne J+0..J+7).
 *
 * Source : https://2.flashscore.ninja/2/x/feed/f_7_{day}_1_en_1
 * Sortie : data/flashscore_handball.json { updatedAt, source, matches[] }
 *
 * Feed codes handball (mapping VÉRIFIÉ empiriquement sur le feed brut
 * le 2026-09-24 — 248 matchs terminés J-7..J0 + cross-check betexplorer) :
 *   CX/AE = domicile, AF = extérieur, AD = timestamp kickoff,
 *   AG = score final LOCAUX, AH = score final VISITEURS,
 *   BA = buts LOCAUX à la MT, BB = buts VISITEURS à la MT,
 *   AT/AU = score à 60' (régulation) — identique à AG/AH sauf prolongation
 *           (5/248 OT : AT = AU = nul à 60', ex. Grindsted 29-29 → 30-38),
 *   BC/BD = 2e mi-temps, BE/BF/RPA/RPB = buts prolongation (non exposés),
 *   AS/AZ = statut (1=live, 2=finished)
 * Bug #10 (avant fix) : AG/AT écrits en mi-temps et AH/AU en final →
 *   score = "visiteur-visiteur" (A-A) et MT = "local-local".
 *
 * Usage :
 *   node scripts/scrape-flashscore-handball.js              # J+0..J+7
 *   node scripts/scrape-flashscore-handball.js --days=3     # J+0..J+3
 *   node scripts/scrape-flashscore-handball.js --dry-run    # parse sans écrire
 *
 * Cron VPS : pm2 `pariscore-cron-flashscore-handball`, quotidien 06:30 UTC.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const FEED_BASE = 'https://2.flashscore.ninja/2/x/feed';
const SPORT_HANDBALL = 7;
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36';
const XSIGN = process.env.FLASH_XFSIGN || 'SW9D1eZo';
const HTTP_TIMEOUT_MS = 25000;
const DELAY_MS = 800;
const MAX_DAYS = 7;
const RETRIES = 2;

const SCRIPT_DIR = path.dirname(__filename);
const REPO_DIR = path.dirname(SCRIPT_DIR);
const DEFAULT_OUT = path.join(REPO_DIR, 'data', 'flashscore_handball.json');

// ─── Status mapping ──────────────────────────────────────────────────────────
function mapStatus(raw) {
  const s = (raw || '').toString().trim();
  if (s === '1') return 'live';
  if (s === '2') return 'finished';
  if (s === '3') return 'cancelled';
  if (s === '4') return 'postponed';
  return 'scheduled';
}

function parseTimestamp(ts) {
  const n = parseInt(ts, 10);
  if (Number.isInteger(n) && n > 1000000000) return new Date(n * 1000).toISOString();
  return null;
}

// ─── Parser le feed Flashscore handball ───────────────────────────────────────
function parseDay(body) {
  const matches = [];
  const tokens = body.split('\u00AC').filter(Boolean);

  let curLeague = '';
  let curCountry = '';
  let cur = null;

  const flush = () => {
    if (cur && cur.id && cur.home && cur.away) {
      // Construire le score
      let score = null;
      if (cur.homeFT != null && cur.awayFT != null) {
        score = `${cur.homeFT} - ${cur.awayFT}`;
      }

      matches.push({
        id: `fs-${cur.id}`,
        time: cur.kickoff || '',
        home: cur.home,
        away: cur.away,
        score,
        isLive: cur.status === 'live',
        isFinished: cur.status === 'finished',
        league: curLeague,
        country: curCountry,
        odds: cur.odds || [],
        minute: cur.minute,
        homeHalf: cur.homeHT,
        awayHalf: cur.awayHT,
      });
    }
    cur = null;
  };

  for (const tok of tokens) {
    const t = tok.trim();
    if (!t) continue;

    // En-tête de compétition
    if (t.startsWith('~ZA\u00F7')) {
      flush();
      const raw = t.slice(4).trim();
      const parts = raw.split(':');
      if (parts.length >= 2) {
        curCountry = parts[0].trim();
        curLeague = parts.slice(1).join(':').trim();
      } else {
        curCountry = '';
        curLeague = raw;
      }
      continue;
    }

    // Ligne de match
    if (t.startsWith('~AA\u00F7')) {
      flush();
      cur = { id: t.slice(4).trim() };
      continue;
    }

    // Ignorer les séparateurs
    if (t === '~' || t.startsWith('~~') || t.startsWith('~QA') ||
        t.startsWith('~FG') || t.startsWith('~SG') || t.startsWith('~OAJ')) {
      continue;
    }

    // Clé-valeur
    const sep = t.indexOf('\u00F7');
    if (sep < 0 || !cur) continue;
    const k = t.slice(0, sep).trim().toUpperCase();
    const v = t.slice(sep + 1).trim();

    switch (k) {
      case 'AD': {
        if (!cur.ts) {
          cur.ts = parseInt(v, 10);
          const iso = parseTimestamp(v);
          if (iso) cur.kickoff = iso;
        }
        break;
      }
      case 'CX': // Home team (short)
      case 'AE': // Home team (full)
        if (!cur.home || k === 'AE') cur.home = v;
        break;
      case 'AF': // Away team (full)
        cur.away = v;
        break;
      // Clés de score — mapping vérifié empiriquement sur le feed brut
      // (2026-09-24, 248 matchs terminés, invariants BA+BC(+BE) = AG et
      // BB+BD(+BF) = AH, cross-check betexplorer) :
      //   AG/AH = final local/visiteur · BA/BB = MT local/visiteur
      //   AT/AU = score à 60' (régulation, ignoré : ≠ final si prolongation)
      //   BC/BD = 2e MT · BE/BF/RPA/RPB = prolongation (ignorés)
      case 'AG': // Score final LOCAUX
        cur.homeFT = parseInt(v, 10);
        break;
      case 'AH': // Score final VISITEURS
        cur.awayFT = parseInt(v, 10);
        break;
      case 'BA': // Buts LOCAUX à la mi-temps
        cur.homeHT = parseInt(v, 10);
        break;
      case 'BB': // Buts VISITEURS à la mi-temps
        cur.awayHT = parseInt(v, 10);
        break;
      case 'AS': // Statut principal
      case 'AZ': // Statut alternatif
        if (!cur.status || cur.status === 'scheduled') {
          cur.status = mapStatus(v);
        }
        break;
      case 'AO': // Elapsed / last update
        if (cur.status === 'live') {
          const elapsed = parseInt(v, 10);
          if (!isNaN(elapsed) && elapsed > 1000000000) {
            // C'est un timestamp, pas des minutes
            cur.minute = Math.floor((Date.now() / 1000 - elapsed) / 60);
          }
        }
        break;
      // Cotes 1X2
      case 'OD': {
        if (!cur.odds) cur.odds = [];
        const o = parseFloat(v);
        if (o > 1 && o < 100) cur.odds[0] = o;
        break;
      }
      case 'OE': {
        if (!cur.odds) cur.odds = [];
        const o = parseFloat(v);
        if (o > 1 && o < 100) cur.odds[1] = o;
        break;
      }
      case 'OF': {
        if (!cur.odds) cur.odds = [];
        const o = parseFloat(v);
        if (o > 1 && o < 100) cur.odds[2] = o;
        break;
      }
    }
  }

  flush();
  return matches;
}

// ─── HTTP fetch ──────────────────────────────────────────────────────────────
async function fetchFeed(url) {
  return new Promise((resolve, reject) => {
    const attempt = (left) => {
      const req = https.get(url, {
        headers: {
          'User-Agent': USER_AGENT,
          Referer: 'https://www.flashscore.com/',
          'x-fsign': XSIGN,
          'X-Requested-With': 'XMLHttpRequest',
          Accept: '*/*',
        },
      }, (res) => {
        let s = '';
        res.on('data', (d) => { s += d; });
        res.on('end', () => {
          if (res.statusCode === 200) return resolve(s);
          if (left > 0) return setTimeout(() => attempt(left - 1), 2000);
          reject(new Error(`HTTP ${res.statusCode}`));
        });
      });
      req.on('error', (e) => {
        if (left > 0) return setTimeout(() => attempt(left - 1), 2000);
        reject(e);
      });
      req.setTimeout(HTTP_TIMEOUT_MS, () => { req.destroy(new Error('timeout')); });
    };
    attempt(RETRIES);
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ─── CLI ─────────────────────────────────────────────────────────────────────
const ARGS = process.argv.slice(2);

function argValue(name) {
  for (let i = 0; i < ARGS.length; i++) {
    if (ARGS[i] === name && i + 1 < ARGS.length) return ARGS[i + 1];
    if (ARGS[i].startsWith(name + '=')) return ARGS[i].slice(name.length + 1);
  }
  return undefined;
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  const daysRaw = argValue('--days');
  const days = Math.min(MAX_DAYS, Math.max(0, parseInt(daysRaw ?? '7', 10) || 0));
  const dryRun = ARGS.includes('--dry-run');
  const outArg = argValue('--out');
  const outPath = outArg ? path.resolve(outArg) : DEFAULT_OUT;
  console.log(`[flashscore-handball] out=${outPath} days=0..${days}${dryRun ? ' (dry-run)' : ''}`);

  // Inclure hier (J-1) pour les matchs terminés + aujourd'hui..J+N pour les à venir
  const all = [];
  const seen = new Set();
  let emptyStreak = 0;

  // J-1 (matchs terminés pour le form store)
  try {
    const body = await fetchFeed(`${FEED_BASE}/f_${SPORT_HANDBALL}_-1_1_en_1`);
    const parsed = parseDay(body);
    for (const m of parsed) {
      const key = `${m.home}|${m.away}|${m.time}`;
      if (!seen.has(key)) { seen.add(key); all.push(m); }
    }
    console.log(`[flashscore-handball] J-1: ${parsed.length} matchs`);
  } catch (err) {
    console.error(`[flashscore-handball] J-1 KO: ${err.message}`);
  }
  await sleep(DELAY_MS);

  for (let day = 0; day <= days; day++) {
    if (day > 0) await sleep(DELAY_MS);
    let body = '';
    try {
      const url = `${FEED_BASE}/f_${SPORT_HANDBALL}_${day}_1_en_1`;
      body = await fetchFeed(url);
    } catch (err) {
      console.error(`[flashscore-handball] J+${day} KO: ${err.message}`);
      continue;
    }
    const parsed = parseDay(body);
    let added = 0;
    for (const m of parsed) {
      const key = `${m.home}|${m.away}|${m.time}`;
      if (seen.has(key)) continue;
      seen.add(key);
      all.push(m);
      added += 1;
    }
    console.log(`[flashscore-handball] J+${day}: ${parsed.length} matchs (${added} nouveaux)`);
    emptyStreak = parsed.length === 0 ? emptyStreak + 1 : 0;
    if (emptyStreak >= 2) {
      console.log('[flashscore-handball] 2 jours vides consecutifs -> stop');
      break;
    }
  }

  console.log(`[flashscore-handball] total: ${all.length} matchs`);

  if (dryRun) {
    console.log(JSON.stringify(all.slice(0, 5), null, 2));
    return;
  }

  const output = {
    scraped_at: new Date().toISOString(),
    source: 'flashscore',
    sport: 'handball',
    live_only: false,
    total: all.length,
    matches: all,
  };

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2), 'utf-8');
  console.log(`[flashscore-handball] \u2705 ${output.total} matchs -> ${outPath}`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error('[flashscore-handball] FATAL:', err.message);
    process.exit(1);
  });
}

module.exports = { parseDay, fetchFeed };
