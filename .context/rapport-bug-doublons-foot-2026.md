# Rapport — Doublons de lignes onglet Foot

**Date** : 2026-05-19
**Symptôme** : Le même match apparaît 2× dans le tableau (ex. Fiorentina–Atalanta, ven. 22 mai 20:45, Serie A) :
- Ligne A : « Fiorentina / Atalanta », PWR 17/59, cotes + bets prédictifs complets, +EV PARIER N 24.7%
- Ligne B : « ACF Fiorentina / Atalanta BC », PWR 73/67, tout à 0%, CONFIANCE IA VOLATIL

## Cause racine

Le pipeline d'agrégation (`fetchOdds`, server.js) fusionne plusieurs sources foot en cascade :
BSD → Football-Data.org (L2) → ESPN (L3) → OpenFootball (L4).

À chaque étape, la déduplication cross-source teste l'égalité **exacte** des noms normalisés :

```js
normName(ex.home_team) === normName(em.home_team) &&
normName(ex.away_team) === normName(em.away_team) &&
|ex.commence_time - em.commence_time| < 24h
```

`normName()` (server.js:3969) se contente de : minuscules, suppression accents,
remplacement des caractères spéciaux par espace. Il **ne neutralise pas les
codes de club** (préfixes/suffixes type `FC`, `AC`, `ACF`, `BC`, `AS`, `SS`…).

Conséquence :
- Source 1 (BSD) renvoie `Fiorentina` / `Atalanta`
- Source 2 (ESPN/Football-Data) renvoie `ACF Fiorentina` / `Atalanta BC`

`normName("acf fiorentina") !== normName("fiorentina")` → la dédup échoue → le
match de la 2ᵉ source est **ajouté comme nouvelle ligne** au lieu d'enrichir
l'existante. La 2ᵉ ligne n'a ni cotes ni stats appariées → tout à 0%.

3 points de fusion touchés, prédicat identique :
- server.js:9865 — Football-Data.org
- server.js:9900 — ESPN
- server.js:9941 — OpenFootball

## Correctif

Ajout d'un helper de rapprochement tolérant aux codes de club
(`xsTeamMatch` / `xsSameMatch`, après `normName`) : `teamKey()` retire les
tokens d'affixe club connus (fc, ac, acf, bc, as, ss, us, sc, cf, …) avant
comparaison ; match si clés égales OU sous-chaîne au mot près avec ≤1 token
d'écart. Conservateur : ne fusionne pas « Manchester United » vs
« Manchester City » (clés distinctes, aucun token d'affixe retiré).

Les 3 prédicats de dédup remplacés par `xsSameMatch(...)`.
