'use strict';
/**
 * basketballService.js — Vertical WNBA (ESPN public, JS-natif, zero-dep)
 *
 * Modèle INDÉPENDANT des cotes (non-circulaire) :
 *   - Power rating Elo-style depuis records (win%, home/road) + margin saison
 *   - Win prob = logistic(ratingDiff + home-court advantage)   ~65% baseline (538-like)
 *   - Four Factors partiels (eFG%, FT rate) depuis stats ESPN saison
 *   - Total O/U : modèle scoring saison (pace × efficiency proxy)
 *   - Cotes DraftKings (ESPN) utilisées UNIQUEMENT pour devig + EV (jamais en entrée modèle)
 *
 * NON calibré : reliability/Brier requis AVANT tout signal BET (règle CLAUDE.md UQD).
 * Source : site.api.espn.com — gratuit, pas de clé. Décision DG 2026-06-05 (ESPN, vertical complet).
 */

const https = require('https');
const fs    = require('fs');
const path  = require('path');

const ESPN_HOST = 'site.api.espn.com';
const ESPN_SCOREBOARD = '/apis/site/v2/sports/basketball/wnba/scoreboard';
const ESPN_STANDINGS  = '/apis/v2/sports/basketball/wnba/standings';
const ESPN_INJURIES   = '/apis/site/v2/sports/basketball/wnba/injuries';
const NBA_ELO_FILE    = path.join(__dirname, '..', 'data', 'wnba_elo.json');
const STAR_OUT_PTS = 3.5;  // impact pts d'un scoreur leader absent
const ROLE_OUT_PTS = 0.8;  // impact pts d'un rotation player absent
const B2B_PTS      = 1.6;  // pénalité back-to-back (fatigue)
const HCA_PTS   = 2.6;     // WNBA home-court ~2.5 pts (plus bas que NBA)
const PTS_PER_ELO = 20;    // WNBA ~20 pts/400 Elo (scoring ~72% NBA → spread compressé)
const ELO_DIV   = 400;
const TTL_MS    = 90 * 1000; // 90s cache live

let _cache = { ts: 0, data: null };
let _standings = { ts: 0, map: null, leagueAvg: 82.0 };
let _eloCache = { ts: 0, data: null };
let _injuries = { ts: 0, map: null }; // teamId -> [{ name, status, type }]

// Injuries ESPN (gratuit) → map teamId → joueurs absents/incertains
async function _fetchInjuries() {
  if (Date.now() - _injuries.ts < 15 * 60 * 1000 && _injuries.map) return _injuries;
  const d = await httpsGetJson(ESPN_HOST, ESPN_INJURIES);
  const map = {};
  const list = (d && Array.isArray(d.injuries)) ? d.injuries : [];
  for (const t of list) {
    const tid = t.id;
    if (!tid) continue;
    map[tid] = (t.injuries || []).map(x => ({
      name: (x.athlete && x.athlete.displayName) || '',
      status: x.status || '',
      type: (x.details && x.details.type) || '',
    })).filter(x => x.name);
  }
  if (Object.keys(map).length) _injuries = { ts: Date.now(), map };
  return _injuries;
}

// Standings ESPN → map teamId → { avgPF, avgPA, gp, diff } (défense modélisée)
async function _fetchStandings() {
  if (Date.now() - _standings.ts < 6 * 3600 * 1000 && _standings.map) return _standings;
  const d = await httpsGetJson(ESPN_HOST, ESPN_STANDINGS);
  const map = {};
  let sumPF = 0, cnt = 0;
  const children = (d && Array.isArray(d.children)) ? d.children : [];
  for (const ch of children) {
    const entries = (ch.standings && Array.isArray(ch.standings.entries)) ? ch.standings.entries : [];
    for (const e of entries) {
      const id = e.team && e.team.id;
      if (!id) continue;
      const stat = (name) => { const s = (e.stats || []).find(x => x.name === name); return s ? s.value : null; };
      const pf = stat('avgPointsFor'), pa = stat('avgPointsAgainst');
      map[id] = { avgPF: pf, avgPA: pa, gp: stat('gamesPlayed'), diff: stat('differential') };
      if (pf != null) { sumPF += pf; cnt++; }
    }
  }
  if (Object.keys(map).length) _standings = { ts: Date.now(), map, leagueAvg: cnt ? +(sumPF / cnt).toFixed(1) : 82.0 };
  return _standings;
}

// Elo game-by-game (tools/refresh_nba_elo.js) → { ratings:{id:{elo,gp}}, backtest }
function _loadNbaElo() {
  if (_eloCache.data && Date.now() - _eloCache.ts < 3600 * 1000) return _eloCache.data;
  try {
    const d = JSON.parse(fs.readFileSync(NBA_ELO_FILE, 'utf8'));
    _eloCache = { ts: Date.now(), data: d };
    return d;
  } catch { return null; }
}

// ─── HTTP natif ────────────────────────────────────────────────────────────────
function httpsGetJson(host, path) {
  return new Promise((resolve) => {
    const opts = { host, path, method: 'GET', headers: { 'User-Agent': 'Mozilla/5.0 PariScore', 'Accept': 'application/json' } };
    const req = https.request(opts, (res) => {
      let buf = '';
      res.on('data', c => buf += c);
      res.on('end', () => { try { resolve(JSON.parse(buf)); } catch { resolve(null); } });
    });
    req.on('error', () => resolve(null));
    req.setTimeout(15000, () => { req.destroy(); resolve(null); });
    req.end();
  });
}

// ─── Parsing helpers ────────────────────────────────────────────────────────────
function _statVal(stats, name) {
  if (!Array.isArray(stats)) return null;
  const s = stats.find(x => x.name === name);
  if (!s) return null;
  const v = parseFloat(s.displayValue);
  return Number.isFinite(v) ? v : null;
}
function _recordSummary(records, type) {
  if (!Array.isArray(records)) return null;
  const r = records.find(x => x.type === type) || records.find(x => x.name === 'overall');
  return r ? r.summary : null;
}
function _winPct(summary) {
  if (!summary || !/^\d+-\d+/.test(summary)) return null;
  const [w, l] = summary.split('-').map(Number);
  return (w + l) > 0 ? w / (w + l) : null;
}
function _amOddsToProb(odds) {
  const o = parseFloat(String(odds).replace('+', ''));
  if (!Number.isFinite(o)) return null;
  return o < 0 ? (-o) / (-o + 100) : 100 / (o + 100);
}

// eFG% = (FGM + 0.5*3PM) / FGA — Oliver Four Factor #1
function _efgPct(stats) {
  const fgm = _statVal(stats, 'fieldGoalsMade');
  const tpm = _statVal(stats, 'threePointFieldGoalsMade');
  const fga = _statVal(stats, 'fieldGoalsAttempted');
  if (fgm == null || tpm == null || !fga) return null;
  return +(((fgm + 0.5 * tpm) / fga) * 100).toFixed(1);
}
// FT rate = FTA / FGA — Four Factor #4
function _ftRate(stats) {
  const fta = _statVal(stats, 'freeThrowsAttempted');
  const fga = _statVal(stats, 'fieldGoalsAttempted');
  if (fta == null || !fga) return null;
  return +((fta / fga) * 100).toFixed(1);
}

// Leader PPG d'un competitor ESPN (pour détecter star out)
function _ppgLeader(competitor) {
  const cats = (competitor && competitor.leaders) || [];
  const ppg = cats.find(c => c.name === 'pointsPerGame') || cats[0];
  const l = ppg && ppg.leaders && ppg.leaders[0];
  return (l && l.athlete && l.athlete.displayName) || null;
}

// ─── Power rating (records + margin, INDÉPENDANT des cotes) ─────────────────────
// Rating Elo-style : 1500 base + écart win% pondéré. Refine par split home/road.
function _teamRating(rec, isHome) {
  const overall = _winPct(_recordSummary(rec, 'total'));
  const venue   = _winPct(_recordSummary(rec, isHome ? 'home' : 'road'));
  if (overall == null) return null;
  // pondère 65% saison + 35% split venue (si dispo)
  const wp = venue != null ? (0.65 * overall + 0.35 * venue) : overall;
  // map win% → Elo : 0.5→1500, pente ~ 700 Elo sur [0,1] (≈ équipe 80% ≈ +210 Elo)
  return 1500 + (wp - 0.5) * 700;
}

function computeNbaWinProb(homeRec, awayRec, homeId, awayId) {
  const hcaElo = (HCA_PTS / PTS_PER_ELO) * ELO_DIV; // HCA points → Elo
  let rH, rA, source;
  // (c) Elo game-by-game réel si dispo (>= 10 matchs joués) — sinon proxy records
  const eloData = _loadNbaElo();
  const eH = eloData && eloData.ratings && eloData.ratings[homeId];
  const eA = eloData && eloData.ratings && eloData.ratings[awayId];
  if (eH && eA && (eH.gp || 0) >= 10 && (eA.gp || 0) >= 10) {
    rH = eH.elo; rA = eA.elo; source = 'elo_game_by_game';
  } else {
    rH = _teamRating(homeRec, true); rA = _teamRating(awayRec, false); source = 'records_proxy';
  }
  if (rH == null || rA == null) return null;
  const diff = (rH + hcaElo) - rA;
  const pHome = 1 / (1 + Math.pow(10, -diff / ELO_DIV));
  return {
    home_rating: Math.round(rH), away_rating: Math.round(rA),
    p_home: +(pHome * 100).toFixed(1), p_away: +((1 - pHome) * 100).toFixed(1),
    edge_elo: Math.round(diff), source,
    backtest: (source === 'elo_game_by_game' && eloData.backtest) ? eloData.backtest : null,
  };
}

// ─── Total O/U (scoring saison, INDÉPENDANT des cotes) ──────────────────────────
// (b) Total avec défense modélisée (standings PF/PA, log5-style).
// expected_home = avgPF_home × avgPA_away / leagueAvg  (offense vs défense adverse, ancré ligue)
// Si standings absent → fallback combined_offense indicatif (défense non modélisée).
function computeNbaTotal(homeStats, awayStats, homeId, awayId) {
  const ptsH = _statVal(homeStats, 'avgPoints');
  const ptsA = _statVal(awayStats, 'avgPoints');
  const sH = _standings.map && _standings.map[homeId];
  const sA = _standings.map && _standings.map[awayId];
  const LA = _standings.leagueAvg || 82.0;
  if (sH && sA && sH.avgPF != null && sH.avgPA != null && sA.avgPF != null && sA.avgPA != null) {
    const expH = (sH.avgPF * sA.avgPA) / LA;
    const expA = (sA.avgPF * sH.avgPA) / LA;
    const expected = +(expH + expA + HCA_PTS * 0.3).toFixed(1);
    return {
      expected_total: expected, exp_home: +expH.toFixed(1), exp_away: +expA.toFixed(1),
      defense_modeled: true, league_avg: LA,
    };
  }
  if (ptsH == null || ptsA == null) return null;
  return { combined_offense: +(ptsH + ptsA).toFixed(1), home_avg_pts: ptsH, away_avg_pts: ptsA, defense_modeled: false };
}

// ════════════════════════════════════════════════════════════════════════════
//  MODÈLES POUSSÉS (couche quant — mirror philosophie foot : blend + UQD + signal)
// ════════════════════════════════════════════════════════════════════════════

// Normal CDF (erf Abramowitz-Stegun 7.1.26) — pour UQD analytique
function _normCdf(z) {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp(-z * z / 2);
  let p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}

// (1) Pythagorean expectation → win% saison, log5 pour matchup (exp WNBA ~14, ligue moins prolifique)
const PYTHAG_EXP = 14;
function computeNbaPythagorean(homeId, awayId) {
  const sH = _standings.map && _standings.map[homeId];
  const sA = _standings.map && _standings.map[awayId];
  if (!sH || !sA || sH.avgPF == null || sH.avgPA == null || sA.avgPF == null || sA.avgPA == null) return null;
  const pyth = (pf, pa) => Math.pow(pf, PYTHAG_EXP) / (Math.pow(pf, PYTHAG_EXP) + Math.pow(pa, PYTHAG_EXP));
  const wH = pyth(sH.avgPF, sH.avgPA), wA = pyth(sA.avgPF, sA.avgPA);
  // log5 (Bill James) : P(H bat A) sur terrain neutre
  let p = (wH - wH * wA) / (wH + wA - 2 * wH * wA);
  p = Math.max(0.02, Math.min(0.98, p + 0.035)); // +HCA ~3.5pp
  return { p_home: +(p * 100).toFixed(1), pyth_home: +(wH * 100).toFixed(1), pyth_away: +(wA * 100).toFixed(1) };
}

// (2) Four Factors partiels (eFG% + FT rate — TOV/ORB non exposés ESPN scoreboard)
function computeNbaFourFactors(homeStats, awayStats) {
  const efgH = _efgPct(homeStats), efgA = _efgPct(awayStats);
  const ftH = _ftRate(homeStats), ftA = _ftRate(awayStats);
  if (efgH == null || efgA == null) return null;
  // eFG% pondéré 0.40, FT rate 0.15 (poids Oliver) → score différentiel → logistic
  const scoreH = 0.40 * efgH + 0.15 * (ftH || 0);
  const scoreA = 0.40 * efgA + 0.15 * (ftA || 0);
  const p = 1 / (1 + Math.exp(-(scoreH - scoreA) / 3.2)); // pente calibrable
  return { p_home: +(p * 100).toFixed(1), efg_home: efgH, efg_away: efgA, partial: true };
}

// (3) Bayesian blend Elo + Pythagorean + Four Factors → proba consolidée
function computeNbaBlend(eloP, pythP, ffP) {
  const parts = [];
  if (eloP != null)  parts.push({ p: eloP / 100,  w: 0.55 });
  if (pythP != null) parts.push({ p: pythP / 100, w: 0.30 });
  if (ffP != null)   parts.push({ p: ffP / 100,   w: 0.15 });
  if (!parts.length) return null;
  const wSum = parts.reduce((s, x) => s + x.w, 0);
  const p = parts.reduce((s, x) => s + x.p * x.w, 0) / wSum;
  return { p_home: +(p * 100).toFixed(1), p_away: +((1 - p) * 100).toFixed(1), n_models: parts.length };
}

// (4) Spread/margin + (5) UQD analytique IC90 + ATS cover + O/U over probabilities
const SD_MARGIN = 11.5; // écart-type marge WNBA (pts)
const SD_TOTAL  = 13.5; // écart-type total WNBA (pts) — scoring + bas → totaux + serrés (edge sharp)
function computeNbaSpreadUQD(eloDiff, expTotal, bookSpreadHome, bookOU) {
  if (eloDiff == null) return null;
  const expMargin = +(eloDiff * PTS_PER_ELO / ELO_DIV).toFixed(1); // Elo diff → marge attendue (home - away)
  const z = 1.645; // IC90
  const out = {
    exp_margin: expMargin,
    margin_ic90: [+(expMargin - z * SD_MARGIN).toFixed(1), +(expMargin + z * SD_MARGIN).toFixed(1)],
    p_home_cover: null, ats_pick: null, total_ic90: null, p_over: null, ou_lean: null,
  };
  // ATS : bookSpreadHome négatif si home favori (ex -6.5). Home couvre si marge > -spread.
  if (bookSpreadHome != null) {
    const coverProb = _normCdf((expMargin + bookSpreadHome) / SD_MARGIN); // P(margin + spread > 0)
    out.p_home_cover = +(coverProb * 100).toFixed(1);
    out.ats_pick = coverProb >= 0.55 ? 'HOME' : coverProb <= 0.45 ? 'AWAY' : 'NEUTRAL';
  }
  if (expTotal != null) {
    out.total_ic90 = [+(expTotal - z * SD_TOTAL).toFixed(1), +(expTotal + z * SD_TOTAL).toFixed(1)];
    if (bookOU != null) {
      const overProb = 1 - _normCdf((bookOU - expTotal) / SD_TOTAL);
      out.p_over = +(overProb * 100).toFixed(1);
      out.ou_lean = overProb >= 0.55 ? 'OVER' : overProb <= 0.45 ? 'UNDER' : 'NEUTRAL';
    }
  }
  return out;
}

// ════════════════════════════════════════════════════════════════════════════
//  MODÈLES DE COMPARAISON & CONTRADICTION (indépendants — peuvent diverger du blend)
// ════════════════════════════════════════════════════════════════════════════

// (A) SRS / margin model — point differential saison (indépendant du chemin Elo)
function computeNbaSRS(homeId, awayId) {
  const sH = _standings.map && _standings.map[homeId];
  const sA = _standings.map && _standings.map[awayId];
  if (!sH || !sA || sH.diff == null || sA.diff == null) return null;
  const expMargin = sH.diff - sA.diff + HCA_PTS; // marges nettes saison + HCA
  const p = _normCdf(expMargin / SD_MARGIN);
  return { p_home: +(p * 100).toFixed(1), exp_margin: +expMargin.toFixed(1) };
}

// (B) Recent-form model — momentum L10 (margin moyen 10 derniers). Contredit l'Elo saison si hot/cold.
function computeNbaRecentForm(homeId, awayId) {
  const elo = _loadNbaElo();
  if (!elo || !elo.ratings) return null;
  const rH = elo.ratings[homeId], rA = elo.ratings[awayId];
  if (!rH || !rA || rH.form_l10_margin == null || rA.form_l10_margin == null) return null;
  const expMargin = rH.form_l10_margin - rA.form_l10_margin + HCA_PTS;
  const p = _normCdf(expMargin / SD_MARGIN);
  return { p_home: +(p * 100).toFixed(1), home_l10: rH.form_l10_winpct, away_l10: rA.form_l10_winpct };
}

// (C) Consensus / divergence — agrège tous les modèles, flag contradiction + contrarian
function computeNbaConsensus(models) {
  const valid = (models || []).filter(m => m && m.p != null);
  if (valid.length < 2) return null;
  const ps = valid.map(m => m.p);
  const mean = ps.reduce((a, b) => a + b, 0) / ps.length;
  const variance = ps.reduce((s, p) => s + (p - mean) ** 2, 0) / ps.length;
  const stddev = Math.sqrt(variance);
  const lo = Math.min(...ps), hi = Math.max(...ps);
  // contrarian = modèle le plus éloigné de la moyenne
  let contrarian = null, maxDist = -1;
  for (const m of valid) { const d = Math.abs(m.p - mean); if (d > maxDist) { maxDist = d; contrarian = m; } }
  // label : agrément si écart faible, divergent si fort, + side cross (modèles de part et d'autre de 50%)
  const crossesFifty = lo < 50 && hi > 50;
  let label;
  if (stddev <= 4) label = 'CONSENSUS_FORT';
  else if (stddev <= 9 && !crossesFifty) label = 'CONSENSUS';
  else if (crossesFifty) label = 'CONTRADICTION'; // modèles désaccord sur le vainqueur
  else label = 'DIVERGENT';
  return {
    mean_p_home: +mean.toFixed(1), stddev: +stddev.toFixed(1), range: [+lo.toFixed(1), +hi.toFixed(1)],
    label, crosses_fifty: crossesFifty,
    contrarian: contrarian ? { name: contrarian.name, p: contrarian.p, dist: +maxDist.toFixed(1) } : null,
    n_models: valid.length,
  };
}

// ════════════════════════════════════════════════════════════════════════════
//  AJUSTEMENTS CONTEXTUELS — blessures (ESPN), repos/B2B, line movement, Kelly
// ════════════════════════════════════════════════════════════════════════════

// (1) Impact blessures : croise injuries ESPN avec le leader (PPG) du match
function computeNbaInjuryImpact(teamId, leaderName) {
  const inj = _injuries.map && _injuries.map[teamId];
  if (!inj || !inj.length) return { n_out: 0, stars_out: [], penalty_pts: 0, out_list: [] };
  const isOut = (s) => /out|doubtful/i.test(s || '');
  const out = inj.filter(x => isOut(x.status));
  const ln = (leaderName || '').toLowerCase();
  const stars = out.filter(x => ln && x.name.toLowerCase() === ln);
  const others = out.length - stars.length;
  let penalty = stars.length * STAR_OUT_PTS + others * ROLE_OUT_PTS;
  penalty = Math.min(penalty, 9); // cap (équipe décimée)
  return {
    n_out: out.length, stars_out: stars.map(x => x.name),
    penalty_pts: +penalty.toFixed(1), out_list: out.slice(0, 6).map(x => `${x.name} (${x.status})`),
  };
}

// (2) Repos / Back-to-back depuis Elo file (last_game)
function computeNbaRest(teamId, gameDateISO) {
  const elo = _loadNbaElo();
  const r = elo && elo.ratings && elo.ratings[teamId];
  if (!r || !r.last_game || !gameDateISO) return null;
  const days = (new Date(gameDateISO).getTime() - new Date(r.last_game).getTime()) / 86400000;
  if (!(days >= 0) || days > 30) return null;
  const b2b = days <= 1.2;
  return { rest_days: Math.round(days), b2b, penalty_pts: b2b ? B2B_PTS : 0 };
}

// (3) Line movement open→close (spread + total) → signal sharp/steam
function computeNbaLineMovement(rawOdds) {
  if (!rawOdds) return null;
  const out = {};
  const ps = rawOdds.pointSpread;
  if (ps && ps.home && ps.home.open && ps.home.close) {
    const o = parseFloat(ps.home.open.line), c = parseFloat(ps.home.close.line);
    if (Number.isFinite(o) && Number.isFinite(c) && o !== c) {
      out.spread = { open: o, close: c, move: +(c - o).toFixed(1), toward: c < o ? 'home' : 'away' };
    }
  }
  const tot = rawOdds.total;
  if (tot && tot.over && tot.over.open && tot.over.close) {
    const o = parseFloat(String(tot.over.open.line).replace(/[ou]/i, ''));
    const c = parseFloat(String(tot.over.close.line).replace(/[ou]/i, ''));
    if (Number.isFinite(o) && Number.isFinite(c) && o !== c) {
      out.total = { open: o, close: c, move: +(c - o).toFixed(1), toward: c > o ? 'over' : 'under' };
    }
  }
  return Object.keys(out).length ? out : null;
}

// (4) Kelly stake (cap 25%, sur EV worst-case) — fairProb = proba modèle, dec = cote décimale brute
function computeNbaKelly(modelProb, decimalOdds) {
  if (modelProb == null || !decimalOdds || decimalOdds <= 1) return null;
  const p = modelProb / 100, b = decimalOdds - 1;
  const k = (b * p - (1 - p)) / b; // Kelly
  if (k <= 0) return { fraction: 0, capped: 0, note: 'pas de mise (EV≤0)' };
  const capped = Math.min(k, 0.25); // cap 25% bankroll (règle CLAUDE.md)
  return { fraction: +(k * 100).toFixed(1), capped: +(capped * 100).toFixed(1) };
}

// (5) Win prob ajustée contexte (margin-space) : base Elo margin + Δ blessures + Δ repos
function computeNbaAdjusted(baseMargin, injHome, injAway, restHome, restAway) {
  if (baseMargin == null) return null;
  const pAway = (injAway ? injAway.penalty_pts : 0) + (restAway ? restAway.penalty_pts : 0);
  const pHome = (injHome ? injHome.penalty_pts : 0) + (restHome ? restHome.penalty_pts : 0);
  const delta = pAway - pHome; // home gagne en marge si away plus pénalisé
  const adjMargin = +(baseMargin + delta).toFixed(1);
  const p = _normCdf(adjMargin / SD_MARGIN);
  return {
    p_home: +(p * 100).toFixed(1), p_away: +((1 - p) * 100).toFixed(1),
    base_margin: baseMargin, adj_margin: adjMargin, delta_pts: +delta.toFixed(1),
  };
}

// ─── Devig moneyline 2-way (proportionnel) → fair + EV (cotes en SORTIE) ─────────
function _devigEv(mlHome, mlAway, model) {
  const iH = _amOddsToProb(mlHome), iA = _amOddsToProb(mlAway);
  if (iH == null || iA == null || !model) return null;
  const sum = iH + iA;
  const fairH = iH / sum, fairA = iA / sum; // proba marché devigged
  const mH = model.p_home / 100, mA = model.p_away / 100;
  const decH = iH > 0 ? 1 / iH : null;
  const decA = iA > 0 ? 1 / iA : null;
  // EV = p_modele * (decimal_brut) - 1  (cote brute = 1/implicite)
  const evH = decH ? +(((mH * decH) - 1) * 100).toFixed(2) : null;
  const evA = decA ? +(((mA * decA) - 1) * 100).toFixed(2) : null;
  return {
    fair_home: +(fairH * 100).toFixed(1), fair_away: +(fairA * 100).toFixed(1),
    vig_pct: +((sum - 1) * 100).toFixed(2),
    ev_home: evH, ev_away: evA,
    edge_home: +((mH - fairH) * 100).toFixed(1), edge_away: +((mA - fairA) * 100).toFixed(1),
  };
}

// ─── Normalisation d'un event ESPN → match record PariScore ──────────────────────
function _normalizeEvent(ev) {
  const comp = (ev.competitions && ev.competitions[0]) || {};
  const cs = comp.competitors || [];
  const home = cs.find(c => c.homeAway === 'home') || cs[0] || {};
  const away = cs.find(c => c.homeAway === 'away') || cs[1] || {};
  const hTeam = home.team || {}, aTeam = away.team || {};
  const odds = (comp.odds && comp.odds[0]) || null;

  const winProb = computeNbaWinProb(home.records, away.records, hTeam.id, aTeam.id);
  const total   = computeNbaTotal(home.statistics, away.statistics, hTeam.id, aTeam.id);
  // Modèles poussés
  const pyth  = computeNbaPythagorean(hTeam.id, aTeam.id);
  const ff    = computeNbaFourFactors(home.statistics, away.statistics);
  const blend = computeNbaBlend(winProb && winProb.p_home, pyth && pyth.p_home, ff && ff.p_home);
  const spreadUQD = computeNbaSpreadUQD(
    winProb && winProb.edge_elo,
    total && total.expected_total,
    odds && odds.spread,
    odds && odds.overUnder
  );

  // Value EV sur la proba BLENDED (consolidée), pas l'Elo brut
  let value = null;
  const modelForValue = blend || winProb;
  if (odds && odds.moneyline && modelForValue) {
    const mlH = odds.moneyline.home && odds.moneyline.home.close && odds.moneyline.home.close.odds;
    const mlA = odds.moneyline.away && odds.moneyline.away.close && odds.moneyline.away.close.odds;
    if (mlH && mlA) value = _devigEv(mlH, mlA, modelForValue);
  }

  // Total edge : si défense modélisée (standings) → lean réel vs ligne ; sinon indicatif.
  let totalEdge = null;
  if (total && odds && odds.overUnder != null) {
    if (total.defense_modeled && total.expected_total != null) {
      const diff = +(total.expected_total - odds.overUnder).toFixed(1);
      totalEdge = { line: odds.overUnder, model: total.expected_total, diff,
        lean: Math.abs(diff) >= 3 ? (diff > 0 ? 'OVER' : 'UNDER') : 'NEUTRAL', status: 'modeled' };
    } else {
      totalEdge = { line: odds.overUnder, combined_offense: total.combined_offense, lean: null, status: 'preliminary_no_defense' };
    }
  }

  // Modèles de comparaison & contradiction (indépendants du blend)
  const srs = computeNbaSRS(hTeam.id, aTeam.id);
  const recentForm = computeNbaRecentForm(hTeam.id, aTeam.id);
  const modelsPanel = [
    { name: 'Elo', p: winProb && winProb.p_home },
    { name: 'Pythagorean', p: pyth && pyth.p_home },
    { name: 'Four Factors', p: ff && ff.p_home },
    { name: 'SRS', p: srs && srs.p_home },
    { name: 'Recent L10', p: recentForm && recentForm.p_home },
    { name: 'Marché', p: value && value.fair_home },
  ].filter(m => m.p != null);
  // Ajustements contextuels : blessures (ESPN), repos/B2B, line movement, adjusted, Kelly
  const leadH = _ppgLeader(home), leadA = _ppgLeader(away);
  const injHome = computeNbaInjuryImpact(hTeam.id, leadH);
  const injAway = computeNbaInjuryImpact(aTeam.id, leadA);
  const restHome = computeNbaRest(hTeam.id, ev.date);
  const restAway = computeNbaRest(aTeam.id, ev.date);
  const lineMovement = computeNbaLineMovement(odds);
  const adjusted = computeNbaAdjusted(spreadUQD && spreadUQD.exp_margin, injHome, injAway, restHome, restAway);
  if (adjusted) modelsPanel.push({ name: 'Ajusté', p: adjusted.p_home });
  const consensus = computeNbaConsensus(modelsPanel); // sur modèles indépendants (hors blend)
  // Kelly sur le côté EV+ (proba ajustée si dispo, sinon blend)
  let kelly = null;
  if (value && odds && odds.moneyline) {
    const evH = value.ev_home, evA = value.ev_away;
    const useHome = (evH != null ? evH : -99) >= (evA != null ? evA : -99);
    const ml = useHome ? (odds.moneyline.home && odds.moneyline.home.close && odds.moneyline.home.close.odds)
                       : (odds.moneyline.away && odds.moneyline.away.close && odds.moneyline.away.close.odds);
    const ip = _amOddsToProb(ml);
    const prob = adjusted ? (useHome ? adjusted.p_home : adjusted.p_away) : (blend ? (useHome ? blend.p_home : blend.p_away) : null);
    if (ip && prob != null) {
      const k = computeNbaKelly(prob, 1 / ip);
      if (k) kelly = { side: useHome ? (hTeam.displayName || 'Home') : (aTeam.displayName || 'Away'), ...k, ev: useHome ? evH : evA };
    }
  }

  return {
    id: ev.id,
    date: ev.date,
    name: ev.name,
    status: (comp.status && comp.status.type && comp.status.type.state) || 'pre',
    status_detail: (comp.status && comp.status.type && comp.status.type.shortDetail) || '',
    series: comp.series ? comp.series.summary : null,
    home: {
      id: hTeam.id, name: hTeam.displayName, abbr: hTeam.abbreviation, logo: hTeam.logo, color: hTeam.color,
      score: home.score != null ? parseInt(home.score, 10) : null,
      record: _recordSummary(home.records, 'total'),
      avg_pts: _statVal(home.statistics, 'avgPoints'),
      efg_pct: _efgPct(home.statistics), ft_rate: _ftRate(home.statistics),
    },
    away: {
      id: aTeam.id, name: aTeam.displayName, abbr: aTeam.abbreviation, logo: aTeam.logo, color: aTeam.color,
      score: away.score != null ? parseInt(away.score, 10) : null,
      record: _recordSummary(away.records, 'total'),
      avg_pts: _statVal(away.statistics, 'avgPoints'),
      efg_pct: _efgPct(away.statistics), ft_rate: _ftRate(away.statistics),
    },
    odds: odds ? {
      provider: odds.provider && odds.provider.displayName,
      details: odds.details, spread: odds.spread, over_under: odds.overUnder,
      ml_home: odds.moneyline && odds.moneyline.home && odds.moneyline.home.close && odds.moneyline.home.close.odds,
      ml_away: odds.moneyline && odds.moneyline.away && odds.moneyline.away.close && odds.moneyline.away.close.odds,
    } : null,
    predictions: {
      win_prob: winProb, blended: blend, pythagorean: pyth, four_factors: ff,
      srs, recent_form: recentForm, adjusted,
      injuries: { home: injHome, away: injAway }, rest: { home: restHome, away: restAway },
      line_movement: lineMovement, kelly,
      models_panel: modelsPanel, consensus,
      total, total_edge: totalEdge, spread_uqd: spreadUQD, value,
    },
    note: 'Elo game-by-game + Pythagorean + Four Factors → blend. UQD analytique IC90. Indépendant des cotes (EV en sortie). NON calibré vs marché — devig-vs-Pinnacle requis avant signal BET.',
  };
}

// ─── Top bets prédictifs (rank déterministe depuis les modèles, pas LLM) ─────────
// Edge commun = points de % (pp) vs marché/50. ML: edge vs fair devig ; ATS/OU: prob - 50.
function computeNbaTopBets(matches, topN = 3) {
  const cands = [];
  for (const m of (matches || [])) {
    const p = m.predictions || {}, val = p.value || {}, su = p.spread_uqd || {}, te = p.total_edge || {};
    const lbl = (m.away && m.away.abbr || '?') + ' @ ' + (m.home && m.home.abbr || '?');
    // Moneyline value (edge modèle vs cote devigée)
    if (val.edge_home != null && val.ev_home != null && val.edge_home > 1.5) {
      cands.push({ matchId: m.id, match: lbl, market: 'Moneyline', selection: (m.home && m.home.name) || 'Home', edge_pp: +val.edge_home.toFixed(1), ev: val.ev_home, basis: 'blend vs cote devigée' });
    }
    if (val.edge_away != null && val.ev_away != null && val.edge_away > 1.5) {
      cands.push({ matchId: m.id, match: lbl, market: 'Moneyline', selection: (m.away && m.away.name) || 'Away', edge_pp: +val.edge_away.toFixed(1), ev: val.ev_away, basis: 'blend vs cote devigée' });
    }
    // ATS (spread cover)
    if (su.ats_pick && su.ats_pick !== 'NEUTRAL' && su.p_home_cover != null) {
      const cover = su.ats_pick === 'HOME' ? su.p_home_cover : (100 - su.p_home_cover);
      const sel = su.ats_pick === 'HOME' ? (m.home && m.home.name) : (m.away && m.away.name);
      cands.push({ matchId: m.id, match: lbl, market: 'Spread' + (m.odds && m.odds.spread != null ? ' ' + (su.ats_pick === 'HOME' ? m.odds.spread : -m.odds.spread) : ''), selection: sel || su.ats_pick, edge_pp: +(cover - 50).toFixed(1), cover_pct: cover, basis: 'marge UQD vs ligne' });
    }
    // Total O/U
    if (su.ou_lean && su.ou_lean !== 'NEUTRAL' && su.p_over != null && te.line != null) {
      const prob = su.ou_lean === 'OVER' ? su.p_over : (100 - su.p_over);
      cands.push({ matchId: m.id, match: lbl, market: 'Total ' + su.ou_lean + ' ' + te.line, selection: su.ou_lean, edge_pp: +(prob - 50).toFixed(1), prob_pct: prob, basis: 'total modèle vs ligne' });
    }
  }
  cands.sort((a, b) => b.edge_pp - a.edge_pp);
  return cands.slice(0, topN);
}

// ─── Public ──────────────────────────────────────────────────────────────────────
async function getWnbaMatches() {
  if (Date.now() - _cache.ts < TTL_MS && _cache.data) return _cache.data;
  await Promise.all([
    _fetchStandings().catch(() => {}),   // défense (PF/PA)
    _fetchInjuries().catch(() => {}),    // blessures
  ]);
  const d = await httpsGetJson(ESPN_HOST, ESPN_SCOREBOARD);
  const events = (d && Array.isArray(d.events)) ? d.events : [];
  const matches = events.map(_normalizeEvent).filter(m => m.id);
  _cache = { ts: Date.now(), data: matches };
  return matches;
}

async function getWnbaMatchById(id) {
  const all = await getWnbaMatches();
  return all.find(m => String(m.id) === String(id)) || null;
}

// ════════════════════════════════════════════════════════════════════════════
//  PLAYER PROPS (joueuses) — projections PTS/REB/AST par matchup
//  Métriques (recherche web : dimers/sportsgrid) : minutes/usage, moyenne/match,
//  forme, pace + défense adverse. Modèle : projection = avg × pace_adj ;
//  P(over) Normal (points, sur-dispersé) / Poisson (rebonds/passes). Photos ESPN.
// ════════════════════════════════════════════════════════════════════════════
const _rosterCache = {};      // teamId   -> { ts, players }
const _playerAvgCache = {};   // athleteId-> { ts, avg }
const _propsCache = {};       // matchId  -> { ts, data }
const PROP_TTL   = 60 * 60 * 1000;     // 1h props
const PLAYER_TTL = 12 * 3600 * 1000;   // 12h roster/avg

async function _fetchRoster(teamId) {
  if (!teamId) return [];
  const c = _rosterCache[teamId];
  if (c && Date.now() - c.ts < PLAYER_TTL) return c.players;
  const d = await httpsGetJson(ESPN_HOST, `/apis/site/v2/sports/basketball/wnba/teams/${teamId}/roster`);
  let ath = (d && Array.isArray(d.athletes)) ? d.athletes : [];
  if (ath.length && ath[0] && Array.isArray(ath[0].items)) ath = ath.flatMap(g => g.items || []); // groupé par poste
  const players = ath.map(a => ({
    id: a.id, name: a.displayName || a.fullName,
    pos: (a.position && a.position.abbreviation) || '',
    jersey: a.jersey || '', photo: (a.headshot && a.headshot.href) || null,
  })).filter(p => p.id && p.name);
  if (players.length) _rosterCache[teamId] = { ts: Date.now(), players };
  return players;
}

async function _fetchPlayerAvg(athleteId) {
  if (!athleteId) return null;
  const c = _playerAvgCache[athleteId];
  if (c && Date.now() - c.ts < PLAYER_TTL) return c.avg;
  const d = await httpsGetJson('site.web.api.espn.com', `/apis/common/v3/sports/basketball/wnba/athletes/${athleteId}/stats`);
  const cats = (d && Array.isArray(d.categories)) ? d.categories : [];
  const avgCat = cats.find(x => /average/i.test((x.name || '') + (x.displayName || '')));
  const split = avgCat && avgCat.statistics && avgCat.statistics[0];
  const names = (avgCat && (avgCat.names || avgCat.labels)) || [];
  if (!split || !Array.isArray(split.stats)) { _playerAvgCache[athleteId] = { ts: Date.now(), avg: null }; return null; }
  const val = (k) => { const i = names.indexOf(k); const v = i >= 0 ? parseFloat(split.stats[i]) : NaN; return Number.isFinite(v) ? v : null; };
  const avg = {
    gp: val('gamesPlayed'), min: val('avgMinutes'),
    pts: val('avgPoints'), reb: val('avgRebounds'), ast: val('avgAssists'),
    stl: val('avgSteals'), blk: val('avgBlocks'), tov: val('avgTurnovers'),
  };
  _playerAvgCache[athleteId] = { ts: Date.now(), avg };
  return avg;
}

// P(X > line) — points ~ Normal (sur-dispersé), rebonds/passes ~ Poisson
function _poissonCdf(k, lam) { if (lam <= 0) return 1; let s = 0, t = Math.exp(-lam); for (let i = 0; i <= k; i++) { s += t; t *= lam / (i + 1); } return Math.min(1, s); }
function _overProb(mu, line, kind) {
  if (mu == null || mu <= 0) return null;
  if (kind === 'pts') { const sd = Math.max(3, 0.5 * Math.sqrt(mu) + 0.22 * mu); return +(100 * (1 - _normCdf((line - mu) / sd))).toFixed(0); }
  return +(100 * (1 - _poissonCdf(Math.floor(line), mu))).toFixed(0);
}

function _projectPlayer(p, avg, oppPaceAdj) {
  const proj = (mu, w) => mu == null ? null : +(mu * (1 + (oppPaceAdj - 1) * w)).toFixed(1);
  const props = [];
  const mk = (stat, label, mu, kind, floorMin) => {
    if (mu == null || mu < floorMin) return;
    const line = Math.max(0.5, Math.round(mu) - 0.5); // ligne "valeur" 0.5 sous la projection
    const over = _overProb(mu, line, kind);
    props.push({ stat, label, proj: mu, line, over_pct: over, lean: over >= 55 ? 'OVER' : over <= 45 ? 'UNDER' : 'NEUTRAL' });
  };
  mk('pts', 'Points', proj(avg.pts, 1.0), 'pts', 6);
  mk('reb', 'Rebonds', proj(avg.reb, 0.4), 'reb', 2);
  mk('ast', 'Passes', proj(avg.ast, 0.6), 'ast', 1.5);
  const conf = Math.min(100, Math.round(((avg.min || 0) / 34 * 60) + Math.min(40, (avg.gp || 0) * 4)));
  return { id: p.id, name: p.name, pos: p.pos, photo: p.photo, min: avg.min, gp: avg.gp, props, confidence: conf };
}

async function getWnbaPlayerProps(matchId) {
  const c = _propsCache[matchId];
  if (c && Date.now() - c.ts < PROP_TTL) return c.data;
  const match = await getWnbaMatchById(matchId);
  if (!match) return null;
  await _fetchStandings().catch(() => {});
  const LA = (_standings.leagueAvg || 82);
  const sideProps = async (team, opp) => {
    const roster = await _fetchRoster(team.id);
    const oppStand = _standings.map && _standings.map[opp.id];
    const oppPaceAdj = (oppStand && oppStand.avgPA) ? Math.max(0.9, Math.min(1.12, oppStand.avgPA / LA)) : 1.0;
    const out = [];
    for (const p of roster) {
      const avg = await _fetchPlayerAvg(p.id);
      if (!avg || (avg.min || 0) < 16) continue; // titulaires + rotation
      out.push(_projectPlayer(p, avg, oppPaceAdj));
    }
    out.sort((a, b) => (b.min || 0) - (a.min || 0));
    return out.slice(0, 6);
  };
  const [home, away] = await Promise.all([ sideProps(match.home, match.away), sideProps(match.away, match.home) ]);
  const allBets = [];
  [...home, ...away].forEach(pl => (pl.props || []).forEach(pr => {
    if (pr.lean !== 'NEUTRAL' && pr.over_pct != null) {
      const prob = pr.lean === 'OVER' ? pr.over_pct : (100 - pr.over_pct);
      allBets.push({ player: pl.name, photo: pl.photo, pos: pl.pos, market: pr.label + ' ' + pr.lean + ' ' + pr.line, proj: pr.proj, prob, conf: pl.confidence });
    }
  }));
  allBets.sort((a, b) => (b.prob * b.conf) - (a.prob * a.conf));
  const data = {
    match: (match.away && match.away.abbr) + ' @ ' + (match.home && match.home.abbr),
    home: { team: match.home && match.home.abbr, players: home },
    away: { team: match.away && match.away.abbr, players: away },
    top_prop_bets: allBets.slice(0, 6),
  };
  _propsCache[matchId] = { ts: Date.now(), data };
  return data;
}

module.exports = {
  getWnbaMatches,
  getWnbaMatchById,
  getWnbaPlayerProps,
  computeNbaWinProb,
  computeNbaTotal,
  computeNbaPythagorean,
  computeNbaFourFactors,
  computeNbaBlend,
  computeNbaSpreadUQD,
  computeNbaTopBets,
  computeNbaSRS,
  computeNbaRecentForm,
  computeNbaConsensus,
  computeNbaInjuryImpact,
  computeNbaRest,
  computeNbaLineMovement,
  computeNbaKelly,
  computeNbaAdjusted,
  invalidateCache() { _cache.ts = 0; },
  _normalizeEvent, _devigEv, // testing
};
