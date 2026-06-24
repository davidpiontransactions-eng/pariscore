/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  PariScore — Tennis Live API Handlers
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  Intégration dans server.js :
 *    1. require('./tennis-live-api')   — crée la table + seed si vide
 *    2. Les 3 handlers sont exportés via module.exports.handleRequest(pathname, query, res)
 *       → appelle-le AVANT le handler principal, ou insère les 3 blocs if() dans ton router
 *
 *  Dépend : sqldb (better-sqlite3) doit être accessible globalement ou passé en param
 * ═══════════════════════════════════════════════════════════════════════════
 */

'use strict';

// ── Configuration ──────────────────────────────────────────────────────────
// sqldb est le better-sqlite3 Database de server.js (variable globale)
// Si non global, passe-le : require('./tennis-live-api').init(sqldb)
let _db = null;

function getDb() {
  if (_db) return _db;
  if (typeof sqldb !== 'undefined') { _db = sqldb; return _db; }
  throw new Error('tennis-live-api: sqldb non trouvé. Appelle .init(db) ou défini global sqldb.');
}

// ── Création table ─────────────────────────────────────────────────────────
const CREATE_TABLE = `
CREATE TABLE IF NOT EXISTS tennis_players_live (
  slug              TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  wikipedia_title   TEXT,
  gender            TEXT NOT NULL DEFAULT 'ATP',
  country           TEXT,
  points            INTEGER DEFAULT 0,
  rank              INTEGER,
  peak_rank         INTEGER,
  elo               REAL,
  elo_rank          INTEGER,
  elo_hard          REAL DEFAULT 1500,
  elo_hard_rank     INTEGER,
  elo_clay          REAL DEFAULT 1500,
  elo_clay_rank     INTEGER,
  elo_grass         REAL DEFAULT 1500,
  elo_grass_rank    INTEGER,
  l5                TEXT,
  l5_win_rate       REAL DEFAULT 0.5,
  l5_dr_trend       REAL DEFAULT 0,
  hard_matches      INTEGER DEFAULT 0,
  hard_win_pct      REAL DEFAULT 0,
  hard_dr           REAL DEFAULT 1.0,
  hard_spw          REAL DEFAULT 0,
  hard_rpw          REAL DEFAULT 0,
  hard_hold_pct     REAL DEFAULT 0,
  hard_break_pct    REAL DEFAULT 0,
  clay_matches      INTEGER DEFAULT 0,
  clay_win_pct      REAL DEFAULT 0,
  clay_dr           REAL DEFAULT 1.0,
  clay_spw          REAL DEFAULT 0,
  clay_rpw          REAL DEFAULT 0,
  clay_hold_pct     REAL DEFAULT 0,
  clay_break_pct    REAL DEFAULT 0,
  grass_matches     INTEGER DEFAULT 0,
  grass_win_pct     REAL DEFAULT 0,
  grass_dr          REAL DEFAULT 1.0,
  grass_spw          REAL DEFAULT 0,
  grass_rpw          REAL DEFAULT 0,
  grass_hold_pct     REAL DEFAULT 0,
  grass_break_pct    REAL DEFAULT 0,
  composite_score   REAL DEFAULT 0,
  metrics_source    TEXT,
  created_at        TEXT DEFAULT (datetime('now')),
  updated_at        TEXT DEFAULT (datetime('now'))
);
`;

// ── Seed data (10 joueurs) ────────────────────────────────────────────────
const SEED_PLAYERS = [
  { slug:'sinner-jannik', name:'Sinner Jannik', wikipedia_title:'JannikSinner', gender:'ATP', country:'ITA', points:13500, rank:1, peak_rank:1, elo:2320, elo_rank:1, elo_hard:2263, elo_hard_rank:1, elo_clay:2216, elo_clay_rank:1, elo_grass:2088, elo_grass_rank:2, l5:'LWWWW', l5_win_rate:0.8, l5_dr_trend:-0.91, hard_matches:308, hard_win_pct:0.815, hard_dr:1.28, hard_spw:0.684, hard_rpw:0.404, hard_hold_pct:0.878, hard_break_pct:0.278, clay_matches:110, clay_win_pct:0.755, clay_dr:1.24, clay_spw:0.654, clay_rpw:0.429, clay_hold_pct:0.828, clay_break_pct:0.335, grass_matches:39, grass_win_pct:0.744, grass_dr:1.28, grass_spw:0.705, grass_rpw:0.379, grass_hold_pct:0.895, grass_break_pct:0.219, composite_score:83.2 },
  { slug:'alcaraz-carlos', name:'Alcaraz Carlos', wikipedia_title:'CarlosAlcaraz', gender:'ATP', country:'ESP', points:9960, rank:2, peak_rank:1, elo:2167, elo_rank:3, elo_hard:2198, elo_hard_rank:2, elo_clay:2125, elo_clay_rank:4, elo_grass:2122, elo_grass_rank:1, l5:'LWLWW', l5_win_rate:0.6, l5_dr_trend:0.15, hard_matches:155, hard_win_pct:0.781, hard_dr:1.26, hard_spw:0.672, hard_rpw:0.418, hard_hold_pct:0.865, hard_break_pct:0.302, clay_matches:80, clay_win_pct:0.763, clay_dr:1.22, clay_spw:0.638, clay_rpw:0.441, clay_hold_pct:0.825, clay_break_pct:0.328, grass_matches:28, grass_win_pct:0.786, grass_dr:1.27, grass_spw:0.691, grass_rpw:0.392, grass_hold_pct:0.889, grass_break_pct:0.221, composite_score:68.3 },
  { slug:'zverev-alexander', name:'Zverev Alexander', wikipedia_title:'AlexanderZverev', gender:'ATP', country:'GER', points:7190, rank:3, peak_rank:2, elo:2104, elo_rank:5, elo_hard:2044, elo_hard_rank:5, elo_clay:2089, elo_clay_rank:3, elo_grass:1985, elo_grass_rank:6, l5:'LWWWW', l5_win_rate:0.8, l5_dr_trend:0.22, hard_matches:385, hard_win_pct:0.745, hard_dr:1.14, hard_spw:0.668, hard_rpw:0.372, hard_hold_pct:0.842, hard_break_pct:0.245, clay_matches:165, clay_win_pct:0.721, clay_dr:1.18, clay_spw:0.625, clay_rpw:0.401, clay_hold_pct:0.805, clay_break_pct:0.302, grass_matches:42, grass_win_pct:0.714, grass_dr:1.15, grass_spw:0.652, grass_rpw:0.358, grass_hold_pct:0.821, grass_break_pct:0.225, composite_score:81.0 },
  { slug:'djokovic-novak', name:'Djokovic Novak', wikipedia_title:'NovakDjokovic', gender:'ATP', country:'SRB', points:3760, rank:8, peak_rank:1, elo:null, elo_rank:null, elo_hard:1500, elo_clay:1500, elo_grass:1500, l5:'LWWLL', l5_win_rate:0.4, l5_dr_trend:-0.45, hard_matches:520, hard_win_pct:0.823, hard_dr:1.31, hard_spw:0.681, hard_rpw:0.425, hard_hold_pct:0.881, hard_break_pct:0.295, clay_matches:175, clay_win_pct:0.789, clay_dr:1.25, clay_spw:0.642, clay_rpw:0.438, clay_hold_pct:0.845, clay_break_pct:0.318, grass_matches:65, grass_win_pct:0.8, grass_dr:1.3, grass_spw:0.698, grass_rpw:0.402, grass_hold_pct:0.892, grass_break_pct:0.241, composite_score:74.7 },
  { slug:'fritz-taylor', name:'Fritz Taylor', wikipedia_title:'TaylorFritz', gender:'ATP', country:'USA', points:3635, rank:9, peak_rank:4, elo:null, elo_rank:null, elo_hard:1500, elo_clay:1500, elo_grass:1500, l5:'LWWWW', l5_win_rate:0.8, l5_dr_trend:0.31, hard_matches:245, hard_win_pct:0.653, hard_dr:1.1, hard_spw:0.645, hard_rpw:0.358, hard_hold_pct:0.812, hard_break_pct:0.215, clay_matches:85, clay_win_pct:0.588, clay_dr:1.05, clay_spw:0.612, clay_rpw:0.365, clay_hold_pct:0.785, clay_break_pct:0.258, grass_matches:28, grass_win_pct:0.621, grass_dr:1.08, grass_spw:0.635, grass_rpw:0.342, grass_hold_pct:0.798, grass_break_pct:0.205, composite_score:71.5 },
  { slug:'sabalenka-aryna', name:'Sabalenka Aryna', wikipedia_title:'ArynaSabalenka', gender:'WTA', country:'BLR', points:9090, rank:1, peak_rank:1, l5:'WWWWW', l5_win_rate:1.0, l5_dr_trend:0.42, hard_matches:220, hard_win_pct:0.782, hard_dr:1.25, hard_spw:0.668, hard_rpw:0.415, hard_hold_pct:0.855, hard_break_pct:0.282, clay_matches:95, clay_win_pct:0.745, clay_dr:1.18, clay_spw:0.625, clay_rpw:0.401, clay_hold_pct:0.805, clay_break_pct:0.302, grass_matches:35, grass_win_pct:0.751, grass_dr:1.22, grass_spw:0.652, grass_rpw:0.385, grass_hold_pct:0.832, grass_break_pct:0.258, composite_score:89.7 },
  { slug:'rybakina-elena', name:'Rybakina Elena', wikipedia_title:'ElenaRybakina', gender:'WTA', country:'KAZ', points:8143, rank:2, peak_rank:3, l5:'WWWWW', l5_win_rate:1.0, l5_dr_trend:0.18, hard_matches:195, hard_win_pct:0.725, hard_dr:1.22, hard_spw:0.675, hard_rpw:0.382, hard_hold_pct:0.848, hard_break_pct:0.255, clay_matches:78, clay_win_pct:0.682, clay_dr:1.12, clay_spw:0.618, clay_rpw:0.365, clay_hold_pct:0.782, clay_break_pct:0.268, grass_matches:32, grass_win_pct:0.785, grass_dr:1.28, grass_spw:0.702, grass_rpw:0.368, grass_hold_pct:0.885, grass_break_pct:0.212, composite_score:78.5 },
  { slug:'swiatek-iga', name:'Swiatek Iga', wikipedia_title:'IgaSwiatek', gender:'WTA', country:'POL', points:6733, rank:3, peak_rank:1, l5:'WWWWW', l5_win_rate:1.0, l5_dr_trend:0.55, hard_matches:185, hard_win_pct:0.768, hard_dr:1.28, hard_spw:0.652, hard_rpw:0.428, hard_hold_pct:0.835, hard_break_pct:0.305, clay_matches:110, clay_win_pct:0.825, clay_dr:1.35, clay_spw:0.638, clay_rpw:0.452, clay_hold_pct:0.828, clay_break_pct:0.352, grass_matches:30, grass_win_pct:0.725, grass_dr:1.18, grass_spw:0.625, grass_rpw:0.375, grass_hold_pct:0.805, grass_break_pct:0.248, composite_score:89.6 },
  { slug:'pegula-jessica', name:'Pegula Jessica', wikipedia_title:'JessicaPegula', gender:'WTA', country:'USA', points:6056, rank:4, peak_rank:3, l5:'WWWWW', l5_win_rate:1.0, l5_dr_trend:0.12, hard_matches:210, hard_win_pct:0.685, hard_dr:1.15, hard_spw:0.638, hard_rpw:0.362, hard_hold_pct:0.805, hard_break_pct:0.228, clay_matches:75, clay_win_pct:0.625, clay_dr:1.08, clay_spw:0.605, clay_rpw:0.358, clay_hold_pct:0.772, clay_break_pct:0.245, grass_matches:28, grass_win_pct:0.652, grass_dr:1.1, grass_spw:0.628, grass_rpw:0.345, grass_hold_pct:0.788, grass_break_pct:0.215, composite_score:80.0 },
  { slug:'gauff-coco', name:'Gauff Coco', wikipedia_title:'CocoGauff', gender:'WTA', country:'USA', points:4879, rank:7, peak_rank:2, l5:'LWWWW', l5_win_rate:0.8, l5_dr_trend:0.25, hard_matches:190, hard_win_pct:0.712, hard_dr:1.18, hard_spw:0.645, hard_rpw:0.385, hard_hold_pct:0.822, hard_break_pct:0.258, clay_matches:85, clay_win_pct:0.685, clay_dr:1.15, clay_spw:0.615, clay_rpw:0.372, clay_hold_pct:0.795, clay_break_pct:0.265, grass_matches:30, grass_win_pct:0.682, grass_dr:1.12, grass_spw:0.632, grass_rpw:0.355, grass_hold_pct:0.802, grass_break_pct:0.228, composite_score:75.5 },
];

const UPSERT_SQL = `INSERT INTO tennis_players_live (slug, name, wikipedia_title, gender, country, points, rank, peak_rank, elo, elo_rank, elo_hard, elo_hard_rank, elo_clay, elo_clay_rank, elo_grass, elo_grass_rank, l5, l5_win_rate, l5_dr_trend, hard_matches, hard_win_pct, hard_dr, hard_spw, hard_rpw, hard_hold_pct, hard_break_pct, clay_matches, clay_win_pct, clay_dr, clay_spw, clay_rpw, clay_hold_pct, clay_break_pct, grass_matches, grass_win_pct, grass_dr, grass_spw, grass_rpw, grass_hold_pct, grass_break_pct, composite_score, metrics_source)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(slug) DO UPDATE SET
  name=excluded.name, wikipedia_title=excluded.wikipedia_title, gender=excluded.gender,
  country=excluded.country, points=excluded.points, rank=excluded.rank, peak_rank=excluded.peak_rank,
  elo=excluded.elo, elo_rank=excluded.elo_rank, elo_hard=excluded.elo_hard, elo_hard_rank=excluded.elo_hard_rank,
  elo_clay=excluded.elo_clay, elo_clay_rank=excluded.elo_clay_rank, elo_grass=excluded.elo_grass, elo_grass_rank=excluded.elo_grass_rank,
  l5=excluded.l5, l5_win_rate=excluded.l5_win_rate, l5_dr_trend=excluded.l5_dr_trend,
  hard_matches=excluded.hard_matches, hard_win_pct=excluded.hard_win_pct, hard_dr=excluded.hard_dr,
  hard_spw=excluded.hard_spw, hard_rpw=excluded.hard_rpw, hard_hold_pct=excluded.hard_hold_pct, hard_break_pct=excluded.hard_break_pct,
  clay_matches=excluded.clay_matches, clay_win_pct=excluded.clay_win_pct, clay_dr=excluded.clay_dr,
  clay_spw=excluded.clay_spw, clay_rpw=excluded.clay_rpw, clay_hold_pct=excluded.clay_hold_pct, clay_break_pct=excluded.clay_break_pct,
  grass_matches=excluded.grass_matches, grass_win_pct=excluded.grass_win_pct, grass_dr=excluded.grass_dr,
  grass_spw=excluded.grass_spw, grass_rpw=excluded.grass_rpw, grass_hold_pct=excluded.grass_hold_pct, grass_break_pct=excluded.grass_break_pct,
  composite_score=excluded.composite_score, metrics_source=excluded.metrics_source, updated_at=datetime('now')`;

// ── Init ───────────────────────────────────────────────────────────────────
function init(db) {
  if (db) _db = db;
  const sqldb = getDb();
  sqldb.exec(CREATE_TABLE);
  console.log('[tennis-live-api] Table tennis_players_live OK');

  // Seed si vide
  const count = sqldb.prepare('SELECT COUNT(*) as n FROM tennis_players_live').get().n;
  if (count === 0) {
    const stmt = sqldb.prepare(UPSERT_SQL);
    for (const p of SEED_PLAYERS) {
      stmt.run(
        p.slug, p.name, p.wikipedia_title || null, p.gender, p.country || null,
        p.points || 0, p.rank || null, p.peak_rank || null,
        p.elo || null, p.elo_rank || null,
        p.elo_hard || 1500, p.elo_hard_rank || null,
        p.elo_clay || 1500, p.elo_clay_rank || null,
        p.elo_grass || 1500, p.elo_grass_rank || null,
        p.l5 || null, p.l5_win_rate || 0.5, p.l5_dr_trend || 0,
        p.hard_matches || 0, p.hard_win_pct || 0, p.hard_dr || 1.0,
        p.hard_spw || 0, p.hard_rpw || 0, p.hard_hold_pct || 0, p.hard_break_pct || 0,
        p.clay_matches || 0, p.clay_win_pct || 0, p.clay_dr || 1.0,
        p.clay_spw || 0, p.clay_rpw || 0, p.clay_hold_pct || 0, p.clay_break_pct || 0,
        p.grass_matches || 0, p.grass_win_pct || 0, p.grass_dr || 1.0,
        p.grass_spw || 0, p.grass_rpw || 0, p.grass_hold_pct || 0, p.grass_break_pct || 0,
        p.composite_score || 0, p.metrics_source || 'tennisabstract'
      );
    }
    console.log('[tennis-live-api] ' + SEED_PLAYERS.length + ' joueurs seeded');
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

function jsonResponse(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(data));
}

// ── Route: GET /api/v1/players/search?q=sinner&limit=15 ────────────────────
function handleSearch(query, res) {
  const q = String(query.q || '').trim();
  const gender = String(query.gender || '').trim();
  const limit = Math.min(50, Math.max(1, parseInt(query.limit) || 15));

  if (!q) return jsonResponse(res, 200, { results: [], count: 0, q: '' });

  const sqldb = getDb();
  const sql = `SELECT slug, name, gender, country, rank, points, composite_score, l5, l5_win_rate
    FROM tennis_players_live
    WHERE (name LIKE '%' || ? || '%' OR country LIKE '%' || ? || '%' OR slug LIKE '%' || ? || '%')
      ${gender && (gender === 'ATP' || gender === 'WTA') ? "AND gender = '" + gender + "'" : ''}
    ORDER BY rank ASC LIMIT ?`;
  const rows = sqldb.prepare(sql).all(q, q, q, limit);

  return jsonResponse(res, 200, { results: rows, count: rows.length, q });
}

// ── Route: GET /api/v1/players/top10?surface=hard&gender=ATP ──────────────
function handleTop10(query, res) {
  const surface = String(query.surface || 'hard').trim().toLowerCase();
  const gender = String(query.gender || 'ATP').trim().toUpperCase();
  const validSurfaces = { hard: 'elo_hard', clay: 'elo_clay', grass: 'elo_grass' };
  const eloCol = validSurfaces[surface] || 'elo_hard';

  const sqldb = getDb();
  const rows = sqldb.prepare(
    `SELECT slug, name, wikipedia_title, country, rank, points,
            ${eloCol} as surface_elo, l5, l5_win_rate, composite_score
     FROM tennis_players_live
     WHERE gender = ?
     ORDER BY rank ASC LIMIT 120`
  ).all(gender);

  const scored = rows.map(function(p) {
    var surfaceElo = p.surface_elo || 1500;
    var eloScore = clamp((surfaceElo - 1500) / 5.5, 0, 100);
    var l5Score = (p.l5_win_rate || 0.5) * 100;
    var forecastScore = 50; // pas de forecast delta en BDD lite
    var h2hScore = 50;      // pas de h2h en BDD lite
    var composite = eloScore * 0.4 + l5Score * 0.25 + forecastScore * 0.2 + h2hScore * 0.15;
    return {
      slug: p.slug, name: p.name, wikipediaTitle: p.wikipedia_title,
      country: p.country, officialRank: p.rank, points: p.points,
      surfaceElo: surfaceElo, l5: p.l5, l5WinRate: p.l5_win_rate,
      compositeScore: Math.round(composite * 100) / 100
    };
  });

  scored.sort(function(a, b) { return b.compositeScore - a.compositeScore; });
  var top10 = scored.slice(0, 10).map(function(p, i) { p.rank = i + 1; return p; });

  return jsonResponse(res, 200, { surface: surface, gender: gender, count: top10.length, players: top10 });
}

// ── Route: GET /api/v1/players/:slug ──────────────────────────────────────
function handleProfile(slug, res) {
  if (!slug) return jsonResponse(res, 400, { error: 'slug_required' });

  var sqldb = getDb();
  var p = sqldb.prepare('SELECT * FROM tennis_players_live WHERE slug = ?').get(slug);
  if (!p) return jsonResponse(res, 404, { error: 'Player not found' });

  return jsonResponse(res, 200, {
    player: {
      slug: p.slug, name: p.name, wikipediaTitle: p.wikipedia_title,
      gender: p.gender, country: p.country, rank: p.rank, points: p.points,
      peakRank: p.peak_rank, elo: p.elo, eloRank: p.elo_rank,
      eloHard: p.elo_hard, eloHardRank: p.elo_hard_rank,
      eloClay: p.elo_clay, eloClayRank: p.elo_clay_rank,
      eloGrass: p.elo_grass, eloGrassRank: p.elo_grass_rank,
      l5: p.l5, l5WinRate: p.l5_win_rate, l5DrTrend: p.l5_dr_trend,
      hard: { matches: p.hard_matches, winPct: p.hard_win_pct, dr: p.hard_dr,
              spw: p.hard_spw, rpw: p.hard_rpw, holdPct: p.hard_hold_pct, breakPct: p.hard_break_pct },
      clay: { matches: p.clay_matches, winPct: p.clay_win_pct, dr: p.clay_dr,
              spw: p.clay_spw, rpw: p.clay_rpw, holdPct: p.clay_hold_pct, breakPct: p.clay_break_pct },
      grass: { matches: p.grass_matches, winPct: p.grass_win_pct, dr: p.grass_dr,
               spw: p.grass_spw, rpw: p.grass_rpw, holdPct: p.grass_hold_pct, breakPct: p.grass_break_pct },
      compositeScore: p.composite_score,
      metricsSource: p.metrics_source,
      createdAt: p.created_at, updatedAt: p.updated_at,
    }
  });
}

// ── Router: à insérer dans server.js ──────────────────────────────────────
// Retourne true si la route a été gérée, false sinon
function handleRequest(pathname, query, method, res) {
  // GET /api/v1/players/search
  if (pathname === '/api/v1/players/search' && method === 'GET') {
    handleSearch(query, res);
    return true;
  }

  // GET /api/v1/players/top10
  if (pathname === '/api/v1/players/top10' && method === 'GET') {
    handleTop10(query, res);
    return true;
  }

  // GET /api/v1/players/:slug
  var playersMatch = pathname.match(/^\/api\/v1\/players\/([^/]+)$/);
  if (playersMatch && method === 'GET') {
    var slug = decodeURIComponent(playersMatch[1]);
    handleProfile(slug, res);
    return true;
  }

  return false; // pas géré par ce module
}

// ── Auto-init si sqldb global dispo ────────────────────────────────────────
if (typeof sqldb !== 'undefined') {
  init(sqldb);
}

module.exports = { init: init, handleRequest: handleRequest };