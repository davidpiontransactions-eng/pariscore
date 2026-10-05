/**
 * Résolution des statistiques d'équipe hockey pour le modèle Poisson.
 *
 * ⚠️ POURQUOI CE FICHIER EXISTE — bug P3.1, mesuré le 2026-10-05.
 *
 * `/api/hockey/prediction` calculait ses buts comme
 * `gf = w * 2.8 + otw * 2.5`, parce que les standings Annabet
 * (`h2h.standings`) ne contiennent QUE `{w, otw, otl, l, pts}` — **aucun
 * buts marqués, aucun buts encaissés**. La valeur 2.8 était un chiffre choisi à la
 * main, et elle remontait ensuite dans `predictedHome` / `predictedAway`
 * comme si c'était une mesure.
 *
 * Ce que la formule produisait réellement sur les données du jour :
 *   Detroit vs Winnipeg   -> gf/ga 0-3 / 0-3   (0 but marqué pour Detroit)
 *   NY Rangers vs Utah    -> gf/ga 6-3 / 6-0   (0 encaissé pour Utah)
 *   Anaheim vs Florida    -> gf/ga 3-0 / 3-3
 * Un `gf = 0` n'est pas une imprécision, c'est un modèle dégénéré : la
 * prédiction Poisson devient « l'équipe marque 0 but ».
 *
 * La règle du projet est sans appel : une absence se voit, une valeur
 * inventée se prend pour une mesure. Donc ici, pas de gf/ga réel → pas de
 * prédiction du tout.
 */

/** Colonnes minimales d'un classement réel. */
export type RealStanding = {
  name: string;
  gp: number;
  /** Buts marqués RÉELS. */
  gf: number;
  /** Buts encaissés RÉELS. */
  ga: number;
};

/** Contrat attendu par le modèle Poisson (src/lib/prediction/hockey/poisson). */
export type HockeyTeamStats = {
  name: string;
  gp: number;
  gf: number;
  ga: number;
  home?: { gf: number; ga: number; gp: number };
  away?: { gf: number; ga: number; gp: number };
};

/**
 * Normalise un nom pour la comparaison.
 *
 * NFD + suppression des diacritiques, comme `normHandballName` dans
 * handball-logos.ts : sans la décomposition, `.replace(/[^a-z]/g, "")` EFFACE
 * la lettre accentuée au lieu de la translittérer, et « MÉTALLURG » devenait
 * « mtallurg » — qui ne matche plus « metallurg ». Testé et vérifié.
 */
function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
}

/** Longueur minimale d'un nom pour la comparaison fuzzy. */
const MIN_NAME = 5;

/**
 * Statistiques réelles d'une équipe dans un classement, ou `null`.
 *
 * `null` si l'équipe n'y est pas — et c'est tout. Aucun repli, aucune
 * estimation, aucun but déduit du nombre de victoires.
 *
 * Le garde-fou `≥ 5 caractères` sur le nom le plus court n'est pas décoratif :
 * sans lui, un nom de 2 lettres matcherait n'importe quelle équipe (le même
 * piège que dans `handball-logos.ts` et `odds-handball-papi.ts`).
 *
 * `home` / `away` restent `undefined` : le classement eliteprospects est
 * GLOBAL, et les splits Annabet `{home, away}` ne contiennent pas plus de buts
 * que `all`. Remplir ce contrat avec le global ferait passer un cumul pour un
 * split.
 */
export function resolveRealTeamStats(
  teamName: string,
  teams: readonly RealStanding[],
): HockeyTeamStats | null {
  const target = norm(teamName);
  if (target.length < MIN_NAME) return null;

  const found = teams.find((t) => {
    const n = norm(t.name);
    if (n.length < MIN_NAME || Math.min(n.length, target.length) < MIN_NAME) return false;
    return n.includes(target) || target.includes(n);
  });
  if (!found) return null;

  return {
    name: found.name,
    gp: found.gp,
    gf: found.gf,
    ga: found.ga,
    home: undefined,
    away: undefined,
  };
}