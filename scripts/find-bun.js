#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function exists(file) {
  try {
    return fs.existsSync(file);
  } catch (_) {
    return false;
  }
}

function fromWhere() {
  try {
    const out = execSync('where bun', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    const line = String(out || '')
      .split(/\r?\n/)
      .map((s) => s.trim())
      .find(Boolean);
    return line && exists(line) ? line : null;
  } catch (_) {
    return null;
  }
}

function fromWinget() {
  const base = process.env.LOCALAPPDATA
    ? path.join(process.env.LOCALAPPDATA, 'Microsoft', 'WinGet', 'Packages')
    : null;
  if (!base || !exists(base)) return null;
  try {
    const packages = fs.readdirSync(base).filter((n) => /bun/i.test(n));
    for (const pkg of packages) {
      const root = path.join(base, pkg);
      const stack = [root];
      while (stack.length) {
        const dir = stack.pop();
        let entries = [];
        try {
          entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch (_) {
          continue;
        }
        for (const ent of entries) {
          const full = path.join(dir, ent.name);
          if (ent.isFile() && /^bun(\.exe)?$/i.test(ent.name)) return full;
          if (ent.isDirectory() && !/node_modules|\.git/i.test(ent.name)) stack.push(full);
        }
      }
    }
  } catch (_) {
    /* ignore */
  }
  return null;
}

function findBun() {
  if (process.env.BUN_PATH && exists(process.env.BUN_PATH)) return process.env.BUN_PATH;

  const home = process.env.USERPROFILE || process.env.HOME || '';
  const candidates = [
    path.join(home, '.bun', 'bin', process.platform === 'win32' ? 'bun.exe' : 'bun'),
    process.env.BUN_INSTALL
      ? path.join(process.env.BUN_INSTALL, 'bin', process.platform === 'win32' ? 'bun.exe' : 'bun')
      : null,
    'C:\\Program Files\\bun\\bun.exe',
    'C:\\ProgramData\\chocolatey\\bin\\bun.exe',
  ].filter(Boolean);

  for (const c of candidates) {
    if (exists(c)) return c;
  }

  return fromWhere() || fromWinget();
}

const bunPath = findBun();
if (require.main === module) {
  if (!bunPath) {
    console.error('bun not found. Install Bun or set BUN_PATH.');
    process.exit(1);
  }
  process.stdout.write(bunPath);
}

module.exports = { findBun };
