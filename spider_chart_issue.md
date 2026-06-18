# Spider Chart — Bug Report & Audit

> **Date** : 2026-06-18
> **Composant** : `renderTn2Radar()` — `pariscore.js:6981-7108`
> **Contexte** : Modale Analyse Tennis (6 axes : ELO Surface, PowerScore, Momentum, Niveau, Experience, Efficacite)
> **Librairie** : Chart.js `type: 'radar'`

---

## Resume Executif

7 anomalies identifiees (1 HIGH, 3 MED, 3 LOW). L'anomalie critique est un parametre d'echelle incorrect (`beginAtZero: true`) qui ecrase visuellement les donnees normalisees et une incoherence de palette CSS qui nuit a la maintenabilite.

---

## B1 (HIGH) — beginAtZero ecrase les donnees normalisees

**Localisation** : `pariscore.js:7063`

**Probleme** :
```js
scales: { r: { beginAtZero: true, max: 100 } }
```
Toutes les donnees sont normalisees 5-100 via `norm()`. Avec `beginAtZero: true`, Chart.js scale de 0 a 100. Les valeurs faibles (5-25) sont compressees dans 5% du rayon -> distorsion geometrique du polygone radar.

**Impact** : Difference entre 5 et 25 invisible. Joueur avec fallback 50 semble "moyen" plutot que "non evalue".

**Correction appliquee** : `beginAtZero: false, min: 20, max: 100`

---

## B2 (MED) — Classes CSS mortes + palette inversee

**Probleme** : Classes `.spider-polygon-p1`/`.spider-polygon-p2` jamais utilisees par Chart.js (qui utilise backgroundColor inline). Palette CSS inversee (CSS dit P1=bleu, P2=vert ; Chart.js inline dit P1=vert, P2=indigo).

**Correction appliquee** : CSS remplace par commentaire "Couleurs gerees par Chart.js"

---

## B3 (MED) — Perte de donnees si un seul indice (serve/receive) est null

**Localisation** : `pariscore.js:7019-7022`

**Probleme** : Si `serve_index` valide (ex: 72) mais `receive_index` null -> les deux perdus, efficacite tombe a 50.

**Correction appliquee** : `(p1.serve_index ?? 50) + (p1.receive_index ?? 50) / 2` avec guard `||` pour tolerer un null.

---

## B4 (MED) — Risque fallback sur l10_pts = 0

**Localisation** : `pariscore.js:7015`

**Probleme** : Guard `!= null` correcte (0 != null). Mais si backend envoie null, fallback 50 masque l'absence.

**Correction appliquee** : `console.warn('[SpiderChart] l10_pts manquant pour', ...)` ajoute.

---

## B5 (LOW) — Aucun etat "donnees insuffisantes"

**Probleme** : Si TOUS les champs null, le radar affiche un pentagone parfait a 50/100 -> ressemble a un joueur moyen.

**Correction appliquee** : Detection >=4/6 axes a 50 -> `console.warn(...)` structure.

---

## B6 (LOW) — CSS Recharts legacy

**Probleme** : Classes `.recharts-*` pour un composant non utilise (projet utilise Chart.js). 180 lignes de CSS mort.

**Correction appliquee** : Blocs CSS supprimes.

---

## B7 (LOW) — rankScore sans limite haute pour rank = null

**Probleme** : Si rank > 2000, score negatif avant clamp. Qualifies sans classement ATP tombent a 50.

**Correction appliquee** : `|| r > 2000` + `Math.min(100, ...)`

---

## Plan de Correction Priorise

| Priorite | Bug | Fichier | Effort | Statut |
|----------|-----|---------|--------|--------|
| P0 | B1 - beginAtZero | pariscore.js | 1 ligne | ✅ CORRIGE |
| P1 | B3 - Perte si un index null | pariscore.js | 2 lignes | ✅ CORRIGE |
| P1 | B4 - Warn logger l10_pts | pariscore.js | 2 lignes | ✅ CORRIGE |
| P2 | B2 - CSS mortes spider-polygon | pariscore.html | ~5 lignes | ✅ CORRIGE |
| P2 | B5 - Etat donnees insuffisantes | pariscore.js | ~5 lignes | ✅ CORRIGE |
| P3 | B6 - CSS Recharts legacy | pariscore.html | ~10 lignes | ✅ CORRIGE |
| P3 | B7 - rankScore guard | pariscore.js | 1 ligne | ✅ CORRIGE |

---

## Recommandation Strategique

**Migrer vers le rendu SVG pur** (Variant B du sketch 001) avec feGaussianBlur pour :
1. Zero dependance (plus de Chart.js CDN)
2. Effet glow neon premium sur les polygones
3. Animations fluides (entree, hover)
4. Controle total des couleurs et du rendu
5. Performance amelioree (pas de canvas reflow)

Voir : `.planning/sketches/001-spider-chart-premium/`
