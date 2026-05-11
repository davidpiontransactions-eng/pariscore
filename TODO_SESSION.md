# TODO - Prochaine Session PariScore

## Priorité Haute

- [x] Fix du layout Guide : supprimer les chevauchements de texte et passer au design épuré L'Équipe.
- [ ] Intégration des photos joueurs réelles et complétion de l'historique des matchs (Opposant + Logos).

## En Cours / A Finaliser

### 1. Page Guide/Documentation en ligne
- [x] Endpoint `/api/v1/guide` ajoute (server.js:7313)
- [x] Page `page-guide` ajoutee (pariscore.html)
- [x] Fonction `loadGuidePage()` ajoutee (pariscore.html)
- [x] A TESTER: acceder a http://localhost:3000 et cliquer sur "Guide" dans le menu
- [x] A VERIFIER: le guide s'affiche correctement (EV, ELO, architecture, stats)

### 2. Clics Equipe/Joueur - Integration Frontend
- [x] Fonction `trackClick()` ajoutee (pariscore.html:4949)
- [x] Fonction `openTeamDetail()` ajoutee (pariscore.html)
- [x] Noms equipes cliquables dans match rows (pariscore.html)
- [x] Ajouter modal team-detail-modal dans HTML
- [x] Connecter clicks sur noms joueurs (top butteurs)

### 3. Serveur - Stabilisation
- [x] Le serveur met longtemps a demarrer (40s+ de loading) -> boot allege: fetchOdds borne + fetchStats en background
- [x] Les requetes timeout souvent -> timeout de boot ajoute + readiness plus rapide
- [x] Probleme: EADDRINUSE sur port 3000 -> gestion explicite server.on('error') + message clair

### 4. Nouvelles Fonctionnalites (deja codees)
- [x] Endpoint `/api/v1/player/:id` - fiche joueur
- [x] Endpoint `/api/v1/team/:id` - fiche equipe
- [x] Endpoint `/api/v1/click` - bufferiser clicks utilisateur
- [x] Filtre kickoff: 1h, 2h, 6h (deja ajoute dans pariscore.html)
- [x] 2emes divisions ajoutees (75 ligues dans leagues_config.json)
- [x] Drapeaux completes (flags_config.json)

### 5. Documentation
- [x] docs/GUIDELINE_PariScore.md cree (800+ lignes)
- [x] Section 5B - Donnees stats expliquees en detail

### 6. Installation Skills OpenCode
- [x] Installer https://github.com/waybarrios/opencode-power-pack
- [x] Installer https://github.com/trailofbits/skills

### 7. Guide Complet en Ligne PariScore
- [x] Creer guide complet en ligne (page web interactive)
- [x] Sections:使用方法, Fonctionnalites, Strategies, Stats expliquees, FAQ
- [x] Integration avec menu "Guide"

### 8. Bug Fix - Badge PRO SCOUT v2
- [x] Le badge "✨ NOUVEAU — PRO SCOUT v2" apparait dans tous les onglets au lieu d'une seule fois
- [x] Corriger pour n'afficher qu'une seule occurrence (remplace par "⚡ PRO SCOUT v2")

### 9. Amelioration - Reordonner Colonnes Matchs
- [x] Deplacer colonne "Heure" (colonne 5) en premiere position

### 10. Refonte Colonnes - Redispatch Infos Match
- [x] Analyser contenu actuel colonne "Match / Stats Flash"
- [x] Proposer nouveau design avec colonnes dediees:
  - Colonne: Heure (deja fait)
  - Colonne: Equipes (logos + noms seulement)
  - Colonne: Classement/PPG (ranks + PPG both teams)
  - Colonne: Forme (forme visuelle both teams)
  - Colonne: Ligue/Date (league, date, flag)
  - Colonne: Top Conseils IA (conserver)
  - Colonne: Top 3 Butteurs (conserver)
  - Colonne: Actions (conserver)

### 11. Utiliser Context7 pour Recuperer Documentation
- [x] Rechercher documentation via Context7 MCP (teste avec Express - fonctionne)
- [x] Integrer docs dans le guide en ligne PariScore
- [x] Analyser https://github.com/hbctraining/Intro-to-variant-analysis via Context7 (SKIP — source non indexée sur Context7)

## A Faire

### Priorite Haute
- [x] Fix normalisation noms de pays (accents, casse, traductions FR/EN) pour drapeaux FlagCDN dans headers — getCountryFlag() blindée NFD + 34 aliases français (commit suivant)
1. Tester la page Guide - verifier qu'elle s'affiche
2. (Termine) Integrer clicks equipe/joueur
3. Corriger bug PRO SCOUT v2 (en cours)
4. Nettoyage automatique des matchs finis - BUG CORRIGE: db.archive_matches non initialise, maintenant synchronise
- [x] Automatisation du nettoyage horaire (setInterval 1h) — autoPurgeDatabase() supprime matchs terminés/expirés (>4h) via filtre JS en mémoire + saveDB()
- [x] Création du module de tutoriel/aide pour l'onglet 'Top Stratégies' (Définitions & Interprétation) — bouton "ℹ Aide & Guide" + modal glassmorphism 5 sections (Conf., Value, Edge, Over/BTTS, xG).
- [x] Refonte UI Modale Stats : Compartimenter le 'Power Scout V2' dans l'onglet 'PRO SCOUT' uniquement, appliquer le thème clair 'L'Équipe' et supprimer les emojis IA.

### 19. 🎨 UI/UX : Onglet Guide - Charte Graphique
- [x] **Mettre la charte graphique sur l'onglet "Guide"**
  - [x] **Thème global :** Guide utilise `var(--bg2)`, `var(--border)` — dark/light mode natif via CSS vars.
  - [x] **Typographie :** Guide utilise `var(--font-head)`, `var(--font-body)`, `var(--font-mono)`, `var(--text)`, `var(--text2)`, `var(--text3)`.
  - [x] **Boutons & Liens :** `.guide-calc-btn:hover` fixé (`filter: brightness(0.85)` au lieu de `#1e88e5`). `.guide-calc-result` utilise `var(--green-bg)` / `var(--red-bg)`.
  - [x] **Sécurité DOM :** IDs guide (`guide-search`, `guide-progress-fill`, `guide-progress-text`) — aucun conflit détecté.

### 16. Classement Equipe - Colonne "Class."
- [x] Les donnees home_rank/away_rank deja presentes dans les objets match
- [x] Afficher le classement (ex: "3e" / "8e") dans colonne "Class."
- [x] Code corrige: affiche maintenant rank au lieu de PPG

### 17. Classement ELO Soccer-Rating.com
- [x] Analyse du site https://www.soccer-rating.com/football-club-ranking/
- [x] Rapport detaille: ELO base sur cotes 1x2, echelle 2500+ (top) a <1500
- [x] Implementer: calcElo() ajoute, tooltip affiche ELO
- [x] Documenter: section 1.5 dans GUIDELINE_PariScore.md avec exemple visuel

### Priorite Moyenne
1. Optimiser le temps de demarrage du serveur
2. (Termine) Ajouter plus de donnees dans les fiches joueur/equipe
3. Ameliorer le rendu markdown du guide

### 12. Bug Fix - Donnees H2H Manquantes
- [x] Auditer pourquoi H2H affiche "0W-0D-0L" toujours
- [x] Analyser comment les sites concurrents recuperent donnees H2H
- [x] Implementer: computeH2H cherche dans db.matches + archive_matches, retourne null si pas de match passés
- [x] Solution: ajouter appel async vers API-Football (fetchH2H existe deja) quand local DB vide
- [x] Documenter la solution

### 14. Double Routing H2H (API-Football + Local DB)
- [x] Ajouter fallback vers local DB pour H2H quand API-Football quota epuise
- [x] Analyser documentation API (use context7) - API-Football doc recuperee
- [x] Implementer double routing H2H (API-Football -> Local DB)

### 15. Guide - Definition EV (Expected Value)
- [x] Ajouter definition EV dans l'onglet Guide (docs/GUIDELINE_PariScore.md)
- [x] Expliquer le calcul: EV = (Probabilité de gain × Gain) - (Probabilité de perte × Mise)
- [x] Ajouter exemple visuel (table ASCII avec comparateur)

### 13. Bug Fix - Bouton Nuit (Dark Mode)
- [x] Auditer pourquoi le bouton "nuit" ne fonctionne pas (clics impossibles)
- [x] Fixer le bug sur le site (z-index augmente 9999 -> 11000)
- [x] Documenter (z-index corrige)

### Priorite Basse
1. Nettoyer les logs de demarrage
2. Ajouter des tests unitaires
3. Documenter l'API
4. (Deja implemente) Nettoyage automatique des matchs finis - fonction archivePastMatches() s'execute toutes les 4h

### 18. Installation Plugin Frontend Design
- [x] Installer https://github.com/anthropics/claude-code/tree/main/plugins/frontend-design (clone dans .claude/plugins/)
- [x] Verifier si skill accessible (deja disponible via OpenCode)

## Notes

- Le serveur affichait "[Boot] ✓ Systeme pret" donc il fonctionne
- Le guide est accessible via le menu "Guide" ou "/api/v1/guide"
- La documentation complete est dans docs/GUIDELINE_PariScore.md
- 75 ligues configurees (dont ~20 deuxiemes divisions)
