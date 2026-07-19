#!/usr/bin/env node
'use strict';
const Database = require('better-sqlite3');
const path = require('path');
const ROOT = __dirname.replace(/[\\/]tools$/, '');
const db = new Database(path.join(ROOT, 'pariscore.db'));

function norm(s) {
  if (!s) return '';
  return s.normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

const players = db.prepare("SELECT DISTINCT player_name, circuit FROM tennis_players_elo WHERE player_name IS NOT NULL AND player_name != ''").all();
console.log('Players in tennis_players_elo:', players.length);

let matched = 0, unmatched = 0;
for (const p of players) {
  const n = norm(p.player_name);
  const row = db.prepare("SELECT 1 FROM tennis_matches WHERE (LOWER(winner_name) = ? OR LOWER(loser_name) = ?) AND (winner_rank IS NOT NULL OR loser_rank IS NOT NULL) LIMIT 1").get(n, n);
  if (row) matched++; else unmatched++;
}
console.log('Matchable:', matched, 'Unmatchable:', unmatched);

// Also show some unmatchable examples
const unmatchable = [];
for (const p of players) {
  if (unmatchable.length >= 10) break;
  const n = norm(p.player_name);
  const row = db.prepare("SELECT 1 FROM tennis_matches WHERE (LOWER(winner_name) = ? OR LOWER(loser_name) = ?) AND (winner_rank IS NOT NULL OR loser_rank IS NOT NULL) LIMIT 1").get(n, n);
  if (!row) unmatchable.push(p.player_name + ' (' + p.circuit + ')');
}
console.log('Unmatchable examples:', unmatchable.join(', '));
db.close();
