/**
 * warm-cs2-logos.ts — Pré-remplissage du cache disque des logos CS2.
 *
 * Stratégie :
 *   1. BSD teams list (si l'API répond → URLs id-based directes)
 *   2. Top 30 HLTV (data/hltv_rankings.json) via Liquipedia en complément
 *
 * Usage :  bun run scripts/warm-cs2-logos.ts
 * Sortie : public/cache/cs2-teams/{slug}.{png|svg} + manifest.json
 */
import fs from "node:fs";
import path from "node:path";
import {
  slugifyTeamName,
  warmMatchesLogos,
  flushLogoQueue,
} from "../src/lib/cs2/cs2-team-logo-engine";

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { "User-Agent": "PariScore/1.0 (cs2-logo-warmup)" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function main() {
  const specs: { name: string; remoteUrl?: string | null }[] = [];
  const seen = new Set<string>();

  const add = (name: string, remoteUrl?: string | null) => {
    const slug = slugifyTeamName(name);
    if (seen.has(slug) || !name || name.toLowerCase() === "tbd") return;
    seen.add(slug);
    specs.push({ name, remoteUrl });
  };

  // 1. BSD teams (si dispo)
  try {
    const key = process.env.BSD_API_KEY;
    if (key) {
      let page = 1;
      while (page <= 5) {
        const res = await fetch(
          `https://sports.bzzoiro.com/csgo/api/v2/teams/?page_size=100&page=${page}&tz=Europe/Paris`,
          {
            headers: {
              Authorization: `Token ${key}`,
              "User-Agent": "PariScore/1.0 (cs2-logo-warmup)",
            },
            signal: AbortSignal.timeout(20_000),
          },
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const j = (await res.json()) as { teams?: { name?: string; image_url?: string | null; id?: number | null }[] };
        const list = Array.isArray(j) ? j : (j.teams ?? []);
        if (list.length === 0) break;
        for (const t of list) {
          if (t.name)
            add(t.name, t.image_url || `https://sports.bzzoiro.com/img/csgo-team/${t.id}/?bg=transparent`);
        }
        if (list.length < 100) break;
        page++;
      }
    }
  } catch (e) {
    console.log("[warm] BSD teams indisponible:", (e as Error).message);
  }

  // 2. Top 30 HLTV — Liquipedia
  try {
    const rank = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "data", "hltv_rankings.json"), "utf8"),
    ) as { teams?: { name: string }[] };
    for (const t of rank.teams ?? []) add(t.name);
  } catch (e) {
    console.log("[warm] rankings JSON indisponible:", (e as Error).message);
  }

  console.log(`[warm] ${specs.length} équipes à résoudre…`);
  warmMatchesLogos(specs); // hits cache = instantanés, misses → file de fond
  await flushLogoQueue();

  const files = fs.existsSync(path.join(process.cwd(), "public", "cache", "cs2-teams"))
    ? fs.readdirSync(path.join(process.cwd(), "public", "cache", "cs2-teams"))
    : [];
  console.log(`[warm] Terminé — ${specs.length} équipes traitées, cache: ${files.join(", ")}`);
}

main().catch((e) => {
  console.error("[warm] Échec:", e);
  process.exit(1);
});