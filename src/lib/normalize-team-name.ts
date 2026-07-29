/**
 * Normalisation du nom d'équipe (portage du `_normalizeTeamName` legacy,
 * cf. server.js:3806-3813). Partagé entre le script de crawl des logos
 * (clés du JSON) et le runtime (lookup) pour garantir un matching identique.
 *
 * Étapes : minuscules → NFD accents retirés → préfixes clubs (fc, cf, ac…)
 * retirés → tout sauf alphanumérique retiré.
 */
export function normalizeTeamName(name: string): string {
  return String(name || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // accents
    .replace(
      // Mots vides + préfixes clubs (même liste que le legacy)
      /\b(fc|cf|ac|ssc|sc|if|ik|kf|ff|afc|asd|cd|club|united|utd|city|sk|ifk|bk|fk|il|tf|vfl|sv|gs|rb|tsg|vfb)\b/g,
      "",
    )
    .replace(/[^a-z0-9]/g, "") // tout sauf alphanum
    .trim();
}
