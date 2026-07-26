import { execSync } from "child_process";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { join, resolve } from "path";

const ROOT = resolve(import.meta.dirname, "..");
const GIT = "git";

function run(cmd, cwd = ROOT) {
  try {
    const out = execSync(`${GIT} ${cmd}`, { cwd, encoding: "utf8", timeout: 30000 });
    return { ok: true, out: out.trim() };
  } catch (e) {
    return { ok: false, out: e.stderr?.trim() || e.message };
  }
}

function status() {
  const r = run("status --porcelain");
  if (!r.ok) return r;
  const files = r.out.split("\n").filter(Boolean);
  return { ok: true, files, out: r.out };
}

function addAll() {
  return run("add -A");
}

function commit(msg) {
  return run(`commit -m "${msg.replace(/"/g, '\\"')}"`);
}

function push() {
  return run("push");
}

const [cmd, ...args] = process.argv.slice(2);

switch (cmd) {
  case "status": {
    const r = status();
    if (!r.ok) { console.error("FAIL:", r.out); process.exit(1); }
    console.log(r.files.length ? r.out : "rien à commiter");
    break;
  }
  case "commit": {
    const msg = args.join(" ") || "fix: ajout automatique";
    let r = status();
    if (!r.ok) { console.error("FAIL status:", r.out); process.exit(1); }
    if (!r.files.length) { console.log("rien à commiter"); process.exit(0); }
    r = addAll();
    if (!r.ok) { console.error("FAIL add:", r.out); process.exit(1); }
    r = commit(msg);
    if (!r.ok) { console.error("FAIL commit:", r.out); process.exit(1); }
    console.log(r.out);
    break;
  }
  case "push": {
    let r = status();
    if (!r.ok) { console.error("FAIL status:", r.out); process.exit(1); }
    if (r.files.length) {
      console.log("fichiers non commités détectés, commit auto…");
      r = addAll();
      if (!r.ok) { console.error("FAIL add:", r.out); process.exit(1); }
      r = commit(args.join(" ") || "fix: commit auto avant push");
      if (!r.ok) { console.error("FAIL commit:", r.out); process.exit(1); }
      console.log(r.out);
    }
    r = push();
    if (!r.ok) { console.error("FAIL push:", r.out); process.exit(1); }
    console.log(r.out);
    break;
  }
  default:
    console.log(`
Usage: node scripts/git-helper.mjs <cmd> [args]

Commands:
  status              — git status --porcelain
  commit <message>    — add -A + commit
  push <message>      — add -A + commit (si nécessaire) + push
`);
}
