#!/usr/bin/env node
/**
 * etl-history-matches.js — ETL standalone pour peupler kv['history_matches']
 * au format CatBoost, sans boot du serveur complet.
 *
 * Sources :
 *   --source=db    : lit kv['history_matches'] depuis pariscore.db (défaut)
 *   --source=file  : lit un ou plusieurs JSON de backtest (football-data.co.uk)
 *                    depuis public/data/backtest/{league}/{season}.json
 *   --source=both  : fusionne DB + fichiers backtest (dedup par id)
 *
 * Sortie : INSERT OR REPLACE INTO kv (key, value) VALUES ('history_matches', ?)
 *
 * Flags :
 *   --source=file|db|both   Source de données (défaut: db)
 *   --min-verified=true     Filtrer uniquement les matchs verified (défaut: true)
 *   --limit=N               Limiter le nombre de records transformés
 *   --dry-run               Afficher les stats sans écrire en base
 *   --db=PATH               Chemin vers pariscore.db (défaut: ./pariscore.db)
 *   --backtest-dir=PATH     Dossier backtest (défaut: ./public/data/backtest)
 *   --output-db=PATH        DB de sortie (défaut: même que --db)
 *
 * Usage :
 *   node scripts/etl-history-matches.js --source=db
 *   node scripts/etl-history-matches.js --source=file --backtest-dir=./public/data/backtest
 *   node scripts/etl-history-matches.js --source=both --limit=5000 --dry-run
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import Database from 'better-sqlite3';

// ── CLI args ──────────────────────────────────────────────────────────────────

const { values: args } = parseArgs({
  options: {
    source:         { type: 'string',  default: 'db' },
    'min-verified': { type: 'string',  default: 'true' },
    limit:          { type: 'string',  default: '0' },
    'dry-run':      { type: 'boolean', default: false },
    db:             { type: 'string',  default: '' },
    'backtest-dir': { type: 'string',  default: '' },
    'output-db':    { type: 'string',  default: '' },
    help:           { type: 'boolean', default: false },
  },
  strict: false,
});

if (args.help) {
  console.log(`
Usage: node scripts/etl-history-matches.js [OPTIONS]

Flags:
  --source=file|db|both   Source de données (défaut: db)
  --min-verified=true     Filtrer uniquement verified (défaut: true)
  --limit=N               Limiter le nombre de records (0 = illimité)
  --dry-run               Stats sans écriture
  --db=PATH               DB source (défaut: ./pariscore.db)
  --backtest-dir=PATH     Dossier backtest JSON (défaut: ./public/data/backtest)
  --output-db=PATH        DB de sortie (défaut: même que --db)
  --help                  Afficher l'aide
`);
  process.exit(0);
}

const ROOT = resolve(import.meta.dirname, '..');
const SOURCE = args.source;
const MIN_VERIFIED = args['min-verified'] === 'true';
const LIMIT = parseInt(args.limit, 10) || 0;
const DRY_RUN = args['dry-run'];
const DB_PATH = args.db ? resolve(args.db) : join(ROOT, 'pariscore.db');
const BACKTEST_DIR = args['backtest-dir'] ? resolve(args['backtest-dir']) : join(ROOT, 'public', 'data', 'backtest');
const OUTPUT_DB_PATH = args['output-db'] ? resolve(args['output-db']) : DB_PATH;

// ── Validation ────────────────────────────────────────────────────────────────

if (!['file', 'db', 'both'].includes(SOURCE)) {
  console.error(`[ETL] Source invalide: "${SOURCE}" — utiliser file, db, ou both`);
  process.exit(1);
}

if (!existsSync(DB_PATH)) {
  console.error(`[ETL] DB introuvable: ${DB_PATH}`);
  process.exit(1);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Dé-vig les cotes 1X2 pour obtenir des probabilités « justes » (no-vig).
 * @param {number} oddsH Cote home
 * @param {number} oddsD Cote draw
 * @param {number} oddsA Cote away
 * @returns {{ home: number, draw: number, away: number }} Probabilités 0-1
 */
function deVigOdds(oddsH, oddsD, oddsA) {
  if (!oddsH || !oddsD || !oddsA || oddsH <= 1 || oddsD <= 1 || oddsA <= 1) {
    return null;
  }
  const impliedH = 1 / oddsH;
  const impliedD = 1 / oddsD;
  const impliedA = 1 / oddsA;
  const total = impliedH + impliedD + impliedA;
  if (total <= 0) return null;
  return {
    home: impliedH / total,
    draw: impliedD / total,
    away: impliedA / total,
  };
}

/**
 * Estime les probabilités Poisson 1X2 à partir des probabilités fair.
 * Utilise la méthode de moyenne pondérée pour inverser le modèle de Poisson
 * (approximation cohérente avec les probabilités de marché dé-viggées).
 * @param {number} pHome Probabilité fair home (0-1)
 * @param {number} pDraw Probabilité fair draw (0-1)
 * @param {number} pAway Probabilité fair away (0-1)
 * @returns {object} Poisson snapshot (valeurs 0-100)
 */
function estimatePoissonFromFair(pHome, pDraw, pAway) {
  if (pHome == null || pDraw == null || pAway == null) return null;

  // Converting fair probs → Poisson λ approximation
  // Using the relationship: for low-scoring football, draw prob ≈ e^(-2λ)
  // More robust: use Newton iteration to find λ_home, λ_away from 1X2 probs
  // Simplified: λ_home ≈ -ln(1 - pHome), λ_away ≈ -ln(1 - pAway)
  // But we need a proper Poisson 1X2 match — use the fair probs directly
  // as Poisson snapshot since the CatBoost model learns the mapping.

  // Estimation over/under via goals expectation
  // E[goals] ≈ -ln(pDraw) (from Poisson draw probability = e^(-λ) * λ^0 / 0! for λ_home=λ_away=λ)
  // More accurate: use the over/under relationship from 1X2
  const pHomeScaled = pHome * 100;
  const pDrawScaled = pDraw * 100;
  const pAwayScaled = pAway * 100;

  // Over 2.5 ≈ 1 - P(0) - P(1) - P(2) where P(n) = e^(-μ) * μ^n / n!
  // Approximation: Over25 ≈ 100 - (pDraw * 100 * 1.5) — crude but correlated
  // Better: use the empirical relationship O25 ≈ pHome * 0.6 + pAway * 0.4 + pDraw * 0.3
  const expectedGoals = -Math.log(Math.max(pDraw, 0.01)) * 1.2;
  const pOver25 = Math.min(95, Math.max(5, (1 - poissonCdf(2, expectedGoals)) * 100));
  const pOver15 = Math.min(98, Math.max(5, (1 - poissonCdf(1, expectedGoals)) * 100));

  // BTTS approximation: both teams score ≈ 1 - P(home 0) * P(away 0)
  // P(home 0) ≈ e^(-λ_home), P(away 0) ≈ e^(-λ_away)
  const lambdaHome = Math.max(0.3, -Math.log(Math.max(pAway, 0.01)) * 0.8);
  const lambdaAway = Math.max(0.3, -Math.log(Math.max(pHome, 0.01)) * 0.8);
  const pBtts = (1 - Math.exp(-lambdaHome)) * (1 - Math.exp(-lambdaAway)) * 100;

  // Clean sheet 0-0 ≈ e^(-(λ_home + λ_away))
  const pCs00 = Math.exp(-(lambdaHome + lambdaAway)) * 100;

  return {
    homeWin:  Math.round(pHomeScaled * 10) / 10,
    draw:     Math.round(pDrawScaled * 10) / 10,
    awayWin:  Math.round(pAwayScaled * 10) / 10,
    over25:   Math.round(pOver25 * 10) / 10,
    over15:   Math.round(pOver15 * 10) / 10,
    btts:     Math.round(pBtts * 10) / 10,
    cs00:     Math.round(pCs00 * 10) / 10,
  };
}

/** CDF de Poisson : P(X ≤ k) pour X ~ Poisson(λ) */
function poissonCdf(k, lambda) {
  let sum = 0;
  for (let i = 0; i <= k; i++) {
    sum += Math.exp(-lambda + i * Math.log(lambda) - logFactorial(i));
  }
  return Math.min(1, Math.max(0, sum));
}

function logFactorial(n) {
  if (n <= 1) return 0;
  let r = 0;
  for (let i = 2; i <= n; i++) r += Math.log(i);
  return r;
}

/**
 * Transforme un record archive_matches (in-memory server.js) → CatBoost format.
 */
function transformArchiveRecord(r) {
  if (!r) return null;
  const id = r.id || `archive-${r.home_team}-${r.away_team}-${r.commence_time}`;
  const homeScore = r.realScore?.home ?? r.home_score ?? null;
  const awayScore = r.realScore?.away ?? r.away_score ?? null;
  const verified = r.verified === true || (homeScore != null && awayScore != null);

  return {
    id,
    home_team: r.home_team || 'Unknown',
    away_team: r.away_team || 'Unknown',
    league: r.league || 'Unknown',
    sport: r.sport || 'football',
    commence_time: r.commence_time || null,
    predicted: {
      poisson_snapshot: r.predicted?.poisson_snapshot || null,
      fair: r.predicted?.fair || null,
      over25: r.predicted?.over25 ?? null,
      btts: r.predicted?.btts ?? null,
      bestEdge: r.predicted?.bestEdge ?? null,
      bestEdgeValue: r.predicted?.bestEdgeValue ?? null,
    },
    realScore: (homeScore != null && awayScore != null)
      ? { home: homeScore, away: awayScore, source: r.realScore?.source || r._source || 'etl', verified: true }
      : null,
    verified,
    archived_at: r.archived_at || new Date().toISOString(),
  };
}

/**
 * Transforme un match backtest (football-data.co.uk) → CatBoost format.
 * Les cotes close sont dé-viggées pour produire fair + poisson_snapshot.
 */
function transformBacktestMatch(m, leagueSlug, season) {
  if (!m) return null;
  const id = `bt-${leagueSlug}-${season}-${m.date}-${m.homeTeam}-${m.awayTeam}`;
  const hasScore = m.fthg != null && m.ftag != null;

  // Extraire cotes 1X2 fermeture (avg ou max ou B365)
  const close = m.odds?.close || {};
  const oddsH = close.avgh || close.maxh || close.b365h || close.psh || null;
  const oddsD = close.avgd || close.maxd || close.b365d || close.psd || null;
  const oddsA = close.avga || close.maxa || close.b365a || close.psa || null;

  // Dé-vig → fair probs
  const fair = deVigOdds(oddsH, oddsD, oddsA);

  // Estimer Poisson snapshot depuis fair
  const poissonSnapshot = fair
    ? estimatePoissonFromFair(fair.home, fair.draw, fair.away)
    : null;

  return {
    id,
    home_team: m.homeTeam || 'Unknown',
    away_team: m.awayTeam || 'Unknown',
    league: leagueSlug || 'Unknown',
    sport: 'football',
    commence_time: m.date ? `${m.date}T20:00:00Z` : null,
    predicted: {
      poisson_snapshot: poissonSnapshot,
      fair: fair ? { home: fair.home, draw: fair.draw, away: fair.away } : null,
      over25: poissonSnapshot?.over25 ?? null,
      btts: poissonSnapshot?.btts ?? null,
      bestEdge: null,
      bestEdgeValue: null,
    },
    realScore: hasScore
      ? { home: m.fthg, away: m.ftag, source: 'football-data.co.uk', verified: true }
      : null,
    verified: hasScore,
    archived_at: new Date().toISOString(),
    _backtest: {
      season,
      ftr: m.ftr || null,
      referee: m.referee || null,
      stats: {
        hs: m.hs ?? null, as: m.as ?? null,
        hst: m.hst ?? null, ast: m.ast ?? null,
        hc: m.hc ?? null, ac: m.ac ?? null,
      },
    },
  };
}

// ── Source: DB ────────────────────────────────────────────────────────────────

function loadFromDB(dbPath) {
  console.log(`[ETL] Lecture DB: ${dbPath}`);
  const db = new Database(dbPath, { readonly: true });
  try {
    const row = db.prepare("SELECT value FROM kv WHERE key = 'history_matches'").get();
    if (!row) {
      console.log('[ETL] Aucun history_matches trouvé dans la DB');
      return [];
    }
    const records = JSON.parse(row.value);
    console.log(`[ETL] ${records.length} records lus depuis la DB`);
    return records;
  } finally {
    db.close();
  }
}

// ── Source: Fichiers backtest ─────────────────────────────────────────────────

function loadFromBacktest(backtestDir) {
  console.log(`[ETL] Lecture backtest: ${backtestDir}`);
  const records = [];

  if (!existsSync(backtestDir)) {
    console.log(`[ETL] Dossier backtest introuvable: ${backtestDir}`);
    return records;
  }

  // Parcourir les sous-dossiers ligue
  const leagues = readdirSync(backtestDir).filter(d => {
    try { return statSync(join(backtestDir, d)).isDirectory(); }
    catch { return false; }
  });

  for (const league of leagues) {
    const leagueDir = join(backtestDir, league);
    const files = readdirSync(leagueDir).filter(f => f.endsWith('.json'));

    for (const file of files) {
      const season = parseInt(file.replace('.json', ''), 10);
      const filePath = join(leagueDir, file);
      try {
        const data = JSON.parse(readFileSync(filePath, 'utf8'));
        const matches = data.matches || [];
        for (const m of matches) {
          const record = transformBacktestMatch(m, league, season);
          if (record) records.push(record);
        }
        console.log(`  [ok] ${league}/${season}: ${matches.length} matchs`);
      } catch (e) {
        console.warn(`  [!!] ${league}/${file}: ${e.message}`);
      }
    }
  }

  console.log(`[ETL] ${records.length} records transformés depuis les fichiers backtest`);
  return records;
}

// ── Fusion + dédup + filtrage ─────────────────────────────────────────────────

function mergeAndFilter(dbRecords, fileRecords, { minVerified, limit }) {
  // Indexer par id pour dédup
  const seen = new Map();

  // Priorité aux records DB (ils peuvent avoir poisson_snapshot du serveur)
  for (const r of dbRecords) {
    const id = r.id || `db-${r.home_team}-${r.away_team}-${r.commence_time}`;
    if (!seen.has(id)) seen.set(id, r);
  }

  // Ajouter les records fichier (pas d'écrasement si déjà présent)
  for (const r of fileRecords) {
    if (!seen.has(r.id)) seen.set(r.id, r);
  }

  let merged = Array.from(seen.values());

  // Filtrage verified
  if (minVerified) {
    merged = merged.filter(r => r.verified === true && r.realScore != null);
  }

  // Filtrer football uniquement (exclure tennis)
  merged = merged.filter(r => {
    const id = String(r.id || '').toLowerCase();
    const league = String(r.league || '').toLowerCase();
    return !id.includes('tennis') && !league.includes('tennis');
  });

  // Trier par date
  merged.sort((a, b) => {
    const da = a.commence_time || '';
    const db2 = b.commence_time || '';
    return da.localeCompare(db2);
  });

  // Limiter
  if (limit > 0 && merged.length > limit) {
    merged = merged.slice(-limit); // Garder les plus récents
  }

  return merged;
}

// ── Stats ─────────────────────────────────────────────────────────────────────

function printStats(records) {
  const total = records.length;
  const verified = records.filter(r => r.verified).length;
  const withPoisson = records.filter(r => r.predicted?.poisson_snapshot?.homeWin != null).length;
  const withFair = records.filter(r => r.predicted?.fair?.home != null).length;
  const withScore = records.filter(r => r.realScore?.home != null).length;

  // Plage de dates
  const dates = records
    .map(r => r.commence_time)
    .filter(Boolean)
    .sort();
  const dateMin = dates[0] || 'N/A';
  const dateMax = dates[dates.length - 1] || 'N/A';

  // Ligues
  const leagues = new Set(records.map(r => r.league).filter(Boolean));

  console.log('\n═══════════════════════════════════════════════');
  console.log('  ETL History Matches — Statistiques');
  console.log('═══════════════════════════════════════════════');
  console.log(`  Total records       : ${total}`);
  console.log(`  Verified            : ${verified} (${total ? ((verified / total) * 100).toFixed(1) : 0}%)`);
  console.log(`  Avec poisson_snap   : ${withPoisson} (${total ? ((withPoisson / total) * 100).toFixed(1) : 0}%)`);
  console.log(`  Avec fair probs     : ${withFair} (${total ? ((withFair / total) * 100).toFixed(1) : 0}%)`);
  console.log(`  Avec realScore      : ${withScore}`);
  console.log(`  Ligues              : ${leagues.size} (${Array.from(leagues).slice(0, 8).join(', ')}${leagues.size > 8 ? '…' : ''})`);
  console.log(`  Date min            : ${dateMin}`);
  console.log(`  Date max            : ${dateMax}`);
  console.log('═══════════════════════════════════════════════\n');
}

// ── Main ──────────────────────────────────────────────────────────────────────

function main() {
  console.log(`[ETL] Source: ${SOURCE} | Verified: ${MIN_VERIFIED} | Limit: ${LIMIT || '∞'} | Dry-run: ${DRY_RUN}`);

  let dbRecords = [];
  let fileRecords = [];

  if (SOURCE === 'db' || SOURCE === 'both') {
    dbRecords = loadFromDB(DB_PATH);
  }
  if (SOURCE === 'file' || SOURCE === 'both') {
    fileRecords = loadFromBacktest(BACKTEST_DIR);
  }

  const records = mergeAndFilter(dbRecords, fileRecords, {
    minVerified: MIN_VERIFIED,
    limit: LIMIT,
  });

  printStats(records);

  if (DRY_RUN) {
    console.log('[ETL] Dry-run — aucune écriture effectuée');
    // Afficher un échantillon
    if (records.length > 0) {
      const sample = records[records.length - 1];
      console.log('[ETL] Dernier record (échantillon):');
      console.log(JSON.stringify(sample, null, 2).slice(0, 1500));
    }
    return;
  }

  // Écriture en base
  console.log(`[ETL] Écriture dans ${OUTPUT_DB_PATH}…`);
  const outDb = new Database(OUTPUT_DB_PATH);
  try {
    outDb.pragma('journal_mode = WAL');
    outDb.pragma('busy_timeout = 5000');

    // S'assurer que la table kv existe
    outDb.exec("CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL)");

    const jsonValue = JSON.stringify(records);
    outDb.prepare("INSERT OR REPLACE INTO kv (key, value) VALUES ('history_matches', ?)").run(jsonValue);

    // Recalculer l'accuracy
    const acc = {
      total: 0,
      over25_correct: 0, over25_total: 0,
      btts_correct: 0, btts_total: 0,
      edge_correct: 0, edge_total: 0,
    };
    for (const r of records) {
      if (!r.verified || !r.realScore) continue;
      acc.total++;
      const hg = r.realScore.home;
      const ag = r.realScore.away;
      const totalGoals = hg + ag;
      const wasOver25 = totalGoals > 2.5;
      const wasBTTS = hg > 0 && ag > 0;
      if (r.predicted?.over25 > 55) { acc.over25_total++; if (wasOver25) acc.over25_correct++; }
      if (r.predicted?.btts > 55) { acc.btts_total++; if (wasBTTS) acc.btts_correct++; }
      if (r.predicted?.bestEdgeValue > 5) {
        acc.edge_total++;
        const winner = hg > ag ? r.home_team : ag > hg ? r.away_team : 'Nul';
        if (winner === r.predicted.bestEdge) acc.edge_correct++;
      }
    }
    outDb.prepare("INSERT OR REPLACE INTO kv (key, value) VALUES ('history_accuracy', ?)").run(JSON.stringify(acc));

    console.log(`[ETL] ✓ ${records.length} records écrits dans kv['history_matches']`);
    console.log(`[ETL] ✓ Accuracy recalculée : ${acc.total} matchs vérifiés`);
  } finally {
    outDb.close();
  }
}

main();
