# Traceabilité — Fixes Intégration Handball

**Date**: 2026-09-16

---

## Bugs détectés et corrigés

### Bug 1 (CRITICAL) — Sidebar ne charge pas handball

**Cause**: `buildTree()` dans `use-sports-tree.ts` ne contenait pas `loadHandball()` — le sport n'apparaissait jamais dans la sidebar.

**Fix**:
- `src/lib/sports-tree.ts` — ajouté `MinimalHandballMatch` type + `handballToRaw()` normaliseur
- `src/hooks/use-sports-tree.ts` — ajouté import `handballToRaw` + `loadHandball()` + wired dans `buildTree()` Promise.all

### Bug 2 — API base URL incorrecte

**Cause**: `HANDBALL_BASE = "https://v3.football.api-sports.io"` — pointait vers l'API football, pas handball.

**Fix**: `src/lib/handball-api.ts` — changé en `"https://v3.handball.api-sports.io"`

### Bug 3 — Icône manquante dans sidebar

**Cause**: `SPORT_ICONS` ne contenait pas d'entrée pour `"Circle"` (l'icône handball dans SPORT_META).

**Fix**: `src/components/layout/sports-sidebar.tsx`:
- Import `Circle` depuis `lucide-react`
- Ajouté `Circle: Circle` dans `SPORT_ICONS`
- Ajouté `handball: { bg: "bg-[#00897B]/15", text: "text-[#00897B]" }` dans `SPORT_COLORS`

---

## Vérification

- `npx tsc --noEmit` : ✅ 0 erreurs
- `bun test handball-strategy-top8` : ✅ 11/11 pass
