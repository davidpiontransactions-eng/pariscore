/**
 * scripts/lib/hockeytech.mjs
 *
 * Client partagé du feed HockeyTech (modulekit) pour khl / mhl / whl.
 *
 * L'accès direct à `lscluster.hockeytech.com` rend `Client access denied.`
 * (blocage IP, quel que soit le jeu d'en-têtes : Referer khl.ru,
 * Referer hockeytech, UA seul, X-Requested-With — 4/4 mesurés). Le proxy
 * public `khl.shayy.workers.dev` est donc le SEUL accès possible.
 *
 * Deux pièges déjà payés, codés ici pour ne pas les re-payer :
 *
 *  1. Le proxy renvoie `HTTP 200` avec `SiteKit.<vue>.error =
 *     "SyntaxError: Unterminated string in JSON at position NNNNN"`. Ce n'est
 *     pas un plafond de taille : le point de coupure VARIE (137 756 / 137 764 /
 *     137 767 / 137 880 sur des fenêtres différentes) et la durée est toujours
 *     ~41 s. C'est un timeout de l'upstream, le proxy renvoie un tampon
 *     partiel. Un simple `if (!res.ok)` l'accepterait comme une réponse
 *     valide et l'appelant croirait avoir des données. Mesuré sur
 *     `view=scorebar` : 0/6 succès. D'où l'inspection de chaque valeur de
 *     SiteKit ci-dessous.
 *
 *  2. `view=seasons` renvoie 39 saisons dans un ordre NON documenté :
 *     [0] = 407/2026-2027 … [38] = 27/2008-2009. Lire `at(-1)` renvoie une
 *     saison de 2008-2009 avec des données réalistes et AUCUN signal d'erreur.
 *     D'où `pickCurrentSeason`, qui filtre par ANNÉE.
 */

const PROXY = "https://khl.shayy.workers.dev?url=";
const FEED_BASE = "https://lscluster.hockeytech.com/feed/";

export const DEFAULT_TIMEOUT_MS = 90_000;
export const DEFAULT_ATTEMPTS = 4;

export function feedUrl(key, params) {
  const qs = new URLSearchParams({
    feed: "modulekit",
    fmt: "json",
    key,
    client_code: key,
    lang: "en",
    ...params,
  });
  return `${PROXY}${encodeURIComponent(`${FEED_BASE}?${qs}`)}`;
}

/**
 * Une réponse est invalIDE si le proxy a rogné le flux — même avec HTTP 200.
 * On teste chaque valeur de SiteKit : le champ `error` n'est visible que là.
 */
function tronquage(siteKit) {
  if (!siteKit || typeof siteKit !== "object") return "SiteKit absent";
  for (const [vue, valeur] of Object.entries(siteKit)) {
    if (vue === "Copyright" || vue === "Parameters") continue;
    if (valeur && typeof valeur === "object" && "error" in valeur) {
      const pos = String(valeur.error).match(/position (\d+)/)?.[1];
      return `payload tronqué${pos ? ` à ${pos} o` : ""}`;
    }
  }
  return null;
}

/**
 * Appelle une vue du feed avec retry.
 * Le taux de succès est très lié à l'état du cache edge du worker : les
 * réponses servies en <1 s sont des cache-hit, les autres timeoutent à ~41 s.
 * 3 tentatives suffisent en pratique ; au-delà on rend la main.
 */
export async function feed(key, params, { timeoutMs = DEFAULT_TIMEOUT_MS, attempts = DEFAULT_ATTEMPTS } = {}) {
  let dernier = "aucune tentative";
  for (let i = 1; i <= attempts; i++) {
    try {
      const res = await fetch(feedUrl(key, params), { signal: AbortSignal.timeout(timeoutMs) });
      if (!res.ok) {
        dernier = `HTTP ${res.status}`;
      } else {
        const siteKit = (await res.json())?.SiteKit;
        const rogne = tronquage(siteKit);
        if (rogne) dernier = rogne;
        else if (siteKit) return { siteKit, tentative: i };
        else dernier = "SiteKit absent";
      }
    } catch (e) {
      dernier = e?.name === "TimeoutError" ? `timeout>${timeoutMs}ms` : String(e?.message ?? e).slice(0, 60);
    }
    if (i < attempts) await new Promise((r) => setTimeout(r, 2500));
  }
  throw new Error(`HockeyTech ${params.view ?? "?"} inaccessible après ${attempts} tentatives : ${dernier}`);
}

/** Accesseur typé : `siteKit.Schedule` etc., ou `null` si la vue est absente. */
export function vue(siteKit, nom) {
  const v = siteKit?.[nom];
  return Array.isArray(v) ? v : null;
}

/**
 * Saison courante PAR SON ANNÉE — jamais par index.
 * Refuse d'écrire si aucune saison ne correspond : mieux vaut une erreur
 * explicite qu'un fichier rempli avec 2008-2009.
 */
export function pickCurrentSeason(seasons, maintenant = new Date()) {
  const annee = String(maintenant.getUTCFullYear());
  const anneeSuivante = String(maintenant.getUTCFullYear() + 1);
  const courante = (seasons ?? []).find((s) => {
    const nom = String(s.season_name ?? "");
    return nom.includes(annee) || nom.includes(anneeSuivante);
  });
  if (!courante) {
    const liste = (seasons ?? []).slice(0, 3).map((s) => `${s.season_id}/${s.season_name}`).join(", ");
    throw new Error(
      `Aucune saison ${annee}-${anneeSuivante} parmi ${seasons?.length ?? 0} (début : ${liste}) — ` +
        `refus de produire des données d'une saison inconnue`,
    );
  }
  return courante;
}

/** Résout la saison courante en un `{ seasonId, seasonName }` (1 requête). */
export async function currentSeason(key, options) {
  const { siteKit } = await feed(key, { view: "seasons" }, options);
  const saison = pickCurrentSeason(vue(siteKit, "Seasons"));
  return { seasonId: String(saison.season_id), seasonName: String(saison.season_name) };
}
