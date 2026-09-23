// Probe BSD — vérifie l'auth + la shape de /v2/leagues/{id}/season/ SANS exposer la clé.
import { readFileSync } from "node:fs";

const env = readFileSync(new URL("../../.env", import.meta.url), "utf8");
const key = env.match(/^BSD_API_KEY=(.+)$/m)?.[1]?.trim();
if (!key) {
  console.log("RESULT: KEY_MISSING");
  process.exit(0);
}
const id = process.argv[2] ?? "6";
const res = await fetch(`https://sports.bzzoiro.com/api/v2/leagues/${id}/season/`, {
  headers: { Authorization: `Token ${key}`, Accept: "application/json" },
  signal: AbortSignal.timeout(15000),
});
console.log(`RESULT: HTTP ${res.status}`);
const body = await res.text();
console.log(`BODY_HEAD: ${body.slice(0, 300)}`);
