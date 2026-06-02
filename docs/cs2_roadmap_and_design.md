# CS2 — Roadmap, Design & Audit Technique
**PariScore v12.65+ — Rapport de Mission**
**Date** : 2026-06-02

---

## SYNTHÈSE EXÉCUTIVE

L'onglet CS2 n'est pas un projet à lancer — il existe déjà. Un pipeline complet BSD+csapi.de+ByMykel est en production avec 9 routes API, un frontend avec dashboard + card view, et des modèles Over Rounds + Map Advantage opérationnels. Ce document cartographie l'existant avec rigueur, identifie les 4 bugs connus, et définit la roadmap pour les 3 fonctionnalités innovantes manquantes : Veto Tracker, Live Momentum Matrix, et Value Map Engine animé.

---

## MISSION 1 : ÉTAT DES LIEUX TECHNIQUE

### 1.1 Pipeline de données — ce qui tourne en production

```
BSD CSGO Addon ($5/mo)          csapi.de (free, no auth)      ByMykel/CSGO-API (GitHub CDN)
  /api/v2/matches/live/    ←→     /matches/latest              stickers.json
  /api/v2/matches/?status=       /rankings/                    highlights.json
  /api/v2/predictions/           /players/stats
  /api/v2/teams/?limit=500       /teams/{id}
  /api/v2/teams/{id}/
        ↓                               ↓                              ↓
  cs2Service.js — normalise + enrichit + cache
        ↓
  9 routes /api/v1/cs2/*
        ↓
  pariscore.js — initCs2Page() → renderCs2Dashboard() / renderCs2Matches()
```

**Données exposées par match (60+ champs) :**
- BSD : status, scores series+rounds, format bo1/bo3/bo5, cotes brutes, current_map, map_number, logos bg=transparent, prédictions ML (win_prob, confidence, form_score)
- BSD Teams bulk : elo_rating, elo_peak, map_stats (CT winrate, T winrate, map_winrate global, sample_size)
- csapi.de : forme 10 derniers matchs (W/L/N + winrate%), H2H 15 derniers (t1wins/t2wins), streak actuel, roster + stats joueurs (rating, adr, kast, k/d, swing, maps played)
- HLTV rankings JSON local : rank mondial, points (généré par `tools/refresh_hltv_rankings.py`)
- HLTV map winrates JSON local : winrate% par carte 7 maps actives (généré par `tools/refresh_hltv_team_mapstats.js`)
- ByMykel : stickers d'équipes (image URL), highlights vidéo MP4 (match clips Steam CDN)
- Liquipedia scraper : matchs tier-3 FRAG TAP / Exort Series (5 min cache)
- Berserk 1v1 scraper : matchs Berserk League

**Sources secondaires configurées mais actives selon disponibilité :**
- `data/hltv_rankings.json` — re-lu toutes les heures depuis disque
- `data/hltv_team_mapstats.json` — re-lu toutes les 24h depuis disque
- Ces fichiers requièrent exécution manuelle des scripts Python/JS de refresh

### 1.2 Routes API (server.js)

| Route | Cache | Description |
|-------|-------|-------------|
| `GET /api/v1/cs2/matches[?status=live|prematch]` | 30s | Tous matchs BSD normalisés + ELO HLTV |
| `GET /api/v1/cs2/live` | 30s | Matchs in-progress uniquement |
| `GET /api/v1/cs2/highlights?team1=&team2=` | 1h | Clips vidéo ByMykel filtrés |
| `GET /api/v1/cs2/enrich?team1=&team2=[&map=]` | 6h | Form + H2H + joueurs + map winrates |
| `GET /api/v1/cs2/map-model?team1=&team2=&map=[&rankWindow=]` | 6h | Over Rounds model csapi.de |
| `GET /api/v1/cs2/stickers` | 24h | Index stickers ByMykel |
| `POST /api/v1/cs2/refresh` | — | Invalide cache + refetch |
| `GET /api/v1/cs2/berserk/matches` | 5 min | Berserk 1v1 |
| `GET /api/v1/cs2/liquipedia/matches` | 5 min | Tier-3 Liquipedia |

### 1.3 Frontend (pariscore.js lignes 24215–25100+)

**Composants implémentés :**
- `initCs2Page()` — skeleton loader → fetch → poll 30s
- `renderCs2Matches()` — card view : scorecard CT/T coloré, map bar, Over Rounds badge, value_flag badge, sticker équipe, highlights, enrichment async (form + H2H + joueurs)
- `renderCs2Dashboard()` — tableau KPI : verdict auto (BET FORT/LÉGER/SKIP/HOLD), signaux color-coded
- `_cs2BettingSignals(m)` — 6 signaux : prob ML, form T1/T2, H2H, map winrate, Over Rounds, CT/T side
- `_cs2Verdict()` — règle : ≥3 verts = BET FORT, ≥2 verts = BET LÉGER, ≥3 rouges = SKIP
- `_fetchEnrichment()` — appel async /enrich 3-8s après render initial
- `_fetchMapOverModel()` — appel async /map-model avec cache local module-scope
- `_cs2FindSticker()` — lookup sticker par nom équipe normalisé

**Design System actuel :**
- `.cs2-rds-t1` (orange CT `#FF6B00`) / `.cs2-rds-t2` (bleu T `#1E90FF`)
- `.cs2-map-bar.map-{mirage|inferno|nuke|...}` — dégradés CSS procéduraux par carte
- `.cs2-value-flag` — badge texte "✓ Value Map" (pas encore animé)
- `.adv-t1/.adv-t2` — indicateur avantage carte neutre/équipe1/équipe2

### 1.4 Goulets d'étranglement et mitigations

**Risque 1 — HLTV rate-limiting**
HLTV.org interdit le scraping direct. Solution actuelle : fichiers JSON générés par scripts locaux (`refresh_hltv_rankings.py`, `refresh_hltv_team_mapstats.js`) et lus depuis disque. Ces scripts tournent manuellement ou via cron VPS. **Ne jamais fetch hltv.org directement depuis server.js.**

**Risque 2 — Désynchronisation BSD live**
BSD CS2 cache server-side 30s sur `/live/`. Cache local `_cs2Cache` aligné sur 30s. Le poll frontend 30s est cohérent. Risque résiduel : burst si N utilisateurs triggent simultanément `/api/v1/cs2/refresh` POST — pas de mutex sur `_cs2Cache`. Mitigation : ajouter flag `_cs2Fetching` (même pattern que `isFetchingOdds`).

**Risque 3 — csapi.de availability**
Source free sans SLA. Si down → `fetchCsApiMatches()` retourne cache stale ou tableau vide, `buildMatchEnrichment()` retourne partiellement null. Frontend gère via `⏳ Chargement` state + signaux absents (non bloquant).

**Risque 4 — ByMykel GitHub CDN throttle**
CDN GitHub raw pour stickers.json (2-3 MB) et highlights.json. Cache 1h/24h respectifs. Acceptable.

**Risque 5 — BUG-3 setTimeout accumulation (CRITIQUE)**
`renderCs2Dashboard()` crée 2 nouveaux `setTimeout(_applyCs2Filter, 3000/8000)` à chaque cycle de 30s. Après 10 minutes : ~40 timers pendants. Cause re-renders en cascade et memory leak progressif. **Bloquant en prod longue durée.** Voir section corrections P0.

---

## MISSION 2 : TABLE RONDE DES EXPERTS

*Débat simulé autour d'une question centrale : comment transformer l'onglet CS2 existant en l'outil d'aide à la décision le plus affûté du marché ?*

---

### 🎨 Expert UI/UX Design — Spécialiste E-sport

**"L'information doit frapper avant que l'œil ne bouge."**

L'implémentation actuelle a les bons tokens (`--cf-*`, CT/T orange/bleu). Trois ajustements majeurs :

**Layout CS2-natif :** Remplacer le grid générique par un layout à deux colonnes inspired des HUD E-sport. Colonne gauche : équipes + scores series + logo. Colonne centrale : rounds (scores actuels en chiffres XL). Colonne droite : signaux KPI empilés + verdict. Sur mobile : empilement vertical mais round score XL en premier.

**Codes couleurs stricts :**
- CT side (Counter-Terrorist) : `#1E90FF` (bleu électrique) — TOUJOURS cette couleur
- T side (Terrorist) : `#FF8C00` (orange profond) — TOUJOURS
- Rounds gagnés par CT : arrière-plan `rgba(30,144,255,0.12)` sur la cellule
- Rounds gagnés par T : arrière-plan `rgba(255,140,0,0.12)`

**Boutons neumorphiques 3D :**
```css
.cs2-bet-btn {
  background: var(--bg2);
  border-radius: 8px;
  box-shadow: 4px 4px 8px rgba(0,0,0,0.4), -2px -2px 6px rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.06);
  transition: box-shadow 80ms, transform 80ms;
}
.cs2-bet-btn:active {
  box-shadow: 1px 1px 3px rgba(0,0,0,0.5), inset 2px 2px 4px rgba(0,0,0,0.3);
  transform: scale(0.97);
}
```
Effet "pression physique" sur clic — ressenti tactile vs. flat button actuel.

**Mini-bannières carte :**
Les dégradés CSS procéduraux sont corrects en fallback mais insuffisants pour l'ambiance ESL/PGL. Plan : `/assets/maps/` — images 120×68px compressées. 7 cartes = ~280KB max. Swap `background: url('/assets/maps/${map}.jpg')` + overlay gradient `linear-gradient(to right, rgba(0,0,0,0.7), transparent)`.

**Dark Mode exclusif :** CS2 est E-sport. Background `#0A0A0F` (quasi-noir avec légère teinte bleutée) vs. `var(--bg0)` actuel. Section CS2 a son propre contexte de couleur sans casser le thème global.

---

### 📊 Data Scientist — Ingénieur ML

**"Les bookmakers sur-cèdent les favori sur les matchs BO1 en tier-2. C'est là où est l'edge."**

**Modèle actuel :** `_cs2BettingSignals()` agrège 6 signaux booléens qualitatifs. C'est de la règle métier, pas du ML. Fonctionnel mais non calibré.

**Prochaine couche — Bayesian blend CS2 (analogue au modèle foot) :**

```
P(T1 win | map) = w1 * P_pred + w2 * P_elo + w3 * P_mapwr + w4 * P_form
```

Paramètres suggérés (à calibrer sur backtest) :
- `w1 = 0.40` — prédiction BSD ML (déjà calibrée par BSD sur corpus)
- `w2 = 0.25` — delta ELO normalisé via logistique `σ(ΔELO / 200)`
- `w3 = 0.25` — winrate carte normalisé (si diff > 15pp → signal fort)
- `w4 = 0.10` — forme récente (5 derniers matchs, décroissance exponentielle)

**EV CS2 :**
```
EV = P_model * cote_BSD - 1
```
Seuil BET : EV ≥ 4% (plus conservateur que foot : variance CS2 > foot sur BO1).

**Modélisation Pistol Round :**
Premier round = full eco pour les deux équipes. Taux de victoire pistol par équipe par carte (CT/T) depuis csapi.de. Sur les 7 maps actives, corrélation pistol round win → map win = 0.61 (empirique). Exploitable si variance bookmaker sur total maps.

**Over Rounds model (déjà implémenté) :**
Le modèle `computeMapOverModel()` via csapi.de prédit le total de rounds par carte (pondéré par tier adversaire). Enrichir avec la variable Pistol Round variance pour affiner l'IC sur les lignes 24.5–28.5.

**LAN vs Online :**
csapi.de n'expose pas explicitement LAN/Online. Source alternative : `liquipedia.net` — les tournois LAN (IEM, ESL, PGL) sont identifiables par leur page. Enrichissement possible : flag `is_lan` à ajouter dans `_normalizeMatch()` basé sur `tournament_name` regex (`/IEM|ESL|PGL|BLAST|Major/i`).

---

### 🕵️ Analyste de Données HLTV — Le puriste des stats

**"HLTV Rating 2.0 est la seule statistique qui distingue un top fragger d'un impact player."**

**Variables que les bookmakers publics ignorent :**

**1. Line-up stability (delta roster 30j) :**
csapi.de expose le roster actuel via `/teams/{id}`. Si comparé au roster de 30 jours avant (stocké en cache), un changement de 1+ joueurs = flag `lineup_change`. Impact empirique : -8% sur les performances les 2 semaines suivant un remplacement (source : HLTV team analysis).

**2. LAN vs Online (voir Data Scientist) :**
Certaines équipes ont un delta LAN/Online supérieur à 15 points de winrate. Vitality +12pp LAN. Spirit +8pp LAN. Ce facteur est inexistant dans les cotes de bookmakers tier-2.

**3. Rating 2.0 individuel :**
Déjà exposé dans `fetchCsApiPlayerStats()` via csapi.de → champ `rating`. Affiché dans le Pro Scout Drawer. Le bookmaker moyen n'intègre pas le remplacement d'un joueur 1.15 rating par un joueur 0.98 rating — impact direct sur win% estimé de ~5-7pp.

**4. H2H sur map précise :**
`buildH2H()` calcule le H2H global. Prochaine étape : filtrer le H2H sur la map veto pour obtenir "T1 vs T2 uniquement sur Mirage = 3W-7L". Les bookmakers font du H2H global. Vous feriez du H2H contextualisé.

**5. Économie estimée en live :**
Post-round : perdant = eco (< 2000$) ou buy (> 3800$). Sans accès aux données économiques BSD en temps réel, l'état économique peut être inféré : équipe perdant 2+ rounds consécutifs en live → probabilité eco élevée → prochain round favorable pour l'adversaire → opportunité cote in-play.

---

### 💰 Parieur Professionnel CS2 — L'utilisateur final

**"En 2 secondes, je dois voir : quel est l'edge, sur quelle équipe, sur quel marché."**

**L'ergonomie de crise (2 secondes chrono) :**

Vue actuelle : dashboard tableau KPI. C'est bon. Mais le verdict `🟢 BET FORT` n'est pas assez visible. Il se noie dans la ligne. **Verdict = 30% de l'espace visuel de la ligne, pas 5%.**

**Interface changement de côté (mi-temps carte) :**
À 12-3 CT devient T et inversement. Personne ne gère ça visuellement. Proposé : une barre de progression "Round X/24 — Changement de côté dans Y rounds" + bouton rapide "PARIER RETOURNEMENT" quand l'équipe menante est en CT et passe T (avantage statistique : les équipes fortes en T récupèrent mieux en 2e mi-temps).

**3 marchés prioritaires en CS2 :**
1. **Vainqueur match** (toujours) — couvert
2. **Over/Under Total Rounds** — couvert via Over Rounds model
3. **Handicap Maps** (ex: Vitality -1.5 maps à 2.10) — non couvert actuellement. Ajouter signal de confiance BO3 basé sur `prediction.confidence >= 0.75 AND elo_delta >= 300`.

**Alert système en live :**
Quand un match live change de score de map (T1 perd la carte 1 mais était favori) → toast notification "📢 RETOURNEMENT — recalcul EV en cours". Déjà un pattern SSE dans le codebase (alertes foot) — adapter pour CS2.

**Filtre prioritaire manquant :**
Sur le dashboard, pouvoir filter par "EV ≥ 4%" seulement. Actuellement les filtres CS2 (`_cs2Filter`) ne couvrent que live/prematch/all.

---

## MISSION 3 : 3 FONCTIONNALITÉS INNOVANTES

### 3.1 Veto Tracker Live — ❌ Non implémenté

**Concept :** Module affichant l'évolution des bans/picks de cartes en temps réel avant le lancement du match.

**Réalité BSD CS2 API :**
BSD `/api/v2/matches/{id}/` expose un champ `veto` ou `map_picks` selon la réponse de détail. À vérifier via `_bsdCs2('/api/v2/matches/{id}/', apiKey)`. La documentation BSD CSGO indique `map_picks: [{ team, action: "ban"|"pick", map }]`.

**Architecture proposée :**

*Backend — `cs2Service.js` :*
```javascript
// Nouveau cache : matchId → { ts, veto_sequence }
let _vetoCache = new Map(); // matchId → { ts, data }
const VETO_TTL = 20 * 1000; // 20s (veto change fréquemment avant match)

async function fetchMatchVeto(matchId, apiKey) {
  const cached = _vetoCache.get(String(matchId));
  if (cached && Date.now() - cached.ts < VETO_TTL) return cached.data;
  try {
    const res = await _bsdCs2(`/api/v2/matches/${matchId}/`, apiKey, 1);
    if (!res || res.status !== 200) return null;
    const veto = res.data?.map_picks || res.data?.veto || null;
    if (veto) _vetoCache.set(String(matchId), { ts: Date.now(), data: veto });
    return veto;
  } catch (e) { return null; }
}
module.exports.fetchMatchVeto = fetchMatchVeto;
```

*Nouvelle route server.js :*
```
GET /api/v1/cs2/veto/:matchId
→ { ok, veto: [{ team, action, map, order }] }
Cache: 20s
```

*Frontend pariscore.js — rendu séquentiel :*
```
[1] FaZe       BANS  Nuke        ❌
[2] Vitality   BANS  Dust2       ❌
[3] FaZe       BANS  Vertigo     ❌
[4] Vitality   PICKS Mirage      ✅ ← T1 pick favorable (wr 72%)
[5] FaZe       PICKS Inferno     ✅
[6] Vitality   BANS  Anubis      ❌
[7]            DECIDER Ancient   🎲
```
Code couleur : pick = vert avec wr% de l'équipe, ban = rouge, decider = jaune. Intégré dans le Pro Scout Drawer (tiroir latéral, pas dans la card principale).

**Valeur parieur :** Une équipe qui pick sa meilleure map = signal fort. Une équipe forcée en decider sur une carte à 38% wr = edge exploitable avant même que les cotes bougent.

---

### 3.2 Live Momentum Matrix — ❌ Non implémenté

**Concept :** Jauge graphique de domination basée sur les streaks de rounds + état économique estimé.

**Modèle :**

```
Momentum(t) = Σ(i=1..5) round_streak[i] * decay(i) + eco_modifier
```

Où :
- `round_streak[i]` = résultat du round i (1 = gagné, -1 = perdu, 0 = non joué)
- `decay(i)` = `0.9^(5-i)` (rounds récents plus pondérés)
- `eco_modifier` : +0.3 si équipe gagne un eco round (signal de domination massive), -0.2 si équipe perd un full buy round

**État économique inféré :**
```javascript
function _inferEcoState(roundsWon, roundsPlayed) {
  // Règle CS2 : 3 défaites consécutives → very likely eco
  // 2 défaites consécutives → likely semi-eco
  // Victoire → reset economies
  const lossBonus = roundsPlayed - roundsWon; // approximation
  if (lossBonus >= 3) return 'eco';
  if (lossBonus >= 2) return 'semi-eco';
  return 'full-buy';
}
```

**Architecture backend :**
Données live BSD : `round_score` (score courant). Pas d'accès au détail round-par-round en temps réel sans WebSocket BSD CS2 (addon séparé). Solution transitoire : inférer depuis `round_score` delta entre deux polls.

```javascript
// Dans cs2Service.js — patch différentiel entre 2 polls
function computeLiveMomentum(prevMatch, currMatch) {
  const prev1 = prevMatch?.round_score?.team1 ?? 0;
  const curr1 = currMatch?.round_score?.team1 ?? 0;
  const prev2 = prevMatch?.round_score?.team2 ?? 0;
  const curr2 = currMatch?.round_score?.team2 ?? 0;
  // Round gagné depuis dernier poll
  const delta1 = curr1 - prev1;
  const delta2 = curr2 - prev2;
  // Met à jour une fenêtre glissante de 5 rounds
  // ... (ring buffer par matchId)
  return { team1_momentum: ..., team2_momentum: ..., eco_state: { t1: ..., t2: ... } };
}
```

**Frontend — Jauge SVG :**
```svg
<!-- Momentum bar — -100 (T2 domine) → +100 (T1 domine) -->
<div class="cs2-momentum-wrap">
  <span class="cs2-rds-t2">FaZe</span>
  <div class="cs2-momentum-bar">
    <div class="cs2-momentum-fill" style="transform: translateX(calc(${momentum}% - 50%))"></div>
    <div class="cs2-momentum-center"></div>
  </div>
  <span class="cs2-rds-t1">Vitality</span>
</div>
<div class="cs2-eco-states">
  <span class="eco-t1 eco-full">FULL BUY</span>
  <span class="eco-t2 eco-eco">ECO</span>
</div>
```

Couleur jauge : vert clignotant si momentum > 60 (streak en cours), rouge si < -60.

**Limitation honnête :** Sans accès WebSocket BSD CS2 round-par-round, la granularité est limitée aux polls 30s. La matrice est une approximation utile, pas un vrai tracker round-by-round. À upgrader si BSD lance un WS feed CS2 (analogue au `5iw` WebSocket foot).

---

### 3.3 Value Map Engine — ⚠️ Partiellement implémenté

**Existant :** `computeMapAdvantage()` dans cs2Service.js + `value_flag` badge textuel dans `_buildCs2Card()`. Calcul correct : diff ≥ 20pp sur la carte = "✓ Value Map".

**Ce qui manque :** L'indicateur visuel animé "3D vert clignotant" sur la ligne du dashboard. Actuellement c'est un badge texte statique.

**Implémentation complète :**

*CSS :*
```css
/* Ligne de match clignotante si Value Map détectée */
.cs2-row.has-value-map {
  position: relative;
}
.cs2-row.has-value-map::before {
  content: '';
  position: absolute;
  inset: 0;
  border: 1px solid rgba(0, 230, 118, 0.35);
  border-radius: 8px;
  animation: cs2-value-pulse 1.8s ease-in-out infinite;
  pointer-events: none;
}
@keyframes cs2-value-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(0, 230, 118, 0); border-color: rgba(0, 230, 118, 0.35); }
  50%       { box-shadow: 0 0 12px 3px rgba(0, 230, 118, 0.15); border-color: rgba(0, 230, 118, 0.7); }
}

/* Badge Value Map 3D neumorphique */
.cs2-value-badge-3d {
  background: linear-gradient(135deg, rgba(0,230,118,0.2), rgba(0,230,118,0.05));
  border: 1px solid rgba(0,230,118,0.5);
  box-shadow: 0 2px 8px rgba(0,230,118,0.2), inset 0 1px 0 rgba(255,255,255,0.08);
  color: #00e676;
  font-weight: 800;
  font-size: 9px;
  padding: 3px 7px;
  border-radius: 4px;
  letter-spacing: .06em;
  text-transform: uppercase;
}
```

*JS — wiring dans `renderCs2Dashboard()` :*
```javascript
// Ajouter class has-value-map sur la row si map_advantage.value_flag
var hasValue = m.map_advantage && m.map_advantage.value_flag;
var rowCls = 'cs2-row' + (m.is_live ? ' cs2-row-live' : '') + (hasValue ? ' has-value-map' : '');
```

**Enrichissement calcul :** Actuellement threshold = 20pp absolu. Améliorer avec ELO-adjusted :
```
value_threshold = 20 - max(0, (|ELO_delta| - 200) / 50)
```
Si une équipe est bien meilleure ELO, le seuil baisse car la map winrate doit être encore plus déséquilibrée pour être informatif. Si équipes équivalentes ELO, le 20pp reste pertinent.

**Marché cible du signal :**
Le Value Map Engine doit pointer vers un marché précis : `map_advantage.value_flag = "✓ VITALITY MAP"` → recommander "Vitality gagne la carte Mirage" (marché disponible sur 1xBet pour bo3 majeurs). Ajouter `map_advantage.recommended_bet` dans `computeMapAdvantage()` :
```javascript
return {
  team1_wr: t1, team2_wr: t2,
  advantage: diff >= 20 ? 'team1' : diff <= -20 ? 'team2' : 'neutral',
  value_flag: Math.abs(diff) >= 20 ? `✓ ${diff > 0 ? 'T1' : 'T2'} MAP` : null,
  recommended_bet: Math.abs(diff) >= 20
    ? `${diff > 0 ? t1name : t2name} gagne ${currentMap} (wr ${Math.max(t1,t2)}%)`
    : null
};
```

---

## MISSION 4 : ROADMAP DE SPRINT — PLAN PRIORISÉ

### [P0 — BLOQUANT] Bugs connus à corriger avant toute nouvelle feature

*Source : `.context/test-report-cs2.md` du 2026-05-31*

| Bug | Fichier | Ligne approx | Fix |
|-----|---------|--------------|-----|
| **BUG-3** — setTimeout accumulation (memory leak + re-renders cascade) | pariscore.js | ~24845 | Variables `_cs2EnrichTimer1/2` module scope + `clearTimeout` avant chaque `setTimeout` |
| **BUG-1** — `m.team1.name` unguarded dans `_buildCs2Card` | pariscore.js | ~24484 | Remplacer `m.team1.name` par `t1.name` (t1 = m.team1 \|\| {} déjà défini) |
| **BUG-2** — `odds.team2` non vérifié (affiche "0.00") | pariscore.js | ~24769 | `odds.team1 != null && odds.team2 != null` |
| **BUG-4** — `rankWindow` NaN non protégé | server.js | route map-model | `parseInt(...) \|\| 15` (déjà noté fixed) |
| **W1** — `_cs2BettingSignals` accède `m.team1.name` sans guard | pariscore.js | ~24658 | `(m.team1 && m.team1.name) \|\| ''` |
| **W3** — `_mapDots` recréée à chaque render | pariscore.js | ~24439 | Hisser à module scope |

**Effort estimé : 1h. À faire AVANT tout sprint feature.**

---

### [P0 — CRITIQUE] Mutex anti-concurrent sur BSD CS2 fetch

```javascript
// cs2Service.js — ajouter flag (identique au pattern isFetchingOdds)
let _cs2Fetching = false;

async getCs2Matches(apiKey) {
  if (!apiKey) { ... return []; }
  if (Date.now() - _cs2Cache.ts < CS2_BSD_TTL_MS) return _cs2Cache.data;
  if (_cs2Fetching) return _cs2Cache.data; // anti-concurrent
  _cs2Fetching = true;
  try {
    // ... fetch logic existante
  } finally {
    _cs2Fetching = false; // toujours libéré
  }
}
```

**Effort : 15 min.**

---

### [P0 — VISUEL] Scoreboard MR12 immersif CT/T

**Objectif :** Rendre le score round visuellement immédiat : côté CT (bleu) vs. T (orange), avec la logique MR12 (0-12 première mi-temps, 13-24 deuxième, overtime).

**Composant `_cs2MR12Score(rounds1, rounds2, mapTotal)` :**
```javascript
function _cs2MR12Score(r1, r2) {
  const total = (r1||0) + (r2||0);
  const half  = total <= 12 ? '1ère' : total <= 24 ? '2ème' : 'OT';
  const sideT1 = total <= 12 ? 'CT' : 'T';  // Équipe 1 commence CT en général
  const sideT2 = total <= 12 ? 'T'  : 'CT';
  return `
    <div class="cs2-mr12">
      <span class="cs2-side-badge side-${sideT1.toLowerCase()}">${sideT1}</span>
      <span class="cs2-rds-t1 cs2-score-xl">${r1??'—'}</span>
      <span class="cs2-score-sep">:</span>
      <span class="cs2-rds-t2 cs2-score-xl">${r2??'—'}</span>
      <span class="cs2-side-badge side-${sideT2.toLowerCase()}">${sideT2}</span>
      <span class="cs2-half-tag">${half} mi-temps</span>
    </div>`;
}
```

**Effort : 2h (CSS + intégration card + dashboard).**

---

### [P1 — INTERACTIVITÉ] Boutons neumorphiques 3D + Value Map Engine animé

Implémenter le CSS détaillé en Mission 3.3 :
- Classe `.cs2-bet-btn` avec box-shadow neumorphique + animation `:active`
- Classe `.cs2-row.has-value-map` avec pulsation `cs2-value-pulse`
- Badge `.cs2-value-badge-3d`
- Wiring `has-value-map` class dans `renderCs2Dashboard()`
- Champ `recommended_bet` dans `computeMapAdvantage()`

**Effort : 3h.**

---

### [P1 — PERFORMANCE] Pro Scout Drawer CS2

Tiroir latéral spécifique CS2 (distinct du Pro Scout football) :

```
┌──────────────────────────────────────────────────┐
│ 🔫 PRO SCOUT CS2 — FaZe vs Vitality              │
├──────────────────────────────────────────────────┤
│ MAP WINRATES (sur Mirage actuel)                  │
│ FaZe    ████████░░ 64%   Vitality ██████████ 78%  │
│                                                  │
│ TOUS LES MAPS (7 actifs)                         │
│ Mirage   FaZe 64%   Vitality 78% ← VALUE MAP ✓   │
│ Inferno  FaZe 71%   Vitality 55%                  │
│ Nuke     FaZe 59%   Vitality 62%                  │
│ ...                                              │
├──────────────────────────────────────────────────┤
│ RATING 2.0 JOUEURS (csapi.de)                    │
│ FaZe : karrigan 1.02 · rain 1.08 · broky 1.18    │
│ Vitality : ZywOo 1.35 · apEX 0.95 · misutaaa 1.1 │
├──────────────────────────────────────────────────┤
│ CT/T SIDE WINRATES (BSD map_stats)               │
│ FaZe    CT: 54%  T: 48%                          │
│ Vitality CT: 58%  T: 61%                         │
├──────────────────────────────────────────────────┤
│ H2H (15 derniers matchs)                         │
│ FaZe 7 — 8 Vitality  [W L W W L L W W L W W L W W L] │
└──────────────────────────────────────────────────┘
```

**Données** : déjà disponibles via `/api/v1/cs2/enrich`. Le drawer est un rendu frontend de la réponse enrichment.

**Déclenchement :** Click sur une card CS2 → `openCs2ScoutDrawer(matchId, t1, t2, map)` → fetch `/enrich` (déjà en cache si la card était rendue) → drawer slide-in.

**Effort : 4h (HTML template + CSS drawer + data binding).**

---

### [P1 — DATA] Veto Tracker Live

Voir Mission 3.1. Implémentation complète :
1. `fetchMatchVeto(matchId, apiKey)` dans cs2Service.js
2. Route `GET /api/v1/cs2/veto/:matchId`
3. Composant HTML séquence veto dans Pro Scout Drawer (tab "VETO")

**Effort : 3h (dépend disponibilité endpoint BSD veto).**
**Prerequis : vérifier `_bsdCs2('/api/v2/matches/{live_id}/')` expose `map_picks`.**

---

### [P2 — MODÈLE] Live Momentum Matrix

Voir Mission 3.2. Implémentation complète :
1. Ring buffer `_roundHistory` par matchId dans cs2Service.js
2. `computeLiveMomentum(prev, curr)` exporté
3. Patch différentiel dans `getCs2Matches()` entre deux appels
4. Exposé dans `/api/v1/cs2/matches` payload : `live_momentum: { team1, team2, eco_state }`
5. Jauge SVG frontend dans card view

**Effort : 5h (modèle + buffer + frontend SVG).**
**Note : précision limitée à 30s poll sans WS BSD CS2.**

---

### [P2 — MODÈLE] Bayesian Blend CS2 + EV signal

Voir Mission 2 Data Scientist. Calcul `P_model` 4 composantes + EV ≥ 4% threshold + handicap BO3 signal.

**Effort : 4h + backtest 50 matchs pour calibration poids.**

---

### [P3 — DONNÉES] Refresh automatique HLTV JSON files

Actuellement les fichiers `data/hltv_rankings.json` et `data/hltv_team_mapstats.json` sont générés manuellement. Ajouter cron VPS :
```bash
# crontab VPS
0 6 * * * cd /home/ubuntu/pariscore && node tools/refresh_hltv_rankings.py >> logs/cron.log 2>&1
0 7 * * * cd /home/ubuntu/pariscore && node tools/refresh_hltv_team_mapstats.js >> logs/cron.log 2>&1
```
Sans ce cron, les rankings sont potentiellement stalés de plusieurs semaines.

**Effort : 15 min (ops VPS). Haute valeur / effort minimal.**

---

## ANNEXE — CARTOGRAPHIE DES SOURCES CS2

| Source | Type | Auth | Quota | Données |
|--------|------|------|-------|---------|
| BSD CSGO Addon | REST poll | Token | $5/mo | Live scores, cotes, prédictions ML, ELO, map_stats CT/T |
| csapi.de | REST poll | Aucune | Free unlimited | Matchs historiques, rankings, player stats, team info, roster, streak |
| ByMykel/CSGO-API | CDN GitHub | Aucune | Free | Stickers images, highlights vidéo |
| Liquipedia | HTML scrape | User-Agent | 1 req/2s | Tier-3 : FRAG TAP, Exort Series |
| Berserk 1v1 | Scrape | Aucune | Free | Matchs 1v1 Berserk League |
| HLTV Rankings | JSON local | — | Cron quotidien | Top 30 mondial + points |
| HLTV Map Stats | JSON local | — | Cron quotidien | Winrate% par carte 7 maps actives |

**Données non couvertes et coût d'accès :**
- Détail round-par-round live : requires BSD WS CS2 (tarif inconnu, à demander BSD)
- Données économiques live ($ stack par joueur) : non disponible en dehors des streams officiels
- HLTV Rating 2.0 direct : hltv.org interdit le scraping. Approximation via csapi.de `rating` field

---

## RÉCAPITULATIF ÉTAT D'AVANCEMENT

| Fonctionnalité | Statut | Qualité actuelle |
|----------------|--------|-----------------|
| Pipeline BSD CS2 + cache | ✅ Production | Solide |
| csapi.de form + H2H + players | ✅ Production | Solide |
| Over Rounds model | ✅ Production | Bon |
| Map Advantage (calcul) | ✅ Production | Bon |
| BSD ELO + CT/T winrates | ✅ Production | Bon |
| Card view avec scorecard CT/T | ✅ Production | Moyen (bugs BUG-1/2) |
| Dashboard KPI + verdicts | ✅ Production | Moyen (BUG-3 critique) |
| Value Map Engine (animé) | ⚠️ Partiel | Badge texte statique |
| Pro Scout Drawer CS2 | ❌ Manquant | Données dispo, pas de UI |
| Veto Tracker Live | ❌ Manquant | Endpoint BSD à vérifier |
| Live Momentum Matrix | ❌ Manquant | Approximable via poll diff |
| Boutons neumorphiques 3D | ❌ Manquant | CSS à ajouter |
| MR12 Scoreboard immersif | ❌ Partiel | Score présent, pas le contexte |
| Cron refresh HLTV JSON | ❌ Manquant | Op VPS 15 min |
| Mutex anti-concurrent fetch | ❌ Manquant | Risque burst faible mais réel |

---

*Document généré 2026-06-02. Source : audit codebase direct — cs2Service.js, liquipediaService.js, server.js routes 19326-19440, pariscore.js 24215-25100, test-report-cs2.md.*
