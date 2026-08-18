#!/usr/bin/env node
/**
 * pm-loop.js — Orchestrateur "Chef de Projet" PariScore.
 *
 * Boucle d'ingenierie + realisation/pilotage d'un Gantt + graphify + deploy.bat.
 * A utiliser des que l'utilisateur demande d'ecrire un prompt de realisation :
 * le script scaffolde le prompt (role Chef de Projet), le Gantt (JSON + SVG),
 * suit l'avancement, et a 100 % enchaîne graphify update puis deploy.bat.
 *
 * Usage :
 *   node scripts/pm-loop.js init <project> "<description>" [days] [--force]
 *        -> cree gantt-<project>.json + gantt-<project>.svg + .context/prompts/prompt-<project>.md
 *   node scripts/pm-loop.js gantt <project>
 *        -> regenere le SVG depuis le JSON
 *   node scripts/pm-loop.js status <project>
 *        -> % d'avancement (items termines = label prefixe "✅ ")
 *   node scripts/pm-loop.js complete <project> "<msg deploy>"
 *        -> si 100% : graphify update . puis deploy.bat "<msg>" (sinon refuse)
 *   node scripts/pm-loop.js graphify
 *        -> met a jour le graphe de connaissance (.graphify/)
 *   node scripts/pm-loop.js help
 */
'use strict';

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PROMPTS_DIR = path.join(ROOT, '.context', 'prompts');
const DAY = 24 * 3600 * 1000;
const DONE = '\u2705 '; // "✅ " prefix = item termine (compatible pickClass gen-gantt-svg.js)

// ---------------------------------------------------------------- helpers
function iso(d) { return d.toISOString().slice(0, 10); }
function addDays(base, n) { return iso(new Date(new Date(base + 'T12:00:00').getTime() + n * DAY)); }
function ganttPath(p) { return path.join(ROOT, 'gantt-' + p + '.json'); }
function svgPath(p) { return path.join(ROOT, 'gantt-' + p + '.svg'); }
function promptPath(p) { return path.join(PROMPTS_DIR, 'prompt-' + p + '.md'); }
function die(msg, code) { console.error('[pm-loop] ' + msg); process.exit(code || 1); }
function sh(cmdline, cwd) {
  try { return execFileSync('cmd', ['/c', cmdline], { cwd: cwd || ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); }
  catch (e) { return String(e.stdout || '') + String(e.stderr || ''); }
}

// ---------------------------------------------------------------- gantt
const DEFAULT_TRACKS = [
  { name: 'Recherche & spec', offset: 0, items: [
    { label: 'P0 spec + sources de donnees', dur: 2 },
    { label: 'Mapping equipes / ligues / saisons', dur: 2 },
  ] },
  { name: 'API serveur', offset: 1, items: [
    { label: 'Route API + modele JSON', dur: 2 },
    { label: 'Cache 7j api_cache', dur: 1 },
  ] },
  { name: 'Calculs stats', offset: 3, items: [
    { label: 'General stats (V/N/D, GF/GA, BTTS, over 2.5)', dur: 2 },
    { label: 'Sequences & streaks', dur: 1 },
    { label: 'Records', dur: 1 },
  ] },
  { name: 'UI', offset: 5, items: [
    { label: 'Modal + selecteur saison', dur: 2 },
    { label: 'Sections + toggle All/Home/Away', dur: 2 },
  ] },
  { name: 'Cache & pre-chauffage', offset: 6, items: [
    { label: 'Pre-chauffage matchs du jour', dur: 1 },
  ] },
  { name: 'QA & validation', offset: 8, items: [
    { label: 'QA vs reference (fcstats)', dur: 1 },
    { label: 'Fix + re-test', dur: 1 },
  ] },
  { name: 'Gantt & pilotage', offset: 0, items: [
    { label: 'Gantt init', dur: 0 },
    { label: 'Gantt pilotage (a chaque boucle)', dur: 10 },
  ] },
];

function buildGantt(project, description, days) {
  const labels = [];
  for (let i = 0; i < days; i++) labels.push(addDays(iso(new Date()), i));
  const tracks = DEFAULT_TRACKS.map(t => ({
    name: t.name,
    items: t.items.map(it => {
      const start = labels[Math.min(t.offset, labels.length - 1)];
      const end = labels[Math.min(t.offset + it.dur, labels.length - 1)];
      return { label: it.label, start, end };
    }),
  }));
  return { title: project + ' - ' + description, timeline: { labels }, tracks };
}

function renderSvg(project) {
  const json = ganttPath(project);
  if (!fs.existsSync(json)) die('gantt-' + project + '.json introuvable — lancer "init" d\'abord');
  const out = execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'gen-gantt-svg.js'), json], { encoding: 'utf8', cwd: ROOT });
  fs.writeFileSync(svgPath(project), out);
  console.log('[pm-loop] SVG genere : gantt-' + project + '.svg');
}

function ganttStatus(project) {
  const json = ganttPath(project);
  if (!fs.existsSync(json)) die('gantt-' + project + '.json introuvable');
  const data = JSON.parse(fs.readFileSync(json, 'utf8'));
  let total = 0, done = 0, pending = [];
  data.tracks.forEach(t => t.items.forEach(it => {
    total++;
    if (it.label.startsWith(DONE)) done++;
    else pending.push('  [' + t.name + '] ' + it.label + ' (' + it.start + ' -> ' + it.end + ')');
  }));
  const pct = total ? Math.round((done / total) * 100) : 0;
  console.log('[pm-loop] ' + data.title);
  console.log('[pm-loop] Avancement : ' + done + '/' + total + ' (' + pct + '%)');
  if (pending.length) { console.log('[pm-loop] Restant :'); pending.forEach(l => console.log(l)); }
  else console.log('[pm-loop] 100 % — pret pour "complete"');
  return pct;
}

// ---------------------------------------------------------------- prompt template
function promptTemplate(project, description) {
  return `# Prompt — ${project} — ${description}

## Role de l'agent : CHEF DE PROJET — orchestration, Gantt, boucle d'ingenierie

Tu es un **chef de projet d'ingenierie**, pas un simple implementeur. Tu pilotes le projet en
boucle d'ingenierie et tu delegues l'execution. Tu ne codes pas toi-meme les sous-taches : tu
orchestres, review et valides.

### Boucle d'ingenierie (repeter a chaque iteration)
1. **Planifier** : decouper le projet en sous-taches independantes et ordonnees (dependances explicites).
2. **Deleguer** : dispatcher les sous-taches en parallele a des sub-agents specialises.
3. **Integrer** : verifier l'integration des livrables (pas de conflit, pas de regression).
4. **Reviewer** : faire relire chaque livrable (revue de code + QA ciblee).
5. **Valider** : appliquer les criteres d'acceptation avant de fermer.
6. **Piloter** : mettre a jour le Gantt + les issues \`bd\` (statut, dates, blocages) et iterer.
Boucles courtes : une sous-tache = une boucle. Ne jamais avancer 2 boucles sans passer la review.

### Orchestration des agents (sub-agents opencode disponibles)
- \`explore\` — recherche pre-implantation (structure des sources, routes existantes, mappings)
- \`general\` — execution des sous-taches isolees (API, calculs, UI, cache)
- \`code-reviewer\` — revue systematique avant integration (correctness, securite, perf, conventions)
- \`test-engineer\` — ecriture des tests/scripts de validation des calculs
- \`security-auditor\` — audit XSS et exposition des nouvelles routes
- \`web-performance-auditor\` — cache, latence, pre-chauffage
Dispatch en parallele quand les sous-taches sont independantes ; chaque sub-agent reçoit un
contexte minimal et le critere de completude de SA sous-tache uniquement.

### Skills a activer (presentes dans le repo)
\`writing-plans\` (decoupage avant code), \`aos-planning-and-task-breakdown\` (decomposition),
\`subagent-driven-development\` / \`dispatching-parallel-agents\` (dispatch),
\`executing-plans\` (execution pas-a-pas), \`aos-incremental-implementation\` (changements atomiques),
\`aos-code-review-and-quality\` / \`requesting-code-review\` (gate de qualite),
\`verification-before-completion\` (preuve avant "fait"), \`aos-doubt-driven-development\` (adversarial
review sur les choix a risque), \`systematic-debugging\` (si bug).

### Gantt : realiser ET piloter (script automatique)
1. **Realiser** : \`node scripts/pm-loop.js init ${project} "${description}"\` a deja cree
   \`gantt-${project}.json\` + \`gantt-${project}.svg\`. Ajuster le JSON si besoin (dates reelles).
2. **Piloter** : a chaque boucle — marquer les items termines avec le prefixe \`✅ \` dans le JSON,
   puis \`node scripts/pm-loop.js gantt ${project}\` (regenere le SVG) et
   \`node scripts/pm-loop.js status ${project}\` (avancement %).
   En cas de derive > 1 jour, re-estimer et ajuster — documenter l'ecart.
3. Le Gantt est un livrable du projet au meme titre que le code : a jour en fin de session.

### Tracking des sous-taches (regle repo)
Chaque sous-tache = une issue \`bd\` (beads) : \`bd create\`, \`bd update <id> --claim\` avant le dispatch,
\`bd close <id>\` seulement apres validation. Pas de TODO list markdown.

### Graphify (obligatoire une fois le prompt realise a 100 %)
Des que TOUTES les sous-taches sont terminees (100 % au \`status\`), executer :
\`node scripts/pm-loop.js complete ${project} "<message de deploy>"\`
qui enchaîne automatiquement :
1. \`graphify update .\` — actualisation du graphe de connaissance (\`.graphify/\`).
2. \`deploy.bat "<message>"\` — deploiement production (point d'entree unique du repo).
Ne pas deployer avant 100 % ; si le deploy est refuse par le script, finir les sous-taches restantes.

### Livrable final de pilotage
En fin de session : rapport court — sous-taches faites/blocked, ecarts Gantt (plan vs reel),
decisions d'arbitrage, issues \`bd\` restantes, preuve du deploy (sortie deploy.bat + graphify).

## Cahier des charges (a completer par l'agent chef de projet)
${description}

---
Projet : ${project} — scaffolde par scripts/pm-loop.js (Chef de Projet / engineering loop / Gantt / graphify / deploy).
`;
}

// ---------------------------------------------------------------- commands
function cmdInit(args) {
  const project = args[0];
  const description = args[1] || 'Projet sans description';
  const force = args.includes('--force');
  if (!project || !/^[a-z0-9-]+$/.test(project)) die('init <project> "<description>" — project doit etre [a-z0-9-]');
  const days = parseInt(args[2] || '12', 10) || 12;
  if (!fs.existsSync(PROMPTS_DIR)) fs.mkdirSync(PROMPTS_DIR, { recursive: true });

  const g = buildGantt(project, description, days);
  fs.writeFileSync(ganttPath(project), JSON.stringify(g, null, 2));
  console.log('[pm-loop] Gantt JSON : gantt-' + project + '.json (' + g.tracks.length + ' tracks)');
  renderSvg(project);

  const pp = promptPath(project);
  if (fs.existsSync(pp) && !force) console.log('[pm-loop] Prompt deja present (--force pour ecraser) : ' + pp);
  else { fs.writeFileSync(pp, promptTemplate(project, description)); console.log('[pm-loop] Prompt : ' + pp); }

  console.log('[pm-loop] Suivant : editer le prompt (cahier des charges), puis node scripts/pm-loop.js status ' + project);
}

function cmdComplete(project, msg) {
  const pct = ganttStatus(project);
  if (pct < 100) die('Projet a ' + pct + '% — terminer toutes les sous-taches (prefixe "✅ ") avant complete');
  if (!msg) die('complete <project> "<msg deploy>" — message obligatoire pour deploy.bat');
  console.log('[pm-loop] 100 % — etape 1/2 : graphify update .');
  const g = sh('graphify update .');
  console.log(g.trim() || '[pm-loop] graphify OK (sortie vide)');
  console.log('[pm-loop] etape 2/2 : deploy.bat "' + msg + '"');
  const d = sh('deploy.bat "' + msg + '"');
  console.log(d.trim() || '[pm-loop] deploy OK (sortie vide)');
  console.log('[pm-loop] Cycle Chef de Projet termine.');
}

function main() {
  const args = process.argv.slice(3);
  switch (process.argv[2]) {
    case 'init': cmdInit(args); break;
    case 'gantt': renderSvg(args[0]); break;
    case 'status': ganttStatus(args[0]); break;
    case 'complete': cmdComplete(args[0], args[1]); break;
    case 'graphify': console.log(sh('graphify update .').trim() || '[pm-loop] graphify OK'); break;
    case 'help':
    case undefined:
      console.log('Usage : node scripts/pm-loop.js <init|gantt|status|complete|graphify|help> ...');
      break;
    default: die('commande inconnue : ' + process.argv[2] + ' (voir "help")');
  }
}

main();