#!/usr/bin/env node
/**
 * graphify-merge-project.js
 * Fusionne le graphe projet PariScore Live (.graphify/pariscore-live-project.json)
 * dans le graphe de code principal (.graphify/graph.json).
 *
 * - Idempotent : ré-exécutable sans duplication (dédoublonnage par id de nœud
 *   et par triplet source|target|relation pour les liens).
 * - Dry-run par défaut : affiche le diff sans écrire. Utiliser --write pour appliquer.
 * - Backup automatique du graph.json original (.bak) lors de --write.
 *
 * Usage:
 *   node scripts/graphify-merge-project.js              # dry-run (lecture seule)
 *   node scripts/graphify-merge-project.js --write      # applique la fusion
 *   node scripts/graphify-merge-project.js --stats      # stats seulement
 *
 * Contexte: PariScore Live Optimisation - voir .context/PARI-LIVE-PROJECT-PLAN.md
 * Format: networkx node-link (nodes[]/links[] avec champ "relation").
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MAIN_GRAPH = path.join(ROOT, '.graphify', 'graph.json');
const PROJECT_GRAPH = path.join(ROOT, '.graphify', 'pariscore-live-project.json');

const args = new Set(process.argv.slice(2));
const DO_WRITE = args.has('--write');
const STATS_ONLY = args.has('--stats');

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

// Normalise le conteneur de nœuds/links : selon le graphe, nodes/links peuvent
// être au top-level (graph.json principal) ou dans un wrapper "graph"
// (pariscore-live-project.json). Retourne l'objet qui possède réellement .nodes.
function containerOf(obj) {
  if (obj && Array.isArray(obj.nodes)) return obj;
  if (obj && obj.graph && Array.isArray(obj.graph.nodes)) return obj.graph;
  throw new Error('Conteneur nodes/links introuvable dans le graphe');
}

function mergeGraphs(main, project) {
  const mc = containerOf(main);
  const pc = containerOf(project);
  const pNodes = pc.nodes;
  const pLinks = pc.links;

  const existingNodeIds = new Set(mc.nodes.map((n) => n.id));
  let addedNodes = 0;
  for (const n of pNodes) {
    if (!existingNodeIds.has(n.id)) {
      mc.nodes.push(n);
      existingNodeIds.add(n.id);
      addedNodes++;
    } else {
      // Merge léger : on complète les propriétés manquantes sans écraser.
      const cur = mc.nodes.find((x) => x.id === n.id);
      for (const [k, v] of Object.entries(n)) {
        if (cur[k] === undefined) cur[k] = v;
      }
    }
  }

  const linkKey = (e) => `${e.source}|${e.target}|${e.relation}`;
  const existingLinkKeys = new Set(mc.links.map(linkKey));
  let addedLinks = 0;
  for (const e of pLinks) {
    const k = linkKey(e);
    if (!existingLinkKeys.has(k)) {
      mc.links.push(e);
      existingLinkKeys.add(k);
      addedLinks++;
    }
  }

  return { addedNodes, addedLinks, totalNodes: mc.nodes.length, totalLinks: mc.links.length };
}

function stats(g) {
  const byType = {};
  const byRel = {};
  for (const n of g.nodes) byType[n.type] = (byType[n.type] || 0) + 1;
  for (const e of g.links) byRel[e.relation] = (byRel[e.relation] || 0) + 1;
  return { nodes: g.nodes.length, links: g.links.length, byType, byRel };
}

function main() {
  if (!fs.existsSync(MAIN_GRAPH)) {
    console.error(`KO: graphe principal introuvable: ${MAIN_GRAPH}`);
    process.exit(1);
  }
  if (!fs.existsSync(PROJECT_GRAPH)) {
    console.error(`KO: graphe projet introuvable: ${PROJECT_GRAPH}`);
    process.exit(1);
  }

  const mainGraph = readJson(MAIN_GRAPH);
  const projectGraph = readJson(PROJECT_GRAPH);

  if (STATS_ONLY) {
    const s = stats(containerOf(mainGraph));
    const ps = stats(containerOf(projectGraph));
    console.log('Graphe principal :', JSON.stringify(s));
    console.log('Graphe projet    :', JSON.stringify(ps));
    return;
  }

  const { addedNodes, addedLinks, totalNodes, totalLinks } = mergeGraphs(mainGraph, projectGraph);

  console.log(`Fusion: +${addedNodes} nœuds, +${addedLinks} relations (total: ${totalNodes} nœuds / ${totalLinks} relations)`);
  console.log(addedNodes === 0 && addedLinks === 0 ? '-> Déjà fusionné (idempotent, rien à faire).' : '-> Modifications détectées.');

  if (DO_WRITE && (addedNodes > 0 || addedLinks > 0)) {
    const bak = MAIN_GRAPH + '.bak';
    fs.copyFileSync(MAIN_GRAPH, bak);
    fs.writeFileSync(MAIN_GRAPH, JSON.stringify(mainGraph, null, 0));
    console.log(`Écrit: ${MAIN_GRAPH} (backup: ${bak})`);
  } else if (DO_WRITE) {
    console.log('Aucune écriture nécessaire (déjà à jour).');
  } else {
    console.log('Mode dry-run. Ajouter --write pour appliquer.');
  }
}

main();
