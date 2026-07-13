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

// ── 21 étapes TDF 2026 ─────────────────────────────────────────────────────────
// Source unique : data/cycling/stages-calendar.json (partagé avec le scraper Node).
// BUGFIX 2026-07-12 : le tableau inline hardcodait l'étape 10 au 2026-07-13, qui est
// un jour de repos. Tout le calendrier était décalé d'un jour à partir de l'étape 10.
// On lit désormais le JSON qui contient les dates corrigées (repos = 13 & 20 juillet),
// avec ce tableau en fallback de sécurité si le fichier manque (ne jamais casser).
const _STAGES_FALLBACK = [
  { stage:1, date:'2026-07-04', route:'Barcelona → Barcelona',     km:19.6,  type:'TTT',    elev:280,  country:'Spain', winnerType:'team' },
  { stage:2, date:'2026-07-05', route:'Tarragona → Barcelona',     km:168.3, type:'Hills',  elev:2100, country:'Spain', winnerType:'rider' },
  { stage:3, date:'2026-07-06', route:'Barcelona → Andorra',       km:182.0, type:'Mountain',elev:4200, country:'Andorra', winnerType:'rider' },
  { stage:4, date:'2026-07-07', route:'Andorra → Lleida',          km:175.0, type:'Hills',  elev:2500, country:'Spain', winnerType:'rider' },
  { stage:5, date:'2026-07-08', route:'Andorra → Andorra',         km:159.0, type:'Mountain',elev:4100, country:'Andorra', winnerType:'rider' },
  { stage:6, date:'2026-07-09', route:'Lleida → Perpignan',        km:190.0, type:'Flat',   elev:900,  country:'France', winnerType:'rider' },
  { stage:7, date:'2026-07-10', route:'Perpignan → Montpellier',   km:165.0, type:'Flat',   elev:600,  country:'France', winnerType:'rider' },
  { stage:8, date:'2026-07-11', route:'Montpellier → Nîmes',       km:165.0, type:'Flat',   elev:800,  country:'France', winnerType:'rider' },
  { stage:9, date:'2026-07-12', route:'Nîmes → Puy de Dôme',      km:184.5, type:'Mountain',elev:3800, country:'France', winnerType:'rider' },
  { stage:10,date:'2026-07-14', route:'Clermont-Ferrand → Bordeaux',km:210.0, type:'Flat',   elev:1200, country:'France', winnerType:'rider' },
  { stage:11,date:'2026-07-15', route:'Bordeaux → Toulouse',       km:185.0, type:'Flat',   elev:700,  country:'France', winnerType:'rider' },
  { stage:12,date:'2026-07-16', route:'Toulouse → Plateau de Beille',km:168.0,type:'Mountain',elev:4000,country:'France', winnerType:'rider' },
  { stage:13,date:'2026-07-17', route:'Pamiers → Superbagnères',   km:145.0, type:'Mountain',elev:3800, country:'France', winnerType:'rider' },
  { stage:14,date:'2026-07-18', route:'Tarbes → Hautacam',         km:152.0, type:'Mountain',elev:4500, country:'France', winnerType:'rider' },
  { stage:15,date:'2026-07-19', route:'Pau → Pau (ITT)',           km:32.0,  type:'ITT',    elev:380,  country:'France', winnerType:'rider' },
  { stage:16,date:'2026-07-21', route:'Agen → Limoges',            km:195.0, type:'Hills',  elev:1600, country:'France', winnerType:'rider' },
  { stage:17,date:'2026-07-22', route:'Limoges → Alès',            km:188.0, type:'Hills',  elev:2000, country:'France', winnerType:'rider' },
  { stage:18,date:'2026-07-23', route:'Alès → Valence',            km:210.0, type:'Hills',  elev:1800, country:'France', winnerType:'rider' },
  { stage:19,date:'2026-07-24', route:'Valence → Col de la Madeleine',km:165.0,type:'Mountain',elev:4600,country:'France', winnerType:'rider' },
  { stage:20,date:'2026-07-25', route:'Grenoble → Isola 2000',     km:175.0, type:'Mountain',elev:4800, country:'France', winnerType:'rider' },
  { stage:21,date:'2026-07-26', route:'Thoiry → Paris Champs-Élysées',km:133.0,type:'Flat',  elev:600,  country:'France', winnerType:'rider' },
];
// Recharge le calendrier si le fichier change (mtime), comme les autres caches du module.
var _stagesCalendarMtime = -1;
var STAGES = _STAGES_FALLBACK;
function _loadStagesFromCalendar() {
  try {
    var path = require('path');
    var fs = require('fs');
    var calPath = path.join(__dirname, '..', 'data', 'cycling', 'stages-calendar.json');
    if (!fs.existsSync(calPath)) return; // fallback reste actif
    var stat = fs.statSync(calPath);
    if (stat.mtimeMs === _stagesCalendarMtime) return; // inchangé
    var raw = JSON.parse(fs.readFileSync(calPath, 'utf8'));
    if (raw && Array.isArray(raw.stages) && raw.stages.length === 21) {
      STAGES = raw.stages;
      _stagesCalendarMtime = stat.mtimeMs;
    }
  } catch (e) {
    // Silent fallback : on garde _STAGES_FALLBACK pour ne jamais casser le service.
  }
}
_loadStagesFromCalendar();

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
// FIX QA 13-stage2-bug : _today() utilisait UTC au lieu d'Europe/Paris.
function _today() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date());
}
function _clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
function _empty(reason, extra) { return Object.assign({ ok: false, reason: reason || 'not_implemented', updatedAt: null }, extra || {}); }
function _z(arr) { var v = arr.filter(function(x) { return x != null && isFinite(x); }); var n = v.length || 1; var m = v.reduce(function(a, b) { return a + b; }, 0) / n; var sd = Math.sqrt(v.reduce(function(a, b) { return a + (b - m) * (b - m); }, 0) / n) || 1; return { m: m, sd: sd }; }

// ── Cache mémoire TTL (aligné sur le pattern f1Service.js/_cached) ────────────
// FIX 2026-07-13 : _model() relançait 4000 sims Monte-Carlo à CHAQUE requête
// /api/v1/cycling, alors que F1/basket/CS2 cachent tous leur sortie modèle. Le
// cyclisme est le seul vertical sans cache mémoire → gaspi CPU notable sous
// charge. On réutilise le même helper _cached que f1Service.js (éprouvé).
var TTL_MODEL = 10 * 60 * 1000; // sortie modèle : 10 min (aligné F1 TTL_BETS=15min,
                                // plus court car l'étape peut changer d'un jour à l'autre)
var _cycCache = {};
function _cached(key, ttl, loader) {
  var c = _cycCache[key];
  if (c && (Date.now() - c.ts) < ttl) return c.data;
  // Loader synchrone ici (_model ne fait pas d'I/O réseau, seulement du calcul CPU)
  var data = null;
  try { data = loader(); } catch (e) { data = null; }
  if (data != null) { _cycCache[key] = { ts: Date.now(), data: data }; return data; }
  // En cas d'échec : sert l'ancienne valeur (stale vaut mieux que rien), comme f1Service
  return c ? c.data : null;
}
// Invalidation explicite (utile si on veut forcer un refresh après scraping)
function _invalidateCycModelCache() { _cycCache = {}; }

// ── Find current stage ─────────────────────────────────────────────────────────
function _currentStage() {
  _loadStagesFromCalendar(); // recharge si le calendrier a changé (scraping/correction)
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
// FIX 2026-07-13 : sortie modèle cachée 10 min (TTL_MODEL) pour ne pas relancer
// 4000 sims Monte-Carlo à chaque requête. La clé intègre le n° d'étape + la date
// du jour → invalidation naturelle quand _currentStage() change (changement de
// jour ou passage en nouvelle étape), sans logique d'invalidation manuelle.
// Fallback-safe : si le calcul échoue, sert l'ancienne valeur (comme f1Service).
async function _model() {
  var stage = _currentStage();
  if (!stage) return null;
  // Clé de cache : étape + date du jour. Si la date change (minuit Europe/Paris)
  // ou que le calendrier fait avancer l'étape courante, la clé change → recompute.
  var cacheKey = 'cyc_model_s' + stage.stage + '_' + _today();
  var cached = _cached(cacheKey, TTL_MODEL, function () {
    return _computeModel(stage);
  });
  return cached;
}

function _computeModel(stage) {
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
  
  // Enrichit les bets avec photos riders + logos teams
  var enrichedBets = (m.bets || []).map(function (b) {
    var enrichedBet = Object.assign({}, b);
    // Photo du rider (champ pick ou team)
    if (b.pick) {
      enrichedBet.photo = _getRiderPhotoUrl(b.pick);
    }
    if (b.team) {
      enrichedBet.team_logo = _getTeamLogoUrl(b.team);
    }
    return enrichedBet;
  });
  
  // Enrichit les riders de la grille avec photos + logos
  var enrichedRiders = (m.riders || []).map(function (r) {
    var enrichedRider = Object.assign({}, r);
    enrichedRider.photo = _getRiderPhotoUrl(r.name);
    if (r.team) {
      enrichedRider.team_logo = _getTeamLogoUrl(r.team);
    }
    return enrichedRider;
  });
  
  // Ajoute le profil d'étape letour.fr
  var stageProfile = _getStageProfileUrl(m.stage);
  
  return {
    ok: true, stage: m.stage, date: m.date, route: m.route, km: m.km,
    type: m.type, elev: m.elev, country: m.country,
    season: 2026, race: 'Tour de France',
    calibrated: m.calibrated, note: m.note, sims: m.sims,
    bets: enrichedBets, riders: enrichedRiders,
    stage_profile: stageProfile,
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
  // Normalisation Unicode NFKD + suppression des combining marks (caron, acute, ...)
  // Gère correctement č, š, ž, ő, ű, etc. que les regex simples ne couvrent pas.
  // (Node.js supporte String.prototype.normalize depuis v0.12)
  s = s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
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
    // ── cyclingstage.com variants (noms courts / sans accents) ──
    'pogacar': 'tadej-pogacar',
    'tadej pogacar': 'tadej-pogacar',
    'tadej pogačar': 'tadej-pogacar',
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

    // ── Mock cyclingService.js — 21 riders manquants (Task 10-riders-inventory) ──
    // GC contenders
    'rogl': 'primoz-roglic',
    'primoz roglic': 'primoz-roglic',
    'primož roglič': 'primoz-roglic',
    'roglic': 'primoz-roglic',
    'landa': 'mikel-landa',
    'mikel landa': 'mikel-landa',
    'ayate': 'adam-yates',
    'adam yates': 'adam-yates',
    'yates': 'simon-yates',
    'simon yates': 'simon-yates',
    'gaudu': 'david-gaudu',
    'david gaudu': 'david-gaudu',
    // Puncheurs / Classics
    'wva': 'wout-van-aert',
    'wout van aert': 'wout-van-aert',
    'bett': 'alberto-bettiol',
    'alberto bettiol': 'alberto-bettiol',
    'bettiol': 'alberto-bettiol',
    'moho': 'matej-mohoric',
    'matej mohoric': 'matej-mohoric',
    'matej mohorič': 'matej-mohoric',
    'mohoric': 'matej-mohoric',
    'kung': 'stefan-kung',
    'stefan kung': 'stefan-kung',
    'stefan küng': 'stefan-kung',
    'turg': 'anthony-turgis',
    'anthony turgis': 'anthony-turgis',
    'turgis': 'anthony-turgis',
    // Sprinteurs
    'phil': 'jasper-philipsen',
    'jasper philipsen': 'jasper-philipsen',
    'philipsen': 'jasper-philipsen',
    'girm': 'biniam-girmay',
    'biniam girmay': 'biniam-girmay',
    'girmay': 'biniam-girmay',
    'mila': 'jonathan-milan',
    'jonathan milan': 'jonathan-milan',
    'milan': 'jonathan-milan',
    'groe': 'dylan-groenewegen',
    'dylan groenewegen': 'dylan-groenewegen',
    'groenewegen': 'dylan-groenewegen',
    'jako': 'fabio-jakobsen',
    'fabio jakobsen': 'fabio-jakobsen',
    'jakobsen': 'fabio-jakobsen',
    'dema': 'arnaud-demare',
    'arnaud demare': 'arnaud-demare',
    'arnaud démare': 'arnaud-demare',
    'demare': 'arnaud-demare',
    'wels': 'sam-welsford',
    'sam welsford': 'sam-welsford',
    'welsford': 'sam-welsford',
    'lapo': 'christophe-laporte',
    'christophe laporte': 'christophe-laporte',
    'laporte': 'christophe-laporte',
    // Baroudeurs / équipiers
    'lutc': 'alexey-lutsenko',
    'alexey lutsenko': 'alexey-lutsenko',
    'lutsenko': 'alexey-lutsenko',
    'heal': 'ben-healy',
    'ben healy': 'ben-healy',
    'healy': 'ben-healy',
    'cort': 'magnus-cort',
    'magnus cort': 'magnus-cort',
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
  // 1. Cherche par slug direct
  var slug = _slugifyCyc(teamName);
  if (photos.teams[slug] && photos.teams[slug].local_path && (photos.teams[slug].status === 'ok' || photos.teams[slug].status === 'placeholder')) {
    return '/api/v1/cycling/images/teams/' + slug;
  }
  // 2. Fallback : mapping d'alias (noms mock vs noms cyclingstage.com)
  var normalizedName = String(teamName).toLowerCase().trim();
  var TEAM_ALIAS = {
    // Mock names → cyclingstage slugs
    'uae team emirates': 'uae-emirates',
    'uae team emirates xrg': 'uae-emirates',
    'visma-lease a bike': 'visma-lease-a-bike',
    'team visma-lease a bike': 'visma-lease-a-bike',
    'visma | lease a bike': 'visma-lease-a-bike',
    'soudal quick-step': null,  // pas de logo dans l'index
    'red bull-bora-hansgrohe': 'red-bull-bora-hansgrohe',
    'red bull–bora–hansgrohe': 'red-bull-bora-hansgrohe',
    'ef education-easypost': 'ef-education-easypost',
    'jayco-alula': null,  // pas de logo
    'groupama-fdj': null,  // pas de logo
    'ineos grenadiers': 'netcompany-ineos',
    'netcompany-ineos': 'netcompany-ineos',
    'netcompany–ineos': 'netcompany-ineos',
    'lidl-trek': 'lidl-trek',
    'lidl–trek': 'lidl-trek',
    'bahrain victorious': null,  // pas de logo
    'totalenergies': null,  // pas de logo
    'intermarché-wanty': null,  // pas de logo
    'dsm-firmenich postnl': null,  // pas de logo
    'arkéa-b&b hotels': null,  // pas de logo
    'astana qazaqstan': null,  // pas de logo
    'uno-x mobility': null,  // pas de logo
    'alpecin-deceuninck': 'alpecin-premier-tech',
    'alpecin premier tech': 'alpecin-premier-tech',
    'decathlon cma cgm': 'decathlon-cma-cgm',
    'decathlon ag2r la mondiale': 'decathlon-cma-cgm',
  };
  var aliasSlug = TEAM_ALIAS[normalizedName];
  if (aliasSlug && photos.teams[aliasSlug] && photos.teams[aliasSlug].local_path && (photos.teams[aliasSlug].status === 'ok' || photos.teams[aliasSlug].status === 'placeholder')) {
    return '/api/v1/cycling/images/teams/' + aliasSlug;
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
  // BUGFIX 2026-07-12 : le drapeau `translated` était mis à `(lang !== 'en')` même
  // quand aucune traduction n'existait → le frontend affichait un badge "Traduit auto"
  // sur du contenu anglais brut. Désormais `translated` reflète la réalité : true
  // seulement si on a réellement servi une traduction pour cette langue.
  var trEntry = null;
  if (lang !== 'en' && i18nData && i18nData.stages && i18nData.stages[String(stageN)] && i18nData.stages[String(stageN)].i18n) {
    trEntry = i18nData.stages[String(stageN)].i18n[lang];
  }
  if (trEntry) {
    // Traduction trouvée pour cette langue : on l'utilise champ par champ, avec
    // fallback individuel sur l'EN si un champ spécifique manque dans la traduction.
    response.title = trEntry.title || stageData.title;
    response.description = trEntry.description || stageData.description;
    response.weather_forecast = trEntry.weather_forecast || stageData.weather_forecast;
    response.publication_info = trEntry.publication_info || stageData.publication_info;
    response.translated = true;
    response.translated_at = i18nData.i18n_last_update;
  } else {
    // Aucune traduction trouvée pour cette langue : on sert l'EN brut.
    response.title = stageData.title;
    response.description = stageData.description;
    response.weather_forecast = stageData.weather_forecast;
    response.publication_info = stageData.publication_info;
    response.translated = false;
    // Indique au frontend pourquoi on sert de l'EN (pour affichage honnête)
    if (lang !== 'en') {
      response.fallback_reason = 'no_translation';
      response.fallback_lang = 'en';
    }
  }

  // Favouris avec photos + logos
  response.favourites_raw = stageData.favourites_raw;
  response.favourites = (stageData.favourites || []).map(function (fav) {
    var enriched = {
      tier: fav.tier,
      team: fav.team,
      riders: fav.riders || [],
    };
    if (fav.team) {
      enriched.team_logo = _getTeamLogoUrl(fav.team);
    }
    enriched.riders = (fav.riders || []).map(function (riderName) {
      return {
        name: riderName,
        photo: _getRiderPhotoUrl(riderName),
      };
    });
    return enriched;
  });

  // Ajoute le profil d'étape letour.fr
  response.stage_profile = _getStageProfileUrl(stageN);

  return response;
}

// ── Stage profile (letour.fr) ────────────────────────────────────────────────
var _profilesIndexCache = null;
var _profilesIndexMtime = 0;

function _loadProfilesIndex() {
  try {
    var path = require('path');
    var fs = require('fs');
    var pPath = path.join(__dirname, '..', 'data', 'cycling', 'images', 'profiles', 'index.json');
    if (!fs.existsSync(pPath)) return null;
    var stat = fs.statSync(pPath);
    var mtime = stat.mtimeMs;
    if (_profilesIndexCache && mtime === _profilesIndexMtime) {
      return _profilesIndexCache;
    }
    var raw = fs.readFileSync(pPath, 'utf8');
    _profilesIndexCache = JSON.parse(raw);
    _profilesIndexMtime = mtime;
    return _profilesIndexCache;
  } catch (e) {
    return null;
  }
}

function _getStageProfileUrl(stageN) {
  var profiles = _loadProfilesIndex();
  if (!profiles || !profiles.stages) return null;
  var entry = profiles.stages[String(stageN)];
  if (entry && entry.local_path && entry.status === 'ok') {
    return '/api/v1/cycling/images/profiles/stage-' + stageN;
  }
  return null;
}

function _getStageProfilePath(stageN) {
  var profiles = _loadProfilesIndex();
  if (!profiles || !profiles.stages) return null;
  var entry = profiles.stages[String(stageN)];
  if (!entry || !entry.local_path) return null;
  var path = require('path');
  return path.join(__dirname, '..', entry.local_path);
}

// ── Classifications + Leader board ───────────────────────────────────────────
// Pour l'instant, le TdF 2026 n'a pas commencé (départ 4 juillet).
// On renvoie un état "course pas encore commencée" + un leader board basé sur
// les favoris du modèle (top 3 par win proba).

async function getClassifications(stageN, options) {
  options = options || {};
  var lang = options.lang || 'en';

  if (!stageN) {
    var m = await _model();
    stageN = m ? m.stage : 1;
  }

  // Pour l'instant, le TdF n'a pas commencé → on renvoie un état "non commencé"
  // avec les favoris du modèle comme "leader board" prédictif.
  var m = await _model();
  if (!m) {
    return {
      ok: false,
      error: 'model_unavailable',
      message: 'Modèle non disponible',
      stage: stageN,
    };
  }

  // Calcule la date de l'étape
  var stageDate = null;
  try {
    var STAGES_DATES = {
      1: '2026-07-04', 2: '2026-07-05', 3: '2026-07-06', 4: '2026-07-07',
      5: '2026-07-08', 6: '2026-07-09', 7: '2026-07-10', 8: '2026-07-11',
      9: '2026-07-12', 10: '2026-07-14', 11: '2026-07-15', 12: '2026-07-16',
      13: '2026-07-17', 14: '2026-07-18', 15: '2026-07-19', 16: '2026-07-21',
      17: '2026-07-22', 18: '2026-07-23', 19: '2026-07-24', 20: '2026-07-25',
      21: '2026-07-26'
    };
    stageDate = STAGES_DATES[stageN] || null;
  } catch (e) {}

  var now = new Date();
  var todayStr = now.toISOString().slice(0, 10);
  var stageStarted = stageDate && stageDate <= todayStr;
  var stageFinished = stageDate && stageDate < todayStr;

  // Top 3 riders par win% pour le leader board prédictif
  var sortedRiders = (m.riders || []).slice().sort(function (a, b) {
    return (b.win || 0) - (a.win || 0);
  });
  var top3 = sortedRiders.slice(0, 3).map(function (r, i) {
    return {
      position: i + 1,
      rider: r.name,
      code: r.code,
      team: r.team,
      team_logo: _getTeamLogoUrl(r.team),
      photo: _getRiderPhotoUrl(r.name),
      win_prob: r.win,
      podium_prob: r.podium,
      top10_prob: r.top10,
    };
  });

  // Jerseys prédictifs (basés sur le type de rider)
  var jerseys = {
    yellow: top3[0] || null,  // GC leader
    green: null,              // Sprinter — on prend le sprinter avec le plus haut win%
    polka: null,              // Grimpeur — on prend le grimpeur avec le plus haut win%
    white: null,              // Young rider — on prend le plus jeune (mock, on prend le 3e)
  };
  // Pour l'instant, on mock les jerseys avec top3 (à affiner quand TdF commence)
  jerseys.green = top3[1] || null;
  jerseys.polka = top3[2] || null;
  jerseys.white = top3[2] || null;

  return {
    ok: true,
    stage: stageN,
    lang: lang,
    stage_date: stageDate,
    stage_started: stageStarted,
    stage_finished: stageFinished,
    race_status: stageFinished ? 'finished' : (stageStarted ? 'live' : 'upcoming'),
    // Classement par étape (vide tant que la course n'est pas finie)
    stage_classification: stageFinished ? [] : [],
    // Classement général (vide tant que la course n'est pas finie)
    gc_classification: stageFinished ? [] : [],
    // Classements par maillot (vides tant que la course n'est pas finie)
    jersey_classifications: {
      yellow: stageFinished ? [] : [],
      green: stageFinished ? [] : [],
      polka: stageFinished ? [] : [],
      white: stageFinished ? [] : [],
    },
    // Leader board prédictif (top 3 favoris du modèle) — visible en attendant
    leader_board: top3,
    jerseys_predicted: jerseys,
    note: stageFinished
      ? 'Résultats officiels non disponibles — à scraper depuis letour.fr après l\'étape'
      : 'Course à venir — leader board basé sur les probabilités du modèle',
  };
}

// ── Health check (fraîcheur du scraping) ───────────────────────────────────────
// Vérifie l'âge de data/cycling/stage-favourites.json pour détecter un pipeline
// de scraping à l'arrêt. Sert la route /api/v1/cycling/_health.
// Alerte si > STALE_THRESHOLD_H (défaut 24h).
var STALE_THRESHOLD_H = 24;
async function getHealth() {
  _loadStagesFromCalendar();
  var result = {
    ok: true,
    status: 'healthy',
    checked_at: new Date().toISOString(),
    current_stage: null,
    scraped_stages: 0,
    expected_stages: STAGES.length,
    missing_stages: [],
    last_update: null,
    last_update_age_hours: null,
    stale: false,
    calendar_version: null,
  };

  // Étape courante selon le calendrier
  var cs = _currentStage();
  if (cs) result.current_stage = cs.stage;

  // Lecture du JSON scrapé
  var data = _loadStageFavourites();
  if (!data) {
    result.ok = false;
    result.status = 'critical';
    result.error = 'stage-favourites.json introuvable — scraper jamais exécuté ou fichier supprimé';
    return result;
  }
  result.last_update = data.last_update || null;
  if (data.stages) {
    result.scraped_stages = Object.keys(data.stages).length;
    // Étapes manquantes (parmi les 21 attendues)
    for (var i = 1; i <= STAGES.length; i++) {
      if (!data.stages[String(i)]) result.missing_stages.push(i);
    }
  }

  // Âge du dernier update
  if (data.last_update) {
    try {
      var ageMs = Date.now() - new Date(data.last_update).getTime();
      result.last_update_age_hours = +(ageMs / 3600000).toFixed(2);
      if (result.last_update_age_hours > STALE_THRESHOLD_H) {
        result.stale = true;
        result.status = 'stale';
      }
    } catch (e) {
      result.last_update_age_hours = null;
    }
  } else {
    result.stale = true;
    result.status = 'stale';
  }

  // Version du calendrier (pour confirmer qu'on lit le fichier corrigé)
  try {
    var path = require('path');
    var fs = require('fs');
    var calPath = path.join(__dirname, '..', 'data', 'cycling', 'stages-calendar.json');
    var raw = JSON.parse(fs.readFileSync(calPath, 'utf8'));
    result.calendar_version = raw.version || null;
  } catch (e) { /* ignore */ }

  // Statut dégradé si étapes manquantes
  if (result.missing_stages.length && result.status === 'healthy') {
    result.status = 'degraded';
  }

  return result;
}

module.exports = {
  getCyclingStages: getCyclingStages,
  getCyclingBets: getCyclingBets,
  getCyclingRiders: getCyclingRiders,
  getCyclingFull: getCyclingFull,
  getStageFavourites: getStageFavourites,
  getClassifications: getClassifications,
  getHealth: getHealth,
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
  _getStageProfilePath: _getStageProfilePath,
  _getRiderPhotoUrl: _getRiderPhotoUrl,
  _getTeamLogoUrl: _getTeamLogoUrl,
  _meta: { model: 'plackett-luce-v1-mock', sources: ['procyclingstats', 'cycling-design/stages/', 'cyclingstage.com', 'letour.fr', 'wikipedia'], MC_SIMS: MC_SIMS, betas: { climb: BETA_CLIMB, sprint: BETA_SPRINT, gc: BETA_GC, form: BETA_FORM }, temp: TEMP },
};
