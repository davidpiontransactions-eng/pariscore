# Design — Highlights du tour précédent dans le détail match tennis

Date : 2026-08-07 · Statut : **Validé** (brainstorming, approche A approuvée)

## Problème
La modal de détail match tennis affiche stats, cotes, H2H et un widget
highlights du duel (`LastMatchHighlightsWidget`), mais **n'expose pas les
highlights du dernier match réellement joué par chaque joueur** (adversaire,
score, tour). L'utilisateur ne peut pas « voir » la forme du joueur en vidéo.

## Décisions validées (Q&A)
1. **Cohabitation** : service + widget **dédiés** coexistent avec l'existant
   `last-match-highlights-service.ts` / `LastMatchHighlightsWidget`.
2. **Endpoint dédié** : nouveau `GET /api/v1/previous-match-highlights`, qui
   résout le dernier match de chaque joueur + recherche YouTube en un service.
3. **Extraction YouTube** : scrap HTML type existant (aucune clé API, zéro
   coût), fallback TennisTV non dupliqué.
4. **Fallback cascade + filtre surface** : requête ajustée selon la surface
   actuelle du duel quand `stats.surface` la fournit.
5. **Surface UI** : onglet **Overview** de `match-detail-dialog.tsx` (à côté du
   H2H actuel — pas de conflit).
6. **Sémantique** : label « Tour précédent » si même tournoi, sinon « Dernier match ».

## Architecture — Option A (approuvée)

```
1. Résolution    — fetchMatchH2H(matchId) → player1_last5 / player2_last5, prendre
                   le « finished » le plus récent (match_date desc).
                   BSD KO (clé absente / 429 / 402 / timeout) → contexte-nul :
                   adversaire inconnu, requête générique, label « Dernier match ».
2. Sémantique    — tournament_name du match résolu == tournoi courant
                   → label "tour-precedent" (+ round_name), sinon
                   → label "dernier-match".
3. Requête       — cascade YouTube par joueur (adversaire réel + surface + tournoi + année) :
                   q1 = "{A} vs {adv} highlights {tournoi} {année}"
                   q2 = "{A} vs {adv} highlights"  (si q1 vide)
                   q3 = "{A} highlights {tournoi} {année}" (si adversaire inconnu)
                   q4 = "{tournoi} highlights"  (dernier recours)
4. Cache          — clé "highlights:previous_round:{player_id}:{match_id}",
                   TTL 48 h, mémoire + fichier (.cache/highlights-previous/).
```

### Fichiers (nouveaux / modifiés)

| Fichier | Type | Rôle |
|---|---|---|
| `src/services/previous-match-highlights-service.ts` | **NOUVEAU** (server-only) | Orchestration 4 étapes, ne throw jamais |
| `src/lib/` (services YouTube réutilisés) | Modifié | Exporter `searchYouTube` + `pickBest` (ajout `export`, aucune logique) |
| `src/app/api/v1/previous-match-highlights/route.ts` | **NOUVEAU** | Endpoint dédié, validation + réponse structurée |
| `src/hooks/use-previous-match-highlights.ts` | **NOUVEAU** (client) | Hook SWR null-safe |
| `src/components/tennis/previous-match-highlights-widget.tsx` | **NOUVEAU** | Bloc 2 sous-cartes côte-à-côte |
| `src/components/tennis/match-detail-dialog.tsx` | Modifié | Intégration dans Overview |
| `src/lib/bsd-tennis-service.ts` | (inchangé) | `fetchMatchH2H` déjà dispo |
| `scripts/test-previous-highlights.ts` | **NOUVEAU** | Test 2 duels en cours |
| `COMPONENTS.md` | Modifié | Ligne `previous-match-highlights-widget` |
| `locales/*.json` (7) | Modifié | Clés `highlightsPrevious.*` |
| `CHANGELOG.md` | Modifié | Section v12.95 |

## Détail données & types

- `BSDH2H` fournit `player1_last5: BSDMatch[]`, `player2_last5: BSDMatch[]`.
  `BSDMatch` donne : `tournament {name, surface}`, `round_name`, `match_date`,
  `player1_sets`/`player2_sets`, `sets_detail`, `player1.id`/`player2.id`.
- Résolution du vainqueur : `player1_sets > player2_sets` → player1 gagne.
- Score affiché : `sets_detail.map(s => `${s.p1}-${s.p2}`).join(", ")` sinon
  `"{p1_sets}-{p2_sets}"`.

**Réponse endpoint** (jamais 5xx) :
```json
{
  "players": [
    {
      "playerId": "123",
      "label": "tour-precedent" | "dernier-match",
      "context": {
        "round": "R2",
        "tournament": "Roland Garros",
        "surface": "Terre battue",
        "opponent": "M. Dupont",
        "won": true,
        "score": "6-4, 7-5"
      },
      "video": { "videoId": "...", "title": "...", "url": "..." } | null
    },
    { "playerId": "124", "label": "tour-precedent", "context": { ... }, "video": null }
  ],
  "meta": { "ttlSeconds": 172800 }
}
```

## Détail UI (`previous-match-highlights-widget.tsx`)

- Grid `grid-cols-1 sm:grid-cols-2` : une carte par joueur, **côte-à-côte** en
  desktop, empilées en mobile.
- Chaque carte = encart contexte (1 ligne, texte 10-11px) + iframe 16/9
  youtube-nocookie (`allowfullscreen`, `loading="lazy"`, `sandbox` minimale —
  héritage du pattern `LastMatchHighlightsWidget`).
- Zéro vidéo pour les 2 → composant rend `null` (masqué), pas d'erreur.
- Label encart : « Tour précédent » / « Dernier match » + context.

## Testing

- `scripts/test-previous-highlights.ts` : commande `bun run test:highlights`, résoudre 2 duels
  en cours via l'API, afficher par joueur label/contexte/videoId, sortie 0 si ≥1
  vidéo trouvée, 1 sinon.
- `npx tsc --noEmit` et `bun run lint` sans erreurs bloquantes.
- En local/CI sans clé BSD : le service retourne contexte-nul + requête
  générique (pas de crash).

## Hors scope v1
- Football (réservé à tennis pour ce MVP).
- Recherche par surface réelle du tour précédent (liée à la résolution
  historique → la surface courante du duel est utilisée dans la requête).
- Filtrage chaîne YouTube (vidéo exacte du tour précédent non garantie ;
  la cascade retombe sur « dernière vidéo du joueur »).