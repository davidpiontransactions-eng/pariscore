# Rapport — Le hype "Jev" (TypeSafe AI) vs notre config actuelle

Date : 2026-09-25 · Sources : Wikipedia (jev-1.13.0), Forbes, TechCrunch, The Register, VentureBeat, explainx.ai, the-ai-corner, ai-supremacy

---

## 1. De quoi on parle

**Jev** est un modèle d'IA propriétaire de **TypeSafe AI** (San Francisco, fondée 2024 par Diogo Almeida — ex-OpenAI RLHF/InstructGPT/ChatGPT/GPT-4, Erik Gafni, Sasha Sheng). Sorti en early access le **15 septembre 2026** avec une levée de **40 M$ (DCVC)**, valorisation 200 M$. Ouverture à tous le ~23/09 (5 $ de crédits ≈ 120 M tokens).

Ce n'est **pas un LLM** : Jev ne génère aucun texte. On lui envoie un *état* (JSON/strings) + des *questions typées*, il renvoie des **décisions structurées avec probabilités et scores de confiance**, consommées par du code. TypeSafe le nomme premier **"System One model"** (référence au Système 1 de Kahneman : rapide, intuitif, non verbal).

## 2. L'API en 3 primitives

| Primitive | Question | Retour |
|---|---|---|
| **Choice** | choisir une option dans un ensemble défini | option + probas par option + confiance |
| **Score** | noter l'état sur des niveaux ordonnés | score + probas par niveau + confiance |
| **Noul** | évaluer un oui/non | probabilité ∈ [0,1] |

Le schéma de sortie est **fermé** : impossible de renvoyer une valeur hors énumération → pas d'hallucination ni d'erreur de type (selon l'éditeur). Toutes les questions d'une requête sont évaluées en **un passe parallèle**.

## 3. Les chiffres du hype — et leur véracité

| Claim TypeSafe | Réalité / recul |
|---|---|
| Latence 70–500 ms bout-en-bout | Plausible (sortie structurée, pas de génération) |
| 40–200× plus rapide, 40–400× moins cher que LLMs frontier (pic 444,6×) | **Auto-testé** par l'équipe model-capabilities sur leurs propres workflows — biais reconnu, "haut de fourchette" (ts2.tech, explainx.ai) |
| 0,042 $/M tokens entrée, sortie gratuite ; 10 000 décisions = 0,42 $ | Prix réel affiché — c'est le vrai argument |
| Zéro hallucination | Vrai *par construction* (sortie fermée), mais la qualité de la décision reste à prouver |
| Transformer + données synthétiques + RLCD (RL for Calibrated Decisions) | Aucun paper, aucun poids publiés ; observateurs : possiblement bâti sur un LLM open-weight |

**Timeline du buzz** : 15/09 stealth exit → viral X/GitHub/Slack agents (la couche "décision" plaît aux builders d'agents) → fact-checks sceptiques (19–24/09) → ouverture sans waitlist (~23/09).

**⚠️ Sécurité** : VentureBeat (21/09) — des entreprises placent Jev en couche de décision de leurs agents, mais **l'injection de prompt dans l'État peut influencer le verdict**. Jev ne doit jamais être l'unique gate de sécurité.

## 4. Notre config actuelle (rappel)

- Harness **OpenCode** + providers : Xiaomi Token Plan (**MiMo v2.6** Pro/Flash/UltraSpeed), OpenCode Zen (`-free` gate), **NVIDIA NIM** (derniers models à fixer — TODO ouverte)
- 12+ serveurs **MCP** (scrapling, scrapy, crawl4ai, playwright, football-docs…)
- Moteurs maison : Markov live (`src/lib/prediction/live-markov.ts`), total-games, prédictions **Gemini**
- Pipeline scraping (oddalerts, rankings, vitibet prévu) + cron pm2 VPS, Next 16/Bun/Prisma

## 5. Où Jev collerait dans Pariscore

| Cas d'usage | Primitive | Gain estimé | Effort |
|---|---|---|---|
| **Gating value bets** — "edge > 0 après de-vig ?" | Noul + Score | décisions en < 500 ms, coût dérisoire | Faible (PoC) |
| **Tri des prédictions live** — publier/écarter une recommandation selon l'état (score, momentum, Markov) | Choice + confiance | remplace des appels LLM latents/coûteux dans la boucle live | Moyen |
| **Routage scraping** — source fiable en cas d'anomalie (WAF, parsing douteux) | Choice | robustesse pipeline | Faible |
| **Priorisation SEO/contenu** (cf. `liste-agents-seo-2026.md`) | Score | plan d'action priorisé auto | Faible |
| **Modération 18+/jeu responsable** des recommandations | Noul | gate supplémentaire (pas unique) | Moyen |

**Économie** : ~0,42 $ pour 10 000 décisions structurées — négligeable face aux tokens LLM actuels (narrations Gemini conservées : Jev ne rédige pas).

## 6. Risques

1. **Vendor lock-in** : propriétaire, API uniquement, pas d'auto-hébergement, pas de poids/paper
2. **Prompt injection** sur l'État d'entrée (VentureBeat) → double gate obligatoire pour tout ce qui touche l'argent
3. **Benchmarks auto-testés** — les 444× sont le haut de la fourchette marketing
4. **Sortie structurée uniquement** : ne remplace ni Gemini ni nos explications utilisateur
5. Dépendance réseau d'un éditeur de 10 jours — latence réelle EU à mesurer

## 7. Verdict

- **Le concept est solide** (couche "Système 1" de décision pour agents : rapide, typé, calibré) — le hype est légitime sur le fond.
- **Les chiffres sont marketing** (auto-tests), et la sécurité (injection de prompt) est un vrai point noir pour un usage paris.
- **Pour Pariscore** : ne pas bouger le harness, ne rien remplacer. **PoC budget 5 $** sur **un seul** use case (gating value bets ou tri live), derrière un double gate, avec mesure de latence réelle.
- **Alternative open à surveiller** : CLM-8B (Contrastive Language Model, "System One" open mentionné par explainx.ai) pour éviter le lock-in.

## 8. Prochaines étapes (vérifiables)

```
1. [Compte] Créer le compte TypeSafe + crédits 5 $        → verify: clé API dans .env (jamais commitée)
2. [PoC] Noul "edge > 0 ?" sur 50 value bets historiques   → verify: probabilités calibrées vs outcomes réels
3. [Mesure] Latence + coût réels vs appels LLM actuels     → verify: tableau comparatif dans ce rapport
4. [Décision] Go/No-go expansion (tri live, routing)       → verify: bead bd créée/clos
5. [Veille] CLM-8B + retours prod injection de prompt      → verify: revue mensuelle
```
