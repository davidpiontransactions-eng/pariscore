/**
 * CRON Job pour la mise à jour des données FIBA.
 * 
 * Ce script met à jour:
 * 1. Les stats des équipes (Basketball Reference)
 * 2. Les cotes (The Odds API)
 * 3. Les résultats (ESPN FIBA)
 * 
 * Exécution: node scripts/fiba-cron.js
 * Recommandé: toutes les 30 minutes pendant le tournoi
 * 
 * En production, utiliser:
 * - Vercel Cron Jobs (vercel.json)
 * - Ou pm2 cron (sur VPS)
 */

import { scrapeAllTeamStats } from "../src/lib/scraping/fiba-stats-scraper.js";

const ODDS_API_KEY = process.env.ODDS_API_KEY;
const FIBA_API_BASE = "https://site.web.api.espn.com/apis/site/v2/sports/basketball/fiba";

/**
 * Met à jour les stats des équipes.
 */
async function updateTeamStats() {
  console.log("[CRON] Updating team stats...");
  
  try {
    const stats = await scrapeAllTeamStats();
    console.log(`[CRON] Updated stats for ${stats.length} teams`);
    
    // En production: sauvegarder en base (Prisma)
    // await prisma.fibaTeamStats.createMany({ data: stats });
    
    return { success: true, count: stats.length };
  } catch (error) {
    console.error("[CRON] Failed to update team stats:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Met à jour les cotes depuis The Odds API.
 */
async function updateOdds() {
  if (!ODDS_API_KEY) {
    console.log("[CRON] No ODDS_API_KEY, skipping odds update");
    return { success: true, count: 0 };
  }

  console.log("[CRON] Updating odds...");
  
  try {
    const url = `https://api.the-odds-api.com/v4/sports/basketball_fiba/odds/?apiKey=${ODDS_API_KEY}&regions=eu&markets=h2h`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Odds API error: ${response.status}`);
    }
    
    const data = await response.json();
    console.log(`[CRON] Updated odds for ${data.length} matches`);
    
    // En production: sauvegarder en base
    // await prisma.fibaOdds.createMany({ data: data.map(parseOdds) });
    
    return { success: true, count: data.length };
  } catch (error) {
    console.error("[CRON] Failed to update odds:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Met à jour les résultats depuis ESPN FIBA.
 */
async function updateResults() {
  console.log("[CRON] Updating results...");
  
  try {
    const url = `${FIBA_API_BASE}/scoreboard`;
    const response = await fetch(url, {
      headers: { "User-Agent": "PariScore/1.0" },
    });
    
    if (!response.ok) {
      throw new Error(`ESPN API error: ${response.status}`);
    }
    
    const data = await response.json();
    const events = data?.events ?? [];
    const completed = events.filter((e) => e.status?.type?.completed);
    
    console.log(`[CRON] Found ${completed.length} completed matches`);
    
    // En production: sauvegarder les résultats
    // await prisma.fibaResults.createMany({ data: completed.map(parseResult) });
    
    return { success: true, count: completed.length };
  } catch (error) {
    console.error("[CRON] Failed to update results:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Main: exécute toutes les mises à jour.
 */
async function main() {
  console.log("[CRON] Starting FIBA data update...");
  console.log(`[CRON] Time: ${new Date().toISOString()}`);
  
  const results = {
    stats: await updateTeamStats(),
    odds: await updateOdds(),
    results: await updateResults(),
  };
  
  const summary = {
    timestamp: new Date().toISOString(),
    stats: results.stats.success ? `${results.stats.count} teams` : "FAILED",
    odds: results.odds.success ? `${results.odds.count} matches` : "FAILED",
    results: results.results.success ? `${results.results.count} matches` : "FAILED",
  };
  
  console.log("[CRON] Update complete:", summary);
  
  // En production: envoyer un webhook Slack/Discord si échec
  const hasFailure = !results.stats.success || !results.odds.success || !results.results.success;
  if (hasFailure) {
    console.error("[CRON] WARNING: Some updates failed!");
    // await sendSlackAlert(summary);
  }
  
  return summary;
}

// Exécuter si appelé directement
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { main as updateFibaData };
