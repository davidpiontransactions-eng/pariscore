# Design — Timeline Momentum Football enrichie (corners / buts+buteurs / attaques dangereuses)

**Date** : 2026-08-04 — **Statut** : validé (choix source + moteur approuvés par l'owner)

## Objectif

Enrichir le graphe de momentum du détail d'un match foot (`MomentumChart`)
avec une timeline minute-par-minute : corners, buts + nom du buteur (+ score, xG),
et un indice d'attaques dangereuses. Sources **100 % gratuites** (ESPN public, BSD existant).
Passerelle : `npx tsc --noEmit`.

## Sources

| Source | Endpoint | Fournit | Coût |
|---|---|---|---|
| BSD (existant) | `/v2/events/{id}/stats/` | momentum [-100,+100] /min, xG/min, buts | payante (déjà intégrée) |
| **ESPN public (nouveau)** | scoreboard + `summary?event={id}` + `matchstats?gameId={id}` | buts + buteur + minute + score, corners par minute, tirs (proxy SOT), possession | **gratuit, sans clé** |
| Understat | (report) | xG cumulé | gratuit — non intégré (défaut : xG dérivé BSD) |

**Danger proxy** : ESPN public n'expose pas "attaques dangereuses" par minute → indice
dérivé = `tirs_bucket + 1.8 × corners_bucket` normalisé (label transparent côté UI).

## Moteur Pressure Index (`football-pressure-index.ts`)

Buckets de 5 min `b` :
`M_b = w1·Δdanger_b + w2·Δcorners_b + w3·ΔSOT_b + w4·ΔxG_b` (Δ = home − away),
`w = [0.35, 0.20, 0.25, 0.20]`, normalisation `tanh` → [-100, +100].

**Reconcile BSD** : si momentum BSD par minute présent, resampling aux centres de bucket,
blend `value = 0.55·M_b + 0.45·m_bsd_b`. Sinon engine seul.

**Fallback (ligues mineures)** : `layers.perMinute === false` → courbe lissée
sinusoïdale calibrée sur les totaux (possession/corners), bruit ± sens.

## Pipeline route `/api/football/matches/[id]/stats`

1. `fetchBSDMatchStats` (existant) → anchor momentum + événements buts.
2. Si match live/terminé → `espn-soccer-fetcher` : `findESPNEventId` (map scoreboard
   par names+leagueSlug) puis `fetchESPNTimeline` (summary) + totaux (matchstats).
3. `buildPressureTimeline` → `MatchTimelineData` (source = bsd | espn | bsd+espn).
4. Cache par match 60 s.

## UI — `MomentumChart` (SVG pur, zéro dépendance nouvelle)

- Couche `Momentum` : aire bicolore (vert > 0 domicile, bleu < 0 extérieur) — **conservée**.
- Couche `Corners` : drapeaux (triangles) sur la ligne des minutes, colorés par camp.
- Couche `Buts & Buteurs` : badges ⚽ avec `<title>` (buteur, minute, score, xG).
- Couche `Attaques dangereuses` : mini-histogramme fond (barres home ↑ / away ↓).
- Toggles interactifs : [Momentum] [Corners] [Buts & Buteurs] [Attaques].
- A11y : `<title>` sur marqueurs, aria-label, `role="img"`.

## Validation

- `npx tsc --noEmit` (gate finale).
- `node --check` sur fichiers senseurs.
- Tests unitaires du moteur (buckets, normalisation, reconcile, fallback).
- `/gstack-review` si dispo.

## Fichiers

- `src/lib/football-timeline.ts` (contrat – NEW, écrit par le PM)
- `src/lib/football-pressure-index.ts` (moteur + tests) — T1
- `src/lib/espn-soccer-fetcher.ts` (connecteur) — T2
- `src/app/api/football/matches/[id]/stats/route.ts` (assemblage) — T4
- `src/components/football/momentum-chart.tsx` + `football-match-detail-dialog.tsx` — T3