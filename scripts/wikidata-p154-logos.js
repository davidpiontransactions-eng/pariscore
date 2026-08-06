#!/usr/bin/env node
/**
 * scripts/wikidata-p154-logos.js — Récupère les logos d'équipes via Wikidata P154.
 *
 * Approche : recherche par label (API wbsearchentities) → récupère le logo (P154)
 * via l'API REST Wikidata. Plus fiable que SPARQL pour le matching fuzzy.
 *
 * Usage :
 *   node scripts/wikidata-p154-logos.js --team "Paris Saint-Germain"
 *   node scripts/wikidata-p154-logos.js --from-file scripts/teams.txt --output data/wikidata-logos.json
 */

const https = require("https");
const fs = require("fs");
const path = require("path");

// ─── Wikidata API ────────────────────────────────────────────────────────────

function wikidataGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { "User-Agent": "PariScore/1.0" } }, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error(`Parse: ${e.message}`)); }
      });
    }).on("error", reject);
  });
}

async function searchEntity(name) {
  const url = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(name)}&language=fr&format=json&type=item&limit=3`;
  return wikidataGet(url);
}

async function getEntityClaims(qid) {
  const url = `https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`;
  return wikidataGet(url);
}

function extractLogo(entityData, qid) {
  try {
    const claims = entityData?.entities?.[qid]?.claims;
    if (!claims?.P154) return null;
    // Prefer "preferred" rank, then first "normal"
    const statements = claims.P154;
    const preferred = statements.find((s) => s.rank === "preferred");
    const stmt = preferred ?? statements[0];
    const mainsnak = stmt?.mainsnak;
    if (mainsnak?.snaktype !== "value") return null;
    const filename = mainsnak.datavalue?.value;
    if (!filename) return null;
    const clean = filename.replace(/ /g, "_");
    const hash = require("crypto").createHash("md5").update(clean).digest("hex");
    return `https://upload.wikimedia.org/wikipedia/commons/${hash[0]}/${hash[0]}${hash[1]}/${encodeURIComponent(clean)}`;
  } catch { return null; }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const teamIdx = args.indexOf("--team");
  const fileIdx = args.indexOf("--from-file");
  const outIdx = args.indexOf("--output");

  let teamNames = [];
  if (teamIdx !== -1 && args[teamIdx + 1]) {
    teamNames = [args[teamIdx + 1].trim()];
  } else if (fileIdx !== -1 && args[fileIdx + 1]) {
    const fp = path.resolve(args[fileIdx + 1]);
    if (!fs.existsSync(fp)) { console.error(`Fichier introuvable: ${fp}`); process.exit(1); }
    teamNames = fs.readFileSync(fp, "utf-8").split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
  } else {
    console.error("Usage: node wikidata-p154-logos.js --team <name> | --from-file <teams.txt> [--output <file>]");
    process.exit(1);
  }

  console.log(`🔍 Wikidata P154 — ${teamNames.length} équipe(s)\n`);

  // Charger l'existant si --output spécifié
  let existing = {};
  const outPath = outIdx !== -1 && args[outIdx + 1] ? path.resolve(args[outIdx + 1]) : null;
  if (outPath && fs.existsSync(outPath)) {
    try { existing = JSON.parse(fs.readFileSync(outPath, "utf-8")); } catch {}
  }

  const results = { ...existing };
  let found = 0, withLogo = 0;

  for (const name of teamNames) {
    if (results[name]?.logo) { withLogo++; found++; continue; }

    try {
      const search = await searchEntity(name);
      const items = search?.search ?? [];
      if (items.length === 0) { console.log(`  ❌ ${name}: non trouvé`); continue; }

      // Prendre le premier résultat (meilleur match)
      const top = items[0];
      const entity = await getEntityClaims(top.id);
      const logo = extractLogo(entity, top.id);

      results[name] = {
        label: top.label,
        description: top.description,
        wikidataId: top.id,
        logo,
      };
      found++;
      if (logo) withLogo++;
      console.log(`  ${logo ? "✅" : "⚠️ "} ${name} → ${top.label} (${top.id}) ${logo ? "📷" : "pas de logo"}`);
    } catch (err) {
      console.log(`  ❌ ${name}: ${err.message}`);
    }
    // Rate limit
    await new Promise((r) => setTimeout(r, 300));
  }

  console.log(`\n📊 ${found}/${teamNames.length} trouvées, ${withLogo} avec logo`);

  if (outPath) {
    fs.writeFileSync(outPath, JSON.stringify(results, null, 2), "utf-8");
    console.log(`📄 Sauvegardé: ${outPath}`);
  } else {
    console.log(JSON.stringify(results, null, 2));
  }
}

main().catch((err) => { console.error("❌", err.message); process.exit(1); });

