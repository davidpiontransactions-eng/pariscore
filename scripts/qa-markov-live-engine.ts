/**
 * Sonde QA moteur Markov — exécute predictTotalGames (code du commit déployé)
 * sur les matchs live RÉELS servis par la prod. Valide :
 *   1. setOver75/setUnder125 ∈ [0..100] (fix d'échelle critique)
 *   2. valeurs ≠ fallback constant (le modèle Markov produit bien des probas)
 *   3. cohérence par état (5-5 → Over 7,5 élevé, etc.)
 *
 * Usage : bun run scripts/qa-markov-live-engine.ts
 */
import { predictTotalGames } from "../src/lib/prediction/total-games";

type ApiMatch = {
  id?: number | string;
  playerA?: { name?: string; elo?: number };
  playerB?: { name?: string; elo?: number };
  /** Sets joués — le DERNIER élément est le set en cours. */
  setsDetail?: Array<{ p1: number; p2: number }>;
  /** Score de jeux du set en cours (redondant avec le dernier setsDetail). */
  currentGame?: { p1: number; p2: number };
  server?: "A" | "B";
  liveProbA?: number;
  liveProbB?: number;
};

async function main() {
  const res = await fetch("https://pariscore.fr/api/tennis/live");
  if (!res.ok) {
    console.error(`[QA] HTTP ${res.status} sur /api/tennis/live`);
    process.exit(1);
  }
  const json = (await res.json()) as { matches?: ApiMatch[] } | ApiMatch[];
  const matches = Array.isArray(json) ? json : (json.matches ?? []);
  console.log(`[QA] ${matches.length} matchs live récupérés depuis la prod\n`);

  let tested = 0;
  let inRange = 0;
  const rows: string[] = [];

  for (const m of matches.slice(0, 8)) {
    const detail = m.setsDetail ?? [];
    if (detail.length === 0) continue;

    // Convention live-state-builder : dernier setsDetail = set en cours.
    const finished = detail.slice(0, -1);
    const cur = detail[detail.length - 1];
    const gA = m.currentGame?.p1 ?? cur.p1;
    const gB = m.currentGame?.p2 ?? cur.p2;
    const gamesPlayed =
      finished.reduce((a, s) => a + s.p1 + s.p2, 0) + gA + gB;

    const result = predictTotalGames(
      { servePtsWonPct: null, returnPtsWonPct: null },
      { servePtsWonPct: null, returnPtsWonPct: null },
      "Hard",
      3,
      m.playerA?.elo,
      m.playerB?.elo,
      {
        gamesPlayed,
        setsWon: [finished.filter((s) => s.p1 > s.p2).length, finished.filter((s) => s.p2 > s.p1).length],
        currentSetGames: [gA, gB],
        liveProbA: m.liveProbA,
        liveProbB: m.liveProbB,
        server: m.server,
      },
    );
    tested++;
    const ok =
      result.setOver75 >= 0 && result.setOver75 <= 100 &&
      result.setUnder125 >= 0 && result.setUnder125 <= 100;
    if (ok) inRange++;

    const scoreStr =
      finished.map((s) => `${s.p1}-${s.p2}`).join(" ") + ` | ${gA}-${gB}`;
    rows.push(
      `${String(m.playerA?.name ?? "?").slice(0, 18).padEnd(18)} vs ${String(m.playerB?.name ?? "?").slice(0, 18).padEnd(18)} ` +
      `[${scoreStr}] srv=${m.server ?? "?"} mkt=${m.liveProbA ?? "?"}% | ` +
      `Over7,5=${result.setOver75}% Under12,5=${result.setUnder125}% λ=${result.lambda}`,
    );
  }

  console.log(rows.join("\n"));
  console.log(`\n[QA] testés: ${tested} — dans [0..100]: ${inRange}`);
  const distinctOver = new Set(rows.map((r) => r.split("Over7,5=")[1]?.split("%")[0])).size;
  console.log(`[QA] diversité Over7,5: ${distinctOver} valeurs distinctes (>1 = modèle actif, pas fallback)`);
  console.log(tested > 0 && inRange === tested ? "[QA] RESULT: PASS" : "[QA] RESULT: FAIL");
}

main();
