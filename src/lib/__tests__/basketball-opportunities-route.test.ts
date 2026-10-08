import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";

import { GET } from "@/app/api/basketball/opportunities/route";

/**
 * Contrat HTTP de `/api/basketball/opportunities`.
 *
 * ⚠️ Base ISOLÉE : `DATABASE_PATH` est lu à chaque ouverture. Le fichier doit
 * exister AVANT le premier `open()` (piège du `existsSync` — sans cela, le
 * chemin retombe sur `pariscore.db` et les tests écrivent en prod, incident
 * constaté le 2026-10-08).
 */
const tmpDb = path.join(os.tmpdir(), `bbopp-${process.pid}.db`);
const realDb = process.env.DATABASE_PATH;

function resetDb() {
  try { fs.rmSync(tmpDb, { force: true }); } catch { /* noop */ }
  process.env.DATABASE_PATH = tmpDb;
  fs.writeFileSync(tmpDb, "");
}

beforeEach(() => {
  resetDb();
  const g = globalThis as unknown as { __bbOppCache?: Map<string, { data: unknown; at: number }> };
  if (g.__bbOppCache) g.__bbOppCache.clear();
});
afterEach(() => {
  if (realDb === undefined) delete process.env.DATABASE_PATH;
  else process.env.DATABASE_PATH = realDb;
  try { fs.rmSync(tmpDb, { force: true }); } catch { /* noop */ }
});

const url = (qs = "") => `http://localhost/api/basketball/opportunities${qs ? `?${qs}` : ""}`;

async function seed(rows: Array<Record<string, unknown>>) {
  const { ensureBasketballFixtures, upsertBasketballFixtures } = await import(
    "@/lib/basketball-fixtures-db"
  );
  ensureBasketballFixtures();
  return upsertBasketballFixtures(rows as never);
}

function row(partial: Record<string, unknown>) {
  return {
    bsdEventId: 1,
    league: "Euroleague",
    leagueBsdId: 2,
    scheduledAt: "2026-10-08T18:45:00+00:00",
    status: "scheduled",
    homeKey: "RMB", awayKey: "PAR",
    homeName: "Real Madrid", awayName: "Partizan",
    homeScore: null, awayScore: null,
    probHome: null, probAway: null,
    eloHome: null, eloAway: null,
    confidence: null, modelVersion: null,
    mlOddsHome: null, mlOddsAway: null,
    mlFairHome: null, mlFairAway: null,
    mlVigPct: null, mlBooks: null,
    homeStanding: null, awayStanding: null,
    last10ScoredHome: null, last10ScoredAway: null,
    last10TotalHome: null, last10TotalAway: null,
    venue: null,
    ahLine: null, ahBooks: null, ahFairFirst: null, ahFairSecond: null,
    ahVigPct: null, ahBestFirst: null, ahBestSecond: null,
    ouLine: null, ouBooks: null, ouFairFirst: null, ouFairSecond: null,
    ouVigPct: null, ouBestFirst: null, ouBestSecond: null,
    sourceFetchedAt: "2026-10-08T18:36:14.658Z",
    updatedAt: new Date().toISOString(),
    ...partial,
  };
}

describe("GET /api/basketball/opportunities", () => {
  test("table vide ⇒ 503 + predictionsAvailable false, jamais [] nu", async () => {
    // « Pas de base » ≠ « aucune opportunité aujourd'hui ». Le 503 est porteur
    // de cette distinction : un 200 avec [] se lirait comme un marché propre.
    const res = await GET(new NextRequest(url()));
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.predictionsAvailable).toBe(false);
    expect(body.opportunities).toEqual([]);
    expect(body.error).toBeTruthy();
    expect(body.details).toBeTruthy();
  });

  test("payload porte les RÈGLES, pas seulement les données", async () => {
    await seed([row({ bsdEventId: 7504, probHome: 0.615, probAway: 0.385,
                     mlOddsHome: 1.25, mlOddsAway: 5.25 })]);
    const res = await GET(new NextRequest(url()));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.predictionsAvailable).toBe(true);
    // Le client ne doit pas recalculer la règle métier.
    expect(body.rule.minEvExclusive).toBe(0);
    expect(body.rule.strongDisagreementPp).toBe(12);
    expect(body.rule.requiresCalibratedLeague).toBe(true);
    expect(body.source).toBe("basketball_fixtures");
    expect(Array.isArray(body.calibratedLeagues)).toBe(true);
  });

  test("strongDisagreement = true au-delà de 12 pp (Real Madrid — Partizan)", async () => {
    // Modèle 38.5 % vs marché 21.9 % (cote 5.25) → ~16.6 pp.
    await seed([row({ bsdEventId: 7504, probHome: 0.615, probAway: 0.385,
                     mlOddsHome: 1.25, mlOddsAway: 5.25 })]);
    const body = await (await GET(new NextRequest(url()))).json();
    const away = body.opportunities.find((o: { side: string }) => o.side === "away");
    expect(away).toBeDefined();
    expect(away.disagreementPp).toBeGreaterThan(12);
    expect(away.strongDisagreement).toBe(true);
    expect(body.counts.strongDisagreement).toBeGreaterThanOrEqual(1);
    // Le côté domicile est à EV négatif → jamais exposé.
    expect(body.opportunities.find((o: { side: string }) => o.side === "home")).toBeUndefined();
  });

  test("seuil STRICT : EV = 0 ou négatif exclu, positif retenu", async () => {
    // ⚠️ Cotes SYMÉTRIQUES et probas complémentaires : les deux côtés ont
    // alors le même signe d'EV. Les cas précédents ne calculaient que le côté
    // domicile et laissaient passer un côté extérieur à +52 %.
    await seed([
      // 0.5 × 1.8 − 1 = −0.10 des deux côtés → exclu
      row({ bsdEventId: 3, probHome: 0.5, probAway: 0.5, mlOddsHome: 1.8, mlOddsAway: 1.8 }),
      // 0.5 × 2.0 − 1 =  0.00 exactement → exclu (strictement positif exigé)
      row({ bsdEventId: 4, probHome: 0.5, probAway: 0.5, mlOddsHome: 2.0, mlOddsAway: 2.0 }),
      // 0.5 × 2.1 − 1 = +0.05 → retenu, mais SANS désaccord (cote ≈ proba)
      row({ bsdEventId: 5, probHome: 0.5, probAway: 0.5, mlOddsHome: 2.1, mlOddsAway: 2.1 }),
    ]);
    const body = await (await GET(new NextRequest(url()))).json();
    // id5 : cote 2.1/2.1 pour p=0.5/0.5 → les DEUX côtés sont à +5 %.
    // C'est un arbitrage, pas une erreur : deux entrées, même rencontre.
    expect(body.opportunities).toHaveLength(2);
    for (const o of body.opportunities) {
      expect(o.bsdEventId).toBe(5);
      expect(o.ev).toBeGreaterThan(0);
    }
    // id3 (EV −10 %) et id4 (EV = 0 exactement) sont exclus : la règle est
    // strictement `ev > 0`, un EV nul ne passe pas.
    expect(body.opportunities.find((o: { bsdEventId: number }) => o.bsdEventId === 3)).toBeUndefined();
    expect(body.opportunities.find((o: { bsdEventId: number }) => o.bsdEventId === 4)).toBeUndefined();
  });

  test("ligue NON calibrée ⇒ aucune opportunité, même avec EV massif", async () => {
    // Garde principale : sans σ mesuré de la ligue, pas de jugement possible.
    await seed([row({ bsdEventId: 9, league: "BBL", probHome: 0.9, probAway: 0.1,
                     mlOddsHome: 5.0, mlOddsAway: 1.1 })]);
    const body = await (await GET(new NextRequest(url()))).json();
    expect(body.opportunities).toEqual([]);
    expect(body.counts.opportunities).toBe(0);
  });

  test("bornage du top : 0, négatif, > 50 et non-numérique", async () => {
    const many = Array.from({ length: 30 }, (_, i) =>
      row({ bsdEventId: 100 + i, probHome: 0.7, probAway: 0.3, mlOddsHome: 1.6, mlOddsAway: 3 }),
    );
    await seed(many);

    // top invalide → 10 (défaut)
    expect((await (await GET(new NextRequest(url("top=0")))).json()).opportunities).toHaveLength(10);
    // top négatif → défaut
    expect((await (await GET(new NextRequest(url("top=-5")))).json()).opportunities).toHaveLength(10);
    // top non numérique → défaut
    expect((await (await GET(new NextRequest(url("top=abc")))).json()).opportunities).toHaveLength(10);
    // top > 50 → plafonné à 50
    const big = await (await GET(new NextRequest(url("top=500")))).json();
    expect(big.opportunities.length).toBeLessThanOrEqual(50);
    expect(big.opportunities.length).toBeGreaterThan(10);
    // top réel
    expect((await (await GET(new NextRequest(url("top=3")))).json()).opportunities).toHaveLength(3);
  });

  test("filtre league ne sert que cette ligue", async () => {
    await seed([
      row({ bsdEventId: 1, league: "Euroleague", probHome: 0.7, probAway: 0.3, mlOddsHome: 1.6, mlOddsAway: 3 }),
      row({ bsdEventId: 2, league: "NBA", probHome: 0.7, probAway: 0.3, mlOddsHome: 1.6, mlOddsAway: 3 }),
    ]);
    const body = await (await GET(new NextRequest(url("league=NBA")))).json();
    expect(body.opportunities).toHaveLength(1);
    expect(body.opportunities[0].league).toBe("NBA");
  });

  test("réponse identique en double appel (cache serveur, sans second accès disque)", async () => {
    await seed([row({ bsdEventId: 1, probHome: 0.7, probAway: 0.3, mlOddsHome: 1.6, mlOddsAway: 3 })]);
    const a = await (await GET(new NextRequest(url()))).json();
    // On purge la base entre-temps : si le 2e appel servait le disque, il
    // renverrait une table vide.
    process.env.DATABASE_PATH = path.join(os.tmpdir(), `bbopp-vide-${process.pid}.db`);
    fs.writeFileSync(process.env.DATABASE_PATH, "");
    const b = await (await GET(new NextRequest(url()))).json();
    expect(b.opportunities).toHaveLength(a.opportunities.length);
    expect(b.counts.opportunities).toBe(a.counts.opportunities);
  });
});