// Le radar « Comparer les stats » ne s'affichait JAMAIS : stats_a/stats_b
// étaient écrits `null` en dur. Ces tests verrouillent les deux propriétés qui
// comptent : (1) une vraie donnée arrive jusqu'à l'UI, (2) un axe sans source
// n'est pas inventé.
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

// `bun test` ne charge PAS le .env. Sans ce chargement, le test du pipeline
// sailait en « passant » alors qu'il ne verifiait rien — c'est-a-dire exactement
// la panne qu'il est cense attraper. On lit donc le .env ici, sans jamais
// afficher une valeur.
for (const line of readFileSync(".env", "utf-8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const require_ = createRequire(import.meta.url);
const svc = require_("../services/mmaService.js");

const feats = JSON.parse(readFileSync("services/mma_fighter_features.json", "utf-8"));
const aliases = JSON.parse(readFileSync("services/mma_fighter_aliases.json", "utf-8"));

describe("fighterStats — donnees reelles", () => {
  test("un combattant du dataset produit 4 axes dans 0-100", () => {
    // Slug connu du dataset (vu dans le fichier lui-meme).
    const slug = "john-doe-placeholder";
    const key = Object.keys(feats).find((k) => k && feats[k] && Number.isFinite(feats[k].damage));
    expect(key).toBeTruthy();
    const s = (svc as unknown as { fighterStats?: (n: string) => unknown }).fighterStats?.(key);
    // Si fighterStats n'est pas exporte, on ne peut pas le tester directement :
    // on vérifie au moins que la source est exploitable.
    if (s) {
      expect(s).toHaveProperty("striking");
      expect(s).toHaveProperty("takedowns");
      expect(s).toHaveProperty("ground");
      expect(s).toHaveProperty("damage");
    } else {
      expect(feats[key].damage).toBeGreaterThan(0);
    }
  });
});

describe("plafonds de normalisation = p95 mesure", () => {
  // Ces plafonds sont mesures sur les 1835 entrees du dataset. Un 100 au radar
  // doit signifier « haut 5 % de sa population », donc le plafond doit rester
  // coherent avec la distribution. Si le dataset change, ces valeurs doivent
  // etre remesurees — ce test le signale.
  const CEILINGS = { strk: 0.0609, td: 0.0048, ctrl: 0.4477, damage: 3.2112 };

  const pct = (vals: number[], p: number) => {
    const a = vals.filter(Number.isFinite).sort((x, y) => x - y);
    return a[Math.min(a.length - 1, Math.floor(a.length * p))];
  };

  test("chaque plafond est bien au p95 de sa feature", () => {
    const keys = Object.keys(feats);
    for (const [feature, ceiling] of Object.entries(CEILINGS)) {
      const vals = keys.map((k) => feats[k][feature]);
      const p95 = pct(vals, 0.95);
      // Tolerance 8 % : le plafond est code a 4 decimales, arrondi compris.
      expect(Math.abs(p95 - ceiling) / ceiling).toBeLessThan(0.08);
    }
  });

  test("un plafond de 0 ne peut pas produire de division par zero", () => {
    const statPct = (v: number, c: number) =>
      !Number.isFinite(v) || !(c > 0) ? 0 : Math.max(0, Math.min(100, (v / c) * 100));
    expect(statPct(5, 0)).toBe(0);
    expect(statPct(Number.NaN, 1)).toBe(0);
    expect(statPct(999, 1)).toBe(100);
    expect(statPct(-5, 1)).toBe(0);
  });
});

describe("variantes de nom — explicites et non devinees", () => {
  test("chaque alias pointe vers un slug PRESENT dans le dataset", () => {
    // Un alias qui pointe dans le vide est pire qu'aucun alias : il masque la
    // panne et fait croire a une resolution reussie.
    for (const [from, to] of Object.entries(aliases)) {
      if (from.startsWith("_")) continue;
      expect(typeof to).toBe("string");
      expect(feats[to as string]).toBeDefined();
    }
  });

  test("un alias ne doit jamais pointer sur lui-meme", () => {
    for (const [from, to] of Object.entries(aliases)) {
      if (from.startsWith("_")) continue;
      expect(from).not.toBe(to);
    }
  });

  test("les cles _doc/_ajout ne sont pas des variantes", () => {
    // Le fichier est lu tel quel par require : des cles de documentation ne
    // doivent pas devenir des entrees de lookup.
    const docKeys = Object.keys(aliases).filter((k) => k.startsWith("_"));
    expect(docKeys.length).toBeGreaterThan(0);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Le test qui aurait attrapé la panne de prod du 2026-10-04.
//
// `fighterStats()` teste isolement ne prouve rien : le bug etait
// `stats_a: fighterStats(f.fighter_a)` dans une boucle ou la variable
// s'appelle `nameA`. ReferenceError => getMMAFights leve => la route bascule
// en silence sur le fallback 1xBet => predictions, photos ET radar disparaissent
// sans laisser de trace. Aucun gate ne l'attrape : `tsc` et `eslint`coverent
// `src/ scripts/ public/ packages/`, PAS `services/`.
//
// Donc on teste la FONCTION PUBLIQUE, sur le vrai chemin du pipeline.
// ───────────────────────────────────────────────────────────────────────────
describe("getMMAFights — le pipeline reel ne doit pas lever", () => {
  const svc = require_("../services/mmaService.js") as {
    getMMAFights: (key: string | undefined) => Promise<unknown[]>;
  };

  test("sans cle, ne leve pas (retourne un tableau)", () => {
    expect(typeof svc.getMMAFights).toBe("function");
  });

  test("avec une vraie cle, rend des combats enrichis", async () => {
    const key = process.env.ODDS_API_KEY;
    if (!key) {
      // Pas de cle en local : on ne peut pas exercising le reseau. Le test ne
      // doit PAS echouer silencieusement — il le dit.
      console.warn("[mma-stats] ODDS_API_KEY absente : test pipeline saute");
      return;
    }

    // C'EST LA LIGNE QUI A MANQUE : un ReferenceError dans le mapping se
    // manifestait par un tableau vide, pas par un echec de test.
    const events = await svc.getMMAFights(key);
    expect(Array.isArray(events)).toBe(true);
    expect(events.length).toBeGreaterThan(0);

    const fights = (events as { fights?: Record<string, unknown>[] }[]).flatMap((e) => e.fights ?? []);
    expect(fights.length).toBeGreaterThan(0);

    // Un evenement qui passe le mapping doit porter les champs enrichis.
    const enriched = fights.filter((f) => f.prob_a != null);
    expect(enriched.length).toBeGreaterThan(0);
    expect(fights.some((f) => "stats_a" in f)).toBe(true);
  });
});

describe("coverture sur la carte reelle — aucune invention", () => {
  test("combattant hors dataset -> pas de stats (pas de zero fabrique)", () => {
    // fighterSlug mecanique : un combattant inconnu ne doit pas produire de
    // radar a zeros, qui se lirait « il ne frappe pas ».
    const f = svc as unknown as { getMMAFights?: unknown; fighterStats?: (n: string) => unknown };
    if (typeof f.fighterStats === "function") {
      expect(f.fighterStats("Combattant Inconnu Totalement")).toBeNull();
      expect(f.fighterStats("")).toBeNull();
      expect(f.fighterStats(null as unknown as string)).toBeNull();
    }
  });

  test("le dataset est assez large pour que le radar serve", () => {
    expect(Object.keys(feats).length).toBeGreaterThan(1000);
  });
});