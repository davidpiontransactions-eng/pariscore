# Handoff ZCode — Design System Unification (2026-07-14 Session 2)

> **Branche**: `feat/design-system-unify` (12 commits, root = `bbc253a`)
> **Session**: 2026-07-14 Session 2 — OpenCode
> **Priorité**: Finir Phase 1.2 (CS2/MMA) → validation visuelle → Phase 2

---

## ✅ Session 2 — Terminé

### Problème : GitHub Secret Scanning bloquait le push

Un token `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` dans `.context/SESSION_RESUME_PHASE5_TENNIS.md` au commit `41dff86` était détecté par GitHub.

### Solution appliquée

| Étape | Commande | Statut |
|-------|----------|--------|
| 1. Amender `41dff86` (token → `[REVOKED]`) | `git commit --amend` | ✅ `bbc253a` |
| 2. Rebase 12 commits sur `bbc253a` | `git rebase --onto bbc253a 41dff86` | ✅ Historique propre |
| 3. Push force | `git push --force-with-lease` | ✅ GitHub accepté |
| 4. Déploiement VPS | `git fetch ... && git reset --hard` | ✅ pm2 restart OK |

### VPS

- **Hôte** : ubuntu@51.75.21.239
- **Chemin** : `~/pariscore` (pas `/var/www/pariscore`)
- **Branche** : `feat/design-system-unify` (tracking `origin/feat/design-system-unify`)
- **Statut** : HTTP 200, branché sur la branche design

---

## Résumé exécutif du projet

### ✅ Phase 1.1 — TERMINÉE (3 passes, 0 régression visuelle)

| Passe | Tokens aliasés | Commit | Statut |
|-------|---------------|--------|--------|
| Passe 1 (tn2) | 18/31 → globaux BETMART | `065975c` | ✅ Validé |
| Passe 2 (ps) | 18/25 → globaux BETMART | `a11eff9` | ✅ Validé |
| Passe 3 (tl) | 19/22 → globaux BETMART | `b65a6bc` | ✅ Validé |
| **Validation finale** | match:true, mismatch:0.0% | `e67b4f9` | ✅ Zéro régression |

### 🟡 Phase 1.2 — EN COURS (CS2/MMA restent)

| Sport | Tokens ajoutés | Remplacements | Statut |
|-------|---------------|---------------|--------|
| Tennis | `--sport-accent: #ccff00` | `#ff6d2e` → `var(--sport-accent)` (color change orange→jaune) | ✅ Fait |
| F1 | `--sport-accent: #ff0043` | `#ff0043` → `var(--sport-accent)` (safe alias) | ✅ Fait |
| NBA/WNBA | `--sport-accent: #ff6b00` | 6x `#ff6b00` → `var(--sport-accent)` (safe alias) | ✅ Fait |
| CS2 | `--sport-accent: #00d4ff` | `#E3001B` → `var(--sport-accent)` (color change rouge→cyan) | ⏳ Reste |
| MMA | `--sport-accent: #E3001B` | `#E3001B` → `var(--sport-accent)` | ⏳ Reste |
| Cycling | `--sport-accent: #f4d03f` | Déjà propre, peu d'hex inline | ⏳ Reste |

---

## Travail restant immédiat

### 1. Phase 1.2 — Remplacer `#E3001B` inline dans CS2 et MMA

**Fichier**: `pariscore.html`
- **CS2 bloc**: l22215-22727 — remplacer `#E3001B` → `var(--sport-accent)`
- **MMA bloc**: l22920-23130 — remplacer `#E3001B` → `var(--sport-accent)`

**Commande suggérée**:
```bash
python scripts/ray-design-unify.py replace --sport cs2 --interactive
python scripts/ray-design-unify.py replace --sport mma --interactive
```

### 2. Validation visuelle Phase 1.2

```bash
# 1. Screenshot APRÈS chaque sport modifié
agent-browser screenshot
# 2. Diff contre baseline
agent-browser diff_screenshot
# 3. Si mismatch = 0 → commit
```

### 3. Décision visuelle CS2

Le changement `#E3001B` (rouge) → `#00d4ff` (cyan) est un changement de couleur visible. Vérifier visuellement que le cyan neon gamer rend bien sur le thème dark.

### 4. Vérifier les 14 hex restants

Le script `ray-design-unify.py analyze` détecte 14 valeurs hex sans correspondance avec des tokens. Ce sont des déclarations intentionnelles (définitions de tokens, gradients, etc.), pas des remplacements oubliés.

---

## Arborescence fichiers critiques

```
pariscore/
├── pariscore.html              # Cible du redesign (27 619 lignes)
│   ├── l282-332   → :root global BETMART (tokens --sport-* l326-330)
│   ├── l358-364   → #page-* selecteurs accent par sport
│   ├── l22140-22220 → NBA/WNBA (Phase 1.2 traitée)
│   ├── l22215-22727 → CS2 (reste à traiter)
│   ├── l22748-22806 → F1 (Phase 1.2 traitée)
│   ├── l22920-23130 → MMA (reste à traiter)
│   ├── l23134-23169 → tn2 tokens aliasés (Phase 1.1)
│   ├── l24225-24252 → ps tokens aliasés (Phase 1.1)
│   └── l24550-24573 → tl tokens aliasés (Phase 1.1)
├── scripts/
│   └── ray-design-unify.py     # Automation Ray (338 lignes)
├── todo.md                     # Plan + suivi
├── GANTT.md                    # Section 0 = Design System Unification
└── .context/
    └── memory.jsonl            # Knowledge Graph inter-session
```

---

## Architecture tokens design system

```css
/* :root global — tokens BETMART */
:root {
  --sport-accent: var(--accent);    /* #ccff00 par défaut */
  --sport-secondary: var(--bg4);    /* #D4AF37 pour MMA */
  --sport-bg: var(--bg);            /* #0f121b */
  --sport-card: var(--bg2);         /* #1a1e2b */
}

/* Override par onglet */
#page-tennis  { --sport-accent: #ccff00; }   /* jaune bale */
#page-cycling { --sport-accent: #f4d03f; }   /* jaune maillot TdF */
#page-mma     { --sport-accent: #E3001B; --sport-secondary: #D4AF37; }
#page-f1      { --sport-accent: #ff0043; }
#page-cs2     { --sport-accent: #00d4ff; }   /* cyan neon gamer */
#page-nba, #page-wnba { --sport-accent: #ff6b00; }
```

---

## Prochaines phases après Phase 1.2

| Phase | Description | Estimation |
|-------|-------------|------------|
| **1.3** | Unifier système de cards (sc-card → standard) | 1 jour |
| **1.4** | Standardiser keyframes (live-pulse, skeleton-shimmer) | 0.5 jour |
| **1.5** | Réconcilier comparateur (`.comp-light`/toggle thème) | 0.5 jour |
| **2.x** | Nettoyage Hallmark par onglet (CS2, MMA, emojis, etc.) | 7 jours |
| **3.x** | Nettoyage home + globaux (fonts, glassmorphism, gradients) | 3 jours |

Voir `GANTT.md` section 0 pour le Gantt Mermaid à jour.

---

## Notes techniques

- **Dev server**: `cmd /c npx next dev -p 3000` (car `bun run dev` cassé sur Windows)
- **Playwright**: Chrome 150 dans `C:\Users\David\.agent-browser\browsers\chrome-150.0.7871.115`
- **bd** trouvé dans PATH : `C:\Users\David\AppData\Roaming\npm\bd.ps1`
- **Dossier `.hallmark-baseline/`** gitignoré, commit forcé avec `-f`
- **MCP memory**: connaissances persistantes dans `.context/memory.jsonl`
