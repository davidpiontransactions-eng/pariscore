/**
 * seed_historique_footballdata.js — ETL via football-data.co.uk (CSV)
 * ────────────────────────────────────────────────────────────────────
 * Mission: bd ParisScorebis-sc0o — DB stats matchs 3+ saisons, saison par saison.
 *
 * SOURCE: https://www.football-data.co.uk/data.php
 *   - CSV par saison × division — URL stable: /mmz4281/<SS><SS+1>/<DIV>.csv
 *   - 22 divisions Europe (E0..EC, SC0..SC3, D1-2, I1-2, SP1-2, F1-2, N1, B1, P1, T1, G1)
 *   - Stats par match: tirs (HS/AS), tirs cadrés (HST/AST), corners (HC/AC),
 *     fautes (HF/AF), cartons (HY/AY/HR/AR), arbitre (E0)
 *   - Cotes: B365 + Pinnacle (PSH/PSD/PSA) ouverture ET closing (PSCH/PSCD/PSCA),
 *     Max/Avg marché, Over/Under 2.5, Asian Handicap — closing = ancrage sharp devig
 *   - Gratuit, mis à jour 2×/semaine en saison, 25+ saisons de profondeur
 *   - License: libre d'utilisation (attribution courtoise football-data.co.uk)
 *
 * USAGE:
 *   node seed_historique_footballdata.js                 # 3 dernières saisons × 22 divisions
 *   node seed_historique_footballdata.js --seasons=5     # 5 saisons
 *   node seed_historique_footballdata.js --div=E0        # une division
 *   node seed_historique_footballdata.js --corners       # + backfill table corner_history
 *   node seed_historique_footballdata.js --corners-only  # backfill corners sans réécrire le JSON
 *   node seed_historique_footballdata.js --dry           # log uniquement, aucune écriture
 *
 * OUTPUT: historique_footballdata.json (compatible loadHistory) + corner_history (option)
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// ── Config ──────────────────────────────────────────────────────────────────
const OUTPUT_FILE = path.join(__dirname, 'historique_footballdata.json');
const CSV_BASE = 'https://www.football-data.co.uk/mmz4281';
const THROTTLE_MS = 250;
const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, 'pariscore.db');

// Divisions football-data.co.uk — bsd = league id BSD (bsd_config.json) pour
// le backfill corner_history, null si la ligue n'est pas couverte par BSD.
const DIVISIONS = [
  { div: 'E0',  name: 'Premier League',        country: 'England',     bsd: '1'  },
  { div: 'E1',  name: 'Championship',          country: 'England',     bsd: '12' },
  { div: 'E2',  name: 'League One',            country: 'England',     bsd: null },
  { div: 'E3',  name: 'League Two',            country: 'England',     bsd: null },
  { div: 'EC',  name: 'National League',       country: 'England',     bsd: null },
  { div: 'SC0', name: 'Scottish Premiership',  country: 'Scotland',    bsd: '13' },
  { div: 'SC1', name: 'Scottish Championship', country: 'Scotland',    bsd: null },
  { div: 'SC2', name: 'Scottish League One',   country: 'Scotland',    bsd: null },
  { div: 'SC3', name: 'Scottish League Two',   country: 'Scotland',    bsd: null },
  { div: 'D1',  name: 'Bundesliga',            country: 'Germany',     bsd: '5'  },
  { div: 'D2',  name: '2. Bundesliga',         country: 'Germany',     bsd: null },
  { div: 'I1',  name: 'Serie A',               country: 'Italy',       bsd: '4'  },
  { div: 'I2',  name: 'Serie B',               country: 'Italy',       bsd: null },
  { div: 'SP1', name: 'La Liga',               country: 'Spain',       bsd: '3'  },
  { div: 'SP2', name: 'Segunda División',      country: 'Spain',       bsd: '38' },
  { div: 'F1',  name: 'Ligue 1',               country: 'France',      bsd: '6'  },
  { div: 'F2',  name: 'Ligue 2',               country: 'France',      bsd: null },
  { div: 'N1',  name: 'Eredivisie',            country: 'Netherlands', bsd: '10' },
  { div: 'B1',  name: 'Jupiler Pro League',    country: 'Belgium',     bsd: '14' },
  { div: 'P1',  name: 'Primeira Liga',         country: 'Portugal',    bsd: '2'  },
  { div: 'T1',  name: 'Süper Lig',             country: 'Turkey',      bsd: '11' },
  { div: 'G1',  name: 'Super League Greece',   country: 'Greece',      bsd: '24' },
];

// Normalisation noms football-data.co.uk → noms BSD (corner_history / consumer
// fetchLocalCornerHistory matche par LIKE %name% — le nom stocké doit CONTENIR
// le nom BSD). Calibré sur les rosters BSD réels (corner_history DISTINCT 2026-06).
// Nom absent du dict = identique côté BSD ou ligue non BSD → stocké tel quel.
const TEAM_MAP = {
  // England (BSD 1 + 12)
  'Brighton': 'Brighton & Hove Albion', 'Leeds': 'Leeds United', 'Liverpool': 'Liverpool FC',
  'Man City': 'Manchester City', 'Man United': 'Manchester United', 'Newcastle': 'Newcastle United',
  "Nott'm Forest": 'Nottingham Forest', 'Tottenham': 'Tottenham Hotspur', 'West Ham': 'West Ham United',
  'Wolves': 'Wolverhampton', 'Sheffield Weds': 'Sheffield Wednesday', 'West Brom': 'West Bromwich Albion',
  'QPR': 'Queens Park Rangers', 'Birmingham': 'Birmingham City', 'Blackburn': 'Blackburn Rovers',
  'Charlton': 'Charlton Athletic', 'Coventry': 'Coventry City', 'Derby': 'Derby County',
  'Hull': 'Hull City', 'Ipswich': 'Ipswich Town', 'Leicester': 'Leicester City',
  'Luton': 'Luton Town', 'Norwich': 'Norwich City', 'Oxford': 'Oxford United',
  'Preston': 'Preston North End', 'Stoke': 'Stoke City', 'Swansea': 'Swansea City',
  // Spain (BSD 3 + 38)
  'Alaves': 'Deportivo Alavés', 'Ath Bilbao': 'Athletic Club', 'Ath Madrid': 'Atlético Madrid',
  'Barcelona': 'FC Barcelona', 'Betis': 'Real Betis', 'Celta': 'Celta Vigo', 'Espanol': 'Espanyol',
  'Girona': 'Girona FC', 'Levante': 'Levante UD', 'Oviedo': 'Real Oviedo', 'Sociedad': 'Real Sociedad',
  'Vallecano': 'Rayo Vallecano', 'Almeria': 'Almería', 'Cadiz': 'Cádiz', 'Cordoba': 'Córdoba',
  'Castellon': 'CD Castellón', 'Malaga': 'Málaga CF', 'Mirandes': 'Mirandés',
  'Santander': 'Real Racing Club', 'Sp Gijon': 'Sporting Gijón', 'Valladolid': 'Real Valladolid',
  'Zaragoza': 'Real Zaragoza', 'La Coruna': 'Deportivo de La Coruña', 'Leganes': 'Leganés',
  'Ceuta': 'AD Ceuta', 'Cultural': 'Cultural Leonesa', 'Andorra': 'FC Andorra',
  'Burgos': 'Burgos Club de Fútbol', 'Albacete': 'Albacete Balompié',
  // Italy (BSD 4)
  'Milan': 'AC Milan', 'Roma': 'AS Roma', 'Verona': 'Hellas Verona', 'Napoli': 'SSC Napoli',
  // Germany (BSD 5)
  'Augsburg': 'FC Augsburg', 'Bayern Munich': 'FC Bayern München', 'Dortmund': 'Borussia Dortmund',
  'Ein Frankfurt': 'Eintracht Frankfurt', 'FC Koln': '1. FC Köln', 'Freiburg': 'SC Freiburg',
  'Heidenheim': '1. FC Heidenheim', 'Hoffenheim': 'TSG Hoffenheim', 'Leverkusen': 'Bayer 04 Leverkusen',
  'Mainz': '1. FSV Mainz 05', "M'gladbach": "Borussia M'gladbach", 'St Pauli': 'FC St. Pauli',
  'Stuttgart': 'VfB Stuttgart', 'Union Berlin': '1. FC Union Berlin', 'Werder Bremen': 'SV Werder Bremen',
  'Wolfsburg': 'VfL Wolfsburg', 'Hamburg': 'Hamburger SV',
  // France (BSD 6)
  'Brest': 'Stade Brestois', 'Lens': 'RC Lens', 'Lyon': 'Olympique Lyonnais',
  'Marseille': 'Olympique de Marseille', 'Monaco': 'AS Monaco', 'Paris SG': 'Paris Saint-Germain',
  'Rennes': 'Stade Rennais', 'Strasbourg': 'RC Strasbourg',
  // Netherlands (BSD 10)
  'Ajax': 'AFC Ajax', 'For Sittard': 'Fortuna Sittard', 'Groningen': 'FC Groningen',
  'Heerenveen': 'SC Heerenveen', 'Heracles': 'Heracles Almelo', 'Nijmegen': 'NEC Nijmegen',
  'Telstar': 'SC Telstar', 'Twente': 'FC Twente', 'Utrecht': 'FC Utrecht',
  'Volendam': 'FC Volendam', 'Zwolle': 'PEC Zwolle',
  // Turkey (BSD 11)
  'Besiktas': 'Beşiktaş JK', 'Buyuksehyr': 'Başakşehir FK', 'Fenerbahce': 'Fenerbahçe',
  'Gaziantep': 'Gaziantep FK', 'Genclerbirligi': 'Gençlerbirliği', 'Goztepe': 'Göztepe',
  'Karagumruk': 'Fatih Karagümrük', 'Kasimpasa': 'Kasımpaşa', 'Rizespor': 'Çaykur Rizespor',
  'Eyupspor': 'Eyüpspor',
  // Greece (BSD 24)
  'AEK': 'AEK Athens', 'Aris': 'Aris Thessaloniki', 'Asteras Tripolis': 'Asteras Aktor',
  'Atromitos': 'APS Atromitos Athinon', 'Levadeiakos': 'APO Levadiakos', 'Olympiakos': 'Olympiacos FC',
  'Panathinaikos': 'Panathinaikos FC', 'Panetolikos': 'GFS Panetolikos',
  'Panserraikos': 'MGS Panserraikos', 'Volos NFC': 'NPS Volos', 'Kifisia': 'AE Kifisia',
  'Larissa': 'AEL Novibet',
  // Portugal (BSD 2)
  'Arouca': 'FC Arouca', 'AVS': 'AVS - Futebol SAD', 'Braga': 'Sporting Braga',
  'Estoril': 'Estoril Praia', 'Estrela': 'CF Estrela Amadora', 'Famalicao': 'Famalicão',
  'Guimaraes': 'Vitória SC', 'Nacional': 'CD Nacional', 'Porto': 'FC Porto',
  'Sp Lisbon': 'Sporting CP', 'Alverca': 'FC Alverca',
  // Belgium (BSD 14)
  'Anderlecht': 'RSC Anderlecht', 'Antwerp': 'Royal Antwerp FC', 'Charleroi': 'RC Sporting Charleroi',
  'Club Brugge': 'Club Brugge KV', 'Dender': 'FCV Dender', 'Genk': 'KRC Genk', 'Gent': 'KAA Gent',
  'Mechelen': 'KV Mechelen', 'St Truiden': 'Sint-Truidense VV', 'St. Gilloise': 'Royale Union Saint-Gilloise',
  'Standard': 'Standard Liège', 'Westerlo': 'KVC Westerlo', 'Waregem': 'SV Zulte Waregem',
  'La Louviere': 'RAAL La Louvière',
  // Scotland (BSD 13)
  'Dundee': 'Dundee FC', 'Falkirk': 'Falkirk FC', 'Hearts': 'Heart of Midlothian',
  'St Mirren': 'St. Mirren',
};
const normalizeTeam = (name) => TEAM_MAP[name] || name;

// ── Saisons ─────────────────────────────────────────────────────────────────
// Code football-data: '2526' = saison 2025-26. Saison démarre en août.
function currentSeasonStartYear(now = new Date()) {
  return now.getMonth() + 1 >= 8 ? now.getFullYear() : now.getFullYear() - 1;
}
function seasonCodes(count) {
  const startYear = currentSeasonStartYear();
  const codes = [];
  for (let i = 0; i < count; i++) {
    const y = startYear - i;
    codes.push(`${String(y % 100).padStart(2, '0')}${String((y + 1) % 100).padStart(2, '0')}`);
  }
  return codes.reverse(); // chronologique
}
function seasonLabel(code) {
  // '2526' → '2025-2026' (même format que corner_history BSD seed)
  const y1 = 2000 + parseInt(code.slice(0, 2), 10);
  return `${y1}-${y1 + 1}`;
}

// ── HTTP helper (texte CSV, suit 1 redirect) ────────────────────────────────
function httpsGetText(url, hop = 0) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'PariScore-ETL/1.0 (+https://pariscore.fr)' } }, (res) => {
      if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location && hop < 1) {
        res.resume();
        return resolve(httpsGetText(res.headers.location, hop + 1));
      }
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (c) => data += c);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    });
    req.on('error', reject);
    req.setTimeout(20000, () => { req.destroy(); reject(new Error('timeout ' + url)); });
  });
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ── CSV parse (header-indexed — les colonnes varient par division/saison) ───
function parseCSVLine(line) {
  // football-data n'utilise pas de virgules dans les valeurs, mais on gère les
  // guillemets défensivement.
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

function parseCSV(text) {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter(l => l.trim().length > 1);
  if (lines.length < 2) return [];
  const header = parseCSVLine(lines[0]).map(h => h.trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCSVLine(lines[i]);
    const row = {};
    for (let j = 0; j < header.length; j++) row[header[j]] = (cells[j] || '').trim();
    rows.push(row);
  }
  return rows;
}

const num = (v) => {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

// Date fd 'DD/MM/YYYY' (ou 'DD/MM/YY' anciennes saisons) → ISO 'YYYY-MM-DD'
function toISODate(d) {
  if (!d) return null;
  const m = d.match(/^(\d{2})\/(\d{2})\/(\d{2,4})$/);
  if (!m) return null;
  let y = parseInt(m[3], 10);
  if (m[3].length === 2) y += y > 70 ? 1900 : 2000;
  return `${y}-${m[2]}-${m[1]}`;
}

// ── Transform ligne CSV → record unifié ─────────────────────────────────────
function transformRow(row, divMeta, code) {
  const home = row.HomeTeam, away = row.AwayTeam;
  if (!home || !away) return null;
  const isoDate = toISODate(row.Date);
  if (!isoDate) return null;
  const season = seasonLabel(code);

  const odds1n2 = (h, d, a) => (h != null || d != null || a != null) ? { home: h, draw: d, away: a } : null;

  const rec = {
    id: `fd_${divMeta.div}_${code}_${home.replace(/\s+/g, '_')}_vs_${away.replace(/\s+/g, '_')}_${isoDate}`,
    source: 'football-data.co.uk',
    league_id: divMeta.div,
    league_name: divMeta.name,
    country: divMeta.country,
    season,
    date: isoDate,
    time: row.Time || null,
    home_team: home,
    away_team: away,
    home_score: num(row.FTHG),
    away_score: num(row.FTAG),
    result: row.FTR || null,                              // H / D / A
    halftime_score: { home: num(row.HTHG), away: num(row.HTAG) },
    referee: row.Referee || null,
    stats: {
      shots: { home: num(row.HS), away: num(row.AS) },
      shots_on_target: { home: num(row.HST), away: num(row.AST) },
      corners: { home: num(row.HC), away: num(row.AC) },
      fouls: { home: num(row.HF), away: num(row.AF) },
      yellow_cards: { home: num(row.HY), away: num(row.AY) },
      red_cards: { home: num(row.HR), away: num(row.AR) },
    },
    odds: {
      b365: odds1n2(num(row.B365H), num(row.B365D), num(row.B365A)),
      pinnacle: odds1n2(num(row.PSH), num(row.PSD), num(row.PSA)),
      pinnacle_closing: odds1n2(num(row.PSCH), num(row.PSCD), num(row.PSCA)),
      market_avg_closing: odds1n2(num(row.AvgCH), num(row.AvgCD), num(row.AvgCA)),
      market_max_closing: odds1n2(num(row.MaxCH), num(row.MaxCD), num(row.MaxCA)),
      ou25_closing: (num(row['PC>2.5']) != null || num(row['B365C>2.5']) != null) ? {
        over: num(row['PC>2.5']) ?? num(row['B365C>2.5']),
        under: num(row['PC<2.5']) ?? num(row['B365C<2.5']),
      } : null,
      ah_closing: num(row.AHCh) != null ? {
        handicap: num(row.AHCh),
        home: num(row.PCAHH) ?? num(row.B365CAHH),
        away: num(row.PCAHA) ?? num(row.B365CAHA),
      } : null,
    },
    status: 'finished',
    _attribution: 'football-data.co.uk',
  };
  return rec;
}

// ── Backfill corner_history (SQLite) ────────────────────────────────────────
function backfillCorners(allLeagues, isDry) {
  const Database = require('better-sqlite3');
  const db = new Database(DB_PATH);
  db.exec(`CREATE TABLE IF NOT EXISTS corner_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bsd_event_id TEXT UNIQUE NOT NULL,
    bsd_league_id TEXT NOT NULL,
    match_date TEXT NOT NULL,
    season TEXT NOT NULL,
    home_team TEXT NOT NULL,
    away_team TEXT NOT NULL,
    home_corners INTEGER,
    away_corners INTEGER,
    total_corners INTEGER,
    fetched_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
  )`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_ch_team ON corner_history(home_team, away_team)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_ch_date ON corner_history(match_date)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_ch_season ON corner_history(season)`);

  // Dédup vs lignes BSD existantes : même affiche à ±1 jour (timezone BSD)
  const dupStmt = db.prepare(`SELECT 1 FROM corner_history
    WHERE home_team = ? AND away_team = ?
      AND match_date BETWEEN date(?, '-1 day') AND date(?, '+1 day')
    LIMIT 1`);
  const insertStmt = db.prepare(`INSERT OR IGNORE INTO corner_history
    (bsd_event_id, bsd_league_id, match_date, season, home_team, away_team, home_corners, away_corners, total_corners)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);

  let inserted = 0, dups = 0, noCorners = 0;
  const run = db.transaction(() => {
    for (const key of Object.keys(allLeagues)) {
      const { meta, matches } = allLeagues[key];
      if (!meta.bsd_league_id) continue;
      for (const m of matches) {
        const hc = m.stats?.corners?.home, ac = m.stats?.corners?.away;
        if (hc == null || ac == null) { noCorners++; continue; }
        const home = normalizeTeam(m.home_team), away = normalizeTeam(m.away_team);
        if (dupStmt.get(home, away, m.date, m.date)) { dups++; continue; }
        if (!isDry) {
          const r = insertStmt.run(m.id, meta.bsd_league_id, m.date, m.season, home, away, hc, ac, hc + ac);
          if (r.changes > 0) inserted++;
        } else inserted++;
      }
    }
  });
  run();
  const total = db.prepare('SELECT COUNT(*) c FROM corner_history').get().c;
  db.close();
  console.log(`[ETL footballdata] corner_history backfill — +${inserted} insérés${isDry ? ' (DRY)' : ''}, ${dups} dédup BSD, ${noCorners} sans corners. Total table: ${total}`);
}

// ── Main ETL ────────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const getArg = (name) => {
    const a = args.find(x => x.startsWith(`--${name}`));
    if (!a) return null;
    return a.includes('=') ? a.split('=')[1] : args[args.indexOf(a) + 1];
  };
  const isDry = args.includes('--dry');
  const doCorners = args.includes('--corners') || args.includes('--corners-only');
  const cornersOnly = args.includes('--corners-only');
  const seasonsCount = Math.max(1, parseInt(getArg('seasons') || '3', 10) || 3);
  const divFilter = getArg('div');

  const codes = getArg('season') ? [getArg('season')] : seasonCodes(seasonsCount);
  const divisions = divFilter ? DIVISIONS.filter(d => d.div === divFilter) : DIVISIONS;
  if (!divisions.length) { console.error(`[ETL footballdata] division inconnue: ${divFilter}`); process.exit(1); }

  console.log(`[ETL footballdata] Démarrage — saisons [${codes.join(', ')}] × ${divisions.length} divisions${isDry ? ' (DRY RUN)' : ''}`);

  const out = {
    schema_version: 1,
    generated_at: null,
    source: 'football-data.co.uk',
    license: 'Free — attribution football-data.co.uk',
    leagues: {},
  };
  let totalMatches = 0, totalWithStats = 0, errors = 0;

  for (const code of codes) {
    for (const d of divisions) {
      const url = `${CSV_BASE}/${code}/${d.div}.csv`;
      try {
        const res = await httpsGetText(url);
        if (res.status !== 200 || !res.data || res.data.length < 100) {
          console.log(`[ETL footballdata]   ${d.div} ${code} → HTTP ${res.status} (skip)`);
          await sleep(THROTTLE_MS);
          continue;
        }
        const rows = parseCSV(res.data);
        const matches = rows.map(r => transformRow(r, d, code)).filter(Boolean);
        const withStats = matches.filter(m => m.stats.shots.home != null).length;
        out.leagues[`${d.div}_${code}`] = {
          meta: {
            div: d.div, name: d.name, country: d.country,
            season: seasonLabel(code), season_code: code,
            bsd_league_id: d.bsd, source_url: url,
            last_update: new Date().toISOString(),
          },
          matches,
        };
        totalMatches += matches.length;
        totalWithStats += withStats;
        console.log(`[ETL footballdata]   ${d.div} ${code} → ${matches.length} matchs (${withStats} avec stats)`);
      } catch (e) {
        errors++;
        console.warn(`[ETL footballdata]   ${d.div} ${code} ERREUR: ${e.message}`);
      }
      await sleep(THROTTLE_MS);
    }
  }

  out.generated_at = new Date().toISOString();

  if (!isDry && !cornersOnly) {
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(out)); // compact — ~25k matchs
    const sizeMB = (fs.statSync(OUTPUT_FILE).size / 1024 / 1024).toFixed(1);
    console.log(`[ETL footballdata] OK — ${totalMatches} matchs (${totalWithStats} avec stats, ${errors} erreurs) → ${OUTPUT_FILE} (${sizeMB} MB)`);
  } else {
    console.log(`[ETL footballdata] ${isDry ? 'DRY' : 'corners-only'} — ${totalMatches} matchs (${totalWithStats} avec stats, ${errors} erreurs)`);
  }

  if (doCorners) backfillCorners(out.leagues, isDry);
}

if (require.main === module) {
  main().catch(e => {
    console.error('[ETL footballdata] FATAL:', e.message);
    process.exit(1);
  });
}

module.exports = { main, transformRow, parseCSV, seasonCodes, seasonLabel, TEAM_MAP, DIVISIONS };
