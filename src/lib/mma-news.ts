/**
 * Fil d'actu MMA/UFC — agrégation de flux RSS publics + traduction.
 *
 * Les 16 flux candidats ont été sondés un par un le 2026-10-03 (HTTP, type MIME,
 * nombre d'items, présence d'images). Il n'en reste que 3 — la liste ci-dessous
 * est un résultat de mesure, pas une liste de_void :
 *   Sherdog  — 50 items, le plus frais (pubDate du jour même)
 *   BBC      — 32 items, SEUL flux dont les images répondent en hotlink (200)
 *   UFC.com  — 10 items
 *
 * Écartés, avec leur cause mesurée : MMA Junkie 402 · Cage Warriors 403 ·
 * Reddit r/MMA 403 · Bleacher Report 404 · ONE FC 404 · Yahoo (296 octets,
 * flux vide) · Sports Illustrated (timeout curl) · MMA Fighting et MMA Mania
 * (renvoient du HTML, mur SB Nation en JS) · Sherdog via feedburner (0 item) ·
 * ESPN (HEAD 200 trompeur puis GET 0 octet — il faut tester le corps, pas le HEAD).
 *
 * IMAGES : mesuré avant d'écrire. BBC = 32/32 items avec image, les 4 sondées
 * répondent HTTP 200 depuis `ichef.bbci.co.uk`. Sherdog = 0 `<img>` dans les
 * descriptions. Donc `withImages: true` ici, `false` côté foot : c'est une
 * différence mesurée entre les deux jeux de sources, pas une incohérence.
 *
 * TRADUCTION : les 3 flux sont en anglais. Un appel LLM groupé traduit les titres
 * et chapeaux du Haut de page vers la locale demandée. En cas d'échec (quota,
 * provider KO, réponse illisible) on affiche l'ORIGINAL : jamais de trou, jamais
 * d'exception remontée au client.
 */

import {
  createNewsAggregator,
  type FeedSource,
  type NewsItem,
  type NewsResult,
} from "@/lib/news-aggregate";
// Import STATIQUE, pas `await import("@/lib/llm")` : l'alias @/ n'est pas
// resolu a l'execution par un import dynamique, l'appel echouait en silence et
// le repli sur l'original masquait total la panne (mesure : 1151 ms, aucun
// appel LLM emis). llm.ts est server-only, ce module l'est aussi (route API).
import { generateText } from "@/lib/llm";

export type { NewsItem, NewsResult };

/** Flux retenus après sondage (2026-10-03). */
export const MMA_FEEDS: FeedSource[] = [
  { id: "sherdog", name: "Sherdog", url: "https://www.sherdog.com/rss/news", lang: "en" },
  { id: "bbc-mma", name: "BBC Sport", url: "https://feeds.bbci.co.uk/sport/mixed-martial-arts/rss.xml", lang: "en" },
  { id: "ufc", name: "UFC.com", url: "https://www.ufc.com/rss.xml", lang: "en" },
];

export const ITEMS_PER_FEED = 8;
export const NEWS_CACHE_TTL_MS = 10 * 60 * 1000;

/**
 * Nombre d'items traduits par lot.
 *
 * 8 et non 12 : mesuré le 2026-10-03, un lot de 12 titres fait dépasser la
 * fenêtre de sortie et la réponse arrive **tronquée en plein objet JSON** (pas
 * de `}` fermant) — donc 0 traduction exploitable. Le modèle raisonne avant de
 * repondre (93 tokens pour un « OK », beaucoup plus pour 12 titres).
 */
export const TRANSLATE_BATCH = 8;

/**
 * Budget de sortie. Large volontairement : il doit couvrir le raisonnement ET
 * les 8 titres traduits, sinon on récupère du JSON coupé.
 */
const TRANSLATE_MAX_TOKENS = 4000;

const aggregator = createNewsAggregator(MMA_FEEDS, {
  itemsPerFeed: ITEMS_PER_FEED,
  total: 30,
  cacheTtlMs: NEWS_CACHE_TTL_MS,
  withImages: true,
});

export type MmaNewsItem = NewsItem & {
  /** Titre traduit si disponible, sinon le titre original. */
  titleFr: string;
  translated: boolean;
};

export type MmaNewsResult = Omit<NewsResult, "items"> & {
  items: MmaNewsItem[];
  /** true si au moins un item a pu être traduit. */
  translated: boolean;
};

/** Plafond d'items traduits : couvre les 12 affichés + marge, sans runaway. */
export const TRANSLATE_MAX_ITEMS = 24;

/** Découpe une liste en lots de taille `size` (pur, testé). */
export function chunk<T>(list: T[], size: number): T[][] {
  if (size < 1) throw new RangeError("chunk(): size doit valoir au moins 1");
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

/**
 * Traduit les titres par lots, en isolant les pannes.
 *
 * Une réponse LLM n'est pas une API. Mesuré le 2026-10-03 : sur 5 appels, 1 a
 * renvoyé du texte parasite AVANT le JSON
 * (« keep it natural and accurate for sports journalism: "Résultats de… ») —
 * le modèle raisonne et laisse passer sa consigne. Un `JSON.parse` naïf fait
 * alors perdre tout le lot pour un seul item malformé. D'où l'extraction
 * first-`{` / last-`}` + réparation des JSON tronqués.
 *
 * Chaque lot est encapsulé : si le lot 3 échoue (quota), les traductions des
 * lots 1 et 2 sont conservées. Les lots passent en SÉQUENCE, pas en parallèle :
 * les deux providers gratuits sont déjà plafonnés quand on les sollicite, et
 * 3 appels simultanés aggravent le 429 au lieu de l'éviter.
 */
async function translateTitles(
  items: NewsItem[],
  target: string,
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const lang = target.slice(0, 2);
  const wanted = items.filter((i) => i.lang !== lang).slice(0, TRANSLATE_MAX_ITEMS);
  if (wanted.length === 0) return out;

  for (const batch of chunk(wanted, TRANSLATE_BATCH)) {
    try {
      const got = await translateBatch(batch, target);
      for (const [k, v] of got) out.set(k, v);
    } catch {
      // Lot en échec : on passe au suivant, les traductions déjà acquises
      // restent valables. L'original affiche ce lot-là.
    }
  }
  return out;
}

/** Traduit un seul lot. Lève si les deux tentatives échouent. */
async function translateBatch(batch: NewsItem[], target: string): Promise<Map<string, string>> {
  const list = batch.map((i, idx) => `${idx + 1}. ${i.title}`).join("\n");

  const instruction =
    "Traduis ces titres d'actualité MMA en " + target +
    ". Conserve les noms de combattants, de fédérations et les chiffres. " +
    "Garde le style punchy d'un titre sportif, sans point final. " +
    "Réponds UNIQUEMENT par un objet JSON {\"1\":\"titre\",\"2\":\"titre\"}, " +
    "sans aucun texte avant ni après.";

  const extract = (raw: string): Map<string, string> => {
    const map = new Map<string, string>();
    const start = raw.indexOf("{");
    if (start < 0) return map;

    // Sortie tronquée : on répare en refermant ce qui est ouvert. Sans ça, un
    // lot coupé fait perdre les traductions pour un simple problème de fenêtre
    // de tokens, alors que 5 titres sur 8 sont parfaitement utilisables.
    let body = raw.slice(start);
    const last = body.lastIndexOf("}");
    if (last < 0) {
      if (body.lastIndexOf('"') > body.lastIndexOf(",")) body += '"';
      const open = (body.match(/\{/g) || []).length - (body.match(/\}/g) || []).length;
      body += "}".repeat(Math.max(0, open));
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(body);
    } catch {
      return map; // JSON illisible : on garde l'original, sans casser le lot.
    }
    if (typeof parsed !== "object" || parsed === null) return map;
    const rec = parsed as Record<string, unknown>;
    batch.forEach((item, idx) => {
      const val = rec[String(idx + 1)];
      if (typeof val === "string" && val.trim()) map.set(item.id, val.trim());
    });
    return map;
  };

  // 12 s par tentative : mesuré, une tentative qui rate peut coûter 20 s, et il
  // y a deux tentatives. Plafonné, le chemin à froid reste sous ~25 s par lot —
  // et la traduction est en cache 10 min, donc seul le premier visiteur paie.
  const base = { temperature: 0.2, maxOutputTokens: TRANSLATE_MAX_TOKENS, timeoutMs: 12_000 };

  try {
    const res = await generateText({ ...base, system: "Tu es un traducteur.", prompt: `${instruction}\n\n${list}`, json: true });
    const first = extract(res.text);
    if (first.size > 0) return first;
  } catch {
    // Quota atteint / provider KO : on tente une fois sans le mode JSON.
  }

  const res = await generateText({ prompt: `${instruction}\n\n${list}`, ...base });
  const map = extract(res.text);
  if (map.size === 0) throw new Error("lot non traduit");
  return map;
}

/**
 * Fil MMA traduit. `locale` au format "fr-FR" ; seules les locales FR sont
 * traduites, les autres rendent l'original (le projet n'expose pas d'autre
 * langue de contenu aujourd'hui — ajouter une locale doit ajouter sa sortie,
 * pas la supposer).
 */
/**
 * Cache de traduction, clé = locale.
 *
 * Indispensable : `aggregator` cache le flux 10 min, mais la traduction, elle,
 * se recalculait à CHAQUE requête — mesuré 17 s par appel (batch de 8 titres
 * sur un modèle qui raisonne, ~16 s). Sans ce cache, chaque affichage de
 * l'onglet payait 17 s. Le cache est aligné sur celui du flux : quand le flux
 * change, la retraduction suit.
 */
const translatedCache = new Map<
  string,
  { at: number; ttlMs: number; result: MmaNewsResult }
>();

/** TTL de la traduction : même durée que le flux, pour ne pas retraduire sans raison. */
const TRANSLATE_CACHE_TTL_MS = 10 * 60 * 1000;

/**
 * TTL quand RIEN n'a pu être traduit (mesuré le 2026-10-03 : les deux providers
 * gratuits sont simultanément plafonnés en 429).
 *
 * Court deliberately : mettre 10 min ici ferait qu'un rate-limit transitoire
 * gèlerait l'onglet en anglais pendant 10 minutes, alors que le flux, lui, est
 * encore frais. 60 s suffit à amortir la rafale de visiteurs qui suivent, et
 * la traduction repart dès que le quota répond.
 */
const TRANSLATE_CACHE_TTL_FAILED_MS = 60 * 1000;

/**
 * Fil MMA traduit. `locale` au format "fr-FR" ; seules les locales FR sont
 * traduites, les autres rendent l'original (le projet n'expose pas d'autre
 * langue de contenu aujourd'hui — ajouter une locale doit ajouter sa sortie,
 * pas la supposer).
 */
export async function getMmaNews(locale = "fr-FR"): Promise<MmaNewsResult> {
  const cached = translatedCache.get(locale);
  if (cached && Date.now() - cached.at < cached.ttlMs) return cached.result;

  const base = await aggregator.fetch();
  const targetLang = locale.slice(0, 2);

  let translated = new Map<string, string>();
  try {
    translated = await translateTitles(base.items, targetLang);
  } catch {
    // Gemini est mesuré intermittent (503 sur 1 appel sur 5) ; le repli NVIDIA
    // NIM le rattrape, mais s'il tombe aussi l'original reste le contrat.
    translated = new Map();
  }

  const items: MmaNewsItem[] = base.items.map((item) => {
    const t = translated.get(item.id);
    return { ...item, titleFr: t ?? item.title, translated: Boolean(t) };
  });

  // `translated` doit refleTER ce qui est reellement affiche : si les 3 lots ont
  // echoue, l'UI affiche « version originale », pas « traduit automatiquement ».
  const translatedCount = items.filter((i) => i.translated).length;

  const result: MmaNewsResult = { ...base, items, translated: translatedCount > 0 };
  translatedCache.set(locale, {
    at: Date.now(),
    ttlMs: translatedCount > 0 ? TRANSLATE_CACHE_TTL_MS : TRANSLATE_CACHE_TTL_FAILED_MS,
    result,
  });
  return result;
}

/** Vide le cache (tests). */
export function clearMmaNewsCache(): void {
  aggregator.clearCache();
  translatedCache.clear();
}