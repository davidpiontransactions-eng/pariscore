# Audit Comparatif — Intégration IA dans les Plateformes de Pronostics Football
**Date** : 30 avril 2026  
**Auteur** : Manager Agent — PariScore  
**Objectif** : Analyser comment les concurrents intègrent l'IA (LLM, chatbot, prompt structuré), identifier les meilleures pratiques UX/technique, et définir la roadmap d'intégration du **Power Score Gemini** dans PariScore.

---

## 1. Tableau Comparatif Concurrents — Intégration IA

| Site | Type d'IA | Déclencheur UX | Format sortie | Streaming | Cache | Export Telegram | Score Global |
|------|-----------|----------------|---------------|-----------|-------|-----------------|-------------|
| **MatchonAI** | LLM (GPT/Claude) | Auto au chargement | Markdown libre, sections | Non (pre-generated) | Oui ~24h | Non | ⭐⭐⭐⭐ |
| **ScoutingStats** | IA propriétaire | Bouton "AI Tip" par ligne | Texte court structuré | Non | Oui | Non | ⭐⭐⭐ |
| **SofaScore** | LLM (OpenAI) | Onglet "Match Preview" | Paragraphes narratifs | Non | Oui ~6h | Non | ⭐⭐⭐ |
| **Forebet** | Algo propriétaire | Auto | Tableau probabilités | N/A | N/A | Non | ⭐⭐ |
| **WinDrawWin** | Algo + LLM léger | Section "AI Prediction" | Texte + cotes | Non | Oui | Non | ⭐⭐ |
| **OddAlerts** | Aucun LLM | — | — | — | — | Non | ⭐ |
| **Betimate** | Algo léger | Badge confiance | % seul | Non | N/A | Non | ⭐ |
| **PredictZ** | Algo | Tableau | % + verdict court | Non | Oui | Non | ⭐⭐ |
| **FootyStats** | Algo + stats | Section stats | Données tabulaires | N/A | Oui | Non | ⭐⭐ |
| **PariScore** *(actuel)* | Gemini Flash | Bouton ✦ par match | Markdown partiel | Non | 24h JSON | Non | ⭐⭐⭐ |
| **PariScore** *(cible)* | Gemini Flash | Bouton ⚡ Power Score | Markdown structuré 6 sections | **Oui SSE** | SQLite 24h | **Oui** | ⭐⭐⭐⭐⭐ |

---

## 2. Analyse Détaillée par Concurrent

### 2.1 MatchonAI — Le Leader UX (Déjà audité §17 CLAUDE.md)

**Ce qu'ils font bien :**
- Analyse pré-générée au chargement de la page match → zéro latence perçue
- Format "Tactical Breakdown" : 3 sections bien titrées (Context, Key Battles, Prediction)
- Ton accessible et conversationnel — pas de jargon data, compréhensible par un fan casual
- Section "Sound familiar?" dans la landing — empathie pain-points avant de montrer l'IA
- **Matchday Pass €3** pour débloquer analyses illimitées 24h — anti-friction monétisation

**Ce qui manque :**
- Aucune donnée mathématique (pas de Poisson, pas d'edge, pas de xG)
- Pas de streaming — analyse figée, pas d'effet "l'IA réfléchit"
- Pas de Telegram export
- Pas de probabilités numériques affichées
- Cible les fans, pas les parieurs sérieux

**À copier pour PariScore :**
- Structure 3-sections claire avec titres explicites
- Ton expert mais lisible
- Matchday Pass €1,50 (adaptation)

---

### 2.2 ScoutingStats — Le Concurrent Technique Direct

**Ce qu'ils font bien :**
- Bouton "AI Tip" sur chaque ligne du tableau → modal léger, chargement rapide
- Texte court structuré (3-4 lignes) : verdict clair + justification 1 phrase
- Données sources visibles dans l'analyse (ex: "Based on xG differential of +0.8")
- **Acca Generator** : l'IA sélectionne 3 matchs et génère un combiné avec justification
- Slider de confiance filtrant l'affichage — permet de "tasker" l'IA aux meilleurs signaux

**Ce qui manque :**
- Pas de streaming
- Analyse trop courte — pas d'analyse tactique profonde
- Pas de sections Corners / Script Telegram
- Pas en français
- Pas de feedback utilisateur (👍/👎)

**À copier pour PariScore :**
- Bouton "AI Tip" rapide sur chaque ligne (en complément du modal complet)
- "Based on data" : toujours citer la source mathématique dans l'analyse
- Acca Generator IA (roadmap déjà prévue)

---

### 2.3 SofaScore — L'Intégration LLM la Plus Sophistiquée

**Ce qu'ils font bien :**
- "Match Preview" généré par LLM OpenAI injecté de vraies stats SofaScore
- L'analyse est **contextualisée** : elle cite des stats réelles du match (forme, H2H, buts moyens)
- Ton narratif fluide — lit comme un article de journal, pas une liste de chiffres
- Rendu dans un onglet dédié "Preview" dans le modal match — intégration native
- Disponible en plusieurs langues (prompt multilingue)

**Ce qui manque :**
- Pas de streaming
- Pas de probabilités mathématiques ni d'edge
- Pas de section "Paris recommandés" — interdit par régulation dans certains pays
- Pas de Telegram export

**À copier pour PariScore :**
- **Injection de données contextuelles réelles dans le prompt** → c'est ce qui différencie une analyse générique d'une analyse précise
- Onglet dédié dans le modal Insights (déjà fait partiellement avec ✦ Analyse IA)
- Ton narratif fluide pour les sections non-mathématiques

---

### 2.4 Forebet — L'Algo Pur (Pas de LLM)

**Ce qu'ils font bien :**
- Probabilités affichées très clairement (%, graphe circulaire)
- Matrice de scores la plus populaire du marché — interface référence
- HT/FT predictions automatiques
- Algorithme de "Mathematic Prediction" avec grade A-F

**Ce qui manque :**
- Aucun LLM — analyse uniquement tabulaire, pas de texte explicatif
- UX vieillissante
- Pas d'edge vs bookmaker

**À copier pour PariScore :**
- Grade lettre (A/B/C) sur la qualité de la prédiction → à intégrer dans Power Score
- Matrice de scores comme on l'a déjà avec `openScoreMatrix()`

---

### 2.5 WinDrawWin — L'Équilibre Data/LLM

**Ce qu'ils font bien :**
- Section "AI Prediction" avec verdict court généré par LLM (GPT-3.5 ou équivalent)
- Probabilités affichées côte à côte avec l'analyse texte
- Filtres par marchés (HT/FT, BTTS, Over/Under)
- Bonne couverture internationale (100+ ligues)

**Ce qui manque :**
- Analyse IA superficielle — 2-3 phrases génériques
- Pas de prompt structuré visible
- Pas de streaming ni d'effet "live"
- Pub agressive

**À copier pour PariScore :**
- Verdict court en **header de l'analyse** avant les détails (impatience utilisateur)
- Filtres marchés dans la page Stratégies (déjà fait en Wave 1)

---

### 2.6 OddAlerts — Référence Technique Sans IA

**Ce qu'ils font bien :**
- Interface ultra-claire pour les value bets
- Edge affiché en temps réel avec bookmaker source
- Filtres puissants (sport, ligue, marché, edge min)

**Ce qui manque :**
- **Zéro IA générative** — algorithme pur
- Pas d'analyse textuelle
- Pas de Telegram
- UK-centric, pas de français

**Ce que PariScore a déjà en avance :**
- IA Gemini + Poisson + Edge + Telegram → supérieur sur tous les axes

---

## 3. Analyse du Prompt Power Score — Décorticage

Le prompt fourni est **exceptionnel** pour plusieurs raisons :

### 3.1 Points Forts du Prompt

| Élément | Valeur |
|---------|--------|
| **5 piliers pondérés** | Donne un cadre reproductible et auditable (Métriques 30% + Tactique 20% + Dynamique 20% + Presse 15% + Psychologie 15%) |
| **Isolation Dom/Ext** | Force l'IA à analyser dans le contexte correct — évite les biais génériques |
| **Format Markdown exigé** | Output directement rendable en HTML frontend |
| **Section Corners dédiée** | Différenciation marché vs concurrents qui ignorent les corners |
| **Script Telegram dans bloc code** | Export zero-friction — bouton "Copier" = 1 clic |
| **Top 5 paris typés** (Safe / Bankroll Builder / Value Bet / Coup Tactique / Coup Risqué) | Segmentation par profil de parieur — très différenciant |

### 3.2 Ce Qu'il Faut Injecter Automatiquement (Contexte Données)

Pour que le prompt soit **précis et non halluciné**, PariScore doit injecter en préambule :

```
[DONNÉES DU MATCH — INJECTÉES PAR PARISCORE]
Match: {home_team} vs {away_team}
Compétition: {league}
Date: {commence_time}
Forme Dom (5 matchs): {home_form} — PPG dom: {home_ppg}
Forme Ext (5 matchs): {away_form} — PPG ext: {away_ppg}
xG Dom: {expectedGoals.home} | xG Ext: {expectedGoals.away}
Stats Dom: Buts/match {avgScored_dom}, Encaissés/match {avgConceded_dom}
Stats Ext: Buts/match {avgScored_ext}, Encaissés/match {avgConceded_ext}
Poisson: 1X2 = {homeWin}% / {draw}% / {awayWin}% | BTTS {btts}% | Over 2.5 {over25}% | Under 2.5 {100-over25}%
Cotes: 1={odds.home} N={odds.draw} 2={odds.away}
Edge: Dom={edge.home}% Nul={edge.draw}% Ext={edge.away}%
Classements: Dom #${home_rank} | Ext #${away_rank}
```

### 3.3 Gap Pilier 4 "Presse & Consensus Web"

Le pilier **Presse & Consensus Web (15%)** est actuellement non alimenté — Gemini va générer du contenu générique.

**Solutions possibles :**
1. **Court terme** : demander à Gemini de "simuler" son analyse de la presse sur la base des données injectées (mention explicite dans le prompt)
2. **Moyen terme** : Firecrawl scraping de L'Équipe + Marca + Kicker au moment du clic → injection dans le prompt (cache 6h)
3. **Long terme** : `db.newsCache` avec cron 6h via MCP Firecrawl

---

## 4. Meilleures Pratiques UX — Synthèse

### 4.1 Déclencheur

**Pattern retenu : Bouton "⚡ Power Score" dans chaque carte + ligne tableau**

| Option | Avantage | Inconvénient |
|--------|----------|--------------|
| Auto au chargement (MatchonAI) | Zéro friction | Coût API x toutes les vues |
| Bouton par match (ScoutingStats) | Coût maîtrisé | 1 clic supplémentaire |
| Onglet dans modal Insights (SofaScore) | Contexte riche | Nécessite d'ouvrir le modal d'abord |

**Décision PariScore** : Bouton "⚡ Power Score" dans chaque carte stratégie + onglet "Power Score" dans le modal Insights. Double point d'entrée.

### 4.2 Affichage — Streaming SSE (Effet "Typage")

```
Utilisateur clique → skeleton animé "L'IA analyse..."
→ SSE stream : texte apparaît section par section
→ Rendu Markdown progressif (marked.js ou équivalent)
→ Telegram script en dernier → bouton "📋 Copier" apparaît
→ Boutons feedback 👍 👎 apparaissent
```

**Pourquoi le streaming est critique ici :**
- Gemini Flash peut prendre 3-8s pour ce prompt riche
- Sans streaming, l'UX est morte → utilisateur part
- Avec streaming, l'attente devient **engagement** (l'utilisateur lit pendant que l'IA écrit)

### 4.3 Cache par Match

```
clé : power_score_{matchId}
TTL : 24h (invalidé si odds changent de >3%)
Stockage : SQLite KV (kvGet/kvSet existants)
Taille : ~3-4 Ko par analyse
```

### 4.4 Export Telegram (Fonctionnalité Unique vs Concurrents)

**Aucun concurrent ne propose cette feature.**

Le prompt génère déjà un "Script Telegram" dans un bloc de code — PariScore doit :
1. Parser le contenu entre ` ```telegram ` et ` ``` `
2. Afficher un bouton "📋 Copier pour Telegram"
3. `navigator.clipboard.writeText()` → toast "Copié !"

### 4.5 Feedback Utilisateur

```
👍 / 👎 → POST /api/v1/power-score/{matchId}/feedback
→ Stocké dans SQLite table ai_feedback
→ Dashboard admin : analyses avec le plus de 👎 = prompts à améliorer
→ Metric produit : score moyen feedback sur 7j
```

---

## 5. Architecture Technique Recommandée

### 5.1 Endpoint Streaming

```
GET /api/v1/ai-stream/:matchId
→ Content-Type: text/event-stream
→ Vérifie cache SQLite kv('power_score_{id}')
  → Cache HIT  : stream le cache complet d'un coup (fast replay)
  → Cache MISS : appel Gemini streaming → pipe SSE → stocker en cache quand terminé
```

### 5.2 Prompt Builder (server.js)

```javascript
function buildPowerScorePrompt(match) {
  const dataBlock = `
[DONNÉES PARISCORE — CONTEXTE MATHÉMATIQUE]
Match: ${match.home_team} vs ${match.away_team} (${match.league})
Date: ${new Date(match.commence_time).toLocaleDateString('fr-FR')}
...
`;
  return POWER_SCORE_SYSTEM_PROMPT + '\n\n' + dataBlock;
}
```

### 5.3 Frontend — Rendu Markdown

Options (aucune dépendance npm) :
- **Option A** : `marked.js` CDN (léger, déjà potentiellement présent)
- **Option B** : Mini-parser maison pour les balises utilisées (##, **, *, emojis — suffisant)
- **Recommandé** : `marked.js` CDN, ~50Ko, standard du marché

### 5.4 Détection Bloc Telegram

```javascript
function extractTelegramScript(markdown) {
  const match = markdown.match(/```(?:telegram)?\n([\s\S]*?)```/);
  return match ? match[1].trim() : null;
}
```

---

## 6. Comparaison Avant/Après PariScore

| Feature | PariScore Actuel | PariScore Cible (après intégration) |
|---------|-----------------|--------------------------------------|
| Déclencheur IA | Bouton ✦ → modal Gemini | Bouton ⚡ Power Score → streaming SSE |
| Format réponse | Texte libre non structuré | 6 sections Markdown strictes |
| Streaming | Non — attente bloquante | Oui — typewriter effect |
| Probabilités dans l'analyse | Générées par Gemini (potentiellement fausses) | Injectées depuis Poisson réel (garanties exactes) |
| Section Corners | Non | Oui — `computePoisson` corners proxy |
| Script Telegram | Non | Oui — bouton 📋 Copier |
| Cache | `ai_cache.json` fichier JSON | SQLite KV avec TTL et invalidation |
| Feedback | Aucun | 👍/👎 → table `ai_feedback` SQLite |
| Contexte données | Minimal (odds seulement) | Complet : form, xG, edge, Poisson, stats |
| Langue | Français | Français + anglais (multilingue P2) |

---

## 7. Roadmap d'Implémentation — Tâches Priorisées

### 🔥 WAVE 4 — Power Score Streaming (P0 — Priorité Maximale)

**TASK-W4-001 : Route `/api/v1/ai-stream/:matchId` (SSE Streaming)**
- Endpoint GET → `text/event-stream`
- Vérifier cache SQLite → HIT : replay immédiat / MISS : appel Gemini streaming
- Headers CORS + Cache-Control: no-cache
- Pipe response Gemini → client SSE
- Stocker en SQLite KV à la fin du stream

**TASK-W4-002 : `buildPowerScorePrompt(match)` dans server.js**
- Injecter le prompt Power Score complet fourni par le DG
- Construire `[DONNÉES PARISCORE]` block depuis l'objet match
- Inclure : form, xG, Poisson, odds, edge, rank, avgScored/Conceded
- Exposer `POWER_SCORE_SYSTEM_PROMPT` comme constante configurable

**TASK-W4-003 : Onglet "⚡ Power Score" dans modal Insights**
- 6ème onglet dans `#ins-tabs` (après Graphique)
- Affichage streaming : placeholder animé → texte apparaît progressivement
- `marked.js` CDN pour rendu Markdown
- Section Telegram détectée auto → bouton 📋 Copier animé

**TASK-W4-004 : Bouton "⚡ Power Score" dans cartes stratégie**
- Bouton sur chaque `strategy-card` → déclenche l'analyse dans le modal
- Indicateur de cache : badge "🔄 Analyse fraîche" si < 6h, "📦 En cache" si > 6h

**TASK-W4-005 : Export Telegram — Bouton 📋 Copier**
- Parser le bloc ` ```telegram ` dans la réponse Gemini
- Afficher section "Script Telegram" en fond sombre, police monospace
- `navigator.clipboard.writeText()` → toast vert "Copié ! ✓"
- Fallback textarea select si clipboard API indisponible

**TASK-W4-006 : Feedback 👍 👎 + Table ai_feedback SQLite**
- Boutons 👍/👎 apparaissent après la fin du stream
- `POST /api/v1/power-score/:matchId/feedback` → body `{rating: 1|-1}`
- Créer table `ai_feedback(matchId, rating, ts)` dans SQLite
- Afficher dans `admin.html` : top analyses notées négativement

### 🟡 WAVE 5 — Enrichissement Contextuel (P1 — Semaines 5-6)

**TASK-W5-001 : Scraping Presse via Firecrawl MCP (Pilier 4)**
- Trigger au clic "Power Score" si cache vide
- Firecrawl search : "match {home_team} {away_team} {date} analyse"
- Parser top 3 résultats → extraire 2-3 phrases par source
- Injecter dans le prompt comme `[CONSENSUS PRESSE]`
- Cache Firecrawl 6h par match (`kv('news_{matchId}')`)

**TASK-W5-002 : Section H2H dans le prompt (Pilier 5)**
- Route `/api/v1/h2h/:homeId/:awayId` → cache 24h
- Fetch API-Football `/fixtures?h2h={teamA}-{teamB}&last=5`
- Injecter les 5 derniers résultats H2H dans le prompt
- Afficher résumé H2H dans modal Résumé également

**TASK-W5-003 : Power Score "Quick" sur chaque ligne du tableau matchs**
- Bouton compact "⚡" dans la colonne Actions (à côté de ✦ et ⚽)
- Ouvre un mini-tooltip/popover (pas le modal complet) avec :
  - Power Score Dom/Ext (X/100)
  - Top 2 paris recommandés
  - Bouton "Voir l'analyse complète →"

### 🔮 WAVE 6 — Monétisation IA (P2)

**TASK-W6-001 : Gate Pro pour Power Score complet**
- Power Score Quick (2 paris) → gratuit
- Power Score complet (6 sections + Telegram) → Pro uniquement
- JWT check dans `/api/v1/ai-stream/:matchId`
- Overlay "🔒 Débloque avec le Plan Pro ou Matchday Pass €1,50"

**TASK-W6-002 : Matchday Pass €1,50 (inspiration MatchonAI)**
- Stripe Checkout one-click → JWT expiration 24h
- Débloque : Power Score complet + AI Scout illimité + Alertes Telegram
- Landing "Joue avec l'IA ce soir" → conversion maximale match day

---

## 8. Décisions Techniques Finales

| Décision | Choix | Justification |
|----------|-------|---------------|
| Streaming | SSE (`text/event-stream`) | Déjà infra SSE en place (broadcastSSE), zéro nouvelle dépendance |
| Markdown | `marked.js` CDN | Standard, 50Ko, zéro serveur, déjà Chart.js CDN = pattern établi |
| Cache | SQLite KV existant (`kvGet/kvSet`) | Cohérent avec l'infra, persistant, zéro JSON |
| Prompt | Constante `POWER_SCORE_SYSTEM_PROMPT` dans server.js | Configurable, versionnable |
| Telegram | Bloc ` ```telegram ` parsé côté client | Zéro serveur, immédiat |
| Feedback | Table SQLite `ai_feedback` | Lightweight, analysable depuis admin.html |

---

## 9. Ce que PariScore aura qu'aucun concurrent n'a

1. **Prompt Power Score structuré 5 piliers** — le plus complet du marché
2. **Streaming SSE typewriter** — seul OddAlerts fait mieux sur l'UX data, mais pas sur l'IA
3. **Probabilités Poisson injectées dans l'IA** — analyse mathématiquement vérifiable
4. **Export Script Telegram en 1 clic** — feature unique, zéro concurrent
5. **Feedback 👍/👎 avec amélioration continue du prompt** — boucle produit
6. **Français natif** — marché francophone non adressé par les concurrents anglais

---

*Audit rédigé le 30 avril 2026 — PariScore v4.3.0*  
*Prochaine étape : WAVE 4 → `/api/v1/ai-stream/:matchId` + buildPowerScorePrompt() + onglet Power Score dans modal Insights*
