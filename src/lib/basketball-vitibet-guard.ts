/**
 * basketball-vitibet-guard.ts — « Vitibet a-t-il RÉELLEMENT publié une
 * prédiction pour ce match ? »
 *
 * ⚠️ Régression corrigée (2026-10-05). L'ancienne garde, dans
 * `scripts/pipeline-basketball-vitibet-bsd.ts`, était :
 *
 *     const hasPrediction = idxRaw !== null && idxRaw !== 0;
 *
 * Ce test est FAUX : un Index non nul ne prouve pas qu'une probabilité a été
 * publiée. Mesuré sur le HTML réel du pop-up (fixture NBA 519485,
 * league_id 12) : le bloc Index y affiche `-10.42` alors que les trois
 * cellules `prob-cell-val` valent `0% / 0% / 0%`. Résultat produit par
 * l'ancienne garde : le match était déclaré « prédit », puis un `tip` était
 * dérivé par comparaison `probHome >= probAway` → `0 >= 0` → **"1"**. Un
 * signal de pari sur une source vide.
 *
 * Test de présence réel : la cellule domicile ET la cellule extérieur
 * contiennent un pourcentage non nul.
 *
 * Note sur la cellule « 0 » : ce n'est pas un tirage football. Mesuré sur un
 * pop-up réel (LBP, fixture 524347) : `34% / 3% / 63%` — la somme fait
 * 100 et le 3 % est le résiduel de bookmaker, pas un nul de match.
 */

/** Une probabilité de book, ou null si la source n'a rien publié. */
export type VitibetPrediction = {
  probHome: number;
  probDraw: number;
  probAway: number;
};

/**
 * Extrait les trois cellules `prob-cell-val` d'un pop-up.
 *
 * Le HTML réel est `<div class="prob-cell-val">34%</div>` — le pourcentage suit
 * directement la balise fermante `>`. La regex est volontairement ancrée sur
 * `<div` + `class="prob-cell-val"` : sans cet ancrage elle attraperait aussi
 * les définitions CSS `.prob-cell-val { … }` du <style> (6 occurrences sur la
 * page, mesurées), qui ne contiennent aucun pourcentage.
 *
 * Renvoie null si moins de 3 cellules, ou si domicile/extérieur sont nuls.
 */
export function vitibetPrediction(html: string): VitibetPrediction | null {
  const vals = [
    ...html.matchAll(/<div class="prob-cell-val"[^>]*>\s*(\d+)\s*%/g),
  ].map((m) => Number(m[1]));

  if (vals.length < 3) return null;
  const [probHome, probDraw, probAway] = vals;
  // Vitibet publie des 0% quand il n'a pas de prédiction pour la ligue.
  if (!(probHome > 0) || !(probAway > 0)) return null;
  return { probHome, probDraw, probAway };
}

/**
 * Tip (« 1 » domicile / « 2 » extérieur) à partir des deux probabilités.
 *
 * Renvoie null si une seule des deux manque : l'ancien code comparait des
 * valeurs nulles entre elles et produisait « 1 » par défaut, donc un pari
 * systématique sur un match sans proba. Le nul football « X » n'est pas
 * produit ici — il n'a pas lieu d'être en basket, mais si Vitibet publie un
 * « 0 » de book il reste dans `probDraw`.
 */
export function vitibetTip(
  probHome: number | null,
  probAway: number | null,
): "1" | "2" | null {
  if (probHome === null || probAway === null) return null;
  if (probHome === 0 && probAway === 0) return null;
  return probHome >= probAway ? "1" : "2";
}