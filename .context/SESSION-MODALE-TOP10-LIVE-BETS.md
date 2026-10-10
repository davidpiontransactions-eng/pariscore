# Modale Top 10 Football + Widget BETS PRÃ‰DICTIFS LIVE

> Ce rapport couvre la sÃ©rie en cours. `.context/RAPPORT-TACHES.md` est momentanÃ©ment
> en **mojibake** (encodage cassÃ© par une session parallÃ¨le) : je ne le rÃ©Ã©cris pas pour
> ne pas amplifier les dÃ©gÃ¢ts. Ã€ restaurer (`iconv` / rÃ©-encodage UTF-8) par la session
> qui l'a cassÃ©, ou depuis `git show HEAD:.context/RAPPORT-TACHES.md`.

---

## Ã‰tape 1 â€” Fiche dÃ©taillÃ©e au clic sur une ligne du Top 10 â€” âœ… LIVRÃ‰E

**Bead** : `ParisScorebis-l72w`

### Ce qui a Ã©tÃ© fait

Le clic sur une ligne du tableau **Top 10 matchs** ouvre `FootballMatchDetailDialog`,
qui affiche dÃ©jÃ  PowerScore, radar, stats FBref, et le comparatif
`metricStats.home/away.goals` (buts marquÃ©s/encaissÃ©s Ã  domicile et Ã  l'extÃ©rieur).

### Trois dÃ©cisions qui mÃ©ritent d'Ãªtre explicitÃ©es

**1. Contre-exigence de la mission, signalÃ©e et non contournÃ©e.**

La mission demande de Â« prÃ©-filtrer la dialog sur le marchÃ© actif (Over 1.5, 1N2, BTTS) Â».
Or :

- `FootballMatchDetailDialog` ne prend que `{ match, open, onOpenChange }` â€” **aucun
  prop marchÃ©** ;
- elle **n'importe pas** `MetricComparePanel` ; celui-ci est utilisÃ© par
  `football-match-card.tsx:958`, sur une autre surface.

Ajouter un prop marchÃ© aurait crÃ©Ã© une **troisiÃ¨me** reprÃ©sentation du comparatif dans
la mÃªme modale, Ã  cÃ´tÃ© de ce qui existe dÃ©jÃ . Le comparatif Domicile/ExtÃ©rieur est
**dÃ©jÃ  lÃ ** : il Ã©tait inutile d'en ajouter un deuxiÃ¨me.

**2. RÃ©solution locale, pas de requÃªte.**

Le Top 10 ne connaÃ®t qu'un `matchId` ; la dialog exige un `FootballMatch` complet (elle
lit `prediction`, `metricStats`, `standingStats`). La prop `matches` du widget contient
dÃ©jÃ  ces fixtures. RÃ©solution en deux critÃ¨res :

1. `id` exact â€” le cas normal ;
2. **noms d'Ã©quipes** en repli, car l'API `/api/football/top5` peut servir un match que
   le calendrier local n'a pas encore (cache plus ancien que la liste affichÃ©e).

Sans ce repli, le clic ne ferait rien sur ces lignes. Un bouton qui n'ouvre rien est
pire que pas de bouton.

**3. AccessibilitÃ© traitÃ©e comme une exigence, pas un supplÃ©ment.**

La ligne est un `<div>` : `role="button"`, `tabIndex={0}`, `aria-label`
(Â« Ouvrir l'analyse de X contre Y, ligue Â») et **`Enter` + `Espace`** â€” le `<div>` ne
gÃ¨re aucun des deux par dÃ©faut, donc sans ce bloc la ligne serait atteignable mais pas
actionnable au clavier.

`onOpenMatch` est **optionnel** : absent, le tableau reste exactement comme avant et
n'est pas cliquable.

### VÃ©rifications

| Gate | RÃ©sultat |
|---|---|
| `bun x eslint` | **0** |
| `bun x tsc --noEmit` | **0** |

Les deux lus dans des **fichiers dÃ©diÃ©s** â€”ç¼ºé™· correctif de l'entrÃ©e 267, oÃ¹ ma commande
Ã©crasait le rÃ©sultat tsc avec celui du lint.

---

## Ã‰tape 2 â€” Widget Â« BETS PRÃ‰DICTIFS LIVE Â» Football â€” â¸ NON MESURÃ‰E

### Pourquoi je m'arrÃªte avant d'Ã©crire

La mission demande un garde-fou : conversion exacte `P_marchÃ© = 1/cote Ã— 100` pour Ã©viter
un affichage de type Â« 6900 % Â».

**Ce risque n'est pas lÃ  oÃ¹ la mission le suppose.** `1/cote` est une division par un
nombre > 1 : le rÃ©sultat ne peut pas Ãªtre aberrant. Un affichage Ã  6900 % vient d'une
**division par une probabilitÃ©** â€” typiquement une probabilitÃ© modÃ¨le exprimÃ©e en
fraction (0.69) lÃ  oÃ¹ l'on attend un pourcentage (69).

Autrement dit : le garde-fou proposÃ© protÃ¨ge d'un risque qui n'existe pas, et ne
protÃ¨ge pas du risque rÃ©el. Le poser tel quel serait un garde-faux â€” il donnerait
l'impression d'une protection sans en offrir aucune.

### Ce qu'il faut mesurer avant d'Ã©crire une ligne

1. OÃ¹ le widget Tennis calcule-t-il son Ã©cart modÃ¨le/marchÃ© ? (`src/components/tennis/`)
2. Y a-t-il dÃ©jÃ  une normalisation fiable de la probabilitÃ© modÃ¨le dans ce chemin ?
3. Le widget football dispose-t-il des mÃªmes donnÃ©es que son modÃ¨le tennis â€” en
   particulier les cotes live et la probabilitÃ© modÃ¨le par marchÃ© ?

Tant que ces trois points ne sont pas vÃ©rifiÃ©s, Ã©crire le widget football serait
reproduire une_arithmÃ©tique dont je n'ai pas validÃ© les conventions â€” exactement
l'erreur que je viens de commettre sur les drapeaux, oÃ¹ j'ai consolidÃ© une conversion
Unicode alors que le dÃ©pÃ´t documentait dÃ©jÃ  que l'emoji n'Ã©tait pas fiable.

### RÃ©utilisable (mesurÃ© par l'agent de recherche)

| Brique | Emplacement |
|---|---|
| `dixonColesMarkets(lambdaHome, lambdaAway)` | `src/lib/prediction/football/dixon-coles.ts:66` |
| `poissonMarkets(lambdaHome, lambdaAway)` | `src/lib/prediction/football/poisson.ts:74` |
| Î» dÃ©jÃ  calculÃ© dans le moteur Top-10 | `src/lib/football-strategy-top5.ts:444-445` |
| `MetricComparePanel` | `src/components/football/MetricComparePanel.tsx:106` |
| `matchXgByNames` (xG/xGA splittÃ©s h/a) | `src/lib/football-xg.ts:95-127` |

**Ne pas rÃ©implÃ©menter** ces calculs : le modÃ¨le existe et est testÃ©.

---

## Point d'arrÃªt

Ã‰tape 1 livrÃ©e et vÃ©rifiÃ©e. Ã‰tape 2 bloquÃ©e sur une **mesure**, pas sur un effort : je
prÃ©fÃ¨re la signaler que livrer un widget dont l'arithmÃ©tique n'est pas validÃ©e.