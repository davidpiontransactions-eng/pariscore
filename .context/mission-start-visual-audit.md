# Mission Start Report — Audit Visuel Top 10 Football

**Date** : 2026-09-03
**Bead** : `ParisScorebis-jb6d`
**Objectif** : Audit visuel — Vérifier l'affichage des championnats et drapeaux pays dans le widget Top 10 Football

## Contexte

L'utilisateur signale : *"Je ne vois pas les championnats et les drapeaux des pays..."*. 

Cette mission fait suite aux modifications précédentes portant sur :
- Enrichissement de `StrategyMatchEntry` avec `leagueId`, `leagueCountry`, `leagueLogo`
- Création de `league-logos.json` + `league-logos.ts`
- Modifications précédentes : badges 0-100, stakes, xG quality, tooltip, CTA

## État actuel des fichiers clés

| Fichier | Actions précédentes | Statut actuel |
|---------|--------------------|---------------|
| `src/lib/football-strategy-top5.ts` | Type enrichi + populate des champs | ✅ Type enriched |
| `src/data/league-logos.json` | Seed de 30 ligues + URLs | ✅ Créé |
| `src/lib/league-logos.ts` | Module lookup avec fallback | ✅ Créé |
| `src/components/football/football-strategy-top5-widget.tsx` | ⚠️ Restoré à l'état git d'origine | ❌ Modifications perdues |

## Problème identifié

Les modifications d'affichage (drapeau emoji + ligue name dans la badge) ont été **restorées** à l'état git d'origine, ce qui signifie :
- Le type `StrategyMatchEntry` possède toujours les champs `leagueId`, `leagueCountry`, `leagueLogo`
- Mais le widget `football-strategy-top5-widget.tsx` n'affiche plus ces informations
- L'utilisateur ne voit plus les championnats et drapeaux pays

## Objectifs de l'audit

1. **Vérifier** que les données `leagueId`, `leagueCountry`, `leagueLogo` sont bien peuplées dans `StrategyMatchEntry`
2. **Vérifier** que le widget `football-strategy-top5-widget.tsx` affiche bien ces informations
3. **Identifier** la cause racine de l'invisibilité
4. **Corriger** le bug et réimplémenter l'affichageリーグ logo + drapeau pays

## Ressources disponibles

- `COUNTRY_TO_CODE` (60+ pays) — `src/lib/bsd-football-fetcher.ts:67-95`
- `countryFlag()` — Fonction existante — `src/lib/bsd-football-fetcher.ts:93-101`
- `flag-utils.ts` — CDN flagcdn.com pour PNG fallback
- `TOP_LEAGUE_LOGOS` — Cartographie curated (~20 ligues) — `lib/logo-cascade.js:507`
- `BSD CDN pattern` — `sports.bzzoiro.com/img/league/{id}/`

## Plan d'action

```
1. [Investigation] Vérifier le flux de données : type → widget → affichage
2. [Debug] Trouver pourquoi l'affichage est cassé
3. [Fix] Réimplémenter l'affichage ligue logo + drapeau pays
4. [Quality gates] typecheck + lint
5. [Mission end] Rapport final
```

---

## 🚀 Lancement de l'audit

Je vais maintenant investiguer le flux de données depuis le type `StrategyMatchEntry` jusqu'à l'affichage dans le widget.
<tool_call>
<function=todowrite>
<parameter=todos>
[{"content": "Rapport début de mission — audit visuel", "priority": "high", "status": "completed"}, {"content": "Investigation — Pourquoi leagues/drapeaux invisibles?", "priority": "high", "status": "in_progress"}, {"content": "Correction des bugs identifiés", "priority": "high", "status": "pending"}, {"content": "Quality gates: typecheck + lint", "priority": "high", "status": "pending"}, {"content": "Rapport fin de mission — résultats et métriques", "priority": "high", "status": "pending"}]