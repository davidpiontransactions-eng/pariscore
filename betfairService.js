'use strict';
// ─── Betfair Exchange — Weight of Money (WOM) adapter ────────────────────────
// Source SHARP secondaire (signal de calibration additif). Inerte si les vars
// .env BETFAIR_* sont absentes (zéro impact sur le pipeline existant).
//
// Chemin GRATUIT : "Delayed App Key" Betfair (£0). Tourne sur l'exchange live,
// données retardées 1–180s — OK pour value bets pré-match. Le delayed key bloque
// seulement `totalMatched` + `EX_ALL_OFFERS` ; `EX_BEST_OFFERS` (top 3 par côté)
// passe → WOM calculable sans le live key (£299).
//
// Auth : interactive login (identitysso) → session token caché + keep-alive.
//   .env : BETFAIR_USER, BETFAIR_PASS, BETFAIR_APP_KEY  (+ option BETFAIR_DISABLED=1)
// Cert (bot) login = upgrade prod ultérieur, non requis pour le MVP.
//
// ⚠️ CORRECTNESS-CRITICAL — direction WOM. Sur l'API Betfair, pour un runner :
//   ex.availableToBack[] = liquidité que TU peux backer (= ordres LAY d'autrui
//     en attente = "argent qui veut layer" ce runner).
//   ex.availableToLay[]  = liquidité que TU peux layer (= ordres BACK d'autrui
//     en attente = "argent qui veut backer" ce runner).
//   WOM_back% (part de l'argent qui BACK le runner) =
//     Σ(availableToLay size top3) / [Σ(availableToBack top3) + Σ(availableToLay top3)]
//   Un WOM inversé = signal inversé = paris perdants. Au 1er fetch réussi, le
//   module logge un échantillon (bannière "VÉRIFIE DIRECTION WOM") à comparer
//   au WOM% affiché sur l'UI Betfair pour le même marché. C'est le gate P0.

const https = require('https');

// ── Config (lecture lazy : .env parsé par server.js APRÈS ce require) ─────────
const USER    = () => process.env.BETFAIR_USER || '';
const PASS    = () => process.env.BETFAIR_PASS || '';
const APPKEY  = () => process.env.BETFAIR_APP_KEY || '';
const ID_HOST = () => process.env.BETFAIR_IDENTITY_HOST || 'identitysso.betfair.com';
const API_HOST = () => process.env.BETFAIR_API_HOST || 'api.betfair.com';
const RPC_PATH = '/exchange/betting/json-rpc/v1';

function enabled() {
  return !process.env.BETFAIR_DISABLED && !!(USER() && PASS() && APPKEY());
}

// ── Caches ────────────────────────────────────────────────────────────────────
const CACHE_TTL_MS   = 10 * 60 * 1000;  // WOM par match (delayed data, pas in-play)
const SESSION_TTL_MS = 3 * 60 * 60 * 1000; // token interactif ~ heures ; on re-login avant
const MKT_TTL_MS     = 6 * 60 * 60 * 1000;  // mapping match→marketId stable intra-journée
const NEG_TTL_MS     = 30 * 60 * 1000;  // négatif (pas de marché trouvé) : retry +tard

const _womCache = new Map(); // match.id → { ts, data }
const _mktCache = new Map(); // match.id → { ts, marketId, runners } | { ts, miss:true }
let _session = { token: '', ts: 0 };
let _loginInFlight = null;
let _blockedUntil = 0;       // circuit-breaker après échec auth dur
let _verifiedOnce = false;   // bannière de vérif direction WOM (1×/process)

const norm = s => String(s || '').toLowerCase().normalize('NFD')
  .replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');

// ── HTTP helpers (https natif, zéro-dep) ──────────────────────────────────────
function _post(host, path, body, headers, timeout) {
  return new Promise((resolve, reject) => {
    const data = typeof body === 'string' ? body : JSON.stringify(body);
    const req = https.request({
      host, path, method: 'POST',
      headers: Object.assign({ 'Content-Length': Buffer.byteLength(data) }, headers),
      timeout: timeout || 12000,
    }, res => {
      let b = '';
      res.on('data', c => (b += c));
      res.on('end', () => {
        if (res.statusCode !== 200) return reject(new Error('Betfair HTTP ' + res.statusCode + ' ' + b.slice(0, 160)));
        try { resolve(JSON.parse(b)); } catch (e) { reject(new Error('Betfair parse: ' + e.message)); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('Betfair timeout')));
    req.end(data);
  });
}

// Interactive login → session token (caché). Re-login si expiré / invalidé.
async function _login(force) {
  if (!enabled()) return '';
  if (!force && _session.token && (Date.now() - _session.ts) < SESSION_TTL_MS) return _session.token;
  if (_loginInFlight) return _loginInFlight;
  _loginInFlight = (async () => {
    const form = 'username=' + encodeURIComponent(USER()) + '&password=' + encodeURIComponent(PASS());
    const r = await _post(ID_HOST(), '/api/login', form, {
      'X-Application': APPKEY(),
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
    }, 12000);
    if (!r || r.status !== 'SUCCESS' || !r.token) {
      throw new Error('login ' + ((r && (r.error || r.status)) || 'no token'));
    }
    _session = { token: r.token, ts: Date.now() };
    return r.token;
  })();
  try { return await _loginInFlight; }
  finally { _loginInFlight = null; }
}

// JSON-RPC SportsAPING avec re-login auto sur session invalide.
async function _rpc(method, params, _retried) {
  const token = await _login();
  if (!token) return null;
  let r;
  try {
    r = await _post(API_HOST(), RPC_PATH, {
      jsonrpc: '2.0', method: 'SportsAPING/v1.0/' + method, params: params || {}, id: 1,
    }, {
      'X-Application': APPKEY(),
      'X-Authentication': token,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    }, 12000);
  } catch (e) {
    // 401/HTTP → session probablement morte : un seul retry après re-login
    if (!_retried) { _session = { token: '', ts: 0 }; return _rpc(method, params, true); }
    throw e;
  }
  if (r && r.error) {
    const code = r.error.code || (r.error.data && r.error.data.APINGException && r.error.data.APINGException.errorCode);
    if (!_retried && /INVALID_SESSION|NO_SESSION|INVALID_APP_KEY/i.test(String(code))) {
      _session = { token: '', ts: 0 };
      return _rpc(method, params, true);
    }
    throw new Error('Betfair RPC ' + method + ' ' + JSON.stringify(r.error).slice(0, 160));
  }
  return r ? r.result : null;
}

// ── Sport mapping ─────────────────────────────────────────────────────────────
// eventTypeIds Betfair : Soccer=1, Tennis=2.
function _eventTypeId(match) {
  const s = norm(match && (match.sport || match.league));
  if (!s) return '1';
  if (s.includes('tennis') || match.sport === 'tennis' || match.is_tennis) return '2';
  return '1'; // défaut foot
}
function _isTennis(match) { return _eventTypeId(match) === '2'; }

// Fenêtre temporelle de recherche autour du coup d'envoi (±jours).
function _startWindow(match) {
  const t = match && (match.commence_time || match.start_time || match.date || match.kickoff);
  const base = t ? new Date(t).getTime() : Date.now();
  if (isNaN(base)) return null;
  return { from: new Date(base - 36 * 3600 * 1000).toISOString(), to: new Date(base + 36 * 3600 * 1000).toISOString() };
}

// Résout match PariScore → { marketId, runners:[{selectionId, key:'home'|'draw'|'away'|'p1'|'p2'}] }
// via listEvents (textQuery) puis listMarketCatalogue (MATCH_ODDS). Cache 6h.
async function _resolveMarket(match) {
  const ck = String(match.id);
  const c = _mktCache.get(ck);
  if (c && (Date.now() - c.ts) < (c.miss ? NEG_TTL_MS : MKT_TTL_MS)) return c.miss ? null : c;

  const tennis = _isTennis(match);
  const home = match.home_team || match.player1 || match.p1 || (match.players && match.players[0]);
  const away = match.away_team || match.player2 || match.p2 || (match.players && match.players[1]);
  if (!home || !away) { _mktCache.set(ck, { ts: Date.now(), miss: true }); return null; }

  const win = _startWindow(match);
  const filter = {
    eventTypeIds: [_eventTypeId(match)],
    textQuery: home + ' ' + away,
  };
  if (win) filter.marketStartTime = win;

  // 1) Trouver l'event le plus probable (match des 2 noms).
  const events = await _rpc('listEvents', { filter });
  if (!Array.isArray(events) || !events.length) { _mktCache.set(ck, { ts: Date.now(), miss: true }); return null; }
  const nh = norm(home), na = norm(away);
  let ev = events.find(e => { const n = norm(e.event && e.event.name); return n.includes(nh) && n.includes(na); });
  if (!ev) ev = events[0];
  const eventId = ev.event && ev.event.id;
  if (!eventId) { _mktCache.set(ck, { ts: Date.now(), miss: true }); return null; }

  // 2) Marché MATCH_ODDS + métadonnées runners (selectionId ↔ nom).
  const cats = await _rpc('listMarketCatalogue', {
    filter: { eventIds: [eventId], marketTypeCodes: ['MATCH_ODDS'] },
    marketProjection: ['RUNNER_METADATA'],
    maxResults: 1,
    sort: 'FIRST_TO_START',
  });
  if (!Array.isArray(cats) || !cats.length) { _mktCache.set(ck, { ts: Date.now(), miss: true }); return null; }
  const cat = cats[0];
  const runnersRaw = cat.runners || [];

  const runners = [];
  for (const r of runnersRaw) {
    const rn = norm(r.runnerName);
    let key = null;
    if (!tennis && (rn === 'thedraw' || rn === 'draw' || rn.includes('draw'))) key = 'draw';
    else if (rn === nh || rn.includes(nh) || nh.includes(rn)) key = tennis ? 'p1' : 'home';
    else if (rn === na || rn.includes(na) || na.includes(rn)) key = tennis ? 'p2' : 'away';
    if (key) runners.push({ selectionId: r.selectionId, key, name: r.runnerName });
  }
  // Tennis fallback : 2 runners sans match nom → ordre catalogue (p1,p2)
  if (tennis && runners.length < 2 && runnersRaw.length === 2) {
    runners.length = 0;
    runners.push({ selectionId: runnersRaw[0].selectionId, key: 'p1', name: runnersRaw[0].runnerName });
    runners.push({ selectionId: runnersRaw[1].selectionId, key: 'p2', name: runnersRaw[1].runnerName });
  }
  if (runners.length < 2) { _mktCache.set(ck, { ts: Date.now(), miss: true }); return null; }

  const out = { ts: Date.now(), marketId: cat.marketId, runners };
  _mktCache.set(ck, out);
  return out;
}

// Σ des `size` des N meilleurs niveaux (tri prix décroissant pour les meilleures offres).
function _sumTop(levels, n) {
  if (!Array.isArray(levels) || !levels.length) return 0;
  // EX_BEST_OFFERS renvoie déjà les meilleurs niveaux ; on borne à n.
  return levels.slice(0, n).reduce((s, l) => s + (Number(l && l.size) || 0), 0);
}
function _bestPrice(levels) {
  if (!Array.isArray(levels) || !levels.length) return null;
  const p = Number(levels[0] && levels[0].price);
  return isFinite(p) && p > 0 ? p : null;
}

// Calcule le WOM par runner depuis un marketBook listMarketBook (EX_BEST_OFFERS).
// PUR & offline-testable. tennis → clés p1/p2 ; foot → home/draw/away.
// Direction : voir la bannière CORRECTNESS-CRITICAL en tête de fichier.
function _computeWom(runners, marketBook, tennis) {
  const wom = {}, odds = {}, back = {}, lay = {}, sample = [];
  const mbRunners = (marketBook && marketBook.runners) || [];
  for (const rn of runners) {
    const br = mbRunners.find(x => x.selectionId === rn.selectionId);
    if (!br || br.status === 'REMOVED') continue;
    const ex = br.ex || {};
    const atb = ex.availableToBack || []; // ordres LAY d'autrui = argent qui veut LAYER ce runner
    const atl = ex.availableToLay || [];  // ordres BACK d'autrui = argent qui veut BACKER ce runner
    const backMoney = _sumTop(atl, 3);    // argent qui BACK le runner
    const layMoney  = _sumTop(atb, 3);    // argent qui LAYE le runner
    const tot = backMoney + layMoney;
    const womBackPct = tot > 0 ? parseFloat(((backMoney / tot) * 100).toFixed(1)) : null;
    const bBack = _bestPrice(atb); // prix auquel tu peux BACKER
    const bLay  = _bestPrice(atl); // prix auquel tu peux LAYER
    // "fair odds" = milieu probabiliste back/lay (réduit le biais de spread)
    let fair = (bBack && bLay) ? parseFloat((2 / (1 / bBack + 1 / bLay)).toFixed(3)) : (bBack || bLay || null);
    wom[rn.key] = womBackPct; odds[rn.key] = fair; back[rn.key] = bBack; lay[rn.key] = bLay;
    sample.push({ key: rn.key, name: rn.name, backMoney: Math.round(backMoney), layMoney: Math.round(layMoney), womBackPct, bBack, bLay });
  }
  let skew = null;
  if (tennis && wom.p1 != null && wom.p2 != null) skew = parseFloat(((wom.p1 - wom.p2) / 100).toFixed(3));
  else if (wom.home != null && wom.away != null) skew = parseFloat(((wom.home - wom.away) / 100).toFixed(3));
  return { wom, odds, back, lay, skew, sample };
}

// ── API publique ──────────────────────────────────────────────────────────────
// Récupère WOM + prix exchange pour un match. Best-effort : erreur → null.
// Retour :
//   { source:'betfair', ts, marketId,
//     wom:   { home,draw,away } | { p1,p2 }   // part % de l'argent qui BACK (0..100)
//     odds:  { home,draw,away } | { p1,p2 }   // prix "fair" (mid back/lay), no-vig friendly
//     back:  { ... }  lay:{ ... }             // meilleurs prix bruts back/lay
//     skew:  -1..1 (foot:home−away ; tennis:p1−p2) signe = côté favorisé par l'argent }
async function fetchMatchWOM(match) {
  if (!enabled() || !match || !match.id) return null;
  if (Date.now() < _blockedUntil) return null;
  const ck = String(match.id);
  const cached = _womCache.get(ck);
  if (cached && (Date.now() - cached.ts) < CACHE_TTL_MS) return cached.data;

  let data = null;
  try {
    const m = await _resolveMarket(match);
    if (!m) { _womCache.set(ck, { ts: Date.now(), data: null }); return null; }

    const book = await _rpc('listMarketBook', {
      marketIds: [m.marketId],
      priceProjection: { priceData: ['EX_BEST_OFFERS'], exBestOffersOverrides: { bestPricesDepth: 3 } },
    });
    const mb = Array.isArray(book) && book[0];
    if (!mb || !Array.isArray(mb.runners)) { _womCache.set(ck, { ts: Date.now(), data: null }); return null; }

    const tennis = _isTennis(match);
    const c = _computeWom(m.runners, mb, tennis);
    if (!Object.keys(c.wom).length) { _womCache.set(ck, { ts: Date.now(), data: null }); return null; }
    data = { source: 'betfair', ts: Date.now(), marketId: m.marketId, wom: c.wom, odds: c.odds, back: c.back, lay: c.lay, skew: c.skew };

    // ── P0 : bannière de vérification direction WOM (1× par process) ──────────
    if (!_verifiedOnce) {
      _verifiedOnce = true;
      console.log('=== VERIFIE DIRECTION WOM (Betfair, a confirmer vs UI Betfair) ===');
      console.log('  match=' + (match.home_team || match.player1 || match.id) + ' vs ' + (match.away_team || match.player2 || ''));
      console.log('  marketId=' + m.marketId + '  ' + JSON.stringify(c.sample));
      console.log('  Regle: womBackPct eleve = argent qui BACK ce runner (devrait raccourcir la cote).');
      console.log('=================================================================');
    }
  } catch (e) {
    const msg = String(e && e.message || e);
    // Échec auth dur (mauvaises creds / app key) → circuit-breaker 1h, on n'insiste pas.
    if (/login|INVALID_APP_KEY|ACCOUNT|INVALID_USERNAME|password/i.test(msg)) {
      _blockedUntil = Date.now() + 60 * 60 * 1000;
      console.warn('[Betfair] auth bloqué 1h — ' + msg);
    } else {
      console.warn('[Betfair] skip ' + match.id + ' — ' + msg);
    }
    _womCache.set(ck, { ts: Date.now(), data: null });
    return null;
  }
  _womCache.set(ck, { ts: Date.now(), data });
  return data;
}

// Produit une row format `all_bookmakers` (clé 'betfairexchange' → getBookWeight≈3.5)
// pour fusion dans computeWFV1N2 (ancre sharp low-vig). Foot 1X2 uniquement
// (le WFV 1N2 attend home/draw/away). Tennis : utiliser fetchMatchWOM directement.
async function fetchMatchRows(match) {
  if (!enabled() || _isTennis(match)) return [];
  const d = await fetchMatchWOM(match);
  if (!d || !d.odds || !d.odds.home || !d.odds.away) return [];
  return [{
    key: 'betfairexchange',
    title: 'Betfair Exchange',
    isANJ: false,
    home: d.odds.home,
    draw: d.odds.draw || null,
    away: d.odds.away,
    payout: 100, // exchange ~ no-vig (mid back/lay) → marge ~0
    _src: 'betfair',
    _wom: d.wom,
  }];
}

// Fusionne sans écraser un book existant de même clé.
function mergeRows(existing, extra) {
  if (!Array.isArray(extra) || !extra.length) return existing || [];
  const base = Array.isArray(existing) ? existing.slice() : [];
  const seen = new Set(base.map(r => norm(r.key || r.title)));
  for (const r of extra) {
    const k = norm(r.key || r.title);
    if (!seen.has(k)) { base.push(r); seen.add(k); }
  }
  return base;
}

module.exports = { enabled, fetchMatchWOM, fetchMatchRows, mergeRows, _resolveMarket, _login, _computeWom, _sumTop, _bestPrice };
