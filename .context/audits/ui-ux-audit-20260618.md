# AUDIT UI-UX - Design et Accessibilite

Score: 6.8/10 | Equipe: GStack-UI-UX

## Bugs trouves

- UI-1 (MAJOR): Pas de lang=fr sur balise html
- UI-2 (MEDIUM): innerHTML sans _tnEsc sur certains chemins
- UI-3 (LOW): Metriques vides sans placeholder explicite
- UI-4 (HIGH): Focus visible absent sur [tabindex]
- UI-5 (MEDIUM): Pas de support daltonisme (couleurs seules)
- UI-6 (LOW): age||27 au lieu de age??27 dans server.js:37279

## Top 3 pour passer a 10/10

1. :focus-visible sur tous les elements interactifs
2. Skeleton loading pour les metriques
3. Dark/light mode via prefers-color-scheme
