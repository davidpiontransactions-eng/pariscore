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

const args = process.argv.slice(2);
const result = spawnSync(bun, args, {
  stdio: 'inherit',
  shell: false,
  env: process.env,
  cwd: process.cwd(),
});

if (result.error) {
  console.error('[run-bun] failed to spawn', bun, result.error.message);
  process.exit(1);
}

process.exit(result.status == null ? 1 : result.status);
