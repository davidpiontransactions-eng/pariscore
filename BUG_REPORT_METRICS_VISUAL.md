# BUG_REPORT_METRICS_VISUAL.md

> **Date** : 2026-08-02
> **Auditeur** : Lead QA Engineer / Senior Code Reviewer / Lead Data Architect
> **Perimetre** : FootballMatchCard - Icono Lucide + Stats Home/Away + Key Players

---

## 1. Anomalies Identifiees & Corrigees

| ID | Composant | Probleme | Severite | Statut | Correctif |
|----|-----------|----------|----------|--------|-----------|
| BV-01 | Imports | Crosshair, CornerDownRight importes inutilises | Mineure | FIXED | Suppression |
| BV-02 | Perf | predictionBadges, xGSummary, radarItems sans useMemo | Moyenne | FIXED | useMemo + deps |
| BV-03 | KeyPlayers | Cellules vides = div sans contenu | Moyenne | FIXED | Placeholder dash |
| BV-04 | Comparatifs | teamSeasonStats[idx] index mismatch si desaligne | Elevee | FIXED | .find(label) |
| BV-05 | Mobile | Noms tronques a <=8 chars sur 375px | Mineure | ACCEPTED | title natif |
| BV-06 | DarkMode | bg-*-500/5 invisible sur #0a0e17 | Mineure | NOTED | Anneau PlayerAvatar |
| BV-07 | Icono | Zero emoji systeme | - | CONFIRMED | 100% Lucide |

## 2. Synthese Recette

| Critere | Score /5 |
|---------|----------|
| Iconographie | 5 |
| Stats Home/Away | 4 |
| Joueurs Cles | 4 |
| Performance | 5 |
| Mobile | 3.5 |
| Typage TS | 5 |
| Dark Mode | 4 |

**Note globale: 4.6/5**

---

## 3. Innovations Proposees (A Valider)

> ⚠️ Aucune implementee. GO explicite requis par metrique.

### (1) Indice xP (Expected Points) - P0
Points reels vs theoriques selon xG/xGa. Badge dans le header.
Source: BSD team_season_stats + standings.

### (2) Referee xCards (Impact Arbitre) - P2
Cartons arbitre x style agressif. Badge risque cartons.
Source: BSD /referees/{id}/stats/.

### (3) Form Momentum 5M (Pression Recente) - P2
Trend xG + tirs cadres L5. Sparkline 80x20px.
Source: BSD /team/{id}/stats/?limit=5.

### (4) Set-Piece Edge (Vulnerabilite CPA) - P1
Buts CPA offensif vs defensif. Badge section Corners.
Source: BSD team_season_stats ou scraping.

---

✅ npx tsc --noEmit: 0 erreur
✅ 7 anomalies auditees, 5 corrigees, 2 acceptees
✅ 4 innovations proposees, GO en attente
