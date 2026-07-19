# Spec: Sports Tabs Redesign — MMA, Cycling, Real Data Only, UI Refonte

**Date** : 2026-07-19
**Statut** : Design validé, pré-implantation

---

## 1. Objectif

Transformer la page d'accueil PariScore en hub multi-sports premium :
- **4 onglets principaux** : Tennis | Football | MMA | Cycling
- **Zéro donnée mock** : chaque sport consomme des données réelles (API ou simulation calibrée)
- **Refonte UI complète** : design system unifié inspiré Sofascore/Flashscore, palette dark premium

---

## 2. Architecture des Onglets

### 2.1 Navigation
- Barre d'onglets horizontale avec scroll custom (pas de débordement)
- Indicateur animé sous l'onglet actif (accent vert `#00E676`)
- Persistance : l'onglet actif est stocké dans un `searchParam` (`?tab=football`)
- Ordre : Tennis (prioritaire, existant), Football, MMA, Cycling

### 2.2 Structure Fichiers
```
src/app/page.tsx                    — Onglets + routing
src/components/layout/sport-tabs.tsx — Barre d'onglets scrollable
src/components/football/             — Football (existant, à refondre UI)
  football-tab-content.tsx           — Onglet complet (refonte)
  football-live-card.tsx            — Carte live (refonte)
  football-match-card.tsx           — Carte prematch (refonte)
  football-filters.tsx              — Filtres (refonte)
src/components/tennis/
  tennis-tab-content.tsx            — Existant, à extraire depuis football/
  match-card.tsx                    — Carte tennis (UI à homogénéiser)
src/components/mma/                  — Nouveau
  mma-tab-content.tsx
  mma-fight-card.tsx
  mma-filters.tsx
src/components/cycling/              — Nouveau
  cycling-tab-content.tsx
  cycling-stage-card.tsx
  cycling-filters.tsx
```

---

## 3. Sources de Données (Zero Mock)

| Sport | Source | Fichier Next.js API Route | Cache |
|-------|--------|--------------------------|-------|
| Tennis | BSD Tennis API | `src/app/api/tennis/prematch/route.ts` (inchangé) | 5 min |
| Tennis | BSD Tennis API (live) | `src/app/api/tennis/live/route.ts` (inchangé) | 30s |
| Football | BSD Football API | `src/app/api/football/matches/route.ts` (supprimer fallback mock) | 5 min |
| Football | BSD Football API (live) | `src/app/api/football/live/route.ts` (supprimer fallback mock) | 30s |
| MMA | The Odds API + DRatings + ML model | `src/app/api/mma/fights/route.ts` (NOUVEAU) | 5 min |
| Cycling | cyclingService.js (simulation) + cyclingstage.com | `src/app/api/cycling/route.ts` (NOUVEAU) | 30 min |

### 3.1 Règle stricte : pas de fallback mock
- Si une API échoue → renvoyer `{"error":"service unavailable","source":"..."}`
- Le frontend affiche un état d'erreur explicite (bannière "Service indisponible")
- Plus jamais de données fictives silencieuses

### 3.2 MMA — Détail d'implantation
Wrapping de `services/mmaService.js` (CommonJS) dans une Next.js Route Handler :
```ts
// src/app/api/mma/fights/route.ts
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const mmaService = require("@/services/mmaService");
    const fights = await mmaService.getMMAFights(process.env.ODDS_API_KEY);
    return NextResponse.json({ fights, source: "odds-api+ml" });
  } catch (err) {
    return NextResponse.json(
      { error: "mma data unavailable" },
      { status: 503 }
    );
  }
}
```

### 3.3 Cycling — Détail d'implantation
Wrapping de `services/cyclingService.js` (CommonJS) :
```ts
// src/app/api/cycling/route.ts
export async function GET() {
  const cyclingService = require("@/services/cyclingService");
  const data = await cyclingService.getCyclingFull();
  return NextResponse.json(data);
}
```

Le modèle reste la simulation Plackett-Luce (validée par l'utilisateur), mais on supprime le flag `mock` dans la réponse — c'est le modèle officiel.

---

## 4. Design System Unifié

### 4.1 Palette
```
--bg-primary:     #0F0F1A    (fond page)
--bg-card:        #1A1A2E    (fond cartes)
--bg-card-hover:  #222240    (hover cartes)
--border:         #2A2A4A    (bordures subtiles)
--text-primary:   #F5F5FF    (texte principal)
--text-secondary: #9090B0    (texte secondaire)
--accent-green:   #00E676    (accent PariScore, live)
--accent-tennis:  #4CAF50    (vert tennis)
--accent-football:#2196F3    (bleu football)
--accent-mma:     #FF5722    (orange MMA/UFC)
--accent-cycling: #9C27B0    (violet cyclisme)
--live-pulse:     #FF1744    (point rouge live)
```

### 4.2 Cartes sport
Chaque sport a son propre design de carte, mais suit un squelette commun :
- **Header** : logo championnat/tournoi + nom + statut (live/prematch)
- **Corps** : équipes/joueurs/coureurs avec scores (live) ou cotes (prematch)
- **Footer** : odds bookmakers, probas modèle, bouton détail
- **Live** : fond avec bordure gauche accentuée de la couleur du sport + pulsation live

### 4.3 États
Chaque composant d'affichage de données doit gérer :
1. **Chargement** : squelette shimmer (bloc gris animé)
2. **Données** : contenu normal
3. **Erreur** : bannière "Service momentanément indisponible" + bouton recharger
4. **Vide** : "Aucun match prévu" avec illustration discrète

### 4.4 Animations
- Transition d'onglet : fade + slide horizontal (150ms ease-out)
- Apparition cartes : staggered fade-up (délai 50ms par carte)
- Live pulse : animation clignotante sur le point rouge
- Hover carte : scale(1.02) + ombre renforcée

---

## 5. Frontend — page.tsx Refonte

### 5.1 Layout
```tsx
export default function Home() {
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") || "tennis";

  return (
    <div className="min-h-screen bg-[#0F0F1A]">
      <SportTabs activeTab={tab} />
      <main className="px-4 py-6 max-w-7xl mx-auto">
        {tab === "tennis" && <TennisTabContent />}
        {tab === "football" && <FootballTabContent />}
        {tab === "mma" && <MmaTabContent />}
        {tab === "cycling" && <CyclingTabContent />}
      </main>
    </div>
  );
}
```

### 5.2 SportTabs
```tsx
const SPORTS = [
  { id: "tennis", label: "Tennis", color: "#4CAF50" },
  { id: "football", label: "Football", color: "#2196F3" },
  { id: "mma", label: "MMA", color: "#FF5722" },
  { id: "cycling", label: "Cycling", color: "#9C27B0" },
];
```

Barre scrollable avec indicateur animé sous l'onglet actif. Scroll fluide (snap).

---

## 6. Phases d'Implémentation

### Phase 1 — API Routes (priorité zéro mock)
- [ ] Créer `/api/mma/fights` (wrapper mmaService.js)
- [ ] Créer `/api/cycling` (wrapper cyclingService.js)
- [ ] Supprimer fallback mock dans `/api/football/*`
- [ ] Supprimer fallback mock dans `/api/tennis/prematch`

### Phase 2 — Composants UI Nouveaux
- [ ] `SportTabs` (barre onglets custom scrollable)
- [ ] `MmaTabContent` + `MmaFightCard` + `MmaFilters`
- [ ] `CyclingTabContent` + `CyclingStageCard` + `CyclingFilters`

### Phase 3 — Refonte UI Existants
- [ ] Refonte `TennisTabContent` / `FootballTabContent` (design system unifié)
- [ ] États chargement/erreur/vide pour tous les composants
- [ ] Animations (fade, stagger, pulse)

### Phase 4 — page.tsx Finale
- [ ] Remplacer l'ancienne logique d'onglets
- [ ] Test build + déploiement VPS

---

## 7. Questions en Suspens

- Les services `mmaService.js` et `cyclingService.js` utilisent `require('better-sqlite3')` — Next.js API routes peuvent importer en CJS via `require()` ou `import()` dynamique. À vérifier en Phase 1.
- MMA : les photos de combattants (stockées localement) doivent être servies via Next.js public/ ou une route dédiée.
- Cycling : les images (coureurs, équipes, profils) sont dans `public/images/cycling/` — vérifier qu'elles sont accessibles.
