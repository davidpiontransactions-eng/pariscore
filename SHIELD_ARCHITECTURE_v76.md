# SHIELD ARCHITECTURE v76 — Disjoncteur Anti-429

> L'IA est un bonus. La donnée est un devoir.

---

## Principe : Le Disjoncteur

```
Requête ──► [Disjoncteur] ──► IA disponible ? ──► OUI → Rapport Gemini 🏅
                                                 └── NON → Rapport Statistique 📊
```

Le système ne peut JAMAIS renvoyer une erreur technique à l'utilisateur.
Si l'IA tombe, le moteur statistique prend le relais instantanément.

---

## Architecture 4 couches (ordre d'exécution)

```
1. CACHE (kvGet)
   └── HIT → réponse < 1ms, 0 appel réseau

2. DÉDUPLICATION (_geminiInFlight Map)
   └── Match déjà en cours → partage le résultat (0 appel dupliqué)

3. DISJONCTEUR (RPM + Throttle)
   └── > 15 appels/min  → fallback 📊 instantané
   └── < 15s depuis dernier appel → attente dans la queue

4. QUEUE + BACKOFF (geminiEnqueue + callGeminiWithRetry)
   └── 1 appel à la fois, délais 2s/5s/10s sur 429
   └── 3 échecs → fallback 📊 instantané
```

---

## Throttle 15 secondes (nouveau v76)

```
Appel A termine ──┐
                  ├── 15s de silence obligatoire
Appel B attend ───┘── puis se déclenche
```

Configurable : `GEMINI_THROTTLE_MS=15000` (env)

**Pourquoi 15s ?**
- Plan Gemini Flash gratuit : ~4 req/min théorique
- 15s de gap = 4 req/min maximum, sans jamais saturer
- Les retries backoff (2s+5s+10s) consomment déjà ce délai si 429

---

## Ce que voit l'utilisateur

| État | Badge | Texte statut |
|------|-------|-------------|
| Cache 24h | 💾 CACHE 24H | Rapport instantané |
| Gemini OK | 🏅 CERTIFIÉ PARISCORE PRO | ✨ NOUVEAU · 5 PILIERS |
| Fallback math | 📊 ANALYSE STATISTIQUE | ⚡ FAST MODE · IA SURCHARGÉE |
| File d'attente (429 HTTP) | Barre de progression | 🎯 File d'attente... Retry dans 5s |
| Erreur réseau | Message discret | Forte affluence : Analyse en cours |

**Aucun code HTTP, aucun mot "erreur", aucun "429" visible.**

---

## Contenu du rapport 📊 ANALYSE STATISTIQUE

Généré en < 1ms, 100% local, sans réseau :

| Section | Données |
|---------|---------|
| Probabilités 1X2 | Poisson homeWin / draw / awayWin |
| Marchés buts | Over 0.5 / 1.5 / 2.5 / 3.5, BTTS, Under 2.5 |
| Clean Sheet | cs00 % |
| xG attendus | λ domicile / extérieur |
| Scores probables | Top 3 avec probabilités |
| Value Bet | Edge %, cote, bookmaker |
| Formes L5 | Chaîne W/D/L des 5 derniers matchs |
| Script Telegram | Pré-rempli avec les données math |

---

## Variables d'environnement

```bash
GEMINI_THROTTLE_MS=15000   # Délai minimum entre appels (ms) — défaut 15s
GEMINI_RPM_LIMIT=15        # Appels max par minute (sécurité secondaire)
```

---

## Logs serveur — monitoring

```
[Gemini] Throttle — attente 12340ms avant prochain appel
[Gemini] 429 quota — tentative 1/3
[ProScout] Dedup — attente du résultat en cours pour match_abc
[ProScout] RPM limit atteint — fallback math pour match_abc
[ProScout] Gemini quota épuisé — fallback math pour match_abc
```

---

*SHIELD ARCHITECTURE v76 — Mai 2026 — PariScore Infrastructure*
