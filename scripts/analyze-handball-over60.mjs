#!/usr/bin/env node
'use strict';
/**
 * analyze-handball-over60.mjs
 * ---------------------------
 * Analyse Over points + 1X2 + force des équipes sur TOUT le calendrier handball
 * (feeds Flashscore J+0..J+7).
 *
 * Sources d'historique (forme) :
 *   1. data/betexplorer_handball.json — pool `recent` (résultats FT 8 jours) + ligues cibles
 *   2. feeds Flashscore f_7_{-N..-1}   — résultats J-1..J-7 (le feed ne remonte pas au-delà)
 *   3. data/flashscore_handball.json   — matchs terminés du calendrier courant
 *
 * Modèle (moteurs existants, pas de réinvention) :
 *   - λ équipe = moyenne attaque/défense sur 10 matchs, shrinkage prior 3 matchs
 *     vers la moyenne mondiale (évite λ=neutre pour les équipes à 1 match).
 *   - Avantage domicile : convention strategy-top8 (HOME_ADV=1.8 → +0.9 / −0.45).
 *   - Calibration : facteur unique k = BASE / moyenne des totaux observés,
 *     BASE = 60 points (demande utilisateur) → λ re-scalés.
 *   - ν CMP par apparillage variance (Var observée → ν), repli 1.3 si n < 30.
 *   - P(total > ligne) via CMP ; 1X2 via Skellam.
 *
 * LIGNE ADAPTATIVE (demande utilisateur) : on part de 59.5 (« Over 60 ») et on
 * descend de 2 buts tant que P(Over) ≤ 50 % :
 *   59.5 → 58.5 → 56.5 → 54.5 → 52.5
 * La ligne retenue = plus haute ligne du calendrier avec P(Over) > 50 %.
 *
 * Usage :
 *   bun scripts/analyze-handball-over60.mjs
 *   bun scripts/analyze-handball-over60.mjs --base=60 --past=7
 *   bun scripts/analyze-handball-over60.mjs --out=.context/mon-rapport.md
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { overUnderProb, cmpPmf, cmpMean, CMP_DEFAULT_NU } from '../src/lib/handball-cmp.ts';
import { skellamMatchProbs } from '../src/lib/handball-skellam.ts';
import { loadHandballPlayers, topPlayersForTeam } from '../src/lib/handball-players.ts';
import { parseDay, fetchFeed } from './scrape-flashscore-handball.js';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_DIR = path.dirname(SCRIPT_DIR);

// ─── Args ────────────────────────────────────────────────────────────────────
const argv = new Map(
  process.argv.slice(2).map((a) => {
    const [k, v = 'true'] = a.replace(/^--/, '').split('=');
    return [k, v];
  })
);
const BASE = Number(argv.get('base') ?? 60); // points moyens visés
const PAST_DAYS = Math.min(7, Math.max(1, Number(argv.get('past') ?? 7)));
const OUT = argv.get('out') || path.join(REPO_DIR, '.context', `handball-over60-${new Date().toISOString().slice(0, 10)}.md`);

/** Lignes candidates, décroissantes (Over 60 d'abord, −2 buts ensuite). */
const LINES = [59.5, 58.5, 56.5, 54.5, 52.5];
const PROB_FLOOR = 0.5; // P(Over) minimum exigé pour retenir une ligne

const HOME_ADV = 1.8; // convention strategy-top8
const PRIOR_N = 3; // matchs de shrinkage vers la moyenne mondiale
const WINDOW = 10; // fenêtre forme (CMP_HISTORY_WINDOW)

// ─── Utilitaires ─────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const variance = (a) => {
  if (a.length < 2) return NaN;
  const m = mean(a);
  return a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1);
};
const round = (x, d = 1) => Math.round(x * 10 ** d) / 10 ** d;
const pct = (x) => `${round(x * 100, 1)}%`;

/** Clé d'équipe insensible à casse/diacritiques/ponctuation. */
function teamKey(name) {
  return String(name)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function parseScore(str) {
  if (!str) return null;
  const m = String(str).match(/(\d+)\s*-\s*(\d+)/);
  if (!m) return null;
  return { hg: parseInt(m[1], 10), ag: parseInt(m[2], 10) };
}

/**
 * ν par apparillage de variance : on cherche ν tel que Var_modèle(λ, ν) = Var observée,
 * avec λ calé pour que E_modèle = moyenne observée (bissection imbriquée).
 * Le fit MLE Newton de fitCMP non converge sur des échantillons hétérogènes
 * (λ=68.7 pour une moyenne 60.5) → on ne l'utilise pas ici.
 */
function fitNuByVariance(totals) {
  const obs = variance(totals);
  const m = mean(totals);
  if (totals.length < 30 || !Number.isFinite(obs) || m <= 0) {
    return { nu: CMP_DEFAULT_NU, obs, model: null, source: `repli ν=${CMP_DEFAULT_NU}` };
  }
  const lambdaFor = (nu) => {
    let lo = 0.3 * m;
    let hi = 3 * m;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      if (cmpMean(mid, nu) < m) lo = mid;
      else hi = mid;
    }
    return (lo + hi) / 2;
  };
  const modelVar = (nu) => {
    const pmf = cmpPmf(lambdaFor(nu), nu);
    let mu = 0;
    for (let k = 0; k < pmf.length; k++) mu += k * pmf[k];
    let v = 0;
    for (let k = 0; k < pmf.length; k++) v += (k - mu) ** 2 * pmf[k];
    return v;
  };
  let lo = 0.6;
  let hi = 3;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    if (modelVar(mid) > obs) lo = mid; // ν trop petit → variance trop grande
    else hi = mid;
  }
  const nu = (lo + hi) / 2;
  return { nu, obs, model: modelVar(nu), source: 'apparillage variance' };
}

/**
 * Ligne adaptative : plus haute ligne de LINES avec P(Over) > 50 %,
 * sinon la plus basse (signalé « aucune ligne »).
 */
function pickLine(lh, la, nu) {
  let last = null;
  for (const line of LINES) {
    const { over } = overUnderProb(lh, nu, la, nu, line);
    last = { line, over };
    if (over > PROB_FLOOR) return { ...last, ok: true };
  }
  return { ...last, ok: false };
}

// ─── Historique ──────────────────────────────────────────────────────────────
/** @type {Map<string, {home:string,away:string,hg:number,ag:number,date:string,league:string,src:string}>} */
const historyByKey = new Map();

function addHistory(e) {
  if (!e.home || !e.away || !Number.isFinite(e.hg) || !Number.isFinite(e.ag)) return;
  const key = `${teamKey(e.home)}|${teamKey(e.away)}|${e.date.slice(0, 10)}`;
  if (!historyByKey.has(key)) historyByKey.set(key, { ...e, date: e.date.slice(0, 10) });
}

function loadBetexplorer() {
  const p = path.join(REPO_DIR, 'data', 'betexplorer_handball.json');
  if (!fs.existsSync(p)) return { recent: 0, leagues: 0 };
  const d = JSON.parse(fs.readFileSync(p, 'utf8'));
  let n = 0;
  for (const r of d.recent || []) {
    if (r.status !== 'FT' || !r.score) continue;
    addHistory({ home: r.home, away: r.away, hg: r.score.home, ag: r.score.away, date: r.date, league: r.league, src: 'betexplorer' });
    n++;
  }
  let nl = 0;
  for (const l of d.leagues || []) {
    for (const m of l.matches || []) {
      if (m.status !== 'FT' || !m.score) continue;
      addHistory({ home: m.home, away: m.away, hg: m.score.home, ag: m.score.away, date: m.date, league: m.league || l.name, src: 'betexplorer-ligue' });
      nl++;
    }
  }
  return { recent: n, leagues: nl };
}

async function loadFlashscorePast() {
  let n = 0;
  for (let d = 1; d <= PAST_DAYS; d++) {
    try {
      const body = await fetchFeed(`https://2.flashscore.ninja/2/x/feed/f_7_${-d}_1_en_1`);
      for (const m of parseDay(body)) {
        if (!m.isFinished) continue;
        const sc = parseScore(m.score);
        if (!sc) continue;
        addHistory({ home: m.home, away: m.away, hg: sc.hg, ag: sc.ag, date: m.time, league: m.league, src: 'flashscore' });
        n++;
      }
    } catch (err) {
      console.error(`[over60] feed J-${d} KO : ${err.message}`);
    }
    await sleep(800);
  }
  return n;
}

function loadCalendar() {
  const p = path.join(REPO_DIR, 'data', 'flashscore_handball.json');
  const d = JSON.parse(fs.readFileSync(p, 'utf8'));
  const upcoming = [];
  let finished = 0;
  for (const m of d.matches || []) {
    if (m.isFinished) {
      const sc = parseScore(m.score);
      if (sc) {
        addHistory({ home: m.home, away: m.away, hg: sc.hg, ag: sc.ag, date: m.time, league: m.league, src: 'flashscore' });
        finished++;
      }
      continue;
    }
    if (m.isLive) continue; // en cours → analyse prematch sans objet
    upcoming.push(m);
  }
  return { scrapedAt: d.scraped_at, upcoming, finished };
}

// ─── Stats équipe ────────────────────────────────────────────────────────────
function buildTeamStats() {
  const teams = new Map();
  const get = (name) => {
    const k = teamKey(name);
    let t = teams.get(k);
    if (!t) {
      t = { key: k, name, games: [], gf: [], ga: [], w: 0, d: 0, l: 0, homeN: 0, homeW: 0, awayN: 0, awayW: 0 };
      teams.set(k, t);
    }
    return t;
  };

  for (const e of historyByKey.values()) {
    const h = get(e.home);
    const a = get(e.away);
    h.games.push({ ...e, side: 'home' });
    a.games.push({ ...e, side: 'away' });
    h.gf.push(e.hg);
    h.ga.push(e.ag);
    a.gf.push(e.ag);
    a.ga.push(e.hg);
    const hWin = e.hg > e.ag;
    const aWin = e.ag > e.hg;
    if (hWin) { h.w++; a.l++; h.homeN++; h.homeW++; a.awayN++; }
    else if (aWin) { a.w++; h.l++; a.awayN++; a.awayW++; h.homeN++; }
    else { h.d++; a.d++; h.homeN++; a.awayN++; }
  }
  return teams;
}

/** Shrinkage bayésien : moyenne observée tirée vers la moyenne mondiale. */
function shrink(arr, globalMean) {
  if (!arr.length) return globalMean;
  const trimmed = arr.slice(-WINDOW);
  const m = mean(trimmed);
  const n = trimmed.length;
  return (n * m + PRIOR_N * globalMean) / (n + PRIOR_N);
}

function formString(t) {
  const g = [...t.games].sort((x, y) => String(x.date).localeCompare(String(y.date))).slice(-5);
  return g
    .map((e) => {
      const gf = e.side === 'home' ? e.hg : e.ag;
      const ga = e.side === 'home' ? e.ag : e.hg;
      return gf > ga ? 'V' : gf < ga ? 'D' : 'N';
    })
    .join('');
}

function tierOf(winrate, force, n) {
  if (n < 2) return { icon: '⚪', label: 'inconnu' };
  if (winrate >= 0.6 || force >= 3.5) return { icon: '🟢', label: 'fort' };
  if (winrate <= 0.35 || force <= -3.5) return { icon: '🔴', label: 'faible' };
  return { icon: '🟡', label: 'moyen' };
}

/** Fiabilité d'une ligne de match : combien d'équipes ont ≥2 matchs d'historique. */
function reliabilityOf(tH, tA) {
  const n = (tH ? tH.games.length : 0) >= 2 ? 1 : 0;
  const m = (tA ? tA.games.length : 0) >= 2 ? 1 : 0;
  const tot = n + m;
  return tot === 2 ? '✅' : tot === 1 ? '⚠️' : '❌';
}

// ─── Buteurs (marché « au moins N buts ») ────────────────────────────────────
/** Seuils demandés : au moins 2 / 3 / 4 / 5 buts. */
const GOAL_THRESHOLDS = [2, 3, 4, 5];
const GOAL_FLOOR = 0.55; // P(≥N) minimale retenue

/** P(X ≥ n) pour X ~ Poisson(λ) — queue de Poisson. */
function poissonAtLeast(n, lambda) {
  const lam = Math.max(lambda, 1e-9);
  let cdf = 0;
  for (let k = 0; k < n; k++) {
    // e^(−λ) · λ^k / k! — produit de i=1 à k (i=0 → e^(−λ) seul)
    let term = Math.exp(-lam);
    for (let i = 1; i <= k; i++) term = (term * lam) / i;
    cdf += term;
  }
  return Math.min(1, Math.max(0, 1 - cdf));
}

/**
 * Probabilités « meilleur buteur ≥ N buts » pour un joueur :
 * λ ajusté au rythme de buts attendu du match (λ équipe modèle / moyenne
 * mondiale), borné [0.75 ; 1.35] pour ne pas extrapoler.
 */
function playerGoalProbs(avgGoals, teamLambda, globalGF) {
  const ratio = Math.min(1.35, Math.max(0.75, teamLambda / Math.max(globalGF, 1)));
  const lambda = avgGoals * ratio;
  return { lambda, probs: GOAL_THRESHOLDS.map((n) => poissonAtLeast(n, lambda)) };
}

function pickGoalThreshold(probs) {
  let best = null;
  GOAL_THRESHOLDS.forEach((n, i) => {
    if (probs[i] >= GOAL_FLOOR) best = { n, p: probs[i] };
  });
  return best;
}

// ─── Rapport ─────────────────────────────────────────────────────────────────
async function main() {
  const t0 = Date.now();
  console.log('[over60] historique : betexplorer…');
  const be = loadBetexplorer();
  console.log(`[over60]   betexplorer : ${be.recent} résultats récents + ${be.leagues} en ligue`);
  console.log(`[over60]   feeds flashscore J-1..J-${PAST_DAYS}…`);
  const nPast = await loadFlashscorePast();
  const cal = loadCalendar();
  console.log(`[over60]   flashscore : ${nPast} résultats passés + ${cal.finished} terminés (calendrier)`);
  console.log(`[over60] historique total = ${historyByKey.size} matchs terminés · calendrier = ${cal.upcoming.length} upcoming`);

  const history = [...historyByKey.values()];
  const totals = history.map((e) => e.hg + e.ag);
  const histMeanTotal = mean(totals);
  const nuFit = fitNuByVariance(totals);
  const NU = nuFit.nu;

  const teams = buildTeamStats();
  const globalGF = mean(history.flatMap((e) => [e.hg, e.ag]));
  const globalGA = globalGF;

  for (const t of teams.values()) {
    t.att = shrink(t.gf, globalGF);
    t.def = shrink(t.ga, globalGA);
    t.force = t.att - t.def;
    t.winrate = t.games.length ? t.w / t.games.length : 0;
    t.form = formString(t);
    t.tier = tierOf(t.winrate, t.force, t.games.length);
  }

  // Calibration → BASE points en moyenne
  const k = BASE / histMeanTotal;

  const rows = cal.upcoming.map((m) => {
    const tH = teams.get(teamKey(m.home)) || null;
    const tA = teams.get(teamKey(m.away)) || null;
    const attH = tH ? tH.att : globalGF;
    const defA = tA ? tA.def : globalGA;
    const attA = tA ? tA.att : globalGF;
    const defH = tH ? tH.def : globalGA;
    const lh = Math.max(((attH + defA) / 2 + HOME_ADV * 0.5) * k, 5);
    const la = Math.max(((attA + defH) / 2 - HOME_ADV * 0.25) * k, 5);
    const base = overUnderProb(lh, NU, la, NU, LINES[0]).over; // P(Over 59.5)
    const pick = pickLine(lh, la, NU);
    const p1x2 = skellamMatchProbs(lh, la);
    return {
      ...m,
      lh,
      la,
      total: lh + la,
      base,
      line: pick.line,
      over: pick.over,
      lineOk: pick.ok,
      pHome: p1x2.home,
      pDraw: p1x2.draw,
      pAway: p1x2.away,
      tH,
      tA,
      rel: reliabilityOf(tH, tA),
      known: Boolean(tH && tA),
    };
  });

  rows.sort((a, b) => String(a.time).localeCompare(String(b.time)));

  const calMean = mean(rows.map((r) => r.total));

  // ─── Meilleurs buteurs : P(au moins 2/3/4/5 buts) ───
  const playerSnap = loadHandballPlayers();
  const scorerRows = [];
  if (playerSnap) {
    for (const r of rows) {
      for (const side of ['home', 'away']) {
        const teamName = side === 'home' ? r.home : r.away;
        const teamLambda = side === 'home' ? r.lh : r.la;
        const top = topPlayersForTeam(playerSnap, teamName, 3).field;
        const p = top[0];
        if (!p) continue;
        const srcAvg = Number.isFinite(p.avgGoals) && p.avgGoals > 0 ? p.avgGoals : p.games > 0 ? p.goals / p.games : null;
        if (srcAvg == null) continue;
        const { lambda, probs } = playerGoalProbs(srcAvg, teamLambda, globalGF);
        scorerRows.push({
          time: r.time,
          match: `${r.home} vs ${r.away}`,
          league: r.league,
          side,
          teamName,
          player: p.name,
          srcAvg,
          lambda,
          probs,
          pick: pickGoalThreshold(probs),
          games: p.games,
          rel: ((side === 'home' ? r.tH : r.tA)?.games.length ?? 0) >= 2 ? '✅' : '❌',
        });
      }
    }
  }
  const teamsWithHistory = [...teams.values()].filter((t) => t.games.length >= 2).length;
  const rowsKnown = rows.filter((r) => r.known).length;
  const lineDist = LINES.map((l) => ({ line: l, n: rows.filter((r) => r.line === l && r.lineOk).length }));
  const noLine = rows.filter((r) => !r.lineOk).length;

  // ─── Sections ───
  const lines = [];
  const H = (s, lv = 2) => lines.push(`${'#'.repeat(lv)} ${s}`);
  const table = (headers, body) => {
    lines.push(`| ${headers.join(' | ')} |`);
    lines.push(`| ${headers.map(() => '---').join(' | ')} |`);
    for (const r of body) lines.push(`| ${r.join(' | ')} |`);
    lines.push('');
  };
  const rowCols = (r, extra = []) => [
    r.time.replace('T', ' ').slice(5, 16),
    `**${r.home}** vs ${r.away}`,
    r.league,
    `${round(r.total, 1)}`,
    r.lineOk ? `**${round(r.line, 1)}**` : `${round(r.line, 1)} ⚠️`,
    `**${pct(r.over)}**`,
    pct(r.pHome),
    pct(r.pDraw),
    pct(r.pAway),
    r.rel,
    ...extra,
  ];
  const MATCH_HEADERS = ['Date', 'Match', 'Ligue', 'E(total)', 'Ligne', 'P(Over ligne)', 'P(1)', 'P(X)', 'P(2)', 'Suivi'];
  const CAL_HEADERS = [...MATCH_HEADERS, 'Forme (dom → ext)'];

  lines.push(`# Handball — Over points adaptatif (base 60), 1X2 & force des équipes`);
  lines.push('');
  lines.push(`_Généré le ${new Date().toISOString().replace('T', ' ').slice(0, 16)} UTC · calendrier scrapé ${cal.scrapedAt}_`);
  lines.push('');

  H('1. Méthode', 2);
  lines.push('');
  lines.push(`- **Base points** : ${BASE} → ligne de départ **${LINES[0]} (Over 60)** ; si P(Over) ≤ ${PROB_FLOOR * 100} %, on descend de 2 buts : ${LINES.join(' → ')}. Ligne retenue = plus haute ligne avec P(Over) > ${PROB_FLOOR * 100} %.`);
  lines.push(`- **Historique** : ${history.length} matchs terminés sur 8 jours (BetExplorer results + feeds Flashscore J-1..J-${PAST_DAYS}), moyenne observée **${round(histMeanTotal, 2)} pts/match** (σ = ${round(Math.sqrt(nuFit.obs), 2)}).`);
  lines.push(`- **ν CMP** : ${round(NU, 3)} — ${nuFit.source} (modèle ${round(nuFit.model, 2)} vs observé ${round(nuFit.obs, 2)}).`);
  lines.push(`- **Calibration** : facteur unique k = ${round(k, 3)} appliqué aux λ → moyenne du calendrier **${round(calMean, 2)} pts** (moyenne modèle = ${BASE}).`);
  lines.push(`- **λ par équipe** : (attaque + défense adverse)/2, moyenne glissante ${WINDOW} matchs, shrinkage prior ${PRIOR_N} matchs vers la moyenne mondiale ${round(globalGF, 1)} ; avantage domicile +${round(HOME_ADV * 0.5, 2)}/−${round(HOME_ADV * 0.25, 2)} (convention \`handball-strategy-top8.ts\`).`);
  lines.push(`- **Moteurs** : CMP (\`src/lib/handball-cmp.ts\`) pour le total, Skellam (\`src/lib/handball-skellam.ts\`) pour le 1X2.`);
  lines.push(`- **Fiabilité par match (colonne Suivi)** : ✅ 2 équipes suivies (≥2 matchs) · ⚠️ 1 · ❌ 0 (retombe sur la moyenne mondiale) — ${rowsKnown}/${rows.length} matchs fiables.`);
  lines.push(`- **Buteurs (section 8)** : P(au moins 2/3/4/5 buts) du meilleur buteur de chaque équipe, retenue si ≥ ${GOAL_FLOOR * 100} % — snapshots \`hbl_players.json\` + \`lnh_players.json\` (queue de Poisson, λ ajusté au rythme du match).`);
  lines.push('');
  lines.push('> Limites : pas de cotes dans le feed (pas d\'EV/CLV), forme sur fenêtre courte (8 jours), matchs en cours exclus.');
  lines.push('');

  H('2. Synthèse', 2);
  lines.push('');
  table(['Indicateur', 'Valeur'], [
    ['Matchs analysés', String(rows.length)],
    ['E(total) moyen du calendrier', `${round(calMean, 2)} pts`],
    [`P(Over ${LINES[0]}) moyenne`, pct(mean(rows.map((r) => r.base)))],
    ['Ligne retenue = 59.5 (Over 60)', String(lineDist[0].n)],
    ['Ligne retenue = 58.5', String(lineDist[1].n)],
    ['Ligne retenue = 56.5', String(lineDist[2].n)],
    ['Ligne retenue = 54.5', String(lineDist[3].n)],
    ['Ligne retenue = 52.5', String(lineDist[4].n)],
    ['Aucune ligne > 50 %', String(noLine)],
    ['Équipes avec ≥2 matchs d\'historique', String(teamsWithHistory)],
    ['Matchs avec données buteurs (HBL/StarLigue)', String(new Set(scorerRows.map((s) => s.match)).size)],
  ]);

  H('3. Top Over — lignes hautes', 2);
  lines.push('');
  lines.push('_Classement par ligne retenue puis par probabilité : les matchs qui tiennent encore 59.5 avec >50 % sont en tête._');
  lines.push('');
  const topOver = [...rows].sort((a, b) => b.line - a.line || b.over - a.over).slice(0, 30);
  table(MATCH_HEADERS, topOver.map((r) => rowCols(r)));

  H('4. Lignes descendues — Over 60 refusé (P(Over 59.5) ≤ 50 %)', 2);
  lines.push('');
  lines.push('_Matchs où il faut descendre d\'au moins une ligne (−2 buts) pour retrouver >50 % de réussite._');
  lines.push('');
  const lowLines = [...rows]
    .filter((r) => r.line < LINES[0])
    .sort((a, b) => a.line - b.line || a.over - b.over)
    .slice(0, 30);
  table(MATCH_HEADERS, lowLines.map((r) => rowCols(r)));

  H('5. Top favoris 1X2', 2);
  lines.push('');
  const topFav = [...rows]
    .map((r) => ({ ...r, best: Math.max(r.pHome, r.pDraw, r.pAway) }))
    .sort((a, b) => b.best - a.best)
    .slice(0, 25);
  table(
    ['Date', 'Match', 'Favori', 'P(favori)', 'Ligne', 'P(Over ligne)', 'Suivi'],
    topFav.map((r) => {
      const side = r.best === r.pHome ? `1 — ${r.home}` : r.best === r.pAway ? `2 — ${r.away}` : 'X';
      return [r.time.replace('T', ' ').slice(5, 16), `${r.home} vs ${r.away}`, side, `**${pct(r.best)}**`, `${round(r.line, 1)}`, pct(r.over), r.rel];
    })
  );

  H('6. Calendrier complet', 2);
  lines.push('');
  let curDay = '';
  for (const r of rows) {
    const day = r.time.slice(0, 10);
    if (day !== curDay) {
      curDay = day;
      lines.push(`### ${day}`);
      lines.push('');
      lines.push(`| ${CAL_HEADERS.join(' | ')} |`);
      lines.push(`| ${CAL_HEADERS.map(() => '---').join(' | ')} |`);
    }
    lines.push(`| ${rowCols(r).join(' | ')} | ${r.tH ? `${r.tH.tier.icon}${r.tH.form}` : '—'} → ${r.tA ? `${r.tA.tier.icon}${r.tA.form}` : '—'} |`);
  }
  lines.push('');

  H('7. Force des équipes (toutes)', 2);
  lines.push('');
  lines.push('_n = matchs d\'historique · WR = winrate · BP/m = λ attaque · BM/m = λ defense · Force = BP−BM (buts/match) · Forme = 5 derniers (V/D/N) · Couleur = 🟢 fort / 🟡 moyen / 🔴 faible / ⚪ inconnu._');
  lines.push('');
  const allTeams = [...teams.values()].sort((a, b) => b.force - a.force);
  table(
    ['#', 'Équipe', 'n', 'V-N-D', 'WR', 'BP/m', 'BM/m', 'Force', 'Forme', 'Couleur'],
    allTeams.map((t, i) => [
      String(i + 1),
      t.name,
      String(t.games.length),
      `${t.w}-${t.d}-${t.l}`,
      pct(t.winrate),
      round(t.att, 1),
      round(t.def, 1),
      (t.force >= 0 ? '+' : '') + round(t.force, 1),
      t.form || '—',
      `${t.tier.icon} ${t.tier.label}`,
    ])
  );

  H('8. Meilleurs buteurs — P(au moins 2 / 3 / 4 / 5 buts)', 2);
  lines.push('');
  lines.push(
    `_Seuil de retenue : P(≥N) ≥ ${Math.round(GOAL_FLOOR * 100)} % (colonne Pick = plus grand N qui passe). λ joueur = buts/match de la source, ajusté au rythme attendu du match (λ équipe / moyenne mondiale ${round(globalGF, 1)}, facteur borné 0.75–1.35). Queue de Poisson. Couverture : snapshots HBL (Allemagne) + StarLigue (France) uniquement._`
  );
  lines.push('');
  table(
    ['Date', 'Match', 'Équipe', 'Meilleur buteur', 'Buts/m (src)', 'λ ajusté', 'P(≥2)', 'P(≥3)', 'P(≥4)', 'P(≥5)', 'Pick ≥55 %', 'Suivi'],
    scorerRows
      .slice()
      .sort((a, b) => String(a.time).localeCompare(String(b.time)) || a.side.localeCompare(b.side))
      .map((s) => [
        s.time.replace('T', ' ').slice(5, 16),
        s.match,
        `**${s.teamName}**`,
        s.player,
        `${round(s.srcAvg, 2)} (n=${s.games})`,
        `${round(s.lambda, 2)}`,
        `${s.probs[0] >= GOAL_FLOOR ? '**' : ''}${pct(s.probs[0])}${s.probs[0] >= GOAL_FLOOR ? '**' : ''}`,
        `${s.probs[1] >= GOAL_FLOOR ? '**' : ''}${pct(s.probs[1])}${s.probs[1] >= GOAL_FLOOR ? '**' : ''}`,
        `${s.probs[2] >= GOAL_FLOOR ? '**' : ''}${pct(s.probs[2])}${s.probs[2] >= GOAL_FLOOR ? '**' : ''}`,
        `${s.probs[3] >= GOAL_FLOOR ? '**' : ''}${pct(s.probs[3])}${s.probs[3] >= GOAL_FLOOR ? '**' : ''}`,
        s.pick ? `**${s.pick.n}+ (${pct(s.pick.p)})**` : '⚠️ aucun',
        s.rel,
      ])
  );

  lines.push('---');
  lines.push(`_Script : \`scripts/analyze-handball-over60.mjs\` — régénérable via \`bun scripts/analyze-handball-over60.mjs\`._`);
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, lines.join('\n'), 'utf8');
  console.log(
    `[over60] ✅ ${rows.length} matchs · ν=${round(NU, 3)} · k=${round(k, 3)} · E(total)=${round(calMean, 2)} · lignes ${lineDist.map((l) => `${l.line}:${l.n}`).join(' ')} · sans ligne ${noLine} → ${OUT} (${Date.now() - t0} ms)`
  );
}

main().catch((err) => {
  console.error('[over60] ERREUR', err);
  process.exitCode = 1;
});
