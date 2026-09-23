// Probe events BSD v2 — une ligne par event : id | status | date | match.
import { readFileSync, writeFileSync } from "node:fs";
const outFile = new URL("../data/probe-result.txt", import.meta.url);
const log = (s) => { try { writeFileSync(outFile, s + "\n", { flag: "a" }); } catch { /* */ } };
const env = readFileSync(new URL("../.env", import.meta.url), "utf8");
const key = env.match(/^BSD_API_KEY=(.+)$/m)?.[1]?.trim();
if (!key) { log("RESULT: KEY_MISSING"); process.exit(0); }
const url = "https://sports.bzzoiro.com/api/v2/events/?league_id=6&season_id=1311&limit=30";
try {
  const res = await fetch(url, { headers: { Authorization: `Token ${key}`, Accept: "application/json" }, signal: AbortSignal.timeout(20000) });
  log(`events-v2: HTTP ${res.status}`);
  const json = await res.json();
  const first = (json.results ?? [])[0];
  log(`keys: ${first ? Object.keys(first).join(",") : "(none)"}`);
  const rows = (json.results ?? []).map((e) =>
    `${e.id} | ${e.status} | ${e.event_date} | ${e.home_team} - ${e.away_team} | homeObj=${e.home_team_obj?.id ?? "X"} awayObj=${e.away_team_obj?.id ?? "X"}`
  );
  log(`count=${json.count}`);
  for (const r of rows) log(r);
} catch (err) {
  log(`events-v2: FETCH_ERROR ${err?.message ?? err}`);
}
