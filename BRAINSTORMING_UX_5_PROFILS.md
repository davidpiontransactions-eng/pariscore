# BRAINSTORMING UX — 5 Profils d'Experts sur Pariscore

## Contexte : Design Pariscore (inféré de la charte + plan d'implémentation)

### Écran A — Pré-Match
Header joueur vs joueur avec mini-photos, surface, tournoi. En dessous : blocs métriques clés (SRV_PTS_WON_S, RET_PTS_WON_S, ELO_SURFACE, PRESSURE_INDEX) sous forme de cartes avec valeurs EWMA. Cote estimée vs cote bookmaker. Recommandation de pari (vert si value). Onglets pour basculer entre "Stats", "H2H", "Forme".

### Écran B — Live
Header live avec score évolutif, set, jeu en cours. Timeline de momentum (graphique). Métriques live en temps réel (SRV_ADV_live, PRESSURE_INDEX, MOMENTUM_live). Proba évolutive. Recommandation live. Badge orange LIVE qui pulse.

### Écran C — H2H
Tableau des confrontations directes filtré par surface + année. Cartes métriques comparatives côte-à-côte (SRV_PTS_WON, RET_PTS_WON, BP_CONV, BP_SAVED). Graphique de tendance H2H dans le temps. Poids temporel (matchs récents = plus gros).

### Charte Graphique
- Fond: #0b0e17 à #0e121e (bleu nuit profond)
- Cards: #131722 à #161c2a (légèrement plus clair)
- Texte: #ffffff / #94a3b8 / #707e94 (hiérarchie blanche → grise)
- Vert action: #00e676
- Bleu sélection: #0077ff + box-shadow glow
- Orange LIVE: #ff3d00
- Bordures: rgba(255,255,255,0.05)
- Typo: Inter/Roboto/Poppins (800, 700, 600, 400)
- Coins: 8px (cards), 6px (buttons), 4px (badges)

---

# PROFIL 1 — "Le Parieur Pro Multi-Plateforme"

Utilise quotidiennement : **Betfair Exchange, Pinnacle, Matchbook, Smarkets**

## A. Analyse des Concurrents

| Site | Ce qui est BIEN | Ce qui est MAL |
|------|-----------------|----------------|
| **Betfair Exchange** | API ultra-rapide, profondeur de marché, annulation partielle, cash-out dynamique | UI vieillissante (2010), design surchargé, navigation confuse, pas de stats tennis avancées |
| **Pinnacle** | Cotes les plus justes du marché, faible marge (<2%), limite haute, pas de restriction | Design fonctionnel mais moche, zéro data tennis, zéro analytics, pas de live enrichi |
| **Matchbook** | Commission réduite, UI plus moderne que Betfair, rafraîchissement rapide | Peu de liquidité tennis, pas de stats, pas de H2H, pas de mobile app digne |

**Ce qui manque à TOUS :**
- Aucune plateforme ne propose d'analytics tennis directement dans l'interface de pari
- Il faut ouvrir Tennis Abstract + Flashscore + Betfair en parallèle (3 fenêtres)
- Pas de recommandation de value basée sur des métriques réelles
- Le timing de prise de cote est un guess, pas aidé par la data

## B. Réaction — Écran Pré-Match

### ✅ Ce qui plaît
- "Le fait d'avoir SRV_PTS_WON_S et RET_PTS_WON_S directement dans la card de match, c'est EXACTEMENT ce qu'il me manque sur Betfair. Je perds 30 secondes par match à aller chercher ça sur Tennis Abstract."
- "La puce VERTE 'VALUE' sur la cote estimée — si c'est bien calibré, c'est un énorme accélérateur."

### ❌ Ce qui ne va pas
- **Pas de cote Pinnacle en référence.** La recommandation value sans la cote Pinnacle à côté, c'est incomplet. Pinnacle est la référence du marché. Il faut afficher "Cote marché" (Betfair/Pinnacle) vs "Cote estimée Pariscore".
- **Pas de profondeur de marché.** En pré-match, je veux voir si la cote bouge. Un flux de cotes sur les dernières 24h est indispensable.
- **Pas de liquidité indiquée.** Betfair affiche le montant disponible à chaque cote. Pariscore ne montre rien. Une cote à 2.0 avec 50€ de liquide c'est inutilisable.
- **Métriques pas cliquables.** Je veux cliquer sur SRV_PTS_WON_S pour voir l'évolution sur les 5 derniers matchs. Là c'est un chiffre statique.

### 💡 Propositions concrètes
1. **Ajouter un mini-graphique "Cote Flow"** à côté de la cote (dernières 24h, tendance : montée/descente/stable)
2. **Afficher la liquidité estimée** (faible/moyenne/élevée) ou le montant exact si API Betfair
3. **Rendre les métriques cliquables** → drawer latéral avec détail EWMA par match
4. **Ajouter un compteur "Temps avant le match"** avec seuil : si < 2h, les cotes bougent vite
5. **Afficher la cote Pinnacle en gris** à côté de la cote Betfair en bleu → "Marché: 1.85 / Estimée: 2.10 → VALUE"

## C. Réaction — Écran Live

### ✅ Ce qui plaît
- "Le PRESSURE_INDEX en direct, c'est un truc que Betfair ne montre pas et qui pourrait être un vrai edge."
- "La jauge de proba évolutive, si elle réagit au point près, ça peut remplacer mon intuition de trader."

### ❌ Ce qui ne va pas
- **Trop de chiffres, pas assez de synthèse.** En live, je n'ai pas le temps de scanner 8 métriques. Je veux UN chiffre : la proba. Et éventuellement 2-3 indicateurs de direction.
- **Pas d'alerte de swing.** Si le momentum change brusquement, je veux une notification VISUELLE (pas un email). Un flash rouge/vert sur l'écran.
- **Pas de comparaison cote live.** En live, les cotes Betfair bougent à chaque point. Si Pariscore ne les affiche pas en temps réel, le live screen est mort-né.
- **Le graphique momentum est trop petit.** Sur un 27" c'est lisible. Sur un portable en meeting, c'est illisible.

### 💡 Propositions concrètes
1. **Mode "Trader"** : un toggle qui cache tout sauf la proba évolutive, la cote Betfair live, et un indicateur vert/rouge (value ou pas)
2. **Swing Alert** : quand le PRESSURE_INDEX ou MOMENTUM_live dépasse un seuil → le fond de la card clignote 1 seconde
3. **Agrandir le graphique momentum** en mode focus (pleine largeur)
4. **Afficher l'écart proba/cote en temps réel** : "Écart: +8.2%" en vert
5. **Timer de point** : depuis combien de temps le point dure ? Un long rally ≠ un ace. Contexte important.

## D. Réaction — Écran H2H

### ✅ Ce qui plaît
- "Le filtrage par surface est la base. Le fait que ce soit intégré au lieu d'aller sur Tennis Abstract, c'est du temps gagné."

### ❌ Ce qui ne va pas
- **Pas assez de contexte temporel.** 2 ans max, c'est bien, mais il faut aussi voir la tendance. Qui a gagné les 3 derniers ? Et sur les 5 derniers sur cette surface ?
- **Pas de lien vers les matchs individuels.** Je veux cliquer sur un match H2H pour voir les stats DE CE MATCH-LÀ.
- **Le H2H sans le contexte du tournoi.** Un H2H en finale de Grand Chelem ≠ un H2H au 1er tour d'un ATP 250. Il faut taguer l'importance du match.
- **Pas de visualisation de séquence.** Une ligne du temps des H2H (●●●○○●) serait plus parlante que des lignes de tableau.

### 💡 Propositions concrètes
1. **Ajouter un badge d'importance du match** (🎾 GC, 🏆 Masters 1000, ⭐ ATP 500, 📍 ATP 250)
2. **Vue "Derniers X matchs"** en icônes (cercle vert = victoire, rouge = défaite) → lisibilité instantanée
3. **Cliquer sur un match H2H** → ouvre un drawer avec le détail de CE match (score, stats clés)
4. **Ajouter "forme récente J1" vs "forme récente J2"** en mini sparkline à côté du nom

## E. Réaction — Version Mobile

"L'adaptation mobile sera critique. 60% de mes paris sont faits depuis mon téléphone."

### ❌ Problèmes anticipés
- **Les 8 métriques en cards ne passent pas sur mobile.** Sur un iPhone, ça va faire 3 écrans de scroll. Trop long.
- **Le graphique momentum sur mobile → illisible.**
- **Les cotes sont trop petites.** Sur Winamax mobile, les cotes prennent 50% de la hauteur de card. Ici elles vont être perdues.

### 💡 Propositions
1. **Mode "Pari Rapide" mobile** : ne montrer que 3 métriques clés (SRV_PTS_WON, RET_PTS_WON, PRESSURE_INDEX) + la proba + la cote
2. **Bouton "Voir plus"** pour déplier les autres métriques si l'utilisateur veut creuser
3. **Agrandir les cotes** (minimum 24px, en gras)
4. **Graphique momentum → horizontal scrollable**, pas compressé

## F. Verdict

| Critère | Note |
|---------|------|
| Design global | 6/10 |
| Respect charte graphique | 7/10 |
| Lisibilité des métriques | 5/10 (trop d'infos sans hiérarchie) |
| Recommanderait à un collègue ? | "Oui, si les cotes Pinnacle et le mode trader sont ajoutés" |

**Top 3 améliorations URGENTES :**
1. Ajouter la cote Pinnacle + flow de cotes
2. Mode "Trader" simplifié pour le live
3. Rendre les métriques cliquables (drawer de détail)

---

# PROFIL 2 — "L'Analyste Data Tennis"

Utilise quotidiennement : **Tennis Abstract (Sackmann), Ultimate Tennis Statistics, TennisViz, Jeff Sackmann GitHub**

## A. Analyse des Concurrents

| Site | Ce qui est BIEN | Ce qui est MAL |
|------|-----------------|----------------|
| **Tennis Abstract** | Données historiques riches, classements Elo par surface, visualisations propres, datasets ouverts | UI spartiate, pas de live, pas pensé pour le betting, pas de mise à jour temps réel |
| **Ultimate Tennis Statistics** | Data ultra-granulaire (par point), heatmaps, stats service/retour par zone, filters puissants | Design affreux (2008), navigation catastrophique, lent, pas de mobile |
| **TennisViz** | Analytics 3D, tracking spatial, données de mouvement | Payant, destiné aux pros/coachs, pas orienté pari |

**Ce qui manque à TOUS :**
- Aucun site ne combine analytics tennis ET cotes en un seul endroit
- Les visualisations sont soit trop simples (Tennis Abstract) soit trop complexes (TennisViz)
- Pas de EWMA / momentum visuel clair
- Le H2H contextuel (surface + période) n'existe pas dans une interface propre

## B. Réaction — Écran Pré-Match

### ✅ Ce qui plaît
- "Le fait d'avoir ELO_SURFACE et ATP_POINTS_6M côte-à-côte, c'est un vrai confort. Avant je devais calculer ça manuellement à partir du CSV Sackmann."
- "Le EWMA est bien pensé. La question que tout le monde se pose : est-ce que le joueur est en forme sur les 5 derniers matchs ? Là c'est visuel direct."
- "Le H2H_SURFACE_AUGMENTED est un killer feature. Personne ne le fait bien."

### ❌ Ce qui ne va pas
- **Pas de distribution.** Un chiffre sans contexte (ex: SRV_PTS_WON_S = 68%) ne veut rien dire. C'est quoi la moyenne du Top 10 ? Est-ce que 68% c'est bon ou juste dans la moyenne ?
- **Pas d'évolution temporelle.** Je veux voir la TREND sur 6 mois, pas juste la valeur EWMA en snapshot.
- **Pas de percentile.** Dire "SRV_PTS_WON_S : 68% (Top 15% du circuit)" c'est 100x plus parlant.
- **Les métriques ne sont pas sourcées.** D'où viennent les données ? Sackmann ? API ATP ? Quelle fiabilité ?
- **Pas de filtre de période.** Parfois je veux analyser "depuis le début de la saison sur terre battue", pas juste les 5 derniers matchs.

### 💡 Propositions concrètes
1. **Ajouter des percentile badges** : "SRV_PTS_WON_S : 68% — Top 12% du circuit" en petit en dessous
2. **Graphique d'évolution 6 mois** : un petit sparkline à côté de chaque métrique
3. **Afficher la moyenne du Top 10** en gris translucide à côté de la valeur du joueur → comparaison immédiate
4. **Toggle "EWMA vs Raw"** : parfois je veux les chiffres bruts, pas lissés
5. **Bouton "Exporter"** : CSV des métriques pour analyse offline

## C. Réaction — Écran Live

### ✅ Ce qui plaît
- "Le PRESSURE_INDEX en live, si bien calculé, c'est un Graal analytique."

### ❌ Ce qui ne va pas
- **Trop peu de granularité.** En live, je veux voir l'évolution POINT PAR POINT du momentum. Pas juste une valeur.
- **Pas de matrice de coups gagnants / fautes.** Un joueur qui monte au filet 5 fois de suite change la dynamique.
- **Pas de données de déplacement.** TennisViz montre où les joueurs se tiennent sur le court. Ça serait révolutionnaire mais je comprends que c'est complexe.
- **Le PRESSURE_INDEX n'est pas assez expliqué.** C'est quoi la formule ? Break points uniquement ? Les 30-30 aussi ? Sans transparence, je n'y fais pas confiance.

### 💡 Propositions concrètes
1. **Ajouter un "Match Timeline"** : ligne du temps du match avec chaque jeu en point, coloré par qui l'a gagné
2. **Ajouter % de montées au filet** et % de points gagnés au filet (si donnée disponible)
3. **Transparence du PRESSURE_INDEX** : tooltip "Basé sur break points (60%) + 30-30 (25%) + tie-breaks (15%)"
4. **Comparaison live vs pré-match** : "Proba pré-match: 62% → Live: 55% → Swing détecté"

## D. Réaction — Écran H2H

### ✅ Ce qui plaît
- "Le filtrage par surface + poids temporel, c'est exactement ce dont on a besoin. Le H2H brut est inutile. Le H2H contextuel est une feature que j'attends depuis 10 ans."

### ❌ Ce qui ne va pas
- **Pas assez de profondeur historique.** Pour un analyste, 2 ans c'est trop court. Je veux pouvoir slider sur 5-10-15 ans.
- **Pas de stats de match.** Le H2H ne montre que qui a gagné. Je veux voir les stats de chaque match : aces, doubles fautes, % premières balles, breaks convertis.
- **Pas d'analyse croisée.** "Quand J1 a gagné contre J2 sur terre, quel était son SRV_PTS_WON ?" → ça serait le dataset ultime.

### 💡 Propositions concrètes
1. **Slider temporel** : étendue de temps (1 an / 2 ans / 5 ans / carrière)
2. **Vue "Match Stats" dans le H2H** : en cliquant sur un match, afficher les stats détaillées de CE match (pas juste le score)
3. **Analyse croisée** : "Dans les matchs gagnés par J1, son SRV_PTS_WON était de 72% (vs 65% en moyenne)"
4. **Export CSV du H2H** pour analyse R/Python

## E. Réaction — Version Mobile

"Je fais peu d'analyse data sur mobile, mais je consulte les résultats."

### ✅ Acceptable
- Les métriques clés en un coup d'œil

### ❌ Problèmes
- **Les sparklines d'évolution 6 mois ne passent pas sur mobile** → les rendre optionnelles
- **Le H2H détaillé avec stats de match → impossible à naviguer sur mobile**
- **Pas de mode paysage pour les graphiques**

## F. Verdict

| Critère | Note |
|---------|------|
| Design global | 5/10 |
| Respect charte graphique | 6/10 |
| Lisibilité des métriques | 5/10 (manque de contexte, percentiles, distributions) |
| Recommanderait à un collègue ? | "Oui, si les percentiles et les exports sont ajoutés. Le H2H contextuel est une tuerie." |

**Top 3 améliorations URGENTES :**
1. Ajouter percentiles + moyenne Top 10 sur chaque métrique
2. Sparkline d'évolution 6 mois par métrique
3. Exporter les données (CSV, détail des matchs dans le H2H)

---

# PROFIL 3 — "Le Tracker Live"

Utilise quotidiennement : **Flashscore, SofaScore, LiveScore, Bet365 Live**

## A. Analyse des Concurrents

| Site | Ce qui est BIEN | Ce qui est MAL |
|------|-----------------|----------------|
| **Flashscore** | Rafraîchissement ultra-rapide (<1s), design épuré, notifications push, stats en direct (points, fautes) | Zéro analytics tennis, pas de métriques avancées, pas de proba, pas de momentum |
| **SofaScore** | Stats riches en live (possession, tirs, etc.), UI moderne, dark mode propre | Trop de sports, le tennis est noyé, pas de métriques prédictives |
| **Bet365 Live** | Streaming vidéo intégré, cash-out, interface fluide | Stats basiques, pas d'analytics, design vieillot |
| **LiveScore** | Ultra-rapide, zéro latence | Design minimaliste au point d'en être pauvre |

**Ce qui manque à TOUS :**
- Aucune plateforme n'ajoute de layer prédictif à l'affichage live
- Le momentum est laissé à l'appréciation du viewer
- Pas d'alerte de retournement intelligente (juste "point important" basique)

## B. Réaction — Écran Pré-Match

*"Moi le pré-match je le regarde 2 minutes avant que ça commence. Donc si c'est pas immédiatement lisible, je passe."*

### ✅ Ce qui plaît
- "Les cartes métriques en grille, c'est propre et rapide à scanner."
- "La puce VALUE en vert, si elle est fiable, c'est ce que je regarderai en premier."

### ❌ Ce qui ne va pas
- **Trop d'étapes pour arriver au match.** Sur Flashscore, je clique sur un match → j'ai le score en 0.5s. Là, si je dois naviguer dans des menus, je perds l'utilisateur.
- **Pas assez de contraste entre les métriques importantes et les secondaires.** Tout est dans la même card au même format. SRV_PTS_WON_S doit être en GROS. AGE.30 doit être tout petit.
- **La page pré-match ne montre pas l'heure exacte du début.** Un tracker live a besoin d'un countdown.
- **Pas de lien vers le live.** Si le match a commencé, le bouton doit être visible, pas caché dans un menu.
- **Pas de notification "Match qui commence"** intégrée.

### 💡 Propositions concrètes
1. **Hiérarchie visuelle agressive** : top 3 métriques en grand (SRV_PTS_WON, RET_PTS_WON, PRESSURE_INDEX), le reste en small + accordéon
2. **Countdown visible** en haut à droite de la card match (ex: "J - 2h 34min")
3. **Bouton "Live" visible** dès que le match commence — pas besoin de refresh
4. **Badge "Dernière minute"** : si le match commence dans <15min, la card passe en mode "imminent" avec fond orangé

## C. Réaction — Écran Live

*"C'est LÀ que ça se joue. L'écran live, c'est mon cockpit."*

### ✅ Ce qui plaît
- "Le score en haut avec le set, c'est la base. Flashscore fait pareil."
- "Le momentum graphique, c'était mon rêve sur Flashscore. Mais faut que ça soit fluide."

### ❌ Ce qui ne va pas
- **L'écran live est trop chargé.** Sur Flashscore, je vois : score, temps, statistiques clés en barres. C'est tout. Pariscore veut mettre 8 métriques + un graphique + une proba + une recommandation. Trop.
- **Le rafraîchissement n'est pas garanti.** Si la donnée live met >1s à se mettre à jour, c'est mort. Je vois des infos en retard.
- **Pas de notification sonore.** Sur SofaScore, un son "bip" quand un point important arrive. Rien ici.
- **Pas de mode "mini"** : une vue réduite qui tient dans un coin de l'écran pendant que je fais autre chose.
- **Le PRESSURE_INDEX en live, c'est bien, mais ça change à chaque point.** Il faut le lisser ou le montrer avec une tendance, pas une valeur instantanée.

### 💡 Propositions concrètes
1. **Créer un mode "Tracker"** (toggle) : ne garder que score, temps, proba évolutive, et 2 métriques clés en barres. Tout le reste est caché.
2. **Garantir une latence <500ms** ou mettre un cache écrit "Actualisé il y a X secondes"
3. **Ajouter des sons optionnels** : notification à chaque break point, alerte de swing
4. **Picture-in-Picture mode** : une mini-fenêtre overlay qui suit le scroll
5. **Mettre le PRESSURE_INDEX avec une flèche de tendance** (↗ stable / ↗ ↗ en hausse / ↘ en baisse)

## D. Réaction — Écran H2H

"Le H2H, je le regarde vite fait pour savoir si un joueur en domine un autre. Pas plus."

### ✅ Ce qui plaît
- "Le filtre surface + années, c'est parfait. 2 secondes de lecture et j'ai ma réponse."

### ❌ Ce qui ne va pas
- "Le H2H prend trop de place pour ce que c'est. Sur mobile, je veux le voir en 3 lignes, pas en page entière."
- "Trop de colonnes (H2H_SURFACE, H2H_TEMPOREL, H2H_TOURNOI, H2H_BASE, H2H_CONTEXT). Je comprends rien."
- **5 scores de H2H différents c'est trop.** Un tracker live veut UN score H2H final (ex: "J1 mène 3-2 sur dur"), pas 5 sous-métriques.

### 💡 Propositions
1. **H2H réduit en mode tracker** : une ligne "H2H: 3-2 J1 (sur dur)" et basta. Le détail est dans l'écran H2H complet.
2. **Cacher les sous-métriques H2H** dans un mode expert. Par défaut : score global + par surface.
3. **Colorer le résultat** : vert si J1 domine J2 sur cette surface, rouge si pas.

## E. Réaction — Version Mobile

"Flashscore mobile est mon outil numéro 1. Pariscore mobile doit être aussi rapide."

### ✅ Ce qui est acceptable
- "Le dark mode est bon."
- "Les cartes sont propres."

### ❌ Problèmes majeurs
- **Temps de chargement.** Si l'app met >1.5s à charger les données, je retourne sur Flashscore.
- **Navigation.** Sur Flashscore, je swipe entre les matchs. Un geste = un match. Si Pariscore a des menus/tabs, c'est trop lent.
- **Le graphique momentum sur mobile est une catastrophe annoncée.** Trop petit.
- **Pas de widget.** Flashscore a un widget Android qui montre le score. Pariscore n'en a pas.
- **Pas de mode paysage** pour regarder le match avec l'app à côté.

### 💡 Propositions
1. **Swipe navigation** entre les matchs, pas de back/forward
2. **Widget homescreen** : score + proba + prochain match
3. **Mode paysage** pour la timeline de match
4. **Pas de graphiques sur mobile** → remplacer par des barres colorées (vert/rouge) simples

## F. Verdict

| Critère | Note |
|---------|------|
| Design global | 5/10 |
| Respect charte graphique | 7/10 |
| Lisibilité des métriques | 3/10 (trop d'infos, pas de priorisation visuelle pour le live) |
| Recommanderait à un collègue ? | "Si le mode Tracker est ajouté oui. Sinon non, Flashscore fait mieux le live." |

**Top 3 améliorations URGENTES :**
1. Mode "Tracker" simplifié avec rafraîchissement garanti <1s
2. Hiérarchie visuelle : les top métriques en grand, le reste en optionnel
3. Navigation par swipe mobile entre les matchs

---

# PROFIL 4 — "Le Bettor Mobile"

Utilise quotidiennement : **Betfair App, Winamax, Unibet, PMU Mobile**

## A. Analyse des Concurrents

| App | Ce qui est BIEN | Ce qui est MAL |
|-----|-----------------|----------------|
| **Betfair Mobile** | Cash-out rapide, interface claire, recherche de matchs simple | Pas de stats avancées, navigation parfois lente |
| **Winamax** | UI très soignée, animations fluides, live bien intégré, promo bien affichée | Pas de data tennis sérieuse, trop de gamification |
| **Unibet** | Interface propre, catégorisation des sports claire | Zéro analytics, cotes parfois en retard |
| **PMU Mobile** | Expérience fluide, enrôlement facile | Orienté hippique → tennis inexistant |

**Ce qui manque à TOUS :**
- Aucune app ne fait de recommandation de pari basée sur data réelle (tout est instinctif)
- Les apps sont des catalogues de cotes, pas des assistants décisionnels
- Le mobile est traité comme une version réduite du desktop, pas comme une expérience à part entière
- Pas de dashboard "mes paris en cours" avec analytics de performance

## B. Réaction — Écran Pré-Match

*"Je mise depuis mon canapé, mon téléphone à la main entre deux apps. Si Pariscore n'est pas instantané, je zappe."*

### ✅ Ce qui plaît
- "Les cartes métriques en grille sont claires sur un écran 6.7", ça passe."
- "La couleur verte pour la value, c'est immédiatement compréhensible."

### ❌ Ce qui ne va pas
- **Les boutons de cote ne sont pas assez grands.** Sur Winamax, la cote prend 40% de la largeur de l'écran et >60px de haut. Là on dirait des badges.
- **Pas d'ajout au panier direct.** Je veux pouvoir toucher une cote → elle va dans mon panier. Pas de clic, pas de menu, pas de confirmation.
- **Pas d'intégration avec un bookmaker.** Pariscore prédit, mais il faut aller sur un autre site pour miser. C'est une friction de TROP.
- **Pas de notification "Cote qui monte"** . Si la cote de mon joueur augmente (meilleure value), je veux une push notification.
- **Le chargement doit être progressif.** Je veux voir les cotes en premier, les métriques en second, les graphiques en dernier.

### 💡 Propositions concrètes
1. **CTA de cote XXL** : minimum 56px height, fond vert si value, avec "Parier sur [nom]" écrit dessus
2. **One-tap bet slip** : toucher une cote → ajout au panier → montant par défaut 10€ → confirmation en un geste
3. **Deep link vers Betfair/Pinnacle** : bouton "Ouvrir sur Betfair" qui lance l'app Betfair avec le match pré-rempli
4. **Notifications push "Odds Alert"** : seuil configurable (ex: "Me prévenir si cote > 2.5")
5. **Priorité de chargement** : cote + proba en premier (200ms), métriques en second (500ms), graphiques en dernier (1s+)

## C. Réaction — Écran Live

*"Le live sur mobile, c'est mon mode principal. Je regarde le match ET les cotes en même temps."*

### ✅ Ce qui plaît
- "Le score en haut est bien visible. Le badge LIVE pulse, c'est clean."
- "La proba évolutive est potentiellement utile pour le cash-out timing."

### ❌ Ce qui ne va pas
- **Impossible à utiliser d'une main.** Toutes les interactions sont en haut de l'écran. Sur un iPhone Pro Max, c'est inaccessible sans changer la prise en main.
- **Pas de cash-out simulé.** "Si je cash-out maintenant, quel est mon gain/perte ?" — c'est la question numéro 1 en live.
- **Le graphique momentum est trop petit pour être utile sur mobile.** Soit il prend toute la largeur, soit on le vire.
- **Les métriques live sont trop nombreuses à scanner.** En live, je regarde vite fait entre deux points. Je n'ai pas le temps de lire 6 chiffres.
- **Pas de "Mode une main"** : toutes les actions à portée de pouce.

### 💡 Propositions concrètes
1. **Design "bottom sheet"** : mettre les actions importantes en bas (cash-out simulé, mise en cours), pas en haut
2. **Cash-out simulator** : afficher "Votre mise (10€ @ 2.5) → Valeur actuelle: 18€ → +8€ si cash-out"
3. **Mode "One Thumb"** : zones cliquables uniquement dans le tiers inférieur de l'écran
4. **Remplacer le graphique momentum** par une barre horizontale colorée (rouge à gauche, vert à droite, curseur au milieu)
5. **Ajouter "Live Bet Suggestion"** : "Value détectée → Parier Alcaraz maintenant (cote 2.1)"

## D. Réaction — Écran H2H

"Le H2H sur mobile, c'est une consultation rapide. 5 secondes montre en main."

### ✅ Ce qui plaît
- "Le format compact est bon."

### ❌ Ce qui ne va pas
- "Le tableau H2H est trop large pour un écran mobile. Il faut scroller horizontalement → mauvaise UX."
- "Les sous-métriques H2H (H2H_SURFACE, H2H_TEMPOREL... ) sont incompréhensibles pour un bettor mobile lambda."
- "Pas de visualisation des victoires consécutives."

### 💡 Propositions
1. **Format liste verticale** : 1 match par ligne, pas de tableau horizontal
2. **Simplifier le H2H mobile** : ne montrer que le score global + score par surface (3 lignes max)
3. **Ajouter "Fire" indicator** : si un joueur a gagné les 3 derniers matchs → icône 🔥

## E. Réaction — Version Mobile

"L'adaptation mobile n'est pas pensée. On dirait un site responsive, pas une vraie app mobile."

### ❌ Problèmes structurels
- **Les touch targets sont trop petits.** Les cards sont cliquables mais les vrais boutons (cotes, détails) sont en texte → difficiles à taper.
- **Pas de gestes natifs.** Pas de swipe pour revenir en arrière, pas de pull-to-refresh, pas de haptique.
- **Pas d'offline mode.** Si le réseau est mauvais (stade, transport), l'app doit afficher les dernières données connues.
- **Pas de widget.** Toutes les apps de paris ont un widget "prochains matchs".
- **Les notifications ne sont pas configurables.** Trop = on désactive tout. Il faut un onboarding des notifications.

### 💡 Propositions
1. **Redesign mobile-first** : repenser chaque écran pour une utilisation à une main, pas un rescaling desktop
2. **Ajouter des gestes** : swipe back, pull-to-refresh, long press sur une métrique pour le détail
3. **Widget iOS/Android** : prochain match + cote + proba
4. **Offline grace period** : cache local des 50 derniers matchs consultés
5. **Onboarding notifications** : "Prévenez-moi quand..." avec 3 choix max (pas 15 toggles)

## F. Verdict

| Critère | Note |
|---------|------|
| Design global | 4/10 |
| Respect charte graphique | 7/10 |
| Lisibilité des métriques | 4/10 (métriques trop petites, pas de priorité mobile) |
| Recommanderait à un collègue ? | "Pas encore. Il manque une vraie réflexion mobile. Le desktop est correct mais le mobile est le parent pauvre." |

**Top 3 améliorations URGENTES :**
1. Repenser en mobile-first (bottom sheet, touch targets >48px, une main)
2. Deep link vers Betfair/Pinnacle pour miser
3. Widget + notifications push configurables

---

# PROFIL 5 — "Le Designer / UI Critique"

Connaît : **meilleures pratiques UI/UX des apps de paris, Apple HIG, Material Design 3, accessibilité**

## A. Analyse des Concurrents

| App | Ce qui est BIEN | Ce qui est MAL |
|-----|-----------------|----------------|
| **Betfair** | Hiérarchie visuelle correcte, bon usage des couleurs pour les cotes | Surcharge informationnelle, pas de design system cohérent |
| **Winamax** | Design system propre, micro-animations, dark mode soigné, typo cohérente | Trop de contenu, gamification envahissante |
| **SofaScore** | Dark mode exemplaire, data density bien gérée, animations fluides | Navigation parfois confuse, pas de betting |
| **Unibet** | Clean, aéré, bonne typographie | Manque de personnalité, trop générique |

**Ce qui manque à TOUS :**
- Aucune app ne réussit le mariage analytics + pari dans une interface cohérente
- Les apps analytics sont laides. Les apps de pari sont pauvres en data.
- Le dark mode est souvent mal implémenté (gris pas assez contrastés)
- Pas de design token system visible/consistant

## B. Réaction — Écran Pré-Match

### ✅ Ce qui plaît
- "La palette de couleurs est bien choisie. Bleu nuit profond → sérieux, haut de gamme. Vert #00e676 → visible sans agresser. Bon contraste global."
- "Les cards avec bordure rgba(255,255,255,0.05) sont subtiles et élégantes."
- "Le choix d'Inter est bon. Lisibilité sur écran, licence libre, bonne graisse en 800 pour les chiffres."

### ❌ Ce qui ne va pas — Problèmes de Design System

#### 1. **Hiérarchie typographique insuffisante**
- Tout est en Inter 400/600. Il n'y a pas de hiérarchie claire entre :
  - Le nom du joueur (doit être en Poppins 800, 24px)
  - La métrique (doit être en Inter 700, 16px)
  - La valeur (doit être XXL, genre Inter 800, 32px, en #ffffff)
  - La sous-info (Inter 400, 12px, en #707e94)
- **Actuellement tout se ressemble** → l'œil ne sait pas où se poser.

#### 2. **Problème d'espacement**
- `border-radius: 8px` sur les cards, 6px sur les boutons, 4px sur les badges → c'est cohérent, c'est bien.
- Mais est-ce qu'il y a un système de spacing vertical ? 8px / 16px / 24px / 32px ? Si non → les cards vont avoir l'air tassées ou flottantes.
- **Les cards ont besoin de padding interne suffisant** : minimum 16px, idéalement 20px sur desktop.

#### 3. **Le glow bleu #0077ff est dangereux**
- `box-shadow: 0 0 12px #0077ff` peut être magnifique sur fond noir... ou donner un effet "site de 2010".
- **Règle : glow uniquement sur état actif/sélectionné**, pas en permanence.
- S'il est utilisé pour le bouton "sélectionner un joueur" c'est bien. Si c'est sur chaque card → c'est too much.

#### 4. **Palette limitée**
- 5 couleurs seulement (fond, card, texte, vert, bleu, orange). C'est bien pour un MVP mais **risque de monotonie**.
- **Pas de couleur d'accent secondaire** pour différencier les catégories de métriques :
  - Service → teinte bleutée
  - Retour → teinte verdâtre
  - Mental → teinte orangée
  - Global → blanc/gris

#### 5. **L'orange LIVE (#ff3d00) est trop agressif**
- #ff3d00 est très saturé. Sur fond bleu nuit, ça "crie".
- **Alternative :** utiliser une version moins saturée genre #ff6d2e, et battre plus fort (pulse) plutôt que d'être saturé en permanence.

### 💡 Propositions concrètes

1. **Design token system documenté :**
```css
--color-bg-primary: #0b0e17;
--color-bg-secondary: #0e121e;
--color-card: #131722;
--color-card-hover: #161c2a;
--color-text-primary: #ffffff;
--color-text-secondary: #94a3b8;
--color-text-tertiary: #707e94;
--color-accent-green: #00e676;
--color-accent-blue: #0077ff;
--color-live: #ff6d2e;  /* moins agressif */
--color-danger: #ff1744;
--spacing-xs: 4px;
--spacing-sm: 8px;
--spacing-md: 16px;
--spacing-lg: 24px;
--spacing-xl: 32px;
--radius-card: 8px;
--radius-btn: 6px;
--radius-badge: 4px;
--font-display: 'Poppins', sans-serif;
--font-body: 'Inter', sans-serif;
```

2. **Hiérarchie typographique stricte :**
- Noms joueurs → Poppins 700, 20px, #ffffff
- Valeurs métriques → Inter 700, 28px, #ffffff
- Noms métriques → Inter 500, 13px, #94a3b8
- Contexte (percentiles, tendances) → Inter 400, 11px, #707e94
- Cotes → Poppins 700, 18px, #00e676 si value, #ffffff sinon

3. **Système de spacing vertical :**
- Padding interne card : 20px
- Espacement entre cards : 16px
- Espacement entre métriques dans une card : 12px
- Marge section (entre blocs) : 32px

4. **Badge de catégorie coloré :**
- Un petit marqueur à gauche de chaque métrique : 🟦 Service / 🟩 Retour / 🟧 Mental / ⬜ Global

5. **Le glow bleu : pour les éléments actifs uniquement** (input focus, toggle on). Pas sur les cards.

## C. Réaction — Écran Live

### ✅ Ce qui plaît
- "Le badge LIVE orange qui pulse donne de l'énergie à la page. C'est un bon choix d'utiliser l'animation pour communiquer l'urgence."

### ❌ Ce qui ne va pas

1. **Surcharge cognitive critique**
- L'écran live est le plus chargé. Et c'est celui où l'utilisateur a le MOINS de temps.
- **Règle d'or du live design** : tu ne dois pas forcer l'utilisateur à lire. Il doit pouvoir tout comprendre en un coup d'œil.
- Actuellement il y a : score, sets, proba, graphique momentum, 6 métriques, recommandation, cote live, valeur/proba écart. = **11 éléments à traiter**.

2. **Pas de pattern de lecture guidé**
- L'œil ne sait pas par où commencer.
- **Solution :** guider le regard :
  1. Score (haut, centré, énorme)
  2. Proba (sous le score, barre horizontale)
  3. Cote + recommandation (droite)
  4. Métriques live (bas, secondaires)

3. **Le graphique momentum est mal placé**
- En position latérale, il est trop étroit. Le live n'est pas le bon endroit pour un graphique fin.
- **Solution :** mettre le momentum en barre pleine largeur ou le déplacer vers un écran "Analyse Live" séparé.

4. **Pas d'espace de respiration**
- Les éléments sont trop serrés. Le live doit "respirer" pour être lisible rapidement.
- **Augmenter l'espacement entre les sections :** 24px minimum.

### 💡 Propositions

1. **Maquette de flux visuel live :**
```
┌─────────────────────────────────────┐
│  [SET]         5-4          [SET]   │ ← Poppins 800, 36px, centré
│  Jeu: 30-15                         │ ← Inter 400, 16px, #94a3b8
├─────────────────────────────────────┤
│  ████████████░░░░░░░ 68% Djokovic   │ ← Barre proba pleine largeur
├─────────────────────────────────────┤
│   Cote: 1.85   │   Value: +8% ✔    │ ← Deux blocs, lisibles
├─────────────────────────────────────┤
│  SRV ⬆ 72% │ RET ⬆ 34% │ MOM +0.3  │ ← 3 métriques compactes
│  Pressure Index: 1.2x (normal)      │ ← 1 ligne secondaire
│  💡 Parier Djokovic (cote 1.72)    │ ← Recommandation
└─────────────────────────────────────┘
```

2. **Responsive :** en desktop, 2 colonnes (score + proba à gauche, métriques à droite). En mobile, 1 colonne.

## D. Réaction — Écran H2H

### ✅ Ce qui plaît
- "Le concept de H2H contextuel (surface + année) est EXCELLENT pour l'UX. C'est exactement ce que les utilisateurs veulent sans savoir le demander."

### ❌ Ce qui ne va pas

1. **Le tableau est une table HTML standard**
- Trop "bordereau Excel". Pas assez design.
- **Proposition :** le H2H mérite un traitement plus graphique.

2. **Trop de colonnes**
- 5 scores H2H différents → 5 colonnes. C'est trop.
- **Réduire à 3 colonnes :** Surface, Score, Dernier match.

3. **Pas de visualisation intuitive**
- "○ = victoire, ● = défaite" en ligne de temps est plus parlant que des chiffres.

### 💡 Propositions

1. **Template H2H revisité :**
```
┌─────────────────────────────────────┐
│  H2H: DUR (3-2)   │  ⬆ J1 forme    │
│  ●○○●○ ──→ J1 gagne les 2 derniers │ ← timeline visuelle
├─────────────────────────────────────┤
│  Surface  │ Score  │ Dernier match  │
│  Dur      │ 3-2   │ GC 2024 6-4... │
│  Terre    │ 1-2   │ 👁 Voir le match│
│  Gazon    │ 1-0   │ 👁 Voir le match│
├─────────────────────────────────────┤
│  Dans les matchs gagnés par J1 :    │
│  SRV: 72% │ RET: 38% │ BP: 55%     │
└─────────────────────────────────────┘
```

2. **Ajouter des micro-interactions** : hover sur une ligne → surligner, clic → drawer détail du match.

## E. Réaction — Version Mobile

### ✅ Ce qui est bon
- "Le dark mode est bien rendu sur mobile."
- "Les cards avec fond #131722 sont suffisamment contrastées sur le fond #0b0e17."

### ❌ Problèmes majeurs

1. **C'est un site responsive, pas une app mobile**
- Les breakpoints existent mais l'expérience n'est pas repensée.
- **Signes :** les mêmes marges que desktop, les mêmes cartes, le même layout.
- **Solution :** auditer chaque écran sur un vrai iPhone/Android et repenser la navigation à une main.

2. **Les métriques sont trop petites sur mobile**
- Les chiffres des métriques (SRV_PTS_WON_S) doivent être en **minimum 24px**, pas en 16px.
- Les cotes doivent être à **minimum 20px** en gras.

3. **Pas de bottom tab bar**
- Toutes les apps modernes ont une tab bar en bas : Matchs / Live / Paris / Profil.
- Pariscore semble utiliser une top nav → inaccessible à une main.

4. **Touch targets trop petits**
- Apple HIG dit : minimum 44x44pt. Règle Material Design : 48x48dp.
- Les badges, les cotes, les boutons "voir plus" → mesurer et agrandir.

### 💡 Propositions

1. **Bottom navigation** :
```
[ 🎾 Matchs ][ 🔴 Live ][ 📊 Stats ][ 👤 Moi ]
```

2. **Agrandir les cotes sur mobile** : minimum 44px height, fond distinct

3. **Pull-to-refresh** sur tous les écrans live

4. **Haptic feedback léger** sur les actions importantes (ajout au panier, confirmation de pari)

5. **Progressive enhancement** :
   - Réseau lent → skeleton screens avec les métriques les plus récentes en cache
   - Réseau rapide → animations complètes

## F. Verdict

| Critère | Note |
|---------|------|
| Design global | 5/10 |
| Respect charte graphique | 8/10 (les couleurs sont bonnes, les tokens sont cohérents) |
| Lisibilité des métriques | 4/10 (manque de hiérarchie typo, pas de guidance visuelle du regard) |
| Recommanderait à un collègue ? | "Le potentiel est là. La charte graphique est solide. Mais le design system est immatures, l'expérience mobile est conçue comme un afterthought." |

**Top 3 améliorations URGENTES :**
1. Documenter et appliquer un vrai design token system (typo, spacing, couleurs)
2. Repenser l'écran live pour guider le regard (maquette de flux visuel)
3. Refonte mobile avec bottom navigation et touch targets conformes

---

# TABLEAU COMPARATIF DES AVIS

| Critère | Parieur Pro | Analyste Data | Tracker Live | Bettor Mobile | Designer UI |
|---------|------------|--------------|-------------|---------------|-------------|
| **Note globale** | 6/10 | 5/10 | 5/10 | 4/10 | 5/10 |
| **Charte graphique** | 7/10 | 6/10 | 7/10 | 7/10 | 8/10 |
| **Lisibilité métriques** | 5/10 | 5/10 | 3/10 | 4/10 | 4/10 |
| **Écran Pré-Match** | 👍 cotes + value | 👍 H2H contextuel + EWMA | 👍 rapidité cards | 👍 grille claire | 👍 palette cohérente |
| **Écran Live** | 👎 trop chargé, pas assez trader | 👎 pas assez détaillé | 👎 pas assez rapide, trop d'infos | 👎 pas adapté mobile | 👎 surcharge cognitive sévère |
| **Écran H2H** | 👍 concept fort | 👍 filtré + poids temporel | 👎 trop complexe pour usage rapide | 👎 tableau trop large | 👍 concept UX excellent, mais design tableur |
| **Mobile** | 👎 pas assez prioritaire | 👎 pas d'export | 👎 pas de swipe, trop lent | 👎 pas mobile-first | 👎 responsive ≠ natif |
| **Recommanderait ?** | "Oui si cotes Pinnacle + mode trader" | "Oui si percentiles + exports" | "Si mode tracker ajouté" | "Pas encore" | "Potentiel mais immature" |

---

# TOP 10 AMÉLIORATIONS CLASSÉES PAR PRIORITÉ

| # | Amélioration | Porté par | Urgence | Effort | Écran |
|---|-------------|-----------|---------|--------|-------|
| 1 | **Hiérarchie visuelle des métriques** (top 3 en grand, reste en petit) | Tracker + Designer + Parieur | 🔴 CRITIQUE | Faible | Pré-Match + Live |
| 2 | **Mode "Tracker/Trader" simplifié** (cacher tout sauf proba + cote) | Parieur + Tracker | 🔴 CRITIQUE | Moyen | Live |
| 3 | **Bottom navigation + refonte mobile** (touch targets, une main) | Bettor Mobile + Designer | 🔴 CRITIQUE | Élevé | Global |
| 4 | **Cote Pinnacle + flow de cotes 24h** (comparaison marché vs estimée) | Parieur Pro | 🟠 HAUTE | Moyen | Pré-Match |
| 5 | **Percentiles + moyenne Top 10** sur chaque métrique | Analyste Data | 🟠 HAUTE | Faible | Pré-Match |
| 6 | **Sparkline évolution 6 mois** par métrique | Analyste Data | 🟠 HAUTE | Moyen | Pré-Match + H2H |
| 7 | **Notifications push + widget** (odds alert, swing) | Bettor Mobile + Tracker | 🟠 HAUTE | Élevé | Global |
| 8 | **Métriques cliquables** → drawer détail EWMA/match | Parieur Pro + Analyste | 🟡 MOYENNE | Moyen | Pré-Match + H2H |
| 9 | **Swing Alert visuelle + sonore** sur retournement live | Parieur + Tracker | 🟡 MOYENNE | Moyen | Live |
| 10 | **Cash-out simulator** (valeur actuelle du pari en cours) | Bettor Mobile | 🟡 MOYENNE | Élevé | Live |

---

# CE QUI EST VALIDÉ (Ne PAS toucher)

| Élément | Validé par | Pourquoi |
|---------|-----------|----------|
| **Charte graphique globale** (bleu nuit, cards foncées, vert #00e676) | TOUS + Designer (8/10) | Palette haut de gamme, sérieuse, adaptée aux paris. Conserver. |
| **Dark mode** | TOUS | Obligatoire pour une app de paris. |
| **H2H filtré par surface + poids temporel** | Analyste + Parieur + Designer | Feature unique, killer. Ne pas simplifier. |
| **EWMA pour SRV/RET_PTS_WON** | Analyste + Parieur | Validé scientifiquement, reconnu terrain. |
| **Puce VALUE (cote estimée vs marché)** | Parieur + Tracker + Bettor | Accélérateur de décision. Garder mais ajouter cote référence. |
| **Badge LIVE orange qui pulse** | Designer + Tracker | Bon usage de l'animation pour communiquer l'urgence. |
| **Cards avec bordure subtile rgba(255,255,255,0.05)** | Designer | Élégant, discret. |
| **Typographie Inter** | Designer + Parieur | Lisible, libre, pro. |
| **border-radius 8/6/4** | Designer | Cohérent, système compris. |

---

# CE QUI DOIT CHANGER AVANT DE CODER

## Bloquant (Sprint 0 — à faire AVANT toute implémentation)

1. **Définir la hiérarchie visuelle des métriques** (token de taille par niveau d'importance)
   - Les 3 métriques prioritaires (SRV_PTS_WON, RET_PTS_WON, PRESSURE_INDEX) doivent être visuellement dominantes
   - Les métriques secondaires (AGE.30, BP_SAVED) doivent être plus petites, optionnelles, en accordéon
   - Résultat : l'utilisateur voit l'essentiel en 1 seconde

2. **Repenser l'écran Live complètement**
   - Actuellement trop chargé pour être utilisable en conditions réelles
   - Proposer 2 modes : "Tracker" (épuré) et "Analyste" (complet)
   - Le mode Tracker doit tenir sur un écran de téléphone sans scroll

3. **Décider mobile-first ou desktop-first**
   - Actuellement le design est pensé desktop → adapté mobile
   - Si 60% des paris sont mobiles (profil 4), il faut inverser la priorité
   - Conséquence : repenser la navigation, les touch targets, les gestes

## Important (Sprint 1)

4. **Ajouter les cotes de référence (Pinnacle/Betfair) dans le pré-match**
   - Sans ça, la puce "VALUE" est vide de sens
   - Afficher "Marché: 1.85 / Estimée: 2.10 → VALUE +8%"

5. **Ajouter les percentiles sur chaque métrique**
   - "SRV_PTS_WON_S: 68% (Top 12%)" → contexte immédiat
   - Moyenne du Top 10 en gris en dessous

6. **Rendre les métriques cliquables**
   - Click → drawer avec évolution EWMA sur les 5 derniers matchs
   - Permet de vérifier la tendance sans quitter l'écran

## Recommandé (Sprint 2)

7. **Notifications push configurables**
   - Odds alert (cote qui passe un seuil)
   - Swing alert (retournement live)
   - Match imminent (15 min avant)

8. **Widget homescreen**
   - Prochain match + cote + proba

9. **Mode "une main" mobile**
   - Actions en bas de l'écran
   - Touch targets >48px

10. **Deep link vers bookmakers**
    - "Ouvrir sur Betfair" → l'app Betfair s'ouvre sur le match

---

# SCORE MOYEN

| Profil | Note |
|--------|------|
| Profil 1 — Parieur Pro | 6/10 |
| Profil 2 — Analyste Data | 5/10 |
| Profil 3 — Tracker Live | 5/10 |
| Profil 4 — Bettor Mobile | 4/10 |
| Profil 5 — Designer UI | 5/10 |
| **MOYENNE** | **5/10** |

**Interprétation :** Le design Pariscore est correct sur le fond (bonne charte, bon concept, bonnes métriques) mais immature sur la forme (hiérarchie visuelle, mobile, live mode, cotes de référence). Le potentiel est clairement là — les profils reconnaissent tous que le H2H contextuel et les EWMA sont des features différenciantes. Mais l'exécution actuelle ne tiendrait pas la comparaison avec Flashscore (live) ou Betfair (paris) en conditions réelles.

**Le verdict des 5 experts :** "Reviens-nous avec une hiérarchie visuelle claire, un mode Tracker live, et une vraie expérience mobile. Là on signe."

---

*Document produit par l'Expert UX Research — Session de brainstorming avec 5 profils*
*Pariscore — Juin 2026*
