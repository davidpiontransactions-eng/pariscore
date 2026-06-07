'use strict';
/**
 * f1Service.js — Vertical Formule 1 (JS-natif, zero-dep)  ·  bd ParisScorebis-ttcp / 5tar
 *
 * MODÈLE v2 (recherche-driven, bd 5tar) — ROL hiérarchique approximé, sans entraînement :
 *   Strength latente additive  η_i = β_car·CarRating + β_drv·DriverSkill + β_quali·QualiPace
 *                                  + β_form·RecentForm + β_trk·TrackAffinity
 *   - CarRating  : performance ÉCURIE (constructor standings, mutualise les 2 pilotes) — la voiture
 *                  explique 64–88% de la variance (van Kesteren 2023 ; arXiv 2508.00200).
 *   - DriverSkill: skill PILOTE = delta vs coéquipier (annule la voiture), shrink James-Stein K=4
 *                  → rookies/early-season retombent sur la note d'écurie (régularisation).
 *   - QualiPace  : ÉCART TEMPS qualif en % du poleman (Q3→Q2→Q1), pas la grille (ρ≈0.78 ère hybride).
 *   - RecentForm : 5 derniers GP, décroissance exp(−0.075·Δround).
 *   - TrackAffinity : historique circuit, shrink K=3.
 *   s_i = exp(η_i / T)  (T = température de calibration, ré-glable sur back-test Brier).
 *
 *   DNF à 2 niveaux (Beta-Binomial, prior 0.10 force 20) :
 *     p_car (mécanique → écurie, mutualisé) ⊕ p_drv (incident → pilote) ; p_DNF = 1−(1−p_car)(1−p_drv).
 *
 *   Simulateur conservé : Plackett-Luce séquentiel (tirage DNF puis ordre d'arrivée) → win/podium/top10 + H2H.
 *   UQD : SE binomiale → IC95. calibrated=false tant que Brier/reliability non mesurés (règle CLAUDE.md UQD).
 *
 * Sources : Jolpica-Ergast (api.jolpi.ca). Réf : arXiv 2203.08489, arXiv 2508.00200, arXiv 2507.10966,
 *           Henderson-Kirrane 2018 (PL tronqué/pondéré temps), martiningram.github.io/f1-model.
 * Contrat fallback-safe : ne throw JAMAIS → { ok:false, reason }.
 */
const https = require('https');
const fs = require('fs');
const path = require('path');

const JOLPICA_HOST = 'api.jolpi.ca';
const TTL_STAND = 10 * 60 * 1000;    // standings / quali / results : 10 min
const TTL_SCHED = 60 * 60 * 1000;    // calendrier : 1 h
const TTL_TRACK = 24 * 3600 * 1000;  // historique circuit : 24 h
const TTL_BETS  = 15 * 60 * 1000;    // sortie modèle : 15 min
const MC_SIMS   = 4000;
const RECENT_FORM_GP = 5;            // fenêtre form
const DECAY_ROUND = 0.075;           // décroissance par manche (arXiv 2508.00200)
// Coefficients log-odds sur features standardisées (ancrés σ littérature : car 1.63 / driver 0.54)
const BETA_CAR = 1.6, BETA_DRV = 0.55, BETA_QUALI = 0.9, BETA_FORM = 0.4, BETA_TRACK = 0.25;
const SHRINK_DRV = 4, SHRINK_TRK = 3, TEMP = 1.0;
const DNF_PRIOR = 0.10, DNF_STRENGTH = 20; // Beta-Binomial : moyenne 10%, force ~20 départs
const INCIDENT_DNF = /accident|collision|spun|disqualif|damage|contact|debris|did not start/i;

function _today() { return new Date().toISOString().slice(0, 10); }
function _clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
function _empty(reason, extra) { return Object.assign({ ok: false, reason: reason || 'not_implemented', updatedAt: null }, extra || {}); }
function _z(arr) { const v = arr.filter(x => x != null && isFinite(x)); const n = v.length || 1; const m = v.reduce((a, b) => a + b, 0) / n; const sd = Math.sqrt(v.reduce((a, b) => a + (b - m) * (b - m), 0) / n) || 1; return { m: m, sd: sd }; }

// Assets statiques (photos pilotes + logos écuries) — cf .context/_resolve_f1_assets.js
let _assets = null;
function _loadAssets() {
  if (_assets) return _assets;
  try { _assets = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'f1_assets.json'), 'utf8')); }
  catch (e) { _assets = { drivers: {}, teams: {} }; }
  return _assets;
}

// ── HTTP JSON (zero-dep) ────────────────────────────────────────────────────
function _getJson(host, p) {
  return new Promise((resolve) => {
    const req = https.request({ host, path: p, method: 'GET', headers: { 'User-Agent': 'PariScore/1.0', 'Accept': 'application/json' } }, r => {
      let d = ''; r.on('data', c => d += c); r.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { resolve(null); } });
    });
    req.on('error', () => resolve(null));
    req.setTimeout(12000, () => { req.destroy(); resolve(null); });
    req.end();
  });
}

const _cache = {};
async function _cached(key, ttl, loader) {
  const c = _cache[key];
  if (c && (Date.now() - c.ts) < ttl) return c.data;
  let data = null;
  try { data = await loader(); } catch (e) { data = null; }
  if (data != null) { _cache[key] = { ts: Date.now(), data }; return data; }
  return c ? c.data : null;
}

function _lapMs(t) {
  if (!t) return 0;
  const m = /^(\d+):(\d+(?:\.\d+)?)$/.exec(t);
  if (m) return (parseInt(m[1], 10) * 60 + parseFloat(m[2])) * 1000;
  const f = parseFloat(t); return isFinite(f) ? f * 1000 : 0;
}
function _isDnf(status) { return !!status && !/^Finished$/.test(status) && !/^\+\d+ Lap/.test(status); }
function _code(drv) { return drv.code || drv.driverId; }

// ── Jolpica fetchers ─────────────────────────────────────────────────────────
async function _standings() {
  return _cached('standings', TTL_STAND, async () => {
    const j = await _getJson(JOLPICA_HOST, '/ergast/f1/current/driverStandings.json');
    const lst = j && j.MRData && j.MRData.StandingsTable && j.MRData.StandingsTable.StandingsLists && j.MRData.StandingsTable.StandingsLists[0];
    if (!lst) return null;
    const round = parseInt(lst.round, 10) || 1;
    const drivers = (lst.DriverStandings || []).map(d => ({
      code: _code(d.Driver), id: d.Driver.driverId,
      name: ((d.Driver.givenName || '') + ' ' + (d.Driver.familyName || '')).trim(),
      team: (d.Constructors && d.Constructors[0] && d.Constructors[0].name) || '',
      teamId: (d.Constructors && d.Constructors[0] && d.Constructors[0].constructorId) || '_none',
      points: parseFloat(d.points) || 0, wins: parseInt(d.wins, 10) || 0, pos: parseInt(d.position, 10) || 99,
    }));
    return { season: lst.season, round, drivers };
  });
}

// Standings ÉCURIES → proxy propre de la performance voiture (mutualise les 2 pilotes).
async function _constructorStandings() {
  return _cached('cstand', TTL_STAND, async () => {
    const j = await _getJson(JOLPICA_HOST, '/ergast/f1/current/constructorStandings.json');
    const lst = j && j.MRData && j.MRData.StandingsTable && j.MRData.StandingsTable.StandingsLists && j.MRData.StandingsTable.StandingsLists[0];
    if (!lst) return null;
    const round = parseInt(lst.round, 10) || 1;
    const map = {};
    (lst.ConstructorStandings || []).forEach(c => { const pts = parseFloat(c.points) || 0; map[c.Constructor.constructorId] = pts / Math.max(1, round); });
    return { round, map };
  });
}

// Qualif : écart TEMPS au poleman (fraction), + grille en repli.
async function _lastQuali() {
  return _cached('quali', TTL_STAND, async () => {
    const j = await _getJson(JOLPICA_HOST, '/ergast/f1/current/last/qualifying.json');
    const r = j && j.MRData && j.MRData.RaceTable && j.MRData.RaceTable.Races && j.MRData.RaceTable.Races[0];
    if (!r) return null;
    const res = (r.QualifyingResults || []).map(q => ({ code: _code(q.Driver), pos: parseInt(q.position, 10) || 99, ms: _lapMs(q.Q3 || q.Q2 || q.Q1) }));
    const times = res.map(x => x.ms).filter(x => x > 0);
    const pole = times.length ? Math.min.apply(null, times) : 0;
    const byCode = {};
    res.forEach(x => { byCode[x.code] = { pos: x.pos, gap: (pole && x.ms > 0) ? (x.ms - pole) / pole : null }; });
    return { circuit: r.Circuit && r.Circuit.circuitId, n: res.length, byCode };
  });
}

// Historique saison : form (5 GP décroissants) + delta coéquipier (skill) + DNF attribué (car vs incident).
async function _raceHistory() {
  return _cached('history', TTL_STAND, async () => {
    const j = await _getJson(JOLPICA_HOST, '/ergast/f1/current/results.json?limit=700');
    const races = (j && j.MRData && j.MRData.RaceTable && j.MRData.RaceTable.Races) || [];
    if (!races.length) return null;
    const maxRound = Math.max.apply(null, races.map(r => parseInt(r.round, 10) || 0));
    const formS = {}, formW = {}, deltaS = {}, deltaW = {}, starts = {}, drvDnf = {}, carDnf = {}, carStarts = {};
    let fieldN = 20;
    for (const r of races) {
      const round = parseInt(r.round, 10) || 0;
      const w = Math.exp(-DECAY_ROUND * (maxRound - round));
      const res = r.Results || []; const N = res.length || 20; fieldN = Math.max(fieldN, N);
      const byTeam = {};
      for (const x of res) { const tid = (x.Constructor && x.Constructor.constructorId) || '_none'; (byTeam[tid] = byTeam[tid] || []).push(x); }
      for (const x of res) {
        const code = _code(x.Driver), tid = (x.Constructor && x.Constructor.constructorId) || '_none';
        const pos = parseInt(x.position, 10) || N, isDnf = _isDnf(x.status), score = isDnf ? 0 : (N + 1 - pos) / N;
        starts[code] = (starts[code] || 0) + 1;
        carStarts[tid] = (carStarts[tid] || 0) + 1;
        if (isDnf) { if (INCIDENT_DNF.test(x.status)) drvDnf[code] = (drvDnf[code] || 0) + 1; else carDnf[tid] = (carDnf[tid] || 0) + 1; }
        if (round > maxRound - RECENT_FORM_GP) { formS[code] = (formS[code] || 0) + w * score; formW[code] = (formW[code] || 0) + w; }
        const mate = (byTeam[tid] || []).filter(y => _code(y.Driver) !== code)[0];
        if (mate && !isDnf && !_isDnf(mate.status)) {
          const mScore = (N + 1 - (parseInt(mate.position, 10) || N)) / N;
          deltaS[code] = (deltaS[code] || 0) + w * (score - mScore); deltaW[code] = (deltaW[code] || 0) + w;
        }
      }
    }
    const formAvg = {}, deltaAvg = {};
    for (const c in formS) formAvg[c] = formW[c] ? formS[c] / formW[c] : null;
    for (const c in deltaS) deltaAvg[c] = deltaW[c] ? deltaS[c] / deltaW[c] : 0;
    return { formAvg, deltaAvg, starts, drvDnf, carDnf, carStarts, fieldN, maxRound };
  });
}

async function _schedule() {
  return _cached('schedule', TTL_SCHED, async () => {
    const j = await _getJson(JOLPICA_HOST, '/ergast/f1/current.json');
    const races = (j && j.MRData && j.MRData.RaceTable && j.MRData.RaceTable.Races) || [];
    if (!races.length) return null;
    return races.map(r => ({ round: parseInt(r.round, 10), name: r.raceName, date: r.date,
      circuit: r.Circuit && r.Circuit.circuitId, country: r.Circuit && r.Circuit.Location && r.Circuit.Location.country }));
  });
}
function _nextRace(sched) { if (!sched || !sched.length) return null; const t = _today(); return sched.find(r => r.date >= t) || sched[sched.length - 1]; }

async function _trackHistory(circuitId) {
  if (!circuitId) return {};
  return _cached('track:' + circuitId, TTL_TRACK, async () => {
    const j = await _getJson(JOLPICA_HOST, '/ergast/f1/circuits/' + circuitId + '/results.json?limit=200');
    const races = (j && j.MRData && j.MRData.RaceTable && j.MRData.RaceTable.Races) || [];
    const hist = {};
    for (const r of races.slice(-5)) for (const x of (r.Results || [])) {
      const code = _code(x.Driver), n = (r.Results || []).length || 20, pos = parseInt(x.position, 10) || n;
      (hist[code] = hist[code] || []).push((n + 1 - pos) / n);
    }
    return hist;
  });
}

// ── Construction des strengths (ROL hiérarchique approximé) ───────────────────
async function _build() {
  const [stand, cstand, quali, hist, sched] = await Promise.all([_standings(), _constructorStandings(), _lastQuali(), _raceHistory(), _schedule()]);
  if (!stand || !stand.drivers.length) return null;
  const A = _loadAssets();
  const next = _nextRace(sched);
  const track = next ? await _trackHistory(next.circuit) : {};
  const cmap = (cstand && cstand.map) || {};
  const H = hist || { formAvg: {}, deltaAvg: {}, starts: {}, drvDnf: {}, carDnf: {}, carStarts: {} };

  const raw = stand.drivers.map(d => {
    const th = track[d.code];
    return {
      d: d,
      carPerf: (cmap[d.teamId] != null) ? cmap[d.teamId] : (d.points / Math.max(1, stand.round)),
      delta: (H.deltaAvg[d.code] != null) ? H.deltaAvg[d.code] : 0,
      gap: (quali && quali.byCode[d.code] && quali.byCode[d.code].gap != null) ? quali.byCode[d.code].gap : null,
      form: (H.formAvg[d.code] != null) ? H.formAvg[d.code] : null,
      trackScore: (th && th.length) ? th.reduce((s, x) => s + x, 0) / th.length : null,
      trackN: (th && th.length) || 0,
      starts: H.starts[d.code] || 0,
    };
  });
  const zCar = _z(raw.map(x => x.carPerf)), zDelta = _z(raw.map(x => x.delta));
  const zGap = _z(raw.map(x => x.gap)), zForm = _z(raw.map(x => x.form)), zTrack = _z(raw.map(x => x.trackScore));
  const aDnf = DNF_PRIOR * DNF_STRENGTH, bDnf = (1 - DNF_PRIOR) * DNF_STRENGTH;

  const drivers = raw.map(x => {
    const d = x.d;
    const CarRating = (x.carPerf - zCar.m) / zCar.sd;
    const DriverSkill = (x.starts / (x.starts + SHRINK_DRV)) * ((x.delta - zDelta.m) / zDelta.sd);
    const QualiPace = (x.gap != null) ? -((x.gap - zGap.m) / zGap.sd) : 0;
    const RecentForm = (x.form != null) ? ((x.form - zForm.m) / zForm.sd) : 0;
    const TrackAff = (x.trackScore != null) ? (x.trackN / (x.trackN + SHRINK_TRK)) * ((x.trackScore - zTrack.m) / zTrack.sd) : 0;
    const eta = BETA_CAR * CarRating + BETA_DRV * DriverSkill + BETA_QUALI * QualiPace + BETA_FORM * RecentForm + BETA_TRACK * TrackAff;
    const pCar = ((H.carDnf[d.teamId] || 0) + aDnf) / ((H.carStarts[d.teamId] || 0) + aDnf + bDnf);
    const pDrv = ((H.drvDnf[d.code] || 0) + aDnf) / (x.starts + aDnf + bDnf);
    const pDNF = _clamp01(1 - (1 - pCar) * (1 - pDrv));
    return {
      code: d.code, name: d.name, team: d.team, teamId: d.teamId, pos: d.pos, points: d.points, wins: d.wins,
      ppg: +(d.points / Math.max(1, stand.round)).toFixed(1),
      carRating: +CarRating.toFixed(2), driverSkill: +DriverSkill.toFixed(2), qualiPace: +QualiPace.toFixed(2),
      formScore: +RecentForm.toFixed(2), trackScore: +TrackAff.toFixed(2), eta: +eta.toFixed(3),
      dnfRate: +pDNF.toFixed(3), reliability: +(1 - pDNF).toFixed(3),
      strength: Math.exp(eta / TEMP),
      photo: (A.drivers[d.code] && A.drivers[d.code].photo) || null,
      logo: (A.teams[d.teamId] && A.teams[d.teamId].logo) || null,
    };
  });
  return { season: stand.season, round: stand.round, next, fieldN: stand.drivers.length, drivers };
}

// ── Monte-Carlo course : DNF (2 niveaux) puis ordre séquentiel Plackett-Luce ──
function _simulate(drivers) {
  const M = MC_SIMS;
  const win = {}, pod = {}, top10 = {};
  drivers.forEach(d => { win[d.code] = 0; pod[d.code] = 0; top10[d.code] = 0; });
  const byTeam = {}; drivers.forEach(d => { (byTeam[d.teamId] = byTeam[d.teamId] || []).push(d); });
  const pairs = []; Object.keys(byTeam).forEach(k => { const g = byTeam[k]; if (k !== '_none' && g.length >= 2) pairs.push([g[0], g[1]]); });
  const h2h = {}; pairs.forEach(p => h2h[p[0].code + '|' + p[1].code] = 0);
  for (let s = 0; s < M; s++) {
    const finishers = [], dnfList = [];
    for (const d of drivers) (Math.random() < d.dnfRate ? dnfList : finishers).push(d);
    let sum = finishers.reduce((a, x) => a + x.strength, 0);
    const rem = finishers.slice(), order = [];
    while (rem.length) {
      let r = Math.random() * sum, k = 0;
      while (k < rem.length - 1 && (r -= rem[k].strength) > 0) k++;
      order.push(rem[k].code); sum -= rem[k].strength; rem.splice(k, 1);
    }
    for (let i = dnfList.length - 1; i >= 0; i--) order.push(dnfList[i].code);
    if (order[0]) win[order[0]]++;
    for (let i = 0; i < order.length; i++) { const c = order[i]; if (i < 3) pod[c]++; if (i < 10) top10[c]++; }
    const rank = {}; order.forEach((c, i) => rank[c] = i);
    for (const p of pairs) { const ra = rank[p[0].code], rb = rank[p[1].code]; if ((ra == null ? 99 : ra) < (rb == null ? 99 : rb)) h2h[p[0].code + '|' + p[1].code]++; }
  }
  const se = p => Math.sqrt(p * (1 - p) / M);
  const probs = {};
  drivers.forEach(d => { probs[d.code] = { win: win[d.code] / M, podium: pod[d.code] / M, top10: top10[d.code] / M, winSE: se(win[d.code] / M), podiumSE: se(pod[d.code] / M), top10SE: se(top10[d.code] / M) }; });
  const pairOut = pairs.map(p => { const v = h2h[p[0].code + '|' + p[1].code] / M; return { team: p[0].team, a: p[0].code, aName: p[0].name, b: p[1].code, bName: p[1].name, pA: v, pB: 1 - v, se: se(v) }; });
  return { probs, pairs: pairOut, sims: M };
}

function _ci(p, se) { return [+_clamp01(p - 1.96 * se).toFixed(3), +_clamp01(p + 1.96 * se).toFixed(3)]; }

async function _model() {
  return _cached('model', TTL_BETS, async () => {
    const built = await _build();
    if (!built) return null;
    const sim = _simulate(built.drivers);
    const D = built.drivers.map(d => Object.assign({}, d, sim.probs[d.code]));
    const winner = D.slice().sort((a, b) => b.win - a.win)[0];
    const h2hRanked = sim.pairs.map(p => ({ p: p, edge: Math.max(p.pA, p.pB) }));
    const h2h = (h2hRanked.filter(x => x.edge >= 0.55 && x.edge <= 0.90).sort((a, b) => b.edge - a.edge)[0]
              || h2hRanked.sort((a, b) => b.edge - a.edge)[0] || { p: null }).p;
    const top10pick = D.filter(d => d.top10 >= 0.45 && d.top10 <= 0.90)
                        .sort((a, b) => (b.reliability - a.reliability) || (b.top10 - a.top10))[0]
                   || D.slice().sort((a, b) => (b.top10 * b.reliability) - (a.top10 * a.reliability))[0];
    const bets = [];
    if (winner) bets.push({
      type: 'podium_winner', label: 'Podium / Vainqueur', market: 'Vainqueur ' + (built.next ? built.next.name : 'prochain GP'),
      pick: winner.name, code: winner.code, team: winner.team, photo: winner.photo, logo: winner.logo,
      prob: +winner.win.toFixed(3), probPct: +(winner.win * 100).toFixed(1), podium: +winner.podium.toFixed(3),
      ci95: _ci(winner.win, winner.winSE),
    });
    if (h2h) {
      const aAhead = h2h.pA >= h2h.pB, p = Math.max(h2h.pA, h2h.pB);
      const hd = D.find(function (x) { return x.code === (aAhead ? h2h.a : h2h.b); }) || {};
      bets.push({
        type: 'teammate_h2h', label: 'H2H coéquipiers', market: h2h.team + ' — duel interne',
        pick: (aAhead ? h2h.aName : h2h.bName) + ' devant ' + (aAhead ? h2h.bName : h2h.aName),
        code: aAhead ? h2h.a : h2h.b, team: h2h.team, photo: hd.photo || null, logo: hd.logo || null,
        prob: +p.toFixed(3), probPct: +(p * 100).toFixed(1), ci95: _ci(p, h2h.se),
      });
    }
    if (top10pick) bets.push({
      type: 'top10_reliability', label: 'Top 10 / Fiabilité', market: 'Top 10 ' + (built.next ? built.next.name : 'prochain GP'),
      pick: top10pick.name, code: top10pick.code, team: top10pick.team, photo: top10pick.photo, logo: top10pick.logo,
      prob: +top10pick.top10.toFixed(3), probPct: +(top10pick.top10 * 100).toFixed(1),
      reliability: top10pick.reliability, ci95: _ci(top10pick.top10, top10pick.top10SE),
    });
    return {
      season: built.season, round: built.round, race: built.next, fieldN: built.fieldN, sims: sim.sims,
      model: 'rol-hierarchique-v2', calibrated: false,
      note: 'Modèle v2 (écurie/pilote dissociés, shrinkage, écart-temps qualif, DNF 2 niveaux) — non calibré (Brier/reliability à mesurer), probas indicatives, aucun signal BET dur (règle CLAUDE.md UQD).',
      drivers: D, bets,
    };
  });
}

// ── API publique ─────────────────────────────────────────────────────────────
async function getF1Races() {
  const s = await _schedule();
  if (!s) return _empty('schedule_unavailable', { races: [] });
  return { ok: true, updatedAt: new Date().toISOString(), next: _nextRace(s), races: s };
}

async function getF1Drivers() {
  const m = await _model();
  if (!m) return _empty('data_unavailable', { drivers: [] });
  return { ok: true, updatedAt: new Date().toISOString(), season: m.season, round: m.round, race: m.race, model: m.model, calibrated: m.calibrated, drivers: m.drivers };
}

async function getF1ValueBets() {
  const m = await _model();
  if (!m) return _empty('model_unavailable', { bets: [] });
  return { ok: true, updatedAt: new Date().toISOString(), season: m.season, round: m.round, race: m.race, model: m.model, calibrated: m.calibrated, note: m.note, sims: m.sims, bets: m.bets };
}

module.exports = {
  getF1Races, getF1Drivers, getF1ValueBets,
  _meta: { model: 'rol-hierarchique-v2', sources: ['jolpica-ergast'], MC_SIMS, betas: { car: BETA_CAR, drv: BETA_DRV, quali: BETA_QUALI, form: BETA_FORM, track: BETA_TRACK }, temp: TEMP },
};
