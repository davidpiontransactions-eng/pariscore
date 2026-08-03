# 📋 Audit & QA Report — Dashboard Refonte (2026-08-03)

**Commit**: `3ed80a3` fix/audit-critical-high-severity-fixes  
**Déploiement**: VPS OVH `51.75.21.239:3005` → Nginx `:80`  
**Stack**: Next.js 16.2.12 (Turbopack) + React 19 + Tailwind 4 + shadcn/ui  

---

## ✅ Statut Global

| Axe | Résultat |
|-----|----------|
| HTTP 200 | ✅ |
| Layout (sections déplacées) | ✅ |
| Ancres + smooth scroll | ✅ |
| BestMatchesTabs | ✅ (Tennis/Football filtres OK) |
| UpcomingTenMatchesTable | ✅ (10 matchs, trié chrono) |
| Gemini AI Insight | ⚠️ Route OK, quota API saturé (429) |
| Input validation | ✅ (sport/matchData/matchId) |
| Rate limiting | ✅ (10 req/5min/IP) |
| Sécurité API key | ✅ (header `x-goog-api-key`, plus en URL) |
| Race condition (double-click) | ✅ (AbortController) |

---

## 🔴 Bugs Trouvés & Corrigés (4 files)

| # | Sévérité | Fichier | Bug | Fix |
|---|----------|---------|-----|-----|
| 1 | 🔴 Critical | `gemini-insight/route.ts:72` | API key leakée en query param URL (logs proxy/CDN) | Déplacée → header `x-goog-api-key` |
| 2 | 🔴 Critical | `gemini-insight/route.ts` | Aucune validation `sport`/`matchData` (prompt injection, coût token) | Validation + limite 10KB + rate limit 10req/5min/IP |
| 3 | 🟠 High | `ai-insight-card.tsx:105` | Race condition double-clic sélecteur match | `AbortController` + `useRef` |
| 4 | 🟠 High | `upcoming-ten-matches-table.tsx:91` | `isLoading = tennisLoading && footLoading` → bloquait tant que les 2 chargent | Changé en `\|\|` |
| 5 | 🟡 Medium | `best-matches-tabs.tsx:43` | `estimateFootballEloGap()` retourne 0 silencieusement | `console.warn` ajouté |

---

## 🟡 Améliorations Identifiées

| # | Composant | Amélioration suggérée | Priorité |
|---|-----------|----------------------|----------|
| A1 | `BestMatchesTabs` | Basketball/CS2/Darts tabs vides → masquer ou brancher API | Medium |
| A2 | `UpcomingTenMatchesTable` | Football: ajouter estimation ΔElo (actuellement `null`) | Medium |
| A3 | `AIInsightCard` | `scroll-margin-top` sur ancres pour compenser le header sticky | Low |
| A4 | Layout | Footer `hidden md:block` → liens inaccessibles sur mobile | Medium |
| A5 | `page.tsx` | 3 hooks fetch les mêmes données → doublonné (page + BestMatchesTabs + UpcomingTable + AIInsightCard) | Medium |
| A6 | `gemini-insight/route.ts` | `pruneExpiredCache()` itère O(n) sur tout `globalThis` → filter uniquement `gemini-insight:` | Low |

---

## 💡 Innovations & Enrichissements Suggérés

| # | Idée | Détail | Impact |
|---|------|--------|--------|
| I1 | **Indicateur section active** | `IntersectionObserver` sur les ancres → highlight le pill courant quand l'utilisateur scrolle | UX ⭐⭐⭐ |
| I2 | **Filtres avancés BestMatches** | Ajouter sliders ΔElo min / SPS min pour que l'utilisateur ajuste les seuils | Feature ⭐⭐⭐ |
| I3 | **Cache Gemini pré-rempli** | Cron quotidien qui pré-calcule 5-10 analyses pour les matchs du jour → pas d'attente utilisateur | Perf ⭐⭐⭐ |
| I4 | **Graphique sparkline dans UpcomingTable** | Mini Elo trend sur 5 matchs pour les colonnes ΔElo | Visuel ⭐⭐ |
| I5 | **Lien direct vers match detail** | Ajouter `onClick` → ouvre `MatchDetailDialog` depuis chaque ligne du tableau | UX ⭐⭐ |
| I6 | **Mode grille/table toggle** | Switch entre vue cartes (BestMatchesTabs) et vue tableau compact | UX ⭐ |
| I7 | **Badge "Live" dans UpcomingTable** | Si le match passe en direct avant l'heure prévue, badge rouge clignotant | Feature ⭐⭐ |
| I8 | **Gemini compare 2 matchs** | Checkbox multi-sélection → comparer deux matchs côte-à-côte dans l'analyse AI | Innovation ⭐⭐⭐ |

---

## 🧪 Résultats Tests VPS

```bash
# Route API déployée
$ curl -X POST localhost:3005/api/ai/gemini-insight \
  -H "Content-Type: application/json" \
  -d '{"sport":"invalid","matchId":"x","matchData":{}}'
→ {"error":"Sport non supporté: invalid"}  # ✅ Validation OK

# Page HTML
$ curl -s localhost:3005/ | grep -c "section-best-matches"
→ 2  # ✅ Ancre présente

# HTTP status
$ curl -s -o /dev/null -w "%{http_code}" http://localhost:3005/
→ 200  # ✅

# pm2 status
$ pm2 status pariscore-next
→ online, pid 3614939, mem 92MB, uptime ~1min  # ✅
```

### Note Gemini
La route `/api/ai/gemini-insight` fonctionne mais le quota Gemini gratuit est saturé (`429`). Le cache 12h amortira les appels une fois le quota rétabli ou upgradé.

---

## 📊 Métriques

| Métrique | Avant | Après |
|----------|-------|-------|
| Composants remplacés | 2 (`TopValueBetsList`, `LiveNowCrossSport`) | 2 (`BestMatchesTabs`, `UpcomingTenMatchesTable`) |
| Filtres custom | non (edge uniquement) | ΔElo ≥ 150, SPS ≥ 55 |
| Sports dans les tabs | 0 | 5 (2 actifs, 3 en attente) |
| Cache Gemini | aucun | 12h TTL `globalThis` |
| Rate limiting | aucun | 10 req/5min/IP |
| Validation input | aucune | sport + matchData + matchId |
| Sécurité API key | URL (logué) | Header HTTP |
| Race condition | oui | AbortController |
| Fichiers créés | — | 3 |
| Fichiers modifiés | — | 3 |
| Lignes ajoutées | — | ~730 |
| Bugs corrigés ce jour | — | 5 |
