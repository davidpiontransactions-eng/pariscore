// Tests des parties PURES de l'analyse IA handball : clé de cache, TTL 24h,
// purge, et contenu du prompt (aucun appel Gemini, aucune écriture disque).
import { describe, expect, test } from "bun:test";
import {
  AI_CACHE_TTL_MS,
  aiCacheKey,
  buildAiPrompt,
  isEntryFresh,
  pruneEntries,
  type AiCacheEntry,
} from "../handball-ai-analysis";
import type { HandballAnalysisPayload } from "../../app/api/handball/analysis/route";

const HOUR = 3_600_000;

function entryAgo(hours: number, now: number): AiCacheEntry {
  return {
    generatedAt: new Date(now - hours * HOUR).toISOString(),
    text: "analyse",
    model: "gemini-test",
    latencyMs: 1234,
  };
}

/** Payload minimal mais typé pour tester le prompt. */
function payload(overrides: Partial<HandballAnalysisPayload> = {}): HandballAnalysisPayload {
  return {
    ok: true,
    match: { home: "Kiel", away: "Flensburg-H.", date: "2026-09-26T16:00:00.000Z", league: "Bundesliga" },
    meta: { n: 7734, minDate: "2026-02-27", maxDate: "2026-09-25", lastRun: "2026-09-25T17:25:00.000Z" },
    model: { base: 60, observedMean: 59.2, scale: 1.014, lambdaH: 33.1, lambdaA: 31.1, nu: 1.3, expectedTotal: 64.3 },
    over: {
      floor: 0.55,
      lines: [
        { line: 59.5, over: 0.75, under: 0.25, playable: true },
        { line: 58.5, over: 0.79, under: 0.21, playable: true },
      ],
      pick: { line: 59.5, over: 0.75, under: 0.25, playable: true },
    },
    match1x2: { home: 57.4, draw: 4.8, away: 37.8 },
    teams: { home: null, away: null },
    starligue: null,
    scorers: {
      home: [
        {
          name: "Lukas Zerbe",
          team: "THW Kiel",
          goals: 27,
          games: 5,
          avgGoals: 5.4,
          lambda: 5.56,
          photoUrl: null,
          probs: [
            { n: 2, p: 0.97, playable: true },
            { n: 3, p: 0.91, playable: true },
            { n: 4, p: 0.8, playable: true },
            { n: 5, p: 0.65, playable: true },
          ],
        },
      ],
      away: [],
    },
    method: ["méthode test"],
    ...overrides,
  };
}

describe("aiCacheKey", () => {
  test("normalisation insensible casse/diacritiques/ponctuation + date + ligue", () => {
    const a = aiCacheKey({ home: "Flensburg-H.", away: "Füchse Berlin", league: "Bundesliga", date: "2026-09-26T16:00:00.000Z" });
    const b = aiCacheKey({ home: "flensburgh", away: "Fuchse Berlin", league: "bundesliga", date: "2026-09-26" });
    expect(a).toBe(b);
    expect(a).toContain("2026-09-26");
  });

  test("matchs/luges différents → clés différentes", () => {
    const base = { home: "Kiel", away: "Flensburg", date: "2026-09-26" };
    expect(aiCacheKey(base)).not.toBe(aiCacheKey({ ...base, date: "2026-09-27" }));
    expect(aiCacheKey(base)).not.toBe(aiCacheKey({ ...base, league: "Bundesliga" }));
    expect(aiCacheKey(base)).not.toBe(aiCacheKey({ ...base, home: "Leipzig" }));
  });

  test("date absente → marqueur nodate (pas de crash)", () => {
    expect(aiCacheKey({ home: "A", away: "B" })).toContain("nodate");
  });
});

describe("TTL cache 24h", () => {
  const now = Date.parse("2026-09-25T12:00:00.000Z");

  test("frais avant 24h, expiré après", () => {
    expect(isEntryFresh(entryAgo(0, now), now)).toBe(true);
    expect(isEntryFresh(entryAgo(23, now), now)).toBe(true);
    expect(isEntryFresh(entryAgo(24, now), now)).toBe(false);
    expect(isEntryFresh(entryAgo(48, now), now)).toBe(false);
  });

  test("entrée absente ou date corrompue → pas frais", () => {
    expect(isEntryFresh(undefined, now)).toBe(false);
    expect(isEntryFresh({ ...entryAgo(1, now), generatedAt: "pas-une-date" }, now)).toBe(false);
  });

  test("pruneEntries supprime > 24h et garde le reste", () => {
    const entries = {
      fresh: entryAgo(2, now),
      limite: entryAgo(23.9, now),
      vieille: entryAgo(25, now),
      morte: entryAgo(100, now),
    };
    const pruned = pruneEntries(entries, now);
    expect(Object.keys(pruned).sort()).toEqual(["fresh", "limite"]);
    expect(AI_CACHE_TTL_MS).toBe(24 * HOUR);
  });
});

describe("buildAiPrompt — 7 sections + données réelles", () => {
  const { system, prompt } = buildAiPrompt(payload());

  test("system = expert parieur handball, français, honnête sur les inconnues", () => {
    expect(system).toContain("handball");
    expect(system).toContain("français");
    expect(system).toContain("Aide à la décision");
  });

  test("les 7 sections demandées sont imposées", () => {
    for (const marker of [
      "DESCRIPTIF DES DEUX ÉQUIPES",
      "FORME DU MOMENT",
      "MOYENNE DE BUTS PAR MATCH",
      "MEILLEURS BUTEURS",
      "REVUE DE PRESSE",
      "ANALYSE DESCRIPTIVE PAR TYPE DE PARI",
      "3 BETS PRÉDICTIFS",
    ]) {
      expect(prompt).toContain(marker);
    }
  });

  test("injecte les données réelles (modèle, échelle, buteurs)", () => {
    expect(prompt).toContain("Kiel");
    expect(prompt).toContain("Flensburg-H.");
    expect(prompt).toContain("Bundesliga");
    expect(prompt).toContain("1X2 modèle");
    expect(prompt).toContain("> 59.5 : 75 %");
    expect(prompt).toContain("Lukas Zerbe");
    expect(prompt).toContain("P(au moins 2/3/4/5)");
  });

  test("demande d'expliciter l'inconnu plutôt que d'inventer (presse/absences)", () => {
    expect(prompt).toContain("non vérifié");
    expect(prompt).toContain("REVUE DE PRESSE");
  });

  test("avec équipes sans historique : le prompt le signale au modèle", () => {
    const p = buildAiPrompt(payload());
    expect(p.prompt).toContain("historique insuffisant");
  });
});
