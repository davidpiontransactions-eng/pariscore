# AUDIT — Métrique Aces & Double Faults

**Date** : 18/06/2026  
**Auteur** : CTO / Data Engineering  
**Contexte** : Incohérence signalée par l'équipe produit sur le metric "Aces & Double Faults"  
**Périmètre** : pipeline complet — collecte → calcul → affichage (server.js + pariscore.js)

---

## Résumé Exécutif

**4 sources de données distinctes** produisent des valeurs d'ace% divergentes (Sackmann SQL, Tennis Abstract matchmx, BSD live, Aiscore PBP). Les **double fautes** sont collectées mais **jamais intégrées** dans un metric prédictif — uniquement affichées en brut dans les stats live. Un **bug d'affichage** dans le panneau H2H affiche `1250%` au lieu de `12.5%`. Architecture incompatible avec l'attente produit d'un metric unifié "Aces & Double Faults".

**Priorité** : P1 (données incohérentes + affichage erroné + absence métier)

---

## État des Lieux — 4 Pipelines Parallèles

### Source A — Sackmann (SQLite locale, `tennis_matches` table)

| Champ | Détail |
|-------|--------|
| **Fonction** | `computePlayerAceRate()` (l. 26915) |
| **Calcul** | `SUM(w_ace,l_ace) / SUM(w_svpt,l_svpt) × 100` |
| **Échelle** | 0-100 (ex: `12.50` = 12.5%) |
| **Consommateur** | `computeTennisGamesOverUnder()` → `gamesOU.aceP1/aceP2` |
| **Couverture** | ATP + WTA historiques Sackmann |
| **Fiabilité** | ✅ Haute (données consolidées, 15+ ans) |
| **Échantillon min** | 5 matchs |

**Code** (l. 26915-26942) :
```javascript
function computePlayerAceRate(playerName, tour, surface = 'ALL', lastN = 200) {
  // SQL SUM(w_ace,l_ace) / SUM(w_svpt,l_svpt) via tennis_matches
  const res = { ace_pct: parseFloat(((ace / svpt) * 100).toFixed(2)), sample: n };
  return res;
}
```

### Source B — Tennis Abstract (matchmx, scraping `player-classic.cgi`)

| Champ | Détail |
|-------|--------|
| **Fonction** | `computeMostAcesMatchup()` (l. 27576) |
| **Calcul 1** | `_koaAceProfile()` → `ace52 / svpt52 × 100` (base 52 sem) |
| **Calcul 2** | `_koaReturnProfile()` → RPW% + Brk% de l'adversaire |
| **Ajustement** | `ace_final = ace_pct_adj × redCoef(return_adversaire)` |
| **Échelle** | 0-100 (ex: `12.50`) |
| **Consommateur** | `predictions.most_aces` + tooltip King of Aces |
| **TTL cache** | 24h (table `tennis_koa_matchmx`) |
| **Fiabilité** | ⚠️ Moyenne (dépend du scraping Tennis Abstract — risque Cloudflare 403) |

**Sortie typique** :
```javascript
{
  favorite: "Jannik Sinner",
  pct: 68.5,                     // P(favori > adversaire)
  p1: { ace_pct_raw: 14.2, ace_pct_adj: 13.8, form_factor: 0.97 },
  p2: { ace_pct_raw: 8.1, ace_pct_adj: 8.5, form_factor: 1.05 },
  method: 'ace_v1_ta_matchmx',
  source: 'tennisabstract'
}
```

### Source C — Serve Dominance Index (mêmes données matchmx, calcul différent)

| Champ | Détail |
|-------|--------|
| **Fonction** | `computeServeDominance()` (l. 36652) |
| **Calcul** | `ace / svpt × 100` (sur 30 matchs max) |
| **Échelle** | 0-100 (ex: `12.5`) |
| **Consommateur** | `serve_dominance.p1.ace_pct` + Radar chart + H2H panel |
| **Source** | Tennis Abstract matchmx (même data que KoA) |
| **Fiabilité** | ⚠️ Moyenne (même dépendance scraping TA) |

**Code** (l. 36673) :
```javascript
const acePct = (ace / svpt) * 100;  // déjà en 0-100
// ...
ace_pct: parseFloat(acePct.toFixed(1)),  // ex: 12.5
```

### Source D — BSD Live Stats (API temps réel)

| Champ | Détail |
|-------|--------|
| **Champs** | `m.p1_aces`, `m.p2_aces`, `m.p1_double_faults`, `m.p2_double_faults` |
| **Endpoint** | `_bsd_stats` (l. 22439-22441) |
| **Type** | **Compteurs absolus** (pas des %) |
| **Consommateur** | Stats live, per-set breakdown, H2H stats sheet |
| **Fiabilité** | ✅ Haute (données officielles du scoreboard) |
| **Per-set** | `aces_per_set[]`, `double_faults_per_set[]` (l. 22492-22521) |

**Pas de double faults calculées nulle part ailleurs** — uniquement des compteurs bruts.

---

## 🔴 Bug #1 : H2H Panel affiche `1250% aces` au lieu de `12.5%`

**Fichier** : `pariscore.js` — ligne 6759-6763

```javascript
// ligne 6759 : ace1 = 12.5 (déjà en %)
var ace1 = (sd.p1 && sd.p1.ace_pct != null) ? sd.p1.ace_pct : (p1.ace_pct || null);

// ligne 6763 : Multiplie par 100 une valeur déjà en %
adEl1.textContent = ((Number(ace1) * 100).toFixed(1)) + '% aces';
```

**Résultat** : `12.5 × 100 = 1250` → affiche `1250.0% aces`

**Cause racine** : `ace_pct` de `computeServeDominance()` est déjà un pourcentage 0-100 (vérifié l. 36673 : `(ace / svpt) * 100`). Le code H2H traite la valeur comme une fraction 0-1 et re-multiplie par 100.

**Même bug** potentiel ligne 6767 pour le joueur 2.

**Correctif** :
```diff
- adEl1.textContent = ((Number(ace1) * 100).toFixed(1)) + '% aces';
+ adEl1.textContent = (Number(ace1).toFixed(1)) + '% aces';
```

---

## 🟡 Bug #2 : Double Faults absentes de tout metric prédictif

**État actuel** :
- ✅ Collectées en live : `_bsd_stats.p1_df`, per-set `set.p1_df`
- ✅ Affichées dans le tableau des stats par set (Aces / DF par set)
- ✅ Présentes dans le stats sheet du match fini (`serve_stats`)
- ❌ **Jamais utilisées** dans `computeAllMetrics`, `computeMostAcesMatchup()`, ou tout autre modèle prédictif
- ❌ Absentes du radar chart, du SDI, du King of Aces

**Impact** : Le "ratio de dominance au service" annoncé dans le H2H (`4e) Aces / DF — ratio de dominance au service`) **ne tient compte que des aces**, pas des double fautes. Un joueur qui sert fort mais commet 10 double fautes aura le même score qu'un joueur propre.

---

## 🟡 Bug #3 : Sources multiples produisent des valeurs divergentes

| Source | Valeur typique si joueur "gros serveur" | Pourquoi différent |
|--------|----------------------------------------|-------------------|
| Sackmann (ace_pct) | 14.2% | 200 derniers matchs, toutes surfaces |
| KoA ace_pct_adj | 13.8% | 52 sem, ajusté forme récente + retour adverse |
| SDI ace_pct | 14.2% | 30 matchs, pas d'ajustement |
| BSD live (compteur) | 8 aces dans le match | Absolu, pas un % |

**Conséquence** : Le même joueur peut avoir :
- H2H panel : `1250%` (bug #1)
- Radar chart (axe "Aces") : `14.2 × 5 = 71`
- Pro panel statline "ACES %" : `14.2`
- King of Aces tooltip : `13.8%`
- Stats sheet : `8 aces`

Ces valeurs **ne sont pas contradictoires** (sources différentes), mais l'utilisateur ne comprend pas pourquoi elles diffèrent → perception d'incohérence.

---

## 🟢 Bug #4 : Radar chart scaling arbitraire

Ligne 8289 (`pariscore.js`) :
```javascript
clamp((a.ace_pct || 0) * 5),  // Aces (≈20% → 100)
```

- Suppose que le max réaliste est 20% d'aces → 20 × 5 = 100
- Si un joueur fait 25% d'aces (Isner, Opelka sur gazon), ça sature → perte d'information
- Aucun commentaire/documentation sur ce choix de scaling

---

## Problèmes Architecture

### Problème A : Pas de métrique unifiée "Aces & Double Faults"

Le nom du display "Aces/DF" suggère une métrique combinée. En réalité :
```
Aces/DF display = ace_pct (SDI) uniquement
                 = ∑aces / ∑svpt × 100
                 = ignore totalement les double faults
```

### Problème B : Inconsistance d'échelle entre back-end et front-end

| Champ | Échelle back-end | Échelle attendue front-end |
|-------|-----------------|---------------------------|
| `sd.p1.ace_pct` | 0-100 (12.5) | Variable (×1, ×5, ×100 selon contexte) |
| `ma.p1.ace_pct_adj` | 0-100 (13.8) | Affiche avec `%` (correct) |
| `player.ace_pct` | 0-100 (serve/index) | Jamais utilisé comme fallback |

### Problème C : Dépendance Tennis Abstract sans fallback

Le SDI et le KoA utilisent les `matchmx` de Tennis Abstract. Si le scraping échoue (Cloudflare 403) :
- `computeServeDominance()` retourne `null` → pas de SDI, pas d'ace% dans le pro panel
- `computeMostAcesMatchup()` retourne `null` → pas de marché "Most Aces"
- **Aucun fallback vers Sackmann** pour ces métriques

---

## Propositions de Correction

### P0 — Correction immédiate (bug H2H)

```diff
  // pariscore.js ligne 6763
- adEl1.textContent = ((Number(ace1) * 100).toFixed(1)) + '% aces';
+ adEl1.textContent = (Number(ace1).toFixed(1)) + '% aces';
```

Idem ligne 6767 pour joueur 2.

### P1 — Nouveau metric : "Aces & Double Fault Ratio" (F squat)

**Proposition** : Créer un ratio combiné dans `computeServeDominance()` :

```javascript
// Nouveau champ dans le return de computeServeDominance()
// Définition : ADFR = (aces - double_faults) / svpt × 100
// Une valeur positive = le joueur gagne plus de points gratuits qu'il n'en perd
// Une valeur négative = les DF annulent l'avantage des aces

// Dans computeServeDominance() :
// Nécessite d'ajouter les DF aux rows Parsing matchmx
// (les matchmx Tennis Abstract n'ont pas de champ DF — c'est le problème)

// Solution B — Fallback : utiliser Sackmann pour les DF
// CREATE VIEW tennis_adfr AS
// SELECT player,
//   (SUM(w_ace) + SUM(l_ace) - SUM(w_df) - SUM(l_df)) / SUM(svpt) * 100 AS adfr
// FROM tennis_matches GROUP BY player;
```

**Problème** : Les données Tennis Abstract (`matchmx`) ne contiennent **pas** les double faults. Seule la base Sackmann locale et la BSD live ont les DF. Le calcul combiné devra donc forcément utiliser Sackmann comme source primaire (ou BSD pour les matchs en direct).

### P2 — Unification des sources d'ace%

Créer un point d'entrée unique `getPlayerAcePct(player, tour, surface)` qui :
1. Priorité : Sackmann (`computePlayerAceRate`) — plus fiable, plus d'historique
2. Fallback : Tennis Abstract matchmx (`_koaAceProfile`) — si Sackmann insuffisant (< 5 matchs)
3. Indique la source dans la réponse → le front-end peut afficher "Ace% (TA)" vs "Ace% (ATP)"

```javascript
function getPlayerAcePct(player, tour, surface) {
  const sackmann = computePlayerAceRate(player, tour, surface);
  if (sackmann && sackmann.sample >= 5) return { ...sackmann, source: 'sackmann' };
  // fallback TA matchmx
  const cached = getKoaMatchmxCached(player, tour);
  if (cached) {
    const profile = _koaAceProfile(cached.rows, surface);
    if (profile) return { ace_pct: profile.ace_pct_raw, sample: profile.sample, source: 'tennisabstract' };
  }
  return null;
}
```

### P3 — Standardiser l'affichage front-end

| Composant | Action |
|-----------|--------|
| Pro panel "ACES %" | Garder `sd.p1.ace_pct` affiché tel quel (correct) |
| Radar chart "Aces" | Remplacer `× 5` par `Math.min(100, a.ace_pct * 4)` si 25% max, ou mieux : normalisation dynamique |
| H2H "Aces / DF" | Corriger le × 100, ajouter les DF (viser 2 colonnes : "Aces %" + "DF ratio") |
| King of Aces tooltip | Garder tel quel (correct + source annotée) |

### P4 — Fallback Sackmann pour SDI/ace% quand TA indisponible

Dans `computeAllMetrics` (l. 37038-37055) : si `getKoaMatchmxCached` échoue, basculer sur `computePlayerAceRate` (Sackmann) pour alimenter les métriques dérivées (SDI, O/U jeux, etc.).

### P5 — Ajouter un "Serve Discipline Index"

Nouvelle métrique combinant aces ET double faults :
```
SDX = (ace_pct - df_pct) où df_pct = double_faults / svpt × 100
```
- Positif = le joueur domine proprement
- Négatif = risque de double faute élevé sous pression
- Affichable dans le pro panel, radar chart, H2H

Sources : Sackmann (`w_df`, `l_df`) pour l'historique, BSD live pour le match en cours.

---

## Annexe : Cartographie complète du flux de données Aces

```
┌─────────────────────────────────────────────────────────────────┐
│                     SOURCES DE DONNÉES                          │
├────────────────┬────────────────┬────────────────┬──────────────┤
│ Sackmann SQL   │ Tennis Abstract│ BSD API live   │ Aiscore PBP  │
│ tennis_matches │ matchmx (KoA)  │ /matches/{id}/ │ point_by_pt  │
│ w_ace, w_df    │ ace, svpt,     │ p1_aces,       │ stats.Aces,  │
│ l_ace, l_df    │ f1w, f2w       │ p1_double_flts │ DoubleFaults │
├────────┴────────┴────────┴──────────────┤
│        4 FORMATS DIFFÉRENTS             │
│  - Sackmann : champs nommés SQL         │
│  - TA : indices numériques [21],[23]... │
│  - BSD : champs nommés JSON             │
│  - Aiscore : clés textuelles "Aces"     │
├─────────────────────────────────────────┤
│              CONSOMMATEURS              │
├────────────┬───────────┬────────────────┤
│ Prédictions│  Profil   │ Stats Live     │
│ - most_aces│ - SDI     │ - Per-set aces │
│ - O/U jeux │ - Radar   │ - Per-set DF   │
│            │ - H2H     │ - Stats sheet  │
└────────────┴───────────┴────────────────┘
```

---

## Recommandations

1. **Corriger le bug H2H immédiatement** (P0) — `× 100` déjà présent dans la valeur
2. **Créer `getPlayerAcePct()` unifié** (P2) — point d'entrée unique avec source tagging
3. **Ajouter les double faults au modèle** (P1) — via Sackmann `w_df`/`l_df` + création du "Serve Discipline Index"
4. **Normaliser le scaling radar** (P3) — utiliser `Math.min(ace_pct * 4, 100)` avec commentaire
5. **Ajouter fallback Sackmann** (P4) — si TA indisponible, ne pas laisser les métriques nulles
6. **Documenter les sources** dans le tooltip front-end pour chaque affichage d'ace%
