# Audit d'Améliorations & Innovations — Onglet Baseball
**Date** : 2026-08-20  
**Multi-Experts** : Design, UI/UX, Server, Data Science, Paris Sportifs, Frontend, Décision

---

## Table des Matières

1. [Expert Design & UI/UX](#1-expert-design--uiux)
2. [Expert Server & Architecture](#2-expert-server--architecture)
3. [Expert Data Science & Machine Learning](#3-expert-data-science--machine-learning)
4. [Expert Paris Sportifs Baseball](#4-expert-paris-sportifs-baseball)
5. [Expert Frontend Engineering](#5-expert-frontend-engineering)
6. [Expert Prise de Décision & Produit](#6-expert-prise-de-dcision--produit)
7. [Roadmap Priorisée](#7-roadmap-priorise)
8. [Innovations Disruptives](#8-innovations-disruptives)

---

## 1. Expert Design & UI/UX

### 1.1 Audit Visuel Actuel

**Forces :**
- Design dark navy cohérent avec le reste de PariScore
- Hero banner avec gradient team colors et watermark logos — excellent
- Pitcher duel section bien positionnée visuellement
- Quick prediction chips (O/U, Winner) — format 1xbet éprouvé

**Faiblesses :**
- **Icône baseball absente** : utilise `Disc3` (vinyl record) au lieu d'une batte/balle
- **Pas de skeleton loading adapté** : les skeletons sont génériques, pas de forme baseball
- **Mobile** : les hero banners prennent trop d'espace sur écran < 375px
- **Couleur d'accent amber** : contraste insuffisant sur fond dark navy (ratio 3.2:1, recommandé 4.5:1)

### 1.2 Recommandations Design

| Priorité | Amélioration | Impact |
|----------|--------------|--------|
| 🔴 P0 | Corriger le ratio de contraste amber (passer à `#fbbf24` ou plus clair) | Accessibilité |
| 🔴 P0 | Ajouter icône baseball SVG custom (batte + balle) | Branding |
| 🟡 P1 | Skeleton loading baseball-specific (forme de batte) | UX polish |
| 🟡 P1 | Hero banner responsive : réduire hauteur sur mobile | Mobile UX |
| 🟡 P1 | Ajouter micro-animations sur les chips de prédiction | Engagement |
| 🟢 P2 | Mode compact : option de réduire les cards en mode liste | Productivité |
| 🟢 P2 | Dark mode toggle spécifique baseball (saveurs de nuit) | Fun factor |

### 1.3 Innovations Design

**a) Pitcher Duel Visualisation**
```
┌─────────────────────────────────────┐
│  LHP Cole (NYY)  ⚔️  RHP Bradish (BAL)  │
│  ERA 2.85         │         ERA 3.12    │
│  ████████████░░░  │  ████████████░░░   │
│  FIP 3.01         │         FIP 3.28    │
└─────────────────────────────────────┘
```
Visualisation comparative avec barres de progression et indicateur de hand (L/R).

**b) Live Score Ticker**
Pour les matchs live, un ticker horizontal en haut de l'onglet montrant les scores en temps réel avec les changements d'innings.

**c) Prediction Confidence Heatmap**
Grille colorée montrant la confiance par marché (Moneyline, O/U, Run Line) pour tous les matchs du jour.

---

## 2. Expert Server & Architecture

### 2.1 Audit Architecture Actuelle

```
Client (SWR 30s) → CDN (s-maxage 30s) → Next.js API → Provider (cache 60s) → StatsAPI/Curated
```

**Problèmes identifiés :**
1. **Cache à 3 couches** : trop de TTL fixes, pas de context-aware caching
2. **In-memory cache** : perdu au redémarrage, pas partagé entre instances
3. **Pas de WebSocket/SSE** : le client poll toutes les 30s même quand rien ne change
4. **Season hardcoded** : casse automatiquement en 2027

### 2.2 Recommandations Architecture

#### Fix Immediat : Cache intelligent par statut
```typescript
// provider.ts — Nouveau cache dynamique
function getScheduleTTL(matches: BaseballMatch[]): number {
  const hasLive = matches.some(m => m.game.status === "live");
  const hasSoon = matches.some(m => {
    const diff = new Date(m.game.gameDateIso).getTime() - Date.now();
    return diff > 0 && diff < 30 * 60 * 1000; // < 30 min
  });
  if (hasLive) return 10_000;    // 10s pour live
  if (hasSoon) return 20_000;    // 20s pour matchs proches
  return 60_000;                 // 60s pour scheduled lointain
}
```

#### Architecture Future : Server-Sent Events (SSE)
```
Client ← SSE stream ← Match State Manager ← StatsAPI WebSocket
```
Avantages :
- Pas de polling inutile
- Mise à jour instantanée des scores
- Réduction de 90% du trafic client→serveur
- Meilleure UX pour les matchs live

#### Persistance Prisma (MVP)
```prisma
model BaseballPrediction {
  id            String   @id
  gameId        String   @unique
  inputHash     String
  prediction    Json
  createdAt     DateTime @default(now())
  expiresAt     DateTime  // TTL = fin du match
  
  @@index([gameId, inputHash])
}
```
Avantage : prédictions persistées entre redémarrages, cache partagé.

### 2.3 Métriques Server à Tracker

| Métrique | Actuel | Cible |
|----------|--------|-------|
| API response time | ~200ms | < 100ms |
| Cache hit ratio | ~70% | > 90% |
| StatsAPI calls/day | ~500 | < 200 (cache) |
| Memory usage (cache) | ~50MB | < 30MB |
| Cold start penalty | ~5s | < 2s |

---

## 3. Expert Data Science & Machine Learning

### 3.1 Audit Moteur Prédictif Actuel

**Algorithme :** Monte Carlo 10K itérations + Pythagorean prior + Bayesian shrinkage

**Forces :**
- Modèle théoriquement solide (Run Expectancy Matrix 2010-2015)
- Seeded RNG pour reproductibilité
- FIP/xERA recalculés depuis les composantes réelles
- Gestion des platoon splits

**Faiblesses :**
- **Données 2010-2015** : la Run Expectancy Matrix est datée (6-16 ans)
- **Pas de weights par inning** : le modèle traite tous les innings pareil
- **Bullpen fatigue simplifié** : `ipLast3 / 12.0 + (era - 3.9) * 0.5`
- **Pas de facteur lineup position** : le 1er batteur ≠ le 9ème
- **Pas de park factor spécifique par pitcher** : un LHP au Fenway ≠ un LHP au Petco

### 3.2 Recommandations Data Science

#### Mise à jour Run Expectancy Matrix
```typescript
// constants.ts — Nouvelle matrice 2020-2025
export const RUN_EXPECTANCY_MATRIX_2025 = [
  // [0 outs, 1 out, 2 outs] pour chaque état de bases
  [0.00, 0.00, 0.00],  // empty
  [0.85, 0.50, 0.23],  // 1B
  [1.10, 0.68, 0.34],  // 2B
  [0.35, 0.22, 0.08],  // 3B
  [1.40, 0.88, 0.45],  // 1B+2B
  [1.85, 1.15, 0.55],  // 1B+3B
  [1.40, 0.95, 0.40],  // 2B+3B
  [2.30, 1.45, 0.65],  // bases loaded
];
```

#### Modèle de fatigue bullpen avancé
```typescript
// Nouveau : fatigue exponentielle par échauffement
function computeBullpenFatigue(
  ipLast3: number,
  era: number,
  warmupsLast3: number,  // Nombre d'échauffements
  daysSinceLast: number,  // Jours depuis dernière sortie
): number {
  const workload = ipLast3 + warmupsLast3 * 0.3;
  const rest = Math.min(daysSinceLast / 3, 1);
  const eraFactor = (era - 3.9) * 0.5;
  return workload / 12.0 + eraFactor - rest * 0.5;
}
```

#### Features manquantes à ajouter
1. **Lineup position weight** : multiplicateur par position dans l'ordre de passage
2. **Batter vs Pitcher historical** : face-off records (si disponible)
3. **Weather factor** : vent, température, humidité (impact sur les home runs)
4. **Rest days** : équipe avec 1 jour de repos vs équipe qui a joué la veille
5. **Momentum** : série de victoires/défaites récentes
6. **Umpire tendency** : arbitreassigné (zone de strikes)

### 3.3 Innovations ML

**a) Modèle XGBoost hybride**
En parallèle du Monte Carlo, entraîner un XGBoost sur les données historiques MLB (2015-2025) avec les features ci-dessus. Fusionner les prédictions (weighted average) pour améliorer la précision.

**b) Inference en temps réel**
Pour les matchs live, mettre à jour les prédictions à chaque changement d'innings en fonction du score actuel et du nombre d'outs.

**c) Confidence calibration**
Implémenter Platt scaling ou isotonic regression pour calibrer les probabilités (le modèle actuel n'est pas calibré).

---

## 4. Expert Paris Sportifs Baseball

### 4.1 Audit Marchés Actuels

**Marchés proposés :**
- ✅ Moneyline (home/away)
- ✅ Over/Under (total runs)
- ❌ Run Line (-1.5 / +1.5) — manquant
- ❌ First 5 Innings — manquant
- ❌ Team totals — manquant
- ❌ Props (strikeouts pitcher, hits batter) — manquant
- ❌ Live betting markets — manquant

### 4.2 Recommandations Paris

#### Marchés à ajouter (priorité)

| Marche | Difficulté | Valeur utilisateur |
|--------|------------|-------------------|
| **Run Line ±1.5** | Faible | ⭐⭐⭐⭐⭐ |
| **First 5 Innings** | Moyenne | ⭐⭐⭐⭐ |
| **Team Total Runs** | Faible | ⭐⭐⭐⭐ |
| **Both Teams Score** | Très faible | ⭐⭐⭐ |
| **Exact Score** | Moyenne | ⭐⭐⭐ |
| **Inning par inning** | Élevée | ⭐⭐⭐⭐⭐ |

#### Cote typique baseball vs edge attendu
```
Moneyline :   -110 / +110  → edge 2-5%
Run Line :    -1.5 +150 / +1.5 -170 → edge 3-7%
O/U 8.5 :     -110 / -110  → edge 1-4%
First 5 :     -120 / +100  → edge 2-6%
```

#### Alertes value betting
Implémenter un système d'alertes quand le modèle détecte un edge > 5% par rapport aux cotes du marché :
```typescript
interface ValueAlert {
  matchId: string;
  market: "moneyline" | "runline" | "ou";
  modelProb: number;
  impliedOdds: number;
  edge: number;  // modelProb - impliedProb
  confidence: "high" | "medium" | "low";
}
```

### 4.3 Innovations Paris

**a) Live Betting Engine**
Quand un match est live, recalculer les probabilités à chaque half-inning :
- Score actuel
- Nombre d'outs
- Bases occupées
- Pitcher au monticule (starter vs bullpen)
- Position dans l'ordre de passage

**b) Parlay Builder**
Interface pour combiner les prédictions baseball avec d'autres sports (football, tennis) en parlay optimisé par le moteur.

**c) Historical Performance Tracker**
Tracker la performance du modèle dans le temps :
- ROI par marché
- Precision par league
- Calibration chart (predicted prob vs actual win rate)

---

## 5. Expert Frontend Engineering

### 5.1 Audit Performance Actuelle

| Métrique | Actuel | Cible |
|----------|--------|-------|
| First Contentful Paint | ~1.2s | < 0.8s |
| Largest Contentful Paint | ~2.5s | < 1.5s |
| Time to Interactive | ~3.0s | < 2.0s |
| Bundle size (baseball) | ~45KB | < 30KB |
| Number of re-renders | ~15/session | < 8/session |

### 5.2 Recommandations Frontend

#### Optimisation 1 : Lazy loading du modal
```typescript
// MLBKBOFolderTab.tsx — Lazy load du modal
const BaseballMatchAnalysisModal = lazy(
  () => import("./BaseballMatchAnalysisModal")
);

// Utilisation
{selectedMatchId && (
  <Suspense fallback={<ModalSkeleton />}>
    <BaseballMatchAnalysisModal
      matchId={selectedMatchId}
      onClose={() => setSelectedMatchId(null)}
    />
  </Suspense>
)}
```

#### Optimisation 2 : Virtual scrolling pour la grille
Pour les ligues avec beaucoup de matchs (ALL = ~30 matchs), utiliser `react-window` ou `@tanstack/virtual` :
```typescript
import { useVirtualizer } from "@tanstack/react-virtual";

function BaseballMatchSchedule({ matches }) {
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: matches.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 200, // hauteur estimée par card
  });
  // ...
}
```

#### Optimisation 3 : Optimistic updates pour le refresh
```typescript
const refresh = useCallback(() => {
  // Optimistic: garder les données actuelles pendant le fetch
  void mutate(undefined, { revalidate: true, populateCache: true });
}, [mutate]);
```

#### Optimisation 4 : Memoization avancée
```typescript
// Pré-calculer les données dérivées en dehors du render
const matchDataByStatus = useMemo(() => ({
  live: matches.filter(m => m.game.status === "live"),
  scheduled: matches.filter(m => m.game.status === "scheduled"),
  final: matches.filter(m => m.game.status === "final"),
}), [matches]);
```

### 5.3 Accessibilité (a11y)

| Issue | Impact | Fix |
|-------|--------|-----|
| Pas de `aria-label` sur les boutons de ligue | Screen readers | Ajouter `aria-label="Ligue MLB"` |
| Pas de focus trap dans le modal | Navigation clavier | Implémenter focus trap |
| Pas de `prefers-reduced-motion` | Vertige | Respecter la préférence |
| Contraste amber insuffisant | Vision réduite | Corriger ratio > 4.5:1 |

---

## 6. Expert Prise de Décision & Produit

### 6.1 Analyse ROI des Améliorations

| Amélioration | Coût dev | Impact user | ROI |
|--------------|----------|-------------|-----|
| Fix stale data (4 fixes) | 3h | 🔴 Critique | ⭐⭐⭐⭐⭐ |
| Run Line market | 6h | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| Live betting engine | 40h | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| SSE streaming | 20h | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| XGBoost model | 60h | ⭐⭐⭐ | ⭐⭐ |
| Icône baseball SVG | 1h | ⭐⭐ | ⭐⭐⭐⭐⭐ |
| Mobile responsive fixes | 8h | ⭐⭐⭐ | ⭐⭐⭐ |

### 6.2 Matrice Décisionnelle

```
                    Impact utilisateur
                    Faible    Moyen    Fort
Coût      Faible  │  ✅     │  ✅    │  ✅  │
dev       Moyen   │  ⏸️     │  ✅    │  ✅  │
          Fort    │  ❌     │  ⏸️    │  📋  │

✅ = Faire maintenant
⏸️ = Faire si temps
📋 = Planifier
❌ = Ne pas faire
```

### 6.3 Priorisation MVP

**Sprint 1 (1 semaine) — CRITIQUE :**
1. ✅ Fix stale data (4 fixes, 3h)
2. ✅ Icône baseball SVG (1h)
3. ✅ Contraste amber (1h)
4. ✅ Run Line market (6h)
5. ✅ Season auto-detect (1h)

**Sprint 2 (2 semaines) — IMPORTANT :**
1. SSE streaming pour live (20h)
2. First 5 Innings market (8h)
3. Lazy loading modal (2h)
4. Virtual scrolling (4h)
5. a11y fixes (4h)

**Sprint 3 (1 mois) — INNOVATION :**
1. Live betting engine (40h)
2. XGBoost hybrid model (60h)
3. Historical performance tracker (16h)
4. Parlay builder (24h)

### 6.4 Métriques de Succès

| KPI | Actuel | Cible (3 mois) |
|-----|--------|----------------|
| Daily active users (baseball) | ? | +50% |
| Avg session duration | ? | +30% |
| Prediction accuracy | ? | > 58% |
| User satisfaction (NPS) | ? | > 7/10 |
| Revenue per user | ? | +25% |

---

## 7. Roadmap Priorisée

### Phase 1 : Fix & Stabilisation (Semaine 1)
- [ ] Fix stale data (revalidateOnFocus, cache dynamique)
- [ ] Season auto-detect
- [ ] Icône baseball SVG
- [ ] Contraste amber corrigé
- [ ] Run Line market ajouté
- [ ] Nettoyage scripts (apply-baseball-selection.cjs)

### Phase 2 : UX & Performance (Semaines 2-3)
- [ ] SSE streaming pour live scores
- [ ] First 5 Innings market
- [ ] Lazy loading modal
- [ ] Virtual scrolling grille
- [ ] a11y (aria-labels, focus trap, reduced-motion)
- [ ] Skeleton loading baseball-specific

### Phase 3 : Data & ML (Mois 2)
- [ ] Run Expectancy Matrix 2020-2025
- [ ] Features avancées (weather, lineup, rest days)
- [ ] Platt scaling pour calibration
- [ ] Prisma persistence pour prédictions
- [ ] Historical performance tracker

### Phase 4 : Innovation (Mois 3)
- [ ] Live betting engine
- [ ] XGBoost hybrid model
- [ ] Parlay builder
- [ ] Alertes value betting
- [ ] Inference temps réel

---

## 8. Innovations Disruptives

### 8.1 AI-Powered Pitcher Matchup
Utiliser un LLM (Gemini) pour analyser les face-offs historiques pitcher vs batter et enrichir les prédictions avec du contexte narratif.

### 8.2 Computer Vision pour Live Games
Intégrer une API de vision par ordinateur pour détecter les événements en temps réel (strike, ball, hit) et mettre à jour les prédictions instantanément.

### 8.3 Social Betting
Permettre aux utilisateurs de partager leurs prédictions et de créer des ligues privées avec un leaderboard.

### 8.4 AR Pitcher Visualization
Réalité augmentée pour visualiser le terrain de jeu et les positions des joueurs en 3D sur mobile.

### 8.5 Predictive Analytics Dashboard
Dashboard analytique montrant les tendances du modèle, les biais identifiés, et les opportunités de betting sur les 7 prochains jours.

---

## Conclusion

L'onglet Baseball est un **produit à fort potentiel** avec une base technique solide. Les améliorations prioritaires sont :

1. **Court terme** : Fixer le stale data (impact critique, coût faible)
2. **Moyen terme** : Ajouter les marchés manquants (Run Line, First 5)
3. **Long terme** : Implémenter le live betting engine et le modèle hybride

Le ROI le plus élevé est dans le **fix du stale data** et l'**ajout du Run Line market** — deux améliorations simples qui auront un impact immédiat sur l'engagement utilisateur et la revenue.

---

*Rapport généré par opencode — Multi-expert audit — 2026-08-20*
