# Back-Test PariScore v5.19 — Scénarios Prédictifs Live

**Date** : 2026-05-02  
**Version** : v5.19  
**Objectif** : Mesurer l'accuracy des prédictions Poisson + xG live sur les matchs passés

---

## 1. MÉTHODOLOGIE

### 1.1 Principe
Rejouer les matchs archivés des 7 derniers jours et comparer :
- **Prédiction Poisson pré-match** (1N2, BTTS, Over/Under) → Résultat réel
- **Prédiction Live ajustée** (si données live disponibles) → Résultat réel

### 1.2 Formules
```
Accuracy = bonnes_prédictions / total_prédictions × 100

ROI (Return on Investment) = Σ(cote × mise × résultat) - Σ(mise) / Σ(mise) × 100

Edge = proba_poisson - proba_implicite_cote
Value Bet détecté = edge > 5%
```

### 1.3 Critères d'évaluation
| Critère | Description |
|---------|-------------|
| **1N2** | Victoire domicile / Nul / Victoire extérieur |
| **BTTS** | Les deux équipes marquent (Oui/Non) |
| **Over 2.5** | Plus de 2.5 buts dans le match |
| **Edge > 5%** | Value bets avec edge positif significatif |
| **Confiance** | Proba Poisson du pick sélectionné |

---

## 2. ARCHITECTURE DU BACK-TEST

### 2.1 Route Backend
```
POST /api/v1/admin/backtest-bsd
Body: { days: 7 }  // défaut 7, max 30
```

### 2.2 Processus
1. Fetch matchs archivés des N derniers jours via BSD
2. Pour chaque match avec score final :
   - Récupérer les stats pré-match (PPG, forme, xG attendu)
   - Calculer Poisson (λ domicile, λ extérieur)
   - Générer prédictions 1N2, BTTS, Over/Under
   - Comparer avec score réel
3. Agréger les résultats par :
   - Rolling 30 matchs
   - Par ligue
   - Par tier de confiance (55-65 / 65-75 / 75+)

### 2.3 Stockage
Les résultats sont archivés dans `pariscore.db` table `kv` :
- `accuracy_rolling30` : rolling window 30 matchs
- `accuracy_by_league` : breakdown par ligue
- `accuracy_by_confidence` : par tier de confiance

---

## 3. RÉSULTATS ACTUELS (dernier run — 2 mai 2026)

### 3.1 Global
| Métrique | Valeur |
|----------|--------|
| **Matchs testés** | 5 archivés |
| **Période** | 7 derniers jours |
| **Over 2.5 Accuracy** | 60% (3/5) ✅ |
| **BTTS Accuracy** | 60% (3/5) ✅ |
| **Edge Accuracy** | 100% (2/2) 🔥 |

### 3.2 Par Ligue
| Ligue | Matchs | Over 2.5 | BTTS | Edge |
|-------|--------|----------|------|------|
| Ligue 1 | 1 | 100% ✅ | 100% ✅ | 100% ✅ |
| Serie A | 1 | 100% ✅ | 100% ✅ | 100% ✅ |
| La Liga | 1 | 100% ✅ | 100% ✅ | N/A |
| Premier League | 1 | 0% ❌ | 0% ❌ | N/A |
| Bundesliga | 1 | 0% ❌ | 0% ❌ | N/A |

### 3.3 Par Tier de Confiance
*(En attente de données suffisantes — sample size < 30)*

---

## 4. COMMENT LANCER UN BACK-TEST

### 4.1 Via l'UI
1. Aller dans l'onglet **Historique**
2. Section **Back-Testing**
3. Sélectionner le nombre de jours (1-30)
4. Cliquer **Lancer Back-Test**
5. Les résultats apparaissent automatiquement

### 4.2 Via API
```bash
curl -X POST http://localhost:3000/api/v1/admin/backtest-bsd \
  -H "Content-Type: application/json" \
  -d '{"days": 7}'
```

### 4.3 Vérifier les résultats
```bash
curl http://localhost:3000/api/v1/accuracy/public
```

---

## 5. LIMITATIONS CONNUES

1. **Échantillon limité** : 5 matchs archivés seulement → besoin de plus de données
2. **Pas de données live historiques** : BSD ne stocke pas le live passé, uniquement le snapshot final
3. **Cotes historiques** : Les cotes d'ouverture ne sont pas archivées → edge calculé avec cotes actuelles
4. **Bias T1** : Les ligues T1 (Ligue 1, PL, Serie A) sont mieux couvertes que T2

---

## 6. AMÉLIORATIONS PRÉVUES

| Priorité | Feature | Impact |
|----------|---------|--------|
| P1 | Archiver les snapshots live (xG minute par minute) | Permettre backtest live |
| P1 | Archiver les cotes d'ouverture | Edge historique précis |
| P2 | Accuracy trend chart | Voir l'évolution dans le temps |
| P2 | Kelly stake tracking | Gestion de bankroll |
| P2 | Auto-alerte accuracy < seuil | Détection de dérive |

---

## 7. SEUILS D'ACCEPTATION

| Critère | Minimum | Objectif | Excellent |
|---------|---------|----------|-----------|
| **1N2 Accuracy** | 45% | 55% | 65%+ |
| **BTTS Accuracy** | 50% | 60% | 70%+ |
| **Over 2.5 Accuracy** | 45% | 55% | 65%+ |
| **Edge ROI** | 0% | +3% | +8%+ |
| **Sample size** | 30 matchs | 100 matchs | 500+ matchs |

---

*Document auto-généré. À mettre à jour après chaque run de backtest.*
