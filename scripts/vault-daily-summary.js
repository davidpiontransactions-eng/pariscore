/**
 * PariScore — Vault Daily Summary
 *
 * Génère une note quotidienne dans le vault Obsidian :
 * - Top matches du jour (football, tennis)
 * - Value bets et sure bets
 * - Performance des modèles sur 7 jours
 * - Bankroll tracker
 *
 * SCHEDULING (PM2) : 0 5 * * * (05:00 UTC)
 *
 * USAGE:
 *   node scripts/vault-daily-summary.js              # Production
 *   node scripts/vault-daily-summary.js --dry         # Dry run (stdout only)
 *   node scripts/vault-daily-summary.js --date=2026-06-10  # Backfill date
 *
 * EXIT CODES:
 *   0 = OK
 *   1 = Erreur fatale
 *   2 = Aucun match trouvé (note générée quand même)
 *   3 = Erreur partielle
 */
'use strict';

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

// ── Config ──────────────────────────────────────────────────────────
const ROOT = path.join(__dirname, '..');
const ENV = {};
try {
  const envContent = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
  envContent.split('\n').forEach(line => {
    const m = line.match(/^([^=#]+)=(.*)$/);
    if (m) ENV[m[1].trim()] = m[2].trim();
  });
} catch (e) {
  console.error('[vault-daily] .env introuvable — abandon');
  process.exit(1);
}

const VAULT_PATH = ENV.VAULT_PATH;
if (!VAULT_PATH) {
  console.error('[vault-daily] VAULT_PATH absent du .env — abandon');
  process.exit(1);
}

const DB_PATH = ENV.DATABASE_PATH || path.join(ROOT, 'pariscore.db');
const isDry = process.argv.includes('--dry');

// Date handling
let targetDate = new Date();
const dateArg = process.argv.find(a => a.startsWith('--date='));
if (dateArg) {
  const parsed = new Date(dateArg.split('=')[1]);
  if (!isNaN(parsed.getTime())) targetDate = parsed;
}

const dateStr = targetDate.toISOString().split('T')[0]; // YYYY-MM-DD
const dayOfWeek = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'][targetDate.getDay()];
const dateFrench = `${dayOfWeek} ${targetDate.getDate()} ${['','Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'][targetDate.getMonth()]} ${targetDate.getFullYear()}`;

// ── Database ─────────────────────────────────────────────────────────
let db;
try {
  db = new Database(DB_PATH, { readonly: true });
  db.pragma('journal_mode = WAL');
} catch (e) {
  console.error(`[vault-daily] Erreur ouverture DB: ${e.message}`);
  process.exit(1);
}

// ── Helper: format date HH:MM ────────────────────────────────────────
function fmtTime(isoStr) {
  if (!isoStr) return '--:--';
  const d = new Date(isoStr);
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

// ── Helper: read JSON config ─────────────────────────────────────────
function readJSON(fileName) {
  try {
    return JSON.parse(fs.readFileSync(path.join(ROOT, fileName), 'utf8'));
  } catch { return null; }
}

// ── Data Sources ─────────────────────────────────────────────────────

// 1. Match count for today
function getMatchCount() {
  try {
    const row = db.prepare(`
      SELECT COUNT(*) as cnt FROM match_stats_history 
      WHERE match_date = ? AND home_score IS NULL
    `).get(dateStr);
    return row ? row.cnt : 0;
  } catch { return 0; }
}

// 2. Model accuracy (7-day from match_stats_history where scores exist)
function getModelAccuracy7d() {
  try {
    const rows = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN home_score IS NOT NULL AND away_score IS NOT NULL THEN 1 ELSE 0 END) as with_scores,
        ROUND(AVG(odds_home), 3) as avg_odds_home,
        ROUND(AVG(odds_draw), 3) as avg_odds_draw,
        ROUND(AVG(odds_away), 3) as avg_odds_away
      FROM match_stats_history 
      WHERE match_date >= date('now', '-7 days')
        AND match_date < date('now')
    `).get();
    
    // Calculate Over 2.5 accuracy from actual scores
    const over25 = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN (home_score + away_score) > 2.5 THEN 1 ELSE 0 END) as over_count
      FROM match_stats_history 
      WHERE match_date >= date('now', '-7 days')
        AND match_date < date('now')
        AND home_score IS NOT NULL
    `).get();

    // BTTS accuracy
    const btts = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN home_score > 0 AND away_score > 0 THEN 1 ELSE 0 END) as btts_count
      FROM match_stats_history 
      WHERE match_date >= date('now', '-7 days')
        AND match_date < date('now')
        AND home_score IS NOT NULL
    `).get();

    // Count matches with odds data (proxy for predictions made)
    const withOdds = db.prepare(`
      SELECT COUNT(*) as cnt FROM match_stats_history 
      WHERE match_date >= date('now', '-7 days')
        AND match_date < date('now')
        AND odds_home IS NOT NULL
    `).get();

    return {
      total: (rows && rows.total) || 0,
      withScores: (rows && rows.with_scores) || 0,
      over25Total: (over25 && over25.total) || 0,
      over25Correct: (over25 && over25.over_count) || 0,
      bttsTotal: (btts && btts.total) || 0,
      bttsCorrect: (btts && btts.btts_count) || 0,
      predictedMatches: (withOdds && withOdds.cnt) || 0
    };
  } catch (e) {
    console.warn('[vault-daily] Erreur accuracy:', e.message);
    return null;
  }
}

// 3. Bankroll data from user_bets
function getBankrollSummary() {
  try {
    const totalBets = db.prepare(`
      SELECT COUNT(*) as cnt FROM user_bets
    `).get();
    
    const weekBets = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'won' THEN 1 ELSE 0 END) as won,
        SUM(CASE WHEN status = 'lost' THEN 1 ELSE 0 END) as lost,
        ROUND(SUM(CASE WHEN status = 'won' THEN stake_cents ELSE 0 END) / 100.0, 2) as profit,
        ROUND(AVG(CASE WHEN status IN ('won','lost') THEN edge_pct ELSE NULL END), 2) as avg_edge
      FROM user_bets 
      WHERE created_at >= strftime('%s', 'now', '-7 days')
    `).get();

    // Total bankroll (sum of deposits minus withdrawals, plus net P&L)
    const bankroll = db.prepare(`
      SELECT 
        COALESCE(SUM(CASE WHEN kind = 'deposit' THEN amount_cents ELSE 0 END), 0) as deposits,
        COALESCE(SUM(CASE WHEN kind = 'withdrawal' THEN amount_cents ELSE 0 END), 0) as withdrawals
      FROM bankroll_transactions
    `).get();

    return {
      totalBets: (totalBets && totalBets.cnt) || 0,
      weekTotal: (weekBets && weekBets.total) || 0,
      weekWon: (weekBets && weekBets.won) || 0,
      weekLost: (weekBets && weekBets.lost) || 0,
      weekProfit: (weekBets && weekBets.profit) || 0,
      weekAvgEdge: (weekBets && weekBets.avg_edge) || 0,
      deposits: (bankroll && bankroll.deposits / 100) || 0,
      withdrawals: (bankroll && bankroll.withdrawals / 100) || 0
    };
  } catch (e) {
    console.warn('[vault-daily] Erreur bankroll:', e.message);
    return null;
  }
}

// 4. Guess today's top matches by reading upcoming match_stats_history
function getTopMatches() {
  try {
    const rows = db.prepare(`
      SELECT 
        match_date, home_team, away_team, bsd_league_id,
        odds_home, odds_draw, odds_away,
        odds_over_25, odds_btts_yes,
        home_xg, away_xg
      FROM match_stats_history 
      WHERE match_date = ?
        AND home_team IS NOT NULL
        AND odds_home IS NOT NULL
      ORDER BY odds_home ASC
      LIMIT 10
    `).all(dateStr);
    return rows;
  } catch { return []; }
}

// 5. Tennis matches today
function getTennisMatches() {
  try {
    const rows = db.prepare(`
      SELECT 
        match_date, winner_name as player1, loser_name as player2,
        tour, surface, tourney_name
      FROM tennis_matches_internal
      WHERE date(match_date / 1000, 'unixepoch') = ?
      LIMIT 10
    `).all(dateStr);
    return rows;
  } catch { return []; }
}

// 6. Config summary
function getConfigSummary() {
  const leagues = readJSON('leagues_config.json');
  const flags = readJSON('flags_config.json');
  
  const flagEntries = flags ? Object.entries(flags).filter(([k]) => !k.startsWith('_')).slice(0, 10) : [];
  const leagueEntries = leagues ? Object.entries(leagues).slice(0, 8) : [];
  
  return { flags: flagEntries, leagues: leagueEntries };
}

// ── Build markdown ───────────────────────────────────────────────────

function buildMarkdown() {
  const matchCount = getMatchCount();
  const accuracy = getModelAccuracy7d();
  const bankroll = getBankrollSummary();
  const topMatches = getTopMatches();
  const tennisMatches = getTennisMatches();
  const config = getConfigSummary();

  const lines = [];

  // Frontmatter
  lines.push('---');
  lines.push('type: daily');
  lines.push(`date: ${dateStr}`);
  lines.push(`generated_at: ${new Date().toISOString()}`);
  lines.push('sports:');
  if (topMatches.length > 0) lines.push('  - football');
  if (tennisMatches.length > 0) lines.push('  - tennis');
  lines.push(`match_count: ${matchCount}`);
  lines.push(`prediction_count: ${accuracy ? accuracy.predictedMatches : 0}`);
  lines.push(`model_accuracy_7d: ${accuracy && accuracy.withScores > 0 ? Math.round(accuracy.over25Correct / Math.max(accuracy.over25Total, 1) * 100) : 0}`);
  lines.push('---');
  lines.push('');
  lines.push(`# 📋 Résumé PariScore — ${dateFrench}`);
  lines.push('');

  // Section: Football
  lines.push('## ⚽ Football — Top Matches du Jour');
  lines.push('');
  if (topMatches.length === 0) {
    lines.push('📭 Aucun match programmé aujourd\'hui.');
  } else {
    lines.push('| Horaire | Match | Ligue | Prono 1 | Prono N | Prono 2 | Over 2.5 | BTTS |');
    lines.push('|---------|-------|-------|---------|---------|---------|----------|------|');
    for (const m of topMatches) {
      const time = fmtTime(m.match_date);
      const label = `${m.home_team} vs ${m.away_team}`.substring(0, 28);
      const o1 = m.odds_home ? (1 / m.odds_home * 100).toFixed(0) + '%' : '-';
      const oN = m.odds_draw ? (1 / m.odds_draw * 100).toFixed(0) + '%' : '-';
      const o2 = m.odds_away ? (1 / m.odds_away * 100).toFixed(0) + '%' : '-';
      const o25 = m.odds_over_25 ? 'Oui' : (m.odds_under_25 ? 'Non' : '-');
      const btts = m.odds_btts_yes ? 'Oui' : '-';
      lines.push(`| ${time} | ${label} | ${m.bsd_league_id || '-'} | ${o1} | ${oN} | ${o2} | ${o25} | ${btts} |`);
    }
  }
  lines.push('');

  // Section: Tennis
  if (tennisMatches.length > 0) {
    lines.push('## 🎾 Tennis — Matchs du Jour');
    lines.push('');
    lines.push('| Joueur 1 | Joueur 2 | Tournoi | Surface |');
    lines.push('|----------|----------|---------|---------|');
    for (const m of tennisMatches) {
      lines.push(`| ${m.player1} | ${m.player2} | ${m.tourney_name || m.tour || '-'} | ${m.surface || '-'} |`);
    }
    lines.push('');
  }

  // Section: Model Performance
  lines.push('## 📊 Performance des Modèles (7 jours)');
  lines.push('');
  if (accuracy && accuracy.withScores > 5) {
    const over25pct = accuracy.over25Total > 0 ? (accuracy.over25Correct / accuracy.over25Total * 100).toFixed(1) : 'N/A';
    const bttsPct = accuracy.bttsTotal > 0 ? (accuracy.bttsCorrect / accuracy.bttsTotal * 100).toFixed(1) : 'N/A';
    lines.push('| Métrique | Valeur |');
    lines.push('|----------|--------|');
    lines.push(`| Matchs avec scores | ${accuracy.withScores} |`);
    lines.push(`| Over 2.5 — Correct | ${accuracy.over25Correct}/${accuracy.over25Total} (${over25pct}%) |`);
    lines.push(`| BTTS — Correct | ${accuracy.bttsCorrect}/${accuracy.bttsTotal} (${bttsPct}%) |`);
    lines.push(`| Matchs avec prédictions | ${accuracy.predictedMatches} |`);
    lines.push(`| Échantillon total (7j) | ${accuracy.total} matchs |`);
  } else if (accuracy && accuracy.withScores > 0) {
    lines.push(`⚠️ Échantillon insuffisant (${accuracy.withScores} matchs) — données trop faibles pour une analyse fiable.`);
  } else {
    lines.push('📭 Aucun match terminé cette semaine.');
  }
  lines.push('');

  // Section: Bankroll
  lines.push('## 💰 Bankroll');
  lines.push('');
  if (bankroll) {
    const winRate = bankroll.weekTotal > 0 ? (bankroll.weekWon / bankroll.weekTotal * 100).toFixed(1) : 'N/A';
    const profitSign = bankroll.weekProfit >= 0 ? '+' : '';
    const bankrollTotal = bankroll.deposits - bankroll.withdrawals;
    lines.push('| Métrique | Valeur |');
    lines.push('|----------|--------|');
    lines.push(`| Bankroll totale | ${bankrollTotal.toFixed(0)} € |`);
    lines.push(`| P&L semaine | ${profitSign}${bankroll.weekProfit.toFixed(1)} u |`);
    lines.push(`| Win rate (7j) | ${winRate}% |`);
    lines.push(`| Paris cette semaine | ${bankroll.weekTotal} |`);
    if (bankroll.weekAvgEdge) {
      lines.push(`| Edge moyen | ${bankroll.weekAvgEdge.toFixed(1)}% |`);
    }
  } else {
    lines.push('📭 Données bankroll non disponibles.');
  }
  lines.push('');

  // Section: Config Snapshot
  if (config.flags.length > 0 || config.leagues.length > 0) {
    lines.push('## ⚙️ Configuration Active');
    lines.push('');
    if (config.flags.length > 0) {
      lines.push('| Feature | Statut |');
      lines.push('|---------|--------|');
      for (const [k, v] of config.flags) {
        lines.push(`| ${k} | ${v ? '✅' : '❌'} |`);
      }
    }
    lines.push('');
  }

  // Footer
  lines.push('---');
  lines.push('');
  lines.push(`_Généré automatiquement à ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}_`);
  lines.push('');
  lines.push('<!-- Les résultats des matchs du jour seront disponibles demain -->');

  return lines.join('\n');
}

// ── Main ─────────────────────────────────────────────────────────────

try {
  const markdown = buildMarkdown();

  if (isDry) {
    console.log(markdown);
    console.error(`[vault-daily] ✅ Dry run — note générée (${markdown.length} caractères)`);
    process.exit(0);
  }

  // Ensure vault daily directory
  const dailyDir = path.join(VAULT_PATH, 'daily');
  if (!fs.existsSync(dailyDir)) {
    fs.mkdirSync(dailyDir, { recursive: true });
  }

  const outputPath = path.join(dailyDir, `${dateStr}.md`);
  fs.writeFileSync(outputPath, markdown, 'utf8');
  console.error(`[vault-daily] ✅ Note écrite: ${outputPath} (${markdown.length} caractères)`);

  // Determine exit code
  const matchCount = getMatchCount();
  if (matchCount === 0) {
    process.exit(2);
  }

  process.exit(0);
} catch (e) {
  console.error(`[vault-daily] ❌ Erreur fatale: ${e.message}`);
  process.exit(1);
} finally {
  if (db) db.close();
}
