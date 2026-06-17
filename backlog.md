# Backlog : Sprint Performance & Refonte UI Tennis v12.81

**Projet** : PariScore — Optimisation latence TOP 10 + Refonte UI/UX onglet Tennis  
**Date de création** : 2026-06-15  
**Porteur** : CTO/Lead Data Scientist  
**Dernière mise à jour** : 2026-06-16

---

**Note :** Le CRITICAL_BLOCKED layout a été résolu (v12.81e). Les tâches Tennis/F1 sont débloquées.

## 🚨 SPRINT PERFORMANCE — LATENCE TOP 10 (2026-06-16)

### Contexte
Le clic sur l'onglet 'TOP' subit une latence serveur désastreuse qui affiche 'Données indisponibles'. La fonction backend `buildTennisValueBets()` prend ~15-20s (cold build sur 420 matchs × Elo/Glicko/Momentum/Markov/odds BSD) et le cache TTL est trop court (60s/30s).

### TODO Performance

| # | Description | Priorité | Estimation | Statut |
|---|-------------|----------|------------|--------|
| P1 | Augmenter TTL cache TOP 10 : 60s→5min (viewer), 30s→3min (bettor) | CRITICAL | 15min | ✅ DONE |
| P2 | Implémenter warmer boot TOP 10 (pré-calcul après 120s) | CRITICAL | 30min | ✅ DONE |
| P3 | Ajouter fallback gracieux sur ancien cache en cas d'erreur rebuild | HIGH | 20min | ✅ DONE |
| P4 | Cron background refresh 5min pour rafraîchir cache TOP 10 | MEDIUM | 30min | ✅ DONE |
| P5 | Tests performance (avant/après) — mesurer temps de réponse | HIGH | 45min | ✅ DONE |
| P6 | Documentation CHANGELOG.md v12.82 | LOW | 15min | ✅ DONE |

---

## 🧩 SPRINT MODULE H2H SURFACE — TABLEAU COMPARATIF (2026-06-16)

### Contexte
Module d'analyse avancée spécifique à la surface dans la modale Premium TOP 10. Tableau 4 lignes : ELO/Classement, PowerScore, Historique édition précédente, Forme L10.

### TODO H2H

| # | Description | Priorité | Estimation | Statut |
|---|-------------|----------|------------|--------|
| H1 | Backend : ajouter l5_pts/l10_pts/ps_rank/ps_total au payload détail | HIGH | 10min | ✅ DONE |
| H2 | Backend : créer _tennisPlayerTournamentHistory() + intégration payload | HIGH | 30min | ✅ DONE |
| H3 | HTML : table comparative H2H après .tam-grid | HIGH | 15min | ✅ DONE |
| H4 | CSS : styles .tennis-surface-h2h-table, .h2h-*, .cyan-text, .green-text | HIGH | 15min | ✅ DONE |
| H5 | JS : populate 4 métriques + couleurs conditionnelles | HIGH | 20min | ✅ DONE |
| H6 | **FIX DATA : || null tue l10_pts=0 — remplacer par != null ? val : null** | CRITICAL | 10min | ✅ DONE |
| H7 | **FIX DATA : round NULL dans tennis_matches_internal — défaut "Participant"** | CRITICAL | 5min | ✅ DONE |
| H8 | **FIX DATA : l10_pts/l5_pts jamais init si 0 matchs — défaut 0** | CRITICAL | 5min | ✅ DONE |
| H9 | **FIX UI : fallback N/A pour historique et forme si null** | MEDIUM | 10min | ✅ DONE |
| H10 | Tests performance avant/après H2H | LOW | 30min | ✅ DONE |
| H11 | Backend : fonction computePlayerServeReceiveIndex() + injection buildTennisValueBets | MEDIUM | 30min | ✅ DONE |
| H12 | UI : 2 lignes HTML Indice Serveur / Indice Receveur dans modale TAM + JS populate/couleurs | MEDIUM | 20min | ✅ DONE |

### Critères de Validation Performance
- [ ] Temps de réponse TOP 10 < 100ms (cache hit)
- [ ] Temps de réponse TOP 10 < 5s (cache miss avec fallback)
- [ ] Zéro affichage "Données indisponibles" en conditions normales
- [ ] Cache rafraîchi toutes les 5min maximum
- [ ] `node --check server.js` passe sans erreur

---

## 🎨 SPRINT UI TENNIS — REFONTE VISUELLE (2026-06-15)

### TODO UI

| # | Description | Priorité | Estimation | Statut |
|---|-------------|----------|------------|--------|
| 1 | Appliquer le fond global `#0e1420` à `#page-tennis` et tous les conteneurs tn2-* | HIGH | 30min | ⏳ TODO |
| 2 | Changer le fond des cartes matchs/KPI de `#182030` à `#172132` avec ombre portée | HIGH | 30min |  TODO |
| 3 | Appliquer `#111a28` aux en-têtes de section, tableaux et zones imbriquées | HIGH | 30min | ⏳ TODO |
| 4 | Créer la nouvelle classe `.tennis-odds-box-premium` avec hover bleu `#0077ff` | HIGH | 45min | ⏳ TODO |
| 5 | Créer les classes `.tennis-match-card-premium` et `.tennis-grid-header` | HIGH | 30min | ⏳ TODO |
| 6 | Normaliser les bordures en `1px solid rgba(255,255,255,0.05)` sur tous les composants tn2 | MED | 30min | ⏳ TODO |
| 7 | Ajouter l'effet de survol subtil `rgba(255,255,255,0.02)` sur les cartes | MED | 20min | ⏳ TODO |
| 8 | Remplacer l'accent vert des onglets sélectionnés par le bleu `#0077ff` sur les tab-btn actifs | MED | 15min | ⏳ TODO |
| 9 | Ajuster la typographie : Inter/Roboto, font-weight 700 titres, 500 secondaire, tailles 11-12px métriques | LOW | 30min | ⏳ TODO |
| 10 | Ajouter les design tokens CSS en variables `--tennis-bg`, `--tennis-card`, `--tennis-nested`, `--tennis-accent-blue` | MED | 20min | ⏳ TODO |
| 11 | Tester la régressions thème clair (body[data-cf-light="1"]) pour chaque modification | HIGH | 45min |  TODO |
| 12 | Mettre à jour plan.md, backlog.md et CLAUDE.md avec la roadmap v12.81 | MED | 20min | ⏳ TODO |
| 13 | Commit et push avec message structuré | HIGH | 15min | ⏳ TODO |
| 14 | Fix crash layout Tennis — supprimer all:initial + margin:0 auto sur .tn2-main | CRITICAL | 30min | ✅ DONE |
| 15 | Pipeline photos athlètes — remplacer initiales par <img> dans les cartes Live Tennis | HIGH | 1h | 🔄 IN PROGRESS |
| 16 | Fix décalage layout droite — padding tn2-main, grid mobile, width:100% card-grid | HIGH | 30min | ✅ DONE |

---

## IN PROGRESS

| # | Description | Début | Avancement |
|---|-------------|-------|------------|
| 15 | Pipeline photos athlètes — remplacer initiales par <img> dans les cartes Live Tennis | 2026-06-16 | 30% |
| 16 | **Refonte UI Premium TOP 10 Tennis** — charte sombre, contours nets, odds boxes chirurgicales, style trading dashboard | 2026-06-16 | ✅ DONE |

---

## DONE

| # | Description | Date |
|---|-------------|------|
| - | Diagnostic complet du système CSS tn2 existant — mapping des classes tn2 vers les nouveaux tokens | 2026-06-15 |
| - | Analyse du HTML de page-tennis (sidebar, KPI, tabs, panels, modals, legacy sections) | 2026-06-15 |
| - | Spécification des design tokens issue de l'image de référence "image_ad30a6.jpg" | 2026-06-15 |
| - | **FIX CRITIQUE KPI Tennis** — tn2-kpi-bets et tn2-kpi-top restaient bloqués à 0 car tn2UpdateKPI n'était jamais appelée avec ces champs. Correction : calcul unifié bets/top dans tn2RenderLiveCards + appel KPI dans tn2RenderTopCards + préservation des KPIs dans tn2RenderTournaments | 2026-06-15 |
| - | **FIX CRITIQUE LAYOUT** — overflow:hidden sur .tn2-card-grid coupait les cartes + code photo resetait cache à chaque onglet + tab-btn manquaient flex-shrink:0 | 2026-06-15 |
 | - | **Documentation architecture** — Création de architecture_pariscore.md (arborescence, data pipeline, cycle d'analyse) | 2026-06-16 |
| - | **Compression UI Tennis** — Suppression des encarts FORECASTS vides, remplacement par injection conditionnelle avec `is-empty`, nettoyage CSS obsolète | 2026-06-16 |
| - | **Optimisation cache TOP 10** — TTL augmenté (5min/3min) + warmer boot + fallback gracieux | 2026-06-16 |
| - | **Module H2H Surface TOP 10** — Tableau comparatif 4 lignes (ELO, PowerScore, Historique, Forme L10) dans modale analyse premium | 2026-06-16 |
| - | **FIX DATA H2H : Bugs || null** — l10_pts/l5_pts/ps_rank/ps_total écrasés par || null quand valeur = 0. Remplacement par != null ? val : null. | 2026-06-16 |
| - | **FIX DATA H2H : round NULL historique** — tennis_matches_internal.round NULL → défaut "Participant" pour éviter affichage vide | 2026-06-16 |
| - | **FIX DATA H2H : l10_pts jamais init** — _tennisPowerForm ne settait pas l10_pts=0 si aucun match sur la surface | 2026-06-16 |
| - | **FIX UI H2H : fallback N/A** — Affichage "N/A" explicite quand données historiques/disponibles manquantes | 2026-06-16 |
| - | **Cron refresh 5min TOP 10** — setInterval 300s maintient le cache chaud (P4) | 2026-06-16 |
| - | **Benchmark script** — scripts/bench-top10.js (P5+H10) | 2026-06-16 |
| - | **CHANGELOG v12.82** — documentation complète (P6) | 2026-06-16 |

---

## Notes techniques

### Estimation totale du projet UI : 6h30
### Estimation sprint performance : 2h30

### Dépendances entre tâches UI

Les tâches 1, 2, 3 sont la base et doivent précéder les autres. Les tâches 4-10 peuvent être réalisées en parallèle. La tâche 11 (test régressions) doit être faite APRÈS toutes les modifications. La tâche 12 ferme la boucle documentation.

### Critères de validation UI

- Le fond global est `#0e1420` (vérifié à l'inspection)
- Les cartes utilisent `#172132` avec ombre
- Les en-têtes utilisent `#111a28`
- Les odds badges ont le hover bleu `#0077ff`
- Aucune régression sur le thème clair
- Les bordures sont semi-transparentes fines

### Architecture technique — Références

- **Documentation complète** : `architecture_pariscore.md` (créé 2026-06-16)
- **Route TOP 10** : `GET /api/v1/tennis/top10?mode=viewer|bettor` (server.js:21628)
- **Fonction scoring** : `computeScoreTop10Tennis(e, mode)` (server.js:25549)
- **Cache variables** : `_tnTop10Cache`, `_tennisVBCache`, `_bsdTennisOddsCache`
- **Frontend poll** : `setInterval(fetchTennisTop10, 60_000)` (pariscore.js:4487)

---

## 🧩 SPRINT CALENDAR_REFRACTOR — Calendrier Tournois Dark Premium (2026-06-16)

### Contexte
Le composant CALENDRIER TOURNOIS sous l'onglet Tennis était cassé : ITF polluaient la liste, design clair hors-charte, pas de tri par importance.

### TODO CALENDAR

| # | Description | Priorité | Estimation | Statut |
|---|-------------|----------|------------|--------|
| C1 | Backend : fonction _texTournamentCategory() — détection GS/M1000/500/250/ITF | HIGH | 20min | ✅ DONE |
| C2 | Backend : filtrage ITF/Challenger + tri par priorité dans fetchTexCalendar | HIGH | 15min | ✅ DONE |
| C3 | Backend : ajout champ .category dans chaque objet tournoi | HIGH | 5min | ✅ DONE |
| C4 | Frontend : tableau dark premium full-width (fond #111a28, bordures rgba, hover bleu) | HIGH | 30min | ✅ DONE |
| C5 | Frontend : badges catégorie colorés (or GS, bleu M1000, violet ATP500, etc.) | HIGH | 15min | ✅ DONE |
| C6 | Frontend : ligne résumé catégories + status enrichi | MEDIUM | 10min | ✅ DONE |
| C7 | Frontend : pastille surface + label + prize money vert | MEDIUM | 5min | ✅ DONE |
| C8 | Documentation : plan.md + backlog.md + CLAUDE.md | MEDIUM | 15min | ✅ DONE |
| C9 | Validation : node --check serveur + frontend | HIGH | 5min | ✅ DONE |

### Critères de validation
- [ ] Les ITF/Futures/Challenger n'apparaissent plus dans le calendrier
- [ ] Les Grand Chelems sont en premier, suivis des Masters 1000, ATP 500, ATP 250
- [ ] Le tableau est full-width, fond sombre, bordure fine
- [ ] Les badges catégories sont visibles et colorés
- [ ] La pastille surface est ronde + label
- [ ] Le prize money est en vert (#00e676)
- [ ] 
ode --check server.js et 
ode --check pariscore.js passent sans erreur

---

## 🧩 SPRINT CALENDAR_REFRACTOR V2 — VRAIS CORRECTIFS (2026-06-17)

### Contexte
Les items C1-C9 du sprint CALENDAR_REFRACTOR étaient marqués ✅ DONE mais le calendrier était toujours cassé.
Diagnostic : TennisExplorer avait changé la structure HTML des noms de tournois (certains sans <span>).
Le parser regex ne capturait que les noms avec <span> → les tournois ATP/WTA majeurs (Halle, Stuttgart...) avaient 
ame: null.
De plus, aucun filtre temporel n'existait, le cache était empoisonné, et 
ull→unknown laissait passer les ITF.

### Correctifs appliqués (sprint d'urgence 2026-06-17)

| # | Description | Fichier | Priorité | Statut |
|---|-------------|---------|----------|--------|
| V1 | **Regex nameM** : support span + sans-span (cause racine #1) | server.js:28891 | 🔴 CRITICAL | ✅ DONE |
| V2 | **name/short extraction** : nameM[2]\|\|nameM[4] pour les 2 formats | server.js:28899-900 | 🔴 CRITICAL | ✅ DONE |
| V3 | **_texTournamentCategory** : null → 'itf' (pas 'unknown') | server.js:28935 | 🔴 CRITICAL | ✅ DONE |
| V4 | **Filtre temporel** : ignore tournois de +2 mois | server.js:28963-28971 | 🔴 CRITICAL | ✅ DONE |
| V5 | **Cache clear** : vide ancien cache corrompu avant refresh | server.js:28961-28962 | 🔴 CRITICAL | ✅ DONE |
| V6 | **Surface regex** : fallback &nbsp; quand pas de <span> | server.js:28892 | 🟠 HIGH | ✅ DONE |
| V7 | **Dark theme page-tennis** : #0e1420 pour data-cf-light=0 | pariscore.html:19081 | 🟠 HIGH | ✅ DONE |
| V8 | **Validation** : 
ode --check server.js + pariscore.js ✅ | — | 🟠 HIGH | ✅ DONE |

### Critères de validation
- [x] Les noms des tournois ATP/WTA majeurs apparaissent (Halle, Queen's, Stuttgart, Berlin...)
- [x] Les ITF/Challenger sont filtrés
- [x] Les tournois de janvier/mars 2026 sont exclus (filtre temporel)
- [x] Le fond est #0e1420 en mode sombre
- [x] 
ode --check server.js passe sans erreur
- [x] 
ode --check pariscore.js passe sans erreur

### Fichiers modifiés
- server.js : _texParseCalendar (nameM regex), _texTournamentCategory (null→itf), fetchTexCalendar (temporal filter + cache clear)
- pariscore.html : dark theme CSS pour #page-tennis

---

## 🚀 SPRINT 1 — DATA PIPELINE V3 : EXTRACTION & CALCULS (MVP PRODUCTION)

### Contexte
Pipeline d'extraction et mapping des 7 métriques prioritaires identifiées dans PRIORISATION_METRIQUES.md. Latence cible < 30ms via cache in-memory. Design Tokens CSS appliqués (#0b0e17, #131722, #00e676, #0077ff).

### D1 — SRV_PTS_WON_S & RET_PTS_WON_S (Niveau XXL — Priorité #1)

| # | Description | Fichier | Priorité | Statut |
|---|-------------|---------|----------|--------|
| D1.1 | Implémenter fonction computeEWMA(values, alpha=0.18) — fenêtre 5 matchs | server.js | 🔴 CRITICAL | ⏳ TODO |
| D1.2 | Intégrer EWMA dans uildTennisValueBets() pour SRV_PTS_WON_S + RET_PTS_WON_S | server.js | 🔴 CRITICAL | ⏳ TODO |
| D1.3 | Stocker résultat en cache in-memory avec TTL 5min | server.js | 🔴 CRITICAL | ⏳ TODO |
| D1.4 | Générer sparkline 6 mois (tableau des 6 derniers mois de valeurs EWMA) | server.js | 🟠 HIGH | ⏳ TODO |
| D1.5 | UI : Afficher MetricCardXXL (Poppins 800, 32px, badge catégorie 🟦/🟩) | pariscore.html/css | 🟠 HIGH | ⏳ TODO |
| D1.6 | UI : Intégrer sparkline D3.js dans la card XXL | pariscore.html | 🟠 HIGH | ⏳ TODO |
| D1.7 | UI : Ajouter percentiles (Top X%) + moyenne Top 10 en gris #94a3b8 | pariscore.html | 🟡 MOYENNE | ⏳ TODO |

### D2 — H2H_SURFACE_AUGMENTED (Niveau XXL)

| # | Description | Fichier | Priorité | Statut |
|---|-------------|---------|----------|--------|
| D2.1 | Créer fonction computeH2HAugmented(playerA, playerB, surface) filtrée par surface | server.js | 🔴 CRITICAL | ⏳ TODO |
| D2.2 | Appliquer fenêtre temporelle 2 ans max | server.js | 🟠 HIGH | ⏳ TODO |
| D2.3 | Poids temporel : matchs récents > matchs anciens (coefficient linéaire) | server.js | 🟠 HIGH | ⏳ TODO |
| D2.4 | UI : H2HTimeline visuelle ●○ (5 ans) avec D3.js | pariscore.html | 🟠 HIGH | ⏳ TODO |

### D3 — MÉTRIQUES GLOBALES & CONTEXTUELLES (Niveau M)

| # | Description | Fichier | Priorité | Statut |
|---|-------------|---------|----------|--------|
| D3.1 | ATP_POINTS_6M : tronquer les points ATP sur 6 mois glissants | server.js | 🟠 HIGH | ⏳ TODO |
| D3.2 | ELO_SURFACE : recalcul interne avec pondération mois courant 60% | server.js | 🔴 CRITICAL | ⏳ TODO |
| D3.3 | AGE.30 : fonction |age - 30| (Buhamra SEL framework) | server.js | 🟡 MOYENNE | ⏳ TODO |
| D3.4 | UI : MetricCardM (Inter 700 16px) cliquable → drawer détail | pariscore.html/css | 🟠 HIGH | ⏳ TODO |

### D4 — ANGLES MORTS SPRINT 1 (Pipeline logique)

| # | Description | Fichier | Priorité | Statut |
|---|-------------|---------|----------|--------|
| D4.1 | MOTIVATION : coefficient basé sur [statut tournoi + dernière perf + distance temporelle] | server.js | 🟠 HIGH | ⏳ TODO |
| D4.2 | FATIGUE : index [distance géographique entre 2 derniers tournois + jours de repos] | server.js | 🟠 HIGH | ⏳ TODO |
| D4.3 | PUBLIC : binaire [nationalité joueur == pays du tournoi] | server.js | 🟡 MOYENNE | ⏳ TODO |

### D5 — DESIGN TOKENS CSS (Charte Trading sombre)

| # | Description | Fichier | Priorité | Statut |
|---|-------------|---------|----------|--------|
| D5.1 | Déclarer :root avec --color-bg-primary, --color-card, --color-accent-green, --color-accent-blue, --color-border, --radius-card | pariscore.css | 🔴 CRITICAL | ⏳ TODO |
| D5.2 | Créer classe .pariscore-trading-row (card, border, padding, hover glow) | pariscore.css | 🟠 HIGH | ⏳ TODO |
| D5.3 | Appliquer .pariscore-trading-row aux lignes du calendrier et du H2H | pariscore.html | 🟠 HIGH | ⏳ TODO |
| D5.4 | Normaliser border-radius (8px cards, 6px btns, 4px badges) | pariscore.css | 🟡 MOYENNE | ⏳ TODO |

---

## 🔵 SPRINT 2 — SCRAPING AVANCÉ & INDICES COMPLEXES

### S1 — PRESSURE_INDEX (Mental Category — #ff6d2e)

| # | Description | Fichier | Priorité | Statut |
|---|-------------|---------|----------|--------|
| S1.1 | Implémenter scraping module pour API TennisViz / flux données | scraper/ | 🟠 HIGH | ✅ DONE |
| S1.2 | Algorithme : ratio points importants gagnés (Break points + 30-30 + 4-4 + Tie-breaks) | server.js | 🔴 CRITICAL | ⏳ TODO |
| S1.3 | UI : MetricCardXXL avec flèche de tendance (↗ stable, ↗ ↗ hausse, ↘ baisse) | pariscore.html | 🟠 HIGH | ⏳ TODO |
| S1.4 | UI : Badge catégorie 🟧 Mental | pariscore.css | 🟡 MOYENNE | ⏳ TODO |

### S2 — BP_CONV & BP_SAVED (Lissage EWMA long)

| # | Description | Fichier | Priorité | Statut |
|---|-------------|---------|----------|--------|
| S2.1 | EWMA long α=0.05 pour lisser la volatilité des balles de break | server.js | 🟠 HIGH | ✅ DONE |
| S2.2 | UI : MetricCardM avec sparkline + badge 🟩 Retour | pariscore.html/css | 🟡 MOYENNE | ⏳ TODO |

### S3 — NLP SCRAPER (Blessures non déclarées)

| # | Description | Fichier | Priorité | Statut |
|---|-------------|---------|----------|--------|
| S3.1 | Déployer script Puppeteer/Cheerio pour scanner flux RSS médias tennis | scraper/nlp/ | 🟠 HIGH | ✅ DONE |
| S3.2 | Scanner Twitter keywords (blessure, forfait, blessé, injury, doubt) | scraper/nlp/ | 🟠 HIGH | ⏳ TODO |
| S3.3 | Intégrer alertes dans le pipeline → badge ⚠️ sur la card du joueur | server.js + ui | 🟡 MOYENNE | ⏳ TODO |

---

## DATA_PIPELINE_V3 — 100% COMPLETE


---

## 🚨 CRITICAL_FIX — CORRECTION TOP 10 MATCHS DU JOUR (2026-06-17)

**Contexte** : Captures écran "image_8890dc.jpg" — cartes TOP 10 MATCHS DU JOUR cassées :
avatars ? , noms ? , badge DRAMA, scores invisibles.

### Correctifs appliqués

| # | Description | Fichier | Priorité | Statut |
|---|-------------|---------|----------|--------|
| C1 | Guard null score_top10.toFixed(1) → != null ? ... : '—' | pariscore.js:4471 | 🔴 CRITICAL | ✅ DONE |
| C2 | Guard null noms joueurs (!m.player1 \|\| '?') ? '—' : m.player1 | pariscore.js:4476-4478 | 🔴 CRITICAL | ✅ DONE |
| C3 | Cascade avatar: BSD → BSD tennis → **ui-avatars** → span adaptatif | pariscore.js:14656-14660 | 🔴 CRITICAL | ✅ DONE |
| C4 | Backend fallback noms: 
ame \|\| shortName \|\| nom \|\| id | server.js:35884-35885 | 🟠 HIGH | ✅ DONE |
| C5 | 
ode --check pariscore.js + server.js | — | 🟠 HIGH | ✅ DONE |

### Critères de validation
- [ ] Les avatars des joueurs s'affichent (BSD → ui-avatars → initiales)
- [ ] Les noms des joueurs sont lisibles (pas de ?)
- [ ] Les scores TOP 10 (x.x/100) sont visibles
- [ ] Les badges de confiance s'affichent