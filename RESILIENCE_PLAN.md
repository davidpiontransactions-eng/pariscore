# PariScore — Plan de Résilience API (v75.0)

> Comment le système survit aux pics de trafic et aux limitations d'API tierces.

---

## 1. Couche Gemini — 3 niveaux de protection

### 1.1 File d'attente globale (Queue)
```
Utilisateur A ──┐
Utilisateur B ──┤──► geminiEnqueue() ──► 1 appel à la fois ──► Gemini API
Utilisateur C ──┘       (Promise chain)
```
- `_geminiQueueTail` enchaîne les Promises : 5 requêtes simultanées = 5 appels séquentiels, jamais parallèles.
- Zéro saturation de quota par burst.

### 1.2 Exponential Backoff (Retry sur 429)
| Tentative | Délai avant appel | Comportement |
|-----------|-------------------|--------------|
| 1ère | 2 secondes | Attend, réessaie |
| 2ème | 5 secondes | Attend, réessaie |
| 3ème | 10 secondes | Attend, réessaie |
| Abandon | — | Déclenche le fallback |

### 1.3 Math Fallback (Mode dégradé)
Si les 3 tentatives échouent → `buildMathFallbackReport()` génère un rapport complet **sans IA** :
- Table de probabilités Poisson (1X2, BTTS, Over 0.5→3.5)
- xG attendus (λ domicile / extérieur)
- Top 3 scores les plus probables
- Value Bet détecté (edge %)
- Formes L5
- Script Telegram pré-rempli

**L'utilisateur voit de la donnée, jamais un code d'erreur.**

---

## 2. Cache — 24h par match

```
Requête ──► Cache KV (pro_scout_{id}) ──► HIT ? ──► Réponse immédiate
                                          │
                                         MISS
                                          │
                                    geminiEnqueue()
                                          │
                                    Gemini API (+ backoff)
                                          │
                                    kvSet() → cache 24h
```

- Clé : `pro_scout_{matchId}` (rapport IA) — 24h TTL
- Le cache est vérifié **avant tout appel réseau**. Gemini n'est jamais contacté si le rapport existe.

---

## 3. UX — L'utilisateur ne voit jamais d'erreur technique

| Situation | Ce que voit l'utilisateur |
|-----------|--------------------------|
| Rapport en cache | 💾 CACHE 24H — rapport instantané |
| Gemini disponible | 🏅 CERTIFIÉ PARISCORE PRO — rapport IA |
| Gemini 429 (serveur renvoie 429) | Countdown "Retry dans 5s" + auto-retry frontend |
| Gemini 429 (3 tentatives épuisées) | ⚡ ANALYSE STATISTIQUE BRUTE — rapport math |
| Erreur réseau générique | "Affluence élevée : Analyse en cours de préparation..." |

**Aucun code HTTP (429, 500, etc.) n'est jamais affiché à l'utilisateur final.**

---

## 4. Architecture des limites API-Football

| Endpoint | TTL Cache | Stratégie |
|----------|-----------|-----------|
| Standings | 12h | Cron — pas à la demande |
| Fixtures live | 60s (19h-23h uniquement) | Smart Polling — hors créneaux = off |
| Team Stats (xG, cartons) | 24h | Demande unique + kvSet |
| Player Ratings (BSD) | 24h | Demande unique + kvSet |
| Injuries | 24h | Demande unique + kvSet |
| Top Scorers | 24h | Demande unique + kvSet |

---

## 5. Plan de montée en charge (roadmap)

| Trafic | Solution |
|--------|---------|
| < 100 users/jour | Architecture actuelle (suffisant) |
| 100-500 users/jour | Augmenter TTL cache → 48h, ajouter Redis |
| > 500 users/jour | Workers Gemini dédiés + queue Redis + plan API payant Gemini |

---

*Dernière mise à jour : v75.0 — Mai 2026*
