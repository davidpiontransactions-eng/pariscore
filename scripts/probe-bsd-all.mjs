// Probe BSD multi-sections — voit quelles API passent (quota taster = football-only ?).
import { readFileSync, writeFileSync } from "node:fs";

const outFile = new URL("../data/probe-result.txt", import.meta.url);
const log = (s) => { try { writeFileSync(outFile, s + "\n", { flag: "a" }); } catch { /* */ } };

const env = readFileSync(new URL("../.env", import.meta.url), "utf8");
const key = env.match(/^BSD_API_KEY=(.+)$/m)?.[1]?.trim();
if (!key) { log("RESULT: KEY_MISSING"); process.exit(0); }

const targets = [
  ["football-league", "https://sports.bzzoiro.com/api/v2/leagues/6/season/"],
  ["tennis-matches", "https://sports.bzzoiro.com/api/v2/matches/?limit=1"],
  ["hockey-matches", "https://sports.bzzoiro.com/api/hockey/matches/?limit=1"],
  ["coverage", "https://sports.bzzoiro.com/api/v2/coverage/"],
];

for (const [label, url] of targets) {
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Token ${key}`, Accept: "application/json" },
      signal: AbortSignal.timeout(15000),
    });
    const body = await res.text();
    log(`${label}: HTTP ${res.status} ${body.slice(0, 160)}`);
  } catch (err) {
    log(`${label}: FETCH_ERROR ${err?.message ?? err}`);
  }
}
