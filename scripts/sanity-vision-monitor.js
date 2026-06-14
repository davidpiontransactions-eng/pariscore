/**
 * sanity-vision-monitor.js — Moniteur de santé des teamStats PariScore
 * 
 * Lit db_team_stats depuis la base SQLite (table kv), exécute les mêmes
 * vérifications que sanityCheckTeamStats(), et produit un rapport JSON.
 * 
 * Usage :
 *   node scripts/sanity-vision-monitor.js                          # Rapport console
 *   node scripts/sanity-vision-monitor.js --json                   # JSON stdout
 *   node scripts/sanity-vision-monitor.js --json --out report.json # Fichier JSON
 *   node scripts/sanity-vision-monitor.js --gstack                 # + capture gstack-browse
 *   node scripts/sanity-vision-monitor.js --watch                  # Toutes les 30min
 *   node scripts/sanity-vision-monitor.js --watch --interval 15    # Toutes les 15min
 * 
 * Codes de sortie : 0 = OK, 1 = anomalies détectées, 2 = erreur critique
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const REPORTS_DIR = path.join(ROOT, '.context', 'sanity-reports');
const DEFAULT_INTERVAL_MIN = 30;
const HEALTHY_PPG_THRESHOLD = 5; // played > N considered anomalous if ppg===0
const MAX_TEAMS_IN_REPORT = 20;

// ── CLI flags ─────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const FLAGS = {
  json:    args.includes('--json'),
  watch:   args.includes('--watch'),
  gstack:  args.includes('--gstack'),
  out:     null,
  interval: DEFAULT_INTERVAL_MIN,
};
const outIdx = args.indexOf('--out');
if (outIdx !== -1 && args[outIdx + 1]) FLAGS.out = args[outIdx + 1];
const intIdx = args.indexOf('--interval');
if (intIdx !== -1 && args[intIdx + 1]) FLAGS.interval = parseInt(args[intIdx + 1], 10) || DEFAULT_INTERVAL_MIN;

// ── Help ──────────────────────────────────────────────────────────────────
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
  Sanity Vision Monitor — PariScore teamStats health checker

  Usage:
    node scripts/sanity-vision-monitor.js [flags]

  Flags:
    --json               Output JSON report to stdout
    --out <file>         Write JSON report to file
    --gstack             Use gstack-browse for visual screenshot captures
    --watch              Run periodically (default interval: ${DEFAULT_INTERVAL_MIN}min)
    --interval <N>       Watch interval in minutes (default: ${DEFAULT_INTERVAL_MIN})
    --help, -h           Show this help

  Exit codes:
    0   All checks passed
    1   Anomalies detected
    2   Critical error
  `);
  process.exit(0);
}

// ── SQLite reader ─────────────────────────────────────────────────────────
function loadTeamStats() {
  let bs3;
  try {
    bs3 = require('better-sqlite3');
  } catch (e) {
    throw new Error('better-sqlite3 not available. Run: npm install better-sqlite3');
  }
  const dbPath = path.join(ROOT, 'pariscore.db');
  if (!fs.existsSync(dbPath)) {
    throw new Error(`Database not found at ${dbPath}`);
  }
  const dbi = bs3(dbPath, { readonly: true });
  try {
    const row = dbi.prepare("SELECT value FROM kv WHERE key = 'db_team_stats'").get();
    if (!row) {
      console.log('  [MONITOR] No db_team_stats found in kv table (empty database).');
      return {};
    }
    return JSON.parse(row.value);
  } finally {
    dbi.close();
  }
}

// ── Sanity checks (mirror of server.js sanityCheckTeamStats) ─────────────
function runSanityChecks(teamStats) {
  const issues = [];
  const repairs = [];
  const teams = Object.entries(teamStats || {});

  for (const [key, stats] of teams) {
    if (!stats || typeof stats !== 'object') {
      issues.push({ key, severity: 'critical', msg: 'Invalid entry (not object)' });
      continue;
    }

    const homeStats = stats.home || {};
    const awayStats = stats.away || {};

    // Check home PPG
    if (homeStats.ppg === 0 && homeStats.played > HEALTHY_PPG_THRESHOLD) {
      const raw = stats._raw;
      if (raw?.pts && raw?.played && raw.played > 0) {
        const estimatedPpg = parseFloat((raw.pts / raw.played).toFixed(2));
        if (estimatedPpg > 0) {
          repairs.push({ key, side: 'home', oldPpg: 0, newPpg: estimatedPpg, from: '_raw' });
        } else {
          issues.push({ key, side: 'home', severity: 'high', msg: `PPG=0 played=${homeStats.played} raw ${raw.pts}/${raw.played}` });
        }
      } else {
        issues.push({ key, side: 'home', severity: 'high', msg: `PPG=0 played=${homeStats.played} no _raw fallback` });
      }
    }

    // Check away PPG
    if (awayStats.ppg === 0 && awayStats.played > HEALTHY_PPG_THRESHOLD) {
      const raw = stats._raw;
      if (raw?.pts && raw?.played && raw.played > 0) {
        const estimatedPpg = parseFloat((raw.pts / raw.played).toFixed(2));
        if (estimatedPpg > 0) {
          repairs.push({ key, side: 'away', oldPpg: 0, newPpg: estimatedPpg, from: '_raw' });
        } else {
          issues.push({ key, side: 'away', severity: 'high', msg: `PPG=0 played=${awayStats.played} raw ${raw.pts}/${raw.played}` });
        }
      } else {
        issues.push({ key, side: 'away', severity: 'high', msg: `PPG=0 played=${awayStats.played} no _raw fallback` });
      }
    }
  }

  return { issues, repairs };
}

// ── Report generation ─────────────────────────────────────────────────────
function buildReport(teamStats, { issues, repairs }) {
  const now = new Date();
  const teamCount = Object.keys(teamStats || {}).length;

  // Stats
  const totalAnomalies = issues.length;
  const autoRepairable = repairs.length;
  const unhealthyTeams = new Set(issues.map(i => i.key)).size;
  const teamsWithPpg = teamsWithValidPpg(teamStats);

  return {
    timestamp: now.toISOString(),
    date: now.toLocaleDateString('fr-FR'),
    time: now.toLocaleTimeString('fr-FR'),
    summary: {
      totalTeams: teamCount,
      healthyTeams: teamCount - unhealthyTeams,
      unhealthyTeams,
      totalAnomalies,
      autoRepairable,
      teamsWithValidPpg: teamsWithPpg,
    },
    anomalies: issues.slice(0, MAX_TEAMS_IN_REPORT),
    autoRepairs: repairs.slice(0, MAX_TEAMS_IN_REPORT),
    // Health score: 0-100%
    healthScore: teamCount > 0
      ? Math.round(((teamCount - unhealthyTeams) / teamCount) * 100)
      : 100,
    verdict: totalAnomalies === 0 ? 'HEALTHY' : 'ANOMALIES',
  };
}

function teamsWithValidPpg(teamStats) {
  let count = 0;
  for (const stats of Object.values(teamStats || {})) {
    if (!stats || typeof stats !== 'object') continue;
    const h = stats.home || {};
    const a = stats.away || {};
    if (h.ppg > 0 && a.ppg > 0) count++;
  }
  return count;
}

// ── Console reporter ──────────────────────────────────────────────────────
function printReport(report) {
  const { summary, anomalies, autoRepairs, healthScore, verdict } = report;

  console.log('');
  console.log('═'.repeat(50));
  console.log('  SANITY VISION MONITOR — Rapport');
  console.log(`  ${report.date} ${report.time}`);
  console.log('═'.repeat(50));
  console.log('');
  console.log(`  Équipes totales :        ${summary.totalTeams}`);
  console.log(`  Équipes saines :         ${summary.healthyTeams}`);
  console.log(`  Équipes anormales :      ${summary.unhealthyTeams}`);
  console.log(`  Anomalies totales :      ${summary.totalAnomalies}`);
  console.log(`  Auto-réparables :        ${summary.autoRepairable}`);
  console.log(`  PPG valides (h+a>0) :    ${summary.teamsWithValidPpg}`);
  console.log(`  Score de santé :         ${healthScore}%`);
  console.log(`  Verdict :                ${verdict}`);
  console.log('');

  if (anomalies.length > 0) {
    console.log('  ── Anomalies ──');
    for (const a of anomalies) {
      console.log(`    [${a.severity}] ${a.key} ${a.side ? '('+a.side+')' : ''}: ${a.msg}`);
    }
    console.log('');
  }

  if (autoRepairs.length > 0) {
    console.log('  ── Auto-réparations disponibles ──');
    for (const r of autoRepairs) {
      console.log(`    ${r.key} ${r.side}: ${r.oldPpg} → ${r.newPpg} (from ${r.from})`);
    }
    console.log('');
  }

  if (verdict === 'HEALTHY') {
    console.log('  ✅ Tous les contrôles sont passés.');
  } else {
    console.log(`  ⚠️  ${anomalies.length} anomalie(s) détectée(s).`);
  }
  console.log('');
}

// ── Save report ───────────────────────────────────────────────────────────
function saveReport(report) {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
  const filename = `sanity-${report.timestamp.replace(/[:.]/g, '-')}.json`;
  const filepath = path.join(REPORTS_DIR, filename);
  fs.writeFileSync(filepath, JSON.stringify(report, null, 2), 'utf8');

  // Keep a "latest" symlink/copy
  fs.writeFileSync(path.join(REPORTS_DIR, 'latest.json'), JSON.stringify(report, null, 2), 'utf8');
  console.log(`  📄 Rapport sauvegardé : ${filepath}`);
  return filepath;
}

// ── gstack-browse capture (optional) ──────────────────────────────────────
function captureWithGstack(report) {
  if (!FLAGS.gstack) return;

  const browseBin = path.join(process.env.HOME || process.env.USERPROFILE, '.claude', 'skills', 'gstack', 'browse', 'dist', 'browse.exe');
  if (!fs.existsSync(browseBin)) {
    console.log('  [MONITOR] gstack-browse binary not found, skipping screenshot.');
    return;
  }

  const screenshotDir = path.join(REPORTS_DIR, 'screenshots');
  fs.mkdirSync(screenshotDir, { recursive: true });
  const ts = Date.now();
  const shotPath = path.join(screenshotDir, `standings-${ts}.png`);

  // Check if server is running first
  const http = require('http');
  const req = http.get('http://localhost:3000', (res) => {
    // Server is running — take screenshot
    try {
      const cmd = `"${browseBin}" goto http://localhost:3000 && "${browseBin}" screenshot "${shotPath}"`;
      console.log('  [MONITOR] Capturing screenshot via gstack-browse...');
      execSync(cmd, { cwd: ROOT, timeout: 30000, stdio: 'pipe' });
      console.log(`  📸 Screenshot saved: ${shotPath}`);
    } catch (e) {
      console.log('  [MONITOR] Screenshot failed (non-critical):', e.message);
    }
  });
  req.on('error', () => {
    console.log('  [MONITOR] Server not running at :3000 — skipping screenshot.');
  });
  req.setTimeout(2000, () => { req.destroy(); });
}

// ── Main ──────────────────────────────────────────────────────────────────
function main() {
  let teamStats;
  try {
    teamStats = loadTeamStats();
  } catch (e) {
    console.error(`\x1b[31m[MONITOR] Erreur critique : ${e.message}\x1b[0m`);
    process.exit(2);
  }

  const sanity = runSanityChecks(teamStats);
  const report = buildReport(teamStats, sanity);

  // Save report
  if (FLAGS.watch || FLAGS.out) {
    saveReport(report);
  }

  // JSON output
  if (FLAGS.json) {
    const json = JSON.stringify(report, null, 2);
    if (FLAGS.out) {
      fs.writeFileSync(FLAGS.out, json, 'utf8');
      console.log(`  📄 Rapport JSON : ${FLAGS.out}`);
    } else {
      console.log(json);
    }
    return; // skip console report if --json without terminal
  }

  printReport(report);

  // Optional gstack capture
  if (FLAGS.gstack) {
    captureWithGstack(report);
  }

  const exitCode = report.verdict === 'HEALTHY' ? 0 : 1;
  process.exit(exitCode);
}

// ── Watch mode ────────────────────────────────────────────────────────────
function watch() {
  console.log(`\n  🔄 Watch mode — every ${FLAGS.interval} minutes. PID: ${process.pid}`);
  console.log(`  📁 Reports: ${REPORTS_DIR}\n`);

  function run() {
    const now = new Date();
    console.log(`[${now.toLocaleTimeString('fr-FR')}] Running check...`);

    try {
      const teamStats = loadTeamStats();
      const sanity = runSanityChecks(teamStats);
      const report = buildReport(teamStats, sanity);
      saveReport(report);

      if (report.verdict !== 'HEALTHY') {
        console.warn(`\x1b[33m  ⚠️  ${report.summary.totalAnomalies} anomaly(s) — health ${report.healthScore}%\x1b[0m`);
      }
    } catch (e) {
      console.error(`\x1b[31m  [MONITOR] Error: ${e.message}\x1b[0m`);
    }

    // Collect old reports (keep last 100)
    try {
      const files = fs.readdirSync(REPORTS_DIR)
        .filter(f => f.startsWith('sanity-') && f.endsWith('.json'))
        .sort();
      while (files.length > 100) {
        const old = files.shift();
        fs.unlinkSync(path.join(REPORTS_DIR, old));
      }
    } catch (_) { /* best-effort */ }
  }

  // Run immediately, then on interval
  run();
  setInterval(run, FLAGS.interval * 60 * 1000);
}

// ── Entry ─────────────────────────────────────────────────────────────────
if (FLAGS.watch) {
  watch();
} else {
  main();
}
