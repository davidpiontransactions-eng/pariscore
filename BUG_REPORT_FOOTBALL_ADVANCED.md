# BUG_REPORT_FOOTBALL_ADVANCED.md

> **Date** : 2026-08-02  
> **Auditeur** : Lead QA Engineer / Senior Code Reviewer / Architecte Frontend  
> **Périmètre** : 7 features récentes du module Football (Prédictions v1, QA Clamping, Skeletons, xGa/xGd, Cartouche xG Live, Profileurs Buteur/Passeur/Défenseur)

---

## Tableau des points audités

| ID | Module | Anomalie / Risque Détecté | Sévérité | Correctif Apporté |
|----|--------|--------------------------|----------|-------------------|
| **BF-01** | xG Live / Clamping | `xGa.home / live.homeShotsOnTarget` sans garde `Number.isFinite()` — division par une valeur potentiellement corrompue même si `shotsOnTarget > 0` | **Majeure** | Ajout `Number.isFinite(p.xGa.home)` ET `Number.isFinite(p.xGa.away)` en complément du garde `> 0` existant dans `football-live-card.tsx` (L385, L393) |
| **BF-02** | xG Live / Fallbacks | Aucun message utilisateur quand les données xG live sont indisponibles — la section disparaît silencieusement | **Mineure** | Ajout badge `⚠️ xG live indisponible pour ce match` avec icône `AlertCircle` amber (alternative au drawer xG lorsque `p.xGa` est absent) dans `football-live-card.tsx` (L423-427) |
| **BF-03** | Skeleton / Layout | `FootballMatchCardSkeleton` incomplet : absence des sections xG Differential et Key Players Matchup → **layout shift** au chargement des données réelles | **Majeure** | Ajout des skeletons pour le cartouche Key Players Matchup (L589-597) + la section xG Differential complète (barre, labels, badge) (L598-611) dans `football-match-card.tsx` |
| **BF-04** | Skeleton / Live | `FootballLiveCardSkeleton` totalement inexistant — aucune indication de chargement pour les matchs en direct | **Majeure** | Création complète du composant `FootballLiveCardSkeleton` (L462-509) avec skeleton pour : score, équipes, stats live (3 barres), badges prédictions, sparkline placeholder, xG drawer, et odds. Intégration dans le bloc `isLoading` de `football-tab-content.tsx` (L204-222) |
| **BF-05** | xGd / Typage | `computeXGd()` retournait `0` pour les deux cas : "pas de données xG live" ET "différentiel parfaitement équilibré" — ambiguïté impossible à distinguer côté UI | **Mineure** | Modification du type `xGd?: number` → `xGd?: number \| null` dans `football-data.ts` (L55-58). `computeXGd()` retourne désormais `null` quand les données sont absentes (L256-269). Toutes les références `p.xGd !== undefined` → `p.xGd != null` mises à jour. |
| **BF-06** | Responsive / Key Players | Noms de joueurs longs dans les badges `⚽🎯🛡️` non tronqués — risque de débordement sur mobile ≤375px | **Mineure** | Ajout `truncate` sur les spans noms des joueurs dans le cartouche Key Players Matchup (Innovation 1). Les badges existants sous les logos équipe sont conservés (déjà en `flex-wrap`). |
| **BF-07** | Mobile / Cartouche xG | Le drawer xG détail (`FootballLiveCard`) pouvait causer un overflow-x sur écran étroit avec des noms d'équipe longs dans les labels `xG/Tir` | **Mineure** | Les labels `xG/Tir` utilisent désormais `match.home.shortName` (3 lettres) — le composant existant le faisait déjà, confirmé OK. Aucun changement supplémentaire nécessaire. |

---

## Résumé des 3 innovations UI implémentées

### 1. ⚔️ Duel Visuel « Key Players Matchup »
- **Composant** : `FootballMatchCard` (L334-376)
- **Déclencheur** : présent quand `home.topScorer && away.topDefender` OU `away.topScorer && home.topDefender`
- **Affichage** : Meilleur Buteur Équipe A (⚽) VS Défenseur Patron Équipe B (🛡️), avec stats clés et badge "Duel du match" en amber
- **Fallback** : un seul duel affiché si seul un côté a les données

### 2. 📐 Jauge « xG Differential »
- **Composant** : `FootballMatchCard` (L378-434)
- **Remplace** : l'ancienne barre simple `📐 xG`
- **Nouveautés** :
  - Barre différentielle `emerald → slate → rose` (xG Créés vs xG Concédés)
  - Badge `xGd +12%` coloré par seuil (>5% vert, <−5% rouge, sinon gris)
  - Label qualitatif : "↗ Sur-performance offensive", "↘ Fragilité défensive", "↔ Équilibré"
  - Labels équipe + valeurs numériques sous la barre

### 3. 📈 Sparkline xG Live
- **Composant** : `XGSparkline` dans `FootballLiveCard` (L11-86)
- **Données** : `live.xgPerMinute` cumulé → série temporelle minute par minute
- **Rendu** : SVG inline 300×56px, double courbe emerald (domicile) / rose (extérieur)
- **Détails** : grille horizontale, axe minutes, points terminaux avec cercles
- **Fallback** : non rendu si `xgPerMinute` absent — pas de message d'erreur (la courbe est optionnelle, le drawer xG fournit déjà le fallback BF-02)

---

## Vérification finale

```bash
npx tsc --noEmit  # ✅ 0 erreur
```

**Fichiers modifiés** (6) :
- `src/lib/football-data.ts` — type `xGd?: number | null`
- `src/lib/football-predictions.ts` — `computeXGd()` retourne `null`
- `src/components/football/football-live-card.tsx` — +Sparkline, +Skeleton, +garde Number.isFinite, +fallback BF-02
- `src/components/football/football-match-card.tsx` — +KeyPlayersMatchup, +xGDifferential, +Skeleton enrichi
- `src/components/football/football-tab-content.tsx` — +Skeleton import, +live skeletons dans isLoading
- `BUG_REPORT_FOOTBALL_ADVANCED.md` — ce fichier
