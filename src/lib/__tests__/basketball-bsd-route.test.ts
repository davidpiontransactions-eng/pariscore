import { describe, expect, test, beforeEach } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";

import { GET } from "@/app/api/basketball/bsd/route";
import { loadBsdCache, isCacheStale } from "@/lib/basketball-bsd-cache";

/**
 * Contrat HTTP de `/api/basketball/bsd`.
 *
 * ⚠️ Le cache est VERSIONNÉ au même titre que `data/basketball_vitibet_bsd.json`
 * (les deux sont des dumps re-générables par leurs propres scripts — ici :
 * `bun run scripts/fetch-basketball-bsd.ts`). Versionner rend le test
 * DÉTERMINISTE ; le laisser gitignoré le rendrait silencieusement vide en CI
 * et le test deviendrait un faux vert.
 *
 * Ce qui est verrouillé ici, c'est ce que l'UI ne peut pas vérifier seule :
 * un `prob_over_215` ne doit jamais atteindre le payload, et un logo absent
 * doit sortir `url: null` et non une URL qui répond 204.
 */

const CACHE = path.join(process.cwd(), "data", "basketball_bsd_cache.json");
const CACHE_EXISTS = fs.existsSync(CACHE);
const cache = loadBsdCache();

const url = (qs = "") => `http://localhost/api/basketball/bsd${qs ? `?${qs}` : ""}`;

function resetRouteCache() {
  const g = globalThis as unknown as {
    __bbBsdCache?: Map<string, { data: unknown; at: number }>;
  };
  if (g.__bbBsdCache) g.__bbBsdCache.clear();
}

beforeEach(resetRouteCache);

describe("cache BSD — pré-requis", () => {
  test("le cache versionné est présent et lisible", () => {
    // Un échec ici signifie : le cron n'a pas tourné, ou le fichier est
    // corrompu. `loadBsdCache` renvoie null dans ce cas.
    expect(CACHE_EXISTS, "cache absent — lancer `bun run scripts/fetch-basketball-bsd.ts`").toBe(true);
    expect(cache).not.toBeNull();
  });
});

describe("GET /api/basketball/bsd — contenu", () => {
  test("200 avec fixtures, fraîcheur et provenance", async () => {
    const res = await GET(new NextRequest(url()));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.predictionsAvailable).toBe(true);
    expect(body.source).toBe("bsd-cache");
    expect(body.fetchedAt).toBeTruthy();
    expect(body.staleAfterMinutes).toBeGreaterThan(0);
    expect(typeof body.stale).toBe("boolean");
    expect(body.fixtures.length).toBeGreaterThan(0);
    // Fraîcheur toujours exposée : le popup affiche « données de HH:MM »,
    // il ne fait jamais croire au temps réel.
    expect(body.ageMinutes === null || body.ageMinutes >= 0).toBe(true);
  });

  test("aucun seuil de total NBA ne traverse le payload", () => {
    // Régression : BSD renvoie prob_over_205/215/225 sur chaque match, mais
    // ses seuils sont calibrés NBA. Sur un EuroCup à ~160 pts, `prob_over_215
    // = 0.0246` (mesuré) — l'exclure est la raison d'être du sanitizer.
    const sansAudit = cache!.fixtures.map((f) => {
      if (!f.prediction) return JSON.stringify(f);
      const { rejectedFields: _piste, ...pred } = f.prediction;
      return JSON.stringify({ ...f, prediction: pred });
    }).join("");
    for (const k of ["prob_over_205", "prob_over_215", "prob_over_225", "prob_favorite_wins"]) {
      // `rejectedFields` les cite par conception (piste d'audit voulue) : on
      // le retire AVANT de chercher, sinon on teste l'inverse de l'intention.
      expect(sansAudit, `${k} a traversé le filtre`).not.toContain(k);
    }
    // La piste d'audit, elle, doit rester : le champ `rejectedFields`.
    const avecPred = cache!.fixtures.filter((f) => f.prediction);
    expect(avecPred.length, "au moins une prédiction dans le cache").toBeGreaterThan(0);
    for (const f of avecPred) {
      expect(f.prediction!.rejectedFields.length).toBeGreaterThan(0);
      expect(f.prediction!.probHomeWin + f.prediction!.probAwayWin).toBeCloseTo(1, 4);
    }
  });

  test("logo absent ⇒ url null, jamais une URL qui répond 204", () => {
    // Le contrat BSD : 200 = image, 204 = id valide sans image. Afficher
    // l'URL quand 204 donne une icône cassée.
    for (const f of cache!.fixtures) {
      for (const side of [f.home, f.away]) {
        if (!side.logo.available) expect(side.logo.url).toBeNull();
        else expect(side.logo.url).toContain("/img/basketball/team/");
      }
    }
    // Au moins un vrai logo mesuré (le cron a relevé 17/17 sur EuroCup).
    const dispo = cache!.fixtures.filter((f) => f.home.logo.available).length;
    expect(dispo).toBeGreaterThan(0);
  });

  test("provenance par champ, jamais devinée", () => {
    for (const f of cache!.fixtures) {
      // Une prédiction présente vient de BSD ; son absence n'a PAS de source.
      expect(f.predictionSource).toBe(f.prediction ? "bsd" : null);
      expect(f.oddsSource).toBe(f.odds.length > 0 ? "bsd" : null);
      // Les cotes doivent être là. La MARGE est mesurée, pas garantie :
      // elle peut être négative quand le book a coté deux côtés > 2
      // (cote d'arbitrage = donnée bookmaker erronée). On la laisse passer
      // telle quelle plutôt que de la tronquer à 0 — c'est une anomalie
      // à afficher, pas à masquer.
      for (const o of f.odds) {
        expect(o.oddsHome).not.toBeNull();
        expect(o.oddsAway).not.toBeNull();
        if (o.vigPct !== null) {
          expect(Number.isFinite(o.vigPct)).toBe(true);
          // Borné : une marge ne peut pas être < -100 %.
          expect(o.vigPct).toBeGreaterThan(-100);
        }
      }
    }
    // Contrôle d'ensemble : la marge négative reste minoritaire. Si elle
    // devient majoritaire, c'est que BSD envoie des cotes incohérentes.
    const vigs = cache!.fixtures
      .flatMap((f) => f.odds)
      .map((o) => o.vigPct)
      .filter((v): v is number => v !== null);
    expect(vigs.length).toBeGreaterThan(0);
    const negatifs = vigs.filter((v) => v < 0);
    expect(negatifs.length, `${negatifs.length}/${vigs.length} cotes à marge négative`)
      .toBeLessThan(vigs.length);
  });

  test("filter league= n'affiche que cette ligue", async () => {
    const res = await GET(new NextRequest(url("league=6")));
    expect(res.status).toBe(200);
    const body = await res.json();
    for (const f of body.fixtures) expect(f.leagueBsdId).toBe(6);
  });

  test("ligue inconnue ⇒ tableau vide cohérent, pas d'erreur", async () => {
    const res = await GET(new NextRequest(url("league=999")));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.fixtures).toEqual([]);
    expect(body.counts.served).toBe(0);
  });

  test("paramètre invalide ⇒ 400, pas un cast silencieux", async () => {
    const res = await GET(new NextRequest(url("league=abc")));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.predictionsAvailable).toBe(false);
  });
});

describe("fraîcheur du cache — le popup doit le dire", () => {
  test("stale reflète l'âge réel, pas une valeur figée", async () => {
    const res = await GET(new NextRequest(url()));
    const body = await res.json();
    const attendu = isCacheStale(body.fetchedAt, body.staleAfterMinutes);
    expect(body.stale).toBe(attendu);
    if (body.stale) expect(body.freshnessNote).toBeTruthy();
    else expect(body.freshnessNote).toBeNull();
  });
});
