# Free Sports APIs → PariScore

Inventaire des APIs **gratuites** (public-apis Sports & Fitness + pricing 2026) mappées aux champs PariScore.

## Fichiers

| Fichier | Rôle |
|---------|------|
| **[MAP-API-PARISCORE-FIELDS.md](./MAP-API-PARISCORE-FIELDS.md)** | **Map maître** champ ↔ API + chaînes de fallback |
| `wiki-entity-therundown.md` | Cotes multi-book free (P0) |
| `wiki-entity-oddsmagnet.md` | Historique cotes UK (P0) |
| `wiki-entity-sportscore.md` | Live scores no-key (P0) |
| `wiki-entity-openligadb.md` | Foot DE crowdsourced (P1) |
| `wiki-entity-propline.md` | Props + exchanges (P1) |
| `wiki-entity-cloudbet.md` | Feed book crypto (P1) |
| `wiki-entity-openf1.md` | F1 telemetry (P2) |
| `wiki-entity-jolpica-f1.md` | F1 Ergast successor (P2) |
| `wiki-entity-sportmonks.md` | Foot free 2 ligues (P3) |
| `wiki-entity-balldontlie.md` | NBA free limité (P2) |

## Graphify

```bash
graphify update API/FreeProviders
graphify query "TheRundown odds bookmakers"
graphify path "TheRundown" "fetchOdds"
```

Graphe généré : `API/graphify-out/` et `API/FreeProviders/graphify-out/`.

## Env keys

Voir `.env.example` section « Free sports APIs ».
