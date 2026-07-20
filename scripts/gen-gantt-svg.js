#!/usr/bin/env node
/**
 * gen-gantt-svg.js — Génère un SVG Gantt simple à partir d'un fichier JSON.
 *
 * Usage :
 *   node scripts/gen-gantt-svg.js gantt-refonte-tennis.json > gantt-refonte-tennis.svg
 *
 * Format JSON attendu :
 *   {
 *     "title": "...",
 *     "timeline": { "labels": ["2026-07-20", "2026-07-21", ...] },
 *     "tracks": [ { "name": "...", "items": [ { "label": "...", "start": "...", "end": "..." } ] } ]
 *   }
 */
const fs = require("fs");

const inputPath = process.argv[2];
if (!inputPath) {
  console.error("Usage: node gen-gantt-svg.js <gantt.json> [> output.svg]");
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(inputPath, "utf-8"));
const labels = data.timeline?.labels || [];
const tracks = data.tracks || [];

// Layout constants
const PAD_L = 220;          // largeur colonne nom de track
const PAD_R = 24;
const PAD_T = 90;           // top (titre + header timeline)
const COL_W = 84;           // largeur d'une colonne (un jour)
const ROW_H = 32;           // hauteur d'une ligne d'item
const TRACK_GAP = 14;       // gap entre tracks
const HEADER_H = 30;        // hauteur header timeline

// Index lookup start/end → column index
const idx = (d) => {
  const i = labels.indexOf(d);
  return i < 0 ? 0 : i;
};

// Build flat item list with track grouping
const rows = [];
tracks.forEach((t, ti) => {
  if (ti > 0) rows.push({ gap: true });
  t.items.forEach((it) => rows.push({ ...it, track: t.name }));
});

const W = PAD_L + labels.length * COL_W + PAD_R;
const H = PAD_T + rows.length * ROW_H + 30;

const fmtDate = (d) => {
  // 2026-07-20 → 20/07
  const m = d.match(/(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}` : d;
};

// SVG output
const parts = [];
parts.push(`<?xml version="1.0" encoding="UTF-8"?>`);
parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Segoe UI, system-ui, -apple-system, sans-serif">`);
parts.push(`<style>
  .bg { fill: #0b0e17; }
  .grid-bg { fill: #131722; }
  .grid-line { stroke: #1f2533; stroke-width: 1; }
  .weekend { fill: #161b29; }
  .title { fill: #e6edf3; font-size: 18px; font-weight: 700; }
  .subtitle { fill: #8b949e; font-size: 11px; }
  .track-name { fill: #c9d1d9; font-size: 12px; font-weight: 600; }
  .track-bg { fill: #0f141e; }
  .header-date { fill: #8b949e; font-size: 10px; text-anchor: middle; }
  .item { fill: #00e676; }
  .item-critical { fill: #ff6b6b; }
  .item-premium { fill: #0077ff; }
  .item-setup { fill: #a371f7; }
  .item-done { fill: #2ea043; }
  .item-label { fill: #e6edf3; font-size: 11px; }
  .sep { stroke: #1f2533; stroke-width: 1; }
</style>`);

// Background
parts.push(`<rect class="bg" width="${W}" height="${H}"/>`);

// Title
parts.push(`<text class="title" x="20" y="32">${escapeXml(data.title || "Gantt")}</text>`);
parts.push(`<text class="subtitle" x="20" y="50">${labels.length} jours · ${tracks.length} tracks · ${rows.filter(r => !r.gap).length} tâches · généré ${new Date().toISOString().slice(0, 10)}</text>`);

// Timeline header (dates)
parts.push(`<rect class="grid-bg" x="${PAD_L}" y="${PAD_T - HEADER_H}" width="${labels.length * COL_W}" height="${HEADER_H}"/>`);
labels.forEach((d, i) => {
  const x = PAD_L + i * COL_W;
  const dow = new Date(d).getDay();
  if (dow === 0 || dow === 6) {
    parts.push(`<rect class="weekend" x="${x}" y="${PAD_T - HEADER_H}" width="${COL_W}" height="${H - PAD_T + HEADER_H}"/>`);
  }
  parts.push(`<line class="grid-line" x1="${x}" y1="${PAD_T - HEADER_H}" x2="${x}" y2="${H - 10}"/>`);
  parts.push(`<text class="header-date" x="${x + COL_W / 2}" y="${PAD_T - 11}">${fmtDate(d)}</text>`);
});
parts.push(`<line class="grid-line" x1="${PAD_L + labels.length * COL_W}" y1="${PAD_T - HEADER_H}" x2="${PAD_L + labels.length * COL_W}" y2="${H - 10}"/>`);

// Rows
let y = PAD_T;
rows.forEach((r) => {
  if (r.gap) {
    y += TRACK_GAP;
    return;
  }
  const s = idx(r.start);
  const e = idx(r.end);
  const x = PAD_L + s * COL_W + 4;
  const w = (e - s + 1) * COL_W - 8;
  const cls = pickClass(r.label);
  // Track name (only on first row of a track is hard without state, so show each)
  parts.push(`<rect class="track-bg" x="0" y="${y + 2}" width="${PAD_L - 4}" height="${ROW_H - 4}" rx="3"/>`);
  parts.push(`<text class="track-name" x="10" y="${y + ROW_H / 2 + 4}">${escapeXml(truncate(r.track, 26))}</text>`);
  // Item bar
  parts.push(`<rect class="item ${cls}" x="${x}" y="${y + 4}" width="${w}" height="${ROW_H - 8}" rx="4"/>`);
  parts.push(`<text class="item-label" x="${x + 6}" y="${y + ROW_H / 2 + 4}">${escapeXml(truncate(r.label, 38))}</text>`);
  y += ROW_H;
});

// Horizontal separator under header
parts.push(`<line class="sep" x1="0" y1="${PAD_T - HEADER_H}" x2="${W}" y2="${PAD_T - HEADER_H}"/>`);

parts.push(`</svg>`);

function escapeXml(s) {
  return String(s).replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c]);
}
function truncate(s, n) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
function pickClass(label) {
  const l = label.toLowerCase();
  if (l.startsWith("✅") || l.includes("installés") || l.includes("fix") || l.includes("bug")) return "item-done";
  if (l.includes("critical") || l.includes("🔴")) return "item-critical";
  if (l.includes("premium") || l.includes("🟡")) return "item-premium";
  if (l.includes("setup") || l.includes("audit") || l.includes("p0")) return "item-setup";
  return "item";
}

process.stdout.write(parts.join("\n"));
