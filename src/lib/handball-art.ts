/**
 * Manifeste des illustrations 3D de l'onglet Handball.
 *
 * ⚠️ FONDS OPAQUES, PAS D'ALPHA. Les rendus fournis (2026-10-04) portent une
 * arène floutée en arrière-plan. C'est une information, pas un défaut : la
 * composition devient **pleine largeur + dégradé d'estompage par-dessus**, ce
 * qui est la spec initiale. On avait d'abord conçu le joueur détouré à droite
 * (donc alpha) ; ce manifesto documente le basculement et sa raison.
 *
 * Conséquence : le chroma-key de `scripts/gen-handball-art.mjs` ne sert plus à
 * ces deux-là. Le script restant produit des VARIANTES de format à partir des
 * fichiers déposés dans `public/handball-art/source/`.
 *
 * Les composants ne référencent aucun fichier en dur : tout passe par ici.
 */

/** Un asset d'illustration. */
export type HandballArt = {
  slug: string;
  /** Décrit le SUJET, jamais « une image de… » — lu par les lecteurs d'écran. */
  alt: string;
  /** Dimensions intrinsèques, évite tout layout shift (CLS). */
  width: number;
  height: number;
  /**
   * Position du sujet dans le cadre. `right` pour une composition qui laisse
   * le texte à gauche, `center` pour une image de-state.
   */
  focus: "right" | "center";
};

/** Attaquant en extension, maillot rouge #13. */
export const HANDBALL_ART_RED: HandballArt = {
  slug: "extension-rouge",
  alt: "Joueur de handball en plein vol, ballon au-dessus de la tête, maillot rouge numéro 13",
  width: 1600,
  height: 900,
  focus: "right",
};

/** Joueur barbu en extension, maillot bleu #13. */
export const HANDBALL_ART_BLUE: HandballArt = {
  slug: "extension-bleu",
  alt: "Joueur de handball barbu en vol lors d'un tir en extension, maillot bleu numéro 13",
  width: 1600,
  height: 900,
  focus: "right",
};

export const HANDBALL_ARTS: readonly HandballArt[] = [HANDBALL_ART_RED, HANDBALL_ART_BLUE];

export type HandballArtSize = "banner" | "card" | "badge";

/**
 * URL d'une illustration à la largeur demandée.
 *
 * Le rendu est en pleine largeur : la hauteur suit le ratio du fichier
 * (16:9), pas un recadrage. Un `object-position` piloté par `focus` gère le
 * cadrage, pas un `resize` — rogner le joueur en plein vol serait pire.
 *
 * Pas de `srcSet` ici : `next/image` le construit depuis `sizes` + la config
 * `deviceSizes`. Un srcset artisanal entrerait en conflit avec le loader.
 */
export function handballArtSrc(art: HandballArt, size: HandballArtSize = "banner"): string {
  const w = size === "banner" ? 1600 : size === "card" ? 800 : 256;
  return `/handball-art/${art.slug}-${w}.webp`;
}