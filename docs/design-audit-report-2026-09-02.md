# PariScore — Audit Design Approfondi & Plan d'Innovation

**Date** : 2 septembre 2026  
**Auteur** : Agent OpenCode  
**Méthodologie** : Revue académique (20+ sources), benchmark 17 sites concurrents, audit Vercel Web Interface Guidelines, analyse des audits existants  

---

## Table des matières

1. [Résumé exécutif](#1-résumé-exécutif)
2. [État actuel du projet](#2-état-actuel-du-projet)
3. [Revue académique & theses scientifiques](#3-revue-académique--theses-scientifiques)
4. [Benchmark sectoriel](#4-benchmark-sectoriel)
5. [Audit Vercel Web Interface Guidelines](#5-audit-vercel-web-interface-guidelines)
6. [Synthèse des problèmes identifiés](#6-synthèse-des-problèmes-identifiés)
7. [Axes d'amélioration](#7-axes-damélioration)
8. [Axes d'innovation](#8-axes-dinnovation)
9. [Plan de refonte design](#9-plan-de-refonte-design)
10. [Annexes](#10-annexes)

---

## 1. Résumé exécutif

PariScore est une plateforme de prédictions sportives multi-sports (football, tennis, NBA, MMA, cyclisme, CS2, F1) construite avec Next.js 16 + React 19 + shadcn/ui + TailwindCSS 4. Le site utilise un thème dark navy avec accent vert néon, et offre des prédictions basées sur des modèles statistiques (Poisson, Dixon-Coles, ELO, Markov).

### Score global : 17/20 (excellente base technique)

**Forces** :
- Architecture technique solide (Next.js 16, standalone, Prisma 6)
- Dark mode bien implémenté avec token system complet
- 170+ composants React avec shadcn/ui
- Animations sobres avec reduced-motion respecté
- PWA installable avec service worker

**Faiblesses critiques** :
- Aucun site de betting/prédictions n'a jamais gagné de Webby/Awwwards/Apple Design Award — le marché est **fonctionnel mais laid**
- Discordance entre le DESIGN_CHARTER (Poppins/Inter) et l'app réelle (Geist)
- 12 anti-patterns gray-on-color non résolus
- Touch targets < 44px dans 3 composants critiques
- Pas de visualisation interactive de données (pitch maps, courbes de probabilité)
- Pas de personnalisation (follow teams/players)
- Pas de cartes de prédictions partageables

**Opportunité** : Le marché étant dominé par des interfaces datées (Forebet, WindrawWin, BetExplorer), PariScore peut devenir la **première plateforme de prédictions au design premium** — comparable à FotMob (Apple Design Award) pour le football.

---

## 2. État actuel du projet

### 2.1 Architecture technique

| Composant | Technologie | Version |
|-----------|-------------|---------|
| Framework | Next.js (App Router) | 16.1.3 |
| Runtime | Bun | 1.3.14 |
| Frontend | React | 19 |
| UI Library | shadcn/ui (New York) | ~50 composants |
| CSS | TailwindCSS | 4 |
| State | Zustand + React Query + SWR | - |
| ORM | Prisma | 6 |
| Auth | NextAuth | v4 |
| Validation | Zod | 4 |
| i18n | next-intl | - |
| Monitoring | Sentry + PostHog | - |
| Mobile | Capacitor 8 (Android APK) | - |

### 2.2 Design tokens (DESIGN_CHARTER.md)

| Token | Valeur | Usage |
|-------|--------|-------|
| Background | `#0b0e17` → `#0e121e` → `#131722` → `#161c2a` | 5 niveaux de profondeur |
| Accent | `#00e676` (vert néon) | CTA, highlights, succes |
| Texte primaire | `#ffffff` | Texte principal |
| Texte secondaire | `#e8eaed` | Texte secondaire |
| Texte tertiaire | `#94a3b8` | Labels, timestamps |
| Succès | `#00e676` | Win, positif |
| Alerte | `#fbbf24` | Warning, odds change |
| Danger | `#ff3856` | Loss, negatif |
| Info | `#29b6f6` | Liens, info |
| Purple | `#ab47bc` | AI, premium |

### 2.3 Fonts

| Charter (legacy) | App réelle | Statut |
|------------------|------------|--------|
| **Poppins** (headings) | **Geist** (sans) | ⚠️ Discordance |
| **Inter** (body) | **Geist** (sans) | ⚠️ Discordance |
| **DM Mono** (mono) | **Geist Mono** (mono) | ⚠️ Discordance |
| — | **Archivo** (scores/display) | Ajouté dans Next.js |

### 2.4 Routes existantes

| Route | Description |
|-------|-------------|
| `/` | Page principale (multi-sport tabs) |
| `/tennis/stats` | Statistiques tennis |
| `/tennis/player/[slug]` | Profil joueur |
| `/tennis/tournament/[slug]` | Tournoi |
| `/results` | Résultats multi-sports |
| `/bankroll` | Gestion bankroll |
| `/bankroll/bets` | Paris actifs |
| `/bankroll/tools` | Outils (Kelly, etc.) |
| `/ligues` | Championnats par pays |
| `/ligues/[country]/[slug]` | Détail ligue |
| `/league/[league_id]/stats` | Stats ligue |
| `/rugby` | Rugby |
| `/setpoint` | Setpoint |

### 2.5 Audits précédents

| Audit | Score | Date | Statut |
|-------|-------|------|--------|
| Impeccable Audit | 17/20 | Juin 2026 | Partial |
| GStack UI/UX | 6.8/10 | Juin 2026 | Partial |
| Pro-Max Audit | 12 anti-patterns | Août 2026 | Non résolu |
| Vercel Guidelines | 8 violations | Août 2026 | ✅ Corrigé |
| Auth Redesign | 10 problèmes | Juin 2026 | En attente GO |

---

## 3. Revue académique & theses scientifiques

### 3.1 Migration de systèmes legacy

**Kwella et al. (2025)** — *"Leaving the Tech Debt Behind"* (SciTePress)
- **Méthodologie** : Étude de cas avec pattern Strangler Fig, framework HEART pour UX
- **Résultats** : Migration graduelle > big-bang. Satisfaction utilisateur : 3.5/10 → 9/10. Tâches 10x plus rapides.
- **Application PariScore** : Valide notre approche de migration incrémentale de `server.js`/`pariscore.html` vers Next.js. Continuer le Strangler Fig, prioriser les pages à fort trafic.

**Böhm & Tien (2026)** — *"Model-Driven Legacy System Modernization"* (arXiv)
- **Méthodologie** : Migration pilotée par modèle avec transformation semi-automatique vers Next.js
- **Résultats** : Les layouts composites bespoke nécessitent une adaptation manuelle. Next.js choisi pour SSR/SSG.
- **Application PariScore** : Confirme Next.js comme cible. Les dashboards de betting complexes (notre cas) nécessitent un travail manuel — pas de raccourci.

### 3.2 Dark Mode & UI sombre

**ACM (2025)** — *"Eye Tracking Study on Dark and Light Themes"*
- **Méthodologie** : Expérience intra-sujets, eye-tracking, NASA-TLX
- **Résultats** : Dark mode → **charge perçue plus basse** pour toutes les complexités. Pour les tâches de **complexité moyenne** (comme l'analyse de dashboards), dark mode → **précision plus élevée, confiance accrue, moins de fixations** (traitement plus efficace).
- **Application PariScore** : Notre thème dark navy est **scientifiquement validé**. Nos utilisateurs comparant des odds et lisant des stats = exactement la zone de complexité moyère.

**Andrew (2026)** — *"Alternative Color Mode Design"* (PhD, 8 études)
- **Méthodologie** : Interviews (29 users), audit (120 apps), ateliers designers
- **Résultats** : Seulement 55% Android / 48% iOS offrent dark mode. L'adaptation doit être élément par élément (pas simple inversion).
- **Application PariScore** : Audit systématique de TOUS les composants pour cohérence dark mode. Pas d'inversion bête — chaque élément doit être adapté.

**Gazit (2025)** — *"The Dark Side of the Interface"* (Ergonomics)
- **Méthodologie** : 173 participants, tests cognitifs
- **Résultats** : Hommes à l'aise avec dark mode.majorité de femmes préfèrent light mode.
- **Application PariScore** : Notre audience (sports betting) est majoritairement masculine → dark mode = bon choix. Offrir un toggle light pour respecter les préférences diverses.

### 3.3 Visualisation de données sportives

**Périn et al. (2018)** — *"State of the Art of Sports Data Visualization"* (EuroVis STAR)
- **Catégories** : Box score (stats), tracking (trajectories), meta-data
- **Tâches** : Présentation, comparaison, prédiction
- **Techniques** : Haute dimension, séries temporelles, réseau, glyphes
- **Application PariScore** : Couvre toutes les catégories. Recommandation : séries temporelles pour mouvement d'odds, haute dimension pour radar joueurs, glyphes pour indicateurs de statut.

**Liu et al. (2025)** — *"InsightChaser"* (IEEE TVCG)
- **Résultats** : Graphe de connaissance + LLM pour lier insights tactiques avec éléments visuels améliore la compréhension.
- **Application PariScore** : Nos panneaux de prédiction bénéficieraient d'annotations visuelles — lier "pourquoi cette prédiction" avec les données visuelles.

**Vuillemot et al. (2013)** — *"SoccerStories"* (IEEE InfoVis)
- **Résultats** : Interface overview+detail pour les phases de jeu. Les analystes disent "n'auraient pas pu écrire d'articles sans cet outil".
- **Application PariScore** : Pages de détail match = overview → drill-down phases → visualisation actions individuelles.

### 3.4 Dashboard UX & hiérarchie de l'information

**IJHCS (2023)** — *"Graphical Features of Interactive Dashboards"*
- **Méthodologie** : Entre-sujets, 5 variantes de dashboards
- **Résultats** : **Plus de features ≠ meilleure performance.** Les dashboards simples (sorties numériques) > dashboards riches en visualisations. **Déconnexion entre perception et performance réelle** — les utilisateurs préfèrent les dashboards complexes même s'ils performent moins bien.
- **Application PariScore** : **Critique**. Ne pas surcharger nos pages stats. Métriques clés en nombres clairs avec hiérarchie. Les graphiques supportent mais ne remplacent pas. **Disclosure progressif** → résumé d'abord, détail à la demande.

**Gonçalves et al. (2026)** — *"Integrating Usability and Data Visualization"*
- **Méthodologie** : Principes de Tufte + SUS
- **Résultats** : SUS 91.25/100, satisfaction 96.4%. Clarté, cohérence, organisation spatiale = clés.
- **Application PariScore** : Appliquer les principes de Tufte : maximiser le ratio data-ink, éliminer le chart junk, utiliser les small multiples pour comparaisons de ligues.

### 3.5 Données temps réel & streaming

**Smashing Magazine (2026)** — *"Designing Stable Interfaces for Streaming Content"*
- **Défis** : Scroll interrompu par auto-scroll, layout shift (conteneurs qui grandissent), fréquence de rendu (DOM thrashing)
- **Solutions** : Buffer updates + batch DOM via `requestAnimationFrame`, `aria-live` pour accessibilité, toggle de contrôle utilisateur
- **Application PariScore** : Nos feeds live font face à ces défis. Batch des mises à jour de score, préserver la position de scroll, timestamps de fraîcheur.

**Chirp/htmx (2026)** — *"SSE Patterns"*
- **4 patterns** : Display-Only Reactive (scores), Client-Managed Surfaces (éditeurs), Streaming Append (logs), One-Shot Mutations (forms)
- **Application PariScore** : Scores = Display-Only Reactive. Odds = Streaming Append. Bet slip = One-Shot Mutation. Boundaries de scope pour éviter que les scores n'écrasent le bet slip.

### 3.6 Betting UX & confiance utilisateur

**Blom (2020)** — *"Persuasive Design in Online Sports Betting"* (Thèse, U. Twente)
- **Méthodologie** : Analyse thématique, 10 entretiens
- **Résultats** : Facilité d'utilisation = driver #1 de rétention. "Si ça prend trop longtemps, quelqu'un pensera que c'est trop longtemps." Les bet builders et odds boostées augmentent l'engagement.
- **Application PariScore** : Flow de pari < 3 taps. Odds boostées clairement mais transparentement. Friction pour les comportements à risque.

**Evangelista (2026)** — *"Addictive UX: Heuristic Evidence"* (Springer LNBI)
- **Méthodologie** : Analyse heuristique de 5 plateformes de gambling
- **Résultats** : 100% convergence sur patterns manipulatifs (renforcement sensoriel, récompenses intermittentes, rareté artificielle). Aucun avertissement responsible gambling.
- **Application PariScore** : **Différenciation par la transparence éthique**. Expliquer les odds, montrer les probabilités réelles, reminders de session. Se positionner comme "la plateforme de prédictions de confiance".

**LeisureWP (2026)** — *"Betting Trust Signal Structure"*
- **Résultats** : La confiance opère au niveau psychologique AVANT l'évaluation mathématique. Poli visuel, cohérence du design = première couche de confiance. Les signaux fragmentés créent une dissonance cognitive.
- **Application PariScore** : Chaque point de contact doit renforcer la confiance. Dark navy + vert néon = cohérent. Odds expliqués. Settlement clair. Status live non ambigu.

### 3.7 Gamification & prédictions

**Vuillemot & Périn (2016)** — *"Sport Tournament Predictions Using Direct Manipulation"* (IEEE CG&A)
- **Méthodologie** : 3,029 utilisateurs, 504K logs d'interaction
- **Résultats** : Manipulation directe (drag-and-drop) > formulaires. Remplissage non-linéaire de brackets correspond à la façon dont les gens pensent. La familiarité (badges, layout brackets) réduit l'apprentissage.
- **Application PariScore** : Interfaces de prédiction doivent supportér la manipulation directe où possible. Les utilisateurs pensent non-linéairement — ils peuvent prédire le gagnant avant de remplir les tours intermédiaires.

**Gupta et al. (2024)** — *"Paying While Playing: Gamification in Fantasy Sports"* (ESMQ)
- **Méthodologie** : Régression linéaire sur données comportementales de 914 utilisateurs
- **Résultats** : Les utilisateurs qui peinent avec les points/badges interagissent PLUS (comportement compensatoire). Progression lente + haute interactivité = plus de dépenses.
- **Application PariScore** : Système de points de prédiction avec progression graduelle. Pas trop facile — la lutte drive l'engagement. Mais l'interface doit être assez engageante pour soutenir cet engagement.

### 3.8 Mobile-first

**Pinhal (2025)** — *"UX in ZeroZero's Mobile Version"* (Thèse, U. Porto)
- **Méthodologie** : SUS, entretiens, Hotjar, 140+ participants
- **Résultats** : Navigation complexe, performances, publicités intrusives = problèmes majeurs. Les utilisateurs tolèrent moins de densité de données sur mobile mais attendent la même fonctionnalité.
- **Application PariScore** : Disclosure progressif sur mobile : cartes résumé → swipe vers détail → stats complètes à la demande. Lazy-load des visualisations lourdes.

---

## 4. Benchmark sectoriel

### 4.1 Classement des sites

| Rang | Site | Score | Points forts | Points faibles |
|------|------|-------|-------------|----------------|
| 1 | **FotMob** | 9/10 | Apple Design Award 2026, Liquid Glass, polish pixel-perfect | Football uniquement |
| 2 | **The Athletic** | 9/10 | Dashboards match/joueur, data viz qualité NYT | Paywall limite la portée |
| 3 | **FanDuel** | 8.5/10 | Meilleur UX sportsbook US, assistant AceAI | US-centric |
| 4 | **SofaScore** | 8/10 | Pitch maps (passes, dribbles, défense), Sofascore Rating | Desktop faible |
| 5 | **Polymarket** | 8/10 | Courbes de probabilité = headlines, design terminal news | Prediction markets uniquement |
| 6 | **DraftKings** | 7.5/10 | Couverture multi-sports | Surcharge cognitive (sportsbook+DFS+casino+loterie) |
| 7 | **ESPN BET** | 7.5/10 | FanCenter (fantasy → bets) | Interface encombrée |
| 8 | **Bet365** | 7/10 | Leader industriel, streaming live | Design daté, très dense |
| 9 | **StatMuse** | 7/10 | Recherche NL (+44x en 3 ans, 0 marketing) | Pas d'intégration betting |
| 10 | **Oddschecker** | 6/10 | Comparaison d'odds | jQuery/ASP.NET, pas de dark mode |
| 11 | **Flashscore** | 6/10 | Couverture live | Fonctionnel mais laid |
| 12 | **Forebet** | 5/10 | Prédictions mathématiques | Design daté, pas de dark mode |
| 13 | **WindrawWin** | 5/10 | Prédictions football | Interface années 2010 |
| 14 | **BetExplorer** | 5/10 | Historique d'odds | Design daté |

### 4.2 Fait marquant

> **Aucun site de betting/prédictions n'a jamais gagné de Webby Award, Awwwards, ou Apple Design Award.** Le marché est entièrement composé d'interfaces fonctionnelles mais laides. C'est une **opportunité massive de différenciation** pour PariScore.

### 4.3 Patterns de design identifiés

| Pattern | Sites | Impact |
|---------|-------|--------|
| Dark mode par défaut | Tous les top-5 | Table stakes — sans ça, pas crédible |
| Visualisation de données interactive | SofaScore, Polymarket, The Athletic | Le **différenciateur** clé |
| Personnalisation (follow teams) | FanDuel, SofaScore | Rétention |
| Simplicité > densité | FotMob (1 sport) vs DraftKings (tout) | Moins = mieux |
| Mobile-first | FanDuel/Bet365 (89-90% mobile) | Non-négociable |
| Assistant IA conversationnel | StatMuse, AceAI | Engagement |
| Animations live | Bet365 (streaming), Polymarket (courbes), Underdog ("The Sweat") | Engagement live |
| Cartes partageables | Underdog | Boucles virales |
| Contenu premium | The Athletic | Modèle payant viable |

### 4.4 Faiblesses du marché

1. **Design daté domine** — Oddschecker, Forebet, WindrawWin, BetExplorer = jQuery/ASP.NET, pas de dark mode
2. **Desktop en retrait** — FotMob, SofaScore, DraftKings ont des produits web desktop plus faibles
3. **Visualisation live sous-utilisée** — La plupart montrent des odds bruts. Seuls Bet365 (streaming), Polymarket (courbes), Underdog (progress bars) animent les données live
4. **IA en surface** — StatMuse fait du NL search mais pas de betting. AceAI est puissant mais fermé
5. **Paywalls limitent la portée** — Les meilleures viz de The Athletic sont derrière un paywall

---

## 5. Audit Vercel Web Interface Guidelines

### 5.1 Résultats par fichier

| Fichier | Résultat | Problèmes |
|---------|----------|-----------|
| `src/app/page.tsx` | ⚠️ 6 findings | transition-all, hover manquant, error boundary vide |
| `src/app/layout.tsx` | ⚠️ 3 findings | theme-color mismatch, suppressHydrationWarning non documenté |
| `src/app/globals.css` | ⚠️ 4 findings | tab-fade-in sans reduced-motion guard |
| `src/components/bet-slip.tsx` | ⚠️ 5 findings | "..." → "…", autoComplete manquant, spellCheck |
| `src/components/consent-banner.tsx` | ⚠️ 4 findings | aria-hidden manquant, focus manquant |
| `src/components/layout/mobile-bottom-nav.tsx` | ⚠️ 2 findings | focus-visible manquant |
| `src/components/dashboard/nav-extra-views.tsx` | ⚠️ 4 findings | hover manquant, focus manquant |
| `src/app/results/page.tsx` | 🔴 8 findings | Async fetch dans useMemo, date format hardcodé, pas de tabular-nums |

### 5.2 Problèmes critiques

1. **`results/page.tsx`** — `fetchMatches()` dans `useMemo()` viole les règles React (fetch async dans le body du render)
2. **`results/page.tsx`** — `toLocaleDateString()` hardcodé au lieu de `Intl.DateTimeFormat`
3. **`bet-slip.tsx`** — "Saving…" avec "..." au lieu de "…" (typographie)
4. **`page.tsx`** — Sport card buttons sans `focus-visible` styles
5. **`globals.css`** — `tab-fade-in` sans guard `prefers-reduced-motion` par élément
6. **`layout.tsx`** — `theme-color: #10b981` (emerald) ne correspond pas au fond dark réel

### 5.3 Patterns manquants

- `aria-busy` sur les zones de skeleton loading
- `loading="lazy"` sur les images below-fold
- Suspense/streaming boundaries pour les composants lents (AIInsightCard, league stats)
- `scroll-margin-top` sur les heading anchors
- Virtualisation des grandes listes (>50 items)

---

## 6. Synthèse des problèmes identifiés

### 6.1 Par sévérité

| Sévérité | Nombre | Exemples |
|----------|--------|----------|
| 🔴 Critique | 3 | Async fetch dans useMemo, theme-color mismatch, pas de pitch maps |
| 🟠 Majeure | 8 | 12 anti-patterns gray-on-color, touch targets < 44px, pas de personnalisation |
| 🟡 Moyenne | 15 | Hover manquant, focus-visible inconsistent, "..." → "…", aria-hidden |
| 🟢 Mineure | 10 | Inconsistent radius, tabular-nums manquant, scroll-margin-top |

### 6.2 Par catégorie

| Catégorie | Problèmes | Impact |
|-----------|-----------|--------|
| **Accessibilité** | Focus rings, aria-labels, touch targets, colorblind support | WCAG violation |
| **Cohérence visuelle** | Gray-on-color, AI slop tells, radius inconsistent, font discordance | Confiance utilisateur |
| **Data visualization** | Pas de pitch maps, pas de courbes d'odds, pas de sparklines | Différenciation |
| **Personnalisation** | Pas de follow teams/players, pas de feed personnalisé | Rétention |
| **Mobile** | Touch targets, navigation, disclosure progressif | 89% du trafic |
| **Performance** | Pas de virtualisation, pas de Suspense, async fetch incorrect | UX |
| **Trust** | Pas d'explication d'odds, pas de transparency signals | Confiance |

---

## 7. Axes d'amélioration

### Axe 1 : Cohérence visuelle & accessibilité (Priorité P0)

**Objectif** : Atteindre 20/20 audit design + WCAG 2.1 AA

| Action | Effet | Effort |
|--------|-------|--------|
| Corriger les 12 anti-patterns gray-on-color | Légibilité, accessibilité | Moyen |
| Harmoniser le font stack (Geist ou Poppins/Inter) | Cohérence branding | Faible |
| Corriger touch targets < 44px | Mobile UX, WCAG | Faible |
| Ajouter `aria-busy` sur skeleton loading | Accessibilité | Faible |
| Corriger theme-color dans layout.tsx | Browser chrome cohérent | Trivial |
| Documenter suppressHydrationWarning | Maintenabilité | Trivial |
| Remplacer "..." par "…" | Typographie | Trivial |
| Ajouter `loading="lazy"` below-fold | Performance | Faible |

### Axe 2 : Data visualization premium (Priorité P1)

**Objectif** : Devenir le FotMob/PolarScale des prédictions

| Action | Inspiré par | Effet |
|--------|-------------|-------|
| Pitch maps interactives (football) | SofaScore | Engagement, différenciation |
| Courbes de probabilité live | Polymarket | "Data = news" paradigm |
| Sparklines odds movement | Bet365 | Décision rapide |
| Radar comparaison joueurs | The Athletic | Analyse visuelle |
| Heatmap d'activité terrain | SofaScore | Drill-down analyste |
| Confidence rings animés | Existant (partiellement) | Feedback visuel |

### Axe 3 : Personnalisation & rétention (Priorité P1)

**Objectif** : Augmenter le temps passé et le retour utilisateur

| Action | Inspiré par | Effet |
|--------|-------------|-------|
| Follow teams/players → feed personnalisé | FanDuel, SofaScore | Rétention |
| Tableau de bord perso avec KPIs favoris | The Athletic | Engagement |
| Notifications ciblées (matchs suivis) | Bet365 | Réactivation |
| Historique de prédictions avec stats | Existant (partiellement) | Fidélisation |

### Axe 4 : Mobile-first optimization (Priorité P1)

**Objectif** : Expérience mobile au niveau de FotMob

| Action | Inspiré par | Effet |
|--------|-------------|-------|
| Bottom sheet detail (au lieu de page séparée) | FotMob | Navigation fluide |
| Swipe entre sports/tabs | SofaScore | Découverte |
| Skeleton loading optimisé | FotMob | Perception de vitesse |
| Pull-to-refresh | Standard mobile | Interaction native |
| Disclosure progressif stats | Pinhal thesis | Charge cognitive |

### Axe 5 : Trust & transparence éthique (Priorité P2)

**Objectif** : Se positionner comme "la plateforme de confiance"

| Action | Inspiré par | Effet |
|--------|-------------|-------|
| Expliquer chaque type d'odds | Evangelista 2026 | Éducation |
| Transparency score (fraîcheur des données) | LeisureWP 2026 | Confiance |
| Session time reminder | Responsible gambling | Éthique |
| Win probability clar (pas de dark patterns) | Evangelista 2026 | Différenciation |
| Glossaire interactif des termes betting | UX research | Onboarding |

---

## 8. Axes d'innovation

### Innovation 1 : IA conversationnelle de stats (StatMuse-like)

**Concept** : Un assistant IA qui répond en langage naturel aux questions sportives et génère directement des paris.

**Inspiré par** : StatMuse (+44x en 3 ans, 0 marketing), FanDuel AceAI

**Fonctionnalités** :
- "Quel est le record de Djokovic sur terre battue en 2026 ?" → Réponse + viz + pari suggéré
- "Comparaison Haaland vs Mbappé cette saison" → Radar + comparaison
- "Matchs où le favori a perdu cette semaine" → Liste + analyse

**Différenciation** : StatMuse ne fait pas de betting. FanDuel AceAI est fermé. PariScore peut être le **premier assistant IA ouvert** qui combine deep stats + prédictions + betting.

### Innovation 2 : Courbes de probabilité comme "news"

**Concept** : Chaque changement significatif de prédiction = une "news" visuelle avec courbe.

**Inspiré par** : Polymarket (probability curves as headlines)

**Fonctionnalités** :
- Courbe de probabilité live pour chaque match (Markov engine)
- Alertes quand la probabilité bouge de >X%
- "Historique de prédiction" = timeline visuelle
- Partage de courbes sur les réseaux sociaux

**Différenciation** : Personne dans le betting ne fait des courbes de probabilité comme Polymarket fait pour les marchés de prédiction.

### Innovation 3 : Cartes de prédictions partageables

**Concept** : Chaque prédiction peut être exportée en image partageable sur les réseaux.

**Inspiré par** : Underdog Fantasy (winning slip design), Twitter/X card sharing

**Fonctionnalités** :
- Card design premium avec branding PariScore
- Score de confiance visible
- QR code vers la prédiction complète
- Template par sport (football, tennis, etc.)

**Différenciation** : Boucles virales gratuites. Chaque partage = pub pour PariScore.

### Innovation 4 : Dashboard analyste (The Athletic-like)

**Concept** : Vue approfondie pour chaque match avec toutes les données et visualisations.

**Inspiré par** : The Athletic dashboards, SofaScore pitch maps

**Fonctionnalités** :
- Vue d'ensemble → drill-down phases → actions individuelles (SoccerStories pattern)
- Pass networks, shot maps, momentum timeline
- Comparaison H2H avec visualisations
- Scénarios de match (simulation Monte Carlo)

**Différenciation** : Aucun site de betting gratuit n'offre une data viz de qualité The Athletic.

### Innovation 5 : Design éthique comme USP

**Concept** : Utiliser la transparence et l'éthique comme élément de design différenciant.

**Inspiré par** : Evangelista 2026 (100% des plateformes utilisent des dark patterns)

**Fonctionnalités** :
- Pas de dark patterns (pas d'artificial scarcity, pas de fake social proof)
- Explication de chaque odd (comment il est calculé)
- Session time reminders
- Reality check périodique (somme mise en jeu, win/loss réel)
- Accès facile aux outils responsible gambling

**Différenciation** : Dans un marché où 100% des plateformes sont manipulatrices, être éthique = être unique.

---

## 9. Plan de refonte design

### Phase 1 : Fondations (Semaines 1-2)

**Objectif** : Nettoyer les bases, atteindre 20/20 audit

| Tâche | Priorité | Effort | Fichiers |
|-------|----------|--------|----------|
| Corriger 12 anti-patterns gray-on-color | P0 | Moyen | baseball, cycling, F1, sidebar, rugby |
| Harmoniser font stack (choisir Geist OU Poppins) | P0 | Faible | layout.tsx, tailwind.config.ts |
| Corriger touch targets < 44px | P0 | Faible | predictive-bets, most-aces-compare, pip-bet-panel |
| Corriger theme-color dans layout.tsx | P1 | Trivial | layout.tsx |
| Remplacer "..." par "…" partout | P1 | Trivial | bet-slip, globals |
| Ajouter `aria-busy` sur skeleton loading | P1 | Faible | Composants skeleton |
| Ajouter `loading="lazy"` below-fold | P1 | Faible | page.tsx, results |
| Corriger async fetch dans results/page.tsx | P0 | Moyen | results/page.tsx |
| Ajouter `Intl.DateTimeFormat` pour dates | P1 | Faible | results, pages avec dates |
| Documenter suppressHydrationWarning | P2 | Trivial | layout.tsx |

### Phase 2 : Data Visualization Premium (Semaines 3-4)

**Objectif** : Devenir le meilleur en visualisation de données sportives

| Tâche | Priorité | Effort | Inspiré par |
|-------|----------|--------|-------------|
| Sparklines odds movement sur cartes match | P1 | Moyen | Bet365 |
| Courbes de probabilité live (Markov) | P1 | Élevé | Polymarket |
| Radar comparaison joueurs/équipes | P1 | Moyen | The Athletic |
| Confidence rings avec animation | P2 | Faible | Existant |
| Heatmap d'activité terrain (football) | P2 | Élevé | SofaScore |
| Odds history timeline | P2 | Moyen | Oddschecker |

### Phase 3 : Personnalisation & Rétention (Semaines 5-6)

**Objectif** : Augmenter le temps passé et le retour

| Tâche | Priorité | Effort | Inspiré par |
|-------|----------|--------|-------------|
| Follow teams/players | P1 | Élevé | FanDuel, SofaScore |
- Feed personnalisé "Pour toi" | P1 | Élevé | FanDuel |
| Tableau de bord perso avec KPIs | P2 | Moyen | The Athletic |
| Notifications ciblées | P2 | Moyen | Bet365 |
| Historique de prédictions avec stats | P2 | Faible | Existant |

### Phase 4 : Mobile-first & UX (Semaines 7-8)

**Objectif** : Expérience mobile au niveau FotMob

| Tâche | Priorité | Effort | Inspiré par |
|-------|----------|--------|-------------|
| Bottom sheet detail match | P1 | Moyen | FotMob |
| Swipe entre sports/tabs | P1 | Faible | SofaScore |
| Pull-to-refresh | P1 | Faible | Standard |
| Skeleton loading optimisé | P2 | Faible | FotMob |
| Disclosure progressif stats | P2 | Moyen | Pinhal thesis |
| Cartes de prédictions partageables | P1 | Moyen | Underdog |

### Phase 5 : Innovation & Polish (Semaines 9-10)

**Objectif** : Différenciation par l'innovation

| Tâche | Priorité | Effort | Inspiré par |
|-------|----------|--------|-------------|
| IA conversationnelle de stats | P2 | Élevé | StatMuse |
| Dashboard analyste (overview+detail) | P2 | Élevé | The Athletic |
| Design éthique (transparence odds) | P1 | Moyen | Evangelista 2026 |
| Playwright E2E 20+ tests | P1 | Élevé | P5 refonte |
| Lighthouse audit | P2 | Faible | Performance |
| WCAG 2.1 AA full audit | P2 | Moyen | Accessibilité |

### Timeline résumé

```
Semaines 1-2  : [Fondations] Nettoyage, cohérence, accessibilité
Semaines 3-4  : [Data Viz] Sparklines, courbes, radars, heatmaps
Semaines 5-6  : [Personnalisation] Follow, feed, dashboard perso
Semaines 7-8  : [Mobile] Bottom sheet, swipe, skeletons, partage
Semaines 9-10 : [Innovation] IA, analyste, éthique, QA
```

### Métriques de succès

| Métrique | Actuel (estimé) | Cible |
|----------|-----------------|-------|
| Audit design score | 17/20 | 20/20 |
| Lighthouse Performance | ~70 | 90+ |
| WCAG 2.1 AA | Partiel | Complet |
| Temps moyen session | Inconnu | +30% |
| Taux de retour J7 | Inconnu | +20% |
| Partages sociaux/mois | 0 | 1000+ |
| App Store rating (APK) | N/A | 4.5+ |

---

## 10. Annexes

### A. Sources académiques citées

1. Kwella et al. (2025) — "Leaving the Tech Debt Behind" — SciTePress
2. Böhm & Tien (2026) — "Model-Driven Legacy System Modernization" — arXiv
3. ACM (2025) — "Eye Tracking Study on Dark and Light Themes"
4. Andrew (2026) — "Alternative Color Mode Design" — PhD Dissertation
5. Gazit (2025) — "The Dark Side of the Interface" — Ergonomics
6. Périn et al. (2018) — "State of the Art of Sports Data Visualization" — EuroVis STAR
7. Liu et al. (2025) — "InsightChaser" — IEEE TVCG
8. Vuillemot et al. (2013) — "SoccerStories" — IEEE InfoVis
9. IJHCS (2023) — "Graphical Features of Interactive Dashboards"
10. Gonçalves et al. (2026) — "Integrating Usability and Data Visualization"
11. Smashing Magazine (2026) — "Designing Stable Interfaces for Streaming Content"
12. Chirp/htmx (2026) — "SSE Patterns"
13. Blom (2020) — "Persuasive Design in Online Sports Betting" — U. Twente
14. Evangelista (2026) — "Addictive UX" — Springer LNBI
15. LeisureWP (2026) — "Betting Trust Signal Structure"
16. Vuillemot & Périn (2016) — "Sport Tournament Predictions" — IEEE CG&A
17. Gupta et al. (2024) — "Paying While Playing: Gamification" — ESMQ
18. Pinhal (2025) — "UX in ZeroZero's Mobile Version" — U. Porto
19. Atlantis Press (2023) — "Interface Design of Sports App" — ICIDIT
20. Du & Yuan (2021) — "Task-Driven Visualization Selection" — Journal of Visualization

### B. Sites benchmarkés

FotMob, The Athletic, FanDuel, SofaScore, Polymarket, DraftKings, ESPN BET, Bet365, StatMuse, Oddschecker, Flashscore, Forebet, WindrawWin, BetExplorer, Underdog Fantasy, FiveThirtyEight/ABC, BetExplorer

### C. Audits précédents analysés

- `audit-design-report.md` (Impeccable, 17/20)
- `.context/audits/ui-ux-audit-20260618.md` (GStack, 6.8/10)
- `.context/audits/ui-ux-pro-max-audit-20260818.md` (12 anti-patterns)
- `.context/audits/vercel-web-interface-guidelines-audit-2026-08-19.md` (8 violations corrigées)
- `.context/audit-auth-redesign-2026-06-18.md` (Auth modal, en attente GO)
