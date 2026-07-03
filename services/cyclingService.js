'use strict';
/**
 * cyclingService.js — Cyclisme vertical (Tour de France 2026), mock data + ELO
 *
 * MODÈLE v1 (mock, non calibré) — basé sur les profils d'étape de cycling-design/stages/ :
 *   Strength = β_climb·ClimbRating + β_sprint·SprintSkill + β_gc·GCPotential + β_form·RecentForm
 *   - ClimbRating : score du rider en montagne (W/kg estimé)
 *   - SprintSkill  : vitesse terminale au sprint
 *   - GCPotential  : aptitude au classement général (récupération + chrono)
 *   - RecentForm   : forme estimée (début Tour = 0.75, monte en 2e semaine)
 *
 *   s_i = exp(η_i / T)   (T = température)
 *   Simulateur : Plackett-Luce séquentiel → win/podium/top10 + H2H
 *
 * Sources : ProCyclingStats (PCS), profils étape cycling-design/stages/
 * Contrat fallback-safe : ne throw JAMAIS → { ok:false, reason }
 */

const MC_SIMS = 4000;
const TEMP = 1.0;

// ── DNF modeling ──
const DNF_K = 0.25; // strength protection factor
const DNF_BASE = { TTT:0.05, Flat:0.04, Hills:0.12, Mountain:0.25, ITT:0.03 };

const BETA_CLIMB = 1.4, BETA_SPRINT = 0.9, BETA_GC = 0.7, BETA_FORM = 0.5;

// ── 21 étapes TDF 2026 (données consolidées des fichiers cycling-design/stages/) ──
const STAGES = [
  { stage:1, date:'2026-07-04', route:'Barcelona → Barcelona',     km:19.6,  type:'TTT',    elev:280,  country:'Spain', winnerType:'team' },
  { stage:2, date:'2026-07-05', route:'Tarragona → Barcelona',     km:168.3, type:'Hills',  elev:2100, country:'Spain', winnerType:'rider' },
  { stage:3, date:'2026-07-06', route:'Barcelona → Andorra',       km:182.0, type:'Mountain',elev:4200, country:'Andorra', winnerType:'rider' },
  { stage:4, date:'2026-07-07', route:'Andorra → Lleida',          km:175.0, type:'Hills',  elev:2500, country:'Spain', winnerType:'rider' },
  { stage:5, date:'2026-07-08', route:'Andorra → Andorra',         km:159.0, type:'Mountain',elev:4100, country:'Andorra', winnerType:'rider' },
  { stage:6, date:'2026-07-09', route:'Lleida → Perpignan',        km:190.0, type:'Flat',   elev:900,  country:'France', winnerType:'rider' },
  { stage:7, date:'2026-07-10', route:'Perpignan → Montpellier',   km:165.0, type:'Flat',   elev:600,  country:'France', winnerType:'rider' },
  { stage:8, date:'2026-07-11', route:'Montpellier → Nîmes',       km:165.0, type:'Flat',   elev:800,  country:'France', winnerType:'rider' },
  { stage:9, date:'2026-07-12', route:'Nîmes → Puy de Dôme',      km:184.5, type:'Mountain',elev:3800, country:'France', winnerType:'rider' },
  { stage:10,date:'2026-07-13', route:'Clermont-Ferrand → Bordeaux',km:210.0, type:'Flat',   elev:1200, country:'France', winnerType:'rider' },
  { stage:11,date:'2026-07-14', route:'Bordeaux → Toulouse',       km:185.0, type:'Flat',   elev:700,  country:'France', winnerType:'rider' },
  { stage:12,date:'2026-07-15', route:'Toulouse → Plateau de Beille',km:168.0,type:'Mountain',elev:4000,country:'France', winnerType:'rider' },
  { stage:13,date:'2026-07-16', route:'Pamiers → Superbagnères',   km:145.0, type:'Mountain',elev:3800, country:'France', winnerType:'rider' },
  { stage:14,date:'2026-07-17', route:'Tarbes → Hautacam',         km:152.0, type:'Mountain',elev:4500, country:'France', winnerType:'rider' },
  { stage:15,date:'2026-07-18', route:'Pau → Pau (ITT)',           km:32.0,  type:'ITT',    elev:380,  country:'France', winnerType:'rider' },
  { stage:16,date:'2026-07-20', route:'Agen → Limoges',            km:195.0, type:'Hills',  elev:1600, country:'France', winnerType:'rider' },
  { stage:17,date:'2026-07-21', route:'Limoges → Alès',            km:188.0, type:'Hills',  elev:2000, country:'France', winnerType:'rider' },
  { stage:18,date:'2026-07-22', route:'Alès → Valence',            km:210.0, type:'Hills',  elev:1800, country:'France', winnerType:'rider' },
  { stage:19,date:'2026-07-23', route:'Valence → Col de la Madeleine',km:165.0,type:'Mountain',elev:4600,country:'France', winnerType:'rider' },
  { stage:20,date:'2026-07-25', route:'Grenoble → Isola 2000',     km:175.0, type:'Mountain',elev:4800, country:'France', winnerType:'rider' },
  { stage:21,date:'2026-07-26', route:'Thoiry → Paris Champs-Élysées',km:133.0,type:'Flat',  elev:600,  country:'France', winnerType:'rider' },
];

// ── Riders database (TDF 2026) ─────────────────────────────────────────────────
const RIDERS = [
  // GC contenders (climb > sprint)
  { code:'POGA', name:'Tadej Pogačar',       team:'UAE Team Emirates',        teamId:'uae',         climb:1.00, sprint:0.35, gc:0.98, form:0.85, type:'gc', elo:1850 },
  { code:'VING', name:'Jonas Vingegaard',     team:'Visma-Lease a Bike',       teamId:'visma',       climb:0.96, sprint:0.20, gc:0.95, form:0.80, type:'gc', elo:1810 },
  { code:'EVEN', name:'Remco Evenepoel',      team:'Soudal Quick-Step',        teamId:'soudal',      climb:0.88, sprint:0.30, gc:0.90, form:0.82, type:'gc', elo:1760 },
  { code:'ROGL', name:'Primož Roglič',        team:'Red Bull-BORA-hansgrohe',  teamId:'bora',        climb:0.85, sprint:0.15, gc:0.88, form:0.78, type:'gc', elo:1720 },
  { code:'LANDA',name:'Mikel Landa',          team:'Soudal Quick-Step',        teamId:'soudal',      climb:0.78, sprint:0.10, gc:0.82, form:0.75, type:'gc', elo:1620 },
  { code:'AYATE',name:'Adam Yates',           team:'UAE Team Emirates',        teamId:'uae',         climb:0.80, sprint:0.15, gc:0.84, form:0.76, type:'gc', elo:1640 },
  { code:'CARAP',name:'Richard Carapaz',      team:'EF Education-EasyPost',    teamId:'ef',          climb:0.77, sprint:0.10, gc:0.80, form:0.72, type:'gc', elo:1580 },
  { code:'YATES',name:'Simon Yates',          team:'Jayco-AlUla',              teamId:'jayco',       climb:0.75, sprint:0.12, gc:0.78, form:0.73, type:'gc', elo:1560 },
  { code:'GAUDU',name:'David Gaudu',          team:'Groupama-FDJ',             teamId:'groupama',    climb:0.74, sprint:0.10, gc:0.76, form:0.71, type:'gc', elo:1530 },
  { code:'MARTI',name:'Lenny Martinez',       team:'Groupama-FDJ',             teamId:'groupama',    climb:0.72, sprint:0.08, gc:0.74, form:0.78, type:'gc', elo:1520 },

  // Puncheurs / Classics
  { code:'MVDP', name:'Mathieu van der Poel',  team:'Alpecin-Deceuninck',      teamId:'alpecin',     climb:0.65, sprint:0.85, gc:0.30, form:0.82, type:'puncheur', elo:1650 },
  { code:'WVA',  name:'Wout van Aert',        team:'Visma-Lease a Bike',       teamId:'visma',       climb:0.60, sprint:0.82, gc:0.35, form:0.76, type:'puncheur', elo:1630 },
  { code:'PEDE', name:'Mads Pedersen',         team:'Lidl-Trek',               teamId:'lidl',        climb:0.50, sprint:0.80, gc:0.20, form:0.80, type:'puncheur', elo:1580 },
  { code:'PIDC', name:'Tom Pidcock',           team:'INEOS Grenadiers',        teamId:'ineos',       climb:0.62, sprint:0.60, gc:0.55, form:0.78, type:'puncheur', elo:1570 },
  { code:'BETT', name:'Alberto Bettiol',       team:'EF Education-EasyPost',    teamId:'ef',          climb:0.48, sprint:0.55, gc:0.25, form:0.72, type:'puncheur', elo:1470 },
  { code:'MOHO', name:'Matej Mohorič',         team:'Bahrain Victorious',      teamId:'bahrain',     climb:0.50, sprint:0.58, gc:0.30, form:0.74, type:'puncheur', elo:1480 },
  { code:'KUNG', name:'Stefan Küng',           team:'Groupama-FDJ',            teamId:'groupama',    climb:0.38, sprint:0.50, gc:0.28, form:0.72, type:'puncheur', elo:1420 },
  { code:'TURG', name:'Anthony Turgis',        team:'TotalEnergies',           teamId:'total',       climb:0.40, sprint:0.55, gc:0.15, form:0.70, type:'puncheur', elo:1390 },

  // Sprinteurs
  { code:'PHIL', name:'Jasper Philipsen',      team:'Alpecin-Deceuninck',      teamId:'alpecin',     climb:0.15, sprint:1.00, gc:0.05, form:0.85, type:'sprinter', elo:1700 },
  { code:'GIRM', name:'Biniam Girmay',         team:'Intermarché-Wanty',       teamId:'intermarche', climb:0.25, sprint:0.90, gc:0.08, form:0.80, type:'sprinter', elo:1620 },
  { code:'MILA', name:'Jonathan Milan',        team:'Lidl-Trek',               teamId:'lidl',        climb:0.12, sprint:0.88, gc:0.05, form:0.82, type:'sprinter', elo:1600 },
  { code:'GROE', name:'Dylan Groenewegen',     team:'Jayco-AlUla',             teamId:'jayco',       climb:0.10, sprint:0.82, gc:0.03, form:0.76, type:'sprinter', elo:1530 },
  { code:'JAKO', name:'Fabio Jakobsen',        team:'DSM-Firmenich PostNL',    teamId:'dsm',         climb:0.08, sprint:0.78, gc:0.02, form:0.72, type:'sprinter', elo:1470 },
  { code:'DEMA', name:'Arnaud Démare',         team:'Arkéa-B&B Hotels',        teamId:'arkea',       climb:0.18, sprint:0.75, gc:0.06, form:0.74, type:'sprinter', elo:1460 },
  { code:'WELS', name:'Sam Welsford',          team:'Red Bull-BORA-hansgrohe',  teamId:'bora',       climb:0.08, sprint:0.70, gc:0.02, form:0.72, type:'sprinter', elo:1420 },
  { code:'LAPO', name:'Christophe Laporte',    team:'Visma-Lease a Bike',       teamId:'visma',      climb:0.32, sprint:0.68, gc:0.18, form:0.74, type:'sprinter', elo:1460 },

  // Baroudeurs / équipiers
  { code:'LUTC', name:'Alexey Lutsenko',       team:'Astana Qazaqstan',        teamId:'astana',      climb:0.68, sprint:0.20, gc:0.55, form:0.70, type:'gc', elo:1480 },
  { code:'HEAL', name:'Ben Healy',             team:'EF Education-EasyPost',    teamId:'ef',          climb:0.55, sprint:0.45, gc:0.40, form:0.78, type:'puncheur', elo:1450 },
  { code:'CORT', name:'Magnus Cort',           team:'Uno-X Mobility',          teamId:'unox',        climb:0.35, sprint:0.60, gc:0.12, form:0.74, type:'puncheur', elo:1440 },
];
const RIDERS_BY_CODE = {}; RIDERS.forEach(function(r) { RIDERS_BY_CODE[r.code] = r; });

// ── Helpers ────────────────────────────────────────────────────────────────────
function _today() { return new Date().toISOString().slice(0, 10); }
function _clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
function _empty(reason, extra) { return Object.assign({ ok: false, reason: reason || 'not_implemented', updatedAt: null }, extra || {}); }
function _z(arr) { var v = arr.filter(function(x) { return x != null && isFinite(x); }); var n = v.length || 1; var m = v.reduce(function(a, b) { return a + b; }, 0) / n; var sd = Math.sqrt(v.reduce(function(a, b) { return a + (b - m) * (b - m); }, 0) / n) || 1; return { m: m, sd: sd }; }

// ── Find current stage ─────────────────────────────────────────────────────────
function _currentStage() {
  var t = _today();
  for (var i = 0; i < STAGES.length; i++) { var s = STAGES[i]; if (s.date >= t) return s; }
  return STAGES[STAGES.length - 1];
}

// ── Strength calculation (type-aware) ──────────────────────────────────────────
function _strengthForStage(rider, stage) {
  var climbW = 0, sprintW = 0, gcW = 0, formW = 0;
  if (stage.type === 'Mountain' || stage.type === 'TTT') {
    climbW = 1.0; sprintW = 0.1; gcW = 0.8; formW = 0.6;
  } else if (stage.type === 'Hills') {
    climbW = 0.6; sprintW = 0.6; gcW = 0.3; formW = 0.5;
  } else if (stage.type === 'Flat') {
    climbW = 0.1; sprintW = 1.0; gcW = 0.1; formW = 0.5;
  } else if (stage.type === 'ITT') {
    climbW = 0.1; sprintW = 0.2; gcW = 0.6; formW = 0.5;
  }
  // TTT : team-based, rider strength less relevant
  if (stage.type === 'TTT') {
    return 1.0; // uniform for TTT
  }
  var eta = BETA_CLIMB * climbW * rider.climb + BETA_SPRINT * sprintW * rider.sprint + BETA_GC * gcW * rider.gc + BETA_FORM * formW * rider.form;
  return Math.exp(eta / TEMP);
}

// ── Monte-Carlo simulation (Plackett-Luce + DNF) ─────────────────────────────
function _simulate(riders, stage) {
  var M = MC_SIMS;
  var dnfBase = DNF_BASE[stage.type] || DNF_BASE.Hills;
  var win = {}, pod = {}, top10 = {};
  riders.forEach(function(r) { win[r.code] = 0; pod[r.code] = 0; top10[r.code] = 0; });
  for (var s = 0; s < M; s++) {
    // ── DNF draw: weaker riders DNF more on harder stages ──
    var pool = [];
    riders.forEach(function(r) {
      var dnfProb = dnfBase / (1 + r._strength * DNF_K);
      if (Math.random() >= dnfProb) pool.push(r);
    });
    if (pool.length < 2) continue; // need at least 2 for PL

    var strengths = pool.map(function(r) { return { code: r.code, strength: r._strength }; });
    var sum = strengths.reduce(function(a, x) { return a + x.strength; }, 0);
    var order = [], rem = strengths.slice();
    while (rem.length) {
      var rnd = Math.random() * sum, k = 0;
      while (k < rem.length - 1 && (rnd -= rem[k].strength) > 0) { k++; }
      order.push(rem[k].code); sum -= rem[k].strength; rem.splice(k, 1);
    }
    if (order[0]) win[order[0]]++;
    for (var i = 0; i < order.length; i++) { var c = order[i]; if (i < 3) pod[c]++; if (i < 10) top10[c]++; }
  }
  var se = function(p) { return Math.sqrt(p * (1 - p) / M); };
  var probs = {};
  riders.forEach(function(r) { probs[r.code] = { win: win[r.code] / M, podium: pod[r.code] / M, top10: top10[r.code] / M, winSE: se(win[r.code] / M), podiumSE: se(pod[r.code] / M), top10SE: se(top10[r.code] / M) }; });
  return { probs: probs, sims: M };
}

function _ci(p, se) { return [+_clamp01(p - 1.96 * se).toFixed(3), +_clamp01(p + 1.96 * se).toFixed(3)]; }

// ── Generate bets for a stage ──────────────────────────────────────────────────
function _generateBets(riders, stage, probs) {
  var bets = [];
  var ranked = riders.slice().sort(function(a, b) { return (probs[b.code] ? probs[b.code].win : 0) - (probs[a.code] ? probs[a.code].win : 0); });
  var winner = ranked[0];
  if (winner) {
    var pw = probs[winner.code] || {};
    bets.push({
      type: 'stage_winner', label: stage.winnerType === 'team' ? 'Vainqueur (équipe)' : 'Vainqueur d\'étape',
      market: 'Étape ' + stage.stage + ' — ' + stage.route,
      pick: winner.name, code: winner.code, team: winner.team,
      prob: +(pw.win || 0).toFixed(3), probPct: +((pw.win || 0) * 100).toFixed(1),
      podium: +(pw.podium || 0).toFixed(3),
      ci95: _ci(pw.win || 0, pw.winSE || 0),
    });
  }
  // H2H : best intra-team duel
  var byTeam = {}; riders.forEach(function(r) { (byTeam[r.teamId] = byTeam[r.teamId] || []).push(r); });
  var pairs = []; Object.keys(byTeam).forEach(function(k) { var g = byTeam[k]; if (k !== '_none' && g.length >= 2) pairs.push([g[0], g[1]]); });
  var bestH2H = null, bestEdge = 0;
  pairs.forEach(function(p) {
    var pA = probs[p[0].code] ? probs[p[0].code].podium || 0 : 0;
    var pB = probs[p[1].code] ? probs[p[1].code].podium || 0 : 0;
    var sum = pA + pB, edge = sum ? Math.max(pA, pB) / sum : 0.5;
    if (edge > bestEdge && edge < 0.85) { bestEdge = edge; bestH2H = { a: p[0], b: p[1], pA: pA / (sum || 1), edge: edge }; }
  });
  if (bestH2H) {
    bets.push({
      type: 'teammate_h2h', label: 'H2H équipe', market: bestH2H.a.team + ' — duel interne',
      pick: bestH2H.a.name + ' > ' + bestH2H.b.name,
      code: bestH2H.a.code, team: bestH2H.a.team,
      prob: +bestH2H.pA.toFixed(3), probPct: +(bestH2H.pA * 100).toFixed(1),
      ci95: _ci(bestH2H.pA, Math.sqrt(bestH2H.pA * (1 - bestH2H.pA) / MC_SIMS)),
    });
  }
  // Top 10 reliability pick
  var top10pick = ranked.filter(function(r) { var p = probs[r.code] || {}; return (p.top10 || 0) >= 0.30 && (p.top10 || 0) <= 0.85; }).sort(function(a, b) { return (probs[b.code] ? probs[b.code].top10 : 0) - (probs[a.code] ? probs[a.code].top10 : 0); })[0];
  if (top10pick) {
    var pt = probs[top10pick.code] || {};
    bets.push({
      type: 'top10_reliability', label: 'Top 10', market: 'Étape ' + stage.stage + ' — Top 10',
      pick: top10pick.name, code: top10pick.code, team: top10pick.team,
      prob: +(pt.top10 || 0).toFixed(3), probPct: +((pt.top10 || 0) * 100).toFixed(1),
      ci95: _ci(pt.top10 || 0, pt.top10SE || 0),
    });
  }
  return bets;
}

// ── Main model ─────────────────────────────────────────────────────────────────
async function _model() {
  var stage = _currentStage();
  if (!stage) return null;
  var ridersR = RIDERS.map(function(r) {
    return Object.assign({}, r, { _strength: _strengthForStage(r, stage) });
  });
  var sim = _simulate(ridersR, stage);
  var ridersOut = ridersR.map(function(r) {
    var p = sim.probs[r.code] || {};
    return {
      code: r.code, name: r.name, team: r.team, teamId: r.teamId,
      type: r.type, elo: r.elo,
      climb: r.climb, sprint: r.sprint, gc: r.gc,
      strength: +r._strength.toFixed(3),
      win: +(p.win || 0).toFixed(3), podium: +(p.podium || 0).toFixed(3), top10: +(p.top10 || 0).toFixed(3),
    };
  });
  var bets = _generateBets(ridersR, stage, sim.probs);
  return {
    stage: stage.stage, date: stage.date, route: stage.route, km: stage.km,
    type: stage.type, elev: stage.elev, country: stage.country,
    sims: sim.sims,
    model: 'plackett-luce-v1-mock', calibrated: false,
    note: 'Modèle v1 (mock) — basé sur 29 riders profilés (PCS data). Non calibré. Probas indicatives, aucun signal BET dur.',
    riders: ridersOut.sort(function(a, b) { return b.win - a.win; }),
    bets: bets,
  };
}

// ── Public API ─────────────────────────────────────────────────────────────────
async function getCyclingStages() {
  var stage = _currentStage();
  if (!stage) return _empty('stages_unavailable', { stages: [] });
  var idx = STAGES.indexOf(stage);
  var prev = idx > 0 ? STAGES[idx - 1] : null;
  var next = idx < STAGES.length - 1 ? STAGES[idx + 1] : null;
  return { ok: true, updatedAt: new Date().toISOString(), current: stage, prev: prev, next: next, stages: STAGES };
}

async function getCyclingBets() {
  var m = await _model();
  if (!m) return _empty('model_unavailable', { bets: [], riders: [] });
  return {
    ok: true, updatedAt: new Date().toISOString(),
    stage: m.stage, date: m.date, route: m.route, km: m.km,
    type: m.type, elev: m.elev, country: m.country,
    model: m.model, calibrated: m.calibrated, note: m.note, sims: m.sims,
    bets: m.bets, riders: m.riders,
  };
}

async function getCyclingRiders() {
  var m = await _model();
  if (!m) return _empty('data_unavailable', { riders: [] });
  return {
    ok: true, updatedAt: new Date().toISOString(),
    date: m.date, route: m.route, type: m.type,
    model: m.model, calibrated: m.calibrated,
    stage: m.stage, riders: m.riders,
  };
}

// ── Full response (1 model call, used by GET /api/v1/cycling) ──────────────────
async function getCyclingFull() {
  var m = await _model();
  if (!m) return _empty('model_unavailable', { bets: [], riders: [] });
  return {
    ok: true, stage: m.stage, date: m.date, route: m.route, km: m.km,
    type: m.type, elev: m.elev, country: m.country,
    season: 2026, race: 'Tour de France',
    calibrated: m.calibrated, note: m.note, sims: m.sims,
    bets: m.bets, riders: m.riders,
  };
}

// ── Stage favourites (scraped from cyclingstage.com) ──────────────────────────
// Charge les données scrapées depuis data/cycling/stage-favourites.json
// (généré par scripts/scraper-cyclingstage-favourites.py)
// Et les traductions depuis data/cycling/stage-favourites-i18n.json
// (généré par scripts/scraper-cycling-translate.py)
// Et l'index des photos depuis data/cycling/images/index.json
// (généré par scripts/scraper-cycling-photos.py)
var _stageFavouritesCache = null;
var _stageFavouritesMtime = 0;
var _stageFavouritesI18nCache = null;
var _stageFavouritesI18nMtime = 0;
var _photosIndexCache = null;
var _photosIndexMtime = 0;

function _slugifyCyc(name) {
  if (!name) return '';
  var s = String(name);
  // Supprime accents
  s = s.replace(/[àáâãäå]/g, 'a').replace(/[èéêë]/g, 'e')
       .replace(/[ìíîï]/g, 'i').replace(/[òóôõö]/g, 'o')
       .replace(/[ùúûü]/g, 'u').replace(/[ç]/g, 'c');
  s = s.toLowerCase().replace(/[\s|/\\]+/g, '-').replace(/[^a-z0-9-]/g, '');
  s = s.replace(/-+/g, '-').replace(/^-|-$/g, '');
  return s;
}

function _loadStageFavourites() {
  try {
    var path = require('path');
    var fs = require('fs');
    var favPath = path.join(__dirname, '..', 'data', 'cycling', 'stage-favourites.json');
    if (!fs.existsSync(favPath)) return null;
    var stat = fs.statSync(favPath);
    var mtime = stat.mtimeMs;
    // Recharge si le fichier a changé (ou pas encore en cache)
    if (_stageFavouritesCache && mtime === _stageFavouritesMtime) {
      return _stageFavouritesCache;
    }
    var raw = fs.readFileSync(favPath, 'utf8');
    _stageFavouritesCache = JSON.parse(raw);
    _stageFavouritesMtime = mtime;
    return _stageFavouritesCache;
  } catch (e) {
    console.warn('[cyclingService] _loadStageFavourites error:', e.message);
    return null;
  }
}

function _loadStageFavouritesI18n() {
  try {
    var path = require('path');
    var fs = require('fs');
    var i18nPath = path.join(__dirname, '..', 'data', 'cycling', 'stage-favourites-i18n.json');
    if (!fs.existsSync(i18nPath)) return null;
    var stat = fs.statSync(i18nPath);
    var mtime = stat.mtimeMs;
    if (_stageFavouritesI18nCache && mtime === _stageFavouritesI18nMtime) {
      return _stageFavouritesI18nCache;
    }
    var raw = fs.readFileSync(i18nPath, 'utf8');
    _stageFavouritesI18nCache = JSON.parse(raw);
    _stageFavouritesI18nMtime = mtime;
    return _stageFavouritesI18nCache;
  } catch (e) {
    return null; // silencieux — i18n est optionnel
  }
}

function _loadPhotosIndex() {
  try {
    var path = require('path');
    var fs = require('fs');
    var photosPath = path.join(__dirname, '..', 'data', 'cycling', 'images', 'index.json');
    if (!fs.existsSync(photosPath)) return null;
    var stat = fs.statSync(photosPath);
    var mtime = stat.mtimeMs;
    if (_photosIndexCache && mtime === _photosIndexMtime) {
      return _photosIndexCache;
    }
    var raw = fs.readFileSync(photosPath, 'utf8');
    _photosIndexCache = JSON.parse(raw);
    _photosIndexMtime = mtime;
    return _photosIndexCache;
  } catch (e) {
    return null;
  }
}

// Retourne l'URL de la photo d'un rider (ou null si pas trouvée)
function _getRiderPhotoUrl(riderName) {
  var photos = _loadPhotosIndex();
  if (!photos || !photos.riders) return null;
  // 1. Cherche par slug direct
  var slug = _slugifyCyc(riderName);
  if (photos.riders[slug] && photos.riders[slug].local_path && photos.riders[slug].status === 'ok') {
    return '/api/v1/cycling/images/riders/' + slug;
  }
  // 2. Fallback : cherche par nom (avec normalisation)
  //    Utile car cyclingstage utilise "Pogacar" mais l'index a "Tadej Pogačar"
  var normalizedName = String(riderName).toLowerCase().trim();
  // Mapping manuel pour les cas connus
  var NAME_FALLBACKS = {
    'pogacar': 'tadej-pogacar',
    'tadej pogacar': 'tadej-pogacar',
    'vingegaard': 'jonas-vingegaard',
    'jonas vingegaard': 'jonas-vingegaard',
    'evenepoel': 'remco-evenepoel',
    'remco evenepoel': 'remco-evenepoel',
    'van der poel': 'mathieu-van-der-poel',
    'mathieu van der poel': 'mathieu-van-der-poel',
    'carapaz': 'richard-carapaz',
    'richard carapaz': 'richard-carapaz',
    'ayuso': 'juan-ayuso',
    'juan ayuso': 'juan-ayuso',
    'skjelmose': 'mattias-skjelmose',
    'mattias skjelmose': 'mattias-skjelmose',
    'seixas': 'paul-seixas',
    'paul seixas': 'paul-seixas',
    'arensman': 'thymen-arensman',
    'thymen arensman': 'thymen-arensman',
    'vauquelin': 'kevin-vauquelin',
    'kevin vauquelin': 'kevin-vauquelin',
    'kévin vauquelin': 'kevin-vauquelin',
    'tom pidcock': 'tom-pidcock',
    'maxim van gils': 'maxim-van-gils',
    'romain grégoire': 'romain-gregoire',
    'romain gregoire': 'romain-gregoire',
    'mathias vacek': 'mathias-vacek',
    'mads pedersen': 'mads-pedersen-cyclist',
    'lenny martinez': 'lenny-martinez',
  };
  var fallbackSlug = NAME_FALLBACKS[normalizedName];
  if (fallbackSlug && photos.riders[fallbackSlug] && photos.riders[fallbackSlug].local_path && photos.riders[fallbackSlug].status === 'ok') {
    return '/api/v1/cycling/images/riders/' + fallbackSlug;
  }
  // 3. Dernier fallback : cherche un rider dont le nom contient le nom cherché
  for (var s in photos.riders) {
    var entry = photos.riders[s];
    if (entry.status === 'ok' && entry.local_path) {
      var entryName = String(entry.name || '').toLowerCase();
      // Match si le nom scrapé est contenu dans le nom indexé, ou inverse
      if (entryName.includes(normalizedName) || normalizedName.includes(entryName.split(' ').pop())) {
        return '/api/v1/cycling/images/riders/' + s;
      }
    }
  }
  return null;
}

// Retourne l'URL du logo d'une team (ou null si pas trouvée)
function _getTeamLogoUrl(teamName) {
  var photos = _loadPhotosIndex();
  if (!photos || !photos.teams) return null;
  var slug = _slugifyCyc(teamName);
  var entry = photos.teams[slug];
  if (entry && entry.local_path && (entry.status === 'ok' || entry.status === 'placeholder')) {
    return '/api/v1/cycling/images/teams/' + slug;
  }
  return null;
}

// Retourne les favoris pour une étape donnée (ou l'étape courante si stageN non fourni)
// Options : { lang: 'fr' | 'en' | ... } — si lang !== 'en', essaie de charger la traduction
async function getStageFavourites(stageN, options) {
  options = options || {};
  var lang = options.lang || 'en';

  var data = _loadStageFavourites();
  if (!data) {
    return {
      ok: false,
      error: 'no_scraped_data',
      message: 'Aucune donnée scrapée. Lancez scripts/scraper-cyclingstage-favourites.py d\'abord.',
      stage: stageN || null,
    };
  }

  // Si stageN non fourni, utilise l'étape courante du modèle
  if (!stageN) {
    var m = await _model();
    stageN = m ? m.stage : 1;
  }

  var stageData = data.stages ? data.stages[String(stageN)] : null;
  if (!stageData) {
    return {
      ok: false,
      error: 'stage_not_scraped',
      message: 'Étape ' + stageN + ' pas encore scrapée. La page cyclingstage.com n\'est peut-être pas encore publiée.',
      stage: stageN,
      available_stages: data.stages ? Object.keys(data.stages).map(Number).sort((a,b)=>a-b) : [],
      last_update: data.last_update,
    };
  }

  // Charge les traductions si lang !== 'en'
  var i18nData = null;
  if (lang !== 'en') {
    i18nData = _loadStageFavouritesI18n();
  }

  // Construit la response avec i18n + photos
  var response = {
    ok: true,
    stage: stageN,
    lang: lang,
    source: 'cyclingstage.com',
    source_url: stageData.url,
    scraped_at: stageData.scraped_at,
    last_update: data.last_update,
  };

  // Champs textuels : version EN par défaut, ou version traduite si dispo
  if (lang !== 'en' && i18nData && i18nData.stages && i18nData.stages[String(stageN)] && i18nData.stages[String(stageN)].i18n && i18nData.stages[String(stageN)].i18n[lang]) {
    var tr = i18nData.stages[String(stageN)].i18n[lang];
    response.title = tr.title || stageData.title;
    response.description = tr.description || stageData.description;
    response.weather_forecast = tr.weather_forecast || stageData.weather_forecast;
    response.publication_info = tr.publication_info || stageData.publication_info;
    response.translated = true;
    response.translated_at = i18nData.i18n_last_update;
  } else {
    response.title = stageData.title;
    response.description = stageData.description;
    response.weather_forecast = stageData.weather_forecast;
    response.publication_info = stageData.publication_info;
    response.translated = (lang !== 'en');
    // Si lang !== 'en' mais pas de traduction dispo, on indique fallback EN
  }

  // Favouris avec photos + logos
  response.favourites_raw = stageData.favourites_raw;
  response.favourites = (stageData.favourites || []).map(function (fav) {
    var enriched = {
      tier: fav.tier,
      team: fav.team,
      riders: fav.riders || [],
    };
    // Ajoute le logo de la team
    if (fav.team) {
      enriched.team_logo = _getTeamLogoUrl(fav.team);
    }
    // Ajoute la photo de chaque rider
    enriched.riders = (fav.riders || []).map(function (riderName) {
      return {
        name: riderName,
        photo: _getRiderPhotoUrl(riderName),
      };
    });
    return enriched;
  });

  return response;
}

module.exports = {
  getCyclingStages: getCyclingStages,
  getCyclingBets: getCyclingBets,
  getCyclingRiders: getCyclingRiders,
  getCyclingFull: getCyclingFull,
  getStageFavourites: getStageFavourites,
  // Expose pour la route statique images
  _getRiderPhotoPath: function (slug) {
    var photos = _loadPhotosIndex();
    if (!photos || !photos.riders || !photos.riders[slug]) return null;
    var entry = photos.riders[slug];
    if (!entry.local_path) return null;
    var path = require('path');
    return path.join(__dirname, '..', entry.local_path);
  },
  _getTeamLogoPath: function (slug) {
    var photos = _loadPhotosIndex();
    if (!photos || !photos.teams || !photos.teams[slug]) return null;
    var entry = photos.teams[slug];
    if (!entry.local_path) return null;
    var path = require('path');
    return path.join(__dirname, '..', entry.local_path);
  },
  _meta: { model: 'plackett-luce-v1-mock', sources: ['procyclingstats', 'cycling-design/stages/', 'cyclingstage.com'], MC_SIMS: MC_SIMS, betas: { climb: BETA_CLIMB, sprint: BETA_SPRINT, gc: BETA_GC, form: BETA_FORM }, temp: TEMP },
};
