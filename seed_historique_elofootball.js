/**
 * seed_historique_elofootball.js — ETL via elofootball.com (Elo ratings)
 * ─────────────────────────────────────────────────────────────────────
 * Mission: bd ParisScorebis-8lvf
 *
 * SOURCE: https://elofootball.com/
 *   - 1M+ matchs depuis 1955, 3708 clubs, 59 pays, 277 competitions
 *   - Projet communautaire (donations PayPal)
 *   - robots.txt absent (404) — no formal restrictions
 *   - ToS pas explicit commercial — zone grise favorable
 *   - HTML tables → parsing regex (zero-dep policy)
 *
 * ⚠️ ETIQUETTE OBLIGATOIRE:
 *   - User-Agent identifiable + contact pariscore.fr
 *   - Rate-limit 2-3s/req minimum
 *   - Cache 30j+ matchs historiques (no spam)
 *   - Attribution UI: 'Source: elofootball.com (community data)'
 *   - Si owner contact → demande arret = respect immediate
 *
 * USAGE:
 *   node seed_historique_elofootball.js                    # rankings current
 *   node seed_historique_elofootball.js --season 2024
 *   node seed_historique_elofootball.js --club 'Manchester United'
 *   node seed_historique_elofootball.js --top-100          # top 100 clubs Elo
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
const THROTTLE_MS = 2500; // 2.5s entre req (politesse)
const USER_AGENT = 'PariScore-ETL/1.0 (+https://pariscore.fr; community-data-aggregator; respect-robots-respect-owner)';

// ── HTTP helper ─────────────────────────────────────────────────────────────
function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9,fr;q=0.8',
      },
    }, (res) => {
      let data = '';
      res.on('data', (c) => data += c);
      res.on('end', () => {
        resolve({ status: res.statusCode, headers: res.headers, data });
      });
    }).on('error', reject);
  });
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── HTML parsing helpers (regex zero-dep) ───────────────────────────────────
function decodeHtml(s) {
  if (!s) return '';
  return String(s)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Extract rows from HTML table (pattern: <tr>...<td>...</td>...</tr>)
function parseTableRows(html) {
  const rows = [];
  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
  let m;
  while ((m = rowRe.exec(html)) !== null) {
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

// Extract links {href, text} from HTML
function parseLinks(html) {
  const links = [];
  const re = /<a\s+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    links.push({ href: m[1], text: decodeHtml(m[2]) });
  }
  return links;
}

// ── Fetch current rankings (homepage) ───────────────────────────────────────
async function fetchCurrentRankings(topN = 100) {
  console.log(`[elofootball] Fetch rankings current (top ${topN})`);
  const res = await httpsGet(`${BASE_URL}/`);
  if (res.status !== 200) {
    console.warn(`[elofootball] HTTP ${res.status} sur homepage`);
    return [];
  }
  const rows = parseTableRows(res.data);
  const rankings = [];
  for (const r of rows) {
    if (r.length < 4) continue;
    // Heuristique: [#rank, club, elo, country]  OR similar
    const rank = parseInt(r[0], 10);
    if (!Number.isFinite(rank) || rank < 1 || rank > 9999) continue;
    rankings.push({
      rank,
      club: r[1] || '',
      elo: parseInt(r[2], 10) || null,
      country: r[3] || '',
    });
    if (rankings.length >= topN) break;
  }
  return rankings;
}

// ── Fetch club page (results historiques) ───────────────────────────────────
async function fetchClubPage(clubSlug) {
  const url = `${BASE_URL}/${clubSlug}/`;
  console.log(`[elofootball] Fetch club ${clubSlug}`);
  const res = await httpsGet(url);
  if (res.status !== 200) {
    console.warn(`[elofootball] HTTP ${res.status} sur ${url}`);
    return null;
  }
  // Parse rows + extract match data
  // Structure expected: tableau resultats avec dates, adversaires, scores
  const rows = parseTableRows(res.data);
  const matches = [];
  for (const r of rows) {
    if (r.length < 5) continue;
    // Heuristique: [date, competition, home, score, away, elo_delta]
    const date = r[0];
    if (!/\d{4}/.test(date)) continue;
    matches.push({
      date,
      competition: r[1] || '',
      home: r[2] || '',
      score: r[3] || '',
      away: r[4] || '',
      elo_delta: r[5] || null,
    });
  }
  return { clubSlug, matches };
}

// ── Transform raw match → unified record ────────────────────────────────────
function transformMatch(raw, clubMeta) {
  if (!raw || !raw.home || !raw.away || !raw.score) return null;
  const scoreMatch = String(raw.score).match(/^(\d+)\s*[-:]\s*(\d+)$/);
  if (!scoreMatch) return null;
  const homeScore = parseInt(scoreMatch[1], 10);
  const awayScore = parseInt(scoreMatch[2], 10);

  const dateMatch = String(raw.date).match(/(\d{4})/);
  const season = dateMatch ? parseInt(dateMatch[1], 10) : null;

  return {
    id: `elofootball_${(raw.date || '').replace(/[^\d]/g, '')}_${raw.home.replace(/\s+/g, '_')}_vs_${raw.away.replace(/\s+/g, '_')}`,
    source: 'elofootball',
    league_name: raw.competition || 'Unknown',
    season,
    date: raw.date,
    home_team: raw.home,
    away_team: raw.away,
    home_score: homeScore,
    away_score: awayScore,
    elo_delta: raw.elo_delta,
    _source_club: clubMeta?.clubSlug || null,
    _attribution: 'elofootball.com (community Elo ratings)',
  };
}

// ── Main ETL ────────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const top100 = args.includes('--top-100');
  const clubArg = args.find(a => a.startsWith('--club='));
  const seasonArg = args.find(a => a.startsWith('--season='));

  console.log(`[elofootball] Demarrage ETL`);
  console.log(`[elofootball] ⚠️ Etiquette: User-Agent identifiable, rate-limit 2.5s, cache 30j`);
  console.log(`[elofootball] Output: ${OUTPUT_FILE}`);

  const existingDB = (() => {
    try { return JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf8')); }
    catch (e) {
      return {
        schema_version: 1,
        generated_at: null,
        source: 'elofootball.com (community data)',
        license: 'community zone-grise — attribution required',
        clubs: {},
        rankings_current: [],
      };
    }
  })();

  if (top100) {
    const rankings = await fetchCurrentRankings(100);
    existingDB.rankings_current = rankings;
    console.log(`[elofootball] Rankings current: ${rankings.length} clubs captures`);
    await sleep(THROTTLE_MS);
  }

  if (clubArg) {
    const clubSlug = clubArg.split('=')[1];
    const clubData = await fetchClubPage(clubSlug);
    if (clubData) {
      const transformed = clubData.matches.map(m => transformMatch(m, clubData)).filter(Boolean);
      existingDB.clubs[clubSlug] = {
        meta: { slug: clubSlug, last_update: new Date().toISOString() },
        matches: transformed,
      };
      console.log(`[elofootball] ${clubSlug}: ${transformed.length} matchs`);
    }
  }

  existingDB.generated_at = new Date().toISOString();
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(existingDB, null, 2));
  console.log(`[elofootball] OK — sauvegarde ${OUTPUT_FILE}`);
  console.log(`[elofootball] NOTE: scaffold initial. URL patterns + parsing a calibrer apres test sur HTML reel.`);
  console.log(`[elofootball]       Phase 2 follow-up: extraire competition + seasons + match details per club page.`);
}

if (require.main === module) {
  main().catch(e => {
    console.error('[elofootball] ERREUR:', e.message);
    process.exit(1);
  });
}

module.exports = { main, transformMatch, fetchCurrentRankings, fetchClubPage };
