# apidojo TransferMarket — Endpoints

*Host `transfermarket.p.rapidapi.com` · `GET` · headers `X-RapidAPI-Key` + `X-RapidAPI-Host` · ✅ confirmé (WebSearch/doc) · ⚠ inféré (conventions apidojo, valider en playground RapidAPI)*

## Confirmés

| Méthode | Path | Rôle | Params |
|---|---|---|---|
| GET | `/search` | Recherche globale : joueurs, entraîneurs, clubs, compétitions, arbitres | `query` (terme), `domain`, `search_type` (player/club/...) |
| GET | `/transfers/list` | Liste des transferts (derniers / records) | `domain`, filtres période/compétition |
| GET | `/transfers/list-market-value` | Transferts triés par valeur marchande | `domain`, `minValue`, `maxValue` (optionnels) |
| GET | `/players/get-short-info` | Infos brèves joueur(s) | `ids` (id(s) joueur), `domain` |
| GET | `/players/get-performance-detail` | Détail performance joueur par saison/compétition | `id`, `seasonID`, `competitionID`, `domain` |
| GET | `/players/get-transfer-history` | Historique transferts joueur | `id`, `domain` |
| GET | `/players/v2/get-transfer-history` | Historique transferts joueur (v2) | `id`, `domain` |

## Inférés ⚠ (conventions apidojo — à confirmer playground RapidAPI)

| Méthode | Path | Rôle |
|---|---|---|
| GET | `/transfers/list-rumors` *(ou via `/news`)* | **RUMEURS transferts** — endpoint cible PariScore (chemin exact à confirmer) |
| GET | `/news/list` | Transfer news |
| GET | `/players/get-market-value` | Évolution valeur marchande joueur |
| GET | `/players/get-profile` | Profil détaillé joueur |
| GET | `/players/get-injuries` | Blessures joueur |
| GET | `/clubs/get-profile` | Profil club |
| GET | `/clubs/list-by-competition` | Clubs d'une compétition |
| GET | `/competitions/get-table` | Classement compétition |
| GET | `/competitions/search` | Recherche compétition |

## Paramètre commun `domain`
`com | de | be | es | it | nl | pl | pt | com.tr | world`

## Cible PariScore (issue dj1)
Rumeurs : **`/transfers/list-rumors`** (ou flux `/news` filtré) — **chemin exact + params + quota free à valider en playground RapidAPI** avant câblage. Le reste (transferts confirmés, valeurs, profil, blessures) déjà couvert gratuitement par felipeall self-host → ne PAS doublonner via RapidAPI (économie quota).

## Incertitudes
- Endpoint rumeurs : nom exact non confirmable (pages JS) — marketing apidojo garantit la donnée « rumors », pas le path.
- Params précis par endpoint partiellement inférés des conventions apidojo (cf. Bloomberg/Realtor même éditeur).
