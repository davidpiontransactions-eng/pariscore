/**
 * Formatage horaire MMA — source unique, fuseau explicite.
 *
 * Pourquoi ce module existe : l'onglet MMA avait deux formateurs d'heure
 * divergents et aucun ne fixait de fuseau.
 *   - `date-fns` `format(parseISO(iso), "MMM d, yyyy · HH:mm")` formate dans le
 *     fuseau du RUNTIME : le SSR (VPS = UTC) affiche UTC, le client (Paris)
 *     affiche Paris => deux rendus differents pour le meme combat, et un
 *     mismatch d'hydratation. Le format etait en outre anglais ("Oct 3, 2026")
 *     dans une interface francaise.
 *   - `toLocaleString("fr-FR", …)` sans `timeZone` suffer du meme defaut.
 *
 * `timeZone: "Europe/Paris"` rend le resultat identique cote serveur et cote
 * client : le combat d'UFC 322 a 23:30 UTC s'affiche 01:30 le lendemain,
 * qu'on soit en local ou en prod. L'heure d'ete (UTC+2) est prise en compte
 * automatiquement par Intl — pas de tableau de decalage a maintenir.
 */

/** Singleton Intl — évite de recréer le formateur à chaque render. */
const fightTimeFmt = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Europe/Paris",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

const gridTimeFmt = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Europe/Paris",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

/**
 * Date + heure Paris pour la carte de combat.
 * Retourne l'ISO brut si la date est illisible, comme le font les autres
 * formateurs du projet (pas d'exception : un libellé moche vaut mieux qu'un
 * onglet cassé).
 */
export function formatFightTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return fightTimeFmt.format(d).replace(",", " ·");
}

/** Date + heure Paris compactes pour la grille 1xBet. Vide si illisible. */
export function formatGridTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return gridTimeFmt.format(d);
}

/** Cle de jour Paris ("YYYY-MM-DD") — pour le groupement du calendrier. */
const parisDayFmt = new Intl.DateTimeFormat("fr-CA", {
  timeZone: "Europe/Paris",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function parisDayKey(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return parisDayFmt.format(d);
}