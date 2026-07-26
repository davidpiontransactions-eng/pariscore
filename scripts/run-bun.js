#!/usr/bin/env node
'use strict';

const { spawnSync } = require('child_process');
const path = require('path');
const { findBun } = require('./find-bun');

const bun = findBun();
if (!bun) {
  console.error('[run-bun] bun executable not found on PATH or known install locations.');
  console.error('[run-bun] Install: https://bun.sh  OR set BUN_PATH to bun.exe');
  process.exit(1);
}

const TIMEOUT_MS = parseInt(process.env.RUN_BUN_TIMEOUT_MS || '120000', 10);

const args = process.argv.slice(2);
const result = spawnSync(bun, args, {
  stdio: 'inherit',
  timeout: TIMEOUT_MS || undefined,
  shell: false,
  env: process.env,
  cwd: process.cwd(),
});

if (result.status === null && result.signal === 'SIGTERM') {
  console.error('[run-bun] timed out after ' + TIMEOUT_MS + 'ms');
  process.exit(124);
}
if (result.error) {
  console.error('[run-bun] failed to spawn', bun, result.error.message);
  process.exit(1);
}

process.exit(result.status == null ? 1 : result.status);
