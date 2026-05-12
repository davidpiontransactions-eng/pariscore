#!/usr/bin/env node
// Convert markdown to .docx (PariScore routing schema). Heuristic md parser focused on:
// - # / ## / ### headings
// - GitHub-flavored tables (| col1 | col2 |)
// - Bullet lists (- or *)
// - Numbered lists (1. 2. 3.)
// - Fenced code blocks (``` ... ```)
// - Inline `code`
// - **bold** and *italic*
// - Blockquotes (>)
//
// Usage: node scripts/md-to-docx.js <input.md> <output.docx>

const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, AlignmentType, WidthType, BorderStyle, ShadingType,
  LevelFormat, ExternalHyperlink, PageOrientation,
} = require('docx');

const [, , inputPath, outputPath] = process.argv;
if (!inputPath || !outputPath) {
  console.error('Usage: node md-to-docx.js <input.md> <output.docx>');
  process.exit(1);
}

const md = fs.readFileSync(inputPath, 'utf8');
const lines = md.split(/\r?\n/);

const FONT = 'Arial';
const CONTENT_WIDTH_DXA = 9360; // US Letter 1" margins
const CELL_BORDER = { style: BorderStyle.SINGLE, size: 4, color: 'BBBBBB' };
const CELL_BORDERS = { top: CELL_BORDER, bottom: CELL_BORDER, left: CELL_BORDER, right: CELL_BORDER };

// Inline parsing: returns array of TextRun
function parseInline(text) {
  const runs = [];
  // Tokenize: split keeping delimiters. Handle in priority: code > bold > italic > link
  const re = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*\s][^*]*?\*|\[[^\]]+\]\([^)]+\))/g;
  let lastIdx = 0;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > lastIdx) {
      runs.push(new TextRun({ text: text.slice(lastIdx, m.index), font: FONT }));
    }
    const tok = m[0];
    if (tok.startsWith('`')) {
      runs.push(new TextRun({ text: tok.slice(1, -1), font: 'Consolas', size: 18, shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'F2F2F2' } }));
    } else if (tok.startsWith('**')) {
      runs.push(new TextRun({ text: tok.slice(2, -2), font: FONT, bold: true }));
    } else if (tok.startsWith('*')) {
      runs.push(new TextRun({ text: tok.slice(1, -1), font: FONT, italics: true }));
    } else if (tok.startsWith('[')) {
      const linkMatch = tok.match(/\[([^\]]+)\]\(([^)]+)\)/);
      if (linkMatch) {
        runs.push(new ExternalHyperlink({
          link: linkMatch[2],
          children: [new TextRun({ text: linkMatch[1], font: FONT, color: '1F6FEB', underline: { type: 'single' } })],
        }));
      }
    }
    lastIdx = m.index + tok.length;
  }
  if (lastIdx < text.length) {
    runs.push(new TextRun({ text: text.slice(lastIdx), font: FONT }));
  }
  return runs.length ? runs : [new TextRun({ text: '', font: FONT })];
}

function buildTable(headers, rows) {
  const ncols = headers.length;
  const colWidth = Math.floor(CONTENT_WIDTH_DXA / ncols);
  const cw = new Array(ncols).fill(colWidth);
  cw[ncols - 1] = CONTENT_WIDTH_DXA - colWidth * (ncols - 1);

  function makeCell(text, isHeader = false) {
    return new TableCell({
      width: { size: colWidth, type: WidthType.DXA },
      borders: CELL_BORDERS,
      shading: isHeader ? { type: ShadingType.CLEAR, color: 'auto', fill: 'E1ECF7' } : undefined,
      margins: { top: 60, bottom: 60, left: 80, right: 80 },
      children: [new Paragraph({
        children: isHeader
          ? [new TextRun({ text, font: FONT, bold: true })]
          : parseInline(text),
      })],
    });
  }

  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map(h => makeCell(h, true)),
  });
  const dataRows = rows.map(r => new TableRow({
    children: r.map(c => makeCell(c, false)),
  }));

  return new Table({
    width: { size: CONTENT_WIDTH_DXA, type: WidthType.DXA },
    columnWidths: cw,
    rows: [headerRow, ...dataRows],
  });
}

// Parse markdown into block-level elements
const children = [];
let i = 0;

function consumeCodeBlock() {
  i++; // skip opening ```
  const buf = [];
  while (i < lines.length && !lines[i].trim().startsWith('```')) {
    buf.push(lines[i]);
    i++;
  }
  if (i < lines.length) i++; // skip closing ```
  for (const line of buf) {
    children.push(new Paragraph({
      children: [new TextRun({ text: line || ' ', font: 'Consolas', size: 18 })],
      shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'F8F8F8' },
      spacing: { before: 0, after: 0 },
    }));
  }
}

function consumeTable() {
  const headerLine = lines[i].trim();
  const headers = headerLine.split('|').slice(1, -1).map(s => s.trim());
  i++;
  // Skip separator row |---|---|
  if (i < lines.length && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i])) i++;
  const rows = [];
  while (i < lines.length && lines[i].trim().startsWith('|')) {
    const cells = lines[i].split('|').slice(1, -1).map(s => s.trim());
    while (cells.length < headers.length) cells.push('');
    rows.push(cells);
    i++;
  }
  children.push(buildTable(headers, rows));
  children.push(new Paragraph({ children: [new TextRun({ text: '', font: FONT })], spacing: { after: 120 } }));
}

while (i < lines.length) {
  const line = lines[i];
  const trimmed = line.trim();

  if (trimmed.startsWith('```')) {
    consumeCodeBlock();
    continue;
  }
  if (trimmed.startsWith('|') && i + 1 < lines.length && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1])) {
    consumeTable();
    continue;
  }
  if (trimmed.startsWith('# ')) {
    children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: parseInline(trimmed.slice(2)), spacing: { before: 360, after: 200 } }));
    i++; continue;
  }
  if (trimmed.startsWith('## ')) {
    children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: parseInline(trimmed.slice(3)), spacing: { before: 280, after: 160 } }));
    i++; continue;
  }
  if (trimmed.startsWith('### ')) {
    children.push(new Paragraph({ heading: HeadingLevel.HEADING_3, children: parseInline(trimmed.slice(4)), spacing: { before: 240, after: 120 } }));
    i++; continue;
  }
  if (trimmed.startsWith('> ')) {
    children.push(new Paragraph({
      children: parseInline(trimmed.slice(2)),
      indent: { left: 360 },
      border: { left: { style: BorderStyle.SINGLE, size: 12, space: 8, color: '888888' } },
      spacing: { before: 80, after: 80 },
    }));
    i++; continue;
  }
  if (/^[-*+]\s+/.test(trimmed)) {
    children.push(new Paragraph({
      numbering: { reference: 'bullets', level: 0 },
      children: parseInline(trimmed.replace(/^[-*+]\s+/, '')),
    }));
    i++; continue;
  }
  if (/^\d+\.\s+/.test(trimmed)) {
    children.push(new Paragraph({
      numbering: { reference: 'numbers', level: 0 },
      children: parseInline(trimmed.replace(/^\d+\.\s+/, '')),
    }));
    i++; continue;
  }
  if (trimmed === '---') {
    children.push(new Paragraph({
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'AAAAAA', space: 1 } },
      children: [new TextRun({ text: '', font: FONT })],
      spacing: { before: 120, after: 120 },
    }));
    i++; continue;
  }
  if (trimmed === '') {
    children.push(new Paragraph({ children: [new TextRun({ text: '', font: FONT })], spacing: { after: 80 } }));
    i++; continue;
  }
  children.push(new Paragraph({ children: parseInline(trimmed), spacing: { after: 80 } }));
  i++;
}

const doc = new Document({
  creator: 'PariScore',
  title: path.basename(inputPath, '.md'),
  styles: {
    default: { document: { run: { font: FONT, size: 22 } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 36, bold: true, font: FONT, color: '1F4E79' },
        paragraph: { spacing: { before: 360, after: 200 }, outlineLevel: 0 } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 28, bold: true, font: FONT, color: '2E75B6' },
        paragraph: { spacing: { before: 280, after: 160 }, outlineLevel: 1 } },
      { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 24, bold: true, font: FONT, color: '2E75B6' },
        paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 2 } },
    ],
  },
  numbering: {
    config: [
      { reference: 'bullets', levels: [{
        level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 720, hanging: 360 } } },
      }] },
      { reference: 'numbers', levels: [{
        level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 720, hanging: 360 } } },
      }] },
    ],
  },
  sections: [{
    properties: {
      page: {
        size: { width: 12240, height: 15840, orientation: PageOrientation.PORTRAIT },
        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
      },
    },
    children,
  }],
});

Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync(outputPath, buf);
  console.log(`Generated ${outputPath} (${buf.length} bytes, ${children.length} blocks)`);
}).catch(err => {
  console.error('Pack error:', err);
  process.exit(1);
});
