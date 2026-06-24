# Rapport de Bug : MMA UFC — "No upcoming UFC event."

**Date** : 20/06/2026
**Auteur** : Audit automatique
**Version** : ParisScore v9.7

---

## Résumé Exécutif

L'onglet MMA UFC affiche systématiquement **"No upcoming UFC event."** alors que la route `GET /api/v1/mma/odds-1xbet` retourne 47 fights avec cotes 1xBet.

**Cause racine** : La route `GET /api/v1/mma/fights` dépend de **The Odds API** (`api.the-odds-api.com`), dont la clé a épuisé son **quota mensuel gratuit**. Sans données Odds API, le pipeline produit 0 events, et le frontend affiche l'état vide.

**Solution proposée** : Alimenter `getMMAFights()` avec les données 1xBet comme source de cotes de secours (fallback) quand The Odds API est indisponible.

---

## Diagnostic

### 1. Réponse actuelle de l'API

```
GET /api/v1/mma/fights
→ 200 OK
→ {"ok":true,"count":0,"events":[],"cache":{"odds_cached":false,"fights_cached":0}}
```

### 2. Cause racine : Quota Odds API épuisé

```bash
$ curl https://api.the-odds-api.com/v4/sports/mma_mixed_martial_arts/odds/?apiKey=8a696ef3...
→ 401 UNAUTHORIZED
→ {"message":"Usage quota has been reached.","error_code":"OUT_OF_USAGE_CREDITS"}
```

- **Plan** : Gratuit (500 req/mois)
- **Clé** : `8a696ef36c794c1875fec679fcc64370` (présente dans `.env` du VPS, mais quota vide)
- **Conséquence** : `_fetchOdds()` retourne cache vide ou `[]` → `_groupByDate()` produit 0 events

### 3. Flux détaillé

```
Frontend (pariscore.js:29896)
  → initMMAPage() → _fetchMMA()
    → GET /api/v1/mma/fights (server.js:21474)
      → mmaService.getMMAFights(ODDS_API_KEY) (mmaService.js:312)
        → _fetchOdds(apiKey) (mmaService.js:203)
          → GET api.the-odds-api.com/v4/sports/mma_mixed_martial_arts/odds/
          → 401 QUOTA EXCEEDED → return []  ← BUG
        → enrichissement vide
        → _groupByDate([]) → []
        → Frontend reçoit events: [] → "No upcoming UFC event."
```

### 4. Routes concernées

| Route | Source | Statut |
|---|---|---|
| `GET /api/v1/mma/fights` | The Odds API | ❌ Quota épuisé, retourne 0 events |
| `GET /api/v1/mma/odds-1xbet` | Fichier `data/odds_1xbet_mma.json` (push 1xBet) | ✅ 47 fights, HTTP 200 |

### 5. Données 1xBet disponibles

La route `odds-1xbet` fonctionne et retourne des combats avec :
- `fighter1` / `fighter2` (noms des combattants)
- `odds_f1` / `odds_f2` (cotes décimales 1xBet)
- `start_time` (date du combat)
- `league_id`, `event_name`

**Ces données ne sont PAS utilisées par `getMMAFights()`.**

---

## Propositions de Correction

### Option A — Bridge 1xBet → pipeline MMA (RECOMMANDÉE)

Adapter `getMMAFights()` dans `mmaService.js` pour utiliser les cotes 1xBet comme source de cotes quand The Odds API est indisponible.

**Changements :**

1. **`mmaService.js` — Nouvelle fonction `_fetchOdds1xBet()`** (inspirée de `getOdds1xBet()` existante ligne 907) qui lit `data/odds_1xbet_mma.json` et formate les données au même schéma que The Odds API :
   ```json
   {
     "home_team": "Fighter A",
     "away_team": "Fighter B",
     "commence_time": "2026-06-27T...",
     "bookmakers": [{
       "title": "1xBet",
       "markets": [{
         "key": "h2h",
         "outcomes": [
           { "name": "Fighter A", "price": 2.10 },
           { "name": "Fighter B", "price": 1.80 }
         ]
       }]
     }]
   }
   ```

2. **`mmaService.js:getMMAFights()` — Fallback** :
   ```javascript
   const rawFights = await _fetchOdds(apiKey);
   if (!rawFights || rawFights.length === 0) {
     rawFights = await _fetchOdds1xBet();  // fallback 1xBet
   }
   ```

3. **Adapter `_devig()`** pour gérer le cas où un seul bookmaker (`1xBet`) est présent (actuellement fonctionne déjà avec des tableaux de bookmakers, donc OK).

**👍 Avantages** :
- Toute l'analyse existante est conservée (devig, stacked ensemble, EV calc)
- PR de taille modeste (~40 lignes)
- Aucun changement frontend
- Fonctionne en fallback silencieux (si Odds API revient, on reprend automatiquement)

**👎 Inconvénients** :
- Plus de DRatings ni modèle ML sans les vrais noms de combattants UFC (à vérifier si 1xBet utilise les mêmes noms)
- Pas de `weight_class` ni `is_title` dans les données 1xBet

### Option B — Double route frontend

Garder `getMMAFights()` tel quel (vide pour l'instant) et faire en sorte que le frontend MMA tab appelle **les deux routes** (fights + odds-1xbet) et affiche ce qui est disponible.

**Changements :**
- `pariscore.js:initMMAPage()` → fetch `GET /api/v1/mma/fights` **+** `GET /api/v1/mma/odds-1xbet`
- Si `fights` est vide mais `odds-1xbet` a des fights, afficher les cotes 1xBet brutes
- Créer une nouvelle sous-section "Cotes 1xBet" dans l'onglet MMA

**👍 Avantages** :
- Aucun changement backend (juste frontend)
- Données 1xBet visibles immédiatement

**👎 Inconvénients** :
- Pas d'analyse PariScore (devig, probas, EV) sur ces cotes
- Format d'affichage différent
- Plus de code frontend

### Option C — Nouvelle clé Odds API

Acheter un abonnement The Odds API (payant, ~$99/mois pour 10 000 req) ou créer un nouveau compte gratuit.

**👍 Avantages** : Aucun changement de code
**👎 Inconvénients** : Coût récurrent, le quota gratuit sera de nouveau épuisé

---

## Recommandation

**Option A** — Bridge 1xBet vers `getMMAFights()`.

Justification :
1. Solution pérenne : plus de dépendance au quota Odds API
2. Réutilisation de toute la logique existante (devig, ensemble stacking, EV)
3. Les noms de combattants 1xBet sont en français/anglais standard — compatibles avec le modèle ML et DRatings (à vérifier)
4. Changement minimal, PR ciblée

### Ordre de priorité d'implémentation

1. 🔴 **Bridge 1xBet → `getMMAFights()`** (Option A) — débloque l'onglet MMA UFC
2. 🟡 **Fallback DRatings** — adapter `_matchDRatings()` pour les noms 1xBet
3. 🟢 **Ajouter poids lourds et titres** — enrichir les données 1xBet avec les métadonnées UFC manquantes

---

## Résumé des Fichiers Impactés

| Fichier | Changement | Priorité |
|---|---|---|
| `services/mmaService.js` | Nouveau `_fetchOdds1xBet()` + fallback dans `getMMAFights()` | 🔴 Haute |
| `data/odds_1xbet_mma.json` | Données pushées par le scraper (inchangé) | — |
| `pariscore.js` | Aucun (si Option A) | 🟢 Optionnel |
| `server.js` | Aucun | — |

---

*Fin du rapport — 20/06/2026*
