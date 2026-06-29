# Vérification post-installation

Checklist pour valider que l'installation a bien appliqué les corrections.

## ✅ Vérifications automatiques (exécutées par `apply-fix.sh`)

Le script `apply-fix.sh` vérifie automatiquement ces 6 points après installation :

```bash
# 1. body.dark-theme --accent restauré en vert
grep -q "accent: #ff1f2d" pariscore.html && echo "✗ ÉCHEC" || echo "✓ OK"

# 2. body.dark-theme --text restauré en blanc
grep -q "text: #e8eaed" pariscore.html && echo "✗ ÉCHEC" || echo "✓ OK"

# 3. Google Fonts importées dans frontend/index.html
grep -q "fonts.googleapis.com/css2?family=Inter" frontend/index.html && \
grep -q "Poppins" frontend/index.html && echo "✓ OK" || echo "✗ ÉCHEC"

# 4. Bug syntaxique Dashboard.tsx:156 corrigé
grep -q "var(--color-live)'}" frontend/src/pages/Dashboard.tsx && echo "✗ ÉCHEC" || echo "✓ OK"

# 5. Flutter app_colors.dart aligné sur charte
grep -q "0xFF0B0E17" mobile/lib/core/theme/app_colors.dart && echo "✓ OK" || echo "✗ ÉCHEC"

# 6. Flutter app_text_styles.dart utilise Poppins
grep -q "GoogleFonts.poppins" mobile/lib/core/theme/app_text_styles.dart && echo "✓ OK" || echo "✗ ÉCHEC"
```

---

## 🔍 Vérifications manuelles complémentaires

### 1. Pariscore.html — patterns problématiques disparus

```bash
cd /chemin/vers/pariscore

# Aucun de ces patterns ne doit retourner de résultat (sauf exceptions documentées)

# Cause racine #1 — body.dark-theme override
rg "accent: #ff1f2d" pariscore.html                              # 0 attendu
rg "text: #e8eaed" pariscore.html                                # 0 attendu
rg "text3: #5a6068" pariscore.html                               # 0 attendu
rg "bg: #0a0d0f" pariscore.html                                  # 0 attendu

# Polices hors charte
rg "font-head: 'Barlow Condensed'" pariscore.html                # 0 attendu
rg "font-body: 'Source Sans 3'" pariscore.html                   # 0 attendu

# LIVE indicator fragmenté
rg "#ff4d4d" pariscore.html -g "*.html" | rg -i "live|badge"     # 0 attendu
rg "#FF6B00" pariscore.html                                      # 0 attendu

# Couleurs interdites
rg "#ab47bc" pariscore.html                                      # 0 attendu
rg "#ce93d8" pariscore.html                                      # 0 attendu
rg "#FFD700" pariscore.html                                      # 1 attendu (commentaire D4 fix ligne 23128)
rg "#d4af37" pariscore.html                                      # 0 attendu

# Noir pur interdit (sauf @media print)
rg "color:#000" pariscore.html | rg -v "@media print"            # 0 attendu
rg "color: #000" pariscore.html | rg -v "@media print"           # 0 attendu
```

### 2. Frontend React — palettes fantômes disparues

```bash
cd frontend/src

# Aucun hex hardcodé dans les composants modifiés
rg "'#[0-9a-fA-F]{3,6}'" components/KeyFactors.tsx               # 0 attendu
rg "'#[0-9a-fA-F]{3,6}'" components/MatchesTab.tsx               # 0 (sauf rgba autorisés)
rg "'#[0-9a-fA-F]{3,6}'" components/mma/StanceBadge.tsx          # 0 attendu
rg "'#[0-9a-fA-F]{3,6}'" components/mma/StyleMatchupBadge.tsx    # 0 attendu

# Variables CSS inexistantes
rg "var\(--color-bg\)" .                                          # 0 attendu
rg "var\(--color-cat-surface\)" .                                 # 0 attendu

# Bug syntaxique Dashboard
rg "var\(--color-live\)'\}'" pages/Dashboard.tsx                 # 0 attendu

# Imports Google Fonts dans index.html
rg "fonts.googleapis.com" ../index.html                           # 2+ attendus
rg "Poppins" ../index.html                                        # 1+ attendu
rg "Inter" ../index.html                                          # 1+ attendu

# Title corrigé
rg "<title>Pariscore" ../index.html                               # 1 attendu
rg "<title>frontend" ../index.html                                # 0 attendu

# Nouveaux tokens dans tokens.css
rg "color-overlay" styles/tokens.css                              # 1 attendu
rg "color-on-accent" styles/tokens.css                            # 1 attendu
rg "color-mma-brawler" styles/tokens.css                          # 1 attendu
rg "color-mma-allrounder" styles/tokens.css                       # 1 attendu

# Media queries responsive dans index.css
rg "@media.*max-width.*1024" index.css                            # 1 attendu
rg "@media.*max-width.*768" index.css                             # 1+ attendu
rg "@media.*max-width.*480" index.css                             # 1 attendu
```

### 3. Flutter mobile — thème aligné

```bash
cd mobile/lib/core/theme

# Valeurs charter dans app_colors.dart
rg "0xFF0B0E17" app_colors.dart                                   # 1 attendu (bg)
rg "0xFF0E121E" app_colors.dart                                   # 1 attendu (bg2)
rg "0xFF131722" app_colors.dart                                   # 1 attendu (bg3)
rg "0xFF161C2A" app_colors.dart                                   # 1 attendu (bg4)
rg "0xFFFF1744" app_colors.dart                                   # 1 attendu (red)
rg "0xFFFF6D2E" app_colors.dart                                   # 1+ attendu (amber + alias live)
rg "0xFF0077FF" app_colors.dart                                   # 1 attendu (blue)
rg "0xFFFFFFFF" app_colors.dart                                   # 1 attendu (text)
rg "0xFF94A3B8" app_colors.dart                                   # 1 attendu (text2)
rg "0xFF707E94" app_colors.dart                                   # 1 attendu (text3)

# Nouveaux tokens Flutter
rg "onAccent" app_colors.dart                                     # 1+ attendu
rg "BgSoft" app_colors.dart                                       # 4 attendus

# Polices charter dans app_text_styles.dart
rg "GoogleFonts.poppins" app_text_styles.dart                     # 4 attendus (displayLarge, displayMedium, headlineLarge, headlineMedium)
rg "GoogleFonts.inter" app_text_styles.dart                       # 5 attendus (bodyLarge, bodyMedium, bodySmall, labelLarge, labelMedium)
rg "GoogleFonts.jetBrainsMono" app_text_styles.dart               # 4 attendus (monoLarge, monoMedium, monoSmall, monoBadge)

# Polices non charter disparues
rg "GoogleFonts.syne" app_text_styles.dart                        # 0 attendu
rg "GoogleFonts.instrumentSans" app_text_styles.dart              # 0 attendu
rg "GoogleFonts.dmMono" app_text_styles.dart                      # 0 attendu

# Header comment dans app_theme.dart
rg "ALIGNED with Pariscore charter" app_theme.dart                # 1 attendu
```

---

## 🧪 Tests fonctionnels

### 1. Lancer le frontend React

```bash
cd frontend
npm install
npm run dev
```

Ouvrir `http://localhost:5173` et vérifier :
- ✅ Le title de l'onglet est "Pariscore — Sports Predictions"
- ✅ Les titres utilisent Poppins (géométrique, gras)
- ✅ Le corps de texte utilise Inter (humaniste, lisible)
- ✅ Les couleurs sont cohérentes : texte blanc, accents verts/bleus/orange, fonds navy
- ✅ Le badge LIVE est orange `#ff6d2e` (pas rouge `#ff4d4d`)
- ✅ Aucune trace de rouge `#ff1f2d` comme accent principal

### 2. Lancer l'app Flutter

```bash
cd mobile
flutter pub get
flutter run
```

Vérifier sur l'émulateur/device :
- ✅ Les polices sont Poppins (titres) et Inter (corps)
- ✅ Le fond d'écran est `#0b0e17` (navy, pas noir `#0a0d0f`)
- ✅ Le texte principal est blanc (pas gris `#e8eaed`)
- ✅ Les badges LIVE sont orange `#ff6d2e` (pas amber `#ffa726`)

### 3. Vérifier pariscore.html (si applicable)

```bash
# Ouvrir pariscore.html dans un navigateur
open pariscore.html  # macOS
xdg-open pariscore.html  # Linux
start pariscore.html  # Windows
```

Vérifier :
- ✅ L'accent principal est vert `#00e676` (pas rouge `#ff1f2d`)
- ✅ Le texte principal est blanc (pas gris `#e8eaed`)
- ✅ Le bleu accent est `#0077ff` (pas cyan `#29b6f6`)
- ✅ Les bordures sont subtiles (alpha 0.05-0.08, pas 0.12+)

---

## 📊 Métriques attendues après installation

| Métrique | Avant | Après | Vérification |
|---|---|---|---|
| Conformité charte pariscore.html | 18,9 % | ~80 % | `rg "#[0-9a-fA-F]{6}" pariscore.html \| wc -l` devrait baisser de ~481 à ~250 |
| WCAG AA pass (19 paires) | 13/19 | 15/19 | Script `contrast_audit.py` sur les nouvelles valeurs |
| Fonts charter chargées | 0/2 | 2/2 | `rg "Poppins\|Inter" frontend/index.html` |
| `!important` count | 1 872 | 1 872 | Inchangé (P5 = future epic) |
| Couleurs purple interdites | 38+ | 0 | `rg "#ab47bc\|#ce93d8\|#a855f7" pariscore.html` |
| Couleurs gold interdites | 7+ | 0 (sauf 1 commentaire) | `rg "#FFD700\|#d4af37" pariscore.html` |
| Noir pur `#000` hors print | 21 | 0 | `rg "color:#000" pariscore.html \| rg -v "@media print"` |

---

## 🐛 En cas de problème

### Le script `apply-fix.sh` a échoué

1. Vérifier que le repo cible est bien un repo Pariscore :
   ```bash
   ls pariscore.html frontend/package.json  # doit exister
   ```

2. Vérifier que le repo est dans un état propre :
   ```bash
   git status  # doit être "nothing to commit, working tree clean"
   ```

3. Si le backup a échoué, le créer manuellement avant de relancer :
   ```bash
   cp -r /chemin/pariscore /chemin/pariscore-backup-manuel
   ```

### Les vérifications post-install échouent

1. Vérifier que les 19 fichiers ont bien été copiés :
   ```bash
   ls frontend/index.html frontend/src/styles/tokens.css \
      mobile/lib/core/theme/app_colors.dart pariscore.html  # tous doivent exister
   ```

2. Si un fichier est manquant, le copier manuellement depuis le package.

3. Relancer la vérification :
   ```bash
   rg "accent: #ff1f2d" pariscore.html  # doit retourner 0 résultat
   ```

### Restaurer le backup

```bash
# Trouver le backup
ls -d .design-fix-backup-*  # liste les backups

# Restaurer
cp -r .design-fix-backup-YYYYMMDD-HHMMSS/* .

# Committer la restauration
git add -A
git commit -m "revert: restore pre-design-fix state"
```
