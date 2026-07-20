#!/usr/bin/env node
/**
 * Integration tests for scripts/validate-orchestrator-dispatch.js
 *
 * Run: node scripts/test-orchestrator-validator.mjs
 *
 * Uses only Node.js built-ins.
 */

import { execSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");
const validatorPath = join(repoRoot, "scripts", "validate-orchestrator-dispatch.js");
const orchestratorDir = join(repoRoot, ".claude", "agents");
const specialistDir = join(repoRoot, ".claude", "specialists");

let passed = 0;
let failed = 0;

function assert(condition, name) {
  if (condition) {
    console.log(`  PASS  ${name}`);
    passed++;
  } else {
    console.error(`  FAIL  ${name}`);
    failed++;
  }
}

function runValidator() {
  try {
    const out = execSync(`node "${validatorPath}"`, { encoding: "utf-8", cwd: repoRoot, timeout: 20000 });
    return { stdout: out, exitCode: 0 };
  } catch (err) {
    return { stdout: err.stdout || "", stderr: err.stderr || "", exitCode: err.status ?? 1 };
  }
}

const REQUIRED_ORCHESTRATORS = [
  "accessibility-lead.md",
  "web-accessibility-wizard.md",
  "document-accessibility-wizard.md",
  "markdown-a11y-assistant.md",
  "github-hub.md",
  "nexus.md",
  "developer-hub.md",
];

console.log("validate-orchestrator-dispatch.js integration tests\n" + "=".repeat(52));

// 1. Validator script exists
console.log("\n1. Script file presence");
assert(existsSync(validatorPath), "validate-orchestrator-dispatch.js exists");

// 2. Required orchestrators exist on disk
console.log("\n2. Required orchestrator files exist");
for (const file of REQUIRED_ORCHESTRATORS) {
  const p = join(orchestratorDir, file);
  assert(existsSync(p), `orchestrator exists: ${file}`);
}

// 3. Specialist directory is non-empty
console.log("\n3. Specialist directory");
let specialistCount = 0;
if (existsSync(specialistDir)) {
  specialistCount = readdirSync(specialistDir).filter((f) => f.endsWith(".md")).length;
}
assert(specialistCount > 0, `at least one specialist file exists (found ${specialistCount})`);

// 4. Validator exits 0 against real repo content
console.log("\n4. Validator passes against real repo");
const { stdout, exitCode } = runValidator();
assert(exitCode === 0, "validator exits 0");
assert(stdout.includes("validated successfully"), "validator prints success message");

// 5. Orchestrators reference specialist files
console.log("\n5. Orchestrator Read patterns");
for (const file of REQUIRED_ORCHESTRATORS) {
  const p = join(orchestratorDir, file);
  if (!existsSync(p)) continue;
  const { readFileSync } = await import("node:fs");
  const content = readFileSync(p, "utf-8");
  const hasRead = /Read\((["'])\.claude\/specialists\//i.test(content);
  assert(hasRead, `${file} includes Read(.claude/specialists/...) pattern`);
}

// 6. Orchestrators reference Task tool
console.log("\n6. Orchestrator Task references");
for (const file of REQUIRED_ORCHESTRATORS) {
  const p = join(orchestratorDir, file);
  if (!existsSync(p)) continue;
  const { readFileSync } = await import("node:fs");
  const content = readFileSync(p, "utf-8");
  const hasTask = /\bTask(\s*\(|\s+tool\b|\b)/i.test(content);
  assert(hasTask, `${file} references Task tool`);
}

console.log(`\n${"=".repeat(52)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
