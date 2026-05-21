/**
 * seed_historique_bsd_tennis.js — ETL via BSD Tennis (Bzzoiro Sports Addon)
 * ─────────────────────────────────────────────────────────────────────────
 * Mission: bd ParisScorebis-rxh Phase 2 (BSD tennis historical events 2024-2026)
 *
 * SOURCE: https://sports.bzzoiro.com/tennis/api/v2/predictions/
 *   - Sub Bzzoiro Sports Addon ($5/mo, exp 2026-06-16)
 *   - Auth: Header `Authorization: Token <BSD_API_KEY>`
 *   - 14968 settled predictions total (snapshot 2026-05-21)
 *   - Couvre ATP, WTA, UTR, ITF, challengers — surfaces hard/clay/grass/carpet
 *
 * DATA RICHESSE par prediction:
 *   - prob_player1_wins, prob_player2_wins (BSD ML model)
 *   - confidence (50-100), predicted_winner (1|2)
 *   - actual_winner, was_winner_correct (BACKTEST GOLD)
 *   - prob_over_2_5_sets, prob_over_20_5_games etc (souvent null sur predictions anciennes)
 *   - prob_player1_wins_first_set
 *   - match: tournament {circuit, category, surface}, player1/2 {country, ranking, gender}
 *     match_date, status, sets_detail [{p1, p2}]
 *
 * USAGE:
 *   node seed_historique_bsd_tennis.js                       # full settled (14k entries)
 *   node seed_historique_bsd_tennis.js --date-from=2024-01-01 --date-to=2026-05-21
 *   node seed_historique_bsd_tennis.js --limit-pages=10      # cap pour test
 *   node seed_historique_bsd_tennis.js --circuit=ATP         # filter post-fetch
 *
 * OUTPUT: historique_bsd_tennis.json
 *   schema_version 1, source 'bsd-tennis', count, predictions: [...]
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// ── Config ──────────────────────────────────────────────────────────────────
const OUTPUT_FILE = path.join(__dirname, 'historique_bsd_tennis.json');
const BSD_TENNIS_BASE = 'https://sports.bzzoiro.com/tennis';
const PAGE_SIZE = 200;
const THROTTLE_MS = 250;

// ── .env loader (zero-dep) ──────────────────────────────────────────────────
function loadEnv() {
  try {
    const envPath = path.join(__dirname, '.env');
    if (!fs.existsSync(envPath)) return;
    fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
    });
  } catch (e) { console.warn('[bsd-tennis] .env load skipped:', e.message); }
}
loadEnv();

const BSD_API_KEY = process.env.BSD_API_KEY || '';
if (!BSD_API_KEY) {
  console.error('[bsd-tennis] ❌ BSD_API_KEY manquante (.env)');
  process.exit(1);
}

// ── HTTP helper ─────────────────────────────────────────────────────────────
function httpsGetJson(fullUrl) {
  return new Promise((resolve, reject) => {
    https.get(fullUrl, {
      headers: {
        'Authorization': `Token ${BSD_API_KEY}`,
        'Accept': 'application/json',
        'User-Agent': 'PariScore-ETL/1.0',
      },
    }, (res) => {
      let data = '';
      res.on('data', (c) => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch (e) { resolve({ status: res.statusCode, data: null, raw: data }); }
      });
    }).on('error', reject);
  });
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── CLI parse ───────────────────────────────────────────────────────────────
function parseArgs() {
  const args = process.argv.slice(2);
  const arg = (k) => {
    const eq = args.find(a => a.startsWith(`--${k}=`));
    if (eq) return eq.split('=').slice(1).join('=');
    const idx = args.indexOf(`--${k}`);
    if (idx >= 0 && args[idx + 1] && !args[idx + 1].startsWith('--')) return args[idx + 1];
    return null;
  };
  return {
    dateFrom: arg('date-from'),
    dateTo: arg('date-to'),
    limitPages: parseInt(arg('limit-pages'), 10) || null,
    circuit: arg('circuit'), // ATP / WTA / UTR / ITF (post-fetch filter)
  };
}

// ── Fetch all settled paginated ─────────────────────────────────────────────
// Note: BSD `date_from`/`date_to` filtre sur upcoming (prediction date),
// pas match_date. Pour settled historique, on pagine TOUT puis filtre
// post-fetch sur match.match_date.
async function fetchAllSettled({ limitPages }) {
  const params = new URLSearchParams({
    upcoming: 'false',
    limit: String(PAGE_SIZE),
  });

  let url = `${BSD_TENNIS_BASE}/api/v2/predictions/?${params.toString()}`;
  const all = [];
  let page = 0;
  let firstCount = null;

  while (url) {
    if (limitPages != null && page >= limitPages) {
      console.log(`[bsd-tennis] STOP — limit-pages=${limitPages} atteint`);
      break;
    }
    page++;
    let res;
    try { res = await httpsGetJson(url); }
    catch (e) { console.warn(`[bsd-tennis] page ${page} fetch error: ${e.message}`); break; }
    if (!res || res.status !== 200 || !res.data) {
      console.warn(`[bsd-tennis] page ${page} HTTP ${res?.status} stop`);
      break;
    }
    const results = Array.isArray(res.data.results) ? res.data.results : [];
    if (firstCount === null) firstCount = res.data.count || 0;
    all.push(...results);
    if (page === 1 || page % 10 === 0) {
      console.log(`[bsd-tennis] page ${page} +${results.length} (total ${all.length}/${firstCount})`);
    }
    url = res.data.next || null;
    if (url) await sleep(THROTTLE_MS);
  }
  return { total: firstCount, items: all };
}

// ── Transform → minimal portable record ─────────────────────────────────────
function transformPrediction(p) {
  if (!p || !p.match) return null;
  const m = p.match;
  return {
    id: `bsd_tennis_pred_${p.id}`,
    bsd_prediction_id: p.id,
    bsd_match_id: m.id,
    api_id: m.api_id || null,
    source: 'bsd-tennis',
    sport: 'tennis',
    date: m.match_date,
    status: m.status,
    tournament: m.tournament?.name || null,
    tournament_id: m.tournament?.id || null,
    circuit: m.tournament?.circuit || null,    // ATP / WTA / UTR / ITF
    category: m.tournament?.category || null,  // grand_slam / atp1000 / utr / etc
    surface: m.tournament?.surface || null,
    round: m.round_name || null,
    player1: {
      id: m.player1?.id || null,
      name: m.player1?.name || null,
      short: m.player1?.short_name || null,
      country_code: m.player1?.country_code || null,
      country: m.player1?.country_name || null,
      gender: m.player1?.gender || null,
      ranking: m.player1?.current_ranking || null,
    },
    player2: {
      id: m.player2?.id || null,
      name: m.player2?.name || null,
      short: m.player2?.short_name || null,
      country_code: m.player2?.country_code || null,
      country: m.player2?.country_name || null,
      gender: m.player2?.gender || null,
      ranking: m.player2?.current_ranking || null,
    },
    sets_detail: Array.isArray(m.sets_detail) ? m.sets_detail : [],
    sets_won_p1: m.player1_sets,
    sets_won_p2: m.player2_sets,
    // BSD ML predictions
    prediction: {
      prob_p1_wins: p.prob_player1_wins,
      prob_p2_wins: p.prob_player2_wins,
      predicted_winner: p.predicted_winner,
      confidence: p.confidence,
      prob_over_2_5_sets: p.prob_over_2_5_sets,
      prob_over_20_5_games: p.prob_over_20_5_games,
      prob_over_21_5_games: p.prob_over_21_5_games,
      prob_over_22_5_games: p.prob_over_22_5_games,
      prob_p1_first_set: p.prob_player1_wins_first_set,
      expected_total_sets: p.expected_total_sets,
      expected_total_games: p.expected_total_games,
    },
    // Backtest fields
    actual_winner: p.actual_winner,
    was_winner_correct: p.was_winner_correct,
    _attribution: 'BSD Tennis (Bzzoiro Sports Addon)',
  };
}

// ── Merge dedup by id ───────────────────────────────────────────────────────
function mergeDedupById(existing, incoming) {
  const ids = new Set(existing.map(x => x.id));
  for (const x of incoming) {
    if (!ids.has(x.id)) { existing.push(x); ids.add(x.id); }
  }
  return existing;
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  const opts = parseArgs();
  console.log(`[bsd-tennis] Démarrage ETL ${opts.dateFrom ? `from ${opts.dateFrom}` : '(all settled)'}${opts.dateTo ? ` to ${opts.dateTo}` : ''}`);
  console.log(`[bsd-tennis] Output: ${OUTPUT_FILE}`);

  const existing = (() => {
    try { return JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf8')); }
    catch (e) {
      return {
        schema_version: 1,
        generated_at: null,
        source: 'bsd-tennis',
        attribution: 'Bzzoiro Sports Addon ($5/mo)',
        count: 0,
        predictions: [],
      };
    }
  })();

  const t0 = Date.now();
  const { total, items } = await fetchAllSettled(opts);
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

  let transformed = items.map(transformPrediction).filter(Boolean);

  // Post-fetch date filter (BSD endpoint ignore date_from/date_to sur upcoming=false)
  if (opts.dateFrom || opts.dateTo) {
    const fromTs = opts.dateFrom ? Date.parse(opts.dateFrom) : -Infinity;
    const toTs = opts.dateTo ? Date.parse(opts.dateTo) + 24 * 3600 * 1000 : Infinity;
    const before = transformed.length;
    transformed = transformed.filter(t => {
      if (!t.date) return false;
      const ts = Date.parse(t.date);
      return ts >= fromTs && ts <= toTs;
    });
    console.log(`[bsd-tennis] Filter date ${opts.dateFrom || '-∞'} → ${opts.dateTo || '+∞'}: ${transformed.length}/${before}`);
  }

  if (opts.circuit) {
    const before = transformed.length;
    transformed = transformed.filter(t => String(t.circuit || '').toUpperCase() === opts.circuit.toUpperCase());
    console.log(`[bsd-tennis] Filter circuit=${opts.circuit}: ${transformed.length}/${before}`);
  }

  existing.predictions = mergeDedupById(existing.predictions, transformed);
  existing.count = existing.predictions.length;
  existing.generated_at = new Date().toISOString();

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(existing, null, 2));
  const sizeMB = (fs.statSync(OUTPUT_FILE).size / 1024 / 1024).toFixed(2);
  console.log(`[bsd-tennis] OK — ${transformed.length} predictions ingested (total DB ${existing.count}, server count ${total}) — ${elapsed}s — file ${sizeMB} MB`);

  // Calibration summary
  const settled = existing.predictions.filter(p => p.was_winner_correct != null);
  const correct = settled.filter(p => p.was_winner_correct === true).length;
  const accuracy = settled.length ? (100 * correct / settled.length).toFixed(1) : 'N/A';
  console.log(`[bsd-tennis] BSD model accuracy: ${correct}/${settled.length} = ${accuracy}%`);

  // Breakdown by circuit
  const byCircuit = {};
  existing.predictions.forEach(p => {
    const k = p.circuit || 'unknown';
    byCircuit[k] = (byCircuit[k] || 0) + 1;
  });
  console.log(`[bsd-tennis] By circuit:`, byCircuit);
}

if (require.main === module) {
  main().catch(e => { console.error('[bsd-tennis] ERREUR:', e.message); process.exit(1); });
}

module.exports = { main, fetchAllSettled, transformPrediction };
