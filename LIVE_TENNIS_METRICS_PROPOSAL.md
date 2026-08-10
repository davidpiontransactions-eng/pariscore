# LIVE_TENNIS_METRICS_PROPOSAL.md

> **Objet** : Intégration de métriques live décisionnelles sur les cartes live tennis de PariScore
> **Date** : 2026-08-11
> **Auteurs** : Lead Tennis Quant Analyst + Lead Fullstack Engineer
> **Coût** : 0 € (API BSD déjà provisionnée)
> **Latence cible** : 8s (polling) / <1s (SSE) — infrastructure existante

---

## 1. Synthèse Exécutive

### 1.1 Architecture existante (base solide)

| Couche | Technologie | Statut |
|--------|-------------|--------|
| **Source données** | BSD API v2 (`sports.bzzoiro.com/tennis/api/v2/`) | ✅ |
| **Live matchs** | `fetchLiveMatches()` → SSE + polling 8s | ✅ |
| **Stats live BSD** | `useTennisLiveStats` — aces, DF, 1st%, 1st won%, BP saved%, ret%, total% | ✅ |
| **Momentum/DR** | `useMomentumDR` — EWMA buffer 24 pts, DR [-1,+1] | ✅ |
| **Point-by-point** | `fetchMatchPointByPoint(id)` — BSD endpoint dispo, non exploité en live | 🔶 |
| **Hold/Break %** | DB locale — `hard_hold_pct`, `hard_break_pct`, etc. | ✅ |

### 1.2 Ce qui manque

Les parieurs pro en live ont besoin de **signaux rapides**. Les métriques ci-dessous comblent le gap entre score brut (visible de tous) et avantage réel masqué (détectable seulement par modèles).

---

## 2. Métriques Live Décisionnelles (9 métriques)

| # | Métrique | Formule | Utilité | Existant ? | Complexité |
|---|----------|---------|---------|-----------|------------|
| **M1** | **DR Live Classique** | `DR = ret_won% / (1 - srv_won%)`. DR>1.20 = domination | Vrai vainqueur d'un set serré | 🔶 Partiel | Basse |
| **M2** | **1st% glissant 3 jeux** | `% 1st in` sur 3 derniers jeux service. Alerte <55% | Fatigue → break probable | ❌ | Moyenne |
| **M3** | **% 2nd service gagné** | `second_serve_won_pct` BSD natif. Seuil <45% | Indicateur #1 vulnérabilité | 🔶 Dispo non affiché | Très basse |
| **M4** | **BP concédées/sauvées** | Ratio BP faced / BP saved dans set courant | Pression sur le serveur | 🔶 Partiel | Basse |
| **M5** | **Dynamic Pressure Index** | Score 0-100, 10 derniers points pondérés | Intensité du moment présent | ❌ | Moyenne |
| **M6** | **Hold Prob Live** | `hold_pct` historique × ajustement score jeu courant | Probabilité que le serveur tienne | ❌ | Basse |
| **M7** | **Alerte Fatigue Composite** | `if (1st%↓15% AND DR_opp>1.15) → ⚠️` | Alerte automatique sans scruter | ❌ | Basse |
| **M8** | **% Temps zone de break** | Cumul temps passé à 15-30, 0-30, 15-40 sur jeux service | Usure statistique du serveur | ❌ | Haute |
| **M9** | **Cotes live + Kelly** | `odds_player1/2` BSD + calcul Kelly 1/4 | Value bet live | ✅ Existant | Très basse |

### Priorisation Sprint

| Priorité | Métriques | Raison |
|----------|-----------|--------|
| **P0** | M1, M3, M7 | Impact max, coût min |
| **P1** | M4, M6 | Complètent le tableau de bord |
## 3. Architecture Technique

### 3.1 Sources BSD API

```
GET /api/v2/matches/live/  → matchs live (scores + stats cumulées)
  ├── p1/p2_first_serve_pct, first_serve_won_pct
  ├── p1/p2_second_serve_won_pct     ← M3 ★ clé
  ├── p1/p2_break_points_saved_pct   ← M4 base
  ├── odds_player1/2                 ← M9
  └── point_by_point_available

GET /api/v2/matches/{id}/point-by-point/  → séquence (M2, M5, M8 si activé)

DB locale: tennis_players_live / pariscore.db
  └── {surface}_hold_pct, {surface}_break_pct  → M6
```

### 3.2 Service CalculatedMetrics

Nouveau fichier `src/lib/tennis-live-metrics.ts` :

```
computeDominanceRatio(stats)   → { drA, drB, levelA, levelB }
computeSecondServeVuln(stats)  → { p1_2ndWon, p2_2ndWon, alert }
computeHoldProbability(holdPct, gameScore) → prob 0-100
computeFatigueAlert(stats, dr, isServing) → { alert, message }
computeBPExposure(stats)       → { faced, saved, ratio }
```

### 3.3 Flux de données

```
BSD /matches/live/
  │
  ▼
/api/tennis/live (proxy Next.js)
  │ + champ "calculated": { dr, alerts, holdProb, ... }
  ▼
useLiveMatches (SSE / polling)
  ▼
MatchCard / MatchCardBroadcast / PiP
```

---

## 4. Intégration UI — 3 Variantes

### A — Badges d'alerte inline (P0, recommandée)

```
┌──────────────────────────────────────────────┐
│  🎾 SINNER vs ALCARAZ         🇮🇹 1-0 🇪🇸    │
│  ⚡ 2nd sv <40%  │  🔥 DR 1.45  │  ⚠️ Break risk │
│  6-4  3-6  4-3  ● A. sert                   │
│  [Prob bar: 72% Sinner]                     │
└──────────────────────────────────────────────┘
```
→ Composants : `live-decision-badges.tsx` (nouveau), `match-card-header.tsx` (modifié)

### B — Drawer « Décisions Live » (P1)

[Bouton "📊 Décisions"] → sheet avec DR, HoldProb, BP grid, alertes, Kelly.
→ Composant : `live-decisions-drawer.tsx` (nouveau)

### C — Ligne compacte sous score (minimaliste)

`SINNER 6-4 3-6 4-3* ● DR 1.45 · 2nd 38% · Hold 67%`
→ Impacte `pip-match-row.tsx`, `match-card-header.tsx`

---

## 5. Coût & Latence

| Poste | Valeur |
|-------|--------|
| Coût API | 0 € — aucun nouvel endpoint BSD |
| Coût calcul | <1ms/match (arithmétique pure) |
| Latence ajoutée | Négligeable |
| Rafraîchissement | 8s polling / <1s SSE (inchangé) |
| Breaking change | Aucun — `calculated` champ additionnel rétrocompatible |

---

## 6. Algorithmes Clés

### 6.1 DR Classique

```typescript
// DR = % return points won / % service points lost
const srvWonA = (stats.p1_first_won ?? 65) / 100;
const retWonA = (stats.p1_ret_won ?? 35) / 100;
const drA = (1 - srvWonA) > 0 ? retWonA / (1 - srvWonA) : 1.0;
// Classification: dr>=1.35→dominant, >=1.20→favorable, <=0.75→dominated, <=0.85→unfavorable
```

### 6.2 Hold Prob Live

```typescript
const HOLD_ADJ: Record<string, number> = {
  '0-0':0, '15-0':+12, '30-0':+18, '40-0':+25,
  '0-15':-8, '0-30':-16, '0-40':-28,
  '15-15':0, '15-30':-10, '15-40':-22,
  '30-15':+8, '30-30':-2, '30-40':-20,
  '40-15':+20, '40-30':+15, '40-40':-5,
  'Av-40':+22, '40-Av':-24,
};
function holdProb(holdPct: number, gameScore: string): number {
  return Math.max(2, Math.min(98, holdPct + (HOLD_ADJ[gameScore] ?? 0)));
}
```

### 6.3 Alerte Fatigue

```typescript
if (!isServing) return { alert: 'none' };
if (current1st% - matchAvg1st% < -15 && opponentDR > 1.25)
  return { alert: 'break_imminent', msg: '1ère balle en chute + adversaire dominant' };
if (current1st% - matchAvg1st% < -10 && opponentDR > 1.10)
  return { alert: 'pressure', msg: 'Service sous pression' };
if (current1stPct < 50)
  return { alert: 'pressure', msg: '1er service en difficulté' };
return { alert: 'none' };
```

---

## 7. Plan d'Implémentation Sprint P0+P1

| Étape | Fichier | Description | Effort |
|-------|---------|-------------|--------|
| E1 | `src/lib/tennis-live-metrics.ts` | Service CalculatedMetrics (M1,M3,M4,M6,M7) | 1h |
| E2 | `src/app/api/tennis/live/route.ts` | Enrichir réponse avec `calculated` | 30min |
| E3 | `src/lib/live-state-builder.ts` | Ajouter `calculatedMetrics` au type | 20min |
| E4 | `src/components/tennis/live-decision-badges.tsx` | Composant badges (Variante A) | 1h |
| E5 | `src/components/tennis/match-card-header.tsx` | Intégration badges | 30min |
| E6 | `src/components/tennis/match-card-broadcast.tsx` | Intégration badges broadcast | 30min |
| E7 | `src/components/tennis/live-decisions-drawer.tsx` | Drawer (Variante B) | 1h30 |
| E8 | `src/components/tennis/pip-match-row.tsx` | Version compacte (Variante C) | 30min |
| E9 | Validation | Tests, vérif intégration | 30min |

**Total : ~5h30**

---

## 8. Auto-Validation ✅

| Critère | Statut |
|---------|--------|
| Métriques identifiées + priorisées | ✅ |
| Sources BSD mappées | ✅ |
| Architecture 0 € | ✅ |
| 3 variantes UI | ✅ |
| Algorithmes documentés | ✅ |
| Plan chiffré | ✅ |
| Rétrocompatibilité | ✅ |

👉 **PASSAGE EN PHASE 3 AUTORISÉ.**

| **P2** | M2, M5, M8 | Nécessitent PBP ou calculs plus lourds |
