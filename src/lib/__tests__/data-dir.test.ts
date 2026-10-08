// Résolution des fichiers data/ : deux racines vivantes en prod, copie de build
// en DERNIER recours. Voir `src/lib/data-dir.ts` pour le contexte mesuré.

import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join, isAbsolute } from "path";
import { dataDirCandidates, getDataPath, resolveDataFile } from "../data-dir";

const created: string[] = [];
const savedEnv = process.env.DATA_DIR;
const savedCwd = process.cwd();

/** Racine temporaire dont `data/` contient les fichiers nommés `files`. */
function rootWith(...files: string[]): string {
  const root = mkdtempSync(join(tmpdir(), "datadir-"));
  created.push(root);
  mkdirSync(join(root, "data"), { recursive: true });
  for (const f of files) writeFileSync(join(root, "data", f), "{}");
  return root;
}

function chdir(dir: string) {
  process.chdir(dir);
}

afterEach(() => {
  if (savedEnv === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = savedEnv;
  try {
    chdir(savedCwd);
  } catch {
    // cwd supprimé → sans conséquence
  }
  for (const d of created.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe("resolveDataFile — racine vivante", () => {
  test("trouve un fichier sous DATA_DIR", () => {
    const root = rootWith("snap");
    process.env.DATA_DIR = join(root, "data");
    expect(resolveDataFile("snap")).toBe(join(root, "data", "snap"));
  });

  test("DATA_DIR sans le fichier → bascule sur le data/ du cwd", () => {
    const withData = rootWith("snap");
    const other = rootWith("snap2");
    process.env.DATA_DIR = join(other, "data");
    chdir(withData);
    expect(resolveDataFile("snap")).toBe(join(withData, "data", "snap"));
  });

  test("file absent partout → null (jamais de throw)", () => {
    const root = rootWith("snap");
    process.env.DATA_DIR = join(root, "data");
    expect(resolveDataFile("inexistant.json")).toBeNull();
  });

  test("DATA_DIR vide → ignoré, on retombe sur cwd", () => {
    const root = rootWith("snap");
    process.env.DATA_DIR = "";
    chdir(root);
    expect(resolveDataFile("snap")).toBe(join(root, "data", "snap"));
  });
});

describe("dataDirCandidates — la copie de build passe EN DERNIER", () => {
  test("cwd sous .next/standalone : le data/ du dépôt gagne sur la copie", () => {
    // Reproduit le runtime : <repo>/.next/standalone/data (copie du build) et
    // <repo>/data (vivant). Les DEUX contiennent le fichier → le vivant gagne.
    const repo = rootWith("snap");
    const standalone = join(repo, ".next", "standalone");
    mkdirSync(join(standalone, "data"), { recursive: true });
    writeFileSync(join(standalone, "data", "snap"), "{}");
    delete process.env.DATA_DIR;
    chdir(standalone);

    expect(resolveDataFile("snap")).toBe(join(repo, "data", "snap"));

    const candidates = dataDirCandidates();
    const iLive = candidates.indexOf(join(repo, "data"));
    const iCopy = candidates.indexOf(join(standalone, "data"));
    expect(iLive).toBeGreaterThanOrEqual(0);
    expect(iCopy).toBeGreaterThanOrEqual(0);
    expect(iLive).toBeLessThan(iCopy);
  });

  test("sans racine vivante, la copie de build reste le repli (ne casse rien)", () => {
    const repo = mkdtempSync(join(tmpdir(), "datadir-"));
    created.push(repo);
    const standalone = join(repo, ".next", "standalone");
    mkdirSync(join(standalone, "data"), { recursive: true });
    writeFileSync(join(standalone, "data", "snap"), "{}");
    delete process.env.DATA_DIR;
    chdir(standalone);

    expect(resolveDataFile("snap")).toBe(join(standalone, "data", "snap"));
  });

  test("DATA_DIR prime sur tout, y compris sur la copie de build", () => {
    const repo = rootWith("snap");
    const standalone = join(repo, ".next", "standalone");
    mkdirSync(join(standalone, "data"), { recursive: true });
    writeFileSync(join(standalone, "data", "snap"), "{}");
    const envRoot = rootWith("snap");
    process.env.DATA_DIR = join(envRoot, "data");
    chdir(standalone);
    expect(resolveDataFile("snap")).toBe(join(envRoot, "data", "snap"));
  });

  test("aucun doublon dans la liste des racines", () => {
    const root = rootWith("snap");
    process.env.DATA_DIR = join(root, "data");
    chdir(root);
    const c = dataDirCandidates();
    expect(new Set(c).size).toBe(c.length);
  });
});

describe("getDataPath — sémantique DATA_DIR || cwd/data (inchangée)", () => {
  test("avec DATA_DIR", () => {
    process.env.DATA_DIR = join(tmpdir(), "dd-test");
    expect(getDataPath("x.json")).toBe(join(process.env.DATA_DIR, "x.json"));
  });

  test("sans DATA_DIR → cwd/data", () => {
    delete process.env.DATA_DIR;
    expect(getDataPath("x.json")).toBe(join(process.cwd(), "data", "x.json"));
  });

  test("le chemin est absolu (jamais relatif au cwd courant)", () => {
    // `isAbsolute` et non `startsWith(sep)` : sous Windows un chemin absolu
    // commence par la lettre de lecteur (`C:\…`), pas par un séparateur.
    process.env.DATA_DIR = join(tmpdir(), "dd-test");
    expect(isAbsolute(getDataPath(join("a", "b.json")))).toBe(true);
  });
});