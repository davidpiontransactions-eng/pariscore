#!/usr/bin/env node
'use strict';
/**
 * scrape-handball-player-photos.mjs
 * --------------------------------
 * Photos des JOUEURS handball (HBL + StarLigue) → data/handball-player-photos.json,
 * pour les avatars de l'onglet « Stats & Joueurs » du popup (ScorerRow) et de
 * l'onglet « Bets » (PlayerColumn).
 *
 * Source : API Wikipedia (gratuite, sans clé, images CC-BY-SA) — même
 * technique que scripts/scrape-player-photos.mjs (snooker/tennis) :
 *   en.wikipedia → de.wikipedia → fr.wikipedia, generator=search biaisé
 *   « <nom> handball », prop=pageimages (pithumbsize=200).
 * Pas de photos = null → l'UI affiche les initiales (PlayerAvatar fallback),
 * jamais d'URL cassée.
 *
 * Périmètre par défaut : par équipe, top 6 buteurs de champ + 1 gardien
 * (ce que les popups affichent réellement) ≈ 220 noms → ~1-2 min.
 *   --all    : tous les joueurs des snapshots (1 301 noms, ~5 min)
 *   --force  : réinterroger même les noms déjà résolus (sinon incrémental)
 *   --delay=N ms entre requêtes (défaut 150)
 *   --dry-run: liste les cibles sans appeler Wikipedia
 *
 * Sortie : { scrapedAt, source, photos: { <nomNormalisé>: {url,title,source} }, misses: [...] }
 * Cron   : pm2 `pariscore-cron-handball-photos` (lundi 04:45 UTC).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'data');
const OUTPUT = path.join(DATA_DIR, 'handball-player-photos.json');

const argv = new Map(
  process.argv.slice(2).map((a) => {
    const [k, v = 'true'] = a.replace(/^--/, '').split('=');
    return [k, v];
  })
);
const ALL = argv.has('all');
const FORCE = argv.has('force');
const DRY = argv.has('dry-run');
const DELAY = Math.max(50, parseInt(argv.get('delay') ?? '150', 10) || 150);

const TOP_FIELD = 6; // joueurs de champ suivis par équipe
const TOP_GK = 1; // gardien affiché par équipe
const WIKIS = ['en', 'de', 'fr'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Clé de joueur (miroir teamKey de handball-history-stats). */
function key(name) {
  return String(name)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function readJson(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

/** Cibles : top N buteurs/champ + gardiens par équipe, sur les 2 snapshots. */
function targets() {
  const out = new Map(); // key → { name }
  for (const file of ['hbl_players.json', 'lnh_players.json']) {
    const d = readJson(path.join(DATA_DIR, file), null);
    if (!d || !Array.isArray(d.players)) continue;
    const byTeam = new Map();
    for (const p of d.players) {
      if (!p?.name || !p?.team) continue;
      const isGk = String(p.position || '').toUpperCase() === 'GK';
      const bucket = isGk ? 'gk' : 'field';
      const k = `${p.team}|${bucket}`;
      if (!byTeam.has(k)) byTeam.set(k, []);
      byTeam.get(k).push(p);
    }
    for (const [k, list] of byTeam) {
      list.sort((a, b) => (b.goals ?? 0) - (a.goals ?? 0));
      const limit = k.endsWith('|gk') ? TOP_GK : TOP_FIELD;
      for (const p of list.slice(0, limit)) {
        const nk = key(p.name);
        if (nk && !out.has(nk)) out.set(nk, { name: p.name });
      }
    }
    if (ALL) {
      for (const p of d.players) {
        if (!p?.name) continue;
        const nk = key(p.name);
        if (nk && !out.has(nk)) out.set(nk, { name: p.name });
      }
    }
  }
  return out;
}

/** Normalisation souple : umlauts allemands → digrammes + diacritiques retirés
 *  (« Jäger » → « jaeger », « Þorgeir » → « thorgeir ») pour comparer noms et
 *  titres quel que soit l'ordre (LNH = « NOM Prénom », HBL = « Prénom NOM »). */
function normLoose(s) {
  let t = String(s).toLowerCase();
  t = t
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/ø/g, 'o')
    .replace(/å/g, 'a')
    .replace(/æ/g, 'ae')
    .replace(/þ/g, 'th')
    .replace(/ð/g, 'd');
  return t
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

/** Marqueurs de pages NON-personnes (clubs, compétitions, œuvres…). */
const NON_PERSON =
  /club|team|season|league|championship|stadium|nationalteam|andthe|band\b|album|football|soccer|athletics|synchronsprecher|nobel/;

/**
 * Validation titre → joueur, ordre-indépendant et robuste aux faux positifs
 * relevés en prod (test sur 447 noms) :
 *   1. les DEUX mots (prénom + nom) du nom du joueur doivent figurer dans le
 *      titre — sinon « Oskar Emanuel » → « Emanuel Nobel » ou
 *      « MARAS Mateo » → « Mateo Pumacahua » passent ;
 *   2. un titre entre parenthèses doit mentionner le handball
 *      (« Mike Jensen (Handballspieler) » ✓ / « Simon Jäger (Synchronsprecher) » ✗) ;
 *   3. les marqueurs non-personnes rejettent
 *      (« St. Paul and The Broken Bones » ✗ pour « Paul Bones »).
 */
function titleMatches(title, name) {
  const words = String(name).trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return false;
  const nt = normLoose(title);
  if (!nt) return false;
  const first = normLoose(words[0]);
  const last = normLoose(words[words.length - 1]);
  if (!first || !last) return false;
  if (!nt.includes(first) || !nt.includes(last)) return false;
  const paren = String(title).match(/\(([^)]+)\)/);
  if (paren && !normLoose(paren[1]).includes('handball')) return false;
  if (NON_PERSON.test(nt)) return false;
  return true;
}

/** Recherche Wikipedia d'un joueur → {url,title,source} | null.
 *  Passe 1 : « <nom> handball » (précis) ; passe 2 : nom seul + validation
 *  du titre (rattrape les pages mal classées par le biais). */
async function wikiPhoto(name) {
  for (const search of [`${name} handball`, String(name)]) {
    for (const lang of WIKIS) {
      const qs = new URLSearchParams({
        action: 'query',
        format: 'json',
        origin: '*',
        generator: 'search',
        gsrnamespace: '0',
        gsrlimit: '5',
        gsrsearch: search,
        prop: 'pageimages',
        piprop: 'thumbnail|name',
        pithumbsize: '200',
      });
      const url = `https://${lang}.wikipedia.org/w/api.php?${qs}`;
      try {
        const res = await fetch(url, {
          headers: { 'User-Agent': 'pariscore-handball-photos/1.0 (contact: pariscore)' },
          signal: AbortSignal.timeout(15000),
        });
        if (!res.ok) {
          await sleep(DELAY);
          continue;
        }
        const json = await res.json();
        const pages = json?.query?.pages ? Object.values(json.query.pages) : [];
        const ranked = pages
          .filter((p) => p?.thumbnail?.source)
          .sort((a, b) => (a.index ?? 99) - (b.index ?? 99));
        // Validation TOUJOURS : la recherche peut renvoyer une page d'équipe
        // ou d'un homonyme (bien que le biais « handball » réduise le risque).
        const hit = ranked.find((p) => titleMatches(p.title, name));
        if (hit) {
          await sleep(DELAY);
          return { url: hit.thumbnail.source, title: hit.title, source: `${lang}.wikipedia` };
        }
      } catch {
        // timeout / réseau → wiki suivant
      }
      await sleep(DELAY);
    }
  }
  return null;
}

async function main() {
  const all = targets();
  const existing = readJson(OUTPUT, null);
  const photos = FORCE ? {} : { ...(existing?.photos ?? {}) };
  const misses = new Set(FORCE ? [] : existing?.misses ?? []);

  const todo = [...all.entries()].filter(([k]) => !photos[k] && !misses.has(k));
  console.log(
    `[photos] cibles=${all.size} déjà résolus=${Object.keys(photos).length} ` +
      `à chercher=${todo.length}${DRY ? ' (dry-run)' : ''} sortie=${OUTPUT}`
  );
  if (DRY) {
    console.log(`[photos] ex : ${[...all.values()].slice(0, 5).map((t) => t.name).join(' | ')}`);
    return;
  }

  let found = 0;
  let i = 0;
  for (const [k, t] of todo) {
    i++;
    const hit = await wikiPhoto(t.name);
    if (hit) {
      photos[k] = hit;
      found++;
    } else {
      misses.add(k);
    }
    if (i % 25 === 0 || i === todo.length) {
      console.log(`[photos] ${i}/${todo.length} · trouvées=${found} · cumul=${Object.keys(photos).length}`);
    }
  }

  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(
    OUTPUT,
    JSON.stringify({
      scrapedAt: new Date().toISOString(),
      source: 'wikipedia (pageimages, CC-BY-SA)',
      photos,
      misses: [...misses],
    }),
    'utf8'
  );
  const cov = all.size ? Math.round((Object.keys(photos).length / all.size) * 100) : 0;
  console.log(
    `[photos] ✅ couverture ${cov}% (${Object.keys(photos).length}/${all.size}) · ` +
      `sans photo=${misses.size} · écrit ${OUTPUT}`
  );
}

main().catch((err) => {
  console.error('[photos] ERREUR', err);
  process.exitCode = 1;
});
