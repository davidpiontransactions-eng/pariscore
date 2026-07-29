/**
 * Script one-shot : crawl football-logos.cc → génère src/data/club-logos.json.
 *
 * Usage : `bun run scripts/scrape-club-logos.ts`
 *
 * Pourquoi ce script : le CDN assets.football-logos.cc utilise un hash de
 * build Vite imprédictible (`liverpool.d03fd250.png`) — l'URL ne se construit
 * pas hors-ligne, il faut scraper la page réelle de chaque club.
 *
 * Résumable : si src/data/club-logos.json existe, on reprend où on en était.
 * Re-runnable à la demande si le CDN fait évoluer ses hashes.
 *
 * Output : { "<nomNormalisé>": "<urlCDN 512px>", ... }
 * La normalisation (normalizeTeamName) est partagée avec le runtime, ce qui
 * garantit un matching identique côté lookup.
 */
import { normalizeTeamName } from "../src/lib/normalize-team-name";
import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = join(__dirname, "..", "src", "data", "club-logos.json");
const BASE = "https://football-logos.cc";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

// Pays prioritaires : ceux de COUNTRY_FLAGS (bsd-football-fetcher) + Amérique
// du Sud (matchs live Copa Sudamericana / Copa Colombia) + Asie.
// Le slug doit correspondre exactement au chemin football-logos.cc.
const COUNTRIES = [
  // Europe
  "england", "spain", "italy", "germany", "france", "portugal", "netherlands",
  "belgium", "scotland", "greece", "turkey", "poland", "romania", "denmark",
  "sweden", "norway", "switzerland", "austria", "czech-republic", "croatia",
  "serbia", "russia", "ukraine",
  // Amériques
  "brazil", "argentina", "colombia", "uruguay", "chile", "ecuador", "paraguay",
  "peru", "mexico", "usa",
  // Asie / autres
  "japan", "china", "south-korea", "saudi-arabia",
];

const CONCURRENCY = 8;
const SLEEP_MS = 150;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html" },
      signal: AbortSignal.timeout(20000),
      redirect: "follow",
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

/** Extrait les slugs clubs d'une page pays : /<country>/<slug>/. */
function extractClubSlugs(html: string, country: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  // Les liens englobent souvent une <img> : on ne capture que le slug.
  const re = new RegExp(`href="/${country}/([a-z0-9][a-z0-9-]*?)/"`, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const slug = m[1];
    if (seen.has(slug)) continue;
    seen.add(slug);
    out.push(slug);
  }
  return out;
}

/**
 * Récupère le nom d'affichage depuis une page club.
 * Le <h1> contient "Arsenal Logo (PNG & SVG)" → on garde avant "Logo".
 * Fallback : le slug (toujours présent et propre), remis en forme.
 */
function extractClubName(html: string, slug: string): string | null {
  const h1 = html.match(/<h1[^>]*>([^<]{2,120})<\/h1>/i);
  if (h1) {
    return h1[1].replace(/\s*logo.*$/i, "").replace(/&amp;/g, "&").trim();
  }
  // Fallback : slug remis en forme ("aston-villa" → "Aston Villa")
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// URLs CDN : assets.football-logos.cc/logos/<country>/<SIZE>/<slug>.<hash>.png
// On préfère 512x512, puis 256, 700, et enfin la première trouvée.
const CDN_RE = /https:\/\/assets\.football-logos\.cc\/logos\/[^"'\s)]+?\.png/gi;
const SIZES = ["512x512", "256x256", "700x700", "1500x1500", "3000x3000", "128x128", "64x64"];

function pickBestLogo(urls: string[]): string | null {
  if (urls.length === 0) return null;
  for (const size of SIZES) {
    const u = urls.find((x) => x.includes(`/${size}/`));
    if (u) return u;
  }
  return urls[0];
}

async function processPool<T, R>(
  items: T[],
  worker: (item: T) => Promise<R>,
  n: number,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let idx = 0;
  const run = async () => {
    while (idx < items.length) {
      const cur = idx++;
      results[cur] = await worker(items[cur]);
    }
  };
  await Promise.all(Array.from({ length: n }, run));
  return results;
}

// --- Resumable : charge le JSON existant ---
const logos: Record<string, string> = existsSync(OUT_PATH)
  ? JSON.parse(readFileSync(OUT_PATH, "utf8"))
  : {};

let stats = { countries: 0, clubsSeen: 0, logosAdded: 0, skippedExisting: 0 };

console.log(`[club-logos] Démarrage — ${COUNTRIES.length} pays, resumable (${Object.keys(logos).length} déjà en cache).`);

for (const country of COUNTRIES) {
  const html = await fetchText(`${BASE}/${country}/`);
  if (!html) {
    console.log(`  ✗ ${country}: page introuvable (skip)`);
    continue;
  }
  const slugs = extractClubSlugs(html, country);
  stats.countries++;
  stats.clubsSeen += slugs.length;

  const dbg = { ok: 0, noPage: 0, noName: 0, noCdn: 0, cached: 0 };
  const fetched = await processPool(slugs, async (slug: string) => {
    const page = await fetchText(`${BASE}/${country}/${slug}/`);
    if (!page) {
      dbg.noPage++;
      return null;
    }
    const name = extractClubName(page, slug);
    if (!name) {
      dbg.noName++;
      return null;
    }
    const norm = normalizeTeamName(name);
    if (!norm) {
      dbg.noName++;
      return null;
    }
    if (logos[norm]) {
      dbg.cached++;
      return { norm, url: null as string | null };
    }
    const urls = [...new Set(page.match(CDN_RE) ?? [])];
    const best = pickBestLogo(urls);
    if (!best) {
      dbg.noCdn++;
      return null;
    }
    dbg.ok++;
    await sleep(SLEEP_MS);
    return { norm, url: best };
  }, CONCURRENCY);

  let added = 0;
  for (const r of fetched) {
    if (r && r.url && !logos[r.norm]) {
      logos[r.norm] = r.url;
      added++;
    }
  }
  stats.logosAdded += added;
  console.log(
    `  ✓ ${country}: +${added} logos (${slugs.length} slugs) ` +
      `[ok=${dbg.ok} cache=${dbg.cached} noPage=${dbg.noPage} noName=${dbg.noName} noCdn=${dbg.noCdn}]`,
  );

  // Checkpoint après chaque pays (resumable)
  mkdirSync(dirname(OUT_PATH), { recursive: true });
  writeFileSync(OUT_PATH, JSON.stringify(logos, null, 0)); // compact
}

console.log(
  `\n[club-logos] Terminé — ${stats.logosAdded} logos ajoutés, ` +
    `${stats.skippedExisting} déjà en cache, ${stats.clubsSeen} clubs vus sur ${stats.countries} pays.`,
);
console.log(`[club-logos] Total entrées : ${Object.keys(logos).length} → ${OUT_PATH}`);
