'use strict';
/**
 * basketballService.js — Vertical NBA (ESPN public, JS-natif, zero-dep)
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

const ESPN_HOST = 'site.api.espn.com';
const ESPN_SCOREBOARD = '/apis/site/v2/sports/basketball/nba/scoreboard';
const HCA_PTS   = 3.2;     // home-court advantage (points) — littérature NBA ~2.5-3.5
const PTS_PER_ELO = 28;    // ~28 pts NBA spread par 400 Elo (calibrable)
const ELO_DIV   = 400;
const TTL_MS    = 90 * 1000; // 90s cache live

let _cache = { ts: 0, data: null };

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

function computeNbaWinProb(homeRec, awayRec) {
  const rH = _teamRating(homeRec, true);
  const rA = _teamRating(awayRec, false);
  if (rH == null || rA == null) return null;
  const hcaElo = (HCA_PTS / PTS_PER_ELO) * ELO_DIV; // HCA points → Elo
  const diff = (rH + hcaElo) - rA;
  const pHome = 1 / (1 + Math.pow(10, -diff / ELO_DIV));
  return {
    home_rating: Math.round(rH), away_rating: Math.round(rA),
    p_home: +(pHome * 100).toFixed(1), p_away: +((1 - pHome) * 100).toFixed(1),
    edge_elo: Math.round(diff),
  };
}

// ─── Total O/U (scoring saison, INDÉPENDANT des cotes) ──────────────────────────
// ⚠️ Total PRÉLIMINAIRE : avgPoints = scoring offensif saison, défense adverse NON modélisée
// (ESPN scoreboard n'expose pas points-allowed). Biaisé haut (surtout playoffs, pace lent).
// Phase 2 : intégrer defensive rating via team-stats endpoint → expected = f(offRtg, defRtg, pace).
// En v1 : expose la somme offensive comme INDICATIF, sans émettre de lean BET.
function computeNbaTotal(homeStats, awayStats) {
  const ptsH = _statVal(homeStats, 'avgPoints');
  const ptsA = _statVal(awayStats, 'avgPoints');
  if (ptsH == null || ptsA == null) return null;
  const combinedOffense = +(ptsH + ptsA).toFixed(1);
  return { combined_offense: combinedOffense, home_avg_pts: ptsH, away_avg_pts: ptsA, defense_modeled: false };
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

  const winProb = computeNbaWinProb(home.records, away.records);
  const total   = computeNbaTotal(home.statistics, away.statistics);

  let value = null;
  if (odds && odds.moneyline && winProb) {
    const mlH = odds.moneyline.home && odds.moneyline.home.close && odds.moneyline.home.close.odds;
    const mlA = odds.moneyline.away && odds.moneyline.away.close && odds.moneyline.away.close.odds;
    if (mlH && mlA) value = _devigEv(mlH, mlA, winProb);
  }

  // Total : INDICATIF uniquement (défense non modélisée en v1) — pas de lean BET émis.
  let totalEdge = null;
  if (total && odds && odds.overUnder != null) {
    totalEdge = { line: odds.overUnder, combined_offense: total.combined_offense,
      lean: null, status: 'preliminary_no_defense' };
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
    predictions: { win_prob: winProb, total, total_edge: totalEdge, value },
    note: 'Modèle records+scoring indépendant des cotes. NON calibré — backtest Brier requis avant signal BET.',
  };
}

// ─── Public ──────────────────────────────────────────────────────────────────────
async function getNbaMatches() {
  if (Date.now() - _cache.ts < TTL_MS && _cache.data) return _cache.data;
  const d = await httpsGetJson(ESPN_HOST, ESPN_SCOREBOARD);
  const events = (d && Array.isArray(d.events)) ? d.events : [];
  const matches = events.map(_normalizeEvent).filter(m => m.id);
  _cache = { ts: Date.now(), data: matches };
  return matches;
}

async function getNbaMatchById(id) {
  const all = await getNbaMatches();
  return all.find(m => String(m.id) === String(id)) || null;
}

module.exports = {
  getNbaMatches,
  getNbaMatchById,
  computeNbaWinProb,
  computeNbaTotal,
  invalidateCache() { _cache.ts = 0; },
  _normalizeEvent, _devigEv, // testing
};
