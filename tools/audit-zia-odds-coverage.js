#!/usr/bin/env node
'use strict';
// ─── tools/audit-zia-odds-coverage.js — bd zia coverage benchmark ───────────
//
// Compare la couverture des cotes 1X2 entre :
//   - The Odds API  (clé ODDS_API_KEY, /v4/sports/{sport}/odds)
//   - API-Football  (clé API_FOOTBALL_KEY, /odds?date= + /fixtures?date=)
//
// Pour les top ligues européennes, mesure sur la fenêtre J+0 → J+2 (limite
// plan Free API-Football) :
//   - # matchs couverts par chaque source
//   - Intersection (matchs présents dans les deux)
//   - Nombre moyen de bookmakers par match
//   - Écart médian sur les cotes 1X2 (best vs best)
//
// Sortie : .context/audits/audit-zia-odds-coverage-apifootball-vs-oddsapi.md
//
// Usage :
//   node tools/audit-zia-odds-coverage.js
//   node tools/audit-zia-odds-coverage.js --leagues=39,61,140,135,78

const fs = require('fs');
const path = require('path');
const https = require('https');

function loadEnv() {
  // Cherche .env dans le repo (parent + 3 niveaux pour worktrees)
  const candidates = [
    path.join(__dirname, '..', '.env'),
    path.join(__dirname, '..', '..', '..', '..', '.env'),  // worktree
  ];
  for (const file of candidates) {
    if (!fs.existsSync(file)) continue;
    const raw = fs.readFileSync(file, 'utf-8');
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
    }
    break;
  }
}
loadEnv();

const ODDS_API_KEY = process.env.ODDS_API_KEY || '';
const API_FOOTBALL_KEY = process.env.API_FOOTBALL_KEY || '';

const argv = process.argv.slice(2);
const dryRun = argv.includes('--dry-run');
const leaguesArg = (argv.find(a => a.startsWith('--leagues=')) || '').slice('--leagues='.length);
// Default top 5 EU leagues — using API-Football league_id (= leagues_config.json id)
//   39 EPL · 61 Ligue 1 · 140 La Liga · 135 Serie A · 78 Bundesliga
const LEAGUES = (leaguesArg ? leaguesArg.split(',').map(Number) : [39, 61, 140, 135, 78])
  .filter(n => Number.isFinite(n) && n > 0);

const SPORT_KEY_BY_AF_ID = {
  39:  'soccer_epl',
  61:  'soccer_france_ligue_one',
  140: 'soccer_spain_la_liga',
  135: 'soccer_italy_serie_a',
  78:  'soccer_germany_bundesliga',
};

const LEAGUE_LABEL_BY_AF_ID = {
  39: 'Premier League', 61: 'Ligue 1', 140: 'La Liga', 135: 'Serie A', 78: 'Bundesliga',
};

function httpGet(host, pathname, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      host, path: pathname, method: 'GET', timeout: 15000,
      headers: { Accept: 'application/json', ...headers },
    }, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, raw: body });
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.end();
  });
}

function normName(s) {
  return String(s || '').toLowerCase().normalize('NFD')
    .replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
}

function median(arr) {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── Fetch The Odds API ──────────────────────────────────────────────────────

async function fetchOddsApiForSport(sportKey) {
  if (!ODDS_API_KEY) return { matches: [], note: 'ODDS_API_KEY absente' };
  const qs = `?apiKey=${ODDS_API_KEY}&regions=eu&markets=h2h&oddsFormat=decimal`;
  const r = await httpGet('api.the-odds-api.com', `/v4/sports/${sportKey}/odds/${qs}`);
  if (r.status !== 200 || !Array.isArray(r.data)) {
    return { matches: [], note: `HTTP ${r.status}` };
  }
  return {
    matches: r.data.map(m => {
      let bestH = 0, bestA = 0, bestN = 0;
      const bookSet = new Set();
      for (const bk of m.bookmakers || []) {
        const h2h = (bk.markets || []).find(x => x.key === 'h2h');
        if (!h2h) continue;
        bookSet.add(bk.title || bk.key);
        for (const o of h2h.outcomes || []) {
          if (o.name === m.home_team && Number(o.price) > bestH) bestH = Number(o.price);
          else if (o.name === m.away_team && Number(o.price) > bestA) bestA = Number(o.price);
          else if (o.name === 'Draw' && Number(o.price) > bestN) bestN = Number(o.price);
        }
      }
      return {
        home: m.home_team, away: m.away_team, commence: m.commence_time,
        best: { home: bestH, draw: bestN, away: bestA },
        books_count: bookSet.size,
      };
    }),
    quota_remaining: r.headers && r.headers['x-requests-remaining'] || null,
  };
}

// ─── Fetch API-Football ──────────────────────────────────────────────────────

async function fetchAFOddsForDateLeague(dateStr, leagueId) {
  if (!API_FOOTBALL_KEY) return { matches: [], note: 'API_FOOTBALL_KEY absente' };

  // /fixtures?date= → fxId → {home, away}, filter par league
  const fxRes = await httpGet('v3.football.api-sports.io', `/fixtures?date=${dateStr}`,
    { 'x-apisports-key': API_FOOTBALL_KEY });
  if (fxRes.status !== 200 || !fxRes.data || !Array.isArray(fxRes.data.response)) {
    return { matches: [], note: `fixtures HTTP ${fxRes.status} ${(fxRes.data && fxRes.data.errors) ? JSON.stringify(fxRes.data.errors) : ''}` };
  }
  const fxMap = new Map();
  for (const entry of fxRes.data.response) {
    const fxId = entry.fixture && entry.fixture.id;
    const lgId = entry.league && entry.league.id;
    if (fxId && entry.teams && entry.teams.home && entry.teams.away && lgId === leagueId) {
      fxMap.set(Number(fxId), { home: entry.teams.home.name, away: entry.teams.away.name, date: entry.fixture.date });
    }
  }
  if (fxMap.size === 0) return { matches: [], note: 'no fixtures in league' };

  // /odds?date= paginé → enrich avec teams
  const matches = [];
  let page = 1, totalPages = 1;
  do {
    const r = await httpGet('v3.football.api-sports.io', `/odds?date=${dateStr}&page=${page}`,
      { 'x-apisports-key': API_FOOTBALL_KEY });
    if (r.status !== 200 || !r.data || !Array.isArray(r.data.response)) {
      return { matches, note: `odds HTTP ${r.status} ${(r.data && r.data.errors) ? JSON.stringify(r.data.errors) : ''}` };
    }
    totalPages = (r.data.paging && Number(r.data.paging.total)) || 1;
    for (const entry of r.data.response) {
      const fxId = entry.fixture && Number(entry.fixture.id);
      const fxInfo = fxMap.get(fxId);
      if (!fxInfo) continue;
      let bestH = 0, bestA = 0, bestN = 0;
      const bookSet = new Set();
      for (const bk of entry.bookmakers || []) {
        const mw = (bk.bets || []).find(b => Number(b.id) === 1);
        if (!mw) continue;
        bookSet.add(bk.name);
        for (const v of mw.values || []) {
          const price = Number(v.odd);
          if (!Number.isFinite(price) || price <= 1) continue;
          const lbl = String(v.value || '').toLowerCase();
          if (lbl === 'home' && price > bestH) bestH = price;
          else if (lbl === 'away' && price > bestA) bestA = price;
          else if (lbl === 'draw' && price > bestN) bestN = price;
        }
      }
      matches.push({
        home: fxInfo.home, away: fxInfo.away, commence: fxInfo.date,
        best: { home: bestH, draw: bestN, away: bestA },
        books_count: bookSet.size,
      });
    }
    page++;
    await sleep(2500);
  } while (page <= totalPages && page <= 30);

  return { matches };
}

async function fetchAFOddsForLeague(leagueId) {
  // J+0 → J+2 fenêtre (plan Free)
  const out = [];
  let lastNote = null;
  const now = new Date();
  for (let d = 0; d < 3; d++) {
    const dt = new Date(now.getTime() + d * 24 * 3600 * 1000);
    const ds = dt.toISOString().slice(0, 10);
    try {
      const r = await fetchAFOddsForDateLeague(ds, leagueId);
      if (r.note) lastNote = r.note;
      out.push(...r.matches);
    } catch (e) { lastNote = e.message; }
    await sleep(4000);
  }
  return { matches: out, note: lastNote };
}

// ─── Croisement ───────────────────────────────────────────────────────────────

function crossCompare(oddsApiMatches, afMatches) {
  const afMap = new Map();
  for (const m of afMatches) {
    afMap.set(`${normName(m.home)}|${normName(m.away)}`, m);
  }
  const intersect = [];
  const onlyOdds = [];
  for (const oa of oddsApiMatches) {
    const key = `${normName(oa.home)}|${normName(oa.away)}`;
    if (afMap.has(key)) {
      const af = afMap.get(key);
      intersect.push({ oa, af });
      afMap.delete(key);
    } else {
      onlyOdds.push(oa);
    }
  }
  const onlyAf = [...afMap.values()];
  return { intersect, onlyOdds, onlyAf };
}

function pctDiff(a, b) {
  if (!a || !b || a <= 0 || b <= 0) return null;
  return ((a - b) / b) * 100;
}

// ─── Main ────────────────────────────────────────────────────────────────────

(async () => {
  const startTs = Date.now();
  console.log('═'.repeat(72));
  console.log('  bd zia — Audit coverage Odds API vs API-Football');
  console.log('  ' + new Date().toISOString());
  console.log('═'.repeat(72));
  console.log(`  Leagues: ${LEAGUES.join(', ')}`);
  console.log(`  ODDS_API_KEY: ${ODDS_API_KEY ? 'present' : 'MISSING'}`);
  console.log(`  API_FOOTBALL_KEY: ${API_FOOTBALL_KEY ? 'present' : 'MISSING'}`);
  console.log(`  Mode: ${dryRun ? 'DRY-RUN' : 'LIVE'}`);
  console.log('');

  const perLeague = [];
  let totalOAMatches = 0;
  let totalAFMatches = 0;
  let totalIntersect = 0;
  const allBookCountsOA = [];
  const allBookCountsAF = [];
  const allDeltaHome = [];
  const allDeltaAway = [];
  const allDeltaDraw = [];

  for (const lgId of LEAGUES) {
    const sportKey = SPORT_KEY_BY_AF_ID[lgId];
    const label = LEAGUE_LABEL_BY_AF_ID[lgId] || `league=${lgId}`;
    console.log(`─── ${label} (AF ${lgId} / OA ${sportKey || '?'}) ─────────────────────`);

    let oa = { matches: [], note: 'skipped' };
    let af = { matches: [], note: 'skipped' };

    if (!dryRun) {
      if (sportKey) {
        try { oa = await fetchOddsApiForSport(sportKey); }
        catch (e) { oa = { matches: [], note: e.message }; }
      } else {
        oa = { matches: [], note: 'sport_key inconnu' };
      }
      try { af = await fetchAFOddsForLeague(lgId); }
      catch (e) { af = { matches: [], note: e.message }; }
    }

    console.log(`  Odds API   : ${oa.matches.length} matchs${oa.note ? ' (' + oa.note + ')' : ''}`);
    console.log(`  API-Football: ${af.matches.length} matchs${af.note ? ' (' + af.note + ')' : ''}`);

    const cross = crossCompare(oa.matches, af.matches);
    console.log(`  Intersection: ${cross.intersect.length} | only OA: ${cross.onlyOdds.length} | only AF: ${cross.onlyAf.length}`);

    const oaBooks = oa.matches.map(m => m.books_count).filter(Boolean);
    const afBooks = af.matches.map(m => m.books_count).filter(Boolean);
    const avgOA = oaBooks.length ? (oaBooks.reduce((a, b) => a + b, 0) / oaBooks.length) : 0;
    const avgAF = afBooks.length ? (afBooks.reduce((a, b) => a + b, 0) / afBooks.length) : 0;
    console.log(`  Avg books   : OA=${avgOA.toFixed(1)} | AF=${avgAF.toFixed(1)}`);

    const dH = [], dA = [], dN = [];
    for (const { oa: o, af: a } of cross.intersect) {
      const ph = pctDiff(o.best.home, a.best.home);
      const pa = pctDiff(o.best.away, a.best.away);
      const pn = pctDiff(o.best.draw, a.best.draw);
      if (ph != null) dH.push(ph);
      if (pa != null) dA.push(pa);
      if (pn != null) dN.push(pn);
    }
    const medH = median(dH), medA = median(dA), medN = median(dN);
    console.log(`  Median Δcote%: home=${medH != null ? medH.toFixed(2) : 'n/a'} | draw=${medN != null ? medN.toFixed(2) : 'n/a'} | away=${medA != null ? medA.toFixed(2) : 'n/a'}`);
    console.log('');

    perLeague.push({
      league_id: lgId, label, sport_key: sportKey,
      oa_count: oa.matches.length, af_count: af.matches.length,
      intersect: cross.intersect.length, only_oa: cross.onlyOdds.length, only_af: cross.onlyAf.length,
      avg_books_oa: avgOA, avg_books_af: avgAF,
      median_delta_home: medH, median_delta_draw: medN, median_delta_away: medA,
      oa_note: oa.note || null, af_note: af.note || null,
    });

    totalOAMatches += oa.matches.length;
    totalAFMatches += af.matches.length;
    totalIntersect += cross.intersect.length;
    allBookCountsOA.push(...oaBooks);
    allBookCountsAF.push(...afBooks);
    allDeltaHome.push(...dH);
    allDeltaAway.push(...dA);
    allDeltaDraw.push(...dN);
  }

  const globalAvgBooksOA = allBookCountsOA.length
    ? (allBookCountsOA.reduce((a, b) => a + b, 0) / allBookCountsOA.length) : 0;
  const globalAvgBooksAF = allBookCountsAF.length
    ? (allBookCountsAF.reduce((a, b) => a + b, 0) / allBookCountsAF.length) : 0;
  const coveragePct = totalOAMatches ? (totalIntersect / totalOAMatches * 100) : 0;

  console.log('═'.repeat(72));
  console.log(`  TOTAL: OA=${totalOAMatches} | AF=${totalAFMatches} | inter=${totalIntersect} (${coveragePct.toFixed(1)}% coverage AF vs OA)`);
  console.log(`  Avg books global: OA=${globalAvgBooksOA.toFixed(1)} | AF=${globalAvgBooksAF.toFixed(1)}`);
  console.log(`  Median Δcote% global: home=${median(allDeltaHome)?.toFixed(2) ?? 'n/a'} | draw=${median(allDeltaDraw)?.toFixed(2) ?? 'n/a'} | away=${median(allDeltaAway)?.toFixed(2) ?? 'n/a'}`);
  console.log(`  Durée: ${((Date.now() - startTs) / 1000).toFixed(1)}s`);
  console.log('═'.repeat(72));

  // ─── Rapport markdown ──────────────────────────────────────────────────────
  const outDir = path.join(__dirname, '..', '.context', 'audits');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'audit-zia-odds-coverage-apifootball-vs-oddsapi.md');

  const lines = [];
  lines.push('# Audit bd `zia` — Coverage Odds API vs API-Football');
  lines.push('');
  lines.push(`> Généré : ${new Date().toISOString()}  |  Durée : ${((Date.now() - startTs) / 1000).toFixed(1)}s`);
  lines.push(`> Ligues sondées : ${LEAGUES.join(', ')}  |  Mode : ${dryRun ? 'DRY-RUN' : 'LIVE'}`);
  lines.push(`> Clés : ODDS_API_KEY=${ODDS_API_KEY ? 'OK' : 'MISSING'} · API_FOOTBALL_KEY=${API_FOOTBALL_KEY ? 'OK' : 'MISSING'}`);
  lines.push('');
  lines.push('## Synthèse');
  lines.push('');
  lines.push(`- **Matchs Odds API** : ${totalOAMatches}`);
  lines.push(`- **Matchs API-Football** : ${totalAFMatches}`);
  lines.push(`- **Intersection** : ${totalIntersect} (${coveragePct.toFixed(1)}% coverage AF vs OA)`);
  lines.push(`- **Avg # bookmakers** : OA=${globalAvgBooksOA.toFixed(1)} · AF=${globalAvgBooksAF.toFixed(1)}`);
  lines.push(`- **Median Δcote%** (positif → OA cote plus haute) : home=${median(allDeltaHome)?.toFixed(2) ?? 'n/a'}% · draw=${median(allDeltaDraw)?.toFixed(2) ?? 'n/a'}% · away=${median(allDeltaAway)?.toFixed(2) ?? 'n/a'}%`);
  lines.push('');
  lines.push('## Détail par ligue');
  lines.push('');
  lines.push('| Ligue | OA | AF | Inter. | only OA | only AF | Avg books OA | Avg books AF | Δ% home | Δ% draw | Δ% away |');
  lines.push('|---|---|---|---|---|---|---|---|---|---|---|');
  for (const r of perLeague) {
    lines.push(`| ${r.label} | ${r.oa_count} | ${r.af_count} | ${r.intersect} | ${r.only_oa} | ${r.only_af} | ${r.avg_books_oa.toFixed(1)} | ${r.avg_books_af.toFixed(1)} | ${r.median_delta_home != null ? r.median_delta_home.toFixed(2) : 'n/a'} | ${r.median_delta_draw != null ? r.median_delta_draw.toFixed(2) : 'n/a'} | ${r.median_delta_away != null ? r.median_delta_away.toFixed(2) : 'n/a'} |`);
  }
  lines.push('');
  lines.push('## Notes');
  lines.push('');
  for (const r of perLeague) {
    if (r.oa_note || r.af_note) {
      lines.push(`- **${r.label}** : OA=${r.oa_note || 'ok'} · AF=${r.af_note || 'ok'}`);
    }
  }
  lines.push('');
  lines.push('## Interprétation');
  lines.push('');
  lines.push('- **Coverage** : % de matchs Odds API également présents dans API-Football (fenêtre J+0..J+2).');
  lines.push('- **Avg books** : nombre moyen de bookmakers par match (mesure profondeur sourcing).');
  lines.push('- **Δ% (positif)** : meilleure cote OA > meilleure cote AF → OA capture plus de high-edge.');
  lines.push('- **Δ% (négatif)** : AF propose cotes plus élevées (rare si bookmakers EU similaires).');
  lines.push('');
  lines.push('## Recommandation bd `zia`');
  lines.push('');
  if (totalOAMatches === 0 && totalAFMatches === 0) {
    lines.push('> ⚠️ Audit non concluant : 0 matchs récupérés. Vérifier clés API + fenêtre temporelle.');
  } else if (coveragePct >= 80 && globalAvgBooksAF >= globalAvgBooksOA * 0.5) {
    lines.push('> ✅ **GO migration progressive** : couverture AF ≥ 80% des matchs OA + nombre bookmakers raisonnable.');
    lines.push('> Plan : activer `USE_API_FOOTBALL_ODDS=1` en prod, monitorer 7j, puis dépréciation Odds API.');
  } else if (coveragePct >= 50) {
    lines.push('> 🟡 **Hybrid maintain** : couverture AF partielle. Garder Odds API source primaire ligues majeures, AF en fallback opt-in.');
  } else {
    lines.push('> 🔴 **NO-GO migration totale** : couverture AF insuffisante. Conserver Odds API source primaire. AF = enrichissement ligues exotiques absent OA.');
  }
  lines.push('');
  lines.push(`*Tool : \`tools/audit-zia-odds-coverage.js\`*`);

  fs.writeFileSync(outPath, lines.join('\n'), 'utf-8');
  console.log(`\n  ✓ Rapport écrit : ${outPath}`);
})().catch(e => {
  console.error('  ❌ Audit failed:', e.stack || e.message);
  process.exit(1);
});
