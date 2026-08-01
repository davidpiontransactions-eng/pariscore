/**
 * Utilitaire de scraping des photos joueurs depuis footballdatabase.eu.
 *
 * Construit une URL de recherche et extrait l'URL de la photo du joueur
 * depuis la page de résultats. Fonctionne côté serveur uniquement (API route).
 *
 * Exemple d'URL : https://www.footballdatabase.eu/fr/joueurs/recherche?search=kane
 */

const FDB_BASE = "https://www.footballdatabase.eu";
const FDB_SEARCH = `${FDB_BASE}/fr/joueurs/recherche`;

/**
 * Extrait le nom de fichier pour la recherche (prénom puis nom, ASCII).
 */
function normalizePlayerName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents
    .replace(/[^a-zA-Z0-9\s-]/g, "")
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .slice(0, 3) // take up to 3 name parts
    .join(" ");
}

/**
 * Cherche la photo d'un joueur sur footballdatabase.eu.
 * Retourne l'URL de la photo ou null si non trouvée.
 * À utiliser côté serveur uniquement (fetch + parsing HTML).
 */
export async function fetchPlayerPhotoFromFDB(playerName: string): Promise<string | null> {
  const query = encodeURIComponent(normalizePlayerName(playerName));
  const searchUrl = `${FDB_SEARCH}?search=${query}`;

  try {
    const res = await fetch(searchUrl, {
      headers: {
        "User-Agent": "PariScore/1.0 (sports analytics; contact@pariscore.app)",
        "Accept": "text/html",
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) return null;
    const html = await res.text();

    // Pattern: <img ... src="/uploads/players/..." ... />
    // Les photos joueurs sont typiquement dans /uploads/players/
    const imgRegex = /<img[^>]+src="(\/uploads\/players\/[^"]+)"[^>]*>/gi;
    const match = imgRegex.exec(html);

    if (match?.[1]) {
      return `${FDB_BASE}${match[1]}`;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Version batch : enrichit une liste de joueurs avec leurs photos.
 * Limite la concurrence à 3 requêtes simultanées.
 */
export async function enrichPlayersWithPhotos(
  players: { name: string }[],
): Promise<Record<string, string | null>> {
  const results: Record<string, string | null> = {};

  // Batch de 3 requêtes max simultanées
  for (let i = 0; i < players.length; i += 3) {
    const batch = players.slice(i, i + 3);
    const batchResults = await Promise.allSettled(
      batch.map((p) => fetchPlayerPhotoFromFDB(p.name)),
    );
    batchResults.forEach((r, j) => {
      results[batch[j].name] = r.status === "fulfilled" ? r.value : null;
    });
  }

  return results;
}
