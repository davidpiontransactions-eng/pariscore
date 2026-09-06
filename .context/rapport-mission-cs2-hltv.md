# Rapport Mission — Refonte Onglet CS2 + HLTV Stats

**Date** : 2026-09-06
**Statut** : ✅ RÉSOLU

---

## Résumé exécutif

| Item | Statut |
|------|--------|
| Fix football parasite | ✅ Complété |
| Scraper HLTV maps & équipes | ✅ Complété |
| API /api/cs2/hltv-stats | ✅ Complété |
| UI Cs2HltvStatsPanel | ✅ Complété |
| Typecheck | ✅ 0 errors |
| Lint | ✅ 0 errors (1 warning pré-existant) |
| Build | ✅ OK |
| Deploy VPS | ✅ PM2 restart OK, health 200 |
| Graphify | ❌ ENOBUFS (repo trop gros pour graphify) |

---

## 1. Fix Football Parasite

**Root cause** : `BestMatchesTabs` (`src/components/dashboard/best-matches-tabs.tsx`) avait son propre `activeTab` local (défaut: "tennis"), déconnecté de la navigation parente. Quand l'utilisateur était sur CS2, le widget "Meilleurs Matchs du Jour" affichait tennis/football.

**Fix** (2 fichiers) :
- `src/components/dashboard/best-matches-tabs.tsx` : ajout prop `sport?: string`, `effectiveTab` override local state, tab bar masquée quand sport imposé
- `src/app/page.tsx:464` : `<BestMatchesTabs sport={activeTab} />`

**Résultat** : onglet CS2 → widget montre CS2 ; onglet Tennis → tennis ; etc.

---

## 2. Scraper HLTV Stats Maps & Équipes

**Script** : `tools/scrape-hltv-stats.js` (~300 lignes)

**Données extraites** (via `gigobyte/hltv` npm) :
- **Team overview** : mapsPlayed, K/D ratio, wins/draws/losses, roundsPlayed
- **Per-map stats** : winrate (0-100%), wins, losses, totalRounds pour les 7 cartes actives
- **Roster** : lineup actuelle (id + nom)
- **Map pool agrégé** : winrate moyen top-30 par carte, top-5 teams par carte

**Sortie JSON** :
- `data/hltv_team_stats.json` — stats détaillées par équipe (top-30)
- `data/hltv_map_pool.json` — stats globales par carte

**Infrastructure** :
- FlareSolverr fallback (même pattern que `scrape-oddalerts.js`)
- Sessions réutilisées (`FLARE_SESSIONS=2`)
- Delay 8s entre équipes (Cloudflare mitigation)
- Cron : `0 3 * * 0` (dimanche 03:00 UTC)

**Usage** :
```bash
bun run scrape:hltv                    # top-30, FlareSolverr auto
bun run scrape:hltv -- --limit=5       # smoke test
bun run scrape:hltv -- --team=Vitality # une équipe
```

**Note** : HLTV bloque les IPs datacenter. Le script nécessite une IP résidentielle ou FlareSolverr (installé sur VPS).

---

## 3. API Endpoint

**Route** : `GET /api/cs2/hltv-stats`

**Query params** :
- `?team=Vitality` — filtre par nom d'équipe
- `?map=Mirage` — filtre par carte
- `?ranked=1` — top-15 uniquement

**Response** :
```json
{
  "teamStats": { "teams": [...], "generated": "2026-09-06" },
  "mapPool": { "mapPool": { "Mirage": { "avgWinrate": 52, "teams": [...] } } },
  "cached": true,
  "age": 86400000
}
```

---

## 4. UI — Cs2HltvStatsPanel

**Composant** : `src/components/cs2/Cs2HltvStatsPanel.tsx`

**Fonctionnalités** :
- Vue "Équipes" : liste filtrable avec recherche, K/D coloré, W/D/L, sélection → winrate par carte
- Vue "Cartes" : winrate moyen top-30, top-5 teams par carte
- Loading skeleton, error state avec instruction `bun run scrape:hltv`
- Intégré dans `HLTVMatchSheetModal` comme 4e onglet "Stats HLTV"

---

## 5. Fichiers modifiés/créés

| Fichier | Action |
|---------|--------|
| `src/components/dashboard/best-matches-tabs.tsx` | Modifié (+prop sport, effectiveTab) |
| `src/app/page.tsx` | Modifié (+sport={activeTab}) |
| `tools/scrape-hltv-stats.js` | **Créé** |
| `src/lib/cs2/hltv-stats-types.ts` | **Créé** |
| `src/app/api/cs2/hltv-stats/route.ts` | **Créé** |
| `src/hooks/use-hltv-stats.ts` | **Créé** |
| `src/components/cs2/Cs2HltvStatsPanel.tsx` | **Créé** |
| `src/components/cs2/HLTVMatchSheetModal.tsx` | Modifié (+onglet Stats HLTV) |
| `package.json` | Modifié (+hltv dep, +scrape:hltv script) |

---

## 6. Git

```
commit: a32c1dcd feat(cs2): fix football leak + HLTV stats scraper + UI panel
9 files changed, 1012 insertions(+), 6 deletions(-)
```

---

## 7. Graphify

❌ `graphify update` échoue avec `ENOBUFS` (buffer overflow sur repo volumineux). À exécuter manuellement avec un scope plus étroit ou sur un poste avec plus de RAM.

---

## 8. Prochaines étapes

1. **Exécuter le scraper HLTV** depuis une IP résidentielle : `bun run scrape:hltv`
2. **Copier les JSON** vers VPS : `scp data/hltv_*.json ubuntu@vps:/home/ubuntu/pariscore/data/`
3. **Graphify** : exécuter manuellement ou avec `--scope src/components/cs2`
4. **UI Behance** : la refonte visuelle complète (MatchCard premium, dark mode épuré) reste à faire — les composants existants utilisent déjà le dark theme mais le design system n'est pas encore harmonisé avec l'inspiration Behance
