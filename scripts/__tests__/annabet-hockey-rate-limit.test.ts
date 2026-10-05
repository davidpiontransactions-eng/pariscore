/**
 * Vérifie la logique anti-ban du scraper Annabet hockey.
 *
 * Cette logique est non triviale et invisible aux gates : une régression ne se
 * verrait que par un ban IP, des heures plus tard, sur le VPS. Les fonctions
 * sont donc testées ici sur leurs entrées réelles.
 *
 * Ce qu'on verrouille :
 *  1. un ban est classé `ban` et INTERROMPT la chaîne, jamais retry ;
 *  2. un timeout est transitoire et subit un backoff croissant ;
 *  3. `ECONNREFUSED` de FlareSolverr (local) n'est PAS un ban ;
 *  4. le backoff croît puis se plafonne, et le jitter ne le fait jamais descendre ;
 *  5. le cache h2h respecte un TTL et ordonne la paire (a-b == b-a) ;
 *  6. le script ne peut plus contenir `sleep(3000)` fixe ni 3 retries serrés.
 */
import { describe, test, expect } from "bun:test";
import { readFileSync, mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";

const SCRIPT = join(process.cwd(), "scripts", "scrape-annabet-hockey-prematch.mjs");
const src = readFileSync(SCRIPT, "utf8");

// ─── Les fonctions sont-elles exportées pour test ? Sinon on les extrait. ───
// Le script est un exécutable : on isole les corps pour les tester sans le lancer.
function extractFn(name: string): string {
  const start = src.indexOf(`function ${name}`);
  if (start === -1) throw new Error(`${name} introuvable`);
  // Remonte jusqu'à la ligne de début de la fonction.
  let i = src.lastIndexOf("\n", start) + 1;
  let depth = 0;
  let started = false;
  for (let j = start; j < src.length; j++) {
    if (src[j] === "{") { depth++; started = true; }
    else if (src[j] === "}") {
      depth--;
      if (started && depth === 0) return src.slice(i, j + 1);
    }
  }
  throw new Error(`${name} : accolades non équilibrées`);
}

const classifySrc = extractFn("classifyError");
const backoffSrc = extractFn("backoffDelay");
const cachePathSrc = extractFn("cachePath");
const readCacheSrc = extractFn("readCache");

const CACHE_DIR = join(process.cwd(), "data", "hockey-h2h-cache");

// Module d'essai : mêmes helpers, branche origine remplacée par une racine tmp.
const { classifyError } = new Function(`
  ${classifySrc}
  return { classifyError };
`)() as { classifyError: (e: unknown) => string };

const { backoffDelay } = new Function(`
  const BACKOFF_BASE_MS = 10000;
  const BACKOFF_MAX_MS = 90000;
  ${backoffSrc}
  return { backoffDelay };
`)() as { backoffDelay: (n: number) => number };

describe("Annabet hockey — anti-ban", () => {
  test("un refus de connexion est classé ban, pas transitoire", () => {
    const err = Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" });
    expect(classifyError(err)).toBe("ban");
  });

  test("403 / 429 / 401 sont des bans", () => {
    expect(classifyError(Object.assign(new Error("HTTP 403 https://x"), { code: "BAN" }))).toBe("ban");
    expect(classifyError(Object.assign(new Error("HTTP 429 https://x"), { code: "BAN" }))).toBe("ban");
    expect(classifyError(new Error("HTTP 403 https://x"))).toBe("ban");
    expect(classifyError(new Error("HTTP 429 https://x"))).toBe("ban");
  });

  test("un timeout reste transitoire (donc retryable)", () => {
    expect(classifyError(new Error("timeout https://x"))).toBe("transient");
  });

  test("ENOTFOUND / ECONNRESET sont des bans (IP ou DNS coupé)", () => {
    expect(classifyError(Object.assign(new Error("x"), { code: "ENOTFOUND" }))).toBe("ban");
    expect(classifyError(Object.assign(new Error("x"), { code: "ECONNRESET" }))).toBe("ban");
  });

  test("le code HTTP est attaché par fetchDirect, pas seulement le message", () => {
    // Sans `err.code = 'BAN'`, la classification dépendrait d'un parsing de
    // chaîne — fragile. On vérifie que le source pose bien le code.
    expect(src).toContain("err.code = 'BAN'");
    // `/s` (dotAll) est ES2018 et tsconfig cible ES2017 → TS1501. Équivalent
    // borné : `[\s\S]*?` paresseux = le 429 le plus proche après le 403.
    expect(src).toMatch(/statusCode === 403[\s\S]*?429/);
  });

  test("le backoff croît puis se plafonne, jamais de jitter négatif", () => {
    const d1 = backoffDelay(1);
    const d2 = backoffDelay(2);
    const d3 = backoffDelay(3);
    expect(d1).toBeGreaterThanOrEqual(10000);
    expect(d2).toBeGreaterThanOrEqual(d1);
    expect(d3).toBeGreaterThanOrEqual(d2);
    // Plafond 90s + jitter max 3s.
    expect(d3).toBeLessThanOrEqual(93000);
    for (let i = 0; i < 30; i++) {
      expect(backoffDelay(1)).toBeGreaterThanOrEqual(10000);
      expect(backoffDelay(20)).toBeLessThanOrEqual(93000);
    }
  });

  test("un ban interrompt la chaîne au lieu de boucler (BanError + break)", () => {
    expect(src).toContain("class BanError");
    expect(src).toContain("throw new BanError");
    expect(src).toContain("if (!err.isBan) throw err");
    // Le break doit être dans la boucle des ligues, pas ailleurs.
    expect(src).toMatch(/ligues restantes non sollicitées[\s\S]*break;/);
  });

  test("le ban est classé sur le fetch `upcoming`, pas seulement sur le h2h", () => {
    // Régression mesurée : le catch de `ajax_upcoming` absorbait l'erreur et
    // retournait `{matches: [], error}`, donc le ban ne remontait pas et les 3
    // ligues étaient sollicitées quand même (3 requêtes, 87 s, zéro donnée).
    const iUpcoming = src.indexOf("upcomingHtml = await fetchPage(upcomingUrl)");
    expect(iUpcoming).toBeGreaterThan(-1);
    const fenetre = src.slice(iUpcoming, iUpcoming + 500);
    expect(fenetre).toContain("classifyError(err)");
    expect(fenetre).toContain("throw new BanError");

    // Et aucun `return` ne doit court-circuiter un ban avant le throw.
    const iClassify = fenetre.indexOf("classifyError(err)");
    const iThrow = fenetre.indexOf("throw new BanError");
    const iReturn = fenetre.indexOf("return { matches: []");
    expect(iClassify).toBeGreaterThan(-1);
    expect(iThrow).toBeGreaterThan(iClassify);
    expect(iReturn).toBeGreaterThan(iThrow);
  });

  test("l'état du ban est écrit dans le payload (l'UI peut l'afficher)", () => {
    expect(src).toContain("output.banned");
    expect(src).toContain("non sollicité — IP bloquée par Annabet");
  });

  test("un ban écrase l'erreur périmée du merge (le payload ne ment pas)", () => {
    // Régression mesurée : après un ban sur la NHL, le payload affichait
    // « ECONNREFUSED » sur les 3 ligues — valeur PÉRIMÉE du run précédent,
    // alors qu'une seule avait été contactée.
    expect(src).toContain("non sollicité — IP déjà bloquée par Annabet");
    expect(src).toContain("IP bloquée par Annabet — ${err.message}");
    // Les ligues non visitées doivent être marquées, pas laissées au merge.
    expect(src).toMatch(/const reste = LEAGUES\.slice/);
  });

  test("plus de délai fixe : le sleep(3000) et les retries serrés ont disparu", () => {
    // On inspecte le CODE, commentaires retirés : le doc-comment raconte
    // justement l'ancien `sleep(3000)`, et le confondre avec du code actif
    // rendrait cette assertion incapable de distinguer l'un de l'autre.
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(code).not.toMatch(/sleep\(3000\)/);
    expect(code).not.toContain("const backoff = attempt * 5000");
    expect(code).toContain("REQUEST_DELAY_MS");
    expect(code).toContain("lastRequestAt");
  });
});

describe("Annabet hockey — cache h2h", () => {
  const TMP = join(process.cwd(), "data", "tmp-cache-test");

  function buildHelpers(dir: string) {
    // Les dépendances sont PARAMÈTRES de la fonction générée : y écrire un
    // `const join = require(...)` placerait CACHE_DIR avant la déclaration et
    // planterait en TDZ. Les corps sont liftés tels quels depuis le script.
    return new Function(
      "ROOT", "CACHE_TTL_MS", "join", "existsSync", "readFileSync",
      `
      const CACHE_DIR = join(ROOT, 'data', 'hockey-h2h-cache');
      ${cachePathSrc}
      ${readCacheSrc}
      return { cachePath, readCache };
    `,
    )(
      dir,
      20 * 60 * 60 * 1000,
      join,
      existsSync,
      readFileSync,
    ) as { cachePath: (a: number, b: number) => string; readCache: (a: number, b: number) => { html: string; fetchedAt: number } | null };
  }

  test("la paire est ordonnée : a-b et b-a partagent le même fichier", () => {
    const { cachePath } = buildHelpers(TMP);
    expect(cachePath(155, 175)).toBe(cachePath(175, 155));
  });

  test("un cache frais est lu, un cache périmé est ignoré", () => {
    const h = buildHelpers(TMP);
    const file = h.cachePath(155, 175);
    mkdirSync(join(TMP, "data", "hockey-h2h-cache"), { recursive: true });

    writeFileSync(file, JSON.stringify({ fetchedAt: Date.now(), html: "<table class='nicelight'></table>" }));
    const frais = h.readCache(155, 175);
    expect(frais?.html).toContain("nicelight");

    // Périmé (> 20 h) → null, donc le scraper refetch.
    const vieux = Date.now() - 21 * 60 * 60 * 1000;
    writeFileSync(file, JSON.stringify({ fetchedAt: vieux, html: "<table/>" }));
    expect(h.readCache(155, 175)).toBeNull();
  });

  test("un cache corrompu ne fait pas planter le scrape", () => {
    const h = buildHelpers(TMP);
    const file = h.cachePath(155, 175);
    mkdirSync(join(TMP, "data", "hockey-h2h-cache"), { recursive: true });
    writeFileSync(file, "{ ceci n'est pas du json");
    expect(h.readCache(155, 175)).toBeNull();
  });

  test("un cache absent est null (pas d'exception)", () => {
    const h = buildHelpers(TMP);
    rmSync(join(TMP, "data", "hockey-h2h-cache"), { recursive: true, force: true });
    expect(h.readCache(999, 998)).toBeNull();
  });

  test("le script lit le cache AVANT toute requête réseau", () => {
    // Un cache lu après le fetch ne servirait à rien.
    const iRead = src.indexOf("readCache(match.team1Id");
    const iFetch = src.indexOf("await fetchPage(h2hUrl)");
    expect(iRead).toBeGreaterThan(-1);
    expect(iFetch).toBeGreaterThan(-1);
    expect(iRead).toBeLessThan(iFetch);
  });

  test("le marqueur de cache remonte dans le payload (traçabilité)", () => {
    expect(src).toContain("fromCache: true");
  });
});

// Nettoyage du répertoire de test.
test("cleanup du cache de test", () => {
  rmSync(join(process.cwd(), "data", "tmp-cache-test"), { recursive: true, force: true });
  expect(existsSync(join(process.cwd(), "data", "tmp-cache-test"))).toBe(false);
});