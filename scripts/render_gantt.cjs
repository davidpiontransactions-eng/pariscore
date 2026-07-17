const fs = require('fs');
const path = require('path');

const spec = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'gantt-session.json'), 'utf-8'));

function parseDate(v) { const d = new Date(v+'T00:00:00'); return d; }
function fmtDate(d) { return d.toISOString().slice(0,10); }
function esc(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// Build date axis
const allStarts = [], allEnds = [];
for (const track of spec.tracks) {
  for (const item of track.items) {
    allStarts.push(parseDate(item.start));
    allEnds.push(parseDate(item.end));
  }
}
const firstDay = new Date(Math.min(...allStarts));
const lastDay = new Date(Math.max(...allEnds));
const dayCount = Math.floor((lastDay - firstDay) / 86400000) + 1;
const keys = Array.from({length: dayCount}, (_, i) => {
  const d = new Date(firstDay);
  d.setDate(d.getDate() + i);
  return fmtDate(d);
});

const axisKeys = {};
keys.forEach((k, i) => axisKeys[k] = i);

const PALETTE = ["#1f6feb","#f05d23","#2a9d8f","#8c5cf5","#ffb703","#e63946","#4d908e","#577590"];

function assignLanes(tasks) {
  const ordered = [...tasks].sort((a,b) => a.start - b.start || a.end - b.end || a.label.localeCompare(b.label));
  const laneEnds = [];
  return ordered.map((t, i) => {
    let laneIdx = laneEnds.findIndex(end => t.start > end);
    if (laneIdx === -1) { laneIdx = laneEnds.length; laneEnds.push(t.end); }
    else laneEnds[laneIdx] = t.end;
    return { ...t, lane: laneIdx, symbol: String.fromCharCode(65 + (i % 52)) };
  });
}

function colorIdx(label, trackName) {
  let h = 0;
  const s = trackName + ':' + label;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h) + s.charCodeAt(i);
  return Math.abs(h) % PALETTE.length;
}

const placedTracks = [];
for (const rawTrack of spec.tracks) {
  const items = rawTrack.items.map(item => ({
    label: item.label,
    start: axisKeys[item.start],
    end: axisKeys[item.end],
    color: item.color || rawTrack.color || null,
  }));
  const placed = assignLanes(items);
  const laneCount = placed.length > 0 ? Math.max(...placed.map(t => t.lane)) + 1 : 1;
  placedTracks.push({ name: rawTrack.name, tasks: placed, laneCount, color: rawTrack.color });
}

const colW = 36, rowH = 34, labelW = 340, rightMargin = 40, topMargin = 92, bottomMargin = 32, trackGap = 8, axisH = 54;
const totalCols = keys.length;
const chartW = labelW + totalCols * colW + rightMargin;
const tracksH = placedTracks.reduce((sum, t) => sum + t.laneCount * rowH + trackGap, 0);
const chartH = topMargin + axisH + tracksH + bottomMargin;
const headerTop = topMargin;
const gridTop = topMargin + axisH;
const gridRight = labelW + totalCols * colW;

const lines = [];
function add(s) { lines.push(s); }

add(`<svg xmlns="http://www.w3.org/2000/svg" width="${chartW}" height="${chartH}" viewBox="0 0 ${chartW} ${chartH}" role="img">`);
add(`<title>${esc(spec.title)}</title>`);
add(`<desc>${esc(spec.title)} — ${keys[0]} to ${keys[keys.length-1]}</desc>`);
add(`<style>
text{font-family:Menlo,Consolas,monospace;fill:#122033;}
.title{font-size:24px;font-weight:700;}
.subtitle{font-size:12px;fill:#526072;}
.axis-title{font-size:11px;font-weight:700;fill:#526072;letter-spacing:0.06em;}
.track-label{font-size:13px;font-weight:700;}
.axis-text{font-size:12px;font-weight:700;fill:#314255;}
.bar-label{font-size:12px;font-weight:700;}
.bar-label-outside{font-size:12px;font-weight:700;fill:#122033;}
</style>`);
add(`<rect width="${chartW}" height="${chartH}" fill="#f7f3ea"/>`);
add(`<rect x="0" y="0" width="${chartW}" height="76" fill="#efe8d8"/>`);
add(`<text x="24" y="34" class="title">${esc(spec.title)}</text>`);
add(`<text x="24" y="56" class="subtitle">${keys[0]} to ${keys[keys.length-1]}</text>`);
add(`<text x="${labelW}" y="${headerTop - 12}" class="axis-title">DATES</text>`);
add(`<rect x="${labelW}" y="${headerTop}" width="${totalCols * colW}" height="${axisH}" fill="#e9dfca"/>`);

// Axis headers
for (let i = 0; i < keys.length; i++) {
  const d = new Date(keys[i]+'T00:00:00');
  const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const x = labelW + i * colW;
  const fill = i % 2 === 0 ? '#efe4ce' : '#e6dac1';
  add(`<rect x="${x}" y="${headerTop}" width="${colW}" height="${axisH}" fill="${fill}"/>`);
  add(`<line x1="${x}" y1="${headerTop}" x2="${x}" y2="${headerTop + axisH}" stroke="#cabca1" stroke-width="1"/>`);
  add(`<text x="${x + colW/2}" y="${headerTop + axisH/2 + 5}" text-anchor="middle" class="axis-text">${label}</text>`);
}
add(`<line x1="${labelW + totalCols * colW}" y1="${headerTop}" x2="${labelW + totalCols * colW}" y2="${headerTop + axisH}" stroke="#cabca1" stroke-width="1"/>`);
add(`<line x1="${labelW}" y1="${headerTop + axisH}" x2="${labelW + totalCols * colW}" y2="${headerTop + axisH}" stroke="#cabca1" stroke-width="1"/>`);

// Vertical grid lines
for (let i = 0; i <= totalCols; i++) {
  const x = labelW + i * colW;
  add(`<line x1="${x}" y1="${gridTop}" x2="${x}" y2="${chartH - bottomMargin}" stroke="#d8d1c2" stroke-width="1"/>`);
}

// Tracks
let curY = gridTop;
for (let ti = 0; ti < placedTracks.length; ti++) {
  const tr = placedTracks[ti];
  const trH = tr.laneCount * rowH;
  const band = ti % 2 === 0 ? '#fbf8f2' : '#f3ede2';
  add(`<rect x="0" y="${curY}" width="${labelW}" height="${trH}" fill="${band}"/>`);
  add(`<rect x="${labelW}" y="${curY}" width="${gridRight - labelW}" height="${trH}" fill="${band}"/>`);
  add(`<text x="24" y="${curY + trH/2 + 5}" class="track-label">${esc(tr.name)}</text>`);

  // Horizontal lines
  for (let li = 0; li <= tr.laneCount; li++) {
    const y = curY + li * rowH;
    add(`<line x1="0" y1="${y}" x2="${gridRight}" y2="${y}" stroke="#ddd3be" stroke-width="1"/>`);
  }

  // Tasks
  for (const task of tr.tasks) {
    const x = labelW + task.start * colW + 6;
    const w = (task.end - task.start + 1) * colW - 12;
    const y = curY + task.lane * rowH + 6;
    const h = rowH - 12;
    const fill = task.color || tr.color || PALETTE[colorIdx(task.label, tr.name)];
    add(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="7" ry="7" fill="${fill}" stroke="#17324d" stroke-opacity="0.15"/>`);
    if (w >= 50) {
      add(`<text x="${x + 10}" y="${y + 17}" class="bar-label" fill="#ffffff">${esc(task.label)}</text>`);
    } else {
      add(`<text x="${x + w + 6}" y="${y + 17}" class="bar-label-outside">${esc(task.label)}</text>`);
    }
  }

  curY += trH + trackGap;
}

add('</svg>');

const outPath = path.resolve(__dirname, '..', 'gantt-session.svg');
fs.writeFileSync(outPath, lines.join('\n'), 'utf-8');
console.log('Gantt chart rendered to', outPath);
