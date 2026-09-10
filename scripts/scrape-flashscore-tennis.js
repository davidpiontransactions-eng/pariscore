#!/usr/bin/env node
'use strict';
/**
 * scrape-flashscore-tennis.js
 * ---------------------------
 * Routine matinale : programme tennis Flashscore (feed interne J+0..J+7).
 *
 * Source : https://2.flashscore.ninja/2/x/feed/f_2_{day}_1_en_1 (sport tennis=2)
 * Auth feed : header `x-fsign` (surchargable via FLASH_XFSIGN si rotation).
 * Données extraites par match programmé (AB=1) :
 *   - id Flashscore (fs-<id>), kickoff ISO, joueurs (noms courts), pays,
 *     tournoi + surface (en-tête ZA).
 * Sortie : data/flashscore-tennis.json { updatedAt, source, matches[] },
 * consommé par /api/tennis/strategy-top10 (fusion dédupliquée par paire).
 *
 * Usage :
 *   node scripts/scrape-flashscore-tennis.js              # pass J+0..J+7
 *   node scripts/scrape-flashscore-tennis.js --days=3     # J+0..J+3
 *   node scripts/scrape-flashscore-tennis.js --dry-run    # parse sans écrire
 *   node scripts/scrape-flashscore-tennis.js --out=path   # sortie custom
 *
 * Cron VPS : pm2 `pariscore-cron-flashscore-tennis`, quotidien 06:15 UTC
 * (ecosystem.config.js). ~8 requêtes HTTP/jour, délai 800 ms entre jours.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');

// ─── Constantes ───────────────────────────────────────────────────────────────
const FEED_BASE = 'https://2.flashscore.ninja/2/x/feed';
const SPORT_TENNIS = 2;
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36';
const XSIGN = process.env.FLASH_XFSIGN || 'SW9D1eZo';
const HTTP_TIMEOUT_MS = 25000;
const DELAY_MS = 800; // politesse entre jours
const MAX_DAYS = 7;
const RETRIES = 2;

const SCRIPT_DIR = path.dirname(__filename);
const REPO_DIR = path.dirname(SCRIPT_DIR);
const DEFAULT_OUT = path.join(REPO_DIR, 'data', 'flashscore-tennis.json');

/** Surface ZA ("hard") → libellé app. */
function mapSurface(raw) {
  const s = (raw || '').toLowerCase();
  if (s.includes('clay')) return 'Terre battue';
  if (s.includes('grass')) return 'Gazon';
  if (s.includes('carpet') || s.includes('moquette')) return 'Moquette';
  return 'Dur';
}

/** "ATP - SINGLES: US Open (USA), hard" → { name, surface }. */
function parseTournament(za) {
  const m = /^.*?:\s*(.*?)(?:\s*\((?:[^)]*)\))?\s*,\s*([a-z]+)\s*$/i.exec(za || '');
  if (!m) return { name: (za || 'Tournoi').slice(0, 80), surface: 'Dur' };
  return { name: m[1].trim().slice(0, 80) || 'Tournoi', surface: mapSurface(m[2]) };
}

function fetchFeed(day) {
  const url = `${FEED_BASE}/f_${SPORT_TENNIS}_${day}_1_en_1`;
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
          reject(new Error(`HTTP ${res.statusCode} day=${day} (x-fsign peut-être périmé → FLASH_XFSIGN)`));
        });
      });
      req.on('error', (e) => {
        if (left > 0) return setTimeout(() => attempt(left - 1), 2000);
        reject(e);
      });
      req.setTimeout(HTTP_TIMEOUT_MS, () => { req.destroy(new Error(`timeout day=${day}`)); });
    };
    attempt(RETRIES);
  });
}

/** Parse un feed jour → matchs programmés (AB=1). */
function parseDay(body) {
  const matches = [];
  let tournament = { name: 'Tournoi', surface: 'Dur' };
  // Les blocs sont séquentiels : en-tête ZA puis ses matchs AA.
  const tokens = body.split('¬').filter(Boolean);
  let cur = null;
  const flush = () => {
    if (cur && cur.status === '1' && cur.home && cur.away && Number.isFinite(cur.ts)) {
      matches.push({
        matchId: `fs-${cur.id}`,
        tournament: tournament.name,
        round: '',
        scheduledAt: new Date(cur.ts * 1000).toISOString(),
        surface: tournament.surface,
        playerA: { name: cur.home, shortName: cur.home, country: cur.homeCountry || null },
        playerB: { name: cur.away, shortName: cur.away, country: cur.awayCountry || null },
      });
    }
    cur = null;
  };
  for (const tok of tokens) {
    // Blocs AA / en-têtes ZA d'abord (contiennent aussi un ÷).
    if (tok.startsWith('~AA÷')) { flush(); cur = { id: tok.slice(4) }; continue; }
    if (tok.startsWith('~ZA÷')) { flush(); tournament = parseTournament(tok.slice(4)); continue; }
    if (tok === '~' || tok.startsWith('~~') || tok.startsWith('~QA') || tok.startsWith('~FG') || tok.startsWith('~SG')) { flush(); continue; }
    const sep = tok.indexOf('÷');
    if (sep < 0 || !cur) continue;
    const k = tok.slice(0, sep);
    const v = tok.slice(sep + 1);
    if (k === 'AD' && !cur.ts) cur.ts = parseInt(v, 10);
    else if (k === 'AB') cur.status = v;
    else if (k === 'CX') cur.home = v;
    else if (k === 'AF') cur.away = v;
    else if (k === 'FU') cur.homeCountry = v || null;
    else if (k === 'FV') cur.awayCountry = v || null;
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
  console.log(`[flashscore-tennis] out=${outPath} days=0..${days}${dryRun ? ' (dry-run)' : ''}`);

  const all = [];
  const seen = new Set();
  let emptyStreak = 0;
  for (let day = 0; day <= days; day++) {
    if (day > 0) await sleep(DELAY_MS);
    let body = '';
    try {
      body = await fetchFeed(day);
    } catch (err) {
      console.error(`[flashscore-tennis] jour J+${day} KO: ${err.message}`);
      continue;
    }
    const parsed = parseDay(body);
    let added = 0;
    for (const m of parsed) {
      const pair = [m.playerA.name, m.playerB.name].map((n) => n.toLowerCase()).sort().join('|');
      const key = `${pair}@${m.scheduledAt}`;
      if (seen.has(key)) continue;
      seen.add(key);
      all.push(m);
      added += 1;
    }
    console.log(`[flashscore-tennis] J+${day}: ${parsed.length} programmés (${added} nouveaux)`);
    emptyStreak = parsed.length === 0 ? emptyStreak + 1 : 0;
    if (emptyStreak >= 2) { console.log('[flashscore-tennis] 2 jours vides consécutifs → stop'); break; }
  }

  console.log(`[flashscore-tennis] total: ${all.length} matchs`);
  if (dryRun) {
    console.log(JSON.stringify(all.slice(0, 3), null, 1));
    return;
  }
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify({ updatedAt: new Date().toISOString(), source: 'flashscore', matches: all }, null, 1));
  console.log(`[flashscore-tennis] écrit: ${outPath}`);
}

if (require.main === module) {
  main().catch((err) => { console.error('[flashscore-tennis] FATAL:', err.message); process.exit(1); });
}

// Exporté pour tests unitaires (parse sans réseau).
module.exports = { parseDay, parseTournament, mapSurface };
