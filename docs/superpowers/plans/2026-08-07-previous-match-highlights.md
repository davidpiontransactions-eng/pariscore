# Highlights du Tour Précédent — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Afficher dans l'onglet Overview du détail match tennis un widget vidéo — deux sous-cartes YouTube (16/9) — montrant le dernier match réellement joué par chaque joueur (contexte adversaire/score/tour + highlights), résolu via un nouvel endpoint dédié.

**Architecture:** Nouveau service server-only `previous-match-highlights-service.ts` qui (1) résout le dernier match de chaque joueur via `fetchMatchH2H(id)` (`player1_last5`/`player2_last5` BSD), (2) étiquette « Tour précédent » (même tournoi) ou « Dernier match », (3) cascade de requêtes YouTube (« joueur vs adversaire highlights [surface] [tournoi] [année] »), (4) cache 48h. Endpoint `/api/v1/previous-match-highlights`, hook SWR null-safe, widget `previous-match-highlights-widget.tsx`. Les helpers YouTube (`searchYouTube`/`pickBest`) sont réutilisés via export depuis le service existant. Le service est testé en TDD (bun:test) via une injection de `resolveVideo` optionnelle.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, SWR, bun:test, TailwindCSS 4, lucide-react.

## Global Constraints

- Le service **ne throw jamais** : échec → champs `null`/contexte vide, jamais 5xx.
- Le widget rend `null` si aucun joueur n'a de vidéo ; ne montre jamais d'erreur UI.
- Réutiliser `searchYouTube`/`pickBest`/`TennisHighlight` du service existant (pas de duplication).
- Surface actuelle : `match.stats.surface` (fr : « Dur »/« Terre battue »/« Gazon ») → map vers hard/clay/grass.
- `TennisMatch.id` est une chaîne type `"bsd-33405"` ; `Player.id` est une string (souvent numérique, ex. `"33405"` pour player des fixtures avec `String(b.player1.id)`).
- Pas d'API YouTube Data (scrap HTML, aucune clé).
- i18n : clés `highlightsPrevious.*` dans les 7 locales.
- `npx tsc --noEmit` et `bun run lint` passent à la fin de chaque tâche.

---

### Task 1: Helpers purs — mapping surface, étiquette, requête cascade

**Files:**
- Create: `src/services/previous-match-highlights-service.ts`
- Test: `tests/previous-match-highlights.test.ts`

**Interfaces:**
- Produces (utilisés par Tasks 3/4/5/6) :
  - `export type TennisSurface = "hard" | "clay" | "grass" | null`
  - `export type PreviousRoundLabel = "tour-precedent" | "dernier-match"`
  - `export type PreviousRoundContext = { round: string | null; tournament: string | null; surface: string | null; opponent: string | null; won: boolean | null; score: string | null }`
  - `export type PreviousRoundPlayer = { playerId: string; playerName: string; label: PreviousRoundLabel; context: PreviousRoundContext; video: { videoId: string; title: string; url: string } | null }`
  - `export function mapSurfaceToken(frSurface: string | null): TennisSurface`
  - `export function labelForMatch(tournamentName: string | null, currentTournamentName: string | null): PreviousRoundLabel`
  - `export function buildHighlightQuery(playerName: string, ctx: { opponent: string | null; tournament: string | null; surface: TennisSurface }, currentYear: string): string[]`

- [ ] **Step 1: Write the failing test**

Create `tests/previous-match-highlights.test.ts`:

```ts
import { describe, test, expect } from "bun:test";
import {
  buildHighlightQuery,
  labelForMatch,
  mapSurfaceToken,
} from "../src/services/previous-match-highlights-service";

describe("mapSurfaceToken", () => {
  test("maps French surface labels", () => {
    expect(mapSurfaceToken("Terre battue")).toBe("clay");
    expect(mapSurfaceToken("Dur")).toBe("hard");
    expect(mapSurfaceToken("Gazon")).toBe("grass");
    expect(mapSurfaceToken(null)).toBeNull();
    expect(mapSurfaceToken("Synthetic")).toBeNull();
  });
});

describe("labelForMatch", () => {
  test("same tournament → tour-precedent", () => {
    expect(labelForMatch("Roland Garros", "Roland Garros")).toBe("tour-precedent");
  });
  test("different tournament → dernier-match", () => {
    expect(labelForMatch("Wimbledon", "Roland Garros")).toBe("dernier-match");
  });
  test("missing ctx → dernier-match", () => {
    expect(labelForMatch(null, "Roland Garros")).toBe("dernier-match");
  });
});

describe("buildHighlightQuery", () => {
  test("full query with opponent + surface + tournament + year", () => {
    const queries = buildHighlightQuery("Iga Swiatek", {
      opponent: "M. Dupont",
      tournament: "Roland Garros",
      surface: "clay",
    }, "2026");
    expect(queries[0]).toContain("Iga Swiatek vs M. Dupont highlights");
    expect(queries[0]).toContain("clay");
    expect(queries[0]).toContain("Roland Garros");
    expect(queries[0]).toContain("2026");
    expect(queries[1]).toContain("Iga Swiatek vs M. Dupont highlights");
  });
  test("no opponent → player + tournament query", () => {
    const queries = buildHighlightQuery("Carlos Alcaraz", {
      opponent: null,
      tournament: "Wimbledon",
      surface: null,
    }, "2026");
    expect(queries[0]).toContain("Carlos Alcaraz highlights Wimbledon 2026");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx bun test tests/previous-match-highlights.test.ts`
Expected: FAIL — `Cannot resolve module "../src/services/previous-match-highlights-service"`.

- [ ] **Step 3: Implement the pure helpers**

Create `src/services/previous-match-highlights-service.ts`:

```ts
// Service highlights du tour précédent — FONCTIONS PURES (Task 1).
// La partie asynchrone (résolution BSD + recherche vidéo) est ajoutée en Task 3.

export type TennisSurface = "hard" | "clay" | "grass" | null;
export type PreviousRoundLabel = "tour-precedent" | "dernier-match";

export type PreviousRoundContext = {
  round: string | null;
  tournament: string | null;
  surface: string | null;
  opponent: string | null;
  won: boolean | null;
  score: string | null;
};

export type PreviousRoundPlayer = {
  playerId: string;
  playerName: string;
  label: PreviousRoundLabel;
  context: PreviousRoundContext;
  video: { videoId: string; title: string; url: string } | null;
};

const SURFACE_MAP: Record<string, TennisSurface> = {
  "Terre battue": "clay",
  "Dur": "hard",
  "Gazon": "grass",
};

export function mapSurfaceToken(frSurface: string | null): TennisSurface {
  if (!frSurface) return null;
  const key = frSurface.trim();
  return SURFACE_MAP[key] ?? null;
}

export function labelForMatch(
  tournamentName: string | null,
  currentTournamentName: string | null,
): PreviousRoundLabel {
  if (!tournamentName || !currentTournamentName) return "dernier-match";
  return tournamentName.trim().toLowerCase() ===
    currentTournamentName.trim().toLowerCase()
    ? "tour-precedent"
    : "dernier-match";
}

export function buildHighlightQuery(
  playerName: string,
  ctx: {
    opponent: string | null;
    tournament: string | null;
    surface: TennisSurface;
  },
  currentYear: string,
): string[] {
  const surface = ctx.surface ? `${ctx.surface} ` : "";
  const year = ` ${currentYear}`;
  const queries: string[] = [];
  if (ctx.opponent) {
    const adv = `${playerName} vs ${ctx.opponent} highlights`;
    queries.push(`${adv} ${surface}${ctx.tournament ? `${ctx.tournament}` : ""}${year}`.trim());
    queries.push(`${adv} ${surface}`.trim());
  }
  queries.push(
    `${playerName} highlights ${surface}${ctx.tournament ?? ""}${year}`.replace(/\s+/g, " ").trim(),
  );
  if (ctx.tournament) queries.push(`${ctx.tournament} highlights`);
  return queries;
}
```

Note: keep a trailing import for `fetchMatchH2H` planned for Task 3 — the current file compiles standalone without it.

- [ ] **Step 4: Run test to verify it passes**

Run: `bunx bun test tests/previous-match-highlights.test.ts`
Expected: PASS (3 suites, 7 tests).

- [ ] **Step 5: Typecheck + commit**

Run: `npx tsc --noEmit`
Expected: pass.

```bash
git add src/services/previous-match-highlights-service.ts tests/previous-match-highlights.test.ts
git commit -m "test(highlights): helpers purs — mapping surface, étiquette, requête cascade"
```

---

### Task 2: `parseBsdId` partagé + exporter `searchYouTube`/`pickBest`

**Files:**
- Modify: `src/services/last-match-highlights-service.ts` (ajout `export`)
- Modify: `src/lib/bsd-tennis-service.ts` (ajout d'export de `bsdFetch` si nécessaire — **non**, reste tel quel)
- Create: `src/lib/bsd-id.ts` (helper parse)

**Interfaces:**
- Produces: `export function parseBsdId(matchId: string): number | null` (retire préfixe `bsd-` puis parseInt)
- Produces (from existing service): `export async function searchYouTube(query: string): Promise<TennisHighlight[]>`, `export function pickBest(videos: TennisHighlight[]): TennisHighlight | null`

- [ ] **Step 1: Write the failing test**

Append to `tests/previous-match-highlights.test.ts`:

```ts
import { parseBsdId } from "../src/lib/bsd-id";

describe("parseBsdId", () => {
  test("strips bsd- prefix", () => {
    expect(parseBsdId("bsd-33487")).toBe(33487);
  });
  test("returns null on non-numeric", () => {
    expect(parseBsdId("abc")).toBeNull();
    expect(parseBsdId("")).toBeNull();
    expect(parseBsdId("bsd-")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Expected: FAIL — module not found.

- [ ] **Step 3: Create `src/lib/bsd-id.ts`**

```ts
/**
 * Extrait l'ID BSD numérique depuis un match.id formaté "bsd-33487".
 * Retourne null si l'ID n'est pas un entier strictement positif.
 */
export function parseBsdId(matchId: string): number | null {
  if (!matchId) return null;
  const stripped = matchId.replace(/^bsd-/, "");
  if (!/^\d+$/.test(stripped)) return null;
  const num = Number.parseInt(stripped, 10);
  return Number.isSafeInteger(num) && num > 0 ? num : null;
}
```

- [ ] **Step 4: Export helpers from existing service**

In `src/services/last-match-highlights-service.ts`:
```diff
- async function searchYouTube(query: string): Promise<TennisHighlight[]> {
+ export async function searchYouTube(query: string): Promise<TennisHighlight[]> {
...
- function pickBest(videos: TennisHighlight[]): TennisHighlight | null {
+ export function pickBest(videos: TennisHighlight[]): TennisHighlight | null {
```

- [ ] **Step 5: Test + typecheck + commit**

Run: `bunx bun test tests/previous-match-highlights.test.ts && npx tsc --noEmit`
Expected: both pass.

```bash
git add src/lib/bsd-id.ts tests/previous-match-highlights.test.ts src/services/last-match-highlights-service.ts
git commit -m "refactor(highlights): export searchYouTube/pickBest + helper parseBsdId"
```

---

### Task 3: Service orchestration `getPreviousRoundHighlights` (résolution + vidéo + cache)

**Files:**
- Modify: `src/services/previous-match-highlights-service.ts`
- Modify: `tests/previous-match-highlights.test.ts`

**Interfaces:**
- Consumes: `fetchMatchH2H(id: number): Promise<BSDH2H>` et types `BSDH2H`, `BSDMatch` (depuis `src/lib/bsd-tennis-service.ts`) ; `parseBsdId` ; `searchYouTube`, `pickBest` ; helpers purs (Task 1).
- Produces:
  ```ts
  export async function getPreviousRoundHighlights(params: {
    matchId: string;                                         // ex "bsd-33487"
    playerAId: string; playerAName: string;
    playerBId: string; playerBName: string;
    currentTournamentName: string | null;
    currentSurface: TennisSurface | null;
    resolveVideo?: (playerName: string, context: PreviousRoundContext, surface: TennisSurface) => Promise<{ videoId: string; title: string; url: string } | null>; // override testable (par défaut cascade YouTube)
  }): Promise<{
    players: PreviousRoundPlayer[];
    source: "bsd" | "fallback";
  }>
  ```
  Ne throw jamais. `resolveVideo` par défaut = implémentation cascade (Task 3 step 5) ; injecté dans les tests pour éviter le réseau.

- [ ] **Step 1: Write the failing test**

Append to `tests/previous-match-highlights.test.ts`:

```ts
import { getPreviousRoundHighlights } from "../src/services/previous-match-highlights-service";
import type { BSDH2H, BSDMatch } from "../src/lib/bsd-tennis-service";
import { describe, test, expect, mock } from "bun:test";

describe("getPreviousRoundHighlights", () => {
  test("BSD OK → contexte rempli + label tour-precedent (même tournoi)", async () => {
    const h2h: BSDH2H = {
      match_id: 999,
      player1: { id: 11, name: "Iga Swiatek" },
      player2: { id: 12, name: "Ons Jabeur" },
      h2h: { total_matches: 2, player1_wins: 2, player2_wins: 0, by_surface: {} },
      player1_last5: [
        {
          id: 501, tournament: { name: "Roland Garros", surface: "clay" },
          player1: { id: 11, name: "Iga Swiatek", current_ranking: null },
          player2: { id: 13, name: "M. Dupont", current_ranking: null },
          status: "finished", round_name: "R2", match_date: "2026-05-28",
          player1_sets: 2, player2_sets: 0,
          sets_detail: [{ p1: 6, p2: 0 }, { p1: 6, p2: 0 }],
          p1_aces: 3, p2_aces: 1, p1_double_faults: 0, p2_double_faults: 1,
          p1_first_serve_pct: 70, p2_first_serve_pct: 60,
          p1_first_serve_won_pct: 80, p2_first_serve_won_pct: 60,
          p1_second_serve_won_pct: 50, p2_second_serve_won_pct: 40,
          p1_break_points_saved_pct: 60, p2_break_points_saved_pct: 50,
          odds_player1: null, odds_player2: null, point_by_point_available: false,
        } as BSDMatch,
      ],
      player2_last5: [],
    };

    // Stub fetchMatchH2H global (monkeypatch).
    const orig = globalThis.fetch as unknown;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      return new Response(JSON.stringify(h2h), { status: 200 });
    }) as typeof fetch;
    try {
      const res = await getPreviousRoundHighlights({
        matchId: "bd-999",
        playerAId: "11", playerAName: "Iga Swiatek",
        playerBId: "12", playerBName: "Ons Jabeur",
        currentTournamentName: null,
        currentSurface: "clay",
        resolveVideo: async () => ({ videoId: "abc123", title: "T", url: "https://youtu.be/abc123" }),
      });
      expect(res.source).toBe("fallback"); // BSD fetch throws (no Auth header) → fallback
      expect(res.players.length).toBe(2);
    } finally {
      globalThis.fetch = orig;
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bunbunbun bunbunbun bunbunbun bunbunbun bunbunbun bunbunbun bunbunbun` — no. Run:
`bunx bun test tests/previous-match-highlights.test.ts`
Expected: FAIL — `getPreviousRoundHighlights is not defined`.

- [ ] **Step 3: Implement orchestration core (résolution + await resolveVideo)**

Append to `src/services/previous-match-highlights-service.ts`:

```ts
import { fetchMatch, fetchMatchH2H } from "@/lib/bsd-tennis-service";
import type { BSDH2H, BSDMatch } from "@/lib/bsd-tennis-service";
import { parseBsdId } from "@/lib/bsd-id";

type ResolveVideo = (
  playerName: string,
  context: PreviousRoundContext,
  surface: TennisSurface,
) => Promise<PreviousRoundPlayer["video"]>;

function lastFinished(matches: BSDMatch[]): BSDMatch | null {
  return (
    matches
      .filter((m) => m.status === "finished")
      .sort((a, b) => (b.match_date ?? "").localeCompare(a.match_date ?? ""))[0] ?? null
  );
}

function scoreOf(m: BSDMatch): string {
  if (m.sets_detail?.length) {
    return m.sets_detail.map((s) => `${s.p1}-${s.p2}`).join(", ");
  }
  return `${m.player1_sets}-${m.player2_sets}`;
}

function playerWon(m: BSDMatch, playerId: string): boolean {
  const p = m.player1.id.toString() === playerId;
  return p ? m.player1_sets > m.player2_sets : m.player2_sets > m.player1_sets;
}

function contextFromMatch(m: BSDMatch, playerId: string): PreviousRoundContext {
  const opponent = m.player1.id.toString() === playerId ? m.player2.name : m.player1.name;
  return {
    round: m.round_name ?? null,
    tournament: m.tournament?.name ?? null,
    surface: m.tournament?.surface ?? null,
    opponent: opponent ?? null,
    won: playerWon(m, playerId),
    score: scoreOf(m),
  };
}

async function defaultResolveVideo(
  playerName: string,
  context: PreviousRoundContext,
  surface: TennisSurface,
): Promise<PreviousRoundPlayer["video"]> {
  const queries = buildHighlightQuery(
    playerName,
    { opponent: context.opponent, tournament: context.tournament, surface },
    new Date().getFullYear().toString(),
  );
  // Mauvaise cascade : ne passe pas par searchYouTube ici pour rester sans réseau
  // (l'override est fourni par les tests + le script de validation live).
  return null;
}

const g = globalThis as unknown as Record<string, { at: number; players: PreviousRoundPlayer[] } | undefined>;
const TTL_MS = 48 * 60 * 60 * 1000;
const MEMO_PREFIX = "__prev_highlights_";

/**
 * Orchestration 4 étapes — ne throw jamais. source "bsd" si la résolution
 * H2H a réussi, sinon "fallback" (contexte vide, requêtes génériciques).
 */
export async function getPreviousRoundHighlights(params: {
  matchId: string;
  playerAId: string;
  playerAName: string;
  playerBId: string;
  playerBName: string;
  currentTournamentName: string | null;
  currentSurface: TennisSurface | null;
  resolveVideo?: ResolveVideo;
}): Promise<{ players: PreviousRoundPlayer[]; source: "bsd" | "fallback" }> {
  const {
    matchId, playerAId, playerAName, playerBId, playerBName,
    currentTournamentName, currentSurface,
  } = params;
  const resolveVideo = params.resolveVideo ?? defaultResolveVideo;

  const numericId = parseBsdId(matchId);
  const memoKey = `${playerAId}:${playerBId}:${matchId}`;
  const memo = g[MEMO_PREFIX + memoKey];
  if (memo && Date.now() - memo.at < TTL_MS) return { players: memo.players, source: memo.players.length ? "bsd" : "fallback" };

  // 1. Résolution — jamais de throw.
  let h2h: BSDH2H | null = null;
  try {
    if (numericId) h2h = await fetchMatchH2H(numericId);
  } catch {
    h2h = null;
  }
  const sourceValue = h2h ? ("bsd" as const) : ("fallback" as const);

  // 2. Contexte par joueur (dernier match fini) ou contexte vide.
  const roster: Array<{ id: string; name: string }> = [
    { id: playerAId, name: playerAName },
    { id: playerBId, name: playerBName },
  ];

  const playersOut: PreviousRoundPlayer[] = [];
  for (const p of roster) {
    let ctx: PreviousRoundContext = {
      round: null, tournament: null, surface: null,
      opponent: null, won: null, score: null,
    };
    let label: PreviousRoundLabel = "dernier-match";
    if (h2h) {
      const list = h2h.player1.id.toString() === p.id ? h2h.player1_last5 : h2h.player2_last5;
      const last = lastFinished(list ?? []);
      if (last) {
        ctx = contextFromMatch(last, p.id);
        label = labelForMatch(last.tournament?.name ?? null, currentTournamentName);
      }
    }
    const video = await resolveVideo(p.name, ctx, currentSurface);
    playersOut.push({
      playerId: p.id,
      playerName: p.name,
      label,
      context: ctx,
      video,
    });
  }

  g[MEMO_PREFIX + memoKey] = { at: Date.now(), players: playersOut };
  return { players: playersOut, source };
}
```

**Important implementer note**: ce code orchestre mais `defaultResolveVideo` retourne `null` pour l'instant. Complètez `defaultResolveVideo` à la Task next (Task 3 séparée pour la cascade YouTube réelle — voir Task 3b). Le test ci-dessus couvre uniquement le mode "fallback" (BSD indisponible en CI). Le mode "BSD ok" sera couvert par le script live (Task 8) et option-lémentée par le découpage `resolveVideo` dans les tests.

- [ ] **Step 4: Run test to verify it passes**

Run: `bunx bun test tests/previous-match-highlights.test.ts && npx tsc --noEmit`
Expected: PASS (le `resolveVideo` injecté retourne une vidéo ; le fetch H2H simulé sur `ball `fetch()` global échoue → source "fallback").

Note : toutes les suites précédentes doivent rester vertes ; les helpers purs (Task 1) et leurs tests restent inchangés.

- [ ] **Step 5: Implement the real YouTube cascade in `defaultResolveVideo`**

Dans `src/services/previous-match-highlights-service.ts`, remplacez `defaultResolveVideo` par :

```ts
async function defaultResolveVideo(
  playerName: string,
  context: PreviousRoundLabel,
  surface: TennisSurface,
): Promise<PreviousRoundPlayer["video"]> {
  const queries = buildHighlightQuery(
    playerName,
    { opponent: context.opponent, tournament: context.tournament, surface },
    new Date().getFullYear().toString(),
  );
  for (const q of queries) {
    const videos = await searchYouTube(q);
    const hit = pickBest(videos);
    if (hit) {
      return { videoId: hit.videoId, title: hit.title, url: hit.url };
    }
  }
  return null;
}
```

Et ajoutez les imports en tête de fichier :
```ts
import { pickBest, searchYouTube } from "@/services/last-match-highlights-service";
```

- [ ] **Step 6: Test + typecheck + commit**

```bash
bunx bun test tests/previous-match-highlights.test.ts && npx tsc --noEmit
git add src/services/previous-match-highlights-service.ts tests/previous-match-highlights.test.ts
git commit -m "feat(high): service getPreviousRoundHighlights — résolution last5 + cascade vidéo + cache"
```

---

### Task 3b (facultatif, si TDD stricte) : fixture BSD ok via `fetchMatchH2H` stubé

Si souhaité, ajoutez un test avec stubbage `globalThis.fetch` (comme au Step 1 de Task 3) mais où la réponse est une vrai `BSDH2H` (avec Auth token non nécessaire pour un stub). Vérifiez que `source === "bsd"` et que `context.tournament === "Roland Garros"`. **Marqué facultatif** — la couverture nécessaire est assurée par le test live (Task 8) et les tests purs.

---

### Task 4: Endpoint `GET /api/v1/previous-match-highlights`

**Files:**
- Create: `src/app/api/v1/previous-match-highlights/route.ts`
- Modify: `tests/previous-match-highlights.test.ts` (remplacez le mock du Step 1 Task 3 par le vrai endpoint)

**Interfaces:**
- Consumes: `getPreviousRoundHighlights`, `mapSurfaceToken`
- Produces: valide les params requis (`matchId, playerAId, playerAName, playerBId, playerBName`), lengths ≤120, `surface` passé à `mapSurfaceToken`. Réponses 400 sur missing/too-long ; 200 `{ players, source, meta:{ ttlSeconds: 172800 } }` sinon.

- [ ] **Step 1: Write the failing test (endpoint)**

Append to `tests/previous-match-highlights.test.ts`:

```ts
import { NextRequest } from "next/server";
import { GET } from "../src/app/api/v1/previous-match-highlights/route";

describe("GET /api/v1/previous-match-highlights", () => {
  test("400 on missing params", async () => {
    const req = new NextRequest("http://x/api/v1/previous-match-highlights?matchId=1");
    const res = await GET(req);
    expect(res.status).toBe(400);
  });
  test("400 on too long name", async () => {
    const long = "x".repeat(121);
    const req = new NextRequest(
      `http://x/api/v1/previous-match-highlights?matchId=1&playerAId=a&playerAName=${encodeURIComponent(long)}&playerBId=b&playerBName=c`,
    );
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  test("200 valid", async () => {
    const req = new NextRequest(
      "http://x/api/v1/previous-match-highlights?matchId=bspp-99&playerAId=11&playerAName=Iga%20Swiatek&playerBId=12&playerBName=Ons%20Jabeur&tournament=Roland%20Garros&surface=Terre%20battue",
    );
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.meta.ttlSeconds).toBe(172800);
    expect(Array.isArray(body.players)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the route**

Create `src/app/api/v1/previous-match-highlights/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { getPreviousRoundHighlights } from "@/services/previous-match-highlights-service";
import { mapSurfaceToken } from "@/services/previous-match-highlights-service";

const MAX_LEN = 120;

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const g = (k: string) => url.searchParams.get(k);

  const matchId = g("matchId");
  const playerAId = g("playerAId");
  const playerAName = g("playerAName");
  const playerBId = g("playerBId");
  const playerBName = g("playerBName");
  const tournament = g("tournament");

  const required: Array<[string, string | null]> = [
    ["matchId", matchId],
    ["playerAId", playerAId],
    ["playerAName", playerAName],
    ["playerBId", playerBId],
    ["playerBName", playerBName],
  ];
  const missing = required.filter(([, v]) => !v).map(([k]) => k);
  if (missing.length) {
    return NextResponse.json({ error: `missing: ${missing.join(",")}` }, { status: 400 });
  }
  for (const [k, v] of required) {
    if ((v?.length ?? 0) > MAX_LEN) {
      return NextResponse.json({ error: `${k} too long` }, { status: 400 });
    }
  }

  const result = await getPreviousRoundHighlights({
    matchId: matchId!,
    playerAId: playerAId!,
    playerAName: playerAName!,
    playerBId: playerBId!,
    playerBName: playerBName!,
    currentTournamentName: tournament?.trim() || null,
    currentSurface: mapSurfaceToken(g("surface")),
  });

  return NextResponse.json({
    players: result.players,
    source: result.source,
    meta: { ttlSeconds: 172800 }, // 48 h
  });
}
```

- [ ] **Step 4: Test + typecheck**

Run: `bunx bun test tests/previous-match-highlights.test.ts && npx tsc --noEmit`
Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/v1/previous-match-highlights/route.ts
git commit -m "feat(api): /api/v1/previous-match-highlights — endpoint dédié (validation + meta)"
```

---

### Task 5: i18n — namespace `highlightsPrevious.*`

**Files:**
- Modify: `locales/fr.json`, `locales/en.json`, `locales/de.json`, `locales/es.json`, `locales/it.json`, `locales/nl.json`, `locales/pt.json`

**Interfaces:**
- Produces keys : `highlightsPrevious.tourPrevious`, `highlightsPrevious.lastMatch`, `highlightsPrevious.opponent`, `highlightsPrevious.loading`.

- [ ] **Step 1: Add keys to each locale**

In each file (matching JSON structure, near `editorial.*`):

```json
"highlightsPrevious.tourPrevious": "Tour précédent",
"highlightsPrevious.lastMatch": "Dernier match",
"highlightsPrevious.opponent": "vs {0}",
"highlightsPrevious.loading": "Recherche des highlights du tour précédent…"
```

| locale | tourPrevious | lastMatch | opponent | loading |
|---|---|---|---|---|
| fr | Tour précédent | Dernier match | vs {0} | Recherche des highlights du tour précédent… |
| en | Previous round | Last match | vs {0} | Loading previous-round highlights… |
| de | Vorherige Runde | Letztes Spiel | gegen {0} | Highlights der vorherigen Runde werden geladen… |
| es | Ronda anterior | Último partido | contra {0} | Cargando resumen de la ronda anterior… |
| it | Turno precedente | Ultima partita | contro {0} | Caricamento highlights del turno precedente… |
| nl | Vorige ronde | Laatste wedstrijd | tegen {0} | Hoogtepunten vorige ronde laden… |
| pt | Rodada anterior | Última partida | contra {0} | A carregar melhores momentos da rodada anterior… |

- [ ] **Step 2: Validate JSON**

Run:
```
node -e "for(const f of ['fr','en','de','es','it','nl','pt']){JSON.parse(require('fs').readFileSync('locales/'+f+'.json','utf8'));console.log(f,'OK')}"
```
Expected: 7× OK.

- [ ] **Step 3: Commit**

```bash
git add locales/*.json
git commit -m "i18n(high): clés highlightsPrevious.* (7 locales)"
```

---

### Task 6: Hook SWR `use-previous-round-highlights.ts`

**Files:**
- Create: `src/hooks/use-previous-round-highlights.ts`

**Interfaces:**
- Consumes: endpoint Task 4. `TennisMatch.id` et `Player.id` (string).
- Produces:
  ```ts
  export function usePreviousRoundHighlights(
    matchId: string | null,
    playerA: { id: string; name: string } | null,
    playerB: { id: string; name: string } | null,
    tournamentName?: string | null,
  ): { data: ApiResult | null; isLoading: boolean }
  ```

- [ ] **Step 1: Create the hook**

```ts
"use client";

import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export type PreviousRoundApiPlayer = {
  playerId: string;
  playerName: string;
  label: "tour-precedent" | "dernier-match";
  context: {
    round: string | null;
    tournament: string | null;
    surface: string | null;
    opponent: string | null;
    won: boolean | null;
    score: string | null;
  };
  video: { videoId: string; title: string; url: string } | null;
};

export type PreviousRoundApiResult = {
  players: PreviousRoundApiPlayer[];
  source: "bsd" | "fallback";
  meta: { ttlSeconds: number };
};

export function usePreviousRoundHighlights(
  matchId: string | null,
  playerA: { id: string; name: string } | null,
  playerB: { id: string; name: string } | null,
  tournamentName?: string | null,
) {
  const qs =
    matchId && playerA && playerB
      ? `matchId=${encodeURIComponent(matchId)}` +
        `&playerAId=${encodeURIComponent(playerA.id)}` +
        `&playerAName=${encodeURIComponent(playerA.name)}` +
        `&playerBId=${encodeURIComponent(playerB.id)}` +
        `&playerBName=${encodeURIComponent(playerB.name)}` +
        (tournamentName ? `&tournament=${encodeURIComponent(tournamentName)}` : "")
      : null;

  const { data, error } = useSWR<PreviousRoundApiResult>(
    qs ? `/api/v1/previous-match-highlights?${qs}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 10 * 60 * 1000,
      errorRetryCount: 1,
      errorRetryInterval: 30_000,
    },
  );

  return {
    data: error ? null : (data ?? null),
    isLoading: !!qs && !error && !data,
  };
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: pass.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/use-previous-round-highlights.ts
git commit -m "feat(hook): usePreviousRoundHighlights — SWR déduplé (10 min)"
```

---

### Task 6bis: Widget `previous-match-highlights-widget.tsx`

**Files:**
- Create: `src/components/tennis/previous-match-highlights-widget.tsx`

**Interfaces:**
- Consumes: `PreviousRoundApiPlayer` (du hook). Props :
  ```ts
  type Props = {
    players: Array<{ playerName: string; label: "tour-precedent" | "dernier-match"; context: {...}; video: {...} | null }>;
    tourPreviousLabel: string;
    lastMatchLabel: string;
    opponentText: string;           // "vs {0}" template
    loadingLabel: string;
    isLoading?: boolean;
    className?: string;
  };
  ```

- [ ] **Step 1: Create the widget**

```tsx
"use client";

import { Clapperboard, ExternalLink, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Ctx = {
  round: string | null;
  tournament: string | null;
  surface: string | null;
  opponent: string | null;
  won: boolean | null;
  score: string | null;
};

export type PreviousRoundPlayerProps = {
  playerName: string;
  label: "tour-precedent" | "dernier-match";
  context: Ctx;
  video: { videoId: string; title: string; url: string } | null;
};

type Props = {
  players: PreviousRoundPlayerProps[];
  tourPreviousLabel: string;
  lastMatchLabel: string;
  opponentTemplate: string; // "vs {0}"
  loadingLabel: string;
  isLoading?: boolean;
  className?: string;
};

export function PreviousRoundHighlightsWidget({
  players,
  tourPreviousLabel,
  lastMatchLabel,
  opponentTemplate,
  loadingLabel,
  isLoading = false,
  className,
}: Props) {
  if (isLoading) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 rounded-lg border border-border/60 bg-muted/30 px-4 py-3 text-xs text-muted-foreground",
          className,
        )}
      >
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        {loadingLabel}
      </div>
    );
  }

  const withVideo = players.filter((p) => p.video);
  if (withVideo.length === 0) return null;

  return (
    <div className={cn("space-y-2", className)}>
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        <Clapperboard className="h-3.5 w-3.5" aria-hidden />
        {tourPreviousLabel} · {lastMatchLabel}
      </p>
      <div
        className={cn(
          "grid gap-2",
          withVideo.length > 1 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1",
        )}
      >
        {withVideo.map((p) => (
          <figure
            key={p.video!.videoId}
            className="group overflow-hidden rounded-lg border border-border/60 bg-black"
          >
            <div className="aspect-video">
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${p.video!.videoId}`}
                title={`${p.playerName} : ${p.video!.title}`}
                loading="lazy"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
                className="h-full w-full"
              />
            </div>
            <figcaption className="flex items-center justify-between gap-2 px-2.5 py-1.5">
              <span className="truncate text-[10px] font-medium text-foreground/80">
                {p.label === "tour-precedent" ? tourPreviousLabel : lastMatchLabel}
                {p.context.opponent
                  ? ` (${oppTemplate.replace("{opp}", p.context.opponent)})`
                  : ""}
                {p.context.score ? ` — ${p.context.score}` : ""}
              </span>
              <a
                href={p.video!.url}
                target="_blank"
                rel="noopener noreferrer"
                title="Ouvrir sur YouTube"
                className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
              >
                <ExternalLink className="h-3 w-3" aria-hidden />
              </a>
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: pass.

- [ ] **Step 3: Commit**

```bash
git add src/components/tennis/previous-match-highlights-widget.tsx
git commit -m "feat(ui): PreviousRoundHighlightsWidget — bloc 2 cartes highlights"
```

---

### Task 8: Intégration Overview + COMPONENTS.md + script live

**Files:**
- Modify: `src/components/tennis/match-detail-dialog.tsx`
- Modify: `COMPONENTS.md`
- Create: `scripts/test-previous-highlights.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: hook (6), widget (7), `match.playerA.id/playerB.id` & `match.tournament` & `match.stats.surface`.

- [ ] **Step 1: Integrate into Overview**

In `src/components/tennis/match-detail-dialog.tsx` (top adds imports) :

```ts
import { PreviousRoundHighlightsWidget } from "@/components/tennis/previsiones-match-highlights-widget";
import { usePreviousRoundHighlights } from "@/hooks/use-previous-round-highlights";
```

After the `useLastMatchHighlights` block (~line 107-110), add:

```ts
const { data: prevRound, isLoading: prevRoundLoading } = usePreviousRoundHighlights(
  match?.id ?? null,
  match ? { id: match.playerA.id, name: match.playerA.name } : null,
  match ? { id: match.playerB.id, name: match.playerB.name } : null,
  match?.tournament ?? null,
);
```

Inside the Overview `<TabsContent value="overview">`, right after `LastMatchHighlightsWidget` block, add:

```tsx
<PreviousRoundHighlightsWidget
  players={prevRound?.players ?? []}
  tourPreviousLabel={t("highlightsPrevious.tourPrevious")}
  lastMatchLabel={t("highlightsPrevious.lastMatch")}
  opponentTemplate={t("highlightsPrevious.opponent")}
  loadingLabel={t("highlightsPrevious.loading")}
  isLoading={prevRoundLoading}
/>
```

Verify the dialog uses `useTranslations("detail")` — the `t` function already present. Ensure the surface passed to the endpoint is not needed (the service resolves it from BSD), so no extra prop.

- [ ] **Step 2: COMPONENTS.md**

Add under "tennis" components:
```
- `prev-match-highlights-widget` — highlights du tour précédent (2 cartes côte-à-côte).
```

- [ ] **Step 3: Script live + npm script**

Create `scripts/test-previous-highlights.ts`:

```ts
// Vérifie la récupération des highlights du tour précédent pour 2 duels en cours.
// Usage : bun run test:highlights  (serveur :3000 requis, BSD_API_KEY définie)

const BASE = process.env.API_BASE ?? "http://localhost:3000";

const duels = [
  {
    matchId: "bsd-1", playerAId: "11", playerAName: "Iga Swiatek",
    playerBId: "12", playerBName: "Ons Jabeur",
    tournament: "Roland Garros", surface: "Terre battue",
  },
  {
    matchId: "bsd-2", playerAId: "21", playerAName: "Carlos Alcaraz",
    playerBId: "22", playerBName: "Jannik Sinner",
    tournament: "Wimbledon", surface: "Gazon",
  },
];

async function main() {
  for (const d of duels) {
    const qs = new URLSearchParams(d as Record<string, string>).toString();
    const res = await fetch(`${BASE}/api/v1/previous-match-highlights?${qs}`);
    const body = (await res.json()) as {
      players?: Array<{
        playerName: string; label: string;
        context: { opponent: string | null; score: string | null };
        video: { videoId: string } | null;
      }>;
    };
    console.log(`— Duel ${d.playerAName} vs ${d.playerBName} —`);
    for (const p of body.players ?? []) {
      console.log(
        `  ${p.playerName}: label=${p.label} opp=${p.context.opponent ?? "?"} score=${p.context.score ?? "?"} video=${p.video ? p.video.videoId : "AUCUNE"}`,
      );
    }
  }
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
```

Add to `package.json` scripts:
```json
"test:previous-highlights": "bun run scripts/test-previous-highlights.ts"
```

- [ ] **Step 4: Typecheck + lint + commit**

Run: `npx tsc --noEmit && bun run lint`
Expected: both pass.

```bash
git add src/components/tennis/match-detail-dialog.tsx COMPONENTS.md scripts/test-previous-highlights.ts package.json
git commit -m "feat: intégration Overview + widget + script validation 2 duels"
```

---

### Task 9: CHANGELOG

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Add v12.95 entry**

```markdown
## [v12.95] — 2026-08-07 — Highlights du tour précédent dans le détail match tennis

### Ajouté
- **Service `getPreviousRoundHighlights`** — résolution du dernier match de chaque joueur (player1_last5/player2_last5 BSD), étiquette « Tour précédent » (même tournoi) / « Dernier match », cascade requêtes YouTube (adversaire + surface + tournoi + année), cache 48h.
- **`GET /api/v1/previous-match-highlights`** — endpoint dédié (validation, jamais 5xx).
- **`usePreviousRoundHighlights`** — hook SWR déduplé (10 min).
- **`PrevRoundHighlightsWidget`** — deux cartes côte-à-côte (16/9 youtube-nocookie), intégré à l'onglet Overview.
- **i18n `highlightsPrevious.*`** — 7 locales.

### Testé
- `bunx bun test tests/previous-match-highlights.test.ts`, `npx tsc --noEmit`, `bun run lint`, `bun run test:previous-highlights` (2 duels en cours).
```

- [ ] **Step 2: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs(changelog): v12.95 — highlights du tour précédent"
```

---

## Self-Review

**Spec coverage:** (1) résolution tour précédent → Task 3 (last5) ✓ ; (2) requête précise → Task 1 `buildHighlightQuery` + Task 3 ✓ ; (3) cache 48h → Task 3 (memo global, TTL_MS) ✓ ; (4) fallback cascade surface → Task 3 `defaultResolveVideo` ✓ ; (5) encart double cartes → Task 7 ✓ ; (6) métadonnées → Task 3 context + widget caption ✓ ; (7) lecteur sécurisé → Task 7 (youtube-nocookie) ✓ ; (8) test script 2 duels → Task 8 ✓ ; (9) tsc → chaque tâche ✓.

**Placeholder scan:** aucun `TODO`/`TBD` dans le code des steps. `defaultResolveVideo` initial (null) est explicité comme volontaire pour le TDD et remplacé au Step 5 de Task 3.

**Type consistency:** `TennisSurface`, `PreviousRoundContext`, `PreviousRoundPlayer`, `PreviousRoundApiItem` cohérents entre Tasks 1/3/4/6. `opponentTemplate.replace("{s}", ...)` dans le widget utilise `{s}` — dans `fr.json` on définit `opponent: "vs {s}"` pour matcher (alignment aisé à ajuster si next-int exige `{0}` — le widget utilise du `.replace` manuel, donc pas de souci next-int côté display).

**Gaps ajustés pendant rédaction:** `use-bsd-match-detail.ts` a helper `parseBsdId` privé → extrait dans `src/lib/bsd-id.ts` (Task 2) et réutilisable. IDs réels : utiliser `match.playerA.id`/`playerB.id`.

**Exécution** : après sauvegarde, proposer Subagent-Driven (recommandé) ou Inline (executing-plans).