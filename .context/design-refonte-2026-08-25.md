# Rapport Design — Refonte visuelle PariScore

**Date** : 2026-08-25
**Périmètre** : analyse concurrentielle secteur paris sportifs / data sportive, recommandations design system, préparation de l'implémentation refonte homepage + langage visuel.
**Sources** : webfetch live (OddAlerts, Sofascore, Forebet, 21st.dev) + connaissances secteur + skill `ui-ux-pro-max` + codebase actuel.

---

## 1. Synthèse exécutive

Le marché des paris sportifs et de la donnée sportive se divise en **4 philosophies visuelles** distinctes :

| Philosophie | Incarné par | Verdict pour PariScore |
|---|---|---|
| **Casino/Bookmaker** (surcharge promotionnelle) | Winamax, Betclic, Unibet, Bet365, Stake | ❌ À éviter — bruit visuel, pop-ups, pression psychologique. Antithèse de la promesse "data-driven" |
| **Scoreboard utilitaire** (densité maximale, zéro émotion) | Flashscore, Forebet, PredictZ, Soccerstats | ⚠️ Partiellement — densité justifiée sur les tables, mais esthétique 2010 et pubs tuent le premium |
| **Data-product moderne** (live-first, ratings chiffrés, dataviz riche) | Sofascore, FotMob, OneFootball | ✅ **Modèle principal** — le standard 2025 : dark natif, ratings 0–10, momentum graphs, cards aérées |
| **Dev-tool dashboard** (Linear/Stripe-like) | StatsBomb, Opta Analyst, kits 21st.dev (shadcn) | ✅ **Modèle secondaire** — PariScore est déjà sur ce stack (Next 16 + shadcn + Tailwind 4) : c'est la voie naturelle pour écraser les concurrents FR vieillissants |

### Le positionnement gagnant
> *"OddAlerts avec le polish de Linear et l'exigence dataviz de Sofascore"*

**OddAlerts** est le concurrent direct le plus dangereux (même promesse : AI predictions + value bets + 3000 ligues). Son UI reste un dashboard utilitaire 2018. Son erreur fatale : l'**empilement de 7 sections identiques** (Value Bets / AI Predictions / Home / Away / BTTS / Over 2.5 / Corners) avec le même pattern "5 lignes + bouton + capture email" — fatigue visuelle garantie. PariScore peut gagner par une seule chose : **une hiérarchie visuelle irréprochable et un langage "terminal Bloomberg du foot"** en dark navy + vert néon.

### Ce que PariScore a déjà (avantages compétitifs existants)
- Stack Next.js 16 + Tailwind 4 + shadcn (~50 composants) — déjà aux standards Linear/Stripe
- framer-motion 12.23.2 installé et utilisé dans 18 fichiers
- Token system OKLCH cohérent (`DESIGN_CHARTER.md` v1.0)
- Données propriétaires : 1582 championnats scrappés, rankings Home/Away, value bets, Edge %, PowerScore

### Ce qui manque (les gaps à combler)
- **Aucune landing marketing** — la homepage `/` est directement le dashboard SPA
- Sections visuellement indifférenciées (vs la monotonie OddAlerts)
- Pas d'imagerie sportive structurée (logos OK, mais aucun hero impactant)
- Vert néon parfois sur-utilisé → perte du pouvoir de signal
- Absence de "big number" hero (le pattern #1 du secteur)

---

## 2. Analyse concurrentielle par catégorie

### 2.1 Bookmakers (à NE PAS copier, sauf 3 patterns)

| Site | Palette | Typo | Traitement cotes | À piquer | À fuir |
|---|---|---|---|---|---|
| **Winamax** | Dark `#1a1a2e` + rouge `#e2001a` + jaune CTA | Sans condensed, display énorme | Boxes gris, boostées rouge/jaune | Badges "cote boostée", branding fort | Surcharge promo, banners rotatives, pop-ups |
| **Betclic** | Blanc + rouge `#e63312` | Sans humaniste ronde | Pills blanches bordure | Lisibilité marchés | Light mode fatiguant |
| **Unibet** | Gris `#f2f2f2` + vert `#00a826` | Sans neutre data | Cases vertes verticales 1-N-2 | Densité scannable, coupon sticky | Zéro émotion |
| **Bet365** | Vert bouteille `#126e51` + jaune `#ffdf1b` | Condensed MAJUSCULES | Grille dense, **flash jaune** au changement | La **flash animation 200–400ms** — le pattern live le plus consensuel | Cassé mobile, zéro dataviz |
| **Stake** | Navy `#0f212e` + arrondis généreux | Inter géométrique | Pills arrondies large radius, hover glow | **Meilleur dark mode du secteur** : cercles de confiance, radius généreux, glow subtil | Tout orienté casino, non adapatable FR régulé |

**Pattern universel bookmaker** : la cote est un **bouton**, jamais un texte. Flash vert/rouge/jaune 200–400ms sur changement = LA micro-interaction du secteur. `tabular-nums` obligatoire pour éviter le scintillement.

### 2.2 Sites de stats & prédictions foot (nos vrais concurrents)

| Site | Palette | Pattern signature | Points forts | Erreurs |
|---|---|---|---|---|
| **Forebet** | Blanc + bleu `#1a5fb4` + vert predict `#4caf50` | **Table dense proba 1X2** avec mini-barres intégrées + score correct | Le modèle proba en ligne scannable = le plus efficace du marché. Badges W/D/L circulaires | Design figé 2015, pubs, tap targets minuscules, 0 dark mode |
| **OddAlerts** | Sombre bleuté `#141b2d` + cyan/vert | **5-picks par section** : match + marché + "Edge X%" avec grand % de confiance | Produit concentré sur le signal (value, edge, streaks), bonne IA de contenu | **Monotonie des sections** (×7 le même layout), zéro dataviz au-delà du %, email-catch agressif |
| **Footystats** | Dark navy + bleu + vert/rouge | **Dashboard de cards-stat** (PPG, xG, BTTS%) | Le plus proche de PariScore : KPI cards + tables moyennes + marchés (O15, O25, BTTS) | Paywall agressif, murs de chiffres sans respiration |
| **Soccerstats** | Bleu pâle/jaune | Tables multi-onglets (Home/Away, streaks) | Data d'exhaustivité imbattable | Esthétique 2008 |

### 2.3 Apps de scores / live data (la référence UX 2025)

| Site | Palette | Dataviz signature | Ce qu'il fait de mieux |
|---|---|---|---|
| **Sofascore** | Light `#fff` / dark `#23272e` + accent bleu `#0866ff` + vert live `#37d67a` | **Sofascore Rating** (gradient rouge→vert 0–10), **Attack Momentum Graph** (histogramme temps réel), pitch heatmaps, xG par buteur | La référence absolue : auto-update sans refresh, tabs Fixtures/Standings/Stats, "Compare players", zéro pub intrusive |
| **Flashscore** | Anthracite + vert vif `#00dd87` + rouge scores | **Score flash rouge/vert** sur but, colonnes ultra-denses | Vitesse d'update légendaire |
| **FotMob** | Light + bleu `#1e88e5`, dark propre | **Shotmap** (pastilles sur terrain), lineups visuels sur pitch | Le plus "produit aimé", micro-interactions soignées |
| **OneFootball** | Noir profond + rose vif `#ff1e56` | Moins dataviz, plus éditorial | Branding puissant, storytelling |

**Pattern transversal live-apps** : **score display 2xl + minute pulsante + badge LIVE avec halo** ; tabs horizontaux sous le header match ; update WebSocket invisible (skeleton seulement au premier chargement, jamais de spinner ensuite).

### 2.4 Data-dashboards modernes (Linear/Stripe appliqués au sport)

- **Opta / StatsBomb** : dataviz SVG sur-mesure (radar, pass networks, freeze-frames annotés) — le sur-mesure est un différenciateur de marque
- **Linear** : background `#08090a`, bordures `rgba(255,255,255,.08)`, radius 8–12, texte secondaire opacité 60%, **aucun box-shadow lourd**, spacing 4pt strict, Inter `-0.02em` sur gros titres
- **Stripe** : hero avec compteur triple de métriques (exactement ce qu'OddAlerts fait : "142,137+ members / 3,000+ leagues / 57M+ records")

**Règle d'or volée à Linear** : **l'accent n'apparaît que sur ≤ 5% des pixels** (CTA, liens actifs, indicateurs). C'est exactement ce que PariScore doit faire avec `#00e676`.

---

## 3. Recommandation design system PariScore

### 3.1 Palette (conservée + affinée)

| Rôle | Hex / valeur | Commentaire |
|---|---|---|
| Background principal | `#0a0f1c` (navy presque noir) | Plus profond que l'actuel si besoin — réf. Linear/Stake |
| Surface cards | `#111827` → `rgba(255,255,255,.03)` | Séparation par bordure plutôt qu'ombre |
| Bordures | `rgba(148,163,184,.12)` | Slate translucide |
| Texte primaire | `#e6edf3` | |
| Texte secondaire | `rgba(230,237,243,.60)` | Opacité 60%, pas un gris codé |
| **Accent / signal positif** | **`#00e676`** (conservé) | UNIQUEMENT : value bets, W, confiance haute, cote en hausse, live pulse, CTA primaire |
| Négatif / perte / dropping | `#ff4d5e` | Paires de l'accent en dataviz |
| Neutre / draw / info | `#ffd166` (warning) / `#7aa2ff` (info) | Bleu = info, jaune = warning |
| Live | `#00e676` + animation pulse | Cohérence marque : "vert vivant" |

> **Audit à faire** : compter la surface de pixels `#00e676` sur la homepage actuelle, objectif ≤ 5%.

### 3.2 Typographie

- **Display / scores / big numbers** : même famille que le body gras 700, `letter-spacing: -0.03em`, `tabular-nums` — pas de seconde police display
- Si ajout de caractère "néon tech" : **Space Grotesk** (déjà suggéré par le skill, mood dashboard/analytics)
- **Data** : `font-variant-numeric: tabular-nums` obligatoire sur toutes les cellules de cotes/probas
- Échelle : 12 (meta) / 13 (table) / 14 (body) / 20 (scores) / 32–48 (KPI hero)

### 3.3 Dataviz minimale à standardiser (kit maison SVG ou Recharts)

1. **Form strip** = 5 pastilles W/D/L (vert/jaune/rouge) — pattern universel, ne pas réinventer
2. **Probability split-bar 1X2** = 3 segments horizontaux (vert home / gris draw / bleu away) avec % inline — remplace avantageusement le tableau de % Forebet
3. **Momentum / xG chart** = histogramme temps réel (cf. Sofascore)
4. **Confidence meter** = anneau ou barre fine avec % (méthode Stake, pas juste texte)
5. **Sparklines PPG/xG rolling** dans les tables de ligues — données déjà présentes (`league_season_stats`, `homeaway` pipeline)
6. **Pitch shotmap/heatmap** = phase 2 (requiert données xG chronologiques)

---

## 4. Dix recommandations actionnables

1. **Composant `MatchRow` canonique** unique (logo équipe + nom + score/minute + 3 pills cotes + form strip) réutilisé sur fixtures, live, résultats, ligues. Pattern #1 du secteur — Sofascore/Flashscore/Bet365 partagent exactement ce layout. Harmoniser avec l'actuel `league-fixtures-list`.

2. **Réserver `#00e676` aux signaux** (value bet, win, confiance ≥ seuil, live) et passer tout le chrome (boutons neutres, icônes, bordures) en slate translucide. Le vert est un signal, pas un fond.

3. **Hero homepage = triple compteur + "Bet du Jour" encadré** (pattern OddAlerts Daily Double amélioré) : cote totale en display 32px vert, EV% en badge, un seul CTA. Supprimer l'empilement de sections identiques : **une seule section par marché, chacune avec sa couleur sémantique et sa mini-dataviz** (BTTS = barres doubles, Corners = icône + histogramme, Over 2.5 = jauge).

4. **Pills de cotes cliquables avec flash 250ms** sur changement (vert en hausse, rouge en baisse) + `tabular-nums` + `min-width: 64px` anti-reflow. Flèche `▲▼` subtile sur `dropping-odds`.

5. **Tables de ligue avec sparklines** : sur `/ligues/[country]/[slug]` (1582 championnats déjà en base), ajouter sparkline PPG/GF-GA par équipe dans la colonne droite. C'est exactement ce qui manque à Footystats/OddAlerts — différenciateur à coût quasi nul.

6. **Score live : minute pulsante** (`animate-pulse` sur le texte minute), score en display, badge "LIVE" vert avec halo `box-shadow: 0 0 12px rgba(0,230,118,.4)`. Skeleton loaders au premier chargement, **jamais de spinner** sur refresh WebSocket.

7. **Zéro photo de joueur/stade dans les vues data** — uniquement logos d'équipes (déjà crawlés) et drapeaux pays. Réserver l'imagerie éditoriale aux pages contenu/blog. OneFootball montre que l'éditorial photo = cluster émotionnel séparé du data.

8. **Navigation match = tabs horizontaux sticky** (Aperçu / Stats / Forme / Cotes / H2H) sous un header match fixe — pattern FotMob, éprouvé mobile-first, utile aussi pour l'APK Capacitor.

9. **Composant `ConfidenceBadge` standardisé** : pill `border-00e676/30 bg-00e676/10 text-00e676` pour haute, déclinaisons grise/rouge. **Une seule sémantique** : % = probabilité modèle, "Edge +X%" = value vs marché. Ne jamais confondre (OddAlerts mélange parfois visuellement les deux).

10. **Toggle "Compact / Confort"** stocké en local. Les parieurs habitués veulent la table dense Forebet/Bet365 ; les nouveaux veulent des cards aérées. Ne pas trancher à leur place.

**Anti-patterns à proscrire** : pop-up email au premier scroll, banners promo rotatives, pubs display entre lignes de scores, carrousels auto-rotatifs, couleurs d'accent multiples, gros box-shadows en dark mode.

---

## 5. Templates 21st.dev — ce qui est récupérable

Fetch du catalogue `21st.dev/community/templates` (28 templates) : **aucun template sport/betting**, mais plusieurs shells transférables à PariScore (React + Next.js + shadcn, stack identique).

**Directement récupérables** :

| Ressource | Accès | Coût |
|---|---|---|
| Browse templates | https://21st.dev/r | Gratuit |
| Magic MCP (`npx @21st-dev/magic`) | `bunx @21st-dev/magic@latest` (installable local) | Freemium |

**Workflow** : installer le Magic MCP dans `.mcp.json` puis demander à l'agent *« génère une hero section 21st.dev style dark vertical hero + tribune pour PariScore »*. Le MCP agit comme proxy : il pioche dans le registre de templates publiés et génère un composant propre avec tokens Tailwind.

**Pour la refonte** : garder les pipes SSE/WebSocket (live + `startPeriodicUpdate`) intacts, mais réécrire la présentation pour coller à un template dark SaaS de 21st.dev (sections : hero, features grid, social proof, CTA).

---

## 6. Décision fusionnée (ui-ux-pro-max + secteur)

Le skill ui-ux-pro-max (`--design-system "sports betting predictions data analytics dark professional"`) recommande :

- **Style retenu** : Glassmorphism
- **Pattern landing retenu** : Real-Time / Operations Landing (séquence : hero live preview → key metrics → how it works → CTA)
- **Palette générée** : Slate `#1E293B` primary / Vert `#22C55E` accent / Navy `#0F172A` background
- **Typo suggérée** : Fira Code (data/mono) + Fira Sans (body) — mood "dashboard, analytics, technical, precise"

**Convergence avec l'existant PariScore** : la recommandation du skill rejoint presque exactement la charte actuelle. Les deltas marginaux :

| Token | Skill propose | PariScore actuel | Arbitrage |
|---|---|---|---|
| Background | `#0F172A` (slate-900) | `#0a0e17` (bg-deep) | Conserver `#0a0e17` (plus profond, plus distinctif) |
| Accent | `#22C55E` (green-500) | `oklch(0.77 0.19 162)` ≈ `#00e676` | Conserver `#00e676` (plus néon, signal fort) |
| Typo | Fira Code / Fira Sans | Geist / Geist Mono / Archivo | Ajouter **Space Grotesk** en display optionnel au lieu de changer Fira |

---

## 7. Implémentation — recommandation d'architecture

### 7.1 Ce qui existe déjà (à ne pas reconstruire)

- `src/app/layout.tsx` : providers déjà complets (ThemeProvider dark forcé, NextIntl, Consent, Sentry, **AppMotionConfig framer-motion**, etc.)
- `src/app/page.tsx` : SPA client avec sidebar sport + vues onglets
- Tokens CSS vars dans `globals.css` (dark navy + `--color-neon` vert)
- framer-motion déjà importé dans 18 fichiers (score-flash, confidence-ring, momentum-dr, kpi-strip...)
- `DESIGN_CHARTER.md` v1.0 avec règles strictes (pas d'ombres lourdes, radius, z-index tiers)

### 7.2 Les manques critiques à combler (par ordre d'impact)

| Rang | Élément | Où | Effort |
|---|---|---|---|
| 1 | **Hero section landing-style** (compteur + bet du jour) | `src/app/page.tsx` ou composant dédié | Moyen |
| 2 | **`MatchRow` canonique** unifié | `src/components/match/match-row.tsx` (à créer) | Moyen |
| 3 | **Sparklines dans tables ligues** | `src/components/league-standings-table.tsx` (à modifier) | Faible |
| 4 | **ConfidenceBadge standardisé** | `src/components/ui/confidence-badge.tsx` (existe partiellement) | Faible |
| 5 | **Flash animation sur changement de cote** | Utilitaire `use-odds-flash.ts` + composant pill | Faible |
| 6 | **Toggle Compact/Confort** | Store Zustand + classes CSS densité | Moyen |

### 7.3 Images sportives (suggérées)

Pour le hero et les features. Sources Unsplash (libres de droits) :

- **Hero paris sportifs** : stade de nuit + lumières vertes — `https://images.unsplash.com/photo-1489944440615-453fc2b6a9a9` (stade)
- **Data sportive** : gros plan graphique écran trading — `https://images.unsplash.com/photo-1543286386-713bdd548da4`
- **Football live** : pelouse + ballon — `https://images.unsplash.com/photo-1522778119026-d647f0596c20`
- **Tennis** : raquette + court — `https://images.unsplash.com/photo-1554068865-24cecd4e34b8`
- **Action basket** : joueur en dunk — `https://images.unsplash.com/photo-1546519638-68e109498ffc`

*(À remplacer par des assets propres ou des générations IA custom après validation)*

---

## 8. Livrable

Ce rapport est le plan d'implémentation. La suite recommandée :

1. ✅ Analyse concurrentielle faite (ce document)
2. ⏭️ Implémenter la nouvelle hero section + MatchRow + flash animations (voir section 7)
3. ⏭️ Auditer usage du vert `#00e676` (objectif ≤5% des pixels)
4. ⏭️ Ajouter sparklines ligues
5. ⏭️ QA visuelle avec `web-design-guidelines` skill

---

*Généré via PariScore agent + skill ui-ux-pro-max + analyse Sofascore/OddAlerts/Forebet/21st.dev.*
