#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { findBun } = require('./find-bun');

const root = path.resolve(__dirname, '..');
const files = [
  'server.js',
  'pariscore.js',
  'pariscore.app.js',
  'tennis-serializer.js',
  'tennis-live-api.js',
  'tennis-live.js',
  'metrics-cache.js',
  'eloCalculator.js',
  'glicko2Calculator.js',
  'sw.js',
  'ecosystem.config.js',
];

const report = {
  node: process.version,
  platform: process.platform,
  arch: process.arch,
  bun: null,
  syntax: [],
  modules: {},
  ok: true,
};

const bun = findBun();
report.bun = bun || 'MISSING';

for (const rel of files) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) {
    report.syntax.push({ file: rel, status: 'skip', error: 'not found' });
    continue;
  }
  try {
    execFileSync(process.execPath, ['--check', full], { stdio: 'pipe' });
    report.syntax.push({ file: rel, status: 'ok' });
  } catch (e) {
    report.ok = false;
    const msg = (e.stderr && e.stderr.toString()) || e.message;
    report.syntax.push({ file: rel, status: 'fail', error: msg.trim() });
  }
}

for (const mod of ['better-sqlite3', 'next', 'react', 'react-dom']) {
  try {
    const pkg = require(path.join(root, 'node_modules', mod, 'package.json'));
    report.modules[mod] = pkg.version;
  } catch (e) {
    report.ok = false;
    report.modules[mod] = 'FAIL: ' + e.message;
  }
}

try {
  require('better-sqlite3');
  report.modules['better-sqlite3.load'] = 'ok';
} catch (e) {
  report.ok = false;
  report.modules['better-sqlite3.load'] = 'FAIL: ' + e.message;
}

console.log(JSON.stringify(report, null, 2));
process.exit(report.ok ? 0 : 1);
