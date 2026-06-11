/**
 * seed_historique_international.js — ETL matchs internationaux (sélections)
 * ────────────────────────────────────────────────────────────────────────
 * Mission: bd ParisScorebis-qgfm — World Cup 2026 : les sélections nationales
 * tombaient en simStats (football-data.co.uk = clubs uniquement).
 *
 * SOURCE: https://github.com/martj42/international_results (CC0 1.0)
 *   - CSV unique results.csv — TOUS les matchs internationaux 1872 → fixtures à venir
 *   - ~49 500 lignes, maintenu activement (fixtures WC 2026 incluses)
 *   - Colonnes: date,home_team,away_team,home_score,away_score,tournament,city,country,neutral
 *
 * USAGE:
 *   node seed_historique_international.js                  # depuis 2022-01-01
 *   node seed_historique_international.js --from=2020-01-01
 *   node seed_historique_international.js --dry
 *
 * OUTPUT: historique_international.json (schéma leagues.{INT_all} compatible loadHistory)
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const OUTPUT_FILE = path.join(__dirname, 'historique_international.json');
const CSV_URL = 'https://raw.githubusercontent.com/martj42/international_results/master/results.csv';
const DEFAULT_FROM = '2022-01-01';

// Normalisation noms martj42 → noms BSD/Odds API (calibré sur db.matches WC 2026 réels)
const INTL_TEAM_MAP = {
  'United States': 'USA',
  'Turkey': 'Türkiye',
  'Czech Republic': 'Czechia',
  'Ivory Coast': "Côte d'Ivoire",
  'Cape Verde': 'Cabo Verde',
  'Bosnia and Herzegovina': 'Bosnia & Herzegovina',
  'South Korea': 'South Korea',
  'North Korea': 'North Korea',
  'United Arab Emirates': 'UAE',
};
const normalizeIntlTeam = (n) => INTL_TEAM_MAP[n] || n;

function httpsGetText(url, hop = 0) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'PariScore-ETL/1.0 (+https://pariscore.fr)' } }, (res) => {
      if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location && hop < 2) {
        res.resume();
        return resolve(httpsGetText(res.headers.location, hop + 1));
      }
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (c) => data += c);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    });
    req.on('error', reject);
    req.setTimeout(60000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

function parseCSVLine(line) {
  if (!line.includes('"')) return line.split(',');
  const out = [];
  let cur = '', inQ = false;
  for (const ch of line) {
    if (ch === '"') inQ = !inQ;
    else if (ch === ',' && !inQ) { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

async function main() {
  const args = process.argv.slice(2);
  const isDry = args.includes('--dry');
  const fromArg = args.find(a => a.startsWith('--from'));
  const fromDate = fromArg ? (fromArg.split('=')[1] || DEFAULT_FROM) : DEFAULT_FROM;

  console.log(`[ETL international] Fetch ${CSV_URL} (fenêtre ≥ ${fromDate})${isDry ? ' DRY' : ''}`);
  const res = await httpsGetText(CSV_URL);
  if (res.status !== 200 || !res.data) throw new Error(`HTTP ${res.status}`);

  const lines = res.data.replace(/^﻿/, '').split(/\r?\n/).filter(l => l.trim().length > 1);
  const header = parseCSVLine(lines[0]).map(h => h.trim());
  const col = Object.fromEntries(header.map((h, i) => [h, i]));

  const matches = [];
  let skippedFuture = 0, skippedOld = 0;
  for (let i = 1; i < lines.length; i++) {
    const c = parseCSVLine(lines[i]);
    const date = (c[col.date] || '').trim();
    if (date < fromDate) { skippedOld++; continue; }
    const hs = Number(c[col.home_score]), as = Number(c[col.away_score]);
    if (!Number.isFinite(hs) || !Number.isFinite(as)) { skippedFuture++; continue; } // fixtures NA
    const homeRaw = (c[col.home_team] || '').trim();
    const awayRaw = (c[col.away_team] || '').trim();
    if (!homeRaw || !awayRaw) continue;
    matches.push({
      id: `intl_${homeRaw.replace(/\s+/g, '_')}_vs_${awayRaw.replace(/\s+/g, '_')}_${date}`,
      source: 'martj42/international_results',
      league_id: 'INT',
      league_name: (c[col.tournament] || 'International').trim(),
      country: 'International',
      season: date.slice(0, 4),
      date,
      home_team: normalizeIntlTeam(homeRaw),
      away_team: normalizeIntlTeam(awayRaw),
      home_score: hs,
      away_score: as,
      is_neutral: String(c[col.neutral]).trim().toUpperCase() === 'TRUE',
      city: (c[col.city] || '').trim() || null,
      status: 'finished',
      _attribution: 'martj42/international_results (CC0 1.0)',
    });
  }

  const out = {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    source: 'martj42/international_results',
    license: 'CC0 1.0',
    window_from: fromDate,
    leagues: {
      INT_all: {
        meta: {
          div: 'INT', name: 'International', country: 'International',
          season: `${fromDate.slice(0, 4)}+`, bsd_league_id: null,
          source_url: CSV_URL, last_update: new Date().toISOString(),
        },
        matches,
      },
    },
  };

  if (!isDry) {
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(out));
    const sizeMB = (fs.statSync(OUTPUT_FILE).size / 1024 / 1024).toFixed(1);
    console.log(`[ETL international] OK — ${matches.length} matchs (≥${fromDate}) → ${OUTPUT_FILE} (${sizeMB} MB) | skip: ${skippedOld} anciens, ${skippedFuture} fixtures sans score`);
  } else {
    console.log(`[ETL international] DRY — ${matches.length} matchs | skip: ${skippedOld} anciens, ${skippedFuture} fixtures`);
    const teams = new Set(); matches.forEach(m => { teams.add(m.home_team); teams.add(m.away_team); });
    console.log(`[ETL international] ${teams.size} sélections couvertes`);
  }
}

if (require.main === module) {
  main().catch(e => { console.error('[ETL international] FATAL:', e.message); process.exit(1); });
}

module.exports = { main, INTL_TEAM_MAP };
