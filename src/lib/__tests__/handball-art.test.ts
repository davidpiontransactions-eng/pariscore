import { describe, expect, test } from "bun:test";
import {
  HANDBALL_ARTS,
  HANDBALL_ART_BLUE,
  handballArtSrc,
} from "../handball-art";

// Le manifeste est la source UNIQUE des chemins d'assets. Les composants ne
// référencent jamais un fichier en dur, donc une dérive ici casserait le rendu
// sans que TypeScript la voie : c'est ce fichier qui la détecte.
describe("manifeste des illustrations 3D handball", () => {
  test("2 sujets déclarés, slugs uniques", () => {
    expect(HANDBALL_ARTS).toHaveLength(2);
    expect(new Set(HANDBALL_ARTS.map((a) => a.slug)).size).toBe(2);
  });

  test("chaque sujet a un alt non vide et des dimensions 16:9", () => {
    // Le ratio est celui des rendus fournis : préservé pour ne pas rogner le
    // joueur en plein vol. `object-position` cadre, pas un resize.
    for (const a of HANDBALL_ARTS) {
      expect(a.alt.length).toBeGreaterThan(10);
      expect(a.width / a.height).toBeCloseTo(16 / 9, 2);
    }
  });

  test("l'alt décrit le SUJET, pas l'image (« une image de… »)", () => {
    // Accessibilité : un lecteur d'écran doit annoncer ce qui est représenté.
    for (const a of HANDBALL_ARTS) {
      expect(a.alt).not.toMatch(/^(une )?image/i);
      expect(a.alt).toMatch(/handball/i);
    }
  });

  test("chaque sujet porte un point de cadrage explicite", () => {
    // `right` = le texte occupe la gauche ; `center` = image d'état.
    for (const a of HANDBALL_ARTS) {
      expect(["right", "center"]).toContain(a.focus);
    }
  });

  test("src() respecte la largeur demandée", () => {
    expect(handballArtSrc(HANDBALL_ART_BLUE, "banner")).toBe(
      "/handball-art/extension-bleu-1600.webp",
    );
    expect(handballArtSrc(HANDBALL_ART_BLUE, "card")).toBe(
      "/handball-art/extension-bleu-800.webp",
    );
    expect(handballArtSrc(HANDBALL_ART_BLUE, "badge")).toBe(
      "/handball-art/extension-bleu-256.webp",
    );
  });

  test("src() par défaut = bannière", () => {
    expect(handballArtSrc(HANDBALL_ART_BLUE)).toBe(handballArtSrc(HANDBALL_ART_BLUE, "banner"));
  });
});