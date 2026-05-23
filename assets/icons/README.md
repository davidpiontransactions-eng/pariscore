# Icônes Navbar 3D PariScore

Spécifications pour les 16 icônes de la barre de navigation principale.

## Fichiers requis (à uploader dans `/assets/icons/`)

| Filename | Page | Symbolisme suggéré |
|---|---|---|
| `3d-football.png` | Football (`matchs`) | Ballon de football, style 3D rendu, palette emerald PariScore |
| `3d-tennis.png` | Tennis | Balle de tennis (couture blanche visible), jaune-vert standard |
| `3d-trophy.png` | Roland Garros (`rg`) | Coupe trophée gold/clay, avec base terre battue subtile |
| `3d-strategy.png` | Top Stratégies | Cible/dartboard OU pièce d'échec (cavalier), couleur emerald |
| `3d-fire.png` | Hot Picks | Flamme orange/rouge volumétrique, énergique |
| `3d-ticket.png` | Mes Paris | Ticket de paris (encoche dentelée), papier/argent |
| `3d-book.png` | Guide | Livre ouvert, pages mat blanc, reliure gold/emerald |
| `3d-shield.png` | Sure Bets | Bouclier avec checkmark vert, métal brossé |
| `3d-compare.png` | Comparateur | Balance OU 2 flèches échange (cotes), neutre gris/gold |
| `3d-brain.png` | Prédictions IA | Cerveau avec circuit board overlay, glow purple/blue |
| `3d-chart.png` | Tendances | Graphique en ligne montante avec barres, emerald |
| `3d-bell.png` | Alertes | Cloche avec point notification rouge/clay |
| `3d-clock.png` | Historique | Horloge analogique OU sablier, vintage/premium |
| `3d-home.png` | Accueil | Maison stylisée OU bouton home circulaire, neutre |
| `3d-crown.png` | Tarifs | Couronne gold, symbole Pro/premium |
| `3d-settings.png` | Paramètres | Engrenage 3D métallique, neutre gris |

**Total : 16 fichiers PNG.**

## Specs techniques obligatoires

| Critère | Valeur |
|---|---|
| Format | PNG-24 avec alpha channel (fond transparent obligatoire) |
| Dimensions source | **128×128** minimum (idéalement 256×256 pour Retina) |
| Affichage CSS | 24×24 desktop · 22×22 mobile (auto-scale via `object-fit: contain`) |
| Padding interne | ~10–15% de marge autour de l'icône (ne pas remplir bord à bord) |
| Style | 3D rendered (Higgsfield, MidJourney, Blender, ou pack premium type Iconscout 3D, Lordicon) |
| Cohérence | Même style 3D pour les 16 icônes (matte/glossy/clay/gradient — choisir une direction) |
| Palette autorisée | Brand PariScore : emerald `#0f5132` / clay `#cc6633` / gold `#d4af37` + neutres (gris, blanc, ombres) |

## Sources recommandées (packs ready-to-use, pas de génération AI)

### Option 1 — Iconscout 3D Pack ⭐ recommandé

- URL : https://iconscout.com/3d-icons
- Abonnement ~20€/mois (Lite) ou achat à l'unité (~1€/icône)
- Avantage majeur : **packs cohérents** (même style, même lighting, même palette) → les 16 icônes parfaitement homogènes
- Filtrer par style : "Clay", "Glossy", "Cute", "Realistic", "Isometric" — choisir un seul style pour les 16
- Format export : PNG 256×256 / 512×512 alpha déjà transparent
- Recommandation set : "Business 3D" ou "Sport & Game 3D" ou "Premium 3D Icons"

### Option 2 — Streamline 3D Emojis

- URL : https://www.streamlinehq.com/icons/streamline-emojis
- Library quasi-officielle Apple-style emojis en 3D
- Free tier avec attribution, paid sans attribution
- Couvre 99% des concepts dont on a besoin (ball, trophy, fire, ticket, book, shield, scale, brain, chart, bell, clock, house, crown, gear)

### Option 3 — Flaticon UICONS 3D (gratuit)

- URL : https://www.flaticon.com/uicons-3d
- Gratuit avec attribution mention (lien crédits en footer site)
- Catalogue large, qualité variable selon créateur — vérifier visuel avant download
- Format PNG export natif

### Option 4 — Lordicon 3D

- URL : https://lordicon.com/icons/3d
- Bonus : animations Lottie disponibles si on veut un effet hover animé en V2
- Pricing : free tier limité, paid pour usage commercial sans crédit

### Option 5 — Quick fix sans budget : émojis Apple/Google en PNG

Ship immédiat zero-cost :
- https://emojipedia.org/ → click emoji (🎾 🏆 🔥 etc.) → download Apple/Google PNG haute-rés
- Renommer selon le tableau de cette doc
- ⚠️ Licence : Apple emojis = propriété Apple. Tolérance usage perso/blog. Commercial strict = risque. Préférer Twemoji (Twitter Open Source, CC-BY 4.0) :
  - https://github.com/twitter/twemoji → SVG/PNG libres, attribution simple

### Option 6 — Twemoji direct (recommandé pour gratuit + clean license)

- URL : https://twemoji-cheatsheet.vercel.app/
- Licence CC-BY 4.0 (attribution lien GitHub)
- 3000+ emojis style cohérent
- Mapping suggéré :
  | Page | Twemoji codepoint |
  |---|---|
  | football | `26bd` (⚽) |
  | tennis | `1f3be` (🎾) |
  | trophy | `1f3c6` (🏆) |
  | strategy | `1f3af` (🎯) |
  | fire | `1f525` (🔥) |
  | ticket | `1f3ab` (🎫) |
  | book | `1f4d6` (📖) |
  | shield | `1f6e1` (🛡) |
  | compare | `2696` (⚖) |
  | brain | `1f9e0` (🧠) |
  | chart | `1f4c8` (📈) |
  | bell | `1f514` (🔔) |
  | clock | `1f570` (🕰) |
  | home | `1f3e0` (🏠) |
  | crown | `1f451` (👑) |
  | settings | `2699` (⚙) |

  Download via : `https://twemoji.maxcdn.com/v/latest/72x72/<codepoint>.png` (free CDN)

### Workflow gratuit ship-aujourd'hui (Twemoji)

```bash
cd /home/ubuntu/pariscore/assets/icons
curl -o 3d-football.png https://twemoji.maxcdn.com/v/latest/72x72/26bd.png
curl -o 3d-tennis.png   https://twemoji.maxcdn.com/v/latest/72x72/1f3be.png
curl -o 3d-trophy.png   https://twemoji.maxcdn.com/v/latest/72x72/1f3c6.png
curl -o 3d-strategy.png https://twemoji.maxcdn.com/v/latest/72x72/1f3af.png
curl -o 3d-fire.png     https://twemoji.maxcdn.com/v/latest/72x72/1f525.png
curl -o 3d-ticket.png   https://twemoji.maxcdn.com/v/latest/72x72/1f3ab.png
curl -o 3d-book.png     https://twemoji.maxcdn.com/v/latest/72x72/1f4d6.png
curl -o 3d-shield.png   https://twemoji.maxcdn.com/v/latest/72x72/1f6e1.png
curl -o 3d-compare.png  https://twemoji.maxcdn.com/v/latest/72x72/2696.png
curl -o 3d-brain.png    https://twemoji.maxcdn.com/v/latest/72x72/1f9e0.png
curl -o 3d-chart.png    https://twemoji.maxcdn.com/v/latest/72x72/1f4c8.png
curl -o 3d-bell.png     https://twemoji.maxcdn.com/v/latest/72x72/1f514.png
curl -o 3d-clock.png    https://twemoji.maxcdn.com/v/latest/72x72/1f570.png
curl -o 3d-home.png     https://twemoji.maxcdn.com/v/latest/72x72/1f3e0.png
curl -o 3d-crown.png    https://twemoji.maxcdn.com/v/latest/72x72/1f451.png
curl -o 3d-settings.png https://twemoji.maxcdn.com/v/latest/72x72/2699.png
ls -la *.png   # doit montrer 16 fichiers
git add *.png && git commit -m "feat(assets): 16 nav icons via Twemoji CC-BY 4.0" && git push
```

→ Ship en 5 minutes, license clean, zero coût. Mention Twitter/Twemoji attribution dans le footer site web ou page /about à ajouter ensuite.

## Validation post-upload

Une fois les 16 fichiers placés dans `assets/icons/` :

```bash
# Local
ls -la assets/icons/*.png   # doit montrer 16 fichiers
git add assets/icons/*.png
git commit -m "feat(assets): 16 nav 3D icons PNG transparent"
git push

# VPS (après pull)
cd /home/ubuntu/pariscore && git pull
# Vérifier servies correctement par le serveur Node :
curl -I http://localhost:3000/assets/icons/3d-football.png
# Doit renvoyer 200 + Content-Type: image/png
```

## Fallback en l'absence des fichiers

Tant que les PNG ne sont pas uploadés, les `<img>` afficheront le `alt` attribute en texte cassé (broken image icon). Pour éviter cet état dégradé avant upload, possibilité d'ajouter une règle CSS temporaire :

```css
/* PROVISOIRE — masque l'icône si fichier absent */
.nav-icon-3d:not([src]),
.nav-icon-3d[src=""] { display: none; }
```

Ou alternativement, garder les emojis Unicode en fallback inline (édition manuelle des liens `<a>` jusqu'à ce que les PNG soient prêts).

## Recommandation finale

Pour ship rapide **dès aujourd'hui** : utiliser un pack Iconscout 3D (~20€/mois, accès tous les icônes). Sélectionner un set "business" ou "sport" cohérent et exporter les 16 icônes en PNG 128×128 transparent.

Pour ship premium **long-terme** : commissionner ou générer un set 3D custom (Higgsfield/Blender) avec brand identity PariScore exclusive — meilleur ROI image de marque.
