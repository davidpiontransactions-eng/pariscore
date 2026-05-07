/**
 * ══════════════════════════════════════════════════════════════════════════════
 *  PariScore — Backend Serveur-Centrique v2.0
 * ══════════════════════════════════════════════════════════════════════════════
 *  Zéro dépendance npm. Modules Node.js natifs uniquement.
 *
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

const http     = require('http');
const https    = require('https');
const fs       = require('fs');
const path     = require('path');
const crypto   = require('crypto');
const Database = require('better-sqlite3');

// ─── CONFIGURATION ──────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
const SQLITE_FILE   = process.env.DATABASE_PATH || path.join(__dirname, 'pariscore.db');
// Conservés uniquement pour migration one-shot depuis les anciens fichiers JSON
const DB_FILE       = path.join(__dirname, 'database.json');
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

const ODDS_API_KEY            = process.env.ODDS_API_KEY;
const API_FOOTBALL_KEY        = process.env.API_FOOTBALL_KEY;
const GEMINI_API_KEY          = process.env.GEMINI_API_KEY;
const GROQ_API_KEY            = process.env.GROQ_API_KEY || '';
const GROQ_MODEL              = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
const PARLAY_API_HOST         = process.env.PARLAY_API_HOST;
const PARLAY_API_PATH         = process.env.PARLAY_API_PATH || '/parlay';
const PARLAY_API_KEY          = process.env.PARLAY_API_KEY;
const GAMEFORECAST_API_HOST   = process.env.GAMEFORECAST_API_HOST;
const GAMEFORECAST_API_PATH   = process.env.GAMEFORECAST_API_PATH || '/forecast';
const GAMEFORECAST_API_KEY    = process.env.GAMEFORECAST_API_KEY;

if (!ODDS_API_KEY)           console.warn('  ⚠ ODDS_API_KEY manquante dans .env');
if (!API_FOOTBALL_KEY)       console.warn('  ⚠ API_FOOTBALL_KEY manquante dans .env');
if (PARLAY_API_HOST && !PARLAY_API_KEY) console.warn('  ⚠ PARLAY_API_KEY manquante pour Parlay-API dans .env');
if (GAMEFORECAST_API_HOST && !GAMEFORECAST_API_KEY) console.warn('  ⚠ GAMEFORECAST_API_KEY manquante pour GameForecast dans .env');

// ─── SÉCURITÉ ────────────────────────────────────────────────────────────────
const BLOCKED_FILES = ['.env', 'database.json', 'history.json', 'ai_cache.json', 'pariscore.db', 'package.json', 'package-lock.json', '.gitignore'];
const BLOCKED_DIRS  = ['.git', 'node_modules'];
const MAX_BODY_SIZE = 1 * 1024 * 1024; // 1 Mo
const STATS_TTL     = 6 * 3600000;    // 6h entre les mises à jour stats
const ADV_STATS_TTL = 24 * 3600000;   // 24h cache stats avancées /teams/statistics
const AI_CACHE_TTL  = 24 * 3600000;   // 24h cache analyses Power Score par match

// Paramètres Gemini partagés — sécurité BLOCK_NONE pour éviter les faux-positifs sur les stats sportives
const GEMINI_SAFETY_SETTINGS = [
  { category: 'HARM_CATEGORY_HARASSMENT',        threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_HATE_SPEECH',       threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
];

const POWER_SCORE_LIMITS = {
  freemium:  { daily: 1,  label: 'Freemium (1/jour)' },
  matchday:  { daily: 5,  label: 'Matchday Pass (5/24h)' },
  premium:   { daily: 999, label: 'Premium (illimité)' },
  admin:     { daily: 999, label: 'Admin (illimité)' },
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
8. 📲 SCRIPT TELEGRAM (À mettre impérativement dans un bloc de code avec le tag \`\`\`telegram pour être copié facilement) :
Rédige un message Telegram dynamique, enthousiaste, utilisant le symbole ¤ comme puces, reprenant le résumé de l'analyse, la stat "cadeau" (souvent les corners) et proposant le meilleur combo à ta communauté. N'oublie pas l'appel à l'action à la fin (ex: "Mettez un 🔥 si vous validez !").

[DIRECTIVES CRITIQUES]
- Utilise EXCLUSIVEMENT les données mathématiques fournies dans le bloc [DONNÉES PARISCORE] ci-dessous.
- Ne jamais inventer des probabilités — utilise celles calculées par notre algorithme Poisson.
- Utilise un ton d'expert, sûr de lui, mais qui explique la logique mathématique derrière chaque choix.`;

// ═══════════════════════════════════════════════════════════════════════════════
//  POWER SCORE V2 — Contexte Presse Réelle (RSS + GNews)
// ═══════════════════════════════════════════════════════════════════════════════

const GNEWS_API_KEY   = process.env.GNEWS_API_KEY || '';
const PRESS_CACHE_TTL = 24 * 3600000; // 24h

// Flux RSS des sources de référence (zéro API key)
const RSS_FEEDS = [
  { url: 'https://www.lequipe.fr/rss.xml',                   lang: 'fr', source: "L'Equipe"   },
  { url: 'https://feeds.bbci.co.uk/sport/football/rss.xml',  lang: 'en', source: 'BBC Sport'  },
  { url: 'https://www.skysports.com/rss/12040',               lang: 'en', source: 'Sky Sports' },
  { url: 'https://www.espn.com/espn/rss/soccer/news',         lang: 'en', source: 'ESPN FC'   },
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
  const cached   = kvGet(cacheKey);
  if (cached && (Date.now() - new Date(cached.fetchedAt).getTime() < PRESS_CACHE_TTL)) {
    return { text: cached.text || cached.data || '', articleCount: cached.articleCount || 0, sourceNames: cached.sourceNames || [] };
  }

  // Fetch RSS en parallèle + GNews combiné (+ per-team si résultats insuffisants)
  const combinedQuery = `${homeTeam} ${awayTeam}`;
  const [rssResults, gnewsItems] = await Promise.all([
    Promise.all(RSS_FEEDS.map(async feed => {
      const xml   = await fetchRSS(feed.url);
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
  const p = match.poisson || {};
  const eg = match.expectedGoals || {};
  const hs = match.stats?.home || {};
  const as = match.stats?.away || {};
  const dt = new Date(match.commence_time);
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
  const parts    = relative.split(path.sep);
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

// ─── VERROU ANTI-RACE-CONDITION ──────────────────────────────────────────────
let isFetchingOdds  = false;
let isFetchingStats = false;

// ─── SSE CLIENTS ─────────────────────────────────────────────────────────────
const sseClients = new Set(); // connexions SSE actives

function broadcastSSE(eventName, data) {
  const payload = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of sseClients) {
    try { res.write(payload); } catch(e) { sseClients.delete(res); }
  }
}

function buildMeta() {
  return {
    lastOddsUpdate:  db.lastOddsUpdate,
    lastStatsUpdate: db.lastStatsUpdate,
    status:          db.status,
    oddsQuota:       db.oddsQuotaRemaining,
    statsQuota:      db.statsQuotaRemaining,
  };
}
// Chargement dynamique de la configuration des ligues
const LEAGUES_CONFIG_FILE = path.join(__dirname, 'leagues_config.json');
let leaguesConfig = { leagues: [] };
try {
  leaguesConfig = JSON.parse(fs.readFileSync(LEAGUES_CONFIG_FILE, 'utf8'));
  console.log(`  ✓ leagues_config.json chargé (${leaguesConfig.leagues.length} ligues)`);
} catch(e) {
  console.warn('  ⚠ leagues_config.json introuvable — ligues par défaut utilisées');
  leaguesConfig = { leagues: [
    { id: 61,  name: 'Ligue 1',          type: 'T1', odds_key: 'soccer_france_ligue1',      cron_hours: 6  },
    { id: 39,  name: 'Premier League',   type: 'T1', odds_key: 'soccer_epl',                cron_hours: 6  },
    { id: 2,   name: 'Champions League', type: 'T1', odds_key: 'soccer_uefa_champs_league', cron_hours: 6  },
    { id: 140, name: 'La Liga',          type: 'T1', odds_key: 'soccer_spain_la_liga',      cron_hours: 6  },
    { id: 78,  name: 'Bundesliga',       type: 'T1', odds_key: 'soccer_germany_bundesliga', cron_hours: 6  },
    { id: 135, name: 'Serie A',          type: 'T1', odds_key: 'soccer_italy_serie_a',      cron_hours: 6  },
    { id: 3,   name: 'Europa League',    type: 'T1', odds_key: 'soccer_uefa_europa_league', cron_hours: 6  },
  ]};
}

const SPORT_LABELS = {};
leaguesConfig.leagues.forEach(l => { if (l.odds_key) SPORT_LABELS[l.odds_key] = l.name; });
const ALL_SPORTS   = leaguesConfig.leagues.filter(l => l.odds_key).map(l => l.odds_key);
const ALL_LEAGUE_IDS  = leaguesConfig.leagues.filter(l => l.id).map(l => l.id);
// Délai de refresh par ligue (en ms) — T1: 6h, T2: 12h (depuis cron_hours dans leagues_config.json)
const LEAGUE_CRON_MS  = {};
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
} catch(e) {
  console.warn('  ⚠ bsd_config.json introuvable — BSD désactivé');
}

const BSD_API_KEY = bsdConfig.api_key || process.env.BSD_API_KEY || '';
const BSD_BASE_URL = bsdConfig.base_url || 'https://sports.bzzoiro.com/api';
const BSD_CONFIG_TO_BSD = bsdConfig.mapping?.config_to_bsd || {};
const BSD_BSD_TO_CONFIG = bsdConfig.mapping?.bsd_to_config || {};
const BSD_FALLBACK_NEEDED = bsdConfig.mapping?.fallback_needed || [];

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
    } catch(e) {
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

// Obtenir la saison courante BSD (année de début)
function bsdCurrentSeasonYear() {
  const now = new Date();
  return now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
}

// ─── BASE DE DONNÉES EN MÉMOIRE ─────────────────────────────────────────────
let db = {
  matches:            [],   // matchs fusionnés (odds + stats)
  teamStats:          {},   // stats par équipe (standings API-Football)
  advancedTeamStats:  {},   // stats avancées /teams/statistics — cache 24h
  topScorers:         {},   // top buteurs par ligue (leagueId_season) — cache 24h
  lastOddsUpdate:      null, // ISO timestamp
  lastStatsUpdate:     null,
  statsUpdateByLeague: {},  // ISO timestamp par leagueId — gestion quotas T1/T2
  oddsQuotaRemaining:  null,
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
  // Seed 1xBet par défaut (modifie l'affiliate_link après inscription)
  const has1xbet = sqldb.prepare('SELECT id FROM affiliates WHERE bookmaker = ?').get('1xbet');
  if (!has1xbet) {
    sqldb.prepare(`INSERT INTO affiliates (bookmaker, name, affiliate_link, deeplink_template, promo_code, commission_type, commission_rate, active, priority)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      '1xbet', '1xBet - Meilleures Cotes',
      'https://refpa7902968.top/L?tag=d_YOUR_TAG&site=YOUR_SITE_ID&banner=YOUR_BANNER_ID',
      'https://1xbet.com/fr/live?sport={sport}&event={event_id}',
      'PARISCORE2026', 'revshare', 30, 1, 10
    );
    console.log('  ✓ Affilié 1xBet ajouté (modifie le lien après inscription)');
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

// ─── POWER SCORE USAGE TRACKING ───────────────────────────────────────
const POWER_SCORE_COOLDOWN_IP = new Map(); // IP -> { count, reset }

function getPowerScoreUsage(userId) {
  const raw = kvGet(`ps_usage_${userId}`);
  if (!raw) return { count: 0, reset: Date.now() + 24*3600*1000 };
  if (Date.now() > raw.reset) return { count: 0, reset: Date.now() + 24*3600*1000 };
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
  kvSetBatch([
    ['db_matches',    db.matches],
    ['db_team_stats', db.teamStats],
    ['db_adv_stats',  db.advancedTeamStats],
    ['db_top_scorers',db.topScorers],
    ['db_meta',       { status: db.status, lastOddsUpdate: db.lastOddsUpdate, lastStatsUpdate: db.lastStatsUpdate, oddsQuotaRemaining: db.oddsQuotaRemaining, statsUpdateByLeague: db.statsUpdateByLeague }],
  ]);
}

function loadDB() {
  // Rétrocompat : migration one-shot depuis database.json
  if (fs.existsSync(DB_FILE)) {
    try {
      const old = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
      db = { ...db, ...old };
      if (!db.advancedTeamStats) db.advancedTeamStats = {};
      if (!db.topScorers)        db.topScorers = {};
      saveDB();
      fs.renameSync(DB_FILE, DB_FILE + '.migrated');
      console.log(`  ✓ database.json migré vers SQLite (${db.matches.length} matchs)`);
      return;
    } catch(e) { console.warn('[DB] Migration JSON→SQLite échouée:', e.message); }
  }

  db.matches             = kvGet('db_matches',    []);
  db.teamStats           = kvGet('db_team_stats', {});
  db.advancedTeamStats   = kvGet('db_adv_stats',  {});
  db.topScorers          = kvGet('db_top_scorers',{});
  const meta             = kvGet('db_meta', {});
  db.status               = meta.status               || 'initialisation';
  db.lastOddsUpdate       = meta.lastOddsUpdate       || null;
  db.lastStatsUpdate      = meta.lastStatsUpdate      || null;
  db.statsUpdateByLeague  = meta.statsUpdateByLeague  || {};
  db.oddsQuotaRemaining   = meta.oddsQuotaRemaining   || null;
  console.log(`  ✓ SQLite chargé (${db.matches.length} matchs, ${Object.keys(db.teamStats).length} équipes, ${Object.keys(db.advancedTeamStats).length} stats avancées)`);
}

// ─── UTILS HTTPS ─────────────────────────────────────────────────────────────
function formatIsoTimestamp(date) {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function formatDateOnly(date) {
  return date.toISOString().slice(0, 10);
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
        } catch(e) {
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
        catch(e) { resolve({ status: res.statusCode, data }); }
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
      { home_team: 'PSG', away_team: 'Olympique Lyonnais', league: 'Ligue 1', commence_time: new Date(Date.now() + 2*3600000).toISOString(), odds: { home: 1.45, draw: 4.20, away: 7.80 } },
      { home_team: 'Manchester City', away_team: 'Liverpool', league: 'Premier League', commence_time: new Date(Date.now() + 4*3600000).toISOString(), odds: { home: 2.10, draw: 3.40, away: 3.20 } },
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
  } catch(e) {
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
  } catch(e) {
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
      dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1]
        : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
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
function cleanExpiredMatches() {
  const cutoff = Date.now() - 150 * 60 * 1000; // 150min = 90min + 60min buffer pour prolongations/VAR
  const before = db.matches.length;
  db.matches = db.matches.filter(m => m.live_score || new Date(m.commence_time).getTime() > cutoff);
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
      if (total > 0)  over05 += p;
      if (total > 1)  over15 += p;
      if (total > 2)  over25 += p;
      if (total > 3)  over35 += p;
      if (total <= 1) under15 += p;
      if (h > 0 && a > 0) btts += p;
      if (h === 0 && a === 0) cs00 = p;
      if (h > a)  homeWin += p;
      if (h === a) draw += p;
      if (h < a)  awayWin += p;
    }
  }

  // Top 5 scores les plus probables
  const scores = [];
  for (let h = 0; h < MAX; h++)
    for (let a = 0; a < MAX; a++)
      scores.push({ score: `${h}-${a}`, prob: matrix[h][a] });
  scores.sort((a, b) => b.prob - a.prob);

  return {
    over05:  Math.round(over05 * 100),
    over15:  Math.round(over15 * 100),
    over25:  Math.round(over25 * 100),
    over35:  Math.round(over35 * 100),
    btts:    Math.round(btts * 100),
    under15: Math.round(under15 * 100),
    cs00:    Math.round(cs00 * 100),
    homeWin: Math.round(homeWin * 100),
    draw:    Math.round(draw * 100),
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
  { min: 0,  max: 10, raw: 5,  calibrated: 4   },  // Modèle surestime les improbables
  { min: 10, max: 20, raw: 15,  calibrated: 13  },
  { min: 20, max: 30, raw: 25,  calibrated: 23  },
  { min: 30, max: 40, raw: 35,  calibrated: 33  },
  { min: 40, max: 50, raw: 45,  calibrated: 44  },
  { min: 50, max: 60, raw: 55,  calibrated: 55  },  // Zone bien calibrée
  { min: 60, max: 70, raw: 65,  calibrated: 64  },
  { min: 70, max: 80, raw: 75,  calibrated: 72  },  // Modèle sous-estime les probables
  { min: 80, max: 90, raw: 85,  calibrated: 80  },
  { min: 90, max: 100,raw: 95,  calibrated: 88  },
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
  const liveMatches = db.matches.filter(m => m.live_score && m.live_minute && m.live_minute > 5 && m.live_minute < 85);
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
  const gf = s?.goals?.for || 0, ga = s?.goals?.against || 0;
  const avgFor = gf / played, avgAgainst = ga / played;
  return {
    ppg:        parseFloat(((w * 3 + d) / played).toFixed(2)),
    wins:       Math.round(w / played * 100),
    draws:      Math.round(d / played * 100),
    losses:     Math.round(l / played * 100),
    scored:     Math.round(Math.min(95, (gf > 0 ? 1 : 0) / played * 100 || avgFor * 55)),
    conceded:   Math.round(Math.min(95, (ga > 0 ? 1 : 0) / played * 100 || avgAgainst * 50)),
    avgScored:  parseFloat(avgFor.toFixed(2)),
    avgConceded:parseFloat(avgAgainst.toFixed(2)),
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
  const avgAg  = parseFloat(((r(9 + side, 60, 200)) / 100).toFixed(2));
  return {
    ppg:        parseFloat(((wins * 3 + draws) / 100).toFixed(2)),
    wins, draws, losses,
    scored:     r(6 + side, 52, 93),
    conceded:   r(7 + side, 40, 88),
    avgScored:  avgFor,
    avgConceded:avgAg,
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
      if (o.name === home   && (!bestH || o.price > bestH)) { bestH = o.price; bestHbk = bk.title; }
      if (o.name === 'Draw' && (!bestN || o.price > bestN)) { bestN = o.price; bestNbk = bk.title; }
      if (o.name === away   && (!bestA || o.price > bestA)) { bestA = o.price; bestAbk = bk.title; }
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
    { label: home,  odds: bestH, edge: edgeH, bk: bestHbk, prob: fair.home },
    { label: 'Nul', odds: bestN, edge: edgeN, bk: bestNbk, prob: fair.draw },
    { label: away,  odds: bestA, edge: edgeA, bk: bestAbk, prob: fair.away },
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

function buildMatchRecord(raw) {
  const edge = computeEdge(raw);
  if (!edge) return null;

  const hKey = normName(raw.home_team);
  const aKey = normName(raw.away_team);
  let hRaw = db.teamStats[hKey] || findFuzzy(hKey);
  let aRaw = db.teamStats[aKey] || findFuzzy(aKey);

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

  const homeStats = hRaw?.home  || simStats(raw.home_team, true);
  const awayStats = aRaw?.away  || simStats(raw.away_team, false);
  const isRealData = !!(hRaw?._real && aRaw?._real);

  if (!hRaw) console.warn(`  [BuildMatch] "${raw.home_team}" (Home) — stats simulées (non trouvé en DB)`);
  if (!aRaw) console.warn(`  [BuildMatch] "${raw.away_team}" (Away) — stats simulées (non trouvé en DB)`);

  // Expected goals (Poisson λ) : attaque dom × défense ext / ligue moyenne (~1.35)
  const LEAGUE_AVG = 1.35;
  const expHome = (homeStats.avgScored / LEAGUE_AVG) * (awayStats.avgConceded || LEAGUE_AVG);
  const expAway = (awayStats.avgScored / LEAGUE_AVG) * (homeStats.avgConceded || LEAGUE_AVG);
  const poisson = computePoisson(expHome, expAway);

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
  const pEdgeH  = edge.odds.home ? parseFloat(((edge.odds.home * pFairH - 1) * 100).toFixed(1)) : null;
  const pEdgeN  = edge.odds.draw ? parseFloat(((edge.odds.draw * pFairN - 1) * 100).toFixed(1)) : null;
  const pEdgeA  = edge.odds.away ? parseFloat(((edge.odds.away * pFairA - 1) * 100).toFixed(1)) : null;
  const pEdges  = [
    { label: raw.home_team, edge: pEdgeH },
    { label: 'Nul',         edge: pEdgeN },
    { label: raw.away_team, edge: pEdgeA },
  ].filter(x => x.edge !== null);
  const bestPoissonEdge = pEdges.length ? pEdges.reduce((a, b) => b.edge > a.edge ? b : a) : null;

  // PariScore Shield : convergence modèle blendé + Marché sur le même résultat
  const shield = !!(
    edge.best.edge > 5 &&
    bestPoissonEdge?.edge > 0 &&
    bestPoissonEdge?.label === edge.best.label
  );

  const record = {
    id:            raw.id,
    sport:         raw._sport || raw.sport_key,
    league:        SPORT_LABELS[raw._sport || raw.sport_key] || raw.sport_title || '?',
    commence_time: raw.commence_time,
    home_team:     raw.home_team,
    away_team:     raw.away_team,
    home_rank:     hRaw?.rank || null,
    away_rank:     aRaw?.rank || null,
    home_form:     hRaw?.form || db.teamStats[hKey]?.form || findFuzzy(hKey)?.form || '',
    away_form:     aRaw?.form || db.teamStats[aKey]?.form || findFuzzy(aKey)?.form || '',
    odds:          edge.odds,
    bookmakers:    edge.bookmakers,
    fair:          edge.fair,
    edge:          edge.edgeValues,
    best_edge:     edge.best,
    poisson,
    blended,
    calibrated,
    evs,
    expectedGoals: { home: parseFloat(expHome.toFixed(2)), away: parseFloat(expAway.toFixed(2)) },
    poissonEdge:   bestPoissonEdge,
    shield,
    elo:           eloProbs,
    xgLogistic:    xgProbs,
    margin:        edge.margin,
    devigMethod:   edge.devigMethod,
    stats: {
      home: homeStats,
      away: awayStats,
      isReal: isRealData,
    },
  };

  // Dropping Odds Tracker — snapshot et calcul delta
  const snapKey = `odds_snap_${record.id}`;
  const prevSnap = kvGet(snapKey);
  if (prevSnap && prevSnap.home != null) {
    const dHome = record.odds?.home != null ? parseFloat((record.odds.home - prevSnap.home).toFixed(2)) : null;
    const dDraw = record.odds?.draw != null ? parseFloat((record.odds.draw - prevSnap.draw).toFixed(2)) : null;
    const dAway = record.odds?.away != null ? parseFloat((record.odds.away - prevSnap.away).toFixed(2)) : null;
    record.odds_delta = { home: dHome, draw: dDraw, away: dAway, ts: prevSnap.ts };
  } else {
    record.odds_delta = null;
  }
  if (record.odds?.home != null) {
    kvSet(snapKey, { home: record.odds.home, draw: record.odds.draw, away: record.odds.away, ts: Date.now() });
  }

  // Injuries — lookup synchrone depuis cache SQLite KV (pré-chargé par fetchTeamInjuries)
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
  const homeInjCount = Math.min((record.injuries.home || []).length, 6);
  const awayInjCount = Math.min((record.injuries.away || []).length, 6);
  record.injuryPenalty = {
    home: Math.min(homeInjCount * 5, 30),
    away: Math.min(awayInjCount * 5, 30),
  };

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
      history  = raw.matches  || [];
      accuracy = raw.accuracy || accuracy;
      saveHistory();
      fs.renameSync(HISTORY_FILE, HISTORY_FILE + '.migrated');
      console.log(`  ✓ history.json migré vers SQLite (${history.length} matchs archivés)`);
      return;
    } catch(e) { console.warn('[History] Migration JSON→SQLite:', e.message); }
  }

  history  = kvGet('history_matches',  []);
  accuracy = kvGet('history_accuracy', accuracy);
  console.log(`  ✓ Historique SQLite chargé (${history.length} matchs archivés)`);
}

function saveHistory() {
  kvSetBatch([
    ['history_matches',  history],
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
    } catch(e) { console.warn('[AICache] Migration JSON→SQLite:', e.message); }
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
  } catch(e) {
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
        } catch(e) { /* score unavailable */ }
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
    }

    const archivedIds = new Set(past.map(m => m.id));
    db.matches = db.matches.filter(m => !archivedIds.has(m.id));
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
        } catch(e) { /* still unavailable */ }
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
  const weeksMap = {};
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
    btts:   { rate: pct(accuracy.btts_correct, accuracy.btts_total), sample: accuracy.btts_total },
    edge:   { rate: pct(accuracy.edge_correct, accuracy.edge_total), sample: accuracy.edge_total },
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
    btts:   { rate: pct(rBttsc, rBttst), sample: rBttst },
    edge:   { rate: pct(rEdgec, rEdget), sample: rEdget },
  };

  // ── Auto-alerte rolling20 ────────────────────────────────────────────────────
  const last20 = history.filter(h => h.verified).slice(-20);
  let aOver25c = 0, aOver25t = 0, aBttsc = 0, aBttst = 0;
  for (const h of last20) {
    if (!h.realScore) continue;
    const rs = h.realScore;
    if (h.predicted?.over25 > 55) { aOver25t++; if ((rs.home+rs.away)>2.5) aOver25c++; }
    if (h.predicted?.btts > 55) { aBttst++; if (rs.home>0 && rs.away>0) aBttsc++; }
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
      btts:   { rate: pct(d.bttsc, d.bttst), sample: d.bttst },
      edge:   { rate: pct(d.edgec, d.edget), sample: d.edget },
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
      goals_scored_home_avg:    parseFloat(raw.goals?.for?.average?.home  || 0),
      goals_scored_away_avg:    parseFloat(raw.goals?.for?.average?.away  || 0),
      goals_conceded_home_avg:  parseFloat(raw.goals?.against?.average?.home || 0),
      goals_conceded_away_avg:  parseFloat(raw.goals?.against?.average?.away || 0),

      // Pilier 2 — Croissance de forme (5 derniers matchs)
      form: raw.form || '',

      // Pilier 3 — Résultats à domicile / extérieur (différentiel)
      played_home:  raw.fixtures?.played?.home  || 0,
      played_away:  raw.fixtures?.played?.away  || 0,
      wins_home:    raw.fixtures?.wins?.home    || 0,
      wins_away:    raw.fixtures?.wins?.away    || 0,
      draws_home:   raw.fixtures?.draws?.home   || 0,
      draws_away:   raw.fixtures?.draws?.away   || 0,
      losses_home:  raw.fixtures?.losses?.home  || 0,
      losses_away:  raw.fixtures?.losses?.away  || 0,

      // Pilier 4 — Indice spéculatif (pénaltys, biggest wins, streaks)
      penalties_scored: raw.penalty?.scored?.total  || 0,
      penalties_missed: raw.penalty?.missed?.total  || 0,
      biggest_win_home: raw.biggest?.wins?.home     || '',
      biggest_win_away: raw.biggest?.wins?.away     || '',
      biggest_loss_home:raw.biggest?.loses?.home    || '',
      biggest_loss_away:raw.biggest?.loses?.away    || '',
      streak_wins:      raw.biggest?.streak?.wins   || 0,
      streak_draws:     raw.biggest?.streak?.draws  || 0,
      streak_losses:    raw.biggest?.streak?.loses  || 0,

      // Pilier 2 — Tirs (disponibles dans /teams/statistics)
      shots_on_home:  raw.shots?.on?.home  || 0,
      shots_on_away:  raw.shots?.on?.away  || 0,
      shots_on_total: raw.shots?.on?.total || 0,
      shots_total_home:  raw.shots?.total?.home  || 0,
      shots_total_away:  raw.shots?.total?.away  || 0,

      // Pilier 5 — Schéma tactique (formation dominante)
      main_formation: raw.lineups?.[0]?.formation   || 'N/A',

      // Pilier 6 — Discipline (cartons — somme de toutes les tranches horaires)
      cards_yellow_total:    Object.values(raw.cards?.yellow || {}).reduce((s, v) => s + (v.total || 0), 0),
      cards_red_total:       Object.values(raw.cards?.red    || {}).reduce((s, v) => s + (v.total || 0), 0),

      // Pilier 7 — Clean Sheets
      clean_sheet_home:  raw.clean_sheet?.home  || 0,
      clean_sheet_away:  raw.clean_sheet?.away  || 0,
      clean_sheet_total: raw.clean_sheet?.total || 0,

      // Moyennes globales (pour le classement mode "Global")
      goals_scored_total_avg:    parseFloat(raw.goals?.for?.average?.total    || 0),
      goals_conceded_total_avg:  parseFloat(raw.goals?.against?.average?.total || 0),
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

  } catch(e) {
    console.warn(`  [AdvStats] Erreur ${teamKey}:`, e.message);
    return null;
  }
}

// ─── GEMINI RESILIENCE LAYER v76 ─────────────────────────────────────────────

// 1. Concurrency queue (1 call at a time) + depth tracker
let _geminiQueueTail = Promise.resolve();
let _geminiQueueSize = 0;
function geminiEnqueue(fn) {
  _geminiQueueSize++;
  const slot = _geminiQueueTail.then(async () => {
    try { return await fn(); } finally { _geminiQueueSize = Math.max(0, _geminiQueueSize - 1); }
  });
  _geminiQueueTail = slot.catch(() => {});
  return slot;
}

// 2. Per-match in-flight deduplication
const _geminiInFlight = new Map(); // matchId → Promise<result>

// 3. Throttle: minimum 15s between consecutive Gemini calls (no burst allowed)
const GEMINI_THROTTLE_MS = parseInt(process.env.GEMINI_THROTTLE_MS || '15000', 10);
let _geminiLastCallTime = 0;
function geminiThrottleMs() {
  const gap = Date.now() - _geminiLastCallTime;
  return gap >= GEMINI_THROTTLE_MS ? 0 : GEMINI_THROTTLE_MS - gap;
}
function geminiMarkCall() { _geminiLastCallTime = Date.now(); }

// 4. RPM safety net (backup counter, separate from throttle)
const GEMINI_RPM_LIMIT = parseInt(process.env.GEMINI_RPM_LIMIT || '15', 10);
let _geminiCallsThisMinute = 0;
let _geminiRateLimitReset  = Date.now() + 60000;
function geminiRateLimitOk() {
  const now = Date.now();
  if (now >= _geminiRateLimitReset) { _geminiCallsThisMinute = 0; _geminiRateLimitReset = now + 60000; }
  if (_geminiCallsThisMinute >= GEMINI_RPM_LIMIT) return false;
  _geminiCallsThisMinute++;
  return true;
}

async function callGeminiWithRetry(prompt, maxTokens = 600) {
  if (!GEMINI_API_KEY) throw new Error('Clé Gemini non configurée');
  const delays = [2000, 5000, 10000];
  let lastErr;
  for (let attempt = 0; attempt < delays.length; attempt++) {
    if (delays[attempt] > 0) await new Promise(r => setTimeout(r, delays[attempt]));
    try {
      const res = await httpsPost(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: maxTokens },
          safetySettings: GEMINI_SAFETY_SETTINGS,
        }
      );
      if (res.status === 429) {
        console.warn(`  [Gemini] 429 quota — tentative ${attempt + 1}/${delays.length}`);
        lastErr = new Error('GEMINI_429');
        continue;
      }
      const text = res.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      if (!text && res.status !== 200) throw new Error(`Gemini HTTP ${res.status}`);
      return text;
    } catch(e) {
      if (e.message === 'GEMINI_429') { lastErr = e; continue; }
      throw e;
    }
  }
  throw lastErr || new Error('GEMINI_429');
}

async function callGemini(prompt, maxTokens = 600) {
  return geminiEnqueue(async () => {
    // Enforce 15s minimum gap between consecutive calls (no burst)
    const wait = geminiThrottleMs();
    if (wait > 0) {
      console.log(`  [Gemini] Throttle — attente ${wait}ms avant prochain appel`);
      await new Promise(r => setTimeout(r, wait));
    }
    geminiMarkCall();
    return callGeminiWithRetry(prompt, maxTokens);
  });
}

// ─── GROQ (Llama 3) — second provider fallback ───────────────────────────────
async function callGroq(prompt, maxTokens = 1500) {
  if (!GROQ_API_KEY) throw new Error('GROQ_UNAVAILABLE');
  const res = await httpsPost(
    'https://api.groq.com/openai/v1/chat/completions',
    {
      model: GROQ_MODEL,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: maxTokens,
      temperature: 0.7,
    },
    { Authorization: `Bearer ${GROQ_API_KEY}` }
  );
  if (res.status === 429) throw new Error('GROQ_429');
  if (res.status !== 200) throw new Error(`GROQ_HTTP_${res.status}`);
  const text = res.data?.choices?.[0]?.message?.content || '';
  if (!text) throw new Error('GROQ_EMPTY');
  return text;
}

// ─── UNIVERSAL SCOUT — cascade Gemini → Groq → Math ─────────────────────────
async function callUniversalAI(prompt, maxTokens = 1500) {
  // 1. Groq first — fast, generous quota, no throttle
  try {
    const text = await callGroq(prompt, maxTokens);
    console.log('  [Universal] ✓ Groq');
    return { text, provider: 'groq' };
  } catch(e) {
    console.warn(`  [Universal] Groq échec (${e.message}) → basculement Gemini`);
  }
  // 2. Gemini fallback (queue + 15s throttle + backoff 2s/5s/10s)
  try {
    const text = await callGemini(prompt, maxTokens);
    console.log('  [Universal] ✓ Gemini');
    return { text, provider: 'gemini' };
  } catch(e) {
    console.warn(`  [Universal] Gemini échec (${e.message}) → fallback math`);
    return null; // signals math fallback
  }
}

// ─── MATH FALLBACK — rapport statistique pur (sans IA) ───────────────────────
function buildMathFallbackReport(match) {
  const p   = match.poisson || {};
  const eg  = match.expectedGoals || {};
  const hs  = match.stats?.home || {};
  const as_ = match.stats?.away || {};
  const dt  = new Date(match.commence_time);
  const dateStr = dt.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const timeStr = dt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  const signal = (pct, hi = 55, lo = 45) =>
    pct >= hi ? '🟢 Fort' : pct >= lo ? '🟡 Moyen' : '🔴 Faible';

  const topScore = p.topScores?.[0];
  const topScore2 = p.topScores?.[1];

  const bestEdgeLine = match.best_edge?.edge > 0
    ? `💎 **Value Bet détecté** : ${match.best_edge.label} @ ${match.best_edge.odds?.toFixed(2) ?? '?'} — Edge **+${match.best_edge.edge?.toFixed(1) ?? '?'}%** via ${match.best_edge.bk ?? 'N/A'}`
    : `Aucun edge positif détecté sur ce match.`;

  return `# 🏟️ ${match.home_team} vs ${match.away_team}
## ${match.league} — ${dateStr} à ${timeStr}

---

## 🏅 RAPPORT STATISTIQUE BRUT
> ⚡ *IA surchargée — Analyse statistique certifiée PariScore (données Poisson)*

---

## 📊 PROBABILITÉS MATHÉMATIQUES CERTIFIÉES

| Marché | Probabilité | Signal |
|--------|-------------|--------|
| ${match.home_team} gagne | **${p.homeWin ?? 0}%** | ${signal(p.homeWin ?? 0)} |
| Match Nul | **${p.draw ?? 0}%** | ${signal(p.draw ?? 0, 30, 20)} |
| ${match.away_team} gagne | **${p.awayWin ?? 0}%** | ${signal(p.awayWin ?? 0)} |
| BTTS | **${p.btts ?? 0}%** | ${signal(p.btts ?? 0)} |
| Over 0.5 | **${p.over05 ?? 0}%** | ${signal(p.over05 ?? 0, 85, 70)} |
| Over 1.5 | **${p.over15 ?? 0}%** | ${signal(p.over15 ?? 0, 70, 55)} |
| Over 2.5 | **${p.over25 ?? 0}%** | ${signal(p.over25 ?? 0)} |
| Over 3.5 | **${p.over35 ?? 0}%** | ${signal(p.over35 ?? 0, 40, 28)} |
| Under 2.5 | **${100 - (p.over25 ?? 0)}%** | ${signal(100 - (p.over25 ?? 0))} |
| Clean Sheet Dom | **${p.cs00 ?? 0}%** | ${signal(p.cs00 ?? 0, 35, 20)} |

---

## ⚽ xG ATTENDUS (Modèle Poisson)

| Équipe | xG (λ) | PPG | Buts/match | Encaissés/match |
|--------|--------|-----|-----------|----------------|
| ${match.home_team} (Dom) | **${eg.home?.toFixed(2) ?? '?'}** | ${hs.ppg ?? '?'} | ${hs.avgScored?.toFixed(2) ?? '?'} | ${hs.avgConceded?.toFixed(2) ?? '?'} |
| ${match.away_team} (Ext) | **${eg.away?.toFixed(2) ?? '?'}** | ${as_.ppg ?? '?'} | ${as_.avgScored?.toFixed(2) ?? '?'} | ${as_.avgConceded?.toFixed(2) ?? '?'} |

---

## 🎯 SCORES LES PLUS PROBABLES
${topScore ? `1. **${topScore.score}** — ${topScore.prob}%` : ''}
${topScore2 ? `2. **${topScore2.score}** — ${topScore2.prob}%` : ''}
${p.topScores?.[2] ? `3. **${p.topScores[2].score}** — ${p.topScores[2].prob}%` : ''}

---

## 💰 VALUE BET
${bestEdgeLine}

---

## 📈 FORMES RÉCENTES (L5)
- **${match.home_team}** : ${match.home_form?.slice(0,5) || 'N/A'}
- **${match.away_team}** : ${match.away_form?.slice(0,5) || 'N/A'}

---

## 📲 SCRIPT TELEGRAM
\`\`\`telegram
🏟️ ${match.home_team} vs ${match.away_team}
📅 ${dateStr} à ${timeStr} | ${match.league}

📊 ANALYSE STATISTIQUE PARISCORE

¤ 1X2 : 1 (${p.homeWin ?? 0}%) / X (${p.draw ?? 0}%) / 2 (${p.awayWin ?? 0}%)
¤ Over 2.5 : ${p.over25 ?? 0}% | BTTS : ${p.btts ?? 0}%
¤ Score probable : ${topScore?.score ?? '?'} (${topScore?.prob ?? 0}%)
¤ xG : ${eg.home?.toFixed(2) ?? '?'} vs ${eg.away?.toFixed(2) ?? '?'}

${bestEdgeLine.replace(/\*\*/g, '')}

🔥 Mettez un 🔥 si vous validez !
— PariScore Pro 🏅
\`\`\``;
}

// ─── INJURIES PAR ÉQUIPE (cache 24h, skip si pas d'ID) ─────────────────────
async function fetchTeamInjuries(teamKey) {
  const stats = db.teamStats[teamKey];
  if (!stats?.teamId || !API_FOOTBALL_KEY) return null;
  const season = currentSeason();
  const cacheKey = `injuries_${stats.teamId}_${season}`;
  const cached = kvGet(cacheKey);
  if (cached && cached.ts && Date.now() - cached.ts < 86400000) return cached.data;
  try {
    const res = await httpsGet(
      `https://v3.football.api-sports.io/injuries?team=${stats.teamId}&season=${season}`,
      { 'x-apisports-key': API_FOOTBALL_KEY }
    );
    if (res.status === 429) { console.warn(`  [Injuries] Quota épuisé — team ${stats.teamId}`); return null; }
    if (res.status !== 200) { console.warn(`  [Injuries] HTTP ${res.status} — team ${stats.teamId}`); return null; }
    const injuries = (res.data?.response || []).slice(0, 5).map(p => ({
      name:   p.player?.name   || '?',
      reason: p.player?.reason || 'blessure',
    }));
    kvSet(cacheKey, { data: injuries, ts: Date.now() });
    return injuries;
  } catch(e) {
    console.error('[Injuries] erreur fetch:', e.message);
    return null;
  }
}

// ─── SCOUTING REPORT (Gemini, cache 24h) ─────────────────────────────────────
function buildScoutingPrompt(match, homeRatings = [], awayRatings = [], homeSquad = [], awaySquad = []) {
  const homeInj = (match.injuries?.home || []).map(p => p.name).join(', ') || 'Aucune absence connue';
  const awayInj = (match.injuries?.away || []).map(p => p.name).join(', ') || 'Aucune absence connue';
  const homeAvg = homeRatings.length ? (homeRatings.reduce((s, p) => s + (p.avg_rating || 0), 0) / homeRatings.length).toFixed(1) : '?';
  const awayAvg = awayRatings.length ? (awayRatings.reduce((s, p) => s + (p.avg_rating || 0), 0) / awayRatings.length).toFixed(1) : '?';
  const homeAtt = homeSquad.filter(p => p.position === 'Attacker').length || 0;
  const awayAtt = awaySquad.filter(p => p.position === 'Attacker').length || 0;
  const homeDef = homeSquad.filter(p => p.position === 'Defender').length || 0;
  const awayDef = awaySquad.filter(p => p.position === 'Defender').length || 0;

  return `Tu es l'analyste tactique de PariScore. Détecte les mismatchs tactiques. Rapport concis.

**${match.home_team} vs ${match.away_team}** — ${match.league}

Données:
- Classement: #${match.home_rank || '?'} vs #${match.away_rank || '?'}
- Note BSD: ${match.home_team} ${homeAvg} ⌀ | ${match.away_team} ${awayAvg} ⌀
- Effectif: ${match.home_team} ${homeDef} déf/${homeAtt} att | ${match.away_team} ${awayDef} déf/${awayAtt} att
- PPG: ${match.stats?.home?.ppg ?? '?'} vs ${match.stats?.away?.ppg ?? '?'} | Forme: ${(match.home_form || '').slice(0,5)||'?'} vs ${(match.away_form || '').slice(0,5)||'?'}
- xG: ${match.expectedGoals?.home?.toFixed(2) ?? '?'} vs ${match.expectedGoals?.away?.toFixed(2) ?? '?'}
- BTTS: ${match.poisson?.btts ?? '?'}% | O2.5: ${match.poisson?.over25 ?? '?'}% | Best: ${match.best_edge?.label ?? '?'} (edge ${match.best_edge?.edge ?? '?'}%)
- Absences: ${homeInj} / ${awayInj}

Format Markdown (350 mots):
## 🎯 Rapport Scouting
### ⚔️ Mismatch Tactique
[Forces/faiblesses confrontées. Dom: déf/att vs Ext: déf/att. Duel clé milieu/couloirs.]
### 📊 Marché Exploitable
[Corner/BTTS/Over/Under/cartons selon mismatch détecté]
### ⚠️ Risques
[Absences qui creusent le déséquilibre]
### 💡 Pari
[1 pari exploitant le mismatch + justification]`;
}

// ─── PRO SCOUT REPORT — 5 Piliers, style journalisme L'Équipe ────────────────

function buildProScoutPrompt(match, homeRatings = [], awayRatings = [], homeSquad = [], awaySquad = [], pressContext = null) {
  const p   = match.poisson || {};
  const eg  = match.expectedGoals || {};
  const hs  = match.stats?.home || {};
  const as_ = match.stats?.away || {};
  const dt  = new Date(match.commence_time);
  const dateStr = dt.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const timeStr = dt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  const homeAvg = homeRatings.length
    ? (homeRatings.reduce((s, p) => s + (p.avg_rating || 0), 0) / homeRatings.length).toFixed(1) : '?';
  const awayAvg = awayRatings.length
    ? (awayRatings.reduce((s, p) => s + (p.avg_rating || 0), 0) / awayRatings.length).toFixed(1) : '?';
  const homeInj = (match.injuries?.home || []).map(p => p.name).join(', ') || 'Aucune absence connue';
  const awayInj = (match.injuries?.away || []).map(p => p.name).join(', ') || 'Aucune absence connue';
  const homeAtt = homeSquad.filter(p => p.position === 'Attacker').length || 0;
  const awayAtt = awaySquad.filter(p => p.position === 'Attacker').length || 0;
  const homeDef = homeSquad.filter(p => p.position === 'Defender').length || 0;
  const awayDef = awaySquad.filter(p => p.position === 'Defender').length || 0;

  const pressBlock = pressContext ? (typeof pressContext === 'object' ? pressContext.text : pressContext) : null;

  return `Tu es le journaliste data de L'Équipe, spécialisé en paris sportifs algorithmiques. Tu rédiges des rapports de scouting de niveau professionnel pour la plateforme PariScore. Ton style : expert, précis, enthousiaste, appuyé sur les maths.

═══════════════════════════════════════════════════════
DONNÉES CERTIFIÉES PARISCORE — UTILISE-LES TELLES QUELLES
═══════════════════════════════════════════════════════
Match : ${match.home_team} vs ${match.away_team}
Compétition : ${match.league}
Date : ${dateStr} à ${timeStr}
Classement : ${match.home_team} #${match.home_rank || '?'} | ${match.away_team} #${match.away_rank || '?'}

STATISTIQUES DOMICILE (${match.home_team}) :
¤ PPG domicile : ${hs.ppg ?? '?'} | Forme L5 : ${match.home_form?.slice(0,5) || 'N/A'}
¤ Buts marqués/match : ${hs.avgScored != null ? hs.avgScored.toFixed(2) : '?'} | encaissés : ${hs.avgConceded != null ? hs.avgConceded.toFixed(2) : '?'}
¤ V/N/D : ${hs.wins ?? 0}% / ${hs.draws ?? 0}% / ${hs.losses ?? 0}%
¤ xG attendu (λ) : ${eg.home != null ? eg.home.toFixed(2) : '?'}
¤ Note BSD moyenne : ${homeAvg} | Attaquants: ${homeAtt} | Défenseurs: ${homeDef}
¤ Absences : ${homeInj}

STATISTIQUES EXTÉRIEUR (${match.away_team}) :
¤ PPG extérieur : ${as_.ppg ?? '?'} | Forme L5 : ${match.away_form?.slice(0,5) || 'N/A'}
¤ Buts marqués/match : ${as_.avgScored != null ? as_.avgScored.toFixed(2) : '?'} | encaissés : ${as_.avgConceded != null ? as_.avgConceded.toFixed(2) : '?'}
¤ V/N/D : ${as_.wins ?? 0}% / ${as_.draws ?? 0}% / ${as_.losses ?? 0}%
¤ xG attendu (λ) : ${eg.away != null ? eg.away.toFixed(2) : '?'}
¤ Note BSD moyenne : ${awayAvg} | Attaquants: ${awayAtt} | Défenseurs: ${awayDef}
¤ Absences : ${awayInj}

PROBABILITÉS POISSON CERTIFIÉES :
¤ 1X2 : 1 (${p.homeWin ?? 0}%) / X (${p.draw ?? 0}%) / 2 (${p.awayWin ?? 0}%)
¤ BTTS : ${p.btts ?? 0}% | Over 0.5: ${p.over05 ?? 0}% | Over 1.5: ${p.over15 ?? 0}% | Over 2.5: ${p.over25 ?? 0}% | Over 3.5: ${p.over35 ?? 0}%
¤ Under 2.5 : ${100 - (p.over25 ?? 0)}% | Clean Sheet dom : ${p.cs00 ?? 0}%
¤ Score le plus probable : ${p.topScores?.[0]?.score ?? '?'} (${p.topScores?.[0]?.prob ?? 0}%) | 2e : ${p.topScores?.[1]?.score ?? '?'} (${p.topScores?.[1]?.prob ?? 0}%)

COTES & VALUE :
¤ Cote 1: ${match.odds?.home != null ? match.odds.home.toFixed(2) : '?'} | N: ${match.odds?.draw != null ? match.odds.draw.toFixed(2) : '?'} | 2: ${match.odds?.away != null ? match.odds.away.toFixed(2) : '?'}
¤ Edge 1: ${match.edge?.home != null ? match.edge.home.toFixed(1) : '?'}% | N: ${match.edge?.draw != null ? match.edge.draw.toFixed(1) : '?'}% | 2: ${match.edge?.away != null ? match.edge.away.toFixed(1) : '?'}%
¤ Meilleur value bet : ${match.best_edge?.label ?? '?'} @ ${match.best_edge?.odds != null ? match.best_edge.odds.toFixed(2) : '?'} (Edge: +${match.best_edge?.edge != null ? match.best_edge.edge.toFixed(1) : '?'}%) — ${match.best_edge?.bk ?? 'N/A'}
${pressBlock ? `\nCONTEXTE PRESSE RÉCENTE :\n${pressBlock}` : ''}
═══════════════════════════════════════════════════════

RÉDIGE maintenant le rapport complet en suivant EXACTEMENT ce format Markdown :

# 🏟️ ${match.home_team} vs ${match.away_team}
## ${match.league} — ${dateStr} à ${timeStr}

---

## 🏅 CERTIFIÉ PARISCORE PRO
*Rapport généré par l'algorithme PariScore v9.7 — Données Poisson certifiées*

---

## 📊 PILIER 1 — MÉTRIQUES AVANCÉES (30%)
[Analyse xG différentiel, volume de corners attendu, efficacité offensive/défensive des deux équipes. Cite les chiffres précis fournis. 80 mots min.]

## ⚔️ PILIER 2 — ANALYSE TACTIQUE & EFFECTIFS (20%)
[Systèmes de jeu probables, mismatch clé (attaque dom vs défense ext et vice-versa), impact des absences sur l'équilibre. 80 mots min.]

## 📈 PILIER 3 — DYNAMIQUE & MOMENTUM (20%)
[Forme L5 commentée match par match si possible, tendance positive/négative, calendrier récent, fatigue potentielle. 70 mots min.]

## 📰 PILIER 4 — PRESSE & CONSENSUS WEB (15%)
[Ce que disent L'Équipe, Sofascore, Forebet, OddAlerts, BetMines sur ce match. Consensus ou divergence ? Si aucune info presse, synthétise les signaux algorithmiques disponibles. 60 mots min.]

## 🧠 PILIER 5 — PSYCHOLOGIE & H2H (15%)
[Enjeux du match (titre, maintien, derby, coupe ?), historique des confrontations directes si connu, pression mentale sur les joueurs clés. 60 mots min.]

---

## 🔢 PROBABILITÉS MATHÉMATIQUES CERTIFIÉES
| Marché | Probabilité | Signal |
|--------|-------------|--------|
| ${match.home_team} gagne | ${p.homeWin ?? 0}% | ${(p.homeWin ?? 0) >= 55 ? '🟢 Fort' : (p.homeWin ?? 0) >= 40 ? '🟡 Moyen' : '🔴 Faible'} |
| Match Nul | ${p.draw ?? 0}% | ${(p.draw ?? 0) >= 30 ? '🟡 Possible' : '🔴 Improbable'} |
| ${match.away_team} gagne | ${p.awayWin ?? 0}% | ${(p.awayWin ?? 0) >= 55 ? '🟢 Fort' : (p.awayWin ?? 0) >= 40 ? '🟡 Moyen' : '🔴 Faible'} |
| BTTS | ${p.btts ?? 0}% | ${(p.btts ?? 0) >= 55 ? '🟢 Fort' : (p.btts ?? 0) >= 45 ? '🟡 Moyen' : '🔴 Faible'} |
| Over 2.5 | ${p.over25 ?? 0}% | ${(p.over25 ?? 0) >= 55 ? '🟢 Fort' : (p.over25 ?? 0) >= 45 ? '🟡 Moyen' : '🔴 Faible'} |
| Over 1.5 | ${p.over15 ?? 0}% | ${(p.over15 ?? 0) >= 70 ? '🟢 Fort' : '🟡 Moyen'} |

---

## 🏆 TOP 5 DES PARIS
- 🛡️ **Le Safe** : [Pari le plus probable avec justification mathématique] (Proba: X%)
- 📈 **Le Bankroll Builder** : [Pari cote modérée, edge positif] (Proba: X%)
- 💎 **Le Value Bet** : [${match.best_edge?.label ?? 'Value bet'} @ ${match.best_edge?.odds != null ? match.best_edge.odds.toFixed(2) : '?'} — Edge +${match.best_edge?.edge != null ? match.best_edge.edge.toFixed(1) : '?'}%] — Explique pourquoi le bookmaker sous-évalue ce marché
- 🚩 **Le Coup Tactique** : [Corners, cartons, buteur — basé sur le mismatch du Pilier 2]
- ⚡ **Le Coup Risqué** : [Score exact ou grosse cote — Justification]

---

## 📲 SCRIPT TELEGRAM
\`\`\`telegram
🏟️ ${match.home_team} vs ${match.away_team}
📅 ${dateStr} à ${timeStr} | ${match.league}

📊 ANALYSE PARISCORE PRO

¤ 1X2 : 1 (${p.homeWin ?? 0}%) / X (${p.draw ?? 0}%) / 2 (${p.awayWin ?? 0}%)
¤ Over 2.5 : ${p.over25 ?? 0}% | BTTS : ${p.btts ?? 0}%
¤ Score probable : ${p.topScores?.[0]?.score ?? '?'} (${p.topScores?.[0]?.prob ?? 0}%)

💎 VALUE BET : ${match.best_edge?.label ?? '?'} @ ${match.best_edge?.odds != null ? match.best_edge.odds.toFixed(2) : '?'} (Edge +${match.best_edge?.edge != null ? match.best_edge.edge.toFixed(1) : '?'}%)

[Complète avec les 2-3 paris retenus du Top 5 ci-dessus — style enthousiaste, appel à l'action final]

🔥 Mettez un 🔥 si vous validez !
— PariScore Pro 🏅
\`\`\``;
}

async function _doProScoutReport(match) {
  const hKey = normName(match.home_team);
  const aKey = normName(match.away_team);
  const hMeta = db.teamStats[hKey] || findFuzzy(hKey);
  const aMeta = db.teamStats[aKey] || findFuzzy(aKey);
  const [homeRatings, awayRatings, homeSquad, awaySquad, pressContext] = await Promise.allSettled([
    hMeta?.bsdTeamId && hMeta?.bsdSeasonId ? fetchBSDPlayerRatings(hMeta.bsdTeamId, hMeta.bsdSeasonId) : Promise.resolve([]),
    aMeta?.bsdTeamId && aMeta?.bsdSeasonId ? fetchBSDPlayerRatings(aMeta.bsdTeamId, aMeta.bsdSeasonId) : Promise.resolve([]),
    hMeta?.bsdTeamId ? fetchBSDTeamSquad(hMeta.bsdTeamId) : Promise.resolve([]),
    aMeta?.bsdTeamId ? fetchBSDTeamSquad(aMeta.bsdTeamId) : Promise.resolve([]),
    Promise.race([fetchPressContext(match.home_team, match.away_team), new Promise(r => setTimeout(() => r(null), 5000))]),
  ]).then(results => results.map(r => r.status === 'fulfilled' ? r.value : []));

  const prompt = buildProScoutPrompt(match, homeRatings, awayRatings, homeSquad, awaySquad, pressContext);
  const aiResult = await callUniversalAI(prompt, 1500);
  if (aiResult) {
    const { text: report, provider } = aiResult;
    const cacheKey = `pro_scout_${match.id}`;
    kvSet(cacheKey, { report, ts: Date.now(), provider });
    console.log(`  [ProScout] ✓ ${provider.toUpperCase()} — ${match.home_team} vs ${match.away_team}`);
    return { report, cached: false, fallback: false, provider, queue_size: _geminiQueueSize };
  }
  // Both AI providers failed — math fallback
  console.warn(`  [ProScout] Tous les fournisseurs IA indisponibles — fallback math pour ${match.id}`);
  return { report: buildMathFallbackReport(match), cached: false, fallback: true, provider: 'math', queue_size: _geminiQueueSize };
}

async function getProScoutReport(match) {
  // 1. Cache hit — skip AI entirely
  const cacheKey = `pro_scout_${match.id}`;
  const cached = kvGet(cacheKey);
  if (cached && cached.ts && Date.now() - cached.ts < 86400000) {
    return { report: cached.report, cached: true, fallback: false, provider: cached.provider || 'gemini', queue_size: 0 };
  }

  // 2. In-flight deduplication — same match already being processed
  if (_geminiInFlight.has(match.id)) {
    console.log(`  [ProScout] Dedup — attente du résultat en cours pour ${match.id}`);
    return await _geminiInFlight.get(match.id);
  }

  // 3. Rate limit exceeded — instant math fallback
  if (!geminiRateLimitOk()) {
    console.warn(`  [ProScout] RPM limit atteint (${GEMINI_RPM_LIMIT}/min) — fallback math pour ${match.id}`);
    return { report: buildMathFallbackReport(match), cached: false, fallback: true, queue_size: _geminiQueueSize };
  }

  // 4. Process: register in-flight, then run through queue
  const promise = _doProScoutReport(match).finally(() => _geminiInFlight.delete(match.id));
  _geminiInFlight.set(match.id, promise);
  return promise;
}

async function getScoutReport(match) {
  const cacheKey = `scout_${match.id}`;
  const cached = kvGet(cacheKey);
  if (cached && cached.ts && Date.now() - cached.ts < 86400000) {
    return { report: cached.report, cached: true };
  }
  const hKey = normName(match.home_team);
  const aKey = normName(match.away_team);
  const hMeta = db.teamStats[hKey] || findFuzzy(hKey);
  const aMeta = db.teamStats[aKey] || findFuzzy(aKey);
  const homeRatings = hMeta?.bsdTeamId && hMeta?.bsdSeasonId
    ? await fetchBSDPlayerRatings(hMeta.bsdTeamId, hMeta.bsdSeasonId) : [];
  const awayRatings = aMeta?.bsdTeamId && aMeta?.bsdSeasonId
    ? await fetchBSDPlayerRatings(aMeta.bsdTeamId, aMeta.bsdSeasonId) : [];
  const homeSquad = hMeta?.bsdTeamId
    ? await fetchBSDTeamSquad(hMeta.bsdTeamId) : [];
  const awaySquad = aMeta?.bsdTeamId
    ? await fetchBSDTeamSquad(aMeta.bsdTeamId) : [];
  const prompt = buildScoutingPrompt(match, homeRatings, awayRatings, homeSquad, awaySquad);
  const report = await callGemini(prompt, 600);
  kvSet(cacheKey, { report, ts: Date.now() });
  return { report, cached: false };
}

// ─── TOP BUTEURS PAR LIGUE (cache 24h, 1 req/ligue à la demande) ────────────
async function fetchLeagueTopScorers(leagueId, season) {
  if (!API_FOOTBALL_KEY || !leagueId) return [];

  // Essaie la saison demandée, puis la précédente (plan gratuit = accès limité)
  const seasonsToTry = [season, season - 1];
  for (const s of seasonsToTry) {
    const cacheKey = `${leagueId}_${s}`;
    const cached = db.topScorers[cacheKey];
    if (cached && (Date.now() - new Date(cached.fetchedAt).getTime() < ADV_STATS_TTL)) {
      return cached.data; // cache hit (peut être vide si déjà tenté)
    }
    try {
      const res = await httpsGet(
        `https://v3.football.api-sports.io/players/topscorers?league=${leagueId}&season=${s}`,
        { 'x-apisports-key': API_FOOTBALL_KEY }
      );
      if (res.status === 429) { console.warn(`  [TopScorers] Quota épuisé — league ${leagueId}`); return []; }
      if (res.status !== 200) continue;
      const players = (res.data?.response || []).slice(0, 15).map(entry => ({
        id:          entry.player.id,
        name:        entry.player.name,
        photo:       entry.player.photo,
        team:        entry.statistics[0]?.team?.name || '',
        teamId:      entry.statistics[0]?.team?.id,
        goals:       entry.statistics[0]?.goals?.total || 0,
        assists:     entry.statistics[0]?.goals?.assists || 0,
        rating:      entry.statistics[0]?.games?.rating || null,
        appearances: entry.statistics[0]?.games?.appearences || 0,
      }));
      db.topScorers[cacheKey] = { data: players, fetchedAt: new Date().toISOString() };
      saveDB();
      console.log(`  [TopScorers] ✓ Ligue ${leagueId} saison ${s} — ${players.length} joueurs`);
      if (players.length > 0) return players;
    } catch(e) {
      console.warn(`  [TopScorers] Erreur ligue ${leagueId}:`, e.message);
    }
  }
  return [];
}

// ─── KEY PLAYER INDEX — top 2 joueurs par équipe (cache SQLite 24h) ──────────
// KPI = (goals×3 + assists×2 + rating×1) / (minutes/90) → performance par 90 min
async function fetchTeamKeyPlayers(teamId, leagueId, season) {
  if (!API_FOOTBALL_KEY || !teamId || !leagueId) return [];
  const cacheKey = `kp_${teamId}_${leagueId}_${season}`;
  const cached   = kvGet(cacheKey);
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
        const s       = entry.statistics?.[0];
        const goals   = s?.goals?.total   || 0;
        const assists = s?.goals?.assists  || 0;
        const rating  = parseFloat(s?.games?.rating || 0);
        const minutes = s?.games?.minutes  || 0;
        const per90   = Math.max(1, minutes / 90);
        const kpi     = parseFloat(((goals * 3 + assists * 2 + rating) / per90).toFixed(2));
        return {
          id:         entry.player.id,
          name:       entry.player.name,
          photo:      entry.player.photo,
          position:   s?.games?.position || '',
          goals,
          assists,
          rating:     rating > 0 ? rating.toFixed(1) : null,
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
  } catch(e) {
    console.warn(`  [KeyPlayers] Erreur team ${teamId}:`, e.message);
    return [];
  }
}

async function fetchTeamPositionRatings(teamId, leagueId, season) {
  if (!API_FOOTBALL_KEY || !teamId || !leagueId) return null;
  const cacheKey = `pr_${teamId}_${leagueId}_${season}`;
  const cached   = kvGet(cacheKey);
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
  } catch(e) {
    console.warn(`  [PosRatings] Erreur team ${teamId}:`, e.message);
    return null;
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
    `${i+1}. ${m.home_team} vs ${m.away_team} (${m.league}) — Edge: +${m.best_edge.edge.toFixed(1)}% sur "${m.best_edge.label}" à ${m.best_edge.odds.toFixed(2)} | Poisson: O2.5 ${m.poisson?.over25}%, BTTS ${m.poisson?.btts}% | xG dom ${m.expectedGoals?.home ?? '?'} / ext ${m.expectedGoals?.away ?? '?'}`
  ).join('\n');

  // ── Récupération stats avancées (10 équipes max, cache 24h) ─────────────────
  const season = currentSeason();

  const advancedBlocks = await Promise.all(top5.map(async (m, i) => {
    const hKey  = normName(m.home_team);
    const aKey  = normName(m.away_team);
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
  } catch(e) { return { error: e.message }; }
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
    standingsRes.data.standings.forEach(entry => {
      const key = normName(entry.team);
      teams[key] = {
        home:        buildSideStats({ played: entry.played, win: entry.won, draw: entry.drawn, lose: entry.lost, goals_for: entry.gf, goals_against: entry.ga }),
        away:        buildSideStats({ played: Math.floor(entry.played / 2), win: Math.floor(entry.won / 2), draw: Math.floor(entry.drawn / 2), lose: Math.floor(entry.lost / 2), goals_for: Math.floor(entry.gf / 2), goals_against: Math.floor(entry.ga / 2) }),
        rank:        entry.position,
        form:        entry.form || '',
        leagueId:    configLeagueId,
        bsdTeamId:   entry.team_id || null,
        bsdSeasonId: seasonId,
        bsdLeagueId: bsdLeagueId,
        xgFor:       entry.xgf || null,
        xgAgainst:   entry.xga || null,
        _real:       true,
        _source:     'bsd',
      };
    });
    return teams;
  } catch(e) {
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
      _source: 'bsd',
    }));
  } catch(e) {
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
  } catch(e) {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  H2H — Head-to-Head matchups via API-Football
// ═══════════════════════════════════════════════════════════════════════════════

async function fetchH2H(team1Id, team2Id, limit = 10) {
  try {
    const cacheKey = `h2h_${Math.min(team1Id,team2Id)}_${Math.max(team1Id,team2Id)}`;
    const cached = apiCacheGet(cacheKey, 'h2h');
    if (cached) return cached;
    const res = await httpsGet(
      `https://v3.football.api-sports.io/fixtures/headtohead?h2h=${team1Id}-${team2Id}&last=${limit}`,
      { 'x-apisports-key': API_FOOTBALL_KEY }
    );
    if (res.status !== 200 || !res.data?.response?.length) return null;
    const meetings = res.data.response.map(f => {
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
    });
    const result = { meetings, total: meetings.length };
    apiCacheSet(cacheKey, result, 'h2h', 24 * 3600);
    return result;
  } catch(e) { return null; }
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
  } catch(e) {
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
      id:                p.id,
      name:              p.name,
      short_name:        p.short_name,
      position:          p.position,           // G/D/M/F
      specific_position: p.specific_position,
      jersey_number:     p.jersey_number,
      attributes:        p.attributes || null, // { tactical, attacking, defending, technical, creativity }
      strengths:         p.strengths  || [],
      weaknesses:        p.weaknesses || [],
      availability:      p.availability || 'available',
      injury_type:       p.injury_type || null,
      injury_return:     p.injury_expected_return || null,
      preferred_foot:    p.preferred_foot || null,
      nationality:       p.nationality || null,
      market_value:      p.market_value || null,
    }));
    apiCacheSet(cacheKey, squad, 'bsd_squad');
    return squad;
  } catch(e) {
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
      p.goals         += stat.goals        || 0;
      p.assists       += stat.goal_assist  || 0;
      p.minutes       += stat.minutes_played || 0;
      p.yellow_cards  += stat.yellow_card  || 0;
      p.red_cards     += stat.red_card     || 0;
      p.shots_on_target += stat.shots_on_target || 0;
      p.key_passes    += stat.key_pass     || 0;
      p.xg            += stat.expected_goals || 0;
      p.xa            += stat.expected_assists || 0;
      p.saves         += stat.saves        || 0;
      p.matches++;
    }
    const ratings = Object.values(byPlayer).map(p => {
      const avg = p._ratings.length ? Math.round(p._ratings.reduce((a, b) => a + b, 0) / p._ratings.length * 10) / 10 : null;
      const { _ratings, ...rest } = p;
      return { ...rest, avg_rating: avg, xg: Math.round(p.xg * 100) / 100, xa: Math.round(p.xa * 100) / 100 };
    }).sort((a, b) => (b.avg_rating || 0) - (a.avg_rating || 0));
    apiCacheSet(cacheKey, ratings, 'bsd_ratings');
    return ratings;
  } catch(e) {
    console.warn(`  [BSD] fetchPlayerRatings ${bsdTeamId} erreur:`, e.message);
    return [];
  }
}

function predictCorners(homeAvg, awayAvg, thresholds = [7.5, 8.5, 9.5, 10.5]) {
  // Expected total corners = average of both teams' averages
  const expectedTotal = (homeAvg + awayAvg) / 2;

  // Poisson-like distribution for corners (discrete, 0-20 range)
  const lambda = expectedTotal;
  const probs = {};

  for (const threshold of thresholds) {
    // P(Over X.5) = 1 - P(X ≤ floor(threshold))
    let cumulative = 0;
    const maxX = Math.floor(threshold) + 1;
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
  } catch(e) {
    return jsonResponse(res, 500, { error: e.message });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  CRON JOBS — PRE-FETCHING AUTOMATIQUE
// ═══════════════════════════════════════════════════════════════════════════════

// Convert a BSD match object to Odds API-compatible format so it can flow
// through buildMatchRecord() unchanged. Uses a single synthetic bookmaker entry.
function bsdToOddsApiFormat(bsdMatch) {
  if (!bsdMatch.odds?.home || !bsdMatch.odds?.away) return null;
  const drawOdds = bsdMatch.odds.draw || 3.0;
  const configLeague = leaguesConfig.leagues.find(
    l => l.name === bsdMatch.league || (bsdMatch._bsd_league_id && configIdToBsd(l.id) == bsdMatch._bsd_league_id)
  );
  const sportKey = configLeague?.odds_key || 'soccer_bsd';
  return {
    id: bsdMatch.id,
    sport_key: sportKey,
    sport_title: bsdMatch.league,
    home_team: bsdMatch.home_team,
    away_team: bsdMatch.away_team,
    commence_time: bsdMatch.commence_time,
    _sport: sportKey,
    _source: 'bsd',
    _bsd_event_id: bsdMatch._bsd_event_id,
    bsd_odds: bsdMatch.odds,
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
          { name: 'Draw',             price: drawOdds },
          { name: bsdMatch.away_team, price: bsdMatch.odds.away },
        ],
      }],
    }],
  };
}

// ─── JOB 1 : COTES (toutes les 12h) ──────────────────────────────────────
async function fetchOdds(force = false) {
  if (!ODDS_API_KEY) { console.warn('[Cron:Odds] Pas de clé API'); return; }
  if (isFetchingOdds) { console.warn('[Cron:Odds] Déjà en cours — ignoré'); return; }

  // ── Cache check: skip si données < 12h ET matchs à jour ──
  const cacheData = apiCacheGet('odds_raw_matches');
  if (!force && cacheData && db.matches.length > 0) {
    const now = Date.now();
    const upcoming = db.matches.filter(m => new Date(m.commence_time).getTime() > now).length;
    const past = db.matches.length - upcoming;
    const allPast = upcoming === 0;
    if (allPast) {
      console.log(`  [Cron:Odds] ⚠ Cache valide mais ${past} matchs passés — FORCING REFRESH`);
    } else {
      console.log(`  [Cron:Odds] ⚡ Données en cache (${upcoming} matchs à venir/${db.matches.length}) — skip API`);
      return;
    }
  }

  isFetchingOdds = true;
  console.log('\n%s', '═'.repeat(60));
  console.log(`  [Cron:Odds] ${force ? 'FORCED' : 'Mise à jour'} des cotes…`);

  try {
    // 1. Récupérer les sports actifs
    const sportsCache = apiCacheGet('odds_sports_list');
    let sportsRes;
    if (sportsCache) {
      sportsRes = { status: 200, data: sportsCache };
      console.log('  [Cron:Odds] Sports list: cache HIT');
    } else {
      sportsRes = await httpsGet(`https://api.the-odds-api.com/v4/sports/?apiKey=${ODDS_API_KEY}`);
      if (sportsRes.status === 200) {
        apiCacheSet('odds_sports_list', sportsRes.data, 'odds_api');
      }
    }
    if (sportsRes.status !== 200) {
      if (sportsRes.status === 429) { db.status = 'quota_epuise'; saveDB(); console.warn('  [Cron:Odds] Quota épuisé (429)'); }
      else { console.error('  [Cron:Odds] /sports HTTP', sportsRes.status); }
      return;
    }

    const activeSports = sportsRes.data
      .filter(s => s.active && ALL_SPORTS.includes(s.key))
      .map(s => s.key);
    console.log(`  [Cron:Odds] Ligues actives: ${activeSports.join(', ') || 'aucune'}`);

    // 2. Charger les cotes par ligue
    const now  = new Date();
    const from = formatIsoTimestamp(now);
    const to   = formatIsoTimestamp(new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000));
    const rawMatches = [];
    const oddsToCache = {};

    for (const sport of activeSports) {
      const sportCacheKey = `odds_${sport}`;
      const sportCached = apiCacheGet(sportCacheKey);
      if (sportCached) {
        rawMatches.push(...sportCached);
        console.log(`  [Cron:Odds] ${sport} → cache HIT (${sportCached.length} matchs)`);
        continue;
      }
      try {
        const query = new URLSearchParams({
          apiKey: ODDS_API_KEY,
          regions: 'eu',
          markets: 'h2h',
          oddsFormat: 'decimal',
          dateFormat: 'iso',
          commenceTimeFrom: from,
          commenceTimeTo: to,
        }).toString();
        const res = await httpsGet(`https://api.the-odds-api.com/v4/sports/${sport}/odds/?${query}`);
        if (res.status !== 200) {
          console.warn(`  [Cron:Odds] ${sport} → HTTP ${res.status}`, res.data || 'no body');
          continue;
        }
        const remaining = res.headers['x-requests-remaining'];
        if (remaining) db.oddsQuotaRemaining = remaining;
        res.data.forEach(m => { m._sport = sport; });
        rawMatches.push(...res.data);
        oddsToCache[sportCacheKey] = res.data;
        console.log(`  [Cron:Odds] ${sport} → ${res.data.length} matchs`);
      } catch(e) { console.warn(`  [Cron:Odds] ${sport} erreur:`, e.message); }
    }

    // Stocker les nouvelles données dans le cache 12h
    oddsToCache['odds_raw_matches'] = rawMatches;
    apiCacheSetBatch(
      Object.entries(oddsToCache).map(([k, v]) => [k, v]),
      'odds_api'
    );
    console.log(`  [Cron:Odds] 🗄️ ${Object.keys(oddsToCache).length} entrées cachées 12h`);

    // 3b. Supplementer avec matchs BSD non couverts par The Odds API
    try {
      const bsdFrom = formatDateOnly(now);
      const bsdTo   = formatDateOnly(new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000));
      const bsdRaw  = await fetchBSDMatches(bsdFrom, bsdTo);
      if (bsdRaw.length) {
        // Index Odds API matches by normalized team pair for deduplication
        const oddsIndex = new Set(rawMatches.map(m => normName(m.home_team) + '|' + normName(m.away_team)));
        let added = 0;
        for (const bm of bsdRaw) {
          const key = normName(bm.home_team) + '|' + normName(bm.away_team);
          if (oddsIndex.has(key)) continue; // already covered by Odds API
          const adapted = bsdToOddsApiFormat(bm);
          if (adapted) { rawMatches.push(adapted); oddsIndex.add(key); added++; }
        }
        console.log(`  [Cron:Odds] BSD supplement: +${added} matchs (${bsdRaw.length} récupérés)`);
      }
    } catch(e) {
      console.warn('  [Cron:Odds] BSD supplement erreur (non bloquant):', e.message);
    }

    // 3. Fusionner avec les stats et calculer edge/probabilités
    const built = rawMatches.map(buildMatchRecord).filter(Boolean);
    built.sort((a, b) => new Date(a.commence_time) - new Date(b.commence_time));

    // Dual-Check IA : si GameForecast est configuré, valider les matchs Shield
    if (GAMEFORECAST_API_HOST) {
      const shieldMatches = built.filter(m => m.shield).slice(0, 5);
      for (const m of shieldMatches) {
        try {
          const forecast = await fetchGameForecast(m);
          if (forecast.mocked) continue; // ignorer les données mock
          const fc = forecast.data?.predicted || forecast.predicted;
          if (!fc) continue;
          const fcWinner = fc.homeWin > fc.awayWin && fc.homeWin > fc.draw ? m.home_team
            : fc.awayWin > fc.homeWin && fc.awayWin > fc.draw ? m.away_team : 'Nul';
          m.shield_confirmed = (fcWinner === m.best_edge?.label);
          m.gameForecast = { homeWin: fc.homeWin, draw: fc.draw, awayWin: fc.awayWin };
        } catch(e) { /* GameForecast non bloquant */ }
      }
      const confirmed = built.filter(m => m.shield_confirmed).length;
      if (confirmed) console.log(`  [Dual-Check] ${confirmed} matchs Shield confirmés par GameForecast`);
    }

    db.matches = built;
    db.lastOddsUpdate = new Date().toISOString();
    db.status = 'ok';
    saveDB();

    // Notifie tous les clients SSE des nouveaux matchs
    if (sseClients.size > 0) broadcastSSE('matches_update', { matches: db.matches, meta: buildMeta() });

    console.log(`  [Cron:Odds] ✓ ${built.length} matchs fusionnés et sauvegardés`);
    if (db.oddsQuotaRemaining) console.log(`  [Cron:Odds] Quota restant: ${db.oddsQuotaRemaining}`);
    console.log('═'.repeat(60));

    // Archiver les matchs terminés + nettoyer les expirés
    await archivePastMatches().catch(e => console.warn('[Archive]', e.message));
    cleanExpiredMatches();
    // Envoyer alertes Telegram pour les value bets
    await sendValueBetAlerts().catch(e => console.warn('[Telegram]', e.message));

  } catch(e) {
    console.error('  [Cron:Odds] Erreur fatale:', e.message);
    if (!db.matches.length) { db.status = 'erreur_odds'; db.matches = buildDemoMatches(); saveDB(); }
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
        } catch(e) {
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
          groups.forEach(group => {
            group.forEach(entry => {
              const key = normName(entry.team.name);
              db.teamStats[key] = {
                home:     buildSideStats(entry.home),
                away:     buildSideStats(entry.away),
                rank:     entry.rank,
                form:     entry.form || '',
                teamId:   entry.team.id,
                leagueId: lid,
                _real:    true,
                _source:  'api-football',
              };
              fallbackTeamsFetched++;
              totalTeams++;
            });
          });
          if (groups.length) {
            db.statsUpdateByLeague[lid] = new Date().toISOString();
            console.log(`  [Fallback] Ligue ${lid} → OK (${groups.reduce((s,g)=>s+g.length,0)} équipes)`);
          } else console.warn(`  [Fallback] Ligue ${lid} → standings vides`);
        } catch(e) { console.warn(`  [Fallback] Ligue ${lid} erreur:`, e.message); }
      }
      console.log(`  [Fallback] Phase 2 terminée: ${fallbackTeamsFetched} équipes`);
    }

    db.lastStatsUpdate = new Date().toISOString();
    db.status = 'ok';
    saveDB();

    console.log(`  [Cron:Stats] ✓ ${totalTeams} équipes mises à jour (BSD: ${bsdTeamsFetched}, Fallback: ${fallbackTeamsFetched})`);
    if (db.statsQuotaRemaining) console.log(`  [Cron:Stats] Quota API-Football restant: ${db.statsQuotaRemaining}`);
    console.log('═'.repeat(60));

    // Injuries pre-fetch (fire & forget, cache 24h) pour les matchs à venir
    if (db.matches?.length) {
      const seen = new Set();
      const teamsToFetch = [];
      for (const m of db.matches.slice(0, 20)) {
        const hk = normName(m.home_team);
        const ak = normName(m.away_team);
        if (!seen.has(hk)) { seen.add(hk); teamsToFetch.push(hk); }
        if (!seen.has(ak)) { seen.add(ak); teamsToFetch.push(ak); }
      }
      for (const teamKey of teamsToFetch) {
        fetchTeamInjuries(teamKey).catch(() => {});
      }
    }

    // Re-fusionner les matchs avec les nouvelles stats
    if (db.matches.length) await fetchOdds();

  } catch(e) {
    console.error('  [Cron:Stats] Erreur fatale:', e.message);
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
    } catch(e) {
      console.warn(`  [Cron:Stats] Fixture ${date} erreur:`, e.message);
    }
  }
  return fixtures;
}

// ─── DONNÉES DÉMO ───────────────────────────────────────────────────────────
function buildDemoMatches() {
  const now = new Date();
  const d = (off, h, m) => { const dt = new Date(now); dt.setDate(dt.getDate() + off); dt.setHours(h, m, 0, 0); return dt.toISOString(); };
  const DEMOS = [
    ['soccer_france_ligue1','PSG','Olympique Lyonnais',0,20,45,1.42,4.50,7.50],
    ['soccer_france_ligue1','Olympique de Marseille','AS Monaco',0,17,0,2.20,3.40,3.10],
    ['soccer_france_ligue1','Stade Rennais','Lille OSC',1,15,0,2.60,3.20,2.70],
    ['soccer_france_ligue1','OGC Nice','RC Lens',1,20,45,2.30,3.30,3.00],
    ['soccer_epl','Arsenal','Chelsea',0,17,30,2.10,3.40,3.25],
    ['soccer_epl','Manchester City','Liverpool',0,16,0,2.40,3.50,2.80],
    ['soccer_epl','Newcastle United','Tottenham Hotspur',1,14,0,2.50,3.25,2.75],
    ['soccer_epl','Aston Villa','Manchester United',2,20,0,1.95,3.60,3.80],
    ['soccer_spain_la_liga','Real Madrid','FC Barcelona',0,21,0,2.30,3.20,2.90],
    ['soccer_spain_la_liga','Atlético Madrid','Sevilla FC',1,18,30,1.80,3.50,4.20],
    ['soccer_germany_bundesliga','Bayern Munich','Borussia Dortmund',0,18,30,1.65,3.80,5.00],
    ['soccer_germany_bundesliga','Bayer Leverkusen','RB Leipzig',2,15,30,1.90,3.60,3.70],
    ['soccer_italy_serie_a','Inter Milan','Juventus',1,18,0,2.00,3.40,3.60],
    ['soccer_italy_serie_a','AC Milan','AS Roma',1,20,45,2.10,3.30,3.40],
    ['soccer_uefa_champs_league','Real Madrid','Bayern Munich',2,21,0,2.20,3.30,3.00],
    ['soccer_uefa_champs_league','Arsenal','PSG',3,21,0,2.40,3.20,2.80],
    ['soccer_uefa_europa_league','Manchester United','Athletic Club',2,18,45,1.85,3.50,4.00],
    ['soccer_france_ligue1','Girondins de Bordeaux','Stade Brestois',3,15,0,2.00,3.20,3.60],
    ['soccer_epl','Brighton','West Ham United',3,14,0,2.15,3.40,3.20],
    ['soccer_spain_la_liga','Valencia CF','Villarreal CF',3,19,0,2.40,3.10,2.90],
  ];

  return DEMOS.map(([sport, home, away, off, h, m, oH, oD, oA]) => {
    const raw = {
      id: Math.random().toString(36).slice(2),
      _sport: sport, sport_key: sport,
      commence_time: d(off, h, m),
      home_team: home, away_team: away,
      bookmakers: [
        { key: 'bet365', title: 'Bet365', markets: [{ key: 'h2h', outcomes: [{ name: home, price: oH }, { name: 'Draw', price: oD }, { name: away, price: oA }] }] },
        { key: 'pinnacle', title: 'Pinnacle', markets: [{ key: 'h2h', outcomes: [{ name: home, price: oH + 0.02 }, { name: 'Draw', price: oD + 0.02 }, { name: away, price: oA + 0.03 }] }] },
        { key: 'unibet', title: 'Unibet', markets: [{ key: 'h2h', outcomes: [{ name: home, price: oH - 0.03 }, { name: 'Draw', price: oD + 0.05 }, { name: away, price: oA - 0.05 }] }] },
        { key: 'winamax', title: 'Winamax', markets: [{ key: 'h2h', outcomes: [{ name: home, price: oH - 0.02 }, { name: 'Draw', price: oD }, { name: away, price: oA - 0.02 }] }] },
      ],
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
const JWT_SECRET        = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
const JWT_TTL           = 7 * 24 * 3600;  // 7 jours — comptes admin
const JWT_TTL_MATCHDAY  = 24 * 3600;      // 24h — Matchday Pass
const JWT_TTL_USER      = 30 * 24 * 3600; // 30 jours — membres

// ─── STRIPE (HTTPS natif — zéro dépendance npm) ──────────────────────────────
const STRIPE_SECRET_KEY       = process.env.STRIPE_SECRET_KEY       || '';
const STRIPE_WEBHOOK_SECRET   = process.env.STRIPE_WEBHOOK_SECRET   || '';
const STRIPE_MATCHDAY_PRICE_ID = process.env.STRIPE_MATCHDAY_PRICE_ID || '';
const STRIPE_SUCCESS_URL      = process.env.STRIPE_SUCCESS_URL      || 'http://localhost:3000/?matchday=success';
const STRIPE_CANCEL_URL       = process.env.STRIPE_CANCEL_URL       || 'http://localhost:3000/';

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
        'Content-Type':  'application/x-www-form-urlencoded',
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
  const header  = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body    = Buffer.from(JSON.stringify({ ...payload, iat: Math.floor(Date.now()/1000), exp: Math.floor(Date.now()/1000) + ttl })).toString('base64url');
  const sig     = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}

function jwtVerify(token) {
  try {
    const [h, b, s] = token.split('.');
    const expected = crypto.createHmac('sha256', JWT_SECRET).update(`${h}.${b}`).digest('base64url');
    if (expected !== s) return null;
    const payload = JSON.parse(Buffer.from(b, 'base64url').toString());
    if (payload.exp < Math.floor(Date.now()/1000)) return null;
    return payload;
  } catch(e) { return null; }
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
const TELEGRAM_CHAT_IDS  = new Set(); // chargé depuis .env si défini
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
    } catch(e) { console.warn(`  [Telegram] Échec ${chatId}:`, e.message); }
  }
}

// Envoyer alertes pour les value bets avec edge > seuil
function buildAlertMessage(valueBets, label = 'Value Bets') {
  const dt = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  let msg = `🎯 <b>PariScore — ${label} du ${dt}</b>\n\n`;
  valueBets.forEach((m, i) => {
    const e = m.best_edge;
    msg += `${i+1}. <b>${m.home_team} vs ${m.away_team}</b>\n`;
    msg += `   📌 ${m.league} · ${new Date(m.commence_time).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}\n`;
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
      const edgeMin  = prefs.edgeMin  ?? 8;
      const probaMin = prefs.probaMin ?? 55;
      const markets  = prefs.markets  || [];
      const leagues  = prefs.leagues  || [];

      let userBets = allBets.filter(m => {
        if ((m.best_edge?.edge || 0) < edgeMin) return false;
        if (leagues.length && !leagues.includes(m.sport)) return false;
        // filtre marché : au moins une stratégie matchée
        if (markets.length) {
          const p = m.poisson || {};
          const matchMkt = markets.some(mkt => {
            if (mkt === 'BTTS_YES'  && (p.btts   || 0) >= probaMin) return true;
            if (mkt === 'OVER_2_5'  && (p.over25 || 0) >= probaMin) return true;
            if (mkt === 'OVER_1_5'  && (p.over15 || 0) >= probaMin) return true;
            if (mkt === 'HOME_WIN'  && (p.homeWin|| 0) >= probaMin) return true;
            if (mkt === 'AWAY_WIN'  && (p.awayWin|| 0) >= probaMin) return true;
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
    { key: 'over25',   label: 'Over 2.5',      val: p.over25   || 0 },
    { key: 'btts',     label: 'BTTS',           val: p.btts     || 0 },
    { key: 'over15',   label: 'Over 1.5',       val: p.over15   || 0 },
    { key: 'homeWin',  label: 'Victoire Dom.',  val: p.homeWin  || 0 },
    { key: 'awayWin',  label: 'Victoire Ext.',  val: p.awayWin  || 0 },
    { key: 'over35',   label: 'Over 3.5',       val: p.over35   || 0 },
    { key: 'under15',  label: 'Under 1.5',      val: p.under15  || 0 },
    { key: 'cs00',     label: 'CS Domicile',    val: p.cs00     || 0 },
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
    .map(([name, v]) => ({ name, rank: v.rank, ppg: v.home?.ppg ?? 0, form: v.form || '',
      wins: v.home?.wins ?? 0, draws: v.home?.draws ?? 0, losses: v.home?.losses ?? 0,
      scored: v.home?.scored ?? 0 }))
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
const STRATEGIES = {
  BTTS_YES:      { label: 'BTTS Oui',              icon: '🥅', getProb: m => m.poisson?.btts,    getOdds: () => null },
  OVER_2_5:      { label: 'Plus de 2.5 buts',      icon: '⚡', getProb: m => m.poisson?.over25,  getOdds: () => null },
  OVER_1_5:      { label: 'Plus de 1.5 buts',      icon: '🎯', getProb: m => m.poisson?.over15,  getOdds: () => null },
  UNDER_2_5:     { label: 'Moins de 2.5 buts',     icon: '🛡️', getProb: m => m.poisson ? 100 - m.poisson.over25 : null, getOdds: () => null },
  HOME_WIN:      { label: 'Victoire Domicile',     icon: '🏠', getProb: m => m.poisson?.homeWin, getOdds: m => m.odds?.home },
  AWAY_WIN:      { label: 'Victoire Extérieur',    icon: '✈️', getProb: m => m.poisson?.awayWin, getOdds: m => m.odds?.away },
  DRAW:          { label: 'Match Nul',             icon: '🤝', getProb: m => m.poisson?.draw,    getOdds: m => m.odds?.draw },
  CS_00:         { label: 'Score 0-0',             icon: '🔒', getProb: m => m.poisson?.cs00,    getOdds: () => null },
  // ── Stratégies avancées P1 ──────────────────────────────────────────────────
  ANGLE_CORNERS: {
    label: 'Angle Mort Corners',
    icon: '📐',
    getProb: m => {
      if (!m.poisson || !m.expectedGoals) return null;
      // Proxy: pression offensive combinée = indice d'attaque des deux équipes
      if (m.expectedGoals.home + m.expectedGoals.away < 2.5) return null;
      // Confiance basée sur over2.5 — games with high xG generate more corners
      return m.poisson.over25;
    },
    getOdds: () => null,
  },
  VERROU_TACTIQUE: {
    label: 'Verrou Tactique (U3.5)',
    icon: '🔐',
    getProb: m => {
      if (!m.poisson || m.poisson.over35 == null) return null;
      const under35 = 100 - m.poisson.over35;
      if (under35 < 80) return null;
      // Bonus uniquement sur données réelles (pas SIM — avgConceded artificiel sur SIM)
      const isReal = m.stats?.home?._real === true && m.stats?.away?._real === true;
      const bothDefensive = isReal && m.stats.home.avgConceded < 1.2 && m.stats.away.avgConceded < 1.2;
      return bothDefensive ? Math.min(under35 + 5, 99) : under35;
    },
    getOdds: () => null,
  },
  GOLDEN_PPG_GAP: {
    label: 'Golden PPG Gap',
    icon: '⭐',
    getProb: m => {
      if (!m.poisson || !m.stats?.home || !m.stats?.away) return null;
      const homePpg = m.stats.home.ppg || 0;
      const awayPpg = m.stats.away.ppg || 0;
      const gap = Math.abs(homePpg - awayPpg);
      if (gap < 1.2) return null;
      const strongerIsHome = homePpg > awayPpg;
      const strongerOdds = strongerIsHome ? m.odds?.home : m.odds?.away;
      // Condition: fort PPG joue à domicile OU cote > 1.70 (value bet)
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
    icon: '🏠X',
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
    icon: 'X✈️',
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
    icon: '⏱🏠',
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
    icon: '💥',
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
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, lim);
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
                      m.poisson.btts > 60   ? 'Les deux marquent' : 'Match serré',
    }))
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 12);
}

// ─── /api/v1/trends — statistiques agrégées sur tous les matchs ──────────────
function getTrends() {
  const matches = db.matches;
  if (!matches.length) return { error: 'Aucun match disponible' };

  const avg = arr => arr.length ? Math.round(arr.reduce((s, v) => s + v, 0) / arr.length) : 0;

  const bttsVals   = matches.filter(m => m.poisson).map(m => m.poisson.btts);
  const over25Vals = matches.filter(m => m.poisson).map(m => m.poisson.over25);
  const over15Vals = matches.filter(m => m.poisson).map(m => m.poisson.over15);
  const xgHome     = matches.filter(m => m.expectedGoals).map(m => m.expectedGoals.home);
  const xgAway     = matches.filter(m => m.expectedGoals).map(m => m.expectedGoals.away);

  const byLeague = {};
  matches.forEach(m => {
    if (!byLeague[m.league]) byLeague[m.league] = { btts: [], over25: [], count: 0 };
    byLeague[m.league].count++;
    if (m.poisson) { byLeague[m.league].btts.push(m.poisson.btts); byLeague[m.league].over25.push(m.poisson.over25); }
  });

  return {
    global: {
      btts_avg:    avg(bttsVals),
      over25_avg:  avg(over25Vals),
      over15_avg:  avg(over15Vals),
      xg_home_avg: parseFloat((xgHome.reduce((s,v)=>s+v,0)/(xgHome.length||1)).toFixed(2)),
      xg_away_avg: parseFloat((xgAway.reduce((s,v)=>s+v,0)/(xgAway.length||1)).toFixed(2)),
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
  const origin = process.env.ALLOWED_ORIGIN || 'http://localhost:3000';
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(JSON.stringify(data));
}

function handleAPI(req, res, pathname, query) {
  // GET /api/v1/live — flux SSE scores live
  if (pathname === '/api/v1/live' && req.method === 'GET') {
    res.writeHead(200, {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection':    'keep-alive',
      'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || 'http://localhost:3000',
      'X-Frame-Options': 'DENY',
      'X-Content-Type-Options': 'nosniff',
    });
    res.flushHeaders();

    // Snapshot immédiat des matchs actuels
    res.write(`event: matches_update\ndata: ${JSON.stringify({ matches: db.matches, meta: buildMeta() })}\n\n`);

    sseClients.add(res);

    // Heartbeat toutes les 30s pour maintenir la connexion (évite timeout proxy/Render)
    const hb = setInterval(() => {
      try { res.write(': heartbeat\n\n'); } catch(e) { clearInterval(hb); sseClients.delete(res); }
    }, 30000);

    req.on('close', () => { clearInterval(hb); sseClients.delete(res); });
    return;
  }

  // GET /api/v1/matches?league=xxx&day=0
  if (pathname === '/api/v1/matches') {
    // Public — auth optionnelle pour les filtres premium
    let matches = db.matches;

    // Filtre par ligue
    if (query.league && query.league !== 'all') {
      matches = matches.filter(m => m.sport === query.league);
    }

    // Filtre par jour (0=aujourd'hui, 1=demain, etc.)
    if (query.day !== undefined && query.day !== 'all') {
      const dayOffset = parseInt(query.day);
      if (!isNaN(dayOffset)) {
        const target = new Date();
        target.setDate(target.getDate() + dayOffset);
        const targetStr = target.toLocaleDateString('fr-FR');
        matches = matches.filter(m => {
          return new Date(m.commence_time).toLocaleDateString('fr-FR') === targetStr;
        });
      }
    }

    return jsonResponse(res, 200, {
      count:    matches.length,
      matches,
      meta: {
        lastOddsUpdate:  db.lastOddsUpdate,
        lastStatsUpdate: db.lastStatsUpdate,
        oddsQuota:       db.oddsQuotaRemaining,
        statsQuota:      db.statsQuotaRemaining,
        status:          db.status,
        accuracy:        getAccuracyReport(),
        nextOddsUpdate:  db.lastOddsUpdate
          ? new Date(new Date(db.lastOddsUpdate).getTime() + 12 * 3600000).toISOString()
          : null,
        nextStatsUpdate: db.lastStatsUpdate
          ? new Date(new Date(db.lastStatsUpdate).getTime() + 6 * 3600000).toISOString()
          : null,
      },
    });
  }

  // GET /api/v1/stats/:id
  if (pathname.startsWith('/api/v1/stats/')) {
    const id = pathname.slice('/api/v1/stats/'.length);
    const match = db.matches.find(m => m.id === id);
    if (!match) return jsonResponse(res, 404, { error: 'Match non trouvé' });
    return jsonResponse(res, 200, match);
  }

  // GET /api/v1/status
  if (pathname === '/api/v1/status') {
    return jsonResponse(res, 200, {
      status:          db.status,
      matchCount:      db.matches.length,
      teamCount:       Object.keys(db.teamStats).length,
      lastOddsUpdate:  db.lastOddsUpdate,
      lastStatsUpdate: db.lastStatsUpdate,
      oddsQuota:       db.oddsQuotaRemaining,
      statsQuota:      db.statsQuotaRemaining,
      uptime:          process.uptime(),
      bsd_connected:   !!BSD_API_KEY,
    });
  }

  // GET /api/v1/corners/:matchId — Predictions corners Over/Under
  if (pathname.startsWith('/api/v1/corners/')) {
    const matchId = pathname.split('/api/v1/corners/')[1];
    if (matchId) {
      return handleCornersRoute(res, decodeURIComponent(matchId));
    }
  }

  // GET /api/v1/live/bsd — Données live BSD brutes (xG, momentum, incidents, stats temps réel)
  if (pathname === '/api/v1/live/bsd') {
    const liveMatches = db.matches.filter(m => m.live_score && m.live_minute);
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
      incidents: m.live_incidents || null,
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
      } catch(e) { jsonResponse(res, 400, { error: 'JSON invalide' }); }
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
        } catch(e) {
          if (e.message.includes('UNIQUE')) return jsonResponse(res, 409, { error: 'Cet email est déjà utilisé' });
          throw e;
        }
      } catch(e) {
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

  // ─── MATCHDAY PASS — Stripe Checkout ─────────────────────────────────────

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
          'cancel_url':  STRIPE_CANCEL_URL,
          'payment_method_types[0]': 'card',
        });
        if (session.error) return jsonResponse(res, 400, { error: session.error.message });
        jsonResponse(res, 200, { url: session.url, session_id: session.id });
      } catch(e) {
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
            const now    = Math.floor(Date.now() / 1000);
            const exp    = now + JWT_TTL_MATCHDAY;
            const token  = jwtSign({ role: 'matchday', session_id: sessionId }, JWT_TTL_MATCHDAY);
            sqldb.prepare(
              'INSERT OR IGNORE INTO matchday_passes (session_id, token, created_at, expires_at) VALUES (?, ?, ?, ?)'
            ).run(sessionId, token, now, exp);
            console.log(`[Matchday] Pass créé — session ${sessionId} — expire dans 24h`);
          }
        }
        jsonResponse(res, 200, { received: true });
      } catch(e) {
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
      })),
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
          enabled:   !!parsed.enabled,
          chatId:    String(parsed.chatId || '').trim().slice(0, 50),
          edgeMin:   Math.max(0, Math.min(30, parseFloat(parsed.edgeMin)  || 0)),
          probaMin:  Math.max(0, Math.min(90, parseInt(parsed.probaMin)   || 50)),
          markets:   Array.isArray(parsed.markets) ? parsed.markets.filter(m => typeof m === 'string').slice(0, 10) : [],
          leagues:   Array.isArray(parsed.leagues) ? parsed.leagues.filter(l => typeof l === 'string').slice(0, 20) : [],
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
      uptime:          process.uptime(),
      matchCount:      db.matches.length,
      teamCount:       Object.keys(db.teamStats).length,
      historyCount:    history.length,
      lastOddsUpdate:  db.lastOddsUpdate,
      lastStatsUpdate: db.lastStatsUpdate,
      oddsQuota:       db.oddsQuotaRemaining,
      status:          db.status,
      isFetchingOdds,  isFetchingStats,
      accuracy:        getAccuracyReport(),
      aiScoutCached:   !!aiScoutCache.data,
      telegramChats:   TELEGRAM_CHAT_IDS.size,
      memoryMB:        Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
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
          const dateMs  = now - d * 86400000;
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
      } catch(e) { return jsonResponse(res, 500, { error: e.message }); }
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
      } catch(e) { jsonResponse(res, 400, { error: 'JSON invalide' }); }
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
      } catch(e) { jsonResponse(res, 400, { error: e.message }); }
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
          if (['bookmaker','name','affiliate_link','deeplink_template','promo_code','commission_type','commission_rate','active','priority'].includes(k)) {
            fields.push(`${k} = ?`);
            values.push(v);
          }
        }
        if (fields.length === 0) return jsonResponse(res, 400, { error: 'Aucun champ valide' });
        values.push(id);
        sqldb.prepare(`UPDATE affiliates SET ${fields.join(', ')} WHERE id = ?`).run(...values);
        return jsonResponse(res, 200, { ok: true });
      } catch(e) { jsonResponse(res, 400, { error: e.message }); }
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
      } catch(e) { jsonResponse(res, 400, { error: e.message }); }
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
    const match = db.matches.find(m => m.id === matchId);
    if (!match) return jsonResponse(res, 404, { error: 'Match non trouvé' });
    const bestAffiliate = sqldb.prepare('SELECT * FROM affiliates WHERE active = 1 ORDER BY priority DESC LIMIT 1').get();
    if (!bestAffiliate) return jsonResponse(res, 404, { error: 'Aucun affilié actif' });
    // Remplacer les placeholders dans deeplink_template
    let link = bestAffiliate.affiliate_link;
    if (bestAffiliate.deeplink_template) {
      link = bestAffiliate.deeplink_template
        .replace('{sport}', match.sport || 'soccer')
        .replace('{event_id}', match.id || '')
        .replace('{home}', encodeURIComponent(match.home_team))
        .replace('{away}', encodeURIComponent(match.away_team));
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
        bets.push({ date: h.commence_time, market: 'Over 2.5', won, profit: won ? 1 : -1, bankroll, match: h.home_team+' - '+h.away_team });
      }
      if (h.predicted?.btts > 55) {
        const won = rs.home > 0 && rs.away > 0;
        bankroll += won ? 1 : -1;
        bets.push({ date: h.commence_time, market: 'BTTS', won, profit: won ? 1 : -1, bankroll, match: h.home_team+' - '+h.away_team });
      }
    }
    const totalBets = bets.length;
    const wonBets = bets.filter(b => b.won).length;
    const peak = bets.reduce((m, b) => Math.max(m, b.bankroll), startBankroll);
    const trough = bets.reduce((m, b) => Math.min(m, b.bankroll), startBankroll);
    const maxDD = peak > 0 ? Math.round((1 - trough/peak)*10000)/100 : 0;
    return jsonResponse(res, 200, {
      startBankroll, finalBankroll: bankroll,
      totalPL: bankroll - startBankroll, totalBets, wonBets,
      winRate: totalBets > 0 ? Math.round(wonBets/totalBets*100) : 0,
      roi: totalBets > 0 ? Math.round((bankroll-startBankroll)/totalBets*10000)/100 : 0,
      maxDrawdown: maxDD,
      bets: bets.slice(-80),
    });
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

  // GET /api/v1/insights/:matchId — Hub Stats Elite (modal PariScore Insights)
  if (pathname.startsWith('/api/v1/insights/') && req.method === 'GET') {
    const matchId = decodeURIComponent(pathname.slice('/api/v1/insights/'.length));
    const match   = db.matches.find(m => m.id === matchId);
    if (!match) return jsonResponse(res, 404, { error: 'Match non trouvé' });

    (async () => {
      try {
        const hKey  = normName(match.home_team);
        const aKey  = normName(match.away_team);
        const hMeta = db.teamStats[hKey] || findFuzzy(hKey);
        const aMeta = db.teamStats[aKey] || findFuzzy(aKey);
        const hAdvKey = hMeta === db.teamStats[hKey] ? hKey : Object.keys(db.teamStats).find(k => db.teamStats[k] === hMeta) || hKey;
        const aAdvKey = aMeta === db.teamStats[aKey] ? aKey : Object.keys(db.teamStats).find(k => db.teamStats[k] === aMeta) || aKey;
        const hAdv  = db.advancedTeamStats[hAdvKey]?.data || null;
        const aAdv  = db.advancedTeamStats[aAdvKey]?.data || null;

        // Priorité : ligue du match (via odds_key → leagues_config), évite mixage BL1/BL2 après promotion/relégation
        const matchLeagueCfg = leaguesConfig.leagues.find(l => l.odds_key === match.sport);
        const leagueId = matchLeagueCfg?.id || hMeta?.leagueId || aMeta?.leagueId;
        const season   = currentSeason();

        // Classement de la ligue (depuis db.teamStats, trié par rank)
        const standings = Object.entries(db.teamStats)
          .filter(([, s]) => s.leagueId === leagueId && s._real && s.rank)
          .map(([tKey, s]) => {
            const adv = db.advancedTeamStats[tKey]?.data;
            return {
              team:   tKey,
              rank:   s.rank,
              form:   s.form || '',
              ppg:    s.home.ppg,
              // Global
              played: adv ? (adv.played_home + adv.played_away) : 0,
              wins:   adv ? (adv.wins_home + adv.wins_away) : 0,
              draws:  adv ? (adv.draws_home + adv.draws_away) : 0,
              losses: adv ? (adv.losses_home + adv.losses_away) : 0,
              pts:    adv ? ((adv.wins_home + adv.wins_away) * 3 + (adv.draws_home + adv.draws_away)) : 0,
              avgFor: adv?.goals_scored_total_avg  || s.home.avgScored,
              avgAg:  adv?.goals_conceded_total_avg || s.home.avgConceded,
              // Domicile
              home_played: adv?.played_home || 0,
              home_wins:   adv?.wins_home   || 0,
              home_draws:  adv?.draws_home  || 0,
              home_losses: adv?.losses_home || 0,
              home_pts:    adv ? (adv.wins_home * 3 + adv.draws_home) : 0,
              home_avgFor: adv?.goals_scored_home_avg    || 0,
              home_avgAg:  adv?.goals_conceded_home_avg  || 0,
              // Cartons (pour le tri multi-critères)
              cards_yellow: adv?.cards_yellow_total || null,
              cards_red:    adv?.cards_red_total    || null,
              // Extérieur
              away_played: adv?.played_away || 0,
              away_wins:   adv?.wins_away   || 0,
              away_draws:  adv?.draws_away  || 0,
              away_losses: adv?.losses_away || 0,
              away_pts:    adv ? (adv.wins_away * 3 + adv.draws_away) : 0,
              away_avgFor: adv?.goals_scored_away_avg    || 0,
              away_avgAg:  adv?.goals_conceded_away_avg  || 0,
            };
          })
          .sort((a, b) => a.rank - b.rank);

        // H2H historique — derniers face-à-face
        const h2h = (hTeamId && aTeamId) ? await fetchH2H(hTeamId, aTeamId, 10) : null;

        // Top buteurs (1 req/ligue max, cache 24h)
        const topScorers = leagueId ? await fetchLeagueTopScorers(leagueId, season) : [];

        // Key Player Index — top 3 par équipe + Position Ratings, en parallèle (cache 24h chacun)
        const hTeamId = hMeta?.teamId;
        const aTeamId = aMeta?.teamId;
        // BSD team IDs (from standings data stored in bsdTeamId field)
        const hBsdTeamId   = hMeta?.bsdTeamId   || null;
        const aBsdTeamId   = aMeta?.bsdTeamId   || null;
        const hBsdSeasonId = hMeta?.bsdSeasonId || null;
        const aBsdSeasonId = aMeta?.bsdSeasonId || null;

        // Corner history pour les deux équipes (BSD, cache 6h)
        const cfg = bsdConfig.mapping?.config_to_bsd?.[String(leagueId)];
        const [homeCorners, awayCorners] = await Promise.all([
          hBsdTeamId && cfg ? fetchBSDTeamCornerHistory(match.home_team, cfg, 10) : Promise.resolve(null),
          aBsdTeamId && cfg ? fetchBSDTeamCornerHistory(match.away_team, cfg, 10) : Promise.resolve(null),
        ]);

        const [homeKeyPlayers, awayKeyPlayers, homePosRatings, awayPosRatings,
               homeBSDSquad, awayBSDSquad, homeBSDRatings, awayBSDRatings] = await Promise.all([
          hTeamId ? fetchTeamKeyPlayers(hTeamId, leagueId, season) : Promise.resolve([]),
          aTeamId ? fetchTeamKeyPlayers(aTeamId, leagueId, season) : Promise.resolve([]),
          hTeamId ? fetchTeamPositionRatings(hTeamId, leagueId, season) : Promise.resolve(null),
          aTeamId ? fetchTeamPositionRatings(aTeamId, leagueId, season) : Promise.resolve(null),
          hBsdTeamId ? fetchBSDTeamSquad(hBsdTeamId) : Promise.resolve([]),
          aBsdTeamId ? fetchBSDTeamSquad(aBsdTeamId) : Promise.resolve([]),
          (hBsdTeamId && hBsdSeasonId) ? fetchBSDPlayerRatings(hBsdTeamId, hBsdSeasonId) : Promise.resolve([]),
          (aBsdTeamId && aBsdSeasonId) ? fetchBSDPlayerRatings(aBsdTeamId, aBsdSeasonId) : Promise.resolve([]),
        ]);

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

        jsonResponse(res, 200, {
          match,
          homeStats:      hMeta,
          awayStats:      aMeta,
          homeAdv:        hAdv,
          awayAdv:        aAdv,
          standings,
          topScorers,
          homeKeyPlayers: markInjury(homeKeyPlayers),
          awayKeyPlayers: markInjury(awayKeyPlayers),
          homePosRatings: homePosRatings,
          awayPosRatings: awayPosRatings,
          homeKey:        hAdvKey,
          awayKey:        aAdvKey,
          // BSD enrichissement
          homeBSDSquad:    homeBSDSquad,
          awayBSDSquad:    awayBSDSquad,
          homeBSDRatings:  homeBSDRatings,
          awayBSDRatings:  awayBSDRatings,
          bsdCoverage:     !!(hBsdTeamId || aBsdTeamId),
          homeCorners,
          awayCorners,
          h2h,
        });
      } catch(e) { jsonResponse(res, 500, { error: e.message }); }
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
      } catch(e) { jsonResponse(res, 500, { ok: false, error: e.message }); }
    })();
    return;
  }

  // GET /api/v1/scout/pro/:matchId — Pro Scouting Report (5 piliers, style L'Équipe)
  const proScoutMatch = pathname.match(/^\/api\/v1\/scout\/pro\/([^/?]+)$/);
  if (proScoutMatch && req.method === 'GET') {
    if (!GEMINI_API_KEY) { res.writeHead(503); res.end(JSON.stringify({ error: 'Clé Gemini non configurée' })); return; }
    const matchId = decodeURIComponent(proScoutMatch[1]);
    const match = db.matches.find(m => m.id === matchId);
    if (!match) { res.writeHead(404); res.end(JSON.stringify({ error: 'Match non trouvé' })); return; }
    (async () => {
      try {
        const result = await getProScoutReport(match);
        res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' });
        res.end(JSON.stringify(result));
      } catch(e) {
        res.writeHead(500); res.end(JSON.stringify({ error: e.message }));
      }
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
      } catch(e) {
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

  // GET /api/v1/odds-history/:matchId — Dropping Odds delta
  const oddsHistMatch = pathname.match(/^\/api\/v1\/odds-history\/([^/?]+)$/);
  if (oddsHistMatch && req.method === 'GET') {
    const matchId = decodeURIComponent(oddsHistMatch[1]);
    const match = db.matches.find(m => m.id === matchId);
    if (!match) return jsonResponse(res, 404, { error: 'Match introuvable' });
    return jsonResponse(res, 200, {
      id: matchId,
      current: match.odds,
      delta: match.odds_delta || null,
      home_team: match.home_team,
      away_team: match.away_team,
    });
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
                  try { res.write(`event: chunk\ndata: ${JSON.stringify({ text })}\n\n`); } catch {}
                }
              } catch {}
            }
          });
          gemRes.on('end', () => {
            if (!fullText) {
              console.warn(`  [PowerScore] Gemini empty response — ${matchId} (user: ${user.userId})`);
              try { res.write(`event: error\ndata: ${JSON.stringify({ message: "L'IA n'a pas pu générer d'analyse pour ce match. Réessayez dans quelques minutes." })}\n\n`); res.end(); } catch {}
              return;
            }
            const pressMeta = pressContext && typeof pressContext === 'object'
              ? { press_count: pressContext.articleCount, press_sources: pressContext.sourceNames }
              : {};
            kvSet(cacheKey, { text: fullText, _ts: Date.now(), ...pressMeta });
            console.log(`  [PowerScore] MISS → streamé + cache global — ${matchId}`);
            const donePayload = { ...pressMeta, quota: { used: quota.used, limit: quota.limit } };
            try { res.write(`event: done\ndata: ${JSON.stringify(donePayload)}\n\n`); res.end(); } catch {}
          });
          gemRes.on('error', e => { try { res.write(`event: error\ndata: ${JSON.stringify({ message: e.message })}\n\n`); res.end(); } catch {} });
        });
        gemReq.on('error', e => { try { res.write(`event: error\ndata: ${JSON.stringify({ message: e.message })}\n\n`); res.end(); } catch {} });
        gemReq.write(payload);
        gemReq.end();
        req.on('close', () => { try { gemReq.destroy(); } catch {} });
      } catch(e) {
        console.error(`  [PowerScore] ERREUR ${matchId}:`, e.message);
        try { res.write(`event: error\ndata: ${JSON.stringify({ message: e.message })}\n\n`); res.end(); } catch {}
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
      } catch(e) { jsonResponse(res, 400, { error: e.message }); }
    }).catch(() => jsonResponse(res, 413, { error: 'body too large' }));
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
      } catch(e) { jsonResponse(res, 500, { error: e.message }); }
    }).catch(e => jsonResponse(res, 413, { error: e.message }));
    return;
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
      } catch(e) {
        jsonResponse(res, 500, { error: e.message });
      }
    })();
    return;
  }

  jsonResponse(res, 404, { error: 'Route inconnue: ' + pathname });
}

// ═══════════════════════════════════════════════════════════════════════════════
//  SERVEUR HTTP
// ═══════════════════════════════════════════════════════════════════════════════

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.ico': 'image/x-icon' };

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;
  const query = Object.fromEntries(parsedUrl.searchParams.entries());

  // CORS preflight
  if (req.method === 'OPTIONS') {
    const origin = process.env.ALLOWED_ORIGIN || 'http://localhost:3000';
    res.writeHead(204, {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'X-Frame-Options': 'DENY',
      'X-Content-Type-Options': 'nosniff',
    });
    res.end(); return;
  }

  // API REST
  if (pathname.startsWith('/api/')) {
    try {
      handleAPI(req, res, pathname, query);
    } catch(e) {
      jsonResponse(res, 500, { error: 'Internal error: ' + e.message });
    }
    return;
  }

  // Fichiers statiques (avec protection)
  const filePath = path.join(__dirname, pathname === '/' ? 'pariscore.html' : pathname);
  if (!isSafePath(filePath)) {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: '403 Forbidden' }));
    return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('404: ' + pathname); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
    res.end(data);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  DÉMARRAGE
// ═══════════════════════════════════════════════════════════════════════════════

initSQLite();
loadDB();
loadHistory();
loadAICache();

server.listen(PORT, async () => {
  console.log('');
  console.log('  ╔══════════════════════════════════════════════════════╗');
  console.log('  ║           PariScore v2.0 — Backend API              ║');
  console.log('  ╠══════════════════════════════════════════════════════╣');
  console.log(`  ║  Serveur      → http://localhost:${PORT}               ║`);
  console.log('  ║  API          → /api/v1/matches                     ║');
  console.log('  ║  Status       → /api/v1/status                      ║');
  console.log('  ╠══════════════════════════════════════════════════════╣');
  console.log('  ║  Cron Odds    → toutes les 12h                      ║');
  console.log('  ║  Cron Stats   → T1 6h / T2 12h (par ligue)         ║');
  console.log('  ║  Cron Archive → toutes les 4h                       ║');
  console.log('  ╚══════════════════════════════════════════════════════╝');
  console.log('');

  // Premier fetch au démarrage — respect du cache 12h
  console.log('  [Boot] Premier chargement des données…');

  // Afficher stats du cache API
  const cacheStats = apiCacheStats();
  if (cacheStats.total > 0) {
    console.log(`  [Boot] 🗄️ Cache API: ${cacheStats.total} entrées (${cacheStats.bySource.map(s => `${s.source}:${s.c}`).join(', ')})`);
  }

  const now = Date.now();
  const oddsAge = db.lastOddsUpdate ? now - new Date(db.lastOddsUpdate).getTime() : Infinity;
  const statsAge = db.lastStatsUpdate ? now - new Date(db.lastStatsUpdate).getTime() : Infinity;

  // Odds : refresh si > 12h OU pas de matchs en DB
  if (!db.matches.length || oddsAge > 12 * 3600 * 1000) {
    console.log(`  [Boot] Odds cache ${!db.matches.length ? 'vide' : `expiré (${Math.round(oddsAge/3600000)}h)`} → refresh`);
    await fetchOdds(true).catch(e => console.warn('  [Boot] Odds échouées:', e.message));
  } else {
    console.log(`  [Boot] Odds OK — ${db.matches.length} matchs en cache (${Math.round(oddsAge/3600000)}h)`);
  }

  // Stats : refresh si > 12h OU pas d'équipes en DB OU ligues manquantes
  const hasTeams = Object.keys(db.teamStats).length > 0;
  const configuredLeagueIds = leaguesConfig.leagues.filter(l => l.id).map(l => l.id);
  const leaguesWithStandings = new Set(Object.values(db.teamStats).map(s => s.leagueId).filter(Boolean));
  const missingLeagues = configuredLeagueIds.filter(lid => !leaguesWithStandings.has(lid));
  const hasMissingLeagues = missingLeagues.length > 0;

  if (!hasTeams || statsAge > 12 * 3600 * 1000 || hasMissingLeagues) {
    if (hasMissingLeagues) {
      console.log(`  [Boot] Stats: ${missingLeagues.length} nouvelles ligues détectées → refresh forcé`);
    } else {
      console.log(`  [Boot] Stats cache ${!hasTeams ? 'vide' : `expiré (${Math.round(statsAge/3600000)}h)`} → refresh`);
    }
    await fetchStats(true).catch(e => console.warn('  [Boot] Stats échouées:', e.message));
  } else {
    console.log(`  [Boot] Stats OK — ${Object.keys(db.teamStats).length} équipes en cache (${Math.round(statsAge/3600000)}h)`);
  }

  // Si aucun match (API down), charger la démo
  if (!db.matches.length) {
    console.log('  [Boot] Aucun match live → chargement données démo');
    db.matches = buildDemoMatches();
    db.status = 'demo';
    saveDB();
  }

  // Cron jobs
  setInterval(() => fetchOdds().catch(e => console.error('[Cron] Odds:', e.message)), 12 * 3600 * 1000);     // 12h
  setInterval(() => fetchStats().catch(e => console.error('[Cron] Stats:', e.message)), 12 * 3600 * 1000);   // 12h
  setInterval(() => archivePastMatches().catch(e => console.error('[Cron] Archive:', e.message)), 4 * 3600 * 1000); // 4h
  // Nettoyage du cache API expiré (toutes les 2h)
  setInterval(() => {
    const cleaned = apiCacheCleanExpired();
    if (cleaned > 0) console.log(`  [Cron:Cache] 🗑️ ${cleaned} entrées API expirées nettoyées`);
  }, 2 * 3600 * 1000);

  // Helpers Live Intensity Score
  function getStat(teamStats, type) {
    const s = (teamStats || []).find(x => x.type === type);
    if (!s || s.value == null) return 0;
    const v = typeof s.value === 'string' ? parseFloat(s.value) : s.value;
    return isNaN(v) ? 0 : v;
  }

  function computeLiveIntensity(fix) {
    const stats = fix.statistics;
    if (!stats || stats.length < 2) return null;
    const home = stats[0]?.statistics || [];
    const away = stats[1]?.statistics || [];
    const totalShots  = getStat(home, 'Total Shots')  + getStat(away, 'Total Shots');
    const shotsOnGoal = getStat(home, 'Shots on Goal') + getStat(away, 'Shots on Goal');
    const corners     = getStat(home, 'Corner Kicks')  + getStat(away, 'Corner Kicks');
    const posHome = getStat(home, 'Ball Possession') || 50;
    const posDiff = Math.abs(posHome - 50);
    const score =
      Math.min(totalShots  / 25, 1) * 40 +
      Math.min(shotsOnGoal / 12, 1) * 30 +
      Math.min(corners     / 15, 1) * 20 +
      Math.min(posDiff     / 50, 1) * 10;
    return Math.min(100, Math.round(score));
  }

  // Smart Polling scores live — actif uniquement 19h-23h (heure Paris)
// ─── POLLING LIVE — BSD primaire + API-Football fallback ─────────────────
  async function pollLiveScores() {
    const now = new Date();
    const parisHour = parseInt(now.toLocaleString('fr-FR', { timeZone: 'Europe/Paris', hour: 'numeric', hour12: false }));
    if (parisHour >= 2 && parisHour < 9) return; // silence 2h-9h (aucun match majeur)

    try {
      let liveMatches = [];

      // ═══════════════════════════════════════════════════════════════
      // PHASE 1: BSD live (données riches: stats, xG, incidents, corners)
      // ═══════════════════════════════════════════════════════════════
      if (BSD_API_KEY) {
        try {
          const bsdLiveRes = await bsdFetch('/live/');
          if (bsdLiveRes.status === 200 && bsdLiveRes.data?.results?.length) {
            liveMatches = bsdLiveRes.data.results;
            console.log(`  [BSD Live] ${liveMatches.length} matchs live détectés`);
          }
        } catch(e) {
          console.warn('  [BSD Live] Erreur:', e.message);
        }
      }

      // ═══════════════════════════════════════════════════════════════
      // PHASE 2: API-Football fallback si BSD vide
      // ═══════════════════════════════════════════════════════════════
      if (!liveMatches.length && API_FOOTBALL_KEY) {
        try {
          const afLiveRes = await httpsGet(
            'https://v3.football.api-sports.io/fixtures?live=all',
            { 'x-apisports-key': API_FOOTBALL_KEY }
          );
          if (afLiveRes.status === 200) {
            liveMatches = (afLiveRes.data.response || []).map(fix => ({
              _source: 'api-football',
              home_team: fix.teams?.home?.name,
              away_team: fix.teams?.away?.name,
              home_score: fix.goals?.home,
              away_score: fix.goals?.away,
              current_minute: fix.fixture?.status?.elapsed,
              status: fix.fixture?.status?.short || 'inprogress',
              league: { name: fix.league?.name },
              live_stats: null,
              incidents: null,
              home_xg_live: null,
              away_xg_live: null,
            }));
          }
        } catch(e) {
          console.warn('  [AF Live] Erreur:', e.message);
        }
      }

      if (!liveMatches.length) return;

      const liveMatchIds = new Set();
      let updated = false;
      for (const live of liveMatches) {
        const liveHome = normName(live.home_team || '');
        const liveAway = normName(live.away_team || '');
        const match = db.matches.find(m => normName(m.home_team) === liveHome && normName(m.away_team) === liveAway)
          || db.matches.find(m => {
              // Fallback fuzzy : commence_time proche ±90min + équipes approximatives
              const timeDiff = Math.abs(new Date(m.commence_time).getTime() - Date.now());
              if (timeDiff > 90 * 60 * 1000) return false;
              const mh = normName(m.home_team), ma = normName(m.away_team);
              return (mh.startsWith(liveHome.slice(0,5)) || liveHome.startsWith(mh.slice(0,5)))
                  && (ma.startsWith(liveAway.slice(0,5)) || liveAway.startsWith(ma.slice(0,5)));
            });
        if (!match) { console.warn(`  [Live] Match non trouvé: ${live.home_team} vs ${live.away_team}`); continue; }
        liveMatchIds.add(match.id);

        const scoreHome = live.home_score;
        const scoreAway = live.away_score;
        if (scoreHome != null && scoreAway != null) {
          match.live_score = `${scoreHome}-${scoreAway}`;
          match.live_status = live.status || 'LIVE';
          match.live_minute = live.current_minute || null;

          // AUTO-ARCHIVE: Supprimer immédiatement les matchs terminés (FT, AET, PEN)
          const isFinished = live.status && /^(FT|AET|PEN|FT-?P|AET-?P|INT|CANC|ABAN|SUSP|PST)$/i.test(live.status);
          if (isFinished) {
            console.log(`  [Live] Match terminé: ${match.home_team} ${scoreHome}-${scoreAway} ${match.away_team} (${live.status})`);
            match.live_minute = 90;
            setTimeout(() => {
              db.matches = db.matches.filter(m => m.id !== match.id);
              console.log(`  [Live] Match expiré de la liste live: ${match.id}`);
            }, 2000);
          }

          // BSD: données riches
          if (live._source !== 'api-football') {
            match.live_possession = live.live_stats ? {
              home: live.live_stats.home?.ball_possession || 50,
              away: live.live_stats.away?.ball_possession || 50,
            } : null;
            match.live_shots = live.live_stats ? {
              home: live.live_stats.home?.total_shots || 0,
              away: live.live_stats.away?.total_shots || 0,
            } : null;
            match.live_shots_on_target = live.live_stats ? {
              home: live.live_stats.home?.shots_on_target || 0,
              away: live.live_stats.away?.shots_on_target || 0,
            } : null;
            match.live_corners = live.live_stats ? {
              home: live.live_stats.home?.corner_kicks || 0,
              away: live.live_stats.away?.corner_kicks || 0,
            } : null;
            match.live_cards = live.live_stats ? {
              home_yellow: live.live_stats.home?.yellow_cards || 0,
              away_yellow: live.live_stats.away?.yellow_cards || 0,
              home_red: live.live_stats.home?.red_cards || 0,
              away_red: live.live_stats.away?.red_cards || 0,
            } : null;
            match.live_xg = {
              home: live.home_xg_live || null,
              away: live.away_xg_live || null,
            };
            match.live_incidents = live.incidents || null;
            match.live_momentum = live.momentum || null;
            match.live_intensity = computeLiveIntensityFromBSD(live);
          } else {
            // API-Football fallback: intensity seulement
            match.live_intensity = computeLiveIntensity({ teams: { home: { name: live.home_team }, away: { name: live.away_team } }, goals: { home: scoreHome, away: scoreAway }, fixture: { status: { elapsed: match.live_minute } } });
          }

          updated = true;
        }
      }

      // Nettoyage: matchs live absents de l'API → clear (évite 0-0 fantômes)
      if (liveMatchIds.size > 0) {
        for (const m of db.matches) {
          if (m.live_score && !liveMatchIds.has(m.id)) {
            const elapsed = (Date.now() - new Date(m.commence_time).getTime()) / 60000;
            if (elapsed > 120) {
              console.log(`  [Live] Nettoyage: ${m.home_team} ${m.live_score} ${m.away_team} (plus dans API, ${Math.round(elapsed)}min)`);
              m.live_score = null; m.live_minute = null; m.live_status = null;
              updated = true;
            }
          }
        }
      }

      if (updated && sseClients.size > 0) {
        broadcastSSE('matches_update', { matches: db.matches, meta: buildMeta() });
        console.log(`  [Live] ${liveMatches.length} matchs live → ${sseClients.size} clients SSE notifiés`);
      }
    } catch(e) { console.warn('  [Live] Poll erreur:', e.message); }
  }

  // Compute live intensity from BSD data (xG-based + momentum)
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

  setInterval(() => pollLiveScores().catch(e => console.warn('[Live]', e.message)), 60 * 1000); // 60s

  // ── Morning refresh scheduler — force fetch at 6h00 Paris daily ──
  function scheduleMorningRefresh() {
    const now = new Date();
    const parisStr = now.toLocaleString('en-US', { timeZone: 'Europe/Paris' });
    const parisNow = new Date(parisStr);
    const target = new Date(parisNow);
    target.setHours(6, 0, 0, 0);
    if (target <= parisNow) target.setDate(target.getDate() + 1);
    const msUntil = target.getTime() - parisNow.getTime();
    console.log(`  [Scheduler] Prochain refresh forcé à ${target.toLocaleTimeString('fr-FR')} (dans ${Math.round(msUntil/3600000)}h)`);
    setTimeout(() => {
      console.log('  [Scheduler] ⏰ Morning refresh — fetching fresh matches');
      fetchOdds(true).then(() => {
        setInterval(() => fetchOdds(true), 24 * 3600 * 1000);
      });
    }, msUntil);
  }
  scheduleMorningRefresh();

  console.log(`\n  ✓ Prêt — ${db.matches.length} matchs disponibles\n`);
});
