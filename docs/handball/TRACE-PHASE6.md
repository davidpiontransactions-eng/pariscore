# Traceabilité — Phase 6 : Enrichissement Handball

**Date**: 2026-09-16

---

## Phase 6.1 — Dialog détail match

**Fichier créé**: `src/components/handball/handball-match-detail-dialog.tsx`

### Contenu
- Dialog shadcn/ui (`Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`)
- Props : `{ match, open, onOpenChange }`
- Affichage : équipes, score, minute live, MT, stats (7m, arrêts, 2min), cotes 1X2
- Pattern : miroir `football-match-detail-dialog.tsx` simplifié

---

## Phase 6.2 — Modèle xG handball

**Fichier créé**: `src/lib/handball-xg.ts`

### Contenu
- 7 zones de tir H-xT (Broermann 2026) :
  - `6m_center` : 40% xG (pivot central)
  - `6m_wing` : 30% (ailière)
  - `9m_center` : 20% (arrière central)
  - `9m_wing` : 15% (arrière ailière)
  - `7m` : 75% (penalty)
  - `fastbreak` : 55% (contre-attaque)
  - `backcourt` : 5% (tir de loin)
- `shotXg(zone, efficiency?)` — xG pour un tir
- `teamMatchXg(shots, distribution, efficiency)` — xG total équipe
- `TYPICAL_ZONE_DISTRIBUTION` — distribution moyenne elite
- `BASELINE_TEAM_XG` — xG baseline équipe moyenne

---

## Phase 6.3 — Banker bet widget

**Fichier créé**: `src/components/handball/handball-banker.tsx`

### Contenu
- Hook `useHandballTop8` → cherche meilleur pick parmi `valueBet` + `bestTeam`
- Seuil : probPct ≥ 65% (STRONG_THRESHOLD)
- Tri par EV décroissante
- UI : carte gradient emerald, pick + probabilité + EV + explication
- Null si aucun pick assez fort (jamais de pick faible)

---

## Phase 6.4 — Classements ligue

**Fichier créé**: `src/components/handball/handball-rankings.tsx`

### Contenu
- Table standings : Rang, Équipe, MJ, V, N, D, BP, BC, Diff, Pts, PPG
- Couleur diff : emerald (+), rouge (-)
- Fetch `/api/handball/standings?league=<id>`

**Fichier créé**: `src/app/api/handball/standings/route.ts`

### Contenu
- Route API standings avec `createTtlCache`
- TTL : 30 min
- Appel `fetchHandballStandings(leagueId)` depuis `handball-api.ts`

---

## Fichiers créés (Phase 6)

| Fichier | Statut |
|---------|--------|
| `src/components/handball/handball-match-detail-dialog.tsx` | **NOUVEAU** |
| `src/lib/handball-xg.ts` | **NOUVEAU** |
| `src/components/handball/handball-banker.tsx` | **NOUVEAU** |
| `src/components/handball/handball-rankings.tsx` | **NOUVEAU** |
| `src/app/api/handball/standings/route.ts` | **NOUVEAU** |

---

## Phase 6 ✅ TERMINÉE
- Dialog détail match : ✅
- Modèle xG handball (H-xT Broermann 2026) : ✅
- Banker bet widget : ✅
- Classements ligue : ✅
- typecheck : 0 erreurs
