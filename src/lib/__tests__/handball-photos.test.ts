// Tests du loader de photos handball (snapshot Wikipedia) — normalisation,
// fallback null, DATA_DIR injectable.
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  clearHandballPhotoCache,
  handballPhotosMeta,
  handballPlayerPhoto,
  photoKey,
} from "../handball-photos";

const originalDataDir = process.env.DATA_DIR;
let dir = "";

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "hb-photos-"));
  process.env.DATA_DIR = dir;
  clearHandballPhotoCache();
});

afterEach(() => {
  if (originalDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = originalDataDir;
  clearHandballPhotoCache();
  if (dir && existsSync(dir)) rmSync(dir, { recursive: true, force: true });
});

function writeFixture(photos: Record<string, { url: string }>, extra: Record<string, unknown> = {}) {
  writeFileSync(
    path.join(dir, "handball-player-photos.json"),
    JSON.stringify({ scrapedAt: "2026-09-25T10:00:00.000Z", source: "wikipedia", photos, ...extra }),
    "utf8"
  );
  clearHandballPhotoCache();
}

describe("photoKey", () => {
  test("normalisation identique à teamKey (casse, diacritiques, ponctuation)", () => {
    expect(photoKey("Mathias Gidsel")).toBe("mathiasgidsel");
    expect(photoKey("Mikkel Hansen")).toBe("mikkelhansen");
    expect(photoKey("O'Rourke, Sean")).toBe("orourkesean");
    expect(photoKey("  Antun  Palic  ")).toBe("antunpalic");
  });
});

describe("handballPlayerPhoto", () => {
  test("snapshot absent → null (initiales côté UI)", () => {
    expect(handballPlayerPhoto("Mathias Gidsel")).toBeNull();
    expect(handballPhotosMeta()).toBeNull();
  });

  test("résolu par nom normalisé, miss → null", () => {
    writeFixture({
      mathiasgidsel: { url: "https://upload.wikimedia.org/x/200px-Gidsel.jpg" },
    });
    expect(handballPlayerPhoto("Mathias Gidsel")).toBe(
      "https://upload.wikimedia.org/x/200px-Gidsel.jpg"
    );
    expect(handballPlayerPhoto("mathias gidsel")).toBe(
      "https://upload.wikimedia.org/x/200px-Gidsel.jpg"
    );
    expect(handballPlayerPhoto("Joueur Inconnu")).toBeNull();
  });

  test("meta expose fraîcheur + compte", () => {
    writeFixture({ a: { url: "u" }, b: { url: "v" } }, { misses: ["c", "d"] });
    const meta = handballPhotosMeta();
    expect(meta?.count).toBe(2);
    expect(meta?.misses).toBe(2);
    expect(meta?.scrapedAt).toBe("2026-09-25T10:00:00.000Z");
  });

  test("fichier corrompu → null sans crash", () => {
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, "handball-player-photos.json"), "{pas du json", "utf8");
    clearHandballPhotoCache();
    expect(handballPlayerPhoto("X")).toBeNull();
  });
});
