// scripts/qa-start-dev.js — démarre le serveur dev Next.js de façon fiable
// depuis un agent (oc_bash). Pattern robuste Windows :
//   1. spawn detached:true + stdio vers fichiers + unref() → le process parent
//      (oc_bash) n'hérite d'AUCUN handle → retour immédiat, pas de gel.
//   2. Poll readiness HTTP avec plafond dur (le cold-start Next est lent,
//      surtout RAM commit saturée sur cette machine).
//
// Optimisations appliquées (2026-08-16) :
//   - spawn "bun.exe" DIRECTEMENT au lieu de "bun.cmd" : un .cmd n'est pas un
//     exécutable PE → CreateProcess échoue en EINVAL sur Windows (spawn cassé).
//   - probe sur ASSET STATIQUE ("/icon-512.png") au lieu de "/api/football/live"
//     : le probe API déclenchait la compilation Turbopack du graphe complet
//     (55 route handlers + Prisma + better-sqlite3) → plusieurs minutes à
//     froid. Un fichier de public/ répond en ~0 ms sans compiler, et "Ready"
//     Next (6-7 s) suffit : les routes se compilent au premier goto de la QA.
//
// Usage :
//   node scripts/qa-start-dev.js            # start + wait ready (max ~60 s)
//   node scripts/qa-start-dev.js --nowait   # start seulement
//   node scripts/qa-start-dev.js --status   # état du port 3000
import { spawn } from "node:child_process";
import { openSync, existsSync, statSync } from "node:fs";
import http from "node:http";
import path from "node:path";
import { execFileSync } from "node:child_process";

const PORT = process.env.QA_PORT || 3000;
const ROOT = process.cwd();
const LOG = path.join(ROOT, "dev-qa.log");
/** Asset statique de public/ — probe sans compilation Turbopack. */
const PROBE_PATH = process.env.QA_PROBE_PATH || "/icon-512.png";

/** Résout bun.exe (préféré) ou bun.cmd en dernier recours. */
function resolveBun() {
  try {
    const p = execFileSync("where", ["bun"], { encoding: "utf8" })
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean)
      .find((s) => /\.exe$/i.test(s));
    if (p) return p;
  } catch {
    /* non trouvé dans le PATH */
  }
  return "bun.cmd"; // fallback : nécessitera shell:true
}

function probe(timeoutMs = 10_000) {
  return new Promise((resolve) => {
    // hostname "localhost" : Next dev peut binder ::1 — le DNS résout les deux piles.
    const req = http.get({ host: "localhost", port: PORT, path: PROBE_PATH, timeout: timeoutMs }, (res) => {
      res.resume();
      resolve({ up: true, status: res.statusCode });
    });
    req.on("timeout", () => { req.destroy(); resolve({ up: false }); });
    req.on("error", () => resolve({ up: false }));
  });
}

async function waitReady(maxMs = 60_000) {
  const t0 = Date.now();
  while (Date.now() - t0 < maxMs) {
    // Asset statique : réponse immédiate dès que Next a fini son "Ready".
    const r = await probe(8_000);
    if (r.up) return { ready: true, ms: Date.now() - t0, status: r.status };
    if (existsSync(LOG)) {
      const age = Date.now() - statSync(LOG).mtimeMs;
      if (age > 45_000) return { ready: false, ms: Date.now() - t0, note: "log inactif depuis 45s — le serveur a peut-être crashé, voir dev-qa.log" };
    }
    await new Promise((r2) => setTimeout(r2, 1_000));
  }
  return { ready: false, ms: Date.now() - t0, note: "timeout" };
}

const mode = process.argv[2];

if (mode === "--status") {
  const r = await probe(5_000);
  console.log(JSON.stringify({ port: PORT, up: r.up, status: r.status ?? null }));
  process.exit(r.up ? 0 : 1);
}

// Déjà démarré ?
const pre = await probe(3_000);
if (pre.up) {
  console.log(JSON.stringify({ started: false, alreadyRunning: true, port: PORT, status: pre.status }));
  process.exit(0);
}

// Spawn détaché : bun run dev → next dev -p 3000
// NOTE : on spawn "bun.exe" (exécutable PE) — "bun.cmd" échoue en EINVAL
// avec detached:true sur Windows (CreateProcess refuse les scripts batch).
const out = openSync(LOG, "w");
const bun = resolveBun();
const isCmd = /\.cmd$/i.test(bun);
const child = spawn(bun, ["run", "dev"], {
  cwd: ROOT,
  detached: true,
  shell: isCmd, // nécessaire uniquement pour le fallback .cmd
  stdio: ["ignore", out, out],
  env: { ...process.env, PORT: String(PORT) },
});
child.unref();
console.log(JSON.stringify({ started: true, pid: child.pid, bun, port: PORT, log: "dev-qa.log" }));

if (mode === "--nowait") process.exit(0);

const r = await waitReady();
console.log(JSON.stringify({ ready: r.ready, waitedMs: r.ms, status: r.status ?? null, note: r.note ?? null }));
process.exit(r.ready ? 0 : 1);

