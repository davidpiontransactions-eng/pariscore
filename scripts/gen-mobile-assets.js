#!/usr/bin/env node
/**
 * Génération des assets mobiles Capacitor (Android) pour PariScore.
 *
 * Produit :
 *  - resources/icon.png    (1024x1024 — source @capacitor/assets pour adaptive icons)
 *  - resources/splash.png  (2732x2732 — source @capacitor/assets pour le splash)
 *  - dist/index.html       (page fallback du mode remote : redirection vers le serveur)
 *  - dist/icon-512.png     (logo de la page fallback)
 *
 * Sources : public/icon-512.png (icône PWA existante) + fond #0E1217
 * (background_color du manifest PWA). Utilise sharp (déjà en dépendance).
 *
 * Usage : node scripts/gen-mobile-assets.js
 */
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const BG = "#0E1217";
const SRC_ICON = path.join(ROOT, "public", "icon-512.png");

const FALLBACK_HTML = `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>PariScore</title>
  <meta http-equiv="refresh" content="2;url=https://pariscore.fr" />
  <style>
    html, body { margin: 0; height: 100%; background: #0E1217; color: #E5E7EB;
      font-family: system-ui, -apple-system, sans-serif; }
    .wrap { height: 100%; display: flex; flex-direction: column; align-items: center;
      justify-content: center; gap: 18px; }
    img { width: 110px; height: 110px; border-radius: 24px; }
    h1 { font-size: 20px; margin: 0; letter-spacing: .3px; }
    p { font-size: 13px; opacity: .65; margin: 0; }
    a { color: #10b981; text-decoration: none; font-size: 14px; }
  </style>
</head>
<body>
  <div class="wrap">
    <img src="icon-512.png" alt="PariScore" />
    <h1>PariScore</h1>
    <p>Connexion au serveur…</p>
    <a href="https://pariscore.fr">Ouvrir PariScore</a>
  </div>
  <script>setTimeout(function(){ location.replace("https://pariscore.fr"); }, 300);</script>
</body>
</html>
`;

async function main() {
  fs.mkdirSync(path.join(ROOT, "resources"), { recursive: true });
  fs.mkdirSync(path.join(ROOT, "dist"), { recursive: true });

  // 1) Icône 1024x1024 — icon-512 upscalée (lanczos3), aplatie sur fond sombre
  //    (l'adaptive icon Android ne doit pas comporter de transparence de bord).
  const icon1024 = await sharp(SRC_ICON, { fit: "cover" })
    .resize(1024, 1024, { kernel: sharp.kernel.lanczos3 })
    .png()
    .toBuffer();
  await sharp({
    create: { width: 1024, height: 1024, channels: 3, background: BG },
  })
    .composite([{ input: icon1024 }])
    .flatten({ background: BG })
    .png()
    .toFile(path.join(ROOT, "resources", "icon.png"));
  console.log("[gen-mobile-assets] OK resources/icon.png (1024x1024)");

  // 2) Splash 2732x2732 — fond sombre + logo centré (~30% de la largeur).
  const splashLogo = await sharp(SRC_ICON)
    .resize(820, 820, { fit: "contain", background: { r: 14, g: 18, b: 23, alpha: 0 } })
    .png()
    .toBuffer();
  await sharp({
    create: { width: 2732, height: 2732, channels: 4, background: BG },
  })
    .composite([{ input: splashLogo, gravity: "center" }])
    .png()
    .toFile(path.join(ROOT, "resources", "splash.png"));
  console.log("[gen-mobile-assets] OK resources/splash.png (2732x2732)");

  // 3) Fallback web du mode remote (webDir = dist).
  fs.writeFileSync(path.join(ROOT, "dist", "index.html"), FALLBACK_HTML);
  fs.copyFileSync(SRC_ICON, path.join(ROOT, "dist", "icon-512.png"));
  console.log("[gen-mobile-assets] OK dist/index.html (fallback remote)");
}

main().catch((err) => {
  console.error("[gen-mobile-assets] ERREUR:", err);
  process.exit(1);
});
