// Random Forest classifier — JS-native inference.
// Soft-voting across decision trees for 3-class output (Home/Draw/Away).
// Trees stored as flat arrays for fast traversal.
// Serialization: loadModel() / saveModel() pour persister les arbres entraînés.

import { readFileSync, writeFileSync, existsSync } from "fs";

const NODE_SIZE = 7; // [featIdx, thresh, leftIdx, rightIdx, valHome, valDraw, valAway]
const LEAF_MARKER = -1;

type TreeNode = {
  featIdx: number; threshold: number;
  left: number; right: number;
  valHome: number; valDraw: number; valAway: number;
};

type DecisionTree = TreeNode[];

type Sample = { features: number[]; label: number }; // 0=Home, 1=Draw, 2=Away

/** Représentation sérialisée d'un modèle RF pour stockage JSON. */
type SerializedRF = {
  version: 1;
  featureCount: number;
  trees: number[][]; // chaque arbre = flat array [featIdx, thresh, left, right, vH, vD, vA, ...]
};

export type RFProbs = { home: number; draw: number; away: number };

// ---------------------------------------------------------------------------
// Gini impurity & best split
// ---------------------------------------------------------------------------

function giniImpurity(samples: Sample[]): number {
  if (samples.length === 0) return 0;
  const counts = [0, 0, 0];
  for (const s of samples) counts[s.label]++;
  let imp = 1;
  for (const c of counts) imp -= (c / samples.length) ** 2;
  return imp;
}

function bestSplit(samples: Sample[], featIdx: number): { threshold: number; gain: number } | null {
  if (samples.length < 10) return null;
  const vals = samples.map(s => s.features[featIdx]).sort((a, b) => a - b);
  let bestT = 0, bestG = -1;
  const parentG = giniImpurity(samples);

  for (let i = 1; i < vals.length; i++) {
    const t = (vals[i - 1] + vals[i]) / 2;
    const left: Sample[] = [], right: Sample[] = [];
    for (const s of samples) (s.features[featIdx] <= t ? left : right).push(s);
    if (left.length < 5 || right.length < 5) continue;
    const gain = parentG
      - (left.length / samples.length) * giniImpurity(left)
      - (right.length / samples.length) * giniImpurity(right);
    if (gain > bestG) { bestG = gain; bestT = t; }
  }
  return bestG > 0 ? { threshold: bestT, gain: bestG } : null;
}

// ---------------------------------------------------------------------------
// Tree builder (greedy, max depth 6, min samples 5)
// ---------------------------------------------------------------------------

function buildTree(samples: Sample[], depth: number, maxDepth: number, nFeats: number): DecisionTree {
  const nodes: DecisionTree = [];

  const buildNode = (s: Sample[], d: number): number => {
    if (d >= maxDepth || s.length < 5) {
      const c = [0, 0, 0];
      for (const x of s) c[x.label]++;
      const tot = s.length || 1;
      nodes.push({ featIdx: LEAF_MARKER, threshold: 0, left: -1, right: -1, valHome: c[0] / tot, valDraw: c[1] / tot, valAway: c[2] / tot });
      return nodes.length - 1;
    }

    let bf = -1, bt = 0, bg = 0;
    for (let f = 0; f < nFeats; f++) {
      const spl = bestSplit(s, f);
      if (spl && spl.gain > bg) { bg = spl.gain; bt = spl.threshold; bf = f; }
    }

    if (bf < 0) {
      const c = [0, 0, 0];
      for (const x of s) c[x.label]++;
      const tot = s.length || 1;
      nodes.push({ featIdx: LEAF_MARKER, threshold: 0, left: -1, right: -1, valHome: c[0] / tot, valDraw: c[1] / tot, valAway: c[2] / tot });
      return nodes.length - 1;
    }

    const ni = nodes.length;
    nodes.push({ featIdx: bf, threshold: bt, left: -1, right: -1, valHome: 0, valDraw: 0, valAway: 0 });

    const leftS: Sample[] = [], rightS: Sample[] = [];
    for (const x of s) (x.features[bf] <= bt ? leftS : rightS).push(x);

    nodes[ni].left = buildNode(leftS, d + 1);
    nodes[ni].right = buildNode(rightS, d + 1);
    return ni;
  };

  buildNode(samples, 0);
  return nodes;
}

// ---------------------------------------------------------------------------
// Random Forest
// ---------------------------------------------------------------------------

export class RandomForest {
  trees: DecisionTree[];
  featureCount: number;

  constructor(trees: DecisionTree[], featureCount: number) {
    this.trees = trees;
    this.featureCount = featureCount;
  }

  /** Nombre d'arbres dans la forêt. */
  get treeCount(): number {
    return this.trees.length;
  }

  /** Charge un modèle RF sérialisé depuis un fichier JSON. */
  static loadModel(path: string): RandomForest | null {
    try {
      if (!existsSync(path)) return null;
      const raw = readFileSync(path, "utf-8");
      const data: SerializedRF = JSON.parse(raw);
      if (data.version !== 1 || !Array.isArray(data.trees)) return null;

      const trees: DecisionTree[] = data.trees.map((flat) => {
        const nodes: TreeNode[] = [];
        for (let i = 0; i < flat.length; i += NODE_SIZE) {
          nodes.push({
            featIdx: flat[i],
            threshold: flat[i + 1],
            left: flat[i + 2],
            right: flat[i + 3],
            valHome: flat[i + 4],
            valDraw: flat[i + 5],
            valAway: flat[i + 6],
          });
        }
        return nodes;
      });

      return new RandomForest(trees, data.featureCount);
    } catch {
      return null;
    }
  }

  /** Sérialise le modèle RF en JSON et l'écrit sur disque. */
  saveModel(path: string): void {
    const data: SerializedRF = {
      version: 1,
      featureCount: this.featureCount,
      trees: this.trees.map((tree) =>
        tree.flatMap((n) => [n.featIdx, n.threshold, n.left, n.right, n.valHome, n.valDraw, n.valAway])
      ),
    };
    writeFileSync(path, JSON.stringify(data), "utf-8");
  }

  /** Predict class probabilities. */
  predict(features: number[]): RFProbs {
    let home = 0, draw = 0, away = 0;
    for (const tree of this.trees) {
      let ni = 0;
      while (tree[ni].featIdx !== LEAF_MARKER) {
        const n = tree[ni];
        ni = features[n.featIdx] <= n.threshold ? n.left : n.right;
      }
      const leaf = tree[ni];
      home += leaf.valHome; draw += leaf.valDraw; away += leaf.valAway;
    }
    const n = this.trees.length || 1;
    return { home: home / n, draw: draw / n, away: away / n };
  }

  /** Train from samples. */
  static train(samples: Sample[], numTrees = 50, maxDepth = 6, nFeats = 20): RandomForest {
    const trees: DecisionTree[] = [];
    for (let t = 0; t < numTrees; t++) {
      const boot: Sample[] = [];
      for (let i = 0; i < samples.length; i++) boot.push(samples[Math.floor(Math.random() * samples.length)]);
      trees.push(buildTree(boot, 0, maxDepth, nFeats));
    }
    return new RandomForest(trees, nFeats);
  }

  /** Serialize to flat array. */
  toFlat(): number[] {
    const f: number[] = [];
    for (const tree of this.trees)
      for (const n of tree)
        f.push(n.featIdx, n.threshold, n.left, n.right, n.valHome, n.valDraw, n.valAway);
    return f;
  }
}
