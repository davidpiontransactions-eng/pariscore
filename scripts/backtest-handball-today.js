#!/usr/bin/env node
'use strict';
/**
 * backtest-handball-today.js
 * --------------------------
 * Backtest quotidien des 8 stratégies handball sur les matchs du JOUR
 * (jour civil Europe/Paris) → data/handball_backtest_today.json.
 *
 * Usage :
 *   node scripts/backtest-handball-today.js                # calcule + écrit le JSON
 *   node scripts/backtest-handball-today.js --dry-run      # calcule + affiche, n'écrit pas
 *   node scripts/backtest-handball-today.js --refresh      # rafraîchit le snapshot avant
 *   node scripts/backtest-handball-today.js --date=2026-09-24   # jour cible explicite
 *
 * Zéro dépendance : le moteur vit dans src/lib (TypeScript). Node ≥ 23.6 strippe
 * les types nativement ; il manque uniquement la résolution des imports relatifs
 * sans extension (bundler/moduleResolution: "bundler" côté Next) → hook
 * `module.registerHooks` ci-dessous qui réessaie avec ".ts". Aucun build, aucune
 * installation requise.
 *
 * Cron VPS : pm2 `pariscore-cron-handball-nightly` (23:00 Europe/Paris).
 * Garde : si la journée cible n'a AUCUN match terminé (run de nuit hors créneau,
 * changement de fuseau DST), le fichier existant est conservé tel quel.
 *
 * Sortie : data/handball_backtest_today.json
 *   { date, timezone, nFinishedToday, nPendingToday, strategies[], global,
 *     methodology, computed_at }
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { registerHooks } = require('module');

const SCRIPT_DIR = path.dirname(__filename);
const REPO_DIR = path.dirname(SCRIPT_DIR);
const SNAPSHOT_NAME = 'flashscore_handball.json';
const OUT_NAME = 'handball_backtest_today.json';
const SCRAPER = path.join(SCRIPT_DIR, 'scrape-flashscore-handball.js');

// ─── Arguments CLI ───────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const DRY_RUN = argv.includes('--dry-run');
const REFRESH = argv.includes('--refresh');
const DATE_ARG = (argv.find((a) => a.startsWith('--date=')) || '').slice('--date='.length) || null;
if (argv.includes('--help') || argv.includes('-h')) {
  console.log(
    'Usage: node scripts/backtest-handball-today.js [--dry-run] [--refresh] [--date=AAAA-MM-JJ]',
  );
  process.exit(0);
}

// ─── Chargeur TypeScript natif ───────────────────────────────────────────────
// Les modules src/lib importent en "./module" (sans .ts) : Node ESM refuse.
// On réessaie avec l'extension .ts quand le spéculateur est un chemin relatif.
registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (err) {
      if (/^\.\.?\//.test(specifier) && !/\.[cm]?[jt]s$/.test(specifier)) {
        return nextResolve(specifier + '.ts', context);
      }
      throw err;
    }
  },
});

// Silence l'avertissement MODULE_TYPELESS_PACKAGE_JSON émis au chargement des
// .ts (package.json sans "type") — bruit seul, sans impact sur l'exécution.
const originalEmit = process.emit;
process.emit = function patchedEmit(name, data) {
  if (name === 'warning' && data && data.code === 'MODULE_TYPELESS_PACKAGE_JSON') return false;
  return originalEmit.apply(process, arguments);
};

const { computeDailyStrategyBacktest, parisDateOf } = require(
  path.join(REPO_DIR, 'src', 'lib', 'handball-backtest-today.ts'),
);
const { resolveHandballDataFile, toHandballMatch } = require(
  path.join(REPO_DIR, 'src', 'lib', 'handball-flashscore.ts'),
);
// Le filtre reste actif toute la vie du script : process.emitWarning diffère
// l'émission via nextTick, restaurer ici laisserait passer l'avertissement.

// ─── Snapshot ────────────────────────────────────────────────────────────────
function loadSnapshot() {
  const filePath = resolveHandballDataFile(SNAPSHOT_NAME);
  if (!filePath) {
    console.error(`[handball-backtest-today] ERREUR : snapshot ${SNAPSHOT_NAME} introuvable`);
    process.exit(1);
  }
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  const raw = Array.isArray(data.matches) ? data.matches : [];
  const matches = raw
    .filter((m) => m && m.home && m.away)
    .map((m, i) => toHandballMatch(m, i));
  return {
    filePath,
    matches,
    scrapedAt: typeof data.scraped_at === 'string' ? data.scraped_at : null,
  };
}

/** Rafraîchit le snapshot via le scraper Flashscore (échec = non bloquant). */
function refreshSnapshot() {
  if (!fs.existsSync(SCRAPER)) {
    console.warn(`[handball-backtest-today] --refresh ignoré : ${SCRAPER} absent`);
    return;
  }
  console.log('[handball-backtest-today] refresh snapshot Flashscore…');
  const res = spawnSync(process.execPath, [SCRAPER], {
    cwd: REPO_DIR,
    stdio: 'inherit',
    timeout: 180_000,
  });
  if (res.error || res.status !== 0) {
    console.warn(
      `[handball-backtest-today] refresh échoué (code ${res.status}) — on calcule sur le snapshot existant`,
    );
  }
}

// ─── Affichage ───────────────────────────────────────────────────────────────
const pad = (s, n) => String(s).padEnd(n).slice(0, n);
const padStart = (s, n) => String(s).padStart(n);
const fmtSigned = (v) => (v > 0 ? `+${v.toFixed(1)}` : v.toFixed(1));
const fmtU = (v) => (v > 0 ? `+${v.toFixed(2)}u` : `${v.toFixed(2)}u`);

function printReport(result, snapshot) {
  console.log(`[handball-backtest-today] date cible   : ${result.date} (${result.timezone})`);
  console.log(
    `[handball-backtest-today] snapshot     : ${path.relative(REPO_DIR, snapshot.filePath)}` +
      ` (scrapé ${snapshot.scrapedAt ?? 'inconnu'})`,
  );
  console.log(
    `[handball-backtest-today] matchs du jour: ${result.nFinishedToday} terminés` +
      `${result.nPendingToday > 0 ? ` / ${result.nFinishedToday + result.nPendingToday} (${result.nPendingToday} en cours ou à venir)` : ''}`,
  );
  console.log('');
  console.log(
    `${pad('Stratégie', 26)} ${pad('Marché', 26)} ${padStart('Paris', 5)} ${padStart('G', 3)} ${padStart('P', 3)} ${padStart('N', 3)} ${padStart('ROI', 8)} ${padStart('Profit', 9)}`,
  );
  console.log('-'.repeat(96));
  for (const row of result.strategies) {
    const roi = row.roiPct != null ? `${fmtSigned(row.roiPct)}%` : '—';
    const hit = row.hitRate != null ? `${row.won}/${row.nBets}` : '—';
    console.log(
      `${pad(`${row.emoji} ${row.label}`, 26)} ${pad(row.market, 26)} ${padStart(row.nBets, 5)} ` +
        `${padStart(row.won, 3)} ${padStart(row.lost, 3)} ${padStart(row.voids, 3)} ` +
        `${padStart(roi, 8)} ${padStart(row.nBets > 0 ? fmtU(row.profitU) : '—', 9)}` +
        (row.note ? `  ${row.note}` : ''),
    );
  }
  console.log('-'.repeat(96));
  const g = result.global;
  console.log(
    `Total : ${g.nBets} paris · ${g.won} gagnés · ${g.lost} perdus · ${g.voids} annulés` +
      ` · ROI ${g.roiPct != null ? fmtSigned(g.roiPct) + '%' : '—'}` +
      ` · profit ${fmtU(g.profitU)}` +
      ` · hit ${g.hitRate != null ? g.hitRate.toFixed(1) + '%' : '—'}`,
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────
if (REFRESH) refreshSnapshot();

const snapshot = loadSnapshot();
const date = DATE_ARG || parisDateOf(new Date());
const result = computeDailyStrategyBacktest(snapshot.matches, { date });

printReport(result, snapshot);

if (DRY_RUN) {
  console.log('[handball-backtest-today] dry-run : aucun fichier écrit');
  process.exit(0);
}

if (result.nFinishedToday === 0) {
  console.log(
    `[handball-backtest-today] aucun match terminé le ${date} → fichier existant conservé`,
  );
  process.exit(0);
}

const outFile = path.join(path.dirname(snapshot.filePath), OUT_NAME);
fs.writeFileSync(outFile, `${JSON.stringify(result, null, 2)}\n`, 'utf-8');
console.log(`[handball-backtest-today] écrit : ${path.relative(REPO_DIR, outFile)}`);
