const fs = require("fs");
const spec = JSON.parse(
  fs.readFileSync("C:/Users/David/ZCodeProject/pariscore/gantt-tasks.json", "utf8")
);

function parseDate(d) {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(y, m - 1, day);
}

const items = spec.tracks.flatMap((t) => t.items.map((i) => ({ ...i, track: t.name })));
const allDates = items.flatMap((i) => [parseDate(i.start), parseDate(i.end)]);
const minDate = new Date(Math.min(...allDates));
const maxDate = new Date(Math.max(...allDates));
const daySpan = Math.ceil((maxDate - minDate) / 86400000) + 1;

const days = [];
for (let i = 0; i < daySpan; i++) {
  const d = new Date(minDate);
  d.setDate(d.getDate() + i);
  const dayName = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"][d.getDay()];
  days.push(dayName + " " + d.getDate());
}

const colors = ["#00e676", "#0077ff", "#ff6b35", "#ffd700", "#a855f7", "#ef4444"];
const cellW = 110,
  cellH = 28,
  trackH = 26,
  leftW = 220,
  pad = 40;

function fmt(d) {
  return d.toISOString().slice(0, 10);
}

const totalH =
  pad * 2 +
  28 +
  spec.tracks.reduce((sum, t) => {
    const h = t.items.length * (cellH + 2) + 2;
    return sum + trackH + h + 8;
  }, 0);
const totalW = leftW + daySpan * cellW + 20;

let svg =
  '<svg xmlns="http://www.w3.org/2000/svg" font-family="Inter,Roboto,sans-serif" width="' +
  totalW +
  '" height="' +
  totalH +
  '">';
svg += '<rect width="100%" height="100%" fill="#0e1420"/>';

svg +=
  '<text x="' +
  totalW / 2 +
  '" y="30" text-anchor="middle" fill="#ffffff" font-size="18" font-weight="700">' +
  spec.title +
  "</text>";

let y = pad + 8;

svg +=
  '<text x="' +
  (leftW + 10) +
  '" y="' +
  (y + 14) +
  '" fill="#8b9bb5" font-size="11">Date</text>';
for (let i = 0; i < days.length; i++) {
  const x = leftW + i * cellW + 10;
  svg +=
    '<text x="' +
    (x - 10) +
    '" y="' +
    (y + 14) +
    '" fill="#8b9bb5" font-size="10" text-anchor="middle">' +
    days[i] +
    "</text>";
  svg +=
    '<line x1="' +
    x +
    '" y1="' +
    (y + 16) +
    '" x2="' +
    x +
    '" y2="' +
    (totalH - pad) +
    '" stroke="rgba(255,255,255,0.05)" stroke-width="1"/>';
}

y += 28;

spec.tracks.forEach((track, ti) => {
  svg +=
    '<rect x="' +
    pad +
    '" y="' +
    y +
    '" width="' +
    (totalW - pad * 2) +
    '" height="' +
    trackH +
    '" fill="' +
    colors[ti % colors.length] +
    "22\" rx=\"4\"/>";
  svg +=
    '<text x="' +
    (pad + 12) +
    '" y="' +
    (y + 17) +
    '" fill="' +
    colors[ti % colors.length] +
    '" font-size="13" font-weight="700">' +
    track.name.replace(/&/g, "&amp;") +
    "</text>";
  y += trackH + 4;

  track.items.forEach((item, ii) => {
    const rowY = y + ii * (cellH + 2);
    const bg = ii % 2 === 0 ? "#172132" : "#1a2538";
    svg +=
      '<rect x="' +
      pad +
      '" y="' +
      rowY +
      '" width="' +
      (totalW - pad * 2) +
      '" height="' +
      cellH +
      '" fill="' +
      bg +
      '" rx="3"/>';

    svg +=
      '<text x="' +
      (pad + 12) +
      '" y="' +
      (rowY + 18) +
      '" fill="#e0e0e0" font-size="12">' +
      item.label.replace(/&/g, "&amp;") +
      "</text>";

    const startIdx = Math.round((parseDate(item.start) - minDate) / 86400000);
    const endIdx = Math.round((parseDate(item.end) - minDate) / 86400000);
    const barX = leftW + startIdx * cellW + 4;
    const barW = (endIdx - startIdx + 1) * cellW - 8;
    const barY = rowY + 4;

    svg +=
      '<rect x="' +
      barX +
      '" y="' +
      barY +
      '" width="' +
      barW +
      '" height="' +
      (cellH - 8) +
      '" fill="' +
      colors[ti % colors.length] +
      '" rx="3" opacity="0.85"/>';
    svg +=
      '<text x="' +
      (barX + barW / 2) +
      '" y="' +
      (barY + 14) +
      '" text-anchor="middle" fill="#fff" font-size="10" font-weight="600">' +
      item.start.slice(5) +
      " \u2192 " +
      item.end.slice(5) +
      "</text>";
  });

  y += track.items.length * (cellH + 2) + 8;
});

svg += "</svg>";
fs.writeFileSync("C:/Users/David/ZCodeProject/pariscore/gantt-tasks.svg", svg);
console.log("OK: gantt-tasks.svg generated");
console.log("Tracks: " + spec.tracks.length + ", Tasks: " + items.length);
console.log("Range: " + fmt(minDate) + " to " + fmt(maxDate));
