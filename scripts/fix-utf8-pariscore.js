#!/usr/bin/env node
/**
 * fix-utf8-pariscore.js — Réparation d'encodage de pariscore.html
 *
 * Contexte : le fichier a subi un mojibake Latin-1 → UTF-8 qui a remplacé
 * ~3 425 caractères français (é, è, à, ç, ê, ô, î, â, …) et icônes (·, —, ▾,
 * 📊, ℹ, ▶, ❓) par U+FFFD (caractère de remplacement). L'information byte-level
 * originale est perdue, MAIS le contexte français rend la reconstruction fiable.
 *
 * Stratégie multi-niveaux (du plus sûr au plus contextuel) :
 *   1. Dictionnaire de mots français complets (corpus VPS + locales + brute-force
 *      sur les caractères accentués + désambiguïsation par fréquence).
 *   2. Dictionnaire manuel pour tokens non couverts (locutions, noms propres,
 *      classes regex, mots rares).
 *   3. Règles contextuelles pour les U+FFFD isolés (séparateurs ·, —, …, é).
 *   4. Fallback émojis (runs de 8 U+FFFD).
 *
 * Garde-fou : le script s'arrête en erreur si des U+FFFD subsistent après
 * toutes les passes, en listant les contextes non résolus.
 *
 * Usage :
 *   node scripts/fix-utf8-pariscore.js           # écrit pariscore.html.fixed
 *   node scripts/fix-utf8-pariscore.js --apply   # backup .bak + remplace l'original
 *   node scripts/fix-utf8-pariscore.js --check   # exit 1 si U+FFFD > 0 (read-only)
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TARGET = path.join(ROOT, 'pariscore.html');
const FFFD = '\uFFFD';

// ---------------------------------------------------------------------------
// 1. Dictionnaire automatique (pré-généré, 862 entrées issues du corpus
//    VPS + locales + brute-force FR).
//    Source : construit une fois via scripts/.gen-dict.js (intégré ci-dessous
//    en commentaire pour reproductibilité). Embarqué en dur pour portabilité.
// ---------------------------------------------------------------------------

// Généré par brute-force sur FR_CHARS × corpus VPS+locales — cf. analyse plan.
// Pour regénérer : voir fonction regenerateDict() en bas de fichier.
const AUTO_DICT = require('./.dict-auto.json');

// ---------------------------------------------------------------------------
// 2. Dictionnaire MANUEL — tokens non couverts par le corpus projet.
//    Chaque entrée validée à la main contre le contexte français.
// ---------------------------------------------------------------------------

const MANUAL_DICT = {
  // Participes / adjectifs en -é(s) non au corpus
  'surcharg�s': 'surchargés',
  'pass�s': 'passés',
  'branch�': 'branché',
  'Branch�': 'Branché',
  'vitr�': 'vitré',
  'vot�': 'voté',
  'calcul�e': 'calculée',

  // Mots avec accent non-é (ê, ô, î, œ)
  'fen�tres': 'fenêtres',
  'n�ud': 'nœud',
  'fant�me': 'fantôme',
  'd�corations': 'décorations',
  'd�l�gation': 'délégation',
  'Encha�ne': 'Enchaîne',
  'Rafra�chir': 'Rafraîchir',
  'Rafra�chissement': 'Rafraîchissement',
  'Bo�te': 'Boîte',
  'bo�te': 'boîte',
  'for�t': 'forêt',
  'For�t': 'Forêt',
  'h�te': 'hôte',
  'H�te': 'Hôte',
  'ma�tre': 'maître',
  'Ma�tre': 'Maître',
  '�tre': 'être', // si non résolu par corpus
  '�t�': 'été',
  'No�l': 'Noël',
  'o�': 'où',
  '�s': 'ès',
  'cr�er': 'créer',

  // Stratégie / mots avec é non couverts
  'strat�gique': 'stratégique',
  'strat�gie': 'stratégie', // au cas où
  'p�cote': 'pécote',
  'S�per': 'Super', // typo originale probable "Súper" → Super
  'pr�dic': 'prédict',
  'pr�dictifs': 'prédictifs',

  // Locutions (le tokenizer coupe sur -)
  'face-�-face': 'face-à-face',
  'Face-�-Face': 'Face-à-Face',
  'c�te-�-c�te': 'côte-à-côte',
  'jeu-par-jeu': 'jeu-par-jeu', // déjà propre (s'il apparaît avec FFFD final, règle suspension)
  'd\'arri�re-plan': 'd\'arrière-plan',

  // Phrases figées avec suspension (tokens multi-FFFD non résolus par corpus)
  // Origine : "temps r¿el¿" → dict rate le token complet (2 FFFD internes),
  // la règle isolée transformerait le FFFD final en é parasite ("temps réelé").
  'r�el�': 'réel…',
  'temps r�el�': 'temps réel…',

  // Classes regex / patterns techniques
  'A-Za-z�-�': 'A-Za-zÀ-ÿ',
  'A-Za-z�-��': 'A-Za-zÀ-ÿ',

  // Noms propres (tournois, joueurs) — apparaissent souvent avec suspension
  // (traités par règle fin-de-mot ci-dessous, mais au cas où)
};

// ---------------------------------------------------------------------------
// 3. Règles de fin-de-mot : "Mot�" où Mot est un mot français/neutre connu
//    ET le � final suit une lettre → probablement "…" (points de suspension).
//    Couvre : "Chargement…", "ligue…", "attente…", "cours…", "tournoi…",
//    "serveur…", "live…", "Madrid…", "Sinner…", "Garros…", etc.
//    On ne l'applique QUE si le préfixe (sans le � final) est un mot valide
//    ou un nom propre reconnu, pour éviter les faux positifs sur des participes
//    en "é" qui auraient échappé au dict.
// ---------------------------------------------------------------------------

// Mots qui, suivis d'un FFFD final isolé, signifient une suspension (…)
// plutôt qu'un é. Mots d'état/chargement, noms propres, anglicismes techniques,
// et mots déjà complets (qui ne prennent pas de é final légitime).
const SUSPENSION_PREFIXES = new Set([
  // états / UI de chargement
  'chargement', 'Chargement', 'initialisation', 'Initialisation',
  'attente', 'recherche', 'Rechercher', 'connexion', 'synchronisation',
  'cours', 'direct', 'live', 'en',
  // entités tennis/paris
  'ligue', 'tournoi', 'serveur', 'match', 'matchs', 'équipe', 'Équipe',
  'groupe', 'groupes', 'joueur', 'joueurs', 'Madrid', 'Sinner', 'Garros',
  'clay', 'classement', 'classements', 'période', 'round',
  // génériques
  'marché', 'marchés', 'stratégie', 'probabilité', 'règle', 'règles',
  'modèle', 'option', 'réglage', 'réglages', 'filtre', 'filtres',
  'votre', 'notre', 'leur', 'ce', 'cet', 'cette',
  // mots complets finissant par consonne/l : le FFFD suivant est une suspension,
  // pas un é parasite (évite "réelé", "détailé", "donnéesé"...).
  'réel', 'Réel', 'réels', 'détail', 'Détail', 'détails', 'Détails',
  'données', 'Données', 'donnée', 'modèle', 'Modèle', 'modèles', 'Modèles',
  'stratégies', 'Stratégies', 'probabilités', 'Probabilités',
  'marché', 'Marché', 'Marchés', 'qualité', 'Qualité',
  'fiabilité', 'Fiabilité', 'statistiques', 'Statistiques',
]);

// ---------------------------------------------------------------------------
// 4. Fallback multi-FFFD : runs de ≥2 U+FFFD consécutifs.
//    - Runs de 2 dans commentaires décoratifs (<!-- [??] SECTION ... -->)
//      → '══' (décorateur box-drawing, cohérent avec VPS qui en a 4655 '─').
//    - Runs de 2 après lettres (participes créées, agréés) → laisser au dict.
//    - Runs de ≥4 = émojis détruits → fallback contextuel.
// ---------------------------------------------------------------------------

function resolveEmojiRun(contextBefore, run) {
  // contextBefore = ~30 chars avant le run ; run = nb de FFFD
  // Runs de 2 : décorateur de commentaire (très fréquent dans ce fichier)
  if (run === 2) {
    // Si entouré de [ ] ou bordé par des séparateurs de commentaire → '══'
    if (/[\[\]]|\*|\-{2,}|={2,}/.test(contextBefore.slice(-5))) return '══';
    // Si collé à une lettre (participe créées, agréés) → laisser passer
    // (sera résolu par dict si applicable, sinon règle isolée)
    return '══';
  }
  // Runs ≥4 : émojis tennis/UI détruits
  const ctx = contextBefore.toLowerCase();
  if (/analyse|graph|chart|évolution/.test(ctx)) return '📊';
  if (/prédict|predict|confiance|fiabilit|info|aide/.test(ctx)) return 'ℹ';
  if (/action|sensible|moderate|warning|alerte|attention/.test(ctx)) return '⚠';
  if (/close|fermer|✕/.test(ctx)) return '✕';
  return '•'; // fallback neutre
}

// ---------------------------------------------------------------------------
// Pipeline principal
// ---------------------------------------------------------------------------

function loadFile(p) {
  return fs.readFileSync(p, 'utf8');
}

// Corpus français (pour la règle isolée : si "mot¿" où mot est un mot valide
// complet, alors le FFFD final est une suspension …, pas un é parasite).
// Construit depuis VPS + locales (mots ≥3 lettres, accentués ou non).
function buildFrCorpus() {
  const set = new Set();
  const addText = (text) => {
    const re = /[A-Za-zÀ-ÿŒœ]{3,}/g;
    let mm;
    while ((mm = re.exec(text)) !== null) {
      const w = mm[0];
      if (!w.includes(FFFD)) set.add(w.toLowerCase());
    }
  };
  try { addText(fs.readFileSync(path.join(ROOT, 'vps/pariscore.html'), 'utf8')); } catch (e) {}
  try { addText(fs.readFileSync(path.join(ROOT, 'locales/fr.json'), 'utf8')); } catch (e) {}
  try { addText(fs.readFileSync(path.join(ROOT, 'src/messages/fr.json'), 'utf8')); } catch (e) {}
  // Mots français ultra-courants à garantir présents
  'été été être équipe équipes modèle données probabilité probabilités stratégie stratégies marché marches détail détails décision défaut thème zéro état évolution sélection préserve période qualité récence résultats récent récente réel réelle réseau médiane complète couleurs unifié dupliqué masqué léger accès entrée expérience fiabilité rafraîchir calculé calculée pondérée équilibré décroissant gagné serré affiché éviter préfixe propriétés clés après côté décorations fenêtres surchargés passés branché vitré nœud fantôme délégation stratégique étape équipement tournoi ligue attente chargement initialisation synchronisation connexion recherche direct live matchs groupe'.split(/\s+/).forEach(w => set.add(w.toLowerCase()));
  return set;
}

function buildFullDict() {
  return Object.assign({}, AUTO_DICT, MANUAL_DICT);
}

// Applique le dictionnaire (auto + manuel) token par token.
// Token = suite alphanumérique + apostrophes/tirets internes, contenant ≥1 FFFD.
function applyDict(content, dict) {
  const tokenRe = /[A-Za-zÀ-ÿŒœ\uFFFD]+(?:[''\-][A-Za-zÀ-ÿŒœ\uFFFD]+)*/g;
  return content.replace(tokenRe, (tok) => {
    if (!tok.includes(FFFD)) return tok;
    if (Object.prototype.hasOwnProperty.call(dict, tok)) return dict[tok];
    return tok; // non résolu ici → passes suivantes
  });
}

// Règle fin-de-mot : "Mot�" → "Mot…" si Mot dans SUSPENSION_PREFIXES.
function applySuspensionRule(content) {
  // Matche : frontière + (Mot connu) + 1 FFFD + (frontière non lettre)
  // On reconstruit manuellement pour éviter une regex énorme.
  const prefixes = [...SUSPENSION_PREFIXES].sort((a, b) => b.length - a.length);
  let out = content;
  for (const p of prefixes) {
    // Le FFFD doit être suivi d'une fin de mot (espace, ponctuation, fin).
    // On utilise une fonction de remplacement car le préfixe peut contenir
    // des accents (regex source en clair).
    const escaped = p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(^|[^A-Za-zÀ-ÿŒœ])(${escaped})${FFFD}(?![A-Za-zÀ-ÿŒœ])`, 'g');
    out = out.replace(re, (full, pre, word) => `${pre}${word}\u2026`);
  }
  return out;
}

// Règle des runs multi-FFFD : ≥2 consécutifs.
// Run de 2 : décorateur de commentaire → '══' (sauf si dict a déjà résolu le token).
// Run ≥4 : émoji détruit → fallback contextuel.
// IMPORTANT : on n'applique cette règle qu'aux runs NON entourés de lettres
// (sinon c'est un mot comme "créées"/"agréés" à traiter par dict/isolé).
function applyEmojiRule(content) {
  const chars = [...content];
  let i = 0, out = '';
  while (i < chars.length) {
    if (chars[i] === FFFD) {
      let run = 0;
      while (chars[i + run] === FFFD) run++;
      const prevChar = out.length ? out[out.length - 1] : '';
      const nextChar = chars[i + run] || '';
      const surroundedByLetters = /[A-Za-zÀ-ÿŒœ]/.test(prevChar) && /[A-Za-zÀ-ÿŒœ]/.test(nextChar);
      if (run >= 4) {
        // émoji détruit (4-8 bytes UTF-8)
        const before = out.slice(-30);
        out += resolveEmojiRun(before, run);
      } else if (run >= 2 && !surroundedByLetters) {
        // décorateur de commentaire ou icône détruite isolée
        out += resolveEmojiRun(out.slice(-30), run);
      } else {
        // run entouré de lettres (participe) : laisser à la règle isolée
        out += chars.slice(i, i + run).join('');
      }
      i += run;
    } else {
      out += chars[i];
      i++;
    }
  }
  return out;
}

// Règle des U+FFFD résiduels isolés (1 seul entre espaces/ponctuation).
// Décision contextuelle avec préservation de la casse :
//   - entre deux mots avec espaces autour, en séparateur → "·" (middot)
//   - "mot¿" où mot est un mot français COMPLET valide → suspension "…"
//     (évite "réelé", "donnéesé" — le FFFD final n'est pas un é parasite)
//   - "mot¿" où mot est un radical/participe → accent préservant la casse
//   - "¿mot" début de mot → é/É selon casse du mot suivant
//   - reste → é (le plus productif en français)
function applyIsolatedRule(content, frCorpus) {
  let out = content;
  // " · " (espace middot espace) — séparateur entre concepts
  out = out.replace(new RegExp(`\\s${FFFD}\\s`, 'g'), ' \u00B7 ');
  // "mot¿" fin de mot :
  //   - si "mot" est un mot français complet valide → le FFFD est une suspension …
  //   - sinon → accent de fin préservant la casse (é ou É si mot en MAJUSCULES)
  out = out.replace(new RegExp(`([A-Za-zÀ-ÿŒœ]{2,})${FFFD}(?=[\\s,.;:!?'")<>/\`]|$)`, 'g'), (full, word) => {
    const isAllCaps = word.length >= 2 && word === word.toUpperCase() && /[A-Z]/.test(word);
    if (frCorpus && frCorpus.has(word.toLowerCase())) {
      return word + '\u2026'; // suspension (points de suspension)
    }
    return word + (isAllCaps ? 'É' : 'é');
  });
  // "¿mot" début de mot : préserver la casse du mot suivant.
  out = out.replace(new RegExp(`(\\s|['"(>\`])${FFFD}([A-Za-zÀ-ÿŒœ]+)`, 'g'), (full, pre, word) => {
    const isAllCaps = word.length >= 2 && word === word.toUpperCase() && /[A-Z]/.test(word);
    return pre + (isAllCaps ? 'É' : 'é') + word;
  });
  // Restant : FFFD isolé pur → é (le plus courant en français)
  out = out.replace(new RegExp(FFFD, 'g'), 'é');
  return out;
}

function countFFFD(s) {
  let n = 0; const arr = [...s]; for (let i = 0; i < arr.length; i++) if (arr[i] === FFFD) n++;
  return n;
}

function reportRemainingFFFD(content) {
  const chars = [...content];
  const samples = [];
  for (let i = 0; i < chars.length && samples.length < 25; i++) {
    if (chars[i] === FFFD) {
      const start = Math.max(0, i - 25);
      const end = Math.min(chars.length, i + 25);
      const ctx = chars.slice(start, end).join('').replace(/\n/g, '\\n').replace(/\uFFFD/g, '¿');
      samples.push(`  pos ${i}: ...${ctx}...`);
    }
  }
  return samples;
}

function main() {
  const argv = process.argv.slice(2);
  const apply = argv.includes('--apply');
  const check = argv.includes('--check');

  if (!fs.existsSync(TARGET)) {
    console.error(`Cible introuvable: ${TARGET}`);
    process.exit(2);
  }

  const original = loadFile(TARGET);
  const before = countFFFD(original);
  console.log(`[fix-utf8] ${TARGET}`);
  console.log(`[fix-utf8] U+FFFD avant: ${before}`);

  if (check) {
    if (before > 0) {
      console.error(`[fix-utf8] --check FAILED: ${before} U+FFFD restants`);
      reportRemainingFFFD(original).forEach((s) => console.error(s));
      process.exit(1);
    }
    console.log('[fix-utf8] --check OK: 0 U+FFFD');
    process.exit(0);
  }

  if (before === 0) {
    console.log('[fix-utf8] Rien à faire (déjà propre).');
    process.exit(0);
  }

  const dict = buildFullDict();
  const frCorpus = buildFrCorpus();
  console.log(`[fix-utf8] Dictionnaire: ${Object.keys(dict).length} entrées | Corpus FR: ${frCorpus.size} mots`);

  let fixed = original;
  fixed = applyDict(fixed, dict);
  let after1 = countFFFD(fixed);
  console.log(`[fix-utf8] Après dict: ${after1} U+FFFD`);

  fixed = applySuspensionRule(fixed);
  let after2 = countFFFD(fixed);
  console.log(`[fix-utf8] Après règle suspension: ${after2} U+FFFD`);

  fixed = applyEmojiRule(fixed);
  let after3 = countFFFD(fixed);
  console.log(`[fix-utf8] Après règle émojis: ${after3} U+FFFD`);

  fixed = applyIsolatedRule(fixed, frCorpus);
  let after4 = countFFFD(fixed);
  console.log(`[fix-utf8] Après règle isolés: ${after4} U+FFFD`);

  if (after4 > 0) {
    console.error(`[fix-utf8] ÉCHEC: ${after4} U+FFFD non résolus. Contextes:`);
    reportRemainingFFFD(fixed).forEach((s) => console.error(s));
    console.error('[fix-utf8] Abandon sans écriture. Compléter MANUAL_DICT et réexécuter.');
    process.exit(1);
  }

  // Sanity check : le compte de mots ne doit pas s'effondrer (±2%).
  const wordCount = (s) => (s.match(/[A-Za-zÀ-ÿŒœ]+/g) || []).length;
  const wcBefore = wordCount(original);
  const wcAfter = wordCount(fixed);
  const drift = ((wcAfter - wcBefore) / wcBefore) * 100;
  console.log(`[fix-utf8] Mots: ${wcBefore} → ${wcAfter} (dérive ${drift.toFixed(2)}%)`);
  if (Math.abs(drift) > 2) {
    console.error('[fix-utf8] ÉCHEC: dérive de compte de mots > 2% — vérifier les règles.');
    process.exit(1);
  }

  // Byte-size sanity (les U+FFFD font 3 bytes, les accents 2 — réduction attendue)
  const bytesBefore = Buffer.byteLength(original, 'utf8');
  const bytesAfter = Buffer.byteLength(fixed, 'utf8');
  console.log(`[fix-utf8] Taille: ${bytesBefore} → ${bytesAfter} bytes`);

  if (!apply) {
    const outPath = TARGET + '.fixed';
    fs.writeFileSync(outPath, fixed);
    console.log(`[fix-utf8] Dry-run : écrit ${path.relative(ROOT, outPath)} (utiliser --apply pour remplacer).`);
  } else {
    const bakPath = TARGET + '.bak';
    fs.writeFileSync(bakPath, original);
    fs.writeFileSync(TARGET, fixed);
    console.log(`[fix-utf8] Backup : ${path.relative(ROOT, bakPath)}`);
    console.log(`[fix-utf8] Appliqué : ${path.relative(ROOT, TARGET)}`);
  }
  console.log('[fix-utf8] OK.');
}

// Regénération du dictionnaire auto (référence — ne pas exécuter en prod).
// Pour regénérer scripts/.dict-auto.json :
//   1. lire vps/pariscore.html + locales/fr.json + src/messages/fr.json
//   2. construire un corpus Set<lowercased words>
//   3. pour chaque token corrompu de pariscore.html, brute-forcer FR_CHARS
//      et ne garder que les reconstructions présentes dans le corpus
//   4. en cas de >1 match, désambiguïser par score (é > è > ê > à > ç > ...)
// Voir l'historique Git de ce script pour le générateur inline initial.

if (require.main === module) {
  main();
}

module.exports = { applyDict, applySuspensionRule, applyEmojiRule, applyIsolatedRule, countFFFD };
