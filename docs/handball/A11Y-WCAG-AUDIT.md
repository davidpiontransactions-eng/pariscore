# Audit WCAG 2.1 — onglet Handball

Date : 2026-10-04 · périmètre : `src/components/handball/` (24 fichiers)

## Résultat : le problème est systémique, pas ponctuel

Les couleurs d'accent sont conçues comme **accents sur fond sombre** (la charte
dark navy + vert néon) et sont utilisées comme **texte sur carte blanche**. Sur
fond clair, aucune n'atteint le seuil AA de 4.5:1 :

| couleur | rôle | sur blanc | verdict AA |
|---|---|---|---|
| `#00e676` | vert de charte | **1.67:1** | échec |
| `#f59e0b` | ambre (cote nul) | **2.15:1** | échec |
| `#10b981` | emerald (gain) | **2.54:1** | échec |
| `#0ea5e9` | sky (cote ext.) | **2.77:1** | échec |
| `#e11d48` | rose (cote ext.) | 4.70:1 | conforme |
| `#717171` | gris secondaire (~240 occ.) | 4.88:1 clair / **3.86:1 sur navy** | échec en dark |

`#717171` est le cas le plus volumineux : il est le texte secondaire de tout
l'onglet, et il **échoue en mode sombre** (3.86 contre 4.5 exigés).

## Le piège du fond figé

`#222222` sur carte blanche vaut 15.91:1 — parfaitement conforme. Sur navy en
dark, 1.18:1 — invisible. **Un `text-[#222222]` sans variante `dark:` n'est un
bug que si la surface qu'il pose devient sombre.** Une carte
`bg-white … text-[#222222]` sans `dark:bg-*` reste blanche dans les deux thèmes :
le texte y est correct et « le corriger » serait un gâchis.

C'est pourquoi la moitié des remontées brutes d'un audit par regex sont des faux
positifs : elles ignorent le fond réel.

## Valeurs de remplacement (calcul exact, arithmétique pure)

Aucune de ces valeurs ne dérive d'un parsing du code — le calcul est sur :

| usage | actuel | remplacer par (4.5:1) | (3:1, si ≥ 24px ou gras) |
|---|---|---|---|
| vert de charte, sur blanc | `#00e676` | `#008846` | `#00ab58` |
| emerald, sur blanc | `#10b981` | `#0c875e` | `#0fa976` |
| sky, sur blanc | `#0ea5e9` | `#0b7eb2` | `#0d9ee0` |
| ambre, sur blanc | `#f59e0b` | `#a46a07` | `#ce8509` |
| gris secondaire, sur navy | `#717171` | `#7c7c7c` | — |

Contrôle croisé : chaque valeur « sur blanc » reste largement conforme sur navy
(6.79 à 11.28:1), donc on n'échange pas un échec contre un autre.

## Ce que l'audit ne peut PAS trancher

Un parseur statique de className ne sait pas, sur ce codebase :

- distinguer un **ancêtre** d'un **frère** dans un template literal imbriqué
  (source des ratios absurdues du type « `#f59e0b` sur `#f59e0b` ») ;
- résoudre le texte qui **hérite de la cascade** (classes nommées sans couleur
  figée), les `style={{}}` inline, les fonds transverses (`backdrop-blur`,
  images, dégradés) ;
- connaître le **hex réel du navy de la charte** — AGENTS.md dit « dark navy »
  sans le donner. Ici `#0b1120` ; **si cette valeur est fausse, tous les ratios
  sombres le sont aussi.** C'est le seul paramètre non dérivable du code.

Épinglé dans l'outil : `SURFACE_DARK`.

## Méthode pour trancher le reste : mesurer la page rendue

Un audit statique a produit 3 itérations et ~55 % de faux positifs avant d'être
utilisable. Pour aller plus loin, la seule source de vérité est la page rendue :

```bash
# 1. ouvrir l'onglet Handball en mode sombre
# 2. extraire pour chaque noeud texte : color() + backgroundColor() calculés
# 3. calculer le ratio
```

Playwright est déjà dépendance de dev et le harnais `tests/apk-webview.spec.ts`
existe. C'est la voie à prendre pour une vérification exhaustive — pas une
quatrième version du parseur.

## Vérification rapide sans outillage

Dans les DevTools, sur un texte en échec :

```
getComputedStyle($0).color
getComputedStyle($0).backgroundColor
```

Puis `(L1 + 0.05) / (L2 + 0.05)`, L = luminance relative. Si
`backgroundColor` est `rgba(0,0,0,0)`, remonter les parents jusqu'à trouver un
fond opaque — c'est exactement l'étape que l'audit statique rate.