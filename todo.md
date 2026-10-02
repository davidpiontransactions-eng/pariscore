# PariScore — Todo / Follow-ups

---

## 🎱 SNOOKER — Sous-onglet « Visuels » : images générées automatiquement (IA)

> **Demandé par David le 2026-10-02.** « Personnalise l'onglet Snooker, quel que soit
> le sous-onglet, d'images que tu génères automatiquement en rapport avec le snooker,
> les top joueurs et l'actu du snooker. »

**Ambition** : un sous-onglet « Visuels » qui rend l'onglet snooker reconnaissable
en un coup d'œil, alimenté par des visuels générés et **mis à jour automatiquement**
selon 3 axes : le snooker en général, les **top joueurs** du moment, l'**actu** du jour.

### Direction artistique — référence fournie (2026-10-02)

Référence : <https://www.behance.net/gallery/245292655/Sports-Banners-Betting-Casa-de-Apostas>
— « *3D Cartoon Style Projects Created for Casino/Betting/iGaming — Immersive,
generated images* ». Tags du projet : `cartoon`, `casino`, `betting`, `iGaming`,
`gambling`, `Slots`, `Sports Design`. Formats observés : **1400×781** (bannière 16:9),
1400×507 (bandeau large), 1400×1045, 1080×1350 (story).

⚠️ **Copyright** : la page porte « © All Rights Reserved — utilisation interdite sans
l'accord explicite du propriétaire ». **Usage comme référence de style uniquement.**
Ne jamais reprendre, hotlinker ou derivative ses visuels ; tout est régénéré. Même
règle que la collection `.agents/design-md/` (inspiration, pas copie).

- [ ] **Style : 3D cartoon / rendu 3D stylisé** — pas de photoréalisme. Personnages
      simplifiés, proportions légèrement caricaturales, éclairage de salle (faisceau
      du plafond sur la table), fond en dégradé sombre, texture « glossy » douce
- [ ] ⚠️ **Le style cartoon résout le problème des faux visages** décrit plus bas :
      un personnage 3D stylisé ne prétend pas être la photo d'un joueur réel. Reste à
      gérer : ne pas laisser croire que le personnage dessiné *est* un joueur nommé
      → **le nom réel vient du composant, jamais de l'image**
- [ ] Palette : on garde le **style** de la référence mais on remplace ses couleurs
      par la charte PariScore (lavande/violet, `--bg-deep` #F0ECF8, `--primary`
      #7B3FA0). **Pas** l'esthétique casino verte/rouge saturée — sinon on jette la
      charte du site pour un visuel
- [ ] ⚠️ **Décision à trancher sur le texte dans l'image** : les générateurs écrivent
      mal les accents et les noms propres. Deux options :
      - **(a) RECOMMANDÉ** — générer le visuel **sans texte** et composer le texte
        **en HTML/CSS par-dessus**. Net, traduisable (cf. TODO traduction du fil
        d'actu), accessible, 0 risque de faute. C'est ce que font les sites pro.
      - (b) laisser le modèle écrire dans l'image → plus « natif », mais à contrôler
        ligne par ligne à chaque génération
- [ ] Textes en overlay : **contraste WCAG AA** vérifié sur chaque visuel, dégradé
      sombre en pied plutôt qu'un aplat (poids nul, lisible sur n'importe quelle image)
- [ ] Formats : viser **1 Carrousel 4:5 mobile + 1 bannière 16:9** par sujet, pas 6
      formats — moins de génération, donc moins de coût (voir plus bas)

⚠️ **Le vrai problème de ce chantier n'est pas la génération, c'est le coût et le
contrôle du contenu.** Une image générée par IA sur un sujet sportif est une source
d'erreur factuelle : une main de Ronnie qui tient 3 billards, un Crucible vide alors
qu'il est plein, un joueur portant le maillot d'une équipe où il n'a jamais joué.
**Une fausse image d'actu snooker détruit la crédibilité de tout le site** — c'est
pire que pas d'image du tout. Les garde-fous ci-dessous ne sont pas optionnels.

### Choix du modèle / moteur

- [ ] Vérifier ce que `@google/genai` expose **réellement** en génération d'image
      (`GEMINI_API_KEY` est déjà dans `.env`) — ne pas supposer un nom de modèle,
      le lire dans la lib installée
- [ ] ⚠️ **Alternative bien moins risquée** : les photos des joueurs existent déjà
      (CueTracker, résolu par `playerPhotoUrl` dans le calendrier snooker). Un
      « top joueurs » affiché avec les **vraies photos** est plus professionnel
      qu'une image IA. **À trancher avec David : IA ou photos réelles ?**
      Recommandation : photos réelles pour les joueurs, IA uniquement pour l'ambiance.

### Garde-fous de contenu (obligatoires)

- [ ] **Aucun joueur nommé dans un visuel IA** sans verification — les visages
      générés sont toujours faux. Si un joueur est mentionné, le visuel est
      **stylisé / non figuratif** (silhouette, salle, table, ambiance) et le texte
      d accompaniment porte le nom réel
- [ ] Chaque visuel généré passe par un **prompt figé et versionné** dans le repo
      (pas de prompt libre construit depuis une actu) → le style reste cohérent
      d'un jour à l'autre et le résultat est reproductible
- [ ] Pas de faux score, pas de faux classement, pas de faux logo de tournoi dans
      l'image. Toute donnée chiffrée vient du composant, jamais de l'image

### Coût / infrastructure (le vrai chantier)

- [ ] Génération **hors du chemin critique** : jamais à la volée sur le clic
      utilisateur. Cache disque sur le modèle de `football-press-review-service.ts`
      (`.cache/<nom>/`)
- [ ] Budget explicite : **N visuels max par jour**, et **1 seule régénération** par
      sujet. Une image = un appel payant ; sans plafond, une boucle cron vide le
      compte Gemini
- [ ] Cron quotidien (comme `pariscore-cron-press-review`, `ecosystem.config.js:304`)
      qui régénère uniquement les sujets dont le **contexte a changé** (nouveau
      tournoi, nouveau top joueur, actu du jour)
- [ ] Format de sortie **WebP/AVIF**, plusieurs tailles (la grille est en 3 colonnes
      responsive), `next/image` avec `sizes` correct — sinon on annule le gain de
      poids décrit dans la TODO minimalisme ci-dessous

### Réalisation

- [ ] `src/components/snooker/snooker-visuals.tsx` + entrée `sport-sub-tabs.tsx`
      → nouvel onglet `visuels` (6ᵉ onglet : attention, la headbar s'allonge — voir
      la TODO minimalisme, c'est contre l'objectif de David)
- [ ] ⚠️ **Arbitrage à faire avec David avant de coder** : un 6ᵉ onglet surcharge
      la navigation, alors que sa demande « quel que soit le sous-onglet » suggère
      plutôt un **bandeau de visuels en haut de l'onglet snooker, commun à tous les
      sous-onglets**. C'est plus cohérent avec « moins de bruit » et ça évite de
      rajouter une 6ᵉ entrée à la headbar
- [ ] Accessibilité : chaque visuel = `alt` descriptif réel (pas `alt=""` décoratif
      si du texte est posé dessus), ratio de contraste respecté si du texte est
      superposé

---

## 🎱 SNOOKER — Typographie des titres de tableaux (audit d'agent, 2026-10-02)

> **Demandé par David le 2026-10-02** : « la typographie devient un élément central du
> design… une typographie expérimentale pour les titres des tableaux pour se démarquer
> de la concurrence… mais pas au point d'être illisible ».
> Audit réalisé par un agent dédié. **Recommandation : option A, sans hésitation.**

### État actuel (vérifié dans le code)

`src/app/layout.tsx:2` charge 4 polices : **Geist**, **Geist Mono**, **Archivo**
(`axes:["wdth"]` → vraie police variable, `:79-83`), **Space Grotesk** (`:88-91`).
Les classes de signature existent déjà dans `globals.css:504-550` (`.score-display`,
`.score-hero`, `.score-hover`) mais **ne servent qu'à 1-2 endroits** et
`.font-display-ui` (`:538`) est du **CSS mort — zéro usage**.

Il n'existe **aucune classe typographique pour un en-tête de tableau** : les `<th>`
snooker sont du Geist générique + une couleur inline.

### Option A — RETENUE : Archivo étiré, voix « broadcast »

Différenciation par **l'axe de largeur** d'une police déjà chargée — donc **0 octet,
0 requête réseau**. Contraste `wdth 125` sur les en-têtes contre `wdth 118` sur les
scores : l'œil sépare « colonne de données » et « score » sans jamais lire une police
étrangère. C'est le « contraste marqué » demandé, sans risque de déchiffrement.

```css
/* En-têtes de tableaux — Archivo étiré. Jamais sur les cellules ni sur les chiffres. */
.th-broadcast {
  font-family: var(--font-archivo), var(--font-geist-sans), sans-serif;
  font-stretch: 125%;
  font-variation-settings: "wdth" 125, "wght" 700;
  letter-spacing: 0.02em;
  line-height: 1.4;
  text-transform: uppercase;
  font-variant-numeric: tabular-nums;
}
```

- [ ] Appliquer sur les **3 surfaces** de titres de tableaux snooker
- [ ] **Test des 5 secondes** : « quelle est la probabilité du 3ᵉ match » doit rester
      instantané à 320px et 1440px. Échec → descendre `wdth` à 112, ou revenir à Geist
- [ ] Réversible en une valeur (c'est le gros avantage de A)

### Option B — plan B, aujourd'hui **refusée**

`Uncut Sans` est déjà dans le repo (`hockey-hero-header.tsx:155`) et son rapport de
glyphe est le seul vraiment distinct de Geist — mais le `@font-face` ne déclare que
`weight: 400` → un `wght 700` est **synthétisé** (faux-bold cassé), et c'est une
**requête tierce** (interdite par `.agents/references/performance-checklist.md:62`).
Ne la re-proposer qu'après **self-host** d'une coupe 700 en `next/font/local`.

### Option C — **REFUSÉE** : Big Shoulders Display (condensée « avant-gardiste »)

La plus spectaculaire des trois, et la moins adaptée : elle contredit **deux règles
écrites** de `DESIGN_CHARTER.md` — « Pas de typo fun » (`:371`) et le critère
« améliore la lisibilité des données ? sinon SKIP » (`:352`). En condensé extrême,
`MATCHS` et `ACCURACY` deviennent des traits illisibles. **Si David veut malgré tout
du stunt, c'est un point à lui demander explicitement**, pas à décider ici.

### 🔴 Défaut d'accessibilité trouvé au passage — à corriger quel que soit le choix

Contrastes **mesurés** sur les vraies surfaces :

| Combinaison | Ratio | Verdict |
|---|---|---|
| `#717171` (inline actuel) sur blanc | 4,88:1 | AA ✅ (marginal) |
| **`#717171` sur le shell lavande `#F0ECF8`** | **4,20:1** | ❌ **échoue AA** |
| `var(--muted-foreground)` `#6B5B8D` sur `#F0ECF8` | 5,15:1 | AA ✅ |
| `var(--primary)` `#7B3FA0` sur `#F0ECF8` | 5,90:1 | AA ✅ |

- [ ] Remplacer les `color: "#717171"` inline des en-têtes par
      `var(--muted-foreground)` — c'est le seul vrai défaut a11y mesuré
- [ ] ⚠️ Toute famille stunt future exige une **dérogation écrite** au
      `DESIGN_CHARTER.md:83` (interdit toute `font-family` hors `var(--font-*)`)

---

## 🎱 SNOOKER — Recherche vocale (retrouver un joueur ou une prédiction)

> **Demandé par David le 2026-10-02.** Aucun code de reconnaissance vocale n'existe
> dans le repo (vérifié : zéro `SpeechRecognition` / `webkitSpeech`).

⚠️ **Contrainte à dire clairement** : l'API Web Speech n'existe **que dans Chrome /
Edge / Opera (desktop) et Safari iOS/macOS récent**. **Firefox ne l'a pas**, et les
versions mobiles Android hors Chrome l'excluent souvent. La recherche vocale ne peut
donc **jamais être l'unique chemin d'accès** à une fonctionnalité — sinon on coupe
une partie de nos utilisateurs. Elle est un **accélérateur**, jamais un remplacement
duchamp texte.

- [ ] Détection de capacité : `window.SpeechRecognition ?? window.webkitSpeechRecognition`
      → si absent, **ne pas afficher** le micro (pas de bouton mort)
- [ ] Langue : `recognition.lang` = la locale du visiteur (cohérent avec la langue
      du fil d'actualité, TODO « traduction selon la langue de l'utilisateur »)
      → un joueur nommé « Trump » se dit différemment en fr et en en
- [ ] **Recherche hybride** : la reconnaissance ne sert qu'à **produire une chaîne**,
      qui passe ensuite dans le **filtre joueur / prédiction existant**. Ne pas écrire
      un matcher vocal séparé — du code en double pour rien (Hard Rule #14, Le Ladder)
- [ ] Normaliser le flux : le dicté returns « ronny o sullivan » pour
      « Ronnie O'Sullivan » → alias déjà gérés par le résolveur de joueurs, vérifier
      qu'il couvre les cas vocal (initiales, « OSullivan » sans apostrophe)
- [ ] a11y : le micro est un `button` avec `aria-label`, état
      `aria-pressed`, et **transcription affichée en direct** pendant l'écoute
      (sinon l'utilisateur sourd ou sourd-muet n'a aucun retour). Retour visuel :
      l'onde sonore seule ne suffit pas
- [ ] Arrêt propre : `recognition.abort()` au démontage du composant, sinon le micro
      reste ouvert après navigation — c'est le bug le plus fréquent de cette API
- [ ] Message d'erreur explicite si la permission micro est refusée (l'utilisateur
      ne comprend pas pourquoi rien ne se passe)
- [ ] Where : `snooker-tab-content.tsx` — un seul point d'entrée, au-dessus des
      sous-onglets, pour servir « joueur » **et** « prédiction »

---

## 🎱 SNOOKER — UX/UI : minimalisme stratégique, performance & poids des pages

> **Demandé par David le 2026-10-02.** « La simplicité est stratégique : moins de bruit
> améliore la compréhension, la confiance et la satisfaction. » Trois volets :
> alléger l'UI, alléger les pages, héberger vert.
> ⚠️ **Point de vigilance** : plusieurs chantiers déjà ouverts dans ce fichier vont
> **à l'encontre** de cet objectif (6ᵉ onglet « Visuels », fil d'actualité, bandeau de
> visuels…). À chaque fois, vérifier que l'ajout reste un gain net et pas du bruit.

### Volet 1 — Moins de bruit, moins de charge cognitive

- [ ] Auditer `snooker-tab-content.tsx` (≈1950 lignes, 5 sous-onglets) : combien
      d'éléments visibles **en même temps** sur l'écran par défaut ? Quel est le
      chemin minimal « j'ouvre l'app → je vois un pari → je clique » ?
- [ ] Chaque sous-onglet doit avoir **une** action principale, pas 5. Le reste
      passe derrière un « voir plus »
- [ ] Supprimer les éléments qui n'ont jamais été cliqués (survoler les maths
      Cumberland/le brier du backtesting : est-ce lu ?)
- [ ] Contraste : le défaut a11y mesuré dans la TODO typographie
      (`#717171` sur lavande = 4,20:1) se paie aussi en « bruit visuel »

### Volet 2 — Poids des pages et vitesse perçue

- [ ] Mesurer avant de toucher : `bundlephobia`/`next build` sur la route snooker,
      poids JS par route. Savoir quelle route est la plus lourde **avant** d'optimiser
- [ ] `sharp` et `next/image` sont déjà en place (dépendances du projet) → vérifier
      que **toutes** les images passent par `next/image` avec un `sizes` correct, et
      que le format de sortie est bien WebP/AVIF
- [ ] Les images de joueurs et les vignettes du futur fil d'actualité sont les
      **poids n°1 prévisibles** d'un site sportif : `sizes`, `priority` sur la seule
      image above-the-fold, `loading="lazy"` partout ailleurs
- [ ] Les polices : 4 familles chargées pour toute l'app. Si l'option A est retenue,
      c'est **0 famille ajoutée** — argument perf qui compte
- [ ] ⚠️ Le futur fil d'actualité **rajoute 4 requêtes réseau**. Cache TTL + cron
      (déjà prévu dans sa TODO), sinon on dégrade la vitesse perçue qu'on cherche à
      améliorer

### Volet 3 — Hébergement vert

- [ ] Faire le **point sur l'existant** avant de promettre : le VPS est déjà en France
      (51.75.21.239, Scaleway) et l'app tourne sous **Bun** — une part du travail est
      déjà faite
- [ ] Trancher ce qui est réellement actionnable : l'empreinte du front (poids,
      requêtes, polices) et celle de l'hébergement sont deux choses distinctes, et
      le levier realistic côté projet c'est le front + l'orchestration des crons
- [ ] Mesurer avant d'annoncer : nb de requêtes par page, poids transféré, et
      fréquence réelle des crons (un cron qui scrape toutes les 30 min pour des
      données qui changent 1×/jour est du gaspillage, donc de l'énergie)

### Ce qui ne se mesure pas dans un commit

⚠️ Cette TODO est un **cap**, pas une tâche. Elle n'est pas « finie » quand une liste
est cochée — elle se juge sur 3 métriques à mesurer avant/après : **temps de
chargement**, **poids transféré**, **nombre d'éléments visibles par écran**. Les
noter ici avant de commencer.

---

## 🎱 SNOOKER — Fil d'actualité (4 sources) + photos + traduction selon la langue de l'utilisateur

> **Demandé par David le 2026-10-02.** Objectif : « ça mettra + de professionnalisme ».
> Modèle de référence : `src/lib/handball-news.ts` (sources multiples, TTL, dédup,
> fallback silencieux). **Deux améliorations par rapport au handball** : les photos
> d'articles (le fil handball n'en a pas) et la traduction **bidirectionnelle**.

### Sources — état vérifié le 2026-10-02 (sondes directes)

| Source | Flux | Résultat | Images dans le flux |
|---|---|---|---|
| **BBC Sport** | `https://feeds.bbci.co.uk/sport/snooker/rss.xml` | ✅ 200, **38 items** | ✅ `media:*` / `enclosure` |
| **SnookerHQ** | `https://snookerhq.com/feed/` | ✅ 200, **20 items** | ❌ aucune |
| **SnookerMania** | `https://snookermania.de/feed/` | ❌ **404** — pas de flux | — |
| **LiveSnooker** | `https://www.livesnooker.com/feed/` | ❌ **403** (WAF) | — |

⚠️ **Les 2 sources qui posent problème ne sont pas optionnelles** : ce sont 2 des
4 sources demandées. Traitement à trancher avant de coder :
- **SnookerMania** : scraper le HTML de la home (WordPress → tenter
  `?feed=rss2`, `/category/snooker-news/feed/`, ou l'API WP
  `https://snookermania.de/wp-json/wp/v2/posts?per_page=20` — **à vérifier**).
- **LiveSnooker (403)** : c'est un blocage transport, pas de contenu → passer par
  **`scrapling`** (outil déjà dans le projet, mode stealth) ou FlareSolverr
  (conteneur déjà présent sur le VPS). Préférer scrapling : le job est quotidien
  et il n'y a pas de scraping massif.

### Photos — stratégie en 2 temps

1. **Priorité au flux** : BBC fournit l'image directement (`media:thumbnail`).
2. **Repli `og:image`** : pour SnookerHQ (et toute source sans image dans le
   flux), aller chercher `<meta property="og:image">` sur la page de l'article —
   mais **1 fetch par article est trop lent** (20 articles × 1 fetch).
   Alternative : ne fetch que les **6 premiers articles** de la source
   (`MAX_PER_SOURCE = 6`, déjà la valeur du handball) → 6 fetches max/source,
   en parallèle, budget 2 s par fetch, échec silencieux sur image.
3. **Proxys d'images** : BBC/SnookerMania servent leurs images via `ichef.bbci.co.uk`
   et `snookermania.de/wp-content` → ajouter ces domaines à
   `images.remotePatterns` dans `next.config.ts`, sinon `next/image` casse.
4. `alt` = titre de l'article. Repli sur une pastille/initiales si 404.

### Traduction selon la langue de l'utilisateur (⚠️ généralisation du handball)

`handball-news.ts:198` ne traduit **qu'EN→FR**, en dur (`translateEnTitles`).
La demande est **bidirectionnelle** : traduire vers `fr-FR` **ou** `en` selon la
langue du visiteur.

- [ ] Lire la locale utilisateur — vérifier ce qui existe déjà dans le projet
      (`Accept-Language` est envoyé en dur `fr-FR` dans `handball-news.ts:238`,
      donc à remplacer par la locale réelle du client)
- [ ] Rendre la cible dynamique : `?lang=fr|en` sur la route, ou en-tête
      `Accept-Language` — **décider** (le `?lang=` est plus simple à tester et
      à lier depuis le sélecteur de langue existant du header si il y en a un)
- [ ] Traduire dans **les deux sens** : EN→FR pour BBC/LiveSnooker, FR→EN pour
      SnookerMania (source allemande → EN ou FR ? **à trancher avec David** :
      l'allemand n'est dans aucun des deux sens)
- [ ] Conserver le titre **original** dans `meta` (comme le fait déjà le
      handball) + `originalLang`, pour pouvoir basculer la langue sans
      re-appeler Gemini
- [ ] **1 seul appel Gemini batch** par TTL (pas un par article), `temperature 0.2`,
      `timeoutMs 20_000`, réponse = tableau JSON de longueur EXACTE, fallback
      silencieux sur quota/réseau/JSON invalide
- [ ] Prompt : « style titre de presse sportive, concis », noms de joueurs de snooker
      **et** noms de tournois **non traduits** (Crucible, UK Championship, Masters,
      Championship League sont des noms officiels, on ne les traduit pas)
- [ ] ⚠️ SnookerMania étant en allemand, prévoir une 3ᵉ langue cible possible —
      ou l'exclure du lot 1 si la décision est FR/EN seulement

### Fichiers à créer (miroir du handball)

- [ ] `src/lib/snooker-news.ts` — sources, parsing RSS, dédup, cap
      (`NEWS_TTL_MS = 30min`, `MAX_PER_SOURCE = 6`, `MAX_TOTAL = 24`,
      `FETCH_TIMEOUT_MS = 10_000`), **`imageUrl` + `meta` + `originalLang` ajoutés**
      au type `SnookerNewsItem`
- [ ] `src/app/api/v1/snooker/news/route.ts` — `?lang=fr|en`, crash-proof comme
      les autres routes snooker (toujours 200 + champ `error`)
- [ ] `src/components/snooker/snooker-news.tsx` — SWR + cartes avec vignette à
      gauche, titre cliquable (ouvre l'onglet), badge source + badge « traduit »
- [ ] Monter `<SnookerNews />` dans `src/components/snooker/snooker-tab-content.tsx`
      (en haut, sous le hero — position **`calendrier` uniquement** au départ, ou
      sur tous les onglets : **à trancher avec David**)
- [ ] `src/lib/__tests__/snooker-news.test.ts` — parsing RSS, décodage entités,
      extraction image, dédup/cap, **traduction bidirectionnelle + fallback**
- [ ] Cron : pré-chauffer le cache comme `pariscore-cron-press-review`
      (`ecosystem.config.js` ligne 304) plutôt que de fetch au premier visiteur

### Vérif prod

- [ ] 4 sources présentes dans la réponse, avec `sources[].ok` par source
- [ ] ≥ 1 image affichée par carte sur les 3 dernières cartes
- [ ] `?lang=en` renvoie des titres en anglais, `?lang=fr` en français
- [ ] Couper Gemini → les titres originaux s'affichent, **aucune page cassée**
- [ ] SnookerMania + LiveSnooker alimentent bien le fil (sinon le signaler, ne pas
      livrer un fil à 2 sources sur 4 sans le dire)

---

## 🎱 SNOOKER — H2H « modèle 1xbet » dans le popup joueur (+ photos)

> **Demandé par David le 2026-10-02**, avec capture d'écran de la maquette 1xbet.

**État actuel** : la page `/snooker/h2h/[id]` **existe déjà** et n'est **pas** le
problème — elle n'est juste **pas accessible depuis le popup joueur**. Le popup
(`snooker-player-popup.tsx:566`) ne propose que `/snooker/compare?search=` et le
lien CueTracker.

- [ ] Bouton « Tête-à-tête » dans le popup joueur → navigue vers le H2H du match
      **courant ou à venir** de ce joueur ; à défaut, vers la page joueur
- [ ] Reprendre la maquette 1xbet de la capture :
  - [ ] Bandeau match : **photos des deux joueurs**, nom + nationalité, compte à
        rebours, score live
  - [ ] Section **TÊTE-À-TÊTE** : matchs joués / matchs nuls, victoires `1/4` vs `3/4`,
        badges de forme `P/P/P/V` par joueur
  - [ ] Liste **MATCHS** (confrontations directes) : date, joueur + photo,
        score `5:6`, joueur + photo
  - [ ] Deux colonnes **MATCHS PRÉCÉDENTS** : les N derniers de chaque joueur
  - [ ] **PROCHAINS MATCHS** de chaque joueur
- [ ] Source de données : `data/snooker_history.db` a déjà tout (126 301 matchs,
  2 joueurs, date, score, tournoi) → **une route
  `/api/v1/snooker/h2h/[id]`** suffit, pas de scrape supplémentaire
- [ ] Photos : réutiliser le résolveur déjà branché dans le calendrier
      (`playerPhotoUrl` sur les matchs) — vérifier que le slug CueTracker
      (`L10_BOUNDS`-style normalisation `snookerSlug`) matche bien les 2 joueurs
- [ ] ⚠️ **Ne pas reproduire le bug du tableau des frames** : la base porte
      `winner_url` (voir `docs/snooker/PLAFFOND-PREDICTIF.md`), l'ordre des
      colonnes n'est pas fiable — les scores doivent venir de l'identité du
      vainqueur, jamais de `player_1_score > player_2_score`

---

## 🎱 SNOOKER — `bestOf` codé en dur (bloquant pour tous les marchés)

> Constat 2026-10-02 pendant l'audit redesign. `matches/route.ts:190` renvoie
> `bestOf: 9` en dur (et `:239` `7` pour Oddsportal) — **la finale du Crucible
> est en Bo25**, et toutes les binomiales de l'onglet (over frames, handicap,
> race-to, live) sont calculées sur une longueur de match **inventée**.

Distribution réelle mesurée sur la base historique (2015+) :

| Valeur | Matchs | Où |
|---|---|---|
| Bo7 | 16 896 | Opens UK/WEL/SCO/NIR, Q School, Paul Hunter |
| Bo9 | 5 786 | Masters, German Masters, World Open |
| Bo11 | 3 947 | **UK Championship**, Players, Shanghai (finales) |
| Bo19 | 1 407 | **World Championship** (finale), Tour Championship |
| Bo25 | 145 | phases finales de tournois majeurs |

- [ ] Dériver `bestOf` de la ligne **total frames** du marché quand elle existe
      (seule info de format disponible chez Oddsportal), sinon du tournoi
      (tableau ci-dessus)
- [ ] Ou scraper `best_of` depuis FlashScore si le champ existe dans la réponse
- [ ] À défaut : au minimum **documenter que la valeur est un fallback**, et
      ne plus afficher `Bo{n}` comme s'il était fiable dans l'UI

---

## 🏀 BASKET EUROLEAGUE — Logos calendrier + popup stats & 3 bets prematch 1xbet

> **Demandé par David le 2026-10-01.** Deux lots indépendants, à traiter dans l'ordre.

### Lot 1 — Logos des équipes dans la table calendrier EuroLeague

**Constat code (2026-10-01)** : le bridge EuroLeague
(`src/lib/euroleague-bridge.ts` → `euroleague_api.schedule.Schedule`) ne renvoie que
`home/away = { id, name, code }` — **aucun champ logo**, et **aucun score** sur les
matchs joués (le feed `get_schedule` ne porte pas les scores). La table calendrier
affiche donc des noms sans visuel d'équipe.

- [ ] Rechercher sur le web les logos officiels des clubs EuroLeague + EuroCup (~20 E + ~20 U)
- [ ] Choisir la source **et vérifier la licence d'usage** :
  - EB Brand Center (officiel, compte requis) — https://brandcenter.euroleague.net/
  - CDN du site officiel — https://www.euroleaguebasketball.net/en/euroleague/teams/
  - Repli Wikimedia Commons (licences variables → attribution obligatoire)
- [ ] Mapper `code` (VIR, MAD, PAO, OLY…) → URL de logo. Deux options :
  - [ ] **A. Map locale versionnée `data/euroleague_logos.json`** — zéro réseau, pas de
        CORS/rate-limit, mise à jour manuelle. **Recommandé.**
  - [ ] B. CDN direct depuis le composant — dépend de la dispo + `images.remotePatterns`
- [ ] Exposer le logo côté bridge (`EuroLeagueGame.home/away.logo`) ou le résoudre au rendu via le map
- [ ] Ajouter le domaine dans `next.config.ts` → `images.remotePatterns` si `next/image`
- [ ] Rendre le logo dans `src/components/basketball/basketball-calendar.tsx` : `alt` accessible
      + repli initiales si 404 (même pattern que ESPN/WNBA déjà en place)
- [ ] Vérif prod : logos visibles EuroLeague **et** EuroCup, **0 404 image** en console

### Lot 2 — Popup match EuroLeague : stats + 3 bets prematch (offre 1xbet)

**Objectif UX** : cliquer un match EuroLeague ouvre un popup (stats comparatives des
2 équipes + 3 paris prématch), sur le modèle de
`src/components/basketball/basketball-match-detail-dialog.tsx` (déjà en place NBA/WNBA).

**Contraintes produit imposées par David** : chaque pari affiché doit avoir un
**winrate modèle ≥ 60 %** *et* une **cote 1xbet ≥ 1,15** — sinon il n'est pas proposé.

| # | Marché | Libellé popup |
|---|---|---|
| 1 | Moneyline | « Winrate % » (vainqueur) |
| 2 | Total points | « Over / Under points du match » |
| 3 | Spread | « Handicap » |

- [ ] Brancher les cotes **1xbet** de ces 3 marchés (scraper ou API) + mapper les libellés 1xbet
- [ ] Moteur de proba **par marché** : compléter le walk-forward existant
      (`/api/v1/basketball/backtest`) pour calibrer moneyline / total / spread séparément
- [ ] Filtre dur : garder uniquement `proba ≥ 0.60` **ET** `cote ≥ 1.15` ; afficher cote + EV + Kelly
- [ ] Endpoint dédié `GET /api/v1/basketball/euroleague/{id}/prematch-bets` (cache `createTtlCache`)
- [ ] Popup : bloc stats comparatif + 3 cartes de pari (état vide si < 3 marchés qualifiés)

### 📊 Métriques cohérentes pour comparer 2 équipes de basket (recherche 2026-10-01)

Base : les métriques par **100 possessions** sont les seules comparables entre ligues
(un match NBA ~100 possessions, un match EuroLeague ~70) — c'est ce qui permet de
réutiliser un même modèle NBA/WNBA/EuroLeague.

| Priorité | Métrique | Formule / définition | Usage |
|---|---|---|---|
| 1 | **Net Rating** | ORTG − DRTG | Le prédicteur le plus stable du succès long terme |
| 1 | **Offensive Rating (ORTG)** | points marqués / 100 possessions | Force offensive normalisée |
| 1 | **Defensive Rating (DRTG)** | points encaissés / 100 possessions | Force défensive normalisée |
| 2 | **Pace** | possessions / 48 min | Détermine le **total points** attendu |
| 2 | **Four Factors — eFG %** (poids ~40 %) | (FG + 0,5 × 3P) / FGA | Efficacité au tir (qualité > volume) |
| 2 | **Four Factors — TOV %** (~25 %) | balles perdues / possessions | Contrôle du ballon |
| 2 | **Four Factors — ORB %** (~20 %) | rebonds off. / rebonds off. dispo | Deuxièmes chances |
| 2 | **Four Factors — FTr** (~15 %) | LF tentés / FG tentés | Agressivité, fin de match |
| 3 | **Forme 10 derniers matchs** | Net Rating sur les 10 derniers | Momentum / blessures |
| 3 | **Repos + déplacement** | jours de repos, back-to-back, trajet | Biais récurrent en Euroligue (déplacements longs) |
| 3 | **H2H récent** | 3-5 dernières confrontations | Complément, **jamais** seul (échantillon faible) |
| 4 | **Adjusted Rating** | ORTG/DRTG ajustés à la force des adversaires | Indispensable si les calendriers sont hétérogènes |

**Règle de sélection** : garder peu de métriques (5-6) et **non corrélées entre elles** —
Net Rating, Pace, eFG %, TOV %, ORB % couvrent déjà attaque/défense/rythme/rebond.
Trop de features corrélées dégradent la calibration (et donc la fiabilité du ≥ 60 %).

**Sources** :

- [Four Factors of Basketball (Statathlon)](https://statathlon.com/four-factors-basketball-success/) — poids officiels Oliver (eFG% 40 / TOV% 25 / ORB% 20 / FTR 15)
- [Advanced basketball stats: team statistics (Northwestern)](https://sites.northwestern.edu/nusportsanalytics/2021/04/05/an-introduction-to-advanced-basketball-statistics-team-statistics/)
- [NBA metrics for outcome predictions (Nbastuffer)](https://www.nbastuffer.com/nba-metrics-for-outcome-predictions/) — Net Rating vs chance
- [How to understand NBA stats, guide 2026 (SportsVisio)](https://www.sportsvisio.com/stories/how-to-understand-nba-stats) — ORTG/DRTG/Net Rating/Pace
- [Dunks & Threes](https://dunksandthrees.com/) — ratings ajustés + prédictions de match

---


---

## 🧰 Frontend Tier 1 Skills — INSTALLÉS (2026-07-20 01:00)

> **Objectif** : équiper le poste pour la refonte tennis avec les meilleurs skills
> frontend externes (data-viz, audit qualité, design review). +1 bug corrigé au passage.

### ✅ 10 nouveaux skills installés dans `.agents/tools/`

| # | Skill | Source | Rôle pour la refonte tennis |
|---|---|---|---|
| 1 | **`tufte-data-viz`** | [caylent/tufte-data-viz](https://github.com/caylent/tufte-data-viz) | 🎯 **Le + critique** : data-viz Tufte (Recharts/ECharts/D3/Chart.js). Un site tennis vit à 80% sur des charts (scores, momentum, stats joueurs). Aucun équivalent avant. |
| 2 | `web-quality-audit` | [addyosmani/web-quality-skills](https://github.com/addyosmani/web-quality-skills) | Audit Lighthouse global (perf/CWV/SEO/a11y/best-practices) |
| 3 | `accessibility` | addyosmani | WCAG / a11y (complète `fec-accessibility-testing` MCP) |
| 4 | `best-practices` | addyosmani | Lighthouse best-practices |
| 5 | `core-web-vitals` | addyosmani | LCP/INP/CLS — critique pour mobile live scores |
| 6 | `performance` | addyosmani | Audit perf |
| 7 | `seo` | addyosmani | Audit SEO (SportsEvent JSON-LD déjà présent) |
| 8 | `design-review` | [jezweb/claude-skills](https://github.com/jezweb/claude-skills) | QA visuelle sémantique (layout/typo/hiérarchie/responsive). Pallie le manque de `visual-regression` (pixel-diff ≠ critique sémantique). |
| 9 | `tailwind-theme-builder` | jezweb | Builder thème Tailwind v4 |
| 10 | `react-patterns` | jezweb | Patterns React (composition, hooks) |

### ✅ Bonus installés

- **`ui-ux-pro-max-cli` v2.11.0** (npm global) — 161 règles design, 84 UI styles,
  161 color palettes, 73 font pairings, 99 UX guidelines, 25 chart types, 17 stacks.
  Utilisable via `uupm <command>` dans les prompts.
- **`.agents/design-md/`** (74 DESIGN.md de marques premium : airbnb, apple, claude,
  cursor, linear, vercel, stripe, coinbase…). **Resource, pas un skill** — à référencer
  dans `DESIGN_CHARTER.md` ou les prompts pour aligner la refonte sur un style marque.

### 🐛 Bug corrigé : `scripts/sync-skills.js:28`

**Symptôme** : `❌ opencode.json introuvable` quand on lance `node scripts/sync-skills.js`.

**Root cause** : chemin hardcoded `opencode.json` à la racine du projet, mais le fichier
réel est dans `.opencode/opencode.json`.

```diff
- const OPENCODE_JSON = path.join(PROJECT_ROOT, "opencode.json");
+ const OPENCODE_JSON = path.join(PROJECT_ROOT, ".opencode", "opencode.json");
```

**Impact** : sans ce fix, `sync-skills.js` ne pouvait jamais écrire l'allowlist.
L'AGENTS.md documentait le script comme fonctionnel mais personne ne l'avait
déclenché en vrai — l'allowlist OpenCode restait vide (`"skill": []`).

### 📊 État final vérifié

| Indicateur | Avant | Après |
|---|---|---|
| Total skills `.agents/tools/` | 153 | **164** (+11) |
| Allowlist `opencode.json` | 0 (broken) | **164** ✅ synchronisée |
| Junction `.opencode/skills` → `.agents/tools` | ✅ active | ✅ toujours active |
| Skills visibles ZCode + OpenCode | 153 | **164** (les 2 côtés) |

### 🧹 Cleanup effectué

- Supprimé `.agents/ttools/` (faute de frappe lors du 1er `cp`, doublon de `tufte-data-viz`)

### 📁 Fichiers modifiés/créés

```
M  scripts/sync-skills.js                         (bug path fix)
M  .opencode/opencode.json                        (allowlist 0 → 164)
M  todo.md                                        (ce compte-rendu)
?? .agents/tools/tufte-data-viz/                  (NEW skill)
?? .agents/tools/web-quality-audit/               (NEW skill)
?? .agents/tools/accessibility/                   (NEW skill)
?? .agents/tools/best-practices/                  (NEW skill)
?? .agents/tools/core-web-vitals/                 (NEW skill)
?? .agents/tools/performance/                     (NEW skill)
?? .agents/tools/seo/                             (NEW skill)
?? .agents/tools/design-review/                   (NEW skill)
?? .agents/tools/tailwind-theme-builder/          (NEW skill)
?? .agents/tools/react-patterns/                  (NEW skill)
?? .agents/design-md/                             (NEW — 74 DESIGN.md de marques)
```

### 🧪 Test post-install

Dans une nouvelle session ZCode :

```
Utilise tufte-data-viz pour me proposer 3 visualisations Recharts
pour comparer les stats de service de deux joueurs de tennis
(1st serve %, break points, aces).
```

Si le skill se déclenche → install OK.

### 📝 Procédure (PowerShell) — pour mémoire

Les commandes exactes exécutées (utiles pour réinstaller sur un autre poste) :

```powershell
# 1. tufte-data-viz (clone + copie)
cd $env:TEMP
git clone --depth 1 https://github.com/caylent/tufte-data-viz.git
Remove-Item -Recurse -Force tufte-data-viz\.git
Copy-Item -Recurse -Force tufte-data-viz C:\Users\David\ZCodeProject\pariscore\.agents\tools\

# 2. web-quality-skills (6 sous-skills)
git clone --depth 1 https://github.com/addyosmani/web-quality-skills.git
$skills = @("accessibility","best-practices","core-web-vitals","performance","seo","web-quality-audit")
foreach ($s in $skills) {
  Copy-Item -Recurse -Force "web-quality-skills\skills\$s" `
    C:\Users\David\ZCodeProject\pariscore\.agents\tools\
}

# 3. jezweb (design-review + 2 bonus)
git clone --depth 1 https://github.com/jezweb/claude-skills.git jezweb-claude-skills
@("design-review","tailwind-theme-builder","react-patterns") | ForEach-Object {
  Copy-Item -Recurse -Force "jezweb-claude-skills\plugins\frontend\skills\$_" `
    C:\Users\David\ZCodeProject\pariscore\.agents\tools\
}

# 4. ui-ux-pro-max (CLI npm global)
npm install -g ui-ux-pro-max-cli

# 5. awesome-design-md (resource dans .agents/design-md/, PAS un skill)
git clone --depth 1 https://github.com/VoltAgent/awesome-design-md.git
New-Item -ItemType Directory -Force C:\Users\David\ZCodeProject\pariscore\.agents\design-md | Out-Null
Copy-Item -Recurse -Force awesome-design-md\design-md\* `
  C:\Users\David\ZCodeProject\pariscore\.agents\design-md\

# 6. Sync OpenCode allowlist
cd C:\Users\David\ZCodeProject\pariscore
node scripts\sync-skills.js
node scripts\sync-skills.js --verify-junction

# 7. Cleanup temp
Remove-Item -Recurse -Force tufte-data-viz, web-quality-skills, jezweb-claude-skills, awesome-design-md
```

### 🎯 Prochaines étapes suggérées

- [ ] **Redémarrer ZCode** (fermer/rouvrir la fenêtre) pour redécouverte des skills
- [ ] **Tester `tufte-data-viz`** sur un cas concret (ex : serve stats bar chart)
- [ ] **Tester `design-review`** sur la carte tennis actuelle
- [ ] **Tester `core-web-vitals`** sur `/setpoint/` (LCP/INP/CLS)
- [ ] **Référencer un DESIGN.md** (ex : `.agents/design-md/linear/DESIGN.md`) dans la
      refonte tennis comme north-star visuel
- [ ] **Commit atomique** : `feat(skills): install Tier 1 frontend skills + fix sync-skills path bug`
- [ ] Voir plus loin : installer les MCP top picks (Context7, Chrome DevTools MCP, shadcn MCP)
      — voir section "Références web" du plan de refonte

---

## 🎾 REFONTE ANALYSE TENNIS — Plan complet (2026-07-20)

> **Objectif** : Refonte complète de l'analyse tennis (live + prematch) avec stats
> marquantes inspirées des leaders du marché (Sofascore, Flashscore, Livesport,
> ATP/WTA). Cibler un visuel premium "quant terminal" sans tomber dans l'AI-slop.
>
> **Périmètre** : `src/components/tennis/*` (20 fichiers, 4 232 lignes) +
> `src/components/football/tennis-tab-content.tsx` + `src/app/api/tennis/*`.
>
> **Méthode** : skills `impeccable` + `hallmark` + `design-system-unify` +
> `react-component-design` + `react-nextjs-patterns`. Validation `visual-regression`
> + Playwright MCP à chaque étape.

---

### 📸 1. État des lieux — Visuel actuel (capture analysée)

La capture fournie montre le **match Alafia Ayeni vs Duncan Chan** sur SetPoint :

- **Layout** : carte duelle symétrique, photos joueurs centrées, anneau de probabilité
  circulaire autour de chaque photo, badge "VS" au centre.
- **Stats** : stateline mono-ligne (`#rank · Elo · SPS`), forme en points (W/L),
  grille de chips indicateurs en bas (Forme / Écart Elo / Surface / H2H / IC / Confiance).
- **Couleurs** : palette sombre navy + accents emerald/rose/amber.
- **Verdict** : design propre mais **trop prédictif, pas assez "live"**. Aucun score
  tennis réel affiché (pas de `6-4 6-3 3-2`), densité typographique faible pour un
  produit destiné à des parieurs data-driven. Manque cruel de stats serve/return.

**Le problème central** (validé par audit code) : la card affiche "Set N" au lieu du
score set-par-set. C'est l'info #1 attendue sur une card tennis live et elle est **absente**.

---

### 🛠️ 2. Skills frontend disponibles (inventaire local)

Source : `.agents/tools/` (145 skills). Voici les **14 skills frontend pertinents**,
classés par rôle dans la refonte :

#### A. UI engineering / craft (noyau)

| Skill | Rôle dans la refonte | Priorité |
|---|---|---|
| **`impeccable`** | Skill flagship v3.9.1 — redesign craft (UX review, hiérarchie, motion, micro-interactions). Sous-commandes `craft` / `shape` / `audit` / `polish`. | 🔴 **CRITICAL** |
| **`hallmark`** | Anti-AI-slop — garantit la variété structurelle (lignée Anthropic frontend-design). Audit + extract design depuis URLs. | 🔴 **CRITICAL** |
| **`design-system-unify`** | Orchestrateur Pariscore — 3 phases (tokens, tab cleanup, Hallmark fixes). Conçu pour `pariscore.html` mais applicable aux composants React. | 🔴 **CRITICAL** |
| **`shadcn-ui`** | Automatisation shadcn/ui v4 — 48 composants déjà dans `src/components/ui/`. Token mapping navy/neon-green. | 🟠 **HIGH** |
| **`sketch-findings-pariscore`** | Décisions design validées pour le redesign premium dark : palette `#0b0e17/#131722/#00e676/#0077ff`, spider chart, modal tennis 20+ métriques, nav 18 sports. | 🟠 **HIGH** |
| **`web-design-guidelines`** | Conformité Vercel Web Interface Guidelines. | 🟡 **MEDIUM** |

#### B. Architecture React (patterns)

| Skill | Rôle | Priorité |
|---|---|---|
| **`react-component-design`** | API composants senior — composition, compound/headless, interfaces props, TS typing. | 🔴 **CRITICAL** |
| **`react-nextjs-patterns`** | Next.js 15 App Router + React 19 — stack identique à Pariscore (shadcn/ui, TanStack Query, Zustand, RHF+Zod). | 🟠 **HIGH** |
| **`react-modern-react`** | Patterns React 19 (useActionState, useOptimistic, Suspense+use(), React Compiler, RSC). | 🟠 **HIGH** |
| **`react-api-consumer`** | TanStack Query + fetch, états loading/error/empty/refetching, optimistic updates — **parfait pour les feeds live tennis**. | 🟠 **HIGH** |
| **`react-styling`** | Tailwind v4, tokens design, responsive, Framer Motion, dark mode. Règle "no magic numbers". | 🟠 **HIGH** |
| **`react-utility-snippets`** | Hooks SSR-safe : `useAnnouncer`/`<LiveRegion>` (**critique pour screen reader live scores**), `useMediaQuery`, `useInterval`. | 🟠 **HIGH** |
| **`react-performance`** | Core Web Vitals (LCP/INP/CLS), lazy load, memoization. | 🟡 **MEDIUM** |

#### C. Vérification visuelle

| Skill | Rôle | Priorité |
|---|---|---|
| **`visual-regression`** | Workflow screenshot diff Playwright-MCP avant/après sur les 25 pages. | 🟠 **HIGH** |
| **`playwright-mcp`** | Microsoft Playwright MCP — Chromium/WebKit/Gecko, screenshots, DOM extraction. Déjà dans `.mcp.json`. | 🟠 **HIGH** |
| **`fec-accessibility-testing`** | axe-core / jest-axe / @axe-core/playwright pour WCAG. | 🟡 **MEDIUM** |
| **`fec-global`** | Front-End Checklist MCP (385 règles). | 🟡 **MEDIUM** |

#### D. Génération visuelle IA (optionnel)

| Skill | Rôle | Priorité |
|---|---|---|
| **`stitch-design-generate`** | Google Stitch — génère des écrans depuis texte/images, édite via prompts + design tokens. | 🟡 **MEDIUM** |
| **`stitch-build-react`** | Convertit designs Stitch → composants Vite/React modulaires (validation AST). | 🟡 **MEDIUM** |
| **`higgsfield-product-photoshoot`** | Imagerie joueurs (hero/banner) qualité brand. | 🟢 **LOW** |

---

### 🌐 3. Références web — visuels tennis marquants (live + prematch)

#### A. Standards de l'industrie (benchmarks design)

| Référence | URL | Ce qu'il faut copier |
|---|---|---|
| **Sofascore Tennis** | [sofascore.com/tennis](https://www.sofascore.com/tennis) | Layout 2-colonnes P1/métrique/P2, momentum chart point-par-point, stats leaders tournoi, last-10 form. **Gold standard.** |
| **Flashscore Tennis** | [flashscoreusa.com/tennis](https://www.flashscoreusa.com/tennis/) | Aces, DF, serve %, serve points won — layout 2-colonnes avec raw counts `% (16/28)`. **Plus fiable que Google** selon r/tennis. |
| **Livesport Point-by-Point** | [livesport.com/en/tennis](https://www.livesport.com/en/tennis/) | Onglet PBP, break/set/match points highlightés, lost serves marqués. |
| **ASN DMatchPlay momentum chart** | [asndsports.com/tennis-momentum-chart/](https://asndsports.com/tennis-momentum-chart/) | Line chart momentum shifts — **la référence directe pour notre `momentum-dr.tsx`**. |
| **Sofascore "Decoding Tennis Stats"** | [sofascore.com/news/decoding-tennis-stats](https://www.sofascore.com/news/decoding-tennis-stats-from-aces-and-break-points-to-service-games-and-set-wins) | Taxinomie officielle : aces, break points, service games, set wins. |
| **Exemple match stats Flashscore** | [Vekic v Ann Li](https://www.flashscoreusa.com/game/tennis/li-ann-rwvAgOWm/vekic-donna-AsWv5414/summary/stats/) | Concret : `56% vs 57% (16/28)` pour 1st serve %. |
| **ATP Pressure Stats** | [atptour.com/en/stats/leaderboard?boardType=pressure](https://www.atptour.com/en/stats/leaderboard?boardType=pressure) | Nouvelle métrique "pressure" — différenciation premium. |
| **WTA Tennis Stats** | [wtatennis.com/stats](https://www.wtatennis.com/stats) | Aces, DF, 1st serve %, service points won %. |
| **Tennis Abstract** | [tennisabstract.com](https://www.tennisabstract.com/) | Milliers de charts PBP détaillés — référence data viz pure. |

#### B. Inspiration UI (galleries)

- [Dribbble — tennis app UI](https://dribbble.com/search/tennis-app-ui) · [tennis score](https://dribbble.com/search/tennis-score) · [app tennis](https://dribbble.com/search/app-tennis)
- [Pinterest — live score app UI design](https://www.pinterest.com/ideas/live-score-app-ui-design/958843649952/)
- [Apple Sports app redesign 2025 (TechCrunch)](https://techcrunch.com/2025/06/25/apple-sports-app-adds-live-tennis-scores-and-a-redesigned-home-screen/) — benchmark UX 2025.
- [TennisVision React Native template (YouTube)](https://www.youtube.com/watch?v=USv46z-Ol4M) — live scores + player DB + live analysis.
- [Reddit — critique design tennis app](https://www.reddit.com/r/Design/comments/1q74ado/how_about_this_tennis_app_scores_design/)

#### C. Librairies de charts (stack technique)

| Lib | Use case tennis | Lien |
|---|---|---|
| **shadcn/ui Charts** (Recharts) | Radar comparatif P1/P2, bar charts stats — déjà dans le stack | [ui.shadcn.com/charts](https://ui.shadcn.com/charts) · [radar](https://ui.shadcn.com/charts/radar) |
| **Recharts** | Charts standards, SVG, RTL-testable | [recharts.org](https://recharts.org/) |
| **ECharts** | Momentum live **haute fréquence** (point-par-point stream) — Recharts rame sur gros datasets | [echarts.apache.org](https://echarts.apache.org/) |
| **Nivo** | Esthétique polie pour stats statiques | [nivo.rocks](https://nivo.rocks/) |
| **Tremor** | Dashboard-focused, dark mode v3 | [tremor.so](https://tremor.so/) |
| **Visx** (Airbnb) | Viz branded custom max | [airbnb.io/visx](https://airbnb.io/visx) |
| **SciChart** | Temps réel haute perf (live in-game) | [scichart.com](https://www.scichart.com/) |

Comparatif : [PkgPulse Recharts v3 vs Tremor vs Nivo](https://www.pkgpulse.com/guides/recharts-v3-vs-tremor-vs-nivo-react-charting-2026) ·
[FusionCharts top React chart libs](https://www.fusioncharts.com/blog/best-react-chart-library/) ·
[Ably top 11 streaming chart libs](https://ably.com/blog/top-react-chart-libraries) ·
[recharts#6574 (limites gros datasets)](https://github.com/recharts/recharts/discussions/6574).

#### D. Animation / live ticker

- **Motion `AnimateNumber`** — [motion.dev/docs/react-animate-number](https://motion.dev/docs/react-animate-number) — 2.5kb officiel, **top pick pour count-up scores**.
- [Build UI Animated Counter](https://buildui.com/recipes/animated-counter) — Framer Motion spring.
- [LogRocket best React animation libs 2026](https://blog.logrocket.com/best-react-animation-libraries/) ·
  [Spell UI 15 best libs](https://spell.sh/blog/best-react-animation-libraries).
- **WebSockets temps réel** : [Ably WebSockets React (sports example)](https://ably.com/docs/tutorials/react-websockets) ·
  [Velt WebSockets React](https://velt.dev/blog/websockets-react).

#### E. Datasets / data sources

- [JeffSackmann/tennis_MatchChartingProject](https://github.com/JeffSackmann/tennis_MatchChartingProject) — PBP ATP/WTA/ITF/Slams (dataset canonique).
- [JeffSackmann/tennis_atp](https://github.com/JeffSackmann/tennis_atp) — historical ATP matches.
- [haroldmli/04-Tennis-Point-by-Point-Project](https://github.com/haroldmli/04-Tennis-Point-by-Point-Project) — live ATP scraping + win-odds model.
- [GitHub topic tennis-score](https://github.com/topics/tennis-score) — Flutter apps real-time scores.

---

### 🔍 4. Audit composants actuels — problèmes identifiés

> Source : audit complet des 20 fichiers `src/components/tennis/*` (4 232 lignes).

#### 🔴 CRITICAL

1. **Aucun score set-par-set visible nulle part** — `match-card-header.tsx:87` affiche
   juste `t("set", { n })` ("Set N") au lieu de `6-4 6-3 3-2`. `liveState.scoreA.sets`
   est peuplé (`use-live-matches.ts:98-99`) mais **jamais rendu**. Standard absolu absent.
2. **Date hardcoded `"fr-FR"`** dans `match-card-header.tsx:53` — ignore le `locale`
   i18n (alors que `match-detail-dialog.tsx:95` utilise `DATE_LOCALE[locale]` correctement).
   Bug UX en anglais.
3. **Bug labels set dans `momentum-dr.tsx`** — `setDividers` (l.126) utilise `set: s` puis
   affiche `S${d.set + 1}` (l.312), et `setWinners[i]` affiche `S${i+1}` (l.437)
   séparément. Risque double/comptage erroné.

#### 🟠 HIGH

4. **Densité typo extrême dans `momentum-dr.tsx`** — `text-[10px]`, `text-[9px]`,
   `text-[8px]`, `text-[7px]` — illisible mobile, non conforme WCAG (min 12px).
5. **`live-stats-panel.tsx` table** colonnes 35/30/35% débordent avec noms longs
   (Alcaraz, Rune) — pas de `truncate` ni tooltip.
6. **Per-set breakdown `live-stats-panel.tsx:255-299`** — pure table texte, seulement
   Aces/DF. Pas de winner / 1st serve % / BP par set.
7. **`match-detail-dialog.tsx:152-156, 176-180`** — `<img>` sans `onError`, sans
   placeholder, sans ratio fixe → layout shift + images cassées.
8. **Tooltip SVG `momentum-dr.tsx`** — inaccessible clavier (mousemove only), pas de
   `role="img"`, pas de `<title>`, ARIA absent.
9. **`player-statline.tsx:115-117`** — tooltip SPS retiré ("causait probable crash
   hydration") → dette technique non résolue, SPS non expliqué.
10. **`odds-comparator.tsx:195-233`** — `<th onClick>` sans `role="button"`,
    `tabIndex`, `onKeyDown` → tri inaccessible clavier. Pas de `aria-sort`.

#### 🟡 MEDIUM

11. **`probability-bar.tsx:78`** — tick médian `bg-white` pur, invisible en dark mode
    (devrait être `bg-foreground`).
12. **Décomposition IC `probability-bar.tsx:95-113`** — 3 segments codés en dur
    (elo/form/h2h) avec `title=` natif seulement, pas de légende.
13. **Pas de breadcrumb de jeu/point en cours** (15-30-40-AD) — standard minimal live.
14. **4 `ServiceCircle` (`live-stats-panel.tsx:232-253`)** dupliquent l'info "% 1er
    service" déjà en table (l.37) — redondance.
15. **`match-card-detail.tsx`** duplique quasi à l'identique les 4 indicateurs de
    `stats-indicators-grid.tsx` — deux sources de vérité pour les mêmes métriques.
16. **`momentum-dr.tsx:9`** — `DR_HISTORY_MAX = 36` perd l'historique des sets
    précédents en 5 sets (Grand Chelem).
17. **Couleurs hardcoded** `#22c55e`/`#3b82f6` dans 3 composants au lieu d'utiliser
    `player.color` — casse la cohérence.

#### 🟢 LOW

18. **`match-card-header.tsx`** — `liveState!` non-null assertion (l.87) → crash potentiel.
19. **Textes FR hardcodés** : `"Chargement…"`, `"Historique indisponible"`
    (`match-detail-dialog.tsx:410`), `"Service:"`, `"pts suivis"`
    (`momentum-dr.tsx:259,447`), `"Retry"`, `"No live stats available"`
    (`live-stats-panel.tsx`) — i18n incomplet.

---

### 📋 5. Plan de refonte par phases

#### Phase 0 — Setup & audit (1 jour)

- [ ] **0.1** Lancer `impeccable audit` sur `src/components/tennis/` → capture baseline
- [ ] **0.2** Lancer `hallmark` audit → détecter l'AI-slop résiduel
- [ ] **0.3** `visual-regression` : screenshots "avant" de toutes les cartes tennis
      (sauver dans `.context/screenshots/2026-07-20-tennis-refactor/before/`)
- [ ] **0.4** Vérifier `DESIGN_CHARTER.md` + `sketch-findings-pariscore` → aligner
      palette `#0b0e17/#131722/#00e676/#0077ff`
- [ ] **0.5** Créer branche `refonte-tennis-v2`

#### Phase 1 — Fixes CRITICAL (1 jour) 🔴

- [ ] **1.1** **Créer `SetScoreline.tsx`** — rend `6-4 6-3 3-2` depuis
      `liveState.scoreA.sets` / `scoreB.sets` + set en cours en gras.
      Source : `use-live-matches.ts:98`. Standard #1 manquant.
- [ ] **1.2** **Créer `CurrentGameScore.tsx`** — affiche `15/30/40/AD` + tiebreak depuis
      `liveState.scoreA.points`. Utilise `formatPoints()` déjà dans `match-card.tsx:62`.
- [ ] **1.3** **Créer `ServerIndicator.tsx`** — icône balle de tennis animée à côté du
      serveur (`lucide` `CircleDot` ou SVG custom). Remplace label texte gris
      `momentum-dr.tsx:258`.
- [ ] **1.4** **Intégrer 1.1 + 1.2 + 1.3 dans `match-card-header.tsx`** quand `isLive`.
      Remplacer `t("set", { n })` (l.87).
- [ ] **1.5** **Fix i18n date** `match-card-header.tsx:53` → `DATE_LOCALE[locale]`
      (extraire `DATE_LOCALE` dans `lib/i18n-locales.ts` partagé).
- [ ] **1.6** **Fix bug labels set** `momentum-dr.tsx:312,437` — aligner index, tests.

#### Phase 2 — Refonte `live-stats-panel.tsx` (2 jours) 🟠

- [ ] **2.1** **Créer `ServeStatsBars.tsx`** — 3 paires de barres horizontales
      comparatives (style Sofascore "Performance") : 1st serve in %, 1st serve won %,
      2nd serve won %. Utilise données existantes `live-stats-panel.tsx:37`.
- [ ] **2.2** **Créer `BreakPointsGrid.tsx`** — matrice set-par-set `2/3`
      (converted/faced) avec couleur taux conversion. Étendre le hook stats pour
      exposer `bp_faced` par set.
- [ ] **2.3** **Créer `SetBySetTable.tsx`** — table Sofascore-like par set : games won,
      aces, DF, 1st in %, BP faced/saved, winner highlight. Remplace per-set breakdown
      actuel (`live-stats-panel.tsx:255-299`).
- [ ] **2.4** **Supprimer les 4 `ServiceCircle`** (`live-stats-panel.tsx:232-253`) —
      redondants avec la nouvelle table.
- [ ] **2.5** **Ajouter `truncate` + tooltip** sur les headers de table (noms longs).

#### Phase 3 — Nouveaux composants live premium (2-3 jours) 🟡

- [ ] **3.1** **Créer `WinProbabilityChart.tsx`** — courbe live proba 0-100% au fil du
      match. Source : `liveProbA` (`LiveMatchState`). Lib : ECharts (streaming) ou
      Recharts (simple). Standard Sofascore/Flashscore In-Play.
- [ ] **3.2** **Créer `PointTimeline.tsx`** — timeline horizontale d'un jeu : chaque
      point marqué avec icône (ace/break/winner), zoomable. Source : `pointHistory`
      du hook momentum (déjà dispo `momentum-dr.tsx:70`).
- [ ] **3.3** **Créer `StatsRadarChart.tsx`** — radar 6 axes comparatif P1 vs P2
      (Aces, 1st%, BP saved, Ret won, etc.). Lib : shadcn Radar (Recharts).
      Standard Sofascore player comparison.
- [ ] **3.4** **Améliorer `momentum-dr.tsx`** — échelle typo mini 11px (WCAG),
      légende explicite, seuil opacity explicite, ARIA (`role="img"` + `<title>`),
      accessibilité clavier tooltip, `DR_HISTORY_MAX` adaptatif (5 sets).
- [ ] **3.5** **Ajouter `useAnnouncer` / `<LiveRegion>`** (`react-utility-snippets`)
      sur les scores live pour screen readers.

#### Phase 4 — Refonte prematch (1-2 jours) 🟠

- [ ] **4.1** **Créer `LastMatchesList.tsx`** — liste 10 derniers matchs : adversaire
      (drapeau+nom), score, tournoi, surface, résultat. Remplace BarChart binaire du
      form tab (`match-detail-dialog.tsx:355`).
- [ ] **4.2** **Migrer `<img>` → `next/image`** dans `match-detail-dialog.tsx:152-180`
      avec fallback + ratio fixe (résout layout shift + images cassées).
- [ ] **4.3** **Fusionner `match-card-detail.tsx` ↔ `stats-indicators-grid.tsx`** —
      une seule source de vérité pour les 4 métriques Forme/Écart Elo/Surface/H2H.
- [ ] **4.4** **Restaurer tooltip SPS** dans `player-statline.tsx` via lazy mount
      (`<Suspense>` + `dynamic()`) pour éviter le crash hydration. Intégrer
      `form-dots` inline.
- [ ] **4.5** **Fix `probability-bar.tsx`** — tick `bg-foreground`, décomposition
      interactive (légende + tooltip Radix).
- [ ] **4.6** **Fix `odds-comparator.tsx`** — `<th>` → `<button>` avec `aria-sort`,
      `onKeyDown`, focus visible.

#### Phase 5 — Polish & validation (1 jour)

- [ ] **5.1** **`impeccable polish`** pass finale — micro-interactions, transitions,
      hover states cohérents.
- [ ] **5.2** **`hallmark` audit final** — vérifier absence d'AI-slop.
- [ ] **5.3** **`visual-regression`** : screenshots "après" + diff vs Phase 0.3.
- [ ] **5.4** **`fec-accessibility-testing`** : axe-core sur toutes les cartes live.
- [ ] **5.5** **Tests Playwright** dans `tests/tennis-refactor.spec.ts` (Pérenniser —
      backlog ancien : "scripts temporaires supprimés").
- [ ] **5.6** **i18n complet** — extraire tous les FR hardcodés (Phase 4 + momentum-dr
      + live-stats-panel) vers `messages/{fr,en}.json` namespace `tennis`.
- [ ] **5.7** **Core Web Vitals** — `react-performance` : vérifier LCP/INP/CLS sur
      cartes live (surtout avec les nouveaux charts).
- [ ] **5.8** **Commit atomique par sous-phase** (règle `design-system-unify`) +
      `graphify update .` après chaque commit.

#### Phase 6 — Déploiement & monitoring

- [ ] **6.1** `bun run build` local + `node --check` sur tous les inline scripts
- [ ] **6.2** Deploy VPS : `git pull && bun install && bun run build && pm2 restart pariscore-next`
- [ ] **6.3** Vérif prod : 0 pageerror, 0 console.error, scores live visibles
- [ ] **6.4** `bd close` les tickets beads correspondants + `bd remember` les décisions

---

### 🆕 6. Nouveaux composants à créer (synthèse)

| # | Composant | Source data | Lib | Priorité |
|---|---|---|---|---|
| 1 | `SetScoreline` | `liveState.scoreA.sets` | Tailwind | 🔴 CRITICAL |
| 2 | `CurrentGameScore` | `liveState.scoreA.points` | Tailwind | 🔴 CRITICAL |
| 3 | `ServerIndicator` | `liveState.server` | lucide/SVG | 🔴 CRITICAL |
| 4 | `ServeStatsBars` | hook stats existant | Tailwind bars | 🟠 HIGH |
| 5 | `BreakPointsGrid` | hook stats (à étendre) | Tailwind grid | 🟠 HIGH |
| 6 | `SetBySetTable` | `perSet` hook stats | shadcn Table | 🟠 HIGH |
| 7 | `WinProbabilityChart` | `liveProbA` | ECharts/Recharts | 🟡 MEDIUM |
| 8 | `PointTimeline` | `pointHistory` momentum hook | SVG custom | 🟡 MEDIUM |
| 9 | `StatsRadarChart` | hook stats agrégé | shadcn Radar | 🟡 MEDIUM |
| 10 | `LastMatchesList` | API player-stats | shadcn List | 🟡 MEDIUM |
| 11 | `RankBadge` (▲▼) | hook player-stats | Badge | 🟢 LOW |
| 12 | `ServeSpeedIndicator` | API (si dispo) | Stat chip | 🟢 LOW |

---

### 🎯 7. Stack technique recommandée (décision)

- **UI** : `shadcn-ui` (déjà installé, 48 composants) + `impeccable` craft + `hallmark` audit
- **Charts standards** : shadcn Charts (Recharts) — radar, bar, line
- **Charts live haute fréquence** : **ECharts** pour momentum/WinProbability
  (Recharts rame sur gros datasets — recharts#6574)
- **Animation** : Motion `AnimateNumber` pour count-up scores + Framer Motion micro-interactions
- **Live updates a11y** : `useAnnouncer` / `<LiveRegion>` (`react-utility-snippets`)
- **Validation** : `visual-regression` + `playwright-mcp` + `fec-accessibility-testing`

**Séquence recommandée** : `impeccable audit` + `hallmark` → `design-system-unify`
phases → nouveaux composants via `react-component-design` + `react-nextjs-patterns`
→ wire live data via `react-api-consumer` + TanStack Query → charts (shadcn radar +
ECharts momentum) → animation Motion `AnimateNumber` → vérif `visual-regression`.

---

### 📊 8. Estimation effort

| Phase | Durée | Complexité |
|---|---|---|
| 0 — Setup & audit | 1 jour | S |
| 1 — Fixes CRITICAL | 1 jour | M |
| 2 — Refonte live-stats-panel | 2 jours | L |
| 3 — Nouveaux composants live premium | 2-3 jours | L |
| 4 — Refonte prematch | 1-2 jours | M |
| 5 — Polish & validation | 1 jour | M |
| 6 — Déploiement | 0.5 jour | S |
| **Total** | **8-10 jours** | — |

---

### 🔗 9. Fichiers clés à modifier

| Fichier | Lignes | Action |
|---|---|---|
| `src/components/tennis/match-card-header.tsx` | 114 | SetScoreline + date i18n |
| `src/components/tennis/match-card.tsx` | 603 | Intégrer nouveaux composants live |
| `src/components/tennis/live-stats-panel.tsx` | 303 | Refonte totale (ServeStatsBars, suppr ServiceCircle) |
| `src/components/tennis/momentum-dr.tsx` | 454 | A11y + typo + bug labels + history 5 sets |
| `src/components/tennis/match-detail-dialog.tsx` | 508 | next/image + LastMatchesList + extract sous-composants |
| `src/components/tennis/player-statline.tsx` | 217 | Restaurer tooltip SPS (lazy) + form-dots inline |
| `src/components/tennis/probability-bar.tsx` | 116 | tick bg-foreground + décomposition interactive |
| `src/components/tennis/odds-comparator.tsx` | 234 | a11y tri table |
| `src/components/tennis/match-card-detail.tsx` | 131 | Fusionner avec stats-indicators-grid |
| `src/components/tennis/stats-indicators-grid.tsx` | 232 | Source unique vérité |
| `src/hooks/use-live-matches.ts` | — | Étendre `bp_faced` par set si besoin |
| `src/app/api/tennis/live/route.ts` | — | Vérifier payload `pointHistory` |
| `messages/{fr,en}.json` | — | Namespace `tennis` complet |

---

### ✅ 10. Critères d'acceptation (Definition of Done)

- [ ] Carte live affiche `6-4 6-3 3-2 · 30-15 · 🎾 Sinner serving` (standard Sofascore)
- [ ] `ServeStatsBars` rend 1st serve in% / won% / 2nd won% en barres comparatives
- [ ] `SetBySetTable` affiche stats complètes par set (winner, aces, DF, BP)
- [ ] `WinProbabilityChart` trace la proba live au fil du match
- [ ] `StatsRadarChart` compare P1 vs P2 sur 6 axes
- [ ] `momentum-dr` lisible mobile (typo ≥ 11px) + accessible clavier + ARIA
- [ ] 0 texte FR hardcodé dans les composants tennis (i18n complet fr+en)
- [ ] `hallmark` audit : 0 AI-slop
- [ ] `fec-accessibility-testing` : 0 violation WCAG critique
- [ ] `visual-regression` : diff validé sur les 25 pages
- [ ] Core Web Vitals : LCP < 2.5s, INP < 200ms, CLS < 0.1 sur cartes live
- [ ] Prod : 0 pageerror, 0 console.error après deploy

---

### 🔗 Sources web principales

- [Sofascore Tennis](https://www.sofascore.com/tennis) · [Decoding Tennis Stats](https://www.sofascore.com/news/decoding-tennis-stats-from-aces-and-break-points-to-service-games-and-set-wins)
- [Flashscore Tennis](https://www.flashscoreusa.com/tennis/) · [Exemple match stats](https://www.flashscoreusa.com/game/tennis/li-ann-rwvAgOWm/vekic-donna-AsWv5414/summary/stats/)
- [Livesport Point-by-Point](https://www.livesport.com/en/tennis/)
- [ASN DMatchPlay momentum chart](https://asndsports.com/tennis-momentum-chart/)
- [ATP Pressure Stats](https://www.atptour.com/en/stats/leaderboard?boardType=pressure) · [WTA Stats](https://www.wtatennis.com/stats)
- [shadcn Charts](https://ui.shadcn.com/charts) · [Recharts](https://recharts.org/) · [ECharts](https://echarts.apache.org/)
- [Motion AnimateNumber](https://motion.dev/docs/react-animate-number)
- [Ably WebSockets React](https://ably.com/docs/tutorials/react-websockets)
- [JeffSackmann/tennis_MatchChartingProject](https://github.com/JeffSackmann/tennis_MatchChartingProject)

---

## 🔴 PRIORITÉ DEMAIN (2026-07-20) — Décision simu tennis-live + push fix elo-history

### ✅ BUG A9 RÉSOLU (2026-07-20 00:15) — ErrorBoundary prod

**Status** : ✅ **VALIDÉ PLAYWRIGHT** — bug résolu, prod fonctionnelle.

**Root cause** (trouvée via stack trace Playwright par agent `e80b3493`) :
- `TypeError: matches is not iterable` dans `bookmaker-comparator-dialog.tsx:73`
- Route `/api/tennis/prematch` renvoyait en prod :
  ```json
  { "matches": { "data": [...], "source": "bsd", "at": 1784498157599 }, ... }
  ```
  au lieu de `{ "matches": [...] }` — `matches` était un **objet** au lieu d'un
  **tableau**.
- Le serveur ne loggait rien car pas d'exception — juste une shape JSON invalide
  qui crashait au `for...of` côté navigateur.

**Commit coupable** : `ce26a61` (cache globalThis, le mien).
Le helper `createTtlCache()` wrappe déjà dans `{ data, at }`, mais les 7 routes
migrées wrappaient **EN PLUS** manuellement dans `{ data, at }` → **double-wrap**.
`cached.data` retournait donc l'objet interne au lieu du tableau.

**Fix** (`8f686bb`) :
1. **7 routes API** : retiré le wrap manuel `{ data, at }`, stockage direct du payload
   (tennis/{prematch,live}, football/{matches,live}, cs2, cycling, f1)
2. **2 composants client** : défense en profondeur via normalisation
   `Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw.data : []`
   (bookmaker-comparator-dialog.tsx + tennis-tab-content.tsx)

**Validation Playwright post-deploy** :
- 0 pageerror, 0 console.error
- Match data présent : Ilya Ivashka service, sets 6-4 2-5, SPS 52 vs 59
- Cartes synthetic actives : "Renta Tokuda · Elo 1628 · SPS 54 beta ·
  Données live limitées" ← badge qui marche
- ErrorBoundary NON visible ✅
- Screenshot : `.context/screenshots/2026-07-19-evening/after-fix-8f686bb.png`

**Leçon apprise** : ne pas appliquer de fix sans stack trace exacte.
La 1ère théorie (Tooltip Radix `a70b300`) était fausse et a fait perdre du temps.
La 2ème itération (Playwright `e80b3493`) a capturé la stack trace réelle →
identification précise en <10 min.

---

### 🟡 Décisions en attente (2 agents encore running)

---

### 🟡 Décisions en attente (3 agents encore running)

**Survenu après** : deploy des commits récents (`616c502`, `af487e1`,
`bacc68d`, `ce26a61`, `fb7d3cd`).

**Investigation en cours** (3 pistes parallèles) :

1. **Agent `d65005ad`** (Playwright) — capture la stack trace navigateur
2. **Agent `9cb6f341`** (skill `code-reviewer`) — analyse statique des 4 commits
3. **Investigation manuelle** — grep ciblé des suspects

**Causes ÉLIMINÉES par investigation manuelle** :
- ❌ Refactor `cached-route.ts` cassé → imports/exports OK, pas utilisé côté client
- ❌ Imports manquants `Tooltip`/`Badge` → présents
- ❌ Clés i18n manquantes (`spsExperimentalBadge`, `syntheticBadge`) → présentes en fr+en
- ❌ Namespaces i18n (`match`, `tennis`, `statline`...) → tous définis
- ❌ API `/api/tennis/elo-history` qui crash → renvoie 404 JSON valide, hook gère

**Suspects restants** (à confirmer via stack trace) :
1. Hydration mismatch (`Date.now()`, `Math.random()` au render)
2. Re-render infini (`useMemo` avec `favorites: Set<string>` recréé)
3. `usePlayerStats` ou `useEloSparkline` qui throw au mount
4. Bug apparaissant uniquement en **build standalone** (minification/tree-shaking)

**Éliminé par investigation locale** :
- ❌ Reproduit en `bun run dev` : la page rend normalement (HTTP 200, SetPoint
  title présent, dictionnaire i18n complet). Le "Une erreur est survenue" n'est
  que la clé i18n sérialisée dans `__NEXT_DATA__`, pas l'ErrorBoundary rendu.
- ❌ Crash **non reproductible en dev** → typique d'un bug qui n'apparaît
  qu'en build standalone optimisé.

**Décision** : attendre les 2 agents (`d65005ad` Playwright prod + `9cb6f341`
code-reviewer) pour stack trace exacte. Fix ciblé ensuite, sans rollback
des fonctionnalités utiles (synthetic badge + SPS disclaimer).

**Théorie principale** (à valider par stack trace) :
- `bacc68d` ajoute un `<Tooltip>` Radix dans `player-statline.tsx`
- Rendu **558 fois** sur la page (chaque SPS visible)
- Pendant l'hydration, Radix attache des PointerEvent listeners + utilise `useId()`
- Si ordre/id diffère entre SSR et client → **hydration error** → ErrorBoundary catch
- Le HTML serveur est valide (83 Ko, contient SetPoint), mais l'hydration client casse

**Scénarios de fix préparés** :
1. **Si Playwright confirme Tooltip** → fix chirurgical : wrapper dans `<Suspense>`
   + `dynamic()` (rendu client-only) ou enlever le Tooltip (badge statique)
2. **Si Playwright pointe ailleurs** → revert ciblé du composant coupable

**Confirmation SSR** : `curl` direct à `localhost:3005` (bypass nginx) retourne
HTTP 200 + HTML valide 83 Ko contenant "SetPoint". Pas d'erreur serveur.
→ Le crash est **strictement côté client** (hydration React).

**ErrorBoundary actif** : `SentryErrorBoundary` dans `src/app/layout.tsx:167`
englobe `{children}` → attrape n'importe quelle erreur du rendu page. Affiche
"L'équipe a été notifiée" + bouton "Recharger la page".

---

### Contexte (où on s'est arrêtés, 2026-07-19 soir, ~23:25)

Session orchestrée par dispatch d'agents en parallèle. **13 commits poussés sur
origin/main** (`66437e2`..`fb7d3cd`), **3 deploys VPS** + nginx patché +
hot loop CPU tué à la racine. **Prod stable et optimisée** (avant bug).

**Vérifié en direct sur https://pariscore.fr/** :
- PM2 `pariscore-next` online sur HEAD `ce26a61`, CPU **0% stable** en steady state
- Hot loop `[bsd] Fetched 30 matches` : **70→1 par 5 min** après fix `globalThis`
- 7/7 endpoints principaux 200 (sauf `/api/cs2/matches` 404 — préexistant, hors nginx)
- Steady state après `pm2 flush` + 90s sans charge : 1 seul fetch BSD

### ✅ Deploys du soir (22:35 + 23:10)

| Heure | Action | Résultat |
|---|---|---|
| 22:35 | Deploy `bc2805f` | git pull + bun install + build + restart |
| 22:39 | nginx patch | 3 règles `/api/{football,nba,wnba}/` → :3005 |
| 23:10 | Deploy `ce26a61` | **Hot loop tué** (cache `globalThis` partagé multi-worker) |

### 🎯 Root cause hot loop CPU 100% (résolu)

**Source-side** (trouvé moi-même après arrêt agent `cbc0fb8d`) :
- Toutes les routes `/api/{tennis,football,cs2,cycling,f1}/*` utilisaient
  `let cache = ...` au niveau module
- **Next.js standalone prod** : chaque worker / hot-reload a sa propre copie
  → N× fetch BSD par fenêtre TTL
- Client poll à 30-60s + 5+ workers → multiplicateur ⇒ CPU saturé

**Fix** (`ce26a61`) :
- Nouveau helper `src/lib/cached-route.ts` : `createTtlCache()` + `isFresh()`
- Persiste le cache sur `globalThis` (partagé entre workers, survit au hot-reload)
- **7 routes migrées** : `tennis/{prematch,live}`, `football/{matches,live}`,
  `cs2/matches`, `cycling`, `f1`

**Validation prod** : `pm2 flush` + 90s sans charge = **1 seul fetch** (vs 38 avant).
Hot loop éliminé, CPU stable 0%.

### 🟡 Décisions en attente (2 agents running)

#### 🔴 A2 — Deception perçue scores simulés (1/3 résolu)

| # | Surface | Statut |
|---|---|---|
| 1 | Onglet Tennis (synthetic cards) | ✅ fixé (`616c502`) — dormant en prod ce soir |
| 2 | Route `/setpoint/` | ⏳ à traiter après plan `8f103161` |
| 3 | Mini-service `tennis-live` | ⏳ à remplacer (commit `95ff99d` + `14717b9`) |

Agent `8f103161` prépare le plan comparatif (Option A/B/C). Dès réception,
présenter à David pour décision produit.

#### 🟠 A5 — Bug 404 elo-history (76 erreurs/page)

Agent `d3e4e50d` tourne toujours. Pas de commit à 23:20. À pousser dès qu'il
termine — la route n'est pas critique visuellement mais pollue les logs error
et fausse le monitoring.

### ✅ Bugs SPS (audit `b28baee8`) — TOUS FIXÉS ce soir

| # | Bug | Fichier | Fix |
|---|---|---|---|
| P0-1 | Tri cassé : `rank: 0` des synthetic devant les vrais #1 | `use-match-filter.ts` | ✅ `bacc68d` — exclut `match.synthetic` + `\|\|` au lieu de `??` |
| P0-2 | Circuit ATP hardcodé dans sync WTA | `tools/sync-tennis-player-pids.js` | ✅ `af487e1` — lit `r.circuit` depuis source, fallback NULL |
| P0-3 | `norm()` inutilisé : matching cassé pour noms accentués | `tools/update-tennis-ranks.js` | ✅ `af487e1` — `OR LOWER(nm)=LOWER(?)` + post-filtre `norm()` JS |
| P0-4 | SPS non calibré + pas de disclaimer | `player-statline.tsx` | ✅ `bacc68d` — badge « beta » + tooltip |

**Backlog SPS reporté** (non bloquant) :
- `sps-utils.ts` 0 test unitaire (8 fonctions pures)
- `getSpsIndex` : `HAVING MAX(computed_at)` non-déterministe (SQLite bare column)
- `extractSPS.rank ?? 999` incohérent avec `fmtSPSRank` (affiche `#999` au lieu de `—`)
- `getPlayerStatsBatch` : N+1 requêtes (optimisable `IN (...)`)
- Backtest Brier walk-forward à publier dans la doc SPS

### ✅ Audit visuel Playwright (`594fa28b`) — VERDICT : prod OK

| Cible | Verdict |
|---|---|
| Synthetic live cards (`66437e2`) | Code déployé, **dormant** (0 synthetic en prod ce soir — tous live ont prematch ID) |
| SPS gauge 270° (`671b869`) | ✅ OK — 558 éléments, rendu propre |
| Tennis live BSD scores réels | ✅ OK — 7 matchs live, overlay + scores OK |
| Bug boutons Analyse/Stratégies (todo 18/07) | ✅ **RÉSOLU** sur Next.js (Dialog Radix fonctionne). Le bug `Scope._togglePremier`/`[PSCATCH]` était spécifique au monolithe vanilla **non déployé sur pariscore.fr** |
| Console | ⚠️ 1 bug : 76× 404 `/api/tennis/elo-history` à chaque chargement de page → fix `d3e4e50d` en cours |

**Screenshots** : `.context/screenshots/2026-07-19-evening/` (8 fichiers PNG/JSON).

### ✅ Tous les agents de la session — récap

| Agent | Mission | Statut | Livrable |
|---|---|---|---|
| Direct | Vérif VPS | ✅ | Sync `66437e2`, tennis live réel |
| `04b0ad83` | Sécurité synthetic | ✅ | 0 vuln bloquante, 1 🔴 deception |
| `4253382b` | Audit processes VPS | ✅ | tennis-live = simu, pariscore-next 100% CPU |
| `b1f9fb60` | Commits atomiques (6) | ✅ | `ed7e6ad`..`f5eeb9c` |
| `b28baee8` | Code review SPS | ✅ | 4 bugs bloquants identifiés |
| `d57ac9cc` | Fix synthetic badge | ✅ | `616c502` |
| `61a814c1` | Fix tools SPS P0-2/P0-3 | ✅ | `af487e1` |
| `587b2d94` | Fix frontend SPS P0-1/P0-4 | ✅ | `bacc68d` |
| `594fa28b` | Audit visuel Playwright | ✅ | Prod OK + bug 404 elo-history découvert |
| `cbc0fb8d` 🚨 | Diagnostic CPU pariscore-next | 🟡 running | — |
| `8f103161` | Plan remplacement simu tennis-live | 🟡 running | — |
| `d3e4e50d` | Fix 404 elo-history | 🟡 running | — |

### Backlog global reporté

- [ ] **Déprécier `pariscore` legacy (id 5)** : monolithe `server.js` 52 435 lignes
      en doublon avec `pariscore-next`. 458 restarts cumulés (SIGINT = déploiements).
      `max_memory_restart: 2G` override manuel vs `1G` dans ecosystem.
- [ ] **Backtest Brier SPS** à publier dans `.context/doc-sps-surface-power-score.md`
      avant toute mise en avant produit de la métrique (règle `pas de prod sans IC`).
- [ ] **Tests unitaires** `sps-utils.ts` (8 fonctions pures, 0 test).
- [ ] **Fix `npm run lint` OOM** sur `.venv-langflow/.../assets/index-CUSa5eDp.js`
      (Babel parser, >500KB). Problème préexistant confirmé par 2 agents.
- [ ] **Pérenniser tests Playwright** dans `tests/` (scripts temporaires supprimés).
- [ ] **Bug bouton tennis sidebar** (rollbacké 2026-07-11) — toujours en backlog.

### Fichiers clés session

| Fichier | Rôle |
|---|---|
| `src/components/football/tennis-tab-content.tsx:189-230` | Bloc synthetic cards (badge ajouté en `616c502`) |
| `src/components/tennis/match-card.tsx:100-101` | Appel `useEloSparkline` (source du 404) |
| `src/components/tennis/player-statline.tsx` | SPS + badge « beta » (`bacc68d`) |
| `src/hooks/use-match-filter.ts` | Tri rank/elo (fix `bacc68d`) |
| `src/app/api/tennis/elo-history/route.ts:26` | Lookup statique → 404 BSD |
| (VPS) `~/pariscore/mini-services/tennis-live/index.ts` | Simu socket.io port 3001 |
| (VPS) `~/pariscore/.next/standalone/server.js` | pariscore-next (CPU 100%) |

### Autres tâches reportées (backlog)

- [ ] **Décision `pariscore` legacy (id 5)** : monolithe 52 435 lignes tourne en
      doublon avec `pariscore-next`. Devrait être déprécié une fois migration
      confirmée. `max_memory_restart: 2G` override manuel (l'ecosystem dit `1G`).
- [ ] **Validation visuelle jauge 270°** (Rublev/Baez) — code validé unitairement,
      pas visuellement.
- [ ] **Pérenniser tests Playwright** dans `tests/` (scripts temporaires supprimés).
- [ ] **Beads** : créer un ticket pour tracer ce bug de deception si non résolu.

### Commandes utiles pour demain

```bash
# État VPS
ssh -i $USERPROFILE/.ssh/id_rsa_pariscore ubuntu@51.75.21.239 \
  'export PATH="/home/ubuntu/.bun/bin:$PATH"; pm2 list'

# Diagnostic CPU temps réel
ssh -i $USERPROFILE/.ssh/id_rsa_pariscore ubuntu@51.75.21.239 \
  'top -b -n 1 -p $(pgrep -f standalone/server.js)'

# Re-déployer après fix
ssh -i $USERPROFILE/.ssh/id_rsa_pariscore ubuntu@51.75.21.239 \
  'export PATH="/home/ubuntu/.bun/bin:$PATH"; cd ~/pariscore && git pull && bun install && bun run build && pm2 restart pariscore-next'

# Mise à jour Graphify
"/c/Users/David/AppData/Roaming/Python/Python312/Scripts/graphify.exe" update .
```

### Fichiers clés session

| Fichier | Rôle |
|---|---|
| `src/components/football/tennis-tab-content.tsx:189-226` | Bloc synthetic cards live |
| `src/components/football/tennis-tab-content.tsx:38-50` | `hashColor()` (sécurisé) |
| `src/hooks/use-live-matches.ts` | Hook source des matchs live BSD |
| `src/lib/bsd-fetcher.ts:194-305` | `fetchBSDLiveMatches()` → BSD `/api/v2/matches/live/` |
| `src/app/api/tennis/live/route.ts` | Cache TTL 30s, `BSD_TENNIS_ENABLED` gate |
| (VPS) `~/pariscore/mini-services/tennis-live/index.ts` | Simu socket.io port 3001 |
| (VPS) `~/pariscore/.next/standalone/server.js` | Pariscore-next (CPU 100%) |

---

## 🔴 PRIORITÉ DEMAIN (2026-07-18) — Debug boutons Analyse/Stratégies carte prematch

### Contexte (où on s'est arrêtés, 2026-07-17 soir)

David signale que les boutons **Analyse** / **Stratégies** de la carte prematch
tennis ne fonctionnent toujours pas, malgré le cache-buster bumpé
(`250711-04` → `250717-01`) déployé au commit `6d7a261`.

### État de l'investigation (Reviewer en chef — 6 tests Playwright le 17/07 soir)

**Le code est prouvé CORRECT en production** (test direct via Playwright sur le
VPS, commit `6d7a261`) :

```
Test 6 (clic réel après activation onglet Tennis) :
  visibleBtns: 154
  before: "none"        ← panneau fermé
  after: "block"        ← panneau OUVERT après clic
  afterLen: 5138        ← 5138 chars (Scouting/H2H/Top Bets)
  Erreurs: 0
```

`Scope._togglePremier(btn, 'analyse')` ouvre bien `#pdet-<id>` et injecte
5138 chars. **Aucune erreur console.** Le blocage est donc **côté client
navigateur**, pas dans le code serveur.

### Plan pour demain (par ordre de priorité)

#### Étape 1 — Obtenir la VRAIE erreur côté client (5 min)

Le code étant prouvé correct, il faut **l'erreur exacte côté navigateur**.
Demander à David :

1. Ouvrir `https://51.75.21.239/` en **navigation privée** (élimine cache +
   extensions).
2. Onglet **🔒 Tennis**.
3. Ouvrir la console **F12** avant de cliquer.
4. Cliquer sur **Analyse** d'une carte prematch.
5. **Screenshot de la console** (surtout si bannière rouge `[PSCATCH]`).
6. Onglet Network : vérifier que `pariscore.app.js?v=250717-01` est bien chargé.

→ Bannière `[PSCATCH]` : on a la stack exacte, correction ciblée.
→ Rien (aucune erreur, aucun toggle) : pointer-events / overlay intercepte le
  clic (cf. Étape 2).

#### Étape 2 — Vérifier le clic réel (Playwright approfondi)

Le test du soir a montré que `locator.click()` timeout (élément intercepté)
mais `btn.click()` direct marche. → suspect : **overlay CSS** avec
`pointer-events:auto` au-dessus du bouton. Vérifier `z-index` de la jauge,
`.sc-premier-gauge`, et tout élément `position:absolute`.

```js
// Script Playwright à recréer
import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await (await b.newContext({ignoreHTTPSErrors:true})).newPage();
await p.goto('https://51.75.21.239/',{waitUntil:'domcontentloaded'});
await p.waitForTimeout(4000);
// Activer tennis, trouver bouton visible, vérifier elementFromPoint au centre
const probe = await p.evaluate(() => {
  const nav=[...document.querySelectorAll('[onclick]')].find(e=>/tennis/i.test(e.textContent));
  if(nav)nav.click();
  // ... puis elementFromPoint sur le 1er .sc-premier-btn visible
});
```

#### Étape 3 — Piste onglet actif par défaut

Découvert : `#page-tennis` est en `display:none` au chargement. Vérifier :
- Quel onglet est actif au premier load ?
- Faut-il faire de Tennis l'onglet par défaut ?
- Le bouton "🔒 Tennis" est-il bien visible/cliquable sur mobile ?

#### Étape 4 — Si tout échoue : hardening défensif

Ajouter un fallback **event delegation** au document (si l'inline `onclick`
est cassé par un re-render) :

```js
document.addEventListener('click', function(e){
  var btn = e.target.closest('.sc-premier-btn');
  if (btn) { /* fallback si inline ne se déclenche pas */ }
});
```

À n'utiliser que si l'Étape 1 confirme que l'inline ne se déclenche pas.

### Autres tâches en suspens (backlog session courante)

- [ ] **Validation visuelle jauge** : confirmer le rendu réel de la jauge 270°
      (arc vert visible, aiguille, label "A.") sur Rublev/Baez. Code validé
      unitairement (9 probas, aucun NaN) mais pas visuellement.
- [ ] **Pérenniser les tests Playwright** dans `tests/` (les scripts
      temporaires `test-toggle*.mjs` ont été supprimés après usage).
- [ ] **Beads** : créer un issue `bd` pour tracer ce bug si pas résolu demain
      (profil conservateur → proposer la commande, ne pas l'exécuter).

### Commits récents (à conserver en tête)

- `6d7a261` — bump cache-buster (dernier déployé sur VPS)
- `af64bb5` — couleur jauge visible + aiguille + label initiale prénom
- `e05a392` — jauge orientée vainqueur prédit + vert réservé au favori
- `92bd6bc` — jauge Win désaxée refonte circle+dasharray
- `6ab61fe` — refonte jauge 270° + icônes + boutons (Phase 4 _premierDetailHTML)

### Commandes utiles pour demain

```bash
# État du déploiement
ssh ubuntu@51.75.21.239 "cd ~/pariscore && git log --oneline -3"

# Re-déployer si besoin
ssh ubuntu@51.75.21.239 "cd ~/pariscore && bash deploy.sh"

# Reproduire en local
bun run dev   # http://localhost:3000

# Mise à jour Graphify après modifs
"/c/Users/David/AppData/Roaming/Python/Python312/Scripts/graphify.exe" update .
```

### Mémo — Skills disponibles (ne pas réinventer)

- `gstack-investigate` — debug systématique root-cause
- `gstack-qa` — QA visuelle navigateur (ouvre un vrai browser, trouve bugs)
- `bd` (beads) — issue tracking (`bd ready`, `bd show <id>`, `bd close <id>`)
- `graphify explain "<concept>"` — interroger le graphe de connaissance

---

*Créé le 2026-07-17 soir. Code prouvé correct — la clé demain est d'obtenir
l'erreur console côté client (F12) ou le screenshot de la bannière [PSCATCH].*

---

## 🔴 PRIORITÉ DEMAIN (2026-07-14) — Unification du design system (post-audit Hallmark)

> ⚠️ **LIRE D'ABORD : `REDESIGN_WORKFLOW_OPENCODE.md`** — workflow complet avec Gantt,
> dépendances, chemin critique, protocole git/VPS strict, indicateurs de succès.
> Ce fichier (`todo.md`) reste la référence pour le détail des tâches (file:line).

### 📖 À lire avant de coder (ordre conseillé)

**1. Les 2 rapports d'audit (lecture intégrale obligatoire)**
- `AUDIT_HALLMARK_PARISCORE_2026-07-13.md` — audit home/football (13 findings, 5 critical)
- `AUDIT_HALLMARK_PARISCORE_SPORTS_2026-07-13.md` — audit 25 pages (80 findings consolidés)

**2. Zones du code source à modifier (pariscore.html, 27 784 lignes)**
- **Home / global tokens** : `:root` principal L282-325 (palette BETMART, fonts Poppins/Inter/DM Mono)
- **Fonts `<link>`** : L278-280 (9 polices → réduire à 3)
- **Tennis — blocs à fusionner** :
  - `tn2-tennis-redesign` : L23134-24519 (bloc `:root` L23139-23169)
  - `ps-*` (DATA_PIPELINE_V3) : L24222-24519 (bloc `:root` L24226-24253)
  - `tl-*` (BETMART) : L24551-24953 (bloc `:root` L24551-24574)
  - `sc-tennis-scope-css` : L24955-25373 (déjà partiellement aligné, à étendre)
- **CS2 (le plus slop)** : L22215-22727 (cyan-green pulse L22365-22369, 5+ side-stripes, double thème L22215 dark + L22421 light L'Équipe)
- **MMA (token improvisation)** : L22929-23132 (hex inline partout) + body L25376-25392
- **F1** : L22734-22800 (tokens scopés `--f1-*` propres, neumorphism lourd L22751)
- **Cycling (MODÈLE à imiter)** : L22801-22928 (tokens `--cyc-*`, cards plates, SVG main)
- **NBA/WNBA** : L22118-22173 / L22178-22213 (WNBA = alias NBA)
- **Comparateur (fragmentation)** : L22049-22109 (`.comp-*` + `toggleCompTheme()` L22066)
- **Pages transverses slop** :
  - hot-picks : L14002-14022 ("15 AI Tipsters" inventé L14006, emojis 📊✅👤🔥 L14016-14018)
  - sure-bets : L14025-14042 ("hit rate ~40%" inventé L14029)
  - tarifs : L20553-20567 + renderer `pariscore.app.js` L26631-26653 (hero centré L20556, grille 4 col L8243, badge "POPULAIRE")
- **Eyebrows `.section-label`** (à désactiver) : ~10 pages (L14004, 14027, 14716, 15065, 15293, 15342, 15384, 22052…)
- **fade-up scroll-reveal** (à couper) : 24 occurrences home + CS2 L22673 + tennis L25368/L23671/L24487

**3. Code source dynamique**
- `pariscore.app.js` (1,8 Mo) — logique des pages, notamment `page-tarifs` renderer L26631-26653

**4. Références Hallmark (skill installé)**
- `.agents/skills/hallmark/SKILL.md` — protocole complet (design flow, slop-test, disciplines)
- `.agents/skills/hallmark/references/anti-patterns.md` — **liste nommée des tells** (critical/major/minor) avec fix pour chacun
- `.agents/skills/hallmark/references/verbs/audit.md` — format audit
- `.agents/skills/hallmark/references/verbs/redesign.md` — à consulter avant refonte (safety rails)
- `.agents/skills/hallmark/references/color.md` — recettes OKLCH, accent discipline
- `.agents/skills/hallmark/references/typography.md` — pairings, scales, hero headline sizing
- `.agents/skills/hallmark/references/motion.md` — durées, easings, reduced-motion
- `.agents/skills/hallmark/references/slop-test.md` — les 58 gates à vérifier avant merge

**5. Documentation projet connexe**
- `CLAUDE.md` — roadmap complète, version history
- `CHANGELOG.md` — historique détaillé par version
- `ARCHITECTURE.md` / `ARCHITECTURE-DIAGRAMS.md` — structure actuelle
- `.agents/skills/system-design/SKILL.md` — principes scalabilité (skill ajouté 2026-07-13)
- `docs/system-design-primer/README.md` — ressource de référence (clone local)

**6. Contexte migration Next.js (opportunité d'application)**
- `package.json` — stack Next.js 16 + Bun + React 19 + Prisma
- `tailwind.config.ts` — config Tailwind 4 (cible pour tokens centralisés)
- `prisma/schema.prisma` — schéma DB
- `app/` — routes Next.js en cours de migration (cible pour `app/(sports)/<sport>/page.tsx`)

**Méthode recommandée** : ouvrir les 2 rapports Hallmark en côte-à-côte avec le code source, puis attaquer Phase 1.1 (réconciliation tennis) — quick win au meilleur ratio effort/impact.

### 🤖 Skills & MCP à utiliser pour automatiser le chantier

**3 skills orchestration (déjà installés pour ZCode + OpenCode)** :

| Skill | Rôle | Invocation typique |
|---|---|---|
| `design-system-unify` | **Workflow orchestré** — exécute les 3 phases du plan avec garde-fous (snapshot avant → commit → modif → re-audit → snapshot après → commit) | "applique Phase 1.1" · "nettoie CS2" · "unifier le design" |
| `visual-regression` | **Screenshots avant/après** via Playwright MCP (déjà installé). Pas besoin de Chromatic — overkill sans Storybook. | "capture tennis avant modifs" · "compare les visuels" |
| `hallmark` | **Audit + redesign** de chaque zone. `audit` pour re-vérifier après modifs (le compte de findings doit diminuer). | "audit pariscore.fr" · "redesign l'onglet tennis" |

**MCP déjà configurés dans `.mcp.json`** :

| MCP | Rôle pour le chantier |
|---|---|
| `playwright` (Microsoft) | Captures avant/après — voir skill `visual-regression` pour la convention de nommage |
| `frontendchecklist` | Audit a11y + perf + SEO après chaque changement de tokens |
| `git` | Commits atomiques (1 commit = 1 sous-tâche) |
| `memory` | Stocker l'état d'avancement inter-session (quelle phase commencée, quels onglets faits) |

### Automation & Outils ajoutés cette session

- **Ray 2.56.0** installé (`pip install ray`) — fonctionne sous Windows, init ~7s
- **`scripts/ray-design-unify.py`** (338 lignes) — automate Ray pour unifier le design system :
  - `scan` : liste toutes les valeurs hex inline dans les blocs `<style>` de chaque sport
  - `analyze` : compare hex vs tokens, catégorise (match/mismatch/pending)
  - `replace` : remplace les hex identifiés par `var(--sport-accent)` — **⚠️ ATTENTION** : 14 hex restants après `analyze` sont des déclarations intentionnelles (pas de correspondance directe avec un token)
  - `validate` : vérifie que tous les hex remplaçables sont traités
- **MCP agentmemory** ajouté (commit `7fae0ca`) — connaissances persistantes inter-sessions
- **Blocké** : vLLM (pas de wheel Windows, build from source timeout 300s, GTX 1050 4Go VRAM insuffisante)

**À NE PAS installer (incompatibles avec le monolithe actuel)** :
- ❌ Chromatic MCP → nécessite Storybook + composants React isolés. Devient pertinent **après** migration Next.js.
- ❌ 21st.dev Magic MCP → génère du React/shadcn. Idem, après migration.
- ❌ Figma MCP → pertinent seulement si tu as des maquettes Figma à extraire.

**Workflow type pour demain** :
```
1. "applique Phase 1.1" → design-system-unify orchestre :
   - skill visual-regression : capture tennis AVANT
   - git : commit baseline
   - skill hallmark : aliaser --tn2-* vers les globals (passe 1/4)
   - skill visual-regression : capture tennis APRÈS
   - skill hallmark : audit → vérifier que le compte baisse
   - git : commit atomique
   - (répéter pour passes 2, 3, 4)
2. "compare les visuels tennis" → visual-regression affiche AVANT vs APRÈS
3. "passe à 1.2" → design-system-unify enchaîne
```

**Diagnostic clé des 2 rapports :**
Le projet n'est pas un AI-slop générique, mais sa **fragmentation structurelle**
empêche l'identité de la home de s'étendre aux autres onglets. Le tennis est
**4 fois redéveloppé** (4 blocs `:root` indépendants : `tn2`/`ps`/`tl`/`sc`).
L'identité chromatique par sport est **largement illusoire** (5/6 sports en
rouge/orange interchangeable). Le comparateur a son **propre design system +
toggle dark/light**. Cycling est le modèle de propreté à suivre.

### Plan d'action ordonné (Quick wins first — ~15 jours total)

#### Phase 1 — Réconciliation design system (priorité absolue, ~5 j)

- [x] **1.1 Réconcilier les 4 blocs `:root` du tennis en 1** — ✅ FAIT (2026-07-14)
  - Passe 1 : 18/31 `--tn2-*` aliasés → globaux (`a730fa3`)
  - Passe 2 : 18/25 `--ps-*` aliasés → globaux (`ac174c8`)
  - Passe 3 : 19/22 `--tl-*` aliasés → globaux (`7adab5e`)
  - Validation visuelle : `match: true`, `mismatchPercentage: 0.0` (`b8e4c4e`)
  - Bloc `sc-*` déjà 100% aligné (pas de `:root` dédié)
  - **Gain** : ~60 tokens supprimés, zéro régression visuelle

- [~] **1.2 Définir tokens `--sport-accent` par onglet** — 🟡 EN COURS (2026-07-14)
  - ✅ Tokens ajoutés dans `:root` global + `#page-*` selecteurs (commit `3062a64`)
  - ✅ NBA/WNBA : 6x `#ff6b00` → `var(--sport-accent)` safe alias (commit `4174e66`)
  - ✅ Tennis/F1 : remplacement `#ff6d2e`/`#ff0043` → `var(--sport-accent)` (color change)
  - ✅ Script `scripts/ray-design-unify.py` : Ray scan/analyze/replace/validate (7 workers/sport)
  - ⏳ CS2 : `#E3001B` → `var(--sport-accent)` (color change rouge→cyan `#00d4ff`)
  - ⏳ MMA : `#E3001B` → `var(--sport-accent)` (même rouge que CS2)
  - ⏳ Validation visuelle APRES vs baseline

- [ ] **1.3 Unifier le système de cards** — 1 j
  - Choisir UN système (le plus complet = `sc-card`/`sc-livecard` tennis)
  - Déprécier `tn2-match-card`, `tl-card`, `ps-metric-xxl`, `.comp-*`

- [ ] **1.4 Standardiser les keyframes partagés** — 0.5 j
  - 1 `@keyframes live-pulse` (remplace `cs2pulse`, `mma-pulse`, `pulse-dot`)
  - 1 `@keyframes skeleton-shimmer` (remplace `psmSkelShimmer`, `sc-skel`, etc.)

- [ ] **1.5 Réconcilier `comparateur`** (retirer `.comp-light`/toggle thème) — 0.5 j
  - `toggleCompTheme()` (L22066) = seul endroit du site avec son propre dark/light toggle

#### Phase 2 — Nettoyage Hallmark par onglet (~7 j)

- [ ] **2.1 Supprimer invented metrics** — 0.5 j
  - "15 AI Tipsters" (L14006 hot-picks) — personas, pas 15 agents réels
  - "Hit rate estimé ~40%" + "Rentabilité > 100%" (L14029 sure-bets) — non sourcés
  - Soit sourcer via backtest, soit remplacer par `—` + bloc neutre

- [ ] **2.2 Remplacer emojis-feature-icons par SVG** — 2 j
  - CS2 : 10+ emojis (L22675, 22680, 22686-22691, 22722, 22647-22659)
  - NBA/WNBA : 🏀🤖 (L22142, 22150, 22209)
  - MMA : 💰🔄 (L25386-25387)
  - hot-picks : 📊✅👤🔥 (L14004, 14016-14018)
  - tennis KPI bar : 🎾💰🏆🌍 (L16096-16113)
  - 404 : 🤔 (L25398)
  - **Bibliothèque cible** : Lucide (déjà partiellement utilisé via `svgIcon()` L25479)

- [ ] **2.3 Désactiver eyebrows décoratifs `.section-label`** — 0.5 j
  - Présent sur ~10 pages (L14004, 14027, 14716, 15065, 15293, 15342, 15384, 22052…)
  - Hallmark : eyebrows "default OFF", seulement si ordinal/chapitré

- [ ] **2.4 Couper fade-up scroll-reveal** — 0.5 j
  - 24 occurrences home + CS2 (L22673) + tennis (L25368 sc-fade, L23671, L24487)
  - Garder max 1 orchestrated entrance au premier load

- [ ] **2.5 Nettoyer CS2 (le plus slop)** — 2 j
  - Cyan-green animated pulse borders (L22365-22369, 22512-22516) → border statique + badge typo
  - 5+ side-stripes (L22393, 22451, 22576, 22340, 22370/22517) → hairline border
  - Double thème (orange dark L22215-22420 + rouge L'Équipe light L22421-22640) → 1 seul thème
  - Neumorphism (L22287) → box-shadow simple

- [ ] **2.6 Nettoyer MMA token improvisation** — 1 j
  - Hex inline partout (L22939, 22957, 22963, 22975-22981, 23003-23009, 23035, 23063, 23077…)
  - Définir `--mma-accent`, `--mma-gold`, `--mma-bg` scoped

- [ ] **2.7 transition:all → listes explicites** — 1 j
  - 29 occurrences home + 20 tennis + diffusion transverses
  - Remplacer par `transition: background-color .15s, color .15s, border-color .15s`

#### Phase 3 — Nettoyage home + systèmes globaux (~3 j)

- [ ] **3.1 Purge fonts 9 → 3** — 0.5 j
  - Garder Poppins + Inter + DM Mono (L318-320)
  - Supprimer JetBrains Mono, Plus Jakarta, Barlow Condensed, Source Sans 3, Anton, Rajdhani du `<link>` (L280)
  - **Gain** : -700 Ko fonts, LCP -200ms

- [ ] **3.2 Glassmorphism 100 → 20 occurrences** — 1 j
  - Conserver backdrop-filter sur : sticky header, modale, popover, dropdown
  - Supprimer sur : cards statiques, sections, badges

- [ ] **3.3 Système d'élévation par luminosité** — 1 j
  - Remplacer 609 box-shadow (sur dark theme, ombres = glow-template)
  ```css
  --elev-0: var(--bg); --elev-1: var(--bg2); --elev-2: var(--bg3);
  --elev-3: var(--bg4); --elev-4: #1d2436;
  ```

- [ ] **3.4 Dédupliquer 468 gradients → 15 utility classes** — 0.5 j
  - `.g-bar-green`, `.g-bar-blue`, `.g-bar-red`, `.g-skeleton`, etc.
  - Cible : `grep -c "gradient"` < 50 (vs 468 actuellement)

- [ ] **3.5 Système z-index nommé à 6 niveaux** — 0.5 j
  ```css
  --z-base: 0; --z-raised: 10; --z-sticky: 100; --z-dropdown: 1000;
  --z-overlay: 2000; --z-modal: 3000; --z-toast: 4000;
  ```

### Note stratégique

**La migration Next.js 16 en cours est l'opportunité exacte** pour appliquer ces
principes : chaque route migrée vers `app/(sports)/<sport>/page.tsx` doit hériter
du design system centralisé (shadcn/ui + Tailwind 4 + tokens `--sport-accent`)
et appliquer les principes **Cycling** (cards plates, SVG main, zéro fade-up,
zéro glassmorphism décoratif). Quand la migration sera avancée, demander à
Hallmark `lock the system` pour générer un `design.md` portable empêchant la
dérive future.

**Référence modèle** : onglet Cycling (`#page-cycling`) — le plus propre, à imiter.
**Référence contre-modèle** : onglet CS2 (`#page-cs2`) — le plus slop, à refondre.

---

## Tennis sidebar toggle (style 1xbet)

**Status:** Rollbacké le 2026-07-11 — à refaire proprement dans une session dédiée.

**Contexte:**
- Demande initiale : ajouter un bouton pour masquer/afficher la sidebar de l'onglet Tennis, comme le font 1xbet et les sites de paris concurrents.
- Tentatives faites : bouton flottant, toggle dans header, renommage de `pariscore.js` en `pariscore.app.js`, désactivation temporaire du Service Worker.
- Problèmes rencontrés : cache stale, Service Worker conflictuel, états désynchronisés, mise en page cassée.
- Décision : rollback complet le 2026-07-11 pour restaurer la stabilité. La sidebar tennis est de nouveau toujours visible sur desktop.

**Prochaines étapes:**
1. Benchmark des patterns d'UX chez 1xbet, Betclic, Winamax, etc. (toggle d'affichage de blocs, comportement desktop/mobile, gestion du cache).
2. Définir la spec exacte : position du bouton, états collapsed/expanded, transitions, responsive, accessibilité.
3. Maquetter la solution sans impacter la stabilité (branche/feature séparée si possible).
4. Implémenter le toggle en s'appuyant sur une classe CSS unique et un état JS simple.
5. Tests visuels et fonctionnels avant merge/déploiement.
6. Réactiver proprement le Service Worker ou le remplacer par une stratégie de cache sans risque de stale UI.

**Files concernés (historique):**
- `pariscore.html` : markup + CSS de la sidebar tennis.
- `pariscore.app.js` : logique `_psToggleTennisSidebar`, `showPage('tennis')`.
- `sw.js` : gestion du cache shell (désactivé côté client le 2026-07-11).
- `server.js` : headers `Cache-Control` et `Clear-Site-Data`.

**Notes:**
- Ne pas redéployer de toggle sans avoir testé tous les cas : desktop ouvert/fermé, mobile, navigation SPA, refresh, hard-refresh, retour depuis une autre page.
- Prévoir un mécanisme de cache-busting robuste (fichiers versionnés ou hashed) si le Service Worker est réactivé.

## Session 2026-07-12 — BSD API + FlareSolverr BetWatch

**Fait :**
- [x] `BSD_API_KEY` mis à jour dans `.env` et serveur legacy redémarré.
- [x] `FLARESOLVERR_URL=http://localhost:8191` configuré dans `.env`.
- [x] FlareSolverr v3.5.0 installé et démarré sur `localhost:8191`.
- [x] `tools/start-flaresolverr.cmd` créé pour redémarrer facilement le proxy.
- [x] `scrape-betwatch-wom.js` fonctionne : football ~15 marchés / ~9-10 WOM, tennis paywallé (attendu).

**Bloqué / À suivre :**
- [ ] WebSocket BSD retourne `subscription_required` — la clé API est valide mais l'abonnement WebSocket BSD ($3/mois) n'est pas actif. Sans ça, le push live <5s est désactivé (BSD reste en polling).
- [ ] `ODDS_API_KEY` manquante dans `.env` → warning au boot, certaines cotes/providers peuvent être indisponibles.
- [ ] Clés IA manquantes (`GEMINI_API_KEY` / `GROQ_API_KEY` / `XAI_API_KEY` / `OPENROUTER_API_KEY`) → analyses IA désactivées.

**Prochaines sessions possibles :**
- Fournir/régler l'abonnement WebSocket BSD.
- Renseigner `ODDS_API_KEY` et les clés IA manquantes.
- Reprendre le ticket beads `ParisScorebis-phlf` (Premier Card — in_progress).
- Traiter les tickets beads ouverts : `ParisScorebis-ufh6` (mobile responsive tennis), `ParisScorebis-k684` (teaser value bets freemium), `ParisScorebis-10kj` (SSE push live tennis).
