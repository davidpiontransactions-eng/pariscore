// Garde-fou CSS du débordement horizontal (viewport 375-430 px).
//
// Cette machine ne peut plus lancer Chromium (timeout 180 s sur
// chrome-headless-shell ET sur le Chrome installé — cf. logs/capture.txt),
// donc la mesure « scrollWidth > clientWidth » n'est pas jouable ici. À la
// place on verrouille les INVARIANTS CSS dont l'absence produit exactement ce
// symptôme. Ils sont vérifiés sur le texte source : c'est une régression
// détectable en CI, pas une mesure de rendu.
//
// Les 3 fautifs historiques, tous vérifiés ici :
//   1. un ITEM de grille sans `min-w-0` ne peut pas rétrécir sous la largeur de
//      son contenu (minimum `auto`) → la piste `grid-cols-1` dépasse le viewport ;
//   2. une grille `w-full` sans `max-w-full` laisse un descendant large
//      déborder la page entière (c'est ce qui décalait toute la page sur la
//      capture mobile) ;
//   3. un `min-w-[Npx]` en pleine largeur sans ancêtre `overflow-x-auto` casse
//      le rail (le conteneur déborde au lieu de défiler).

import { describe, expect, test } from "bun:test";
import fs from "fs";
import path from "path";

const ROOT = process.cwd();

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

/** Retire les commentaires : un invariant cité en commentaire ne prouve rien. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
}

/**
 * Vrai si `cls` est présent comme TOKEN de classe Tailwind.
 *
 * Deux pièges vérifiés un par un sur ce fichier :
 *   - `expect(src).toContain("min-w-0")` matchait aussi `min-w-0-PROBE` → le
 *     test est resté vert sur une classe corrompue ;
 *   - les frontières par token laissaient passer le MÊME nom cité dans un
 *     commentaire Markdown (`**\`min-w-0\`** : item de grille`) → d'où le
 *     `stripComments` en amont.
 */
function hasClass(src: string, cls: string): boolean {
  const code = stripComments(src);
  const escaped = cls.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[\\s"'\`])(${escaped})(?=$|[\\s"'\`])`, "m").test(code);
}

/** Tous les .tsx de src/components/tennis + le layout de la page sport. */
function tennisComponentFiles(): string[] {
  const acc: string[] = [];
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.tsx$/.test(e.name)) acc.push(path.relative(ROOT, p).replace(/\\/g, "/"));
    }
  };
  walk(path.join(ROOT, "src/components/tennis"));
  return acc;
}

describe("BentoGrid / BentoTile — invariants de largeur", () => {
  const grid = read("src/components/ui/bento-grid.tsx");
  const tile = grid.slice(grid.indexOf("export function BentoTile"));

  test("BentoGrid se borne à la largeur de son parent", () => {
    expect(hasClass(grid, "w-full")).toBe(true);
    expect(hasClass(grid, "min-w-0")).toBe(true);
    expect(hasClass(grid, "max-w-full")).toBe(true);
  });

  test("BentoGrid borne le débordement sans casser position: sticky", () => {
    // `overflow-x-hidden` crée un conteneur de défilement : les descendants
    // `sticky` cessent de s'y accrocher. `overflow-x-clip` ne le fait pas.
    expect(hasClass(grid, "overflow-x-clip")).toBe(true);
    expect(hasClass(grid, "overflow-x-hidden")).toBe(false);
  });

  test("BentoTile porte min-w-0 (item de grille rétrécissable)", () => {
    expect(hasClass(tile, "min-w-0")).toBe(true);
  });

  test("BentoTile réduit son padding sur mobile", () => {
    // `p-6` seul = 48 px de padding horizontal, soit 13 % d'un écran 375 px.
    expect(hasClass(tile, "p-4")).toBe(true);
    expect(hasClass(tile, "sm:p-6")).toBe(true);
    expect(hasClass(tile, "p-6")).toBe(false);
  });
});

describe("Onglet Tennis — aucun débordement horizontal possible", () => {
  const files = tennisComponentFiles();

  test("la liste des composants est bien résolue (garde anti-faux-vert)", () => {
    expect(files.length).toBeGreaterThan(10);
  });

  test("aucun min-w-[Npx] en pleine largeur sans ancêtre overflow-x", () => {
    const coupables: string[] = [];
    for (const f of files) {
      const src = read(f);
      for (const line of src.split(/\r?\n/)) {
        if (!/min-w-\[\d+px\]/.test(line)) continue;
        // Les lignes de tableau doivent être dans un wrapper `overflow-x-auto`
        // (desktop) : on vérifie que le fichier EN CONTIENT un, sinon la largeur
        // minimale n'a aucune chance de défiler.
        if (!/overflow-x-auto|overflow-x-scroll/.test(src)) {
          coupables.push(`${f}: ${line.trim().slice(0, 90)}`);
        }
      }
    }
    expect(coupables).toEqual([]);
  });

  test("aucune largeur fixe de grille > 320px hors rail défilant", () => {
    // `grid-cols-[1fr_360px]` sur mobile déborde ; le motif helical
    // `grid-cols-[1fr_auto_1fr]` est sûr (auto suit le contenu court).
    const coupables: string[] = [];
    for (const f of files) {
      const src = read(f);
      for (const m of src.matchAll(/grid-cols-\[([^\]]+)\]/g)) {
        const cols = m[1];
        for (const c of cols.split(/\s+/)) {
          const px = /^(\d+)px$/.exec(c);
          if (!px) continue;
          const value = Number(px[1]);
          if (value > 320) {
            coupables.push(`${f}: grid-cols-[${cols}]`);
            break;
          }
        }
      }
    }
    expect(coupables).toEqual([]);
  });
});

describe("Widget Top 10 Tennis — rail de filtres mobile", () => {
  const src = read("src/components/tennis/tennis-top10-matches-widget.tsx");

  test("la barre de filtres défile sur mobile et se replie sur desktop", () => {
    expect(hasClass(src, "overflow-x-auto")).toBe(true);
    expect(hasClass(src, "scrollbar-none")).toBe(true);
    // Retour au flux normal à partir de sm.
    expect(
      hasClass(src, "sm:overflow-x-visible") || hasClass(src, "sm:flex-wrap"),
    ).toBe(true);
  });

  test("les sélecteurs à largeur fixe ne rétrécissent pas dans le rail", () => {
    // Sans `shrink-0`, un `w-[180px]` dans un flex scrollant s'écrase au lieu de
    // faire défiler : on obtient des libellés illisibles.
    const triggers = src.match(/w-\[\d+px\][^"]*"/g) ?? [];
    expect(triggers.length).toBeGreaterThan(3);
    for (const t of triggers) expect(hasClass(t, "shrink-0")).toBe(true);
  });

  test("la racine du widget est bornée en largeur", () => {
    expect(hasClass(src, "w-full")).toBe(true);
    expect(hasClass(src, "min-w-0")).toBe(true);
    expect(hasClass(src, "max-w-full")).toBe(true);
  });
});