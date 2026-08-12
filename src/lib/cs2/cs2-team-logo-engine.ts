/**
 * cs2-team-logo-engine.ts — Moteur de résolution & cache disque des logos CS2.
 *
 * Pipeline (server-side uniquement) :
 *   1. Cache disque  → public/cache/cs2-teams/{slug}.{ext}  (hit = URL locale instantanée)
 *   2. Source BSD    → URL id-based du match (https://sports.bzzoiro.com/img/csgo-team/{id}/)
 *                      → téléchargée et mise en cache (extrait du content-type)
 *   3. Source Liquipedia → wikitext infobox `logo=` → Commons → téléchargement (pattern
 *                      = tools/download-tennis-logos.js)
 *   4. Échec         → null (le client garde le fallback initiales stylisé)
 *
 * Régime : tâches de fond séquentielles (queue), dédup par slug, manifest.json
 * pour l'index (avec statut de fraîcheur). Aucune dépendance externe (https natif).
 */

import https from "node:https";
import type { IncomingMessage } from "node:http";
import zlib from "node:zlib";
import fs from "node:fs";
import path from "node:path";

// ─── Constantes ──────────────────────────────────────────────────────────────

const CACHE_DIR = path.join(process.cwd(), "public", "cache", "cs2-teams");
const MANIFEST_FILE = path.join(CACHE_DIR, "manifest.json");

const USER_AGENT =
  "PariScore/1.0 (cs2-logo-engine; david.piontransactions@gmail.com)";

const LIQUIPEDIA_API = "https://liquipedia.net/counterstrike/api.php";
const WIKI_API_LIST = ["https://commons.wikimedia.org", "https://en.wikipedia.org"];

const MAX_BYTES = 2 * 1024 * 1024; // 2 Mo max par logo
const EXTS = [".png", ".svg", ".jpg", ".jpeg", ".gif"] as const;

// Canonicalisation des noms — miroir des clés TEAM_ALIASES de services/cs2Service.js :
// les slugs générés restent stables quelle que soit la casse/orthographe source.
const TEAM_CANON: Record<string, string> = {
  "team vitality": "vitality",
  vitality: "vitality",
  vita: "vitality",
  "faze clan": "faze",
  faze: "faze",
  fazeclan: "faze",
  "team spirit": "spirit",
  spirit: "spirit",
  "spirit team": "spirit",
  mouz: "mouz",
  mousesports: "mouz",
  "natus vincere": "natus-vincere",
  navi: "natus-vincere",
  "nat. vincere": "natus-vincere",
  "g2 esports": "g2",
  g2: "g2",
  g2esports: "g2",
  "team liquid": "liquid",
  liquid: "liquid",
  heroic: "heroic",
  "furia esports": "furia",
  furia: "furia",
  "complexity gaming": "complexity",
  complexity: "complexity",
  col: "complexity",
  cloud9: "cloud9",
  c9: "cloud9",
  astralis: "astralis",
  big: "big",
  "big clan": "big",
  "pain gaming": "pain",
  pain: "pain",
  paingaming: "pain",
  ence: "ence",
  falcons: "falcons",
  "team falcons": "falcons",
  "virtus.pro": "virtus-pro",
  "virtus pro": "virtus-pro",
  vp: "virtus-pro",
  "ninjas in pyjamas": "ninjas-in-pyjamas",
  nip: "ninjas-in-pyjamas",
  "n.i.p.": "ninjas-in-pyjamas",
  fnatic: "fnatic",
  "the mongolz": "mongolz",
  mongolz: "mongolz",
  "mongol z": "mongolz",
  "3dmax": "3dmax",
  monte: "monte",
  saw: "saw",
  eternos: "eternos",
  sinners: "sinners",
  "sinners esports": "sinners",
  imperial: "imperial",
  "imperial esports": "imperial",
  imp: "imperial",
  aurora: "aurora",
  "aurora gaming": "aurora",
  "9z team": "9z",
  "9z": "9z",
  apeks: "apeks",
  "lynn vision": "lynn-vision",
  lynn: "lynn-vision",
};

const MIME_EXT: Record<string, string> = {
  "image/png": ".png",
  "image/svg+xml": ".svg",
  "image/jpeg": ".jpg",
  "image/gif": ".gif",
  "image/webp": ".png", // reconnu mais rare — stocké sous .png en l'absence d'autre info
};

export type TeamLogoSpec = {
  name: string;
  remoteUrl?: string | null;
};

type ManifestEntry = {
  file: string;
  source: "bsd" | "liquipedia";
  fetchedAt: number;
  bytes: number;
};

type Manifest = Record<string, ManifestEntry>;

/** Génère un slug stable à partir du nom (canonique si connu, sinon slugifié). */
export function slugifyTeamName(name: string): string {
  const norm = (name || "").toLowerCase().trim();
  if (!norm) return "tbd";
  const canon = TEAM_CANON[norm];
  if (canon) return canon;
  return norm.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "tbd";
}

// ─── Manifest (index disque) ─────────────────────────────────────────────────

let _manifest: Manifest | null = null;

function loadManifest(): Manifest {
  if (_manifest) return _manifest;
  try {
    if (fs.existsSync(MANIFEST_FILE)) {
      _manifest = JSON.parse(fs.readFileSync(MANIFEST_FILE, "utf8")) as Manifest;
      return _manifest!;
    }
  } catch {
    /* manifest corrompu → on repart à zéro */
  }
  _manifest = {};
  return _manifest;
}

function saveManifest(m: Manifest): void {
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    fs.writeFileSync(MANIFEST_FILE, JSON.stringify(m, null, 2));
  } catch {
    /* non bloquant */
  }
}

// ─── Lookup disque (synchrone, hot path des requêtes API) ────────────────────

/** URL locale si le logo est déjà en cache, sinon null. */
export function getTeamLogoUrl(
  name: string,
  remoteUrl?: string | null,
): string | null {
  const slug = slugifyTeamName(name);
  const manifest = loadManifest();
  const entry = manifest[slug];
  if (entry) {
    const p = path.join(CACHE_DIR, entry.file);
    if (fs.existsSync(p)) return `/cache/cs2-teams/${entry.file}`;
  }
  for (const ext of EXTS) {
    if (fs.existsSync(path.join(CACHE_DIR, `${slug}${ext}`))) {
      return `/cache/cs2-teams/${slug}${ext}`;
    }
  }
  return null;
}

// ─── Fetch HTTP natif (UA, timeout, redirects, limitation de taille) ────────

type FetchResult = { bytes: Buffer; ct: string; finalUrl: string };

type FetchOpts = {
  redirects?: number;
  timeoutMs?: number;
  /** Mode JSON : Accept-Encoding gzip obligatoire (Liquipedia 406 sans gzip) + décompression. */
  json?: boolean;
};

function fetchBytes(
  url: string,
  opts: FetchOpts = {},
): Promise<FetchResult> {
  const { redirects = 4, timeoutMs = 20_000, json = false } = opts;
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request(
      u,
      {
        method: "GET",
        headers: {
          "User-Agent": USER_AGENT,
          Accept: json ? "application/json" : "image/*, */*;q=0.1",
          ...(json ? { "Accept-Encoding": "gzip" } : {}),
        },
      },
      (res: IncomingMessage) => {
        if (
          [301, 302, 303, 307, 308].includes(res.statusCode ?? 0) &&
          res.headers.location
        ) {
          res.resume();
          if (redirects <= 0) return reject(new Error("too many redirects"));
          const loc = res.headers.location.startsWith("http")
            ? res.headers.location
            : new URL(res.headers.location, url).toString();
          return fetchBytes(loc, { ...opts, redirects: redirects - 1 }).then(resolve, reject);
        }
        if (res.statusCode === 429) {
          res.resume();
          // Pas de retry interne : le délai de backoff dépend de la source
          // (Liquipedia ~budget IP sévère). Les appelants gèrent le retry.
          return reject(new Error("rate-limit 429 — " + url));
        }
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`HTTP ${res.statusCode} — ${url}`));
        }
        const chunks: Buffer[] = [];
        let size = 0;
        res.on("data", (c: Buffer) => {
          size += c.length;
          if (size > MAX_BYTES) {
            req.destroy(new Error("logo too large"));
            return;
          }
          chunks.push(c);
        });
        res.on("end", () => {
          let body = Buffer.concat(chunks);
          const ct = (res.headers["content-type"] ?? "").split(";")[0].trim();
          if (/gzip/i.test(res.headers["content-encoding"] ?? "")) {
            try {
              body = zlib.gunzipSync(body);
            } catch {
              return reject(new Error("bad gzip payload"));
            }
          }
          if (body.length < 64) return reject(new Error("logo too small"));
          resolve({ bytes: body, ct, finalUrl: url });
        });
      },
    );
    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error("timeout"));
    });
    req.on("error", reject);
    req.end();
  });
}

/** Extension fichier depuis content-type puis URL. */
function extFrom(ct: string, url: string): string {
  if (MIME_EXT[ct]) return MIME_EXT[ct];
  const u = (url || "").toLowerCase().split("?")[0];
  for (const ext of [".svg", ".png", ".jpg", ".jpeg", ".gif"]) {
    if (u.endsWith(ext)) return ext;
  }
  return ".png";
}

function writeCache(
  slug: string,
  bytes: Buffer,
  ct: string,
  url: string,
  source: ManifestEntry["source"],
): string {
  const ext = extFrom(ct, url);
  const file = `${slug}${ext}`;
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    fs.writeFileSync(path.join(CACHE_DIR, file), bytes);
    const manifest = loadManifest();
    manifest[slug] = {
      file,
      source,
      fetchedAt: Date.now(),
      bytes: bytes.length,
    };
    saveManifest(manifest);
    return `/cache/cs2-teams/${file}`;
  } catch {
    return "/cache/cs2-teams/" + file; // fichier peut-être déjà servi entre les deux
  }
}

// ─── Sources ─────────────────────────────────────────────────────────────────

const BSD_IMG_HOST = "sports.bzzoiro.com";

/** Source 1 : URL BSD id-based déjà attachée au match (SSRF-safe). */
async function fetchFromBsd(remoteUrl: string): Promise<{ bytes: Buffer; ct: string } | null> {
  try {
    const u = new URL(remoteUrl);
    if (u.host !== BSD_IMG_HOST) return null;
    const r = await fetchBytes(remoteUrl);
    return { bytes: r.bytes, ct: r.ct };
  } catch {
    return null;
  }
}

/** Parse `logo=` depuis le wikitext d'infobox Liquipedia (pattern tennis). */
function parseLogoFromWikitext(text: string): string | null {
  const pats = [
    /\|\s*logo\s*=\s*([^\|\}\n]+)/i,
    /\|\s*logo_image\s*=\s*([^\|\}\n]+)/i,
    /\|\s*image\s*=\s*([^\|\}\n]+)/i,
  ];
  for (const re of pats) {
    const m = text.match(re);
    if (!m) continue;
    let f = m[1].trim().replace(/\[\[(?:File|Image):/i, "").replace(/\]\].*$/, "").replace(/^(?:File|Image):/i, "").split("|")[0].trim();
    if (f.length > 3) return f;
  }
  return null;
}

/** Nom de page Liquipedia plausible depuis le nom canonique/slug. */
function liquipediaPageName(slug: string, rawName: string): string {
  const s = rawName.toLowerCase().trim();
  if (s.startsWith("team ")) return slugifyPage(rawName.replace(/^team\s+/i, ""));
  const base = slugifyPage(rawName);
  if (/^(faze|vitality|spirit|liquid|falcons|the|team)/.test(s)) return base;
  return base;
}

function slugifyPage(name: string): string {
  return name
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9_%&'.-]/g, "")
    .replace(/^_+|_+$/g, "");
}

/** Source 2 : Liquipedia CS2 → wikitext infobox → Commons → fichier final.
 *  Backoff 429 : la limite est sévère (budget IP) — 2 tentatives espacées 6 s. */
async function fetchFromLiquipedia(
  rawName: string,
  slug: string,
): Promise<{ bytes: Buffer; ct: string } | null> {
  const page = liquipediaPageName(slug, rawName);
  const apiUrl = `${LIQUIPEDIA_API}?action=parse&page=${encodeURIComponent(page)}&prop=wikitext&format=json&section=0&redirects=1`;
  let attempts = 0;
  while (attempts < 2) {
    attempts++;
    try {
      const r = await fetchBytes(apiUrl, { timeoutMs: 25_000, json: true });
      const j = JSON.parse(r.bytes.toString("utf8")) as {
        parse?: { wikitext?: { "*"?: string } };
      };
      const logoFile = j.parse?.wikitext?.["*"]
        ? parseLogoFromWikitext(j.parse.wikitext["*"])
        : null;
      if (!logoFile) return null;

      for (const base of WIKI_API_LIST) {
        try {
          const u = `${base}/w/api.php?action=query&prop=imageinfo&iiprop=url|size&titles=File:${encodeURIComponent(logoFile)}&format=json&redirects=1`;
          const r2 = await fetchBytes(u, { timeoutMs: 20_000, json: true });
          const j2 = JSON.parse(r2.bytes.toString("utf8")) as {
            query?: { pages?: Record<string, { imageinfo?: { url?: string; size?: number }[] }> };
          };
          const page0 = Object.values(j2.query?.pages ?? {})[0];
          const info = page0?.imageinfo?.[0];
          if (info?.url && !/placeholder|no[_-]?image/i.test(info.url)) {
            const img = await fetchBytes(info.url, { timeoutMs: 30_000 });
            return { bytes: img.bytes, ct: img.ct };
          }
        } catch {
          /* essaie le wiki suivant */
        }
      }
      return null;
    } catch (e) {
      const msg = (e as Error).message;
      if (/429|Rate Limited|rate-limit/i.test(msg) && attempts < 2) {
        await new Promise((r) => setTimeout(r, 6000));
        continue;
      }
      return null;
    }
  }
  return null;
}

// ─── File d'attente de fond (séquentielle, dédup par slug) ───────────────────

let _queue: Promise<unknown> = Promise.resolve();
const _inFlight = new Set<string>();
const _done = new Set<string>();

function queueFetch(spec: TeamLogoSpec): void {
  const slug = slugifyTeamName(spec.name);
  if (_inFlight.has(slug) || _done.has(slug)) return;
  _inFlight.add(slug);

  _queue = _queue.then(async () => {
    try {
      const cached = getTeamLogoUrl(spec.name, spec.remoteUrl);
      if (cached) return;
      let bytes: Buffer | null = null;
      let ct = "";
      let source: ManifestEntry["source"] = "bsd";

      if (spec.remoteUrl) {
        const bsd = await fetchFromBsd(spec.remoteUrl);
        if (bsd) {
          bytes = bsd.bytes;
          ct = bsd.ct;
        }
      }
      if (!bytes) {
        const lp = await fetchFromLiquipedia(spec.name, slug);
        if (lp) {
          bytes = lp.bytes;
          ct = lp.ct;
          source = "liquipedia";
        }
      }
      if (bytes) {
        const local = writeCache(slug, bytes, ct, spec.remoteUrl ?? "", source);
        console.log(`[CS2/Logo] ${slug} → ${local} (${bytes.length}b)`);
      } else {
        console.log(`[CS2/Logo] ${slug} — aucune source disponible, fallback initiales`);
      }
    } catch (e) {
      console.warn(`[CS2/Logo] ${slug} — échec: ${(e as Error).message}`);
    } finally {
      _inFlight.delete(slug);
      _done.add(slug);
      await new Promise((r) => setTimeout(r, 350)); // politesse rate-limit (Liquipedia)
    }
  });
}

/** Flush immédiat de la queue (utilitaire de warm-up synchrone). */
export async function flushLogoQueue(): Promise<void> {
  await _queue;
}

// ─── Point d'entrée public : warm-up des matchs ─────────────────────────────

/**
 * Résout les logos de tous les matchs à venir : les hits cache sont immédiats
 * (URL locale), les misses partent en tâche de fond. Ne bloque jamais la requête.
 */
export function warmMatchesLogos(teams: TeamLogoSpec[]): void {
  for (const t of teams) {
    if (!t.name || t.name.toLowerCase() === "tbd") continue;
    const local = getTeamLogoUrl(t.name, t.remoteUrl);
    if (!local) queueFetch(t);
  }
}

/** URL locale si résolue, sinon null après warmup (pour remplacer logo côté payload). */
export function resolveLogoForPayload(
  name: string,
  remoteUrl?: string | null,
): string | null {
  return getTeamLogoUrl(name, remoteUrl);
}