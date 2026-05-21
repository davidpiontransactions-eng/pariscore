/**
 * seed_historique_elofootball.js — ETL via elofootball.com (Elo ratings)
 * ─────────────────────────────────────────────────────────────────────
 * Mission: bd ParisScorebis-8lvf (Phase 2 — calibrated parser)
 *
 * SOURCE: https://elofootball.com/
 *   - 1M+ matchs depuis 1955, 3708 clubs, 59 pays, 277 competitions
 *   - Projet communautaire (donations PayPal)
 *   - robots.txt absent (404) — no formal restrictions
 *   - Zone grise favorable (community data + attribution required)
 *
 * ⚠️ ETIQUETTE OBLIGATOIRE:
 *   - User-Agent identifiable + contact pariscore.fr
 *   - Rate-limit 2.5s/req minimum (politesse)
 *   - Cache 30j+ matchs historiques (no spam)
 *   - Attribution UI: 'Source: elofootball.com (community data)'
 *   - Si owner contact → demande arret = respect immediate
 *
 * ⚠️ QUIRK SERVEUR: NE PAS envoyer Accept: text/html
 *   → server renvoie landing 7KB teaser au lieu de la page complete.
 *   Sans Accept header → /index.php renvoie 2.9MB avec tables data.
 *
 * USAGE:
 *   node seed_historique_elofootball.js --top50              # Top 50 clubs Elo
 *   node seed_historique_elofootball.js --recent-matches     # 1900+ matchs recents
 *   node seed_historique_elofootball.js --clubid=246 --season=2025-2026
 *   node seed_historique_elofootball.js --probe              # dump structure tables
 *
 * OUTPUT: historique_elofootball.json
 *   compatible loadHistory v12.26+ pattern
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// ── Config ──────────────────────────────────────────────────────────────────
const OUTPUT_FILE = path.join(__dirname, 'historique_elofootball.json');
const BASE_URL = 'https://elofootball.com';
const THROTTLE_MS = 2500;
const USER_AGENT = 'PariScore-ETL/1.0 (+https://pariscore.fr; community-data-aggregator; respect-robots-respect-owner)';

// ── HTTP helper (NO Accept header — quirk serveur elofootball.com) ──────────
function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept-Language': 'en-US,en;q=0.9,fr;q=0.8',
      },
    }, (res) => {
      let data = '';
      res.on('data', (c) => data += c);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, data }));
    }).on('error', reject);
  });
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── HTML parsing helpers (regex zero-dep) ───────────────────────────────────
function decodeHtml(s) {
  if (!s) return '';
  return String(s)
    .replace(/<img[^>]*>/g, '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#8595;/g, '↓')
    .replace(/&#8594;/g, '→')
    .replace(/&#8721;/g, 'Σ')
    .replace(/&#8960;/g, '⌀')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseTableRows(tableHtml) {
  const rows = [];
  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
  let m;
  while ((m = rowRe.exec(tableHtml)) !== null) {
    const cellRe = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g;
    const cells = [];
    let c;
    while ((c = cellRe.exec(m[1])) !== null) {
      cells.push(decodeHtml(c[1]));
    }
    if (cells.length) rows.push(cells);
  }
  return rows;
}

function parseAllTables(html) {
  const out = [];
  const re = /<table[^>]*>[\s\S]*?<\/table>/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const cls = (m[0].match(/<table[^>]+class="([^"]+)"/) || [, ''])[1];
    out.push({ cls, html: m[0], rows: parseTableRows(m[0]) });
  }
  return out;
}

// Heuristics: find table by header signature
function findTableByHeader(tables, headerSignatures) {
  for (const t of tables) {
    if (!t.rows.length) continue;
    const header = t.rows[0].join('|').toLowerCase();
    if (headerSignatures.every(sig => header.includes(sig.toLowerCase()))) {
      return t;
    }
  }
  return null;
}

// Extract clubid from <a href="/club.php?clubid=246...">
function extractClubId(rawHtml) {
  const m = String(rawHtml).match(/clubid=(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

// ── Fetch homepage (/index.php) — contains Top 50 + recent matches ─────────
async function fetchIndex() {
  const res = await httpsGet(`${BASE_URL}/index.php`);
  if (res.status !== 200) throw new Error(`HTTP ${res.status} /index.php`);
  return res.data;
}

// ── Top 50 Elo rankings (from /index.php T5) ────────────────────────────────
async function fetchCurrentRankings(topN = 50) {
  console.log(`[elofootball] Fetch Top ${topN} Elo rankings`);
  const html = await fetchIndex();
  const tables = parseAllTables(html);
  // Top 50 table header: # | Club | Form (last 6) | ... | Rating | ...
  const top = findTableByHeader(tables, ['#', 'club', 'rating']);
  if (!top) {
    console.warn('[elofootball] Top 50 table introuvable — site structure changed?');
    return [];
  }
  // Locate column indexes from header
  const header = top.rows[0];
  const idxRank = header.findIndex(h => h.trim() === '#');
  const idxClub = header.findIndex(h => h.toLowerCase().startsWith('club'));
  const idxRating = header.findIndex(h => /^rating/i.test(h));
  if (idxRank < 0 || idxClub < 0 || idxRating < 0) {
    console.warn('[elofootball] Header layout inattendu', header);
    return [];
  }

  const rankings = [];
  // Re-parse rows preserving raw HTML for clubid extraction
  const trMatches = top.html.match(/<tr[^>]*>([\s\S]*?)<\/tr>/g) || [];
  for (let i = 1; i < trMatches.length && rankings.length < topN; i++) {
    const cells = top.rows[i];
    if (!cells || cells.length <= idxRating) continue;
    const rank = parseInt(cells[idxRank], 10);
    if (!Number.isFinite(rank)) continue;
    const cellRaw = trMatches[i];
    const clubId = extractClubId(cellRaw);
    const countryMatch = cellRaw.match(/title\s*=\s*"([^"]+)"/);
    rankings.push({
      rank,
      club: cells[idxClub].replace(/\s+/g, ' ').trim(),
      clubid: clubId,
      rating: parseInt(cells[idxRating], 10) || null,
      country: countryMatch ? countryMatch[1] : null,
    });
  }
  return rankings;
}

// ── Recent matches (from /index.php T7 — ~1900 historic results w/ probas) ──
async function fetchRecentMatches() {
  console.log(`[elofootball] Fetch recent matches (1900+ historic)`);
  const html = await fetchIndex();
  const tables = parseAllTables(html);
  // Recent matches table header: Date | Competition | ... | Home | ... | Result | Probabilities...
  const tbl = findTableByHeader(tables, ['date', 'competition', 'result', 'probabilities']);
  if (!tbl) {
    console.warn('[elofootball] Recent matches table introuvable');
    return [];
  }
  // We need the LARGEST such table (T7 has 1903 rows, T6 has 32 today-only)
  const candidates = tables.filter(t => {
    const h = (t.rows[0] || []).join('|').toLowerCase();
    return h.includes('date') && h.includes('result') && h.includes('probabilities');
  });
  const target = candidates.sort((a, b) => b.rows.length - a.rows.length)[0];
  if (!target || target.rows.length < 50) {
    console.warn('[elofootball] Recent matches table trop petite');
    return [];
  }
  const header = target.rows[0];
  const idxDate = header.findIndex(h => /^date/i.test(h));
  const idxComp = header.findIndex(h => /^competition/i.test(h));
  const idxResult = header.findIndex(h => /^result/i.test(h));
  // Probabilities W/D/L are 3 consecutive cols starting at "Probabilities:↵W" header
  const idxProbW = header.findIndex(h => /^probabilit/i.test(h));
  // Home/Away club cells: search header for "Home" + "Away"
  const idxHome = header.findIndex(h => h.trim().toLowerCase() === 'home');
  const idxAway = header.findIndex(h => h.trim().toLowerCase() === 'away');

  const matches = [];
  const trRe = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
  let i = 0; let m;
  while ((m = trRe.exec(target.html)) !== null) {
    if (i++ === 0) continue; // skip header
    const row = parseTableRows(`<table>${m[0]}</table>`)[0];
    if (!row || row.length < 8) continue;
    const date = row[idxDate];
    if (!/\d{4}\/\d{2}\/\d{2}/.test(date)) continue;
    // Result format: "2:1" or "2 - 1"
    const result = row[idxResult] || '';
    const scoreMatch = result.match(/(\d+)\s*[:\-]\s*(\d+)/);
    matches.push({
      date,
      competition: row[idxComp],
      home_team: idxHome >= 0 ? row[idxHome] : null,
      away_team: idxAway >= 0 ? row[idxAway] : null,
      result_raw: result,
      home_score: scoreMatch ? parseInt(scoreMatch[1], 10) : null,
      away_score: scoreMatch ? parseInt(scoreMatch[2], 10) : null,
      prob_w: parseFloat((row[idxProbW] || '').replace(',', '.')) || null,
      prob_d: parseFloat((row[idxProbW + 1] || '').replace(',', '.')) || null,
      prob_l: parseFloat((row[idxProbW + 2] || '').replace(',', '.')) || null,
    });
  }
  return matches;
}

// ── Fetch club page (full season matches with probabilities) ────────────────
async function fetchClubPage(clubid, season) {
  if (!clubid) throw new Error('clubid requis');
  const seasonSeg = season ? `&season=${season}` : '';
  const url = `${BASE_URL}/club.php?clubid=${clubid}${seasonSeg}`;
  console.log(`[elofootball] Fetch club ${clubid} season ${season || 'current'}`);
  const res = await httpsGet(url);
  if (res.status !== 200) {
    console.warn(`[elofootball] HTTP ${res.status} sur ${url}`);
    return null;
  }
  const tables = parseAllTables(res.data);
  // Matches table = "Season | Date | Competition | Venue | Opponent | Probabilities W/D/L | Result"
  const tbl = findTableByHeader(tables, ['season', 'date', 'opponent', 'result']);
  if (!tbl) {
    console.warn(`[elofootball] Matches table introuvable pour clubid ${clubid}`);
    return { clubid, season, matches: [] };
  }
  const header = tbl.rows[0];
  const idxSeason = header.findIndex(h => /^season$/i.test(h));
  const idxDate = header.findIndex(h => /^date$/i.test(h));
  const idxComp = header.findIndex(h => /^competition/i.test(h));
  const idxVenue = header.findIndex(h => /^venue$/i.test(h));
  const idxOpp = header.findIndex(h => /^opponent/i.test(h));
  const idxResult = header.findIndex(h => /^result/i.test(h));
  const idxProbW = header.findIndex(h => /^probabilit/i.test(h));

  const matches = [];
  for (let i = 1; i < tbl.rows.length; i++) {
    const r = tbl.rows[i];
    if (!r || r.length < 8) continue;
    const date = r[idxDate];
    if (!/\d{4}\/\d{2}\/\d{2}/.test(date)) continue;
    const result = r[idxResult] || '';
    const scoreMatch = result.match(/(\d+)\s*[:\-]\s*(\d+)/);
    matches.push({
      season: r[idxSeason],
      date,
      competition: r[idxComp],
      venue: r[idxVenue], // 'H' or 'A'
      opponent: r[idxOpp],
      result_raw: result,
      home_score: scoreMatch ? parseInt(scoreMatch[1], 10) : null,
      away_score: scoreMatch ? parseInt(scoreMatch[2], 10) : null,
      prob_w: parseFloat((r[idxProbW] || '').replace(',', '.')) || null,
      prob_d: parseFloat((r[idxProbW + 1] || '').replace(',', '.')) || null,
      prob_l: parseFloat((r[idxProbW + 2] || '').replace(',', '.')) || null,
    });
  }
  return { clubid, season, matches };
}

// Split "Burnley FC1858" → { name: "Burnley FC", rating: 1858 }
// Opponent cells on club pages have club name concatenated with Elo rating.
function splitTeamRating(text) {
  if (!text) return { name: '', rating: null };
  const m = String(text).trim().match(/^(.*?)(\d{3,4})\s*$/);
  if (m) return { name: m[1].trim(), rating: parseInt(m[2], 10) };
  return { name: String(text).trim(), rating: null };
}

// ── Transform match → unified record (for archive_matches merge) ────────────
function transformMatch(raw, ctx) {
  if (!raw || !raw.date || raw.home_score == null || raw.away_score == null) return null;

  // Opponent cell on club pages = "Name + Rating" concatenated
  let oppName = raw.opponent, oppRating = null;
  if (raw.opponent) {
    const s = splitTeamRating(raw.opponent);
    oppName = s.name; oppRating = s.rating;
  }

  const selfName = ctx?.clubName || (ctx?.clubid ? `clubid_${ctx.clubid}` : null);
  const homeTeam = raw.home_team
    || (raw.venue === 'H' ? selfName : oppName)
    || null;
  const awayTeam = raw.away_team
    || (raw.venue === 'A' ? selfName : oppName)
    || null;
  if (!homeTeam || !awayTeam) return null;

  const dateKey = String(raw.date).replace(/[^\d]/g, '');
  const slugify = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  return {
    id: `elofootball_${dateKey}_${slugify(homeTeam)}_vs_${slugify(awayTeam)}`,
    source: 'elofootball',
    league_name: raw.competition || 'Unknown',
    season: raw.season || null,
    date: raw.date,
    home_team: homeTeam,
    away_team: awayTeam,
    home_score: raw.home_score,
    away_score: raw.away_score,
    prob_home: raw.prob_w,
    prob_draw: raw.prob_d,
    prob_away: raw.prob_l,
    opponent_rating: oppRating,
    _attribution: 'elofootball.com (community Elo ratings)',
  };
}

// ── Probe mode (debug structure tables) ─────────────────────────────────────
async function probe() {
  console.log('[elofootball] PROBE mode — dump table structure /index.php');
  const html = await fetchIndex();
  const tables = parseAllTables(html);
  console.log(`[elofootball] ${tables.length} tables trouvees`);
  tables.forEach((t, i) => {
    console.log(`  T${i} cls="${t.cls}" rows=${t.rows.length} header=${(t.rows[0] || []).join(' | ').slice(0, 120)}`);
  });
}

// ── Main ETL ────────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const arg = (k) => {
    const eq = args.find(a => a.startsWith(`--${k}=`));
    if (eq) return eq.split('=')[1];
    const idx = args.indexOf(`--${k}`);
    if (idx >= 0 && args[idx + 1] && !args[idx + 1].startsWith('--')) return args[idx + 1];
    return null;
  };
  const has = (k) => args.includes(`--${k}`) || args.some(a => a.startsWith(`--${k}=`));

  console.log(`[elofootball] Demarrage ETL`);
  console.log(`[elofootball] ⚠️ Etiquette: User-Agent identifiable, rate-limit ${THROTTLE_MS}ms, attribution required`);
  console.log(`[elofootball] Output: ${OUTPUT_FILE}`);

  if (has('probe')) { await probe(); return; }

  const existingDB = (() => {
    try { return JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf8')); }
    catch (e) {
      return {
        schema_version: 2,
        generated_at: null,
        source: 'elofootball.com (community data)',
        license: 'community zone-grise — attribution required',
        rankings_current: [],
        recent_matches: [],
        clubs: {},
      };
    }
  })();

  let didWork = false;

  if (has('top50') || has('top-50')) {
    existingDB.rankings_current = await fetchCurrentRankings(50);
    console.log(`[elofootball] Rankings: ${existingDB.rankings_current.length} clubs`);
    didWork = true;
    await sleep(THROTTLE_MS);
  }

  if (has('top100') || has('top-100')) {
    // /index.php only has 50; for now duplicate the call
    existingDB.rankings_current = await fetchCurrentRankings(100);
    console.log(`[elofootball] Rankings (capped 50 sur /index.php): ${existingDB.rankings_current.length}`);
    didWork = true;
    await sleep(THROTTLE_MS);
  }

  if (has('recent-matches')) {
    const raw = await fetchRecentMatches();
    existingDB.recent_matches = raw
      .map(m => transformMatch(m))
      .filter(Boolean);
    console.log(`[elofootball] Recent matches: ${existingDB.recent_matches.length} ingested (raw=${raw.length})`);
    didWork = true;
    await sleep(THROTTLE_MS);
  }

  const clubid = arg('clubid');
  const season = arg('season');
  const clubnameOverride = arg('clubname');
  if (clubid) {
    // Lookup club name from rankings_current cache if available
    const fromRankings = (existingDB.rankings_current || []).find(r => String(r.clubid) === String(clubid));
    const clubName = clubnameOverride || fromRankings?.club || `clubid_${clubid}`;
    const data = await fetchClubPage(clubid, season);
    if (data) {
      const transformed = data.matches.map(m => transformMatch(m, { clubName, clubid })).filter(Boolean);
      const key = `clubid_${clubid}_${season || 'current'}`;
      existingDB.clubs[key] = {
        meta: { clubid, clubName, season, last_update: new Date().toISOString() },
        matches: transformed,
      };
      console.log(`[elofootball] Club ${clubid} (${clubName}): ${transformed.length} matchs ingested`);
      didWork = true;
    }
  }

  if (!didWork) {
    console.log('[elofootball] Aucune option passee. Usage:');
    console.log('  --top50 | --recent-matches | --clubid=N [--season=YYYY-YYYY] | --probe');
    return;
  }

  existingDB.generated_at = new Date().toISOString();
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(existingDB, null, 2));
  console.log(`[elofootball] OK — sauvegarde ${OUTPUT_FILE} (${(fs.statSync(OUTPUT_FILE).size / 1024).toFixed(1)} KB)`);
}

if (require.main === module) {
  main().catch(e => {
    console.error('[elofootball] ERREUR:', e.message);
    process.exit(1);
  });
}

module.exports = {
  main,
  fetchIndex,
  fetchCurrentRankings,
  fetchRecentMatches,
  fetchClubPage,
  transformMatch,
  parseAllTables,
  parseTableRows,
};
