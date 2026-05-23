# PariScore × Roland Garros 2026 — Visual Assets Telegram

4 fichiers SVG vectoriels pour annonce communauté Telegram (et réseaux sociaux).

## Fichiers

| Fichier | Format | Usage |
|---|---|---|
| `pariscore-rg-hero-banner.svg` | 1280×720 (16:9) | Image principale annonce Telegram (canal/groupe), Open Graph site web, Twitter/X header |
| `pariscore-rg-badge-v1-shield.svg` | 512×512 (1:1) | Sticker premium shield/écusson — style classique tournoi |
| `pariscore-rg-badge-v2-circular.svg` | 512×512 (1:1) | Emblème circulaire arched — style médaille/coupe |
| `pariscore-rg-badge-v3-modern.svg` | 512×512 (1:1) | Bracket mark data-terminal — style PariScore tech identity |

## Conversion SVG → PNG (Telegram exige PNG/JPG)

### Option 1 — Inkscape (recommandé, gratuit)

Installer Inkscape (Windows/Mac/Linux) puis :

```bash
# Hero banner
inkscape pariscore-rg-hero-banner.svg \
  --export-type=png \
  --export-filename=pariscore-rg-hero-banner.png \
  --export-width=1280

# Badges
for f in pariscore-rg-badge-v1-shield pariscore-rg-badge-v2-circular pariscore-rg-badge-v3-modern; do
  inkscape "$f.svg" --export-type=png --export-filename="$f.png" --export-width=512
done
```

### Option 2 — ImageMagick (CLI)

```bash
sudo apt install imagemagick librsvg2-bin   # Ubuntu/Debian
brew install imagemagick librsvg            # macOS

magick -background none -density 300 pariscore-rg-hero-banner.svg pariscore-rg-hero-banner.png
magick -background none -density 300 pariscore-rg-badge-v1-shield.svg pariscore-rg-badge-v1-shield.png
magick -background none -density 300 pariscore-rg-badge-v2-circular.svg pariscore-rg-badge-v2-circular.png
magick -background none -density 300 pariscore-rg-badge-v3-modern.svg pariscore-rg-badge-v3-modern.png
```

### Option 3 — rsvg-convert (le plus rapide)

```bash
sudo apt install librsvg2-bin
rsvg-convert -w 1280 pariscore-rg-hero-banner.svg -o pariscore-rg-hero-banner.png
rsvg-convert -w 512 pariscore-rg-badge-v1-shield.svg -o pariscore-rg-badge-v1-shield.png
rsvg-convert -w 512 pariscore-rg-badge-v2-circular.svg -o pariscore-rg-badge-v2-circular.png
rsvg-convert -w 512 pariscore-rg-badge-v3-modern.svg -o pariscore-rg-badge-v3-modern.png
```

### Option 4 — Online (pas de CLI)

- https://cloudconvert.com/svg-to-png — upload, set width 1280 (hero) ou 512 (badges), download
- https://svgtopng.com/ — drag & drop
- Browser : ouvre le SVG dans Chrome/Firefox, F12 → element → screenshot node

### Option 5 — Aperçu rapide (Mac)

```bash
# Mac : qlmanage = quicklook preview to PNG
qlmanage -t -s 1280 -o . pariscore-rg-hero-banner.svg
```

## Palette de marque

- **Emerald (PariScore vert)** : `#0f5132` → `#2bb375` (gradient)
- **Clay orange (RG terre battue)** : `#cc6633` → `#e88f57` (gradient)
- **Gold accent** : `#d4af37` → `#f4d97a` (gradient premium)
- **Tennis ball** : `#e8f06a` → `#c2d445` → `#8aa325` (radial)
- **Charcoal background** : `#0a0d0f` → `#14181c` → `#1a1f24`

## Usage Telegram

### Canal/Groupe — annonce avec image

1. Convertir `pariscore-rg-hero-banner.svg` → PNG (~1280×720)
2. Dans Telegram :
   - **Iphone/Android** : attache photo → ajoute caption (message annonce ci-dessous)
   - **Desktop** : Ctrl+V image dans la barre de texte → caption
3. Le banner s'affiche en preview large au-dessus du texte

### Sticker pack

Pour créer un sticker pack PariScore officiel :
1. Convertir les 3 badges en PNG 512×512 (Telegram exige exactement cette taille)
2. Sticker pack max 50 stickers · format WEBP recommandé · fond transparent OK
3. Contacter @Stickers bot dans Telegram → `/newstickerpack` → upload PNG/WEBP

### Bot Telegram (envoi programmatique)

Si tu as un bot PariScore configuré (`TELEGRAM_BOT_TOKEN` dans `.env` du serveur) :

```bash
curl -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/sendPhoto" \
  -F "chat_id=$TELEGRAM_CHAT_ID" \
  -F "photo=@pariscore-rg-hero-banner.png" \
  -F "caption=$(cat ./caption-rg-launch.txt)" \
  -F "parse_mode=HTML"
```

## Crédits

Visuels conçus pour PariScore — l'edge mathématique au service du parieur. Tous les SVG sont libres d'usage commercial pour le projet PariScore et ses canaux de communication. Le logo et la marque "Roland Garros" demeurent la propriété de la FFT.
