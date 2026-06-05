# Rapport — Top 10 Matchs du Jour (Onglet Tennis)
> PariScore v12.65+ | Brainstorm panel 5 experts | 2026-06-04

---

## 1. Contexte & Objectif

Créer un encart **"Top 10 Matchs du Jour"** dans l'onglet Tennis de PariScore.  
L'encart doit servir **deux audiences simultanément** :

| Audience | Besoin | Mode |
|---|---|---|
| **Parieur sharp** | Meilleure edge calibrée, CLV, steam | `mode=bettor` |
| **Fan / spectateur** | Drama, stars, grands tournois, live | `mode=viewer` |

---

## 2. Panel d'Experts — Synthèse des Contributions

### Dr. Chen — Data Scientist Quant
**Thèse centrale** : l'incertitude prédictive (entropie) + EV validée par Bootstrap IC sont les deux signaux les plus fiables.  
Signal le plus fort : `IC_lower > 0` = seul gate binaire acceptable pour qualifier une value bet en Top 10.

### Sara — Data Architect  
**Thèse centrale** : un score de complétude de données doit agir comme **multiplicateur gate** (≥0.6 requis), pas comme dimension de classement indépendante. L'intérêt utilisateur est mesurable via les hits `api_cache`.

### Marco — Parieur Professionnel (15 ans ATP)
**Thèse centrale** : CLV (Closing Line Value) est le seul prédicteur fiable de rentabilité long terme. Steam move dans le sens du modèle = double confirmation. Prestige = piège.  
Signal le plus fort : ligne bouge contre modèle (Reverse Line Movement) = opportunité +EV maximale.

### Rafael — Ex-ATP Top 100  
**Thèse centrale** : le drama potentiel d'un match se calcule via l'équilibre H2H + l'asymétrie momentum + la surface (clay > hard > grass pour les échanges). Un tiebreak 6-6 en live = bonus dramatique non-linéaire.

### Julie — UX/WebDesigner  
**Thèse centrale** : chaque carte Top 10 doit afficher un **tag de raison** (`VALEUR / DRAMA / EN DIRECT / UPSET / CLASSIQUE / VAPEUR`). Le widget doit être "vivant" — les matchs terminés disparaissent immédiatement, les matchs live remontent.

---

## 3. Données Disponibles (Inventaire Payload)

| Donnée | Source | Statut |
|---|---|---|
| `elo_p1`, `elo_p2` | BSD + calcul interne | ✅ disponible |
| `blended_prob_p1` | `bayesianBlend()` Poisson+Elo+xG | ✅ disponible |
| `bootstrap_uqd.ic_lower / ic_upper` | `computeBootstrapUQDTennis()` | ✅ disponible |
| `reliability_score` | `computeReliabilityScore()` | ✅ disponible |
| `best_edge.ev_pct` | `computeBetSignal()` | ✅ disponible |
| `momentum_score` | BSD WS / Sofascore | ✅ disponible (agrégat) |
| `h2h[]` | `_psLtsFetchH2H()` | ✅ disponible |
| `bookmakers[].movement_p1/p2` | BSD multi-books | ✅ confirmé 2026-06-02 |
| `bookmakers.length` | BSD | ✅ disponible |
| `set_scores[]` | BSD live | ✅ live feed |
| `surface` | BSD match | ✅ disponible |
| `tier` (Grand Slam / ATP500...) | BSD + leagues_config | ✅ disponible |
| `round` (F/SF/QF/R16...) | BSD | ✅ disponible |
| `start_ts` | BSD | ✅ disponible |
| `aces_per_set[][]` | BSD match detail | ⚠️ schema réel capturé, normalizer pending (§9 CLAUDE.md) |
| `momentum_p1 / momentum_p2` (split) | BSD | ⚠️ actuellement agrégat — split à exposer |
| `clv_source: 'pinnacle'` | OddsPapi.io | ❌ pending bd `bjv` signup |

---

## 4. Formule Composite `SCORE_TOP10` (0–100)

### 4.1 Dimensions & Poids

| # | Dimension | Formule | Poids Viewer | Poids Bettor |
|---|---|---|---|---|
| D1 | **Entropie prédictive** | `-( p1×log2(p1) + p2×log2(p2) )` normalisé [0,1] | 20% | 20% |
| D2 | **EV qualifiée IC** | `ev_pct × (1 - ic_width/100) × (ic_lower>0 ? 1 : 0.2) / 15` | 15% | 30% |
| D3 | **Compétitivité Elo** | `(elo_avg/2400) × max(0, 1 - elo_delta/400)` | 15% | 20% |
| D4 | **Prestige / Stakes** | `tier_weight × round_weight` | 20% | 5% |
| D5 | **Urgence temporelle** | Live=1.0, ≤1h=0.9, ≤3h=0.75, ≤12h=0.5, autre=0.2 | 20% | 15% |
| D6 | **Steam line movement** | `abs(movement_p1 ou p2) / 0.15` clamped [0,1] | 10% | 10% |

### 4.2 Bonus Flat (additifs post-pondération)

| Condition | Bonus |
|---|---|
| Match live, set 3+ en cours | +15 pts |
| Tiebreak 6-6 en cours | +10 pts |
| Reverse Line Movement (move contre modèle + EV>5%) | +15 pts (mode bettor) |
| H2H compétitif ≥0.4 ratio sur même surface | +5 pts |

### 4.3 Gate de Qualité Données

```
data_completeness = Σ(has_odds + has_elo + has_h2h + has_aces + has_momentum) / 5
si data_completeness < 0.6 → SCORE_TOP10 × 0.3 (pénalité, pas exclusion)
```

### 4.4 Référence tables poids

```
tier_weight: Grand Slam=1.0, Masters=0.9, ATP500=0.75, ATP250=0.6,
             WTA500=0.65, WTA250=0.5, Challenger=0.4, ITF=0.2

round_weight: F=1.0, SF=0.9, QF=0.8, R16=0.65, R32=0.5,
              R64=0.4, RR=0.6, Q=0.25
```

### 4.5 Tag de Raison (obligatoire)

```
EN DIRECT  → match.status === 'live'
VALEUR     → D_ev > 0.6
VAPEUR     → D_movement > 0.6
CLASSIQUE  → D_stakes > 0.7
DRAMA      → D_entropy > 0.85
UPSET      → elo_delta > 200 (favori ~76%+ win prob)
```

### 4.6 Post-processing : Filtre Diversité

Maximum 3 matchs du même tournoi dans le Top 10. Au-delà, substitution par le prochain meilleur match d'un tournoi différent.

---

## 5. Architecture Technique

### 5.1 Route Backend

```
GET /api/v1/tennis/top10?mode=viewer|bettor&limit=10
```

**Réponse** :
```json
{
  "top10": [
    {
      "matchId": "...",
      "score_top10": 87.3,
      "reason": "EN DIRECT",
      "data_completeness": 0.8,
      "mode": "viewer",
      "scores": {
        "entropy": 0.92,
        "ev_quality": 0.44,
        "elo_competitiveness": 0.77,
        "stakes": 0.72,
        "urgency": 1.0,
        "movement": 0.53
      }
    }
  ],
  "computed_at": 1748992800000,
  "ttl_seconds": 60
}
```

### 5.2 Cron de Calcul

```
Cron 60s → computeScoreTop10() sur tous matchs tennis actifs
         → store dans api_cache key 'top10_tennis_{mode}'
         → TTL 60s (viewer), TTL 30s (bettor — plus sensible aux steam moves)
```

**Contrainte performance** : calcul CPU-bound (Bootstrap × N matchs). Compute dans worker thread ou batch sequentiel avec `setImmediate()` entre items. Sara : ne jamais recalculer par requête client SSE.

### 5.3 Decay sur Fin de Match

```
match.status === 'finished' → SCORE_TOP10 = 0, suppression immédiate du cache top10
```

### 5.4 Intégration avec infrastructure existante

- Réutilise `computeBootstrapUQDTennis()` (server.js) — aucun recalcul
- Réutilise `computeReliabilityScore()` — aucun recalcul
- Réutilise `bayesianBlend()` — aucun recalcul
- Réutilise `api_cache` SQLite — pattern existant
- Mode `bettor` exposé côté frontend via query param → aucune infrastructure nouvelle

---

## 6. Design UI — Spécifications

### 6.1 Emplacement dans l'onglet Tennis

```
[NAV BAR]
[Tennis Tab]
  ┌─────────────────────────────────────┐
  │  🏆 TOP 10 MATCHS DU JOUR          │ ← encart sticky collapsible (haut de page)
  │  [BETTOR | FAN] toggle              │
  │  Card 1 · Card 2 · Card 3 ... →    │ ← scroll horizontal sur mobile
  └─────────────────────────────────────┘
[Tableau matchs existant]
```

### 6.2 Anatomie d'une Card Top 10

```
┌────────────────────────────────┐
│ #1  🔴 EN DIRECT   ATP Masters │  ← rank + tag + tier
│ Djokovic  vs  Alcaraz          │  ← noms joueurs
│ ●●●●●○ 1900       ○●●●●● 2050 │  ← barres Elo visuelles
│ 1-0 | 6-4 | 3-3               │  ← score set live
│ ████████░░  82/100             │  ← score top10 barre
│ 📊 Entropie  💰 Valeur  🔥 H2H│  ← chips mini-dimensions
│           [VOIR →]             │  ← CTA
└────────────────────────────────┘
```

### 6.3 Règles Visuelles Julie

- Tag coloré par catégorie : `EN DIRECT`=rouge, `VALEUR`=vert, `VAPEUR`=orange, `CLASSIQUE`=doré, `DRAMA`=violet, `UPSET`=cyan
- Liste "vivante" : animation slide-out quand match terminé, slide-in quand nouveau match score élevé
- Mobile : scroll horizontal (pas de grille) — cartes 280px min-width
- Toggle `BETTOR | FAN` : repositionne les poids en temps réel via requête `?mode=`
- Max 10 cartes, min 3 (si moins de 3 matchs éligibles, section masquée)

---

## 7. Innovations Identifiées

### 7.1 Court terme (implémentables maintenant)

| Innovation | Auteur | Impact | Effort |
|---|---|---|---|
| Tag de raison per-card | Julie | UX +++ | 2h |
| Bonus tiebreak 6-6 live | Rafael | Engagement live +++ | 1h |
| Mode bettor/viewer toggle | Marco | Segmentation utilisateurs | 3h |
| Score decay → matchs terminés disparaissent | Julie | UX +++ | 1h |
| Filtre diversité tournis (max 3) | Julie | Qualité liste | 2h |
| Gate data_completeness < 0.6 | Sara | Qualité données | 1h |

### 7.2 Moyen terme (nécessite données supplémentaires)

| Innovation | Dépendance | Impact | Effort |
|---|---|---|---|
| CLV Pinnacle comme ancrage | OddsPapi bd `bjv` signup | Edge qualité +++ | 4h |
| Momentum split p1/p2 (pas agrégat) | Exposer dans payload BSD | Drama score précis | 2h |
| Behavioral score (hits api_cache) | Ajouter colonne `hit_count` api_cache | Popularité organique | 3h |
| Reverse Line Movement flag | `movement_p1` direction vs model | Bettor signal fort | 2h |

### 7.3 Long terme (features premium / recherche)

| Innovation | Concept | Impact |
|---|---|---|
| Score "style clash" xvalue.ai | bd `ffh` ML scouting — fingerprint tactique | Différenciation concurrentielle |
| Prédiction drama via NLP presse | RSS feeds déjà câblés (bd `p2if`) | Story angle automatisé |
| Top 10 personnalisé par historique user | Préférences joueurs/tournois | Retention |
| A/B test poids mode viewer vs bettor | Analytics clics CTA | Calibration continue |

---

## 8. Conflits Identifiés & Résolutions

| Conflit | Pour | Contre | Résolution |
|---|---|---|---|
| **Prestige tournoi** | Rafael, Julie (drama, notoriété) | Marco (edge pas prestige) | Dual mode — prestige 20% en viewer, 5% en bettor |
| **Serve stats comme dimension** | Sara (data completeness) | Rafael (lagging indicator) | Serve stats dans gate completeness seulement, pas dimension indépendante |
| **CLV bloqué sans Pinnacle** | Marco (priorité absolue) | — (manque de donnée) | Bayesian blend comme ancrage interne, flag `clv_source: 'internal'` — upgrade quand OddsPapi live |
| **Static list vs refresh live** | Julie (refresh obligatoire) | Perf cron | Cache 60s côté serveur, pas recalcul client — imperceptible |

---

## 9. Roadmap d'Évolution — À Valider

### Phase 0 — Prérequis immédiats (avant dev Top 10)
> ~2h — non optionnels

| Tâche | Fichier | Raison |
|---|---|---|
| Patcher normalizer `aces_per_set[][]` | `server.js` `_normalizeBSDTennisMatch()` | Gate data_completeness correct |
| Exposer `momentum_p1` / `momentum_p2` séparément | `server.js` | Drama score Rafael |

### Phase 1 — MVP Top 10 (viewer mode)
> ~12h dev | Livrable : widget visible, liste fonctionnelle

| Step | Tâche | Effort |
|---|---|---|
| 1.1 | `computeScoreTop10(match, mode)` + `deriveTop10Reason()` dans `server.js` | 3h |
| 1.2 | `applyDiversityFilter()` post-ranking (max 3 par tournoi) | 1h |
| 1.3 | Cron 60s → calcul + store `api_cache` key `top10_tennis_viewer` | 1h |
| 1.4 | Route `GET /api/v1/tennis/top10` → JSON response | 1h |
| 1.5 | UI `pariscore.html` : encart horizontal scrollable + cards anatomie §6.2 | 4h |
| 1.6 | Score decay : `status=finished` → suppression immédiate | 0.5h |
| 1.7 | Tests : node --check + grep payload champs requis | 1.5h |

### Phase 2 — Mode Bettor + Améliorations
> ~6h dev

| Step | Tâche | Effort |
|---|---|---|
| 2.1 | Toggle UI `BETTOR | FAN` → query param `?mode=bettor` | 2h |
| 2.2 | Cache `top10_tennis_bettor` TTL 30s (séparé de viewer) | 0.5h |
| 2.3 | Reverse Line Movement flag (direction movement vs modèle) | 1.5h |
| 2.4 | Behavioral signal : colonne `hit_count` sur `api_cache`, incrément par fetch | 1h |
| 2.5 | Score enrichi : injecter `hit_count_norm` en D7 (poids 5%, viewer seulement) | 1h |

### Phase 3 — Premium Insights
> ~8h dev | Dépend Phase 2 + OddsPapi signup

| Step | Tâche | Dépendance |
|---|---|---|
| 3.1 | Intégrer CLV Pinnacle via OddsPapi comme ancrage `D2_bettor` | bd `bjv` OddsPapi live |
| 3.2 | Explainability tooltip : au survol card, détail breakdown scores D1..D6 | Phase 1 livré |
| 3.3 | Alerte SSE "nouveau match Top 3" — push notification mobile | PWA push déjà câblé |
| 3.4 | Tracking clics CTA → A/B test poids viewer vs bettor | Analytics baseline |

### Phase 4 — Intelligence Avancée
> Sessions futures | Recherche + DG validation

| Feature | Concept | Priorité |
|---|---|---|
| Style clash score | xvalue.ai ML fingerprint tactique (bd `ffh`) | MED |
| Personnalisation user | Filtres préférences joueurs/tournois/surface | LOW |
| NLP story angle | Injection titres presse RSS (bd `p2if` déjà câblé) | LOW |
| Backtesting Top 10 | Mesurer si Top 10 corrèle avec résultats surprise/value réalisée | MED |

---

## 10. Métriques de Succès

| Métrique | Cible | Mesure |
|---|---|---|
| % matchs avec data_completeness ≥ 0.6 | >80% des matchs listés | Count api_cache gate |
| Taux de clic CTA "VOIR →" | >15% des vues card | Analytics frontend |
| Score moyen Top 10 vs reste de la liste | Top 10 score moyen ≥2× médiane | `computeScoreTop10` logs |
| Refresh rate perçu | Widget mis à jour visible ≤ 2 min | Client polling interval |
| Rétention onglet Tennis | +10% temps moyen page | Session analytics |

---

## 11. Résumé Exécutif

Le **Top 10 Matchs du Jour** repose sur une **formule composite 6 dimensions** pondérée selon deux modes (viewer/bettor), enrichie de **bonus flat** pour les moments live critiques (tiebreak, set décisif) et d'un **tag de raison lisible** par carte.

**Ce qui différencie PariScore** des agrégateurs génériques :
1. L'EV est validée par Bootstrap IC — pas de signal sans borne inférieure positive
2. Le steam move (movement BSD) est intégré comme signal de sharp money
3. Le widget est "vivant" — les matchs terminés disparaissent instantanément
4. Dual mode bettor/viewer — même encart, deux logiques de ranking distinctes

**Prochaine étape** : valider cette roadmap, puis lancer Phase 0 + Phase 1 MVP.

---

*Rapport généré — PariScore Top 10 Tennis Brainstorm Session — 2026-06-04*  
*Panel : Dr. Chen (DataScience) · Sara (Architecture) · Marco (Parieur Pro) · Rafael (Tennis Pro) · Julie (UX/Design)*
