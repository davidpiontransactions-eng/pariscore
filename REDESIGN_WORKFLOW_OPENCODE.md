# Workflow Redesign Design System · OpenCode · 2026-07-14 → 2026-07-30

> **Fichier de mission à lire en entier avant de démarrer la session OpenCode.**
> Prépare l'exécution du plan d'unification post-audit Hallmark avec Gantt,
> dépendances, chemin critique, et protocole git/VPS strict.
>
> **Source** : `todo.md` (plan détaillé) + `AUDIT_HALLMARK_PARISCORE_*.md` (2 rapports).
> **Compétences à invoquer** : `design-system-unify`, `visual-regression`, `hallmark`.

---

## 0. Lecture préalable obligatoire (15 min)

Avant la moindre ligne de code, lire dans cet ordre :

1. **`AUDIT_HALLMARK_PARISCORE_2026-07-13.md`** — home/football (13 findings, 5 critical)
2. **`AUDIT_HALLMARK_PARISCORE_SPORTS_2026-07-13.md`** — 25 pages (80 findings)
3. **`todo.md`** section "PRIORITÉ DEMAIN" — plan d'action ordonné + zones file:line
4. **`.agents/skills/design-system-unify/SKILL.md`** — workflow + 6 garde-fous
5. **`.agents/skills/visual-regression/SKILL.md`** — convention screenshots
6. **`.agents/skills/hallmark/references/anti-patterns.md`** — liste des tells

**Décision clé à valider avant de coder** : branche dédiée vs main.
- **Recommandé** : `feat/design-system-unify` (merge à la fin de chaque phase).
- Si tu préfères travailler sur `main` : commits atomiques obligatoires (cf. § 4).

---

## 1. Vue d'ensemble — 17 jours, 3 phases

```
PHASE 1 — Réconciliation design system (5 jours) — CHemin critique
PHASE 2 — Nettoyage Hallmark par onglet (7 jours) — dépend de Phase 1
PHASE 3 — Nettoyage home + globals (3 jours) — dépend de Phase 1
+ Marge imprévus / QA final (2 jours)
─────────────────────────────────────────────────────────────────
TOTAL : 17 jours ouvrés (2026-07-14 → 2026-07-30)
```

**Sprint court recommandé** : démarrer en parallèle la **migration Next.js** (Phase 4
hors scope de ce workflow) sur les routes les plus propres (Cycling) pour valider
le nouveau design system sur du neuf, pas seulement du legacy.

---

## 2. Gantt prévisionnel

```
Juillet 2026
Semaine 29                │ Semaine 30                │
L  M  M  J  V  S  D       │ L  M  M  J  V  S  D       │
14 15 16 17 18 19 20      │ 21 22 23 24 25 26 27      │
══════════════════════════│═══════════════════════════│
                          │                           │
PHASE 1 — Réconciliation  │                           │
design system (5j)        │                           │
■■■■■                     │                           │
14═15═16═17═18            │                           │
 ╲                        │                           │
  ╲ PHASE 2 — Nettoyage   │                           │
   ╲ Hallmark onglet (7j) │                           │
    ■■■■■■■               │                           │
    17═18═19═20═21═22═23  │                           │
     ╲                    │                           │
      ╲ PHASE 3 —         │                           │
       ╲ globals (3j)     │                           │
        ■■■               │                           │
        24═25═26          │                           │
         ╲                │                           │
          ╲ QA final +    │                           │
           ╲ déploiement  │                           │
            ■■            │                           │
            29═30         │                           │
                          │                           │
```

### Légende
- `■` jour de travail
- `═` chemin critique (le retard sur cette tâche retarde tout le projet)
- `╲` dépendance (la tâche suivante ne peut pas démarrer avant)

### Chevauchements volontaires
- **Phase 2 démarre J4** (pas J6) : le nettoyage Hallmark de CS2 peut commencer
  dès que les tokens `--sport-accent` sont en place (Phase 1.2), sans attendre
  la fin de 1.3/1.4/1.5. **Gain : 2 jours sur le chemin critique.**
- **Phase 3 démarre J9** en parallèle de la fin de Phase 2 : les globals (fonts
  purge, glassmorphism, gradients) sont indépendants du nettoyage par onglet.

---

## 3. Détail des tâches (avec dépendances et livrables)

### PHASE 1 — Réconciliation design system (J1-J5)

| # | Tâche | Durée | Dépend de | Livrable |
|---|---|---|---|---|
| **1.1** | Réconcilier 4 blocs `:root` tennis en 1 | 2 j | — | 4 passes : `tn2` → `ps` → `tl` → suppression. -300 lignes CSS. Page tennis visuellement identique. |
| **1.2** | Définir tokens `--sport-accent` par onglet | 1 j | 1.1 (pour hériter des globals) | Bloc CSS ajouté dans `:root` global L282-325. Hex inline remplacés par `var(--sport-accent)`. |
| **1.3** | Unifier système de cards (6 → 1) | 1 j | 1.1 | `sc-card`/`sc-livecard` tennis adoptés partout. `tn2-match-card`, `tl-card`, `ps-metric-xxl` dépréciés. |
| **1.4** | Standardiser keyframes partagés | 0.5 j | 1.1 | 1 `@keyframes live-pulse` + 1 `@keyframes skeleton-shimmer` partagés. |
| **1.5** | Réconcilier comparateur | 0.5 j | 1.2 | `.comp-light` / `toggleCompTheme()` retirés OU divergence assumée et documentée. |
| **QA1** | Re-audit Hallmark + capture 25 pages | 0.5 j | 1.1-1.5 | Rapport `.hallmark-baseline/post-phase1-audit.md`. Targets : critical 17→10, major 43→25. |

**Chemin critique Phase 1** : 1.1 → 1.2 → (1.3 et 1.4 parallèles) → 1.5 → QA1

### PHASE 2 — Nettoyage Hallmark par onglet (J4-J10)

⚠️ Démarre à J4 (chevauchement volontaire) — dès que Phase 1.2 est livrée.

| # | Tâche | Durée | Dépend de | Livrable |
|---|---|---|---|---|
| **2.1** | Supprimer invented metrics | 0.5 j | — | "15 AI Tipsters" + "hit rate ~40%" remplacés par `—` ou sourcés |
| **2.2** | Emojis → SVG (Lucide) | 2 j | — | 30+ emojis remplacés. Bibliothèque Lucide unifiée. |
| **2.3** | Désactiver eyebrows `.section-label` | 0.5 j | — | ~10 eyebrows décoratifs retirés |
| **2.4** | Couper fade-up scroll-reveal | 0.5 j | — | 24+ occurrences home + CS2 + tennis |
| **2.5** | Nettoyer CS2 (le plus slop) | 2 j | 1.2 | Cyan-green pulse → border statique. 5+ side-stripes → hairline. Double thème → 1 thème. |
| **2.6** | Nettoyer MMA tokens | 1 j | 1.2 | `--mma-accent`, `--mma-gold` scoped. Hex inline éliminés. |
| **2.7** | `transition:all` → listes explicites | 1 j | — | 49 occurrences (29 home + 20 tennis) remplacées |
| **QA2** | Re-audit + capture | 0.5 j | 2.1-2.7 | Rapport post-Phase 2. Targets : critical 10→5, major 25→15. |

**Parallélisable** : 2.1, 2.3, 2.4 n'ont pas de dépendance entre elles → faire en
même temps. 2.5 et 2.6 dépendent de 1.2 (tokens `--sport-accent`).

### PHASE 3 — Nettoyage home + globals (J9-J11)

⚠️ Démarre à J9 (chevauchement) — indépendant de Phase 2.

| # | Tâche | Durée | Dépend de | Livrable |
|---|---|---|---|---|
| **3.1** | Purge fonts 9 → 3 | 0.5 j | — | -700 Ko fonts, LCP -200ms |
| **3.2** | Glassmorphism 100 → 20 | 1 j | — | `backdrop-filter` réservé aux overlays réels |
| **3.3** | Système élévation par luminosité | 1 j | 1.2 | 609 box-shadow → tokens `--elev-0..4` |
| **3.4** | Dédupliquer 468 gradients → 15 utility classes | 0.5 j | — | `grep -c gradient` < 50 |
| **3.5** | Système z-index nommé | 0.5 j | — | Échelle `--z-base..toast` |
| **QA3** | Re-audit + capture + perf | 0.5 j | 3.1-3.5 | Rapport post-Phase 3. LCP < 2s. Targets : critical 5→0, major 15→5. |

### FINAL (J12-J14)

| # | Tâche | Durée | Livrable |
|---|---|---|---|
| **F1** | Audit Hallmark complet final (25 pages) | 1 j | `AUDIT_FINAL_2026-07-29.md`. Target : 0 critical, < 10 major. |
| **F2** | `design.md` (lock the system) via Hallmark | 0.5 j | `design.md` à la racine empêchant la dérive future |
| **F3** | Déploiement VPS + monitoring | 0.5 j | VPS à jour, `pm2 logs pariscore` propre, Lighthouse > 90 |

---

## 4. Protocole Git strict (NON-NÉGOCIABLE)

### 4.1 Structure des commits

**Un commit = une sous-tâche** (1.1-passe1, 1.1-passe2, 2.5-kill-pulse…). Jamais
de "big bang commit" sur plusieurs phases.

**Format de message (Conventional Commits + scope)** :
```
<type>(design): Phase X.Y[.passe] — <sous-tâche courte>

- <détail 1>
- <détail 2>

Audit Hallmark: <N> → <M> findings (delta -<X>)
Screenshots: .hallmark-baseline/<onglet>-<phase>-AVANT/APRES.png
Refs: AUDIT_HALLMARK_PARISCORE_SPORTS_2026-07-13.md §<section>
```

**Types autorisés** :
- `refactor(design)` — réconciliation tokens, unification cards, keyframes (Phase 1)
- `fix(design)` — suppression slop tells, invented metrics, fade-up (Phase 2)
- `perf(design)` — purge fonts, glassmorphism cleanup (Phase 3)
- `docs(design)` — rapports d'audit, design.md
- `chore(design)` — baseline screenshots, backups

**Exemples concrets** :
```
refactor(design): Phase 1.1.passe1 — aliaser --tn2-* vers les tokens globaux

- --tn2-bg #0e1420 → var(--bg2)
- --tn2-card #172132 → var(--bg3)
- --tn2-accent #0077ff → var(--blue)
- Bloc :root tn2 (L23139-23169) conservé, valeurs redirigées

Audit Hallmark tennis: 14 → 11 findings (delta -3)
Screenshots: .hallmark-baseline/tennis-p1.1-passe1-AVANT/APRES.png

fix(design): Phase 2.5 — CS2 cyan-green pulse border → border statique

- .cs2-card.has-value-map: animation cs2-value-pulse retirée
- Remplacée par border-left:3px solid var(--sport-accent) + badge VALUE typo
- 5 side-stripes convertis en hairline border
- Double thème (orange dark + rouge light) → uniquement dark

Audit Hallmark CS2: 8 → 2 findings (delta -6)
Refs: AUDIT_HALLMARK_PARISCORE_SPORTS_2026-07-13.md §CS2
```

### 4.2 Cadence de commit/push

| Événement | Action |
|---|---|
| Avant chaque sous-tâche | `git add -A && git commit -m "chore(design): baseline avant <sous-tâche>"` |
| Après chaque sous-tâche validée (visuellement + audit) | `git add -A && git commit -m "<type>(design): Phase X.Y — <sous-tâche>"` |
| Fin de chaque Phase (1, 2, 3) | `git push origin <branche>` |
| Si work sur `feat/design-system-unify` | Push + PR vers `main` à la fin de chaque phase |
| Si work sur `main` direct | Push à chaque fin de phase (pas à chaque sous-tâche — éviter de polluer l'historique) |

**Push cadence** : minimum 1 push par jour en fin de session. Idéalement 1 push
par phase complète.

### 4.3 Rollback (en cas de casse)

```
# Si une sous-tâche casse visuellement :
git log --oneline -5                              # identifier le commit à annuler
git revert <hash>                                 # revert propre (garde l'historique)
# NE PAS faire git reset --hard <hash> sauf si explicitly demandé

# Si tu veux comparer avant/après rapidement :
git stash                                         # mettre de côté les modifs en cours
git checkout <hash-avant> -- pariscore.html       # voir l'ancienne version
git checkout HEAD -- pariscore.html               # revenir au current
git stash pop                                     # restaurer les modifs
```

---

## 5. Protocole de déploiement VPS (51.75.21.239)

### 5.1 Pré-requis (vérifier avant tout déploiement)

- [ ] Tests locaux OK : `bun run lint`, audit Hallmark passe, screenshots APRÈS valides
- [ ] `git status` clean (rien en staging)
- [ ] Build local OK : `bun run build` (vérifie pas de regression TS/Next)

### 5.2 Déploiement progressif (pas big-bang)

**Stratégie** : déployer à la fin de chaque phase, pas à chaque sous-tâche.
3 déploiements au total (fin Phase 1, fin Phase 2, fin Phase 3).

```bash
# 1. Depuis la machine locale : push vers origin
git push origin main  # ou git push origin feat/design-system-unify

# 2. SSH sur le VPS
ssh ubuntu@51.75.21.239

# 3. Sur le VPS : utiliser deploy.sh (existant, safe)
cd /path/to/pariscore
bash deploy.sh
# → git fetch origin
# → git reset --hard origin/main
# → pm2 restart pariscore --update-env

# 4. Vérifications post-déploiement (CRITIQUE)
pm2 status                                     # pariscore doit être "online"
pm2 logs pariscore --lines 50 --nostream       # pas d'erreur au démarrage
curl -sS http://localhost:3000/api/v1/status   # doit retourner 200 OK
curl -sS http://localhost:3000/ | head -50     # HTML bien servi

# 5. Smoke test visuel (depuis ta machine, navigateur)
# Ouvre https://pariscore.fr/ → vérifie visuellement 3 onglets
# (home, tennis, cs2) — pas de blanc, pas de CSS cassé
```

### 5.3 Monitoring post-déploiement

```bash
# Surveiller les 30 premières minutes
pm2 logs pariscore --lines 200 | grep -i "error\|warn"

# Vérifier Lighthouse (perf + a11y) sur l'onglet modifié
# (depuis ta machine, via Chrome DevTools ou le MCP playwright)

# Sentry (si configuré) : vérifier pas de spike d'erreurs les 2h suivant le déploiement
```

### 5.4 Rollback VPS (en cas de casse prod)

```bash
# Sur le VPS
cd /path/to/pariscore
git log --oneline -10                           # identifier le commit sain d'avant
git reset --hard <hash-avant-phase>
pm2 restart pariscore --update-env
pm2 logs pariscore --lines 50 --nostream        # vérifier le redémarrage propre

# Si /api/v1/status répond pas après 30s → le commit précédent est cassé
# → continuer à remonter l'historique jusqu'à trouver un commit sain
```

⚠️ **Sur le VPS, `deploy.sh` fait `git reset --hard origin/main`**. Ne jamais
commit directement sur le VPS — tout passe par `git push` depuis la machine locale.

### 5.5 CI GitHub Actions (5 workflows déjà en place)

À chaque `git push origin main` :
- `.github/workflows/ci.yml` — tests unitaires
- `.github/workflows/build.yml` — build Next.js
- `.github/workflows/lint.yml` — ESLint
- `.github/workflows/e2e.yml` — Playwright E2E
- `.github/workflows/load-test.yml` — tests de charge

**Ne pas déployer si la CI est rouge.** Vérifier le statut GitHub avant de lancer
`deploy.sh` sur le VPS.

---

## 6. Checklist de démarrage (J1 — 2026-07-14)

À cocher dans l'ordre avant la première ligne de code :

- [ ] Lu les 2 rapports Hallmark en entier
- [ ] Lu `todo.md` section "PRIORITÉ DEMAIN"
- [ ] Lu `.agents/skills/design-system-unify/SKILL.md` (workflow + garde-fous)
- [ ] Lu `.agents/skills/visual-regression/SKILL.md` (screenshots)
- [ ] Démarré le serveur dev : `bun run dev` (port 3000)
- [ ] Vérifié que Playwright MCP répond (test screenshot home)
- [ ] Créé la branche (si dédiée) : `git checkout -b feat/design-system-unify`
- [ ] Ou confirmé work sur `main` direct
- [ ] Premier screenshot baseline home : `tennis-p1.1-baseline-AVANT.png`
- [ ] Premier commit baseline : `git commit -m "chore(design): baseline avant Phase 1"`

**Puis seulement** : invoquer `design-system-unify` → "applique Phase 1.1".

---

## 7. Anti-patterns à refuser catégoriquement

| ❌ À ne pas faire | ✅ À faire à la place |
|---|---|
| Modifier plusieurs phases en même temps | Une phase à la fois, sérialisée |
| Skip le screenshot APRÈS | Capture APRÈS obligatoire pour chaque sous-tâche |
| Supprimer un bloc `:root` scopé d'un coup | 4 passes progressives (tn2 → ps → tl → suppression) |
| Déployer sur VPS après chaque sous-tâche | Déployer à la fin de chaque phase seulement |
| Déployer si CI rouge | Attendre que les 5 workflows passent |
| Push sans message Conventional Commits | Format `type(design): Phase X.Y — …` strict |
| Commit les screenshots baseline | `.gitignore` exclut `.hallmark-baseline/` |
| Toucher à `app/` (Next.js) pendant ce workflow | Ce workflow = monolithe legacy uniquement |
| Ignorer une petite différence visuelle | 25 petites diffs = catastrophe, signaler |
| `git push --force` sur main | Jamais. `git revert` si besoin d'annuler |

---

## 8. Indicateurs de succès (à mesurer fin de chantier)

| Indicateur | Cible | Comment mesurer |
|---|---|---|
| Critical Hallmark findings | 17 → **0** | `hallmark audit` complet 25 pages |
| Major Hallmark findings | 43 → **< 10** | idem |
| Minor Hallmark findings | 20 → **< 10** | idem |
| LCP home (mobile) | < 2s | Lighthouse / `playwright_evaluate` + Performance API |
| Fonts chargées | 9 → **3** | `grep "family=" pariscore.html` |
| `grep -c "gradient"` | 468 → **< 50** | Shell |
| `grep -c "box-shadow"` | 609 → **< 100** | Shell |
| `grep -c "backdrop-filter"` | 100 → **< 20** | Shell |
| `grep -c "transition: all"` | 29 → **0** | Shell |
| `grep -c "fade-up"` | 24 → **< 2** | Shell |
| Blocks `:root` tennis | 4 → **1** | Inspection L23139, L24226, L24551, L24955 |
| `design.md` à la racine | existe | `hallmark lock the system` |

---

## 9. Plan de communication

À chaque fin de phase, produire :
- [ ] Un message de stand-up dans le canal dev : "Phase X terminée — <résumé en 3 lignes>"
- [ ] Une mise à jour de `todo.md` (cocher les sous-tâches)
- [ ] Un tag git : `git tag phase-1-complete` (facultatif mais recommandé)

À la fin du chantier :
- [ ] `CHANGELOG.md` mis à jour avec entrée `## Design System Unification (2026-07-30)`
- [ ] `AUDIT_FINAL_2026-07-29.md` publié
- [ ] `design.md` créé (lock the system)

---

## 10. Risques et mitigations

| Risque | Probabilité | Impact | Mitigation |
|---|---|---|---|
| Réconciliation tennis casse visuellement | Moyenne | Haut | 4 passes progressives + screenshot à chaque passe |
| Performance dégradée temporairement | Faible | Moyen | Phase 3 (perf) après Phase 1+2 — le nettoyage compense |
| CI GitHub rouge sur un commit | Moyenne | Faible | `git revert` + corriger avant de push |
| VPS down pendant déploiement | Faible | Critique | Toujours tester `pm2 logs` + `curl /api/v1/status` après `deploy.sh` |
| Scope creep (ajouter des features en cours) | Haute | Moyen | Refuser toute feature hors plan. Noter dans `todo.md` pour plus tard |
| Fatigue / errances sur 17 jours | Haute | Moyen | Sprint court de 5j max par phase. Pause week-end obligatoire |

---

*Références :*
- `todo.md` — plan détaillé avec file:line
- `AUDIT_HALLMARK_PARISCORE_2026-07-13.md` — home audit
- `AUDIT_HALLMARK_PARISCORE_SPORTS_2026-07-13.md` — 25 pages audit
- `.agents/skills/design-system-unify/SKILL.md` — workflow garde-fous
- `.agents/skills/visual-regression/SKILL.md` — screenshots
- `deploy.sh` — script VPS existant
- `ecosystem.config.js` — PM2 config (6 process)
- `.github/workflows/` — 5 CI workflows

---

*Workflow préparé le 2026-07-13 pour exécution 2026-07-14 → 2026-07-30.*
