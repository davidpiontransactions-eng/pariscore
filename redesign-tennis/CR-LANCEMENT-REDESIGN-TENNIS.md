# Redesign UI Tennis « Prematch & Live » — Compte-rendu de lancement

> **Date de lancement** : 2026-07-07
> **Auteur** : Chef de projet (agent ZCode)
> **Statut** : 🟡 **En lancement** — Phase 0 (cadrage) terminée, en attente GO utilisateur pour exécution
> **Décision validée** : Hybride Dashboard-Carte (panel simulé 1000 votants)
> **Réf. Gantt** : `redesign-tennis/GANTT-REDESIGN-TENNIS.md`
> **Réf. plan** : `redesign-tennis/PLAN-TACHES-REDESIGN-TENNIS.md`

---

## 1. Autorisation de lancement

| Élément | Valeur |
|---|---|
| Mandat | Retravailler le design UI/UX du sous-onglet Tennis Prematch & Live pour permettre des décisions de pari rapides |
| Méthode | Conception collaborative (4 expertises) + vote panel (1000 votants simulés) avant implémentation |
| Périmètre (verrouillé) | Tout le sous-onglet : cartes + filtres + recherche + KPI bar + header de sous-onglet |
| Device (verrouillé) | Responsive équilibré (mobile + desktop) |
| Objectif #1 (verrouillé) | Signal fort, info minimale — « 1 coup d'œil = je sais quoi faire » |
| Actions pari (verrouillé) | Modale de comparaison multi-bookmaker (câble `/odds-comparison/:id`) |
| Décision finale | Hybride Dashboard-Carte (master-detail desktop + carte pédagogique mobile + toggle scan P1) |

---

## 2. Contexte et état initial

### 2.1 Existant cartographié

L'onglet Tennis actuel repose sur 4 sous-onglets `.sc-tab-btn` : **Prematch / Live / Value Bets / Analytics** (`pariscore.html:15920`). Le rendu est porté par deux IIFE :
- `window.Scope` (`pariscore.html:25236-26555`) — fonctions de rendu (`premierCard` `:25811`, `liveCardCompact` `:26066`).
- `window.TennisScope` (`pariscore.html:26560-27280`) — state, fetch, switch.

### 2.2 Forces de l'existant à préserver
- Data backend **extrêmement riche** (WElo, BSD, blended, serve/receive index, fatigue, momentum, DR, BPPI, set Over/Under) via ~157 routes `/api/v1/tennis/*`.
- Composants UI réutilisables déjà éprouvés : `signalBadge`, `gauge`, `momentumChart`, `radar`, `drChart`, favoris ★ (localStorage), `svgIcon`, accordéons.
- Favoris persistés, auto-refresh avec pause on hidden.

### 2.3 Faiblesses identifiées (audit)
- **3 systèmes de rendu qui coexistent** (Scope IIFE, `tn2RenderLiveCards`, `pariscore.js` mobile) avec duplication.
- **`liveCardCompact` = 214 lignes** (logique mélangée, XSS-prone par concaténation).
- **Logique value-bet dupliquée 4×** (`premierCard`, `liveCardCompact`, `topBets`, `prematchCard`).
- **2 routes backend non câblées** : `/tennis/strategies/:id` (bouton placeholder) et `/odds-comparison/:id`.
- **Contrat backend instable** : `mapMatch` compense (proba parfois 0.65 parfois 65, `predictions.elo` number ou objet).
- **CSS mort** `OLD_TENNIS_DEPRECATED` (~20 blocs) + diagnostic `_auditLivePayload` laissé en prod.
- **Aucun raccourci de pari / deeplink bookmaker** sur le tennis (contrairement au foot).

---

## 3. Périmètre exécuté en Phase 0 (cadrage)

| Tâche | Méthode | Livrable |
|---|---|---|
| Exploration codebase | Sous-agent Explore (98 tool uses) | Cartographie complète de l'onglet Tennis (structure, rendu, routes, stratégies, UI, pain points) |
| Cadrage chef de projet | 4 questions structurantes | Périmètre + device + objectif + actions verrouillés |
| Consultation 4 expertises | 4 sous-agents parallèles (webdesigner, data scientist, ingénieur data, expert paris) | 4 briefs détaillés (~600 mots chacun) |
| 3 propositions de design | Synthèse des briefs | P1 Terminal · P2 Carte Décision · P3 Dashboard Trading |
| Vote panel | 8 segments parallèles pondérés (1000 votants) | Verdict agrégé + analyse des 3 blocs d'électorat |
| Décision finale + livrables pilotage | Arbitrage chef de projet | Hybride Dashboard-Carte + Gantt + plan tâches + CR lancement + rapport fin (template) |

**Résultat du vote** : P2 40,7 % (pluralité, grand public) · P3 34,8 % (consensus second, pros/réguliers) · P1 24,5 % (data pur). Aucune majorité absolue → décision hybride pour servir les 3 blocs.

---

## 4. Décision retenue : Hybride Dashboard-Carte

### 4.1 Concept
- **Desktop (≥1024 px)** : squelette master-detail P3 — liste compacte persistante à gauche + panneau détail = carte P2 à droite.
- **Mobile (<1024 px)** : carte pédagogique P2 par défaut + toggle « Scan rapide » basculant en vue liste P1.
- **Pour tous** : signal EV% pilote, modale Parier multi-bookmaker, KPI bar signal, mode Pro dépliable.

### 4.2 Pourquoi cette décision
| Bloc d'électorat | Ce qu'il gagne |
|---|---|
| 🔴 Grand public (mobile, ~500 votants) | Carte P2 par défaut : verdict en mots, photos, pédagogie, bouton Parier |
| 🔵 Pros & experts (desktop, ~400 votants, 40 % volume enjeu) | Master-detail : scan + focus parallèle, mode pro natif, scalabilité |
| 🟡 Data pur (~100 votants) | Toggle Scan P1 : densité brute, EV% énorme, sur 2 devices |

### 4.3 Coûts assumés
- Refactor frontend obligatoire : mini-store observable + composant `<dialog>` natif (sans quoi master-detail = dette a11y).
- 2 layouts à maintenir (master-detail desktop, carte mobile) — prix du responsive équilibré.

---

## 5. Socle technique commun (validé par les 4 expertises)

| Domaine | Décision | Source |
|---|---|---|
| Signal pilote | **EV%** (`best_ev_model.ev_pct`), pas Edge ni Kelly | Consensus data + paris |
| Seuillage tier | ≥5 % Strong · 2-5 % Moderate · <2 % Neutral · avoid | Data scientist |
| Cap de confiance | tier affiché = `min(tier_EV, tier_confiance)` | Data scientist |
| Tri par défaut | Edge décroissant (value flotte en haut) | Webdesigner |
| Marchés chips | Over/Under jeux, Handicaps, at_least_one_set si value ≥ 3 % | Expert paris |
| Live pulse | BPPI critique / momentum_shift / DR divergent | Data + paris |
| Pills pièges | trap_bet, drift, fatigue, surface Elo faible — en coin, jamais bandeau rouge | Expert paris |
| Modale Parier | classement books par edge, best book surligné, deeplink, Kelly optionnel | Expert paris + data eng |
| Polling | adaptatif 20 s live / 90 s prematch | Data engineer |
| Nettoyage | helper `valueBet(m)` unifié, serializer serveur, retrait `_auditLivePayload`, câblage routes dormantes | Data engineer |

---

## 6. Livrables de pilotage produits

| Livrable | Rôle | Localisation |
|---|---|---|
| Design doc détaillé | Chef de projet | `redesign-tennis/DESIGN-DOC-REDESIGN-TENNIS.md` (à rédiger au GO) |
| Gantt de chantier | Chef de projet | `redesign-tennis/GANTT-REDESIGN-TENNIS.md` ✅ |
| Plan de tâches détaillé | Chef de projet | `redesign-tennis/PLAN-TACHES-REDESIGN-TENNIS.md` ✅ |
| CR de lancement (présent doc) | Chef de projet | `redesign-tennis/CR-LANCEMENT-REDESIGN-TENNIS.md` ✅ |
| Rapport de fin de mission | Chef de projet | `redesign-tennis/RAPPORT-FIN-MISSION-REDESIGN-TENNIS.md` (template prêt) |
| Contrat data canonique | Backend Architect | `redesign-tennis/CONTRAT-DATA.md` (Phase 1) |

---

## 7. Équipe affectée

| Rôle | Agent / skill lead | Charge estimée |
|---|---|---|
| Chef de projet | ZCode (orchestration) | ~1 j |
| Webdesigner | `redesign-existing-projects`, `ui-ux-pro-max`, `high-end-visual-design`, `frontend-design` | ~7,5 j |
| Backend Architect | `agency-backend-architect`, `metier-ingenierie` | ~3,5 j |
| Data Engineer | `agency-backend-architect`, `agency-database-optimizer` | ~4 j |
| Data Scientist | consultation interne | ~1,5 j |
| Expert Paris | `betting`, `tennis-data` | ~1,5 j |
| QA / Reality Checker | `metier-audit-qa`, `agency-reality-checker`, `playwright-mcp` | ~2 j |
| **Total** | | **~20 j-h sur ~14 jours calendaires** |

---

## 8. Planning synthétique

| Phase | Intitulé | Durée | Statut |
|---|---|---|---|
| Phase 0 | Cadrage & Design | 2 j | ✅ Terminée |
| Phase 1 | Fondations backend + Design system | 3 j | ⏳ Planifiée (GO requis) |
| Phase 2 | Composants UI (carte P2 + liste P1) | 4 j | 📅 Planifiée |
| Phase 3 | Master-detail + Modale Parier + Live pulse | 4 j | 📅 Planifiée |
| Phase 4 | Refactor dette + QA | 3 j | 📅 Backlog |

**Jalons** : J1 (fondations), J2 (composants), J3 (dashboard), fin (QA + rapport).

---

## 9. Risques majeurs et mitigation

| Risque | Mitigation |
|---|---|
| Contrat backend instable casse le serializer | Tâche 1.2 stabilise le contrat côté serveur AVANT tout composant |
| Master-detail mobile génère de la dette a11y | Tâche 1.5 impose `<dialog>` natif + focus trap ; master-detail desktop-only, carte P2 par défaut mobile |
| Régression silencieuse refactor `liveCardCompact` | Extraction lazy-load incrémentale + screenshot diff à chaque étape |
| Routes dormantes 404/timeout | Modale Parier : timeout 6 s + retry + message "Préparation cotes" |
| Scalabilité carte P2 à 50 matchs | Toggle « Scan rapide » P1 dès Phase 2 ; liste P3 desktop dès Phase 3 |

---

## 10. Checkpoints de sécurité

- [x] Aucune clé API ou secret exposé dans les livrables de cadrage.
- [x] Conformité XSS maintenue (`_jsStr()` sur toutes interpolations `onclick`, per AGENTS.md).
- [ ] Avant Phase 1 : validation que le serializer ne fuit pas de données joueur non autorisées.
- [ ] Avant QA finale : audit `agency-security-architect` sur la modale Parier (deeplinks bookmakers).

---

## 11. Prochaines actions

1. **Obtenir le GO utilisateur** sur le Gantt + le plan de tâches + le présent CR.
2. Au GO : rédiger le design doc détaillé (`DESIGN-DOC-REDESIGN-TENNIS.md`).
3. Créer les tickets beads (32 tâches).
4. Lancer Phase 1 Track A (serializer + contrat) + Track B (tokens + store/dialog) en parallèle.

---

*CR de lancement finalisé le 2026-07-07. En attente du GO utilisateur pour démarrer la Phase 1.*
