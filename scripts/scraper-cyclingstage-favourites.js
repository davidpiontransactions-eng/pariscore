#!/usr/bin/env node
// -*- coding: utf-8 -*-
/**
 * scraper-cyclingstage-favourites.js
 * ----------------------------------
 * Port Node (zéro dépendance) du scraper Python originel.
 * Scrape les descriptions et favoris des étapes du Tour de France 2026
 * depuis cyclingstage.com, et les sauvegarde dans data/cycling/stage-favourites.json
 * (consommé par services/cyclingService.js via /api/v1/cycling/favourites).
 *
 * Pourquoi un port Node : le scraper Python exige python3 sur le VPS, ce qui est
 * fragile sur une stack Bun/Node. Ce port utilise uniquement le runtime stdlib,
 * donc il tourne partout où le backend tourne. Les regex/heuristiques sont
 * identiques au Python d'origine pour préserver le contrat de données.
 *
 * Usage:
 *   node scraper-cyclingstage-favourites.js --stage 9
 *   node scraper-cyclingstage-favourites.js --all
 *   node scraper-cyclingstage-favourites.js --current     # étape du jour (selon date)
 *   node scraper-cyclingstage-favourites.js --next        # prochaine étape
 *   node scraper-cyclingstage-favourites.js --current --force
 *
 * Source: https://www.cyclingstage.com/tour-de-france-2026-favourites/stage-N-contenders-tdf-2026/
 *
 * Calendrier : data/cycling/stages-calendar.json (source unique partagée avec
 * cyclingService.js). Anciennement codé en dur TDF_2026_STAGES dans le Python.
 */
'use strict';

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

// ─── Constantes ───────────────────────────────────────────────────────────────
const BASE_URL = 'https://www.cyclingstage.com/tour-de-france-2026-favourites/stage-{n}-contenders-tdf-2026/';
const SCRIPT_DIR = path.dirname(path.resolve(__filename));
const REPO_DIR = path.dirname(SCRIPT_DIR);
const OUTPUT_FILE = path.join(REPO_DIR, 'data', 'cycling', 'stage-favourites.json');
const CALENDAR_FILE = path.join(REPO_DIR, 'data', 'cycling', 'stages-calendar.json');
const USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const HTTP_TIMEOUT = 30000;
const DELAY_BETWEEN_REQUESTS = 1500; // ms — politesse

// ─── Calendrier (source unique) ───────────────────────────────────────────────
// Map: stageNumber -> 'YYYY-MM-DD'. Lu depuis stages-calendar.json pour rester
// parfaitement aligné avec cyclingService.js (qui lit le même fichier).
function loadCalendar() {
  const raw = JSON.parse(fs.readFileSync(CALENDAR_FILE, 'utf-8'));
  const map = {};
  for (const s of raw.stages) map[s.stage] = s.date;
  return map;
}
const TDF_2026_STAGES = loadCalendar();

// ─── Helpers HTTP ─────────────────────────────────────────────────────────────
function fetchUrl(url) {
  return new Promise((resolve) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,fr;q=0.8',
      },
      timeout: HTTP_TIMEOUT,
    }, (res) => {
      // Suivre les redirections (3xx)
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(fetchUrl(res.headers.location));
      }
      if (res.statusCode !== 200) {
        if (res.statusCode === 404) return resolve(null); // étape pas encore publiée
        console.error(`[WARN] HTTP ${res.statusCode} sur ${url}`);
        return resolve(null);
      }
      let body = '';
      res.setEncoding('utf-8');
      res.on('data', (d) => { body += d; });
      res.on('end', () => resolve(body));
    });
    req.on('error', (e) => {
      console.error(`[WARN] Erreur fetch ${url}: ${e.message}`);
      resolve(null);
    });
    req.on('timeout', () => {
      console.error(`[WARN] Timeout fetch ${url}`);
      req.destroy();
      resolve(null);
    });
  });
}

// ─── Parsing HTML (zéro dépendance) ──────────────────────────────────────────
// Décode les entités HTML courantes + normalise le whitespace, à la manière
// du TextExtractor Python.
function decodeEntities(text) {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&rsquo;|&apos;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&ldquo;|&rdquo;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&mdash;|&ndash;/g, '-');
}

// Strip basique des tags + conservation des sauts de ligne pour <br>, <p>, <div>...
function stripTags(htmlFragment) {
  let t = htmlFragment;
  // Retire script/style/nav/header/footer
  t = t.replace(/<(script|style|nav|header|footer)\b[^>]*>[\s\S]*?<\/\1>/gi, '');
  // <br> → newline
  t = t.replace(/<br\s*\/?>/gi, '\n');
  // Balises de bloc → newline
  t = t.replace(/<\/?(p|h[1-6]|li|div|tr)\b[^>]*>/gi, '\n');
  // Retire toutes les autres balises
  t = t.replace(/<[^>]+>/g, '');
  // Entités
  t = decodeEntities(t);
  // Normalise whitespace (équivaut au Python)
  t = t.replace(/[ \t]+/g, ' ');
  t = t.replace(/\n[ \t]+/g, '\n');
  t = t.replace(/\n{3,}/g, '\n\n');
  return t.trim();
}

function extractStageData(html, stageN) {
  const data = {
    stage: stageN,
    url: BASE_URL.replace('{n}', stageN),
    scraped_at: new Date().toISOString(),
    title: null,
    description: null,
    favourites_raw: null,
    favourites: [],
    weather_forecast: null,
    publication_info: null,
    status: 'ok',
    error: null,
  };

  // 1. Titre
  let m = html.match(/<h1[^>]*>(Tour de France 2026 Favourites stage \d+:.*?)<\/h1>/is);
  if (m) data.title = stripTags(m[1]).trim();

  // 2. Description (h1 → premier h2 "Favourites")
  m = html.match(/<h1[^>]*>Tour de France 2026 Favourites[\s\S]*?<\/h1>([\s\S]*?)(?=<h2[^>]*>Favourites)/i);
  if (m) {
    const articleHtml = m[1];
    const paras = articleHtml.match(/<p[^>]*>[\s\S]*?<\/p>/gi) || [];
    const descriptionParts = [];
    let publicationInfo = null;
    let weather = null;
    for (const p of paras) {
      const text = stripTags(p).trim();
      if (!text) continue;
      if (text.startsWith('(Slideshow')) continue;
      if (/^First published on/i.test(text)) { publicationInfo = text; continue; }
      if (/^weather forecast/i.test(text)) { weather = text; continue; }
      if (/Another interesting read/i.test(text) || /prize pool/i.test(text)) continue;
      if (/^fotobureau/i.test(text) || /^Cor Vos/i.test(text) || /^Photo:/i.test(text)) {
        const cleaned = text.replace(/^(fotobureau\s+Cor Vos|Cor Vos|Photo:.*?)(?=[A-Z])/, '').trim();
        if (cleaned) descriptionParts.push(cleaned);
      } else {
        descriptionParts.push(text);
      }
    }
    if (descriptionParts.length) data.description = descriptionParts.join('\n\n');
    if (publicationInfo) data.publication_info = publicationInfo;
    if (weather) data.weather_forecast = weather;
  }

  // 3. Section Favourites (h2 "Favourites ..." + <p> suivant)
  m = html.match(/<h2[^>]*>Favourites\s+\d+(?:st|nd|rd|th)\s+stage[\s\S]*?<\/h2>\s*<p>([\s\S]*?)<\/p>/i);
  if (m) {
    const favHtml = m[1].replace(/<br\s*\/?>/gi, '\n');
    const favText = stripTags(favHtml).trim();
    data.favourites_raw = favText;

    // Parse les tiers: *** / ** / *
    const favourites = [];
    for (const lineRaw of favText.split('\n')) {
      const line = lineRaw.trim();
      if (!line) continue;
      const tierMatch = line.match(/^(\*{1,3})\s+(.+)$/);
      if (!tierMatch) continue;
      const tier = tierMatch[1];
      const content = tierMatch[2].trim();

      // Split sur les virgules hors parenthèses
      const entries = [];
      let current = '';
      let depth = 0;
      for (const char of content) {
        if (char === '(') { depth++; current += char; }
        else if (char === ')') { depth--; current += char; }
        else if (char === ',' && depth === 0) {
          if (current.trim()) entries.push(current.trim());
          current = '';
        } else { current += char; }
      }
      if (current.trim()) entries.push(current.trim());

      for (let entry of entries) {
        entry = entry.trim().replace(/,$/, '').trim();
        if (!entry) continue;
        const teamMatch = entry.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
        if (teamMatch) {
          const team = teamMatch[1].trim();
          const riders = teamMatch[2].split(',').map((r) => r.trim()).filter(Boolean);
          favourites.push({ tier, team, riders });
        } else {
          // Rider solo sans équipe (ex: étapes mass-start)
          favourites.push({ tier, team: null, riders: [entry] });
        }
      }
    }
    data.favourites = favourites;
  }

  if (!data.title && !data.favourites.length) {
    data.status = 'empty';
    data.error = 'Page exists but no title/favourites found — possibly not yet published';
  }
  return data;
}

// ─── Main ────────────────────────────────────────────────────────────────────
function determineCurrentStage() {
  // Europe/Paris = UTC+2
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
  for (const [n, date] of Object.entries(TDF_2026_STAGES)) {
    if (date === today) return Number(n);
  }
  return null;
}

function determineNextStage() {
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
  for (const n of Object.keys(TDF_2026_STAGES).map(Number).sort((a, b) => a - b)) {
    if (TDF_2026_STAGES[n] >= today) return n;
  }
  return null;
}

function loadExistingData() {
  if (fs.existsSync(OUTPUT_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf-8'));
    } catch (e) {
      console.error(`[WARN] Erreur lecture ${OUTPUT_FILE}: ${e.message}`);
    }
  }
  return { race: 'Tour de France 2026', source: 'cyclingstage.com', last_update: null, stages: {} };
}

function saveData(data) {
  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  data.last_update = new Date().toISOString();
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(data, null, 2), 'utf-8');
  console.log(`[OK] Données sauvegardées dans ${OUTPUT_FILE}`);
}

async function scrapeStage(stageN, force) {
  const existing = loadExistingData();
  if (!force && existing.stages[String(stageN)]) {
    const existingData = existing.stages[String(stageN)];
    const scrapedAt = existingData.scraped_at || '';
    if (scrapedAt) {
      try {
        const ageHours = (Date.now() - new Date(scrapedAt).getTime()) / 3600000;
        if (ageHours < 6) {
          console.log(`[SKIP] Stage ${stageN} déjà scrapé il y a ${ageHours.toFixed(1)}h (< 6h)`);
          return existingData;
        }
      } catch (e) { /* ignore */ }
    }
  }

  const url = BASE_URL.replace('{n}', stageN);
  console.log(`[SCRAPING] Stage ${stageN}: ${url}`);
  const html = await fetchUrl(url);
  if (!html) {
    console.log(`[FAIL] Stage ${stageN}: page introuvable ou erreur fetch`);
    return null;
  }

  const stageData = extractStageData(html, stageN);
  if (stageData.status === 'empty') {
    console.log(`[EMPTY] Stage ${stageN}: page sans contenu — probablement pas encore publiée`);
    return stageData;
  }

  console.log(
    `[OK] Stage ${stageN}: ${(stageData.description || '').length} chars description, ` +
    `${(stageData.favourites || []).length} favoris`
  );
  return stageData;
}

function parseArgs(argv) {
  const args = { stage: null, all: false, current: false, next: false, force: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--all') args.all = true;
    else if (a === '--current') args.current = true;
    else if (a === '--next') args.next = true;
    else if (a === '--force') args.force = true;
    else if (a === '--stage') { args.stage = Number(argv[++i]); args._stageRaw = true; }
    else if (a.startsWith('--stage=')) args.stage = Number(a.slice(8));
    else if (a === '-h' || a === '--help') args.help = true;
  }
  if (!args.stage && !args.all && !args.current && !args.next) args.next = true;
  return args;
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    console.log(`Usage: node ${path.basename(__filename)} [--stage N | --all | --current | --next] [--force]`);
    process.exit(0);
  }

  const existing = loadExistingData();
  let stagesToScrape = [];
  if (args.all) stagesToScrape = Array.from({ length: 21 }, (_, i) => i + 1);
  else if (args._stageRaw || args.stage) stagesToScrape = [args.stage];
  else if (args.current) {
    const n = determineCurrentStage();
    if (n === null) {
      console.log("[INFO] Pas d'étape aujourd'hui (jour de repos ou hors TdF)");
      const next = determineNextStage();
      if (next) {
        console.log(`[INFO] Scraping prochaine étape: ${next}`);
        stagesToScrape = [next];
      }
    } else {
      stagesToScrape = [n];
    }
  } else if (args.next) {
    const n = determineNextStage();
    if (n === null) { console.log('[INFO] TdF 2026 terminé'); return; }
    stagesToScrape = [n];
  }

  const nowParis = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).format(new Date());
  console.log(`[INFO] Étapes à scraper: ${stagesToScrape.join(', ')}`);
  console.log(`[INFO] Date du jour (Europe/Paris): ${nowParis}`);

  for (let i = 0; i < stagesToScrape.length; i++) {
    const n = stagesToScrape[i];
    const stageData = await scrapeStage(n, args.force);
    if (stageData) {
      existing.stages[String(n)] = stageData;
      existing.last_update = new Date().toISOString();
      saveData(existing);
    }
    if (i < stagesToScrape.length - 1) {
      await new Promise((r) => setTimeout(r, DELAY_BETWEEN_REQUESTS));
    }
  }

  // Résumé
  console.log('\n=== RÉSUMÉ ===');
  console.log(`Total étapes en base: ${Object.keys(existing.stages).length}`);
  for (const nStr of Object.keys(existing.stages).map(Number).sort((a, b) => a - b)) {
    const s = existing.stages[String(nStr)];
    const icon = s.status === 'ok' ? '✓' : '✗';
    const title = (s.title || '—').slice(0, 80);
    console.log(`  Stage ${String(nStr).padStart(2)}: ${icon} ${title}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
