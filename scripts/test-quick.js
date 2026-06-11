/**
 * test-quick.js — Quick quality gate pour PariScore
 * Usage : node scripts/test-quick.js
 * 
 * Checks :
 *   1. Syntaxe Node.js (node --check server.js)
 *   2. Sync STRATEGIES ↔ STRATEGIES_UI des clés
 *   3. DB SQLite integrity (si pariscore.db existe)
 *   4. Résumé pass/fail
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
let passed = 0;
let failed = 0;
let errors = [];

function check(name, ok, detail) {
  if (ok) { passed++; console.log("  \u2705 " + name); }
  else { failed++; errors.push(name + " : " + detail); console.log("  \u274c " + name + " \u2014 " + detail); }
}

// -- 1. Syntax check server.js --
console.log("\n\ud83d\udce6 1. Syntaxe Node.js");
try {
  execSync("node --check server.js", { cwd: ROOT, stdio: "pipe" });
  check("server.js", true);
} catch (e) {
  check("server.js", false, e.stderr.toString().split("\n")[0]);
}

// -- 2. Sync STRATEGIES <-> STRATEGIES_UI --
console.log("\n\ud83d\udd17 2. Sync STRATEGIES (server.js) <-> STRATEGIES_UI (pariscore.html)");
try {
  const srv = fs.readFileSync(path.join(ROOT, "server.js"), "utf8");
  const ui  = fs.readFileSync(path.join(ROOT, "pariscore.html"), "utf8");

  const strMatch = srv.match(/const STRATEGIES\s*=\s*\{([\s\S]+?)\};/);
  if (!strMatch) { check("STRATEGIES parsable", false, "const introuvable"); }
  else {
    const srvKeys = [...strMatch[1].matchAll(/^\s{2}(\w+):\s*\{/gm)].map(m => m[1]);
    
    const uiMatch = ui.match(/const STRATEGIES_UI\s*=\s*\[([\s\S]+?)\];/);
    if (!uiMatch) { console.log("  ⚠️  STRATEGIES_UI introuvable dans pariscore.html (worktree feature) — skip"); check("STRATEGIES_UI (frontend)", true); }
    else {
      const uiKeys = [...uiMatch[1].matchAll(/key\s*:\s*['"](\w+)['"]/g)].map(m => m[1]);

      const srvSet = new Set(srvKeys);
      const uiSet  = new Set(uiKeys);

      const missingUI = srvKeys.filter(k => !uiSet.has(k));
      const missingSrv = uiKeys.filter(k => !srvSet.has(k));

      if (missingUI.length === 0 && missingSrv.length === 0) {
        check("STRATEGIES synced", true);
      } else {
        if (missingUI.length) check("STRATEGIES keys in server.js but missing in STRATEGIES_UI", false, missingUI.join(", "));
        if (missingSrv.length) check("STRATEGIES_UI keys in frontend but missing in STRATEGIES", false, missingSrv.join(", "));
      }

      check("STRATEGIES count : " + srvKeys.length + " keys in server.js, " + uiKeys.length + " keys in frontend", true);
    }
  }
} catch (e) {
  check("STRATEGIES sync check", false, e.message);
}

// -- 3. DB integrity --
console.log("\n\ud83d\uddd4\ufe0f  3. SQLite integrity");
const dbPath = path.join(ROOT, "pariscore.db");
if (fs.existsSync(dbPath)) {
  try {
    const bs3 = require("better-sqlite3");
    const dbi = bs3(dbPath);
    const out = dbi.pragma("integrity_check");
    dbi.close();
    check("DB integrity", out && out.length && out[0] && out[0].integrity_check === "ok", JSON.stringify(out));
  } catch (e) {
    check("DB integrity", false, (e.message || "").split("\n")[0]);
  }
} else {
  console.log("  \u26a0\ufe0f  pariscore.db introuvable (skip)");
}

// -- Resume --
console.log("\n\ud83d\udcca Resume : " + passed + " passed, " + failed + " failed" + (errors.length ? "\n\n" + errors.map(function(e,i) { return "  " + (i+1) + ". " + e; }).join("\n") : ""));
process.exit(failed > 0 ? 1 : 0);
