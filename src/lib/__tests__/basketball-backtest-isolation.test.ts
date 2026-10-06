import { describe, expect, test } from "bun:test";
import fs from "node:fs";
import path from "node:path";

/**
 * P5 — étanchéité du backtest au biais d'anticipation (look-ahead).
 *
 * Constat de la cartographie (2026-10-06) : la fuite temporelle vit dans
 * `services/basketballService.js` — Elo rejoué jusqu'à aujourd'hui, `form_l10`
 * dérivé du même fichier, `last_game` pouvant être postérieur au match,
 * standings sur la saison entière. Ces quatre lectures ne portent AUCUNE borne
 * de date.
 *
 * La route de backtest n'utilise PAS ce chemin : elle lit
 * `basketball_match_history` (dates + scores) et fait glisser une fenêtre.
 * Ce test verrouille cette isolation — y compris TRANSITIVEMENT : le risque
 * n'est pas que la route importe `basketballService`, c'est qu'un module de sa
 * chaîne l'importe.
 *
 * Sans ce test, un futur refactor pourrait brancher `computeNbaWinProb` dans le
 * backtest « pour avoir de meilleures probas » et reintroduire la fuite en
 * silence : le ROI afficherait un vert qu'aucune mesure ne justifie.
 */

const ROOT = process.cwd();
const ROUTE = path.join(ROOT, "src", "app", "api", "basketball", "backtest", "route.ts");

/** Modules dont la présence dans la fermeture d'imports casse l'étanchéité. */
const FORBIDDEN = ["basketballService", "nba_elo", "form_l10", "last_game"];

/** Extrait les chemins d'import (statiques + dynamiques) d'un fichier TS. */
function importsOf(file: string): string[] {
  const src = fs.readFileSync(file, "utf8");
  const out: string[] = [];
  // from "@/lib/x" · from "./y" · import("./z")
  const re = /(?:from\s+|import\s*\(\s*)["']([^"']+)["']/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) out.push(m[1]);
  return out;
}

/** Résout un spec d'import vers un fichier disque, ou null (externe/absent). */
function resolveImport(fromFile: string, spec: string): string | null {
  let base: string;
  if (spec.startsWith("@/")) base = path.join(ROOT, "src", spec.slice(2));
  else if (spec.startsWith(".")) base = path.resolve(path.dirname(fromFile), spec);
  else return null; // package npm — hors fermeture applicative

  for (const cand of [`${base}.ts`, `${base}.tsx`, path.join(base, "index.ts"), path.join(base, "index.tsx")]) {
    if (fs.existsSync(cand) && fs.statSync(cand).isFile()) return cand;
  }
  return null;
}

/** Fermeture d'imports (BFS borné). Inclus le point de départ. */
function importClosure(entry: string, maxDepth = 6): { files: string[]; truncated: boolean } {
  const seen = new Set<string>();
  const queue: Array<{ file: string; depth: number }> = [{ file: entry, depth: 0 }];
  let truncated = false;

  while (queue.length) {
    const { file, depth } = queue.shift()!;
    if (seen.has(file)) continue;
    seen.add(file);
    if (depth >= maxDepth) {
      truncated = true;
      continue;
    }
    for (const spec of importsOf(file)) {
      const resolved = resolveImport(file, spec);
      if (resolved && !seen.has(resolved)) queue.push({ file: resolved, depth: depth + 1 });
    }
  }
  return { files: [...seen], truncated };
}

describe("P5 — le backtest ne consomme aucune métrique temps présent", () => {
  test("la route existe (sinon les contrôles suivants ne prouvent rien)", () => {
    expect(fs.existsSync(ROUTE)).toBe(true);
  });

  test("aucun module de la fermeture d'imports n'atteint basketballService", () => {
    // C'est LE contrôle : direct ET transitif. La route importe la
    // calibration et le lecteur d'historique — si l'un d'eux venait à
    // importer le service (standings, Elo, form), la fuite reviendrait.
    const { files, truncated } = importClosure(ROUTE);
    expect(files.length, "fermeture trop petite — résolution d'import cassée").toBeGreaterThan(2);
    // Borné : au-delà, le BFS s'arrête. On signale plutôt que de conclure
    // à tort sur un sous-ensemble tronqué.
    expect(truncated, "profondeur 6 atteinte — porte de sortie non vérifiée").toBe(false);

    const infracteurs = files.filter((f) => {
      const rel = path.relative(ROOT, f).replace(/\\/g, "/");
      if (rel === "services/basketballService.js") return true;
      if (!rel.startsWith("src/")) return false;
      const src = fs.readFileSync(f, "utf8");
      return FORBIDDEN.some((k) => src.includes(k));
    });

    expect(
      infracteurs.map((f) => path.relative(ROOT, f).replace(/\\/g, "/")),
      "un module reachable depuis le backtest lit du temps présent",
    ).toEqual([]);
  });

  test("la route lit l'historique SQLite, pas le service temps réel", () => {
    const src = fs.readFileSync(ROUTE, "utf8");
    expect(src).toContain("loadBasketballHistory");
    // Aucun symbole du service temps réel ne doit y apparaître — même en
    // commentaire, sinon un copier-coller futur le réintroduirait.
    for (const sym of ["basketballService", "computeNbaWinProb", "_normalizeEvent", "computeNbaTotal", "computeNbaRecentForm"]) {
      expect(src, `${sym} présent dans le backtest`).not.toContain(sym);
    }
  });

  test("ordre anti-fuite : évaluation AVANT mise à jour de la fenêtre", () => {
    // L'invariant structurel. Si l'ordre s'inverse, la fenêtre contient le
    // match qu'on est en train de prédire — fuite invisible dans les chiffres.
    const src = fs.readFileSync(ROUTE, "utf8");
    const evalIdx = src.indexOf('add("home-win"');
    const updateIdx = src.indexOf("A.pf.push(");
    expect(evalIdx, "marqueur d'évaluation introuvable").toBeGreaterThan(0);
    expect(updateIdx, "marqueur de mise à jour introuvable").toBeGreaterThan(0);
    expect(evalIdx, "la mise à jour précède l'évaluation — fuite").toBeLessThan(updateIdx);
    // Et le commentaire d'intention doit rester : c'est lui qui empêche un
    // futur « optimisation » de réordonner le bloc.
    expect(src).toContain("anti-fuite");
  });
});
