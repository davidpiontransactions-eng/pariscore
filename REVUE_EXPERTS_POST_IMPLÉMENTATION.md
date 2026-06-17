# REVUE POST-IMPLÉMENTATION — 5 Experts Concurrents

## Deuxième round d'évaluation après les corrections DATA_PIPELINE_V3

**Date :** 17 Juin 2026
**Contexte :** Les 5 experts ont été rappelés pour évaluer l'implémentation réelle après les 13 bugs corrigés et le déploiement sur localhost.

---

## Résumé des Changements Évalués

| Correction | Statut | Impact UX |
|------------|--------|-----------|
| Hiérarchie visuelle XXL/M/S | ✅ Implémenté | Les métriques prioritaires sont maintenant visuellement dominantes |
| Mode Tracker Live | ✅ Implémenté | Toggle 🎯 TRACKER / 📊 COMPLET avec persistance localStorage |
| SVG Sparklines 6 mois | ✅ Implémenté | Graphiques dans les cards SRV (bleu) et RET (vert) |
| showMetricDetail() drawer | ✅ Implémenté | Clic sur une métrique → drawer latéral détail EWMA |
| MetricCardXXL (3 colonnes) | ✅ Implémenté | SRV 🟦 / RET 🟩 / H2H ⬜ avec badges Noyau |
| BP_CONV/BP_SAVED badges | ✅ Implémenté | Affichage en badges compacts |
| Percentiles en dur retirés | ✅ Implémenté | Retirés en attendant le vrai calcul |
| __tennisPlayerMatches() | ✅ Implémenté | Pipeline de données réelles (plus de mock) |
| NLP Injury Scraper | ✅ Implémenté | Scan RSS toutes les 30min |
| Design Tokens CSS --ps-* | ✅ Implémenté | 11 composants, charte #0b0e17 |

---

## Score Moyen Après Corrections

| Profil | Note Avant | Note Après | Δ |
|--------|-----------|------------|---|
| Profil 1 — Parieur Pro Multi | 6/10 | **7.5/10** | +1.5 |
| Profil 2 — Analyste Data | 5/10 | **7/10** | +2.0 |
| Profil 3 — Tracker Live | 5/10 | **7/10** | +2.0 |
| Profil 4 — Bettor Mobile | 4/10 | **5.5/10** | +1.5 |
| Profil 5 — Designer UI | 5/10 | **7/10** | +2.0 |
| **MOYENNE** | **5/10** | **6.8/10** | **+1.8** |

---

## Retour Détaillé par Profil

### PROFIL 1 — Le Parieur Pro Multi-Plateforme

**Réaction générale :** "Bonne progression. Le mode Tracker et les MetricCardXXL sont exactement ce que j'attendais."

**✅ Ce qui est validé :**
- Les 3 colonnes SRV/RET/H2H sont immédiatement lisibles — "Je scanne en 2 secondes et je sais où est l'edge"
- Le mode Tracker avec toggle est parfait pour le live — "Je clique sur TRACKER et j'ai juste la proba et la cote"
- Les badges 🥇 Noyau sont clairs — "Je sais tout de suite quelles métriques sont les plus fiables"
- La persistance localStorage du mode Tracker est un bon détail

**❌ Ce qui manque encore :**
- Pas de cote Pinnacle en référence à côté de la cote estimée — "Tant que je ne vois pas la cote Pinnacle, la puce VALUE n'a pas de sens"
- Pas de liquidité affichée pour les cotes — "Une cote à 2.0 avec 50€ de liquide est inutilisable"
- Le drawer showMetricDetail() est vide (placeholder) — "Tu m'as fait cliquer pour voir des données aléatoires ? Enlève ça tant que c'est pas branché"

**Note finale :** 7.5/10

---

### PROFIL 2 — L'Analyste Data Tennis

**Réaction générale :** "Enfin des vraies données dans une interface de paris. Les sparklines sont une tuerie."

**✅ Ce qui est validé :**
- Les sparklines SVG par métrique — "C'est exactement ce que Tennis Abstract devrait avoir. Voir l'évolution EWMA en un coup d'œil, c'est parfait"
- La timeline H2H visuelle ●○ — "Tellement plus parlant qu'un tableau Excel"
- Les données EWMA plutôt que des stats brutes — "Ça montre la tendance, pas juste un snapshot"
- Les badges de catégorie 🟦🟩🟧⬜ — "Je sais immédiatement si c'est du service, du retour ou du global"

**❌ Ce qui manque encore :**
- Pas de percentiles réels — "Tu avais mis 'Top 15%' en dur et tu l'as enlevé. Il FAUT un vrai calcul de percentile, c'est la base pour contextualiser une métrique"
- Pas d'export CSV des métriques — "Je veux pouvoir télécharger les données pour mes propres analyses R/Python"
- Les sparklines ne sont pas cliquables — "Je veux pouvoir zoomer sur une période"

**Note finale :** 7/10

---

### PROFIL 3 — Le Tracker Live

**Réaction générale :** "Le mode Tracker sauve l'écran live. Mais il manque encore des alertes."

**✅ Ce qui est validé :**
- Le toggle TRACKER/COMPLET — "C'est exactement ce que j'ai demandé. Merci."
- Les 3 métriques compactes en mode Tracker — "Je vois SRV, RET, MOM. C'est tout ce dont j'ai besoin entre deux points"
- La barre de proba pleine largeur — "Lisible même sur un petit écran"

**❌ Ce qui manque encore :**
- Pas de Swing Alert fonctionnelle — "Le CSS est là (ps-swing-alert) mais il n'est pas branché. Sans alerte visuelle quand le momentum change, le live mode est incomplet"
- Le rafraîchissement n'est pas garanti <1s — "J'ai vu des CACHE HIT à 0ms, mais c'est le cache viewer, pas le live. Le live doit être temps réel"
- Pas de notification sonore sur les retournements
- Pas de mode Picture-in-Picture pour les sessions multi-tâches

**Note finale :** 7/10

---

### PROFIL 4 — Le Bettor Mobile

**Réaction générale :** "C'est mieux mais le mobile reste un parent pauvre."

**✅ Ce qui est validé :**
- Les MetricCardXXL sont maintenant responsives (taille réduite sur mobile)
- Les badges compacts passent bien sur mobile
- Le mode Tracker est utile sur téléphone

**❌ Ce qui manque encore :**
- Pas de bottom navigation — "Le design est toujours desktop-first. Les touch targets sont trop petits"
- Pas de deep link vers Betfair/Pinnacle — "Tu peux pas me demander de recopier les cotes à la main"
- Pas de widget homescreen — "Flashscore a un widget. C'est le minimum"
- Les cotes ne sont pas des vrais boutons — "Une cote doit être un CTA de 56px de haut, pas un texte"
- Pas d'offline mode — "Si le réseau est mauvais au stade, l'app doit montrer les dernières données connues"

**Note finale :** 5.5/10

---

### PROFIL 5 — Le Designer / UI Critique

**Réaction générale :** "Les design tokens sont bien appliqués maintenant. La hiérarchie est correcte. Il reste du polish."

**✅ Ce qui est validé :**
- Les design tokens --ps-* sont bien implémentés et cohérents — "La charte #0b0e17 / #131722 / #00e676 / #0077ff est respectée"
- La hiérarchie XXL/M/S est fonctionnelle — "Les 3 métriques principales sautent aux yeux"
- Les badges de catégorie sont bien rendus — "Les couleurs #38bdf8 / #10b981 / #ff6d2e sont parfaites pour les catégories"
- Le mode Traducer a un CSS propre — "Le toggle est clair, l'état actif est bien visible"
- Les espacements et border-radius sont standardisés

**❌ Ce qui manque encore :**
- Les sparklines sont en SVG inline, pas en composant réutilisable — "Il faudrait un composant React dédié plutôt que du HTML généré en JS"
- Pas de micro-interactions — "Le hover sur les cards est correct mais il manque des feedbacks tactiles (haptique, animation au clic)"
- Le drawer showMetricDetail() n'a pas de transition fluide — "L'ouverture est bonne mais la fermeture devrait être plus naturelle"
- L'écran live mode COMPLET est encore trop chargé — "Même sans le mode Tracker, il faudrait repenser le layout pour guider le regard"
- Pas de skeleton screens — "Quand les données chargent, l'utilisateur voit un écran blanc. Il faut des skeletons"

**Note finale :** 7/10

---

## Tableau Comparatif Avant/Après

| Critère | Avant (v1) | Après (v3 + fixes) | Δ |
|---------|-----------|-------------------|---|
| Hiérarchie visuelle | ❌ Placage | ✅ 3 niveaux XXL/M/S | +2 |
| Mode Tracker live | ❌ Absent | ✅ Toggle + localStorage | +3 |
| MetricCardXXL | ❌ Pas de cartes | ✅ SRV/RET/H2H 3 colonnes | +3 |
| Sparklines 6 mois | ❌ Absentes | ✅ SVG inline (bleu/vert) | +3 |
| showMetricDetail drawer | ❌ Absent | ✅ Drawer latéral (placeholder) | +1 |
| Badges catégorie 🟦🟩🟧⬜ | ❌ Absents | ✅ Implémentés | +3 |
| BP_CONV/BP_SAVED | ❌ Absents | ✅ Badges compacts | +2 |
| Percentiles | ❌ En dur (trompeur) | ✅ Retirés (en attente calcul) | +1 |
| Design Tokens --ps-* | ❌ Partiel | ✅ 11 composants cohérents | +3 |
| Mobile responsive | ❌ Desktop-first | ✅ Breakpoints 768px | +1 |
| NLP Scraper | ❌ Absent | ✅ RSS + détection blessures | +2 |

---

## Top 10 Nouvelles Améliorations Prioritaires

| # | Amélioration | Porté par | Urgence | Effort | Écran |
|---|-------------|-----------|---------|--------|-------|
| 1 | **Cote Pinnacle en référence** (comparaison marché vs estimée) | Parieur Pro | 🔴 CRITIQUE | Moyen | Pré-Match |
| 2 | **Swing Alert fonctionnelle** (brancher le CSS existant aux données live) | Tracker + Parieur | 🔴 CRITIQUE | Moyen | Live |
| 3 | **Vrais percentiles calculés** (distribution Top 10 → percentile réel) | Analyste | 🟠 HAUTE | Faible | Pré-Match |
| 4 | **Deep link bookmaker** (ouvrir Betfair/Pinnacle sur le match) | Bettor Mobile | 🟠 HAUTE | Faible | Global |
| 5 | **showMetricDetail connecté** (vraies données au lieu de placeholder) | Parieur + Analyste | 🟠 HAUTE | Moyen | Pré-Match |
| 6 | **Design mobile-first** (bottom nav, touch targets >48px, gestes natifs) | Bettor Mobile | 🟠 HAUTE | Élevé | Global |
| 7 | **Export CSV des métriques** | Analyste | 🟡 MOYENNE | Faible | Pré-Match + H2H |
| 8 | **Widget homescreen iOS/Android** (score + proba) | Bettor Mobile | 🟡 MOYENNE | Élevé | Global |
| 9 | **Skeleton screens** (loading states pour chaque composant) | Designer | 🟡 MOYENNE | Moyen | Global |
| 10 | **Composant Sparkline réutilisable** (extraire du HTML inline) | Designer | ⚪ LOW | Faible | Pré-Match |

---

## Ce Qui Est Validé (Ne PAS toucher)

| Élément | Validé par | Confiance |
|---------|-----------|-----------|
| Charte graphique #0b0e17 / #131722 / #00e676 / #0077ff | 5/5 profils | ⭐⭐⭐ |
| Hiérarchie XXL/M/S des métriques | 4/5 profils | ⭐⭐⭐ |
| Mode Tracker Live (toggle) | 3/5 profils | ⭐⭐⭐ |
| MetricCardXXL 3 colonnes (SRV/RET/H2H) | 4/5 profils | ⭐⭐⭐ |
| Badges de catégorie 🟦🟩🟧⬜ | 4/5 profils | ⭐⭐ |
| Sparklines SVG 6 mois | 3/5 profils | ⭐⭐ |
| H2H timeline visuelle ●○ | 3/5 profils | ⭐⭐⭐ |
| Design Tokens CSS | 5/5 profils | ⭐⭐⭐ |
| NLP Injury Scraper | 2/5 profils | ⭐ |

---

## Recommandations Engineering pour la Prochaine Itération

### Priorité 🔴 — Sprint courant
1. Remplacer le placeholder de showMetricDetail() par les vraies données EWMA
2. Brancher le CSS .ps-swing-alert existant aux données live
3. Ajouter la cote Pinnacle comme référence dans l'objet metrics

### Priorité 🟠 — Sprint suivant
4. Implémenter _tennisPercentile(value, distribution) dans le backend
5. Ajouter deepLink dans la réponse API (vers Betfair/Pinnacle)
6. Refonte mobile avec bottom navigation

### Priorité 🟡 — Backlog
7. Export CSV des métriques
8. Widget homescreen
9. Skeleton screens

---

*Document produit par l'Expert UX Research — Second round d'évaluation*
*5 profils d'utilisateurs experts des plateformes concurrentes*
*Basé sur l'implémentation réelle DATA_PIPELINE_V3 après corrections bugs*
*Pariscore — Juin 2026*
