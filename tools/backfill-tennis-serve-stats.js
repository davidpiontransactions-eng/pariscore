/**
 * tools/backfill-tennis-serve-stats.js
 *
 * Backfill les stats de service (aces, double faults, % 1er/2nd service)
 * dans tennis_matches_internal depuis BSD match detail endpoint.
 *
 * USAGE:
 *   node tools/backfill-tennis-serve-stats.js [--limit=N] [--days=N]
 *     --limit=N   nombre max de matchs à traiter (défaut: 500)
 *     --days=N    uniquement les N derniers jours (défaut: 180)
 *     --dry-run   simulation sans écriture
 *     --all       ignorer la limite, tout backfill (attention: 21k appels API)
 *     --throttle  ms entre chaque appel (défaut: 350)
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = __dirname.replace(/\/tools$/, '').replace(/\\tools$/, '');
const DB_PATH = process.env.DATABASE_PATH || path.join(ROOT, 'pariscore.db');
const BSD_KEY = loadEnv();
const BSD_BASE = 'https://sports.bzzoiro.com/tennis/api/v2';

const LIMIT = parseInt(process.argv.find(a => a.startsWith('--limit='))?.split('=')[1] || '500', 10);
const DAYS = parseInt(process.argv.find(a => a.startsWith('--days='))?.split('=')[1] || '180', 10);
const THROTTLE = parseInt(process.argv.find(a => a.startsWith('--throttle='))?.split('=')[1] || '350', 10);
const IS_DRY = process.argv.includes('--dry-run');
const IS_ALL = process.argv.includes('--all');

function loadEnv() {
  try {
    const envPath = path.join(ROOT, '.env');
    if (!fs.existsSync(envPath)) return null;
    const content = fs.readFileSync(envPath, 'utf8');
    const m = content.match(/^BSD_API_KEY\s*=\s*(\S+)/m);
    return m ? m[1] : null;
  } catch { return null; }
}

function pause(ms) { return new Promise(r => setTimeout(r, ms)); }

function bsdFetch(matchId) {
  return new Promise((resolve, reject) => {
    const url = `${BSD_BASE}/matches/${matchId}/`;
    https.get(url, { headers: { 'Authorization': `Token ${BSD_KEY}` }, timeout: 10000 }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error(`JSON parse: ${e.message}`)); }
      });
    }).on('error', reject);
  });
}

async function bsdFetchRetry(matchId, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try { return await bsdFetch(matchId); }
    catch (e) { if (i === retries) throw e; await pause(1000 * (i + 1)); }
  }
}

async function main() {
  if (!BSD_KEY) { console.error('[serve-backfill] BSD_API_KEY manquante'); process.exit(1); }
  const D = require(path.join(ROOT, 'node_modules', 'better-sqlite3'));
  const db = new D(DB_PATH);
  db.pragma('journal_mode = WAL');

  const cutoff = Math.floor(Date.now() / 1000) - DAYS * 86400;
  const total = db.prepare('SELECT COUNT(*) as c FROM tennis_matches_internal WHERE w_ace IS NULL').get().c;
  console.log(`[serve-backfill] Matchs sans stats serve: ${total}`);
  console.log(`[serve-backfill] Fenêtre: ${DAYS}j (cutoff ts ${cutoff})`);

  const limitClause = IS_ALL ? '' : `LIMIT ${LIMIT}`;
  const rows = db.prepare(`
    SELECT source, source_id, tourney_date, winner_name, loser_name
    FROM tennis_matches_internal
    WHERE w_ace IS NULL AND source='bsd'
    AND (match_date IS NULL OR match_date >= ${cutoff})
    ORDER BY match_date DESC
    ${limitClause}
  `).all();
  console.log(`[serve-backfill] À traiter: ${rows.length} matchs`);

  const updateStmt = db.prepare(`UPDATE tennis_matches_internal SET
    w_ace=?, w_df=?,
    l_ace=?, l_df=?,
    w_1stIn=?, w_1stWon=?, w_2ndWon=?,
    l_1stIn=?, l_1stWon=?, l_2ndWon=?
    WHERE source=? AND source_id=?`);

  let done = 0, errors = 0, withData = 0;

  for (const row of rows) {
    const matchId = row.source_id;
    try {
      const res = await bsdFetchRetry(matchId);
      const data = res?.data || res || {};
      const p1 = data.player1 || {};
      const p2 = data.player2 || {};

      const p1Aces = toInt(data.p1_aces);
      const p2Aces = toInt(data.p2_aces);
      const p1Df = toInt(data.p1_double_faults);
      const p2Df = toInt(data.p2_double_faults);
      const p1FirstPct = toPct(data.p1_first_serve_pct);
      const p2FirstPct = toPct(data.p2_first_serve_pct);
      const p1FirstWon = toPct(data.p1_first_serve_won_pct);
      const p2FirstWon = toPct(data.p2_first_serve_won_pct);
      const p1SecondWon = toPct(data.p1_second_serve_won_pct);
      const p2SecondWon = toPct(data.p2_second_serve_won_pct);

      const hasData = p1Aces != null || p2Aces != null || p1Df != null || p2Df != null;
      if (!hasData) {
        done++;
        if (done % 50 === 0) process.stdout.write('.');
        await pause(THROTTLE);
        continue;
      }
      withData++;

      // Determine winner/loser from source data
      const winnerId = data.winner_id;
      const isP1Winner = winnerId != null && String(winnerId) === String(p1.id);

      if (!IS_DRY) {
        const wAce = isP1Winner ? p1Aces : p2Aces;
        const lAce = isP1Winner ? p2Aces : p1Aces;
        const wDf = isP1Winner ? p1Df : p2Df;
        const lDf = isP1Winner ? p2Df : p1Df;
        const w1stIn = isP1Winner ? p1FirstPct : p2FirstPct;
        const l1stIn = isP1Winner ? p2FirstPct : p1FirstPct;
        const w1stWon = isP1Winner ? p1FirstWon : p2FirstWon;
        const l1stWon = isP1Winner ? p2FirstWon : p1FirstWon;
        const w2ndWon = isP1Winner ? p1SecondWon : p2SecondWon;
        const l2ndWon = isP1Winner ? p2SecondWon : p1SecondWon;

        updateStmt.run(wAce, wDf, lAce, lDf,
          w1stIn, w1stWon, w2ndWon,
          l1stIn, l1stWon, l2ndWon,
          'bsd', matchId);
      }

      done++;
      if (done % 50 === 0) process.stdout.write('.');
    } catch (e) {
      errors++;
      if (errors <= 5) console.error(`\n[serve-backfill] ERR match ${row.source_id} (${row.winner_name} vs ${row.loser_name}): ${e.message}`);
    }
    await pause(THROTTLE);
  }

  console.log(`\n[serve-backfill] === RÉSULTAT ===`);
  console.log(`[serve-backfill] Traités: ${done} / ${rows.length}`);
  console.log(`[serve-backfill] Avec stats serve: ${withData}`);
  console.log(`[serve-backfill] Erreurs: ${errors}`);
  if (IS_DRY) console.log(`[serve-backfill] DRY RUN — aucune écriture`);

  db.close();
}

function toInt(v) { return (v === null || v === undefined || v === '') ? null : (Number.isFinite(Number(v)) ? Number(v) : null); }
function toPct(v) { return (v === null || v === undefined || v === '') ? null : (Number.isFinite(Number(v)) ? Number(v) : null); }

main().catch(e => { console.error('[serve-backfill] FATAL:', e); process.exit(1); });
