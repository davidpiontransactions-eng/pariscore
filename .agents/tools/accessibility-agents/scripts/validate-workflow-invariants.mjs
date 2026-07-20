#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");

const checks = [
  {
    file: ".github/workflows/a11y-check.yml",
    required: [
      "name: Markdown Accessibility Lint",
      "continue-on-error: true",
      "A11Y_REGRESSION_MODE",
      "upload-sarif@v3",
    ],
  },
  {
    file: ".github/workflows/release-consistency-guard.yml",
    required: [
      "Verify CHANGELOG has entry for current version",
      "Verify release notes file and structure",
      "RELEASE-*.md",
    ],
  },
  {
    file: ".github/workflows/validate-orchestrator-contracts.yml",
    required: [
      "Run markdown scanner unit tests",
      "Run orchestrator validator integration tests",
    ],
  },
  {
    file: ".github/workflows/ci-integrity-guards.yml",
    required: [
      "validate-workflow-invariants.mjs",
      "validate-config-integrity.mjs",
      "validate-doc-version-pins.mjs",
    ],
  },
  {
    file: ".github/workflows/playwright-high-impact-check.yml",
    required: [
      "playwright-high-impact-check.mjs",
      "Install Playwright dependencies",
      "Upload Playwright artifacts",
    ],
  },
  {
    file: ".github/workflows/branch-hygiene-report.yml",
    required: [
      "schedule:",
      "Build branch hygiene summary",
      "GITHUB_STEP_SUMMARY",
    ],
  },
];

const errors = [];
const passes = [];

for (const check of checks) {
  let content;
  try {
    content = readFileSync(join(repoRoot, check.file), "utf-8");
  } catch {
    errors.push(`Missing workflow file: ${check.file}`);
    continue;
  }

  for (const requiredSnippet of check.required) {
    if (!content.includes(requiredSnippet)) {
      errors.push(`${check.file}: missing required snippet: ${requiredSnippet}`);
    }
  }

  if (!errors.some((e) => e.startsWith(check.file))) {
    passes.push(`Workflow invariant checks passed: ${check.file}`);
  }
}

if (errors.length > 0) {
  console.error("Workflow invariant validation failed:\n");
  for (const e of errors) console.error(`- ${e}`);
  process.exit(1);
}

console.log("Workflow invariant validation passed.\n");
for (const p of passes) console.log(`- ${p}`);
