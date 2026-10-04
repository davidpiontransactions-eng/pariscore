// Rendu « cartoon 3D » local : portrait stylisé relief + cel-shading, sans IA.
// 100 % déterministe, zéro dépendance hors `sharp` (déjà installé).
//
// Chaîne : luminance → profondeur multi-échelle → normales (Sobel) → bandes
// toon + spéculaire quantifié + rim light → bloom → contour → vignette → grain.
//
// ⚠️ Honesteté sur le nom : c'est un **relief 2.5D + cel-shading**, pas du 3D
// Pixar. Aucun générateur d'image distant n'est disponible (DashScope 401,
// Gemini image 429/quota 0, Pollinations 402 — mesuré le 2026-10-03) : le rendu
// est obtenu par re-shading d'une photo, pas par re-création 3D du personnage.
//
// Usage : bun scripts/cartoon3d.mjs --in <photo> --out <dossier> [--width 1400]

import sharp from "sharp";
import path from "node:path";
import { mkdirSync } from "node:fs";
import { pathToFileURL } from "node:url";

const argv = process.argv.slice(2);
const arg = (k, d) => {
  const i = argv.indexOf(k);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d;
};

const IN = arg("--in");
const OUT = arg("--out", "assets/cartoon3d");
const WIDTH = parseInt(arg("--width", "1400"), 10);

if (!IN) {
  console.error("Usage: bun scripts/cartoon3d.mjs --in <photo> --out <dossier>");
  process.exit(1);
}

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const smoothstep = (e0, e1, x) => {
  const t = clamp((x - e0) / (e1 - e0 || 1e-6), 0, 1);
  return t * t * (3 - 2 * t);
};

/**
 * Flou gaussien séparable, 3 passes de box blur (approximation σ × 1,5).
 *
 * ⚠️ Pourquoi maison et pas `sharp.blur()` : mesuré le 2026-10-03 sur ce build
 * (sharp via Bun sous Windows), `blur()` renvoie une image en stries
 * horizontales — sur buffer raw ET via un PNG intermédiaire — et sur une vraie
 * photo il tue le process (exit 7, aucun handler JS ne s'exécute). Le
 * convolutionnement natif est donc inutilisable ici ; 40 lignes de JS le
 * remplacent et rendent le pipeline indépendant de libvips.
 */
function boxBlurH(src, w, h, r) {
  const out = new Float32Array(w * h);
  const norm = 1 / (2 * r + 1);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    let acc = 0;
    for (let k = -r; k <= r; k++) acc += src[row + Math.min(w - 1, Math.max(0, k))];
    for (let x = 0; x < w; x++) {
      out[row + x] = acc * norm;
      acc += src[row + Math.min(w - 1, x + r + 1)] - src[row + Math.max(0, x - r)];
    }
  }
  return out;
}

function boxBlurV(src, w, h, r) {
  const out = new Float32Array(w * h);
  const norm = 1 / (2 * r + 1);
  for (let x = 0; x < w; x++) {
    let acc = 0;
    for (let k = -r; k <= r; k++) acc += src[Math.min(h - 1, Math.max(0, k)) * w + x];
    for (let y = 0; y < h; y++) {
      out[y * w + x] = acc * norm;
      acc += src[Math.min(h - 1, y + r + 1) * w + x] - src[Math.max(0, y - r) * w + x];
    }
  }
  return out;
}

/** Flou gaussien sur un buffer mono (Float32Array, longueur w*h). */
function gaussBlurMono(src, w, h, sigma) {
  const r = Math.max(1, Math.round(sigma * 1.5));
  let a = Float32Array.from(src);
  for (let i = 0; i < 3; i++) {
    a = boxBlurH(a, w, h, r);
    a = boxBlurV(a, w, h, r);
  }
  return a;
}

/** Idem sur 3 canaux entrelacés (pour le bloom). */
function gaussBlurRgb(src, w, h, sigma) {
  const r = Math.max(1, Math.round(sigma * 1.5));
  let a = Float32Array.from(src);
  for (let i = 0; i < 3; i++) {
    a = boxBlurH(a, w * 3, h, r * 3);
    a = boxBlurV(a, w * 3, h, r * 3);
  }
  return a;
}

/**
 * Rend un portrait stylisé.
 * @param {Buffer} inputImage photo source
 * @param {{width:number, cel:boolean}} opts
 * @returns {Promise<Buffer>} PNG
 */
export async function renderCartoon3d(inputImage, { width = WIDTH, cel = false } = {}) {
  const base = sharp(inputImage).rotate();
  const meta = await base.metadata();
  const w = Math.min(width, meta.width ?? width);
  const h = Math.max(1, Math.round((meta.height / meta.width) * w));

  const { data: rgb, info } = await sharp(inputImage)
    .rotate()
    .resize({ width: w, withoutEnlargement: true })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const W = info.width;
  const H = info.height;
  const n = W * H;

  // 1 — luminance
  const luma = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    luma[i] = 0.2126 * rgb[i * 3] + 0.7152 * rgb[i * 3 + 1] + 0.0722 * rgb[i * 3 + 2];
  }
  const lumaU8 = Buffer.alloc(n);
  for (let i = 0; i < n; i++) lumaU8[i] = luma[i];

  // 2 — profondeur multi-échelle (large = volume, fin = détail de peau/maillage)
  const dFar = gaussBlurMono(luma, W, H, 26);
  const dNear = gaussBlurMono(luma, W, H, 6);
  const depth = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const d = 0.72 * dFar[i] + 0.28 * dNear[i];
    depth[i] = 255 * Math.pow(d / 255, 1.25); // gamma : creuse les ombres
  }

  // 3 — normales par Sobel sur la profondeur (bordures clampées, pas de wrap :
  // un wrap ferait virer la profondeur sur les bords de l'image)
  const at = (x, y) => depth[clamp(y, 0, H - 1) * W + clamp(x, 0, W - 1)];
  const strength = cel ? 11 : 7;
  const nx = new Float32Array(n);
  const ny = new Float32Array(n);
  const nz = new Float32Array(n);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const gx =
        at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1) -
        (at(x - 1, y - 1) + 2 * at(x - 1, y) + at(x - 1, y + 1));
      const gy =
        at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1) -
        (at(x - 1, y - 1) + 2 * at(x, y - 1) + at(x + 1, y - 1));
      let vx = (-gx * strength) / 255;
      let vy = (-gy * strength) / 255;
      let vz = 1;
      const len = Math.hypot(vx, vy, vz) || 1;
      const i = y * W + x;
      nx[i] = vx / len;
      ny[i] = vy / len;
      nz[i] = vz / len;
    }
  }

  // 4 — éclairage
  const L = (() => {
    const v = [-0.35, -0.62, 0.7];
    const l = Math.hypot(...v);
    return v.map((c) => c / l);
  })();
  // demi-vecteur (L + V), V = (0,0,1)
  const Hv = (() => {
    const v = [L[0], L[1], L[2] + 1];
    const l = Math.hypot(...v);
    return v.map((c) => c / l);
  })();

  // 5 — bloom : hautes lumières floutées (σ large)
  const bloom = gaussBlurRgb(rgb, W, H, 12);

  const sat = cel ? 1.7 : 1.45;
  const outlineGain = cel ? 1.45 : 1.0;
  const out = Buffer.alloc(n * 3);

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const lambert = clamp(nx[i] * L[0] + ny[i] * L[1] + nz[i] * L[2], 0, 1);

      // bandes toon : 3 marches, d'abord douce (cel) puis serrée
      const soft1 = cel ? 0.018 : 0.05;
      const soft2 = cel ? 0.018 : 0.05;
      const band =
        0.3 * smoothstep(0.3 - soft1, 0.3 + soft1, lambert) +
        0.3 * smoothstep(0.55 - soft2, 0.55 + soft2, lambert) +
        0.4 * smoothstep(0.78 - soft1, 0.78 + soft1, lambert);

      // remplissage doux (évite les noirs bouchés)
      const fill = 0.5 + 0.5 * lambert;

      // spéculaire Blinn quantifié en 3 paliers
      const specRaw = Math.pow(clamp(nx[i] * Hv[0] + ny[i] * Hv[1] + nz[i] * Hv[2], 0, 1), 24);
      const spec = specRaw < 0.25 ? 0 : specRaw < 0.55 ? 0.28 : 0.6;

      // rim light : détache le sujet du fond sombre. Gain volontairement bas —
      // au-delà de ~0.2 les pectoraux saturent en blanc et le relief s'efface.
      const rim = Math.pow(1 - nz[i], 3);

      let light = band + 0.14 * fill + spec + 0.18 * rim;

      // contour : Sobel sur la luminance
      const lAt = (px, py) => luma[clamp(py, 0, H - 1) * W + clamp(px, 0, W - 1)];
      const ex = Math.abs(lAt(x + 1, y) - lAt(x - 1, y));
      const ey = Math.abs(lAt(x, y + 1) - lAt(x, y - 1));
      const edge = Math.hypot(ex, ey);
      const outline = smoothstep(28, 70, edge) * 0.55 * outlineGain;
      light -= outline;

      // bloom additif sur les hautes lumières — seuil haut (0.80) sinon les
      // zones déjà claires saturent et le modelé disparaît
      const hi = clamp((luma[i] - 0.8 * 255) / (0.2 * 255), 0, 1);
      const gain = (0.55 + 0.75 * light) + 0.28 * hi;

      const L0 = luma[i];
      for (let c = 0; c < 3; c++) {
        let v = rgb[i * 3 + c] * gain + bloom[i * 3 + c] * hi * 0.28;
        v = L0 + (v - L0) * sat; // saturation
        out[i * 3 + c] = clamp(v, 0, 255);
      }
    }
  }

  // vignette + grain déterministe (appliqués après, sur le buffer final)
  const cx = W / 2;
  const cy = H / 2;
  const maxR = Math.hypot(cx, cy);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const r = Math.hypot(x - cx, y - cy) / maxR;
      const vig = 1 - 0.45 * Math.pow(r, 2.2);
      // hash déterministe (pas de Math.random : rendu reproductible)
      const g = ((Math.imul(x, 374761393) + Math.imul(y, 668265263)) >>> 0) % 17 - 8;
      for (let c = 0; c < 3; c++) {
        out[i * 3 + c] = clamp(out[i * 3 + c] * vig + g, 0, 255);
      }
    }
  }

  return await sharp(out, { raw: { width: W, height: H, channels: 3 } }).png().toBuffer();
}

// ─── CLI ────────────────────────────────────────────────────────────────────
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  mkdirSync(OUT, { recursive: true });
  const stem = path.basename(IN).replace(/\.[^.]+$/, "");
  for (const cel of [false, true]) {
    const png = await renderCartoon3d(await Bun.file(IN).arrayBuffer(), { cel });
    const dest = path.join(OUT, `${stem}${cel ? "-cel" : ""}.png`);
    await Bun.write(dest, png);
    console.log(`${dest}  ${(png.length / 1024).toFixed(0)} Ko`);
  }
  // La source est conservée hors du dépôt : seules les dérivées sont commitées.
  console.log(`largeur ${WIDTH}px · 2 variantes (doux + cel)`);
}