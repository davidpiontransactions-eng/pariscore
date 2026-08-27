# Top5 « Gagnant » Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (inline). Steps en checkboxes.

**Goal:** Filtre « Gagnant » Top5 foot & tennis désignant le vainqueur prédit par le meilleur modèle de la littérature, classé par confiance du modèle.

**Architecture:** Foot = stratégie `"gagnant"` branchée sur Dixon-Coles existant (λ forme L5) ; Tennis = métrique `"gagnant"` lisant les probabilités du blend moteur serveur (`probA/probB`).

**Tech Stack:** TypeScript strict, bun:test, Next.js App Router, SWR.

## Global Constraints

- Aucune nouvelle dépendance ; pas de `any` ; commentaires FR.
- Conventional commits ≤72 chars, un feature par commit.
- Gates : `bun run lint` + `bun run typecheck` verts.
- Classement par confiance modèle (validé), zéro dépendance cotes.
- Exclusions : nul modal (foot) ; `synthetic`/`insufficientData` (tennis).

---

### Task 0: Branche + docs

- [ ] `git checkout -b feat/top5-gagnant`
- [ ] Commit spec/plan/journal → `docs(top5): spec et plan filtre gagnant`

### Task 1: Stratégie football `"gagnant"` (TDD)

**Files:** Create `tests/top5-gagnant.spec.ts` · Modify `src/lib/football-strategy-top5.ts`
**Interfaces:** Consomme `dixonColesMarkets(λH, λA): Markets{homeWin,draw,awayWin}` (`@/lib/prediction/football/dixon-coles`) · Produit clé `"gagnant"` dans `StrategyTop5Key`, entrées `{value:%, pick:"home"|"away"}`.

- [ ] **Step 1 test rouge** — créer le fichier avec la section foot :

```ts
import { describe, expect, it } from "bun:test";
import { dixonColesMarkets } from "../src/lib/prediction/football/dixon-coles";
import { computeStrategyTop5Matches } from "../src/lib/football-strategy-top5";
import type { BSDFootballMatch } from "../src/lib/bsd-football-fetcher";

let seq = 0;
function fixture(o?: Record<string, unknown>): BSDFootballMatch {
  const i = ++seq;
  return {
    id: i,
    status: "notstarted",
    league: { id: 999999, name: "Ligue Test" },
    event_date: "2026-09-01T18:00:00Z",
    home_team: "Alpha",
    away_team: "Beta",
    home_team_obj: { id: i * 10, short_name: "ALP" },
    away_team_obj: { id: i * 10 + 1, short_name: "BET" },
    home_score: null,
    away_score: null,
    ...o,
  } as unknown as BSDFootballMatch;
}
function fini(h: string, a: string, hs: number, as: number): BSDFootballMatch {
  return fixture({ status: "finished", home_team: h, away_team: a, home_score: hs, away_score: as });
}

describe("top5 gagnant — foot", () => {
  it("Dixon-Coles : Σ marchés 1X2 ≈ 1", () => {
    const mk = dixonColesMarkets(1.4, 1.1);
    expect(mk.homeWin + mk.draw + mk.awayWin).toBeCloseTo(1, 3);
  });

  it("gagnant : pick valide, proba 40-86%", () => {
    // Alpha fort domicile / Beta faible extérieur → λH≈1.33 λA≈0.67 → ~55% dom.
    const finished = [fini("Alpha", "Om", 2, 1), fini("Alpha", "Om", 2, 1), fini("Alpha", "Om", 1, 0),
      fini("Beta", "Om", 1, 2), fini("Beta", "Om", 1, 1)];
    const res = computeStrategyTop5Matches(finished, [fixture()]);
    const entries = res.strategies.gagnant;
    expect(entries.length).toBe(1);
    expect(["home", "away"]).toContain(entries[0].pick);
    expect(entries[0].value).toBeGreaterThan(40);
    expect(entries[0].value).toBeLessThan(86);
  });

  it("gagnant : nul modal → match écarté (λ=0)", () => {
    const finished = [fini("A1", "B1", 0, 0), fini("A1", "B2", 0, 0), fini("A1", "B3", 0, 0),
      fini("C1", "Zz", 0, 0), fini("C2", "Zz", 0, 0)];
    const res = computeStrategyTop5Matches(finished, [
      fixture({ home_team: "Zz", away_team: "Yy",
        home_team_obj: { id: 90, short_name: "ZZ" }, away_team_obj: { id: 91, short_name: "YY" } }),
    ]);
    expect(res.strategies.gagnant.length).toBe(0);
  });

  it("gagnant : sans forme L5 → aucun match listé", () => {
    const res = computeStrategyTop5Matches([], [fixture()]);
    expect(res.strategies.gagnant.length).toBe(0);
  });
});
```

- [ ] **Step 2:** `bun test tests/top5-gagnant.spec.ts` → FAIL attendu (`strategies.gagnant` undefined)
- [ ] **Step 3 implémentation minimale** :
  1. Import en tête : `import { dixonColesMarkets } from "@/lib/prediction/football/dixon-coles";`
  2. Union : `| "gagnant"` après `| "bestTeam1x2"`
  3. `HIGHER_BETTER` : `gagnant: true,` · Set `PROBABILISTIC_KEYS` : `"gagnant",`
  4. Cas exhaustif TS dans `scoreMatch` : voir journal code (repli `dixonColesMarkets`, nul modal → `{value:-Infinity,pick:null}`)
  5. Boucle principale, après le bloc `bestTeam1x2`, branche dédiée : garde `if (!form) continue;` → λH/λA depuis `form.home.gf/nH + form.away.ga/nA` (÷2 symétrique) → `dixonColesMarkets` → si `draw >= max(homeWin,awayWin)` skip sinon push `{value:max*100, pick:max côté}`.

- [ ] **Step 4:** `bun test tests/top5-gagnant.spec.ts` → PASS
- [ ] **Step 5:** Commit `feat(top5): filtre gagnant Dixon-Coles au top5 foot`

### Task 2: Métrique tennis `"gagnant"` (TDD)

**Files:** Modify `tests/top5-gagnant.spec.ts` (section tennis) · `src/lib/tennis-top5.ts`
**Interfaces:** Produit clé `"gagnant"` dans `TennisTop5Key`, def `{isProb:true, source:"match", format:pct1}`.

- [ ] **Step 1 tests rouges** (appender au spec, helpers tennis) :

```ts
import { buildTennisTop5, TENNIS_TOP5_METRICS } from "../src/lib/tennis-top5";
import type { TennisMatch } from "../src/lib/tennis-data";

let tseq = 0;
function joueur(n: string): TennisMatch["playerA"] {
  return { id: n.toLowerCase(), name: n, shortName: n.slice(0, 3), rank: 10,
    elo: 1900, surfaceElo: 1950, photoUrl: "", color: "#fff", form: ["W", "W"] };
}
function match(pA: number, pB: number, extra?: Partial<TennisMatch>): TennisMatch {
  tseq++;
  return {
    id: `m${tseq}`, tournament: "ATP Masters", round: "QF",
    scheduledAt: "2026-09-01T14:00:00Z",
    playerA: joueur("Anna"), playerB: joueur("Bea"),
    probA: pA, probB: pB,
    stats: { form: "3V-1D", eloGap: 140, surface: "Dur", h2h: "4-1",
      ic: [55, 88], confidence: 0.8 },
    model: "blend-v1", modelUpdatedAt: "2026-08-27T00:00:00Z",
    ...extra,
  } as TennisMatch;
}
const LB = new Map();

describe("top5 gagnant — tennis", () => {
  it("déf présente et probabiliste (auto-wire UI)", () => {
    const def = TENNIS_TOP5_METRICS.find((m) => m.key === "gagnant");
    expect(def?.isProb).toBe(true);
  });

  it("tri confiance desc + pick favori", () => {
    const entries = buildTennisTop5([match(72, 28), match(54, 46)], LB, "gagnant");
    expect(entries[0].playerA.value).toBeGreaterThan(entries[1].playerA.value);
    expect(entries[0].pick).toBe("A");
    expect(entries[0].probPick).toBe(72);
  });

  it("exclusions synthetic / insufficientData", () => {
    const entries = buildTennisTop5(
      [match(80, 20, { synthetic: true }), match(80, 20, { insufficientData: true }), match(66, 34)],
      LB, "gagnant",
    );
    expect(entries.length).toBe(1);
    expect(entries[0].probPick).toBe(66);
  });

  it("régression : surfaceElo intact", () => {
    expect(buildTennisTop5([match(70, 30)], LB, "surfaceElo").length).toBe(1);
  });
});
```

- [ ] **Step 2:** FAIL attendu (def absente → premier test KO)
- [ ] **Step 3 implémentation** :
  1. Union `| "gagnant"` en fin de `TennisTop5Key`
  2. Def appender à `TENNIS_TOP5_METRICS` : key/label « Gagnant prédit par le modèle (confiance) » / emoji 🏆 / isProb true / format pct1 / source "match"
  3. Dans `buildTennisTop5`, brancher avant le test leaderboard :

```ts
    let va: number | null;
    let vb: number | null;
    if (metric === "gagnant") {
      // Confiance du modèle serveur (blend Élo-surface/forme/H2H — Kovalchik
      // 2016 & Dryja 2025). playerA = favori par construction du type.
      // Synthétiques/données insuffisantes : aucune prédiction fiable.
      va = !m.synthetic && !m.insufficientData && Number.isFinite(m.probA) ? m.probA : null;
      vb = !m.synthetic && !m.insufficientData && Number.isFinite(m.probB) ? m.probB : null;
    } else if (TENNIS_TOP5_METRICS.find((d) => d.key === metric)?.source === "leaderboard") {
```

- [ ] **Step 4:** PASS · **Commit** `feat(top5): métrique gagnant confiance modèle tennis`

### Task 3: Widgets UI

- [ ] Append à `STRATEGIES` (`football-strategy-top5-widget.tsx`, après over65Corners) :
```tsx
  { key: "gagnant", label: "Gagnant prédit (Dixon-Coles)", emoji: "🏆", isProb: true, format: (v) => `${v.toFixed(0)}%` },
```
Tennis : auto-wire via `TENNIS_TOP5_METRICS` — zéro modification widget.
- [ ] Gates lint+typecheck verts
- [ ] Commit `feat(ui): option gagnant dans les dropdowns top5`

### Task 4: Gates finaux + traçabilité

- [ ] Re-run tests + gates
- [ ] Sous-agent code-review du diff cumulé
- [ ] `graphify update .`
- [ ] Journal `.context/session-top5-gagnant.md` Iter-1..N + preuves
- [ ] Commit final `docs(context): boucle gagnant terminee`

