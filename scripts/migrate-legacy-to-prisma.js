/**
 * scripts/migrate-legacy-to-prisma.js
 * Migration pariscore.db (better-sqlite3) → prisma/dev.db (SQLite via raw SQL).
 *
 * Approche: INSERT direct dans dev.db pour éviter la dépendance Prisma Client
 * au runtime. Le schéma Prisma est déjà appliqué via npx prisma db push.
 *
 * Usage: node scripts/migrate-legacy-to-prisma.js
 */

const D = require("better-sqlite3");
const path = require("path");

const LEGACY_DB = path.join(__dirname, "..", "pariscore.db");
const PRISMA_DB = path.join(__dirname, "..", "prisma", "dev.db");

const src = new D(LEGACY_DB, { readonly: true });
const dst = new D(PRISMA_DB);

console.log("📦 Migration pariscore.db → prisma/dev.db\n");

// ─── Leagues ────────────────────────────────────────────────────────────────

const leagues = src.prepare("SELECT * FROM league_logos").all();
console.log(`  🏆 Leagues: ${leagues.length}`);

const insertLeague = dst.prepare(
  "INSERT OR IGNORE INTO League (id, name, country, logo, sport) VALUES (?, ?, ?, ?, ?)"
);

const migrateLeagues = dst.transaction(() => {
  let count = 0;
  for (const l of leagues) {
    const id = String(l.bsd_league_id);
    const name = l.name || "?";
    const country = l.country || "??";
    const logo = l.logo_url || null;
    const sport = (l.sport || "").includes("soccer") ? "football" : "football";
    const result = insertLeague.run(id, name, country, logo, sport);
    if (result.changes > 0) count++;
  }
  return count;
});

const leagueCount = migrateLeagues();
console.log(`    → ${leagueCount} insérées`);

// ─── Teams ──────────────────────────────────────────────────────────────────

const teams = src.prepare("SELECT * FROM team_logos").all();
console.log(`  ⚽ Teams: ${teams.length}`);

// Debug: check existing teams count
const existingTeams = dst.prepare("SELECT COUNT(*) as n FROM Team").get().n;
console.log(`    (déjà présents: ${existingTeams})`);

const insertTeam = dst.prepare(
  "INSERT INTO Team (id, name, shortName, country, logo, leagueId, updatedAt) VALUES (?, ?, ?, ?, ?, NULL, datetime('now'))"
);

const migrateTeams = dst.transaction(() => {
  let count = 0;
  for (const t of teams) {
    try {
      const id = String(t.bsd_id);
      const name = t.name || "?";
      const shortName = t.short_name || name.slice(0, 3).toUpperCase();
      const country = t.country || null;
      const logo = t.logo_url || null;
      insertTeam.run(id, name, shortName, country, logo);
      count++;
    } catch (err) {
      if (count === 0) console.log(`    ERR first team: ${err.message} — id=${t.bsd_id} name=${t.name}`);
    }
  }
  return count;
});

const teamCount = migrateTeams();
console.log(`    → ${teamCount} insérées`);

// ─── Closing odds → Match + Odds ────────────────────────────────────────────

const closingOdds = src.prepare("SELECT * FROM closing_odds").all();
console.log(`  📊 Closing odds: ${closingOdds.length}`);

// Créer les team stubs d'abord (sinon FOREIGN KEY sur Match échoue)
const ensureTeam = dst.prepare(
  "INSERT OR IGNORE INTO Team (id, name, shortName, updatedAt) VALUES (?, ?, ?, datetime('now'))"
);

const migrateOdds = dst.transaction(() => {
  // Créer les teams stubs
  const teamIds = new Set();
  for (const o of closingOdds) {
    const homeSlug = "team_" + (o.home_team || "?").replace(/[^a-z0-9]/gi, "_").slice(0, 40);
    const awaySlug = "team_" + (o.away_team || "?").replace(/[^a-z0-9]/gi, "_").slice(0, 40);
    if (!teamIds.has(homeSlug)) { ensureTeam.run(homeSlug, o.home_team || "?", (o.home_team || "?").slice(0, 3).toUpperCase()); teamIds.add(homeSlug); }
    if (!teamIds.has(awaySlug)) { ensureTeam.run(awaySlug, o.away_team || "?", (o.away_team || "?").slice(0, 3).toUpperCase()); teamIds.add(awaySlug); }
  }

  let matchCount = 0, oddsCount = 0;
  for (const o of closingOdds) {
    const matchId = o.match_id || "legacy_" + crypto.randomUUID().slice(0, 8);
    const homeId = "team_" + (o.home_team || "?").replace(/[^a-z0-9]/gi, "_").slice(0, 40);
    const awayId = "team_" + (o.away_team || "?").replace(/[^a-z0-9]/gi, "_").slice(0, 40);
    const scheduledAt = (o.commence_time || new Date().toISOString()).replace("Z", "").replace("T", " ").slice(0, 19);
    // Pad to HH:MM:SS if needed
    const padDate = scheduledAt.length < 19 ? scheduledAt + ":00".repeat(Math.max(0, Math.ceil((19 - scheduledAt.length) / 3))) : scheduledAt;

    try {
      const mr = dst.prepare(
        "INSERT INTO Match (id, sport, homeId, awayId, scheduledAt, status, updatedAt) VALUES (?, 'football', ?, ?, ?, 'ft', datetime('now'))"
      ).run(matchId, homeId, awayId, padDate);
      if (mr.changes > 0) matchCount++;
    } catch (err) {
      if (matchCount === 0) console.log(`    ERR match: ${err.message}`);
      continue;
    }

    try {
      const oddsId = "odds_" + crypto.randomUUID().slice(0, 8);
      const bookmaker = o.bk_home || o.source || "legacy";
      dst.prepare(
        "INSERT INTO Odds (id, matchId, bookmaker, home, draw, away) VALUES (?, ?, ?, ?, ?, ?)"
      ).run(oddsId, matchId, bookmaker, o.closing_home ?? 2.0, o.closing_draw ?? 3.5, o.closing_away ?? 3.5);
      oddsCount++;
    } catch (err) {
      if (oddsCount === 0) console.log(`    ERR odds: ${err.message}`);
    }
  }
  return { matchCount, oddsCount };
});

const oddsResult = migrateOdds();
console.log(`    → ${oddsResult.matchCount} matchs, ${oddsResult.oddsCount} odds`);

// ─── KV → KvStore ───────────────────────────────────────────────────────────

const kvRows = src.prepare("SELECT * FROM kv").all();
console.log(`  🗄️  KV: ${kvRows.length}`);

const insertKv = dst.prepare("INSERT OR REPLACE INTO KvStore (key, value) VALUES (?, ?)");

const migrateKv = dst.transaction(() => {
  let count = 0;
  for (const kv of kvRows) {
    insertKv.run(kv.key, kv.value);
    count++;
  }
  return count;
});

const kvCount = migrateKv();
console.log(`    → ${kvCount} insérées`);

// ─── Cleanup ─────────────────────────────────────────────────────────────────

src.close();
dst.close();

console.log(`\n✅ Migration terminée !`);
console.log(`   Leagues: ${leagueCount} | Teams: ${teamCount} | Matchs: ${oddsResult.matchCount} | Odds: ${oddsResult.oddsCount} | KV: ${kvCount}`);
