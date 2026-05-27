# Test Report — Surface PowerScore (SPS)

**Date** : 2026-05-27
**Module** : `surface_powerscore.py` + `test_surface_powerscore.py`
**Audité par** : /ps-test agent (adapted Python standalone scope)
**Contexte amont** : bd 1343 (9 bugs déjà fixés), bd 1346 (demo OK), bd S267 (pytest 59 livrés)

---

## Périmètre adapté

Module Python standalone — pas encore wired dans `server.js` / `pariscore.html`. Procédure /ps-test adaptée :

| Étape standard | Applicabilité SPS |
|---|---|
| 1. Sync server↔frontend | ⏸️ N/A (pas de wire JS encore — voir reco R1) |
| 2. Null safety / cas dégradés | ✅ couvert (probe 8 scénarios) |
| 3. SIM vs LIVE | ⏸️ N/A (concept JS, Python module agnostique) |
| 4. Validation routes API | ⏸️ N/A (library, pas HTTP) |
| 5. États UI | ⏸️ N/A (CLI/lib only) |
| 6. UX seuils visuels | ✅ couvert (boundary check SPS ∈ [0,100]) |
| 7. Performance | ✅ couvert (analyse O() statique) |
| 8. Syntaxe finale | ✅ `python -m py_compile` OK |

---

## ✅ Tests passés

### Syntaxe & build
- `python -m py_compile surface_powerscore.py` → exit 0
- Demo `__main__` 8 scénarios exécution propre (output cohérent)

### Pytest suite
- **59/59 tests passing** (`pytest test_surface_powerscore.py`)
- Couverture : weights ATP/WTA, formules clay/grass/hard, confidence penalty, validation input, sérialisation, Pydantic v1/v2 dual support, case-insensitivity

### Null safety probe (8 cas dégradés)
| Cas | Comportement | Verdict |
|---|---|---|
| `surface` manquant | `KeyError: Missing required key: 'surface'` | ✅ clean error |
| `surface=None` | `ValueError: Unknown surface 'none'` | ✅ clean error |
| `surface='sand'` invalide | `ValueError: Unknown surface 'sand'` | ✅ clean error |
| `metrics=None` | `TypeError: 'metrics' must be a dict, got NoneType` | ✅ clean error |
| `metrics={}` vide | `KeyError: Missing required metric key: 'elo_recent'` | ✅ clean error |
| Metric hors [0,100] | `ValueError: Metric 'elo_recent' = 150.0 is out of range` | ✅ clean error |
| `matches < 0` | `ValueError: must be >= 0, got -1` | ✅ clean error |
| `matches=0` edge | OK sps=42.50 conf=False (penalty 15%) | ✅ behavior cohérent |

### Invariants mathématiques
- **Boundary check** : metrics tout-à-0 → SPS = 0.00 ; metrics tout-à-100 → SPS = 100.00 (vérifié 3 surfaces × 2 circuits = 6 combinaisons)
- **Conservation poids** : ATP weights et WTA weights somment à 1.0000 exact (3 surfaces, tolerance 1e-9)
- **Clamp [0,100]** : `min(max(sps_raw, 0), 100)` actif post-malus
- **WTA shift** : aptitude WTA Clay (67.50) > ATP Clay (67.10) avec mêmes metrics → reflète bien +5% return / -5% service

### Spec compliance
- ✅ Formule clay = 0.35×return + 0.25×bp_saved + 0.25×2ndserv + 0.15×baseline
- ✅ Formule grass = 0.40×svc_games + 0.25×bp_saved + 0.20×sdr + 0.15×tb
- ✅ Formule hard = 0.35×sdr + 0.30×baseline + 0.20×elo + 0.15×svc_games
- ✅ Final SPS = aptitude × 0.70 + elo_recent × 0.30
- ✅ matches < 5 → malus 15% holistique (documenté docstring L120-131)
- ✅ Circuit WTA → +5% return-side / -5% service-side per surface
- ✅ `calculate_score(data) -> float` round 2 décimales

### Sérialisation
- `SPSResult.serialize()` → dict JSON-ready, arrondi 2 décimales appliqué uniquement à la sortie (raw floats conservés en interne)
- `to_dict()` PlayerMetrics → explicit extraction (safe vs future dataclass changes)

---

## ⚠️ Avertissements (non bloquants)

### W1 — Module pas encore wired pipeline tennis
**Localisation** : `server.js` (route tennis) ↔ `surface_powerscore.py`
**Problème** : Module standalone Python. Aucun import/spawn/call depuis `server.js` ou `pariscore.html` (grep zéro match). SPS calculé manuellement only.
**Recommandation** : décider intégration — voir R1 ci-dessous (port JS ou subprocess Python).

### W2 — Demo `__main__` non couvert par pytest
**Localisation** : `surface_powerscore.py:304-358`
**Problème** : Le block `if __name__ == "__main__"` (demo 8 scénarios + serialize) n'est pas exercé par pytest (juste import test). Régression silencieuse possible si refactor.
**Recommandation** : `subprocess.run([sys.executable, 'surface_powerscore.py'], check=True)` dans test smoke.

### W3 — Pas de logs / observability hook
**Localisation** : `SurfacePowerScoreCalculator.calculate()`
**Problème** : Aucun logging. Si calcul donne valeurs aberrantes en prod, debug forensic difficile (pas trace input/output).
**Recommandation** : ajouter `logging.debug()` opt-in via `logging.getLogger('sps')` pour input payload + intermediate aptitude.

### W4 — Confidence penalty unique threshold 5 matchs
**Localisation** : `_MIN_MATCHES_FULL_CONFIDENCE = 5`
**Problème** : Penalty binaire (0% ou 15%). Joueur avec 4 matchs traité comme joueur avec 0 match.
**Recommandation** : penalty progressive `penalty = max(0, (5-matches)/5) × 0.15` (linéaire). Décision DG si edge mathématique souhaité plus fin.

### W5 — `elo_recent` apparaît à la fois dans aptitude hard ET dans final blend
**Localisation** : `_SURFACE_WEIGHTS['hard']['elo_recent'] = (0.20, 0.20)` + formule finale `+ elo × 0.30`
**Problème** : Sur surface "hard", `elo_recent` contribue à 0.20 × 0.70 + 0.30 = 0.44 du score total. Sur clay/grass juste 0.30. Asymétrie volontaire spec mais peu documentée.
**Recommandation** : ajouter note dans docstring `_compute_aptitude` expliquant pourquoi hard double-count elo.

---

## ❌ Bugs détectés

**Aucun bug bloquant détecté.** Module déjà passé audit complet bd 1343 (9 bugs fixés pré-livraison).

---

## 💡 Recommandations d'amélioration

### R1 — Intégration pipeline tennis PariScore (P1)
Deux options :
- **Port JS pur** dans `server.js` (recommandé — zero-dep, cohérent stack). Fonction `computeSurfacePowerScore(metrics, surface, circuit, matches)` ~50 lignes JS.
- **Subprocess Python** via `child_process.spawn` (lourd, latence ~50ms par call, cache obligatoire).

Wire location candidate : `buildTennisMatchRecord()` server.js (ajouter `m.sps_home` / `m.sps_away` + colonne UI dans `_tvbPFRow()` Tennis Value Bets table).

### R2 — Backtest validation prédictive (P2)
Mesurer corrélation SPS vs résultats réels sur 6 mois ATP/WTA. Si SPS_home - SPS_away > X → hit rate winner attendu ?
Approche : extract matchs `db.archive_matches` tennis FT, compute SPS retrospective via stats 52-semaines avant kickoff, plot reliability diagram. Backlog bd `e3mr` (Tennis Consolidation LOT P1+P2 backtest Brier déjà ouvert) — append SPS comme métrique additionnelle.

### R3 — Source data 8 metrics (P0 si wire)
Audit où récupérer chaque metric :
- `elo_recent` → existe déjà (Elo BSD/ESPN, bd `dl49`)
- `sdr` → à calculer (% wins sur surface / % wins toutes surfaces × 100)
- `return_pts_won` / `2nd_service_won` / `service_games_won` / `bp_saved` / `tie_breaks_won` → ATP/WTA stats publiques (Tennis Abstract scrape `tools/scrape-tennis-abstract-elo.js` déjà présent — extend)
- `baseline_efficiency` → composite à définir (rally length × winning %)

Sans ces 8 metrics live, SPS = vaporware. Bd ticket dédié recommandé.

### R4 — Type-hint amélioration `Surface` post-normalisation
**Localisation** : `_parse_input()` L191 `surface: Surface = str(data["surface"]).strip().lower()`
**Problème** : type-hint `Surface = Literal["clay","grass","hard"]` viole si input ne match pas (ligne validée après). Affectation type narrowing avant guard.
**Fix proposé** :
```python
surface_str = str(data["surface"]).strip().lower()
if surface_str not in _SURFACE_WEIGHTS:
    raise ValueError(...)
surface: Surface = surface_str  # type: ignore[assignment]
```
Cosmétique, mypy `--strict` flagge sinon.

### R5 — Cache results si appel répété même payload
Si pipeline appelle `calculate()` plusieurs fois par match (home + away), `functools.lru_cache(maxsize=1024)` sur payload hash (PlayerMetrics frozen dataclass déjà hashable). Gain marginal sauf si batch >100 joueurs.

---

## Verdict global

**Module SPS = PROD-READY standalone.** 0 bug bloquant, 59 tests pass, spec respectée à 100%.

**Mais SPS = orphelin** côté PariScore tant que pas wired tennis pipeline (W1 + R1 + R3). Décision DG requise : port JS vs subprocess Python, et qui alimente les 8 metrics live ?

**Prochains pas suggérés (ordre):**
1. Wire feature flag `ENABLE_SPS=false` server.js + helper JS port
2. Sourcing 8 metrics (extension `tools/scrape-tennis-abstract-elo.js`)
3. Backtest 6 mois (append bd `e3mr`)
4. Activation prod + colonne UI Tennis Value Bets

---

*Rapport généré par /ps-test — 2026-05-27 21:04 GMT+2.*
