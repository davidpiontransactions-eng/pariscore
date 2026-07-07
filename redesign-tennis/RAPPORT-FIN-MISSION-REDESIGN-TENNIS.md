# Rapport de Fin de Mission — Redesign UI Tennis « Prematch & Live »

> **Projet** : PariScore
> **Mission** : Redesign du sous-onglet Tennis Prematch & Live — Hybride Dashboard-Carte
> **Date de lancement** : 2026-07-07
> **Date de clôture** : 📅 _<à compléter en fin de chantier>_
> **Auteur** : Chef de projet (agent ZCode)
> **Statut** : 🟡 **Template** — à compléter à la fin de la Phase 4
> **Réf. Gantt** : `redesign-tennis/GANTT-REDESIGN-TENNIS.md`
> **Réf. CR lancement** : `redesign-tennis/CR-LANCEMENT-REDESIGN-TENNIS.md`

---

## 1. Synthèse exécutive

| Métrique | Cible | Réalisé | Écart |
|---|---|---|---|
| Tâches planifiées | 32 | 📅 _<nb>_ | _<écart>_ |
| Tâches livrées | 32 | 📅 _<nb>_ | _<écart>_ |
| Durée chantier (Phases 1-4) | 14 j | 📅 _<nb>_ | _<écart>_ |
| Charge totale | ~20 j-h | 📅 _<nb>_ | _<écart>_ |
| Jalons validés (J1/J2/J3/fin) | 4/4 | 📅 _<nb>/4>_ | _<écart>_ |
| Bugs bloquants en QA finale | 0 | 📅 _<nb>_ | _<écart>_ |
| Régressions visuelles | 0 | 📅 _<nb>_ | _<écart>_ |

**Verdict global** : 📅 _<GO / GO conditionnel / NO-GO — à compléter>_

---

## 2. Objectifs vs réalisations

| Objectif initial (Phase 0) | Statut | Preuve |
|---|---|---|
| Signal fort, info minimale (« 1 coup d'œil = décision ») | 📅 | _<captures carte P2 / ligne P1>_ |
| Tri par défaut = Edge décroissant | 📅 | _<capture liste triée>_ |
| Modale Parier multi-bookmaker (câble `/odds-comparison/:id`) | 📅 | _<capture modale + log fetch `_>` |
| Câblage de `/strategies/:id` (fin du placeholder) | 📅 | _<capture panneau stratégies>_ |
| Master-detail desktop (≥1024 px) | 📅 | _<capture split 40/60>_ |
| Carte pédagogique mobile par défaut | 📅 | _<capture mobile>_ |
| Toggle « Scan rapide » mobile | 📅 | _<capture toggle>_ |
| Live pulse (BPPI / momentum / DR divergent) | 📅 | _<capture/live pulse>_ |
| KPI bar signal (Edge / VB / Live / ROI) | 📅 | _<capture KPI bar>_ |
| Helper `valueBet(m)` unifié | 📅 | _<diff code : 4 fonctions → 1 helper>_ |
| Serializer serveur `_serializeTennisCard` | 📅 | _<diff server.js>_ |
| Retrait `_auditLivePayload` + endpoint `/coverage` | 📅 | _<diff + curl /coverage>_ |
| Purge `OLD_TENNIS_DEPRECATED` (~20 blocs) | 📅 | _<diff CSS>_ |
| Refactor `liveCardCompact` (214 → ~90 lignes) | 📅 | _<diff : 214 → _<nb> lignes>_ |
| Polling adaptatif (20 s live / 90 s prematch) | 📅 | _<diff startAutoRefresh>_ |

---

## 3. Livrables par phase

### Phase 1 — Fondations
| Tâche | Livrable | Statut |
|---|---|---|
| 1.1 Serializer `_serializeTennisCard` | `server.js` (section tennis) | 📅 |
| 1.2 Contrat data canonique | `redesign-tennis/CONTRAT-DATA.md` + `mapMatch` allégé | 📅 |
| 1.3 Helper `valueBet(m)` | `Scope.valueBet` partagé | 📅 |
| 1.4 Design tokens | CSS variables `.sc-*` | 📅 |
| 1.5 Mini-store + `<dialog>` | `Scope.store` + dialog natif | 📅 |

### Phase 2 — Composants UI
| Tâche | Livrable | Statut |
|---|---|---|
| 2.1 Carte P2 Décision | `Scope.decisionCard(m)` | 📅 |
| 2.2 Ligne P1 Terminal | `Scope.scanRow(m)` | 📅 |
| 2.3 Signal system | `.sc-tier-*` + `signalBadge` révisé | 📅 |
| 2.4 Chips marchés | `Scope.marketChips(m)` | 📅 |
| 2.5 KPI bar | KPI bar sticky révisée | 📅 |
| 2.6 Toggle Scan rapide | Segmented control mobile | 📅 |

### Phase 3 — Dashboard + Modale + Live
| Tâche | Livrable | Statut |
|---|---|---|
| 3.1 Master-detail desktop | Layout `.sc-master-detail` | 📅 |
| 3.2 Modale Parier | `Scope.betModal(matchId)` | 📅 |
| 3.3 Live pulse | Classes `.sc-pulse-*` | 📅 |
| 3.4 Stratégies P3 | 5 jauges consensus | 📅 |
| 3.5 Pills pièges | Pills ⚠ discrètes | 📅 |
| 3.6 Mode Pro | Couche P4 dépliable | 📅 |

### Phase 4 — Dette + QA
| Tâche | Livrable | Statut |
|---|---|---|
| 4.1 Purge `OLD_TENNIS_DEPRECATED` | Diff CSS (-~22 blocs) | 📅 |
| 4.2 Refactor `liveCardCompact` | 214 → _<nb> lignes | 📅 |
| 4.3 Unification favoris | `ps_tennis_favs` source unique | 📅 |
| 4.4 Endpoint `/coverage` | Route admin + logs structurés | 📅 |
| 4.5 Polling adaptatif | `startAutoRefresh` modifié | 📅 |
| 4.6 QA finale | Rapport QA + validation a11y | 📅 |

---

## 4. Validation finale

### 4.1 Parcours personas (Playwright)

| Persona | Parcours | Résultat |
|---|---|---|
| Récréatif mobile | prematch → carte P2 → bouton Parier → modale | 📅 _<pass/fail>_ |
| Régulier desktop | scan liste → master-detail → modale Parier | 📅 _<pass/fail>_ |
| Pro / semi-pro | mode Pro dépliable → stratégies → odds-comparison | 📅 _<pass/fail>_ |
| Live | pulse BPPI/momentum/DR, polling adaptatif | 📅 _<pass/fail>_ |

### 4.2 Audit accessibilité (WCAG)

| Critère | Niveau | Résultat |
|---|---|---|
| Contrastes couleur (palette sémantique) | AA | 📅 |
| Zones tap mobile ≥ 44 px | AA | 📅 |
| Bordure tier doublée d'un label texte (WCAG 1.4.1) | A | 📅 |
| ARIA sur accordéons (`aria-expanded`/`aria-controls`) | A | 📅 |
| Focus trap sur modale Parier (`<dialog>` natif) | A | 📅 |
| `prefers-reduced-motion` respecté sur pulses | AA | 📅 |

### 4.3 Validation contrat data

| Test | Résultat |
|---|---|
| `mapMatch` sans branche défensive `typeof` | 📅 |
| `prob` toujours 0-1 | 📅 |
| `predictions` toujours objet structuré | 📅 |
| `best_ev_model` toujours présent ou `null` | 📅 |
| `stale`/`age_ms` présent sur chaque cote | 📅 |

### 4.4 Non-régression

| Test | Avant | Après |
|---|---|---|
| `node --check` sur `server.js` | ✅ | 📅 |
| `node --check` sur `pariscore.html` inline scripts | ✅ | 📅 |
| Favoris cohérents master-detail ↔ carte | — | 📅 |
| Screenshot diff prematch (5 matchs) | baseline | 📅 |
| Screenshot diff live (3 matchs) | baseline | 📅 |

---

## 5. Statistiques finales

| Métrique | Valeur |
|---|---|
| Lignes ajoutées | 📅 _<nb>_ |
| Lignes supprimées | 📅 _<nb>_ |
| `liveCardCompact` avant → après | 214 → _<nb>_ lignes |
| Blocs CSS `OLD_TENNIS_DEPRECATED` purgés | _<nb>_ / ~22 |
| Routes dormantes câblées | _<nb>_ / 2 (`/strategies`, `/odds-comparison`) |
| Tickets beads ouverts / fermés | 📅 _<nb>_ / _<nb>_ |
| Sessions de travail | 📅 _<nb>_ |
| Bugs détectés en QA | 📅 bloquants : _<nb>_ · ⚠ mineurs : _<nb>_ |

---

## 6. Décisions d'architecture notables

_<À compléter en fin de chantier — décrire ici les arbitrages techniques marquants pris pendant l'exécution (ex : choix du pattern store, gestion du fallback mobile, stratégie de lazy-load P3).>_

---

## 7. Leçons apprises

_<À compléter — ce qui a bien marché, ce qui serait à refaire autrement (ex : le vote panel 1000 votants comme méthode de validation design, le câblage des routes dormantes en fin de chantier vs début, etc.).>_

---

## 8. Procédure de déploiement

1. [ ] `git pull --rebase` + résolution conflits éventuels.
2. [ ] `bd dolt push` (synchronisation tickets).
3. [ ] Commit atomique par phase (4 commits : `feat(tennis-redesign): phase N — <résumé>`).
4. [ ] Push branche `redesign-tennis-prematch-live`.
5. [ ] PR + review `agency-code-reviewer` + `agency-reality-checker`.
6. [ ] Déploiement Render.com (blue-green via `render.yaml`).
7. [ ] Vérification post-deploy : `/api/v1/status` + smoke test parcours récréatif mobile.

---

## 9. Actions post-livraison (backlog)

- [ ] Télémétrie : suivre l'adoption du toggle « Scan rapide » (quelle proportion de users bascule en P1 ?).
- [ ] A/B test : carte P2 par défaut vs scan P1 par défaut sur mobile (mesurer conversion bouton Parier).
- [ ] Dashboard `/coverage` : alerting si `cov_odds < 60 %` ou `stale_odds > 30 %`.
- [ ] étendre le pattern hybride aux sous-onglets Value Bets et Analytics (cohérence globale).
- [ ] Câbler d'autres marchés secondaires (Aces, Most Aces) si data fiable.

---

## 10. Remerciements

_<À compléter — citer les expertises consultées (webdesigner, data scientist, ingénieur data, expert paris), le panel de 1000 votants simulés, et les agents/skills mobilisés.>_

---

*Rapport de fin de mission — template préparé le 2026-07-07, à finaliser à la clôture de la Phase 4. Méthodologie : conception collaborative (4 expertises) + vote panel simulé (1000 votants, 8 segments) + exécution en 4 phases avec jalons.*
