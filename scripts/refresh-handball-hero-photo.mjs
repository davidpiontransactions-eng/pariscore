#!/usr/bin/env node
'use strict';
/**
 * refresh-handball-hero-photo.mjs
 * -------------------------------
 * Renouvelle la PHOTO DE L'ENCART HERO (onglet Handball, mobile + desktop)
 * avec le MEILLEUR BUTEUR de la Superligue française (StarLigue/LNH) —
 * une fois par semaine (pm2 `pariscore-cron-handball-hero-photo`).
 *
 * Pipeline (bead ParisScorebis-8sja) :
 *   1. Lit data/lnh_players.json (snapshot LNH, cron quotidien 21:30)
 *      → meilleur buteur de champ par buts (cumul de la saison = forme).
 *   2. Cherche une photo EN ACTION libre sur Wikimedia Commons
 *      (licences autorisées : CC0 / CC-BY / CC-BY-SA / PD / PDM).
 *   3. Télécharge en 1600px, redimensionne (sharp, JPEG q≈72, cible ≤ 300 Ko)
 *      → public/images/handball/hero-top-scorer.jpg
 *   4. Met à jour public/images/handball/manifest.json (licence + attribution).
 *
 * REPLI GARANTI : aucun joueur identifié / aucune photo libre / download KO →
 * l'image actuelle est CONSERVÉE (aucune écriture), trace en log.
 *
 * Usage :
 *   node scripts/refresh-handball-hero-photo.mjs            # run complet
 *   node scripts/refresh-handball-hero-photo.mjs --dry-run  # sans écriture
 *   node scripts/refresh-handball-hero-photo.mjs --player="NOM Prenom"
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_DIR = path.dirname(SCRIPT_DIR);
const PUBLIC_DIR = path.join(REPO_DIR, 'public', 'images', 'handball');
const OUT_FILE = path.join(PUBLIC_DIR, 'hero-top-scorer.jpg');
const MANIFEST = path.join(PUBLIC_DIR, 'manifest.json');
const PLAYERS = path.join(REPO_DIR, 'data', 'lnh_players.json');
const PHOTOS = path.join(REPO_DIR, 'data', 'handball-player-photos.json');

const UA = 'pariscore-hero-photo/1.0 (+https://pariscore.fr; contact via site)';
const COMMONS = 'https://commons.wikimedia.org/w/api.php';
const ALLOWED = ['cc0', 'cc by', 'cc-by', 'cc by-sa', 'cc-by-sa', 'pd', 'public domain', 'pdm'];
const TARGET_W = 1600;
const MAX_BYTES = 300 * 1024;

const ARGS = process.argv.slice(2);
const DRY = ARGS.includes('--dry-run');
const argValue = (n) => {
  for (let i = 0; i < ARGS.length; i++) {
    if (ARGS[i] === n && i + 1 < ARGS.length) return ARGS[i + 1];
    if (ARGS[i].startsWith(n + '=')) return ARGS[i].slice(n.length + 1);
  }
  return undefined;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ─── 1. Meilleur buteur StarLigue ──────────────────────────────────────────
function topScorer() {
  if (!existsSync(PLAYERS)) return null;
  const snap = JSON.parse(readFileSync(PLAYERS, 'utf8'));
  const field = (snap.players || []).filter(
    (p) => p && p.name && p.competition === 'starligue' && (p.position ?? 'Field') !== 'GK',
  );
  if (!field.length) return null;
  const best = field.sort((a, b) => (Number(b.goals) || 0) - (Number(a.goals) || 0))[0];
  return {
    name: best.name,
    team: best.team,
    goals: Number(best.goals) || 0,
    games: Number(best.games) || 0,
    snapshot: snap.scraped_at ?? null,
    season: snap.season ?? null,
  };
}

/** « ZAMMIT Elio » → variantes de requête « Elio Zammit », « Zammit Elio », … */
function nameQueries(name) {
  const parts = String(name).trim().split(/\s+/);
  if (parts.length < 2) return [name];
  const given = parts[parts.length - 1];
  const family = parts.slice(0, -1).join(' ');
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  const out = [
    `${cap(given)} ${cap(family)}`,
    `${cap(family)} ${cap(given)}`,
    `${given} ${family}`,
  ];
  return [...new Set(out)];
}

/** Clé de joueur normalisée (miroir photoKey de handball-photos.ts). */
const photoKey = (n) =>
  String(n).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * 2a. Photo déjà curatée par le cron Wikipedia (data/handball-player-photos.json).
 *     L'URL est un thumb 250px → on demande 800px (même chemin, préfixe de largeur).
 */
function localPlayerPhoto(name) {
  if (!existsSync(PHOTOS)) return null;
  try {
    const j = JSON.parse(readFileSync(PHOTOS, 'utf8'));
    const hit = j?.photos?.[photoKey(name)];
    if (!hit?.url) return null;
    return {
      url: hit.url.replace(/\/\d+px-/, '/800px-'),
      licence: 'CC BY-SA (Wikipedia pageimages)',
      artist: hit.title || name,
      page: hit.source || null,
      label: `${name} — joueur`,
      via: 'snapshot Wikipedia (cron handball-photos)',
    };
  } catch {
    return null;
  }
}

// ─── 2. Recherche Commons (photo libre) ────────────────────────────────────
async function searchCommons(query) {
  const url =
    `${COMMONS}?action=query&generator=search&gsrsearch=${encodeURIComponent(query)}` +
    `&gsrnamespace=6&gsrlimit=8&prop=imageinfo&iiprop=url%7Cextmetadata%7Csize%7Cmime` +
    `&iiurlwidth=${TARGET_W}&format=json&origin=*`;
  const r = await fetch(url, { headers: { 'user-agent': UA } });
  if (!r.ok) throw new Error(`Commons HTTP ${r.status}`);
  const j = await r.json();
  const pages = Object.values(j?.query?.pages || {});
  return pages
    .map((p) => {
      const ii = (p.imageinfo || [])[0];
      if (!ii) return null;
      const em = ii.extmetadata || {};
      return {
        title: p.title,
        thumb: ii.thumburl || ii.url,
        page: ii.descriptionurl || null,
        width: ii.thumbwidth || ii.width || 0,
        mime: ii.mime || '',
        licence: (em.LicenseShortName?.value || em.License?.value || '').replace(/<[^>]+>/g, ''),
        artist: (em.Artist?.value || '').replace(/<[^>]+>/g, '').trim(),
        credit: (em.Credit?.value || '').replace(/<[^>]+>/g, '').trim(),
      };
    })
    .filter(Boolean);
}

function isFree(item) {
  if (!item.licence) return false;
  const l = item.licence.toLowerCase();
  if (!ALLOWED.some((a) => l.includes(a))) return false;
  if (!/image\/(jpeg|png|webp)/.test(item.mime)) return false;
  if (item.width < 500) return false;
  // Exclure logos / drapeaux / icônes
  if (/(logo|icon|flag|banner|wappen|crest|scarf)/i.test(item.title)) return false;
  return true;
}

/** Photo préférée : action de jeu > portrait ; évite les clichés de cérémonie. */
function rank(items) {
  return items
    .slice()
    .sort((a, b) => score(b) - score(a));
  function score(i) {
    let s = 0;
    if (/(action|match|jeu|game|tir|shot|contre|jump|saut|vs)/i.test(i.title)) s += 3;
    if (/(portrait|headshot|pose)/i.test(i.title)) s -= 1;
    if (i.width >= 1000) s += 1;
    return s;
  }
}

// ─── 3. Téléchargement + encodage ──────────────────────────────────────────
async function download(url) {
  const r = await fetch(url, { headers: { 'user-agent': UA } });
  if (!r.ok) throw new Error(`download HTTP ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}

/** Encode en JPEG calibré : sharp si dispo, sinon réécriture brute (best effort). */
async function encode(buf, outPath) {
  const sharp = (await import('sharp')).default;
  let quality = 75;
  let out = await sharp(buf)
    .resize({ width: TARGET_W, withoutEnlargement: true })
    .jpeg({ quality, mozjpeg: true })
    .toBuffer();
  while (out.length > MAX_BYTES && quality > 55) {
    quality -= 8;
    out = await sharp(buf).resize({ width: TARGET_W, withoutEnlargement: true }).jpeg({ quality, mozjpeg: true }).toBuffer();
  }
  writeFileSync(outPath, out);
  return out.length;
}

// ─── 4. Manifest ───────────────────────────────────────────────────────────
function updateManifest(entry) {
  let m = { generated_at: null, total_bytes: 0, assets: [] };
  if (existsSync(MANIFEST)) {
    try {
      m = JSON.parse(readFileSync(MANIFEST, 'utf8'));
      if (!Array.isArray(m.assets)) m.assets = [];
    } catch {
      /* manifest illisible → on repart d'une base propre */
    }
  }
  const rel = 'hero-top-scorer.jpg';
  const idx = m.assets.findIndex((a) => a && a.file === rel);
  const rec = { file: rel, ...entry };
  if (idx >= 0) m.assets[idx] = { ...m.assets[idx], ...rec };
  else m.assets.unshift(rec);
  writeFileSync(MANIFEST, JSON.stringify(m, null, 2), 'utf-8');
}

// ─── Main ──────────────────────────────────────────────────────────────────
async function main() {
  const forced = argValue('--player');
  let scorer = topScorer();
  if (forced) scorer = { name: forced, team: '—', goals: null, games: null, snapshot: null, season: null };
  if (!scorer) {
    console.log('[hero-photo] ⚠️ data/lnh_players.json absent ou vide → image conservée');
    return;
  }
  console.log(
    `[hero-photo] meilleur buteur StarLigue : ${scorer.name} (${scorer.team}) — ${scorer.goals} buts / ${scorer.games} matchs`,
  );

  const queries = [];
  for (const q of nameQueries(scorer.name)) {
    queries.push(`${q} handball`, q);
  }

  // (a) Photo déjà curatée du joueur (snapshot Wikipedia, CC-BY-SA)
  let pick = localPlayerPhoto(scorer.name);
  if (pick) {
    console.log(`[hero-photo] photo snapshot joueur : ${pick.via}`);
  }

  // (b) Commons — le joueur lui-même (licences libres uniquement)
  if (!pick) {
    for (const q of queries) {
      if (pick) break;
      try {
        const items = await searchCommons(q);
        const free = rank(items.filter(isFree));
        if (free.length) {
          pick = { ...free[0], label: `${scorer.name} (${scorer.team}) — meilleur buteur StarLigue`, via: 'Wikimedia Commons' };
          console.log(`[hero-photo] photo joueur (q="${q}") : ${pick.title} — ${pick.licence}`);
        }
        await sleep(900);
      } catch (e) {
        console.log(`[hero-photo] recherche KO (q="${q}") : ${e.message}`);
      }
    }
  }

  // (c) REPLI CLUB : photo libre du CLUB du buteur (Commons) — « Elio Zammit »
  //     n'a souvent aucune image libre ; on prend une action d'ÉQUIPE (jamais le
  //     portrait d'un AUTRE joueur, qui serait trompeur).
  if (!pick && scorer.team && scorer.team !== '—') {
    const isTeamPhoto = (i) =>
      /(team|squad|match|vs\.?|contre|handball\s*\d)/i.test(i.title) &&
      !/(player of|portrait|\bby\b)/i.test(i.title);
    const clubQueries = [`${scorer.team} handball`, `${scorer.team} handball match`];
    for (const q of clubQueries) {
      if (pick) break;
      try {
        const items = await searchCommons(q);
        const free = rank(items.filter(isFree).filter(isTeamPhoto));
        if (free.length) {
          pick = { ...free[0], label: `${scorer.team} — club de ${scorer.name} (meilleur buteur StarLigue)`, via: 'Wikimedia Commons (club)' };
          console.log(`[hero-photo] repli CLUB (q="${q}") : ${pick.title} — ${pick.licence}`);
        }
        await sleep(900);
      } catch (e) {
        console.log(`[hero-photo] recherche club KO (q="${q}") : ${e.message}`);
      }
    }
  }

  if (!pick) {
    console.log(
      `[hero-photo] ⚠️ aucune photo LIBRE pour « ${scorer.name} » (${scorer.team}) → image actuelle conservée (repli)`,
    );
    return;
  }

  if (DRY) {
    console.log(`[hero-photo] dry-run : ${pick.title} → ${OUT_FILE} NON écrit`);
    return;
  }

  try {
    const buf = await download(pick.thumb);
    mkdirSync(PUBLIC_DIR, { recursive: true });
    const bytes = await encode(buf, OUT_FILE);
    console.log(`[hero-photo] ✅ ${OUT_FILE} (${bytes} o)`);
    updateManifest({
      label: pick.label || `${scorer.name} (${scorer.team}) — meilleur buteur StarLigue`,
      url_source: pick.page || pick.thumb,
      licence: pick.licence,
      attribution_requise: !/^cc0|public domain|pdm/i.test(pick.licence),
      attribution_texte: pick.artist ? `© ${pick.artist}, ${pick.licence}, via Wikimedia Commons` : `© Wikimedia Commons, ${pick.licence}`,
      width: TARGET_W,
      size: bytes,
      player: scorer.name,
      team: scorer.team,
      goals: scorer.goals,
      season: scorer.season,
      updated_at: new Date().toISOString(),
      ok: true,
    });
    console.log(
      `[hero-photo] manifest MAJ — ${scorer.name} · ${pick.licence}${pick.artist ? ' · ' + pick.artist : ''}`,
    );
  } catch (e) {
    console.log(`[hero-photo] ⚠️ téléchargement/encodage KO : ${e.message} → image conservée`);
  }
}

main().catch((e) => {
  console.error('[hero-photo] FATAL:', e.message);
  console.error('[hero-photo] rien écrit — image existante conservée');
  process.exit(1);
});
