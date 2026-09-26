# Fix des 5 warnings lint préexistants — 2026-09-26

**Bead :** `ParisScorebis-ltan` · **Statut :** ✅ clos
**Gates :** `bun run lint` → 0 erreur, 0 warning · `bun run typecheck` → OK

## Warnings corrigés

| # | Fichier | Warning | Cause | Fix |
|---|----------|---------|-------|-----|
| 1 | `src/app/api/tennis/tournament/[slug]/contenders-matches/route.ts:28` | Directive `eslint-disable-next-line @typescript-eslint/no-explicit-any` inutilisée | La règle `no-explicit-any` n'est pas active dans la config ESLint du projet → la directive ne supprime rien | Directive supprimée (le `as any` reste, légal) |
| 2 | `src/app/api/tennis/tournament/[slug]/draw/route.ts:64` | Idem | Idem | Directive supprimée |
| 3 | `src/lib/top-matches/cs2.ts:14` | Idem | Idem | Directive supprimée |
| 4 | `src/app/error.tsx:53` | `@next/next/no-location-assign-relative-destination` : navigation interne via `window.location.href = "/"` | Error boundary route-level : le context router est intact (les hooks `useTranslations`/`useAnalytics` fonctionnent déjà) | `useRouter()` de `next/navigation` + `router.push("/")` dans le handler du bouton « Accueil » |
| 5 | `src/app/global-error.tsx:83` | Idem | **Attention** : note build en tête du fichier — contexte providers potentiellement cassé quand le root layout crashe (useContext null en prerender), `useRouter()` interdit ici | `window.location.href = window.location.origin` — destination **absolue** (hors périmètre de la règle qui ne vise que les destinations relatives), recharge complète = comportement voulu pour un root layout cassé |

## Points d'attention

- `global-error.tsx` : **ne pas** remplacer par `useRouter()` — le fichier est
  volontairement « minimal page, no providers, no hooks » (note build : le
  /_global-error par défaut plante en prerender statique Turbopack + Bun,
  digest 3255200895). La navigation reste un `window.location` plein rechargement,
  voulu dans ce contexte.
- Les 3 directives supprimées dataient probablement d'une époque où
  `no-explicit-any` était activée puis retirée de la config ; ESLint 9 signale
  désormais les directives mortes.
- Vérification post-fix : `bun run lint` n'affiche plus de bloc « ✖ N problems ».

## Vérification finale

```
bun run lint     → (aucune sortie warning/error)
bun run typecheck → OK
```
