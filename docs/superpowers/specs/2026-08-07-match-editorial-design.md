# Design — Analyse éditoriale prédictive dans les cartes match

Date : 2026-08-07 · Statut : **Validé** (brainstorming, HARD-GATE levé)

## Problème
Les cartes match tennis/football montrent stats, cotes, probas — mais aucun
**texte prédictif rédigé** pouvant mettre en confiance / provoquer l'engagement.

## Objectif
Afficher dans chaque carte match et modale de détail une **analyse prédictive
écrite, fiable, sourcée**, récupérée automatiquement depuis des sites éditoriaux
de référence, traduite selon la locale, mise en cache (24 h).

## Décisions validées (Q&A)
1. **Périmètre MVP** : Tennis **+ Football** (les deux sports dominants des cartes).
2. **Traduction** : locales `fr` + `en` uniquement ; toute autre locale → `en`.
3. **Francisation** : pendant la locale fr (défaut), traduction **EN→FR via Gemini**, cache 24 h.

## Positionnement dans l'existant
- **Réutilisation plutôt que réécriture** : le scraper éditorial existe déjà
  (`src/lib/scraping/editorial-scraper-service.ts`) : Google News RSS +
  whitelist de domaines (`lastwordonsports.com`, `tennismajors.com`) → résumé
  2-3 phrases + cache mémoire/fichier 24 h. Il n'était branché que sur le
  widget « Top 10 » du dashboard.
- La valeur ajoutée = **orchestration 4 étapes** + **traduction fr** +
  **intégration UI sur 4 surfaces** + **whitelist épck footonnante**.

## Architecture — boucle à 4 étapes (`match-editorial-service.ts`)
```
1. Récupérer   — getEditorialSummary(query) → résumé EN ou "absent".
2. Traduire    — si len (fr) : traduction ENEO→FR via Gemini, cache 24 h.
3. Enrichir    — lier source / url / lang / translated / fetchedAt.
4. Vérifier    — ne jamais throw ; absent/erreur ⇒ texte source ou masquage.
```

### Fichiers
| Fichier | Type | Rôle |
|---|---|---|
| `src/lib/match-editorial-service.ts` | **NOUVEAU** (server-only) | Orchestration 4 étapes + traduction Gemini + cache fr (mémoire+disque) |
| `src/lib/scraping/editorial-scraper-service.ts` | Modifié | Whitelist étendue foot (`footystats.org`, `90min.com`) |
| `src/app/api/v1/editorial/route.ts` | Modifié | Param `lang` (fr\|en) + réponse `{ summary, meta:{lang,translated,ttlSeconds} }` |
| `src/components/ai/editorial-insight.tsx` | **NOUVEAU** (client) | `EditorialInsight` : `compact`/`full` |
| `src/components/football/football-match-card.tsx` | Modifié | Encart compact |
| `src/components/football/football-match-detail-dialog.tsx` | Modifié | Encart full |
| `src/components/tennis/match-card-broadcast.tsx` | Modifié | Encart compact |
| `src/components/tennis/match-card-detail.tsx` | Modifié | Encart full |
| `locales/*.json` (7) | Modifié | Namespace `editorial.*` |
| `COMPONENTS.md` | Modifié | Ligne `editorial-insight` |

## Garde-fous (anti-régression)
- Cache 24 h mémoire + fichier (`.cache/editorial/`), déduplication client 10 min (SWR).
- Pas d'article / traduction KO → l'encart disparaît silencieusement (aucun 5xx).
- Whitelist de domaines (anti-phishing / anti-spam SEO) étendue avec prudence au foot.
- Longueur max (paramètres ≤ 80 chars, texte ≤ max already) comme dans l'existant.

## Acceptance
- 4 surfaces (foot card, foot modal, tennis broadcast, tennis detail) affichent l'encart quand un article fiable est trouvé.
- Locale `fr` → texte traduit (badge « Traduit automatiquement ») ; `en`/autres → texte source.
- `bun run typecheck` + `eslint` passent.
- Aucune donnée de production cassée : absence d'article = UI inchangée.

## Hors scope (v2 possible)
- Football whitelist plus large (The Analyst, etc.).
- Traduction vers d'autres locales par Gemini.
- Génération native (LLM) si aucun éditorial trouvé (fallback).