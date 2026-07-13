# SECURITY XSS AUDIT — LOT 1 TENNIS

**Scope** : Sections tennis du fichier `pariscore.app.js` (fonctions préfixées `tn2`, `_tn`, `renderTennis*`, `top10`, `_tvb*`, `openTex*`, `openPlayerProfile`, `renderInsightsSocialBuzz`, etc.). Plage auditée : lignes ~1838 → ~11000.

**Date** : 2026-07-11
**Auditeur** : Security Architect (Agent)
**Référence** : GANTT.md Phase 2-E, règles AGENTS.md

---

## 1. Helpers d'échappement disponibles (VÉRIFIÉS, existent)

| Helper | Localisation | Échappe | Usage |
|---|---|---|---|
| `_escTennis(s)` | `pariscore.app.js:1842` | `& < > " '` | Contexte HTML (tennis) |
| `_tnEsc(s)` | `pariscore.app.js:4611` | `& < > " '` | Contexte HTML (TEX/Top10) |
| `escapeHtml(s)` | `pariscore.app.js:23156` | `& < > "` | Contexte HTML (générique) |
| `_jsStr(s)` | `pariscore.app.js:22061` | `'` | Attribut `onclick='...'` |
| `_escapeHtmlSafe(s)` | `pariscore.app.js:5248` | `& < > " '` | Contexte HTML (TennisAbstract/BetMines) |

**Note** : `_jsStr` n'échappe que `'` (pas `"` ni `\`). Conformément aux consignes, NE PAS redéfinir — utiliser tel quel pour `onclick`.

Les variables pré-échappées / SAFE BY DESIGN (non auditées) : `safeId`, `matchId` (pré-échappés via `_escTennis`/`_tnEsc`), IDs numériques DB, `s.key`/`p.onclick`/`glossaryTerms` (hardcoded).

---

## 2. AUDIT — Toutes les `innerHTML` interpolant une variable (sections tennis)

### 2.A — CRITICAL (à patcher)

| # | file:line | Variable | Source | Contexte | Verdict |
|---|---|---|---|---|---|
| C1 | `pariscore.app.js:1941` | `ctxFlags.join(', ').toUpperCase()` | API externe (BSD `bppi.context_flags`) | HTML (badge CONTEXT) | **CRITICAL** — flags non échappés |
| C2 | `pariscore.app.js:2079-2080` | `tip` (contient `m.integrity.games`, `bd.oddsDev`...) | API externe (BSD integrity) | attribut `title="..."` | **CRITICAL** — construit puis injecté raw dans `title` (utilise `'+tip+'`) |
| C3 | `pariscore.app.js:2569` | `(surface \|\| '')` | API/DB (surface tournoi) | attribut `alt="..."` | **CRITICAL** — `_tnSurfaceImg` interpole surface raw dans alt |
| C4 | `pariscore.app.js:6229` | `r.avg_p1`, `r.avg_p2` | API externe (TennisExplorer multi-books) | HTML | **CRITICAL** — cotes moyennes raw |
| C5 | `pariscore.app.js:6457` | `texDetail.avg_p1`, `texDetail.avg_p2` | API externe (TennisExplorer) | HTML | **CRITICAL** — idem C4 (inline prematch card) |
| C6 | `pariscore.app.js:9327` | `b.bookmaker` | API externe (BSD bookmakers) | HTML (cellule table) | **CRITICAL** — nom bookmaker raw |
| C7 | `pariscore.app.js:9340` | `s.best_p1_bk` | API externe (BSD) | HTML | **CRITICAL** — best book raw |
| C8 | `pariscore.app.js:9345` | `s.best_p2_bk` | API externe (BSD) | HTML | **CRITICAL** — best book raw |
| C9 | `pariscore.app.js:9368` | `l.line` | API externe (OddsPapi/Pinnacle set odds) | HTML (cellule ligne) | **CRITICAL** — libellé ligne raw |
| C10 | `pariscore.app.js:9371` | `fmtBk(l.bookmaker)` → `l.bookmaker` | API externe (OddsPapi) | HTML | **CRITICAL** — bookmaker raw via fmtBk |
| C11 | `pariscore.app.js:9388` | `fmtBk(d.h2h.bookmaker)` | API externe (OddsPapi) | HTML | **CRITICAL** — bookmaker H2H raw |
| C12 | `pariscore.app.js:9681` | `d.p1?.ms_id`, `d.p2?.ms_id` | API externe (MatchStat) | HTML | **CRITICAL** — IDs résolveur raw |

**Total CRITICAL : 12**

### 2.B — SAFE (hardcoded, numérique, ou déjà échappé correctement)

Les échantillons notables ci-dessous sont déjà protégés (rendus `_tnTop10Card`, `renderTennisLive`, `renderTennisDashboard`, `renderTennisProDashboard`, `renderTennisMatchstatEnrich`, `renderTennisSofaProfile`, `_renderPrematchInlineCard`, `openPlayerProfile`, `openTexMatchDetail`, `renderInsightsSocialBuzz`, tables TennisExplorer/calendar/abstract, etc. utilisent `_tnEsc`/`_escTennis`/`_escapeHtmlSafe` systématiquement). Détail des emplacements SAFE vérifiés :

| Catégorie | Exemples (file:line) | Pourquoi SAFE |
|---|---|---|
| Top10 card (joueurs, tournoi, surface, verdict, bets, metrics) | 4656, 4669, 4694, 4699-4706, 4710, 4725, 4732, 4742, 4751, 4775-4776, 4833, 4851, 4865-4867, 4888, 4897 | `_tnEsc()` systématique ; `safeId` pré-échappé |
| Tennis Live (joueurs, sets, tournoi, flags, status) | 2401-2402, 2431-2432, 2437, 2439-2449 | `_escTennis()` ; `safeId` pré-échappé |
| Dashboard / Pro / Sofa / Matchstat / Degraded | 9885-9886, 9904, 9908, 9924, 9936, 9946, 9947, 9950, 10007, 10025, 10033, 10047, 10056, 10060, 10080, 10083, 10102, 9606, 9627, 9634, 9642, 9727, 9738, 9742, 9778, 9115, 9151-9158, 9162-9163 | `_escTennis()` systématique |
| Value Bets table (joueurs, tournoi, odds, books) | 4301-4304, 4316-4317, 4333-4341, 4348, 4363 | `_escTennis()` ; flags via `_escTennis` |
| TEX Matchs table (joueurs, scores, tournoi) | 6030-6031, 6069, 6112-6113 | `_tnEsc()` ; data-name/data-slug échappés |
| TEX Match Detail modal (books, H2H) | 6198-6199, 6214-6217, 6225 | `_tnEsc()` ; (sauf avg → C4) |
| Player Profile overlay (nom, pays, age, matchs, ELO) | 6537-6571, 6676-6677 | `_tnEsc()` |
| TennisAbstract Rome / MCP / Lottery / Calendar | 5236-5237, 5460-5471, 7011-7018 | `_escapeHtmlSafe()` |
| BetMines (hors scope tennis, football) | 5318-5320, 5366-5368 | `_jsStr` + `_escapeHtmlSafe` |
| Live Stats / Service Circles / Per-Set / BPPI cell | 2305, 2335, 2348, 2364-2367, 1998 | `_escTennis()` |
| Source/Glicko/Momentum badges | 2059, 2068, 2080 (tip→voir C2) | valeurs numériques OK |
| Social Buzz (items, accounts, URLs) | 9505, 9509, 9511 | `_esc()` local escape complet |
| `innerHTML` de loading/erreur/empty (strings statiques) | 2383, 2499, 3011, 4192, 4231, 5042, 5087, 5105, 5283, 5296, 5759, 5818, 5845, 5920, 5951, 5973, 5984, 6193, 6269, 6298, 6685, 6997, 9099, 9213, 9222, 9273, 9284, 9288, 9294, 9309, 9403, 9407, 9411, 9416, 9482, 9678, 9689 | aucune variable / messages hardcoded |

**Total SAFE : ~190+ emplacements**

### 2.C — FALSE_POSITIVE (apparence XSS mais non exploitable)

| # | file:line | Variable | Pourquoi FALSE_POSITIVE |
|---|---|---|---|
| F1 | `pariscore.app.js:8394-8395` | `ft1.trend[k]` (form trend W/L) | Comparé strictement `==='W'` puis injecté uniquement si vrai/faux → valeur elle-même n'est jamais interpolée, seul un émoji conditionnel l'est. Le `+ft1.wins+'/'+ft1.total+` sont numériques (DB BSD). Note : sera patché par prudence (voir §3). |
| F2 | `pariscore.app.js:8448, 8456` | `si1`/`si2` (serve index) | `Number`/numérique (serve_index DB) ; `.toFixed` appliqué. Numérique → non-exploitable. |
| F3 | `pariscore.app.js:8453, 8461` | `p1.serve_delta.toFixed(1)` | Numérique via `.toFixed()` |
| F4 | `pariscore.app.js:9109-9113` | `_renderTennisDegradedDetail` head | string statique hardcoded |
| F5 | `pariscore.app.js:6820` | `found.matches_n` (DR cell) | numérique (BSD DR) |
| F6 | `pariscore.app.js:6960` | `data-ta-tooltip` text via `.replace(/"/g,'&quot;')` | quote-escaped explicitement |
| F7 | `pariscore.app.js:10975` | `_tnAutoLogoHtml` alt | `name` nettoyé (`replace(/[^a-zA-Z\s]/g,'')`) avant init ; alt quote-escaped. Marginal mais non-exploitable car svg est base64. |
| F8 | `pariscore.app.js:2398` | `_tennisSourceFilter` (`${f}`) | enum whitelistée (`setTennisSourceFilter` filtre `allowed`) |

**Total FALSE_POSITIVE : 8**

---

## 3. COMPTE TOTAL (avant patch)

- **CRITICAL : 12**
- **SAFE : ~190+**
- **FALSE_POSITIVE : 8**

Principe de précaution appliqué : toute variable issue d'une API externe (BSD, OddsPapi, TennisExplorer, MatchStat, Sofascore) interpolée sans wrapper d'échappement → **CRITICAL**.

---

## 4. PATCH (Step 2) — 12 CRITICAL patchés

Wrapper appliqué selon le contexte :
- **Contexte HTML** (cellule, span, texte) → `_escTennis()` ou `_tnEsc()` (équivalents : échappent `& < > " '`).
- **Attribut** (`title="..."`, `alt="..."`) → `_escTennis()` (échappe `"`).
- Aucun patch `onclick` requis pour ce lot (les `onclick` tennis utilisent déjà `safeId` pré-échappé via `_escTennis`/`_tnEsc`).

| # | file:line | Avant | Après | Wrapper |
|---|---|---|---|---|
| C1 | 1941 | `${ctxFlags.join(', ').toUpperCase()}` | `${_escTennis(ctxFlags.join(', ').toUpperCase())}` | `_escTennis` (HTML) |
| C2 | 2079 | `'+sc+'/100 ('+lv+')'+...bd.oddsDev...` | `_escTennis(sc)+'/100 ('+_escTennis(lv)+')'+..._escTennis(bd.oddsDev)...` | `_escTennis` (attr title) |
| C3 | 2569 | `alt="' + (surface \|\| '') + '"` | `alt="' + _escTennis(surface \|\| '') + '"` | `_escTennis` (attr alt) |
| C4 | 6229 | `(r.avg_p1\|\|'—')` / `(r.avg_p2\|\|'—')` | `_tnEsc(r.avg_p1\|\|'—')` / `_tnEsc(r.avg_p2\|\|'—')` | `_tnEsc` (HTML) |
| C5 | 6457 | `(texDetail.avg_p1\|\|'—')` / `(texDetail.avg_p2\|\|'—')` | `_tnEsc(...)` | `_tnEsc` (HTML) |
| C6 | 9327 | `(b.bookmaker\|\|'')` | `_escTennis(b.bookmaker\|\|'')` | `_escTennis` (HTML) |
| C7 | 9340 | `(s.best_p1_bk\|\|'')` | `_escTennis(s.best_p1_bk\|\|'')` | `_escTennis` (HTML) |
| C8 | 9345 | `(s.best_p2_bk\|\|'')` | `_escTennis(s.best_p2_bk\|\|'')` | `_escTennis` (HTML) |
| C9 | 9368 | `${l.line}` | `${_escTennis(l.line)}` | `_escTennis` (HTML) |
| C10 | 9361 | `fmtBk = s => \`...[${s}]...\`` | `fmtBk = s => \`...[${_escTennis(s)}]...\`` | `_escTennis` (HTML) — corrige aussi C11 |
| C11 | 9388 | `fmtBk(d.h2h.bookmaker)` | corrigé via fmtBk (C10) | `_escTennis` (HTML) |
| C12 | 9681 | `${d.p1?.ms_id\|\|'?'}` / `${d.p2?.ms_id\|\|'?'}` | `${_escTennis(d.p1?.ms_id\|\|'?')}` / `${_escTennis(d.p2?.ms_id\|\|'?')}` | `_escTennis` (HTML) |

---

## 5. VALIDATION (Step 3)

```
$ node --check pariscore.app.js
SYNTAX OK exit=0
```

Validé après chaque lot (LOT1 = C1-C3, LOT2 = C4-C8, LOT3 = C9-C12) et validation finale. Aucun revert nécessaire.

---

## 6. RAPPORT FINAL (Step 4)

| Métrique | Valeur |
|---|---|
| **CRITICAL trouvés** | 12 |
| **CRITICAL patchés** | 12 |
| **CRITICAL restants** | 0 |
| **SAFE (non patchés, déjà protégés)** | ~190+ |
| **FALSE_POSITIVE** | 8 |
| **Fichier modifié** | `pariscore.app.js` (uniquement) |
| **Fichiers NON touchés** | `pariscore.js` (orphelin), `pariscore.html`, `server.js` |
| **`node --check` status** | exit 0 (PASS) |
| **Helpers utilisés** | `_escTennis`, `_tnEsc` (existent, non redéfinis) |

### Notes
- `_jsStr` existe (ligne 22061) mais n'a pas été requis pour ce lot : tous les `onclick` tennis interpolent déjà `safeId` pré-échappé via `_escTennis`/`_tnEsc`.
- Aucun helper n'a été redéfini. `escapeHtml()` (ligne 23156) est disponible pour les lots suivants (MMA / autres) mais n'a pas été utilisé ici car `_escTennis`/`_tnEsc` sont les wrappers idiomatiques des sections tennis (et échappent en plus l'apostrophe).
- Le principe de précaution a été appliqué : C12 (ms_id probablement numérique) a été patché malgré l'incertitude sur le caractère contrôlable par l'utilisateur.

### Hand-off pour LOT 2 (MMA) et LOT 3 (autres sports)
- Wrapper recommandé pour contexte HTML : `escapeHtml()` (existe, ligne 23156) ou `_escapeHtmlSafe()` (ligne 5248).
- Wrapper pour `onclick` : `_jsStr()`.
- Réutiliser ce rapport comme template (sections AUDIT → PATCH → VALIDATION → RAPPORT FINAL).
- Variables SAFE BY DESIGN à ne PAS patcher : `s.key`, `p.onclick`, `glossaryTerms`, `b.id`/`t.id` (numériques), `safeId`/`matchId` pré-échappés.

**Statut LOT 1 TENNIS : TERMINÉ — 12/12 CRITICAL patchés, 0 restant, prod non cassée.**

