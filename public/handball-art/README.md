# Assets d'illustrations 3D — onglet Handball

## Utilisation

Déposer les fichiers source dans `source/`, nommés d'après le slug du manifeste
([`src/lib/handball-art.ts`](../../src/lib/handball-art.ts)) :

```
public/handball-art/source/extension-rouge.png
public/handball-art/source/extension-bleu.png
```

Puis :

```bash
node scripts/prep-handball-art.mjs --list    # inspecter les sources
node scripts/prep-handball-art.mjs           # produire les variantes
```

Sorties : `<slug>-1600.webp` (bannière pleine largeur) · `<slug>-800.webp`
(carte) · `<slug>-256.webp` (badge, état d'attente).

## Fonds opaques — pas d'alpha

Les rendus fournis (2026-10-04) portent une **arène floutée en arrière-plan**.
Ce n'est pas un défaut, c'est ce qui pilote toute la composition :

- `HandballHeroBanner` place l'image en `absolute inset-0 object-cover` sur toute
  la largeur, avec le dégradé `from-slate-900 via-slate-900/80 to-transparent`
  par-dessus. Le dégradé est **indispensable** : sans lui, le texte blanc se
  poserait sur un public photo non contrôlé et le contraste ne serait plus
  garanti.
- `MatchCard3D` applique un `mask-image` radial — une image opaque ne peut pas
  « flotter », elle se fond dans la carte.

Il n'y a **donc pas de chroma-key**. Une chaîne de key a été écrite puis
supprimée : elle partait de l'hypothèse d'un joueur détouré, fausse ici. Appliquer
un key à une photo de fond ne produirait qu'un fichier corrompu.

## Aucun recadrage

Le joueur est en plein vol. Le ratio du fichier source est **préservé** ; c'est
`object-position` (`object-[70%_35%]` sur la bannière, `object-left` sur la carte)
qui cadre. Rogner le sujet serait bien pire qu'un ratio non carré.

## Vérifier après génération

- le joueur n'est pas rogné (ballon, pieds) ;
- le dégradé suffit à garder le texte lisible sur les zones claires de la photo ;
- `onError` masque l'image si un fichier manque → bannière sans illustration
  plutôt qu'icône cassée.

## Générer les images par IA (optionnel)

Les prompts sont dans [`docs/handball-art/prompts.md`](../../docs/handball-art/prompts.md).

Aucun script de génération IA n'est fourni : la clé Gemini du projet est en tier
gratuit et les 6 modèles image exposés renvoient tous `HTTP 429`
(`generate_content_free_tier_requests, limit: 0`). Avec une clé facturée, l'appel
HTTP direct suffit — endpoint
`models/<modèle>:generateContent` avec `generationConfig.responseModalities:
["TEXT","IMAGE"]`, puis `scripts/prep-handball-art.mjs` pour les variantes.

## Référence des chemins

Les composants ne référencent jamais ces fichiers en dur : tout passe par
`src/lib/handball-art.ts`. Changer un nom ou une largeur se fait donc à un seul
endroit. `src/lib/__tests__/handball-art.test.ts` verrouille cette cohérence.