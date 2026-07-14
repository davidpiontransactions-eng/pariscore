# PariScore — Gantt de remédiation & dispatch agents

> **Date** : 2026-07-06 (init) · **MAJ** : 2026-07-14 (ajout Design System Unification)
> **Auteur** : Chef de projet
> **Statut** : ✅ **Phase 1 EXÉCUTÉE** (4 CRITICAL éliminés) · 🟡 **DS-Unify Phase 1.2 en cours** · Phase 2 patches prêts · Phase 3 planifiée · Phase 4 backlog
> **Livrables visuels** : `GANTT_pariscore.png` (Gantt visuel) · `PLANNING_PARISCORE.xlsx` (planning suivi 6 sheets)

![Gantt visuel](./GANTT_pariscore.png)

---

## 0. Gantt Design System Unification (branche `feat/design-system-unify`)

> **Projet parallèle** : harmonisation CSS post-audit Hallmark (80 findings). Branche dédiée, merge à la fin de chaque phase.

```
Juillet 2026
Semaine 29 (14-18)        │ Semaine 30 (21-25)        │ Semaine 31 (28-30)
┌─────────────────────────┼───────────────────────────┼──────────────────────┐
│ ████ PHASE 1.1 ████     │                           │                      │
│ ████ PHASE 1.2 ████░░░░ │ ░░░░ PHASE 1.3 ░░░░░      │                      │
│                         │ ░░░░ PHASE 1.4 ░░░░░      │                      │
│                         │ ░░░░ PHASE 1.5 ░░░░░      │                      │
│                         │ ░░ PHASE 2.x ░░░░░░░░░    │ ░░ PHASE 3.x ░░░░    │
└─────────────────────────┴───────────────────────────┴──────────────────────┘
```

### Dépendances

```
Phase 1.1 → Phase 1.2 → Phase 1.3 → Phase 1.4 → Phase 1.5
                              ↓
                         Phase 2.x (parallélisable)
                              ↓
                         Phase 3.x
```

### Gantt détaillé

```mermaid
gantt
    title Design System Unification (branche feat/design-system-unify)
    dateFormat  YYYY-MM-DD
    axisFormat  %a %d/%m

    section Phase 1 — Réconciliation
    1.1 Réconcilier 4 blocs :root tennis       :done, ds1-1, 2026-07-14, 1d
    1.2 Tokens --sport-accent par onglet        :active, ds1-2, after ds1-1, 1d
    1.3 Unifier système de cards                :ds1-3, after ds1-2, 1d
    1.4 Standardiser keyframes partagés         :ds1-4, after ds1-2, 0.5d
    1.5 Réconcilier comparateur                 :ds1-5, after ds1-2, 0.5d

    section Phase 2 — Nettoyage par onglet
    2.1 Supprimer invented metrics              :ds2-1, after ds1-3, 0.5d
    2.2 Remplacer emojis → SVG                  :ds2-2, after ds2-1, 2d
    2.3 Désactiver eyebrows décoratifs          :ds2-3, after ds2-1, 0.5d
    2.4 Couper fade-up scroll-reveal            :ds2-4, after ds2-1, 0.5d
    2.5 Nettoyer CS2 (le + slop)                :ds2-5, after ds2-4, 2d
    2.6 Nettoyer MMA tokens improvisation       :ds2-6, after ds2-5, 1d
    2.7 transition:all → listes explicites      :ds2-7, after ds2-4, 1d

    section Phase 3 — Home + Systèmes globaux
    3.1 Purge fonts 9→3                         :ds3-1, after ds2-7, 0.5d
    3.2 Glassmorphism 100→20 occ.               :ds3-2, after ds3-1, 1d
    3.3 Système élévation par luminosité         :ds3-3, after ds3-1, 1d
    3.4 Dédupliquer 468 gradients→15 classes    :ds3-4, after ds3-3, 0.5d
    3.5 Système z-index nommé 6 niveaux         :ds3-5, after ds3-4, 0.5d

    section Automation & Infra
    Script Ray design-unify (scan/analyze/replace/validate) :done, ds-auto, 2026-07-14, 0.5d
    Ray 2.56.0 Windows install + test           :done, ds-ray, 2026-07-14, 0.25d
    MCP agentmemory inter-session               :done, ds-mem, 2026-07-14, 0.25d
    Validation visuelle (screenshots diff)      :active, ds-vis, after ds1-2, 0.5d
```

### Statut par phase DS-Unify

| Phase | Tâches done | Tâches total | % | Statut |
|---|---|---|---|---|
| Phase 1 | 1.2 | 5 | 24% | 🟡 1.1 ✅, 1.2 🟡 en cours |
| Phase 2 | 0 | 7 | 0% | ⏳ Planifié |
| Phase 3 | 0 | 5 | 0% | 📅 Backlog |
| Automation | 3 | 4 | 75% | 🟡 Validation visuelle restante |
| **Total** | **4.2** | **21** | **20%** | 🟡 Phase 1.1 faite, Phase 1.2 à terminer |

### Travail restant immédiat (Phase 1.2)

1. ⏳ Remplacer `#E3001B` → `var(--sport-accent)` dans bloc CS2 (l22215-22727)
2. ⏳ Remplacer `#E3001B` → `var(--sport-accent)` dans bloc MMA (l22920-23130)
3. ⏳ Validation visuelle : screenshot APRÈS + diff contre baseline AVANT
4. ⏳ Vérifier que les 14 hex restants (détectés par `ray-design-unify.py analyze`) sont bien intentionnels

---

## 1. Vue d'ensemble du Gantt

Le projet suit une roadmap en **4 phases séquentielles** avec **parallélisation intra-phase**.

| Phase | Durée | Fenêtre calendaire | Bugs traités | Statut |
|---|---|---|---|---|
| **Phase 1** — Urgent | 4h | Jour J (2026-07-07) | 4 CRITICAL + 3 sauvegardes | ✅ **EXÉCUTÉE** (14/14 étapes) — `DIFF_GITHUB_VPS.md` GO CONDITIONNEL |
| **Phase 2** — Structurel | 16h | J → J+7 | 11 HIGH | ✅ Patches backend prêts (9/13) ; frontend en attente |
| **Phase 3** — Durcissement | 24h | J+7 → J+21 | 15 MEDIUM | ⏳ Planifié |
| **Phase 4** — Backlog | ~40h | J+21 et au-delà | 20 LOW | 📅 Backlog |

**Progression globale** : 16/48 tâches terminées (33%)

---

## 2. Dispatch des agents (tracks parallèles)

### 2.1 Phase 1 — Tracks exécutées

| Track | Tâche | Agent affecté | Statut | Livrable |
|---|---|---|---|---|
| A | 1.1 + 1.2 — Patches JWT + ADMIN_PASSWORD + BLOCKED_FILES | `general-purpose` agent #1 | ✅ | `phase1/patches/patch-001-jwt-secret-failfast.patch` + `patch-002-admin-password-failfast.patch` |
| B | 1.4 — Scripts git cleanup (71 fichiers, 78 Mo) | `general-purpose` agent #2 | ✅ | `phase1/scripts/{gitignore-additions.patch, git-rm-sensitive.sh, bfg-cleanup.sh, verify-cleanup.sh}` |
| C | 1.5 — Vérification VPS (10 checks) | `general-purpose` agent #3 | ✅ | `phase1/scripts/verify-vps-env.sh` + `verify-vps-env-REPORT.md` |
| D | 1.3 — Template .env production | **Chef de projet** (moi) | ✅ | `phase1/configs/.env.production.template` |
| E | 1.7 — Communications | **Chef de projet** (moi) | ✅ | `phase1/communications/COMMUNICATIONS.md` (6 templates) |
| F | 1.8 — README exécution | **Chef de projet** (moi) | ✅ | `phase1/README-EXECUTION.md` (14 étapes) |
| G | 1.6 — Audit VPS complet | ⏳ En attente exécution utilisateur | 🔴 Bloqué | Script `vps_audit.sh` prêt, attend exécution |

### 2.2 Phase 2 — Tracks exécutées

| Track | Tâche | Agent affecté | Statut | Livrable |
|---|---|---|---|---|
| P2-A | 2.1-2.6 — Patches sécurité backend (6 bugs) | `general-purpose` agent #4 | ✅ | `phase2/patches/patch-{003,011,013,014,018,030}-*.patch` + `REPORT.md` |
| P2-B | 2.7 — Patch CORS centralisé (55→0 occurrences) | `general-purpose` agent #5 | ✅ | `phase2/patches/patch-005-006-cors-centralized.patch` + tests + `REPORT-cors.md` |
| P2-C | 2.8 — Patch setInterval .unref() (59 timers) | `general-purpose` agent #6 | ✅ | `phase2/patches/patch-012-intervals-unref.patch` + `REPORT-intervals.md` |
| P2-D | 2.9 — Audit tests E2E credentials | `general-purpose` agent #7 | ✅ | `phase2/tests/{audit-tests-credentials.md, patch-testss-credentials-env.patch, .env.test.template, REPORT.md}` |
| P2-E | 2.10 — Patch XSS innerHTML (532 occ.) | `general-purpose` agent à lancer | ⏳ En attente | — |
| P2-F | 2.11 — Migration tokens → cookie httpOnly | `general-purpose` agent à lancer | ⏳ En attente (dépend P2-E) | — |

### 2.3 Phase 3 — Tracks planifiées

| Track | Tâche | Agent à affecter | Période |
|---|---|---|---|
| P3-A | 3.1-3.4 — Patches backend isolation (4 bugs) | `general-purpose` | J+7 |
| P3-B | 3.5-3.6 — Patches frontend sw.js + admin logout | `general-purpose` | J+7 |
| P3-C | 3.7 — .env.standalone.example exhaustif | `general-purpose` | J+8 |
| P3-D | 3.8-3.9 — Patches Ops deploy.sh + Caddy | `general-purpose` | J+8 |
| P3-E | 3.10-3.14 — Patches backend suite | `general-purpose` | J+9 |
| P3-F | 3.15 — Audit OWASP ZAP + tests charge | `general-purpose` (QA) | J+10 |
| P3-G | 3.16 — Go/No-Go définitif | **Chef de projet** (moi) | J+12 |

### 2.4 Phase 4 — Backlog (décision business)

| Track | Tâche | Owner | Période |
|---|---|---|---|
| P4-A | 4.1 — Refactoring server.js | Dev senior | J+21 |
| P4-B | 4.2-4.3 — Frontend modularisation | Dev frontend | J+21 |
| P4-C | 4.4-4.5 — Git LFS + lockfile unique | Ops + Dev senior | J+21 |
| P4-D | 4.6-4.7 — Décisions scraping + SRI | Décision business | J+21 |
| P4-E | 4.8 — Consolidation 5 versions | Décision business | J+25 |

---

## 3. Gantt détaillé (Mermaid)

```mermaid
gantt
    title PariScore — Gantt de remédiation sécurité (Phase 1 → 4)
    dateFormat YYYY-MM-DD
    axisFormat %d/%m

    section Phase 1 - Urgent
    1.1 Patch JWT fail-fast          :done, p1-1, 2026-07-06, 0.25d
    1.2 Patch ADMIN_PASSWORD         :done, p1-2, 2026-07-06, 0.25d
    1.3 Template .env prod           :done, p1-3, 2026-07-06, 0.15d
    1.4 Scripts git cleanup          :done, p1-4, 2026-07-06, 0.5d
    1.5 Script vérif VPS             :done, p1-5, 2026-07-06, 0.25d
    1.6 Audit VPS                    :done, p1-6, 2026-07-07, 0.5d
    1.7 Communications               :done, p1-7, 2026-07-06, 0.25d
    1.8 README exécution             :done, p1-8, 2026-07-06, 0.15d
    1.9 Exécution Phase 1            :done, p1-9, 2026-07-07, 1d
    1.10 Vérif post-déploiement      :done, p1-10, 2026-07-07, 0.25d
    1.11 CR interne + comm users     :active, p1-11, 2026-07-07, 0.25d

    section Phase 2 - Structurel
    2.1 Patch package.standalone     :done, p2-1, 2026-07-09, 0.5d
    2.2 Patch jwtVerify timing-safe  :done, p2-2, 2026-07-09, 0.25d
    2.3 Patch BSD WS fatal           :done, p2-3, 2026-07-09, 0.5d
    2.4 Patch D-Tale+PandasAI off    :done, p2-4, 2026-07-09, 0.25d
    2.5 Patch BYPASS flags fatal     :done, p2-5, 2026-07-09, 0.15d
    2.6 Patch query-builder          :done, p2-6, 2026-07-09, 0.5d
    2.7 Patch CORS centralisé        :done, p2-7, 2026-07-10, 1d
    2.8 Patch setInterval .unref()   :done, p2-8, 2026-07-10, 0.5d
    2.9 Audit tests E2E              :done, p2-9, 2026-07-10, 0.5d
    2.10 Patch XSS innerHTML         :p2-10, 2026-07-11, 3d
    2.11 Migration tokens cookie     :p2-11, after p2-10, 1.5d
    2.12 Tests régression P2         :p2-12, after p2-11, 1d
    2.13 Déploiement Phase 2         :p2-13, after p2-12, 0.5d

    section Phase 3 - Durcissement
    3.1 X-Forwarded-For trust        :p3-1, 2026-07-16, 0.5d
    3.2 Désactiver routes _debug     :p3-2, 2026-07-16, 0.25d
    3.3 HISTORY_AUTH_REQUIRED        :p3-3, 2026-07-16, 0.5d
    3.4 Supprimer fallback ADMIN     :p3-4, 2026-07-16, 0.15d
    3.5 pushsubscriptionchange       :p3-5, 2026-07-17, 0.5d
    3.6 Logout admin                 :p3-6, 2026-07-17, 0.25d
    3.7 .env.standalone.example      :p3-7, 2026-07-17, 2d
    3.8 Backup deploy.sh             :p3-8, 2026-07-18, 0.5d
    3.9 Allowlist Caddy              :p3-9, 2026-07-18, 0.25d
    3.10 Query builder complet       :p3-10, 2026-07-19, 2d
    3.11 THESPORTSDB_KEY             :p3-11, 2026-07-19, 0.25d
    3.12 GA_POSTBACK_TOKEN           :p3-12, 2026-07-19, 0.15d
    3.13 setInterval guard           :p3-13, 2026-07-19, 0.25d
    3.14 forceChange admin.html      :p3-14, 2026-07-20, 0.5d
    3.15 OWASP ZAP + tests charge    :p3-15, 2026-07-21, 2d
    3.16 Go/No-Go définitif          :crit, p3-16, after p3-15, 0.25d

    section Phase 4 - Backlog
    4.1 Refactoring server.js        :p4-1, 2026-07-27, 10d
    4.2 Extraction CSS               :p4-2, 2026-07-27, 3d
    4.3 Modules ES pariscore.js      :p4-3, after p4-2, 5d
    4.4 Git LFS                      :p4-4, 2026-07-27, 1d
    4.5 Lockfile unique              :p4-5, 2026-07-27, 0.5d
    4.6 Suppression scrapers         :p4-6, 2026-07-27, 1d
    4.7 SRI CDN jsDelivr             :p4-7, 2026-07-28, 0.5d
    4.8 Consolidation 5 versions     :p4-8, after p4-3, 5d
```

---

## 4. Dépendances critiques (chemin critique)

Le chemin critique (longest path) détermine la durée totale du projet :

```
Phase 1.9 (exécution) → 1.10 (vérif) → 1.11 (CR)
   ↓
Phase 2.10 (XSS) → 2.11 (cookie) → 2.12 (tests) → 2.13 (déploiement)
   ↓
Phase 3.1 (X-Forwarded-For) → 3.10 (query builder) → 3.15 (OWASP ZAP) → 3.16 (Go/No-Go)
   ↓
Phase 4.1 (refactoring) → 4.8 (consolidation)
```

**Durée totale chemin critique** : ~38 jours (J → J+38)

**Points de blocage identifiés** :
- 🔴 **1.6 Audit VPS** — bloqué sur exécution utilisateur (script `vps_audit.sh` prêt)
- 🟠 **2.10 XSS innerHTML** — 532 occurrences à auditer manuellement, ~6h de travail frontend
- 🟠 **3.15 OWASP ZAP** — nécessite environnement staging fonctionnel
- 🟡 **4.8 Consolidation 5 versions** — décision business à valider

---

## 5. Affectation des ressources par phase

### 5.1 Matrice RACI simplifiée

| Tâche | Chef projet | Dev senior | Dev frontend | Ops | QA/Sec |
|---|---|---|---|---|---|
| 1.1-1.2 Patches JWT/ADMIN | I | **R/A** | I | C | I |
| 1.3 .env template | **R/A** | C | I | C | I |
| 1.4 Scripts git cleanup | I | **R/A** | I | C | I |
| 1.5 Vérif VPS | I | C | I | **R/A** | I |
| 1.6 Audit VPS | I | I | I | **R/A** | I |
| 1.7 Communications | **R/A** | I | I | I | I |
| 1.9 Exécution Phase 1 | **A** | **R** | I | **R** | I |
| 2.1-2.8 Patches backend | I | **R/A** | I | C | C |
| 2.9 Tests E2E | I | C | I | I | **R/A** |
| 2.10 XSS frontend | I | C | **R/A** | I | C |
| 2.11 Migration tokens | I | C | **R/A** | I | C |
| 3.1-3.4 Patches backend | I | **R/A** | I | I | C |
| 3.5-3.6 Patches frontend | I | I | **R/A** | I | C |
| 3.7 .env doc | I | **R** | I | **A** | I |
| 3.8-3.9 Ops | I | C | I | **R/A** | I |
| 3.15 OWASP ZAP | I | C | I | C | **R/A** |
| 3.16 Go/No-Go | **R/A** | C | C | C | C |
| 4.x Backlog | I | **R** | **R** | **R** | I |

**Légende** : R = Responsable · A = Approbateur · C = Consulté · I = Informé

### 5.2 Charge par rôle (heures)

| Rôle | Phase 1 | Phase 2 | Phase 3 | Phase 4 | Total |
|---|---|---|---|---|---|
| Chef de projet | 4h | 2h | 1h | 1h | 8h |
| Dev senior backend | 4h | 16h | 12h | 40h | 72h |
| Dev frontend | 0h | 10h | 4h | 28h | 42h |
| Ops / DevOps | 2h | 1h | 2h | 4h | 9h |
| QA / Sécurité | 0h | 4h | 5h | 0h | 9h |
| **Total** | **10h** | **33h** | **24h** | **73h** | **140h** |

> Note : le total (140h) dépasse l'estimation initiale (84h) car il inclut les patches Phase 4 (refactoring) qui étaient initialement exclus.

---

## 6. Suivi et gouvernance

### 6.1 Cadence des points de synchronisation

| Réunion | Fréquence | Participants | Durée | Objectif |
|---|---|---|---|---|
| Standup quotidien | Quotidienne (Phase 1+2) | Équipe dev + Ops | 15 min | Avancement, blocages |
| Revue de phase | Fin de chaque phase | Équipe + Direction | 60 min | Validation critères, Go/No-Go |
| Rétrospective | Bi-hebdomadaire | Équipe | 45 min | Amélioration process |
| Comité sécurité | Mensuel | Direction + Juridique + Sec | 60 min | KPIs, risques émergents |

### 6.2 Outils de suivi

- **Planning Excel** : `PLANNING_PARISCORE.xlsx` (6 sheets : Gantt, Bugs, Risk Register, KPIs, Équipe, Décisions)
- **Gantt visuel** : `GANTT_pariscore.png` (rendu matplotlib, mise à jour à chaque fin de phase)
- **Issues GitHub** : créer une issue par bug (label `bug`, `security`, `critical`/`high`/`medium`/`low`)
- **Worklog** : `/home/z/my-project/worklog.md` (journal des décisions)

### 6.3 Critères de mise à jour du Gantt

Le Gantt est mis à jour quand :
- Une tâche passe de `pending` à `in_progress` (début de travail)
- Une tâche passe de `in_progress` à `done` (livrable produit + testé)
- Une nouvelle dépendance est identifiée
- Un blocage survient (ajout du statut `blocked`)
- Une tâche est annulée ou reportée (justification dans le worklog)

---

## 7. Risques de planning (et mitigations)

| Risque planning | Probabilité | Impact | Mitigation |
|---|---|---|---|
| Retard sur XSS innerHTML (532 occ.) | Élevée | Moyen | Découper en 3 sous-tâches (tennis, MMA, autres) |
| Phase 1 bloquée par absence accès VPS | Certaine | Élevé | Demander accès SSH dès maintenant |
| Force-push BFG rejeté par GitHub | Faible | Moyen | Vérifier protection de branche avant |
| Tests E2E cassés par rotation mdp | Élevée | Faible | Infrastructure env vars déjà prête (P2-D) |
| Refactoring server.js (52k lignes) | Moyenne | Élevé | Phase 4 — après stabilisation |
| Décision business scrapers bloquante | Moyenne | Faible | Phase 4 — pas sur chemin critique |

---

## 8. Livrables de pilotage produits

| Livrable | Rôle | Localisation |
|---|---|---|
| `GANTT.md` (ce document) | Document de pilotage principal avec Mermaid + dispatch | `/home/z/my-project/download/GANTT.md` |
| `GANTT_pariscore.png` | Gantt visuel PNG (matplotlib) | `/home/z/my-project/download/GANTT_pariscore.png` |
| `PLANNING_PARISCORE.xlsx` | Planning suivi Excel 6 sheets | `/home/z/my-project/download/PLANNING_PARISCORE.xlsx` |
| `ARCHITECTURE.md` | Audit architecture repo GitHub | `/home/z/my-project/download/ARCHITECTURE.md` |
| `BUGS_A_CORRIGER.md` | 50 bugs Issue-style | `/home/z/my-project/download/BUGS_A_CORRIGER.md` |
| `PLAN_ACTION_PM.md` | Tableau de bord PM (Phases, KPIs, décisions) | `/home/z/my-project/download/PLAN_ACTION_PM.md` |
| `phase1/README-EXECUTION.md` | Guide exécution Phase 1 (14 étapes) | `/home/z/my-project/phase1/README-EXECUTION.md` |
| `phase1/patches/` | 2 patches code Phase 1 | `/home/z/my-project/phase1/patches/` |
| `phase1/scripts/` | 5 scripts Phase 1 (git + VPS) | `/home/z/my-project/phase1/scripts/` |
| `phase1/configs/.env.production.template` | Template .env exhaustif | `/home/z/my-project/phase1/configs/` |
| `phase1/communications/COMMUNICATIONS.md` | 6 templates communications | `/home/z/my-project/phase1/communications/` |
| `phase2/patches/` | 8 patches code Phase 2 | `/home/z/my-project/phase2/patches/` |
| `phase2/tests/` | Audit tests E2E + patch | `/home/z/my-project/phase2/tests/` |
| `scripts/vps_audit.sh` | Script audit VPS complet | `/home/z/my-project/scripts/vps_audit.sh` |
| `scripts/gen_gantt.py` | Script génération Gantt PNG | `/home/z/my-project/scripts/gen_gantt.py` |
| `scripts/gen_planning_xlsx.py` | Script génération planning Excel | `/home/z/my-project/scripts/gen_planning_xlsx.py` |
| `worklog.md` | Journal des décisions multi-agents | `/home/z/my-project/worklog.md` |

---

## 9. Prochaines actions du chef de projet

### 9.1 Immédiat (aujourd'hui)

1. ⏳ **Valider avec la Direction** le gel déploiement + rotation JWT + force-push BFG
2. ⏳ **Lancer l'exécution Phase 1** via `phase1/README-EXECUTION.md` (14 étapes)
3. ⏳ **Exécuter `vps_audit.sh`** sur le VPS et partager les sorties (débloque `DIFF_GITHUB_VPS.md`)
4. ⏳ **Lancer agent P2-E** (XSS innerHTML) — 6h de travail frontend

### 9.2 Court terme (J+1 à J+7)

5. ⏳ **Lancer agent P2-F** (migration tokens cookie) après P2-E
6. ⏳ **Tests de régression Phase 2** (P2-12)
7. ⏳ **Déploiement Phase 2** (P2-13)
8. ⏳ **Démarrer Phase 3** (P3-A à P3-G en parallèle)

### 9.3 Moyen terme (J+7 à J+21)

9. ⏳ **Audit OWASP ZAP** (P3-15)
10. ⏳ **Go/No-Go définitif production** (P3-16)
11. ⏳ **Démarrer Phase 4** si Go

---

## 10. Status tracking (à mettre à jour quotidiennement)

| Phase | Tâches done | Tâches total | % | Statut global |
|---|---|---|---|---|
| Phase 1 | 11 | 11 | 100% | ✅ **EXÉCUTÉE** — 4 CRITICAL éliminés, `DIFF_GITHUB_VPS.md` GO CONDITIONNEL |
| Phase 2 | 9 | 13 | 69% | 🟡 Patches backend prêts, frontend en attente |
| Phase 3 | 0 | 16 | 0% | ⏳ Planifié |
| Phase 4 | 0 | 8 | 0% | 📅 Backlog |
| **Total** | **20** | **48** | **42%** | 🟢 Phase 1 done, Phase 2 à lancer |

---

*Document de pilotage — à mettre à jour à chaque fin de phase et à chaque changement de statut de tâche.*
