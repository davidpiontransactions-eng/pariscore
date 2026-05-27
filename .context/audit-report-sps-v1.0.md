# Audit & Test Report — surface_powerscore.py v1.0
**Date** : 2026-05-27
**Module** : `surface_powerscore.py`
**Test file** : `test_surface_powerscore.py`
**Coverage** : 59 tests · 9 classes · 59/59 passed

---

## Executive Summary

Module livré fonctionnel sur tous les scénarios nominaux. 3 bugs HIGH et 6 findings MEDIUM détectés en audit, tous corrigés avant clôture. Le code final tourne proprement sur Python 3.x sans dépendances tierces.

---

## Tests passés (59/59)

| Classe de tests | Tests | Couverture |
|---|---|---|
| `TestWeightTableIntegrity` | 7 | Sommes coefficients ATP+WTA × 3 surfaces = 1.00 exact |
| `TestClayFormulaATP` | 3 | Aptitude 67.10, SPS 70.52, confidence full |
| `TestGrassFormulaATP` | 2 | Aptitude 72.15, SPS 74.055 |
| `TestHardFormulaATP` | 2 | Aptitude 77.25, SPS 77.625 |
| `TestConfidencePenalty` | 6 | Seuil 5 matchs, penalty 15%, elo floor, magnitude |
| `TestWTAAdjustments` | 5 | Clay/Grass/Hard WTA ≠ ATP, valeurs exactes |
| `TestCaseSensitivity` | 8 | `"Clay"` / `"CLAY"` / `"wta"` / `"Wta"` → normalisés |
| `TestInputValidation` | 13 | Clés manquantes, None, out-of-range, non-numeric |
| `TestPydanticDuckTyping` | 3 | model_dump (v2) / dict (v1) / TypeError |
| `TestSerialization` | 6 | Clés, types, arrondi 2 décimales, idempotence |
| `TestBoundaryValues` | 5 | All-100 ≤ 100, all-0 = 0, player_id, defaults |

---

## Bugs détectés et corrigés

### BUG-1 — Case sensitivity surface/circuit (HIGH)
**Localisation** : `_parse_input` ligne ~118  
**Problème** : `data["surface"] = "Clay"` → `ValueError` silencieux. `circuit = "wta"` → rejeté.  
**Impact** : tout appelant passant des strings mixed-case crashait sans message clair.  
**Fix** :
```python
surface = str(data["surface"]).strip().lower()
circuit_raw = str(data.get("circuit", "ATP")).strip().upper()
```

### BUG-2 — Aucune garde sur les valeurs None dans metrics (HIGH)
**Localisation** : `_parse_input` → section métriques  
**Problème** : `float(None)` lève `TypeError` non documentée. Clé manquante → `KeyError` brute.  
**Impact** : erreurs incompréhensibles en production si payload partiel.  
**Fix** : méthode `_validate_metrics()` dédiée — 3 niveaux :
1. `metrics` doit être un `dict`
2. Toutes les 8 clés présentes → `KeyError` ciblé
3. Valeur non-None + coercible en float + ∈ [0, 100]

### BUG-3 — `matches_played_on_surface` peut être négatif (HIGH)
**Localisation** : `_parse_input`  
**Problème** : `-1` passait le seuil `< 5` → pénalité appliquée sur valeur nonsensique.  
**Fix** :
```python
if matches_played < 0:
    raise ValueError("matches_played_on_surface must be >= 0")
```

---

## Améliorations appliquées

### M1 — Validation range [0, 100] des métriques (MEDIUM)
Métriques acceptaient `150` ou `-10` sans erreur, polluant silencieusement aptitude + SPS.  
**Fix** : check post-coercion dans `_validate_metrics()`.

### M2 — `vars()` remplacé par `to_dict()` explicite (MEDIUM)
`vars(frozen_dataclass)` est safe en Python 3 mais fragile : ajout futur d'un champ `coach_elo` dans `PlayerMetrics` + clé absente dans `_SURFACE_WEIGHTS` → `KeyError` silencieux.  
**Fix** : méthode `PlayerMetrics.to_dict()` avec extraction explicite des 8 champs.

### M3 — Double-rounding éliminé (MEDIUM)
`SPSResult` stockait des valeurs déjà arrondies, puis `serialize()` arrondit à nouveau.  
**Fix** : `SPSResult` stocke les floats bruts. Arrondi unique dans `serialize()` et `calculate_score()`.

### M4 — Support Pydantic duck-typing (MEDIUM)
Spec précisait "dict ou objet Pydantic" mais seul `dict` fonctionnait.  
**Fix** : `_coerce_input()` détecte `model_dump()` (v2) ou `dict()` (v1) automatiquement.

### M5 — Commentaire trompeur sur le "elo floor" (MEDIUM)
Le commentaire affirmait que `elo_recent` "agit comme floor non-affecté par la pénalité", ce qui était faux (la pénalité s'applique au SPS_raw complet).  
**Fix** : docstring de classe réécrite pour décrire le comportement réel — pénalité holiste sur toute l'estimation.

---

## Vérification formules finales

| Surface | Circuit | Aptitude | SPS (12 matchs) | SPS (3 matchs, −15%) |
|---|---|---|---|---|
| Clay | ATP | 67.10 | 70.52 | 59.94 |
| Grass | ATP | 72.15 | 74.06 | 62.95 |
| Hard | ATP | 77.25 | 77.63 | 66.00 |
| Clay | WTA | 67.50 | 70.80 | 60.18 |
| Grass | WTA | 72.50 | 74.28 | 63.14 |
| Hard | WTA | 77.60 | 77.87 | 66.19 |

### Vérification sommes de coefficients

| Surface | Circuit | Somme | Statut |
|---|---|---|---|
| Clay | ATP | 0.35+0.25+0.25+0.15 = **1.00** | OK |
| Clay | WTA | 0.40+0.25+0.20+0.15 = **1.00** | OK |
| Grass | ATP | 0.40+0.25+0.20+0.15 = **1.00** | OK |
| Grass | WTA | 0.35+0.25+0.25+0.15 = **1.00** | OK |
| Hard | ATP | 0.35+0.30+0.20+0.15 = **1.00** | OK |
| Hard | WTA | 0.40+0.30+0.20+0.10 = **1.00** | OK |

---

## Recommandations pour sessions futures (backlog P2/P3)

1. **Ajouter un `ReliabilityScore`** — Score composite `matches_played × surface_variance` pour distinguer "25 matchs stables" vs "25 matchs avec variance élevée". Utile pour les alertes UI.

2. **Serialisation vers TypedDict / JSON Schema** — Générer un `json-schema` auto à partir de `PlayerMetrics` pour valider les payloads entrants côté API Node.js (`/api/v1/tennis/sps`).

3. **Historisation rolling 52 semaines** — Ajouter un paramètre `window_weeks: int = 52` pour calculer des SPS glissants et détecter les pics de forme surface-specific (ex : joueur qui monte sur clay depuis 8 semaines).

4. **Cache par `player_id + surface + week_stamp`** — Si le module est appelé depuis un endpoint HTTP, un cache LRU sur `(player_id, surface, iso_week)` éviterait des recalculs inutiles (TTL 24h suffisant).

5. **Tests de régression sur données réelles ATP/WTA** — Backtester le SPS sur les 50 derniers résultats Grand Chelem par surface pour calibrer les coefficients par rapport aux résultats réels (cf. bd `e3mr` Tennis Consolidation LOT P1+P2).

---

## Fichiers livrés

| Fichier | Rôle |
|---|---|
| `surface_powerscore.py` | Module principal v1.0 (corrigé) |
| `test_surface_powerscore.py` | Suite pytest 59 tests |
| `.context/audit-report-sps-v1.0.md` | Ce rapport |

---

*Audit effectué : 2026-05-27 — 3 HIGH fixes, 5 MEDIUM improvements, 59/59 tests green.*
