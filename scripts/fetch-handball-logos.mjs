/**
 * fetch-handball-logos.mjs
 * Couvre les logos des équipes handball via TheSportsDB (clé publique gratuite "3").
 * Zéro dépendance (node:https uniquement, comme scrape-oddalerts.js).
 *
 * Stratégie :
 *   1. Bulk : search_all_teams.php?l=<ligue> pour les ligues mappées (vérifiées à la main).
 *   2. Unitaire : searchteams.php?t=<variantes du nom> pour les équipes restantes
 *      (filtre strSport === "Handball" obligatoire — ex. "PSG" ≠ foot).
 *   3. Confirm : lookupteam.php?id= pour les gros clubs encore manquants.
 * Télécharge strBadge||strLogo dans public/logos/handball/teams/<slug>.png,
 * enrichit public/logos/handball/manifest.json et affiche le snippet TS
 * à fusionner dans TEAM_LOGOS (clés = normHandballName, cf. src/lib/handball-logos.ts).
 *
 * Usage (shell CMD) :
 *   node scripts/fetch-handball-logos.mjs
 *   node scripts/fetch-handball-logos.mjs --leagues-only
 *   node scripts/fetch-handball-logos.mjs --teams=PSG,Wisla Plock
 *   node scripts/fetch-handball-logos.mjs --limit=20 --force
 */
import https from "node:https";
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "data", "flashscore_handball.json");
const TEAMS_DIR = join(ROOT, "public", "logos", "handball", "teams");
const MANIFEST = join(ROOT, "public", "logos", "handball", "manifest.json");
const LOGOS_TS = join(ROOT, "src", "lib", "handball-logos.ts");
// Cache de reprise hors repo (contrainte mission : seuls teams/*, manifest.json,
// TEAM_LOGOS et ce script sont modifiables dans le projet).
const CACHE = join("C:\\Users\\David\\AppData\\Local\\Temp\\opencode", "handball-tsdb-cache.json");

const API = "https://www.thesportsdb.com/api/v1/json/3";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36";
const PAUSE_MS = 2000; // clé free limitée → pause entre appels
const LICENCE = "TheSportsDB fan-copyright, usage éditorial";

// ─── Args ────────────────────────────────────────────────────────────────────
const ARGS = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    return m ? [m[1], m[2] ?? true] : ["_", a];
  }),
);
const ONLY_TEAMS = ARGS.teams ? String(ARGS.teams).split(",").map((s) => s.trim()).filter(Boolean) : null;
const LIMIT = ARGS.limit ? Number(ARGS.limit) : Infinity;
const LEAGUES_ONLY = Boolean(ARGS["leagues-only"]);
const FORCE = Boolean(ARGS.force);

// ─── Normalisation (miroir de normHandballName dans handball-logos.ts) ───────
function norm(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

// Normalisation "match" : sans suffixes femmes/réserve ni parenthèses pays.
// Ligatures nordiques/européennes mappées AVANT NFD (æ/ø ne se décomposent
// pas : "Nordsjælland" perdait sinon son "ae" vs nos "Nordsjaelland").
function normMatch(s) {
  const ascii = String(s || "")
    .replace(/æ/gi, "ae")
    .replace(/œ/gi, "oe")
    .replace(/ø/gi, "o")
    .replace(/å/gi, "a")
    .replace(/ł/gi, "l")
    .replace(/ß/gi, "ss")
    .replace(/đ/gi, "d")
    .replace(/ș/gi, "s")
    .replace(/ț/gi, "t");
  return norm(
    ascii
      .replace(/\s*\([^)]*\)\s*/g, " ")
      .replace(/\s+(w|women|ladies)\s*$/i, "")
      .replace(/\s+(2|ii|iii)\s*$/i, ""),
  );
}

function slugify(s) {
  const base = String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "equipe";
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ─── HTTP (node:https, zero-dép) ─────────────────────────────────────────────
function fetchText(url, isBinary) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { "User-Agent": UA, Accept: "*/*" }, timeout: 25000 }, (res) => {
      if (res.statusCode === 429) {
        res.resume();
        reject(new Error("HTTP 429 rate-limit"));
        return;
      }
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        const loc = res.headers.location.startsWith("http") ? res.headers.location : new URL(res.headers.location, url).href;
        return resolve(fetchText(loc, isBinary));
      }
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error("HTTP " + res.statusCode));
        return;
      }
      if (isBinary) {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve(Buffer.concat(chunks)));
      } else {
        let d = "";
        res.on("data", (c) => (d += c));
        res.on("end", () => resolve(d));
      }
    });
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("timeout"));
    });
    req.on("error", reject);
  });
}

async function fetchJson(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const txt = await fetchText(url, false);
      return JSON.parse(txt);
    } catch (e) {
      console.warn(`  [retry ${i + 1}/${retries}] ${url.split("?")[0].split("/").pop()} : ${e.message}`);
      await sleep(e.message.includes("429") ? 10000 : 5000);
    }
  }
  return null;
}

/** HEAD d'une image de club : taille (o) si 200 image/*, sinon null. */
function probeImage(url) {
  return new Promise((resolve) => {
    const req = https.request(
      url,
      { method: "HEAD", headers: { "User-Agent": UA }, timeout: 15000 },
      (res) => {
        const type = String(res.headers["content-type"] || "");
        const len = parseInt(res.headers["content-length"] || "0", 10);
        res.resume();
        resolve(res.statusCode === 200 && type.startsWith("image/") && len > 0 ? len : null);
      },
    );
    req.on("timeout", () => { req.destroy(); resolve(null); });
    req.on("error", () => resolve(null));
    req.end();
  });
}

// ─── Tables d'alias (noms vérifiés par sondes le 2026-09-24) ─────────────────
// Nos ligues → noms exacts TheSportsDB (search_all_teams ne liste que 5 ligues
// via search_all_leagues mais répond pour d'autres noms : ES/SE/HU OK,
// DE/PT/NO/PL → null, d'où le fallback unitaire).
// Attention : "Hungarian NB I" côté TSDB = la ligue FOOT (strSport Soccer) →
// alias banni ; le handball hongrois est "Hungarian Nemzeti Bajnokság I"
// (vu dans strLeague de Balatonfüredi, via searchteams).
const LEAGUE_ALIASES = {
  Starligue: "French LNH Division 1",
  "Liga ASOBAL": "Spanish Liga ASOBAL",
  "Herre Handbold Ligaen": "Danish Mens Handball League",
  Handbollsligan: "Swedish Handbollsligan",
  "NB I": "Hungarian Nemzeti Bajnokság I",
  "European Cup": "EHF European League",
  // Top-flights vérifiées le 2026-09-24 (10 équipes chacune côté TSDB).
  Bundesliga: "German Handball-Bundesliga",
  Superliga: "Polish Handball Superliga",
};

// Équipes → requêtes ciblées + fragment attendu (quand le nom générique échoue
// ou collide : PSG foot vs hand, acronymes courts, fusions de clubs).
// Règle : fragments accept ≥ 5 caractères (ex. "gog" seul matche "bourGOGne"!).
const TEAM_ALIASES = {
  PSG: { q: ["PSG Handball"], accept: ["parissaintgermain", "psghandball"] },
  "Flensburg-H.": { q: ["SG Flensburg-Handewitt"], accept: ["flensburg"] },
  GOG: { q: ["GOG Handbold"], accept: ["goghandbold"] },
  "NFH W (Den)": { q: ["Nykobing Falster Handbold"], accept: ["nykobing", "falster"] },
  "Odense W (Den)": { q: ["Odense Handbold"], accept: ["odense"] },
  "Gyor W (Hun)": { q: ["Gyori Audi ETO KC", "Gyori ETO KC"], accept: ["audieto", "gyorieto"] },
  "Meshkov Brest": { q: ["Meshkov Brest"], accept: ["meshkov", "brest"] },
  // Gros clubs manquants (relance ciblée) : requêtes précises + fragments longs.
  "RK Zagreb": { q: ["RK PPD Zagreb", "RK Zagreb Handball"], accept: ["ppdzagreb", "rkzagreb"] },
  "Wisla Plock": { q: ["Orlen Wisla Plock"], accept: ["orlenwisla", "wislaplock"] },
  Porto: { q: ["FC Porto Handball"], accept: ["fcporto"] },
  Sporting: { q: ["Sporting CP Handball"], accept: ["sportingcp", "sportinghand"] },
  Benfica: { q: ["SL Benfica Handball"], accept: ["slbenfica", "benficahand"] },
  Elverum: { q: ["Elverum Handball"], accept: ["elverum"] },
  Skjern: { q: ["Skjern Handbold"], accept: ["skjernhand"] },
  Nordsjaelland: { q: ["Nordsjaelland Handbold"], accept: ["nordsjaelland"] },
  "Skanderborg AGF": { q: ["Skanderborg Aarhus Handbold"], accept: ["skanderborg"] },
  Sonderjyske: { q: ["Sonderjyske Handbold"], accept: ["sonderjyske"] },
  "Storhamar W (Nor)": { q: ["Storhamar Handball"], accept: ["storhamar"] },
  "Larvik W": { q: ["Larvik HK Handball", "Larvik Turn Handball"], accept: ["larvikhk", "larvikturn"] },
  "Kristiansand": { q: ["Vipers Kristiansand"], accept: ["vipers"] },
  "Wisla Plock": { q: ["Orlen Wisla Plock", "Wisla Plock Handball", "SPR Wisla Plock"], accept: ["orlenwisla", "wislaplock", "sprwisla"] },
  Benfica: { q: ["Benfica Handball", "S.L. Benfica Handball"], accept: ["benficahand", "slbenfica"] },
  Kristianstad: { q: ["IFK Kristianstad Handball"], accept: ["ifkkristianstad", "kristianstadhand"] },
  // Nations (Asian Games etc.) : le nom seul collide avec le foot ("China" =
  // foot) → requête "X Handball" explicite.
  // StarLigue 2026/27 : clubs promus/renommés introuvables sous le nom flashscore
  // (sonde 2026-09-24 — "Aix" → 0 hit, "PAUC" → 1 hit).
  "Provence Aix": { q: ["PAUC Handball"], accept: ["pauchand"] },
  China: { q: ["China Handball"], accept: ["chinahand"] },
  "China W": { q: ["China Women Handball"], accept: ["chinawomen", "chinahand"] },
  Japan: { q: ["Japan Handball"], accept: ["japanhand"] },
  "Japan W": { q: ["Japan Women Handball"], accept: ["japanwomen", "japanhand"] },
  Qatar: { q: ["Qatar Handball"], accept: ["qatarhand"] },
  Bahrain: { q: ["Bahrain Handball"], accept: ["bahrainghand", "bahrain"] },
  "South Korea": { q: ["South Korea Handball", "Korea Handball"], accept: ["koreahand", "southkorea"] },
  "South Korea W": { q: ["South Korea Women Handball"], accept: ["koreawomen", "koreahand"] },
  Iran: { q: ["Iran Handball"], accept: ["iranhand"] },
  Kazakhstan: { q: ["Kazakhstan Handball"], accept: ["kazakhstanhand"] },
  Kuwait: { q: ["Kuwait Handball"], accept: ["kuwaithand"] },
  "Hong Kong": { q: ["Hong Kong Handball"], accept: ["hongkonghand"] },
  "Hong Kong W": { q: ["Hong Kong Women Handball", "Hong Kong Handball Women"], accept: ["hongkongwomen", "hongkonghand"] },
  "Kazakhstan W": { q: ["Kazakhstan Women Handball", "Kazakhstan Handball Women"], accept: ["kazakhstanwomen", "kazakhstanhand"] },
  "Uzbekistan W": { q: ["Uzbekistan Women Handball"], accept: ["uzbekistanwomen", "uzbekistanhand"] },
};

// Ligues d'équipes nationales → pas de badges clubs (fallback monogramme).
const NATIONAL_LEAGUES = new Set(["Asian Games", "Asian Games Women"]);

// ─── Source 2b : site officiel du club (curée, sondes robots 2026-09-24) ────
// Pour les clubs StarLigue absents de TheSportsDB (sonde : 0 hit Nîmes/Caen/
// Saran/St-Raphael). Que des hôtes dont robots.txt autorise explicitement * :
//   srvhb.com          → Disallow: /wp-admin/ seul
//   usam-nimesgard.fr  → Disallow: (vide = tout autorisé, Yoast)
//   centre-handball.com→ Disallow: (vide = tout autorisé, Yoast)
// Caen (handballvikings.com) : challenge Cloudflare « Attention Required » →
// pas de contournement → non couvert, fallback initiales côté UI.
const CLUB_SOURCES = {
  "St. Raphael": [
    "https://www.srvhb.com/base/uploads/external_dwnld/saint/saint-raphael__logo__2024-2025.png",
  ],
  Nimes: [
    "https://usam-nimesgard.fr/wp-content/uploads/2025/10/LOGO-USAM-BLANC-pour-fond-sombre.png",
  ],
  Saran: [
    "https://www.centre-handball.com/wp-content/uploads/2019/11/SARAN_LOIRET_HB_RVB_400px-e1574332544599.png",
  ],
};
const CLUB_LICENCE = "Logo club (site officiel), usage nominatif éditorial";

// Gros clubs : si searchteams ne donne rien d'exploitable, on tente lookupteam.
const BIG_CLUBS = new Set([
  "PSG", "RK Zagreb", "Meshkov Brest", "Wisla Plock", "Nantes", "Montpellier",
  "Barcelona", "Kiel", "Kielce", "SC Magdeburg", "Szeged", "Vardar 1961",
  "Aalborg", "Celje", "Flensburg-H.", "Fuchse Berlin", "Elverum", "Kolstad",
  "GOG", "Skjern", "Nordsjaelland", "Skanderborg AGF", "Sonderjyske",
  "Porto", "Sporting", "Benfica", "Elverum", "Storhamar W (Nor)", "Larvik W",
  "NFH W (Den)", "Gyor W (Hun)",
]);

// ─── Variantes de requête pour searchteams ───────────────────────────────────
function queryVariants(ours) {
  const out = [];
  const push = (s) => {
    const v = String(s || "").trim();
    if (v && !out.includes(v)) out.push(v);
  };
  push(ours);
  const noParen = ours.replace(/\s*\([^)]*\)\s*/g, " ").trim();
  push(noParen);
  push(noParen.replace(/\s+(w|women|ladies)\s*$/i, "").trim());
  push(noParen.replace(/\s+(2|ii|iii)\s*$/i, "").trim());
  // Clubs fusionnés "A/B" ou "A-B" → chaque morceau (ex. Bjerringbro/Silkeborg).
  for (const part of noParen.split(/[/-]/)) push(part);
  const alias = TEAM_ALIASES[ours];
  if (alias) for (const q of alias.q) push(q);
  return out.filter((v) => normMatch(v).length >= 4);
}

// Acceptation d'un candidat TheSportsDB pour "ours" (garde anti-collision).
function acceptCandidate(ours, query, cand) {
  if (!cand || cand.strSport !== "Handball") return false;
  if (!cand.strBadge && !cand.strLogo) return false;
  const rn = normMatch(cand.strTeam);
  const qn = normMatch(query);
  const alias = TEAM_ALIASES[ours];
  if (alias && alias.accept.some((frag) => rn.includes(norm(frag)))) return true;
  if (!qn || qn.length < 4 || !rn) return false;
  return qn === rn || (rn.length >= 4 && qn.includes(rn)) || (qn.length >= 4 && rn.includes(qn));
}

// ─── Clés TEAM_LOGOS existantes (pour le taux de couverture) ─────────────────
function existingTeamKeys() {
  const src = readFileSync(LOGOS_TS, "utf8");
  const m = src.match(/const TEAM_LOGOS[^=]*=\s*\{([\s\S]*?)\n\};/);
  if (!m) return new Set();
  return new Set([...m[1].matchAll(/^\s*"?([a-z0-9]+)"?\s*:/gm)].map((x) => x[1]));
}

function isCovered(name, keys) {
  const n = norm(name);
  if (!n) return false;
  if (keys.has(n)) return true;
  for (const k of keys) {
    if (k.length >= 4 && (n.includes(k) || k.includes(n))) return true;
  }
  return false;
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  mkdirSync(TEAMS_DIR, { recursive: true });
  const data = JSON.parse(readFileSync(DATA, "utf8"));
  const matches = data.matches || [];

  // Équipes uniques + ligue majoritaire.
  const byTeam = new Map();
  for (const m of matches) {
    for (const side of [m.home, m.away]) {
      if (!side) continue;
      if (!byTeam.has(side)) byTeam.set(side, new Map());
      const leagues = byTeam.get(side);
      leagues.set(m.league, (leagues.get(m.league) || 0) + 1);
    }
  }
  let teams = [...byTeam.entries()].map(([name, leagues]) => ({
    name,
    league: [...leagues.entries()].sort((a, b) => b[1] - a[1])[0][0],
  }));
  if (ONLY_TEAMS) {
    const want = new Set(ONLY_TEAMS.map((s) => norm(s)));
    teams = teams.filter((t) => want.has(norm(t.name)));
  }
  teams = teams.slice(0, LIMIT);
  const allLeagues = [...new Set(teams.map((t) => t.league))].sort();

  const keys = existingTeamKeys();
  const coveredBefore = teams.filter((t) => isCovered(t.name, keys)).length;

  // Manifest existant (fusion, pas d'écrasement).
  let manifest = { generated_at: "", total_bytes: 0, assets: [] };
  try {
    manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
  } catch { /* premier run */ }
  const byFile = new Map((manifest.assets || []).map((a) => [a.file, a]));

  const found = new Map(); // nom nôtre → { file, url_source, label, size, via }
  // Reprise : résultats TSDB déjà résolus (hors repo, voir CACHE).
  // Les échecs sont mémorisés ({ miss: true }) sauf --retry-missing.
  const RETRY_MISSING = Boolean(ARGS["retry-missing"]);
  let cache = {};
  try {
    cache = JSON.parse(readFileSync(CACHE, "utf8"));
    const nHit = Object.values(cache).filter((v) => v && !v.miss).length;
    const nMiss = Object.values(cache).filter((v) => v && v.miss).length;
    if (nHit || nMiss) console.log(`[cache] ${nHit} résolues + ${nMiss} échecs (reprise)`);
  } catch { /* pas de cache */ }
  for (const t of teams) {
    if (cache[t.name] && !cache[t.name].miss) found.set(t.name, cache[t.name]);
  }
  const saveCache = () => {
    try {
      const obj = { ...cache };
      for (const [k, v] of found) obj[k] = v;
      cache = obj;
      writeFileSync(CACHE, JSON.stringify(obj, null, 2));
    } catch { /* cache best-effort */ }
  };
  let apiCalls = 0;
  let addedBytes = 0;
  const unmappedLeagues = [];
  const missing = [];

  const api = async (url) => {
    apiCalls++;
    const j = await fetchJson(url);
    await sleep(PAUSE_MS);
    return j;
  };

  // ── 1. Bulk par ligue mappée ──────────────────────────────────────────────
  console.log(`[bulk] ${Object.keys(LEAGUE_ALIASES).length} ligues mappées`);
  const bulkIndex = new Map(); // normMatch(strTeam) → team
  for (const [ours, tsdb] of Object.entries(LEAGUE_ALIASES)) {
    // Toujours tout le bulk (6 appels) : le matching cross-ligue en dépend
    // (ex. Aguas Santas, club portugais présent dans le bulk EHF European League).
    const j = await api(`${API}/search_all_teams.php?l=${encodeURIComponent(tsdb)}`);
    const list = j && j.teams ? j.teams : null;
    if (!list) {
      console.log(`[bulk] ${ours} → "${tsdb}" : NULL (non mappé côté TSDB)`);
      unmappedLeagues.push(`${ours} (alias "${tsdb}" → null)`);
      continue;
    }
    console.log(`[bulk] ${ours} → "${tsdb}" : ${list.length} équipes`);
    for (const t of list) bulkIndex.set(normMatch(t.strTeam), t);
  }

  // Match bulk contre TOUTES nos équipes (cross-ligue : ex. Aguas Santas via EHF).
  // Gardes : strSport Handball obligatoire (ex. "Hungarian NB I" = foot) et
  // chevauchement includes interdit si le côté court fait < 5 caractères
  // (ex. "gog" dans "bourGOGne" = Dijon, pas GOG).
  for (const t of teams) {
    if (isCovered(t.name, keys) || found.has(t.name)) continue;
    const n = normMatch(t.name);
    let hit = bulkIndex.get(n);
    if (hit && hit.strSport !== "Handball") hit = null;
    if (!hit) {
      for (const [rn, cand] of bulkIndex) {
        if (cand.strSport && cand.strSport !== "Handball") continue;
        if (Math.min(rn.length, n.length) < 5) continue;
        if (rn.length >= 4 && (n.includes(rn) || rn.includes(n))) {
          hit = cand;
          break;
        }
      }
    }
    if (hit && (hit.strBadge || hit.strLogo)) {
      found.set(t.name, { tsdb: hit, via: "bulk" });
      saveCache();
    }
  }
  console.log(`[bulk] matchés : ${found.size}/${teams.length}`);

  // ── 2. Unitaire searchteams pour les restants ─────────────────────────────
  if (!LEAGUES_ONLY) {
    const rest = teams.filter(
      (t) =>
        !isCovered(t.name, keys) &&
        !found.has(t.name) &&
        // Relance explicite (--teams=) : on cherche même les nations.
        (ONLY_TEAMS || !NATIONAL_LEAGUES.has(t.league)) &&
        (RETRY_MISSING || !cache[t.name]?.miss),
    );
    console.log(`[unitaire] ${rest.length} équipes à chercher (nationaux exclus)`);
    for (const t of rest) {
      let hit = null;
      for (const q of queryVariants(t.name)) {
        const j = await api(`${API}/searchteams.php?t=${encodeURIComponent(q)}`);
        const cands = j && j.teams ? j.teams : [];
        hit = cands.find((c) => acceptCandidate(t.name, q, c)) || null;
        if (hit) {
          console.log(`[hit] ${t.name} ← "${hit.strTeam}" (q="${q}")`);
          break;
        }
      }
      // 3. Confirm lookupteam pour les gros clubs sans image exploitable.
      if (!hit && BIG_CLUBS.has(t.name)) {
        console.log(`[lookup] gros club manquant : ${t.name} (rien via searchteams)`);
      }
      if (hit) {
        found.set(t.name, { tsdb: hit, via: "searchteams" });
        saveCache();
      } else {
        // Mémorise l'échec (évite de repayer les appels à la reprise) ;
        // relance ciblée possible via --teams=X --retry-missing.
        cache[t.name] = { miss: true };
        saveCache();
        missing.push(t.name);
      }
    }
  }

  // ── 2b. Sites officiels clubs (curés) pour les restants StarLigue ─────────
  for (const [ours, urls] of Object.entries(CLUB_SOURCES)) {
    const target = teams.find((t) => t.name === ours);
    if (!target || isCovered(ours, keys) || found.has(ours)) continue;
    for (const url of urls) {
      const ok = await probeImage(url);
      if (ok) {
        found.set(ours, { club: { url, label: ours }, via: "site-officiel" });
        console.log(`[club] ${ours} ← ${url} (${ok} o)`);
        // L'étape unitaire (TSD) a pu mémoriser l'échec : on le retire (succès 2b).
        const ix = missing.indexOf(ours);
        if (ix >= 0) missing.splice(ix, 1);
        break;
      }
      await sleep(500);
    }
    if (!found.has(ours)) {
      cache[ours] = { miss: true };
      saveCache();
      missing.push(ours);
    }
  }

  // ── 3. Téléchargements ────────────────────────────────────────────────────
  const newEntries = [];
  for (const [ours, entry] of found) {
    const { via } = entry;
    const img = entry.club ? entry.club.url : entry.tsdb.strBadge || entry.tsdb.strLogo;
    const label = entry.club ? entry.club.label : entry.tsdb.strTeam;
    const ext = /\.svg(\?|$)/i.test(img) ? ".svg" : ".png";
    let slug = slugify(ours);
    let dest = join(TEAMS_DIR, slug + ext);
    let i = 2;
    while (existsSync(dest) && statSync(dest).size > 0 && !isOurFile(dest, ours)) {
      slug = `${slugify(ours)}-${i++}`;
      dest = join(TEAMS_DIR, slug + ext);
    }
    const rel = `teams/${slug}${ext}`;
    if (existsSync(dest) && statSync(dest).size > 0 && !FORCE) {
      const size = statSync(dest).size;
      byFile.set(rel, {
        file: rel,
        url_source: img,
        label,
        licence: LICENCE,
        attribution_requise: false,
        ok: true,
        size,
      });
      newEntries.push({ key: norm(ours), file: `/logos/handball/teams/${slug}${ext}`, ours });
      console.log(`[skip] ${ours} (déjà présent : ${rel})`);
      continue;
    }
    try {
      const buf = await fetchText(img, true);
      apiCalls++;
      if (!buf || buf.length === 0) throw new Error("image vide");
      writeFileSync(dest, buf);
      addedBytes += buf.length;
      byFile.set(rel, {
        file: rel,
        url_source: img,
        label,
        licence: LICENCE,
        attribution_requise: false,
        ok: true,
        size: buf.length,
      });
      newEntries.push({ key: norm(ours), file: `/logos/handball/teams/${slug}${ext}`, ours });
      console.log(`[dl] ${ours} → ${rel} (${buf.length} o, via ${via})`);
    } catch (e) {
      console.warn(`[dl-err] ${ours} : ${e.message}`);
      missing.push(ours);
    }
    await sleep(500);
  }

  // ── 4. Manifest + stats ───────────────────────────────────────────────────
  const assets = [...byFile.values()].sort((a, b) => a.file.localeCompare(b.file));
  const totalBytes = assets.reduce((s, a) => s + (a.size || 0), 0);
  writeFileSync(
    MANIFEST,
    JSON.stringify({ generated_at: new Date().toISOString(), total_bytes: totalBytes, assets }, null, 2) + "\n",
  );

  for (const l of allLeagues) {
    if (!LEAGUE_ALIASES[l] && !unmappedLeagues.includes(l)) unmappedLeagues.push(l);
  }

  // Manquantes = échecs frais + échecs mémorisés (non résolus depuis).
  for (const t of teams) {
    if (!isCovered(t.name, keys) && !found.has(t.name) && cache[t.name]?.miss && !missing.includes(t.name)) {
      missing.push(t.name);
    }
  }
  const allKeys = new Set([...keys, ...newEntries.map((e) => e.key)]);
  const coveredAfter = teams.filter((t) => isCovered(t.name, allKeys)).length;

  console.log("\n===== RÉSULTAT =====");
  console.log(`Équipes : ${teams.length} | couvertes avant : ${coveredBefore} | après : ${coveredAfter}`);
  console.log(`Téléchargées ce run : ${newEntries.length} (${addedBytes} o ajoutés, manifest total ${totalBytes} o)`);
  console.log(`Appels API : ${apiCalls}`);
  console.log(`Ligues non mappées (${unmappedLeagues.length}) : ${unmappedLeagues.join(" ; ")}`);
  console.log(`Manquantes (${missing.length}) : ${missing.sort().join(" ; ")}`);

  console.log("\n===== SNIPPET TEAM_LOGOS (clés normHandballName) =====");
  for (const e of newEntries.sort((a, b) => a.key.localeCompare(b.key))) {
    console.log(`  ${e.key}: "${e.file}", // ${e.ours}`);
  }
}

// Un fichier existant appartient-il déjà à "ours" (évite les collisions) ?
// Le suffixe numérique anti-collision (-2, -3…) fait partie du slug comparé :
// on ne le retire que s'il ne correspond pas au slug complet ("cocks-2"
// ≠ "cocks" + suffixe, le "-2" désigne l'équipe réserve).
function isOurFile(dest, ours) {
  const name = dest
    .split(/[\\/]/)
    .pop()
    .replace(/\.(png|svg)$/i, "");
  const slug = slugify(ours);
  if (name === slug) return true;
  const m = name.match(/^(.*)-\d+$/);
  const base = m ? m[1] : name;
  return (
    base === slug || slug.startsWith(base + "-") || base.startsWith(slug + "-")
  );
}

main().catch((e) => {
  console.error("FATAL : " + (e && e.message));
  process.exit(1);
});
