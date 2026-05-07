# MULTI-IA RESILIENCE — Cascade Gemini → Groq → Math (v77.0)

> Si Google bloque, Meta (Llama 3) sauve. Si les deux tombent, les maths livrent.

---

## Cascade d'IA

```
Requête utilisateur
        │
        ▼
  ┌─────────────────┐
  │   1. GEMINI     │ ──► OK  → 🏅 CERTIFIÉ PARISCORE PRO (bleu)
  │  (via queue +   │
  │   throttle 15s) │ ──► 429 ─────────────────────────┐
  └─────────────────┘                                   │
                                                        ▼
                                               ┌─────────────────┐
                                               │   2. GROQ        │ ──► OK  → 🦙 CERTIFIÉ PARISCORE PRO (violet)
                                               │  (Llama 3.3 70B) │
                                               │  Quota séparé    │ ──► Échec ──┐
                                               └─────────────────┘             │
                                                                                ▼
                                                                    ┌─────────────────┐
                                                                    │  3. MATH FALLBACK│ → 📊 ANALYSE STATISTIQUE
                                                                    │  (100% local,    │    (amber)
                                                                    │   < 1ms,         │
                                                                    │   zéro réseau)   │
                                                                    └─────────────────┘
```

---

## Providers configurés

| Provider | Modèle | Quota gratuit | Clé |
|----------|--------|--------------|-----|
| Google Gemini | gemini-2.0-flash | ~15 req/min | `GEMINI_API_KEY` |
| Groq (Meta Llama) | llama-3.3-70b-versatile | 30 req/min | `GROQ_API_KEY` |
| Math Fallback | — (JS natif) | Illimité | — |

**Obtenir une clé Groq gratuite :** https://console.groq.com → API Keys → Create

---

## Variables d'environnement

```bash
# Clés AI providers
GEMINI_API_KEY=votre_cle_gemini
GROQ_API_KEY=votre_cle_groq          # Plan gratuit suffisant

# Throttle Gemini (empêche les bursts)
GEMINI_THROTTLE_MS=15000              # 15s entre appels Gemini
GEMINI_RPM_LIMIT=15                   # Sécurité RPM secondaire

# Modèle Groq (optionnel)
GROQ_MODEL=llama-3.3-70b-versatile   # Ou llama-3.1-8b-instant (plus rapide)
```

---

## Badges UI selon le provider

| Provider | Badge principal | Couleur | Mention bas de rapport |
|----------|----------------|---------|----------------------|
| Gemini | 🏅 CERTIFIÉ PARISCORE PRO | Vert | ⚙️ Powered by Gemini 🔵 |
| Groq/Llama | 🦙 CERTIFIÉ PARISCORE PRO | Violet | ⚙️ Powered by Llama 3 🟣 |
| Math fallback | 📊 ANALYSE STATISTIQUE | Amber | ⚙️ Mode Statistique 🟠 |

---

## Compatibilité prompt Llama 3

Le prompt `buildProScoutPrompt()` est compatible Llama 3 sans modification :
- Format Markdown standard (titres `#`, tableaux `|`, listes `¤`)
- Instructions claires en français
- Pas de fonctionnalités Gemini-spécifiques (pas de `grounding`, pas de `tools`)
- Llama 3.3 70B reproduit la structure demandée avec haute fidélité

---

## Logs serveur

```
[Universal] Gemini 429 → basculement Groq
[ProScout] ✓ GROQ — PSG vs Marseille
[ProScout] ✓ GEMINI — Lyon vs Monaco
[Universal] Groq échec (GROQ_HTTP_503) → fallback math
[ProScout] Tous les fournisseurs IA indisponibles — fallback math pour match_abc
```

---

*MULTI-IA RESILIENCE v77.0 — Mai 2026 — PariScore Infrastructure*
