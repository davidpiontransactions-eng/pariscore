'use strict';
/**
 * firecrawlService.js — Firecrawl cloud client (JS-natif, zero-dep)
 *
 * Source: Firecrawl REST API v2 (api.firecrawl.dev)
 * Doc:    https://docs.firecrawl.dev
 *
 * Rôle dans PariScore:
 *   COUCHE DE FALLBACK ciblée pour le scraping web, à activer via feature flag.
 *   NE REMPLACE PAS FlareSolverr / Apify / microservice Sofascore Playwright.
 *   Conçu pour: extraction structurée (schema JSON) sur pages statiques/SPA,
 *   batchs nocturnes, seeders historiques, étude Betfair WOM.
 *
 * Dogme zero-dependency respecté: https.request natif, PAS de `npm install firecrawl`.
 *
 * Config (.env):
 *   FIRECRAWL_API_KEY  = fc-...         (obligatoire — https://firecrawl.dev/app/api-keys)
 *   FIRECRAWL_ENABLED  = true           (feature flag — défaut: false = désactivé)
 *   FIRECRAWL_BASE_URL = https://api.firecrawl.dev  (self-host: URL du conteneur)
 *
 * Cache: par URL, TTL 30 min (configurable via FIRECRAWL_CACHE_TTL_MS).
 *
 * Coût: ~1 crédit/page scrape, ~5 crédits/extract. Free tier = 500 crédits/mois.
 *       Surveiller via https://firecrawl.dev/app.
 *
 * Cf. .context/FIRECRAWL-ANALYSIS-2026.md pour l'analyse coût/bénéfice complète.
 */

const https = require('https');
const http  = require('http');
const { URL } = require('url');

// ── Config (lazy env) ─────────────────────────────────────────────────────────
const API_KEY   = () => process.env.FIRECRAWL_API_KEY  || '';
const ENABLED   = () => process.env.FIRECRAWL_ENABLED === 'true' && !!API_KEY();
const BASE_URL  = () => process.env.FIRECRAWL_BASE_URL || 'https://api.firecrawl.dev';
const CACHE_TTL = () => {
  const v = parseInt(process.env.FIRECRAWL_CACHE_TTL_MS, 10);
  return (v > 0 ? v : 30 * 60 * 1000); // 30 min défaut
};

// ── Cache (par URL + opération) ───────────────────────────────────────────────
const _cache = new Map(); // key: `${op}:${url}` → { ts, data }

function _cacheGet(key) {
  const e = _cache.get(key);
  if (!e) return null;
  if (Date.now() - e.ts > CACHE_TTL()) { _cache.delete(key); return null; }
  return e.data;
}
function _cacheSet(key, data) {
  // Limite le cache à 200 entrées (LRU naïf — évite fuite mémoire)
  if (_cache.size > 200) _cache.delete(_cache.keys().next().value);
  _cache.set(key, { ts: Date.now(), data });
}

// ── Transport HTTP natif (https OU http pour self-host) ───────────────────────
function _post(pathname, body, { timeoutMs = 60000 } = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL() + pathname);
    const lib = url.protocol === 'https:' ? https : http;
    const payload = JSON.stringify(body);
    const req = lib.request(url, {
      method: 'POST',
      headers: {
        'Content-Type'  : 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'Authorization' : `Bearer ${API_KEY()}`,
      },
      timeout: timeoutMs,
    }, res => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          // Firecrawl retourne du JSON d'erreur { error: ... } ou texte
          let msg = `Firecrawl HTTP ${res.statusCode}`;
          try { const j = JSON.parse(b); if (j && j.error) msg += ` — ${j.error}`; } catch {}
          return reject(new Error(msg));
        }
        try { resolve(JSON.parse(b)); }
        catch (e) { reject(new Error('Firecrawl réponse JSON invalide')); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Firecrawl timeout')); });
    req.write(payload);
    req.end();
  });
}

// ── API publique ──────────────────────────────────────────────────────────────

/**
 * Indique si Firecrawl est actif (feature flag + clé API présents).
 * @returns {boolean}
 */
function enabled() { return ENABLED(); }

/**
 * Scrape une page → markdown propre (ou html/rawHtml/links selon options).
 *
 * @param {string} url - URL cible
 * @param {object} [opts]
 * @param {string[]} [opts.formats=['markdown']] - markdown | html | rawHtml | links | screenshot
 * @param {boolean} [opts.onlyMainContent=true]  - strip nav/footer
 * @param {number}  [opts.waitFor]               - ms d'attente du rendu JS
 * @param {boolean} [opts.useCache=true]
 * @returns {Promise<{markdown?:string, html?:string, links?:string[], metadata?:object, raw?:object}>}
 *
 * @example
 *   const { markdown } = await scrape('https://www.atptour.com/en/rankings/singles');
 */
async function scrape(url, opts = {}) {
  if (!ENABLED()) throw new Error('Firecrawl désactivé (FIRECRAWL_ENABLED != true ou clé manquante)');
  const {
    formats        = ['markdown'],
    onlyMainContent = true,
    waitFor,
    useCache       = true,
  } = opts;

  const cacheKey = `scrape:${formats.join(',')}:${onlyMainContent}:${waitFor || 0}:${url}`;
  if (useCache) {
    const c = _cacheGet(cacheKey);
    if (c) return c;
  }

  const body = { url, formats, onlyMainContent };
  if (waitFor) body.waitFor = waitFor;

  const resp = await _post('/v2/scrape', body);
  // Firecrawl v2: { success, data: { markdown, html, links, metadata, ... } }
  if (!resp || resp.success === false) {
    throw new Error('Firecrawl scrape échec' + (resp && resp.error ? ` — ${resp.error}` : ''));
  }
  const data = (resp.data && resp.data) || resp;
  if (useCache) _cacheSet(cacheKey, data);
  return data;
}

/**
 * Extrait des données structurées d'un ensemble d'URLs via schéma JSON (LLM-driven).
 * C'est la killer-feature de Firecrawl pour PariScore (seeders, WOM Betfair).
 *
 * @param {string[]} urls - URLs cibles
 * @param {object} schema - Schéma JSON-Schema décrivant les champs à extraire
 * @param {object} [opts]
 * @param {string} [opts.prompt] - Instructions complémentaires pour le LLM
 * @returns {Promise<object>} - Données structurées selon le schéma
 *
 * @example
 *   const data = await extract(
 *     ['https://www.atptour.com/en/rankings/singles'],
 *     { type:'object', properties:{ rankings:{ type:'array', items:{ type:'object',
 *       properties:{ rank:{type:'number'}, name:{type:'string'}, points:{type:'number'} } } } } },
 *     { prompt:'Extract top 100 players' }
 *   );
 */
async function extract(urls, schema, opts = {}) {
  if (!ENABLED()) throw new Error('Firecrawl désactivé (FIRECRAWL_ENABLED != true ou clé manquante)');
  if (!Array.isArray(urls) || urls.length === 0) throw new Error('extract: urls[] requis');
  if (!schema || typeof schema !== 'object') throw new Error('extract: schema (JSON-Schema) requis');

  const body = { urls, schema };
  if (opts.prompt) body.prompt = opts.prompt;

  // extract: plus coûteux (~5 crédits), timeout étendu (LLM)
  const resp = await _post('/v2/extract', body, { timeoutMs: 120000 });
  if (!resp || resp.success === false) {
    throw new Error('Firecrawl extract échec' + (resp && resp.error ? ` — ${resp.error}` : ''));
  }
  return (resp.data && resp.data) || resp;
}

/**
 * Recherche web + scrape des top résultats → markdown.
 *
 * @param {string} query - Requête de recherche
 * @param {object} [opts]
 * @param {number} [opts.limit=5] - Nombre de résultats
 * @returns {Promise<Array<{url, markdown, title}>>}
 */
async function search(query, opts = {}) {
  if (!ENABLED()) throw new Error('Firecrawl désactivé (FIRECRAWL_ENABLED != true ou clé manquante)');
  const { limit = 5 } = opts;
  const resp = await _post('/v0/search', { query, pageOptions: { fetchPageContent: true } }, { timeoutMs: 60000 });
  if (!resp || resp.success === false) {
    throw new Error('Firecrawl search échec' + (resp && resp.error ? ` — ${resp.error}` : ''));
  }
  const data = resp.data || [];
  return data.slice(0, limit).map(d => ({ url: d.url || d.link, markdown: d.content || '', title: d.title || '' }));
}

/**
 * Récupère tous les URLs d'un domaine sans scraper le contenu (léger, rapide).
 * Utile pour découvrir les pages à scraper avant un crawl complet.
 *
 * @param {string} url - URL racine du site
 * @returns {Promise<string[]>}
 */
async function mapSite(url) {
  if (!ENABLED()) throw new Error('Firecrawl désactivé (FIRECRAWL_ENABLED != true ou clé manquante)');
  const resp = await _post('/v2/map', { url, limit: 500 }, { timeoutMs: 60000 });
  if (!resp || resp.success === false) {
    throw new Error('Firecrawl map échec' + (resp && resp.error ? ` — ${resp.error}` : ''));
  }
  return (resp.data && resp.data.links) || (resp.data) || [];
}

/**
 * Health check — valide la clé API sans consommer de crédits de scraping.
 * @returns {Promise<{ok:boolean, message:string}>}
 */
async function ping() {
  if (!API_KEY()) return { ok: false, message: 'FIRECRAWL_API_KEY manquante' };
  try {
    // search sur 1 résultat = coût minimal, valide l'auth
    await search('test', { limit: 1 });
    return { ok: true, message: 'Firecrawl cloud joignable, clé valide' };
  } catch (e) {
    return { ok: false, message: e.message };
  }
}

module.exports = {
  enabled,
  scrape,
  extract,
  search,
  mapSite,
  ping,
  // Exposé pour tests/audit (sans avoir à mocker process.env)
  _cacheSize: () => _cache.size,
};
