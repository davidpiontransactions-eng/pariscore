/**
 * compare-apis.js — Analyse comparative BSD vs API-Football
 * Usage: node compare-apis.js [days=7]
 *
 * Pour chaque match BSD terminé sur N derniers jours :
 * 1. Tente de retrouver le même match dans API-Football
 * 2. Compare scores si les deux trouvent
 * 3. Rapport final : couverture, concordance, écarts
 */
// Load .env manually (no dotenv dependency)
const fs   = require('fs');
const path = require('path');
const https = require('https');
try {
  const env = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
  env.split('\n').forEach(line => {
    const m = line.match(/^([A-Z_]+)=(.+)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  });
} catch { /* .env optional */ }

const BSD_CONFIG_FILE = path.join(__dirname, 'bsd_config.json');
const bsdConfig = JSON.parse(fs.readFileSync(BSD_CONFIG_FILE, 'utf8'));
const BSD_API_KEY    = bsdConfig.api_key || process.env.BSD_API_KEY || '';
const BSD_BASE_URL   = bsdConfig.base_url || 'https://sports.bzzoiro.com/api';
const API_FOOTBALL_KEY = process.env.API_FOOTBALL_KEY || '';

const DAYS = parseInt(process.argv[2]) || 7;

// ─── HTTP helper ─────────────────────────────────────────────────────────────
function httpsGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const opts = Object.assign(require('url').parse(url), { headers });
    const req = https.get(opts, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(raw) }); }
        catch { resolve({ status: res.statusCode, data: raw }); }
      });
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

// ─── Normalize team name ──────────────────────────────────────────────────────
function norm(s) {
  return (s || '').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, '').trim();
}

function teamsMatch(h1, a1, h2, a2) {
  const nh1 = norm(h1), na1 = norm(a1), nh2 = norm(h2), na2 = norm(a2);
  const w1h = nh1.split(' ')[0], w1a = na1.split(' ')[0];
  const w2h = nh2.split(' ')[0], w2a = na2.split(' ')[0];
  return (nh1.includes(w2h) || nh2.includes(w1h)) &&
         (na1.includes(w2a) || na2.includes(w1a));
}

// ─── Format date ─────────────────────────────────────────────────────────────
function dateStr(d) {
  return d.toISOString().split('T')[0];
}

// ─── Fetch BSD matches for a date ────────────────────────────────────────────
async function fetchBSD(date) {
  const url = `${BSD_BASE_URL}/events/?date_from=${date}&date_to=${date}&tz=Europe/Paris`;
  const res = await httpsGet(url, { 'Authorization': `Token ${BSD_API_KEY}` });
  if (res.status !== 200 || !res.data?.results) return [];
  return res.data.results
    .filter(e => e.home_score !== null && e.away_score !== null &&
                 e.status !== 'inprogress' && !(e.status && e.status.includes('half')))
    .map(e => ({
      home: e.home_team,
      away: e.away_team,
      league: e.league?.name || '?',
      home_score: Number(e.home_score),
      away_score: Number(e.away_score),
      date,
    }));
}

// ─── Fetch API-Football matches for a date ────────────────────────────────────
const afDateCache = new Map();
async function fetchAF(date) {
  if (afDateCache.has(date)) return afDateCache.get(date);
  const url = `https://v3.football.api-sports.io/fixtures?date=${date}&timezone=Europe/Paris&status=FT`;
  const res = await httpsGet(url, { 'x-apisports-key': API_FOOTBALL_KEY });
  const results = (res.status === 200 && res.data?.response) ? res.data.response : [];
  afDateCache.set(date, results);
  return results;
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n${'═'.repeat(64)}`);
  console.log(`  PariScore — Analyse comparative BSD vs API-Football`);
  console.log(`  Période : ${DAYS} derniers jours`);
  console.log(`${'═'.repeat(64)}\n`);

  if (!BSD_API_KEY) { console.error('❌ BSD_API_KEY manquant dans bsd_config.json'); process.exit(1); }
  if (!API_FOOTBALL_KEY) { console.error('❌ API_FOOTBALL_KEY manquant dans .env'); process.exit(1); }

  const stats = {
    bsd_total: 0,
    af_found: 0,
    af_not_found: 0,
    scores_match: 0,
    scores_differ: 0,
    differences: [],
    af_only: 0,
    leagues: {},
    bsd_dates: {},
  };

  const now = Date.now();

  for (let d = 1; d <= DAYS; d++) {
    const date = dateStr(new Date(now - d * 86400000));
    process.stdout.write(`  Jour J-${d} (${date})… `);

    let bsdMatches;
    try { bsdMatches = await fetchBSD(date); }
    catch(e) { console.log(`BSD erreur: ${e.message}`); continue; }

    let afMatches;
    try { afMatches = await fetchAF(date); }
    catch(e) { console.log(`AF erreur: ${e.message}`); afMatches = []; }

    console.log(`BSD: ${bsdMatches.length} terminés · AF: ${afMatches.length} FT`);
    stats.bsd_total += bsdMatches.length;
    stats.bsd_dates[date] = bsdMatches.length;

    for (const bm of bsdMatches) {
      // League stats
      if (!stats.leagues[bm.league]) stats.leagues[bm.league] = { bsd: 0, af: 0, match: 0, diff: 0 };
      stats.leagues[bm.league].bsd++;

      // Find in API-Football
      const afFound = afMatches.find(f =>
        teamsMatch(bm.home, bm.away, f.teams.home.name, f.teams.away.name)
      );

      if (!afFound) {
        stats.af_not_found++;
      } else {
        stats.af_found++;
        stats.leagues[bm.league].af++;
        const afScore = { home: afFound.goals?.home ?? null, away: afFound.goals?.away ?? null };
        if (afScore.home === null || afScore.away === null) {
          stats.af_not_found++;
          continue;
        }
        if (afScore.home === bm.home_score && afScore.away === bm.away_score) {
          stats.scores_match++;
          stats.leagues[bm.league].match++;
        } else {
          stats.scores_differ++;
          stats.leagues[bm.league].diff++;
          stats.differences.push({
            date,
            match: `${bm.home} vs ${bm.away}`,
            league: bm.league,
            bsd: `${bm.home_score}-${bm.away_score}`,
            af: `${afScore.home}-${afScore.away}`,
          });
        }
      }
    }

    // Also count AF-only (in AF but not in BSD sample — approximate)
    const afOnlyCount = afMatches.filter(f =>
      !bsdMatches.some(bm => teamsMatch(bm.home, bm.away, f.teams.home.name, f.teams.away.name))
    ).length;
    stats.af_only += afOnlyCount;

    await new Promise(r => setTimeout(r, 300)); // throttle
  }

  // ─── RAPPORT ─────────────────────────────────────────────────────────────
  const coverage = stats.bsd_total > 0 ? ((stats.af_found / stats.bsd_total) * 100).toFixed(1) : 0;
  const concordance = (stats.af_found > 0) ? ((stats.scores_match / stats.af_found) * 100).toFixed(1) : 0;

  console.log(`\n${'═'.repeat(64)}`);
  console.log('  RÉSULTATS — Analyse comparative BSD vs API-Football');
  console.log(`${'═'.repeat(64)}`);
  console.log(`\n  📊 COUVERTURE MATCHS`);
  console.log(`     BSD matchs terminés   : ${stats.bsd_total}`);
  console.log(`     Trouvés dans AF       : ${stats.af_found}  (${coverage}%)`);
  console.log(`     Absents de AF         : ${stats.af_not_found}  (${(100 - parseFloat(coverage)).toFixed(1)}%)`);
  console.log(`     AF-seulement (≈)      : ${stats.af_only}`);
  console.log(`\n  ✅ CONCORDANCE SCORES (matchs dans les deux)`);
  console.log(`     Scores identiques     : ${stats.scores_match}  (${concordance}%)`);
  console.log(`     Scores DIFFÉRENTS     : ${stats.scores_differ}`);

  if (stats.differences.length) {
    console.log(`\n  ⚠️  ÉCARTS DE SCORES (${stats.differences.length})`);
    stats.differences.slice(0, 10).forEach(d => {
      console.log(`     [${d.date}] ${d.match.padEnd(40)} BSD:${d.bsd}  AF:${d.af}  [${d.league}]`);
    });
    if (stats.differences.length > 10) console.log(`     … et ${stats.differences.length - 10} autres`);
  }

  // Top 10 ligues
  const topLeagues = Object.entries(stats.leagues)
    .sort((a, b) => b[1].bsd - a[1].bsd)
    .slice(0, 10);

  console.log(`\n  🏆 TOP LIGUES (par volume BSD)`);
  console.log(`     ${'Ligue'.padEnd(30)} BSD  AF   Match  Diff`);
  console.log(`     ${'-'.repeat(56)}`);
  topLeagues.forEach(([league, s]) => {
    const afCov = s.bsd > 0 ? Math.round(s.af / s.bsd * 100) : 0;
    console.log(`     ${league.substring(0,29).padEnd(30)} ${String(s.bsd).padEnd(5)}${String(s.af).padEnd(5)} ${String(s.match).padEnd(7)}${s.diff}`);
  });

  console.log(`\n  💡 CONCLUSION`);
  if (parseFloat(coverage) >= 90 && parseFloat(concordance) >= 99) {
    console.log(`     BSD et API-Football quasi-équivalents. BSD préférable (gratuit, zéro quota).`);
  } else if (parseFloat(coverage) >= 70) {
    console.log(`     BSD couvre ${coverage}% des matchs AF. Stratégie hybride recommandée.`);
  } else {
    console.log(`     BSD coverage partielle (${coverage}%). API-Football reste nécessaire pour ligues T2.`);
  }
  console.log(`     Concordance scores : ${concordance}% — fiabilité BSD pour backtesting.`);
  console.log(`\n${'═'.repeat(64)}\n`);

  // Save JSON report
  const reportPath = path.join(__dirname, '.context', 'bsd-vs-apifootball-report.json');
  fs.mkdirSync(path.join(__dirname, '.context'), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify({ generated_at: new Date().toISOString(), days: DAYS, stats }, null, 2));
  console.log(`  📁 Rapport complet → .context/bsd-vs-apifootball-report.json\n`);
}

main().catch(e => { console.error('Erreur:', e); process.exit(1); });
