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

## Sources de génération recommandées

### Option 1 — Higgsfield (quand crédits rechargés)

Prompt template par icône :
```
Premium 3D rendered icon of a [SYMBOL], glossy matte finish, transparent
background, centered composition, soft studio lighting, drop shadow,
emerald green and gold accent palette, isometric or slight perspective
angle, ultra-detailed, octane render, 4K, app icon style, no text, no
background, 128x128
```

### Option 2 — MidJourney v6+

```
3D icon, [SYMBOL], glossy emerald green and gold, transparent background,
centered, soft lighting, premium app icon style --ar 1:1 --no background
--style raw
```

### Option 3 — Packs commerciaux ready-to-use

- **Iconscout 3D Pack** : https://iconscout.com/3d-icons — abonnement, 16 icônes à choisir dans un même set (cohérence garantie)
- **Lordicon 3D** : https://lordicon.com/icons/3d — animations bonus
- **Streamline 3D** : https://www.streamlinehq.com/icons/streamline-emojis — émojis 3D quasi-officiels
- **Flaticon 3D** : https://www.flaticon.com/uicons-3d — gratuit avec attribution

### Option 4 — Quick fix : émojis convertis en PNG

Pour ship immédiat sans génération : exporter les emojis Apple (raquette 🎾, coupe 🏆, etc.) en PNG via :
- https://emojipedia.org/ → click emoji → download Apple/Google style PNG
- Renommer selon le tableau ci-dessus
- ⚠️ Vérifier licence (Apple emojis = propriété Apple, OK usage perso, KO usage commercial strict)

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
