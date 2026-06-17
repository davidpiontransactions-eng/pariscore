# RAPPORT QA — DATA_PIPELINE_V3

**Date :** 17 Juin 2026
**Auditeur :** QA Engineering Team

---

## Resume Executif

**Total bugs : 13**
- 🟡 CRITICAL : 3 (bloquant mise en production)
- 🟠 HIGH : 5 (a fixer dans le sprint courant)
- 🟡 MEDIUM : 3 (amelioration)
- ⚪ LOW : 2 (cosmetique)

## 🟡 Bugs Critiques

### BUG-001 : __tennisPlayerMatches jamais definie
- **Fichier :** server.js:36977-36980
- **Description :** globalThis.__tennisPlayerMatches appelee mais nexiste pas. Fallback injecte des fausses donnees {svr_pts_won:30...}
- **Impact :** 100% des metriques sur donnees fictives
- **Fix :** Implementer __tennisPlayerMatches(name) ou retirer le mock fallback

### BUG-002 : bp_conv et bp_saved jamais integres dans computeAllMetrics
- **Fichier :** server.js:48647-48660
- **Description :** _tennisBPConvEWMA declaree mais jamais appelee dans le return
- **Impact :** Les chips BP Conv et BP Saved ne saffichent jamais
- **Fix :** Ajouter bp_conv et bp_saved dans le return de computeAllMetrics

### BUG-003 : srv_sparkline et ret_sparkline jamais calcules
- **Fichier :** server.js:48647-48660
- **Description :** _tennisSparkline6m jamais appelee dans computeAllMetrics
- **Impact :** Les sparklines SVG ne saffichent jamais
- **Fix :** Ajouter srv_sparkline et ret_sparkline dans computeAllMetrics

## 🟠 Bugs High

### BUG-004 : Sparkline SVG duplique dans le template
- **Fichier :** pariscore.js:4445, 4452
- **Fix :** Supprimer la deuxieme occurrence (copier-coller)

### BUG-005 : event hors scope dans showMetricDetail
- **Fichier :** pariscore.js:4551-4552
- **Fix :** Supprimer event.stopPropagation() deja fait dans onclick

### BUG-006 : showMetricDetail affiche des donnees aleatoires (Math.random)
- **Fichier :** pariscore.js:4576
- **Fix :** Connecter aux vraies donnees ou masquer le drawer

### BUG-007 : Percentiles Top 15% codes en dur
- **Fichier :** pariscore.js:4445, 4452
- **Fix :** Implementer un vrai calcul de percentile ou retirer

### BUG-008 : Mock data fallback masque labsence de donnees reelles
- **Fichier :** server.js:36979-36980
- **Fix :** fail fast — propager null, ne pas inventer de donnees

## 🟡 Bugs Medium

### BUG-009 : Fonction _psSparkline dupliquee (lignes 4518 et 4536)
- **Fichier :** pariscore.js
- **Fix :** Supprimer la deuxieme declaration

### BUG-010 : Classe CSS ps-metric-xxl-sparkline jamais utilisee
- **Fichier :** pariscore.html:22861
- **Fix :** Utiliser la classe dans le template ou supprimer la definition CSS

### BUG-011 : Parsing RSS sans User-Agent
- **Fichier :** tools/nlp-injury-scraper.js:24
- **Fix :** Ajouter headers: User-Agent: ParisScore/1.0

## ⚪ Bugs Low

### BUG-012 : Point-virgule double dans require
- **Fichier :** server.js:43
- **Fix :** Supprimer le second point-virgule

### BUG-013 : Commentaire orphelin RET_PTS_WON_S
- **Fichier :** server.js:48498-48520
- **Fix :** Deplacer le commentaire avant _tennisReturnPointsWonEWMA (ligne 48521)

---

## Recommandations

1. Corriger BUG-001 en priorite : sans __tennisPlayerMatches, tout le pipeline produit des donnees fictives
2. BUG-002 + BUG-003 : Cabler bp_conv, bp_saved, srv_sparkline, ret_sparkline dans computeAllMetrics
3. BUG-008 : Retirer le mock fallback. Un null visible vaut mieux quun 66.6% invente
4. BUG-004 + BUG-009 : Nettoyer les duplications (sparkline template + _psSparkline)
5. BUG-006 : Connecter showMetricDetail aux vraies donnees ou desactiver le drawer
6. node --check server.js && node --check pariscore.js apres chaque fix

---

*Rapport genere par la QA Engineering Team - Pariscore*
*DATA_PIPELINE_V3 - Sprint 1 & 2*
*17 Juin 2026*