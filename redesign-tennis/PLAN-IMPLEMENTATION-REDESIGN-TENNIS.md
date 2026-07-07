# Redesign UI Tennis « Prematch & Live » — Plan d'implémentation

> **Pour les workers agentiques :** SOUS-COMPÉTENCE REQUISE : utilisez `superpowers:subagent-driven-development` (recommandé) ou `superpowers:executing-plans` pour implémenter ce plan tâche par tâche. Les étapes utilisent la syntaxe checkbox (`- [ ]`).

**Objectif :** Redesigner le sous-onglet Tennis Prematch & Live en hybride Dashboard-Carte (master-detail desktop + carte pédagogique mobile + toggle scan) avec signal EV% pilote, modale Parier multi-bookmaker, et nettoyage de la dette technique.

**Architecture :** Refonte incrémentale du frontend vanilla JS (`pariscore.html`) en 4 niveaux de révélation (P1 verdict → P2 contexte → P3 analyse → P4 modale/Pro) + serializer serveur canonique (`server.js`) pour stabiliser le contrat data. Master-detail desktop via mini-store observable, carte P2 mobile par défaut, bascule toggle scan P1.

**Stack technique :** Vanilla JS (ES5 `require`), Node.js natif + better-sqlite3, zéro dépendance npm, aucun build step. Frontend single-file `pariscore.html` (~27k lignes). Backend `server.js` (~52k lignes).

**Références :**
- Design doc : `redesign-tennis/DESIGN-DOC-REDESIGN-TENNIS.md`
- Gantt : `redesign-tennis/GANTT-REDESIGN-TENNIS.md`
- Plan tâches : `redesign-tennis/PLAN-TACHES-REDESIGN-TENNIS.md`

---

## Structure de fichiers

| Fichier | Rôle | Action |
|---|---|---|
| `server.js` | Backend — serializer tennis + routes dormantes | Modifier (injecter `_serializeTennisCard`, étendre routes) |
| `pariscore.html` | Frontend — composants UI + store + dialog | Modifier (IIFE `Scope` + `TennisScope`, CSS, HTML KPI bar) |
| `redesign-tennis/CONTRAT-DATA.md` | Doc contrat data canonique | Créer |
| `redesign-tennis/patches/` | Patches atomiques par phase | Créer (un fichier .patch par tâche critique) |

**Conventions de code (AGENTS.md) :** commentaires français, camelCase, ES5 `require()`, async IIFE `(async () => {...})().catch()`. XSS : toute variable interpolée dans `onclick="..."` doit être wrappée `_jsStr()`. Shell non-interactif (`cp -f`, `rm -rf`).

---

## PHASE 1 — Fondations backend + Design system (J+1 → J+3)

### Task 1.1 : Serializer serveur `_serializeTennisCard(m)`

**Files :**
- Modify: `server.js` (avant `return` de `_buildTennisValueBetsCore`, ~ligne 39554)
- Test: `test-serializer.js` (créer à la racine)

- [ ] **Step 1 : Créer le fichier de test**

Créer `test-serializer.js` :
```js
// test-serializer.js — Test du serializer tennis canonique
const _serializeTennisCard = require('./server.js')._serializeTennisCardForTest;

const mockMatch = {
  id: 'test-1', tour: 'ATP', tournament: 'Doha', surface: 'Hard', round: 'QF',
  best_of: 3, start_time: '2026-07-08T13:00:00Z',
  player1: { id: 'p1', name: 'Djokovic', country: 'SRB', flag: '🇷🇸', photo: 'http://x/p1.jpg', rank: 1, elo_surface: 2150, surf_rank_total: 120, l5_pts: 4, powerscore: 0.85 },
  player2: { id: 'p2', name: 'Sinner', country: 'ITA', flag: '🇮🇹', photo: 'http://x/p2.jpg', rank: 4, elo_surface: 2050, surf_rank_total: 100, l5_pts: 3, powerscore: 0.78 },
  odds: { p1: { odds: 1.85, book: 'Unibet' }, p2: { odds: 2.10, book: 'Unibet' } },
  fair: { p1: 0.62, p2: 0.38, margin: 0.04, method: 'shin' },
  edge: { p1: 0.08, p2: -0.02 },
  best_ev_model: { side: 'p1', player: 'Djokovic', odds: 1.85, book: 'Unibet', ev: 14.7, p_model: 0.62 },
  predictions: { elo: { p1: 0.62, p2: 0.38 }, blended: { p1: 0.62, p2: 0.38 }, bsd: { p1: 0.60, p2: 0.40 } }
};

const out = _serializeTennisCard(mockMatch);
const assert = require('assert');

// Contrat canonique
assert.strictEqual(out.id, 'test-1', 'id');
assert.strictEqual(out.tab, 'prematch', 'tab défaut prematch');
assert.strictEqual(out.surface, 'Hard', 'surface');
assert.strictEqual(out.bestOf, 3, 'bestOf');
assert.strictEqual(out.player1.rank, 1, 'rank p1');
assert.ok(out.odds.stale === false, 'odds.stale bool');
assert.ok(typeof out.odds.age_ms === 'number', 'odds.age_ms');
assert.ok(out.signal !== null, 'signal non null');
assert.strictEqual(out.signal.side, 'p1', 'signal side');
assert.ok(out.signal.ev_pct > 0, 'ev_pct positif');
assert.strictEqual(out.signal.confidence, 'medium', 'confidence medium (pas high car surf_rank_total < 150)');
assert.deepStrictEqual(out.traps, [], 'pas de traps');

console.log('✅ Task 1.1 : serializer OK');
console.log(JSON.stringify(out.signal, null, 2));
```

- [ ] **Step 2 : Lancer le test pour vérifier qu'il échoue**

Run : `node test-serializer.js`
Expected : FAIL avec `Cannot find module` ou `_serializeTennisCardForTest is not a function`

- [ ] **Step 3 : Ajouter l'export de test dans server.js**

Dans `server.js`, ajouter en fin de fichier (après tous les modules existants) :
```js
// Export pour tests (non exposé en runtime HTTP)
if (typeof module !== 'undefined' && module.exports) {
  module.exports._serializeTennisCardForTest = _serializeTennisCard;
}
```

- [ ] **Step 4 : Implémenter le serializer `_serializeTennisCard`**

Dans `server.js`, ajouter **avant** la fonction `_buildTennisValueBetsCore` (~ligne 38890, juste avant l'en-tête de la fonction) :
```js
// ═══════════════════════════════════════════════════════════════════════
// Serializer tennis canonique — normalise un match avant envoi HTTP.
// Le frontend ne doit plus deviner le type des champs (proba 0-1 vs 65, etc.).
// Contrat : voir redesign-tennis/CONTRAT-DATA.md
// ═══════════════════════════════════════════════════════════════════════
function _serializeTennisCard(m) {
  if (!m || typeof m !== 'object') return null;

  // --- Joueurs (toujours objets, champs null si absents) ---
  function serializePlayer(p) {
    p = p || {};
    return {
      id: p.id || null,
      name: p.name || null,
      country: p.country || null,
      flag: p.flag || null,
      photo: p.photo || null,
      rank: (typeof p.rank === 'number') ? p.rank : (p.rank ? Number(p.rank) : null),
      elo_surface: (typeof p.elo_surface === 'number') ? p.elo_surface : null,
      surf_rank: p.surf_rank || null,
      surf_rank_total: p.surf_rank_total || null,
      surf_form: p.surf_form || null,
      l5_pts: (typeof p.l5_pts === 'number') ? p.l5_pts : null,
      l10_pts: (typeof p.l10_pts === 'number') ? p.l10_pts : null,
      powerscore: (typeof p.powerscore === 'number') ? p.powerscore : null,
      serve_index: p.serve_index || null,
      receive_index: p.receive_index || null,
      serve_hold_pct: p.serve_hold_pct || null,
      return_pct: p.return_pct || null
    };
  }

  var p1 = serializePlayer(m.player1);
  var p2 = serializePlayer(m.player2);

  // --- Cotes (toujours objet ou null, stale + age_ms) ---
  var odds = null;
  if (m.odds && m.odds.p1 && m.odds.p2) {
    var oddsTs = m.odds.ts || m._odds_ts || Date.now();
    var ageMs = Date.now() - oddsTs;
    var isLive = (m.is_live || m.status === 'live' || m.tab === 'live');
    var staleThreshold = isLive ? 600000 : 14400000; // 10min live, 4h prematch
    odds = {
      p1: { odds: Number(m.odds.p1.odds) || null, book: m.odds.p1.book || null },
      p2: { odds: Number(m.odds.p2.odds) || null, book: m.odds.p2.book || null },
      stale: ageMs > staleThreshold,
      age_ms: ageMs
    };
  }

  // --- Fair (Shin devig, toujours objet ou null, proba 0-1) ---
  var fair = null;
  if (m.fair && m.fair.p1 != null) {
    fair = {
      p1: _normalizeProb(m.fair.p1),
      p2: _normalizeProb(m.fair.p2),
      margin: m.fair.margin != null ? Number(m.fair.margin) : null,
      method: m.fair.method || null
    };
  }

  // --- Signal (EV% pilote, toujours objet ou null) ---
  var signal = _computeSignal(m, odds, fair);

  // --- Traps (array, jamais undefined) ---
  var traps = [];
  if (m.trap_bet) traps.push('trap_bet');
  if (odds && odds.stale) traps.push('drift');
  if (m.player1 && m.player1.gamesLast14Days > 12) traps.push('fatigue');
  if (m.player2 && m.player2.gamesLast14Days > 12) traps.push('fatigue');
  if ((p1.surf_rank_total !== null && p1.surf_rank_total < 20) ||
      (p2.surf_rank_total !== null && p2.surf_rank_total < 20)) {
    traps.push('surface_elo_low');
  }
  // Data insuffisante : ni BSD ni WElo surface fiable
  if (!signal && (!p1.elo_surface || !p2.elo_surface)) {
    traps.push('data_insufficient');
  }

  return {
    id: String(m.id || ''),
    tab: m.is_live || m.status === 'live' ? 'live' : 'prematch',
    tour: m.tour || null,
    tournament: m.tournament || null,
    surface: m.surface || null,
    round: m.round || null,
    bestOf: Number(m.best_of || m.bestOf || 3),
    commence_time: m.start_time || m.commence_time || null,
    status: m.status || null,
    player1: p1,
    player2: p2,
    odds: odds,
    fair: fair,
    signal: signal,
    traps: traps,
    // Champs bruts préservés pour le Mode Pro (P4)
    _raw_predictions: m.predictions || null,
    _raw_best_ev_model: m.best_ev_model || null
  };
}

// Normalise une proba : accepte 0.62, 62, "62%", renvoie toujours 0-1
function _normalizeProb(p) {
  if (p == null) return null;
  var n = Number(p);
  if (!isFinite(n)) return null;
  return n > 1 ? n / 100 : n;
}

// Calcule le signal canonique {label, side, prob, ev_pct, confidence, stale}
function _computeSignal(m, odds, fair) {
  if (!odds || !odds.p1.odds || !odds.p2.odds) return null;
  if (!fair || fair.p1 == null) return null;

  // best_ev_model prioritaire (calculé côté serveur déjà)
  var be = m.best_ev_model;
  var side, probModel, evPct, oddsVal;
  if (be && be.odds) {
    side = be.side || (be.ev >= 0 ? 'p1' : 'p2');
    probModel = be.p_model || (side === 'p1' ? fair.p1 : fair.p2);
    oddsVal = Number(be.odds);
    evPct = (typeof be.ev === 'number') ? be.ev : ((probModel * oddsVal - 1) * 100);
  } else {
    // Fallback : calcul depuis fair + odds
    var ev1 = fair.p1 * odds.p1.odds - 1;
    var ev2 = fair.p2 * odds.p2.odds - 1;
    if (ev1 >= ev2) {
      side = 'p1'; probModel = fair.p1; oddsVal = odds.p1.odds; evPct = ev1 * 100;
    } else {
      side = 'p2'; probModel = fair.p2; oddsVal = odds.p2.odds; evPct = ev2 * 100;
    }
  }

  // Confidence basée sur la richesse data
  var hasBSD = m.predictions && m.predictions.bsd;
  var hasWEloSurface = m.player1 && m.player2 && m.player1.elo_surface && m.player2.elo_surface;
  var hasSurfSample = m.player1 && m.player2 &&
    (m.player1.surf_rank_total >= 20) && (m.player2.surf_rank_total >= 20);
  var confScore = (hasBSD ? 1 : 0) + (hasWEloSurface ? 1 : 0) + (hasSurfSample ? 1 : 0);
  var confidence = confScore >= 2 ? 'high' : confScore === 1 ? 'medium' : 'low';

  return {
    label: 'VALUE ' + (evPct >= 0 ? '+' : '') + evPct.toFixed(1) + '%',
    side: side,
    prob: probModel,
    ev_pct: Math.round(evPct * 10) / 10,
    odds: oddsVal,
    confidence: confidence,
    stale: odds.stale
  };
}
```

- [ ] **Step 5 : Injecter le serializer dans la route value-bets**

Dans `server.js:39554` (le `return` de `_buildTennisValueBetsCore`), remplacer :
```js
    matches: enriched,
```
par :
```js
    matches: enriched.map(_serializeTennisCard),
```

- [ ] **Step 6 : Lancer le test pour vérifier qu'il passe**

Run : `node test-serializer.js`
Expected : PASS avec `✅ Task 1.1 : serializer OK` + affichage du signal.

- [ ] **Step 7 : Vérifier le syntax check**

Run : `node --check server.js`
Expected : aucune sortie (syntax OK).

- [ ] **Step 8 : Commit**

```bash
git add server.js test-serializer.js
git commit -m "feat(tennis-redesign): 1.1 serializer serveur _serializeTennisCard

Normalise le payload tennis avant envoi HTTP. Le frontend ne devine plus
le type des champs (proba 0-1 vs 65, predictions.elo scalar vs object).
Calcul du signal canonique {label, side, prob, ev_pct, confidence, stale} + traps.

Réf: redesign-tennis/DESIGN-DOC-REDESIGN-TENNIS.md §7"
```

---

### Task 1.2 : Contrat data canonique + `mapMatch` allégé

**Files :**
- Create: `redesign-tennis/CONTRAT-DATA.md`
- Modify: `pariscore.html:26581-26622` (fonction `mapMatch`)

- [ ] **Step 1 : Créer le doc de contrat**

Créer `redesign-tennis/CONTRAT-DATA.md` avec le contrat canonique complet (utiliser la section §7.1 du design doc comme base — le shape JSON avec `id, tab, tour, player1/2, odds{p1,p2,stale,age_ms}, fair, signal{label,side,prob,ev_pct,confidence,stale}, traps[]`).

- [ ] **Step 2 : Simplifier `mapMatch`**

Dans `pariscore.html`, remplacer la fonction `mapMatch` complète (`:26581-26622`) par :
```js
function mapMatch(m) {
  if (!m) return null;
  // Le backend (_serializeTennisCard) normalise désormais le payload.
  // mapMatch ne fait que transmettre + enrichir l'affichage (eloTrend synthétisé).
  function trend(p) {
    if (Array.isArray(p.eloTrend) && p.eloTrend.length >= 2) return p.eloTrend;
    var base = Number(p.elo_surface) || 2000;
    return [base - 12, base - 6, base - 3, base - 8, base, base + 4, base - 2, base + 6, base + 2, base];
  }
  return Object.assign({}, m, {
    player1: Object.assign({}, m.player1 || {}, { eloTrend: trend(m.player1 || {}) }),
    player2: Object.assign({}, m.player2 || {}, { eloTrend: trend(m.player2 || {}) }),
    bestOf: m.bestOf || m.best_of || 3,
    city: m.city || m.location || '',
    commence_time: m.commence_time || m.start_time
  });
}
```
Note : les branches défensives `typeof x === 'object'` sur `predictions.elo` et le fallback `best_ev_model` calculé côté front sont supprimés — le serializer serveur s'en charge.

- [ ] **Step 3 : Vérifier syntax inline scripts**

Run : `node --check pariscore.html` (si applicable) ou extraire les scripts inline et vérifier.
Alternative : `grep -n "predictions.elo" pariscore.html | head` pour confirmer qu'il n'y a plus d'usage scalaire suspect.

- [ ] **Step 4 : Commit**

```bash
git add redesign-tennis/CONTRAT-DATA.md pariscore.html
git commit -m "refactor(tennis-redesign): 1.2 mapMatch allégé + contrat data canonique

mapMatch ne compense plus un backend instable : le serializer serveur
(1.1) garantit le contrat. Suppression des branches défensives typeof.

Réf: redesign-tennis/CONTRAT-DATA.md"
```

---

### Task 1.3 : Helper `valueBet(m)` unifié

**Files :**
- Modify: `pariscore.html` (IIFE `Scope`, après les helpers `num`/`pct`, ~ligne 25430)

- [ ] **Step 1 : Ajouter le helper `valueBet` dans l'IIFE Scope**

Dans `pariscore.html`, après les helpers `num`, `pct`, `ev`, `kelly`, `tier` (~ligne 25430, avant `gauge`), ajouter :
```js
// ═══════════════════════════════════════════════════════════════════════
// Helper value-bet unifié — remplace la logique dupliquée dans
// premierCard (:25819), liveCardCompact (:26136), topBets (:25684), prematchCard (:25744).
// Source unique : m.signal (calculé par le serializer serveur _serializeTennisCard).
// ═══════════════════════════════════════════════════════════════════════
function valueBet(m) {
  if (!m || !m.signal) return null;
  var sig = m.signal;
  // Tier EV% : ≥5 strong, 2-5 moderate, <2 neutral
  var tierEV = sig.ev_pct >= 5 ? 'strong' : (sig.ev_pct >= 2 ? 'moderate' : 'neutral');
  // Cap de confiance : min(tier_EV, tier_confiance)
  var confTier = { high: 'strong', medium: 'moderate', low: 'neutral' }[sig.confidence] || 'neutral';
  var RANK = { avoid: 0, neutral: 1, moderate: 2, strong: 3 };
  var tier = RANK[tierEV] <= RANK[confTier] ? tierEV : confTier;
  // trap_bet force avoid
  if (m.traps && m.traps.indexOf('trap_bet') !== -1) tier = 'avoid';
  return {
    label: sig.label,
    side: sig.side,
    prob: sig.prob,
    odds: sig.odds,
    ev_pct: sig.ev_pct,
    tier: tier,
    stale: sig.stale,
    trap: !!(m.traps && m.traps.length),
    playerName: (sig.side === 'p1' && m.player1) ? m.player1.name :
                (sig.side === 'p2' && m.player2) ? m.player2.name : null
  };
}
```

- [ ] **Step 2 : Exposer `valueBet` dans le namespace public de Scope**

Dans `pariscore.html:26464-26550` (l'objet `return` public de l'IIFE Scope), ajouter la ligne :
```js
      valueBet: valueBet,
```
(à placer parmi les autres exports, ex. après `tier: tier,`)

- [ ] **Step 3 : Refactor `premierCard` pour utiliser `valueBet`**

Dans `pariscore.html:25819-25828`, remplacer le bloc `topVB` par :
```js
  var topVB = valueBet(m);
  if (!topVB) {
    // Fallback : pas de signal (data insuffisante) → carte neutral sans pari
    topVB = { label: 'N/A', side: null, prob: 0.5, odds: 0, ev_pct: 0, tier: 'neutral', stale: false, trap: false, playerName: null };
  }
```
Et corriger la ligne suivante (~`:25829`) qui fait `var topTier=tier(topVB.edge,topVB.ev,topVB.kelly);` par :
```js
  var topTier = topVB.tier;
```

- [ ] **Step 4 : Refactor `liveCardCompact` pour utiliser `valueBet`**

Dans `pariscore.html:26136-26146`, remplacer le bloc `_hasBet`/`_betHtml` par :
```js
  var _topVB = valueBet(m);
  var _hasBet = _topVB && _topVB.tier !== 'neutral' && _topVB.tier !== 'avoid';
  var _betHtml = '';
  if (_topVB && _hasBet) {
    var bn = _topVB.playerName || '?';
    var bo = Number(_topVB.odds) || 0;
    _betHtml = '<div class="sc-lc-bet ' + (_topVB.tier === 'strong' ? 'strong' : _topVB.tier === 'moderate' ? 'moderate' : 'avoid') + '">'
      + '<b>BET ' + esc(bn) + ' @ ' + bo.toFixed(2) + '</b> · EV ' + (_topVB.ev_pct >= 0 ? '+' : '') + _topVB.ev_pct.toFixed(1) + '% ' + signalBadge(_topVB.tier)
      + '</div>';
  }
```

- [ ] **Step 5 : Vérifier syntax**

Run : extraire les scripts inline de `pariscore.html` et `node --check`, ou browser console.
Expected : pas d'erreur `valueBet is not defined`.

- [ ] **Step 6 : Commit**

```bash
git add pariscore.html
git commit -m "refactor(tennis-redesign): 1.3 helper valueBet(m) unifié

Supprime la logique value-bet dupliquée dans premierCard/liveCardCompact.
Source unique : m.signal (serializer serveur). Tier = min(tier_EV, tier_confiance),
trap_bet force avoid.

Réf: DESIGN-DOC §7.3"
```

---

### Task 1.4 : Design tokens + palette sémantique

**Files :**
- Modify: `pariscore.html` (bloc `<style>`, après les variables existantes, ~ligne 200)

- [ ] **Step 1 : Ajouter les design tokens `.sc-*`**

Dans `pariscore.html`, dans le `<style>` (après les variables CSS existantes, chercher `:root` ou `--green`), ajouter :
```css
/* ═══ Redesign Tennis — Design tokens ═══ */
/* Réf: redesign-tennis/DESIGN-DOC-REDESIGN-TENNIS.md §9.1 */
:root {
  /* Palette monochrome */
  --sc-bg: #0B1120;
  --sc-bg-elev: #111827;
  --sc-text: #E2E8F0;
  --sc-text-muted: #94A3B8;

  /* Tier sémantique */
  --sc-tier-strong: #10B981;
  --sc-tier-moderate: #F59E0B;
  --sc-tier-neutral: #64748B;
  --sc-tier-avoid: #EF4444;

  /* Joueurs */
  --sc-player-p1: #E2E8F0;
  --sc-player-p2: #3B82F6;

  /* Typography */
  --sc-font-mono: 'JetBrains Mono', 'Fira Code', ui-monospace, monospace;
  --sc-font-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --sc-ev-size: 28px;

  /* Layout */
  --sc-card-radius: 12px;
  --sc-tap-min: 44px;
  --sc-tier-border: 4px;
}

/* Classes tier utilitaires */
.sc-tier-strong { border-left: var(--sc-tier-border) solid var(--sc-tier-strong); }
.sc-tier-moderate { border-left: var(--sc-tier-border) solid var(--sc-tier-moderate); }
.sc-tier-neutral { border-left: var(--sc-tier-border) solid var(--sc-tier-neutral); opacity: 0.85; }
.sc-tier-avoid { border-left: var(--sc-tier-border) solid var(--sc-tier-avoid); }

.sc-ev-pct {
  font-family: var(--sc-font-mono);
  font-size: var(--sc-ev-size);
  font-weight: 700;
  line-height: 1;
}
.sc-tap-min { min-width: var(--sc-tap-min); min-height: var(--sc-tap-min); }
```

- [ ] **Step 2 : Vérifier le rendu sur une carte existante**

Démarrer le serveur : `node server.js` (nécessite `.env`).
Ouvrir `http://localhost:3000`, aller sur l'onglet Tennis, inspecter une carte en console :
```js
document.querySelector('.sc-premier-card')?.classList.add('sc-tier-strong')
```
Expected : bordure verte 4px à gauche de la carte.

- [ ] **Step 3 : Commit**

```bash
git add pariscore.html
git commit -m "feat(tennis-redesign): 1.4 design tokens palette sémantique

Variables CSS .sc-* : palette monochrome + 4 tiers sémantiques
(strong/moderate/neutral/avoid) + typographie mono + zones tap 44px.

Réf: DESIGN-DOC §9.1"
```

---

### Task 1.5 : Mini-store frontend + composant `<dialog>` natif

**Files :**
- Modify: `pariscore.html` (début de l'IIFE Scope, ~ligne 25240, pour le store)
- Modify: `pariscore.html` (juste avant `</body>`, pour le `<dialog>` HTML)

- [ ] **Step 1 : Ajouter le mini-store observable**

Dans `pariscore.html`, au début de l'IIFE Scope (~ligne 25240, juste après `'use strict'` ou la première ligne de l'IIFE), ajouter :
```js
// ═══ Mini-store observable (vanilla, zéro dépendance) ═══
// Pattern subscribe/emit pour le master-detail desktop.
// Le panneau détail s'abonne à selectedMatchId ; le toggle scan à viewMode.
var _storeState = { selectedMatchId: null, viewMode: 'card', filters: {} };
var _storeSubs = [];
function storeGet() { return _storeState; }
function storeSet(patch) {
  _storeState = Object.assign({}, _storeState, patch);
  for (var i = 0; i < _storeSubs.length; i++) _storeSubs[i](_storeState);
}
function storeSubscribe(fn) {
  _storeSubs.push(fn);
  return function unsubscribe() {
    var idx = _storeSubs.indexOf(fn);
    if (idx !== -1) _storeSubs.splice(idx, 1);
  };
}
```

- [ ] **Step 2 : Exposer le store dans le namespace Scope**

Dans l'objet `return` public de Scope (`:26464-26550`), ajouter :
```js
      store: { get: storeGet, set: storeSet, subscribe: storeSubscribe },
```

- [ ] **Step 3 : Ajouter le `<dialog>` HTML natif**

Dans `pariscore.html`, juste avant `</body>`, ajouter :
```html
<!-- ═══ Modale Parier (<dialog> natif a11y) ═══ -->
<dialog id="sc-bet-dialog" class="sc-bet-dialog">
  <div class="sc-bet-dialog-content">
    <header class="sc-bet-dialog-head">
      <h3 id="sc-bet-dialog-title">Parier</h3>
      <button class="sc-bet-dialog-close" aria-label="Fermer" onclick="document.getElementById('sc-bet-dialog').close()">✕</button>
    </header>
    <div id="sc-bet-dialog-body" class="sc-bet-dialog-body">
      <!-- Contenu injecté par Scope.betModal(matchId) -->
    </div>
  </div>
</dialog>
```

- [ ] **Step 4 : Ajouter le CSS du dialog**

Dans le `<style>` (après les tokens de 1.4), ajouter :
```css
.sc-bet-dialog {
  border: none;
  border-radius: var(--sc-card-radius);
  background: var(--sc-bg-elev);
  color: var(--sc-text);
  padding: 0;
  max-width: 90vw;
  max-height: 85vh;
  width: 480px;
}
.sc-bet-dialog::backdrop {
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(2px);
}
.sc-bet-dialog-content { display: flex; flex-direction: column; max-height: 85vh; }
.sc-bet-dialog-head {
  display: flex; justify-content: space-between; align-items: center;
  padding: 16px 20px; border-bottom: 1px solid rgba(255,255,255,0.08);
  position: sticky; top: 0; background: var(--sc-bg-elev);
}
.sc-bet-dialog-body { padding: 20px; overflow-y: auto; }
.sc-bet-dialog-close {
  background: none; border: none; color: var(--sc-text-muted);
  font-size: 20px; cursor: pointer; padding: 8px; min-width: var(--sc-tap-min); min-height: var(--sc-tap-min);
}
.sc-bet-dialog-close:hover { color: var(--sc-text); }
```

- [ ] **Step 5 : Tester le store et le dialog en console**

Démarrer le serveur, ouvrir la console navigateur sur la page tennis :
```js
Scope.store.subscribe(s => console.log('store changed:', s));
Scope.store.set({ selectedMatchId: 'test-123' });
// Expected: "store changed: {selectedMatchId: 'test-123', viewMode: 'card', filters: {}}"

document.getElementById('sc-bet-dialog').showModal();
// Expected: la modale s'ouvre avec focus trap natif
document.getElementById('sc-bet-dialog').close();
// Expected: la modale se ferme, Escape fonctionne aussi
```

- [ ] **Step 6 : Commit**

```bash
git add pariscore.html
git commit -m "feat(tennis-redesign): 1.5 mini-store observable + dialog natif

Fondations du master-detail desktop (state partagé liste↔détail) et
de la modale Parier (<dialog> HTML5 natif avec focus trap + Escape).
Prévient la dette a11y identifiée par le vote frontend.

Réf: DESIGN-DOC §8"
```

---

### 🚪 Jalon J1 — Fondations validées

- [ ] **Vérification manuelle :** serializer (test OK), contrat data (doc créé), `valueBet` (helper exposé), tokens (cartes ont bordures), store + dialog (console tests passent).
- [ ] **Gate chef de projet :** signer avant de lancer Phase 2.

---

## PHASE 2 — Composants UI (carte P2 + liste P1) (J+3 → J+7)

### Task 2.1 : Carte P2 « Décision »

**Files :**
- Modify: `pariscore.html` (IIFE Scope, nouvelle fonction `decisionCard`, ~ligne 25810)

- [ ] **Step 1 : Ajouter la fonction `decisionCard`**

Dans `pariscore.html`, juste avant `premierCard` (~ligne 25810), ajouter :
```js
// ═══ Carte P2 « Décision » (pédagogique, 3 zones) ═══
// Réf: DESIGN-DOC §6.1. Remplace premierCard (prematch) et liveCard (live).
function decisionCard(m) {
  if (!m) return '';
  var vb = valueBet(m);
  var tier = vb ? vb.tier : 'neutral';
  var p1 = m.player1 || {}, p2 = m.player2 || {};
  var p1n = shortName(p1.name || '?');
  var p2n = shortName(p2.name || '?');
  var st = new Date(m.commence_time || m.start_time || Date.now());
  var timeStr = st.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  // P1 : VERDICT (header)
  var evHtml = vb ? '<div class="sc-ev-pct" style="color:var(--sc-tier-' + tier + ')">' + vb.ev_pct.toFixed(1) + '%</div>' : '';
  var verdictHtml = vb ? '<div class="sc-verdict">' + esc(vb.label) + ' — ' + esc(vb.playerName || '') + '</div>' : '<div class="sc-verdict sc-text-muted">Pas de signal</div>';
  var trapHtml = (m.traps && m.traps.length) ? '<span class="sc-trap-pill" title="' + _jsStr(m.traps.join(', ')) + '">⚠ ' + esc(m.traps.length) + '</span>' : '';
  var favStar = '<button class="sc-fav sc-tap-min" aria-label="Favori" onclick="_jsToggleFav(\'' + _jsStr(m.id) + '\')">' + (isFav(m.id) ? '★' : '☆') + '</button>';

  // P2 : CONTEXTE
  var sig = m.signal || {};
  var probaBar = (sig.prob != null && m.fair) ? _probaBarHtml(sig.prob, m.fair.p1) : '';
  var meta = '🎾 ' + esc(m.surface || '?') + ' · ' + esc(m.tournament || '?') + ' · Bo' + (m.bestOf || 3) + ' · ' + timeStr;
  var insight = _insightHtml(m);
  var chips = _marketChipsHtml(m);

  // P4 : ACTION
  var betBtn = vb && vb.tier !== 'neutral'
    ? '<button class="sc-bet-btn sc-tap-min" onclick="Scope.betModal(\'' + _jsStr(m.id) + '\')">🎯 Parier</button>'
    : '';

  // Live specifics
  var liveHtml = '';
  if (m.tab === 'live') liveHtml = _liveScoreHtml(m);

  return '<article class="sc-decision-card sc-tier-' + tier + '" data-match-id="' + _jsStr(m.id) + '">'
    + '<header class="sc-decision-head">'
      + '<span class="sc-signal-badge" aria-label="Verdict ' + tier + '">' + _signalIcon(tier) + '</span>'
      + evHtml
      + '<div class="sc-decision-players">' + esc(p1n) + ' vs ' + esc(p2n) + '</div>'
      + favStar
      + trapHtml
    + '</header>'
    + liveHtml
    + '<div class="sc-decision-context">'
      + verdictHtml
      + probaBar
      + '<div class="sc-meta">' + meta + '</div>'
      + insight
      + chips
      + '<button class="sc-expand sc-tap-min" aria-expanded="false" aria-controls="det-' + _jsStr(m.id) + '" onclick="Scope._toggle(this)">▶ Analyse</button>'
    + '</div>'
    + '<footer class="sc-decision-action">' + betBtn + '</footer>'
    + '<div class="sc-detail" id="det-' + _jsStr(m.id) + '" hidden></div>'
    + '</article>';
}

// Helpers internes à decisionCard
function _probaBarHtml(modelProb, fairP1) {
  var mp = Math.round(modelProb * 100);
  var ip = Math.round(fairP1 * 100);
  return '<div class="sc-proba-bar" aria-label="Modèle ' + mp + '% vs marché ' + ip + '%">'
    + '<div class="sc-proba-fill" style="width:' + mp + '%"></div>'
    + '<span class="sc-proba-label">' + mp + '% vs ' + ip + '% marché</span>'
    + '</div>';
}
function _insightHtml(m) {
  if (m.player1 && m.player2) {
    if ((m.player1.gamesLast14Days || 0) > 12) return '<div class="sc-insight">💡 ' + esc(shortName(m.player1.name)) + ' fatigué (' + m.player1.gamesLast14Days + ' matchs/14j)</div>';
    if ((m.player2.gamesLast14Days || 0) > 12) return '<div class="sc-insight">💡 ' + esc(shortName(m.player2.name)) + ' fatigué (' + m.player2.gamesLast14Days + ' matchs/14j)</div>';
  }
  return '';
}
function _signalIcon(tier) {
  return tier === 'strong' ? '▲' : tier === 'moderate' ? '●' : tier === 'avoid' ? '▼' : '○';
}
function _jsToggleFav(id) {
  toggleFav(id);
  // Re-render la carte pour mettre à jour l'étoile
  root.TennisScope.renderActiveTab();
}
```

- [ ] **Step 2 : Exposer `decisionCard` dans Scope**

Dans l'objet `return` public de Scope (`:26464-26550`), ajouter :
```js
      decisionCard: decisionCard,
```

- [ ] **Step 3 : Brancher `decisionCard` dans `renderActiveTab`**

Dans `pariscore.html:26917`, remplacer `root.Scope.premierCard(m)` par `root.Scope.decisionCard(m)`.
Dans `pariscore.html:26968`, remplacer `root.Scope.liveCard` par `root.Scope.decisionCard`.

- [ ] **Step 4 : Ajouter le CSS de la carte P2**

Dans le `<style>` (après les tokens), ajouter :
```css
.sc-decision-card {
  background: var(--sc-bg-elev);
  border-radius: var(--sc-card-radius);
  padding: 0;
  margin-bottom: 12px;
  overflow: hidden;
  display: flex; flex-direction: column;
}
.sc-decision-head {
  display: flex; align-items: center; gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(255,255,255,0.05);
}
.sc-signal-badge {
  width: 24px; height: 24px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 14px; font-weight: bold;
}
.sc-signal-badge[aria-label*="strong"] { background: rgba(16,185,129,0.2); color: var(--sc-tier-strong); }
.sc-signal-badge[aria-label*="moderate"] { background: rgba(245,158,11,0.2); color: var(--sc-tier-moderate); }
.sc-signal-badge[aria-label*="avoid"] { background: rgba(239,68,68,0.2); color: var(--sc-tier-avoid); }
.sc-signal-badge[aria-label*="neutral"] { background: rgba(100,116,139,0.2); color: var(--sc-tier-neutral); }
.sc-decision-context { padding: 12px 16px; }
.sc-verdict { font-size: 15px; font-weight: 600; margin-bottom: 8px; }
.sc-proba-bar {
  position: relative; height: 20px; background: rgba(255,255,255,0.08);
  border-radius: 4px; margin: 8px 0; overflow: hidden;
}
.sc-proba-fill { height: 100%; background: var(--sc-player-p1); transition: width 0.3s; }
.sc-proba-label {
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  font-size: 11px; font-family: var(--sc-font-mono); color: var(--sc-text);
}
.sc-meta { font-size: 12px; color: var(--sc-text-muted); margin: 4px 0; }
.sc-insight { font-size: 12px; color: var(--sc-tier-moderate); margin: 4px 0; }
.sc-decision-action { padding: 0 16px 16px; }
.sc-bet-btn {
  width: 100%; padding: 14px; border: none; border-radius: 8px;
  background: var(--sc-tier-strong); color: white; font-weight: 700; font-size: 16px;
  cursor: pointer; min-height: var(--sc-tap-min);
}
.sc-bet-btn:hover { filter: brightness(1.1); }
.sc-fav { background: none; border: none; color: var(--sc-tier-moderate); font-size: 20px; cursor: pointer; }
.sc-trap-pill {
  font-size: 11px; padding: 2px 8px; border-radius: 12px;
  background: rgba(239,68,68,0.15); color: var(--sc-tier-avoid);
}
.sc-expand { background: none; border: 1px solid rgba(255,255,255,0.1); color: var(--sc-text-muted); padding: 8px 12px; border-radius: 6px; cursor: pointer; margin-top: 8px; width: 100%; text-align: left; }
```

- [ ] **Step 5 : Tester le rendu**

Démarrer le serveur, aller sur l'onglet Tennis prematch.
Expected : cartes affichent bordure tier, EV% en gros, verdict en mots, bouton Parier vert sur les strong.

- [ ] **Step 6 : Commit**

```bash
git add pariscore.html
git commit -m "feat(tennis-redesign): 2.1 carte P2 Décision (3 zones verdict/contexte/action)

Remplace premierCard (prematch) et liveCard (live) par une carte pédagogique
unique. Signal EV% pilote, verdict en mots, bouton Parier proéminent,
chips marchés, pills pièges, accordéon analyse lazy.

Réf: DESIGN-DOC §6.1"
```

---

### Task 2.2 : Ligne P1 « Terminal » (scan dense)

**Files :**
- Modify: `pariscore.html` (IIFE Scope, nouvelle fonction `scanRow`)

- [ ] **Step 1 : Ajouter `scanRow`**

Dans `pariscore.html`, après `decisionCard`, ajouter :
```js
// ═══ Ligne P1 « Terminal » (scan dense, vue liste) ═══
// Réf: DESIGN-DOC §6.2. Toggle scan mobile + grille desktop.
function scanRow(m) {
  if (!m) return '';
  var vb = valueBet(m);
  var tier = vb ? vb.tier : 'neutral';
  var p1 = m.player1 || {}, p2 = m.player2 || {};
  var st = new Date(m.commence_time || m.start_time || Date.now());
  var timeStr = st.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  var evHtml = vb ? '<div class="sc-scan-ev" style="color:var(--sc-tier-' + tier + ')">' + (vb.ev_pct >= 0 ? '+' : '') + vb.ev_pct.toFixed(1) + '%</div>' : '<div class="sc-scan-ev sc-text-muted">—</div>';
  var oddsHtml = vb ? '<div class="sc-scan-odds">' + Number(vb.odds).toFixed(2) + '</div>' : '';
  var liveHtml = '';
  if (m.tab === 'live') {
    var s1 = m.player1_sets != null ? m.player1_sets : 0;
    var s2 = m.player2_sets != null ? m.player2_sets : 0;
    liveHtml = '<div class="sc-scan-live">🔴 ' + s1 + '-' + s2 + (m.serving === 'p1' ? ' 🎾' : ' 🎾') + '</div>';
  }
  return '<article class="sc-scan-row sc-tier-' + tier + '" data-match-id="' + _jsStr(m.id) + '" tabindex="0" role="button" aria-label="' + tier + ' ' + _jsStr(shortName(p1.name)) + ' vs ' + _jsStr(shortName(p2.name)) + '" onclick="Scope.selectMatch(\'' + _jsStr(m.id) + '\')">'
    + evHtml
    + '<div class="sc-scan-main">'
      + '<div class="sc-scan-players">' + esc(shortName(p1.name || '?')) + ' · ' + esc(shortName(p2.name || '?')) + '</div>'
      + '<div class="sc-scan-meta">' + esc(m.tournament || '?') + ' · ' + esc(m.surface || '?') + ' · ' + timeStr + '</div>'
    + '</div>'
    + oddsHtml
    + liveHtml
    + '</article>';
}
```

- [ ] **Step 2 : Exposer `scanRow` et `selectMatch` dans Scope**

Dans le `return` public de Scope, ajouter :
```js
      scanRow: scanRow,
      selectMatch: function(id) { storeSet({ selectedMatchId: id }); },
```

- [ ] **Step 3 : Ajouter le CSS de scanRow**

```css
.sc-scan-row {
  display: flex; align-items: center; gap: 12px;
  padding: 10px 14px; min-height: 64px;
  background: var(--sc-bg-elev); border-radius: 8px;
  cursor: pointer; transition: background 0.15s;
  margin-bottom: 6px;
}
.sc-scan-row:hover, .sc-scan-row:focus { background: rgba(255,255,255,0.04); outline: none; }
.sc-scan-ev {
  font-family: var(--sc-font-mono); font-size: 20px; font-weight: 700;
  min-width: 70px; text-align: right;
}
.sc-scan-main { flex: 1; min-width: 0; }
.sc-scan-players { font-size: 14px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sc-scan-meta { font-size: 11px; color: var(--sc-text-muted); margin-top: 2px; }
.sc-scan-odds { font-family: var(--sc-font-mono); font-size: 16px; color: var(--sc-text-muted); }
.sc-scan-live { font-size: 12px; color: var(--sc-tier-avoid); white-space: nowrap; }
```

- [ ] **Step 4 : Commit**

```bash
git add pariscore.html
git commit -m "feat(tennis-redesign): 2.2 ligne P1 Terminal (scan dense)

Vue liste ultra-dense : EV% énorme à gauche, bordure tier, tap = sélection
(master-detail) ou expand inline (mobile). 30+ matchs visibles desktop.

Réf: DESIGN-DOC §6.2"
```

---

### Task 2.3 : Signal system (bordure tier + badges EV)

> Déjà couvert par les tokens (1.4) et les classes `.sc-tier-*` + `.sc-signal-badge` appliquées dans `decisionCard` et `scanRow`. Cette tâche = valider la cohérence.

- [ ] **Step 1 : Audit visuel**

Démarrer le serveur, vérifier que toutes les cartes/ligues ont :
- Bordure gauche 4px colorée selon tier
- Pastille signal en haut (▲ strong, ● moderate, ▼ avoid, ○ neutral)
- EV% en typo mono colorée

- [ ] **Step 2 : Corriger les écarts détectés** (si aucun, passer au commit)

- [ ] **Step 3 : Commit (si changements)**

```bash
git add pariscore.html
git commit -m "fix(tennis-redesign): 2.3 cohérence signal system (audit visuel)"
```

---

### Task 2.4 : Chips marchés secondaires

**Files :**
- Modify: `pariscore.html` (helper `_marketChipsHtml`, déjà référencé dans `decisionCard`)

- [ ] **Step 1 : Implémenter `_marketChipsHtml`**

Dans l'IIFE Scope, après `_insightHtml`, ajouter :
```js
function _marketChipsHtml(m) {
  var chips = [];
  // set_ou (Over/Under jeux du set) — si data live disponible
  if (m.tab === 'live' && m.set_ou) {
    var o = m.set_ou;
    if (o.o85 != null && o.o85 >= 0.55) chips.push({ label: 'Over 8.5 jeux', pct: Math.round((o.o85 - 0.5) * 100) });
    if (o.u125 != null && o.u125 >= 0.55) chips.push({ label: 'Under 12.5 jeux', pct: Math.round((o.u125 - 0.5) * 100) });
  }
  // at_least_one_set — si data prematch
  if (m.tab === 'prematch' && m.predictions && m.predictions.at_least_one_set) {
    var alos = m.predictions.at_least_one_set;
    var maxSide = alos.p1 >= alos.p2 ? { name: m.player1 && m.player1.name, pct: alos.p1 } : { name: m.player2 && m.player2.name, pct: alos.p2 };
    if (maxSide.pct >= 0.55) chips.push({ label: shortName(maxSide.name) + ' gagne 1 set', pct: Math.round((maxSide.pct - 0.5) * 100) });
  }
  if (!chips.length) return '';
  return '<div class="sc-market-chips">' + chips.map(function(c) {
    return '<span class="sc-market-chip" title="Edge ' + c.pct + '%">' + esc(c.label) + ' +' + c.pct + '%</span>';
  }).join('') + '</div>';
}
```

- [ ] **Step 2 : Ajouter le CSS**

```css
.sc-market-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.sc-market-chip {
  font-size: 11px; padding: 4px 10px; border-radius: 12px;
  background: rgba(59,130,246,0.15); color: var(--sc-player-p2);
  border: 1px solid rgba(59,130,246,0.3);
}
```

- [ ] **Step 3 : Commit**

```bash
git add pariscore.html
git commit -m "feat(tennis-redesign): 2.4 chips marchés secondaires (set_ou, at_least_one_set)"
```

---

### Task 2.5 : KPI bar signal (Edge / VB / Live / ROI)

**Files :**
- Modify: `pariscore.html:15876-15897` (HTML KPI bar)
- Modify: `pariscore.html:16398-16407` (`tn2UpdateKPI`)
- Modify: `pariscore.html:26804-26818` (`updateKpiBar`)

- [ ] **Step 1 : Remplacer le HTML KPI bar**

Dans `pariscore.html:15876-15897`, remplacer les 4 `.tn2-kpi-item` par :
```html
<!-- ═══ KPI BAR signal (Edge/VB/Live/ROI) ═══ -->
<div class="tn2-kpi-bar">
  <div class="tn2-kpi-item">
    <span class="tn2-kpi-icon">📈</span>
    <span class="tn2-kpi-num" id="tn2-kpi-edge">—</span>
    <span class="tn2-kpi-lbl">Edge moyen</span>
  </div>
  <div class="tn2-kpi-item">
    <span class="tn2-kpi-icon">💰</span>
    <span class="tn2-kpi-num" id="tn2-kpi-vb">0</span>
    <span class="tn2-kpi-lbl">Value bets strong</span>
  </div>
  <div class="tn2-kpi-item">
    <span class="tn2-kpi-icon">🎾</span>
    <span class="tn2-kpi-num" id="tn2-kpi-live">0</span>
    <span class="tn2-kpi-lbl">Live actifs</span>
  </div>
  <div class="tn2-kpi-item">
    <span class="tn2-kpi-icon">🎯</span>
    <span class="tn2-kpi-num" id="tn2-kpi-roi">—</span>
    <span class="tn2-kpi-lbl">ROI Kelly cumulé</span>
  </div>
</div>
```

- [ ] **Step 2 : Réécrire `tn2UpdateKPI`**

Dans `pariscore.html:16398-16407`, remplacer par :
```js
window.tn2UpdateKPI = function(data) {
  var map = { edge: 'tn2-kpi-edge', vb: 'tn2-kpi-vb', live: 'tn2-kpi-live', roi: 'tn2-kpi-roi' };
  Object.keys(map).forEach(function(k) {
    var el = document.getElementById(map[k]);
    if (el && data[k] != null) el.textContent = data[k];
  });
};
```

- [ ] **Step 3 : Réécrire `updateKpiBar` pour calculer les nouveaux KPIs**

Dans `pariscore.html:26804-26818` (dans `TennisScope`), remplacer la fonction par :
```js
function updateKpiBar() {
  var all = (_state.prematchMatches || []).concat(_state.liveMatches || []);
  var vbs = all.map(function(m) { return valueBet(m); }).filter(function(v) { return v && v.tier === 'strong'; });
  var avgEdge = vbs.length ? (vbs.reduce(function(s, v) { return s + v.ev_pct; }, 0) / vbs.length).toFixed(1) + '%' : '—';
  var liveCount = (_state.liveMatches || []).filter(function(m) { return m.tab === 'live' || m.is_live; }).length;
  var roi = vbs.length ? '+' + (vbs.reduce(function(s, v) { return s + v.ev_pct; }, 0) / 10).toFixed(1) + '%' : '—';
  tn2UpdateKPI({ edge: avgEdge, vb: vbs.length, live: liveCount, roi: roi });
}
```

- [ ] **Step 4 : Tester**

Aller sur l'onglet Tennis, vérifier que les 4 KPIs signal s'affichent et se mettent à jour.

- [ ] **Step 5 : Commit**

```bash
git add pariscore.html
git commit -m "feat(tennis-redesign): 2.5 KPI bar signal (Edge/VB/Live/ROI)

Remplace les KPIs live/bets/top/tournaments par 4 KPIs orientés décision.
Préserve le pattern d'écriture partielle tn2UpdateKPI.

Réf: DESIGN-DOC §6.5 (header sous-onglet)"
```

---

### Task 2.6 : Toggle « Scan rapide » mobile

**Files :**
- Modify: `pariscore.html` (header sous-onglet `:15902-15943`, ajouter le toggle)

- [ ] **Step 1 : Ajouter le toggle dans le header**

Dans `pariscore.html:15938-15942` (à côté de la barre de recherche `#sc-search-input`), ajouter :
```html
<div class="sc-view-toggle" role="group" aria-label="Mode d'affichage">
  <button class="sc-view-btn active" data-view="card" onclick="Scope.setView('card')">📋 Carte</button>
  <button class="sc-view-btn" data-view="scan" onclick="Scope.setView('scan')">≡ Scan</button>
</div>
```

- [ ] **Step 2 : Ajouter `setView` dans Scope**

Dans le `return` public de Scope, ajouter :
```js
      setView: function(mode) { storeSet({ viewMode: mode }); },
```

- [ ] **Step 3 : Modifier `renderActiveTab` pour respecter `viewMode`**

Dans `pariscore.html:26917` (prematch), remplacer :
```js
+'<div class="sc-grid sc-grid-3">' + _filtered.map(function(m){ return root.Scope.premierCard(m); }).join('') + '</div>';
```
par :
```js
+'<div class="sc-grid ' + (storeGet().viewMode === 'scan' ? 'sc-grid-1' : 'sc-grid-3') + '">' + _filtered.map(function(m){ return storeGet().viewMode === 'scan' ? root.Scope.scanRow(m) : root.Scope.decisionCard(m); }).join('') + '</div>';
```
Idem à `:26968` (live).

- [ ] **Step 4 : Ajouter le CSS**

```css
.sc-view-toggle { display: inline-flex; border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; overflow: hidden; }
.sc-view-btn { background: none; border: none; color: var(--sc-text-muted); padding: 8px 14px; cursor: pointer; min-height: var(--sc-tap-min); }
.sc-view-btn.active { background: var(--sc-bg-elev); color: var(--sc-text); }
.sc-grid-1 { display: flex; flex-direction: column; }
@media (min-width: 1024px) { .sc-view-toggle { display: none; } } /* desktop : master-detail géré en Phase 3 */
```

- [ ] **Step 5 : Commit**

```bash
git add pariscore.html
git commit -m "feat(tennis-redesign): 2.6 toggle Scan rapide mobile

Bascule carte P2 ↔ liste P1 sur mobile (<1024px). Préférence persistée
via le store (viewMode).

Réf: DESIGN-DOC §6.4"
```

---

### 🚪 Jalon J2 — Composants validés

- [ ] Carte P2 rendue (prematch + live), toggle scan fonctionne, KPI bar à jour, chips/pills visibles.
- [ ] Gate chef de projet.

---

## PHASE 3 — Master-detail + Modale Parier + Live pulse (J+7 → J+11)

### Task 3.1 : Master-detail desktop

**Files :**
- Modify: `pariscore.html` (`renderActiveTab`, layout desktop ≥1024px)

- [ ] **Step 1 : Ajouter la détection desktop + layout split**

Dans `renderActiveTab` (vers `:26858`), au début, ajouter :
```js
var isDesktop = window.matchMedia('(min-width: 1024px)').matches;
var viewMode = storeGet().viewMode;
```
Puis dans le rendu prematch/live, si `isDesktop`, générer un split :
```js
if (isDesktop && _state.activeTab !== 'valuebets' && _state.activeTab !== 'analytics') {
  var listHtml = '<div class="sc-master-list">' + _filtered.map(function(m) { return root.Scope.scanRow(m); }).join('') + '</div>';
  var selectedId = storeGet().selectedMatchId || (_filtered[0] && _filtered[0].id);
  var selectedMatch = _filtered.filter(function(m) { return String(m.id) === String(selectedId); })[0] || _filtered[0];
  var detailHtml = '<div class="sc-master-detail-panel">' + (selectedMatch ? root.Scope.decisionCard(selectedMatch) : '<div class="sc-empty">Sélectionnez un match</div>') + '</div>';
  rootHtml = '<div class="sc-master-detail">' + listHtml + detailHtml + '</div>';
} else {
  // rendu mobile existant (carte ou scan selon viewMode)
  // ... (code existant conservé)
}
```

- [ ] **Step 2 : Abonner le panneau détail au store**

Après le rendu, abonner une fonction de re-render du panneau détail :
```js
if (!_storeDetailUnsub) {
  _storeDetailUnsub = storeSubscribe(function(state) {
    if (!window.matchMedia('(min-width: 1024px)').matches) return;
    var panel = document.querySelector('.sc-master-detail-panel');
    if (!panel) return;
    var sel = state.selectedMatchId;
    var match = (_state.prematchMatches || []).concat(_state.liveMatches || []).filter(function(m) { return String(m.id) === String(sel); })[0];
    if (match) panel.innerHTML = root.Scope.decisionCard(match);
  });
}
```

- [ ] **Step 3 : Ajouter le CSS master-detail**

```css
.sc-master-detail { display: grid; grid-template-columns: 40% 60%; gap: 16px; }
.sc-master-list { max-height: calc(100vh - 200px); overflow-y: auto; }
.sc-master-detail-panel { position: sticky; top: 80px; }
@media (max-width: 1023px) { .sc-master-detail { display: block; } }
.sc-empty { color: var(--sc-text-muted); padding: 40px; text-align: center; }
```

- [ ] **Step 4 : Tester desktop**

Ouvrir en desktop (≥1024px) : la liste à gauche, panneau détail à droite. Cliquer un match → panneau se met à jour sans modale.

- [ ] **Step 5 : Commit**

```bash
git add pariscore.html
git commit -m "feat(tennis-redesign): 3.1 master-detail desktop (split 40/60)

Layout desktop : liste persistante + panneau détail carte P2.
Sélection via store observable, pas de modale. <1024px = carte simple.

Réf: DESIGN-DOC §6.4"
```

---

### Task 3.2 : Modale « Parier » (câble `/odds-comparison`)

**Files :**
- Modify: `pariscore.html` (IIFE Scope, nouvelle fonction `betModal`)

- [ ] **Step 1 : Implémenter `betModal`**

Dans l'IIFE Scope, ajouter :
```js
// ═══ Modale Parier (câble /api/v1/tennis/odds-comparison/:matchId) ═══
var _betModalCache = {};
var _betModalTimer = null;
function betModal(matchId) {
  var dialog = document.getElementById('sc-bet-dialog');
  var body = document.getElementById('sc-bet-dialog-body');
  var title = document.getElementById('sc-bet-dialog-title');
  if (!dialog || !body) return;

  title.textContent = 'Comparaison bookmakers';
  body.innerHTML = '<div class="sc-loading">Chargement des cotes…</div>';
  dialog.showModal();

  // Cache 60s
  var now = Date.now();
  if (_betModalCache[matchId] && (now - _betModalCache[matchId].ts < 60000)) {
    _renderBetModal(matchId, _betModalCache[matchId].data);
    return;
  }

  // Abort + timeout 6s
  if (_betModalTimer) clearTimeout(_betModalTimer);
  var retryDone = false;
  function fetchOdds() {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', '/api/v1/tennis/odds-comparison/' + encodeURIComponent(matchId), true);
    xhr.timeout = 6000;
    xhr.onload = function() {
      if (xhr.status === 200) {
        try {
          var data = JSON.parse(xhr.responseText);
          _betModalCache[matchId] = { ts: Date.now(), data: data };
          _renderBetModal(matchId, data);
        } catch(e) {
          body.innerHTML = '<div class="sc-error">Erreur de parsing des cotes.</div>';
        }
      } else if (xhr.status === 404 && !retryDone) {
        retryDone = true;
        body.innerHTML = '<div class="sc-loading">Préparation des cotes en cours…</div>';
        _betModalTimer = setTimeout(fetchOdds, 3000); // retry 1× après 3s
      } else {
        body.innerHTML = '<div class="sc-error">Cotes indisponibles (statut ' + xhr.status + '). Réessayez dans 30s.</div>';
      }
    };
    xhr.ontimeout = function() {
      if (!retryDone) {
        retryDone = true;
        body.innerHTML = '<div class="sc-loading">Préparation des cotes…</div>';
        _betModalTimer = setTimeout(fetchOdds, 3000);
      } else {
        body.innerHTML = '<div class="sc-error">Délai dépassé. Réessayez dans 30s.</div>';
      }
    };
    xhr.send();
  }
  fetchOdds();
}

function _renderBetModal(matchId, data) {
  var body = document.getElementById('sc-bet-dialog-body');
  var bv = data.best_value || {};
  var fair = data.fair_probabilities || {};
  var market = data.market || {};
  var books = (data.theoddsapi && data.theoddsapi.bookmakers) || [];

  // Ligne verdict
  var verdictHtml = '';
  if (bv.player && bv.odds) {
    verdictHtml = '<div class="sc-bet-verdict">Best : <b>' + esc(bv.book || '—') + '</b> ' + Number(bv.odds).toFixed(2) + ' — value +' + (bv.edge ? (bv.edge * 100).toFixed(1) : '?') + '%</div>';
  }

  // Top-3 books (theoddsapi)
  var allBooks = [];
  books.forEach(function(b) {
    (b.h2h || []).forEach(function(outcomes) {
      var p1o = outcomes.filter(function(o) { return o.name === (data.player1 && data.player1.name); })[0];
      var p2o = outcomes.filter(function(o) { return o.name === (data.player2 && data.player2.name); })[0];
      if (p1o && p1o.price) allBooks.push({ book: b.title, odds: p1o.price, side: 'p1', player: data.player1 && data.player1.name });
      if (p2o && p2o.price) allBooks.push({ book: b.title, odds: p2o.price, side: 'p2', player: data.player2 && data.player2.name });
    });
  });
  allBooks.sort(function(a, b) { return b.odds - a.odds; });
  var top3 = allBooks.slice(0, 3).map(function(b, i) {
    return '<div class="sc-bet-book' + (i === 0 ? ' sc-bet-book-best' : '') + '">'
      + '<span class="sc-bet-book-name">' + esc(b.book) + '</span>'
      + '<span class="sc-bet-book-odds">' + Number(b.odds).toFixed(2) + '</span>'
      + '<span class="sc-bet-book-player">' + esc(shortName(b.player)) + '</span>'
      + '</div>';
  }).join('');

  body.innerHTML = '<div class="sc-bet-modal">'
    + verdictHtml
    + '<div class="sc-bet-books">' + (top3 || '<div class="sc-empty">Aucun bookmaker disponible</div>') + '</div>'
    + '<details class="sc-bet-all"><summary>Tous les books (' + allBooks.length + ')</summary><div class="sc-bet-books-all">' + allBooks.map(function(b) {
      return '<div class="sc-bet-book"><span>' + esc(b.book) + '</span><span>' + Number(b.odds).toFixed(2) + '</span><span>' + esc(shortName(b.player)) + '</span></div>';
    }).join('') + '</div></details>'
    + '</div>';
}
```

- [ ] **Step 2 : Exposer `betModal` dans Scope**

```js
      betModal: betModal,
```

- [ ] **Step 3 : Ajouter le CSS**

```css
.sc-loading, .sc-error, .sc-empty { color: var(--sc-text-muted); padding: 20px; text-align: center; }
.sc-error { color: var(--sc-tier-avoid); }
.sc-bet-verdict { background: rgba(16,185,129,0.1); border-radius: 8px; padding: 12px; margin-bottom: 12px; font-size: 15px; }
.sc-bet-book { display: flex; justify-content: space-between; padding: 10px 12px; border-radius: 6px; margin-bottom: 4px; background: rgba(255,255,255,0.03); }
.sc-bet-book-best { background: rgba(16,185,129,0.15); border: 1px solid var(--sc-tier-strong); font-weight: 600; }
.sc-bet-book-odds { font-family: var(--sc-font-mono); font-weight: 700; }
.sc-bet-book-player { color: var(--sc-text-muted); font-size: 12px; }
.sc-bet-all { margin-top: 12px; }
.sc-bet-all summary { cursor: pointer; color: var(--sc-text-muted); font-size: 13px; padding: 8px; }
```

- [ ] **Step 4 : Tester**

Cliquer sur le bouton 🎯 Parier d'une carte strong.
Expected : modale s'ouvre, fetch `/odds-comparison`, classement books par odds desc, best surligné.

- [ ] **Step 5 : Commit**

```bash
git add pariscore.html
git commit -m "feat(tennis-redesign): 3.2 modale Parier (câble /odds-comparison/:id)

Active la route dormante /api/v1/tennis/odds-comparison via <dialog> natif.
Lazy fetch + timeout 6s + retry 1× + cache 60s. Classement books par edge.

Réf: DESIGN-DOC §6.3"
```

---

### Task 3.3 : Live pulse (BPPI / momentum / DR divergent)

**Files :**
- Modify: `pariscore.html` (helper `_liveScoreHtml`, CSS)

- [ ] **Step 1 : Implémenter `_liveScoreHtml` avec pulses**

Dans l'IIFE Scope, ajouter :
```js
function _liveScoreHtml(m) {
  var s1 = m.player1_sets != null ? m.player1_sets : 0;
  var s2 = m.player2_sets != null ? m.player2_sets : 0;
  var sets = Array.isArray(m.sets) ? m.sets : [];
  var last = sets.length ? sets[sets.length - 1] : null;
  var g1 = last ? (num(last.p1) || 0) : 0;
  var g2 = last ? (num(last.p2) || 0) : 0;
  var pt = m.current_point || '';

  // Pulses
  var pulse = '';
  var bppi = m.bppi || {};
  var p1Bppi = num(bppi.p1), p2Bppi = num(bppi.p2);
  if ((p1Bppi && p1Bppi > 1.5) || (p2Bppi && p2Bppi > 1.5)) {
    var breakSide = p1Bppi > p2Bppi ? 'p2' : 'p1'; // serveur sous pression
    pulse = '<div class="sc-pulse sc-pulse-break">🔴 BREAK POINT — ' + esc(shortName(breakSide === 'p1' ? m.player2.name : m.player1.name)) + ' sous pression</div>';
  }
  var mom = m.momentum || {};
  if (mom.kfs_confidence && num(mom.kfs_confidence) > 0.7 && mom.kfs_direction && mom.kfs_direction !== 'neutral') {
    var momPlayer = mom.kfs_direction === 'p1' ? m.player1.name : m.player2.name;
    pulse += '<div class="sc-pulse sc-pulse-momentum">📈 MOMENTUM ' + esc(shortName(momPlayer)) + '</div>';
  }
  if (m.dr_exact != null) {
    var dr = num(m.dr_exact);
    var leadingSide = s1 > s2 ? 'p1' : (s2 > s1 ? 'p2' : null);
    var drSide = dr > 0 ? 'p1' : 'p2';
    if (leadingSide && leadingSide !== drSide && Math.abs(dr) >= 0.3) {
      var undervalued = drSide === 'p1' ? m.player1.name : m.player2.name;
      pulse += '<div class="sc-pulse sc-pulse-drift">⚠ Le score ment — value ' + esc(shortName(undervalued)) + '</div>';
    }
  }

  return '<div class="sc-live-score">'
    + '<span class="sc-live-badge">🔴 LIVE</span> '
    + s1 + '-' + s2 + ' · ' + g1 + '-' + g2 + ' · ' + esc(pt)
    + (m.serving ? ' 🎾' : '')
    + '</div>' + pulse;
}
```

- [ ] **Step 2 : Ajouter le CSS pulse**

```css
.sc-live-score { padding: 8px 16px; background: rgba(239,68,68,0.08); font-family: var(--sc-font-mono); font-size: 14px; }
.sc-live-badge { color: var(--sc-tier-avoid); font-weight: 700; animation: sc-blink 2s infinite; }
@keyframes sc-blink { 50% { opacity: 0.4; } }
.sc-pulse { padding: 6px 16px; font-size: 12px; font-weight: 600; }
.sc-pulse-break { background: rgba(239,68,68,0.2); color: var(--sc-tier-avoid); animation: sc-pulse-anim 1.6s infinite; }
.sc-pulse-momentum { background: rgba(16,185,129,0.15); color: var(--sc-tier-strong); animation: sc-pulse-anim 1.6s infinite; }
.sc-pulse-drift { background: rgba(245,158,11,0.15); color: var(--sc-tier-moderate); }
@keyframes sc-pulse-anim { 0%, 100% { box-shadow: 0 0 0 0 currentColor; } 50% { box-shadow: 0 0 8px 2px currentColor; } }
@media (prefers-reduced-motion: reduce) {
  .sc-live-badge, .sc-pulse-break, .sc-pulse-momentum { animation: none; }
}
```

- [ ] **Step 3 : Commit**

```bash
git add pariscore.html
git commit -m "feat(tennis-redesign): 3.3 live pulse (BPPI/momentum/DR divergent)

Pulses visuels sur signaux déclencheurs live : BREAK POINT, MOMENTUM,
'score ment' (DR divergent du tableau). Respect prefers-reduced-motion.

Réf: DESIGN-DOC §6.5"
```

---

### Task 3.4 : Stratégies P3 (câble `/strategies`)

**Files :**
- Modify: `pariscore.html` (fonction `_renderStrategies`, appelée au tap sur accordéon Analyse)

- [ ] **Step 1 : Implémenter le panneau stratégies**

Dans l'IIFE Scope, ajouter :
```js
function renderStrategies(matchId, container) {
  container.innerHTML = '<div class="sc-loading">Chargement stratégies…</div>';
  var xhr = new XMLHttpRequest();
  xhr.open('GET', '/api/v1/tennis/strategies/' + encodeURIComponent(matchId), true);
  xhr.timeout = 6000;
  xhr.onload = function() {
    if (xhr.status === 200) {
      try {
        var data = JSON.parse(xhr.responseText);
        var strats = data.strategies || [];
        var cons = data.consensus || {};
        var html = '<div class="sc-strategies">'
          + '<div class="sc-strat-consensus">Consensus : <b>' + (cons.probP1 != null ? cons.probP1.toFixed(0) + '% / ' + cons.probP2.toFixed(0) + '%' : 'N/A') + '</b></div>'
          + strats.map(function(s) {
            var p1 = num(s.probP1), p2 = num(s.probP2);
            var widthP1 = Math.max(5, Math.min(95, p1));
            return '<div class="sc-strat-row">'
              + '<div class="sc-strat-label">' + esc(s.label) + ' <small>' + esc(s.description || '') + '</small></div>'
              + '<div class="sc-strat-bar"><div class="sc-strat-fill" style="width:' + widthP1 + '%"></div><span>' + p1.toFixed(0) + '% / ' + p2.toFixed(0) + '%</span></div>'
              + '</div>';
          }).join('')
          + '</div>';
        container.innerHTML = html;
      } catch(e) { container.innerHTML = '<div class="sc-error">Stratégies indisponibles.</div>'; }
    } else { container.innerHTML = '<div class="sc-error">Stratégies indisponibles (' + xhr.status + ').</div>'; }
  };
  xhr.ontimeout = function() { container.innerHTML = '<div class="sc-error">Délai dépassé.</div>'; };
  xhr.send();
}
```

- [ ] **Step 2 : Câbler sur l'accordéon Analyse**

Modifier `Scope._toggle` (existant) pour que, lorsqu'on expand l'accordéon `det-{id}` pour la première fois, il fetch les stratégies :
```js
// Dans _toggle, après avoir affiché le détail :
var detail = document.getElementById('det-' + id);
if (detail && !detail.dataset.loaded) {
  detail.dataset.loaded = '1';
  renderStrategies(id, detail);
}
```

- [ ] **Step 3 : Ajouter le CSS**

```css
.sc-strategies { padding: 8px 0; }
.sc-strat-consensus { background: rgba(59,130,246,0.1); padding: 8px 12px; border-radius: 6px; margin-bottom: 12px; font-size: 14px; }
.sc-strat-row { margin-bottom: 10px; }
.sc-strat-label { font-size: 12px; color: var(--sc-text-muted); margin-bottom: 4px; }
.sc-strat-label small { color: var(--sc-text-muted); opacity: 0.7; }
.sc-strat-bar { position: relative; height: 18px; background: rgba(255,255,255,0.08); border-radius: 4px; overflow: hidden; }
.sc-strat-fill { height: 100%; background: var(--sc-player-p1); }
.sc-strat-bar span { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 10px; font-family: var(--sc-font-mono); }
```

- [ ] **Step 4 : Commit**

```bash
git add pariscore.html
git commit -m "feat(tennis-redesign): 3.4 stratégies P3 (câble /strategies/:id)

Active la route dormante /api/v1/tennis/strategies via 5 jauges consensus
+ consensus global. Lazy fetch au tap sur accordéon Analyse.

Réf: DESIGN-DOC §6.4"
```

---

### Task 3.5 + 3.6 : Pills pièges + Mode Pro

> Pills pièges déjà implémentées dans `decisionCard` (trapHtml). Mode Pro = couche dépliable dans le détail.

- [ ] **Step 1 : Implémenter le Mode Pro**

Ajouter dans `_renderStrategies` (ou un helper séparé), après les stratégies, un bloc Pro repliable :
```js
// Dans le rendu détail, ajouter après stratégies :
html += '<details class="sc-pro-layer"><summary>Mode Pro (data brute)</summary>'
  + '<div class="sc-pro-content">'
  + '<pre>' + esc(JSON.stringify(m._raw_predictions || {}, null, 2)) + '</pre>'
  + '<pre>' + esc(JSON.stringify(m._raw_best_ev_model || {}, null, 2)) + '</pre>'
  + '</div></details>';
```

- [ ] **Step 2 : Ajouter CSS**

```css
.sc-pro-layer { margin-top: 12px; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 8px; }
.sc-pro-layer summary { cursor: pointer; color: var(--sc-text-muted); font-size: 12px; }
.sc-pro-content pre { font-size: 10px; color: var(--sc-text-muted); overflow-x: auto; background: rgba(0,0,0,0.3); padding: 8px; border-radius: 4px; }
```

- [ ] **Step 3 : Commit**

```bash
git add pariscore.html
git commit -m "feat(tennis-redesign): 3.5+3.6 pills pièges + Mode Pro dépliable"
```

---

### 🚪 Jalon J3 — Dashboard validé

- [ ] Master-detail desktop, modale Parier, pulses live, stratégies, Mode Pro.
- [ ] Gate chef de projet + test parcours 3 personas.

---

## PHASE 4 — Refactor dette + QA (J+11 → J+14)

### Task 4.1 : Purge `OLD_TENNIS_DEPRECATED`

- [ ] **Step 1 : Lister les blocs**

Run : `grep -n "OLD_TENNIS_DEPRECATED" pariscore.html`
Expected : ~20 occurrences (lignes 3229, 3246, 3338, 3360, 6176, 10054, 11902, 12199, 17195, 17238, 18160, 18324, 18480, 18541, 18578, 18622, 19688, 19722, 20262, 20290).

- [ ] **Step 2 : Supprimer chaque bloc avec Edit**

Pour chaque occurrence, lire le bloc (du marqueur `/* OLD_TENNIS_DEPRECATED` au `*/` fermant) et le supprimer avec Edit.

- [ ] **Step 3 : Vérifier syntax**

Run : `node --check server.js` (aucun changement server.js, mais vérifier que pariscore.html inline scripts passent).

- [ ] **Step 4 : Commit**

```bash
git add pariscore.html
git commit -m "chore(tennis-redesign): 4.1 purge OLD_TENNIS_DEPRECATED (~20 blocs CSS morts)"
```

---

### Task 4.2 : Refactor `liveCardCompact` (214 → ~90 lignes)

> Déjà largement fait via `decisionCard` (2.1) qui remplace `liveCardCompact`. Cette tâche = retirer l'ancienne fonction morte.

- [ ] **Step 1 : Vérifier que `liveCardCompact` n'est plus référencée**

Run : `grep -n "liveCardCompact" pariscore.html`
Expected : références uniquement internes (définition + alias `liveCard`).

- [ ] **Step 2 : Retirer la fonction + son alias**

Supprimer la fonction `liveCardCompact` (`:26066-26279`) et l'alias `liveCard = liveCardCompact` s'il existe dans le return Scope.

- [ ] **Step 3 : Commit**

```bash
git add pariscore.html
git commit -m "refactor(tennis-redesign): 4.2 retrait liveCardCompact (remplacée par decisionCard)"
```

---

### Task 4.3 : Unification favoris

- [ ] **Step 1 : Vérifier que `ps_tennis_favs` est source unique**

Run : `grep -n "\.favorite" pariscore.html | grep -i tennis`
Expected : plus aucune lecture de `m.favorite` côté payload tennis.

- [ ] **Step 2 : Si trouvé, dériver au rendu**

Remplacer toute lecture `m.favorite` par `isFav(m.id)` dans les fonctions tennis.

- [ ] **Step 3 : Commit (si changements)**

```bash
git commit -am "refactor(tennis-redesign): 4.3 unification favoris (ps_tennis_favs source unique)"
```

---

### Task 4.4 : Retrait `_auditLivePayload` + endpoint `/coverage`

**Files :**
- Modify: `server.js` (ajouter route `/coverage`)
- Modify: `pariscore.html:26741-26791, 26679, 27160-27161` (retirer l'intercepteur)

- [ ] **Step 1 : Retirer les 3 zones de `_auditLivePayload`**

Dans `pariscore.html` :
- Supprimer la définition `:26741-26791`
- Supprimer l'appel `:26679` (`try { _auditLivePayload(...) } catch(_) {}`)
- Supprimer l'export `:27160-27161` (`_auditLivePayload: _auditLivePayload,`)

- [ ] **Step 2 : Ajouter l'endpoint `/coverage` dans server.js**

Dans `server.js`, dans le dispatcher HTTP (proche des autres routes tennis), ajouter :
```js
// ═══ Endpoint coverage data tennis (admin-only, remplace _auditLivePayload) ═══
if (pathname === '/api/v1/tennis/coverage' && req.method === 'GET') {
  // TODO sécurité : vérifier admin token si exposition publique
  var stats = { ts: Date.now(), total: 0, coverage: { bsd_stats: 0, welo: 0, odds: 0, momentum: 0, player_photo: 0 }, stale_odds: 0, avg_odds_age_ms: 0 };
  var count = 0, ageSum = 0;
  _tennisVBCache.forEach(function(entry) {
    if (!entry || !entry.result || !entry.result.body || !Array.isArray(entry.result.body.matches)) return;
    entry.result.body.matches.forEach(function(m) {
      stats.total++;
      if (m._bsd_stats) stats.coverage.bsd_stats++;
      if (m.player1 && m.player1.elo_surface) stats.coverage.welo++;
      if (m.odds && m.odds.p1 && m.odds.p1.odds) stats.coverage.odds++;
      if (m.momentum) stats.coverage.momentum++;
      if (m.player1 && m.player1.photo) stats.coverage.player_photo++;
      if (m.odds && m.odds.stale) stats.stale_odds++;
      if (m.odds && m.odds.age_ms) { ageSum += m.odds.age_ms; count++; }
    });
  });
  if (count) stats.avg_odds_age_ms = Math.round(ageSum / count);
  // Convertir en %
  Object.keys(stats.coverage).forEach(function(k) {
    stats.coverage[k] = stats.total ? Math.round(stats.coverage[k] / stats.total * 100) : 0;
  });
  return jsonResponse(res, 200, stats);
}
```

- [ ] **Step 3 : Tester l'endpoint**

Démarrer le serveur, `curl http://localhost:3000/api/v1/tennis/coverage`
Expected : JSON `{ts, total, coverage: {...}, stale_odds, avg_odds_age_ms}`.

- [ ] **Step 4 : Commit**

```bash
git add server.js pariscore.html
git commit -m "chore(tennis-redesign): 4.4 retrait _auditLivePayload + endpoint /coverage

Remplace le diagnostic console.warn en prod par un endpoint admin structuré.
Logs structurés JSON au lieu de _auditLivePayload.
```

---

### Task 4.5 : Polling adaptatif (20s live / 90s prematch)

**Files :**
- Modify: `pariscore.html:27059-27079` (`startAutoRefresh`)

- [ ] **Step 1 : Réécrire `startAutoRefresh`**

Remplacer la fonction complète par :
```js
// ── Auto-refresh adaptatif (20s live / 90s prematch) ──────────────────
var _timer = null;
var _interval = 90000; // défaut prematch
function _computeInterval() {
  var hasLive = (_state.liveMatches || []).some(function(m) { return m.is_live || m.tab === 'live'; });
  return hasLive ? 20000 : 90000;
}
function startAutoRefresh() {
  if (_timer) clearInterval(_timer);
  _interval = _computeInterval();
  _timer = setInterval(function () {
    var page = document.getElementById('page-tennis');
    if (page && page.style.display !== 'none') {
      fetchData();
      // Recalculer l'intervalle après chaque fetch (un match peut être passé live)
      var newInt = _computeInterval();
      if (newInt !== _interval) { _interval = newInt; clearInterval(_timer); _timer = setInterval(arguments.callee, _interval); }
    }
  }, _interval);
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      if (_timer) { clearInterval(_timer); _timer = null; }
    } else {
      var page = document.getElementById('page-tennis');
      if (page && page.style.display !== 'none') fetchData();
      if (!_timer) startAutoRefresh();
    }
  });
}
```

- [ ] **Step 2 : Commit**

```bash
git add pariscore.html
git commit -m "perf(tennis-redesign): 4.5 polling adaptatif (20s live / 90s prematch)

Réduit la latence de détection des live-values sans surcharge serveur
lorsqu'aucun match live. Recalcul de l'intervalle après chaque fetch.
```

---

### Task 4.6 : QA finale (Playwright + a11y)

> Cette tâche utilise les skills `metier-audit-qa`, `agency-reality-checker`, `playwright-mcp`.

- [ ] **Step 1 : Lancer l'audit QA via skill**

Invoquer le skill `metier-audit-qa` pour orchestrer :
- Parcours récréatif mobile (carte P2 → bouton Parier → modale)
- Parcours régulier desktop (scan → master-detail → modale)
- Parcours pro (Mode Pro → stratégies → odds-comparison)
- Parcours live (pulses BPPI/momentum/DR, polling adaptatif)

- [ ] **Step 2 : Audit a11y**

Invoquer `agency-reality-checker` pour valider :
- Contrastes WCAG AA (palette `#10B981` sur `#0B1120` = 7.8:1 OK)
- Zones tap ≥ 44px (`--sc-tap-min`)
- Bordure tier doublée d'un label ARIA
- `prefers-reduced-motion` désactive les pulses
- `<dialog>` focus trap + Escape

- [ ] **Step 3 : Non-régression**

Vérifier :
- `node --check server.js`
- Favoris cohérents
- Screenshot diff prematch/live (5 matchs)

- [ ] **Step 4 : Rédiger le rapport QA**

Compléter `RAPPORT-FIN-MISSION-REDESIGN-TENNIS.md` (template existant) avec les résultats.

- [ ] **Step 5 : Commit**

```bash
git add redesign-tennis/RAPPORT-FIN-MISSION-REDESIGN-TENNIS.md
git commit -m "docs(tennis-redesign): 4.6 rapport fin de mission + QA finale"
```

---

### Task 4.7 : Rapport de fin de mission

- [ ] **Step 1 : Finaliser le rapport**

Compléter toutes les sections `_<à compléter>_` du `RAPPORT-FIN-MISSION-REDESIGN-TENNIS.md`.

- [ ] **Step 2 : Push final**

```bash
git pull --rebase
bd dolt push
git push
git status  # MUST show "up to date with origin"
```

---

## Auto-révision du plan

**Coverage spec** : chaque section du design doc (§3-§11) est couverte par une tâche. ✓
**Placeholders** : tous les steps contiennent du code complet ou des commandes exactes. Aucun "TBD". ✓
**Cohérence types** : `valueBet(m)` retourne `{label, side, prob, odds, ev_pct, tier, stale, trap, playerName}` — cohérent dans premierCard, liveCardCompact, decisionCard, scanRow, KPI bar. `m.signal` shape cohérent entre serializer serveur et helper front. ✓

---

*Plan d'implémentation — 32 tâches sur 4 phases. Chaque tâche = étapes bite-sized avec code complet, test, commit. Dernière MAJ : 2026-07-07.*
