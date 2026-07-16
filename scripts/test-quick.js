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

function extractKeysFromObject(src, objName) {
  const re = new RegExp("(?:const|let|var)\\s+" + objName + "\\s*=\\s*\\{([\\s\\S]+?)\\};");
  const match = src.match(re);
  if (!match) return null;
  return [...match[1].matchAll(/^\s{2}(\w+):\s*\{/gm)].map(m => m[1]);
}

function extractKeysFromArray(src, arrName) {
  const re = new RegExp("(?:const|let|var)\\s+" + arrName + "\\s*=\\s*\\[([\\s\\S]+?)\\];");
  const match = src.match(re);
  if (!match) return null;
  return [...match[1].matchAll(/['\"](\w+)['\"]/g)].map(m => m[1]);
}

// -- 1. Syntax check server.js --
console.log("\n\ud83d\udce6 1. Syntaxe Node.js");
try {
  execSync("node --check server.js", { cwd: ROOT, stdio: "pipe" });
  check("server.js", true);
} catch (e) {
  check("server.js", false, e.stderr.toString().split("\n")[0]);
}

// -- 2. Sync STRATEGIES keys --
console.log("\n\ud83d\udd17 2. Sync STRATEGIES keys");
try {
  const canonicalPath = path.join(ROOT, "packages/shared/src/strategies.ts");
  const canonicalSrc = fs.readFileSync(canonicalPath, "utf8");
  const canonicalKeys = extractKeysFromArray(canonicalSrc, "STRATEGY_KEYS");

  if (!canonicalKeys) {
    check("canonical STRATEGY_KEYS", false, "introuvable dans packages/shared/src/strategies.ts");
  } else {
    // server.js
    const srv = fs.readFileSync(path.join(ROOT, "server.js"), "utf8");
    const srvKeys = extractKeysFromObject(srv, "STRATEGIES");

    if (!srvKeys) {
      check("STRATEGIES (server.js)", false, "const introuvable");
    } else {
      const missingSrv = canonicalKeys.filter(k => !srvKeys.includes(k));
      const extraSrv = srvKeys.filter(k => !canonicalKeys.includes(k));
      if (missingSrv.length === 0 && extraSrv.length === 0) {
        check("STRATEGIES (server.js) synced with canonical", true);
      } else {
        if (missingSrv.length) check("STRATEGIES (server.js) manquantes vs canonical", false, missingSrv.join(", "));
        if (extraSrv.length) check("STRATEGIES (server.js) en trop vs canonical", false, extraSrv.join(", "));
      }
      check("STRATEGIES count : " + srvKeys.length + " keys in server.js, " + canonicalKeys.length + " canonical", true);
    }

    // pariscore.html STRATEGIES_UI
    const uiPath = path.join(ROOT, "pariscore.html");
    if (fs.existsSync(uiPath)) {
      const ui = fs.readFileSync(uiPath, "utf8");
      const uiMatch = ui.match(/const STRATEGIES_UI\s*=\s*\[([\s\S]+?)\];/);
      if (!uiMatch) {
        console.log("  \u26a0\ufe0f  STRATEGIES_UI introuvable dans pariscore.html (worktree feature) \u2014 skip");
        check("STRATEGIES_UI (frontend)", true);
      } else {
        const uiKeys = [...uiMatch[1].matchAll(/key\s*:\s*['"](\w+)['"]/g)].map(m => m[1]);
        const missingUI = canonicalKeys.filter(k => !uiKeys.includes(k));
        const extraUI = uiKeys.filter(k => !canonicalKeys.includes(k));
        if (missingUI.length === 0 && extraUI.length === 0) {
          check("STRATEGIES_UI (frontend) synced with canonical", true);
        } else {
          if (missingUI.length) check("STRATEGIES_UI manquantes vs canonical", false, missingUI.join(", "));
          if (extraUI.length) check("STRATEGIES_UI en trop vs canonical", false, extraUI.join(", "));
        }
      }
    } else {
      console.log("  \u26a0\ufe0f  pariscore.html introuvable (skip)");
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
