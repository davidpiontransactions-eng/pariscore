#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");

function readText(relPath) {
  return readFileSync(join(repoRoot, relPath), "utf-8");
}

const pluginYaml = readText("plugin.yaml");
const versionMatch = pluginYaml.match(/^version:\s*["']?([\d.]+)["']?$/m);
if (!versionMatch) {
  console.error("Could not parse version from plugin.yaml");
  process.exit(1);
}

const version = versionMatch[1];
const errors = [];
const infos = [];

const actionReadme = readText("action/README.md");
const expectedTag = `action@v${version}`;

if (!actionReadme.includes(expectedTag)) {
  errors.push(`action/README.md is missing expected tag: ${expectedTag}`);
} else {
  infos.push(`action/README.md includes ${expectedTag}`);
}

const staleTagMatches = actionReadme.match(/action@v\d+\.\d+\.\d+/g) || [];
for (const stale of staleTagMatches) {
  if (stale !== expectedTag) {
    errors.push(`action/README.md contains stale action tag: ${stale} (expected only ${expectedTag})`);
  }
}

const releaseFile = `RELEASE-${version}.md`;
if (!existsSync(join(repoRoot, releaseFile))) {
  errors.push(`Missing release notes file: ${releaseFile}`);
} else {
  const releaseText = readText(releaseFile);
  for (const section of ["## Overview", "## Highlights", "## Full Changelog"]) {
    if (!releaseText.includes(section)) {
      errors.push(`${releaseFile} is missing required section: ${section}`);
    }
  }
  infos.push(`${releaseFile} exists with required section checks complete`);
}

const changelog = readText("CHANGELOG.md");
if (!changelog.includes(`## [${version}]`)) {
  errors.push(`CHANGELOG.md is missing version section: [${version}]`);
} else {
  infos.push(`CHANGELOG.md includes [${version}] section`);
}

if (errors.length > 0) {
  console.error("Documentation version pin checks failed:\n");
  for (const e of errors) console.error(`- ${e}`);
  process.exit(1);
}

console.log("Documentation version pin checks passed.\n");
for (const i of infos) console.log(`- ${i}`);
