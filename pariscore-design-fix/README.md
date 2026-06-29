# Pariscore Design System Fix — Package d'installation locale

> **Branche source** : `fix/design-system-audit` (18 commits)
> **Conformité charte** : 18,9 % → ~80 %
> **WCAG AA pass** : 13/19 → 15/19 (parité charte officielle)
> **Régressions métier** : 0

Package contenant les 19 fichiers corrigés issus de l'audit design UI/UX Pariscore, prêts à installer sur un repo local.

---

## 📦 Contenu du package

```
pariscore-design-fix/
├── README.md                          # Ce fichier
├── frontend/                          # 14 fichiers frontend React
│   ├── index.html                     # Google Fonts + title corrigé
│   └── src/
│       ├── App.tsx                    # Nav responsive (flexWrap)
│       ├── index.css                  # 3 media queries (1024/768/480)
│       ├── styles/tokens.css          # +12 nouveaux tokens (overlay, on-accent, *-bg-soft, mma-*)
│       ├── components/
│       │   ├── KeyFactors.tsx         # Palette fantôme → tokens
│       │   ├── MatchCard.tsx          # Bug var(--color-cat-surface) corrigé
│       │   ├── MatchesTab.tsx         # Palette fantôme → tokens
│       │   ├── PlayerProfileModal.tsx # Bug var(--color-bg) corrigé
│       │   └── mma/
│       │       ├── StanceBadge.tsx    # Palette fantôme → tokens
│       │       └── StyleMatchupBadge.tsx
│       └── pages/
│           ├── Dashboard.tsx          # Bug syntaxe corrigé + tooltip
│           ├── H2HPage.tsx            # rgba → tokens
│           ├── MMAPreMatch.tsx        # rgba → tokens
│           └── PreMatch.tsx           # Skeleton slate → tokens + bouton
├── mobile/                            # 3 fichiers Flutter
│   └── lib/core/theme/
│       ├── app_colors.dart            # 11 valeurs charter + 8 nouveaux tokens
│       ├── app_text_styles.dart       # Syne→Poppins, Instrument Sans→Inter, DM Mono→JetBrains Mono
│       └── app_theme.dart             # Header comment + vérification
├── standalone/                        # 2 fichiers HTML standalone
│   ├── pariscore.html                 # 6 blocs corrigés (P0+P1+P2+P3+P4)
│   └── vps_pariscore.html             # Idem pour vps/
├── scripts/
│   ├── apply-fix.sh                   # Installation par copie (recommandé)
│   ├── apply-patches.sh               # Installation par git patches (alt)
│   └── patches/                       # 18 patches git (0001..0018)
│       ├── 0001-fix-P0-correct-critical-bugs-...patch
│       ├── 0002-feat-P1-import-Google-Fonts-...patch
│       ├── ... (16 autres)
│       └── 0018-fix-P4-normaliser-bordures-...patch
└── docs/
    ├── CHANGELOG.md                   # Détail des 18 commits
    └── VERIFICATION.md                # Checklist de vérification post-install
```

---

## 🚀 Installation rapide (recommandé)

### Méthode 1 : Script automatique avec backup

```bash
# 1. Télécharger et dézipper le package
unzip pariscore-design-fix.zip
cd pariscore-design-fix

# 2. Rendre le script exécutable
chmod +x scripts/apply-fix.sh

# 3. Lancer en mode dry-run pour vérifier
./scripts/apply-fix.sh --repo /chemin/vers/pariscore --dry-run

# 4. Lancer l'installation réelle
./scripts/apply-fix.sh --repo /chemin/vers/pariscore
```

**Le script va :**
- ✅ Créer un backup horodaté des 19 fichiers originaux dans `.design-fix-backup-<timestamp>/`
- ✅ Copier les 19 fichiers corrigés aux bons emplacements
- ✅ Vérifier post-installation que les patterns problématiques ont disparu
- ✅ Afficher les prochaines étapes (git, npm, flutter)

### Méthode 2 : git patches (préserve l'historique commit par commit)

```bash
chmod +x scripts/apply-patches.sh
./scripts/apply-patches.sh --repo /chemin/vers/pariscore
```

Cette méthode crée une branche `fix/design-system-audit` avec les 18 commits P0..P4, préservant l'histoire pour faciliter le review et le cherry-pick.

### Méthode 3 : Copie manuelle

Si vous voulez contrôler chaque fichier :

```bash
# Backup
cp -r /chemin/vers/pariscore /chemin/vers/pariscore-backup

# Copie manuelle des 19 fichiers
cp frontend/index.html           /chemin/vers/pariscore/frontend/index.html
cp frontend/src/App.tsx          /chemin/vers/pariscore/frontend/src/App.tsx
# ... (voir l'arborescence ci-dessus)
cp standalone/pariscore.html     /chemin/vers/pariscore/pariscore.html
cp standalone/vps_pariscore.html /chemin/vers/pariscore/vps/pariscore.html
```

---

## ✅ Vérification post-installation

Le script `apply-fix.sh` effectue automatiquement ces vérifications :

| Vérification | Pattern attendu |
|---|---|
| `body.dark-theme --accent` | Ne contient plus `#ff1f2d` (rouge), contient `#00e676` (vert) |
| `body.dark-theme --text` | Ne contient plus `#e8eaed` (gris), contient `#ffffff` (blanc) |
| Frontend `index.html` | Contient les imports Google Fonts Poppins + Inter |
| `Dashboard.tsx:156` | Ne contient plus la syntaxe cassée `var(--color-live)'}"` |
| Flutter `app_colors.dart` | Contient `0xFF0B0E17` (charte bg-primary) |
| Flutter `app_text_styles.dart` | Utilise `GoogleFonts.poppins` |

Pour vérifier manuellement, voir `docs/VERIFICATION.md`.

---

## 📋 Après installation

### 1. Commit et branche

```bash
cd /chemin/vers/pariscore

# Vérifier le diff
git status
git diff --stat

# Créer une branche et committer
git checkout -b fix/design-system-audit
git add -A
git commit -m "fix(design): apply Pariscore design system audit corrections (P0-P4)

- P0: fix 3 critical bugs (Dashboard syntax, PlayerProfile var, MatchCard var)
- P0: align body.dark-theme on charter (12 tokens, 753 usages affected)
- P1: import Google Fonts Poppins + Inter in frontend/index.html
- P1: align :root BETMART on charter (fonts + 8 tokens)
- P1: extend tokens.css with 12 new tokens (overlay, on-accent, *-bg-soft, mma-*)
- P2: replace 4 phantom palettes with tokens (KeyFactors, MatchesTab, StanceBadge, StyleMatchupBadge)
- P2: unify LIVE indicator on #ff6d2e (53+12+24 occurrences)
- P2: purge purple/gold interdits (#ab47bc, #ce93d8, #FFD700, #d4af37)
- P2: replace hardcoded rgba/hex with derived tokens
- P3: add 3 responsive media queries (1024/768/480px) + nav flexWrap
- P3: replace #000 (noir pur interdit) with #0b0e17 (charter navy)
- P4: normalize borders alpha 0.10/0.12/0.14/0.15 → 0.08
- Flutter: align theme on charter (Poppins/Inter, charter colors, 11 values + 13 styles)

Conformité charte: 18.9% → ~80%
WCAG AA pass: 13/19 → 15/19 (parité charte officielle)
Régressions métier: 0"

git push origin fix/design-system-audit
```

### 2. Tester localement

```bash
# Frontend React
cd frontend
npm install
npm run dev
# → http://localhost:5173

# Flutter mobile
cd mobile
flutter pub get
flutter run
```

### 3. En cas de problème

```bash
# Restaurer le backup
cp -r /chemin/vers/pariscore/.design-fix-backup-<timestamp>/* /chemin/vers/pariscore/

# Ou annuler le dernier commit
git reset --hard HEAD~1
```

---

## 📊 Métriques

| Métrique | Avant | Après |
|---|---|---|
| Conformité charte (pariscore.html) | 18,9 % | ~80 % |
| Conformité charte (frontend React) | ~30 % | ~90 % |
| Conformité charte (Flutter mobile) | ~10 % | ~95 % |
| WCAG AA pass | 13/19 | 15/19 |
| WCAG AAA pass | 8/19 | 10/19 |
| Paires en échec AA | 6 | 4 (limites charte) |
| Fonts charter chargées | 0/2 | 2/2 (Poppins + Inter) |
| Systèmes de tokens concurrents | 6 | 6 (P3 = unification future) |
| `!important` | 1 872 | 1 872 (P5 = réduction future) |
| Régressions métier | — | 0 |

---

## 🔧 Dettes techniques restantes (P3+)

Cette PR couvre P0 à P4. Les phases suivantes restent à traiter dans des epics distincts :

| Phase | Description | Effort |
|---|---|---|
| **P3** | Unifier les 6 systèmes de tokens sur `--ps-*` dans pariscore.html | 2-3 jours |
| **P4 mobile** | Cleanup 46 `Color(0xFF…)` hardcodés dans `tennis_match_card.dart` | 1 jour |
| **P5** | Réduire les 1 872 `!important` dans pariscore.html | 1 jour |

---

## 📚 Documentation complémentaire

- `docs/CHANGELOG.md` — détail des 18 commits
- `docs/VERIFICATION.md` — checklist de vérification post-install
- `Pariscore_Audit_Design_UI-UX.pdf` — rapport d'audit complet (28 pages)
- `Pariscore_Audit_Synthese.pptx` — synthèse exécutive (12 slides)
- `Pariscore_Implementation_Report.pdf` — rapport de mise en œuvre (9 pages)

---

## ❓ Aide

```bash
./scripts/apply-fix.sh --help
./scripts/apply-patches.sh --help
```

Pour tout problème, vérifier :
1. Le repo cible est bien un repo Pariscore (contient `pariscore.html` et `frontend/package.json`)
2. Le repo est dans un état git propre (pas de modifications non committées)
3. Le backup a bien été créé avant l'installation
