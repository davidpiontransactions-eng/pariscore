# Audit QA — Liste des Matchs ParisCore

> **Date**: 01/08/2026 | **Scope**: Tennis match list (Flashscore + Card + Broadcast) | **Criticité**: 🔴=Blocker 🟡=Important ⚪=Edge
>  
> **Fichiers audités**: `flashscore-match-list.tsx`, `flashscore-tennis-list.tsx`, `tennis-tab-content.tsx`, `match-card.tsx`, `match-card-broadcast.tsx`, `player-block.tsx`, `match-card-header.tsx`, `tennis-sub-tabs.tsx`, `use-match-filter.ts`, `use-match-curation.ts`, `use-live-matches.ts`, `use-live-stream.ts`

---

## 🔴 CODE & LOGIQUE (10 issues)

### CRITICAL

| # | Fichier:Ligne | Description |
|---|--------------|-------------|
| C1 | `use-live-matches.ts:112-119` | **SSE stale data lock**. `sseActive` passe à `true` au premier flux SSE mais n'est jamais remis à `false`. Si la connexion SSE tombe (`connectionStatus="disconnected"`), le fallback polling (ligne 123: `if (sseActive) return`) est court-circuité définitivement. Résultat : données live gelées jusqu'au rechargement de la page. |
| C2 | `tennis-tab-content.tsx:266-277` | **Crash synthetic match**. `nameA.split(" ")` (ligne 266) sur `lm.playerA.name` sans null-guard. Si l'API BSD renvoie un live-match avec un nom `undefined`, tout le `useMemo` `matchesWithLive` crash → plus aucun match affiché. Même risque ligne 267 (nameB) et ligne 277 (`.toLowerCase().replace()` sur nameA). |
| C3 | `use-live-matches.ts:154` | **Crash setsDetail null**. `m.setsDetail.length` sans vérifier que `setsDetail` est un tableau. Si l'API BSD renvoie `setsDetail: null` pour un match (shape drift), TypeError → tout le polling silencieux → liveStates figé. Bug identique dans `use-live-stream.ts:55` (SSE path dupliqué). |
| C4 | `flashscore-tennis-list.tsx:74` | **Crash odds partiel**. `match.odds.decimalA.toFixed(2)` seulement gardé par `if (!match.odds)`. Si `match.odds` est `{}` (objet vide partiel), `.toFixed()` appelé sur `undefined` → crash. Un seul match corrompu bloque l'affichage complet via le `useMemo` leagues. |

### HIGH

| # | Fichier:Ligne | Description |
|---|--------------|-------------|
| C5 | `tennis-tab-content.tsx:659-660` | **Inline functions anti-memo**. `() => openDetail(match)` et `() => openBet(match)` dans `.map()` créent de nouvelles références à chaque render. Même avec React.memo sur `MatchCardBroadcast`, toutes les cartes re-render à chaque changement d'état parent. |
| C6 | `flashscore-tennis-list.tsx:130-134` | **O(n²) tournament sort**. `.find()` sur `matches` complet à l'intérieur du comparateur `.sort()`. Pour L leagues × M matchs → ~L×M opérations par tri. Avec 200 matchs / 30 tournois → 6000 comparaisons + regex. Pré-calculer `Map<leagueId, priority>` avant le sort. |
| C7 | `use-match-filter.ts:255` | **Set dependency unstable**. `favorites` (Set\<string\>) dans le tableau de dépendances `useMemo`. Si `useFavorites()` retourne une nouvelle référence Set à chaque render, le pipeline filter+sort+edge complet est ré-exécuté inutilement. |
| C8 | `use-match-filter.ts:160-171` | **NaN edge silencieux**. `o.impliedProbA` peut être `undefined`/`NaN` d'un `allOdds` malformé → `edge = NaN` → `NaN > maxEdge = false` → edge ignoré silencieusement. Le diagnostic `NODE_ENV` ligne 177 vérifie `probA` mais jamais `impliedProbA`. |

### MEDIUM

| # | Fichier:Ligne | Description |
|---|--------------|-------------|
| C9 | `tennis-tab-content.tsx:686` | **Object spread par render**. `betMatch ? { ...betMatch, surface: betMatch.stats.surface } : null` → nouvelle référence objet à chaque render → BetDialog re-render inutile. |
| C10 | `flashscore-match-list.tsx:320` | **Inline fallback anti-memo**. `onSearchChange ?? (() => {})` → nouvelle arrow function à chaque render quand `onSearchChange` est undefined. |

---

## 🟡 DESIGN UI & UX (11 issues)

### HIGH

| # | Fichier:Ligne | Description |
|---|--------------|-------------|
| U1 | `flashscore-match-list.tsx:216` | **Étoile favori à peine visible**. `text-[#B0B0B0]` sur `bg-card` (#2a2a2a). Ratio ~3.2:1 → échoue WCAG AA. |
| U2 | `flashscore-match-list.tsx:185` | **Touch target minuscule**. Boutons Star/BarChart2 ~28x28px. WCAG 2.5.5 exige 44×44px. |
| U3 | `tennis-tab-content.tsx:499-558` | **Options de tri dupliquées**. Même tableau inline 2x (BottomSheet + desktop). |
| U4 | `flashscore-match-list.tsx:191-198` | **Indicateur serveur absent**. Prop `server` existe mais jamais rendu visuellement. |

### MEDIUM

| # | Fichier:Ligne | Description |
|---|--------------|-------------|
| U5 | `match-card-broadcast.tsx:739` | **Truncature sans title**. Noms >20 car. sans tooltip HTML. |
| U6 | `flashscore-match-list.tsx:157` | **Nom tournoi tronqué sans tooltip**. "Internazionali BNL d'Italia" coupé net. |
| U7 | `tennis-tab-content.tsx:668` | **État vide non différencié**. Même message pour API down vs zéro match. |
| U8 | `flashscore-match-list.tsx:334` | **Skeleton non proportionnel**. Layout shift visible (CLS). |
| U9 | `match-card-header.tsx:69` | **Date semi-lisible**. `text-[#A0A0A0]` sur `bg-muted/30`. Ratio ~3.9:1 → fail WCAG AA. |
| U10 | `tennis-tab-content.tsx:499` | **Filtres+Tri non persistés**. Réinitialisation au changement sous-onglet. |
| U11 | `tennis-sub-tabs.tsx:82` | **Scroll horizontal caché mobile**. 4 onglets dépassent <400px sans `overflow-x-auto`. |

---

## ⚪ EDGE CASES & DÉTAILS (7 issues)

### HIGH

| # | Fichier:Ligne | Description |
|---|--------------|-------------|
| E1 | `flashscore-tennis-list.tsx:44-46` | **Crash scoreA manquant**. Garde `!liveState` mais pas `liveState.scoreA`. SSE avec `{isLive:true, scoreA:undefined}` → TypeError. |
| E2 | `flashscore-tennis-list.tsx:93` | **Collision clé tournoi**. `replace(/\s+/g, "_")` ignore ponctuation. "ITF W15" et "ITF-W15" → même clé `itf_w15`. |

### MEDIUM

| # | Fichier:Ligne | Description |
|---|--------------|-------------|
| E3 | `flashscore-match-list.tsx:303` | **Recherche sans debounce**. Recalcule à chaque frappe. Lag visible 200+ matchs. |
| E4 | `tennis-tab-content.tsx:248` | **Perte silencieuse données**. Retourne `[]` sans warning pour API shape drift. |
| E5 | `use-live-matches.ts:137` | **Tautologie connexion**. `"connected" : "connected"` — impossible distinguer 0 live de API down. |
| E6 | `flashscore-tennis-list.tsx:112` | **TimeDisplay vide live**. `isLive ? "" : formatTime(...)` → colonne vide → décalage. |
| E7 | `flashscore-match-list.tsx:307` | **Crash toLowerCase undefined**. Sans null-guard → useMemo silencieux. |

---

## 💡 RECOMMANDATIONS & INNOVATIONS

**R1 — Virtual scrolling**. `@tanstack/react-virtual` sur MatchRow (48px). DOM 200+→~15. Mémoire -85%.

**R2 — Filtre "Prochain match"**. "⏱️ Dans < 1h" — scheduledAt dans [now, now+60min].

**R3 — Pull-to-refresh + shimmer**. Animation ressort + shimmer gradient vs blocs gris.

**R4 — Indicateur serveur visuel**. Point pulsé vert/jaune près du nom au service.

**R5 — Persistance URL**. `?filter=live&sort=elo_desc&subtab=today` via useSearchParams.

---

## 📊 SYNTHÈSE

| Catégorie | CRITICAL | HIGH | MEDIUM |
|-----------|----------|------|--------|
| 🔴 Code & Logique | 4 | 4 | 2 |
| 🟡 Design UI & UX | — | 4 | 7 |
| ⚪ Edge Cases | — | 2 | 5 |
| **TOTAL** | **4** | **10** | **14** |

**Blocker**: C1 (SSE stale), C2 (crash nom), C3 (crash setsDetail), C4 (crash odds).

**P0**: C5 (anti-memo), C6 (O(n²) sort), U2 (touch targets), U4 (serveur).

---

*Généré par audit QA. Zéro modif code. Attente GO.*