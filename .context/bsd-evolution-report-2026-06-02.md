# BSD API Evolution Report — 2026-06-02

> Audit des champs BSD disponibles vs consommés dans server.js.
> Probe live sur match Croatia vs Belgium (event_id 9093) + get_predictions + compare_odds.
> **Statut : RAPPORT LIVRÉ — attente GO DG avant implémentation.**

---

## 1. CHAMPS DÉJÀ INTÉGRÉS ✅ (pas d'action)

| Champ BSD | server.js | Utilisation |
|-----------|-----------|-------------|
| `is_neutral_ground` | :3793 | Annule home advantage dans λ Poisson |
| `is_local_derby` | :3794 | +6% λH et λA |
| `travel_distance_km` | :3795 | Stocké, exposé payload |
| `highlights[]` | :35928 | Stocké, route `/api/v1/highlights` |
| `pred.model.confidence` | :3761 | Utilisé bet signal |
| `pred.model.version` | :3762 | Lu (non versionné) |
| `best_odds` + `best_bookmaker_slug` | :3536 | Cotes meilleures exposées |
| `consensus()` sur compare_odds | :3541 | Devig interne |
| `home_coach_id` / `away_coach_id` | ✅ | Manager enrichment |
| `referee_id` | ✅ | Referee enrichment |
| `venue_id` | ✅ | Venue enrichment |

---

## 2. GAPS IDENTIFIÉS — Champs BSD disponibles mais non consommés

### 2A. `attendance` (match_detail)
```json
"attendance": null  // null sur amicaux, populé sur championnats
```
- **Disponibilité** : Populé sur matchs liga/premier league/etc. Null pour amicaux.
- **Impact potentiel** : Crowd size → home advantage dynamique. Fort affluence = boost home ×1.05 estimé empiriquement.
- **Effort impl** : ~1h. Stocker `m.attendance`, exposer payload, input optionnel `computeContextEngine`.
- **Priorité DG** : MEDIUM

### 2B. `pitch_condition` (match_detail)
```json
"pitch_condition": null  // rarement populé
```
- **Disponibilité** : Rarement non-null. Possible valeurs: "wet", "dry", "firm", "soft".
- **Impact potentiel** : "wet" → Over/Under adjustment (-0.3 buts estimé). Peu de matchs affectés.
- **Effort impl** : ~30min. Lookup table condition → λ multiplier.
- **Priorité DG** : LOW (faible couverture)

### 2C. `weather` from BSD (match_detail)
```json
"weather": { "code": null, "description": null, "wind_speed": null, "temperature_c": null }
```
- **Disponibilité** : Null pour ce match. Variablement populé.
- **Impact potentiel** : PariScore utilise Open-Meteo (bd `cy9h`). BSD weather = source alternative directe, moins de latence.
- **Recommandation** : Utiliser BSD weather quand non-null, Open-Meteo en fallback. Réduit 1 appel API externe.
- **Effort impl** : ~1h. Guard `if (detail.weather?.temperature_c != null)` avant appel Open-Meteo.
- **Priorité DG** : LOW (Open-Meteo fonctionne déjà)

### 2D. `recommendations.winner` + `recommendations.bet_favorite` (get_predictions, model v5.0)
```json
"recommendations": {
  "favorite": "H",
  "favorite_prob": 31.6,
  "bet_favorite": false,    ← NOUVEAU champ explicite
  "over_15": false,
  "over_25": false,
  "over_35": false,
  "btts": false,
  "winner": false           ← NOUVEAU champ explicite
}
```
- **Disponibilité** : Présent sur tous les matchs avec prédictions. Modèle v5.0 (upgrade depuis v4.x).
- **Impact potentiel** : Signal bet explicite BSD ML CatBoost. Cross-validation avec notre `computeBetSignal()`. Si BSD dit bet_favorite=true ET notre EV>5% → double confirmation → confiance++.
- **Implémentation proposée** :
  ```javascript
  m.bsd_bet_signal = {
    winner: pred.recommendations.winner,
    bet_favorite: pred.recommendations.bet_favorite,
    model_version: pred.model.version,
    confidence: pred.model.confidence,
  };
  ```
  Exposer dans payload + afficher badge "BSD ✓" dans tableau si `bsd_bet_signal.bet_favorite === true`.
- **Effort impl** : ~2h backend + 1h UI badge.
- **Priorité DG** : **HIGH** — valeur ajoutée directe, différenciation produit.

### 2E. `bookmakers_count` + `total_odds` (compare_odds meta)
```json
{
  "bookmakers_count": 15,
  "total_odds": 440
}
```
- **Disponibilité** : Présent sur tous les matchs avec odds BSD.
- **Impact potentiel** : `bookmakers_count` = indicateur profondeur marché. 15 livres = match majeur. 2-3 livres = match secondaire, cotes moins fiables. Input direct pour `computeReliabilityScore()` (actuellement utilise data quality + volume historique).
- **Implémentation proposée** : Ajouter `bookmakers_count` comme facteur dans `computeReliabilityScore()`. Score fiabilité += f(bookmakers_count) avec seuils 1-5 (bas), 6-10 (moyen), 11-15+ (haut).
- **Effort impl** : ~1h.
- **Priorité DG** : MEDIUM

### 2F. `oddssafari-consensus` dans compare_odds bookmakers
```json
"oddssafari-consensus": {
  "decimal_odds": 2.65,
  "movement": "DRIFTING",
  "updated_at": "2026-06-02T16:06:07Z"
}
```
- **Disponibilité** : Nouveau bookmaker "slug" dans la liste. Représente une cote consensus agrégée.
- **Impact potentiel** : Deuxième référence low-vig après Pinnacle. La cote consensus peut confirmer ou infirmer la cote Pinnacle isolée (sample size 1 vs agrégat).
- **Implémentation proposée** : Exposer `consensus_odds` dans payload aux côtés de `pinnacle_odds`. Afficher dans le drawer multi-bookmaker avec label "Consensus".
- **Effort impl** : ~1h.
- **Priorité DG** : MEDIUM

---

## 3. OBSERVATIONS TECHNIQUES

### 3A. Predictions model v5.0
- Confirmé `"model": {"confidence": 0.3875, "version": "v5.0"}`.
- `pred.model.version` lu (server.js:3762) mais non versionné dynamiquement.
- **Action recommandée** : Logguer les changements de version via `bd remember`. Si passage v5.x → v6.x, recalibrer les seuils `bet_favorite` threshold.

### 3B. Live match enrichment (15 bookmakers live)
- `compare_odds` sur match en cours retourne 15 livres avec mouvements live.
- Pinnacle = référence sharp actuellement en meilleure cote (2.76 HOME Croatia).
- `movement: DRIFTING/SHORTENING` disponible par bookmaker — mouvement live déjà utilisé dans notre UI (flèches).

### 3C. `season_id` dans match detail
```json
"season_id": 133
```
- Disponible sur tous les matchs BSD. Non consommé dans server.js.
- Pourrait simplifier les lookups standings/fixtures (éviter recalcul `mois >= 7 ? année : année-1`).
- **Effort impl** : ~30min. Stocker `m.bsd_season_id`, utiliser dans les `bsdFetch(/standings/)` calls.
- **Priorité** : LOW

---

## 4. RÉSUMÉ PRIORISÉ

| # | Champ | Impact | Effort | Priorité |
|---|-------|--------|--------|----------|
| 1 | `recommendations.winner + bet_favorite` | Différenciation produit — double confirmation bet signal | 3h | **HIGH** |
| 2 | `bookmakers_count` → reliability score | Qualité signal améliorée | 1h | MEDIUM |
| 3 | `attendance` → home advantage | Modèle plus précis | 1h | MEDIUM |
| 4 | `oddssafari-consensus` → drawer | UX — cote consensus visible | 1h | MEDIUM |
| 5 | `weather` BSD → fallback Open-Meteo | Réduction appels externes | 1h | LOW |
| 6 | `pitch_condition` → Over/Under adj | Edge marginal (faible couverture) | 30min | LOW |
| 7 | `season_id` → standings simplif. | Technique seulement | 30min | LOW |

**Total effort si GO sur tous** : ~8.5h
**Total effort items HIGH+MEDIUM** : ~6h

---

## 5. RECOMMANDATION CTO

Implémenter dans cet ordre si GO DG :

1. **`recommendations.bet_favorite` badge** (3h) — visible en prod, différenciation immédiate
2. **`bookmakers_count` → reliability** (1h) — améliore score confiance
3. **`attendance`** (1h) — enrichit modèle sans risque de régression

Items LOW = backlog P3, implémenter si filler session <30min.

**Attente GO DG avant tout code.**

---

*Rapport généré 2026-06-02 par audit MCP BSD probe (live Croatia-Belgium + predictions + compare_odds). Validé contre server.js grep.*
