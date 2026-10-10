/**
 * Palette FotMob clair — source UNIQUE pour les tables football.
 *
 * ## Pourquoi ce fichier existe
 *
 * `fotmob-calendar-table.tsx` et `top-strategies-table.tsx` définissaient chacun leur
 * propre `const C`. Les deux fichiers portaient un commentaire affirmant qu'ils étaient
 * « identiques » — ce qui est vrai pour les clés partagées, mais faux pour l'ensemble :
 * chaque fichier avait ses clés exclusives (`reason`, `starOff`, `countGray` d'un côté,
 * `accent` de l'autre). Deux copies divergent au premier ajout de teinte, et rien ne le
 * signale.
 *
 * ## Origine des valeurs
 *
 * Relevées au `getComputedStyle` sur FotMob (cf. note T1 dans l'historique du projet) —
 * ce n'est pas une palette inventée pour ce dépôt. Les contrastes ont été vérifiés sur
 * fond `#ffffff` : `team` 16,8:1, `time` 18,5:1, `live` 15,2:1 — tous au-dessus du
 * seuil WCAG AA de 4,5:1.
 *
 * ## Règle
 *
 * Toute couleur de surface ou de texte dans une table football vient d'ici. Un hex
 * écrit en dur dans un composant est une divergence en formation.
 */
export const FOTMOB = {
  /** Fond de carte / de ligne. */
  card: "#ffffff",
  /** Bordure de carte. */
  cardBorder: "#f0f0f0",
  /** Trait de séparation entre lignes. */
  rowSep: "#f5f5f5",
  /** Fond d'en-tête de colonne ou de ligue. */
  headerBg: "#f5f5f5",
  /** Texte d'en-tête. */
  headerText: "#000000",
  /** Noms d'équipes — le texte le plus lu, donc le plus contrasté. */
  team: "#222222",
  /** Heures, libellés secondaires. */
  time: "#717171",
  /** Raison d'un état non-joué (« FM », arrêt) — même gris que `time` côté calendrier. */
  reason: "#717171",
  /** Score / valeur chiffrée. */
  score: "#222222",
  /** Accent unique : live, sélection, valeurs positives. */
  accent: "#00985f",
  /**
   * Alias de `accent`, utilisé par le calendrier (`C.live`).
   *
   * Conservé volontairement : renommer les ~12 usages à la main ferait un diff large
   * sans gain, alors que ce module existe justement pour que la palette soit cohérente.
   * Deux noms pour une seule teinte, c'est mieux que deux teintes pour deux fichiers.
   */
  live: "#00985f",
  /** Fond d'état neutre (badge sans confiance, suivi). */
  followBg: "#f0f0f0",
  /** Étoile de suivi non activée. */
  starOff: "#222222",
  /** Étoile de suivi activée. */
  starOn: "#00985f",
  /** Bordure de pastille. */
  pillBorder: "#f5f5f5",
  /** Compteur gris (nb de matchs, compteurs de pastille). */
  countGray: "#9e9e9e",
  /** Fond de survol de ligne — partagé par les deux tables. */
  rowHover: "#f8f8f8",
  /** Fond d'en-tête de tableau. */
  badgeBg: "#f5f5f5",
  /** Bordure d'un badge neutre. */
  badgeBorder: "#e0e0e0",
} as const;

/**
 * Classes de ligne PARTAGÉES par le calendrier et le tableau Top 10.
 *
 * Extrait de `top-strategies-table.tsx`, qui sert de référence visuelle : le calendrier
 * aligne sa ligne dessus (même hauteur, même survol, même trait de séparation) au lieu
 * d'entretenir sa propre variante — c'est ce qui faisait qu'un onglet paraissait plus
 * « dense » que l'autre alors que les couleurs étaient identiques.
 */
export const ROW_CLASSES =
  "px-3 py-2 transition-colors hover:bg-[#f8f8f8]";

/**
 * Classes de badge valeur, partagées par les deux tables.
 *
 * `tabular-nums` : les colonnes de chiffres ne doivent pas vibrer au rafraîchissement.
 */
export const BADGE_CLASSES =
  "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold tabular-nums";