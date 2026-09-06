# Rapport Mission — Remplacement API BSD pour US Open Tennis

**Date** : 2026-09-06
**Statut** : ✅ RÉSOLU

---

## 1. Diagnostic

L'API BSD (`sports.bzzoiro.com`) est la source primaire pour les matchs tennis. Le fallback US Open existant (`usopen-fetcher.ts`) scrapait le HTML de usopen.org — non fiable (WAF Akamai, parsing HTML fragile).

**Objectif** : Remplacer le scraper HTML par les JSON feeds officiels US Open.

---

## 2. Source Alternative Sélectionnée

| Source | Type | Avantage |
|--------|------|----------|
| **usopen.org JSON feeds** | JSON natif | Officiel, structuré, 127+ matchs |
| FlareSolverr | Proxy | Bypass WAF datacenter VPS |
| ESPN | JSON | Complémentaire (pas encore dispo US Open 2026) |

**URL** : `https://www.usopen.org/en_US/scores/feeds/{year}/draws/{DRAW_CODE}.json`
- `MS` = Men's Singles (127 matchs)
- `LS` = Ladies' Singles
- `MD`, `LD`, `XD` = Doubles

---

## 3. Fichiers Modifiés

| Fichier | Action |
|---------|--------|
| `src/lib/usopen-fetcher.ts` | **Réécrit** — JSON feeds + FlareSolverr |

**Avant** : scraping HTML usopen.org, parsing regex fragile
**Après** : JSON natif via FlareSolverr, normalisation structurée

---

## 4. Validation

| Check | Statut |
|-------|--------|
| typecheck (`tsc --noEmit src/lib/usopen-fetcher.ts`) | ✅ |
| lint (`bun run lint`) | ✅ 0 errors |
| build (`bun run build`) | ✅ |
| PM2 restart | ✅ online |
| Health check | ✅ HTTP 200 |
| Test US Open feed | ✅ 127 matchs MS récupérés |

---

## 5. Architecture

```
BSD API (primary) ──→ /api/tennis/prematch
  │ fail
  ▼
Odds API (secondary)
  │ fail
  ▼
US Open JSON feeds (FlareSolverr) ──→ 127 matchs structurés
  │ fail
  ▼
Stale cache → empty list (prod)
```

Le fallback US Open ne s'active que quand BSD + Odds échouent. En cas de succès BSD, les matchs US Open sont déjà inclus dans la réponse BSD.

---

## 6. Prochaines étapes

1. **Monitoring** : Vérifier que le fallback s'active correctement quand BSD est KO
2. **Ladies Singles** : Tester le draw `LS` pendant le tournoi
3. **Enrichissement** : Ajouter odds/predictions sur les matchs US Open (Elo, surface)
4. **Scraper CS2 HLTV** : Le scraper FlareSolverr est fonctionnel mais lent (~2s/request). relancer en background quand le VPS est moins chargé
