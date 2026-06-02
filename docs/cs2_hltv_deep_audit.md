# CS2 — HLTV.org Deep Audit & PariScore Integration Bible
**Date** : 2026-06-02 | **Version** : 1.0  
**Auteur** : GM PariScore (CTO + Lead Data Scientist)  
**Sources** : HLTV.org news/42485 (Rating 3.0), news/44188 (OAR), gigobyte/HLTV, hltv-async-api, audit live cs2Service.js + tools/

---

## SYNTHÈSE EXÉCUTIVE

HLTV.org est la bible mondiale du CS2 compétitif. Sa supériorité tient à 3 piliers :
1. **Profondeur métrique individuelle** — Rating 3.0 (Round Swing + eco-adjustment) dépasse tout ratio K/D
2. **Filtres contextuels stricts** — LAN vs Online, Top 30 uniquement, fenêtres 3/6 mois
3. **Opposition-Adjusted Rating (OAR)** — performances normalisées par force d'adversaire

PariScore a déjà une base solide (BSD ELO, map winrates HLTV JSON, csapi.de form/H2H). Ce document identifie les 6 innovations manquantes et leur plan d'exécution pour élever l'onglet CS2 au niveau Oracle/HLTV.

---

## ÉTAPE 1 : ANATOMIE ANALYTIQUE DE HLTV.ORG

### 1.1 Rating 3.0 — Le Nouveau Standard (août 2025)

#### Évolution historique
| Version | Période | Sous-métriques | Innovation clé |
|---------|---------|---------------|----------------|
| Rating 2.0 | 2017-2024 | Kills, ADR, KAST, Impact, Survival | 5 composantes, premier rating contextuel |
| Rating 2.1 | Oct 2024 | Idem 2.0, ajustements CS2 | MR12, assists 26 dmg, survie round perdu dévalorisée |
| **Rating 3.0** | **Août 2025** | **Kills, Damage, Survival, KAST, Multi-Kills, Round Swing** | **Round Swing + eco-adjustment par arme** |

#### Les 6 sous-métriques Rating 3.0

```
Rating 3.0 = f(Kills_adj, Damage_adj, Survival_adj, KAST_adj, MultiKills, RoundSwing)
```

**1. Kills ajustés (Eco-adjustment)**
- Équipement classé ~6 tiers : Sniper > Rifles T1 > Rifles T2 > SMG/Shotgun > Pistols premium > Starter pistols
- Calcul basé sur `prix(armor) + prix(weapon_plus_cher)`
- Tuer un joueur en starter pistol (win prob = 75%) → kill_weight ≈ 0.54
- Tuer un joueur en rifle vs rifle (win prob ≈ 48%) → kill_weight ≈ 1.10
- **Impact** : les eco-frags gonflent beaucoup moins les stats → meilleure calibration

**2. Damage ajusté**
- Même logique que kills, pondéré par niveau d'armement adverse
- ADR classique remplacé par ADR_eco-adjusted

**3. Survival**
- Survie en round **gagné** = plus valuée que survie en round perdu
- Changement depuis 2.1 : sauvetage en round perdu sans kill/assist → pas de point KAST

**4. KAST ajusté** (Kill/Assist/Survival/Trade)
- Probabilité d'impact dans le round donnée (selon économie + situation)
- Trade kill = tuer l'adversaire dans les 5 secondes après la mort d'un coéquipier

**5. Multi-Kills**
- Remplace l'ancien "Impact rating"
- Valorise les clutchs, ouvertures, 1v2/1v3 win, multi-kill rounds

**6. Round Swing (nouveau, clé du Rating 3.0)**
- Mesure la variation de probabilité de gagner le round avant/après chaque kill
- Facteurs : carte, side (CT/T), économie, position bomb, nombre de joueurs restants
- Crédit divisé : dernier dommage infligé, damage share %, flash assists, trade kills
- Elite players : **+3.0% à +4.0%** par round sur leurs kills les plus impactants
- Range typical : -1.5% à +1.5% par round sur l'ensemble de la saison

**Ajustement Oct 2025** : poids kills remonté, KAST et Multi-Kill réduits → balance 60/40 output (kills+dmg+impact) vs process (KAST+survival).

#### Opposition-Adjusted Rating (OAR) — nov. 2025

Metric : performances normalisées par qualité d'adversaire. **Fondement scientifique** pour le Top 30 filter.

```
OAR = f(Rating_brut, opponent_rank, relative_difficulty)
```

**Processus en 3 étapes :**
1. **Ranking buckets** : trier les maps par palier adversaire (top 5, 6-10, 11-20, 21-30, 31-50...)
2. **Qualité individuelle** : ajustement par points de ranking de chaque adversaire (pas juste le rang)
3. **Relative difficulty** : équipe #2 vs #1 → ajustement moindre qu'équipe #15 vs #1 (expectation gap)

**Exemple concret (ZywOo)** :
- Rating brut vs Spirit (#1, 921 pts) : 1.75
- Après opponent-quality adjustment : 2.03
- Après relative-difficulty weighting : OAR = 1.88

**Impact PariScore** : valide le filtre Top 30 — stats contre équipes mineures = bruit statistique pur.

---

### 1.2 Système de Filtres HLTV — La Puissance de la Contextualisation

HLTV expose une matrice de filtres croisables sur toutes les stats équipe et joueur :

```
Filtres disponibles (tous combinables) :
├── Event Type     : All | Majors | Big Events | LAN | Online
├── Time           : Last month | 3 months | 6 months | 12 months | [année]
├── Ranking        : All | Top 5 | Top 10 | Top 20 | Top 30 | Top 50
├── Best Of        : All | BO1 | BO3 | BO5
├── Valve Ranked   : Both | Ranked | Unranked
├── Match Type     : All | Grand final | Playoffs | Pre-playoff
└── Maps           : [7 maps active duty + archives]
```

**Configuration optimale pour prédiction paris :**
- LAN + 3 mois + Top 30 = signal fort, bruit minimal
- Online peut gonflier les WR de 5-15% (ping advantage, fatigue absente, public pressure absente)
- BO1 vs BO3 : winrate BO1 très différent (équipes favorites favorisées en BO3, variance plus haute en BO1)

---

### 1.3 Statistiques Équipe et Map Pool

#### Structure page équipe HLTV

```
Team Profile (/stats/teams/{id}/{name}) :
├── Overview        : WR global, rounds CT%, rounds T%, maps played
├── Players         : roster avec Rating 3.0, KAST, ADR, K/D par joueur
├── Maps            : winrate par carte (7 maps active duty)
├── Pistol rounds   : CT pistol%, T pistol% (rounds 1 et 16 du MR12)
├── Matches         : historique filtrable
├── Events          : palmarès tournois
├── H2H             : vs chaque adversaire (filtrable LAN/Online)
└── Compare         : comparaison multi-métriques face à un adversaire ciblé
```

#### Données map pool (exemple Vitality, audit Esports Oracle)
```json
{
  "team": "Vitality",
  "hltv_rank": 1,
  "elo": 2400,
  "global_winrate": 83.7,
  "ct_winrate": 62.1,
  "t_winrate": 52.8,
  "pistol_winrate": 60.5,
  "form_30d": 85.0,
  "maps": {
    "Mirage":  { "winrate": 78, "maps_played": 12 },
    "Inferno": { "winrate": 85, "maps_played": 14 },
    "Nuke":    { "winrate": 91, "maps_played": 11 },
    "Ancient": { "winrate": 80, "maps_played": 10 },
    "Anubis":  { "winrate": 71, "maps_played": 7  },
    "Vertigo": { "winrate": 60, "maps_played": 5  },
    "Dust2":   { "winrate": 75, "maps_played": 8  }
  }
}
```

#### Pistol Rounds — Importance sous-estimée

**Pistol Round stats en MR12** :
- Round 1 (CT pistol) + Round 7 (T pistol) = 2 rounds/13 = 15.4% des rounds
- Gagner le pistol CT donne ~55% win prob sur le side CT (historiquement, descend vers ~50% en MR12)
- Chain : Pistol win → force buy possible → double pistol round advantage fréquent
- **Signal pari live** : équipe forte en pistol T peut renverser une demi-période CT défavorable

---

### 1.4 Head-to-Head (H2H) — Structure et Filtres

```
H2H page (/team/{id}/{name}#info) :
├── Derniers N matchs entre les 2 équipes (configurable)
├── Filtre LAN uniquement — crucial (résultats online peuvent être trompe-l'œil)
├── Filtre par map — H2H sur Mirage uniquement vs H2H global très différent
├── Filtre par période — H2H 6 mois vs historique long diverge souvent (roster changes)
└── Format : nb victoires T1 / nb victoires T2 / ratio
```

**Insights clés pour le betting** :
- H2H LAN BO3 des 6 derniers mois = meilleur prédicteur de résultat Major
- H2H sur map veto = filter crucial si veto connu (une équipe peut avoir 80% WR sur Inferno mais 30% vs T2 spécifiquement)
- Roster change récent invalide H2H >6 mois → ignorer données stale

---

### 1.5 Player Profile — Le Pro Scout Layer

Structure page joueur HLTV (`/player/{id}/{name}`) :
```
Header :
├── Photo détourée (bg transparent : /img/players/{id}/?bg=transparent)
├── Nationalité + équipe actuelle
├── HLTV Rating 3.0 (CT side / T side séparés depuis 3.0)
└── Multi-Kill rating + Round Swing (nouvelles métriques)

Stats block :
├── Rating 3.0    : 0.x → 2.x (>1.15 = top, >1.30 = star, >1.50 = elite)
├── KAST%         : % rounds avec contribution (kill/assist/survive/trade)
├── ADR           : dommages moyens par round (>80 = bon, >90 = excellent)
├── K/D ratio     : kills per death (simple mais utilisé comme sanity check)
├── Impact        : → remplacé par Multi-Kills dans 3.0
├── Round Swing   : nouveau — +3%/round = impact élite
├── CT Rating     : rating séparé côté CT
└── T Rating      : rating séparé côté T

Roles (non-officiel HLTV mais standard industrie) :
├── IGL  : in-game leader — stats KAST et Round Swing élevés même avec Rating moyen
├── AWPer : ADR souvent plus bas (1 shot = kill, pas de damage partial), Round Swing élevé
├── Entry fragger : K/D souvent bas (ouvre sites, meurt), KAST élevé
├── Support : KAST très élevé, ADR moyen, Round Swing bas
└── Lurker : K/D élevé, KAST moyen, statistics plus "cachées"
```

**Vitality roster (données audit Esports Oracle)** :
| Joueur | Rating | K/D | ADR | KAST | Rôle |
|--------|--------|-----|-----|------|------|
| ZywOo  | 1.42   | 1.52| 88.1| 77%  | AWPer/Star |
| flameZ | 1.26   | 1.11| 79.5| 75%  | Entry/Star |
| ropz   | 1.22   | 1.25| 77.2| 78%  | Rifler/Support |
| mezii  | 1.12   | 1.04| 69.3| 76%  | Support |
| apEX   | 0.96   | 0.82| 67.9| 71%  | IGL |

---

## ÉTAPE 2 : TABLE RONDE DES EXPERTS — BRAINSTORMING PARISCORE

### 🎨 Expert UI/UX — Épuration HLTV vers Dark Mode PariScore

**Critique HLTV.org** :
- Dense et encyclopédique — parfait pour l'analyste pro, paralysant pour le parieur rapide
- Pas de hiérarchie visuelle claire : Rating 3.0 noyé parmi 15 autres stats
- Desktop-first, tableaux trop larges pour mobile
- Couleurs neutres — aucune signalétique visuelle de "c'est un signal fort"

**Vision PariScore Dark Mode CS2** :

```
Card match CS2 (actuelle → upgraded) :
┌────────────────────────────────────────────────┐
│  [Logo] VITALITY  vs  FAZE  [Logo]   🏟 LAN   │
│  HLTV #1 ★★★★★     HLTV #15 ★★☆☆☆           │
│                                                │
│  ELO: 2400 ██████████  ELO: 1620 ████░░░░░░  │
│  Form: 90 [━━━━━━━━━━]  Form: 62 [━━━━━░░░░░] │
│                                                │
│  ┌─────── MAP : INFERNO ────────────────────┐  │
│  │ VIT 85% ██████████░  FAZ 45% █████░░░░░ │  │
│  │ AVANTAGE VIT +40pp  → ✓ VALUE MAP       │  │
│  └─────────────────────────────────────────┘  │
│                                                │
│  Pistol CT: VIT 62% ●●●  FAZ 43% ●●○         │
│  CT: 62.1% / T: 52.8%    CT: 53.1% / T: 45.4% │
│                                                │
│  Prob Win: [========65%====35%========]        │
│  EV: +8.2%  Cotes: 1.45 / 2.80                │
│                                                │
│  [PRO SCOUT ▼]  [VETO ▼]  [LIVE ●]           │
└────────────────────────────────────────────────┘
```

**Design tokens à utiliser (existants)** :
- CT side : `--cf-cs2-ct: #FF6B00` (orange)
- T side : `--cf-cs2-t: #1E90FF` (bleu)
- LAN badge : `#FFD700` gold (à créer)
- Value positive : `--cf-green: var(--cf-green-500)`
- Gauge dégradée : CSS `linear-gradient` dynamique selon % valeur

---

### 📊 Data Scientist — Modèle Prédictif Augmenté par HLTV

**Architecture proposée : PariScore Composite Score v2**

```
Composite Score = w1×BSD_ELO + w2×HLTV_Form + w3×HLTV_MapWR + w4×RosterRating + w5×H2H
                  0.30          0.25            0.20             0.15              0.10

Avec :
- BSD_ELO      = normalized(elo_rating, [800, 2500]) → [0, 1]
- HLTV_Form    = form_score_sos / 100                → [0, 1]
- HLTV_MapWR   = map_winrate_vs_top30_lan / 100      → [0, 1]
- RosterRating = mean(rating30_joueurs) / 1.5        → [0, 1] (1.5 = Rating élite)
- H2H          = h2h_wins_lan / h2h_total_lan        → [0, 1]
```

**Pondération Rating 3.0 joueurs → Force Roster** :
```javascript
function computeRosterStrength(players) {
  // Rating 3.0 : 1.0 = moyenne, >1.15 = bon, >1.30 = star, >1.5 = élite
  if (!players?.length) return null;
  const ratings = players.map(p => p.rating || 1.0);
  const mean = ratings.reduce((a,b) => a+b, 0) / ratings.length;
  const starBonus = ratings.filter(r => r > 1.30).length * 0.05; // bonus joueurs stars
  return Math.min(1, (mean - 0.8) / 0.7 + starBonus); // normalized [0,1]
}
```

**Filtre Top 30 anti-bruit** :
- Ne calculer Form + Map WR que contre adversaires HLTV rank ≤ 30
- WR brut vs tier 3 peut être 90%+ même pour une équipe faible
- Pénalité : ignorer matchs où les 2 équipes sont ranked > 30

**Calibration signal EV avec OAR** :
- Si Rating 3.0 star (ZywOo 1.42) vs adversaire de rang similaire → prob boost +3% max
- Si star face à équipe top 5 → OAR effect réduit (expectation gap faible)
- Intégrer dans `computeFormScore()` existant via `sos_multiplier`

---

### 🕵️ Analyste E-sport — Filtres Anti-Bruit

**Règle d'or HLTV (à automatiser)** :

```
Stats valides pour prédiction = stats où :
  AND opponent_rank <= 30       // adversaire connu/classé
  AND event_type = 'LAN'        // pression scène réelle
  AND timeframe_days <= 90      // roster stable (pas de changements >3 mois)
  AND maps_played_on_map >= 5   // sample size minimum par carte
  AND format = 'BO3'            // pour les prédictions BO3 uniquement
```

**Signaux avancés sous-exploités** :

1. **Pistol Round Delta** : différence de pistol WR entre les 2 équipes → fort prédicteur du premier side
   - ΔPistol ≥ 10% = avantage mesurable en live trading (buy round 2 immédiatement après pistol gagné)
   
2. **CT/T Imbalance** : équipe forte CT (>58%) + démarrage CT sur une carte = signal value bet
   - 60% des maps CS2 sont CT-favored structurellement → renforce signal si équipe excellente CT

3. **Form Streak Velocity** : pas juste le form score, mais la trajectoire
   - Équipe montante (3 victoires top-30 LAN en 2 semaines) > équipe stable form 75%
   - Descente : équipe avec form 80% mais 3 défaites consécutives recentes → attention

4. **Map Pool Depth vs Veto Forcing** : équipe avec pool réduit (3-4 cartes fortes) peut être forcée sur ses mauvaises cartes en BO3
   - Mesurer entropy du map pool : `H = -Σ(pi × log(pi))` — entropy faible = pool concentré = vulnérable au veto

5. **IGL Performance Signal** : si l'IGL a rating < 0.95 depuis 3 matchs → team sous pression stratégique
   - apEX (Vitality) : 0.96 rating stable = ok. Drop en dessous de 0.90 = warning systémique.

---

## ÉTAPE 3 : SPÉCIFICATIONS FONCTIONNELLES

### 3.1 Innovation DATA — HLTV Filtering Engine

**Objectif** : filtrer automatiquement les stats HLTV pour n'exposer que le signal pur (LAN + Top 30 + 90j).

**Implémentation** : extension de `tools/refresh_hltv_team_mapstats.js`

```javascript
// Ajout aux options getTeamStats() gigobyte/HLTV
const stats = await HLTV.getTeamStats({
  teamId    : team.id,
  startDate : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // 90j
  endDate   : new Date(),
  // Note: gigobyte/HLTV supporte matchType et rankingFilter via certaines versions
  // Si non supporté : post-filter les résultats par opponent_rank et event_type
});
```

**Post-filtering** côté server.js dans `buildMatchEnrichment()` :
```javascript
function _hltvFilterStats(rawStats, options = {}) {
  const { maxOpponentRank = 30, lan = true, minMapsPerMap = 5 } = options;
  return rawStats.filter(match =>
    (!lan || match.event_type === 'LAN') &&
    (match.opponent_rank <= maxOpponentRank) &&
    (match.maps_played >= minMapsPerMap)
  );
}
```

**Champs ajoutés au payload `/api/v1/cs2/enrich`** :
```json
{
  "team1_hltv_filtered": {
    "map_winrates_lan_top30": { "Mirage": 78, "Inferno": 85, "Nuke": 91 },
    "pistol_ct_pct_lan": 62.1,
    "pistol_t_pct_lan": 58.3,
    "ct_winrate_lan": 61.8,
    "t_winrate_lan": 51.9,
    "sample_size_lan_top30": 42,
    "filter_applied": "LAN+Top30+90d"
  }
}
```

---

### 3.2 Innovation DATA — Indice "Pistol Round Master"

**Objectif** : calculer la probabilité de remporter le round 1 d'une carte → signal trading live.

**Algorithme** :
```javascript
function computePistolMasterIndex(t1Stats, t2Stats, startingSide) {
  // t1Stats/t2Stats : { pistol_ct_pct, pistol_t_pct, sample_size }
  const t1Side = startingSide === 'CT' ? 'pistol_ct_pct' : 'pistol_t_pct';
  const t2Side = startingSide === 'CT' ? 'pistol_t_pct' : 'pistol_ct_pct';
  
  const t1Pistol = t1Stats?.[t1Side] ?? 50;
  const t2Pistol = t2Stats?.[t2Side] ?? 50;
  
  // Normalisation via softmax (sum must be 100%)
  const total = t1Pistol + t2Pistol;
  const t1Prob = total > 0 ? (t1Pistol / total) * 100 : 50;
  const t2Prob = 100 - t1Prob;
  
  const delta = Math.abs(t1Pistol - t2Pistol);
  const signal = delta >= 15 ? 'STRONG' : delta >= 8 ? 'MODERATE' : 'WEAK';
  
  return {
    t1_pistol_prob  : safeFixed(t1Prob, 1),
    t2_pistol_prob  : safeFixed(t2Prob, 1),
    delta_pct       : safeFixed(delta, 1),
    signal_strength : signal,
    trade_signal    : signal !== 'WEAK'
      ? `${t1Prob > t2Prob ? 'T1' : 'T2'} favori pistol round (Δ${delta.toFixed(1)}%)`
      : null
  };
}
```

**Exposition** : ajouté à `/api/v1/cs2/enrich` + `/api/v1/cs2/matches` normalisé.

---

### 3.3 Innovation DESIGN — Pro Scout Player Grid

**Objectif** : dans le tiroir d'analyse CS2, afficher les 5 joueurs de chaque équipe avec portrait détouré, rôle et jauge Rating 3.0.

**HTML structure** (à intégrer dans `_cs2DrawerContent()`) :
```html
<div class="cs2-scout-grid">
  <div class="cs2-scout-team" data-team="1">
    <h4 class="cs2-scout-label">Team Vitality</h4>
    <div class="cs2-scout-players">
      <!-- per player -->
      <div class="cs2-scout-player" data-rating="1.42">
        <img class="cs2-scout-portrait" 
             src="https://www.hltv.org/img/static/player/playerslot.svg" 
             data-hltv-id="7998" 
             alt="ZywOo"
             loading="lazy">
        <div class="cs2-scout-info">
          <span class="cs2-scout-name">ZywOo</span>
          <span class="cs2-scout-role awper">AWP</span>
          <div class="cs2-scout-rating-bar">
            <div class="cs2-scout-rating-fill" style="width: 94.7%"></div>
            <!-- width = (rating - 0.7) / (1.5 - 0.7) * 100 -->
          </div>
          <span class="cs2-scout-rating-value">1.42</span>
          <span class="cs2-scout-stats">ADR 88 · KAST 77%</span>
        </div>
      </div>
    </div>
  </div>
</div>
```

**CSS (tokens Design System V2)** :
```css
.cs2-scout-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--cf-space-3);
}

.cs2-scout-player {
  display: flex;
  align-items: center;
  gap: var(--cf-space-2);
  padding: var(--cf-space-2);
  background: var(--cf-surface-2);
  border-radius: var(--cf-radius-md);
  transition: transform 80ms ease;
}

.cs2-scout-portrait {
  width: 48px;
  height: 48px;
  object-fit: cover;
  border-radius: var(--cf-radius-sm);
  background: var(--cf-surface-3); /* fallback */
}

.cs2-scout-role {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.05em;
  padding: 2px 6px;
  border-radius: 3px;
}
.cs2-scout-role.awper   { background: #5B2D8E22; color: #B07AFF; }
.cs2-scout-role.igl     { background: #8B450022; color: #FFA040; }
.cs2-scout-role.entry   { background: #8B000022; color: #FF6B6B; }
.cs2-scout-role.support { background: #00558022; color: #40C0FF; }
.cs2-scout-role.lurk    { background: #00400022; color: #40FF80; }

.cs2-scout-rating-bar {
  height: 3px;
  background: var(--cf-surface-4);
  border-radius: 2px;
  margin: 4px 0;
  overflow: hidden;
}
.cs2-scout-rating-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--cf-cs2-t), var(--cf-cs2-ct));
  border-radius: 2px;
  transition: width 400ms cubic-bezier(0.4, 0, 0.2, 1);
}
```

**Source données** :
- Roster + Rating/ADR/KAST → `/api/v1/cs2/enrich` (csapi.de player stats déjà pullés)
- Portrait photo URL → `https://www.hltv.org/img/static/player/{hltvId}/?bg=transparent` (si HLTV ID disponible)
- Fallback photo → initiales dans cercle coloré côté CSS uniquement
- Rôle → inféré via heuristique : ADR très bas + K/D élevé = AWPer, rating < 1.0 team star = IGL

---

### 3.4 Innovation DESIGN — Veto Map Impact Component

**Objectif** : afficher en temps réel le différentiel de winrate sur la carte sélectionnée en veto.

**Déclencheur** : BSD veto feed → matchVeto change → carte sélectionnée → component update.

**HTML** :
```html
<div class="cs2-veto-impact" data-map="Inferno">
  <div class="cs2-veto-map-name">INFERNO</div>
  <div class="cs2-veto-bars">
    <div class="cs2-veto-bar t1" style="--wr: 85%">
      <span class="cs2-veto-team">VIT</span>
      <div class="cs2-veto-fill"></div>
      <span class="cs2-veto-pct">85%</span>
    </div>
    <div class="cs2-veto-bar t2" style="--wr: 45%">
      <span class="cs2-veto-team">FAZ</span>
      <div class="cs2-veto-fill"></div>
      <span class="cs2-veto-pct">45%</span>
    </div>
  </div>
  <div class="cs2-veto-verdict advantage-t1">▲ T1 +40pp — VALUE MAP CONFIRMÉE</div>
</div>
```

**CSS animation** :
```css
.cs2-veto-fill {
  width: var(--wr);
  height: 8px;
  border-radius: 4px;
  transition: width 600ms cubic-bezier(0.34, 1.56, 0.64, 1); /* spring */
  background: linear-gradient(90deg, currentColor, color-mix(in srgb, currentColor 70%, transparent));
}
.cs2-veto-bar.t1 { color: var(--cf-cs2-ct); }
.cs2-veto-bar.t2 { color: var(--cf-cs2-t); }

.cs2-veto-verdict.advantage-t1 { color: var(--cf-green-400); font-weight: 700; }
.cs2-veto-verdict.advantage-t2 { color: var(--cf-red-400);   font-weight: 700; }
.cs2-veto-verdict.neutral       { color: var(--cf-text-muted); }
```

**Logique JS** :
```javascript
function _renderVetoMapImpact(mapName, t1MapStats, t2MapStats) {
  const key = mapName.toLowerCase().replace(/[^a-z]/g, '');
  const t1wr = t1MapStats?.[key] ?? null;
  const t2wr = t2MapStats?.[key] ?? null;
  if (t1wr == null && t2wr == null) return null; // no data → hide component
  const t1 = t1wr ?? 50, t2 = t2wr ?? 50;
  const delta = t1 - t2;
  const cls = Math.abs(delta) >= 15 ? (delta > 0 ? 'advantage-t1' : 'advantage-t2') : 'neutral';
  const verdict = Math.abs(delta) >= 15
    ? `▲ ${delta > 0 ? 'T1' : 'T2'} +${Math.abs(delta).toFixed(0)}pp — ${Math.abs(delta) >= 25 ? 'VALUE MAP CONFIRMÉE' : 'Avantage Map'}`
    : '≈ Équilibre sur cette carte';
  return { t1, t2, delta, cls, verdict };
}
```

---

## ÉTAPE 4 : ROADMAP D'EXÉCUTION

### État existant (déjà implémenté)

| Feature | Fichier | Ligne approx | Statut |
|---------|---------|-------------|--------|
| HLTV Rankings JSON | `tools/refresh_hltv_rankings.py` | — | ✅ Prod (weekly cron) |
| HLTV Map Winrates JSON | `tools/refresh_hltv_team_mapstats.js` | — | ✅ Prod (weekly, CF block risk) |
| BSD ELO bulk (479 teams) | `services/cs2Service.js:150` | ✅ Prod (6h cache) |
| Map Advantage | `cs2Service.js:236` | ✅ Prod |
| Form Score SOS | `cs2Service.js` | ✅ Prod (enrichment) |
| LAN Badge detection | `cs2Service.js:338` | ✅ Prod (keyword) |
| Probability Bar CT/T | `pariscore.js` | ✅ Prod (when BSD pred available) |
| EV Badge | `pariscore.js` | ✅ Prod |
| Veto fetch | `cs2Service.js:202` | ✅ Prod (20s cache) |
| Player stats (csapi.de) | `/api/v1/cs2/enrich` | ✅ Prod (Rating/ADR/KAST/K/D) |
| Momentum Matrix | `cs2Service.js` | ✅ Prod |
| H2H (csapi.de) | `/api/v1/cs2/enrich` | ✅ Prod |

### P0 — Intégration données (priorité max)

**Sprint : ~8h dev**

| # | Tâche | Fichier | Effort |
|---|-------|---------|--------|
| P0.1 | **HLTV Filtering Engine** : post-filter stats LAN+Top30+90j dans `buildMatchEnrichment()` | `server.js` | 2h |
| P0.2 | **Pistol Round Master** : algo `computePistolMasterIndex()` + exposition `/enrich` | `server.js` | 1.5h |
| P0.3 | **Roster Strength Score** : `computeRosterStrength()` depuis player ratings csapi.de | `server.js` | 1h |
| P0.4 | **Map Pool Entropy** : `computeMapPoolEntropy()` → flag "pool concentré = veto risk" | `server.js` | 1h |
| P0.5 | **OAR approximation** : pondérer form score par rank adversaire moyen des 10 derniers matchs | `server.js` | 2h |

### P1 — Rendu visuel (UI prioritaire)

**Sprint : ~10h dev**

| # | Tâche | Fichier | Effort |
|---|-------|---------|--------|
| P1.1 | **Pro Scout Player Grid** : 5 joueurs + portrait + role badge + Rating 3.0 gauge dans Skill Drawer | `pariscore.js` / CSS | 3h |
| P1.2 | **Veto Map Impact** : component réactif winrate delta post-veto avec spring animation | `pariscore.js` / CSS | 2h |
| P1.3 | **CT/T Win Rate display** : icône CT🛡️/T💣 + % sur chaque carte de la card match | `pariscore.js` | 1.5h |
| P1.4 | **Pistol Round badge** : affichage ΔPistol dans card + tooltip "signal trading" | `pariscore.js` | 1h |
| P1.5 | **Map Pool Entropy flag** : badge "🎯 Pool Concentré" sur card si entropy < seuil | `pariscore.js` | 1h |
| P1.6 | **Form trajectory arrow** : ↑↗→↘↓ basé sur 3 derniers résultats vs Form score global | `pariscore.js` | 1.5h |

### P2 — Métriques avancées joueurs (bonus)

**Sprint : ~6h dev**

| # | Tâche | Fichier | Effort |
|---|-------|---------|--------|
| P2.1 | **IGL Performance Monitor** : alerte si IGL rating < 0.90 depuis 3 matchs | `server.js` | 1.5h |
| P2.2 | **CT/T Player Split** : afficher Rating CT vs Rating T par joueur dans Pro Scout Grid | `server.js` + `pariscore.js` | 2h |
| P2.3 | **Round Swing top player** : calculer/injecter Round Swing proxy depuis csapi.de `swing` stat | `server.js` | 2h |
| P2.4 | **Star Player EV boost** : si star (Rating > 1.30) en grande forme → +2% EV adjustment | `server.js` | 0.5h |

---

## ANNEXE A : Architecture Données HLTV — Accès Technique

### Sources actuelles et leurs contraintes

```
Source                    | Type      | Contrainte CF | Fréquence | Données
--------------------------|-----------|---------------|-----------|----------
hltv-async-api (Python)   | Scraper   | Oui (VPS)     | Weekly    | Rankings top-30
gigobyte/HLTV (npm)       | Scraper   | Oui (VPS)     | Weekly    | Map winrates
csapi.de /players/stats   | API libre | Non           | 6h cache  | Rating/ADR/KAST
BSD CSGO                  | API payée | Non           | 30s live  | ELO, prédictions
data/hltv_rankings.json   | JSON flat | N/A (disque)  | Read 1h   | Rank + points
data/hltv_team_mapstats.json | JSON   | N/A (disque)  | Read 24h  | Map WR par carte
```

### Solution Cloudflare blocking (VPS)

HLTV bloque les IP datacenter VPS (Cloudflare). Deux options :

**Option A (existante, à maintenir)** : exécuter les scripts de refresh depuis la machine locale (IP résidentielle) et pousser les JSON vers le VPS.

```bash
# Machine locale (IP résidentielle) :
python3 tools/refresh_hltv_rankings.py
node tools/refresh_hltv_team_mapstats.js
# Puis sync vers VPS :
scp data/hltv_rankings.json data/hltv_team_mapstats.json ubuntu@vps:/home/ubuntu/pariscore/data/
```

**Option B (évolution)** : Bright Data residential proxy pour exécution directe VPS (coût ~$3-5/run mensuel à optimiser). `hltv-async-api` supporte le paramètre proxy.

### Endpoints HLTV utiles (gigobyte/HLTV npm)

```javascript
// Rankings
HLTV.getTeamRanking({ date, country })
HLTV.getTeamByName({ name })

// Stats
HLTV.getTeamStats({ teamId, startDate, endDate })
// → { mapStats: [{ name, winRate, ctWins, tWins, ... }], currentLineup: [...], pistolStats: {...} }

HLTV.getPlayerStats({ playerId, startDate, endDate })
// → { rating: 1.42, kast: 0.77, dpr: 0.88, adr: 88.1, kpr: 0.78, ... }

// H2H — via match history filtering
HLTV.getTeam({ id })
// → { ...team, recentResults: [{ vs, result, map, event, lan: bool }] }
```

---

## ANNEXE B : Métriques Prioritaires pour Paris — Synthèse Quick-Ref

```
Signal         | Source    | Seuil BET   | Type pari ciblé
---------------|-----------|-------------|------------------
ELO delta      | BSD       | >200 pts    | Match winner
Form Score SOS | BSD/calc  | >75 vs <50  | Match winner
Map WR LAN T30 | HLTV JSON | >70% vs <50%| Map winner / ML
ΔPistol        | HLTV JSON | >10%        | Live trading round 1
CT/T balance   | BSD       | CT>58%      | First half ML
Prob Win (ML)  | BSD pred  | >62%        | Match winner
EV             | calc      | >5%         | Match winner
H2H LAN 6m    | csapi.de  | >60%        | Match winner (confirmateur)
Roster Rating  | csapi.de  | mean>1.15   | Modificateur confiance
Map Pool Entropy| calc     | H<1.5       | Veto picking strategy
```

---

*v1.0 — 2026-06-02 — HLTV Deep Audit complet. 4 étapes : anatomie métriques, table ronde experts, specs fonctionnelles (HLTV Filtering Engine + Pistol Master + Pro Scout Grid + Veto Map Impact), roadmap P0→P1→P2.*
