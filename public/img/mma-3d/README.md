# Portraits 3D des combattants

Rendu **local**, sans IA : `scripts/cartoon3d.mjs` (relief 2.5D + cel-shading,
`bun` + `sharp`, aucun générateur distant). Déterministe.

## Déposer un portrait

1. L'image doit être **carrée et centrée sur le visage** (le composant cadre en
   cercle, `object-cover`). 1024×1024 suffit — l'avatar fait 72 px.
2. Format **WebP**, qualité 82. Un PNG de 1 Mo pour un avatar de 72 px est du
   gaspillage ; si la source est un PNG, converts-la.
3. Nomme le fichier d'après `fighterSlug(nom du combattant)` — le même
   slugillage que `services/mma_fighter_photos.json` : minuscules, accents
   retirés, caractères non-alphanumériques remplacés par `-`.
   - `Benoit Saint Denis` → `benoit-saint-denis.webp`
   - `Alistair Overem` → `alistair-overem.webp`

## Brancher le rendu

Le service lit `services/mma_fighter_3d.json` et **remplace** la photo quand une
entrée existe. Sans entrée, le combattant garde sa photo : le repli est
automatique, le fichier n'a pas besoin d'être complet.

```json
{
  "benoit-saint-denis": "/img/mma-3d/benoit-saint-denis.webp"
}
```

Les portraits vivent sous `public/` et non sur un CDN : ce sont des chemins
locaux, donc ils n'ont pas besoin d'être déclarés dans les `remotePatterns` de
`next.config.ts` (contrairement aux photos distantes, qui y manquent — voir
bead d'audit MMA).

## Rendu local depuis une photo

```bash
bun scripts/cartoon3d.mjs --in <photo> --out public/img/mma-3d --width 1024
```

Produit deux variantes (`<nom>.png` doux + `<nom>-cel.png` dur). Ne committe que
la version webp finale convertie : les PNG intermédiaires sont des poids de
travail, pas des livrables.