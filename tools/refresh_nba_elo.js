'use strict';
/**
 * refresh_nba_elo.js — Elo NBA game-by-game (538 MOV-adjusted) + backtest Brier
 * Source : ESPN scoreboard ?dates=YYYYMMDD (gratuit). Output : data/nba_elo.json
 *
 * Ingestion chronologique de tous les matchs terminés de la saison → Elo MOV-adjusted.
 * Backtest : pour chaque match, prédiction pré-game (Elo avant) vs résultat → Brier + accuracy.
 * Baseline : "toujours domicile" (Brier de référence).
 *
 * Run  : node tools/refresh_nba_elo.js
 * Cron : 0 12 * * *  (daily, après les matchs de la veille)
 * Env  : NBA_SEASON_START (YYYY-MM-DD, default 2025-10-21)
 *
 * Sortie consommée par basketballService.computeNbaWinProb (Elo réel > proxy records).
 * NON calibré comme signal BET tant que Brier non validé vs marché.
 */

const https = require('https');
const fs    = require('fs');
const path  = require('path');

const ESPN_HOST = 'site.api.espn.com';
const SB_PATH   = '/apis/site/v2/sports/basketball/nba/scoreboard';
const OUTPUT    = path.join(__dirname, '..', 'data', 'nba_elo.json');
const SEASON_START = process.env.NBA_SEASON_START || '2025-10-21';
const K = 20;            // facteur K Elo
const HCA_ELO = 46;      // home-court ~ +3.2 pts ≈ 46 Elo
const REVERT = 0.0;      // pas de mean-revert intra-saison (simple)
const DELAY_MS = 90;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function getJson(dateStr) {
  const p = `${SB_PATH}?dates=${dateStr}`;
  return new Promise((resolve) => {
    const req = https.request({ host: ESPN_HOST, path: p, headers: { 'User-Agent': 'Mozilla/5.0 PariScore', 'Accept': 'application/json' } }, (res) => {
      let buf = ''; res.on('data', c => buf += c);
      res.on('end', () => { try { resolve(JSON.parse(buf)); } catch { resolve(null); } });
    });
    req.on('error', () => resolve(null));
    req.setTimeout(15000, () => { req.destroy(); resolve(null); });
    req.end();
  });
}

// Génère les dates YYYYMMDD de start → aujourd'hui
function dateRange(startISO) {
  const out = [];
  const d = new Date(startISO + 'T12:00:00Z');
  const end = new Date();
  while (d <= end) {
    out.push(`${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`);
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

function expected(rA, rB) { return 1 / (1 + Math.pow(10, -(rA - rB) / 400)); }

// 538 MOV multiplier
function movMult(margin, eloDiffWinner) {
  return Math.log(Math.abs(margin) + 1) * (2.2 / ((eloDiffWinner * 0.001) + 2.2));
}

async function main() {
  console.log(`[NBA-Elo] Season start ${SEASON_START} — fetching scoreboards…`);
  const dates = dateRange(SEASON_START);
  const games = []; // {ts, homeId, awayId, homeName, awayName, hs, as}
  let fetched = 0;
  for (const ds of dates) {
    const d = await getJson(ds);
    await sleep(DELAY_MS);
    fetched++;
    const events = (d && Array.isArray(d.events)) ? d.events : [];
    for (const ev of events) {
      const comp = (ev.competitions && ev.competitions[0]) || {};
      const st = comp.status && comp.status.type;
      if (!st || !st.completed) continue;
      const cs = comp.competitors || [];
      const home = cs.find(c => c.homeAway === 'home'), away = cs.find(c => c.homeAway === 'away');
      if (!home || !away) continue;
      const hs = parseInt(home.score, 10), as = parseInt(away.score, 10);
      if (!Number.isFinite(hs) || !Number.isFinite(as) || hs === as) continue;
      games.push({
        ts: ev.date, homeId: home.team.id, awayId: away.team.id,
        homeName: home.team.displayName, awayName: away.team.displayName, hs, as,
      });
    }
    if (fetched % 30 === 0) console.log(`  …${fetched}/${dates.length} dates, ${games.length} games`);
  }
  games.sort((a, b) => new Date(a.ts) - new Date(b.ts));
  console.log(`[NBA-Elo] ${games.length} matchs terminés — replay Elo + backtest…`);

  const elo = {};       // id -> rating
  const names = {};     // id -> name
  const gp = {};        // id -> games played
  const get = (id) => (elo[id] != null ? elo[id] : 1500);
  let brierSum = 0, baseBrierSum = 0, correct = 0, n = 0;

  for (const g of games) {
    names[g.homeId] = g.homeName; names[g.awayId] = g.awayName;
    const rH = get(g.homeId), rA = get(g.awayId);
    const pHome = expected(rH + HCA_ELO, rA);
    const homeWon = g.hs > g.as ? 1 : 0;
    // backtest (pré-game)
    brierSum += Math.pow(pHome - homeWon, 2);
    baseBrierSum += Math.pow(0.5 - homeWon, 2); // baseline coin-flip
    if ((pHome >= 0.5 ? 1 : 0) === homeWon) correct++;
    n++;
    // update Elo MOV-adjusted
    const margin = g.hs - g.as;
    const winnerEloDiff = (homeWon ? (rH + HCA_ELO - rA) : (rA - rH - HCA_ELO));
    const mult = movMult(margin, winnerEloDiff);
    const delta = K * mult * (homeWon - pHome);
    elo[g.homeId] = rH + delta;
    elo[g.awayId] = rA - delta;
    gp[g.homeId] = (gp[g.homeId] || 0) + 1;
    gp[g.awayId] = (gp[g.awayId] || 0) + 1;
  }

  const ratings = {};
  for (const id of Object.keys(elo)) ratings[id] = { name: names[id], elo: Math.round(elo[id]), gp: gp[id] || 0 };

  const payload = {
    generated: new Date().toISOString(),
    source: 'espn-scoreboard',
    season_start: SEASON_START,
    games_count: n,
    hca_elo: HCA_ELO, k: K,
    backtest: {
      n, brier: n ? +(brierSum / n).toFixed(4) : null,
      baseline_brier: n ? +(baseBrierSum / n).toFixed(4) : null,
      accuracy: n ? +(correct / n * 100).toFixed(1) : null,
    },
    ratings,
  };
  fs.writeFileSync(OUTPUT, JSON.stringify(payload, null, 2));
  console.log(`[NBA-Elo] OK — ${n} games · Brier ${payload.backtest.brier} (baseline ${payload.backtest.baseline_brier}) · acc ${payload.backtest.accuracy}% → ${OUTPUT}`);
}

if (require.main === module) main().catch(e => { console.error('[NBA-Elo] FATAL', e); process.exit(1); });
module.exports = { dateRange, expected, movMult };
