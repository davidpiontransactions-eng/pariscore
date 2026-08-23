const { execSync } = require("child_process");

function run(cmd) {
  console.log("> " + cmd);
  try {
    console.log(execSync(cmd, { encoding: "utf8", stdio: "pipe" }).trim());
  } catch (e) {
    console.error("FAILED: " + cmd);
    console.error((e.stdout || "") + (e.stderr || ""));
    process.exit(1);
  }
}

const L10_FILES = [
  "ecosystem.config.js",
  "prisma/schema.prisma",
  "scripts/update_vps.sh",
  "scripts/cron-tennis-elo-weekly.sh",
  "scripts/scrape-tennis-elo-weekly.ts",
  "scripts/qa-l10-service-test.ts",
  "scripts/qa-l10-seed.ts",
  "scripts/qa-l10-db.ts",
  "src/app/api/tennis/player-stats/route.ts",
  "src/components/tennis/player-statline.tsx",
  "src/lib/tennis-stats/types.ts",
  "src/lib/tennis-elo/jsfrag.ts",
  "src/lib/tennis-elo/l10-surface.ts",
  "src/types/tennis-l10.ts",
  "src/messages/fr.json",
  "src/messages/en.json",
];

// 1er commit : feature L10 Surface
run("git add " + L10_FILES.join(" "));
run(
  'git commit -m "feat(tennis): L10 Surface - score Elo fige par semaine + badge surperformance" -m "Cron hebdo lundi 14h Paris (TennisAbstract jsfrags + Elo snapshots) -> tables Prisma TennisEloSnapshot/TennisPlayerMatch; calcul L10 (10 derniers matchs, meme surface, 3 mois, Elo fige par semaine, borne 30j, bareme 1/3/5/7/10); API player-stats enrichie (l10Surface); badge UI + tooltip (adversaire, tournoi, score, points) + categorie sous-performant(<10)/moyen(10-24)/surperformance(>=25); db push au deploy"'
);

// 2e commit : fix live football
run("git add src/components/football/football-tab-content.tsx");
run('git commit -m "fix(football): filtrage ligue des matchs live (liveMatches ignorait le filtre selectedLeague)"');

// push
run("git push origin HEAD");
console.log("DONE");