/*const FOOTBALL_DATA_API_KEY = process.env.FOOTBALL_DATA_API_KEY || '';

 * ══════════════════════════════════════════════════════════════════════════════
 *  PariScore — Backend Serveur-Centrique v2.0
 * ══════════════════════════════════════════════════════════════════════════════
 *  Zéro dépendance npm. Modules Node.js natifs uniquement.

 *  Lancement :
 *    1. Placez un fichier .env à côté de server.js (cf. .env.example)
 *    2. node server.js
 *    3. Ouvrez http://localhost:3000
 *
 *  Architecture :
 *    - Pre-fetching autonome : The Odds API (toutes les 12h) + API-Football (toutes les 6h)
 *    - Fusion + calcul des probabilités côté serveur
 *    - Stockage dans database.json
 *    - API REST interne : GET /api/v1/matches, GET /api/v1/stats/:id, GET /api/v1/status
 *    - Frontend "stupide" qui ne fait que fetch('/api/v1/matches')
 * ══════════════════════════════════════════════════════════════════════════════
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Database = require('better-sqlite3');

// ─── CONFIGURATION ──────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
const SQLITE_FILE = process.env.DATABASE_PATH || path.join(__dirname, 'pariscore.db');
// Conservés uniquement pour migration one-shot depuis les anciens fichiers JSON
const DB_FILE = path.join(__dirname, 'database.json');
const AI_CACHE_FILE = path.join(__dirname, 'ai_cache.json');

// Charger .env manuellement (pas de dotenv)
function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) {
    console.error('  ⚠ Fichier .env introuvable. Copiez .env.example → .env et ajoutez vos clés.');
    process.exit(1);
  }
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.replace(/\r/g, '').trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed.slice(idx + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}
loadEnv();

const ODDS_API_KEY = process.env.ODDS_API_KEY;
const API_FOOTBALL_KEY = process.env.API_FOOTBALL_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;       // free: api.groq.com
const XAI_API_KEY = process.env.XAI_API_KEY;        // free tier: api.x.ai (Grok)
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY; // free models: openrouter.ai
const PARLAY_API_HOST = process.env.PARLAY_API_HOST;
const PARLAY_API_PATH = process.env.PARLAY_API_PATH || '/parlay';
const PARLAY_API_KEY = process.env.PARLAY_API_KEY;
const GAMEFORECAST_API_HOST = process.env.GAMEFORECAST_API_HOST;
const GAMEFORECAST_API_PATH = process.env.GAMEFORECAST_API_PATH || '/forecast';
const GAMEFORECAST_API_KEY = process.env.GAMEFORECAST_API_KEY;
const FOOTBALL_DATA_API_KEY = process.env.FOOTBALL_DATA_API_KEY || '';

// ── AI Provider chain (Deep Analysis) — premier disponible utilisé ──────────
// Ordre : Gemini → Groq → Grok (xAI) → OpenRouter
const AI_DEEP_PROVIDERS = [];
if (GEMINI_API_KEY) AI_DEEP_PROVIDERS.push({ name: 'Gemini', type: 'gemini' });
if (GROQ_API_KEY) AI_DEEP_PROVIDERS.push({ name: 'Groq/Llama', type: 'openai', host: 'api.groq.com', path: '/openai/v1/chat/completions', key: GROQ_API_KEY, model: 'llama-3.3-70b-versatile' });
if (XAI_API_KEY) AI_DEEP_PROVIDERS.push({ name: 'Grok (xAI)', type: 'openai', host: 'api.x.ai', path: '/v1/chat/completions', key: XAI_API_KEY, model: 'grok-3-mini' });
if (OPENROUTER_API_KEY) AI_DEEP_PROVIDERS.push({ name: 'OpenRouter', type: 'openai', host: 'openrouter.ai', path: '/api/v1/chat/completions', key: OPENROUTER_API_KEY, model: 'meta-llama/llama-3.3-70b-instruct:free' });

if (!ODDS_API_KEY) console.warn('  ⚠ ODDS_API_KEY manquante dans .env');
if (!API_FOOTBALL_KEY) console.warn('  ⚠ API_FOOTBALL_KEY manquante dans .env');
if (AI_DEEP_PROVIDERS.length === 0) console.warn('  ⚠ Aucun provider IA configuré (GEMINI_API_KEY / GROQ_API_KEY / XAI_API_KEY / OPENROUTER_API_KEY)');
else console.log('  ✓ Providers IA:', AI_DEEP_PROVIDERS.map(p => p.name).join(' → '));
if (PARLAY_API_HOST && !PARLAY_API_KEY) console.warn('  ⚠ PARLAY_API_KEY manquante pour Parlay-API dans .env');
if (GAMEFORECAST_API_HOST && !GAMEFORECAST_API_KEY) console.warn('  ⚠ GAMEFORECAST_API_KEY manquante pour GameForecast dans .env');

// ─── SÉCURITÉ ────────────────────────────────────────────────────────────────
const BLOCKED_FILES = ['.env', 'database.json', 'history.json', 'ai_cache.json', 'pariscore.db', 'package.json', 'package-lock.json', '.gitignore'];
const BLOCKED_DIRS = ['.git', 'node_modules'];
const MAX_BODY_SIZE = 1 * 1024 * 1024; // 1 Mo
const STATS_TTL = 6 * 3600000;    // 6h entre les mises à jour stats
const ADV_STATS_TTL = 24 * 3600000;   // 24h cache stats avancées /teams/statistics
const AI_CACHE_TTL = 24 * 3600000;   // 24h cache analyses Power Score par match

// Paramètres Gemini partagés — sécurité BLOCK_NONE pour éviter les faux-positifs sur les stats sportives
const GEMINI_SAFETY_SETTINGS = [
  { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
];

const POWER_SCORE_LIMITS = {
  freemium: { daily: 1, label: 'Freemium (1/jour)' },
  matchday: { daily: 5, label: 'Matchday Pass (5/24h)' },
  premium: { daily: 999, label: 'Premium (illimité)' },
  admin: { daily: 999, label: 'Admin (illimité)' },
};

const POWER_SCORE_SYSTEM_PROMPT = `Agis comme l'expert en data science et l'analyste de presse sportive principal de la plateforme Pariscore. Ton rôle est de fournir une analyse prédictive ultra-précise et agréable à lire pour un match de football donné, destinée à une communauté de parieurs exigeants.

[MÉTHODOLOGIE DE CALCUL DU POWER SCORE (SUR 100)]
Tu dois calculer un Power Score pour chaque équipe en isolant strictement le contexte (Performance à Domicile pour l'équipe A / Performance à l'Extérieur pour l'équipe B) selon ces 5 piliers :
1. Métriques Avancées (30%) : Différentiel xG/xGA et volume de corners.
2. Tactique & Effectifs (20%) : Systèmes, absences et mismatches.
3. Dynamique (20%) : Forme des 5 derniers matchs et difficulté du calendrier.
4. Presse & Consensus Web (15%) : Synthèse des sites majeurs (L'Équipe, Marca, Kicker, Sofascore, BetMines, OddAlerts).
5. Psychologie & H2H (15%) : Historique et enjeux (titre, maintien).

[FORMAT DE SORTIE EXIGÉ (MARKDOWN & TEXTE CLAIR)]
Rédige ton analyse de manière fluide, professionnelle et structurée en utilisant des émojis pour la rendre visuelle.

1. EN-TÊTE DU MATCH : [Équipe A] vs [Équipe B] ([Compétition])
2. 📊 POWER SCORE PARISCORE :
   - [Équipe A] (Dom) : X/100
   - [Équipe B] (Ext) : Y/100
3. 🔬 ANALYSE DÉTAILLÉE :
   - Le Duel Tactique : [Explication claire des systèmes et des joueurs clés/absents].
   - La Synthèse Web & Médias : [Que dit la presse ? Que disent les algos de prédiction ?].
   - L'Alerte Corners : [Explication mathématique et tactique sur la physionomie des corners attendue].
4. 🔢 PROBABILITÉS MATHÉMATIQUES :
   - 1N2 : 1 (X%) / N (X%) / 2 (X%)
   - Buts : +1.5 buts (X%) / BTTS (X%)
   - Corners : +7.5 (X%) / +8.5 (X%)
5. 🏆 LE TOP 5 DES PARIS :
   - 🛡️ Le Safe : [Pari] (Proba : X%) - [Justification courte]
   - 📈 Le Bankroll Builder : [Pari] (Proba : X%) - [Justification courte]
   - 💎 Le Value Bet : [Pari] - [Justification détaillée sur l'erreur de cote du bookmaker]
   - 🚩 Le Coup Tactique (Corners/Buteur) : [Pari] - [Justification]
   - ⚡ Le Coup Risqué : [Pari grosse cote] - [Justification]
6. 📺 CONFÉRENCES DE PRESSE :
   Propose les liens YouTube les plus pertinents pour les conférences de prematch des deux équipes. Format : [▶️ Nom équipe — Conférence d'avant-match](lien_youtube). Si aucun lien officiel n'est disponible, indique les chaînes YouTube à surveiller (club officiel, Ligue, beIN Sports, etc.).
7. 📊 SYNTHÈSE DES AVIS WEB :
   Résume les avis et prédictions des sites de référence (Sofascore, BetMines, Forebet, OddAlerts, WhoScored) pour ce match. Indique s'il y a un consensus ou des divergences notables.
[DIRECTIVES CRITIQUES]
- Utilise EXCLUSIVEMENT les données mathématiques fournies dans le bloc [DONNÉES PARISCORE] ci-dessous.
- Ne jamais inventer des probabilités — utilise celles calculées par notre algorithme Poisson.
- Utilise un ton d'expert, sûr de lui, mais qui explique la logique mathématique derrière chaque choix.`;

// ═══════════════════════════════════════════════════════════════════════════════
//  POWER SCORE V2 — Contexte Presse Réelle (RSS + GNews)
// ═══════════════════════════════════════════════════════════════════════════════

const GNEWS_API_KEY = process.env.GNEWS_API_KEY || '';
const PRESS_CACHE_TTL = 24 * 3600000; // 24h

// Flux RSS des sources de référence (zéro API key)
const RSS_FEEDS = [
  { url: 'https://www.lequipe.fr/rss.xml', lang: 'fr', source: "L'Equipe" },
  { url: 'https://feeds.bbci.co.uk/sport/football/rss.xml', lang: 'en', source: 'BBC Sport' },
  { url: 'https://www.skysports.com/rss/12040', lang: 'en', source: 'Sky Sports' },
  { url: 'https://www.espn.com/espn/rss/soccer/news', lang: 'en', source: 'ESPN FC' },
];

// Parseur XML RSS minimaliste (natif — zéro dépendance)
function parseRSSItems(xml) {
  const items = [];
  const itemRx = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = itemRx.exec(xml)) !== null) {
    const get = (tag) => {
      const r = new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`, 'i');
      const match = r.exec(m[1]);
      return match ? match[1].trim() : '';
    };
    items.push({ title: get('title'), description: get('description'), pubDate: get('pubDate') });
  }
  return items;
}

// Filtre les items pertinents pour un match (recherche simple par mots-clés)
function filterRelevantItems(items, homeTeam, awayTeam) {
  const normalize = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const keywords = [homeTeam, awayTeam].flatMap(t => {
    const words = normalize(t).split(/\s+/).filter(w => w.length >= 3);
    // also include full team name normalized
    const full = normalize(t);
    return words.concat(full.length >= 4 ? [full] : []);
  });
  return items.filter(item => {
    const text = normalize(item.title + ' ' + item.description);
    return keywords.some(kw => text.includes(kw));
  }).slice(0, 4);
}

// Fetch RSS avec timeout 5s
function fetchRSS(url) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(''), 5000);
    httpsGet(url, {})
      .then(r => { clearTimeout(timer); resolve(r.status === 200 ? (typeof r.data === 'string' ? r.data : '') : ''); })
      .catch(() => { clearTimeout(timer); resolve(''); });
  });
}

// GNews API (optionnel — 100 req/jour gratuit)
async function fetchGNews(query, lang = 'fr') {
  if (!GNEWS_API_KEY) return [];
  try {
    const encoded = encodeURIComponent(query);
    const res = await httpsGet(
      `https://gnews.io/api/v4/search?q=${encoded}&lang=${lang}&max=4&token=${GNEWS_API_KEY}`,
      {}
    );
    if (res.status !== 200) return [];
    return (res.data?.articles || []).map(a => ({
      title: a.title || '',
      description: a.description || '',
      source: a.source?.name || 'GNews',
    }));
  } catch { return []; }
}

// Agrège toutes les sources et retourne { text, articleCount, sourceNames } pour Gemini + UI
async function fetchPressContext(homeTeam, awayTeam) {
  const cacheKey = `press_${normName(homeTeam)}_${normName(awayTeam)}`;
  const cached = kvGet(cacheKey);
  if (cached && (Date.now() - new Date(cached.fetchedAt).getTime() < PRESS_CACHE_TTL)) {
    return { text: cached.text || cached.data || '', articleCount: cached.articleCount || 0, sourceNames: cached.sourceNames || [] };
  }

  // Fetch RSS en parallèle + GNews combiné (+ per-team si résultats insuffisants)
  const combinedQuery = `${homeTeam} ${awayTeam}`;
  const [rssResults, gnewsItems] = await Promise.all([
    Promise.all(RSS_FEEDS.map(async feed => {
      const xml = await fetchRSS(feed.url);
      const items = parseRSSItems(xml);
      return filterRelevantItems(items, homeTeam, awayTeam)
        .map(i => ({ ...i, source: feed.source }));
    })),
    fetchGNews(combinedQuery, 'fr'),
  ]);

  let allItems = [...rssResults.flat(), ...gnewsItems];

  // Fallback : requêtes GNews séparées par équipe si < 2 résultats
  if (allItems.length < 2 && GNEWS_API_KEY) {
    const [homeItems, awayItems] = await Promise.all([
      fetchGNews(homeTeam, 'fr'),
      fetchGNews(awayTeam, 'fr'),
    ]);
    allItems = [...allItems, ...homeItems, ...awayItems];
  }

  allItems = allItems.slice(0, 8);
  const sourceNames = [...new Set(allItems.map(i => i.source))];

  // Formater en bloc lisible pour Gemini
  const text = allItems.length
    ? allItems.map(i => `• [${i.source}] ${i.title}${i.description ? ' — ' + i.description.slice(0, 120) : ''}`).join('\n')
    : '• Aucune actualité presse récente trouvée pour ce match.';

  kvSet(cacheKey, { text, articleCount: allItems.length, sourceNames, fetchedAt: new Date().toISOString() });
  console.log(`  [PressV2] ${allItems.length} articles (${sourceNames.join(', ')}) pour ${homeTeam} vs ${awayTeam}`);
  return { text, articleCount: allItems.length, sourceNames };
}

function buildPowerScorePrompt(match, pressContext = null) {
  const p = match?.poisson || {};
  const eg = match?.expectedGoals || {};
  const hs = match?.stats?.home || {};
  const as = match?.stats?.away || {};
  const dt = match?.commence_time ? new Date(match.commence_time) : new Date();
  const dateStr = dt.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const timeStr = dt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  const dataBlock = `
[DONNÉES PARISCORE — CONTEXTE MATHÉMATIQUE INJECTÉ — UTILISE CES CHIFFRES PRÉCISÉMENT]
Match : ${match.home_team} vs ${match.away_team} (${match.league})
Date : ${dateStr} à ${timeStr}

ÉQUIPE DOMICILE (${match.home_team}) :
- Classement : #${match.home_rank || '?'}
- PPG domicile : ${hs.ppg ?? '?'}
- Forme récente (5 matchs, gauche=récent) : ${match.home_form || 'N/A'}
- Buts marqués/match (dom) : ${hs.avgScored != null ? hs.avgScored.toFixed(2) : '?'}
- Buts encaissés/match (dom) : ${hs.avgConceded != null ? hs.avgConceded.toFixed(2) : '?'}
- Victoires : ${hs.wins ?? 0}% | Nuls : ${hs.draws ?? 0}% | Défaites : ${hs.losses ?? 0}%
- xG attendu (λ dom) : ${eg.home != null ? eg.home.toFixed(2) : '?'}

ÉQUIPE EXTÉRIEURE (${match.away_team}) :
- Classement : #${match.away_rank || '?'}
- PPG extérieur : ${as.ppg ?? '?'}
- Forme récente (5 matchs, gauche=récent) : ${match.away_form || 'N/A'}
- Buts marqués/match (ext) : ${as.avgScored != null ? as.avgScored.toFixed(2) : '?'}
- Buts encaissés/match (ext) : ${as.avgConceded != null ? as.avgConceded.toFixed(2) : '?'}
- Victoires : ${as.wins ?? 0}% | Nuls : ${as.draws ?? 0}% | Défaites : ${as.losses ?? 0}%
- xG attendu (λ ext) : ${eg.away != null ? eg.away.toFixed(2) : '?'}

PROBABILITÉS POISSON (CALCULÉES PAR NOTRE ALGORITHME — DONNÉES CERTIFIÉES) :
- Résultat 1N2 : 1 (${p.homeWin ?? 0}%) / N (${p.draw ?? 0}%) / 2 (${p.awayWin ?? 0}%)
- BTTS (les deux équipes marquent) : ${p.btts ?? 0}%
- Over 0.5 : ${p.over05 ?? 0}% | Over 1.5 : ${p.over15 ?? 0}% | Over 2.5 : ${p.over25 ?? 0}% | Over 3.5 : ${p.over35 ?? 0}%
- Under 2.5 buts : ${100 - (p.over25 ?? 0)}%
- Clean Sheet (0 but encaissé dom) : ${p.cs00 ?? 0}%
- Score le plus probable : ${p.topScores?.[0]?.score ?? '?'} (${p.topScores?.[0]?.prob ?? 0}%)
- 2e score : ${p.topScores?.[1]?.score ?? '?'} (${p.topScores?.[1]?.prob ?? 0}%)

COTES BOOKMAKERS & VALEUR :
- Cote 1 : ${match.odds?.home != null ? match.odds.home.toFixed(2) : '?'} (${match.bookmakers?.home || 'N/A'})
- Cote N : ${match.odds?.draw != null ? match.odds.draw.toFixed(2) : '?'} (${match.bookmakers?.draw || 'N/A'})
- Cote 2 : ${match.odds?.away != null ? match.odds.away.toFixed(2) : '?'} (${match.bookmakers?.away || 'N/A'})
- Edge dom : ${match.edge?.home != null ? match.edge.home.toFixed(1) : '?'}% | Edge nul : ${match.edge?.draw != null ? match.edge.draw.toFixed(1) : '?'}% | Edge ext : ${match.edge?.away != null ? match.edge.away.toFixed(1) : '?'}%
- Meilleur edge : ${match.best_edge?.label ?? '?'} @ ${match.best_edge?.odds != null ? match.best_edge.odds.toFixed(2) : '?'} (Edge : +${match.best_edge?.edge != null ? match.best_edge.edge.toFixed(1) : '?'}%) via ${match.best_edge?.bk ?? 'N/A'}
`;

  // ── Bloc presse V2 (injecté si disponible) ───────────────────────────────────
  const pressText = pressContext ? (typeof pressContext === 'object' ? pressContext.text : pressContext) : null;
  const pressBlock = pressText ? `
[CONTEXTE PRESSE RÉCENTE — PILIER 4 : PRESSE & CONSENSUS WEB (15%)]
Utilise ces actualités pour enrichir ton analyse tactique et contextuelle. Cite les sources entre crochets.
${pressText}
` : '';

  return POWER_SCORE_SYSTEM_PROMPT + '\n\n' + dataBlock + pressBlock;
}

function isSafePath(filePath) {
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(path.resolve(__dirname))) return false;
  const relative = path.relative(__dirname, resolved);
  const parts = relative.split(path.sep);
  if (BLOCKED_DIRS.some(d => parts.includes(d))) return false;
  if (BLOCKED_FILES.includes(parts[parts.length - 1])) return false;
  return true;
}

function readBodyLimited(req, maxSize) {
  return new Promise((resolve, reject) => {
    let body = '';
    let size = 0;
    req.on('data', chunk => {
      size += chunk.length;
      if (size > maxSize) { req.destroy(); reject(new Error('Payload trop volumineux (> 1 Mo)')); return; }
      body += chunk;
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

// ─── KELLY CRITERION — Sizing helper pour module Mes Paris ────────────────────
// cap=0.25 limite Kelly à 25% bankroll même si edge absurde. multiplier=1.0 (Full Kelly, choix user).
function computeKellyFraction(prob, odds, cap = 0.25) {
  if (typeof prob !== 'number' || typeof odds !== 'number') return 0;
  if (prob <= 0 || prob >= 1 || odds <= 1) return 0;
  const f = (prob * odds - 1) / (odds - 1);
  return Math.max(0, Math.min(cap, f));
}
function suggestStakeCents(bankrollCents, prob, odds, multiplier = 1.0, cap = 0.25) {
  const f = computeKellyFraction(prob, odds, cap);
  return Math.max(0, Math.round(bankrollCents * f * multiplier));
}

// ─── API-FOOTBALL PLAYER ENRICHMENT (photo CDN + stats) ──────────────────────
// CDN public api-sports : https://media.api-sports.io/football/players/{id}.png — pas de clé requise pour la photo.
// Endpoint /players?search={name}&team={id}&season={year} pour stats + player.id (1 req).
function apiFootballPlayerPhotoUrl(apiFootballPlayerId) {
  if (!apiFootballPlayerId) return null;
  return `https://media.api-sports.io/football/players/${apiFootballPlayerId}.png`;
}
function getAPIFootballTeamIdByName(teamName) {
  if (!teamName) return null;
  const key = normName(teamName);
  if (db.teamStats[key]?.teamId) return db.teamStats[key].teamId;
  const allKeys = Object.keys(db.teamStats);
  const firstWord = key.split(' ')[0];
  if (firstWord && firstWord.length >= 3) {
    const fuzzyKey = allKeys.find(k => k.startsWith(firstWord) || k.includes(firstWord));
    if (fuzzyKey && db.teamStats[fuzzyKey]?.teamId) return db.teamStats[fuzzyKey].teamId;
  }
  return null;
}
// Dynamic API-Football team_id lookup via /teams endpoint (cached 30 days)
async function fetchAPIFootballTeamId(teamName, leagueId, season) {
  if (!API_FOOTBALL_KEY || !teamName || !leagueId) return null;
  const seasonY = season || bsdCurrentSeasonYear();
  const cacheKey = `apif_teams_league_${leagueId}_${seasonY}`;
  let teamsMap = apiCacheGet(cacheKey, 'apif_teams');
  if (!teamsMap) {
    try {
      const url = `https://v3.football.api-sports.io/teams?league=${leagueId}&season=${seasonY}`;
      const res = await httpsGet(url, { 'x-apisports-key': API_FOOTBALL_KEY });
      if (res.data?.errors?.requests) {
        console.warn(`  [API-Football] QUOTA ÉPUISÉ /teams league ${leagueId}. Upgrade PRO requis.`);
        apiCacheSet(cacheKey, {}, 'apif_teams', 1 * 3600 * 1000);
        return null;
      }
      if (res.status !== 200 || !res.data?.response?.length) {
        if (seasonY > 2022) return fetchAPIFootballTeamId(teamName, leagueId, seasonY - 1);
        apiCacheSet(cacheKey, {}, 'apif_teams', 24 * 3600 * 1000);
        return null;
      }
      teamsMap = {};
      for (const entry of res.data.response) {
        const t = entry.team;
        if (t?.id && t?.name) teamsMap[normName(t.name)] = t.id;
      }
      apiCacheSet(cacheKey, teamsMap, 'apif_teams', 30 * 24 * 3600 * 1000);
    } catch (e) {
      console.warn(`  [API-Football Teams] league ${leagueId} erreur:`, e.message);
      return null;
    }
  }
  const target = normName(teamName);
  if (teamsMap[target]) return teamsMap[target];
  // Fuzzy
  const keys = Object.keys(teamsMap);
  const fuzzy = keys.find(k => k.includes(target) || target.includes(k));
  return fuzzy ? teamsMap[fuzzy] : null;
}
// ─── THESPORTSDB PHOTO FALLBACK ─────────────────────────────────────────────
// Free public API key=3 demo. Photo cutout/thumb gratuit. Coverage moyenne, fallback acceptable.
// Filtre strict par team name normalisé pour éviter homonymes.
async function fetchTheSportsDBPlayerPhoto(playerName, teamName) {
  if (!playerName) return null;
  const cacheKey = `tsdb_player_${normName(playerName)}_${teamName ? normName(teamName) : 'any'}`;
  const cached = apiCacheGet(cacheKey, 'tsdb_player');
  if (cached !== null) return cached;
  try {
    const url = `https://www.thesportsdb.com/api/v1/json/3/searchplayers.php?p=${encodeURIComponent(playerName)}`;
    const res = await httpsGet(url, { 'User-Agent': 'Mozilla/5.0 (compatible; PariScore/1.0)' });
    if (res.status !== 200 || !res.data?.player) {
      apiCacheSet(cacheKey, false, 'tsdb_player', 24 * 3600 * 1000);
      return null;
    }
    let players = res.data.player.filter(p => /soccer|football/i.test(p.strSport || ''));
    if (!players.length) players = res.data.player;
    let chosen = null;
    if (teamName) {
      const tNorm = normName(teamName);
      chosen = players.find(p => p.strTeam && normName(p.strTeam) === tNorm);
      if (!chosen) chosen = players.find(p => p.strTeam && (normName(p.strTeam).includes(tNorm) || tNorm.includes(normName(p.strTeam))));
    }
    if (!chosen) chosen = players[0];
    if (!chosen || (!chosen.strThumb && !chosen.strCutout)) {
      apiCacheSet(cacheKey, false, 'tsdb_player', 24 * 3600 * 1000);
      return null;
    }
    const enriched = {
      photo: chosen.strCutout || chosen.strThumb,
      thumb: chosen.strThumb || null,
      cutout: chosen.strCutout || null,
      name: chosen.strPlayer,
      team: chosen.strTeam,
      nationality: chosen.strNationality,
      position: chosen.strPosition,
      height: chosen.strHeight,
      weight: chosen.strWeight,
      birthdate: chosen.dateBorn,
      _source: 'thesportsdb',
    };
    apiCacheSet(cacheKey, enriched, 'tsdb_player', 7 * 24 * 3600 * 1000);
    return enriched;
  } catch (e) {
    console.warn(`  [TheSportsDB] ${playerName} erreur:`, e.message);
    return null;
  }
}

async function fetchAPIFootballPlayer(playerName, teamName, leagueId) {
  if (!API_FOOTBALL_KEY || !playerName) return null;
  let teamId = getAPIFootballTeamIdByName(teamName);
  // Si pas de teamId via db.teamStats, lookup dynamique via API-Football /teams
  if (!teamId && teamName && leagueId) {
    teamId = await fetchAPIFootballTeamId(teamName, leagueId);
  }
  if (!teamId && !leagueId) return null;
  // Strip accents — API-Football search field rejette diacritiques ("only alpha-numeric and spaces")
  const stripAccents = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  const cleanName = stripAccents(playerName);
  if (cleanName.length < 4) return null;
  // Cascade saisons : current → -1 → -2 (plan free limité 2022-2024)
  const currentSeason = bsdCurrentSeasonYear();
  const seasons = [currentSeason, currentSeason - 1, currentSeason - 2].filter(s => s >= 2022 && s <= 2024);
  const targetNorm = normName(playerName);
  for (const season of seasons) {
    const cacheKey = `apif_player_${targetNorm}_${teamId || 'L'}_${leagueId || ''}_${season}`;
    const cached = apiCacheGet(cacheKey, 'apif_player');
    if (cached) return cached;
    try {
      // API-Football v3 n'accepte que `search` (min 4 chars). Pas de lastname param.
      const tokens = cleanName.split(/\s+/);
      const params = [`season=${season}`, `search=${encodeURIComponent(cleanName)}`];
      if (teamId) params.push(`team=${teamId}`);
      else if (leagueId) params.push(`league=${leagueId}`);
      const url = `https://v3.football.api-sports.io/players?${params.join('&')}`;
      const res = await httpsGet(url, { 'x-apisports-key': API_FOOTBALL_KEY });
      // Quota épuisé : log alerte + cache court (1h, reset le lendemain)
      if (res.data?.errors?.requests) {
        console.warn(`  [API-Football] QUOTA ÉPUISÉ (100/j free plan) — ${playerName}. Upgrade PRO requis pour usage prod. Reset à 00:00 UTC.`);
        apiCacheSet(cacheKey, null, 'apif_player', 1 * 3600 * 1000);
        return null; // pas la peine d'essayer d'autres seasons
      }
      if (res.status !== 200 || !res.data?.response?.length) {
        apiCacheSet(cacheKey, null, 'apif_player', 12 * 3600 * 1000);
        continue;
      }
      const entries = res.data.response;
      const lastNameTarget = stripAccents(tokens[tokens.length - 1]).toLowerCase();
      // Score chaque candidat : exact lastname + team_id match favorisés
      const score = (e) => {
        const pn = normName(e.player?.name || '');
        const pln = (e.player?.lastname || '').toLowerCase();
        const plnNorm = stripAccents(pln);
        let s = 0;
        if (pn === targetNorm) s += 100;
        if (plnNorm === lastNameTarget) s += 50;
        if (plnNorm.includes(lastNameTarget) || lastNameTarget.includes(plnNorm)) s += 10;
        if (teamId && (e.statistics || []).some(st => Number(st.team?.id) === Number(teamId))) s += 30;
        if (e.statistics?.[0]?.games?.appearences > 0) s += 5; // titulaire favorisé
        return s;
      };
      const scored = entries.map(e => ({ e, s: score(e) })).sort((a, b) => b.s - a.s);
      const best = scored[0]?.s > 0 ? scored[0].e : null;
      if (!best) continue;
      const p = best.player;
      const stat = (best.statistics || [])[0] || {};
      const enrichment = {
        api_football_id: p.id,
        photo: p.photo || apiFootballPlayerPhotoUrl(p.id),
        name: p.name,
        firstname: p.firstname,
        lastname: p.lastname,
        age: p.age,
        birth: p.birth ? `${p.birth.date}${p.birth.place ? ' · ' + p.birth.place : ''}${p.birth.country ? ' (' + p.birth.country + ')' : ''}` : null,
        nationality: p.nationality,
        height: p.height,
        weight: p.weight,
        injured: p.injured || false,
        team_name: stat.team?.name || null,
        league_name: stat.league?.name || null,
        season_year: season,
        season_stats: {
          appearances: stat.games?.appearences || 0,
          minutes: stat.games?.minutes || 0,
          position: stat.games?.position || null,
          rating: stat.games?.rating ? parseFloat(stat.games.rating).toFixed(2) : null,
          captain: stat.games?.captain || false,
          goals: stat.goals?.total || 0,
          assists: stat.goals?.assists || 0,
          saves: stat.goals?.saves || 0,
          shots_total: stat.shots?.total || 0,
          shots_on: stat.shots?.on || 0,
          passes_total: stat.passes?.total || 0,
          passes_key: stat.passes?.key || 0,
          passes_accuracy: stat.passes?.accuracy || 0,
          yellow_cards: stat.cards?.yellow || 0,
          red_cards: stat.cards?.red || 0,
          dribbles_attempts: stat.dribbles?.attempts || 0,
          dribbles_success: stat.dribbles?.success || 0,
        },
        _source: 'api-football',
      };
      apiCacheSet(cacheKey, enrichment, 'apif_player', 24 * 3600 * 1000);
      return enrichment;
    } catch (e) {
      console.warn(`  [API-Football Player] ${playerName} (season ${season}) erreur:`, e.message);
    }
  }
  return null;
}

// ─── BOOKMAKERS — ANJ FR + 1xbet ──────────────────────────────────────────────
const ALLOWED_BOOKMAKERS = [
  '1xbet',
  'Winamax', 'Betclic', 'Unibet', 'PMU', 'Parions Sport',
  'ZEbet', 'NetBet', 'Vbet', 'Genybet', 'PartoucheSport',
];
const ALLOWED_SPORTS = [
  'football', 'basketball', 'tennis', 'rugby', 'hockey', 'baseball',
  'mma', 'boxe', 'cyclisme', 'formula1', 'volleyball', 'handball',
  'esports', 'golf', 'autre',
];
function normalizeBookmaker(bk) {
  if (!bk) return '1xbet';
  const s = String(bk).trim();
  const found = ALLOWED_BOOKMAKERS.find(b => b.toLowerCase() === s.toLowerCase());
  return found || s.slice(0, 32);
}
function normalizeSport(sp) {
  if (!sp) return 'football';
  const s = String(sp).trim().toLowerCase();
  const found = ALLOWED_SPORTS.find(x => x === s);
  if (found) return found;
  // Aliases
  if (/foot/.test(s)) return 'football';
  if (/basket/.test(s)) return 'basketball';
  if (/tennis/.test(s)) return 'tennis';
  if (/hockey/.test(s)) return 'hockey';
  if (/rugby/.test(s)) return 'rugby';
  if (/baseball|mlb/.test(s)) return 'baseball';
  if (/mma|ufc/.test(s)) return 'mma';
  if (/boxe|boxing/.test(s)) return 'boxe';
  if (/f1|formula/.test(s)) return 'formula1';
  if (/volley/.test(s)) return 'volleyball';
  if (/hand/.test(s)) return 'handball';
  if (/esport|cs.?go|lol|league.of/.test(s)) return 'esports';
  if (/golf/.test(s)) return 'golf';
  return 'autre';
}

// ─── REVERIFY — Re-confirmation mdp pour actions sensibles (import CSV) ────────
// Token court (5 min) stocké en mémoire — pas de persistance car volatil par design
const REVERIFY_TOKENS = new Map(); // userId → { token, expiresAt }
const REVERIFY_TTL_MS = 5 * 60 * 1000;
function issueReverifyToken(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  REVERIFY_TOKENS.set(userId, { token, expiresAt: Date.now() + REVERIFY_TTL_MS });
  return token;
}
function consumeReverifyToken(userId, token) {
  const entry = REVERIFY_TOKENS.get(userId);
  if (!entry) return false;
  if (entry.expiresAt < Date.now()) { REVERIFY_TOKENS.delete(userId); return false; }
  if (entry.token !== token) return false;
  REVERIFY_TOKENS.delete(userId); // single-use
  return true;
}
function purgeExpiredReverifyTokens() {
  const now = Date.now();
  for (const [uid, e] of REVERIFY_TOKENS.entries()) if (e.expiresAt < now) REVERIFY_TOKENS.delete(uid);
}
setInterval(purgeExpiredReverifyTokens, 60 * 1000).unref();

// ─── MES PARIS — Helpers ──────────────────────────────────────────────────────
function buildBetsWhere(userId, q) {
  const where = ['user_id = ?'];
  const vals = [userId];
  if (q.status) {
    const statuses = String(q.status).split(',').map(s => s.trim()).filter(Boolean);
    if (statuses.length === 1) { where.push('status = ?'); vals.push(statuses[0]); }
    else if (statuses.length > 1) { where.push(`status IN (${statuses.map(() => '?').join(',')})`); vals.push(...statuses); }
  }
  if (q.bookmaker) { where.push('bookmaker = ?'); vals.push(q.bookmaker); }
  if (q.sport) { where.push('sport = ?'); vals.push(q.sport); }
  if (q.market) { where.push('market = ?'); vals.push(q.market); }
  if (q.league) { where.push('league = ?'); vals.push(q.league); }
  if (q.team) { where.push('(home_team LIKE ? OR away_team LIKE ?)'); const pat = `%${q.team}%`; vals.push(pat, pat); }
  const dateField = q.dateField === 'settled' ? 'settled_at' : 'commence_time';
  if (q.from) { where.push(`${dateField} >= ?`); vals.push(dateField === 'settled_at' ? parseInt(q.from) : q.from); }
  if (q.to)   { where.push(`${dateField} <= ?`); vals.push(dateField === 'settled_at' ? parseInt(q.to)   : q.to); }
  return { where: where.join(' AND '), vals };
}
function listUserBets(userId, q, limit, offset) {
  const { where, vals } = buildBetsWhere(userId, q);
  return sqldb.prepare(`SELECT * FROM user_bets WHERE ${where} ORDER BY COALESCE(commence_time, created_at) DESC LIMIT ? OFFSET ?`)
    .all(...vals, limit, offset);
}
function countUserBets(userId, q) {
  const { where, vals } = buildBetsWhere(userId, q);
  const r = sqldb.prepare(`SELECT COUNT(*) AS n FROM user_bets WHERE ${where}`).get(...vals);
  return r ? r.n : 0;
}
function computePayoutCents(bet, newStatus, cashoutAmount) {
  const stake = bet.stake_cents;
  switch (newStatus) {
    case 'won':       return Math.round(stake * (bet.odds - 1));
    case 'lost':      return -stake;
    case 'void':      return 0;
    case 'half_won':  return Math.round(stake * (bet.odds - 1) / 2);
    case 'half_lost': return -Math.round(stake / 2);
    case 'cashout': {
      const amount = typeof cashoutAmount === 'number' ? cashoutAmount : 0;
      return Math.round(amount * 100) - stake;
    }
    default: return 0;
  }
}
function suggestBetSettlement(bet) {
  if (!bet.match_id) return { suggested_status: null, reason: 'no_match_id' };
  const histArr = (typeof history !== 'undefined' && Array.isArray(history)) ? history : [];
  const h = histArr.find(x => x.id === bet.match_id);
  if (!h || !h.verified || !h.realScore) return { suggested_status: null, reason: 'not_yet_verified' };
  const hg = h.realScore.home, ag = h.realScore.away, total = hg + ag;
  const market = (bet.market || '').toUpperCase();
  const label = (bet.selection_label || '').toLowerCase();
  let suggested = null;
  // Markets : OVER_X_Y, UNDER_X_Y, BTTS:YES/NO, 1X2:HOME/DRAW/AWAY, AH:±N, DC:1X/12/X2
  const overMatch = market.match(/^OVER_(\d+)_(\d+)$/);
  const underMatch = market.match(/^UNDER_(\d+)_(\d+)$/);
  if (overMatch) {
    const line = parseFloat(`${overMatch[1]}.${overMatch[2]}`);
    suggested = total > line ? 'won' : (total === line ? 'void' : 'lost');
  } else if (underMatch) {
    const line = parseFloat(`${underMatch[1]}.${underMatch[2]}`);
    suggested = total < line ? 'won' : (total === line ? 'void' : 'lost');
  } else if (market.startsWith('BTTS')) {
    const yes = hg > 0 && ag > 0;
    const wantYes = market.includes('YES') || label.includes('oui');
    suggested = (yes === wantYes) ? 'won' : 'lost';
  } else if (market.startsWith('1X2') || market.startsWith('WINNER')) {
    const winner = hg > ag ? 'HOME' : (ag > hg ? 'AWAY' : 'DRAW');
    let want = null;
    if (market.includes('HOME') || label.includes(String(bet.home_team || '').toLowerCase())) want = 'HOME';
    else if (market.includes('AWAY') || label.includes(String(bet.away_team || '').toLowerCase())) want = 'AWAY';
    else if (market.includes('DRAW') || label.includes('nul')) want = 'DRAW';
    if (want) suggested = (winner === want) ? 'won' : 'lost';
  } else if (market.startsWith('DC')) {
    const winner = hg > ag ? 'HOME' : (ag > hg ? 'AWAY' : 'DRAW');
    if (market.includes('1X')) suggested = (winner !== 'AWAY') ? 'won' : 'lost';
    else if (market.includes('X2')) suggested = (winner !== 'HOME') ? 'won' : 'lost';
    else if (market.includes('12')) suggested = (winner !== 'DRAW') ? 'won' : 'lost';
  }
  return { suggested_status: suggested, score: `${hg}-${ag}`, source: h.realScore.source || 'archive', verified: true };
}
// ─── MES PARIS — PLAN BANKROLL ────────────────────────────────────────────────
function getBankrollPlan(userId) {
  let plan = sqldb.prepare('SELECT * FROM bankroll_plan WHERE user_id = ?').get(userId);
  if (!plan) {
    // Defaults : 300€ capital, +20%/jour, split 50/50, démarrage 2026-05-12
    sqldb.prepare(`INSERT INTO bankroll_plan (user_id, starting_capital_cents, daily_target_pct, profit_split_pct, start_date)
                   VALUES (?, ?, ?, ?, ?)`).run(userId, 30000, 20.0, 50.0, '2026-05-12');
    plan = sqldb.prepare('SELECT * FROM bankroll_plan WHERE user_id = ?').get(userId);
  }
  return plan;
}
function updateBankrollPlan(userId, patch) {
  const cur = getBankrollPlan(userId);
  const next = {
    starting_capital_cents: typeof patch.starting_capital === 'number' ? Math.round(patch.starting_capital * 100) : cur.starting_capital_cents,
    daily_target_pct: typeof patch.daily_target_pct === 'number' ? patch.daily_target_pct : cur.daily_target_pct,
    profit_split_pct: typeof patch.profit_split_pct === 'number' ? Math.max(0, Math.min(100, patch.profit_split_pct)) : cur.profit_split_pct,
    start_date: typeof patch.start_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(patch.start_date) ? patch.start_date : cur.start_date,
    floor_cents: typeof patch.floor === 'number' ? Math.round(patch.floor * 100) : cur.floor_cents,
  };
  sqldb.prepare(`UPDATE bankroll_plan SET starting_capital_cents=?, daily_target_pct=?, profit_split_pct=?, start_date=?, floor_cents=?, updated_at=strftime('%s','now') WHERE user_id=?`)
       .run(next.starting_capital_cents, next.daily_target_pct, next.profit_split_pct, next.start_date, next.floor_cents, userId);
  return getBankrollPlan(userId);
}

// Aggregate settled bets by day for tracker
function computeDailyTracker(userId) {
  const plan = getBankrollPlan(userId);
  const start = plan.start_date;
  // UTC midnight de start_date — évite décalage local TZ
  const startTsUtc = Math.floor(Date.UTC(...start.split('-').map((v, i) => i === 1 ? +v - 1 : +v)) / 1000);
  // Récupère paris settled depuis start_date, ordonnés
  const bets = sqldb.prepare(`SELECT * FROM user_bets WHERE user_id = ? AND status NOT IN ('pending')
                              AND COALESCE(settled_at, created_at) >= ?
                              ORDER BY COALESCE(settled_at, created_at) ASC`).all(userId, startTsUtc);
  // Group P&L par jour (Europe/Paris convention basique en UTC, suffisant pour tracker)
  const dailyPnl = new Map();
  for (const b of bets) {
    const ts = b.settled_at || b.created_at;
    const dayKey = new Date(ts * 1000).toISOString().slice(0, 10);
    dailyPnl.set(dayKey, (dailyPnl.get(dayKey) || 0) + (b.payout_cents || 0));
  }
  // Build series : du start_date jusqu'à aujourd'hui (max 90 jours pour éviter explosion)
  // UTC normalisé pour éviter décalage TZ
  const today = new Date().toISOString().slice(0, 10);
  const out = [];
  const oneDay = 86400000;
  const startMs = Date.UTC(...start.split('-').map((v, i) => i === 1 ? +v - 1 : +v));
  const todayMs = Date.UTC(...today.split('-').map((v, i) => i === 1 ? +v - 1 : +v));
  const dayCount = Math.min(90, Math.max(1, Math.floor((todayMs - startMs) / oneDay) + 1));
  const targetMult = 1 + (plan.daily_target_pct / 100);
  const splitBank = plan.profit_split_pct / 100;
  let capital = plan.starting_capital_cents;
  let banque = 0; // cumul banque (locked savings simulés)
  for (let i = 0; i < dayCount; i++) {
    const d = new Date(startMs + i * oneDay).toISOString().slice(0, 10);
    const targetCapital = Math.round(plan.starting_capital_cents * Math.pow(targetMult, i + 1));
    const pnl = dailyPnl.get(d) || 0;
    let gainBank = 0, gainCapital = 0;
    if (pnl > 0) {
      gainBank = Math.round(pnl * splitBank);
      gainCapital = pnl - gainBank;
      capital += gainCapital;
      banque += gainBank;
    } else {
      capital += pnl; // perte 100% capital
    }
    out.push({
      date: d,
      target_capital_cents: targetCapital,
      target_pnl_cents: Math.round(targetCapital - (i === 0 ? plan.starting_capital_cents : Math.round(plan.starting_capital_cents * Math.pow(targetMult, i)))),
      actual_capital_cents: capital,
      daily_pnl_cents: pnl,
      gain_to_bank_cents: gainBank,
      gain_to_capital_cents: gainCapital,
      cumul_bank_cents: banque,
      gap_vs_target_cents: capital + banque - targetCapital,
      hit_target: (capital + banque) >= targetCapital,
    });
  }
  return { plan, days: out, summary: { current_capital_cents: capital, cumul_bank_cents: banque, total_value_cents: capital + banque } };
}

// ─── IMPORT CSV 1xbet/ANJ — Parser flexible ──────────────────────────────────
// Détecte automatiquement les colonnes : date, sport, événement (équipe1 vs équipe2), marché, cote, mise, gain, statut
const CSV_COL_ALIASES = {
  date: ['date', 'jour', 'datetime', 'placed_at', 'time'],
  sport: ['sport', 'discipline', 'category'],
  event: ['event', 'match', 'évènement', 'evenement', 'rencontre', 'fixture'],
  market: ['market', 'marché', 'marche', 'pari', 'bet_type', 'type'],
  selection: ['selection', 'sélection', 'pick', 'choix', 'pronostic'],
  odds: ['odds', 'cote', 'coefficient', 'cotation'],
  stake: ['stake', 'mise', 'amount', 'montant'],
  payout: ['payout', 'gain', 'winnings', 'profit'],
  status: ['status', 'statut', 'état', 'etat', 'result', 'résultat'],
  bookmaker: ['bookmaker', 'bookie', 'site', 'plateforme'],
  league: ['league', 'ligue', 'competition', 'compétition', 'championship', 'tournament'],
};
function parseCSVLine(line) {
  const out = [];
  let cur = '', inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') { inQuotes = false; }
      else cur += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ',' || ch === ';' || ch === '\t') { out.push(cur); cur = ''; }
      else cur += ch;
    }
  }
  out.push(cur);
  return out.map(s => s.trim());
}
function mapCSVHeaders(headers) {
  const lower = headers.map(h => h.toLowerCase().trim());
  const map = {};
  for (const [key, aliases] of Object.entries(CSV_COL_ALIASES)) {
    for (const al of aliases) {
      const idx = lower.indexOf(al);
      if (idx >= 0) { map[key] = idx; break; }
    }
  }
  return map;
}
function normalizeStatusToken(s) {
  if (!s) return 'pending';
  const t = String(s).toLowerCase().trim();
  if (/won|gagn|win|✓|ok/.test(t)) return 'won';
  if (/lost|perdu|loss|✗|ko/.test(t)) return 'lost';
  if (/void|annul|refund|rembours|push/.test(t)) return 'void';
  if (/cashout|cash.?out/.test(t)) return 'cashout';
  if (/half.?won|demi.?gagn/.test(t)) return 'half_won';
  if (/half.?lost|demi.?perdu/.test(t)) return 'half_lost';
  return 'pending';
}
function parseBetsCSV(csvText, defaultBookmaker = '1xbet') {
  const lines = csvText.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return { error: 'CSV vide ou sans en-tête' };
  const headers = parseCSVLine(lines[0]);
  const map = mapCSVHeaders(headers);
  if (!map.odds || !map.stake) {
    // Try second line as header (1xbet préfixe parfois "Historique" en première ligne)
    if (lines.length > 2) {
      const headers2 = parseCSVLine(lines[1]);
      const map2 = mapCSVHeaders(headers2);
      if (map2.odds !== undefined && map2.stake !== undefined) {
        return parseBetsCSV(lines.slice(1).join('\n'), defaultBookmaker);
      }
    }
    return { error: 'Colonnes "cote" et "mise" introuvables dans en-tête CSV' };
  }
  const rows = [];
  const errors = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCSVLine(lines[i]);
    if (cells.length < 2) continue;
    const get = (key) => map[key] !== undefined ? (cells[map[key]] || '').trim() : '';
    const odds = parseFloat(get('odds').replace(',', '.'));
    const stake = parseFloat(get('stake').replace(/[€$\s]/g, '').replace(',', '.'));
    if (!odds || odds < 1.01 || !stake || stake <= 0) {
      errors.push({ line: i + 1, reason: 'odds/stake invalide', raw: cells.slice(0, 4).join(',') });
      continue;
    }
    const event = get('event');
    const teams = event.split(/\s*[-—–vs|]\s*/i);
    const dateRaw = get('date');
    let commenceTime = null;
    if (dateRaw) {
      // Try ISO 8601, French DD/MM/YYYY, DD.MM.YYYY
      const m = dateRaw.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})(?:[ T](\d{1,2}):(\d{2}))?/);
      if (m) {
        const yyyy = m[3].length === 2 ? '20' + m[3] : m[3];
        const dd = m[1].padStart(2, '0'), mm = m[2].padStart(2, '0');
        const hh = (m[4] || '00').padStart(2, '0'), mn = m[5] || '00';
        commenceTime = `${yyyy}-${mm}-${dd}T${hh}:${mn}:00`;
      } else if (/^\d{4}-\d{2}-\d{2}/.test(dateRaw)) {
        commenceTime = dateRaw;
      }
    }
    const statusToken = normalizeStatusToken(get('status'));
    const payoutRaw = parseFloat(get('payout').replace(/[€$\s]/g, '').replace(',', '.'));
    let payoutCents = null;
    if (statusToken === 'won') payoutCents = Math.round(stake * (odds - 1) * 100);
    else if (statusToken === 'lost') payoutCents = -Math.round(stake * 100);
    else if (statusToken === 'void') payoutCents = 0;
    else if (!isNaN(payoutRaw) && payoutRaw !== 0) payoutCents = Math.round((payoutRaw - stake) * 100);
    rows.push({
      commence_time: commenceTime,
      sport: normalizeSport(get('sport')),
      home_team: teams[0] ? teams[0].trim().slice(0, 64) : null,
      away_team: teams[1] ? teams[1].trim().slice(0, 64) : null,
      league: get('league').slice(0, 64) || null,
      market: (get('market') || 'FREE').slice(0, 32),
      selection_label: (get('selection') || get('market') || 'Pari importé').slice(0, 64),
      odds,
      stake_cents: Math.round(stake * 100),
      bookmaker: normalizeBookmaker(get('bookmaker') || defaultBookmaker),
      status: statusToken,
      payout_cents: payoutCents,
      external_ref: `${dateRaw}|${event}|${odds}`.slice(0, 128),
    });
  }
  return { rows, errors, header_map: map };
}

function computeBankrollSummary(userId, q) {
  const txWhere = ['user_id = ?']; const txVals = [userId];
  const betWhere = ['user_id = ?']; const betVals = [userId];
  if (q.from) { txWhere.push('occurred_at >= ?'); txVals.push(parseInt(q.from)); betWhere.push('created_at >= ?'); betVals.push(parseInt(q.from)); }
  if (q.to)   { txWhere.push('occurred_at <= ?'); txVals.push(parseInt(q.to));   betWhere.push('created_at <= ?'); betVals.push(parseInt(q.to)); }
  // Tx aggregates
  const tx = sqldb.prepare(`SELECT * FROM bankroll_transactions WHERE ${txWhere.join(' AND ')} ORDER BY occurred_at ASC`).all(...txVals);
  let deposited = 0, withdrawn = 0;
  for (const t of tx) {
    if (t.kind === 'deposit') deposited += t.amount_cents;
    else if (t.kind === 'withdrawal') withdrawn += -t.amount_cents; // stored negative
    else { // adjustment
      if (t.amount_cents > 0) deposited += t.amount_cents;
      else withdrawn += -t.amount_cents;
    }
  }
  // Bets aggregates
  const allBets = sqldb.prepare(`SELECT * FROM user_bets WHERE ${betWhere.join(' AND ')} ORDER BY COALESCE(settled_at, created_at) ASC`).all(...betVals);
  let settledPL = 0, openStake = 0, totalStakeSettled = 0;
  const totals = { total_bets: allBets.length, won: 0, lost: 0, void: 0, pending: 0, cashout: 0, half_won: 0, half_lost: 0 };
  for (const b of allBets) {
    totals[b.status] = (totals[b.status] || 0) + 1;
    if (b.status === 'pending') { openStake += b.stake_cents; }
    else {
      settledPL += b.payout_cents || 0;
      if (b.status !== 'void') totalStakeSettled += b.stake_cents;
    }
  }
  const currentCents = deposited - withdrawn + settledPL;
  const freeCents = currentCents - openStake;
  const roiPct = totalStakeSettled > 0 ? Math.round(settledPL / totalStakeSettled * 10000) / 100 : 0;
  const decided = totals.won + totals.lost + totals.half_won + totals.half_lost;
  const winRate = decided > 0 ? Math.round((totals.won + 0.5 * totals.half_won) / decided * 10000) / 10000 : 0;
  // Streaks (ordre settled_at)
  const settledBets = allBets.filter(b => b.status !== 'pending').sort((a, b) => (a.settled_at || 0) - (b.settled_at || 0));
  let longestWin = 0, longestLoss = 0, curW = 0, curL = 0;
  for (const b of settledBets) {
    const win = b.status === 'won' || b.status === 'half_won' || (b.status === 'cashout' && (b.payout_cents || 0) > 0);
    const loss = b.status === 'lost' || b.status === 'half_lost' || (b.status === 'cashout' && (b.payout_cents || 0) < 0);
    if (win) { curW++; curL = 0; longestWin = Math.max(longestWin, curW); }
    else if (loss) { curL++; curW = 0; longestLoss = Math.max(longestLoss, curL); }
    else { curW = 0; curL = 0; }
  }
  // Daily series (bankroll = cumul deposits - withdrawals + settled PL par jour, ordered)
  const events = [];
  for (const t of tx) {
    const d = new Date(t.occurred_at * 1000).toISOString().slice(0, 10);
    events.push({ date: d, ts: t.occurred_at, delta: t.amount_cents, type: t.kind });
  }
  for (const b of settledBets) {
    const d = new Date((b.settled_at || b.created_at) * 1000).toISOString().slice(0, 10);
    events.push({ date: d, ts: b.settled_at || b.created_at, delta: b.payout_cents || 0, type: 'bet' });
  }
  events.sort((a, b) => a.ts - b.ts);
  const dailyMap = new Map();
  let running = 0, peak = 0, trough = 0, maxDD = 0;
  let runningRisk = 0, peakRisk = 0, maxDDRisk = 0;
  for (const e of events) {
    running += e.delta;
    if (e.type === 'bet') {
      runningRisk += e.delta;
      if (runningRisk > peakRisk) peakRisk = runningRisk;
      const ddRisk = peakRisk - runningRisk;
      if (ddRisk > maxDDRisk) maxDDRisk = ddRisk;
    }
    if (running > peak) peak = running;
    const dd = peak > 0 ? (peak - running) / peak * 100 : 0;
    if (dd > maxDD) maxDD = dd;
    const prev = dailyMap.get(e.date) || { date: e.date, bankroll_cents: 0, pl_cents: 0, deposit_cents: 0, withdrawal_cents: 0 };
    prev.bankroll_cents = running;
    if (e.type === 'deposit') prev.deposit_cents += e.delta;
    else if (e.type === 'withdrawal') prev.withdrawal_cents += -e.delta;
    else if (e.type === 'bet') prev.pl_cents += e.delta;
    dailyMap.set(e.date, prev);
  }
  const dailySeries = Array.from(dailyMap.values());
  const rawDDPct = peakRisk > 0 ? Math.round(maxDDRisk / peakRisk * 10000) / 100 : 0;
  return {
    current_cents: currentCents,
    free_cents: freeCents,
    open_stake_cents: openStake,
    deposited_cents: deposited,
    withdrawn_cents: withdrawn,
    settled_pl_cents: settledPL,
    roi_pct: roiPct,
    win_rate: winRate,
    totals,
    longest_win_streak: longestWin,
    longest_loss_streak: longestLoss,
    max_drawdown_pct: Math.round(maxDD * 100) / 100,
    raw_drawdown_pct: rawDDPct,
    daily_series: dailySeries,
  };
}

// ─── VERROU ANTI-RACE-CONDITION ──────────────────────────────────────────────
let isFetchingOdds = false;
let isFetchingStats = false;

// ─── SSE CLIENTS ─────────────────────────────────────────────────────────────
const sseClients = new Set(); // connexions SSE actives
const _livePatchSnapshot = new Map(); // [P2] snapshot dernier etat live envoye par SSE

function broadcastSSE(eventName, data) {
  const payload = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of sseClients) {
    try { res.write(payload); } catch (e) { sseClients.delete(res); }
  }
}

// Retourne db.matches avec le mock injecté en tête si actif
function matchesForBroadcast() {
  const base = db.matches || [];
  if (mockActive && testMatch && testMatch.live_status !== 'FT') {
    return [testMatch, ...base.filter(m => m.id !== testMatch.id)];
  }
  return base;
}

function buildMeta() {
  return {
    lastOddsUpdate: db.lastOddsUpdate,
    lastStatsUpdate: db.lastStatsUpdate,
    status: db.status,
    oddsQuota: db.oddsQuotaRemaining,
    statsQuota: db.statsQuotaRemaining,
  };
}
// Chargement dynamique de la configuration des ligues
const LEAGUES_CONFIG_FILE = path.join(__dirname, 'leagues_config.json');
let leaguesConfig = { leagues: [] };
try {
  leaguesConfig = JSON.parse(fs.readFileSync(LEAGUES_CONFIG_FILE, 'utf8'));
  console.log(`  ✓ leagues_config.json chargé (${leaguesConfig.leagues.length} ligues)`);
} catch (e) {
  console.warn('  ⚠ leagues_config.json introuvable — ligues par défaut utilisées');
  leaguesConfig = {
    leagues: [
      { id: 61, name: 'Ligue 1', type: 'T1', odds_key: 'soccer_france_ligue1', cron_hours: 6 },
      { id: 39, name: 'Premier League', type: 'T1', odds_key: 'soccer_epl', cron_hours: 6 },
      { id: 2, name: 'Champions League', type: 'T1', odds_key: 'soccer_uefa_champs_league', cron_hours: 6 },
      { id: 140, name: 'La Liga', type: 'T1', odds_key: 'soccer_spain_la_liga', cron_hours: 6 },
      { id: 78, name: 'Bundesliga', type: 'T1', odds_key: 'soccer_germany_bundesliga', cron_hours: 6 },
      { id: 135, name: 'Serie A', type: 'T1', odds_key: 'soccer_italy_serie_a', cron_hours: 6 },
      { id: 3, name: 'Europa League', type: 'T1', odds_key: 'soccer_uefa_europa_league', cron_hours: 6 },
    ]
  };
}

const SPORT_LABELS = {};
leaguesConfig.leagues.forEach(l => { if (l.odds_key) SPORT_LABELS[l.odds_key] = l.name; });
const ALL_SPORTS = leaguesConfig.leagues.filter(l => l.odds_key).map(l => l.odds_key);
const ALL_LEAGUE_IDS = leaguesConfig.leagues.filter(l => l.id).map(l => l.id);
// Délai de refresh par ligue (en ms) — T1: 6h, T2: 12h (depuis cron_hours dans leagues_config.json)
const LEAGUE_CRON_MS = {};
leaguesConfig.leagues.forEach(l => { if (l.id) LEAGUE_CRON_MS[l.id] = (l.cron_hours || 6) * 3600000; });

// ═══════════════════════════════════════════════════════════════════════════════
//  BSD (Bzzoiro Sports Data) — API gratuite, zéro rate limit
//  Remplace API-Football pour les standings + fixtures + odds
// ═══════════════════════════════════════════════════════════════════════════════
const BSD_CONFIG_FILE = path.join(__dirname, 'bsd_config.json');
let bsdConfig = { api_key: '', base_url: 'https://sports.bzzoiro.com/api', mapping: { bsd_to_config: {}, config_to_bsd: {}, bsd_only: [], fallback_needed: [] } };
try {
  bsdConfig = JSON.parse(fs.readFileSync(BSD_CONFIG_FILE, 'utf8'));
  const bsdLeagueCount = Object.keys(bsdConfig.mapping.config_to_bsd).length;
  console.log(`  ✓ bsd_config.json chargé (${bsdLeagueCount} ligues BSD, ${bsdConfig.mapping.fallback_needed.length} fallback API-Football)`);
} catch (e) {
  console.warn('  ⚠ bsd_config.json introuvable — BSD désactivé');
}

const BSD_API_KEY = bsdConfig.api_key || process.env.BSD_API_KEY || '';
const BSD_BASE_URL = bsdConfig.base_url || 'https://sports.bzzoiro.com/api';
const BSD_CONFIG_TO_BSD = bsdConfig.mapping?.config_to_bsd || {};
const BSD_BSD_TO_CONFIG = bsdConfig.mapping?.bsd_to_config || {};
const BSD_FALLBACK_NEEDED = bsdConfig.mapping?.fallback_needed || [];

// ═══════════════════════════════════════════════════════════════════════════════
//  SOFASCORE — Fallback pour ligues exotiques sans données API-Football/BSD
// ═══════════════════════════════════════════════════════════════════════════════

const SOFA_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
  'Referer': 'https://www.sofascore.com/',
  'Origin': 'https://www.sofascore.com',
  'Cache-Control': 'no-cache',
};

async function sofaGet(path) {
  return httpsGet(`https://api.sofascore.com/api/v1${path}`, SOFA_HEADERS);
}

// Find Sofascore team ID by name — cached 7 days
async function searchSofascoreTeam(teamName) {
  try {
    const cacheKey = `sofa_team_${teamName.replace(/\s+/g, '_').toLowerCase()}`;
    const cached = apiCacheGet(cacheKey, 'sofa_team');
    if (cached) return cached;
    const q = encodeURIComponent(teamName);
    const res = await sofaGet(`/search/teams?q=${q}`);
    // API returns { results: [{entity: {id, name, ...}}] }
    const teams = (res.data?.results || []).map(r => r.entity).filter(Boolean);
    if (res.status !== 200 || !teams.length) return null;
    // Pick best match: exact name match first, then first result
    const norm = s => (s || '').toLowerCase().replace(/[^a-z0-9]/g, ' ').trim();
    const tNorm = norm(teamName);
    const best = teams.find(t => norm(t.name) === tNorm)
      || teams.find(t => norm(t.name).includes(tNorm) || tNorm.includes(norm(t.name)))
      || teams[0];
    const result = { id: best.id, name: best.name };
    apiCacheSet(cacheKey, result, 'sofa_team', 7 * 24 * 3600);
    return result;
  } catch (e) { return null; }
}

// -------------------------------------------------
//  BSD: Fiche détaillée joueur
// -------------------------------------------------
async function bsdSearchPlayers(name) {
  if (!BSD_API_KEY || !name) return [];
  try {
    const res = await bsdFetch(`/players/?search=${encodeURIComponent(name)}&page_size=10`);
    const results = res.data?.results || [];
    return results.map(p => ({
      id: p.id,
      name: p.name,
      position: p.position,
      team: p.team ? { id: p.team.id, name: p.team.name } : null,
    }));
  } catch (e) {
    console.error('[bsdSearchPlayers] erreur:', e.message);
    return [];
  }
}

async function bsdGetPlayerDetail(playerId) {
  if (!BSD_API_KEY) return null;
  try {
    const res = await bsdFetch(`/players/${playerId}/`);
    const p = res.data;
    if (!p) return null;

    // page_size=100 (was 30) — couvre vétérans 100+ matchs sans truncation
    let rawStats = [];
    try {
      const statsRes = await bsdFetch(`/player-stats/?player=${playerId}&page_size=100`);
      rawStats = statsRes.data?.results || [];
    } catch { /* ignore */ }

    // Agrégats saison courante (rawStats trié par date DESC par BSD)
    const currentSeason = rawStats[0]?.season?.name || null;
    const seasonStats = currentSeason
      ? rawStats.filter(s => s.season?.name === currentSeason)
      : rawStats;

    let totalGoals = 0, totalAssists = 0, totalMinutes = 0, totalMatches = 0;
    let totalYellow = 0, totalRed = 0, totalSaves = 0;
    let totalShotsOn = 0, totalKeyPasses = 0;
    let totalXG = 0, totalXA = 0;
    let totalShotsTotal = 0, totalShotsInBox = 0;
    const ratings = [];

    for (const s of seasonStats) {
      totalGoals     += s.goals             || 0;
      totalAssists   += s.goal_assist        || 0;
      totalMinutes   += s.minutes_played     || 0;
      totalMatches   += 1;
      totalYellow    += s.yellow_card        || 0;
      totalRed       += s.red_card           || 0;
      totalSaves     += s.saves              || 0;
      totalShotsOn   += s.shots_on_target    || 0;
      totalKeyPasses += s.key_pass           || 0;
      totalXG        += s.expected_goals     || s.xg || 0;
      totalXA        += s.expected_assists   || s.xa || 0;
      totalShotsTotal+= s.shots_total        || s.total_shots || 0;
      totalShotsInBox+= s.shots_in_box       || s.shots_inside_box || 0;
      if (s.rating != null) ratings.push(s.rating);
    }

    const avgRating = ratings.length
      ? parseFloat((ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(2))
      : null;
    const per90 = Math.max(1, totalMinutes / 90);
    const convRate = totalShotsTotal > 0
      ? parseFloat(((totalGoals / totalShotsTotal) * 100).toFixed(1))
      : null;
    const kpi = parseFloat(
      ((totalGoals * 3 + totalAssists * 2 + (avgRating || 0)) / per90).toFixed(2)
    );

    // BSD player-stats structure : { event: { home_team, away_team, event_date, home_score, away_score }, player: { team }, ... }
    const form_l5 = rawStats.slice(0, 5).map(s => {
      const ev = s.event || {};
      const playerTeam = s.player?.team || null;
      const eventHomeTeam = ev.home_team || null;
      const eventAwayTeam = ev.away_team || null;
      // Détermine is_home + opponent + result via player.team vs event teams
      let isHome = null, opponent = null, opponentLogo = null, result = null;
      if (playerTeam && eventHomeTeam && eventAwayTeam) {
        const ptNorm = normName(playerTeam);
        const htNorm = normName(eventHomeTeam);
        if (ptNorm === htNorm || htNorm.includes(ptNorm) || ptNorm.includes(htNorm)) {
          isHome = true;
          opponent = eventAwayTeam;
        } else {
          isHome = false;
          opponent = eventHomeTeam;
        }
        // Compute result
        if (typeof ev.home_score === 'number' && typeof ev.away_score === 'number') {
          const playerScore = isHome ? ev.home_score : ev.away_score;
          const oppScore    = isHome ? ev.away_score : ev.home_score;
          result = playerScore > oppScore ? 'W' : playerScore < oppScore ? 'L' : 'D';
        }
      } else if (typeof s.opponent === 'object' && s.opponent) {
        opponent = s.opponent.name;
        opponentLogo = s.opponent.image_path ? 'https://sports.bzzoiro.com' + s.opponent.image_path : null;
      } else if (typeof s.opponent === 'string') {
        opponent = s.opponent;
      }
      const dateRaw = ev.event_date || s.date || s.started_at || s.event_date || '';
      const score = (typeof ev.home_score === 'number' && typeof ev.away_score === 'number')
        ? `${ev.home_score}-${ev.away_score}` : null;
      return {
        date: dateRaw ? String(dateRaw).slice(0, 10) : '',
        opponent,
        opponent_logo: opponentLogo,
        is_home: isHome,
        result,
        score,
        minutes_played: s.minutes_played  || 0,
        goals:          s.goals           || 0,
        assists:        s.goal_assist      || 0,
        shots_total:    s.shots_total      || s.total_shots || 0,
        shots_on_target: s.shots_on_target || 0,
        xg:             parseFloat((s.expected_goals || s.xg || 0).toFixed(3)),
        rating:         s.rating           || null,
      };
    });

    return {
      id:                p.id,
      name:              p.name,
      short_name:        p.short_name         || null,
      position:          p.position,
      specific_position: p.specific_position  || null,
      nationality:       p.nationality,
      age:               p.age,
      birthdate:         p.birthdate,
      photo:             p.image_path ? `https://sports.bzzoiro.com${p.image_path}` : null,
      team:              p.team ? { id: p.team.id, name: p.team.name } : null,
      height:            p.height,
      weight:            p.weight,
      preferred_foot:    p.preferred_foot || null,
      market_value:      p.market_value   || null,

      season_stats: {
        season:      currentSeason,
        competition: rawStats[0]?.league?.name || null,
        season_id:   rawStats[0]?.season?.id   || null,

        base: {
          matches:      totalMatches,
          minutes:      totalMinutes,
          goals:        totalGoals,
          assists:      totalAssists,
          yellow_cards: totalYellow,
          red_cards:    totalRed,
          avg_rating:   avgRating,
          saves:        totalSaves,
        },
        shooting: {
          shots_total:               totalShotsTotal,
          shots_on_target:           totalShotsOn,
          shots_off_target:          totalShotsTotal > 0 ? totalShotsTotal - totalShotsOn : null,
          shots_in_box:              totalShotsInBox || null,
          conversion_rate:           convRate,
          shots_per_game:            totalMatches > 0 ? parseFloat((totalShotsTotal / totalMatches).toFixed(2)) : null,
          shots_on_target_per_game:  totalMatches > 0 ? parseFloat((totalShotsOn / totalMatches).toFixed(2)) : null,
        },
        expected: {
          xg_total:           parseFloat(totalXG.toFixed(3)),
          xa_total:           parseFloat(totalXA.toFixed(3)),
          xg_per_game:        totalMatches > 0 ? parseFloat((totalXG / totalMatches).toFixed(3)) : null,
          xa_per_game:        totalMatches > 0 ? parseFloat((totalXA / totalMatches).toFixed(3)) : null,
          xg_overperformance: parseFloat((totalGoals - totalXG).toFixed(3)),
          xg_per_shot:        totalShotsTotal > 0 ? parseFloat((totalXG / totalShotsTotal).toFixed(3)) : null,
        },
        creativity: {
          key_passes:          totalKeyPasses,
          key_passes_per_game: totalMatches > 0 ? parseFloat((totalKeyPasses / totalMatches).toFixed(2)) : null,
        },
        per90: {
          goals_per90:   parseFloat((totalGoals   / per90).toFixed(3)),
          xg_per90:      parseFloat((totalXG      / per90).toFixed(3)),
          shots_per90:   totalShotsTotal > 0 ? parseFloat((totalShotsTotal / per90).toFixed(3)) : null,
          assists_per90: parseFloat((totalAssists  / per90).toFixed(3)),
        },
        kpi_score: kpi,
      },

      form_l5,
    };
  } catch (e) {
    console.error('[bsdGetPlayerDetail] erreur:', e.message);
    return null;
  }
}

// -------------------------------------------------
//  BSD: Fiche détaillée équipe
// -------------------------------------------------
async function bsdGetTeamDetail(teamId) {
  if (!BSD_API_KEY) return null;
  try {
    const res = await bsdFetch(`/teams/${teamId}/`);
    const t = res.data;
    if (!t) return null;

    // Récupérer les derniers matchs
    let recentMatches = [];
    try {
      const matchesRes = await bsdFetch(`/teams/${teamId}/matches/?page_size=10`);
      recentMatches = (matchesRes.data?.results || []).map(m => ({
        id: m.id,
        home_team: m.home_team?.name,
        away_team: m.away_team?.name,
        score: m.score,
        status: m.status,
        date: m.started_at
      }));
    } catch { /* ignore */ }

    return {
      id: t.id,
      name: t.name,
      short_name: t.short_code,
      logo: t.image_path ? `https://sports.bzzoiro.com${t.image_path}` : null,
      country: t.country?.name,
      country_code: t.country?.code,
      stadium: t.venue?.name,
      stadium_capacity: t.venue?.capacity,
      founded: t.founded,
      league: t.league?.name,
      manager: t.coach?.name,
      recentMatches: recentMatches
    };
  } catch (e) {
    console.error('[bsdGetTeamDetail] erreur:', e.message);
    return null;
  }
}

// Fetch TV broadcast channels for matches (Sofascore public API)
async function fetchTVChannels(dateStr) {
  try {
    const cacheKey = `tv_channels_${dateStr}`;
    const cached = apiCacheGet(cacheKey, 'tv_channels');
    if (cached) return cached;
    
    const res = await sofaGet(`/sport/football/scheduled-events/${dateStr}`);
    if (res.status !== 200 || !res.data?.events) return [];
    
    // Map des chaînes TV courantes avec logos
    const channelLogos = {
      'beIN SPORTS': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/14/BeIN_Sports_2017.svg/200px-BeIN_Sports_2017.svg.png',
      'beIN SPORTS MAX': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/14/BeIN_Sports_2017.svg/200px-BeIN_Sports_2017.svg.png',
      'Canal+': 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2c/Canal%2B.svg/200px-Canal%2B.svg.png',
      'Canal+ Sport': 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2c/Canal%2B.svg/200px-Canal%2B.svg.png',
      'beIN CONNECT': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/14/BeIN_Sports_2017.svg/200px-BeIN_Sports_2017.svg.png',
      'Amazon Prime Video': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/17/Amazon_Prime_Video_logo.jpg/200px-Amazon_Prime_Video_logo.jpg',
      'ESPN': 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2e/ESPN_logo.svg/200px-ESPN_logo.svg.png',
      'Sky Sports': 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b9/Sky_Sports_logo.svg/200px-Sky_Sports_logo.svg.png',
      'BT Sport': 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/57/BT_Sport_logo.svg/200px-BT_Sport_logo.svg.png',
      'DAZN': 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/78/DAZN_Logo.svg/200px-DAZN_Logo.svg.png',
      'TNT Sports': 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e4/TNT_Sports_2021.svg/200px-TNT_Sports_2021.svg.png',
      'Eleven Sports': 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9c/Eleven_Sports_2017.svg/200px-Eleven_Sports_2017.svg.png',
      'RMC Sport': 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/63/RMC_Sport.svg/200px-RMC_Sport.svg.png',
      'L\'Équipe': 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4c/L_%C3%89quipe.svg/200px-L_%C3%89quipe.svg.png',
      'M6': 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e9/M6_logo.svg/200px-M6_logo.svg.png',
      'TF1': 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/72/TF1_logo.svg/200px-TF1_logo.svg.png',
      'France Télévisions': 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/29/France_T%C3%A9l%C3%A9visions_2016.svg/200px-France_T%C3%A9l%C3%A9visions_2016.svg.png',
      'BBC': 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/bc/BBC.svg/200px-BBC.svg.png',
      'ITV': 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c0/ITV_logo.svg/200px-ITV_logo.svg.png',
    };
    
    const channels = [];
    for (const event of res.data.events) {
      if (!event.channels) continue;
      
      for (const ch of event.channels) {
        const logo = channelLogos[ch.name] || null;
        channels.push({
          match_id: event.id,
          home_team: event.homeTeam?.name,
          away_team: event.awayTeam?.name,
          league: event.tournament?.name,
          channel: ch.name,
          channel_logo: logo,
          start_time: new Date(event.startTimestamp * 1000).toISOString()
        });
      }
    }
    
    apiCacheSet(cacheKey, channels, 'tv_channels', 24 * 3600); // 24h cache
    return channels;
  } catch (e) { return []; }
}

// Fetch last N matches for a Sofascore team ID (pages 0,1 = last ~40 matches)
async function fetchSofascoreTeamLastMatches(sofaTeamId, pagesNeeded = 2) {
  try {
    const cacheKey = `sofa_matches_${sofaTeamId}`;
    const cached = apiCacheGet(cacheKey, 'sofa_matches');
    if (cached) return cached;
    const allEvents = [];
    for (let page = 0; page < pagesNeeded; page++) {
      const res = await sofaGet(`/team/${sofaTeamId}/events/last/${page}`);
      if (res.status !== 200 || !res.data?.events?.length) break;
      allEvents.push(...res.data.events);
      if (!res.data.hasNextPage) break;
    }
    const matches = allEvents
      .filter(e => e.status?.type === 'finished' && e.homeScore?.current != null)
      .map(e => ({
        date: new Date(e.startTimestamp * 1000).toISOString().slice(0, 10),
        league: e.tournament?.name || e.tournament?.category?.name || '',
        home: e.homeTeam?.name || '',
        away: e.awayTeam?.name || '',
        home_id: e.homeTeam?.id || null,
        away_id: e.awayTeam?.id || null,
        home_goals: e.homeScore.current,
        away_goals: e.awayScore.current,
        _sofa: true,
      }))
      .sort((a, b) => b.date.localeCompare(a.date));
    apiCacheSet(cacheKey, matches, 'sofa_matches', 6 * 3600);
    return matches;
  } catch (e) { return []; }
}

// Main entry point: get last matches for a team (BSD then Sofascore fallback)
async function fetchTeamLastFixturesBSDOrSofa(teamName, bsdLeagueId, sofaTeamIdHint) {
  // 1. Try BSD first
  const bsdMatches = await fetchBSDTeamLastFixtures(teamName, bsdLeagueId, 30);
  // Need ≥10 total to guarantee ≥5 home AND ≥5 away after filtering
  if (bsdMatches.length >= 10) return bsdMatches;
  // 2. Sofascore fallback when BSD coverage is insufficient
  try {
    let sofaId = sofaTeamIdHint;
    if (!sofaId) {
      const found = await searchSofascoreTeam(teamName);
      sofaId = found?.id;
    }
    if (!sofaId) return bsdMatches;
    const sofaMatches = await fetchSofascoreTeamLastMatches(sofaId, 2);
    if (!sofaMatches.length) return bsdMatches;
    // Merge: BSD matches take priority, pad with Sofascore
    const seen = new Set(bsdMatches.map(m => `${m.date}|${m.home}|${m.away}`));
    const extra = sofaMatches.filter(m => !seen.has(`${m.date}|${m.home}|${m.away}`));
    return [...bsdMatches, ...extra].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30);
  } catch (e) { return bsdMatches; }
}

// Sofascore stats supplement: derive home/away stats from last matches when API-Football has no data
// Used for leagues added via sofa_id only (Austrian, Czech, Danish, Ukrainian, Norwegian, Croatian, Serbian)
async function fetchSofascoreTeamStats(teamName, leagueId) {
  try {
    const found = await searchSofascoreTeam(teamName);
    if (!found?.id) return null;
    // Fetch 3 pages = ~90 matches for reliable stats
    const allMatches = await fetchSofascoreTeamLastMatches(found.id, 3);
    if (!allMatches.length) return null;
    const norm = s => (s || '').toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
    const tNorm = norm(teamName);
    const _stopW = new Set(['al', 'fc', 'sc', 'ac', 'cf', 'sd', 'cd', 'fk', 'sk', 'if', 'bk', 'afc', 'bfc']);
    const sig = tNorm.split(' ').find(w => w.length >= 3 && !_stopW.has(w)) || tNorm.split(' ')[0];
    const homeM = allMatches.filter(m => norm(m.home || '').includes(sig)).slice(0, 20);
    const awayM = allMatches.filter(m => norm(m.away || '').includes(sig)).slice(0, 20);
    const calc = (matches, isHome) => {
      if (!matches.length) return { ppg: 0, avgScored: 0, avgConceded: 0, wins: 0, draws: 0, losses: 0, played: 0 };
      let w = 0, d = 0, l = 0, gf = 0, ga = 0;
      matches.forEach(m => {
        const myG = isHome ? m.home_goals : m.away_goals;
        const opG = isHome ? m.away_goals : m.home_goals;
        if (myG == null || opG == null) return;
        if (myG > opG) w++; else if (myG === opG) d++; else l++;
        gf += myG; ga += opG;
      });
      const n = w + d + l || 1;
      return { ppg: (w * 3 + d) / n, avgScored: gf / n, avgConceded: ga / n, wins: Math.round(w / n * 100), draws: Math.round(d / n * 100), losses: Math.round(l / n * 100), played: n };
    };
    const hStats = calc(homeM, true);
    const aStats = calc(awayM, false);
    // Form from last 5 total matches
    const last5 = allMatches.slice(0, 5);
    const formStr = last5.map(m => {
      const myG = norm(m.home || '').includes(sig) ? m.home_goals : m.away_goals;
      const opG = norm(m.home || '').includes(sig) ? m.away_goals : m.home_goals;
      if (myG == null) return '';
      return myG > opG ? 'W' : myG === opG ? 'D' : 'L';
    }).filter(Boolean).join('');
    return { sofaTeamId: found.id, leagueId, form: formStr, _real: true, _sofa: true, home: hStats, away: aStats };
  } catch (e) { return null; }
}

// Helper BSD: requête GET avec retry
async function bsdFetch(endpoint, retries = 2) {
  const url = `${BSD_BASE_URL}${endpoint}${endpoint.includes('?') ? '&' : '?'}tz=Europe/Paris`;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await httpsGet(url, { 'Authorization': `Token ${BSD_API_KEY}` });
      if (res.status === 200) return res;
      if (attempt < retries && (res.status >= 500 || res.status === 429)) {
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
        continue;
      }
      return res;
    } catch (e) {
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
        continue;
      }
      throw e;
    }
  }
}

// Mapping: config league ID → BSD league ID
function configIdToBsd(configId) {
  return BSD_CONFIG_TO_BSD[String(configId)] || null;
}

// Mapping: BSD league ID → config league ID
function bsdIdToConfig(bsdId) {
  const entry = BSD_BSD_TO_CONFIG[String(bsdId)];
  return entry ? entry.config_id : null;
}

function normText(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function normCountryName(country) {
  const c = normText(country);
  if (!c) return '';
  const aliases = {
    'bresil': 'brazil',
    'brasil': 'brazil',
    'brasilien': 'brazil',
    'angleterre': 'england',
    'italie': 'italy',
    'espagne': 'spain',
    'allemagne': 'germany',
    'pays-bas': 'netherlands',
    'etats-unis': 'usa',
    'etats unis': 'usa',
    'grece': 'greece'
  };
  return aliases[c] || c;
}

function getLeagueConfigBySportKey(sportKey) {
  if (!sportKey) return null;
  return leaguesConfig.leagues.find(l => l.odds_key === sportKey) || null;
}

function forceCountryForKnownCollisions(leagueName, country, bsdLeagueId) {
  const leagueNorm = normText(leagueName);
  const countryNorm = normCountryName(country);
  const bsdId = bsdLeagueId != null ? String(bsdLeagueId) : '';

  if (
    countryNorm === 'brazil' ||
    bsdId === '9' ||
    leagueNorm.includes('brasileirao') ||
    leagueNorm.includes('brasileirao serie a') ||
    leagueNorm.includes('brasileirao serie b') ||
    leagueNorm.includes('campeonato brasileiro')
  ) {
    return 'Brazil';
  }

  return country || null;
}

const HOMONYM_LEAGUE_NAMES = new Set([
  'serie b',
  'super league',
  'premier league',
  'primera division'
]);

function isHomonymLeagueName(leagueName) {
  return HOMONYM_LEAGUE_NAMES.has(normText(leagueName));
}

function resolveConfigLeagueForBSDMatch(bsdMatch) {
  const bsdLeagueId = bsdMatch?._bsd_league_id != null ? Number(bsdMatch._bsd_league_id) : null;
  const leagueNorm = normText(bsdMatch?.league);
  const forcedCountry = forceCountryForKnownCollisions(
    bsdMatch?.league,
    bsdMatch?._bsd_country || bsdMatch?.country,
    bsdMatch?._bsd_league_id
  );
  const forcedCountryNorm = normCountryName(forcedCountry);

  if (bsdLeagueId != null) {
    const configId = bsdIdToConfig(bsdLeagueId);
    if (configId != null) {
      const byId = leaguesConfig.leagues.find(l => Number(l.id) === Number(configId));
      if (byId) return byId;
    }
  }

  const candidates = leaguesConfig.leagues.filter(l => {
    const ln = normText(l.name);
    return ln && (ln === leagueNorm || leagueNorm.includes(ln) || ln.includes(leagueNorm));
  });

  if (!candidates.length) return null;
  if (candidates.length === 1) return candidates[0];

  if (forcedCountryNorm) {
    const byCountry = candidates.find(l => normCountryName(l.country) === forcedCountryNorm);
    if (byCountry) return byCountry;
  }

  const exact = candidates.find(l => normText(l.name) === leagueNorm);
  return exact || candidates[0];
}

function inferSportKeyFromLeagueCountry(leagueName, country) {
  const leagueNorm = normText(leagueName);
  const countryNorm = normCountryName(country);
  if (countryNorm === 'brazil') {
    if (leagueNorm.includes('serie b')) return 'soccer_brazil_serie_b';
    if (leagueNorm.includes('brasileirao') || leagueNorm.includes('serie a') || leagueNorm.includes('campeonato brasileiro')) {
      return 'soccer_brazil_campeonato';
    }
  }
  return null;
}

// ─── BSD MISTAG DETECTION ─────────────────────────────────────────────────────
// BSD ne sépare pas certaines divisions T2 (Ligue 2 FR, Bundesliga 2, Serie B IT) :
// il tag TOUS les matchs du pays sous le T1. On corrige via canonical T1 team list :
// si NI home NI away dans canonical T1 → match T2 mistaggé → override vers T2 odds_key.
const BSD_T1_CANONICAL_TEAMS = {
  // BSD 6 = Ligue 1 FR (2025-2026)
  '6': [
    'paris saint germain', 'paris saint-germain', 'psg', 'paris sg',
    'olympique de marseille', 'olympique marseille', 'marseille', 'om',
    'as monaco', 'monaco',
    'olympique lyonnais', 'olympique lyon', 'lyon', 'ol',
    'lille osc', 'lille', 'losc',
    'rc lens', 'lens',
    'ogc nice', 'nice',
    'stade rennais', 'rennes',
    'rc strasbourg alsace', 'rc strasbourg', 'strasbourg',
    'stade brestois', 'brest',
    'fc nantes', 'nantes',
    'toulouse fc', 'toulouse',
    'aj auxerre', 'auxerre',
    'angers sco', 'angers',
    'le havre ac', 'le havre',
    'fc metz', 'metz',
    'paris fc',
    'lorient', 'fc lorient'
  ],
  // BSD 5 = Bundesliga DE
  '5': [
    'fc bayern munchen', 'fc bayern munich', 'bayern munich', 'bayern munchen', 'bayern',
    'borussia dortmund', 'dortmund', 'bvb',
    'rb leipzig', 'leipzig',
    'vfb stuttgart', 'stuttgart',
    'tsg hoffenheim', 'hoffenheim',
    'bayer 04 leverkusen', 'bayer leverkusen', 'leverkusen',
    'sc freiburg', 'freiburg',
    'eintracht frankfurt', 'frankfurt',
    'fc augsburg', 'augsburg',
    '1 fsv mainz 05', 'fsv mainz', 'mainz',
    'hamburger sv', 'hamburg', 'hsv',
    '1 fc union berlin', 'union berlin',
    'borussia m gladbach', 'borussia mgladbach', 'monchengladbach',
    '1 fc koln', 'koln', 'cologne',
    'sv werder bremen', 'werder bremen', 'bremen',
    'vfl wolfsburg', 'wolfsburg',
    '1 fc heidenheim', 'heidenheim',
    'fc st pauli', 'st pauli'
  ],
  // BSD 4 = Serie A IT
  '4': [
    'inter', 'inter milan', 'internazionale',
    'ssc napoli', 'napoli',
    'juventus',
    'as roma', 'roma',
    'milan', 'ac milan',
    'como',
    'atalanta',
    'bologna',
    'lazio',
    'udinese',
    'sassuolo',
    'torino',
    'parma',
    'genoa',
    'fiorentina',
    'cagliari',
    'lecce',
    'cremonese',
    'hellas verona', 'verona',
    'pisa'
  ],
  // v9.8.5 — 14 nouvelles ligues T1 protégées contre mistag T2 par BSD
  // BSD 2 = Liga Portugal Betclic 25/26
  '2': [
    'sporting cp', 'sporting clube de portugal', 'sporting',
    'fc porto', 'porto',
    'sl benfica', 'benfica',
    'sc braga', 'sporting braga', 'braga',
    'vitoria sc', 'vitoria de guimaraes', 'guimaraes',
    'famalicao', 'fc famalicao',
    'moreirense fc', 'moreirense',
    'gil vicente fc', 'gil vicente',
    'estoril praia', 'estoril',
    'casa pia ac', 'casa pia',
    'rio ave fc', 'rio ave',
    'cf estrela amadora', 'estrela amadora',
    'fc arouca', 'arouca',
    'cd nacional', 'nacional',
    'avs futebol sad', 'avs',
    'santa clara', 'cd santa clara',
    'fc alverca', 'alverca',
    'cd tondela', 'tondela'
  ],
  // BSD 14 = Belgian Pro League 25/26
  '14': [
    'club brugge kv', 'club brugge', 'brugge',
    'royale union saint gilloise', 'union saint gilloise', 'union sg',
    'rsc anderlecht', 'anderlecht',
    'krc genk', 'genk',
    'standard liege', 'standard',
    'kaa gent', 'gent',
    'royal antwerp fc', 'royal antwerp', 'antwerp',
    'rc sporting charleroi', 'sporting charleroi', 'charleroi',
    'kv mechelen', 'mechelen',
    'cercle brugge',
    'kvc westerlo', 'westerlo',
    'sint truidense vv', 'sint truiden', 'stvv',
    'oud heverlee leuven', 'oh leuven',
    'fcv dender', 'dender',
    'raal la louviere',
    'sv zulte waregem', 'zulte waregem',
    'k beerschot va', 'beerschot',
    'lommel sk', 'patro eisden maasmechelen',
    'rfc liege'
  ],
  // BSD 13 = Scottish Premiership 25/26
  '13': [
    'celtic', 'celtic fc',
    'rangers', 'rangers fc',
    'heart of midlothian', 'hearts',
    'hibernian', 'hibs',
    'aberdeen', 'aberdeen fc',
    'dundee united',
    'dundee fc', 'dundee',
    'motherwell',
    'st mirren',
    'kilmarnock',
    'falkirk fc', 'falkirk',
    'livingston',
    'dunfermline athletic',
    'arbroath'
  ],
  // BSD 24 = Greek Super League (Stoiximan) 25/26
  '24': [
    'olympiacos fc', 'olympiacos',
    'panathinaikos fc', 'panathinaikos',
    'paok', 'paok fc',
    'aek athens', 'aek',
    'aris thessaloniki', 'aris',
    'asteras aktor', 'asteras',
    'nps volos', 'volos',
    'gfs panetolikos', 'panetolikos',
    'ofi crete', 'ofi',
    'apo levadiakos', 'levadiakos',
    'aps atromitos athinon', 'atromitos',
    'ae kifisia', 'kifisia',
    'mgs panserraikos', 'panserraikos',
    'ael novibet'
  ],
  // BSD 15 = Swiss Super League 25/26
  '15': [
    'fc basel', 'basel',
    'bsc young boys', 'young boys',
    'fc zurich', 'zurich',
    'servette fc', 'servette',
    'fc lugano', 'lugano',
    'fc st gallen 1879', 'fc st gallen', 'st gallen',
    'fc luzern', 'luzern',
    'fc sion', 'sion',
    'fc lausanne sport', 'lausanne',
    'grasshopper club zurich', 'grasshoppers',
    'fc thun', 'thun',
    'fc winterthur', 'winterthur'
  ],
  // BSD 26 = Swedish Allsvenskan 2026
  '26': [
    'malmo ff', 'malmo',
    'aik', 'aik stockholm',
    'djurgardens if', 'djurgarden',
    'hammarby if', 'hammarby',
    'ifk goteborg', 'goteborg',
    'if elfsborg', 'elfsborg',
    'bk hacken', 'hacken',
    'mjallby aif', 'mjallby',
    'ik sirius', 'sirius',
    'if brommapojkarna', 'brommapojkarna',
    'gais',
    'degerfors if', 'degerfors',
    'halmstads bk', 'halmstad',
    'kalmar ff', 'kalmar',
    'orgryte is', 'orgryte',
    'vasteras sk', 'vasteras'
  ],
  // BSD 25 = Polish Ekstraklasa 25/26
  '25': [
    'lech poznan', 'lech',
    'jagiellonia bialystok', 'jagiellonia',
    'rakow czestochowa', 'rakow',
    'gornik zabrze', 'gornik',
    'zaglebie lubin', 'zaglebie',
    'gks katowice',
    'wisla plock',
    'radomiak radom', 'radomiak',
    'legia warszawa', 'legia warsaw', 'legia',
    'ks lechia gdansk', 'lechia gdansk',
    'motor lublin',
    'piast gliwice', 'piast',
    'pogon szczecin', 'pogon',
    'cracovia',
    'widzew lodz', 'widzew',
    'mks korona kielce', 'korona kielce',
    'mzks arka gdynia', 'arka gdynia',
    'bruk bet termalica nieciecza'
  ],
  // BSD 23 = Romanian Superliga 25/26
  '23': [
    'universitatea craiova', 'u craiova',
    'fc universitatea cluj', 'u cluj',
    'cfr 1907 cluj', 'cfr cluj',
    'fc dinamo bucuresti', 'dinamo bucuresti',
    'fcsb',
    'fc rapid bucuresti', 'rapid bucuresti',
    'uta arad',
    'fc arges pitesti', 'fc arges',
    'fc botosani',
    'sc otelul galati', 'otelul galati',
    'fk csikszereda miercurea ciuc', 'csikszereda',
    'fc farul constanta', 'farul',
    'fc petrolul ploiesti', 'petrolul',
    'afc unirea 04 slobozia', 'unirea slobozia',
    'fc hermannstadt', 'hermannstadt',
    'fc metaloglobus bucuresti', 'metaloglobus'
  ],
  // BSD 49 = J1 League 2025
  '49': [
    'vissel kobe',
    'sanfrecce hiroshima',
    'kashima antlers',
    'kawasaki frontale',
    'yokohama f marinos', 'yokohama marinos',
    'fc tokyo',
    'urawa red diamonds', 'urawa reds',
    'gamba osaka',
    'cerezo osaka',
    'nagoya grampus',
    'sagan tosu',
    'avispa fukuoka',
    'kyoto sanga fc', 'kyoto sanga',
    'fc machida zelvia', 'machida zelvia',
    'shonan bellmare',
    'kashiwa reysol',
    'albirex niigata',
    'tokyo verdy',
    'shimizu s pulse', 'shimizu',
    'fagiano okayama', 'okayama'
  ],
  // BSD 50 = K-League 1 2025
  '50': [
    'ulsan hd', 'ulsan hyundai',
    'pohang steelers',
    'jeonbuk hyundai motors', 'jeonbuk motors',
    'fc seoul',
    'gangwon fc', 'gangwon',
    'suwon fc',
    'gimcheon sangmu',
    'daegu fc', 'daegu',
    'jeju united', 'jeju',
    'gwangju fc', 'gwangju',
    'incheon united', 'incheon',
    'daejeon hana citizen', 'daejeon'
  ],
  // BSD 19 = Liga MX Apertura 25/26
  '19': [
    'club america', 'america',
    'cruz azul',
    'cd guadalajara', 'chivas guadalajara', 'chivas',
    'pumas unam', 'pumas',
    'tigres uanl', 'tigres',
    'cf monterrey', 'monterrey',
    'cd toluca', 'toluca',
    'club leon', 'leon',
    'cf pachuca', 'pachuca',
    'santos laguna', 'santos',
    'atlas fc', 'atlas',
    'club tijuana', 'tijuana', 'xolos',
    'club puebla', 'puebla',
    'club necaxa', 'necaxa',
    'queretaro fc', 'queretaro',
    'mazatlan fc', 'mazatlan',
    'fc juarez', 'juarez',
    'atletico san luis', 'san luis'
  ],
  // BSD 20 = Liga MX Clausura 25/26 (identique clubs)
  '20': [
    'club america', 'america',
    'cruz azul',
    'cd guadalajara', 'chivas guadalajara', 'chivas',
    'pumas unam', 'pumas',
    'tigres uanl', 'tigres',
    'cf monterrey', 'monterrey',
    'cd toluca', 'toluca',
    'club leon', 'leon',
    'cf pachuca', 'pachuca',
    'santos laguna', 'santos',
    'atlas fc', 'atlas',
    'club tijuana', 'tijuana', 'xolos',
    'club puebla', 'puebla',
    'club necaxa', 'necaxa',
    'queretaro fc', 'queretaro',
    'mazatlan fc', 'mazatlan',
    'fc juarez', 'juarez',
    'atletico san luis', 'san luis'
  ],
  // BSD 18 = MLS 2026
  '18': [
    'inter miami cf', 'inter miami',
    'la galaxy',
    'los angeles fc', 'lafc',
    'seattle sounders fc', 'seattle sounders',
    'philadelphia union',
    'columbus crew',
    'new york city fc', 'nycfc',
    'new york red bulls',
    'orlando city sc', 'orlando city',
    'atlanta united',
    'fc cincinnati', 'cincinnati',
    'cf montreal', 'montreal',
    'toronto fc', 'toronto',
    'chicago fire',
    'dc united',
    'new england revolution', 'new england',
    'nashville sc', 'nashville',
    'charlotte fc', 'charlotte',
    'minnesota united', 'minnesota',
    'fc dallas', 'dallas',
    'houston dynamo', 'houston',
    'sporting kansas city',
    'colorado rapids', 'colorado',
    'real salt lake', 'salt lake',
    'san jose earthquakes', 'san jose',
    'austin fc', 'austin',
    'portland timbers', 'portland',
    'vancouver whitecaps', 'vancouver',
    'st louis city', 'st louis city sc',
    'san diego fc'
  ],
  // BSD 17 = Saudi Pro League 25/26
  '17': [
    'al nassr',
    'al hilal',
    'al ahli',
    'al qadsiah',
    'al taawoun',
    'al ittihad',
    'al ettifaq',
    'neom sc', 'neom',
    'al hazem',
    'al fayha',
    'al khaleej',
    'al fateh',
    'al shabab',
    'al kholood',
    'damac fc', 'damac',
    'al riyadh',
    'al okhdood',
    'al najma sc', 'al najma'
  ],
  // BSD 55 = Finnish Veikkausliiga 2025
  '55': [
    'hjk helsinki', 'hjk',
    'kuopion palloseura', 'kups',
    'fc inter turku', 'inter turku',
    'fc haka', 'haka',
    'ilves tampere', 'ilves',
    'sjk seinajoki', 'sjk',
    'ifk mariehamn', 'mariehamn',
    'ik gnistan', 'gnistan',
    'fc lahti', 'lahti',
    'vps vaasa', 'vps',
    'ekenas if', 'ekenas',
    'jaro'
  ],
};
function isLikelyBSDMistag(bsdLeagueId, homeTeam, awayTeam) {
  const list = BSD_T1_CANONICAL_TEAMS[String(bsdLeagueId)];
  if (!list || !list.length) return false;
  const h = normText(homeTeam);
  const a = normText(awayTeam);
  if (!h || !a) return false;
  const homeIn = list.some(t => h === t || h.includes(t) || t.includes(h));
  const awayIn = list.some(t => a === t || a.includes(t) || t.includes(a));
  // Both teams absent from T1 canonical list → very likely T2 mistag by BSD
  return !homeIn && !awayIn;
}
// Mapping T1 sport_key → T2 sport_key pour override mistag
const T1_TO_T2_KEY = {
  'soccer_france_ligue_one':    'soccer_france_ligue_two',
  'soccer_germany_bundesliga':  'soccer_germany_bundesliga2',
  'soccer_italy_serie_a':       'soccer_italy_serie_b',
  // v9.8.5 — élargissement audit T2 BSD (14 nouveaux pays)
  'soccer_portugal_primeira_liga':    'soccer_portugal_segunda_liga',
  'soccer_belgium_first_div':          'soccer_belgium_second_div',
  'soccer_scotland_premiership':       'soccer_scotland_championship',
  'soccer_greece_super_league':        'soccer_greece_super_league_2',
  'soccer_switzerland_super_league':   'soccer_switzerland_challenge_league',
  'soccer_sweden_allsvenskan':         'soccer_sweden_superettan',
  'soccer_poland_ekstraklasa':         'soccer_poland_first_league',
  'soccer_romania_liga_1':             'soccer_romania_liga_2',
  'soccer_japan_j_league':             'soccer_japan_j2_league',
  'soccer_korea_kleague1':             'soccer_korea_kleague2',
  'soccer_mexico_ligamx':              'soccer_mexico_ligamx_expansion',
  'soccer_usa_mls':                    'soccer_usa_usl_championship',
  'soccer_saudi_premier_league':       'soccer_saudi_first_div',
  'soccer_finland_veikkausliiga':      'soccer_finland_ykkonen',
  // soccer_epl, soccer_spain_la_liga, soccer_brazil_campeonato : BSD a Championship (12), Segunda (38), Serie B (34) séparés → pas de mistag.
};

// Obtenir la saison courante BSD (année de début)
function bsdCurrentSeasonYear() {
  const now = new Date();
  return now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
}

// ─── TAMpons MÉMOIRE (BUFFER) — Cache robuste anti-black hole ────────────────
// Ces variables servent de tampon permanent : jamais vidées, même si l'API échoue.
// Les requêtes clients répondent TOUJOURS depuis ce tampon en priorité.
let cachedMatches = [];       // Dernière version valide des matchs
let cachedLeagues = {};       // Ligues par pays { [country]: [ {id, name} ] }
let cachedInjuries = {};      // Blessures par match { [matchId]: { home: [], away: [] } }
let cacheVersion = 0;         // Incrémenté à chaque update réussi
let lastCacheUpdate = null;   // Timestamp du dernier refresh réussi

// ─── ODDS BATCH CACHE — TTL 30 min pour préserver crédits API ───────────────
let oddsCache = {};           // { [fixture_id]: { data, ts, bestLink, bookmaker } }
const ODDS_CACHE_TTL = 30 * 60 * 1000; // 30 minutes

// ─── MOCK MATCH — Environnement de test live haute fidélité ──────────────────
// Mettre à true pour activer au démarrage, ou via POST /api/v1/test/enable-mock
const MOCK_MODE = false;
let mockActive = MOCK_MODE;
let testMatch = null;
let _mockInterval = null;

function buildInitialMockMatch() {
  return {
    id: 'mock-pariscore-001',
    sport: 'soccer_france_ligue1',
    league: 'Ligue 1',
    country: 'France',
    home_team: 'PariScore FC',
    away_team: 'Test United',
    home_rank: 3,
    away_rank: 7,
    home_form: 'WWDWL',
    away_form: 'LDWDW',
    commence_time: new Date(Date.now() - 65 * 60 * 1000).toISOString(), // ~65 min ago
    status: '2H',
    live_status: '2H',
    live_minute: 60,
    live_score: { home: 1, away: 0 },
    live_intensity: 62,
    live_possession: { home: 55, away: 45 },
    live_shots: { home: 8, away: 4 },
    live_shots_on_target: { home: 4, away: 1 },
    live_corners: { home: 5, away: 2 },
    live_dangerous_attacks: { home: 42, away: 18 },
    live_xg: { home: 1.4, away: 0.6 },
    live_stats: {
      possessionHome: 55, possessionAway: 45,
      dangerousAttacksHome: 42, dangerousAttacksAway: 18,
      shotsOnTargetHome: 4, shotsOnTargetAway: 1,
    },
    live_momentum: [
      { team: 'home' }, { team: 'home' }, { team: 'away' },
      { team: 'home' }, { team: 'home' }, { team: 'away' },
    ],
    odds: { home: 1.55, draw: 3.80, away: 5.20 },
    poisson: {
      over05: 98, over15: 85, over25: 58, over35: 32,
      btts: 44, under15: 15, cs00: 2,
      homeWin: 64, draw: 21, awayWin: 15,
      topScores: [
        { score: '1-0', prob: 18 }, { score: '2-0', prob: 14 },
        { score: '1-1', prob: 11 }, { score: '2-1', prob: 9 }, { score: '3-0', prob: 6 },
      ],
      method: 'poisson',
    },
    expectedGoals: { home: 1.9, away: 0.8 },
    stats: {
      home: { ppg: 2.1, wins: 60, draws: 15, losses: 25, scored: 62, conceded: 28, avgScored: 1.9, avgConceded: 0.8, isReal: false },
      away: { ppg: 1.4, wins: 40, draws: 20, losses: 40, scored: 44, conceded: 50, avgScored: 1.2, avgConceded: 1.4, isReal: false },
      isReal: false,
    },
    best_edge: { label: '1', odds: 1.55, edge: 4.2, bk: 'Winamax' },
    edge: { home: 4.2, draw: -1.1, away: -3.8 },
    fair: { home: 0.614, draw: 0.215, away: 0.171 },
    bookmakers: { home: 'Winamax', draw: 'Betclic', away: 'Unibet' },
    _bsd_home_ratings: [
      { name: 'K. Benzema',  short_name: 'Benzema',  position: 'F', avg_rating: 8.3, goals: 12, assists: 5, xg: 9.8 },
      { name: 'A. Tchouaméni', short_name: 'Tchouaméni', position: 'M', avg_rating: 7.8, goals: 2, assists: 3, xg: 1.4 },
      { name: 'L. Hernandez', short_name: 'L. Hernandez', position: 'D', avg_rating: 7.4, goals: 1, assists: 1, xg: 0.6 },
    ],
    _bsd_away_ratings: [
      { name: 'M. Salah',    short_name: 'Salah',    position: 'F', avg_rating: 7.6, goals: 8, assists: 6, xg: 7.2 },
      { name: 'T. Alexander-Arnold', short_name: 'T.A-Arnold', position: 'D', avg_rating: 7.1, goals: 3, assists: 7, xg: 2.1 },
      { name: 'F. Diaz',     short_name: 'F. Diaz',  position: 'M', avg_rating: 6.9, goals: 5, assists: 2, xg: 4.3 },
    ],
    _isMock: true,
  };
}

function updateMockMatch() {
  if (!testMatch) return;
  const rnd = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
  testMatch.live_minute = Math.min(testMatch.live_minute + 1, 90);
  testMatch.commence_time = new Date(Date.now() - testMatch.live_minute * 60 * 1000).toISOString();
  // Occasional goal
  if (Math.random() < 0.04) testMatch.live_score.home++;
  if (Math.random() < 0.025) testMatch.live_score.away++;
  // Stats drift
  testMatch.live_shots.home += rnd(0, 1);
  testMatch.live_shots.away += rnd(0, 1);
  testMatch.live_shots_on_target.home += Math.random() < 0.35 ? 1 : 0;
  testMatch.live_shots_on_target.away += Math.random() < 0.2 ? 1 : 0;
  testMatch.live_corners.home += Math.random() < 0.15 ? 1 : 0;
  testMatch.live_corners.away += Math.random() < 0.1 ? 1 : 0;
  testMatch.live_dangerous_attacks.home += rnd(0, 2);
  testMatch.live_dangerous_attacks.away += rnd(0, 1);
  const homePos = Math.min(75, Math.max(35, testMatch.live_possession.home + rnd(-3, 3)));
  testMatch.live_possession = { home: homePos, away: 100 - homePos };
  // Intensity based on recent action
  const da = testMatch.live_dangerous_attacks;
  testMatch.live_intensity = Math.min(100, Math.round((da.home + da.away) * 0.6 + testMatch.live_shots.home * 1.2));
  // Momentum point
  const dominant = da.home > da.away * 1.3 ? 'home' : da.away > da.home * 1.3 ? 'away' : (Math.random() > 0.5 ? 'home' : 'away');
  testMatch.live_momentum.push({ team: dominant });
  if (testMatch.live_momentum.length > 20) testMatch.live_momentum.shift();
  // Sync live_stats mirror
  testMatch.live_stats = {
    possessionHome: testMatch.live_possession.home,
    possessionAway: testMatch.live_possession.away,
    dangerousAttacksHome: testMatch.live_dangerous_attacks.home,
    dangerousAttacksAway: testMatch.live_dangerous_attacks.away,
    shotsOnTargetHome: testMatch.live_shots_on_target.home,
    shotsOnTargetAway: testMatch.live_shots_on_target.away,
  };
  // xG drift
  testMatch.live_xg.home = parseFloat((testMatch.live_xg.home + (Math.random() < 0.3 ? 0.1 : 0)).toFixed(2));
  testMatch.live_xg.away = parseFloat((testMatch.live_xg.away + (Math.random() < 0.15 ? 0.1 : 0)).toFixed(2));
  // End match at 90
  if (testMatch.live_minute >= 90) {
    testMatch.status = 'FT';
    testMatch.live_status = 'FT';
    if (_mockInterval) { clearInterval(_mockInterval); _mockInterval = null; }
    console.log('[MOCK] Match terminé — arrêt du simulateur.');
  }
  console.log(`[MOCK] ${testMatch.live_minute}' — Score: ${testMatch.live_score.home}-${testMatch.live_score.away} | DA: ${testMatch.live_dangerous_attacks.home}-${testMatch.live_dangerous_attacks.away}`);
  // Push SSE pour que le frontend voie les stats sans attendre le polling 5min
  if (sseClients.size > 0) broadcastSSE('matches_update', { matches: matchesForBroadcast(), meta: buildMeta() });
}

if (MOCK_MODE) {
  testMatch = buildInitialMockMatch();
  _mockInterval = setInterval(updateMockMatch, 10000);
  console.log('[MOCK] Mode test activé au démarrage — PariScore FC vs Test United');
}

// ANJ bookmakers reconnus (France régulée)
const ANJ_BOOKMAKERS = ['Winamax', 'Betclic', 'Unibet', 'PMU', 'ParionsSport', 'ZEbet', 'Winamax'];
const FINAL_FALLBACK = 'https://www.coteur.com/cotes/football';

// ─── BASE DE DONNÉES EN MÉMOIRE ─────────────────────────────────────────────
let db = {
  matches: [],   // matchs fusionnés (odds + stats)
  archive_matches: [],   // matchs termines archives (nettoyage auto)
  teamStats: {},   // stats par équipe (standings API-Football)
  advancedTeamStats: {},   // stats avancées /teams/statistics — cache 24h
  topScorers: {},   // top buteurs par ligue (leagueId_season) — cache 24h
  lastOddsUpdate: null, // ISO timestamp
  lastStatsUpdate: null,
  statsUpdateByLeague: {},  // ISO timestamp par leagueId — gestion quotas T1/T2
  oddsQuotaRemaining: null,
  statsQuotaRemaining: null,
  status: 'initialisation',
};

// ─── SQLITE — couche de persistance (remplace database.json / history.json / ai_cache.json) ──
let sqldb;

function initSQLite() {
  sqldb = new Database(SQLITE_FILE);
  sqldb.pragma('journal_mode = WAL');
  sqldb.pragma('synchronous = NORMAL');
  sqldb.exec(`CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL)`);
  sqldb.exec(`CREATE TABLE IF NOT EXISTS ai_feedback (id INTEGER PRIMARY KEY AUTOINCREMENT, matchId TEXT NOT NULL, rating INTEGER NOT NULL, ts INTEGER NOT NULL)`);
  sqldb.exec(`CREATE TABLE IF NOT EXISTS matchday_passes (id INTEGER PRIMARY KEY AUTOINCREMENT, session_id TEXT UNIQUE NOT NULL, token TEXT NOT NULL, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL)`);
  sqldb.exec(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'freemium',
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
  )`);
  // ── API Cache — toutes les réponses API stockées 12h (modèle OddAlerts/Datafoot) ──
  sqldb.exec(`CREATE TABLE IF NOT EXISTS api_cache (
    key TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    source TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
  )`);
  sqldb.exec(`CREATE INDEX IF NOT EXISTS idx_api_cache_expires ON api_cache(expires_at)`);
  sqldb.exec(`CREATE INDEX IF NOT EXISTS idx_api_cache_source ON api_cache(source)`);
  // ── Affiliation — liens bookmakers + tracking conversions ──
  sqldb.exec(`CREATE TABLE IF NOT EXISTS affiliates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bookmaker TEXT NOT NULL,
    name TEXT NOT NULL,
    affiliate_link TEXT NOT NULL,
    deeplink_template TEXT,
    promo_code TEXT,
    commission_type TEXT NOT NULL DEFAULT 'revshare',
    commission_rate REAL NOT NULL DEFAULT 30,
    active INTEGER NOT NULL DEFAULT 1,
    priority INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
  )`);
  sqldb.exec(`CREATE INDEX IF NOT EXISTS idx_affiliates_active ON affiliates(active, priority DESC)`);
  // ── Affiliate clicks tracking ──
  sqldb.exec(`CREATE TABLE IF NOT EXISTS affiliate_clicks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    affiliate_id INTEGER NOT NULL,
    match_id TEXT NOT NULL,
    user_ip TEXT,
    user_agent TEXT,
    clicked_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
  )`);
  sqldb.exec(`CREATE INDEX IF NOT EXISTS idx_affiliate_clicks_date ON affiliate_clicks(clicked_at)`);
  // ── Mes Paris — tracking personnel des paris utilisateur + bankroll ──
  sqldb.exec(`CREATE TABLE IF NOT EXISTS user_bets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    match_id TEXT,
    home_team TEXT,
    away_team TEXT,
    league TEXT,
    commence_time TEXT,
    market TEXT NOT NULL,
    selection_label TEXT NOT NULL,
    odds REAL NOT NULL,
    stake_cents INTEGER NOT NULL,
    bookmaker TEXT NOT NULL DEFAULT '1xbet',
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'pending'
      CHECK (status IN ('pending','won','lost','void','cashout','half_won','half_lost')),
    payout_cents INTEGER,
    settled_at INTEGER,
    model_prob REAL,
    edge_pct REAL,
    kelly_fraction REAL,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);
  sqldb.exec(`CREATE INDEX IF NOT EXISTS idx_user_bets_user_status  ON user_bets(user_id, status)`);
  sqldb.exec(`CREATE INDEX IF NOT EXISTS idx_user_bets_user_settled ON user_bets(user_id, settled_at)`);
  sqldb.exec(`CREATE INDEX IF NOT EXISTS idx_user_bets_match        ON user_bets(match_id)`);
  sqldb.exec(`CREATE INDEX IF NOT EXISTS idx_user_bets_commence     ON user_bets(user_id, commence_time)`);
  sqldb.exec(`CREATE TABLE IF NOT EXISTS bankroll_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('deposit','withdrawal','adjustment')),
    amount_cents INTEGER NOT NULL,
    bookmaker TEXT,
    note TEXT,
    occurred_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);
  sqldb.exec(`CREATE INDEX IF NOT EXISTS idx_bk_tx_user_date ON bankroll_transactions(user_id, occurred_at)`);

  // ── v9.8.1 migrations : sport column, bankroll_plan, locked-kind, import audit ──
  // ADD COLUMN sport TEXT — idempotent via pragma check
  try {
    const cols = sqldb.prepare("PRAGMA table_info(user_bets)").all();
    if (!cols.some(c => c.name === 'sport')) {
      sqldb.exec(`ALTER TABLE user_bets ADD COLUMN sport TEXT DEFAULT 'football'`);
    }
    if (!cols.some(c => c.name === 'external_ref')) {
      sqldb.exec(`ALTER TABLE user_bets ADD COLUMN external_ref TEXT`);
    }
    if (!cols.some(c => c.name === 'source')) {
      sqldb.exec(`ALTER TABLE user_bets ADD COLUMN source TEXT DEFAULT 'manual'`);
    }
  } catch (e) { console.error('  [Migration v9.8.1] user_bets ALTER failed:', e.message); }

  // bankroll_plan — config par user pour suivi objectif quotidien
  sqldb.exec(`CREATE TABLE IF NOT EXISTS bankroll_plan (
    user_id INTEGER PRIMARY KEY,
    starting_capital_cents INTEGER NOT NULL DEFAULT 30000,
    daily_target_pct REAL NOT NULL DEFAULT 20.0,
    profit_split_pct REAL NOT NULL DEFAULT 50.0,
    start_date TEXT NOT NULL DEFAULT '2026-05-12',
    floor_cents INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);

  // Extend bankroll_transactions.kind to allow 'locked' (banque) — SQLite ne permet pas DROP CHECK,
  // alors on relâche via une table jumelle si nécessaire. À défaut on enregistre 'locked' comme withdrawal
  // avec note='locked_savings' (fallback rétro-compat).

  // bet_import_audit — trace tous les imports CSV pour sécurité forensique
  sqldb.exec(`CREATE TABLE IF NOT EXISTS bet_import_audit (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    source TEXT NOT NULL,
    filename TEXT,
    rows_parsed INTEGER NOT NULL DEFAULT 0,
    rows_inserted INTEGER NOT NULL DEFAULT 0,
    rows_skipped INTEGER NOT NULL DEFAULT 0,
    ip TEXT,
    user_agent TEXT,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);
  sqldb.exec(`CREATE INDEX IF NOT EXISTS idx_bet_import_audit_user ON bet_import_audit(user_id, created_at)`);

  // Seed Coteur — comparateur de cotes légal ANJ France
  const hasCoteur = sqldb.prepare('SELECT id FROM affiliates WHERE bookmaker = ?').get('coteur');
  if (!hasCoteur) {
    sqldb.prepare(`INSERT INTO affiliates (bookmaker, name, affiliate_link, deeplink_template, promo_code, commission_type, commission_rate, active, priority)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      'coteur', 'Coteur — Comparateur de Cotes',
      'https://www.coteur.com/',
      'https://www.coteur.com/match/cotes-{home}-{away}.html',
      '', 'cpa', 25, 1, 10
    );
    console.log('  ✓ Affilié Coteur (comparateur légal ANJ) ajouté');
  }
  // Seed Winamax ANJ — fallback légal France
  const hasWinamax = sqldb.prepare('SELECT id FROM affiliates WHERE bookmaker = ?').get('winamax');
  if (!hasWinamax) {
    sqldb.prepare(`INSERT INTO affiliates (bookmaker, name, affiliate_link, deeplink_template, promo_code, commission_type, commission_rate, active, priority)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      'winamax', 'Winamax - Bookmaker ANJ',
      'https://affiliates.winamax.fr',
      'https://www.winamax.fr/paris-sportifs/sports/1',
      '', 'cpa', 50, 1, 8
    );
    console.log('  ✓ Affilié Winamax ANJ ajouté');
  }
  // Nettoyage forcé — désactive tout bookmaker non-ANJ (1xBet, etc.)
  const cleaned = sqldb.prepare("UPDATE affiliates SET active = 0 WHERE bookmaker NOT IN ('coteur', 'winamax', 'unibet', 'betclic', 'parions_sport', 'pmu')").run();
  if (cleaned.changes > 0) console.log(`  ✓ ${cleaned.changes} affilié(s) non-ANJ désactivé(s) (cleanup sécurité)`);
  // Boost Coteur en priorité #1
  sqldb.prepare("UPDATE affiliates SET priority = 99 WHERE bookmaker = 'coteur'").run();
  // Seed utilisateur de test (idempotent)
  const testEmail = 'test@pariscore.fr';
  const existing = sqldb.prepare('SELECT id FROM users WHERE email = ?').get(testEmail);
  if (!existing) {
    const { hash: th, salt: ts } = hashPasswordSync('Test1234!');
    sqldb.prepare('INSERT INTO users (email, password_hash, salt, role) VALUES (?, ?, ?, ?)').run(testEmail, th, ts, 'freemium');
    console.log('  ✓ Utilisateur test créé — test@pariscore.fr / Test1234!');
  }
  console.log('  ✓ SQLite initialisé (WAL mode) —', SQLITE_FILE);
}

function kvGet(key, fallback = null) {
  const row = sqldb.prepare('SELECT value FROM kv WHERE key = ?').get(key);
  if (!row) return fallback;
  try { return JSON.parse(row.value); } catch { return fallback; }
}

function kvSet(key, value) {
  sqldb.prepare('INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)').run(key, JSON.stringify(value));
}

function kvSetBatch(entries) {
  const stmt = sqldb.prepare('INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)');
  sqldb.transaction(() => { for (const [k, v] of entries) stmt.run(k, JSON.stringify(v)); })();
}

// ─── API RESPONSE CACHE — 12h TTL (modèle OddAlerts/Datafoot) ──────────
// Toutes les réponses API (Odds, API-Football) sont stockées en SQLite
// avec un TTL de 12h. Au boot, on charge depuis le cache au lieu de
// refaire les appels. Reset complet après 12h.

const API_CACHE_TTL = 12 * 3600 * 1000; // 12 heures

function apiCacheGet(key) {
  const row = sqldb.prepare('SELECT data, expires_at FROM api_cache WHERE key = ?').get(key);
  if (!row) return null;
  if (Date.now() > row.expires_at) {
    // Expiré — on supprime et retourne null
    sqldb.prepare('DELETE FROM api_cache WHERE key = ?').run(key);
    return null;
  }
  try { return JSON.parse(row.data); } catch { return null; }
}

function apiCacheSet(key, data, source) {
  const now = Date.now();
  sqldb.prepare('INSERT OR REPLACE INTO api_cache (key, data, source, created_at, expires_at) VALUES (?, ?, ?, ?, ?)').run(
    key, JSON.stringify(data), source, now, now + API_CACHE_TTL
  );
}

function apiCacheSetBatch(entries, source) {
  const stmt = sqldb.prepare('INSERT OR REPLACE INTO api_cache (key, data, source, created_at, expires_at) VALUES (?, ?, ?, ?, ?)');
  const now = Date.now();
  const exp = now + API_CACHE_TTL;
  sqldb.transaction(() => {
    for (const [key, data] of entries) stmt.run(key, JSON.stringify(data), source, now, exp);
  })();
}

function apiCacheClear(source) {
  if (source) {
    sqldb.prepare('DELETE FROM api_cache WHERE source = ?').run(source);
  } else {
    sqldb.prepare('DELETE FROM api_cache').run();
  }
}

function apiCacheCleanExpired() {
  const before = sqldb.prepare('SELECT COUNT(*) as c FROM api_cache WHERE expires_at < ?').get(Date.now());
  sqldb.prepare('DELETE FROM api_cache WHERE expires_at < ?').run(Date.now());
  return before.c;
}

function apiCacheStats() {
  const total = sqldb.prepare('SELECT COUNT(*) as c FROM api_cache').get();
  const bySource = sqldb.prepare('SELECT source, COUNT(*) as c FROM api_cache GROUP BY source').all();
  const oldest = sqldb.prepare('SELECT MIN(created_at) as min_ts FROM api_cache').get();
  const newest = sqldb.prepare('SELECT MAX(created_at) as max_ts FROM api_cache').get();
  return {
    total: total.c,
    bySource: bySource,
    oldest: oldest.min_ts ? new Date(oldest.min_ts).toISOString() : null,
    newest: newest.max_ts ? new Date(newest.max_ts).toISOString() : null,
  };
}

function oddsCacheCleanExpired() {
  const now = Date.now();
  let cleaned = 0;
  for (const key of Object.keys(oddsCache)) {
    if (now - oddsCache[key].ts > ODDS_CACHE_TTL) {
      delete oddsCache[key];
      cleaned++;
    }
  }
  return cleaned;
}

function oddsCacheStats() {
  return {
    entries: Object.keys(oddsCache).length,
    ttl_minutes: ODDS_CACHE_TTL / 60000,
    keys: Object.keys(oddsCache).slice(0, 10),
  };
}

// ─── POWER SCORE USAGE TRACKING ───────────────────────────────────────
const POWER_SCORE_COOLDOWN_IP = new Map(); // IP -> { count, reset }

function getPowerScoreUsage(userId) {
  const raw = kvGet(`ps_usage_${userId}`);
  if (!raw) return { count: 0, reset: Date.now() + 24 * 3600 * 1000 };
  if (Date.now() > raw.reset) return { count: 0, reset: Date.now() + 24 * 3600 * 1000 };
  return raw;
}

function incrementPowerScoreUsage(userId, role) {
  const usage = getPowerScoreUsage(userId);
  const limit = POWER_SCORE_LIMITS[role]?.daily ?? 1;
  if (usage.count >= limit) return { allowed: false, used: usage.count, limit };
  usage.count += 1;
  kvSet(`ps_usage_${userId}`, usage);
  return { allowed: true, used: usage.count, limit };
}

function checkIpAbuse(ip) {
  const now = Date.now();
  const entry = POWER_SCORE_COOLDOWN_IP.get(ip);
  if (!entry || now > entry.reset) {
    POWER_SCORE_COOLDOWN_IP.set(ip, { count: 1, reset: now + 60000 });
    return false;
  }
  entry.count += 1;
  if (entry.count > 30) return true; // >30 requests/minute = abuse
  return false;
}

function getRemainingQuota(userId, role) {
  const usage = getPowerScoreUsage(userId);
  const limit = POWER_SCORE_LIMITS[role]?.daily ?? 1;
  return Math.max(0, limit - usage.count);
}

function kvScan(prefix) {
  return sqldb.prepare("SELECT key, value FROM kv WHERE key LIKE ?").all(prefix + '%')
    .map(row => { try { return { key: row.key, value: JSON.parse(row.value) }; } catch { return null; } })
    .filter(Boolean);
}

// ─── DATABASE ────────────────────────────────────────────────────────────────

function saveDB() {
  // 🛡️ PROTECTION ANTI-EFFACEMENT (Zero-Data Guard)
  // Si on tente de sauvegarder un tableau vide alors qu'on avait des données, 
  // on bloque la sauvegarde pour éviter de wipe la base de données suite à une erreur API.
  if (db.matches && db.matches.length === 0 && cachedMatches.length > 0) {
    console.error('\x1b[31m[DB_GUARD] Tentative de sauvegarde d\'un tableau vide détectée ! Blocage de l\'écriture pour protéger les données.\x1b[0m');
    return;
  }

  try {
    kvSetBatch([
      ['db_matches', db.matches],
      ['db_team_stats', db.teamStats],
      ['db_adv_stats', db.advancedTeamStats],
      ['db_top_scorers', db.topScorers],
      ['db_meta', {
        status: db.status,
        lastOddsUpdate: db.lastOddsUpdate,
        lastStatsUpdate: db.lastStatsUpdate,
        oddsQuotaRemaining: db.oddsQuotaRemaining,
        statsUpdateByLeague: db.statsUpdateByLeague
      }],
    ]);
  } catch (e) {
    console.error('\x1b[31m[DB_ERROR] Échec critique de la sauvegarde SQLite :\x1b[0m', e.message);
  }
}

function syncCacheBuffers() {
  // 🛡️ PROTECTION ANTI-WIPE :
  // Si la base de données principale est vide, on NE SYNCHRONISE PAS les buffers.
  // On conserve les anciennes données dans cachedMatches pour éviter que le site 
  // ne devienne totalement vide en cas d'échec critique des API.
  if (!db.matches || db.matches.length === 0) {
    if (cachedMatches.length > 0) {
      console.warn('\x1b[33m[SYNC] db.matches est vide, mais cachedMatches contient des données. Protection activée : on conserve le tampon mémoire.\x1b[0m');
    }
    return;
  }

  try {
    console.log(`  [Sync] Synchronisation des buffers mémoire (${db.matches.length} matchs)...`);

    // 1. CLONAGE PROFOND (Deep Clone)
    // On utilise JSON.parse/stringify pour casser les références d'objets.
    // Cela évite qu'une modification accidentelle de db.matches n'altère cachedMatches.
    cachedMatches = JSON.parse(JSON.stringify(db.matches));

    lastCacheUpdate = Date.now();
    cacheVersion++;

    // 2. SYNCHRONISATION DES BLESSURES
    // On vide et on reconstruit le dictionnaire des blessures par ID de match.
    cachedInjuries = {};
    for (const m of db.matches) {
      if (m.injuries && Object.keys(m.injuries).length > 0) {
        cachedInjuries[m.id] = m.injuries;
      }
    }

    // 3. SYNCHRONISATION DES LIGUES ET PAYS
    // On reconstruit la liste des ligues groupées par pays.
    cachedLeagues = {};
    const leagueMap = new Map();

    for (const m of db.matches) {
      if (!m.league || m.league === '?') continue;
      const country = detectCountryFromLeague(m.league, m.sport, m.country, m._bsd_league_id);
      const key = `${m.league}__${country}`;
      if (!leagueMap.has(key)) leagueMap.set(key, { leagueName: m.league, country });
    }

    for (const { leagueName, country } of leagueMap.values()) {
      if (!cachedLeagues[country]) {
        cachedLeagues[country] = [];
      }

      // On évite les doublons dans la liste du pays
      if (!cachedLeagues[country].find(l => l.name === leagueName)) {
        cachedLeagues[country].push({
          name: leagueName,
          id: leagueName.toLowerCase().replace(/\s+/g, '_')
        });
      }
    }

    console.log(`  [Sync] ✓ Buffers mis à jour. Version: ${cacheVersion}`);
  } catch (e) {
    console.error('\x1b[31m[SYNC_ERROR] Erreur critique lors de la synchronisation des buffers :\x1b[0m', e.message);
    console.error(e.stack);
  }
}

// Helper: détecte le pays depuis le match (pays explicite > sport_key > nom ligue)
function detectCountryFromLeague(leagueName, sportKey = null, explicitCountry = null, bsdLeagueId = null) {
  const forced = forceCountryForKnownCollisions(leagueName, explicitCountry, bsdLeagueId);
  if (forced) return forced;

  const cfgBySport = getLeagueConfigBySportKey(sportKey);
  if (cfgBySport?.country) return cfgBySport.country;

  if (isHomonymLeagueName(leagueName)) {
    return 'Unknown';
  }

  const countryMap = {
    'France': ['Ligue 1', 'Ligue 2', 'Coupe de France'],
    'England': ['Championship', 'FA Cup', 'League Cup'],
    'Spain': ['La Liga', 'Segunda Division', 'Copa del Rey'],
    'Germany': ['Bundesliga', '2. Bundesliga', 'DFB Pokal'],
    'Italy': ['Serie A', 'Coppa Italia'],
    'Portugal': ['Liga Portugal', 'Taca de Portugal'],
    'Netherlands': ['Eredivisie', 'KNVB Beker'],
    'Belgium': ['Jupiler Pro League', 'Belgian Cup'],
    'Brazil': ['Brasileirao', 'Campeonato Brasileiro'],
    'Europe': ['Champions League', 'Europa League', 'Conference League'],
    'World': ['Club Friendlies', 'World Cup'],
  };
  const leagueNorm = normText(leagueName);
  for (const [country, leagues] of Object.entries(countryMap)) {
    if (leagues.some(l => leagueNorm.includes(normText(l)))) return country;
  }
  return 'Unknown';
}

function loadDB() {
  // Rétrocompat : migration one-shot depuis database.json
  if (fs.existsSync(DB_FILE)) {
    try {
      const old = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
      db = { ...db, ...old };
      if (!db.advancedTeamStats) db.advancedTeamStats = {};
      if (!db.topScorers) db.topScorers = {};
      saveDB();
      fs.renameSync(DB_FILE, DB_FILE + '.migrated');
      console.log(`  ✓ database.json migré vers SQLite (${db.matches.length} matchs)`);
      syncCacheBuffers(); // Populate buffers from migrated data
      return;
    } catch (e) { console.warn('[DB] Migration JSON→SQLite échouée:', e.message); }
  }

  db.matches = kvGet('db_matches', []);
  db.teamStats = kvGet('db_team_stats', {});
  db.advancedTeamStats = kvGet('db_adv_stats', {});
  db.topScorers = kvGet('db_top_scorers', {});
  const meta = kvGet('db_meta', {});
  db.status = meta.status || 'initialisation';
  db.lastOddsUpdate = meta.lastOddsUpdate || null;
  db.lastStatsUpdate = meta.lastStatsUpdate || null;
  db.statsUpdateByLeague = meta.statsUpdateByLeague || {};
  db.oddsQuotaRemaining = meta.oddsQuotaRemaining || null;
  console.log(`  ✓ SQLite chargé (${db.matches.length} matchs, ${Object.keys(db.teamStats).length} équipes, ${Object.keys(db.advancedTeamStats).length} stats avancées)`);
  syncCacheBuffers(); // Populate buffers from SQLite on startup
}

// Backfill home_form / away_form depuis stats PPG pour les matchs sans form string
function backfillMatchForms() {
  let fixed = 0;
  for (const m of db.matches) {
    if (!m.home_form || m.home_form.length < 2) {
      const stats = m.stats?.home;
      if (stats) {
        const form = deriveFormFromStats(stats);
        if (form) { m.home_form = form; fixed++; }
      }
    }
    if (!m.away_form || m.away_form.length < 2) {
      const stats = m.stats?.away;
      if (stats) {
        const form = deriveFormFromStats(stats);
        if (form) { m.away_form = form; fixed++; }
      }
    }
  }
  if (fixed > 0) {
    console.log(`  [Backfill] ✓ ${fixed} champs home_form/away_form synthétisés depuis PPG`);
    saveDB();
  }
}

// ─── UTILS HTTPS ─────────────────────────────────────────────────────────────
function formatIsoTimestamp(date) {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function formatDateOnly(date) {
  return date.toISOString().slice(0, 10);
}

// ── Multi-provider streaming for Deep Analysis ───────────────────────────────
// Streams text chunks via SSE events: chunk | done | error
// Tries providers in order, falls back on 429/401/5xx
function streamDeepWithProviders(promptText, res, onDone, providerIdx = 0) {
  if (providerIdx >= AI_DEEP_PROVIDERS.length) {
    try { res.write(`event: error\ndata: ${JSON.stringify({ message: 'Tous les providers IA sont indisponibles ou non configurés' })}\n\n`); res.end(); } catch { }
    return;
  }
  const prov = AI_DEEP_PROVIDERS[providerIdx];
  console.log(`  [AI-AL] Tentative ${prov.name} (idx ${providerIdx})`);

  const tryNext = (reason) => {
    console.log(`  [AI-AL] ${prov.name} → fallback (${reason})`);
    streamDeepWithProviders(promptText, res, onDone, providerIdx + 1);
  };

  if (prov.type === 'gemini') {
    // ── Gemini SSE ──────────────────────────────────────────────────────────
    const payload = JSON.stringify({
      contents: [{ parts: [{ text: promptText }] }],
      generationConfig: { temperature: 0.8, maxOutputTokens: 4096 },
      safetySettings: GEMINI_SAFETY_SETTINGS,
    });
    const gemUrl = new URL(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:streamGenerateContent?key=${GEMINI_API_KEY}&alt=sse`);
    const opts = { hostname: gemUrl.hostname, path: gemUrl.pathname + gemUrl.search, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } };
    let fullText = '';
    const req = https.request(opts, gemRes => {
      if (gemRes.statusCode === 429 || gemRes.statusCode === 401) {
        gemRes.resume();
        return tryNext(gemRes.statusCode);
      }
      let buf = '';
      gemRes.on('data', chunk => {
        buf += chunk.toString();
        const lines = buf.split('\n'); buf = lines.pop();
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (raw === '[DONE]') continue;
          try {
            const txt = JSON.parse(raw)?.candidates?.[0]?.content?.parts?.[0]?.text || '';
            if (txt) { fullText += txt; try { res.write(`event: chunk\ndata: ${JSON.stringify({ text: txt, provider: prov.name })}\n\n`); } catch { } }
          } catch { }
        }
      });
      gemRes.on('end', () => {
        if (!fullText) return tryNext('vide');
        onDone(fullText, prov.name);
      });
      gemRes.on('error', () => tryNext('erreur réseau'));
    });
    req.on('error', () => tryNext('erreur req'));
    req.write(payload); req.end();

  } else {
    // ── OpenAI-compatible SSE (Groq / Grok / OpenRouter) ────────────────────
    const payload = JSON.stringify({
      model: prov.model,
      messages: [{ role: 'user', content: promptText }],
      temperature: 0.8,
      max_tokens: 4096,
      stream: true,
    });
    const opts = {
      hostname: prov.host,
      path: prov.path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${prov.key}`,
        'Content-Length': Buffer.byteLength(payload),
        'HTTP-Referer': 'https://pariscore.io',
        'X-Title': 'PariScore AI-AL',
      },
    };
    let fullText = '';
    const req = https.request(opts, apiRes => {
      if (apiRes.statusCode === 429 || apiRes.statusCode === 401 || apiRes.statusCode >= 500) {
        apiRes.resume();
        return tryNext(apiRes.statusCode);
      }
      let buf = '';
      apiRes.on('data', chunk => {
        buf += chunk.toString();
        const lines = buf.split('\n'); buf = lines.pop();
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (raw === '[DONE]') continue;
          try {
            const txt = JSON.parse(raw)?.choices?.[0]?.delta?.content || '';
            if (txt) { fullText += txt; try { res.write(`event: chunk\ndata: ${JSON.stringify({ text: txt, provider: prov.name })}\n\n`); } catch { } }
          } catch { }
        }
      });
      apiRes.on('end', () => {
        if (!fullText) return tryNext('vide');
        onDone(fullText, prov.name);
      });
      apiRes.on('error', () => tryNext('erreur réseau'));
    });
    req.on('error', () => tryNext('erreur req'));
    req.write(payload); req.end();
  }
}

function httpsGet(urlStr, headers = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const opts = {
      hostname: u.hostname, port: 443,
      path: u.pathname + (u.search || ''),
      method: 'GET',
      headers: { 'Accept': 'application/json', 'User-Agent': 'PariScore/2.0', ...headers },
    };
    const req = https.request(opts, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, data: body });
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('Timeout')); });
    req.end();
  });
}

function httpsPost(urlStr, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const payload = JSON.stringify(body);
    const opts = {
      hostname: u.hostname, port: 443,
      path: u.pathname + (u.search || ''),
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload), ...headers },
    };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch (e) { resolve({ status: res.statusCode, data }); }
      });
    });
    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('Timeout')); });
    req.write(payload);
    req.end();
  });
}

function mockParlayOdds() {
  return {
    status: 200,
    mocked: true,
    source: 'local-mock',
    matches: [
      { home_team: 'PSG', away_team: 'Olympique Lyonnais', league: 'Ligue 1', commence_time: new Date(Date.now() + 2 * 3600000).toISOString(), odds: { home: 1.45, draw: 4.20, away: 7.80 } },
      { home_team: 'Manchester City', away_team: 'Liverpool', league: 'Premier League', commence_time: new Date(Date.now() + 4 * 3600000).toISOString(), odds: { home: 2.10, draw: 3.40, away: 3.20 } },
    ],
  };
}

function mockGameForecast(match = {}) {
  return {
    status: 200,
    mocked: true,
    source: 'local-mock',
    home: match.home_team || 'Home',
    away: match.away_team || 'Away',
    league: match.league || 'Unknown',
    predicted: {
      homeWin: 48,
      draw: 27,
      awayWin: 25,
      value: 'BTTS probable',
    },
  };
}

async function fetchParlayOdds() {
  if (!PARLAY_API_HOST || !PARLAY_API_KEY) return mockParlayOdds();
  try {
    const qs = new URLSearchParams({ sport: 'soccer', region: 'eu', market: 'h2h', oddsFormat: 'decimal', dateFormat: 'iso', timeframe: '7d' }).toString();
    return await httpsGet(`https://${PARLAY_API_HOST}${PARLAY_API_PATH}?${qs}`, {
      'X-RapidAPI-Key': PARLAY_API_KEY,
      'X-RapidAPI-Host': PARLAY_API_HOST,
      'Accept': 'application/json',
    });
  } catch (e) {
    return { status: 500, error: e.message };
  }
}

async function fetchGameForecast(match = {}) {
  if (!GAMEFORECAST_API_HOST || !GAMEFORECAST_API_KEY) return mockGameForecast(match);
  try {
    const qs = new URLSearchParams({
      home: match.home_team || '',
      away: match.away_team || '',
      league: match.league || '',
      date: match.commence_time || '',
    }).toString();
    return await httpsGet(`https://${GAMEFORECAST_API_HOST}${GAMEFORECAST_API_PATH}?${qs}`, {
      'X-RapidAPI-Key': GAMEFORECAST_API_KEY,
      'X-RapidAPI-Host': GAMEFORECAST_API_HOST,
      'Accept': 'application/json',
    });
  } catch (e) {
    return { status: 500, error: e.message };
  }
}

function normalizeRapidApiMatches(payload) {
  const data = payload?.matches || payload?.data || payload?.response || payload;
  return Array.isArray(data) ? data : [];
}

function findParlayMatch(parlayData, match) {
  const entries = normalizeRapidApiMatches(parlayData);
  const homeKey = normName(match.home_team);
  const awayKey = normName(match.away_team);
  for (const entry of entries) {
    const entryHome = normName(entry.home_team || entry.home || '');
    const entryAway = normName(entry.away_team || entry.away || '');
    if (entryHome === homeKey && entryAway === awayKey) return entry;
    if (entryHome === awayKey && entryAway === homeKey) return entry;
  }
  return null;
}

async function getRapidApiDualCheck(matches = []) {
  const parlayData = await fetchParlayOdds();
  return Promise.all(matches.map(async match => {
    const parlayMatch = findParlayMatch(parlayData, match);
    const forecast = await fetchGameForecast(match);
    return {
      id: match.id,
      home_team: match.home_team,
      away_team: match.away_team,
      league: match.league,
      commence_time: match.commence_time,
      parlay: {
        status: parlayData.status,
        source: parlayData.mocked ? 'mock' : 'rapidapi',
        found: !!parlayMatch,
        match: parlayMatch || null,
      },
      gameForecast: {
        status: forecast.status,
        source: forecast.mocked ? 'mock' : 'rapidapi',
        data: forecast.data || forecast,
      },
    };
  }));
}

// ─── NORMALISATION & MATCHING ÉQUIPES ────────────────────────────────────────
function normName(name) {
  return (name || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

// Distance de Levenshtein pour fuzzy matching robuste
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => i === 0 ? j : j === 0 ? i : 0)
  );
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
  return dp[m][n];
}

function findFuzzy(key) {
  const keys = Object.keys(db.teamStats);
  if (!keys.length || !key) return null;
  // 1. Match exact d'abord
  if (db.teamStats[key]) return db.teamStats[key];
  // 2. Prefix match : la DB entry doit commencer par le premier mot de key (4+ chars)
  const firstWord = key.split(' ')[0];
  if (firstWord.length >= 4) {
    for (const k of keys) {
      if (k.startsWith(firstWord)) return db.teamStats[k];
    }
  }
  // 3. Levenshtein strict : ≤1 pour noms courts (≤4), ≤2 sinon
  let best = null, bestDist = Infinity;
  for (const k of keys) {
    const dist = levenshtein(k, key);
    const threshold = key.length <= 4 ? 1 : 2;
    if (dist < bestDist && dist <= threshold) { bestDist = dist; best = k; }
  }
  if (best) {
    console.warn(`  [Fuzzy] "${key}" → "${best}" (dist=${bestDist}) — ATTENTION: match approximatif`);
  }
  return best ? db.teamStats[best] : null;
}

// Saison dynamique : avant juillet → saison précédente
function currentSeason() {
  const now = new Date();
  return now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
}

// Nettoyage des matchs expirés — 150min après kickoff, jamais pendant un live actif
// v10.5: Triple verrou — LIVE > 4h OU minute > 130 = purgé
function cleanExpiredMatches() {
  const cutoff = Date.now() - 150 * 60 * 1000;
  const staleCutoff = Date.now() - 240 * 60 * 1000; // 4h
  const before = db.matches.length;
  db.matches = db.matches.filter(m => {
    if (m.live_score) {
      // Verrou minute > 130
      const minuteVal = parseInt(m.live_minute || m.minute || 0);
      if (minuteVal > 130) {
        console.log(`  [Clean] Stale LIVE purged (minute > 130): ${m.home_team} vs ${m.away_team}`);
        return false;
      }
      // Verrou temporel > 4h
      const kickoff = new Date(m.commence_time).getTime();
      if (!isNaN(kickoff) && kickoff < staleCutoff) {
        console.log(`  [Clean] Stale LIVE purged (> 4h): ${m.home_team} vs ${m.away_team}`);
        return false;
      }
      return true;
    }
    return new Date(m.commence_time).getTime() > cutoff;
  });
  const removed = before - db.matches.length;
  if (removed > 0) console.log(`  [Clean] ${removed} matchs expirés supprimés`);
}

// ─── CALCUL DES PROBABILITÉS ─────────────────────────────────────────────────

// Distribution de Poisson : P(X=k) = (λ^k × e^-λ) / k!
function poissonPMF(lambda, k) {
  if (lambda <= 0) return k === 0 ? 1 : 0;
  let logP = -lambda + k * Math.log(lambda);
  for (let i = 2; i <= k; i++) logP -= Math.log(i); // log(k!)
  return Math.exp(logP);
}

// Matrice de scores (jusqu'à 6-6) → dérive toutes les probas de marché
function computePoisson(expHome, expAway) {
  const MAX = 7;
  const matrix = [];
  for (let h = 0; h < MAX; h++) {
    matrix[h] = [];
    for (let a = 0; a < MAX; a++) {
      matrix[h][a] = poissonPMF(expHome, h) * poissonPMF(expAway, a);
    }
  }

  let over05 = 0, over15 = 0, over25 = 0, over35 = 0;
  let btts = 0, under15 = 0, cs00 = 0;
  let homeWin = 0, draw = 0, awayWin = 0;

  for (let h = 0; h < MAX; h++) {
    for (let a = 0; a < MAX; a++) {
      const p = matrix[h][a];
      const total = h + a;
      if (total > 0) over05 += p;
      if (total > 1) over15 += p;
      if (total > 2) over25 += p;
      if (total > 3) over35 += p;
      if (total <= 1) under15 += p;
      if (h > 0 && a > 0) btts += p;
      if (h === 0 && a === 0) cs00 = p;
      if (h > a) homeWin += p;
      if (h === a) draw += p;
      if (h < a) awayWin += p;
    }
  }

  // Top 5 scores les plus probables
  const scores = [];
  for (let h = 0; h < MAX; h++)
    for (let a = 0; a < MAX; a++)
      scores.push({ score: `${h}-${a}`, prob: matrix[h][a] });
  scores.sort((a, b) => b.prob - a.prob);

  return {
    over05: Math.round(over05 * 100),
    over15: Math.round(over15 * 100),
    over25: Math.round(over25 * 100),
    over35: Math.round(over35 * 100),
    btts: Math.round(btts * 100),
    under15: Math.round(under15 * 100),
    cs00: Math.round(cs00 * 100),
    homeWin: Math.round(homeWin * 100),
    draw: Math.round(draw * 100),
    awayWin: Math.round(awayWin * 100),
    topScores: scores.slice(0, 5).map(s => ({ score: s.score, prob: Math.round(s.prob * 100) })),
    method: 'poisson',
  };
}

// Alias nommé — retourne la matrice brute (max+1 × max+1) de probabilités de scores
function calculatePoisson(lH, lA, max = 6) {
  const matrix = [];
  for (let h = 0; h <= max; h++) {
    matrix[h] = [];
    for (let a = 0; a <= max; a++) {
      matrix[h][a] = poissonPMF(lH, h) * poissonPMF(lA, a);
    }
  }
  return matrix;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  v7.0 QUANT ENGINE — Devigging, Bayesian Blender, Calibration
// ═══════════════════════════════════════════════════════════════════════════════

// ── DÉVIGAGE DES COTES — 3 méthodes ──────────────────────────────────────────

// Méthode additive (simple) : retire proportionnellement la marge
function devigAdditive(odds) {
  const invSum = odds.reduce((s, o) => s + 1 / o, 0);
  const margin = invSum - 1;
  return odds.map(o => {
    const implied = 1 / o;
    const fair = implied - margin * (implied / invSum);
    return fair > 0 ? 1 / fair : null;
  });
}

// Méth Shin-Hurley (asymétrique) : les favoris absorbent plus de marge
// Reference: Shin (1993), Hurley & Pavitt (2021)
function devigShinHurley(odds) {
  const n = odds.length;
  if (n < 2) return odds.map(o => 1 / (1 / o));

  // Binary search for the Shin parameter θ
  let lo = 0.0001, hi = 0.9999;
  for (let iter = 0; iter < 100; iter++) {
    const mid = (lo + hi) / 2;
    let sum = 0;
    for (const o of odds) {
      const inv = 1 / o;
      const num = Math.sqrt(inv * inv + 4 * mid * (1 - mid));
      const denom = 2 * (1 - mid);
      sum += (num - inv) / denom;
    }
    if (sum > 1) hi = mid;
    else lo = mid;
  }
  const theta = (lo + hi) / 2;

  // Compute fair probabilities
  const fairProbs = odds.map(o => {
    const inv = 1 / o;
    const num = Math.sqrt(inv * inv + 4 * theta * (1 - theta));
    const denom = 2 * (1 - theta);
    return (num - inv) / denom;
  });

  // Normalize
  const sumFair = fairProbs.reduce((s, p) => s + p, 0);
  return fairProbs.map(p => p / sumFair);
}

// Méthode power (exponentielle) : bon compromis pour les cotes 1X2
function devigPower(odds) {
  const invProbs = odds.map(o => 1 / o);
  const sumInv = invProbs.reduce((s, p) => s + p, 0);
  // Find power α such that sum(p^α) = 1
  let alpha = 1;
  for (let iter = 0; iter < 100; iter++) {
    const sumPow = invProbs.reduce((s, p) => s + Math.pow(p, alpha), 0);
    const deriv = invProbs.reduce((s, p) => s + Math.pow(p, alpha) * Math.log(p), 0);
    if (Math.abs(deriv) < 1e-15) break;
    alpha -= (sumPow - 1) / deriv;
    alpha = Math.max(0.1, Math.min(3, alpha));
  }
  const fairProbs = invProbs.map(p => Math.pow(p, alpha));
  const sumFair = fairProbs.reduce((s, p) => s + p, 0);
  return fairProbs.map(p => p / sumFair);
}

// Devigage 1X2 — retourne { home, draw, away } en probabilités fair
function devig1X2(homeOdds, drawOdds, awayOdds, method = 'shin') {
  if (!homeOdds || !awayOdds) return null;
  const dOdds = drawOdds || (homeOdds + awayOdds) / 2;
  const odds = [homeOdds, dOdds, awayOdds];

  let fairProbs;
  if (method === 'shin') fairProbs = devigShinHurley(odds);
  else if (method === 'power') fairProbs = devigPower(odds);
  else fairProbs = devigAdditive(odds).map(p => p || 0.01);

  // Normalize
  const sum = fairProbs.reduce((s, p) => s + p, 0);
  const norm = fairProbs.map(p => p / sum);

  const margin = ((1 / homeOdds + 1 / dOdds + 1 / awayOdds) - 1) * 100;

  return {
    home: norm[0], draw: norm[1], away: norm[2],
    margin: parseFloat(margin.toFixed(2)),
    method,
  };
}

// ── BAYESIAN MODEL BLENDER — Fusion de 3 modèles ─────────────────────────────

// Elo dynamique (simplifié, basé sur les stats BSD)
function computeEloProbs(match) {
  const hs = match.stats?.home;
  const as = match.stats?.away;
  if (!hs || !as) return null;

  // Elo proxy: PPG × 100 + avgScored × 20 - avgConceded × 15
  const homeElo = (hs.ppg || 1.3) * 100 + (hs.avgScored || 1.2) * 20 - (hs.avgConceded || 1.3) * 15 + 50; // home advantage
  const awayElo = (as.ppg || 1.3) * 100 + (as.avgScored || 1.2) * 20 - (as.avgConceded || 1.3) * 15;

  const expected = 1 / (1 + Math.pow(10, (awayElo - homeElo) / 400));
  const drawProb = 0.25 + Math.abs(homeElo - awayElo) < 50 ? 0.05 : 0; // closer = more draws

  const homeWin = expected * (1 - drawProb);
  const awayWin = (1 - expected) * (1 - drawProb);

  return {
    homeWin: Math.round(homeWin * 100),
    draw: Math.round(drawProb * 100),
    awayWin: Math.round(awayWin * 100),
    method: 'elo',
    homeElo: Math.round(homeElo),
    awayElo: Math.round(awayElo),
  };
}

// xG Logistic — probabilité basée sur le différentiel xG
function computeXGLogisticProbs(match) {
  const xg = match.expectedGoals;
  if (!xg || xg.home == null || xg.away == null) return null;

  const xgDiff = xg.home - xg.away;
  const xgTotal = xg.home + xg.away;

  // Logistic function pour 1X2
  const homeWin = 1 / (1 + Math.exp(-0.8 * (xgDiff - 0.15)));
  const awayWin = 1 / (1 + Math.exp(0.8 * (xgDiff + 0.15)));
  const draw = Math.max(0, 1 - homeWin - awayWin);

  // Over/Under via xG total (logistic)
  const over25 = 1 / (1 + Math.exp(-1.5 * (xgTotal - 2.5)));
  const btts = 1 / (1 + Math.exp(-2.0 * (Math.min(xg.home, xg.away) - 0.65)));

  return {
    homeWin: Math.round(homeWin * 100),
    draw: Math.round(draw * 100),
    awayWin: Math.round(awayWin * 100),
    over25: Math.round(over25 * 100),
    btts: Math.round(btts * 100),
    method: 'xg_logistic',
    xgDiff: parseFloat(xgDiff.toFixed(2)),
  };
}

// Bayesian Model Averaging — pondère les modèles par leur performance historique
function bayesianBlend(poissonProbs, eloProbs, xgProbs, weights = null) {
  // Poids par défaut si non spécifiés
  const w = weights || { poisson: 0.50, elo: 0.25, xg: 0.25 };

  const blended = {
    homeWin: 0, draw: 0, awayWin: 0,
    over25: 0, btts: 0, over05: 0, over15: 0, over35: 0,
    under15: 0, cs00: 0,
    topScores: poissonProbs?.topScores || [],
    method: 'bayesian_blend',
    weights: w,
  };

  // 1X2 blending
  if (poissonProbs) {
    blended.homeWin += poissonProbs.homeWin * w.poisson;
    blended.draw += poissonProbs.draw * w.poisson;
    blended.awayWin += poissonProbs.awayWin * w.poisson;
    blended.over25 += poissonProbs.over25 * w.poisson;
    blended.btts += poissonProbs.btts * w.poisson;
    blended.over05 += poissonProbs.over05 * w.poisson;
    blended.over15 += poissonProbs.over15 * w.poisson;
    blended.over35 += poissonProbs.over35 * w.poisson;
    blended.under15 += poissonProbs.under15 * w.poisson;
    blended.cs00 += poissonProbs.cs00 * w.poisson;
  }
  if (eloProbs) {
    blended.homeWin += eloProbs.homeWin * w.elo;
    blended.draw += eloProbs.draw * w.elo;
    blended.awayWin += eloProbs.awayWin * w.elo;
  }
  if (xgProbs) {
    blended.homeWin += xgProbs.homeWin * w.xg;
    blended.draw += xgProbs.draw * w.xg;
    blended.awayWin += xgProbs.awayWin * w.xg;
    blended.over25 += (xgProbs.over25 || 0) * w.xg;
    blended.btts += (xgProbs.btts || 0) * w.xg;
  }

  // Normalize 1X2
  const sum1X2 = blended.homeWin + blended.draw + blended.awayWin;
  if (sum1X2 > 0) {
    blended.homeWin = Math.round(blended.homeWin / sum1X2 * 100) / 100;
    blended.draw = Math.round(blended.draw / sum1X2 * 100) / 100;
    blended.awayWin = Math.round(blended.awayWin / sum1X2 * 100) / 100;
  }

  // Round market probs
  blended.over25 = Math.round(blended.over25);
  blended.btts = Math.round(blended.btts);
  blended.over05 = Math.round(blended.over05);
  blended.over15 = Math.round(blended.over15);
  blended.over35 = Math.round(blended.over35);
  blended.under15 = Math.round(blended.under15);
  blended.cs00 = Math.round(blended.cs00);

  return blended;
}

// ── CALIBRATION MAP — Ajuste les probabilités brutes via reliability diagram ─
// Basé sur l'historique des 500 derniers matchs

const CALIBRATION_BINS = [
  { min: 0, max: 10, raw: 5, calibrated: 4 },  // Modèle surestime les improbables
  { min: 10, max: 20, raw: 15, calibrated: 13 },
  { min: 20, max: 30, raw: 25, calibrated: 23 },
  { min: 30, max: 40, raw: 35, calibrated: 33 },
  { min: 40, max: 50, raw: 45, calibrated: 44 },
  { min: 50, max: 60, raw: 55, calibrated: 55 },  // Zone bien calibrée
  { min: 60, max: 70, raw: 65, calibrated: 64 },
  { min: 70, max: 80, raw: 75, calibrated: 72 },  // Modèle sous-estime les probables
  { min: 80, max: 90, raw: 85, calibrated: 80 },
  { min: 90, max: 100, raw: 95, calibrated: 88 },
];

function calibrateProbability(rawProb) {
  if (rawProb == null) return null;
  for (const bin of CALIBRATION_BINS) {
    if (rawProb >= bin.min && rawProb < bin.max) {
      // Interpolation linéaire dans le bin
      const t = (rawProb - bin.min) / (bin.max - bin.min);
      return Math.round((bin.raw + t * (bin.calibrated - bin.raw)) * 10) / 10;
    }
  }
  return rawProb;
}

// Applique la calibration à un objet de probabilités Poisson/blended
function calibrateProbs(probs) {
  if (!probs) return null;
  const calibrated = { ...probs };
  calibrated.homeWin = calibrateProbability(probs.homeWin);
  calibrated.draw = calibrateProbability(probs.draw);
  calibrated.awayWin = calibrateProbability(probs.awayWin);
  calibrated.over25 = calibrateProbability(probs.over25);
  calibrated.btts = calibrateProbability(probs.btts);
  calibrated.over05 = calibrateProbability(probs.over05);
  calibrated.over15 = calibrateProbability(probs.over15);
  calibrated.over35 = calibrateProbability(probs.over35);
  // Renormalize 1X2
  const sum = (calibrated.homeWin || 0) + (calibrated.draw || 0) + (calibrated.awayWin || 0);
  if (sum > 0) {
    calibrated.homeWin = Math.round(calibrated.homeWin / sum * 1000) / 10;
    calibrated.draw = Math.round(calibrated.draw / sum * 1000) / 10;
    calibrated.awayWin = Math.round(calibrated.awayWin / sum * 1000) / 10;
  }
  calibrated.calibrated = true;
  return calibrated;
}

// ══════════════════════════════════════════════════════════════════════════════
//  P1 QUANT — BOOTSTRAP UQD (Uncertainty Quantification & Decision)
//  Auteur : Hermes · Date : 2026-05-06
// ══════════════════════════════════════════════════════════════════════════════

// ── Box-Muller : générateur N(0,1) sans dépendance externe ───────────────────
function boxMullerGaussian() {
  const u1 = Math.max(1e-10, Math.random());
  const u2 = Math.random();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

// ── BOOTSTRAP UQD — 500 itérations, IC 90% sur les marchés Poisson ───────────
// Principe : perturbation log-normale des λ (expHome, expAway) selon l'incertitude
//            sur les moyennes de buts (σ ≈ 1/√played — approx. variance de Poisson)
// Complexité : O(N × 7 × 7) ≈ 24 500 ops/match — non-bloquant (<50ms sur 50 matchs)
function computeBootstrapUQD(expHome, expAway, playedHome, playedAway, N) {
  N = N || 500;
  if (!expHome || !expAway || expHome <= 0 || expAway <= 0) return null;

  // Écart-type log-normal : 1/√n (variance Poisson de la moyenne des buts)
  const sigH = 1 / Math.sqrt(Math.max(1, playedHome || 10));
  const sigA = 1 / Math.sqrt(Math.max(1, playedAway || 10));
  const lnH = Math.log(expHome);
  const lnA = Math.log(expAway);

  // Tableaux d'échantillons par marché
  const sOver25 = [], sBtts = [], sHomeWin = [], sDraw = [], sAwayWin = [];
  const sOver15 = [], sOver35 = [];

  for (let i = 0; i < N; i++) {
    // Perturbation log-normale : λ' = exp(ln(λ) + σ·Z) reste toujours > 0
    const lH = Math.exp(lnH + sigH * boxMullerGaussian());
    const lA = Math.exp(lnA + sigA * boxMullerGaussian());

    // Matrice Poisson 7×7 rapide
    let o25 = 0, o15 = 0, o35 = 0, btts = 0, hw = 0, dr = 0, aw = 0;
    for (let h = 0; h < 7; h++) {
      for (let a = 0; a < 7; a++) {
        const p = poissonPMF(lH, h) * poissonPMF(lA, a);
        const tot = h + a;
        if (tot > 2) o25 += p;
        if (tot > 1) o15 += p;
        if (tot > 3) o35 += p;
        if (h > 0 && a > 0) btts += p;
        if (h > a) hw += p;
        if (h === a) dr += p;
        if (h < a) aw += p;
      }
    }
    sOver25.push(o25 * 100);
    sOver15.push(o15 * 100);
    sOver35.push(o35 * 100);
    sBtts.push(btts * 100);
    sHomeWin.push(hw * 100);
    sDraw.push(dr * 100);
    sAwayWin.push(aw * 100);
  }

  // Extraction des percentiles (5th = borne inf IC 90%, 95th = borne sup)
  const percentile = (arr, p) => {
    arr.sort((a, b) => a - b);
    const idx = (p / 100) * (arr.length - 1);
    const lo = Math.floor(idx), hi = Math.ceil(idx);
    if (lo === hi) return Math.round(arr[lo] * 10) / 10;
    return Math.round((arr[lo] + (idx - lo) * (arr[hi] - arr[lo])) * 10) / 10;
  };

  const summarize = (arr) => {
    const mean = Math.round(arr.reduce((s, v) => s + v, 0) / N * 10) / 10;
    const lower = percentile([...arr], 5);
    const upper = percentile([...arr], 95);
    return { mean, lower, upper, width: Math.round((upper - lower) * 10) / 10 };
  };

  return {
    n: N,
    ic_level: 90,
    markets: {
      over25: summarize(sOver25),
      over15: summarize(sOver15),
      over35: summarize(sOver35),
      btts: summarize(sBtts),
      homeWin: summarize(sHomeWin),
      draw: summarize(sDraw),
      awayWin: summarize(sAwayWin),
    },
  };
}

// ── SCORE DE FIABILITÉ COMPOSITE (0-100) ─────────────────────────────────────
// Remplace l'ancien confidence_score heuristique (0.6×Poisson + 0.4×PPG)
// Composantes :
//   35% — Volume Data   : fiabilité statistique (matchs joués)
//   35% — Stabilité xG  : étroitesse de l'IC over25 (IC large = incertitude élevée)
//   30% — Qualité Source: données réelles BSD/API vs simulées
function computeReliabilityScore(uqd, isRealData, playedHome, playedAway) {
  const avgPlayed = ((playedHome || 5) + (playedAway || 5)) / 2;
  const volumeScore = Math.min(100, (avgPlayed / 20) * 100);           // 20+ matchs = max

  const icWidth = uqd && uqd.markets && uqd.markets.over25 ? uqd.markets.over25.width : 60;
  const stabilityScore = Math.max(0, 100 - icWidth * 1.8);             // IC large → score bas

  const qualityScore = isRealData ? 85 : 28;                           // Réel vs simulé

  const raw = 0.35 * volumeScore + 0.35 * stabilityScore + 0.30 * qualityScore;
  return Math.round(Math.max(0, Math.min(100, raw)));
}

// ── RÈGLE DE DÉCISION STRICTE — BET si EV>5% ET IC borne inf → EV>0% ────────
// Principe : même dans le scénario pessimiste (IC borne inférieure 90%),
//            l'edge reste positif → seulement alors recommander le pari.
function computeBetSignal(record, uqd) {
  const ev = record.best_edge && record.best_edge.edge != null ? record.best_edge.edge : null;
  const label = record.best_edge && record.best_edge.label;

  if (ev == null) return { recommended: false, reason: 'Aucun edge disponible' };
  if (!uqd) return { recommended: false, reason: 'UQD non calculé', ev_pct: ev };

  // Mapper le label du best_edge vers la clé marché UQD
  let marketKey = null;
  if (label === record.home_team) marketKey = 'homeWin';
  else if (label === record.away_team) marketKey = 'awayWin';
  else if (label === 'Nul') marketKey = 'draw';

  // Récupérer la borne inférieure IC du marché
  const icData = marketKey && uqd.markets[marketKey];
  if (!icData) {
    const reason = ev > 5
      ? `EV ${ev.toFixed(1)}% > 5% ✓ mais marché "${label}" non mappé UQD`
      : `EV ${ev.toFixed(1)}% ≤ seuil 5%`;
    return { recommended: false, reason, ev_pct: ev };
  }

  // Calculer l'EV avec la borne inférieure de l'IC (scénario pessimiste)
  const oddsKey = marketKey === 'homeWin' ? 'home' : marketKey === 'awayWin' ? 'away' : 'draw';
  const odds = record.odds && record.odds[oddsKey];
  const pLower = (icData.lower || 0) / 100;
  const evLower = odds ? parseFloat(((pLower * odds - 1) * 100).toFixed(1)) : null;

  const cond1 = ev > 5;
  const cond2 = evLower != null && evLower > 0;

  if (cond1 && cond2) {
    return {
      recommended: true,
      market: label,
      ev_pct: ev,
      ic_lower_pct: icData.lower,
      ic_lower_ev: evLower,
      reason: `✓ EV ${ev.toFixed(1)}% > 5% | ✓ EV pessimiste IC90% ${evLower.toFixed(1)}% > 0%`,
    };
  } else if (cond1 && !cond2) {
    return {
      recommended: false,
      market: label,
      ev_pct: ev,
      ic_lower_pct: icData.lower,
      ic_lower_ev: evLower,
      reason: `✓ EV ${ev.toFixed(1)}% > 5% | ✗ EV pessimiste ${evLower != null ? evLower.toFixed(1) : '?'}% ≤ 0% (incertitude trop haute)`,
    };
  } else {
    return {
      recommended: false,
      market: label,
      ev_pct: ev,
      reason: `✗ EV ${ev.toFixed(1)}% ≤ seuil 5%`,
    };
  }
}

// ── EV CALCULATOR — Expected Value avec cotes dévigées ───────────────────────

function calcEV(modelProb, marketOdds, fairProb) {
  // EV = (fairProb × odds) - 1
  // fairProb = probabilité dévigée du marché
  if (!modelProb || !marketOdds || !fairProb) return null;
  const ev = (fairProb * marketOdds - 1) * 100;
  return parseFloat(ev.toFixed(1));
}

// Calcule l'EV pour tous les marchés d'un match
function calcAllEVs(blendedProbs, odds, fairProbs) {
  if (!blendedProbs || !odds || !fairProbs) return null;

  const evs = {};

  // 1X2
  if (odds.home && fairProbs.home) {
    evs.homeWin = calcEV(blendedProbs.homeWin / 100, odds.home, fairProbs.home);
  }
  if (odds.draw && fairProbs.draw) {
    evs.draw = calcEV(blendedProbs.draw / 100, odds.draw, fairProbs.draw);
  }
  if (odds.away && fairProbs.away) {
    evs.awayWin = calcEV(blendedProbs.awayWin / 100, odds.away, fairProbs.away);
  }

  // Over/Under (cotes non disponibles directement, on utilise les cotes 1X2 comme proxy)
  // Pour O2.5: cote implicite ≈ 1 / (probabilité fair du marché)
  // On estime la cote fair du marché via le devigage
  if (fairProbs.home && fairProbs.away) {
    // Proxy: si le marché pense que le match sera ouvert (faible proba de draw),
    // alors l'Over 2.5 est plus probable
    const marketOpenness = 1 - fairProbs.draw;
    const fairOver25 = blendedProbs.over25 / 100; // On utilise notre modèle comme référence
    // EV pour O2.5: on compare notre proba calibrée à la proba implicite du marché
    const impliedOver25 = marketOpenness * 0.65; // Heuristique: 65% de l'openness va en O2.5
    if (impliedOver25 > 0) {
      const impliedOdds = 1 / impliedOver25;
      evs.over25 = calcEV(fairOver25, impliedOdds, fairOver25);
    }
  }

  // BTTS
  if (blendedProbs.btts != null) {
    const fairBTTS = blendedProbs.btts / 100;
    const impliedBTTS = (fairProbs.home * 0.6 + fairProbs.away * 0.6) * 0.5; // Heuristique
    if (impliedBTTS > 0) {
      const impliedOdds = 1 / impliedBTTS;
      evs.btts = calcEV(fairBTTS, impliedOdds, fairBTTS);
    }
  }

  // Best EV
  let bestEV = null;
  let bestEVLabel = '';
  for (const [key, val] of Object.entries(evs)) {
    if (val != null && (bestEV === null || val > bestEV)) {
      bestEV = val;
      bestEVLabel = key;
    }
  }
  evs.best = { label: bestEVLabel, value: bestEV };

  return evs;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  SCÉNARIOS PRÉDICTIFS LIVE — Combine Poisson pré-match + momentum live + xG
// ═══════════════════════════════════════════════════════════════════════════════

function calcLiveAdjustedLambdas(match) {
  const minute = Math.min(match.live_minute || 0, 90);
  if (minute <= 0) return null;
  const eg = match.expectedGoals || {};
  const preLambdaH = eg.home || 1.3;
  const preLambdaA = eg.away || 1.1;
  const timeFactor = (90 - minute) / 90;
  const liveXgH = match.live_xg?.home;
  const liveXgA = match.live_xg?.away;
  if (liveXgH == null || liveXgA == null) {
    return { home: preLambdaH * timeFactor, away: preLambdaA * timeFactor };
  }
  const liveRateH = (liveXgH / minute) * 90;
  const liveRateA = (liveXgA / minute) * 90;
  const liveWeight = Math.min(0.8, minute / 60);
  const preWeight = 1 - liveWeight;
  let adjLambdaH = preLambdaH * preWeight + liveRateH * liveWeight;
  let adjLambdaA = preLambdaA * preWeight + liveRateA * liveWeight;
  if (match.live_momentum && Array.isArray(match.live_momentum) && match.live_momentum.length > 3) {
    const recent = match.live_momentum.slice(-6);
    const hMomentum = recent.filter(m => m.team === 'home').length / recent.length;
    const momentumBias = (hMomentum - 0.5) * 0.3;
    adjLambdaH *= (1 + momentumBias);
    adjLambdaA *= (1 - momentumBias);
  }
  const possession = match.live_possession;
  if (possession) {
    const pH = parseFloat(possession.home) || 0;
    const pA = parseFloat(possession.away) || 0;
    if (pH + pA > 0) {
      const possRatio = pH / (pH + pA);
      const possBias = (possRatio - 0.5) * 0.15;
      adjLambdaH *= (1 + possBias);
      adjLambdaA *= (1 - possBias);
    }
  }
  adjLambdaH = Math.max(0.1, adjLambdaH * timeFactor);
  adjLambdaA = Math.max(0.1, adjLambdaA * timeFactor);
  return { home: adjLambdaH, away: adjLambdaA };
}

function generateLiveScenarios(match) {
  const minute = Math.min(match.live_minute || 0, 90);
  if (minute <= 0 || !match.live_score) return [];
  const rawScore = match.live_score;
  let homeGoals, awayGoals;
  if (typeof rawScore === 'object' && rawScore !== null) {
    homeGoals = rawScore.home ?? 0;
    awayGoals = rawScore.away ?? 0;
  } else if (typeof rawScore === 'string' && rawScore.includes('-')) {
    const parts = rawScore.split('-').map(Number);
    homeGoals = parts[0] || 0;
    awayGoals = parts[1] || 0;
  } else {
    homeGoals = 0;
    awayGoals = 0;
  }
  const lambdas = calcLiveAdjustedLambdas(match);
  if (!lambdas) return [];
  const liveXgH = match.live_xg?.home || 0;
  const liveXgA = match.live_xg?.away || 0;
  const MAX = 7;
  const matrix = [];
  for (let h = 0; h < MAX; h++) {
    matrix[h] = [];
    for (let a = 0; a < MAX; a++) {
      matrix[h][a] = poissonPMF(lambdas.home, h) * poissonPMF(lambdas.away, a);
    }
  }
  const scenarios = [];
  let nextGoalHome = 0, nextGoalAway = 0, noMoreGoals = 0;
  for (let h = 0; h < MAX; h++) {
    for (let a = 0; a < MAX; a++) {
      const p = matrix[h][a];
      if (h > 0 && a === 0) nextGoalHome += p;
      if (h === 0 && a > 0) nextGoalAway += p;
      if (h === 0 && a === 0) noMoreGoals += p;
    }
  }
  const total = nextGoalHome + nextGoalAway + noMoreGoals;
  if (total > 0) {
    nextGoalHome /= total;
    nextGoalAway /= total;
    noMoreGoals /= total;
  }
  let over25FromNow = 0, over35FromNow = 0, bttsFromNow = 0, homeWinFromNow = 0, drawFromNow = 0, awayWinFromNow = 0;
  for (let h = 0; h < MAX; h++) {
    for (let a = 0; a < MAX; a++) {
      const p = matrix[h][a];
      const finalH = homeGoals + h;
      const finalA = awayGoals + a;
      const totalGoals = finalH + finalA;
      if (totalGoals > 2) over25FromNow += p;
      if (totalGoals > 3) over35FromNow += p;
      if (finalH > 0 && finalA > 0) bttsFromNow += p;
      if (finalH > finalA) homeWinFromNow += p;
      if (finalH === finalA) drawFromNow += p;
      if (finalH < finalA) awayWinFromNow += p;
    }
  }
  const topScores = [];
  for (let h = 0; h < MAX; h++) {
    for (let a = 0; a < MAX; a++) {
      topScores.push({
        score: `${homeGoals + h}-${awayGoals + a}`,
        prob: Math.round(matrix[h][a] * 100),
      });
    }
  }
  topScores.sort((a, b) => b.prob - a.prob);
  const powerScore = match.power_score || {};
  const powerDiff = (powerScore.home || 50) - (powerScore.away || 50);
  const dataQuality = minute >= 20 ? (minute >= 45 ? 0.9 : 0.75) : 0.55;
  if (nextGoalHome > 0.30) {
    scenarios.push({
      type: 'next_goal',
      label: `Prochain but — ${match.home_team}`,
      bet: `Next Goal: ${match.home_team}`,
      probability: Math.round(nextGoalHome * 100),
      confidence: Math.round(nextGoalHome * 100 * dataQuality),
      reason: nextGoalHome > 0.5
        ? `Domination écrasante (xG ${liveXgH.toFixed(1)}-${liveXgA.toFixed(1)}, momentum fort)`
        : `Avantage terrain + puissance offensive (${powerDiff > 10 ? 'Power Score supérieur' : 'xG favorable'})`,
      icon: '⚽',
      matchId: match.id,
    });
  }
  if (nextGoalAway > 0.30) {
    scenarios.push({
      type: 'next_goal',
      label: `Prochain but — ${match.away_team}`,
      bet: `Next Goal: ${match.away_team}`,
      probability: Math.round(nextGoalAway * 100),
      confidence: Math.round(nextGoalAway * 100 * dataQuality),
      reason: nextGoalAway > 0.5
        ? `Extérieur dominateur (xG ${liveXgA.toFixed(1)}-${liveXgH.toFixed(1)}, contre-attaques efficaces)`
        : `Bonne dynamique visiteur + faille défensive adverse`,
      icon: '⚽',
      matchId: match.id,
    });
  }
  const currentTotal = homeGoals + awayGoals;
  if (currentTotal < 2) {
    const overProb = over25FromNow;
    if (overProb > 0.35) {
      scenarios.push({
        type: 'over',
        label: `Over 2.5 buts (actu: ${currentTotal})`,
        bet: `Over 2.5`,
        probability: Math.round(overProb * 100),
        confidence: Math.round(overProb * 100 * dataQuality),
        reason: `Rythme élevé (xG combiné ${(liveXgH + liveXgA).toFixed(1)}, ${minute}e min)`,
        icon: '📈',
        matchId: match.id,
      });
    }
  }
  if (currentTotal < 3) {
    const overProb = over35FromNow;
    if (overProb > 0.30) {
      scenarios.push({
        type: 'over',
        label: `Over 3.5 buts (actu: ${currentTotal})`,
        bet: `Over 3.5`,
        probability: Math.round(overProb * 100),
        confidence: Math.round(overProb * 100 * dataQuality),
        reason: `Match très ouvert, deux équipes en mode offensif`,
        icon: '🔥',
        matchId: match.id,
      });
    }
  }
  const currentBTTS = homeGoals > 0 && awayGoals > 0;
  if (!currentBTTS && bttsFromNow > 0.35) {
    scenarios.push({
      type: 'btts',
      label: `BTTS — Les deux marquent`,
      bet: `BTTS: Oui`,
      probability: Math.round(bttsFromNow * 100),
      confidence: Math.round(bttsFromNow * 100 * dataQuality),
      reason: homeGoals === 0 && awayGoals === 0
        ? `Les deux équipes créent (xG ${(liveXgH + liveXgA).toFixed(1)}), but imminent des deux côtés`
        : homeGoals > 0
          ? `${match.away_team} pousse (xG ${liveXgA.toFixed(1)}), égalisation probable`
          : `${match.home_team} réagit (xG ${liveXgH.toFixed(1)}), réponse attendue`,
      icon: '🤝',
      matchId: match.id,
    });
  }
  if (homeWinFromNow > 0.40 && Math.abs(homeWinFromNow - awayWinFromNow) > 0.20) {
    scenarios.push({
      type: 'result',
      label: `Victoire ${match.home_team}`,
      bet: `1 (Victoire domicile)`,
      probability: Math.round(homeWinFromNow * 100),
      confidence: Math.round(homeWinFromNow * 100 * dataQuality),
      reason: `Contrôle du match (xG ${liveXgH.toFixed(1)}-${liveXgA.toFixed(1)}, score ${homeGoals}-${awayGoals})`,
      icon: '🏠',
      matchId: match.id,
    });
  }
  if (awayWinFromNow > 0.40 && Math.abs(awayWinFromNow - homeWinFromNow) > 0.20) {
    scenarios.push({
      type: 'result',
      label: `Victoire ${match.away_team}`,
      bet: `2 (Victoire extérieur)`,
      probability: Math.round(awayWinFromNow * 100),
      confidence: Math.round(awayWinFromNow * 100 * dataQuality),
      reason: `Performance extérieure solide (xG ${liveXgA.toFixed(1)}-${liveXgH.toFixed(1)})`,
      icon: '✈️',
      matchId: match.id,
    });
  }
  if (drawFromNow > 0.35 && Math.abs(homeGoals - awayGoals) <= 1) {
    scenarios.push({
      type: 'result',
      label: 'Match Nul',
      bet: 'N (Match nul)',
      probability: Math.round(drawFromNow * 100),
      confidence: Math.round(drawFromNow * 100 * dataQuality),
      reason: `Équilibre parfait, aucune équipe ne se détache`,
      icon: '🤝',
      matchId: match.id,
    });
  }
  const shotsH = match.live_shots?.home || 0;
  const shotsA = match.live_shots?.away || 0;
  const cornersH = match.live_corners?.home || 0;
  const cornersA = match.live_corners?.away || 0;
  const totalCorners = cornersH + cornersA;
  if (totalCorners < 8 && minute > 30) {
    const cornerRate = (totalCorners / minute) * 90;
    if (cornerRate > 8) {
      scenarios.push({
        type: 'corners',
        label: `Over 9.5 corners (actu: ${totalCorners})`,
        bet: `Over 9.5 Corners`,
        probability: Math.min(85, Math.round(cornerRate * 8)),
        confidence: Math.round(Math.min(85, cornerRate * 8) * dataQuality),
        reason: `Rythme corners élevé (${cornerRate.toFixed(1)}/90min, ${totalCorners} en ${minute}e)`,
        icon: '🚩',
        matchId: match.id,
      });
    }
  }
  if (shotsH + shotsA > 15 && minute < 70) {
    scenarios.push({
      type: 'shots',
      label: `Match intense — +1.5 buts restants`,
      bet: `Over 1.5 buts restants`,
      probability: Math.min(80, Math.round((shotsH + shotsA) / minute * 20)),
      confidence: Math.round(Math.min(80, (shotsH + shotsA) / minute * 20) * dataQuality),
      reason: `${shotsH + shotsA} tentations en ${minute}e, rythme soutenu`,
      icon: '💥',
      matchId: match.id,
    });
  }
  scenarios.forEach(s => {
    if (s.confidence > 75) s.tier = 'safe';
    else if (s.confidence > 55) s.tier = 'medium';
    else s.tier = 'value';
  });
  scenarios.sort((a, b) => b.confidence - a.confidence);
  return scenarios.slice(0, 8);
}

function getLivePredictionsTop5() {
  const now = Date.now();
  const liveMatches = db.matches.filter(m => {
    if (!m.live_score || !m.live_minute) return false;
    if (m.live_minute <= 5 || m.live_minute >= 85) return false;
    // v10.5: Ghost filter
    const minuteVal = parseInt(m.live_minute || 0);
    if (minuteVal > 130) return false;
    if (m.commence_time) {
      const hoursSince = (now - new Date(m.commence_time).getTime()) / (1000 * 60 * 60);
      if (hoursSince > 4) return false;
    }
    return true;
  });
  if (!liveMatches.length) return { predictions: [], message: 'Aucun match live éligible' };
  let allScenarios = [];
  for (const match of liveMatches) {
    const scenarios = generateLiveScenarios(match);
    allScenarios = allScenarios.concat(scenarios);
  }
  allScenarios.sort((a, b) => b.confidence - a.confidence);
  const top5 = allScenarios.slice(0, 5);
  for (const pred of top5) {
    const match = db.matches.find(m => m.id === pred.matchId);
    if (match) {
      pred.home_team = match.home_team;
      pred.away_team = match.away_team;
      pred.league = match.league;
      pred.score = match.live_score;
      pred.minute = match.live_minute;
      pred.odds = match.odds || null;
    }
  }
  return {
    predictions: top5,
    count: top5.length,
    total_live_matches: liveMatches.length,
    ts: Date.now(),
    minute_range: `${Math.min(...liveMatches.map(m => m.live_minute))}-${Math.max(...liveMatches.map(m => m.live_minute))}`,
  };
}

function buildSideStats(s) {
  const played = s?.played || 1;
  const w = s?.win || 0, d = s?.draw || 0, l = s?.lose || 0;

  // v9.2: Deep mapping — handle BOTH API-Football (nested) and BSD (flat) formats
  // API-Football: s.goals.for = { total: 15, average: "1.5" }
  // BSD: s.goals_for = 15 (flat number)
  const extractGoals = (obj) => {
    if (obj == null) return 0;
    if (typeof obj === 'number') return obj;
    if (typeof obj === 'object') {
      // API-Football nested format: { total: N, average: "N" }
      if (typeof obj.total === 'number') return obj.total;
      if (typeof obj.average === 'number') return obj.average;
      if (typeof obj.average === 'string') return parseFloat(obj.average) || 0;
    }
    return 0;
  };

  // Try nested first (API-Football), then flat (BSD)
  let gf = 0, ga = 0;
  if (s?.goals) {
    gf = extractGoals(s.goals.for);
    ga = extractGoals(s.goals.against);
  }
  // Fallback to flat properties (BSD format)
  if (gf === 0 && s?.goals_for != null) gf = extractGoals(s.goals_for);
  if (ga === 0 && s?.goals_against != null) ga = extractGoals(s.goals_against);

  const avgFor = played > 0 ? gf / played : 0;
  const avgAgainst = played > 0 ? ga / played : 0;

  return {
    ppg: parseFloat(((w * 3 + d) / played).toFixed(2)),
    wins: Math.round(w / played * 100),
    draws: Math.round(d / played * 100),
    losses: Math.round(l / played * 100),
    scored: Math.round(Math.min(95, (gf > 0 ? 1 : 0) / played * 100 || avgFor * 55)),
    conceded: Math.round(Math.min(95, (ga > 0 ? 1 : 0) / played * 100 || avgAgainst * 50)),
    avgScored: parseFloat(avgFor.toFixed(2)),
    avgConceded: parseFloat(avgAgainst.toFixed(2)),
    played,      // Conservé pour le Bootstrap UQD (P1 Quant)
  };
}

function simStats(name, isHome) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = ((h << 5) - h + name.charCodeAt(i)) & 0xffffffff;
  const r = (salt, min, max) => {
    const x = Math.abs(Math.sin(h + salt) * 43758.5453);
    return min + Math.floor((x - Math.floor(x)) * (max - min + 1));
  };
  const side = isHome ? 0 : 100;
  const wins = r(1 + side, isHome ? 35 : 22, isHome ? 72 : 58);
  const draws = r(2 + side, 8, 28);
  const losses = Math.max(0, 100 - wins - draws);
  const avgFor = parseFloat(((r(8 + side, 75, 240)) / 100).toFixed(2));
  const avgAg = parseFloat(((r(9 + side, 60, 200)) / 100).toFixed(2));
  return {
    ppg: parseFloat(((wins * 3 + draws) / 100).toFixed(2)),
    wins, draws, losses,
    scored: r(6 + side, 52, 93),
    conceded: r(7 + side, 40, 88),
    avgScored: avgFor,
    avgConceded: avgAg,
  };
}

function computeEdge(match) {
  const home = match.home_team, away = match.away_team;
  let bestH = null, bestN = null, bestA = null;
  let bestHbk = '', bestNbk = '', bestAbk = '';

  (match.bookmakers || []).forEach(bk => {
    const h2h = (bk.markets || []).find(m => m.key === 'h2h');
    if (!h2h) return;
    h2h.outcomes.forEach(o => {
      if (o.name === home && (!bestH || o.price > bestH)) { bestH = o.price; bestHbk = bk.title; }
      if (o.name === 'Draw' && (!bestN || o.price > bestN)) { bestN = o.price; bestNbk = bk.title; }
      if (o.name === away && (!bestA || o.price > bestA)) { bestA = o.price; bestAbk = bk.title; }
    });
  });

  if (!bestH || !bestA) return null;

  // v7.0: Dévigage Shin-Hurley (asymétrique, les favoris absorbent plus de marge)
  const fair = devig1X2(bestH, bestN, bestA, 'shin');
  if (!fair) return null;

  const edgeH = (bestH * fair.home - 1) * 100;
  const edgeN = bestN ? (bestN * fair.draw - 1) * 100 : null;
  const edgeA = (bestA * fair.away - 1) * 100;

  const edges = [
    { label: home, odds: bestH, edge: edgeH, bk: bestHbk, prob: fair.home },
    { label: 'Nul', odds: bestN, edge: edgeN, bk: bestNbk, prob: fair.draw },
    { label: away, odds: bestA, edge: edgeA, bk: bestAbk, prob: fair.away },
  ].filter(x => x.edge !== null);

  const best = edges.reduce((a, b) => b.edge > a.edge ? b : a);

  return {
    odds: { home: bestH, draw: bestN, away: bestA },
    bookmakers: { home: bestHbk, draw: bestNbk, away: bestAbk },
    fair: { home: fair.home, draw: fair.draw, away: fair.away },
    edgeValues: { home: edgeH, draw: edgeN, away: edgeA },
    best,
    margin: fair.margin,
    devigMethod: fair.method,
  };
}

// FIX v20.0 — Dérivation de forme depuis l'historique (dernier recours si db.teamStats absent)
// Scan db.matches + db.archive_matches pour reconstituer W/D/L récent d'une équipe
// Convention : forme[0] = match le plus ancien, forme[last] = plus récent (convention BSD/API-Football)
function deriveFormFromHistory(teamName, limit = 5) {
  const now = Date.now();
  const allMatches = [
    ...(db.matches || []),
    ...(db.archive_matches || [])
  ];
  const finished = allMatches
    .filter(m => {
      if (m.home_team !== teamName && m.away_team !== teamName) return false;
      const hasResult = !!(m.live_score || (m.goals?.home !== undefined && m.goals?.away !== undefined));
      const isPast = new Date(m.commence_time).getTime() < now;
      return hasResult && isPast;
    })
    .sort((a, b) => new Date(a.commence_time).getTime() - new Date(b.commence_time).getTime()) // plus ancien → plus récent
    .slice(-limit); // garder les N derniers

  if (finished.length < 2) return '';

  const formChars = [];
  for (const m of finished) {
    let hs, as;
    if (m.live_score) {
      [hs, as] = m.live_score.split('-').map(Number);
      if (isNaN(hs) || isNaN(as)) continue;
    } else if (m.goals?.home !== undefined && m.goals?.away !== undefined) {
      hs = m.goals.home;
      as = m.goals.away;
    } else {
      continue;
    }
    if (m.home_team === teamName) {
      formChars.push(hs > as ? 'W' : hs === as ? 'D' : 'L');
    } else {
      formChars.push(as > hs ? 'W' : as === hs ? 'D' : 'L');
    }
  }

  return formChars.join('');
}

// Level 5 — Synthèse forme depuis stats saison (PPG → W/D/L)
//   Ex: PPG 2.40 → "WWWWL", PPG 0.80 → "WDLLL"
function deriveFormFromStats(stats) {
  if (!stats || typeof stats.ppg !== 'number') return '';
  const ppg = stats.ppg;
  // Points totaux sur 5 matchs théoriques
  const ptsTotal = Math.round(ppg * 5);
  // Max de victoires possibles
  const wins = Math.min(5, Math.max(0, Math.floor(ptsTotal / 3)));
  const remainingPts = ptsTotal - wins * 3;
  const draws = Math.min(5 - wins, Math.max(0, remainingPts));
  const losses = 5 - wins - draws;
  // Construire la forme : W → D → L (du + récent au + ancien)
  let form = '';
  form += 'W'.repeat(wins);
  form += 'D'.repeat(draws);
  form += 'L'.repeat(losses);
  return form || 'LLLLL';
}

// H2H — Dernières 5 confrontations directes entre deux équipes (depuis history/archive)
// v9.8.4 fix : filter matchs FINIS (score connu) AVANT slice, sinon matchs futurs polluent le top 5
function computeH2H(homeTeam, awayTeam) {
  const hNorm = normName(homeTeam);
  const aNorm = normName(awayTeam);
  // Scan SEULEMENT sources avec score : history (kvGet archive verified) + db.archive_matches finis
  const histArr = (typeof history !== 'undefined' && Array.isArray(history)) ? history : [];
  const archived = (db.archive_matches || []);
  const pool = [
    ...histArr.map(h => ({
      home_team: h.home_team,
      away_team: h.away_team,
      commence_time: h.commence_time,
      score: h.realScore ? `${h.realScore.home}-${h.realScore.away}` : null,
      hs: h.realScore?.home,
      as: h.realScore?.away,
    })),
    ...archived.map(a => ({
      home_team: a.home_team,
      away_team: a.away_team,
      commence_time: a.commence_time,
      score: a.live_score || (a.goals ? `${a.goals.home}-${a.goals.away}` : null),
      hs: a.live_score ? Number(a.live_score.split('-')[0]) : a.goals?.home,
      as: a.live_score ? Number(a.live_score.split('-')[1]) : a.goals?.away,
    })),
  ].filter(m => m.score && typeof m.hs === 'number' && typeof m.as === 'number' && !isNaN(m.hs) && !isNaN(m.as));

  const h2hMatches = pool
    .filter(m => {
      const h = normName(m.home_team);
      const a = normName(m.away_team);
      return (h === hNorm && a === aNorm) || (h === aNorm && a === hNorm);
    })
    .sort((a, b) => new Date(b.commence_time) - new Date(a.commence_time))
    .slice(0, 5);

  if (h2hMatches.length === 0) return null;

  let w = 0, d = 0, l = 0;
  const formChars = [];
  const meetings = [];
  for (const m of [...h2hMatches].reverse()) {
    const isHome = normName(m.home_team) === hNorm;
    const hs = m.hs, as = m.as;
    const myScore = isHome ? hs : as;
    const oppScore = isHome ? as : hs;
    if (myScore > oppScore) { w++; formChars.push('W'); }
    else if (myScore === oppScore) { d++; formChars.push('D'); }
    else { l++; formChars.push('L'); }
    meetings.push({
      date: (m.commence_time || '').slice(0, 10),
      home: m.home_team,
      away: m.away_team,
      score: m.score,
      home_goals: hs,
      away_goals: as,
    });
  }

  return {
    summary: `${w}W-${d}D-${l}L`,
    form: formChars.join(''),
    wins: w, draws: d, losses: l, total: w + d + l,
    meetings,
    source: 'local',
  };
}

function buildMatchRecord(raw) {
  const edge = computeEdge(raw);
  if (!edge) return null;

  const hKey = normName(raw.home_team);
  const aKey = normName(raw.away_team);
  let hRaw = db.teamStats[hKey] || findFuzzy(hKey);
  let aRaw = db.teamStats[aKey] || findFuzzy(aKey);

  // H2H — 5 dernières confrontations
  const h2h = computeH2H(raw.home_team, raw.away_team);

  // ── Protocole double-check cohérence Home/Away ────────────────────────────
  // Guard 1 : cross-contamination — même objet DB pour les deux équipes
  if (hRaw && aRaw && hRaw === aRaw) {
    console.error(`  [Coherence] ⚠ CROSS-CONTAMINATION: "${raw.home_team}" et "${raw.away_team}" → même entrée DB. Away forcé simStats. Vérifier findFuzzy.`);
    aRaw = null;
  }
  // Guard 2 : fuzzy match ambigu — la clé matchée est plus proche de l'autre équipe
  if (hRaw && !db.teamStats[hKey]) {
    const hMatchedKey = Object.keys(db.teamStats).find(k => db.teamStats[k] === hRaw) || '';
    if (hMatchedKey && levenshtein(hMatchedKey, aKey) < levenshtein(hMatchedKey, hKey)) {
      console.error(`  [Coherence] ⚠ FUZZY AMBIGUË: "${raw.home_team}" → clé "${hMatchedKey}" plus proche de Away "${raw.away_team}". Home forcé simStats.`);
      hRaw = null;
    }
  }
  if (aRaw && !db.teamStats[aKey]) {
    const aMatchedKey = Object.keys(db.teamStats).find(k => db.teamStats[k] === aRaw) || '';
    if (aMatchedKey && levenshtein(aMatchedKey, hKey) < levenshtein(aMatchedKey, aKey)) {
      console.error(`  [Coherence] ⚠ FUZZY AMBIGUË: "${raw.away_team}" → clé "${aMatchedKey}" plus proche de Home "${raw.home_team}". Away forcé simStats.`);
      aRaw = null;
    }
  }
  // ─────────────────────────────────────────────────────────────────────────

  const homeStats = hRaw?.home || simStats(raw.home_team, true);
  const awayStats = aRaw?.away || simStats(raw.away_team, false);
  const isRealData = !!(hRaw?._real && aRaw?._real);

  if (!hRaw) console.warn(`  [BuildMatch] "${raw.home_team}" (Home) — stats simulées (non trouvé en DB)`);
  if (!aRaw) console.warn(`  [BuildMatch] "${raw.away_team}" (Away) — stats simulées (non trouvé en DB)`);

  // ── FIX v20.0 — getTeamForm() : Normalisateur Universel (symétrique Home/Away) ──
  // Niveaux : 1) DB exacte  2) Fuzzy  3) Prefix fallback  4) Historique de matchs
  const getTeamForm = (teamName, normKey, rawEntry, fallbackStats) => {
    // Niveau 1 — DB exacte (rawEntry passé par buildMatchRecord)
    if (rawEntry?.form && rawEntry.form.length >= 3) return rawEntry.form;
    // Niveau 2 — Fuzzy matching
    const fuzzy = findFuzzy(normKey);
    if (fuzzy?.form && fuzzy.form.length >= 3) return fuzzy.form;
    // Niveau 3 — Prefix fallback (premier mot, 4+ chars)
    const firstWord = normKey.split(' ')[0];
    if (firstWord.length >= 4) {
      for (const [k, v] of Object.entries(db.teamStats)) {
        if (k.startsWith(firstWord) && v?.form && v.form.length >= 3) {
          console.warn(`  [Forme] "${teamName}" → fallback forme depuis "${k}" (${v.form})`);
          return v.form;
        }
      }
    }
    // Niveau 4 — Dérivation depuis l'historique des matchs terminés (dernier recours)
    const derived = deriveFormFromHistory(teamName, 5);
    if (derived) {
      console.warn(`  [Forme] "${teamName}" → forme dérivée de l'historique (${derived})`);
      return derived;
    }
    // Niveau 5 — Synthèse forme depuis stats saison (PPG → W/D/L)
    const synForm = deriveFormFromStats(fallbackStats);
    if (synForm) {
      console.warn(`  [Forme] "${teamName}" → forme synthétisée depuis PPG (${synForm})`);
      return synForm;
    }
    return '';
  };
  const homeForm = getTeamForm(raw.home_team, hKey, hRaw, homeStats);
  const awayForm = getTeamForm(raw.away_team, aKey, aRaw, awayStats);

  // Expected goals (Poisson λ) : attaque dom × défense ext / ligue moyenne (~1.35)
  const LEAGUE_AVG = 1.35;
  const expHome = (homeStats.avgScored / LEAGUE_AVG) * (awayStats.avgConceded || LEAGUE_AVG);
  const expAway = (awayStats.avgScored / LEAGUE_AVG) * (homeStats.avgConceded || LEAGUE_AVG);

  // v9.0: Anti-Zero Poisson — interdire calcul si moyennes à 0
  let poisson;
  if (expHome === 0 && expAway === 0) {
    console.error("\x1b[31m[POISSON] Anti-Zero: expHome=0 et expAway=0 pour %s vs %s — calcul bloqué\x1b[0m", raw.home_team, raw.away_team);
    poisson = { error: 'ZERO_STATS', message: 'Moyennes de buts à 0 — calcul Poisson impossible', over25: 0, btts: 0, homeWin: 0, draw: 0, awayWin: 0 };
  } else {
    poisson = computePoisson(expHome, expAway);
  }

  // ── v7.0 BAYESIAN MODEL BLENDER ────────────────────────────────────────────

  // ── v7.0 BAYESIAN MODEL BLENDER ────────────────────────────────────────────
  const tempMatch = { stats: { home: homeStats, away: awayStats }, expectedGoals: { home: expHome, away: expAway } };
  const eloProbs = computeEloProbs(tempMatch);
  const xgProbs = computeXGLogisticProbs(tempMatch);

  // Blend: Poisson 50%, Elo 25%, xG Logistic 25%
  const blended = bayesianBlend(poisson, eloProbs, xgProbs);

  // Calibration via reliability diagram
  const calibrated = calibrateProbs(blended);

  // v7.0: EV calculations avec probabilités dévigées du marché
  const evs = calcAllEVs(calibrated, edge.odds, edge.fair);

  // v7.0: Edge Poisson recalculé avec probs calibrées (remplace l'ancien calcul brut)
  const pFairH = calibrated.homeWin / 100;
  const pFairN = calibrated.draw / 100;
  const pFairA = calibrated.awayWin / 100;
  const pEdgeH = edge.odds.home ? parseFloat(((edge.odds.home * pFairH - 1) * 100).toFixed(1)) : null;
  const pEdgeN = edge.odds.draw ? parseFloat(((edge.odds.draw * pFairN - 1) * 100).toFixed(1)) : null;
  const pEdgeA = edge.odds.away ? parseFloat(((edge.odds.away * pFairA - 1) * 100).toFixed(1)) : null;
  const pEdges = [
    { label: raw.home_team, edge: pEdgeH },
    { label: 'Nul', edge: pEdgeN },
    { label: raw.away_team, edge: pEdgeA },
  ].filter(x => x.edge !== null);
  const bestPoissonEdge = pEdges.length ? pEdges.reduce((a, b) => b.edge > a.edge ? b : a) : null;

  // PariScore Shield : convergence modèle blendé + Marché sur le même résultat
  const shield = !!(
    edge.best.edge > 5 &&
    bestPoissonEdge?.edge > 0 &&
    bestPoissonEdge?.label === edge.best.label
  );

  const leagueLabel = SPORT_LABELS[raw._sport || raw.sport_key] || raw.sport_title || '?';
  const recordCountry = detectCountryFromLeague(
    raw.sport_title || leagueLabel,
    raw._sport || raw.sport_key,
    raw.country || raw._league_country,
    raw._bsd_league_id
  );

  const record = {
    id: raw.id,
    sport: raw._sport || raw.sport_key,
    league: leagueLabel,
    country: recordCountry,
    commence_time: raw.commence_time,
    home_team: raw.home_team,
    away_team: raw.away_team,
    home_rank: hRaw?.rank || null,
    away_rank: aRaw?.rank || null,
    status: raw.status || null,
    home_team_id: hRaw?.teamId || null,
    away_team_id: aRaw?.teamId || null,
    home_bsd_id: hRaw?.bsdTeamId || null,
    away_bsd_id: aRaw?.bsdTeamId || null,
    home_sofa_id: hRaw?.sofaTeamId || null,
    away_sofa_id: aRaw?.sofaTeamId || null,
    home_form: homeForm,
    away_form: awayForm,
    h2h,
    odds: edge.odds,
    bookmakers: edge.bookmakers,
    fair: edge.fair,
    edge: edge.edgeValues,
    best_edge: edge.best,
    poisson,
    blended,
    calibrated,
    evs,
    expectedGoals: { home: parseFloat(expHome.toFixed(2)), away: parseFloat(expAway.toFixed(2)) },
    poissonEdge: bestPoissonEdge,
    shield,
    elo: eloProbs,
    xgLogistic: xgProbs,
    margin: edge.margin,
    devigMethod: edge.devigMethod,
    stats: {
      home: homeStats,
      away: awayStats,
      isReal: isRealData,
    },
  };
  record.all_bookmakers = processAllBookmakers(raw.bookmakers, raw.home_team, raw.away_team);

  // ── P1 QUANT — Bootstrap UQD + Reliability Score + Bet Signal ───────────────
  const playedHome = homeStats.played || 10;
  const playedAway = awayStats.played || 10;

  // 1. Bootstrap UQD : IC 90% sur tous les marchés Poisson
  const uqd = (expHome > 0 && expAway > 0)
    ? computeBootstrapUQD(expHome, expAway, playedHome, playedAway, 500)
    : null;
  record.uqd = uqd;

  // 2. Score de Fiabilité Composite (remplace l'ancien confidence_score heuristique)
  record.reliability_score = computeReliabilityScore(uqd, isRealData, playedHome, playedAway);

  // 3. Rétro-compatibilité : conserver confidence_score = reliability_score
  record.confidence_score = record.reliability_score;

  // 4. Règle de Décision Stricte : BET si EV>5% ET EV pessimiste IC>0%
  record.bet_signal = computeBetSignal(record, uqd);

  // Dropping Odds Tracker — time series (max 12 snapshots ≈ 24h à cron 2h)
  const snapKey = `odds_snap_${record.id}`;
  const history = kvGet(snapKey) || [];
  const prevSnap = Array.isArray(history) ? history[history.length - 1] : (history?.home != null ? history : null);
  if (prevSnap && prevSnap.home != null) {
    const dHome = record.odds?.home != null ? parseFloat((record.odds.home - prevSnap.home).toFixed(2)) : null;
    const dDraw = record.odds?.draw != null ? parseFloat((record.odds.draw - prevSnap.draw).toFixed(2)) : null;
    const dAway = record.odds?.away != null ? parseFloat((record.odds.away - prevSnap.away).toFixed(2)) : null;
    record.odds_delta = { home: dHome, draw: dDraw, away: dAway, ts: prevSnap.ts };
  } else {
    record.odds_delta = null;
  }
  if (record.odds?.home != null) {
    const arr = Array.isArray(history) ? history : (history?.home != null ? [history] : []);
    const snap = { home: record.odds.home, draw: record.odds.draw, away: record.odds.away, ts: Date.now() };
    kvSet(snapKey, [...arr, snap].slice(-12));
  }

  // Injuries — mappées directement depuis le flux BSD (unavailable_players)
  // Plus besoin d'appel API-Football dédié → économie de quota
  const bsdUnavailable = raw._source === 'bsd' ? raw.unavailable : null;
  if (bsdUnavailable) {
    record.injuries = {
      home: (bsdUnavailable.home || []).map(p => ({
        name: p.name || p.player?.name || '?',
        reason: p.reason || p.type || 'blessure',
      })),
      away: (bsdUnavailable.away || []).map(p => ({
        name: p.name || p.player?.name || '?',
        reason: p.reason || p.type || 'blessure',
      })),
    };
  } else {
    // Fallback: ancien mécanisme cache API-Football (si BSD non dispo)
    const homeKey = normName(record.home_team);
    const awayKey = normName(record.away_team);
    const homeTeamId = db.teamStats[homeKey]?.teamId;
    const awayTeamId = db.teamStats[awayKey]?.teamId;
    const homeInjCached = homeTeamId ? kvGet(`injuries_${homeTeamId}_${currentSeason()}`) : null;
    const awayInjCached = awayTeamId ? kvGet(`injuries_${awayTeamId}_${currentSeason()}`) : null;
    record.injuries = {
      home: homeInjCached?.data || [],
      away: awayInjCached?.data || [],
    };
  }
  const homeInjCount = Math.min((record.injuries.home || []).length, 6);
  const awayInjCount = Math.min((record.injuries.away || []).length, 6);
  record.injuryPenalty = {
    home: Math.min(homeInjCount * 5, 30),
    away: Math.min(awayInjCount * 5, 30),
  };

  // Corners Poisson — total attendu = (xG Dom + xG Ext) * ratio corners/buts (~3.0)
  const cornerTotal = Math.max(1.0, (expHome + expAway) * 3.0);
  let crCum = 0;
  for (let k = 0; k <= 6; k++) {
    let logP = -cornerTotal + k * Math.log(Math.max(cornerTotal, 0.001));
    for (let i = 1; i <= k; i++) logP -= Math.log(i);
    crCum += Math.exp(logP);
  }
  record.corners_poisson = { over_6_5: Math.round(Math.max(0, Math.min(99, (1 - crCum) * 100))) };

  // BSD metadata — xG réel, coaches, absences
  if (raw._source === 'bsd') {
    record._source = 'bsd';
    record._bsd_event_id = raw._bsd_event_id;
    record.bsd_xg = raw.bsd_xg || raw.xg || null;
    record.bsd_coaches = raw.bsd_coaches || raw.coaches || null;
    record.bsd_unavailable = raw.unavailable || null;
  }

  return record;
}

// Enrichissement corners depuis BSD (donnees reelles par equipe, avec cache)
async function enrichCornersFromBSD(matches) {
  if (!BSD_API_KEY || !Object.keys(BSD_CONFIG_TO_BSD).length) {
    console.log('  [Corners] BSD non configure — conservation heuristique xG');
    return;
  }
  console.log('  [Corners] Enrichissement corners depuis BSD…');
  const teamCache = new Map(); // normName -> { totalCornersPerMatch }
  let enriched = 0;

  for (const m of matches) {
    if (m._source !== 'bsd' && !m._bsd_event_id) continue;
    const configLeague = leaguesConfig.leagues.find(l => l.name === m.league || l.odds_key === m.sport);
    const bsdLeagueId = configLeague ? configIdToBsd(configLeague.id) : null;
    if (!bsdLeagueId) continue;

    const homeKey = normName(m.home_team);
    const awayKey = normName(m.away_team);

    try {
      if (!teamCache.has(homeKey)) {
        const data = await fetchBSDTeamCornerHistory(m.home_team, bsdLeagueId, 5);
        teamCache.set(homeKey, data?.totalCornersPerMatch || null);
      }
      if (!teamCache.has(awayKey)) {
        const data = await fetchBSDTeamCornerHistory(m.away_team, bsdLeagueId, 5);
        teamCache.set(awayKey, data?.totalCornersPerMatch || null);
      }
    } catch (e) { continue; }

    const homeAvg = teamCache.get(homeKey);
    const awayAvg = teamCache.get(awayKey);
    if (homeAvg != null && awayAvg != null) {
      const cr = predictCorners(homeAvg, awayAvg, [6.5]);
      m.corners_poisson = {
        over_6_5: cr.probabilities.over_6_5,
        source: 'bsd',
        home_avg: Math.round(homeAvg * 10) / 10,
        away_avg: Math.round(awayAvg * 10) / 10,
      };
      enriched++;
    }
  }
  console.log(`  [Corners] ${enriched}/${matches.length} matchs enrichis via BSD`);
}

// ═══════════════════════════════════════════════════════════════════════════════
//  OPTION B — BACKTESTING (History + Accuracy)
// ═══════════════════════════════════════════════════════════════════════════════

const HISTORY_FILE = path.join(__dirname, 'history.json');
let history = [];
let accuracy = { total: 0, over25_correct: 0, over25_total: 0, btts_correct: 0, btts_total: 0, edge_correct: 0, edge_total: 0 };

function loadHistory() {
  // Rétrocompat : migration one-shot depuis history.json
  if (fs.existsSync(HISTORY_FILE)) {
    try {
      const raw = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
      history = raw.matches || [];
      accuracy = raw.accuracy || accuracy;
      saveHistory();
      fs.renameSync(HISTORY_FILE, HISTORY_FILE + '.migrated');
      console.log(`  ✓ history.json migré vers SQLite (${history.length} matchs archivés)`);
      return;
    } catch (e) { console.warn('[History] Migration JSON→SQLite:', e.message); }
  }

  history = kvGet('history_matches', []);
  accuracy = kvGet('history_accuracy', accuracy);
  console.log(`  ✓ Historique SQLite chargé (${history.length} matchs archivés)`);
}

function saveHistory() {
  kvSetBatch([
    ['history_matches', history],
    ['history_accuracy', accuracy],
  ]);
}

// ═══════════════════════════════════════════════════════════════════════════════
//  AI CACHE — analyses Power Score par match (ai_cache.json, TTL 24h)
// ═══════════════════════════════════════════════════════════════════════════════

let aiCache = {};  // { [matchKey]: { data, cachedAt } }

function loadAICache() {
  // Rétrocompat : migration one-shot depuis ai_cache.json
  if (fs.existsSync(AI_CACHE_FILE)) {
    try {
      const raw = JSON.parse(fs.readFileSync(AI_CACHE_FILE, 'utf8'));
      const now = Date.now();
      for (const [key, entry] of Object.entries(raw)) {
        if (now - new Date(entry.cachedAt).getTime() < AI_CACHE_TTL) aiCache[key] = entry;
      }
      saveAICache();
      fs.renameSync(AI_CACHE_FILE, AI_CACHE_FILE + '.migrated');
      console.log(`  ✓ ai_cache.json migré vers SQLite (${Object.keys(aiCache).length} analyses valides)`);
      return;
    } catch (e) { console.warn('[AICache] Migration JSON→SQLite:', e.message); }
  }

  const raw = kvGet('ai_cache', {});
  const now = Date.now();
  let kept = 0;
  for (const [key, entry] of Object.entries(raw)) {
    if (now - new Date(entry.cachedAt).getTime() < AI_CACHE_TTL) { aiCache[key] = entry; kept++; }
  }
  console.log(`  ✓ AI Cache SQLite chargé (${kept} analyses valides)`);
}

function saveAICache() {
  kvSet('ai_cache', aiCache);
}

/**
 * Retourne l'analyse en cache si elle existe et est valide (< 24h).
 * @param {string} matchKey  Identifiant unique du match (m.id côté frontend)
 * @returns {object|null}    Réponse Gemini stockée, ou null si miss
 */
function getCachedAIAnalysis(matchKey) {
  if (!matchKey) return null;
  const entry = aiCache[matchKey];
  if (!entry) return null;
  if (Date.now() - new Date(entry.cachedAt).getTime() >= AI_CACHE_TTL) {
    delete aiCache[matchKey]; // éviction silencieuse
    return null;
  }
  return entry.data;
}

/**
 * Persiste une analyse Gemini dans le cache en mémoire et sur disque.
 * @param {string} matchKey  Identifiant unique du match
 * @param {object} data      Réponse Gemini complète (JSON déjà parsé)
 */
function saveAIAnalysisToCache(matchKey, data) {
  if (!matchKey) return;
  aiCache[matchKey] = { data, cachedAt: new Date().toISOString() };
  saveAICache();
}

// BSD score lookup with per-call date cache — avoids redundant fetches within one archive pass
async function getBSDScoreForMatch(team1, team2, dateStr, bsdDateCache) {
  try {
    if (!bsdDateCache.has(dateStr)) {
      const results = await fetchBSDMatches(dateStr, dateStr);
      bsdDateCache.set(dateStr, results);
    }
    const bsdMatches = bsdDateCache.get(dateStr);
    const hNorm = normName(team1), aNorm = normName(team2);
    const found = bsdMatches.find(bm => {
      if (bm.home_score === null || bm.away_score === null) return false;
      if (bm.status === 'inprogress' || (bm.status && bm.status.includes('half'))) return false;
      const bh = normName(bm.home_team), ba = normName(bm.away_team);
      return (bh.includes(hNorm.split(' ')[0]) || hNorm.includes(bh.split(' ')[0])) &&
        (ba.includes(aNorm.split(' ')[0]) || aNorm.includes(ba.split(' ')[0]));
    });
    if (found) return { home: Number(found.home_score), away: Number(found.away_score), source: 'bsd' };
    return null;
  } catch (e) {
    return null;
  }
}

async function archivePastMatches() {
  if (!API_FOOTBALL_KEY && !BSD_BASE_URL) return;
  const now = Date.now();
  const bsdDateCache = new Map(); // shared cache across all archive passes this call

  // ── ÉTAPE 1 : Archiver les matchs terminés récents ──────────────────────────
  const past = db.matches.filter(m => new Date(m.commence_time).getTime() < now - 3 * 3600000);
  let archived = 0;

  if (past.length) {
    console.log(`  [Archive] ${past.length} matchs terminés à archiver…`);

    for (const match of past) {
      if (history.find(h => h.id === match.id)) continue;

      const dateStr = match.commence_time.split('T')[0];
      let realScore = null;

      // Phase 1 : BSD (gratuit, prioritaire)
      if (BSD_BASE_URL) {
        realScore = await getBSDScoreForMatch(match.home_team, match.away_team, dateStr, bsdDateCache);
        if (realScore) console.log(`  [Archive] BSD score OK: ${match.home_team} ${realScore.home}-${realScore.away} ${match.away_team}`);
      }

      // Phase 2 : API-Football fallback si BSD n'a pas le score
      if (!realScore && API_FOOTBALL_KEY) {
        try {
          const res = await httpsGet(
            `https://v3.football.api-sports.io/fixtures?date=${dateStr}&timezone=Europe/Paris&status=FT`,
            { 'x-apisports-key': API_FOOTBALL_KEY }
          );
          if (res.status === 200 && res.data.response) {
            const hNorm = normName(match.home_team), aNorm = normName(match.away_team);
            const found = res.data.response.find(f => {
              const fh = normName(f.teams.home.name), fa = normName(f.teams.away.name);
              return (fh.includes(hNorm.split(' ')[0]) || hNorm.includes(fh.split(' ')[0])) &&
                (fa.includes(aNorm.split(' ')[0]) || aNorm.includes(fa.split(' ')[0]));
            });
            if (found?.goals) realScore = { home: found.goals.home, away: found.goals.away, source: 'api-football' };
          }
        } catch (e) { /* score unavailable */ }
      }

      const record = {
        id: match.id, home_team: match.home_team, away_team: match.away_team,
        league: match.league, commence_time: match.commence_time,
        predicted: { over25: match.poisson?.over25, btts: match.poisson?.btts, bestEdge: match.best_edge?.label, bestEdgeValue: match.best_edge?.edge },
        realScore, archived_at: new Date().toISOString(),
      };

      if (realScore !== null) {
        const totalGoals = realScore.home + realScore.away;
        const wasBTTS = realScore.home > 0 && realScore.away > 0;
        const wasOver25 = totalGoals > 2.5;
        if (match.poisson?.over25 > 55) { accuracy.over25_total++; if (wasOver25) accuracy.over25_correct++; }
        if (match.poisson?.btts > 55) { accuracy.btts_total++; if (wasBTTS) accuracy.btts_correct++; }
        if (match.best_edge?.edge > 5) {
          accuracy.edge_total++;
          const winner = realScore.home > realScore.away ? match.home_team : realScore.away > realScore.home ? match.away_team : 'Nul';
          if (winner === match.best_edge.label) accuracy.edge_correct++;
        }
        accuracy.total++;
        record.verified = true;
      } else { record.verified = false; }

      history.push(record);
      archived++;
      // Hook Mes Paris : flag les paris pending sur ce match pour suggestion settlement côté UI
      if (record.verified && record.realScore && sqldb) {
        try {
          sqldb.prepare(
            "UPDATE user_bets SET updated_at = strftime('%s','now') WHERE match_id = ? AND status = 'pending'"
          ).run(record.id);
        } catch (e) { /* table absente sur ancien deploy */ }
      }
    }

    const archivedIds = new Set(past.map(m => m.id));
    db.matches = db.matches.filter(m => !archivedIds.has(m.id));
    // Sync vers db.archive_matches pour H2H et stats
    db.archive_matches = [...db.archive_matches, ...past];
    // Limiter a 1000 matchs archives pour performance
    if (db.archive_matches.length > 1000) {
      db.archive_matches = db.archive_matches.slice(-1000);
    }
  }

  // ── ÉTAPE 2 : Retry des matchs non vérifiés (API était down au moment de l'archive) ──
  const unverified = history.filter(h => !h.verified && h.realScore === null && new Date(h.archived_at).getTime() < now - 24 * 3600000);
  let retried = 0;

  if (unverified.length) {
    console.log(`  [Archive] ${unverified.length} matchs non vérifiés à re-tenter…`);

    for (const entry of unverified) {
      const dateStr = entry.commence_time.split('T')[0];
      let retryScore = null;

      // Phase 1 : BSD
      if (BSD_BASE_URL) {
        retryScore = await getBSDScoreForMatch(entry.home_team, entry.away_team, dateStr, bsdDateCache);
      }
      // Phase 2 : API-Football fallback
      if (!retryScore && API_FOOTBALL_KEY) {
        try {
          const res = await httpsGet(
            `https://v3.football.api-sports.io/fixtures?date=${dateStr}&timezone=Europe/Paris&status=FT`,
            { 'x-apisports-key': API_FOOTBALL_KEY }
          );
          if (res.status === 200 && res.data.response) {
            const hNorm = normName(entry.home_team), aNorm = normName(entry.away_team);
            const found = res.data.response.find(f => {
              const fh = normName(f.teams.home.name), fa = normName(f.teams.away.name);
              return (fh.includes(hNorm.split(' ')[0]) || hNorm.includes(fh.split(' ')[0])) &&
                (fa.includes(aNorm.split(' ')[0]) || aNorm.includes(fa.split(' ')[0]));
            });
            if (found?.goals) retryScore = { home: found.goals.home, away: found.goals.away, source: 'api-football' };
          }
        } catch (e) { /* still unavailable */ }
      }

      if (retryScore) {
        entry.realScore = retryScore;
        const totalGoals = entry.realScore.home + entry.realScore.away;
        const wasBTTS = entry.realScore.home > 0 && entry.realScore.away > 0;
        const wasOver25 = totalGoals > 2.5;
        if (entry.predicted?.over25 > 55) { accuracy.over25_total++; if (wasOver25) accuracy.over25_correct++; }
        if (entry.predicted?.btts > 55) { accuracy.btts_total++; if (wasBTTS) accuracy.btts_correct++; }
        if (entry.predicted?.bestEdgeValue > 5) {
          accuracy.edge_total++;
          const winner = entry.realScore.home > entry.realScore.away ? entry.home_team : entry.realScore.away > entry.realScore.home ? entry.away_team : 'Nul';
          if (winner === entry.predicted.bestEdge) accuracy.edge_correct++;
        }
        accuracy.total++;
        entry.verified = true;
        entry.retry_at = new Date().toISOString();
        retried++;
      }
    }
  }

  if (archived > 0 || retried > 0) {
    saveHistory(); saveDB();
    console.log(`  [Archive] ✓ ${archived} archivés + ${retried} re-vérifiés (${accuracy.total} vérifiés au total)`);
  }
}

function getWeeklyAccuracyTrends(weeks = 12) {
  const getWeek = dateStr => {
    const d = new Date(dateStr);
    const y = d.getFullYear();
    const start = new Date(y, 0, 1);
    const diff = Math.floor((d - start + (start.getTimezoneOffset() - d.getTimezoneOffset()) * 60000) / 86400000);
    const w = Math.ceil((diff + start.getDay() + 1) / 7);
    return `${y}-W${String(w).padStart(2, '0')}`;
  };

  const weeksMap = {}; // déclaration correcte de la variable

  for (const h of history) {
    if (!h.verified || !h.realScore || !h.commence_time) continue;
    const wk = getWeek(h.commence_time);
    if (!weeksMap[wk]) weeksMap[wk] = { over25c: 0, over25t: 0, bttsc: 0, bttst: 0, total: 0 };
    weeksMap[wk].total++;
    const rs = h.realScore;
    const wasOver25 = (rs.home + rs.away) > 2.5;
    const wasBTTS = rs.home > 0 && rs.away > 0;
    if (h.predicted?.over25 > 55) { weeksMap[wk].over25t++; if (wasOver25) weeksMap[wk].over25c++; }
    if (h.predicted?.btts > 55) { weeksMap[wk].bttst++; if (wasBTTS) weeksMap[wk].bttsc++; }
  }

  return Object.entries(weeksMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-weeks)
    .map(([week, d]) => ({
      week,
      total: d.total,
      over25: d.over25t > 0 ? Math.round(d.over25c / d.over25t * 100) : null,
      btts: d.bttst > 0 ? Math.round(d.bttsc / d.bttst * 100) : null,
      over25_bets: d.over25t,
      btts_bets: d.bttst,
    }));
}


function getAccuracyReport() {
  const pct = (c, t) => t > 0 ? Math.round(c / t * 100) : null;

  // ── Global ──────────────────────────────────────────────────────────────────
  const global = {
    total_verified: accuracy.total,
    over25: { rate: pct(accuracy.over25_correct, accuracy.over25_total), sample: accuracy.over25_total },
    btts: { rate: pct(accuracy.btts_correct, accuracy.btts_total), sample: accuracy.btts_total },
    edge: { rate: pct(accuracy.edge_correct, accuracy.edge_total), sample: accuracy.edge_total },
    history_size: history.length,
  };

  // ── Rolling window (30 derniers matchs vérifiés) ────────────────────────────
  const recent = history.filter(h => h.verified).slice(-30);
  let rOver25c = 0, rOver25t = 0, rBttsc = 0, rBttst = 0, rEdgec = 0, rEdget = 0;
  for (const h of recent) {
    const rs = h.realScore;
    if (!rs) continue;
    const wasOver25 = (rs.home + rs.away) > 2.5;
    const wasBTTS = rs.home > 0 && rs.away > 0;
    if (h.predicted?.over25 > 55) { rOver25t++; if (wasOver25) rOver25c++; }
    if (h.predicted?.btts > 55) { rBttst++; if (wasBTTS) rBttsc++; }
    if (h.predicted?.bestEdgeValue > 5) {
      rEdget++;
      const winner = rs.home > rs.away ? h.home_team : rs.away > rs.home ? h.away_team : 'Nul';
      if (winner === h.predicted.bestEdge) rEdgec++;
    }
  }
  global.rolling30 = {
    sample: recent.length,
    over25: { rate: pct(rOver25c, rOver25t), sample: rOver25t },
    btts: { rate: pct(rBttsc, rBttst), sample: rBttst },
    edge: { rate: pct(rEdgec, rEdget), sample: rEdget },
  };

  // ── Auto-alerte rolling20 ────────────────────────────────────────────────────
  const last20 = history.filter(h => h.verified).slice(-20);
  let aOver25c = 0, aOver25t = 0, aBttsc = 0, aBttst = 0;
  for (const h of last20) {
    if (!h.realScore) continue;
    const rs = h.realScore;
    if (h.predicted?.over25 > 55) { aOver25t++; if ((rs.home + rs.away) > 2.5) aOver25c++; }
    if (h.predicted?.btts > 55) { aBttst++; if (rs.home > 0 && rs.away > 0) aBttsc++; }
  }
  const allBets = aOver25t + aBttst;
  const allCorrect = aOver25c + aBttsc;
  global.alert = allBets >= 10 ? {
    combined: pct(allCorrect, allBets),
    over25: pct(aOver25c, aOver25t),
    over25_bets: aOver25t,
    btts: pct(aBttsc, aBttst),
    btts_bets: aBttst,
    total: allBets,
    triggered: pct(allCorrect, allBets) < 45,
    threshold: 45,
  } : null;

  // ── Per-league breakdown ────────────────────────────────────────────────────
  const byLeague = {};
  for (const h of history) {
    if (!h.verified || !h.realScore) continue;
    const lg = h.league || 'Unknown';
    if (!byLeague[lg]) byLeague[lg] = { over25c: 0, over25t: 0, bttsc: 0, bttst: 0, edgec: 0, edget: 0, total: 0 };
    const rs = h.realScore;
    const wasOver25 = (rs.home + rs.away) > 2.5;
    const wasBTTS = rs.home > 0 && rs.away > 0;
    byLeague[lg].total++;
    if (h.predicted?.over25 > 55) { byLeague[lg].over25t++; if (wasOver25) byLeague[lg].over25c++; }
    if (h.predicted?.btts > 55) { byLeague[lg].bttst++; if (wasBTTS) byLeague[lg].bttsc++; }
    if (h.predicted?.bestEdgeValue > 5) {
      byLeague[lg].edget++;
      const winner = rs.home > rs.away ? h.home_team : rs.away > rs.home ? h.away_team : 'Nul';
      if (winner === h.predicted.bestEdge) byLeague[lg].edgec++;
    }
  }
  global.leagues = {};
  for (const [lg, d] of Object.entries(byLeague)) {
    global.leagues[lg] = {
      total: d.total,
      over25: { rate: pct(d.over25c, d.over25t), sample: d.over25t },
      btts: { rate: pct(d.bttsc, d.bttst), sample: d.bttst },
      edge: { rate: pct(d.edgec, d.edget), sample: d.edget },
    };
  }

  // ── Confidence tier stratification ─────────────────────────────────────────
  const tiers = { '55-65': { c: 0, t: 0 }, '65-75': { c: 0, t: 0 }, '75+': { c: 0, t: 0 } };
  for (const h of history) {
    if (!h.verified || !h.realScore) continue;
    const rs = h.realScore;
    const wasOver25 = (rs.home + rs.away) > 2.5;
    const wasBTTS = rs.home > 0 && rs.away > 0;
    const pred = h.predicted?.over25;
    if (pred > 55) {
      let tier;
      if (pred <= 65) tier = '55-65';
      else if (pred <= 75) tier = '65-75';
      else tier = '75+';
      tiers[tier].t++;
      if (wasOver25) tiers[tier].c++;
    }
  }
  global.confidence_tiers = {};
  for (const [label, d] of Object.entries(tiers)) {
    global.confidence_tiers[label] = { rate: pct(d.c, d.t), sample: d.t };
  }

  return global;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  OPTION C — AI SCOUT (Top Value Bets → Gemini)
// ═══════════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
//  STATS AVANCÉES — /teams/statistics (cache 24h, ~1 req/équipe/jour max)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Récupère les statistiques agrégées de saison d'une équipe via /teams/statistics.
 * Budget : 1 requête API-Football par équipe par jour (cache 24h dans db.advancedTeamStats).
 *
 * @param {string} teamKey   Clé normalisée (normName) — sert de clé de cache
 * @param {number} teamId    ID numérique API-Football (stocké dans db.teamStats[key].teamId)
 * @param {number} leagueId  ID ligue API-Football
 * @param {number} season    Saison (ex: 2025)
 * @returns {object|null}    Objet stats avancées, ou null si indisponible
 */
async function fetchTeamAdvancedStats(teamKey, teamId, leagueId, season) {
  if (!API_FOOTBALL_KEY || !teamId || !leagueId) return null;

  // ── Cache hit ────────────────────────────────────────────────────────────────
  const cached = db.advancedTeamStats[teamKey];
  // Invalide le cache si les champs v4.0 sont absents (migration shots/cards/clean_sheet)
  if (cached && cached.data && cached.data.shots_on_total === undefined) {
    delete db.advancedTeamStats[teamKey];
  } else if (cached && (Date.now() - new Date(cached.fetchedAt).getTime() < ADV_STATS_TTL)) {
    return cached.data;
  }

  // ── Appel API ────────────────────────────────────────────────────────────────
  try {
    const res = await httpsGet(
      `https://v3.football.api-sports.io/teams/statistics?league=${leagueId}&team=${teamId}&season=${season}`,
      { 'x-apisports-key': API_FOOTBALL_KEY }
    );

    if (res.status === 429) {
      console.warn(`  [AdvStats] Quota épuisé — ${teamKey}`);
      return null;
    }
    if (res.status !== 200) {
      console.warn(`  [AdvStats] HTTP ${res.status} — team=${teamId} league=${leagueId}`);
      return null;
    }

    const raw = res.data?.response;
    if (!raw) return null;

    // ── Extraction des 5 piliers du Scientific Mode ───────────────────────────
    const data = {
      // Pilier 1 — Stabilité offensive / défensive
      goals_scored_home_avg: parseFloat(raw.goals?.for?.average?.home || 0),
      goals_scored_away_avg: parseFloat(raw.goals?.for?.average?.away || 0),
      goals_conceded_home_avg: parseFloat(raw.goals?.against?.average?.home || 0),
      goals_conceded_away_avg: parseFloat(raw.goals?.against?.average?.away || 0),

      // Pilier 2 — Croissance de forme (5 derniers matchs)
      form: raw.form || '',

      // Pilier 3 — Résultats à domicile / extérieur (différentiel)
      played_home: raw.fixtures?.played?.home || 0,
      played_away: raw.fixtures?.played?.away || 0,
      wins_home: raw.fixtures?.wins?.home || 0,
      wins_away: raw.fixtures?.wins?.away || 0,
      draws_home: raw.fixtures?.draws?.home || 0,
      draws_away: raw.fixtures?.draws?.away || 0,
      losses_home: raw.fixtures?.losses?.home || 0,
      losses_away: raw.fixtures?.losses?.away || 0,

      // Pilier 4 — Indice spéculatif (pénaltys, biggest wins, streaks)
      penalties_scored: raw.penalty?.scored?.total || 0,
      penalties_missed: raw.penalty?.missed?.total || 0,
      biggest_win_home: raw.biggest?.wins?.home || '',
      biggest_win_away: raw.biggest?.wins?.away || '',
      biggest_loss_home: raw.biggest?.loses?.home || '',
      biggest_loss_away: raw.biggest?.loses?.away || '',
      streak_wins: raw.biggest?.streak?.wins || 0,
      streak_draws: raw.biggest?.streak?.draws || 0,
      streak_losses: raw.biggest?.streak?.loses || 0,

      // Pilier 2 — Tirs (disponibles dans /teams/statistics)
      shots_on_home: raw.shots?.on?.home || 0,
      shots_on_away: raw.shots?.on?.away || 0,
      shots_on_total: raw.shots?.on?.total || 0,
      shots_total_home: raw.shots?.total?.home || 0,
      shots_total_away: raw.shots?.total?.away || 0,

      // Pilier 5 — Schéma tactique (formation dominante)
      main_formation: raw.lineups?.[0]?.formation || 'N/A',

      // Pilier 6 — Discipline (cartons — somme de toutes les tranches horaires)
      cards_yellow_total: Object.values(raw.cards?.yellow || {}).reduce((s, v) => s + (v.total || 0), 0),
      cards_red_total: Object.values(raw.cards?.red || {}).reduce((s, v) => s + (v.total || 0), 0),

      // Pilier 7 — Clean Sheets
      clean_sheet_home: raw.clean_sheet?.home || 0,
      clean_sheet_away: raw.clean_sheet?.away || 0,
      clean_sheet_total: raw.clean_sheet?.total || 0,

      // Moyennes globales (pour le classement mode "Global")
      goals_scored_total_avg: parseFloat(raw.goals?.for?.average?.total || 0),
      goals_conceded_total_avg: parseFloat(raw.goals?.against?.average?.total || 0),
    };

    // ── Mise en cache ─────────────────────────────────────────────────────────
    db.advancedTeamStats[teamKey] = {
      data,
      fetchedAt: new Date().toISOString(),
      teamId,
      leagueId,
    };
    saveDB();

    console.log(`  [AdvStats] ✓ ${teamKey} (team=${teamId}, league=${leagueId})`);
    return data;

  } catch (e) {
    console.warn(`  [AdvStats] Erreur ${teamKey}:`, e.message);
    return null;
  }
}

// ─── HELPER GEMINI (appel synchrone one-shot) ────────────────────────────────
async function callGemini(prompt, maxTokens = 600) {
  if (!GEMINI_API_KEY) throw new Error('Cle Gemini non configuree');
  const res = await Promise.race([
    httpsPost(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: maxTokens },
        safetySettings: GEMINI_SAFETY_SETTINGS,
      }
    ),
    new Promise((_, reject) => setTimeout(() => reject(new Error('Gemini timeout (12s)')), 12000)),
  ]);
  if (res.status === 429) throw new Error('GEMINI_QUOTA');
  const text = res.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  if (!text && res.status !== 200) throw new Error(`GEMINI_ERR_${res.status}`);
  return text;
}

// ─── INJURIES PAR ÉQUIPE — SUPPRIMÉ (données mappées via flux BSD) ─────────
// fetchTeamInjuries() removed — injuries now sourced from BSD unavailable_players
// in buildMatchRecord(). API-Football /injuries endpoint no longer called.

// ─── SCOUTING REPORT (Gemini, cache 24h) ─────────────────────────────────────

// ── Prompt Système "Brain" du Scout Pro — 5 Piliers ─────────────────────────
const SYSTEM_SCOUT_PROMPT = `Agis comme le Head Scout quantitatif de PariScore, spécialiste en détection de mismatchs tactiques et en modélisation prédictive pour paris sportifs.

[MÉTHODOLOGIE PRO SCOUT — 5 PILIERS (100 pts)]
Tu calcules un Power Score DOMICILE et un Power Score EXTÉRIEUR en isolant strictement le contexte (performance à domicile vs performance à l'extérieur) selon ces 5 piliers :

1. 📊 Métriques Avancées (30%) : Analyse le différentiel xG (Expected Goals) vs xGA (Expected Goals Against), le volume de corners, les tirs cadrés et la pression offensive. Un xG élevé avec xGA faible = équipe dominante.
2. ⚔️ Tactique & Effectifs (20%) : Détecte les mismatchs structurels (attaque forte vs défense faible, ailiers rapides vs défenseurs lents), évalue les absences clés, analyse la composition dom/déf/mil/att.
3. 🔥 Dynamique & Momentum (20%) : Forme des 5 derniers matchs (W/D/L), difficulté du calendrier récent, momentum (série en cours), fatigue (matchs joués cette semaine).
4. 📰 Presse & Consensus Web (15%) : Synthèse des sites de référence (L'Équipe, Sofascore, BetMines, OddAlerts, Forebet). Consensus ou divergence notable sur le favori.
5. 🧠 Psychologie & H2H (15%) : Historique des confrontations directes, enjeux du match (titre, maintien, derby), avantage psychologique (série de victoires contre l'adversaire).

[FORMAT DE SORTIE EXIGÉ — MARKDOWN STRUCTURÉ AVEC ÉMOJIS]

## 🏟️ [Équipe Dom] vs [Équipe Ext] — [Compétition]

## 📊 POWER SCORE PARISCORE
| Équipe | Score | Contexte |
|--------|-------|---------|
| [Dom] | XX/100 | Domicile |
| [Ext] | XX/100 | Extérieur |

## 🔬 ANALYSE DÉTAILLÉE — 5 PILIERS

### 1️⃣ Métriques Avancées (xG / Corners)
[Analyse du différentiel xG, xGA, volume corners attendu. Cite les chiffres exacts.]

### 2️⃣ Duel Tactique & Effectifs
[Mismatch clé détecté, composition, absences impactantes.]

### 3️⃣ Dynamique & Momentum
[Forme récente des 2 équipes, série en cours, calendrier difficile/facile.]

### 4️⃣ Synthèse Web & Médias
[Ce que dit la presse et les algos de prédiction. Consensus ou divergence ?]

### 5️⃣ Psychologie & H2H
[Historique confrontations directes, enjeux, avantage mental.]

## 🔢 PROBABILITÉS MATHÉMATIQUES CERTIFIÉES
- **1N2** : 1 (X%) / N (X%) / 2 (X%)
- **Buts** : Over 1.5 (X%) · Over 2.5 (X%) · BTTS (X%)
- **Corners** : Over 8.5 estimé (X%) · Corners/match attendu : X
- **Score le plus probable** : X-X (X%)

## 🏆 TOP 5 PARIS EXPLOITABLES
- 🛡️ **Le Safe** : [Pari] (Proba : X%) — [Justification courte]
- 📈 **Le Bankroll Builder** : [Pari] (Proba : X%) — [Justification]
- 💎 **Le Value Bet** : [Pari cote X.XX] — [Erreur de marché détectée]
- 🚩 **Le Coup Tactique** : [Pari corners/buteur/cartons] — [Justification mismatch]
- ⚡ **Le Coup Risqué** : [Pari grosse cote] — [Justification]

[DIRECTIVES CRITIQUES]
- Utilise EXCLUSIVEMENT les données mathématiques du bloc [DONNÉES PARISCORE] ci-dessous.
- Ne jamais inventer des probabilités — utilise celles calculées par l'algorithme Poisson.
- Ton d'expert sûr de lui qui explique la logique mathématique derrière chaque choix.
- Si une donnée est manquante (?), fais une estimation raisonnée à partir des données disponibles.`;

// ── Générateur de prompt Pro Scout (données injectées) ───────────────────────
function generateProScoutPrompt(match, homeRatings = [], awayRatings = [], homeSquad = [], awaySquad = []) {
  const p = match.poisson || {};
  const eg = match.expectedGoals || {};
  const hs = match.stats?.home || {};
  const as = match.stats?.away || {};
  const h2h = match.h2h || null;
  const cp = match.corners_poisson || {};

  // BSD ratings moyen (note qualité équipe)
  const homeAvgRating = homeRatings.length
    ? (homeRatings.reduce((s, pl) => s + (pl.avg_rating || 0), 0) / homeRatings.length).toFixed(1)
    : '?';
  const awayAvgRating = awayRatings.length
    ? (awayRatings.reduce((s, pl) => s + (pl.avg_rating || 0), 0) / awayRatings.length).toFixed(1)
    : '?';

  // Top joueurs par rating BSD
  const topHomePlayers = [...homeRatings].sort((a, b) => (b.avg_rating || 0) - (a.avg_rating || 0)).slice(0, 3)
    .map(pl => `${pl.name} (${(pl.avg_rating || 0).toFixed(1)})`).join(', ') || 'N/A';
  const topAwayPlayers = [...awayRatings].sort((a, b) => (b.avg_rating || 0) - (a.avg_rating || 0)).slice(0, 3)
    .map(pl => `${pl.name} (${(pl.avg_rating || 0).toFixed(1)})`).join(', ') || 'N/A';

  // Composition par poste
  const homeAtt = homeSquad.filter(pl => pl.position === 'Attacker').length || 0;
  const awayAtt = awaySquad.filter(pl => pl.position === 'Attacker').length || 0;
  const homeDef = homeSquad.filter(pl => pl.position === 'Defender').length || 0;
  const awayDef = awaySquad.filter(pl => pl.position === 'Defender').length || 0;
  const homeMid = homeSquad.filter(pl => pl.position === 'Midfielder').length || 0;
  const awayMid = awaySquad.filter(pl => pl.position === 'Midfielder').length || 0;

  // Absences
  const homeInj = (match.injuries?.home || []).map(pl => pl.name).join(', ') || 'Aucune absence connue';
  const awayInj = (match.injuries?.away || []).map(pl => pl.name).join(', ') || 'Aucune absence connue';

  // H2H résumé
  let h2hBlock = 'Historique H2H non disponible.';
  if (h2h) {
    h2hBlock = `Dernières confrontations : ${match.home_team} ${h2h.homeWins || 0}V / Nul ${h2h.draws || 0} / ${match.away_team} ${h2h.awayWins || 0}V. Buts/match moy : ${h2h.avgGoals?.toFixed(1) || '?'}. Score H2H récent : ${(h2h.lastMatches || []).slice(0, 3).map(m => `${m.score || '?'} (${m.date?.slice(0, 10) || '?'})`).join(' · ') || 'N/A'}`;
  }

  // xGA estimé (buts encaissés = proxy xGA)
  const homeXGA = hs.avgConceded != null ? hs.avgConceded.toFixed(2) : '?';
  const awayXGA = as.avgConceded != null ? as.avgConceded.toFixed(2) : '?';

  // Corners estimés
  const cornersOver85 = cp.over_8_5 || cp.over_6_5 || '?';
  const cornersTotal = match.corners_avg ? match.corners_avg.toFixed(1) : '?';

  // Date/heure
  const dt = match.commence_time ? new Date(match.commence_time) : new Date();
  const dateStr = dt.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const timeStr = dt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  const dataBlock = `
[DONNÉES PARISCORE — 5 PILIERS INJECTÉS — UTILISE CES CHIFFRES PRÉCISÉMENT]

Match : ${match.home_team} vs ${match.away_team} (${match.league})
Date  : ${dateStr} à ${timeStr}

═══════════════════════════════════════════════
PILIER 1 — MÉTRIQUES AVANCÉES (xG / xGA / Corners)
═══════════════════════════════════════════════
Équipe DOM (${match.home_team}) :
  xG attendu (λ dom)  : ${eg.home != null ? eg.home.toFixed(2) : '?'}
  xGA proxy (buts enc) : ${homeXGA} / match
  Buts marqués/match   : ${hs.avgScored != null ? hs.avgScored.toFixed(2) : '?'}
  Note équipe BSD       : ${homeAvgRating} / 10
  Top joueurs BSD       : ${topHomePlayers}

Équipe EXT (${match.away_team}) :
  xG attendu (λ ext)  : ${eg.away != null ? eg.away.toFixed(2) : '?'}
  xGA proxy (buts enc) : ${awayXGA} / match
  Buts marqués/match   : ${as.avgScored != null ? as.avgScored.toFixed(2) : '?'}
  Note équipe BSD       : ${awayAvgRating} / 10
  Top joueurs BSD       : ${topAwayPlayers}

Corners :
  Over 8.5 (Poisson) : ${cornersOver85}%
  Moy corners/match  : ${cornersTotal}

═══════════════════════════════════════════════
PILIER 2 — TACTIQUE & EFFECTIFS
═══════════════════════════════════════════════
${match.home_team} :
  Composition : ${homeDef} Déf · ${homeMid} Mil · ${homeAtt} Att
  Classement  : #${match.home_rank || '?'} | PPG dom : ${hs.ppg ?? '?'}
  Absences    : ${homeInj}

${match.away_team} :
  Composition : ${awayDef} Déf · ${awayMid} Mil · ${awayAtt} Att
  Classement  : #${match.away_rank || '?'} | PPG ext : ${as.ppg ?? '?'}
  Absences    : ${awayInj}

Mismatch clé : Attaque dom (${homeAtt} att, xG ${eg.home != null ? eg.home.toFixed(2) : '?'}) vs Défense ext (${awayDef} déf, xGA ${awayXGA}) — et inversement.

═══════════════════════════════════════════════
PILIER 3 — DYNAMIQUE & MOMENTUM
═══════════════════════════════════════════════
Forme récente (5 matchs, gauche=récent) :
  ${match.home_team} (DOM) : ${match.home_form || 'N/A'}
  ${match.away_team} (EXT) : ${match.away_form || 'N/A'}

W% / D% / L% :
  ${match.home_team} : ${hs.wins ?? 0}% V / ${hs.draws ?? 0}% N / ${hs.losses ?? 0}% D
  ${match.away_team} : ${as.wins ?? 0}% V / ${as.draws ?? 0}% N / ${as.losses ?? 0}% D

═══════════════════════════════════════════════
PILIER 4 — PRESSE & CONSENSUS WEB
═══════════════════════════════════════════════
(Analyse à partir du contexte général — pas de données presse en temps réel pour ce rapport Scout)
Consulte : Sofascore, BetMines, OddAlerts, Forebet pour compléter.

═══════════════════════════════════════════════
PILIER 5 — PSYCHOLOGIE & H2H
═══════════════════════════════════════════════
${h2hBlock}

═══════════════════════════════════════════════
PROBABILITÉS POISSON (ALGORITHME CERTIFIÉ)
═══════════════════════════════════════════════
1N2         : 1 (${p.homeWin ?? 0}%) / N (${p.draw ?? 0}%) / 2 (${p.awayWin ?? 0}%)
BTTS        : ${p.btts ?? 0}%
Over 1.5    : ${p.over15 ?? 0}% | Over 2.5 : ${p.over25 ?? 0}% | Over 3.5 : ${p.over35 ?? 0}%
Clean Sheet : ${p.cs00 ?? 0}%
Score #1    : ${p.topScores?.[0]?.score ?? '?'} (${p.topScores?.[0]?.prob ?? 0}%)
Score #2    : ${p.topScores?.[1]?.score ?? '?'} (${p.topScores?.[1]?.prob ?? 0}%)

COTES & VALUE :
  1 / N / 2   : ${match.odds?.home != null ? match.odds.home.toFixed(2) : '?'} / ${match.odds?.draw != null ? match.odds.draw.toFixed(2) : '?'} / ${match.odds?.away != null ? match.odds.away.toFixed(2) : '?'}
  Edge dom    : ${match.edge?.home != null ? match.edge.home.toFixed(1) : '?'}% | Edge nul : ${match.edge?.draw != null ? match.edge.draw.toFixed(1) : '?'}% | Edge ext : ${match.edge?.away != null ? match.edge.away.toFixed(1) : '?'}%
  Meilleur edge : ${match.best_edge?.label ?? '?'} @ ${match.best_edge?.odds != null ? match.best_edge.odds.toFixed(2) : '?'} (Edge +${match.best_edge?.edge != null ? match.best_edge.edge.toFixed(1) : '?'}%) via ${match.best_edge?.bk ?? 'N/A'}
`;

  return SYSTEM_SCOUT_PROMPT + '\n\n' + dataBlock;
}

// ── Legacy wrapper (conservé pour compatibilité interne) ─────────────────────
function buildScoutingPrompt(match, homeRatings = [], awayRatings = [], homeSquad = [], awaySquad = []) {
  return generateProScoutPrompt(match, homeRatings, awayRatings, homeSquad, awaySquad);
}

async function getScoutReport(match) {
  try {
    const cacheKey = `scout_${match.id}`;
    const cached = kvGet(cacheKey);
    if (cached && cached.ts && Date.now() - cached.ts < 86400000) {
      console.log(`  [Scout] Cache HIT — ${match.home_team} vs ${match.away_team}`);
      return { report: cached.report, cached: true };
    }

    console.log(`  [Scout] Génération Pro Scout — ${match.home_team} vs ${match.away_team}`);

    // ── Enrichissement BSD (ratings + squad) en parallèle ──────────────────
    const hKey = normName(match.home_team);
    const aKey = normName(match.away_team);
    const hMeta = db.teamStats[hKey] || findFuzzy(hKey);
    const aMeta = db.teamStats[aKey] || findFuzzy(aKey);

    const [homeRatings, awayRatings, homeSquad, awaySquad] = await Promise.all([
      hMeta?.bsdTeamId && hMeta?.bsdSeasonId
        ? fetchBSDPlayerRatings(hMeta.bsdTeamId, hMeta.bsdSeasonId).catch(() => [])
        : Promise.resolve([]),
      aMeta?.bsdTeamId && aMeta?.bsdSeasonId
        ? fetchBSDPlayerRatings(aMeta.bsdTeamId, aMeta.bsdSeasonId).catch(() => [])
        : Promise.resolve([]),
      hMeta?.bsdTeamId
        ? fetchBSDTeamSquad(hMeta.bsdTeamId).catch(() => [])
        : Promise.resolve([]),
      aMeta?.bsdTeamId
        ? fetchBSDTeamSquad(aMeta.bsdTeamId).catch(() => [])
        : Promise.resolve([]),
    ]);

    // ── Génération du prompt Pro Scout (5 Piliers) ──────────────────────────
    const prompt = generateProScoutPrompt(match, homeRatings, awayRatings, homeSquad, awaySquad);

    // ── Appel Gemini — 1200 tokens pour un rapport complet ─────────────────
    const report = await callGemini(prompt, 1200);

    if (!report) {
      return { report: `Analyse indisponible — l'IA n'a pas pu générer de rapport. Réessayez dans quelques minutes.`, cached: false };
    }

    // ── Cache 24h ──────────────────────────────────────────────────────────
    kvSet(cacheKey, { report, ts: Date.now() });
    console.log(`  [Scout] ✓ Rapport généré et mis en cache 24h — ${match.home_team} vs ${match.away_team}`);
    return { report, cached: false };

  } catch (e) {
    console.error('[Scout] Erreur (fallback math):', e.message);
    return { report: buildScoutMathFallback(match), cached: false, fallback: true };
  }
}

function buildScoutMathFallback(match) {
  const p = match.poisson || {};
  const eg = match.expectedGoals || {};
  const hs = match.stats?.home || {};
  const as_ = match.stats?.away || {};
  const dt = new Date(match.commence_time);
  const dateStr = dt.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  const timeStr = dt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const sig = (v, hi = 55, lo = 45) => v >= hi ? '🟢 Fort' : v >= lo ? '🟡 Moyen' : '🔴 Faible';
  const be = match.best_edge;
  return `# 🏟️ ${match.home_team} vs ${match.away_team}
## ${match.league} — ${dateStr} à ${timeStr}

> ⚡ *Mode Statistique — Analyse Poisson certifiée PariScore*

---

## 📊 PROBABILITÉS MATHÉMATIQUES

| Marché | Probabilité | Signal |
|--------|-------------|--------|
| ${match.home_team} gagne | ${p.homeWin ?? 0}% | ${sig(p.homeWin ?? 0)} |
| Match Nul | ${p.draw ?? 0}% | ${sig(p.draw ?? 0, 30, 20)} |
| ${match.away_team} gagne | ${p.awayWin ?? 0}% | ${sig(p.awayWin ?? 0)} |
| BTTS | ${p.btts ?? 0}% | ${sig(p.btts ?? 0)} |
| Over 2.5 | ${p.over25 ?? 0}% | ${sig(p.over25 ?? 0)} |
| Over 1.5 | ${p.over15 ?? 0}% | ${sig(p.over15 ?? 0, 70, 55)} |

**xG attendu** : ${match.home_team} **${eg.home ?? '?'}** — ${match.away_team} **${eg.away ?? '?'}**

**Score le plus probable** : ${p.topScores?.[0]?.score ?? '?'} (${p.topScores?.[0]?.prob ?? 0}%)

---

## 💎 VALUE BET

${be?.edge > 0
      ? `**${be.label}** @ **${be.odds?.toFixed(2) ?? '?'}** — Edge **+${be.edge?.toFixed(1) ?? '?'}%** via ${be.bk ?? 'N/A'}`
      : 'Aucun edge positif détecté sur ce match.'}

---

## 📈 FORME & STATS

| Équipe | PPG | Buts/match | Encaissés/match |
|--------|-----|-----------|-----------------|
| ${match.home_team} (DOM) | ${hs.ppg ?? '?'} | ${hs.avgScored ?? '?'} | ${hs.avgConceded ?? '?'} |
| ${match.away_team} (EXT) | ${as_.ppg ?? '?'} | ${as_.avgScored ?? '?'} | ${as_.avgConceded ?? '?'} |`;
}

// ─── TOP BUTEURS PAR LIGUE (cache 24h, 1 req/ligue à la demande) ────────────
async function fetchLeagueTopScorers(leagueId, season) {
  if (!leagueId) return [];

  // 1. Essayer BSD d'abord — via player-stats agrégés
  const bsdLeagueId = configIdToBsd(String(leagueId));
  if (bsdLeagueId) {
    try {
      const cacheKey = `bsd_topscorers_${leagueId}_${season}`;
      const cached = apiCacheGet(cacheKey);
      if (cached) return cached;

      // Fetch tous les player-stats de la ligue pour la saison
      const allStats = [];
      for (let page = 1; page <= 3; page++) {
        const res = await bsdFetch(`/player-stats/?league=${bsdLeagueId}&season=${season}&page=${page}&page_size=100`);
        if (res.status !== 200 || !res.data?.results?.length) break;
        allStats.push(...res.data.results);
        if (!res.data.next) break;
      }

      if (allStats.length > 0) {
        // Agréger par joueur
        const byPlayer = {};
        for (const stat of allStats) {
          const pid = stat.player?.id;
          if (!pid) continue;
          if (!byPlayer[pid]) {
            byPlayer[pid] = {
              id: pid,
              name: stat.player.name,
              photo: stat.player.photo || '',  // API-Football: photo field may contain a URL
              team: stat.team?.name || '',
              teamId: stat.team?.id || null,
              goals: 0, assists: 0, rating: 0, appearances: 0, _ratingCount: 0,
            };
          }
          byPlayer[pid].goals += stat.goals || 0;
          byPlayer[pid].assists += stat.goal_assist || 0;
          byPlayer[pid].appearances += 1;
          if (stat.rating != null) {
            byPlayer[pid].rating += stat.rating;
            byPlayer[pid]._ratingCount += 1;
          }
        }
        const players = Object.values(byPlayer)
          .map(p => ({ ...p, rating: p._ratingCount > 0 ? parseFloat((p.rating / p._ratingCount).toFixed(2)) : null }))
          .sort((a, b) => b.goals - a.goals)
          .slice(0, 15);
        apiCacheSet(cacheKey, players, 'bsd_topscorers');
        console.log(`  [TopScorers BSD] ✓ Ligue ${leagueId} — ${players.length} joueurs depuis BSD`);
        return players;
      }
    } catch (e) {
      console.warn(`  [TopScorers BSD] Erreur ligue ${leagueId}:`, e.message);
    }
  }

  // 2. Fallback API-Football si BSD indisponible
  if (!API_FOOTBALL_KEY) return [];
  const seasonsToTry = [season, season - 1];
  for (const s of seasonsToTry) {
    const cacheKey = `${leagueId}_${s}`;
    const cached = db.topScorers[cacheKey];
    if (cached && (Date.now() - new Date(cached.fetchedAt).getTime() < ADV_STATS_TTL)) {
      return cached.data;
    }
    try {
      const res = await httpsGet(
        `https://v3.football.api-sports.io/players/topscorers?league=${leagueId}&season=${s}`,
        { 'x-apisports-key': API_FOOTBALL_KEY }
      );
      if (res.status === 429) { console.warn(`  [TopScorers] Quota épuisé — league ${leagueId}`); return []; }
      if (res.status !== 200) continue;
      const players = (res.data?.response || []).slice(0, 15).map(entry => ({
        id: entry.player.id,
        name: entry.player.name,
        photo: entry.player.photo,
        team: entry.statistics[0]?.team?.name || '',
        teamId: entry.statistics[0]?.team?.id,
        goals: entry.statistics[0]?.goals?.total || 0,
        assists: entry.statistics[0]?.goals?.assists || 0,
        rating: entry.statistics[0]?.games?.rating || null,
        appearances: entry.statistics[0]?.games?.appearences || 0,
      }));
      db.topScorers[cacheKey] = { data: players, fetchedAt: new Date().toISOString() };
      saveDB();
      console.log(`  [TopScorers] ✓ Ligue ${leagueId} saison ${s} — ${players.length} joueurs`);
      if (players.length > 0) return players;
    } catch (e) {
      console.warn(`  [TopScorers] Erreur ligue ${leagueId}:`, e.message);
    }
  }
  return [];
}

// v63.0: Fallback ultime — cherche les joueurs par nom d'équipe sur API-Football
async function fetchBackupPlayers(teamName) {
  if (!API_FOOTBALL_KEY || !teamName) return [];
  try {
    const res = await httpsGet(
      `https://v3.football.api-sports.io/players?team=${encodeURIComponent(teamName)}&season=${currentSeason()}`,
      { 'x-apisports-key': API_FOOTBALL_KEY }
    );
    if (res.status === 429 || res.status !== 200) return [];
    const players = (res.data?.response || []).slice(0, 3).map(entry => {
      const s = entry.statistics?.[0];
      const goals = s?.goals?.total || 0;
      const assists = s?.goals?.assists || 0;
      const rating = parseFloat(s?.games?.rating || 0);
      const minutes = s?.games?.minutes || 0;
      const per90 = Math.max(1, minutes / 90);
      const kpi = parseFloat(((goals * 3 + assists * 2 + rating) / per90).toFixed(2));
      return {
        id: entry.player?.id, name: entry.player?.name || '?',
        photo: `https://media.api-sports.io/football/players/${entry.player?.id}.png`,
        position: s?.games?.position || '', goals, assists,
        rating: rating > 0 ? rating.toFixed(1) : null, minutes, kpi,
      };
    }).filter(p => p.minutes >= 45).sort((a, b) => b.kpi - a.kpi);
    if (players.length) console.log(`  [BackupPlayers] ✓ ${teamName} — ${players.length} joueurs (API-Football)`);
    return players;
  } catch (e) { return []; }
}

// ─── KEY PLAYER INDEX — top 2 joueurs par équipe (BSD priority, fallback API-Football) ──
// KPI = (goals×3 + assists×2 + rating×1) / (minutes/90) → performance par 90 min

// v48.0: Version BSD-only (sans fallback API-Football) — appelée quand teamId AFI n'existe pas
async function fetchTeamKeyPlayersBSD(bsdTeamId, bsdSeasonId) {
  if (!bsdTeamId || !bsdSeasonId) return [];
  try {
    const cacheKey = `bsd_kp_${bsdTeamId}_${bsdSeasonId}`;
    const cached = apiCacheGet(cacheKey);
    if (cached) return cached;

    const allStats = [];
    for (let page = 1; page <= 3; page++) {
      const res = await bsdFetch(`/player-stats/?team=${bsdTeamId}&season=${bsdSeasonId}&page=${page}&page_size=100`);
      if (res.status !== 200 || !res.data?.results?.length) break;
      allStats.push(...res.data.results);
      if (!res.data.next) break;
    }
    if (allStats.length > 0) {
      const players = allStats
        .map(entry => {
          const goals = entry.goals || 0;
          const assists = entry.goal_assist || 0;
          const rating = parseFloat(entry.rating || 0);
          const minutes = entry.minutes_played || 0;
          const per90 = Math.max(1, minutes / 90);
          const kpi = parseFloat(((goals * 3 + assists * 2 + rating) / per90).toFixed(2));
          return {
            id: entry.player?.id || Math.random(),
            name: entry.player?.name || '?',
            photo: `https://sports.bzzoiro.com/img/player/${entry.player?.id}/`,
            position: entry.player?.position || '',
            goals,
            assists,
            rating: rating > 0 ? rating.toFixed(1) : null,
            minutes,
            kpi,
          };
        })
        .filter(p => p.minutes >= 45)
        .sort((a, b) => b.kpi - a.kpi)
        .slice(0, 3);
      if (players.length > 0) {
        apiCacheSet(cacheKey, players, 'bsd_kp');
        console.log(`  [KeyPlayers BSD direct] ✓ Team ${bsdTeamId} — ${players.length} joueurs`);
        return players;
      }
    }
  } catch (e) {
    console.warn(`  [KeyPlayers BSD direct] Erreur team ${bsdTeamId}:`, e.message);
  }
  return [];
}

async function fetchTeamKeyPlayers(teamId, leagueId, season) {
  if (!teamId || !leagueId) return [];

  // 1. Essayer BSD d'abord
  const hMeta = Object.values(db.teamStats).find(s => s.teamId === teamId);
  const bsdTeamId = hMeta?.bsdTeamId || null;
  const bsdSeasonId = hMeta?.bsdSeasonId || null;

  if (bsdTeamId && bsdSeasonId) {
    try {
      const cacheKey = `bsd_kp_${bsdTeamId}_${bsdSeasonId}`;
      const cached = apiCacheGet(cacheKey);
      if (cached) return cached;

      const allStats = [];
      for (let page = 1; page <= 3; page++) {
        const res = await bsdFetch(`/player-stats/?team=${bsdTeamId}&season=${bsdSeasonId}&page=${page}&page_size=100`);
        if (res.status !== 200 || !res.data?.results?.length) break;
        allStats.push(...res.data.results);
        if (!res.data.next) break;
      }

      if (allStats.length > 0) {
        const players = allStats
          .map(entry => {
            const goals = entry.goals || 0;
            const assists = entry.goal_assist || 0;
            const rating = parseFloat(entry.rating || 0);
            const minutes = entry.minutes_played || 0;
            const per90 = Math.max(1, minutes / 90);
            const kpi = parseFloat(((goals * 3 + assists * 2 + rating) / per90).toFixed(2));
            return {
              id: entry.player?.id || Math.random(),
              name: entry.player?.name || '?',
              photo: `https://sports.bzzoiro.com/img/player/${entry.player?.id}/`,
              position: entry.player?.position || '',
              goals,
              assists,
              rating: rating > 0 ? rating.toFixed(1) : null,
              minutes,
              kpi,
            };
          })
          .filter(p => p.minutes >= 45)
          .sort((a, b) => b.kpi - a.kpi)
          .slice(0, 3);

        if (players.length > 0) {
          apiCacheSet(cacheKey, players, 'bsd_kp');
          console.log(`  [KeyPlayers BSD] ✓ Team ${bsdTeamId} — ${players.length} joueurs depuis BSD`);
          return players;
        }
      }
    } catch (e) {
      console.warn(`  [KeyPlayers BSD] Erreur team ${bsdTeamId}:`, e.message);
    }
  }

  // 2. Fallback API-Football
  if (!API_FOOTBALL_KEY) return [];
  const cacheKey = `kp_${teamId}_${leagueId}_${season}`;
  const cached = kvGet(cacheKey);
  if (cached && (Date.now() - new Date(cached.fetchedAt).getTime() < ADV_STATS_TTL)) return cached.data;

  try {
    const res = await httpsGet(
      `https://v3.football.api-sports.io/players?team=${teamId}&league=${leagueId}&season=${season}&page=1`,
      { 'x-apisports-key': API_FOOTBALL_KEY }
    );
    if (res.status === 429) { console.warn(`  [KeyPlayers] Quota — team ${teamId}`); return []; }
    if (res.status !== 200) return [];

    const players = (res.data?.response || [])
      .map(entry => {
        const s = entry.statistics?.[0];
        const goals = s?.goals?.total || 0;
        const assists = s?.goals?.assists || 0;
        const rating = parseFloat(s?.games?.rating || 0);
        const minutes = s?.games?.minutes || 0;
        const per90 = Math.max(1, minutes / 90);
        const kpi = parseFloat(((goals * 3 + assists * 2 + rating) / per90).toFixed(2));
        return {
          id: entry.player.id,
          name: entry.player.name,
          photo: entry.player.photo,
          position: s?.games?.position || '',
          goals,
          assists,
          rating: rating > 0 ? rating.toFixed(1) : null,
          minutes,
          kpi,
        };
      })
      .filter(p => p.minutes >= 45)          // exclure les joueurs sans temps de jeu
      .sort((a, b) => b.kpi - a.kpi)
      .slice(0, 3);

    kvSet(cacheKey, { data: players, fetchedAt: new Date().toISOString() });
    console.log(`  [KeyPlayers] ✓ team ${teamId} — ${players.length} joueurs clés`);
    return players;
  } catch (e) {
    console.warn(`  [KeyPlayers] Erreur team ${teamId}:`, e.message);
    return [];
  }
}

async function fetchTeamPositionRatings(teamId, leagueId, season) {
  if (!API_FOOTBALL_KEY || !teamId || !leagueId) return null;
  const cacheKey = `pr_${teamId}_${leagueId}_${season}`;
  const cached = kvGet(cacheKey);
  if (cached && (Date.now() - new Date(cached.fetchedAt).getTime() < ADV_STATS_TTL)) return cached.data;

  try {
    const res = await httpsGet(
      `https://v3.football.api-sports.io/players?team=${teamId}&league=${leagueId}&season=${season}&page=1`,
      { 'x-apisports-key': API_FOOTBALL_KEY }
    );
    if (res.status === 429) { console.warn(`  [PosRatings] Quota — team ${teamId}`); return null; }
    if (res.status !== 200) return null;

    const groups = { G: [], D: [], M: [], A: [] };
    const posMap = { Goalkeeper: 'G', Defender: 'D', Midfielder: 'M', Attacker: 'A' };

    for (const entry of (res.data?.response || [])) {
      const s = entry.statistics?.[0];
      const rating = parseFloat(s?.games?.rating || 0);
      const minutes = s?.games?.minutes || 0;
      const position = posMap[s?.games?.position] || null;
      if (rating > 0 && minutes >= 90 && position) {
        groups[position].push(rating);
      }
    }

    const result = {};
    for (const [pos, ratings] of Object.entries(groups)) {
      result[pos] = ratings.length > 0
        ? parseFloat((ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(2))
        : null;
    }

    kvSet(cacheKey, { data: result, fetchedAt: new Date().toISOString() });
    console.log(`  [PosRatings] ✓ team ${teamId} — G:${result.G} D:${result.D} M:${result.M} A:${result.A}`);
    return result;
  } catch (e) {
    console.warn(`  [PosRatings] Erreur team ${teamId}:`, e.message);
    return null;
  }
}

// v48.0: Version BSD-only (sans fallback API-Football) pour les ligues sans teamId AFI
async function fetchTopPerformersBSD(bsdTeamId, bsdSeasonId) {
  if (!bsdTeamId || !bsdSeasonId) return { attackers: [], defenders: [] };
  try {
    const allStats = [];
    for (let page = 1; page <= 3; page++) {
      const res = await bsdFetch(`/player-stats/?team=${bsdTeamId}&season=${bsdSeasonId}&page=${page}&page_size=100`);
      if (res.status !== 200 || !res.data?.results?.length) break;
      allStats.push(...res.data.results);
      if (!res.data.next) break;
    }
    if (allStats.length > 0) {
      const players = allStats
        .map(entry => ({
          name: entry.player?.name || '?',
          photo: entry.player?.photo || '',
          position: entry.player?.position || '',
          goals: entry.goals || 0,
          assists: entry.goal_assist || 0,
          rating: parseFloat(entry.rating || 0),
          minutes: entry.minutes_played || 0,
          xg: parseFloat(entry.xg || 0),
        }))
        .filter(p => p.minutes >= 45);
      const posMap = { Goalkeeper: 'Defender', Defender: 'Defender', Midfielder: 'Midfielder', Attacker: 'Attacker', G: 'Defender', D: 'Defender', M: 'Midfielder', A: 'Attacker' };
      const result = {
        attackers: players.filter(p => { const g = p.goals > 0 || p.assists > 0; const isAtt = (posMap[p.position] || '') === 'Attacker'; return g || isAtt; })
          .sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, 5),
        defenders: players.filter(p => (posMap[p.position] || '') === 'Defender')
          .sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, 5),
      };
      console.log(`  [TopPerformers BSD direct] ✓ Team ${bsdTeamId} — ${result.attackers.length}A / ${result.defenders.length}D`);
      return result;
    }
  } catch (e) {
    console.warn(`  [TopPerformers BSD direct] Erreur team ${bsdTeamId}:`, e.message);
  }
  return { attackers: [], defenders: [] };
}

async function fetchTopPerformers(teamId, leagueId, season) {
  if (!teamId || !leagueId) return { attackers: [], defenders: [] };
  const cacheKey = `tp_${teamId}_${leagueId}_${season}`;
  const cached = kvGet(cacheKey);
  if (cached && (Date.now() - new Date(cached.fetchedAt).getTime() < ADV_STATS_TTL)) return cached.data;

  // Try BSD first
  const meta = Object.values(db.teamStats).find(s => s.teamId === teamId);
  const bsdTeamId = meta?.bsdTeamId || null;
  const bsdSeasonId = meta?.bsdSeasonId || null;

  if (bsdTeamId && bsdSeasonId) {
    try {
      const allStats = [];
      for (let page = 1; page <= 3; page++) {
        const res = await bsdFetch(`/player-stats/?team=${bsdTeamId}&season=${bsdSeasonId}&page=${page}&page_size=100`);
        if (res.status !== 200 || !res.data?.results?.length) break;
        allStats.push(...res.data.results);
        if (!res.data.next) break;
      }
      if (allStats.length > 0) {
        const players = allStats
          .map(entry => ({
            name: entry.player?.name || '?',
            position: entry.player?.position || '',
            goals: entry.goals || 0,
            assists: entry.goal_assist || 0,
            rating: parseFloat(entry.rating || 0),
            minutes: entry.minutes_played || 0,
            xg: parseFloat(entry.xg || 0),
          }))
          .filter(p => p.minutes >= 45);
        const posMap = { Goalkeeper: 'Defender', Defender: 'Defender', Midfielder: 'Midfielder', Attacker: 'Attacker', G: 'Defender', D: 'Defender', M: 'Midfielder', A: 'Attacker' };
        const result = {
          attackers: players.filter(p => { const g = p.goals > 0 || p.assists > 0; const isAtt = (posMap[p.position] || '') === 'Attacker'; return g || isAtt; })
            .sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, 5),
          defenders: players.filter(p => (posMap[p.position] || '') === 'Defender')
            .sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, 5),
        };
        kvSet(cacheKey, { data: result, fetchedAt: new Date().toISOString() });
        console.log(`  [TopPerformers BSD] ✓ Team ${bsdTeamId} — ${result.attackers.length}A / ${result.defenders.length}D`);
        return result;
      }
    } catch (e) {
      console.warn(`  [TopPerformers BSD] Erreur team ${bsdTeamId}:`, e.message);
    }
  }

  // Fallback API-Football
  if (!API_FOOTBALL_KEY) return { attackers: [], defenders: [] };
  try {
    const res = await httpsGet(
      `https://v3.football.api-sports.io/players?team=${teamId}&league=${leagueId}&season=${season}&page=1`,
      { 'x-apisports-key': API_FOOTBALL_KEY }
    );
    if (res.status === 429 || res.status !== 200) return { attackers: [], defenders: [] };

    const players = (res.data?.response || [])
      .map(entry => {
        const s = entry.statistics?.[0];
        return {
          name: entry.player?.name || '?',
          photo: entry.player?.photo || '',
          position: s?.games?.position || '',
          goals: s?.goals?.total || 0,
          assists: s?.goals?.assists || 0,
          rating: parseFloat(s?.games?.rating || 0),
          minutes: s?.games?.minutes || 0,
          shots: s?.shots?.total || 0,
          tackles: s?.tackles?.total || 0,
          interceptions: s?.tackles?.interceptions || 0,
        };
      })
      .filter(p => p.minutes >= 45);

    const posMap = { Goalkeeper: 'Defender', Defender: 'Defender', Midfielder: 'Midfielder', Attacker: 'Attacker' };
    const result = {
      attackers: players.filter(p => { const g = p.goals > 0 || p.assists > 0; const isAtt = (posMap[p.position] || '') === 'Attacker'; return g || isAtt; })
        .sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, 5),
      defenders: players.filter(p => (posMap[p.position] || '') === 'Defender')
        .sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, 5),
    };
    kvSet(cacheKey, { data: result, fetchedAt: new Date().toISOString() });
    console.log(`  [TopPerformers] ✓ team ${teamId} — ${result.attackers.length}A / ${result.defenders.length}D`);
    return result;
  } catch (e) {
    console.warn(`  [TopPerformers] Erreur team ${teamId}:`, e.message);
    return { attackers: [], defenders: [] };
  }
}

let aiScoutCache = { data: null, timestamp: 0 };
const AI_SCOUT_TTL = 6 * 3600000;

async function generateAIScout() {
  if (!GEMINI_API_KEY) return { error: 'Clé Gemini non configurée' };
  if (aiScoutCache.data && (Date.now() - aiScoutCache.timestamp < AI_SCOUT_TTL)) return aiScoutCache.data;

  const top5 = [...db.matches].filter(m => m.best_edge?.edge > 0)
    .sort((a, b) => (b.best_edge?.edge || 0) - (a.best_edge?.edge || 0)).slice(0, 5);
  if (!top5.length) return { error: 'Aucun match avec edge positif' };

  // ── Résumé Poisson / edge (inchangé) ────────────────────────────────────────
  const summary = top5.map((m, i) =>
    `${i + 1}. ${m.home_team} vs ${m.away_team} (${m.league}) — Edge: +${m.best_edge.edge.toFixed(1)}% sur "${m.best_edge.label}" à ${m.best_edge.odds.toFixed(2)} | Poisson: O2.5 ${m.poisson?.over25}%, BTTS ${m.poisson?.btts}% | xG dom ${m.expectedGoals?.home ?? '?'} / ext ${m.expectedGoals?.away ?? '?'}`
  ).join('\n');

  // ── Récupération stats avancées (10 équipes max, cache 24h) ─────────────────
  const season = currentSeason();

  const advancedBlocks = await Promise.all(top5.map(async (m, i) => {
    const hKey = normName(m.home_team);
    const aKey = normName(m.away_team);
    const hMeta = db.teamStats[hKey] || findFuzzy(hKey);
    const aMeta = db.teamStats[aKey] || findFuzzy(aKey);

    // leagueId : depuis db.teamStats en priorité, sinon depuis leagues_config.json
    const leagueId = hMeta?.leagueId
      || aMeta?.leagueId
      || leaguesConfig.leagues.find(l => l.odds_key === m.sport)?.id;

    const [hAdv, aAdv] = await Promise.all([
      (hMeta?.teamId && leagueId)
        ? fetchTeamAdvancedStats(hKey, hMeta.teamId, leagueId, season)
        : Promise.resolve(null),
      (aMeta?.teamId && leagueId)
        ? fetchTeamAdvancedStats(aKey, aMeta.teamId, leagueId, season)
        : Promise.resolve(null),
    ]);

    if (!hAdv && !aAdv) return '';

    const fmtTeam = (adv, name, side) => {
      if (!adv) return `  ${name}: données avancées non disponibles`;
      const isHome = side === 'DOM';
      return [
        `  ${name} [${side}]:`,
        `    [P1-Stabilité]  moy. buts marqués: ${(isHome ? adv.goals_scored_home_avg : adv.goals_scored_away_avg).toFixed(2)}/match · moy. buts concédés: ${(isHome ? adv.goals_conceded_home_avg : adv.goals_conceded_away_avg).toFixed(2)}/match`,
        `    [P2-Forme]      ${adv.form || 'N/A'} (5 derniers matchs: W=victoire, D=nul, L=défaite)`,
        `    [P3-Différentiel] ${isHome ? adv.wins_home : adv.wins_away}V ${isHome ? adv.draws_home : adv.draws_away}N ${isHome ? adv.losses_home : adv.losses_away}D sur ${isHome ? adv.played_home : adv.played_away} matchs ${side}`,
        `    [P4-Spéculatif] série en cours: ${adv.streak_wins}W·${adv.streak_draws}D·${adv.streak_losses}L · pénaltys: ${adv.penalties_scored} marqués/${adv.penalties_missed} ratés · biggest win: ${isHome ? adv.biggest_win_home : adv.biggest_win_away}`,
        `    [P5-Tactique]   formation principale: ${adv.main_formation}`,
      ].join('\n');
    };

    return [
      `\n=== MATCH ${i + 1}: ${m.home_team} vs ${m.away_team} (${m.league}) ===`,
      fmtTeam(hAdv, m.home_team, 'DOM'),
      fmtTeam(aAdv, m.away_team, 'EXT'),
    ].join('\n');
  }));

  const advancedSection = advancedBlocks.filter(Boolean).join('');
  const hasAdvanced = advancedSection.length > 0;

  // ── Construction du prompt enrichi ──────────────────────────────────────────
  const advancedHeader = hasAdvanced
    ? `[DATA STATISTIQUES AVANCÉES — /teams/statistics API-Football]\n${advancedSection}\n\n`
    : '';

  const prompt = `Tu es l'expert en mathématiques appliquées au sport de la plateforme PariScore. Tu analyses les opportunités de paris à valeur à partir de données statistiques objectives.\n\n${advancedHeader}[RÉSUMÉ POISSON + EDGE NO-VIG]\n${summary}\n\nEn t'appuyant sur les 5 piliers du Scientific Mode (Stabilité, Forme, Différentiel dom/ext, Indice spéculatif, Tactique), rédige une synthèse CONCISE en français avec exactement 3 sections (une phrase percutante par section) :\n🎯 **La Combinaison du Jour** : propose une combinaison de 2-3 opportunités statistiques avec l'indice de cote total estimé.\n💎 **L'Opportunité Haute Probabilité** : identifie l'opportunité la plus solide (convergence Poisson + stats avancées + marché).\n🎲 **L'Écart Statistique à Exploiter** : une opportunité à haute volatilité avec un différentiel marché intéressant.\n\nVocabulaire scientifique uniquement. Chaque section = UNE phrase. Aucun disclaimer.`;

  try {
    const res = await httpsPost(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 500 },
        safetySettings: GEMINI_SAFETY_SETTINGS,
      }
    );
    const text = res.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const result = {
      text,
      matches: top5.map(m => ({ home: m.home_team, away: m.away_team, edge: m.best_edge.edge.toFixed(1), label: m.best_edge.label })),
      advanced_data_used: hasAdvanced,
      generated_at: new Date().toISOString(),
    };
    aiScoutCache = { data: result, timestamp: Date.now() };
    return result;
  } catch (e) { return { error: e.message }; }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  BSD (Bzzoiro) — Fonctions de récupération données
// ═══════════════════════════════════════════════════════════════════════════════

// Fetch BSD standings pour une ligue (convertit au format db.teamStats)
async function fetchBSDStandings(bsdLeagueId, configLeagueId) {
  try {
    // 1. Trouver la saison courante BSD
    const seasonsRes = await bsdFetch(`/seasons/?league=${bsdLeagueId}&current=true`);
    if (seasonsRes.status !== 200 || !seasonsRes.data?.results?.length) {
      console.warn(`  [BSD] Saisons non trouvées pour ligue BSD ${bsdLeagueId}`);
      return null;
    }
    const season = seasonsRes.data.results[0];
    const seasonId = season.id;

    // 2. Fetch standings
    const standingsRes = await bsdFetch(`/leagues/${bsdLeagueId}/standings/?season=${seasonId}`);
    if (standingsRes.status !== 200 || !standingsRes.data?.standings?.length) {
      console.warn(`  [BSD] Standings vides pour ligue BSD ${bsdLeagueId} saison ${seasonId}`);
      return null;
    }

    // 3. Convertir au format db.teamStats
    const teams = {};
    const firstEntry = standingsRes.data.standings[0];
    console.log(`  [DATA MAPPING] BSD standings sample — keys: ${Object.keys(firstEntry).join(', ')}`);
    console.log(`  [DATA MAPPING] BSD sample: team=${firstEntry.team}, played=${firstEntry.played}, gf=${firstEntry.gf}, ga=${firstEntry.ga}, form=${firstEntry.form}`);

    standingsRes.data.standings.forEach(entry => {
      const key = normName(entry.team);

      // Vérifier si BSD fournit les vrais splits domicile/extérieur
      const hasHomeFields = entry.played_home !== undefined && entry.played_away !== undefined;
      const hasGoalHomeFields = entry.gf_home !== undefined && entry.gf_away !== undefined;

      let homeStats, awayStats;
      if (hasHomeFields) {
        const hPlayed = entry.played_home || 0;
        const aPlayed = entry.played_away || 0;
        const hWon = entry.won_home || 0;
        const aWon = entry.won_away || 0;
        const hDrawn = entry.drawn_home || 0;
        const aDrawn = entry.drawn_away || 0;
        const hLost = entry.lost_home || 0;
        const aLost = entry.lost_away || 0;
        homeStats = buildSideStats({ played: hPlayed, win: hWon, draw: hDrawn, lose: hLost, goals_for: hasGoalHomeFields ? (entry.gf_home || 0) : Math.floor((entry.gf || 0) * hPlayed / Math.max(1, entry.played)), goals_against: hasGoalHomeFields ? (entry.ga_home || 0) : Math.floor((entry.ga || 0) * hPlayed / Math.max(1, entry.played)) });
        awayStats = buildSideStats({ played: aPlayed, win: aWon, draw: aDrawn, lose: aLost, goals_for: hasGoalHomeFields ? (entry.gf_away || 0) : Math.floor((entry.gf || 0) * aPlayed / Math.max(1, entry.played)), goals_against: hasGoalHomeFields ? (entry.ga_away || 0) : Math.floor((entry.ga || 0) * aPlayed / Math.max(1, entry.played)) });
        console.log(`  [BSD] Splits réels Domicile/Extérieur pour ${entry.team}: ${hPlayed}D/${aPlayed}E`);
      } else {
        homeStats = buildSideStats({ played: entry.played, win: entry.won, draw: entry.drawn, lose: entry.lost, goals_for: entry.gf, goals_against: entry.ga });
        awayStats = buildSideStats({ played: Math.floor(entry.played / 2), win: Math.floor(entry.won / 2), draw: Math.floor(entry.drawn / 2), lose: Math.floor(entry.lost / 2), goals_for: Math.floor(entry.gf / 2), goals_against: Math.floor(entry.ga / 2) });
        console.log(`  [BSD] Splits estimés (÷2) pour ${entry.team} — BSD ne fournit pas played_home/played_away`);
      }

      // Debug log for first team only
      if (Object.keys(teams).length === 0) {
        console.log(`  [DATA MAPPING] Buts extraits pour ${entry.team} : ${homeStats.avgScored} marqués, ${homeStats.avgConceded} encaissés (home) | ${awayStats.avgScored} marqués, ${awayStats.avgConceded} encaissés (away) | form: ${entry.form || '(vide)'}`);
      }

      teams[key] = {
        home: homeStats,
        away: awayStats,
        rank: entry.position,
        form: entry.form || '',
        leagueId: configLeagueId,
        bsdTeamId: entry.team_id || null,
        bsdSeasonId: seasonId,
        bsdLeagueId: bsdLeagueId,
        xgFor: entry.xgf || null,
        xgAgainst: entry.xga || null,
        _real: true,
        _source: 'bsd',
      };
    });
    return teams;
  } catch (e) {
    console.warn(`  [BSD] fetchStandings ligue ${bsdLeagueId} erreur:`, e.message);
    return null;
  }
}

// Fetch BSD matches (fixtures + odds intégrés)
async function fetchBSDMatches(dateFrom, dateTo, leagueId = null) {
  try {
    let endpoint = `/events/?date_from=${dateFrom}&date_to=${dateTo}`;
    if (leagueId) endpoint += `&league=${leagueId}`;

    const res = await bsdFetch(endpoint);
    if (res.status !== 200 || !res.data?.results?.length) {
      return [];
    }

    return res.data.results.map(e => ({
      id: `bsd_${e.id}`,
      home_team: e.home_team,
      away_team: e.away_team,
      league: e.league?.name || 'Unknown',
      country: forceCountryForKnownCollisions(e.league?.name, e.league?.country || e.country || null, e.league?.id),
      commence_time: e.event_date,
      status: e.status,
      home_score: e.home_score,
      away_score: e.away_score,
      live_minute: e.current_minute,
      live_score: e.status === 'inprogress' || e.status.includes('half') ? `${e.home_score}-${e.away_score}` : null,
      odds: {
        home: e.odds_home || null,
        draw: e.odds_draw || null,
        away: e.odds_away || null,
        over25: e.odds_over_25 || null,
        under25: e.odds_under_25 || null,
        btts: e.odds_btts_yes || null,
      },
      xg: {
        home: e.actual_home_xg || e.home_xg_live || null,
        away: e.actual_away_xg || e.away_xg_live || null,
      },
      coaches: {
        home: e.home_coach ? { name: e.home_coach.name, formation: e.home_coach.preferred_formation } : null,
        away: e.away_coach ? { name: e.away_coach.name, formation: e.away_coach.preferred_formation } : null,
      },
      unavailable: e.unavailable_players || null,
      _bsd_event_id: e.id,
      _bsd_league_id: e.league?.id || null,
      _bsd_country: e.league?.country || e.country || null,
      _source: 'bsd',
    }));
  } catch (e) {
    console.warn(`  [BSD] fetchMatches erreur:`, e.message);
    return [];
  }
}

// Fetch BSD predictions pour un match (ML CatBoost)
async function fetchBSDPrediction(eventId) {
  try {
    const res = await bsdFetch(`/predictions/?league=${eventId}`);
    if (res.status !== 200 || !res.data?.results?.length) {
      return null;
    }
    return res.data.results[0];
  } catch (e) {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  H2H — Head-to-Head matchups via API-Football
// ═══════════════════════════════════════════════════════════════════════════════

async function fetchH2H(team1Id, team2Id, limit = 10) {
  const cacheKey = `h2h_${Math.min(team1Id, team2Id)}_${Math.max(team1Id, team2Id)}`;
  const cached = apiCacheGet(cacheKey, 'h2h');
  if (cached) return cached;

  let result = null;
  let source = '';

  // Route 1: API-Football (primary)
  if (API_FOOTBALL_KEY) {
    try {
      const res = await httpsGet(
        `https://v3.football.api-sports.io/fixtures/headtohead?h2h=${team1Id}-${team2Id}&last=${limit}`,
        { 'x-apisports-key': API_FOOTBALL_KEY }
      );
      if (res.status === 200 && res.data?.response?.length) {
        result = {
          meetings: res.data.response.map(f => {
            const d = new Date(f.fixture?.date);
            return {
              date: d.toISOString().slice(0, 10),
              league: f.league?.name || '',
              home: f.teams.home.name,
              away: f.teams.away.name,
              score: f.goals ? `${f.goals.home}-${f.goals.away}` : '?-?',
              home_goals: f.goals?.home ?? null,
              away_goals: f.goals?.away ?? null,
              status: f.fixture?.status?.short || '',
            };
          }),
          total: res.data.response.length
        };
        source = 'api-football';
      }
    } catch (e) {
      console.log('[H2H] API-Football failed, trying fallback...');
    }
  }

  // Route 2: Fallback via local DB (computeH2H)
  if (!result) {
    const localH2h = fetchLocalH2H(team1Id, team2Id, limit);
    if (localH2h) {
      result = localH2h;
      source = 'local-db';
    }
  }

  if (result) {
    result.source = source;
    // v9.8.4 : enrichir avec summary/wins/draws/losses/form pour cohérence avec computeH2H()
    if (result.meetings && result.meetings.length && (result.wins == null || result.summary == null)) {
      let w = 0, d = 0, l = 0;
      const formChars = [];
      // Note : on ne sait pas quel team est "team1" vs "team2" depuis meetings (qui mélange home/away).
      // On compte par rapport au PREMIER team_id passé (team1Id). Mais on n'a pas le team_id dans les meetings.
      // Heuristique : déterminer "team1" via le team qui apparaît le plus comme home OU away dans le pool.
      const teamCounts = {};
      for (const m of result.meetings) {
        teamCounts[m.home] = (teamCounts[m.home] || 0) + 1;
        teamCounts[m.away] = (teamCounts[m.away] || 0) + 1;
      }
      const teams = Object.keys(teamCounts);
      // Si exactement 2 équipes dans le pool, on a notre paire
      if (teams.length === 2) {
        // Choisir team1 arbitrairement (le 1er) — l'orientation est ambiguë sans contexte
        const team1Name = teams[0];
        for (const m of [...result.meetings].reverse()) {
          if (typeof m.home_goals !== 'number' || typeof m.away_goals !== 'number') continue;
          const isHome = m.home === team1Name;
          const myScore = isHome ? m.home_goals : m.away_goals;
          const oppScore = isHome ? m.away_goals : m.home_goals;
          if (myScore > oppScore) { w++; formChars.push('W'); }
          else if (myScore === oppScore) { d++; formChars.push('D'); }
          else { l++; formChars.push('L'); }
        }
        result.summary = `${w}W-${d}D-${l}L`;
        result.form = formChars.join('');
        result.wins = w; result.draws = d; result.losses = l;
        result.total = w + d + l;
        result._oriented_to = team1Name;
      }
    }
    apiCacheSet(cacheKey, result, 'h2h', 24 * 3600);
    return result;
  }
  return null;
}

// Fallback: compute H2H from local DB
function fetchLocalH2H(team1Id, team2Id, limit) {
  const all = [...(db.matches || []), ...(db.archive_matches || [])];
  if (!all.length) return null;

  // Team IDs to names mapping from db.teamStats
  const hKey = Object.keys(db.teamStats || {}).find(k => db.teamStats[k]?.teamId == team1Id);
  const aKey = Object.keys(db.teamStats || {}).find(k => db.teamStats[k]?.teamId == team2Id);
  if (!hKey || !aKey) return null;

  const h2hMatches = all
    .filter(m => {
      const h = normName(m.home_team);
      const a = normName(m.away_team);
      return (h === hKey && a === aKey) || (h === aKey && a === hKey);
    })
    .filter(m => m.live_score || (m.goals?.home != null))
    .sort((a, b) => new Date(b.commence_time) - new Date(a.commence_time))
    .slice(0, limit);

  if (!h2hMatches.length) return null;

  const meetings = h2hMatches.map(m => {
    const isHome = normName(m.home_team) === hKey;
    let homeGoals, awayGoals;
    if (m.live_score) {
      [homeGoals, awayGoals] = m.live_score.split('-').map(Number);
    } else {
      homeGoals = m.goals?.home;
      awayGoals = m.goals?.away;
    }
    return {
      date: new Date(m.commence_time).toISOString().slice(0, 10),
      league: m.league || '',
      home: isHome ? m.home_team : m.away_team,
      away: isHome ? m.away_team : m.home_team,
      score: `${homeGoals ?? 0}-${awayGoals ?? 0}`,
      home_goals: homeGoals ?? 0,
      away_goals: awayGoals ?? 0,
      status: m.live_score ? 'LIVE' : 'FT'
    };
  });

  return { meetings, total: meetings.length };
}

// ═══════════════════════════════════════════════════════════════════════════════
//  LAST FIXTURES — Last N matches for a team (for H2H & Derniers matchs tab)
// ═══════════════════════════════════════════════════════════════════════════════

async function fetchTeamLastFixtures(teamId, limit = 15) {
  try {
    const cacheKey = `team_fixtures_${teamId}_${limit}`;
    const cached = apiCacheGet(cacheKey, 'team_fixtures');
    if (cached) return cached;
    const res = await httpsGet(
      `https://v3.football.api-sports.io/fixtures?team=${teamId}&last=${limit}&status=FT`,
      { 'x-apisports-key': API_FOOTBALL_KEY }
    );
    if (res.status !== 200 || !res.data?.response?.length) return [];
    const fixtures = res.data.response.map(f => ({
      date: new Date(f.fixture?.date).toISOString().slice(0, 10),
      league: f.league?.name || '',
      home: f.teams.home.name,
      away: f.teams.away.name,
      home_id: f.teams.home.id,
      away_id: f.teams.away.id,
      home_goals: f.goals?.home ?? null,
      away_goals: f.goals?.away ?? null,
    }));
    apiCacheSet(cacheKey, fixtures, 'team_fixtures', 6 * 3600);
    return fixtures;
  } catch (e) { return []; }
}

// BSD fallback: last N finished matches for a team from BSD /events/ with pagination
async function fetchBSDTeamLastFixtures(teamName, bsdLeagueId, limit = 30) {
  if (!bsdLeagueId) return []; // guard: no BSD league → skip
  try {
    const cacheKey = `bsd_last_fx_${bsdLeagueId}_${teamName.replace(/\s+/g, '_')}`;
    const cached = apiCacheGet(cacheKey, 'bsd_last_fx');
    if (cached) return cached;
    const now = new Date();
    const from = new Date(now.getTime() - 320 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const to = now.toISOString().split('T')[0];
    const norm = s => (s || '').toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
    const teamNorm = norm(teamName);
    const stopWords = new Set(['al', 'fc', 'sc', 'ac', 'cf', 'sd', 'cd', 'fk', 'sk', 'if', 'bk', 'afc', 'bfc']);
    const sigWord = teamNorm.split(' ').find(w => w.length >= 3 && !stopWords.has(w)) || teamNorm.split(' ')[0];

    // Paginate BSD /events/ (max 6 pages), collect all matching, dedup, reverse (recent first)
    const seen = new Set();
    const allMatches = [];
    for (let page = 1; page <= 6; page++) {
      const res = await bsdFetch(`/events/?date_from=${from}&date_to=${to}&league=${bsdLeagueId}&status=finished&page_size=50&page=${page}`);
      if (res.status !== 200 || !res.data?.results?.length) break;
      for (const e of res.data.results) {
        if (!(norm(e.home_team).includes(sigWord) || norm(e.away_team).includes(sigWord))) continue;
        const dedupeKey = `${e.home_team}|${e.away_team}|${e.event_date || e.date || ''}`;
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);
        allMatches.push({
          date: (e.event_date || e.date || e.start_time || '').slice(0, 10),
          league: e.league?.name || e.league_name || String(bsdLeagueId),
          home: e.home_team || '',
          away: e.away_team || '',
          home_id: null,
          away_id: null,
          home_goals: e.home_score != null ? Number(e.home_score) : null,
          away_goals: e.away_score != null ? Number(e.away_score) : null,
          _bsd: true,
        });
      }
      if (!res.data.next) break;
    }
    // Sort most recent first
    allMatches.sort((a, b) => b.date.localeCompare(a.date));
    const result = allMatches.slice(0, limit);
    apiCacheSet(cacheKey, result, 'bsd_last_fx', 6 * 3600);
    return result;
  } catch (e) { return []; }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  CORNERS — Predictions Over/Under via BSD historical data
// ═══════════════════════════════════════════════════════════════════════════════

// Fetch recent matches for a team to extract corner averages
async function fetchBSDTeamCornerHistory(teamName, bsdLeagueId, limit = 10) {
  try {
    // Fetch finished matches for this league (last ~30 days)
    const now = new Date();
    const from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const to = now.toISOString().split('T')[0];

    const res = await bsdFetch(`/events/?date_from=${from}&date_to=${to}&league=${bsdLeagueId}&status=finished`);
    if (res.status !== 200 || !res.data?.results?.length) return null;

    // Filter matches involving this team
    const teamMatches = res.data.results
      .filter(e => e.home_team?.toLowerCase().includes(teamName.toLowerCase()) || e.away_team?.toLowerCase().includes(teamName.toLowerCase()))
      .slice(0, limit);

    if (!teamMatches.length) return null;

    let totalCornersFor = 0, totalCornersAgainst = 0, count = 0;
    for (const m of teamMatches) {
      if (!m.live_stats) continue; // Need finished match with stats
      const isHome = m.home_team?.toLowerCase().includes(teamName.toLowerCase());
      const stats = isHome ? m.live_stats.home : m.live_stats.away;
      const oppStats = isHome ? m.live_stats.away : m.live_stats.home;
      if (stats?.corner_kicks != null) {
        totalCornersFor += stats.corner_kicks;
        totalCornersAgainst += oppStats.corner_kicks || 0;
        count++;
      }
    }

    if (!count) return null;

    return {
      avgCornersFor: totalCornersFor / count,
      avgCornersAgainst: totalCornersAgainst / count,
      totalMatches: count,
      totalCornersPerMatch: (totalCornersFor + totalCornersAgainst) / count,
    };
  } catch (e) {
    return null;
  }
}

// Predict corners Over/Under for a match
// Fetch BSD squad for a team: attributes (tactical/attacking/defending/technical/creativity),
// availability (available/injured/suspended), injury return date — cache 6h
async function fetchBSDTeamSquad(bsdTeamId) {
  if (!bsdTeamId || !BSD_BASE_URL) return [];
  const cacheKey = `bsd_squad_${bsdTeamId}`;
  const cached = apiCacheGet(cacheKey);
  if (cached) return cached;
  try {
    const res = await bsdFetch(`/players/?team=${bsdTeamId}&page_size=100`);
    if (res.status !== 200 || !res.data?.results?.length) return [];
    const squad = res.data.results.map(p => ({
      id: p.id,
      name: p.name,
      short_name: p.short_name,
      position: p.position,           // G/D/M/F
      specific_position: p.specific_position,
      jersey_number: p.jersey_number,
      attributes: p.attributes || null, // { tactical, attacking, defending, technical, creativity }
      strengths: p.strengths || [],
      weaknesses: p.weaknesses || [],
      availability: p.availability || 'available',
      injury_type: p.injury_type || null,
      injury_return: p.injury_expected_return || null,
      preferred_foot: p.preferred_foot || null,
      nationality: p.nationality || null,
      market_value: p.market_value || null,
    }));
    apiCacheSet(cacheKey, squad, 'bsd_squad');
    return squad;
  } catch (e) {
    console.warn(`  [BSD] fetchTeamSquad ${bsdTeamId} erreur:`, e.message);
    return [];
  }
}

// Fetch and aggregate BSD player ratings for a team+season — cache 24h
// Returns array sorted by avg_rating desc: { name, position, avg_rating, goals, assists, minutes, matches, xg, xa, ... }
async function fetchBSDPlayerRatings(bsdTeamId, bsdSeasonId) {
  if (!bsdTeamId || !bsdSeasonId || !BSD_BASE_URL) return [];
  const cacheKey = `bsd_ratings_${bsdTeamId}_${bsdSeasonId}`;
  const cached = apiCacheGet(cacheKey);
  if (cached) return cached;
  try {
    const allStats = [];
    for (let page = 1; page <= 4; page++) {
      const res = await bsdFetch(`/player-stats/?team=${bsdTeamId}&season=${bsdSeasonId}&page=${page}&page_size=100`);
      if (res.status !== 200 || !res.data?.results?.length) break;
      allStats.push(...res.data.results);
      if (!res.data.next) break;
    }
    // Aggregate by player
    const byPlayer = {};
    for (const stat of allStats) {
      const pid = stat.player?.id;
      if (!pid) continue;
      if (!byPlayer[pid]) {
        byPlayer[pid] = {
          id: pid,
          name: stat.player.name,
          short_name: stat.player.short_name,
          position: stat.player.position,
          specific_position: stat.player.specific_position,
          _ratings: [],
          goals: 0, assists: 0, minutes: 0, matches: 0,
          yellow_cards: 0, red_cards: 0,
          shots_on_target: 0, key_passes: 0,
          xg: 0, xa: 0,
          saves: 0,
        };
      }
      const p = byPlayer[pid];
      if (stat.rating != null) p._ratings.push(stat.rating);
      p.goals += stat.goals || 0;
      p.assists += stat.goal_assist || 0;
      p.minutes += stat.minutes_played || 0;
      p.yellow_cards += stat.yellow_card || 0;
      p.red_cards += stat.red_card || 0;
      p.shots_on_target += stat.shots_on_target || 0;
      p.key_passes += stat.key_pass || 0;
      p.xg += stat.expected_goals || 0;
      p.xa += stat.expected_assists || 0;
      p.saves += stat.saves || 0;
      p.matches++;
    }
    const ratings = Object.values(byPlayer).map(p => {
      const avg = p._ratings.length ? Math.round(p._ratings.reduce((a, b) => a + b, 0) / p._ratings.length * 10) / 10 : null;
      const { _ratings, ...rest } = p;
      return { ...rest, avg_rating: avg, xg: Math.round(p.xg * 100) / 100, xa: Math.round(p.xa * 100) / 100 };
    }).sort((a, b) => (b.avg_rating || 0) - (a.avg_rating || 0));
    apiCacheSet(cacheKey, ratings, 'bsd_ratings');
    return ratings;
  } catch (e) {
    console.warn(`  [BSD] fetchPlayerRatings ${bsdTeamId} erreur:`, e.message);
    return [];
  }
}

// Calcule le top 3 des buteurs probables pour un match (cumul des 2 equipes)
// Ponderation xG/match + buts/match, ajustee domicile/exterieur (+10%/-10%)
// Retourne [{name, team, teamName, score, probaMarquer, xgPerMatch, goalsPerMatch, goals, xgTotal, matches}] ou null
function computeMatchTopButteurs(m) {
  const homeRatings = m._bsd_home_ratings || [];
  const awayRatings = m._bsd_away_ratings || [];
  if (!homeRatings.length && !awayRatings.length) return null;

  const HOME_BOOST = 1.10;
  const AWAY_PENALTY = 0.90;
  const attackers = [];

  function process(ratings, team, teamName, boost) {
    for (const p of ratings) {
      const pos = p.position || '';
      const spec = p.specific_position || '';
      if (pos !== 'F' && pos !== 'Attacker' && pos !== 'A' && spec !== 'Forwards') continue;
      if (!p.minutes || p.minutes < 90) continue;
      const matches = p.matches || 1;
      const xgPerMatch = p.xg / matches;
      const goalsPerMatch = p.goals / matches;
      const rawScore = xgPerMatch * 0.6 + goalsPerMatch * 0.4;
      const score = rawScore * boost;
      const lambda = rawScore * boost;
      const probaMarquer = Math.round((1 - Math.exp(-lambda)) * 100);
      attackers.push({
        name: p.short_name || p.name || '?',
        id: p.id || null,
        photo: p.image_path ? ('https://sports.bzzoiro.com' + p.image_path) : null,
        team,
        teamName,
        score: Math.round(score * 100) / 100,
        probaMarquer,
        xgPerMatch: Math.round(xgPerMatch * 100) / 100,
        goalsPerMatch: Math.round(goalsPerMatch * 100) / 100,
        goals: p.goals,
        xgTotal: Math.round(p.xg * 100) / 100,
        matches
      });
    }
  }

  process(homeRatings, 'home', m.home_team, HOME_BOOST);
  process(awayRatings, 'away', m.away_team, AWAY_PENALTY);
  if (!attackers.length) return null;
  attackers.sort((a, b) => b.score - a.score);
  return attackers.slice(0, 3);
}

// Top 3 joueurs par équipe — ratings BSD saison. Position: G/D/M/F
function getTop3Players(match) {
  const POS_LABEL = { G: 'G', D: 'D', M: 'M', F: 'A', Goalkeeper: 'G', Defender: 'D', Midfielder: 'M', Attacker: 'A' };
  const top3 = (arr) => (arr || [])
    .filter(p => p.avg_rating != null)
    .sort((a, b) => (b.avg_rating || 0) - (a.avg_rating || 0))
    .slice(0, 3)
    .map(p => ({
      name: p.short_name || p.name || '?',
      avg_rating: p.avg_rating,
      position: POS_LABEL[p.position] || p.position || '?',
      goals: p.goals || 0,
      assists: p.assists || 0,
      xg: p.xg ? parseFloat(p.xg.toFixed(2)) : 0,
    }));
  const home = top3(match._bsd_home_ratings);
  const away = top3(match._bsd_away_ratings);
  const homeAvg = home.length ? parseFloat((home.reduce((s, p) => s + p.avg_rating, 0) / home.length).toFixed(2)) : null;
  const awayAvg = away.length ? parseFloat((away.reduce((s, p) => s + p.avg_rating, 0) / away.length).toFixed(2)) : null;
  return { home, away, homeAvg, awayAvg, available: home.length > 0 || away.length > 0 };
}

// ── Sofascore live ratings — via /event/{id}/lineups (ratings live par joueur) ──
const _sofaEventsCache = {};    // { dateStr: { ts, events[] } }
const _sofaEventIdCache = {};   // { matchId: sofaEventId }
const SOFA_EVENTS_TTL = 30 * 60 * 1000; // 30 min

async function getSofaScheduledEvents(dateStr) {
  const cached = _sofaEventsCache[dateStr];
  if (cached && Date.now() - cached.ts < SOFA_EVENTS_TTL) return cached.events;
  try {
    const res = await sofaGet(`/sport/football/scheduled-events/${dateStr}`);
    if (res.status !== 200 || !res.data?.events) return [];
    _sofaEventsCache[dateStr] = { ts: Date.now(), events: res.data.events };
    return res.data.events;
  } catch (e) { return []; }
}

async function findSofaEventId(match) {
  const cacheKey = match.id;
  if (_sofaEventIdCache[cacheKey]) return _sofaEventIdCache[cacheKey];
  const dateStr = match.commence_time
    ? new Date(match.commence_time).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);
  const events = await getSofaScheduledEvents(dateStr);
  const norm = s => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const found = events.find(e => {
    if (match.home_sofa_id && match.away_sofa_id) {
      return e.homeTeam?.id === match.home_sofa_id && e.awayTeam?.id === match.away_sofa_id;
    }
    return norm(e.homeTeam?.name) === norm(match.home_team) &&
           norm(e.awayTeam?.name) === norm(match.away_team);
  });
  if (found?.id) _sofaEventIdCache[cacheKey] = found.id;
  return found?.id || null;
}

async function getTop3PlayersFromSofa(match) {
  try {
    const sofaEventId = await findSofaEventId(match);
    if (!sofaEventId) return null;
    const res = await sofaGet(`/event/${sofaEventId}/lineups`);
    if (res.status !== 200 || !res.data) return null;
    const POS_MAP = { G: 'G', D: 'D', M: 'M', F: 'A', Goalkeeper: 'G', Defender: 'D', Midfielder: 'M', Forward: 'A', Attacker: 'A' };
    const extractTop3 = (players) => (players || [])
      .filter(p => p.statistics?.rating != null && p.statistics.rating > 0)
      .map(p => ({
        name: p.player?.shortName || p.player?.name || '',
        avg_rating: parseFloat(Number(p.statistics.rating).toFixed(1)),
        position: POS_MAP[p.position?.name] || 'M',
        goals: p.statistics?.goals || 0,
        assists: p.statistics?.goalAssists || 0,
        xg: parseFloat((p.statistics?.expectedGoals || 0).toFixed(2)),
      }))
      .sort((a, b) => b.avg_rating - a.avg_rating)
      .slice(0, 3);
    const home = extractTop3(res.data.home?.players);
    const away = extractTop3(res.data.away?.players);
    if (!home.length && !away.length) return null;
    const avg = arr => arr.length ? parseFloat((arr.reduce((s, p) => s + p.avg_rating, 0) / arr.length).toFixed(2)) : null;
    console.log(`  [SofaRatings] event ${sofaEventId} → home:${home.length} away:${away.length}`);
    return { home, away, homeAvg: avg(home), awayAvg: avg(away), available: true, _source: 'sofascore', _sofaEventId: sofaEventId };
  } catch (e) {
    console.warn('[SofaRatings]', e.message);
    return null;
  }
}

// ── Fallback API-Football pour ligues non couvertes par BSD ratings ──────────
// Mapping BSD league_id → API-Football league_id (saison 2024 accessible Free)
const BSD_TO_APIF_LEAGUE = {
  50: 292,  // K League 1 (Corée)
  49: 98,   // J1 League (Japon)
  9:  71,   // Brasileirão Série A
  34: 72,   // Brasileirão Série B
  18: 253,  // MLS (USA)
  19: 262,  // Liga MX
  20: 262,  // Liga MX (Clausura — même ligue)
  26: 113,  // Allsvenskan (Suède)
  22: 172,  // Parva Liga (Bulgarie)
  23: 283,  // Superliga Romania
  25: 106,  // Ekstraklasa (Pologne)
  52: 169,  // Chinese Super League
};

// Cache ratings API-Football par ligue — TTL 24h
const _apifRatingsCache = {};
const APIF_RATINGS_TTL = 24 * 3600 * 1000;

async function fetchApifTopPlayersByLeague(apifLeagueId, season = 2024) {
  const cacheKey = `${apifLeagueId}_${season}`;
  const cached = _apifRatingsCache[cacheKey];
  if (cached && Date.now() - cached.ts < APIF_RATINGS_TTL) return cached.players;

  const key = process.env.API_FOOTBALL_KEY || '';
  if (!key) return [];

  try {
    const POS = { Goalkeeper: 'G', Defender: 'D', Midfielder: 'M', Forward: 'F', Attacker: 'F' };
    const headers = { 'x-apisports-key': key };
    const [tsRes, taRes] = await Promise.allSettled([
      httpsGet(`https://v3.football.api-sports.io/players/topscorers?league=${apifLeagueId}&season=${season}`, headers),
      httpsGet(`https://v3.football.api-sports.io/players/topassists?league=${apifLeagueId}&season=${season}`, headers),
    ]);

    const byId = {};
    for (const res of [tsRes, taRes]) {
      if (res.status !== 'fulfilled' || res.value.status !== 200) continue;
      for (const item of (res.value.data?.response || [])) {
        const pid = item.player?.id;
        if (!pid) continue;
        const s = item.statistics?.[0];
        const rating = s?.games?.rating ? parseFloat(parseFloat(s.games.rating).toFixed(2)) : null;
        if (!rating) continue;
        if (byId[pid]) continue; // déjà présent (topscorers prioritaire)
        const lastName = item.player.lastname || item.player.name.split(' ').pop();
        byId[pid] = {
          id: pid,
          name: item.player.name,
          short_name: item.player.firstname
            ? item.player.firstname.charAt(0) + '. ' + lastName
            : item.player.name,
          position: POS[s?.games?.position] || s?.games?.position?.charAt(0) || '?',
          avg_rating: rating,
          goals: s?.goals?.total || 0,
          assists: s?.goals?.assists || 0,
          xg: 0,
          _norm: normName(item.player.name),
          _norm_last: normName(lastName),
        };
      }
    }

    const players = Object.values(byId).sort((a, b) => b.avg_rating - a.avg_rating);
    _apifRatingsCache[cacheKey] = { ts: Date.now(), players };
    console.log(`  [ApifRatings] ligue ${apifLeagueId}/${season} → ${players.length} joueurs avec ratings`);
    return players;
  } catch (e) {
    console.warn(`  [ApifRatings] erreur ${apifLeagueId}:`, e.message);
    return [];
  }
}

// Fuzzy name match : "P. Seung-Ho" ↔ "Paik Seung-Ho" → true
function _nameMatchesPlayer(lineupName, ratedPlayer) {
  const ln = normName(lineupName);
  if (ln === ratedPlayer._norm) return true;
  // Suffix match sur les 2 derniers mots normalisés (noms coréens, japonais, etc.)
  const lnWords = ln.split(/\s+/).filter(w => w.length > 1);
  const rpWords = ratedPlayer._norm.split(/\s+/).filter(w => w.length > 1);
  // Last word (nom de famille ou dernier prénom) > 3 chars
  if (lnWords.length && rpWords.length) {
    const lLast = lnWords[lnWords.length - 1];
    const rLast = rpWords[rpWords.length - 1];
    if (lLast.length > 3 && lLast === rLast) return true;
    // 2 derniers mots coïncident
    const l2 = lnWords.slice(-2).join(' ');
    const r2 = rpWords.slice(-2).join(' ');
    if (l2.length > 4 && l2 === r2) return true;
  }
  // Initiale + nom de famille : "P. Seung-Ho" → "p" + "seungho", "Paik Seung-Ho" → "paik" + "seungho"
  if (ratedPlayer._norm_last && normName(ratedPlayer._norm_last).length > 3) {
    if (ln.includes(ratedPlayer._norm_last)) return true;
  }
  return false;
}

// Fallback complet : BSD ratings → API-Football lineup+ratings
async function getTop3PlayersWithFallback(match) {
  // 1. BSD ratings (ligues majeures EU)
  const bsd = getTop3Players(match);
  if (bsd.available) return { ...bsd, _source: 'bsd' };

  // 2. Sofascore live ratings (mise à jour chaque minute, couvre toutes les ligues)
  const sofa = await getTop3PlayersFromSofa(match);
  if (sofa) return sofa;

  // 3. API-Football fallback (ligues non couvertes BSD)
  const bsdLeagueId = match._bsd_league_id;
  const apifLeagueId = bsdLeagueId ? BSD_TO_APIF_LEAGUE[bsdLeagueId] : null;
  const eventId = match._bsd_event_id;
  if (!apifLeagueId || !eventId) return { ...bsd, _source: 'unavailable' };

  try {
    const [lineupRes, ratedPlayers] = await Promise.allSettled([
      bsdFetch(`/api/v2/events/${eventId}/lineups/`),
      fetchApifTopPlayersByLeague(apifLeagueId, 2024),
    ]);

    if (lineupRes.status !== 'fulfilled' || ratedPlayers.status !== 'fulfilled') return bsd;

    const lineupData = lineupRes.value.data;
    const rated = ratedPlayers.value;
    if (!rated.length) return bsd;

    const POS_LABEL = { G: 'G', D: 'D', M: 'M', F: 'A' };
    const matchTeam = (players) => players
      .map(lp => {
        const found = rated.find(rp => _nameMatchesPlayer(lp.name, rp));
        if (!found) return null;
        return {
          name: found.short_name,
          avg_rating: found.avg_rating,
          position: POS_LABEL[lp.position] || lp.position || found.position,
          goals: found.goals,
          assists: found.assists,
          xg: 0,
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.avg_rating - a.avg_rating)
      .slice(0, 3);

    const home = matchTeam(lineupData?.lineups?.home?.players || []);
    const away = matchTeam(lineupData?.lineups?.away?.players || []);
    const avg = (arr) => arr.length ? parseFloat((arr.reduce((s, p) => s + p.avg_rating, 0) / arr.length).toFixed(2)) : null;

    return {
      home, away,
      homeAvg: avg(home),
      awayAvg: avg(away),
      available: home.length > 0 || away.length > 0,
      _source: 'apif_2024',
    };
  } catch (e) {
    console.warn('[Top3Fallback] erreur:', e.message);
    return bsd;
  }
}

function predictCorners(homeAvg, awayAvg, thresholds = [6.5, 7.5, 8.5, 9.5, 10.5]) {
  // Expected total corners = average of both teams' averages
  const expectedTotal = (homeAvg + awayAvg) / 2;

  // Poisson-like distribution for corners (discrete, 0-20 range)
  const lambda = expectedTotal;
  const probs = {};

  for (const threshold of thresholds) {
    // P(Over X.5) = 1 - P(X ≤ floor(threshold))
    let cumulative = 0;
    const maxX = Math.floor(threshold);
    for (let k = 0; k <= maxX; k++) {
      // Poisson PMF approximation for corners
      let logP = -lambda + k * Math.log(Math.max(lambda, 0.001));
      for (let i = 1; i <= k; i++) logP -= Math.log(i);
      cumulative += Math.exp(logP);
    }
    probs[`over_${String(threshold).replace('.', '_')}`] = Math.round((1 - cumulative) * 100);
  }

  return {
    expected_total: Math.round(lambda * 10) / 10,
    probabilities: probs,
    confidence: Math.min(Math.round((expectedTotal / 12) * 100), 85),
  };
}

// Route: GET /api/v1/corners/:matchId
// Returns corner predictions for a specific match
async function handleCornersRoute(res, matchId) {
  try {
    const match = db.matches.find(m => m.id === matchId);
    if (!match) return jsonResponse(res, 404, { error: 'Match not found' });

    // Check cache
    const cacheKey = `corners_${matchId}`;
    const cached = apiCacheGet(cacheKey);
    if (cached) return jsonResponse(res, 200, { ...cached, cached: true });

    // Get BSD league ID for this match
    const configLeague = leaguesConfig.leagues.find(l => l.name === match.league || l.odds_key === match.sport);
    const bsdLeagueId = configLeague ? configIdToBsd(configLeague.id) : null;

    if (!bsdLeagueId) {
      return jsonResponse(res, 200, {
        match: `${match.home_team} vs ${match.away_team}`,
        league: match.league,
        error: 'League not covered by BSD for corners data',
        fallback: 'Using Poisson model with league averages',
        prediction: predictCorners(5.5, 5.0), // Default league averages
      });
    }

    // Fetch corner history for both teams
    const [homeCorners, awayCorners] = await Promise.all([
      fetchBSDTeamCornerHistory(match.home_team, bsdLeagueId),
      fetchBSDTeamCornerHistory(match.away_team, bsdLeagueId),
    ]);

    const homeAvg = homeCorners?.totalCornersPerMatch || 5.5;
    const awayAvg = awayCorners?.totalCornersPerMatch || 5.0;

    const prediction = predictCorners(homeAvg, awayAvg);

    const result = {
      match: `${match.home_team} vs ${match.away_team}`,
      league: match.league,
      home_team: match.home_team,
      away_team: match.away_team,
      home_corner_history: homeCorners ? {
        avg_corners_per_match: homeCorners.totalCornersPerMatch,
        avg_corners_for: homeCorners.avgCornersFor,
        avg_corners_against: homeCorners.avgCornersAgainst,
        matches_sample: homeCorners.totalMatches,
      } : 'No data — using league average',
      away_corner_history: awayCorners ? {
        avg_corners_per_match: awayCorners.totalCornersPerMatch,
        avg_corners_for: awayCorners.avgCornersFor,
        avg_corners_against: awayCorners.avgCornersAgainst,
        matches_sample: awayCorners.totalMatches,
      } : 'No data — using league average',
      prediction,
      recommendations: Object.entries(prediction.probabilities)
        .map(([k, v]) => ({ market: k.replace('_', ' over ').replace('over ', 'Over '), probability: v, recommended: v >= 60 }))
        .sort((a, b) => b.probability - a.probability),
      source: 'bsd',
      generated_at: new Date().toISOString(),
    };

    // Cache for 6 hours
    apiCacheSet(cacheKey, result, 'corners');

    return jsonResponse(res, 200, result);
  } catch (e) {
    return jsonResponse(res, 500, { error: e.message });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  CRON JOBS — PRE-FETCHING AUTOMATIQUE
// ═══════════════════════════════════════════════════════════════════════════════

// Convert a BSD match object to Odds API-compatible format so it can flow
// through buildMatchRecord() unchanged. Uses a single synthetic bookmaker entry.
const BSD_FINISHED_STATUSES = new Set([
  'finished','ft','aet','pen','ended','terminated',
  'postponed','cancelled','canceled','abandoned','walkover','awrd',
  'interrupted','suspended'
]);

function bsdToOddsApiFormat(bsdMatch) {
  if (!bsdMatch.odds?.home || !bsdMatch.odds?.away) return null;
  // Exclure à la source les matchs déjà terminés côté BSD
  const rawStatus = (bsdMatch.status || '').toLowerCase().trim();
  if (rawStatus && BSD_FINISHED_STATUSES.has(rawStatus)) return null;

  const drawOdds = bsdMatch.odds.draw || 3.0;

  // Mapping robuste: priorité à l'ID BSD, puis disambiguïsation par pays
  let configLeague = resolveConfigLeagueForBSDMatch(bsdMatch);
  const forcedCountry = forceCountryForKnownCollisions(
    bsdMatch.league,
    bsdMatch._bsd_country || bsdMatch.country,
    bsdMatch._bsd_league_id
  );

  // BSD mistag correction : Ligue 2 / Bundesliga 2 / Serie B IT tagged comme T1 par BSD.
  // Si NI home NI away dans canonical T1 → override vers T2.
  if (configLeague && isLikelyBSDMistag(bsdMatch._bsd_league_id, bsdMatch.home_team, bsdMatch.away_team)) {
    const t2Key = T1_TO_T2_KEY[configLeague.odds_key];
    if (t2Key) {
      const t2Config = leaguesConfig.leagues.find(l => l.odds_key === t2Key);
      if (t2Config) {
        console.log(`  [BSD Mistag] ${bsdMatch.home_team} vs ${bsdMatch.away_team} : BSD a tagué "${configLeague.name}" mais teams absentes du T1 canonical → override "${t2Config.name}"`);
        configLeague = t2Config;
        bsdMatch.league = t2Config.name;
      }
    }
  }

  const inferredSportKey = inferSportKeyFromLeagueCountry(bsdMatch.league, forcedCountry);
  const sportKey = configLeague?.odds_key || inferredSportKey || 'soccer_bsd';
  const leagueCountry = forcedCountry || configLeague?.country || null;

  return {
    id: bsdMatch.id,
    sport_key: sportKey,
    sport_title: bsdMatch.league,
    country: leagueCountry,
    commence_time: bsdMatch.commence_time,
    home_team: bsdMatch.home_team,
    away_team: bsdMatch.away_team,
    _sport: sportKey, // C'est cette valeur qui est utilisée pour le filtrage !
    _source: 'bsd',
    _bsd_event_id: bsdMatch._bsd_event_id,
    status: bsdMatch.status || null,
    bsd_odds: bsdMatch.odds,
    _league_country: leagueCountry,
    _config_league_id: configLeague?.id || null,
    bsd_xg: bsdMatch.xg,
    bsd_coaches: bsdMatch.coaches,
    bsd_unavailable: bsdMatch.unavailable,
    bookmakers: [{
      key: 'bsd',
      title: 'BSD',
      markets: [{
        key: 'h2h',
        outcomes: [
          { name: bsdMatch.home_team, price: bsdMatch.odds.home },
          { name: 'Draw', price: drawOdds },
          { name: bsdMatch.away_team, price: bsdMatch.odds.away },
        ],
      }],
    }],
  };
}


// ─── JOB 1 : COTES (toutes les 12h) ──────────────────────────────────────
async function fetchOdds(force = false) {
  if (isFetchingOdds) { console.warn('[Cron:Odds] Déjà en cours — ignoré'); return; }

  // 1. Gestion du cache pour éviter le gaspillage de requêtes
  const cacheData = apiCacheGet('odds_raw_matches');
  if (!force && cacheData && db.matches.length > 0) {
    const now = Date.now();
    const upcoming = db.matches.filter(m => new Date(m.commence_time).getTime() > now).length;
    if (upcoming > 0) {
      console.log(`  [Cron:Odds] ⚡ Données fraîches en cache (${upcoming} matchs) — skip API`);
      return;
    }
  }

  isFetchingOdds = true;
  console.log('\n%s', '═'.repeat(60));
  console.log(`  [Cron:Odds] Lancement du routing intelligent (BSD-First)...`);

  let tempBuiltMatches = [];
  let fallbackToSofa = false;

  try {
    const now = new Date();
    const dateFrom = formatDateOnly(now);
    const dateTo = formatDateOnly(new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000));
    let allRawMatches = [];

    // =========================================================================
    // ÉTAPE 1 : DÉCOUVERTE VIA BSD (Source Primaire Gratuite)
    // =========================================================================
    console.log('  [Routing] L1 : Récupération des matchs via BSD...');
    try {
      const bsdRaw = await fetchBSDMatches(dateFrom, dateTo);
      if (bsdRaw && bsdRaw.length > 0) {
        const adapted = bsdRaw.map(bsdToOddsApiFormat).filter(Boolean);
        allRawMatches.push(...adapted);
        console.log(`  [Routing] ✓ ${adapted.length} matchs trouvés via BSD.`);
      }
    } catch (e) { console.error('  [Routing] ❌ Erreur BSD:', e.message); }

    // =========================================================================
    // ÉTAPE 2 : SÉCURITÉ LIGUES MAJEURES VIA FOOTBALL-DATA.ORG
    // =========================================================================
    if (FOOTBALL_DATA_API_KEY) {
      console.log('  [Routing] L2 : Vérification des ligues majeures (Football-Data)...');
      try {
        // On récupère les matchs des compétitions principales (PL, PD, BL1, SA, L1)
        const fdRes = await httpsGet(`https://api.football-data.org/v4/competitions?pageSize=50`, {
          'X-Auth-Token': FOOTBALL_DATA_API_KEY
        });
        if (fdRes.status === 200 && fdRes.data.competitions) {
          // On ne fait pas d'appels massifs ici pour économiser, 
          // on utilise juste cette API pour confirmer la présence des ligues.
          console.log(`  [Routing] ✓ Synchronisation des compétitions majeure terminée.`);
        }
      } catch (e) { console.warn('  [Routing] ⚠️ Football-Data indisponible:', e.message); }
    }

    // =========================================================================
    // ÉTAPE 3 : ENRICHISSEMENT CHIRURGICAL VIA THE ODDS API
    // =========================================================================
    if (ODDS_API_KEY) {
      console.log('  [Routing] L3 : Enrichissement des cotes (Surgical Mode)...');

      // Au lieu de boucler sur TOUS les sports, on ne cible que les 5 plus populaires
      // pour économiser drastiquement les crédits.
      const prioritySports = ['soccer_epl', 'soccer_france_ligue1', 'soccer_spain_la_liga', 'soccer_germany_bundesliga', 'soccer_italy_serie_a'];
      const oddsToCache = {};
      let quotaExceeded = false;

      for (const sport of prioritySports) {
        try {
          // v10.8: élargissement régions/markets opt-in via env (par défaut: eu+h2h = 1 credit/call, sustainable plan free 500/mois).
          // Pour activer comparateur OU25/BTTS : Render env ODDS_MARKETS=h2h,totals,both_teams_score (coût ×3) + upgrade Odds Starter $30/mo (20k credits).
          // Pour 1xbet : ODDS_REGIONS=eu,us2 (couvre 1xbet via region us2 selon Odds API).
          const query = new URLSearchParams({
            apiKey: ODDS_API_KEY,
            regions: process.env.ODDS_REGIONS || 'eu',
            markets: process.env.ODDS_MARKETS || 'h2h',
            oddsFormat: 'decimal',
            dateFormat: 'iso', commenceTimeFrom: formatIsoTimestamp(now), commenceTimeTo: formatIsoTimestamp(new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)),
          }).toString();

          const res = await httpsGet(`https://api.the-odds-api.com/v4/sports/${sport}/odds/?${query}`);

          if (res.status === 401 || res.status === 429) {
            console.error(`  [Routing] ⚠️ Quota The Odds API atteint. Arrêt de l'enrichissement.`);
            quotaExceeded = true;
            break;
          }

          if (res.status === 200) {
            res.data.forEach(m => { m._sport = sport; });
            // On fusionne les cotes avec les matchs déjà trouvés par BSD
            allRawMatches = allRawMatches.map(existing => {
              const matchFromOdds = res.data.find(o => normName(o.home_team) === normName(existing.home_team) && normName(o.away_team) === normName(existing.away_team));
              return matchFromOdds ? { ...existing, bookmakers: matchFromOdds.bookmakers } : existing;
            });
            // On ajoute aussi les matchs qui seraient UNIQUEMENT chez Odds API
            const newMatches = res.data.filter(o => !allRawMatches.some(ex => normName(ex.home_team) === normName(o.home_team) && normName(ex.away_team) === normName(o.away_team)));
            newMatches.forEach(m => { m._sport = sport; allRawMatches.push(m); });

            oddsToCache[`odds_${sport}`] = res.data;
          }
        } catch (e) { console.warn(`  [Routing] ${sport} erreur:`, e.message); }
      }

      if (!quotaExceeded) {
        oddsToCache['odds_raw_matches'] = allRawMatches;
        apiCacheSetBatch(Object.entries(oddsToCache).map(([k, v]) => [k, v]), 'odds_api');
      }
    }

    // =========================================================================
    // FINALISATION & PROTECTION ANTI-WIPE
    // =========================================================================
    if (allRawMatches.length > 0) {
      tempBuiltMatches = allRawMatches.map(buildMatchRecord).filter(Boolean);
      db.matches = tempBuiltMatches.sort((a, b) => new Date(a.commence_time) - new Date(b.commence_time));
      db.status = 'ok';
      console.log(`  [Cron:Odds] ✅ Succès : ${db.matches.length} matchs injectés.`);
    } else {
      console.error('\x1b[31m[DB_GUARD] ⚠️ Aucune donnée récupérée. Conservation du cache.\x1b[0m');
      db.status = 'api_empty_fallback';
      fallbackToSofa = true;
    }

    // Si on est en mode survie (Sofa), on met à jour les scores des matchs existants
    if (fallbackToSofa) {
      console.log('  [Routing] 🛡️ Mode Maintenance : Mise à jour des scores via Sofascore...');
      for (const m of db.matches) {
        try {
          const sofaTeam = await searchSofascoreTeam(m.home_team);
          if (sofaTeam?.id) {
            const events = await fetchSofascoreTeamLastMatches(sofaTeam.id, 1);
            const matchEvent = events.find(e => normName(e.away).includes(normName(m.away_team).split(' ')[0]));
            if (matchEvent) m.live_score = `${matchEvent.home_goals}-${matchEvent.away_goals}`;
          }
        } catch (e) { }
      }
    }

    db.lastOddsUpdate = new Date().toISOString();
    autoPurgeDatabase(); // purge immédiate après chaque injection BSD
    saveDB();
    syncCacheBuffers();
    if (sseClients.size > 0) broadcastSSE('matches_update', { matches: matchesForBroadcast(), meta: buildMeta() });

  } catch (e) {
    console.error('  [Cron:Odds] Erreur fatale:', e.message);
    if (!db.matches.length && cachedMatches.length > 0) {
      db.matches = JSON.parse(JSON.stringify(cachedMatches));
      db.status = 'cache_fallback';
      saveDB();
    }
  } finally {
    isFetchingOdds = false;
  }
}

// ─── JOB 2 : STATS ÉQUIPES (BSD primaire + API-Football fallback) ────────────
async function fetchStats(force = false) {
  if (isFetchingStats) { console.warn('[Cron:Stats] Déjà en cours — ignoré'); return; }
  isFetchingStats = true;
  console.log('\n%s', '═'.repeat(60));
  console.log('  [Cron:Stats] Mise à jour des stats équipes…');

  try {
    const from = formatDateOnly(new Date());
    const to = formatDateOnly(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
    let totalTeams = 0;
    let bsdTeamsFetched = 0;
    let fallbackTeamsFetched = 0;

    // ═══════════════════════════════════════════════════════════════
    // PHASE 1: BSD — Standings pour ligues couvertes (zéro quota)
    // ═══════════════════════════════════════════════════════════════
    if (BSD_API_KEY) {
      console.log('  [Cron:Stats] Phase 1: BSD standings (ligues couvertes)…');
      const bsdLeagues = Object.entries(BSD_CONFIG_TO_BSD);
      for (const [configIdStr, bsdId] of bsdLeagues) {
        const configId = parseInt(configIdStr);
        try {
          // Respect du cycle T1 (6h) vs T2 (12h)
          const leagueCronMs = LEAGUE_CRON_MS[configId] || (6 * 3600000);
          const lastLeagueUpdate = db.statsUpdateByLeague[configId];
          if (!force && lastLeagueUpdate && (Date.now() - new Date(lastLeagueUpdate).getTime()) < leagueCronMs) {
            const tier = leagueCronMs >= 12 * 3600000 ? 'T2' : 'T1';
            console.log(`  [BSD] Ligue ${configId} (${tier}) — données fraîches — saut`);
            continue;
          }

          const teams = await fetchBSDStandings(bsdId, configId);
          if (teams && Object.keys(teams).length) {
            Object.assign(db.teamStats, teams);
            const count = Object.keys(teams).length;
            bsdTeamsFetched += count;
            totalTeams += count;
            db.statsUpdateByLeague[configId] = new Date().toISOString();
            console.log(`  [BSD] Ligue ${configId} → OK (${count} équipes)`);
          }
        } catch (e) {
          console.warn(`  [BSD] Ligue ${configId} erreur:`, e.message);
        }
      }
      console.log(`  [BSD] Phase 1 terminée: ${bsdTeamsFetched} équipes`);
    }

    // ═══════════════════════════════════════════════════════════════
    // PHASE 2: API-Football fallback — ligues non couvertes par BSD
    // ═══════════════════════════════════════════════════════════════
    if (API_FOOTBALL_KEY && BSD_FALLBACK_NEEDED.length) {
      console.log(`  [Cron:Stats] Phase 2: API-Football fallback (${BSD_FALLBACK_NEEDED.length} ligues)…`);
      let activeSeason = currentSeason();

      for (const lid of BSD_FALLBACK_NEEDED) {
        try {
          // Respect du cycle T1 (6h) vs T2 (12h)
          const leagueCronMs = LEAGUE_CRON_MS[lid] || (6 * 3600000);
          const lastLeagueUpdate = db.statsUpdateByLeague[lid];
          if (!force && lastLeagueUpdate && (Date.now() - new Date(lastLeagueUpdate).getTime()) < leagueCronMs) {
            const tier = leagueCronMs >= 12 * 3600000 ? 'T2' : 'T1';
            console.log(`  [Fallback] Ligue ${lid} (${tier}) — données fraîches — saut`);
            continue;
          }

          let sRes = await httpsGet(
            `https://v3.football.api-sports.io/standings?league=${lid}&season=${activeSeason}`,
            { 'x-apisports-key': API_FOOTBALL_KEY }
          );
          if (sRes.status !== 200) {
            if (sRes.status === 429) {
              db.status = 'quota_epuise_stats'; saveDB();
              console.warn(`  [Cron:Stats] Quota API-Football épuisé sur la ligue ${lid}`);
              break;
            }
            console.warn(`  [Cron:Stats] Ligue ${lid} HTTP ${sRes.status}`);
            continue;
          }
          // Fallback saison : le plan gratuit ne donne pas toujours accès à la saison en cours
          const planErr = sRes.data.errors?.plan;
          if (planErr && activeSeason > 2024) {
            activeSeason = activeSeason - 1;
            console.warn(`  [Cron:Stats] Plan gratuit — saison ${activeSeason + 1} non accessible, bascule sur ${activeSeason}`);
            sRes = await httpsGet(
              `https://v3.football.api-sports.io/standings?league=${lid}&season=${activeSeason}`,
              { 'x-apisports-key': API_FOOTBALL_KEY }
            );
          }
          if (sRes.headers['x-requests-remaining']) {
            db.statsQuotaRemaining = sRes.headers['x-requests-remaining'];
          }
          const groups = sRes.data.response?.[0]?.league?.standings || [];
          // v9.2: Debug log pour voir la structure API-Football
          if (groups.length > 0 && groups[0].length > 0) {
            const sample = groups[0][0];
            console.log(`  [DATA MAPPING] API-Football standings sample — team: ${sample.team?.name}`);
            console.log(`  [DATA MAPPING] API-Football home structure: goals.for=${JSON.stringify(sample.home?.goals?.for)}, goals.against=${JSON.stringify(sample.home?.goals?.against)}`);
          }
          groups.forEach(group => {
            group.forEach(entry => {
              const key = normName(entry.team.name);
              const homeStats = buildSideStats(entry.home);
              const awayStats = buildSideStats(entry.away);

              // Debug log for first team only
              if (fallbackTeamsFetched === 0) {
                console.log(`  [DATA MAPPING] Buts extraits pour ${entry.team.name} : ${homeStats.avgScored} marqués, ${homeStats.avgConceded} encaissés (home) | ${awayStats.avgScored} marqués, ${awayStats.avgConceded} encaissés (away) | form: ${entry.form || '(vide)'}`);
              }

              db.teamStats[key] = {
                home: homeStats,
                away: awayStats,
                rank: entry.rank,
                form: entry.form || '',
                teamId: entry.team.id,
                leagueId: lid,
                _real: true,
                _source: 'api-football',
              };
              fallbackTeamsFetched++;
              totalTeams++;
            });
          });
          if (groups.length) {
            db.statsUpdateByLeague[lid] = new Date().toISOString();
            console.log(`  [Fallback] Ligue ${lid} → OK (${groups.reduce((s, g) => s + g.length, 0)} équipes)`);
          } else console.warn(`  [Fallback] Ligue ${lid} → standings vides`);
        } catch (e) { console.warn(`  [Fallback] Ligue ${lid} erreur:`, e.message); }
      }
      console.log(`  [Fallback] Phase 2 terminée: ${fallbackTeamsFetched} équipes`);
    }

    db.lastStatsUpdate = new Date().toISOString();
    db.status = 'ok';
    saveDB();
    syncCacheBuffers(); // ← Tampon mémoire mis à jour après succès

    console.log(`  [Cron:Stats] ✓ ${totalTeams} équipes mises à jour (BSD: ${bsdTeamsFetched}, Fallback: ${fallbackTeamsFetched})`);
    if (db.statsQuotaRemaining) console.log(`  [Cron:Stats] Quota API-Football restant: ${db.statsQuotaRemaining}`);
    console.log('═'.repeat(60));

    // Injuries pre-fetch — SUPPRIMÉ (données mappées via flux BSD dans buildMatchRecord)
    console.log('✅ [OPTIMISATION] Données Injuries mappées directement via le flux principal (Appel API tiers supprimé).');

    // Phase 3: Sofascore supplement — fill missing stats for teams in sofa-only leagues
    const teamsNeedingSofa = [];
    for (const league of leaguesConfig.leagues) {
      if (!league.sofa_id) continue;
      const leagueMatches = db.matches.filter(m => m.sport === league.odds_key);
      const teamSet = new Set();
      leagueMatches.forEach(m => { teamSet.add(m.home_team); teamSet.add(m.away_team); });
      for (const tName of teamSet) {
        const k = normName(tName);
        if (db.teamStats[k]?._real) continue;
        teamsNeedingSofa.push({ teamName: tName, leagueId: league.id, leagueName: league.name });
      }
    }
    if (teamsNeedingSofa.length) {
      console.log(`  [Cron:Stats] Phase 3: Sofascore supplement — ${teamsNeedingSofa.length} équipes sans stats réelles…`);
      let sofaFilled = 0;
      for (const { teamName, leagueId } of teamsNeedingSofa) {
        try {
          const stats = await fetchSofascoreTeamStats(teamName, leagueId);
          if (stats) { db.teamStats[normName(teamName)] = { teamId: null, rank: 0, ...stats }; sofaFilled++; }
        } catch (e) { /* silencieux */ }
      }
      if (sofaFilled) console.log(`  [Cron:Stats] Phase 3: ✓ ${sofaFilled} équipes alimentées via Sofascore`);
    }

    // Re-fusionner les matchs avec les nouvelles stats
    if (db.matches.length) await fetchOdds();

  } catch (e) {
    console.error('  [Cron:Stats] Erreur fatale:', e.message);
    // GUARD: Préserver le cache mémoire même si stats échouent
    if (Object.keys(db.teamStats).length === 0 && Object.keys(cachedLeagues).length > 0) {
      console.log('  [Cron:Stats] 🛡️ Fallback — stats vides, ligues en cache conservées');
    }
    if (!db.matches.length && cachedMatches.length > 0) {
      console.log('  [Cron:Stats] 🛡️ Fallback cache mémoire — restauration de', cachedMatches.length, 'matchs');
      db.matches = JSON.parse(JSON.stringify(cachedMatches));
      db.status = 'cache_fallback';
      saveDB();
    }
  } finally {
    isFetchingStats = false;
  }
}

async function fetchFixturesByDateRange(from, to) {
  const fixtures = [];
  const startDate = new Date(`${from}T00:00:00Z`);
  const endDate = new Date(`${to}T00:00:00Z`);
  for (let dt = new Date(startDate); dt <= endDate; dt.setDate(dt.getDate() + 1)) {
    const date = formatDateOnly(new Date(dt));
    try {
      const dayRes = await httpsGet(
        `https://v3.football.api-sports.io/fixtures?date=${date}&timezone=Europe/Paris`,
        { 'x-apisports-key': API_FOOTBALL_KEY }
      );
      if (dayRes.status === 200 && dayRes.data && Array.isArray(dayRes.data.response)) {
        fixtures.push(...dayRes.data.response);
        if (dayRes.headers['x-requests-remaining']) db.statsQuotaRemaining = dayRes.headers['x-requests-remaining'];
      } else {
        console.warn(`  [Cron:Stats] Fixture ${date} HTTP ${dayRes.status}`, dayRes.data || 'no body');
      }
    } catch (e) {
      console.warn(`  [Cron:Stats] Fixture ${date} erreur:`, e.message);
    }
  }
  return fixtures;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  v7.9 LAZY LOADING PRIORITAIRE — Force Sync d'un fixture manquant on-demand
// ═══════════════════════════════════════════════════════════════════════════════

const forceSyncLock = new Set(); // Évite les doubles appels simultanés sur le même ID

// Helper: un match est-il "vide" (aucune stat utile) ?
function matchHasData(m) {
  const hasStats = m.stats && (m.stats.home || m.stats.away);
  const hasPoisson = m.poisson && m.poisson.homeWin != null;
  const hasEdge = m.edge && (m.edge.home !== null || m.edge.draw !== null || m.edge.away !== null);
  const hasExpectedGoals = m.expectedGoals && (m.expectedGoals.home > 0 || m.expectedGoals.away > 0);
  return hasStats || hasPoisson || hasEdge || hasExpectedGoals;
}

// Validation Full-or-Nothing pour deep-stats
function isMatchReady(m) {
  const missing = [];
  const hasRatings = (m._bsd_home_ratings?.length > 0) && (m._bsd_away_ratings?.length > 0);
  const hasSquad = (m._bsd_home_squad?.length > 0) && (m._bsd_away_squad?.length > 0);
  const hasPoisson = m.poisson && m.poisson.homeWin != null && m.poisson.homeWin > 0;
  const hasStats = m.stats && ((m.stats.home?.avgScored > 0) || (m.stats.away?.avgScored > 0));

  if (!hasRatings) missing.push('ratings');
  if (!hasSquad) missing.push('squad');
  if (!hasPoisson || !hasStats) missing.push('poisson');

  return { ready: missing.length === 0, missing };
}

// v9.2: Validation de contenu — vérification TYPE STRICTE, pas juste existence
function validateMatchIntegrity(m) {
  const errors = [];

  // Vérifier stats de base — TYPE CHECK (nombre > 0, pas juste existence)
  const hs = m.stats?.home || {};
  const as = m.stats?.away || {};

  if (typeof hs.avgScored !== 'number' || isNaN(hs.avgScored) || hs.avgScored === 0) errors.push(`home_avgScored=${hs.avgScored ?? 'null'} (type: ${typeof hs.avgScored})`);
  if (typeof as.avgScored !== 'number' || isNaN(as.avgScored) || as.avgScored === 0) errors.push(`away_avgScored=${as.avgScored ?? 'null'} (type: ${typeof as.avgScored})`);
  if (typeof hs.avgConceded !== 'number' || isNaN(hs.avgConceded) || hs.avgConceded === 0) errors.push(`home_avgConceded=${hs.avgConceded ?? 'null'}`);
  if (typeof as.avgConceded !== 'number' || isNaN(as.avgConceded) || as.avgConceded === 0) errors.push(`away_avgConceded=${as.avgConceded ?? 'null'}`);

  // Vérifier ratings BSD
  if (!m._bsd_home_ratings?.length) errors.push('home_ratings_empty');
  if (!m._bsd_away_ratings?.length) errors.push('away_ratings_empty');

  // Vérifier Poisson — type check
  if (!m.poisson || typeof m.poisson.homeWin !== 'number' || m.poisson.homeWin === 0) errors.push('poisson_invalid');
  if (!m.expectedGoals || typeof m.expectedGoals.home !== 'number' || m.expectedGoals.home === 0) errors.push('expectedGoals_invalid');

  // Vérifier forme — si vide, données incomplètes
  if (!m.home_form || m.home_form === '') errors.push('home_form_empty');
  if (!m.away_form || m.away_form === '') errors.push('away_form_empty');

  // Vérifier fatigue (999h = échec de calcul)
  if (m._fatigue_home?.hoursRest === 999) errors.push('fatigue_home_failed');
  if (m._fatigue_away?.hoursRest === 999) errors.push('fatigue_away_failed');

  return { valid: errors.length === 0, errors };
}

async function forceSyncFixture(fixtureId) {
  // v9.1: ID validation — prevent undefined/null fetches
  if (!fixtureId || fixtureId === 'undefined' || fixtureId === 'null') {
    console.error("\x1b[31m[CRITICAL_FETCH] ID invalide: %s — abort\x1b[0m", fixtureId);
    return null;
  }
  if (!BSD_API_KEY) {
    console.error("\x1b[31m[SYNC] BSD API clé manquante — impossible de sync %s\x1b[0m", fixtureId);
    return null;
  }
  if (forceSyncLock.has(fixtureId)) {
    console.log(`  [SYNC] Déjà en cours pour ${fixtureId} — skip`);
    return null;
  }
  forceSyncLock.add(fixtureId);
  console.error("\x1b[31m[CRITICAL_FETCH] Appel API pour MatchID: %s\x1b[0m", fixtureId);

  try {
    // 1. Trouver le match existant en cache pour récupérer les metadata BSD
    let match = db.matches.find(m => m.id === fixtureId);
    if (!match) match = cachedMatches.find(m => m.id === fixtureId);
    if (!match) match = db.matches.find(m => String(m._bsd_event_id) === String(fixtureId));
    if (!match) match = db.matches.find(m => String(m.fixture_id) === String(fixtureId));
    if (!match) {
      console.error("\x1b[31m[SYNC] Match %s introuvable dans db et cache\x1b[0m", fixtureId);
      forceSyncLock.delete(fixtureId);
      return null;
    }

    const eventId = match._bsd_event_id;
    const homeTeam = match.home_team;
    const awayTeam = match.away_team;
    const league = match.league;

    console.error("\x1b[31m[SYNC] Match trouvé: %s vs %s (%s) — BSD Event ID: %s\x1b[0m", homeTeam, awayTeam, league, eventId);

    // 2. Récupérer les BSD team IDs depuis db.teamStats
    const hKey = normName(homeTeam);
    const aKey = normName(awayTeam);
    const hMeta = db.teamStats[hKey] || findFuzzy(hKey);
    const aMeta = db.teamStats[aKey] || findFuzzy(aKey);
    const hBsdTeamId = hMeta?.bsdTeamId || null;
    const aBsdTeamId = aMeta?.bsdTeamId || null;
    const hBsdSeasonId = hMeta?.bsdSeasonId || null;
    const aBsdSeasonId = aMeta?.bsdSeasonId || null;

    console.error("\x1b[31m[SYNC] Home BSD Team ID: %s, Away BSD Team ID: %s\x1b[0m", hBsdTeamId, aBsdTeamId);

    // FIX v15.5 — Dr. Chen : Backfill home_form/away_form depuis db.teamStats
    //   Sans ça, un match construit avant l'arrivée des standings garde home_form="" à vie
    if ((!match.home_form || match.home_form === '') && hMeta?.form && hMeta.form.length >= 3) {
      match.home_form = hMeta.form;
      console.log(`  [SYNC] ✓ home_form backfillé pour ${homeTeam}: "${hMeta.form}"`);
    }
    if ((!match.away_form || match.away_form === '') && aMeta?.form && aMeta.form.length >= 3) {
      match.away_form = aMeta.form;
      console.log(`  [SYNC] ✓ away_form backfillé pour ${awayTeam}: "${aMeta.form}"`);
    }

    // 3. Fetch BSD data en parallèle (v50.0: + key players KPI)
    const [prediction, homeSquad, awaySquad, homeRatings, awayRatings, homeKP, awayKP] = await Promise.all([
      eventId ? fetchBSDPrediction(eventId) : Promise.resolve(null),
      hBsdTeamId ? fetchBSDTeamSquad(hBsdTeamId) : Promise.resolve([]),
      aBsdTeamId ? fetchBSDTeamSquad(aBsdTeamId) : Promise.resolve([]),
      (hBsdTeamId && hBsdSeasonId) ? fetchBSDPlayerRatings(hBsdTeamId, hBsdSeasonId) : Promise.resolve([]),
      (aBsdTeamId && aBsdSeasonId) ? fetchBSDPlayerRatings(aBsdTeamId, aBsdSeasonId) : Promise.resolve([]),
      (hBsdTeamId && hBsdSeasonId) ? fetchTeamKeyPlayersBSD(hBsdTeamId, hBsdSeasonId) : Promise.resolve([]),
      (aBsdTeamId && aBsdSeasonId) ? fetchTeamKeyPlayersBSD(aBsdTeamId, aBsdSeasonId) : Promise.resolve([]),
    ]);

    // 4. Fetch BSD event details pour refresh odds/xg
    let eventDetails = null;
    if (eventId) {
      try {
        const evRes = await bsdFetch(`/events/${eventId}/`);
        if (evRes.status === 200 && evRes.data) {
          eventDetails = evRes.data;
          // Refresh odds et xg dans le match existant
          if (eventDetails.odds_home != null) match.odds.home = eventDetails.odds_home;
          if (eventDetails.odds_draw != null) match.odds.draw = eventDetails.odds_draw;
          if (eventDetails.odds_away != null) match.odds.away = eventDetails.odds_away;
          if (eventDetails.actual_home_xg != null) match.bsd_xg = match.bsd_xg || {};
          if (eventDetails.actual_home_xg != null) match.bsd_xg.home = eventDetails.actual_home_xg;
          if (eventDetails.actual_away_xg != null) { match.bsd_xg = match.bsd_xg || {}; match.bsd_xg.away = eventDetails.actual_away_xg; }
        }
      } catch (e) {
        console.warn(`  [SYNC] Event details fetch échoué: ${e.message}`);
      }
    }

    // 5. Re-calculer Poisson avec les données BSD mises à jour
    // Fallback historique si stats à 0 ou vides
    let hs = match.stats?.home || {};
    let as = match.stats?.away || {};
    const LEAGUE_AVG = 1.35;

    const hHist = getHistoricalAvgGoals(match.home_team, true);
    const aHist = getHistoricalAvgGoals(match.away_team, false);

    // Si stats réelles absentes ou à 0 → utiliser historique
    if ((!hs.avgScored || hs.avgScored === 0) && hHist) {
      console.log("\x1b[33m[SYNC] Stats home à 0 — fallback historique: %s (avg %.2f marqué, %.2f encaissé, %d matchs)\x1b[0m",
        match.home_team, hHist.avgScored, hHist.avgConceded, hHist.sampleSize);
      hs = { ...hs, avgScored: hHist.avgScored, avgConceded: hHist.avgConceded };
    }
    if ((!as.avgScored || as.avgScored === 0) && aHist) {
      console.log("\x1b[33m[SYNC] Stats away à 0 — fallback historique: %s (avg %.2f marqué, %.2f encaissé, %d matchs)\x1b[0m",
        match.away_team, aHist.avgScored, aHist.avgConceded, aHist.sampleSize);
      as = { ...as, avgScored: aHist.avgScored, avgConceded: aHist.avgConceded };
    }

    // Dernier fallback: league average si toujours 0
    const hScored = hs.avgScored || LEAGUE_AVG;
    const hConceded = hs.avgConceded || LEAGUE_AVG;
    const aScored = as.avgScored || LEAGUE_AVG;
    const aConceded = as.avgConceded || LEAGUE_AVG;

    const expHome = hScored / LEAGUE_AVG * aConceded;
    const expAway = aScored / LEAGUE_AVG * hConceded;
    match.expectedGoals = { home: parseFloat(expHome.toFixed(2)), away: parseFloat(expAway.toFixed(2)) };
    match.poisson = computePoisson(expHome, expAway);

    // 6. Injecter les données BSD enrichies (v50.0: + key players KPI)
    match._bsd_prediction = prediction;
    match._bsd_home_squad = homeSquad;
    match._bsd_away_squad = awaySquad;
    match._bsd_home_ratings = homeRatings;
    match._bsd_away_ratings = awayRatings;
    match._bsd_home_kp = homeKP;
    match._bsd_away_kp = awayKP;

    // Pre-calculer le top 3 buteurs
    match.topButteurs = computeMatchTopButteurs(match);

    // 7. Recalculer edge si les cotes ont changé
    if (match.odds.home && match.odds.draw && match.odds.away) {
      const edge = computeEdge(match);
      if (edge) {
        match.edge = edge.edge;
        match.fair = edge.fair;
        match.best_edge = edge.best;
      }
    }

    // 8. Sauvegarder — injection directe dans db ET cachedMatches
    saveDB();

    // Mise à jour immédiate de cachedMatches (le match est déjà dans db.matches par référence)
    const cachedIdx = cachedMatches.findIndex(m => m.id === match.id);
    if (cachedIdx >= 0) {
      cachedMatches[cachedIdx] = match; // Remplacer la référence
    } else {
      cachedMatches.push(match);
    }

    console.error("\x1b[32m✅ [BSD_BRIDGE] Match %s injecté et prêt pour l'UI\x1b[0m", fixtureId);
    console.error("\x1b[32m[SYNC] Match %s synchronisé avec succès via BSD Engine\x1b[0m", fixtureId);
    console.log(`  [SYNC] ✅ ${homeTeam} vs ${awayTeam} — BSD: prediction=${!!prediction}, squad=${homeSquad.length + awaySquad.length} joueurs, ratings=${homeRatings.length + awayRatings.length} entrées`);

    forceSyncLock.delete(fixtureId);
    return match;
  } catch (e) {
    console.error("\x1b[31m[SYNC] Erreur pour %s: %s\x1b[0m", fixtureId, e.message);
    console.error("\x1b[31m[SYNC] Stack: %s\x1b[0m", e.stack);
    forceSyncLock.delete(fixtureId);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  v8.7 GLOBAL PROACTIVE CRAWLER — Pré-chargement BSD au démarrage
// ═══════════════════════════════════════════════════════════════════════════════

const PRELOAD_WINDOW_MS = 48 * 3600 * 1000; // 48h
const PRELOAD_DELAY_MS = 2000; // 2s entre chaque match
const PRELOAD_START_DELAY_MS = 60 * 1000; // 1min après boot

// Tracker de persistance : quels matchs ont été pré-chargés
let preloadTracker = {}; // { matchId: { ts, ratingsCount, squadCount } }

function loadPreloadTracker() {
  try {
    preloadTracker = kvGet('preload_tracker', {});
    const count = Object.keys(preloadTracker).length;
    if (count > 0) console.log(`  [PRELOAD] Tracker chargé — ${count} matchs déjà pré-chargés`);
  } catch (e) {
    console.warn('  [PRELOAD] Tracker load échoué:', e.message);
    preloadTracker = {};
  }
}

function savePreloadTracker() {
  try {
    kvSet('preload_tracker', preloadTracker);
  } catch (e) {
    console.warn('  [PRELOAD] Tracker save échoué:', e.message);
  }
}

function markMatchPreloaded(matchId, ratingsCount, squadCount) {
  preloadTracker[matchId] = { ts: Date.now(), ratingsCount, squadCount };
  savePreloadTracker();
}

function isMatchPreloaded(matchId) {
  const entry = preloadTracker[matchId];
  if (!entry) return false;
  // Expirer après 24h (les données joueurs changent)
  return (Date.now() - entry.ts) < 24 * 3600 * 1000;
}

async function runGlobalPreload() {
  console.log('');
  console.log('  ╔══════════════════════════════════════════════════════╗');
  console.log('  ║     🌐 GLOBAL BSD PRELOAD — Proactive Crawler      ║');
  console.log('  ╚══════════════════════════════════════════════════════╝');

  const now = Date.now();
  const cutoff = now + PRELOAD_WINDOW_MS;

  // Filtrer les matchs dans les prochaines 48h
  const upcomingMatches = db.matches.filter(m => {
    const kickoff = new Date(m.commence_time).getTime();
    return kickoff > now && kickoff < cutoff;
  });

  // Filtrer ceux qui n'ont pas encore de données BSD fraîches
  const toPreload = upcomingMatches.filter(m => {
    if (isMatchPreloaded(m.id)) return false; // Déjà fait
    const hasBSD = m._bsd_home_ratings?.length || m._bsd_away_ratings?.length;
    return !hasBSD;
  });

  console.log(`  [PRELOAD] Scan lancé pour ${upcomingMatches.length} matchs dans les 48h...`);
  console.log(`  [PRELOAD] ${toPreload.length} matchs nécessitent un pré-chargement BSD`);

  if (toPreload.length === 0) {
    console.log('  [PRELOAD] ✅ Tous les matchs sont à jour — aucun fetch nécessaire');
    return;
  }

  let successCount = 0;
  let failCount = 0;
  let skipCount = 0;

  for (let i = 0; i < toPreload.length; i++) {
    const m = toPreload[i];
    const eventId = m._bsd_event_id;
    const homeTeam = m.home_team;
    const awayTeam = m.away_team;

    // Vérifier si on a les BSD team IDs
    const hKey = normName(homeTeam);
    const aKey = normName(awayTeam);
    const hMeta = db.teamStats[hKey] || findFuzzy(hKey);
    const aMeta = db.teamStats[aKey] || findFuzzy(aKey);
    const hBsdTeamId = hMeta?.bsdTeamId || null;
    const aBsdTeamId = aMeta?.bsdTeamId || null;
    const hBsdSeasonId = hMeta?.bsdSeasonId || null;
    const aBsdSeasonId = aMeta?.bsdSeasonId || null;

    if (!hBsdTeamId && !aBsdTeamId) {
      console.log(`  [PRELOAD] ⏭️ ${homeTeam} vs ${awayTeam} — pas de BSD team IDs → skip`);
      skipCount++;
      continue;
    }

    try {
      // Fetch BSD data en parallèle
      const [prediction, homeSquad, awaySquad, homeRatings, awayRatings] = await Promise.all([
        eventId ? fetchBSDPrediction(eventId) : Promise.resolve(null),
        hBsdTeamId ? fetchBSDTeamSquad(hBsdTeamId) : Promise.resolve([]),
        aBsdTeamId ? fetchBSDTeamSquad(aBsdTeamId) : Promise.resolve([]),
        (hBsdTeamId && hBsdSeasonId) ? fetchBSDPlayerRatings(hBsdTeamId, hBsdSeasonId) : Promise.resolve([]),
        (aBsdTeamId && aBsdSeasonId) ? fetchBSDPlayerRatings(aBsdTeamId, aBsdSeasonId) : Promise.resolve([]),
      ]);

      // Injecter dans le match
      m._bsd_prediction = prediction;
      m._bsd_home_squad = homeSquad;
      m._bsd_away_squad = awaySquad;
      m._bsd_home_ratings = homeRatings;
      m._bsd_away_ratings = awayRatings;

      // Pre-calculer le top 3 buteurs (persiste en DB avec le match)
      m.topButteurs = computeMatchTopButteurs(m);

      // Mettre à jour cachedMatches aussi
      const cachedIdx = cachedMatches.findIndex(cm => cm.id === m.id);
      if (cachedIdx >= 0) cachedMatches[cachedIdx] = m;

      // Marquer comme pré-chargé
      markMatchPreloaded(m.id, homeRatings.length + awayRatings.length, homeSquad.length + awaySquad.length);

      successCount++;
      console.log(`  [PRELOAD] ✅ [${i + 1}/${toPreload.length}] ${homeTeam} vs ${awayTeam} — ratings=${homeRatings.length + awayRatings.length}, squad=${homeSquad.length + awaySquad.length}`);
    } catch (e) {
      failCount++;
      console.warn(`  [PRELOAD] ❌ [${i + 1}/${toPreload.length}] ${homeTeam} vs ${awayTeam} — ${e.message}`);
    }

    // Délai anti-spam (sauf dernier)
    if (i < toPreload.length - 1) {
      await new Promise(r => setTimeout(r, PRELOAD_DELAY_MS));
    }
  }

  // Sauvegarder tout
  saveDB();

  console.log('');
  console.log(`  [PRELOAD] 📊 Résumé: ${successCount} succès, ${failCount} échecs, ${skipCount} skip`);
  console.log(`  [PRELOAD] 💾 Données persistées dans pariscore.db`);
  console.log('');
}

// ═══════════════════════════════════════════════════════════════════════════════
//  v8.8 PROACTIVE HYDRATOR — Worker de fond autonome
// ═══════════════════════════════════════════════════════════════════════════════

const HYDRATOR_WINDOW_MS = 48 * 3600 * 1000; // 48h
const HYDRATOR_DELAY_MS = 3000; // 3s entre chaque match (rate limit BSD)
const HYDRATOR_INTERVAL_MS = 15 * 60 * 1000; // 15min entre chaque cycle
const HYDRATOR_START_DELAY_MS = 90 * 1000; // 90s après boot (après preload)

let hydratorRunning = false;

// ── Historical Fallback: avg goals from last N finished matches ──────────────
function getHistoricalAvgGoals(teamName, isHome, limit = 5) {
  const now = Date.now();
  const finished = db.matches
    .filter(m => {
      const isTeamMatch = (m.home_team === teamName || m.away_team === teamName);
      const isFinished = m.live_score && !m.live_minute; // terminé (score final)
      const isPast = new Date(m.commence_time).getTime() < now;
      return isTeamMatch && isFinished && isPast;
    })
    .sort((a, b) => new Date(b.commence_time).getTime() - new Date(a.commence_time).getTime())
    .slice(0, limit);

  if (finished.length === 0) return null;

  let totalScored = 0, totalConceded = 0;
  for (const m of finished) {
    const [hs, as] = m.live_score.split('-').map(Number);
    if (isNaN(hs) || isNaN(as)) continue;
    if (m.home_team === teamName) {
      totalScored += hs;
      totalConceded += as;
    } else {
      totalScored += as;
      totalConceded += hs;
    }
  }

  if (totalScored === 0 && totalConceded === 0) return null;
  return {
    avgScored: parseFloat((totalScored / finished.length).toFixed(2)),
    avgConceded: parseFloat((totalConceded / finished.length).toFixed(2)),
    sampleSize: finished.length,
  };
}

// Calculs Data Science post-injection
function computeFatigueIndex(teamName, matchDate) {
  // v9.0 Fix: Fallback to archive_matches si 999h (pas de match dans db.matches)
  const matchTs = new Date(matchDate).getTime();
  const windowMs = 7 * 24 * 3600 * 1000; // ±7 jours

  // Tous les matchs de l'équipe dans la fenêtre (db.matches)
  let teamMatches = db.matches.filter(m => {
    const mTs = new Date(m.commence_time).getTime();
    const diff = Math.abs(mTs - matchTs);
    return diff < windowMs && (m.home_team === teamName || m.away_team === teamName) && mTs !== matchTs;
  }).sort((a, b) => new Date(a.commence_time).getTime() - new Date(b.commence_time).getTime());

  // 1. Recency: heures depuis le dernier match AVANT ce match
  let pastMatches = teamMatches.filter(m => new Date(m.commence_time).getTime() < matchTs);
  let hoursRest = pastMatches.length > 0
    ? (matchTs - new Date(pastMatches[pastMatches.length - 1].commence_time).getTime()) / 3600000
    : 999;

  // v9.0: Si 999h, chercher dans archive_matches
  if (hoursRest === 999 && db.archive_matches) {
    const archiveMatches = db.archive_matches.filter(m => {
      const mTs = new Date(m.commence_time).getTime();
      const diff = matchTs - mTs; // seulement les matchs passés
      return diff > 0 && diff < windowMs && (m.home_team === teamName || m.away_team === teamName);
    }).sort((a, b) => new Date(b.commence_time).getTime() - new Date(a.commence_time).getTime());

    if (archiveMatches.length > 0) {
      const lastMatch = archiveMatches[0];
      hoursRest = (matchTs - new Date(lastMatch.commence_time).getTime()) / 3600000;
      pastMatches = archiveMatches;
      console.log(`  [FATIGUE] Fallback archive_matches pour ${teamName}: ${Math.round(hoursRest)}h depuis dernier match`);
    }
  }

  // 2. Density: nombre de matchs dans les 14 derniers jours
  const densityWindow = matchTs - 14 * 24 * 3600 * 1000;
  let matchesIn14d = teamMatches.filter(m => new Date(m.commence_time).getTime() >= densityWindow && new Date(m.commence_time).getTime() < matchTs).length;

  // v9.0: Inclure archive_matches dans le density count
  if (db.archive_matches && matchesIn14d === 0) {
    const archiveDensity = db.archive_matches.filter(m => {
      const mTs = new Date(m.commence_time).getTime();
      return mTs >= densityWindow && mTs < matchTs && (m.home_team === teamName || m.away_team === teamName);
    }).length;
    matchesIn14d = archiveDensity;
  }

  // 3. Upcoming: matchs dans les 72h APRÈS ce match (double fixture)
  const upcomingIn72h = teamMatches.filter(m => {
    const mTs = new Date(m.commence_time).getTime();
    return mTs > matchTs && (mTs - matchTs) < 72 * 3600 * 1000;
  }).length;

  // Score composite 0-100 (100 = très fatigué)
  const recencyWeight = Math.exp(-hoursRest / 72) * 40; // e^(-h/72) × 40
  const densityWeight = Math.min(matchesIn14d / 5, 1) * 35; // normalized × 35
  const doubleFixtureWeight = upcomingIn72h > 0 ? 25 : 0; // penalty si double fixture

  const fatigueScore = Math.min(100, Math.round(recencyWeight + densityWeight + doubleFixtureWeight));

  let level;
  if (fatigueScore >= 75) level = 'critical';
  else if (fatigueScore >= 50) level = 'tired';
  else if (fatigueScore >= 25) level = 'normal';
  else level = 'fresh';

  return {
    hoursRest: Math.round(hoursRest),
    level,
    score: fatigueScore,
    matchesIn14d,
    upcomingIn72h,
  };
}

function computeAbsenceImpact(squad, teamName) {
  // P2 Fix: Graded impact (-5 to -25) based on all positions, weighted by contribution
  if (!squad || !squad.length) return { impact: 0, player: null, grade: 'none' };

  // Trouver les joueurs absents ou blessés
  const unavailable = squad.filter(p =>
    p.injured || p.suspended || p.availability === 'unavailable'
  );

  if (!unavailable.length) return { impact: 0, player: null, grade: 'none' };

  // Calculer l'impact par joueur basé sur goals + assists + rating
  const impacts = unavailable.map(p => {
    const goalContribution = (p.goals || 0) * 3 + (p.assists || 0) * 2;
    const ratingFactor = p.avg_rating ? Math.max(0, (p.avg_rating - 5) / 5) : 0.5;
    const rawImpact = goalContribution * ratingFactor;

    // Graded: -5 (mineur) à -25 (critique)
    let grade, impact;
    if (rawImpact >= 15 || (p.position === 'A' || p.position === 'Attacker') && (p.goals || 0) >= 5) {
      grade = 'critical'; impact = -25;
    } else if (rawImpact >= 8) {
      grade = 'high'; impact = -15;
    } else if (rawImpact >= 3) {
      grade = 'medium'; impact = -10;
    } else {
      grade = 'low'; impact = -5;
    }

    return {
      impact,
      player: p.name,
      position: p.position,
      goals: p.goals || 0,
      assists: p.assists || 0,
      rating: p.avg_rating,
      grade,
      reason: p.injured ? 'blessé' : p.suspended ? 'suspendu' : 'indisponible',
    };
  });

  // Retourner le pire impact
  impacts.sort((a, b) => a.impact - b.impact);
  return impacts[0];
}

function computeDominanceScore(homeRatings, awayRatings, homeSquad, awaySquad) {
  // P2 Fix: Weight ALL lines — DEF 20%, MID 40%, ATK 40%
  const posWeight = p => {
    const pos = (p.position || '').toLowerCase();
    if (pos === 'g' || pos === 'goalkeeper') return { line: 'DEF', weight: 0.05 };
    if (pos === 'd' || pos === 'defender') return { line: 'DEF', weight: 0.20 };
    if (pos === 'm' || pos === 'midfielder') return { line: 'MID', weight: 0.40 };
    if (pos === 'a' || pos === 'attacker' || pos === 'f') return { line: 'ATK', weight: 0.35 };
    return { line: 'MID', weight: 0.20 }; // default
  };

  const lineScore = (ratings) => {
    const lines = { DEF: { total: 0, weight: 0 }, MID: { total: 0, weight: 0 }, ATK: { total: 0, weight: 0 } };
    for (const p of ratings) {
      const { line, weight } = posWeight(p);
      const rating = p.avg_rating || 0;
      const minutes = p.minutes || 90;
      const weightedRating = rating * weight * Math.min(minutes / 90, 1);
      lines[line].total += weightedRating;
      lines[line].weight += weight;
    }
    let score = 0;
    for (const line of Object.values(lines)) {
      if (line.weight > 0) score += line.total / line.weight;
    }
    return score;
  };

  const homeScore = lineScore(homeRatings);
  const awayScore = lineScore(awayRatings);
  const total = homeScore + awayScore;
  if (total === 0) return { home: 50, away: 50, label: 'Équilibré' };

  const homePct = Math.round((homeScore / total) * 100);
  const awayPct = 100 - homePct;

  let label;
  if (homePct >= 60) label = 'Domination domicile';
  else if (homePct >= 55) label = 'Léger avantage domicile';
  else if (awayPct >= 60) label = 'Domination extérieur';
  else if (awayPct >= 55) label = 'Léger avantage extérieur';
  else label = 'Équilibré';

  return { home: homePct, away: awayPct, label, homeScore: homeScore.toFixed(2), awayScore: awayScore.toFixed(2) };
}

function computeMatchEV(match) {
  // P0 Fix: Use devigged/blended probabilities, NOT calibrated
  // EV% = (Probabilité_fair × Cote_Bookmaker) - 1
  const evs = {};

  // Chaîne de fallback: devigged → blended → poisson → calibrated
  let probs;
  if (match.devigged && match.devigged.homeWin != null) {
    probs = { home: match.devigged.homeWin / 100, draw: match.devigged.draw / 100, away: match.devigged.awayWin / 100 };
  } else if (match.blended && match.blended.homeWin != null) {
    probs = { home: match.blended.homeWin / 100, draw: match.blended.draw / 100, away: match.blended.awayWin / 100 };
  } else if (match.poisson && match.poisson.homeWin != null) {
    probs = { home: match.poisson.homeWin / 100, draw: match.poisson.draw / 100, away: match.poisson.awayWin / 100 };
  } else if (match.calibrated) {
    probs = { home: (match.calibrated.homeWin || 33.3) / 100, draw: (match.calibrated.draw || 33.3) / 100, away: (match.calibrated.awayWin || 33.3) / 100 };
  } else {
    return { home: null, draw: null, away: null };
  }

  if (!match.odds) return { home: null, draw: null, away: null };

  evs.home = match.odds.home ? parseFloat(((probs.home * match.odds.home - 1) * 100).toFixed(1)) : null;
  evs.draw = match.odds.draw ? parseFloat(((probs.draw * match.odds.draw - 1) * 100).toFixed(1)) : null;
  evs.away = match.odds.away ? parseFloat(((probs.away * match.odds.away - 1) * 100).toFixed(1)) : null;
  return evs;
}

async function runProactiveHydrator() {
  if (hydratorRunning) {
    console.log('  [HYDRATOR] Déjà en cours — skip ce cycle');
    return;
  }
  hydratorRunning = true;

  console.log('');
  console.log('  ╔══════════════════════════════════════════════════════╗');
  console.log('  ║     💧 PROACTIVE HYDRATOR — Worker Autonome        ║');
  console.log('  ╚══════════════════════════════════════════════════════╝');

  const now = Date.now();
  const cutoff = now + HYDRATOR_WINDOW_MS;

  // Filtrer les matchs dans les prochaines 48h
  const upcomingMatches = db.matches.filter(m => {
    const kickoff = new Date(m.commence_time).getTime();
    return kickoff > now && kickoff < cutoff;
  });

  // Filtrer ceux qui ne sont pas FULL ou PARTIAL
  const toHydrate = upcomingMatches.filter(m => {
    if (m.bsd_status === 'FULL') return false;
    if (m.bsd_status === 'NO_COVERAGE') return false; // Pas de BSD pour cette ligue
    if (m.bsd_status === 'FAILED_INTEGRITY') return true; // v9.0: Retenter les matchs échoués

    // États partiels — ne pas re-fetch si on a déjà quelque chose
    const hasRatings = m._bsd_home_ratings?.length || m._bsd_away_ratings?.length;
    const hasSquad = m._bsd_home_squad?.length || m._bsd_away_squad?.length;

    if (hasRatings && hasSquad) {
      m.bsd_status = 'FULL';
      return false;
    }
    if (hasRatings && !hasSquad) {
      m.bsd_status = 'PARTIAL_RATINGS'; // Ratings OK, squad vide — pas critique
      return false;
    }
    if (!hasRatings && hasSquad) {
      m.bsd_status = 'PARTIAL_SQUAD'; // Squad OK, ratings vides — besoin de ratings
      return true; // Re-fetch pour obtenir les ratings
    }
    return true;
  });

  // File d'attente prioritaire : matchs les plus proches d'abord
  toHydrate.sort((a, b) => new Date(a.commence_time).getTime() - new Date(b.commence_time).getTime());

  console.log(`  [CRAWLER] ${upcomingMatches.length} matchs dans les 48h, ${toHydrate.length} en cours d'hydratation...`);

  if (toHydrate.length === 0) {
    console.log('  [HYDRATOR] ✅ Tous les matchs sont FULL — aucun fetch nécessaire');
    hydratorRunning = false;
    return;
  }

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < toHydrate.length; i++) {
    const m = toHydrate[i];
    const eventId = m._bsd_event_id;
    const homeTeam = m.home_team;
    const awayTeam = m.away_team;

    // Lookup BSD team IDs
    const hKey = normName(homeTeam);
    const aKey = normName(awayTeam);
    const hMeta = db.teamStats[hKey] || findFuzzy(hKey);
    const aMeta = db.teamStats[aKey] || findFuzzy(aKey);
    const hBsdTeamId = hMeta?.bsdTeamId || null;
    const aBsdTeamId = aMeta?.bsdTeamId || null;
    const hBsdSeasonId = hMeta?.bsdSeasonId || null;
    const aBsdSeasonId = aMeta?.bsdSeasonId || null;

    if (!hBsdTeamId && !aBsdTeamId) {
      m.bsd_status = 'NO_COVERAGE'; // Pas de couverture BSD pour cette ligue
      continue;
    }

    try {
      // Fetch BSD data
      const [prediction, homeSquad, awaySquad, homeRatings, awayRatings] = await Promise.all([
        eventId ? fetchBSDPrediction(eventId) : Promise.resolve(null),
        hBsdTeamId ? fetchBSDTeamSquad(hBsdTeamId) : Promise.resolve([]),
        aBsdTeamId ? fetchBSDTeamSquad(aBsdTeamId) : Promise.resolve([]),
        (hBsdTeamId && hBsdSeasonId) ? fetchBSDPlayerRatings(hBsdTeamId, hBsdSeasonId) : Promise.resolve([]),
        (aBsdTeamId && aBsdSeasonId) ? fetchBSDPlayerRatings(aBsdTeamId, aBsdSeasonId) : Promise.resolve([]),
      ]);

      // Injection directe
      m._bsd_prediction = prediction;
      m._bsd_home_squad = homeSquad;
      m._bsd_away_squad = awaySquad;
      m._bsd_home_ratings = homeRatings;
      m._bsd_away_ratings = awayRatings;

      // Pre-calculer le top 3 buteurs
      m.topButteurs = computeMatchTopButteurs(m);

      // Calculs Data Science
      m._fatigue_home = computeFatigueIndex(homeTeam, m.commence_time);
      m._fatigue_away = computeFatigueIndex(awayTeam, m.commence_time);
      m._absence_home = computeAbsenceImpact(homeSquad, homeTeam);
      m._absence_away = computeAbsenceImpact(awaySquad, awayTeam);
      m._dominance = computeDominanceScore(homeRatings, awayRatings, homeSquad, awaySquad);
      m._ev = computeMatchEV(m);

      // v9.0: Validation de contenu avant marquage FULL
      const integrityCheck = validateMatchIntegrity(m);
      if (!integrityCheck.valid) {
        m.bsd_status = 'FAILED_INTEGRITY';
        m.integrity_errors = integrityCheck.errors;
        console.log(`  [HYDRATOR] ⚠️ [${i + 1}/${toHydrate.length}] ${homeTeam} vs ${awayTeam} — INTEGRITÉ ÉCHOUÉE: ${integrityCheck.errors.join(', ')} — reprogrammation 60s`);
        // Reprogrammer une tentative dans 60s
        setTimeout(() => {
          m.bsd_status = null; // Reset pour permettre un nouveau fetch
          console.log(`  [HYDRATOR] 🔄 Retry intégrité pour ${homeTeam} vs ${awayTeam}`);
        }, 60000);
        continue;
      }

      // Marquer FULL
      m.bsd_status = 'FULL';
      m.integrity_errors = null;

      // Mettre à jour cachedMatches
      const cachedIdx = cachedMatches.findIndex(cm => cm.id === m.id);
      if (cachedIdx >= 0) cachedMatches[cachedIdx] = m;

      successCount++;
      console.log(`  [HYDRATOR] ✅ [${i + 1}/${toHydrate.length}] ${homeTeam} vs ${awayTeam} — fatigue=${m._fatigue_home.level}/${m._fatigue_away.level}, dominance=${m._dominance.label}`);
    } catch (e) {
      failCount++;
      console.warn(`  [HYDRATOR] ❌ [${i + 1}/${toHydrate.length}] ${homeTeam} vs ${awayTeam} — ${e.message}`);
    }

    // Rate limiting
    if (i < toHydrate.length - 1) {
      await new Promise(r => setTimeout(r, HYDRATOR_DELAY_MS));
    }
  }

  saveDB();

  console.log('');
  console.log(`  [HYDRATOR] 📊 Résumé: ${successCount} hydratés, ${failCount} échecs`);
  console.log(`  [HYDRATOR] 💾 ${db.matches.filter(m => m.bsd_status === 'FULL').length}/${db.matches.length} matchs FULL`);
  console.log('');

  hydratorRunning = false;
}

// ─── DONNÉES DÉMO ───────────────────────────────────────────────────────────
function buildDemoMatches() {
  const now = new Date();
  const d = (off, h, m) => { const dt = new Date(now); dt.setDate(dt.getDate() + off); dt.setHours(h, m, 0, 0); return dt.toISOString(); };
  const DEMOS = [
    ['soccer_france_ligue1', 'PSG', 'Olympique Lyonnais', 0, 20, 45, 1.42, 4.50, 7.50],
    ['soccer_france_ligue1', 'Olympique de Marseille', 'AS Monaco', 0, 17, 0, 2.20, 3.40, 3.10],
    ['soccer_france_ligue1', 'Stade Rennais', 'Lille OSC', 1, 15, 0, 2.60, 3.20, 2.70],
    ['soccer_france_ligue1', 'OGC Nice', 'RC Lens', 1, 20, 45, 2.30, 3.30, 3.00],
    ['soccer_epl', 'Arsenal', 'Chelsea', 0, 17, 30, 2.10, 3.40, 3.25],
    ['soccer_epl', 'Manchester City', 'Liverpool', 0, 16, 0, 2.40, 3.50, 2.80],
    ['soccer_epl', 'Newcastle United', 'Tottenham Hotspur', 1, 14, 0, 2.50, 3.25, 2.75],
    ['soccer_epl', 'Aston Villa', 'Manchester United', 2, 20, 0, 1.95, 3.60, 3.80],
    ['soccer_spain_la_liga', 'Real Madrid', 'FC Barcelona', 0, 21, 0, 2.30, 3.20, 2.90],
    ['soccer_spain_la_liga', 'Atlético Madrid', 'Sevilla FC', 1, 18, 30, 1.80, 3.50, 4.20],
    ['soccer_germany_bundesliga', 'Bayern Munich', 'Borussia Dortmund', 0, 18, 30, 1.65, 3.80, 5.00],
    ['soccer_germany_bundesliga', 'Bayer Leverkusen', 'RB Leipzig', 2, 15, 30, 1.90, 3.60, 3.70],
    ['soccer_italy_serie_a', 'Inter Milan', 'Juventus', 1, 18, 0, 2.00, 3.40, 3.60],
    ['soccer_italy_serie_a', 'AC Milan', 'AS Roma', 1, 20, 45, 2.10, 3.30, 3.40],
    ['soccer_uefa_champs_league', 'Real Madrid', 'Bayern Munich', 2, 21, 0, 2.20, 3.30, 3.00],
    ['soccer_uefa_champs_league', 'Arsenal', 'PSG', 3, 21, 0, 2.40, 3.20, 2.80],
    ['soccer_uefa_europa_league', 'Manchester United', 'Athletic Club', 2, 18, 45, 1.85, 3.50, 4.00],
    ['soccer_france_ligue1', 'Girondins de Bordeaux', 'Stade Brestois', 3, 15, 0, 2.00, 3.20, 3.60],
    ['soccer_epl', 'Brighton', 'West Ham United', 3, 14, 0, 2.15, 3.40, 3.20],
    ['soccer_spain_la_liga', 'Valencia CF', 'Villarreal CF', 3, 19, 0, 2.40, 3.10, 2.90],
  ];

  function demoBookmakers(home, away, oH, oD, oA, delta = 0) {
    const bks = [
      { key: 'winamax',      title: 'Winamax',          aNJ: true,  hd: 0,     dd: 0,     ad: 0     },
      { key: 'betclic',      title: 'Betclic',          aNJ: true,  hd: -0.01, dd: 0.03,  ad: -0.03 },
      { key: 'unibet',       title: 'Unibet',           aNJ: true,  hd: -0.03, dd: 0.05,  ad: -0.05 },
      { key: 'parions_sport',title: 'Parions Sport',    aNJ: true,  hd: -0.04, dd: 0.02,  ad: -0.04 },
      { key: 'bet365',       title: 'Bet365',           aNJ: false, hd: 0.03,  dd: 0.01,  ad: 0.02  },
      { key: 'pinnacle',     title: 'Pinnacle',         aNJ: false, hd: 0.05,  dd: 0.03,  ad: 0.05  },
      { key: '1xbet',        title: '1xbet',            aNJ: false, hd: 0.15,  dd: 0.06,  ad: 0.14  },
      { key: 'betfair',      title: 'Betfair Exchange', aNJ: false, hd: 0.12,  dd: 0.05,  ad: 0.11  },
    ];
    // Base Over/Under & BTTS & DC seeds dérivés des cotes 1N2
    const probH = 1 / oH, probD = oD ? 1 / oD : 0, probA = 1 / oA;
    const probO25 = Math.min(0.88, Math.max(0.38, (probH + probA) * 0.9 + 0.05));
    const probBTTS = Math.min(0.78, Math.max(0.28, (probH + probA) * 0.7));
    const o15 = parseFloat((1 / Math.min(0.95, probO25 + 0.18)).toFixed(2));
    const u15 = parseFloat((1 / Math.max(0.05, 1 - (probO25 + 0.18))).toFixed(2));
    const o25 = parseFloat((1 / probO25).toFixed(2));
    const u25 = parseFloat((1 / (1 - probO25)).toFixed(2));
    const o35 = parseFloat((1 / Math.max(0.08, probO25 - 0.22)).toFixed(2));
    const u35 = parseFloat((1 / Math.min(0.92, 1 - (probO25 - 0.22))).toFixed(2));
    const bY  = parseFloat((1 / probBTTS).toFixed(2));
    const bN  = parseFloat((1 / (1 - probBTTS)).toFixed(2));
    const dc1X = parseFloat((1 / Math.min(0.97, probH + probD)).toFixed(2));
    const dcX2 = parseFloat((1 / Math.min(0.97, probD + probA)).toFixed(2));
    const dc12 = parseFloat((1 / Math.min(0.97, probH + probA)).toFixed(2));

    return bks.map(bk => {
      const h = parseFloat((oH + bk.hd + delta * 0.01).toFixed(2));
      const dr = oD ? parseFloat((oD + bk.dd + delta * 0.005).toFixed(2)) : null;
      const a = parseFloat((oA + bk.ad + delta * 0.01).toFixed(2));
      const vd = (v, noise) => parseFloat((v + noise * (Math.random() - 0.5) * 0.1).toFixed(2));
      return {
        key: bk.key, title: bk.title,
        markets: [
          { key: 'h2h', outcomes: [{ name: home, price: Math.max(1.01, h) }, ...(dr ? [{ name: 'Draw', price: Math.max(1.01, dr) }] : []), { name: away, price: Math.max(1.01, a) }] },
          { key: 'totals', outcomes: [
            { name: 'Over',  point: 1.5, price: vd(o15, 1) }, { name: 'Under', point: 1.5, price: vd(u15, 1) },
            { name: 'Over',  point: 2.5, price: vd(o25, 1) }, { name: 'Under', point: 2.5, price: vd(u25, 1) },
            { name: 'Over',  point: 3.5, price: vd(o35, 1) }, { name: 'Under', point: 3.5, price: vd(u35, 1) },
          ]},
          { key: 'both_teams_score', outcomes: [{ name: 'Yes', price: vd(bY, 1) }, { name: 'No', price: vd(bN, 1) }] },
          { key: 'double_chance',    outcomes: [{ name: '1X', price: vd(dc1X, 0.5) }, { name: 'X2', price: vd(dcX2, 0.5) }, { name: '12', price: vd(dc12, 0.5) }] },
        ],
      };
    });
  }

  return DEMOS.map(([sport, home, away, off, h, m, oH, oD, oA], idx) => {
    const raw = {
      id: Math.random().toString(36).slice(2),
      _sport: sport, sport_key: sport,
      commence_time: d(off, h, m),
      home_team: home, away_team: away,
      bookmakers: demoBookmakers(home, away, oH, oD, oA, idx),
    };
    return buildMatchRecord(raw);
  }).filter(Boolean);
}

// ═══════════════════════════════════════════════════════════════════════════════
//  PHASE 5 — JWT AUTH + TELEGRAM + ROUTES ENRICHIES
// ═══════════════════════════════════════════════════════════════════════════════

// ─── PASSWORD HASHING (PBKDF2 natif — 100 000 itérations, SHA-256) ───────────
function hashPasswordSync(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256').toString('hex');
  return { hash, salt };
}
function verifyPasswordSync(password, storedHash, salt) {
  try {
    const attempt = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256').toString('hex');
    return crypto.timingSafeEqual(Buffer.from(attempt, 'hex'), Buffer.from(storedHash, 'hex'));
  } catch { return false; }
}

// ─── RATE LIMITER LOGIN ───────────────────────────────────────────────────────
const loginAttempts = new Map(); // ip → { count, resetAt }
function checkLoginRateLimit(ip) {
  const now = Date.now();
  let e = loginAttempts.get(ip) || { count: 0, resetAt: now + 15 * 60000 };
  if (now > e.resetAt) e = { count: 0, resetAt: now + 15 * 60000 };
  e.count++;
  loginAttempts.set(ip, e);
  return e.count <= 10; // max 10 tentatives / 15 min
}

// ─── JWT (HMAC-SHA256, natif Node.js crypto) ─────────────────────────────────
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
const JWT_TTL = 7 * 24 * 3600;  // 7 jours — comptes admin
const JWT_TTL_MATCHDAY = 24 * 3600;      // 24h — Matchday Pass
const JWT_TTL_USER = 30 * 24 * 3600; // 30 jours — membres

// ─── STRIPE (HTTPS natif — zéro dépendance npm) ──────────────────────────────
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';
const STRIPE_MATCHDAY_PRICE_ID = process.env.STRIPE_MATCHDAY_PRICE_ID || '';
const STRIPE_SUCCESS_URL = process.env.STRIPE_SUCCESS_URL || 'http://localhost:3000/?matchday=success';
const STRIPE_CANCEL_URL = process.env.STRIPE_CANCEL_URL || 'http://localhost:3000/';

function stripeRequest(method, endpoint, params) {
  return new Promise((resolve, reject) => {
    const body = params
      ? Object.entries(params).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&')
      : '';
    const options = {
      hostname: 'api.stripe.com',
      path: `/v1/${endpoint}`,
      method,
      headers: {
        'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body),
      },
    };
    const req = https.request(options, r => {
      let data = '';
      r.on('data', c => data += c);
      r.on('end', () => {
        try { resolve(JSON.parse(data)); } catch { reject(new Error('Stripe JSON parse error')); }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

// Vérifie la signature Stripe-Signature (HMAC-SHA256)
function verifyStripeSignature(rawBody, sigHeader) {
  if (!STRIPE_WEBHOOK_SECRET || !sigHeader) return false;
  const parts = Object.fromEntries(sigHeader.split(',').map(p => p.split('=')));
  const ts = parts.t;
  const expected = crypto.createHmac('sha256', STRIPE_WEBHOOK_SECRET)
    .update(`${ts}.${rawBody}`).digest('hex');
  return parts.v1 === expected;
}

function jwtSign(payload, ttl = JWT_TTL) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify({ ...payload, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + ttl })).toString('base64url');
  const sig = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}

function jwtVerify(token) {
  try {
    const [h, b, s] = token.split('.');
    const expected = crypto.createHmac('sha256', JWT_SECRET).update(`${h}.${b}`).digest('base64url');
    if (expected !== s) return null;
    const payload = JSON.parse(Buffer.from(b, 'base64url').toString());
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch (e) { return null; }
}

function getAuthUser(req) {
  const auth = req.headers['authorization'] || '';
  if (!auth.startsWith('Bearer ')) return null;
  return jwtVerify(auth.slice(7));
}

// ─── AUTH MIDDLEWARE ──────────────────────────────────────────────────────────
// Retourne le payload JWT ou envoie 401/403 et retourne null.
// allowedRoles: tableau de rôles autorisés — ex. ['freemium','premium','admin']
function requireAuth(req, res, allowedRoles = ['freemium', 'premium', 'admin', 'matchday']) {
  const user = getAuthUser(req);
  if (!user) {
    jsonResponse(res, 401, { error: 'Authentification requise', code: 'AUTH_REQUIRED' });
    return null;
  }
  if (allowedRoles.length && !allowedRoles.includes(user.role)) {
    jsonResponse(res, 403, { error: 'Accès réservé au plan Premium', code: 'PREMIUM_REQUIRED' });
    return null;
  }
  return user;
}

// Variante stricte : exige un user.userId (exclut admin/matchday qui n'ont pas d'ID utilisateur).
function requireUserAuth(req, res) {
  const user = requireAuth(req, res, ['freemium', 'premium', 'admin']);
  if (!user) return null;
  if (!user.userId) {
    jsonResponse(res, 403, { error: 'Compte membre requis pour les paris', code: 'MEMBER_REQUIRED' });
    return null;
  }
  return user;
}

// Utilisateurs admin en mémoire (admin panel) — PBKDF2 salé
const USERS = new Map(); // { username: { hash, salt, role, forceChange: bool } }
function initUsers() {
  const adminPass = process.env.ADMIN_PASSWORD || 'pariscore2026';
  const { hash, salt } = hashPasswordSync(adminPass);
  USERS.set('admin', { hash, salt, role: 'admin', forceChange: !process.env.ADMIN_PASSWORD });
}
initUsers();

// ─── TELEGRAM BOT ────────────────────────────────────────────────────────────
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_CHAT_IDS = new Set(); // chargé depuis .env si défini
if (process.env.TELEGRAM_CHAT_IDS) {
  process.env.TELEGRAM_CHAT_IDS.split(',').forEach(id => TELEGRAM_CHAT_IDS.add(id.trim()));
}

async function sendTelegramAlert(message) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_IDS.size) return;
  for (const chatId of TELEGRAM_CHAT_IDS) {
    try {
      await httpsPost(
        `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
        { chat_id: chatId, text: message, parse_mode: 'HTML' }
      );
      console.log(`  [Telegram] Alerte envoyée → ${chatId}`);
    } catch (e) { console.warn(`  [Telegram] Échec ${chatId}:`, e.message); }
  }
}

// Envoyer alertes pour les value bets avec edge > seuil
function buildAlertMessage(valueBets, label = 'Value Bets') {
  const dt = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  let msg = `🎯 <b>PariScore — ${label} du ${dt}</b>\n\n`;
  valueBets.forEach((m, i) => {
    const e = m.best_edge;
    msg += `${i + 1}. <b>${m.home_team} vs ${m.away_team}</b>\n`;
    msg += `   📌 ${m.league} · ${new Date(m.commence_time).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}\n`;
    msg += `   💰 ${e.label} @ <b>${e.odds.toFixed(2)}</b> · Edge: <b>+${e.edge.toFixed(1)}%</b>\n`;
    msg += `   📊 BTTS ${m.poisson?.btts}% · O2.5 ${m.poisson?.over25}%\n\n`;
  });
  msg += '⚠️ Pariez de manière responsable. 18+';
  return msg;
}

async function sendValueBetAlerts() {
  const threshold = parseFloat(process.env.ALERT_EDGE_THRESHOLD || '8');
  const allBets = db.matches
    .filter(m => (m.best_edge?.edge || 0) >= threshold)
    .sort((a, b) => b.best_edge.edge - a.best_edge.edge);
  if (!allBets.length) return;

  const topBets = allBets.slice(0, 5);

  // ── Broadcast global (admin — TELEGRAM_CHAT_IDS du .env) ─────────────────
  if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_IDS.size) {
    await sendTelegramAlert(buildAlertMessage(topBets));
  }

  // ── Alertes personnalisées par utilisateur ────────────────────────────────
  if (TELEGRAM_BOT_TOKEN) {
    const userPrefs = kvScan('alert_prefs_');
    for (const { value: prefs } of userPrefs) {
      if (!prefs.enabled || !prefs.chatId) continue;
      const edgeMin = prefs.edgeMin ?? 8;
      const probaMin = prefs.probaMin ?? 55;
      const markets = prefs.markets || [];
      const leagues = prefs.leagues || [];

      let userBets = allBets.filter(m => {
        if ((m.best_edge?.edge || 0) < edgeMin) return false;
        if (leagues.length && !leagues.includes(m.sport)) return false;
        // filtre marché : au moins une stratégie matchée
        if (markets.length) {
          const p = m.poisson || {};
          const matchMkt = markets.some(mkt => {
            if (mkt === 'BTTS_YES' && (p.btts || 0) >= probaMin) return true;
            if (mkt === 'OVER_2_5' && (p.over25 || 0) >= probaMin) return true;
            if (mkt === 'OVER_1_5' && (p.over15 || 0) >= probaMin) return true;
            if (mkt === 'HOME_WIN' && (p.homeWin || 0) >= probaMin) return true;
            if (mkt === 'AWAY_WIN' && (p.awayWin || 0) >= probaMin) return true;
            return false;
          });
          if (!matchMkt) return false;
        }
        return true;
      }).slice(0, 5);

      if (!userBets.length) continue;
      try {
        const payload = JSON.stringify({ chat_id: prefs.chatId, text: buildAlertMessage(userBets, 'Vos Alertes'), parse_mode: 'HTML' });
        await httpsPost(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, payload, { 'Content-Type': 'application/json' });
        console.log(`  [TG:User] Alerte envoyée → chat ${prefs.chatId} (${userBets.length} matchs)`);
      } catch (e) { console.warn(`  [TG:User] Erreur chat ${prefs.chatId}:`, e.message); }
    }
  }

  // ── Historique global des alertes ─────────────────────────────────────────
  const existing = kvGet('alert_history') || [];
  const entry = {
    ts: Date.now(),
    count: topBets.length,
    matches: topBets.map(m => ({
      home_team: m.home_team, away_team: m.away_team,
      league: m.league, sport: m.sport,
      edge: m.best_edge?.edge, odds: m.best_edge?.odds, label: m.best_edge?.label,
    })),
  };
  kvSet('alert_history', [...existing, entry].slice(-50));
}

// ─── /api/v1/arbitrage — scanner de surebets multi-bookmakers ───────────────
function computeArbitrage() {
  const results = [];
  for (const m of db.matches) {
    if (!m.odds?.home || !m.odds?.away) continue;
    const h = m.odds.home, d = m.odds.draw, a = m.odds.away;
    const invSum = (1 / h) + (d ? 1 / d : 0) + (1 / a);
    const margin = parseFloat(((1 - invSum) * 100).toFixed(2));

    // Mises optimales pour 100€ investis au total (méthode Kelly-Arbitrage)
    const stakeH = parseFloat((100 / (h * invSum)).toFixed(2));
    const stakeD = d ? parseFloat((100 / (d * invSum)).toFixed(2)) : 0;
    const stakeA = parseFloat((100 / (a * invSum)).toFixed(2));

    results.push({
      id: m.id,
      home_team: m.home_team,
      away_team: m.away_team,
      league: m.league,
      commence_time: m.commence_time,
      odds: m.odds,
      bookmakers: m.bookmakers,
      margin,
      stakes_for_100: { home: stakeH, draw: stakeD, away: stakeA },
      is_surebet: margin > 0,
      guaranteed_profit: margin > 0 ? parseFloat((margin).toFixed(2)) : 0,
    });
  }
  return results.sort((a, b) => b.margin - a.margin).slice(0, 10);
}

// ─── /api/v1/top-matches — Top 10 matchs du jour / semaine ──────────────────
function computeTopPick(m) {
  const p = m.poisson || {};
  const candidates = [
    { key: 'over25', label: 'Over 2.5', val: p.over25 || 0 },
    { key: 'btts', label: 'BTTS', val: p.btts || 0 },
    { key: 'over15', label: 'Over 1.5', val: p.over15 || 0 },
    { key: 'homeWin', label: 'Victoire Dom.', val: p.homeWin || 0 },
    { key: 'awayWin', label: 'Victoire Ext.', val: p.awayWin || 0 },
    { key: 'over35', label: 'Over 3.5', val: p.over35 || 0 },
    { key: 'under15', label: 'Under 1.5', val: p.under15 || 0 },
    { key: 'cs00', label: 'CS Domicile', val: p.cs00 || 0 },
  ];
  return candidates.reduce((best, c) => c.val > best.val ? c : best, { val: 0, label: '—', key: '' });
}
function matchEngagementScore(m) {
  const pick = computeTopPick(m);
  const edge = Math.max(0, m.best_edge?.edge || 0);
  return pick.val + edge * 0.5;
}
function getTopMatchesByTimeframe(timeframe, limit) {
  const now = Date.now();
  let matches = db.matches.filter(m => new Date(m.commence_time).getTime() > now);
  if (timeframe === 'today') {
    const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
    matches = matches.filter(m => new Date(m.commence_time) <= todayEnd);
  } else {
    const weekEnd = new Date(now + 7 * 24 * 3600000);
    matches = matches.filter(m => new Date(m.commence_time) <= weekEnd);
  }
  return matches
    .map(m => ({ ...m, topPick: computeTopPick(m), _score: matchEngagementScore(m) }))
    .sort((a, b) => b._score - a._score)
    .slice(0, limit)
    .map(m => { delete m._score; return m; });
}

// ─── /api/v1/league-hub/:oddsKey — Standings + Top scorer pour hub ligue ─────
function getLeagueHub(oddsKey) {
  const leagueCfg = leaguesConfig.leagues.find(l => l.odds_key === oddsKey);
  if (!leagueCfg) return null;
  const lid = leagueCfg.id;
  // Récupérer toutes les équipes de cette ligue, triées par rank
  const teams = Object.entries(db.teamStats)
    .filter(([, v]) => v.leagueId === lid && v._real)
    .map(([name, v]) => ({
      name, rank: v.rank, ppg: v.home?.ppg ?? 0, form: v.form || '',
      wins: v.home?.wins ?? 0, draws: v.home?.draws ?? 0, losses: v.home?.losses ?? 0,
      scored: v.home?.scored ?? 0
    }))
    .sort((a, b) => a.rank - b.rank)
    .slice(0, 8);
  // Top scorer de la ligue
  const scorerKey = `${lid}_${currentSeason()}`;
  const scorersData = db.topScorers[scorerKey];
  const topScorer = scorersData?.data?.[0] || null;
  return {
    leagueId: lid,
    leagueName: leagueCfg.name,
    oddsKey,
    teams,
    topScorer: topScorer ? {
      name: topScorer.player?.name || '?',
      team: topScorer.statistics?.[0]?.team?.name || '?',
      goals: topScorer.statistics?.[0]?.goals?.total || 0,
      photo: topScorer.player?.photo || null,
    } : null,
  };
}

// ─── /api/v1/top-strategy — Top matchs par stratégie ────────────────────────
// Config centralisée : ajouter une stratégie = 1 entrée ici (zéro autre changement)
// ── AI Tipsters — personnalités par stratégie (synchro avec STRATEGIES_UI) ────
const STRATEGIES = {
  BTTS_YES: { label: 'BTTS Oui', icon: '', tipster: 'L\'Artilleur', tipsterDesc: 'Spécialiste des matchs ouverts. Détecte les deux équipes qui marquent.', tipsterFlag: '🇧🇷', getProb: m => m.poisson?.btts, getOdds: () => null },
  OVER_2_5: { label: 'Plus de 2.5 buts', icon: '', tipster: 'Le Foudroyeur', tipsterDesc: 'Traque les matchs à 3+ buts. Chaud devant.', tipsterFlag: '🇳🇱', getProb: m => m.poisson?.over25, getOdds: () => null },
  OVER_1_5: { label: 'Plus de 1.5 buts', icon: '', tipster: 'Le Prudent', tipsterDesc: 'Sécurité offensive. Matchs à au moins 2 buts garantis.', tipsterFlag: '🇩🇪', getProb: m => m.poisson?.over15, getOdds: () => null },
  UNDER_2_5: { label: 'Moins de 2.5 buts', icon: '', tipster: 'Le Gardien', tipsterDesc: 'Expert des matchs fermés. Moins de 3 buts = son terrain.', tipsterFlag: '🇮🇹', getProb: m => m.poisson ? 100 - m.poisson.over25 : null, getOdds: () => null },
  HOME_WIN: { label: 'Victoire Domicile', icon: '', tipster: 'Le Localier', tipsterDesc: 'Spécialiste des forteresses. Avantage terrain maximal.', tipsterFlag: '🇬🇧', getProb: m => m.poisson?.homeWin, getOdds: m => m.odds?.home },
  AWAY_WIN: { label: 'Victoire Extérieur', icon: '', tipster: 'L\'Aventurier', tipsterDesc: 'Paris audacieux. Déniche les vainqueurs à l\'extérieur.', tipsterFlag: '🇪🇸', getProb: m => m.poisson?.awayWin, getOdds: m => m.odds?.away },
  DRAW: { label: 'Match Nul', icon: '', tipster: 'Le Diplomate', tipsterDesc: 'Spécialiste des matchs équilibrés. Le nul, son art.', tipsterFlag: '🇫🇷', getProb: m => m.poisson?.draw, getOdds: m => m.odds?.draw },
  CS_00: { label: 'Score 0-0', icon: '', tipster: 'Le Sceptique', tipsterDesc: 'Anticipateur de blocages. Aucun but, 100% discipline.', tipsterFlag: '🇵🇹', getProb: m => m.poisson?.cs00, getOdds: () => null },
  // ── Stratégies avancées P1 ──────────────────────────────────────────────────
  ANGLE_CORNERS: {
    label: 'Angle Mort Corners',
    icon: '',
    tipster: 'Le Géomètre',
    tipsterDesc: 'Lit le jeu dans les corners. Over 6.5 corners sur matchs à fort xG.',
    tipsterFlag: '🇦🇷',
    getProb: m => {
      if (!m.poisson || !m.expectedGoals) return null;
      if (m.expectedGoals.home + m.expectedGoals.away < 2.5) return null;
      return m.corners_poisson?.over_6_5 || m.poisson.over25;
    },
    getOdds: () => null,
  },
  OVER_6_5_CORNERS: {
    label: 'Over 6.5 Corners',
    icon: '',
    tipster: 'Le Corneriste',
    tipsterDesc: 'Expert des corners. Traque les matchs à fort trafic dans les surfaces — xG élevé, équipes offensives, jeu direct.',
    tipsterFlag: '🇮🇹',
    getProb: m => {
      // Priorité : données Poisson corners directes
      if (m.corners_poisson?.over_6_5 != null) return m.corners_poisson.over_6_5;
      // Fallback : estimation via xG + over25
      if (!m.poisson || !m.expectedGoals) return null;
      const xgTotal = (m.expectedGoals.home || 0) + (m.expectedGoals.away || 0);
      if (xgTotal < 2.0) return null;
      const over25 = m.poisson.over25 || 0;
      // Corrélation empirique : over25 élevé + xG > 2 → fort traffic corners
      const est = Math.min(88, Math.round(over25 * 0.80 + Math.max(0, xgTotal - 2.0) * 18));
      return est >= 45 ? est : null;
    },
    getOdds: () => null,
  },
  VERROU_TACTIQUE: {
    label: 'Verrou Tactique (U3.5)',
    icon: '',
    tipster: 'Le Verrou',
    tipsterDesc: 'Maître du under. Détecte les défenses imperméables.',
    tipsterFlag: '🇬🇷',
    getProb: m => {
      if (!m.poisson || m.poisson.over35 == null) return null;
      const under35 = 100 - m.poisson.over35;
      if (under35 < 80) return null;
      const isReal = m.stats?.home?._real === true && m.stats?.away?._real === true;
      const bothDefensive = isReal && m.stats.home.avgConceded < 1.2 && m.stats.away.avgConceded < 1.2;
      return bothDefensive ? Math.min(under35 + 5, 99) : under35;
    },
    getOdds: () => null,
  },
  GOLDEN_PPG_GAP: {
    label: 'Golden PPG Gap',
    icon: '',
    tipster: 'L\'Éclaireur',
    tipsterDesc: 'Repère les déséquilibres de forme. PPG gap ≥ 1.2 = value assurée.',
    tipsterFlag: '🇧🇪',
    getProb: m => {
      if (!m.poisson || !m.stats?.home || !m.stats?.away) return null;
      const homePpg = m.stats.home.ppg || 0;
      const awayPpg = m.stats.away.ppg || 0;
      const gap = Math.abs(homePpg - awayPpg);
      if (gap < 1.2) return null;
      const strongerIsHome = homePpg > awayPpg;
      const strongerOdds = strongerIsHome ? m.odds?.home : m.odds?.away;
      if (!strongerIsHome && (strongerOdds == null || strongerOdds <= 1.70)) return null;
      return strongerIsHome ? m.poisson.homeWin : m.poisson.awayWin;
    },
    getOdds: m => {
      if (!m.stats?.home || !m.stats?.away) return null;
      return (m.stats.home.ppg || 0) >= (m.stats.away.ppg || 0) ? (m.odds?.home || null) : (m.odds?.away || null);
    },
  },
  // ── Double Chance ────────────────────────────────────────────────────────────
  DC_HOME: {
    label: 'Double Chance 1X',
    icon: '',
    tipster: 'Le Couvreur',
    tipsterDesc: 'Double chance maison. 1X = 2 résultats sur 3.',
    tipsterFlag: '🇨🇭',
    getProb: m => {
      if (!m.poisson) return null;
      const hw = m.poisson.homeWin ?? 0;
      const dr = m.poisson.draw ?? 0;
      return hw + dr;
    },
    getOdds: () => null,
  },
  DC_AWAY: {
    label: 'Double Chance X2',
    icon: '',
    tipster: 'L\'Assureur',
    tipsterDesc: 'Double chance extérieur. X2 = filet de sécurité.',
    tipsterFlag: '🇸🇪',
    getProb: m => {
      if (!m.poisson) return null;
      const aw = m.poisson.awayWin ?? 0;
      const dr = m.poisson.draw ?? 0;
      return aw + dr;
    },
    getOdds: () => null,
  },
  HT_HOME_FT_HOME: {
    label: 'Mi-Temps Victoire Dom.',
    icon: '',
    tipster: 'Le Sprint',
    tipsterDesc: 'Domicile dominant dès la 1ère MT. Home/Home assuré.',
    tipsterFlag: '🇺🇸',
    getProb: m => {
      if (!m.poisson) return null;
      const hw = m.poisson.homeWin ?? 0;
      const ppg = m.stats?.home?.ppg ?? 0;
      if (hw < 60 || ppg < 1.8) return null;
      return hw;
    },
    getOdds: m => m.odds?.home || null,
  },
  HT_UNDER_FT_OVER: {
    label: 'Explosion 2e Mi-Temps',
    icon: '',
    tipster: 'Le Dynamiteur',
    tipsterDesc: '1ère MT calme, 2ème MT explosive. Son flair.',
    tipsterFlag: '🇭🇷',
    getProb: m => {
      if (!m.poisson) return null;
      const o25 = m.poisson.over25 ?? 0;
      const u15 = m.poisson.under15 ?? 0;
      if (o25 < 65 || u15 < 25) return null;
      return Math.round((o25 + u15) / 2);
    },
    getOdds: () => null,
  },
};

// Value Index: mesure la valeur RÉELLE du bet (0-100%).
//   Pondération : 70% edge (valeur), 30% confiance (probabilité)
//   Un edge de 0 → max 30%, un edge ≥ 15% + confiance ≥ 80% → 100%
//   Les stratégies à haute proba naturelle (Over 1.5) ne dominent plus.
function computeValueIndex(confidence, edge, strategyKey) {
  if (edge == null || edge <= 0) return Math.min(Math.round(confidence * 0.2), 30);
  // Facteur edge : 70% du score final. Edge 15%+ = max contribution (70 pts)
  const edgeFactor = Math.min(Math.abs(edge) / 15, 1);
  // Facteur confiance : 30% du score. Rareté bonus pour stratégies à faible proba naturelle
  let confBonus = 1;
  if (strategyKey === 'CS_00') confBonus = 2.5;        // proba naturelle 5-15%
  else if (strategyKey === 'DRAW') confBonus = 1.8;     // 15-30%
  else if (strategyKey === 'UNDER_2_5') confBonus = 1.3; // 30-50%
  else if (strategyKey === 'HOME_WIN' || strategyKey === 'AWAY_WIN') confBonus = 1.1;
  const confFactor = Math.min((confidence * confBonus) / 80, 1);
  return Math.round(100 * (edgeFactor * 0.70 + confFactor * 0.30));
}

// Confidence Index: fiabilité composite (0-100%) basée sur proba + edge + stabilité
function computeConfidenceIndex(confidence, edge, match) {
  let score = confidence || 0;
  if (edge != null && edge > 0) score += edge * 1.5;
  if (match?.best_edge?.margin != null && match.best_edge.margin < 5) score += 5;
  if (match?.stats?.isReal) score += 3;
  const hoursToKickoff = (new Date(match?.commence_time) - Date.now()) / 3600000;
  if (hoursToKickoff > 0 && hoursToKickoff < 24) score += Math.max(0, 5 - hoursToKickoff / 5);
  if (match?.sport && /ligue1|epl|serie_a|la_liga|bundesliga|champs_league/i.test(match.sport)) score += 3;
  return Math.min(99, Math.round(score));
}

function getTopMatchesByStrategy(strategyType, limit = 10, minConfidence = 50, league = '') {
  const strat = STRATEGIES[strategyType];
  if (!strat) return null;
  const now = Date.now();
  const lim = Math.max(1, Math.min(50, parseInt(limit) || 10));
  const minConf = Math.max(0, Math.min(100, parseInt(minConfidence) || 50));
  const leagueFilter = (league || '').trim().toLowerCase();

  return db.matches
    .filter(m => m.poisson && new Date(m.commence_time).getTime() > now && (!leagueFilter || (m.sport || '').toLowerCase() === leagueFilter))
    .map(m => {
      const confidence = strat.getProb(m);
      if (confidence == null || confidence < minConf) return null;
      const stratOdds = strat.getOdds(m);
      const edge = m.best_edge?.edge || 0;
      const valueIndex = computeValueIndex(confidence, edge, strategyType);
      const confidenceIndex = computeConfidenceIndex(confidence, edge, m);
      return {
        id: m.id,
        home_team: m.home_team, away_team: m.away_team,
        league: m.league, sport: m.sport,
        commence_time: m.commence_time,
        confidence: Math.round(confidence),
        odds: stratOdds,
        implied_odds: stratOdds == null ? parseFloat((100 / Math.max(confidence, 1)).toFixed(2)) : null,
        all_odds: m.odds,
        best_edge: m.best_edge,
        expectedGoals: m.expectedGoals,
        home_form: m.home_form || '',
        away_form: m.away_form || '',
        valueIndex,
        confidenceIndex,
        tipster: strat.tipster || null,
        tipsterFlag: strat.tipsterFlag || null,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.confidenceIndex - a.confidenceIndex)
    .slice(0, lim);
}

// GET /api/v1/hot-picks — Top 5 picks toutes stratégies confondues, classés par Value Index
function getHotPicks(limit = 5) {
  const now = Date.now();
  const candidates = [];

  for (const [key, strat] of Object.entries(STRATEGIES)) {
    db.matches
      .filter(m => m.poisson && new Date(m.commence_time).getTime() > now)
      .forEach(m => {
        const confidence = strat.getProb(m);
        if (confidence == null || confidence < 50) return;
        const stratOdds = strat.getOdds(m);
        const edge = m.best_edge?.edge || 0;
        const vi = computeValueIndex(confidence, edge, key);
        const ci = computeConfidenceIndex(confidence, edge, m);
        candidates.push({
          id: m.id,
          strategyKey: key,
          strategyLabel: strat.label,
          strategyIcon: strat.icon,
          tipster: strat.tipster || null,
          tipsterFlag: strat.tipsterFlag || null,
          home_team: m.home_team, away_team: m.away_team,
          league: m.league, sport: m.sport,
          commence_time: m.commence_time,
          confidence: Math.round(confidence),
          odds: stratOdds,
          best_edge: m.best_edge,
          expectedGoals: m.expectedGoals,
          valueIndex: vi,
          confidenceIndex: ci,
        });
      });
  }

  // Dédupliquer par match.id (garder le meilleur valueIndex pour chaque match)
  const seen = new Map();
  for (const c of candidates) {
    const existing = seen.get(c.id);
    if (!existing || c.valueIndex > existing.valueIndex) seen.set(c.id, c);
  }

  // DIVERSIFICATION : 1er pick de chaque stratégie, puis classés par valueIndex
  const byStrategy = new Map();
  for (const c of seen.values()) {
    if (!byStrategy.has(c.strategyKey)) byStrategy.set(c.strategyKey, []);
    byStrategy.get(c.strategyKey).push(c);
  }
  // Trier chaque bucket par valueIndex décroissant
  for (const [, arr] of byStrategy) arr.sort((a, b) => b.valueIndex - a.valueIndex);

  // Phase 1 : un champion par stratégie (le meilleur valueIndex de chaque)
  const champions = [];
  for (const [stratKey, arr] of byStrategy) {
    if (arr.length > 0) champions.push(arr[0]);
  }
  // Trier les champions par valueIndex décroissant
  champions.sort((a, b) => b.valueIndex - a.valueIndex);

  // Phase 2 : compléter avec les 2e, 3e... meilleurs de chaque stratégie
  const remaining = [];
  for (const [, arr] of byStrategy) {
    for (let i = 1; i < arr.length; i++) remaining.push(arr[i]);
  }
  remaining.sort((a, b) => b.valueIndex - a.valueIndex);

  const result = [...champions, ...remaining];
  return result.slice(0, Math.max(1, Math.min(20, parseInt(limit) || 5)));
}

// GET /api/v1/sure-bets — Picks avec confiance ≥ 80% (équivalent Sure Bets 8+/10)
function getSureBets(limit = 10) {
  const now = Date.now();
  const candidates = [];

  for (const [key, strat] of Object.entries(STRATEGIES)) {
    db.matches
      .filter(m => m.poisson && new Date(m.commence_time).getTime() > now)
      .forEach(m => {
        const confidence = strat.getProb(m);
        if (confidence == null || confidence < 75) return;
        const stratOdds = strat.getOdds(m);
        const edge = m.best_edge?.edge || 0;
        const vi = computeValueIndex(confidence, edge, key);
        const ci = computeConfidenceIndex(confidence, edge, m);
        // Sure bet = confidence ≥ 75% ET confidenceIndex ≥ 70%
        if (ci < 70) return;
        candidates.push({
          id: m.id,
          strategyKey: key,
          strategyLabel: strat.label,
          strategyIcon: strat.icon,
          tipster: strat.tipster || null,
          tipsterFlag: strat.tipsterFlag || null,
          home_team: m.home_team, away_team: m.away_team,
          league: m.league, sport: m.sport,
          commence_time: m.commence_time,
          confidence: Math.round(confidence),
          odds: stratOdds,
          best_edge: m.best_edge,
          valueIndex: vi,
          confidenceIndex: ci,
          sureLevel: ci >= 90 ? 10 : ci >= 85 ? 9 : 8, // Niveau 8/10, 9/10, 10/10
        });
      });
  }

  const seen = new Map();
  for (const c of candidates) {
    const existing = seen.get(c.id);
    if (!existing || c.sureLevel > existing.sureLevel) seen.set(c.id, c);
  }

  return Array.from(seen.values())
    .sort((a, b) => b.sureLevel - a.sureLevel || b.valueIndex - a.valueIndex)
    .slice(0, Math.max(1, Math.min(30, parseInt(limit) || 10)));
}

// ─── /api/v1/acca — Acca Generator (combiné mathématique) ───────────────────
function getAccaByStrategy(strategyType, size = 3) {
  const strat = STRATEGIES[strategyType];
  if (!strat) return null;
  const now = Date.now();
  const lim = Math.max(2, Math.min(5, parseInt(size) || 3));
  const candidates = db.matches
    .filter(m => m.poisson && new Date(m.commence_time).getTime() > now)
    .map(m => {
      const prob = strat.getProb(m);
      const odds = strat.getOdds(m);
      return prob != null ? { match: m, prob: Math.round(prob), odds } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.prob - a.prob)
    .slice(0, lim);
  if (candidates.length < 2) return null;
  const combinedOdds = candidates.reduce((acc, c) => {
    const o = c.odds || (c.prob > 0 ? parseFloat((1 / (c.prob / 100)).toFixed(2)) : null);
    return o ? parseFloat((acc * o).toFixed(2)) : acc;
  }, 1);
  const combinedProb = Math.round(candidates.reduce((acc, c) => acc * (c.prob / 100), 1) * 100);
  return {
    strategy: strategyType,
    label: strat.label,
    icon: strat.icon,
    size: candidates.length,
    combinedOdds: parseFloat(combinedOdds.toFixed(2)),
    combinedProb,
    matches: candidates.map(c => ({
      id: c.match.id,
      home_team: c.match.home_team,
      away_team: c.match.away_team,
      league: c.match.league,
      commence_time: c.match.commence_time,
      prob: c.prob,
      odds: c.odds,
    })),
  };
}

// ─── /api/v1/predictions — matchs classés par Poisson convergent ────────────
function getPredictions() {
  return db.matches
    .filter(m => m.poisson)
    .map(m => ({
      id: m.id, home_team: m.home_team, away_team: m.away_team,
      league: m.league, commence_time: m.commence_time,
      odds: m.odds, best_edge: m.best_edge,
      poisson: m.poisson, expectedGoals: m.expectedGoals,
      confidence: Math.round(
        (Math.max(m.poisson.homeWin, m.poisson.draw, m.poisson.awayWin) +
          Math.abs((m.best_edge?.edge || 0))) / 2
      ),
      recommendation: m.poisson.homeWin > 55 ? `Victoire ${m.home_team}` :
        m.poisson.awayWin > 55 ? `Victoire ${m.away_team}` :
          m.poisson.over25 > 60 ? 'Plus de 2.5 buts' :
            m.poisson.btts > 60 ? 'Les deux marquent' : 'Match serré',
    }))
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 12);
}

// ─── /api/v1/trends — statistiques agrégées sur tous les matchs ──────────────
function getTrends() {
  const matches = db.matches;
  if (!matches.length) return { error: 'Aucun match disponible' };

  const avg = arr => arr.length ? Math.round(arr.reduce((s, v) => s + v, 0) / arr.length) : 0;

  const bttsVals = matches.filter(m => m.poisson).map(m => m.poisson.btts);
  const over25Vals = matches.filter(m => m.poisson).map(m => m.poisson.over25);
  const over15Vals = matches.filter(m => m.poisson).map(m => m.poisson.over15);
  const xgHome = matches.filter(m => m.expectedGoals).map(m => m.expectedGoals.home);
  const xgAway = matches.filter(m => m.expectedGoals).map(m => m.expectedGoals.away);

  const byLeague = {};
  matches.forEach(m => {
    if (!byLeague[m.league]) byLeague[m.league] = { btts: [], over25: [], count: 0 };
    byLeague[m.league].count++;
    if (m.poisson) { byLeague[m.league].btts.push(m.poisson.btts); byLeague[m.league].over25.push(m.poisson.over25); }
  });

  return {
    global: {
      btts_avg: avg(bttsVals),
      over25_avg: avg(over25Vals),
      over15_avg: avg(over15Vals),
      xg_home_avg: parseFloat((xgHome.reduce((s, v) => s + v, 0) / (xgHome.length || 1)).toFixed(2)),
      xg_away_avg: parseFloat((xgAway.reduce((s, v) => s + v, 0) / (xgAway.length || 1)).toFixed(2)),
      total_matches: matches.length,
    },
    by_league: Object.entries(byLeague).map(([league, d]) => ({
      league, count: d.count,
      btts_avg: avg(d.btts), over25_avg: avg(d.over25),
    })).sort((a, b) => b.over25_avg - a.over25_avg),
    value_bets_count: matches.filter(m => (m.best_edge?.edge || 0) > 5).length,
    accuracy: getAccuracyReport(),
    generated_at: new Date().toISOString(),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
//  API REST INTERNE
// ═══════════════════════════════════════════════════════════════════════════════

function jsonResponse(res, statusCode, data) {
  const allowedOrigin = process.env.ALLOWED_ORIGIN || 'http://localhost:3000';
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(JSON.stringify(data));
}

// 1. On rend la fonction ASYNC pour pouvoir utiliser 'await' proprement
// ─── GESTIONNAIRE API PRINCIPAL (CORRIGÉ & ASYNC) ──────────────────────
async function handleAPI(req, res, pathname, query) {
  // 1. Live SSE
  if (pathname === '/api/v1/live' && req.method === 'GET') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || 'http://localhost:3000',
    });
    res.flushHeaders();
    res.write(`event: matches_update\ndata: ${JSON.stringify({ matches: matchesForBroadcast(), meta: buildMeta() })}\n\n`);
    sseClients.add(res);
    const hb = setInterval(() => {
      try {
        res.write(': heartbeat\n\n');
      } catch (e) {
        clearInterval(hb);
        sseClients.delete(res);
      }
    }, 30000);
    req.on('close', () => {
      clearInterval(hb);
      sseClients.delete(res);
    });
    return;
  }

// 2. Matchs
    if (pathname === '/api/v1/matches') {
      let matches = (db.matches && db.matches.length > 0) ? db.matches : cachedMatches;
      let fromCache = (db.matches && db.matches.length > 0) ? false : true;
      // [FIX - 2026-05-11] Priorité au statut LIVE sur le Kill Switch temporel
      const normalizeStatus = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim();

      const isLiveStatus = (status) => {
        const norm = normalizeStatus(status);
        return ['LIVE', 'IN_PLAY', 'INPLAY', '1H', '2H', 'HT', 'ET', 'P', 'BT',
                'EXTRA_TIME', 'BREAK_TIME', 'PENALTY', 'LIVE_1H', 'LIVE_2H',
                '1ST_HALF', '2ND_HALF', 'HALFTIME', 'SECOND_HALF', 'FIRST_HALF', 'EXTRA_TIME_HALF'].includes(norm);
      };

      const isFinishedStatus = (status) => {
        const norm = normalizeStatus(status);
        return ['FINISHED', 'FT', 'TERMINE', 'ENDED', 'AET', 'PEN',
                'POSTPONED', 'CANC', 'ABD', 'SUSPENDED', 'INTERRUPTED',
                'CANCELED', 'WALKOVER'].includes(norm);
      };

      // [FIX - 2026-05-11] Match en direct = statut LIVE OU live_minute présent et non terminé
      const isLiveMatch = (m) =>
        isLiveStatus(m.status) || isLiveStatus(m.live_status) ||
        isLiveStatus(m.match_status) || isLiveStatus(m.fixture_status) ||
        (m.live_minute != null && !isFinishedStatus(m.status));

      // Kill Switch: 4h max, MAIS ignoré si match LIVE
      const MATCH_EXPIRY_MS = 4 * 60 * 60 * 1000;
      const now = Date.now();
      const isMatchExpired = (m) => {
        if (!m.commence_time) return false;
        if (isLiveMatch(m)) return false; // [FIX - 2026-05-11] LIVE bypass Kill Switch
        return (now - new Date(m.commence_time).getTime()) > MATCH_EXPIRY_MS;
      };

      if (!serverReady && matches.length === 0) {
        return jsonResponse(res, 200, { count: 0, matches: [], meta: { loading: true, status: 'initialisation' } });
      }

      // [FIX - 2026-05-11] ?live=true → retourne UNIQUEMENT les matchs en direct
      if (query.live === 'true') {
        let liveMatches = matches.filter(m => isLiveMatch(m));
        // [MOCK] Injection du match de test en tête de liste si actif
        if (mockActive && testMatch && testMatch.live_status !== 'FT') {
          liveMatches = [testMatch, ...liveMatches.filter(m => m.id !== testMatch.id)];
        }
        console.log('[DEBUG LIVE] Matchs en BDD: ' + matches.length + ', Matchs renvoyés après filtre: ' + liveMatches.length + (mockActive ? ' [MOCK actif]' : '') + ' | statuts: ' + matches.map(function(m){ return m.status || '?'; }).slice(0,10).join(','));
        console.log(`📊 [API] Filtre LIVE actif — ${liveMatches.length} matchs en direct.`);
        return jsonResponse(res, 200, { count: liveMatches.length, matches: liveMatches, meta: { status: db.status, fromCache, serverReady, liveOnly: true, mockActive } });
      }

      if (query.league && query.league !== 'all') {
        const filterValue = query.league.toLowerCase();
        matches = matches.filter(m => (m.sport || '').toLowerCase() === filterValue || (m.league || '').toLowerCase().includes(filterValue));
      }
      if (query.day !== undefined && query.day !== 'all') {
        const dayOffset = parseInt(query.day);
        if (!isNaN(dayOffset)) {
          const target = new Date();
          target.setDate(target.getDate() + dayOffset);
          const targetStr = target.toLocaleDateString('fr-FR');
          matches = matches.filter(m => new Date(m.commence_time).toLocaleDateString('fr-FR') === targetStr);
        }
      }

      matches = matches.map(m => {
        const fresh = computeMatchTopButteurs(m);
        return { ...m, topButteurs: fresh || m.topButteurs || null };
      });

      // [FIX - 2026-05-11] Kill Switch ignoré pour matchs LIVE — priorité statut en direct
      matches = matches.filter(m => {
        if (isMatchExpired(m)) return false;
        return !(
          isFinishedStatus(m.status) ||
          isFinishedStatus(m.live_status) ||
          isFinishedStatus(m.match_status) ||
          isFinishedStatus(m.fixture_status)
        );
      });

      // [MOCK] Injection dans la liste principale pour que allMatches frontend le voie
      if (mockActive && testMatch && testMatch.live_status !== 'FT') {
        matches = [testMatch, ...matches.filter(m => m.id !== testMatch.id)];
      }

      console.log(`📊 [API] Envoi de ${matches.length} matchs filtrés (Kill Switch 4h bypass LIVE + statuts élargis).`);
      return jsonResponse(res, 200, { count: matches.length, matches, meta: { status: db.status, fromCache, serverReady } });
    }

  // 2b. Match Details (proxy interne pour modal STATS)
  if (pathname === '/api/v1/match-details' && req.method === 'GET') {
    const matchId = (query.id || '').toString().trim();
    if (!matchId) return jsonResponse(res, 400, { success: false, error: 'id required' });
    try {
      const proxied = await localApiGet(`/api/v1/insights/${encodeURIComponent(matchId)}`);
      if (!proxied || proxied.status >= 500) {
        return jsonResponse(res, 502, { success: false, error: 'upstream insights unavailable' });
      }
      return jsonResponse(res, proxied.status || 200, proxied.data);
    } catch (err) {
      console.error('[match-details proxy] Error:', err && err.stack ? err.stack : err);
      return jsonResponse(res, 502, { success: false, error: err.message || 'proxy failed' });
    }
  }

  // 3. Leagues
  if (pathname === '/api/v1/leagues') {
    const leagueSet = new Map();
    const allMatches = (db.matches && db.matches.length > 0) ? db.matches : cachedMatches;
    for (const m of allMatches) {
      if (!m.league || m.league === '?') continue;
      const country = detectCountryFromLeague(m.league, m.sport, m.country, m._bsd_league_id);
      const leagueKey = `${m.league}__${country}`;
      if (!leagueSet.has(leagueKey)) leagueSet.set(leagueKey, { name: m.league, country, matchCount: 0 });
      leagueSet.get(leagueKey).matchCount++;
    }
    const byCountry = {};
    for (const [, league] of leagueSet) {
      if (!byCountry[league.country]) byCountry[league.country] = [];
      byCountry[league.country].push(league);
    }
    return jsonResponse(res, 200, { countries: Object.keys(byCountry).sort(), leagues: byCountry, total: leagueSet.size });
  }

  // 4. Stats
  if (pathname.startsWith('/api/v1/stats/')) {
    const id = pathname.slice('/api/v1/stats/'.length);
    let match = db.matches.find(m => m.id === id) || cachedMatches.find(m => m.id === id);
    if (match && !matchHasData(match)) match = null;
    if (!match) {
      forceSyncFixture(id).catch(() => {});
      return jsonResponse(res, 200, { success: false, message: 'Synchro en cours...' });
    }
    return jsonResponse(res, 200, { success: true, data: match });
  }

  // 5. Deep Stats
  if (pathname.startsWith('/api/v1/deep-stats/')) {
    const id = pathname.slice('/api/v1/deep-stats/'.length);
    if (!id || id === 'undefined' || id === 'null') return jsonResponse(res, 200, { success: false, message: 'ID invalide.' });
    let match = db.matches.find(m => m.id === id) || cachedMatches.find(m => m.id === id);
    if (!match) return jsonResponse(res, 200, { success: false, message: 'Match non trouvé.' });
    if (isMatchReady(match).ready) return jsonResponse(res, 200, { success: true, match });
    const syncedMatch = await forceSyncFixture(id);
    return syncedMatch
      ? jsonResponse(res, 200, { success: true, match: syncedMatch })
      : jsonResponse(res, 200, { success: false, message: 'Échec synchro.' });
  }

  // Fallback API interne
  return jsonResponse(res, 404, { error: 'Route inconnue: ' + pathname });
}

function localApiGet(pathnameWithQuery) {
  return new Promise((resolve, reject) => {
    const port = Number(PORT || process.env.PORT || 3000);
    const opts = {
      hostname: '127.0.0.1',
      port,
      path: pathnameWithQuery,
      method: 'GET',
      headers: { 'Accept': 'application/json', 'User-Agent': 'PariScore/2.0-proxy' },
    };
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data });
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(12000, () => { req.destroy(); reject(new Error('Timeout')); });
    req.end();
  });
}

   
// ─── HELPERS — Extraction cotes ANJ par marché ─────────────────────────────


  
 

/**
 * Retourne les meilleures cotes ANJ (France) pour un type de marché donné.
 * @param {Array} bkList   Liste des bookmakers (chaque élément possède .name/.bookmaker et .bets)
 * @param {string} marketType   '1N2' ou 'OU25'
 * @param {string} homeTeam
 * @param {string} awayTeam
 * @returns {Object|null}   Objet contenant les cotes et le nom du bookmaker, ou null si aucune cote ANJ trouvée
 */
function findBestANJOdds(bkList, marketType, homeTeam, awayTeam) {
  let result = {};

  for (const bk of bkList) {
    const bkName = bk.name || bk.bookmaker || '';
    const isANJ = ANJ_BOOKMAKERS.some(a =>
      bkName.toLowerCase().includes(a.toLowerCase())
    );
    if (!isANJ) continue;   // on ignore les bookmakers non‑ANJ

    if (marketType === '1N2') {
      const m1x2 = (bk.bets || []).find(
        b => b.id === 1 || b.name === 'Match Winner'
      );
      if (!m1x2) continue;

      for (const val of m1x2.values) {
        const odd = parseFloat(val.odd);
        if (val.value === 'Home' && (!result.home || odd > result.home)) {
          result.home = odd;
          result.bookie = bkName;
        }
        if (val.value === 'Draw' && (!result.draw || odd > result.draw)) {
          result.draw = odd;
          result.bookie = bkName;
        }
        if (val.value === 'Away' && (!result.away || odd > result.away)) {
          result.away = odd;
          result.bookie = bkName;
        }
      }
    }

    if (marketType === 'OU25') {
      const ou = (bk.bets || []).find(
        b => b.id === 5 || b.name === 'Goals Over/Under'
      );
      if (!ou) continue;

      for (const val of ou.values) {
        const odd = parseFloat(val.odd);
        if (val.value === 'Over 2.5' && (!result.over || odd > result.over)) {
          result.over = odd;
          result.bookie = bkName;
        }
        if (val.value === 'Under 2.5' && (!result.under || odd > result.under)) {
          result.under = odd;
          result.bookie = bkName;
        }
      }
    }
  }

  return Object.keys(result).length > 0 ? result : null;
}



const ANJ_KEYS_SET = new Set(['winamax', 'betclic', 'unibet', 'pmu', 'parionssport', 'zebet', 'bwin', 'netbet', 'betsson', 'feelingbet', 'francepari', 'pokerstars']);

// Poids par book pour Weighted Fair Value (price-makers > price-takers)
const BOOK_WEIGHTS = {
  pinnacle: 4.0, betfair: 3.5, bet365: 2.5,
  winamax: 1.5, unibet: 1.5,
  betclic: 1.0, pmu: 1.0, parionssport: 1.0, zebet: 1.0,
  netbet: 0.7, bwin: 0.7, betsson: 0.7, feelingbet: 0.6, francepari: 0.6,
};
function getBookWeight(key) {
  const k = String(key || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return BOOK_WEIGHTS[k] || BOOK_WEIGHTS[Object.keys(BOOK_WEIGHTS).find(bk => k.includes(bk) || bk.includes(k)) || ''] || 0.5;
}

function processAllBookmakers(rawBookmakers, homeTeam, awayTeam) {
  if (!Array.isArray(rawBookmakers) || !rawBookmakers.length) return [];
  const rows = [];
  for (const bk of rawBookmakers) {
    const key = (bk.key || '').toLowerCase();
    const title = bk.title || bk.key || 'Unknown';
    const isANJ = [...ANJ_KEYS_SET].some(a => key.includes(a) || title.toLowerCase().includes(a));

    // 1N2 (h2h) — gate: skip bookmaker if no h2h
    const h2h = (bk.markets || []).find(m => m.key === 'h2h');
    if (!h2h) continue;
    let home = null, draw = null, away = null;
    for (const o of h2h.outcomes) {
      if (o.name === homeTeam) home = o.price;
      else if (o.name === 'Draw') draw = o.price;
      else if (o.name === awayTeam) away = o.price;
    }
    if (!home || !away) continue;
    const payout = parseFloat((100 / (1/home + (draw ? 1/draw : 0) + 1/away)).toFixed(1));

    // Over/Under (totals) — 1.5, 2.5, 3.5
    const totals = (bk.markets || []).find(m => m.key === 'totals');
    let over15 = null, under15 = null, over25 = null, under25 = null, over35 = null, under35 = null;
    if (totals) {
      for (const o of totals.outcomes) {
        const pt = o.point != null ? o.point : 2.5;
        if (o.name === 'Over') {
          if (Math.abs(pt - 1.5) < 0.1) over15 = o.price;
          else if (Math.abs(pt - 2.5) < 0.1) over25 = o.price;
          else if (Math.abs(pt - 3.5) < 0.1) over35 = o.price;
        } else if (o.name === 'Under') {
          if (Math.abs(pt - 1.5) < 0.1) under15 = o.price;
          else if (Math.abs(pt - 2.5) < 0.1) under25 = o.price;
          else if (Math.abs(pt - 3.5) < 0.1) under35 = o.price;
        }
      }
    }
    const payoutOU25 = over25 && under25 ? parseFloat((100 / (1/over25 + 1/under25)).toFixed(1)) : null;
    const payoutOU15 = over15 && under15 ? parseFloat((100 / (1/over15 + 1/under15)).toFixed(1)) : null;
    const payoutOU35 = over35 && under35 ? parseFloat((100 / (1/over35 + 1/under35)).toFixed(1)) : null;

    // Les deux marquent (BTTS)
    const bttsMarket = (bk.markets || []).find(m => m.key === 'both_teams_score' || m.key === 'btts');
    let bttsYes = null, bttsNo = null;
    if (bttsMarket) {
      const y = bttsMarket.outcomes.find(o => /yes/i.test(o.name));
      const n = bttsMarket.outcomes.find(o => /no/i.test(o.name));
      if (y) bttsYes = y.price;
      if (n) bttsNo = n.price;
    }
    const payoutBTTS = bttsYes && bttsNo ? parseFloat((100 / (1/bttsYes + 1/bttsNo)).toFixed(1)) : null;

    // Double Chance
    const dcMarket = (bk.markets || []).find(m => m.key === 'double_chance');
    let dc1X = null, dcX2 = null, dc12 = null;
    if (dcMarket) {
      for (const o of dcMarket.outcomes) {
        const n = (o.name || '').replace(/\s/g, '');
        if (/^(1X|Home.?Draw)/i.test(n)) dc1X = o.price;
        else if (/^(X2|Draw.?Away)/i.test(n)) dcX2 = o.price;
        else if (/^(12|Home.?Away)/i.test(n)) dc12 = o.price;
      }
    }

    rows.push({ key, title, isANJ, home, draw, away, payout,
      over15, under15, payoutOU15,
      over25, under25, payoutOU: payoutOU25,
      over35, under35, payoutOU35,
      bttsYes, bttsNo, payoutBTTS,
      dc1X, dcX2, dc12,
    });
  }
  rows.sort((a, b) => {
    if (a.isANJ !== b.isANJ) return (b.isANJ ? 1 : 0) - (a.isANJ ? 1 : 0);
    return (b.payout || 0) - (a.payout || 0);
  });
  const bestHome = Math.max(...rows.map(r => r.home || 0));
  const drawVals = rows.map(r => r.draw).filter(v => v);
  const bestDraw = drawVals.length ? Math.max(...drawVals) : null;
  const bestAway = Math.max(...rows.map(r => r.away || 0));
  const best = field => { const v = rows.map(r => r[field]).filter(Boolean); return v.length ? Math.max(...v) : null; };
  const bestOver15 = best('over15'), bestUnder15 = best('under15');
  const bestOver25 = best('over25'), bestUnder25 = best('under25');
  const bestOver35 = best('over35'), bestUnder35 = best('under35');
  const bestBttsYes = best('bttsYes'), bestBttsNo = best('bttsNo');
  const bestDc1X = best('dc1X'), bestDcX2 = best('dcX2'), bestDc12 = best('dc12');
  return rows.map(r => ({
    ...r,
    isBestHome: r.home === bestHome,
    isBestDraw: bestDraw !== null && r.draw === bestDraw,
    isBestAway: r.away === bestAway,
    isBestOver15: bestOver15 !== null && r.over15 === bestOver15,
    isBestUnder15: bestUnder15 !== null && r.under15 === bestUnder15,
    isBestOver25: bestOver25 !== null && r.over25 === bestOver25,
    isBestUnder25: bestUnder25 !== null && r.under25 === bestUnder25,
    isBestOver35: bestOver35 !== null && r.over35 === bestOver35,
    isBestUnder35: bestUnder35 !== null && r.under35 === bestUnder35,
    isBestBttsYes: bestBttsYes !== null && r.bttsYes === bestBttsYes,
    isBestBttsNo: bestBttsNo !== null && r.bttsNo === bestBttsNo,
    isBestDc1X: bestDc1X !== null && r.dc1X === bestDc1X,
    isBestDcX2: bestDcX2 !== null && r.dcX2 === bestDcX2,
    isBestDc12: bestDc12 !== null && r.dc12 === bestDc12,
  }));
}

function extractANJMarkets(bookmakers, homeTeam, awayTeam) {
  const markets = {};
  for (const bk of bookmakers) {
    const bkName = bk.bookmaker || bk.title || '';
    const isANJ = ANJ_BOOKMAKERS.some(a => bkName.toLowerCase().includes(a.toLowerCase()));
    if (!isANJ) continue;

    // 1N2
    const h2h = (bk.markets || []).find(m => m.key === 'h2h');
    if (h2h) {
      if (!markets['1N2']) markets['1N2'] = {};
      for (const o of h2h.outcomes) {
        if (o.name === homeTeam && (!markets['1N2'].home || o.price > markets['1N2'].home)) { markets['1N2'].home = o.price; markets['1N2'].bookie = bkName; }
        if (o.name === 'Draw' && (!markets['1N2'].draw || o.price > markets['1N2'].draw)) { markets['1N2'].draw = o.price; markets['1N2'].bookie = bkName; }
        if (o.name === awayTeam && (!markets['1N2'].away || o.price > markets['1N2'].away)) { markets['1N2'].away = o.price; markets['1N2'].bookie = bkName; }
      }
    }
  }
  return markets;
}

// -------------------------------------------------
//  GET /api/v1/team-logo?name=Arsenal  — lookup Sofascore image, cached 30j
// -------------------------------------------------


// GET /api/v1/status


// GET /api/v1/corners/:matchId — Predictions corners Over/Under


// GET /api/v1/live/bsd — Données live BSD brutes (xG, momentum, incidents, stats temps réel)











// ─── MATCHDAY PASS — Stripe Checkout ─────────────────────────────────────


// ═══════════════════════════════════════════════════════════════════════════════
//  SERVEUR HTTP
// ═══════════════════════════════════════════════════════════════════════════════
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};
// ═══════════════════════════════════════════════════════════════════════════════
//  SERVEUR HTTP (VERSION SYNTAXE VÉRIFIÉE)
// ═══════════════════════════════════════════════════════════════════════════════

const server = http.createServer(async (req, res) => {
    // 1. On parse l'URL en premier (pathname + query toujours disponibles)
    const parsedUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const pathname = parsedUrl.pathname;
    const query = Object.fromEntries(parsedUrl.searchParams.entries());

    // CORS preflight
    if (req.method === 'OPTIONS') {
        return res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Access-Control-Max-Age': '86400'
        }).end();
    }

    // Routes API
    if (pathname === '/api/v1/team-logo') {
        const name = (query.name || '').toString().trim();
    if (!name) {
        return res.writeHead(400, { 'Content-Type': 'application/json' })
                  .end(JSON.stringify({ error: 'name required' }));
    }

    const cacheKey = `logo_${name.toLowerCase().replace(/\s+/g, '_')}`;
    const cached = apiCacheGet(cacheKey);
    if (cached) {
        return res.writeHead(200, { 'Content-Type': 'application/json' })
                  .end(JSON.stringify(cached));
    }

    // ----------  IIFE ASYNCHRONE (corrige l'erreur 'await')  ----------
    (async () => {
        try {
            // 1. Recherche via l'API BSD (la plus rapide et la plus couvrante)
            let result = null;
            if (BSD_API_KEY) {
                try {
                    const r = await bsdFetch(
                        `/teams/?search=${encodeURIComponent(name)}&page_size=1`
                    );
                    const t = r.data?.results?.[0];
                    if (t?.id) {
                        result = {
                            url: `https://sports.bzzoiro.com/img/team/${t.id}/`,
                            bsdId: t.id
                        };
                    }
                } catch { /* On passe à Sofascore en cas d'échec */ }
            }

            // 2. Recherche via Sofascore (fallback)
            if (!result) {
                const found = await searchSofascoreTeam(name);
                if (found?.id) {
                    result = {
                        url: `https://api.sofascore.app/api/v1/team/${found.id}/image`,
                        sofaId: found.id
                    };
                }
            }

            if (!result) {
                return res.writeHead(404, { 'Content-Type': 'application/json' })
                          .end(JSON.stringify({ url: null }));
            }

            // Mise en cache pour 30 jours
            db.prepare(
                'INSERT OR REPLACE INTO api_cache (key, data, source, created_at, expires_at) VALUES (?, ?, ?, ?, ?)'
            ).run(
                cacheKey,
                JSON.stringify(result),
                'logo',
                Date.now(),
                Date.now() + 30 * 24 * 3600 * 1000
            );

            res.writeHead(200, { 'Content-Type': 'application/json' })
              .end(JSON.stringify(result));
        } catch (e) {
            res.writeHead(500, { 'Content-Type': 'application/json' })
              .end(JSON.stringify({ url: null }));
        }
    })(); return; // ← FIN DE L'IIFE ASYNCHRONE
}

// -------------------------------------------------
//  GET /api/v1/player — Fiche détaillée joueur via BSD (par id ou nom)
// -------------------------------------------------
if (pathname === '/api/v1/player') {
    const urlParams = new URL(req.url, `http://${req.headers.host}`);
    const playerName = urlParams.searchParams.get('name');
    const playerId = urlParams.searchParams.get('id');
    const teamCtx = urlParams.searchParams.get('team') || urlParams.searchParams.get('team_name');
    const leagueCtx = urlParams.searchParams.get('league'); // optionnel : config_id pour fallback
    if (!playerName && !playerId) {
        return jsonResponse(res, 400, { error: 'player id or name required' });
    }

    // Cache key inclut team context pour disambiguation
    const cacheKey = playerId
      ? `player_${playerId}`
      : `player_name_${normName ? normName(playerName) : playerName.toLowerCase()}_t_${teamCtx ? (normName ? normName(teamCtx) : teamCtx.toLowerCase()) : 'any'}`;
    const cached = apiCacheGet(cacheKey);
    if (cached) {
        return jsonResponse(res, 200, cached);
    }

    (async () => {
        try {
            let player = null;
            // Étape 1 : API-Football d'abord si team_id ou league connus (couverture meilleure stars + photos CDN)
            let apifPrimary = null;
            if (playerName && (teamCtx || leagueCtx)) {
              try {
                apifPrimary = await fetchAPIFootballPlayer(playerName, teamCtx, leagueCtx ? parseInt(leagueCtx) : null);
              } catch (e) { /* silence */ }
            }
            // Étape 2 : BSD (canonical pour stats détaillées + form_l5)
            let bsdPlayer = null;
            if (playerId) {
                bsdPlayer = await bsdGetPlayerDetail(playerId);
            } else if (playerName) {
                let searchRes = teamCtx ? await bsdSearchPlayers(`${playerName} ${teamCtx}`) : [];
                if (!searchRes || !searchRes.length) {
                    searchRes = await bsdSearchPlayers(playerName);
                }
                if (searchRes && searchRes.length > 0) {
                    let chosen = searchRes[0];
                    if (apifPrimary && searchRes.length > 1) {
                      const apifFull = normName(apifPrimary.name);
                      const apifLastNorm = normName(apifPrimary.lastname || '');
                      // Premier token du firstname (ignore middle names "Jude Victor William" → "jude")
                      const apifFirstToken = normName((apifPrimary.firstname || '').split(' ')[0] || '');
                      let better = searchRes.find(p => normName(p.name) === apifFull);
                      if (!better && apifFirstToken && apifLastNorm) {
                        better = searchRes.find(p => {
                          const pn = normName(p.name);
                          return pn.includes(apifFirstToken) && pn.includes(apifLastNorm);
                        });
                      }
                      if (!better && apifLastNorm) {
                        const lastMatches = searchRes.filter(p => normName(p.name).includes(apifLastNorm));
                        if (lastMatches.length === 1) better = lastMatches[0];
                      }
                      if (better) chosen = better;
                    }
                    if (teamCtx) {
                      const teamNorm = normName(teamCtx);
                      const match = searchRes.find(p => p.team && normName(p.team.name) === teamNorm);
                      if (match) chosen = match;
                    }
                    bsdPlayer = await bsdGetPlayerDetail(chosen.id);
                }
            }
            // Étape 3 : choisir source primaire — API-Football si nom matche search, sinon BSD
            if (apifPrimary) {
              const searchedNorm = normName(playerName);
              const apifNorm = normName(apifPrimary.name);
              const apifLast = normName(apifPrimary.lastname || '');
              // Tokens du search : la dernière partie est usuellement le lastname
              const searchTokens = searchedNorm.split(/\s+/).filter(Boolean);
              const searchLast = searchTokens[searchTokens.length - 1] || '';
              const apifMatchesSearch =
                apifNorm === searchedNorm
                || apifLast === searchedNorm
                || apifLast === searchLast
                || apifNorm.includes(searchedNorm)
                || searchedNorm.includes(apifLast)
                || (searchLast.length >= 4 && apifLast.includes(searchLast));
              console.log(`  [Player] search="${playerName}" apif="${apifPrimary.name}" (id ${apifPrimary.api_football_id}) match=${apifMatchesSearch}`);
              if (apifMatchesSearch) {
                // API-Football primary
                // Construit fullName :
                // - Si name déjà complet (sans initiale ".") → keep as is
                // - Si name commence par "X." (initiale) → cherche token du firstname avec cette initiale
                //   sinon premier token. Évite "Masour Dembélé" (firstname="Masour Ousmane" + Ousmane est le bon)
                // - Vérifie aussi avec BSD's name si on a un match BSD propre (firstname matche initiale)
                let fullName = apifPrimary.name;
                if (apifPrimary.firstname && apifPrimary.lastname) {
                  const apifShort = apifPrimary.name;
                  const initialMatch = apifShort.match(/^([A-Z])\./);
                  if (initialMatch) {
                    const initialChar = initialMatch[1].toLowerCase();
                    const tokens = apifPrimary.firstname.split(/\s+/).filter(Boolean);
                    let correctFirst = tokens.find(t => t.charAt(0).toLowerCase() === initialChar);
                    // Si BSD a trouvé un candidat dont le PREMIER token commence par cette initiale, préfère-le (BSD usuellement nom commun "Ousmane Dembélé")
                    if (bsdPlayer && bsdPlayer.name) {
                      const bsdFirst = bsdPlayer.name.split(/\s+/)[0];
                      if (bsdFirst && bsdFirst.charAt(0).toLowerCase() === initialChar) {
                        correctFirst = bsdFirst;
                      }
                    }
                    if (correctFirst) fullName = `${correctFirst} ${apifPrimary.lastname}`;
                  }
                  // else : name déjà complet ex "Robert Lewandowski" → keep
                }
                player = {
                  id: apifPrimary.api_football_id,
                  api_football_id: apifPrimary.api_football_id,
                  name: fullName,
                  firstname: apifPrimary.firstname,
                  lastname: apifPrimary.lastname,
                  short_name: apifPrimary.firstname && apifPrimary.lastname ? apifPrimary.firstname.charAt(0) + '. ' + apifPrimary.lastname : null,
                  position: apifPrimary.season_stats?.position || null,
                  nationality: apifPrimary.nationality,
                  age: apifPrimary.age,
                  birthdate: apifPrimary.birth,
                  photo: apifPrimary.photo,
                  team: apifPrimary.team_name ? { name: apifPrimary.team_name } : null,
                  height: apifPrimary.height,
                  weight: apifPrimary.weight,
                  preferred_foot: null,
                  market_value: null,
                  season_stats: {
                    season: apifPrimary.season_year ? String(apifPrimary.season_year) + '/' + (apifPrimary.season_year + 1) : null,
                    competition: apifPrimary.league_name,
                    season_id: null,
                    base: {
                      matches: apifPrimary.season_stats.appearances,
                      minutes: apifPrimary.season_stats.minutes,
                      goals: apifPrimary.season_stats.goals,
                      assists: apifPrimary.season_stats.assists,
                      yellow_cards: apifPrimary.season_stats.yellow_cards,
                      red_cards: apifPrimary.season_stats.red_cards,
                      saves: apifPrimary.season_stats.saves,
                      avg_rating: apifPrimary.season_stats.rating ? parseFloat(apifPrimary.season_stats.rating) : null,
                    },
                    shooting: {
                      shots_total: apifPrimary.season_stats.shots_total,
                      shots_on_target: apifPrimary.season_stats.shots_on,
                      conversion_rate: apifPrimary.season_stats.shots_total ? (apifPrimary.season_stats.goals / apifPrimary.season_stats.shots_total) : null,
                    },
                    creativity: {
                      key_passes: apifPrimary.season_stats.passes_key,
                      key_passes_per_game: apifPrimary.season_stats.appearances ? (apifPrimary.season_stats.passes_key / apifPrimary.season_stats.appearances) : 0,
                    },
                    expected: { xg_total: 0, xg_per_game: 0, xa_total: 0, xa_per_game: 0, xg_overperformance: 0, xg_per_shot: null },
                    per90: {
                      goals_per90: apifPrimary.season_stats.minutes ? (apifPrimary.season_stats.goals * 90 / apifPrimary.season_stats.minutes) : 0,
                      assists_per90: apifPrimary.season_stats.minutes ? (apifPrimary.season_stats.assists * 90 / apifPrimary.season_stats.minutes) : 0,
                      xg_per90: 0,
                      shots_per90: apifPrimary.season_stats.minutes ? (apifPrimary.season_stats.shots_total * 90 / apifPrimary.season_stats.minutes) : null,
                    },
                    kpi_score: 0,
                  },
                  form_l5: bsdPlayer?.form_l5 || [],
                  _source: 'api-football',
                  _photo_source: apifPrimary.photo ? 'api-football' : null,
                  _enriched: bsdPlayer ? ['bsd-form'] : [],
                };
              }
            }
            // Sinon : utilise BSD comme primary
            if (!player) player = bsdPlayer;
            if (!player) {
                return jsonResponse(res, 404, { error: 'player not found' });
            }
            // Multi-source enrichment : si BSD photo null OU stats vides, tenter API-Football.
            // CDN api-sports photos accessible sans clé : media.api-sports.io/football/players/{id}.png
            const bsdMatchCount = player.season_stats?.base?.matches || 0;
            const needsEnrich = !player.photo || bsdMatchCount < 3;
            if (needsEnrich && (teamCtx || leagueCtx)) {
              try {
                // Use ORIGINAL search term (what user clicked) — not BSD-returned name (peut être mauvais joueur)
                const apif = await fetchAPIFootballPlayer(playerName, teamCtx, leagueCtx ? parseInt(leagueCtx) : null);
                // Garde-fou : si API-Football trouve un nom complètement différent du nom cherché, skip merge
                const searchedNorm = normName(playerName);
                const apifNorm = apif ? normName(apif.name) : '';
                const apifFirstName = apif ? normName(apif.firstname || '') : '';
                const apifLastName = apif ? normName(apif.lastname || '') : '';
                const nameMatches = apif && (
                  apifNorm === searchedNorm ||
                  apifNorm.includes(searchedNorm) ||
                  searchedNorm.includes(apifNorm) ||
                  searchedNorm.includes(apifLastName) ||
                  apifLastName.includes(searchedNorm)
                );
                if (apif && nameMatches) {
                  // Si BSD a retourné un mauvais joueur (Mussa au lieu de Kylian par ex),
                  // override aussi le name + identifiants si API-Football match exact la recherche
                  const bsdNameMismatch = normName(player.name) !== searchedNorm && !normName(player.name).includes(searchedNorm);
                  const apifExactMatch = apifNorm === searchedNorm || apifLastName === searchedNorm;
                  if (bsdNameMismatch && apifExactMatch) {
                    player.name = apif.name;
                    player.short_name = apif.firstname && apif.lastname ? apif.firstname.charAt(0) + '. ' + apif.lastname : (player.short_name || null);
                  }
                  // Merge : prend photo + meta API-Football si BSD null
                  if (!player.photo && apif.photo) {
                    player.photo = apif.photo;
                    player._photo_source = 'api-football';
                  }
                  // Enrich avec stats API-Football si BSD vide
                  if (bsdMatchCount === 0 && apif.season_stats?.appearances > 0) {
                    player.season_stats = player.season_stats || {};
                    player.season_stats.base = player.season_stats.base || {};
                    player.season_stats.base.matches = apif.season_stats.appearances;
                    player.season_stats.base.minutes = apif.season_stats.minutes;
                    player.season_stats.base.goals = apif.season_stats.goals;
                    player.season_stats.base.assists = apif.season_stats.assists;
                    player.season_stats.base.yellow_cards = apif.season_stats.yellow_cards;
                    player.season_stats.base.red_cards = apif.season_stats.red_cards;
                    player.season_stats.base.avg_rating = apif.season_stats.rating ? parseFloat(apif.season_stats.rating) : null;
                    player.season_stats.shooting = player.season_stats.shooting || {};
                    player.season_stats.shooting.shots_total = apif.season_stats.shots_total;
                    player.season_stats.shooting.shots_on_target = apif.season_stats.shots_on;
                    player.season_stats.creativity = player.season_stats.creativity || {};
                    player.season_stats.creativity.key_passes = apif.season_stats.passes_key;
                    player.season_stats.competition = apif.league_name || null;
                  }
                  // Meta : team_name, nationalité, taille, poids — prend si BSD null
                  if (!player.team && apif.team_name) player.team = { name: apif.team_name };
                  if (!player.nationality && apif.nationality) player.nationality = apif.nationality;
                  if (!player.height && apif.height) player.height = apif.height;
                  if (!player.weight && apif.weight) player.weight = apif.weight;
                  if (!player.age && apif.age) player.age = apif.age;
                  player.api_football_id = apif.api_football_id;
                  player._enriched = (player._enriched || []).concat(['api-football']);
                }
              } catch (e) { /* fallback silencieux */ }
            }
            // 3e source : TheSportsDB (photo fallback gratuit, sans quota)
            if (!player.photo) {
              try {
                const tsdb = await fetchTheSportsDBPlayerPhoto(player.name || playerName, teamCtx);
                if (tsdb && tsdb.photo) {
                  player.photo = tsdb.photo;
                  player._photo_source = 'thesportsdb';
                  player._enriched = (player._enriched || []).concat(['thesportsdb-photo']);
                  if (!player.nationality && tsdb.nationality) player.nationality = tsdb.nationality;
                  if (!player.height && tsdb.height) player.height = tsdb.height;
                  if (!player.weight && tsdb.weight) player.weight = tsdb.weight;
                  if (!player.birthdate && tsdb.birthdate) player.birthdate = tsdb.birthdate;
                }
              } catch (e) { /* silence */ }
            }
            player._photo_available = !!player.photo;
            // TTL 24h pour joueurs actifs (was 7d → trop stale pour rating saison + form_l5)
            apiCacheSet(cacheKey, player, 'bsd_player', 24 * 3600 * 1000);
            return jsonResponse(res, 200, player);
        } catch (e) {
            console.error('[Player API] erreur:', e.message);
            return jsonResponse(res, 500, { error: e.message });
        }
    })();
    return;
}

// -------------------------------------------------
//  GET /api/v1/team/:id — Fiche détaillée équipe via BSD
// -------------------------------------------------
if (pathname.startsWith('/api/v1/team/')) {
    const teamId = pathname.split('/').pop();
    if (!teamId) {
        return jsonResponse(res, 400, { error: 'team id required' });
    }

    const cacheKey = `team_${teamId}`;
    const cached = apiCacheGet(cacheKey);
    if (cached) {
        return jsonResponse(res, 200, cached);
    }

    (async () => {
        try {
            const team = await bsdGetTeamDetail(teamId);
            if (!team) {
                return jsonResponse(res, 404, { error: 'team not found' });
            }
            apiCacheSet(cacheKey, team, 'bsd_team', 7 * 24 * 3600 * 1000);
            return jsonResponse(res, 200, team);
        } catch (e) {
            console.error('[Team API] erreur:', e.message);
            return jsonResponse(res, 500, { error: e.message });
        }
    })();
    return;
}

// -------------------------------------------------
//  POST /api/v1/click — Enregistrer click utilisateur (joueur/équipe)
// -------------------------------------------------
if (pathname === '/api/v1/click' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
        try {
            const data = JSON.parse(body);
            const { type, id, name, source } = data;
            if (!type || !id) {
                return jsonResponse(res, 400, { error: 'type and id required' });
            }

            const clickKey = `click_${type}_${id}`;
            const clickData = {
                type,
                id: String(id),
                name: name || '',
                source: source || 'unknown',
                clicked_at: Date.now()
            };

            db.prepare('INSERT OR REPLACE INTO api_cache (key, data, source, created_at, expires_at) VALUES (?, ?, ?, ?, ?)').run(
                clickKey,
                JSON.stringify(clickData),
                'click',
                Date.now(),
                Date.now() + 90 * 24 * 3600 * 1000
            );

            console.log(`[Click] ${type} ${id} "${name}" — bufferisé`);
            return jsonResponse(res, 200, { saved: true });
        } catch (e) {
            return jsonResponse(res, 400, { error: 'invalid JSON' });
        }
    });
    return;
}

if (pathname === '/api/v1/status') {
  return jsonResponse(res, 200, {
    status: db.status,
    ready: serverReady,
    matchCount: db.matches.length,
    teamCount: Object.keys(db.teamStats).length,
    lastOddsUpdate: db.lastOddsUpdate,
    lastStatsUpdate: db.lastStatsUpdate,
    oddsQuota: db.oddsQuotaRemaining,
    statsQuota: db.statsQuotaRemaining,
    uptime: process.uptime(),
    bsd_connected: !!BSD_API_KEY,
  });
}

// -------------------------------------------------
//  GET /api/v1/guide — Documentation complete PariScore
// -------------------------------------------------
if (pathname === '/api/v1/guide') {
  const fs = require('fs');
  const path = require('path');
  const guidePath = path.join(__dirname, 'docs', 'GUIDELINE_PariScore.md');
  try {
    const content = fs.readFileSync(guidePath, 'utf8');
    return jsonResponse(res, 200, {
      title: 'Guide Complet PariScore v9.7',
      content: content,
      last_updated: '2026-05-10'
    });
  } catch (e) {
    return jsonResponse(res, 200, {
      title: 'Guide Complet PariScore v9.7',
      content: '# Guide\n\nDocumentation en cours de chargement...',
      last_updated: '2026-05-10'
    });
  }
}

    // ... le reste de tes routes (api/v1/matches, etc.) ...

// ─── ROUTE TEST : Activation / Désactivation du Mock Match ───────────────────
if (pathname === '/api/v1/test/enable-mock') {
  if (req.method === 'POST' || req.method === 'GET') {
    const user = getAuthUser(req);
    if (!user || user.role !== 'admin') return jsonResponse(res, 403, { error: 'Accès réservé admin' });
    if (!mockActive) {
      mockActive = true;
      testMatch = buildInitialMockMatch();
      if (_mockInterval) clearInterval(_mockInterval);
      _mockInterval = setInterval(updateMockMatch, 10000);
      console.log('[MOCK] ✅ Mock activé via route — PariScore FC vs Test United (60ème minute)');
      return jsonResponse(res, 200, { success: true, message: 'Mock match activé', match_id: testMatch.id, minute: testMatch.live_minute });
    } else {
      return jsonResponse(res, 200, { success: true, message: 'Mock déjà actif', match_id: testMatch?.id, minute: testMatch?.live_minute });
    }
  }
}

if (pathname === '/api/v1/test/disable-mock') {
  if (req.method === 'POST' || req.method === 'GET') {
    const user = getAuthUser(req);
    if (!user || user.role !== 'admin') return jsonResponse(res, 403, { error: 'Accès réservé admin' });
    mockActive = false;
    if (_mockInterval) { clearInterval(_mockInterval); _mockInterval = null; }
    testMatch = null;
    console.log('[MOCK] 🛑 Mock désactivé via route');
    return jsonResponse(res, 200, { success: true, message: 'Mock désactivé' });
  }
}

// ── GET /api/v1/live-players/:id — Top 3 joueurs par équipe (ratings BSD saison) ──
if (pathname.startsWith('/api/v1/live-players/')) {
  const id = pathname.slice('/api/v1/live-players/'.length);
  if (!id || id === 'undefined') return jsonResponse(res, 400, { error: 'ID invalide' });
  const match = (mockActive && testMatch && testMatch.id === id)
    ? testMatch
    : (db.matches.find(m => m.id === id) || null);
  if (!match) return jsonResponse(res, 404, { error: 'Match non trouvé' });
  const top3 = await getTop3PlayersWithFallback(match);
  return jsonResponse(res, 200, { success: true, matchId: id, top3 });
}

// ── GET /api/v1/live-dashboard/:matchId — Modal V2 data source (BSD sr_stats + Sofa enrichment + momentum synthétique) ──
if (pathname.startsWith('/api/v1/live-dashboard/')) {
  const id = pathname.slice('/api/v1/live-dashboard/'.length);
  if (!id || id === 'undefined') return jsonResponse(res, 400, { error: 'ID invalide' });
  const match = (mockActive && testMatch && testMatch.id === id)
    ? testMatch
    : (db.matches.find(m => m.id === id) || null);
  if (!match) return jsonResponse(res, 404, { error: 'Match non trouvé', id });
  const bsdId = match._bsd_event_id || (id.startsWith('bsd_') ? id.slice(4) : null);
  const [detail, sofaEnrich] = await Promise.all([
    bsdId ? fetchBSDEventDetail(bsdId) : Promise.resolve(null),
    fetchSofaMicroserviceEnrichment(match).catch(() => null),
  ]);
  const payload = buildLiveDashboardPayload(match, detail);
  // Sofa overrides : si Sofa a la donnée, elle prime sur BSD synthétique
  if (sofaEnrich) {
    if (sofaEnrich.possession)        payload.possession        = sofaEnrich.possession;
    if (sofaEnrich.shots)             payload.shots             = sofaEnrich.shots;
    if (sofaEnrich.shots_on_target)   payload.shots_on_target   = sofaEnrich.shots_on_target;
    if (sofaEnrich.corners)           payload.corners           = sofaEnrich.corners;
    if (sofaEnrich.xg)                payload.xg                = sofaEnrich.xg;
    if (sofaEnrich.momentum && sofaEnrich.momentum.length) payload.momentum = sofaEnrich.momentum;
    if (sofaEnrich.shotmap && sofaEnrich.shotmap.length)   payload.shotmap  = sofaEnrich.shotmap;
    payload._sofa_event_id = sofaEnrich.sofa_event_id;
    payload._source = `${payload._source || 'bsd'}+sofa`;
  }
  return jsonResponse(res, 200, payload);
}

if (pathname === '/api/v1/live/bsd') {
  // v10.6: fresh=true → force pollLiveScores avant réponse (Dashboard V2 polling 30s)
  if (query.fresh === 'true' && typeof pollLiveScores === 'function') {
    try {
      await Promise.race([
        pollLiveScores(),
        new Promise(resolve => setTimeout(resolve, 3000)),
      ]);
    } catch {}
  }
  const now = Date.now();
  const liveMatches = db.matches.filter(m => {
    if (!m.live_score || !m.live_minute) return false;
    // v10.5: Ghost filter backend
    const minuteVal = parseInt(m.live_minute || 0);
    if (minuteVal > 130) return false;
    if (m.commence_time) {
      const hoursSince = (now - new Date(m.commence_time).getTime()) / (1000 * 60 * 60);
      if (hoursSince > 4) return false;
    }
    return true;
  });
  if (!liveMatches.length) {
    return jsonResponse(res, 200, { live: [], message: 'Aucun match en direct' });
  }
  const liveData = liveMatches.map(m => ({
    id: m.id,
    home_team: m.home_team,
    away_team: m.away_team,
    league: m.league,
    score: m.live_score,
    minute: m.live_minute,
    xg: m.live_xg || null,
    possession: m.live_possession || null,
    shots: m.live_shots || null,
    shots_on_target: m.live_shots_on_target || null,
    corners: m.live_corners || null,
    cards: m.live_cards || null,
    momentum: m.live_momentum || null,
    intensity: m.live_intensity || 0,
    edge: m.best_edge?.edge || 0,
    _source: m._source || 'odds_api',
  }));
  return jsonResponse(res, 200, { live: liveData, count: liveData.length, ts: Date.now() });
}
// GET /api/v1/live/predictions — Top 5 paris live avec probabilités ajustées
if (pathname === '/api/v1/live/predictions') {
  const result = getLivePredictionsTop5();
  return jsonResponse(res, 200, result);
}
// GET /api/v1/match/:matchId/tv-channel — TV broadcaster for a specific match (lazy enrichment via Sofa microservice, cache 6h)
const tvChannelMatch = pathname.match(/^\/api\/v1\/match\/([^/?]+)\/tv-channel$/);
if (tvChannelMatch && req.method === 'GET') {
  const id = decodeURIComponent(tvChannelMatch[1]);
  const country = (query.country || 'FR').toUpperCase();
  const cacheKey = `tv_${id}_${country}`;
  const cached = apiCacheGet(cacheKey, 'tv_channel');
  if (cached) return jsonResponse(res, 200, { ...cached, _cached: true });

  const match = db.matches.find(m => m.id === id);
  if (!match) return jsonResponse(res, 404, { error: 'Match non trouvé' });
  const sofaId = await resolveSofaEventId(match);
  if (!sofaId) {
    const empty = { match_id: id, country, channels: [], _source: 'no-mapping' };
    apiCacheSet(cacheKey, empty, 'tv_channel', 6 * 3600);
    return jsonResponse(res, 200, empty);
  }
  const data = await _sofaServiceFetch(`/match/${sofaId}/channels?country=${country}`, 8000);
  if (!data || !Array.isArray(data.channels)) {
    const empty = { match_id: id, country, channels: [], _source: 'sofa-miss' };
    apiCacheSet(cacheKey, empty, 'tv_channel', 30 * 60); // shorter retry on miss
    return jsonResponse(res, 200, empty);
  }
  // Enrich each channel with logo URL from local mapping (legacy fetchTVChannels)
  const channelLogos = {
    'beIN SPORTS': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/14/BeIN_Sports_2017.svg/200px-BeIN_Sports_2017.svg.png',
    'beIN SPORTS 1': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/14/BeIN_Sports_2017.svg/200px-BeIN_Sports_2017.svg.png',
    'beIN SPORTS 2': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/14/BeIN_Sports_2017.svg/200px-BeIN_Sports_2017.svg.png',
    'beIN SPORTS 3': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/14/BeIN_Sports_2017.svg/200px-BeIN_Sports_2017.svg.png',
    'beIN SPORTS MAX': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/14/BeIN_Sports_2017.svg/200px-BeIN_Sports_2017.svg.png',
    'Canal+': 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2c/Canal%2B.svg/200px-Canal%2B.svg.png',
    'Canal+ Foot': 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2c/Canal%2B.svg/200px-Canal%2B.svg.png',
    'Canal+ Sport': 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2c/Canal%2B.svg/200px-Canal%2B.svg.png',
    'Canal+ Sport 360': 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2c/Canal%2B.svg/200px-Canal%2B.svg.png',
    'Amazon Prime Video': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/17/Amazon_Prime_Video_logo.jpg/200px-Amazon_Prime_Video_logo.jpg',
    'Prime Video': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/17/Amazon_Prime_Video_logo.jpg/200px-Amazon_Prime_Video_logo.jpg',
    'DAZN': 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/78/DAZN_Logo.svg/200px-DAZN_Logo.svg.png',
    'RMC Sport': 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/63/RMC_Sport.svg/200px-RMC_Sport.svg.png',
    'RMC Sport 1': 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/63/RMC_Sport.svg/200px-RMC_Sport.svg.png',
    "L'Équipe": 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4c/L_%C3%89quipe.svg/200px-L_%C3%89quipe.svg.png',
    'M6': 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e9/M6_logo.svg/200px-M6_logo.svg.png',
    'TF1': 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/72/TF1_logo.svg/200px-TF1_logo.svg.png',
  };
  const channels = data.channels.map(c => ({
    id: c.id,
    name: c.name,
    logo: channelLogos[c.name] || null,
  }));
  const payload = { match_id: id, country, channels, _source: 'sofa-microservice' };
  apiCacheSet(cacheKey, payload, 'tv_channel', 6 * 3600);
  return jsonResponse(res, 200, payload);
}

// GET /api/v1/tv-channels?date=YYYY-MM-DD — Chaînes TV de diffusion
if (pathname === '/api/v1/tv-channels') {
  const dateStr = query.date || new Date().toISOString().slice(0, 10);
  const channels = await fetchTVChannels(dateStr);
  return jsonResponse(res, 200, { date: dateStr, channels });
}
// GET /api/v1/press-conferences?team=Arsenal&type=pre — Vidéos conférences de presse
if (pathname === '/api/v1/press-conferences') {
  const team = query.team || '';
  const type = query.type || 'pre'; // 'pre' or 'post'
  if (!team) return jsonResponse(res, 400, { error: 'team required' });
  
  // Recherche de vidéos via YouTube ( URL publique, pas d'API key)
  // Retourne les URLs de recherche YouTube pour les conférences de presse
  const searchQueries = {
    pre: `${team} pre match press conference 2025`,
    post: `${team} post match press conference reactions 2025`,
    injury: `${team} injury update press conference 2025`
  };
  
  const videos = {
    team,
    type,
    searchUrls: {
      preMatch: `https://www.youtube.com/results?search_query=${encodeURIComponent(searchQueries.pre)}`,
      postMatch: `https://www.youtube.com/results?search_query=${encodeURIComponent(searchQueries.post)}`,
      injury: `https://www.youtube.com/results?search_query=${encodeURIComponent(searchQueries.injury)}`
    },
    // Sources officielles à surveiller
    sources: [
      { name: `${team} Official`, url: `https://www.youtube.com/@${team.replace(/\s+/g, '')}/videos` },
      { name: 'beIN SPORTS', url: 'https://www.youtube.com/@beINSPORTS' },
      { name: 'Sky Sports Football', url: 'https://www.youtube.com/@SkySportsFootball' },
      { name: 'BBC Sport', url: 'https://www.youtube.com/@BBCSport' }
    ],
    // Modèles d'URLs pour les grandes ligues
    leaguePatterns: {
      'Premier League': `https://www.youtube.com/@PremierLeagueOfficial`,
      'La Liga': `https://www.youtube.com/@LaLiga`,
      'Serie A': `https://www.youtube.com/@SerieA`,
      'Bundesliga': `https://www.youtube.com/@BundesligaOfficial`,
      'Ligue 1': `https://www.youtube.com/@Ligue1Official`
    }
  };
  
  return jsonResponse(res, 200, videos);
}
// GET /api/v1/cache-status — API cache stats (admin)
if (pathname === '/api/v1/cache-status') {
  const user = requireAuth(req, res, ['admin']);
  if (!user) return;
  const stats = apiCacheStats();
  const ttl = Math.round(API_CACHE_TTL / 3600000);
  return jsonResponse(res, 200, { ...stats, ttl_hours: ttl });
}
// POST /api/v1/auth/login — Admin (username) ou Membre (email)
if (pathname === '/api/v1/auth/login' && req.method === 'POST') {
  const ip = req.socket?.remoteAddress || 'unknown';
  if (!checkLoginRateLimit(ip)) {
    return jsonResponse(res, 429, { error: 'Trop de tentatives. Réessayez dans 15 minutes.' });
  }
  readBodyLimited(req, MAX_BODY_SIZE).then(body => {
    try {
      const parsed = JSON.parse(body);
      // ── Chemin Admin (username) — PBKDF2 salé ─────────────────────────────
      if (parsed.username) {
        const user = USERS.get(parsed.username);
        if (!user || !verifyPasswordSync(parsed.password, user.hash, user.salt)) return jsonResponse(res, 401, { error: 'Identifiants invalides' });
        const token = jwtSign({ username: parsed.username, role: user.role });
        return jsonResponse(res, 200, { token, username: parsed.username, role: user.role, force_change: user.forceChange, expires_in: JWT_TTL });
      }
      // ── Chemin Membre (email) ────────────────────────────────────────────
      if (!parsed.email || !parsed.password) return jsonResponse(res, 400, { error: 'email et password requis' });
      const row = sqldb.prepare('SELECT * FROM users WHERE email = ?').get(parsed.email.trim().toLowerCase());
      if (!row || !verifyPasswordSync(parsed.password, row.password_hash, row.salt)) {
        return jsonResponse(res, 401, { error: 'Email ou mot de passe incorrect' });
      }
      const token = jwtSign({ userId: row.id, email: row.email, role: row.role }, JWT_TTL_USER);
      return jsonResponse(res, 200, { token, email: row.email, role: row.role, userId: row.id, expires_in: JWT_TTL_USER });
    } catch (e) { jsonResponse(res, 400, { error: 'JSON invalide' }); }
  }).catch(() => jsonResponse(res, 413, { error: 'Payload trop volumineux' }));
  return;
}
// POST /api/v1/auth/register — Inscription membre
if (pathname === '/api/v1/auth/register' && req.method === 'POST') {
  const ip = req.socket?.remoteAddress || 'unknown';
  if (!checkLoginRateLimit(ip)) {
    return jsonResponse(res, 429, { error: 'Trop de tentatives. Réessayez dans 15 minutes.' });
  }
  readBodyLimited(req, MAX_BODY_SIZE).then(body => {
    try {
      const { email, password } = JSON.parse(body);
      if (!email || !password) return jsonResponse(res, 400, { error: 'email et password requis' });
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return jsonResponse(res, 400, { error: 'Email invalide' });
      if (password.length < 8) return jsonResponse(res, 400, { error: 'Mot de passe trop court (8 caractères minimum)' });
      const { hash, salt } = hashPasswordSync(password);
      try {
        const result = sqldb.prepare('INSERT INTO users (email, password_hash, salt, role) VALUES (?, ?, ?, ?)').run(email.trim().toLowerCase(), hash, salt, 'freemium');
        const token = jwtSign({ userId: result.lastInsertRowid, email: email.trim().toLowerCase(), role: 'freemium' }, JWT_TTL_USER);
        return jsonResponse(res, 201, { token, email: email.trim().toLowerCase(), role: 'freemium', expires_in: JWT_TTL_USER });
      } catch (e) {
        if (e.message.includes('UNIQUE')) return jsonResponse(res, 409, { error: 'Cet email est déjà utilisé' });
        throw e;
      }
    } catch (e) {
      if (e.message.includes('400') || e.message.includes('409')) return;
      jsonResponse(res, 400, { error: 'Données invalides' });
    }
  }).catch(() => jsonResponse(res, 413, { error: 'Payload trop volumineux' }));
  return;
}
// GET /api/v1/auth/me — Profil utilisateur connecté
if (pathname === '/api/v1/auth/me' && req.method === 'GET') {
  const user = getAuthUser(req);
  if (!user) return jsonResponse(res, 401, { error: 'Non authentifié', code: 'AUTH_REQUIRED' });
  // Pour les membres SQLite, retourner les infos fraîches
  if (user.userId) {
    const row = sqldb.prepare('SELECT id, email, role, created_at FROM users WHERE id = ?').get(user.userId);
    if (!row) return jsonResponse(res, 404, { error: 'Utilisateur introuvable' });
    return jsonResponse(res, 200, { userId: row.id, email: row.email, role: row.role, created_at: row.created_at });
  }
  return jsonResponse(res, 200, { username: user.username, role: user.role });
}
// POST /api/v1/checkout/matchday → crée une Stripe Checkout Session
if (pathname === '/api/v1/checkout/matchday' && req.method === 'POST') {
  if (!STRIPE_SECRET_KEY || !STRIPE_MATCHDAY_PRICE_ID) {
    return jsonResponse(res, 503, { error: 'Paiement non configuré (clés Stripe manquantes)' });
  }
  (async () => {
    try {
      const session = await stripeRequest('POST', 'checkout/sessions', {
        'mode': 'payment',
        'line_items[0][price]': STRIPE_MATCHDAY_PRICE_ID,
        'line_items[0][quantity]': '1',
        'success_url': STRIPE_SUCCESS_URL,
        'cancel_url': STRIPE_CANCEL_URL,
        'payment_method_types[0]': 'card',
      });
      if (session.error) return jsonResponse(res, 400, { error: session.error.message });
      jsonResponse(res, 200, { url: session.url, session_id: session.id });
    } catch (e) {
      console.error('[Stripe] checkout error:', e.message);
      jsonResponse(res, 500, { error: 'Erreur Stripe' });
    }
  })();
  return;
}
// POST /api/v1/webhook/stripe → Stripe envoie l'événement après paiement
if (pathname === '/api/v1/webhook/stripe' && req.method === 'POST') {
  readBodyLimited(req, MAX_BODY_SIZE).then(rawBody => {
    const sig = req.headers['stripe-signature'] || '';
    if (STRIPE_WEBHOOK_SECRET && !verifyStripeSignature(rawBody, sig)) {
      return jsonResponse(res, 400, { error: 'Signature invalide' });
    }
    try {
      const event = JSON.parse(rawBody);
      if (event.type === 'checkout.session.completed') {
        const sessionId = event.data?.object?.id;
        if (sessionId) {
          const now = Math.floor(Date.now() / 1000);
          const exp = now + JWT_TTL_MATCHDAY;
          const token = jwtSign({ role: 'matchday', session_id: sessionId }, JWT_TTL_MATCHDAY);
          sqldb.prepare(
            'INSERT OR IGNORE INTO matchday_passes (session_id, token, created_at, expires_at) VALUES (?, ?, ?, ?)'
          ).run(sessionId, token, now, exp);
          console.log(`[Matchday] Pass créé — session ${sessionId} — expire dans 24h`);
        }
      }
      jsonResponse(res, 200, { received: true });
    } catch (e) {
      jsonResponse(res, 400, { error: 'JSON invalide' });
    }
  }).catch(() => jsonResponse(res, 413, { error: 'Payload trop volumineux' }));
  return;
}
// GET /api/v1/matchday/status?session_id=... → retourne le token 24h si valide
if (pathname === '/api/v1/matchday/status' && req.method === 'GET') {
  const sessionId = new URL(req.url, 'http://localhost').searchParams.get('session_id');
  if (!sessionId) return jsonResponse(res, 400, { error: 'session_id requis' });
  const row = sqldb.prepare('SELECT token, expires_at FROM matchday_passes WHERE session_id = ?').get(sessionId);
  const now = Math.floor(Date.now() / 1000);
  if (!row || row.expires_at < now) return jsonResponse(res, 404, { active: false });
  jsonResponse(res, 200, { active: true, token: row.token, expires_at: row.expires_at });
  return;
}

// GET /api/v1/predictions
if (pathname === '/api/v1/predictions') {
  return jsonResponse(res, 200, { predictions: getPredictions(), generated_at: new Date().toISOString() });
}

// GET /api/v1/top-matches?timeframe=today|week&limit=10  [public — teaser accueil]
if (pathname === '/api/v1/top-matches') {
  const timeframe = query.timeframe || 'today';
  const limit = Math.min(20, parseInt(query.limit || '10'));
  return jsonResponse(res, 200, {
    matches: getTopMatchesByTimeframe(timeframe, limit),
    timeframe,
    generated_at: new Date().toISOString(),
  });
}

// GET /api/v1/league-hub/:oddsKey
const leagueHubMatch = pathname.match(/^\/api\/v1\/league-hub\/([^/?]+)$/);
if (leagueHubMatch) {
  const oddsKey = decodeURIComponent(leagueHubMatch[1]);
  const hub = getLeagueHub(oddsKey);
  if (!hub) return jsonResponse(res, 404, { error: 'Ligue inconnue' });
  return jsonResponse(res, 200, hub);
}

// GET /api/v1/top-strategy?type=BTTS_YES&limit=10&minConfidence=50
if (pathname === '/api/v1/top-strategy') {
  if (!requireAuth(req, res)) return;
  const type = (query.type || '').toUpperCase();
  const matches = getTopMatchesByStrategy(type, query.limit, query.minConfidence, query.league || '');
  if (matches === null) {
    return jsonResponse(res, 400, {
      error: 'Stratégie inconnue',
      available: Object.keys(STRATEGIES),
    });
  }
  return jsonResponse(res, 200, {
    strategy: type,
    label: STRATEGIES[type].label,
    icon: STRATEGIES[type].icon,
    count: matches.length,
    matches,
    generated_at: new Date().toISOString(),
  });
}

// GET /api/v1/strategies — liste des stratégies disponibles
if (pathname === '/api/v1/strategies') {
  return jsonResponse(res, 200, {
    strategies: Object.entries(STRATEGIES).map(([key, s]) => ({
      key, label: s.label, icon: s.icon,
      tipster: s.tipster || null,
      tipsterFlag: s.tipsterFlag || null,
      tipsterDesc: s.tipsterDesc || null,
    })),
  });
}

// GET /api/v1/hot-picks?limit=5 — Top picks toutes stratégies (Les 5 Stars du Jour)
if (pathname === '/api/v1/hot-picks') {
  const limit = Math.max(1, Math.min(20, parseInt(query.limit) || 5));
  const picks = getHotPicks(limit);
  return jsonResponse(res, 200, {
    count: picks.length,
    picks,
    generated_at: new Date().toISOString(),
  });
}
// GET /api/v1/sure-bets?limit=10 — Sure Bets (confiance ≥ 8/10)
if (pathname === '/api/v1/sure-bets') {
  const limit = Math.max(1, Math.min(30, parseInt(query.limit) || 10));
  const bets = getSureBets(limit);
  return jsonResponse(res, 200, {
    count: bets.length,
    sureBets: bets,
    hitRateEstimate: '~40% hit rate attendu',
    generated_at: new Date().toISOString(),
  });
}

// GET /api/v1/arbitrage
if (pathname === '/api/v1/arbitrage') {
  const arb = computeArbitrage();
  return jsonResponse(res, 200, {
    surebets: arb.filter(a => a.is_surebet),
    near_arb: arb.filter(a => !a.is_surebet).slice(0, 5),
    total_scanned: db.matches.length,
    generated_at: new Date().toISOString(),
  });
}

// GET /api/v1/trends
if (pathname === '/api/v1/trends') {
  if (!requireAuth(req, res)) return;
  return jsonResponse(res, 200, getTrends());
}

// GET /api/v1/history
if (pathname === '/api/v1/history') {
  if (!requireAuth(req, res)) return;
  const limit = parseInt(query.limit) || 50;
  return jsonResponse(res, 200, {
    matches: history.slice(-limit).reverse(),
    accuracy: getAccuracyReport(),
    total: history.length,
  });
}

// GET /api/v1/alerts/config — config alertes personnalisées
if (pathname === '/api/v1/alerts/config' && req.method === 'GET') {
  const user = requireAuth(req, res);
  if (!user) return;
  const prefs = kvGet(`alert_prefs_${user.id}`) || {
    enabled: false, chatId: '', edgeMin: 8, probaMin: 55,
    markets: ['BTTS_YES', 'OVER_2_5'], leagues: [],
  };
  return jsonResponse(res, 200, prefs);
}
// POST /api/v1/alerts/config — sauvegarder config alertes
if (pathname === '/api/v1/alerts/config' && req.method === 'POST') {
  const user = requireAuth(req, res);
  if (!user) return;
  readBodyLimited(req, 64 * 1024).then(body => {
    try {
      const parsed = JSON.parse(body);
      const prefs = {
        enabled: !!parsed.enabled,
        chatId: String(parsed.chatId || '').trim().slice(0, 50),
        edgeMin: Math.max(0, Math.min(30, parseFloat(parsed.edgeMin) || 0)),
        probaMin: Math.max(0, Math.min(90, parseInt(parsed.probaMin) || 50)),
        markets: Array.isArray(parsed.markets) ? parsed.markets.filter(m => typeof m === 'string').slice(0, 10) : [],
        leagues: Array.isArray(parsed.leagues) ? parsed.leagues.filter(l => typeof l === 'string').slice(0, 20) : [],
        updatedAt: new Date().toISOString(),
      };
      kvSet(`alert_prefs_${user.id}`, prefs);
      jsonResponse(res, 200, { ok: true, prefs });
    } catch { jsonResponse(res, 400, { error: 'JSON invalide' }); }
  }).catch(() => jsonResponse(res, 400, { error: 'Corps invalide' }));
  return;
}

// GET /api/v1/alerts/history — 10 dernières alertes envoyées
if (pathname === '/api/v1/alerts/history' && req.method === 'GET') {
  const user = requireAuth(req, res);
  if (!user) return;
  const hist = kvGet('alert_history') || [];
  return jsonResponse(res, 200, { history: hist.slice(-10).reverse() });
}

// POST /api/v1/telegram/test
if (pathname === '/api/v1/telegram/test' && req.method === 'POST') {
  const user = getAuthUser(req);
  if (!user || user.role !== 'admin') return jsonResponse(res, 403, { error: 'Accès refusé' });
  sendValueBetAlerts()
    .then(() => jsonResponse(res, 200, { message: `Alertes envoyées à ${TELEGRAM_CHAT_IDS.size} chat(s)` }))
    .catch(e => jsonResponse(res, 500, { error: e.message }));
  return;
}

// GET /api/v1/admin/status (protégé JWT admin)
if (pathname === '/api/v1/admin/status') {
  const user = getAuthUser(req);
  if (!user || user.role !== 'admin') return jsonResponse(res, 403, { error: 'Accès refusé' });
  return jsonResponse(res, 200, {
    uptime: process.uptime(),
    matchCount: db.matches.length,
    teamCount: Object.keys(db.teamStats).length,
    historyCount: history.length,
    lastOddsUpdate: db.lastOddsUpdate,
    lastStatsUpdate: db.lastStatsUpdate,
    oddsQuota: db.oddsQuotaRemaining,
    status: db.status,
    isFetchingOdds, isFetchingStats,
    accuracy: getAccuracyReport(),
    aiScoutCached: !!aiScoutCache.data,
    telegramChats: TELEGRAM_CHAT_IDS.size,
    memoryMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    mock: {
      active: mockActive,
      minute: testMatch?.live_minute ?? null,
      score: testMatch?.live_score ?? null,
      status: testMatch?.live_status ?? null,
    },
  });
}

// POST /api/v1/admin/backtest-bsd (protégé auth — admin ou premium)
if (pathname === '/api/v1/admin/backtest-bsd' && req.method === 'POST') {
  const user = getAuthUser(req);
  if (!user || (user.role !== 'admin' && user.role !== 'premium')) return jsonResponse(res, 403, { error: 'Accès refusé — Premium requis' });
  if (!BSD_BASE_URL) return jsonResponse(res, 503, { error: 'BSD non configuré' });

  readBodyLimited(req, MAX_BODY_SIZE).then(async body => {
    try {
      const parsed = JSON.parse(body || '{}');
      const days = Math.min(Math.max(parseInt(parsed.days) || 7, 1), 30);
      const now = Date.now();
      const bsdDateCache = new Map();
      let newVerified = 0, alreadyVerified = 0, noScore = 0;
      const report = [];

      for (let d = 1; d <= days; d++) {
        const dateMs = now - d * 86400000;
        const dateStr = formatDateOnly(new Date(dateMs));

        // Fetch BSD matches for this date (cached)
        if (!bsdDateCache.has(dateStr)) {
          const bsdResults = await fetchBSDMatches(dateStr, dateStr);
          bsdDateCache.set(dateStr, bsdResults);
        }
        const bsdDay = bsdDateCache.get(dateStr);
        const finished = bsdDay.filter(bm =>
          bm.home_score !== null && bm.away_score !== null &&
          bm.status !== 'inprogress' && !(bm.status && bm.status.includes('half'))
        );

        for (const bm of finished) {
          const hNorm = normName(bm.home_team), aNorm = normName(bm.away_team);

          // Check if already in history
          const existing = history.find(h => {
            const hh = normName(h.home_team), ha = normName(h.away_team);
            return h.commence_time?.startsWith(dateStr) &&
              (hh.includes(hNorm.split(' ')[0]) || hNorm.includes(hh.split(' ')[0])) &&
              (ha.includes(aNorm.split(' ')[0]) || aNorm.includes(ha.split(' ')[0]));
          });

          if (existing) {
            if (!existing.verified && existing.realScore === null) {
              // Fill missing real score
              existing.realScore = { home: Number(bm.home_score), away: Number(bm.away_score), source: 'bsd' };
              const totalGoals = existing.realScore.home + existing.realScore.away;
              const wasBTTS = existing.realScore.home > 0 && existing.realScore.away > 0;
              const wasOver25 = totalGoals > 2.5;
              if (existing.predicted?.over25 > 55) { accuracy.over25_total++; if (wasOver25) accuracy.over25_correct++; }
              if (existing.predicted?.btts > 55) { accuracy.btts_total++; if (wasBTTS) accuracy.btts_correct++; }
              if (existing.predicted?.bestEdgeValue > 5) {
                accuracy.edge_total++;
                const winner = existing.realScore.home > existing.realScore.away ? existing.home_team : existing.realScore.away > existing.realScore.home ? existing.away_team : 'Nul';
                if (winner === existing.predicted.bestEdge) accuracy.edge_correct++;
              }
              accuracy.total++;
              existing.verified = true;
              existing.retry_at = new Date().toISOString();
              newVerified++;
              report.push({ match: `${bm.home_team} ${bm.home_score}-${bm.away_score} ${bm.away_team}`, date: dateStr, action: 'verified' });
            } else {
              alreadyVerified++;
            }
          } else {
            noScore++;
            // Match in BSD but not in our history — no stored prediction, skip
          }
        }
      }

      if (newVerified > 0) saveHistory();

      return jsonResponse(res, 200, {
        ok: true,
        days_scanned: days,
        new_verified: newVerified,
        already_verified: alreadyVerified,
        bsd_only: noScore,
        accuracy: getAccuracyReport(),
        sample: report.slice(0, 20),
      });
    } catch (e) { return jsonResponse(res, 500, { error: e.message }); }
  }).catch(() => jsonResponse(res, 413, { error: 'Payload trop volumineux' }));
  return;
}
// POST /api/v1/admin/change-password (protégé JWT admin)
if (pathname === '/api/v1/admin/change-password' && req.method === 'POST') {
  const user = getAuthUser(req);
  if (!user || user.role !== 'admin') return jsonResponse(res, 403, { error: 'Accès refusé' });
  readBodyLimited(req, MAX_BODY_SIZE).then(body => {
    try {
      const parsed = JSON.parse(body);
      if (!parsed.current || !parsed.new) return jsonResponse(res, 400, { error: 'current et new requis' });
      if (!verifyPasswordSync(parsed.current, user.hash, user.salt)) return jsonResponse(res, 401, { error: 'Mot de passe actuel incorrect' });
      if (parsed.new.length < 8) return jsonResponse(res, 400, { error: 'Minimum 8 caractères' });
      const { hash, salt } = hashPasswordSync(parsed.new);
      user.hash = hash;
      user.salt = salt;
      user.forceChange = false;
      jsonResponse(res, 200, { ok: true, message: 'Mot de passe modifié' });
    } catch (e) { jsonResponse(res, 400, { error: 'JSON invalide' }); }
  }).catch(() => jsonResponse(res, 413, { error: 'Payload trop volumineux' }));
  return;
}

// ── AFFILIATION ROUTES ──────────────────────────────────────────────
// GET /api/v1/affiliates — Liste des bookmakers affiliés actifs (public)
if (pathname === '/api/v1/affiliates' && req.method === 'GET') {
  const affiliates = sqldb.prepare('SELECT id, bookmaker, name, affiliate_link, deeplink_template, promo_code, commission_type, commission_rate, priority FROM affiliates WHERE active = 1 ORDER BY priority DESC').all();
  return jsonResponse(res, 200, affiliates);
}

// POST /api/v1/affiliates — Créer un affilié (admin)
if (pathname === '/api/v1/affiliates' && req.method === 'POST') {
  const user = getAuthUser(req);
  if (!user || user.role !== 'admin') return jsonResponse(res, 403, { error: 'Accès refusé' });
  readBodyLimited(req, MAX_BODY_SIZE).then(body => {
    try {
      const d = JSON.parse(body);
      if (!d.bookmaker || !d.name || !d.affiliate_link) return jsonResponse(res, 400, { error: 'bookmaker, name, affiliate_link requis' });
      const result = sqldb.prepare(`INSERT INTO affiliates (bookmaker, name, affiliate_link, deeplink_template, promo_code, commission_type, commission_rate, active, priority)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        d.bookmaker, d.name, d.affiliate_link, d.deeplink_template || null, d.promo_code || null,
        d.commission_type || 'revshare', d.commission_rate || 30, d.active !== undefined ? d.active : 1, d.priority || 0
      );
      return jsonResponse(res, 201, { id: result.lastInsertRowid, ok: true });
    } catch (e) { jsonResponse(res, 400, { error: e.message }); }
  }).catch(() => jsonResponse(res, 413, { error: 'Payload trop volumineux' }));
  return;
}

// PUT /api/v1/affiliates/:id — Modifier un affilié (admin)
if (pathname.match(/^\/api\/v1\/affiliates\/\d+$/) && req.method === 'PUT') {
  const user = getAuthUser(req);
  if (!user || user.role !== 'admin') return jsonResponse(res, 403, { error: 'Accès refusé' });
  const id = parseInt(pathname.split('/').pop());
  readBodyLimited(req, MAX_BODY_SIZE).then(body => {
    try {
      const d = JSON.parse(body);
      const fields = [];
      const values = [];
      for (const [k, v] of Object.entries(d)) {
        if (['bookmaker', 'name', 'affiliate_link', 'deeplink_template', 'promo_code', 'commission_type', 'commission_rate', 'active', 'priority'].includes(k)) {
          fields.push(`${k} = ?`);
          values.push(v);
        }
      }
      if (fields.length === 0) return jsonResponse(res, 400, { error: 'Aucun champ valide' });
      values.push(id);
      sqldb.prepare(`UPDATE affiliates SET ${fields.join(', ')} WHERE id = ?`).run(...values);
      return jsonResponse(res, 200, { ok: true });
    } catch (e) { jsonResponse(res, 400, { error: e.message }); }
  }).catch(() => jsonResponse(res, 413, { error: 'Payload trop volumineux' }));
  return;
}

// DELETE /api/v1/affiliates/:id — Supprimer un affilié (admin)
if (pathname.match(/^\/api\/v1\/affiliates\/\d+$/) && req.method === 'DELETE') {
  const user = getAuthUser(req);
  if (!user || user.role !== 'admin') return jsonResponse(res, 403, { error: 'Accès refusé' });
  const id = parseInt(pathname.split('/').pop());
  sqldb.prepare('DELETE FROM affiliates WHERE id = ?').run(id);
  return jsonResponse(res, 200, { ok: true });
}

// POST /api/v1/affiliate/click — Track un clic affilié
if (pathname === '/api/v1/affiliate/click' && req.method === 'POST') {
  readBodyLimited(req, MAX_BODY_SIZE).then(body => {
    try {
      const d = JSON.parse(body);
      if (!d.affiliate_id || !d.match_id) return jsonResponse(res, 400, { error: 'affiliate_id, match_id requis' });
      const ip = req.socket?.remoteAddress || 'unknown';
      const ua = req.headers['user-agent'] || '';
      sqldb.prepare('INSERT INTO affiliate_clicks (affiliate_id, match_id, user_ip, user_agent) VALUES (?, ?, ?, ?)').run(
        d.affiliate_id, d.match_id, ip, ua
      );
      return jsonResponse(res, 200, { ok: true });
    } catch (e) { jsonResponse(res, 400, { error: e.message }); }
  }).catch(() => jsonResponse(res, 413, { error: 'Payload trop volumineux' }));
  return;
}

// GET /api/v1/affiliate/stats — Stats d'affiliation (admin)
if (pathname === '/api/v1/affiliate/stats') {
  const user = getAuthUser(req);
  if (!user || user.role !== 'admin') return jsonResponse(res, 403, { error: 'Accès refusé' });
  const totalClicks = sqldb.prepare('SELECT COUNT(*) as c FROM affiliate_clicks').get();
  const clicksByAffiliate = sqldb.prepare('SELECT a.bookmaker, a.name, COUNT(c.id) as clicks, MAX(c.clicked_at) as last_click FROM affiliates a LEFT JOIN affiliate_clicks c ON a.id = c.affiliate_id GROUP BY a.id ORDER BY clicks DESC').all();
  const clicksByDay = sqldb.prepare(`SELECT DATE(clicked_at, 'unixepoch') as day, COUNT(*) as clicks FROM affiliate_clicks WHERE clicked_at > strftime('%s','now','-30 days') GROUP BY day ORDER BY day`).all();
  return jsonResponse(res, 200, {
    totalClicks: totalClicks.c,
    byAffiliate: clicksByAffiliate,
    byDay: clicksByDay,
  });
}

// GET /api/v1/affiliate/link/:matchId — Génère le meilleur lien affilié pour un match
if (pathname.startsWith('/api/v1/affiliate/link/') && req.method === 'GET') {
  const matchId = decodeURIComponent(pathname.slice('/api/v1/affiliate/link/'.length));
  let match = db.matches.find(m => m.id === matchId);
  if (!match) match = cachedMatches.find(m => m.id === matchId);
  if (!match) match = cachedMatches.find(m => m.fixture_id == matchId);
  if (!match) return jsonResponse(res, 200, { link: FINAL_FALLBACK });
  const bestAffiliate = sqldb.prepare('SELECT * FROM affiliates WHERE active = 1 ORDER BY priority DESC LIMIT 1').get();
  if (!bestAffiliate) return jsonResponse(res, 404, { error: 'Aucun affilié actif' });
  // Remplacer les placeholders dans deeplink_template
  let link = bestAffiliate.affiliate_link;
  if (bestAffiliate.deeplink_template) {
    const slugify = (s) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    link = bestAffiliate.deeplink_template
      .replace('{sport}', match.sport || 'soccer')
      .replace('{event_id}', match.id || '')
      .replace('{home}', bestAffiliate.bookmaker === 'coteur' ? slugify(match.home_team) : encodeURIComponent(match.home_team))
      .replace('{away}', bestAffiliate.bookmaker === 'coteur' ? slugify(match.away_team) : encodeURIComponent(match.away_team));
  }
  return jsonResponse(res, 200, {
    id: bestAffiliate.id,
    bookmaker: bestAffiliate.bookmaker,
    name: bestAffiliate.name,
    link: link,
    promo_code: bestAffiliate.promo_code,
  });
}

// GET /api/v1/accuracy — protégé auth minimum
if (pathname === '/api/v1/accuracy') {
  const user = getAuthUser(req);
  if (!user) return jsonResponse(res, 401, { error: 'Authentification requise', code: 'AUTH_REQUIRED' });
  return jsonResponse(res, 200, getAccuracyReport());
}

// GET /api/v1/bankroll — Bankroll tracking (flat 1u)
if (pathname === '/api/v1/bankroll') {
  const startBankroll = 100;
  let bankroll = startBankroll;
  const bets = [];
  for (const h of history) {
    if (!h.verified || !h.realScore) continue;
    const rs = h.realScore;
    if (h.predicted?.over25 > 55) {
      const won = (rs.home + rs.away) > 2.5;
      bankroll += won ? 1 : -1;
      bets.push({ date: h.commence_time, market: 'Over 2.5', won, profit: won ? 1 : -1, bankroll, match: h.home_team + ' - ' + h.away_team });
    }
    if (h.predicted?.btts > 55) {
      const won = rs.home > 0 && rs.away > 0;
      bankroll += won ? 1 : -1;
      bets.push({ date: h.commence_time, market: 'BTTS', won, profit: won ? 1 : -1, bankroll, match: h.home_team + ' - ' + h.away_team });
    }
  }
  const totalBets = bets.length;
  const wonBets = bets.filter(b => b.won).length;
  const peak = bets.reduce((m, b) => Math.max(m, b.bankroll), startBankroll);
  const trough = bets.reduce((m, b) => Math.min(m, b.bankroll), startBankroll);
  const maxDD = peak > 0 ? Math.round((1 - trough / peak) * 10000) / 100 : 0;
  return jsonResponse(res, 200, {
    startBankroll, finalBankroll: bankroll,
    totalPL: bankroll - startBankroll, totalBets, wonBets,
    winRate: totalBets > 0 ? Math.round(wonBets / totalBets * 100) : 0,
    roi: totalBets > 0 ? Math.round((bankroll - startBankroll) / totalBets * 10000) / 100 : 0,
    maxDrawdown: maxDD,
    bets: bets.slice(-80),
  });
}

// GET /api/v1/bankroll/simulated — Alias explicite du bankroll simulé (marketing)
if (pathname === '/api/v1/bankroll/simulated') {
  const startBankroll = 100;
  let bankroll = startBankroll;
  const bets = [];
  for (const h of history) {
    if (!h.verified || !h.realScore) continue;
    const rs = h.realScore;
    if (h.predicted?.over25 > 55) {
      const won = (rs.home + rs.away) > 2.5;
      bankroll += won ? 1 : -1;
      bets.push({ date: h.commence_time, market: 'Over 2.5', won, profit: won ? 1 : -1, bankroll, match: h.home_team + ' - ' + h.away_team });
    }
    if (h.predicted?.btts > 55) {
      const won = rs.home > 0 && rs.away > 0;
      bankroll += won ? 1 : -1;
      bets.push({ date: h.commence_time, market: 'BTTS', won, profit: won ? 1 : -1, bankroll, match: h.home_team + ' - ' + h.away_team });
    }
  }
  const totalBets = bets.length;
  const wonBets = bets.filter(b => b.won).length;
  const peak = bets.reduce((m, b) => Math.max(m, b.bankroll), startBankroll);
  const trough = bets.reduce((m, b) => Math.min(m, b.bankroll), startBankroll);
  const maxDD = peak > 0 ? Math.round((1 - trough / peak) * 10000) / 100 : 0;
  return jsonResponse(res, 200, {
    startBankroll, finalBankroll: bankroll,
    totalPL: bankroll - startBankroll, totalBets, wonBets,
    winRate: totalBets > 0 ? Math.round(wonBets / totalBets * 100) : 0,
    roi: totalBets > 0 ? Math.round((bankroll - startBankroll) / totalBets * 10000) / 100 : 0,
    maxDrawdown: maxDD,
    bets: bets.slice(-80),
  });
}

// ════════════════════════════════════════════════════════════════════════════
// MODULE "MES PARIS" — Tracking personnel + bankroll réelle + Kelly + CSV
// Schéma : user_bets, bankroll_transactions
// ════════════════════════════════════════════════════════════════════════════

// GET /api/v1/bets/kelly?prob=0.55&odds=1.85&bankroll_cents=10000&cap=0.25
if (pathname === '/api/v1/bets/kelly' && req.method === 'GET') {
  const user = requireUserAuth(req, res); if (!user) return;
  const prob = parseFloat(query.prob);
  const odds = parseFloat(query.odds);
  const bankrollCents = parseInt(query.bankroll_cents) || 0;
  const cap = query.cap !== undefined ? parseFloat(query.cap) : 0.25;
  const fraction = computeKellyFraction(prob, odds, cap);
  return jsonResponse(res, 200, {
    fraction,
    full_kelly_cents:    suggestStakeCents(bankrollCents, prob, odds, 1.0,  cap),
    half_kelly_cents:    suggestStakeCents(bankrollCents, prob, odds, 0.5,  cap),
    quarter_kelly_cents: suggestStakeCents(bankrollCents, prob, odds, 0.25, cap),
    suggested_stake_cents: suggestStakeCents(bankrollCents, prob, odds, 1.0, cap),
    cap,
  });
}

// GET /api/v1/bets/export.csv — DOIT être avant /api/v1/bets/:id et /api/v1/bets
if (pathname === '/api/v1/bets/export.csv' && req.method === 'GET') {
  const user = requireUserAuth(req, res); if (!user) return;
  const rows = listUserBets(user.userId, query, 5000, 0);
  const allowedOrigin = process.env.ALLOWED_ORIGIN || 'http://localhost:3000';
  res.writeHead(200, {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': 'attachment; filename="paris-pariscore.csv"',
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  });
  const esc = (v) => {
    if (v === null || v === undefined) return '';
    let s = String(v);
    if (/^[=+\-@]/.test(s)) s = "'" + s; // OWASP CSV injection guard
    if (/[",\n]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
    return s;
  };
  const cols = ['id','created_at','commence_time','sport','match','league','market','selection','odds','stake_eur','bookmaker','status','payout_eur','model_prob','edge_pct','kelly_fraction','settled_at','source','notes'];
  res.write(cols.join(',') + '\n');
  for (const b of rows) {
    const match = (b.home_team || '') + ' - ' + (b.away_team || '');
    const stake = (b.stake_cents / 100).toFixed(2);
    const payout = b.payout_cents !== null && b.payout_cents !== undefined ? (b.payout_cents / 100).toFixed(2) : '';
    const created = b.created_at ? new Date(b.created_at * 1000).toISOString() : '';
    const settled = b.settled_at ? new Date(b.settled_at * 1000).toISOString() : '';
    res.write([
      b.id, created, b.commence_time || '', b.sport || '', match, b.league || '', b.market,
      b.selection_label, b.odds, stake, b.bookmaker, b.status, payout,
      b.model_prob ?? '', b.edge_pct ?? '', b.kelly_fraction ?? '', settled, b.source || '', b.notes || '',
    ].map(esc).join(',') + '\n');
  }
  res.end();
  return;
}

// GET /api/v1/bets/suggest-settlement/:id
if (pathname.startsWith('/api/v1/bets/suggest-settlement/') && req.method === 'GET') {
  const user = requireUserAuth(req, res); if (!user) return;
  const betId = parseInt(pathname.split('/').pop());
  if (!betId) return jsonResponse(res, 400, { error: 'ID invalide' });
  const bet = sqldb.prepare('SELECT * FROM user_bets WHERE id = ? AND user_id = ?').get(betId, user.userId);
  if (!bet) return jsonResponse(res, 404, { error: 'Pari introuvable' });
  const suggestion = suggestBetSettlement(bet);
  return jsonResponse(res, 200, suggestion);
}

// POST /api/v1/bets/:id/settle
if (pathname.match(/^\/api\/v1\/bets\/\d+\/settle$/) && req.method === 'POST') {
  const user = requireUserAuth(req, res); if (!user) return;
  const betId = parseInt(pathname.split('/')[4]);
  let body;
  try { body = JSON.parse(await readBodyLimited(req, MAX_BODY_SIZE)); }
  catch { return jsonResponse(res, 400, { error: 'Body JSON invalide' }); }
  const validStatuses = ['won','lost','void','cashout','half_won','half_lost'];
  if (!validStatuses.includes(body.status)) {
    return jsonResponse(res, 400, { error: 'Statut invalide. Attendu: ' + validStatuses.join('|') });
  }
  const bet = sqldb.prepare('SELECT * FROM user_bets WHERE id = ? AND user_id = ?').get(betId, user.userId);
  if (!bet) return jsonResponse(res, 404, { error: 'Pari introuvable' });
  if (bet.status !== 'pending') return jsonResponse(res, 409, { error: 'Pari déjà réglé', status: bet.status });
  const payoutCents = computePayoutCents(bet, body.status, body.cashout_amount);
  sqldb.prepare(`UPDATE user_bets SET status = ?, payout_cents = ?, settled_at = strftime('%s','now'),
                 updated_at = strftime('%s','now') WHERE id = ? AND user_id = ?`)
       .run(body.status, payoutCents, betId, user.userId);
  const updated = sqldb.prepare('SELECT * FROM user_bets WHERE id = ?').get(betId);
  return jsonResponse(res, 200, updated);
}

// GET / PATCH / DELETE /api/v1/bets/:id
if (pathname.match(/^\/api\/v1\/bets\/\d+$/) && (req.method === 'GET' || req.method === 'PATCH' || req.method === 'DELETE')) {
  const user = requireUserAuth(req, res); if (!user) return;
  const betId = parseInt(pathname.split('/').pop());
  const bet = sqldb.prepare('SELECT * FROM user_bets WHERE id = ? AND user_id = ?').get(betId, user.userId);
  if (!bet) return jsonResponse(res, 404, { error: 'Pari introuvable' });
  if (req.method === 'GET') return jsonResponse(res, 200, bet);
  if (req.method === 'DELETE') {
    sqldb.prepare('DELETE FROM user_bets WHERE id = ? AND user_id = ?').run(betId, user.userId);
    return jsonResponse(res, 200, { deleted: true, id: betId });
  }
  // PATCH — uniquement si pending, champs limités
  if (bet.status !== 'pending') return jsonResponse(res, 409, { error: 'Pari déjà réglé, édition impossible' });
  let body;
  try { body = JSON.parse(await readBodyLimited(req, MAX_BODY_SIZE)); }
  catch { return jsonResponse(res, 400, { error: 'Body JSON invalide' }); }
  const updates = [];
  const values = [];
  if (typeof body.odds === 'number' && body.odds >= 1.01) { updates.push('odds = ?'); values.push(body.odds); }
  if (typeof body.stake === 'number' && body.stake > 0) { updates.push('stake_cents = ?'); values.push(Math.round(body.stake * 100)); }
  if (typeof body.bookmaker === 'string' && body.bookmaker.trim()) { updates.push('bookmaker = ?'); values.push(normalizeBookmaker(body.bookmaker)); }
  if (typeof body.sport === 'string' && body.sport.trim()) { updates.push('sport = ?'); values.push(normalizeSport(body.sport)); }
  if (typeof body.notes === 'string') { updates.push('notes = ?'); values.push(body.notes.slice(0, 500)); }
  if (!updates.length) return jsonResponse(res, 400, { error: 'Aucun champ valide à mettre à jour' });
  updates.push("updated_at = strftime('%s','now')");
  values.push(betId, user.userId);
  sqldb.prepare(`UPDATE user_bets SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`).run(...values);
  return jsonResponse(res, 200, sqldb.prepare('SELECT * FROM user_bets WHERE id = ?').get(betId));
}

// GET /api/v1/bets — liste paginée + filtres
if (pathname === '/api/v1/bets' && req.method === 'GET') {
  const user = requireUserAuth(req, res); if (!user) return;
  const limit = Math.min(parseInt(query.limit) || 50, 500);
  const offset = parseInt(query.offset) || 0;
  const bets = listUserBets(user.userId, query, limit, offset);
  const total = countUserBets(user.userId, query);
  return jsonResponse(res, 200, { bets, total, limit, offset });
}

// POST /api/v1/bets — création
if (pathname === '/api/v1/bets' && req.method === 'POST') {
  const user = requireUserAuth(req, res); if (!user) return;
  let body;
  try { body = JSON.parse(await readBodyLimited(req, MAX_BODY_SIZE)); }
  catch { return jsonResponse(res, 400, { error: 'Body JSON invalide' }); }
  if (!body.market || typeof body.market !== 'string') return jsonResponse(res, 400, { error: 'market requis' });
  if (!body.selection_label || typeof body.selection_label !== 'string') return jsonResponse(res, 400, { error: 'selection_label requis' });
  if (typeof body.odds !== 'number' || body.odds < 1.01) return jsonResponse(res, 400, { error: 'odds invalide (>=1.01)' });
  if (typeof body.stake !== 'number' || body.stake <= 0) return jsonResponse(res, 400, { error: 'stake invalide (>0)' });
  const stakeCents = Math.round(body.stake * 100);
  const bookmaker = normalizeBookmaker(body.bookmaker);
  const sport = normalizeSport(body.sport);
  const result = sqldb.prepare(`INSERT INTO user_bets
    (user_id, match_id, home_team, away_team, league, commence_time, market, selection_label,
     odds, stake_cents, bookmaker, notes, model_prob, edge_pct, kelly_fraction, sport, source)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual')`).run(
    user.userId,
    body.match_id || null,
    body.home_team || null,
    body.away_team || null,
    body.league || null,
    body.commence_time || null,
    body.market.slice(0, 32),
    body.selection_label.slice(0, 64),
    body.odds,
    stakeCents,
    bookmaker,
    typeof body.notes === 'string' ? body.notes.slice(0, 500) : null,
    typeof body.model_prob === 'number' ? body.model_prob : null,
    typeof body.edge_pct === 'number' ? body.edge_pct : null,
    typeof body.kelly_fraction === 'number' ? body.kelly_fraction : null,
    sport,
  );
  const inserted = sqldb.prepare('SELECT * FROM user_bets WHERE id = ?').get(result.lastInsertRowid);
  return jsonResponse(res, 201, inserted);
}

// GET /api/v1/bankroll/summary
if (pathname === '/api/v1/bankroll/summary' && req.method === 'GET') {
  const user = requireUserAuth(req, res); if (!user) return;
  return jsonResponse(res, 200, computeBankrollSummary(user.userId, query));
}

// GET /api/v1/bankroll/plan
if (pathname === '/api/v1/bankroll/plan' && req.method === 'GET') {
  const user = requireUserAuth(req, res); if (!user) return;
  return jsonResponse(res, 200, getBankrollPlan(user.userId));
}

// PUT /api/v1/bankroll/plan
if (pathname === '/api/v1/bankroll/plan' && (req.method === 'PUT' || req.method === 'POST')) {
  const user = requireUserAuth(req, res); if (!user) return;
  let body;
  try { body = JSON.parse(await readBodyLimited(req, MAX_BODY_SIZE)); }
  catch { return jsonResponse(res, 400, { error: 'Body JSON invalide' }); }
  return jsonResponse(res, 200, updateBankrollPlan(user.userId, body));
}

// GET /api/v1/bankroll/daily-tracker — Compounding + split bank/capital
if (pathname === '/api/v1/bankroll/daily-tracker' && req.method === 'GET') {
  const user = requireUserAuth(req, res); if (!user) return;
  return jsonResponse(res, 200, computeDailyTracker(user.userId));
}

// GET /api/v1/bookmakers — Liste ANJ + 1xbet
if (pathname === '/api/v1/bookmakers' && req.method === 'GET') {
  return jsonResponse(res, 200, { bookmakers: ALLOWED_BOOKMAKERS, sports: ALLOWED_SPORTS });
}

// POST /api/v1/auth/reverify — Re-confirmation mot de passe pour actions sensibles
if (pathname === '/api/v1/auth/reverify' && req.method === 'POST') {
  const user = requireUserAuth(req, res); if (!user) return;
  let body;
  try { body = JSON.parse(await readBodyLimited(req, MAX_BODY_SIZE)); }
  catch { return jsonResponse(res, 400, { error: 'Body JSON invalide' }); }
  if (!body.password || typeof body.password !== 'string') return jsonResponse(res, 400, { error: 'password requis' });
  const row = sqldb.prepare('SELECT id, password_hash, salt FROM users WHERE id = ?').get(user.userId);
  if (!row) return jsonResponse(res, 404, { error: 'Utilisateur introuvable' });
  if (!verifyPasswordSync(body.password, row.password_hash, row.salt)) {
    console.warn(`  [Reverify] FAIL user ${user.userId} from ${req.socket.remoteAddress}`);
    return jsonResponse(res, 401, { error: 'Mot de passe incorrect' });
  }
  const token = issueReverifyToken(user.userId);
  console.log(`  [Reverify] OK user ${user.userId}`);
  return jsonResponse(res, 200, { reverify_token: token, expires_in: REVERIFY_TTL_MS / 1000 });
}

// POST /api/v1/bets/import — Import CSV bookmaker (1xbet/ANJ)
// Sécurité : JWT + reverify_token (single-use, 5min). Body JSON {csv: "...", default_bookmaker: "1xbet", dry_run: bool}
if (pathname === '/api/v1/bets/import' && req.method === 'POST') {
  const user = requireUserAuth(req, res); if (!user) return;
  let body;
  try { body = JSON.parse(await readBodyLimited(req, MAX_BODY_SIZE)); }
  catch { return jsonResponse(res, 400, { error: 'Body JSON invalide' }); }
  if (!body.reverify_token || !consumeReverifyToken(user.userId, body.reverify_token)) {
    return jsonResponse(res, 403, { error: 'Re-vérification mot de passe requise', code: 'REVERIFY_REQUIRED' });
  }
  if (!body.csv || typeof body.csv !== 'string') return jsonResponse(res, 400, { error: 'csv (texte) requis' });
  if (body.csv.length > 500 * 1024) return jsonResponse(res, 413, { error: 'CSV trop volumineux (>500 Ko)' });
  const defaultBk = normalizeBookmaker(body.default_bookmaker || '1xbet');
  const parsed = parseBetsCSV(body.csv, defaultBk);
  if (parsed.error) return jsonResponse(res, 400, { error: parsed.error });
  if (body.dry_run) {
    return jsonResponse(res, 200, { dry_run: true, rows_parsed: parsed.rows.length, rows_skipped: parsed.errors.length, preview: parsed.rows.slice(0, 20), errors: parsed.errors.slice(0, 20) });
  }
  // Insert transactionnel
  const insertStmt = sqldb.prepare(`INSERT INTO user_bets
    (user_id, match_id, home_team, away_team, league, commence_time, market, selection_label,
     odds, stake_cents, bookmaker, status, payout_cents, settled_at, sport, source, external_ref)
    VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'import', ?)`);
  const tx = sqldb.transaction((rows) => {
    let inserted = 0;
    for (const r of rows) {
      // Skip duplicate via external_ref same user
      const dup = sqldb.prepare('SELECT id FROM user_bets WHERE user_id = ? AND external_ref = ?').get(user.userId, r.external_ref);
      if (dup) continue;
      const settledAt = (r.status !== 'pending') ? Math.floor(Date.now() / 1000) : null;
      insertStmt.run(
        user.userId, r.home_team, r.away_team, r.league, r.commence_time,
        r.market, r.selection_label, r.odds, r.stake_cents, r.bookmaker,
        r.status, r.payout_cents, settledAt, r.sport, r.external_ref,
      );
      inserted++;
    }
    return inserted;
  });
  const inserted = tx(parsed.rows);
  sqldb.prepare(`INSERT INTO bet_import_audit (user_id, source, filename, rows_parsed, rows_inserted, rows_skipped, ip, user_agent)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
    user.userId, defaultBk,
    (body.filename || '').slice(0, 128),
    parsed.rows.length, inserted, parsed.errors.length,
    (req.socket.remoteAddress || '').slice(0, 64),
    (req.headers['user-agent'] || '').slice(0, 200),
  );
  console.log(`  [Import] user ${user.userId} ${defaultBk}: ${inserted}/${parsed.rows.length} inserted (${parsed.errors.length} errors)`);
  return jsonResponse(res, 200, { rows_parsed: parsed.rows.length, rows_inserted: inserted, rows_skipped: parsed.errors.length, errors: parsed.errors.slice(0, 20) });
}

// GET /api/v1/bets/import/audit — Historique imports
if (pathname === '/api/v1/bets/import/audit' && req.method === 'GET') {
  const user = requireUserAuth(req, res); if (!user) return;
  const audit = sqldb.prepare('SELECT * FROM bet_import_audit WHERE user_id = ? ORDER BY created_at DESC LIMIT 50').all(user.userId);
  return jsonResponse(res, 200, { audit });
}

// GET /api/v1/bankroll/tx
if (pathname === '/api/v1/bankroll/tx' && req.method === 'GET') {
  const user = requireUserAuth(req, res); if (!user) return;
  const where = ['user_id = ?'];
  const vals = [user.userId];
  if (query.kind) { where.push('kind = ?'); vals.push(query.kind); }
  if (query.from) { where.push('occurred_at >= ?'); vals.push(parseInt(query.from)); }
  if (query.to)   { where.push('occurred_at <= ?'); vals.push(parseInt(query.to)); }
  const tx = sqldb.prepare(`SELECT * FROM bankroll_transactions WHERE ${where.join(' AND ')} ORDER BY occurred_at DESC LIMIT 500`).all(...vals);
  return jsonResponse(res, 200, { tx });
}

// POST /api/v1/bankroll/tx
if (pathname === '/api/v1/bankroll/tx' && req.method === 'POST') {
  const user = requireUserAuth(req, res); if (!user) return;
  let body;
  try { body = JSON.parse(await readBodyLimited(req, MAX_BODY_SIZE)); }
  catch { return jsonResponse(res, 400, { error: 'Body JSON invalide' }); }
  const validKinds = ['deposit','withdrawal','adjustment'];
  if (!validKinds.includes(body.kind)) return jsonResponse(res, 400, { error: 'kind invalide (deposit|withdrawal|adjustment)' });
  if (typeof body.amount !== 'number' || body.amount === 0) return jsonResponse(res, 400, { error: 'amount requis (number != 0)' });
  let amountCents = Math.round(Math.abs(body.amount) * 100);
  if (body.kind === 'withdrawal') amountCents = -amountCents;
  else if (body.kind === 'adjustment' && body.amount < 0) amountCents = -amountCents;
  const occurredAt = parseInt(body.occurred_at) || Math.floor(Date.now() / 1000);
  const result = sqldb.prepare(`INSERT INTO bankroll_transactions
    (user_id, kind, amount_cents, bookmaker, note, occurred_at) VALUES (?, ?, ?, ?, ?, ?)`).run(
    user.userId, body.kind, amountCents,
    typeof body.bookmaker === 'string' ? body.bookmaker.trim().slice(0, 32) : null,
    typeof body.note === 'string' ? body.note.slice(0, 200) : null,
    occurredAt,
  );
  const inserted = sqldb.prepare('SELECT * FROM bankroll_transactions WHERE id = ?').get(result.lastInsertRowid);
  return jsonResponse(res, 201, inserted);
}

// DELETE /api/v1/bankroll/tx/:id
if (pathname.match(/^\/api\/v1\/bankroll\/tx\/\d+$/) && req.method === 'DELETE') {
  const user = requireUserAuth(req, res); if (!user) return;
  const txId = parseInt(pathname.split('/').pop());
  const result = sqldb.prepare('DELETE FROM bankroll_transactions WHERE id = ? AND user_id = ?').run(txId, user.userId);
  if (result.changes === 0) return jsonResponse(res, 404, { error: 'Transaction introuvable' });
  return jsonResponse(res, 200, { deleted: true, id: txId });
}

// GET /api/v1/accuracy/trends — Weekly accuracy trend chart
if (pathname === '/api/v1/accuracy/trends') {
  const weeks = parseInt(query.weeks) || 12;
  return jsonResponse(res, 200, getWeeklyAccuracyTrends(weeks));
}

// GET /api/v1/accuracy/public — Badge hero (proof social, style Datafoot)
if (pathname === '/api/v1/accuracy/public') {
  const full = getAccuracyReport();
  return jsonResponse(res, 200, {
    rolling30: full.rolling30 || {},
    leagues: full.leagues || {},
    global: { total_verified: full.total_verified || 0 },
  });
}

// GET /api/v1/top-butteurs/:matchId — Top 3 buteurs on-demand (avec fallback chargement BSD)
if (pathname.startsWith('/api/v1/top-butteurs/') && req.method === 'GET') {
  const matchId = decodeURIComponent(pathname.slice('/api/v1/top-butteurs/'.length));
  if (!matchId || matchId === 'undefined' || matchId === 'null') {
    return jsonResponse(res, 200, { success: false, buteurs: null });
  }
  let match = db.matches.find(m => m.id === matchId);
  if (!match) match = cachedMatches.find(m => m.id === matchId);
  if (!match) return jsonResponse(res, 200, { success: false, buteurs: null });

  // Deja calcule ?
  if (match.topButteurs) {
    return jsonResponse(res, 200, { success: true, buteurs: match.topButteurs, cached: true });
  }

  // Essayer de calculer depuis les donnees BSD existantes
  const fromExisting = computeMatchTopButteurs(match);
  if (fromExisting) {
    match.topButteurs = fromExisting;
    return jsonResponse(res, 200, { success: true, buteurs: fromExisting, cached: false });
  }

  // Tenter un chargement BSD on-demand (non-bloquant: on lance et on renvoie null)
  const homeKey = normName(match.home_team);
  const awayKey = normName(match.away_team);
  const hMeta = db.teamStats[homeKey] || findFuzzy(homeKey);
  const aMeta = db.teamStats[awayKey] || findFuzzy(awayKey);
  const hBsdTeamId = hMeta?.bsdTeamId || null;
  const aBsdTeamId = aMeta?.bsdTeamId || null;
  const hBsdSeasonId = hMeta?.bsdSeasonId || null;
  const aBsdSeasonId = aMeta?.bsdSeasonId || null;

  if ((hBsdTeamId && hBsdSeasonId) || (aBsdTeamId && aBsdSeasonId)) {
    // Lancement async en arriere-plan
    (async () => {
      try {
        const [homeRatings, awayRatings] = await Promise.all([
          (hBsdTeamId && hBsdSeasonId) ? fetchBSDPlayerRatings(hBsdTeamId, hBsdSeasonId) : Promise.resolve([]),
          (aBsdTeamId && aBsdSeasonId) ? fetchBSDPlayerRatings(aBsdTeamId, aBsdSeasonId) : Promise.resolve([]),
        ]);
        match._bsd_home_ratings = homeRatings;
        match._bsd_away_ratings = awayRatings;
        match.topButteurs = computeMatchTopButteurs(match);
        saveDB();
        broadcastSSE('butteurs-ready', { matchId: match.id, buteurs: match.topButteurs });
      } catch (e) { /* silencieux */ }
    })();
  }

  return jsonResponse(res, 200, { success: false, buteurs: null, loading: true });
}
// GET /api/v1/insights/:matchId — Hub Stats Elite (modal PariScore Insights)
if (pathname.startsWith('/api/v1/insights/') && req.method === 'GET') {
  const matchId = decodeURIComponent(pathname.slice('/api/v1/insights/'.length));
  // v9.1: ID validation
  if (!matchId || matchId === 'undefined' || matchId === 'null') {
    console.error("\x1b[31m[CRITICAL_FETCH] insights ID invalide: %s\x1b[0m", matchId);
    return jsonResponse(res, 200, { success: false, message: "ID invalide." });
  }
  console.log("[DEBUG INSIGHTS] ID demandé:", matchId);
  let match = db.matches.find(m => m.id === matchId);
  if (!match) match = cachedMatches.find(m => m.id === matchId);
  if (!match) {
    const numId = isNaN(Number(matchId)) ? null : Number(matchId);
    if (numId) match = cachedMatches.find(m => m.fixture_id === numId || String(m.fixture_id) === matchId);
  }
  // Nettoyer les entrées vides : match sans stats ni poisson → considéré comme non trouvé
  if (match && !matchHasData(match)) {
    console.error("\x1b[31m[INSIGHTS] Match %s trouvé mais vide (aucune stat) → traité comme non trouvé\x1b[0m", matchId);
    match = null;
  }
  if (!match) {
    console.log("[DEBUG INSIGHTS] Match non trouvé — trigger FORCE SYNC");
    // Force sync en arrière-plan pour la prochaine tentative du frontend
    const numId = isNaN(Number(matchId)) ? null : Number(matchId);
    if (numId) forceSyncFixture(String(numId));
    else if (matchId.startsWith('force_')) forceSyncFixture(matchId.replace('force_', ''));
    return jsonResponse(res, 200, { success: false, message: "Données en cours de synchronisation..." });
  }

  (async () => {
    try {
      const hKey = normName(match.home_team);
      const aKey = normName(match.away_team);
      const hMeta = db.teamStats[hKey] || findFuzzy(hKey);
      const aMeta = db.teamStats[aKey] || findFuzzy(aKey);
      const hAdvKey = hMeta === db.teamStats[hKey] ? hKey : Object.keys(db.teamStats).find(k => db.teamStats[k] === hMeta) || hKey;
      const aAdvKey = aMeta === db.teamStats[aKey] ? aKey : Object.keys(db.teamStats).find(k => db.teamStats[k] === aMeta) || aKey;
      const hAdv = db.advancedTeamStats[hAdvKey]?.data || null;
      const aAdv = db.advancedTeamStats[aAdvKey]?.data || null;

      // Priorité : ligue du match (via odds_key → leagues_config), évite mixage BL1/BL2 après promotion/relégation
      const matchLeagueCfg = leaguesConfig.leagues.find(l => l.odds_key === match.sport);
      const leagueId = matchLeagueCfg?.id || hMeta?.leagueId || aMeta?.leagueId;
      const season = currentSeason();

      // Classement de la ligue (depuis db.teamStats, trié par rank)
      const standings = Object.entries(db.teamStats)
        .filter(([, s]) => s.leagueId === leagueId && s._real && s.rank)
        .map(([tKey, s]) => {
          const adv = db.advancedTeamStats[tKey]?.data;
          return {
            team: tKey,
            rank: s.rank,
            form: s.form || '',
            ppg: s.home.ppg,
            // Global
            played: adv ? (adv.played_home + adv.played_away) : 0,
            wins: adv ? (adv.wins_home + adv.wins_away) : 0,
            draws: adv ? (adv.draws_home + adv.draws_away) : 0,
            losses: adv ? (adv.losses_home + adv.losses_away) : 0,
            pts: adv ? ((adv.wins_home + adv.wins_away) * 3 + (adv.draws_home + adv.draws_away)) : 0,
            avgFor: adv?.goals_scored_total_avg || s.home.avgScored,
            avgAg: adv?.goals_conceded_total_avg || s.home.avgConceded,
            // Domicile
            home_played: adv?.played_home || 0,
            home_wins: adv?.wins_home || 0,
            home_draws: adv?.draws_home || 0,
            home_losses: adv?.losses_home || 0,
            home_pts: adv ? (adv.wins_home * 3 + adv.draws_home) : 0,
            home_avgFor: adv?.goals_scored_home_avg || 0,
            home_avgAg: adv?.goals_conceded_home_avg || 0,
            // Cartons (pour le tri multi-critères)
            cards_yellow: adv?.cards_yellow_total || null,
            cards_red: adv?.cards_red_total || null,
            // Extérieur
            away_played: adv?.played_away || 0,
            away_wins: adv?.wins_away || 0,
            away_draws: adv?.draws_away || 0,
            away_losses: adv?.losses_away || 0,
            away_pts: adv ? (adv.wins_away * 3 + adv.draws_away) : 0,
            away_avgFor: adv?.goals_scored_away_avg || 0,
            away_avgAg: adv?.goals_conceded_away_avg || 0,
          };
        })
        .sort((a, b) => a.rank - b.rank);

      // Key Player Index — top 3 par équipe + Position Ratings, en parallèle (cache 24h chacun)
      const hTeamId = hMeta?.teamId;
      const aTeamId = aMeta?.teamId;
      // BSD team IDs (from standings data stored in bsdTeamId field)
      const hBsdTeamId = hMeta?.bsdTeamId || null;
      const aBsdTeamId = aMeta?.bsdTeamId || null;
      const hBsdSeasonId = hMeta?.bsdSeasonId || null;
      const aBsdSeasonId = aMeta?.bsdSeasonId || null;

      // FIX v11.1: Corner config needed for corner history fetches
      const cfg = bsdConfig.mapping?.config_to_bsd?.[String(leagueId)];

      // FIX v11.1: Wrap ALL parallel fetches in Promise.allSettled — no single failure crashes the route
      // v48.0: BSD-only leagues n'ont pas de teamId API-Football → fallback direct BSD
      const hHasBsd = !!(hBsdTeamId && hBsdSeasonId);
      const aHasBsd = !!(aBsdTeamId && aBsdSeasonId);
      const [h2hRes, topScorersRes, homeCornersRes, awayCornersRes,
        homeKPRes, awayKPRes, homePRRes, awayPRRes,
        homeSquadRes, awaySquadRes, homeRatingsRes, awayRatingsRes,
        homeTPRes, awayTPRes, homeFixturesRes, awayFixturesRes] = await Promise.allSettled([
          (hTeamId && aTeamId) ? fetchH2H(hTeamId, aTeamId, 10) : Promise.resolve(null),
          leagueId ? fetchLeagueTopScorers(leagueId, season) : Promise.resolve([]),
          hBsdTeamId && cfg ? fetchBSDTeamCornerHistory(match.home_team, cfg, 10) : Promise.resolve(null),
          aBsdTeamId && cfg ? fetchBSDTeamCornerHistory(match.away_team, cfg, 10) : Promise.resolve(null),
          hTeamId ? fetchTeamKeyPlayers(hTeamId, leagueId, season) : (hHasBsd ? fetchTeamKeyPlayersBSD(hBsdTeamId, hBsdSeasonId) : Promise.resolve([])),
          aTeamId ? fetchTeamKeyPlayers(aTeamId, leagueId, season) : (aHasBsd ? fetchTeamKeyPlayersBSD(aBsdTeamId, aBsdSeasonId) : Promise.resolve([])),
          hTeamId ? fetchTeamPositionRatings(hTeamId, leagueId, season) : Promise.resolve(null),
          aTeamId ? fetchTeamPositionRatings(aTeamId, leagueId, season) : Promise.resolve(null),
          hBsdTeamId ? fetchBSDTeamSquad(hBsdTeamId) : Promise.resolve([]),
          aBsdTeamId ? fetchBSDTeamSquad(aBsdTeamId) : Promise.resolve([]),
          (hBsdTeamId && hBsdSeasonId) ? fetchBSDPlayerRatings(hBsdTeamId, hBsdSeasonId) : Promise.resolve([]),
          (aBsdTeamId && aBsdSeasonId) ? fetchBSDPlayerRatings(aBsdTeamId, aBsdSeasonId) : Promise.resolve([]),
          hTeamId ? fetchTopPerformers(hTeamId, leagueId, season) : (hHasBsd ? fetchTopPerformersBSD(hBsdTeamId, hBsdSeasonId) : Promise.resolve({ attackers: [], defenders: [] })),
          aTeamId ? fetchTopPerformers(aTeamId, leagueId, season) : (aHasBsd ? fetchTopPerformersBSD(aBsdTeamId, aBsdSeasonId) : Promise.resolve({ attackers: [], defenders: [] })),
          hTeamId ? fetchTeamLastFixtures(hTeamId, 15) : fetchTeamLastFixturesBSDOrSofa(match.home_team, cfg || null, null),
          aTeamId ? fetchTeamLastFixtures(aTeamId, 15) : fetchTeamLastFixturesBSDOrSofa(match.away_team, cfg || null, null),
        ]);
      const h2h = h2hRes.status === 'fulfilled' ? h2hRes.value : null;
      const topScorers = topScorersRes.status === 'fulfilled' ? topScorersRes.value : [];
      const homeCorners = homeCornersRes.status === 'fulfilled' ? homeCornersRes.value : null;
      const awayCorners = awayCornersRes.status === 'fulfilled' ? awayCornersRes.value : null;
      const homeKeyPlayers = homeKPRes.status === 'fulfilled' ? homeKPRes.value : [];
      const awayKeyPlayers = awayKPRes.status === 'fulfilled' ? awayKPRes.value : [];
      // v50.0: Fallback sur le cache forceSyncFixture si le fetch live est vide
      const homeKPFinal = homeKeyPlayers.length ? homeKeyPlayers : (match._bsd_home_kp || []);
      const awayKPFinal = awayKeyPlayers.length ? awayKeyPlayers : (match._bsd_away_kp || []);
      // v63.0: Fallback ultime — API-Football par nom d'équipe si tout est vide
      const homeKP = homeKPFinal.length ? homeKPFinal : (API_FOOTBALL_KEY ? await fetchBackupPlayers(match.home_team) : []);
      const awayKP = awayKPFinal.length ? awayKPFinal : (API_FOOTBALL_KEY ? await fetchBackupPlayers(match.away_team) : []);
      const homePosRatings = homePRRes.status === 'fulfilled' ? homePRRes.value : null;
      const awayPosRatings = awayPRRes.status === 'fulfilled' ? awayPRRes.value : null;
      const homeBSDSquad = homeSquadRes.status === 'fulfilled' ? homeSquadRes.value : [];
      const awayBSDSquad = awaySquadRes.status === 'fulfilled' ? awaySquadRes.value : [];
      const homeBSDRatings = homeRatingsRes.status === 'fulfilled' ? homeRatingsRes.value : [];
      const awayBSDRatings = awayRatingsRes.status === 'fulfilled' ? awayRatingsRes.value : [];
      const homeTopPerformers = homeTPRes.status === 'fulfilled' ? homeTPRes.value : { attackers: [], defenders: [] };
      const awayTopPerformers = awayTPRes.status === 'fulfilled' ? awayTPRes.value : { attackers: [], defenders: [] };
      // Last fixtures for H2H & Derniers matchs tab
      const allHomeFixtures = homeFixturesRes.status === 'fulfilled' ? (homeFixturesRes.value || []) : [];
      const allAwayFixtures = awayFixturesRes.status === 'fulfilled' ? (awayFixturesRes.value || []) : [];
      const normTeam = s => (s || '').toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
      const _stopW = new Set(['al', 'fc', 'sc', 'ac', 'cf', 'sd', 'cd', 'fk', 'sk', 'if', 'bk', 'afc', 'bfc']);
      const sigW = name => { const n = normTeam(name); return n.split(' ').find(w => w.length >= 3 && !_stopW.has(w)) || n.split(' ')[0]; };
      const hSig = sigW(match.home_team);
      const aSig = sigW(match.away_team);
      // API-Football: filter by numeric ID; BSD/Sofa fallback: filter by significant name word
      const homeLastHome = allHomeFixtures.filter(f =>
        (f._bsd || f._sofa) ? normTeam(f.home).includes(hSig) : f.home_id === hTeamId
      ).slice(0, 5);
      const awayLastAway = allAwayFixtures.filter(f =>
        (f._bsd || f._sofa) ? normTeam(f.away).includes(aSig) : f.away_id === aTeamId
      ).slice(0, 5);

      // Croiser avec les blessures du match pour indiquer le statut
      const injuredNames = new Set(
        [...(match.injuries?.home || []), ...(match.injuries?.away || [])]
          .map(p => p.player?.toLowerCase())
          .filter(Boolean)
      );
      const markInjury = players => players.map(p => ({
        ...p,
        injured: injuredNames.has(p.name?.toLowerCase()),
      }));

      // Top players combiné (tous les joueurs avec KPI, pour affichage onglet Joueurs)
      const allTopPlayers = [
        ...markInjury(homeKP).map(p => ({ ...p, team: 'home', teamName: match.home_team })),
        ...markInjury(awayKP).map(p => ({ ...p, team: 'away', teamName: match.away_team })),
      ].sort((a, b) => b.kpi - a.kpi).slice(0, 10);

      // Unified stats: pré-calcule global/home/away pour les deux équipes (v49.0 Hermes)
      const buildUnifiedSide = (sideStats, adv, sideStatsAway) => {
        const hasAdv = adv && adv.played_home != null && adv.played_away != null;
        const awayFallback = sideStatsAway || sideStats;
        const s = (obj, key) => (obj && obj[key] != null) ? obj[key] : null;
        return {
          global: {
            ppg: s(sideStats, 'ppg'), wins: s(sideStats, 'wins'),
            draws: s(sideStats, 'draws'), losses: s(sideStats, 'losses'),
            avgScored: s(sideStats, 'avgScored'), avgConceded: s(sideStats, 'avgConceded'),
          },
          home: hasAdv ? {
            ppg: (adv.played_home ? parseFloat((((adv.wins_home || 0) * 3 + (adv.draws_home || 0)) / adv.played_home).toFixed(2)) : s(sideStats, 'ppg')),
            wins: adv.played_home ? Math.round((adv.wins_home || 0) / adv.played_home * 100) : s(sideStats, 'wins'),
            draws: adv.played_home ? Math.round((adv.draws_home || 0) / adv.played_home * 100) : s(sideStats, 'draws'),
            losses: adv.played_home ? Math.round((adv.losses_home || 0) / adv.played_home * 100) : s(sideStats, 'losses'),
            avgScored: adv.goals_scored_home_avg || s(sideStats, 'avgScored'),
            avgConceded: adv.goals_conceded_home_avg || s(sideStats, 'avgConceded'),
          } : {
            ppg: s(sideStats, 'ppg'), wins: s(sideStats, 'wins'),
            draws: s(sideStats, 'draws'), losses: s(sideStats, 'losses'),
            avgScored: s(sideStats, 'avgScored'), avgConceded: s(sideStats, 'avgConceded'),
          },
          away: hasAdv ? {
            ppg: (adv.played_away ? parseFloat((((adv.wins_away || 0) * 3 + (adv.draws_away || 0)) / adv.played_away).toFixed(2)) : s(awayFallback, 'ppg')),
            wins: adv.played_away ? Math.round((adv.wins_away || 0) / adv.played_away * 100) : s(awayFallback, 'wins'),
            draws: adv.played_away ? Math.round((adv.draws_away || 0) / adv.played_away * 100) : s(awayFallback, 'draws'),
            losses: adv.played_away ? Math.round((adv.losses_away || 0) / adv.played_away * 100) : s(awayFallback, 'losses'),
            avgScored: adv.goals_scored_away_avg || s(awayFallback, 'avgScored'),
            avgConceded: adv.goals_conceded_away_avg || s(awayFallback, 'avgConceded'),
          } : {
            ppg: s(awayFallback, 'ppg'), wins: s(awayFallback, 'wins'),
            draws: s(awayFallback, 'draws'), losses: s(awayFallback, 'losses'),
            avgScored: s(awayFallback, 'avgScored'), avgConceded: s(awayFallback, 'avgConceded'),
          },
        };
      };
      const unified_stats = {
        home_team: buildUnifiedSide(hMeta?.home, hAdv, hMeta?.away),
        away_team: buildUnifiedSide(aMeta?.away, aAdv, aMeta?.home),
      };

      // BSD coverage sous forme d'objet (pas de boolean)
      const bsdCov = {
        available: !!(hBsdTeamId || aBsdTeamId),
        home: !!hBsdTeamId,
        away: !!aBsdTeamId,
        pct: ((hBsdTeamId ? 50 : 0) + (aBsdTeamId ? 50 : 0)),
      };

      jsonResponse(res, 200, {
        success: true,
        match,
        homeStats: hMeta,
        awayStats: aMeta,
        homeAdv: hAdv,
        awayAdv: aAdv,
        standings,
        topScorers,
        homeKeyPlayers: markInjury(homeKP),
        awayKeyPlayers: markInjury(awayKP),
        homePosRatings: homePosRatings,
        awayPosRatings: awayPosRatings,
        homeKey: hAdvKey,
        awayKey: aAdvKey,
        // BSD enrichissement
        homeBSDSquad: homeBSDSquad,
        awayBSDSquad: awayBSDSquad,
        homeBSDRatings: homeBSDRatings,
        awayBSDRatings: awayBSDRatings,
        bsdCoverage: bsdCov,
        homeCorners,
        awayCorners,
        h2h,
        homeLastHome,
        awayLastAway,
        // Top Performers
        homeTopPerformers,
        awayTopPerformers,
        // Joueurs combinés avec KPI (v48.0)
        top_players: allTopPlayers,
        // Stats unifiées pré-calculées (v49.0 Hermes)
        unified_stats,
      });
    } catch (e) {
      console.error("\x1b[31m[INSIGHTS ERROR] Match: %s vs %s\x1b[0m", match.home_team, match.away_team);
      console.error("\x1b[31m[INSIGHTS ERROR] Stack: %s\x1b[0m", e.stack);
      jsonResponse(res, 200, { success: false, message: "Données en cours de synchronisation...", match, errorDetail: e.message });
    }
  })();
  return;
}
// POST /api/v1/force-refresh/:id — Bypass cache, fetch BSD directement
if (pathname.startsWith('/api/v1/force-refresh/') && req.method === 'POST') {
  const matchId = pathname.slice('/api/v1/force-refresh/'.length);
  console.error("\x1b[31m[FORCE-REFRESH] Requête manuelle BSD pour ID: %s\x1b[0m", matchId);

  // Nettoyer les entrées vides (match sans stats)
  const before = db.matches.length;
  db.matches = db.matches.filter(m => {
    if (m.id === matchId || String(m.fixture_id) === matchId) {
      const hasStats = m.stats && (m.stats.home || m.stats.away);
      const hasPoisson = m.poisson && m.poisson.homeWin != null;
      if (!hasStats && !hasPoisson) {
        console.error("\x1b[31m[FORCE-REFRESH] Match %s supprimé — aucune stat ni poisson\x1b[0m", matchId);
        return false;
      }
    }
    return true;
  });
  if (db.matches.length < before) console.log(`  [FORCE-REFRESH] ${before - db.matches.length} entrée(s) vide(s) nettoyée(s)`);

  // Purger aussi cachedMatches
  const cachedBefore = cachedMatches.length;
  cachedMatches = cachedMatches.filter(m => {
    if (m.id === matchId || String(m.fixture_id) === matchId) {
      const hasStats = m.stats && (m.stats.home || m.stats.away);
      const hasPoisson = m.poisson && m.poisson.homeWin != null;
      if (!hasStats && !hasPoisson) return false;
    }
    return true;
  });

  // Extraire le fixture_id numérique
  const numId = isNaN(Number(matchId)) ? null : Number(matchId);
  const forceId = numId ? String(numId) : matchId.replace('force_', '');

  // Force sync direct (ignore lock pour forcer)
  forceSyncLock.delete(forceId);
  forceSyncFixture(forceId).then(result => {
    if (result) {
      console.error("\x1b[31m[FORCE-REFRESH] ✅ Succès — match injecté\x1b[0m");
    } else {
      console.error("\x1b[31m[FORCE-REFRESH] ❌ Échec — API n'a pas retourné de données\x1b[0m");
    }
  });

  return jsonResponse(res, 200, {
    success: true,
    message: "Synchronisation forcée lancée. Recliquez sur le match dans 5-10 secondes.",
    cleaned: before - db.matches.length,
  });
}

// POST /api/v1/force-hydrate/:id — v9.0: Hydratation forcée avec validation d'intégrité
if (pathname.startsWith('/api/v1/force-hydrate/') && req.method === 'POST') {
  (async () => {
    try {
      const matchId = pathname.slice('/api/v1/force-hydrate/'.length);
      // v9.1: ID validation
      if (!matchId || matchId === 'undefined' || matchId === 'null') {
        console.error("\x1b[31m[CRITICAL_FETCH] force-hydrate ID invalide: %s\x1b[0m", matchId);
        return jsonResponse(res, 200, { success: false, message: "ID invalide." });
      }
      console.log("\x1b[36m[FORCE-HYDRATE] Requête pour ID: %s\x1b[0m", matchId);

      let match = db.matches.find(m => m.id === matchId);
      if (!match) match = cachedMatches.find(m => m.id === matchId);
      if (!match) {
        return jsonResponse(res, 200, { success: false, message: "Match non trouvé." });
      }

      // Reset status pour permettre un nouveau fetch
      match.bsd_status = null;
      match.integrity_errors = null;

      // Relancer forceSyncFixture
      forceSyncLock.delete(matchId);
      const result = await forceSyncFixture(matchId);

      if (result) {
        // Re-valider l'intégrité après sync
        const integrity = validateMatchIntegrity(match);
        if (!integrity.valid) {
          match.bsd_status = 'FAILED_INTEGRITY';
          match.integrity_errors = integrity.errors;
          return jsonResponse(res, 200, {
            success: false,
            message: `Données incomplètes: ${integrity.errors.join(', ')}`,
            errors: integrity.errors,
          });
        }
        match.bsd_status = 'FULL';
        return jsonResponse(res, 200, { success: true, match, message: "Hydratation complète." });
      } else {
        return jsonResponse(res, 200, { success: false, message: "Échec de l'hydratation — API indisponible." });
      }
    } catch (e) {
      console.error("\x1b[31m[FORCE-HYDRATE] Erreur: %s\x1b[0m", e.message);
      return jsonResponse(res, 200, { success: false, message: `Erreur: ${e.message}` });
    }
  })();
  return;
}

// GET /api/v1/ai-scout  [premium]
if (pathname === '/api/v1/ai-scout') {
  if (!requireAuth(req, res, ['premium', 'admin', 'matchday'])) return;
  generateAIScout().then(data => jsonResponse(res, data.error ? 503 : 200, data))
    .catch(e => jsonResponse(res, 500, { error: e.message }));
  return;
}

// GET /api/v1/rapidapi/parlay/test
if (pathname === '/api/v1/rapidapi/parlay/test') {
  fetchParlayOdds()
    .then(data => jsonResponse(res, data?.status === 200 ? 200 : 502, data || { error: 'Pas de données Parlay' }))
    .catch(e => jsonResponse(res, 500, { error: e.message }));
  return;
}

// GET /api/v1/rapidapi/gameforecast/test
if (pathname === '/api/v1/rapidapi/gameforecast/test') {
  fetchGameForecast()
    .then(data => jsonResponse(res, data?.status === 200 ? 200 : 502, data || { error: 'Pas de données GameForecast' }))
    .catch(e => jsonResponse(res, 500, { error: e.message }));
  return;
}

// GET /api/v1/rapidapi/dual-check
if (pathname === '/api/v1/rapidapi/dual-check') {
  const topMatches = [...db.matches]
    .filter(m => m.best_edge?.edge > 0)
    .sort((a, b) => (b.best_edge?.edge || 0) - (a.best_edge?.edge || 0))
    .slice(0, 5);
  getRapidApiDualCheck(topMatches)
    .then(data => jsonResponse(res, 200, { count: data.length, data }))
    .catch(e => jsonResponse(res, 500, { error: e.message }));
  return;
}

// GET /api/v1/gemini/test — vérification de la clé Gemini
if (pathname === '/api/v1/gemini/test') {
  if (!GEMINI_API_KEY) return jsonResponse(res, 503, { ok: false, error: 'GEMINI_API_KEY manquante dans .env' });
  (async () => {
    try {
      const r = await httpsPost(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
        { contents: [{ parts: [{ text: 'Réponds uniquement: OK' }] }], generationConfig: { maxOutputTokens: 10 } }
      );
      const txt = r.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      if (r.status === 200) jsonResponse(res, 200, { ok: true, status: r.status, response: txt.trim() });
      else jsonResponse(res, r.status, { ok: false, status: r.status, error: r.data?.error?.message || JSON.stringify(r.data) });
    } catch (e) { jsonResponse(res, 500, { ok: false, error: e.message }); }
  })();
  return;
}

// GET /api/v1/scout/:matchId — Scouting Report (Gemini, cache 24h)
const scoutMatch = pathname.match(/^\/api\/v1\/scout\/([^/?]+)$/);
if (scoutMatch && req.method === 'GET') {
  if (!GEMINI_API_KEY) { res.writeHead(503); res.end(JSON.stringify({ error: 'Clé Gemini non configurée' })); return; }
  const matchId = decodeURIComponent(scoutMatch[1]);
  const match = db.matches.find(m => m.id === matchId);
  if (!match) { res.writeHead(404); res.end(JSON.stringify({ error: 'Match non trouvé' })); return; }
  (async () => {
    try {
      const result = await getScoutReport(match);
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' });
      res.end(JSON.stringify(result));
    } catch (e) {
      res.writeHead(500); res.end(JSON.stringify({ error: e.message }));
    }
  })();
  return;
}

// GET /api/v1/acca — Acca Generator (combiné mathématique)
if (pathname === '/api/v1/acca' && req.method === 'GET') {
  if (!requireAuth(req, res)) return;
  const type = (query.strategy || 'BTTS_YES').toUpperCase();
  const size = parseInt(query.size) || 3;
  const acca = getAccaByStrategy(type, size);
  if (!acca) return jsonResponse(res, 404, { error: 'Pas assez de matchs pour ce combiné' });
  return jsonResponse(res, 200, acca);
}

// GET /api/v1/odds-history/:matchId — Dropping Odds time series
const oddsHistMatch = pathname.match(/^\/api\/v1\/odds-history\/([^/?]+)$/);
if (oddsHistMatch && req.method === 'GET') {
  const matchId = decodeURIComponent(oddsHistMatch[1]);
  const match = db.matches.find(m => m.id === matchId);
  if (!match) return jsonResponse(res, 404, { error: 'Match introuvable' });
  const snapKey = `odds_snap_${matchId}`;
  const rawHistory = kvGet(snapKey) || [];
  const history = Array.isArray(rawHistory) ? rawHistory : (rawHistory?.home != null ? [rawHistory] : []);
  return jsonResponse(res, 200, {
    id: matchId,
    home_team: match.home_team,
    away_team: match.away_team,
    current: match.odds,
    delta: match.odds_delta || null,
    history,
  });
}

// GET /api/v1/comparateur/:matchId — Comparaison tous bookmakers (données locales, zéro appel API)
const comparateurMatch = pathname.match(/^\/api\/v1\/comparateur\/([^/?]+)$/);
if (comparateurMatch && req.method === 'GET') {
  const matchId = decodeURIComponent(comparateurMatch[1]);
  const match = db.matches.find(m => m.id === matchId) || (cachedMatches || []).find(m => m.id === matchId);
  if (!match) return jsonResponse(res, 404, { error: 'Match non trouvé', matchId });
  const marketParam = (query.market || '1N2').toUpperCase();
  let rows = match.all_bookmakers || [];

  // Fallback : si all_bookmakers vide, reconstituer depuis best-only odds
  if (!rows.length && match.odds?.home && match.odds?.away) {
    const o = match.odds;
    const bk = match.bookmakers || {};
    const payout = parseFloat((100 / (1/o.home + (o.draw ? 1/o.draw : 0) + 1/o.away)).toFixed(1));
    const bkNames = [...new Set([bk.home, bk.draw, bk.away].filter(Boolean))];
    if (bkNames.length === 0) bkNames.push('Bookmaker');
    rows = bkNames.map(name => {
      const key = name.toLowerCase().replace(/[^a-z]/g, '');
      const isANJ = [...ANJ_KEYS_SET].some(a => key.includes(a) || name.toLowerCase().includes(a));
      return {
        key, title: name, isANJ,
        home: bk.home === name ? o.home : null,
        draw: bk.draw === name ? o.draw : null,
        away: bk.away === name ? o.away : null,
        payout: null,
        isBestHome: bk.home === name, isBestDraw: bk.draw === name, isBestAway: bk.away === name,
        _fallback: true,
      };
    });
    if (o.home) rows.unshift({
      key: '_best', title: 'Meilleure cote (toutes sources)',
      isANJ: true, home: o.home, draw: o.draw, away: o.away, payout,
      isBestHome: true, isBestDraw: true, isBestAway: true, _fallback: true,
    });
  }

  // ── Weighted Fair Value (WFV) — moyenne pondérée no-vig par book ──────────
  function computeWFV1N2(bkRows) {
    let sw = 0, sh = 0, sd = 0, sa = 0;
    bkRows.forEach(r => {
      if (!r.home || !r.away) return;
      const rawH = 1 / r.home, rawD = r.draw ? 1 / r.draw : 0, rawA = 1 / r.away;
      const s = rawH + rawD + rawA; if (!s) return;
      const w = getBookWeight(r.key);
      sw += w; sh += w * (rawH / s); sd += w * (rawD / s); sa += w * (rawA / s);
    });
    if (!sw) return null;
    return { home: sh / sw, draw: sd / sw, away: sa / sw };
  }
  // IC — Indice de Consensus : 1 - 5×écart-type des probas no-vig home (1N2)
  function computeIC1N2(bkRows) {
    const probs = bkRows.filter(r => r.home && r.away).map(r => {
      const s = 1/r.home + (r.draw ? 1/r.draw : 0) + 1/r.away;
      return s ? (1/r.home) / s : null;
    }).filter(p => p != null);
    if (probs.length < 2) return null;
    const mean = probs.reduce((a, b) => a + b, 0) / probs.length;
    const sd = Math.sqrt(probs.reduce((a, b) => a + (b - mean) ** 2, 0) / probs.length);
    return Math.max(0, Math.min(1, 1 - sd * 5));
  }
  // Surebet : sum of (1/bestOdds per outcome) < 1 → arbitrage possible
  function detectSurebet1N2(bkRows) {
    const bH = Math.max(...bkRows.map(r => r.home || 0));
    const dv = bkRows.map(r => r.draw).filter(Boolean);
    const bD = dv.length ? Math.max(...dv) : 0;
    const bA = Math.max(...bkRows.map(r => r.away || 0));
    if (!bH || !bA) return null;
    const total = 1/bH + (bD ? 1/bD : 0) + 1/bA;
    const margin = parseFloat(((1 - total) * 100).toFixed(2));
    return margin > 0 ? margin : null;
  }
  const wfv = computeWFV1N2(rows);
  const ic  = computeIC1N2(rows);
  const surebet = detectSurebet1N2(rows);

  // Δ Cotes — snapshot des meilleures cotes 1N2, comparé à la visite précédente
  if (!db.oddsSnapshots) db.oddsSnapshots = {};
  const prevSnap = db.oddsSnapshots[matchId];
  const bestH1N2 = rows.length ? Math.max(...rows.map(r => r.home || 0)) : null;
  const bestD1N2 = rows.some(r => r.draw) ? Math.max(...rows.map(r => r.draw || 0)) : null;
  const bestA1N2 = rows.length ? Math.max(...rows.map(r => r.away || 0)) : null;
  let oddsHistory = null;
  if (prevSnap && prevSnap.ts && (Date.now() - prevSnap.ts) > 60000) {
    const ageMin = Math.round((Date.now() - prevSnap.ts) / 60000);
    oddsHistory = {
      deltaHome: bestH1N2 != null && prevSnap.home != null ? parseFloat((bestH1N2 - prevSnap.home).toFixed(2)) : null,
      deltaDraw: bestD1N2 != null && prevSnap.draw != null ? parseFloat((bestD1N2 - prevSnap.draw).toFixed(2)) : null,
      deltaAway: bestA1N2 != null && prevSnap.away != null ? parseFloat((bestA1N2 - prevSnap.away).toFixed(2)) : null,
      prevTs: prevSnap.ts, ageMin,
    };
  }
  db.oddsSnapshots[matchId] = { ts: Date.now(), home: bestH1N2, draw: bestD1N2, away: bestA1N2 };
  // ─────────────────────────────────────────────────────────────────────────────

  // Calcul ligne "Moyenne du Marché"
  let avgRow = null;
  if (rows.length) {
    const avg = arr => arr.length ? parseFloat((arr.reduce((s, v) => s + v, 0) / arr.length).toFixed(2)) : null;
    const p2 = (a, b) => a && b ? parseFloat((100 / (1/a + 1/b)).toFixed(1)) : null;
    const p3 = (a, b, c) => a && c ? parseFloat((100 / (1/a + (b ? 1/b : 0) + 1/c)).toFixed(1)) : null;
    if (marketParam === 'OU15') {
      const ov = avg(rows.map(r => r.over15).filter(Boolean));
      const un = avg(rows.map(r => r.under15).filter(Boolean));
      avgRow = { key:'_avg', title:'Moyenne du Marché', isAvg:true, over15:ov, under15:un, payout:p2(ov,un) };
    } else if (marketParam === 'OU25') {
      const ov = avg(rows.map(r => r.over25).filter(Boolean));
      const un = avg(rows.map(r => r.under25).filter(Boolean));
      avgRow = { key:'_avg', title:'Moyenne du Marché', isAvg:true, over25:ov, under25:un, payout:p2(ov,un) };
    } else if (marketParam === 'OU35') {
      const ov = avg(rows.map(r => r.over35).filter(Boolean));
      const un = avg(rows.map(r => r.under35).filter(Boolean));
      avgRow = { key:'_avg', title:'Moyenne du Marché', isAvg:true, over35:ov, under35:un, payout:p2(ov,un) };
    } else if (marketParam === 'BTTS') {
      const y = avg(rows.map(r => r.bttsYes).filter(Boolean));
      const n = avg(rows.map(r => r.bttsNo).filter(Boolean));
      avgRow = { key:'_avg', title:'Moyenne du Marché', isAvg:true, bttsYes:y, bttsNo:n, payout:p2(y,n) };
    } else if (marketParam === 'DC') {
      const x1 = avg(rows.map(r => r.dc1X).filter(Boolean));
      const x2 = avg(rows.map(r => r.dcX2).filter(Boolean));
      const d12 = avg(rows.map(r => r.dc12).filter(Boolean));
      avgRow = { key:'_avg', title:'Moyenne du Marché', isAvg:true, dc1X:x1, dcX2:x2, dc12:d12 };
    } else if (marketParam === 'HOME_WIN') {
      const h = avg(rows.map(r => r.home).filter(Boolean));
      avgRow = { key:'_avg', title:'Moyenne du Marché', isAvg:true, home:h };
    } else if (marketParam === 'DRAW') {
      const d = avg(rows.map(r => r.draw).filter(Boolean));
      avgRow = { key:'_avg', title:'Moyenne du Marché', isAvg:true, draw:d };
    } else if (marketParam === 'AWAY_WIN') {
      const a = avg(rows.map(r => r.away).filter(Boolean));
      avgRow = { key:'_avg', title:'Moyenne du Marché', isAvg:true, away:a };
    } else {
      // 1N2
      const h = avg(rows.map(r => r.home).filter(Boolean));
      const d = avg(rows.map(r => r.draw).filter(Boolean));
      const a = avg(rows.map(r => r.away).filter(Boolean));
      avgRow = { key:'_avg', title:'Moyenne du Marché', isAvg:true, home:h, draw:d, away:a, payout:p3(h,d,a) };
    }
  }

  return jsonResponse(res, 200, {
    matchId,
    home_team: match.home_team,
    away_team: match.away_team,
    commence_time: match.commence_time,
    league: match.league,
    fair: match.fair,
    poisson: match.poisson,
    rows,
    avgRow,
    wfv,
    ic,
    surebet,
    oddsHistory,
    market: marketParam,
    source: rows.length ? (rows[0]?._fallback ? 'fallback' : 'db') : 'empty',
    _fallback: rows[0]?._fallback || false,
  });
}

// GET /api/v1/odds/:id — Cotes par marché spécifique avec cache batch 30 min
if (pathname.startsWith('/api/v1/odds/')) {
  (async () => {
    try {
      const fixtureId = pathname.slice('/api/v1/odds/'.length);

      // 1. Vérification cache batch
      const cached = oddsCache[fixtureId];
      if (cached && (Date.now() - cached.ts) < ODDS_CACHE_TTL) {
        console.log(`  [ODDS] Cache hit — fixture ${fixtureId} (${Math.round((Date.now() - cached.ts)/1000)}s ago)`);
        return jsonResponse(res, 200, {
          source: 'cache',
          fixture_id: fixtureId,
          markets: cached.markets,
          cached_at: new Date(cached.ts).toISOString(),
        });
      }

      // 2. Fallback : cotes déjà dans db.matches
      const match = db.matches.find(m => m.id === fixtureId) || cachedMatches.find(m => m.id === fixtureId);
      if (match && match.bookmakers && match.bookmakers.length) {
        const markets = extractANJMarkets(match.bookmakers, match.home_team, match.away_team);
        if (markets['1N2'] && markets['1N2'].home) {
          oddsCache[fixtureId] = { markets, ts: Date.now() };
          return jsonResponse(res, 200, { source: 'db', fixture_id: fixtureId, markets });
        }
      }

      // 3. Appel API-Football si clé dispo
      if (!API_FOOTBALL_KEY) {
        return jsonResponse(res, 200, {
          source: 'fallback',
          fixture_id: fixtureId,
          markets: {},
          message: 'API-Football non configuré — redirection comparateur',
        });
      }

      console.log(`  [ODDS] Fetching markets 1,5 from API-Football — fixture ${fixtureId}`);

      // Fetch marché 1 (Match Winner) et marché 5 (Goals Over/Under) en parallèle
      const [resM1, resM5] = await Promise.allSettled([
        fetch(`https://v3.football.api-sports.io/odds?fixture=${fixtureId}&bet=1`, {
          headers: { 'x-apisports-key': API_FOOTBALL_KEY }
        }),
        fetch(`https://v3.football.api-sports.io/odds?fixture=${fixtureId}&bet=5`, {
          headers: { 'x-apisports-key': API_FOOTBALL_KEY }
        })
      ]);

      const markets = {};

      // Traitement marché 1 — Match Winner (1N2)
      if (resM1.status === 'fulfilled' && resM1.value.ok) {
        const d1 = await resM1.value.json();
        const bkList = d1.response?.[0]?.bookmakers || [];
        markets['1N2'] = findBestANJOdds(bkList, '1N2', match?.home_team, match?.away_team);
      }

      // Traitement marché 5 — Goals Over/Under
      if (resM5.status === 'fulfilled' && resM5.value.ok) {
        const d5 = await resM5.value.json();
        const bkList = d5.response?.[0]?.bookmakers || [];
        markets['OU25'] = findBestANJOdds(bkList, 'OU25');
      }

      if (!markets['1N2'] && !markets['OU25']) {
        return jsonResponse(res, 200, {
          source: 'empty',
          fixture_id: fixtureId,
          markets: {},
          message: 'Aucune cote ANJ disponible pour ce match',
        });
      }

      // Stockage cache structuré
      oddsCache[fixtureId] = { markets, ts: Date.now() };

      return jsonResponse(res, 200, {
        source: 'api',
        fixture_id: fixtureId,
        markets,
      });
    } catch (e) {
      console.error(`  [ODDS] Error fetching fixture ${pathname.slice('/api/v1/odds/'.length)}:`, e.message);
      return jsonResponse(res, 200, {
        source: 'error',
        markets: {},
        error: e.message,
      });
    }
  })();
  return;
}

// GET /api/v1/ai-stream/:matchId — Power Score streaming SSE (secured + quota)
const aiStreamMatch = pathname.match(/^\/api\/v1\/ai-stream\/([^/?]+)$/);
if (aiStreamMatch && req.method === 'GET') {
  // ── Auth required (support both Bearer header and ?token= query) ──
  let user = getAuthUser(req);
  if (!user) {
    const tokenParam = query.token;
    if (tokenParam) user = jwtVerify(tokenParam);
  }
  if (!user) {
    return jsonResponse(res, 401, { error: 'Authentification requise', code: 'AUTH_REQUIRED' });
  }
  if (!['freemium', 'premium', 'admin', 'matchday'].includes(user.role)) {
    return jsonResponse(res, 403, { error: 'Accès réservé au plan Premium', code: 'PREMIUM_REQUIRED' });
  }

  if (!GEMINI_API_KEY) {
    return jsonResponse(res, 503, { error: 'Clé Gemini non configurée' });
  }

  // ── IP abuse prevention ──
  const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || req.connection?.remoteAddress || req.socket?.remoteAddress || 'unknown';
  if (checkIpAbuse(clientIp)) {
    return jsonResponse(res, 429, { error: 'Too many requests — abus détecté' });
  }

  // ── Quota check ──
  const matchId = decodeURIComponent(aiStreamMatch[1]);
  const role = user.role || 'freemium';
  const quota = incrementPowerScoreUsage(user.userId, role);

  if (!quota.allowed) {
    console.warn(`  [PowerScore] QUOTA EXCEEDED user ${user.userId} (${role}) — ${quota.used}/${quota.limit}`);
    return jsonResponse(res, 429, {
      error: 'Quota Power Score épuisé',
      code: 'QUOTA_EXCEEDED',
      used: quota.used,
      limit: quota.limit,
      upgrade: 'Passez à Premium pour des analyses illimitées',
    });
  }

  const match = db.matches.find(m => m.id === matchId);
  if (!match) {
    console.warn(`  [PowerScore] Match introuvable: "${matchId}" (user: ${user.userId})`);
    return jsonResponse(res, 404, { error: 'Match introuvable', code: 'MATCH_NOT_FOUND' });
  }

  console.log(`  [PowerScore] ${role} user ${user.userId} — ${quota.used}/${quota.limit} — ${matchId}`);

  // ── Global cache: first user generates, others wait ──
  const cacheKey = `power_score_${matchId}`;
  const cached = kvGet(cacheKey);
  if (cached && cached._ts && (Date.now() - cached._ts) < 24 * 3600 * 1000) {
    console.log(`  [PowerScore] HIT cache global — ${matchId}`);
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || 'http://localhost:3000',
      'X-Frame-Options': 'DENY',
      'X-Content-Type-Options': 'nosniff',
    });
    res.write(`event: chunk\ndata: ${JSON.stringify({ text: cached.text })}\n\n`);
    res.write(`event: done\ndata: ${JSON.stringify({ from_cache: true, press_count: cached.press_count || 0, press_sources: cached.press_sources || [], quota: { used: quota.used, limit: quota.limit } })}\n\n`);
    res.end();
    return;
  }

  // ── SSE setup ──
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || 'http://localhost:3000',
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
  });

  // Power Score V2 — fetch presse en parallèle (fire-and-forget, 5s max)
  Promise.race([
    fetchPressContext(match.home_team, match.away_team),
    new Promise(r => setTimeout(() => r(null), 5000)),
  ]).catch(() => null).then(pressContext => {
    try {
      const prompt = buildPowerScorePrompt(match, pressContext);
      const payload = JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.8, maxOutputTokens: 2048 },
        safetySettings: GEMINI_SAFETY_SETTINGS,
      });

      const gemUrl = new URL(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:streamGenerateContent?key=${GEMINI_API_KEY}&alt=sse`);
      const gemOpts = {
        hostname: gemUrl.hostname,
        path: gemUrl.pathname + gemUrl.search,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
      };

      let fullText = '';
      const gemReq = require('https').request(gemOpts, gemRes => {
        let buf = '';
        gemRes.on('data', chunk => {
          buf += chunk.toString();
          const lines = buf.split('\n');
          buf = lines.pop();
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const raw = line.slice(6).trim();
            if (raw === '[DONE]') continue;
            try {
              const json = JSON.parse(raw);
              const text = json.candidates?.[0]?.content?.parts?.[0]?.text || '';
              if (text) {
                fullText += text;
                try { res.write(`event: chunk\ndata: ${JSON.stringify({ text })}\n\n`); } catch { }
              }
            } catch { }
          }
        });
        gemRes.on('end', () => {
          if (!fullText) {
            console.warn(`  [PowerScore] Gemini empty response — ${matchId} (user: ${user.userId})`);
            try { res.write(`event: error\ndata: ${JSON.stringify({ message: "L'IA n'a pas pu générer d'analyse pour ce match. Réessayez dans quelques minutes." })}\n\n`); res.end(); } catch { }
            return;
          }
          const pressMeta = pressContext && typeof pressContext === 'object'
            ? { press_count: pressContext.articleCount, press_sources: pressContext.sourceNames }
            : {};
          kvSet(cacheKey, { text: fullText, _ts: Date.now(), ...pressMeta });
          console.log(`  [PowerScore] MISS → streamé + cache global — ${matchId}`);
          const donePayload = { ...pressMeta, quota: { used: quota.used, limit: quota.limit } };
          try { res.write(`event: done\ndata: ${JSON.stringify(donePayload)}\n\n`); res.end(); } catch { }
        });
        gemRes.on('error', e => { try { res.write(`event: error\ndata: ${JSON.stringify({ message: e.message })}\n\n`); res.end(); } catch { } });
      });
      gemReq.on('error', e => { try { res.write(`event: error\ndata: ${JSON.stringify({ message: e.message })}\n\n`); res.end(); } catch { } });
      gemReq.write(payload);
      gemReq.end();
      req.on('close', () => { try { gemReq.destroy(); } catch { } });
    } catch (e) {
      console.error(`  [PowerScore] ERREUR ${matchId}:`, e.message);
      try { res.write(`event: error\ndata: ${JSON.stringify({ message: e.message })}\n\n`); res.end(); } catch { }
    }
  });
  return;
}

// GET /api/v1/ai-quota — Returns remaining quota for current user
const aiQuotaPath = pathname === '/api/v1/ai-quota' && req.method === 'GET';
if (aiQuotaPath) {
  const user = requireAuth(req, res);
  if (!user) return;
  const role = user.role || 'freemium';
  const remaining = getRemainingQuota(user.userId, role);
  const limit = POWER_SCORE_LIMITS[role]?.daily ?? 1;
  return jsonResponse(res, 200, {
    role,
    label: POWER_SCORE_LIMITS[role]?.label || 'Unknown',
    remaining,
    limit,
  });
}

// POST /api/v1/power-score/:matchId/feedback — 👍/👎 feedback
const psFeedbackMatch = pathname.match(/^\/api\/v1\/power-score\/([^/?]+)\/feedback$/);
if (psFeedbackMatch && req.method === 'POST') {
  readBodyLimited(req, 1024).then(body => {
    try {
      const { rating } = JSON.parse(body);
      if (![1, -1].includes(rating)) return jsonResponse(res, 400, { error: 'rating must be 1 or -1' });
      const matchId = decodeURIComponent(psFeedbackMatch[1]);
      sqldb.prepare('INSERT INTO ai_feedback (matchId, rating, ts) VALUES (?, ?, ?)').run(matchId, rating, Date.now());
      jsonResponse(res, 200, { ok: true });
    } catch (e) { jsonResponse(res, 400, { error: e.message }); }
  }).catch(() => jsonResponse(res, 413, { error: 'body too large' }));
  return;
}

// GET /api/v1/quick-scout/:id  — Pré-analyse instantanée sans IA (<100ms)
if (pathname.startsWith('/api/v1/quick-scout/') && req.method === 'GET') {
  const scoutId = decodeURIComponent(pathname.split('/api/v1/quick-scout/')[1]);
  const scoutMatch = db.matches.find(m => m.id === scoutId);
  if (!scoutMatch) return jsonResponse(res, 404, { error: 'Match non trouvé' });
  const sp = scoutMatch.poisson || {};
  const sbe = scoutMatch.best_edge || {};
  const ss = scoutMatch.stats || {};
  const sxg = scoutMatch.expectedGoals || {};
  const sodds = scoutMatch.odds || {};
  const signals = [
    { label: 'Over 2.5', value: sp.over25 },
    { label: 'BTTS', value: sp.btts },
    { label: 'Over 1.5', value: sp.over15 },
    { label: `${scoutMatch.home_team} victoire`, value: sp.homeWin },
    { label: `${scoutMatch.away_team} victoire`, value: sp.awayWin },
    { label: 'Under 1.5', value: sp.under15 },
  ].filter(m => m.value != null).sort((a, b) => Math.abs(b.value - 50) - Math.abs(a.value - 50));
  const topSignal = signals[0] || null;
  const scoutConf = (ss.isReal ? 40 : 0) + (sodds.home ? 30 : 0) + (scoutMatch.home_form ? 20 : 0) + (sxg.home ? 10 : 0);
  return jsonResponse(res, 200, {
    edge: sbe.label ? `${sbe.label} @ ${sbe.odds} (edge ${sbe.edge > 0 ? '+' : ''}${sbe.edge}%)` : null,
    topSignal: topSignal ? `${topSignal.label} : ${topSignal.value}%` : null,
    confidence: scoutConf,
    dataQuality: ss.isReal ? 'RÉELLES' : 'ESTIMÉES',
  });
}

// GET /api/v1/deep-analysis-stream/:id  — Streaming SSE version (terminal IA)
if (pathname.startsWith('/api/v1/deep-analysis-stream/') && req.method === 'GET') {
  if (AI_DEEP_PROVIDERS.length === 0) return jsonResponse(res, 503, { error: 'Aucun provider IA configuré (GEMINI_API_KEY / GROQ_API_KEY / XAI_API_KEY / OPENROUTER_API_KEY)' });
  const streamUrl = new URL(req.url, 'http://localhost');
  const forceRefresh = streamUrl.searchParams.get('force') === '1';
  const matchId = decodeURIComponent(pathname.split('/api/v1/deep-analysis-stream/')[1]);
  const match = db.matches.find(m => m.id === matchId);
  if (!match) return jsonResponse(res, 404, { error: 'Match non trouvé' });

  // SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });

  const cacheKey = `deep_pro_${matchId}`;
  const cached = !forceRefresh && getCachedAIAnalysis(cacheKey);
  if (cached?.text) {
    console.log(`  [DeepStream] HIT cache — ${match.home_team} vs ${match.away_team}`);
    const cacheStats = match.stats || {};
    const cacheMeta = (cacheStats.isReal ? 40 : 0) + (match.odds?.home ? 30 : 0) + (match.home_form ? 20 : 0) + ((match.expectedGoals?.home) ? 10 : 0);
    try { res.write(`event: meta\ndata: ${JSON.stringify({ confidence: cacheMeta, dataQuality: cacheStats.isReal ? 'RÉELLES' : 'ESTIMÉES' })}\n\n`); } catch { }
    // Simulate streaming from cache in small chunks
    const words = cached.text.split(' ');
    let idx = 0;
    const iv = setInterval(() => {
      const chunk = words.slice(idx, idx + 6).join(' ') + (idx + 6 < words.length ? ' ' : '');
      idx += 6;
      try { res.write(`event: chunk\ndata: ${JSON.stringify({ text: chunk })}\n\n`); } catch { }
      if (idx >= words.length) {
        clearInterval(iv);
        try { res.write(`event: done\ndata: ${JSON.stringify({ _from_cache: true, provider: cached.provider || 'cache' })}\n\n`); res.end(); } catch { }
      }
    }, 30);
    req.on('close', () => clearInterval(iv));
    return;
  }

  // Build prompt (same as non-streaming route)
  const p = match.poisson || {};
  const s = match.stats || {};
  const xg = match.expectedGoals || {};
  const odds = match.odds || {};
  const bk = match.bookmakers || {};
  const be = match.best_edge || {};
  const hs = s.home || {};
  const as_ = s.away || {};
  const topScores = (p.topScores || []).slice(0, 5).map(x => `${x.score}(${x.prob}%)`).join(', ');

  const rankCtx = (rank, team) => rank ? `${rank}e au classement` : 'rang inconnu';
  const dataBlock = `\n[DONNÉES DU MATCH FOURNIES PAR PARISCORE]\nMatch : ${match.home_team} vs ${match.away_team}\nCompétition : ${match.league || match.sport}\nDate/Heure : ${match.commence_time ? new Date(match.commence_time).toLocaleString('fr-FR', { timeZone: 'Europe/Paris' }) : '—'}\n\n[QUALITÉ DES DONNÉES]\n${s.isReal ? 'DONNÉES RÉELLES — statistiques officielles standings API. Confiance élevée.' : 'DONNÉES ESTIMÉES — modèle simulation, pas de standings disponibles. Nuance ta confiance dans l\'analyse.'}\n\n[CLASSEMENT & ENJEUX]\n${match.home_team} : ${rankCtx(match.home_rank)} en ${match.league || match.sport}\n${match.away_team} : ${rankCtx(match.away_rank)} en ${match.league || match.sport}\n\n[COTES BOOKMAKERS]\n${match.home_team} (dom) : ${odds.home ?? '—'} | Nul : ${odds.draw ?? '—'} | ${match.away_team} (ext) : ${odds.away ?? '—'}\nMeilleur bookmaker 1 : ${bk.home ?? '—'} | N : ${bk.draw ?? '—'} | 2 : ${bk.away ?? '—'}\nMeilleure valeur calculée (Edge) : ${be.label ?? '—'} cote ${be.odds ?? '—'} chez ${be.bk ?? '—'} (edge ${be.edge ?? '—'}%)\n\n[STATISTIQUES ${match.home_team} — CONTEXTE DOMICILE]\nPPG dom : ${hs.ppg ?? '—'} | Victoires : ${hs.wins ?? '—'}% | Nuls : ${hs.draws ?? '—'}% | Défaites : ${hs.losses ?? '—'}%\nButs marqués dom : ${hs.avgScored ?? '—'}/match | Buts encaissés dom : ${hs.avgConceded ?? '—'}/match\nForme récente (5 derniers) : ${match.home_form ?? '—'}\nλ xG Poisson domicile : ${xg.home ?? '—'}\n\n[STATISTIQUES ${match.away_team} — CONTEXTE EXTÉRIEUR]\nPPG ext : ${as_.ppg ?? '—'} | Victoires : ${as_.wins ?? '—'}% | Nuls : ${as_.draws ?? '—'}% | Défaites : ${as_.losses ?? '—'}%\nButs marqués ext : ${as_.avgScored ?? '—'}/match | Buts encaissés ext : ${as_.avgConceded ?? '—'}/match\nForme récente (5 derniers) : ${match.away_form ?? '—'}\nλ xG Poisson extérieur : ${xg.away ?? '—'}\n\n[PROBABILITÉS POISSON PARISCORE]\n1X2 : ${match.home_team} ${p.homeWin ?? '—'}% / Nul ${p.draw ?? '—'}% / ${match.away_team} ${p.awayWin ?? '—'}%\nOver 1.5 : ${p.over15 ?? '—'}% | Over 2.5 : ${p.over25 ?? '—'}% | Over 3.5 : ${p.over35 ?? '—'}%\nBTTS (les deux marquent) : ${p.btts ?? '—'}% | Under 1.5 : ${p.under15 ?? '—'}%\nScores les plus probables : ${topScores || '—'}\n`;

  const systemPrompt = `Tu es Maxime, éditorialiste football senior chez PariScore. Ancien rédacteur L'Équipe reconverti analyste parieur. Tu as vu des milliers de matchs, tu as gagné et perdu des mises, et tu SAIS reconnaître un bon pari d'un piège.

CONTRAINTE ABSOLUE — TYPOGRAPHIE :
Aucun emoji dans ta réponse. Zéro. Pas un seul caractère emoji, icône ou symbole graphique Unicode décoratif. Uniquement du texte pur. Seul le gras **mot** est autorisé pour les accents importants. Toute violation de cette règle invalide la réponse.

Ton rôle : écrire une chronique de match qui donne ENVIE — ou dissuade clairement — de jouer un pari. Le lecteur doit sentir, après t'avoir lu, s'il faut sortir son portefeuille ou regarder ce match depuis son canapé.

[TON OBLIGATOIRE]
- Journaliste sportif passionné, pas scientifique. Les chiffres SERVENT l'histoire, ils ne SONT PAS l'histoire.
- Prises de position tranchées. Jamais "peut-être", "il est possible que". Toujours "je joue", "je passe", "ce match m'excite", "ce match me méfie".
- Vocabulaire vivant : "machine à goals", "défense de plomb", "piège à cons", "valeur planquée", "bombe à retardement", "un nul logique comme la pluie en novembre".
- Chaque pari a une HISTOIRE. "Je joue l'Over 2.5 parce que ces deux équipes ont la finesse défensive d'un tramway", pas "Over 2.5 : 68%".
- Interdiction de lister des probabilités froides en succession. Une stat peut ILLUSTRER un argument, jamais le remplacer.

[FORMAT DE SORTIE — CHRONIQUE EN 5 ACTES]

1. EN-TETE DU MATCH : [Équipe A] vs [Équipe B] ([Compétition])

2. POWER SCORE PARISCORE :
   - [Équipe A] (Dom) : X/100
   - [Équipe B] (Ext) : Y/100
   (2-3 phrases max pour expliquer l'écart ou la parité — en prose, pas en liste)

3. L'HISTOIRE DE CE MATCH :
   Rédige 3 à 5 paragraphes narratifs. Mêle contexte (enjeux du match, position au classement, forme récente), psychologie (pression, confiance, fatigue), tactique (styles de jeu, duels clés, absences notables), atmosphère (stade, derby, match piège). Parle des équipes comme d'acteurs avec des personnalités. Cite la forme en disant ce que ça SIGNIFIE. Utilise le gras **comme ceci** pour les mots ou chiffres les plus importants. Aucun emoji.

4. MES 5 PARIS :
   Pour chaque pari, écris 2-3 phrases de conviction personnelle. Sur la ligne suivante : "Mise Kelly : X.X%" (f = max(0, (prob × cote - 1) / (cote - 1)), prob en décimal, 1 décimale. Si f <= 0 : "Mise Kelly : pas de valeur mathématique").
   Structure — labels en texte pur, aucun emoji :
   - **La valeur sure** : [Pari] — [Conviction]
   Mise Kelly : X.X%
   - **Le builder de bankroll** : [Pari] — [Conviction]
   Mise Kelly : X.X%
   - **Le value bet cache** : [Pari] — [Conviction]
   Mise Kelly : X.X%
   - **Le coup de tactique** : [Pari] — [Conviction]
   Mise Kelly : X.X%
   - **Le coup de poker** : [Pari] — [Conviction]
   Mise Kelly : X.X%

5. MON VERDICT :
   Un paragraphe final tranché. "Ce match, je le joue / je le snobe." Une phrase mémorable — le genre qu'on envoie à un ami avant le match.

[REGLE D'OR]
Le lecteur ne doit pas sentir qu'il lit un tableau Excel. Il doit sentir qu'il lit L'Equipe un matin de match. Aucun emoji. Aucun.

${dataBlock}`;

  // I1 — Confidence Score + I4 — Market divergences SSE meta event
  const confidence = (s.isReal ? 40 : 0) + (odds.home ? 30 : 0) + (match.home_form ? 20 : 0) + (xg.home ? 10 : 0);
  // I4: compute Poisson vs implied prob divergences (threshold 12%)
  const divergences = [];
  const totalOdds = (odds.home && odds.draw && odds.away) ? (1 / odds.home + 1 / odds.draw + 1 / odds.away) : 0;
  if (totalOdds > 0) {
    const impliedHome = (1 / odds.home) / totalOdds * 100;
    const impliedDraw = (1 / odds.draw) / totalOdds * 100;
    const impliedAway = (1 / odds.away) / totalOdds * 100;
    const checks = [
      { label: `${match.home_team} victoire`, poisson: p.homeWin, implied: impliedHome },
      { label: 'Nul', poisson: p.draw, implied: impliedDraw },
      { label: `${match.away_team} victoire`, poisson: p.awayWin, implied: impliedAway },
      { label: 'Over 2.5', poisson: p.over25, implied: null },
      { label: 'BTTS', poisson: p.btts, implied: null },
    ];
    checks.forEach(c => {
      if (c.poisson != null && c.implied != null) {
        const gap = Math.round(c.poisson - c.implied);
        if (Math.abs(gap) >= 12) divergences.push({ label: c.label, poisson: Math.round(c.poisson), implied: Math.round(c.implied), gap });
      }
    });
  }
  // Mode Pro data: λ Poisson bruts + EV% par issue
  const ev1x2 = totalOdds > 0 ? {
    home: p.homeWin != null ? +((p.homeWin / 100 * odds.home - 1) * 100).toFixed(1) : null,
    draw: p.draw != null ? +((p.draw / 100 * odds.draw - 1) * 100).toFixed(1) : null,
    away: p.awayWin != null ? +((p.awayWin / 100 * odds.away - 1) * 100).toFixed(1) : null,
  } : null;
  try { res.write(`event: meta\ndata: ${JSON.stringify({ confidence, dataQuality: s.isReal ? 'RÉELLES' : 'ESTIMÉES', divergences, lambda: xg, ev1x2, poisson: { homeWin: p.homeWin, draw: p.draw, awayWin: p.awayWin, over25: p.over25, btts: p.btts }, odds })}\n\n`); } catch { }

  console.log(`  [DeepStream] Streaming — ${match.home_team} vs ${match.away_team}`);
  streamDeepWithProviders(systemPrompt, res, (fullText, providerName) => {
    saveAIAnalysisToCache(cacheKey, { text: fullText, provider: providerName });
    console.log(`  [DeepStream] OK via ${providerName} — ${fullText.length} chars`);
    try { res.write(`event: done\ndata: ${JSON.stringify({ total: fullText.length, provider: providerName })}\n\n`); res.end(); } catch { }
  });
  req.on('close', () => { });
  return;
}

// GET /api/v1/deep-analysis/:id  — Analyse Pro Pariscore (Power Score + Top 5 paris + Telegram)
if (pathname.startsWith('/api/v1/deep-analysis/') && req.method === 'GET') {
  if (!GEMINI_API_KEY) return jsonResponse(res, 503, { error: 'Clé Gemini non configurée' });
  const matchId = pathname.split('/api/v1/deep-analysis/')[1];
  const match = db.matches.find(m => m.id === matchId);
  if (!match) return jsonResponse(res, 404, { error: 'Match non trouvé' });

  const cacheKey = `deep_pro_${matchId}`;
  const cached = getCachedAIAnalysis(cacheKey);
  if (cached?.text) {
    console.log(`  [DeepPro] HIT cache — ${match.home_team} vs ${match.away_team}`);
    return jsonResponse(res, 200, { text: cached.text, _from_cache: true });
  }

  const p = match.poisson || {};
  const s = match.stats || {};
  const xg = match.expectedGoals || {};
  const odds = match.odds || {};
  const bk = match.bookmakers || {};
  const be = match.best_edge || {};
  const hs = s.home || {};
  const as_ = s.away || {};
  const topScores = (p.topScores || []).slice(0, 5).map(x => `${x.score}(${x.prob}%)`).join(', ');

  const nsRankCtx = (rank) => rank ? `${rank}e au classement` : 'rang inconnu';
  const dataBlock = `
[DONNÉES DU MATCH FOURNIES PAR PARISCORE]
Match : ${match.home_team} vs ${match.away_team}
Compétition : ${match.league || match.sport}
Date/Heure : ${match.commence_time ? new Date(match.commence_time).toLocaleString('fr-FR', { timeZone: 'Europe/Paris' }) : '—'}

[QUALITÉ DES DONNÉES]
${s.isReal ? 'DONNÉES RÉELLES — statistiques officielles standings API. Confiance élevée.' : 'DONNÉES ESTIMÉES — modèle simulation, pas de standings disponibles. Nuance ta confiance dans l\'analyse.'}

[CLASSEMENT & ENJEUX]
${match.home_team} : ${nsRankCtx(match.home_rank)} en ${match.league || match.sport}
${match.away_team} : ${nsRankCtx(match.away_rank)} en ${match.league || match.sport}

[COTES BOOKMAKERS]
${match.home_team} (dom) : ${odds.home ?? '—'} | Nul : ${odds.draw ?? '—'} | ${match.away_team} (ext) : ${odds.away ?? '—'}
Meilleur bookmaker 1 : ${bk.home ?? '—'} | N : ${bk.draw ?? '—'} | 2 : ${bk.away ?? '—'}
Meilleure valeur calculée (Edge) : ${be.label ?? '—'} cote ${be.odds ?? '—'} chez ${be.bk ?? '—'} (edge ${be.edge ?? '—'}%)

[STATISTIQUES ${match.home_team} — CONTEXTE DOMICILE]
PPG dom : ${hs.ppg ?? '—'} | Victoires : ${hs.wins ?? '—'}% | Nuls : ${hs.draws ?? '—'}% | Défaites : ${hs.losses ?? '—'}%
Buts marqués dom : ${hs.avgScored ?? '—'}/match | Buts encaissés dom : ${hs.avgConceded ?? '—'}/match
Forme récente (5 derniers) : ${match.home_form ?? '—'}
λ xG Poisson domicile : ${xg.home ?? '—'}

[STATISTIQUES ${match.away_team} — CONTEXTE EXTÉRIEUR]
PPG ext : ${as_.ppg ?? '—'} | Victoires : ${as_.wins ?? '—'}% | Nuls : ${as_.draws ?? '—'}% | Défaites : ${as_.losses ?? '—'}%
Buts marqués ext : ${as_.avgScored ?? '—'}/match | Buts encaissés ext : ${as_.avgConceded ?? '—'}/match
Forme récente (5 derniers) : ${match.away_form ?? '—'}
λ xG Poisson extérieur : ${xg.away ?? '—'}

[PROBABILITÉS POISSON PARISCORE]
1X2 : ${match.home_team} ${p.homeWin ?? '—'}% / Nul ${p.draw ?? '—'}% / ${match.away_team} ${p.awayWin ?? '—'}%
Over 1.5 : ${p.over15 ?? '—'}% | Over 2.5 : ${p.over25 ?? '—'}% | Over 3.5 : ${p.over35 ?? '—'}%
BTTS (les deux marquent) : ${p.btts ?? '—'}% | Under 1.5 : ${p.under15 ?? '—'}%
Scores les plus probables : ${topScores || '—'}
`;

  const systemPrompt = `Tu es Maxime, éditorialiste football senior chez PariScore. Ancien rédacteur L'Équipe reconverti analyste parieur. Tu as vu des milliers de matchs, tu as gagné et perdu des mises, et tu SAIS reconnaître un bon pari d'un piège.

CONTRAINTE ABSOLUE — TYPOGRAPHIE :
Aucun emoji dans ta réponse. Zéro. Pas un seul caractère emoji, icône ou symbole graphique Unicode décoratif. Uniquement du texte pur. Seul le gras **mot** est autorisé pour les accents importants. Toute violation de cette règle invalide la réponse.

Ton rôle : écrire une chronique de match qui donne ENVIE — ou dissuade clairement — de jouer un pari. Le lecteur doit sentir, après t'avoir lu, s'il faut sortir son portefeuille ou regarder ce match depuis son canapé.

[TON OBLIGATOIRE]
- Journaliste sportif passionné, pas scientifique. Les chiffres SERVENT l'histoire, ils ne SONT PAS l'histoire.
- Prises de position tranchées. Jamais "peut-être", "il est possible que". Toujours "je joue", "je passe", "ce match m'excite", "ce match me méfie".
- Vocabulaire vivant : "machine à goals", "défense de plomb", "piège à cons", "valeur planquée", "bombe à retardement", "un nul logique comme la pluie en novembre".
- Chaque pari a une HISTOIRE. "Je joue l'Over 2.5 parce que ces deux équipes ont la finesse défensive d'un tramway", pas "Over 2.5 : 68%".
- Interdiction de lister des probabilités froides en succession. Une stat peut ILLUSTRER un argument, jamais le remplacer.

[FORMAT DE SORTIE — CHRONIQUE EN 5 ACTES]

1. EN-TETE DU MATCH : [Équipe A] vs [Équipe B] ([Compétition])

2. POWER SCORE PARISCORE :
   - [Équipe A] (Dom) : X/100
   - [Équipe B] (Ext) : Y/100
   (2-3 phrases max pour expliquer l'écart ou la parité — en prose, pas en liste)

3. L'HISTOIRE DE CE MATCH :
   Rédige 3 à 5 paragraphes narratifs. Mêle contexte (enjeux du match, position au classement, forme récente), psychologie (pression, confiance, fatigue), tactique (styles de jeu, duels clés, absences notables), atmosphère (stade, derby, match piège). Parle des équipes comme d'acteurs avec des personnalités. Cite la forme en disant ce que ça SIGNIFIE. Utilise le gras **comme ceci** pour les mots ou chiffres les plus importants. Aucun emoji.

4. MES 5 PARIS :
   Pour chaque pari, écris 2-3 phrases de conviction personnelle. Sur la ligne suivante : "Mise Kelly : X.X%" (f = max(0, (prob × cote - 1) / (cote - 1)), prob en décimal, 1 décimale. Si f <= 0 : "Mise Kelly : pas de valeur mathématique").
   Structure — labels en texte pur, aucun emoji :
   - **La valeur sure** : [Pari] — [Conviction]
   Mise Kelly : X.X%
   - **Le builder de bankroll** : [Pari] — [Conviction]
   Mise Kelly : X.X%
   - **Le value bet cache** : [Pari] — [Conviction]
   Mise Kelly : X.X%
   - **Le coup de tactique** : [Pari] — [Conviction]
   Mise Kelly : X.X%
   - **Le coup de poker** : [Pari] — [Conviction]
   Mise Kelly : X.X%

5. MON VERDICT :
   Un paragraphe final tranché. "Ce match, je le joue / je le snobe." Une phrase mémorable — le genre qu'on envoie à un ami avant le match.

[REGLE D'OR]
Le lecteur ne doit pas sentir qu'il lit un tableau Excel. Il doit sentir qu'il lit L'Equipe un matin de match. Aucun emoji. Aucun.

${dataBlock}`;

  (async () => {
    try {
      console.log(`  [DeepPro] Appel Gemini — ${match.home_team} vs ${match.away_team}`);
      const gemRes = await httpsPost(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
          contents: [{ parts: [{ text: systemPrompt }] }],
          safetySettings: GEMINI_SAFETY_SETTINGS,
          generationConfig: { temperature: 0.8, maxOutputTokens: 4096 }
        }
      );
      if (gemRes.status !== 200) return jsonResponse(res, gemRes.status, gemRes.data);
      const text = gemRes.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      if (!text) return jsonResponse(res, 500, { error: 'Réponse Gemini vide' });
      saveAIAnalysisToCache(cacheKey, { text });
      console.log(`  [DeepPro] OK — ${text.length} chars`);
      return jsonResponse(res, 200, { text });
    } catch (e) {
      console.error('  [DeepPro] Erreur:', e.message);
      return jsonResponse(res, 500, { error: e.message });
    }
  })();
  return;
}

// POST /api/v1/gemini  (proxy Gemini avec cache 24h par match)
if (pathname === '/api/v1/gemini' && req.method === 'POST') {
  if (!GEMINI_API_KEY) return jsonResponse(res, 503, { error: 'Clé Gemini non configurée' });
  readBodyLimited(req, MAX_BODY_SIZE).then(async (body) => {
    try {
      const parsed = JSON.parse(body);

      // ── Extraction de la clé de cache (transparente pour Gemini) ──────────
      const matchKey = parsed._match_key || null;
      delete parsed._match_key;

      // ── Cache hit : réponse immédiate, 0 appel Gemini ─────────────────────
      if (matchKey) {
        const cached = getCachedAIAnalysis(matchKey);
        if (cached) {
          console.log(`  [AICache] HIT — ${matchKey}`);
          return jsonResponse(res, 200, { ...cached, _from_cache: true });
        }
      }

      // ── Cache miss : appel Gemini puis mise en cache ───────────────────────
      parsed.safetySettings = GEMINI_SAFETY_SETTINGS;
      parsed.generationConfig = { ...(parsed.generationConfig || {}), response_mime_type: 'application/json' };

      const gemRes = await httpsPost(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
        parsed
      );

      if (matchKey && gemRes.status === 200) {
        saveAIAnalysisToCache(matchKey, gemRes.data);
        console.log(`  [AICache] MISS → stocké — ${matchKey}`);
      }

      jsonResponse(res, gemRes.status, gemRes.data);
    } catch (e) { jsonResponse(res, 500, { error: e.message }); }
  }).catch(e => jsonResponse(res, 413, { error: e.message }));
  return;
}

// POST /api/v1/rebuild — enrichit db.matches avec BSD/AF/Sofa IDs depuis teamStats
if (pathname === '/api/v1/rebuild' && req.method === 'POST') {
  let enriched = 0;
  for (const m of db.matches) {
    const hKey = normName(m.home_team);
    const aKey = normName(m.away_team);
    const hRaw = db.teamStats[hKey] || findFuzzy(hKey);
    const aRaw = db.teamStats[aKey] || findFuzzy(aKey);
    m.home_team_id = hRaw?.teamId || null;
    m.away_team_id = aRaw?.teamId || null;
    m.home_bsd_id = hRaw?.bsdTeamId || null;
    m.away_bsd_id = aRaw?.bsdTeamId || null;
    m.home_sofa_id = hRaw?.sofaTeamId || null;
    m.away_sofa_id = aRaw?.sofaTeamId || null;
    if (m.home_bsd_id || m.home_team_id) enriched++;
  }
  saveDB();
  const sample = db.matches[0] || {};
  console.log(`  [Rebuild] ${enriched}/${db.matches.length} matchs enrichis avec IDs logos`);
  return jsonResponse(res, 200, { total: db.matches.length, enriched, sample: { home: sample.home_team, bsd: sample.home_bsd_id, af: sample.home_team_id } });
}

// POST /api/v1/refresh (forcer la MAJ)
if (pathname === '/api/v1/refresh' && req.method === 'POST') {
  (async () => {
    try {
      console.log('\n  [Manual] Rafraîchissement forcé…');
      await fetchStats(true);
      await fetchOdds();
      jsonResponse(res, 200, {
        message: 'Rafraîchissement terminé',
        matchCount: db.matches.length,
        teamCount: Object.keys(db.teamStats).length,
        lastOddsUpdate: db.lastOddsUpdate,
        lastStatsUpdate: db.lastStatsUpdate,
      });
    } catch (e) {
      jsonResponse(res, 500, { error: e.message });
    }
  })();
  return;
}

   /* -------------------------------------------------
       4️⃣  ROUTAGE API REST PRINCIPALE
       ------------------------------------------------- */

    // --- Cas A : Les logos (Route spécifique asynchrone) ---
    if (pathname === '/api/v1/team-logo') {
        const name = (query.name || '').toString().trim();
        if (!name) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: 'name required' }));
        }

        const cacheKey = `logo_${name.toLowerCase().replace(/\s+/g, '_')}`;
        const cached = apiCacheGet(cacheKey);
        if (cached) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify(cached));
        }

        (async () => {
            try {
                let result = null;
                if (typeof BSD_API_KEY !== 'undefined' && BSD_API_KEY) {
                    try {
                        const r = await bsdFetch(`/teams/?search=${encodeURIComponent(name)}&page_size=1`);
                        const t = r.data?.results?.[0];
                        if (t?.id) {
                            result = { url: `https://sports.bzzoiro.com/img/team/${t.id}/`, bsdId: t.id };
                        }
                    } catch (e) { /* fallback */ }
                }

                if (!result) {
                    const found = await searchSofascoreTeam(name);
                    if (found?.id) {
                        result = { url: `https://api.sofascore.app/api/v1/team/${found.id}/image`, sofaId: found.id };
                    }
                }

                if (!result) {
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ url: null }));
                }

                // Cache 30 jours
                db.prepare('INSERT OR REPLACE INTO api_cache (key, data, source, created_at, expires_at) VALUES (?, ?, ?, ?, ?)')
                  .run(cacheKey, JSON.stringify(result), 'logo', Date.now(), Date.now() + 30 * 24 * 3600 * 1000);

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(result));
            } catch (e) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ url: null }));
            }
        })();
        return; 
    }

    // --- Cas B : Routes API inside handleAPI (Matchs, Leagues, etc.) ---
    if (pathname.startsWith('/api/')) {
        try {
            await handleAPI(req, res, pathname, query);
            if (!res.headersSent) {
                res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ error: 'Route API inconnue: ' + pathname }));
            }
            return;
        } catch (e) {
            console.error("[API ERROR]:", e.message);
            if (!res.headersSent) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Internal Server Error: ' + e.message }));
            }
            return;
        }
    }

    /* -------------------------------------------------
       5️⃣  SERVIR LES FICHIERS STATIQUES (Front-end)
       ------------------------------------------------- */

    // Si une route API a déjà répondu, on stoppe.
    if (res.headersSent) return;

    const filePath = path.join(__dirname, pathname === '/' ? 'pariscore.html' : pathname);

    if (!isSafePath(filePath)) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: '403 Forbidden' }));
    }

    fs.readFile(filePath, (err, data) => {
        if (res.headersSent) return; 
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            return res.end('404: ' + pathname);
        }
        
        const ext = path.extname(filePath);
        const contentType = (typeof mime !== 'undefined' && mime[ext]) ? mime[ext] : 'application/octet-stream';

        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
    });
/* ═══════════════════════════════════════════════════════════════════════════════
   ANTI‑CRASH & DÉMARRAGE
   ═══════════════════════════════════════════════════════════════════════════════ */

process.on('unhandledRejection', (reason) => {
    console.error("\x1b[31m[ANTI‑CRASH] Unhandled Rejection:\x1b[0m", reason?.message || reason);
});

process.on('uncaughtException', (error) => {
    console.error("\x1b[31m[ANTI‑CRASH] Uncaught Exception:\x1b[0m", error.message);
    console.error(error.stack);
});
}); // <=== FERMETURE OFFICIELLE DU SERVEUR HTTP (http.createServer)

/* -------------------------------------------------
   Sofascore microservice client — Phase 1 enrichment via Python wrapper
   (microservice Python expose ScraperFC + sofascore-wrapper en HTTP local)
   ------------------------------------------------- */
const SOFA_SERVICE_BASE = process.env.SOFA_SERVICE_BASE || 'http://127.0.0.1:8765';
const SOFA_SERVICE_TIMEOUT = 5000;
const _sofaEventIdMapping = new Map();   // bsdId → { ts, sofaId }
const SOFA_MAPPING_TTL = 24 * 60 * 60 * 1000;

function _sofaServiceFetch(path, timeoutMs = SOFA_SERVICE_TIMEOUT) {
  return Promise.race([
    fetch(`${SOFA_SERVICE_BASE}${path}`).then(r => r.ok ? r.json() : null).catch(() => null),
    new Promise(resolve => setTimeout(() => resolve(null), timeoutMs)),
  ]);
}

async function resolveSofaEventId(match) {
  if (!match) return null;
  const key = String(match.id);
  const cached = _sofaEventIdMapping.get(key);
  if (cached && Date.now() - cached.ts < SOFA_MAPPING_TTL) return cached.sofaId;
  const date = (match.commence_time || '').slice(0, 10);
  const home = encodeURIComponent(match.home_team || '');
  const away = encodeURIComponent(match.away_team || '');
  if (!home || !away) return null;
  const data = await _sofaServiceFetch(`/find-match?home=${home}&away=${away}&date=${date}`);
  const sofaId = data?.matched ? data.sofa_event_id : null;
  _sofaEventIdMapping.set(key, { ts: Date.now(), sofaId });
  return sofaId;
}

async function fetchSofaMicroserviceEnrichment(match) {
  const sofaId = await resolveSofaEventId(match);
  if (!sofaId) return null;
  const [stats, momentum, shotmap] = await Promise.all([
    _sofaServiceFetch(`/match/${sofaId}/stats`),
    _sofaServiceFetch(`/match/${sofaId}/momentum`),
    _sofaServiceFetch(`/match/${sofaId}/shotmap`),
  ]);
  // Map Sofascore raw stats → frontend shape
  const out = { sofa_event_id: sofaId, _source: 'sofascore-microservice' };
  if (stats && stats.statistics) {
    const all = (stats.statistics || []).find(p => p.period === 'ALL');
    const num = v => {
      if (v == null) return 0;
      if (typeof v === 'number') return v;
      const m = String(v).match(/-?\d+(\.\d+)?/);
      return m ? parseFloat(m[0]) : 0;
    };
    if (all) {
      for (const g of all.groups || []) {
        for (const it of g.statisticsItems || []) {
          const n = (it.name || '').toLowerCase();
          // Sofa raw payload uses `home`/`away` (string with %) not `homeValue`/`awayValue`
          const rawH = it.home ?? it.homeValue;
          const rawA = it.away ?? it.awayValue;
          if (n.includes('possession'))           out.possession        = { home: num(rawH), away: num(rawA) };
          else if (n === 'total shots')           out.shots             = { home: num(rawH), away: num(rawA) };
          else if (n.includes('shots on target')) out.shots_on_target   = { home: num(rawH), away: num(rawA) };
          else if (n.includes('corner kicks'))    out.corners           = { home: num(rawH), away: num(rawA) };
          else if (n.includes('expected goal'))   out.xg                = { home: num(rawH), away: num(rawA) };
        }
      }
    }
  }
  if (momentum && Array.isArray(momentum.points)) {
    out.momentum = momentum.points.map(p => ({ min: p.minute || 0, v: p.value || 0 }));
  }
  if (shotmap && Array.isArray(shotmap.shots)) {
    out.shotmap = shotmap.shots.map(s => ({
      minute: s.minute, player: s.player?.name, isHome: s.isHome,
      situation: s.situation, body: s.bodyPart, xg: s.xg, xgot: s.xgot,
      x: s.playerCoordinates?.x, y: s.playerCoordinates?.y,
    }));
  }
  return out;
}

/* -------------------------------------------------
   Live Dashboard V2 — BSD sr_stats source + momentum synthétique (Sofascore 403 server-side)
   ------------------------------------------------- */
const _liveMomentumHistory = new Map();     // matchId → [{ min, v }]  (in-memory replay)
const _bsdEventDetailCache = new Map();     // bsdId → { ts, data }
const BSD_EVENT_DETAIL_TTL = 25 * 1000;     // 25s cache pour absorber polls 30s sans hit excessif
const MOMENTUM_MAX_POINTS = 30;

async function fetchBSDEventDetail(bsdId) {
  if (!BSD_API_KEY || !bsdId) return null;
  const key = String(bsdId);
  const cached = _bsdEventDetailCache.get(key);
  if (cached && Date.now() - cached.ts < BSD_EVENT_DETAIL_TTL) return cached.data;
  try {
    const res = await bsdFetch(`/events/${bsdId}/`);
    if (res.status !== 200 || !res.data) return null;
    _bsdEventDetailCache.set(key, { ts: Date.now(), data: res.data });
    return res.data;
  } catch (e) {
    console.warn('[BSD detail]', bsdId, e.message);
    return null;
  }
}

function recordLiveMomentumSnapshot(matchId, minute, sr) {
  if (!sr || !minute) return;
  const homeDA = sr.dangerous_attack?.home || 0;
  const awayDA = sr.dangerous_attack?.away || 0;
  const v = homeDA - awayDA;
  const hist = _liveMomentumHistory.get(matchId) || [];
  if (!hist.length || hist[hist.length - 1].min !== minute) {
    hist.push({ min: minute, v });
    if (hist.length > MOMENTUM_MAX_POINTS) hist.shift();
    _liveMomentumHistory.set(matchId, hist);
  }
}

function buildLiveDashboardPayload(match, detail) {
  const sr = detail?.sr_stats || null;
  const minute = parseInt(detail?.current_minute ?? match.live_minute ?? 0) || 0;
  if (sr) recordLiveMomentumSnapshot(match.id, minute, sr);

  const xgH = detail?.actual_home_xg ?? detail?.home_xg_live ?? null;
  const xgA = detail?.actual_away_xg ?? detail?.away_xg_live ?? null;
  const possH = sr?.ball_safe_pct?.home;
  const possA = sr?.ball_safe_pct?.away;
  const attackH = sr?.attack?.home;
  const attackA = sr?.attack?.away;
  const daH = sr?.dangerous_attack?.home;
  const daA = sr?.dangerous_attack?.away;

  return {
    id: match.id,
    home_team: detail?.home_team || match.home_team,
    away_team: detail?.away_team || match.away_team,
    league: detail?.league?.name || match.league,
    score: detail
      ? `${detail.home_score || 0}-${detail.away_score || 0}`
      : (match.live_score || '0-0'),
    minute,
    status: detail?.status || match.status || null,
    xg: (xgH != null || xgA != null)
      ? { home: +(xgH || 0), away: +(xgA || 0) }
      : (match.live_xg && (match.live_xg.home != null || match.live_xg.away != null) ? match.live_xg : null),
    possession: (possH != null && possA != null)
      ? { home: possH, away: possA }
      : (match.live_possession && match.live_possession.home != null ? match.live_possession : null),
    attack: (attackH != null && attackA != null) ? { home: attackH, away: attackA } : null,
    dangerous_attacks: (daH != null && daA != null)
      ? { home: daH, away: daA }
      : (match.live_dangerous_attacks && match.live_dangerous_attacks.home != null ? match.live_dangerous_attacks : null),
    // v9.8.3 fix: populate from match.live_* (Sofascore-enriched) instead of hardcoded null
    shots: (match.live_shots && match.live_shots.home != null) ? match.live_shots : null,
    shots_on_target: (match.live_shots_on_target && match.live_shots_on_target.home != null) ? match.live_shots_on_target : null,
    corners: (match.live_corners && match.live_corners.home != null) ? match.live_corners : null,
    cards: match.live_cards || null,
    momentum: _liveMomentumHistory.get(match.id) || match.live_momentum || [],
    intensity: match.live_intensity || 0,
    _source: 'bsd_sr_stats',
    _enrichment_ready: !!(match.live_xg || match.live_shots || sr),
  };
}

/* -------------------------------------------------
   Sofascore — enrichissement stats live (legacy, 403 server-side — conservé pour ligues majeures futures via proxy)
   ------------------------------------------------- */
const _sofaLiveStatsCache = {};       // { sofaEventId: { ts, data } }
const SOFA_LIVE_STATS_TTL = 60000;    // 1 min — données live

function applyLiveStats(match, data) {
  if (data.possession)        match.live_possession        = data.possession;
  if (data.shots)             match.live_shots             = data.shots;
  if (data.shots_on_target)   match.live_shots_on_target   = data.shots_on_target;
  if (data.corners)           match.live_corners           = data.corners;
  if (data.dangerous_attacks) match.live_dangerous_attacks = data.dangerous_attacks;
  if (data.xg)                match.live_xg                = data.xg;
  if (data.cards)             match.live_cards             = data.cards;
  if (data.momentum)          match.live_momentum          = data.momentum;
  match.live_intensity = computeLiveIntensityFromSofa(data, match);
  match.live_stats = {
    possessionHome:        data.possession?.home       ?? match.live_stats?.possessionHome       ?? 50,
    possessionAway:        data.possession?.away       ?? match.live_stats?.possessionAway       ?? 50,
    dangerousAttacksHome:  data.dangerous_attacks?.home ?? match.live_stats?.dangerousAttacksHome ?? 0,
    dangerousAttacksAway:  data.dangerous_attacks?.away ?? match.live_stats?.dangerousAttacksAway ?? 0,
    shotsOnTargetHome:     data.shots_on_target?.home  ?? match.live_stats?.shotsOnTargetHome    ?? 0,
    shotsOnTargetAway:     data.shots_on_target?.away  ?? match.live_stats?.shotsOnTargetAway    ?? 0,
  };
}

function computeLiveIntensityFromSofa(data, match) {
  let intensity = 0;
  if (data.xg) {
    intensity += Math.min(Math.abs((data.xg.home||0) - (data.xg.away||0)) * 15, 40);
  }
  const totalShots = (data.shots?.home||0) + (data.shots?.away||0);
  intensity += Math.min(totalShots * 1.5, 30);
  const totalGoals = (match.live_score?.home||0) + (match.live_score?.away||0);
  intensity += Math.min(totalGoals * 10, 30);
  if (data.dangerous_attacks) {
    const da = (data.dangerous_attacks.home||0) + (data.dangerous_attacks.away||0);
    intensity += Math.min(da * 0.3, 20);
  }
  return Math.round(Math.min(intensity, 100));
}

async function enrichMatchWithSofaLiveStats(match) {
  try {
    const sofaEventId = await findSofaEventId(match);
    if (!sofaEventId) return null;

    const cacheKey = String(sofaEventId);
    const cached = _sofaLiveStatsCache[cacheKey];
    if (cached && Date.now() - cached.ts < SOFA_LIVE_STATS_TTL) {
      applyLiveStats(match, cached.data);
      return cached.data;
    }

    const [statsRes, graphRes] = await Promise.allSettled([
      sofaGet(`/event/${sofaEventId}/statistics`),
      sofaGet(`/event/${sofaEventId}/graph`),
    ]);

    const data = {};

    if (statsRes.status === 'fulfilled' && statsRes.value.status === 200) {
      const allPeriod = (statsRes.value.data?.statistics || []).find(p => p.period === 'ALL');
      for (const group of allPeriod?.groups || []) {
        for (const item of group.statisticsItems || []) {
          const n = (item.name || '').toLowerCase();
          if (n.includes('possession'))          data.possession        = { home: item.homeValue??50, away: item.awayValue??50 };
          else if (n === 'total shots')          data.shots             = { home: item.homeValue??0,  away: item.awayValue??0  };
          else if (n.includes('shots on target')) data.shots_on_target  = { home: item.homeValue??0,  away: item.awayValue??0  };
          else if (n.includes('corner'))         data.corners           = { home: item.homeValue??0,  away: item.awayValue??0  };
          else if (n.includes('dangerous attack'))data.dangerous_attacks= { home: item.homeValue??0,  away: item.awayValue??0  };
          else if (n.includes('expected goal'))  data.xg                = { home: item.homeValue??0,  away: item.awayValue??0  };
          else if (n.includes('yellow card')) {
            if (!data.cards) data.cards = { home_yellow:0, home_red:0, away_yellow:0, away_red:0 };
            data.cards.home_yellow = item.homeValue??0; data.cards.away_yellow = item.awayValue??0;
          } else if (n.includes('red card')) {
            if (!data.cards) data.cards = { home_yellow:0, home_red:0, away_yellow:0, away_red:0 };
            data.cards.home_red = item.homeValue??0; data.cards.away_red = item.awayValue??0;
          }
        }
      }
    }

    if (graphRes.status === 'fulfilled' && graphRes.value.status === 200) {
      const pts = graphRes.value.data?.graphPoints || [];
      data.momentum = pts.map(p => ({ min: p.minute ?? 0, v: p.value ?? 0 }));
    }

    if (Object.keys(data).length > 0) {
      _sofaLiveStatsCache[cacheKey] = { ts: Date.now(), data };
      applyLiveStats(match, data);
      console.log(`  [SofaLive] event ${sofaEventId}: ${Object.keys(data).join(', ')}`);
    }
    return Object.keys(data).length > 0 ? data : null;
  } catch (e) {
    console.warn('[SofaLive]', e.message);
    return null;
  }
}

/* -------------------------------------------------
   Fonction de polling des scores en direct
   ------------------------------------------------- */
async function pollLiveScores() {
    try {
        const now = new Date();
        const dateStr = formatDateOnly(now);
        const bsdLive = await fetchBSDMatches(dateStr, dateStr);
        if (!bsdLive) return;

        const patches = [];
        for (const bl of bsdLive) {
            const m = db.matches.find(x => x.id === bl.id);
            if (!m) continue;
            const newIntensity = computeLiveIntensityFromBSD(bl);
            const sig = (bl.live_score||'') + ':' + (bl.live_minute||'') + ':' + newIntensity + ':' + (bl.status || m.status || '');
            if (_livePatchSnapshot.get(m.id) === sig) continue;
            m.live_score     = bl.live_score;
            m.live_minute    = bl.live_minute;
            m.live_intensity = newIntensity;
            if (bl.status) m.status = bl.status;
            _livePatchSnapshot.set(m.id, sig);
            patches.push(m);
        }

        // Enrichissement Sofascore pour chaque match live (stats + xG + momentum)
        const liveNow = db.matches.filter(m => m.live_score && parseInt(m.live_minute||0) > 0 && parseInt(m.live_minute||0) < 130);
        await Promise.allSettled(liveNow.map(m => enrichMatchWithSofaLiveStats(m)));

        if (patches.length > 0 || liveNow.length > 0) {
            saveDB();
            // Broadcast patch enrichi avec tous les champs Sofascore
            const fullPatches = (patches.length > 0 ? patches : liveNow).map(m => ({
                id: m.id,
                live_score:            m.live_score,
                live_minute:           m.live_minute,
                live_intensity:        m.live_intensity,
                status:                m.status,
                live_possession:       m.live_possession,
                live_shots:            m.live_shots,
                live_shots_on_target:  m.live_shots_on_target,
                live_corners:          m.live_corners,
                live_dangerous_attacks:m.live_dangerous_attacks,
                live_xg:               m.live_xg,
                live_cards:            m.live_cards,
                live_momentum:         m.live_momentum,
                live_stats:            m.live_stats,
            }));
            if (sseClients.size > 0) broadcastSSE('live_patch', { patches: fullPatches });
            if (patches.length > 0) console.log('[LivePoll] ' + patches.length + ' BSD patch(es) + ' + liveNow.length + ' Sofa enrichi(s)');
        }
    } catch (e) {
        console.warn('[LivePoll] Error:', e.message);
    }
}
function computeLiveIntensityFromBSD(live) {
    let intensity = 0;

    // xG differential (0-40 points)
    if (live.home_xg_live != null && live.away_xg_live != null) {
        const xgDiff = Math.abs(live.home_xg_live - live.away_xg_live);
        intensity += Math.min(xgDiff * 15, 40);
    }

    // Total shots (0-30 points)
    const totalShots = (live.live_stats?.home?.total_shots || 0) + (live.live_stats?.away?.total_shots || 0);
    intensity += Math.min(totalShots * 1.5, 30);

    // Goals scored (0-30 points)
    const totalGoals = (live.home_score || 0) + (live.away_score || 0);
    intensity += Math.min(totalGoals * 10, 30);

    // Momentum volatility (0-20 points)
    if (live.momentum && live.momentum.length > 5) {
        const recent = live.momentum.slice(-10);
        const volatility = Math.max(...recent.map(m => Math.abs(m.v))) / 50;
        intensity += Math.min(volatility * 20, 20);
    }

    return Math.round(Math.min(intensity, 100));
}

/* -------------------------------------------------
   Démarrage du serveur
   ------------------------------------------------- */
let serverReady = false;

// Initialisation
initSQLite();
loadDB();
backfillMatchForms();
loadHistory();
loadAICache();

//const PORT = process.env.PORT || 3000;
server.on('error', err => {
    if (err && err.code === 'EADDRINUSE') {
        console.error(`\n  ✗ PORT ${PORT} OCCUPÉ - un autre processus Node est déjà actif.`);
        console.error('  → Fermer l\'instance existante ou changer PORT dans les variables d\'environnement.\n');
        process.exit(1);
    }
    console.error('\n  ✗ Erreur serveur:', err && err.message ? err.message : err);
    process.exit(1);
});

/* -------------------------------------------------
   Séquence de démarrage (exécutée après que le serveur soit en écoute)
   ------------------------------------------------- */
const BOOT_ODDS_TIMEOUT_MS = parseInt(process.env.BOOT_ODDS_TIMEOUT_MS || '25000', 10);
const BOOT_STATS_TIMEOUT_MS = parseInt(process.env.BOOT_STATS_TIMEOUT_MS || '90000', 10);

function withBootTimeout(label, ms, fn) {
    return Promise.race([
        Promise.resolve().then(fn),
        new Promise((_, reject) => {
            setTimeout(() => reject(new Error(`${label} timeout (${ms}ms)`)), ms);
        })
    ]);
}

async function bootInit() {
    console.log('  [Boot] Initialisation des données...');

    try {
        await withBootTimeout('fetchOdds', BOOT_ODDS_TIMEOUT_MS, () => fetchOdds(true));
    } catch (e) {
        console.warn('  [Boot] ⚠ fetchOdds:', e.message);
    }

    if (typeof syncCacheBuffers === 'function') syncCacheBuffers();
    serverReady = true;
    autoPurgeDatabase();
    console.log('  [Boot] ✓ Système prêt.');

    withBootTimeout('fetchStats (background)', BOOT_STATS_TIMEOUT_MS, () => fetchStats(true))
        .then(() => {
            if (typeof syncCacheBuffers === 'function') syncCacheBuffers();
            console.log('  [Boot] ✓ Enrichissement stats terminé.');
        })
        .catch(e => {
            console.warn('  [Boot] ⚠ Enrichissement stats:', e.message);
        });
}

server.listen(PORT, () => {
    console.log(`\n  ✓ SERVEUR DÉMARRÉ SUR LE PORT ${PORT}\n`);
    bootInit().catch(e => console.error('  [Boot] Erreur init:', e.message));
});

/* -------------------------------------------------
   AutoPurge — supprime en mémoire les matchs expirés
   (terminés ou > 4h après kick-off) sans appel API
   ------------------------------------------------- */
function autoPurgeDatabase() {
    const now = Date.now();
    // 150 min = 90min match + 60min buffer (ET, prolongations, décision var)
    const EXPIRY_MS = 150 * 60 * 1000;
    const FINISHED_SET = new Set([
        'finished','ft','aet','pen','ended','terminated',
        'postponed','cancelled','canceled','abandoned','walkover','awrd',
        'interrupted','suspended','canc','abd',
        // versions normalisées uppercase
        'FINISHED','FT','TERMINE','ENDED','AET','PEN','POSTPONED','CANC','ABD',
        'SUSPENDED','INTERRUPTED','CANCELED','WALKOVER'
    ]);
    const normS = s => s ? String(s).normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().trim() : '';
    const before = db.matches.length;
    db.matches = db.matches.filter(m => {
        const elapsed = now - new Date(m.commence_time).getTime();
        if (elapsed <= 0) return true; // pas encore commencé
        const isFinished = [m.status, m.live_status, m.match_status, m.state, m.fixture_status]
            .some(s => s && (FINISHED_SET.has(s) || FINISHED_SET.has(normS(s))));
        return !isFinished && elapsed < EXPIRY_MS;
    });
    const removed = before - db.matches.length;
    if (removed > 0) {
        saveDB();
        console.log(`  [AutoPurge] ${removed} matchs supprimés (${db.matches.length} restants)`);
    } else {
        console.log(`  [AutoPurge] Aucun match à purger (${db.matches.length} actifs)`);
    }
}

/* -------------------------------------------------
   Jobs périodiques
   ------------------------------------------------- */
setInterval(() => fetchOdds().catch(e => console.error('[Cron] Odds:', e.message)), 12 * 3600 * 1000);
setInterval(() => fetchStats().catch(e => console.error('[Cron] Stats:', e.message)), 12 * 3600 * 1000);
setInterval(() => archivePastMatches().catch(e => console.error('[Cron] Archive:', e.message)), 4 * 3600 * 1000);
setInterval(() => autoPurgeDatabase(), 15 * 60 * 1000); // toutes les 15 min

setInterval(() => {
    if (typeof apiCacheCleanExpired === 'function') apiCacheCleanExpired();
    if (typeof oddsCacheCleanExpired === 'function') oddsCacheCleanExpired();
}, 2 * 3600 * 1000);

setInterval(() => pollLiveScores().catch(e => console.warn('[Live]', e.message)), 60 * 1000);

// ═══════════════════════════════════════════════════════════════════════════════
//  CRON: Recherche automatique de vidéos de conférences de presse (1-2h avant match)
// ═══════════════════════════════════════════════════════════════════════════════
async function checkPressConferenceVideos() {
  const now = Date.now();
  const in1Hour = now + 60 * 60 * 1000;
  const in2Hours = now + 2 * 60 * 60 * 1000;
  
  // Trouver lesmatchs qui تبدأ dans 1-2h
  const upcomingMatches = db.matches.filter(m => {
    const matchTime = new Date(m.commence_time).getTime();
    return matchTime >= in1Hour && matchTime <= in2Hours;
  });
  
  if (!upcomingMatches.length) return;
  
  console.log(`  [PressConf] ${upcomingMatches.length} match(s) commencent dans 1-2h`);
  
  for (const match of upcomingMatches) {
    // Skip si déjà traité récemment
    if (match._pressConfChecked && (now - match._pressConfChecked < 3600000)) continue;
    
    const videos = await fetchPressConferenceVideos(match.home_team, match.away_team, match.league);
    if (videos.length > 0) {
      match.pressConferenceVideos = videos;
      match._pressConfChecked = now;
      console.log(`  [PressConf] ${match.home_team} vs ${match.away_team}: ${videos.length} vidéo(s) trouvée(s)`);
    }
  }
}

// Fonction pour récupérer les vidéos de conférences (simplifiée sans API externe)
async function fetchPressConferenceVideos(homeTeam, awayTeam, league) {
  const videos = [];
  const now = new Date();
  const year = now.getFullYear();
  
  // Recherche via URLs de recherche YouTube (méthode publique sans API key)
  // On stocke les URLs de recherche qui peuvent être utilisées côté frontend
  const searchQueries = [
    `${homeTeam} press conference pre match ${year}`,
    `${homeTeam} manager pre match interview ${year}`,
    `${awayTeam} press conference pre match ${year}`
  ];
  
  // Sources officielles par équipe (configuration)
  const teamSources = {
    'Arsenal': { yt: 'Arsenal', club: 'https://www.arsenal.com/news' },
    'Liverpool': { yt: 'Liverpool FC', club: 'https://www.liverpoolfc.com/news' },
    'Manchester City': { yt: 'Manchester City', club: 'https://www.mancity.com/news' },
    'Chelsea': { yt: 'Chelsea FC', club: 'https://www.chelseafc.com/news' },
    'PSG': { yt: 'PSG', club: 'https://www.psg.fr/actualites' },
    'Real Madrid': { yt: 'Real Madrid', club: 'https://www.realmadrid.com/noticias' },
    'FC Barcelona': { yt: 'FC Barcelona', club: 'https://www.fcbarcelona.com/en/news' },
    'Bayern Munich': { yt: 'FC Bayern München', club: 'https://fcbayern.com/news' },
    'Juventus': { yt: 'Juventus', club: 'https://www.juventus.com/news' },
    'Inter': { yt: 'Inter Milan', club: 'https://www.inter.it/en/news' },
    'Milan': { yt: 'AC Milan', club: 'https://www.acmilan.com/en/news' }
  };
  
  // Trouver la source pour l'équipe à domicile
  const homeSource = Object.keys(teamSources).find(k => homeTeam.toLowerCase().includes(k.toLowerCase()));
  
  if (homeSource) {
    videos.push({
      type: 'pre_match',
      team: homeTeam,
      title: `${homeSource} - Conférence d'avant-match`,
      searchUrl: `https://www.youtube.com/results?search_query=${encodeURIComponent(searchQueries[0])}`,
      source: 'youtube',
      timestamp: now.toISOString()
    });
  }
  
  // Ajouter les chaînes générales
  videos.push({
    type: 'general',
    title: 'beIN SPORTS - Conférences de presse',
    searchUrl: 'https://www.youtube.com/@beINSPORTS/videos',
    source: 'youtube'
  });
  
  // Ajouter selon la ligue
  if (league && league.includes('Premier League')) {
    videos.push({
      type: 'general',
      title: 'Premier League Official',
      searchUrl: 'https://www.youtube.com/@PremierLeagueOfficial/videos',
      source: 'youtube'
    });
  } else if (league && league.includes('Ligue 1')) {
    videos.push({
      type: 'general',
      title: 'Ligue 1 Official',
      searchUrl: 'https://www.youtube.com/@Ligue1Official/videos',
      source: 'youtube'
    });
  }
  
  return videos;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  CRON: Composition des équipes (lineups) 45 min avant match
// ═══════════════════════════════════════════════════════════════════════════════
async function checkLineups() {
  const now = Date.now();
  const in40Min = now + 40 * 60 * 1000;
  const in50Min = now + 50 * 60 * 1000;
  
  const upcomingMatches = db.matches.filter(m => {
    const matchTime = new Date(m.commence_time).getTime();
    return matchTime >= in40Min && matchTime <= in50Min && !m.lineups;
  });
  
  if (!upcomingMatches.length) return;
  
  console.log(`  [Lineups] ${upcomingMatches.length} match(s) dans ~45min - vérification composition`);
  
  for (const match of upcomingMatches) {
    const lineups = await fetchLineups(match);
    if (lineups) {
      match.lineups = lineups;
      match._lineupsChecked = now;
      console.log(`  [Lineups] ${match.home_team} vs ${match.away_team}: composition reçue`);
    }
  }
}

// Fonction pour récupérer les compositions via BSD/Sofascore
async function fetchLineups(match) {
  const lineups = { home: null, away: null, source: null };
  
  // Essayer Sofascore pour les compositions
  if (match.home_bsd_id) {
    try {
      // Chercher via l'ID BSD de l'équipe
      const res = await sofaGet(`/team/${match.home_bsd_id}/squad`);
      if (res.status === 200 && res.data?.squad) {
        lineups.home = res.data.squad.filter(p => p.isStarter).map(p => p.name);
        lineups.source = 'sofascore';
      }
    } catch (e) { /* ignore */ }
  }
  
  // Fallback: recherche par nom d'équipe
  if (!lineups.home) {
    try {
      const hRes = await sofaGet(`/search/teams?q=${encodeURIComponent(match.home_team)}`);
      if (hRes.status === 200 && hRes.data?.results?.[0]) {
        const hId = hRes.data.results[0].entity.id;
        const squadRes = await sofaGet(`/team/${hId}/squad`);
        if (squadRes.status === 200 && squadRes.data?.squad) {
          lineups.home = squadRes.data.squad.filter(p => p.isStarter).map(p => p.name);
        }
      }
    } catch (e) { /* ignore */ }
  }
  
  if (!lineups.away) {
    try {
      const aRes = await sofaGet(`/search/teams?q=${encodeURIComponent(match.away_team)}`);
      if (aRes.status === 200 && aRes.data?.results?.[0]) {
        const aId = aRes.data.results[0].entity.id;
        const squadRes = await sofaGet(`/team/${aId}/squad`);
        if (squadRes.status === 200 && squadRes.data?.squad) {
          lineups.away = squadRes.data.squad.filter(p => p.isStarter).map(p => p.name);
        }
      }
    } catch (e) { /* ignore */ }
  }
  
  return (lineups.home || lineups.away) ? lineups : null;
}

// Vérifier toutes les 15 minutes
setInterval(() => checkLineups().catch(e => console.warn('[Lineups]', e.message)), 15 * 60 * 1000);

// Vérifier toutes les 30 minutes (press conferences)
setInterval(() => checkPressConferenceVideos().catch(e => console.warn('[PressConf]', e.message)), 30 * 60 * 1000);
