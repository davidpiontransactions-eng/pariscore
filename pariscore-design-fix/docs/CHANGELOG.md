# Changelog — Pariscore Design System Fix

Branche : `fix/design-system-audit` (18 commits)

## Résumé par phase

### Phase P0 — Bugs critiques (3 fixes)
- **fix(P0): correct critical bugs** — `Dashboard.tsx:156` syntaxe cassée `var(--color-live)'}"` + 2 variables CSS inexistantes (`var(--color-bg)` dans `PlayerProfileModal.tsx:251`, `var(--color-cat-surface)` dans `MatchCard.tsx:60`)

### Phase P0 — Pariscore.html dark-theme override
- **fix(P0): aligner body.dark-theme sur la charte Pariscore** (12 tokens) — restaure le vert accent `#00e676` (au lieu de `#ff1f2d`), le blanc texte `#ffffff` (au lieu de `#e8eaed`), et 10 autres tokens charter. **753 usages affectés**.

### Phase P1 — Polices charter
- **feat(P1): import Google Fonts** — ajoute `<link>` Google Fonts pour Poppins (600/700/800) et Inter (400/500/600/700) dans `frontend/index.html`. Change `<title>frontend</title>` → `<title>Pariscore — Sports Predictions</title>`.
- **fix(P1): aligner :root BETMART** — remplace `Barlow Condensed` → `Poppins`, `Source Sans 3` → `Inter`, `#64748b` → `#707e94` (text3 charter), et 5 autres valeurs bg/text charter.

### Phase P1 — Tokens étendus
- **feat(P1): add 12 design tokens** dans `tokens.css` :
  - `--color-overlay`, `--color-divider`, `--color-on-accent`
  - `--color-danger-bg-soft`, `--color-accent-green-bg-soft`, `--color-accent-blue-bg-soft`, `--color-live-bg-soft`
  - `--color-mma-brawler`, `--color-mma-allrounder`

### Phase P1 — Flutter mobile
- **fix(mobile): align theme on Pariscore charter** — `app_colors.dart` (11 valeurs + 8 nouveaux tokens), `app_text_styles.dart` (Syne→Poppins, Instrument Sans→Inter, DM Mono→JetBrains Mono), `app_theme.dart` (header comment).

### Phase P2 — Palettes fantômes → tokens
- **fix(P2): replace 4 phantom palettes** :
  - `KeyFactors.tsx` : `CATEGORY_COLORS` (6 hex → 6 tokens)
  - `MatchesTab.tsx` : `SURFACE_COLORS` (4 hex → 4 tokens)
  - `StanceBadge.tsx` : `STANCE_COLORS` (4 hex → 4 tokens)
  - `StyleMatchupBadge.tsx` : 2 hex → 2 tokens
- **fix(P2b): MatchesTab active tab** — `'#000'` → `var(--color-on-accent)`

### Phase P2 — rgba hardcodés → tokens dérivés
- **fix(P2b): replace hardcoded rgba/hex** — 10 occurrences dans Dashboard (tooltip bg + bouton text), PreMatch (skeleton slate + bouton), MMAPreMatch (rgba), H2HPage (rgba), PlayerProfileModal (overlay).

### Phase P2 — Pariscore.html LIVE + purple + gold
- **fix(P2a): unifier LIVE sur `#ff6d2e`** — 53 × `#ff4d4d` (danger context) + 12 LIVE contexts + 24 × `#FF6B00` (CS2) + `--tn2-live` (tennis redesign).
- **fix(P2b+P2c): purger purple et gold** — 18 × `#ab47bc` + 20 × `#ce93d8` → `#38bdf8` (charter blue) ; `--tn2-gold`, `--tex-gold`, `#d4af37` → `#ff6d2e` (charter live).

### Phase P3 — Responsive
- **feat(P3): add responsive media queries** — 3 breakpoints (1024px, 768px, 480px) dans `index.css` + 6 classNames grid (`prematch-grid`, `mma-prematch-grid`, `dashboard-kpi-grid`, `dashboard-secondary-grid`, `h2h-grid`, `app-nav`) + `flexWrap: 'wrap'` sur la nav `App.tsx`.

### Phase P3 — Pariscore.html #000 → #0b0e17
- **fix(P3): remplacer noir pur `#000`** — 21 occurrences (sauf `@media print` ligne 22731, légitime pour impression) → `#0b0e17` (charter navy).

### Phase P4 — Bordures hors charte
- **fix(P4): normaliser bordures hors charte** — 61 occurrences de `rgba(255,255,255,0.10|0.12|0.14|0.15)` → `rgba(255,255,255,0.08)` (charter border-medium max).

### vps/pariscore.html — mêmes corrections
Les 5 derniers commits appliquent les mêmes corrections P0+P1+P2+P3+P4 sur `vps/pariscore.html` (version VPS, 24 485 lignes — légèrement différente de pariscore.html 25 863 lignes).

---

## Liste complète des 18 commits

```
0001 fix(P0): correct critical bugs — syntax error Dashboard.tsx:156 + nonexistent CSS vars
0002 feat(P1): import Google Fonts (Inter+Poppins) + add 12 design tokens
0003 fix(mobile): align theme on Pariscore charter (Poppins/Inter, charter colors)
0004 fix(P2): replace 4 phantom palettes with design tokens
0005 fix(P2b): replace hardcoded rgba/hex with derived design tokens
0006 feat(P3): add responsive media queries + nav wrap
0007 fix(P0): aligner body.dark-theme sur la charte Pariscore (12 tokens)
0008 fix(P1): aligner :root BETMART sur la charte (Poppins/Inter, 8 tokens)
0009 fix(P2b): MatchesTab active tab color '#000' → var(--color-on-accent)
0010 fix(P2a): unifier l'indicateur LIVE sur #ff6d2e (charter live orange)
0011 fix(P2b+P2c): purger purple et gold interdits → charter blue/live orange
0012 fix(P3): remplacer noir pur #000 → #0b0e17 (charter navy) hors @media print
0013 fix(P4): normaliser bordures hors charte — alpha 0.10/0.12/0.14/0.15 → 0.08
0014 fix(P0+P1): aligner body.dark-theme et :root BETMART sur la charte (vps)
0015 fix(P2a): unifier l'indicateur LIVE sur #ff6d2e (vps)
0016 fix(P2b+P2c): purger purple et gold interdits (vps)
0017 fix(P3): remplacer noir pur #000 → #0b0e17 hors @media print (vps)
0018 fix(P4): normaliser bordures hors charte — alpha 0.10/0.12/0.14/0.15 → 0.08 (vps)
```

---

## Fichiers modifiés (19)

| Fichier | Phases | Lignes changées |
|---|---|---|
| `frontend/index.html` | P1 | +4 / -1 |
| `frontend/src/App.tsx` | P3 | +1 / -1 |
| `frontend/src/index.css` | P3 | +32 / 0 |
| `frontend/src/styles/tokens.css` | P1 | +15 / 0 |
| `frontend/src/components/KeyFactors.tsx` | P2 | +6 / -6 |
| `frontend/src/components/MatchCard.tsx` | P0 | +1 / -1 |
| `frontend/src/components/MatchesTab.tsx` | P2, P2b | +7 / -7 |
| `frontend/src/components/PlayerProfileModal.tsx` | P0, P2b | +2 / -2 |
| `frontend/src/components/mma/StanceBadge.tsx` | P2 | +4 / -4 |
| `frontend/src/components/mma/StyleMatchupBadge.tsx` | P2 | +2 / -2 |
| `frontend/src/pages/Dashboard.tsx` | P0, P2b, P3 | +6 / -6 |
| `frontend/src/pages/H2HPage.tsx` | P2b, P3 | +2 / -2 |
| `frontend/src/pages/MMAPreMatch.tsx` | P2b, P3 | +3 / -3 |
| `frontend/src/pages/PreMatch.tsx` | P2b, P3 | +5 / -5 |
| `mobile/lib/core/theme/app_colors.dart` | P1 | +40 / -16 |
| `mobile/lib/core/theme/app_text_styles.dart` | P1 | +24 / -9 |
| `mobile/lib/core/theme/app_theme.dart` | P1 | +1 / 0 |
| `pariscore.html` | P0, P1, P2, P3, P4 | ~225 / -225 |
| `vps/pariscore.html` | P0, P1, P2, P3, P4 | ~222 / -222 |
| **Total** | | **+589 / -525** |
