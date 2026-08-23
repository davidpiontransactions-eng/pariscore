// betmines_extract.cjs — Extrait les données utiles du payload __NUXT__ d'une
// page ligue BetMines (évalué en JSON) et sort un JSON compact sur stdout.
//
// Usage: node betmines_extract.cjs <nuxt.json> <leagueId> <slug>
//
// Sortie : { leagueId, slug, name, country, seasonId, fixtures: [...] }

const fs = require("fs");

const [, , nuxtPath, leagueIdArg, slugArg] = process.argv;
const d = JSON.parse(fs.readFileSync(nuxtPath, "utf-8"));

function shortTeam(t) {
  if (!t || typeof t !== "object") return null;
  return { id: t.id ?? null, name: t.name ?? null };
}

function collectFixtures(root) {
  const out = [];
  const seen = new Set();
  function visit(node, depth) {
    if (!node || typeof node !== "object" || depth > 6) return;
    if (Array.isArray(node)) {
      // tableau de fixtures : objets avec localTeam+visitorTeam+dateTime
      const looksFixtures =
        node.length > 0 &&
        node.every(
          (x) => x && typeof x === "object" && ("localTeam" in x || "homeTeam" in x) && ("visitorTeam" in x || "awayTeam" in x),
        );
      if (looksFixtures) {
        for (const f of node) {
          const key = `${f.id ?? ""}|${f.dateTime ?? f.date ?? ""}`;
          if (seen.has(key)) continue;
          seen.add(key);
          out.push(f);
        }
        return;
      }
      for (const x of node) visit(x, depth + 1);
      return;
    }
    for (const v of Object.values(node)) visit(v, depth + 1);
  }
  visit(root, 0);
  return out;
}

function mapFixture(f) {
  const odd = f.fixtureOdd && typeof f.fixtureOdd === "object" ? f.fixtureOdd : null;
  const pickOdd = {};
  if (odd) {
    for (const [k, v] of Object.entries(odd)) {
      if (/corner/i.test(k) || /^(odd|probability)/i.test(k)) pickOdd[k] = v;
    }
  }
  return {
    id: f.id ?? null,
    dateTime: f.dateTime ?? f.date ?? null,
    status: f.timeStatus ?? null,
    home: shortTeam(f.localTeam ?? f.homeTeam),
    away: shortTeam(f.visitorTeam ?? f.awayTeam),
    homePos: f.localTeamPosition ?? null,
    awayPos: f.visitorTeamPosition ?? null,
    bestOddProbability: f.bestOddProbability ?? null,
    odds: Object.keys(pickOdd).length ? pickOdd : undefined,
  };
}

// méta ligue : chercher dans fetch.* un objet avec selectedLeagueId/seasonId
let meta = { leagueId: Number(leagueIdArg) || null, slug: slugArg ?? null, name: null, country: null, seasonId: null };
(function findMeta(node, depth) {
  if (!node || typeof node !== "object" || depth > 5 || meta.name) return;
  if (Array.isArray(node)) {
    for (const x of node) findMeta(x, depth + 1);
    return;
  }
  if ("selectedLeagueId" in node && "seasonId" in node) {
    meta.leagueId = node.selectedLeagueId ?? meta.leagueId;
    meta.name = node.displayedLeagueName ?? node.selectedLeague ?? null;
    meta.country = node.displayedLeagueCountry ?? null;
    meta.seasonId = node.seasonId ?? null;
    return;
  }
  for (const v of Object.values(node)) findMeta(v, depth + 1);
})(d, 0);

const fixturesRaw = collectFixtures({ fetch: d.fetch, data: d.data });
const fixtures = fixturesRaw.map(mapFixture);

console.log(
  JSON.stringify({
    leagueId: meta.leagueId,
    slug: meta.slug,
    name: meta.name,
    country: meta.country,
    seasonId: meta.seasonId,
    nFixtures: fixtures.length,
    fixtures,
  }),
);
