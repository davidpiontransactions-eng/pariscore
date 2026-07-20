#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");

const checks = [
  { name: "Release version consistency", cmd: "node", args: ["scripts/check-release-consistency.js"] },
  { name: "Workflow invariants", cmd: "node", args: ["scripts/validate-workflow-invariants.mjs"] },
  { name: "Config integrity", cmd: "node", args: ["scripts/validate-config-integrity.mjs"] },
  { name: "Doc version pins", cmd: "node", args: ["scripts/validate-doc-version-pins.mjs"] },
  { name: "Codex plugin surface", cmd: "node", args: ["scripts/validate-codex-plugin.js"] },
  { name: "Codex accessibility dispatch source smoke", cmd: "node", args: ["scripts/codex-accessibility-dispatch-smoke.mjs"] },
];

let failed = false;

for (const check of checks) {
  console.log(`\n=== ${check.name} ===`);
  const result = spawnSync(check.cmd, check.args, {
    cwd: repoRoot,
    encoding: "utf-8",
    stdio: "pipe",
  });

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);

  if (result.status !== 0) {
    failed = true;
    console.error(`Check failed: ${check.name}`);
  } else {
    console.log(`Check passed: ${check.name}`);
  }
}

if (failed) {
  console.error("\nRelease readiness failed. Fix the checks above before tagging/publishing.");
  process.exit(1);
}

console.log("\nRelease readiness passed. You can proceed with release tagging and publication.");
