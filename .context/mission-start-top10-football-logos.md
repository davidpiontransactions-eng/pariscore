# Mission Start Report — Top 10 Football: League Logo + Country Flag

**Date** : 2026-09-03
**Bead** : `ParisScorebis-jb6d`
**Objectif** : Ajouter le logo de ligue + drapeau pays dans le widget Top 10 Football

## Contexte

L'utilisateur a constaté que le widget Top 10 Football affiche le nom du championnat mais **pas le logo de la ligue ni le drapeau du pays**. Seules 15 ligues mappées manuellement dans `LEAGUE_COLORS` (widget-local) avec des emojis drapeau génériques — pas de vrais logos.

## État actuel

| Champ | Disponible ? | Source |
|-------|-------------|--------|
| `entry.league` (nom) | ✅ | `BSDFootballMatch.league.name` |
| `entry.leagueId` | ❌ | `BSDFootballMatch.league.id` (perdu au mapping) |
| `entry.leagueCountry` | ❌ | `BSDFootballMatch.league.country` (perdu au mapping) |
| `entry.leagueLogo` | ❌ | BSD CDN : `sports.bzzoiro.com/img/league/{id}/` (existe mais pas utilisé) |
| Country → ISO code | ✅ | `COUNTRY_TO_CODE` map (60+ pays) |
| Flag emoji | ✅ | `countryFlag()` function |
| Flag CDN PNG | ✅ | `flag-utils.ts` : `getFlagUrl()` |
| Logo curated | ✅ | `TOP_LEAGUE_LOGOS` (~20 ligues) dans `logo-cascade.js` |

## Infrastructure réutilisable

1. **`COUNTRY_TO_CODE`** (60+ pays) — `src/lib/bsd-football-fetcher.ts:67-95`
2. **`countryFlag()`** — emoji drapeau depuis nom pays
3. **`flag-utils.ts`** — CDN flagcdn.com pour PNG fallback
4. **BSD CDN pattern** — `https://sports.bzzoiro.com/img/league/{id}/`
5. **`club-logos.ts` pattern** — O(1) lookup via JSON statique

## Plan d'exécution (4 étapes)

### Étape 1 — Enrichir le type `StrategyMatchEntry`
- **Fichier** : `src/lib/football-strategy-top5.ts`
- Ajouter 3 champs optionnels : `leagueId?: number`, `leagueCountry?: string`, `leagueLogo?: string`
- Populer dans `computeStrategyTop5Matches` depuis `s.fixture.league`

### Étape 2 — Créer `league-logos.json` + `league-logos.ts`
- **Fichiers** : `src/data/league-logos.json`, `src/lib/league-logos.ts`
- Seed statique (~30 ligues majeures) avec URLs TheSportsDB
- Lookup O(1) comme `club-logos.ts`
- Fallback : BSD CDN URL via `leagueId`

### Étape 3 — Mettre à jour le widget
- **Fichier** : `src/components/football/football-strategy-top5-widget.tsx`
- Remplacer le badge texte par : `🇨🇵 [logo] Ligue 1`
- `<img>` pour le logo (12px), emoji pour le drapeau, nom de la ligue

### Étape 4 — Quality gates
- `bun run typecheck` → 0 errors
- `bun run lint` → 0 errors

## Métriques de succès

| Métrique | Cible |
|----------|-------|
| Ligues avec logo | ≥30 top ligues européennes + coupes |
| Ligues avec drapeau | Toutes (via `countryFlag()`) |
| Régression typecheck | 0 nouveau error |
| Régression lint | 0 nouveau warning |
| Bundle size impact | <5KB (JSON + 2 fichiers TS) |

## Fichiers cibles

| Fichier | Type | Statut |
|---------|------|--------|
| `src/lib/football-strategy-top5.ts` | Modifier | ⏳ |
| `src/data/league-logos.json` | Créer | ⏳ |
| `src/lib/league-logos.ts` | Créer | ⏳ |
| `src/components/football/football-strategy-top5-widget.tsx` | Modifier | ⏳ |

## Skills utilisés

- `implement` — exécution du plan
- `verification-before-completion` — gates qualité
- `code-review` — review post-implémentation (optionnel)

## Risques identifiés

| Risque | Mitigation |
|--------|-----------|
| Logos CDN indisponibles | Fallback emoji `⚽` |
| Pays non mappé dans `COUNTRY_TO_CODE` | Default code `UN` (Unknown) |
| Performance (téléchargement logos) | `<img>` lazy + petit format 16x16 |
| Type breaking change | Champs optionnels `?:` → backward compatible |
