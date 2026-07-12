#!/usr/bin/env node
// -*- coding: utf-8 -*-
/**
 * scraper-cycling-translate.js
 * ---------------------------
 * Port Node du scraper de traduction Python. Traduit le contenu EN scrapé
 * (data/cycling/stage-favourites.json) vers les langues supportées via Google Gemini,
 * et écrit data/cycling/stage-favourites-i18n.json (consommé par cyclingService.js).
 *
 * BUG ORIGINE (2026-07-12) : le script Python shell-out vers le CLI `z-ai` qui n'était
 * ni sur le PATH ni configuré (.z-ai-config absent) → le fichier i18n ne contenait
 * QUE 2 étapes avec des blocs i18n VIDES. Aucune traduction n'avait jamais réussi.
 * Porté en Node avec le SDK @google/generative-ai (déjà utilisé dans le projet pour
 * d'autres features IA) + retries/backoff + fusion incrémentale (on n'écrase jamais
 * une traduction existante sauf --force).
 *
 * Contrat de sortie (consommé par cyclingService.js:663 getStageFavourites) :
 *   stages["N"].i18n[lang] = { title?, description?, weather_forecast?, publication_info? }
 * Chaque champ est optionnel ; le service fallback champ par champ sur l'EN.
 *
 * Usage:
 *   node scraper-cycling-translate.js --lang fr                    # FR seulement, étapes manquantes
 *   node scraper-cycling-translate.js --lang fr,es,de,it,nl,pt     # 6 langues
 *   node scraper-cycling-translate.js --current --lang fr          # étape du jour seulement
 *   node scraper-cycling-translate.js --stage 9 --lang fr
 *   node scraper-cycling-translate.js --all --lang fr --force      # tout re-traduire
 *
 * Prérequis : GEMINI_API_KEY dans l'environnement ou le .env du projet.
 */
'use strict';

const fs = require('fs');
const path = require('path');

// ─── Constantes ───────────────────────────────────────────────────────────────
const SCRIPT_DIR = path.dirname(path.resolve(__filename));
const REPO_DIR = path.dirname(SCRIPT_DIR);
const INPUT_FILE = path.join(REPO_DIR, 'data', 'cycling', 'stage-favourites.json');
const OUTPUT_FILE = path.join(REPO_DIR, 'data', 'cycling', 'stage-favourites-i18n.json');
const CALENDAR_FILE = path.join(REPO_DIR, 'data', 'cycling', 'stages-calendar.json');

// gemini-2.0-flash-lite : quota free bien plus généreux que 2.5-flash pour les tâches
// textuelles simples comme la traduction. Override possible via GEMINI_MODEL.
const MODEL_NAME = process.env.GEMINI_MODEL || 'gemini-2.0-flash-lite';

// Langues supportées (cohérent avec l'objet I18N de pariscore.html:12359)
const SUPPORTED_LANGS = {
  fr: 'French',
  es: 'Spanish',
  de: 'German',
  it: 'Italian',
  nl: 'Dutch',
  pt: 'Portuguese',
};

const MAX_RETRIES = 5;
const RETRY_BASE_MS = 2000;       // backoff exponentiel : 2s, 4s, 8s, 16s, 32s
const RATE_LIMIT_WAIT_MS = 30000; // attente spécifique pour 429 Too Many Requests
const DELAY_BETWEEN_CALLS = 2000; // politesse entre appels Gemini (2s = ~30 req/min, sous le quota free)
const REQUEST_TIMEOUT_MS = 60000;

// ─── Chargement du .env (si pas déjà chargé par le processus parent) ──────────
// On lit manuellement .env pour ne pas dépendre du package dotenv (pas toujours installé).
function loadDotEnv() {
  const envPath = path.join(REPO_DIR, '.env');
  if (!fs.existsSync(envPath)) return;
  try {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      // Retire les quotes entourantes
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (key && !(key in process.env)) process.env[key] = val;
    }
  } catch (e) { /* ignore */ }
}
loadDotEnv();

// ─── Client Gemini (lazy init) ────────────────────────────────────────────────
let _genAI = null;
function getGenAI() {
  if (_genAI) return _genAI;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('❌ ERREUR : GEMINI_API_KEY manquant.');
    console.error('   Ajoute GEMINI_API_KEY=... dans .env (ou exporte-le dans le shell).');
    console.error('   Obtiens une clé gratuite : https://aistudio.google.com/app/apikey');
    process.exit(2);
  }
  const { GoogleGenerativeAI } = require('@google/generative-ai');
  _genAI = new GoogleGenerativeAI(apiKey);
  return _genAI;
}

// ─── Prompt calibré cyclisme (repris du Python scraper-cycling-translate.py:52) ─
function buildSystemPrompt(langName) {
  return (
    'You are a professional sports translator specializing in cycling. ' +
    'Translate the following English text to ' + langName + '. ' +
    "Keep technical cycling terms accurate (e.g., 'team time trial', 'GC', 'yellow jersey', " +
    "'punchy climbers', 'gradient'). " +
    'Preserve the structure (paragraphs, line breaks). ' +
    'Return ONLY the translated text, no commentary, no preamble.'
  );
}

// ─── Traduction d'un texte via Gemini, avec retries ───────────────────────────
async function translateText(text, langCode) {
  if (!text || !text.trim()) return null;
  const langName = SUPPORTED_LANGS[langCode];
  if (!langName) throw new Error('Langue non supportée: ' + langCode);

  const genAI = getGenAI();
  const model = genAI.getGenerativeModel({
    model: MODEL_NAME,
    systemInstruction: buildSystemPrompt(langName),
  });

  const userPrompt = 'Translate this English cycling text to ' + langName + ':\n\n' + text;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      // AbortController pour respecter le timeout (au cas où le SDK hang)
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      }, { fetchOptions: { signal: controller.signal } });
      clearTimeout(timer);

      const response = result.response;
      const out = (response.text() || '').trim();
      if (!out) throw new Error('Réponse vide de Gemini');
      return out;
    } catch (e) {
      const msg = e.message || String(e);
      if (attempt < MAX_RETRIES) {
        // 429 Too Many Requests → attente plus longue (quota Gemini free limité)
        const isRateLimit = /429|Too Many|RESOURCE_EXHAUSTED|rate limit/i.test(msg);
        const wait = isRateLimit ? RATE_LIMIT_WAIT_MS : RETRY_BASE_MS * Math.pow(2, attempt - 1);
        const reason = isRateLimit ? 'RATE-LIMIT' : 'RETRY';
        console.error('    [' + reason + ' ' + attempt + '/' + MAX_RETRIES + '] ' + msg.slice(0, 90) + ' — attente ' + (wait / 1000) + 's');
        await new Promise((r) => setTimeout(r, wait));
      } else {
        console.error('    [FAIL] Traduction échouée après ' + MAX_RETRIES + ' essais: ' + msg.slice(0, 150));
        return null;
      }
    }
  }
  return null;
}

// ─── Helpers calendrier (pour --current) ──────────────────────────────────────
function loadCalendar() {
  const raw = JSON.parse(fs.readFileSync(CALENDAR_FILE, 'utf-8'));
  const map = {};
  for (const s of raw.stages) map[s.stage] = s.date;
  return map;
}
function determineCurrentStage() {
  const cal = loadCalendar();
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
  for (const [n, date] of Object.entries(cal)) if (date === today) return Number(n);
  return null;
}

// ─── Lecture source + i18n existant ───────────────────────────────────────────
function loadInput() {
  return JSON.parse(fs.readFileSync(INPUT_FILE, 'utf-8'));
}
function loadExistingI18n() {
  if (fs.existsSync(OUTPUT_FILE)) {
    try { return JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf-8')); }
    catch (e) { console.error('[WARN] i18n existant illisible, on repart de zéro'); }
  }
  return null;
}

// ─── Traduction d'une étape pour une langue ───────────────────────────────────
// Champs à traduire (contrat cyclingService.js:663-668) :
const FIELDS = ['title', 'description', 'weather_forecast', 'publication_info'];

async function translateStage(stageData, langCode, force) {
  const existing = (stageData.i18n && stageData.i18n[langCode]) || {};
  const result = {};
  for (const field of FIELDS) {
    const sourceVal = stageData[field];
    if (!sourceVal || !String(sourceVal).trim()) continue; // pas de source → rien à traduire
    if (!force && existing[field]) {
      result[field] = existing[field]; // conserve la traduction existante
      continue;
    }
    const translated = await translateText(sourceVal, langCode);
    if (translated) {
      result[field] = translated;
      console.log('    [' + field + '] ✓ ' + translated.length + ' chars');
    } else {
      console.log('    [' + field + '] ✗ échec (conservé: ' + (existing[field] ? 'ancien' : 'rien') + ')');
      if (existing[field]) result[field] = existing[field]; // garde l'ancien si échec
    }
    await new Promise((r) => setTimeout(r, DELAY_BETWEEN_CALLS));
  }
  return result;
}

// ─── Écriture du fichier i18n (fusion, pas écrasement) ────────────────────────
function saveI18n(inputData, i18nData) {
  // On reconstruit le fichier i18n : recopie la source (toutes les étapes) + réinjecte les blocs i18n
  const out = JSON.parse(JSON.stringify(inputData)); // deep clone de la source (EN)
  for (const n of Object.keys(i18nData.stages || {})) {
    const src = out.stages[n];
    const tr = i18nData.stages[n];
    if (src && tr && tr.i18n) src.i18n = tr.i18n; // conserve le bloc i18n existant
  }
  out.i18n_last_update = new Date().toISOString();
  out.i18n_languages = Object.keys(SUPPORTED_LANGS);
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(out, null, 2), 'utf-8');
  console.log('[OK] i18n sauvegardé dans ' + OUTPUT_FILE);
}

// ─── CLI ──────────────────────────────────────────────────────────────────────
function findFirstMissingStage(inputData, existingI18n, langs) {
  // Retourne le numéro de la première étape (par ordre chronologique) dont la
  // traduction est incomplète pour au moins une des langues ciblées. Sert au mode
  // --next-missing utilisé par le cron : 1 étape par exécution pour rester sous le
  // quota Gemini free (au lieu d'une rafale de 500 requêtes qui déclenche des 429).
  const stages = Object.keys(inputData.stages || {}).map(Number).sort((a, b) => a - b);
  for (const n of stages) {
    const src = inputData.stages[String(n)];
    if (!src || src.status !== 'ok') continue;
    const i18nStage = (existingI18n.stages && existingI18n.stages[String(n)]) || {};
    const i18n = i18nStage.i18n || {};
    for (const lang of langs) {
      const tr = i18n[lang] || {};
      // Incomplet si un champ source non-vide n'a pas de traduction
      const incomplete = FIELDS.some((f) => src[f] && String(src[f]).trim() && !tr[f]);
      if (incomplete) return n;
    }
  }
  return null;
}

function parseArgs(argv) {
  const args = { langs: ['fr'], stage: null, all: false, current: false, nextMissing: false, force: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--all') args.all = true;
    else if (a === '--current') args.current = true;
    else if (a === '--next-missing') args.nextMissing = true;
    else if (a === '--force') args.force = true;
    else if (a === '--lang') { args.langs = (argv[++i] || '').split(',').map((s) => s.trim()).filter(Boolean); }
    else if (a.startsWith('--lang=')) args.langs = a.slice(7).split(',').map((s) => s.trim()).filter(Boolean);
    else if (a === '--stage') args.stage = Number(argv[++i]);
    else if (a.startsWith('--stage=')) args.stage = Number(a.slice(8));
    else if (a === '-h' || a === '--help') args.help = true;
  }
  // Validation des langues
  args.langs = args.langs.filter((l) => { if (!SUPPORTED_LANGS[l]) { console.error('Langue ignorée (non supportée): ' + l); return false; } return true; });
  if (!args.langs.length) { console.error('Aucune langue valide. Default: fr'); args.langs = ['fr']; }
  if (!args.stage && !args.all && !args.current && !args.nextMissing) args.all = true; // défaut: toutes les étapes
  return args;
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    console.log('Usage: node ' + path.basename(__filename) + ' [--lang fr,es,...] [--stage N | --current | --all] [--force]');
    console.log('Langues supportées: ' + Object.keys(SUPPORTED_LANGS).join(', '));
    process.exit(0);
  }

  console.log('=== Traduction Cyclisme TdF 2026 ===');
  console.log('Modèle Gemini : ' + MODEL_NAME);
  console.log('Langues       : ' + args.langs.join(', '));
  console.log('Force         : ' + (args.force ? 'oui (re-traduit tout)' : 'non (étapes/champs manquants seulement)'));
  console.log('');

  // Détermine les étapes à traiter
  const inputData = loadInput();
  const existingI18n = loadExistingI18n() || { stages: {} };
  if (!existingI18n.stages) existingI18n.stages = {};
  let stageNums;
  if (args.stage) stageNums = [args.stage];
  else if (args.current) {
    const n = determineCurrentStage();
    if (n === null) { console.log('[INFO] Pas d\'étape aujourd\'hui (jour de repos) — rien à faire.'); return; }
    stageNums = [n];
    console.log('[INFO] Étape du jour : ' + n);
  } else if (args.nextMissing) {
    // Mode cron : traduit UNE seule étape manquante (évite les 429 du quota free)
    const n = findFirstMissingStage(inputData, existingI18n, args.langs);
    if (n === null) { console.log('[INFO] Toutes les étapes sont déjà traduites pour les langues: ' + args.langs.join(',')); return; }
    stageNums = [n];
    console.log('[INFO] Mode next-missing : étape sélectionnée = ' + n);
  } else {
    stageNums = Object.keys(inputData.stages || {}).map(Number).sort((a, b) => a - b);
  }
  console.log('Étapes à traiter : ' + stageNums.join(', '));
  console.log('');

  // (existingI18n déjà chargé plus haut pour le mode --next-missing)

  // Init / sync les blocs stages du i18n avec la source (ajoute les étapes manquantes)
  for (const n of Object.keys(inputData.stages || {})) {
    if (!existingI18n.stages[n]) {
      existingI18n.stages[n] = JSON.parse(JSON.stringify(inputData.stages[n]));
      existingI18n.stages[n].i18n = existingI18n.stages[n].i18n || {};
    }
  }

  // Boucle principale
  let totalOk = 0;
  let totalFail = 0;
  for (const n of stageNums) {
    const stageData = inputData.stages[String(n)];
    if (!stageData) { console.log('[SKIP] Étape ' + n + ' absente de la source'); continue; }
    if (stageData.status && stageData.status !== 'ok') { console.log('[SKIP] Étape ' + n + ' status=' + stageData.status); continue; }
    const title = (stageData.title || '—').slice(0, 60);
    console.log('━━━ Stage ' + n + ': ' + title + ' ━━━');
    // Assure le bloc stage dans le i18n
    if (!existingI18n.stages[String(n)]) {
      existingI18n.stages[String(n)] = JSON.parse(JSON.stringify(stageData));
      existingI18n.stages[String(n)].i18n = {};
    }
    const i18nStage = existingI18n.stages[String(n)];
    i18nStage.i18n = i18nStage.i18n || {};

    for (const lang of args.langs) {
      console.log('  → ' + lang + ' (' + SUPPORTED_LANGS[lang] + '):');
      const translated = await translateStage(stageData, lang, args.force);
      if (translated && Object.keys(translated).length) {
        i18nStage.i18n[lang] = Object.assign(i18nStage.i18n[lang] || {}, translated);
        totalOk += Object.keys(translated).length;
      }
      // Sauvegarde incrémentale après chaque langue (pour ne pas perdre en cas de crash)
      saveI18n(inputData, existingI18n);
    }
  }

  console.log('');
  console.log('=== RÉSUMÉ ===');
  console.log('Champs traduits : ' + totalOk);
  console.log('Échecs          : ' + totalFail);
  console.log('Fichier         : ' + OUTPUT_FILE);
  console.log('i18n_last_update: ' + existingI18n.i18n_last_update);
}

main().catch((e) => { console.error('Erreur fatale:', e); process.exit(1); });
