# Rapport — DR par set Tennis (DR évolutif selon set en cours)

**Date** : 2026-05-19
**Demande DG** : distinguer le Dominance Ratio par set, avec un DR qui
évolue selon le set en cours.

## Faisabilité (confirmée)

DR exact actuel = Sofascore `/event/{id}/statistics`. Le code ne lisait
que `period === 'ALL'` (DR match agrégé). Le tableau `statistics`
Sofascore expose aussi des périodes `1ST / 2ND / 3RD / 4TH / 5TH` avec
les mêmes items « Service points won » / « Return points won » → DR par
set dérivable **sans nouvelle source réseau**, juste en parsant les
autres périodes. Zéro quota, zéro coût.

## Implémentation

### Backend (server.js)
- `_sofaFracTotal(v)` : extrait le dénominateur de « 30/65 (46%) » → 65
  (= points retour joués). Sert de garde min-échantillon.
- `_refreshSofaDREvent` réécrit : `parsePeriod()` factorisé, boucle sur
  toutes les périodes → `_periods{ ALL, 1ST, 2ND… }`. Top-level
  (`home/away/dr_home`) reste = ALL → **rétro-compat** consommateurs
  existants (proxy fallback, `_tvbDRLive` exact).
- `getSofascoreDRCached` : construit `dr_by_set{ 1..5 }` (DR orienté
  côté J1 comme le DR match, + serve/ret/ret_n par set).
- `_drAttachCurrentSet(dr, curSet)` : attache `dr_set_courant` =
  `{ set, dr, ret_n, reliable }`. Garde **min-échantillon ≥ 6 pts
  retour** (`_DR_SET_MIN_RET`) : début de set = bruit → `reliable=false`
  (affiché atténué, jamais masqué).
- Route `/tennis/api/v2/matches/live/` : `dr_exact` enveloppé par
  `_drAttachCurrentSet`, set en cours déduit de `m.sets.length`
  (fallback `current_set_index+1`).

### Frontend (pariscore.html)
- `_tvbDRLive` : bandeau `.tn-drs` sous les 2 lignes DR P1/P2 — une
  puce par set (`S1 1.40`, `S2 0.85~`…), couleur dom/bal/sub, set en
  cours surligné néon bleu, set peu fiable atténué + `~`.
- CSS `.tn-drs*` ajouté (cohérent thème tennis L'Équipe).

## Tradeoff assumé

DR set en cours = petit échantillon en début de set → volatil. Mitigé
par garde ≥6 pts retour : sous le seuil, la puce reste affichée mais
marquée peu fiable (`~`, italique, opacité réduite) plutôt que masquée
ou trompeuse. DR match conservé comme ancre stable (lignes P1/P2
inchangées). Fallback proxy (non-Sofascore) reste match-only — pas de
DR par set hors Sofascore (pas de données par période ailleurs).

## Validation

- `node --check server.js` OK
- Test unitaire : parseurs %/fraction, `_drAttachCurrentSet`
  (reliable / unreliable n<6 / set absent / null passthrough) — tous OK
- Boot 16 s sans erreur ni exception
- ⚠ Bandeau visible uniquement sur match live avec stats Sofascore par
  période → validation finale sur match live VPS

## Déploiement
Upload `server.js` + `pariscore.html` VPS OVH → `pm2 restart pariscore`.
