# T1 — Mesure styles FotMob clair (`fotmob.com/fr?date=20260908`)

Méthode : Playwright headless, `getComputedStyle` sur 7 ligues / 47 matchs live.
Toutes les valeurs ci-dessous sont **mesurées**, pas devinées.

## Tokens (light)
| Élément | Propriétés mesurées |
|---|---|
| Page | bg `#fafafa`, texte noir, police Walsheim (fallback sans) |
| Carte ligue | bg `#ffffff`, radius `16px`, bordure `#f0f0f0` |
| Ligne match | bg `#ffffff`, séparateur `#f5f5f5` 1px |
| Header ligue | bg `#f5f5f5`, texte noir `14px/400`, h-12 |
| Score | `#222222` `14px/500`, `tabular-nums` ajouté (lisibilité) |
| Minute live | `#00985f` `12px/500` (+ pastille minute même teinte) |
| Heure prematch | `#717171` `14px/500` |
| Noms équipes | `#222222` `14px/400`, `truncate` |
| Badge live `x/y` | blanc sur `#00985f`, radius `12px`, `11px/500` |
| Raison `FM` | `#717171` `12px/400` |
| Pillule Suivre | fond `#f0f0f0`, étoile sombre |
| Pillule `Groupe H` | texte `#222` `12px/500`, fond transparent, bordure `#f5f5f5`, radius `8px` |

## Non repris (pas de donnée)
Icônes TV/audio, liens `/fr/matches|leagues` (nos dialogs/routes n'existent pas),
virtualisation (volumes < 100 lignes → `content-visibility`).
