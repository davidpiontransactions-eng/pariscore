# Design Doc — Redesign UI Tennis « Prematch & Live » · Hybride Dashboard-Carte

> **Projet** : PariScore
> **Date** : 2026-07-07
> **Auteur** : Chef de projet (agent ZCode) — conception collaborative (4 expertises + panel 1000 votants)
> **Statut** : 🟡 En revue utilisateur (gate avant plan d'implémentation)
> **Décision** : Hybride Dashboard-Carte
> **Réf. pilotage** : `GANTT-REDESIGN-TENNIS.md` · `PLAN-TACHES-REDESIGN-TENNIS.md` · `CR-LANCEMENT-REDESIGN-TENNIS.md`

---

## 1. Contexte et problème

### 1.1 Le problème utilisateur
Les parieurs de PariScore peinent à prendre des décisions rapides sur l'onglet Tennis Prematch & Live :
- La carte live (`liveCardCompact`, `pariscore.html:26066`) fait **214 lignes**, mélange calculs value-bet, HTML string, duels miroir — surcharge cognitive.
- La donnée backend est **extrêmement riche mais sous-exploitée** : WElo surface, PowerScore, serve/receive index, fatigue, momentum, DR, BPPI, set Over/Under.
- **2 routes backend sont dormantes** : `/tennis/strategies/:id` (bouton placeholder) et `/odds-comparison/:id`.
- **Aucun raccourci de pari** sur le tennis (contrairement au foot).
- Contrat backend instable : `mapMatch` compense (proba parfois `0.65` parfois `65`, `predictions.elo` number ou objet).

### 1.2 Le mandat (verrouillé en Phase 0)
- **Périmètre** : tout le sous-onglet Prematch & Live (cartes + filtres + recherche + KPI bar + header).
- **Device** : responsive équilibré.
- **Objectif #1** : signal fort, info minimale — « 1 coup d'œil = je sais quoi faire ».
- **Actions pari** : modale de comparaison multi-bookmaker (câble `/odds-comparison/:id`).

### 1.3 La décision (panel 1000 votants, 8 segments pondérés)
| Proposition | Votes | Verdict |
|---|---|---|
| P2 Carte Décision | 40,7 % | pluralité (grand public) |
| P3 Dashboard Trading | 34,8 % | consensus second (pros, 40 % du volume enjeu) |
| P1 Terminal | 24,5 % | data pur |

**Aucune majorité absolue** → décision hybride pour servir les 3 blocs d'électorat.

---

## 2. Vision et principes directeurs

### 2.1 La vision en une phrase
> **Une liste qui scanne vite, une carte qui parle tennis, une modale qui fait parier** — avec le signal EV% comme unique pilote, révélé progressivement sur 4 niveaux.

### 2.2 Principes directeurs (5)

1. **1 carte = 0 ou 1 action.** Le seul nombre qui doit sauter est l'EV% du meilleur pari. Si pas de value, la carte se replie visuellement (opacité, gris). 1 carte ne porte jamais 2 paris simultanément.
2. **Révélation progressive en 4 niveaux.** P1 verdict (liste, < 1 s) → P2 contexte (accordéon/tap) → P3 analyse profonde → P4 modale Parier + stratégies. Chaque niveau ajoute de l'info, n'en répète pas.
3. **Live respire, prematch est stable.** Le live pulse sur les signaux déclencheurs (BPPI, momentum, DR divergent) ; le prematch est dense et statique. Deux grammaires visuelles, un seul squelette de carte.
4. **Langage parieur, pas jargon data.** Le verdict s'affiche en mots (`VALUE +6% Djokovic @ 1.85`) — pas en métriques brutes (`ev_pct: 0.06`). La data brute vit dans le Mode Pro dépliable.
5. **Le contexte desktop = scan + focus en parallèle.** Le parieur desktop scanne la liste ET analyse un match sans rupture de contexte (master-detail). Le mobile reste sur carte pédagogique par défaut, bascule en liste au besoin.

---

## 3. Architecture du redesign

### 3.1 Le squelette de layout (responsive)

**Règle de bascule** : breakpoint à **1024 px**.

#### Desktop (≥ 1024 px) — Master-detail P3
```
┌── KPI bar sticky (Edge moyen · Nb VB strong · Live actifs · ROI Kelly) ──────────────┐
├── Header sous-onglet ── Prematch │ Live │ Value Bets │ Analytics ─ 🔍 ⬇Edge ──── 🎾 ┤
├──────────────────────────┬──────────────────────────────────────────────────────────┤
│ LISTE COMPACTE (40%)     │ PANNEAU DÉTAIL = CARTE P2 (60%)                          │
│ ▌ +6% Djokovic 1.85 13h⚠│ ┌──────────────────────────────────────────────────────┐ │
│ ▌ +3% Alcaraz 2.10 21h   │ │╔ VALUE +6% — Djokovic 1.85 ═════════════════════╗ ★│ │
│ ▒ NEUTRAL Rune 2.00      │ │ 🟢 "Favori net — value cote bloquée"              │ │
│ 🔴 LIVE Sinner 6-4 4-3 🎾│ │ 62% ▓▓▓▓▓▓▓▓░░ vs 54% marché (+8 pts)            │ │
│   BREAK — pulse          │ │ 🎾 Hard · Doha · ATP500 · Bo3 · 13h00            │ │
│ ▌ +5% Swiatek 1.60 · RG  │ │ 💡 Sinner fatigué (12 matchs / 14j)              │ │
│ ▒ ...                    │ │ [Over 21.5j +3%] [H -4.5] [Set 2-0 +4%]          │ │
│                          │ │ ▶ Analyse détaillée   ▶ Mode Pro                 │ │
│ 12+ matchs visibles      │ │ ╔═══[🎯 PARIER]═══ Unibet best 1.85 ═════════════╗│ │
│ Liste jamais perdue      │ │                          ⚠ trap_bet · ⚠ drift 8'│ │
└──────────────────────────┴─└──────────────────────────────────────────────────────┘ ┘
```

#### Mobile (< 1024 px) — Carte P2 par défaut + toggle Scan
```
┌── KPI bar (compacte) ────────────────────────────────────────────┐
├── Prematch │ Live │ ... ─ [📋 Carte] [≡ Scan] ─ 🔍 ──────────────┤
│                                                                     │
│  Vue par défaut = Carte P2 (pédagogique) :                         │
│  ┌──────────────────────────────────┐                              │
│  │▌╔══ VALUE +6% ══╗             ★ │                              │
│  │ 🟢 Djokovic 1.85              ⚠ │                              │
│  │ "Favori net — value"             │                              │
│  │ 62% ▓▓▓▓▓▓▓▓░░ vs 54%            │                              │
│  │ 🎾 Hard·Doha·13h                 │                              │
│  │ 💡 Sinner fatigué (12m)          │                              │
│  │ [Over 21.5j+3%][H-4.5]           │                              │
│  │ ▶Analyse  ▶Pro                   │                              │
│  │ ╔═══[🎯 PARIER]═══╗              │                              │
│  └──────────────────────────────────┘                              │
│                                                                     │
│  Toggle [≡ Scan] = Vue ligne P1 (dense) :                          │
│  ┌──────────────────────────────────┐                              │
│  │▌ +6% Djokovic 1.85  13:00         │                              │
│  │  vs Sinner #4 · Doha·Hard         │                              │
│  ├──────────────────────────────────┤                              │
│  │🔴 LIVE Sinner 6-4 4-3 🎾 ← pulse  │                              │
│  └──────────────────────────────────┘                              │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.2 Les composants (vue d'ensemble)

| Composant | Niveau | Rôle | Origine |
|---|---|---|---|
| `scanRow(m)` | P1 (liste) | Ligne dense verdict-list, EV% énorme, bordure tier | Nouveau |
| `decisionCard(m)` | P1 mobile + P2 desktop | Carte verticale pédagogique 3 zones | Refonte `premierCard`/`liveCard` |
| `signalBadge` / `.sc-tier-*` | P1 | Bordure + pastille + couleur | Refonte `signalBadge` existant |
| `marketChips(m)` | P2 | Chips Over/Under, Handicap, at_least_set | Nouveau |
| `kpiBarSignal` | Header | 4 KPIs signal | Refonte `tn2-kpi-*` |
| `masterDetail` layout | Desktop | Split 40/60 liste+détail | Nouveau |
| `betModal(matchId)` | P4 | Modale comparaison books | Nouveau (câble `/odds-comparison`) |
| `strategiesPanel(m)` | P3 | 5 jauges consensus | Nouveau (câble `/strategies`) |
| `livePulse` overlays | P1 live | Pulses BPPI/momentum/DR | Nouveau |
| `trapPills` | P1 | Pills ⚠ pièges | Nouveau |
| `proLayer(m)` | P4 | Stack data brute dépliable | Nouveau |
| `valueBet(m)` | Helper | Logique value-bet unifiée | Refonte (4 fns → 1) |
| `Scope.store` | Foundation | State partagé master-detail | Nouveau |
| `<dialog>` natif | Foundation | Modale a11y | Nouveau |

---

## 4. Le signal — système détaillé

### 4.1 Le signal pilote : EV%

**Choix** : `best_ev_model.ev_pct` (rendement attendu par euro). Pas l'Edge (aveugle à la cote), pas le Kelly (sizing, volatil).

**Pourquoi** : EV% fusionne écart de proba ET niveau de cote en un seul chiffre économiquement juste. 5 % d'edge à 1.05 ≠ 5 % à 5.0.

### 4.2 Le seuillage et le cap de confiance

| Tier | EV% | Couleur | Hex | Sémantique |
|---|---|---|---|---|
| **Strong** | ≥ 5 % | vert | `#10B981` | Value claire, parier |
| **Moderate** | 2-5 % | ambre | `#F59E0B` | Value modérée, à valider |
| **Neutral** | < 2 % | gris | `#64748B` | Pas de value, replié |
| **Avoid** | trap_bet / drift | rouge | `#EF4444` | Piège, ne pas parier |

**Cap de confiance** : `tier_affiché = min(tier_EV, tier_confiance)`. Un EV de 12 % en `low` confidence → plafonné à Moderate + ⚠. Évite les faux signaux Challenger/ITF.

### 4.3 La grammaire du signal visuel

- **Bordure gauche 4 px** sur toute carte/ligne, couleur = tier (porte l'info au scan).
- **Pastille signal** 20 px en haut-droite (icône ▲ strong, ● moderate, ▼ avoid) — jamais en milieu de carte.
- **EV% typo mono 28 px bold**, couleur tier, à gauche du bandeau décision. La cote en 16 px gris à côté.
- **Live pulsant** : bordure strong + `box-shadow` animé (`pulse 1.6s`) + pastille "LIVE" rouge clignotant 2 s. Serveur 🎾 garde son pulse.
- **Pills pièges ⚠** en coin (trap_bet, drift > 10 min, fatigue > 12 matchs/14j, surface Elo instable) — **jamais bandeau rouge** qui tuerait le signal.
- **Accessibilité** (WCAG 1.4.1) : la bordure tier est **doublée d'un label texte** (Strong/Moderate/Neutral/Avoid) — la couleur n'est jamais le seul porteur d'info.

### 4.4 Top 3 signaux de betting à valoriser en UI

| Signal | Métrique combinée | Seuil | Affichage |
|---|---|---|---|
| **Fatigue + cote bloquée** | `gamesLast14Days > 12` ET `age_30` ET EV% ≥ 4 sur joueur frais | `gamesLast14Days > 12` | Badge « Fatigue » + carte surligne le frais |
| **Spécialiste surface** | `|gap WElo surface| > 100` ET `surf_rank_total ≥ 20` (échantillon surface) ET EV% ≥ 4 | `surf_rank_total ≥ 20` | Badge « Surface » directionnel |
| **Value live (BPPI/DR)** | `|liveEdge| ≥ 5%` OU ratio BPPI > 1.5 sur joueur mené OU `dr_series` divergent | `bppi > 1.5` | Carte live pulsante « Live value » + flèche |

---

## 5. Hiérarchie de l'information — 4 niveaux

### 5.1 Niveau P1 — Verdict (< 1 seconde, sans déplier)

**Prematch (carte P2 / ligne P1)** :
- Badge signal + bordure tier
- Noms courts des 2 joueurs + 1 cote maître (celle du top value bet, pas 2 cotes symétriques)
- **EV% en gros** (28 px mono)
- Horaire
- ★ favori

**Live (carte P2 / ligne P1)** :
- Badge signal + bordure tier (pulse si strong + live)
- Score (sets + games + point actuel + serveur 🎾)
- Bandeau value bet (EV% live)
- Pastille "LIVE" clignotante + pulse BPPI/momentum/DR si déclencheur

**P1 — Ce qui SORT** (vs aujourd'hui) : jauge demi-cercle P1% (→P2), double cote symétrique (→P3), photos P1 live (→avatars 28 px initiales), chart momentum (→P2), chips DR/O-U (→P2).

**P1 — Ce qui ENTRE** : tier par bordure gauche 4 px plutôt que badge texte, EV% comme chiffre pilote unique, pills pièges en coin.

### 5.2 Niveau P2 — Contexte (au tap / accordéon 1er niveau)

Métriques secondaires (le contexte minimal pour comprendre le signal sans surcharger) :
1. **Proba modèle vs cote implicite** (ex. « 62 % vs 54 % ») — *dé-blackboxe l'origine de l'EV*.
2. **Gap WElo surface** — moteur structurel de l'edge prematch.
3. **Fatigue (`gamesLast14Days`) + `age_30`** — value courte durée.
4. **(Live) BPPI + `momentum_shift`** — déclencheur de re-bet.
5. **Chips marchés** (Over/Under jeux, Handicap, at_least_one_set) si value ≥ 3 %.
6. **Barre proba modèle vs cote** (1 barre horizontale bicolore, remplace la jauge ronde).
7. **Kelly%** (en demi-Kelly, réservé au P2).

**P2 — Ce qui SORT** : duels miroir 6-metrics `_duel` (→P3), radar 6-metrics (→supprimé, vanity viz), sparkline Elo trend (→P4), momentum chart détaillé (→P3 live).

### 5.3 Niveau P3 — Analyse profonde (accordéon 2e niveau / panneau détail)

- Duels live miroir (serve_index gap principalement, les 5 autres relégués)
- Scouting report (`scoutProfile`)
- H2H (`h2hBlock`)
- Top 3 bets (`topBets`)
- DR chart évolution (`drChart`) — **devient onglet interne P3** (plus popup)
- **Stratégies consensus** (5 jauges : momentum/surface/form/fatigue/confidence) — câble `/strategies/:id`

### 5.4 Niveau P4 — Modale Parier + Mode Pro

**Modale Parier** (câble `/odds-comparison/:matchId`) :
- Classement books par edge décroissant, book #1 surligné
- Cote best vs cote juste côte à côte + écart en %
- Mise conseillée Kelly (¼ ou ½) optionnelle
- 1 ligne verdict (« Best : Unibet 1.85 — value +6 % »), bouton « Parier ici » deeplink
- Books tiers repliables, pas de dump theoddsapi complet par défaut

**Mode Pro dépliable** (couches P4) :
- Proba brute + méthode (WElo/blended) + intervalles de confiance
- `set_probs`, `at_least_one_set`, `most_aces`
- DR per set, BPPI live, WOM Betfair, dropping odds
- Caché par défaut, bouton « Pro » pour déployer

---

## 6. Spécifications par composant

### 6.1 `decisionCard(m)` — Carte P2

**Structure HTML** (3 zones) :
```html
<article class="sc-decision-card sc-tier-{strong|moderate|neutral|avoid}" data-match-id="...">
  <header class="sc-decision-head">
    <span class="sc-signal-badge" aria-label="Verdict: {tier}">{icon}</span>
    <div class="sc-ev-pct">{ev_pct}%</div>
    <div class="sc-verdict">VALUE — {player} {odds}</div>
    <button class="sc-fav" aria-label="Favori">{star}</button>
    <span class="sc-trap-pill" hidden>⚠ {trap_label}</span>
  </header>
  <div class="sc-decision-context">
    <div class="sc-proba-bar">{proba_bar modèle vs marché}</div>
    <div class="sc-meta">🎾 {surface} · {tournament} · {round} · Bo{bestOf} · {time}</div>
    <div class="sc-insight">💡 {insight contextuel}</div>
    <div class="sc-market-chips">{chips si value ≥ 3%}</div>
    <button class="sc-expand" aria-expanded="false" aria-controls="det-{id}">▶ Analyse</button>
  </div>
  <footer class="sc-decision-action">
    <button class="sc-bet-btn" onclick="Scope.betModal('{id}')">🎯 Parier</button>
  </footer>
  <div class="sc-detail" id="det-{id}" hidden>{lazy P3 content}</div>
</article>
```

**Règles** :
- Hauteur P1 (header + action) ≤ 128 px mobile.
- Zones tap ≥ 44 px (bouton Parier, favori, expand).
- `aria-expanded` / `aria-controls` sur l'accordéon.
- Le contenu P3 est **lazy-loadé** au premier tap (pas au rendu initial).

### 6.2 `scanRow(m)` — Ligne P1

**Structure** :
```html
<article class="sc-scan-row sc-tier-{tier}" data-match-id="...">
  <div class="sc-scan-ev">{ev_pct}%</div>
  <div class="sc-scan-main">
    <div class="sc-scan-players">{player_short} · {vs} · {player_short}</div>
    <div class="sc-scan-meta">{tournament} · {surface} · {time}</div>
  </div>
  <div class="sc-scan-odds">{odds_master}</div>
  <div class="sc-scan-live" hidden>🔴 {score_compact} 🎾</div>
</article>
```

**Règles** :
- Hauteur ~80 px.
- Tri par défaut = EV% décroissant.
- Tap = expand inline (P2 contexte).
- Bordure tier 4 px + label ARIA `aria-label="Verdict {tier}"` (WCAG 1.4.1).

### 6.3 `betModal(matchId)` — Modale Parier

**Comportement** :
- Ouvre via `<dialog>` natif (focus trap, Escape, scroll-lock, restore-focus).
- **Lazy fetch** `/api/v1/tennis/odds-comparison/{matchId}` au tap.
- Timeout 6 s + retry 1× après 3 s.
- Si 404 : message « Préparation des cotes en cours, réessayez dans 30 s ».
- **Prefetch** des top-5 cartes (par EV% desc) après 1ère paint, cache front TTL 60 s.

**Contenu** :
- Ligne verdict : « Best : {book} {odds} — value +{edge}% ».
- Top-3 books par edge, surligné book #1.
- Tableau repliable des books tiers.
- Mise Kelly optionnelle (toggle ¼ / ½ / pleine).
- Bouton « Parier ici » → deeplink bookmaker.

### 6.4 `masterDetail` — Layout desktop

**Comportement** :
- Liste à gauche (40 %), panneau détail à droite (60 %).
- Sélection d'un match (click sur `scanRow` ou `decisionCard`) → `Scope.store.setSelected(id)` → panneau droit se met à jour.
- Le match sélectionné reste visible dans la liste (scroll-into-view si besoin).
- En dessous de 1024 px : bascule auto vers carte P2 simple (pas de master-detail mobile).

### 6.5 `livePulse` overlays

**Déclencheurs** (3 signaux qui pulse) :
1. **BPPI critique** : `bppi.p1/p2` > seuil → pulse rouge « BREAK POINT — value Over {n}.5 jeux ».
2. **Momentum shift** : `momentum.kfs_confidence` forte + retournement → pulse « MOMENTUM {player} ».
3. **DR divergent** : `dr_exact` ≥ +0.3 sur joueur mené au score → pulse « Le score ment — value {player} ».

**Règles** :
- `@media (prefers-reduced-motion: reduce)` désactive les pulses (WCAG 2.3.3).
- Pulse = `box-shadow` animé + pastille, pas de flash plein écran.

---

## 7. Contrat de données

### 7.1 Serializer serveur `_serializeTennisCard(m)`

Injecté dans `/api/v1/tennis/value-bets` et `/api/v1/tennis/live`. Normalise AVANT envoi → `mapMatch` front ne fait que transmettre.

**Contrat canonique** (extrait) :
```jsonc
{
  "id": "string",
  "tab": "prematch|live",
  "tour": "string", "tournament": "string", "surface": "string",
  "round": "string", "bestOf": 3, "commence_time": "ISO", "status": "string",
  "player1": {
    "id": "string", "name": "string", "flag": "string", "photo": "url",
    "rank": 12, "elo_surface": 1842.5, "l5_pts": 4, "powerscore": 0.71
  },
  "player2": { /* même shape */ },
  "odds": {
    "p1": { "odds": 1.85, "book": "Unibet" },
    "p2": { "odds": 2.10, "book": "Unibet" },
    "stale": false, "age_ms": 12000
  },
  "fair": { "p1": 0.62, "p2": 0.38, "margin": 0.04, "method": "shin" },
  "signal": {
    "label": "VALUE +6%", "side": "p1", "prob": 0.62,
    "ev_pct": 6.2, "confidence": "high", "stale": false
  },
  "markets": {  // pour les chips P2
    "set_ou": { "o75": 0.58, "o85": 0.42, "u125": 0.31 },
    "at_least_one_set": { "p1": 0.15, "p2": 0.22 },
    "handicap_games": { "line": -4.5, "value_pct": 3.1 }
  },
  "live": {  // présent si tab=live
    "score": { "sets": [6,4], "games": [4,3], "point": "30-15", "serving": "p1" },
    "bppi": { "p1": 0.8, "p2": 1.6 },
    "momentum": { "kfs_direction": "p2", "kfs_confidence": 0.72 },
    "dr_exact": 0.34, "dr_series": [...]
  },
  "traps": ["trap_bet", "drift", "fatigue", "surface_elo_low"]  // pills ⚠
}
```

### 7.2 Règles de normalisation côté serveur

- `prob` **toujours 0-1** (×100 → `prob_pct` distinct si besoin).
- `predictions` **toujours objet** `{elo: {p1, p2}, blended: {p1, p2}}` (jamais number nu).
- `best_ev_model` **toujours présent** (calculé si cotes + fairs dispo) ou **`null`**.
- Valeurs manquantes = **`null`**, jamais `undefined` ou `0` (pour distinguer "absent" de "nul").
- `odds.stale` = `age_ms > 600000` (10 min) pour live, `> 14400000` (4 h) pour prematch.
- Si ni BSD ni WElo surface → `signal = null` + `traps.push("data_insufficient")` → P1 affiche « données insuffisantes » au lieu d'un faux signal.

### 7.3 Helper `valueBet(m)`

Source unique de vérité pour le calcul du signal (remplace la logique dupliquée dans `premierCard`, `liveCardCompact`, `topBets`, `prematchCard`).

```js
Scope.valueBet = function(m) {
  if (!m.signal) return null;
  const ev = m.signal.ev_pct;
  const tierEV = ev >= 5 ? 'strong' : ev >= 2 ? 'moderate' : 'neutral';
  const tierConf = { high: 'strong', medium: 'moderate', low: 'neutral' }[m.signal.confidence] || 'neutral';
  // min(tier_EV, tier_confiance) : on prend le tier le plus pessimiste (ordre avoid < neutral < moderate < strong)
  const RANK = { avoid: 0, neutral: 1, moderate: 2, strong: 3 };
  const tier = RANK[tierEV] <= RANK[tierConf] ? tierEV : tierConf;
  // trap_bet force le tier à 'avoid'
  const finalTier = (m.traps && m.traps.includes('trap_bet')) ? 'avoid' : tier;
  return {
    label: m.signal.label,
    side: m.signal.side,
    prob: m.signal.prob,
    ev_pct: ev,
    tier: finalTier,
    stale: m.signal.stale,
    trap: m.traps && m.traps.length > 0
  };
};
```

---

## 8. Fondations techniques

### 8.1 Mini-store observable (`Scope.store`)

Pattern subscribe/emit minimaliste (vanilla JS, zéro dépendance) :
```js
Scope.store = (function() {
  let state = { selectedMatchId: null, viewMode: 'card', filters: {} };
  const subs = new Set();
  return {
    get: () => state,
    set: (patch) => { state = { ...state, ...patch }; subs.forEach(fn => fn(state)); },
    subscribe: (fn) => { subs.add(fn); return () => subs.delete(fn); }
  };
})();
```
- Le panneau détail desktop s'abonne à `selectedMatchId`.
- Le toggle scan s'abonne à `viewMode`.

### 8.2 Composant `<dialog>` natif

HTML5 `<dialog>` avec :
- `showModal()` / `close()`.
- Focus trap natif (premier/dernier élément focusable).
- Escape pour fermer.
- `::backdrop` pour l'overlay.
- Restore-focus sur l'élément déclencheur.

### 8.3 Persistance préférences

`ps_tennis_prefs = { sort, surfaceFilter, tournamentFilter, viewMode, preferredBookmaker, tab }`. Pas de persistance de la liste de matchs (serveur souverain).

### 8.4 Polling adaptatif

- `setInterval` **20 s** si ≥ 1 match `isLive`, **90 s** sinon.
- Pausé quand `document.hidden` ou `#page-tennis` masqué (déjà en place).
- ETag sur `/live` pour court-circuiter le JSON si inchangé (304).

---

## 9. Considérations de design

### 9.1 Design tokens

```css
:root {
  /* Palette monochrome + accents sémantiques */
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
  --sc-font-mono: 'JetBrains Mono', 'Fira Code', monospace;
  --sc-font-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --sc-ev-size: 28px;

  /* Layout */
  --sc-card-radius: 12px;
  --sc-tap-min: 44px;
  --sc-tier-border: 4px;
}
```

### 9.2 Responsive

| Breakpoint | Layout | Comportement |
|---|---|---|
| < 640 px (mobile étroit) | 1 colonne carte P2 par défaut | Toggle scan → lignes P1 |
| 640-1023 px (tablette) | 1-2 colonnes carte P2 | Toggle scan disponible |
| ≥ 1024 px (desktop) | Master-detail 40/60 | Liste persistante + panneau détail |
| ≥ 1440 px (large) | Master-detail, liste plus large | Jusqu'à 4 colonnes visibles dans la liste |

### 9.3 Accessibilité (WCAG)

| Critère | Niveau | Implémentation |
|---|---|---|
| Contrastes | AA | Palette testée (vert `#10B981` sur `#0B1120` = 7,8:1) |
| Zones tap | AA | `--sc-tap-min: 44px` sur tout élément cliquable |
| Couleur non seule porteuse d'info | A | Bordure tier doublée d'un label ARIA + pastille icône |
| Accordéons | A | `aria-expanded` / `aria-controls` natifs |
| Modale | A | `<dialog>` natif + focus trap + Escape |
| Mouvement | AA | `prefers-reduced-motion` désactive pulses |
| Lecteur d'écran liste dense | A | `role="list"` / `role="listitem"` + `aria-label` |

---

## 10. Nettoyage de dette technique

| Dette | Action | Tâche Gantt |
|---|---|---|
| Logique value-bet dupliquée 4× | Helper `valueBet(m)` unifié | 1.3 |
| `liveCardCompact` 214 lignes | Extraction lazy P3, → ~90 lignes | 4.2 |
| 2 routes dormantes (`/strategies`, `/odds-comparison`) | Câblage (P3 + modale Parier) | 3.2, 3.4 |
| CSS mort `OLD_TENNIS_DEPRECATED` (~20 blocs) | Purge | 4.1 |
| Favoris à double entrée (`ps_tennis_favs` vs `.favorite`) | Unification | 4.3 |
| `_auditLivePayload` diagnostic en prod | Retrait + endpoint `/coverage` | 4.4 |
| Contrat backend instable | Serializer serveur | 1.1, 1.2 |
| Bouton "Stratégies" placeholder | Câblage réel | 3.4 |

**⚠️ Note importante** : `.tn2-*` est **ACTIF** (KPI bar, modales, `tn2RenderLiveCards`) — il n'est PAS purgeable. Seul `OLD_TENNIS_DEPRECATED` est mort.

---

## 11. Edge cases et gestion d'erreur

| Cas | Comportement |
|---|---|
| Match sans cotes (`odds = null`) | Pas d'EV%, carte "Neutral", pas de modale Parier |
| Match sans BSD ni WElo surface | `signal = null`, P1 affiche « données insuffisantes » |
| Route `/odds-comparison` 404/timeout | Message « Préparation des cotes », retry 1× après 3 s |
| Cote stale (`age_ms > 10 min` live) | EV% grisé + pill ⚠ « cotes anciennes » |
| `trap_bet = true` | Tier forcé à `avoid` + pill ⚠ « cote piégée » |
| 0 match prematch | Fallback top10 (déjà en place `pariscore.html:27110-27138`) |
| > 50 matchs (Slams) | Toggle scan P1 + liste P3 desktop |
| `prefers-reduced-motion` | Pulses désactivés |
| Modale Parier sans bookmaker préféré | Sélection auto du best book par edge |

---

## 12. Personas et parcours

### Persona 1 — Récréatif mobile (300 votants, 30 %)
**Parcours** : ouvre prematch → voit carte P2 → lit verdict en mots → tap bouton Parier → modale.
**Servi par** : carte P2 par défaut mobile, verdict pédagogique, bouton proéminent.

### Persona 2 — Régulier sérieux desktop (200 votants, 20 %)
**Parcours** : scan liste → sélectionne match → panneau détail (P2 + P3) → modale Parier.
**Servi par** : master-detail desktop, jauges facteurs, best book intégré.

### Persona 3 — Pro / semi-pro (150 votants, 15 %, 40 % volume)
**Parcours** : scan liste dense → drill-in → Mode Pro dépliable → stratégies → odds-comparison.
**Servi par** : master-detail, Mode Pro, stratégies consensus, densité info.

### Persona 4 — Fan de tennis (150 votants, 15 %)
**Parcours** : suit son tournoi → carte avec photos/contexte → parie pour le fun.
**Servi par** : carte P2 avec photos, drapeaux, contexte surface/tournoi/Bo.

### Persona 5 — Curieux non-parieur (50 votants, 5 %)
**Parcours** : consulte pendant RG → verdict en mots → referme satisfait.
**Servi par** : carte P2 lisible sans jargon.

---

## 13. Critères de succès

| Critère | Cible | Mesure |
|---|---|---|
| Décision en 1 coup d'œil | < 1 s pour identifier le signal | Test utilisateurs / heatmaps |
| Signal EV% pilote visible P1 | 100 % cartes strong | Audit code |
| Routes dormantes câblées | 2/2 (`/strategies`, `/odds-comparison`) | Logs fetch |
| `liveCardCompact` réduit | 214 → ~90 lignes | Diff code |
| CSS mort purgé | ~20 blocs `OLD_TENNIS_DEPRECATED` supprimés | Diff CSS |
| Bugs bloquants QA finale | 0 | Rapport QA |
| Régressions visuelles | 0 | Screenshot diff |
| Contrastes WCAG AA | 100 % palette | Audit a11y |
| Zones tap ≥ 44 px | 100 % éléments cliquables | Audit a11y |

---

## 14. Hors périmètre (YAGNI)

Les éléments suivants sont **explicitement exclus** du redesign actuel :
- ❌ Redesign des sous-onglets Value Bets et Analytics (backlog post-livraison).
- ❌ SSE/WebSocket pour le live (ROI faible en vanilla Node, polling adaptatif suffisant).
- ❌ Endpoint unifié `/tennis/cards` (les routes `/value-bets` + `/live` restent séparées, serializer commun).
- ❌ Purge de `.tn2-*` (ACTIF, nécessaire au KPI bar et modales).
- ❌ Refactoring big-bang des 3 systèmes de rendu (migration progressive par wrappers).
- ❌ Nouveaux marchés (Aces, Most Aces) au-delà des chips prévus (backlog).
- ❌ Internationalisation des labels (français uniquement pour l'instant).

---

## 15. Risques et mitigations

| Risque | Probabilité | Impact | Mitigation |
|---|---|---|---|
| Contrat backend instable casse le serializer | 🟠 Moyenne | 🔴 Élevé | Tâche 1.2 stabilise le contrat côté serveur AVANT tout composant |
| Master-detail mobile = dette a11y | 🔴 Élevée | 🔴 Élevé | Tâche 1.5 impose `<dialog>` natif + focus trap ; master-detail desktop-only |
| Régression silencieuse refactor `liveCardCompact` | 🟠 Moyenne | 🟠 Moyen | Extraction lazy incrémentale + screenshot diff à chaque étape |
| Routes dormantes 404/timeout | 🟠 Moyenne | 🟡 Faible | Modale Parier : timeout 6 s + retry + message clair |
| Scalabilité carte P2 à 50 matchs | 🟡 Faible | 🟠 Moyen | Toggle scan P1 + liste P3 desktop dès Phase 2/3 |
| Dérive planning chemin critique | 🟡 Faible | 🔴 Élevé | Alertes sur 1.3 / 2.1 / 3.1 / 3.2 ; ré-estimation à chaque jalon |

---

## 16. Références

- **Code source** : `pariscore.html` (cartes `premierCard:25811`, `liveCardCompact:26066`, IIFE `Scope:25236`, `TennisScope:26560`), `server.js` (routes tennis, `buildTennisValueBets:38199`).
- **Pilotage** : `GANTT-REDESIGN-TENNIS.md`, `PLAN-TACHES-REDESIGN-TENNIS.md`, `CR-LANCEMENT-REDESIGN-TENNIS.md`, `RAPPORT-FIN-MISSION-REDESIGN-TENNIS.md`.
- **Briefs expertises** : 4 sous-agents (webdesigner, data scientist, ingénieur data, expert paris) — voir conversation.
- **Panel vote** : 8 segments pondérés (1000 votants) — voir conversation.
- **Conventions projet** : `AGENTS.md` (XSS `_jsStr`, beads, non-interactive shell), `CLAUDE.md` (roadmap).

---

*Design doc — Hybride Dashboard-Carte. En attente de la revue utilisateur avant passage au plan d'implémentation. Dernière MAJ : 2026-07-07.*
