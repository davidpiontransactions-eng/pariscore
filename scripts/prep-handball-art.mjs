#!/usr/bin/env node
// scripts/prep-handball-art.mjs
//
// Produit les variantes WebP des illustrations de l'onglet Handball à partir des
// fichiers déposés dans `public/handball-art/source/`.
//
// ⚠️ PAS DE CHROMA-KEY. Les rendus fournis (2026-10-04) ont un fond OPAQUE
// (arène floutée). La première version de la chaîne partait d'un joueur détouré
// sur fond vert et faisait un key local ; l'hypothèse « alpha » était fausse.
// Un key sur une photo de fond ne produirait qu'un fichier corrompu, d'où ce
// script qui se contente de normaliser le format.
//
// ⚠️ AUCUN RECADRAGE. Le joueur est en plein vol : le ratio du fichier source est
// conservé, c'est `object-position` en CSS qui cadre. Rogner le sujet serait
// bien pire qu'un ratio non carré.
//
// USAGE
//   node scripts/prep-handball-art.mjs            # scanne source/
//   node scripts/prep-handball-art.mjs --list     # liste source/ sans traiter
//
// SORTIES (par fichier `source/<slug>.png|jpg`)
//   public/handball-art/<slug>-1600.webp   bannière (pleine largeur)
//   public/handball-art/<slug>-800.webp    carte
//   public/handball-art/<slug>-256.webp    badge / état d'attente

import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, extname } from "node:path";
import sharp from "sharp";

const SRC = "public/handball-art/source";
const OUT = "public/handball-art";

/** Largeurs produites. Le ratio du source est préservé : pas de `fill`. */
const WIDTHS = [1600, 800, 256];

const args = process.argv.slice(2);
const listOnly = args.includes("--list");

if (!existsSync(SRC)) {
  console.error(
    `Dossier source absent : ${SRC}\n` +
      `Déposer les fichiers là, nommés <slug>.png|jpg|webp.\n` +
      `Slugs attendus : extension-rouge, extension-bleu\n` +
      `(voir src/lib/handball-art.ts)`,
  );
  process.exit(1);
}

const files = readdirSync(SRC).filter((f) => /\.(png|jpe?g|webp)$/i.test(f));
if (files.length === 0) {
  console.error(`Aucun fichier image dans ${SRC}.`);
  process.exit(1);
}

console.log(`${files.length} source(s) trouvée(s) :`);
for (const f of files) {
  const p = join(SRC, f);
  const meta = await sharp(p).metadata();
  console.log(
    `  ${f.padEnd(28)} ${meta.width}x${meta.height}  ratio=${(meta.width / meta.height).toFixed(2)}  ${(readFileSync(p).length / 1024).toFixed(0)} Ko`,
  );
}
if (listOnly) process.exit(0);

mkdirSync(OUT, { recursive: true });
console.log();
for (const f of files) {
  const slug = f.replace(extname(f), "");
  const p = join(SRC, f);
  for (const w of WIDTHS) {
    const out = join(OUT, `${slug}-${w}.webp`);
    await sharp(p)
      .resize({ width: w, withoutEnlargement: true })
      .webp({ quality: 86, effort: 5 })
      .toFile(out);
    const ko = (readFileSync(out).length / 1024).toFixed(0);
    console.log(`  ${slug}-${w}.webp  ${String(ko).padStart(4)} Ko`);
  }
}

console.log("\nVérifier : le sujet est-il cadré à `object-[65%_35%]` ?");
console.log("Un joueur en plein vol rogné est un défaut visible immédiatement.");
console.log("Manifeste attendu : src/lib/handball-art.ts");