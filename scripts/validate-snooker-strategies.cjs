// Lab de validation des stratégies snooker — taux de réussite prévisionnel
// Réplique EXACTEMENT le modèle de production (predictions/route.ts) :
//   strengthElo = 1500 + (winPctRétréci - 50) × 12 ; prob = logistique Elo /400.
// Source : data/cuetracker_matches.json (4100 joueurs, lecture seule).
const fs = require('fs');

const data = JSON.parse(fs.readFileSync('data/cuetracker_matches.json', 'utf-8'));
const rated = data.players
  .filter((p) => (p.matches_played ?? 0) > 0)
  .map((p) => {
    const played = p.matches_played ?? 0;
    const rawPct = ((p.wins ?? 0) / played) * 100;
    const shrunk = 50 + (rawPct - 50) * (played / (played + 20));
    return { ...p, elo: 1500 + (shrunk - 50) * 12 };
  })
  .sort((a, b) => b.elo - a.elo);
console.log(
  `Joueurs: ${rated.length} | #1 ${rated[0].name} ${rated[0].elo.toFixed(0)} | med ${rated[rated.length >> 1].elo.toFixed(0)}`
);

// RNG seedé mulberry32 — reproductibilité
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// Monte-Carlo best-of-N, frames iid côté favori
function simBoN(rnd, pF, bo) {
  const need = (bo + 1) / 2;
  let f = 0, u = 0, n = 0;
  while (f < need && u < need) { n++; if (rnd() < pF) f++; else u++; }
  return { win: f === need ? 1 : 0, frames: n, diff: f - u };
}
const logistic = (rA, rB) => 1 / (1 + Math.pow(10, (rB - rA) / 400));

const rnd = mulberry32(42);
const N = 2_000_000;
const nTop = 300;
const poolB = rated.slice(nTop, 1500);

// PARTIE 1 — taux prévisionnels par bucket de prob favori (bo7)
console.log('\n=== PARTIE 1 — Taux prévisionnels par bucket de proba (bo7) ===');
const BUCKETS = [[0.5,0.55],[0.55,0.6],[0.6,0.65],[0.65,0.7],[0.7,0.75],[0.75,0.8],[0.8,0.85],[0.85,0.9],[0.9,1.01]];
const st = BUCKETS.map(() => ({ n: 0, win: 0, o45: 0, u45: 0, h15: 0, h25: 0 }));
for (let i = 0; i < N; i++) {
  const pA = logistic(rated[(rnd()*nTop)|0].elo, poolB[(rnd()*poolB.length)|0].elo);
  const pFav = Math.max(pA, 1 - pA);
  const bi = BUCKETS.findIndex(([lo, hi]) => pFav >= lo && pFav < hi);
  if (bi < 0) continue;
  const r = simBoN(rnd, pFav, 7);
  const s = st[bi];
  s.n++; s.win += r.win; s.o45 += r.frames > 4 ? 1 : 0; s.u45 += r.frames <= 4 ? 1 : 0;
  if (r.win) { s.h15 += r.diff >= 2 ? 1 : 0; s.h25 += r.diff >= 3 ? 1 : 0; }
}
console.log('prob favori |     N | win%   | ov4.5% | un4.5% | -1.5%* | -2.5%* | >=65%?');
for (let i = 0; i < BUCKETS.length; i++) {
  const s = st[i];
  if (!s.n) continue;
  const [lo, hi] = BUCKETS[i];
  const winPct = (s.win / s.n) * 100;
  console.log(
    `${lo.toFixed(2)}-${hi.toFixed(2)}   | ${String(s.n).padStart(5)} | ${winPct.toFixed(1).padStart(5)}% | ${((s.o45 / s.n) * 100).toFixed(1).padStart(5)}% | ${((s.u45 / s.n) * 100).toFixed(1).padStart(5)}% | ${((s.h15 / s.win) * 100).toFixed(1).padStart(5)}% | ${((s.h25 / s.win) * 100).toFixed(1).padStart(5)}% |${winPct >= 65 ? '  <== OK' : ''}`
  );
}
console.log('(* -1.5 / -2.5 = % couverts QUAND le favori gagne — base s.win)');

// PARTIE 2 — effet du format sur le taux du favori (prob >= 0.65)
console.log('\n=== PARTIE 2 — Taux prévisionnel favori selon format (proba >= 0.65) ===');
const FORMATS = [5, 7, 9, 11, 17, 19, 35];
const fst = FORMATS.map(() => ({ n: 0, win: 0 }));
for (let i = 0; i < N; i++) {
  const pA = logistic(rated[(rnd()*nTop)|0].elo, poolB[(rnd()*poolB.length)|0].elo);
  const pFav = Math.max(pA, 1 - pA);
  if (pFav < 0.65) continue;
  for (let fi = 0; fi < FORMATS.length; fi++) {
    const r = simBoN(rnd, pFav, FORMATS[fi]);
    fst[fi].n++; fst[fi].win += r.win;
  }
}
console.log('format |     N | win% favori');
for (let fi = 0; fi < FORMATS.length; fi++) {
  const s = fst[fi];
  if (!s.n) continue;
  console.log(`bo${String(FORMATS[fi]).padEnd(4)} | ${String(s.n).padStart(5)} | ${((s.win / s.n) * 100).toFixed(1).padStart(10)}%`);
}

// PARTIE 3 — decider_win_pct (stratégie "matchs serrés")
console.log('\n=== PARTIE 3 — Decider win% des 20 meilleurs Elo ===');
for (const p of rated.slice(0, 20)) {
  const dec = p.decider_win_pct != null ? (p.decider_win_pct * 100).toFixed(1) + '%' : 'n/a';
  console.log(`  ${p.name.padEnd(24)} elo=${p.elo.toFixed(0)} played=${String(p.matches_played).padStart(5)} decider=${dec}`);
}

// PARTIE 4 — appariements réels du jour (FlashScore) : quels picks >= 65% ?
try {
  const fsData = JSON.parse(fs.readFileSync('data/odds_flashscore_snooker.json', 'utf-8'));
  console.log(`\n=== PARTIE 4 — Matchs réels du jour (${fsData.matches?.length ?? 0}) ===`);
  function normalizeName(raw) {
    return (raw || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z ]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  const index = new Map();
  for (const p of rated) {
    const tokens = normalizeName(p.name).split(' ').filter(Boolean);
    if (!tokens.length) continue;
    for (const s of new Set([tokens[0], tokens[tokens.length - 1]])) {
      if (!s) continue;
      if (!index.has(s)) index.set(s, []);
      index.get(s).push(p);
    }
  }
  function findCuePlayer(fsName) {
    const tokens = normalizeName(fsName).split(' ').filter(Boolean);
    if (!tokens.length) return null;
    const first = tokens[0], last = tokens[tokens.length - 1];
    let surnames, initial = null;
    if (tokens.length === 1) surnames = [first];
    else if (last.length === 1) { surnames = [first]; initial = last; }
    else if (first.length === 1) { surnames = [last]; initial = first; }
    else surnames = [last, first];
    for (const surname of surnames) {
      const cands = (index.get(surname) ?? []).filter((p) => {
        if (!initial) return true;
        const pt = normalizeName(p.name).split(' ').filter(Boolean);
        return pt.some((tok) => tok !== surname && tok.startsWith(initial));
      });
      if (cands.length)
        return cands.slice().sort((x, y) => (y.matches_played ?? 0) - (x.matches_played ?? 0))[0];
    }
    return null;
  }
  for (const m of fsData.matches ?? []) {
    if (m.isLive) continue;
    const a = findCuePlayer(m.home);
    const b = findCuePlayer(m.away);
    if (!a || !b) {
      console.log(`  ${m.home} vs ${m.away} : joueur introuvable`);
      continue;
    }
    const pA = logistic(a.elo, b.elo);
    const fav = pA >= 0.5 ? a : b;
    const pFav = Math.max(pA, 1 - pA);
    const mark = pFav >= 0.65 ? ' <== PICK >=65%' : '';
    console.log(`  ${m.home} vs ${m.away} → ${fav.name} ${(pFav * 100).toFixed(1)}%${mark}`);
  }
} catch (e) {
  console.log('\nPartie 4 ignorée:', e.message);
}

