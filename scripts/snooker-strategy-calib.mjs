// Calibration des stratégies snooker — mapping frame-level → proba match (BoX)
// Objectif : identifier les contextes où P(victoire favori) >= 65% (seuil mission).
// Sortie : table format × p_frame → P(match), et cas réel Ding–Holt.
import { readFileSync, existsSync } from "node:fs";

/** Binomiale : P(gagner best-of-N frames, p = proba par frame). */
function boProb(nFrames, p) {
  const need = (nFrames + 1) / 2;
  let prob = 0;
  for (let k = need; k <= nFrames; k++) {
    prob = addLogBinom(prob, k, nFrames, p);
  }
  return prob;
}
function logBinom(k, n, p) {
  return lnFact(n) - lnFact(k) - lnFact(n - k) + k * Math.log(p) + (n - k) * Math.log(1 - p);
}
function addLogBinom(acc, k, n, p) {
  return acc + Math.exp(logBinom(k, n, p));
}
const lnFactMemo = new Map();
function lnFact(n) {
  if (n <= 1) return 0;
  if (lnFactMemo.has(n)) return lnFactMemo.get(n);
  let s = 0;
  for (let i = 2; i <= n; i++) s += Math.log(i);
  lnFactMemo.set(n, s);
  return s;
}

/** Elo proxy du modèle Pariscore : shrinkage n/(n+20) puis ×12 autour de 1500. */
const SHRINK_N = 20;
function strengthElo(wins, played) {
  if (played <= 0) return 1500;
  const raw = (wins / played) * 100;
  const shrunk = 50 + (raw - 50) * (played / (played + SHRINK_N));
  return 1500 + (shrunk - 50) * 12;
}
const expectedScore = (a, b) => 1 / (1 + Math.pow(10, (b - a) / 400));

// 1) Table : quel p par frame faut-il pour atteindre 65% selon le format ?
console.log("=== Seuil 65% : p par frame requis selon le format ===");
for (const n of [7, 9, 11, 17, 19]) {
  let lo = 0.5, hi = 0.75;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (boProb(n, mid) < 0.65) lo = mid;
    else hi = mid;
  }
  const pFrame = (lo + hi) / 2;
  // Elo proxy équivalent (approx : eloToWinProb du diff, appliqué par frame)
  const eloDiff = 400 * Math.log10(pFrame / (1 - pFrame));
  console.log(
    `  Bo${String(n).padEnd(2)} : p_frame >= ${pFrame.toFixed(3)}  (Elo frame-level ~ +${Math.round(eloDiff)})`
  );
}

// 2) Sensibilité : P(match) pour un favori à p_frame = 0.55 et 0.60
console.log("\n=== P(victoire favori) pour p_frame fixé ===");
for (const pf of [0.55, 0.6]) {
  const row = [7, 9, 11, 17, 19].map((n) => `Bo${n}=${(boProb(n, pf) * 100).toFixed(1)}%`).join("  ");
  console.log(`  p_frame=${pf} : ${row}`);
}

// 3) Cas réel : Ding Junhui vs Michael Holt (données CueTracker locales)
const cueFile = "data/cuetracker_matches.json";
if (existsSync(cueFile)) {
  const data = JSON.parse(readFileSync(cueFile, "utf8"));
  const find = (slug) => data.players.find((p) => p.id === slug);
  const ding = find("ding-junhui");
  const holt = find("michael-holt");
  if (ding && holt) {
    const eD = strengthElo(ding.wins, ding.matches_played);
    const eH = strengthElo(holt.wins, holt.matches_played);
    const pFrame = expectedScore(eD, eH);
    console.log("\n=== Cas Ding–Holt (Bo9 hypothèse) ===");
    console.log(
      `  Ding: ${ding.wins}/${ding.matches_played} -> Elo ${eD.toFixed(0)} | Holt: ${holt.wins}/${holt.matches_played} -> Elo ${eH.toFixed(0)}`
    );
    console.log(`  p_frame=${pFrame.toFixed(3)} -> P(Bo9)=${(boProb(9, pFrame) * 100).toFixed(1)}%  P(Bo11)=${(boProb(11, pFrame) * 100).toFixed(1)}%`);
  }
}

// 4) Test "Crucible curse" : champion du monde Bo19 vs adversaire moyen du top 32
// Hypothèse : le champion est à p_frame ~0.56 vs un top-32 (champ Elo ~1740, top32 ~1660).
const champVsTop32 = expectedScore(1740, 1660);
console.log("\n=== Crucible curse (champion Bo19 vs top-32) ===");
console.log(`  p_frame=${champVsTop32.toFixed(3)} -> P(champion Bo19)=${(boProb(19, champVsTop32) * 100).toFixed(1)}%`);
console.log("  -> Le 'curse' (27% de défaites) implique des adversaires plus forts qu'un top-32 moyen.");
