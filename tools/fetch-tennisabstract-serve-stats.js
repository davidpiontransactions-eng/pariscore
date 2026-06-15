/**
 * tools/fetch-tennisabstract-serve-stats.js
 *
 * Backfill serve stats dans tennis_matches_internal depuis les pages
 * tourney.cgi de Tennis Abstract.
 *
 * USAGE:
 *   node tools/fetch-tennisabstract-serve-stats.js [--limit=N] [--dry-run]
 *     --limit=N   max tournois à traiter (défaut: 20, 0 = pas de limite)
 *     --dry-run   simulation sans écriture
 *     --tour=X    ATP | WTA (défaut: tous)
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = __dirname.replace(/\/tools$/, '').replace(/\\tools$/, '');
const DB_PATH = process.env.DATABASE_PATH || path.join(ROOT, 'pariscore.db');
const TA_BASE = 'https://www.tennisabstract.com/cgi-bin';

const LIMIT = parseInt(process.argv.find(a => a.startsWith('--limit='))?.split('=')[1] || '20', 10);
const IS_DRY = process.argv.includes('--dry-run');
const FILTER_TOUR = process.argv.find(a => a.startsWith('--tour='))?.split('=')[1] || null;

// === Tennis Abstract Tournament ID Map ===
// Confirmés par probes: GS, ATP 1000, Tour Finals, + quelques 500/250
// Ajouter au besoin au fil des découvertes.
const TA_ID_MAP = {
  // Grand Slams
  'Australian Open': { id: '580' },
  'Roland Garros': { id: '520' },
  'Wimbledon': { nameOnly: true },
  'US Open': { id: '560' },

  // ATP Masters 1000
  'Indian Wells': { id: '0404' },
  'Miami': { id: '0403' },
  'Monte Carlo': { id: '0410' },
  'Madrid': { id: '1536' },
  'Rome': { id: '0416' },
  'Cincinnati': { id: '0168' },
  'Montreal / Toronto': { id: '0418' },
  'Shanghai': { id: '0746' },
  'Paris Masters': { id: '0352' },

  // ATP + WTA prefix variants
  'ATP Indian Wells Masters': { id: '0404' },
  'WTA 1000 Indian Wells': { id: '0404' },
  'ATP Miami Masters': { id: '0403' },
  'WTA 1000 Miami': { id: '0403' },
  'ATP Madrid Masters': { id: '1536' },
  'WTA 1000 Madrid': { id: '1536' },
  'ATP Rome Masters': { id: '0416' },
  'WTA 1000 Rome': { id: '0416' },
  'ATP Cincinnati Masters': { id: '0168' },
  'WTA 1000 Cincinnati': { id: '0168' },
  'ATP Monte Carlo Masters': { id: '0410' },
  'ATP Shanghai Masters': { id: '0746' },
  'WTA 1000 Doha / Dubai': { id: '0402' },
  'ATP Paris Masters': { id: '0352' },

  // WTA 1000 prefix variants
  'WTA 1000 Doha': { id: '0402' },
  'WTA 1000 Dubai': { id: '0402' },
  'WTA 1000 Charleston': { id: '0803' },
  'WTA 1000 Beijing': { id: '0747' },
  'WTA 1000 Wuhan': { id: '0505' },

  // Tour Finals
  'ATP Tour Finals': { id: '0605' },
  'WTA Tour Finals': { id: '0800' },

  // ATP 500
  'Rotterdam': { id: '0407' },
  'Dubai': { id: '0481' },
  'Barcelona': { id: '0406' },
  'Halle': { id: '0510' },
  'London / Queen\'s': { id: '0499' },
  'Hamburg': { id: '0414' },
  'Washington': { id: '0322' },
  'Beijing': { id: '0747' },
  'Tokyo': { id: '0323' },
  'Basel': { id: '0338' },
  'Vienna': { id: '0337' },
  'Vienna, Austria': { id: '0337' },
  'Beijing, China': { id: '0747' },
  'Doha': { id: '0402' },
  'Hamburg, Germany': { id: '0414' },
  'Barcelona, Spain': { id: '0406' },

  // WTA 500 (tentative)
  'WTA 500 Brisbane': { id: '0801' },
  'WTA 500 Adelaide': { id: '0802' },
  'WTA 500 Stuttgart': { id: '0520' },
  'WTA 500 Berlin': { id: '0509' },
  'WTA 500 Eastbourne': { id: '0499' },
  'WTA 500 San Diego': { id: '0502' },
  'WTA 500 Tokyo': { id: '0323' },

  // ATP 250 (tentative)
  'Brisbane': { id: '0801' },
  'Adelaide': { id: '0802' },
  'Auckland': { id: '0401' },
  'Montpellier': { id: '0501' },
  'Cordoba, Argentina': { id: '0811' },
  'Dallas': { id: '0423' },
  'Buenos Aires': { id: '0419' },
  'Delray Beach': { id: '0425' },
  'Marseille': { id: '0503' },
  'Santiago, Chile': { id: '0810' },
  'Houston': { id: '0420' },
  'Marrakech': { id: '0515' },
  'Bucharest': { id: '0432' },
  'Munich': { id: '0508' },
  'Geneva': { id: '0513' },
  'Lyon': { id: '0519' },
  '\'s-Hertogenbosch': { id: '0506' },
  'Stuttgart': { id: '0520' },
  'Mallorca': { id: '0517' },
  'Newport': { id: '0424' },
  'Bastad': { id: '0428' },
  'Umag': { id: '0430' },
  'Gstaad': { id: '0429' },
  'Atlanta': { id: '0426' },
  'Kitzbuhel': { id: '0433' },
  'Los Cabos': { id: '0805' },
  'Winston-Salem': { id: '0422' },
  'Chengdu': { id: '0806' },
  'Zhuhai': { id: '0807' },
  'Antwerp': { id: '0434' },
  'Stockholm': { id: '0435' },
  'Metz': { id: '0421' },
  'Sofia': { id: '0514' },
  'Budapest': { id: '0516' },
  'Belgrade': { id: '0808' },
  'Parma': { id: '0809' },

  // Other known tournaments
  'Davis Cup': { id: '0900' },
  'Olympics': { id: '0901' },
  'United Cup': { id: '0902' },
};

function pause(ms) { return new Promise(r => setTimeout(r, ms)); }

function taFetch(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      timeout: 20000,
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        resolve({ status: res.statusCode, headers: res.headers, body: data });
      });
    }).on('error', reject).on('timeout', function () { this.destroy(); reject(new Error('timeout')); });
  });
}

async function taFetchRetry(url, retries = 3) {
  let lastErr;
  for (let i = 0; i <= retries; i++) {
    try {
      if (i > 0) {
        const wait = Math.min(4000 * Math.pow(2, i - 1), 30000);
        console.log(`    [TA] Retry ${i}/${retries} after ${wait}ms...`);
        await pause(wait);
      }
      const res = await taFetch(url);
      if (res.status === 429) {
        lastErr = new Error('HTTP 429 rate limited');
        console.log(`    [TA] 429 rate limited (attempt ${i + 1}/${retries + 1})`);
        continue;
      }
      if (res.status !== 200) {
        lastErr = new Error(`HTTP ${res.status}`);
        console.log(`    [TA] HTTP ${res.status} (attempt ${i + 1}/${retries + 1})`);
        continue;
      }
      return res;
    } catch (e) {
      lastErr = e;
      console.log(`    [TA] Error (attempt ${i + 1}/${retries + 1}): ${e.message}`);
    }
  }
  throw lastErr;
}

function extractSinglesTable(html) {
  const m = html.match(/<table[^>]*id\s*=\s*["']singles-results["'][^>]*>[\s\S]*?<\/table>/i);
  return m ? m[0] : null;
}

function extractDataRows(tableHtml) {
  const trs = tableHtml.match(/<tr[\s\S]*?<\/tr>/gi) || [];
  return trs.filter(tr => !/<th/i.test(tr));
}

function extractCells(trHtml) {
  return (trHtml.match(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi) || [])
    .map(c => c.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function normalizePlayerName(name) {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

function normalizeScore(score) {
  if (!score) return '';
  return score.replace(/\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();
}

function makeMatchKey(winner, loser, score) {
  return normalizePlayerName(winner) + '|' + normalizePlayerName(loser) + '|' + normalizeScore(score);
}

function parseScoreGames(score) {
  if (!score) return null;
  const sets = String(score).replace(/\([^)]*\)/g, '').trim().split(/\s+/);
  let w = 0, l = 0, valid = 0;
  for (const s of sets) {
    const mm = s.match(/^(\d{1,2})-(\d{1,2})$/);
    if (!mm) continue;
    w += parseInt(mm[1], 10); l += parseInt(mm[2], 10); valid++;
  }
  return valid ? { w, l } : null;
}

function estimateServePoints(score, tour) {
  const g = parseScoreGames(score);
  if (!g) return null;
  const totalGames = g.w + g.l;
  const gamesPerPlayer = Math.ceil(totalGames / 2);
  const avgPerGame = tour === 'WTA' ? 6.5 : 6.0;
  return Math.round(gamesPerPlayer * avgPerGame);
}

function parsePct(val) {
  if (!val || typeof val !== 'string') return null;
  const m = val.match(/^(\d+(?:\.\d+)?)\s*%/);
  return m ? parseFloat(m[1]) : null;
}

function parseBPSvd(val) {
  if (!val || typeof val !== 'string') return { saved: null, faced: null };
  const m = val.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (!m) return { saved: null, faced: null };
  return { saved: parseInt(m[1], 10), faced: parseInt(m[2], 10) };
}

function buildTAUrl(name, year) {
  const entry = TA_ID_MAP[name];
  if (!entry) return null;
  // Wimbledon name-only format: t=YYYYWimbledon
  if (entry.nameOnly) {
    const cleanName = name.replace(/[^a-zA-Z0-9]/g, '');
    return `${TA_BASE}/tourney.cgi?t=${year}${cleanName}`;
  }
  // Standard format: t=YYYY-ID/Slug
  const slug = name.replace(/[^a-zA-Z0-9\s-]/g, '').trim().replace(/\s+/g, '-');
  return `${TA_BASE}/tourney.cgi?t=${year}-${entry.id}/${slug}`;
}

function buildDBLookup(rows) {
  const map = new Map();
  for (const row of rows) {
    const key = makeMatchKey(row.winner_name, row.loser_name, row.score);
    map.set(key, row);
  }
  return map;
}

async function main() {
  const D = require(path.join(ROOT, 'node_modules', 'better-sqlite3'));
  const db = new D(DB_PATH);
  db.pragma('journal_mode = WAL');

  // Query distinct (tourney_name, year) with missing serve stats
  const missingTotal = db.prepare('SELECT COUNT(*) AS c FROM tennis_matches_internal WHERE w_ace IS NULL AND source=\'bsd\'').get().c;
  console.log(`[TA-serve] Matchs BSD sans stats serve: ${missingTotal}`);

  let groups = db.prepare(`
    SELECT tourney_name, substr(tourney_date, 1, 4) AS year, COUNT(*) AS cnt,
      MIN(tourney_date) AS min_date, MAX(tourney_date) AS max_date
    FROM tennis_matches_internal
    WHERE w_ace IS NULL AND source='bsd' AND tourney_name IS NOT NULL AND tourney_date IS NOT NULL
    ${FILTER_TOUR ? "AND (tourney_name LIKE 'ATP%' OR tourney_name LIKE 'WTA%' OR tourney_name IN (SELECT tourney_name FROM tennis_matches_internal WHERE w_ace IS NULL AND source='bsd' AND (tour='ATP' OR tour='WTA')))" : ''}
    GROUP BY tourney_name, year
    ORDER BY max_date DESC
  `).all();

  console.log(`[TA-serve] Groupes (tournoi, année) sans stats: ${groups.length}`);
  let mapped = 0, unmapped = 0;
  for (const g of groups) {
    if (TA_ID_MAP[g.tourney_name]) mapped++;
    else unmapped++;
  }
  console.log(`[TA-serve]  → dont mappés: ${mapped}, non-mappés: ${unmapped}`);

  if (IS_DRY) console.log(`[TA-serve] DRY RUN — aucune écriture`);

  let processed = 0, updated = 0, errors = 0, skippedUnmapped = 0;
  const processedNames = new Set();

  for (const group of groups) {
    if (LIMIT > 0 && processedNames.size >= LIMIT) break;
    const { tourney_name, year, cnt } = group;

    if (processedNames.has(tourney_name)) continue;
    processedNames.add(tourney_name);

    const taEntry = TA_ID_MAP[tourney_name];
    if (!taEntry) {
      skippedUnmapped++;
      continue;
    }

    const url = buildTAUrl(tourney_name, parseInt(year, 10));
    if (!url) { skippedUnmapped++; continue; }

    console.log(`\n[TA-serve] === ${tourney_name} (${year}) — ${cnt} matchs ===`);
    console.log(`[TA-serve] URL: ${url}`);

    // Fetch TA page
    let response;
    try {
      await pause(4500); // 4.5s throttle between fetches
      response = await taFetchRetry(url);
    } catch (e) {
      console.log(`[TA-serve]   ⚠ Échec fetch: ${e.message}`);
      errors++;
      continue;
    }

    // Parse singles results table
    const tableHtml = extractSinglesTable(response.body);
    if (!tableHtml) {
      // Check if page indicates "no matches"
      if (response.body.includes('No matches') || response.body.includes('no matches')) {
        console.log(`[TA-serve]   ℹ Page: "No matches" (tournoi futur?)`);
      } else {
        console.log(`[TA-serve]   ⚠ #singles-results table non trouvée`);
        errors++;
      }
      continue;
    }

    const rows = extractDataRows(tableHtml);
    console.log(`[TA-serve]   Lignes data dans #singles-results: ${rows.length}`);

    if (rows.length === 0) {
      console.log(`[TA-serve]   ℹ Aucune ligne data`);
      continue;
    }

    // Build DB lookup for this tournament
    const dbRows = db.prepare(`
      SELECT source, source_id, winner_name, loser_name, score, tour
      FROM tennis_matches_internal
      WHERE tourney_name = ? AND substr(tourney_date, 1, 4) = ? AND source='bsd' AND w_ace IS NULL
    `).all(tourney_name, year);
    const lookup = buildDBLookup(dbRows);
    console.log(`[TA-serve]   Matchs BSD cibles dans DB: ${dbRows.length}`);

    // Parse each TA data row
    let parsed = 0, matched = 0;
    const updateStmt = db.prepare(`UPDATE tennis_matches_internal SET
      w_ace=?, w_svpt=?, w_1stIn=?, w_1stWon=?, w_2ndWon=?, w_bpSaved=?, w_bpFaced=?,
      l_ace=?, l_svpt=?, l_1stIn=?, l_1stWon=?, l_2ndWon=?, l_bpSaved=?, l_bpFaced=?
      WHERE source=? AND source_id=?`);

    for (const tr of rows) {
      const cells = extractCells(tr);
      parsed++;

      // Minimum cells needed: Rd(0) Winner(2) Loser(5) Score(6) W:A%(8) 1stIn(9) 1st%(10) 2nd%(11) BPSvd(12) L:A%(13)
      if (cells.length < 18) continue;

      const winner = cells[2];
      const loser = cells[5];
      const scoreRaw = cells[6];
      const wAcePct = parsePct(cells[8]);
      const w1stInPct = parsePct(cells[9]);
      const w1stWonPct = parsePct(cells[10]);
      const w2ndWonPct = parsePct(cells[11]);
      const wBPSvd = parseBPSvd(cells[12]);
      const lAcePct = parsePct(cells[13]);
      const l1stInPct = parsePct(cells[14]);
      const l1stWonPct = parsePct(cells[15]);
      const l2ndWonPct = parsePct(cells[16]);
      const lBPSvd = parseBPSvd(cells[17]);

      // Skip rows without serve data
      if (wAcePct === null && lAcePct === null) continue;

      // Find matching DB row
      const key = makeMatchKey(winner, loser, scoreRaw);
      const dbRow = lookup.get(key);
      if (!dbRow) continue;

      matched++;

      // Determine tour for serve point estimation
      const tour = dbRow.tour || (tourney_name.startsWith('WTA') ? 'WTA' : 'ATP');
      const svpt = estimateServePoints(scoreRaw, tour);
      const lSvpt = svpt !== null ? estimateServePoints(scoreRaw, tour) : null;

      // Convert percentages to raw counts (estimated)
      const w_svpt = svpt;
      const w_ace = wAcePct !== null && svpt !== null ? Math.round(svpt * wAcePct / 100) : null;
      const w_1stIn = w1stInPct !== null && svpt !== null ? Math.round(svpt * w1stInPct / 100) : null;
      const w_1stWon = w1stWonPct !== null && w_1stIn !== null ? Math.round(w_1stIn * w1stWonPct / 100) : null;
      const w_2ndIn = w_1stIn !== null && svpt !== null ? svpt - w_1stIn : null;
      const w_2ndWon = w2ndWonPct !== null && w_2ndIn !== null && w_2ndIn > 0 ? Math.round(w_2ndIn * w2ndWonPct / 100) : null;

      const l_svpt = lSvpt;
      const l_ace = lAcePct !== null && lSvpt !== null ? Math.round(lSvpt * lAcePct / 100) : null;
      const l_1stIn = l1stInPct !== null && lSvpt !== null ? Math.round(lSvpt * l1stInPct / 100) : null;
      const l_1stWon = l1stWonPct !== null && l_1stIn !== null ? Math.round(l_1stIn * l1stWonPct / 100) : null;
      const l_2ndIn = l_1stIn !== null && lSvpt !== null ? lSvpt - l_1stIn : null;
      const l_2ndWon = l2ndWonPct !== null && l_2ndIn !== null && l_2ndIn > 0 ? Math.round(l_2ndIn * l2ndWonPct / 100) : null;

      if (!IS_DRY) {
        updateStmt.run(
          w_ace, w_svpt, w_1stIn, w_1stWon, w_2ndWon, wBPSvd.saved, wBPSvd.faced,
          l_ace, l_svpt, l_1stIn, l_1stWon, l_2ndWon, lBPSvd.saved, lBPSvd.faced,
          dbRow.source, dbRow.source_id
        );
      }
    }

    console.log(`[TA-serve]   Parsées: ${parsed}, matchées DB: ${matched}, update: ${IS_DRY ? 'DRY' : matched}`);
    updated += matched;
    processed++;
  }

  // Unmapped tournaments report
  const allGroups = db.prepare(`
    SELECT tourney_name, COUNT(*) AS cnt
    FROM tennis_matches_internal
    WHERE w_ace IS NULL AND source='bsd' AND tourney_name IS NOT NULL
    GROUP BY tourney_name
    ORDER BY cnt DESC
  `).all();
  const unmappedNames = allGroups.filter(g => !TA_ID_MAP[g.tourney_name]);
  console.log(`\n[TA-serve] === RÉSUMÉ ===`);
  console.log(`[TA-serve] Groupes traités: ${processed}/${groups.length}`);
  console.log(`[TA-serve] Matchs mis à jour: ${updated}`);
  console.log(`[TA-serve] Erreurs: ${errors}`);
  console.log(`[TA-serve] Tournois non mappés (skipped): ${skippedUnmapped}`);
  if (unmappedNames.length > 0) {
    console.log(`\n[TA-serve] Top 20 tournois non mappés (besoin d'IDs TA):`);
    for (const g of unmappedNames.slice(0, 20)) {
      console.log(`  ${g.tourney_name}: ${g.cnt} matchs`);
    }
    if (unmappedNames.length > 20) {
      console.log(`  ... et ${unmappedNames.length - 20} autres`);
    }
  }

  const remaining = db.prepare('SELECT COUNT(*) AS c FROM tennis_matches_internal WHERE w_ace IS NULL AND source=\'bsd\'').get().c;
  console.log(`[TA-serve] Matchs encore sans stats: ${remaining}`);
  if (IS_DRY) console.log(`[TA-serve] DRY RUN — aucune modification en DB`);

  db.close();
}

main().catch(e => { console.error('[TA-serve] FATAL:', e); process.exit(1); });
