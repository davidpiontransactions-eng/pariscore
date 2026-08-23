const fs = require('fs');
const src = fs.readFileSync('src/lib/tennis-elo/jsfrag.ts', 'utf8');
const normalized = src.replace(/import \{ normalizeKey \} from "\.\/scraper";/, 'const normalizeKey = (s) => s.trim().toLowerCase();');
fs.writeFileSync('scripts/tmp-jsfrag-test.ts', normalized);