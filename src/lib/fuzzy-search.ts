// Fuzzy matching léger pour la recherche tennis (joueurs + tournois).
//
// Choix : implémentation maison plutôt que Fuse.js — pas de dépendance
// supplémentaire (évite un `bun install` au déploiement VPS), datasets
// petits (93 joueurs, 62 tournois), et comportement 100 % déterministe.
//
// Scoring (0..1) par token de la requête :
//   - correspondance exacte            → 1.0
//   - préfixe du token cible           → 0.9
//   - sous-chaîne du token cible       → 0.8
//   - distance de Levenshtein ≤ 2      → 0.6 - 0.1 * dist (tolerance typos)
// Le score global est la moyenne pondérée des tokens de la requête par leur
// longueur. Un token sans correspondance plafonne le score à 0.49 (pas de
// match si le seuil d'appel est 0.5).

/** Normalise : minuscules + strip accents (NFD) + espaces réduits. */
export function normalizeFuzzy(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** Distance de Levenshtein bornée (<= maxDist pour éviter le coût quadratique). */
export function levenshteinBounded(a: string, b: string, maxDist = 2): number {
  if (a === b) return 0;
  const la = a.length;
  const lb = b.length;
  if (Math.abs(la - lb) > maxDist) return maxDist + 1;
  const prev = new Array<number>(lb + 1);
  const curr = new Array<number>(lb + 1);
  for (let j = 0; j <= lb; j++) prev[j] = j;
  for (let i = 1; i <= la; i++) {
    curr[0] = i;
    let rowMin = curr[0];
    for (let j = 1; j <= lb; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1, // suppression
        curr[j - 1] + 1, // insertion
        prev[j - 1] + cost, // substitution
      );
      if (curr[j] < rowMin) rowMin = curr[j];
    }
    if (rowMin > maxDist) return maxDist + 1; // prune : plus de retour possible
    for (let j = 0; j <= lb; j++) prev[j] = curr[j];
  }
  return prev[lb];
}

/** Score d'un token de requête contre un token cible (0..1). */
function tokenScore(q: string, t: string): number {
  if (q.length === 0 || t.length === 0) return 0;
  if (q === t) return 1;
  if (t.startsWith(q)) return 0.9;
  if (t.includes(q)) return 0.8;
  const dist = levenshteinBounded(q, t, 2);
  if (dist === 1) return 0.75;
  if (dist === 2) return 0.6;
  return 0;
}

/**
 * Score fuzzy global (0..1) entre une requête normalisée et une cible
 * normalisée. 0 = pas de correspondance. Le score est pondéré par la
 * longueur des tokens de la requête : les mots longs comptent plus.
 */
export function fuzzyScore(query: string, target: string): number {
  const qTokens = query.split(" ").filter(Boolean);
  if (qTokens.length === 0 || !target) return 0;
  const tTokens = target.split(" ").filter(Boolean);
  if (tTokens.length === 0) return 0;

  let weighted = 0;
  let totalWeight = 0;
  for (const q of qTokens) {
    let best = 0;
    for (const t of tTokens) {
      const s = tokenScore(q, t);
      if (s > best) best = s;
    }
    if (best === 0) return 0; // un token introuvable → pas de match
    weighted += best * q.length;
    totalWeight += q.length;
  }
  return totalWeight > 0 ? weighted / totalWeight : 0;
}
