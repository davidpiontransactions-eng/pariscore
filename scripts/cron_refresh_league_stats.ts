/**
 * Cron job — pré-chauffe le cache des stats de toutes les ligues.
 *
 * Appelle l'API locale `/api/v1/leagues/:id/stats` pour chaque ligue
 * et chaque location (all/home/away), ce qui peuple le cache globalThis.
 *
 * Usage:
 *   bun run scripts/cron_refresh_league_stats.ts
 *   # ou via PM2 cron_restart: '0 */6 * * *' (toutes les 6h)
 *
 * Timeout: 10 min max (si BSD lent, on abandonne et on garde le cache existant).
 */

const BASE = "http://localhost:3005";
const LEAGUES = [
  "ligue1", "ligue2", "epl", "championship", "laliga", "laliga2",
  "bundesliga", "bundesliga2", "seriea", "serieb",
  "primeira_liga", "eredivisie", "jupiler", "super_lig",
  "russian_premier", "scot_prem",
  "superleague_greece", "super_league_swiss", "allsvenskan",
  "liga_1_romania", "first_league_cze", "j1_league", "k_league1",
  "argentina_primera", "austria_bundesliga", "denmark_superliga",
  "norway_eliteserien", "australia_a_league",
];
const LOCATIONS = ["all", "home", "away"];

async function main() {
  console.log(`[cron-league-stats] Starting refresh for ${LEAGUES.length} leagues × ${LOCATIONS.length} locations`);
  const start = Date.now();
  let ok = 0;
  let fail = 0;

  for (const league of LEAGUES) {
    for (const loc of LOCATIONS) {
      const url = `${BASE}/api/v1/leagues/${league}/stats?location=${loc}`;
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
        if (res.ok) {
          ok++;
        } else {
          const body = await res.text().catch(() => "");
          console.log(`[cron-league-stats] ${league}/${loc}: HTTP ${res.status} — ${body.slice(0, 100)}`);
          fail++;
        }
      } catch (err) {
        console.log(`[cron-league-stats] ${league}/${loc}: ${(err as Error).message}`);
        fail++;
      }
      // Petit délai pour ne pas saturer le serveur local
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`[cron-league-stats] Done in ${elapsed}s — ${ok} OK, ${fail} failed`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("[cron-league-stats] Fatal:", err.message);
  process.exit(1);
});
