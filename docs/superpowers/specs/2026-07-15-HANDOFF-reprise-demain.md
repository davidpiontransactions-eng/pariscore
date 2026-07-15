# 🔄 HANDOFF — Reprise session Tennis Prematch 6 métriques

> **Date** : 2026-07-15 (fin de session)
> **À reprendre** : demain — design UI de la statline 6 métriques
> **Branche** : `main` | **HEAD** : `f4f9a7f` | **VPS synchronisé** : ✅

---

## 📌 OÙ ON EN EST — en une phrase

Les **6 métriques fonctionnent en prod** (data + backend + affichage basique), mais la **mise en forme UI est cassée** (3 bugs identifiés) et un **nouveau design reste à choisir et implémenter**.

---

## ✅ CE QUI EST TERMINÉ (ne pas retoucher)

### Backend + Data (opérationnel en prod)
- **Cron SPS** `pariscore-cron-sps` (pm2 id 7) — tourne 2×/jour, 11032 SPS en base
- **6 métriques remontent** dans `/api/v1/tennis/value-bets` pour Zandschulp :
  `rank=55, elo_surface=1758, surf_rank=223/1346, powerscore=49, ps_rank=45`
- **Rank ATP** : fallback `winner_rank` du dernier match (commit `1c96acf`)
- **Elo Surface** : fallback Elo ALL quand surface inconnue (commit `ba5bf06`)

### Commits de la session (8, tous poussés sur origin/main)
```
f4f9a7f docs(notes): statut final mission tennis 6 métriques
e47808e feat(pm2): cron SPS pariscore-cron-sps — 2×/jour
1c96acf fix(tennis): _stmtRecentRank — UNION ALL sans ORDER BY interne
21442aa feat(tennis): 6 métriques complètes — SPS cron + rank fallback + statline UI
971b85f docs(gantt): planning 6 métriques tennis prematch
6846e6f docs(spec): enrichissement 6 métriques tennis prematch — design multi-expertise
ba5bf06 fix(tennis-legacy): résolution surface + fallback Elo — corrige Elo —
841dddd feat(tennis): enrichissement PlayerStatline — Elo Surface + SPS + classements
```

---

## 🔴 CE QUI RESTE À FAIRE (la tâche de demain)

### Tâche unique : Refonte UI de la statline 6 métriques

**L'utilisateur a demandé** : "mise en forme des données à améliorer + nouveau design UI".
**Le design n'est PAS encore choisi** — j'ai proposé 3 options, l'utilisateur veut reprendre demain pour décider.

#### Les 3 bugs UI à corriger (audit Playwright du 15/07)

| # | Bug | Computed style actuelle | Correction requise |
|---|-----|------------------------|--------------------|
| **B1** | `.sc-premier-surfrank` énorme et blanc | `15px, rgb(255,255,255), display:block` | Pas de CSS dédiée → hérite du body. **Ajouter règle** : `9px, var(--text3), pill compacte` |
| **B2** | `.sc-premier-prank` trop sombre | `color: rgb(71,85,105)` = `#475569` | Doit être `var(--text2)` = `#94a3b8` (charte) |
| **B3** | `.sc-premier-pelo` supprimée | classe n'existe plus dans le template | La fusion dans `.sc-premier-prank` a perdu le style `--text3` pour l'Elo |

#### Les 3 options de design proposées (à valider demain)

1. **Statline mono + pill surface** (recommandée) — 1 ligne `#10 · Elo 1735 · SPS 47 [#269]`, pill jaune tennis 9px
2. **Statline 2 lignes** — ligne 1 général (rank+Elo), ligne 2 surface (SPS+classement)
3. **Micro-badges colorés** — chaque métrique = pill sémantique (vert=Rank, bleu=Elo, jaune=SPS)

---

## 🎨 CHARTER GRAPHIQUE À RESPECTER (extrait)

Source : `DESIGN_CHARTER.md` + `pariscore.html` `:root` (L282-335)

### Palette (Dark Navy)
| Token | Hex | Usage |
|-------|-----|-------|
| `--bg2` | `#0e121e` | Card background |
| `--text2` | `#94a3b8` | Stats secondaires (rank, Elo, SPS) |
| `--text3` | `#707e94` | Muted (surface rank) |
| `--accent` | `#00e676` | Neon green (CTA) |
| `#page-tennis --sport-accent` | `#ccff00` | **Tennis-ball yellow** (à utiliser pour SPS/badge surface) |
| `--font-mono` | `DM Mono` | Toutes les valeurs numériques |

### Règles anti-slop (DESIGN_CHARTER §10)
- ❌ Pas de `transition: all` (transitions explicites `.15s` seulement)
- ❌ Pas de `blur()` raw (utiliser `--cf-glass-*`)
- ❌ Pas de `rgba()` raw pour backgrounds (utiliser tokens)
- ❌ Pas de `font-family` hardcoded (toujours `var(--font-*)`)
- ✅ Validation : `node scripts/validate-css-conventions.js`

### CSS concerné (pariscore.html)
- **Tokens globaux** : L282-335 (`:root`)
- **Tennis override** : L360 (`#page-tennis { --sport-accent: #ccff00; }`)
- **Classes premierCard** : L25299-25341 + mobile L25388
- **Template premierCard** : L26045-26133 (statline = L26100-26101 p1, L26107-26108 p2)

---

## 🛠️ COMMENT REPENDRE DEMAIN (étapes exactes)

### Étape 1 — Décider le design
Relire les 3 options ci-dessus. Demander à l'utilisateur laquelle il veut (ou affiner).
Le fichier `docs/superpowers/specs/2026-07-15-HANDOFF-reprise-demain.md` (celui-ci) contient tout le contexte.

### Étape 2 — Implémenter (pariscore.html)
Le fichier est en **CP1252** — il faut l'éditer via Node + iconv-lite :
```js
const fs = require('fs');
let iconv; try { iconv = require('iconv-lite'); } catch(e){}
let t = iconv ? iconv.decode(fs.readFileSync('pariscore.html'),'win1252')
              : fs.readFileSync('pariscore.html','latin1');
// ... edits ...
fs.writeFileSync('pariscore.html', iconv ? iconv.encode(t,'win1252') : Buffer.from(t,'latin1'));
```
**Points d'édition précis** :
- CSS : ajouter après L25317 (`.sc-premier-pelo{...}`) les nouvelles règles `.sc-premier-surfrank`, `.sc-premier-sps`
- Template p1 : L26100-26101 (statline + surfrank)
- Template p2 : L26107-26108

### Étape 3 — Tester localement avant deploy
```bash
# Lancer le dev (le legacy n'a pas de build, il est servi par server.js)
# Tester sur pariscore.fr directement après deploy
```

### Étape 4 — Déployer
```bash
git add pariscore.html && git commit -m "fix(ui): statline 6 métriques — respect charte + 3 bugs corrigés"
git push origin main
ssh ubuntu@51.75.21.239 'cd /home/ubuntu/pariscore && git pull origin main && pm2 restart pariscore'
# Valider via Playwright (voir qa_card.mjs pattern dans l'historique)
```

### Étape 5 — Valider visuellement
Playwright sur pariscore.fr onglet Tennis → vérifier :
- `.sc-premier-surfrank` à 9px (pas 15px)
- `.sc-premier-prank` en `#94a3b8` (pas `#475569`)
- `var(--font-mono)` appliqué aux valeurs
- `node scripts/validate-css-conventions.js` passe

---

## 📂 FICHIERS DE RÉFÉRENCE

| Fichier | Rôle |
|---------|------|
| `DESIGN_CHARTER.md` | Charte graphique complète (tokens, règles) |
| `docs/superpowers/specs/2026-07-15-tennis-prematch-6-metrics-design.md` | Spec design 3 couches |
| `docs/superpowers/specs/2026-07-15-tennis-6-metrics-gantt.json` | Gantt chart (JSON) |
| `docs/superpowers/specs/2026-07-15-HANDOFF-reprise-demain.md` | **Ce fichier** |
| `.notes/missions/2026-07-14-tennis-prematch-elo-sps.md` | Note de mission Obsidian |
| `pariscore.html` L26045-26133 | Composant `premierCard` (le code à modifier) |
| `pariscore.html` L25299-25341 | CSS `.sc-premier-*` |

---

## ⚠️ PIÈGES À ÉVITER DEMAIN

1. **Ne pas éditer pariscore.html avec l'éditeur standard** — c'est du CP1252, l'éditeur le voit comme binaire. Utiliser Node + iconv-lite.
2. **Le caractère em-dash** dans le template est `U+0097` (pas `U+2014`) — attention aux anchors de remplacement.
3. **Ne pas inventer de nouveaux tokens** — Phase 1.1 de DS-Unify a consolidé les `:root`. Réutiliser les existants.
4. **`server.js` n'a pas de build** — juste pull + `pm2 restart pariscore` pour déployer.
5. **Le cache value-bets met ~40s** à se reconstruire après restart — attendre avant de tester.

---

## 🗓️ GANTT CHART (JSON à rendre)

Voir `docs/superpowers/specs/2026-07-15-ui-refonte-gantt.json` (créé à côté).
Le rendu SVG nécessite `python3 scripts/render_gantt.py` (package `gantt_chart_skill` manquant — à installer ou rendre manuellement).
