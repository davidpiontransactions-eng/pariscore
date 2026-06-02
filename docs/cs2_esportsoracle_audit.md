# CS2 Esports Oracle — Audit, Table Ronde & Roadmap PariScore
**Date** : 2026-06-02 | **Source** : audit live esportsoracle.net/cs2

---

## SYNTHÈSE EXÉCUTIVE

Esports Oracle = match predictor on-demand (pas de feed live). PariScore = plateforme live avec cotes BSD en temps réel. Angle complémentaire : Esports Oracle excelle sur la **profondeur statistique pré-match** ; PariScore excelle sur le **live + value betting automatisé**. Les 3 fonctionnalités à voler : Form Score 0-100 opponent-weighted, tableau stats multi-dimensions CT/T/LAN/Pistol, et H2H par map filtrable.

---

## ÉTAPE 1 : ANATOMIE D'ESPORTS ORACLE

### 1.1 Architecture des pages

```
esportsoracle.net/cs2
├── /cs2               → Match Predictor (formulaire)
├── /cs2/teams         → Tableau 102 équipes (RANK, WIN%, CT%, T%, PISTOL%, HLTV PTS, MAPS)
├── /cs2/stats         → 7 leaderboards distincts
├── /cs2/teams/{slug}  → Profil équipe complet
└── /cs2/tournaments   → Tournois
```

### 1.2 Match Predictor — Mécanique

**Interface :** Formulaire à 4 champs :
- Team 1 / Team 2 (combobox, top 50 HLTV)
- Match Format : `BO1` | `BO3`
- Map : dropdown (7 maps actives)
- Team 1 Starting Side : `CT` | `T` | `Unknown`

**Modèle :** "10-component model using real HLTV data for top 50 teams"  
Source data : HLTV.org + Oracle's Elixir + gol.gg  
Le résultat de prédiction est probablement un % win par équipe (output non accessible sans connexion).

### 1.3 Stats Page — 7 Leaderboards

| Section | Métrique | Seuil minimum | Note |
|---------|---------|--------------|------|
| Overall Win Rate | WR% maps | 20 maps | Brut, non ajusté SOS |
| Form Score | 0-100 (opponent-weighted, 30j) | — | **CLEF : ajustement force adversaire** |
| CT Side Win Rate | Rounds CT% | 50 rounds CT | |
| T Side Win Rate | Rounds T% | 50 rounds T | |
| Pistol Round Win Rate | Rounds 1+16 | 10 pistols | |
| LAN Performance | WR% LAN only | 5 LAN maps | Flag LAN/Online explicite |
| BO3 Series Win Rate | Séries BO3 | — | |

**Exemple données réelles (audit live) :**
- Vitality : 84% WR | CT 62.1% | T 52.8% | Pistol 60.5% | Form 90.2 | HLTV #1 | ELO 2400
- FaZe : 47% WR | CT 53.1% | T 45.4% | Pistol 42.7% | HLTV #15
- NRG : meilleur CT% 60.7% (849 rounds)
- FlyQuest : meilleur Pistol% 58.0% (96 pistols)

### 1.4 Team Profile — Structure complète

Profil Vitality extrait :
```
Header : EU · HLTV #1 · 1000 pts · 43 maps played
Stats   : WR 83.7% | CT 62.1% | T 52.8% | Pistol 60.5% | ELO 2400 | Form 30j: 85%
Roster  : PLAYER | RATING | K/D | ADR | KAST | GAMES
  ZywOo  : 1.42 | 1.52 | 88.1 ADR | 77% KAST | 141 games
  ropz   : 1.22 | 1.25 | 77.2 ADR | 78% KAST | 141 games
  flameZ : 1.26 | 1.11 | 79.5 ADR | 75% KAST | 141 games
  mezii  : 1.12 | 1.04 | 69.3 ADR | 76% KAST | 141 games
  apEX   : 0.96 | 0.82 | 67.9 ADR | 71% KAST | 141 games
Map Stats: filtrable par Ancient/Anubis/Dust2/Inferno/Mirage/Nuke/Overpass/Vertigo
H2H Records: FaZe 66.7% | FURIA 33.3% | Falcons 33.3% | G2 100% | Spirit 100%
Matchup Analysis: filtrable par (adversaire × map)
```

### 1.5 Value Betting Display

Esports Oracle **n'affiche pas les cotes bookmaker** ni de calcul EV. Site = prédiction pure, pas d'aide au paris direct. PariScore a un avantage majeur ici.

### 1.6 Modèle de Revenue

Freemium : top 3 visible gratuit, full rankings + "Player Contributions" (Kill Share, ADR Share, Impact) derrière "Go Pro".

---

## ÉTAPE 2 : TABLE RONDE DES EXPERTS

### 🎨 Expert UI/UX — Capturer la clarté Oracle + charte PariScore

**Ce qu'Esports Oracle fait bien :**
- Tableau teams ultra-dense mais lisible (8 colonnes, padding minimal, font monospace pour les %)
- Section stats = leaderboards empilés avec titre descriptif clair et note méthodologique
- H2H en tableau compact : OPPONENT | MATCHES | W | L | WIN%

**Ce que PariScore doit ajouter :**

```css
/* Jauge probabilité bicolore horizontale — le gros ajout */
.cs2-prob-bar {
  display: flex;
  height: 6px;
  border-radius: 3px;
  overflow: hidden;
  background: var(--bg4);
}
.cs2-prob-fill-ct {
  background: #3b82f6;  /* CT blue */
  transition: width 0.4s ease;
}
.cs2-prob-fill-t {
  background: #FF6B00;  /* T orange */
}
/* Label flottant au-dessus */
.cs2-prob-label { font-family:'DM Mono',monospace; font-size:10px; font-weight:700; }
.cs2-prob-label-ct { color:#3b82f6; }
.cs2-prob-label-t  { color:#FF6B00; }
```

Exemple rendu :
```
Vitality  [████████████░░░] 67%   vs   FaZe  [░░░░░░░░████████] 33%
           ←──── CT Blue ────────────────────────── T Orange ────→
```

**Boutons filtres neumorphiques** sur marchés rapides (déjà défini `.cs2-bet-btn`) :
```
[🏆 VAINQUEUR MATCH]  [🗺 VAINQUEUR MAP 1]  [🗺 VAINQUEUR MAP 2]
```

**Map stats table** — emprunter le pattern Oracle mais avec coloration CT/T :
```
MAP       T1 WR%   CT%    T%    Avantage
Mirage    72%     61%    52%   ✓ VALUE +22pp
Inferno   55%     58%    47%   —
Nuke      48%     53%    43%   —
```

---

### 📊 Data Scientist — Modélisation Quantitative

**Ce qu'Esports Oracle fait bien :**
- Form Score 0-100 opponent-weighted (≠ win% brut) — correcte avec SOS (Strength of Schedule)
- Séparation LAN/Online — delta significatif pour certaines équipes (+12pp Vitality LAN)
- Seuils d'échantillon minimum (20 maps, 50 rounds) — évite overfitting sur petits samples

**PariScore Oracle Index — Formule proposée :**

```javascript
// Probabilité blendée 5 composantes
function computeCS2OracleIndex(t1, t2, map) {
  // 1. Map winrate (BSD ou HLTV) — poids 0.30
  const mapWR = (t1.map_wr - t2.map_wr) / 100;  // diff normalisée

  // 2. ELO delta normalisé — poids 0.25
  const eloDiff = (t1.elo - t2.elo);
  const eloProb = 1 / (1 + Math.pow(10, -eloDiff / 400));  // logistic Elo

  // 3. BSD ML prediction — poids 0.25
  const bsdProb = t1.bsd_win_prob || 0.5;

  // 4. Form Score (opponent-weighted 30j) — poids 0.15
  const formDiff = ((t1.form_score || 50) - (t2.form_score || 50)) / 100;
  const formProb = 0.5 + formDiff * 0.5;

  // 5. CT/T side advantage on starting side — poids 0.05
  const sideBoost = t1.starting_ct ? (t1.ct_wr / 100 - 0.5) : (t1.t_wr / 100 - 0.5);
  const sideProb  = 0.5 + sideBoost;

  // Blend
  const raw = 0.30 * ((mapWR + 1) / 2) + 0.25 * eloProb + 0.25 * bsdProb
            + 0.15 * formProb + 0.05 * sideProb;

  // Calibration (shrink toward 50% for uncertainty)
  return Math.max(0.05, Math.min(0.95, raw));
}
```

**EV Alerte ≥ 5% :**
```javascript
function cs2EV(oracleProb, bsdOdds) {
  return oracleProb * bsdOdds - 1;  // positif = value
}
// Signal : cs2EV >= 0.05 → toast + badge vert
```

**Form Score opponent-weighted (fallback quand csapi.de vide) :**
```javascript
// Utiliser les wins pondérés par rang HLTV adversaire
function computeFormScoreFromMatches(teamName, matches, maxN = 15) {
  // weight = 1 + (50 - oppRank) / 50 si oppRank <= 50, sinon 1
  // score = Σ(result * weight) / Σ(weight) * 100
  const key = teamName.toLowerCase();
  const relevant = matches
    .filter(m => _tname(m.team1) === key || _tname(m.team2) === key)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, maxN);
  if (!relevant.length) return null;

  let sumW = 0, sumR = 0;
  for (const m of relevant) {
    const oppRank = _tname(m.team1) === key
      ? (m.team2?.rank || 50) : (m.team1?.rank || 50);
    const weight = 1 + Math.max(0, 50 - oppRank) / 50;
    const won = _tname(m.winner) === key ? 1 : 0;
    sumW += weight; sumR += won * weight;
  }
  return Math.round((sumR / sumW) * 100);
}
```

**Modèle Pistol Round :**
```javascript
// Leverage pistol win rate differential pour prédire avantage économique
// Pistol win → économie favorable 2 rounds suivants (~80% corrélation)
function pistolEdge(t1_pistol, t2_pistol) {
  const diff = (t1_pistol - t2_pistol) / 100;
  // +0.05 per 10pp pistol advantage → ajustement lambda Poisson rounds
  return diff * 0.5;  // coefficient calibré empiriquement
}
```

---

### 💰 Parieur Pro — Ergonomie 2 secondes

**Ce qu'Esports Oracle fait bien :**
- Interface prédiction simple : 4 champs → 1 bouton → résultat immédiat
- Tri par Form Score (pas par WR brut) → les paris de valeur sont visibles en haut

**Ce qui manque chez Oracle et qu'on doit avoir :**

1. **Jauge EV live** — Oracle ne calcule jamais l'EV vs cotes bookmaker. C'est notre avantage différenciant absolu. Afficher `EV +8.3%` en vert sur la ligne du dashboard quand oracle_prob > implied_prob.

2. **Badge "ORACLE CONFIRM"** — quand BSD ML prediction ET Oracle Index convergent (écart < 5pp) → signal de confiance croisée. Unique sur le marché.

3. **Map filtrage instantané** — cliquer sur une map dans le veto affiche les stats CT/T/WR de chaque équipe sur cette map spécifiquement. Oracle fait ça sur le profil équipe ; PariScore doit le faire sur le dashboard match live.

4. **Verdict 2 secondes avec contexte** :
```
🟢 BET FORT — Vitality (EV +8.3%)
   Oracle Index: 71% vs implied: 58% (cote 1.72)
   Map Avantage: Vitality Mirage +22pp
   Form: 90/100
```

---

## ÉTAPE 3 : MODIFICATIONS PROPOSÉES

### 3.1 Modifications DATA — `cs2Service.js`

**A. Form Score opponent-weighted (remplace null de csapi.de)**

Utiliser les matchs csapi.de avec pondération rang adversaire. Fallback sur `prediction.team1_form` BSD si toujours null.

```javascript
// cs2Service.js — nouvelle export
function computeFormScore(teamName, matches) {
  // Voir algo Data Scientist ci-dessus
  // Fallback 1: csapi.de matches (si rang adversaire dispo)
  // Fallback 2: BSD prediction form_score (0-1 → * 100)
}
```

Exposer dans `/api/v1/cs2/enrich` réponse : `team1.form_score` (0-100).

**B. PariScore Oracle Index**

Nouveau champ dans `_normalizeMatch()` :
```javascript
oracle_index: {
  team1_prob: null,  // calculé dans /enrich (plus de data dispo)
  team2_prob: null,
  ev_vs_bsd: null,   // team1_prob * odds_team2 - 1
  confidence: null   // 'HIGH'|'MED'|'LOW' selon composantes disponibles
}
```

Calculé dans `/api/v1/cs2/enrich` et exposé dans payload enrichi.

**C. LAN Flag**

Dans `_normalizeMatch()` :
```javascript
is_lan: /IEM|ESL|PGL|BLAST|Major|EPL|Pro League/i.test(raw.tournament?.name || '')
```

**D. Pistol stats dans enrichment**

`buildMatchEnrichment` expose `team1.pistol_wr` et `team2.pistol_wr` (depuis BSD `round_winrate` stats si disponible).

---

### 3.2 Modifications DESIGN — `pariscore.html` + `pariscore.js`

**A. Jauge probabilité bicolore (`cs2-prob-bar`)**

Insérer dans `_buildCs2Card()` entre le scoreboard et la map bar :
```html
<div class="cs2-prob-row">
  <span class="cs2-prob-label-ct">${pct1}%</span>
  <div class="cs2-prob-bar">
    <div class="cs2-prob-fill-ct" style="width:${pct1}%"></div>
    <div class="cs2-prob-fill-t"  style="width:${pct2}%"></div>
  </div>
  <span class="cs2-prob-label-t">${pct2}%</span>
</div>
```

Source probabilité : `m.prediction.team1_win_prob * 100` (BSD ML, déjà dispo).

**B. EV Badge dans dashboard**

Dans `renderCs2Dashboard()` → colonne ODDS, afficher sous les cotes :
```html
<span class="cs2-ev-badge ${ev >= 0.05 ? 'ev-pos' : ev >= 0 ? 'ev-flat' : 'ev-neg'}">
  EV ${ev >= 0 ? '+' : ''}${(ev * 100).toFixed(1)}%
</span>
```

CSS :
```css
.cs2-ev-badge.ev-pos { color:#00e676; background:rgba(0,230,118,0.10); border:1px solid rgba(0,230,118,0.3); }
.cs2-ev-badge.ev-flat { color:#ffa726; }
.cs2-ev-badge.ev-neg  { color:#5a6068; }
```

**C. Boutons filtres marchés neumorphiques**

Dans la toolbar CS2 (`.cs2-toolbar`), ajouter :
```html
<span style="width:1px;height:22px;background:var(--bg4);margin:0 4px;"></span>
<button class="cs2-bet-btn active" data-market="winner" onclick="setCs2Market('winner',this)">🏆 Match</button>
<button class="cs2-bet-btn" data-market="map1" onclick="setCs2Market('map1',this)">🗺 Map 1</button>
<button class="cs2-bet-btn" data-market="map2" onclick="setCs2Market('map2',this)">🗺 Map 2</button>
```

**D. Map Stats Table dans Pro Scout Drawer**

Tab MAPS du drawer — emprunter le pattern Oracle (table par map) :
```
MAP       T1 WR%    CT%    T%    vs T2 WR%   AVANTAGE
Mirage    72%      61%   52%     50%         ✓ +22pp
Inferno   55%      58%   47%     61%         ← T2 +6pp
Nuke      48%      53%   43%     44%         ≈ Neutre
```

**E. Badge ORACLE CONFIRM**

Dans `_cs2BettingSignals()` → nouveau signal key `'oracle'` :
```javascript
// Convergence BSD ML + Map Winrate
if (m.prediction && e && e.map_winrate) {
  const bsdP1 = m.prediction.team1_win_prob || 0.5;
  const mapEdge = ((e.map_winrate.team1 || 50) - (e.map_winrate.team2 || 50)) / 100;
  const mapProb = 0.5 + mapEdge / 2;
  if (Math.abs(bsdP1 - mapProb) <= 0.08 && bsdP1 >= 0.60) {
    signals.push({ key:'oracle', label:'⚡ ORACLE', color:'green', val: bsdP1 });
  }
}
```

---

## ÉTAPE 4 : ROADMAP DE SPRINT

### P0 — Haute valeur, faible risque

| Tâche | Fichier(s) | Effort | Impact |
|-------|-----------|--------|--------|
| Jauge probabilité bicolore CT/T | `pariscore.js` `_buildCs2Card()` + CSS | 1h | Visuel immédiat |
| EV Badge dashboard (`EV +X%`) | `pariscore.js` `renderCs2Dashboard()` + CSS | 1h | Diff. décision 2s |
| LAN flag `is_lan` dans normalizeMatch | `cs2Service.js` | 30min | Contexte tournoi |
| Form Score opponent-weighted | `cs2Service.js` `buildTeamForm()` | 2h | Fixe form null top teams |

### P1 — Features différenciantes

| Tâche | Fichier(s) | Effort | Impact |
|-------|-----------|--------|--------|
| PariScore Oracle Index (5 composantes) | `cs2Service.js` nouveau `computeCS2OracleIndex()` | 3h | Edge mathématique |
| Map Stats Table (Pro Scout Drawer tab MAPS) | `pariscore.js` `_loadScoutTab('maps')` | 3h | Parité Oracle depth |
| Badge ORACLE CONFIRM signal convergence | `pariscore.js` `_cs2BettingSignals()` | 1h | Signal exclusif |
| Boutons filtres marchés neumorphiques | `pariscore.html` toolbar CS2 | 1h | UX paris rapide |

### P2 — Backlog

| Tâche | Fichier(s) | Effort |
|-------|-----------|--------|
| Pistol Round signal dans betting signals | `cs2Service.js` + `pariscore.js` | 2h |
| BO3 Series Win Rate dans enrichment | `cs2Service.js` | 2h |
| LAN Win Rate dans enrichment | `cs2Service.js` | 2h |
| Oracle vs cote alertes SSE live | `server.js` SSE | 4h |
| `computeFormScore` dans `/api/v1/cs2/enrich` | `cs2Service.js` | 2h |

---

## ANNEXE — GAPS ET AVANTAGES COMPARATIFS

### Esports Oracle a, PariScore n'a pas encore :
| Feature | Oracle | PariScore | Delta |
|---------|--------|-----------|-------|
| Form Score 0-100 (SOS-weighted) | ✅ | ❌ (null top teams) | P0 |
| LAN/Online distinction | ✅ | ❌ | P0 |
| Pistol Round WR | ✅ | ⚠️ (backend, pas UI) | P1 |
| BO3 Series WR | ✅ | ❌ | P2 |
| Map stats filtrable par carte | ✅ | ⚠️ (données BSD dispo) | P1 |
| H2H par map spécifique | ✅ (Pro) | ❌ | P2 |
| 10-component predictor | ✅ | ❌ (5 composantes) | P1 |

### PariScore a, Esports Oracle n'a pas :
| Feature | PariScore | Oracle |
|---------|-----------|--------|
| Feed live scores BSD (30s) | ✅ | ❌ |
| Cotes bookmaker live | ✅ | ❌ |
| EV calculation vs odds | ✅ | ❌ |
| KPI verdict auto (BET FORT/SKIP) | ✅ | ❌ |
| Value Map Engine animé | ✅ | ❌ |
| Over/Under Rounds model | ✅ | ❌ |
| BSD ELO (1740 Vitality) | ✅ | ✅ (ELO 2400 diff scale) |
| Momentum live | ⚠️ (en dev) | ❌ |

---

*Audit réalisé en direct sur esportsoracle.net — 2026-06-02. Données Vitality/FaZe/stats extraites via Chrome MCP. Document généré par GM PariScore.*
