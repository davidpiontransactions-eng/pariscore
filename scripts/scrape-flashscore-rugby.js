#!/usr/bin/env node
'use strict';
/**
 * scrape-flashscore-rugby.js
 * ---------------------------
 * Routine : programme Top 14 Flashscore (feed interne J+0..J+7).
 *
 * Source : Flashscore.fr rugby/france/top-14/calendrier (API interne)
 * Sortie : data/flashscore-rugby.json { updatedAt, source, matches[] }
 *
 * Usage :
 *   node scripts/scrape-flashscore-rugby.js              # pass J+0..J+7
 *   node scripts/scrape-flashscore-rugby.js --days=3     # J+0..J+3
 *   node scripts/scrape-flashscore-rugby.js --dry-run    # parse sans écrire
 *   node scripts/scrape-flashscore-rugby.js --out=path   # sortie custom
 *
 * Note : Flashscore rugby utilise l'API interne https://2.flashscore.ninja
 * ou directement https://www.flashscore.fr avec headers appropriés.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const FEED_BASE = 'https://2.flashscore.ninja/2/x/feed';
const SPORT_RUGBY = 5; // sport rugby code Flashscore
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36';
const XSIGN = process.env.FLASH_XFSIGN || 'SW9D1eZo';
const HTTP_TIMEOUT_MS = 30000;
const DELAY_MS = 500; // politesse entre jours
const MAX_DAYS = 7;
const RETRIES = 2;

const SCRIPT_DIR = path.dirname(__filename);
const REPO_DIR = path.dirname(SCRIPT_DIR);
const DEFAULT_OUT = path.join(REPO_DIR, 'data', 'flashscore-rugby.json');

/** Mapper un code sport Flashscore vers le nom. */
function sportName(code) {
  const s = (code || '').toString().trim();
  if (s === '5' || s.toLowerCase() === 'rugby') return 'Rugby';
  return 'Rugby';
}

/** Extraire la date ISO d'un timestamp Unix. */
function parseTimestamp(ts) {
  if (Number.isInteger(ts) && ts > 0) {
    return new Date(ts * 1000).toISOString();
  }
  return null;
}

/** Parser un feed jour Flashscore rugby. */
function parseDay(body) {
  const matches = [];
  const tokens = body.split('¬').filter(Boolean);
  let cur = null;
  const flush = () => {
    if (cur && cur.id && cur.home && cur.away && Number.isFinite(cur.ts)) {
      matches.push({
        matchId: `fs-${cur.id}`,
        competition: 'top-14',
        competitionName: 'Top 14',
        scheduledAt: parseTimestamp(cur.ts),
        home: cur.home || 'Inconnu',
        away: cur.away || 'Inconnu',
        leagueId: cur.leagueId || '',
        status: cur.status || 'scheduled',
      });
    }
    cur = null;
  };
  for (const tok of tokens) {
    // En-têtes de compétition ZA
    if (tok.startsWith('~ZA÷')) {
      flush();
      // Extraire le nom de la compétition
      const compName = tok.slice(4).trim() || 'Top 14';
      cur = { ...compName };
      continue;
    }
    // Lignes de match AA
    if (tok.startsWith('~AA÷')) {
      flush();
      cur = { id: tok.slice(4) };
      continue;
    }
    // Séparateurs et autres balises
    if (tok === '~' || tok.startsWith('~~') || tok.startsWith('~QA') || tok.startsWith('~FG') || tok.startsWith('~SG')) {
      flush();
      continue;
    }
    // Clé-valeur ÷
    const sep = tok.indexOf('÷');
    if (sep < 0 || !cur) continue;
    const k = tok.slice(0, sep).trim().toUpperCase();
    const v = tok.slice(sep + 1).trim();
    if (k === 'AD' && !cur.ts) cur.ts = parseInt(v, 10);
    else if (k === 'AW') cur.home = v;
    else if (k === 'AL') cur.away = v;
    else if (k === 'TS') cur.status = v; // statut
    else if (k === 'LE') cur.leagueId = v; // ligue/ID
    else if (k === 'CT') /* compétition - ignorer, déjà lu */ ;
  }
  flush();
  return matches;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const ARGS = process.argv.slice(2);

function argValue(name) {
  for (let i = 0; i < ARGS.length; i++) {
    if (ARGS[i] === name && i + 1 < ARGS.length) return ARGS[i + 1];
    if (ARGS[i].startsWith(name + '=')) return ARGS[i].slice(name.length + 1);
  }
  return undefined;
}

async function main() {
  const daysRaw = argValue('--days');
  const days = Math.min(MAX_DAYS, Math.max(0, parseInt(daysRaw ?? '7', 10) || 0));
  const dryRun = ARGS.includes('--dry-run');
  const outArg = argValue('--out');
  const outPath = outArg ? path.resolve(outArg) : DEFAULT_OUT;
  console.log(`[flashscore-rugby] out=${outPath} days=0..${days}${dryRun ? ' (dry-run)' : ''}`);

  const all = [];
  const seen = new Set();
  let emptyStreak = 0;
  for (let day = 0; day <= days; day++) {
    if (day > 0) await sleep(DELAY_MS);
    let body = '';
    try {
      const url = `${FEED_BASE}/f_${SPORT_RUGBY}_${day}_1_en_1`;
      body = await fetchFeed(url);
    } catch (err) {
      console.error(`[flashscore-rugby] jour J+${day} KO: ${err.message}`);
      continue;
    }
    const parsed = parseDay(body);
    let added = 0;
    for (const m of parsed) {
      const key = `${m.home}|${m.away}|${m.scheduledAt}`;
      if (seen.has(key)) continue;
      seen.add(key);
      all.push(m);
      added += 1;
    }
    console.log(`[flashscore-rugby] J+${day}: ${parsed.length} matchs (${added} nouveaux)`);
    emptyStreak = parsed.length === 0 ? emptyStreak + 1 : 0;
    if (emptyStreak >= 2) {
      console.log('[flashscore-rugby] 2 jours vides consécutifs → stop');
      break;
    }
  }

  console.log(`[flashscore-rugby] total: ${all.length} matchs`);
  if (dryRun) {
    console.log(JSON.stringify(all.slice(0, 3), null, 1));
    return;
  }
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify({ updatedAt: new Date().toISOString(), source: 'flashscore', matches: all }, null, 1));
  console.log(`[flashscore-rugby] écrit: ${outPath}`);
}

async function fetchFeed(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Referer: 'https://www.flashscore.fr/',
        'x-fsign': XSIGN,
        'X-Requested-With': 'XMLHttpRequest',
        Accept: '*/*',
      },
    }, (res) => {
      let s = '';
      res.on('data', (d) => { s += d; });
      res.on('end', () => {
        if (res.statusCode === 200) return resolve(s);
        reject(new Error(`HTTP ${res.statusCode}`));
      });
    });
    req.on('error', (e) => reject(e));
    req.setTimeout(HTTP_TIMEOUT_MS, () => { req.destroy(new Error('timeout')); });
  });
}

if (require.main === module) {
  main().catch((err) => { console.error('[flashscore-rugby] FATAL:', err.message); process.exit(1); });
}

module.exports = { parseDay, fetchFeed, sportName };