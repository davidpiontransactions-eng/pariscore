# Prompts — illustrations 3D cartoon de l'onglet Handball

> ⚠️ **PÉRIMÉ pour les assets actuels.** Les 2 rendus fournis le 2026-10-04 ont un
> **fond opaque** (arène floutée), pas d'alpha. Le chroma-key décrit plus bas ne
> leur s'applique pas. Ces prompts restent utiles **si tu veux générer d'autres
> visuels** dans le même style.

## État au 2026-10-04 — 2 rendus reçus

`extension-rouge` (maillot rouge #13) et `extension-bleu` (maillot bleu #13, barbu).

Déposer les sources dans `public/handball-art/source/` puis :

```bash
node scripts/prep-handball-art.mjs
```

Aucun chroma-key nécessaire — voir
[`public/handball-art/README.md`](../../public/handball-art/README.md).

## Pourquoi ces images ne sont pas générées ici

Les 6 modèles image exposés par la clé Gemini du projet
(`gemini-2.5-flash-image`, `gemini-3.1-flash-{lite-,}image`,
`gemini-3.1-flash-image-preview`, `gemini-3-pro-image`, `nano-banana-pro-preview`)
renvoient tous :

```
HTTP 429 — You exceeded your current quota
  Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests,
  limit: 0, model: gemini-*-image
```

Le tier gratuit n'a **aucun quota de génération d'image** (limite = 0). Il faut une
clé facturée. Le CLI `bl` (Aliyun Bailian) ne convient pas non plus : package
privé, absent de npm.

---

## Choix de formulation

**« Pixar » est conservé** dans les prompts (choix explicite du commanditaire).
Deux conséquences à connaître, non bloquantes :

1. **Juridique** — ces assets iraient dans le branding commercial de PariScore.
   Citer un studio dans une illustration est une exposition réelle (droit à
   l'image d'œuvre / marque). Une formulation générique
   (`3D animated feature-film style`) rend le même visuel sans le risque.
2. **Filtre** — Gemini peut refuser le prompt sur certains modèles. Le script
   remonte alors le statut HTTP et le message ; il ne tente pas de contourner.

**Les flags Midjourney** (`--ar 16:9 --stylize 250 --v 6.0`) ont été retirés :
DALL-E 3 et Gemini les rejetent. Chaque prompt ci-dessous est donc utilisable tel
quel sur les trois plateformes ; pour Midjourney, ré-ajouter `--ar 1:1
--stylize 250 --v 6` en suffixe.

**Fond vert et non transparent — PÉRIMÉ** — l'API Gemini ne rend pas d'alpha. Les
prompts ci-dessous demandent un aplat chroma vert `#00FF00` pour un détourage
local par `sharp` (workflow VFX classique). **Les rendus finalement retenus n'en
ont pas besoin** : fond opaque assumé. Ces prompts restent valides pour qui
régénère et souhaite un détouré ; pour un fond opaque, supprimer le suffixe
`CHROMA` ci-dessous.

---

## Direction artistique commune

Factorisée dans le script (`STYLE`) pour que les 3 rendus partagent la même
la même palette et le même éclairage — sans quoi on obtient 3 images qui ne vont
ensemble dans un même bandeau.

```
3D animated feature-film style, Pixar-quality stylized character render,
subsurface scattering on skin, soft cinematic key light with warm rim light,
shallow depth of field, vibrant saturated colors, unreal engine 5 render quality,
clean expressive face, high detail on sportswear texture, 8k
```

## Suffixe commun (`CHROMA`)

```
The character is completely isolated on a PURE SOLID GREEN SCREEN background,
flat uniform chroma green #00FF00, no shadow cast on the background, no gradient,
no vignette, no props. The green must be exactly flat so it can be keyed out.
```

---

## Image 1 — Joueuse #10 en saut de tir

`extension-feminine`

```
A female professional handball player jumping high in the air to shoot, dynamic
airborne pose with one arm fully extended holding a red and white handball above
her head, wearing a bright blue jersey with the number 10 and dark blue shorts,
black knee pads, mid-leap with legs tucked, confident focused expression.
```

## Image 2 — Joueur #13 barbu en extension

`extension-masculine`

```
A strong bearded male handball player flying through the air for a powerful jump
shot, holding a red and white handball in his right hand, wearing a bright blue
athletic jersey with the number 13 and dark blue shorts, thick dark beard, short
dark hair, intense determined expression, powerful torso twist.
```

## Image 3 — Attaquant #19 en extension rouge

`extension-attaque`

```
A male handball player leaping high and horizontally across the court in a flying
horizontal shooting posture, body stretched out parallel to the floor, holding a
red and white handball ready to throw, wearing a bright red kit with the number 19
and red shorts, determined aggressive expression, dramatic action angle from below.
```