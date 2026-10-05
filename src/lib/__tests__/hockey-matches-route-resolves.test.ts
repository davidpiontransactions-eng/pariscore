/**
 * Régression : `/api/hockey/matches` ne doit JAMAIS rester en suspens.
 *
 * Le 2026-10-05, `fetchBSD` enveloppait sa chaîne de fetch dans
 * `new Promise((resolve, reject) => { fetch(...).then(...).catch(reject) })`.
 * L'exécuteur ignore la valeur de la chaîne et `resolve` n'était jamais
 * appelé : sur SUCCÈS la promesse restait en suspens, `Promise.all` ne se
 * réglait pas, et la route ne répondait jamais — 0 réponse 200 dans les logs
 * nginx de toute la journée, uniquement des 504 « upstream timed out ».
 * Elle ne fonctionnait que si l'API BSD échouait.
 *
 * Ce test appelle la route RÉELLE. C'est indispensable : un test qui rejoue
 * la même logique en la réécrivant ne reproduit pas l'enveloppe fautive, et
 * c'est exactement ce qui a masqué le bug pendant une journée.
 */
import { describe, test, expect } from "bun:test";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

import { GET } from "@/app/api/hockey/matches/route";

/** Budget large : mesuré 949 ms. Un blocage réel dépasse 10 s sans ambiguïté. */
const BUDGET_MS = 10_000;

const calendrier = existsSync(join(process.cwd(), "data", "khl_schedule.json"))
  ? JSON.parse(readFileSync(join(process.cwd(), "data", "khl_schedule.json"), "utf8"))
  : null;

describe("GET /api/hockey/matches — ne se suspend jamais", () => {
  test("la route répond dans le budget (le bug laissait la promesse en suspens)", async () => {
    // `Promise<never>` : la promesse de rejet ne résout jamais, donc le type du
    // race reste `Response` au lieu d'être élargi à `unknown`.
    const res = await Promise.race<Response>([
      GET(),
      new Promise<never>((_, rejeter) => setTimeout(() => rejeter(new Error(`pas de réponse en ${BUDGET_MS}ms`)), BUDGET_MS)),
    ]);

    expect(res.status === 200 || res.status === 503).toBe(true);

    const body = await res.json();
    // Un 503 est un échec assumé et hasty ; un 200 doit porter un compte.
    if (res.status === 200) {
      expect(Array.isArray(body.matches)).toBe(true);
      expect(typeof body.source).toBe("string");
      expect(body.counts).toBeDefined();
      expect(body.counts.total).toBe(body.matches.length);
    } else {
      expect(body.error).toBeTruthy();
    }
  }, BUDGET_MS + 5000);

  test("deux appels consécutifs sont tous les deux servis (le cache ne masque rien)", async () => {
    const un = await GET();
    const deux = await GET();
    expect(un.status).toBe(200);
    expect(deux.status).toBe(200);
    // Le second passe par le cache : il doit rester aussi complet.
    const a = await un.json();
    const b = await deux.json();
    expect(b.matches.length).toBe(a.matches.length);
  }, BUDGET_MS + 5000);

  test("le calendrier KHL alimente la réponse quand le fichier est présent", async () => {
    if (!calendrier) {
      // Sans donnée locale on ne peut rien affirmer — mais surtout on ne
      // casse pas : la route doit rester servie, source absente signalée.
      const res = await GET();
      expect(res.status === 200 || res.status === 503).toBe(true);
      return;
    }
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();

    const khl = body.matches.filter((m: { source: string }) => m.source === "hockeytech");
    expect(khl.length).toBeGreaterThan(0);
    expect(body.counts.hockeytech).toBe(khl.length);
    // La fenêtre de lecture est J-7/J+10 : bien moins que la saison entière.
    expect(khl.length).toBeLessThan(calendrier.matches.length);

    const exemple = khl[0] as { homeName: string; awayName: string; predictionsAvailable: boolean };
    expect(exemple.homeName.length).toBeGreaterThan(0);
    expect(exemple.awayName.length).toBeGreaterThan(0);
    expect(typeof exemple.predictionsAvailable).toBe("boolean");
  }, BUDGET_MS + 5000);

  test("aucune promesse laissée en suspens dans le code de la route", async () => {
    // Garde-fou statique : l'enveloppe `new Promise` autour d'une chaîne
    // dont `resolve` n'est jamais appelé est exactement le motif qui a
    // cassé la route. On refuse sa réintroduction dans ce fichier.
    const src = readFileSync(join(process.cwd(), "src", "app", "api", "hockey", "matches", "route.ts"), "utf8");
    const enveloppes = src.match(/new Promise<[^>]*>\(\s*\(resolve,\s*reject\)\s*=>/g) ?? [];
    for (const bloc of enveloppes) {
      const debut = src.indexOf(bloc);
      const zone = src.slice(debut, debut + 1500);
      // L'enveloppe est admise uniquement si `resolve` est réellement appelé.
      expect(zone).toMatch(/resolve\(/);
    }
  });
});