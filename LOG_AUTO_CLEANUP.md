# LOG_AUTO_CLEANUP.md — Live Garbage Collector

## Composant : `startLiveCleanupWorker()`

| Paramètre | Valeur |
|-----------|--------|
| Fréquence | Toutes les **15 minutes** |
| Exécution initiale | Au démarrage du serveur (boot) |
| Fichier | `server.js` — appelé dans le bloc d'init post-boot |

## Critères de rétention

Un match est **supprimé** si :
- `live_status` correspond à `FT`, `AET`, `PEN`, `FT-P`, ou `AET-P` (regex : `/^(FT|AET|PEN|FT-?P|AET-?P)$/i`)
- **ET** `Date.now() - commence_time > 150 minutes` (90min de jeu + 60min de grâce pour prolongations/VAR)

Un match est **conservé** si :
- Statut live actif (non FT)
- Aucun `live_status` (pré-match, géré par `cleanExpiredMatches()`)
- Match terminé mais dans la fenêtre de grâce 150min

## Flux d'exécution

```
runCleanup() toutes les 15min
  └─ scan db.matches
       ├─ match FT + kickoff > 150min → push toRemove[], filter out
       └─ match non-FT → conserver

  si toRemove.length > 0 :
    ├─ broadcastSSE('match_removed', { id }) × N matchs
    └─ saveDB()
```

## Événement SSE émis

```json
event: match_removed
data: { "id": "abc123xyz" }
```

## Traitement Frontend

- `tr[data-match-id]` ciblé via `CSS.escape(id)`
- Transition : `opacity 0 + translateX(-8px)` en 600ms
- Suppression DOM après 650ms
- Si `tbody#vb-body` vide après suppression → affiche "Aucun match en direct actuellement."

## Interaction avec les autres nettoyeurs

| Nettoyeur | Fréquence | Scope |
|-----------|-----------|-------|
| `cleanExpiredMatches()` | À chaque `fetchOdds` | Matchs pré-live > 150min |
| `pollLiveScores` auto-remove | Immédiat (2s) | FT détecté en temps réel via API |
| `startLiveCleanupWorker()` | Toutes les 15min | FT > 150min passés au travers |
| `archivePastMatches()` | Toutes les 4h | Archive vers `history.json` |

## Mémoire RAM

Les matchs supprimés sont retirés de `db.matches` (array en RAM) + `saveDB()` persiste l'état.
Les caches associés (`db.advancedTeamStats`, `db.liveIntensityCache`) ne sont pas purgés par ce worker — ils expirent naturellement via leur TTL propre.
