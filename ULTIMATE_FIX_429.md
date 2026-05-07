# ULTIMATE FIX 429 — Gendarmerie des Flux Gemini (v76.0)

> Plan de secours complet : l'utilisateur ne voit jamais un code d'erreur.

---

## Architecture de défense (4 couches)

```
Requête utilisateur
        │
        ▼
┌─────────────────────────────────┐
│  COUCHE 1 — Cache KV 24h        │ ──► HIT → réponse immédiate (0 appel Gemini)
│  kvGet(`pro_scout_${matchId}`)  │
└────────────────┬────────────────┘
                 │ MISS
                 ▼
┌─────────────────────────────────┐
│  COUCHE 2 — Déduplication       │ ──► Match déjà en cours → attend le résultat existant
│  _geminiInFlight Map            │     (0 appel Gemini supplémentaire)
└────────────────┬────────────────┘
                 │ Pas en cours
                 ▼
┌─────────────────────────────────┐
│  COUCHE 3 — Rate Limiter RPM    │ ──► Quota/min dépassé → fallback math instantané
│  GEMINI_RPM_LIMIT (défaut: 15)  │     (0 appel Gemini, 0 attente)
└────────────────┬────────────────┘
                 │ OK
                 ▼
┌─────────────────────────────────┐
│  COUCHE 4 — Queue + Backoff     │
│  geminiEnqueue() → 1 concurrent │
│  callGeminiWithRetry()          │
│    tentative 1 → attente 2s     │
│    tentative 2 → attente 5s     │
│    tentative 3 → attente 10s    │
└────────────────┬────────────────┘
                 │ Toujours 429
                 ▼
        Fallback Math (buildMathFallbackReport)
        Badge : ⚡ ANALYSE MATHÉMATIQUE (Fast Mode)
```

---

## Ce que voit l'utilisateur (matrice UX)

| Situation | Badge | Message |
|-----------|-------|---------|
| Cache 24h disponible | 💾 CACHE 24H | Rapport instantané |
| Gemini répond OK | 🏅 CERTIFIÉ PARISCORE PRO | Rapport IA 5 piliers |
| Même match demandé 2 fois simultanément | 🏅 ou ⚡ selon résultat | Le 2ème user attend le résultat du 1er |
| RPM dépassé | ⚡ ANALYSE MATHÉMATIQUE (Fast Mode) | Rapport math complet |
| 429 côté serveur (après 3 retries) | ⚡ ANALYSE MATHÉMATIQUE (Fast Mode) | Rapport math complet |
| 429 HTTP renvoyé au client | Barre de progression | "🎯 File d'attente... Retry dans 5s" + auto-retry |
| Erreur réseau | Message discret | "Forte affluence : Analyse en cours de préparation..." |

**Aucun code numérique (429, 500, etc.) n'apparaît jamais.**

---

## Contenu du Fallback Math (generateStaticScoutReport)

Rapport structuré 100% JS natif, sans IA :

- Table probabilités Poisson : 1X2, BTTS, Over 0.5/1.5/2.5/3.5, Under 2.5, Clean Sheet
- xG attendus (λ domicile / extérieur) avec PPG, buts/match, encaissés/match
- Top 3 scores les plus probables avec probabilités
- Value Bet détecté (edge %, cote, bookmaker)
- Formes L5 des deux équipes
- Script Telegram pré-rempli avec les données mathématiques

---

## Configuration (variables d'environnement)

```bash
GEMINI_RPM_LIMIT=15    # Appels max par minute (défaut: 15 — plan Gemini gratuit)
                        # Plan payant Gemini Flash: augmenter à 60 ou 1000
```

---

## Monitoring — logs serveur

```
[ProScout] Dedup — attente du résultat en cours pour match_abc123
[ProScout] RPM limit atteint (15/min) — fallback math pour match_abc123
[ProScout] Gemini quota épuisé — fallback math pour match_abc123
[Gemini] 429 quota — tentative 1/3
[Gemini] 429 quota — tentative 2/3
[Gemini] 429 quota — tentative 3/3
```

---

## Roadmap si le 429 persiste

| Action | Impact | Délai |
|--------|--------|-------|
| Passer au plan Gemini payant | RPM 15 → 1000 | Immédiat |
| Augmenter `GEMINI_RPM_LIMIT` | Adapté au plan souscrit | Immédiat |
| Ajouter cache Redis | TTL partagé multi-instance | 1 jour |
| Pré-générer les rapports en cron (top 20 matchs) | 0 latence utilisateur | 2 jours |

---

*v76.0 — Mai 2026 — PariScore Infrastructure*
