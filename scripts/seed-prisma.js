/**
 * scripts/seed-prisma.js — Peuple la DB Prisma avec les matchs mock.
 * Usage: node scripts/seed-prisma.js
 */
const { PrismaClient } = require("@prisma/client");

const MOCK_MATCHES = [
  { id: "mock_fl1", league: { id: "ligue1", name: "Ligue 1", country: "France", logo: "🇫🇷", tier: "T1" },
    round: "Journée 1", scheduledAt: new Date(Date.now() + 3600000).toISOString(),
    home: { id: "psg", name: "Paris Saint-Germain", shortName: "PSG", logo: "https://sfile.chatglm.cn/images-ppt/psg.png", color: "#004170", form: ["W","W","W","D","W"], rank: 1 },
    away: { id: "marseille", name: "Olympique de Marseille", shortName: "OM", logo: "https://sfile.chatglm.cn/images-ppt/marseille.png", color: "#2FAEE0", form: ["W","L","W","W","D"], rank: 3 },
    prediction: { homeProb: 65, drawProb: 20, awayProb: 15, bttsProb: 55, over25Prob: 68, model: "Elo+Poisson" },
    odds: { bookmaker: "Bet365", home: 1.55, draw: 4.20, away: 5.50 }, live: null },
  { id: "mock_fl2", league: { id: "epl", name: "Premier League", country: "England", logo: "🏴", tier: "T1" },
    round: "Matchweek 1", scheduledAt: new Date(Date.now() + 7200000).toISOString(),
    home: { id: "mancity", name: "Manchester City", shortName: "MCI", logo: "https://sfile.chatglm.cn/images-ppt/mancity.png", color: "#6CABDD", form: ["W","W","W","W","L"], rank: 1 },
    away: { id: "arsenal", name: "Arsenal", shortName: "ARS", logo: "https://sfile.chatglm.cn/images-ppt/arsenal.png", color: "#EF0107", form: ["W","W","D","W","W"], rank: 2 },
    prediction: { homeProb: 55, drawProb: 25, awayProb: 20, bttsProb: 60, over25Prob: 65, model: "Elo+Poisson" },
    odds: { bookmaker: "Bet365", home: 1.80, draw: 3.80, away: 4.00 }, live: { homeScore: 1, awayScore: 1, minute: 35, status: "LIVE" } },
  { id: "mock_fl3", league: { id: "laliga", name: "La Liga", country: "Spain", logo: "🇪🇸", tier: "T1" },
    round: "Jornada 1", scheduledAt: new Date(Date.now() + 10800000).toISOString(),
    home: { id: "real", name: "Real Madrid", shortName: "RMA", logo: "https://sfile.chatglm.cn/images-ppt/real.png", color: "#FEBE10", form: ["W","W","D","W","W"], rank: 2 },
    away: { id: "barca", name: "FC Barcelona", shortName: "FCB", logo: "https://sfile.chatglm.cn/images-ppt/barca.png", color: "#A50044", form: ["W","W","W","L","W"], rank: 1 },
    prediction: { homeProb: 50, drawProb: 25, awayProb: 25, bttsProb: 70, over25Prob: 72, model: "Elo+Poisson" },
    odds: { bookmaker: "Bet365", home: 2.10, draw: 3.60, away: 3.30 }, live: { homeScore: 0, awayScore: 0, minute: 12, status: "LIVE" } },
  { id: "mock_fl4", league: { id: "bundesliga", name: "Bundesliga", country: "Germany", logo: "🇩🇪", tier: "T1" },
    round: "Spieltag 1", scheduledAt: new Date(Date.now() + 14400000).toISOString(),
    home: { id: "bayern", name: "Bayern Munich", shortName: "BAY", logo: "https://sfile.chatglm.cn/images-ppt/bayern.png", color: "#DC052D", form: ["W","W","W","W","W"], rank: 1 },
    away: { id: "dortmund", name: "Borussia Dortmund", shortName: "BVB", logo: "https://sfile.chatglm.cn/images-ppt/dortmund.png", color: "#FDE100", form: ["W","L","W","D","W"], rank: 4 },
    prediction: { homeProb: 60, drawProb: 20, awayProb: 20, bttsProb: 65, over25Prob: 70, model: "Elo+Poisson" },
    odds: { bookmaker: "Bet365", home: 1.65, draw: 4.00, away: 4.50 }, live: null },
  { id: "mock_fl5", league: { id: "seriea", name: "Serie A", country: "Italy", logo: "🇮🇹", tier: "T1" },
    round: "Giornata 1", scheduledAt: new Date(Date.now() + 18000000).toISOString(),
    home: { id: "inter", name: "Inter Milan", shortName: "INT", logo: "https://sfile.chatglm.cn/images-ppt/inter.png", color: "#010E80", form: ["W","W","D","W","W"], rank: 2 },
    away: { id: "juve", name: "Juventus", shortName: "JUV", logo: "https://sfile.chatglm.cn/images-ppt/juve.png", color: "#000000", form: ["W","D","W","W","L"], rank: 3 },
    prediction: { homeProb: 45, drawProb: 30, awayProb: 25, bttsProb: 50, over25Prob: 55, model: "Elo+Poisson" },
    odds: { bookmaker: "Bet365", home: 2.20, draw: 3.40, away: 3.10 }, live: null },
];

const prisma = new PrismaClient();

async function main() {
  console.log("Seed Prisma DB...");
  let lc = 0, tc = 0, mc = 0, pc = 0, oc = 0;

  for (const m of MOCK_MATCHES) {
    // League
    await prisma.league.upsert({ where: { id: m.league.id },
      update: { name: m.league.name, country: m.league.country, logo: m.league.logo },
      create: { id: m.league.id, name: m.league.name, country: m.league.country, logo: m.league.logo, tier: m.league.tier, sport: "football" } });
    lc++;

    // Teams
    for (const t of [m.home, m.away]) {
      await prisma.team.upsert({ where: { id: t.id },
        update: { name: t.name, shortName: t.shortName, logo: t.logo, color: t.color },
        create: { id: t.id, name: t.name, shortName: t.shortName, logo: t.logo, color: t.color, leagueId: m.league.id } });
      tc++;
    }

    // Match
    const status = m.live ? "live" : "scheduled";
    await prisma.match.upsert({ where: { id: m.id },
      update: { leagueId: m.league.id, homeId: m.home.id, awayId: m.away.id, round: m.round, scheduledAt: new Date(m.scheduledAt), status, liveMinute: m.live?.minute ?? null, liveHomeScore: m.live?.homeScore ?? null, liveAwayScore: m.live?.awayScore ?? null, liveStatus: m.live?.status ?? null },
      create: { id: m.id, sport: "football", leagueId: m.league.id, homeId: m.home.id, awayId: m.away.id, round: m.round, scheduledAt: new Date(m.scheduledAt), status, liveMinute: m.live?.minute ?? null, liveHomeScore: m.live?.homeScore ?? null, liveAwayScore: m.live?.awayScore ?? null, liveStatus: m.live?.status ?? null } });
    mc++;

    // Prediction
    await prisma.prediction.upsert({ where: { matchId: m.id },
      update: { homeProb: m.prediction.homeProb, drawProb: m.prediction.drawProb, awayProb: m.prediction.awayProb, bttsProb: m.prediction.bttsProb, over25Prob: m.prediction.over25Prob, model: m.prediction.model },
      create: { matchId: m.id, homeProb: m.prediction.homeProb, drawProb: m.prediction.drawProb, awayProb: m.prediction.awayProb, bttsProb: m.prediction.bttsProb, over25Prob: m.prediction.over25Prob, model: m.prediction.model, edge: 0, confidence: 3 } });
    pc++;

    // Odds
    if (m.odds) {
      const oid = "mock_odds_" + m.id;
      await prisma.odds.upsert({ where: { id: oid },
        update: { bookmaker: m.odds.bookmaker, home: m.odds.home, draw: m.odds.draw, away: m.odds.away },
        create: { id: oid, matchId: m.id, bookmaker: m.odds.bookmaker, home: m.odds.home, draw: m.odds.draw, away: m.odds.away } });
      oc++;
    }
  }

  const total = await prisma.match.count();
  console.log("Leagues:" + lc + " Teams:" + tc + " Matches: " + mc + " Preds:" + pc + " Odds:" + oc + " TotalMatches:" + total);
  await prisma.$disconnect();
}
main().catch(e => { console.error(e.message); process.exit(1); });

