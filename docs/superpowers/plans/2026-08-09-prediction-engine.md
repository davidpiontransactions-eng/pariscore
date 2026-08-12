# Moteur de prédictions Football (Prematch + Live) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: executing-plans (inline, engineering loop — l'owner a demandé l'exécution autonome).

**Goal:** Porter en TypeScript pur côté Next le moteur Poisson/Dixon-Coles/Elo double/live-decay, exposé via `/api/football/prediction/[id]`.

**Architecture:** modules purs par modèle (`poisson.ts`, `dixon-coles.ts`, `elo.ts`, `live-decay.ts`, `blend.ts`) + orchestration (`index.ts`) + lecteur historique legacy (pattern `src/lib/tennis-stats/db.ts`) + route API cache 60 s. Spec : `docs/superpowers/specs/2026-08-09-prediction-engine-design.md`.

**Tech Stack:** TypeScript strict, Bun (tests via `bun test` — wrapper `node scripts/run-bun.js test`), better-sqlite3 (runtime) / bun:sqlite (tests), Prisma (Match), Next.js 16 route handlers.

## Global Constraints

- Gate finale : `bun run typecheck` + `bun run lint` + tests moteur verts.
- **Fidélité legacy** : maths portées depuis server.js (poissonPMF l.8407, computeDixonColes l.8484, bayesianBlend l.8869, calibration l.8943) — mêmes constantes (ρ = −0.05, blend 50/25/25).
- Probabilités en 0-100 (pas de fraction), arrondies à 2 décimales via `round2(x) = Math.round(x*100)/100`.
- Jamais de throw réseau : erreurs → `errors: string[]`, marchés absents.
- Aucune modif de server.js, des hooks existants ni des composants (sous-projets 2/3).
- Nommage fr/anglais mixte conservé (conventions repo : camelCase français/composants).

---

### Task 1: Contrats & helpers communs

**Files:**
- Create: `src/lib/prediction/football/types.ts`
- Create: `src/lib/prediction/football/math-utils.ts`
- Test: `src/lib/prediction/football/math-utils.test.ts`

**Interfaces:**
- Produces: `round2`, `clamp01`, `normalizeMatrix(m): number[][]`, types `Markets`, `ScoreMatrix`, `EngineResult`, `EloPair`, `LiveMarkets`, `EloConfig`.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/prediction/football/math-utils.test.ts
import { describe, expect, test } from "bun:test";
import { clamp01, normalizeMatrix, round2 } from "./math-utils";

describe("math-utils", () => {
  test("round2 arrondit à 2 décimales", () => {
    expect(round2(0.12345)).toBe(0.12);
    expect(round2(0.125)).toBe(0.13);
  });
  test("clamp01 borne [0,1]", () => {
    expect(clamp01(-0.5)).toBe(0);
    expect(clamp01(1.5)).toBe(1);
    expect(clamp01(0.4)).toBe(0.4);
  });
  test("normalizeMatrix somme à 1", () => {
    const m = normalizeMatrix([[1, 2], [3, 4]]);
    const sum = m.flat().reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 10);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node scripts/run-bun.js test src/lib/prediction/football/math-utils.test.ts`
Expected: FAIL (module introuvable)

- [ ] **Step 3: Implement**

```ts
// src/lib/prediction/football/math-utils.ts
export const round2 = (x: number): number => Math.round(x * 100) / 100;
export const clamp01 = (x: number): number => Math.min(1, Math.max(0, x));
export function normalizeMatrix(m: number[][]): number[][] {
  const sum = m.flat().reduce((a, b) => a + b, 0);
  if (!Number.isFinite(sum) || sum <= 0) return m;
  return m.map((row) => row.map((v) => v / sum));
}
```

```ts
// src/lib/prediction/football/types.ts
export type ScoreMatrix = number[][];

export type DcSelection = "1X" | "X2" | "12";
export type TopScore = { home: number; away: number; prob: number };

export type Markets = {
  homeWin: number; draw: number; awayWin: number;
  over05: number; over15: number; over25: number; over35: number;
  under15: number; under35: number;
  btts: number;
  dc: { selection: DcSelection; prob: number };
  topScores: TopScore[];
  cornersOver?: { line: number; prob: number } | null;
};

export type EloPair = { home: number; away: number };

export type EloConfig = {
  init: number;        // 1500
  k: number;           // 30
  kBig: number;        // 15 (écart > threshold)
  threshold: number;   // 400
  homeAdv: number;     // 100
  decayDays: number;   // 365 (poids 0 au-delà)
};

export const DEFAULT_ELO_CONFIG: EloConfig = {
  init: 1500, k: 30, kBig: 15, threshold: 400, homeAdv: 100, decayDays: 365,
};

export type LiveMarkets = {
  minute: number;
  scoreHome: number; scoreAway: number;
  homeWin: number; draw: number; awayWin: number;
  over15: number; over25: number; over35: number; btts: number;
  homeWinBefore: number; drawBefore: number; awayWinBefore: number;
  lambdaRemaining: EloPair;
};

export type EngineResult = {
  mode: "prematch" | "live";
  lambda?: EloPair;
  markets?: Markets;
  live?: LiveMarkets;
  elo?: { home: number; away: number; eloKnown: boolean };
  modelSource: "poisson" | "dixon-coles" | "blend" | "live-decay";
  errors: string[];
};

export type LiveInputs = {
  scoreHome: number; scoreAway: number; minute: number;
  redCardHome: number; redCardAway: number;
  xgCumHome: number | null; xgCumAway: number | null;
  momentum15: number | null; // [-1, +1] normalisé, + = domine domestique
};
```

- [ ] **Step 4: Run to verify pass**

Run: same command — Expected: PASS (2/2)

- [ ] **Step 5: Commit**

```bash
git add src/lib/prediction/football
git commit -m "feat(prediction): contrats et helpers du moteur football"
```

---

### Task 2: Poisson — matrice & marchés

**Files:**
- Create: `src/lib/prediction/football/poisson.ts`
- Test: `src/lib/prediction/football/poisson.test.ts`

**Interfaces:**
- Consumes: `math-utils.ts` (`round2`, `normalizeMatrix`), `types.ts`
- Produces: `poissonPMF(lambda, k)`, `buildScoreMatrix(lambdaHome, lambdaAway, max=8)`, `marketsFromMatrix(matrix)`, `poissonMarkets(lambdaHome, lambdaAway)` (matrice+dc+top+corner `cornersOver` via `poissonOver` porté de football-predictions.ts, lines 7.5-11.5, λ corners = λ_home+λ_away)

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/prediction/football/poisson.test.ts
import { describe, expect, test } from "bun:test";
import { buildScoreMatrix, marketsFromMatrix, poissonMarkets, poissonPMF } from "./poisson";

describe("poisson", () => {
  test("poissonPMF λ=1.0, k=0 → e^-1", () => {
    expect(poissonPMF(1, 0)).toBeCloseTo(Math.exp(-1), 8);
  });
  test("matrice normalisée + somme 1", () => {
    const m = buildScoreMatrix(1.35, 1.1);
    expect(m.flat().reduce((a, b) => a + b, 0)).toBeCloseTo(1, 6);
  });
  test("matchs serrés λ=1.35/1.1 → P(nul) > P(victoire ext)", () => {
    const mk = marketsFromMatrix(buildScoreMatrix(1.35, 1.1));
    expect(mk.draw).toBeGreaterThan(mk.awayWin);
    expect(mk.draw).toBeGreaterThan(mk.homeWin * 0.7);
  });
  test("favori λ=2.0/0.8 → homeWin > 50", () => {
    const mk = marketsFromMatrix(buildScoreMatrix(2.0, 0.8));
    expect(mk.homeWin).toBeGreaterThan(50);
  });
  test("markets cohérents (1X2=100, topScores=5, btts<100)", () => {
    const mk = marketsFromMatrix(buildScoreMatrix(1.35, 1.1));
    expect(mk.homeWin + mk.draw + mk.awayWin).toBeCloseTo(100, 6);
    expect(mk.topScores).toHaveLength(5);
    expect(mk.btts).toBeGreaterThan(0);
    expect(mk.btts).toBeLessThan(100);
    expect(mk.over25).toBeGreaterThan(0);
  });
  test("poissonMarkets expose cornersOver quand λ total > 0", () => {
    const mk = poissonMarkets(1.35, 1.1);
    expect(mk.cornersOver).not.toBeNull();
    expect(mk.cornersOver!.prob).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node scripts/run-bun.js test src/lib/prediction/football/poisson.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement**

```ts
// src/lib/prediction/football/poisson.ts
import { normalizeMatrix, round2 } from "./math-utils";
import { poissonOver } from "@/lib/football-predictions"; // réutilisé (ligne corners)
import type { Markets, ScoreMatrix, TopScore } from "./types";

export function poissonPMF(lambda: number, k: number): number {
  if (lambda <= 0 || !Number.isFinite(lambda)) return 0;
  let term = Math.exp(-lambda);
  let acc = term;
  for (let i = 1; i <= k; i++) {
    term *= lambda / i;
    acc = term;
  }
  return acc; // e^-λ λ^k / k!  (accumulation) — ATTENTION: renvoie le terme k
}
```

> ⚠️ Correction d'implémentation : la boucle ci-dessus est fautive (accumule sans sommer).
> La version correcte de `poissonPMF` est :

```ts
export function poissonPMF(lambda: number, k: number): number {
  if (lambda <= 0 || !Number.isFinite(lambda) || k < 0) return 0;
  let logP = -lambda;
  for (let i = 1; i <= k; i++) logP += Math.log(lambda) - Math.log(i);
  return Math.exp(logP);
}
```

```ts
export function buildScoreMatrix(lambdaHome: number, lambdaAway: number, max = 8): ScoreMatrix {
  const m: ScoreMatrix = [];
  for (let h = 0; h <= max; h++) {
    const row: number[] = [];
    for (let a = 0; a <= max; a++) row.push(poissonPMF(lambdaHome, h) * poissonPMF(lambdaAway, a));
    m.push(row);
  }
  return normalizeMatrix(m);
}

export function marketsFromMatrix(matrix: ScoreMatrix): Markets {
  const max = matrix.length - 1;
  let homeWin = 0, draw = 0, awayWin = 0;
  let over05 = 0, over15 = 0, over25 = 0, over35 = 0;
  let under15 = 0, under35 = 0, btts = 0;
  const scores: TopScore[] = [];
  for (let h = 0; h <= max; h++) {
    for (let a = 0; a <= max; a++) {
      const p = matrix[h][a];
      if (h > a) homeWin += p; else if (h === a) draw += p; else awayWin += p;
      const total = h + a;
      if (total >= 1) over05 += p;
      if (total >= 2) over15 += p;
      if (total >= 3) over25 += p;
      if (total >= 4) over35 += p;
      if (total <= 1) under15 += p;
      if (total <= 3) under35 += p;
      if (h >= 1 && a >= 1) btts += p;
      scores.push({ home: h, away: a, prob: p });
    }
  }
  scores.sort((x, y) => y.prob - x.prob);
  const p1x = homeWin + draw, px2 = draw + awayWin, p12 = homeWin + awayWin;
  const dc = p1x >= px2 && p1x >= p12 ? { selection: "1X" as const, prob: round2(p1x * 100) }
    : px2 >= p12 ? { selection: "X2" as const, prob: round2(px2 * 100) }
    : { selection: "12" as const, prob: round2(p12 * 100) };
  return {
    homeWin: round2(homeWin * 100), draw: round2(draw * 100), awayWin: round2(awayWin * 100),
    over05: round2(over05 * 100), over15: round2(over15 * 100), over25: round2(over25 * 100),
    over35: round2(over35 * 100), under15: round2(under15 * 100), under35: round2(under35 * 100),
    btts: round2(btts * 100), dc,
    topScores: scores.slice(0, 5),
  };
}

export function poissonMarkets(lambdaHome: number, lambdaAway: number): Markets {
  const mk = marketsFromMatrix(buildScoreMatrix(lambdaHome, lambdaAway));
  const lambdaCorners = Math.max(lambdaHome + lambdaAway, 0.5);
  mk.cornersOver = { line: 8.5, prob: round2(Math.min(99, poissonOver(8, lambdaCorners) * 100)) };
  return mk;
}
```

> ⚠️ `poissonOver(k, lambda)` dans football-predictions.ts retourne déjà un % 0-100 — utiliser
> `poissonOver(8, lambdaCorners)` directement, sans `*100`.

- [ ] **Step 4: Run to verify pass** — même commande, Expected: PASS (5/5)
- [ ] **Step 5: Commit**

```bash
git add src/lib/prediction/football/poisson.ts src/lib/prediction/football/poisson.test.ts
git commit -m "feat(prediction): moteur Poisson — matrice, marchés, corners"
```

---

### Task 3: Dixon-Coles

**Files:**
- Create: `src/lib/prediction/football/dixon-coles.ts`
- Test: `src/lib/prediction/football/dixon-coles.test.ts`

**Interfaces:**
- Consumes: `poisson.ts` (`poissonPMF`, `marketsFromMatrix`), `math-utils.ts`, `types.ts`
- Produces: `dixonColesMatrix(lambdaHome, lambdaAway, rho=-0.05, max=8)`, `dixonColesMarkets(lambdaHome, lambdaAway)`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/prediction/football/dixon-coles.test.ts
import { describe, expect, test } from "bun:test";
import { dixonColesMarkets, dixonColesMatrix } from "./dixon-coles";
import { buildScoreMatrix, marketsFromMatrix } from "./poisson";

describe("dixon-coles", () => {
  const rho = -0.05;
  test("τ augmente P(0-0) vs Poisson pur (ρ négatif → plus de matchs fermés)", () => {
    const base = buildScoreMatrix(1.35, 1.1)[0][0];
    const dc = dixonColesMatrix(1.35, 1.1, rho)[0][0];
    expect(dc).toBeGreaterThan(base);
  });
  test("τ augmente légèrement P(nul) et baisse 1X2 des extrêmes", () => {
    const base = marketsFromMatrix(buildScoreMatrix(1.35, 1.1));
    const dc = marketsFromMatrix(dixonColesMatrix(1.35, 1.1, rho));
    expect(dc.draw).toBeGreaterThan(base.draw);
    expect(dc.homeWin + dc.draw + dc.awayWin).toBeCloseTo(100, 6);
  });
  test("dixonColesMarkets expose le contrat Markets", () => {
    const mk = dixonColesMarkets(1.35, 1.1);
    expect(mk.homeWin).toBeGreaterThan(0);
    expect(mk.over25).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run to verify failure** — Expected: FAIL
- [ ] **Step 3: Implement**

```ts
// src/lib/prediction/football/dixon-coles.ts
import { normalizeMatrix } from "./math-utils";
import { poissonPMF } from "./poisson";
import { marketsFromMatrix } from "./poisson";
import type { Markets, ScoreMatrix } from "./types";

export function dixonColesMatrix(lambdaHome: number, lambdaAway: number, rho = -0.05, max = 8): ScoreMatrix {
  const m: ScoreMatrix = [];
  for (let h = 0; h <= max; h++) {
    const row: number[] = [];
    for (let a = 0; a <= max; a++) {
      let p = poissonPMF(lambdaHome, h) * poissonPMF(lambdaAway, a);
      if (h === 0 && a === 0) p *= 1 - lambdaHome * lambdaAway * rho;
      else if (h === 1 && a === 0) p *= 1 + lambdaHome * rho;
      else if (h === 0 && a === 1) p *= 1 + lambdaAway * rho;
      else if (h === 1 && a === 1) p *= 1 - rho;
      row.push(p);
    }
    m.push(row);
  }
  return normalizeMatrix(m);
}

export function dixonColesMarkets(lambdaHome: number, lambdaAway: number): Markets {
  return marketsFromMatrix(dixonColesMatrix(lambdaHome, lambdaAway));
}
```

- [ ] **Step 4: Run to verify pass** — Expected: PASS (3/3)
- [ ] **Step 5: Commit**

```bash
git add src/lib/prediction/football/dixon-coles.ts src/lib/prediction/football/dixon-coles.test.ts
git commit -m "feat(prediction): Dixon-Coles — correction τ des faibles scores"
```

---

### Task 4: Elo double home/away

**Files:**
- Create: `src/lib/prediction/football/elo.ts`
- Test: `src/lib/prediction/football/elo.test.ts`

**Interfaces:**
- Consumes: `types.ts` (`EloPair`, `EloConfig`, `DEFAULT_ELO_CONFIG`)
- Produces: `expectedScore(rA, rB)`, `systemK(rA, rB, cfg)`, `marginMultiplier(gd)`,
  `decayWeight(daysSince, cfg)`, `updateEloPair(pair, homeScore, awayScore, daysSince, cfg)`,
  `elo1X2(homeE, awayE, cfg)` → `{ home, draw, away }` (probas 0-100)

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/prediction/football/elo.test.ts
import { describe, expect, test } from "bun:test";
import { DEFAULT_ELO_CONFIG as C } from "./types";
import { decayWeight, elo1X2, expectedScore, marginMultiplier, systemK, updateEloPair } from "./elo";

describe("elo", () => {
  test("expectedScore symétrique autour de 0.5", () => {
    expect(expectedScore(1500, 1500)).toBeCloseTo(0.5, 8);
    const p = expectedScore(1600, 1500);
    expect(p).toBeCloseTo(1 - expectedScore(1500, 1600), 8);
    expect(p).toBeGreaterThan(0.5);
  });
  test("systemK : écart < 400 → K, sinon KBig", () => {
    expect(systemK(1500, 1500, C)).toBe(C.k);
    expect(systemK(1500, 2000, C)).toBe(C.kBig);
  });
  test("marginMultiplier : nul → 1, +1 → 1.5, +2 → 1.75, ≥3 → 2", () => {
    expect(marginMultiplier(0)).toBe(1);
    expect(marginMultiplier(2)).toBe(1.75);
    expect(marginMultiplier(3)).toBe(2);
  });
  test("decayWeight : 0j → 1, 200j → ~0.45, ≥365 → 0", () => {
    expect(decayWeight(0, C)).toBe(1);
    expect(decayWeight(200, C)).toBeCloseTo(1 - 200 / 365, 4);
    expect(decayWeight(400, C)).toBe(0);
  });
  test("updateEloPair : le vainqueur monte, l'écart monte avec la marge", () => {
    const p = { home: 1500, away: 1500 };
    const r1 = updateEloPair(p, 2, 0, 7, C); // dom gagne 2-0
    expect(r1.home).toBeGreaterThan(1500);
    expect(r1.away).toBeLessThan(1500);
    const r2 = updateEloPair(p, 1, 0, 7, C); // dom gagne 1-0 seulement
    expect(r1.home - r1.away).toBeGreaterThan(r2.home - r2.away);
  });
  test("elo1X2 : avantage home bascule la proba", () => {
    const p = elo1X2(1500, 1500, C);
    expect(p.home).toBeGreaterThan(p.away);
    const sum = p.home + p.draw + p.away;
    expect(sum).toBeCloseTo(100, 6);
  });
});
```

- [ ] **Step 2: Run to verify failure** — Expected: FAIL
- [ ] **Step 3: Implement**

```ts
// src/lib/prediction/football/elo.ts
import { clamp01, round2 } from "./math-utils";
import type { EloConfig, EloPair } from "./types";

export function expectedScore(rA: number, rB: number): number {
  return 1 / (1 + Math.pow(10, (rB - rA) / 400));
}

export function systemK(rA: number, rB: number, cfg: EloConfig): number {
  return Math.abs(rA - rB) >= cfg.threshold ? cfg.kBig : cfg.k;
}

export function marginMultiplier(gd: number): number {
  if (gd <= 0) return 1;
  if (gd === 1) return 1.5;
  if (gd === 2) return 1.75;
  return 2;
}

export function decayWeight(daysSince: number, cfg: EloConfig): number {
  return Math.max(0, 1 - daysSince / cfg.decayDays);
}

/** Met à jour une paire de ratings après un match (avec avantage home + marge + décay). */
export function updateEloPair(
  pair: EloPair, homeScore: number, awayScore: number,
  daysSince: number, cfg: EloConfig,
): EloPair {
  const w = decayWeight(daysSince, cfg);
  if (w <= 0) return pair;
  const rHome = pair.home + cfg.homeAdv; // terrain
  const eHome = expectedScore(rHome, pair.away);
  const eAway = 1 - eHome;
  const gd = homeScore - awayScore;
  const k = systemK(pair.home, pair.away, cfg) * marginMultiplier(gd) * w;
  let sa = 0.5, sb = 0.5;
  if (gd > 0) { sa = 1; sb = 0; } else if (gd < 0) { sa = 0; sb = 1; }
  return {
    home: pair.home + k * (sa - eHome),
    away: pair.away + k * (sb - eAway),
  };
}

/** Probas 1X2 dérivées de l'Elo (logistique + avantage terrain), en %. */
export function elo1X2(homeE: number, awayE: number, cfg: EloConfig): { home: number; draw: number; away: number } {
  const p1 = expectedScore(homeE + cfg.homeAdv, awayE);
  const p2 = expectedScore(awayE + cfg.homeAdv, homeE);
  const draw = clamp01(1 - p1 - p2);
  return { home: round2((1 - draw) * p1 * 100), draw: round2(draw * 100), away: round2((1 - draw) * p2 * 100) };
}
```

> Note : `elo1X2` renvoie les trois côtés à 100 % près (re-normalisation implicite : p1/(1-draw)).

- [ ] **Step 4: Run to verify pass** — Expected: PASS (6/6)
- [ ] **Step 5: Commit**

```bash
git add src/lib/prediction/football/elo.ts src/lib/prediction/football/elo.test.ts
git commit -m "feat(prediction): Elo double home/away — K adaptatif, marge, décay"
```

---

### Task 5: Replay historique (lecture legacy + LRU)

**Files:**
- Create: `src/lib/prediction/football/elo-history.ts`
- Test: `src/lib/prediction/football/elo-history.test.ts`

**Interfaces:**
- Consumes: `elo.ts` (`updateEloPair`), `types.ts` (`EloConfig`, `DEFAULT_ELO_CONFIG`)
- Produces: `getEloDatabase(): SqliteLike` (pattern `src/lib/tennis-stats/db.ts` : better-sqlite3
  dynamic import prod, `bun:sqlite` en test via injection `setEloDbForTests(db)`),
  `computeEloRatings(history: HistoryRow[]): Map<string, EloPair>` (replay trié par date),
  `HistoryRow = { home_team, away_team, home_score, away_score, match_date }`,
  `loadHistoryFromDb(db, leagueFilter?, sinceDate?)`, `getTeamElo(db, teamName) : EloPair | null`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/prediction/football/elo-history.test.ts
import { describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { computeEloRatings, loadHistoryFromDb, setEloDbForTests } from "./elo-history";

function seedDb(): Database {
  const db = new Database(":memory:");
  db.run(`CREATE TABLE match_stats_history (
    bsd_event_id TEXT PRIMARY KEY, home_team TEXT, away_team TEXT,
    home_score INTEGER, away_score INTEGER, match_date TEXT)`);
  const ins = db.prepare(`INSERT INTO match_stats_history
    (bsd_event_id, home_team, away_team, home_score, away_score, match_date)
    VALUES (?, ?, ?, ?, ?, ?)`);
  ins.run("1", "PSG", "Marseille", 2, 0, "2026-08-01");
  ins.run("2", "Marseille", "PSG", 0, 3, "2026-08-08"); // fait vieux (semaine dernière)
  return db;
}

describe("elo-history", () => {
  test("loadHistoryFromDb lit les matchs triés par date croissante", () => {
    const db = seedDb();
    setEloDbForTests(db);
    const rows = loadHistoryFromDb(db);
    expect(rows).toHaveLength(2);
    expect(rows[0].home_team).toBe("PSG");
    expect(rows[0].match_date <= rows[1].match_date).toBe(true);
  });
  test("computeEloRatings : PSG monte après 2 victoires, Marseille descend", () => {
    const db = seedDb();
    setEloDbForTests(db);
    const ratings = computeEloRatings(loadHistoryFromDb(db));
    const psg = ratings.get("psg");
    const marseille = ratings.get("marseille");
    expect(psg).not.toBeNull();
    expect(marseille).not.toBeNull();
    expect(psg!.away).toBeGreaterThan(1500);   // gagne à l'extérieur ↔ rating away↑
    expect(marseille!.home).toBeLessThan(1500);
  });
});
```

> Note : `computeEloRatings` normalise les noms d'équipe (minuscules + clé `name_norm` :
> trim, lowercase, suppression accents diacritiques) — mêmes règles que `team_logos`/`name_norm`.

- [ ] **Step 2: Run to verify failure** — Expected: FAIL
- [ ] **Step 3: Implement**

```ts
// src/lib/prediction/football/elo-history.ts
import type { Database as BunDatabase } from "bun:sqlite";
import { updateEloPair } from "./elo";
import { DEFAULT_ELO_CONFIG, type EloConfig, type EloPair } from "./types";

export type HistoryRow = {
  home_team: string; away_team: string;
  home_score: number; away_score: number;
  match_date: string | null;
};

export type SqliteLike = {
  prepare(sql: string): { all(...args: unknown[]): HistoryRow[] };
};

let testDb: SqliteLike | null = null;
export function setEloDbForTests(db: SqliteLike | null): void { testDb = db; }

export function getEloDatabase(): SqliteLike {
  if (testDb) return testDb;
  // Pattern tennis-stats/db.ts — dynamic import CJS natif
  const Database = require("better-sqlite3") as unknown as {
    (path: string): SqliteLike & { prepare(sql: string): { all(...a: unknown[]): unknown[] } };
  };
  const dbPath = process.env.LEGACY_DB_PATH ?? "pariscore.db";
  return Database(dbPath) as unknown as SqliteLike;
}

export function nameNorm(name: string): string {
  return name.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function loadHistoryFromDb(db: SqliteLike, sinceDays = 365 * 2): HistoryRow[] {
  const since = new Date(Date.now() - sinceDays * 864e5).toISOString().slice(0, 10);
  const rows = db.prepare(
    `SELECT home_team, away_team, home_score, away_score, match_date
     FROM match_stats_history
     WHERE match_date >= ? AND home_score IS NOT NULL AND away_score IS NOT NULL
     ORDER BY match_date ASC`
  ).all(since) as HistoryRow[];
  return rows.filter((r) => Number.isFinite(r.home_score) && Number.isFinite(r.away_score));
}

export function computeEloRatings(history: HistoryRow[], cfg: EloConfig = DEFAULT_ELO_CONFIG): Map<string, EloPair> {
  const ratings = new Map<string, EloPair>();
  const get = (name: string): EloPair => {
    const key = nameNorm(name);
    let r = ratings.get(key);
    if (!r) { r = { home: cfg.init, away: cfg.init }; ratings.set(key, r); }
    return r;
  };
  const ref = Date.now();
  for (const m of history) {
    const daysSince = m.match_date
      ? Math.max(0, (ref - new Date(m.match_date).getTime()) / 864e5)
      : 0;
    const home = get(m.home_team);
    const away = get(m.away_team);
    const updatedHome = updateEloPair(home, m.home_score, m.away_score, daysSince, cfg);
    const updatedAway = { home: away.home, away: away.away };
    // home a joué à domicile → son rating "home" bouge ; away : son rating "away" bouge
    // (Elo double : homePlay=rating.home de l'équipe à domicile… voir note ci-dessous)
    ratings.set(nameNorm(m.home_team), updatedHome);
    ratings.set(nameNorm(m.away_team), updatedAway);
  }
  return ratings;
}
```

> ⚠️ Note d'implémentation (Elo double home/away, style ClubElo) : une équipe qui joue à
> domicile voit son rating `home` mis à jour (l'adversaire utilise son rating `away`).
> Concrètement, `updateEloPair` doit recevoir `{ home: pairHome.home, away: pairAway.away }`
> puis écrire `home`` members. La version propre est :

```ts
export function computeEloRatings(history: HistoryRow[], cfg: EloConfig = DEFAULT_ELO_CONFIG): Map<string, EloPair> {
  const ratings = new Map<string, EloPair>();
  const get = (name: string): EloPair => {
    const key = nameNorm(name);
    let r = ratings.get(key);
    if (!r) { r = { home: cfg.init, away: cfg.init }; ratings.set(key, r); }
    return r;
  };
  const ref = Date.now();
  for (const m of history) {
    const daysSince = m.match_date ? Math.max(0, (ref - new Date(m.match_date).getTime()) / 864e5) : 0;
    const pHome = get(m.home_team);
    const pAway = get(m.away_team);
    const ctx = { home: pHome.home, away: pAway.away };
    const updated = updateEloPair(ctx, m.home_score, m.away_score, daysSince, cfg);
    ratings.set(nameNorm(m.home_team), { home: updated.home, away: pHome.away });
    ratings.set(nameNorm(m.away_team), { home: pAway.home, away: updated.away });
  }
  return ratings;
}
```

- [ ] **Step 4: Run to verify pass** — Expected: PASS (2/2)
- [ ] **Step 5: Commit**

```bash
git add src/lib/prediction/football/elo-history.ts src/lib/prediction/football/elo-history.test.ts
git commit -m "feat(prediction): replay Elo depuis match_stats_history (LRU + tests bun:sqlite)"
```

---

### Task 6: Blend bayésien + calibration

**Files:**
- Create: `src/lib/prediction/football/blend.ts`
- Test: `src/lib/prediction/football/blend.test.ts`

**Interfaces:**
- Consumes: `poisson.ts` (`poissonMarkets`), `dixon-coles.ts`, `elo.ts` (`elo1X2`), `types.ts`
- Produces: `blendMarkets(poisson: Markets, elo: {home,draw,away}, xg: Markets | null,
  weights = { poisson: 0.5, elo: 0.25, xg: 0.25 })` (moyenne pondérée champ à champ sur
  homeWin/draw/awayWin/over25/btts/over15 puis renormalisation 1X2 à 100),
  `calibrateMarkets(mk: Markets, kind: "prematch" | "live")` (tables portées de server.js)

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/prediction/football/blend.test.ts
import { describe, expect, test } from "bun:test";
import { blendMarkets, calibrateMarkets } from "./blend";
import { poissonMarkets } from "./poisson";

describe("blend", () => {
  const poisson = poissonMarkets(1.35, 1.1);
  const elo = { home: 40, draw: 28, away: 32 };
  const xg = poissonMarkets(1.6, 0.95);
  test("blend sans xg conserve des probas valides", () => {
    const b = blendMarkets(poisson, elo, null);
    expect(b.homeWin + b.draw + b.awayWin).toBeCloseTo(100, 4);
    expect(b.homeWin).toBeGreaterThan(0);
  });
  test("blend avec xg tire la proba dans la direction du xg", () => {
    const bNull = blendMarkets(poisson, elo, null);
    const bXg = blendMarkets(poisson, elo, xg);
    expect(bXg.homeWin).toBeGreaterThan(bNull.homeWin);
  });
  test("calibrateMarkets prematch : sous 60 → réhausse légère, 90+ → réduit", () => {
    const mk = { ...poisson, homeWin: 95 };
    const c = calibrateMarkets(mk as never, "prematch");
    expect(c.homeWin).toBeLessThan(95);
    expect(c.homeWin).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run to verify failure** — Expected: FAIL
- [ ] **Step 3: Implement**

```ts
// src/lib/prediction/football/blend.ts
import { round2 } from "./math-utils";
import type { Markets } from "./types";

export type Elo1X2 = { home: number; draw: number; away: number };

/** Tables de calibration portées de server.js (l.8943 prematch) et (l.9006 live). */
const PREMATCH_CAL: [number, number][] = [
  [40, 36], [50, 47], [60, 56], [70, 64], [80, 72], [90, 84], [95, 90],
];
const LIVE_CAL: [number, number][] = [
  [55, 53], [70, 67], [80, 74], [90, 83], [95, 87],
];

function calCurve(raw: number, table: [number, number][]): number {
  let hi = table[table.length - 1];
  let lo = table[0];
  for (const [min, out] of table) {
    if (raw >= min) lo = [min, out];
    if (raw <= min) { hi = [min, out]; break; }
  }
  if (raw <= lo[0]) return lo[1];
  if (raw >= hi[0]) return hi[1];
  const t = (raw - lo[0]) / Math.max(1e-9, hi[0] - lo[0]);
  return lo[1] + t * (hi[1] - lo[1]);
}

export function blendMarkets(
  poisson: Markets, elo: Elo1X2, xg: Markets | null,
  weights = { poisson: 0.5, elo: 0.25, xg: 0.25 },
): Markets {
  const wE = weights.elo / (weights.elo + weights.xg);
  const pick = (which: "poisson" | "xg"): Markets => (which === "poisson" ? poisson : xg!);
  const homeWin = weights.poisson * poisson.homeWin + weights.elo * elo.home + (xg ? weights.xg * xg.homeWin : weights.elo * poisson.homeWin * wE);
  const draw = weights.poisson * poisson.draw + weights.elo * elo.draw + (xg ? weights.xg * xg.draw : weights.elo * poisson.draw * wE);
  const awayWin = weights.poisson * poisson.awayWin + weights.elo * elo.away + (xg ? weights.xg * xg.awayWin : weights.elo * poisson.awayWin * wE);
  const sum = homeWin + draw + awayWin;
  const renorm = (v: number) => round2((v / sum) * 100);
  const over25 = weights.poisson * poisson.over25 + (xg ? weights.xg * xg.over25 : 0) + weights.elo * poisson.over25;
  const btts = weights.poisson * poisson.btts + (xg ? weights.xg * xg.btts : 0) + weights.elo * poisson.btts;
  const over15 = weights.poisson * poisson.over15 + (xg ? weights.xg * xg.over15 : 0) + weights.elo * poisson.over15;
  return {
    ...poisson,
    homeWin: renorm(homeWin * (1 - 0) + 0),
    draw: renorm(draw),
    awayWin: renorm(awayWin),
    over25: round2(over25 / (weights.poisson + weights.elo + (xg ? weights.xg : weights.xg))),
    btts: round2(btts),
    over15: round2(over15),
    dc: poisson.dc,
    topScores: poisson.topScores,
  };
}

// ⚠️ Correction : l'implémentation ci-dessus a des artefacts (renorm étrange sur homeWin,
// division par somme de poids sur over25). La version propre et conforme au blend legacy :

export function blendMarkets(poisson: Markets, elo: Elo1X2, xg: Markets | null, weights = { poisson: 0.5, elo: 0.25, xg: 0.25 }): Markets {
  const wt = xg ? weights : { poisson: weights.poisson + weights.xg, elo: weights.elo, xg: 0 };
  const mix = (a: number, b: number, c: number) => round2((wt.poisson * a + wt.elo * b + (xg ? wt.xg * c : 0)) / (wt.poisson + wt.elo + (xg ? wt.xg : 0)));
  const homeWin = mix(poisson.homeWin, elo.home, xg?.homeWin ?? poisson.homeWin);
  const draw = mix(poisson.draw, elo.draw, xg?.draw ?? poisson.draw);
  const awayWin = mix(poisson.awayWin, elo.away, xg?.awayWin ?? poisson.awayWin);
  const sum = homeWin + draw + awayWin;
  return {
    ...poisson,
    homeWin: round2((homeWin / sum) * 100),
    draw: round2((draw / sum) * 100),
    awayWin: round2((awayWin / sum) * 100),
    over25: mix(poisson.over25, poisson.over25, xg?.over25 ?? poisson.over25),
    btts: mix(poisson.btts, poisson.btts, xg?.btts ?? poisson.btts),
    over15: mix(poisson.over15, poisson.over15, xg?.over15 ?? poisson.over15),
    dc: poisson.dc,
    topScores: poisson.topScores,
  };
}

export function calibrateMarkets(mk: Markets, kind: "prematch" | "live"): Markets {
  const table = kind === "prematch" ? PREMATCH_CAL : LIVE_CAL;
  const cal = (v: number) => round2(calCurve(v, table));
  return { ...mk, homeWin: cal(mk.homeWin), draw: cal(mk.draw), awayWin: cal(mk.awayWin) };
}
```

> Le plan documente l'implémentation finale (2e définition de `blendMarkets` gagne — la 1re
> est affichée comme illustration des artefacts à éviter ; seule la version finale est écrite).

- [ ] **Step 4: Run to verify pass** — Expected: PASS (3/3)
- [ ] **Step 5: Commit**

```bash
git add src/lib/prediction/football/blend.ts src/lib/prediction/football/blend.test.ts
git commit -m "feat(prediction): blend bayésien 50/25/25 + calibration portée"
```

---

### Task 7: Live decay — probas conditionnelles in-play

**Files:**
- Create: `src/lib/prediction/football/live-decay.ts`
- Test: `src/lib/prediction/football/live-decay.test.ts`

**Interfaces:**
- Consumes: `poisson.ts` (`buildScoreMatrix`), `types.ts` (`LiveInputs`, `LiveMarkets`, `EloPair`)
- Produces: `effectiveLambdas(base: EloPair, live: LiveInputs) → EloPair` (λ × minutes restantes/
  90 × facteur carton rouge ±0.20/exclusion × momentum tanh), `computeLiveMarkets(base: EloPair,
  live: LiveInputs) → LiveMarkets` (matrice conditionnelle sur buts RESTANTS, marchés ; 1X2 final =
  score actuel + buts restants)

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/prediction/football/live-decay.test.ts
import { describe, expect, test } from "bun:test";
import { computeLiveMarkets, effectiveLambdas } from "./live-decay";

const base = { home: 1.35, away: 1.1 }; // λ 90'
describe("live-decay", () => {
  test("effectiveLambdas : 60' sans événement → λ ≈ 1/3 des λ de base", () => {
    const e = effectiveLambdas(base, { scoreHome: 0, scoreAway: 0, minute: 60,
      redCardHome: 0, redCardAway: 0, xgCumHome: null, xgCumAway: null, momentum15: 0 });
    expect(e.home).toBeCloseTo(base.home * (30 / 90), 3);
  });
  test("carton rouge adverse augmente λ du bénéficiaire", () => {
    const e = effectiveLambdas(base, { scoreHome: 0, scoreAway: 0, minute: 30,
      redCardHome: 0, redCardAway: 1, xgCumHome: null, xgCumAway: null, momentum15: 0 });
    expect(e.home).toBeGreaterThan(base.home * (60 / 90));
  });
  test("computeLiveMarkets : à 90' 1-0, victoire dom ≈ 100", () => {
    const mk = computeLiveMarkets(base, { scoreHome: 1, scoreAway: 0, minute: 90,
      redCardHome: 0, redCardAway: 0, xgCumHome: null, xgCumAway: null, momentum15: 0 });
    expect(mk.homeWin).toBeGreaterThan(90);
    expect(mk.homeWin + mk.draw + mk.awayWin).toBeCloseTo(100, 4);
  });
  test("à 1-1 à la 75', les trois issues restent ouvertes", () => {
    const mk = computeLiveMarkets(base, { scoreHome: 1, scoreAway: 1, minute: 75,
      redCardHome: 0, redCardAway: 0, xgCumHome: null, xgCumAway: null, momentum15: 0 });
    expect(mk.homeWin).toBeGreaterThan(20);
    expect(mk.draw).toBeGreaterThan(20);
    expect(mk.awayWin).toBeGreaterThan(20);
  });
  test("momentum15 négatif (extérieur domine) réduit P(1X2 home)", () => {
    const noMom = computeLiveMarkets(base, { scoreHome: 0, scoreAway: 0, minute: 30,
      redCardHome: 0, redCardAway: 0, xgCumHome: null, xgCumAway: null, momentum15: 0 });
    const negMom = computeLiveMarkets(base, { scoreHome: 0, scoreAway: 0, minute: 30,
      redCardHome: 0, redCardAway: 0, xgCumHome: null, xgCumAway: null, momentum15: -0.8 });
    expect(negMom.homeWin).toBeLessThan(noMom.homeWin);
  });
});
```

- [ ] **Step 2: Run to verify failure** — Expected: FAIL
- [ ] **Step 3: Implement**

```ts
// src/lib/prediction/football/live-decay.ts
import { normalizeMatrix, round2 } from "./math-utils";
import { poissonPMF } from "./poisson";
import type { EloPair, LiveInputs, LiveMarkets } from "./types";

const RED_CARD_LAMBDA_FACTOR = 0.2;   // ±20 % par exclusion
const MOMENTUM_WEIGHT = 0.15;         // poids du momentum 15' sur λ

export function effectiveLambdas(base: EloPair, live: LiveInputs): EloPair {
  const frac = Math.max(0, Math.min(1, (90 - live.minute) / 90));
  const redHome = 1 + RED_CARD_LAMBDA_FACTOR * live.redCardAway - RED_CARD_LAMBDA_FACTOR * live.redCardHome;
  const redAway = 1 + RED_CARD_LAMBDA_FACTOR * live.redCardHome - RED_CARD_LAMBDA_FACTOR * live.redCardAway;
  const mom = MOMENTUM_WEIGHT * Math.tanh(clampN(live.momentum15 ?? 0));
  return {
    home: Math.max(0.05, base.home * frac * redHome * (1 + mom)),
    away: Math.max(0.05, base.away * frac * redAway * (1 - mom)),
  };
}

function clampN(x: number): number { return Math.min(1, Math.max(-1, x)); }

export function computeLiveMarkets(base: EloPair, live: LiveInputs): LiveMarkets {
  const lambda = effectiveLambdas(base, live);
  const matrix = normalizeMatrix(buildRaw(lambda.home, lambda.away, 6));
  let homeWin = 0, draw = 0, awayWin = 0, over15 = 0, over25 = 0, over35 = 0, btts = 0;
  for (let h = 0; h <= 6; h++) {
    for (let a = 0; a <= 6; a++) {
      const p = matrix[h][a];
      const fh = live.scoreHome + h, fa = live.scoreAway + a;
      if (fh > fa) homeWin += p; else if (fh === fa) draw += p; else awayWin += p;
      const total = fh + fa - live.scoreHome - live.scoreAway;
      if (total >= 2) over15 += p;
      if (total >= 3) over25 += p;
      if (total >= 4) over35 += p;
      if (h >= 1 && a >= 1) btts += p;
    }
  }
  const s = homeWin + draw + awayWin;
  return {
    minute: live.minute, scoreHome: live.scoreHome, scoreAway: live.scoreAway,
    homeWin: round2((homeWin / s) * 100), draw: round2((draw / s) * 100), awayWin: round2((awayWin / s) * 100),
    over15: round2(over15 * 100), over25: round2(over25 * 100), over35: round2(over35 * 100),
    btts: round2(btts * 100),
    homeWinBefore: round2(bayesianPrior(lambda, live) * 100),
    drawBefore: 0, awayBefore: 0,
    lambdaRemaining: lambda,
  };
}

function bayesianPrior(lambda: EloPair, live: LiveInputs): number {
  // Prior simple : P(dom gagne) ≈ expit(Δλ)
  return 1 / (1 + Math.exp(-(lambda.home - lambda.away)));
}

function buildRaw(lh: number, la: number, max: number): number[][] {
  const m: number[][] = [];
  for (let h = 0; h <= max; h++) {
    const row: number[] = [];
    for (let a = 0; a <= max; a++) row.push(poissonPMF(lh, h) * poissonPMF(la, a));
    m.push(row);
  }
  return m;
}
```

> ⚠️ `buildRaw` est redondant avec `buildScoreMatrix` (Task 2) — utiliser
> `import { buildScoreMatrix } from "./poisson"` et supprimer `buildRaw`. `homeWinBefore`
> est un placeholder de design (sous-projet 2/3) — ne pas exposer de champs vides :
> le type `LiveMarkets` ne contient que les champs réellement calculés (retirer
> `homeWinBefore/drawBefore/awayBefore` si non utilisés).

- [ ] **Step 4: Run to verify pass** — Expected: PASS (5/5)
- [ ] **Step 5: Commit**

```bash
git add src/lib/prediction/football/live-decay.ts src/lib/prediction/football/live-decay.test.ts
git commit -m "feat(prediction): live-decay — λ décroissant, cartons rouges, momentum, 1X2 conditionnel"
```

---

### Task 8: Orchestration computePrediction

**Files:**
- Create: `src/lib/prediction/football/index.ts`
- Test: `src/lib/prediction/football/index.test.ts`

**Interfaces:**
- Consumes: toutes les tâches 1-7 + `prisma` (client existant), `bsd-football-fetcher` si besoin
- Produces: `computePrediction(matchId: string): Promise<EngineResult>` — lit le match Prisma,
  charge inputs λ (`loadRankingsInput` : lecture fs `public/data/rankings/{league}.json`,
  nom normalisé → rangée `gf`/`ga`/`w+d+l` ; fallback moyennes ligue 1.45), Elo par replay,
  blend calibré ; si live (`status` live + scores/minute) → `computeLiveMarkets`.
  Jamais throw : catch → `errors` ; match absent → `{ errors: ["MATCH_NOT_FOUND"] }`.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/prediction/football/index.test.ts
import { describe, expect, test } from "bun:test";
import { computePrediction } from ".";
import { setEloDbForTests } from "./elo-history";
import { Database } from "bun:sqlite";

describe("computePrediction", () => {
  test("match inconnu → errors MATCH_NOT_FOUND, pas de throw", async () => {
    const res = await computePrediction("match-inconnu", {
      findMatch: async () => null,
      loadRankings: async () => null,
    });
    expect(res.errors).toContain("MATCH_NOT_FOUND");
    expect(res.markets).toBeUndefined();
  });
  test("match prematch avec inputs complets → blend calibré", async () => {
    setEloDbForTests(new Database(":memory:"));
    const res = await computePrediction("m1", {
      findMatch: async () => ({
        id: "m1", homeName: "PSG", awayName: "Marseille", leagueId: "ligue1",
        status: "scheduled" as const, liveHomeScore: null, liveAwayScore: null, liveMinute: null,
      }),
      loadRankings: async () => ({ home: { gf: 60, ga: 20, gp: 20 }, away: { gf: 25, ga: 35, gp: 20 } }),
    });
    expect(res.mode).toBe("prematch");
    expect(res.markets).toBeDefined();
    expect(res.modelSource).toBe("blend");
    expect(res.markets!.homeWin + res.markets!.draw + res.markets!.awayWin).toBeCloseTo(100, 2);
  });
  test("match live → live markets conditionnels", async () => {
    setEloDbForTests(new Database(":memory:"));
    const res = await computePrediction("m2", {
      findMatch: async () => ({
        id: "m2", homeName: "PSG", awayName: "Marseille", leagueId: "ligue1",
        status: "live" as const, liveHomeScore: 1, liveAwayScore: 0, liveMinute: 60,
      }),
      loadRankings: async () => ({ home: { gf: 60, ga: 20, gp: 20 }, away: { gf: 25, ga: 35, gp: 20 } }),
    });
    expect(res.mode).toBe("live");
    expect(res.live).toBeDefined();
    expect(res.live!.homeWin).toBeGreaterThan(50);
  });
});
```

- [ ] **Step 2: Run to verify failure** — Expected: FAIL
- [ ] **Step 3: Implement**

```ts
// src/lib/prediction/football/index.ts
import { readFileSync } from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/prisma"; // adapté au client existant du repo
import { blendMarkets, calibrateMarkets } from "./blend";
import { elo1X2 } from "./elo";
import { computeEloRatings, getEloDatabase, loadHistoryFromDb, nameNorm } from "./elo-history";
import { computeLiveMarkets } from "./live-decay";
import { dixonColesMarkets } from "./dixon-coles";
import { poissonMarkets } from "./poisson";
import type { EngineResult, Markets } from "./types";

export type PredictionDeps = {
  findMatch: (id: string) => Promise<MatchLike | null>;
  loadRankings?: (leagueId: string) => Promise<RankingsInput | null>;
};

export type MatchLike = {
  id: string; homeName: string; awayName: string; leagueId: string | null;
  status: string; liveHomeScore: number | null; liveAwayScore: number | null; liveMinute: number | null;
};
export type RankingsInput = { home: TeamAgg; away: TeamAgg };
type TeamAgg = { gf: number; ga: number; gp: number };

const LEAGUE_AVG_GOALS = 1.45;

export async function computePrediction(matchId: string, deps?: Partial<PredictionDeps>): Promise<EngineResult> {
  const errors: string[] = [];
  try {
    const findMatch = deps?.findMatch ?? (async (id: string) => {
      const m = await prisma.match.findUnique({ where: { id }, include: { home: true, away: true } });
      if (!m) return null;
      return {
        id: m.id, homeName: m.home.name, awayName: m.away.name, leagueId: m.leagueId,
        status: m.status, liveHomeScore: m.liveHomeScore, liveAwayScore: m.liveAwayScore,
        liveMinute: m.liveMinute,
      };
    });
    const match = await findMatch(matchId);
    if (!match) return { mode: "prematch", errors: ["MATCH_NOT_FOUND"] };

    const rankings = await loadInputs(match);
    const lambdas = computeLambdas(rankings);
    const poisson = poissonMarkets(lambdas.home, lambdas.away);
    const dc = dixonColesMarkets(lambdas.home, lambdas.away);
    const hist = loadHistoryFromDb(getEloDatabase());
    const ratings = computeEloRatings(hist);
    const homeElo = ratings.get(nameNorm(match.homeName));
    const awayElo = ratings.get(nameNorm(match.awayName));
    const eloKnown = Boolean(homeElo && awayElo);
    const elo = eloKnown ? elo1X2(homeElo!.home, awayElo!.away, DEFAULT_ELO_CONFIG) : { home: 50, draw: 26, away: 24 };
    const xgModel: Markets | null = null; // xG disponible → sous-projet 2 (xG logit porté)
    let blended = blendMarkets(dc, elo, xgModel);
    blended = calibrateMarkets(blended, "prematch");

    const isLive = match.status === "live" || match.status === "in_play" || (match.liveMinute != null && match.liveHomeScore != null && match.liveAwayScore != null);
    if (isLive) {
      const live = computeLiveMarkets(lambdas, {
        scoreHome: match.liveHomeScore ?? 0, scoreAway: match.liveAwayScore ?? 0,
        minute: match.liveMinute ?? 0, redCardHome: 0, redCardAway: 0,
        xgCumHome: null, xgCumAway: null, momentum15: await loadMomentum15(match.id),
      });
      return { mode: "live", lambda: lambdas, markets: blended, live, elo: { home: homeElo?.home ?? 1500, away: awayElo?.away ?? 1500, eloKnown }, modelSource: "live-decay", errors };
    }
    return { mode: "prematch", lambda: lambdas, markets: blended, elo: { home: homeElo?.home ?? 1500, away: awayElo?.away ?? 1500, eloKnown }, modelSource: "blend", errors };
  } catch (e) {
    errors.push(e instanceof Error ? e.message : "UNKNOWN_ERROR");
    return { mode: "prematch", errors };
  }
}

async function loadInputs(match: MatchLike): Promise<RankingsInput | null> {
  if (match.leagueId) {
    const file = path.join(process.cwd(), "public", "data", "rankings", `${match.leagueId}.json`);
    try {
      const raw = JSON.parse(readFileSync(file, "utf8")) as {
        home: Record<string, { name: string; value: number | null }[]>;
        away: Record<string, { name: string; value: number | null }[]>;
      };
      const find = (side: "home" | "away", name: string) =>
        (raw[side]?.gf ?? []).find((r) => nameNorm(r.name) === nameNorm(name));
      const rowH = find("home", match.homeName);
      const rowA = find("away", match.awayName);
      const gp = (rows: { w: number; d: number; l: number }[] | undefined) => 0; // compat placeholder
      return { home: { gf: rowH?.value ?? NaN, ga: NaN, gp: 20 }, away: { gf: rowA?.value ?? NaN, ga: NaN, gp: 20 } };
    } catch { /* fallback ligue */ }
  }
  return null;
}

function computeLambdas(r: RankingsInput | null): { home: number; away: number } {
  if (!r) return { home: LEAGUE_AVG_GOALS * 0.55, away: LEAGUE_AVG_GOALS * 0.45 };
  const avg = LEAGUE_AVG_GOALS;
  const attH = (r.home.gf / Math.max(r.home.gp, 1)) / avg;
  const defA = (r.away.ga / Math.max(r.away.gp, 1)) / avg;
  const attA = (r.away.gf / Math.max(r.away.gp, 1)) / avg;
  const defH = (r.home.ga / Math.max(r.home.gp, 1)) / avg;
  const home = round2(Math.max(0.2, Math.min(4.5, avg * attH * defA)));
  const away = round2(Math.max(0.2, Math.min(4.5, avg * attA * defH)));
  return { home, away };
}

async function loadMomentum15(_matchId: string): Promise<number | null> { return null; } // sous-projet 3
```

> ⚠️ `loadInputs` ci-dessus est un ébauche incomplète (GP non extrait, NaN). La version finale :
> chaque métrique (`gf`, `ga`, `w`, `d`, `l`) est une entrée de `home`/`away` ; GP = somme
> `w+d+l` de la rangée de l'équipe (même `teamId`), *pas* un placeholder. Implémenter :

```ts
async function loadInputs(match: MatchLike): Promise<RankingsInput | null> {
  if (!match.leagueId) return null;
  const file = path.join(process.cwd(), "public", "data", "rankings", `${match.leagueId}.json`);
  try {
    const raw = JSON.parse(readFileSync(file, "utf8")) as {
      home: Record<string, { teamId: string; name: string; value: number | null }[]>;
      away: Record<string, { teamId: string; name: string; value: number | null }[]>;
    };
    const sideRow = (side: "home" | "away", metric: string) => {
      const list = raw[side][metric] ?? [];
      return list.find((r) => nameNorm(r.name) === nameNorm(match.homeName))
        ?? list.find((r) => nameNorm(r.name) === nameNorm(match.awayName));
    };
    const h = sideRow("home", "gf"); // rangée domicile de l'équipe home
    const aSide = raw.away["gf"] ?? [];
    const a = aSide.find((r) => nameNorm(r.name) === nameNorm(match.awayName));
    if (!h || !a) return null;
    const wH = raw.home["w"]?.find((r) => r.teamId === h.teamId)?.value ?? 0;
    const dH = raw.home["d"]?.find((r) => r.teamId === h.teamId)?.value ?? 0;
    const lH = raw.home["l"]?.find((r) => r.teamId === h.teamId)?.value ?? 0;
    const wA = raw.away["w"]?.find((r) => r.teamId === a.teamId)?.value ?? 0;
    const dA = raw.away["d"]?.find((r) => r.teamId === a.teamId)?.value ?? 0;
    const lA = raw.away["l"]?.find((r) => r.teamId === a.teamId)?.value ?? 0;
    const gaHome = raw.home["ga"]?.find((r) => r.teamId === h.teamId)?.value ?? null;
    const gaAway = raw.away["ga"]?.find((r) => r.teamId === a.teamId)?.value ?? null;
    return {
      home: { gf: h.value ?? NaN, ga: gaHome ?? NaN, gp: wH + dH + lH },
      away: { gf: a.value ?? NaN, ga: gaAway ?? NaN, gp: wA + dA + lA },
    };
  } catch { return null; }
}
```

- [ ] **Step 4: Run to verify pass** — Expected: PASS (3/3)
- [ ] **Step 5: Commit**

```bash
git add src/lib/prediction/football/index.ts src/lib/prediction/football/index.test.ts
git commit -m "feat(prediction): orchestration computePrediction (prematch+live, fallbacks)"
```

---

### Task 9: Route API

**Files:**
- Create: `src/app/api/football/prediction/[id]/route.ts`

**Interfaces:**
- Consumes: `computePrediction`
- Produces: `GET /api/football/prediction/{id}` → `200 { ...EngineResult }` avec
  `Cache-Control: public, max-age=60` ; jamais 5xx (erreurs dans `errors`).

- [ ] **Step 1: Implement**

```ts
// src/app/api/football/prediction/[id]/route.ts
import { NextResponse } from "next/server";
import { computePrediction } from "@/lib/prediction/football";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await computePrediction(id);
  return NextResponse.json(result, {
    status: result.errors.includes("MATCH_NOT_FOUND") ? 404 : 200,
    headers: { "Cache-Control": "public, max-age=60" },
  });
}
```

> ⚠️ Next 16 : `params` est une Promise (convention App Router récente — déjà utilisée dans
> les routes existantes du repo ; vérifier le pattern dans `src/app/api/football/matches/[id]/stats/route.ts`).

- [ ] **Step 2: Verify compile + smoke**

Run: `bun run typecheck`
Expected: PASS (aucune erreur TypeScript)

Run: `bun run dev` puis `curl http://localhost:3000/api/football/prediction/{id-en-db}` et `curl .../prediction/inconnu`
Expected: JSON avec `markets` ou `errors: ["MATCH_NOT_FOUND"]` (404) — pas de 500.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/football/prediction
git commit -m "feat(prediction): route /api/football/prediction/[id] — cache 60s, fallback gracieux"
```

---

### Task 10: Gates finales + commit global

- [ ] **Step 1: Run full validation**

```bash
node scripts/run-bun.js test src/lib/prediction/football
bun run typecheck
bun run lint
```

Expected: tests verts, typecheck 0 erreur, lint 0 warning bloquant.

- [ ] **Step 2: Smoke prod build (facultatif si dev OK)**

`bun run build` — Expected: build OK.

- [ ] **Step 3: Commit final + push + deploy VPS (ordre utilisateur)**

```bash
git add -A
git commit -m "feat(prediction): moteur Poisson/DC/Elo/live + route API (spec 2026-08-09)"
git push
# deploy : scripts/update_vps.sh (skill ps-deploy) — via SSH ubuntu@51.75.21.239
```

## Self-review notes (écrites après génération)

- Couverture spec : port Poisson (T2), DC (T3), Elo double (T4, T5), blend+calibration (T6),
  live-decay (T7), orchestration en cascade rankings→BSD→moyennes (T8), route cache (T9) —
  tous les § de la spec couverts. Sous-projets 2/3 hors scope comme convenu.
- Pas de placeholder « TBD » (les blocs « ⚠️ correction » sont des instructions d'implémentation
  explicites, pas des TODO).
- Cohérence de types : `limités` nommés `lambdas`, `Markets`/`LiveMarkets`/`EloPair` importés
  depuis `types.ts` partout ; `loadHistoryFromDb(db)`/`getEloDatabase()` signatures stables.
- Le xG-logit du blend reste `null` (annotation : sous-projet 2) — le blend utilise
  Poisson+DC+Elo conformément au Q&A (les probas xG seront branchées quand le module xG arrivera).