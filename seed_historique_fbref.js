/**
 * seed_historique_fbref.js — Node spawner pour sidecar Python soccerdata
 * ─────────────────────────────────────────────────────────────────────
 * Mission: bd ParisScorebis-8lqf
 *
 * ⚠️ LEGAL FLAG: Sports Reference ToS interdit scraping commercial.
 *    Cette ETL = RESEARCH/EDUCATIONAL USE ONLY.
 *    Data marquee research_only=true + _source='etl-fbref-research'.
 *    NE PAS exposer UI publique commerciale par defaut.
 *
 * PREREQUIS:
 *   python3 -m pip install soccerdata pandas
 *
 * USAGE:
 *   node seed_historique_fbref.js                            # PL 2024 default
 *   node seed_historique_fbref.js --all --season 2024        # toutes ligues
 *   node seed_historique_fbref.js --seasons-range 2020-2024  # 5 saisons
 *   node seed_historique_fbref.js --leagues "ENG-Premier League,FRA-Ligue 1"
 *
 * OUTPUT: historique_fbref.json
 *   compatible loadHistory v12.26+ pattern (research_only flag preserve)
 *
 * COVERAGE: schedule + scores + venue + referee + round
 *   (stats avancees xG/shots/etc disponibles via read_team_match_stats — phase 2)
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const OUTPUT_FILE = path.join(__dirname, 'historique_fbref.json');
const PYTHON_SCRIPT = path.join(__dirname, 'scripts', 'fbref_extract.py');

function runPythonSidecar(args) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(PYTHON_SCRIPT)) {
      return reject(new Error(`Python script missing: ${PYTHON_SCRIPT}`));
    }
    const pythonBin = process.env.PYTHON_BIN || 'python3';
    console.log(`[fbref] Spawn: ${pythonBin} ${PYTHON_SCRIPT} ${args.join(' ')}`);
    const child = spawn(pythonBin, [PYTHON_SCRIPT, ...args]);
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => {
      const txt = d.toString();
      stderr += txt;
      // Forward stderr en temps reel pour visibilite progress
      process.stderr.write(`[python] ${txt}`);
    });
    child.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(`Python sidecar exit ${code}: ${stderr.slice(0, 500)}`));
      }
      resolve({ stdout, stderr });
    });
    child.on('error', reject);
  });
}

async function main() {
  const args = process.argv.slice(2);

  // Pass-through args to Python sidecar
  const pythonArgs = [];
  if (args.includes('--all')) pythonArgs.push('--all');
  const seasonArg = args.find(a => a.startsWith('--season=') || a === '--season');
  if (seasonArg) {
    const val = seasonArg.includes('=')
      ? seasonArg.split('=')[1]
      : args[args.indexOf(seasonArg) + 1];
    pythonArgs.push('--season', val);
  }
  const rangeArg = args.find(a => a.startsWith('--seasons-range='));
  if (rangeArg) {
    pythonArgs.push('--seasons-range', rangeArg.split('=')[1]);
  }
  const leaguesArg = args.find(a => a.startsWith('--leagues='));
  if (leaguesArg) {
    pythonArgs.push('--leagues', leaguesArg.split('=')[1]);
  }
  pythonArgs.push('--output', OUTPUT_FILE);

  console.log(`[fbref] Demarrage ETL via soccerdata sidecar`);
  console.log(`[fbref] Output: ${OUTPUT_FILE}`);
  console.log(`[fbref] ⚠️ RESEARCH USE ONLY — data not for commercial UI display`);

  try {
    const t0 = Date.now();
    await runPythonSidecar(pythonArgs);
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    if (fs.existsSync(OUTPUT_FILE)) {
      const size = fs.statSync(OUTPUT_FILE).size;
      console.log(`[fbref] OK — ${size} bytes — ${elapsed}s`);
      console.log(`[fbref] Sample (premiere ligue):`);
      const data = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf8'));
      const firstKey = Object.keys(data.leagues || {})[0];
      if (firstKey) {
        const first = data.leagues[firstKey];
        console.log(`[fbref]   ${firstKey}: ${first.matches?.length || 0} matchs`);
      }
    } else {
      console.warn(`[fbref] Output file pas cree — verifier stderr Python ci-dessus`);
    }
  } catch (e) {
    console.error('[fbref] ERREUR:', e.message);
    process.exit(1);
  }
}

if (require.main === module) main();

module.exports = { runPythonSidecar };
