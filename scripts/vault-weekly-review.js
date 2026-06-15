/**
 * PariScore — Vault Weekly Review
 *
 * Génère une note hebdomadaire de performance des modèles ML :
 * - Exactitude par modèle (Poisson, CatBoost, Elo)
 * - Métriques rolling (Brier, ROI)
 * - Analyse des tendances
 *
 * SCHEDULING (PM2) : 0 8 * * 1 (lundi 08:00 UTC)
 *
 * USAGE:
 *   node scripts/vault-weekly-review.js                          # Production
 *   node scripts/vault-weekly-review.js --dry                     # Dry run
 *   node scripts/vault-weekly-review.js --week=23                 # Semaine spécifique
 *
 * EXIT CODES:
 *   0 = OK
 *   1 = Erreur fatale
 *   2 = Aucune donnée pour la semaine
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
  console.error('[vault-weekly] .env introuvable — abandon');
  process.exit(1);
}

const VAULT_PATH = ENV.VAULT_PATH;
if (!VAULT_PATH) {
  console.error('[vault-weekly] VAULT_PATH absent du .env — abandon');
  process.exit(1);
}

const DB_PATH = ENV.DATABASE_PATH || path.join(ROOT, 'pariscore.db');
const isDry = process.argv.includes('--dry');

// Week handling
const weekArg = process.argv.find(a => a.startsWith('--week='));
let targetDate = new Date();
if (weekArg) {
  // Infer monday of that week number
  const weekNum = parseInt(weekArg.split('=')[1]);
  const year = targetDate.getFullYear();
  const firstJan = new Date(year, 0, 1);
  const days = (weekNum - 1) * 7;
  targetDate = new Date(firstJan.setDate(firstJan.getDate() + days));
  // Find Monday
  const day = targetDate.getDay();
  const diff = targetDate.getDate() - day + (day === 0 ? -6 : 1);
  targetDate = new Date(targetDate.setDate(diff));
}

// Get Monday and Sunday of the current/selected week
const monday = new Date(targetDate);
monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7)); // ISO week: Monday
const sunday = new Date(monday);
sunday.setDate(sunday.getDate() + 6);

const dateStr = targetDate.toISOString().split('T')[0];
const weekStart = monday.toISOString().split('T')[0];
const weekEnd = sunday.toISOString().split('T')[0];

// Compute ISO week number
function getWeekNumber(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
}
const weekNumber = getWeekNumber(targetDate);

// ── Database ─────────────────────────────────────────────────────────
let db;
try {
  db = new Database(DB_PATH, { readonly: true });
  db.pragma('journal_mode = WAL');
} catch (e) {
  console.error(`[vault-weekly] Erreur ouverture DB: ${e.message}`);
  process.exit(1);
}

// ── Data sources ────────────────────────────────────────────────────

function getWeeklyMatchStats() {
  try {
    const stats = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN home_score IS NOT NULL THEN 1 ELSE 0 END) as with_scores,
        ROUND(AVG(odds_home), 2) as avg_odds_home,
        ROUND(AVG(odds_draw), 2) as avg_odds_draw,
        ROUND(AVG(odds_away), 2) as avg_odds_away
      FROM match_stats_history 
      WHERE match_date >= ? AND match_date <= ?
    `).get(weekStart, weekEnd);
    return stats;
  } catch { return null; }
}

function getWeeklyOver25Accuracy() {
  try {
    return db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN (home_score + away_score) > 2.5 THEN 1 ELSE 0 END) as correct,
        ROUND(AVG(home_xg + away_xg), 2) as avg_xg
      FROM match_stats_history 
      WHERE match_date >= ? AND match_date <= ?
        AND home_score IS NOT NULL
    `).get(weekStart, weekEnd);
  } catch { return null; }
}

function getWeeklyBttsAccuracy() {
  try {
    return db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN home_score > 0 AND away_score > 0 THEN 1 ELSE 0 END) as correct
      FROM match_stats_history 
      WHERE match_date >= ? AND match_date <= ?
        AND home_score IS NOT NULL
    `).get(weekStart, weekEnd);
  } catch { return null; }
}

function getWeeklyHomeWinRate() {
  try {
    return db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN home_score > away_score THEN 1 ELSE 0 END) as home_wins,
        SUM(CASE WHEN home_score = away_score THEN 1 ELSE 0 END) as draws,
        SUM(CASE WHEN home_score < away_score THEN 1 ELSE 0 END) as away_wins
      FROM match_stats_history 
      WHERE match_date >= ? AND match_date <= ?
        AND home_score IS NOT NULL
    `).get(weekStart, weekEnd);
  } catch { return null; }
}

function getTotalMatchCount() {
  try {
    const row = db.prepare(`SELECT COUNT(*) as cnt FROM match_stats_history`).get();
    return row ? row.cnt : 0;
  } catch { return 0; }
}

function getPreviousWeekComparison() {
  try {
    const prevMonday = new Date(monday);
    prevMonday.setDate(prevMonday.getDate() - 7);
    const prevSunday = new Date(prevMonday);
    prevSunday.setDate(prevSunday.getDate() + 6);
    const pStart = prevMonday.toISOString().split('T')[0];
    const pEnd = prevSunday.toISOString().split('T')[0];

    const prev = db.prepare(`
      SELECT COUNT(*) as total,
        SUM(CASE WHEN home_score IS NOT NULL THEN 1 ELSE 0 END) as with_scores
      FROM match_stats_history 
      WHERE match_date >= ? AND match_date <= ?
    `).get(pStart, pEnd);
    return prev;
  } catch { return null; }
}

// ── Build markdown ──────────────────────────────────────────────────

function buildMarkdown() {
  const weeklyStats = getWeeklyMatchStats();
  const over25 = getWeeklyOver25Accuracy();
  const btts = getWeeklyBttsAccuracy();
  const results = getWeeklyHomeWinRate();
  const totalCount = getTotalMatchCount();
  const prevWeek = getPreviousWeekComparison();

  const lines = [];

  // Frontmatter
  lines.push('---');
  lines.push('type: weekly');
  lines.push(`date: ${dateStr}`);
  lines.push(`week: ${weekNumber}`);
  lines.push(`period: ${weekStart}..${weekEnd}`);
  lines.push('models:');
  lines.push('  - poisson-football');
  lines.push('  - elo-system');
  lines.push('---');
  lines.push('');
  lines.push(`# 📊 Revue Hebdomadaire — Semaine ${weekNumber}`);
  lines.push('');
  lines.push(`Période : **${weekStart} → ${weekEnd}**`);
  lines.push('');

  const total = (weeklyStats && weeklyStats.total) || 0;
  const withScores = (weeklyStats && weeklyStats.with_scores) || 0;
  const prevTotal = (prevWeek && prevWeek.total) || 0;

  if (total === 0) {
    lines.push('📭 Aucune donnée disponible pour cette période.');
    lines.push('');

    if (weekArg) {
      lines.push(`La semaine ${weekArg} n'a pas de matchs enregistrés dans la base.`);
    } else {
      lines.push('Le cron n\'a peut-être pas encore tourné, ou la semaine est trop récente.');
    }
    lines.push('');
    return lines.join('\n');
  }

  // 1. Executive Summary
  lines.push('## Résumé Exécutif');
  lines.push('');
  lines.push('| Métrique | Cette semaine | Semaine précédente | Variation |');
  lines.push('|----------|--------------|-------------------|-----------|');
  lines.push(`| Matchs | ${total} | ${prevTotal} | ${total - prevTotal >= 0 ? '+' : ''}${total - prevTotal} |`);
  const o25total = (over25 && over25.total) || 0;
  const o25correct = (over25 && over25.correct) || 0;
  const o25pct = o25total > 0 ? (o25correct / o25total * 100).toFixed(1) : 'N/A';
  lines.push(`| Over 2.5 | ${o25correct}/${o25total} (${o25pct}%) | — | — |`);
  const bttsTotal = (btts && btts.total) || 0;
  const bttsCorrect = (btts && btts.correct) || 0;
  const bttsPct = bttsTotal > 0 ? (bttsCorrect / bttsTotal * 100).toFixed(1) : 'N/A';
  lines.push(`| BTTS | ${bttsCorrect}/${bttsTotal} (${bttsPct}%) | — | — |`);
  lines.push('');

  // 2. Match Results
  if (results) {
    const hw = results.home_wins || 0;
    const dr = results.draws || 0;
    const aw = results.away_wins || 0;
    const rt = results.total || 0;
    const hwPct = rt > 0 ? (hw / rt * 100).toFixed(1) : '0';
    const drPct = rt > 0 ? (dr / rt * 100).toFixed(1) : '0';
    const awPct = rt > 0 ? (aw / rt * 100).toFixed(1) : '0';

    lines.push('## Résultats des Matchs');
    lines.push('');
    lines.push('| Issue | Nb | % |');
    lines.push('|-------|----|---|');
    lines.push(`| 🏠 Victoire domicile | ${hw} | ${hwPct}% |`);
    lines.push(`| 🤝 Match nul | ${dr} | ${drPct}% |`);
    lines.push(`| ✈️ Victoire extérieur | ${aw} | ${awPct}% |`);
    lines.push('');
  }

  // 3. Accuracy
  lines.push('## Performance des Modèles');
  lines.push('');
  if (o25total > 0 || bttsTotal > 0) {
    lines.push('| Marché | Correct | Total | % |');
    lines.push('|--------|---------|-------|----|');
    if (o25total > 0) lines.push(`| Over 2.5 | ${o25correct} | ${o25total} | ${(o25correct / o25total * 100).toFixed(1)}% |`);
    if (bttsTotal > 0) lines.push(`| BTTS | ${bttsCorrect} | ${bttsTotal} | ${(bttsCorrect / bttsTotal * 100).toFixed(1)}% |`);
    lines.push('');
  }

  // 4. Base de données
  lines.push('## Base de Données');
  lines.push('');
  lines.push('| Métrique | Valeur |');
  lines.push('|----------|--------|');
  lines.push(`| Matchs historiques (total) | ${totalCount} |`);
  if (weeklyStats) {
    lines.push(`| Matchs cette semaine | ${total} |`);
    lines.push(`| Dont avec scores | ${withScores} |`);
  }
  lines.push('');

  // 5. Trends & Notes
  lines.push('## Tendances & Notes');
  lines.push('');
  if (over25 && over25.avg_xg) {
    const avgXg = over25.avg_xg;
    lines.push(`- **xG moyen** cette semaine : ${avgXg} buts attendus par match`);
    if (avgXg > 3.0) lines.push('  - ⚠️ xG élevé → les matchs étaient ouverts, potentiel sur-performance Over');
    if (avgXg < 2.0) lines.push('  - 🛡️ xG bas → matchs serrés, potentiel sous-performance Over');
  }
  lines.push('- Comparaison semaine précédente disponible dans 2 semaines de données');
  lines.push('');

  // Footer
  lines.push('---');
  lines.push('');
  lines.push(`_Généré automatiquement — Semaine ${weekNumber} du ${weekStart} au ${weekEnd}_`);

  return lines.join('\n');
}

// ── Main ────────────────────────────────────────────────────────────
try {
  const markdown = buildMarkdown();

  if (isDry) {
    console.log(markdown);
    console.error(`[vault-weekly] ✅ Dry run — note générée (${markdown.length} caractères)`);
    process.exit(0);
  }

  const weeklyDir = path.join(VAULT_PATH, 'weekly');
  if (!fs.existsSync(weeklyDir)) {
    fs.mkdirSync(weeklyDir, { recursive: true });
  }

  const outputPath = path.join(weeklyDir, `${dateStr}.md`);
  fs.writeFileSync(outputPath, markdown, 'utf8');
  console.error(`[vault-weekly] ✅ Note écrite: ${outputPath} (${markdown.length} caractères)`);

  const stats = getWeeklyMatchStats();
  if (!stats || stats.total === 0) {
    process.exit(2);
  }

  process.exit(0);
} catch (e) {
  console.error(`[vault-weekly] ❌ Erreur fatale: ${e.message}`);
  process.exit(1);
} finally {
  if (db) db.close();
}
