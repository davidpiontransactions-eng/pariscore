// Tests du headshot officiel HBL (Sportradar person.images) — prioritaire
// sur Wikipedia dans les popups, extrait par pickHeadshot (scrape-hbl-players).
import { describe, expect, test } from "bun:test";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { pickHeadshot } = require("../../../scripts/scrape-hbl-players.js") as {
  pickHeadshot: (images?: { url?: string; imageType?: string }[]) => string | undefined;
};

describe("pickHeadshot — images officielles Sportradar", () => {
  const waist = {
    imageType: "PERSON_WAIST",
    url: "https://images.dc.connect.sportradar.com/h1s44/buste.png",
  };
  const face = {
    imageType: "PERSON_FACE",
    url: "https://images.dc.connect.sportradar.com/h1s44/visage.png",
  };

  test("PERSON_WAIST privilégié quel que soit l'ordre", () => {
    expect(pickHeadshot([face, waist])).toBe(waist.url);
    expect(pickHeadshot([waist, face])).toBe(waist.url);
  });

  test("sans WAIST → première image pourvue d'une URL http", () => {
    expect(pickHeadshot([face])).toBe(face.url);
    expect(pickHeadshot([{ imageType: "X" }, face])).toBe(face.url);
  });

  test("cas limites : vide, absente, URL invalide → undefined", () => {
    expect(pickHeadshot([])).toBeUndefined();
    expect(pickHeadshot(undefined)).toBeUndefined();
    expect(pickHeadshot([{ imageType: "PERSON_WAIST" }])).toBeUndefined();
    expect(pickHeadshot([{ url: "ftp://x" }])).toBeUndefined();
  });
});
