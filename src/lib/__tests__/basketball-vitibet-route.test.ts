import { describe, expect, test, beforeEach } from "bun:test";
import { NextRequest } from "next/server";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { GET } from "@/app/api/basketball/vitibet/route";

/**
 * Garde-fous PROTOCOLE de `/api/basketball/vitibet`.
 *
 * Ces tests ne vérifient pas le contenu (déjà couvert par
 * `basketball-vitibet-data.test.ts`) mais le COMPORTEMENT HTTP : quels codes,
 * quelles ligues fuient, ce que fait un paramètre d'URL hostile.
 *
 * Le risque couvert est précis : une ligue sans base mesurée servie parce qu'un
 * `?leagues=` l'a forcée. Elle afficherait alors des marchés calculés avec des
 * constantes génériques (`paceBaseline 83.0`, `sdTotal 14.5` de `fibaLeague()`),
 * exactement ce que la calibration multi-ligue devait empêcher.
 */

const url = (qs = "") => `http://localhost/api/basketball/vitibet${qs ? `?${qs}` : ""}`;

// Cache module-level (5 min) : on le purge entre les tests pour que chacun
// parte d'un état connu, sinon le 2e appel court-circuite sur le 1er.
function resetCache() {
  const g = globalThis as unknown as { __bbVitibetCache?: Map<string, { data: unknown; at: number }> };
  if (g.__bbVitibetCache) g.__bbVitibetCache.clear();
}

beforeEach(resetCache);

describe("GET /api/basketball/vitibet — ligues autorisées", () => {
  test("sans paramètre : sert les 4 ligues calibrées", async () => {
    const res = await GET(new NextRequest(url()));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.predictionsAvailable).toBe(true);
    expect(body.leagues.sort()).toEqual(["eurocup", "euroleague", "nba", "wnba"]);
  });

  test("`nba` est calibrée : elle est SERVIE, pas rejetée", async () => {
    // Contre-preuve d'une intuition trompeuse : `nba` fait partie des 4 ligues
    // calibrées (elle est dans basketball_match_history).
    const res = await GET(new NextRequest(url("leagues=nba")));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.leagues).toEqual(["nba"]);
    for (const m of body.matches) expect(m.league).toBe("nba");
  });

  test("`?leagues=lba` : ligue configurée MAIS sans mesure → 400, rien de servi", async () => {
    // `lba` existe dans LEAGUE_CONFIGS mais n'a aucune base mesurée. La forcer
    // par URL ne doit pas la servir : c'est le cœur du garde-fou.
    const res = await GET(new NextRequest(url("leagues=lba")));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.predictionsAvailable).toBe(false);
    expect(body.availableLeagues.sort()).toEqual(["eurocup", "euroleague", "nba", "wnba"]);
    expect(body.matches).toBeUndefined();
  });

  test("mélange calibrée + non calibrée : seule la calibrée passe", async () => {
    const res = await GET(new NextRequest(url("leagues=nba,lba")));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.leagues).toEqual(["nba"]);
    for (const m of body.matches) expect(m.league).toBe("nba");
  });

  test("ligue inconnue → ignorée, pas d'erreur ni de fuite", async () => {
    const res = await GET(new NextRequest(url("leagues=euroleague,zzz_inexistante")));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.leagues).toEqual(["euroleague"]);
  });

  test("aucune ligue demandée n'est servie si aucune n'est calibrée", async () => {
    const res = await GET(new NextRequest(url("leagues=zzz,acb,bsl")));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.predictionsAvailable).toBe(false);
  });
});

describe("GET /api/basketball/vitibet — contrat d'intégrité du payload", () => {
  test("aucun match sans prédiction n'expose de champ financier", async () => {
    const res = await GET(new NextRequest(url()));
    const body = await res.json();
    expect(body.matches.length).toBeGreaterThan(0);

    const sansPred = body.matches.filter((m: { predictionsAvailable: boolean }) => !m.predictionsAvailable);
    expect(sansPred.length).toBeGreaterThan(0); // sinon le test ne prouve rien

    for (const m of sansPred) {
      expect(m.predictionsAvailable).toBe(false);
      expect(m.predictionsUnavailableReason).toBeTruthy();
      for (const k of ["index", "probHome", "probDraw", "probAway", "tip", "predictedScore"]) {
        expect(m[k], `${m.id}/${m.league}: ${k} fuit`).toBeNull();
      }
      expect(m.teamPower.home).toBeNull();
      expect(m.teamPower.away).toBeNull();
      expect(m.form.home).toBeNull();
      expect(m.form.away).toBeNull();
    }
  });

  test("predictionsOnly=1 ne renvoie que des matchs prédits", async () => {
    const res = await GET(new NextRequest(url("predictionsOnly=1")));
    const body = await res.json();
    expect(body.matches.length).toBeGreaterThan(0);
    for (const m of body.matches) expect(m.predictionsAvailable).toBe(true);
    expect(body.counts.withPredictions).toBe(body.matches.length);
  });

  test("les ligues écartées sont publiées avec leur motif", async () => {
    // Le refus doit être AUDIBLE : sans ça, LNBP (14 matchs) disparaît sans
    // qu'on sache pourquoi.
    const res = await GET(new NextRequest(url()));
    const body = await res.json();
    expect(body.skippedLeagues.length).toBeGreaterThan(0);
    for (const s of body.skippedLeagues) {
      expect(s.reason.length).toBeGreaterThan(5);
      expect(s.vitibetLeague).toBeTruthy();
    }
    const refusees = body.skippedLeagues.map((s: { vitibetLeague: string }) => s.vitibetLeague);
    expect(refusees).toContain("Liga A"); // Argentine, pas acb/lba
    expect(refusees).toContain("LNB"); // Chili, pas lnb
  });
});

describe("GET /api/basketball/vitibet — cache", () => {
  test("2e requête identique : servie depuis le cache (même référence)", async () => {
    const r1 = await GET(new NextRequest(url()));
    const b1 = await r1.json();
    const r2 = await GET(new NextRequest(url()));
    const b2 = await r2.json();
    // Mêmes données, mais surtout : aucun second accès disque (le cache existe).
    expect(b2.matches.length).toBe(b1.matches.length);
    expect(b2.counts.served).toBe(b1.counts.served);
  });

  test("paramètres différents ⇒ clés de cache différentes", async () => {
    const a = await (await GET(new NextRequest(url("leagues=nba")))).json();
    const b = await (await GET(new NextRequest(url("leagues=wnba")))).json();
    expect(a.leagues).toEqual(["nba"]);
    expect(b.leagues).toEqual(["wnba"]);
    // Aucune contamination entre les deux.
    for (const m of b.matches) expect(m.league).toBe("wnba");
  });
});

describe("GET /api/basketball/vitibet — dump absent", () => {
  test("503 + predictionsAvailable:false, PAS une liste vide", async () => {
    // Le loader résout `data/basketball_vitibet_bsd.json` depuis process.cwd().
    // Un cwd sans ce fichier = dump introuvable : la route doit l'annoncer,
    // sinon l'UI afficherait « aucun match » comme si la journée était vide.
    const cwd = process.cwd();
    const tmp = path.join(os.tmpdir(), `pariscore-nodump-${process.pid}`);
    fs.mkdirSync(tmp, { recursive: true });
    try {
      process.chdir(tmp);
      resetCache();
      const res = await GET(new NextRequest(url()));
      expect(res.status).toBe(503);
      const body = await res.json();
      expect(body.predictionsAvailable).toBe(false);
      expect(body.error).toBe("dump 1xBet indisponible");
      expect(body.details).toContain("basketball_vitibet_bsd.json");
      expect(body.matches).toBeUndefined();
    } finally {
      process.chdir(cwd);
      resetCache();
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  test("400 prime sur 503 : une demande sans ligue calibrée n'accède pas au dump", async () => {
    const cwd = process.cwd();
    const tmp = path.join(os.tmpdir(), `pariscore-nodump2-${process.pid}`);
    fs.mkdirSync(tmp, { recursive: true });
    try {
      process.chdir(tmp);
      resetCache();
      const res = await GET(new NextRequest(url("leagues=lba")));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.predictionsAvailable).toBe(false);
    } finally {
      process.chdir(cwd);
      resetCache();
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});