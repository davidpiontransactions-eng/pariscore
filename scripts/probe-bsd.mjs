// Probe BSD — vérifie l'auth + la shape de /v2/leagues/{id}/season/ SANS exposer la clé.
// Écrit le résultat dans data/probe-result.txt (stdout avalé par la couche agent).
import { readFileSync, writeFileSync } from "node:fs";

const outFile = new URL("../data/probe-result.txt", import.meta.url);
const log = (s) => {
  try { writeFileSync(outFile, s + "\n", { flag: "a" }); } catch { /* data/ absent */ }
};

try {
  const env = readFileSync(new URL("../.env", import.meta.url), "utf8");
  const key = env.match(/^BSD_API_KEY=(.+)$/m)?.[1]?.trim();
  if (!key) {
    log("RESULT: KEY_MISSING");
    process.exit(0);
  }
  const id = process.argv[2] ?? "6";
  const res = await fetch(`https://sports.bzzoiro.com/api/v2/leagues/${id}/season/`, {
    headers: { Authorization: `Token ${key}`, Accept: "application/json" },
    signal: AbortSignal.timeout(15000),
  });
  const body = await res.text();
  log(`RESULT: HTTP ${res.status}`);
  log(`BODY_HEAD: ${body.slice(0, 300)}`);
} catch (err) {
  log(`RESULT: FETCH_ERROR ${err?.name ?? ""} ${err?.message ?? err}`);
}
