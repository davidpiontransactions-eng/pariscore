#!/usr/bin/env node

/**
 * Validates Claude orchestrator-to-specialist dispatch contracts.
 *
 * Contract rules:
 * 1) Each required orchestrator exists in .claude/agents/
 * 2) Each required orchestrator includes at least one Read(".claude/specialists/<name>.md") call
 * 3) Orchestrator includes Task(...) usage
 * 4) Referenced specialist files exist (for concrete, non-placeholder paths)
 */

const fs = require('fs');
const path = require('path');

const repoRoot = path.join(__dirname, '..');
const orchestratorDir = path.join(repoRoot, '.claude', 'agents');
const specialistDir = path.join(repoRoot, '.claude', 'specialists');

const requiredOrchestrators = [
  'accessibility-lead.md',
  'web-accessibility-wizard.md',
  'document-accessibility-wizard.md',
  'markdown-a11y-assistant.md',
  'github-hub.md',
  'nexus.md',
  'developer-hub.md',
];

const readPattern = /Read\((["'])\.claude\/specialists\/([^"')]+)\1\)/gi;
const taskPattern = /\bTask(\s*\(|\s+tool\b|\b)/;

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function validateOrchestrator(fileName) {
  const errors = [];
  const filePath = path.join(orchestratorDir, fileName);
  if (!fs.existsSync(filePath)) {
    errors.push(`Missing orchestrator: .claude/agents/${fileName}`);
    return errors;
  }

  const content = readText(filePath);
  if (!taskPattern.test(content)) {
    errors.push(`Missing Task(...) usage: .claude/agents/${fileName}`);
  }

  const specialistMatches = [...content.matchAll(readPattern)];
  if (specialistMatches.length === 0) {
    errors.push(`No Read(\".claude/specialists/*.md\") calls found: .claude/agents/${fileName}`);
    return errors;
  }

  for (const match of specialistMatches) {
    const specialistFile = match[2];
    if (!specialistFile.endsWith('.md')) {
      continue;
    }
    if (specialistFile.includes('<') || specialistFile.includes('>')) {
      continue;
    }
    const specialistPath = path.join(specialistDir, specialistFile);
    if (!fs.existsSync(specialistPath)) {
      errors.push(
        `Referenced specialist does not exist: .claude/specialists/${specialistFile} (from .claude/agents/${fileName})`
      );
    }
  }

  return errors;
}

function main() {
  if (!fs.existsSync(orchestratorDir)) {
    console.error('Missing .claude/agents directory');
    process.exit(1);
  }
  if (!fs.existsSync(specialistDir)) {
    console.error('Missing .claude/specialists directory');
    process.exit(1);
  }

  const allErrors = [];
  for (const fileName of requiredOrchestrators) {
    allErrors.push(...validateOrchestrator(fileName));
  }

  if (allErrors.length > 0) {
    console.error('Orchestrator dispatch contract validation failed:');
    for (const err of allErrors) {
      console.error(`- ${err}`);
    }
    process.exit(1);
  }

  console.log('Orchestrator dispatch contracts validated successfully.');
}

main();
